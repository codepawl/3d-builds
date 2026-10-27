// Rooms at their (approximate) real positions, furnished and packed with small people.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Crowd, makeRng, makeSpec } from './figures.js';
import { DECK, PARTITION_Z, cutZ, deckLayout, deckTopsAt } from './ship.js';

const AMBER = "#ffbf70";
const BOAT = DECK.boat;
const ROOF = BOAT + 3.4;

export const FUNNELS = [146, 120, 94, 68];

// x0, x1, floor, ceil, kind, wall colour, options
export const ROOMS = [
  // Boat deck
  { id: 'bridge', x0: 206, x1: 217, floor: BOAT, ceil: ROOF, kind: 'bridge', wall: '#e8dcc0', roof: true, windows: true },
  { id: 'officers', x0: 189, x1: 205, floor: BOAT, ceil: ROOF, kind: 'officers', wall: '#d8c9a4', roof: true },
  { id: 'marconi', x0: 178, x1: 188, floor: BOAT, ceil: ROOF, kind: 'marconi', wall: '#cdbf9c', roof: true },
  { id: 'gym', x0: 151, x1: 162, floor: BOAT, ceil: ROOF, kind: 'gym', wall: '#e0d3b0', roof: true, windows: true },
  // A deck
  { id: 'a-promenade-aft', x0: 60, x1: 78, floor: DECK.A, ceil: BOAT, kind: 'promenade', wall: '#e8dcc0', windows: true },
  { id: 'smoking', x0: 80, x1: 112, floor: DECK.A, ceil: BOAT, kind: 'smoking', wall: '#5b3a22' },
  { id: 'lounge', x0: 118, x1: 148, floor: DECK.A, ceil: BOAT, kind: 'lounge', wall: '#b88a5a' },
  { id: 'reading', x0: 150, x1: 162, floor: DECK.A, ceil: BOAT, kind: 'reading', wall: '#8a9a6a' },
  { id: 'a-promenade-fwd', x0: 178, x1: 200, floor: DECK.A, ceil: BOAT, kind: 'promenade', wall: '#e8dcc0', windows: true },
  // B, C: staterooms
  { id: 'b-aft', x0: 60, x1: 94, floor: DECK.B, ceil: DECK.A, kind: 'staterooms', wall: '#d9c9a2' },
  { id: 'b-mid', x0: 96, x1: 162, floor: DECK.B, ceil: DECK.A, kind: 'staterooms', wall: '#e0d0aa' },
  { id: 'b-fwd', x0: 178, x1: 205, floor: DECK.B, ceil: DECK.A, kind: 'staterooms', wall: '#e0d0aa' },
  { id: 'c-aft', x0: 60, x1: 94, floor: DECK.C, ceil: DECK.B, kind: 'staterooms', wall: '#d9c9a2' },
  { id: 'c-mid', x0: 96, x1: 162, floor: DECK.C, ceil: DECK.B, kind: 'staterooms', wall: '#e0d0aa' },
  { id: 'c-fwd', x0: 178, x1: 205, floor: DECK.C, ceil: DECK.B, kind: 'staterooms', wall: '#e0d0aa' },
  { id: 'c-bow', x0: 208, x1: 240, floor: DECK.C, ceil: DECK.B, kind: 'bunks', wall: '#9a8a6a' },
  // D deck
  { id: 'dining2', x0: 62, x1: 94, floor: DECK.D, ceil: DECK.C, kind: 'dining', mix: ['second'], wall: '#c8a26a' },
  { id: 'dining', x0: 98, x1: 146, floor: DECK.D, ceil: DECK.C, kind: 'dining', mix: ['first'], wall: '#e3d3a6' },
  { id: 'reception', x0: 148, x1: 162, floor: DECK.D, ceil: DECK.C, kind: 'reception', wall: '#d8b78a' },
  { id: 'd-fwd', x0: 178, x1: 205, floor: DECK.D, ceil: DECK.C, kind: 'staterooms', wall: '#d9c9a2' },
  { id: 'd-bow', x0: 208, x1: 240, floor: DECK.D, ceil: DECK.C, kind: 'bunks', wall: '#9a8a6a' },
  // E deck
  { id: 'e-aft', x0: 10, x1: 54, floor: DECK.E, ceil: DECK.D, kind: 'cabins3', wall: '#a8987a' },
  { id: 'e-engine', x0: 56, x1: 94, floor: DECK.E, ceil: DECK.D, kind: 'staterooms', wall: '#cdbd98' },
  { id: 'scotland-road', x0: 96, x1: 162, floor: DECK.E, ceil: DECK.D, kind: 'corridor', wall: '#c9b890' },
  { id: 'e-fwd', x0: 178, x1: 205, floor: DECK.E, ceil: DECK.D, kind: 'corridor', wall: '#c9b890' },
  { id: 'e-bow', x0: 210, x1: 256, floor: DECK.E, ceil: DECK.D, kind: 'cabins3', wall: '#a8987a' },
  // F deck
  { id: 'f-aft', x0: 14, x1: 54, floor: DECK.F, ceil: DECK.E, kind: 'dining3', wall: '#b8a888' },
  { id: 'firemen', x0: 100, x1: 165, floor: DECK.F, ceil: DECK.E, kind: 'bunks', wall: '#9a8a6a' },
  { id: 'pool', x0: 182, x1: 197, floor: DECK.F, ceil: DECK.E, kind: 'pool', wall: '#8cc3c4' },
  { id: 'turkish', x0: 198, x1: 208, floor: DECK.F, ceil: DECK.E, kind: 'turkish', wall: '#b8553f' },
  { id: 'dining3', x0: 210, x1: 246, floor: DECK.F, ceil: DECK.E, kind: 'dining3', wall: '#b8a888' },
  // G deck
  { id: 'g-aft', x0: 14, x1: 54, floor: DECK.G, ceil: DECK.F, kind: 'cabins3', wall: '#a8987a' },
  { id: 'squash', x0: 182, x1: 197, floor: DECK.G, ceil: DECK.F, kind: 'squash', wall: '#efe6d0' },
  { id: 'mail', x0: 198, x1: 214, floor: DECK.G, ceil: DECK.F, kind: 'mail', wall: '#b9a47c' },
  { id: 'g-bow', x0: 218, x1: 252, floor: DECK.G, ceil: DECK.F, kind: 'cabins3', wall: '#a8987a' },
  // Orlop and tank top
  { id: 'hold-aft', x0: 14, x1: 54, floor: DECK.orlop, ceil: DECK.G, kind: 'hold', wall: '#7b6a50' },
  { id: 'hold-fwd', x0: 214, x1: 258, floor: DECK.orlop, ceil: DECK.G, kind: 'hold', wall: '#7b6a50', car: true },
  { id: 'hold-mid-orlop', x0: 184, x1: 212, floor: DECK.orlop, ceil: DECK.G, kind: 'hold', wall: '#7b6a50' },
  { id: 'hold-mid-tank', x0: 184, x1: 214, floor: DECK.tank, ceil: DECK.orlop, kind: 'hold', wall: '#6a5a44' },
  { id: 'hold-bottom', x0: 216, x1: 256, floor: DECK.tank, ceil: DECK.orlop, kind: 'hold', wall: '#6a5a44' },
  { id: 'shafts', x0: 8, x1: 40, floor: DECK.tank, ceil: DECK.orlop, kind: 'shafts', wall: '#6a6a66' },
  // Engines and boilers, floor to F deck
  { id: 'turbine', x0: 40, x1: 56, floor: DECK.tank, ceil: DECK.F, kind: 'turbine', wall: '#6f757c' },
  { id: 'engine', x0: 56, x1: 86, floor: DECK.tank, ceil: DECK.E, kind: 'engine', wall: '#6f757c' },
  { id: 'boiler1', x0: 86, x1: 98, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 4, wall: '#5c5a58' },
  { id: 'boiler2', x0: 98, x1: 114, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 5, wall: '#5c5a58' },
  { id: 'boiler3', x0: 114, x1: 132, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 5, wall: '#5c5a58' },
  { id: 'boiler4', x0: 132, x1: 150, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 5, wall: '#5c5a58' },
  { id: 'boiler5', x0: 150, x1: 166, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 5, wall: '#5c5a58' },
  { id: 'boiler6', x0: 166, x1: 182, floor: DECK.tank, ceil: DECK.F, kind: 'boiler', count: 5, wall: '#5c5a58' },
];

export const VOIDS = [
  ...ROOMS.filter((room) => room.ceil - room.floor > 6 && room.kind !== 'stairs').map((room) => ({ x0: room.x0, x1: room.x1, floor: room.floor, ceil: room.ceil })),
  { x0: 163, x1: 177, floor: DECK.E, ceil: BOAT + 3.0 },
];

export class Stage {
  constructor() {
    this.solid = [];
    this.glow = [];
    this.lights = [];
    this.crowd = new Crowd();
    this.surfaces = [];
    this.front = 1.0;
    this.deckLayout = [];
    this.rng = makeRng(1912);
  }

  paint(geometry, color, glow) {
    geometry.deleteAttribute('uv');
    const tint = new THREE.Color(color);
    const count = geometry.attributes.position.count;
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      values[i * 3] = tint.r;
      values[i * 3 + 1] = tint.g;
      values[i * 3 + 2] = tint.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
    (glow ? this.glow : this.solid).push(geometry);
  }

  // Rooms are authored with the open side at z = 1 and the back wall near z = -6. The section plane
  // leans back on the upper decks, so each room's depth is squeezed between its own cut edge and its wall.
  zc(z) {
    const squeeze = Math.min(0.82, Math.max(0.4, (this.front - (PARTITION_Z + 0.45)) / 7));
    return this.front + (z - 1.0) * squeeze;
  }

  box(cx, bottom, cz, w, h, d, color, glow = false) {
    this.rawBox(cx, bottom, this.zc(cz), w, h, d, color, glow);
  }

  cyl(cx, bottom, cz, radius, length, color, options = {}) {
    this.rawCyl(cx, bottom, this.zc(cz), radius, length, color, options);
  }

  ellipsoid(cx, cy, cz, sx, sy, sz, color, glow = false) {
    this.rawEllipsoid(cx, cy, this.zc(cz), sx, sy, sz, color, glow);
  }

  rawBox(cx, bottom, cz, w, h, d, color, glow = false) {
    this.surfaces.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top: bottom + h });
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(cx, bottom + h / 2, cz);
    this.paint(geometry, color, glow);
  }

  // axis 'y': bottom is the base. axis 'x' or 'z': bottom is the centre height.
  rawCyl(cx, bottom, cz, radius, length, color, options = {}) {
    const { axis = 'y', glow = false, topRadius = radius } = options;
    if (axis === 'y') {
      this.surfaces.push({ x0: cx - topRadius, x1: cx + topRadius, z0: cz - topRadius, z1: cz + topRadius, top: bottom + length });
    }
    const geometry = new THREE.CylinderGeometry(topRadius, radius, length, 12);
    if (axis === 'x') geometry.rotateZ(Math.PI / 2);
    if (axis === 'z') geometry.rotateX(Math.PI / 2);
    geometry.translate(cx, axis === 'y' ? bottom + length / 2 : bottom, cz);
    this.paint(geometry, color, glow);
  }

  rawEllipsoid(cx, cy, cz, sx, sy, sz, color, glow = false) {
    const geometry = new THREE.SphereGeometry(1, 14, 10);
    geometry.scale(sx, sy, sz);
    geometry.translate(cx, cy, cz);
    this.paint(geometry, color, glow);
  }

  dome(cx, baseY, cz, sx, sy, sz, color) {
    const geometry = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(sx, sy, sz);
    geometry.translate(cx, baseY, this.zc(cz));
    this.paint(geometry, color, true);
  }

  light(x, y, z, intensity = 150, color = AMBER) {
    this.lights.push({ x, y, z, intensity, color });
  }

  person(kind, x, y, z, rotation = 0, pose = 'stand', scale = 1) {
    this.crowd.add(makeSpec(kind, this.rng), pose, x, y, this.zc(z), rotation, scale);
  }

  // Same, at an exact world z (no room squeeze).
  personAt(kind, x, y, z, rotation = 0, pose = 'stand', scale = 1) {
    this.crowd.add(makeSpec(kind, this.rng), pose, x, y, z, rotation, scale);
  }

  // Highest surface a foot at (x, z) can stand on: a deck slab or a prop top between
  // 'drop' below and 'climb' above the requested height. Null when nothing is there.
  supportAt(x, y, z, drop = 1.0, climb = 0.15) {
    let best = null;
    const consider = (top) => {
      if (top > y + climb || top < y - drop) return;
      if (best === null || top > best) best = top;
    };
    for (const top of deckTopsAt(this.deckLayout, x, z)) consider(top);
    for (const box of this.surfaces) {
      if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) consider(box.top);
    }
    return best;
  }

  // How far each standing figure's feet are above (or below) what is under them.
  // raw: use the heights the rooms asked for, before they were dropped onto a surface.
  floatingFigures(raw = false, limit = 12, tolerance = 0.02) {
    let count = 0;
    let sunk = 0;
    let worst = 0;
    let checked = 0;
    const offenders = [];
    for (const figure of this.crowd.figures) {
      if (figure.pose === 'swim') continue;
      checked += 1;
      const y = raw ? figure.requestedY : figure.y;
      let figureWorst = 0;
      let figureSunk = 0;
      for (const point of Crowd.footPoints(figure)) {
        const support = this.supportAt(point.x, y, point.z, 50, 0.15);
        const offset = support === null ? Infinity : y - support;
        if (offset > figureWorst) figureWorst = offset;
        if (offset < figureSunk) figureSunk = offset;
      }
      if (figureWorst > tolerance) {
        count += 1;
        if (figureWorst > worst) worst = figureWorst;
        offenders.push({ x: +figure.x.toFixed(1), y: +y.toFixed(2), z: +figure.z.toFixed(2), pose: figure.pose, offset: +figureWorst.toFixed(2) });
      }
      if (figureSunk < -tolerance) sunk += 1;
    }
    offenders.sort((a, b) => b.offset - a.offset);
    return { checked, count, worst: +worst.toFixed(3), sunk, offenders: offenders.slice(0, limit) };
  }

  crowdMeshes() {
    this.crowd.settle((x, y, z) => this.supportAt(x, y, z));
    return this.crowd.build(new THREE.MeshLambertMaterial({}));
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  between(a, b) {
    return a + (b - a) * this.rng();
  }

  meshes() {
    const group = new THREE.Group();
    const lit = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const lamp = new THREE.MeshBasicMaterial({ vertexColors: true });
    if (this.solid.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.solid), lit);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (this.glow.length) {
      group.add(new THREE.Mesh(mergeGeometries(this.glow), lamp));
    }
    return group;
  }
}

function span(room, margin = 1.2) {
  return [room.x0 + margin, room.x1 - margin];
}

function chandelier(stage, x, y, z) {
  stage.cyl(x, y, z, 0.5, 0.3, '#ffd98a', { glow: true });
  stage.cyl(x, y + 0.3, z, 0.04, 0.5, '#6b5a3a');
}

const LOOK = {
  dining: { wall: '#ece4d0', floor: '#8a5a35' },
  dining2: { wall: '#c9a46a', floor: '#6e4a2e' },
  lounge: { wall: '#3e6a4a', floor: '#8e2f2b' },
  smoking: { wall: '#4a2f1d', floor: '#5a2a28' },
  reading: { wall: '#8a9a74', floor: '#7a3a3a' },
  reception: { wall: '#d9b98a', floor: '#2f4a63' },
  promenade: { wall: '#efe8d6', floor: '#b79a6a' },
  staterooms: { wall: '#e8dfc8', floor: '#a07a54' },
  corridor: { wall: '#8f8468', floor: '#5f564a', power: 50 },
  bunks: { wall: '#e6e2d6', floor: '#7a7468', power: 60 },
  cabins3: { wall: '#e6e2d6', floor: '#7a7468', power: 60 },
  dining3: { wall: '#e6e2d6', floor: '#7a7468', power: 65 },
  pool: { wall: '#4fa3b2', floor: '#b9d9d9', light: '#d8f4ff' },
  turkish: { wall: '#a8473a', floor: '#d9c9a8' },
  squash: { wall: '#f0ebe0', floor: '#d9a85c', light: '#fff4e0' },
  mail: { wall: '#a89a78', floor: '#6a5a44', power: 60 },
  gym: { wall: '#e0d8c0', floor: '#9a7a54' },
  bridge: { wall: '#e8dcc0', floor: '#8a6a44' },
  officers: { wall: '#d8c9a4', floor: '#6b4a2e' },
  marconi: { wall: '#5b4a3a', floor: '#4a3a2c' },
  boiler: { wall: '#2b2a28', floor: '#3b3936' },
  engine: { wall: '#7e848c', floor: '#575b61', light: '#fff0d8', power: 70 },
  turbine: { wall: '#7e848c', floor: '#575b61', light: '#fff0d8', power: 70 },
  shafts: { wall: '#7e848c', floor: '#575b61', light: '#fff0d8' },
  hold: { wall: '#6a5a44', floor: '#4a3e2e' },
};

function shell(stage, room) {
  const height = room.ceil - room.floor;
  const width = room.x1 - room.x0;
  const centerX = (room.x0 + room.x1) / 2;
  const look = LOOK[room.id] || LOOK[room.kind] || {};
  stage.rawBox(centerX, room.floor, PARTITION_Z - 0.15, width, height, 0.3, look.wall || room.wall);
  stage.rawBox(centerX, room.floor, (PARTITION_Z + stage.front) / 2, width, 0.04, stage.front - PARTITION_Z, look.floor || '#8a7a62');
  // Section-cut bulkheads at both ends, dark brown like the plate's cut walls.
  for (const x of [room.x0, room.x1]) {
    const wallFront = Math.min(-1.4, stage.front);
    stage.rawBox(x, room.floor, (PARTITION_Z + wallFront) / 2, 0.4, height, wallFront - PARTITION_Z, '#8d6a47');
  }
  if (room.roof) {
    stage.rawBox(centerX, room.ceil, (PARTITION_Z - 0.2 + stage.front) / 2, width + 0.6, 0.35, stage.front - PARTITION_Z + 0.2, '#f1e8d2');
  }
  if (room.windows || room.floor >= DECK.B) {
    for (let x = room.x0 + 2; x < room.x1 - 1; x += 3.2) {
      stage.rawBox(x, room.floor + 0.9, PARTITION_Z + 0.08, 1.5, Math.min(1.3, height - 1.3), 0.08, '#cfe0e6', true);
    }
  } else if (room.floor > DECK.G) {
    for (let x = room.x0 + 2; x < room.x1 - 1; x += 3.6) {
      stage.rawCyl(x, room.floor + 1.5, PARTITION_Z + 0.1, 0.32, 0.1, '#bcd2d8', { axis: 'z', glow: true });
    }
  }
  const lightHeight = room.floor + Math.min(height - 0.5, 3.4);
  if (!['hold', 'shafts', 'boiler'].includes(room.kind)) {
    const lights = Math.max(1, Math.round(width / 28));
    for (let i = 0; i < lights; i++) {
      const x = room.x0 + (width * (i + 0.5)) / lights;
      stage.light(x, lightHeight, -1.0, look.power || 80, look.light || AMBER);
    }
  }
}

const FILL = {};

FILL.dining = (stage, room) => {
  const [a, b] = span(room, 1.5);
  const rows = [-5.0, -2.4, -0.2];
  const mix = room.mix || ['first'];
  for (const z of rows) {
    stage.box((a + b) / 2, room.floor + 0.72, z, b - a, 0.08, 1.2, '#f6f1e4');
    for (const side of [-1, 1]) {
      stage.box((a + b) / 2, room.floor, z + side * 1.05, b - a, 0.45, 0.35, '#7a4f30');
    }
    for (let x = a + 0.5; x < b; x += 1.1) {
      for (const side of [-1, 1]) {
        stage.person(stage.pick(mix), x, room.floor + 0.05, z + side * 0.95, side > 0 ? Math.PI : 0, 'sit');
        stage.box(x, room.floor + 0.8, z + side * 0.4, 0.3, 0.05, 0.3, '#ffffff');
      }
      if (Math.floor(x) % 3 === 0) stage.cyl(x, room.floor + 0.8, z, 0.08, 0.35, '#ffd98a', { glow: true });
    }
  }
  for (let x = a + 2; x < b - 2; x += 8) {
    stage.person('steward', x + stage.between(0, 3), room.floor, 0.5, stage.between(-0.4, 0.4), 'carry');
  }
  for (let x = a + 6; x < b; x += 14) chandelier(stage, x, room.ceil - 1.2, -2);
};

FILL.reception = (stage, room) => {
  const [a, b] = span(room);
  for (let i = 0; i < 3; i++) {
    const x = a + 2 + i * 3.8;
    stage.cyl(x, room.floor, -3.0, 0.7, 0.75, '#6b4a2a');
    stage.person('first', x - 1.1, room.floor, -3.0, Math.PI / 2, 'sit');
    stage.person('first', x + 1.1, room.floor, -3.0, -Math.PI / 2, 'sit');
  }
  for (let i = 0; i < 5; i++) {
    stage.person('first', a + 1 + i * 2.2, room.floor, stage.between(-1.5, 0.4), stage.between(-0.5, 0.5), i % 2 ? 'stand' : 'raise');
  }
  for (let i = 0; i < 5; i++) {
    const x = a + 1.2 + i * 2.0;
    stage.person('first', x, room.floor, -5.2, 0, 'stand');
    stage.box(x, room.floor + 1.1, -5.0, 0.4, 0.6, 0.15, '#4a3322');
  }
  stage.box((a + b) / 2, room.floor, -5.9, b - a - 2, 1.6, 0.4, '#a8322b');
  chandelier(stage, (a + b) / 2, room.ceil - 1.2, -2.5);
};

FILL.lounge = (stage, room) => {
  const [a, b] = span(room);
  stage.box((a + b) / 2, room.floor, -3, b - a, 0.06, 6, '#9b3a32');
  stage.box((a + b) / 2, room.floor, -5.9, 5, 2.3, 0.5, '#4a2a1a');
  stage.box((a + b) / 2, room.floor + 0.2, -5.6, 3.2, 1.2, 0.2, AMBER, true);
  for (let x = a + 1; x < b - 1; x += 5.5) {
    stage.box(x + 1.5, room.floor, -5.2, 3.2, 0.5, 1.1, '#3f6b45');
    stage.box(x + 1.5, room.floor + 0.5, -5.6, 3.2, 0.7, 0.3, '#3f6b45');
    for (let i = 0; i < 3; i++) stage.person('first', x + 0.5 + i * 1.0, room.floor + 0.05, -5.0, 0, 'sit');
    stage.cyl(x + 4.6, room.floor, -3.0, 0.65, 0.7, '#6b4a2a');
    stage.cyl(x + 4.6, room.floor + 0.7, -3.0, 0.1, 0.5, '#ffd98a', { glow: true });
    stage.person('first', x + 3.6, room.floor + 0.05, -3.0, Math.PI / 2, 'sit');
    stage.person('first', x + 5.6, room.floor + 0.05, -3.0, -Math.PI / 2, 'sit');
  }
  for (let i = 0; i < 12; i++) {
    stage.person(i % 5 === 0 ? 'steward' : 'first', stage.between(a, b), room.floor, stage.between(-2, 0.5), stage.between(-0.6, 0.6), i % 3 ? 'stand' : 'raise');
  }
  for (const x of [a + 0.5, b - 0.5]) {
    stage.cyl(x, room.floor, -4.8, 0.35, 0.7, '#7a4a2a');
    stage.ellipsoid(x, room.floor + 1.5, -4.8, 0.9, 0.9, 0.9, '#4f7a3a');
  }
  chandelier(stage, (a + b) / 2, room.ceil - 1.1, -2.5);
};

FILL.smoking = (stage, room) => {
  const [a, b] = span(room);
  for (let x = a + 2; x < b - 2; x += 5) {
    stage.box(x, room.floor, -3.2, 1.5, 0.75, 1.5, '#2f5a3a');
    stage.box(x, room.floor + 0.75, -3.2, 0.5, 0.04, 0.5, '#f6f1e4');
    for (const [dx, dz, rot] of [[-1.2, 0, Math.PI / 2], [1.2, 0, -Math.PI / 2], [0, 1.2, Math.PI], [0, -1.2, 0]]) {
      stage.person('first', x + dx, room.floor + 0.05, -3.2 + dz, rot, 'sit');
    }
  }
  for (let i = 0; i < 6; i++) {
    stage.person('first', stage.between(a, b), room.floor, stage.between(-1.2, 0.5), stage.between(-0.5, 0.5), 'stand');
  }
  stage.box((a + b) / 2, room.floor, -5.9, 4.2, 2.0, 0.5, '#2a1a10');
  stage.box((a + b) / 2, room.floor + 0.2, -5.6, 2.6, 1.0, 0.2, AMBER, true);
  for (let x = a + 3; x < b - 3; x += 9) {
    stage.box(x, room.floor + 1.2, -5.95, 1.8, 1.4, 0.1, '#b8553f', true);
  }
};

FILL.reading = (stage, room) => {
  const [a, b] = span(room);
  for (let x = a + 1.5; x < b - 1; x += 3.2) {
    stage.box(x, room.floor + 0.7, -4.6, 1.6, 0.06, 0.9, '#5b3a22');
    stage.box(x, room.floor, -4.6, 0.2, 0.7, 0.8, '#5b3a22');
    stage.cyl(x + 0.5, room.floor + 0.76, -4.6, 0.12, 0.4, '#ffd98a', { glow: true });
    stage.person('first', x, room.floor + 0.05, -3.6, Math.PI, 'sit');
  }
  for (let i = 0; i < 4; i++) {
    stage.person('first', stage.between(a + 1, b - 1), room.floor, stage.between(-2.2, 0.4), 0, 'stand');
  }
  stage.box((a + b) / 2, room.floor, -1.8, 2.2, 0.5, 1.0, '#8a3a32');
};

FILL.promenade = (stage, room) => {
  const [a, b] = span(room);
  for (let x = a + 1; x < b; x += 2.4) {
    stage.box(x, room.floor + 0.3, -0.6, 0.9, 0.12, 1.7, '#b8864a');
    stage.box(x, room.floor + 0.4, -1.5, 0.9, 0.7, 0.1, '#b8864a');
    stage.person(stage.pick(['first', 'first', 'second']), x, room.floor + 0.05, -0.55, 0, 'sit');
    stage.box(x, room.floor + 0.42, 0.1, 0.9, 0.1, 0.5, stage.pick(['#8a3a32', '#3f5a7a', '#c8a83a']));
  }
  for (let i = 0; i < 6; i++) {
    stage.person(stage.pick(['first', 'steward', 'first']), stage.between(a, b), room.floor, stage.between(-4.2, -2.4), stage.pick([1.2, -1.2]), 'walk');
  }
};

FILL.staterooms = (stage, room) => {
  const cabinWidth = 6.2;
  for (let x = room.x0 + 0.3; x + cabinWidth <= room.x1 + 0.1; x += cabinWidth) {
    stage.box(x, room.floor, -4.0, 0.3, room.ceil - room.floor, 4.4, '#9a7a52');
    stage.box(x + 2.2, room.floor, -5.1, 2.2, 0.5, 1.5, '#6b4a2a');
    stage.box(x + 2.2, room.floor + 0.5, -5.1, 2.1, 0.18, 1.4, stage.pick(['#f1ece0', '#c9d6df', '#e6c9b8']));
    stage.box(x + 4.8, room.floor, -5.3, 1.0, 1.9, 0.8, '#5b3a22');
    stage.cyl(x + 1.0, room.floor, -3.0, 0.45, 0.8, '#7a4a2a');
    stage.cyl(x + 1.0, room.floor + 0.8, -3.0, 0.1, 0.4, '#ffd98a', { glow: true });
    stage.person(stage.pick(['first', 'first', 'second']), x + 2.4, room.floor + 0.3, -4.6, 0, 'sit');
    stage.person(stage.pick(['first', 'second']), x + 4.0, room.floor, stage.between(-3.2, -1.4), stage.between(-0.6, 0.6), stage.pick(['stand', 'raise']));
    if (stage.rng() < 0.55) stage.person('steward', x + 1.2, room.floor, -1.0, 0, 'carry');
  }
};

FILL.corridor = (stage, room) => {
  const [a, b] = span(room);
  for (let x = a; x < b; x += 4) {
    stage.rawBox(x, room.floor, PARTITION_Z + 0.1, 1.0, 2.0, 0.1, '#5b3a22');
  }
  stage.cyl((a + b) / 2, room.ceil - 0.5, -5.6, 0.18, b - a, '#8a8a86', { axis: 'x' });
  for (let i = 0; i < 18; i++) {
    const kind = stage.pick(['third', 'third', 'steward', 'stoker', 'sailor', 'child']);
    stage.person(kind, stage.between(a, b), room.floor, stage.between(-4.5, 0.4), stage.pick([Math.PI / 2, -Math.PI / 2, 0]), 'walk');
  }
};

FILL.bunks = (stage, room) => {
  const [a, b] = span(room, 0.8);
  let bunkIndex = 0;
  for (let x = a; x < b; x += 2.2) {
    // a berth with someone sitting up has no berth above it; the next one is a made-up pair
    const occupied = bunkIndex % 2 === 0;
    bunkIndex += 1;
    for (const level of occupied ? [0.2] : [0.2, 1.3]) {
      stage.box(x + 0.9, room.floor + level, -5.2, 1.9, 0.12, 1.5, '#6b4a2a');
      stage.box(x + 0.9, room.floor + level + 0.12, -5.2, 1.8, 0.14, 1.4, stage.pick(['#6a7a8a', '#8a6a5a', '#7a7a5a']));
    }
    if (occupied) stage.person(room.id === 'firemen' ? 'stoker' : 'sailor', x + 0.9, room.floor + 0.46, -5.7, 0, 'sit');
  }
  for (let i = 0; i < Math.round((b - a) / 3); i++) {
    stage.person(room.id === 'firemen' ? 'stoker' : 'sailor', stage.between(a, b), room.floor, stage.between(-3.2, 0.2), stage.between(-0.7, 0.7), stage.pick(['stand', 'sit', 'raise']));
  }
};

FILL.cabins3 = (stage, room) => {
  const [a, b] = span(room, 0.8);
  let cabinIndex = 0;
  for (let x = a; x < b; x += 3.4) {
    const occupied = cabinIndex % 2 === 0;
    cabinIndex += 1;
    for (const level of occupied ? [0.2] : [0.2, 1.25]) {
      stage.box(x + 1.2, room.floor + level, -5.2, 2.4, 0.1, 1.5, '#8a6a42');
      stage.box(x + 1.2, room.floor + level + 0.1, -5.2, 2.2, 0.14, 1.4, stage.pick(['#a8a090', '#7a6a58', '#8a9aa8']));
    }
    if (occupied) stage.person('third', x + 0.8, room.floor + 0.44, -5.7, 0, 'sit');
    stage.person('third', Math.min(x + 1.9, room.x1 - 0.8), room.floor, stage.between(-4.2, -0.8), stage.between(-0.6, 0.6), 'stand');
    if (stage.rng() < 0.5) stage.person('child', Math.min(x + 2.7, room.x1 - 0.8), room.floor, stage.between(-1.6, 0.4), 0, 'stand');
    stage.box(x + 3.0, room.floor, -2.6, 0.9, 0.55, 0.6, '#5b3a22');
  }
};

FILL.dining3 = (stage, room) => {
  const [a, b] = span(room, 1.3);
  for (const z of [-4.4, -2.0, 0.0]) {
    stage.box((a + b) / 2, room.floor + 0.7, z, b - a, 0.07, 1.0, '#c9b48a');
    for (const side of [-1, 1]) {
      stage.box((a + b) / 2, room.floor, z + side * 0.95, b - a, 0.42, 0.3, '#7a5a3a');
    }
    for (let x = a + 0.4; x < b; x += 0.95) {
      for (const side of [-1, 1]) {
        stage.person(stage.pick(['third', 'third', 'child']), x, room.floor + 0.04, z + side * 0.9, side > 0 ? Math.PI : 0, 'sit');
      }
      if (Math.floor(x) % 4 === 0) stage.cyl(x, room.floor + 0.77, z, 0.1, 0.3, '#d8d0b8');
    }
  }
  for (let x = a + 3; x < b; x += 10) stage.person('steward', x, room.floor, 0.5, 0, 'carry');
};

FILL.pool = (stage, room) => {
  const [a, b] = span(room, 1.0);
  stage.box((a + b) / 2, room.floor, -3, b - a, 0.55, 6.6, '#c7e6e4');
  stage.box((a + b) / 2, room.floor + 0.55, -3, b - a - 0.5, 0.06, 6.0, '#4fb4bd');
  stage.box((a + b) / 2, room.floor + 0.62, -3, b - a - 0.5, 0.02, 6.0, '#7fd3d6', true);
  for (let i = 0; i < 9; i++) {
    stage.person(i % 4 === 0 ? 'child' : 'first', stage.between(a + 1, b - 1), room.floor - 0.35, stage.between(-4.8, -0.2), stage.between(-1, 1), 'swim');
  }
  stage.person('steward', a + 1, room.floor, 0.5, 0, 'stand');
  stage.person('steward', b - 1, room.floor, 0.5, 0, 'stand');
};

FILL.turkish = (stage, room) => {
  const [a, b] = span(room, 0.8);
  for (let x = a; x < b - 1; x += 3.2) {
    stage.box(x + 1.4, room.floor, -4.2, 2.6, 0.5, 1.0, '#7a3a2a');
    stage.box(x + 1.4, room.floor + 0.5, -4.2, 2.4, 0.1, 0.9, '#f1ece0');
    stage.person('first', x + 1.4, room.floor + 0.6, -4.7, 0, 'sit');
    stage.cyl(x + 1.4, room.floor + 2.0, -3.0, 0.3, 0.3, '#ff8a3a', { glow: true });
  }
  for (let i = 0; i < 3; i++) stage.person('steward', stage.between(a, b), room.floor, stage.between(-2, 0.3), 0, 'stand');
};

FILL.squash = (stage, room) => {
  const [a, b] = span(room, 0.8);
  stage.box((a + b) / 2, room.floor, -3, b - a, 0.05, 6.4, '#e0b878');
  stage.box((a + b) / 2, room.floor + 0.4, -6.0, b - a, 0.1, 0.2, '#b83a2a', true);
  stage.person('first', a + 3, room.floor, -3.4, 0.3, 'raise');
  stage.person('first', b - 3, room.floor, -2.0, -0.4, 'work');
  stage.ellipsoid((a + b) / 2, room.floor + 2.1, -3.5, 0.12, 0.12, 0.12, '#222');
  for (let x = a + 1.5; x < b - 1; x += 2.2) stage.person('first', x, room.floor, 0.5, 0, 'stand');
};

FILL.mail = (stage, room) => {
  const [a, b] = span(room, 0.8);
  for (let x = a; x < b - 1.5; x += 2.4) {
    stage.box(x + 1, room.floor, -5.4, 2.0, 2.0, 0.8, '#7a5a3a');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        stage.box(x + 0.4 + col * 0.6, room.floor + 0.3 + row * 0.45, -4.95, 0.45, 0.3, 0.1, stage.pick(['#f1ece0', '#d8c8a0', '#c9b080']));
      }
    }
    stage.person('steward', x + 1, room.floor, -3.8, 0, 'work');
  }
  for (let i = 0; i < 7; i++) {
    stage.ellipsoid(stage.between(a, b), room.floor + 0.35, stage.between(-2.5, 0.2), 0.7, 0.4, 0.45, '#b99a62');
  }
};

FILL.gym = (stage, room) => {
  const [a, b] = span(room, 1.0);
  for (let x = a + 1; x < b - 1; x += 3.2) {
    stage.box(x, room.floor, -4.4, 2.2, 0.2, 0.5, '#8a8a86');
    stage.box(x - 0.6, room.floor + 0.2, -4.4, 0.5, 0.2, 0.6, '#5b3a22');
    stage.person('first', x - 0.6, room.floor + 0.2, -4.3, 0, 'work');
    stage.cyl(x + 1.0, room.floor + 1.0, -2.2, 0.55, 0.12, '#bfbfb8', { axis: 'x' });
    stage.cyl(x + 1.0, room.floor + 0.3, -2.2, 0.55, 0.12, '#bfbfb8', { axis: 'x' });
    stage.box(x + 1.0, room.floor + 0.2, -2.2, 0.1, 1.3, 0.1, '#6a6a66');
    stage.person('first', x + 1.0, room.floor + 0.2, -2.2, 0, 'sit');
  }
  stage.person('officer', b - 1, room.floor, -0.6, 0, 'stand');
  stage.box(a + 1, room.floor, -5.5, 0.4, 2.3, 0.4, '#8a5a35');
  stage.box(b - 1, room.floor, -5.5, 0.4, 2.3, 0.4, '#8a5a35');
};

FILL.bridge = (stage, room) => {
  const [a, b] = span(room, 0.8);
  stage.cyl((a + b) / 2, room.floor + 1.0, -3.0, 0.7, 0.12, '#7a4a2a', { axis: 'z' });
  stage.cyl((a + b) / 2, room.floor, -3.0, 0.2, 1.0, '#8a8a86');
  stage.box(b - 0.6, room.floor, -4.6, 0.5, 1.5, 0.5, '#c9973c');
  stage.box(a + 0.6, room.floor, -4.6, 0.5, 1.5, 0.5, '#c9973c');
  stage.box((a + b) / 2, room.floor + 0.8, -5.6, 3.0, 0.1, 0.8, '#e8dcc0');
  stage.person('captain', (a + b) / 2 + 1.5, room.floor, -1.2, 0.2, 'stand');
  stage.person('officer', (a + b) / 2 - 1.8, room.floor, -2.0, -0.2, 'raise');
  stage.person('sailor', (a + b) / 2, room.floor, -2.4, 0, 'work');
  stage.person('officer', a + 0.6, room.floor, -0.3, 0, 'stand');
  stage.person('sailor', b - 0.6, room.floor, -3.8, 0, 'stand');
  stage.box(room.x1 - 0.1, room.floor + 1.0, -2.2, 0.1, 1.5, 6.8, '#cfe0e6', true);
};

FILL.officers = (stage, room) => {
  const [a, b] = span(room, 0.8);
  for (let x = a; x < b - 2; x += 3.6) {
    stage.box(x + 1.4, room.floor, -5.2, 2.6, 0.55, 1.4, '#5b3a22');
    stage.box(x + 1.4, room.floor + 0.55, -5.2, 2.4, 0.15, 1.3, '#4a5f86');
    stage.person('officer', x + 1.4, room.floor + 0.6, -5.3, 0, 'sit');
  }
  stage.box((a + b) / 2, room.floor + 0.7, -2.6, 2.0, 0.08, 1.0, '#4a3322');
  stage.person('captain', (a + b) / 2, room.floor + 0.04, -1.3, Math.PI, 'sit');
  stage.person('officer', b - 1.2, room.floor, -0.5, 0, 'stand');
};

FILL.marconi = (stage, room) => {
  const [a, b] = span(room, 0.8);
  stage.box((a + b) / 2, room.floor + 0.75, -4.6, b - a - 1.2, 0.08, 1.4, '#5b3a22');
  stage.box((a + b) / 2, room.floor, -4.6, 0.3, 0.75, 1.2, '#5b3a22');
  stage.box((a + b) / 2, room.floor + 0.83, -5.1, 2.8, 0.9, 0.5, '#3a3a40');
  for (let i = 0; i < 4; i++) {
    stage.cyl(a + 1.4 + i * 1.8, room.floor + 1.0, -4.0, 0.12, 0.15, '#6fb3ff', { glow: true });
  }
  stage.person('marconi', a + 2.3, room.floor + 0.04, -3.4, Math.PI, 'sit');
  stage.person('marconi', b - 2.3, room.floor + 0.04, -3.4, Math.PI, 'sit');
  stage.person('sailor', (a + b) / 2, room.floor, -0.8, 0, 'carry');
};

FILL.boiler = (stage, room) => {
  const count = room.count;
  const width = room.x1 - room.x0;
  const pitch = width / count;
  const radius = Math.min(1.5, pitch * 0.44);
  const centerY = room.floor + 0.75 + radius;
  const centerX = (room.x0 + room.x1) / 2;
  const height = room.ceil - room.floor;
  // dark uptake casing across the back, coal bunkers at both ends, a steam main overhead
  stage.rawBox(centerX, room.floor, PARTITION_Z + 0.5, width - 0.4, height, 1.0, '#26262b');
  for (const x of [room.x0 + 0.9, room.x1 - 0.9]) {
    stage.rawBox(x, room.floor, -1.9, 1.5, 3.4, 3.0, '#161412');
    stage.rawEllipsoid(x + (x < centerX ? 1.1 : -1.1), room.floor + 0.4, 0.4, 0.9, 0.5, 1.0, '#1a1816');
  }
  stage.rawCyl(centerX, room.floor + height - 1.0, -2.8, 0.28, width - 2, '#8a8f98', { axis: 'x' });
  for (let i = 0; i < count; i++) {
    const x = room.x0 + pitch * (i + 0.5);
    stage.rawBox(x, room.floor, -1.5, radius * 1.5, 0.75, 3.4, '#2c2b2d');
    // the drum lies athwartships, its round end with the furnace doors facing the stokehold
    stage.rawCyl(x, centerY, -1.5, radius, 3.6, '#686c74', { axis: 'z' });
    stage.rawCyl(x, centerY, -0.5, radius + 0.06, 0.16, '#34363b', { axis: 'z' });
    stage.rawCyl(x, centerY, -2.5, radius + 0.06, 0.16, '#34363b', { axis: 'z' });
    stage.rawCyl(x, centerY, 0.32, radius * 0.94, 0.12, '#2e2d30', { axis: 'z' });
    const doorCount = radius > 1.2 ? 3 : 2;
    for (let door = 0; door < doorCount; door++) {
      const offset = (door - (doorCount - 1) / 2) * radius * 0.7;
      stage.rawCyl(x + offset, centerY - radius * 0.32, 0.4, radius * 0.22, 0.1, '#ff5a1c', { axis: 'z', glow: true });
      stage.rawCyl(x + offset, centerY - radius * 0.32, 0.46, radius * 0.12, 0.06, '#ffc860', { axis: 'z', glow: true });
    }
    stage.rawCyl(x, centerY + radius * 0.35, 0.4, radius * 0.1, 0.1, '#c9a24a', { axis: 'z' });
    stage.person('stoker', x - radius * 0.35, room.floor, 1.45, Math.PI, 'shovel');
    if (i % 2 === 0) stage.person('stoker', x + radius * 0.55, room.floor, 1.6, Math.PI, 'shovel');
    if (i % 2 === 1) {
      stage.rawBox(x + 0.6, room.floor + 0.25, 3.1, 0.9, 0.35, 0.6, '#1c1a18');
      stage.person('stoker', x + 1.3, room.floor, 3.2, -Math.PI / 2, 'walk');
    }
  }
  stage.rawBox(room.x0 + 1.8, room.floor, 2.4, 1.2, 0.55, 1.1, '#1c1a18');
  stage.light(centerX, room.floor + 1.6, 2.4, 260, '#ff5a1e');
  stage.person('officer', room.x1 - 1.6, room.floor, 1.2, 0, 'raise');
};

FILL.turbine = (stage, room) => {
  const [a, b] = span(room, 0.8);
  stage.cyl((a + b) / 2, room.floor + 3.0, -2.4, 2.2, b - a, '#7f8590', { axis: 'x', topRadius: 2.0 });
  stage.box((a + b) / 2, room.floor, -2.4, b - a - 1, 1.4, 4.0, '#4a4d54');
  for (let x = a + 1.5; x < b - 1; x += 3) stage.cyl(x, room.floor + 3.0, -2.4, 2.3, 0.25, '#bd8a3a', { axis: 'x' });
  stage.cyl((a + b) / 2, room.floor + 6.2, -3.5, 0.4, b - a, '#bd8a3a', { axis: 'x' });
  for (let i = 0; i < 4; i++) {
    stage.person('engineer', a + 1 + i * 3.4, room.floor, stage.between(-0.2, 1.0), stage.between(-0.4, 0.4), i % 2 ? 'work' : 'stand');
  }
};

FILL.engine = (stage, room) => {
  const [a] = span(room);
  for (const origin of [a + 0.5, a + 15.5]) {
    stage.box(origin + 6.5, room.floor, -3.0, 13, 1.3, 4.6, '#3a3d44');
    for (let c = 0; c < 4; c++) {
      const x = origin + 1.6 + c * 3.2;
      stage.cyl(x, room.floor + 1.3, -3.0, 1.1, 4.4, '#6c717a');
      stage.cyl(x, room.floor + 5.7, -3.0, 0.3, 4.6, '#c8c8c0');
      stage.cyl(x, room.floor + 10.2, -3.0, 0.9, 0.5, '#8a8a86');
      for (const dz of [-1.7, 1.7]) {
        stage.cyl(x + 0.9, room.floor + 1.3, -3.0 + dz, 0.22, 6.2, '#4f6a8a');
      }
    }
    stage.box(origin + 6.5, room.floor + 7.4, -3.0, 13, 0.4, 4.8, '#5a5e66');
    stage.cyl(origin + 6.5, room.floor + 11.4, -3.0, 0.35, 13, '#c8c8c0', { axis: 'x' });
  }
  stage.box((a + room.x1) / 2, room.floor + 6.4, 0.6, room.x1 - a - 2, 0.12, 1.8, '#4a4a50');
  for (let x = a + 1; x < room.x1 - 1; x += 3) {
    stage.box(x, room.floor + 6.5, 1.5, 0.08, 0.9, 0.08, '#4a4a50');
    stage.person('engineer', x + 0.5, room.floor + 6.5, 0.6, stage.between(-0.5, 0.5), stage.pick(['stand', 'work', 'raise']));
    stage.person('engineer', x + 1.4, room.floor, 2.0, stage.between(-0.5, 0.5), stage.pick(['stand', 'work', 'walk']));
  }
  stage.box(room.x1 - 1.5, room.floor, 1.2, 0.5, 1.6, 0.5, '#c9973c');
  stage.person('officer', room.x1 - 2.5, room.floor, 0.6, 0, 'stand');
};

FILL.hold = (stage, room) => {
  const [a, b] = span(room, 0.8);
  const height = room.ceil - room.floor;
  for (let x = a; x < b - 1; x += 2.0) {
    const stack = 1 + Math.floor(stage.rng() * Math.min(3, Math.floor(height / 0.9)));
    for (let level = 0; level < stack; level++) {
      stage.box(x + 0.9, room.floor + level * 0.85, stage.between(-5.0, -3.4), 1.7, 0.85, 1.5, stage.pick(['#8a6a3a', '#a07a46', '#6e5a3a', '#b08a52']));
    }
  }
  for (let i = 0; i < 6; i++) {
    stage.cyl(stage.between(a, b), room.floor, stage.between(-2.8, -0.6), 0.45, 0.9, '#6a4a2a');
  }
  if (room.car) {
    const x = (a + b) / 2;
    stage.box(x, room.floor + 0.4, -1.4, 4.2, 0.7, 1.7, '#a8322b');
    stage.box(x - 0.2, room.floor + 1.1, -1.4, 2.2, 0.7, 1.5, '#8e2a24');
    for (const wx of [-1.4, 1.4]) {
      for (const wz of [-2.2, -0.6]) stage.cyl(x + wx, room.floor + 0.4, wz, 0.4, 0.2, '#222', { axis: 'z' });
    }
  }
  for (let i = 0; i < 4; i++) {
    stage.person(stage.pick(['sailor', 'third', 'stoker']), stage.between(a, b), room.floor, stage.between(-2.6, 0.4), stage.between(-0.8, 0.8), stage.pick(['carry', 'stand', 'walk']));
  }
  stage.light((a + b) / 2, room.floor + height - 0.6, -2.0, 60);
};

FILL.shafts = (stage, room) => {
  const [a, b] = span(room, 0.8);
  stage.cyl((a + b) / 2, room.floor + 1.5, -3.2, 0.45, b - a, '#8a8a86', { axis: 'x' });
  stage.cyl((a + b) / 2, room.floor + 1.5, -1.2, 0.35, b - a, '#6a6a66', { axis: 'x' });
  for (let x = a + 1; x < b; x += 4) stage.box(x, room.floor, -3.2, 0.6, 1.3, 1.2, '#3a3d44');
  stage.person('engineer', a + 5, room.floor, 0.0, 0, 'work');
  stage.person('engineer', a + 14, room.floor, 0.2, 0, 'stand');
  stage.person('stoker', a + 22, room.floor, 0.0, 0, 'walk');
  stage.light((a + b) / 2, room.floor + 2.4, -1.0, 70);
};

FILL.deck = (stage, room) => {
  const [a, b] = span(room, 1.0);
  for (let x = a + 2; x < b; x += 7) {
    stage.cyl(x, room.floor, -1.5, 0.7, 1.1, '#3b3b40');
    stage.cyl(x, room.floor + 1.1, -1.5, 0.9, 0.2, '#8a5a35');
    for (const dx of [-1.4, 1.4]) stage.person('sailor', x + dx, room.floor, -1.5, dx > 0 ? -Math.PI / 2 : Math.PI / 2, 'work');
  }
  for (let x = a + 1; x < b; x += 3.5) stage.box(x, room.floor, 0.8, 0.12, 0.9, 0.12, '#3b3b40');
};

// Grand Staircase from E deck to the boat deck dome: zig-zag flights, landings, balustrade, clock.
function staircase(stage, x0, x1) {
  const width = x1 - x0;
  const levels = [DECK.E, DECK.D, DECK.C, DECK.B, DECK.A, DECK.boat];
  stage.front = cutZ(DECK.D); // one squeeze for the whole well, so the flights line up from deck to deck
  const wellFront = -1.9;
  stage.rawBox((x0 + x1) / 2, DECK.E, PARTITION_Z - 0.15, width, BOAT + 3.4 - DECK.E, 0.3, '#c8a468');
  for (const x of [x0, x1]) stage.rawBox(x, DECK.E, (PARTITION_Z - 1.4) / 2, 0.4, BOAT - DECK.E, -1.4 - PARTITION_Z, '#8d6a47');
  // a gallery floor across the front of the well at every level, so people at the rail stand on something
  for (const level of levels) {
    const edge = cutZ(level);
    if (edge < wellFront + 0.4) continue;
    stage.rawBox((x0 + x1) / 2, level - 0.14, (wellFront + edge) / 2, width - 0.4, 0.14, edge - wellFront, '#c9ad7c');
  }
  for (let level = 0; level < levels.length - 1; level++) {
    const from = levels[level];
    const rise = levels[level + 1] - from;
    const goingForward = level % 2 === 0;
    const steps = 9;
    for (let step = 0; step < steps; step++) {
      const t = (step + 0.5) / steps;
      const x = goingForward ? x0 + 1.2 + t * (width - 2.4) : x1 - 1.2 - t * (width - 2.4);
      const top = from + rise * (step + 1) / steps;
      stage.box(x, from, -3.6, (width - 2.4) / steps + 0.02, top - from, 2.8, '#b88a52');
      stage.box(x, top - 0.04, -2.2, (width - 2.4) / steps, 0.05, 0.12, '#2a2a2e');
      if (step % 2 === 0) stage.box(x, top, -2.2, 0.06, 0.8, 0.06, '#2a2a2e');
    }
    stage.box(goingForward ? x1 - 0.8 : x0 + 0.8, levels[level + 1] - 0.06, -3.2, 1.6, 0.08, 3.4, '#d9c29a');
    // walkers stand on the middle of a step, at that step's own height
    for (let i = 0; i < 4; i++) {
      const step = Math.min(steps - 1, Math.floor(stage.between(0.1, 0.9) * steps));
      const t = (step + 0.5) / steps;
      const x = goingForward ? x0 + 1.2 + t * (width - 2.4) : x1 - 1.2 - t * (width - 2.4);
      const top = from + rise * (step + 1) / steps;
      stage.person(stage.pick(["first", "first", "steward", "child"]), x, top, -3.4, stage.between(-0.4, 0.4) + (goingForward ? Math.PI / 2 : -Math.PI / 2), 'walk');
    }
    const edge = cutZ(levels[level]);
    if (edge > wellFront + 1.0) {
      stage.personAt('first', (x0 + x1) / 2, levels[level], edge - 0.5, 0.2, 'stand');
      stage.personAt('first', (x0 + x1) / 2 + 1.5, levels[level], edge - 0.9, -0.3, 'stand');
    }
  }
  stage.rawCyl((x0 + x1) / 2, DECK.A + 1.5, PARTITION_Z + 0.2, 1.1, 0.2, '#d4a93c', { axis: 'z' });
  stage.rawCyl((x0 + x1) / 2, DECK.A + 1.5, PARTITION_Z + 0.35, 0.85, 0.1, '#f1ece0', { axis: 'z' });
  // glass dome with a glowing centre
  stage.dome((x0 + x1) / 2, BOAT + 3.0, -2.5, width / 2 + 0.5, 3.2, 5.4, '#bfe3e6');
  for (let level = 0; level < levels.length; level++) {
    chandelier(stage, (x0 + x1) / 2, levels[level] + 2.0, -2.0);
    stage.light((x0 + x1) / 2, levels[level] + 1.8, -1.0, 90);
  }
}


// All 20 boats: 10 in davits along the far (port) edge, 7 stowed inboard on the near side, 3 collapsibles on the roofs.
function lifeboat(stage, x, y, z, length = 7.6) {
  stage.rawEllipsoid(x, y, z, length / 2, 0.95, 1.3, '#f3eddc');
  stage.rawEllipsoid(x, y + 0.5, z, length / 2 - 0.5, 0.35, 1.0, '#b8935a');
  stage.rawBox(x, y - 1.0, z, length - 1.2, 0.2, 0.4, '#6b4a2a');
}

function lifeboats(stage) {
  stage.front = cutZ(BOAT);
  for (let i = 0; i < 10; i++) {
    const x = 60 + i * 9.4;
    lifeboat(stage, x, BOAT + 2.3, -10.5);
    for (const dx of [-2.6, 2.6]) {
      stage.rawCyl(x + dx, BOAT, -11.7, 0.13, 4.2, '#2a2a2e');
      stage.rawCyl(x + dx, BOAT + 4.1, -11.1, 0.1, 1.4, '#2a2a2e', { axis: 'z' });
    }
    stage.rawBox(x, BOAT, -11.7, 7.6, 0.1, 0.3, '#2a2a2e');
  }
  const inboard = [58.5, 77.5, 85.5, 103.5, 111.5, 129.5, 137.5];
  inboard.forEach((x, index) => {
    lifeboat(stage, x, BOAT + 1.3, stage.front - 1.5);
    stage.person('sailor', Math.max(x - 3.6, 56.5), BOAT, 0.8, 0, index % 2 ? 'work' : 'stand');
    stage.person('officer', x + 3.6, BOAT, 0.8, 0, 'stand');
    if (index % 2 === 0) stage.person('first', x - 1.0, BOAT, 0.9, 0, 'walk');
  });
  for (const x of [156, 183, 197]) {
    stage.rawEllipsoid(x, ROOF + 0.55, -3.5, 3.2, 0.45, 1.2, '#efe6d0');
  }
  for (let i = 0; i < 6; i++) {
    stage.personAt('sailor', 64 + i * 15, BOAT, -8.2, stage.between(-0.4, 0.4), i % 2 ? 'work' : 'stand');
  }
}

export function buildStage() {
  const stage = new Stage();
  stage.deckLayout = deckLayout(VOIDS);
  for (const room of ROOMS) {
    stage.front = cutZ(room.floor);
    shell(stage, room);
    FILL[room.kind](stage, room);
  }
  staircase(stage, 163, 177);
  lifeboats(stage);
  stage.front = cutZ(DECK.A);
  // Forecastle and poop decks (open air, A deck level at the bow and stern).
  FILL.deck(stage, { x0: 214, x1: 252, floor: DECK.A + 0.3 });
  FILL.deck(stage, { x0: 12, x1: 50, floor: DECK.A + 0.2 });
  for (let i = 0; i < 12; i++) {
    stage.person(stage.pick(['third', 'third', 'child', 'sailor']), stage.between(14, 50), DECK.A + 0.2, stage.between(-3, 0.4), stage.between(-1, 1), stage.pick(['stand', 'walk', 'raise']));
  }
  // Crow's nest lookout and flagstaff
  stage.rawCyl(227.4, 39.3, 0, 0.7, 0.06, '#7a5a3a');
  stage.personAt('sailor', 227.4, 39.36, 0, 0, 'raise');
  stage.cyl(8, DECK.A, -1.0, 0.1, 6, '#3b3b40');
  stage.box(9.2, DECK.A + 4.8, -1.0, 2.4, 1.3, 0.05, '#a8322b');
  return stage;
}
