// Falcon 9's drawing: static parts drawn with the kit and empty slots (data-dyn) that live.js fills from
// the model (engine plumes, legs, grid fins, nitrogen puffs). Every item sits in a carrier group
// (data-carry) so the page can fly the booster, the second stage, the two fairing halves and the scenery
// on their own; the kit's exploded view moves the items themselves.
import { createLayout } from "./layout.mjs";

const Layout = createLayout();
const SIZES = Layout.sizes;
const R = SIZES.radius;
const UP = [0, 0, 1];

export function drawFigure(draw) {
  const { lathe, projection: P, at, line: Ln, dots: D, trace, box, post, frontArc, circleOnTop, put, also, solid } = draw;

  const carried = (carrier, markup) => `<g data-carry="${carrier}">${markup}</g>`;
  const turned = (profile, x, y, tone) => solid(lathe.lathe(profile, lathe.frameAlong([x, y, 0], UP), P), { tone });
  const rings = (radius, heights) => heights.map((z) => frontArc(0, 0, radius, z)).join("");
  const seam = (radius, heights, tone = "lo") => Ln(rings(radius, heights), { tone });
  // A flame from the kit effect: warm body, a splash where it meets a surface, near-white core, diamonds.
  const flameSlot = (data, index, diamonds = 4) => `<g class="f9-flame" data-dyn="${data}" data-index="${index}" opacity="0"><path class="ma-fx-halo" d=""/><path class="ma-fx-body" d=""/><path class="ma-fx-body" data-part="splash" d=""/><path class="ma-fx-core" d=""/>${Array.from({ length: diamonds }, () => `<path class="ma-fx-diamond" d=""/>`).join("")}</g>`;
  const fan = (data, index) => `<g class="iso-solid f9-hinged" data-dyn="${data}" data-index="${index}"><path class="iso-fill" d=""/><path class="iso-shade" data-shade="1" d=""/><path class="iso-line iso-edge" data-tone="hi" d=""/></g>`;

  // SLC-40 as photographed in 2024 (layout.mjs, facts photo-*): the concrete apron, the flame
  // trench and deflector, the erector's rails, the access tower with its arm swung away and its slide, the
  // launch mount with hydraulic clamps, the erector (a dynamic slot: it tilts back before liftoff), the two
  // pairs of lightning towers with masts, wires and guys, the flame's glow and the exhaust cloud. Items are
  // put back to front so the paint order is the depth order.
  function launchPad() {
    const S = SIZES.pad;
    put("scene", "launch pad apron, flame trench and erector rails", carried("pad", padGround(S)));
    put("scene", "access tower with its swing arm and escape slide", carried("pad", crewTower(S.crewTower, S.z1)));
    const backTowers = S.towers.places.filter(([, depth]) => depth < 0).map(([across, depth]) => lightningTower(across, depth)).join("");
    put("scene", "lightning towers, back pair", carried("pad", backTowers));
    put("scene", "launch mount and hydraulic hold-down clamps", carried("pad", launchMount(S)));
    put("scene", "transporter-erector with the arms that hold the stack", carried("pad", fan("erector", 0) + `<path class="f9-lattice" data-dyn="erector-lattice" d=""/><path class="f9-arm" data-dyn="erector-arms" d=""/>`));
    const frontTowers = S.towers.places.filter(([, depth]) => depth >= 0).map(([across, depth]) => lightningTower(across, depth)).join("");
    put("scene", "lightning towers, front pair, overhead wires and guys", carried("pad", frontTowers + towerWires(S)));
    let smoke = "";
    for (let index = 0; index < 16; index++) smoke += `<circle class="ma-fx-smoke" data-dyn="smoke" data-index="${index}" cx="0" cy="0" r="0" opacity="0"/>`;
    put("scene", "exhaust cloud", carried("pad", `<g filter="url(#f9-soft)">${smoke}</g>`));
  }

  function flat(corners, className) {
    return `<path class="${className}" d="${trace(corners, true)}"/>`;
  }

  // The apron, the trench opening toward the front left (away from the erector) with its
  // deflector, the erector's two rails and the flame's glow on the apron.
  function padGround(S) {
    const apron = box(-S.half, S.half, -S.half, S.half, S.z0, S.z1, { tone: "lo", bevel: 0.3, r: 1 });
    const T = S.trench;
    const trench = flat([[-T.half, T.start, S.z1], [T.half, T.start, S.z1], [T.half, T.end, S.z1], [-T.half, T.end, S.z1]], "f9-trench");
    const wall = Ln(trace([[T.half, T.start, S.z1], [T.half, T.start, T.floor * 0.4], [T.half, T.end, T.floor * 0.4]]), { tone: "lo" });
    const deflector = flat([[-T.half + 0.3, 1.2, S.z1], [T.half - 0.3, 1.2, S.z1], [T.half - 0.3, 7.5, S.z1 - 2.4], [-T.half + 0.3, 7.5, S.z1 - 2.4]], "f9-deflector");
    const E = S.erector;
    let rails = "";
    for (const depth of [-1.2, 1.2]) {
      const [x0, y0] = Layout.site(E.across + 1, depth);
      const [x1, y1] = Layout.site(E.across + E.rails, depth);
      rails += trace([[x0, y0, S.z1], [x1, y1, S.z1]]);
    }
    const glow = `<ellipse class="ma-fx-glow" data-dyn="pad-glow" cx="${at(0, 0, S.z1)[0].toFixed(1)}" cy="${at(0, 0, S.z1)[1].toFixed(1)}" rx="0" ry="0" opacity="0"/>`;
    const [stopX, stopY] = Layout.site(E.across + E.rails, 0);
    const buffer = box(stopX - 1.2, stopX + 1.2, stopY - 1.2, stopY + 1.2, S.z1, S.z1 + 0.8, { tone: "mid", r: 0.05 });
    return apron + trench + wall + deflector + Ln(rails, { tone: "mid" }) + buffer + glow;
  }

  // The access tower as open steel: four corner columns, a platform every few floors, X bracing on the
  // two faces that show, the swing arm and white room (swung away: no crew on this flight) and the slide.
  function crewTower(C, foot) {
    const [cx, cy] = Layout.site(C.across, C.depth);
    const half = C.half;
    const A = C.arm;
    const roomX = cx - half - A.reach;
    const arm = box(roomX, cx - half, cy - A.half, cy + A.half, A.z0, A.z1, { tone: "lo", r: 0.1 });
    const room = box(roomX - 2 * C.room.half, roomX, cy - C.room.half, cy + C.room.half, C.room.z0, C.room.z1, { tone: "hi", r: 0.15, bevel: 0.1 });
    const column = (sideX, sideY) => box(cx + sideX * half - C.column, cx + sideX * half + C.column, cy + sideY * half - C.column, cy + sideY * half + C.column, foot, C.top, { tone: "lo", r: 0.02 });
    let platforms = "";
    for (let z = foot + C.floor; z <= C.top; z += C.floor) platforms += box(cx - half, cx + half, cy - half, cy + half, z - 0.35, z, { tone: "mid", r: 0.02 });
    let bracing = "";
    for (let z = foot; z < C.top - 1; z += C.floor / 2) {
      const high = Math.min(C.top, z + C.floor / 2);
      bracing += trace([[cx + half, cy - half, z], [cx + half, cy + half, high]]) + trace([[cx + half, cy + half, z], [cx + half, cy - half, high]]);
      bracing += trace([[cx + half, cy + half, z], [cx - half, cy + half, high]]) + trace([[cx - half, cy + half, z], [cx + half, cy + half, high]]);
    }
    const back = `<g class="f9-dark">${column(-1, -1)}${column(1, -1)}${column(-1, 1)}</g>`;
    const front = `<g class="f9-dark">${platforms}${column(1, 1)}</g>`;
    const slide = [];
    for (let index = 0; index <= 12; index++) {
      const share = index / 12;
      slide.push([cx - half * 0.4, cy + half + C.slide.out * share, C.slide.from + (foot - C.slide.from) * Math.sqrt(share)]);
    }
    const chute = trace(slide) + trace(slide.map(([x, y, z]) => [x - 1.2, y, z]));
    const [endX, endY] = slide[slide.length - 1];
    const landing = box(endX - 2, endX + 0.8, endY - 0.4, endY + 2, foot, foot + 0.5, { tone: "mid", r: 0.05 });
    const exit = box(cx - half * 0.4 - 1.8, cx - half * 0.4 + 0.6, cy + half, cy + half + 1.2, C.slide.from - 0.4, C.slide.from + 0.4, { tone: "mid", r: 0.05 });
    return arm + room + back + Ln(bracing, { tone: "lo" }) + front + Ln(chute, { tone: "lo" }) + landing + exit;
  }

  // The launch mount: a frame round the flame hole and the four hydraulic hold-down clamps.
  function launchMount(S) {
    const M = S.mountHalf;
    let mount = box(-M - 1, M + 1, -M - 1, -M, S.z1, S.mountTop, { tone: "mid", r: 0.2 }) + box(-M - 1, -M, -M, M + 1, S.z1, S.mountTop, { tone: "mid", r: 0.2 });
    mount += box(-M - 1, M + 1, M, M + 1, S.z1, S.mountTop, { tone: "mid", r: 0.2 }) + box(M, M + 1, -M, M, S.z1, S.mountTop, { tone: "mid", r: 0.2 });
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = (x * (R + 0.6)) / Math.SQRT2;
      const cy = (y * (R + 0.6)) / Math.SQRT2;
      mount += post(cx, cy, S.clamp, S.mountTop, S.clampTop, { tone: "hi", steps: 12 });
    }
    return mount + `<path class="f9-arm" data-dyn="clamp-jaws" d=""/>`;
  }

  // One lightning tower: four legs tapering up, X bracing on the two faces that show, a small top deck and
  // the white mast.
  function lightningTower(across, depth) {
    const W = SIZES.pad.towers;
    const foot = SIZES.pad.z1;
    const [cx, cy] = Layout.site(across, depth);
    const halfAt = (z) => W.base + (W.waist - W.base) * ((z - foot) / (W.top - foot));
    const corner = (sideX, sideY, z) => [cx + sideX * halfAt(z), cy + sideY * halfAt(z), z];
    let legs = "";
    for (const [sideX, sideY] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) legs += trace([corner(sideX, sideY, foot), corner(sideX, sideY, W.top)]);
    let bracing = "";
    const panel = (W.top - foot) / 10;
    for (let index = 0; index < 10; index++) {
      const low = foot + index * panel;
      const high = low + panel;
      bracing += trace([corner(1, -1, low), corner(1, 1, high)]) + trace([corner(1, 1, low), corner(1, -1, high)]);
      bracing += trace([corner(1, 1, low), corner(-1, 1, high)]) + trace([corner(-1, 1, low), corner(1, 1, high)]);
      bracing += trace([corner(1, -1, high), corner(1, 1, high), corner(-1, 1, high)]);
    }
    const deck = box(cx - W.waist - 0.4, cx + W.waist + 0.4, cy - W.waist - 0.4, cy + W.waist + 0.4, W.top, W.top + 0.6, { tone: "mid", r: 0.05 });
    const mast = post(cx, cy, W.mast, W.top + 0.6, W.mastTop, { tone: "hi", steps: 10 });
    return Ln(legs, { tone: "mid" }) + Ln(bracing, { tone: "lo" }) + deck + mast;
  }

  // Wires between the mast tops, sagging over the rocket, and guys from each mast top out to the ground.
  function towerWires(S) {
    const W = S.towers;
    const top = (across, depth) => [...Layout.site(across, depth), W.mastTop];
    const sag = (from, to, drop) => {
      const points = [];
      for (let index = 0; index <= 20; index++) {
        const share = index / 20;
        const point = [0, 1, 2].map((axis) => from[axis] + (to[axis] - from[axis]) * share);
        point[2] -= drop * Math.sin(share * Math.PI);
        points.push(point);
      }
      return trace(points);
    };
    let wires = "";
    let anchors = "";
    const [backLeft, backRight, frontLeft, frontRight] = W.places;
    wires += sag(top(...backLeft), top(...backRight), 14) + sag(top(...frontLeft), top(...frontRight), 14);
    wires += sag(top(...backLeft), top(...frontLeft), 1.5) + sag(top(...backRight), top(...frontRight), 1.5);
    for (const [across, depth] of W.places) {
      const outward = Math.sign(across);
      const ground = [...Layout.site(across + outward * W.guyOut, depth * 1.6), S.z1];
      wires += trace([top(across, depth), ground]);
      anchors += box(ground[0] - 0.8, ground[0] + 0.8, ground[1] - 0.8, ground[1] + 0.8, S.z1, S.z1 + 0.7, { tone: "mid", r: 0.05 });
    }
    return Ln(wires, { tone: "lo" }) + anchors;
  }

  function droneship() {
    const H = SIZES.ship;
    const sea = `<path class="f9-sea" d="${trace([[-H.seaHalf, -H.seaHalf, H.sea], [H.seaHalf, -H.seaHalf, H.sea], [H.seaHalf, H.seaHalf, H.sea], [-H.seaHalf, H.seaHalf, H.sea]], true)}"/>`;
    const hull = box(-H.halfX, H.halfX, -H.halfY, H.halfY, H.hull, H.deck, { tone: "mid", bevel: 0.2, r: 0.6 });
    let pods = "";
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pods += box(x * H.halfX - 1.4, x * H.halfX + 1.4, y * (H.halfY + 1.2) - 1, y * (H.halfY + 1.2) + 1, H.hull - 0.2, H.hull + 1.6, { tone: "lo", r: 0.3 });
    const marks = Ln(circleOnTop(0, 0, H.mark, H.deck) + circleOnTop(0, 0, H.mark - 0.6, H.deck) + trace([[-H.mark * 0.6, -H.mark * 0.6, H.deck], [H.mark * 0.6, H.mark * 0.6, H.deck]]) + trace([[-H.mark * 0.6, H.mark * 0.6, H.deck], [H.mark * 0.6, -H.mark * 0.6, H.deck]]), { tone: "lo" });
    const walls = box(-H.halfX, H.halfX, -H.halfY, -H.halfY + 0.7, H.deck, H.deck + H.wall, { tone: "lo", r: 0.2 }) + box(-H.halfX, -H.halfX + 0.7, -H.halfY, H.halfY, H.deck, H.deck + H.wall, { tone: "lo", r: 0.2 });
    const glow = `<ellipse class="ma-fx-glow" data-dyn="deck-glow" cx="${at(0, 0, H.deck)[0].toFixed(1)}" cy="${at(0, 0, H.deck)[1].toFixed(1)}" rx="0" ry="0" opacity="0"/>`;
    put("scene", "droneship on the sea", carried("ship", sea + pods + hull + marks + glow + walls));
  }

  function engines() {
    const places = Layout.enginePlaces();
    const order = places.map((place, index) => ({ place, index })).sort((first, second) => first.place[0] + first.place[1] - (second.place[0] + second.place[1]));
    let markup = "";
    for (const { place } of order) markup += turned(Layout.bellProfile(), place[0], place[1], "lo");
    let plumes = flameSlot("cluster-plume", 0, 6);
    for (let index = 0; index < places.length; index++) plumes += flameSlot("plume", index);
    put("engines", "nine Merlin engines", carried("booster", plumes + `<g class="f9-nozzle">${markup}</g>`), [-R, R, -R, R, 0, SIZES.engines.top], true);
    const K = SIZES.skirt;
    // The octaweb: the dark engine section with its heat shield edge and the four leg hinge brackets.
    let hinges = "";
    for (const angle of SIZES.legs.angles) {
      const [x, y] = Layout.radial(angle, R + 0.2, SIZES.legs.hingeZ);
      hinges += box(x - 0.32, x + 0.32, y - 0.32, y + 0.32, SIZES.legs.hingeZ - 0.5, SIZES.legs.hingeZ + 0.4, { tone: "mid", r: 0.05, bevel: 0.04 });
    }
    // The dark tones live in custom properties so the zoom frame, a <use> clone of the scene, keeps them.
    const section = `<g class="f9-dark">${post(0, 0, R, K.z0, K.z1, { tone: "mid" })}${hinges}</g>`;
    put("engines", "octaweb engine section and leg hinges", carried("booster", section + seam(R, [K.z0 + 0.25, K.z0 + 0.9], "hi")), [-R - 0.6, R + 0.6, -R - 0.6, R + 0.6, K.z0, K.z1], true);
  }

  function firstStageTanks() {
    const T = SIZES.rp1;
    put("rp1", "RP-1 tank", carried("booster", post(0, 0, R, T.z0, T.z1, { tone: "hi" }) + seam(R, [T.z0 + 4.4, T.z0 + 8.8])), [-R, R, -R, R, T.z0, T.z1], true);
    const L = SIZES.lox;
    const welds = [];
    for (let z = L.z0 + 4; z < L.z1 - 1; z += 4) welds.push(z);
    put("lox", "LOX tank and common dome", carried("booster", post(0, 0, R, L.z0, L.z1, { tone: "hi" }) + seam(R, welds) + Ln(frontArc(0, 0, R, L.z0 + 0.25), { tone: "mid" })), [-R, R, -R, R, L.z0, L.z1], true);
  }

  function legs() {
    let markup = "";
    for (let index = 0; index < SIZES.legs.angles.length; index++) markup += fan("leg", index) + fan("leg-side", index) + `<path class="f9-strut" data-dyn="strut" data-index="${index}" d=""/>`;
    const L = SIZES.legs;
    put("legs", "four landing legs", carried("booster", markup), [-R - 0.7, R + 0.7, -R - 0.7, R + 0.7, L.hingeZ, L.hingeZ + L.length]);
  }

  function interstage() {
    const I = SIZES.interstage;
    const body = `<g class="f9-dark">${post(0, 0, R, I.z0, I.z1, { tone: "lo" })}</g>`;
    let fins = "";
    for (let index = 0; index < SIZES.fins.angles.length; index++) fins += fan("fin", index);
    const T = SIZES.thrusters;
    let pods = "";
    let puffs = "";
    for (const angle of T.angles) {
      const [x, y] = Layout.radial(angle, R, T.z);
      pods += box(x - T.size, x + T.size, y - T.size, y + T.size, T.z - T.size, T.z + T.size, { tone: "mid", r: 0.1, bevel: 0.05 });
      const [px, py] = Layout.radial(angle, R + 1.6, T.z);
      puffs += `<g class="f9-puff" data-dyn="puff">${D([at(px, py, T.z), at((x + px) / 2, (y + py) / 2, T.z + 0.4), at((x + px) / 2, (y + py) / 2, T.z - 0.4), at(px * 1.1, py * 1.1, T.z + 0.8), at(px * 1.1, py * 1.1, T.z - 0.8)], { size: 0.5, tone: "lo" })}</g>`;
    }
    put("interstage", "interstage with grid fins and nitrogen thrusters", carried("booster", body + fins + pods + puffs), [-R - 0.5, R + 0.5, -R - 0.5, R + 0.5, I.z0, I.z1], true);
  }

  function secondStage() {
    const M = SIZES.mvac;
    const plume = flameSlot("vacuum-plume", 0);
    put("mvac", "Merlin Vacuum engine", carried("upper", plume + `<g class="f9-metal">${turned(Layout.mvacProfile(), 0, 0, "mid")}</g>`), [-M.exit, M.exit, -M.exit, M.exit, M.exitZ, M.top]);
    const U = SIZES.upper;
    const T = SIZES.thrusters;
    let pods = "";
    for (const angle of T.angles) {
      const [x, y] = Layout.radial(angle, R, U.z1 - 1.2);
      pods += box(x - 0.3, x + 0.3, y - 0.3, y + 0.3, U.z1 - 1.5, U.z1 - 0.9, { tone: "mid", r: 0.08, bevel: 0.04 });
    }
    put("upper", "second stage tanks", carried("upper", post(0, 0, R, U.z0, U.z1, { tone: "hi" }) + seam(R, [U.z0 + 3.2, U.z0 + 6.4]) + pods), [-R, R, -R, R, U.z0, U.z1], true);
  }

  function payload() {
    const A = SIZES.payload;
    const adapter = turned([[0, 1.75], [A.z0 - A.adapter, 0.8]].map(([s, r]) => [A.adapter + s, r]), 0, 0, "mid");
    const body = box(-A.half, A.half, -A.half, A.half, A.z0, A.z1, { tone: "mid", bevel: 0.1, r: 0.15 });
    const panel = Ln(trace([[A.half + 0.02, -A.half + 0.3, A.z0 + 0.6], [A.half + 0.02, -A.half + 0.3, A.z1 - 0.6]]) + trace([[A.half + 0.02, 0, A.z0 + 0.6], [A.half + 0.02, 0, A.z1 - 0.6]]) + trace([[A.half + 0.02, A.half - 0.3, A.z0 + 0.6], [A.half + 0.02, A.half - 0.3, A.z1 - 0.6]]), { tone: "lo" });
    put("payload", "payload on its adapter", carried("upper", adapter + body + panel), [-A.half, A.half, -A.half, A.half, A.adapter, A.z1], true);
  }

  // The fairing is one turned shell cut along its seam into the half nearer the left of the screen and
  // the half nearer the right; each half is the whole shell clipped to its side.
  function fairing() {
    const F = SIZES.fairing;
    const shell = turned(Layout.fairingProfile(), 0, 0, "hi");
    const seamLine = Ln(trace([[0, 0, F.z0], [0, 0, F.tip]]), { tone: "lo" });
    const centre = at(0, 0, F.z0)[0];
    for (const [name, side] of [["fairingLeft", -1], ["fairingRight", 1]]) {
      const clip = `f9-clip-${name}`;
      const bounds = side < 0 ? [-F.radius, 0, 0, F.radius, F.z0, F.tip] : [0, F.radius, -F.radius, 0, F.z0, F.tip];
      put(name, side < 0 ? "fairing half, left" : "fairing half, right", carried(name, `<g clip-path="url(#${clip})">${shell}</g>` + seamLine), bounds);
    }
    return { centre };
  }

  launchPad();
  droneship();
  engines();
  legs();
  firstStageTanks();
  interstage();
  secondStage();
  payload();
  const cut = fairing();

  const top = at(0, 0, SIZES.fairing.tip + 2)[1];
  const bottom = at(0, 0, SIZES.fairing.z0 - 2)[1];
  const clipRect = (left) => `<rect x="${(left ? cut.centre - 400 : cut.centre).toFixed(1)}" y="${(top - 200).toFixed(1)}" width="400" height="${(bottom - top + 400).toFixed(1)}"/>`;
  const defs = `<defs><clipPath id="f9-clip-fairingLeft" clipPathUnits="userSpaceOnUse">${clipRect(true)}</clipPath><clipPath id="f9-clip-fairingRight" clipPathUnits="userSpaceOnUse">${clipRect(false)}</clipPath><filter id="f9-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><filter id="f9-flame-soft" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="f9-halo-soft" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="5"/></filter><filter id="f9-diamond-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.6"/></filter></defs>`;
  const Z = SIZES.zoom;
  const I = SIZES.interstage;
  return {
    label: {
      text: "SpaceX Falcon 9 drawn as an isometric figure. From the bottom up: nine Merlin engines, eight round a centre one, under the engine section; four landing legs folded against the first stage; the RP-1 kerosene tank and above it the liquid oxygen tank; the dark interstage with four grid fins at its base and nitrogen thrusters; the second stage with its single Merlin Vacuum engine and long nozzle; the payload inside the two halves of the fairing. It stands on its launch pad, SLC-40: the launch mount with its hold-down clamps over the flame trench, the transporter-erector beside it that tilts back before launch, the square access tower with its swing arm and escape slide, and four lattice lightning towers in two pairs with masts joined by overhead wires. The film flies it from the pad, takes it apart in slow motion during the climb, then shows stage separation, the booster turning round, its burns, and its landing on a droneship while the second stage flies on. A magnified frame shows the engines.",
      facts: ["spacex-dimensions", "guide-nine-engines", "guide-engine-layout", "spacex-first-stage", "guide-common-dome", "spacex-interstage", "spacex-grid-fins", "guide-nitrogen-thrusters", "spacex-second-stage", "spacex-fairing", "guide-fins-legs", "asds-barge", "guide-slc40", "guide-lightning-wires", "guide-strongback", "guide-clamps", "wiki-slc40-crew-tower", "wiki-slc40-slide"],
    },
    defs,
    css: CSS,
    anchors: {
      fairingLeft: [-4.6, 4.6, 66],
      fairingRight: [4.6, -4.6, 66],
      payload: [-2.4, 2.4, 63],
      upper: [-2.6, 2.6, 53],
      mvac: [-2.4, 2.4, 45],
      interstage: [-3.4, 3.4, (I.z0 + I.z1) / 2],
      lox: [-2.6, 2.6, 30],
      rp1: [-2.8, 2.8, 14.8],
      legs: [2.8, -2.8, 8],
      engines: [-2.8, 2.8, 0.6],
      scene: [0, 0, 0],
    },
    stepPoints: [
      [-5.6, 5.6, 1],
      [-5.6, 5.6, 7.5],
      [-5.6, 5.6, 14],
      [-5.6, 5.6, 20.5],
    ],
    zoomCorners: [at(-Z.half, Z.half, Z.z0), at(Z.half, -Z.half, Z.z0), at(-Z.half, Z.half, Z.z1), at(Z.half, -Z.half, Z.z1)],
  };
}

const CSS = `
.iso[data-theme]{--f9-dark-0:var(--anatomy-shade-0);--f9-dark-1:var(--anatomy-shade-1);--f9-dark-2:var(--anatomy-shade-2);--f9-dark-3:var(--anatomy-shade-3);--f9-dark-top:var(--anatomy-top);--f9-nozzle-0:var(--anatomy-shade-0);--f9-nozzle-1:var(--anatomy-shade-1);--f9-nozzle-2:var(--anatomy-shade-2);--f9-nozzle-3:var(--anatomy-shade-3);--f9-nozzle-top:var(--anatomy-top);--f9-metal-0:var(--anatomy-shade-0);--f9-metal-1:var(--anatomy-shade-1);--f9-metal-2:var(--anatomy-shade-2);--f9-metal-3:var(--anatomy-shade-3);--f9-metal-top:var(--anatomy-top)}
.iso[data-theme="light"]{--f9-dark-0:#3b3b40;--f9-dark-1:#46464c;--f9-dark-2:#535359;--f9-dark-3:#606067;--f9-dark-top:#6e6e75;--f9-nozzle-0:#26262a;--f9-nozzle-1:#323237;--f9-nozzle-2:#424248;--f9-nozzle-3:#57575e;--f9-nozzle-top:#6c6c74;--f9-metal-0:#b9b3a8;--f9-metal-1:#c7c1b6;--f9-metal-2:#d3cec4;--f9-metal-3:#dedad1;--f9-metal-top:#e8e4dc}
.f9-dark{--anatomy-shade-0:var(--f9-dark-0);--anatomy-shade-1:var(--f9-dark-1);--anatomy-shade-2:var(--f9-dark-2);--anatomy-shade-3:var(--f9-dark-3);--anatomy-top:var(--f9-dark-top)}
.f9-nozzle{--anatomy-shade-0:var(--f9-nozzle-0);--anatomy-shade-1:var(--f9-nozzle-1);--anatomy-shade-2:var(--f9-nozzle-2);--anatomy-shade-3:var(--f9-nozzle-3);--anatomy-top:var(--f9-nozzle-top)}
.f9-metal{--anatomy-shade-0:var(--f9-metal-0);--anatomy-shade-1:var(--f9-metal-1);--anatomy-shade-2:var(--f9-metal-2);--anatomy-shade-3:var(--f9-metal-3);--anatomy-top:var(--f9-metal-top)}
.f9-flame{pointer-events:none}.f9-flame .ma-fx-body{filter:url(#f9-flame-soft)}.f9-flame .ma-fx-halo{filter:url(#f9-halo-soft)}.f9-flame .ma-fx-diamond{filter:url(#f9-diamond-soft)}
.f9-trench{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}.f9-deflector{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.f9-lattice{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*.7)}.f9-arm{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*2.4);stroke-linecap:square;stroke-linejoin:round}.f9-strut{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*2.2);stroke-linecap:round}
.f9-puff{--glow:0;opacity:var(--glow)}
.f9-sea{fill:#dfe6ea;stroke:none}
.f9-hinged .iso-fill{fill:var(--anatomy-shade-2)}
`;
