// Things that hurt the worms: a hawk that dives and carries one off, a fox that snaps worms at the swarm's edge (and is eaten by
// the swarm once it is big), a ring of salt, and farm bear traps. Everything is scheduled on the sim clock, so a frame
// renders the same in any run. Early on the hazards win; later the swarm does.
import * as THREE from 'three';
import { RUN_SEED } from './config.js';
import { box, bakeBoxes } from './blocks.js';
import { Opponents } from './opponents.js';
import { clamp, smoothstep, createRandom } from './random.js';
import { makeToonMaterial, addDitherDissolve } from './look.js';
import { insideBuilding } from './terrain.js';
import { announce } from './events.js';
import { PARRY_WINDOW } from './abilities.js';

const WORM_RED = 0xb0283a;
const WORM_DARK = 0x6a0d16;
const ASH = 0x4a403c;
const DUST = 0x9a9a94;
const SALT_WHITE = 0xf2efe4;

export const PREDATOR_SCHEDULE = [
  { at: 5.0, kind: 'hawk', outcome: 'kill' },
  { at: 9.0, kind: 'fox', outcome: 'win', snaps: 3 },
  { at: 12.0, kind: 'hawk', outcome: 'kill' },
  { at: 20.8, kind: 'fox', outcome: 'lose', snaps: 2 },
  { at: 25.5, kind: 'hawk', outcome: 'abort' },
];

// The traps and the salt ring are laid on the swarm's way when their time comes (the route depends on what the swarm eats, so
// fixed spots would be missed): four bear traps in a staggered row ahead of the front, then a ring of salt.
const TRAPS_AT = 14.5;
const SALT_AT = 18.5;
const SALT_RADIUS = 3.4;
const APPEAR_SECONDS = 0.7;
const WARN_SECONDS = 0.9; // the hawk shadow and screech before a dive (play only)
const FOX_CROUCH_SECONDS = 0.75; // the fox crouches this long before a bite (play only)
const STUN_SECONDS = 2; // a parried hawk or fox is dazed this long
const STUN_EAT_HEADS = 8; // heads on a stunned fox that make it food

// A worm hanging from a beak or claws: a short chain of red cubes that writhes slowly.
class Dangler {
  constructor(group) {
    this.parts = Array.from({ length: 11 }, (_, index) => box(0.2, 0.2, 0.3, index % 3 === 0 ? WORM_DARK : WORM_RED));
    this.parts.forEach((part) => group.add(part));
  }

  place(time, anchor, backX, backZ) {
    this.parts.forEach((part, index) => {
      const hang = index * 0.26;
      const writhe = Math.sin(time * 3.2 - index * 0.8) * 0.12 * Math.min(index, 4) * 0.5;
      part.position.set(anchor.x - backX * index * 0.1 - backZ * writhe, anchor.y - hang, anchor.z - backZ * index * 0.1 + backX * writhe);
      part.rotation.set(0, Math.atan2(backX, backZ), 0);
    });
  }

  dispose(group) {
    this.parts.forEach((part) => group.remove(part));
  }
}

// A hawk in the Kenney cube-pets style: chunky rounded body of stacked boxes, a distinct head with a yellow hooked beak, two long
// wings of three tapered segments (inner, middle, dark tip) that flap slowly and sweep back in the dive, and a fanned tail.
// Warm brown back, pale cream belly, darker wing tips.
function buildHawk() {
  const root = new THREE.Group();
  const bird = new THREE.Group();
  const BROWN = '#c08a52';
  const DARK = '#6b4526';
  const CREAM = '#f4e8cc';
  bird.add(box(0.62, 0.42, 1.0, BROWN, 0, 0, 0));
  bird.add(box(0.5, 0.34, 0.8, BROWN, 0, 0.04, 0.12));
  bird.add(box(0.5, 0.2, 0.84, CREAM, 0, -0.18, 0.08));
  bird.add(box(0.44, 0.38, 0.1, CREAM, 0, 0.0, 0.5));
  const head = new THREE.Group();
  head.position.set(0, 0.28, 0.62);
  head.add(box(0.44, 0.4, 0.42, CREAM, 0, 0, 0));
  head.add(box(0.46, 0.14, 0.44, BROWN, 0, 0.2, -0.02));
  head.add(box(0.1, 0.1, 0.06, DARK, -0.12, 0.04, 0.22));
  head.add(box(0.1, 0.1, 0.06, DARK, 0.12, 0.04, 0.22));
  head.add(box(0.16, 0.14, 0.22, '#f0c030', 0, -0.06, 0.3));
  head.add(box(0.1, 0.1, 0.12, '#f0c030', 0, -0.14, 0.42));
  bird.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.04, -0.5);
  for (const spread of [-0.34, 0, 0.34]) {
    const feather = new THREE.Group();
    feather.rotation.y = spread;
    feather.add(box(0.26, 0.05, 0.85, spread === 0 ? BROWN : '#a8743f', 0, 0, -0.42));
    feather.add(box(0.26, 0.06, 0.14, CREAM, 0, 0.01, -0.82));
    tail.add(feather);
  }
  bird.add(tail);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 0.14, 0.05);
    pivot.add(box(0.95, 0.1, 1.15, BROWN, side * 0.47, 0, 0));
    pivot.add(box(0.95, 0.05, 0.9, CREAM, side * 0.47, -0.07, 0.04));
    const middle = new THREE.Group();
    middle.position.set(side * 0.95, 0, 0);
    middle.add(box(0.9, 0.08, 0.9, BROWN, side * 0.45, 0, -0.1));
    middle.add(box(0.9, 0.04, 0.7, CREAM, side * 0.45, -0.06, -0.06));
    const tip = new THREE.Group();
    tip.position.set(side * 0.9, 0, 0);
    tip.add(box(0.8, 0.07, 0.6, DARK, side * 0.4, 0, -0.18));
    tip.add(box(0.4, 0.06, 0.34, DARK, side * 0.95, 0, -0.26));
    middle.add(tip);
    pivot.add(middle);
    bird.add(pivot);
    wings.push({ pivot, middle, tip, side });
  }
  for (const side of [-1, 1]) bird.add(box(0.08, 0.22, 0.08, '#f0c030', side * 0.14, -0.4, 0.1));
  root.add(bird);
  root.scale.setScalar(1.7);
  bakeBoxes(root);
  return { root, wings };
}

function buildFox() {
  const dissolve = {};
  const paint = (color) => {
    const material = makeToonMaterial({ color });
    addDitherDissolve(material, dissolve);
    return material;
  };
  const part = (width, height, depth, color, x, y, z) => box(width, height, depth, color, x, y, z, paint);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(part(0.5, 0.48, 1.2, '#b88556', 0, 0.62, 0));
  body.add(part(0.4, 0.2, 0.7, '#efe6d2', 0, 0.45, 0.2));
  const head = new THREE.Group();
  head.position.set(0, 0.82, 0.75);
  head.add(part(0.4, 0.36, 0.4, '#b88556', 0, 0, 0));
  head.add(part(0.24, 0.2, 0.34, '#efe6d2', 0, -0.06, 0.34));
  head.add(part(0.09, 0.08, 0.08, '#2a211c', 0, 0.0, 0.52));
  head.add(part(0.1, 0.22, 0.1, '#4b3a2c', -0.14, 0.28, -0.04));
  head.add(part(0.1, 0.22, 0.1, '#4b3a2c', 0.14, 0.28, -0.04));
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.6);
  tail.add(part(0.22, 0.22, 0.8, '#b88556', 0, 0, -0.4));
  tail.add(part(0.23, 0.23, 0.26, '#efe6d2', 0, 0, -0.85));
  body.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.17, 0.45], [0.17, 0.45], [-0.17, -0.45], [0.17, -0.45]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, z);
    pivot.add(part(0.13, 0.46, 0.13, '#3c2f26', 0, -0.23, 0));
    body.add(pivot);
    legs.push(pivot);
  }
  root.add(body);
  root.scale.setScalar(2.6);
  return { root, body, head, tail, legs, dissolve };
}

export class Hazards {
  // With `director` on (play), hazards are spawned over time near the swarm and scaled by its size, and they may kill the last
  // worm. Off (the film), they follow PREDATOR_SCHEDULE and never take the last two.
  constructor(heightfields, specks, chunks, { director = false } = {}) {
    this.director = director;
    this.minWorms = director ? 0 : 2;
    this.heightfields = heightfields;
    this.specks = specks;
    this.chunks = chunks;
    this.random = createRandom(RUN_SEED + 7);
    this.group = new THREE.Group();
    this.predators = [];
    this.nextScheduled = 0;
    this.events = []; // this step
    this.log = []; // the whole run
    this.traps = [];
    this.salt = null;
    this.remains = this.buildRemains();
    // Set by the app each step: is a dodge on, and how long ago did it start.
    this.dodge = { active: false, age: 99 };
    this.opponents = director ? new Opponents(this) : null;
  }

  // What an attack that lands now meets: a worm is taken ('hit'), the swarm is flat and it misses ('miss'), or the dodge began
  // just before it and the attacker is knocked back ('parry').
  attackOutcome() {
    if (!this.dodge.active) return 'hit';
    return this.dodge.age <= PARRY_WINDOW ? 'parry' : 'miss';
  }

  layTraps(time, world, amount = 4) {
    for (let index = 0; index < amount; index++) {
      const distance = 8 + index * 1.8;
      const sideways = (index % 2 === 0 ? -1 : 1) * (1.5 + (this.director ? this.random.range(0, 2) : 0));
      const x = world.front.x + world.forward.x * distance + world.right.x * sideways;
      const z = world.front.z + world.forward.z * distance + world.right.z * sideways;
      if (insideBuilding(x, z, 1.5)) continue;
      const trap = this.buildBearTrap({ x, z });
      trap.placedAt = time;
      this.traps.push(trap);
      this.group.add(trap.root);
    }
  }

  laySalt(time, world) {
    if (this.salt) this.group.remove(this.salt.group);
    const x = world.front.x + world.forward.x * 10;
    const z = world.front.z + world.forward.z * 10;
    this.salt = this.buildSaltRing({ x, z, radius: SALT_RADIUS });
    this.salt.placedAt = time;
    this.group.add(this.salt.group);
  }

  emit(time, kind, x, z, killed = 0) {
    const event = { time, kind, x, z, killed };
    this.events.push(event);
    this.log.push(event);
  }

  // ---- Remains: a shrivelled dark curl (or a cut worm) left where a worm died -------------------------------------------

  buildRemains() {
    const capacity = 40;
    const partsPerCurl = 8;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), makeToonMaterial({ color: 0xffffff }), capacity * partsPerCurl);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * partsPerCurl * 3), 3);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let index = 0; index < capacity * partsPerCurl; index++) mesh.setMatrixAt(index, hidden);
    this.group.add(mesh);
    return { mesh, capacity, partsPerCurl, items: [], cursor: 0, matrix: new THREE.Matrix4(), color: new THREE.Color(), dummy: new THREE.Object3D() };
  }

  leaveRemains(time, x, z, color, shrivel) {
    const remains = this.remains;
    const slot = remains.cursor;
    remains.cursor = (remains.cursor + 1) % remains.capacity;
    remains.items = remains.items.filter((item) => item.slot !== slot);
    remains.items.push({ slot, x, z, born: time, color, shrivel, yaw: this.random.range(0, Math.PI * 2) });
  }

  updateRemains(time) {
    const remains = this.remains;
    const { mesh, partsPerCurl, dummy } = remains;
    remains.items = remains.items.filter((item) => time - item.born < 7);
    for (const item of remains.items) {
      const age = time - item.born;
      const curl = item.shrivel ? smoothstep(0, 1.1, age) : 0;
      const fade = 1 - smoothstep(5.5, 7, age);
      const ground = this.heightfields.groundHeight(item.x, item.z);
      for (let part = 0; part < partsPerCurl; part++) {
        const spiral = part * 0.85 + item.yaw;
        const radius = (0.18 + part * 0.09) * (1 - 0.62 * curl);
        const size = (0.2 - part * 0.008) * (1 - 0.3 * curl) * fade;
        dummy.position.set(item.x + Math.cos(spiral) * radius, ground + 0.08 + 0.05 * curl * (part % 2), item.z + Math.sin(spiral) * radius);
        dummy.rotation.set(0, -spiral, 0);
        dummy.scale.set(size * 1.5, size, size);
        dummy.updateMatrix();
        mesh.setMatrixAt(item.slot * partsPerCurl + part, dummy.matrix);
        remains.color.set(item.color);
        mesh.setColorAt(item.slot * partsPerCurl + part, remains.color);
      }
    }
    // Slots no longer in use are hidden.
    const used = new Set(remains.items.map((item) => item.slot));
    for (let slot = 0; slot < remains.capacity; slot++) {
      if (used.has(slot)) continue;
      for (let part = 0; part < partsPerCurl; part++) mesh.setMatrixAt(slot * partsPerCurl + part, remains.matrix.makeScale(0, 0, 0));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  // ---- Killing -----------------------------------------------------------------------------------------------------------

  nearestWorm(swarm, x, z, maxDistance) {
    let best = -1;
    let bestDistance = maxDistance;
    for (let worm = 0; worm < swarm.count; worm++) {
      const distance = Math.hypot(swarm.x[worm * 20] - x, swarm.z[worm * 20] - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = worm;
      }
    }
    return best;
  }

  // Takes one worm (never the last two). Returns its head position, or null.
  killWorm(swarm, worm, time, remainsColor, shrivel, dustColor, dustAmount, cause) {
    if (worm < 0 || swarm.count <= this.minWorms) return null;
    const spot = swarm.remove(worm);
    this.leaveRemains(time, spot.x, spot.z, remainsColor, shrivel);
    this.specks.burst(spot.x, this.heightfields.groundHeight(spot.x, spot.z), spot.z, dustColor, dustAmount);
    announce('worm-die', { x: spot.x, z: spot.z, cause });
    return spot;
  }

  // ---- Bear trap ----------------------------------------------------------------------------------------------------------

  buildBearTrap(spot) {
    const root = new THREE.Group();
    root.position.set(spot.x, this.heightfields.groundHeight(spot.x, spot.z), spot.z);
    root.rotation.y = this.random.range(-0.6, 0.6);
    root.add(box(1.5, 0.09, 1.0, '#6a6f74', 0, 0.045, 0));
    root.add(box(0.5, 0.05, 0.3, '#8c4a2a', 0, 0.1, 0));
    const jaws = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.7, 0.1, 0);
      const outward = side;
      pivot.add(box(0.95, 0.07, 1.0, '#8a9096', outward * 0.48, 0, 0));
      for (let tooth = 0; tooth < 6; tooth++) pivot.add(box(0.07, 0.2, 0.1, '#c9ccd0', outward * 0.2, 0.12, -0.45 + tooth * 0.18));
      root.add(pivot);
      jaws.push({ pivot, side });
    }
    root.add(box(0.1, 0.1, 0.9, '#3a3d40', 0, 0.08, -0.9));
    return { root, jaws, spot, state: 'open', since: -10, angle: 0 };
  }

  stepTraps(time, swarm) {
    for (const trap of this.traps) {
      trap.root.scale.setScalar(2.2 * Math.max(0.01, smoothstep(0, APPEAR_SECONDS, time - trap.placedAt)));
      if (time - trap.placedAt < APPEAR_SECONDS) continue;
      const age = time - trap.since;
      if (trap.state === 'open') {
        const triggered = this.nearestWorm(swarm, trap.spot.x, trap.spot.z, 1.0);
        if (triggered >= 0) {
          trap.state = 'snapped';
          trap.since = time;
          let killed = 0;
          // A dodging swarm is flat and scattered: the jaws close on nothing.
          const bites = this.dodge.active ? 0 : this.trapBites(swarm);
          for (let bite = 0; bite < bites; bite++) {
            const victim = this.nearestWorm(swarm, trap.spot.x, trap.spot.z, 1.7);
            if (this.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 6, 'trap')) killed += 1;
          }
          this.specks.burst(trap.spot.x, this.heightfields.groundHeight(trap.spot.x, trap.spot.z), trap.spot.z, DUST, 5);
          this.emit(time, 'bear-snap', trap.spot.x, trap.spot.z, killed);
        }
      } else if (trap.state === 'snapped' && age > 4.5) {
        trap.state = 'rearming';
        trap.since = time;
      } else if (trap.state === 'rearming' && age > 1.4) {
        trap.state = 'open';
      }
      const closed = trap.state === 'snapped' ? smoothstep(0, 0.1, age) : trap.state === 'rearming' ? 1 - smoothstep(0, 1.4, age) : 0;
      const angle = closed * 2.2;
      for (const jaw of trap.jaws) jaw.pivot.rotation.z = jaw.side * angle;
    }
  }

  // ---- Salt ring ---------------------------------------------------------------------------------------------------------

  buildSaltRing(ring) {
    const group = new THREE.Group();
    const pieces = 44;
    for (let index = 0; index < pieces; index++) {
      const angle = (index / pieces) * Math.PI * 2;
      const radius = ring.radius + this.random.range(-0.12, 0.12);
      const x = ring.x + Math.cos(angle) * radius;
      const z = ring.z + Math.sin(angle) * radius;
      const ground = this.heightfields.groundHeight(x, z);
      const width = this.random.range(0.5, 0.75);
      const height = this.random.range(0.1, 0.22);
      const crystal = box(width, height, 0.5, SALT_WHITE, x, ground + height / 2, z);
      crystal.rotation.y = -angle;
      group.add(crystal);
    }
    return { group, ring, kills: 0, lastKill: -10 };
  }

  stepSalt(time, swarm) {
    const salt = this.salt;
    if (!salt) return;
    const grow = Math.max(0.01, smoothstep(0, APPEAR_SECONDS, time - salt.placedAt));
    salt.group.scale.setScalar(grow);
    salt.group.position.set(salt.ring.x * (1 - grow), 0, salt.ring.z * (1 - grow));
    if (grow < 1) return;
    if (salt.kills >= 9 || time - salt.lastKill < 0.45) return;
    const { x, z, radius } = salt.ring;
    for (let worm = 0; worm < swarm.count && swarm.count > this.minWorms; worm++) {
      const slot = worm * 20;
      const fromCenter = Math.hypot(swarm.x[slot] - x, swarm.z[slot] - z);
      if (Math.abs(fromCenter - radius) > 0.45) continue;
      const spot = this.killWorm(swarm, worm, time, ASH, true, SALT_WHITE, 7, 'salt');
      salt.kills += 1;
      salt.lastKill = time;
      this.emit(time, 'salt-shrivel', spot.x, spot.z, 1);
      break;
    }
  }

  // ---- Predators ---------------------------------------------------------------------------------------------------------

  startPredator(time, entry, world) {
    const predator = entry.kind === 'hawk' ? this.startHawk(time, entry, world) : this.startFox(time, entry, world);
    this.predators.push(predator);
  }

  startHawk(time, entry, world) {
    const { root, wings } = buildHawk();
    this.group.add(root);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0a10, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, fog: false }));
    shadow.visible = false;
    shadow.renderOrder = 3;
    this.group.add(shadow);
    return { kind: 'hawk', entry, root, wings, shadow, state: 'circle', since: time, born: time, angle: -0.8, dangler: null, position: new THREE.Vector3(), velocity: new THREE.Vector3(), done: false };
  }

  startFox(time, entry, world) {
    const model = buildFox();
    this.group.add(model.root);
    const side = entry.side ?? (entry.at < 15 ? 1 : -1);
    const x = world.front.x + world.forward.x * 13 + world.right.x * 7 * side;
    const z = world.front.z + world.forward.z * 13 + world.right.z * 7 * side;
    model.root.position.set(x, this.heightfields.groundHeight(x, z), z);
    return { kind: 'fox', entry, model, root: model.root, state: 'run', since: time, born: time, x, z, heading: 0, snaps: 0, nextSnap: 0, dangler: null, done: false, gait: 0, speed: 0 };
  }

  stepHawk(time, dt, hawk, world) {
    const swarm = world.swarm;
    const age = time - hawk.since;
    const reachAhead = this.director ? 9 : 7;
    const center = { x: world.front.x + world.forward.x * reachAhead, z: world.front.z + world.forward.z * reachAhead };
    const ground = this.heightfields.groundHeight(center.x, center.z);
    let flap = 0.3 * Math.sin(time * 3.2) + 0.4;
    let fold = 0;
    let pitch = 0;
    let roll = 0;
    if (hawk.state === 'circle' || hawk.state === 'warn') {
      hawk.angle += dt * 1.0;
      const radius = 4.0;
      const wanted = new THREE.Vector3(
        center.x + (world.right.x * Math.cos(hawk.angle) + world.forward.x * Math.sin(hawk.angle)) * radius,
        ground + (this.director ? 5.2 : 7.5) + 0.3 * Math.sin(time * 0.9),
        center.z + (world.right.z * Math.cos(hawk.angle) + world.forward.z * Math.sin(hawk.angle)) * radius,
      );
      if (age < 0.05) hawk.position.copy(wanted);
      hawk.velocity.copy(wanted).sub(hawk.position).multiplyScalar(1 / Math.max(dt, 1e-4));
      hawk.position.copy(wanted);
      const aheadOfSwarm = Math.sin(hawk.angle) > 0.5;
      const circled = age > (hawk.entry.outcome === 'abort' ? 3.0 : 2.4);
      if (hawk.state === 'warn') {
        // Telegraph (play only): its shadow grows on the ground and it screeches before the dive.
        this.placeHawkShadow(hawk, swarm, smoothstep(0, WARN_SECONDS, age), time);
        if (age > WARN_SECONDS) {
          hawk.state = 'dive';
          hawk.since = time;
          this.emit(time, 'hawk-dive', hawk.position.x, hawk.position.z, 0);
        }
      } else if (circled && aheadOfSwarm && hawk.entry.outcome === 'abort') {
        hawk.state = 'leave';
        hawk.since = time;
        this.emit(time, 'hawk-abort', hawk.position.x, hawk.position.z, 0);
      } else if (circled && aheadOfSwarm && swarm.count > this.minWorms) {
        hawk.since = time;
        if (this.director) {
          hawk.state = 'warn';
          this.emit(time, 'hawk-warn', hawk.position.x, hawk.position.z, 0);
        } else {
          hawk.state = 'dive';
          this.emit(time, 'hawk-dive', hawk.position.x, hawk.position.z, 0);
        }
      }
    } else if (hawk.state === 'dive') {
      const victim = this.nearestWorm(swarm, hawk.position.x, hawk.position.z, 40);
      const targetX = victim >= 0 ? swarm.x[victim * 20] : world.front.x;
      const targetZ = victim >= 0 ? swarm.z[victim * 20] : world.front.z;
      const target = new THREE.Vector3(targetX, this.heightfields.groundHeight(targetX, targetZ) + 0.35, targetZ);
      const toTarget = target.clone().sub(hawk.position);
      const distance = toTarget.length();
      const speed = 6 + 8 * smoothstep(0, 0.7, age);
      hawk.velocity.copy(toTarget).normalize().multiplyScalar(speed);
      hawk.position.addScaledVector(hawk.velocity, dt);
      pitch = 0.9;
      flap = 0.3;
      fold = 1;
      if (this.director) this.placeHawkShadow(hawk, swarm, 1, time);
      if (distance < 0.8 || age > 2.2) {
        const outcome = this.attackOutcome();
        hawk.shadow.visible = false;
        hawk.since = time;
        if (outcome === 'parry') {
          hawk.state = 'stun';
          this.emit(time, 'parry', hawk.position.x, hawk.position.z, 0);
          announce('parry', { attacker: 'hawk', x: hawk.position.x, z: hawk.position.z });
          this.specks.burst(hawk.position.x, hawk.position.y - 0.5, hawk.position.z, 0xfff0b8, 10);
        } else if (outcome === 'miss') {
          hawk.state = 'carry';
          this.emit(time, 'hawk-miss', hawk.position.x, hawk.position.z, 0);
        } else {
          hawk.state = 'carry';
        }
        const spot = outcome === 'hit' ? this.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 4, 'hawk') : null;
        if (spot) {
          hawk.dangler = new Dangler(this.group);
          this.emit(time, 'hawk-kill', spot.x, spot.z, 1);
        }
      }
    } else if (hawk.state === 'stun') {
      // Parried: thrown back and up, then it flutters low and dazed for about two seconds before it flies off.
      const away = new THREE.Vector3(world.right.x * 0.75 + world.forward.x * 0.5, 0, world.right.z * 0.75 + world.forward.z * 0.5).normalize();
      const thrown = 1 - smoothstep(0, 0.5, age);
      const floor = this.heightfields.groundHeight(hawk.position.x, hawk.position.z) + 0.6;
      hawk.velocity.set(away.x * 7 * thrown, hawk.position.y > floor ? (age < 0.25 ? 3 : -2.2) : 0, away.z * 7 * thrown);
      hawk.position.addScaledVector(hawk.velocity, dt);
      hawk.position.y = Math.max(hawk.position.y, floor);
      flap = -0.5 + 0.3 * Math.sin(time * 16);
      pitch = -0.5;
      roll = 0.5 * Math.sin(age * 14) * (1 - smoothstep(0, 1.6, age));
      if (age > 2.0) {
        hawk.state = 'carry';
        hawk.since = time;
      }
    } else {
      const away = new THREE.Vector3(world.right.x * 0.75 + world.forward.x * 0.5, 0, world.right.z * 0.75 + world.forward.z * 0.5).normalize();
      const climb = smoothstep(0, 1.2, age);
      hawk.velocity.set(away.x * 5.5, climb * 4.2, away.z * 5.5);
      hawk.position.addScaledVector(hawk.velocity, dt);
      flap = 0.45 * Math.sin(time * 3.6) + 0.15;
      pitch = -0.3;
      if (age > 3.6) hawk.done = true;
    }
    hawk.root.position.copy(hawk.position);
    hawk.root.rotation.order = 'YXZ';
    hawk.root.rotation.y = Math.atan2(hawk.velocity.x, hawk.velocity.z);
    hawk.root.rotation.x = pitch;
    hawk.root.rotation.z = roll;
    for (const wing of hawk.wings) {
      wing.pivot.rotation.z = wing.side * flap;
      wing.middle.rotation.z = wing.side * flap * 0.7;
      wing.tip.rotation.z = wing.side * flap * 0.7;
      // The dive folds the wings back along the body.
      wing.pivot.rotation.y = wing.side * 1.0 * fold;
      wing.middle.rotation.y = wing.side * 0.6 * fold;
      wing.tip.rotation.y = wing.side * 0.4 * fold;
    }
    if (hawk.dangler) {
      const heading = Math.atan2(hawk.velocity.x, hawk.velocity.z);
      const claws = new THREE.Vector3(hawk.position.x, hawk.position.y - 0.5, hawk.position.z);
      hawk.dangler.place(time, claws, -Math.sin(heading) * 0.8, -Math.cos(heading) * 0.8);
    }
    if (hawk.done && hawk.dangler) hawk.dangler.dispose(this.group);
    if (hawk.done) this.group.remove(hawk.shadow);
  }

  // The shadow of the coming dive: a dark disc on the ground under the worm the hawk is after, growing as the dive nears.
  placeHawkShadow(hawk, swarm, grow, time) {
    const victim = this.nearestWorm(swarm, hawk.position.x, hawk.position.z, 40);
    const x = victim >= 0 ? swarm.x[victim * 20] : hawk.position.x;
    const z = victim >= 0 ? swarm.z[victim * 20] : hawk.position.z;
    hawk.shadow.visible = true;
    hawk.shadow.position.set(x, this.heightfields.groundHeight(x, z) + 0.12, z);
    hawk.shadow.scale.setScalar((0.5 + 1.4 * grow) * (1 + 0.06 * Math.sin(time * 18)));
    hawk.shadow.material.opacity = 0.3 + 0.35 * grow;
  }

  stepFox(time, dt, fox, world) {
    const swarm = world.swarm;
    const model = fox.model;
    const age = time - fox.since;
    let moving = 0;
    let lunge = 0;
    let crouch = 0;
    if (fox.state === 'run') {
      if (this.director && age > 20) fox.done = true; // lost the swarm
      const victim = this.nearestWorm(swarm, fox.x, fox.z, 60);
      if (victim >= 0) {
        const toX = swarm.x[victim * 20] - fox.x;
        const toZ = swarm.z[victim * 20] - fox.z;
        const distance = Math.hypot(toX, toZ);
        fox.heading = Math.atan2(toX, toZ);
        moving = 9.5 * smoothstep(1.0, 3.0, distance);
        if (distance < 1.6) {
          fox.state = 'snap';
          fox.since = time;
          fox.nextSnap = time + (this.director ? FOX_CROUCH_SECONDS + 0.15 : 0.5);
        }
      }
    } else if (fox.state === 'snap') {
      moving = 0;
      const victimSpot = this.nearestWorm(swarm, fox.x, fox.z, 3.0);
      if (victimSpot >= 0) fox.heading = Math.atan2(swarm.x[victimSpot * 20] - fox.x, swarm.z[victimSpot * 20] - fox.z);
      const sinceSnap = time - (fox.nextSnap - 0.9);
      if (this.director) {
        // Telegraph: the fox drops low on its front legs and growls, then springs.
        const untilBite = fox.nextSnap - time;
        crouch = smoothstep(FOX_CROUCH_SECONDS, 0.15, untilBite);
        lunge = 1 - smoothstep(0, 0.25, time - (fox.lastBite ?? -10));
        if (!fox.warned && untilBite < FOX_CROUCH_SECONDS) {
          fox.warned = true;
          this.emit(time, 'fox-warn', fox.x, fox.z, 0);
        }
      } else {
        lunge = Math.sin(clamp(sinceSnap / 0.9, 0, 1) * Math.PI);
      }
      if (time >= fox.nextSnap) {
        const outcome = this.attackOutcome();
        fox.nextSnap = time + 1.1;
        fox.warned = false;
        fox.lastBite = time;
        if (outcome === 'parry') {
          this.stunFox(fox, time, world);
        } else if (outcome === 'miss') {
          this.emit(time, 'fox-miss', fox.x, fox.z, 0);
        } else {
          const victim = this.nearestWorm(swarm, fox.x, fox.z, 3.0);
          const spot = this.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 5, 'fox');
          if (spot) {
            fox.snaps += 1;
            this.emit(time, 'fox-snap', spot.x, spot.z, 1);
            if (fox.snaps === fox.entry.snaps && fox.entry.outcome === 'win' && !fox.dangler) fox.dangler = new Dangler(this.group);
          }
        }
      }
      if (fox.state === 'snap') {
        if (victimSpot < 0) {
          fox.state = 'run';
          fox.since = time;
        }
        if (fox.entry.outcome === 'win' && fox.snaps >= fox.entry.snaps) {
          fox.state = 'flee';
          fox.since = time;
        }
        if (fox.entry.outcome === 'lose') {
          const crowd = swarm.headsWithin(fox.x, fox.z, 3.2);
          if (fox.snaps >= fox.entry.snaps && (crowd >= 14 || age > 6)) {
            fox.state = 'overwhelmed';
            fox.since = time;
            this.emit(time, 'fox-overwhelmed', fox.x, fox.z, 0);
          }
        }
      }
    } else if (fox.state === 'stunned') {
      // Parried: thrown back, then it lies on its side for about two seconds. A medium swarm that reaches it eats it.
      const thrown = 1 - smoothstep(0, 0.5, age);
      fox.x += fox.knock.x * thrown * dt;
      fox.z += fox.knock.z * thrown * dt;
      lunge = 0;
      if (age > 0.4 && swarm.headsWithin(fox.x, fox.z, 3.4) >= STUN_EAT_HEADS) {
        fox.state = 'overwhelmed';
        fox.since = time;
        this.emit(time, 'fox-overwhelmed', fox.x, fox.z, 0);
      } else if (age > STUN_SECONDS) {
        fox.state = 'flee';
        fox.since = time;
        fox.lying = false;
      }
    } else if (fox.state === 'flee') {
      fox.heading = Math.atan2(world.forward.x * 0.4 + world.right.x * 0.9, world.forward.z * 0.4 + world.right.z * 0.9);
      moving = 7.5 * smoothstep(0, 0.5, age);
      if (age > 3.2) fox.done = true;
    } else if (fox.state === 'overwhelmed') {
      moving = 0;
      lunge = 0.4 * Math.sin(age * 5);
      const dissolve = smoothstep(1.0, 1.6, age);
      model.dissolve.set(dissolve);
      if (age > 1.6) {
        this.chunks.burst({ x: fox.x, z: fox.z }, 'fox', 1.4);
        this.specks.burst(fox.x, this.heightfields.groundHeight(fox.x, fox.z), fox.z, 0xb88556, 8);
        this.emit(time, 'fox-eaten', fox.x, fox.z, 0);
        fox.done = true;
      }
    }
    if (moving > 0) {
      fox.x += Math.sin(fox.heading) * moving * dt;
      fox.z += Math.cos(fox.heading) * moving * dt;
    }
    fox.gait += dt * moving * 1.3;
    const ground = this.heightfields.groundHeight(fox.x, fox.z);
    fox.root.position.set(fox.x, ground + (moving > 0 ? 0.06 * Math.abs(Math.sin(fox.gait)) : 0), fox.z);
    fox.root.rotation.y = fox.heading;
    model.legs.forEach((leg, index) => {
      leg.rotation.x = moving > 0 ? Math.sin(fox.gait + (index % 2 === 0 ? 0 : Math.PI)) * 0.7 : 0;
    });
    model.head.position.z = 0.75 + 0.35 * lunge;
    model.head.rotation.x = 0.35 * lunge + 0.5 * crouch;
    model.body.position.y = -0.3 * crouch;
    model.body.rotation.x = 0.16 * crouch;
    // Lying on its side while stunned (and while being eaten after a parry).
    const lying = fox.lying ? 1.35 * smoothstep(0, 0.25, time - fox.stunnedAt) : 0;
    fox.root.rotation.z = lying;
    fox.root.position.y += 0.5 * lying;
    model.tail.rotation.x = 0.2 * Math.sin(time * 1.6) - 0.15;
    if (fox.dangler) {
      const forwardX = Math.sin(fox.heading);
      const forwardZ = Math.cos(fox.heading);
      fox.dangler.place(time, new THREE.Vector3(fox.x + forwardX * 1.5, ground + 1.1, fox.z + forwardZ * 1.5), -forwardX * 0.8, -forwardZ * 0.8);
    }
    if (fox.done && fox.dangler) fox.dangler.dispose(this.group);
  }

  stunFox(fox, time, world) {
    const awayX = fox.x - world.front.x;
    const awayZ = fox.z - world.front.z;
    const awayLength = Math.hypot(awayX, awayZ) + 1e-4;
    fox.state = 'stunned';
    fox.since = time;
    fox.stunnedAt = time;
    fox.lying = true;
    fox.knock = { x: (awayX / awayLength) * 8, z: (awayZ / awayLength) * 8 };
    this.emit(time, 'parry', fox.x, fox.z, 0);
    announce('parry', { attacker: 'fox', x: fox.x, z: fox.z });
    this.specks.burst(fox.x, this.heightfields.groundHeight(fox.x, fox.z) + 0.8, fox.z, 0xfff0b8, 10);
  }

  trapBites(swarm) {
    return this.director ? 3 + Math.floor(swarm.count / 200) : 3;
  }

  // ---- Director (play) ---------------------------------------------------------------------------------------------------
  // The director (src/director.js) decides what comes and when; these start the hawk, fox, traps and salt it asks for.

  spawn(kind, time, world, count) {
    if (kind === 'hawk') this.startPredator(time, { at: time, kind: 'hawk', outcome: this.random.next() < 0.15 ? 'abort' : 'kill' }, world);
    else if (kind === 'fox') {
      const outcome = count >= 50 ? 'lose' : 'win';
      const snaps = outcome === 'lose' ? 2 : clamp(Math.floor(count / 6), 1, 4);
      this.startPredator(time, { at: time, kind: 'fox', outcome, snaps, side: this.random.next() < 0.5 ? -1 : 1 }, world);
    } else if (kind === 'traps') this.layTraps(time, world, clamp(2 + Math.floor(count / 60), 2, 6));
    else if (kind === 'salt') this.laySalt(time, world);
    else this.opponents.spawn(kind, time, world, count);
  }

  // What is about to hit, for bots and for the HUD: { kind, x, z, eta } with eta in seconds, and danger lanes.
  incoming(time) {
    const attacks = [];
    for (const predator of this.predators) {
      if (predator.kind === 'hawk' && (predator.state === 'warn' || predator.state === 'dive')) {
        attacks.push({ kind: 'hawk', x: predator.position.x, z: predator.position.z, eta: predator.state === 'warn' ? WARN_SECONDS - (time - predator.since) : 0.3 });
      } else if (predator.kind === 'fox' && predator.state === 'snap') {
        attacks.push({ kind: 'fox', x: predator.x, z: predator.z, eta: predator.nextSnap - time });
      }
    }
    if (this.opponents) attacks.push(...this.opponents.incoming(time));
    return attacks;
  }

  // Old traps and salt are taken away so the field does not fill up.
  expireTraps(time) {
    const alive = [];
    for (const trap of this.traps) {
      if (time - trap.placedAt < 70) alive.push(trap);
      else this.group.remove(trap.root);
    }
    this.traps = alive;
    if (this.salt && time - this.salt.placedAt > 55) {
      this.group.remove(this.salt.group);
      this.salt = null;
    }
  }

  // Worms are drawn to a fox that is fighting the swarm once the swarm is big enough to take it.
  attractors() {
    const foxes = this.predators.filter((predator) => predator.kind === 'fox' && ((predator.state === 'snap' && predator.entry.outcome === 'lose') || predator.state === 'stunned')).map((fox) => ({ x: fox.x, z: fox.z }));
    return this.opponents ? foxes.concat(this.opponents.attractors()) : foxes;
  }

  step(time, dt, world) {
    this.events.length = 0;
    if (this.director) {
      this.expireTraps(time);
      this.opponents.step(time, dt, world);
    } else {
      while (this.nextScheduled < PREDATOR_SCHEDULE.length && time >= PREDATOR_SCHEDULE[this.nextScheduled].at) {
        this.startPredator(time, PREDATOR_SCHEDULE[this.nextScheduled], world);
        this.nextScheduled += 1;
      }
      if (this.traps.length === 0 && time >= TRAPS_AT) this.layTraps(time, world);
      if (!this.salt && time >= SALT_AT) this.laySalt(time, world);
    }
    this.stepTraps(time, world.swarm);
    this.stepSalt(time, world.swarm);
    for (const predator of this.predators) {
      if (predator.kind === 'hawk') this.stepHawk(time, dt, predator, world);
      else this.stepFox(time, dt, predator, world);
      if (predator.done) this.group.remove(predator.root);
    }
    this.predators = this.predators.filter((predator) => !predator.done);
    this.updateRemains(time);
  }
}
