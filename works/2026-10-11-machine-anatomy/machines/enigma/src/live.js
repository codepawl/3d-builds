// The live half of the Enigma figure. The build inlines this file after the kit, the pure model
// (Enigma), the size table (Layout) and CONFIG. It fills the empty slots the build left: the pressed key,
// the rotors' letters, teeth and notches, the pawls, the cables, the lit path and the lamp. Every letter
// and every contact it draws comes from Enigma.press().

const P = CONFIG.projection;
const SIZES = Layout.sizes;
const STACK = SIZES.stack;
const T = Enigma.TIMELINE;
const ROTORS = [0, 1, 2];
const ROTOR_NAMES = ["left", "middle", "right"];
const PRESS_SECONDS = 2.2;
const STILL_PHASE = 0.7;
const RESUME_AFTER = 3600;
const TOUR_TEXT = "ENIGMA";
const QUEUE_LIMIT = 12;
const TAPE_LENGTH = 8;
const START_PLUGS = [["A", "T"], ["G", "L"]];
const LETTERS_BEHIND = 6;
const CABLE_STEPS = 18;
// The wire to the reflector and the wire back lie this far to either side of any run they share.
const RUN_SIDE = SIZES.wiring.side;
// How far a pawl that has dropped into a notch leans in towards its ratchet.
const PAWL_BITE = 2.4;
const TOOTH_DEPTH = 1.7;
const PLUGBOARD_PLACE = "plugboard";

const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const announcer = document.querySelector("[data-announce]");
const stepButton = document.querySelector("[data-step]");
const resetButton = document.querySelector("[data-reset]");
const clearButton = document.querySelector("[data-clear]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const query = new URLSearchParams(location.search);
const manual = query.get("clock") === "manual";
// ?tour=off keeps the machine still until the reader types: for tests and for embedding.
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
  keys: keyed("key", "data-letter"),
  lamps: keyed("lamp", "data-letter"),
  sockets: keyed("socket", "data-letter"),
  segments: keyed("segment", "data-segment"),
  windows: keyed("window", "data-rotor"),
  notches: keyed("notch", "data-rotor"),
  tyreTicks: keyed("tyre-ticks", "data-rotor"),
  tyreLetters: keyed("tyre-letters", "data-rotor"),
  wheelGrips: keyed("wheel-grips", "data-rotor"),
  ratchetTeeth: keyed("ratchet-teeth", "data-rotor"),
  pawls: keyed("pawl", "data-rotor"),
  cables: one("cables"),
  wires: one("wires"),
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
const VIEW = [camera.cosA * camera.cosE, camera.sinA * camera.cosE, camera.sinE];
const trace = (points, closed = false) => pathOf(points.map((point) => iso(point, P)), closed);

// How squarely a point at `angle` round the spindle faces the viewer; below zero it is on the far side.
function facing(angle) {
  return Math.cos(angle) * VIEW[1] + Math.sin(angle) * VIEW[2];
}

function textMatrix(point, along, down) {
  const origin = iso(point, P);
  const right = iso([point[0] + along[0], point[1] + along[1], point[2] + along[2]], P);
  const below = iso([point[0] + down[0], point[1] + down[1], point[2] + down[2]], P);
  const numbers = [right[0] - origin[0], right[1] - origin[1], below[0] - origin[0], below[1] - origin[1], origin[0], origin[1]];
  return `matrix(${numbers.map((value) => value.toFixed(3)).join(" ")})`;
}

// ---- state ---------------------------------------------------------------------------------------------

const machine = Enigma.createMachine({ plugs: query.get("plugs") === "none" ? [] : START_PLUGS });
const clock = { phase: 1, touring: false, held: false, visible: manual, frame: 0, last: 0, pressSeconds: PRESS_SECONDS, resumeTimer: 0, elapsed: 0 };
const typing = { queue: [], current: null, tourIndex: 0, input: "", output: "", picked: null, cablesDrawn: null, wiresDrawn: null, shown: [null, null, null] };
// The film shows the six numbered steps of a key press; the page leaves them to the letter trace.
const steps = { shown: 0 };

const TRACE_PLACES = Enigma.traceStages(machine, { path: Enigma.tracePath(machine, "A") }).map((stage) => (stage.segment.startsWith("plug") ? PLUGBOARD_PLACE : stage.place));

function say(text) {
  if (announcer) announcer.textContent = text;
}

function tourLetter() {
  const letter = TOUR_TEXT[typing.tourIndex % TOUR_TEXT.length];
  typing.tourIndex += 1;
  return letter;
}

function wantsTour() {
  return clock.touring && !clock.held && !still.matches && !apartBusy();
}

function nextLetter() {
  if (typing.queue.length) return typing.queue.shift();
  return wantsTour() ? tourLetter() : null;
}

function startPress(letter) {
  typing.current = Enigma.press(machine, letter);
  typing.input = (typing.input + letter).slice(-TAPE_LENGTH);
  typing.output = (typing.output + typing.current.output).slice(-TAPE_LENGTH);
  drawPath(typing.current);
  clock.phase = 0;
  const moved = ROTORS.filter((rotor) => typing.current.stepped[rotor]).map((rotor) => ROTOR_NAMES[rotor]);
  say(`${letter} pressed. The ${moved.join(" and ")} rotor${moved.length > 1 ? "s step" : " steps"} to ${Enigma.positionsText(machine.positions)}; lamp ${typing.current.output} lights.`);
}

// Plays `seconds` of the machine's clock. No key goes down while the machine is apart or about to come
// apart, and every stretch of a press reports its sound cues with the clock time at which they fall.
function advance(seconds) {
  let left = seconds / clock.pressSeconds;
  let at = clock.elapsed;
  while (left > 1e-9) {
    if (clock.phase >= 1) {
      if (apartBusy()) break;
      const letter = nextLetter();
      if (!letter) break;
      startPress(letter);
    }
    const from = clock.phase;
    const step = Math.min(left, 1 - clock.phase);
    clock.phase += step;
    left -= step;
    if (clock.phase > 1 - 1e-9) clock.phase = 1;
    soundEvents(from, clock.phase, at);
    at += step * clock.pressSeconds;
  }
  clock.elapsed += seconds;
}

// Ends whatever press is showing, so a setting can change. False while the machine is apart.
function settle() {
  if (apartBusy()) return false;
  typing.queue.length = 0;
  typing.current = null;
  clock.phase = 1;
  return true;
}

// ---- the path of the current ---------------------------------------------------------------------------

function cablePoints(first, second) {
  const B = SIZES.plugboard;
  const a = Layout.socketPoint(first);
  const b = Layout.socketPoint(second);
  const sag = 5 + Math.abs(b[0] - a[0]) * 0.07;
  const points = [a, [a[0], a[1] + B.plugLength, a[2]]];
  for (let step = 1; step < CABLE_STEPS; step++) {
    const share = step / CABLE_STEPS;
    const swell = Math.sin(Math.PI * share);
    points.push([a[0] + (b[0] - a[0]) * share, a[1] + B.plugLength + B.bow * swell, a[2] + (b[2] - a[2]) * share - sag * swell]);
  }
  points.push([b[0], b[1] + B.plugLength, b[2]], b);
  return points;
}

// The lit run of a cable: in at the upper hole of one socket, out at the lower hole of the other
// (or the other way round on the way back), along the cable between the two plugs.
function cableRun(first, second, fromUpper) {
  const out = (point) => [point[0], point[1] + SIZES.plugboard.plugLength, point[2]];
  const enters = Layout.socketHole(first, fromUpper);
  const leaves = Layout.socketHole(second, !fromUpper);
  return [enters, out(enters), ...cablePoints(first, second).slice(1, -1), out(leaves), leaves];
}

// Towards the reflector a rotor is entered at a pin on its right face and left at a contact on its
// left face; on the way back it is the other way round. The piece starts on the part that hands over.
function throughRotor(rotor, from, to, inwards) {
  const faces = Layout.rotorFaces(rotor);
  if (inwards) {
    const handedFrom = rotor === 2 ? STACK.entry.x0 : Layout.rotorFaces(rotor + 1).left;
    return [Layout.contactPoint(handedFrom, from), ...Layout.rotorWire(faces.right, faces.left, from, to)];
  }
  const handedFrom = rotor === 0 ? STACK.reflector.x1 : Layout.rotorFaces(rotor - 1).right;
  return [Layout.contactPoint(handedFrom, from), ...Layout.rotorWire(faces.left, faces.right, from, to)];
}

// Into the reflector at one contact, along the wire that pairs it with another, and out there.
function reflectorTurn(from, to) {
  const left = Layout.rotorFaces(0).left;
  return [Layout.contactPoint(left, from), ...Layout.reflectorWire(STACK.reflector.x1, from, to), Layout.contactPoint(left, to)];
}

function segmentsOf(press) {
  const path = press.path;
  const plugged = Enigma.letterOf(path.plugIn);
  const leaving = Enigma.letterOf(path.exit);
  const cableIn = path.plugIn !== path.key;
  const cableOut = path.exit !== path.lamp;
  return {
    key: Layout.keyRoute(press.letter, RUN_SIDE, cableIn),
    plugIn: cableIn ? cableRun(press.letter, plugged, true) : [],
    harnessIn: Layout.harnessRoute(plugged, path.plugIn, RUN_SIDE),
    right: throughRotor(2, path.plugIn, path.forward[0], true),
    middle: throughRotor(1, path.forward[0], path.forward[1], true),
    left: throughRotor(0, path.forward[1], path.forward[2], true),
    reflector: reflectorTurn(path.forward[2], path.reflected),
    leftBack: throughRotor(0, path.reflected, path.backward[0], false),
    middleBack: throughRotor(1, path.backward[0], path.backward[1], false),
    rightBack: throughRotor(2, path.backward[1], path.backward[2], false),
    harnessOut: Layout.harnessRoute(leaving, path.exit, -RUN_SIDE).reverse(),
    plugOut: cableOut ? cableRun(leaving, press.output, false) : [],
    lamp: Layout.lampRoute(press.output, -RUN_SIDE, cableOut),
  };
}

function drawPath(press) {
  const segments = segmentsOf(press);
  for (const name of Enigma.PATH_SEGMENTS) write(parts.segments[name], "d", segments[name].length ? trace(segments[name]) : "");
}

// ---- drawing -------------------------------------------------------------------------------------------

// Lines across a turned part, one every `every` letters, wherever the part faces the viewer.
function crossLines(part, shown, ahead, every) {
  let d = "";
  for (let index = 0; index < Enigma.LETTERS; index += every) {
    const angle = Layout.letterAngle(index + ahead - shown);
    if (facing(angle) < 0.06) continue;
    d += trace([Layout.aroundSpindle(part.x0, part.r, angle), Layout.aroundSpindle(part.x1, part.r, angle)]);
  }
  return d;
}

function drawTyreLetters(rotor, tyre, shown) {
  const x = (tyre.x0 + tyre.x1) / 2;
  const first = Math.floor(shown) - LETTERS_BEHIND;
  Array.from(parts.tyreLetters[rotor].children).forEach((node, slot) => {
    const angle = Layout.letterAngle(first + slot - shown);
    const seen = Math.min(1, Math.max(0, (facing(angle) - 0.08) / 0.2));
    write(node, "opacity", seen.toFixed(2));
    if (seen === 0) return;
    write(node, "transform", textMatrix(Layout.aroundSpindle(x, tyre.r + 0.05, angle), [1, 0, 0], [0, Math.sin(angle), -Math.cos(angle)]));
    write(node, "text", Enigma.ringNumber(first + slot));
  });
}

// The notch reaches the pawl, at the back of the rotor, when its letter is in the window.
function drawNotch(rotor, ring, shown) {
  const angle = Math.PI + (Enigma.notchIndex(machine, rotor) - shown) * Layout.stepAngle;
  const seen = facing(angle) >= 0.06;
  write(parts.notches[rotor], "d", seen ? trace([Layout.aroundSpindle(ring.x0, ring.r, angle), Layout.aroundSpindle(ring.x1, ring.r, angle)]) : "");
}

// The 26 teeth of the ratchet, drawn on its right face: each rises slowly and drops sharply.
function ratchetTeeth(part, shown) {
  const points = [];
  for (let tooth = 0; tooth < Enigma.LETTERS; tooth++) {
    const angle = Layout.letterAngle(tooth + 0.5 - shown);
    points.push(Layout.aroundSpindle(part.x1, part.r - TOOTH_DEPTH, angle), Layout.aroundSpindle(part.x1, part.r - 0.2, angle + Layout.stepAngle));
  }
  return trace(points, true);
}

function drawRotor(rotor, shown) {
  if (typing.shown[rotor] === shown) return;
  typing.shown[rotor] = shown;
  const rotorParts = Layout.rotorParts(rotor);
  write(parts.tyreTicks[rotor], "d", crossLines(rotorParts.tyre, shown, 0.5, 1));
  write(parts.wheelGrips[rotor], "d", crossLines(rotorParts.fingerWheel, shown, 0, 2));
  write(parts.ratchetTeeth[rotor], "d", crossLines(rotorParts.ratchet, shown, 0.5, 1) + ratchetTeeth(rotorParts.ratchet, shown));
  drawTyreLetters(rotor, rotorParts.tyre, shown);
  drawNotch(rotor, rotorParts.notchRing, shown);
  write(parts.windows[rotor], "text", Enigma.ringNumber(shown));
}

// While a press plays, a stepping rotor is shown part-way between the letter it left and the next.
function shownPosition(rotor, press, pose) {
  if (!press) return machine.positions[rotor];
  return press.before[rotor] + (press.stepped[rotor] ? pose.step : 0);
}

// A plug has two pins, one for each hole of the socket, on a common body.
function plugShape(letter) {
  const out = (point) => [point[0], point[1] + SIZES.plugboard.plugLength, point[2]];
  const upper = Layout.socketHole(letter, true);
  const lower = Layout.socketHole(letter, false);
  return trace([upper, out(upper)]) + trace([lower, out(lower)]) + trace([out(upper), out(lower)]);
}

// The right rotor's 26 wires, from its pins to its contacts, shown while its two halves are apart.
function drawOpenRotor() {
  const share = Math.min(1, Math.max(0, Explode.shareOf(explode, "cap")));
  const shift = machine.positions[2] - machine.rings[2];
  const key = `${share.toFixed(3)} ${shift}`;
  if (typing.wiresDrawn === key) return;
  typing.wiresDrawn = key;
  parts.wires.style.setProperty("--wires", Enigma.smooth(0.05, 0.45, share).toFixed(2));
  if (share < 0.02) {
    write(parts.wires, "d", "");
    return;
  }
  const rotorParts = Layout.rotorParts(2);
  const pins = rotorParts.fingerWheel.x0 + Explode.PIECES.cap.move[0] * share;
  const wiring = Enigma.ROTORS[machine.rotorNames[2]].wiring;
  let d = "";
  for (let pin = 0; pin < Enigma.LETTERS; pin++) d += trace(Layout.rotorWire(pins, rotorParts.tyre.x1, pin - shift, Enigma.indexOf(wiring[pin]) - shift));
  write(parts.wires, "d", d);
}

// The strip of letters: what the current stands for after each stage, lit as the path gets there.
function drawTrace() {
  const press = typing.current;
  const stages = press ? Enigma.traceStages(machine, press) : null;
  parts.chips.forEach((chip, index) => {
    const stage = stages ? stages[index] : null;
    const start = stage ? Enigma.segmentStart(Enigma.PATH_SEGMENTS.indexOf(stage.segment)) : 0;
    write(chip.firstChild, "text", stage ? stage.place : TRACE_PLACES[index]);
    write(chip.lastChild, "text", stage ? stage.letter : "·");
    setGlow(chip, stage ? Enigma.smooth(start, start + T.pathRise, clock.phase) : 0);
  });
}

function drawSteps() {
  const levels = typing.current ? Enigma.stepsAt(clock.phase) : Enigma.STEPS.map(() => 0);
  parts.stepItems.forEach((item, index) => setGlow(item, levels[index]));
  return levels;
}

function drawCables() {
  const pairs = Enigma.plugPairs(machine);
  const key = pairs.map((pair) => pair.join("")).join(" ");
  if (typing.cablesDrawn === key) return;
  typing.cablesDrawn = key;
  let markup = "";
  for (const [first, second] of pairs) {
    const points = cablePoints(first, second);
    markup += `<path class="en-cable" d="${trace(points.slice(1, -1))}"/>`;
    markup += `<path class="en-plug" d="${plugShape(first)}${plugShape(second)}"/>`;
  }
  write(parts.cables, "html", markup);
}

// The lamp's letter joins the readout when the lamp lights, not when the key goes down.
function readoutText() {
  const windows = `windows ${Enigma.windowsText(machine.positions)} · ${Enigma.positionsText(machine.positions)}`;
  const press = typing.current;
  if (!press) return `${windows} · type a letter`;
  const lamp = clock.phase < T.lamp[0] ? "·" : press.output;
  return `${windows} · ${press.letter} → ${lamp}`;
}

function draw() {
  const pose = Enigma.poseAt(clock.phase);
  const glow = Enigma.glowAt(clock.phase);
  const press = clock.phase < 1 ? typing.current : null;
  const assembled = 1 - Math.min(1, Math.max(0, Explode.maxShare(explode)));

  for (const letter of Layout.letters) {
    const down = press && letter === press.letter ? pose.key : 0;
    write(parts.keys[letter], "transform", down > 0 ? translateAlong(P, [0, 0, -SIZES.keyboard.travel * down]) : null);
    setGlow(parts.lamps[letter], press && letter === press.output ? glow.lamp * assembled : 0);
    write(parts.sockets[letter], "data-picked", letter === typing.picked ? "" : null);
  }
  for (const rotor of ROTORS) drawRotor(rotor, shownPosition(rotor, press, pose));
  // All three pawls rise together; only one that finds a notch (the right one always does) leans in and pushes.
  for (const rotor of ROTORS) {
    const lift = press ? pose.pawl * SIZES.pawls.lift : 0;
    const bite = press && press.engaged[rotor] ? pose.pawl * PAWL_BITE : 0;
    write(parts.pawls[rotor], "transform", lift > 0 ? translateAlong(P, [0, bite, lift]) : null);
  }
  Enigma.PATH_SEGMENTS.forEach((name, index) => setGlow(parts.segments[name], press ? glow.segments[index] * assembled : 0));
  drawCables();
  drawOpenRotor();
  drawTrace();
  drawSteps();

  const text = apartReadout() ?? readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  write(stage, "data-stage", clock.phase >= 1 ? "resting" : "pressing");
  drawApart();
}

// ---- loop, pointer, keyboard ---------------------------------------------------------------------------

function tick(now) {
  const dt = clock.last ? Math.min((now - clock.last) / 1000, 1 / 30) : 1 / 60;
  clock.last = now;
  const flying = stepApart(dt);
  if (!still.matches) advance(dt);
  draw();
  const typingNow = !still.matches && (clock.phase < 1 || typing.queue.length > 0 || wantsTour());
  clock.frame = clock.visible && (typingNow || flying) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (manual || clock.frame || !clock.visible) return;
  clock.last = 0;
  clock.frame = requestAnimationFrame(tick);
}

function quietTour() {
  clock.touring = false;
  clearTimeout(clock.resumeTimer);
  clock.resumeTimer = setTimeout(() => {
    clock.touring = tourAllowed && !still.matches;
    run();
  }, RESUME_AFTER);
}

// Reduced motion: no travel, one still pose per key, with the path and the lamp lit.
function typeLetter(letter) {
  if (apartBusy()) return;
  quietTour();
  if (still.matches) {
    clock.phase = 1;
    startPress(letter);
    clock.phase = STILL_PHASE;
    draw();
    return;
  }
  if (typing.queue.length < QUEUE_LIMIT) typing.queue.push(letter);
  run();
}

function typeNext() {
  typeLetter(tourLetter());
}

function afterSetting(text) {
  say(text);
  quietTour();
  draw();
  run();
}

function turnRotor(rotor, by) {
  if (!settle()) return;
  Enigma.turnRotor(machine, rotor, by);
  afterSetting(`The ${ROTOR_NAMES[rotor]} rotor now shows ${Enigma.letterOf(machine.positions[rotor])}. Rotors at ${Enigma.positionsText(machine.positions)}.`);
}

function resetRotors() {
  if (!settle()) return;
  Enigma.setPositions(machine, "AAA");
  typing.input = "";
  typing.output = "";
  afterSetting("Rotors set to AAA.");
}

function clearCables() {
  if (!settle()) return;
  Enigma.clearPlugs(machine);
  typing.picked = null;
  afterSetting("All cables pulled from the plugboard.");
}

// A plugged socket gives up its cable; two free sockets picked one after the other get one.
function pickSocket(letter) {
  if (!settle()) return;
  const partner = machine.plugs[letter];
  if (partner) {
    Enigma.disconnect(machine, letter);
    typing.picked = null;
    afterSetting(`Cable ${letter} to ${partner} pulled.`);
  } else if (typing.picked === null) {
    typing.picked = letter;
    afterSetting(`Socket ${letter} picked. Pick a second socket to join them.`);
  } else if (typing.picked === letter) {
    typing.picked = null;
    afterSetting(`Socket ${letter} let go.`);
  } else {
    Enigma.connect(machine, typing.picked, letter);
    const first = typing.picked;
    typing.picked = null;
    afterSetting(`Cable plugged from ${first} to ${letter}.`);
  }
}

function activate(hit, backwards) {
  const kind = hit.getAttribute("data-hit");
  if (kind === "key") typeLetter(hit.getAttribute("data-letter"));
  if (kind === "rotor") turnRotor(Number(hit.getAttribute("data-rotor")), backwards ? -1 : 1);
  if (kind === "socket") pickSocket(hit.getAttribute("data-letter"));
}

function hold(value) {
  clock.held = value;
  if (!value) quietTour();
  run();
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const hit = event.target.closest("[data-hit]");
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (hit) activate(hit, false);
    else typeNext();
    return;
  }
  if (hit && hit.getAttribute("data-hit") === "rotor" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    activate(hit, event.key === "ArrowDown");
    return;
  }
  const letter = event.key.toUpperCase();
  if (event.key.length !== 1 || !Enigma.ALPHABET.includes(letter)) return;
  // Shift+E belongs to the exploded view (apart.js).
  if (event.shiftKey && letter === "E") return;
  event.preventDefault();
  typeLetter(letter);
}

if (!manual) {
  stage.addEventListener("pointerenter", () => hold(true));
  stage.addEventListener("pointerleave", () => hold(false));
  stage.addEventListener("focusin", () => hold(true));
  stage.addEventListener("focusout", () => hold(false));
  stage.addEventListener("click", (event) => {
    const hit = event.target.closest("[data-hit]");
    if (hit) activate(hit, event.shiftKey);
    else typeNext();
  });
  stage.addEventListener("keydown", onKey);
  stepButton.addEventListener("click", typeNext);
  resetButton.addEventListener("click", resetRotors);
  clearButton.addEventListener("click", clearCables);
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
