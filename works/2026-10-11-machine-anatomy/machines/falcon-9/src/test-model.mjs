// Tests of the pure Falcon 9 flight model and of the exploded view's bookkeeping.
//   node test-model.mjs
import { FalconApi as Falcon } from "./model.mjs";
import { createExplodeKit } from "../../../src/kit/explode.mjs";
import machine from "./machine.mjs";

const Explode = createExplodeKit({ pieces: machine.pieces, leaveOrder: machine.leaveOrder, spring: machine.spring });

const problems = [];
let checks = 0;

function expect(condition, message) {
  checks += 1;
  if (!condition) problems.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

// Flies the whole flight in steps of `seconds` of mission time and records what the tests look at.
function fly(seconds) {
  const flight = Falcon.createFlight();
  const record = { events: [], samples: [], massRises: 0, maxThrottle: 0, throttleAtPeak: null };
  let lastMass = flight.booster.mass;
  while (flight.phase !== "landed" && flight.time < 900) {
    record.events.push(...Falcon.step(flight, seconds));
    if (flight.booster.mass > lastMass + 1e-6 && flight.phase !== "separation") record.massRises += 1;
    lastMass = flight.booster.mass;
    record.samples.push({ time: flight.time, phase: flight.phase, h: flight.booster.h, throttle: Falcon.throttleShare(flight), engines: flight.booster.engines, legs: flight.legs.value, fins: flight.fins.value, propellant: flight.propellant, pitch: flight.booster.pitch });
  }
  return { flight, ...record };
}

const nominal = fly(1 / 30);
const flight = nominal.flight;
const order = flight.history.map((entry) => entry.phase);
const at = (phase) => flight.history.find((entry) => entry.phase === phase)?.at;

expect(JSON.stringify(order) === JSON.stringify(Falcon.PHASES.slice(1)), `the booster goes through every phase once, in order: ${order.join(" > ")}`);
expect(Math.abs(at("liftoff") - Falcon.TIMES.liftoff) < 0.05 && Math.abs(at("meco") - Falcon.TIMES.meco) < 0.05 && Math.abs(at("separation") - Falcon.TIMES.separation) < 0.05, `liftoff, MECO and separation at the user's guide times: ${at("liftoff")}, ${at("meco")}, ${at("separation")} s`);
expect(nominal.samples.filter((sample) => sample.time < 0).every((sample) => sample.h === 0), "held down on the pad while the engines start");
expect(nominal.samples.filter((sample) => sample.time > 0 && sample.time < Falcon.TIMES.meco).every((sample) => sample.engines === 9), "nine engines burn from liftoff to MECO");

const peak = flight.peakPressure;
const throttleAtPeak = nominal.samples.find((sample) => sample.time >= peak.at).throttle;
expect(Math.abs(peak.at - Falcon.TIMES.maxQ) < 22, `max Q comes out of the integration at T+${peak.at.toFixed(1)} s, near the guide's T+74 s (${Math.round(peak.value / 1000)} kPa)`);
expect(throttleAtPeak < 0.9 && throttleAtPeak >= Falcon.MIN_THROTTLE, `the engines are throttled down at max Q: ${Math.round(throttleAtPeak * 100)}%, not under the ${Math.round(Falcon.MIN_THROTTLE * 100)}% floor`);
const steps = nominal.samples.map((sample, index) => (index ? Math.abs(sample.throttle - nominal.samples[index - 1].throttle) : 0));
expect(Math.max(...steps) < 0.2, `no instant throttle snaps: the largest change in one step is ${Math.max(...steps).toFixed(3)}`);

const meco = nominal.samples.find((sample) => sample.time >= Falcon.TIMES.meco);
expect(meco.h > 40000 && meco.h < 90000 && meco.pitch > 0.6, `MECO high up and tipped downrange: ${Math.round(meco.h / 1000)} km, pitch ${Math.round((meco.pitch * 180) / Math.PI)} degrees`);
expect(nominal.events.some((event) => event.name === "ses-1") && nominal.events.some((event) => event.name === "fairing-separation"), "the second stage lights its engine and drops the fairing");
expect(flight.upper.apart > 10000, `the second stage flies on: ${Math.round(flight.upper.apart / 1000)} km away at touchdown`);
expect(nominal.massRises === 0, "the booster only ever gets lighter (except shedding the upper stage)");

const boostback = nominal.samples.filter((sample) => sample.phase === "boostback");
expect(boostback.length > 0 && boostback.every((sample) => sample.pitch < 0), "the booster has flipped round before the boostback burn");
const finsOutBeforeEntry = nominal.samples.find((sample) => sample.phase === "entry-burn").fins > 0.95;
expect(finsOutBeforeEntry, "the grid fins are out before the entry burn");
const landingBurn = nominal.samples.filter((sample) => sample.phase === "landing-burn");
expect(landingBurn.every((sample) => sample.engines === 1), "the landing burn uses one engine");
const lastBurn = landingBurn[landingBurn.length - 1];
expect(lastBurn.legs > 0.95, `the legs are down before touchdown (${lastBurn.legs.toFixed(2)})`);
expect(landingBurn[0].legs < 0.05, "the legs are still folded when the landing burn starts");

const planned = Falcon.plannedLanding();
expect(flight.touchdownSpeed < 2, `soft touchdown: ${flight.touchdownSpeed.toFixed(2)} m/s`);
expect(Math.abs(flight.booster.x - planned.x) < 12, `lands on the droneship: ${Math.round(flight.booster.x - planned.x)} m from its centre, ${Math.round(planned.x / 1000)} km downrange`);
expect(flight.propellant > 0, `propellant left at touchdown: ${Math.round(flight.propellant)} kg`);

// The page steps the model with whatever frame time it gets; fixed pieces make the flight the same.
const jumpy = fly(0.0523);
expect(Math.abs(jumpy.flight.booster.x - flight.booster.x) < 1 && jumpy.flight.touchdownSpeed < 2, "another frame rate flies the same flight");

const film = Falcon.playbackRate({ phase: "ignition", time: -1, booster: flight.booster });
expect(film === 1, "the pad is shown in real time");
let rate = 1;
let largest = 0;
for (let index = 0; index < 60; index++) {
  const next = Falcon.easePlayback(rate, 60, 1 / 30);
  largest = Math.max(largest, next - rate);
  rate = next;
}
expect(largest < 6, `the playback rate eases, never jumps: largest step ${largest.toFixed(2)} per frame`);

const words = Falcon.readoutOf(flight);
expect(/^T\+7:\d\d · landed on the droneship · engines off · 0 m up · 0 m\/s$/.test(words), `readout at the end: "${words}"`);
expect(Falcon.traceLevels(flight).every((level) => level === 1), "every word of the trace is lit at the end");

const explode = Explode.createExplode();
Explode.setApart(explode, true, true);
expect(Explode.isResting(explode) && Explode.maxShare(explode) === 1, "calm apart: every assembly rests apart");
Explode.setApart(explode, false, true);
expect(Explode.maxShare(explode) === 0, "calm close: back together");

// The booster turns no faster than its actuators allow: the flip on nitrogen thrusters is a slow turn.
const flipSamples = nominal.samples.filter((sample) => sample.phase === "flip");
let fastestFlipTurn = 0;
for (let index = 1; index < flipSamples.length; index++) {
  const seconds = flipSamples[index].time - flipSamples[index - 1].time;
  if (seconds > 0) fastestFlipTurn = Math.max(fastestFlipTurn, Math.abs(flipSamples[index].pitch - flipSamples[index - 1].pitch) / seconds);
}
expect(flipSamples.length > 0 && fastestFlipTurn <= 0.121, `the flip turns at most 0.12 rad/s on the thrusters (fastest ${fastestFlipTurn.toFixed(3)})`);
const entryEngines = new Set(nominal.samples.filter((sample) => sample.phase === "entry-burn").map((sample) => sample.engines));
const landingEngines = new Set(nominal.samples.filter((sample) => sample.phase === "landing-burn").map((sample) => sample.engines));
expect(entryEngines.size === 1 && entryEngines.has(3) && landingEngines.size === 1 && landingEngines.has(1), "three engines for the entry burn, the centre engine alone for landing");


console.log(`\n${checks - problems.length} of ${checks} checks pass`);
if (problems.length) process.exit(1);

