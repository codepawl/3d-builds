// Tests of the pure lamp model and of the exploded view's bookkeeping.
//   node test-model.mjs
import { LampApi as Lamp } from "./model.mjs";
import { ExplodeApi as Explode } from "./explode.mjs";
import { createLayout } from "./layout.mjs";

const problems = [];
let checks = 0;

function expect(condition, message) {
  checks += 1;
  if (!condition) problems.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

function run(lamp, seconds) {
  const events = [];
  for (let step = 0; step < Math.round(seconds * 60); step++) events.push(...Lamp.step(lamp, 1 / 60));
  return events.map((event) => event.name);
}

function steadyLamp(volts) {
  const lamp = Lamp.createLamp();
  Lamp.setVolts(lamp, volts);
  Lamp.setSwitch(lamp, true);
  run(lamp, 8);
  return lamp;
}

// Off: cold, no current, no glow.
const off = Lamp.createLamp();
run(off, 5);
expect(off.temperature === Lamp.AMBIENT_KELVIN && Lamp.currentOf(off) === 0 && Lamp.brightnessOf(off.temperature) === 0, `switch open for 5 s: ${off.temperature} K, ${Lamp.currentOf(off)} A, brightness ${Lamp.brightnessOf(off.temperature)}`);
expect(Lamp.heatWord(off.temperature) === "cold" && Lamp.stateText(off) === "off", `an open switch reads "${Lamp.stateText(off)}", "${Lamp.heatWord(off.temperature)}"`);

// On: the key takes its time, the current arrives, the filament heats to a steady state.
const on = Lamp.createLamp();
Lamp.setSwitch(on, true);
const first = run(on, 0.1);
expect(!on.closed && first.length === 0, `0.1 s after the key starts to turn the circuit is still open (turn ${on.turn.toFixed(2)})`);
const later = run(on, 7.9);
expect(later[0] === "switch-on" && later.includes("glow"), `then it closes and the filament starts to glow: ${later.join(", ")}`);
const steadyCurrent = Lamp.currentOf(on);
expect(Math.abs(on.temperature - Lamp.WORKING_KELVIN) < 5, `steady state at ${Lamp.NOMINAL_VOLTS} V: ${on.temperature.toFixed(0)} K (designed for ${Lamp.WORKING_KELVIN} K)`);
expect(Math.abs(steadyCurrent - Lamp.NOMINAL_VOLTS / Lamp.HOT_OHMS) < 0.005, `steady current ${steadyCurrent.toFixed(3)} A = ${Lamp.NOMINAL_VOLTS} V / ${Lamp.HOT_OHMS} ohms`);
const before = on.temperature;
run(on, 2);
expect(Math.abs(on.temperature - before) < 0.5, `it stays there: ${Math.abs(on.temperature - before).toFixed(3)} K of drift in 2 more seconds`);
expect(Lamp.heatWord(on.temperature) === "yellow-white" && on.litSeconds > 7, `it reads "${Lamp.heatWord(on.temperature)}", lit for ${on.litSeconds.toFixed(1)} s`);

// The thermal time constant: how long to cover 63% of the rise, and that the rise never overshoots.
const warming = Lamp.createLamp();
Lamp.setSwitch(warming, true);
let reached = null;
let highest = 0;
for (let step = 0; step < 60 * 8; step++) {
  Lamp.step(warming, 1 / 60);
  highest = Math.max(highest, warming.temperature);
  const target = Lamp.AMBIENT_KELVIN + 0.632 * (Lamp.WORKING_KELVIN - Lamp.AMBIENT_KELVIN);
  if (reached === null && warming.temperature >= target) reached = warming.time;
}
expect(reached > 0.3 && reached < 2, `63% of the rise is reached ${reached.toFixed(2)} s after the key starts to turn (wanted between 0.3 and 2 s)`);
expect(highest <= Lamp.WORKING_KELVIN + 1, `no overshoot: highest ${highest.toFixed(1)} K`);

// Colour and brightness follow temperature.
const samples = [400, 900, 1200, 1500, 1800, 2100].map((kelvin) => ({ kelvin, brightness: Lamp.brightnessOf(kelvin), colour: Lamp.colourOf(kelvin) }));
const rising = samples.every((sample, index) => index === 0 || sample.brightness >= samples[index - 1].brightness);
expect(rising && samples[0].brightness === 0 && Math.abs(samples[5].brightness - 1) < 1e-9, `brightness rises with temperature: ${samples.map((sample) => sample.brightness.toFixed(2)).join(" ")}`);
const red = Lamp.colourOf(1000);
const hot = Lamp.colourOf(2100);
expect(red[0] > red[1] * 2 && hot[0] > 240 && hot[1] > 200 && hot[2] < hot[1], `dull red at 1000 K rgb(${red}), warm yellow-white at 2100 K rgb(${hot})`);
expect(Lamp.colourOf(300).every((channel) => channel < 90), `cold carbon is dark grey rgb(${Lamp.colourOf(300)})`);

// More voltage: more current, hotter, brighter. Less: dimmer.
const dim = steadyLamp(55);
const normal = steadyLamp(100);
const bright = steadyLamp(115);
expect(dim.temperature < normal.temperature && normal.temperature < bright.temperature, `steady temperature at 55, 100, 115 V: ${dim.temperature.toFixed(0)}, ${normal.temperature.toFixed(0)}, ${bright.temperature.toFixed(0)} K`);
expect(Lamp.brightnessOf(dim.temperature) < Lamp.brightnessOf(normal.temperature) && Lamp.brightnessOf(normal.temperature) < Lamp.brightnessOf(bright.temperature), `brightness: ${[dim, normal, bright].map((lamp) => Lamp.brightnessOf(lamp.temperature).toFixed(2)).join(" < ")}`);
expect(Lamp.currentOf(dim) < Lamp.currentOf(normal) && Lamp.currentOf(normal) < Lamp.currentOf(bright), `current: ${[dim, normal, bright].map((lamp) => Lamp.currentOf(lamp).toFixed(2)).join(" < ")} A`);
const clamped = Lamp.createLamp();
Lamp.setVolts(clamped, 500);
expect(clamped.volts === Lamp.MAX_VOLTS, `the voltage control stops at ${Lamp.MAX_VOLTS} V`);

// Switch open again: it cools, and the "lit for" time starts again at the next glow.
Lamp.setSwitch(normal, false);
const cooling = run(normal, 6);
expect(cooling[0] === "switch-off" && normal.temperature < Lamp.GLOW_KELVIN && Lamp.currentOf(normal) === 0, `6 s after switching off: ${normal.temperature.toFixed(0)} K, no current`);
Lamp.setSwitch(normal, true);
run(normal, 1.5);
expect(normal.litSeconds > 0.3 && normal.litSeconds < 1.5, `lit again for ${normal.litSeconds.toFixed(2)} s after 1.5 s`);

// Why the vacuum: with air in the bulb the hot filament burns through and the circuit opens.
const aired = steadyLamp(100);
Lamp.letAirIn(aired);
const burning = run(aired, 4);
expect(burning.includes("burn-out") && aired.broken, `air let in at white heat: ${burning.join(", ")}`);
expect(Lamp.currentOf(aired) === 0 && !Lamp.circuitComplete(aired) && aired.closed, "the switch is still closed but the circuit is open: no current");
run(aired, 6);
expect(aired.temperature < Lamp.GLOW_KELVIN && Lamp.stateText(aired).startsWith("filament burnt out"), `it goes dark: ${aired.temperature.toFixed(0)} K, "${Lamp.stateText(aired)}"`);
const coldAir = Lamp.createLamp();
Lamp.letAirIn(coldAir);
run(coldAir, 5);
expect(!coldAir.broken && coldAir.wear === 0, "air round a cold filament does nothing");
const sealed = steadyLamp(115);
run(sealed, 60);
expect(!sealed.broken && sealed.wear === 0, "in the vacuum it does not burn, even at the highest voltage for a minute");
Lamp.mend(aired);
const mended = run(aired, 6);
expect(!aired.broken && !aired.air && Math.abs(aired.temperature - Lamp.WORKING_KELVIN) < 5, `a new filament and a pumped bulb: lit again at ${aired.temperature.toFixed(0)} K (${mended.join(", ") || "no new events"})`);

// The lit path arrives piece by piece and the five steps come in order.
const stepping = Lamp.createLamp();
Lamp.setSwitch(stepping, true);
const firstSeen = [null, null, null, null, null];
for (let step = 0; step < 240 * 6; step++) {
  Lamp.step(stepping, 1 / 240);
  Lamp.stepLevels(stepping).forEach((level, index) => {
    if (firstSeen[index] === null && level >= 0.5) firstSeen[index] = stepping.time;
  });
}
const inOrder = firstSeen.every((time, index) => time !== null && (index === 0 || time > firstSeen[index - 1]));
expect(inOrder, `the five steps pass half way at ${firstSeen.map((time) => time?.toFixed(2)).join(", ")} s, in order`);
expect(Lamp.PATH_SEGMENTS.every((name) => Lamp.segmentGlow(stepping, name) === 1), "every piece of the path is lit once the sweep is through");
expect(Lamp.STEPS.length === 5 && Lamp.TRACE.length === 4, "five step labels and four trace words");

// The layout: the filament and wires stay inside the glass, and the route is one unbroken line.
const Layout = createLayout();
const inside = Layout.filamentPoints().every(([x, , z]) => Math.abs(x - Layout.lamp.x) < Layout.bulbRadius(z) - 3);
expect(inside, "every point of the filament is at least 3 units inside the bulb");
const leadsInside = [-1, 1].every((side) => Layout.leadPoints(side).every(([x, , z]) => z < Layout.sizes.bulb.z0 || Math.abs(x - Layout.lamp.x) < Layout.bulbRadius(z) - 1));
expect(leadsInside, "both lead-in wires stay inside the bulb");
const routes = Layout.pathRoutes();
const joined = ["socketIn", "leadUp", "socketOut", "wireBack"].every((name) => {
  const previous = routes[Lamp.PATH_SEGMENTS[Lamp.PATH_SEGMENTS.indexOf(name) - 1]];
  const end = previous[previous.length - 1];
  const start = routes[name][0];
  return Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) < 1e-9;
});
expect(joined, "each piece of the current's route starts where the last one ends");
const hoop = Layout.filamentPoints();
const clampHeight = Layout.sizes.clamps.z1 - Layout.sizes.clamps.z0;
const onClamps = [[hoop[0], routes.leadUp[3]], [hoop[hoop.length - 1], routes.leadDown[0]]].every(([foot, wireTop]) => foot[0] === wireTop[0] && Math.abs(foot[2] - wireTop[2] - clampHeight) < 1e-9);
expect(onClamps, "each end of the filament stands on a clamp, straight above the top of a lead-in wire");
const smoothJoin = Math.abs(Layout.bulbRadius(59.5) - Layout.bulbRadius(59.51)) < 0.02 && Layout.bulbRadius(Layout.sizes.bulb.z0) === Layout.sizes.bulb.neck;
expect(smoothJoin, "the bulb's neck runs into its globe without a step");

// The exploded view: nine assemblies, staggered springs, and it comes back to exactly where it was.
const numbers = Object.values(Explode.PIECES).map((piece) => piece.number).sort((a, b) => a - b);
expect(numbers.join(",") === "1,2,3,4,5,6,7,8,9", `nine numbered assemblies: ${numbers.join(",")}`);
const state = Explode.createExplode();
Explode.setApart(state, true, false);
const leaves = [];
for (let step = 0; step < 60 * 8; step++) leaves.push(...Explode.stepExplode(state, 1 / 60).filter((event) => event.name === "leave"));
const gaps = leaves.slice(1).map((event, index) => event.at - leaves[index].at);
expect(leaves.map((event) => event.piece).join(",") === Explode.LEAVE_ORDER.join(",") && gaps.every((gap) => Math.abs(gap - Explode.SPRING.stagger) < 0.02), `assemblies leave one by one, ${Explode.SPRING.stagger} s apart: ${leaves.map((event) => event.piece).join(", ")}`);
expect(Explode.isResting(state) && Explode.maxShare(state) === 1, "apart and at rest after 8 s");
Explode.setApart(state, false, false);
for (let step = 0; step < 60 * 8; step++) Explode.stepExplode(state, 1 / 60);
const shifts = Explode.shiftsOf(state);
expect(Explode.isResting(state) && Object.values(shifts).every((shift) => shift.every((value) => value === 0)), "back together: every assembly exactly where it started");

console.log(problems.length ? `model tests failed: ${problems.length} of ${checks}\n${problems.join("\n")}` : `model tests passed: ${checks} checks`);
process.exit(problems.length ? 1 : 0);
