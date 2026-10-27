// The exploded view, the sounds and the film hooks of the Watt engine figure. The build inlines this file
// right after live.js, inside the same block: it uses that file's clock, parts and helpers, and it ends
// with the start-up that brings the page to its first frame. Adapted from the Enigma figure.

const EX = CONFIG.explode;
const explode = Explode.createExplode();
const world = one("world");
const lens = one("lens");
const itemNodes = Array.from(world.children);
const badges = Array.from(document.querySelectorAll("[data-badge]"));
const apartButton = document.querySelector("[data-apart]");
const soundButton = document.querySelector("[data-sound]");
const worldZero = iso([0, 0, 0], P);
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
  const tip = iso(axis, P);
  return [tip[0] - worldZero[0], tip[1] - worldZero[1]];
});
const apartState = { painted: itemNodes.map((_, index) => index) };
const filmView = { camera: null };
const eventLog = [];
const FLIGHT_SECONDS = Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5;

// ---- state ---------------------------------------------------------------------------------------------

function apartBusy() {
  return explode.apart || !Explode.isResting(explode);
}

function apartReadout() {
  if (explode.apart) return Explode.isResting(explode) ? "apart · engine stopped" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function openApart(calm) {
  clock.stepping = false;
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-hold", {});
  say("The engine is apart in ten numbered assemblies. It is stopped.");
}

function closeApart(calm) {
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-seated", {});
  say("The engine is going back together.");
}

function toggleApart() {
  if (explode.apart) closeApart(still.matches);
  else openApart(still.matches);
  draw();
  run();
}

function everyShare(test) {
  return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
}

function stepApart(seconds) {
  if (Explode.isResting(explode)) return false;
  for (const event of Explode.stepExplode(explode, seconds)) {
    emit(`piece-${event.name}`, { piece: event.piece, number: Explode.PIECES[event.piece].number }, event.at);
    const arrived = (share) => !share.pending && (share.landed || share.crossed);
    if (event.name === "arrive" && everyShare((share) => share.target === 1 && arrived(share))) emit("apart-hold", {}, event.at);
    if (event.name === "land" && everyShare((share) => share.target === 0 && arrived(share))) emit("apart-seated", {}, event.at);
  }
  return true;
}

// ---- drawing -------------------------------------------------------------------------------------------

function sameList(a, b) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

// Re-appends the items only when the painter's order really changed.
function paintItems(shifts) {
  const assembled = Explode.isResting(explode) && !explode.apart;
  const order = assembled ? itemNodes.map((_, index) => index) : Explode.paintOrder(EX.items, shifts, AXES).order;
  if (sameList(order, apartState.painted)) return;
  const fragment = document.createDocumentFragment();
  for (const index of order) fragment.appendChild(itemNodes[index]);
  world.appendChild(fragment);
  apartState.painted = order;
}

// The page pulls back just far enough to keep the apart pose inside the card; the film sets its own camera.
function worldView(open) {
  if (filmView.camera) return filmView.camera;
  const rest = restView();
  if (EX.film) return rest;
  const fit = Math.min(1, (EX.width - 44) / EX.apart.width, (EX.height - 44) / EX.apart.height);
  const share = Engine.smooth(0, 1, open);
  return { x: rest.x + (EX.apart.x - rest.x) * share, y: rest.y + (EX.apart.y - rest.y) * share, zoom: rest.zoom + (fit - rest.zoom) * share };
}

function placeOnStage(node, point, view, opacity) {
  const spot = iso(point, P);
  const place = `${(((EX.width / 2 + (spot[0] - view.x) * view.zoom) / EX.width) * 100).toFixed(2)}%`;
  const drop = `${(((EX.height / 2 + (spot[1] - view.y) * view.zoom) / EX.height) * 100).toFixed(2)}%`;
  if (node.style.left !== place) node.style.left = place;
  if (node.style.top !== drop) node.style.top = drop;
  if (node.style.opacity !== opacity) node.style.opacity = opacity;
}

function placeBadges(shifts, view) {
  for (const badge of badges) {
    const name = badge.getAttribute("data-badge");
    const anchor = EX.anchors[name];
    const shift = shifts[name];
    const share = name === "base" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Engine.smooth(0.5, 0.95, share).toFixed(2));
  }
}

// The film's six step numbers, each beside the part its step is about.
function placeStepMarks(pose, view, open) {
  if (!parts.stepMarks.length) return;
  const levels = Engine.stepsAt(pose.stroke.share);
  parts.stepMarks.forEach((mark, index) => {
    placeOnStage(mark, CONFIG.stepPoints[index], view, (levels[index] * steps.shown * (1 - open)).toFixed(2));
  });
}

function drawApart(pose) {
  const shifts = Explode.shiftsOf(explode);
  const open = Math.min(1, Math.max(0, Explode.maxShare(explode)));
  itemNodes.forEach((node, index) => {
    const shift = shifts[EX.items[index].piece];
    const moved = Math.abs(shift[0]) + Math.abs(shift[1]) + Math.abs(shift[2]) > 1e-6;
    write(node, "transform", moved ? translateAlong(P, shift) : null);
  });
  paintItems(shifts);
  const view = worldView(open);
  const centredAtRest = view.zoom === 1 && view.x === EX.width / 2 && view.y === EX.height / 2;
  const centred = `translate(${EX.width / 2} ${EX.height / 2}) scale(${view.zoom.toFixed(4)}) translate(${(-view.x).toFixed(2)} ${(-view.y).toFixed(2)})`;
  write(lens, "transform", centredAtRest ? null : centred);
  placeBadges(shifts, view);
  placeStepMarks(pose, view, open);
  drawInset(view, open);
  const least = Math.min(...Explode.LEAVE_ORDER.map((name) => Explode.shareOf(explode, name)));
  const shown = Engine.smooth(0.55, 0.95, least).toFixed(2);
  if (document.body.style.getPropertyValue("--we-apart") !== shown) document.body.style.setProperty("--we-apart", shown);
  // The trace under the film's engine leaves as soon as the first part moves, before the legend comes in.
  const leaving = Engine.smooth(0, 0.3, open).toFixed(2);
  if (document.body.style.getPropertyValue("--we-open") !== leaving) document.body.style.setProperty("--we-open", leaving);
  write(stage, "data-open", open > 0.005 ? "" : null);
  write(apartButton, "aria-pressed", String(explode.apart));
  const label = explode.apart ? "Put together" : "Take apart";
  if (apartButton.textContent !== label) apartButton.textContent = label;
}

// ---- sound ---------------------------------------------------------------------------------------------
// The engine reports what happens as named events with a time on its own clock. The page plays them
// through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
// track offline (sound.mjs).

const sound = { on: false, context: null, master: null, bus: null, noise: null };

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

// The same recipe as the film's track (sound.mjs): short, soft taps of noise that fade in over a few
// milliseconds, heard through two heavily damped resonances, and one quiet breath of low noise per stroke
// that rises and falls. Nothing drones, and the master gain is low.
const MASTER_GAIN = 0.16;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const MODE_GAIN = 3;
const TAP_SECONDS = 0.07;
const decibels = (value) => 10 ** (value / 20);
const BODIES = {
  valve: { modes: [[820, 0.0035, 1], [1450, 0.0025, 0.5]], attack: 0.003, blow: 0.003 },
  gear: { modes: [[1100, 0.003, 1], [1900, 0.002, 0.4]], attack: 0.003, blow: 0.0025 },
  part: { modes: [[260, 0.007, 1], [520, 0.005, 0.4]], attack: 0.005, blow: 0.006 },
  reseat: { modes: [[170, 0.009, 1], [340, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};
const LEVELS = { valve: decibels(-2), gear: decibels(-16), part: decibels(-6), partLeaving: decibels(-9), reseat: decibels(-3), chuff: decibels(-15) };
// A puff lasts half of its stroke at most, so at running speed each one ends in silence before the next.
const CHUFF = { frequency: 320, sharpness: 0.8, rise: 0.3, longest: 1.2, share: 0.5 };

// Everything goes through a gentle high-pass and a gentle low-pass, then one low master gain.
function audioReady() {
  if (sound.context) return sound.context;
  const context = new AudioContext();
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  sound.context = context;
  sound.noise = buffer;
  sound.master = context.createGain();
  sound.master.gain.value = MASTER_GAIN;
  sound.master.connect(context.destination);
  const dull = context.createBiquadFilter();
  dull.type = "lowpass";
  dull.frequency.value = LOW_PASS;
  dull.Q.value = 0.5;
  dull.connect(sound.master);
  sound.bus = context.createBiquadFilter();
  sound.bus.type = "highpass";
  sound.bus.frequency.value = HIGH_PASS;
  sound.bus.Q.value = 0.5;
  sound.bus.connect(dull);
  return context;
}

// No two taps are the same: a few per cent of pitch, a couple of decibels, a few milliseconds.
function variationOf() {
  const spread = () => Math.random() * 2 - 1;
  return { pitch: 1 + spread() * 0.07, level: decibels(spread() * 2), late: Math.random() * 0.004 };
}

function noiseSource() {
  const source = sound.context.createBufferSource();
  source.buffer = sound.noise;
  source.loop = true;
  return source;
}

// One tap: the noise of the blow fades in over a few milliseconds, never at once, and dies away; two
// low-Q resonances give it its body and are silent again within about 35 ms.
function tap(body, level) {
  const context = sound.context;
  const variation = variationOf();
  const start = context.currentTime + variation.late;
  const source = noiseSource();
  const blow = context.createGain();
  blow.gain.setValueAtTime(0, start);
  blow.gain.linearRampToValueAtTime(1, start + body.attack);
  blow.gain.setTargetAtTime(0, start + body.attack, body.blow);
  source.connect(blow);
  for (const [frequency, ringTime, share] of body.modes) {
    const mode = context.createBiquadFilter();
    const out = context.createGain();
    mode.type = "bandpass";
    mode.frequency.value = frequency * variation.pitch;
    mode.Q.value = Math.max(1, Math.PI * frequency * ringTime);
    out.gain.value = share * level * variation.level * MODE_GAIN;
    blow.connect(mode).connect(out).connect(sound.bus);
  }
  source.start(start, Math.random() * 0.5);
  source.stop(start + TAP_SECONDS);
}

// One breath of low noise for a stroke: it swells gently, then falls away to nothing before the next.
function chuff(detail) {
  const context = sound.context;
  const variation = variationOf();
  const length = Math.min(CHUFF.longest, detail.duration * CHUFF.share);
  const start = context.currentTime;
  const source = noiseSource();
  const band = context.createBiquadFilter();
  const swell = context.createGain();
  band.type = "bandpass";
  band.frequency.value = CHUFF.frequency * variation.pitch * (detail.direction === "down" ? 1 : 0.9);
  band.Q.value = CHUFF.sharpness;
  swell.gain.setValueAtTime(0, start);
  swell.gain.linearRampToValueAtTime(LEVELS.chuff * variation.level, start + length * CHUFF.rise);
  swell.gain.linearRampToValueAtTime(0, start + length);
  source.connect(band).connect(swell).connect(sound.bus);
  source.start(start, Math.random());
  source.stop(start + length + 0.02);
}

const VOICES = {
  valve: () => tap(BODIES.valve, LEVELS.valve),
  gear: () => tap(BODIES.gear, LEVELS.gear),
  chuff,
  "piece-leave": () => tap(BODIES.part, LEVELS.partLeaving),
  "piece-land": () => tap(BODIES.part, LEVELS.part),
  "apart-seated": () => tap(BODIES.reseat, LEVELS.reseat),
};

function toggleSound() {
  sound.on = !sound.on;
  if (sound.on) audioReady().resume();
  soundButton.setAttribute("aria-pressed", String(sound.on));
  soundButton.textContent = sound.on ? "Sound on" : "Sound";
}

// ---- start ---------------------------------------------------------------------------------------------

if (!manual) {
  stage.addEventListener("keydown", (event) => {
    if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.key.toUpperCase() !== "E") return;
    event.preventDefault();
    toggleApart();
  });
  apartButton.addEventListener("click", toggleApart);
  soundButton.addEventListener("click", toggleSound);
}

const startLoad = Number(query.get("load"));
if (query.has("load") && Number.isFinite(startLoad)) {
  engine.load = Engine.clamp(startLoad / 100, 0, 1);
  Engine.settleEngine(engine);
  loadSlider.value = String(Math.round(engine.load * 100));
}
setPaused(clock.paused);
if (query.get("apart") === "1") Explode.setApart(explode, true, true);
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__watt = {
  advance(seconds) {
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds);
    draw();
  },
  setScale(scale) {
    clock.scale = scale;
  },
  setLoad(share) {
    engine.load = Engine.clamp(share, 0, 1);
  },
  setPaused(paused) {
    setPaused(paused);
  },
  setApart(apart) {
    explode.time = clock.elapsed;
    if (apart) openApart(false);
    else closeApart(false);
  },
  camera(x, y, zoom, weight) {
    filmView.camera = { x, y, zoom };
    document.body.style.setProperty("--anatomy-weight", `${weight}px`);
    draw();
  },
  steps(opacity) {
    steps.shown = opacity;
    document.body.style.setProperty("--we-steps", String(opacity));
  },
  // The zoom frame: seconds since its birth began (null before it) and how much of it still shows.
  inset(age, fade) {
    inset.age = age;
    inset.fade = fade;
  },
  project(point) {
    return iso(point, P);
  },
  view() {
    return { width: EX.width, height: EX.height, apart: EX.apart };
  },
  takeEvents() {
    return eventLog.splice(0);
  },
  state() {
    const stroke = Engine.strokeAt(engine.crank);
    const pose = Engine.poseAt(engine.crank);
    return {
      strokes: engine.strokes,
      direction: stroke.direction,
      share: Math.round(stroke.share * 10000) / 10000,
      speed: Math.round(engine.speed * 10000) / 10000,
      load: engine.load,
      throttle: Math.round(Engine.throttleFor(engine.ballAngle) * 10000) / 10000,
      ballDegrees: Math.round((engine.ballAngle / Engine.DEGREE) * 100) / 100,
      pistonZ: Math.round(pose.pistonZ * 100) / 100,
      sunTurns: Math.round((pose.sunAngle / Engine.TAU) * 1000) / 1000,
      valves: pose.valves,
      paused: clock.paused,
      apart: explode.apart,
      open: Math.round(Explode.maxShare(explode) * 10000) / 10000,
      resting: Explode.isResting(explode),
      time: Math.round(clock.elapsed * 10000) / 10000,
      readout: readout.textContent,
    };
  },
};
