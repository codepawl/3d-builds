// Proves the logic of the pure model: node test-model.mjs
import assert from "node:assert/strict";
import { LoomApi as Loom } from "./model.mjs";
import { LAYOUT, MECHANISM, PRESSED_CENTRE } from "./layout.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};

for (const motif of Loom.MOTIF_NAMES) {
  const chain = Loom.chainOf(motif);
  check(chain.length === Loom.CARDS, `${motif}: ${Loom.CARDS} cards`);
  chain.forEach((card, index) => {
    check(card.length === Loom.POSITIONS, `${motif} card ${index + 1}: ${Loom.POSITIONS} positions`);
    const lifted = Loom.readHooks(card, MECHANISM);
    check(Loom.rowBits(lifted) === Loom.rowBits(card), `${motif} card ${index + 1}: lifted hooks equal the holes`);
  });

  const loom = Loom.createLoom(motif);
  for (let pick = 0; pick < Loom.CARDS * 2; pick++) Loom.runPick(loom, MECHANISM);
  check(loom.picks === Loom.CARDS * 2, `${motif}: picks counted`);
  loom.cloth.forEach((row, index) => {
    check(Loom.rowBits(row) === Loom.MOTIFS[motif][index % Loom.CARDS], `${motif} cloth row ${index + 1} equals card ${(index % Loom.CARDS) + 1}`);
  });
}

// Mechanism: a hole leaves the needle alone, a blank pushes it back by the card's travel past the head.
check(Loom.needleShift(true, MECHANISM.pressedFaceX, MECHANISM.headX) === 0, "hole: needle not pushed");
check(Loom.needleShift(false, MECHANISM.pressedFaceX, MECHANISM.headX) === LAYOUT.card.travel, "blank: needle pushed by the card's travel");
const lean = Loom.hookLean(LAYOUT.card.travel, MECHANISM.hook);
check(!Loom.staysOnKnife(lean, MECHANISM.hook), "pushed hook leans clear of the knife");
check(Loom.staysOnKnife(0, MECHANISM.hook), "unpushed hook stays over the knife");
check(Loom.hookLift(true, MECHANISM.griffeRise, MECHANISM.freeTravel) === LAYOUT.griffe.rise - LAYOUT.griffe.free, "hook on the knife rises with the griffe");
check(Loom.hookLift(false, MECHANISM.griffeRise, MECHANISM.freeTravel) === 0, "hook off the knife stays down");

// Punching and patching: the cloth shows the change on that card's next pass, and only there.
const edited = Loom.createLoom("diamond");
for (let pick = 0; pick < Loom.CARDS; pick++) Loom.runPick(edited, MECHANISM);
check(Loom.togglePunch(edited, 2, 0) === true, "toggle punches a blank position");
for (let pick = 0; pick < Loom.CARDS; pick++) Loom.runPick(edited, MECHANISM);
check(Loom.rowBits(edited.cloth[2]) === "01100110", "row woven before the punch is unchanged");
check(Loom.rowBits(edited.cloth[10]) === "11100110", "row woven after the punch shows it");
check(Loom.rowBits(edited.cloth[11]) === "11000011", "the other cards are unchanged");
check(Loom.togglePunch(edited, 2, 0) === false, "toggle patches the hole again");

// Timeline: every part ends a pick where the next pick starts.
const start = Loom.poseAt(0);
const end = Loom.poseAt(1);
check(start.swing === 1 && end.swing === 1, "cylinder is swung out at both ends of a pick");
check(start.griffe === 0 && Math.abs(end.griffe) < 1e-9, "griffe is down at both ends of a pick");
check(Math.abs(Loom.poseAt(0.74).beat - 1) < 1e-9, "reed is at the fell when the row is woven");
check(Loom.poseAt(Loom.TIMELINE.latch).swing === 0, "card is pressed when the hooks are latched");
check(Loom.poseAt(0.47).griffe === 1 && Loom.poseAt(0.65).griffe === 1, "shed is fully open while the shuttle flies");
let last = -1;
for (let step = 0; step <= 200; step++) {
  const phase = step / 200;
  const turn = Loom.poseAt(phase).turn;
  check(turn >= last, "turn never runs backwards");
  last = turn;
}

// Chain: every card keeps its length through the quarter turn and the swing, and the chain is continuous
// from the end of one pick (turn 1) to the start of the next (turn 0).
const shape = Loom.chainShape(PRESSED_CENTRE, LAYOUT.card.half, LAYOUT.card.pitch);
let worst = 0;
for (const swing of [0, 0.5, 1]) {
  const reach = LAYOUT.swing.out * swing;
  const centre = [PRESSED_CENTRE[0] - reach, LAYOUT.swing.pivotZ + Math.sqrt(LAYOUT.swing.arm ** 2 - reach ** 2)];
  for (let step = 0; step <= 40; step++) {
    const hinges = Loom.chainHinges(step / 40, centre, shape);
    for (let link = 0; link < Loom.CARDS; link++) {
      const a = hinges[link];
      const b = hinges[(link + 1) % Loom.CARDS];
      const error = Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - shape.pitch) / shape.pitch;
      worst = Math.max(worst, error);
    }
  }
  const before = Loom.chainHinges(1, centre, shape);
  const after = Loom.chainHinges(0, centre, shape);
  for (let slot = 0; slot < Loom.CARDS; slot++) {
    const a = before[slot];
    const b = after[(slot + 1) % Loom.CARDS];
    check(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05, `chain hinge ${slot} is continuous across the pick boundary (swing ${swing})`);
  }
}
check(worst < 0.06, `no card stretches more than 6% (worst ${(worst * 100).toFixed(1)}%)`);

console.log(`model test passed: ${checks} checks · worst card stretch ${(worst * 100).toFixed(2)}%`);
