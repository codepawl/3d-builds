// Live behaviour of the Jacquard loom figure. The build inlines this file after the kit and the pure model,
// inside one block, with CONFIG (projection, layout, mechanism) and Loom (the model) already defined.
// From the kit it uses iso, pathOf, translateAlong, coil and cameraOf.

const P = CONFIG.projection;
const L = CONFIG.layout;
const MECHANISM = CONFIG.mechanism;
const LANES = L.lanes;
const T = Loom.TIMELINE;
const STILL_PHASE = 0.78;
const PICK_SECONDS = 6.5;
const RESUME_AFTER = 3600;

const stage = document.querySelector(".iso-stage");
const figure = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const motifButtons = Array.from(document.querySelectorAll("[data-motif]"));
const stepButton = document.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";

const laneIndexes = Array.from({ length: LANES }, (_, lane) => lane);
const hookY = (lane) => (lane - (LANES - 1) / 2) * L.hookPitch;
const warpY = (lane) => (lane - (LANES - 1) / 2) * L.warpPitch;

function one(name) {
  const found = figure.querySelector(`[data-dyn="${name}"]`);
  if (!found) console.error("missing part", name);
  return found;
}

function perLane(name) {
  return laneIndexes.map((lane) => {
    const found = figure.querySelector(`[data-dyn="${name}"][data-lane="${lane}"]`);
    if (!found) console.error("missing part", name, lane);
    return found;
  });
}

const parts = {
  threadRear: perLane("thread-rear"),
  threadFrontLow: perLane("thread-front-low"),
  threadFrontHigh: perLane("thread-front-high"),
  harnessLow: perLane("harness-low"),
  lingoe: perLane("lingoe"),
  harnessHigh: perLane("harness-high"),
  knot: perLane("knot"),
  hookLow: perLane("hook-low"),
  hookMid: perLane("hook-mid"),
  hookDouble: perLane("hook-double"),
  hookTop: perLane("hook-top"),
  needleHead: perLane("needle-head"),
  needleBody: perLane("needle-body"),
  needleSpring: perLane("needle-spring"),
  collar: perLane("collar"),
  needleTail: perLane("needle-tail"),
  slotsBack: Array.from(figure.querySelectorAll('[data-dyn="chain-back"]')),
  slotsFront: Array.from(figure.querySelectorAll('[data-dyn="chain-front"]')),
  cylinder: one("cylinder"),
  neck: perLane("neck"),
  cordEnd: perLane("cord-end"),
  fellEnd: perLane("fell-end"),
  hits: Array.from(figure.querySelectorAll('[data-dyn="hit"]')),
  cardLit: one("card-lit"),
  armFar: one("arm-far"),
  armNear: one("arm-near"),
  battenBack: one("batten-back"),
  battenFront: one("batten-front"),
  shuttle: one("shuttle"),
  weft: one("weft"),
  clothTop: one("cloth-top"),
  clothDrop: one("cloth-drop"),
  clothInk: one("cloth-ink"),
  clothNew: one("cloth-new"),
  clothRows: one("cloth-rows"),
  clothEdge: one("cloth-edge"),
  griffeBack: one("griffe-back"),
  griffeFront: one("griffe-front"),
  griffeRod: one("griffe-rod"),
  lever: one("lever"),
  leverCord: one("lever-cord"),
  treadle: one("treadle"),
};

const written = new WeakMap();

function write(element, name, value) {
  let seen = written.get(element);
  if (!seen) {
    seen = {};
    written.set(element, seen);
  }
  if (seen[name] === value) return;
  seen[name] = value;
  if (value === null) element.removeAttribute(name);
  else if (name === "glow") element.style.setProperty("--glow", value);
  else if (name === "html") element.innerHTML = value;
  else element.setAttribute(name, value);
}

function setGlow(element, value) {
  write(element, "glow", String(Math.round(value * 100) / 100));
}

const camera = cameraOf(P);
const VIEW = [camera.cosA * camera.cosE, camera.sinE];
const flat = (x, y, z) => iso([x, y, z], P);
const trace = (points, closed = false) => pathOf(points.map((point) => iso(point, P)), closed);
const depthKey = (x, z) => x * VIEW[0] + z * VIEW[1];

function faceClass(normalX, normalZ) {
  if (normalZ > 0.75) return 'class="iso-top"';
  const lit = (1 - normalX * camera.sinA) / 2 + Math.max(0, normalZ) * 0.3;
  const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)));
  return `class="iso-shade" data-shade="${shade}"`;
}

// ---- state ---------------------------------------------------------------------------------------------

const loom = Loom.createLoom(Loom.MOTIF_NAMES.includes(query.get("motif")) ? query.get("motif") : "diamond");
const clock = {
  phase: 1,
  rate: 0,
  latched: null,
  woven: true,
  direction: 1,
  stepping: false,
  touring: false,
  held: false,
  visible: manual,
  frame: 0,
  last: 0,
  pickSeconds: PICK_SECONDS,
  resumeTimer: 0,
  elapsed: 0,
};

function startPick() {
  Loom.presentNext(loom);
  clock.phase = 0;
  clock.latched = null;
  clock.woven = false;
  clock.direction = loom.picks % 2 === 0 ? 1 : -1;
}

function settleEvents() {
  if (!clock.latched && clock.phase >= T.latch) clock.latched = Loom.readHooks(loom.chain[loom.cardIndex], MECHANISM);
  if (!clock.woven && clock.phase >= T.weave) {
    Loom.weaveRow(loom, clock.latched);
    clock.woven = true;
    announce();
  }
}

// Plays `seconds` of the loom's clock. No pick starts while the loom is apart or about to come apart,
// and every stretch of a pick reports its sound cues with the clock time at which they fall.
function advance(seconds) {
  let left = seconds / clock.pickSeconds;
  let at = clock.elapsed;
  while (left > 1e-9) {
    if (clock.phase >= 1) {
      if (apartBusy() || (!clock.stepping && !wantsTour())) break;
      startPick();
    }
    const from = clock.phase;
    const step = Math.min(left, 1 - clock.phase);
    clock.phase += step;
    left -= step;
    if (clock.phase > 1 - 1e-9) clock.phase = 1;
    soundEvents(from, clock.phase, at);
    at += step * clock.pickSeconds;
    settleEvents();
    if (clock.phase >= 1 && clock.stepping) {
      clock.stepping = false;
      if (!wantsTour()) break;
    }
  }
  clock.elapsed += seconds;
}

// Reduced motion: no travel, one still pose per pick, with the shed open and the new row just beaten in.
function jumpOnePick() {
  if (clock.phase < 1) {
    clock.phase = 1;
    settleEvents();
  }
  startPick();
  clock.phase = STILL_PHASE;
  settleEvents();
}

function wantsTour() {
  return clock.touring && !clock.held && !still.matches && !apartBusy();
}

// ---- drawing -------------------------------------------------------------------------------------------

function cylinderCentre(swing) {
  const reach = L.swing.out * swing;
  return [CONFIG.pressedCentre[0] - reach, L.swing.pivotZ + Math.sqrt(L.swing.arm ** 2 - reach ** 2)];
}

function holeQuad(middle, along, y, sizeAlong, sizeAcross) {
  const ax = along[0] * sizeAlong;
  const az = along[1] * sizeAlong;
  return trace(
    [
      [middle[0] - ax, y - sizeAcross, middle[1] - az],
      [middle[0] + ax, y - sizeAcross, middle[1] + az],
      [middle[0] + ax, y + sizeAcross, middle[1] + az],
      [middle[0] - ax, y + sizeAcross, middle[1] - az],
    ],
    true,
  );
}

function cardFrame(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const span = Math.hypot(dx, dz) || 1;
  const along = [dx / span, dz / span];
  const inset = L.card.gap / 2;
  const start = [a[0] + along[0] * inset, a[1] + along[1] * inset];
  const end = [b[0] - along[0] * inset, b[1] - along[1] * inset];
  const middle = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  let normal = [-along[1], along[0]];
  if (normal[0] * VIEW[0] + normal[1] * VIEW[1] < 0) normal = [-normal[0], -normal[1]];
  return { along, start, end, middle, normal };
}

function cardMarkup(frame, row) {
  const half = L.card.length / 2;
  const outline = trace(
    [
      [frame.start[0], -half, frame.start[1]],
      [frame.end[0], -half, frame.end[1]],
      [frame.end[0], half, frame.end[1]],
      [frame.start[0], half, frame.start[1]],
    ],
    true,
  );
  let holes = "";
  let blanks = "";
  for (const lane of laneIndexes) {
    if (row[lane]) holes += holeQuad(frame.middle, frame.along, hookY(lane), L.card.hole, L.card.hole);
    else blanks += holeQuad(frame.middle, frame.along, hookY(lane), 0.4, 0.4);
  }
  let laces = "";
  const edge = L.card.half - L.card.gap / 2 - 1.5;
  for (const y of [-half + 2.4, 0, half - 2.4]) {
    for (const side of [-1, 1]) {
      const at = [frame.middle[0] + frame.along[0] * edge * side, frame.middle[1] + frame.along[1] * edge * side];
      laces += holeQuad(at, frame.along, y, 0.45, 0.45);
    }
  }
  return `<path ${faceClass(frame.normal[0], frame.normal[1])} d="${outline}"/><path class="jq-blank" d="${blanks}"/><path class="jq-lace" d="${laces}"/><path class="iso-line iso-edge" data-tone="hi" d="${outline}"/><path class="jq-hole" d="${holes}"/>`;
}

// The lacing that ties one card to the next: three cords across the gap, from edge to edge.
function lacingMarkup(frame, next) {
  const half = L.card.length / 2;
  let cords = "";
  for (const y of [-half + 2.4, 0, half - 2.4]) cords += trace([[frame.end[0], y, frame.end[1]], [next.start[0], y, next.start[1]]]);
  return `<path class="iso-line" data-tone="mid" d="${cords}"/>`;
}

function cylinderMarkup(centre, turn) {
  const radius = L.card.half * Math.SQRT2;
  const y0 = -L.card.length / 2 - 0.8;
  const y1 = L.card.length / 2 + 0.8;
  const corners = [0, 1, 2, 3].map((index) => {
    const angle = ((45 + 90 * index - 90 * turn) * Math.PI) / 180;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
  let faces = "";
  let edges = "";
  for (let index = 0; index < 4; index++) {
    const a = corners[index];
    const b = corners[(index + 1) % 4];
    const outward = [(a[0] + b[0]) / 2 - centre[0], (a[1] + b[1]) / 2 - centre[1]];
    const length = Math.hypot(outward[0], outward[1]);
    const normal = [outward[0] / length, outward[1] / length];
    if (normal[0] * VIEW[0] + normal[1] * VIEW[1] <= 0) continue;
    const d = trace([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], true);
    faces += `<path ${faceClass(normal[0], normal[1])} d="${d}"/>`;
    edges += d;
  }
  const cap = trace(corners.map((corner) => [corner[0], y1, corner[1]]), true);
  const axle = flat(centre[0], y1, centre[1]);
  return `${faces}<path class="iso-shade" data-shade="3" d="${cap}"/><path class="iso-line iso-edge" data-tone="mid" d="${edges}${cap}"/><g class="iso-dots" data-tone="hi"><circle cx="${axle[0].toFixed(1)}" cy="${axle[1].toFixed(1)}" r="1.3"/></g>`;
}

// A straight bar in the x-z plane between two points, `thick` deep, from y0 to y1: swing arms, lever, treadle.
function barMarkup(a, b, y0, y1, thick, tone) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const span = Math.hypot(dx, dz) || 1;
  let normal = [-dz / span, dx / span];
  if (normal[0] * VIEW[0] + normal[1] * VIEW[1] < 0) normal = [-normal[0], -normal[1]];
  const offset = [normal[0] * (thick / 2), normal[1] * (thick / 2)];
  const aFront = [a[0] + offset[0], a[1] + offset[1]];
  const bFront = [b[0] + offset[0], b[1] + offset[1]];
  const aBack = [a[0] - offset[0], a[1] - offset[1]];
  const bBack = [b[0] - offset[0], b[1] - offset[1]];
  const side = trace([[aFront[0], y1, aFront[1]], [bFront[0], y1, bFront[1]], [bBack[0], y1, bBack[1]], [aBack[0], y1, aBack[1]]], true);
  const face = trace([[aFront[0], y0, aFront[1]], [bFront[0], y0, bFront[1]], [bFront[0], y1, bFront[1]], [aFront[0], y1, aFront[1]]], true);
  const nearEnd = a[0] > b[0] ? [aFront, aBack] : [bFront, bBack];
  const end = trace([[nearEnd[0][0], y0, nearEnd[0][1]], [nearEnd[0][0], y1, nearEnd[0][1]], [nearEnd[1][0], y1, nearEnd[1][1]], [nearEnd[1][0], y0, nearEnd[1][1]]], true);
  return `<path class="iso-shade" data-shade="0" d="${end}"/><path ${faceClass(normal[0], normal[1])} d="${face}"/><path class="iso-shade" data-shade="3" d="${side}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${end}${face}${side}"/>`;
}

function drawChain(pose, centre, reading, glow) {
  const hinges = Loom.chainHinges(pose.turn, centre, CONFIG.chainShape);
  const frames = hinges.map((hinge, index) => cardFrame(hinge, hinges[(index + 1) % Loom.CARDS]));
  const items = frames.map((frame, index) => {
    const row = loom.chain[(loom.cardIndex - index + Loom.CARDS * 2) % Loom.CARDS];
    const next = frames[(index + 1) % Loom.CARDS];
    return { key: depthKey(frame.middle[0], frame.middle[1]), html: cardMarkup(frame, row) + lacingMarkup(frame, next) };
  });
  const cylinderKey = depthKey(centre[0], centre[1]) - 0.5;
  items.sort((a, b) => a.key - b.key);
  const behind = items.filter((item) => item.key < cylinderKey);
  const over = items.filter((item) => item.key >= cylinderKey);
  parts.slotsBack.forEach((slot, index) => write(slot, "html", index < behind.length ? behind[index].html : ""));
  parts.slotsFront.forEach((slot, index) => write(slot, "html", index < over.length ? over[index].html : ""));
  write(parts.cylinder, "html", cylinderMarkup(centre, pose.turn));

  const targets = [
    { frame: frames[0], card: loom.cardIndex },
    { frame: frames[Loom.CARDS - 1], card: (loom.cardIndex + 1) % Loom.CARDS },
  ];
  targets.forEach((target, which) => {
    for (const lane of laneIndexes) {
      const hit = parts.hits[which * LANES + lane];
      write(hit, "d", holeQuad(target.frame.middle, target.frame.along, hookY(lane), L.card.half - 1.2, L.hookPitch / 2));
      write(hit, "data-card", String(target.card));
      const punched = loom.chain[target.card][lane];
      write(hit, "aria-label", `Card ${target.card + 1}, position ${lane + 1}: ${punched ? "hole, press to patch" : "blank, press to punch"}`);
    }
  });

  let rings = "";
  for (const lane of laneIndexes) {
    if (reading[lane]) rings += holeQuad(frames[0].middle, frames[0].along, hookY(lane), L.card.hole, L.card.hole);
  }
  write(parts.cardLit, "d", rings);
  setGlow(parts.cardLit, glow.card);

  const pivot = [CONFIG.pressedCentre[0], L.swing.pivotZ];
  write(parts.armFar, "html", barMarkup(pivot, centre, -L.swing.armY - 1.2, -L.swing.armY + 1.2, 2.6, "mid"));
  write(parts.armNear, "html", barMarkup(pivot, centre, L.swing.armY - 1.2, L.swing.armY + 1.2, 2.6, "mid"));
}

function drawNeedle(lane, shift, faceX) {
  const y = hookY(lane);
  const N = L.needle;
  const z = N.z;
  const head = Math.max(N.headX + shift, faceX);
  write(parts.needleHead[lane], "d", head < N.boardBack ? trace([[head, y, z], [N.boardBack, y, z]]) : "");
  const loopX = L.hook.x + shift;
  const loop = [];
  for (let step = 0; step < 12; step++) {
    const angle = (step / 12) * Math.PI * 2;
    loop.push([loopX + Math.cos(angle) * N.loopR, y, z + Math.sin(angle) * N.loopR]);
  }
  const body = trace([[N.boardFront, y, z], [loopX - N.loopR, y, z]]) + trace(loop, true) + trace([[loopX + N.loopR, y, z], [N.plateFront, y, z]]);
  write(parts.needleBody[lane], "d", body);
  const spring = coil(N.collarX + shift, N.plateBack + 1, [y, z], 1.3, 4, "x", P);
  write(parts.needleSpring[lane], "d", trace([[N.plateFrontEnd, y, z], [N.plateBack + 1, y, z]]) + spring.back + spring.front);
  const collar = flat(N.collarX + shift, y, z);
  write(parts.collar[lane], "cx", collar[0].toFixed(1));
  write(parts.collar[lane], "cy", collar[1].toFixed(1));
  write(parts.needleTail[lane], "d", trace([[N.plateBackEnd, y, z], [N.tailX + shift, y, z]]));
}

function drawHook(lane, lean, lift) {
  const y = hookY(lane);
  const H = L.hook;
  const leanAt = (worldZ) => (lean * (worldZ - lift - H.foot)) / (H.top - H.foot);
  const main = (worldZ) => [H.x + leanAt(worldZ), y, worldZ];
  const doubled = (worldZ) => [H.x + H.doubled + leanAt(worldZ), y, worldZ];
  const foot = H.foot + lift;
  const neck = trace([[L.neckX, y, L.bottomBoard.z1], [L.neckX, y, foot]]);
  write(parts.hookLow[lane], "d", neck + trace([main(L.grate.z1), main(foot), doubled(foot), doubled(L.grate.z1 - 0.4)]));
  write(parts.hookMid[lane], "d", trace([main(L.grate.z1), main(H.loop)]));
  const tip = H.doubledTop + lift;
  write(parts.hookDouble[lane], "d", trace([doubled(L.grate.z1 - 0.4), doubled(Math.max(tip, L.grate.z1 - 0.2))]));
  const top = H.top + lift;
  const crown = main(top);
  write(parts.hookTop[lane], "d", trace([main(H.loop), crown, [crown[0] - H.beak, y, top], [crown[0] - H.beak, y, top - H.beakDrop]]));
}

function drawHarness(lane, lift) {
  const yHook = hookY(lane);
  const yWarp = warpY(lane);
  const x = L.hook.x;
  const eye = L.warpZ + lift;
  const ring = [];
  for (let step = 0; step < 10; step++) {
    const angle = (step / 10) * Math.PI * 2;
    ring.push([x, yWarp + Math.cos(angle) * L.mail.halfWidth, eye + Math.sin(angle) * L.mail.halfHeight]);
  }
  const lower = trace([[x, yWarp, L.lingoe.top - 1 + lift], [x, yWarp, eye - L.mail.halfHeight]]);
  const upper = trace([[x, yWarp, eye + L.mail.halfHeight], [x, yWarp, L.comber.z0 + 1.5]]);
  write(parts.harnessLow[lane], "d", lower + trace(ring, true) + upper);
  write(parts.lingoe[lane], "transform", translateAlong(P, [0, 0, lift]));
  const knotZ = L.knotZ + lift;
  write(parts.harnessHigh[lane], "d", trace([[x, yWarp, L.comber.z1], [L.neckX, yHook, knotZ]]));
  write(parts.neck[lane], "d", trace([[L.neckX, yHook, knotZ], [L.neckX, yHook, L.bottomBoard.z0 + 1.5]]));
  const knot = flat(L.neckX, yHook, knotZ);
  for (const dot of [parts.knot[lane], parts.cordEnd[lane]]) {
    write(dot, "cx", knot[0].toFixed(1));
    write(dot, "cy", knot[1].toFixed(1));
  }
}

function drawThread(lane, lift, reedX, fellX) {
  const y = warpY(lane);
  const eyeZ = L.warpZ + lift;
  const reedZ = L.warpZ + (lift * (fellX - reedX)) / (fellX - L.hook.x);
  const rear = CONFIG.beamArcs[lane].concat([[L.hook.x, y, eyeZ], [reedX, y, reedZ]]);
  write(parts.threadRear[lane], "d", trace(rear));
  const front = reedX < fellX - 0.05 ? trace([[reedX, y, reedZ], [fellX, y, L.warpZ]]) : "";
  const raised = lift > 1.5;
  write(parts.threadFrontLow[lane], "d", raised ? "" : front);
  write(parts.threadFrontHigh[lane], "d", raised ? front : "");
  const fellEnd = flat(fellX, y, L.warpZ);
  write(parts.fellEnd[lane], "cx", fellEnd[0].toFixed(1));
  write(parts.fellEnd[lane], "cy", fellEnd[1].toFixed(1));
}

function clothPoint(u, y) {
  const C = L.cloth;
  const corner = C.cornerX - L.fell;
  if (u <= corner) return [L.fell + u, y, C.z];
  return [C.cornerX, y, C.z - (u - corner)];
}

function clothCell(u0, u1, y0, y1) {
  const corner = L.cloth.cornerX - L.fell;
  const points = [clothPoint(u0, y0)];
  if (u0 < corner && u1 > corner) points.push(clothPoint(corner, y0));
  points.push(clothPoint(u1, y0), clothPoint(u1, y1));
  if (u0 < corner && u1 > corner) points.push(clothPoint(corner, y1));
  points.push(clothPoint(u0, y1));
  return trace(points, true);
}

function drawCloth(pose, fellX, glow) {
  const C = L.cloth;
  const corner = C.cornerX - L.fell;
  const last = corner + (C.z - C.dropTo);
  const start = fellX - L.fell;
  const w = C.halfWidth;
  write(parts.clothTop, "d", clothCell(start, corner, -w, w));
  write(parts.clothDrop, "d", clothCell(corner, last, -w, w));
  write(parts.clothEdge, "d", clothCell(start, last, -w, w) + trace([clothPoint(corner, -w), clothPoint(corner, w)]));
  const shift = clock.woven ? pose.takeUp : 1;
  let ink = "";
  let fresh = "";
  let rows = "";
  const count = loom.cloth.length;
  for (let age = 0; age < count; age++) {
    const u0 = (age - 1 + shift) * L.row;
    if (u0 >= last) break;
    const u1 = Math.min(last, u0 + L.row);
    const row = loom.cloth[count - 1 - age];
    let cells = "";
    for (const lane of laneIndexes) {
      if (row[lane]) cells += clothCell(u0, u1, warpY(lane) - L.warpPitch / 2, warpY(lane) + L.warpPitch / 2);
    }
    if (age === 0 && clock.woven && glow.cloth > 0) fresh += cells;
    else ink += cells;
    if (u1 < last - 0.05 && Math.abs(u1 - corner) > 0.3) rows += trace([clothPoint(u1, -w), clothPoint(u1, w)]);
  }
  write(parts.clothInk, "d", ink);
  write(parts.clothNew, "d", fresh);
  setGlow(parts.clothNew, glow.cloth);
  write(parts.clothRows, "d", rows);
}

function drawLever(rise) {
  const V = L.lever;
  const drop = (rise * (V.pivotX - V.rearX)) / (V.rodX - V.pivotX);
  const front = [V.rodX + 2.5, V.z + rise * ((V.rodX + 2.5 - V.pivotX) / (V.rodX - V.pivotX))];
  const rear = [V.rearX, V.z - drop];
  write(parts.lever, "html", barMarkup(rear, front, V.y0, V.y1, V.thick, "mid"));
  const D = L.treadle;
  const treadleRear = [D.rearX, D.rearZ - drop];
  write(parts.treadle, "html", barMarkup(treadleRear, [D.pivotX, D.pivotZ], D.y0, D.y1, D.thick, "lo"));
  const cordY = (V.y0 + V.y1) / 2;
  write(parts.leverCord, "d", trace([[V.rearX + 1.5, cordY, V.z - drop], [D.rearX + 1.5, cordY, D.rearZ - drop + D.thick / 2]]));
}

function readoutText() {
  const card = loom.chain[loom.cardIndex];
  const picks = loom.picks;
  return `card ${loom.cardIndex + 1} of ${Loom.CARDS} · ${Loom.rowBits(card)} · ${picks} ${picks === 1 ? "pick" : "picks"}`;
}

function announce() {
  if (!announcer) return;
  const row = loom.cloth[loom.cloth.length - 1];
  announcer.textContent = `Pick ${loom.picks} woven from card ${loom.cardIndex + 1}: ${Loom.rowBits(row)}, ${Loom.liftedCount(row)} hooks lifted.`;
}

function draw() {
  const pose = Loom.poseAt(clock.phase);
  const glow = Loom.glowAt(clock.phase);
  const card = loom.chain[loom.cardIndex];
  const reading = clock.latched ?? card;
  const centre = cylinderCentre(pose.swing);
  const seated = pose.turn >= 1;
  const faceX = centre[0] + L.card.half + L.card.thick;
  const rise = pose.griffe * L.griffe.rise;
  const reedX = L.reed.rest + (L.reed.beat - L.reed.rest) * pose.beat;
  const fellX = clock.woven ? L.fell - L.row * (1 - pose.takeUp) : L.fell;

  drawChain(pose, centre, reading, glow);

  for (const lane of laneIndexes) {
    const shift = seated ? Loom.needleShift(reading[lane], faceX, L.needle.headX) : 0;
    const lean = Loom.hookLean(shift, MECHANISM.hook);
    const lift = Loom.hookLift(clock.latched ? clock.latched[lane] : false, rise, L.griffe.free);
    drawNeedle(lane, shift, seated ? faceX : -1e6);
    drawHook(lane, lean, lift);
    drawHarness(lane, lift);
    drawThread(lane, lift, reedX, fellX);
    const on = reading[lane] ? 1 : 0;
    for (const element of [parts.needleHead[lane], parts.needleBody[lane], parts.needleSpring[lane], parts.needleTail[lane]]) setGlow(element, glow.needle * on);
    for (const element of [parts.hookLow[lane], parts.hookMid[lane], parts.hookDouble[lane], parts.hookTop[lane]]) setGlow(element, glow.hook * on);
    for (const element of [parts.harnessLow[lane], parts.harnessHigh[lane], parts.neck[lane]]) setGlow(element, glow.harness * on);
    for (const element of [parts.threadRear[lane], parts.threadFrontLow[lane], parts.threadFrontHigh[lane]]) setGlow(element, glow.thread * on);
  }

  write(parts.griffeBack, "transform", translateAlong(P, [0, 0, rise]));
  write(parts.griffeFront, "transform", translateAlong(P, [0, 0, rise]));
  write(parts.griffeRod, "transform", translateAlong(P, [0, 0, rise]));
  drawLever(rise);

  const slide = translateAlong(P, [reedX - L.reed.rest, 0, 0]);
  write(parts.battenBack, "transform", slide);
  write(parts.battenFront, "transform", slide);
  const flight = (pose.shuttle * 2 - 1) * L.shuttle.reach * clock.direction;
  write(parts.shuttle, "transform", translateAlong(P, [reedX - L.reed.rest, flight, 0]));
  const laying = pose.shuttle > 0 && !clock.woven;
  if (laying) {
    const from = -L.cloth.halfWidth * clock.direction;
    const reach = Math.max(-L.cloth.halfWidth, Math.min(L.cloth.halfWidth, flight));
    const fromX = L.fell - (L.shuttle.offsetX + 0.5) * pose.beat;
    const toX = reedX + L.shuttle.offsetX * (1 - pose.beat) + 0.5 * pose.beat;
    write(parts.weft, "d", trace([[fromX, from, L.shuttle.z], [toX, reach, L.shuttle.z]]));
  } else {
    write(parts.weft, "d", "");
  }
  setGlow(parts.weft, glow.weft);

  drawCloth(pose, fellX, glow);

  const text = apartReadout() ?? readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  write(stage, "data-stage", clock.phase >= 1 ? "resting" : Loom.stageAt(clock.phase));
  drawApart();
}

// ---- loop, pointer, keyboard ---------------------------------------------------------------------------

function tick(now) {
  const dt = clock.last ? Math.min((now - clock.last) / 1000, 1 / 30) : 1 / 60;
  clock.last = now;
  const flying = stepApart(dt);
  const target = clock.stepping || wantsTour() || finishingPick() ? 1 : 0;
  clock.rate += (target - clock.rate) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target - clock.rate) < 0.004) clock.rate = target;
  advance(dt * clock.rate);
  draw();
  const moving = clock.rate > 0 || target > 0 || flying;
  clock.frame = clock.visible && moving ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

function quietTour() {
  clock.touring = false;
  clearTimeout(clock.resumeTimer);
  clock.resumeTimer = setTimeout(() => {
    clock.touring = !still.matches;
    run();
  }, RESUME_AFTER);
}

function stepOnePick() {
  if (apartBusy()) return;
  if (still.matches) {
    jumpOnePick();
    draw();
    return;
  }
  clock.stepping = true;
  quietTour();
  run();
}

function punch(hit) {
  const card = Number(hit.getAttribute("data-card"));
  const position = Number(hit.getAttribute("data-position"));
  const punched = Loom.togglePunch(loom, card, position);
  if (announcer) announcer.textContent = `Card ${card + 1}, position ${position + 1}: ${punched ? "punched" : "patched"}. Row is now ${Loom.rowBits(loom.chain[card])}.`;
  quietTour();
  draw();
  run();
}

function chooseMotif(name) {
  Loom.setMotif(loom, name);
  motifButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute("data-motif") === name)));
  if (announcer) announcer.textContent = `Cards re-punched with the ${name} motif.`;
  draw();
  run();
}

function hold(value) {
  clock.held = value;
  if (!value) quietTour();
  run();
}

if (!manual) {
  stage.addEventListener("pointerenter", () => hold(true));
  stage.addEventListener("pointerleave", () => hold(false));
  stage.addEventListener("focusin", () => hold(true));
  stage.addEventListener("focusout", () => hold(false));
  stage.addEventListener("click", (event) => {
    const hit = event.target.closest('[data-dyn="hit"]');
    if (hit) punch(hit);
    else stepOnePick();
  });
  stage.addEventListener("keydown", (event) => {
    const hit = event.target.closest('[data-dyn="hit"]');
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (hit) punch(hit);
      else stepOnePick();
      return;
    }
    const choice = Number(event.key);
    if (choice >= 1 && choice <= Loom.MOTIF_NAMES.length) chooseMotif(Loom.MOTIF_NAMES[choice - 1]);
  });
  motifButtons.forEach((button) => button.addEventListener("click", () => chooseMotif(button.getAttribute("data-motif"))));
  if (stepButton) stepButton.addEventListener("click", stepOnePick);
  new IntersectionObserver(
    (entries) => {
      clock.visible = entries[entries.length - 1].isIntersecting;
      if (clock.visible) run();
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
  still.addEventListener("change", () => {
    clock.touring = !still.matches;
    run();
  });
}
