import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeToonMaterial, addPropFade } from './look.js';
import { createRandom, clamp, fractalNoise, smoothstep } from './random.js';
import { WORLD, SEED, WATER_LEVEL } from './config.js';
import { rocks, paddock, fields, plaza, plazas, pond, woods, distanceToPaths, pondDepth, ROOF_COLORS } from './layout.js';
import { buildings, insideBuilding } from './terrain.js';

import { loadingManager } from './loading.js';
const loader = new GLTFLoader(loadingManager);

// Loads a glb into baked parts: one geometry (node transforms applied) and one toon material per mesh.
const partCache = new Map();
// The cache holds promises: placements start together, and each model must be loaded and baked once, not once per placement.
export function loadParts(url, tint = null) {
  const cacheKey = `${url}|${tint}`;
  if (!partCache.has(cacheKey)) partCache.set(cacheKey, bakeParts(url, tint));
  return partCache.get(cacheKey);
}

async function bakeParts(url, tint) {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const source = node.material;
    const material = makeToonMaterial({
      map: source.map ?? null,
      color: source.color ? source.color.clone() : new THREE.Color(0xffffff),
      vertexColors: Boolean(geometry.attributes.color),
    });
    addPropFade(material);
    if (url.includes('nature-kit')) {
      const keepWarm = url.includes('crop');
      remapNaturePalette(material.color, keepWarm);
      const colors = geometry.attributes.color;
      if (colors) {
        const scratch = new THREE.Color();
        for (let index = 0; index < colors.count; index++) {
          scratch.setRGB(colors.getX(index), colors.getY(index), colors.getZ(index), THREE.LinearSRGBColorSpace);
          remapNaturePalette(scratch, keepWarm);
          colors.setXYZ(index, scratch.r, scratch.g, scratch.b);
        }
      }
    }
    if (tint && tint.startsWith('flat:')) {
      material.map = null;
      material.color.set(tint.slice(5));
    } else if (tint) {
      material.color.multiply(new THREE.Color(tint));
    }
    parts.push({ geometry, material });
  });
  return { parts, gltf };
}

// Kenney's Nature Kit ships teal leaves and orange wood. Pull them toward a natural late-afternoon meadow.
const hsl = { h: 0, s: 0, l: 0 };
function remapNaturePalette(color, keepWarm) {
  color.getHSL(hsl);
  if (hsl.h > 0.38 && hsl.h < 0.62) color.setHSL(0.255 + (hsl.h - 0.5) * 0.15, hsl.s * 0.72, hsl.l * 0.78);
  else if (hsl.h > 0.04 && hsl.h < 0.11 && !keepWarm) color.setHSL(0.07, hsl.s * 0.55, hsl.l * 0.62);
}

// Collects placements per part and turns each into one InstancedMesh.
class Instancer {
  constructor() {
    this.groups = new Map();
    this.dummy = new THREE.Object3D();
  }

  async add(url, placement, tint = null) {
    const { parts } = await loadParts(url, tint);
    const matrix = this.buildMatrix(placement);
    for (const part of parts) {
      if (!this.groups.has(part)) this.groups.set(part, { part, matrices: [], cast: placement.cast !== false });
      this.groups.get(part).matrices.push(matrix);
    }
  }

  buildMatrix({ x, y = 0, z, yaw = 0, scale = 1, scaleVector = null }) {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, yaw, 0);
    if (scaleVector) this.dummy.scale.set(...scaleVector);
    else this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    return this.dummy.matrix.clone();
  }

  build() {
    const group = new THREE.Group();
    for (const { part, matrices, cast } of this.groups.values()) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }
}

const NATURE = (name) => `models/nature-kit/${name}.glb`;
const TOWN = (name) => `models/fantasy-town/${name}.glb`;

// Yaw that turns a gable tile so its ridge runs along local z (checked on a still, see notes).
const RIDGE_YAW = Math.PI / 2;

async function placeHouse(instancer, building, houseIndex) {
  const { cx, cz, yaw, cellsX, cellsZ, cell } = building;
  const tint = null;
  const place = (url, localX, localZ, sideYaw, height = 0, scaleVector = null) => {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    return instancer.add(TOWN(url), {
      x: cx + localX * cos + localZ * sin,
      y: height,
      z: cz - localX * sin + localZ * cos,
      yaw: yaw + sideYaw,
      scale: cell,
      scaleVector,
    }, tint);
  };
  const jobs = [];
  for (let ix = 0; ix < cellsX; ix++) {
    for (let iz = 0; iz < cellsZ; iz++) {
      const localX = (ix + 0.5 - cellsX / 2) * cell;
      const localZ = (iz + 0.5 - cellsZ / 2) * cell;
      const sides = [];
      if (ix === cellsX - 1) sides.push([0, 'x+']);
      if (ix === 0) sides.push([Math.PI, 'x-']);
      if (iz === cellsZ - 1) sides.push([-Math.PI / 2, 'z+']);
      if (iz === 0) sides.push([Math.PI / 2, 'z-']);
      for (const [sideYaw, side] of sides) {
        let model = 'wall-wood';
        const alongSide = side[0] === 'x' ? iz : ix;
        const sideLength = side[0] === 'x' ? cellsZ : cellsX;
        if (side === 'z+' && alongSide === Math.floor((sideLength - 1) / 2)) model = 'wall-wood-door';
        else if ((alongSide + (side === 'x+' ? 1 : 0)) % 2 === 1) model = 'wall-wood-window-shutters';
        jobs.push(place(model, localX, localZ, sideYaw));
      }
    }
  }
  const roofWidth = cellsX * cell * 1.06;
  for (let iz = 0; iz < cellsZ; iz++) {
    const localZ = (iz + 0.5 - cellsZ / 2) * cell;
    const isEnd = iz === 0 || iz === cellsZ - 1;
    const model = building.high ? 'roof-high-gable' : 'roof-gable';
    const heightScale = building.ridgeHeight / (building.high ? 1.16 : 0.57);
    jobs.push(
      instancer.add(TOWN(isEnd && cellsZ > 2 ? 'roof-gable-end' : model), {
        x: building.cx + localZ * Math.sin(yaw),
        y: building.wallHeight - 0.04,
        z: building.cz + localZ * Math.cos(yaw),
        yaw: yaw + RIDGE_YAW,
        scaleVector: [cell * 1.04, heightScale, roofWidth / 1.1],
      }, `flat:${ROOF_COLORS[houseIndex % ROOF_COLORS.length]}`),
    );
  }
  await Promise.all(jobs);
}

export async function buildProps(heightfields) {
  const instancer = new Instancer();
  const random = createRandom(SEED + 77);
  const groundY = heightfields.groundHeight;
  const jobs = [];

  buildings.forEach((building, houseIndex) => jobs.push(placeHouse(instancer, building, houseIndex)));

  const free = (x, z, margin = 0) => {
    if (x < WORLD.minX + 1.5 || x > WORLD.maxX - 1.5 || z < WORLD.minZ + 1.5 || z > WORLD.maxZ - 1.5) return false;
    if (insideBuilding(x, z, 2.2 + margin)) return false;
    for (const square of plazas) if (Math.hypot(x - square.x, z - square.z) < square.radius + margin) return false;
    for (const plot of fields) if (x > plot.minX - 0.5 && x < plot.maxX + 0.5 && z > plot.minZ - 0.5 && z < plot.maxZ + 0.5) return false;
    if (distanceToPaths(x, z) < 0.8 + margin) return false;
    if (pondDepth(x, z) > -0.2 - margin * 0.1) return false;
    for (const rock of rocks) if (Math.hypot(x - rock.x, z - rock.z) < rock.scale * 0.6 + margin) return false;
    return true;
  };
  const inPaddock = (x, z, margin = 0) => x > paddock.minX - margin && x < paddock.maxX + margin && z > paddock.minZ - margin && z < paddock.maxZ + margin;

  // Rocks (hand placed so worms can climb them).
  for (const rock of rocks) {
    jobs.push(instancer.add(NATURE(rock.model), { x: rock.x, y: groundY(rock.x, rock.z), z: rock.z, yaw: random.range(0, 6.28), scale: rock.scale }));
  }

  // Open-world scatter: every 14 m chunk draws its own trees, grass, flowers and bushes from a random seeded by
  // its chunk coordinates, so the same chunk always grows the same things (and a chunk could be built on demand).
  const treeModels = ['tree_default', 'tree_oak', 'tree_fat', 'tree_pineTallA', 'tree_pineDefaultA', 'tree_cone', 'tree_default'];
  const flowerModels = ['flower_redA', 'flower_yellowA', 'flower_purpleA'];
  const CHUNK = 14;
  const woodiness = (x, z) => {
    let level = smoothstep(0.58, 0.72, fractalNoise(x * 0.018, z * 0.018, SEED + 44, 3));
    for (const wood of woods) level = Math.max(level, 1 - smoothstep(wood.radius * 0.45, wood.radius, Math.hypot(x - wood.x, z - wood.z)));
    return level;
  };
  const chunksX = Math.ceil((WORLD.maxX - WORLD.minX) / CHUNK);
  for (let chunkZ = 0; chunkZ < chunksX; chunkZ++) {
    for (let chunkX = 0; chunkX < chunksX; chunkX++) {
      const chunkRandom = createRandom(SEED + 1009 * chunkX + 7919 * chunkZ + 55);
      const originX = WORLD.minX + chunkX * CHUNK;
      const originZ = WORLD.minZ + chunkZ * CHUNK;
      const place = () => [originX + chunkRandom.next() * CHUNK, originZ + chunkRandom.next() * CHUNK];
      const forest = woodiness(originX + CHUNK / 2, originZ + CHUNK / 2);
      const treeCount = Math.round(1.2 + forest * 15);
      for (let index = 0; index < treeCount; index++) {
        const [x, z] = place();
        if (!free(x, z, 1.2) || inPaddock(x, z, 1.5)) continue;
        jobs.push(instancer.add(NATURE(chunkRandom.pick(treeModels)), { x, y: groundY(x, z), z, yaw: chunkRandom.range(0, 6.28), scale: chunkRandom.range(3.6, 5.2) }));
      }
      const grassCount = Math.round(26 * (1 - forest * 0.5));
      for (let index = 0; index < grassCount; index++) {
        const [x, z] = place();
        if (!free(x, z, 0.1)) continue;
        jobs.push(instancer.add(NATURE('grass_large'), { x, y: groundY(x, z) - 0.02, z, yaw: chunkRandom.range(0, 6.28), scale: chunkRandom.range(1.2, 1.9), cast: false }));
      }
      for (let index = 0; index < 5; index++) {
        const [x, z] = place();
        if (!free(x, z, 0.1)) continue;
        jobs.push(instancer.add(NATURE(chunkRandom.pick(flowerModels)), { x, y: groundY(x, z), z, yaw: chunkRandom.range(0, 6.28), scale: chunkRandom.range(2.4, 3.2), cast: false }));
      }
      for (let index = 0; index < 1 + Math.round(forest * 3); index++) {
        const [x, z] = place();
        if (!free(x, z, 0.8)) continue;
        jobs.push(instancer.add(NATURE(chunkRandom.next() < 0.5 ? 'plant_bushLarge' : 'plant_bush'), { x, y: groundY(x, z), z, yaw: chunkRandom.range(0, 6.28), scale: chunkRandom.range(3, 4.4) }));
      }
    }
  }

  // Wheat in the furrows of every field.
  for (const plot of fields) {
    const rows = Math.floor((plot.maxX - plot.minX) / 2.1);
    const columns = Math.floor((plot.maxZ - plot.minZ - 0.6) / 0.85);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = plot.minX + (row * 2 + 0.5) * 1.05;
        const z = plot.minZ + 0.6 + column * 0.85;
        jobs.push(instancer.add(NATURE('crops_wheatStageB'), { x, y: groundY(x, z) + 0.02, z, yaw: 0, scale: 2.0, cast: false }));
      }
    }
  }

  // Paddock fence with a gate gap on the south side.
  const step = 1.6;
  const fence = (x, z, yaw) => jobs.push(instancer.add(NATURE('fence_planks'), { x, y: groundY(x, z), z, yaw, scale: step }));
  for (let x = paddock.minX + step / 2; x < paddock.maxX; x += step) {
    fence(x, paddock.minZ, 0);
    if (Math.abs(x - 16) > 2.4) fence(x, paddock.maxZ, 0);
  }
  for (let z = paddock.minZ + step / 2; z < paddock.maxZ; z += step) {
    fence(paddock.minX, z, Math.PI / 2);
    fence(paddock.maxX, z, Math.PI / 2);
  }

  // Village dressing.
  jobs.push(instancer.add(TOWN('stall-red'), { x: plaza.x + 2.2, y: groundY(plaza.x + 2.2, plaza.z - 1), z: plaza.z - 1, yaw: -0.7, scale: 2.4 }));
  jobs.push(instancer.add(TOWN('cart'), { x: plaza.x - 2.4, y: groundY(plaza.x - 2.4, plaza.z + 1), z: plaza.z + 1.2, yaw: 0.6, scale: 2.2 }));
  jobs.push(instancer.add(TOWN('cart'), { x: 12, y: groundY(12, -5.4), z: -5.4, yaw: 0.2, scale: 2.4 }));
  jobs.push(instancer.add(NATURE('log_stack'), { x: -21, y: groundY(-21, -9.5), z: -9.5, yaw: 0.4, scale: 3 }));
  jobs.push(instancer.add(NATURE('sign'), { x: -14.2, y: groundY(-14.2, -4.6), z: -4.6, yaw: -0.5, scale: 3 }));
  jobs.push(instancer.add(NATURE('stump_old'), { x: 4, y: groundY(4, -8), z: -8, yaw: 0, scale: 3.2 }));
  for (let index = 0; index < 11; index++) {
    const x = pond.x + random.range(-5, 5);
    const z = pond.z + random.range(-3, 3);
    if (pondDepth(x, z) < 0.25) continue;
    jobs.push(instancer.add(NATURE('lily_small'), { x, y: WATER_LEVEL + 0.03, z, yaw: random.range(0, 6.28), scale: 2.6, cast: false }));
  }

  await Promise.all(jobs);
  return instancer.build();
}

export function buildWater() {
  const geometry = new THREE.PlaneGeometry(pond.radiusX * 2 + 3, pond.radiusZ * 2 + 3);
  geometry.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geometry, makeToonMaterial({ color: 0x2f8f97 }));
  water.position.set(pond.x, WATER_LEVEL, pond.z);
  water.receiveShadow = true;

  // Blinking sparkle cubes, driven from the sim clock in update().
  const sparkleGeometry = new THREE.BoxGeometry(0.22, 0.04, 0.22);
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color: 0xe9fbf0 });
  const random = createRandom(SEED + 9);
  const sparkles = [];
  for (let index = 0; index < 26; index++) {
    const mesh = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
    let x;
    let z;
    do {
      x = pond.x + random.range(-pond.radiusX, pond.radiusX);
      z = pond.z + random.range(-pond.radiusZ, pond.radiusZ);
    } while (pondDepth(x, z) < 0.15);
    mesh.position.set(x, WATER_LEVEL + 0.04, z);
    mesh.userData.phase = random.range(0, 6.28);
    mesh.userData.rate = random.range(0.8, 1.6);
    sparkles.push(mesh);
    water.add(mesh);
    mesh.position.sub(water.position);
  }
  water.userData.update = (time) => {
    for (const sparkle of sparkles) sparkle.visible = Math.sin(time * 2.2 * sparkle.userData.rate + sparkle.userData.phase) > 0.82;
  };
  return water;
}

export { clamp };
