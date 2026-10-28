import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PLAY, SEED } from './config.js';
import { clamp, createRandom } from './random.js';
import { makeToonMaterial, addDitherDissolve } from './look.js';
import { insideBuilding } from './terrain.js';

const loader = new GLTFLoader();
const DISSOLVE_SECONDS = 0.25;

// Eating order is by distance and by how scared each kind is: villagers flee last (small radius) and live far away.
export const KINDS = {
  chicken: { url: 'models/cube-pets/animal-chick.glb', height: 0.95, walk: 0.8, run: 3.4, fleeRadius: 9, eatRadius: 0.75, wormGain: 0.045, wormBase: 2, clips: ['idle', 'walk', 'run'] },
  rabbit: { url: 'models/cube-pets/animal-bunny.glb', height: 1.15, walk: 1.0, run: 4.6, fleeRadius: 11, eatRadius: 0.75, wormGain: 0.055, wormBase: 2, clips: ['idle', 'walk', 'run'] },
  pig: { url: 'models/cube-pets/animal-hog.glb', height: 1.25, walk: 0.8, run: 3.2, fleeRadius: 8, eatRadius: 0.95, wormGain: 0.07, wormBase: 3, clips: ['idle', 'walk', 'run'] },
  deer: { url: 'models/cube-pets/animal-deer.glb', height: 2.0, walk: 1.2, run: 5.4, fleeRadius: 13, eatRadius: 1.0, wormGain: 0.08, wormBase: 4, clips: ['idle', 'walk', 'run'] },
  cow: { url: 'models/cube-pets/animal-cow.glb', height: 2.1, walk: 0.7, run: 2.6, fleeRadius: 7, eatRadius: 1.1, wormGain: 0.1, wormBase: 5, clips: ['idle', 'walk', 'run'] },
  villager: { url: 'models/blocky/character-%.glb', height: 2.0, walk: 1.0, run: 3.8, fleeRadius: 6, eatRadius: 0.9, wormGain: 0.13, wormBase: 6, clips: ['idle', 'walk', 'sprint'] },
};

const VILLAGER_NAMES = ['Tom', 'Mara', 'Ned', 'Ivy', 'Finn', 'Rosa', 'Ben', 'Elsie', 'Hugo', 'Nell', 'Otto', 'June'];

const POPULATION = [
  { kind: 'chicken', count: 7, home: [7, 13], radius: 3 },
  { kind: 'chicken', count: 9, home: [15, -3], radius: 5 },
  { kind: 'rabbit', count: 6, home: [6, 12], radius: 6 },
  { kind: 'rabbit', count: 8, home: [-14, 8], radius: 7 },
  { kind: 'pig', count: 7, home: [21, 2], radius: 4.5 },
  { kind: 'pig', count: 7, home: [-6, 1], radius: 5 },
  { kind: 'deer', count: 4, home: [-24, 12], radius: 5 },
  { kind: 'deer', count: 4, home: [26, -17], radius: 3.5 },
  { kind: 'cow', count: 8, home: [16, 1], radius: 5 },
  { kind: 'villager', count: 12, home: [-17, -9], radius: 7 },
  { kind: 'villager', count: 5, home: [72, 55], radius: 8 },
  { kind: 'villager', count: 3, home: [-70, -57], radius: 6 },
  { kind: 'cow', count: 6, home: [92, 66], radius: 7 },
  { kind: 'pig', count: 6, home: [58, 40], radius: 6 },
  { kind: 'chicken', count: 8, home: [70, 62], radius: 5 },
  { kind: 'pig', count: 5, home: [-66, -44], radius: 6 },
];

// Herds across the open world: one or two per 46 m region, drawn from a seeded random so the world is the same every run.
function wildHerds() {
  const random = createRandom(SEED + 500);
  const kinds = ['chicken', 'rabbit', 'rabbit', 'pig', 'deer', 'cow', 'pig', 'deer'];
  const herds = [];
  for (let regionZ = -92; regionZ <= 92; regionZ += 46) {
    for (let regionX = -92; regionX <= 92; regionX += 46) {
      if (Math.hypot(regionX, regionZ) < 30) continue;
      const herdCount = random.next() < 0.5 ? 2 : 1;
      for (let herd = 0; herd < herdCount; herd++) {
        const kind = random.pick(kinds);
        herds.push({ kind, count: 3 + random.int(4), home: [regionX + random.range(-18, 18), regionZ + random.range(-18, 18)], radius: random.range(3.5, 7) });
      }
    }
  }
  return herds;
}
const EVERYONE = [...POPULATION, ...wildHerds()];

const modelCache = new Map();
async function loadKind(url) {
  if (!modelCache.has(url)) modelCache.set(url, loader.loadAsync(url));
  return modelCache.get(url);
}

export class Creatures {
  constructor(heightfields, random) {
    this.heightfields = heightfields;
    this.random = random;
    this.group = new THREE.Group();
    this.list = [];
    this.eatenEvents = [];
    this.eatGap = 0; // seconds between two eats; the film raises it so each eat is its own moment, play keeps 0
    this.nextEatTime = 0;
    this.fleeScale = 1; // the film lowers this at the start so the lone worm can creep up on its first meal
  }

  async populate() {
    let villagerIndex = 0;
    for (const entry of EVERYONE) {
      const kind = KINDS[entry.kind];
      for (let index = 0; index < entry.count; index++) {
        const variant = entry.kind === 'villager' ? 'abcdefgh'[villagerIndex % 8] : '';
        const url = kind.url.replace('%', variant);
        const gltf = await loadKind(url);
        const name = entry.kind === 'villager' ? VILLAGER_NAMES[villagerIndex++ % VILLAGER_NAMES.length] : entry.kind;
        this.list.push(this.makeCreature(entry, kind, gltf, name));
      }
    }
  }

  makeCreature(entry, kind, gltf, name) {
    const random = this.random;
    const root = cloneSkinned(gltf.scene);
    const dissolve = {};
    const materials = new Map();
    root.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;
      if (!materials.has(node.material)) {
        const source = node.material;
        const material = makeToonMaterial({ map: source.map ?? null, color: source.color ? source.color.clone() : new THREE.Color(0xffffff) });
        if (kind.tint) material.color.multiply(new THREE.Color(kind.tint));
        addDitherDissolve(material, dissolve);
        materials.set(source, material);
      }
      node.material = materials.get(node.material);
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const scale = kind.height / (box.max.y - box.min.y);
    const holder = new THREE.Group();
    root.scale.setScalar(scale);
    root.position.y = -box.min.y * scale;
    holder.add(root);
    this.group.add(holder);

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clipName of kind.clips) {
      const clip = gltf.animations.find((candidate) => candidate.name === clipName);
      if (!clip) continue;
      actions[clipName] = mixer.clipAction(clip);
      actions[clipName].play();
      actions[clipName].setEffectiveWeight(0);
    }
    const angle = random.range(0, Math.PI * 2);
    const spread = random.range(0, entry.radius);
    const x = clamp(entry.home[0] + Math.cos(angle) * spread, PLAY.minX + 1.5, PLAY.maxX - 1.5);
    const z = clamp(entry.home[1] + Math.sin(angle) * spread, PLAY.minZ + 1.5, PLAY.maxZ - 1.5);
    return {
      name,
      kindName: Object.keys(KINDS).find((key) => KINDS[key] === kind),
      kind,
      home: entry.home,
      radius: entry.radius,
      holder,
      mixer,
      actions,
      dissolve,
      x,
      z,
      heading: random.range(0, Math.PI * 2),
      target: null,
      pause: random.range(0, 3),
      mode: 'idle',
      animTime: random.range(0, 5),
      eatenAt: -1,
      gone: false,
    };
  }

  blocked(x, z) {
    return insideBuilding(x, z, 0.7) || this.heightfields.isWater(x, z) || x < PLAY.minX + 1 || x > PLAY.maxX - 1 || z < PLAY.minZ + 1 || z > PLAY.maxZ - 1;
  }

  alive() {
    return this.list.filter((creature) => creature.eatenAt < 0).length;
  }

  step(time, dt, swarm) {
    this.eatenEvents.length = 0;
    for (const creature of this.list) {
      if (creature.gone) continue;
      // Far from the swarm a creature is not drawn and does not think, which keeps a big world cheap.
      const awayFromSwarm = Math.hypot(creature.x - swarm.front.x, creature.z - swarm.front.z);
      creature.active = awayFromSwarm < 90;
      creature.holder.visible = creature.active;
      if (!creature.active) continue;
      if (creature.eatenAt >= 0) {
        const progress = (time - creature.eatenAt) / DISSOLVE_SECONDS;
        creature.dissolve.set(clamp(progress, 0, 1));
        if (progress >= 1) {
          creature.gone = true;
          creature.holder.visible = false;
        }
        continue;
      }
      if (time >= this.nextEatTime && swarm.count > 0 && swarm.nearestHead(creature.x, creature.z, creature.kind.eatRadius * 1.7) < Infinity) {
        this.nextEatTime = time + this.eatGap;
        creature.eatenAt = time;
        this.eatenEvents.push(creature);
        continue;
      }
      this.think(creature, time, dt, swarm);
    }
  }

  think(creature, time, dt, swarm) {
    const kind = creature.kind;
    const random = this.random;
    let speed = 0;
    let wantedHeading = creature.heading;
    const threat = swarm.count > 0 ? swarm.nearestHead(creature.x, creature.z, kind.fleeRadius * 0.7 * this.fleeScale) : Infinity;
    if (threat < Infinity) {
      creature.mode = 'flee';
      let awayX = creature.x - swarm.nearestX;
      let awayZ = creature.z - swarm.nearestZ;
      // Pulled toward the open world centre so a creature near the rim does not freeze against it.
      awayX += (0 - creature.x) * 0.012;
      awayZ += (0 - creature.z) * 0.02;
      wantedHeading = Math.atan2(awayX, awayZ);
      speed = kind.run;
    } else {
      if (creature.mode === 'flee') {
        creature.mode = 'idle';
        creature.pause = random.range(0.5, 1.5);
      }
      if (creature.mode === 'idle') {
        creature.pause -= dt;
        if (creature.pause <= 0) {
          const angle = random.range(0, Math.PI * 2);
          const reach = random.range(1.5, creature.radius);
          creature.target = [creature.home[0] + Math.cos(angle) * reach, creature.home[1] + Math.sin(angle) * reach];
          creature.mode = 'walk';
        }
      } else if (creature.target) {
        const toX = creature.target[0] - creature.x;
        const toZ = creature.target[1] - creature.z;
        if (Math.hypot(toX, toZ) < 0.5) {
          creature.mode = 'idle';
          creature.pause = random.range(1.5, 5);
        } else {
          wantedHeading = Math.atan2(toX, toZ);
          speed = kind.walk;
        }
      }
    }
    let turn = wantedHeading - creature.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    creature.heading += clamp(turn, -dt * 7, dt * 7);
    if (speed > 0) {
      const nextX = creature.x + Math.sin(creature.heading) * speed * dt;
      const nextZ = creature.z + Math.cos(creature.heading) * speed * dt;
      if (this.blocked(nextX, nextZ)) {
        if (creature.mode !== 'flee') {
          creature.mode = 'idle';
          creature.pause = 0.3;
        } else {
          creature.heading += dt * 6;
        }
      } else {
        creature.x = nextX;
        creature.z = nextZ;
      }
    }
    creature.animTime += dt;
    creature.moveSpeed = speed;
  }

  applyPose() {
    for (const creature of this.list) {
      if (creature.gone || !creature.active) continue;
      const kind = creature.kind;
      const clipFor = creature.eatenAt >= 0 ? 'run' : creature.moveSpeed > kind.walk * 1.4 ? kind.clips[2] : creature.moveSpeed > 0.05 ? 'walk' : 'idle';
      for (const [name, action] of Object.entries(creature.actions)) action.setEffectiveWeight(name === clipFor || (clipFor === 'run' && name === kind.clips[2]) ? 1 : 0);
      creature.mixer.setTime(creature.animTime);
      const sink = creature.eatenAt >= 0 ? clamp(creature.dissolve.uniform.value, 0, 1) * 0.35 : 0;
      creature.holder.position.set(creature.x, this.heightfields.groundHeight(creature.x, creature.z) - sink, creature.z);
      creature.holder.rotation.y = creature.heading;
    }
  }
}

// Pixel specks thrown when a creature is swallowed: no blood, just coloured cubes that fall and vanish.
export class Specks {
  constructor(random, capacity = 360) {
    this.random = random;
    this.capacity = capacity;
    this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.particles = Array.from({ length: capacity }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.update(0);
  }

  burst(x, y, z, colorHex, amount) {
    for (let index = 0; index < amount; index++) {
      const particle = this.particles[this.cursor];
      const angle = this.random.range(0, Math.PI * 2);
      const outward = this.random.range(1, 3.6);
      Object.assign(particle, {
        life: this.random.range(0.45, 0.85),
        x,
        y: y + 0.5,
        z,
        vx: Math.cos(angle) * outward,
        vy: this.random.range(2.5, 5.5),
        vz: Math.sin(angle) * outward,
      });
      this.color.set(index % 3 === 0 ? 0x6a0d16 : colorHex);
      this.mesh.setColorAt(this.cursor, this.color);
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    for (let index = 0; index < this.capacity; index++) {
      const particle = this.particles[index];
      if (particle.life > 0) {
        particle.life -= dt;
        particle.vy -= 12 * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.z += particle.vz * dt;
      }
      const size = particle.life > 0 ? 1 : 0;
      this.matrix.makeScale(size, size, size).setPosition(particle.x, particle.y, particle.z);
      this.mesh.setMatrixAt(index, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
