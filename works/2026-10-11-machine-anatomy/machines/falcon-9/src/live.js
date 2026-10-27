// Falcon 9's live hooks. The kit runtime owns the clock, zoom frame, exploded view, trace, steps, readout,
// sound and film hooks; this file owns the flight: the model's state, the camera, the carriers that fly
// the booster, the second stage, the fairing halves and the scenery, the flames (kit effect), the exhaust
// cloud and glows, the strongback, legs, grid fins and nitrogen puffs.
//
// Camera (kit hook `camera`): it frames the subject inside the part of the frame no text uses: the whole
// pad complex on the pad, the rocket during the climb, both stages after separation, booster and deck at
// the landing. It rolls with the rocket only while the rocket is apart, so the rocket stands upright and
// comes apart along its own axis. Distances to the pad and droneship are squeezed (fact film-compression).

function createMachineHooks(kit) {
  const Falcon = Modules["model.mjs"].FalconApi;
  const Layout = Modules["layout.mjs"].createLayout();
  const SIZES = Layout.sizes;
  const { write, setGlow, trace, emit, say, Motion, Effects } = kit;
  const SQUEEZE_METRES = 140;
  const SHIP_SQUEEZE_METRES = 26;
  const UPPER_SQUEEZE_METRES = 24;
  const LEAD_METRES = 7;
  const RUMBLE_EVERY = 1;
  const RUMBLE_SECONDS = 0.9;
  const MOST_ZOOM = 2.3;
  // Flying alone the booster keeps a margin round it, so its flame and fins stay in frame.
  const ALONE_ZOOM = 1.6;
  const PIVOT = [0, 0, 1.5];
  const ACROSS = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  const TOUR = [[0.4, "launch"]];
  const FILM = Boolean(kit.CONFIG.film);
  const EX = kit.CONFIG.explode;
  // The part of the frame the camera may fill: clear of the step list, the zoom frame and the trace strip.
  const SAFE = FILM ? { left: 560, right: 1360, top: 130, bottom: 900 } : { left: 30, right: 400, top: 70, bottom: 540 };

  const launchButton = document.querySelector("[data-launch]");
  const carriers = {};
  for (const name of ["booster", "upper", "fairingLeft", "fairingRight", "pad", "ship"]) carriers[name] = Array.from(document.querySelectorAll(`[data-carry="${name}"]`));
  const flames = kit.keyed("plume", "data-index");
  const vacuumFlame = kit.one("vacuum-plume");
  const clusterFlame = kit.one("cluster-plume");
  const CLUSTER_RADIUS = SIZES.engines.ring + SIZES.engines.exit;
  const legs = kit.keyed("leg", "data-index");
  const legSides = kit.keyed("leg-side", "data-index");
  const struts = kit.keyed("strut", "data-index");
  const fins = kit.keyed("fin", "data-index");
  const puffs = Array.from(document.querySelectorAll('[data-dyn="puff"]'));
  const erector = kit.one("erector");
  const erectorLattice = kit.one("erector-lattice");
  const erectorArms = kit.one("erector-arms");
  const clampJaws = kit.one("clamp-jaws");
  const smoke = kit.keyed("smoke", "data-index");
  const padGlow = kit.one("pad-glow");
  const deckGlow = kit.one("deck-glow");

  const planned = Falcon.plannedLanding();
  const roll = Motion.createSpring({ ...Motion.springFor(0.8, 1), value: 0 });
  const pivot = iso(PIVOT, kit.P);
  const metre = Math.hypot(...[0, 1].map((index) => iso([0, 0, 1], kit.P)[index] - iso([0, 0, 0], kit.P)[index]));
  const view = { springs: null };
  let flight = Falcon.createFlight();
  let running = false;
  let playback = 1;
  let clockSpeed = 1;
  let rumbleClock = 0;

  const PHASE_SAY = {
    ignition: "Nine engines starting; the rocket is held down.",
    liftoff: "Released: liftoff.",
    "max-q": "Max Q: the engines throttle down.",
    meco: "Main engine cutoff.",
    separation: "Stage separation.",
    flip: "The booster flips round on its nitrogen thrusters.",
    boostback: "Boostback burn.",
    "entry-burn": "Entry burn.",
    "landing-burn": "Landing burn on one engine.",
    landed: "Touchdown on the droneship.",
  };

  function flightEvent(event) {
    emit(event.name, {});
    if (event.phase && PHASE_SAY[event.phase]) say(PHASE_SAY[event.phase]);
  }

  function rumble(seconds) {
    const share = (flight.booster.engines * Falcon.throttleShare(flight)) / Falcon.ENGINE_COUNT;
    rumbleClock += seconds;
    if (rumbleClock < RUMBLE_EVERY) return;
    rumbleClock = 0;
    if (share > 0.03 && flight.phase !== "landed") emit("rumble", { level: Math.min(1, 0.25 + share), duration: RUMBLE_SECONDS });
  }

  function advance(seconds, speed) {
    Motion.setSpringTarget(roll, kit.apartBusy() ? 1 : 0);
    Motion.stepSpring(roll, seconds);
    stepCamera(seconds);
    clockSpeed = speed;
    if (!running) return;
    playback = Falcon.easePlayback(playback, Falcon.playbackRate(flight), seconds);
    for (const event of Falcon.step(flight, seconds * speed * playback, planned.aim)) flightEvent(event);
    rumble(seconds);
  }

  function busy() {
    return running || !roll.settled;
  }

  // ---- where the carriers sit ---------------------------------------------------------------------------

  function squeeze(metres, scale) {
    return (metres * scale) / (scale + Math.abs(metres));
  }

  function degrees(radians) {
    return (radians * 180) / Math.PI;
  }

  function leadMetres() {
    return Math.min(Math.max(0, flight.booster.h), LEAD_METRES) * (1 - Falcon.smooth(1.5, 4, flight.time));
  }

  function rotated([x, y], angle, about) {
    const turn = (angle * Math.PI) / 180;
    const dx = x - about[0];
    const dy = y - about[1];
    return [about[0] + dx * Math.cos(turn) - dy * Math.sin(turn), about[1] + dx * Math.sin(turn) + dy * Math.cos(turn)];
  }

  // Every carrier as an angle about the pivot and a shift, so points can be placed for the camera too.
  function poses() {
    const booster = flight.booster;
    const upper = flight.upper;
    const cameraRoll = degrees(booster.pitch) * roll.value;
    const lead = leadMetres() * metre;
    const height = booster.h - leadMetres();
    const scenery = (downrange, upScale = SQUEEZE_METRES) => ({ angle: -cameraRoll, shift: [squeeze(downrange, SQUEEZE_METRES) * metre, squeeze(height, upScale) * metre] });
    const boosterPose = { angle: degrees(booster.pitch) - cameraRoll, shift: [0, -lead] };
    const leaving = 90 * Falcon.smooth(Falcon.TIMES.fairing + 6, Falcon.TIMES.fairing + 40, flight.time);
    const upperAngle = flight.joined ? boosterPose.angle : degrees(upper.pitch) - cameraRoll;
    const upperOffset = flight.joined ? 0 : (squeeze(upper.apart, UPPER_SQUEEZE_METRES) + leaving) * metre;
    return { booster: boosterPose, upper: { angle: upperAngle, shift: [0, -lead], offset: upperOffset }, pad: scenery(-booster.x), ship: scenery(planned.x - booster.x, SHIP_SQUEEZE_METRES) };
  }

  function rotateAbout(angle, point) {
    return `rotate(${angle.toFixed(3)} ${point[0].toFixed(2)} ${point[1].toFixed(2)})`;
  }

  function transformOf(pose, scenery = false) {
    const offset = pose.offset ? ` translate(0 ${(-pose.offset).toFixed(2)})` : "";
    return scenery ? `${rotateAbout(pose.angle, pivot)} translate(${pose.shift[0].toFixed(2)} ${pose.shift[1].toFixed(2)})` : `translate(${pose.shift[0].toFixed(2)} ${pose.shift[1].toFixed(2)}) ${rotateAbout(pose.angle, pivot)}${offset}`;
  }

  // A rest-frame point of a carrier, placed where the carrier's transform puts it on screen.
  function placed(point, pose, scenery = false) {
    const flat = iso(point, kit.P);
    if (scenery) return rotated([flat[0] + pose.shift[0], flat[1] + pose.shift[1]], pose.angle, pivot);
    const lifted = [flat[0], flat[1] - (pose.offset ?? 0)];
    const turned = rotated(lifted, pose.angle, pivot);
    return [turned[0] + pose.shift[0], turned[1] + pose.shift[1]];
  }

  function place(name, transform, opacity = null) {
    for (const node of carriers[name]) {
      write(node, "transform", transform);
      write(node, "opacity", opacity);
    }
  }

  function shipShown() {
    // The ship fades in once the camera already frames it, so it never crosses the text band.
    return flight.joined ? 0 : 1 - Falcon.smooth(700, 1100, flight.booster.h);
  }

  function placeFairing(upperTransform) {
    const seconds = flight.upper.fairingOpen;
    const drift = squeeze(seconds * 3, 16) * metre;
    const fall = squeeze(seconds * seconds * 0.8, 22) * metre;
    const tip = Math.min(40, seconds * 12);
    const base = iso([0, 0, SIZES.fairing.z0], kit.P);
    const fade = seconds > 0 ? (1 - Falcon.smooth(4, 7, seconds)).toFixed(2) : null;
    place("fairingLeft", `${upperTransform} translate(${(-drift).toFixed(2)} ${fall.toFixed(2)}) ${rotateAbout(-tip, base)}`, fade);
    place("fairingRight", `${upperTransform} translate(${drift.toFixed(2)} ${fall.toFixed(2)}) ${rotateAbout(tip, base)}`, fade);
  }

  function placeCarriers() {
    const pose = poses();
    place("booster", transformOf(pose.booster));
    const upper = transformOf(pose.upper);
    const upperShown = 1 - Falcon.smooth(Falcon.TIMES.fairing + 8, Falcon.TIMES.fairing + 30, flight.time);
    place("upper", upper, upperShown < 0.999 ? upperShown.toFixed(2) : null);
    placeFairing(upper);
    // The pad fades as the rocket climbs away from it, before it would pass under the text band.
    const padShown = flight.joined ? 1 - Falcon.smooth(20, 70, flight.booster.h) : 0;
    place("pad", transformOf(pose.pad, true), padShown < 0.999 ? padShown.toFixed(2) : null);
    const shown = shipShown();
    place("ship", transformOf(pose.ship, true), shown < 0.999 ? shown.toFixed(2) : null);
  }

  // ---- the camera ---------------------------------------------------------------------------------------

  function subjectPoints() {
    const pose = poses();
    const points = [placed(PIVOT, pose.booster), placed([0, 0, flight.joined ? SIZES.fairing.tip : SIZES.interstage.z1], pose.booster)];
    if (!flight.joined && flight.time < Falcon.TIMES.fairing + 7) points.push(placed([0, 0, SIZES.mvac.exitZ], pose.upper), placed([0, 0, SIZES.fairing.tip], pose.upper));
    if (flight.joined && flight.booster.h < 40) {
      const T = SIZES.pad.towers;
      const A = SIZES.pad.half;
      for (const [across, depth] of T.places) points.push(placed([...Layout.site(across, depth), T.mastTop], pose.pad, true));
      for (const [across, depth] of T.places) points.push(placed([...Layout.site(across, depth), SIZES.pad.z1], pose.pad, true));
      points.push(placed([A, A, SIZES.pad.z0], pose.pad, true));
    }
    if (!flight.joined && flight.booster.h < 1600) {
      const H = SIZES.ship;
      for (const [x, y] of [[-H.seaHalf, H.seaHalf], [H.seaHalf, -H.seaHalf], [H.seaHalf, H.seaHalf]]) points.push(placed([x, y, H.sea], pose.ship, true));
    }
    return points;
  }

  function cameraTarget() {
    const points = subjectPoints();
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const wide = Math.max(40, Math.max(...xs) - Math.min(...xs));
    const tall = Math.max(40, Math.max(...ys) - Math.min(...ys));
    const bothStages = !flight.joined && flight.time < Falcon.TIMES.fairing + 7;
    const shipFramed = !flight.joined && flight.booster.h < 1600;
    const least = flight.booster.h > 100 && !bothStages && !shipFramed ? 1 : 0.4;
    const most = flight.joined ? MOST_ZOOM : ALONE_ZOOM;
    const zoom = Math.max(least, Math.min(most, (SAFE.right - SAFE.left) / wide, (SAFE.bottom - SAFE.top) / tall));
    const centre = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    const goal = [(SAFE.left + SAFE.right) / 2, (SAFE.top + SAFE.bottom) / 2];
    return { x: centre[0] - (goal[0] - EX.width / 2) / zoom, y: centre[1] - (goal[1] - EX.height / 2) / zoom, zoom };
  }

  function stepCamera(seconds) {
    const target = cameraTarget();
    if (!view.springs) {
      view.springs = {};
      for (const name of ["x", "y", "zoom"]) view.springs[name] = Motion.createSpring({ ...Motion.springFor(0.7, 1), value: target[name] });
    }
    for (const name of ["x", "y", "zoom"]) {
      Motion.setSpringTarget(view.springs[name], target[name]);
      Motion.stepSpring(view.springs[name], seconds);
    }
  }

  function camera() {
    if (!view.springs) stepCamera(0);
    return { x: view.springs.x.value, y: view.springs.y.value, zoom: view.springs.zoom.value };
  }

  // ---- flames, cloud, glows -----------------------------------------------------------------------------

  function local(centre) {
    return ([across, along]) => [centre[0] + ACROSS[0] * across, centre[1] + ACROSS[1] * across, centre[2] - along];
  }

  function writeFlame(group, shapes, centre) {
    const [halo, body, splash, core, ...diamonds] = group.children;
    const toWorld = local(centre);
    write(halo, "d", trace(shapes.halo.map(toWorld), true));
    write(halo, "opacity", shapes.haloOpacity.toFixed(2));
    write(body, "d", trace(shapes.body.map(toWorld), true));
    write(splash, "d", shapes.splash ? trace(shapes.splash.map(toWorld), true) : "");
    write(core, "d", trace(shapes.core.map(toWorld), true));
    write(core, "opacity", shapes.coreOpacity.toFixed(2));
    diamonds.forEach((node, index) => {
      const diamond = shapes.diamonds[index];
      write(node, "d", diamond ? trace(diamond.points.map(toWorld), true) : "");
      write(node, "opacity", diamond ? diamond.opacity.toFixed(2) : "0");
    });
  }

  function groundBelow() {
    const booster = flight.booster;
    if (Math.abs(booster.pitch) > 0.3) return Infinity;
    if (flight.joined && booster.h < 60) return booster.h - SIZES.pad.z1;
    if (!flight.joined && booster.h < 80) return booster.h - SIZES.ship.deck;
    return Infinity;
  }

  // The kit plume per burning engine: throttle and thin air from the model (effects.mjs). While apart the
  // flames fade back so the numbered parts read.
  function drawFlames(assembled) {
    const booster = flight.booster;
    const throttle = Falcon.throttleShare(flight);
    const thin = 1 - Falcon.densityAt(booster.h) / Falcon.densityAt(0);
    const burning = new Set(Layout.burningEngines(booster.engines));
    const ground = groundBelow();
    drawCluster(assembled, throttle, thin, ground);
    Layout.enginePlaces().forEach((place, index) => {
      const group = flames[index];
      const on = burning.has(index) && throttle > 0.02;
      write(group, "opacity", on ? ((0.3 + 0.7 * assembled) * Math.min(1, throttle * 1.4)).toFixed(2) : "0");
      if (!on) return;
      const shapes = Effects.plume({ throttle, thin, exitRadius: SIZES.engines.exit, length: booster.engines === 1 ? 11 : 15, spread: 1.15, ground, time: flight.time, seed: index + 1, diamonds: 4 });
      writeFlame(group, shapes, [place[0], place[1], 0]);
    });
    const upper = flight.upper;
    const vacuumOn = upper.burning && flight.time < Falcon.TIMES.fairing + 36;
    write(vacuumFlame, "opacity", vacuumOn ? "0.9" : "0");
    if (vacuumOn) writeFlame(vacuumFlame, Effects.plume({ throttle: 1, thin: 1, exitRadius: SIZES.mvac.exit, length: 9, spread: 3.2, time: flight.time, seed: 11 }), [0, 0, SIZES.mvac.exitZ]);
    drawGlows(throttle, booster);
  }

  // All nine together make one plume with shock diamonds the size of the engine cluster (plume-drawing).
  function drawCluster(assembled, throttle, thin, ground) {
    const on = flight.booster.engines >= 9 && throttle > 0.02;
    write(clusterFlame, "opacity", on ? ((0.3 + 0.7 * assembled) * Math.min(1, throttle * 1.4)).toFixed(2) : "0");
    if (!on) return;
    const shapes = Effects.plume({ throttle, thin, exitRadius: CLUSTER_RADIUS, length: 30, spread: 3.4, ground, time: flight.time, seed: 21, diamonds: 6 });
    writeFlame(clusterFlame, shapes, [0, 0, 0]);
  }

  function drawGlows(throttle, booster) {
    const padPower = (booster.engines * throttle) / Falcon.ENGINE_COUNT;
    const padLight = flight.joined ? Effects.glow({ power: padPower, distance: booster.h, reach: 30 }) : 0;
    write(padGlow, "rx", (16 * metre).toFixed(1));
    write(padGlow, "ry", (8 * metre).toFixed(1));
    write(padGlow, "opacity", (0.5 * padLight).toFixed(2));
    const deckLight = flight.phase === "landing-burn" ? Effects.glow({ power: throttle, distance: booster.h, reach: 22 }) : 0;
    write(deckGlow, "rx", (9 * metre).toFixed(1));
    write(deckGlow, "ry", (4.5 * metre).toFixed(1));
    write(deckGlow, "opacity", (0.55 * deckLight).toFixed(2));
  }

  // The exhaust cloud: it billows out of the flame trench from engine start and thins out over the climb.
  function drawSmoke() {
    const age = flight.time - Falcon.TIMES.engineStart;
    const clouds = age > 0 ? Effects.puffs({ age, count: 16, spread: 24, rise: 10, size: 6.5, life: 16, seed: 4 }) : [];
    for (let index = 0; index < 16; index++) {
      const node = smoke[index];
      const puff = clouds[index];
      if (!puff) {
        write(node, "opacity", "0");
        continue;
      }
      const [across, up, radius, opacity] = puff;
      const centre = iso([across * 0.5, 15 + across * 0.7, SIZES.pad.z1 + up], kit.P);
      write(node, "cx", centre[0].toFixed(1));
      write(node, "cy", centre[1].toFixed(1));
      write(node, "r", (radius * metre).toFixed(1));
      write(node, "opacity", (0.85 * opacity).toFixed(2));
    }
  }

  // ---- strongback, legs, fins, puffs --------------------------------------------------------------------

  function writeSolid(group, corners, extraLines = "") {
    const outline = trace(corners, true);
    const [fill, shade, edge] = group.children;
    write(fill, "d", outline);
    write(shade, "d", outline);
    write(edge, "d", outline + extraLines);
  }

  // The erector tilts back just before launch (guide-strongback), over the last seconds of the count.
  function drawErector() {
    const share = Falcon.smooth(-2.1, -0.8, flight.time);
    const frame = Layout.erectorFrame(share);
    const front = frame.depth;
    const back = -frame.depth;
    const face = [frame.point(0, front, 0), frame.point(frame.width, front, 0), frame.point(frame.width, front, frame.height), frame.point(0, front, frame.height)];
    writeSolid(erector, face);
    write(erectorLattice, "d", erectorLines(frame, front, back));
    write(erectorArms, "d", armLines(frame, front, back));
  }

  function erectorLines(frame, front, back) {
    const E = SIZES.pad.erector;
    let lines = "";
    for (let up = 0; up < frame.height - 3; up += 4) {
      lines += trace([frame.point(0, front, up), frame.point(frame.width, front, up + 4)]);
      lines += trace([frame.point(frame.width, front, up), frame.point(0, front, up + 4)]);
    }
    for (const offset of [0, frame.width]) lines += trace([frame.point(offset, back, 0), frame.point(offset, back, frame.height)]);
    for (const depth of [front, back]) {
      const [x, y] = Layout.site(E.across + E.ram.to, depth);
      lines += trace([[x, y, SIZES.pad.z1], frame.point(frame.width, depth, E.ram.from)]);
    }
    return lines;
  }

  // The arms that hold the stack: from the beam's inner chord to a clamp pad on the rocket's skin; they
  // ride with the beam, so they leave the rocket as it tilts back (photo-erector).
  function armLines(frame, front, back) {
    const E = SIZES.pad.erector;
    const reach = SIZES.radius + 0.05 - E.across;
    let lines = "";
    for (const up of E.arms) {
      lines += trace([frame.point(0, front, up), frame.point(reach, front * 0.45, up), frame.point(reach, back * 0.45, up), frame.point(0, back, up)]);
      lines += trace([frame.point(reach, front * 0.45, up - 0.8), frame.point(reach, front * 0.45, up + 0.8)]);
    }
    return lines;
  }

  function lattice(corners) {
    let lines = "";
    for (const share of [0.25, 0.5, 0.75]) {
      lines += trace([Layout.lerp3(corners[0], corners[1], share), Layout.lerp3(corners[3], corners[2], share)]);
      lines += trace([Layout.lerp3(corners[0], corners[3], share), Layout.lerp3(corners[1], corners[2], share)]);
    }
    return lines;
  }

  function drawHinged() {
    SIZES.legs.angles.forEach((angle, index) => {
      writeSolid(legs[index], Layout.legCorners(angle, flight.legs.value));
      const leg = Layout.legSide(angle, flight.legs.value);
      writeSolid(legSides[index], leg.side);
      write(struts[index], "d", flight.legs.value > 0.05 ? trace(leg.strut) : "");
    });
    SIZES.fins.angles.forEach((angle, index) => {
      const corners = Layout.finCorners(angle, flight.fins.value);
      writeSolid(fins[index], corners, lattice(corners));
    });
    const turning = thrustersFiring();
    const flutter = 0.6 + 0.4 * Math.abs(Math.sin(flight.time * 9));
    for (const puff of puffs) setGlow(puff, turning ? flutter : 0);
  }

// The nitrogen thrusters fire whenever they are turning the booster or stopping a turn (turnCause).
  function thrustersFiring() {
    const attitude = flight.booster.attitude;
    const working = Math.abs(attitude.target - attitude.value) > 0.01 || Math.abs(attitude.velocity) > 0.005;
    return working && Falcon.turnCause(flight) === "nitrogen thrusters";
  }

  // The four hold-down clamps grip the engine section until T-0, then swing open (guide-clamps).
  function drawClamps() {
    const open = Falcon.smooth(-0.1, 0.5, flight.time);
    const S = SIZES.pad;
    let lines = "";
    for (const [sideX, sideY] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const out = [sideX * Math.SQRT1_2, sideY * Math.SQRT1_2];
      const base = SIZES.radius + 0.6;
      const reach = SIZES.radius - 0.1 + 1.4 * open;
      const tipZ = 2.2 - 0.6 * open;
      lines += trace([[out[0] * base, out[1] * base, S.clampTop], [out[0] * reach, out[1] * reach, tipZ]]);
    }
    write(clampJaws, "d", lines);
  }

  // What acts on the booster's turn now, as drawn: the thrusters count only while their puffs show.
  function turnCauseShown() {
    const cause = Falcon.turnCause(flight);
    if (cause !== "nitrogen thrusters") return cause;
    return thrustersFiring() ? cause : "none";
  }

  function draw(assembled) {
    placeCarriers();
    drawFlames(assembled);
    drawSmoke();
    drawErector();
    drawClamps();
    drawHinged();
    write(launchButton, "text", running ? "Launch again" : "Launch");
  }

  function settleStill(seconds) {
    if (!running) return;
    Falcon.step(flight, seconds * Math.max(1, Falcon.playbackRate(flight)), planned.aim);
  }

  function launch() {
    flight = Falcon.createFlight();
    running = true;
    playback = 1;
    rumbleClock = 0;
    say("Countdown: engines start at T-3 seconds.");
  }

  function relaunch() {
    if (kit.apartBusy()) return;
    launch();
    kit.afterAction();
  }

  return {
    advance,
    draw,
    busy,
    camera,
    readout: () => Falcon.readoutOf(flight, running ? clockSpeed * playback : 1),
    settleStill,
    actions: { launch, start: launch, stop: () => (running = false) },
    wire: () => launchButton.addEventListener("click", relaunch),
    onStageClick: relaunch,
    keys: { Enter: relaunch, " ": relaunch },
    tour: { steps: TOUR, seconds: 38 },
    tourPaused: () => false,
    tourResumeAt: () => 0,
    disabledWhileApart: ["[data-launch]"],
    armedText: "rolling the camera upright · then apart",
    zoomReady: () => flight.time > 0.6 && leadMetres() < 0.3,
    stepLevels: () => Falcon.stepLevels(flight),
    traceLevels: () => Falcon.traceLevels(flight),
    // Apart needs the whole stack: once the stages have split, the page shows a fresh rocket on the pad.
    prepareApart: () => {
      if (flight.joined) return;
      flight = Falcon.createFlight();
      running = false;
    },
    readyToOpen: () => roll.value > 0.985,
    stageName: () => flight.phase,
    working: () => flight.phase !== "pad",
    snapshot() {
      const round = (value) => Math.round(value * 1000) / 1000;
      const booster = flight.booster;
      return {
        phase: flight.phase,
        missionTime: round(flight.time),
        height: round(booster.h),
        downrange: round(booster.x),
        pitch: round(booster.pitch),
        engines: booster.engines,
        throttle: round(Falcon.throttleShare(flight)),
        legs: round(flight.legs.value),
        fins: round(flight.fins.value),
        turnCause: turnCauseShown(),
        thrusters: thrustersFiring() ? 1 : 0,
        clampsOpen: round(Falcon.smooth(-0.1, 0.5, flight.time)),
        erector: round(Falcon.smooth(-2.1, -0.8, flight.time)),
        fairingOpen: round(flight.upper.fairingOpen),
        upperBurning: flight.upper.burning ? 1 : 0,
        upperApart: round(flight.upper.apart),
        roll: round(roll.value),
        cameraZoom: round(camera().zoom),
        playback: round(playback),
        touchdownSpeed: flight.touchdownSpeed === undefined ? null : round(flight.touchdownSpeed),
        missFromShip: round(booster.x - planned.x),
      };
    },
  };
}
