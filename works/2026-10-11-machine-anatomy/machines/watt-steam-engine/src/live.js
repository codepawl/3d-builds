// The live half of the Watt engine figure. The build inlines this file after the kit, the pure model
// (Engine), the size table and drawing helpers (Layout, Draw) and CONFIG. It fills the empty slots the
// build left: beam, parallel motion, piston, air pump, plug rod, valve handles, gears, connecting rod,
// flywheel spokes, governor, throttle and the steam and exhaust that run through the pipes. Every
// position it draws comes from Engine.poseAt(crank angle).

const P = CONFIG.projection;
const SIZES = Layout.sizes;
const GEOMETRY = Engine.GEOMETRY;
const SHAFT = GEOMETRY.shaft;
const PLANET_REST = Engine.planetCentre(0, GEOMETRY);
const RUN_RATE = 7;
const FLOW_PER_RADIAN = 15;
const LOAD_STEP = 5;
const LONGEST_FRAME = 1 / 30;

const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const pauseButton = document.querySelector("[data-pause]");
const stepButton = document.querySelector("[data-step]");
const loadSlider = document.querySelector("[data-load]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";
// ?run=off keeps the engine paused until the reader starts it: for tests and for embedding.
const startsPaused = query.get("run") === "off";

function one(name) {
  return document.querySelector(`[data-dyn="${name}"]`);
}

function keyed(name, attribute) {
  const found = {};
  for (const element of document.querySelectorAll(`[data-dyn="${name}"]`)) found[element.getAttribute(attribute)] = element;
  return found;
}

const parts = {
  beam: one("beam"),
  radius: one("radius"),
  links: one("links"),
  piston: one("piston"),
  pistonRod: one("piston-rod"),
  bellCrank: one("bell-crank"),
  pump: one("pump"),
  pumpFill: one("pump-fill"),
  plug: one("plug"),
  handles: one("handles"),
  fills: keyed("fill", "data-fill"),
  sunFace: one("sun-face"),
  planet: one("planet"),
  planetFace: one("planet-face"),
  rod: one("rod"),
  link: one("link"),
  spokes: one("spokes"),
  governor: one("governor"),
  throttleRod: one("throttle-rod"),
  throttle: one("throttle"),
  belt: one("belt"),
  condenserFill: one("condenser-fill"),
  flows: keyed("flow", "data-flow"),
  chips: Array.from(document.querySelectorAll("[data-trace]")),
  stepItems: Array.from(document.querySelectorAll("[data-step-item]")),
  stepMarks: Array.from(document.querySelectorAll("[data-stepmark]")),
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
  if (name === "glow") element.style.setProperty("--glow", value);
  else if (name === "html") element.innerHTML = value;
  else if (name === "text") element.textContent = value;
  else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function setGlow(element, value) {
  write(element, "glow", String(Math.round(value * 100) / 100));
}

const camera = cameraOf(P);

function depthOfPoint(point) {
  return point[0] * camera.cosA + point[1] * camera.sinA;
}

// ---- state ---------------------------------------------------------------------------------------------

const engine = Engine.settleEngine(Engine.createEngine(0.5));
// `scale` slows the whole engine for the film's first stroke; `run` eases to 0 while the engine is apart.
const clock = { paused: startsPaused, stepping: false, visible: manual, frame: 0, last: 0, elapsed: 0, scale: 1, run: startsPaused ? 0 : 1, spin: 0 };
// The film shows six numbered steps during its slow stroke; the page leaves them to the trace.
const steps = { shown: 0 };

function say(text) {
  if (announcer) announcer.textContent = text;
}

function wantsToRun() {
  return !clock.paused && !apartBusy();
}

function follow(value, target, seconds, rate) {
  const next = value + (target - value) * (1 - Math.exp(-rate * seconds));
  return Math.abs(next - target) < 0.002 ? target : next;
}

function strokeSeconds() {
  const pace = engine.speed * Engine.ENGINE.nominal * clock.scale * Math.max(clock.run, 0.05);
  return Math.min(9, Math.PI / Math.max(pace, 0.05));
}

// What the engine reports while it runs, on the figure's own clock: one event per valve changeover and
// a few per turn of the gears.
function report(event, at) {
  if (event.name === "gear") {
    emit("gear", { speed: Math.round(event.speed * 1000) / 1000 }, at);
    return;
  }
  emit("valve", { direction: event.direction }, at);
  emit("chuff", { direction: event.direction, duration: Math.round(strokeSeconds() * 1000) / 1000 }, at);
  if (clock.stepping) {
    clock.stepping = false;
    setPaused(true);
  }
}

function advance(seconds) {
  clock.run = clock.paused ? 0 : follow(clock.run, wantsToRun() ? 1 : 0, seconds, RUN_RATE);
  const step = seconds * clock.scale * clock.run;
  if (step > 0) {
    const before = engine.time;
    const events = Engine.stepEngine(engine, step);
    clock.spin += Engine.flywheelTurnsPerMinute(engine) * (Engine.TAU / 60) * Engine.GOVERNOR.ratio * step;
    for (const event of events) report(event, clock.elapsed + ((event.at - before) / step) * seconds);
  }
  ageInset(seconds, step > 0);
  clock.elapsed += seconds;
}

// ---- drawing -------------------------------------------------------------------------------------------

function drawBeam(pose) {
  const B = SIZES.beam;
  const pins = [GEOMETRY.beamPivot, pose.beamEnd, pose.end, pose.inner].map((point) => Draw.pin(point, B.y1, 1.2)).join("");
  write(parts.beam, "html", Draw.plate(Layout.beamPolygon(pose.beamAngle), B.y0, B.y1, "hi") + pins);
}

function drawMotion(pose) {
  const M = SIZES.motion;
  const radiusRod = Draw.plate(Layout.barPolygon(GEOMETRY.radiusAnchor, pose.back, M.half), M.radiusY[0], M.radiusY[1]);
  write(parts.radius, "html", radiusRod + Draw.pin(GEOMETRY.radiusAnchor, M.radiusY[1]) + Draw.pin(pose.back, M.radiusY[1]));
  const backLink = Draw.plate(Layout.barPolygon(pose.inner, pose.back, M.half), M.linkY[0], M.linkY[1]);
  const mainLink = Draw.plate(Layout.barPolygon(pose.end, pose.rodTop, M.half), M.linkY[0], M.linkY[1]);
  const bar = Draw.plate(Layout.barPolygon(pose.back, pose.rodTop, M.half), M.barY[0], M.barY[1]);
  const pins = [pose.inner, pose.end].map((point) => Draw.pin(point, M.linkY[1])).join("") + [pose.back, pose.rodTop].map((point) => Draw.pin(point, M.barY[1])).join("");
  write(parts.links, "html", backLink + mainLink + bar + pins + Draw.pin(pose.pumpTop, M.linkY[1], 0.9));
}

function drawPiston(pose) {
  const Y = SIZES.cylinder;
  const rod = Draw.face(Draw.rectangle(Y.x - Y.rodHalf, Y.x + Y.rodHalf, pose.pistonZ, pose.rodTop[1]), 0.5, "hi");
  const piston = Draw.face(Draw.rectangle(Y.x - Y.bore, Y.x + Y.bore, pose.pistonZ - Y.pistonHalf, pose.pistonZ + Y.pistonHalf), 0.6, "hi");
  const packing = `<path class="iso-line" data-tone="mid" d="${Draw.onPlane([[Y.x - Y.bore, pose.pistonZ], [Y.x + Y.bore, pose.pistonZ]], 0.6, false)}"/>`;
  write(parts.piston, "html", piston + packing);
  write(parts.pistonRod, "html", rod + Draw.pin(pose.rodTop, 0.6, 1.3));
  const above = Draw.onPlane(Draw.rectangle(Y.x - Y.bore, Y.x + Y.bore, pose.pistonZ + Y.pistonHalf, Y.top), 0);
  const below = Draw.onPlane(Draw.rectangle(Y.x - Y.bore, Y.x + Y.bore, Y.bottom, pose.pistonZ - Y.pistonHalf), 0);
  write(parts.fills["top-steam"], "d", above);
  write(parts.fills["top-exhaust"], "d", above);
  write(parts.fills["bottom-steam"], "d", below);
  write(parts.fills["bottom-exhaust"], "d", below);
  setGlow(parts.fills["top-steam"], pose.valves.topSteam);
  setGlow(parts.fills["top-exhaust"], pose.valves.topExhaust);
  setGlow(parts.fills["bottom-steam"], pose.valves.bottomSteam);
  setGlow(parts.fills["bottom-exhaust"], pose.valves.bottomExhaust);
}

function drawPump(pose) {
  const U = SIZES.pump;
  const rod = Draw.face(Layout.barPolygon(pose.pumpTop, [U.x, pose.pumpZ], U.rodHalf), 0.5, "hi");
  const bucket = Draw.face(Draw.rectangle(U.x - U.r + 1.5, U.x + U.r - 1.5, pose.pumpZ - U.bucketHalf, pose.pumpZ + U.bucketHalf), 0.6, "hi");
  write(parts.pump, "html", rod + bucket);
  write(parts.pumpFill, "d", Draw.onPlane(Draw.rectangle(U.x - U.r + 1.5, U.x + U.r - 1.5, U.z0 + 2, pose.pumpZ - U.bucketHalf), 0));
  setGlow(parts.pumpFill, 0.9);
  setGlow(parts.condenserFill, 0.55);
}

function handleMarkup(lift, y, height, kind) {
  const B = SIZES.boxes;
  const angle = (-30 + 60 * lift) * Engine.DEGREE;
  const pivot = [B.x1, y, height];
  const tip = [B.x1 + B.handle * Math.cos(angle), y, height + B.handle * Math.sin(angle)];
  const [x, z] = iso(tip, P);
  const knob = `<circle class="we-knob" data-kind="${kind}" style="--glow:${lift.toFixed(2)}" cx="${x.toFixed(1)}" cy="${z.toFixed(1)}" r="${(1.5 * camera.k).toFixed(2)}"/>`;
  return `<path class="we-handle" d="${Draw.through([pivot, tip])}"/>${knob}`;
}

function drawValves(pose) {
  const B = SIZES.boxes;
  const upper = (B.upper[0] + B.upper[1]) / 2;
  const lower = (B.lower[0] + B.lower[1]) / 2;
  const valves = pose.valves;
  const markup = handleMarkup(valves.topSteam, B.steamY, upper, "steam") + handleMarkup(valves.topExhaust, B.exhaustY, upper, "exhaust") + handleMarkup(valves.bottomSteam, B.steamY, lower, "steam") + handleMarkup(valves.bottomExhaust, B.exhaustY, lower, "exhaust");
  write(parts.handles, "html", markup);
  write(parts.plug, "transform", translateAlong(P, [0, 0, -pose.plugDrop]));
}

function drawGears(pose) {
  const R = SIZES.gears;
  const teeth = GEOMETRY.teeth;
  const mark = [SHAFT[0] + 8 * Math.cos(pose.sunAngle), SHAFT[1] + 8 * Math.sin(pose.sunAngle)];
  const sun = Draw.face(Layout.gearPolygon(SHAFT, GEOMETRY.sunRadius, teeth, pose.sunAngle), R.y1, "hi");
  write(parts.sunFace, "html", sun + Draw.pin(SHAFT, R.y1, 2.4) + Draw.pin(mark, R.y1, 1));
  write(parts.planet, "transform", translateAlong(P, [pose.planet[0] - PLANET_REST[0], 0, pose.planet[1] - PLANET_REST[1]]));
  write(parts.planetFace, "html", Draw.face(Layout.gearPolygon(PLANET_REST, GEOMETRY.planetRadius, teeth, pose.rodAngle - Math.PI / 2), R.y1, "hi"));
  const rod = Draw.plate(Layout.barPolygon(pose.beamEnd, pose.planet, 2.3, 3.6), R.rodY[0], R.rodY[1], "hi");
  const along = [Math.cos(pose.rodAngle), Math.sin(pose.rodAngle)];
  const bolts = [5, -5].map((reach) => Draw.pin([pose.planet[0] + along[1] * reach, pose.planet[1] - along[0] * reach], R.rodY[1], 0.8)).join("");
  write(parts.rod, "html", rod + Draw.pin(pose.beamEnd, R.rodY[1], 1.3) + bolts);
  const link = Draw.plate(Layout.barPolygon(SHAFT, pose.planet, 2.1), R.linkY[0], R.linkY[1]);
  write(parts.link, "html", link + Draw.pin(SHAFT, R.linkY[1], 1.2) + Draw.pin(pose.planet, R.linkY[1], 1.2));
  const F = SIZES.flywheel;
  write(parts.spokes, "html", Layout.spokePolygons(pose.sunAngle).map((polygon) => Draw.face(polygon, F.y1 + 0.1, "mid")).join(""));
}

function armMarkup(arm, points) {
  // The arm is a flat bar: a dark stroke with a light one inside it.
  const armPath = Draw.through([points.top, arm.ball]);
  const armLine = `<path class="we-arm" d="${armPath}"/><path class="we-arm-core" d="${armPath}"/>`;
  const linkLine = `<path class="we-rod" d="${Draw.through([arm.joint, points.sleeve])}"/>`;
  return linkLine + armLine + Draw.ball(arm.ball, SIZES.governor.ball);
}

function drawGovernor(assembled) {
  const V = SIZES.governor;
  const points = Layout.governorPoints(engine.ballAngle, clock.spin);
  const arms = points.arms.slice().sort((a, b) => depthOfPoint(a.ball) - depthOfPoint(b.ball));
  const sleeve = `<path class="we-handle" d="${Draw.through([[V.x, V.y, points.sleeve[2] - 1.6], [V.x, V.y, points.sleeve[2] + 1.6]])}"/>`;
  const cap = `<path class="we-handle" d="${Draw.through([[V.x, V.y, V.top - 0.8], [V.x, V.y, V.top + 1.6]])}"/>`;
  write(parts.governor, "html", armMarkup(arms[0], points) + sleeve + cap + armMarkup(arms[1], points));
  const linkage = Layout.throttleLinkage(engine.ballAngle);
  const lift = (point) => [point[0], V.y, point[1]];
  const crank = `<path class="we-rod" d="${Draw.through([lift(linkage.sleeve), lift(linkage.pivot), lift(linkage.tip)])}"/>`;
  const rod = `<path class="we-rod" data-thin d="${Draw.through([lift(linkage.tip), lift(linkage.armTip)])}"/>`;
  const arm = `<path class="we-rod" d="${Draw.through([lift(linkage.armTip), lift(linkage.throttlePivot)])}"/>`;
  const pin = (point) => Draw.pin(point, V.y, 0.9);
  write(parts.bellCrank, "html", crank + pin(linkage.pivot) + pin(linkage.tip));
  write(parts.bellCrank, "opacity", assembled.toFixed(2));
  write(parts.throttleRod, "html", rod + arm + pin(linkage.armTip) + pin(linkage.throttlePivot));
  write(parts.throttleRod, "opacity", assembled.toFixed(2));
  write(parts.belt, "opacity", assembled.toFixed(2));
  const T = SIZES.pipes;
  const opening = Engine.throttleFor(engine.ballAngle);
  const angle = (1 - opening) * (Math.PI / 2) * 0.92;
  const reach = [3.6 * Math.cos(angle), 3.6 * Math.sin(angle)];
  const dial = T.steamY + T.throttleR + 1;
  write(parts.throttle, "d", Draw.through([[T.throttleX - reach[0], dial, T.mainZ - reach[1]], [T.throttleX + reach[0], dial, T.mainZ + reach[1]]]));
}

function drawFlows(pose, assembled) {
  const valves = pose.valves;
  const levels = {
    steamMain: 0.45 + 0.55 * Engine.throttleFor(engine.ballAngle),
    steamTop: valves.topSteam,
    steamBottom: valves.bottomSteam,
    exhaustTop: valves.topExhaust,
    exhaustBottom: valves.bottomExhaust,
    condensate: 0.85,
  };
  const offset = (-engine.crank * FLOW_PER_RADIAN * camera.k * 0.5).toFixed(1);
  for (const [name, level] of Object.entries(levels)) {
    setGlow(parts.flows[name], level * assembled);
    write(parts.flows[name], "stroke-dashoffset", offset);
  }
}

function drawTrace(pose) {
  const glows = Engine.traceAt(pose.stroke.share);
  parts.chips.forEach((chip, index) => setGlow(chip, glows[index]));
  write(parts.chips[0], "text", `${Engine.TRACE[0]} ${pose.stroke.direction}`);
  if (!parts.stepItems.length) return;
  const levels = Engine.stepsAt(pose.stroke.share);
  parts.stepItems.forEach((item, index) => setGlow(item, levels[index]));
}

// ---- the zoom frame ------------------------------------------------------------------------------------

// The one enlarged view is born from the engine: a thin source rectangle appears round the cylinder, the
// frame grows out of it to its place, four dashed lines join their corners, and then the rectangle and
// the lines fade so only the frame is left. `age` is the seconds since the birth began, null before it.
const INSET = CONFIG.inset;
const FILMED = CONFIG.explode.film;
const STAGE_SIZE = { width: CONFIG.explode.width, height: CONFIG.explode.height };
const BIRTH = { wait: 1.5, appear: 0.3, grow: 0.7, hold: 1, fade: 1.2, room: 1 };
const BIRTH_SECONDS = BIRTH.appear + BIRTH.grow + BIRTH.hold + BIRTH.fade;
const inset = { age: null, waited: 0, fade: 1 };

function insetPart(name) {
  return document.querySelector(`[data-inset="${name}"]`);
}

const insetParts = {
  group: insetPart("group"),
  clip: insetPart("clip"),
  paper: insetPart("paper"),
  edge: insetPart("edge"),
  view: insetPart("view"),
  guides: insetPart("guides"),
  source: insetPart("source"),
  lines: insetPart("lines"),
};

function easeOut(share) {
  const left = 1 - Engine.clamp(share, 0, 1);
  return 1 - left * left * left;
}

function insetLevels() {
  const age = inset.age;
  if (age === null) return { grow: 0, guides: 0, shown: 0, room: 0 };
  const grown = BIRTH.appear + BIRTH.grow + BIRTH.hold;
  return {
    grow: easeOut((age - BIRTH.appear) / BIRTH.grow),
    guides: Engine.smooth(0, BIRTH.appear, age) * (1 - Engine.smooth(grown, grown + BIRTH.fade, age)),
    shown: age >= BIRTH.appear ? 1 : 0,
    room: Engine.smooth(0, BIRTH.room, age),
  };
}

function insetGrowing() {
  return inset.age !== null && inset.age < BIRTH_SECONDS;
}

// The page starts the birth once the engine has run for a moment; the film sets the age itself.
function ageInset(seconds, running) {
  if (FILMED) return;
  if (inset.age !== null) {
    inset.age += seconds;
    return;
  }
  if (!running) return;
  inset.waited += seconds;
  if (inset.waited >= BIRTH.wait) inset.age = 0;
}

// The view the assembled engine is shown in: centred, or moved aside once the zoom frame needs the room.
function restView() {
  const centre = { x: STAGE_SIZE.width / 2, y: STAGE_SIZE.height / 2, zoom: 1 };
  const room = INSET.room;
  if (!room) return centre;
  const share = insetLevels().room;
  return { x: centre.x + (room.x - centre.x) * share, y: centre.y + (room.y - centre.y) * share, zoom: 1 + (room.zoom - 1) * share };
}

function sourceOnStage(view) {
  const source = INSET.source;
  return {
    x: STAGE_SIZE.width / 2 + (source.x - view.x) * view.zoom,
    y: STAGE_SIZE.height / 2 + (source.y - view.y) * view.zoom,
    width: source.width * view.zoom,
    height: source.height * view.zoom,
  };
}

function rectBetween(from, to, share) {
  const mix = (name) => from[name] + (to[name] - from[name]) * share;
  return { x: mix("x"), y: mix("y"), width: mix("width"), height: mix("height") };
}

function setRect(element, rect) {
  const radius = (INSET.frame.radius * rect.width) / INSET.frame.width;
  write(element, "x", rect.x.toFixed(2));
  write(element, "y", rect.y.toFixed(2));
  write(element, "width", rect.width.toFixed(2));
  write(element, "height", rect.height.toFixed(2));
  write(element, "rx", radius.toFixed(2));
}

function cornersOf(rect) {
  return [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]];
}

function cornerLines(source, frame) {
  const ends = cornersOf(frame);
  return cornersOf(source).map((corner, index) => `M${corner[0].toFixed(1)} ${corner[1].toFixed(1)}L${ends[index][0].toFixed(1)} ${ends[index][1].toFixed(1)}`).join("");
}

function drawInset(view, open) {
  const levels = insetLevels();
  const source = sourceOnStage(view);
  const frame = rectBetween(source, INSET.frame, levels.grow);
  const scale = frame.width / INSET.source.width;
  setRect(insetParts.clip, frame);
  setRect(insetParts.paper, frame);
  setRect(insetParts.edge, frame);
  setRect(insetParts.source, source);
  write(insetParts.view, "transform", `translate(${frame.x.toFixed(2)} ${frame.y.toFixed(2)}) scale(${scale.toFixed(4)}) translate(${(-INSET.source.x).toFixed(2)} ${(-INSET.source.y).toFixed(2)})`);
  write(insetParts.lines, "d", cornerLines(source, frame));
  const assembled = (1 - Engine.smooth(0, 0.3, open)) * inset.fade;
  write(insetParts.group, "opacity", (levels.shown * assembled).toFixed(2));
  write(insetParts.guides, "opacity", (levels.guides * assembled).toFixed(2));
}

function readoutText() {
  const governor = Engine.governorState(engine);
  const turns = Math.round(governor.flywheelTurns * clock.run * clock.scale);
  const paused = clock.paused ? "paused · " : "";
  // The film has no load slider, so its readout names the load the governor is answering.
  const state = FILMED ? `load ${Math.round(engine.load * 100)}% · ` : paused;
  return `${state}strokes ${engine.strokes} · ${turns} rpm · balls ${Math.round(governor.ballAngle / Engine.DEGREE)}° · throttle ${Math.round(governor.throttle * 100)}%`;
}

function draw() {
  const pose = Engine.poseAt(engine.crank);
  // Reduced motion: the zoom frame is not born, it is simply there.
  if (!FILMED && !manual && still.matches && inset.age === null) inset.age = BIRTH_SECONDS;
  const assembled = 1 - Engine.smooth(0, 0.3, Explode.maxShare(explode));
  drawBeam(pose);
  drawMotion(pose);
  drawPiston(pose);
  drawPump(pose);
  drawValves(pose);
  drawGears(pose);
  drawGovernor(assembled);
  drawFlows(pose, assembled);
  drawTrace(pose);
  const text = apartReadout() ?? readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  write(stage, "data-stage", clock.paused ? "paused" : "running");
  drawApart(pose);
}

// ---- loop, pointer, keyboard ---------------------------------------------------------------------------

function tick(now) {
  const dt = clock.last ? Math.min((now - clock.last) / 1000, LONGEST_FRAME) : 1 / 60;
  clock.last = now;
  const flying = stepApart(dt);
  if (!still.matches) advance(dt);
  draw();
  const turning = !still.matches && (wantsToRun() || clock.run > 0);
  const growing = !still.matches && insetGrowing();
  clock.frame = clock.visible && (turning || flying || growing) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

function setPaused(paused) {
  clock.paused = paused;
  if (paused) clock.run = 0;
  pauseButton.setAttribute("aria-pressed", String(paused));
  pauseButton.textContent = paused ? "Run" : "Pause";
}

function togglePause() {
  if (apartBusy()) return;
  clock.stepping = false;
  setPaused(!clock.paused);
  say(clock.paused ? "Engine paused." : "Engine running.");
  draw();
  run();
}

// Reduced motion: no travel, the engine jumps to the end of the stroke.
function jumpOneStroke() {
  const from = engine.strokes;
  for (let guard = 0; guard < 2400 && engine.strokes === from; guard++) Engine.stepEngine(engine, 1 / 240);
  draw();
}

function playOneStroke() {
  if (apartBusy()) return;
  if (still.matches) {
    jumpOneStroke();
  } else {
    setPaused(false);
    clock.run = 1;
    clock.stepping = true;
    run();
  }
  say(`One stroke ${Engine.strokeAt(engine.crank).direction}.`);
}

function setLoad(share) {
  engine.load = Engine.clamp(share, 0, 1);
  loadSlider.value = String(Math.round(engine.load * 100));
  say(`Load ${Math.round(engine.load * 100)} per cent.`);
  draw();
  run();
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target === loadSlider) return;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    togglePause();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    playOneStroke();
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    setLoad(engine.load + (event.key === "ArrowUp" ? LOAD_STEP : -LOAD_STEP) / 100);
  }
}

if (!manual) {
  stage.addEventListener("click", togglePause);
  stage.addEventListener("keydown", onKey);
  pauseButton.addEventListener("click", togglePause);
  stepButton.addEventListener("click", playOneStroke);
  loadSlider.addEventListener("input", () => setLoad(Number(loadSlider.value) / 100));
  new IntersectionObserver(
    (entries) => {
      clock.visible = entries[entries.length - 1].isIntersecting;
      if (clock.visible) run();
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
  still.addEventListener("change", () => {
    draw();
    run();
  });
}
