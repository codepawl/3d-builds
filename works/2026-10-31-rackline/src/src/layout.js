// Every position in the building, in metres. +x runs to the outbound end, -z to the back wall.
// A forklift's origin is at its mast, its forks point along local +z, and a carried pallet sits 1.65 m ahead of the origin.

export const CARRY_OFFSET = 1.65
export const FRONT_LANE_Z = 10
export const BACK_LANE_Z = -10
export const LEFT_LANE_X = -20.5
export const RIGHT_LANE_X = 29.35
export const RACK_ROW_X = [-16, -6.93, 2.14]
export const AISLE_ONE_X = -11.47
export const AISLE_TWO_X = -2.4
export const STATION_LANE_X = 6.67
export const RACK_HALF_DEPTH = 1.03
export const BAY_CENTER_Z = [-4, 0, 4]
export const BAY_SLOT_OFFSET = [-1.3, 0, 1.3]
export const SHELF_HEIGHTS = [0.51, 2.38, 3.52, 5.39]
export const CONVEYOR_TOP = 0.77
export const STAND_TOP = 0.2
export const WALL_LEFT_X = -26.5
export const WALL_BACK_Z = -16
export const FLOOR_RIGHT_X = 37
export const FLOOR_FRONT_Z = 22

export const LANES = {
  front: { start: [LEFT_LANE_X, FRONT_LANE_Z], end: [RIGHT_LANE_X, FRONT_LANE_Z] },
  right: { start: [RIGHT_LANE_X, FRONT_LANE_Z], end: [RIGHT_LANE_X, BACK_LANE_Z] },
  back: { start: [RIGHT_LANE_X, BACK_LANE_Z], end: [LEFT_LANE_X, BACK_LANE_Z] },
  left: { start: [LEFT_LANE_X, BACK_LANE_Z], end: [LEFT_LANE_X, FRONT_LANE_Z] },
  aisleOne: { start: [AISLE_ONE_X, FRONT_LANE_Z], end: [AISLE_ONE_X, BACK_LANE_Z] },
  aisleTwo: { start: [AISLE_TWO_X, FRONT_LANE_Z], end: [AISLE_TWO_X, BACK_LANE_Z] },
  station: { start: [STATION_LANE_X, FRONT_LANE_Z], end: [STATION_LANE_X, BACK_LANE_Z] },
}

// Where a lane can be left for another lane. The coordinate is the distance along the lane being left.
export const LANE_EXITS = {
  front: [
    { to: 'aisleOne', at: AISLE_ONE_X - LEFT_LANE_X },
    { to: 'aisleTwo', at: AISLE_TWO_X - LEFT_LANE_X },
    { to: 'station', at: STATION_LANE_X - LEFT_LANE_X },
    { to: 'right', at: RIGHT_LANE_X - LEFT_LANE_X },
  ],
  right: [{ to: 'back', at: FRONT_LANE_Z - BACK_LANE_Z }],
  back: [{ to: 'left', at: RIGHT_LANE_X - LEFT_LANE_X }],
  left: [{ to: 'front', at: FRONT_LANE_Z - BACK_LANE_Z }],
  aisleOne: [{ to: 'back', at: FRONT_LANE_Z - BACK_LANE_Z, entry: RIGHT_LANE_X - AISLE_ONE_X }],
  aisleTwo: [{ to: 'back', at: FRONT_LANE_Z - BACK_LANE_Z, entry: RIGHT_LANE_X - AISLE_TWO_X }],
  station: [{ to: 'back', at: FRONT_LANE_Z - BACK_LANE_Z, entry: RIGHT_LANE_X - STATION_LANE_X }],
}

export const PICK_LINES = [
  { id: 'Line 1', z: 3.6, pickX: 12.32, conveyorStartX: 13.8, conveyorEndX: 24.68, packX: 26.2 },
  { id: 'Line 2', z: -3.6, pickX: 12.32, conveyorStartX: 13.8, conveyorEndX: 24.68, packX: 26.2 },
]

export const INBOUND_DOORS = [
  { id: 'Door 1', z: -7 },
  { id: 'Door 2', z: -1 },
  { id: 'Door 3', z: 5 },
]
export const INBOUND_PICK_X = -24.6
export const INBOUND_TRAILER_X = -33

export const OUTBOUND_DOORS = [
  { id: 'Door 4', x: 12.5 },
  { id: 'Door 5', x: 24.5 },
]
export const OUTBOUND_DROP_Z = -13.1
export const OUTBOUND_TRAILER_Z = -19.5

export const EMPTY_STACK = { x: 15, z: 16 }
export const PARKING_X = [-14, -9, -4, 1, 6, 11]
export const PARKING_Z = 13.6

export function buildSlots() {
  const slots = []
  const lanesBySide = [
    { west: 'left', east: 'aisleOne', westLaneX: LEFT_LANE_X, eastLaneX: AISLE_ONE_X },
    { west: 'aisleOne', east: 'aisleTwo', westLaneX: AISLE_ONE_X, eastLaneX: AISLE_TWO_X },
    { west: 'aisleTwo', east: 'station', westLaneX: AISLE_TWO_X, eastLaneX: STATION_LANE_X },
  ]
  RACK_ROW_X.forEach((rowX, rowIndex) => {
    for (const side of ['west', 'east']) {
      const sign = side === 'west' ? -1 : 1
      const faceX = rowX + sign * RACK_HALF_DEPTH
      const lane = lanesBySide[rowIndex][side]
      for (const bayZ of BAY_CENTER_Z) {
        for (const offset of BAY_SLOT_OFFSET) {
          SHELF_HEIGHTS.forEach((height, level) => {
            slots.push({
              id: `R${rowIndex + 1}${side === 'west' ? 'W' : 'E'}-${slots.length}`,
              label: `Row ${rowIndex + 1}, level ${level + 1}`,
              row: rowIndex,
              lane,
              x: faceX - sign * 0.45,
              z: bayZ + offset,
              y: height,
              level,
              // The forklift faces into the rack, so it looks back along the side's outward direction.
              approachSign: sign,
              pallet: null,
              reserved: false,
            })
          })
        }
      }
    }
  })
  return slots
}
