// What is left of a swallowed creature: lumps of meat, a rib cage, bones and a skull. The pieces tumble a little, then the
// worms swarm onto each one; a piece shrinks while heads are on it and, once gone, pays out worms (its share of the food).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeToonMaterial } from './look.js';
import { clamp } from './random.js';

const CAPACITY = 160;
const GRAVITY = 14;
const REACH = 1.15; // metres from a head to a piece for it to count as biting

// Worms a whole creature is worth, before the film's growth key.
export const FOOD = { chicken: 5, rabbit: 5, pig: 12, deer: 16, cow: 20, villager: 18, fox: 22 };
const PIECES = {
  chicken: ['meat', 'meat', 'bone'],
  rabbit: ['meat', 'meat', 'bone'],
  pig: ['meat', 'meat', 'meat', 'rib', 'bone', 'skull'],
  deer: ['meat', 'meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  cow: ['meat', 'meat', 'meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  villager: ['meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  fox: ['meat', 'meat', 'meat', 'rib', 'bone', 'skull'],
};
const MEAT_COLORS = [0x8c2f33, 0x74242b, 0x9a3a38];
const BONE_COLOR = 0xeee6d0;

function paint(geometry, red, green, blue) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) colors.set([red, green, blue], index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Non-indexed copies so every part has the same attributes and can be merged.
const plain = (geometry) => (geometry.index ? geometry.toNonIndexed() : geometry);

function buildGeometries() {
  const meat = paint(plain(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.7, 0.85)), 1, 1, 1);
  const shaft = paint(plain(new THREE.BoxGeometry(0.2, 0.2, 1)), 1, 1, 1);
  const knob = (z) => paint(plain(new THREE.BoxGeometry(0.34, 0.3, 0.2).translate(0, 0, z)), 1, 1, 1);
  const bone = mergeGeometries([shaft, knob(0.5), knob(-0.5)]);
  const rib = (z) => paint(plain(new THREE.TorusGeometry(0.5, 0.07, 4, 6, Math.PI).rotateX(Math.PI / 2).translate(0, 0, z)), 1, 1, 1);
  const spine = paint(plain(new THREE.BoxGeometry(0.1, 0.1, 1.1)), 1, 1, 1);
  const ribCage = mergeGeometries([rib(-0.45), rib(-0.15), rib(0.15), rib(0.45), spine]);
  const cranium = paint(plain(new THREE.BoxGeometry(0.8, 0.7, 0.9)), 1, 1, 1);
  const jaw = paint(plain(new THREE.BoxGeometry(0.55, 0.2, 0.5).translate(0, -0.42, 0.25)), 1, 1, 1);
  const socket = (x) => paint(plain(new THREE.BoxGeometry(0.2, 0.2, 0.1).translate(x, 0.05, 0.46)), 0.12, 0.1, 0.1);
  const skull = mergeGeometries([cranium, jaw, socket(-0.2), socket(0.2)]);
  return { meat, bone, rib: ribCage, skull };
}

export class Chunks {
  constructor(heightfields, random) {
    this.heightfields = heightfields;
    this.random = random;
    this.list = [];
    this.group = new THREE.Group();
    this.meshes = {};
    for (const [name, geometry] of Object.entries(buildGeometries())) {
      const mesh = new THREE.InstancedMesh(geometry, makeToonMaterial({ vertexColors: true }), CAPACITY);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.meshes[name] = mesh;
      this.group.add(mesh);
    }
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.eatenEvents = [];
  }

  // Break a creature apart where it stood.
  burst(creature, kindName, kindHeight) {
    const random = this.random;
    const pieces = PIECES[kindName];
    const share = FOOD[kindName] / pieces.length;
    const size = kindHeight * 0.17;
    for (const piece of pieces) {
      const angle = random.range(0, Math.PI * 2);
      const outward = random.range(1.2, 3.2);
      this.list.push({
        piece,
        kindName,
        x: creature.x,
        y: this.heightfields.groundHeight(creature.x, creature.z) + kindHeight * 0.55,
        z: creature.z,
        vx: Math.cos(angle) * outward,
        vy: random.range(2.5, 5),
        vz: Math.sin(angle) * outward,
        yaw: random.range(0, Math.PI * 2),
        pitch: random.range(0, Math.PI * 2),
        spinYaw: random.range(-6, 6),
        spinPitch: random.range(-8, 8),
        size: piece === 'meat' ? size * random.range(0.8, 1.2) : size * (piece === 'skull' ? 0.9 : 1.4),
        food: share,
        health: 1,
        age: 0,
        tint: random.int(MEAT_COLORS.length),
        settled: false,
      });
    }
  }

  // Nearest pieces to a point, for the swarm to aim at.
  near(x, z, radius, limit) {
    return this.list
      .filter((chunk) => Math.hypot(chunk.x - x, chunk.z - z) < radius)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
      .slice(0, limit);
  }

  step(dt, swarm) {
    this.eatenEvents.length = 0;
    for (const chunk of this.list) {
      chunk.age += dt;
      if (!chunk.settled) {
        chunk.vy -= GRAVITY * dt;
        chunk.x += chunk.vx * dt;
        chunk.y += chunk.vy * dt;
        chunk.z += chunk.vz * dt;
        chunk.yaw += chunk.spinYaw * dt;
        chunk.pitch += chunk.spinPitch * dt;
        const rest = this.heightfields.groundHeight(chunk.x, chunk.z) + chunk.size * 0.3;
        if (chunk.y < rest) {
          chunk.y = rest;
          chunk.vy = -chunk.vy * 0.3;
          chunk.vx *= 0.55;
          chunk.vz *= 0.55;
          chunk.spinYaw *= 0.5;
          chunk.spinPitch *= 0.4;
          if (Math.abs(chunk.vy) < 0.9 && chunk.age > 0.5) chunk.settled = true;
        }
      }
      const heads = chunk.age > 0.35 ? swarm.headsWithin(chunk.x, chunk.z, REACH) : 0;
      if (heads > 0) chunk.health -= dt * (0.3 + 0.2 * Math.min(heads, 5));
      if (chunk.health <= 0) this.eatenEvents.push(chunk);
    }
    if (this.eatenEvents.length > 0) this.list = this.list.filter((chunk) => chunk.health > 0);
  }

  applyPose() {
    const counters = { meat: 0, bone: 0, rib: 0, skull: 0 };
    for (const chunk of this.list) {
      const mesh = this.meshes[chunk.piece];
      const slot = counters[chunk.piece]++;
      if (slot >= CAPACITY) continue;
      const shrink = 0.25 + 0.75 * clamp(chunk.health, 0, 1);
      this.dummy.position.set(chunk.x, chunk.y, chunk.z);
      this.dummy.rotation.set(chunk.settled ? 0.2 : chunk.pitch, chunk.yaw, 0);
      this.dummy.scale.setScalar(chunk.size * shrink);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(slot, this.dummy.matrix);
      this.color.set(chunk.piece === 'meat' ? MEAT_COLORS[chunk.tint] : BONE_COLOR);
      mesh.setColorAt(slot, this.color);
    }
    for (const [name, mesh] of Object.entries(this.meshes)) {
      mesh.count = Math.min(counters[name], CAPACITY);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
