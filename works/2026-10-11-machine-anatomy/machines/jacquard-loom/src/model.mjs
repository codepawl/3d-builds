// Pure model of a small Jacquard loom: the card chain, what each card does to the hooks,
// the cloth that results, the timeline of one pick and the shape of the card chain.
// No DOM and no drawing in here; the build, the page and the test all import this file.

const POSITIONS = 8;
const CARDS = 8;

const MOTIFS = {
  diamond: ["00011000", "00111100", "01100110", "11000011", "11000011", "01100110", "00111100", "00011000"],
  flower: ["00011000", "01011010", "00111100", "11100111", "11100111", "00111100", "01011010", "00011000"],
  twill: ["11001100", "01100110", "00110011", "10011001", "11001100", "01100110", "00110011", "10011001"],
};
const MOTIF_NAMES = Object.keys(MOTIFS);

// One pick, as fractions of its duration. A stage is [start, end].
const TIMELINE = {
  turn: [0.02, 0.15],
  swingIn: [0.16, 0.27],
  latch: 0.27,
  rise: [0.3, 0.46],
  shuttle: [0.48, 0.64],
  beatIn: [0.66, 0.74],
  weave: 0.74,
  beatOut: [0.74, 0.82],
  fall: [0.8, 0.92],
  takeUp: [0.84, 1],
  swingOut: [0.92, 1],
};

const STAGES = [
  [0.16, "cylinder turns"],
  [0.28, "card presses the needles"],
  [0.47, "griffe lifts the hooks"],
  [0.65, "shuttle crosses the shed"],
  [0.82, "reed beats the weft"],
  [0.92, "griffe falls"],
  [1.01, "cylinder swings out"],
];

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function smooth(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

function mix(a, b, share) {
  return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
}

function chainOf(motif) {
  return MOTIFS[motif].map((row) => Array.from(row, (mark) => mark === "1"));
}

function rowBits(row) {
  return row.map((mark) => (mark ? "1" : "0")).join("");
}

// A blank card pushes the needle back by however far the card face has come past the needle's head.
function needleShift(hole, faceX, headX) {
  if (hole) return 0;
  return Math.max(0, faceX - headX);
}

// The needle's loop holds the hook, so the hook leans by the needle's shift, more at its top than at the loop.
function hookLean(shift, hook) {
  return (shift * (hook.top - hook.foot)) / (hook.loop - hook.foot);
}

// A hook stays over the knife only while its lean is less than the beak's overhang past the knife.
function staysOnKnife(lean, hook) {
  return lean < hook.overhang;
}

// The griffe travels a little before its knife meets the beak; from there the hook rises with it.
function hookLift(onKnife, griffeRise, freeTravel) {
  if (!onKnife) return 0;
  return Math.max(0, griffeRise - freeTravel);
}

// Which hooks a card lifts, worked through the mechanism rather than copied from the holes.
function readHooks(card, mechanism) {
  return card.map((hole) => {
    const shift = needleShift(hole, mechanism.pressedFaceX, mechanism.headX);
    const lean = hookLean(shift, mechanism.hook);
    const onKnife = staysOnKnife(lean, mechanism.hook);
    return hookLift(onKnife, mechanism.griffeRise, mechanism.freeTravel) > 0;
  });
}

function liftedCount(row) {
  return row.filter(Boolean).length;
}

function createLoom(motif) {
  return { motif, chain: chainOf(motif), cardIndex: CARDS - 1, picks: 0, cloth: [] };
}

function presentNext(loom) {
  loom.cardIndex = (loom.cardIndex + 1) % CARDS;
  return loom.cardIndex;
}

function weaveRow(loom, row) {
  loom.cloth.push(row.slice());
  loom.picks += 1;
}

function runPick(loom, mechanism) {
  presentNext(loom);
  const row = readHooks(loom.chain[loom.cardIndex], mechanism);
  weaveRow(loom, row);
  return row;
}

function togglePunch(loom, card, position) {
  loom.chain[card][position] = !loom.chain[card][position];
  return loom.chain[card][position];
}

function setMotif(loom, motif) {
  loom.motif = motif;
  loom.chain = chainOf(motif);
}

function poseAt(phase) {
  const T = TIMELINE;
  const pressing = phase < 0.5 ? 1 - smooth(T.swingIn[0], T.swingIn[1], phase) : smooth(T.swingOut[0], T.swingOut[1], phase);
  return {
    turn: smooth(T.turn[0], T.turn[1], phase),
    swing: pressing,
    griffe: smooth(T.rise[0], T.rise[1], phase) - smooth(T.fall[0], T.fall[1], phase),
    shuttle: smooth(T.shuttle[0], T.shuttle[1], phase),
    beat: smooth(T.beatIn[0], T.beatIn[1], phase) - smooth(T.beatOut[0], T.beatOut[1], phase),
    takeUp: smooth(T.takeUp[0], T.takeUp[1], phase),
  };
}

function stageAt(phase) {
  const found = STAGES.find(([until]) => phase < until);
  return found ? found[1] : STAGES[STAGES.length - 1][1];
}

// How far the lit accent has travelled along the row's path at this phase, part by part (0..1 each).
function glowAt(phase) {
  const T = TIMELINE;
  const fade = 1 - smooth(T.fall[0], T.fall[1], phase);
  return {
    card: smooth(0.18, T.latch, phase) * (1 - smooth(T.swingOut[0], T.swingOut[1], phase)),
    needle: smooth(0.2, T.latch, phase) * fade,
    hook: smooth(T.latch, 0.34, phase) * fade,
    harness: smooth(0.33, 0.41, phase) * fade,
    thread: smooth(0.38, T.rise[1], phase) * fade,
    weft: smooth(T.shuttle[0], T.shuttle[0] + 0.03, phase),
    cloth: 1 - smooth(0.9, 1, phase),
  };
}

function leftCrossing(a, b, radius) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const span = Math.hypot(dx, dz);
  const reach = Math.sqrt(Math.max(0, radius * radius - (span * span) / 4));
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const first = [middle[0] - (dz / span) * reach, middle[1] + (dx / span) * reach];
  const second = [middle[0] + (dz / span) * reach, middle[1] - (dx / span) * reach];
  return first[0] < second[0] ? first : second;
}

// Where the hanging part of the chain rests, in the x-z plane, for a cylinder pressed at `centre`.
function chainShape(centre, half, pitch) {
  const foot = [centre[0] - half, centre[1] - half];
  const lean = 1.4;
  const tilt = 1.64;
  const slot4 = [foot[0] - lean, foot[1] - Math.sqrt(pitch * pitch - lean * lean)];
  const slot5 = [slot4[0] - Math.sqrt(pitch * pitch - tilt * tilt), slot4[1] + tilt];
  const slot7 = [centre[0] - half - pitch, centre[1] + half];
  const slot6 = leftCrossing(slot5, slot7, pitch);
  return { half, pitch, slot4, slot5, slot6, floor: Math.min(slot4[1], slot5[1]) - 0.4 };
}

// Restores one card's length by moving its two hinges, each by its share of freedom (0 = held in place).
function pullLink(hinges, from, to, length, freedom) {
  const a = hinges[from];
  const b = hinges[to];
  const total = freedom[from] + freedom[to];
  if (total <= 0) return;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const span = Math.hypot(dx, dz) || 1;
  const excess = (span - length) / span;
  const shareA = freedom[from] / total;
  const shareB = freedom[to] / total;
  hinges[from] = [a[0] + dx * excess * shareA, a[1] + dz * excess * shareA];
  hinges[to] = [b[0] - dx * excess * shareB, b[1] - dz * excess * shareB];
}

// The eight hinge points of the laced chain while the cylinder is `turn` (0..1) of the way through a
// quarter turn and its centre is at `centre`. Hinges 0..2 ride the cylinder's corners, hinge 7 slides
// along the guide roller, and 3..6 hang: they are relaxed to keep every card its own length. Hinge 3 is
// still seated on the cylinder's corner as the turn begins and hinge 6 is seated on the roller as it ends,
// so the chain at the end of one pick is exactly the chain at the start of the next.
function chainHinges(turn, centre, shape) {
  const radius = shape.half * Math.SQRT2;
  const corner = (degrees) => {
    const angle = (degrees * Math.PI) / 180;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  };
  const arrive = [centre[0] - shape.half - shape.pitch, centre[1] + shape.half];
  const foot = corner(-135);
  const rest = [foot, shape.slot4, shape.slot5, shape.slot6, arrive];
  const hinges = new Array(CARDS);
  hinges[0] = corner(135 - 90 * turn);
  hinges[1] = corner(45 - 90 * turn);
  hinges[2] = corner(-45 - 90 * turn);
  hinges[7] = [arrive[0] + shape.pitch * turn, arrive[1]];
  for (let slot = 3; slot <= 6; slot++) hinges[slot] = mix(rest[slot - 3], rest[slot - 2], turn);
  const freedom = [0, 0, 0, smooth(0, 0.3, turn), 1, 1, 1 - smooth(0.7, 1, turn), 0];
  for (let pass = 0; pass < 60; pass++) {
    for (let link = 2; link <= 6; link++) pullLink(hinges, link, link + 1, shape.pitch, freedom);
    for (let slot = 3; slot <= 6; slot++) {
      if (freedom[slot] > 0 && hinges[slot][1] < shape.floor) hinges[slot] = [hinges[slot][0], shape.floor];
    }
  }
  return hinges;
}

export const LoomApi = {
  POSITIONS,
  CARDS,
  MOTIFS,
  MOTIF_NAMES,
  TIMELINE,
  smooth,
  chainOf,
  rowBits,
  needleShift,
  hookLean,
  staysOnKnife,
  hookLift,
  readHooks,
  liftedCount,
  createLoom,
  presentNext,
  weaveRow,
  runPick,
  togglePunch,
  setMotif,
  poseAt,
  stageAt,
  glowAt,
  chainShape,
  chainHinges,
};
