// The exploded view, the sounds and the film hooks of the first-transistor figure. The build inlines
// this file right after live.js, inside the same block: it uses that file's clock, parts and helpers,
// and it ends with the start-up that brings the page to its first frame.
// Adapted from the Enigma figure (../enigma-anatomy/apart.js).

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
  if (explode.apart) return Explode.isResting(explode) ? "apart · paused" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function openApart(calm) {
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-hold", {});
  say("The device is apart in seven numbered assemblies. The currents are paused.");
}

function closeApart(calm) {
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-seated", {});
  say("The device is going back together.");
}

function toggleApart() {
  explode.time = clock.elapsed;
  if (explode.apart) closeApart(still.matches);
  else openApart(still.matches);
  draw();
  run();
}

function everyShare(test) {
  return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
}

// Advances the springs and reports whether anything is still in flight.
function stepApart(seconds) {
  if (Explode.isResting(explode)) return false;
  for (const event of Explode.stepExplode(explode, seconds)) {
    emit(`piece-${event.name}`, { piece: event.piece, number: Explode.PIECES[event.piece].number }, event.at);
    const arrived = (share) => !share.pending && (share.landed || share.crossed);
    if (event.name === "arrive" && everyShare((share) => share.target === 1 && arrived(share))) emit("apart-hold", {}, event.at);
    if (event.name === "land" && everyShare((share) => share.target === 0 && arrived(share))) {
      emit("apart-seated", {}, event.at);
      emit("amplify", { duration: 1.4 }, event.at + 0.35);
    }
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
  const centre = [EX.width / 2, EX.height / 2];
  if (EX.film) return { x: centre[0], y: centre[1], zoom: 1 };
  const fit = Math.min(1, (EX.width - 44) / EX.apart.width, (EX.height - 44) / EX.apart.height);
  const share = Transistor.smooth(0, 1, open);
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
    const share = name === "stand" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Transistor.smooth(0.5, 0.95, share).toFixed(2));
  }
}

function setBodyNumber(name, value) {
  if (document.body.style.getPropertyValue(name) !== value) document.body.style.setProperty(name, value);
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
  const least = Math.min(...Explode.LEAVE_ORDER.map((name) => Explode.shareOf(explode, name)));
  setBodyNumber("--tr-apart", Transistor.smooth(0.55, 0.95, least).toFixed(2));
  setBodyNumber("--tr-open", Transistor.smooth(0, 0.3, open).toFixed(2));
  write(stage, "data-open", open > 0.005 ? "" : null);
  write(apartButton, "aria-pressed", String(explode.apart));
  write(apartButton, "text", explode.apart ? "Put together" : "Take apart");
}

// ---- sound ---------------------------------------------------------------------------------------------
// The figure reports what happens as named events with a time on its own clock. The page plays them
// through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
// track offline (sound.mjs). The device itself is silent, so there is little to hear: a soft tap for the
// switch and for each part that leaves or lands, and a very soft low swell when the amplified current
// starts. No tones, nothing continuous, and a low master gain.

const sound = { on: false, context: null, master: null, bus: null, noise: null };
const MASTER_GAIN = 0.16;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const MODE_GAIN = 3;
const TAP_SECONDS = 0.07;
const SWELL_GAIN = 0.08;
const SWELL_LOW_PASS = 420;
const LIGHT_PIECES = ["foil", "spring", "leads"];
const decibels = (value) => 10 ** (value / 20);
const BODIES = {
  label: { modes: [[620, 0.004, 1], [1150, 0.003, 0.45]], attack: 0.004, blow: 0.004 },
  toggle: { modes: [[240, 0.006, 1], [480, 0.004, 0.45]], attack: 0.005, blow: 0.006 },
  part: { modes: [[380, 0.005, 1], [760, 0.0035, 0.4]], attack: 0.004, blow: 0.005 },
  light: { modes: [[900, 0.003, 1], [1600, 0.0022, 0.4]], attack: 0.003, blow: 0.003 },
  reseat: { modes: [[190, 0.008, 1], [380, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};
const LEVELS = { toggle: decibels(0), label: decibels(-3), part: decibels(-7), partLeaving: decibels(-10), light: decibels(-9), reseat: decibels(-3) };

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

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

// One tap: the noise of the blow fades in over a few milliseconds, never at once, and dies away; two
// low-Q resonances give it its body and are silent again within about 35 ms.
function tap(body, level) {
  const context = sound.context;
  const variation = variationOf();
  const start = context.currentTime + variation.late;
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

// The amplified current starting: low noise that rises and falls once, far quieter than any tap.
function swell(seconds) {
  const context = sound.context;
  const start = context.currentTime;
  const source = context.createBufferSource();
  const soft = context.createBiquadFilter();
  const level = context.createGain();
  source.buffer = sound.noise;
  source.loop = true;
  soft.type = "lowpass";
  soft.frequency.value = SWELL_LOW_PASS;
  soft.Q.value = 0.5;
  level.gain.setValueAtTime(0, start);
  level.gain.linearRampToValueAtTime(SWELL_GAIN, start + seconds / 2);
  level.gain.linearRampToValueAtTime(0, start + seconds);
  source.connect(soft).connect(level).connect(sound.bus);
  source.start(start, Math.random());
  source.stop(start + seconds + 0.05);
}

function partTap(detail, level) {
  const light = LIGHT_PIECES.includes(detail.piece);
  tap(light ? BODIES.light : BODIES.part, light ? level * decibels(-2) : level);
}

const VOICES = {
  "step-label": () => tap(BODIES.label, LEVELS.label),
  "bias-switch": () => tap(BODIES.toggle, LEVELS.toggle),
  amplify: (detail) => swell(detail.duration ?? 1.4),
  "piece-leave": (detail) => partTap(detail, LEVELS.partLeaving),
  "piece-land": (detail) => partTap(detail, LEVELS.part),
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

fillHistory();
if (query.get("apart") === "1") Explode.setApart(explode, true, true);
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__transistor = {
  advance(seconds) {
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds, !apartBusy());
    draw();
  },
  setApart(apart) {
    explode.time = clock.elapsed;
    if (apart) openApart(false);
    else closeApart(false);
  },
  holdWalk() {
    holdWalk();
  },
  walk(seconds) {
    startWalk(seconds);
  },
  birth(seconds) {
    birth.seconds = seconds;
  },
  setBias(on) {
    setBias(on);
  },
  setLevel(level) {
    setLevel(level);
  },
  camera(x, y, zoom, weight) {
    filmView.camera = { x, y, zoom };
    document.body.style.setProperty("--anatomy-weight", `${weight}px`);
    draw();
  },
  steps(opacity) {
    steps.shown = opacity;
    document.body.style.setProperty("--tr-steps", String(opacity));
  },
  detail(opacity) {
    document.body.style.setProperty("--tr-detail", String(opacity));
  },
  view() {
    return { width: EX.width, height: EX.height, apart: EX.apart, rest: EX.rest, detailLeft: detail.getBoundingClientRect().left };
  },
  takeEvents() {
    return eventLog.splice(0);
  },
  state() {
    const sample = Transistor.sampleAt(parameters, clock.signal);
    const gain = measured().gain;
    return {
      biasOn: parameters.biasOn,
      inputLevel: parameters.inputLevel,
      voltageGain: Math.round(gain.voltage * 1000) / 1000,
      powerGain: Math.round(gain.power * 100) / 100,
      clipped: gain.clipped,
      inputVolts: Math.round(sample.inputVolts * 10000) / 10000,
      outputVolts: Math.round(sample.outputVolts * 10000) / 10000,
      charges: parts.inflow.childElementCount,
      outflow: parts.outflow.childElementCount,
      walk: Math.round(walk.phase * 10000) / 10000,
      apart: explode.apart,
      open: Math.round(Explode.maxShare(explode) * 10000) / 10000,
      resting: Explode.isResting(explode),
      time: Math.round(clock.elapsed * 10000) / 10000,
      readout: readout.textContent,
    };
  },
};
