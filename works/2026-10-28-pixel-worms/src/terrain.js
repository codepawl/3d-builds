import { obstacleLift } from './obstacles.js';
import * as THREE from 'three';
import { WORLD, GRID_STEP, WATER_LEVEL, SEED } from './config.js';
import { fractalNoise, smoothstep, clamp, lerp } from './random.js';
import { houses, houseGeometry, plazas, pond, paddock, fields, rocks, distanceToPaths, pondDepth } from './layout.js';

const GRID_X = Math.round((WORLD.maxX - WORLD.minX) / GRID_STEP) + 1;
const GRID_Z = Math.round((WORLD.maxZ - WORLD.minZ) / GRID_STEP) + 1;
const RAMP = 0.9; // horizontal run of the slope worms climb to reach a wall
const buildings = houses.map(houseGeometry);
const FLAT_PLACES = [[72, 55, 30], [-70, -56, 20], [96, 78, 14], [38, -34, 14]];

function baseHeightAt(x, z) {
  let height = (fractalNoise(x * 0.07, z * 0.07, SEED, 3) - 0.45) * 2.6;
  height += (fractalNoise(x * 0.25, z * 0.25, SEED + 5, 2) - 0.5) * 0.35;
  // Rolling hills that grow away from the starting meadow.
  const hill = (fractalNoise(x * 0.022, z * 0.022, SEED + 31, 3) - 0.45) * 14;
  height += (hill > 0 ? hill : hill * 0.25) * smoothstep(25, 70, Math.hypot(x, z));
  const villageBlend = 1 - smoothstep(9, 17, Math.hypot(x + 17, (z + 10) * 1.1));
  height = lerp(height, 0.45, villageBlend);
  for (const [centerX, centerZ, radius] of FLAT_PLACES) {
    height = lerp(height, 0.4, 1 - smoothstep(radius * 0.55, radius, Math.hypot(x - centerX, z - centerZ)));
  }
  const farmBlend = 1 - smoothstep(10, 17, Math.hypot((x - 16) * 0.8, (z + 3) * 1.2));
  height = lerp(height, 0.25, farmBlend);
  const basin = smoothstep(0.0, 0.55, pondDepth(x, z));
  height = lerp(height, -1.6, basin);
  const shore = smoothstep(-0.45, 0.0, pondDepth(x, z));
  height = lerp(height, Math.min(height, 0.1), shore * 0.7);
  // Fade to flat ground at the rim, where a plain plane continues the meadow to the horizon.
  return height * (1 - smoothstep(105, 135, Math.max(Math.abs(x), Math.abs(z))));
}

function toLocal(building, x, z) {
  const dx = x - building.cx;
  const dz = z - building.cz;
  const cos = Math.cos(building.yaw);
  const sin = Math.sin(building.yaw);
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}

// Height a worm stands on above the ground for a building: a ramp up the wall, then the gable roof.
export function buildingProfile(building, x, z) {
  const [localX, localZ] = toLocal(building, x, z);
  const outsideX = Math.abs(localX) - building.halfX;
  const outsideZ = Math.abs(localZ) - building.halfZ;
  if (outsideX > RAMP || outsideZ > RAMP) return 0;
  const outside = outsideX > 0 || outsideZ > 0 ? Math.hypot(Math.max(outsideX, 0), Math.max(outsideZ, 0)) : 0;
  if (outside > 0) return building.wallHeight * (1 - smoothstep(0, RAMP, outside));
  return building.wallHeight + building.ridgeHeight * (1 - Math.abs(localX) / building.halfX);
}

export function insideBuilding(x, z, margin = 0) {
  for (const building of buildings) {
    const [localX, localZ] = toLocal(building, x, z);
    if (Math.abs(localX) < building.halfX + margin && Math.abs(localZ) < building.halfZ + margin) return true;
  }
  return false;
}

function rockBump(x, z) {
  let bump = 0;
  for (const rock of rocks) {
    const reach = rock.scale * 0.55;
    const distance = Math.hypot(x - rock.x, z - rock.z);
    if (distance < reach) bump = Math.max(bump, rock.scale * 0.32 * (1 - smoothstep(0, reach, distance)));
  }
  return bump;
}

export function buildHeightfields() {
  const base = new Float32Array(GRID_X * GRID_Z);
  const sim = new Float32Array(GRID_X * GRID_Z);
  for (let row = 0; row < GRID_Z; row++) {
    for (let column = 0; column < GRID_X; column++) {
      const x = WORLD.minX + column * GRID_STEP;
      const z = WORLD.minZ + row * GRID_STEP;
      const ground = baseHeightAt(x, z);
      base[row * GRID_X + column] = ground;
      let lift = rockBump(x, z) + obstacleLift(x, z);
      for (const building of buildings) {
        const reach = Math.max(building.halfX, building.halfZ) + 4;
        if (Math.abs(x - building.cx) > reach || Math.abs(z - building.cz) > reach) continue;
        lift = Math.max(lift, buildingProfile(building, x, z));
      }
      sim[row * GRID_X + column] = ground + lift;
    }
  }
  const sample = (grid, x, z) => {
    const gx = clamp((x - WORLD.minX) / GRID_STEP, 0, GRID_X - 1.001);
    const gz = clamp((z - WORLD.minZ) / GRID_STEP, 0, GRID_Z - 1.001);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const index = iz * GRID_X + ix;
    const top = grid[index] + (grid[index + 1] - grid[index]) * fx;
    const bottom = grid[index + GRID_X] + (grid[index + GRID_X + 1] - grid[index + GRID_X]) * fx;
    return top + (bottom - top) * fz;
  };
  return {
    base,
    sim,
    groundHeight: (x, z) => sample(base, x, z),
    simHeight: (x, z) => sample(sim, x, z),
    isWater: (x, z) => sample(base, x, z) < WATER_LEVEL + 0.12,
  };
}

// ---- Ground texture: pixel art painted once, one texture pixel per render texel --------------------------------------

export const GROUND_W = Math.round((WORLD.maxX - WORLD.minX) / 0.3);
export const GROUND_H = Math.round((WORLD.maxZ - WORLD.minZ) / 0.3);

const PALETTE = {
  grass: ['#6f8f4a', '#7b9a52', '#88a65b', '#95b266'],
  dirt: ['#a8946c', '#b6a27a', '#c3b088', '#cfbd96'],
  soil: ['#6e6256', '#7a6e62', '#867a6d'],
  sand: ['#bda572', '#cdb982'],
  cobble: ['#6d675d', '#827b6e', '#9a9283', '#585349'],
};

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayerAt = (px, py) => (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16;

export function paintGround() {
  const canvas = document.createElement('canvas');
  canvas.width = GROUND_W;
  canvas.height = GROUND_H;
  const context = canvas.getContext('2d');
  const image = context.createImageData(GROUND_W, GROUND_H);
  const pick = (palette, tone) => hexToRgb(palette[clamp(Math.floor(tone), 0, palette.length - 1)]);
  for (let py = 0; py < GROUND_H; py++) {
    for (let px = 0; px < GROUND_W; px++) {
      const x = WORLD.minX + ((px + 0.5) / GROUND_W) * (WORLD.maxX - WORLD.minX);
      const z = WORLD.minZ + ((py + 0.5) / GROUND_H) * (WORLD.maxZ - WORLD.minZ);
      const speck = fractalNoise(px * 0.9, py * 0.9, 3, 1);
      const clump = fractalNoise(x * 0.22, z * 0.22, SEED + 9, 3);
      const dither = bayerAt(px, py);
      // Meadow: four greens, large clumps with ordered dither at their borders, scattered light and dark flecks.
      const tone = clump * 3.4 - 0.35 + (dither - 0.5) * 0.2 + (speck > 0.93 ? 1 : speck < 0.05 ? -1 : 0);
      let color = pick(PALETTE.grass, tone);
      const pathEdge = distanceToPaths(x, z);
      if (pathEdge < 0.35) {
        const pathTone = clump * 2.6 + (dither - 0.5) * 0.8 + (speck > 0.85 ? 1 : 0);
        if (pathEdge < 0) color = pick(PALETTE.dirt, pathTone);
        else if (dither < 0.5 * (1 - pathEdge / 0.35)) color = pick(PALETTE.dirt, pathTone - 0.5);
      }
      const depth = pondDepth(x, z);
      if (depth > -0.12 && depth < 0.2) color = depth > 0.04 ? pick(PALETTE.soil, clump * 3) : pick(PALETTE.sand, clump * 2 + dither);
      else if (depth >= 0.2) color = pick(PALETTE.soil, clump * 3 - 0.5);
      const inPlaza = plazas.some((square) => Math.hypot(x - square.x, z - square.z) < square.radius);
      if (inPlaza) {
        const tileX = Math.floor(px / 3);
        const tileY = Math.floor(py / 3);
        const tile = (tileX * 7 + tileY * 13 + ((tileX ^ tileY) & 3)) & 3;
        const seam = px % 3 === 0 || py % 3 === 0;
        color = pick(PALETTE.cobble, seam ? 3 : tile * 0.8 + (dither > 0.8 ? 1 : 0));
      }
      for (const plot of fields) {
        if (x > plot.minX && x < plot.maxX && z > plot.minZ && z < plot.maxZ && depth < 0) {
          const furrow = Math.floor((x - plot.minX) / 1.05) % 2 === 0;
          color = pick(PALETTE.soil, furrow ? 1.6 + dither : 0.2 + dither * 0.9);
        }
      }
      for (const building of buildings) {
        if (Math.abs(x - building.cx) > Math.max(building.halfX, building.halfZ) + 2) continue;
        const [localX, localZ] = toLocal(building, x, z);
        if (Math.abs(localX) < building.halfX + 0.8 && Math.abs(localZ) < building.halfZ + 0.8) color = pick(PALETTE.dirt, 1 + dither * 1.5);
      }
      const offset = (py * GROUND_W + px) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// ---- Meshes -----------------------------------------------------------------------------------------------------------

const TAKEN_PATCH = `
uniform sampler2D uTaken;
float bayerCell(vec2 cell) {
  vec2 c = mod(floor(cell), 4.0);
  float i = c.x + c.y * 4.0;
  float v[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (v[int(i)] + 0.5) / 16.0;
}
void main() {`;

const TAKEN_MIX = `#include <map_fragment>
  {
    vec2 cell = vMapUv * vec2(${GROUND_W}.0, ${GROUND_H}.0);
    float taken = texture2D(uTaken, vMapUv).r;
    float flesh = fract(sin(dot(floor(cell), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 slime = mix(vec3(0.12, 0.105, 0.095), vec3(0.17, 0.15, 0.135), step(0.7, flesh));
    diffuseColor.rgb = mix(diffuseColor.rgb, slime, step(bayerCell(cell), taken * 1.4));
  }`;

export function buildTerrainMeshes(heightfields, groundTexture, makeMaterial, takenTexture) {
  const stride = 2; // mesh vertices every 0.5 m
  const columns = Math.floor((GRID_X - 1) / stride) + 1;
  const rows = Math.floor((GRID_Z - 1) / stride) + 1;
  const positions = new Float32Array(columns * rows * 3);
  const uvs = new Float32Array(columns * rows * 2);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = WORLD.minX + column * stride * GRID_STEP;
      const z = WORLD.minZ + row * stride * GRID_STEP;
      const index = row * columns + column;
      positions.set([x, heightfields.groundHeight(x, z), z], index * 3);
      uvs.set([(x - WORLD.minX) / (WORLD.maxX - WORLD.minX), 1 - (z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)], index * 2);
    }
  }
  const indices = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = makeMaterial({ map: groundTexture, color: 0xffffff });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTaken = { value: takenTexture };
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', TAKEN_PATCH).replace('#include <map_fragment>', TAKEN_MIX);
  };
  material.customProgramCacheKey = () => 'ground-taken';
  const top = new THREE.Mesh(geometry, material);
  top.receiveShadow = true;
  top.castShadow = true;
  return { top };
}

export { GRID_X, GRID_Z, buildings };
