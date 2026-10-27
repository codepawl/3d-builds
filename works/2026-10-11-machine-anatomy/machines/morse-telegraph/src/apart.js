// The exploded view, the sounds and the film hooks of the Morse telegraph figure. The build inlines this
// file right after live.js, inside the same block: it uses that file's clock, parts and helpers, and it
// ends with the start-up that brings the page to its first frame. Adapted from the Enigma figure.

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
const apartState = { armed: false, painted: itemNodes.map((_, index) => index) };
const filmView = { camera: null };
const eventLog = [];
const FLIGHT_SECONDS = Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5;

// ---- state ---------------------------------------------------------------------------------------------

function apartBusy() {
  return apartState.armed || explode.apart || !Explode.isResting(explode);
}

function apartReadout() {
  if (apartState.armed) return "finishing the letter · then apart";
  if (explode.apart) return Explode.isResting(explode) ? "apart · the line is open" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function openApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-hold", {});
  say("The telegraph is apart in ten numbered assemblies. Sending is paused.");
}

function closeApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-seated", {});
  say("The telegraph is going back together.");
}

// Arming: the model only comes apart from rest, so a letter that is going out is finished first.
function setApartWanted(wanted) {
  const current = explode.apart || apartState.armed;
  if (wanted === current) return;
  if (!wanted && apartState.armed) apartState.armed = false;
  else if (!wanted) closeApart(still.matches);
  else if (still.matches) openApart(true);
  else {
    handUp();
    apartState.armed = true;
  }
  draw();
  run();
}

function toggleApart() {
  setApartWanted(!(explode.apart || apartState.armed));
}

function everyShare(test) {
  return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
}

// While armed, the telegraph's own clock keeps running until the last mark is on the tape.
function finishBeforeApart(seconds) {
  const before = clock.beats;
  clock.beats += seconds / clock.pace;
  for (const event of Morse.eventsBetween(line, before, clock.beats)) emit(event.name, {}, clock.elapsed + (event.at - before) * clock.pace);
}

function stepApart(seconds) {
  if (apartState.armed) {
    if (Morse.isIdle(line, clock.beats)) openApart(false);
    else finishBeforeApart(seconds);
  }
  if (Explode.isResting(explode)) return apartState.armed;
  for (const event of Explode.stepExplode(explode, seconds)) {
    emit(`piece-${event.name}`, { piece: event.piece, number: Explode.PIECES[event.piece].number }, event.at);
    const arrived = (share) => !share.pending && (share.landed || share.crossed);
    if (event.name === "arrive" && everyShare((share) => share.target === 1 && arrived(share))) emit("apart-hold", {}, event.at);
    if (event.name === "land" && everyShare((share) => share.target === 0 && arrived(share))) emit("apart-seated", {}, event.at);
  }
  if (Explode.isResting(explode) && !explode.apart && !manual) quietTour();
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
  const centre = [EX.width / 2, EX.height / 2];
  if (EX.film) return { x: centre[0], y: centre[1], zoom: 1 };
  const fit = Math.min(1, (EX.width - 44) / EX.apart.width, (EX.height - 44) / EX.apart.height);
  const share = Morse.smooth(0, 1, open);
  return { x: centre[0] + (EX.apart.x - centre[0]) * share, y: centre[1] + (EX.apart.y - centre[1]) * share, zoom: 1 + (fit - 1) * share };
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
    const share = name === "bench" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Morse.smooth(0.5, 0.95, share).toFixed(2));
  }
}

// Where each of the five step numbers sits: beside the part that step is about.
function stepPoints() {
  const K = SIZES.key;
  const R = SIZES.relay;
  const G = SIZES.register;
  const span = Layout.lineSpans()[0];
  const onLine = span[Math.floor(span.length / 2)];
  return [
    [K.knob.x + 4, K.pivot[1] + 14, K.knob.top],
    [K.anvil.x, K.pivot[1] - 24, SIZES.deck],
    [onLine[0], onLine[1], onLine[2] + 7],
    [R.pad.x0 - 2, R.pad.y1 + 8, R.lever.z1 + 2],
    [G.stylus.x + 12, G.pivot[1] + 22, G.stylus.top],
  ];
}

const STEP_POINTS = stepPoints();

function placeStepMarks(view, open) {
  if (!parts.stepMarks.length) return;
  const levels = Morse.stepsAt(line, clock.beats);
  parts.stepMarks.forEach((mark, index) => {
    placeOnStage(mark, STEP_POINTS[index], view, (levels[index] * steps.shown * (1 - open)).toFixed(2));
  });
}

function drawApart() {
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
  placeStepMarks(view, open);
  const least = Math.min(...Explode.LEAVE_ORDER.map((name) => Explode.shareOf(explode, name)));
  const shown = Morse.smooth(0.55, 0.95, least).toFixed(2);
  if (document.body.style.getPropertyValue("--mt-apart") !== shown) document.body.style.setProperty("--mt-apart", shown);
  // The film's trace under the figure makes way as soon as the first assembly moves: the camera needs the room.
  const leaving = Morse.smooth(0.02, 0.3, open).toFixed(2);
  if (document.body.style.getPropertyValue("--mt-leaving") !== leaving) document.body.style.setProperty("--mt-leaving", leaving);
  write(stage, "data-open", open > 0.005 ? "" : null);
  const wanted = explode.apart || apartState.armed;
  write(apartButton, "aria-pressed", String(wanted));
  const label = wanted ? "Put together" : "Take apart";
  if (apartButton.textContent !== label) apartButton.textContent = label;
}

// ---- sound ---------------------------------------------------------------------------------------------
// The telegraph reports what happens as named events with a time on its own clock. The page plays them
// through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
// track offline (sound.mjs).

const sound = { on: false, context: null, master: null, bus: null, noise: null };

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

// The same recipe as the film's track (sound.mjs): every sound is a short, soft tap, a few milliseconds
// of noise that fades in and is heard through two heavily damped resonances. Nothing is continuous and
// the master gain is low.
const MASTER_GAIN = 0.2;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const MODE_GAIN = 3;
const TAP_SECONDS = 0.07;
const decibels = (value) => 10 ** (value / 20);
const BODIES = {
  // The sending key: a dull wooden tap down on its contact and a duller one back on its stop.
  click: { modes: [[330, 0.005, 1], [690, 0.0035, 0.45]], attack: 0.004, blow: 0.005 },
  clack: { modes: [[250, 0.006, 1], [520, 0.004, 0.4]], attack: 0.005, blow: 0.006 },
  tick: { modes: [[980, 0.003, 1], [1700, 0.002, 0.45]], attack: 0.003, blow: 0.0028 },
  // The receiving armature, which is what an operator listened to: brass on brass. It closes with a
  // click and falls back with a clack about a fourth lower, so the two ends of every mark can be told apart.
  sounderClick: { modes: [[1240, 0.006, 1], [2150, 0.004, 0.5], [640, 0.005, 0.35]], attack: 0.003, blow: 0.004 },
  sounderClack: { modes: [[900, 0.007, 1], [1560, 0.0045, 0.45], [470, 0.006, 0.4]], attack: 0.004, blow: 0.005 },
  wood: { modes: [[260, 0.007, 1], [520, 0.005, 0.4]], attack: 0.005, blow: 0.006 },
  reseat: { modes: [[170, 0.009, 1], [340, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};
// How loud each tap peaks against the register's armature closing, which is the loudest sound there is.
// The clockwork that pulls the paper is silent, so nothing ticks across the rhythm of the code.
const LEVELS = { sounder: decibels(0), sounderBack: decibels(-1), key: decibels(-7.5), keyBack: decibels(-10.5), relay: decibels(-20), relayBack: decibels(-24), part: decibels(-16), partLeaving: decibels(-19), reseat: decibels(-13) };

// Everything goes through a gentle high-pass and a gentle low-pass, then one low master gain.
function audioReady() {
  if (sound.context) return sound.context;
  const context = new AudioContext();
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
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

// One tap: the noise of the blow fades in over a few milliseconds, never at once, and dies away; two
// low-Q resonances give it its body and are silent again within about 35 ms.
function tap(body, level, delay = 0) {
  const context = sound.context;
  const variation = variationOf();
  const start = context.currentTime + delay + variation.late;
  const source = context.createBufferSource();
  const blow = context.createGain();
  source.buffer = sound.noise;
  source.loop = true;
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

const VOICES = {
  "key-down": () => tap(BODIES.click, LEVELS.key),
  "key-up": () => tap(BODIES.clack, LEVELS.keyBack),
  "relay-pull": () => tap(BODIES.tick, LEVELS.relay),
  "relay-release": () => tap(BODIES.tick, LEVELS.relayBack),
  // The register's armature closing and releasing: the click and the clack of every dot and dash.
  "stylus-strike": () => tap(BODIES.sounderClick, LEVELS.sounder),
  "stylus-release": () => tap(BODIES.sounderClack, LEVELS.sounderBack),
  "piece-leave": () => tap(BODIES.wood, LEVELS.partLeaving),
  "piece-land": () => tap(BODIES.wood, LEVELS.part),
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

clock.touring = !manual && tourAllowed && !still.matches;
if (query.get("apart") === "1") Explode.setApart(explode, true, true);
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__morse = {
  advance(seconds) {
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds);
    draw();
  },
  setPace(seconds) {
    clock.pace = seconds;
  },
  send(text) {
    for (const character of text) sendCharacter(character);
  },
  press() {
    return Morse.pressKey(line, clock.beats);
  },
  release() {
    return Morse.releaseKey(line, clock.beats);
  },
  clearTape,
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
    document.body.style.setProperty("--mt-steps", String(opacity));
  },
  // The zoom frame: how many seconds ago its birth began (negative before it), and how much of it shows.
  inset(seconds, shown) {
    inset.seconds = seconds;
    inset.shown = shown;
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
    const now = Morse.stateAt(line, clock.beats);
    const marks = Morse.marksAt(line, clock.beats);
    return {
      beats: Math.round(clock.beats * 1000) / 1000,
      sent: sending.sent,
      read: readText(Morse.readTape(marks, clock.beats)),
      marks: marks.length,
      closed: now.closed,
      marking: now.marking,
      idle: Morse.isIdle(line, clock.beats),
      apart: explode.apart,
      open: Math.round(Explode.maxShare(explode) * 10000) / 10000,
      resting: Explode.isResting(explode),
      time: Math.round(clock.elapsed * 10000) / 10000,
      readout: readout.textContent,
    };
  },
};
