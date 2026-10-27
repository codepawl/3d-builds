import { PathSampler } from '../sim/path.js'

// Everything in metres. X east, Z south, Y up. Track centres sit LANE_OFFSET either side of a line's centreline.
// Car door outer face 1.57 from the track centre + 0.15 gap + PSD leaf outer face 5.50 from the platform centre.
export const LANE_OFFSET = 7.22
export const PLATFORM_HALF_LENGTH = 65
export const CAR_KINDS = ['Cab', 'Motor', 'Trailer', 'Trailer', 'Motor', 'Cab']
// Distance between neighbouring car centres (bellows touch): (L1 + L2) / 2 + 0.4
export const CAR_CENTRES = [-51.2, -30.6, -10.2, 10.2, 30.6, 51.2]
export const TRAIN_HALF_LENGTH = 61.8

export const GROUND_CELL = 30
export const RAIL_HEAD_VIADUCT = 7.95
export const PIER_TOP = 9.0
export const PIER_SCALE = 0.57
export const VIADUCT_DECK_Y = 7.1

const harbourPath = new PathSampler([[-690, 0], [690, 0]], { step: 2 })
const cedarPath = new PathSampler([[0, -690], [0, 690]], { step: 2 })
const ringPath = new PathSampler([[-180, -180], [180, -180], [180, 180], [-180, 180]], { closed: true, cornerRadius: 80, step: 1 })

export const lines = [
  {
    id: 'H', name: 'Harbour Line', short: 'H', color: '#ff7a59', siteId: 'harbour', kind: 'linear', path: harbourPath,
    railY: -12, buried: true, fleet: 8, cruise: 15, power: 'third rail',
  },
  {
    id: 'C', name: 'Cedar Line', short: 'C', color: '#3b82f6', siteId: 'cedar', kind: 'linear', path: cedarPath,
    railY: -22, buried: true, fleet: 6, cruise: 15, power: 'third rail',
  },
  {
    id: 'R', name: 'Ring Line', short: 'R', color: '#8b5cf6', siteId: 'ring', kind: 'loop', path: ringPath,
    railY: RAIL_HEAD_VIADUCT, buried: false, fleet: 6, cruise: 13, power: 'overhead pantograph',
  },
]

const linearStations = (lineId, names, interchangeIndex) =>
  names.map((name, index) => ({
    id: `${lineId}${index + 1}`,
    lineId,
    name,
    s: 250 + index * 220,
    terminal: index === 0 || index === names.length - 1,
    interchange: index === interchangeIndex,
    baseDemand: 5 + ((index * 7) % 6),
  }))

export const stations = [
  ...linearStations('H', ['Saltmarket', 'Old Mill', 'Crosspoint', 'Lantern Hill', 'Eastgate'], 2),
  ...linearStations('C', ['Birchwood', 'Tannery Row', 'Crosspoint', 'Quarry Park', 'Southfields'], 2),
  ...[226, 552, 878, 1203].map((s, index) => ({
    id: `R${index + 1}`, lineId: 'R', name: ['Orchard Gate', 'Glasshouse', 'Dockside', 'Kiln Road'][index], s,
    terminal: false, interchange: false, baseDemand: 6 + index * 2,
  })),
]

export const sites = [
  {
    id: 'harbour', name: 'Harbour Line', subtitle: 'East-west, twin-bore tunnel', lineIds: ['H', 'C'], primaryLine: 'H',
    bounds: { minX: -690, maxX: 690, minZ: -270, maxZ: 270 },
    camera: { target: [-30, -6, 0], yaw: 0.36, pitch: 0.8, distance: 560, wide: 1500 },
    viewSide: [0.3, 0, 1],
  },
  {
    id: 'cedar', name: 'Cedar Line', subtitle: 'North-south, deep level', lineIds: ['C', 'H'], primaryLine: 'C',
    bounds: { minX: -270, maxX: 270, minZ: -690, maxZ: 690 },
    camera: { target: [0, -6, -30], yaw: 1.15, pitch: 0.8, distance: 560, wide: 1500 },
    viewSide: [1, 0, 0.3],
  },
  {
    id: 'ring', name: 'Ring Line', subtitle: 'Elevated loop on viaduct', lineIds: ['R'], primaryLine: 'R',
    bounds: { minX: -300, maxX: 300, minZ: -300, maxZ: 300 },
    camera: { target: [0, 6, 0], yaw: 0.35, pitch: 0.8, distance: 760, wide: 1050 },
    viewSide: [0.3, 0, 1],
  },
  {
    id: 'depot', name: 'Depot', subtitle: 'Stabling, workshop, wash plant', lineIds: [], primaryLine: null,
    bounds: { minX: -390, maxX: 390, minZ: -165, maxZ: 195 },
    camera: { target: [40, 0, 35], yaw: 0.3, pitch: 0.78, distance: 520, wide: 820 },
    viewSide: [0.3, 0, 1],
  },
]

// Depot layout: the lead track runs east along z = 0, stabling shed to the south, workshop to the north.
export const depotLayout = {
  stablingZ: [30, 37, 44, 51],
  workshopZ: [-20, -27],
  stableCentreX: 21,
  westFan: [-250, -130],
  eastFan: [100, 220],
  washX: 290,
  leadStart: -390,
  leadEnd: 390,
  controlCentre: [160, 110],
  substation: [-255, 85],
}

export const lineById = Object.fromEntries(lines.map((line) => [line.id, line]))
export const stationById = Object.fromEntries(stations.map((station) => [station.id, station]))
export const siteById = Object.fromEntries(sites.map((site) => [site.id, site]))

export function stationPose(station) {
  const line = lineById[station.lineId]
  const sample = line.path.at(station.s)
  return { x: sample.x, z: sample.z, tx: sample.tx, tz: sample.tz, y: line.railY, line }
}

// ---------------------------------------------------------------- screen doors follow the train doors
// Door-pair centres along a car, in the car's own frame (nose +X). Motor, Trailer and the pantograph car share one layout.
export const CAR_DOOR_CENTRES = {
  Cab: [-7.8, -2.9, 2.0, 6.9],
  Motor: [-7.35, -2.45, 2.45, 7.35],
  Trailer: [-7.35, -2.45, 2.45, 7.35],
}
export const PSD_UNIT_WIDTH = 2.22
export const PSD_WALL_HALF_LENGTH = 63.7

// Where each train door pair sits, metres along the track from the train's centre, for a train running in direction `dir`.
// Mirrors placeTrain: car 0 always carries its nose toward -s, car 5 toward +s, the middle cars face the running direction.
export function trainDoorCentres(dir) {
  const centres = []
  CAR_KINDS.forEach((kind, k) => {
    const facing = k === 0 ? -1 : k === CAR_KINDS.length - 1 ? 1 : dir
    const flipped = facing !== 1
    CAR_DOOR_CENTRES[kind].forEach((x) => centres.push(CAR_CENTRES[k] + (flipped ? -x : x)))
  })
  return centres.sort((first, second) => first - second)
}
