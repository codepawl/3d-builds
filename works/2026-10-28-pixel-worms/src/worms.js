import * as THREE from 'three';
import { WORLD, PLAY, SEGMENTS, MAX_WORMS, WATER_LEVEL } from './config.js';
import { clamp, smoothstep } from './random.js';
import { WORM_RADIUS } from './worm-renderer.js';

export { WormRenderer } from './worm-renderer.js';

const POINTS = SEGMENTS;
const PILE_CELL = 1;
const PILE_X = Math.round((WORLD.maxX - WORLD.minX) / PILE_CELL) + 1;
const PILE_Z = Math.round((WORLD.maxZ - WORLD.minZ) / PILE_CELL) + 1;
const HASH_CELL = 2;
const HASH_X = Math.ceil((WORLD.maxX - WORLD.minX) / HASH_CELL) + 1;
const HASH_Z = Math.ceil((WORLD.maxZ - WORLD.minZ) / HASH_CELL) + 1;
export const TAKEN_X = Math.round((WORLD.maxX - WORLD.minX) / 0.5);
export const TAKEN_Z = Math.round((WORLD.maxZ - WORLD.minZ) / 0.5);
// A heap is a low mound: bodies drape over each other in layers and never stack into a tower.
const PILE_HEIGHT_PER_POINT = 0.008;
const PILE_HEIGHT_CAP = 1.1;
export const MAX_ATTRACTORS = 12;

export class WormSwarm {
  constructor(heightfields, random) {
    this.heightfields = heightfields;
    this.random = random;
    this.count = 0;
    const slots = MAX_WORMS * POINTS;
    this.x = new Float32Array(slots);
    this.y = new Float32Array(slots);
    this.z = new Float32Array(slots);
    this.previousX = new Float32Array(slots);
    this.previousZ = new Float32Array(slots);
    this.velocityX = new Float32Array(MAX_WORMS);
    this.velocityZ = new Float32Array(MAX_WORMS);
    this.segmentLength = new Float32Array(MAX_WORMS);
    this.phase = new Float32Array(MAX_WORMS);
    this.speedFactor = new Float32Array(MAX_WORMS);
    this.layer = new Float32Array(MAX_WORMS);
    this.girth = new Float32Array(MAX_WORMS);
    this.tint = new Float32Array(MAX_WORMS);
    this.leash = new Float32Array(MAX_WORMS);
    this.orbitAngle = new Float32Array(MAX_WORMS);
    this.orbitShare = new Float32Array(MAX_WORMS);
    this.reach = new Float32Array(MAX_WORMS); // 0 = low in the pile, 1 = rearing up toward the aim point
    this.bite = new Float32Array(MAX_WORMS); // 0..1, head dips when a chunk is within reach
    this.aimX = new Float32Array(MAX_WORMS);
    this.aimZ = new Float32Array(MAX_WORMS);
    this.belly = new Float32Array(MAX_WORMS); // play: 0 = empty, 1 = full enough to split (src/growth.js)
    this.cooldown = new Float32Array(MAX_WORMS); // seconds before this worm may split again
    this.hunger = new Float32Array(MAX_WORMS); // seconds spent with an empty belly
    this.pinch = new Float32Array(MAX_WORMS); // 0..1 while the worm pinches in two
    this.heap = new Float32Array(MAX_WORMS); // 0 = open ground, 1 = deep in a heap of worms (the renderer lays these low and coiled)
    this.limit = MAX_WORMS; // play lowers this (600 on desktop, 250 on phones); the film keeps the full cap
    this.attractors = []; // chunks of meat near the swarm: { x, z, footprint, top } (set by the app before each step)
    this.lungeLevel = 0; // 1 while a lunge is active (set by the app before each step); lungeSmooth follows it
    this.dodgeLevel = 0; // 1 while a dodge is active
    this.lungeSmooth = 0;
    this.dodgeSmooth = 0;
    this.spreadScale = 1; // the film widens the mass at the end so it covers ground
    this.speedScale = 1; // the film raises this for its sweep; play keeps 1
    this.front = { x: 0, z: 0, count: 0 };
    this.pileArea = { column0: PILE_X, column1: -1, row0: PILE_Z, row1: -1 };
    this.pileCount = new Float32Array(PILE_X * PILE_Z);
    this.pileHeight = new Float32Array(PILE_X * PILE_Z);
    this.hashStart = new Int32Array(HASH_X * HASH_Z + 1);
    this.hashItems = new Int32Array(MAX_WORMS);
    this.hashSumX = new Float32Array(HASH_X * HASH_Z);
    this.hashSumZ = new Float32Array(HASH_X * HASH_Z);
    this.taken = new Uint8Array(TAKEN_X * TAKEN_Z);
    this.colorsDirty = true;
    this.centroid = { x: 0, z: 0, spread: 0 };
    this.nearestX = 0;
    this.nearestZ = 0;
  }

  // ringRadius > 0 lays the worms out evenly on a ring, each one circling, so a small start reads as separate worms.
  spawn(centerX, centerZ, amount, ringRadius = 0, heading = null) {
    const random = this.random;
    const room = Math.max(0, Math.min(amount, this.limit - this.count));
    for (let made = 0; made < room; made++) {
      const worm = this.count++;
      const ringAngle = (made / room) * Math.PI * 2;
      const angle = heading !== null ? heading : ringRadius > 0 ? ringAngle + Math.PI / 2 + random.range(-0.4, 0.4) : random.range(0, Math.PI * 2);
      const offsetX = ringRadius > 0 ? Math.cos(ringAngle) * ringRadius : random.range(-0.9, 0.9);
      const offsetZ = ringRadius > 0 ? Math.sin(ringAngle) * ringRadius : random.range(-0.9, 0.9);
      const startX = clamp(centerX + offsetX, PLAY.minX + 1, PLAY.maxX - 1);
      const startZ = clamp(centerZ + offsetZ, PLAY.minZ + 1, PLAY.maxZ - 1);
      this.heap[worm] = 0;
      this.belly[worm] = 0;
      this.cooldown[worm] = 0;
      this.hunger[worm] = 0;
      this.pinch[worm] = 0;
      this.segmentLength[worm] = random.range(0.24, 0.26);
      this.leash[worm] = random.range(40, 110);
      this.orbitAngle[worm] = ringRadius > 0 ? ringAngle : random.range(0, Math.PI * 2);
      this.orbitShare[worm] = ringRadius > 0 ? 1 : random.next();
      this.phase[worm] = random.next();
      this.speedFactor[worm] = random.range(0.8, 1.25);
      this.layer[worm] = random.next();
      this.girth[worm] = heading !== null ? 1.5 : random.range(0.94, 1.1);
      this.tint[worm] = random.range(0.88, 1.12);
      this.velocityX[worm] = Math.cos(angle) * 1.5;
      this.velocityZ[worm] = Math.sin(angle) * 1.5;
      for (let point = 0; point < POINTS; point++) {
        const slot = worm * POINTS + point;
        this.x[slot] = this.previousX[slot] = startX - Math.cos(angle) * point * this.segmentLength[worm];
        this.z[slot] = this.previousZ[slot] = startZ - Math.sin(angle) * point * this.segmentLength[worm];
        this.y[slot] = this.heightfields.simHeight(this.x[slot], this.z[slot]) + WORM_RADIUS;
      }
    }
    this.colorsDirty = true;
    return room;
  }

  // Removes one worm (swap with the last), as when a predator or a trap takes it. Returns where its head was.
  remove(worm) {
    const last = this.count - 1;
    const headX = this.x[worm * POINTS];
    const headZ = this.z[worm * POINTS];
    if (worm !== last) {
      const perWorm = [this.velocityX, this.velocityZ, this.segmentLength, this.phase, this.speedFactor, this.layer, this.girth, this.tint, this.leash, this.orbitAngle, this.orbitShare, this.reach, this.bite, this.aimX, this.aimZ, this.heap, this.belly, this.cooldown, this.hunger, this.pinch];
      for (const array of perWorm) array[worm] = array[last];
      for (let point = 0; point < POINTS; point++) {
        const to = worm * POINTS + point;
        const from = last * POINTS + point;
        this.x[to] = this.x[from];
        this.y[to] = this.y[from];
        this.z[to] = this.z[from];
        this.previousX[to] = this.previousX[from];
        this.previousZ[to] = this.previousZ[from];
      }
    }
    this.count = last;
    this.colorsDirty = true;
    return { x: headX, z: headZ };
  }

  // Fission: the back half of the worm becomes a new worm, and the two crawl apart. Returns the new worm or -1 at the cap.
  split(parent) {
    if (this.count >= this.limit) return -1;
    const random = this.random;
    const child = this.count++;
    const perWorm = [this.velocityX, this.velocityZ, this.segmentLength, this.phase, this.speedFactor, this.layer, this.girth, this.tint, this.leash, this.orbitAngle, this.orbitShare, this.reach, this.bite, this.aimX, this.aimZ, this.heap];
    for (const array of perWorm) array[child] = array[parent];
    this.phase[child] = random.next();
    this.orbitAngle[child] = random.range(0, Math.PI * 2);
    this.orbitShare[child] = random.next();
    this.layer[child] = random.next();
    const parentBase = parent * POINTS;
    const childBase = child * POINTS;
    const cut = POINTS >> 1;
    const length = this.segmentLength[parent];
    for (let point = 0; point < POINTS; point++) {
      const to = childBase + point;
      const from = parentBase + Math.min(cut + point, POINTS - 1);
      this.x[to] = this.previousX[to] = this.x[from];
      this.y[to] = this.y[from];
      this.z[to] = this.previousZ[to] = this.z[from];
      if (cut + point >= POINTS) {
        // Past the old tail: carry on straight along the body's last direction.
        const last = to - 1;
        const beforeLast = Math.max(childBase, to - 2);
        const directionX = this.x[last] - this.x[beforeLast];
        const directionZ = this.z[last] - this.z[beforeLast];
        const norm = Math.hypot(directionX, directionZ) + 1e-5;
        this.x[to] = this.previousX[to] = this.x[last] + (directionX / norm) * length;
        this.z[to] = this.previousZ[to] = this.z[last] + (directionZ / norm) * length;
      }
    }
    // The pieces leave at an angle either side of the way the parent was going.
    const heading = Math.atan2(this.velocityZ[parent], this.velocityX[parent]);
    const side = random.next() < 0.5 ? -1 : 1;
    this.velocityX[child] = Math.cos(heading + side * 1.3) * 2.6;
    this.velocityZ[child] = Math.sin(heading + side * 1.3) * 2.6;
    this.velocityX[parent] += Math.cos(heading - side * 0.5) * 1.2;
    this.velocityZ[parent] += Math.sin(heading - side * 0.5) * 1.2;
    this.pinch[parent] = 0;
    this.pinch[child] = 0;
    this.colorsDirty = true;
    return child;
  }

  // Heads within radius of the point, written into out (worm indices) up to its limit. Returns how many were found.
  collectHeadsWithin(x, z, radius, out, limit) {
    const reach = Math.ceil(radius / HASH_CELL);
    const column0 = Math.floor((x - WORLD.minX) / HASH_CELL);
    const row0 = Math.floor((z - WORLD.minZ) / HASH_CELL);
    let found = 0;
    for (let row = row0 - reach; row <= row0 + reach && found < limit; row++) {
      for (let column = column0 - reach; column <= column0 + reach && found < limit; column++) {
        if (row < 0 || column < 0 || row >= HASH_Z || column >= HASH_X) continue;
        const cell = row * HASH_X + column;
        for (let item = this.hashStart[cell]; item < this.hashStart[cell + 1] && found < limit; item++) {
          const worm = this.hashItems[item];
          const slot = worm * POINTS;
          if (Math.hypot(this.x[slot] - x, this.z[slot] - z) <= radius) out[found++] = worm;
        }
      }
    }
    return found;
  }

  lengthen(amount) {
    for (let index = 0; index < amount; index++) {
      const worm = this.random.int(Math.max(1, this.count));
      this.segmentLength[worm] = Math.min(0.27, this.segmentLength[worm] + 0.003);
      this.girth[worm] = Math.min(1.2, this.girth[worm] + 0.012);
    }
  }

  pileAt(x, z) {
    const gx = clamp((x - WORLD.minX) / PILE_CELL, 0, PILE_X - 1.001);
    const gz = clamp((z - WORLD.minZ) / PILE_CELL, 0, PILE_Z - 1.001);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const index = iz * PILE_X + ix;
    const grid = this.pileHeight;
    const top = grid[index] + (grid[index + 1] - grid[index]) * fx;
    const bottom = grid[index + PILE_X] + (grid[index + PILE_X + 1] - grid[index + PILE_X]) * fx;
    return top + (bottom - top) * fz;
  }

  rebuildPile() {
    const counts = this.pileCount;
    counts.fill(0);
    const total = this.count * POINTS;
    const area = { column0: PILE_X, column1: -1, row0: PILE_Z, row1: -1 };
    for (let slot = 0; slot < total; slot++) {
      const column = clamp(Math.round((this.x[slot] - WORLD.minX) / PILE_CELL), 0, PILE_X - 1);
      const row = clamp(Math.round((this.z[slot] - WORLD.minZ) / PILE_CELL), 0, PILE_Z - 1);
      counts[row * PILE_X + column] += 1;
      if (column < area.column0) area.column0 = column;
      if (column > area.column1) area.column1 = column;
      if (row < area.row0) area.row0 = row;
      if (row > area.row1) area.row1 = row;
    }
    // Heights are blurred only where worms are now or were last time (everywhere else they are already zero).
    const last = this.pileArea;
    const column0 = Math.max(0, Math.min(area.column0, last.column0) - 1);
    const column1 = Math.min(PILE_X - 1, Math.max(area.column1, last.column1) + 1);
    const row0 = Math.max(0, Math.min(area.row0, last.row0) - 1);
    const row1 = Math.min(PILE_Z - 1, Math.max(area.row1, last.row1) + 1);
    this.pileArea = area;
    const heights = this.pileHeight;
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        let sum = 0;
        let weight = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = column + dx;
            const nz = row + dz;
            if (nx < 0 || nz < 0 || nx >= PILE_X || nz >= PILE_Z) continue;
            const w = dx === 0 && dz === 0 ? 4 : dx === 0 || dz === 0 ? 2 : 1;
            sum += counts[nz * PILE_X + nx] * w;
            weight += w;
          }
        }
        heights[row * PILE_X + column] = Math.min(PILE_HEIGHT_CAP, (sum / weight) * PILE_HEIGHT_PER_POINT);
      }
    }
  }

  rebuildHash() {
    const cells = HASH_X * HASH_Z;
    this.hashStart.fill(0);
    this.hashSumX.fill(0);
    this.hashSumZ.fill(0);
    const cellOf = new Int32Array(this.count);
    for (let worm = 0; worm < this.count; worm++) {
      const slot = worm * POINTS;
      const column = clamp(Math.floor((this.x[slot] - WORLD.minX) / HASH_CELL), 0, HASH_X - 1);
      const row = clamp(Math.floor((this.z[slot] - WORLD.minZ) / HASH_CELL), 0, HASH_Z - 1);
      const cell = row * HASH_X + column;
      cellOf[worm] = cell;
      this.hashStart[cell + 1] += 1;
      this.hashSumX[cell] += this.x[slot];
      this.hashSumZ[cell] += this.z[slot];
    }
    for (let cell = 0; cell < cells; cell++) this.hashStart[cell + 1] += this.hashStart[cell];
    const fill = this.hashStart.slice(0, cells);
    for (let worm = 0; worm < this.count; worm++) this.hashItems[fill[cellOf[worm]]++] = worm;
  }

  // Is any worm head within `radius` of the point? Returns the nearest head distance or Infinity.
  nearestHead(x, z, radius) {
    const reach = Math.ceil(radius / HASH_CELL);
    const column0 = Math.floor((x - WORLD.minX) / HASH_CELL);
    const row0 = Math.floor((z - WORLD.minZ) / HASH_CELL);
    let best = Infinity;
    for (let row = row0 - reach; row <= row0 + reach; row++) {
      for (let column = column0 - reach; column <= column0 + reach; column++) {
        if (row < 0 || column < 0 || row >= HASH_Z || column >= HASH_X) continue;
        const cell = row * HASH_X + column;
        for (let item = this.hashStart[cell]; item < this.hashStart[cell + 1]; item++) {
          const slot = this.hashItems[item] * POINTS;
          const distance = Math.hypot(this.x[slot] - x, this.z[slot] - z);
          if (distance < best) {
            best = distance;
            this.nearestX = this.x[slot];
            this.nearestZ = this.z[slot];
          }
        }
      }
    }
    return best <= radius ? best : Infinity;
  }

  // How many worm heads are within `radius` of the point (the more heads, the faster a chunk is eaten).
  headsWithin(x, z, radius) {
    const reach = Math.ceil(radius / HASH_CELL);
    const column0 = Math.floor((x - WORLD.minX) / HASH_CELL);
    const row0 = Math.floor((z - WORLD.minZ) / HASH_CELL);
    let found = 0;
    for (let row = row0 - reach; row <= row0 + reach; row++) {
      for (let column = column0 - reach; column <= column0 + reach; column++) {
        if (row < 0 || column < 0 || row >= HASH_Z || column >= HASH_X) continue;
        const cell = row * HASH_X + column;
        for (let item = this.hashStart[cell]; item < this.hashStart[cell + 1]; item++) {
          const slot = this.hashItems[item] * POINTS;
          if (Math.hypot(this.x[slot] - x, this.z[slot] - z) <= radius) found += 1;
        }
      }
    }
    return found;
  }

  step(time, dt, target) {
    if (this.count === 0) return;
    this.rebuildPile();
    this.rebuildHash();
    const heightfields = this.heightfields;
    let sumX = 0;
    let sumZ = 0;
    let frontX = 0;
    let frontZ = 0;
    let frontCount = 0;
    this.lungeSmooth += (this.lungeLevel - this.lungeSmooth) * Math.min(1, dt * 14);
    this.dodgeSmooth += (this.dodgeLevel - this.dodgeSmooth) * Math.min(1, dt * 12);
    const lunge = this.lungeSmooth;
    const dodge = this.dodgeSmooth;
    // A lunge pulls the swarm into a tight line toward the cursor; a dodge lets it spread out.
    const spread = (1.6 + 0.14 * Math.sqrt(this.count)) * this.spreadScale * (1 - 0.65 * lunge);
    const frameScale = dt * 30; // per-step constants below were tuned at 30 steps a second
    const settle = 1 - Math.pow(0.45, frameScale);
    const attractors = this.attractors;
    for (let worm = 0; worm < this.count; worm++) {
      const head = worm * POINTS;
      const headX = this.x[head];
      const headZ = this.z[head];
      // Each worm aims at its own spot around the cursor, so the swarm fans out into single worms instead of one blot.
      const orbit = this.orbitAngle[worm] + time * (worm % 2 === 0 ? 0.12 : -0.09);
      const orbitRadius = spread * Math.sqrt(this.orbitShare[worm]);
      const toTargetX = target.x + Math.cos(orbit) * orbitRadius - headX;
      const toTargetZ = target.z + Math.sin(orbit) * orbitRadius - headZ;
      const distance = Math.hypot(toTargetX, toTargetZ) + 1e-4;
      const directionX = toTargetX / distance;
      const directionZ = toTargetZ / distance;
      const phase = this.phase[worm] * 6.2832;

      // Speed: arrive slowly, slow down uphill (but still climb), slow in water.
      // Worms past their leash stop following the cursor and settle where they are, writhing over the land they took.
      const following = Math.max(lunge, 1 - smoothstep(this.leash[worm], this.leash[worm] + 10, distance));
      const arrive = smoothstep(0.3, 4.5, distance) * (1 - lunge) + lunge;
      let speed = 5.2 * (1 + 1.7 * lunge) * this.speedScale * this.speedFactor[worm] * arrive * following;
      const probeX = headX + directionX * 0.6;
      const probeZ = headZ + directionZ * 0.6;
      const slope =
        (heightfields.simHeight(probeX, probeZ) + this.pileAt(probeX, probeZ) - heightfields.simHeight(headX, headZ) - this.pileAt(headX, headZ)) / 0.6;
      speed /= 1 + Math.max(0, slope) * 0.9;
      speed *= 1 - 0.5 * this.pinch[worm];
      if (heightfields.groundHeight(headX, headZ) < WATER_LEVEL) speed *= 0.55;

      let desiredX = directionX * speed;
      let desiredZ = directionZ * speed;
      if (dodge > 0.01) {
        // Dodge: flatten and scatter away from the middle of the swarm.
        const awayX = headX - this.front.x + Math.cos(phase * 3) * 0.6;
        const awayZ = headZ - this.front.z + Math.sin(phase * 3) * 0.6;
        const awayLength = Math.hypot(awayX, awayZ) + 1e-4;
        desiredX = desiredX * (1 - 0.85 * dodge) + (awayX / awayLength) * 5.5 * dodge;
        desiredZ = desiredZ * (1 - 0.85 * dodge) + (awayZ / awayLength) * 5.5 * dodge;
      }

      // Heap spreading: slide off the top of tall piles so the heap becomes a mound with tendrils, not a needle.
      const pileGradientX = this.pileAt(headX + 0.5, headZ) - this.pileAt(headX - 0.5, headZ);
      const pileGradientZ = this.pileAt(headX, headZ + 0.5) - this.pileAt(headX, headZ - 0.5);
      desiredX -= pileGradientX * 3.2;
      desiredZ -= pileGradientZ * 3.2;

      // Pack cohesion: head toward the middle of the neighbourhood while far from the target.
      const cell =
        clamp(Math.floor((headZ - WORLD.minZ) / HASH_CELL), 0, HASH_Z - 1) * HASH_X + clamp(Math.floor((headX - WORLD.minX) / HASH_CELL), 0, HASH_X - 1);
      const neighbours = this.hashStart[cell + 1] - this.hashStart[cell];
      if (neighbours > 2) {
        const pull = 0.8 * smoothstep(1.5, 6, distance) * following;
        desiredX += (this.hashSumX[cell] / neighbours - headX) * pull;
        desiredZ += (this.hashSumZ[cell] / neighbours - headZ) * pull;
        // Crowded neighbourhood near the target: shove outward so the swarm floods the ground instead of stacking forever.
        const crowding = smoothstep(8, 40, neighbours) * 0.45;
        desiredX -= (this.hashSumX[cell] / neighbours - headX) * crowding;
        desiredZ -= (this.hashSumZ[cell] / neighbours - headZ) * crowding;
      }

      // Whole-swarm cohesion: a worm far from the front is drawn back to it, so the swarm stays one writhing mass.
      const fromFrontX = this.front.x - headX;
      const fromFrontZ = this.front.z - headZ;
      const fromFront = Math.hypot(fromFrontX, fromFrontZ) + 1e-4;
      const straying = smoothstep(spread * 1.1, spread * 3, fromFront) * following;
      desiredX += (fromFrontX / fromFront) * straying * 4.5;
      desiredZ += (fromFrontZ / fromFront) * straying * 4.5;

      // Chunks of meat: worms within a few metres are drawn to the nearest one and bite it.
      let chunkDistance = Infinity;
      let chunkX = 0;
      let chunkZ = 0;
      for (let index = 0; index < attractors.length; index++) {
        const attractor = attractors[index];
        const gap = Math.hypot(attractor.x - headX, attractor.z - headZ);
        if (gap < chunkDistance) {
          chunkDistance = gap;
          chunkX = attractor.x;
          chunkZ = attractor.z;
        }
      }
      let aimDirX = directionX;
      let aimDirZ = directionZ;
      if (chunkDistance < 9) {
        const pullToChunk = smoothstep(9, 2.5, chunkDistance) * 4.2 * (chunkDistance > 0.5 ? 1 : 0.2);
        aimDirX = (chunkX - headX) / (chunkDistance + 1e-4);
        aimDirZ = (chunkZ - headZ) / (chunkDistance + 1e-4);
        desiredX += aimDirX * pullToChunk;
        desiredZ += aimDirZ * pullToChunk;
      }
      // Rearing: worms at the outside of the mass rear up toward the aim point; the inside coils low in the pile.
      const outside = smoothstep(spread * 0.35, spread * 1.0, fromFront);
      const nearChunk = 1 - smoothstep(1.5, 6, chunkDistance);
      // Near a piece of meat a worm lies along it instead of rearing, so it can drape over it.
      const reachGoal = Math.min(1, 0.2 + 0.55 * outside * following) * (1 - dodge) * (1 - 0.8 * nearChunk);
      this.reach[worm] += (reachGoal - this.reach[worm]) * Math.min(1, dt * 1.6);
      const biteGoal = 1 - smoothstep(0.5, 1.4, chunkDistance);
      this.bite[worm] += (biteGoal - this.bite[worm]) * Math.min(1, dt * 2.4);
      // Coil: worms in a heap, and in a big swarm the ones that have settled near their spot, lie low and curl up. Worms still
      // travelling stay long. (Seen from a high camera, long worms pointing at it read as hanging strands.)
      const settled = smoothstep(40, 250, this.count) * (0.7 + 0.3 * (1 - smoothstep(2.5, 7, distance)));
      const coilGoal = Math.max(smoothstep(0.15, 0.7, this.pileAt(headX, headZ)), settled);
      this.heap[worm] += (coilGoal - this.heap[worm]) * Math.min(1, dt * 2);
      this.aimX[worm] = aimDirX;
      this.aimZ[worm] = aimDirZ;

      // Writhing: a lateral wave while travelling, a random wander at the target.
      const lateral = Math.sin(time * 0.95 + phase + worm * 0.37) * 0.9 * smoothstep(0.5, 5, distance);
      desiredX += -directionZ * lateral;
      desiredZ += directionX * lateral;
      const wander = 1.1 * (1 - smoothstep(1, 5, distance)) + 1.0 * (1 - following);
      desiredX += Math.cos(time * 0.7 + phase * 3 + worm) * wander;
      desiredZ += Math.sin(time * 0.8 + phase * 5 + worm * 1.3) * wander;

      const relax = Math.min(1, dt * (4.5 + 7 * lunge + 5 * dodge));
      this.velocityX[worm] += (desiredX - this.velocityX[worm]) * relax;
      this.velocityZ[worm] += (desiredZ - this.velocityZ[worm]) * relax;
      this.previousX[head] = headX;
      this.previousZ[head] = headZ;
      this.x[head] = clamp(headX + this.velocityX[worm] * dt, PLAY.minX, PLAY.maxX);
      this.z[head] = clamp(headZ + this.velocityZ[worm] * dt, PLAY.minZ, PLAY.maxZ);

      // Body: inertial drift, a travelling wave, then a fixed-length rope constraint back to the head.
      const length = this.segmentLength[worm];
      for (let point = 1; point < POINTS; point++) {
        const slot = head + point;
        this.previousX[slot] = this.x[slot];
        this.previousZ[slot] = this.z[slot];
        let nextX = this.x[slot];
        let nextZ = this.z[slot];
        const fromParentX = nextX - this.x[slot - 1];
        const fromParentZ = nextZ - this.z[slot - 1];
        const parentDistance = Math.hypot(fromParentX, fromParentZ) + 1e-5;
        nextX = this.x[slot - 1] + (fromParentX / parentDistance) * length;
        nextZ = this.z[slot - 1] + (fromParentZ / parentDistance) * length;
        this.x[slot] = nextX;
        this.z[slot] = nextZ;
      }

      // Heights: the terrain (with walls and roofs), plus the heap, plus a per-worm layer so heaps interleave.
      for (let point = 0; point < POINTS; point++) {
        const slot = head + point;
        const pile = this.pileAt(this.x[slot], this.z[slot]);
        const ground = Math.max(heightfields.simHeight(this.x[slot], this.z[slot]), WATER_LEVEL);
        const radius = WORM_RADIUS * this.girth[worm];
        const heapLift = this.layer[worm] * 0.22 * smoothstep(0.1, 0.9, pile);
        // Over a piece of meat the body climbs its dome, so the front half lies on it and nothing floats or sinks in.
        let bump = 0;
        if (chunkDistance < 5) {
          for (let index = 0; index < attractors.length; index++) {
            const attractor = attractors[index];
            if (!(attractor.footprint > 0)) continue;
            const across = Math.hypot(attractor.x - this.x[slot], attractor.z - this.z[slot]) / attractor.footprint;
            if (across < 1) bump = Math.max(bump, attractor.top * (1 - across * across));
          }
        }
        const targetY = ground + pile * 0.92 + radius + heapLift + bump;
        this.y[slot] += (targetY - this.y[slot]) * settle;
      }
      sumX += this.x[head];
      sumZ += this.z[head];
      if (distance < 16) {
        frontX += this.x[head];
        frontZ += this.z[head];
        frontCount += 1;
      }
    }
    this.centroid.x = sumX / this.count;
    this.centroid.z = sumZ / this.count;
    // The front is the worms actually following the cursor. The camera follows it, not the straggling tail.
    this.front.x = frontCount > 0 ? frontX / frontCount : this.centroid.x;
    this.front.z = frontCount > 0 ? frontZ / frontCount : this.centroid.z;
    this.front.count = frontCount;
    this.depositTrail();
  }

  depositTrail() {
    const taken = this.taken;
    const stride = 1;
    for (let worm = 0; worm < this.count; worm += stride) {
      for (let point = 0; point < POINTS; point += 3) {
        const slot = worm * POINTS + point;
        const column = Math.floor(((this.x[slot] - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * TAKEN_X);
        const row = Math.floor(((this.z[slot] - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * TAKEN_Z);
        if (column < 0 || row < 0 || column >= TAKEN_X || row >= TAKEN_Z) continue;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = column + dx;
            const cz = row + dz;
            if (cx < 0 || cz < 0 || cx >= TAKEN_X || cz >= TAKEN_Z) continue;
            const index = cz * TAKEN_X + cx;
            taken[index] = Math.min(255, taken[index] + (dx === 0 && dz === 0 ? 14 : 5));
          }
        }
      }
    }
  }
}

