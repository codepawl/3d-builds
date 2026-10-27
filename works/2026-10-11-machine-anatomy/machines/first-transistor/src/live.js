// The live half of the first-transistor figure. The build inlines this file after the kit, the pure
// model (Transistor), the exploded view's model (Explode) and CONFIG. It drives the slots the build
// left: the two currents on the wires, the moving charges in the magnified view, the two waveforms, the
// bias switch and the readout. Every number it shows comes from Transistor.sampleAt() and
// Transistor.measureGain().

const P = CONFIG.projection;
const INSET = CONFIG.inset;
const SCOPE = CONFIG.scope;
const LEVEL_STEP = 0.05;
// How quickly the currents on the drawing follow the bias switch, in seconds.
const BIAS_FOLLOW = 0.18;
// How far the dashes of a current travel in a second while only the resting current flows, in dash lengths.
const DASH_SPEED = 2.2;
const WAVE_POINTS = 120;
const WALK_SECONDS = 8;
// The magnified view is born from a rectangle on the model: the rectangle appears, the frame grows out
// of it, four dashed lines hold the corners together for a moment, then rectangle and lines fade.
const SOURCE = CONFIG.source;
const BIRTH = { appear: 0.25, grow: 0.7, hold: 1, fade: 1.2 };
const BIRTH_SECONDS = BIRTH.appear + BIRTH.grow + BIRTH.hold + BIRTH.fade;
const BIRTH_DELAY = 0.6;

const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const biasButton = document.querySelector("[data-bias]");
const levelInput = document.querySelector("[data-level]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";

function one(name) {
  return document.querySelector(`[data-dyn="${name}"]`);
}

function numbered(attribute) {
  const found = [];
  for (const element of document.querySelectorAll(`[${attribute}]`)) found[Number(element.getAttribute(attribute))] = element;
  return found;
}

const parts = {
  pathIn: Array.from(document.querySelectorAll('[data-dyn="path-in"]')),
  pathOut: Array.from(document.querySelectorAll('[data-dyn="path-out"]')),
  inflow: one("inflow"),
  outflow: one("outflow"),
  waveIn: one("wave-in"),
  waveOut: one("wave-out"),
  labelIn: one("label-in"),
  labelOut: one("label-out"),
  chips: numbered("data-chip"),
  stepItems: numbered("data-step-item"),
  stepMarks: numbered("data-stepmark"),
};

const detail = document.querySelector(".tr-detail");
const zoomFrame = detail.querySelector(".tr-inset");
const birthParts = { layer: one("birth-layer"), source: one("birth-source"), lines: one("birth-lines") };

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
  else if (name === "opacity") element.style.opacity = value;
  else if (name === "html") element.innerHTML = value;
  else if (name === "text") element.textContent = value;
  else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function setGlow(element, value) {
  write(element, "glow", String(Math.round(value * 100) / 100));
}

function say(text) {
  announcer.textContent = text;
}

// ---- state ---------------------------------------------------------------------------------------------

function startLevel() {
  const asked = Number(query.get("level"));
  return query.has("level") && Number.isFinite(asked) ? asked : Transistor.DEFAULTS.inputLevel;
}

let parameters = Transistor.createParameters({ inputLevel: startLevel(), biasOn: query.get("bias") !== "off" });
// `elapsed` is the page's own time; `signal` is the model's time, which stands still while the device is apart.
const clock = { elapsed: 0, signal: 0, visible: manual, frame: 0, last: 0 };
const walk = { phase: 1, seconds: WALK_SECONDS, active: false };
const steps = { shown: 0 };
const flow = { level: parameters.biasOn ? 1 : 0, dashIn: 0, dashOut: 0 };
const history = [];
const cache = { key: "", gain: null, text: "" };
// Seconds since the birth of the magnified view began; negative while it has not begun. A capture on
// the manual clock and a reader who asked for less motion get the finished frame at once.
const birth = { seconds: manual || still.matches ? BIRTH_SECONDS : -BIRTH_DELAY, transform: "" };

function measured() {
  const key = `${parameters.inputLevel}|${parameters.biasOn}|${parameters.alpha}`;
  if (cache.key !== key) {
    cache.key = key;
    cache.gain = Transistor.measureGain(parameters);
    cache.text = Transistor.describe(parameters);
  }
  return cache;
}

function recordSample() {
  const sample = Transistor.sampleAt(parameters, clock.signal);
  history.push({ seconds: clock.signal, inputVolts: sample.inputVolts, outputVolts: sample.outputVolts });
  while (history.length > 2 && history[1].seconds < clock.signal - SCOPE.seconds) history.shift();
}

// Before the first frame the traces already hold the last few seconds, as if the device had been running.
function fillHistory() {
  history.length = 0;
  for (let index = 0; index <= WAVE_POINTS; index++) {
    const seconds = clock.signal - SCOPE.seconds + (SCOPE.seconds * index) / WAVE_POINTS;
    const sample = Transistor.sampleAt(parameters, seconds);
    history.push({ seconds, inputVolts: sample.inputVolts, outputVolts: sample.outputVolts });
  }
}

// ---- time ----------------------------------------------------------------------------------------------

function walkEvents(before, after, startedAt) {
  Transistor.STEP_STARTS.forEach((start, index) => {
    if (before >= start || after < start) return;
    const at = startedAt + (start - before) * walk.seconds;
    emit("step-label", { step: index + 1 }, at);
    if (index === 3) emit("amplify", { duration: 1.6 }, at);
  });
}

function advanceWalk(seconds) {
  if (!walk.active) return;
  const before = walk.phase;
  walk.phase = Math.min(1, walk.phase + seconds / walk.seconds);
  walkEvents(before, walk.phase, clock.elapsed);
  if (walk.phase >= 1) walk.active = false;
}

function advanceCurrents(seconds) {
  const target = parameters.biasOn ? 1 : 0;
  flow.level += (target - flow.level) * (1 - Math.exp(-seconds / BIAS_FOLLOW));
  const sample = Transistor.sampleAt(parameters, clock.signal);
  const resting = Transistor.sampleAt({ ...parameters, biasOn: true, inputLevel: 0 }, 0);
  flow.dashIn += seconds * DASH_SPEED * (sample.emitterAmps / resting.emitterAmps);
  flow.dashOut += seconds * DASH_SPEED * (sample.collectorAmps / resting.collectorAmps);
}

// `running` is false while the device is apart: the page's time goes on, the model's time waits.
function advance(seconds, running) {
  if (running) {
    advanceWalk(seconds);
    clock.signal += seconds;
    advanceCurrents(seconds);
    recordSample();
  }
  clock.elapsed += seconds;
}

// Before the walk-through starts nothing is lit: the film opens on the device alone.
function holdWalk() {
  walk.phase = 0;
  walk.active = false;
}

function startWalk(seconds) {
  walk.seconds = seconds;
  walk.phase = 0;
  walk.active = true;
}

// ---- drawing -------------------------------------------------------------------------------------------

function stepLevels() {
  return walk.phase < 1 ? Transistor.stepsAt(walk.phase) : [1, 1, 1, 1, 1];
}

function between(from, to, share) {
  return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
}

function bend(from, control, to, share) {
  return between(between(from, control, share), between(control, to, share), share);
}

const IN_FOIL_SHARE = 0.4;
const OUT_BULK_SHARE = 0.55;

// A charge of the input current: down the emitter's foil, then just under the surface to the collector.
function inflowSpot(charge) {
  if (charge.along < IN_FOIL_SHARE) return between([47.5, 2], [96.5, INSET.surface - 3], charge.along / IN_FOIL_SHARE);
  const share = (charge.along - IN_FOIL_SHARE) / (1 - IN_FOIL_SHARE);
  const dip = INSET.surface + 12 + charge.lane * 12;
  return bend([INSET.emitterTip[0], INSET.surface + 2], [120, dip], [INSET.collectorTip[0], INSET.surface + 2], share);
}

// A charge of the output current: up from the metal base to the collector's tip, then up its foil.
function outflowSpot(charge) {
  if (charge.along < OUT_BULK_SHARE) {
    const share = charge.along / OUT_BULK_SHARE;
    const start = [128 + charge.lane * 86, INSET.baseTop];
    return bend(start, [150 + charge.lane * 30, 138], [INSET.collectorTip[0] + 2, INSET.surface + 2], share);
  }
  return between([INSET.collectorTip[0], INSET.surface - 3], [192.5, 2], (charge.along - OUT_BULK_SHARE) / (1 - OUT_BULK_SHARE));
}

function ends(along) {
  return Math.min(1, along * 14, (1 - along) * 14);
}

function inflowGlow(charge, levels) {
  if (charge.along < IN_FOIL_SHARE) return levels[0];
  const share = (charge.along - IN_FOIL_SHARE) / (1 - IN_FOIL_SHARE);
  return share < 0.5 ? levels[1] : levels[2];
}

function chargesMarkup(charges, spotOf, glowOf, side, radius, shown) {
  let markup = "";
  for (const charge of charges) {
    const opacity = charge.strength * ends(charge.along) * glowOf(charge) * shown;
    if (opacity < 0.03) continue;
    const [x, y] = spotOf(charge);
    markup += `<circle class="tr-charge"${side} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" opacity="${opacity.toFixed(2)}"/>`;
  }
  return markup;
}

function drawCharges(levels, assembled) {
  const shown = flow.level * assembled;
  const inflow = shown > 0.02 ? Transistor.holesAt(parameters, clock.signal) : [];
  const outflow = shown > 0.02 ? Transistor.outflowAt(parameters, clock.signal) : [];
  write(parts.inflow, "html", chargesMarkup(inflow, inflowSpot, (charge) => inflowGlow(charge, levels), "", 3.1, shown));
  write(parts.outflow, "html", chargesMarkup(outflow, outflowSpot, () => levels[3], ' data-side="out"', 2.7, shown));
}

function wavePath(name) {
  const usable = SCOPE.width - 8;
  const half = SCOPE.height / 2 - 5;
  const from = clock.signal - SCOPE.seconds;
  let d = "";
  for (const point of history) {
    const x = 4 + ((point.seconds - from) / SCOPE.seconds) * usable;
    if (x < 3.5) continue;
    const y = SCOPE.height / 2 - Transistor.clamp(point[name] / SCOPE.fullVolts, -1, 1) * half;
    d += `${d ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function drawWaves(levels) {
  write(parts.waveIn, "d", wavePath("inputVolts"));
  write(parts.waveOut, "d", wavePath("outputVolts"));
  write(parts.waveIn, "opacity", (0.25 + 0.75 * levels[0]).toFixed(2));
  write(parts.waveOut, "opacity", levels[4].toFixed(2));
  const gain = measured().gain;
  write(parts.labelIn, "text", `input · ${gain.inputSwing.toFixed(2)} V swing`);
  const outputShown = levels[4] > 0.02;
  write(parts.labelOut, "text", outputShown ? `output · ${gain.outputSwing.toFixed(2)} V swing` : "output");
}

function drawCurrents(levels, assembled) {
  for (const path of parts.pathIn) setGlow(path, levels[0] * assembled * (0.12 + 0.88 * flow.level));
  for (const path of parts.pathOut) setGlow(path, levels[3] * assembled * flow.level);
  const weight = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--anatomy-weight")) || 1;
  for (const path of parts.pathIn) write(path, "stroke-dashoffset", (-flow.dashIn * weight * 9).toFixed(1));
  for (const path of parts.pathOut) write(path, "stroke-dashoffset", (-flow.dashOut * weight * 13).toFixed(1));
}

function drawSteps(levels, assembled) {
  setGlow(parts.chips[0], levels[0]);
  setGlow(parts.chips[1], levels[2]);
  setGlow(parts.chips[2], levels[4]);
  parts.stepItems.forEach((item, index) => setGlow(item, levels[index]));
  parts.stepMarks.forEach((mark, index) => write(mark, "opacity", (levels[index] * steps.shown * assembled).toFixed(2)));
}

function draw() {
  const levels = stepLevels();
  const assembled = 1 - Math.min(1, Math.max(0, Explode.maxShare(explode)));
  drawCurrents(levels, assembled);
  drawCharges(levels, assembled);
  drawWaves(levels);
  drawSteps(levels, assembled);
  write(stage, "data-power", parameters.biasOn ? "on" : "off");
  write(biasButton, "aria-pressed", String(parameters.biasOn));
  write(biasButton, "text", parameters.biasOn ? "Bias on" : "Bias off");
  write(readout, "text", apartReadout() ?? measured().text);
  drawApart();
  drawBirth();
}

// ---- the birth of the magnified view -------------------------------------------------------------------

function birthBusy() {
  return birth.seconds < BIRTH_SECONDS;
}

function advanceBirth(seconds) {
  if (birthBusy()) birth.seconds += seconds;
}

// Where the birth stands `seconds` after it began: how far the frame has grown out of the source
// rectangle, how visible the frame is, and how visible the rectangle and the four corner lines are.
function birthAt(seconds) {
  if (seconds < 0) return { grown: 0, frame: 0, guides: 0 };
  if (seconds >= BIRTH_SECONDS) return { grown: 1, frame: 1, guides: 0 };
  const growing = Transistor.clamp((seconds - BIRTH.appear) / BIRTH.grow, 0, 1);
  const fadeFrom = BIRTH.appear + BIRTH.grow + BIRTH.hold;
  const appeared = Transistor.smooth(0, BIRTH.appear, seconds);
  const faded = Transistor.smooth(fadeFrom, BIRTH_SECONDS, seconds);
  return { grown: 1 - (1 - growing) ** 3, frame: Transistor.smooth(0, 0.15, growing), guides: appeared * (1 - faded) };
}

// The source rectangle on the model, in the window's coordinates: it follows the camera.
function sourceOnScreen() {
  const view = worldView(Math.min(1, Math.max(0, Explode.maxShare(explode))));
  const frame = stage.getBoundingClientRect();
  const acrossScale = frame.width / EX.width;
  const downScale = frame.height / EX.height;
  const width = SOURCE.width * view.zoom * acrossScale;
  const height = SOURCE.height * view.zoom * downScale;
  const middleX = frame.left + (EX.width / 2 + (SOURCE.x - view.x) * view.zoom) * acrossScale;
  const middleY = frame.top + (EX.height / 2 + (SOURCE.y - view.y) * view.zoom) * downScale;
  return { x: middleX - width / 2, y: middleY - height / 2, width, height };
}

function boxBetween(from, to, share) {
  const mix = (name) => from[name] + (to[name] - from[name]) * share;
  return { x: mix("x"), y: mix("y"), width: mix("width"), height: mix("height") };
}

// Four straight lines, corner to corner, from one box to another.
function cornerLines(from, to, origin) {
  let d = "";
  for (const [across, down] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const startX = from.x + from.width * across - origin.left;
    const startY = from.y + from.height * down - origin.top;
    const endX = to.x + to.width * across - origin.left;
    const endY = to.y + to.height * down - origin.top;
    d += `M${startX.toFixed(1)} ${startY.toFixed(1)}L${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }
  return d;
}

function setZoomTransform(value) {
  if (birth.transform === value) return;
  birth.transform = value;
  zoomFrame.style.transform = value;
}

function drawBirthGuides(source, current) {
  const origin = birthParts.layer.getBoundingClientRect();
  write(birthParts.source, "x", (source.x - origin.left).toFixed(1));
  write(birthParts.source, "y", (source.y - origin.top).toFixed(1));
  write(birthParts.source, "width", source.width.toFixed(1));
  write(birthParts.source, "height", source.height.toFixed(1));
  write(birthParts.lines, "d", cornerLines(source, current, origin));
}

function drawBirth() {
  const now = birthAt(birth.seconds);
  write(zoomFrame, "opacity", now.frame.toFixed(2));
  write(birthParts.source, "opacity", now.guides.toFixed(2));
  write(birthParts.lines, "opacity", now.guides.toFixed(2));
  if (now.guides < 0.005) {
    setZoomTransform("");
    return;
  }
  const final = detail.getBoundingClientRect();
  const source = sourceOnScreen();
  const current = boxBetween(source, final, now.grown);
  const shift = `translate(${(current.x - final.x).toFixed(2)}px,${(current.y - final.y).toFixed(2)}px)`;
  setZoomTransform(now.grown < 1 ? `${shift} scale(${(current.width / final.width).toFixed(4)})` : "");
  drawBirthGuides(source, current);
}

// ---- controls ------------------------------------------------------------------------------------------

function setBias(on) {
  if (on === parameters.biasOn) return;
  parameters = Transistor.createParameters({ ...parameters, biasOn: on });
  emit("bias-switch", { on });
  if (on) emit("amplify", { duration: 1.2 });
  say(on ? `Batteries connected. ${measured().text}.` : "Batteries disconnected. Nothing is amplified.");
  draw();
  run();
}

function setLevel(level) {
  parameters = Transistor.createParameters({ ...parameters, inputLevel: level });
  const shown = String(Math.round(parameters.inputLevel * 100));
  if (levelInput.value !== shown) levelInput.value = shown;
  if (still.matches) fillHistory();
  draw();
  run();
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const hit = event.target.closest("[data-hit]");
  const letter = event.key.toUpperCase();
  if (letter === "B" || (hit && (event.key === "Enter" || event.key === " "))) {
    event.preventDefault();
    setBias(!parameters.biasOn);
    return;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  setLevel(parameters.inputLevel + (event.key === "ArrowRight" ? LEVEL_STEP : -LEVEL_STEP));
  say(`Input level ${Math.round(parameters.inputLevel * 100)} percent. ${measured().text}.`);
}

// ---- loop ----------------------------------------------------------------------------------------------

function tick(now) {
  const seconds = clock.last ? Math.min((now - clock.last) / 1000, 1 / 30) : 1 / 60;
  clock.last = now;
  const flying = stepApart(seconds);
  const running = !still.matches && !apartBusy();
  advance(seconds, running);
  advanceBirth(seconds);
  draw();
  clock.frame = clock.visible && (running || flying || birthBusy()) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

if (!manual) {
  stage.addEventListener("click", (event) => {
    if (event.target.closest("[data-hit]")) setBias(!parameters.biasOn);
  });
  stage.addEventListener("keydown", onKey);
  biasButton.addEventListener("click", () => setBias(!parameters.biasOn));
  levelInput.addEventListener("input", () => setLevel(Number(levelInput.value) / 100));
  new IntersectionObserver(
    (entries) => {
      clock.visible = entries[entries.length - 1].isIntersecting;
      if (clock.visible) run();
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
  still.addEventListener("change", () => {
    if (still.matches) birth.seconds = BIRTH_SECONDS;
    fillHistory();
    draw();
    run();
  });
}
