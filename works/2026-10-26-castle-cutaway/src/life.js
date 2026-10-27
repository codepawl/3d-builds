// People, horses, the cart and every scripted action, all as functions of the virtual clock t.
import * as THREE from 'three';
import { makeRandom, smoothstep } from './kit.js';
import { FRONT, GATE_X, LEVEL } from './world.js';

const SKIN = [0xe8b890, 0xd9a07a, 0xc88c64, 0xf0c8a0];
const peopleMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// ---------- colored geometry helpers ----------
function colored(geometry, colorValue, transform) {
  let result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (transform) {
    result.applyMatrix4(transform);
  }
  result.deleteAttribute('uv');
  const color = new THREE.Color(colorValue);
  const count = result.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  result.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return result;
}

function merge(parts) {
  let total = 0;
  for (const part of parts) {
    total += part.attributes.position.count;
  }
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    positions.set(part.attributes.position.array, offset * 3);
    normals.set(part.attributes.normal.array, offset * 3);
    colors.set(part.attributes.color.array, offset * 3);
    offset += part.attributes.position.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const at = (x, y, z, rotationX = 0, rotationZ = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, 0, rotationZ)), new THREE.Vector3(1, 1, 1));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---------- roles ----------
const ROLES = {
  soldier: { tunics: [0xb3262b, 0xa02a30], hose: 0x4a4a52, boots: 0x2b2118, hat: 'helm', hatColor: 0xa4adb6, hair: 0x4a3322 },
  sentry: { tunics: [0x2f4f8f, 0x3a5a9a], hose: 0x4a4a52, boots: 0x2b2118, hat: 'helm', hatColor: 0xa4adb6, hair: 0x3a2a1a, trim: 0xd9b24a },
  archer: { tunics: [0x4f7f3a, 0x5a8a40], hose: 0x6a5436, boots: 0x3a2a1a, hat: 'hood', hatColor: 0x3f6a30, hair: 0x6a4a2a },
  cook: { tunics: [0xf0ebe0], hose: 0x7a6a52, boots: 0x3a2a1a, hat: 'cook', hatColor: 0xffffff, hair: 0x5a3a22, apron: 0xe8e2d0 },
  servant: { tunics: [0xb98a3e, 0xa87a50, 0x7e9a5a], hose: 0x5a4a38, boots: 0x3a2a1a, hat: 'cap', hatColor: 0x7a4a2a, hair: 0x6a4a2a },
  lord: { tunics: [0x24408f], hose: 0x8a2a2a, boots: 0x2a1a10, hat: 'crown', hatColor: 0xe0b440, hair: 0xb0a898, trim: 0xe0b440 },
  lady: { tunics: [0x8a2a4a], hose: 0x8a2a4a, boots: 0x2a1a10, hat: 'hennin', hatColor: 0xdca8bc, hair: 0xd8b070, robe: true, trim: 0xe0b440 },
  priest: { tunics: [0x2e2c32], hose: 0x2e2c32, boots: 0x1a1a1a, hat: 'none', hatColor: 0x000000, hair: 0x887a6a, robe: true, trim: 0xe8e2d0 },
  knight: { tunics: [0xc0272d], hose: 0x8a929c, boots: 0x6a727c, hat: 'plume', hatColor: 0xb0b8c2, hair: 0x4a3322, trim: 0xe0b440, armor: 0xa6afba },
  smith: { tunics: [0x6a4a30], hose: 0x3a3a3a, boots: 0x2a1a10, hat: 'none', hatColor: 0, hair: 0x201810, apron: 0x2e2626 },
  peasant: { tunics: [0x7a8a4a, 0x8a6a4a, 0x6a7a8a], hose: 0x5a4a38, boots: 0x3a2a1a, hat: 'cap', hatColor: 0x8a6a3a, hair: 0x5a3a22 },
  carpenter: { tunics: [0xa88a5a], hose: 0x5a4a38, boots: 0x3a2a1a, hat: 'cap', hatColor: 0x6a5a3a, hair: 0x4a3322, apron: 0x7a6a4a },
  vendor: { tunics: [0x7a4a8a], hose: 0x4a3a30, boots: 0x3a2a1a, hat: 'cap', hatColor: 0xb05a3a, hair: 0x3a2a1a },
  prisoner: { tunics: [0x8a8680], hose: 0x6a6660, boots: 0x4a443a, hat: 'none', hatColor: 0, hair: 0x4a4038 },
  jailer: { tunics: [0x4a3a2a], hose: 0x3a3028, boots: 0x201810, hat: 'helm', hatColor: 0x6a6a6a, hair: 0x2a1a10, trim: 0x8a7a5a },
  groom: { tunics: [0xc9a36a], hose: 0x6a5a40, boots: 0x3a2a1a, hat: 'cap', hatColor: 0x6a5a3a, hair: 0x7a5a30 },
};

const assetCache = new Map();

function personAssets(roleName, variant) {
  const key = `${roleName}:${variant}`;
  if (assetCache.has(key)) {
    return assetCache.get(key);
  }
  const role = ROLES[roleName];
  const tunic = role.tunics[variant % role.tunics.length];
  const skin = SKIN[(variant + roleName.length) % SKIN.length];
  const upperBodyHeight = 0.78;
  const parts = [];
  const lift = -upperBodyHeight;
  if (role.robe) {
    parts.push(colored(new THREE.CylinderGeometry(0.3, 0.55, 1.5, 12), tunic, at(0, 0.75 + lift, 0)));
  } else {
    parts.push(colored(new THREE.CylinderGeometry(0.3, 0.36, 0.8, 10), role.armor && false ? role.armor : tunic, at(0, 1.12 + lift, 0)));
    parts.push(colored(new THREE.CylinderGeometry(0.37, 0.4, 0.3, 10), tunic, at(0, 0.82 + lift, 0)));
  }
  if (role.apron) {
    parts.push(colored(box(0.5, 0.95, 0.07), role.apron, at(0, 0.95 + lift, 0.3)));
  }
  parts.push(colored(new THREE.CylinderGeometry(0.335, 0.345, 0.09, 10), role.trim ?? 0x3a2a1a, at(0, 0.86 + lift, 0)));
  if (role.armor) {
    parts.push(colored(new THREE.CylinderGeometry(0.21, 0.3, 0.3, 10), role.armor, at(0, 1.4 + lift, 0)));
  }
  parts.push(colored(new THREE.SphereGeometry(0.2, 12, 10), skin, at(0, 1.74 + lift, 0)));
  parts.push(colored(box(0.06, 0.07, 0.07), skin, at(0, 1.72 + lift, 0.2)));
  parts.push(colored(box(0.05, 0.05, 0.03), 0x1a1210, at(-0.075, 1.79 + lift, 0.185)));
  parts.push(colored(box(0.05, 0.05, 0.03), 0x1a1210, at(0.075, 1.79 + lift, 0.185)));
  parts.push(colored(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), role.hair, at(0, 1.77 + lift, -0.02, -0.28)));
  for (const side of [-1, 1]) {
    parts.push(colored(new THREE.SphereGeometry(0.115, 8, 6), tunic, at(side * 0.38, 1.45 + lift, 0)));
  }
  const hatColor = role.hatColor;
  if (role.hat === 'helm' || role.hat === 'plume') {
    parts.push(colored(new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hatColor, at(0, 1.78 + lift, 0)));
    parts.push(colored(box(0.05, 0.16, 0.05), hatColor, at(0, 1.74 + lift, 0.235)));
    if (role.hat === 'plume') {
      parts.push(colored(new THREE.ConeGeometry(0.1, 0.5, 6), 0xc0272d, at(0, 2.2 + lift, -0.05, -0.3)));
    }
  } else if (role.hat === 'cook') {
    parts.push(colored(new THREE.CylinderGeometry(0.19, 0.2, 0.3, 10), 0xffffff, at(0, 1.98 + lift, 0)));
    parts.push(colored(new THREE.SphereGeometry(0.26, 10, 8), 0xffffff, at(0, 2.2 + lift, 0)));
  } else if (role.hat === 'cap') {
    parts.push(colored(new THREE.CylinderGeometry(0.22, 0.25, 0.1, 10), hatColor, at(0, 1.92 + lift, 0)));
    parts.push(colored(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatColor, at(0, 1.94 + lift, 0)));
  } else if (role.hat === 'crown') {
    parts.push(colored(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10), hatColor, at(0, 1.97 + lift, 0)));
    for (let tip = 0; tip < 5; tip += 1) {
      const angle = (tip / 5) * Math.PI * 2;
      parts.push(colored(new THREE.ConeGeometry(0.05, 0.12, 4), hatColor, at(Math.cos(angle) * 0.17, 2.08 + lift, Math.sin(angle) * 0.17)));
    }
  } else if (role.hat === 'hennin') {
    parts.push(colored(new THREE.ConeGeometry(0.17, 0.75, 10), hatColor, at(0, 2.2 + lift, -0.04, -0.18)));
    parts.push(colored(box(0.4, 0.4, 0.04), 0xf2ece0, at(0, 2.0 + lift, -0.2)));
  } else if (role.hat === 'hood') {
    parts.push(colored(new THREE.ConeGeometry(0.26, 0.5, 8), hatColor, at(0, 1.97 + lift, -0.02, -0.15)));
  }
  const body = merge(parts);

  const upperArm = merge([
    colored(box(0.14, 0.3, 0.14), tunic, at(0, -0.15, 0)),
    colored(new THREE.SphereGeometry(0.085, 8, 6), tunic, at(0, -0.3, 0)),
  ]);
  const foreArm = merge([
    colored(box(0.125, 0.2, 0.125), role.armor ?? tunic, at(0, -0.1, 0)),
    colored(box(0.1, 0.13, 0.1), skin, at(0, -0.26, 0)),
  ]);
  const thigh = merge([
    colored(box(0.19, 0.4, 0.21), role.hose, at(0, -0.2, 0)),
    colored(new THREE.SphereGeometry(0.1, 8, 6), role.hose, at(0, -0.4, 0)),
  ]);
  const shin = merge([
    colored(box(0.16, 0.3, 0.18), role.hose, at(0, -0.15, 0)),
    colored(box(0.19, 0.12, 0.3), role.boots, at(0, -0.33, 0.05)),
  ]);
  const assets = { body, upperArm, foreArm, thigh, shin };
  assetCache.set(key, assets);
  return assets;
}

// ---------- person ----------
export function createPerson(roleName, variant = 0, scale = 1) {
  const assets = personAssets(roleName, variant);
  const root = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.y = 0.78;
  root.add(upper);
  const mesh = (geometry) => {
    const item = new THREE.Mesh(geometry, peopleMaterial);
    item.castShadow = true;
    return item;
  };
  upper.add(mesh(assets.body));
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 1.45 - 0.78, 0);
    shoulder.add(mesh(assets.upperArm));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.add(mesh(assets.foreArm));
    shoulder.add(elbow);
    upper.add(shoulder);
    return { shoulder, elbow, side };
  });
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.15, 0.78, 0);
    hip.add(mesh(assets.thigh));
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    knee.add(mesh(assets.shin));
    hip.add(knee);
    root.add(hip);
    return { hip, knee, side };
  });
  root.scale.setScalar(scale);
  return { root, upper, arms, legs, base: 0, role: roleName };
}

const POSE_DEFAULT = { lt: 0, ls: 0, rt: 0, rs: 0, la: 0, lf: 0, ra: 0, rf: 0, lean: 0, lift: 0, spread: 0 };
export function applyPose(person, pose) {
  const merged = { ...POSE_DEFAULT, ...pose };
  person.legs[0].hip.rotation.set(merged.lt, 0, -merged.spread);
  person.legs[1].hip.rotation.set(merged.rt, 0, merged.spread);
  person.legs[0].knee.rotation.x = merged.ls;
  person.legs[1].knee.rotation.x = merged.rs;
  person.arms[0].shoulder.rotation.set(merged.la, 0, 0.1);
  person.arms[1].shoulder.rotation.set(merged.ra, 0, -0.1);
  person.arms[0].elbow.rotation.x = merged.lf;
  person.arms[1].elbow.rotation.x = merged.rf;
  person.upper.rotation.x = merged.lean;
  person.root.position.y += merged.lift;
}

export function poseWalk(phase, amount, carrying) {
  const swing = Math.sin(phase) * 0.62 * amount;
  const other = -swing;
  const pose = {
    lt: -swing,
    rt: -other,
    ls: 0.75 * Math.max(0, Math.cos(phase)) * amount + 0.05,
    rs: 0.75 * Math.max(0, -Math.cos(phase)) * amount + 0.05,
    la: swing * 0.8,
    ra: other * 0.8,
    lf: -0.25 - 0.2 * amount,
    rf: -0.25 - 0.2 * amount,
    lean: 0.05 * amount,
    lift: Math.abs(Math.sin(phase)) * 0.05 * amount,
  };
  if (carrying === 'tray') {
    pose.la = -1.15;
    pose.ra = -1.15;
    pose.lf = -0.55;
    pose.rf = -0.55;
  } else if (carrying === 'spear') {
    pose.ra = -0.5;
    pose.rf = -0.9;
  } else if (carrying === 'bucket') {
    pose.ra = -0.2;
    pose.rf = -0.3;
  }
  return pose;
}

export function poseStand(t, seed, restless = 1) {
  const breath = Math.sin(t * 1.6 + seed);
  return { la: 0.04 * breath * restless, ra: -0.04 * breath * restless, lf: -0.2, rf: -0.2, lean: 0.015 * breath * restless, ls: 0.03, rs: 0.03 };
}

export function poseSit(t, seed) {
  const breath = Math.sin(t * 1.4 + seed);
  return { lt: -1.0, rt: -1.0, ls: 1.0, rs: 1.0, la: -0.5, ra: -0.5, lf: -0.7, rf: -0.7, lean: 0.02 * breath, lift: -0.11 };
}

// ---------- paths ----------
export class Path {
  constructor(points, closed = false) {
    this.points = points.map((point) => new THREE.Vector3(...point));
    this.closed = closed;
    if (closed) {
      this.points.push(this.points[0].clone());
    }
    this.cumulative = [0];
    for (let index = 1; index < this.points.length; index += 1) {
      this.cumulative.push(this.cumulative[index - 1] + this.points[index].distanceTo(this.points[index - 1]));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  position(distance, target = new THREE.Vector3()) {
    let along = this.closed ? ((distance % this.length) + this.length) % this.length : Math.min(this.length, Math.max(0, distance));
    let index = 1;
    while (index < this.cumulative.length - 1 && this.cumulative[index] < along) {
      index += 1;
    }
    const span = this.cumulative[index] - this.cumulative[index - 1];
    const fraction = span > 0 ? (along - this.cumulative[index - 1]) / span : 0;
    return target.lerpVectors(this.points[index - 1], this.points[index], fraction);
  }

  distanceOfPoint(index) {
    return this.cumulative[index];
  }

  yawAt(distance) {
    const ahead = this.position(distance + 0.7);
    const behind = this.position(distance - 0.7);
    return Math.atan2(ahead.x - behind.x, ahead.z - behind.z);
  }
}

const lerpAngle = (from, to, amount) => {
  let difference = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (difference < -Math.PI) {
    difference += Math.PI * 2;
  }
  return from + difference * amount;
};

// Back and forth along a path, easing to a stop and turning at each end, in a continuous time function.
function pingPongState(path, averageSpeed, offsetDistance, t) {
  const total = (offsetDistance + averageSpeed * t) / path.length;
  const leg = Math.floor(total);
  const fraction = total - leg;
  const eased = fraction - Math.sin(Math.PI * 2 * fraction) / (Math.PI * 2);
  const forward = leg % 2 === 0;
  const along = (forward ? eased : 1 - eased) * path.length;
  const speedNow = averageSpeed * (1 - Math.cos(Math.PI * 2 * fraction));
  const headingOf = (isForward, distance) => path.yawAt(distance) + (isForward ? 0 : Math.PI);
  let heading = headingOf(forward, along);
  if (fraction < 0.16) {
    heading = lerpAngle(headingOf(!forward, forward ? 0 : path.length), headingOf(forward, along), smoothstep(0, 0.16, fraction));
  } else if (fraction > 0.84) {
    heading = lerpAngle(headingOf(forward, along), headingOf(!forward, forward ? path.length : 0), smoothstep(0.84, 1, fraction));
  }
  return { along, heading, speedNow, travelled: (leg + eased) * path.length };
}

// ---------- horse ----------
const COATS = { bay: [0x7a4a2a, 0x2a1a10], white: [0xe6e2d6, 0xb8b2a2], black: [0x2c2624, 0x141010], chestnut: [0xa05a28, 0x3a2010] };

function horseAssets(coatName) {
  const [coat, dark] = COATS[coatName];
  const body = merge([
    colored(new THREE.SphereGeometry(1, 14, 10), coat, new THREE.Matrix4().compose(new THREE.Vector3(0, 1.5, 0), new THREE.Quaternion(), new THREE.Vector3(0.52, 0.6, 1.25))),
    colored(box(0.34, 1.0, 0.42), coat, at(0, 2.05, 1.0, -0.5)),
    colored(box(0.27, 0.3, 0.8), coat, at(0, 2.58, 1.5, 0.7)),
    colored(box(0.22, 0.22, 0.2), dark, at(0, 2.35, 1.82, 0.7)),
    colored(box(0.08, 0.7, 0.12), dark, at(0, 2.22, 0.78, -0.5)),
    colored(new THREE.ConeGeometry(0.06, 0.22, 4), coat, at(-0.1, 2.88, 1.2)),
    colored(new THREE.ConeGeometry(0.06, 0.22, 4), coat, at(0.1, 2.88, 1.2)),
    colored(box(0.06, 0.07, 0.04), 0x101010, at(0.14, 2.65, 1.62)),
    colored(box(0.06, 0.07, 0.04), 0x101010, at(-0.14, 2.65, 1.62)),
  ]);
  const upperLeg = merge([colored(box(0.2, 0.62, 0.24), coat, at(0, -0.31, 0))]);
  const lowerLeg = merge([colored(box(0.13, 0.52, 0.15), coat, at(0, -0.26, 0)), colored(box(0.17, 0.12, 0.2), dark, at(0, -0.55, 0.01))]);
  const tail = merge([colored(new THREE.ConeGeometry(0.1, 1.0, 6), dark, at(0, -0.5, 0))]);
  return { body, upperLeg, lowerLeg, tail };
}

const horseCache = new Map();
export function createHorse(coatName) {
  if (!horseCache.has(coatName)) {
    horseCache.set(coatName, horseAssets(coatName));
  }
  const assets = horseCache.get(coatName);
  const root = new THREE.Group();
  const mesh = (geometry) => {
    const item = new THREE.Mesh(geometry, peopleMaterial);
    item.castShadow = true;
    return item;
  };
  const bodyGroup = new THREE.Group();
  bodyGroup.add(mesh(assets.body));
  root.add(bodyGroup);
  const legs = [[-0.28, 0.85], [0.28, 0.85], [-0.28, -0.8], [0.28, -0.8]].map(([x, z]) => {
    const hip = new THREE.Group();
    hip.position.set(x, 1.2, z);
    hip.add(mesh(assets.upperLeg));
    const knee = new THREE.Group();
    knee.position.y = -0.62;
    knee.add(mesh(assets.lowerLeg));
    hip.add(knee);
    root.add(hip);
    return { hip, knee };
  });
  const tail = new THREE.Group();
  tail.position.set(0, 1.9, -1.2);
  tail.add(mesh(assets.tail));
  root.add(tail);
  return { root, bodyGroup, legs, tail };
}

// cycle fraction offsets: left hind, left fore, right hind, right fore (four-beat walk)
const HORSE_GAIT = [0.0, 0.25, 0.5, 0.75];
const HORSE_LEG_ORDER = [2, 0, 3, 1]; // legs array index for each gait slot: LH, LF, RH, RF

export function poseHorse(horse, cycle, amount, t) {
  horse.legs.forEach((leg, index) => {
    const slot = HORSE_LEG_ORDER.indexOf(index);
    const phase = (cycle + HORSE_GAIT[slot]) * Math.PI * 2;
    leg.hip.rotation.x = Math.sin(phase) * 0.5 * amount;
    leg.knee.rotation.x = Math.max(0, -Math.cos(phase)) * 0.95 * amount + 0.05;
  });
  horse.bodyGroup.position.y = Math.abs(Math.sin(cycle * Math.PI * 4)) * 0.03 * amount;
  horse.bodyGroup.rotation.x = Math.sin(cycle * Math.PI * 2) * 0.012 * amount;
  horse.tail.rotation.x = 0.35 + Math.sin(t * 2.2 + cycle) * 0.12;
}

// ---------- props ----------
function prop(geometry, color, transform) {
  const mesh = new THREE.Mesh(colored(geometry, color, transform), peopleMaterial);
  mesh.castShadow = true;
  return mesh;
}

// =========================================================
export function buildLife(scene) {
  const random = makeRandom(2024);
  const actors = [];
  const counters = [];

  function addPerson(roleName, variant, scale = 1) {
    const person = createPerson(roleName, variant, scale);
    scene.add(person.root);
    return person;
  }

  function stander(roleName, variant, position, yaw, mode = 'stand', options = {}) {
    const person = addPerson(roleName, variant, options.scale ?? 1);
    const seed = random() * 10;
    person.root.rotation.y = yaw;
    if (options.prop === 'spear') {
      const spear = new THREE.Group();
      spear.add(prop(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 5), 0x6a4a2a, at(0, 1.5, 0)));
      spear.add(prop(new THREE.ConeGeometry(0.07, 0.3, 5), 0xc8ced4, at(0, 3.1, 0)));
      spear.position.set(0.38, 0, 0.45);
      person.root.add(spear);
    }
    actors.push({
      update(t) {
        person.root.position.set(position[0], position[1], position[2]);
        const pulse = options.pulses ? pulseArm(t, options.pulses) : null;
        let pose;
        if (mode === 'sit') {
          pose = poseSit(t, seed);
          if (options.eat) {
            const bite = Math.max(0, Math.sin(t * 0.9 + seed * 3)) ** 6;
            pose.rf = -0.7 - 1.3 * bite;
            pose.ra = -0.5 - 0.6 * bite;
          }
          if (options.talk) {
            pose.la = -0.5 + 0.3 * Math.sin(t * 2.1 + seed);
          }
        } else if (mode === 'kneel') {
          pose = { lt: -0.1, rt: -0.1, ls: 1.5, rs: 1.5, la: -0.8, ra: -0.8, lf: -1.6, rf: -1.6, lean: 0.12 + 0.02 * Math.sin(t + seed), lift: -0.4 };
        } else if (mode === 'hammer') {
          const cycle = t * options.rate + options.phase;
          const unit = cycle - Math.floor(cycle);
          const raise = unit < 0.7 ? easeInOut(unit / 0.7) : 1 - ((unit - 0.7) / 0.3) ** 0.6;
          pose = poseStand(t, seed, 0.2);
          pose.ra = -0.4 - 1.9 * raise;
          pose.rf = -0.6 - 0.5 * raise;
          pose.la = -0.9;
          pose.lf = -0.9;
          pose.lean = 0.12 + 0.06 * (1 - raise);
          counters.push();
        } else if (mode === 'stir') {
          pose = poseStand(t, seed, 0.2);
          pose.ra = -1.0 + 0.2 * Math.sin(t * 3.4 + seed);
          pose.rf = -0.9 + 0.35 * Math.cos(t * 3.4 + seed);
          pose.la = -0.4;
          pose.lf = -0.6;
          pose.lean = 0.14;
        } else if (mode === 'chop') {
          const cycle = t * options.rate + options.phase;
          const unit = cycle - Math.floor(cycle);
          const raise = unit < 0.6 ? easeInOut(unit / 0.6) : 1 - ((unit - 0.6) / 0.4) ** 0.5;
          pose = poseStand(t, seed, 0.2);
          pose.ra = -0.9 - 0.7 * raise;
          pose.rf = -0.5 - 0.7 * raise;
          pose.la = -0.9;
          pose.lf = -0.7;
          pose.lean = 0.18;
        } else if (mode === 'saw') {
          pose = poseStand(t, seed, 0.2);
          pose.ra = -0.9 + 0.35 * Math.sin(t * 4.2);
          pose.rf = -0.6 - 0.35 * Math.sin(t * 4.2);
          pose.la = -0.7;
          pose.lf = -0.5;
          pose.lean = 0.28;
        } else if (mode === 'bars') {
          pose = poseStand(t, seed, 0.2);
          pose.la = -2.5;
          pose.ra = -2.5;
          pose.lf = -0.2;
          pose.rf = -0.2;
          pose.lean = 0.1;
        } else if (mode === 'preach') {
          pose = poseStand(t, seed, 0.4);
          pose.la = -1.1 + 0.15 * Math.sin(t * 1.3);
          pose.ra = -1.1 + 0.15 * Math.sin(t * 1.3 + 1);
          pose.lf = -0.5;
          pose.rf = -0.5;
        } else {
          pose = poseStand(t, seed);
          if (options.look) {
            pose.ra = -0.7 + 0.2 * Math.sin(t * 1.1 + seed);
            pose.rf = -0.9;
          }
        }
        if (pulse) {
          pose.ra = pulse.arm;
          pose.rf = pulse.fore;
          pose.lean = 0.2;
        }
        person.root.position.y = position[1];
        applyPose(person, pose);
        if (options.sway) {
          person.root.rotation.y = yaw + 0.06 * Math.sin(t * 0.7 + seed);
        }
      },
    });
    if (mode === 'hammer' || mode === 'chop') {
      counters.push({ kind: mode === 'hammer' ? 'hammer' : 'chop', fn: (t) => t * options.rate + options.phase, position: new THREE.Vector3(position[0] + (options.strikeOffset?.[0] ?? 0), position[1] + 1.0, position[2] + (options.strikeOffset?.[1] ?? 0)) });
    }
    if (options.pulses) {
      for (const time of options.pulses) {
        counters.push({ kind: 'clatter', single: time, position: new THREE.Vector3(position[0], position[1] + 1.1, position[2] + 0.7) });
      }
    }
    return person;
  }

  // an arm that raises and then comes down on a pot or board exactly at each pulse time
  function pulseArm(t, times) {
    for (const time of times) {
      const until = time - t;
      if (until > -0.25 && until < 0.7) {
        const lift = until > 0 ? easeInOut(1 - until / 0.7) : 1 - easeInOut(Math.min(1, -until / 0.25));
        const strike = until > 0 ? 0 : 1;
        return { arm: -0.9 - 1.0 * lift * (strike ? 0.2 : 1), fore: -0.6 - 0.8 * lift };
      }
    }
    return null;
  }

  function walker(roleName, variant, pathPoints, options) {
    const path = new Path(pathPoints, options.closed ?? false);
    const person = addPerson(roleName, variant, options.scale ?? 1);
    const seed = random() * 10;
    if (options.prop === 'spear') {
      const spear = new THREE.Group();
      spear.add(prop(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 5), 0x6a4a2a, at(0, 1.5, 0)));
      spear.add(prop(new THREE.ConeGeometry(0.07, 0.3, 5), 0xc8ced4, at(0, 3.1, 0)));
      spear.position.set(0.38, 0, 0.45);
      person.root.add(spear);
    } else if (options.prop === 'tray') {
      const tray = new THREE.Group();
      tray.add(prop(box(0.8, 0.06, 0.5), 0x8a6a3a, at(0, 0, 0)));
      tray.add(prop(new THREE.CylinderGeometry(0.16, 0.14, 0.06, 8), 0xd8d4c8, at(-0.2, 0.06, 0)));
      tray.add(prop(new THREE.SphereGeometry(0.13, 8, 6), 0xc87a3c, at(0.15, 0.12, 0.05)));
      tray.add(prop(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 8), 0xe0b440, at(0.28, 0.13, -0.1)));
      tray.position.set(0, 1.28, 0.62);
      person.root.add(tray);
    } else if (options.prop === 'sack') {
      person.root.add(Object.assign(prop(new THREE.SphereGeometry(0.4, 8, 6), 0xcdb88a, new THREE.Matrix4().compose(new THREE.Vector3(0.0, 1.9, -0.1), new THREE.Quaternion(), new THREE.Vector3(1.0, 0.8, 0.8))), {}));
    } else if (options.prop === 'bucket') {
      const bucket = prop(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), 0x7a5a30, at(0.5, 0.45, 0.2));
      person.root.add(bucket);
    } else if (options.prop === 'plank') {
      person.root.add(prop(box(0.2, 0.1, 3.4), 0x9a7a4a, at(-0.2, 1.75, 0.2)));
    }
    const carrying = options.prop === 'tray' ? 'tray' : options.prop === 'spear' ? 'spear' : options.prop === 'bucket' ? 'bucket' : null;
    const scratch = new THREE.Vector3();
    actors.push({
      update(t) {
        let heading;
        let amount;
        let travelled;
        if (options.closed) {
          travelled = options.offset + options.speed * t;
          path.position(travelled, scratch);
          heading = path.yawAt(travelled);
          amount = 1;
        } else {
          const state = pingPongState(path, options.speed, options.offset ?? 0, t);
          path.position(state.along, scratch);
          heading = state.heading;
          amount = Math.min(1.1, state.speedNow / 1.5);
          travelled = state.travelled;
        }
        person.root.position.copy(scratch);
        person.root.rotation.y = heading;
        const idle = poseStand(t, seed, 1);
        const walking = poseWalk((travelled / 1.8) * Math.PI * 2, Math.min(1, amount), carrying);
        const blend = smoothstep(0.05, 0.5, amount);
        const pose = {};
        for (const key of Object.keys(walking)) {
          pose[key] = (idle[key] ?? 0) * (1 - blend) + walking[key] * blend;
        }
        if (carrying === 'tray') {
          pose.la = -1.15;
          pose.ra = -1.15;
          pose.lf = -0.55;
          pose.rf = -0.55;
        }
        const baseY = person.root.position.y;
        applyPose(person, pose);
        person.root.position.y = baseY + (pose.lift ?? 0);
      },
    });
    return person;
  }

  // ---------- the rider and his horse ----------
  const riderPoints = [
    [-48, 0, 32], [-38, 0, 29], [-29, 0, 25.5], [-22.6, 0, 22.4], [GATE_X, 0.46, 21.0], [GATE_X, 0.46, 12.4], [GATE_X, 0, 10.2],
    [GATE_X, 0, 3], [GATE_X, 0, -2], [-20, 0, -7], [-18.4, 0, -12], [-17.6, 0, -16.4],
  ];
  const riderPath = new Path(riderPoints);
  const riderSpeed = 4.6;
  const riderCycleLength = 4.6;
  const riderBridgeStartTime = 5.35;
  const riderStartDistance = riderPath.distanceOfPoint(4) - riderSpeed * riderBridgeStartTime;
  function riderDistance(t) {
    const raw = riderStartDistance + riderSpeed * t;
    const slowStart = riderPath.length - 3;
    if (raw <= slowStart) {
      return raw;
    }
    const over = Math.min(6, raw - slowStart);
    return Math.min(riderPath.length, slowStart + over - (over * over) / 12);
  }
  function riderSpeedAt(t) {
    const raw = riderStartDistance + riderSpeed * t;
    const slowStart = riderPath.length - 3;
    if (raw <= slowStart) {
      return riderSpeed;
    }
    return riderSpeed * Math.max(0, 1 - (raw - slowStart) / 6);
  }
  const riderHorse = createHorse('white');
  scene.add(riderHorse.root);
  const knight = addPerson('knight', 0, 1.0);
  riderHorse.root.add(knight.root);
  knight.root.position.set(0, 1.25, 0.05);
  const lance = new THREE.Group();
  lance.add(prop(new THREE.CylinderGeometry(0.035, 0.045, 4.2, 5), 0x7a5a30, at(0, 0, 0, Math.PI / 2 - 0.05)));
  const pennant = prop(new THREE.ConeGeometry(0.25, 0.9, 3), 0xc0272d, at(0, 0.0, 2.4, Math.PI / 2));
  lance.add(pennant);
  lance.position.set(0.55, 0.9, 0.5);
  knight.root.add(lance);
  const riderScratch = new THREE.Vector3();
  const riderState = { position: new THREE.Vector3(), yaw: 0 };
  actors.push({
    update(t) {
      const distance = riderDistance(t);
      riderPath.position(distance, riderScratch);
      const yaw = riderPath.yawAt(distance);
      riderHorse.root.position.copy(riderScratch);
      riderHorse.root.rotation.y = yaw;
      riderState.position.copy(riderScratch);
      riderState.yaw = yaw;
      const moving = riderSpeedAt(t) / riderSpeed;
      poseHorse(riderHorse, distance / riderCycleLength, Math.min(1, moving * 1.0), t);
      applyPose(knight, {
        lt: -0.55, rt: -0.55, ls: 0.9, rs: 0.9, spread: 0.7, la: -0.7, ra: -0.5, lf: -0.6, rf: -0.9, lean: 0.02 + 0.02 * Math.sin(distance * 2.1),
      });
      knight.root.position.y = 1.25;
      lance.rotation.x = 0.03 * Math.sin(distance * 1.7);
    },
  });
  const surfaceOf = (position) => {
    if (Math.abs(position.x - GATE_X) < 2.4 && position.z > 12.3 && position.z < 21.4) {
      return 'bridge';
    }
    if (Math.abs(position.x - GATE_X) < 2.6 && position.z > 2 && position.z <= 12.3) {
      return 'stone';
    }
    return 'dirt';
  };
  HORSE_GAIT.forEach((offset, slot) => {
    counters.push({
      kind: 'hoof',
      fn: (t) => riderDistance(t) / riderCycleLength + offset + 0.25 + (riderSpeedAt(t) > 0.05 ? 0 : -1000),
      positionAt: (t) => {
        const target = new THREE.Vector3();
        riderPath.position(riderDistance(t), target);
        return target;
      },
      surfaceAt: (t) => surfaceOf(riderPath.position(riderDistance(t))),
      stride: 1.0,
    });
  });

  // ---------- the cart ----------
  const cartPath = new Path([[0.5, 0, -2.2], [-34, 0, -2.2]]);
  const cartSpeed = 1.3;
  const cartLead = 4.8;
  const cartHorse = createHorse('bay');
  scene.add(cartHorse.root);
  const cart = new THREE.Group();
  cart.add(prop(box(1.7, 0.2, 2.8), 0x7a5230, at(0, 1.05, 0)));
  for (const side of [-0.85, 0.85]) {
    cart.add(prop(box(0.1, 0.6, 2.8), 0x6a4528, at(side, 1.4, 0)));
  }
  cart.add(prop(box(1.7, 0.6, 0.1), 0x6a4528, at(0, 1.4, -1.4)));
  cart.add(prop(new THREE.SphereGeometry(1.0, 8, 6), 0xd0aa4a, new THREE.Matrix4().compose(new THREE.Vector3(0, 1.45, -0.1), new THREE.Quaternion(), new THREE.Vector3(0.85, 0.55, 1.3))));
  for (const side of [-1, 1]) {
    cart.add(prop(box(0.1, 0.1, 3.2), 0x5a3a20, at(side * 0.55, 1.0, 2.6)));
  }
  const cartWheels = [-0.98, 0.98].map((x) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.7, 0);
    wheel.add(prop(new THREE.TorusGeometry(0.66, 0.07, 6, 16), 0x4a3a2a, new THREE.Matrix4().makeRotationY(Math.PI / 2)));
    for (let spoke = 0; spoke < 4; spoke += 1) {
      wheel.add(prop(box(0.08, 1.3, 0.08), 0x6a4a2a, new THREE.Matrix4().makeRotationX((spoke * Math.PI) / 4)));
    }
    cart.add(wheel);
    return wheel;
  });
  scene.add(cart);
  const driver = addPerson('peasant', 1, 1);
  cart.add(driver.root);
  driver.root.position.set(0, 1.05, 1.0);
  const cartScratch = new THREE.Vector3();
  const cartHorseScratch = new THREE.Vector3();
  const cartDistanceAt = (t) => 0.4 + cartSpeed * t;
  actors.push({
    update(t) {
      const distance = cartDistanceAt(t);
      cartPath.position(distance, cartScratch);
      cart.position.copy(cartScratch);
      cart.rotation.y = -Math.PI / 2;
      cart.position.y = 0.03 * Math.sin(distance * 7);
      cartPath.position(distance + cartLead, cartHorseScratch);
      cartHorse.root.position.copy(cartHorseScratch);
      cartHorse.root.rotation.y = -Math.PI / 2;
      poseHorse(cartHorse, distance / 2.6, 1, t);
      for (const wheel of cartWheels) {
        wheel.rotation.x = -distance / 0.66;
      }
      driver.root.position.y = 1.05;
      applyPose(driver, poseSit(t, 3));
    },
  });
  HORSE_GAIT.forEach((offset) => {
    counters.push({
      kind: 'hoof',
      fn: (t) => cartDistanceAt(t) / 2.6 + offset + 0.25,
      positionAt: (t) => cartPath.position(cartDistanceAt(t) + cartLead),
      surfaceAt: () => 'dirt',
      quiet: 0.45,
    });
  });

  // ---------- stable horses ----------
  [['chestnut', -27.4], ['black', -23.4], ['bay', -19.4]].forEach(([coat, x], index) => {
    const horse = createHorse(coat);
    horse.root.position.set(x, 0, -22.4);
    horse.root.rotation.y = 0;
    scene.add(horse.root);
    actors.push({
      update(t) {
        poseHorse(horse, 0, 0, t);
        horse.tail.rotation.x = 0.35 + 0.15 * Math.sin(t * 1.7 + index * 2);
        horse.root.rotation.y = 0.05 * Math.sin(t * 0.5 + index);
        horse.legs[index % 4].hip.rotation.x = 0.2 * Math.max(0, Math.sin(t * 0.8 + index * 2.1));
        horse.bodyGroup.rotation.x = 0.012 * Math.sin(t * 1.3 + index);
      },
    });
  });

  // ---------- people on the walls and towers ----------
  walker('sentry', 0, [[-29.2, 9, -26.5], [21.2, 9, -26.5]], { speed: 1.5, offset: 14, prop: 'spear' });
  walker('soldier', 1, [[-29.2, 9, -26.5], [21.2, 9, -26.5]], { speed: 1.7, offset: 62, prop: 'spear' });
  walker('sentry', 1, [[-34.4, 9, -21], [-34.4, 9, -15.2]], { speed: 1.0, offset: 3, prop: 'spear' });
  walker('soldier', 0, [[-34.4, 9, -4.4], [-34.4, 9, 4.6]], { speed: 1.2, offset: 6, prop: 'spear' });
  walker('sentry', 0, [[26.6, 9, -21.5], [26.6, 9, -9]], { speed: 1.3, offset: 5, prop: 'spear' });
  walker('soldier', 1, [[-11, 6.5, 10.4], [2, 6.5, 10.4]], { speed: 1.4, offset: 8, prop: 'spear' });
  walker('sentry', 1, [[-26.5, 11.8, 10.2], [-17.5, 11.8, 10.2]], { speed: 1.0, offset: 4, prop: 'spear' });
  walker('soldier', 0, [[-26.5, 11.8, 10.2], [-17.5, 11.8, 10.2]], { speed: 1.0, offset: 14, prop: 'spear' });
  walker('soldier', 0, [[8, 26, 10.6], [24, 26, 10.6]], { speed: 1.5, offset: 5, prop: 'spear' });
  stander('archer', 0, [25, 14.65, -25], 0.5, 'stand', { sway: true });
  stander('archer', 1, [29, 14.65, -29], 2.4, 'stand', { sway: true });
  stander('archer', 1, [-33.3, 12.15, 12.3], 0.6, 'stand', { sway: true });
  stander('archer', 0, [-36.4, 12.15, 9.0], 2.4, 'stand', { sway: true });

  // ---------- gate and bailey ----------
  stander('soldier', 0, [-25.9, 0, 0.6], 0.3, 'stand', { prop: 'spear' });
  stander('sentry', 1, [-18.1, 0, 0.6], -0.3, 'stand', { prop: 'spear' });
  const wellCenter = [-14, -8];
  walker('soldier', 1, Array.from({ length: 12 }, (_, index) => [wellCenter[0] + Math.cos((index / 12) * Math.PI * 2) * 5.2, 0, wellCenter[1] + Math.sin((index / 12) * Math.PI * 2) * 4.6]), { closed: true, speed: 1.5, offset: 3, prop: 'spear' });
  walker('peasant', 0, [[-12, 0, -9.6], [-5.5, 0, -6.5], [-0.5, 0, -4.8]], { speed: 1.5, offset: 0, prop: 'bucket' });
  walker('groom', 0, [[-27, 0, -18.4], [-20.5, 0, -18.4]], { speed: 1.0, offset: 2 });
  walker('servant', 1, [[-9, 0, -18.6], [3, 0, -18.6]], { speed: 1.4, offset: 9, prop: 'plank' });
  walker('peasant', 1, [[-6.5, 0, -7.0], [-1.2, 0, -8.4]], { speed: 1.0, offset: 2 });
  walker('servant', 0, [[-25, 0, 2], [-25, 0, -11]], { speed: 1.5, offset: 2 });
  stander('peasant', 2, [-19.5, 0, -5.4], 0.9, 'stand', { look: true });
  stander('servant', 2, [-18.4, 0, -4.7], -2.2, 'stand', { look: true });
  stander('vendor', 0, [-0.5, 0, -12.7], 0.0, 'stand', { look: true, sway: true });
  stander('smith', 0, [-28.7, 0, -10.4], -Math.PI / 2, 'hammer', { rate: 1.1, phase: 0.2, strikeOffset: [-1.6, 0] });
  stander('groom', 0, [-29.0, 0, -7.2], -1.2, 'stand', {});
  stander('carpenter', 0, [-4.5, 0, -21.9], Math.PI, 'saw', {});
  stander('peasant', 0, [1.2, 0, -21.0], 2.6, 'stand', { look: true });

  // ---------- the keep, floor by floor ----------
  // dungeon
  stander('jailer', 0, [10.5, LEVEL.dungeon, 6.4], Math.PI, 'sit', { talk: true });
  walker('jailer', 0, [[8, LEVEL.dungeon, 9.2], [17, LEVEL.dungeon, 9.2]], { speed: 1.0, offset: 2 });
  stander('prisoner', 0, [22.3, LEVEL.dungeon, 1.4], 0.2, 'sit', {});
  stander('prisoner', 0, [24.6, LEVEL.dungeon, 6.2], 0.0, 'bars', {});
  // food storage
  stander('servant', 2, [16.4, LEVEL.storage, -0.2], Math.PI, 'stand', { look: true });
  walker('servant', 0, [[8, LEVEL.storage, 10.2], [23, LEVEL.storage, 10.2]], { speed: 1.4, offset: 5, prop: 'sack' });
  walker('servant', 1, [[9, LEVEL.storage, 9.2], [21, LEVEL.storage, 9.2]], { speed: 1.2, offset: 21, prop: 'sack' });
  // kitchen
  stander('cook', 0, [12.2, LEVEL.kitchen, 1.4], Math.PI, 'stir', {});
  stander('cook', 0, [19.4, LEVEL.kitchen, 6.1], Math.PI, 'chop', { rate: 2.3, phase: 0.1, strikeOffset: [0, -0.8] });
  const potTimes = [];
  for (let time = 1.1; time < 20; time += 2.1 + random() * 1.7) {
    potTimes.push(Math.round(time * 30) / 30);
  }
  stander('cook', 0, [10.5, LEVEL.kitchen, 8.7], Math.PI, 'stand', { pulses: potTimes });
  stander('cook', 0, [15.5, LEVEL.kitchen, 4.4], 0.5, 'stand', { look: true });
  // chapel
  stander('priest', 0, [16, LEVEL.chapel, 1.0], 0, 'preach', {});
  [[10.8, 3.95], [12.6, 3.95], [20, 5.95], [21.4, 5.95], [19.2, 3.95]].forEach(([x, z], index) => {
    stander(index % 2 ? 'servant' : 'peasant', index, [x, LEVEL.chapel, z], Math.PI, 'sit', {});
  });
  stander('lady', 0, [15.2, LEVEL.chapel, 8.4], Math.PI, 'kneel', {});
  stander('peasant', 2, [16.8, LEVEL.chapel, 8.4], Math.PI, 'kneel', {});
  // great hall: seated on both benches
  for (let seat = 0; seat < 6; seat += 1) {
    const x = 11.4 + seat * 2.1;
    stander(seat % 2 ? 'soldier' : 'servant', seat, [x, LEVEL.hall, 3.25], 0, 'sit', { eat: seat % 3 !== 1, talk: seat % 3 === 1 });
    stander(seat % 3 ? 'peasant' : 'soldier', seat + 1, [x + 0.6, LEVEL.hall, 6.65], Math.PI, 'sit', { eat: seat % 2 === 0, talk: seat % 2 === 1 });
  }
  walker('servant', 2, [[11, LEVEL.hall, 9.8], [22, LEVEL.hall, 9.8]], { speed: 1.1, offset: 3, prop: 'tray' });
  // the long walk between kitchen and hall by the stairs
  const stairPath = [
    [14, LEVEL.kitchen, 9.8], [22, LEVEL.kitchen, 10.6], [25, LEVEL.kitchen, 11.0], [25, LEVEL.chapel, -1.4], [23, LEVEL.chapel, 1.5], [23, LEVEL.chapel, 10.4],
    [7.2, LEVEL.chapel, 10.4], [7.2, LEVEL.chapel, 11.0], [7.2, LEVEL.hall, -1.4], [9.4, LEVEL.hall, -0.6], [9.4, LEVEL.hall, 9.2], [16, LEVEL.hall, 9.6],
  ];
  walker('cook', 0, stairPath, { speed: 2.2, offset: 2, prop: 'tray' });
  walker('servant', 1, stairPath, { speed: 2.2, offset: 30, prop: 'tray' });
  walker('cook', 0, stairPath, { speed: 2.2, offset: 66, prop: 'tray' });
  // lord's chambers
  stander('lord', 0, [8.7, LEVEL.lord, 2.9], Math.PI, 'sit', { look: true });
  walker('lady', 0, [[11, LEVEL.lord, 6.8], [17, LEVEL.lord, 6.8]], { speed: 0.8, offset: 1 });
  stander('servant', 0, [21, LEVEL.lord, 5.6], 3.0, 'stand', { look: true });

  // ---------- event extraction: scan counters, never guess ----------
  function eventList(duration) {
    const events = [];
    const step = 1 / 240;
    for (const counter of counters) {
      if (counter.single !== undefined) {
        events.push({ t: counter.single, kind: counter.kind, position: counter.position, surface: 'metal', gain: 1 });
        continue;
      }
      let previous = Math.floor(counter.fn(0));
      for (let time = step; time <= duration + 0.5; time += step) {
        const value = counter.fn(time);
        const current = Math.floor(value);
        if (current > previous) {
          const fractionPast = (value - current) / Math.max(1e-6, value - counter.fn(time - step));
          const eventTime = time - fractionPast * step;
          const position = counter.positionAt ? counter.positionAt(eventTime) : counter.position;
          events.push({ t: eventTime, kind: counter.kind, position: position.clone(), surface: counter.surfaceAt ? counter.surfaceAt(eventTime) : 'metal', gain: counter.quiet ?? 1 });
        }
        previous = current;
      }
    }
    events.sort((first, second) => first.t - second.t);
    return events;
  }

  function update(t) {
    for (const actor of actors) {
      actor.update(t);
    }
  }

  return { update, eventList, rider: riderState, riderPath, riderDistance, riderSpeedAt, cartDistanceAt, cartPath, cartLead };
}

function easeInOut(value) {
  const x = Math.min(1, Math.max(0, value));
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}
