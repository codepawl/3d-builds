// Shared helpers: seeded random, painted canvas textures, materials and a batch that merges boxes per material.
import * as THREE from 'three';

export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(edge0, edge1, value) {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function paintedCanvas(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function speckle(context, size, random, amount, lightRange) {
  for (let index = 0; index < amount; index += 1) {
    const light = lightRange[0] + random() * (lightRange[1] - lightRange[0]);
    context.fillStyle = `rgba(${light},${light * 0.9},${light * 0.7},${0.05 + random() * 0.08})`;
    context.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
}

function stoneTexture(random, hue, courses, mortar) {
  return paintedCanvas(512, (context, size) => {
    context.fillStyle = mortar;
    context.fillRect(0, 0, size, size);
    const rowHeight = size / courses;
    for (let row = 0; row < courses; row += 1) {
      const widths = [];
      let total = 0;
      while (total < size - 60) {
        const width = 56 + random() * 70;
        widths.push(width);
        total += width;
      }
      widths.push(size - total);
      let cursor = 0;
      for (const width of widths) {
        const lightness = 60 + random() * 14;
        const saturation = 16 + random() * 10;
        context.fillStyle = `hsl(${hue + random() * 10 - 5},${saturation}%,${lightness}%)`;
        context.beginPath();
        context.roundRect(cursor + 1.5, row * rowHeight + 1.5, width - 3, rowHeight - 3, 5);
        context.fill();
        const shade = context.createLinearGradient(0, row * rowHeight, 0, (row + 1) * rowHeight);
        shade.addColorStop(0, 'rgba(255,248,225,0.22)');
        shade.addColorStop(0.5, 'rgba(255,248,225,0)');
        shade.addColorStop(1, 'rgba(90,60,30,0.2)');
        context.fillStyle = shade;
        context.fill();
        cursor += width;
      }
    }
    speckle(context, size, random, 2600, [120, 230]);
  });
}

function plankTexture(random, base, gap) {
  return paintedCanvas(256, (context, size) => {
    context.fillStyle = gap;
    context.fillRect(0, 0, size, size);
    const plankCount = 6;
    for (let index = 0; index < plankCount; index += 1) {
      const lightness = 38 + random() * 12;
      context.fillStyle = `hsl(${base + random() * 8},42%,${lightness}%)`;
      context.fillRect(index * (size / plankCount) + 1.5, 0, size / plankCount - 3, size);
      for (let grain = 0; grain < 6; grain += 1) {
        context.strokeStyle = `rgba(60,35,15,${0.1 + random() * 0.15})`;
        context.beginPath();
        const grainX = index * (size / plankCount) + 4 + random() * (size / plankCount - 8);
        context.moveTo(grainX, 0);
        context.bezierCurveTo(grainX + 3, size * 0.3, grainX - 3, size * 0.6, grainX + 1, size);
        context.stroke();
      }
    }
  });
}

function slateTexture(random, hue, lightness) {
  return paintedCanvas(256, (context, size) => {
    context.fillStyle = `hsl(${hue},18%,${lightness - 14}%)`;
    context.fillRect(0, 0, size, size);
    const rows = 8;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? size / 16 : 0;
      for (let column = -1; column < 8; column += 1) {
        context.fillStyle = `hsl(${hue + random() * 14 - 7},${16 + random() * 10}%,${lightness + random() * 10 - 4}%)`;
        context.beginPath();
        context.roundRect(column * (size / 8) + offset + 1, row * (size / rows) + 1, size / 8 - 2, size / rows - 1, 4);
        context.fill();
      }
    }
  });
}

function earthTexture(random, hue, lightness, grains) {
  return paintedCanvas(256, (context, size) => {
    context.fillStyle = `hsl(${hue},38%,${lightness}%)`;
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < grains; index += 1) {
      const shift = random() * 16 - 8;
      context.fillStyle = `hsla(${hue + shift},35%,${lightness + shift}%,0.35)`;
      context.beginPath();
      context.ellipse(random() * size, random() * size, 2 + random() * 8, 1 + random() * 4, random() * 3, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function strataTexture(random) {
  return paintedCanvas(512, (context, size) => {
    let cursorY = 0;
    while (cursorY < size) {
      const band = 26 + random() * 50;
      context.fillStyle = `hsl(${28 + random() * 14},${18 + random() * 14}%,${44 + random() * 22}%)`;
      context.beginPath();
      context.moveTo(0, cursorY);
      for (let x = 0; x <= size; x += 32) {
        context.lineTo(x, cursorY + Math.sin(x * 0.05 + cursorY) * 5);
      }
      context.lineTo(size, cursorY + band);
      context.lineTo(0, cursorY + band);
      context.fill();
      cursorY += band;
    }
    speckle(context, size, random, 3400, [70, 200]);
  });
}

function parchmentTexture(random) {
  return paintedCanvas(512, (context, size) => {
    context.fillStyle = '#f0e3c2';
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < 700; index += 1) {
      context.fillStyle = `rgba(${170 + random() * 50},${130 + random() * 50},80,${0.012 + random() * 0.025})`;
      context.beginPath();
      context.ellipse(random() * size, random() * size, 3 + random() * 14, 2 + random() * 6, random() * 3, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function waterTexture(random) {
  return paintedCanvas(256, (context, size) => {
    context.fillStyle = '#4f8fa6';
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < 70; index += 1) {
      context.strokeStyle = `rgba(220,240,240,${0.1 + random() * 0.25})`;
      context.lineWidth = 1 + random() * 1.5;
      const startX = random() * size;
      const startY = random() * size;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(startX + 14, startY - 4, startX + 26, startY + 4, startX + 44, startY);
      context.stroke();
    }
  });
}

export function emblemTexture(background, accent) {
  return paintedCanvas(128, (context, size) => {
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
    context.fillStyle = accent;
    context.fillRect(size * 0.44, size * 0.18, size * 0.12, size * 0.64);
    context.fillRect(size * 0.22, size * 0.4, size * 0.56, size * 0.12);
    context.beginPath();
    context.arc(size / 2, size * 0.46, size * 0.3, 0, Math.PI * 2);
    context.lineWidth = 4;
    context.strokeStyle = accent;
    context.stroke();
  });
}

export function glowSpriteTexture(inner, outer) {
  return paintedCanvas(128, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.35, outer);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

// Each entry: a material and the world size one texture tile covers.
export function makeMaterials() {
  const random = makeRandom(7);
  const standard = (parameters, tile = 4) => ({ material: new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...parameters }), tile });
  const stoneMap = stoneTexture(random, 40, 8, '#a8997c');
  const deepStoneMap = stoneTexture(random, 34, 8, '#7a6c56');
  const slateMap = slateTexture(random, 218, 52);
  const brownRoofMap = slateTexture(random, 24, 40);
  const plankMap = plankTexture(random, 28, '#3b2410');
  const darkPlankMap = plankTexture(random, 22, '#2a190a');
  return {
    stone: standard({ map: stoneMap }, 8),
    stoneDeep: standard({ map: deepStoneMap }, 8),
    cut: standard({ color: 0x8a7458, roughness: 1 }),
    slate: standard({ map: slateMap, side: THREE.DoubleSide }, 6),
    brownRoof: standard({ map: brownRoofMap, side: THREE.DoubleSide }, 6),
    wood: standard({ map: plankMap }, 4),
    woodDark: standard({ map: darkPlankMap }, 4),
    dirt: standard({ map: earthTexture(random, 36, 62, 500) }, 10),
    grass: standard({ map: earthTexture(random, 88, 46, 500) }, 10),
    strata: standard({ map: strataTexture(random) }, 14),
    parchment: standard({ map: parchmentTexture(random), roughness: 1 }, 40),
    water: standard({ map: waterTexture(random), roughness: 0.35, metalness: 0.1 }, 12),
    iron: standard({ color: 0x3a3b3f, roughness: 0.55, metalness: 0.5 }),
    gold: standard({ color: 0xd9a93c, roughness: 0.4, metalness: 0.6 }),
    plaster: standard({ color: 0xe4d6b4 }),
    hay: standard({ color: 0xcfa94a }),
    barrel: standard({ color: 0xa06c3a }),
    cloth: standard({ color: 0xf0ead8, side: THREE.DoubleSide }),
    red: standard({ color: 0xb02a2e, side: THREE.DoubleSide }),
    blue: standard({ color: 0x2f4f9a, side: THREE.DoubleSide }),
    green: standard({ color: 0x5b8a4a }),
    sack: standard({ color: 0xcdb88a }),
    pot: standard({ color: 0x2c2a29, roughness: 0.6, metalness: 0.3 }),
    food: standard({ color: 0xc87a3c }),
    bone: standard({ color: 0xd9ceb0 }),
    candle: standard({ color: 0xf4ecd0, emissive: 0xffc070, emissiveIntensity: 0.5 }),
    flame: { material: new THREE.MeshBasicMaterial({ color: 0xffa23a }), tile: 4 },
    windowGlow: standard({ color: 0x3a2a14, emissive: 0xffb04a, emissiveIntensity: 0.15 }),
    glassBlue: standard({ color: 0x2a4a9a, emissive: 0x3a62d0, emissiveIntensity: 0.3 }),
    glassRed: standard({ color: 0x9a2a2a, emissive: 0xd04040, emissiveIntensity: 0.3 }),
    glassGold: standard({ color: 0xb08a2a, emissive: 0xe0b040, emissiveIntensity: 0.3 }),
    forge: { material: new THREE.MeshBasicMaterial({ color: 0xff6a20 }), tile: 4 },
  };
}

function worldUv(geometry, width, height, depth, tile) {
  const uv = geometry.attributes.uv;
  const faces = [
    [depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height],
  ];
  for (let face = 0; face < 6; face += 1) {
    for (let corner = 0; corner < 4; corner += 1) {
      const index = face * 4 + corner;
      uv.setXY(index, (uv.getX(index) * faces[face][0]) / tile, (uv.getY(index) * faces[face][1]) / tile);
    }
  }
}

// Collects geometry per material, then builds one mesh per material.
export class Batch {
  constructor(materials) {
    this.materials = materials;
    this.groups = new Map();
    this.matrix = new THREE.Matrix4();
    this.euler = new THREE.Euler();
    this.quaternion = new THREE.Quaternion();
    this.one = new THREE.Vector3(1, 1, 1);
  }

  push(materialName, geometry, position, rotation) {
    this.euler.set(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0, 'YXZ');
    this.quaternion.setFromEuler(this.euler);
    this.matrix.compose(new THREE.Vector3(position[0], position[1], position[2]), this.quaternion, this.one);
    const placed = geometry.index ? geometry.toNonIndexed() : geometry;
    placed.applyMatrix4(this.matrix);
    if (!this.groups.has(materialName)) {
      this.groups.set(materialName, []);
    }
    this.groups.get(materialName).push(placed);
  }

  box(materialName, centerX, centerY, centerZ, width, height, depth, rotation) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    worldUv(geometry, width, height, depth, this.materials[materialName].tile);
    this.push(materialName, geometry, [centerX, centerY, centerZ], rotation);
  }

  // Box from min corner to max corner.
  span(materialName, minX, minY, minZ, maxX, maxY, maxZ, rotation) {
    this.box(materialName, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, maxX - minX, maxY - minY, maxZ - minZ, rotation);
  }

  cylinder(materialName, centerX, centerY, centerZ, radiusTop, radiusBottom, height, segments = 14, rotation, openEnded = false) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, openEnded);
    const tile = this.materials[materialName].tile;
    const uv = geometry.attributes.uv;
    const circumference = Math.PI * 2 * Math.max(radiusTop, radiusBottom);
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, (uv.getX(index) * circumference) / tile, (uv.getY(index) * height) / tile);
    }
    this.push(materialName, geometry, [centerX, centerY, centerZ], rotation);
  }

  shape(materialName, geometry, position) {
    this.push(materialName, geometry, position);
  }

  build(parent, { castShadow = true, receiveShadow = true } = {}) {
    for (const [materialName, geometries] of this.groups) {
      let vertexCount = 0;
      for (const geometry of geometries) {
        vertexCount += geometry.attributes.position.count;
      }
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      let offset = 0;
      for (const geometry of geometries) {
        positions.set(geometry.attributes.position.array, offset * 3);
        normals.set(geometry.attributes.normal.array, offset * 3);
        uvs.set(geometry.attributes.uv.array, offset * 2);
        offset += geometry.attributes.position.count;
        geometry.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const mesh = new THREE.Mesh(merged, this.materials[materialName].material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = `batch-${materialName}`;
      parent.add(mesh);
    }
  }
}
