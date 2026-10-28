import * as THREE from 'three';
import { SEGMENTS, MAX_WORMS } from './config.js';
import { smoothstep } from './random.js';
import { makeToonMaterial, addGlint } from './look.js';

const POINTS = SEGMENTS;
const ANCHOR_POINT = Math.round(POINTS * 0.58);
const RING = 6;
const VERTICES_PER_WORM = POINTS * RING;
export const WORM_RADIUS = 0.085;
const CLIMB_KNEE = 1.2;
// Snake motion: a slow lateral wave runs from the head to the tail, low and long, on top of the path the head took.
const WAVE_FREQUENCY = 0.4; // cycles per second
const WAVE_LENGTH = 2.8; // metres along the body
const WAVE_AMPLITUDE = 0.11; // metres
const SEGMENT_SPACING = 0.25;

// Body outline along the length: a rounded head, a full body, a long tapering tail.
const PROFILE = Array.from({ length: POINTS }, (_, point) => {
  if (point === 0) return 0.55;
  if (point === 1) return 0.88;
  const fromTail = POINTS - 1 - point;
  const taper = [0.22, 0.4, 0.6, 0.8, 0.93];
  return fromTail < taper.length ? taper[fromTail] : 1;
});

const RING_COSINE = Array.from({ length: RING }, (_, side) => Math.cos((side / RING) * 6.2832 + 0.5236));
const RING_SINE = Array.from({ length: RING }, (_, side) => Math.sin((side / RING) * 6.2832 + 0.5236));

const toLinear = (hex) => {
  const color = new THREE.Color(hex);
  return [color.r * 0.8, color.g * 0.8, color.b * 0.8];
};
const BELLY = toLinear('#d49a9c');
const FLANK = toLinear('#c0303f');
const BACK = toLinear('#8a1828');
// Small pale belly, wine flanks, dark back, worked out once per side of the ring (as for a worm lying level).
const SIDE_COLORS = RING_SINE.map((sine) => {
  const toFlank = smoothstep(-0.95, -0.35, sine);
  const toBack = smoothstep(0.1, 0.9, sine);
  return [0, 1, 2].map((channel) => {
    const flank = BELLY[channel] + (FLANK[channel] - BELLY[channel]) * toFlank;
    return flank + (BACK[channel] - flank) * toBack;
  });
});

// Each worm is one continuous tube: a ring of six vertices at every spine point, all drawn as a single dynamic mesh.
export class WormRenderer {
  constructor(swarm) {
    this.swarm = swarm;
    const vertexCount = MAX_WORMS * VERTICES_PER_WORM;
    this.positions = new Float32Array(vertexCount * 3);
    this.normals = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);
    this.spineX = new Float32Array(POINTS);
    this.spineY = new Float32Array(POINTS);
    this.spineZ = new Float32Array(POINTS);
    const indices = new Uint32Array(MAX_WORMS * (POINTS - 1) * RING * 6);
    let write = 0;
    for (let worm = 0; worm < MAX_WORMS; worm++) {
      for (let point = 0; point < POINTS - 1; point++) {
        for (let side = 0; side < RING; side++) {
          const nextSide = (side + 1) % RING;
          const a = worm * VERTICES_PER_WORM + point * RING + side;
          const b = worm * VERTICES_PER_WORM + point * RING + nextSide;
          const c = a + RING;
          const d = b + RING;
          indices.set([a, c, b, b, c, d], write);
          write += 6;
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    const material = addGlint(makeToonMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x4a0c18 }), 0.9);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.geometry = geometry;
  }

  // Spine: the simulated path (flat on the ground) plus 3D writhing. The tail stays down; the front third rears up and sways,
  // tilts toward the aim point, and dips when the head bites. Sideways and vertical waves run out of phase, per worm.
  buildSpine(worm, time) {
    const swarm = this.swarm;
    const base = worm * POINTS;
    const girth = swarm.girth[worm];
    const phase = swarm.phase[worm] * 6.2832;
    const reach = swarm.reach[worm];
    const bite = swarm.bite[worm];
    const aimX = swarm.aimX[worm];
    const aimZ = swarm.aimZ[worm];
    // Heights vary per worm. Most worms coil low; only a few outer ones (high reach and a high layer value) lift their front
    // half, and even those stay under about 0.8 m so no worm stands as a stick.
    const variety = 0.55 + 0.75 * ((phase * 7.31) % 1);
    const liftShare = smoothstep(0.5, 0.95, reach) * smoothstep(0.7, 0.92, swarm.layer[worm]);
    // In a heap most worms lie low and coil; only about one in eight keeps its head up.
    const heap = swarm.heap[worm];
    const heapCalm = 1 - heap * (variety > 1.2 ? 0.45 : 0.9);
    const rearHeight = (0.12 + 0.08 * reach + 0.42 * liftShare) * variety * heapCalm;
    // Each lifter leans toward the aim point, turned a little left or right so neighbours do not line up.
    const yaw = (((phase * 3.17) % 1) - 0.5) * 1.1;
    const aimCos = Math.cos(yaw);
    const aimSin = Math.sin(yaw);
    const leanX = aimX * aimCos - aimZ * aimSin;
    const leanZ = aimX * aimSin + aimZ * aimCos;
    const anchorSlot = base + ANCHOR_POINT;
    // A worm hanging on a wall or roof would stand as a vertical stick. Its climb is soft-capped per worm (so they top out at
    // different heights) and bent into a sideways S that grows with the climb, so a crowd reads as curved strands.
    let lowestY = Infinity;
    for (let point = 0; point < POINTS; point++) lowestY = Math.min(lowestY, swarm.y[base + point]);
    const climbCap = 1.5 + 1.0 * ((phase * 5.7) % 1);
    const swaySide = 0.6 + 0.5 * ((phase * 2.3) % 1);
    for (let point = 0; point < POINTS; point++) {
      const slot = base + point;
      const along = point / (POINTS - 1);
      const before = Math.max(point - 1, 0);
      const after = Math.min(point + 1, POINTS - 1);
      let tangentX = swarm.x[base + before] - swarm.x[base + after];
      let tangentZ = swarm.z[base + before] - swarm.z[base + after];
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ) + 1e-6;
      tangentX /= tangentLength;
      tangentZ /= tangentLength;
      const rear = smoothstep(0.68, 0.0, along);
      const rawClimb = swarm.y[slot] - lowestY;
      // Up to about a metre the body simply rests on what it crosses (logs, rocks, bales); only a wall is soft-capped.
      const climb = rawClimb <= CLIMB_KNEE ? rawClimb : CLIMB_KNEE + (climbCap - CLIMB_KNEE) * Math.tanh((rawClimb - CLIMB_KNEE) / (climbCap - CLIMB_KNEE));
      const climbSway = Math.sin(phase * 1.3 + along * 3.2) * swaySide * smoothstep(0.3, 2.0, climb) * girth;
      const sway = 0.88 + 0.12 * Math.sin(time * 0.9 + phase);
      const bob = 0;
      const dip = bite * rearHeight * smoothstep(0.26, 0, along) * 1;
      // The very tip droops a little, so the lifted part is an arc (a swan neck) and not a pole.
      const droop = 1 - 0.3 * smoothstep(0.14, 0, along);
      const lift = Math.max(0, (rearHeight * rear * sway + bob * rear) * droop - dip);
      const envelope = Math.sin(Math.PI * (along * 0.9 + 0.05));
      const waveAngle = (2 * Math.PI * (point * SEGMENT_SPACING)) / WAVE_LENGTH - 2 * Math.PI * WAVE_FREQUENCY * time + phase;
      const writhe = Math.sin(waveAngle) * WAVE_AMPLITUDE * (0.35 + 0.65 * along) * girth * Math.min(1, envelope * 1.6) * (1 + 2.2 * heap);
      // Pull the rearing part back along the body (it keeps its length) and lean it toward the aim point. In a heap the
      // whole body is drawn in toward its middle, so it coils instead of trailing out as a strand.
      const contract = Math.min(0.3, 0.15 * lift * rear) + 0.7 * heap;
      // The head leans out further than the neck, so the rearing part curves like a swan's neck.
      const lean = Math.min(1.3, lift * (0.9 + 0.6 * smoothstep(0.5, 0, along)));
      let x = swarm.x[slot] + (swarm.x[anchorSlot] - swarm.x[slot]) * contract + leanX * lean;
      let z = swarm.z[slot] + (swarm.z[anchorSlot] - swarm.z[slot]) * contract + leanZ * lean;
      x -= tangentZ * writhe + aimZ * climbSway;
      z += tangentX * writhe + aimX * climbSway;
      this.spineX[point] = x;
      this.spineY[point] = lowestY + climb + lift;
      this.spineZ[point] = z;
    }
    if (heap > 0.05) this.flattenInHeap(heap);
    // Most worms in a heap lie flat in a spiral around their middle (heads of the few lifters stay up), so edge worms make a
    // low mat and never hang. Seen from a high camera a long body pointing at it reads as a hanging string.
    const coil = smoothstep(0.25, 0.7, heap) * (variety > 1.2 ? 0.5 : 1);
    if (coil > 0.01) this.coilSpine(worm, coil, phase, ANCHOR_POINT);
  }

  coilSpine(worm, amount, phase, anchor) {
    const centerX = this.spineX[anchor];
    const centerZ = this.spineZ[anchor];
    const centerY = this.spineY[anchor];
    const direction = worm % 2 === 0 ? 1 : -1;
    // Spiral with the head on the outside: radius shrinks along the body, each step about one segment long.
    let angle = phase;
    let radius = 0.55;
    for (let point = 0; point < POINTS; point++) {
      const coiledX = centerX + Math.cos(angle) * radius;
      const coiledZ = centerZ + Math.sin(angle) * radius;
      const coiledY = centerY + 0.02 * (POINTS - point) * 0.2;
      this.spineX[point] += (coiledX - this.spineX[point]) * amount;
      this.spineZ[point] += (coiledZ - this.spineZ[point]) * amount;
      this.spineY[point] += (coiledY - this.spineY[point]) * amount;
      angle += direction * SEGMENT_SPACING / Math.max(radius, 0.12);
      radius = Math.max(0.12, radius - 0.022);
    }
  }

  // Limits how steeply a worm in a heap can rise from its lowest point, so a pile reads as coils lying on each other and not as
  // strands hanging down the side. The lowest point stays put and the limit spreads outward along the body.
  flattenInHeap(heap) {
    const maxStep = 0.16 - 0.1 * heap;
    let lowest = 0;
    for (let point = 1; point < POINTS; point++) if (this.spineY[point] < this.spineY[lowest]) lowest = point;
    for (let point = lowest + 1; point < POINTS; point++) {
      this.spineY[point] = Math.min(this.spineY[point], this.spineY[point - 1] + maxStep);
    }
    for (let point = lowest - 1; point >= 0; point--) {
      this.spineY[point] = Math.min(this.spineY[point], this.spineY[point + 1] + maxStep);
    }
  }

  update(time) {
    const swarm = this.swarm;
    const { positions, normals, colors, spineX, spineY, spineZ } = this;
    for (let worm = 0; worm < swarm.count; worm++) {
      this.buildSpine(worm, time);
      const girth = swarm.girth[worm];
      const phase = swarm.phase[worm] * 6.2832;
      const tint = swarm.tint[worm];
      for (let point = 0; point < POINTS; point++) {
        const before = Math.max(point - 1, 0);
        const after = Math.min(point + 1, POINTS - 1);
        let tx = spineX[before] - spineX[after];
        let ty = spineY[before] - spineY[after];
        let tz = spineZ[before] - spineZ[after];
        const tangentLength = Math.sqrt(tx * tx + ty * ty + tz * tz) + 1e-6;
        tx /= tangentLength;
        ty /= tangentLength;
        tz /= tangentLength;
        // side = tangent x world up (horizontal); lift = side x tangent.
        let sideX = tz;
        let sideZ = -tx;
        const sideLength = Math.sqrt(sideX * sideX + sideZ * sideZ);
        if (sideLength < 1e-4) {
          sideX = 1;
          sideZ = 0;
        } else {
          sideX /= sideLength;
          sideZ /= sideLength;
        }
        const liftX = -ty * sideZ;
        const liftY = sideZ * tx - sideX * tz;
        const liftZ = ty * sideX;
        const liftLength = Math.sqrt(liftX * liftX + liftY * liftY + liftZ * liftZ) + 1e-6;
        const ux = liftX / liftLength;
        const uy = liftY / liftLength;
        const uz = liftZ / liftLength;
        const bulge = 1 + 0.04 * Math.sin(time * 1.6 - point * 0.5 + phase);
        const radius = WORM_RADIUS * girth * PROFILE[point] * bulge;
        const ringShade = (point % 3 === 0 ? 0.9 : 1) * tint;
        for (let side = 0; side < RING; side++) {
          const cosine = RING_COSINE[side];
          const sine = RING_SINE[side];
          const dirX = sideX * cosine + ux * sine;
          const dirY = uy * sine;
          const dirZ = sideZ * cosine + uz * sine;
          const vertex = (worm * VERTICES_PER_WORM + point * RING + side) * 3;
          positions[vertex] = spineX[point] + dirX * radius;
          positions[vertex + 1] = spineY[point] + dirY * radius;
          positions[vertex + 2] = spineZ[point] + dirZ * radius;
          normals[vertex] = dirX;
          normals[vertex + 1] = dirY;
          normals[vertex + 2] = dirZ;
          const sideColor = SIDE_COLORS[side];
          colors[vertex] = sideColor[0] * ringShade;
          colors[vertex + 1] = sideColor[1] * ringShade;
          colors[vertex + 2] = sideColor[2] * ringShade;
        }
      }
    }
    this.geometry.setDrawRange(0, swarm.count * (POINTS - 1) * RING * 6);
    // Upload only the vertices of the worms that exist, not the whole buffer sized for the cap.
    const uploaded = swarm.count * VERTICES_PER_WORM * 3;
    for (const name of ['position', 'normal', 'color']) {
      const attribute = this.geometry.attributes[name];
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, uploaded);
      attribute.needsUpdate = true;
    }
  }
}
