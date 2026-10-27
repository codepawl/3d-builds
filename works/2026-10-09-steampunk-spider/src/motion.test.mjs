import test from "node:test";
import assert from "node:assert/strict";
import { SecondOrderDynamics, solveTwoBone } from "./motion.mjs";

const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test("damped dynamics settle at the target and reset removes momentum", () => {
  const dynamics = new SecondOrderDynamics(2, 1, 0, -3);
  for (let i = 0; i < 360; i++) dynamics.update(1 / 60, 7);
  close(dynamics.value, 7);
  dynamics.reset(4);
  close(dynamics.update(1 / 60, 4), 4);
  close(dynamics.update(0, 8), 4);
});

test("underdamped dynamics overshoot before settling", () => {
  const dynamics = new SecondOrderDynamics(2, 0.5, 0);
  let peak = 0;
  for (let i = 0; i < 360; i++)
    peak = Math.max(peak, dynamics.update(1 / 120, 1));
  assert.ok(peak > 1.1 && peak < 1.3, `peak: ${peak}`);
  close(dynamics.value, 1, 1e-6);
});

test("negative response creates anticipation opposite to target motion", () => {
  const dynamics = new SecondOrderDynamics(2, 0.5, -2);
  assert.ok(dynamics.update(1 / 60, 1) < 0);
  for (let i = 0; i < 360; i++) dynamics.update(1 / 60, 1);
  close(dynamics.value, 1, 1e-6);
});

test("variable frame times and lag spikes stay finite at high frequencies", () => {
  for (const f of [0.5, 8, 100]) {
    for (const damping of [0.1, 1, 5]) {
      const dynamics = new SecondOrderDynamics(f, damping, -2);
      for (let i = 0; i < 120; i++) {
        const value = dynamics.update(
          [1 / 144, 1 / 30, 0.5, 1 / 60][i % 4],
          Math.sin(i * 0.2),
        );
        assert.ok(Number.isFinite(value) && Math.abs(value) < 100);
      }
      // Low damping rings longer; high damping has a slow settling mode.
      const settleTime =
        12 / (2 * Math.PI * f * Math.min(damping, 1 / (2 * damping)));
      dynamics.update(0.1, 2);
      for (let elapsed = 0; elapsed < settleTime; elapsed += 0.1)
        dynamics.update(0.1, 2);
      close(dynamics.value, 2, 0.03);
    }
  }
});

test("IK preserves both lengths and follows the pole for reachable targets", () => {
  const hip = [2, 3, -1];
  const target = [2, 1.5, -1];
  const result = solveTwoBone(hip, target, [3, 3, -1], 1, 1);
  close(distance(hip, result.knee), 1);
  close(distance(result.knee, result.foot), 1);
  assert.deepEqual(result.foot, target);
  assert.ok(result.knee[0] > hip[0]);
  assert.deepEqual(hip, [2, 3, -1]);
});

test("IK clamps targets beyond either reach limit", () => {
  for (const [target, reach] of [
    [[0, -20, 0], 3],
    [[0, -0.1, 0], 1],
  ]) {
    const result = solveTwoBone([0, 0, 0], target, [1, 0, 0], 2, 1);
    close(distance([0, 0, 0], result.foot), reach);
    close(distance([0, 0, 0], result.knee), 2);
    close(distance(result.knee, result.foot), 1);
  }
});

test("IK handles coincident feet and collinear poles", () => {
  for (const lengths of [
    [1, 1],
    [2, 1],
    [1, 2],
  ]) {
    const result = solveTwoBone([0, 0, 0], [0, 0, 0], [0, -3, 0], ...lengths);
    assert.ok([...result.knee, ...result.foot].every(Number.isFinite));
    close(distance([0, 0, 0], result.knee), lengths[0]);
    close(distance(result.knee, result.foot), lengths[1]);
  }
});

test("supported push preserves position and launch velocity through ballistic handoff", async () => {
  const { hermiteMotion } = await import("./motion.mjs");
  const duration = 0.45;
  const start = [0, 8, 7.1];
  const end = [0, 8.6, 8.25];
  const initialVelocity = [0, 0.4, 0.6];
  const launchVelocity = [0, 3, 5.2];
  assert.deepEqual(
    hermiteMotion(start, end, initialVelocity, launchVelocity, duration, 0)
      .position,
    start,
  );
  assert.ok(
    distance(
      hermiteMotion(
        start,
        end,
        initialVelocity,
        launchVelocity,
        duration,
        duration,
      ).position,
      end,
    ) < 1e-10,
  );
  assert.ok(
    distance(
      hermiteMotion(start, end, initialVelocity, launchVelocity, duration, 0)
        .velocity,
      initialVelocity,
    ) < 1e-10,
  );
  assert.ok(
    distance(
      hermiteMotion(
        start,
        end,
        initialVelocity,
        launchVelocity,
        duration,
        duration,
      ).velocity,
      launchVelocity,
    ) < 1e-10,
  );
  const sampleStep = 1e-5;
  const before = hermiteMotion(
    start,
    end,
    initialVelocity,
    launchVelocity,
    duration,
    duration - sampleStep,
  );
  const measured = end.map(
    (value, axis) => (value - before.position[axis]) / sampleStep,
  );
  assert.ok(distance(measured, launchVelocity) < 0.001);
  for (let elapsed = 0; elapsed <= duration; elapsed += 1 / 120) {
    const sample = hermiteMotion(
      start,
      end,
      initialVelocity,
      launchVelocity,
      duration,
      elapsed,
    );
    assert.ok(
      sample.velocity[1] > 0 && sample.velocity[2] > 0,
      "push keeps moving upward and forward",
    );
  }
});
