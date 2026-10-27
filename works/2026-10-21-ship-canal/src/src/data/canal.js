// Fixed geometry of the lock flight, in metres. World axes: x across the canal, y up, z = -s where s is the distance uphill.
export const CHAMBER_LENGTH = 305
export const CHAMBER_WIDTH = 33.5
export const LIFT = 8.5
export const WALL_HEIGHT = 25
export const TILE = 30.5
export const GATE_TILE_HINGE = 10 // the hinge sits this far from the centre of the gate wall tile
export const CHAMBER_START_OFFSET = 5.25 // first wall tile of a chamber starts this far past the gate hinge line
export const CENTER_WALL_HALF = 9
export const LANE_X = { A: -25.75, B: 25.75 }
export const WEST_FACE_X = -48.5
export const EAST_WALL_OUTER_X = 57.5
export const SHIP_SCALE = 0.95 // ships are 34.4 m wide in the pack, the chamber is 33.5 m
export const LOW_DEPTH = 13.5
export const HIGH_DEPTH = 22

// One minute of dashboard time is shown for every TIME_SCALE seconds of simulation.
export const TIME_SCALE = 36

export const PHASE = { approach: 26, close: 2.4, fill: 14, open: 2.5, move: 24, drain: 14, depart: 40 }

export const sites = [
  { id: 'flight', name: 'Gantry Locks', subtitle: 'Three-step flight, sea side', chambers: 3, floorBase: -13.5, lowName: 'Sea', highName: 'Lake Orrin' },
  { id: 'lake', name: 'Orrin Lock', subtitle: 'Single lock at lake level', chambers: 1, floorBase: 3.5, lowName: 'Cut', highName: 'Lake Orrin' },
  { id: 'control', name: 'Control Center', subtitle: 'Canal operations floor', chambers: 3, floorBase: -13.5, lowName: 'Sea', highName: 'Lake Orrin' },
]
export const siteById = Object.fromEntries(sites.map((site) => [site.id, site]))

// Geometry of one flight (3 chambers) or a single lock (1 chamber), derived from the base floor height.
export function flightGeometry(chambers, floorBase) {
  const floorY = (index) => floorBase + LIFT * index
  const lowY = (index) => floorY(index) + LOW_DEPTH
  const highY = (index) => floorY(index) + HIGH_DEPTH
  const gateS = (index) => CHAMBER_LENGTH * index // hinge line of gate `index` (0 = lowest)
  const chamberStartS = (index) => gateS(index) + CHAMBER_START_OFFSET
  const chamberCentreS = (index) => chamberStartS(index) + CHAMBER_LENGTH / 2
  const wallTopY = (index) => floorY(index) + WALL_HEIGHT
  const lowerWaterY = lowY(0)
  const upperWaterY = highY(chambers - 1)
  return { chambers, floorBase, floorY, lowY, highY, gateS, chamberStartS, chamberCentreS, wallTopY, lowerWaterY, upperWaterY }
}

export const SHIP_TYPES = [
  { key: 'ship_cargo_a', label: 'Container carrier', length: 294, beam: 34, draft: 12 },
  { key: 'ship_tanker_a', label: 'Product tanker', length: 229, beam: 33, draft: 12.2 },
  { key: 'ship_bulk_a', label: 'Bulk carrier', length: 225, beam: 33, draft: 12 },
  { key: 'ship_cargo_b', label: 'Container carrier', length: 294, beam: 34, draft: 12 },
  { key: 'ship_tanker_b', label: 'Product tanker', length: 229, beam: 33, draft: 12.2 },
]

const NAMES = [
  'Marlow Tern', 'Kestrel Bay', 'Saltmarsh', 'Oriel Star', 'Brannock', 'Tidewright', 'Hollin Crest', 'Vesper Line',
  'Corran', 'Ashgrove', 'Pelham Sound', 'Isolde', 'North Quay', 'Wren Harbour', 'Dunmore', 'Calder Reach',
]

export function shipSpec(laneId, index) {
  const type = SHIP_TYPES[(index * 2 + (laneId === 'A' ? 0 : 1)) % SHIP_TYPES.length]
  const name = NAMES[(index * 5 + (laneId === 'A' ? 0 : 7)) % NAMES.length]
  return { ...type, name, id: `${laneId}${String(index + 1).padStart(2, '0')}` }
}

export function formatDuration(simSeconds) {
  const minutes = Math.round((simSeconds * TIME_SCALE) / 60)
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`
}
