// RMS Titanic hull, decks and exterior. Bow is +x, starboard (camera side) is +z, keel is y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LENGTH = 269.1;
export const HALF_BEAM = 14.1;
export const WATERLINE = 10.5;
export const CUT_Z = 1.0; // the section plane: everything starboard of it is removed
export const CUT_SLOPE = 0.12; // the section plane leans back as it rises, so each deck's ceiling edge sits behind its floor edge
export const PARTITION_Z = -5.2; // back wall of every room

export const DECK = {
  tank: 1.8, orlop: 5.4, G: 8.2, F: 11.0, E: 13.8, D: 16.6, C: 19.4, B: 22.2, A: 25.0, boat: 29.0,
};

// Where the section plane stands at height y: at the cut line up to the orlop deck, then leaning back.
export function cutZ(y) {
  return CUT_Z - CUT_SLOPE * Math.max(0, y - DECK.orlop);
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function planform(t) {
  if (t <= 0 || t >= 1) return 0;
  let value = 1;
  if (t < 0.14) value = Math.sqrt(1 - Math.pow((0.14 - t) / 0.14, 2));
  if (t > 0.74) value = 1 - Math.pow((t - 0.74) / 0.26, 1.9);
  return Math.max(0, value);
}

export function keelY(x) {
  const t = x / LENGTH;
  let y = 0;
  if (t < 0.12) y += 3.0 * Math.pow(1 - t / 0.12, 2.2);
  if (t > 0.82) y += 15 * Math.pow((t - 0.82) / 0.18, 2.0);
  return y;
}

export function topY(x) {
  const t = x / LENGTH;
  return DECK.A + 4.8 * smooth(0.64, 1.0, t) + 3.0 * (1 - smooth(0.0, 0.17, t));
}

export function halfBeamAt(x, y) {
  const t = x / LENGTH;
  const keel = keelY(x);
  const top = topY(x);
  const h = clamp01((y - keel) / Math.max(0.5, top - keel));
  const bowShape = smooth(0.7, 1.0, t);
  const full = Math.pow(Math.sqrt(1 - Math.pow(1 - h, 3.2)), 1 + 0.9 * bowShape);
  const flare = 1 + 0.15 * h * bowShape;
  return HALF_BEAM * planform(t) * full * flare;
}

export function houseHalfWidth(x) {
  return Math.min(12.4, halfBeamAt(x, DECK.A) * 0.9);
}

// Counter stern: above the waterline the hull sweeps out aft, so the stern overhangs the rudder.
const COUNTER_OVERHANG = 5.2;
export function counterShift(x, y) {
  return COUNTER_OVERHANG * smooth(WATERLINE - 1.5, DECK.A + 3.0, y) * (1 - smooth(0, 24, x));
}

function lofted(nx, ny, position, colorAt, flip = false) {
  const positions = [];
  const colors = [];
  const indices = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const point = position(i / nx, j / ny);
      positions.push(point[0], point[1], point[2]);
      const color = colorAt(point);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      if (flip) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const HULL_DARK = new THREE.Color('#0d1016');
const HULL_RED = new THREE.Color('#a8402f');
const HULL_GOLD = new THREE.Color('#d6a33a');
function hullColor(point) {
  if (point[1] < WATERLINE - 0.5) return HULL_RED;
  if (point[1] > topY(point[0]) - 0.45) return HULL_GOLD;
  return HULL_DARK;
}

// Starboard cut: stepped heights per strip, so the broken edge shows the plate thickness.
const STRIP_EDGES = [0, 16, 38, 60, 84, 106, 128, 150, 172, 192, 210, 228, 246, 258, LENGTH];
// 99 means the hull side stays whole (the intact ends of the plate); the rest steps down toward the middle.
const STRIP_CUTS = [99, 26.5, 17, 9, 4.6, 3.6, 4.4, 3.4, 4.2, 6.5, 12, 19, 27, 99];

function cutHeights() {
  return STRIP_CUTS.map((height, index) => {
    const lowKeel = Math.max(keelY(STRIP_EDGES[index]), keelY(STRIP_EDGES[index + 1]));
    return Math.max(height, lowKeel + 2.4);
  });
}

function quad(positions, a, b, c, d) {
  positions.push(...a, ...c, ...b, ...b, ...c, ...d);
}

export function buildHull() {
  const group = new THREE.Group();
  const outer = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });
  const inner = new THREE.MeshLambertMaterial({ color: '#8d9299', side: THREE.BackSide });

  const geometries = [];
  // Port half, full height.
  geometries.push(lofted(140, 26,
    (u, v) => {
      const x = u * LENGTH;
      const keel = keelY(x);
      const y = keel + v * (topY(x) - keel);
      return [x - counterShift(x, y), y, -halfBeamAt(x, y)];
    },
    hullColor));

  const cuts = cutHeights();
  const effective = (strip, x) => Math.min(cuts[strip], topY(x));
  const rimPositions = [];
  for (let k = 0; k < cuts.length; k++) {
    const xa = STRIP_EDGES[k];
    const xb = STRIP_EDGES[k + 1];
    geometries.push(lofted(10, 16,
      (u, v) => {
        const x = xa + u * (xb - xa);
        const keel = keelY(x);
        const y = keel + v * (effective(k, x) - keel);
        return [x - counterShift(x, y), y, halfBeamAt(x, y)];
      },
      hullColor, true));
    if (cuts[k] < 90) {
      const steps = 8;
      const cut = cuts[k];
      for (let i = 0; i < steps; i++) {
        const x0 = xa + (xb - xa) * (i / steps);
        const x1 = xa + (xb - xa) * ((i + 1) / steps);
        const o0 = halfBeamAt(x0, cut);
        const o1 = halfBeamAt(x1, cut);
        quad(rimPositions, [x0, cut, o0], [x0, cut, o0 - 0.7], [x1, cut, o1], [x1, cut, o1 - 0.7]);
      }
    }
    if (k > 0) {
      const previous = effective(k - 1, xa);
      const current = effective(k, xa);
      if (Math.abs(previous - current) > 0.05) {
        const low = Math.min(previous, current);
        const high = Math.max(previous, current);
        const o = halfBeamAt(xa, low);
        const p = halfBeamAt(xa, high);
        quad(rimPositions, [xa, low, o], [xa, low, o - 0.7], [xa, high, p], [xa, high, p - 0.7]);
        quad(rimPositions, [xa, low, o - 0.7], [xa, high, p - 0.7], [xa, low, o], [xa, high, p]);
      }
    }
  }

  const merged = mergeGeometries(geometries);
  group.add(new THREE.Mesh(merged, outer));
  group.add(new THREE.Mesh(merged, inner));

  for (let i = 0; i < rimPositions.length; i += 3) {
    rimPositions[i] -= counterShift(rimPositions[i], rimPositions[i + 1]);
  }
  group.add(buildPortholes(cuts, effective));
  const rimGeometry = new THREE.BufferGeometry();
  rimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
  rimGeometry.computeVertexNormals();
  group.add(new THREE.Mesh(rimGeometry, new THREE.MeshLambertMaterial({ color: '#b08a5e', side: THREE.DoubleSide })));
  group.traverse((object) => {
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return group;
}

// Rows of round portholes along the black hull, wherever the starboard side wall stands.
function buildPortholes(cuts, effective) {
  const rows = [12.6, 15.4, 18.2];
  const spots = [];
  for (const y of rows) {
    for (let x = 4; x < LENGTH - 4; x += 2.7) {
      const strip = STRIP_EDGES.findIndex((edge, index) => x >= edge && x < STRIP_EDGES[index + 1]);
      if (strip < 0) continue;
      if (effective(strip, x) < y + 0.8 || keelY(x) > y - 1.5) continue;
      const beam = halfBeamAt(x, y);
      if (beam < 2.0) continue;
      const ahead = halfBeamAt(x + 0.5, y);
      const slope = (ahead - beam) / 0.5;
      spots.push({ x: x - counterShift(x, y), y, z: beam + 0.06, turn: -Math.atan(slope) });
    }
  }
  const group = new THREE.Group();
  const rimGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14);
  rimGeometry.rotateX(Math.PI / 2);
  const glassGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14);
  glassGeometry.rotateX(Math.PI / 2);
  const rims = new THREE.InstancedMesh(rimGeometry, new THREE.MeshLambertMaterial({ color: '#c9973c' }), spots.length);
  const glass = new THREE.InstancedMesh(glassGeometry, new THREE.MeshLambertMaterial({ color: '#1d2c36' }), spots.length);
  const placement = new THREE.Object3D();
  spots.forEach((spot, index) => {
    placement.position.set(spot.x, spot.y, spot.z);
    placement.rotation.set(0, spot.turn, 0);
    placement.updateMatrix();
    rims.setMatrixAt(index, placement.matrix);
    glass.setMatrixAt(index, placement.matrix);
  });
  group.add(rims, glass);
  return group;
}

function subtractVoids(start, end, voids) {
  let intervals = [[start, end]];
  for (const [voidStart, voidEnd] of voids) {
    const next = [];
    for (const [a, b] of intervals) {
      if (voidEnd <= a || voidStart >= b) {
        next.push([a, b]);
      } else {
        if (voidStart > a) next.push([a, voidStart]);
        if (voidEnd < b) next.push([voidEnd, b]);
      }
    }
    intervals = next;
  }
  return intervals.filter(([a, b]) => b - a > 0.5);
}

// Floor slab seen as a thin cut plate: warm top, dark brown edge.
function slabGeometry(y, xa, xb, frontZ, backHalf, thickness) {
  const shape = new THREE.Shape();
  const count = Math.max(2, Math.ceil((xb - xa) / 3));
  const front = [];
  const back = [];
  for (let i = 0; i <= count; i++) {
    const x = xa + (xb - xa) * (i / count);
    front.push([x, -(typeof frontZ === 'function' ? frontZ(x) : frontZ)]);
    back.push([x, Math.max(0.6, backHalf(x))]);
  }
  shape.moveTo(front[0][0], front[0][1]);
  for (const point of front) shape.lineTo(point[0], point[1]);
  for (let i = back.length - 1; i >= 0; i--) shape.lineTo(back[i][0], back[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y - thickness, 0);
  return geometry;
}

// Every deck slab as data: its level, the x intervals that remain after the stairwell and boiler voids,
// and the z extent. buildDecks draws it, and the figure check reads it to find the floor under a person.
export function deckLayout(voids) {
  const entries = [];
  for (const [name, y] of Object.entries(DECK)) {
    let xa = null;
    let xb = null;
    for (let x = 0; x <= LENGTH; x += 1) {
      const supported = name === 'boat' ? (x > 54 && x < 206) : (keelY(x) < y - 0.4 && halfBeamAt(x, y) > 1.6);
      if (supported) {
        if (xa === null) xa = x;
        xb = x;
      }
    }
    if (xa === null) continue;
    const backHalf = name === 'boat'
      ? (x) => houseHalfWidth(x) - 0.2
      : (x) => halfBeamAt(x, y) - 0.4;
    const frontZ = name === 'tank' ? ((x) => halfBeamAt(x, y) - 0.4) : cutZ(y);
    const deckVoids = voids.filter((entry) => entry.floor < y - 0.01 && entry.ceil > y + 0.01).map((entry) => [entry.x0, entry.x1]);
    entries.push({ name, y, intervals: subtractVoids(xa, xb, deckVoids), frontZ, backHalf });
  }
  return entries;
}

// Heights of every deck slab under the point (x, z).
export function deckTopsAt(layout, x, z) {
  const tops = [];
  for (const entry of layout) {
    for (const [a, b] of entry.intervals) {
      if (x < a || x > b) continue;
      const front = typeof entry.frontZ === 'function' ? entry.frontZ(x) : entry.frontZ;
      const back = -Math.max(0.6, entry.backHalf(x));
      if (z <= front && z >= back) tops.push(entry.y);
    }
  }
  return tops;
}

export function buildDecks(layout) {
  const group = new THREE.Group();
  const topMaterial = new THREE.MeshLambertMaterial({ color: '#8f7f66' });
  const edgeMaterial = new THREE.MeshLambertMaterial({ color: '#7a5233' });
  for (const entry of layout) {
    for (const [a, b] of entry.intervals) {
      const geometry = slabGeometry(entry.y, a, b, entry.frontZ, entry.backHalf, 0.32);
      const mesh = new THREE.Mesh(geometry, [topMaterial, edgeMaterial]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  return group;
}

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#efe6d2';
  context.fillRect(0, 0, 256, 64);
  context.fillStyle = '#7f98a6';
  for (let i = 0; i < 8; i++) {
    context.fillRect(i * 32 + 6, 18, 20, 26);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function buildExterior() {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: '#efe6d2', side: THREE.DoubleSide });
  const buff = new THREE.MeshLambertMaterial({ color: '#dcb264' });
  const black = new THREE.MeshLambertMaterial({ color: '#25262c' });
  const steel = new THREE.MeshLambertMaterial({ color: '#8a8a86' });
  const wood = new THREE.MeshLambertMaterial({ color: '#8a5a35' });

  // Port wall of the first class house with a window band, seen from outside in the inset.
  const wallTexture = windowTexture();
  wallTexture.repeat.set(142 / 32 / 1.0, 1);
  const wallLength = 142;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallLength, DECK.boat - DECK.A),
    new THREE.MeshLambertMaterial({ map: wallTexture, side: THREE.DoubleSide }));
  wall.position.set(54 + wallLength / 2 + 4, (DECK.boat + DECK.A) / 2, -12.4);
  group.add(wall);
  // Stepped remnants of the starboard house wall, white with windows, above the cut.
  for (const [x0, x1, top] of [[58, 66, 29], [66, 71, 27], [194, 200, 29], [190, 194, 27]]) {
    const texture = windowTexture();
    texture.repeat.set((x1 - x0) / 4, 1);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, top - DECK.A), new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }));
    panel.position.set((x0 + x1) / 2, (top + DECK.A) / 2, houseHalfWidth((x0 + x1) / 2));
    group.add(panel);
  }
  // House ends
  for (const x of [58, 200]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.4, DECK.boat - DECK.A, 12.4 + cutZ(DECK.boat)), white);
    end.position.set(x, (DECK.boat + DECK.A) / 2, (cutZ(DECK.boat) - 12.4) / 2);
    group.add(end);
  }
  // Funnels: buff with black tops, slightly raked, with whistle pipes.
  const funnelCenters = [146, 120, 94, 68];
  for (let index = 0; index < funnelCenters.length; index++) {
    const x = funnelCenters[index];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 4.1, 21, 20), buff);
    body.scale.set(1.12, 1, 0.92);
    body.position.set(x, DECK.boat + 10.5, 0);
    body.rotation.z = 0.045;
    group.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.85, 3.75, 4.4, 20), black);
    cap.scale.set(1.12, 1, 0.92);
    cap.position.set(x - 1.0, DECK.boat + 22.3, 0);
    cap.rotation.z = 0.045;
    group.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.95, 3.95, 0.5, 20), black);
    band.scale.set(1.12, 1, 0.92);
    band.position.set(x - 0.7, DECK.boat + 20.6, 0);
    band.rotation.z = 0.045;
    group.add(band);
    for (const dz of [0.9, -0.9]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7, 8), steel);
      pipe.position.set(x + 4.5, DECK.boat + 4.5, dz * 1.6);
      group.add(pipe);
    }
  }
  // Masts and the crow's nest.
  const foremast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 20, 8), wood);
  foremast.position.set(228, 28 + 10, 0);
  foremast.rotation.z = -0.04;
  group.add(foremast);
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 1.5, 10), wood);
  nest.position.set(227.4, 39.4, 0);
  group.add(nest);
  const mainmast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 20, 8), wood);
  mainmast.position.set(40, 27 + 10, 0);
  mainmast.rotation.z = 0.04;
  group.add(mainmast);
  for (const [x, top] of [[228, 46], [40, 45]]) {
    const yard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 9), wood);
    yard.position.set(x, top - 3, 0);
    group.add(yard);
  }
  // Stern: starboard propeller and rudder (the wing screw sits outboard).
  const propeller = new THREE.Group();
  const bronze = new THREE.MeshLambertMaterial({ color: '#b48a3a', side: THREE.DoubleSide });
  for (let blade = 0; blade < 3; blade++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 1.4), bronze);
    mesh.position.y = 1.9;
    const holder = new THREE.Group();
    holder.rotation.x = (blade / 3) * Math.PI * 2;
    holder.add(mesh);
    propeller.add(holder);
  }
  propeller.position.set(7, 4.2, 8.6);
  group.add(propeller);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(1.0, 9, 4.2), black);
  rudder.position.set(-0.4, 4.4, 0);
  group.add(rudder);
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

// Loose teal wash around the waterline, fading into the paper.
export function buildSea() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float planform(float t) {
        if (t <= 0.0 || t >= 1.0) return 0.0;
        float v = 1.0;
        if (t < 0.14) v = sqrt(1.0 - pow((0.14 - t) / 0.14, 2.0));
        if (t > 0.74) v = 1.0 - pow((t - 0.74) / 0.26, 1.9);
        return max(v, 0.0);
      }
      void main() {
        vec2 p = vWorld.xz;
        float beam = 14.1 * planform(vWorld.x / ${LENGTH.toFixed(1)});
        float awayFromHull = smoothstep(beam + 1.5, beam + 11.0, abs(p.y));
        vec2 q = vec2((p.x - 134.0) / 190.0, p.y / 62.0);
        float radius = length(q);
        float fade = 1.0 - smoothstep(0.35, 1.0, radius + 0.22 * (vnoise(p * 0.045) - 0.5));
        float wash = 0.55 + 0.45 * vnoise(p * vec2(0.05, 0.12));
        float streak = smoothstep(0.55, 0.9, vnoise(vec2(p.x * 0.035 + vnoise(p * 0.08) * 2.0, p.y * 0.55)));
        float alpha = fade * awayFromHull * (0.28 + 0.34 * wash + 0.22 * streak);
        vec3 teal = mix(vec3(0.26, 0.58, 0.60), vec3(0.14, 0.40, 0.48), wash);
        teal = pow(teal, vec3(2.2));
        gl_FragColor = vec4(teal, clamp(alpha, 0.0, 0.85));
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 190), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(134, WATERLINE, 0);
  sea.renderOrder = 10;
  return sea;
}
