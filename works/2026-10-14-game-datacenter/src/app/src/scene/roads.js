// The campus road network as instanced road pieces: a ring road around the pad with proper corners, a T-junction for each
// access road that reaches a neighbour hall's loading door, and curbs that stay continuous except where a road joins.
// Pieces are butt-jointed: tiles never overlap, so there is no z-fighting, and no gap between them.
import { fillRun, placement } from './assets.jsx'

export const ROAD_MODULE = 2.4
export const ROAD_WIDTH = 3.6
const HALF_WIDTH = ROAD_WIDTH / 2
const CURB_THICKNESS = 0.22
const CURB_CENTER = HALF_WIDTH + CURB_THICKNESS / 2
const CURB_HALF = CURB_THICKNESS / 2
const RING_GAP = 1.2
const CANOPY_REACH = 0.9
const DOOR_CLEARANCE = 0.7
const DOOR_SPAN = 2.2

// Footprints match the three Blender hall variants; the door is the roll-up door, a quarter of the width left of centre.
const HALL_SIZES = {
  hall_a: { width: 18, depth: 26 },
  hall_b: { width: 16, depth: 22 },
  hall_c: { width: 26, depth: 14 },
}

export function roadRing(bounds) {
  const margin = RING_GAP + HALF_WIDTH
  return { minX: bounds.minX - margin, maxX: bounds.maxX + margin, minZ: bounds.minZ - margin, maxZ: bounds.maxZ + margin }
}

function hallAt(variant, x, z) {
  const { width, depth } = HALL_SIZES[variant]
  return { variant, x, z, doorX: x - width / 4, frontZ: z + depth / 2 }
}

// Hall B's front sits one carriageway plus the canopy from the ring's bottom road, so that road simply carries on to its door.
export function neighbourHalls(bounds) {
  const ring = roadRing(bounds)
  const frontToRoad = CANOPY_REACH + DOOR_CLEARANCE + HALF_WIDTH
  return {
    a: hallAt('hall_a', bounds.minX - 22, -6),
    b: hallAt('hall_b', bounds.maxX + 21, ring.maxZ - frontToRoad - HALL_SIZES.hall_b.depth / 2),
    c: hallAt('hall_c', 4, bounds.minZ - 22),
  }
}

export function planRoads(bounds) {
  const ring = roadRing(bounds)
  const halls = neighbourHalls(bounds)
  const frontToRoad = CANOPY_REACH + DOOR_CLEARANCE + HALF_WIDTH
  const west = { z: halls.a.frontZ + frontToRoad, endX: halls.a.doorX - DOOR_SPAN }
  const north = { x: halls.c.doorX, endZ: halls.c.frontZ + CANOPY_REACH + DOOR_CLEARANCE }
  const east = { endX: halls.b.doorX + DOOR_SPAN }

  const tiles = []
  const corners = []
  const tees = []
  const curbs = []

  const horizontalRoad = (z, fromX, toX) => {
    if (toX - fromX < 0.05) return
    const run = fillRun(toX - fromX, ROAD_MODULE)
    for (const offset of run.offsets) tiles.push(placement((fromX + toX) / 2 + offset, 0, z, 0, [run.stretch, 1, 1]))
  }
  const verticalRoad = (x, fromZ, toZ) => {
    if (toZ - fromZ < 0.05) return
    const run = fillRun(toZ - fromZ, ROAD_MODULE)
    for (const offset of run.offsets) tiles.push(placement(x, 0, (fromZ + toZ) / 2 + offset, Math.PI / 2, [run.stretch, 1, 1]))
  }
  const horizontalCurb = (z, fromX, toX) => {
    const run = fillRun(toX - fromX, ROAD_MODULE)
    for (const offset of run.offsets) curbs.push(placement((fromX + toX) / 2 + offset, 0, z, 0, [run.stretch, 1, 1]))
  }
  const verticalCurb = (x, fromZ, toZ) => {
    const run = fillRun(toZ - fromZ, ROAD_MODULE)
    for (const offset of run.offsets) curbs.push(placement(x, 0, (fromZ + toZ) / 2 + offset, Math.PI / 2, [run.stretch, 1, 1]))
  }

  // Corner pieces point their arms toward +X and three.js -Z; each turn below picks the quarter turn that matches its two roads.
  corners.push(placement(ring.minX, 0, ring.maxZ, 0))
  corners.push(placement(ring.maxX, 0, ring.minZ, Math.PI))
  corners.push(placement(ring.minX, 0, ring.minZ, -Math.PI / 2))
  // Tees have the main road along X and the side road toward -Z.
  tees.push(placement(ring.maxX, 0, ring.maxZ, 0))
  tees.push(placement(north.x, 0, ring.minZ, 0))
  tees.push(placement(ring.minX, 0, west.z, Math.PI / 2))

  horizontalRoad(ring.minZ, ring.minX + HALF_WIDTH, north.x - HALF_WIDTH)
  horizontalRoad(ring.minZ, north.x + HALF_WIDTH, ring.maxX - HALF_WIDTH)
  horizontalRoad(ring.maxZ, ring.minX + HALF_WIDTH, ring.maxX - HALF_WIDTH)
  horizontalRoad(ring.maxZ, ring.maxX + HALF_WIDTH, east.endX)
  verticalRoad(ring.minX, ring.minZ + HALF_WIDTH, west.z - HALF_WIDTH)
  verticalRoad(ring.minX, west.z + HALF_WIDTH, ring.maxZ - HALF_WIDTH)
  verticalRoad(ring.maxX, ring.minZ + HALF_WIDTH, ring.maxZ - HALF_WIDTH)
  horizontalRoad(west.z, west.endX, ring.minX - HALF_WIDTH)
  verticalRoad(north.x, north.endZ, ring.minZ - HALF_WIDTH)

  // Outer curbs, open where an access road leaves the ring.
  const outerMinX = ring.minX - CURB_CENTER - CURB_HALF
  const outerMinZ = ring.minZ - CURB_CENTER - CURB_HALF
  const outerMaxZ = ring.maxZ + CURB_CENTER + CURB_HALF
  const outerMaxX = ring.maxX + CURB_CENTER + CURB_HALF
  horizontalCurb(ring.minZ - CURB_CENTER, outerMinX, north.x - HALF_WIDTH)
  horizontalCurb(ring.minZ - CURB_CENTER, north.x + HALF_WIDTH, outerMaxX)
  horizontalCurb(ring.maxZ + CURB_CENTER, outerMinX, east.endX + CURB_THICKNESS)
  verticalCurb(ring.minX - CURB_CENTER, outerMinZ, west.z - HALF_WIDTH)
  verticalCurb(ring.minX - CURB_CENTER, west.z + HALF_WIDTH, outerMaxZ)
  verticalCurb(ring.maxX + CURB_CENTER, outerMinZ, ring.maxZ - HALF_WIDTH)
  // Inner curbs close the ring around the pad.
  horizontalCurb(ring.minZ + CURB_CENTER, ring.minX + HALF_WIDTH, ring.maxX - HALF_WIDTH)
  horizontalCurb(ring.maxZ - CURB_CENTER, ring.minX + HALF_WIDTH, ring.maxX - HALF_WIDTH)
  verticalCurb(ring.minX + CURB_CENTER, ring.minZ + HALF_WIDTH, ring.maxZ - HALF_WIDTH)
  verticalCurb(ring.maxX - CURB_CENTER, ring.minZ + HALF_WIDTH, ring.maxZ - HALF_WIDTH)
  // Hall B's road continues east: a north curb from the junction to the end cap.
  horizontalCurb(ring.maxZ - CURB_CENTER, ring.maxX + HALF_WIDTH, east.endX + CURB_THICKNESS)
  verticalCurb(east.endX + CURB_HALF, ring.maxZ - CURB_CENTER - CURB_HALF, ring.maxZ + CURB_CENTER + CURB_HALF)
  // Hall A's road (west) and hall C's road (north): both side curbs and an end cap.
  for (const side of [-1, 1]) {
    horizontalCurb(west.z + side * CURB_CENTER, west.endX - CURB_THICKNESS, ring.minX - HALF_WIDTH)
    verticalCurb(north.x + side * CURB_CENTER, north.endZ - CURB_THICKNESS, ring.minZ - HALF_WIDTH)
  }
  verticalCurb(west.endX - CURB_HALF, west.z - CURB_CENTER - CURB_HALF, west.z + CURB_CENTER + CURB_HALF)
  horizontalCurb(north.endZ - CURB_HALF, north.x - CURB_CENTER - CURB_HALF, north.x + CURB_CENTER + CURB_HALF)

  // Ground the trees must stay off: the ring, the access roads and a margin around them.
  const margin = 2.2
  const keepClear = [
    { minX: west.endX - margin, maxX: ring.minX, minZ: west.z - HALF_WIDTH - margin, maxZ: west.z + HALF_WIDTH + margin },
    { minX: north.x - HALF_WIDTH - margin, maxX: north.x + HALF_WIDTH + margin, minZ: north.endZ - margin, maxZ: ring.minZ },
    { minX: ring.maxX, maxX: east.endX + margin, minZ: ring.maxZ - HALF_WIDTH - margin, maxZ: ring.maxZ + HALF_WIDTH + margin },
  ]
  return { tiles, corners, tees, curbs, keepClear, halls }
}
