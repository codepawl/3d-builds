// Where everything stands. Hand-placed landmarks; trees, grass and rocks are scattered around them with a seeded random.
export const CELL = 2.4; // metres per Kenney wall module

export const houses = [
  { name: 'cottage-1', cx: -24, cz: -14, cellsX: 2, cellsZ: 2, yaw: 0, doorSide: 1 },
  { name: 'cottage-2', cx: -16.5, cz: -15.5, cellsX: 2, cellsZ: 3, yaw: 0, doorSide: 1 },
  { name: 'cottage-3', cx: -9, cz: -14, cellsX: 2, cellsZ: 2, yaw: 0, doorSide: 1 },
  { name: 'cottage-4', cx: -25, cz: -5, cellsX: 2, cellsZ: 2, yaw: Math.PI / 2, doorSide: 1 },
  { name: 'cottage-5', cx: -9, cz: -5.5, cellsX: 2, cellsZ: 2, yaw: -Math.PI / 2, doorSide: 1 },
  { name: 'barn', cx: 17, cz: -13, cellsX: 3, cellsZ: 4, yaw: 0, doorSide: 1, scale: 1.25, high: true },
  // Hamlet east: a second village around its own square, with a barn and fields.
  { name: 'east-1', cx: 61, cz: 47, cellsX: 2, cellsZ: 2, yaw: 0.2, doorSide: 1 },
  { name: 'east-2', cx: 72, cz: 44, cellsX: 2, cellsZ: 3, yaw: 0, doorSide: 1 },
  { name: 'east-3', cx: 83, cz: 49, cellsX: 2, cellsZ: 2, yaw: -0.25, doorSide: 1 },
  { name: 'east-4', cx: 63, cz: 63, cellsX: 3, cellsZ: 2, yaw: Math.PI / 2, doorSide: 1 },
  { name: 'east-5', cx: 82, cz: 64, cellsX: 2, cellsZ: 2, yaw: -Math.PI / 2, doorSide: 1 },
  { name: 'east-barn', cx: 96, cz: 78, cellsX: 3, cellsZ: 4, yaw: 0.3, doorSide: 1, scale: 1.25, high: true },
  // Hamlet west-south: a few cottages by the old road.
  { name: 'west-1', cx: -72, cz: -50, cellsX: 2, cellsZ: 2, yaw: 0.4, doorSide: 1 },
  { name: 'west-2', cx: -62, cz: -58, cellsX: 2, cellsZ: 3, yaw: -0.2, doorSide: 1 },
  { name: 'west-3', cx: -80, cz: -62, cellsX: 2, cellsZ: 2, yaw: Math.PI / 2, doorSide: 1 },
];

// Weathered roofs, so red belongs to the worms only. Indexed by house order.
export const ROOF_COLORS = ['#8a6a48', '#6d7682', '#b79d62', '#7a5a3f', '#7d7466', '#9a7d52'];

export const plaza = { x: -17, z: -8.5, radius: 3.6 };
export const plazas = [plaza, { x: 72, z: 55, radius: 3.8 }, { x: -70, z: -57, radius: 2.8 }];
export const pond = { x: -2, z: 9.5, radiusX: 7, radiusZ: 4.6 };
export const paddock = { minX: 7, maxX: 26, minZ: -6, maxZ: 7 };
export const field = { minX: 8, maxX: 15, minZ: -4, maxZ: 3 };
// Every ploughed field (the farm field first), each with its furrows.
export const fields = [
  field,
  { minX: 46, maxX: 58, minZ: 56, maxZ: 68 },
  { minX: 88, maxX: 102, minZ: 52, maxZ: 62 },
  { minX: 70, maxX: 84, minZ: 70, maxZ: 78 },
  { minX: -92, maxX: -82, minZ: -52, maxZ: -42 },
  { minX: 30, maxX: 44, minZ: -40, maxZ: -28 },
];
// Woods: tree density rises toward each centre; seeded patches of woodland are added on top by the prop scatter.
export const woods = [
  { x: -40, z: 30, radius: 24 },
  { x: 30, z: -50, radius: 28 },
  { x: -10, z: 70, radius: 26 },
  { x: 100, z: 10, radius: 25 },
  { x: -95, z: -10, radius: 28 },
  { x: 20, z: 105, radius: 24 },
  { x: -50, z: -100, radius: 24 },
  { x: 110, z: -60, radius: 22 },
];

export const paths = [
  { width: 1.7, points: [[-17, -8], [-12, -3], [-4, -1], [6, -1.5], [13, -4], [17, -9]] },
  { width: 1.7, points: [[6, -1.5], [9, 6], [14, 12], [22, 15], [30, 16]] },
  { width: 1.5, points: [[-12, -3], [-14, 5], [-20, 12], [-30, 15]] },
  { width: 1.5, points: [[-17, -8], [-17, -13.5]] },
  { width: 2.2, points: [[30, 16], [42, 28], [52, 42], [64, 52], [72, 55], [84, 66], [92, 76], [100, 94], [108, 112]] },
  { width: 2.2, points: [[-30, 15], [-48, 20], [-70, 8], [-96, 10], [-112, 24]] },
  { width: 2.0, points: [[-12, -3], [-34, -18], [-52, -34], [-68, -50], [-70, -57]] },
  { width: 1.8, points: [[72, 55], [72, 45]] },
  { width: 2.0, points: [[17, -9], [30, -30], [40, -52], [44, -84], [52, -112]] },
  { width: 1.8, points: [[-70, -57], [-76, -80], [-84, -108]] },
];

export const rocks = [
  { x: -6, z: -4, scale: 3.4, model: 'rock_tallA' },
  { x: 2.5, z: 15, scale: 3.8, model: 'rock_largeA' },
  { x: -22, z: 5, scale: 3.0, model: 'rock_tallB' },
  { x: 26, z: 11, scale: 3.6, model: 'rock_largeB' },
  { x: -28, z: -17, scale: 3.2, model: 'rock_tallA' },
  { x: 5, z: -16, scale: 3.4, model: 'rock_largeC' },
  { x: -12, z: 13, scale: 2.8, model: 'rock_largeA' },
  { x: 21, z: 2, scale: 2.4, model: 'stone_largeA' },
  { x: 95, z: 40, scale: 3.6, model: 'rock_largeA' },
  { x: 55, z: 80, scale: 3.4, model: 'rock_tallB' },
  { x: -60, z: 40, scale: 3.8, model: 'rock_largeB' },
  { x: -88, z: -30, scale: 3.2, model: 'rock_tallA' },
  { x: 10, z: -75, scale: 3.6, model: 'rock_largeC' },
  { x: 70, z: -20, scale: 3.0, model: 'rock_largeA' },
];

export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function distanceToPaths(x, z) {
  let nearest = Infinity;
  for (const path of paths) {
    for (let index = 0; index < path.points.length - 1; index++) {
      const [ax, az] = path.points[index];
      const [bx, bz] = path.points[index + 1];
      nearest = Math.min(nearest, distanceToSegment(x, z, ax, az, bx, bz) - path.width / 2);
    }
  }
  return nearest;
}

export function pondDepth(x, z) {
  const dx = (x - pond.x) / pond.radiusX;
  const dz = (z - pond.z) / pond.radiusZ;
  return 1 - Math.hypot(dx, dz);
}

// Each house is described once; geometry helpers derive its walls, roof and footprint from it.
export function houseGeometry(house) {
  const scale = house.scale ?? 1;
  const cell = CELL * scale;
  return {
    ...house,
    cell,
    halfX: (house.cellsX * cell) / 2,
    halfZ: (house.cellsZ * cell) / 2,
    wallHeight: cell,
    ridgeHeight: 0.57 * cell * (house.high ? 1.6 : 1),
  };
}
