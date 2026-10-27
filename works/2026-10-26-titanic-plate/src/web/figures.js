// Small people: one part list drives both the instanced crowds and the full-size portraits.
import * as THREE from 'three';

export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN = ['#f0c9a0', '#e8b98c', '#d9a577', '#c68e64', '#f4d2b0'];
const HAIR = ['#2b1d14', '#5a3a22', '#8a6a3a', '#caa86a', '#8a8a86', '#1a1a1a'];
const FIRST_COAT = ['#1d1d22', '#26262e', '#3a3a42', '#1f2a3d'];
const FIRST_GOWN = ['#8e2b3a', '#2f6f73', '#e6d9bd', '#c98a9a', '#4a3a78', '#b8862e', '#3f6b45'];
const SECOND_COAT = ['#5b4a3a', '#3f4f5f', '#6b6b5a', '#4a3a3a'];
const THIRD_COAT = ['#6a5a48', '#7d7566', '#4a5668', '#5a3f35', '#8a7a5a', '#55604a'];
const THIRD_DRESS = ['#6b4a3c', '#4e5b6e', '#7a6a58', '#5d3a44', '#8a8a78'];

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// kind: first, second, third, steward, officer, captain, sailor, stoker, engineer, cook, marconi, child
export function makeSpec(kind, rng) {
  const spec = {
    kind,
    skin: pick(rng, SKIN),
    hair: pick(rng, HAIR),
    coat: '#444',
    trousers: '#2a2a30',
    hat: null,
    hatShape: 'cap',
    woman: false,
    scale: 0.96 + rng() * 0.12,
    bareArms: false,
    accent: null,
  };
  const woman = rng() < 0.42;
  if (kind === 'first') {
    spec.woman = woman;
    spec.coat = woman ? pick(rng, FIRST_GOWN) : pick(rng, FIRST_COAT);
    spec.hat = woman ? pick(rng, FIRST_GOWN) : (rng() < 0.4 ? '#161616' : null);
    spec.hatShape = woman ? 'brim' : 'top';
  } else if (kind === 'second') {
    spec.woman = woman;
    spec.coat = woman ? pick(rng, THIRD_DRESS) : pick(rng, SECOND_COAT);
    spec.hat = rng() < 0.5 ? '#3d3028' : null;
  } else if (kind === 'third') {
    spec.woman = woman;
    spec.coat = woman ? pick(rng, THIRD_DRESS) : pick(rng, THIRD_COAT);
    spec.trousers = '#3a3530';
    spec.hat = woman ? pick(rng, ['#7a5a4a', '#8a8a78', '#5d3a44']) : (rng() < 0.6 ? '#4a4034' : null);
    spec.hatShape = woman ? 'scarf' : 'cap';
  } else if (kind === 'steward') {
    spec.coat = '#f1ece0';
    spec.trousers = '#1d1d22';
    spec.hat = null;
  } else if (kind === 'officer') {
    spec.coat = '#1c2a4a';
    spec.trousers = '#1c2a4a';
    spec.hat = '#f1ece0';
    spec.accent = '#d4a93c';
  } else if (kind === 'captain') {
    spec.coat = '#16233f';
    spec.trousers = '#16233f';
    spec.hat = '#f1ece0';
    spec.accent = '#d4a93c';
    spec.hair = '#e8e4dc';
    spec.scale = 1.06;
  } else if (kind === 'sailor') {
    spec.coat = '#2d3f66';
    spec.trousers = '#2d3f66';
    spec.hat = '#f1ece0';
  } else if (kind === 'stoker') {
    spec.coat = pick(rng, ['#6e6a62', '#5a5650', '#7a7266']);
    spec.trousers = '#34312c';
    spec.hat = '#2e2a26';
    spec.bareArms = true;
    spec.accent = '#c24a2a';
  } else if (kind === 'engineer') {
    spec.coat = '#35527a';
    spec.trousers = '#35527a';
    spec.hat = '#2a2a2e';
  } else if (kind === 'cook') {
    spec.coat = '#f6f1e6';
    spec.trousers = '#2a2a30';
    spec.hat = '#f6f1e6';
    spec.hatShape = 'top';
  } else if (kind === 'marconi') {
    spec.coat = '#3a3a44';
    spec.trousers = '#2a2a30';
    spec.hat = '#101010';
    spec.hatShape = 'phones';
  } else if (kind === 'child') {
    spec.coat = pick(rng, ['#b04a3a', '#4a78a8', '#c8a83a']);
    spec.trousers = '#4a4034';
    spec.scale = 0.62;
    spec.hat = null;
  }
  return spec;
}

const IDENTITY = new THREE.Matrix4();
const EULER = new THREE.Euler();
const QUAT = new THREE.Quaternion();

function part(shape, color, px, py, pz, rx, rz, sx, sy, sz) {
  EULER.set(rx, 0, rz);
  QUAT.setFromEuler(EULER);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    QUAT.clone(),
    new THREE.Vector3(sx, sy, sz),
  );
  return { shape, color, matrix, upper: false };
}

// Local frame: feet at the origin, facing +z, about 1.8 m tall before scale.
// detail adds buttons, collar and belt for the large portraits.
export function figureParts(spec, pose, detail = false) {
  const parts = [];
  const seated = pose === 'sit';
  const hipHeight = seated ? 0.5 : 0.9;
  const lean = pose === 'shovel' ? 0.55 : (pose === 'bow' ? 0.3 : 0);
  const upper = [];
  const shoe = '#1e1a18';

  // legs: tapered trousers and rounded shoes (women's skirts hide them)
  if (!spec.woman || seated) {
    const stride = pose === 'walk' ? 0.32 : 0;
    for (const side of [-1, 1]) {
      if (seated) {
        parts.push(part('taper', spec.trousers, side * 0.1, 0.5, 0.2, Math.PI / 2, 0, 0.1, 0.44, 0.1));
        parts.push(part('taper', spec.trousers, side * 0.1, 0.25, 0.43, 0, 0, 0.08, 0.5, 0.08));
        parts.push(part('sph', shoe, side * 0.1, 0.04, 0.5, 0, 0, 0.07, 0.05, 0.12));
      } else {
        const swing = side * stride;
        parts.push(part('taper', spec.trousers, side * 0.1, 0.45, 0, swing, 0, 0.1, 0.9, 0.1));
        parts.push(part('sph', shoe, side * 0.1, 0.04, 0.06 + swing * 0.5, 0, 0, 0.07, 0.05, 0.12));
      }
    }
  }
  if (spec.woman && !seated) {
    parts.push(part('cone', spec.coat, 0, 0.6, 0, 0, 0, 0.4, 1.2, 0.4));
    parts.push(part('sph', shoe, -0.1, 0.03, 0.18, 0, 0, 0.06, 0.04, 0.1));
    parts.push(part('sph', shoe, 0.1, 0.03, 0.18, 0, 0, 0.06, 0.04, 0.1));
  }

  // upper body around the hip pivot, then leaned
  const torsoHeight = spec.woman ? 0.52 : 0.64;
  const torsoCenter = hipHeight + torsoHeight / 2;
  if (spec.woman) {
    upper.push(part('taper', spec.coat, 0, torsoCenter, 0, 0, 0, 0.22, torsoHeight, 0.15));
  } else {
    upper.push(part('cone', spec.coat, 0, torsoCenter, 0, 0, 0, 0.3, torsoHeight + 0.04, 0.21));
  }
  const shoulderY = hipHeight + torsoHeight - 0.05;
  for (const side of [-1, 1]) {
    upper.push(part('sph', spec.bareArms ? spec.skin : spec.coat, side * 0.25, shoulderY, 0, 0, 0, 0.085, 0.085, 0.085));
  }
  if (spec.accent && (spec.kind === 'officer' || spec.kind === 'captain')) {
    upper.push(part('box', spec.accent, 0, hipHeight + 0.5, 0.17, 0, 0, 0.06, 0.34, 0.02));
    for (const side of [-1, 1]) upper.push(part('box', spec.accent, side * 0.3, shoulderY - 0.38, 0, 0, 0, 0.03, 0.03, 0.12));
  }
  if (spec.accent && spec.kind === 'stoker') {
    upper.push(part('sph', spec.accent, 0, hipHeight + torsoHeight + 0.2, 0.06, 0, 0, 0.1, 0.08, 0.04));
  }
  if (detail) {
    upper.push(part('cyl', '#f1ece0', 0, hipHeight + torsoHeight + 0.01, 0, 0, 0, 0.12, 0.05, 0.12));
    upper.push(part('cyl', '#241c18', 0, hipHeight + 0.03, 0, 0, 0, 0.23, 0.05, 0.17));
    for (let i = 0; i < 3; i++) upper.push(part('sph', '#d4a93c', 0, hipHeight + 0.2 + i * 0.14, 0.2, 0, 0, 0.022, 0.022, 0.02));
  }
  const headY = hipHeight + torsoHeight + 0.2;
  upper.push(part('cyl', spec.skin, 0, headY - 0.17, 0, 0, 0, 0.05, 0.1, 0.05));
  upper.push(part('sph', spec.skin, 0, headY, 0, 0, 0, 0.125, 0.15, 0.13));
  upper.push(part('sph', spec.skin, 0, headY - 0.03, 0.115, 0, 0, 0.03, 0.03, 0.025));
  if (spec.hat) {
    if (spec.hatShape === 'top') {
      upper.push(part('cyl', spec.hat, 0, headY + 0.22, 0, 0, 0, 0.12, 0.28, 0.12));
      upper.push(part('cyl', spec.hat, 0, headY + 0.08, 0, 0, 0, 0.19, 0.03, 0.19));
    } else if (spec.hatShape === 'brim') {
      upper.push(part('cyl', spec.hat, 0, headY + 0.1, 0, 0, 0, 0.3, 0.035, 0.3));
      upper.push(part('sph', spec.hat, 0, headY + 0.15, 0, 0, 0, 0.14, 0.1, 0.14));
    } else if (spec.hatShape === 'scarf') {
      upper.push(part('sph', spec.hat, 0, headY + 0.05, -0.015, 0, 0, 0.145, 0.14, 0.15));
    } else if (spec.hatShape === 'phones') {
      upper.push(part('sph', spec.hair, 0, headY + 0.05, -0.02, 0, 0, 0.13, 0.12, 0.13));
      upper.push(part('cyl', spec.hat, 0, headY, 0, 0, Math.PI / 2, 0.05, 0.31, 0.05));
    } else {
      upper.push(part('sph', spec.hat, 0, headY + 0.07, 0.0, 0, 0, 0.135, 0.09, 0.14));
      upper.push(part('cyl', spec.hat, 0, headY + 0.05, 0.1, 0, 0, 0.13, 0.025, 0.1));
    }
  } else {
    upper.push(part('sph', spec.hair, 0, headY + 0.045, -0.02, 0, 0, 0.135, 0.12, 0.14));
    if (spec.woman) upper.push(part('sph', spec.hair, 0, headY + 0.04, -0.12, 0, 0, 0.09, 0.09, 0.07));
  }
  // arms: tapered sleeves with round hands
  const sleeve = spec.bareArms ? spec.skin : spec.coat;
  let leftForward = 0.05;
  let rightForward = 0.05;
  if (pose === 'walk') { leftForward = 0.4; rightForward = -0.4; }
  if (pose === 'sit') { leftForward = 1.0; rightForward = 1.0; }
  if (pose === 'shovel') { leftForward = 1.1; rightForward = 0.9; }
  if (pose === 'carry') { leftForward = 1.35; rightForward = 1.35; }
  if (pose === 'raise') { leftForward = 0.1; rightForward = 2.7; }
  if (pose === 'work') { leftForward = 1.2; rightForward = 0.7; }
  if (pose === 'swim') { leftForward = 2.2; rightForward = 2.2; }
  [[-1, leftForward], [1, rightForward]].forEach(([side, forward]) => {
    const armLength = 0.56;
    const centerY = shoulderY - Math.cos(forward) * armLength / 2;
    const centerZ = Math.sin(forward) * armLength / 2;
    upper.push(part('taper', sleeve, side * 0.27, centerY, centerZ, -forward, 0, 0.06, armLength, 0.06));
    upper.push(part('sph', spec.skin, side * 0.27, shoulderY - Math.cos(forward) * armLength, Math.sin(forward) * armLength, 0, 0, 0.05, 0.05, 0.05));
  });
  if (pose === 'shovel') {
    upper.push(part('box', '#7a5a3a', 0, hipHeight + 0.2, 0.65, 0.5, 0, 0.05, 0.05, 1.3));
    upper.push(part('box', '#4a4a4e', 0, hipHeight - 0.2, 1.2, 0.5, 0, 0.3, 0.04, 0.3));
  }
  if (pose === 'carry') {
    upper.push(part('cyl', '#d8d0c0', 0, hipHeight + 0.45, 0.4, 0, 0, 0.24, 0.03, 0.24));
  }

  const pivotUp = new THREE.Matrix4().makeTranslation(0, hipHeight, 0);
  const pivotDown = new THREE.Matrix4().makeTranslation(0, -hipHeight, 0);
  const leanMatrix = new THREE.Matrix4().makeRotationX(lean);
  const group = new THREE.Matrix4().multiplyMatrices(pivotUp, new THREE.Matrix4().multiplyMatrices(leanMatrix, pivotDown));
  for (const entry of upper) {
    entry.matrix = new THREE.Matrix4().multiplyMatrices(group, entry.matrix);
    parts.push(entry);
  }
  return parts;
}

const SHAPE_GEOMETRY = {
  cyl: () => new THREE.CylinderGeometry(1, 1, 1, 9),
  cone: () => new THREE.CylinderGeometry(0.62, 1, 1, 10),
  taper: () => new THREE.CylinderGeometry(0.85, 1, 1, 9),
  sph: () => new THREE.SphereGeometry(1, 12, 9),
  box: () => new THREE.BoxGeometry(1, 1, 1),
};

export class Crowd {
  constructor() {
    this.figures = [];
    this.count = 0;
  }

  // A figure is remembered, not drawn: build() drops it onto the surface below it first.
  add(spec, pose, x, y, z, rotationY = 0, scale = 1.0) {
    this.figures.push({ spec, pose, x, y, z, rotationY, scale, requestedY: y });
    this.count += 1;
  }

  // Where the two feet and the hips of a figure stand, in ship coordinates.
  static footPoints(figure) {
    const size = figure.spec.scale * figure.scale * 1.08;
    const forward = figure.pose === 'sit' ? 0.5 * size : 0;
    const points = [{ x: figure.x, z: figure.z }];
    if (forward > 0) {
      points.push({
        x: figure.x + Math.sin(figure.rotationY) * forward,
        z: figure.z + Math.cos(figure.rotationY) * forward,
      });
    }
    return points;
  }

  // groundHeight(x, y, z) returns the height of the surface a foot rests on, or null.
  settle(groundHeight) {
    for (const figure of this.figures) {
      if (figure.pose === 'swim') continue;
      const support = groundHeight(figure.x, figure.requestedY, figure.z);
      if (support !== null) figure.y = support;
    }
  }

  build(material) {
    const buckets = { cyl: [], cone: [], taper: [], sph: [], box: [] };
    for (const figure of this.figures) {
      const world = new THREE.Matrix4().compose(
        new THREE.Vector3(figure.x, figure.y, figure.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, figure.rotationY, 0)),
        new THREE.Vector3(1, 1, 1).multiplyScalar(figure.spec.scale * figure.scale * 1.08),
      );
      for (const entry of figureParts(figure.spec, figure.pose)) {
        buckets[entry.shape].push({
          matrix: new THREE.Matrix4().multiplyMatrices(world, entry.matrix),
          color: entry.color,
        });
      }
    }
    const group = new THREE.Group();
    for (const shape of Object.keys(buckets)) {
      const list = buckets[shape];
      if (list.length === 0) continue;
      const mesh = new THREE.InstancedMesh(SHAPE_GEOMETRY[shape](), material, list.length);
      const color = new THREE.Color();
      list.forEach((entry, index) => {
        mesh.setMatrixAt(index, entry.matrix);
        color.set(entry.color);
        mesh.setColorAt(index, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }
}

export function buildFigureGroup(spec, pose, scale = 1, detail = false) {
  const group = new THREE.Group();
  const geometries = {};
  for (const entry of figureParts(spec, pose, detail)) {
    geometries[entry.shape] = geometries[entry.shape] || SHAPE_GEOMETRY[entry.shape]();
    const mesh = new THREE.Mesh(geometries[entry.shape], new THREE.MeshLambertMaterial({ color: entry.color }));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(entry.matrix);
    group.add(mesh);
  }
  group.scale.setScalar(scale * spec.scale);
  return group;
}
