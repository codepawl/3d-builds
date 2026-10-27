// Proves the logic of the pure model: node test-model.mjs
import assert from "node:assert/strict";
import { EnigmaApi as Enigma } from "./model.mjs";
import { createLayout } from "./layout.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

// Wirings are permutations, and reflector B pairs every letter with a different one.
for (const [name, rotor] of Object.entries(Enigma.ROTORS)) {
  equal(Array.from(rotor.wiring).sort().join(""), Enigma.ALPHABET, `rotor ${name} uses every letter once`);
}
const reflector = Enigma.REFLECTORS.B;
for (const letter of Enigma.ALPHABET) {
  const partner = reflector[Enigma.indexOf(letter)];
  check(partner !== letter, `reflector B never returns ${letter} to itself`);
  equal(reflector[Enigma.indexOf(partner)], letter, `reflector B pairs ${letter} and ${partner} both ways`);
}
equal(Enigma.KEY_ROWS.join("").length, 26, "26 keys");
equal(Array.from(Enigma.KEY_ROWS.join("")).sort().join(""), Enigma.ALPHABET, "the key rows hold every letter once");

// Known vectors (Wikipedia, "Enigma rotor details"): I-II-III, reflector B, start AAA, no plugs.
equal(Enigma.encipher(Enigma.createMachine(), "AAAAA"), "BDZGO", "rings AAA: AAAAA -> BDZGO");
equal(Enigma.encipher(Enigma.createMachine({ rings: "BBB" }), "AAAAA"), "EWTYX", "rings BBB: AAAAA -> EWTYX");

// The double step (same source): ADU -> ADV -> AEW -> BFX.
const stepper = Enigma.createMachine({ positions: "ADU" });
const seen = [];
const steps = [];
for (let count = 0; count < 3; count++) {
  steps.push(Enigma.stepRotors(stepper).stepped);
  seen.push(Enigma.positionsText(stepper.positions));
}
equal(seen.join(" "), "ADV AEW BFX", "ADU steps to ADV, AEW, BFX");
equal(JSON.stringify(steps[0]), "[false,false,true]", "ADU: only the right rotor steps");
equal(JSON.stringify(steps[1]), "[false,true,true]", "ADV: the right rotor's notch carries the middle rotor");
equal(JSON.stringify(steps[2]), "[true,true,true]", "AEW: the middle rotor steps again with the left one");

// Turnovers happen leaving Q, E and V.
const turnover = Enigma.createMachine({ positions: "AAV" });
Enigma.stepRotors(turnover);
equal(Enigma.positionsText(turnover.positions), "ABW", "right rotor leaving V turns the middle rotor");

// The rotor positions repeat after 26 x 25 x 26 key presses, not 26 x 26 x 26.
const cycling = Enigma.createMachine();
Enigma.stepRotors(cycling);
const startOfCycle = Enigma.positionsText(cycling.positions);
let period = 0;
do {
  Enigma.stepRotors(cycling);
  period += 1;
} while (Enigma.positionsText(cycling.positions) !== startOfCycle && period < 20000);
equal(period, 16900, "period of the rotor positions");

// The press reports what the figure draws: the rotors move before the path is traced.
const pressed = Enigma.press(Enigma.createMachine(), "A");
equal(Enigma.positionsText(pressed.before), "AAA", "press: positions before");
equal(Enigma.positionsText(pressed.after), "AAB", "press: positions after");
equal(pressed.output, "B", "press: A lights B");
equal(pressed.path.forward.length, 3, "three contacts on the way in");
equal(pressed.path.backward.length, 3, "three contacts on the way back");
check(pressed.path.reflected !== pressed.path.forward[2], "the reflector hands the current to another contact");

// Each rotor's way back undoes its way in, at every position and ring setting tried.
const probe = Enigma.createMachine({ positions: "MCK", rings: "BUL" });
for (let rotor = 0; rotor < 3; rotor++) {
  for (let contact = 0; contact < 26; contact++) {
    equal(Enigma.rotorBackward(probe, rotor, Enigma.rotorForward(probe, rotor, contact)), contact, `rotor ${rotor} contact ${contact} round trip`);
  }
}

// Reciprocal, and never a letter to itself, with and without cables.
const plugSets = [[], [["A", "T"], ["G", "L"]], [["E", "Q"], ["N", "X"], ["I", "M"], ["B", "Z"]]];
for (const plugs of plugSets) {
  const settings = { positions: "QEV", rings: "CAT", plugs };
  const plain = "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGANDKEEPSTYPINGFORAWHILELONGER";
  const cipher = Enigma.encipher(Enigma.createMachine(settings), plain);
  equal(Enigma.encipher(Enigma.createMachine(settings), cipher), plain, `${plugs.length} cables: deciphering returns the plain text`);
  Array.from(plain).forEach((letter, index) => check(cipher[index] !== letter, `${plugs.length} cables: letter ${index} is not itself`));
}

// A cable swaps its two letters before and after the rotors, and nothing else.
const bare = Enigma.createMachine({ positions: "DOG" });
const cabled = Enigma.createMachine({ positions: "DOG", plugs: [["A", "T"]] });
const swap = (letter) => (letter === "A" ? "T" : letter === "T" ? "A" : letter);
for (const letter of "ATBEAT") {
  equal(Enigma.press(cabled, letter).output, swap(Enigma.press(bare, swap(letter)).output), `cable A-T around ${letter}`);
}
const plugging = Enigma.createMachine({ plugs: [["A", "T"]] });
Enigma.connect(plugging, "T", "G");
equal(JSON.stringify(Enigma.plugPairs(plugging)), '[["G","T"]]', "a socket holds one plug: A-T gives way to T-G");
Enigma.disconnect(plugging, "G");
equal(Enigma.plugPairs(plugging).length, 0, "pulling one plug frees both letters");

// Timeline: stepping is over before the first piece of the path lights; the lamp is dark at both ends.
check(Enigma.TIMELINE.step[1] < Enigma.TIMELINE.pathStart, "rotors finish stepping before the current flows");
equal(Enigma.poseAt(0.16).step, 1, "rotor fully stepped before the path starts");
equal(Enigma.glowAt(0.16).segments.reduce((sum, level) => sum + level, 0), 0, "no part of the path is lit while the rotors step");
equal(Enigma.glowAt(0).lamp + Enigma.glowAt(1).lamp, 0, "lamp dark at the start and the end of a press");
equal(Enigma.glowAt(0.7).lamp, 1, "lamp lit while the key is held");
check(Enigma.glowAt(0.7).segments.every((level) => level === 1), "whole path lit while the key is held");
equal(Enigma.poseAt(1).key, 0, "key back up at the end");
const levels = Enigma.glowAt(0.3).segments;
check(levels.every((level, index) => index === 0 || level <= levels[index - 1]), "the path lights in order, key first");

// The way back is everything from the reflector on.
equal(Enigma.PATH_SEGMENTS[Enigma.RETURN_FROM], "reflector", "the second colour starts at the reflector");

// Ring numbers: 01 for A up to 26 for Z.
equal(Enigma.ringNumber(0), "01", "A is 01");
equal(Enigma.ringNumber(25), "26", "Z is 26");
equal(Enigma.windowsText([0, 3, 20]), "01 04 21", "ADU reads 01 04 21 in the windows");

// The letter trace of a press: eleven stages that begin at the key, end at the lamp and agree with the path.
const traced = Enigma.createMachine({ plugs: [["A", "T"], ["G", "L"]] });
const tracedPress = Enigma.press(traced, "G");
const stages = Enigma.traceStages(traced, tracedPress);
equal(stages.length, 11, "eleven stages in the trace");
equal(stages[0].letter, "G", "the trace starts at the key");
equal(stages[1].letter, "L", "the cable G-L swaps G for L");
equal(stages[1].place, "cable", "a plugged letter is named as a cable");
equal(stages.map((stage) => stage.place).slice(2, 9).join(" "), "rotor III rotor II rotor I reflector rotor I rotor II rotor III", "the rotors are met right to left, then left to right");
equal(stages[10].letter, tracedPress.output, "the trace ends at the lamp that lights");
equal(stages.filter((stage) => stage.back).length, 6, "six stages on the way back, reflector first");
check(stages[5].back && !stages[4].back, "the way back starts at the reflector");
check(stages[5].letter !== stages[4].letter, "the reflector changes the letter");
const bareTrace = Enigma.traceStages(Enigma.createMachine(), Enigma.press(Enigma.createMachine(), "A"));
equal(bareTrace[1].place, "no cable", "an unplugged letter passes the plugboard unchanged");
equal(bareTrace[1].letter, "A", "and keeps its letter");

// The six steps come in order, the rotors step before the current flows, and all show while the key is held.
equal(Enigma.STEPS.length, 6, "six steps");
check(Enigma.STEPS.every((step, index) => index === 0 || step.at > Enigma.STEPS[index - 1].at), "the steps begin in order");
check(Enigma.STEPS[1].at < Enigma.TIMELINE.pathStart, "rotors step before the plugboard step");
check(Enigma.stepsAt(0.7).every((level) => level === 1), "all six steps shown while the key is held");
equal(Enigma.stepsAt(0).reduce((sum, level) => sum + level, 0), 0, "no step shown before the key moves");

// The wires follow the parts. Inside a rotor a wire stays between its two faces and clear of the spindle;
// a reflector wire stays in the reflector's face and clear of the hub; the runs in the case stay inside it.
const Layout = createLayout(Enigma.KEY_ROWS);
const STACK = Layout.sizes.stack;
const fromSpindle = (point) => Math.hypot(point[1] - STACK.y, point[2] - STACK.z);
for (let from = 0; from < 26; from++) {
  for (let to = 0; to < 26; to++) {
    const wire = Layout.rotorWire(5, -10, from, to);
    check(wire.every((point) => point[0] <= 5 + 1e-9 && point[0] >= -10 - 1e-9), `rotor wire ${from}-${to} stays between the faces`);
    check(wire.every((point) => fromSpindle(point) > STACK.spindle.r + 4 && fromSpindle(point) <= STACK.contactRadius + 1e-9), `rotor wire ${from}-${to} runs round the spindle, not through it`);
    equal(wire[0].join(), Layout.contactPoint(5, from).join(), `rotor wire ${from}-${to} starts on its pin`);
    equal(wire[wire.length - 1].map((value) => value.toFixed(6)).join(), Layout.contactPoint(-10, to).map((value) => value.toFixed(6)).join(), `rotor wire ${from}-${to} ends on its contact`);
  }
}
let reflectorPairs = 0;
for (let contact = 0; contact < 26; contact++) {
  const partner = Enigma.indexOf(Enigma.REFLECTORS.B[contact]);
  if (partner < contact) continue;
  reflectorPairs += 1;
  const wire = Layout.reflectorWire(STACK.reflector.x1, contact, partner);
  check(wire.every((point) => fromSpindle(point) > STACK.spindle.r + 2), `reflector wire ${contact}-${partner} clears the hub`);
  equal(wire[wire.length - 1].map((value) => value.toFixed(6)).join(), Layout.contactPoint(STACK.reflector.x1, partner).map((value) => value.toFixed(6)).join(), `reflector wire ${contact} ends on its partner`);
}
equal(reflectorPairs, 13, "the reflector has 13 wires");
const CASE = Layout.sizes.case;
const insideCase = (point) => point[0] > CASE.x0 && point[0] < CASE.x1 && point[1] > CASE.y0 && point[1] < CASE.y1;
for (const letter of Enigma.ALPHABET) {
  const runs = [Layout.keyRoute(letter, 1.2, true), Layout.lampRoute(letter, -1.2, true), Layout.harnessRoute(letter, Enigma.indexOf(letter), 1.2)];
  for (const run of runs) {
    const hidden = run.filter((point) => point[2] < CASE.z1 && point[1] < Layout.sizes.plugboard.y1);
    check(hidden.length >= 3 && hidden.every(insideCase), `the wires of ${letter} below the deck run inside the case`);
  }
  equal(Layout.keyRoute(letter, 0, true).pop().join(), Layout.socketHole(letter, true).join(), `the key wire of ${letter} ends in the upper hole of its socket`);
  equal(Layout.harnessRoute(letter, 0, 0)[0].join(), Layout.socketHole(letter, false).join(), `the wire to the entry wheel leaves the lower hole of ${letter}`);
}

console.log(`model test passed: ${checks} checks`);
