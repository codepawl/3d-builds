// The live half of the Morse telegraph figure. The build inlines this file after the kit, the pure model
// (Morse), the size table (Layout) and CONFIG. It fills the slots the build left: the three levers, the
// lit path, the marks on the tape, the gear spokes and the trace under the figure. Every lever angle,
// every lit stretch and every mark comes from the model's list of key presses.

const P = CONFIG.projection;
const SIZES = Layout.sizes;
// One beat of the model's clock is the length of a dot; this is how many seconds it lasts on the page.
const PACE_SECONDS = 0.13;
const RESUME_AFTER = 3600;
const TOUR_TEXT = "WHAT HATH GOD WROUGHT ";
const TOUR_PAUSE_BEATS = 10;
// The clockwork runs on this long after the last mark, so the mark comes out from under the rollers.
const LINGER_BEATS = 16;
const DRIVE_TICK_SECONDS = 0.31;
const READ_LENGTH = 14;
const STRIP = { stylusAt: 282, perBeat: 6, top: 24.5, height: 7 };

const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const stepButton = document.querySelector("[data-step]");
const clearButton = document.querySelector("[data-clear]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";
// ?tour=off keeps the telegraph still until the reader sends something: for tests and for embedding.
const tourAllowed = query.get("tour") !== "off";

function one(name) {
  return document.querySelector(`[data-dyn="${name}"]`);
}

// Every slot of one kind, grouped by an attribute: a lever may be drawn in more than one piece.
function grouped(name, attribute) {
  const found = {};
  for (const element of document.querySelectorAll(`[data-dyn="${name}"]`)) {
    const key = element.getAttribute(attribute);
    found[key] = found[key] ?? [];
    found[key].push(element);
  }
  return found;
}

function keyed(name, attribute) {
  const found = {};
  for (const element of document.querySelectorAll(`[data-dyn="${name}"]`)) found[element.getAttribute(attribute)] = element;
  return found;
}

const parts = {
  levers: grouped("tilt", "data-lever"),
  segments: grouped("segment", "data-segment"),
  spokes: keyed("spokes", "data-wheel"),
  marks: one("marks"),
  traceLetter: document.querySelector('[data-trace="letter"]'),
  traceCode: document.querySelector('[data-trace="code"]'),
  stripMarks: document.querySelector('[data-trace="marks"]'),
  stripReads: document.querySelector('[data-trace="reads"]'),
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

const trace = (points, closed = false) => pathOf(points.map((point) => iso(point, P)), closed);

// ---- state ---------------------------------------------------------------------------------------------

const line = Morse.createLine();
const clock = { beats: 0, elapsed: 0, pace: PACE_SECONDS, touring: false, held: false, visible: manual, frame: 0, last: 0, resumeTimer: 0, activeUntil: 0, tourAt: 0, driveAt: 0 };
const sending = { tourIndex: 0, sent: "" };
// The film shows the five numbered steps of a signal; the page leaves them to the trace.
const steps = { shown: 0 };

function say(text) {
  if (announcer) announcer.textContent = text;
}

function wantsTour() {
  return clock.touring && !clock.held && !still.matches && !apartBusy();
}

function sendCharacter(character) {
  Morse.sendCharacter(line, character, clock.beats);
  if (character !== " ") sending.sent = (sending.sent + character).slice(-READ_LENGTH);
}

function nextTourCharacter() {
  const character = TOUR_TEXT[sending.tourIndex % TOUR_TEXT.length];
  sending.tourIndex += 1;
  return character;
}

// The idle tour sends the first message a letter at a time, with a pause after each word.
function tourStep() {
  if (!wantsTour() || !Morse.isIdle(line, clock.beats) || clock.beats < clock.tourAt) return;
  let character = nextTourCharacter();
  if (character === " ") {
    clock.tourAt = clock.beats + TOUR_PAUSE_BEATS;
    return;
  }
  sendCharacter(character);
}

function driveTicks(seconds, from) {
  while (clock.driveAt <= from + seconds) {
    if (clock.driveAt > from) emit("drive-tick", {}, clock.driveAt);
    clock.driveAt += DRIVE_TICK_SECONDS;
  }
}

// Plays `seconds` of the telegraph's clock. Nothing moves while the model is apart: the clockwork stands.
// Every stretch reports what can be heard, with the clock time at which it falls.
function advance(seconds) {
  if (!apartBusy()) {
    tourStep();
    const before = clock.beats;
    clock.beats += seconds / clock.pace;
    for (const event of Morse.eventsBetween(line, before, clock.beats)) {
      emit(event.name, {}, clock.elapsed + (event.at - before) * clock.pace);
      if (event.name === "relay-pull") startInset();
    }
    if (!Morse.isIdle(line, clock.beats)) clock.activeUntil = clock.beats + LINGER_BEATS;
    if (clock.beats < clock.activeUntil) driveTicks(seconds, clock.elapsed);
    else clock.driveAt = clock.elapsed + seconds + DRIVE_TICK_SECONDS;
    Morse.forgetOld(line, clock.beats);
  }
  clock.elapsed += seconds;
}

function isRunning() {
  return !Morse.isIdle(line, clock.beats) || clock.beats < clock.activeUntil;
}

// ---- drawing -------------------------------------------------------------------------------------------

const worldZeroPoint = iso([0, 0, 0], P);
const alongX = iso([1, 0, 0], P).map((value, index) => value - worldZeroPoint[index]);
const alongZ = iso([0, 0, 1], P).map((value, index) => value - worldZeroPoint[index]);

// A lever turning about a pivot pin that lies along y: `angle` lowers its +x end. For the points in the
// pivot's own plane this is exact, and the levers are thin, so it serves for the whole of each.
function tiltMatrix(pivot, angle) {
  if (Math.abs(angle) < 1e-5) return null;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const determinant = alongX[0] * alongZ[1] - alongZ[0] * alongX[1];
  // The turned axes: x goes to x·cos − z·sin, z to x·sin + z·cos (in world), each drawn on screen.
  const turnedX = [alongX[0] * cosine - alongZ[0] * sine, alongX[1] * cosine - alongZ[1] * sine];
  const turnedZ = [alongX[0] * sine + alongZ[0] * cosine, alongX[1] * sine + alongZ[1] * cosine];
  const a = (turnedX[0] * alongZ[1] - turnedZ[0] * alongX[1]) / determinant;
  const c = (turnedZ[0] * alongX[0] - turnedX[0] * alongZ[0]) / determinant;
  const b = (turnedX[1] * alongZ[1] - turnedZ[1] * alongX[1]) / determinant;
  const d = (turnedZ[1] * alongX[0] - turnedX[1] * alongZ[0]) / determinant;
  const centre = iso(pivot, P);
  const e = centre[0] - a * centre[0] - c * centre[1];
  const f = centre[1] - b * centre[0] - d * centre[1];
  return `matrix(${[a, b, c, d, e, f].map((value) => value.toFixed(5)).join(" ")})`;
}

function drawLevers(now) {
  const tilt = (name, pivot, angle) => parts.levers[name].forEach((node) => write(node, "transform", tiltMatrix(pivot, angle)));
  tilt("key", SIZES.key.pivot, now.key * SIZES.key.angle);
  // The relay's armature is on the −x side of its pivot, so that end goes down.
  tilt("relay", SIZES.relay.pivot, -now.relay * SIZES.relay.angle);
  tilt("register", SIZES.register.pivot, now.register * SIZES.register.angle);
}

// The marks lie on the flat run of the tape, each as far from the stylus as the tape has run since.
function drawMarks(marks) {
  const T = SIZES.tape;
  let d = "";
  for (const mark of marks) {
    const near = Math.max(T.stylusAt, Layout.markPlace(clock.beats - mark.to));
    const far = Math.min(T.end - 0.6, Layout.markPlace(clock.beats - mark.from));
    if (far <= near) continue;
    d += trace([[T.markX, near + 0.35, T.level + 0.05], [T.markX, Math.max(near + 0.36, far - 0.35), T.level + 0.05]]);
  }
  write(parts.marks, "d", d);
}

function drawSpokes() {
  const G = SIZES.register.gears;
  const face = G.x1 + 0.05;
  G.wheels.forEach((wheel, index) => {
    let d = "";
    for (let spoke = 0; spoke < wheel.spokes; spoke++) {
      const angle = clock.beats * wheel.turn + (spoke / wheel.spokes) * Math.PI * 2;
      d += trace([[face, wheel.y, wheel.z], [face, wheel.y + (wheel.r - 1) * Math.cos(angle), wheel.z + (wheel.r - 1) * Math.sin(angle)]]);
    }
    write(parts.spokes[index], "d", d);
  });
}

function elementsMarkup(code, keyed) {
  let markup = "";
  let count = 0;
  for (const symbol of code) {
    if (symbol !== " ") count += 1;
    markup += `<i class="mt-element" data-kind="${symbol}" style="--glow:${symbol !== " " && count <= keyed ? 1 : 0}"></i>`;
  }
  return markup;
}

// What the trace names: a typed letter with its code, or, when the reader keys by hand, what the tape says.
function tracedLetter(reading) {
  const last = line.presses[line.presses.length - 1];
  if (last && last.hand) {
    const read = reading.letters[reading.letters.length - 1];
    if (reading.pending) return { character: "…", code: reading.pending, keyed: 99 };
    return read ? { character: read.character, code: read.code, keyed: 99 } : null;
  }
  return Morse.letterAt(line, clock.beats);
}

function drawStrip(marks, reading) {
  const place = (beat) => STRIP.stylusAt - (clock.beats - beat) * STRIP.perBeat;
  let rects = "";
  for (const mark of marks) {
    const right = place(mark.from);
    if (right < -4) continue;
    const width = Math.max(STRIP.perBeat * 0.55, (mark.to - mark.from) * STRIP.perBeat - 1.2);
    rects += `<rect class="mt-strip-mark" x="${(place(mark.to) + 0.6).toFixed(1)}" y="${STRIP.top}" width="${width.toFixed(1)}" height="${STRIP.height}" rx="2.4"/>`;
  }
  let texts = "";
  for (const letter of reading.letters) {
    const middle = place((letter.from + letter.to) / 2);
    if (middle < 6) continue;
    texts += `<text class="mt-strip-text" x="${middle.toFixed(1)}" y="13">${letter.character}</text>`;
  }
  write(parts.stripMarks, "html", rects);
  write(parts.stripReads, "html", texts);
}

function drawTrace(marks, reading) {
  const letter = tracedLetter(reading);
  write(parts.traceLetter, "text", letter ? letter.character : "·");
  write(parts.traceCode, "html", letter ? elementsMarkup(letter.code, letter.keyed) : "");
  drawStrip(marks, reading);
}

function drawSteps() {
  const levels = Morse.stepsAt(line, clock.beats);
  parts.stepItems.forEach((item, index) => setGlow(item, levels[index]));
  return levels;
}

function readText(reading) {
  return Morse.textOf(reading).slice(-READ_LENGTH).trim();
}

// A mark that is not yet a finished letter shows as an ellipsis after what has been read.
function readSoFar(reading) {
  return `${readText(reading)}${reading.pending ? "…" : ""}`;
}

function readoutText(now, reading) {
  const key = now.closed ? "key down · circuit closed" : "key up";
  const text = readSoFar(reading);
  return `${key} · tape ${text ? `reads ${text}` : "blank"}`;
}

// ---- the zoom frame ------------------------------------------------------------------------------------
// One enlarged view of the stylus and the rollers. It is not there at first. When the signal first reaches
// the receiving bench a thin source rectangle appears on the model, the frame grows out of it to its place,
// four dashed lines join the corners of the two while it grows and for a moment after, and then the
// rectangle and the lines fade and only the frame is left.

const INSET = CONFIG.inset;
const INSET_BIRTH = { appear: 0.25, grow: 0.7, hold: 1, fade: 1.2 };
const INSET_SETTLED = 1e6;
const insetParts = {
  all: document.querySelector('[data-inset="all"]'),
  source: document.querySelector('[data-inset="source"]'),
  ties: Array.from(document.querySelectorAll('[data-inset="tie"]')),
  frame: document.querySelector('[data-inset="frame"]'),
  rects: ["clip", "paper", "edge"].map((name) => document.querySelector(`[data-inset="${name}"]`)),
  view: document.querySelector('[data-inset="view"]'),
};
// `bornAt` is the page's own clock at the birth; the film sets `seconds` and `shown` itself.
const inset = { bornAt: null, seconds: null, shown: 1 };

function insetBirthSeconds() {
  return INSET_BIRTH.appear + INSET_BIRTH.grow + INSET_BIRTH.hold + INSET_BIRTH.fade;
}

// How long ago the birth began, or null before it. With reduced motion the frame is simply there.
function insetSeconds() {
  if (manual) return inset.seconds;
  if (still.matches) return INSET_SETTLED;
  if (inset.bornAt === null) return null;
  return clock.elapsed - inset.bornAt;
}

function insetBusy() {
  const seconds = insetSeconds();
  return seconds !== null && seconds < insetBirthSeconds();
}

function startInset() {
  if (inset.bornAt === null) inset.bornAt = clock.elapsed;
}

// Where the birth stands: how strong the source rectangle and the corner lines are, and how far the frame
// has grown from the rectangle (0) to its own place (1, eased out).
function insetBirthAt(seconds) {
  if (seconds === null || seconds < 0) return { source: 0, ties: 0, frame: 0, grow: 0 };
  const growFrom = INSET_BIRTH.appear;
  const fadeFrom = growFrom + INSET_BIRTH.grow + INSET_BIRTH.hold;
  const staying = 1 - Morse.smooth(fadeFrom, fadeFrom + INSET_BIRTH.fade, seconds);
  const share = Math.min(1, Math.max(0, (seconds - growFrom) / INSET_BIRTH.grow));
  const growing = seconds >= growFrom ? 1 : 0;
  return { source: Morse.smooth(0, growFrom, seconds) * staying, ties: growing * staying, frame: growing, grow: 1 - (1 - share) ** 3 };
}

// The part of the model the frame shows, as it lies on the stage under the present view.
function insetSourceBox(view) {
  const width = (INSET.width / INSET.scale) * view.zoom;
  const height = (INSET.height / INSET.scale) * view.zoom;
  const centreX = EX.width / 2 + (INSET.focus[0] - view.x) * view.zoom;
  const centreY = EX.height / 2 + (INSET.focus[1] - view.y) * view.zoom;
  return { x: centreX - width / 2, y: centreY - height / 2, width, height, radius: INSET.radius / INSET.scale };
}

function boxBetween(from, to, share) {
  const between = {};
  for (const name of ["x", "y", "width", "height", "radius"]) between[name] = from[name] + (to[name] - from[name]) * share;
  return between;
}

function placeRect(node, box) {
  write(node, "x", box.x.toFixed(2));
  write(node, "y", box.y.toFixed(2));
  write(node, "width", box.width.toFixed(2));
  write(node, "height", box.height.toFixed(2));
  write(node, "rx", box.radius.toFixed(2));
}

function cornersOf(box) {
  return [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]];
}

function placeTies(source, frame) {
  const from = cornersOf(source);
  const to = cornersOf(frame);
  insetParts.ties.forEach((tie, index) => {
    write(tie, "x1", from[index][0].toFixed(2));
    write(tie, "y1", from[index][1].toFixed(2));
    write(tie, "x2", to[index][0].toFixed(2));
    write(tie, "y2", to[index][1].toFixed(2));
  });
}

// The frame always shows the same part of the model, so its magnification follows its width: at the
// start it is the model's own size and the frame cannot be told from the model under it.
function placeInsetView(frame, share) {
  const scale = (frame.width / INSET.width) * INSET.scale;
  const centreX = frame.x + frame.width / 2;
  const centreY = frame.y + frame.height / 2;
  const weight = INSET.lineWeight + (INSET.weight - INSET.lineWeight) * share;
  write(insetParts.view, "transform", `translate(${centreX.toFixed(2)} ${centreY.toFixed(2)}) scale(${scale.toFixed(4)}) translate(${(-INSET.focus[0]).toFixed(2)} ${(-INSET.focus[1]).toFixed(2)})`);
  write(insetParts.view, "style", `--anatomy-weight:${weight.toFixed(3)}px`);
}

function drawInset() {
  const open = Math.min(1, Math.max(0, Explode.maxShare(explode)));
  // On the page the frame leaves as soon as the model starts to come apart; the film fades it beforehand.
  const shown = manual ? inset.shown : 1 - Morse.smooth(0, 0.08, open);
  const birth = insetBirthAt(insetSeconds());
  const visible = shown > 0.001 && birth.source + birth.frame > 0.001;
  write(insetParts.all, "opacity", visible ? shown.toFixed(3) : "0");
  if (!visible) return;
  const view = worldView(open);
  const source = insetSourceBox(view);
  const frame = boxBetween(source, INSET, birth.grow);
  placeRect(insetParts.source, source);
  write(insetParts.source, "opacity", birth.source.toFixed(3));
  placeTies(source, frame);
  insetParts.ties.forEach((tie) => write(tie, "opacity", birth.ties.toFixed(3)));
  insetParts.rects.forEach((rect) => placeRect(rect, frame));
  placeInsetView(frame, birth.grow);
  write(insetParts.frame, "opacity", String(birth.frame));
}

function draw() {
  const now = Morse.stateAt(line, clock.beats);
  const marks = Morse.marksAt(line, clock.beats);
  const reading = Morse.readTape(marks, clock.beats);
  const assembled = 1 - Math.min(1, Math.max(0, Explode.maxShare(explode)));

  drawLevers(now);
  Morse.PATH_SEGMENTS.forEach((name, index) => parts.segments[name].forEach((node) => setGlow(node, now.glows[index] * assembled)));
  drawMarks(marks);
  drawSpokes();
  drawTrace(marks, reading);
  drawSteps();

  const text = apartReadout() ?? readoutText(now, reading);
  if (readout.textContent !== text) readout.textContent = text;
  write(stage, "data-stage", now.closed ? "closed" : "open");
  drawApart();
  drawInset();
}

// ---- loop, pointer, keyboard ---------------------------------------------------------------------------

function tick(time) {
  const dt = clock.last ? Math.min((time - clock.last) / 1000, 1 / 30) : 1 / 60;
  clock.last = time;
  const flying = stepApart(dt);
  if (!still.matches) advance(dt);
  draw();
  const busy = !still.matches && (isRunning() || wantsTour() || insetBusy());
  clock.frame = clock.visible && (busy || flying) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

function quietTour() {
  if (manual) return;
  clock.touring = false;
  clearTimeout(clock.resumeTimer);
  clock.resumeTimer = setTimeout(() => {
    clock.touring = tourAllowed && !still.matches;
    run();
  }, RESUME_AFTER);
}

// Reduced motion: nothing travels. The clock jumps to the moment after the signal has passed, and the
// figure shows the tape with its new marks.
function settleStill() {
  const last = line.presses[line.presses.length - 1];
  if (last && last.up !== null) clock.beats = Math.max(clock.beats, last.up + Morse.MARK_LAG + Morse.BEATS.letterGap);
  draw();
}

function typeCharacter(character) {
  if (apartBusy() || Morse.heldPress(line)) return;
  quietTour();
  sendCharacter(character);
  say(character === " " ? "A word space." : `${character} sent as ${Morse.CODE[character].replaceAll(".", "dot ").replaceAll("-", "dash ").replaceAll("=", "long dash ").replaceAll("#", "longer dash ").trim()}.`);
  if (still.matches) settleStill();
  run();
}

function typeNext() {
  let character = nextTourCharacter();
  if (character === " ") character = nextTourCharacter();
  typeCharacter(character);
}

// The reader's own hand on the key: down closes the circuit, up opens it.
function handDown() {
  if (apartBusy()) return;
  quietTour();
  if (!Morse.pressKey(line, clock.beats)) return;
  clock.activeUntil = clock.beats + LINGER_BEATS;
  run();
}

function handUp() {
  if (!Morse.releaseKey(line, clock.beats)) return;
  if (still.matches) settleStill();
  run();
}

function clearTape() {
  if (apartBusy() || Morse.heldPress(line)) return;
  line.presses.length = 0;
  line.letters.length = 0;
  line.busyUntil = clock.beats;
  sending.sent = "";
  say("A fresh length of tape.");
  quietTour();
  draw();
  run();
}

function hold(value) {
  clock.held = value;
  if (!value) quietTour();
  run();
}

function onKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (!event.repeat) handDown();
    return;
  }
  const character = event.key.toUpperCase();
  if (event.key.length !== 1 || !Object.hasOwn(Morse.CODE, character)) return;
  // Shift+E belongs to the exploded view (apart.js).
  if (event.shiftKey && character === "E") return;
  event.preventDefault();
  if (!event.repeat) typeCharacter(character);
}

function onKeyUp(event) {
  if (event.key === " " || event.key === "Enter") handUp();
}

if (!manual) {
  stage.addEventListener("pointerenter", () => hold(true));
  stage.addEventListener("pointerleave", () => {
    handUp();
    hold(false);
  });
  stage.addEventListener("focusin", () => hold(true));
  stage.addEventListener("focusout", () => {
    handUp();
    hold(false);
  });
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    handDown();
  });
  addEventListener("pointerup", handUp);
  addEventListener("pointercancel", handUp);
  stage.addEventListener("keydown", onKeyDown);
  stage.addEventListener("keyup", onKeyUp);
  stepButton.addEventListener("click", typeNext);
  clearButton.addEventListener("click", clearTape);
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
