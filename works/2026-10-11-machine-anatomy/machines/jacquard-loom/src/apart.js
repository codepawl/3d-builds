// The exploded view, the sounds and the film hooks of the Jacquard loom figure. The build inlines this
// file right after live.js, inside the same block: it uses that file's clock, parts and helpers, and it
// ends with the start-up that brings the page to its first frame.

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
const filmView = { camera: null, weaving: true };
const eventLog = [];

// ---- state ---------------------------------------------------------------------------------------------

function apartBusy() {
  return apartState.armed || explode.apart || !Explode.isResting(explode);
}

function finishingPick() {
  return apartState.armed && clock.phase < 1;
}

function apartReadout() {
  if (apartState.armed) return "finishing the pick · then apart";
  if (explode.apart) return Explode.isResting(explode) ? "apart · weaving paused" : "coming apart";
  if (!Explode.isResting(explode)) return "going back together";
  return null;
}

function say(text) {
  if (announcer) announcer.textContent = text;
}

function openApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, true, calm);
  emit("apart-open", { duration: Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5 });
  if (calm) emit("apart-hold", {});
  say("The loom is apart in ten numbered assemblies. Weaving is paused.");
}

function closeApart(calm) {
  apartState.armed = false;
  Explode.setApart(explode, false, calm);
  emit("apart-close", { duration: Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5 });
  if (calm) emit("apart-seated", {});
  say("The loom is going back together.");
}

// Arming: the loom only comes apart from rest, so a pick that is under way is finished first.
function setApartWanted(wanted) {
  const current = explode.apart || apartState.armed;
  if (wanted === current) return;
  if (!wanted && apartState.armed) apartState.armed = false;
  else if (!wanted) closeApart(still.matches);
  else if (still.matches) {
    clock.phase = 1;
    settleEvents();
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
  const share = Loom.smooth(0, 1, open);
  return { x: centre[0] + (EX.apart.x - centre[0]) * share, y: centre[1] + (EX.apart.y - centre[1]) * share, zoom: 1 + (fit - 1) * share };
}

function placeBadges(shifts, view) {
  for (const badge of badges) {
    const name = badge.getAttribute("data-badge");
    const anchor = EX.anchors[name];
    const shift = shifts[name];
    const point = iso([anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], P);
    const x = EX.width / 2 + (point[0] - view.x) * view.zoom;
    const y = EX.height / 2 + (point[1] - view.y) * view.zoom;
    const place = `${((x / EX.width) * 100).toFixed(2)}%`;
    const drop = `${((y / EX.height) * 100).toFixed(2)}%`;
    if (badge.style.left !== place) badge.style.left = place;
    if (badge.style.top !== drop) badge.style.top = drop;
    const share = name === "frame" ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
    const shown = Loom.smooth(0.5, 0.95, share).toFixed(2);
    if (badge.style.opacity !== shown) badge.style.opacity = shown;
  }
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
  const loose = (0.9 * Math.min(1, open * 3)).toFixed(2);
  for (const dot of parts.cordEnd.concat(parts.fellEnd)) write(dot, "r", loose);
  const least = Math.min(...Explode.LEAVE_ORDER.map((name) => Explode.shareOf(explode, name)));
  const shown = Loom.smooth(0.55, 0.95, least).toFixed(2);
  if (document.body.style.getPropertyValue("--jq-apart") !== shown) document.body.style.setProperty("--jq-apart", shown);
  write(stage, "data-open", open > 0.005 ? "" : null);
  const wanted = explode.apart || apartState.armed;
  write(apartButton, "aria-pressed", String(wanted));
  const label = wanted ? "Put together" : "Take apart";
  if (apartButton.textContent !== label) apartButton.textContent = label;
}

// ---- sound ---------------------------------------------------------------------------------------------
// The loom reports what happens as named events with a time on its own clock. The page plays them through
// Web Audio when the reader turns sound on; the recorder takes the log and renders the film's track offline.

const sound = { on: false, context: null, master: null, noise: null, hold: null };

function pressPhase() {
  let low = T.swingIn[0];
  let high = T.swingIn[1];
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    const faceX = cylinderCentre(Loom.poseAt(middle).swing)[0] + L.card.half + L.card.thick;
    if (faceX < L.needle.headX) low = middle;
    else high = middle;
  }
  return high;
}

const CUES = [
  [T.turn[1], "card-seat"],
  [pressPhase(), "needle-ticks"],
  [T.rise[0], "treadle"],
  [T.rise[0] + 0.012, "griffe-lift"],
  [T.shuttle[0], "shuttle"],
  [T.shuttle[1] - 0.008, "shuttle-knock"],
  [T.weave, "reed-beat"],
  [T.fall[1] - 0.012, "griffe-drop"],
];

function cueDetail(name) {
  const card = loom.chain[loom.cardIndex];
  if (name === "needle-ticks") return { lanes: laneIndexes.filter((lane) => !card[lane]) };
  if (name === "griffe-lift" || name === "treadle") return { duration: (T.rise[1] - T.rise[0]) * clock.pickSeconds };
  if (name === "shuttle") return { duration: (T.shuttle[1] - T.shuttle[0]) * clock.pickSeconds, direction: clock.direction };
  return {};
}

// Called by advance() for every stretch of a pick it plays: `at` is the clock time at phase `from`.
function soundEvents(from, to, at) {
  for (const [phase, name] of CUES) {
    if (from < phase && to >= phase) emit(name, cueDetail(name), at + (phase - from) * clock.pickSeconds);
  }
}

function emit(name, detail, at = null) {
  if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
  if (sound.on && sound.context) VOICES[name]?.(detail);
}

function audioReady() {
  if (sound.context) return sound.context;
  const context = new AudioContext();
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  sound.context = context;
  sound.noise = buffer;
  sound.master = context.createGain();
  sound.master.gain.value = 0.55;
  sound.master.connect(context.destination);
  return context;
}

// A struck tone: a sine or triangle that rings and dies away, for wood and metal.
function strike(frequency, decay, level, delay = 0, type = "sine") {
  const context = sound.context;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  oscillator.connect(gain).connect(sound.master);
  oscillator.start(start);
  oscillator.stop(start + decay + 0.05);
}

// Filtered noise that swells and fades while its band slides from one pitch to another: air and creaks.
function breath(from, to, sharpness, duration, level, delay = 0) {
  const context = sound.context;
  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = sound.noise;
  source.loop = true;
  filter.type = "bandpass";
  filter.Q.value = sharpness;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(sound.master);
  source.start(start);
  source.stop(start + duration + 0.05);
}

function holdTone(on) {
  const context = sound.context;
  if (sound.hold) {
    sound.hold.gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.12);
    sound.hold.voices.forEach((voice) => voice.stop(context.currentTime + 0.6));
    sound.hold = null;
  }
  if (!on) return;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.setTargetAtTime(0.03, context.currentTime, 0.4);
  gain.connect(sound.master);
  const voices = [196, 294].map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start();
    return oscillator;
  });
  sound.hold = { gain, voices };
}

function clickOf(number, level) {
  const metal = number % 2 === 0;
  strike(metal ? 2300 + number * 130 : 520 + number * 45, metal ? 0.05 : 0.07, level, 0, metal ? "triangle" : "sine");
  breath(1800, 1800, 3, 0.03, level * 0.6);
}

const VOICES = {
  "card-seat": () => {
    breath(1900, 1900, 2, 0.05, 0.5);
    strike(430, 0.07, 0.35);
    strike(760, 0.05, 0.2);
  },
  "needle-ticks": (detail) => detail.lanes.forEach((lane, index) => strike(3100 + lane * 240, 0.035, 0.07, index * 0.014, "triangle")),
  treadle: (detail) => breath(380, 560, 8, detail.duration, 0.1),
  "griffe-lift": (detail) => {
    strike(96, 0.16, 0.6);
    strike(162, 0.1, 0.3);
    breath(850, 1500, 7, detail.duration * 0.8, 0.12, 0.04);
  },
  "griffe-drop": () => {
    strike(88, 0.13, 0.34);
    strike(150, 0.08, 0.15);
  },
  shuttle: (detail) => breath(650, 2300, 1.2, detail.duration, 0.16),
  "shuttle-knock": () => {
    strike(310, 0.06, 0.4);
    strike(540, 0.04, 0.22);
  },
  "reed-beat": () => {
    strike(72, 0.18, 0.7);
    strike(124, 0.11, 0.35);
    breath(500, 500, 1, 0.05, 0.25);
  },
  "apart-open": (detail) => breath(320, 2800, 1.5, detail.duration, 0.12),
  "apart-close": (detail) => {
    holdTone(false);
    breath(2600, 340, 1.5, detail.duration, 0.1);
  },
  "piece-leave": (detail) => clickOf(detail.number, 0.16),
  "piece-land": (detail) => clickOf(detail.number, 0.2),
  "apart-hold": () => holdTone(true),
  "apart-seated": () => {
    holdTone(false);
    strike(84, 0.2, 0.7);
    strike(140, 0.12, 0.35);
    breath(1700, 1700, 2, 0.05, 0.35);
  },
};

function toggleSound() {
  sound.on = !sound.on;
  if (sound.on) audioReady().resume();
  else if (sound.context) holdTone(false);
  soundButton.setAttribute("aria-pressed", String(sound.on));
  soundButton.textContent = sound.on ? "Sound on" : "Sound";
}

// ---- start ---------------------------------------------------------------------------------------------

if (!manual) {
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "e" && event.key !== "E") return;
    event.preventDefault();
    toggleApart();
  });
  apartButton.addEventListener("click", toggleApart);
  soundButton.addEventListener("click", toggleSound);
}

const requested = query.get("picks");
const startPicks = requested === null ? Loom.CARDS : Math.max(0, Math.min(64, Number(requested) || 0));
motifButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute("data-motif") === loom.motif)));
if (still.matches && !manual) {
  for (let pick = 1; pick < startPicks; pick++) Loom.runPick(loom, MECHANISM);
  jumpOnePick();
} else {
  for (let pick = 0; pick < startPicks; pick++) Loom.runPick(loom, MECHANISM);
  clock.direction = loom.picks % 2 === 0 ? -1 : 1;
  clock.touring = !manual;
}
if (query.get("apart") === "1") Explode.setApart(explode, true, true);
draw();

// A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
// here. Every call advances the figure's own clock, so the event log carries exact film times.
window.__loom = {
  advance(seconds) {
    clock.touring = filmView.weaving;
    explode.time = clock.elapsed;
    stepApart(seconds);
    advance(seconds);
    draw();
  },
  setWeaving(on) {
    filmView.weaving = on;
  },
  setPickSeconds(seconds) {
    clock.pickSeconds = seconds;
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
  detail(opacity) {
    document.body.style.setProperty("--jq-detail", String(opacity));
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
      picks: loom.picks,
      card: loom.cardIndex + 1,
      phase: Math.round(clock.phase * 10000) / 10000,
      row: Loom.rowBits(loom.chain[loom.cardIndex]),
      apart: explode.apart,
      open: Math.round(Explode.maxShare(explode) * 10000) / 10000,
      resting: Explode.isResting(explode),
      time: Math.round(clock.elapsed * 10000) / 10000,
    };
  },
};
