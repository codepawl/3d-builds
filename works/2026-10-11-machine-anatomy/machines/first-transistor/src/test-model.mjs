// Tests of the pure model: node test-model.mjs
import { TransistorApi as Transistor } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";

let passed = 0;
const failures = [];

function expect(condition, message) {
  if (condition) passed += 1;
  else failures.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

function near(value, wanted, tolerance) {
  return Math.abs(value - wanted) <= tolerance;
}

const biased = Transistor.createParameters({ inputLevel: 0.4, biasOn: true });
const unbiased = Transistor.createParameters({ inputLevel: 0.4, biasOn: false });

// No bias, no gain.
const off = Transistor.measureGain(unbiased);
expect(off.outputSwing === 0, `bias off: the output does not move (swing ${off.outputSwing} V)`);
expect(off.voltage === 0 && off.power === 0, "bias off: voltage and power gain are 0");
expect(Transistor.sampleAt(unbiased, 0.5).collectorAmps === 0, "bias off: no collector current at the input's peak");
const loudest = Transistor.createParameters({ inputLevel: 1, biasOn: false });
expect(Transistor.measureGain(loudest).outputSwing === 0, "bias off: even the largest input gives no output");

// Gain above 1 with bias.
const on = Transistor.measureGain(biased);
const slopes = Transistor.smallSignalGain(biased);
expect(on.voltage > 1, `bias on: voltage gain ${on.voltage.toFixed(2)} is above 1`);
expect(on.current > 1, `bias on: current gain ${on.current.toFixed(2)} is above 1`);
expect(on.power > 1, `bias on: power gain ${on.power.toFixed(1)} is above 1`);
expect(near(on.voltage, slopes.voltage, 0.01), `measured voltage gain ${on.voltage.toFixed(3)} matches the slopes (${slopes.voltage.toFixed(3)})`);
expect(near(on.current, Transistor.ALPHA_DEFAULT, 0.01), `measured current gain ${on.current.toFixed(3)} is alpha (${Transistor.ALPHA_DEFAULT})`);
expect(near(on.power, slopes.power, 0.1), `measured power gain ${on.power.toFixed(2)} matches alpha squared times load over input resistance (${slopes.power.toFixed(2)})`);
expect(!on.clipped, "bias on at level 0.4: not clipping");
expect(on.collectorSwing > on.emitterSwing, "the collector current swings more than the emitter current");

// The output scales with the input in the linear range.
const small = Transistor.measureGain(Transistor.createParameters({ inputLevel: 0.2 }));
const double = Transistor.measureGain(Transistor.createParameters({ inputLevel: 0.4 }));
expect(near(double.outputSwing / small.outputSwing, 2, 1e-6), `twice the input gives twice the output (ratio ${(double.outputSwing / small.outputSwing).toFixed(6)})`);
expect(near(double.voltage, small.voltage, 1e-9), "the gain is the same at both levels");
const limit = Transistor.linearLimit();
expect(limit > 0.5 && limit < 1, `the linear range ends at input level ${limit.toFixed(2)}`);
expect(!Transistor.measureGain(Transistor.createParameters({ inputLevel: limit - 0.02 })).clipped, "just under the limit: not clipping");
const over = Transistor.measureGain(Transistor.createParameters({ inputLevel: 1 }));
expect(over.clipped && over.voltage < slopes.voltage, `over the limit the output clips: gain falls to ${over.voltage.toFixed(2)}`);

// The output follows the input's shape: same sign, alpha * load / input resistance times larger.
let worst = 0;
for (let index = 0; index < 40; index++) {
  const sample = Transistor.sampleAt(biased, index / 20);
  worst = Math.max(worst, Math.abs(sample.outputVolts - slopes.voltage * sample.inputVolts));
}
expect(worst < 1e-9, `in the linear range the output is the input times the gain at every instant (worst error ${worst.toExponential(1)} V)`);

// Gain as a parameter.
const weak = Transistor.measureGain(Transistor.createParameters({ inputLevel: 0.3, alpha: 1 }));
const strong = Transistor.measureGain(Transistor.createParameters({ inputLevel: 0.3, alpha: 3 }));
expect(near(strong.voltage / weak.voltage, 3, 1e-6), "three times alpha gives three times the voltage gain");
expect(Transistor.createParameters({ alpha: 9 }).alpha === 3 && Transistor.createParameters({ inputLevel: -1 }).inputLevel === 0, "parameters are clamped to their ranges");
const saturated = Transistor.sampleAt(Transistor.createParameters({ inputLevel: 1, alpha: 3 }), 0.5);
expect(saturated.collectorAmps <= Transistor.COLLECTOR_SUPPLY_VOLTS / Transistor.LOAD_OHMS + 1e-12, "the collector current never exceeds what the battery can push through the load");

// The drawing's charges.
const quiet = Transistor.createParameters({ inputLevel: 0 });
const holesAtRest = Transistor.holesAt(quiet, 3).length;
const flowAtRest = Transistor.outflowAt(quiet, 3).length;
expect(holesAtRest > 0 && flowAtRest > holesAtRest, `with bias and no signal a few charges cross (${holesAtRest}) and more flow out (${flowAtRest})`);
expect(Transistor.holesAt(unbiased, 3).length === 0 && Transistor.outflowAt(unbiased, 3).length === 0, "bias off: no charges move");
let most = 0;
let fewest = 99;
for (let index = 0; index < 40; index++) {
  const count = Transistor.holesAt(Transistor.createParameters({ inputLevel: 0.7 }), index / 10).length;
  most = Math.max(most, count);
  fewest = Math.min(fewest, count);
}
expect(most > fewest, `with a signal the number of crossing charges swells and thins (${fewest} to ${most})`);
expect(Transistor.holesAt(biased, 1.23).every((charge) => charge.along >= 0 && charge.along < 1), "every charge is somewhere on its path");

// The walk-through.
expect(Transistor.STEPS.length === 5 && Transistor.stepsAt(0).every((level) => level === 0), "five steps, none lit at the start");
expect(Transistor.stepsAt(1).every((level) => level === 1), "all five lit at the end");
const midway = Transistor.stepsAt(0.45);
expect(midway[0] === 1 && midway[1] === 1 && midway[2] > 0 && midway[3] === 0, "the steps light one after another");
expect(Transistor.describe(unbiased) === "bias off · no gain", "the readout says so when the bias is off");
expect(/voltage ×8\.1 · power ×18/.test(Transistor.describe(biased)), `the readout names the gains: ${Transistor.describe(biased)}`);

// The exploded view's springs.
const state = Explode.createExplode();
Explode.setApart(state, true, false);
const events = [];
for (let frame = 0; frame < 600; frame++) events.push(...Explode.stepExplode(state, 1 / 60));
expect(Explode.isResting(state) && Explode.maxShare(state) === 1, "the springs carry every assembly out and come to rest");
const leaves = events.filter((event) => event.name === "leave");
expect(leaves.length === Explode.LEAVE_ORDER.length, `each of the ${Explode.LEAVE_ORDER.length} moving assemblies leaves once`);
const gaps = leaves.slice(1).map((event, index) => event.at - leaves[index].at);
expect(gaps.every((gap) => near(gap, Explode.SPRING.stagger, 0.02)), "they leave one after another, a stagger apart");
Explode.setApart(state, false, false);
for (let frame = 0; frame < 600; frame++) Explode.stepExplode(state, 1 / 60);
expect(Explode.isResting(state) && Explode.maxShare(state) === 0, "and it goes back together");
const numbers = Object.values(Explode.PIECES).map((piece) => piece.number).sort((a, b) => a - b);
expect(numbers.join() === "1,2,3,4,5,6,7", "the assemblies are numbered 1 to 7");

console.log(`${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
