// Pure model of the three-rotor Enigma I: plugboard, entry wheel, rotors I, II and III with ring and
// position, reflector B, the pawls that step the rotors, and the timeline of one key press.
// No DOM and no drawing in here; the build, the page and the test all import this file.
// Wirings and notches: see reference/notes.md.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTERS = ALPHABET.length;

// `notch` is the letter in the window when the pawl can drop into the rotor's notch.
const ROTORS = {
  I: { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II: { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
};
const REFLECTORS = { B: "YRUHQSLDPXNGOKMIEBFZCWVJAT" };

// Keys, lamps and plugboard sockets share this layout, back row first.
const KEY_ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];

// The lit path, piece by piece, in the order the current runs.
const PATH_SEGMENTS = ["key", "plugIn", "harnessIn", "right", "middle", "left", "reflector", "leftBack", "middleBack", "rightBack", "harnessOut", "plugOut", "lamp"];
// The way back starts at the reflector: everything from there on is drawn in the second colour.
const RETURN_FROM = PATH_SEGMENTS.indexOf("reflector");

// One key press, as fractions of its duration. A stage is [start, end]. The rotors step while the key
// is still going down; the contact under the key closes only after that.
const TIMELINE = {
  keyDown: [0, 0.09],
  pawlRise: [0.02, 0.12],
  step: [0.03, 0.15],
  pawlFall: [0.14, 0.22],
  pathStart: 0.17,
  pathGap: 0.03,
  pathRise: 0.035,
  lamp: [0.56, 0.6],
  keyUp: [0.8, 0.88],
};

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function smooth(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

function wrap(value) {
  return ((value % LETTERS) + LETTERS) % LETTERS;
}

function indexOf(letter) {
  return ALPHABET.indexOf(letter);
}

function letterOf(index) {
  return ALPHABET[wrap(index)];
}

function indexesOf(text) {
  return Array.from(text, indexOf);
}

function createMachine(options = {}) {
  const machine = {
    rotorNames: options.rotors ?? ["I", "II", "III"],
    reflector: options.reflector ?? "B",
    rings: indexesOf(options.rings ?? "AAA"),
    positions: indexesOf(options.positions ?? "AAA"),
    plugs: {},
  };
  for (const [first, second] of options.plugs ?? []) connect(machine, first, second);
  return machine;
}

function disconnect(machine, letter) {
  const partner = machine.plugs[letter];
  if (!partner) return;
  delete machine.plugs[letter];
  delete machine.plugs[partner];
}

// One cable joins two different letters; a socket holds one plug, so older cables on either give way.
function connect(machine, first, second) {
  if (first === second) return;
  disconnect(machine, first);
  disconnect(machine, second);
  machine.plugs[first] = second;
  machine.plugs[second] = first;
}

function clearPlugs(machine) {
  machine.plugs = {};
}

function plugPairs(machine) {
  return Object.keys(machine.plugs)
    .filter((letter) => letter < machine.plugs[letter])
    .sort()
    .map((letter) => [letter, machine.plugs[letter]]);
}

function throughPlugboard(machine, contact) {
  const partner = machine.plugs[letterOf(contact)];
  return partner ? indexOf(partner) : contact;
}

function notchIndex(machine, rotor) {
  return indexOf(ROTORS[machine.rotorNames[rotor]].notch);
}

// Which pawl drops in, per rotor it drives (left, middle, right). The right pawl always meets its
// ratchet; the other two ride on the notched ring of the rotor to their right and only drop when that
// rotor shows its notch letter.
function pawlsEngaged(machine) {
  return [machine.positions[1] === notchIndex(machine, 1), machine.positions[2] === notchIndex(machine, 2), true];
}

// A pawl that has dropped pushes its own rotor's ratchet and, through the notch, the rotor to its
// right as well. That second push is the double step of the middle rotor.
function stepRotors(machine) {
  const engaged = pawlsEngaged(machine);
  const stepped = [engaged[0], engaged[0] || engaged[1], true];
  stepped.forEach((moves, rotor) => {
    if (moves) machine.positions[rotor] = wrap(machine.positions[rotor] + 1);
  });
  return { engaged, stepped };
}

function shiftOf(machine, rotor) {
  return machine.positions[rotor] - machine.rings[rotor];
}

// Contacts are counted in the fixed frame of the machine: 0 is the contact the entry wheel gives A.
function rotorForward(machine, rotor, contact) {
  const wiring = ROTORS[machine.rotorNames[rotor]].wiring;
  const shift = shiftOf(machine, rotor);
  return wrap(indexOf(wiring[wrap(contact + shift)]) - shift);
}

function rotorBackward(machine, rotor, contact) {
  const wiring = ROTORS[machine.rotorNames[rotor]].wiring;
  const shift = shiftOf(machine, rotor);
  return wrap(wiring.indexOf(letterOf(contact + shift)) - shift);
}

// Every contact the current passes for one key, with the rotors where they stand now.
function tracePath(machine, letter) {
  const key = indexOf(letter);
  const plugIn = throughPlugboard(machine, key);
  let contact = plugIn;
  const forward = [];
  for (const rotor of [2, 1, 0]) {
    contact = rotorForward(machine, rotor, contact);
    forward.push(contact);
  }
  const reflected = indexOf(REFLECTORS[machine.reflector][contact]);
  contact = reflected;
  const backward = [];
  for (const rotor of [0, 1, 2]) {
    contact = rotorBackward(machine, rotor, contact);
    backward.push(contact);
  }
  const lamp = throughPlugboard(machine, contact);
  return { key, plugIn, forward, reflected, backward, exit: contact, lamp };
}

// A key press: the rotors step first, then the current finds its lamp.
function press(machine, letter) {
  const before = machine.positions.slice();
  const { engaged, stepped } = stepRotors(machine);
  const path = tracePath(machine, letter);
  return { letter, before, after: machine.positions.slice(), engaged, stepped, path, output: letterOf(path.lamp) };
}

function encipher(machine, text) {
  return Array.from(text, (letter) => press(machine, letter).output).join("");
}

function turnRotor(machine, rotor, by) {
  machine.positions[rotor] = wrap(machine.positions[rotor] + by);
}

function setPositions(machine, text) {
  machine.positions = indexesOf(text);
}

function positionsText(positions) {
  return positions.map(letterOf).join("");
}

function poseAt(phase) {
  const T = TIMELINE;
  return {
    key: smooth(T.keyDown[0], T.keyDown[1], phase) - smooth(T.keyUp[0], T.keyUp[1], phase),
    step: smooth(T.step[0], T.step[1], phase),
    pawl: smooth(T.pawlRise[0], T.pawlRise[1], phase) - smooth(T.pawlFall[0], T.pawlFall[1], phase),
  };
}

function segmentStart(index) {
  return TIMELINE.pathStart + index * TIMELINE.pathGap;
}

// How bright each piece of the path is at this phase (0..1 each). Current flows only while the key
// is held down, so everything goes dark as the key comes up.
function glowAt(phase) {
  const T = TIMELINE;
  const held = 1 - smooth(T.keyUp[0], T.keyUp[1], phase);
  return {
    segments: PATH_SEGMENTS.map((_, index) => smooth(segmentStart(index), segmentStart(index) + T.pathRise, phase) * held),
    lamp: smooth(T.lamp[0], T.lamp[1], phase) * held,
  };
}

// The rings of the Enigma I carry numbers, 01 for A up to 26 for Z.
function ringNumber(position) {
  return String(wrap(Math.round(position)) + 1).padStart(2, "0");
}

function windowsText(positions) {
  return positions.map(ringNumber).join(" ");
}

// The letter the current stands for after each stage of one press, in the order it gets there.
// `segment` is the piece of the lit path that carries it; `back` marks the way from the reflector to the lamp.
function traceStages(machine, pressed) {
  const path = pressed.path;
  const names = machine.rotorNames;
  const stage = (place, contact, segment) => ({ place, letter: letterOf(contact), segment, back: PATH_SEGMENTS.indexOf(segment) >= RETURN_FROM });
  return [
    stage("key", path.key, "key"),
    stage(path.plugIn === path.key ? "no cable" : "cable", path.plugIn, "plugIn"),
    stage(`rotor ${names[2]}`, path.forward[0], "right"),
    stage(`rotor ${names[1]}`, path.forward[1], "middle"),
    stage(`rotor ${names[0]}`, path.forward[2], "left"),
    stage("reflector", path.reflected, "reflector"),
    stage(`rotor ${names[0]}`, path.backward[0], "leftBack"),
    stage(`rotor ${names[1]}`, path.backward[1], "middleBack"),
    stage(`rotor ${names[2]}`, path.backward[2], "rightBack"),
    stage(path.exit === path.lamp ? "no cable" : "cable", path.lamp, "plugOut"),
    stage("lamp", path.lamp, "lamp"),
  ];
}

// The six things one key press does, with the phase at which each begins.
const STEPS = [
  { label: "Key pressed", at: TIMELINE.keyDown[0] + 0.005 },
  { label: "Rotors step", at: TIMELINE.step[0] },
  { label: "Plugboard swaps the letter", at: segmentStart(PATH_SEGMENTS.indexOf("plugIn")) },
  { label: "Three rotors scramble it", at: segmentStart(PATH_SEGMENTS.indexOf("right")) },
  { label: "Reflector sends it back", at: segmentStart(PATH_SEGMENTS.indexOf("reflector")) },
  { label: "Lamp lights", at: TIMELINE.lamp[0] },
];

function stepsAt(phase) {
  return STEPS.map((step) => smooth(step.at, step.at + 0.025, phase));
}

export const EnigmaApi = {
  ringNumber,
  windowsText,
  traceStages,
  STEPS,
  stepsAt,
  segmentStart,
  ALPHABET,
  LETTERS,
  ROTORS,
  REFLECTORS,
  KEY_ROWS,
  PATH_SEGMENTS,
  RETURN_FROM,
  TIMELINE,
  smooth,
  wrap,
  indexOf,
  letterOf,
  createMachine,
  connect,
  disconnect,
  clearPlugs,
  plugPairs,
  throughPlugboard,
  notchIndex,
  pawlsEngaged,
  stepRotors,
  rotorForward,
  rotorBackward,
  tracePath,
  press,
  encipher,
  turnRotor,
  setPositions,
  positionsText,
  poseAt,
  glowAt,
};
