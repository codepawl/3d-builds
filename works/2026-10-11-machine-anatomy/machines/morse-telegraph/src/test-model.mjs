// Tests of the pure model against real vectors: the American Morse table as Wikipedia gives it, the
// first message of 24 May 1844, and the chain key -> circuit -> relay -> register -> mark on the tape.
//   node test-model.mjs
import { MorseApi as Morse } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createLayout } from "./layout.mjs";

let checks = 0;
const failures = [];

function expect(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

// The table from Wikipedia, "American Morse code", typed out a second time as words, so a slip in the
// model's table shows up here. "gap" is the longer gap inside C, O, R, Y and Z.
const WIKIPEDIA = {
  A: "dot dash", B: "dash dot dot dot", C: "dot dot gap dot", D: "dash dot dot", E: "dot", F: "dot dash dot", G: "dash dash dot",
  H: "dot dot dot dot", I: "dot dot", J: "dash dot dash dot", K: "dash dot dash", L: "long", M: "dash dash", N: "dash dot",
  O: "dot gap dot", P: "dot dot dot dot dot", Q: "dot dot dash dot", R: "dot gap dot dot", S: "dot dot dot", T: "dash",
  U: "dot dot dash", V: "dot dot dot dash", W: "dot dash dash", X: "dot dash dot dot", Y: "dot dot gap dot dot", Z: "dot dot dot gap dot",
  1: "dot dash dash dot", 2: "dot dot dash dot dot", 3: "dot dot dot dash dot", 4: "dot dot dot dot dash", 5: "dash dash dash",
  6: "dot dot dot dot dot dot", 7: "dash dash dot dot", 8: "dash dot dot dot dot", 9: "dash dot dot dash", 0: "longer",
};
const WORDS = { ".": "dot", "-": "dash", "=": "long", "#": "longer", " ": "gap" };
const spoken = (code) => Array.from(code).map((symbol) => WORDS[symbol]).join(" ");

const characters = Object.keys(Morse.CODE);
expect(characters.length === 36, `the table has 26 letters and 10 numerals (${characters.length})`);
const wrong = characters.filter((character) => spoken(Morse.CODE[character]) !== WIKIPEDIA[character]);
expect(wrong.length === 0, `all 36 codes match the Wikipedia table (${wrong.join(", ") || "none wrong"})`);
expect(new Set(Object.values(Morse.CODE)).size === 36, "no two characters share a code");
const longGap = characters.filter((character) => Morse.CODE[character].includes(" ")).join("");
expect(longGap === "CORYZ", `the longer inner gap sits in C, O, R, Y and Z only (${longGap})`);

// Sends a text on a fresh line and plays the clock well past its end.
function played(text) {
  const state = Morse.createLine();
  const end = Morse.sendText(state, text, 0);
  const now = end + 20;
  return { state, end, now, marks: Morse.marksAt(state, now) };
}

const each = characters.filter((character) => Morse.textOf(Morse.readTape(played(character).marks, played(character).now)) !== character);
expect(each.length === 0, `each of the 36 characters, sent alone, is read back off the tape (${each.join(", ") || "all"})`);

const MESSAGE = "WHAT HATH GOD WROUGHT";
const first = played(MESSAGE);
const readBack = Morse.textOf(Morse.readTape(first.marks, first.now)).trim();
expect(readBack === MESSAGE, `the first message is read back off the tape: ${readBack}`);
const pressCount = Array.from(MESSAGE.replaceAll(" ", "")).reduce((sum, character) => sum + Morse.CODE[character].replaceAll(" ", "").length, 0);
expect(first.marks.length === pressCount && pressCount === 48, `it takes ${pressCount} key presses and leaves ${first.marks.length} marks`);

// The letter A, beat by beat: a dot of 1 beat, a gap of 1, a dash of 3.
const a = Morse.createLine();
Morse.sendCharacter(a, "A", 0);
const [dot, dash] = a.presses;
expect(near(dot.down, Morse.KEY_TRAVEL) && near(dot.up - dot.down, 1) && near(dash.down - dot.up, 1) && near(dash.up - dash.down, 3), `A is keyed as 1 beat down, 1 up, 3 down (contacts close at ${dot.down}, ${dash.down})`);
expect(near(dot.finger, 0), "the lever starts down a travel before its contacts touch");
const marksOfA = Morse.marksAt(a, 20);
expect(near(marksOfA[0].from, dot.down + Morse.MARK_LAG) && near(marksOfA[0].to - marksOfA[0].from, 1) && near(marksOfA[1].to - marksOfA[1].from, 3), `each mark is as long as its key press and lies ${Morse.MARK_LAG} beat after it`);

// The chain, in order, on the dash of A.
const at = (beat) => Morse.stateAt(a, beat);
const before = at(dash.down - 0.01);
expect(!before.closed && before.key > 0.9, "just before the contacts touch the lever is nearly down and the circuit is open");
const justClosed = at(dash.down + 0.05);
expect(justClosed.closed && justClosed.glows[0] > 0.5 && justClosed.glows[3] === 0 && justClosed.relay === 0, "key down: circuit closed, battery stretch lit, the line and the relay not yet");
const onTheLine = at(dash.down + 0.3);
expect(onTheLine.glows[3] === 1 && onTheLine.relay === 0 && !onTheLine.relayClosed, "then the line is lit and the relay has not moved");
const relayIn = at(dash.down + Morse.RELAY.seated + 0.01);
expect(relayIn.relay > 0.99 && relayIn.relayClosed && relayIn.register === 0 && !relayIn.marking, "then the relay's armature is seated, the local circuit is closed and the stylus has not moved");
const marking = at(dash.down + Morse.MARK_LAG + 0.01);
expect(marking.register > 0.99 && marking.marking && marking.glows.every((glow) => glow === 1), "then the register's lever is seated, the stylus is on the tape and both circuits are lit");
const released = at(dash.up + 0.05);
expect(!released.closed && released.marking && released.relayClosed, "key up: the circuit opens at once, the relay and the stylus follow a moment later");
const after = at(dash.up + Morse.MARK_LAG + 0.3);
expect(!after.marking && after.register === 0 && after.relay === 0 && after.key === 0 && after.glows.every((glow) => glow === 0), "and then everything is at rest and dark");
expect(Morse.SEGMENT_STARTS.every((start, index) => index === 0 || start > Morse.SEGMENT_STARTS[index - 1]) && Morse.SEGMENT_STARTS.length === Morse.PATH_SEGMENTS.length, "the eleven stretches of the path light in order");

// What can be heard.
const heard = Morse.eventsBetween(a, -1, 30).map((event) => event.name);
expect(heard.join(" ") === "key-down relay-pull stylus-strike key-up relay-release stylus-release key-down relay-pull stylus-strike key-up relay-release stylus-release", `two presses make twelve sounds in order (${heard.length})`);
const split = [...Morse.eventsBetween(a, -1, 2.5), ...Morse.eventsBetween(a, 2.5, 30)];
expect(split.length === 12, "no sound is lost or doubled where two stretches of the clock meet");

// A hand on the key, with an unsteady rhythm: short, short gap, long; a pause; then two shorts with the longer gap (O).
function byHand(strokes) {
  const state = Morse.createLine();
  let now = 0;
  for (const [held, rest] of strokes) {
    Morse.pressKey(state, now);
    now += held + Morse.KEY_TRAVEL;
    Morse.releaseKey(state, now);
    now += rest;
  }
  return Morse.textOf(Morse.readTape(Morse.marksAt(state, now + 10), now + 10));
}
expect(byHand([[0.8, 1.1], [3.4, 3.4], [1.2, 2.1], [0.7, 4]]) === "AO", `keyed by hand, unevenly: ${byHand([[0.8, 1.1], [3.4, 3.4], [1.2, 2.1], [0.7, 4]])} (want AO)`);
expect(byHand([[5.2, 3.2], [1, 6], [2.7, 3]]) === "LE T", `a long dash is L, a long pause a word space: "${byHand([[5.2, 3.2], [1, 6], [2.7, 3]])}"`);
const busy = Morse.createLine();
Morse.sendCharacter(busy, "H", 0);
expect(Morse.pressKey(busy, 2) === false && Morse.pressKey(busy, busy.busyUntil) === true, "a hand on the key is ignored while a typed letter is going out");
const unfinished = Morse.createLine();
Morse.pressKey(unfinished, 0);
const held = Morse.readTape(Morse.marksAt(unfinished, 2), 2);
expect(held.letters.length === 0 && held.pending === ".", "a mark still being made is pending, not yet a letter");

// The letter that the trace names, and the five numbered steps.
const w = Morse.createLine();
Morse.sendCharacter(w, "W", 0);
expect(Morse.letterAt(w, 0.1).keyed === 0 && Morse.letterAt(w, 3).keyed === 2 && Morse.letterAt(w, 30).keyed === 3, "the trace lights W's dot, dash, dash as each is keyed");
const stepsEarly = Morse.stepsAt(w, Morse.KEY_TRAVEL + 0.1);
const stepsLate = Morse.stepsAt(w, Morse.KEY_TRAVEL + Morse.MARK_LAG + 0.1);
expect(stepsEarly[0] === 1 && stepsEarly[1] === 1 && stepsEarly[2] === 0 && stepsEarly[4] === 0 && stepsLate.every((level) => level === 1), "the five steps appear in order as the signal reaches each part");
expect(Morse.STEPS.map((step) => step.label).join(" | ") === "Key pressed | Circuit closes | Current runs down the line | Magnet pulls the armature | Stylus marks the tape", "the five step labels");
expect(Morse.isIdle(w, 2) === false && Morse.isIdle(w, w.busyUntil + 0.1) === true, "the line is idle only after the letter and its gap");

// The layout: every stretch of the path is drawn, and each ends where the next begins.
const Layout = createLayout();
const routes = Layout.pathRoutes();
expect(Morse.PATH_SEGMENTS.every((name) => routes[name] && routes[name].every((run) => run.length >= 2)), "every stretch of the two circuits has a route in the layout");
const gapBetween = (first, second) => Math.hypot(...[0, 1, 2].map((axis) => first[axis] - second[axis]));
const lineLoop = Morse.PATH_SEGMENTS.slice(0, Morse.LOCAL_FROM).flatMap((name) => routes[name]);
const localLoop = Morse.PATH_SEGMENTS.slice(Morse.LOCAL_FROM).flatMap((name) => routes[name]);
function breaksIn(loop) {
  const found = [];
  loop.forEach((run, index) => {
    const next = loop[(index + 1) % loop.length];
    const gap = gapBetween(run[run.length - 1], next[0]);
    if (gap > 0.01) found.push(Math.round(gap * 10) / 10);
  });
  return found;
}
expect(breaksIn(localLoop).length === 0, "the local circuit is one closed loop: battery, relay contact, register coils and back");
const lineBreaks = breaksIn(lineLoop);
expect(lineBreaks.length === 1 && lineBreaks[0] === 10, `the line circuit is one closed loop but for the 10 units left out of the line (${lineBreaks.join(", ")})`);
const stylusRise = Layout.sizes.register.angle * (Layout.sizes.register.pivot[0] - Layout.sizes.register.stylus.x);
const stylusGap = Layout.sizes.tape.level - Layout.sizes.register.stylus.top;
expect(Math.abs(stylusRise - stylusGap) < 0.12, `the register lever's swing lifts the stylus ${stylusRise.toFixed(2)} to the tape ${stylusGap.toFixed(2)} above it`);
const keyDrop = Layout.sizes.key.angle * (Layout.sizes.key.anvil.x - Layout.sizes.key.pivot[0]);
expect(Math.abs(keyDrop - (Layout.sizes.key.stud.z0 - Layout.sizes.key.anvil.top)) < 0.05, `the key's swing closes the ${keyDrop.toFixed(2)} gap at its contact`);
const relayDrop = Layout.sizes.relay.angle * (Layout.sizes.relay.pivot[0] - Layout.sizes.relay.contact.x);
expect(Math.abs(relayDrop - (Layout.sizes.relay.stud.z0 - Layout.sizes.relay.contact.top)) < 0.05, `the relay armature's swing closes the ${relayDrop.toFixed(2)} gap at its contact`);

// The exploded view.
const names = Object.keys(Explode.PIECES);
expect(names.length === 10 && new Set(names.map((name) => Explode.PIECES[name].number)).size === 10, "ten assemblies, numbered 1 to 10");
expect(Explode.LEAVE_ORDER.length === 9 && !Explode.LEAVE_ORDER.includes("bench"), "nine of them leave; the benches stay");

console.log(failures.length ? `model tests failed: ${failures.length} of ${checks}\n${failures.join("\n")}` : `model tests passed: ${checks} checks`);
process.exit(failures.length ? 1 : 0);
