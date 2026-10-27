import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Set JS67_DIR to the folder where three.js, gl-matrix, esbuild and the 67.js engine are installed.
if (!process.env.JS67_DIR) {
  throw new Error("Set JS67_DIR to your 67.js checkout (with node_modules installed).");
}
const threeModuleUrl = pathToFileURL(
  resolve(process.env.JS67_DIR, "node_modules/three/build/three.module.js"),
).href;
const THREE = await import(threeModuleUrl);

const source = (
  await readFile(new URL("./strand-physics.mjs", import.meta.url), "utf8")
).replace(
  'from "three"',
  `from "${threeModuleUrl}"`,
);
const { createStrandPhysics } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

function createFixture() {
  const model = new THREE.Group();
  const scene = new THREE.Scene();
  scene.add(model);
  for (let index = 0; index < 5; index++) {
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02));
    strand.name = `Strand_${index}`;
    model.add(strand);
  }
  const torso = new THREE.Group();
  torso.position.y = 5;
  scene.add(torso);
  const physics = createStrandPhysics(model, torso, scene, () => {});
  physics.reset();
  return { physics, torso };
}

test("hoses hang under gravity after the torso turns, without inheriting its rotation", () => {
  const { physics, torso } = createFixture();
  torso.rotation.z = Math.PI / 2;
  torso.updateMatrixWorld(true);
  for (let frame = 0; frame < 600; frame++) physics.update(1 / 120);
  for (const strand of physics.state) {
    const root = strand.points[0];
    const tip = strand.points.at(-1);
    const length = strand.points
      .slice(1)
      .reduce(
        (total, point, index) =>
          total +
          Math.hypot(
            ...point.map((value, axis) => value - strand.points[index][axis]),
          ),
        0,
      );
    assert.ok(
      root[1] - tip[1] > length * 0.99,
      "the hose settles vertically to its full length",
    );
    assert.ok(
      Math.hypot(tip[0] - root[0], tip[2] - root[2]) < 0.15,
      "residual sideways swinging settles",
    );
    assert.ok(strand.maxStretch < 1.01);
    assert.ok(strand.points.flat().every(Number.isFinite));
  }
});

test("fixed-step hose motion is stable across different render cadences", () => {
  const fast = createFixture();
  const slow = createFixture();
  for (const fixture of [fast, slow]) {
    fixture.torso.position.x = 0.8;
    fixture.torso.updateMatrixWorld(true);
  }
  for (let frame = 0; frame < 360; frame++) fast.physics.update(1 / 120);
  for (let frame = 0; frame < 90; frame++) slow.physics.update(1 / 30);
  const first = fast.physics.state[0].points.at(-1);
  const second = slow.physics.state[0].points.at(-1);
  assert.ok(
    Math.hypot(...first.map((value, index) => value - second[index])) < 0.03,
  );
});

test("hoses stay below their attachments during climbing and ballistic launch", () => {
  const { physics, torso } = createFixture();
  let maximumLateral = 0;
  let minimumDropFraction = 1;
  for (let frame = 0; frame < 600; frame++) {
    const time = frame / 120;
    if (time < 2) {
      torso.position.set(0, 5 + time * 0.55, time * 0.7);
      torso.rotation.x = (-Math.PI / 2) * Math.min(1, time / 1.8);
    } else {
      const flightTime = Math.min(time - 2, 2.6);
      torso.position.set(
        0,
        6.1 + 10.5 * flightTime - 4.9 * flightTime ** 2,
        1.4 + 2.8 * flightTime,
      );
      const progress = Math.min(1, flightTime / 2.2);
      torso.rotation.x =
        (-Math.PI / 2) * (1 - progress * progress * (3 - 2 * progress));
    }
    torso.updateMatrixWorld(true);
    physics.update(1 / 120);
    for (const strand of physics.state) {
      const root = strand.points[0];
      const tip = strand.points.at(-1);
      const length = strand.points
        .slice(1)
        .reduce(
          (total, point, index) =>
            total +
            Math.hypot(
              ...point.map((value, axis) => value - strand.points[index][axis]),
            ),
          0,
        );
      maximumLateral = Math.max(
        maximumLateral,
        Math.hypot(tip[0] - root[0], tip[2] - root[2]),
      );
      minimumDropFraction = Math.min(
        minimumDropFraction,
        (root[1] - tip[1]) / length,
      );
      assert.ok(strand.maxStretch < 1.015);
      assert.ok(strand.points.flat().every(Number.isFinite));
    }
  }
  assert.ok(
    maximumLateral < 0.55,
    `midmotion lateral divergence ${maximumLateral.toFixed(3)}m`,
  );
  assert.ok(
    minimumDropFraction > 0.92,
    `midmotion gravity alignment ${minimumDropFraction.toFixed(3)}`,
  );
});
