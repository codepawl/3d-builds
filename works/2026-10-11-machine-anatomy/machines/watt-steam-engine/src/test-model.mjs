// Tests of the pure engine model.   node test-model.mjs
import { EngineApi as Engine } from "./model.mjs";

const TAU = Engine.TAU;
const G = Engine.GEOMETRY;
let checks = 0;
const problems = [];

function expect(condition, message) {
  checks += 1;
  if (!condition) problems.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function everyAngle(visit, count = 720) {
  for (let step = 0; step < count; step++) visit((step / count) * TAU);
}

// ---- rigid bars keep their lengths ---------------------------------------------------------------------
let worstBar = 0;
everyAngle((crank) => {
  const pose = Engine.poseAt(crank);
  const errors = [
    distance(pose.beamEnd, G.beamPivot) - G.beamHalf,
    distance(pose.beamEnd, pose.planet) - G.connectingRod,
    distance(pose.planet, G.shaft) - (G.sunRadius + G.planetRadius),
    distance(pose.end, G.beamPivot) - G.beamHalf,
    distance(pose.inner, G.beamPivot) - G.motionInner,
    distance(pose.back, pose.inner) - G.motionLink,
    distance(pose.back, G.radiusAnchor) - G.radiusRod,
    distance(pose.rodTop, pose.end) - G.motionLink,
    distance(pose.rodTop, pose.back) - (G.beamHalf - G.motionInner),
  ];
  for (const error of errors) worstBar = Math.max(worstBar, Math.abs(error));
});
expect(worstBar < 1e-9, `every bar keeps its length through a whole turn (worst error ${worstBar.toExponential(2)} units)`);

// ---- Watt's parallel motion ----------------------------------------------------------------------------
const cycle = Engine.CYCLE;
const strayShare = cycle.rodStray / cycle.stroke;
expect(cycle.stroke > 55 && cycle.stroke < 65, `piston stroke is ${cycle.stroke.toFixed(2)} units`);
expect(strayShare < 0.001, `the piston rod's top stays within ${cycle.rodStray.toFixed(4)} units of a straight line over a ${cycle.stroke.toFixed(1)} unit stroke (${(strayShare * 100).toFixed(3)} %, want under 0.1 %)`);
expect(Math.abs(cycle.rodLine - G.radiusAnchor[0]) < 0.05, `that line stands over the cylinder at x ${cycle.rodLine.toFixed(3)} (the radius rod anchor is at ${G.radiusAnchor[0]})`);
let endSwing = 0;
let worstPantograph = 0;
everyAngle((crank) => {
  const pose = Engine.poseAt(crank);
  endSwing = Math.max(endSwing, Math.abs(pose.end[0] + G.beamHalf));
  // The pantograph: the pump rod's point lies half-way from the pivot to the piston rod's top.
  const half = [(G.beamPivot[0] + pose.rodTop[0]) / 2, (G.beamPivot[1] + pose.rodTop[1]) / 2];
  worstPantograph = Math.max(worstPantograph, distance(half, pose.pumpTop));
});
expect(endSwing > 100 * cycle.rodStray, `without the linkage the beam end swings ${endSwing.toFixed(2)} units sideways, ${(endSwing / cycle.rodStray).toFixed(0)} times more`);
expect(worstPantograph < 1e-9, `the air pump rod's point is always half-way between the pivot and the piston rod's top (${worstPantograph.toExponential(1)})`);

// ---- sun and planet gear -------------------------------------------------------------------------------
const start = Engine.linksAt(0);
const afterOne = Engine.linksAt(TAU);
const turns = (afterOne.sunAngle - start.sunAngle) / TAU;
expect(Math.abs(turns - 2) < 1e-9, `equal gears: the flywheel shaft turns ${turns.toFixed(6)} times for one double stroke (want 2)`);
const unequal = { ...G, sunRadius: 10, planetRadius: 20, connectingRod: 150 };
const unequalTurns = (Engine.linksAt(TAU, unequal).sunAngle - Engine.linksAt(0, unequal).sunAngle) / TAU;
expect(Math.abs(unequalTurns - 3) < 1e-9, `a planet twice the size of the sun gives ${unequalTurns.toFixed(6)} turns (want 1 + 20/10 = 3)`);
let worstSlip = 0;
let last = Engine.linksAt(0);
everyAngle((crank) => {
  if (crank === 0) return;
  const pose = Engine.linksAt(crank);
  // Rolling without slip: the arcs passed at the pitch point are equal on both gears.
  const sunArc = (pose.sunAngle - last.sunAngle - (pose.crank - last.crank)) * G.sunRadius;
  const planetArc = (pose.rodAngle - last.rodAngle - (pose.crank - last.crank)) * G.planetRadius;
  worstSlip = Math.max(worstSlip, Math.abs(sunArc + planetArc));
  last = pose;
}, 2880);
expect(worstSlip < 1e-9, `the gears roll without slipping (worst slip ${worstSlip.toExponential(1)} units per step)`);
let meshError = 0;
everyAngle((crank) => {
  const pose = Engine.linksAt(crank);
  // At the pitch point a tooth of one gear must meet a gap of the other.
  const sunPhase = (crank - pose.sunAngle) * G.teeth;
  const planetPhase = (crank + Math.PI - (pose.rodAngle - Math.PI / 2)) * G.teeth;
  meshError = Math.max(meshError, Math.abs(Math.cos((sunPhase + planetPhase) / 2 - Math.PI / 2 - (G.teeth * Math.PI) / 2)));
});
expect(meshError > 0.999, `teeth meet gaps at the pitch point all the way round (${meshError.toFixed(6)})`);

// ---- valves --------------------------------------------------------------------------------------------
let blowThrough = 0;
let wrongSide = 0;
let openTotal = { topSteam: 0, bottomSteam: 0, topExhaust: 0, bottomExhaust: 0 };
everyAngle((crank) => {
  const pose = Engine.poseAt(crank);
  const valves = pose.valves;
  blowThrough = Math.max(blowThrough, valves.topSteam * valves.topExhaust, valves.bottomSteam * valves.bottomExhaust);
  const midStroke = pose.stroke.share > 0.15 && pose.stroke.share < 0.85;
  if (midStroke && pose.stroke.direction === "down" && !(valves.topSteam === 1 && valves.bottomExhaust === 1 && valves.bottomSteam === 0 && valves.topExhaust === 0)) wrongSide += 1;
  if (midStroke && pose.stroke.direction === "up" && !(valves.bottomSteam === 1 && valves.topExhaust === 1 && valves.topSteam === 0 && valves.bottomExhaust === 0)) wrongSide += 1;
  for (const name of Object.keys(openTotal)) openTotal[name] += valves[name] / 720;
});
expect(blowThrough === 0, "no end of the cylinder ever has its steam and exhaust valves open together");
expect(wrongSide === 0, "down stroke: steam above, exhaust below; up stroke: steam below, exhaust above");
expect(Math.abs(openTotal.topSteam - openTotal.bottomSteam) < 0.02, `steam is admitted above and below for equal shares of the turn (${openTotal.topSteam.toFixed(3)} and ${openTotal.bottomSteam.toFixed(3)})`);
const top = Engine.poseAt(cycle.top + 0.4);
const bottom = Engine.poseAt(cycle.bottom + 0.4);
expect(top.stroke.direction === "down" && bottom.stroke.direction === "up", "the piston goes down after the top dead centre and up after the bottom");
expect(Math.abs(Engine.poseAt(cycle.top).pistonZ - cycle.pistonHigh) < 1e-6, `piston top ${cycle.pistonHigh.toFixed(2)}, bottom ${cycle.pistonLow.toFixed(2)}`);

// ---- air pump and plug rod -----------------------------------------------------------------------------
let pumpHigh = -Infinity;
let pumpLow = Infinity;
everyAngle((crank) => {
  const pose = Engine.linksAt(crank);
  pumpHigh = Math.max(pumpHigh, pose.pumpZ);
  pumpLow = Math.min(pumpLow, pose.pumpZ);
});
expect(Math.abs((pumpHigh - pumpLow) * 2 - cycle.stroke) < 0.05, `the air pump bucket travels half the piston's stroke (${(pumpHigh - pumpLow).toFixed(2)} of ${cycle.stroke.toFixed(2)}), ${pumpLow.toFixed(1)} to ${pumpHigh.toFixed(1)}`);

// ---- governor ------------------------------------------------------------------------------------------
expect(Engine.ballAngleFor(0.5) === Engine.GOVERNOR.restAngle, "below the lift speed the balls rest on their stops");
let rising = true;
for (let speed = 0.8; speed < 1.3; speed += 0.01) {
  if (Engine.ballAngleFor(speed + 0.01) < Engine.ballAngleFor(speed)) rising = false;
  if (Engine.ballDrop(Engine.ballAngleFor(speed + 0.01)) > Engine.ballDrop(Engine.ballAngleFor(speed))) rising = false;
  if (Engine.throttleFor(Engine.ballAngleFor(speed + 0.01)) > Engine.throttleFor(Engine.ballAngleFor(speed))) rising = false;
}
expect(rising, "faster shaft: the balls swing out and up, the sleeve rises and the throttle only closes");
const pendulum = Engine.ballDrop(Engine.ballAngleFor(1)) * 1 ** 2;
const pendulumFaster = Engine.ballDrop(Engine.ballAngleFor(1.02)) * 1.02 ** 2;
expect(Math.abs(pendulum - pendulumFaster) < 1e-9, "conical pendulum: the balls' drop below the pivot times the speed squared stays constant");

function runAt(load, seconds = 40) {
  const engine = Engine.createEngine(load);
  Engine.stepEngine(engine, seconds);
  let least = Infinity;
  let most = -Infinity;
  let sum = 0;
  const steps = 5 * 120;
  for (let step = 0; step < steps; step++) {
    Engine.stepEngine(engine, 1 / 120);
    least = Math.min(least, engine.speed);
    most = Math.max(most, engine.speed);
    sum += engine.speed / steps;
  }
  return { mean: sum, ripple: (most - least) / sum, throttle: Engine.throttleFor(engine.ballAngle), engine };
}

const light = runAt(0.15);
const middle = runAt(0.5);
const heavy = runAt(0.9);
for (const [name, run] of [["light", light], ["middle", middle], ["heavy", heavy]]) {
  expect(run.mean > 0.8 && run.mean < 1.06 && run.ripple < 0.06, `${name} load: speed settles at ${run.mean.toFixed(3)} of nominal, ripple ${(run.ripple * 100).toFixed(1)} %, throttle ${(run.throttle * 100).toFixed(0)} %, flywheel ${Engine.flywheelTurnsPerMinute(run.engine).toFixed(0)} turns a minute`);
}
expect(heavy.mean < middle.mean && middle.mean < light.mean, "a heavier load settles a little slower (a simple governor holds a speed range)");
expect(heavy.throttle > middle.throttle && middle.throttle > light.throttle, "and the governor holds the throttle wider open for it");
const spread = light.mean - heavy.mean;
expect(spread < 0.15, `from light to heavy load the speed changes by ${(spread * 100).toFixed(1)} % of nominal; ungoverned it would stall or race`);

// A step in the load: the speed dips, the throttle opens, the speed settles again without hunting for long.
const stepped = runAt(0.2).engine;
stepped.load = 0.85;
let lowest = Infinity;
const record = [];
for (let step = 0; step < 20 * 60; step++) {
  Engine.stepEngine(stepped, 1 / 60);
  lowest = Math.min(lowest, stepped.speed);
  record.push(stepped.speed);
}
const settled = record.slice(-300);
const settledSpread = Math.max(...settled) - Math.min(...settled);
expect(lowest > 0.75 && settledSpread < 0.06, `load stepped from 0.2 to 0.85: speed dips to ${lowest.toFixed(3)} and settles within ${(settledSpread * 100).toFixed(1)} % by 15 s`);

// ---- running: strokes and events -----------------------------------------------------------------------
const engine = Engine.settleEngine(Engine.createEngine(0.5));
expect(engine.strokes === 0 && Engine.strokeAt(engine.crank).direction === "down" && Engine.strokeAt(engine.crank).share < 0.05, "a settled engine is parked at the top of a down stroke");
const before = Engine.linksAt(engine.crank).sunAngle;
const events = Engine.stepEngine(engine, 10);
const changeovers = events.filter((event) => event.name === "changeover");
const gearTicks = events.filter((event) => event.name === "gear");
const turned = (Engine.linksAt(engine.crank).sunAngle - before) / TAU;
expect(changeovers.length === engine.strokes && engine.strokes >= 8, `${engine.strokes} strokes in 10 s, one valve changeover each`);
expect(changeovers.every((event, index) => index === 0 || event.direction !== changeovers[index - 1].direction), "strokes alternate down and up");
expect(Math.abs(turned - engine.strokes) < 1.1, `the flywheel made ${turned.toFixed(2)} turns in ${engine.strokes} strokes: one turn per stroke`);
expect(Math.abs(gearTicks.length - turned * Engine.ENGINE.gearTicksPerTurn) <= 1, `${gearTicks.length} gear ticks for ${turned.toFixed(2)} turns`);

// ---- film steps and trace ------------------------------------------------------------------------------
const early = Engine.stepsAt(0.1);
const late = Engine.stepsAt(0.95);
expect(early[0] === 1 && early[1] === 0 && late.every((level) => level === 1), "the six steps light up one after the other through a stroke");
expect(Engine.STEPS.length === 6 && Engine.TRACE.length === 4, "six steps, four words in the trace");

console.log(problems.length ? `model tests failed: ${problems.length}\n${problems.join("\n")}` : `model tests passed: ${checks} checks`);
process.exit(problems.length ? 1 : 0);
