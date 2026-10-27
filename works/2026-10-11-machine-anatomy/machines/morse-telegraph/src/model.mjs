// Pure model of a mid-1840s Morse and Vail telegraph: a key, a line with a battery, a relay at the far
// end and a register that embosses a moving paper tape. No DOM in here; the build, the page, the tests
// and the film all read this one file.
//
// The clock runs in beats: one beat is the length of a dot. How many seconds a beat lasts is the pace of
// whoever plays the model (the page, the film), so a slow demonstration and a quick word are the same
// model at two paces. Everything follows from the list of key presses: a press closes the line circuit,
// the relay's magnet pulls its armature and closes the local circuit, the register's magnet pulls its
// lever and the stylus presses the tape for exactly as long as the key was down.

// The code is the original Morse code of 1844, today called American Morse (table from Wikipedia,
// "American Morse code"). "." is a dot, "-" a dash, "=" the long dash of L, "#" the longer dash of the
// numeral 0, and a blank the longer gap that sits inside C, O, R, Y and Z.
const CODE = {
  A: ".-", B: "-...", C: ".. .", D: "-..", E: ".", F: ".-.", G: "--.", H: "....", I: "..", J: "-.-.",
  K: "-.-", L: "=", M: "--", N: "-.", O: ". .", P: ".....", Q: "..-.", R: ". ..", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: ".-..", Y: ".. ..", Z: "... .",
  1: ".--.", 2: "..-..", 3: "...-.", 4: "....-", 5: "---", 6: "......", 7: "--..", 8: "-....", 9: "-..-", 0: "#",
};

// Lengths in beats. The sources give the kinds of mark and gap but not one fixed set of proportions,
// so these are this figure's choice: they keep every mark and every gap apart from its neighbours.
const BEATS = { ".": 1, "-": 3, "=": 5, "#": 7, elementGap: 1, innerGap: 2, letterGap: 3, wordGap: 6 };

// Where one kind of mark or gap ends and the next begins, when a tape is read back.
const READ = { dotBelow: 2, dashBelow: 4, longDashBelow: 6, elementGapBelow: 1.5, innerGapBelow: 2.5, wordGapFrom: 4.5 };

// How long things take, in beats. The key's lever travels before its contacts touch; after that each
// stretch of the circuit is shown a little later than the one before, so the eye can follow the signal.
// A real line is live along its whole length at once, as near as anyone at the key could tell.
const KEY_TRAVEL = 0.25;
const MINIMUM_HOLD = 0.3;
const RISE = 0.07;
const PATH_SEGMENTS = ["battery", "key", "toLine", "line", "drop", "relayCoils", "earth", "localOut", "toRegister", "registerCoils", "localBack"];
const SEGMENT_STARTS = [0, 0.03, 0.08, 0.16, 0.36, 0.42, 0.47, 0.6, 0.66, 0.73, 0.78];
const LOCAL_FROM = 7;
const RELAY = { from: 0.5, seated: 0.6 };
const REGISTER = { from: 0.8, seated: 0.9 };
const MARK_LAG = REGISTER.seated;
const FORGET_AFTER = 400;

const STEPS = [
  { label: "Key pressed", after: -KEY_TRAVEL },
  { label: "Circuit closes", after: 0 },
  { label: "Current runs down the line", after: 0.16 },
  { label: "Magnet pulls the armature", after: RELAY.from },
  { label: "Stylus marks the tape", after: MARK_LAG },
];

function smooth(from, to, value) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

function isSendable(character) {
  return character === " " || Object.hasOwn(CODE, character);
}

// A character as the marks and gaps the key has to make: [{ mark: true, symbol, beats }, { mark: false, beats }, ...].
function elementsOf(character) {
  const elements = [];
  const code = CODE[character];
  for (let index = 0; index < code.length; index++) {
    const symbol = code[index];
    if (symbol === " ") continue;
    if (elements.length) elements.push({ mark: false, beats: code[index - 1] === " " ? BEATS.innerGap : BEATS.elementGap });
    elements.push({ mark: true, symbol, beats: BEATS[symbol] });
  }
  return elements;
}

function createLine() {
  return { presses: [], letters: [], busyUntil: 0 };
}

function heldPress(state) {
  const last = state.presses[state.presses.length - 1];
  return last && last.up === null ? last : null;
}

// A finger goes down on the key at `at`. The contacts touch a lever's travel later. Nothing happens
// while a letter that was typed is still being sent.
function pressKey(state, at) {
  if (heldPress(state) || at < state.busyUntil) return false;
  state.presses.push({ finger: at, down: at + KEY_TRAVEL, up: null, hand: true });
  return true;
}

function releaseKey(state, at) {
  const press = heldPress(state);
  if (!press) return false;
  press.up = Math.max(at, press.down + MINIMUM_HOLD);
  state.busyUntil = press.up + KEY_TRAVEL;
  return true;
}

// Queues one character behind whatever is still going out and returns when its last mark ends.
function sendCharacter(state, character, at) {
  if (character === " ") {
    state.busyUntil = Math.max(state.busyUntil, at) + BEATS.wordGap - BEATS.letterGap;
    return state.busyUntil;
  }
  let cursor = Math.max(at + KEY_TRAVEL, state.busyUntil);
  const letter = { character, code: CODE[character], from: cursor, to: cursor, first: state.presses.length, count: 0 };
  for (const element of elementsOf(character)) {
    if (element.mark) {
      state.presses.push({ finger: cursor - KEY_TRAVEL, down: cursor, up: cursor + element.beats, hand: false, symbol: element.symbol });
      letter.count += 1;
      letter.to = cursor + element.beats;
    }
    cursor += element.beats;
  }
  state.letters.push(letter);
  state.busyUntil = letter.to + BEATS.letterGap;
  return letter.to;
}

function sendText(state, text, at) {
  let end = at;
  for (const character of text.toUpperCase()) {
    if (isSendable(character)) end = sendCharacter(state, character, at);
  }
  return end;
}

// Drops what is long past, so a page left running does not keep every press it ever saw.
function forgetOld(state, now) {
  const kept = state.presses.filter((press) => press.up === null || press.up > now - FORGET_AFTER);
  const dropped = state.presses.length - kept.length;
  if (!dropped) return;
  state.presses = kept;
  state.letters = state.letters.filter((letter) => letter.first >= dropped).map((letter) => ({ ...letter, first: letter.first - dropped }));
}

function endOf(press, now) {
  return press.up === null ? now + 1e9 : press.up;
}

// How far a part that follows the key `lag` beats behind it has moved, 0 at rest to 1 seated.
function poseAfter(state, now, from, seated) {
  let pose = 0;
  for (const press of state.presses) {
    const pulled = smooth(press.down + from, press.down + seated, now);
    const letGo = smooth(endOf(press, now) + from, endOf(press, now) + seated, now);
    pose = Math.max(pose, pulled * (1 - letGo));
  }
  return pose;
}

function keyPose(state, now) {
  let pose = 0;
  for (const press of state.presses) {
    const goingDown = smooth(press.finger, press.down, now);
    const comingUp = smooth(endOf(press, now), endOf(press, now) + KEY_TRAVEL, now);
    pose = Math.max(pose, goingDown * (1 - comingUp));
  }
  return pose;
}

function liveAfter(state, now, lag) {
  return state.presses.some((press) => now >= press.down + lag && now < endOf(press, now) + lag);
}

// Everything the drawing needs for one moment: is the circuit closed, how far each lever has moved,
// how brightly each stretch of the two circuits is lit, and whether the stylus is on the tape.
function stateAt(state, now) {
  const glows = SEGMENT_STARTS.map((start) => poseAfter(state, now, start, start + RISE));
  return {
    key: keyPose(state, now),
    closed: liveAfter(state, now, 0),
    relay: poseAfter(state, now, RELAY.from, RELAY.seated),
    relayClosed: liveAfter(state, now, RELAY.seated),
    register: poseAfter(state, now, REGISTER.from, REGISTER.seated),
    marking: liveAfter(state, now, MARK_LAG),
    glows,
  };
}

// The marks on the tape so far, in beats of the clock: each is as long as its key press and lies
// MARK_LAG beats after it. The tape runs one beat's length per beat, so these are also places on it.
function marksAt(state, now) {
  const marks = [];
  for (const press of state.presses) {
    const from = press.down + MARK_LAG;
    if (from >= now) continue;
    marks.push({ from, to: Math.min(endOf(press, now) + MARK_LAG, now) });
  }
  return marks;
}

function symbolOf(beats) {
  if (beats < READ.dotBelow) return ".";
  if (beats < READ.dashBelow) return "-";
  if (beats < READ.longDashBelow) return "=";
  return "#";
}

const LETTER_OF = Object.fromEntries(Object.entries(CODE).map(([letter, code]) => [code, letter]));

// Reads a tape back the way an operator did: by the lengths of the marks and of the gaps between them.
// A letter counts as finished once the gap after it is longer than any gap inside a letter.
function readTape(marks, now) {
  const letters = [];
  let code = "";
  let from = 0;
  let pending = "";
  marks.forEach((mark, index) => {
    if (!code) from = mark.from;
    const stillDown = mark.to >= now;
    code += symbolOf(mark.to - mark.from);
    const next = marks[index + 1];
    const gap = (next ? next.from : now) - mark.to;
    if (!stillDown && gap < READ.elementGapBelow && next) return;
    if (!stillDown && gap < READ.innerGapBelow && next) {
      code += " ";
      return;
    }
    if (stillDown || (!next && gap < READ.innerGapBelow)) {
      pending = code;
      return;
    }
    letters.push({ character: LETTER_OF[code] ?? "?", code, from, to: mark.to, space: Boolean(next) && gap >= READ.wordGapFrom });
    code = "";
  });
  return { letters, pending };
}

function textOf(reading) {
  return reading.letters.map((letter) => letter.character + (letter.space ? " " : "")).join("");
}

// What can be heard between two moments, each with the beat at which it falls.
function eventsBetween(state, from, to) {
  const events = [];
  const add = (name, at) => {
    if (at > from && at <= to) events.push({ name, at });
  };
  for (const press of state.presses) {
    add("key-down", press.down);
    add("relay-pull", press.down + RELAY.seated);
    add("stylus-strike", press.down + REGISTER.seated);
    if (press.up === null) continue;
    add("key-up", press.up + KEY_TRAVEL);
    add("relay-release", press.up + RELAY.seated);
    add("stylus-release", press.up + REGISTER.seated);
  }
  return events.sort((a, b) => a.at - b.at);
}

// The letter that is going out at `now`, or the last one that went, with how many of its marks are keyed.
function letterAt(state, now) {
  let found = null;
  for (const letter of state.letters) {
    if (letter.from - KEY_TRAVEL <= now) found = letter;
  }
  if (!found) return null;
  let keyed = 0;
  for (let index = 0; index < found.count; index++) {
    if (state.presses[found.first + index].down <= now) keyed += 1;
  }
  return { ...found, keyed };
}

// How far each of the five numbered steps has come for the letter going out: 0 hidden, 1 shown.
function stepsAt(state, now) {
  const letter = letterAt(state, now);
  if (!letter) return STEPS.map(() => 0);
  return STEPS.map((step) => smooth(letter.from + step.after, letter.from + step.after + RISE, now));
}

function isIdle(state, now) {
  const last = state.presses[state.presses.length - 1];
  if (!last) return true;
  return last.up !== null && now > last.up + MARK_LAG + KEY_TRAVEL && now >= state.busyUntil;
}

export const MorseApi = {
  CODE,
  BEATS,
  READ,
  KEY_TRAVEL,
  RISE,
  PATH_SEGMENTS,
  SEGMENT_STARTS,
  LOCAL_FROM,
  RELAY,
  REGISTER,
  MARK_LAG,
  STEPS,
  smooth,
  isSendable,
  elementsOf,
  createLine,
  heldPress,
  pressKey,
  releaseKey,
  sendCharacter,
  sendText,
  forgetOld,
  stateAt,
  marksAt,
  symbolOf,
  readTape,
  textOf,
  eventsBetween,
  letterAt,
  stepsAt,
  isIdle,
};
