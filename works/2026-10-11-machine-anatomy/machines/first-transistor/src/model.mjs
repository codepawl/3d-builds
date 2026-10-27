// Pure model of the point-contact transistor as an amplifier. No DOM in here: the build, the page, the
// film and the tests all read this one file.
//
// It is a simplified, piecewise-linear small-signal model, not a device simulation:
//   - the emitter contact conducts only above a threshold voltage, then like a fixed resistance;
//   - the collector current is a leakage current plus ALPHA times the emitter current, and it can never
//     exceed what the collector battery can push through the load;
//   - with the batteries disconnected (bias off) the input signal alone stays below the emitter's
//     threshold and the collector has no supply, so nothing is amplified.
// The component values are illustrative choices, not measurements of the 1947 device. See reference/notes.md.

const TWO_PI = Math.PI * 2;

// How fast the demonstration signal swings on the page: slow enough to watch.
const SIGNAL_HERTZ = 0.5;
// The input signal's amplitude when the level control is at 1.
const INPUT_FULL_VOLTS = 0.2;
const EMITTER_THRESHOLD_VOLTS = 0.25;
const EMITTER_OHMS = 270;
const EMITTER_BIAS_AMPS = 0.0006;
const EMITTER_BIAS_VOLTS = EMITTER_THRESHOLD_VOLTS + EMITTER_BIAS_AMPS * EMITTER_OHMS;
const LOAD_OHMS = 1000;
const COLLECTOR_SUPPLY_VOLTS = 9;
const COLLECTOR_LEAK_AMPS = 0.0003;
// Current gain of a point-contact transistor in this connection: "usually around 2 to 3" (Wikipedia,
// Point-contact transistor, Characteristics).
const ALPHA_DEFAULT = 2.2;
const ALPHA_RANGE = [1, 3];
// How long a charge takes to cross from one contact to the other in the drawing (not a measured time).
const CROSSING_SECONDS = 1.1;

const DEFAULTS = { inputLevel: 0.5, biasOn: true, alpha: ALPHA_DEFAULT };

const STEPS = [
  { label: "A small signal reaches the emitter", side: "in" },
  { label: "Charges enter the germanium", side: "in" },
  { label: "They are swept to the collector", side: "in" },
  { label: "A much larger current flows out", side: "out" },
  { label: "The output is a bigger copy of the input", side: "out" },
];
// When each step of the walk-through lights, as a share of the walk.
const STEP_STARTS = [0.04, 0.22, 0.4, 0.58, 0.78];
const STEP_RAMP = 0.07;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function smooth(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

function createParameters(overrides = {}) {
  const merged = { ...DEFAULTS, ...overrides };
  return {
    inputLevel: clamp(Number(merged.inputLevel), 0, 1),
    biasOn: Boolean(merged.biasOn),
    alpha: clamp(Number(merged.alpha), ALPHA_RANGE[0], ALPHA_RANGE[1]),
  };
}

function inputVoltsAt(parameters, seconds) {
  return parameters.inputLevel * INPUT_FULL_VOLTS * Math.sin(TWO_PI * SIGNAL_HERTZ * seconds);
}

// The emitter contact: no current below its threshold, then a straight line.
function emitterAmpsFor(parameters, inputVolts) {
  const biasVolts = parameters.biasOn ? EMITTER_BIAS_VOLTS : 0;
  return Math.max(0, (biasVolts + inputVolts - EMITTER_THRESHOLD_VOLTS) / EMITTER_OHMS);
}

// The collector contact: with its battery connected it passes a leakage current plus alpha times
// whatever the emitter injects, up to what the battery can push through the load.
function collectorAmpsFor(parameters, emitterAmps) {
  if (!parameters.biasOn) return 0;
  const ceiling = COLLECTOR_SUPPLY_VOLTS / LOAD_OHMS;
  return Math.min(ceiling, COLLECTOR_LEAK_AMPS + parameters.alpha * emitterAmps);
}

function restingCollectorAmps(parameters) {
  return collectorAmpsFor(parameters, emitterAmpsFor(parameters, 0));
}

// Everything at one instant. `outputVolts` is the changing part of the voltage across the load.
function sampleAt(parameters, seconds) {
  const inputVolts = inputVoltsAt(parameters, seconds);
  const emitterAmps = emitterAmpsFor(parameters, inputVolts);
  const collectorAmps = collectorAmpsFor(parameters, emitterAmps);
  const outputVolts = (collectorAmps - restingCollectorAmps(parameters)) * LOAD_OHMS;
  return { seconds, inputVolts, emitterAmps, collectorAmps, outputVolts };
}

function swingOf(values) {
  return Math.max(...values) - Math.min(...values);
}

// Gain measured from one whole cycle of the waveforms, the way one would read it off two oscilloscope traces.
function measureGain(parameters, samplesPerCycle = 360) {
  const samples = [];
  for (let index = 0; index < samplesPerCycle; index++) samples.push(sampleAt(parameters, index / samplesPerCycle / SIGNAL_HERTZ));
  const inputSwing = swingOf(samples.map((sample) => sample.inputVolts));
  const outputSwing = swingOf(samples.map((sample) => sample.outputVolts));
  const emitterSwing = swingOf(samples.map((sample) => sample.emitterAmps));
  const collectorSwing = swingOf(samples.map((sample) => sample.collectorAmps));
  const voltage = inputSwing > 1e-12 ? outputSwing / inputSwing : 0;
  const inputAmpsSwing = inputSwing / EMITTER_OHMS;
  const current = inputAmpsSwing > 1e-15 ? collectorSwing / inputAmpsSwing : 0;
  const expected = smallSignalGain(parameters);
  // Clipped: the emitter cuts off or the collector reaches its ceiling for part of the cycle.
  const clipped = parameters.biasOn && inputSwing > 1e-12 && voltage < expected.voltage * 0.995;
  return { inputSwing, outputSwing, emitterSwing, collectorSwing, voltage, current, power: voltage * current, clipped };
}

// The same gains from the model's slopes, valid while nothing clips.
function smallSignalGain(parameters) {
  if (!parameters.biasOn) return { current: 0, voltage: 0, power: 0 };
  const voltage = (parameters.alpha * LOAD_OHMS) / EMITTER_OHMS;
  return { current: parameters.alpha, voltage, power: parameters.alpha * voltage };
}

// The largest input level that still gives an undistorted output with the bias on.
function linearLimit() {
  return (EMITTER_BIAS_AMPS * EMITTER_OHMS) / INPUT_FULL_VOLTS;
}

// The drawing's moving charges. Each of `slots` charges crosses in CROSSING_SECONDS, one after another.
// A slot shows only if the current at the moment that charge set off was large enough to need it, so a
// swelling current is seen as a denser bunch travelling across. Returns [{ along, lane, strength }].
function streamAt(seconds, slots, fullAmps, ampsAt) {
  const charges = [];
  for (let slot = 0; slot < slots; slot++) {
    const turn = seconds / CROSSING_SECONDS + slot / slots;
    const along = turn - Math.floor(turn);
    const setOff = seconds - along * CROSSING_SECONDS;
    // Slots are ranked so that the ones a small current uses are spread evenly along the path.
    const rank = ((slot * 7) % slots) / slots;
    const needed = (rank + 0.02) * fullAmps;
    const strength = smooth(needed, needed + fullAmps * 0.08, ampsAt(setOff));
    if (strength > 0.01) charges.push({ along, lane: ((slot * 5) % slots) / slots, strength });
  }
  return charges;
}

const EMITTER_FULL_AMPS = EMITTER_BIAS_AMPS * 2.3;
const COLLECTOR_FULL_AMPS = COLLECTOR_LEAK_AMPS + ALPHA_RANGE[1] * EMITTER_FULL_AMPS * 0.75;

function holesAt(parameters, seconds, slots = 9) {
  return streamAt(seconds, slots, EMITTER_FULL_AMPS, (time) => sampleAt(parameters, time).emitterAmps);
}

function outflowAt(parameters, seconds, slots = 26) {
  return streamAt(seconds, slots, COLLECTOR_FULL_AMPS, (time) => sampleAt(parameters, time).collectorAmps);
}

// How strongly each numbered step shows at `phase` (0 to 1) of the walk-through.
function stepsAt(phase) {
  return STEP_STARTS.map((start) => smooth(start, start + STEP_RAMP, phase));
}

function describe(parameters) {
  if (!parameters.biasOn) return "bias off · no gain";
  const gain = measureGain(parameters);
  if (gain.inputSwing < 1e-9) return "bias on · no input";
  const power = gain.power >= 10 ? gain.power.toFixed(0) : gain.power.toFixed(1);
  return `bias on · voltage ×${gain.voltage.toFixed(1)} · power ×${power}${gain.clipped ? " · clipping" : ""}`;
}

export const TransistorApi = {
  SIGNAL_HERTZ,
  INPUT_FULL_VOLTS,
  EMITTER_OHMS,
  EMITTER_BIAS_AMPS,
  LOAD_OHMS,
  COLLECTOR_SUPPLY_VOLTS,
  COLLECTOR_LEAK_AMPS,
  ALPHA_DEFAULT,
  ALPHA_RANGE,
  CROSSING_SECONDS,
  EMITTER_FULL_AMPS,
  COLLECTOR_FULL_AMPS,
  DEFAULTS,
  STEPS,
  STEP_STARTS,
  clamp,
  smooth,
  createParameters,
  inputVoltsAt,
  emitterAmpsFor,
  collectorAmpsFor,
  sampleAt,
  measureGain,
  smallSignalGain,
  linearLimit,
  holesAt,
  outflowAt,
  stepsAt,
  describe,
};
