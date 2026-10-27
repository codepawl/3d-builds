import { test } from "node:test";
import assert from "node:assert/strict";
import * as Motion from "../kit/motion.mjs";

function run(spring, seconds, step) {
  let highest = -Infinity;
  const steps = Math.round(seconds / step);
  for (let index = 0; index < steps; index++) {
    Motion.stepSpring(spring, step);
    highest = Math.max(highest, spring.value);
  }
  return highest;
}

test("a critically damped spring settles in about its settle time and never passes the target", () => {
  const spring = Motion.createSpring({ ...Motion.springFor(0.3, 1), value: 0, target: 1 });
  const highest = run(spring, 0.3, 1 / 240);
  assert.ok(Math.abs(1 - spring.value) < 0.015, `value ${spring.value} after 0.3 s`);
  const later = run(spring, 0.3, 1 / 240);
  assert.equal(Motion.overshootBound(spring), 0);
  assert.ok(Math.max(highest, later) <= 1 + 1e-9, `highest ${Math.max(highest, later)}`);
  assert.ok(spring.settled, `value ${spring.value} after 0.6 s`);
});

test("an underdamped spring stays inside its overshoot bound", () => {
  const spring = Motion.createSpring({ stiffness: 46, damping: 11.2, value: 0, target: 1 });
  const bound = Motion.overshootBound(spring);
  const highest = run(spring, 4, 1 / 240);
  assert.ok(bound > 0.005 && bound < 0.02, `bound ${bound}`);
  assert.ok(highest - 1 <= bound + 0.002, `overshoot ${highest - 1} against bound ${bound}`);
  assert.ok(spring.settled);
});

test("a spring gives the same path at 30 and at 240 steps a second", () => {
  const coarse = Motion.createSpring({ ...Motion.springFor(0.5, 0.8), value: 0, target: 1 });
  const fine = Motion.createSpring({ ...Motion.springFor(0.5, 0.8), value: 0, target: 1 });
  run(coarse, 0.2, 1 / 30);
  run(fine, 0.2, 1 / 240);
  assert.ok(Math.abs(coarse.value - fine.value) < 0.01, `${coarse.value} vs ${fine.value}`);
});

test("inertia spins up and coasts down with its time constants, independent of the frame rate", () => {
  const spinning = Motion.createInertia({ spinUpSeconds: 0.5, coastSeconds: 2 });
  for (let step = 0; step < 30; step++) Motion.stepInertia(spinning, 4, 1 / 60);
  assert.ok(Math.abs(spinning.speed - 4 * (1 - Math.exp(-1))) < 1e-9, `speed after one time constant ${spinning.speed}`);
  const coarse = Motion.createInertia({ spinUpSeconds: 0.5 });
  Motion.stepInertia(coarse, 4, 0.5);
  assert.ok(Math.abs(coarse.angle - spinning.angle) < 1e-9, `angle ${coarse.angle} vs ${spinning.angle}`);
  const coasting = Motion.createInertia({ spinUpSeconds: 0.5, coastSeconds: 2, speed: 4 });
  Motion.stepInertia(coasting, 0, 2 * Math.LN2);
  assert.ok(Math.abs(coasting.speed - 2) < 1e-9, `half speed after 2 ln 2 s: ${coasting.speed}`);
});

test("a revolute joint keeps the radius and comes back after a full turn", () => {
  const pivot = [1, 2, 3];
  const point = [1, 5, 3];
  const quarter = Motion.revolute(pivot, [1, 0, 0], Math.PI / 2, point);
  assert.ok(Motion.distance(quarter, [1, 2, 6]) < 1e-9, `quarter turn about x: ${quarter}`);
  assert.ok(Math.abs(Motion.distance(quarter, pivot) - 3) < 1e-9);
  assert.ok(Motion.distance(Motion.revolute(pivot, [0.3, 0.4, 0.5], Math.PI * 2, point), point) < 1e-9);
});

test("a prismatic joint travels its distance along its axis", () => {
  const moved = Motion.prismatic([0, 0, 0], [0, 3, 4], 10);
  assert.ok(Motion.distance(moved, [0, 6, 8]) < 1e-9);
});

test("meshed gears turn opposite at the tooth ratio, a tooth always facing a gap", () => {
  const driverTeeth = 12;
  const drivenTeeth = 36;
  const phase = Motion.meshPhase(drivenTeeth);
  for (let index = 0; index < 50; index++) {
    const driverAngle = index * 0.37;
    const { drivenAngle, ratio } = Motion.gearMesh({ driverTeeth, drivenTeeth, driverAngle, phase });
    assert.equal(ratio, 1 / 3);
    const driverFraction = (((driverAngle * driverTeeth) / (2 * Math.PI)) % 1 + 1) % 1;
    const drivenFraction = ((((Math.PI - drivenAngle) * drivenTeeth) / (2 * Math.PI)) % 1 + 1) % 1;
    const offset = (((drivenFraction - driverFraction) % 1) + 1) % 1;
    assert.ok(Math.abs(offset - 0.5) < 1e-9, `tooth against gap: offset ${offset}`);
  }
  const once = Motion.gearMesh({ driverTeeth, drivenTeeth, driverAngle: 2 * Math.PI });
  assert.ok(Math.abs(once.drivenAngle + (2 * Math.PI) / 3) < 1e-9, "one driver turn is a third of a turn back");
});

test("a crank-slider stays closed and strokes twice the crank", () => {
  const crankRadius = 3;
  const rodLength = 10;
  const positions = [];
  for (let index = 0; index <= 360; index++) {
    const { pin, slider } = Motion.crankSlider({ centre: [0, 0, 0], crankRadius, rodLength, crankAngle: (index * Math.PI) / 180 });
    assert.ok(Math.abs(Motion.distance(pin, slider) - rodLength) < 1e-9);
    assert.ok(Math.abs(Motion.distance(pin, [0, 0, 0]) - crankRadius) < 1e-9);
    positions.push(slider[0]);
  }
  const stroke = Math.max(...positions) - Math.min(...positions);
  assert.ok(Math.abs(stroke - 2 * crankRadius) < 1e-6, `stroke ${stroke}`);
  assert.throws(() => Motion.crankSlider({ crankRadius: 5, rodLength: 4, crankAngle: 0 }));
});

test("a four-bar keeps every link length and refuses a pose it cannot reach", () => {
  const links = { ground: 8, crank: 2, coupler: 7, rocker: 5 };
  for (let index = 0; index < 360; index += 3) {
    const pose = Motion.fourBar({ ...links, crankAngle: (index * Math.PI) / 180 });
    assert.ok(pose, `crank-rocker assembles at ${index} degrees`);
    assert.ok(Math.abs(Motion.distance(pose.a, pose.b) - links.crank) < 1e-9);
    assert.ok(Math.abs(Motion.distance(pose.b, pose.c) - links.coupler) < 1e-9);
    assert.ok(Math.abs(Motion.distance(pose.c, pose.d) - links.rocker) < 1e-9);
  }
  assert.equal(Motion.fourBar({ ground: 10, crank: 1, coupler: 2, rocker: 2, crankAngle: 0 }), null);
});
