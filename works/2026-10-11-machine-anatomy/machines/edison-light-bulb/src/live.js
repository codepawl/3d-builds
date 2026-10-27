// The live half of the light bulb figure. The build inlines this file after the kit, the pure model
// (Lamp), the size table (Layout) and CONFIG. It fills the slots the build left: the key, the lit path,
// the filament with its colour, bloom and halo, the air in the bulb, the trace, the readout and the one
// zoom frame. Every number it shows comes from Lamp.step().

const P = CONFIG.projection;
const SIZES = Layout.sizes;
const LAMP = Layout.lamp;
const RESUME_AFTER = 4200;
const STILL_SECONDS = 4;
const VOLTS_PER_SECOND = 90;
const VOLTS_STEP = 5;
const AIR_FADE_SECONDS = 0.3;
const BROKEN_GAP = [0.4, 0.6];
// The idle demonstration: seconds into the loop, then what happens.
const TOUR = [[0.6, "on"], [4.4, "off"], [5.6, "on"], [7.2, "dim"], [8.8, "bright"], [10.2, "normal"], [11.4, "off"]];
const TOUR_SECONDS = 12.6;
const TOUR_VOLTS = { dim: 55, bright: Lamp.MAX_VOLTS, normal: Lamp.NOMINAL_VOLTS };
// The zoom frame's birth, in seconds from the moment it starts.
const BIRTH = { mark: 0.25, grow: 0.7, linger: 1, fade: 1.2 };
const BIRTH_AT_SHARE = 0.2;
const ZOOM_FADE_SECONDS = 0.35;
const ZOOM_LINE_GAIN = 1.3;

const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const switchButton = document.querySelector("[data-switch]");
const airButton = document.querySelector("[data-air]");
const mendButton = document.querySelector("[data-mend]");
const voltsInput = document.querySelector("[data-volts]");
const voltsText = document.querySelector("[data-volts-text]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";
// ?tour=off keeps the lamp still until the reader acts: for tests and for embedding.
const tourAllowed = query.get("tour") !== "off";

function one(name) {
  return document.querySelector(`[data-dyn="${name}"]`);
}

function keyed(name, attribute) {
  const found = {};
  for (const element of document.querySelectorAll(`[data-dyn="${name}"]`)) found[element.getAttribute(attribute)] = element;
  return found;
}

const parts = {
  segments: keyed("segment", "data-segment"),
  paddle: one("paddle"),
  filament: one("filament"),
  bloom: one("bloom"),
  rim: one("rim"),
  halo: one("halo"),
  ambient: one("ambient"),
  glassWarm: one("glass-warm"),
  air: one("air"),
  zoom: one("zoom"),
  zoomSource: one("zoom-source"),
  zoomTies: one("zoom-ties"),
  zoomUse: one("zoom-use"),
  zoomRects: [one("zoom-clip"), one("zoom-paper"), one("zoom-edge")],
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
  else if (name === "hot") element.style.setProperty("--hot", value);
  else if (name === "weight") element.style.setProperty("--anatomy-weight", value);
  else if (name === "stroke") element.style.stroke = value;
  else if (name === "text") element.textContent = value;
  else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function setGlow(element, value) {
  write(element, "glow", String(Math.round(value * 100) / 100));
}

const trace = (points, closed = false) => pathOf(points.map((point) => iso(point, P)), closed);

// ---- state ---------------------------------------------------------------------------------------------

const lamp = Lamp.createLamp();
const clock = { speed: 1, touring: false, held: false, visible: manual, frame: 0, last: 0, resumeTimer: 0, elapsed: 0, tourTime: 0 };
const supply = { target: Lamp.NOMINAL_VOLTS };
const shown = { air: 0 };
// `age` is seconds since the zoom frame was born (below zero: not yet); `shown` fades it for the take-apart.
// `held` keeps the zoom frame unborn; only the film uses it, for its opening seconds.
const zoom = { age: -1, shown: 1, held: false };
// The film shows the five numbered steps of switching on; the page leaves them to the trace.
const steps = { shown: 0 };

function say(text) {
  if (announcer) announcer.textContent = text;
}

function wantsTour() {
  return clock.touring && !clock.held && !still.matches && !apartBusy();
}

function tourAct(action) {
  if (action === "on" || action === "off") Lamp.setSwitch(lamp, action === "on");
  else supply.target = TOUR_VOLTS[action];
}

function stepTour(seconds) {
  if (!wantsTour() || lamp.broken) return;
  const before = clock.tourTime;
  clock.tourTime += seconds;
  for (const [at, action] of TOUR) {
    if (before < at && clock.tourTime >= at) tourAct(action);
  }
  if (clock.tourTime >= TOUR_SECONDS) clock.tourTime = 0;
}

function stepSupply(seconds) {
  const gap = supply.target - lamp.volts;
  const reach = VOLTS_PER_SECOND * seconds;
  Lamp.setVolts(lamp, Math.abs(gap) <= reach ? supply.target : lamp.volts + Math.sign(gap) * reach);
}

function lampEvent(event) {
  if (event.name === "switch-on") {
    emit("switch-on", {});
    if (event.complete) emit("heat", { level: Lamp.clamp(event.volts / Lamp.NOMINAL_VOLTS, 0.4, 1.15), duration: Math.min(2.2, 0.9 / clock.speed) });
    say(event.complete ? "Switch closed. Current flows through the filament and it heats up." : "Switch closed, but the filament is burnt out: no current.");
  }
  if (event.name === "switch-off") {
    emit("switch-off", {});
    say("Switch open. The filament cools.");
  }
  if (event.name === "burn-out") {
    emit("burn-out", {});
    say("With air in the bulb the hot carbon burnt through. The circuit is open.");
  }
}

function stepZoom(seconds) {
  if (zoom.age < 0 && !zoom.held && lamp.pathShare >= BIRTH_AT_SHARE) zoom.age = still.matches ? 100 : 0;
  else if (zoom.age >= 0) zoom.age += seconds;
  const target = apartWanted() || Explode.maxShare(explode) > 0.001 ? 0 : 1;
  const reach = seconds / ZOOM_FADE_SECONDS;
  zoom.shown = Math.abs(target - zoom.shown) <= reach ? target : zoom.shown + Math.sign(target - zoom.shown) * reach;
}

// Plays `seconds` of the figure's clock. The lamp's own clock runs at `clock.speed` times that.
function advance(seconds) {
  clock.elapsed += seconds;
  stepTour(seconds);
  stepSupply(seconds);
  for (const event of Lamp.step(lamp, seconds * clock.speed)) lampEvent(event);
  const airTarget = lamp.air ? 1 : 0;
  shown.air += Lamp.clamp(airTarget - shown.air, -seconds / AIR_FADE_SECONDS, seconds / AIR_FADE_SECONDS);
  stepZoom(seconds);
}

function lampBusy() {
  const turning = lamp.turn !== (lamp.wanted ? 1 : 0);
  const warm = lamp.temperature > Lamp.AMBIENT_KELVIN + 1;
  const sweeping = Lamp.circuitComplete(lamp) && lamp.pathShare < 1;
  const ramping = lamp.volts !== supply.target || shown.air !== (lamp.air ? 1 : 0);
  const born = zoom.age >= 0 && zoom.age < BIRTH.mark + BIRTH.grow + BIRTH.linger + BIRTH.fade;
  return turning || warm || sweeping || ramping || born || (zoom.shown > 0 && zoom.shown < 1);
}

// ---- drawing -------------------------------------------------------------------------------------------

// The key is a flat plate on a shaft: lying flat with the switch open, standing upright with it closed.
function drawKey() {
  const K = SIZES.key;
  const angle = (lamp.turn * Math.PI) / 2;
  const across = [K.half * Math.cos(angle), K.half * Math.sin(angle)];
  const corner = (x, sign) => [x, LAMP.y + sign * across[0], K.z + sign * across[1]];
  write(parts.paddle, "d", trace([corner(K.shaft, 1), corner(K.x1, 1), corner(K.x1, -1), corner(K.shaft, -1)], true));
}

function filamentPath() {
  if (!lamp.broken) return trace(Layout.filamentPoints());
  return trace(Layout.filamentPoints(0, BROKEN_GAP[0], 24)) + trace(Layout.filamentPoints(BROKEN_GAP[1], 1, 24));
}

// Burning in air, the glow flickers.
function flickerOf() {
  if (!lamp.air || lamp.broken || lamp.temperature < Lamp.GLOW_KELVIN) return 1;
  return 0.8 + 0.2 * Math.sin(lamp.time * 61) * Math.sin(lamp.time * 23);
}

function drawFilament(assembled) {
  const temperature = lamp.temperature;
  const brightness = Math.min(1.15, Lamp.brightnessOf(temperature)) * flickerOf();
  const colour = Lamp.colourOf(temperature);
  const rim = Lamp.colourOf(temperature - 420);
  const d = filamentPath();
  write(parts.filament, "d", d);
  write(parts.bloom, "d", d);
  write(parts.rim, "d", d);
  write(parts.rim, "stroke", `rgb(${Lamp.colourOf(Math.min(temperature - 620, 1320)).join(",")})`);
  write(parts.rim, "hot", String(Math.round(Math.min(1, brightness) * 100) / 100));
  setGlow(parts.rim, Lamp.smooth(1250, 1700, temperature));
  write(parts.filament, "stroke", `rgb(${colour.join(",")})`);
  write(parts.filament, "hot", String(Math.round(Math.min(1, brightness) * 100) / 100));
  write(parts.bloom, "stroke", `rgb(${rim.join(",")})`);
  setGlow(parts.bloom, Math.min(1, Lamp.smooth(Lamp.GLOW_KELVIN - 80, 1500, temperature) * flickerOf()));
  setGlow(parts.halo, Math.min(1, brightness ** 0.8));
  setGlow(parts.ambient, Math.min(1, brightness) * assembled);
  setGlow(parts.glassWarm, Math.min(1, brightness));
  setGlow(parts.air, shown.air);
}

function drawTrace() {
  const levels = Lamp.traceLevels(lamp);
  parts.chips.forEach((chip, index) => setGlow(chip, levels[index]));
}

function drawSteps() {
  const levels = Lamp.stepLevels(lamp);
  parts.stepItems.forEach((item, index) => setGlow(item, levels[index]));
}

function readoutText() {
  const state = Lamp.stateText(lamp);
  const current = `${Lamp.currentOf(lamp).toFixed(2)} A`;
  if (lamp.broken) return `${state} · ${current}`;
  const heat = `${Lamp.celsiusText(lamp.temperature)}, ${Lamp.heatWord(lamp.temperature)}`;
  const glowing = lamp.temperature >= Lamp.GLOW_KELVIN;
  const lit = glowing ? ` · lit for ${lamp.litSeconds.toFixed(1)} s` : "";
  // The page shows the voltage beside its slider; the film has no slider, so its readout carries it.
  const volts = EX.film ? `${Math.round(lamp.volts)} V · ` : "";
  return `${state} · ${volts}${current} · ${heat}${lit}`;
}

function easeOut(share) {
  const left = 1 - Lamp.clamp(share, 0, 1);
  return 1 - left * left * left;
}

// The zoom frame is born from the model: a thin rectangle appears round the filament, the frame grows
// out of it to its place with four dashed lines joining the corners, and then rectangle and lines fade.
function drawZoom(view) {
  const source = CONFIG.zoom.source;
  const frame = CONFIG.zoom.frame;
  const age = zoom.age;
  const born = age >= BIRTH.mark;
  const grown = born ? easeOut((age - BIRTH.mark) / BIRTH.grow) : 0;
  const fading = 1 - Lamp.smooth(0, BIRTH.fade, age - BIRTH.mark - BIRTH.grow - BIRTH.linger);
  const onScreen = (x, y) => [EX.width / 2 + (x - view.x) * view.zoom, EX.height / 2 + (y - view.y) * view.zoom];
  const startCentre = onScreen(source.x, source.y);
  const start = { x: startCentre[0] - (source.width * view.zoom) / 2, y: startCentre[1] - (source.height * view.zoom) / 2, width: source.width * view.zoom, height: source.height * view.zoom };
  const now = {};
  for (const name of ["x", "y", "width", "height"]) now[name] = start[name] + (frame[name] - start[name]) * grown;
  const scale = now.width / source.width;
  const corner = (frame.corner * scale) / source.scale;
  for (const rect of parts.zoomRects) {
    write(rect, "x", now.x.toFixed(1));
    write(rect, "y", now.y.toFixed(1));
    write(rect, "width", now.width.toFixed(1));
    write(rect, "height", now.height.toFixed(1));
    write(rect, "rx", corner.toFixed(1));
  }
  write(parts.zoomUse, "transform", `translate(${(now.x + now.width / 2).toFixed(2)} ${(now.y + now.height / 2).toFixed(2)}) scale(${scale.toFixed(4)}) translate(${(-source.x).toFixed(2)} ${(-source.y).toFixed(2)})`);
  const weight = parseFloat(getComputedStyle(document.body).getPropertyValue("--anatomy-weight")) || 1;
  write(parts.zoomUse, "weight", `${((weight * ZOOM_LINE_GAIN) / Math.max(1, scale)).toFixed(3)}px`);
  const ties = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([right, down]) => `M${(start.x + start.width * right).toFixed(1)} ${(start.y + start.height * down).toFixed(1)}L${(now.x + now.width * right).toFixed(1)} ${(now.y + now.height * down).toFixed(1)}`);
  write(parts.zoomTies, "d", ties.join(""));
  setGlow(parts.zoomSource, age < 0 ? 0 : Lamp.smooth(0, BIRTH.mark, age) * fading * zoom.shown);
  setGlow(parts.zoomTies, born ? Lamp.smooth(0, 0.12, age - BIRTH.mark) * fading * zoom.shown : 0);
  setGlow(parts.zoom, born ? Lamp.smooth(0, 0.1, age - BIRTH.mark) * zoom.shown : 0);
}

function draw() {
  const assembled = 1 - Math.min(1, Math.max(0, Explode.maxShare(explode)));
  drawKey();
  for (const name of Lamp.PATH_SEGMENTS) setGlow(parts.segments[name], Lamp.segmentGlow(lamp, name) * assembled);
  drawFilament(assembled);
  drawTrace();
  drawSteps();
  const text = apartReadout() ?? readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  write(switchButton, "aria-pressed", String(lamp.wanted));
  write(switchButton, "text", lamp.wanted ? "Switch off" : "Switch on");
  write(voltsText, "text", `${Math.round(supply.target)} V`);
  if (Number(voltsInput.value) !== Math.round(supply.target)) voltsInput.value = String(Math.round(supply.target));
  write(stage, "data-stage", lamp.broken ? "broken" : lamp.closed ? "on" : "off");
  drawApart();
}

// ---- loop, pointer, keyboard ---------------------------------------------------------------------------

function tick(now) {
  const dt = clock.last ? Math.min((now - clock.last) / 1000, 1 / 30) : 1 / 60;
  clock.last = now;
  const flying = stepApart(dt);
  if (!still.matches) advance(dt);
  draw();
  const active = flying || (!still.matches && (lampBusy() || wantsTour()));
  clock.frame = clock.visible && active ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

function quietTour() {
  clock.touring = false;
  clearTimeout(clock.resumeTimer);
  // On the recorder's clock nothing happens by itself.
  if (manual) return;
  clock.resumeTimer = setTimeout(() => {
    clock.touring = tourAllowed && !still.matches;
    clock.tourTime = lamp.wanted ? 2 : 0;
    run();
  }, RESUME_AFTER);
}

// Reduced motion: no travel and no warming up; the lamp jumps to where it settles.
function afterAction() {
  quietTour();
  if (still.matches) {
    Lamp.setVolts(lamp, supply.target);
    for (const event of Lamp.step(lamp, STILL_SECONDS)) lampEvent(event);
    shown.air = lamp.air ? 1 : 0;
    stepZoom(0);
  }
  draw();
  run();
}

function toggleSwitch() {
  if (apartBusy()) return;
  Lamp.setSwitch(lamp, !lamp.wanted);
  afterAction();
}

function changeVolts(volts) {
  supply.target = Lamp.clamp(volts, Lamp.MIN_VOLTS, Lamp.MAX_VOLTS);
  say(`Supply set to ${Math.round(supply.target)} volts.`);
  afterAction();
}

function letAirIn() {
  if (apartBusy() || lamp.air) return;
  Lamp.letAirIn(lamp);
  emit("air-in", {});
  say("Air let into the bulb.");
  afterAction();
}

function mendLamp() {
  if (apartBusy()) return;
  Lamp.mend(lamp);
  emit("mend", {});
  say("New filament fitted and the bulb pumped out again.");
  afterAction();
}

function hold(value) {
  clock.held = value;
  if (!value) quietTour();
  run();
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  // Shift+E belongs to the exploded view (apart.js).
  if (event.shiftKey && event.key.toUpperCase() === "E") return;
  const actions = {
    Enter: toggleSwitch,
    " ": toggleSwitch,
    ArrowUp: () => changeVolts(supply.target + VOLTS_STEP),
    ArrowDown: () => changeVolts(supply.target - VOLTS_STEP),
    a: letAirIn,
    n: mendLamp,
  };
  const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (!action) return;
  event.preventDefault();
  action();
}

if (!manual) {
  stage.addEventListener("pointerenter", () => hold(true));
  stage.addEventListener("pointerleave", () => hold(false));
  stage.addEventListener("focusin", () => hold(true));
  stage.addEventListener("focusout", () => hold(false));
  stage.addEventListener("click", toggleSwitch);
  stage.addEventListener("keydown", onKey);
  switchButton.addEventListener("click", toggleSwitch);
  airButton.addEventListener("click", letAirIn);
  mendButton.addEventListener("click", mendLamp);
  voltsInput.addEventListener("input", () => changeVolts(Number(voltsInput.value)));
  new IntersectionObserver(
    (entries) => {
      clock.visible = entries[entries.length - 1].isIntersecting;
      if (clock.visible) run();
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
  still.addEventListener("change", () => {
    clock.touring = tourAllowed && !still.matches;
    draw();
    run();
  });
}
