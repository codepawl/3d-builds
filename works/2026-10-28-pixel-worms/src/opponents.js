// The opponents that come over time in play mode (everything but the hawk, fox, traps and salt, which live in hazards.js):
// birds, hens and crows that peck, a farmer with a hoe, a hedgehog, a badger and a lawnmower. Each one shows a telegraph (a
// shadow, a wind-up, a dust line) before it hurts anyone, so a dodge started just before the hit is a parry and a later one only
// makes it miss. Most of them become meat when the swarm is big enough to take them.
import * as THREE from 'three';
import { RUN_SEED } from './config.js';
import { clamp, smoothstep, createRandom } from './random.js';
import { announce } from './events.js';
import { box, bakeBoxes } from './blocks.js';

const WORM_DARK = 0x6a0d16;
const DIRT = 0x7a5a3a;
const FEATHER = 0x34343c;
const DUST = 0xb0a890;
const PECKERS = {
  birds: { food: 'bird', cue: 'bird', warn: 0.8, pecks: 2, eatHeads: 4, stagger: 0.45, flyer: true, speed: 8, height: 0.35 },
  crows: { food: 'crow', cue: 'crow', warn: 0.75, pecks: 2, eatHeads: 5, stagger: 0.35, flyer: true, speed: 9, height: 0.6 },
  hen: { food: 'hen', cue: 'hen', warn: 0.7, pecks: 3, eatHeads: 6, stagger: 0.3, flyer: false, speed: 4.6, height: 0.8 },
};
const HOVER = 4.2;
const LANE_HALF_WIDTH = 2.4;
const LANE_HALF_LENGTH = 48;
const MOWER_SPEED = 19;
const MOWER_WARN = 2.8;

const turnToward = (current, wanted, amount) => {
  const difference = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
  return current + clamp(difference, -amount, amount);
};

// ---- Models (boxes, in the same chunky style as the hawk and fox) ----------------------------------------------------------

// A small bird: a body with a head, beak and tail, short legs for the ground and two wings that lie folded on its sides when it
// sits and spread and beat when it flies (posePecker sets the spread).
function buildSmallBird(back, chest, scale, beakColor, wingTip, eyeColor = '#15151a') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(box(0.3, 0.28, 0.52, back, 0, 0, 0));
  body.add(box(0.26, 0.16, 0.4, chest, 0, -0.1, 0.06));
  body.add(box(0.22, 0.22, 0.24, back, 0, 0.2, 0.3));
  body.add(box(0.08, 0.06, 0.2, beakColor, 0, 0.17, 0.52));
  body.add(box(0.05, 0.05, 0.04, eyeColor, -0.12, 0.24, 0.38));
  body.add(box(0.05, 0.05, 0.04, eyeColor, 0.12, 0.24, 0.38));
  body.add(box(0.14, 0.05, 0.3, back, 0, 0.0, -0.4));
  body.add(box(0.2, 0.04, 0.14, wingTip, 0, -0.01, -0.62));
  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    legs.add(box(0.05, 0.22, 0.05, '#4a4038', side * 0.08, -0.25, 0.04));
    legs.add(box(0.1, 0.03, 0.16, '#4a4038', side * 0.08, -0.35, 0.09));
  }
  body.add(legs);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.1, 0.04);
    pivot.add(box(0.26, 0.05, 0.34, back, side * 0.13, 0, 0));
    pivot.add(box(0.2, 0.04, 0.28, wingTip, side * 0.36, 0, -0.06));
    body.add(pivot);
    wings.push({ pivot, side });
  }
  root.add(body);
  root.scale.setScalar(scale);
  bakeBoxes(root);
  return { root, wings, body, legs };
}

function buildHen() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const RUST = '#b5683a';
  body.add(box(0.7, 0.62, 0.95, RUST, 0, 0.62, 0));
  body.add(box(0.56, 0.3, 0.7, '#e8c9a0', 0, 0.42, 0.12));
  const head = new THREE.Group();
  head.position.set(0, 1.1, 0.5);
  head.add(box(0.36, 0.36, 0.36, RUST, 0, 0, 0));
  head.add(box(0.12, 0.2, 0.2, '#d02838', 0, 0.26, 0.02));
  head.add(box(0.12, 0.14, 0.14, '#d02838', 0, 0.2, 0.15));
  head.add(box(0.16, 0.12, 0.2, '#f0b030', 0, -0.04, 0.26));
  head.add(box(0.1, 0.16, 0.08, '#d02838', 0, -0.2, 0.2));
  for (const side of [-1, 1]) {
    head.add(box(0.07, 0.07, 0.04, '#15151a', side * 0.12, 0.06, 0.19));
    head.add(box(0.14, 0.04, 0.05, '#15151a', side * 0.12, 0.13, 0.2)).rotation.z = side * 0.5;
  }
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.9, -0.5);
  for (const lean of [-0.5, 0, 0.5]) {
    const feather = box(0.14, 0.5, 0.1, lean === 0 ? '#7a4220' : '#8c4e28', 0, 0.2, 0);
    feather.rotation.z = lean;
    tail.add(feather);
  }
  body.add(tail);
  for (const side of [-1, 1]) {
    body.add(box(0.1, 0.5, 0.12, '#f0b030', side * 0.2, 0.25, 0.05));
    body.add(box(0.22, 0.05, 0.28, '#f0b030', side * 0.2, 0.03, 0.12));
    body.add(box(0.1, 0.34, 0.6, '#9a5430', side * 0.38, 0.62, 0));
  }
  root.add(body);
  root.scale.setScalar(1.8);
  bakeBoxes(root);
  return { root, body, head, wings: [] };
}

function buildFarmer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.8, 0);
    pivot.add(box(0.26, 0.8, 0.28, '#3a4a78', 0, -0.4, 0));
    pivot.add(box(0.28, 0.12, 0.4, '#4a2e1a', 0, -0.82, 0.06));
    body.add(pivot);
    legs.push(pivot);
  }
  body.add(box(0.7, 0.8, 0.4, '#b8b030', 0, 1.2, 0));
  body.add(box(0.7, 0.36, 0.42, '#3a4a78', 0, 0.94, 0));
  body.add(box(0.1, 0.5, 0.42, '#3a4a78', -0.22, 1.35, 0));
  body.add(box(0.1, 0.5, 0.42, '#3a4a78', 0.22, 1.35, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.85, 0);
  head.add(box(0.46, 0.46, 0.46, '#e0a878', 0, 0, 0));
  head.add(box(0.07, 0.07, 0.04, '#15151a', -0.11, 0.04, 0.24));
  head.add(box(0.07, 0.07, 0.04, '#15151a', 0.11, 0.04, 0.24));
  head.add(box(0.28, 0.12, 0.05, '#7a4a2a', 0, -0.13, 0.24));
  head.add(box(0.92, 0.07, 0.92, '#e8cc60', 0, 0.26, 0));
  head.add(box(0.5, 0.22, 0.5, '#e8cc60', 0, 0.38, 0));
  head.add(box(0.52, 0.06, 0.52, '#c03030', 0, 0.3, 0));
  body.add(head);
  body.add(box(0.2, 0.55, 0.22, '#b8b030', -0.45, 1.25, 0));
  const arm = new THREE.Group();
  arm.position.set(0.45, 1.5, 0);
  arm.add(box(0.2, 0.6, 0.22, '#b8b030', 0, -0.25, 0.05));
  const hoe = new THREE.Group();
  hoe.position.set(0, -0.5, 0.08);
  hoe.add(box(0.09, 0.09, 2.0, '#8a5a30', 0, 0, 0.6));
  hoe.add(box(0.5, 0.36, 0.08, '#9aa0a8', 0, -0.18, 1.55));
  hoe.add(box(0.5, 0.06, 0.12, '#c8ccd0', 0, -0.36, 1.55));
  arm.add(hoe);
  body.add(arm);
  root.add(body);
  root.scale.setScalar(1.9);
  bakeBoxes(root);
  return { root, body, legs, head, arm };
}

function buildHedgehog() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const spikes = new THREE.Group();
  const BROWN = '#7a5a3a';
  const DARK = '#3a2a1c';
  body.add(box(0.8, 0.5, 1.1, '#c8a070', 0, 0.3, 0.05));
  body.add(box(0.36, 0.3, 0.42, '#e0c090', 0, 0.28, 0.66));
  body.add(box(0.1, 0.1, 0.1, '#15151a', 0, 0.3, 0.9));
  for (const side of [-1, 1]) {
    body.add(box(0.07, 0.07, 0.05, '#15151a', side * 0.12, 0.42, 0.82));
    body.add(box(0.16, 0.14, 0.1, '#c8a070', side * 0.2, 0.52, 0.55));
  }
  for (const side of [-1, 1]) for (const front of [-1, 1]) body.add(box(0.16, 0.16, 0.2, DARK, side * 0.28, 0.08, front * 0.4));
  // The back is a mat of spikes: dark and brown shafts pointing back and up.
  let index = 0;
  for (let row = 0; row < 6; row++) {
    for (let column = -2; column <= 2; column++) {
      const spike = box(0.1, 0.08, 0.5, index++ % 2 === 0 ? DARK : BROWN, column * 0.16, 0.62 + (row % 2) * 0.04, 0.35 - row * 0.2);
      spike.rotation.set(-0.5 + row * 0.05, column * 0.12, 0);
      spikes.add(spike);
    }
  }
  body.add(spikes);
  root.add(body);
  root.scale.setScalar(2.1);
  bakeBoxes(root);
  return { root, body, spikes };
}

function buildBadger() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const GREY = '#6e6e78';
  body.add(box(0.95, 0.7, 1.5, GREY, 0, 0.55, 0));
  body.add(box(0.5, 0.06, 1.2, '#c8c8c0', 0, 0.92, 0));
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.95);
  head.add(box(0.6, 0.5, 0.62, GREY, 0, 0, 0));
  head.add(box(0.16, 0.5, 0.64, '#f2f2ec', 0, 0.02, 0.02));
  head.add(box(0.22, 0.24, 0.4, '#2a2a30', 0, -0.1, 0.42));
  head.add(box(0.12, 0.1, 0.1, '#15151a', 0, -0.02, 0.64));
  for (const side of [-1, 1]) {
    head.add(box(0.1, 0.08, 0.05, '#15151a', side * 0.2, 0.12, 0.32));
    head.add(box(0.14, 0.16, 0.1, '#2a2a30', side * 0.27, 0.32, -0.1));
  }
  const jaw = box(0.4, 0.12, 0.5, '#2a2a30', 0, -0.28, 0.3);
  head.add(jaw);
  body.add(head);
  for (const side of [-1, 1]) for (const front of [-1, 1]) {
    body.add(box(0.26, 0.3, 0.3, '#2a2a30', side * 0.4, 0.15, front * 0.5));
    for (const claw of [-1, 0, 1]) body.add(box(0.05, 0.05, 0.22, '#e8e0cc', side * 0.4 + claw * 0.08, 0.04, front * 0.5 + 0.22));
  }
  body.add(box(0.3, 0.3, 0.3, GREY, 0, 0.5, -0.85));
  root.add(body);
  const mound = box(1.6, 0.5, 2.0, '#7a5a3a', 0, 0.2, 0);
  root.scale.setScalar(2.2);
  bakeBoxes(root, [jaw]);
  return { root, body, head, jaw, mound };
}

// A red riding mower with a driver, a yellow cutting deck up front and grass flying off both sides of the deck (the green
// cubes in `spray`, animated while it drives).
function buildMower() {
  const root = new THREE.Group();
  const RED = '#e02d2d';
  const DARK_RED = '#a81c22';
  const BLACK = '#2a2a30';
  root.add(box(1.5, 0.75, 1.9, RED, 0, 1.0, -0.35));
  root.add(box(1.2, 0.55, 1.1, RED, 0, 0.95, 0.85));
  root.add(box(1.24, 0.14, 1.14, DARK_RED, 0, 0.62, 0.85));
  root.add(box(0.4, 0.06, 0.9, '#f4e8cc', 0, 1.25, 0.85));
  root.add(box(0.9, 0.34, 0.08, BLACK, 0, 0.95, 1.43));
  for (const side of [-1, 1]) root.add(box(0.2, 0.14, 0.08, '#f8f0c0', side * 0.45, 1.05, 1.45));
  root.add(box(0.8, 0.14, 0.8, BLACK, 0, 1.45, -0.6));
  root.add(box(0.8, 0.6, 0.12, BLACK, 0, 1.8, -1.05));
  root.add(box(0.5, 0.6, 0.34, '#3a6ea8', 0, 1.78, -0.62));
  root.add(box(0.34, 0.34, 0.34, '#e0a878', 0, 2.25, -0.6));
  root.add(box(0.4, 0.1, 0.4, '#e8cc60', 0, 2.5, -0.6));
  root.add(box(0.4, 0.05, 0.14, '#e8cc60', 0, 2.46, -0.33));
  root.add(box(0.1, 0.7, 0.1, '#3a3a40', 0, 1.7, 0.2));
  root.add(box(0.7, 0.07, 0.07, '#3a3a40', 0, 2.05, 0.2));
  root.add(box(0.12, 0.9, 0.12, '#5a5a62', 0.55, 1.75, -0.2));
  const wheels = [];
  for (const [x, z, size] of [[-0.95, -0.7, 0.95], [0.95, -0.7, 0.95], [-0.8, 1.0, 0.6], [0.8, 1.0, 0.6]]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, size / 2, z);
    wheel.add(box(0.36, size, size, '#1a1a1e', 0, 0, 0));
    wheel.add(box(0.38, size * 0.45, size * 0.45, '#e8c030', 0, 0, 0));
    root.add(wheel);
    wheels.push(wheel);
  }
  root.add(box(2.4, 0.2, 1.1, '#e8c030', 0, 0.35, 1.9));
  root.add(box(2.5, 0.3, 0.1, '#a88820', 0, 0.4, 2.42));
  const spray = new THREE.Group();
  const GREENS = ['#6fae3c', '#8cc84b', '#4f8f2e', '#a6d65a'];
  for (let index = 0; index < 16; index++) {
    const piece = box(0.2, 0.12, 0.2, GREENS[index % 4]);
    piece.userData = { side: index % 2 === 0 ? -1 : 1, phase: index / 16 };
    piece.visible = false;
    spray.add(piece);
  }
  root.add(spray);
  root.scale.setScalar(1.6);
  bakeBoxes(root, spray.children, true);
  return { root, wheels, spray };
}

export class Opponents {
  constructor(hazards) {
    this.hazards = hazards;
    this.heightfields = hazards.heightfields;
    this.group = hazards.group;
    this.random = createRandom(RUN_SEED + 11);
    this.list = [];
    this.stats = { spawned: {}, eaten: {} };
    this.swarmCount = 0;
  }

  ground(x, z) {
    return this.heightfields.groundHeight(x, z);
  }

  // ---- Shared helpers ------------------------------------------------------------------------------------------------------

  // A worm at the edge of the swarm, the one a bird or hen goes for: of a few at random, the one farthest from the middle.
  edgeWorm(swarm) {
    let best = -1;
    let bestDistance = -1;
    const samples = Math.min(swarm.count, 24);
    for (let sample = 0; sample < samples; sample++) {
      const worm = swarm.count <= 24 ? sample : this.random.int(swarm.count);
      const distance = Math.hypot(swarm.x[worm * 20] - swarm.centroid.x, swarm.z[worm * 20] - swarm.centroid.z);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = worm;
      }
    }
    return best;
  }

  // Takes every worm with its head within radius of the point, up to a limit. Returns how many.
  killWithin(swarm, x, z, radius, limit, cause, time, dustColor = WORM_DARK) {
    let killed = 0;
    for (let worm = swarm.count - 1; worm >= 0 && killed < limit; worm--) {
      if (Math.hypot(swarm.x[worm * 20] - x, swarm.z[worm * 20] - z) > radius) continue;
      if (this.hazards.killWorm(swarm, worm, time, WORM_DARK, false, dustColor, 4, cause)) killed += 1;
    }
    return killed;
  }

  // Heads on a spot; a lunging swarm bites twice as hard.
  crowd(swarm, x, z, radius) {
    return swarm.headsWithin(x, z, radius) * (swarm.lungeLevel > 0 ? 2 : 1);
  }

  parry(opponent, time, x, z) {
    this.hazards.emit(time, 'parry', x, z, 0);
    announce('parry', { attacker: opponent.kind, x, z });
    this.hazards.specks.burst(x, this.ground(x, z) + 0.8, z, 0xfff0b8, 10);
  }

  // The swarm took it: it bursts into meat.
  eat(opponent, time, foodKind, height) {
    const hazards = this.hazards;
    hazards.chunks.burst({ x: opponent.x, z: opponent.z }, foodKind, height);
    hazards.specks.burst(opponent.x, this.ground(opponent.x, opponent.z), opponent.z, 0xb88556, 8);
    hazards.emit(time, `${opponent.kind}-eaten`, opponent.x, opponent.z, 0);
    this.stats.eaten[opponent.kind] = (this.stats.eaten[opponent.kind] ?? 0) + 1;
    announce('opponent-eaten', { kind: opponent.kind });
    opponent.done = true;
  }

  place(point, x, z) {
    return { x: x + point.x, z: z + point.z };
  }

  makeShadow(color = 0x1a0a10) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, fog: false }));
    shadow.visible = false;
    shadow.renderOrder = 3;
    this.group.add(shadow);
    return shadow;
  }

  showShadow(shadow, x, z, grow, time, opacity = 0.65) {
    shadow.visible = true;
    shadow.position.set(x, this.ground(x, z) + 0.12, z);
    shadow.scale.setScalar((0.4 + 1.1 * grow) * (1 + 0.06 * Math.sin(time * 18)));
    shadow.material.opacity = 0.25 + (opacity - 0.25) * grow;
  }

  // ---- Spawning ----------------------------------------------------------------------------------------------------------

  spawn(kind, time, world, count) {
    this.stats.spawned[kind] = (this.stats.spawned[kind] ?? 0) + 1;
    const around = (distance, sideways) => ({ x: world.front.x + world.forward.x * distance + world.right.x * sideways, z: world.front.z + world.forward.z * distance + world.right.z * sideways });
    if (PECKERS[kind]) {
      const config = PECKERS[kind];
      const members = kind === 'hen' ? 1 + (count >= 150 ? 1 : 0) : kind === 'crows' ? clamp(3 + Math.floor(count / 150), 3, 6) : clamp(1 + Math.floor(count / 40), 1, 4);
      const side = this.random.next() < 0.5 ? -1 : 1;
      for (let index = 0; index < members; index++) {
        const start = around(config.flyer ? 14 + index : 16 + index * 1.5, side * (8 + index * 1.4));
        this.list.push(this.startPecker(kind, config, index, time, start, kind === 'birds' && index % 2 === 1));
      }
    } else if (kind === 'farmer') {
      const side = this.random.next() < 0.5 ? -1 : 1;
      this.list.push(this.startFarmer(time, around(16, side * 9)));
    } else if (kind === 'hedgehog') {
      const side = this.random.next() < 0.5 ? -1 : 1;
      this.list.push(this.startHedgehog(time, around(13, side * 6)));
    } else if (kind === 'badger') {
      const side = this.random.next() < 0.5 ? -1 : 1;
      this.list.push(this.startBadger(time, around(20, side * 8)));
    } else if (kind === 'mower') {
      this.list.push(this.startMower(time, world));
    }
  }

  // ---- Birds, crows and hens ---------------------------------------------------------------------------------------------

  startPecker(kind, config, index, time, start, alternate) {
    const model = kind === 'hen' ? buildHen() : kind === 'crows' ? buildSmallBird('#2a3452', '#3a4868', 2.2, '#c4c9d6', '#161c30', '#d8dff0') : alternate ? buildSmallBird('#3a3d48', '#5a5f70', 1.5, '#e8b830', '#2a2d38') : buildSmallBird('#7a5a40', '#e0703a', 1.5, '#f0b030', '#4a3626');
    this.group.add(model.root);
    const y = this.ground(start.x, start.z) + (config.flyer ? HOVER + 2 : 0);
    return {
      kind, config, model, root: model.root, state: 'approach', since: time, born: time, startAt: time + index * config.stagger, index,
      x: start.x, z: start.z, y, heading: 0, aimX: start.x, aimZ: start.z, pecksLeft: config.pecks, shadow: this.makeShadow(), warned: false,
      trackTimer: 0, eta: null, done: false, checkAt: 0, lying: 0,
    };
  }

  stepPecker(time, dt, o, world) {
    const swarm = world.swarm;
    const config = o.config;
    const age = time - o.since;
    o.eta = null;
    if (swarm.count === 0 && o.state !== 'leave') this.leave(o, time);
    if (time < o.startAt) {
      this.posePecker(time, o, 0.4);
      return;
    }
    if (o.state === 'approach' || o.state === 'warn') {
      this.trackAim(o, swarm, dt, o.state === 'warn' && age > config.warn - 0.25);
    }
    let flap = 0.5;
    if (o.state === 'approach') {
      const hoverY = this.ground(o.aimX, o.aimZ) + (config.flyer ? HOVER : 0);
      const toX = o.aimX - o.x;
      const toZ = o.aimZ - o.z;
      const distance = Math.hypot(toX, toZ);
      const stop = config.flyer ? 0.6 : 2.2;
      if (distance > stop) {
        o.heading = turnToward(o.heading, Math.atan2(toX, toZ), dt * 8);
        const speed = config.speed * Math.min(1, distance / 2 + 0.3);
        o.x += Math.sin(o.heading) * speed * dt;
        o.z += Math.cos(o.heading) * speed * dt;
      }
      o.y += (hoverY - o.y) * Math.min(1, dt * 3);
      if (distance <= stop + 0.4 && Math.abs(o.y - hoverY) < 0.8) {
        o.state = 'warn';
        o.since = time;
        if (o.index === 0) this.hazards.emit(time, `${config.cue}-warn`, o.x, o.z, 0);
      }
    } else if (o.state === 'warn') {
      const grow = smoothstep(0, config.warn, age);
      o.eta = config.warn - age;
      this.showShadow(o.shadow, o.aimX, o.aimZ, grow, time);
      // The bird hovers over the spot; a hen shuffles up to it and winds back.
      const toX = o.aimX - o.x;
      const toZ = o.aimZ - o.z;
      const distance = Math.hypot(toX, toZ);
      o.heading = turnToward(o.heading, Math.atan2(toX, toZ), dt * 8);
      if (distance > 1.0) {
        o.x += (toX / distance) * Math.min(distance, config.speed * 0.5 * dt * 2);
        o.z += (toZ / distance) * Math.min(distance, config.speed * 0.5 * dt * 2);
      }
      if (config.flyer) o.y = this.ground(o.x, o.z) + HOVER + 0.3 * Math.sin(time * 5);
      flap = config.flyer ? 0.7 : 0;
      if (age >= config.warn) {
        o.state = 'strike';
        o.since = time;
      }
    } else if (o.state === 'strike') {
      const targetY = this.ground(o.aimX, o.aimZ) + config.height * 0.4;
      const toX = o.aimX - o.x;
      const toZ = o.aimZ - o.z;
      const distance = Math.hypot(toX, toZ);
      const speed = config.flyer ? 20 : 12;
      const step = Math.min(distance, speed * dt);
      if (distance > 1e-3) {
        o.x += (toX / distance) * step;
        o.z += (toZ / distance) * step;
        o.heading = Math.atan2(toX, toZ);
      }
      o.y += (targetY - o.y) * Math.min(1, dt * 14);
      flap = -0.2;
      if (distance < 0.5 || age > 0.5) this.resolvePeck(time, o, swarm);
    } else if (o.state === 'perch' || o.state === 'stun') {
      o.y += (this.ground(o.x, o.z) + (o.state === 'stun' ? 0.1 : 0) - o.y) * Math.min(1, dt * 10);
      flap = 0;
      if (time >= o.checkAt) {
        o.checkAt = time + 0.15;
        const needed = o.state === 'stun' ? o.config.eatHeads * 0.6 : o.config.eatHeads;
        if (this.crowd(swarm, o.x, o.z, 2.2) >= needed) {
          this.eat(o, time, config.food, 0.7);
          return;
        }
      }
      if (o.state === 'stun' && age > 1.8) this.leave(o, time);
      else if (o.state === 'perch' && age > 0.9) {
        if (o.pecksLeft > 0) {
          o.pecksLeft -= 1;
          o.state = 'approach';
          o.since = time;
        } else {
          this.leave(o, time);
        }
      }
    } else if (o.state === 'leave') {
      const away = o.leaveHeading;
      o.heading = turnToward(o.heading, away, dt * 6);
      o.x += Math.sin(o.heading) * config.speed * 0.9 * dt;
      o.z += Math.cos(o.heading) * config.speed * 0.9 * dt;
      const climb = config.flyer ? 1 - Math.exp(-age * 2.2) : 0;
      o.y += ((this.ground(o.x, o.z) + (config.flyer ? 9 : 0)) - o.y) * Math.min(1, dt * 2 * (0.2 + climb));
      flap = 0.6;
      if (age > 3.2) o.done = true;
    }
    this.posePecker(time, o, flap);
  }

  leave(o, time) {
    o.state = 'leave';
    o.since = time;
    o.shadow.visible = false;
    o.leaveHeading = o.heading + this.random.range(-0.6, 0.6) + (this.random.next() < 0.5 ? 0 : Math.PI);
  }

  // The aim follows the worm it is after until the last moment, so the shadow marks where the peck will land.
  trackAim(o, swarm, dt, locked) {
    if (locked || swarm.count === 0) return;
    o.trackTimer -= dt;
    if (o.trackTimer > 0 && o.aimWorm !== undefined && o.aimWorm < swarm.count) {
      const slot = o.aimWorm * 20;
      if (Math.hypot(swarm.x[slot] - o.aimX, swarm.z[slot] - o.aimZ) < 1.5) {
        o.aimX = swarm.x[slot];
        o.aimZ = swarm.z[slot];
        return;
      }
    }
    o.trackTimer = 0.2;
    const near = this.hazards.nearestWorm(swarm, o.aimX, o.aimZ, 6);
    o.aimWorm = near >= 0 ? near : this.edgeWorm(swarm);
    if (o.aimWorm >= 0) {
      o.aimX = swarm.x[o.aimWorm * 20];
      o.aimZ = swarm.z[o.aimWorm * 20];
    }
  }

  resolvePeck(time, o, swarm) {
    const outcome = this.hazards.attackOutcome();
    const kind = o.config.cue;
    o.shadow.visible = false;
    o.since = time;
    if (outcome === 'parry') {
      o.state = 'stun';
      o.lying = time;
      this.parry(o, time, o.x, o.z);
      return;
    }
    o.state = 'perch';
    if (outcome === 'miss') {
      this.hazards.emit(time, `${kind}-miss`, o.x, o.z, 0);
      return;
    }
    const victim = this.hazards.nearestWorm(swarm, o.aimX, o.aimZ, 2.0);
    const spot = this.hazards.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 4, kind);
    if (spot) this.hazards.emit(time, `${kind}-hit`, spot.x, spot.z, 1);
  }

  posePecker(time, o, flap) {
    const model = o.model;
    const ground = this.ground(o.x, o.z);
    o.root.position.set(o.x, o.config.flyer ? o.y : ground, o.z);
    o.root.rotation.order = 'YXZ';
    o.root.rotation.y = o.heading;
    const striking = o.state === 'strike';
    o.root.rotation.x = striking ? 0.8 : o.config.flyer && !(o.state === 'perch' || o.state === 'stun') ? 0.15 : 0;
    o.root.rotation.z = o.state === 'stun' ? 1.4 : 0;
    if (o.state === 'stun') o.root.position.y = ground + 0.35;
    const flying = o.config.flyer && o.state !== 'perch' && o.state !== 'stun';
    const beat = flying ? Math.sin(time * 26 + o.index) * flap : 0;
    // Wings: folded against the flanks on the ground, spread and beating in the air.
    o.spread = (o.spread ?? 0) + ((flying ? 1 : 0) - (o.spread ?? 0)) * 0.3;
    for (const wing of model.wings) {
      wing.pivot.scale.x = 0.3 + 0.7 * o.spread;
      wing.pivot.rotation.z = wing.side * (-0.5 + (0.65 + beat) * o.spread);
    }
    if (model.legs) {
      model.legs.visible = !flying;
      model.body.position.y += ((flying ? 0 : 0.34) - model.body.position.y) * 0.3;
    }
    if (!o.config.flyer) {
      // The hen bobs while it runs, winds its head back in the warning and thrusts it forward in the strike.
      const windup = o.state === 'warn' ? smoothstep(0, o.config.warn, time - o.since) : 0;
      model.head.position.z = 0.5 - 0.25 * windup + (striking ? 0.5 : 0);
      model.head.rotation.x = -0.4 * windup + (striking ? 0.9 : 0);
      model.body.position.y = o.state === 'approach' ? 0.08 * Math.abs(Math.sin(time * 14)) : 0;
    }
  }

  // ---- Farmer --------------------------------------------------------------------------------------------------------------

  startFarmer(time, start) {
    const model = buildFarmer();
    this.group.add(model.root);
    return {
      kind: 'farmer', model, root: model.root, state: 'walk', since: time, born: time, x: start.x, z: start.z, heading: 0, chopsLeft: 3,
      aimX: start.x, aimZ: start.z, ring: this.makeShadow(0x9a1a28), gait: 0, eta: null, done: false, warned: false, checkAt: 0, trackTimer: 0,
    };
  }

  stepFarmer(time, dt, o, world) {
    const swarm = world.swarm;
    const age = time - o.since;
    o.eta = null;
    let moving = 0;
    let arm = 0.5;
    let lying = 0;
    const near = swarm.count > 0 ? this.hazards.nearestWorm(swarm, o.x, o.z, 80) : -1;
    if (o.state !== 'leave' && near < 0) this.farmerLeave(o, time);
    if (o.state === 'walk') {
      const slot = near * 20;
      const toX = swarm.x[slot] - o.x;
      const toZ = swarm.z[slot] - o.z;
      const distance = Math.hypot(toX, toZ);
      o.heading = turnToward(o.heading, Math.atan2(toX, toZ), dt * 5);
      moving = 3.4;
      if (distance < 4.2) {
        o.state = 'raise';
        o.since = time;
        o.aimX = swarm.x[slot];
        o.aimZ = swarm.z[slot];
        this.hazards.emit(time, 'farmer-warn', o.x, o.z, 0);
      }
    } else if (o.state === 'raise') {
      const duration = 1.0;
      o.eta = duration - age;
      // The ring on the ground follows the worm and sets for the last third of a second.
      if (age < duration - 0.35 && near >= 0) {
        o.aimX += (swarm.x[near * 20] - o.aimX) * Math.min(1, dt * 5);
        o.aimZ += (swarm.z[near * 20] - o.aimZ) * Math.min(1, dt * 5);
      }
      o.heading = turnToward(o.heading, Math.atan2(o.aimX - o.x, o.aimZ - o.z), dt * 6);
      this.showShadow(o.ring, o.aimX, o.aimZ, smoothstep(0, duration, age) * 1.6, time, 0.7);
      arm = 0.5 - 3.0 * smoothstep(0, duration, age);
      if (age >= duration) {
        o.state = 'chop';
        o.since = time;
      }
    } else if (o.state === 'chop') {
      arm = -2.5 + 3.3 * smoothstep(0, 0.14, age);
      if (age >= 0.14) this.resolveChop(time, o, swarm);
    } else if (o.state === 'stuck') {
      arm = 0.8;
      if (this.crowd(swarm, o.x, o.z, 3.4) >= 40) {
        this.eat(o, time, 'villager', 2);
        return;
      }
      if (age > 0.9) {
        o.chopsLeft -= 1;
        if (o.chopsLeft <= 0) this.farmerLeave(o, time);
        else {
          o.state = 'walk';
          o.since = time;
        }
      }
    } else if (o.state === 'stun') {
      lying = smoothstep(0, 0.25, age);
      arm = 1.2;
      if (time >= o.checkAt) {
        o.checkAt = time + 0.15;
        if (this.crowd(swarm, o.x, o.z, 3.4) >= 14) {
          this.eat(o, time, 'villager', 2);
          return;
        }
      }
      if (age > 2.4) {
        o.chopsLeft -= 1;
        if (o.chopsLeft <= 0) this.farmerLeave(o, time);
        else {
          o.state = 'walk';
          o.since = time;
        }
      }
    } else if (o.state === 'leave') {
      moving = 3.8;
      if (age > 3.5) o.done = true;
    }
    if (o.state !== 'stuck' && o.state !== 'stun' && o.state !== 'leave' && o.state !== 'chop' && time >= o.checkAt) {
      o.checkAt = time + 0.25;
      if (this.crowd(swarm, o.x, o.z, 3.2) >= 55) {
        this.eat(o, time, 'villager', 2);
        return;
      }
    }
    if (moving > 0) {
      o.x += Math.sin(o.heading) * moving * dt;
      o.z += Math.cos(o.heading) * moving * dt;
    }
    o.gait += dt * moving * 2.4;
    const model = o.model;
    o.root.position.set(o.x, this.ground(o.x, o.z) + 0.5 * lying, o.z);
    o.root.rotation.y = o.heading;
    o.root.rotation.z = 1.4 * lying;
    model.arm.rotation.x = arm;
    model.legs.forEach((leg, index) => {
      leg.rotation.x = moving > 0 ? Math.sin(o.gait + index * Math.PI) * 0.7 : 0;
    });
  }

  farmerLeave(o, time) {
    o.state = 'leave';
    o.since = time;
    o.ring.visible = false;
    o.heading += Math.PI * 0.8;
  }

  resolveChop(time, o, swarm) {
    const outcome = this.hazards.attackOutcome();
    o.ring.visible = false;
    o.since = time;
    if (outcome === 'parry') {
      o.state = 'stun';
      this.parry(o, time, o.aimX, o.aimZ);
      return;
    }
    o.state = 'stuck';
    this.hazards.specks.burst(o.aimX, this.ground(o.aimX, o.aimZ), o.aimZ, DIRT, 10);
    if (outcome === 'miss') {
      this.hazards.emit(time, 'farmer-miss', o.aimX, o.aimZ, 0);
      return;
    }
    const killed = this.killWithin(swarm, o.aimX, o.aimZ, 2.4, Math.min(60, 6 + Math.floor(swarm.count / 15)), 'farmer', time);
    this.hazards.emit(time, 'farmer-chop', o.aimX, o.aimZ, killed);
  }

  // ---- Hedgehog ------------------------------------------------------------------------------------------------------------

  startHedgehog(time, start) {
    const model = buildHedgehog();
    this.group.add(model.root);
    return { kind: 'hedgehog', model, root: model.root, state: 'walk', since: time, born: time, x: start.x, z: start.z, heading: 0, rollsLeft: 3, rollOutcome: 'hit', lastHurt: 0, eta: null, done: false, spin: 0, checkAt: 0, hurtAt: 0 };
  }

  stepHedgehog(time, dt, o, world) {
    const swarm = world.swarm;
    const age = time - o.since;
    o.eta = null;
    this.swarmCount = swarm.count;
    const bigSwarm = swarm.count >= 300;
    let moving = 0;
    let bristle = 0.4;
    let curl = 0;
    const near = swarm.count > 0 ? this.hazards.nearestWorm(swarm, o.x, o.z, 80) : -1;
    if (o.state !== 'leave' && near < 0) {
      o.state = 'leave';
      o.since = time;
    }
    if (o.state === 'walk') {
      const slot = near * 20;
      const distance = Math.hypot(swarm.x[slot] - o.x, swarm.z[slot] - o.z);
      o.heading = turnToward(o.heading, Math.atan2(swarm.x[slot] - o.x, swarm.z[slot] - o.z), dt * 4);
      moving = 2.0;
      if (distance < 5.0 && !bigSwarm) {
        o.state = 'curl';
        o.since = time;
        o.aimX = swarm.x[slot];
        o.aimZ = swarm.z[slot];
        this.hazards.emit(time, 'hedgehog-warn', o.x, o.z, 0);
      }
    } else if (o.state === 'curl') {
      const duration = 0.9;
      o.eta = duration - age;
      bristle = 0.4 + 0.9 * smoothstep(0, duration, age);
      curl = smoothstep(0, duration, age);
      o.heading = turnToward(o.heading, Math.atan2(o.aimX - o.x, o.aimZ - o.z), dt * 8);
      if (age >= duration) {
        o.state = 'roll';
        o.since = time;
        o.rollOutcome = null;
      }
    } else if (o.state === 'roll') {
      bristle = 1.2;
      curl = 1;
      moving = 7.5;
      o.spin += dt * 20;
      // The first worm it touches decides the roll: a late dodge makes it miss, a timely one knocks it back.
      const touched = this.hazards.nearestWorm(swarm, o.x, o.z, 1.1);
      if (touched >= 0 && o.rollOutcome === null) {
        o.rollOutcome = this.hazards.attackOutcome();
        if (o.rollOutcome === 'parry') {
          o.state = 'rest';
          o.since = time;
          o.stunned = true;
          this.parry(o, time, o.x, o.z);
        } else if (o.rollOutcome === 'miss') {
          this.hazards.emit(time, 'hedgehog-miss', o.x, o.z, 0);
        }
      }
      if (o.rollOutcome === 'hit' && touched >= 0 && time - o.hurtAt > 0.18) {
        o.hurtAt = time;
        const victim = this.hazards.nearestWorm(swarm, o.x, o.z, 1.3);
        const spot = this.hazards.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 4, 'hedgehog');
        if (spot) this.hazards.emit(time, 'hedgehog-hit', spot.x, spot.z, 1);
      }
      if (age > 1.6 && o.state === 'roll') {
        o.state = 'rest';
        o.since = time;
        o.stunned = false;
      }
    } else if (o.state === 'rest') {
      curl = o.stunned ? 1 : 1 - smoothstep(0, 0.5, age);
      bristle = 0.8;
      if (age > (o.stunned ? 2.2 : 1.4)) {
        o.rollsLeft -= 1;
        o.state = o.rollsLeft <= 0 ? 'leave' : 'walk';
        o.since = time;
      }
    } else if (o.state === 'leave') {
      moving = 2.6;
      if (age > 3.5) o.done = true;
    }
    if (o.state !== 'roll' && o.state !== 'leave' && time >= o.checkAt) {
      o.checkAt = time + 0.2;
      const heads = swarm.headsWithin(o.x, o.z, 1.6);
      if (bigSwarm && heads >= 10) {
        this.eat(o, time, 'hedgehog', 0.8);
        return;
      }
      // Under 300 worms, the ones that bite the spikes get hurt.
      if (!bigSwarm && heads > 0 && time - o.lastHurt > 0.6) {
        o.lastHurt = time;
        const victim = this.hazards.nearestWorm(swarm, o.x, o.z, 1.6);
        const spot = this.hazards.killWorm(swarm, victim, time, WORM_DARK, false, WORM_DARK, 4, 'hedgehog');
        if (spot) this.hazards.emit(time, 'hedgehog-hit', spot.x, spot.z, 1);
        bristle = 1.3;
      }
    }
    if (moving > 0) {
      o.x += Math.sin(o.heading) * moving * dt;
      o.z += Math.cos(o.heading) * moving * dt;
    }
    const model = o.model;
    const ground = this.ground(o.x, o.z);
    o.root.position.set(o.x, ground + 0.2 * curl, o.z);
    o.root.rotation.order = 'YXZ';
    o.root.rotation.y = o.heading;
    o.root.rotation.x = o.state === 'roll' ? o.spin : 0.35 * curl * Math.sin(time * 30 * (o.state === 'curl' ? 1 : 0));
    model.spikes.scale.setScalar(bristle + 0.6);
    model.body.scale.set(1 + 0.15 * curl, 1 - 0.25 * curl, 1 - 0.3 * curl);
  }

  // ---- Badger ------------------------------------------------------------------------------------------------------------

  startBadger(time, start) {
    const model = buildBadger();
    this.group.add(model.root);
    this.group.add(model.mound);
    model.mound.position.set(start.x, this.ground(start.x, start.z) + 0.1, start.z);
    return { kind: 'badger', model, root: model.root, state: 'dig', since: time, born: time, x: start.x, z: start.z, heading: 0, hp: 3, bitesLeft: 3, aimX: start.x, aimZ: start.z, ring: this.makeShadow(0x3a2414), eta: null, done: false, dustAt: 0, checkAt: 0, warned: false };
  }

  stepBadger(time, dt, o, world) {
    const swarm = world.swarm;
    const age = time - o.since;
    const model = o.model;
    o.eta = null;
    const near = swarm.count > 0 ? this.hazards.nearestWorm(swarm, o.x, o.z, 90) : -1;
    let rise = 0; // 0 buried, 1 out of the ground
    let jawOpen = 0;
    let headUp = 0;
    let lying = 0;
    if (!o.warned) {
      o.warned = true;
      this.hazards.emit(time, 'badger-warn', o.x, o.z, 0);
    }
    if (near < 0 && o.state !== 'leave') {
      o.state = 'leave';
      o.since = time;
    }
    if (o.state === 'dig') {
      const slot = near * 20;
      const toX = swarm.x[slot] - o.x;
      const toZ = swarm.z[slot] - o.z;
      const distance = Math.hypot(toX, toZ);
      o.heading = turnToward(o.heading, Math.atan2(toX, toZ), dt * 4);
      o.x += Math.sin(o.heading) * 6.5 * dt;
      o.z += Math.cos(o.heading) * 6.5 * dt;
      if (time - o.dustAt > 0.12) {
        o.dustAt = time;
        this.hazards.specks.burst(o.x, this.ground(o.x, o.z), o.z, DIRT, 2);
      }
      if (distance < 3.0 || age > 6) {
        o.state = 'rise';
        o.since = time;
        o.aimX = swarm.x[slot];
        o.aimZ = swarm.z[slot];
        o.x = o.aimX - Math.sin(o.heading) * 1.4;
        o.z = o.aimZ - Math.cos(o.heading) * 1.4;
      }
    } else if (o.state === 'rise') {
      const duration = 0.9;
      o.eta = duration + 0.5 - age;
      rise = smoothstep(0, duration, age);
      this.showShadow(o.ring, o.aimX, o.aimZ, smoothstep(0, duration, age) * 1.7, time, 0.7);
      if (age >= duration) {
        o.state = 'windup';
        o.since = time;
      }
    } else if (o.state === 'windup') {
      // The head rises and the jaw opens for half a second: that is the bite coming.
      const duration = 0.5;
      rise = 1;
      o.eta = duration - age;
      headUp = smoothstep(0, duration, age);
      jawOpen = headUp;
      this.showShadow(o.ring, o.aimX, o.aimZ, 1.7, time, 0.7);
      if (age >= duration) this.resolveBite(time, o, swarm);
    } else if (o.state === 'bitten') {
      rise = 1;
      jawOpen = 1 - smoothstep(0, 0.3, age);
      if (age > 0.9) {
        o.bitesLeft -= 1;
        o.state = o.bitesLeft <= 0 ? 'leave' : 'windup';
        o.since = time;
        if (o.bitesLeft > 0 && near >= 0) {
          o.aimX = swarm.x[near * 20];
          o.aimZ = swarm.z[near * 20];
        }
      }
    } else if (o.state === 'stun') {
      rise = 1;
      lying = smoothstep(0, 0.25, age) * (o.hp <= 0 ? 1 : 0.5);
      if (age > (o.hp <= 0 ? 4 : 1.5)) {
        if (o.hp <= 0) o.state = 'leave';
        else o.state = 'windup';
        o.since = time;
      }
    } else if (o.state === 'leave') {
      rise = 1 - smoothstep(0, 1.0, age);
      o.x += Math.sin(o.heading) * 3 * dt * (1 - rise);
      o.z += Math.cos(o.heading) * 3 * dt * (1 - rise);
      if (age > 1.2) o.done = true;
    }
    if (rise > 0.5 && o.state !== 'leave' && time >= o.checkAt) {
      o.checkAt = time + 0.2;
      const heads = this.crowd(swarm, o.x, o.z, 4);
      const needed = o.hp <= 0 ? 12 : 70;
      if (heads >= needed) {
        this.eat(o, time, 'badger', 1.2);
        return;
      }
    }
    const ground = this.ground(o.x, o.z);
    o.root.visible = rise > 0.02;
    o.root.position.set(o.x, ground - 1.4 * (1 - rise) + 0.5 * lying, o.z);
    o.root.rotation.y = o.heading;
    o.root.rotation.z = 1.2 * lying;
    model.head.position.y = 0.62 + 0.35 * headUp;
    model.head.rotation.x = -0.5 * headUp;
    model.jaw.rotation.x = 0.55 * jawOpen;
    model.mound.visible = o.state === 'dig' || o.state === 'rise';
    model.mound.position.set(o.x, ground + 0.12, o.z);
    model.mound.rotation.y = o.heading;
    model.mound.scale.setScalar(o.state === 'rise' ? 1 + 0.4 * rise : 1);
  }

  resolveBite(time, o, swarm) {
    const outcome = this.hazards.attackOutcome();
    o.ring.visible = false;
    o.since = time;
    if (outcome === 'parry') {
      o.hp -= 1;
      o.state = 'stun';
      this.parry(o, time, o.x, o.z);
      return;
    }
    o.state = 'bitten';
    if (outcome === 'miss') {
      this.hazards.emit(time, 'badger-miss', o.aimX, o.aimZ, 0);
      return;
    }
    const killed = this.killWithin(swarm, o.aimX, o.aimZ, 2.8, Math.min(30, 6 + Math.floor(swarm.count / 30)), 'badger', time, DIRT);
    this.hazards.emit(time, 'badger-bite', o.aimX, o.aimZ, killed);
  }

  // ---- Lawnmower ---------------------------------------------------------------------------------------------------------

  startMower(time, world) {
    const model = buildMower();
    this.group.add(model.root);
    const tilt = this.random.range(-0.6, 0.6);
    let directionX = world.right.x * Math.cos(tilt) + world.forward.x * Math.sin(tilt);
    let directionZ = world.right.z * Math.cos(tilt) + world.forward.z * Math.sin(tilt);
    if (this.random.next() < 0.5) {
      directionX = -directionX;
      directionZ = -directionZ;
    }
    const centerX = world.front.x + world.forward.x * 5;
    const centerZ = world.front.z + world.forward.z * 5;
    // The lane: a pale strip with a red edge line on each side. While the mower drives, a dust line grows behind it.
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF_WIDTH * 2, 0.06, LANE_HALF_LENGTH * 2), new THREE.MeshBasicMaterial({ color: 0xf4dc9c, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    lane.renderOrder = 2;
    lane.rotation.y = Math.atan2(directionX, directionZ);
    lane.position.set(centerX, this.ground(centerX, centerZ) + 0.35, centerZ);
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xd8362b, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, LANE_HALF_LENGTH * 2), edgeMaterial);
      edge.position.x = side * (LANE_HALF_WIDTH - 0.15);
      edge.renderOrder = 3;
      lane.add(edge);
    }
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 1), new THREE.MeshBasicMaterial({ color: 0xa8935f, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    trail.renderOrder = 3;
    trail.visible = false;
    lane.add(trail);
    this.group.add(lane);
    model.root.visible = false;
    return {
      kind: 'mower', model, root: model.root, lane, state: 'warn', since: time, born: time, directionX, directionZ, centerX, centerZ,
      x: centerX - directionX * LANE_HALF_LENGTH, z: centerZ - directionZ * LANE_HALF_LENGTH, heading: Math.atan2(directionX, directionZ),
      killed: 0, outcome: null, dustAt: 0, eta: null, done: false, warned: false, trail,
    };
  }

  stepMower(time, dt, o, world) {
    const swarm = world.swarm;
    const age = time - o.since;
    o.eta = null;
    if (!o.warned) {
      o.warned = true;
      this.hazards.emit(time, 'mower-warn', o.centerX, o.centerZ, 0);
    }
    if (o.state === 'warn') {
      o.eta = MOWER_WARN - age;
      o.lane.material.opacity = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(time * 9));
      if (age >= MOWER_WARN) {
        o.state = 'drive';
        o.since = time;
        o.root.visible = true;
      }
    } else if (o.state === 'drive') {
      o.x += o.directionX * MOWER_SPEED * dt;
      o.z += o.directionZ * MOWER_SPEED * dt;
      o.lane.material.opacity = 0.3;
      const alongNow = (o.x - o.centerX) * o.directionX + (o.z - o.centerZ) * o.directionZ;
      o.trail.visible = true;
      o.trail.scale.z = Math.max(0.01, alongNow + LANE_HALF_LENGTH);
      o.trail.position.set(0, 0.02, (alongNow - LANE_HALF_LENGTH) / 2);
      if (time - o.dustAt > 0.1) {
        o.dustAt = time;
        this.hazards.specks.burst(o.x - o.directionX * 2.2, this.ground(o.x, o.z), o.z - o.directionZ * 2.2, DUST, 3);
      }
      // Worms under the deck go, up to a share of the swarm; a swarm that is flat in a dodge lets it pass over.
      const cap = 12 + Math.floor(0.2 * swarm.count);
      if (o.killed < cap) {
        for (let worm = swarm.count - 1; worm >= 0 && o.killed < cap; worm--) {
          if (Math.hypot(swarm.x[worm * 20] - o.x, swarm.z[worm * 20] - o.z) > LANE_HALF_WIDTH + 0.2) continue;
          if (o.outcome === null) {
            o.outcome = this.hazards.dodge.active ? 'miss' : 'hit';
            if (o.outcome === 'miss') this.hazards.emit(time, 'mower-miss', o.x, o.z, 0);
          }
          if (o.outcome !== 'hit') break;
          if (this.hazards.killWorm(swarm, worm, time, WORM_DARK, false, DUST, 5, 'mower')) o.killed += 1;
        }
      }
      const along = (o.x - o.centerX) * o.directionX + (o.z - o.centerZ) * o.directionZ;
      if (along > LANE_HALF_LENGTH + 4) o.done = true;
    }
    o.root.position.set(o.x, this.ground(o.x, o.z), o.z);
    o.root.rotation.y = o.heading;
    for (const wheel of o.model.wheels) wheel.rotation.x += dt * 14;
    // Grass thrown out of both sides of the deck: each cube arcs up and back once per third of a second.
    for (const piece of o.model.spray.children) {
      piece.visible = o.state === 'drive';
      const progress = (time * 3 + piece.userData.phase) % 1;
      piece.position.set(piece.userData.side * (1.3 + 1.4 * progress), 0.3 + 2.6 * progress * (1 - progress), 1.9 - 1.3 * progress);
      piece.scale.setScalar(1 - 0.5 * progress);
    }
    o.root.position.y += 0.04 * Math.sin(time * 40);
  }

  // ---- Loop --------------------------------------------------------------------------------------------------------------------

  cleanup(o) {
    this.group.remove(o.root);
    if (o.shadow) this.group.remove(o.shadow);
    if (o.ring) this.group.remove(o.ring);
    if (o.lane) this.group.remove(o.lane);
    if (o.model && o.model.mound) this.group.remove(o.model.mound);
  }

  step(time, dt, world) {
    this.swarmCount = world.swarm.count;
    for (const o of this.list) {
      if (o.done) continue;
      if (o.kind === 'birds' || o.kind === 'crows' || o.kind === 'hen') this.stepPecker(time, dt, o, world);
      else if (o.kind === 'farmer') this.stepFarmer(time, dt, o, world);
      else if (o.kind === 'hedgehog') this.stepHedgehog(time, dt, o, world);
      else if (o.kind === 'badger') this.stepBadger(time, dt, o, world);
      else if (o.kind === 'mower') this.stepMower(time, dt, o, world);
      if (o.done) this.cleanup(o);
    }
    this.list = this.list.filter((o) => !o.done);
  }

  // Attacks about to land, with the seconds left, for bots.
  incoming(time) {
    return this.list.filter((o) => o.eta !== null && o.eta > -0.1).map((o) => ({ kind: o.kind, x: o.aimX ?? o.x, z: o.aimZ ?? o.z, eta: o.eta }));
  }

  // The lawnmower lanes that are drawn now: a centre, a direction and a half width.
  lanes() {
    return this.list.filter((o) => o.kind === 'mower').map((o) => ({ x: o.centerX, z: o.centerZ, directionX: o.directionX, directionZ: o.directionZ, halfWidth: LANE_HALF_WIDTH, halfLength: LANE_HALF_LENGTH, driving: o.state === 'drive' }));
  }

  // Opponents the swarm is drawn to: a landed bird, a stunned farmer, a hedgehog it is big enough to eat.
  attractors() {
    const spots = [];
    for (const o of this.list) {
      const pecker = o.kind === 'birds' || o.kind === 'crows' || o.kind === 'hen';
      if (pecker && (o.state === 'perch' || o.state === 'stun')) spots.push({ x: o.x, z: o.z });
      else if (o.kind === 'farmer' && (o.state === 'stun' || o.state === 'stuck')) spots.push({ x: o.x, z: o.z });
      else if (o.kind === 'hedgehog' && this.swarmCount >= 300 && o.state !== 'roll') spots.push({ x: o.x, z: o.z });
      else if (o.kind === 'badger' && o.state === 'stun' && o.hp <= 0) spots.push({ x: o.x, z: o.z });
    }
    return spots;
  }
}
