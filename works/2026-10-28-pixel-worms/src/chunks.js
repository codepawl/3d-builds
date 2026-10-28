// What is left of a swallowed creature: lumps of meat on a bone, a rib cage, bones and a skull. The pieces tumble a little and
// lie on the ground; the worms slither up onto each one and bite it. A piece shrinks in steps while heads are on it and, once
// gone, pays out worms (its share of the food).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeToonMaterial, addGlint } from './look.js';
import { clamp } from './random.js';

const CAPACITY = 160;
const GRAVITY = 14;
const REACH = 1.15; // metres from a head to a piece for it to count as biting
const SHRINK_STEPS = 5; // a piece is eaten in this many visible bites
const OUTLINE_WIDTH = 0.07; // metres, in the piece's own size
const OUTLINE_COLOR = 0x2a0a12;

// Worms a whole creature is worth, before the film's growth key.
export const FOOD = { chicken: 5, rabbit: 5, pig: 12, deer: 16, cow: 20, villager: 18, fox: 22, bird: 1.5, crow: 3, hen: 5, hedgehog: 12, badger: 30 };
const PIECES = {
  chicken: ['meat', 'meat', 'bone'],
  rabbit: ['meat', 'meat', 'bone'],
  pig: ['meat', 'meat', 'meat', 'rib', 'bone', 'skull'],
  deer: ['meat', 'meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  cow: ['meat', 'meat', 'meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  villager: ['meat', 'meat', 'rib', 'bone', 'bone', 'skull'],
  fox: ['meat', 'meat', 'meat', 'rib', 'bone', 'skull'],
  bird: ['meat', 'bone'],
  crow: ['meat', 'meat', 'bone'],
  hen: ['meat', 'meat', 'bone', 'bone'],
  hedgehog: ['meat', 'meat', 'rib', 'bone'],
  badger: ['meat', 'meat', 'meat', 'meat', 'rib', 'rib', 'bone', 'skull'],
};
// Footprint radius and height of the dome a worm climbs, per metre of piece size.
const SHAPE = {
  meat: { footprint: 1.15, top: 0.62 },
  bone: { footprint: 0.9, top: 0.3 },
  rib: { footprint: 0.85, top: 0.5 },
  skull: { footprint: 0.75, top: 0.72 },
};
// Vertex colours are linear: these are about #e04a5c meat, #a82a3c cut face, cream bone and near-black sockets once drawn.
const MEAT_PINK = [0.9, 0.15, 0.2];
const MEAT_DARK = [0.5, 0.03, 0.06];
const BONE_WHITE = [0.95, 0.9, 0.75];
const SOCKET = [0.02, 0.01, 0.015];

function paint(geometry, [red, green, blue]) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) colors.set([red, green, blue], index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Non-indexed copies so every part has the same attributes and can be merged.
const plain = (geometry) => {
  const copy = geometry.index ? geometry.toNonIndexed() : geometry;
  copy.deleteAttribute('uv');
  return copy;
};

function box(width, height, depth, x, y, z, color) {
  return paint(plain(new THREE.BoxGeometry(width, height, depth).translate(x, y, z)), color);
}

function buildGeometries() {
  // Meat: a plump lump with a darker cut end and a bone sticking out, like a ham.
  const lump = paint(plain(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.32, 0.78)), MEAT_PINK);
  const cut = paint(plain(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 7).rotateZ(Math.PI / 2).translate(0.88, 0, 0)), MEAT_DARK);
  const meat = mergeGeometries([lump, cut, box(0.7, 0.2, 0.2, 1.15, 0, 0, BONE_WHITE), box(0.22, 0.32, 0.34, 1.55, 0, 0, BONE_WHITE)]);
  meat.translate(-0.3, 0, 0);
  // Bone: a long shaft with a double knob at each end.
  const knobs = [-1, 1].flatMap((end) => [box(0.34, 0.3, 0.3, 0, 0.0, end * 0.85, BONE_WHITE).translate(-0.1, 0, 0), box(0.34, 0.3, 0.3, 0, 0, end * 0.85, BONE_WHITE).translate(0.1, 0, 0)]);
  const bone = mergeGeometries([box(0.2, 0.2, 1.7, 0, 0, 0, BONE_WHITE), ...knobs]);
  // Rib cage: arches standing along a spine.
  const arch = (z, radius) => paint(plain(new THREE.TorusGeometry(radius, 0.1, 5, 8, Math.PI).translate(0, 0, z)), BONE_WHITE);
  const spine = box(0.18, 0.16, 1.8, 0, 0, 0, BONE_WHITE);
  const rib = mergeGeometries([arch(-0.7, 0.5), arch(-0.24, 0.62), arch(0.24, 0.62), arch(0.7, 0.5), spine]);
  // Skull: a big cranium, a jaw with teeth, black sockets and a nose that read at phone size.
  const cranium = box(1.0, 0.8, 0.95, 0, 0.55, 0, BONE_WHITE);
  const jaw = box(0.7, 0.3, 0.8, 0, 0.0, 0.08, BONE_WHITE);
  const sockets = [-0.26, 0.26].map((x) => box(0.3, 0.3, 0.08, x, 0.6, 0.48, SOCKET));
  const nose = box(0.12, 0.2, 0.08, 0, 0.36, 0.48, SOCKET);
  const teeth = [-0.2, -0.07, 0.07, 0.2].map((x) => box(0.07, 0.16, 0.06, x, 0.06, 0.48, SOCKET));
  const skull = mergeGeometries([cranium, jaw, ...sockets, nose, ...teeth]);
  skull.translate(0, -0.2, 0);
  skull.scale(1, 0.8, 1);
  return { meat, bone, rib, skull };
}

// An inverted hull: the same shape pushed out along its normals and drawn from the inside, giving a dark outline that reads on
// any ground.
function outlineMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide, fog: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normalize(normal) * ${OUTLINE_WIDTH.toFixed(3)};`);
  };
  material.customProgramCacheKey = () => 'chunk-outline';
  return material;
}

export class Chunks {
  constructor(heightfields, random) {
    this.heightfields = heightfields;
    this.random = random;
    this.list = [];
    this.group = new THREE.Group();
    this.meshes = {};
    this.outlines = {};
    this.restDepth = {};
    // Tagged like the worms (alpha 0.5, no glint) so the pale quiet-world grade leaves the meat and bones their colour.
    const material = addGlint(makeToonMaterial({ vertexColors: true, emissive: 0x30060c }), 0);
    const hull = outlineMaterial();
    for (const [name, geometry] of Object.entries(buildGeometries())) {
      geometry.computeBoundingBox();
      this.restDepth[name] = -geometry.boundingBox.min.y;
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      const outline = new THREE.InstancedMesh(geometry, hull, CAPACITY);
      outline.frustumCulled = false;
      outline.count = 0;
      this.meshes[name] = mesh;
      this.outlines[name] = outline;
      this.group.add(mesh, outline);
    }
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.eatenEvents = [];
    this.feeder = null; // play: (x, z, food) => void, hands the food of a bite to the worms that bite
  }

  // Break a creature apart where it stood.
  burst(creature, kindName, kindHeight) {
    const random = this.random;
    const pieces = PIECES[kindName];
    const share = FOOD[kindName] / pieces.length;
    const size = 0.55 + kindHeight * 0.2;
    for (const piece of pieces) {
      const angle = random.range(0, Math.PI * 2);
      const outward = random.range(1.4, 3.4);
      const pieceSize = piece === 'meat' ? size * random.range(0.9, 1.15) : piece === 'skull' ? size * 0.85 : size * 0.95;
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
        size: pieceSize,
        footprint: SHAPE[piece].footprint * pieceSize,
        top: SHAPE[piece].top * pieceSize,
        food: share,
        health: 1,
        shown: 1, // eased toward the stage the piece is at, so it visibly shrinks in steps
        squash: 0,
        stage: SHRINK_STEPS,
        age: 0,
        tint: random.range(0.92, 1.0),
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
        const rest = this.heightfields.groundHeight(chunk.x, chunk.z) + this.restDepth[chunk.piece] * chunk.size + 0.1 * chunk.size;
        if (chunk.y < rest) {
          chunk.y = rest;
          chunk.vy = -chunk.vy * 0.3;
          chunk.vx *= 0.55;
          chunk.vz *= 0.55;
          chunk.spinYaw *= 0.5;
          chunk.spinPitch *= 0.4;
          if (Math.abs(chunk.vy) < 0.9 && chunk.age > 0.5) chunk.settled = true;
        }
      } else {
        // Lie flat: ease the tumble out and rest on the ground.
        const flat = Math.round(chunk.pitch / (Math.PI * 2)) * Math.PI * 2;
        chunk.pitch += (flat - chunk.pitch) * Math.min(1, dt * 12);
        const rest = this.heightfields.groundHeight(chunk.x, chunk.z) + this.restDepth[chunk.piece] * chunk.size * chunk.shown;
        chunk.y += (rest - chunk.y) * Math.min(1, dt * 14);
      }
      const heads = chunk.age > 0.35 ? swarm.headsWithin(chunk.x, chunk.z, REACH) : 0;
      if (heads > 0) {
        const bitten = Math.min(chunk.health, dt * (0.3 + 0.2 * Math.min(heads, 5)));
        chunk.health -= bitten;
        if (this.feeder) this.feeder(chunk.x, chunk.z, bitten * chunk.food);
      }
      // The piece loses a fifth at a time; a bite pinches it for a moment.
      const stage = clamp(Math.ceil(chunk.health * SHRINK_STEPS - 1e-6), 1, SHRINK_STEPS);
      if (stage < chunk.stage) {
        chunk.stage = stage;
        chunk.squash = 1;
      }
      chunk.squash = Math.max(0, chunk.squash - dt * 5);
      chunk.shown += (0.25 + 0.15 * chunk.stage - chunk.shown) * Math.min(1, dt * 14);
      chunk.footprint = SHAPE[chunk.piece].footprint * chunk.size * chunk.shown;
      chunk.top = SHAPE[chunk.piece].top * chunk.size * chunk.shown;
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
      const pinch = 1 - 0.18 * chunk.squash;
      this.dummy.position.set(chunk.x, chunk.y, chunk.z);
      this.dummy.rotation.set(chunk.pitch, chunk.yaw, 0);
      this.dummy.scale.set(chunk.size * chunk.shown, chunk.size * chunk.shown * pinch, chunk.size * chunk.shown);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(slot, this.dummy.matrix);
      this.outlines[chunk.piece].setMatrixAt(slot, this.dummy.matrix);
      this.color.setScalar(chunk.tint);
      mesh.setColorAt(slot, this.color);
    }
    for (const [name, mesh] of Object.entries(this.meshes)) {
      const outline = this.outlines[name];
      mesh.count = Math.min(counters[name], CAPACITY);
      outline.count = mesh.count;
      mesh.instanceMatrix.needsUpdate = true;
      outline.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
