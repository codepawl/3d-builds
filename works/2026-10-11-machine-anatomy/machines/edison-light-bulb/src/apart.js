// The exploded view, the sounds and the film hooks of the light bulb figure. The build inlines this file
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
const apartState = { armed: false, painted: itemNodes.map((_, index) => index) };
const eventLog = [];
const FLIGHT_SECONDS = Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5;
const DARK_ENOUGH = 0.03;

// ---- state ---------------------------------------------------------------------------------------------

function apartWanted() {
  return explode.apart || apartState.armed;
}

function apartBusy() {
  return apartState.armed || explode.apart || !Explode.isResting(explode);
}

function apartReadout() {
  if (apartState.armed) return "switching off · then apart";
  if (explode.apart) return Explode.isResting(explode) ? "apart · nine assemblies" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function openApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-hold", {});
  say("The lamp is apart in nine numbered assemblies.");
}

function closeApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: FLIGHT_SECONDS });
  if (calm) emit("apart-seated", {});
  say("The lamp is going back together.");
}

// Arming: the lamp only comes apart dark and with the zoom frame gone, so it is switched off first.
function setApartWanted(wanted) {
  if (wanted === apartWanted()) return;
  if (!wanted && apartState.armed) apartState.armed = false;
  else if (!wanted) closeApart(still.matches);
  else {
    Lamp.setSwitch(lamp, false);
    if (still.matches) {
      Lamp.step(lamp, STILL_SECONDS);
      zoom.shown = 0;
      openApart(true);
    } else apartState.armed = true;
  }
  draw();
  run();
}

function toggleApart() {
  setApartWanted(!apartWanted());
}

function everyShare(test) {
  return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
}

function readyToOpen() {
  return Lamp.brightnessOf(lamp.temperature) < DARK_ENOUGH && lamp.turn === 0 && zoom.shown < 0.01;
}

function stepApart(seconds) {
  if (apartState.armed && readyToOpen()) openApart(false);
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

// The view pulls back just far enough to keep the apart pose inside the card.
function worldView(open) {
  const centre = [EX.width / 2, EX.height / 2];
  const fit = Math.min(1, (EX.width - EX.margin.x) / EX.apart.width, (EX.height - EX.margin.y) / EX.apart.height);
  const share = Lamp.smooth(0, 1, open);
  const apartY = EX.apart.y + EX.margin.lift / fit;
  return { x: centre[0] + (EX.apart.x - centre[0]) * share, y: centre[1] + (apartY - centre[1]) * share, zoom: 1 + (fit - 1) * share };
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
    const share = name === "circuit" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Lamp.smooth(0.5, 0.95, share).toFixed(2));
  }
}

function placeStepMarks(view, open) {
  if (!parts.stepMarks.length) return;
  const levels = Lamp.stepLevels(lamp);
  parts.stepMarks.forEach((mark, index) => placeOnStage(mark, CONFIG.stepPoints[index], view, (levels[index] * steps.shown * (1 - open)).toFixed(2)));
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
  drawZoom(view);
  const least = Math.min(...Explode.LEAVE_ORDER.map((name) => Explode.shareOf(explode, name)));
  const legend = Lamp.smooth(0.55, 0.95, least).toFixed(2);
  if (document.body.style.getPropertyValue("--lb-apart") !== legend) document.body.style.setProperty("--lb-apart", legend);
  write(stage, "data-open", open > 0.005 ? "" : null);
  write(apartButton, "aria-pressed", String(apartWanted()));
  write(apartButton, "text", apartWanted() ? "Put together" : "Take apart");
  for (const button of [switchButton, airButton, mendButton]) write(button, "disabled", apartBusy() ? "" : null);
}

// ---- sound ---------------------------------------------------------------------------------------------
// The figure reports what happens as named events with a time on its own clock. The page plays them
// through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
// track offline (sound.mjs).

const sound = { on: false, context: null, master: null, bus: null, noise: null };

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

// The same recipe as the film's track (sound.mjs): every sound is a short, soft tap, a few milliseconds
// of noise that fades in and is heard through two heavily damped resonances. The only longer sound is
// the faint swell of filtered noise as the filament heats, far below the click. Nothing is continuous
// and the master gain is low.
const MASTER_GAIN = 0.16;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const MODE_GAIN = 3;
const TAP_SECONDS = 0.07;
const SWELL_LOW_PASS = 650;
const decibels = (value) => 10 ** (value / 20);
const BODIES = {
  switchOn: { modes: [[330, 0.005, 1], [720, 0.0035, 0.45]], attack: 0.004, blow: 0.005 },
  switchOff: { modes: [[280, 0.005, 1], [600, 0.0035, 0.4]], attack: 0.004, blow: 0.005 },
  tick: { modes: [[1300, 0.0025, 1], [2300, 0.0018, 0.4]], attack: 0.003, blow: 0.002 },
  part: { modes: [[380, 0.005, 1], [800, 0.0035, 0.4]], attack: 0.005, blow: 0.005 },
  reseat: { modes: [[190, 0.008, 1], [380, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};
const LEVELS = { switchOn: decibels(0), switchOff: decibels(-5), tick: decibels(-9), part: decibels(-8), partLeaving: decibels(-11), reseat: decibels(-4), swell: decibels(-20) };

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

// The filament heating: dull noise that rises slowly and falls away again. No pitch, no hum.
function swell(detail) {
  const context = sound.context;
  const start = context.currentTime;
  const source = context.createBufferSource();
  const dull = context.createBiquadFilter();
  const level = context.createGain();
  source.buffer = sound.noise;
  source.loop = true;
  dull.type = "lowpass";
  dull.frequency.value = SWELL_LOW_PASS;
  dull.Q.value = 0.5;
  level.gain.setValueAtTime(0, start);
  level.gain.linearRampToValueAtTime(LEVELS.swell * detail.level, start + detail.duration * 0.45);
  level.gain.linearRampToValueAtTime(0, start + detail.duration);
  source.connect(dull).connect(level).connect(sound.bus);
  source.start(start, Math.random());
  source.stop(start + detail.duration + 0.05);
}

const VOICES = {
  "switch-on": () => tap(BODIES.switchOn, LEVELS.switchOn),
  "switch-off": () => tap(BODIES.switchOff, LEVELS.switchOff),
  heat: (detail) => swell(detail),
  "burn-out": () => tap(BODIES.tick, LEVELS.tick),
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

clock.touring = !manual && tourAllowed && !still.matches;
if (query.get("apart") === "1") {
  zoom.shown = 0;
  Explode.setApart(explode, true, true);
}
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__lamp = {
  advance(seconds) {
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds);
    draw();
  },
  setSwitch(on) {
    Lamp.setSwitch(lamp, on);
  },
  setVolts(volts) {
    supply.target = Lamp.clamp(volts, Lamp.MIN_VOLTS, Lamp.MAX_VOLTS);
  },
  holdZoom(held) {
    zoom.held = held;
  },
  setSpeed(speed) {
    clock.speed = speed;
  },
  letAirIn,
  mend: mendLamp,
  setApart(apart) {
    explode.time = clock.elapsed;
    setApartWanted(apart);
  },
  steps(opacity) {
    steps.shown = opacity;
    document.body.style.setProperty("--lb-steps", String(opacity));
  },
  project(point) {
    return iso(point, P);
  },
  takeEvents() {
    return eventLog.splice(0);
  },
  state() {
    const round = (value) => Math.round(value * 10000) / 10000;
    return {
      closed: lamp.closed,
      wanted: lamp.wanted,
      volts: round(lamp.volts),
      amperes: round(Lamp.currentOf(lamp)),
      kelvin: Math.round(lamp.temperature),
      brightness: round(Lamp.brightnessOf(lamp.temperature)),
      air: lamp.air,
      broken: lamp.broken,
      litSeconds: round(lamp.litSeconds),
      zoomAge: round(zoom.age),
      zoomShown: round(zoom.shown),
      apart: explode.apart,
      open: round(Explode.maxShare(explode)),
      resting: Explode.isResting(explode),
      time: round(clock.elapsed),
      readout: readout.textContent,
    };
  },
};
