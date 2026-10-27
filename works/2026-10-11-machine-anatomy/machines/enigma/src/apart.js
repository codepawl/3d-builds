// The exploded view, the sounds and the film hooks of the Enigma figure. The build inlines this file
// right after live.js, inside the same block: it uses that file's clock, parts and helpers, and it ends
// with the start-up that brings the page to its first frame. Adapted from the Jacquard loom figure.

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
  if (apartState.armed) return "finishing the key · then apart";
  if (explode.apart) return Explode.isResting(explode) ? "apart · typing paused" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function openApart(calm) {
  apartState.armed = false;
  typing.queue.length = 0;
  typing.picked = null;
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-hold", {});
  say("The machine is apart in eleven numbered assemblies. Typing is paused.");
}

function closeApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-seated", {});
  say("The machine is going back together.");
}

// Arming: the machine only comes apart from rest, so a key that is down is let up first.
function setApartWanted(wanted) {
  const current = explode.apart || apartState.armed;
  if (wanted === current) return;
  if (!wanted && apartState.armed) apartState.armed = false;
  else if (!wanted) closeApart(still.matches);
  else if (still.matches) {
    clock.phase = 1;
    openApart(true);
  } else apartState.armed = true;
  draw();
  run();
}

function toggleApart() {
  setApartWanted(!(explode.apart || apartState.armed));
}

function everyShare(test) {
  return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
}

function stepApart(seconds) {
  if (apartState.armed && clock.phase >= 1) openApart(false);
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
  const share = Enigma.smooth(0, 1, open);
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
    const share = name === "case" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Enigma.smooth(0.5, 0.95, share).toFixed(2));
  }
}

// Where each of the six step numbers sits for this press: beside the part that step is about.
function stepPoints(press) {
  const key = Layout.keyPoint(press.letter);
  const socket = Layout.socketPoint(Enigma.letterOf(press.path.plugIn));
  const lamp = Layout.lampPoint(press.output);
  const wheel = Layout.rotorParts(1).fingerWheel;
  return [
    [key[0] - 10, key[1] + 4, key[2]],
    [wheel.x1, STACK.y, STACK.z + wheel.r + 7],
    [socket[0] + 8, socket[1], socket[2] + 2],
    [STACK.entry.x1 + 2, STACK.y + 16, STACK.z - 20],
    [STACK.reflector.x0, STACK.y, STACK.z + STACK.reflector.r + 6],
    [lamp[0] - 10, lamp[1] + 4, lamp[2]],
  ];
}

function placeStepMarks(view, open) {
  if (!parts.stepMarks.length) return;
  const press = typing.current;
  const levels = press ? Enigma.stepsAt(clock.phase) : null;
  const points = press ? stepPoints(press) : null;
  parts.stepMarks.forEach((mark, index) => {
    if (!press) {
      if (mark.style.opacity !== "0") mark.style.opacity = "0";
      return;
    }
    placeOnStage(mark, points[index], view, (levels[index] * steps.shown * (1 - open)).toFixed(2));
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
  const shown = Enigma.smooth(0.55, 0.95, least).toFixed(2);
  if (document.body.style.getPropertyValue("--en-apart") !== shown) document.body.style.setProperty("--en-apart", shown);
  write(stage, "data-open", open > 0.005 ? "" : null);
  const wanted = explode.apart || apartState.armed;
  write(apartButton, "aria-pressed", String(wanted));
  const label = wanted ? "Put together" : "Take apart";
  if (apartButton.textContent !== label) apartButton.textContent = label;
}

// ---- sound ---------------------------------------------------------------------------------------------
// The machine reports what happens as named events with a time on its own clock. The page plays them
// through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
// track offline (sound.mjs).

const sound = { on: false, context: null, master: null, bus: null, noise: null };
const PAN_WIDTH = 110;

const CUES = [
  [T.keyDown[1] - 0.02, "key-down"],
  [T.step[0] + 0.07, "rotor-step"],
  [T.lamp[0], "lamp-on"],
  [T.keyUp[1] - 0.02, "key-up"],
];

function cueDetail(name) {
  const press = typing.current;
  const keyPan = Layout.spots[press.letter].x / PAN_WIDTH;
  if (name === "rotor-step") return { count: press.stepped.filter(Boolean).length };
  if (name === "lamp-on") return { letter: press.output, duration: (T.keyUp[0] - T.lamp[0]) * clock.pressSeconds, pan: Layout.spots[press.output].x / PAN_WIDTH };
  return { letter: press.letter, pan: keyPan };
}

// Called by advance() for every stretch of a press it plays: `at` is the clock time at phase `from`.
function soundEvents(from, to, at) {
  for (const [phase, name] of CUES) {
    if (from < phase && to >= phase) emit(name, cueDetail(name), at + (phase - from) * clock.pressSeconds);
  }
}

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

// The same recipe as the film's track (sound.mjs): every sound is a short, soft tap, a few milliseconds
// of noise that fades in and is heard through two heavily damped resonances. Nothing is continuous, the
// lamp is silent, and the master gain is low.
const MASTER_GAIN = 0.16;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const MODE_GAIN = 3;
const TAP_SECONDS = 0.07;
const STEP_SECOND_AFTER = 0.028;
const decibels = (value) => 10 ** (value / 20);
const BODIES = {
  key: { modes: [[210, 0.006, 1], [430, 0.004, 0.45]], attack: 0.005, blow: 0.006 },
  release: { modes: [[290, 0.005, 1], [560, 0.0035, 0.4]], attack: 0.004, blow: 0.005 },
  tik: { modes: [[820, 0.0035, 1], [1450, 0.0025, 0.5]], attack: 0.003, blow: 0.003 },
  tk: { modes: [[1100, 0.003, 1], [1900, 0.002, 0.4]], attack: 0.003, blow: 0.0025 },
  wood: { modes: [[260, 0.007, 1], [520, 0.005, 0.4]], attack: 0.005, blow: 0.006 },
  reseat: { modes: [[170, 0.009, 1], [340, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};
const LEVELS = { key: decibels(0), step: decibels(-4), stepSecond: decibels(-10), part: decibels(-6), partLeaving: decibels(-9), reseat: decibels(-3), release: decibels(-10) };

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
  "key-down": () => tap(BODIES.key, LEVELS.key),
  "rotor-step": (detail) => {
    for (let rotor = 0; rotor < detail.count; rotor++) {
      tap(BODIES.tik, LEVELS.step, rotor * 0.045);
      tap(BODIES.tk, LEVELS.stepSecond, rotor * 0.045 + STEP_SECOND_AFTER);
    }
  },
  "key-up": () => tap(BODIES.release, LEVELS.release),
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

const startPositions = (query.get("positions") ?? "").toUpperCase();
if (/^[A-Z]{3}$/.test(startPositions)) Enigma.setPositions(machine, startPositions);
clock.touring = !manual && tourAllowed && !still.matches;
if (query.get("apart") === "1") Explode.setApart(explode, true, true);
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__enigma = {
  advance(seconds) {
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds);
    draw();
  },
  setTyping(on) {
    clock.touring = on;
  },
  setPressSeconds(seconds) {
    clock.pressSeconds = seconds;
  },
  type(text) {
    typing.queue.push(...text);
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
    document.body.style.setProperty("--en-steps", String(opacity));
  },
  trace() {
    return typing.current ? Enigma.traceStages(machine, typing.current) : [];
  },
  detail(opacity) {
    document.body.style.setProperty("--en-detail", String(opacity));
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
    return {
      positions: Enigma.positionsText(machine.positions),
      input: typing.input,
      output: typing.output,
      phase: Math.round(clock.phase * 10000) / 10000,
      apart: explode.apart,
      open: Math.round(Explode.maxShare(explode) * 10000) / 10000,
      resting: Explode.isResting(explode),
      time: Math.round(clock.elapsed * 10000) / 10000,
      readout: readout.textContent,
    };
  },
};
