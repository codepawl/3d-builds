// Gladewheel Park: made-up park, lands, rides and people. Static layout of each land lives here;
// sim.js turns it into the live world.
import { roundedRect } from './paths.js'

export const PARK = {
  name: 'Gladewheel Park',
  user: { name: 'Mai Tran', initials: 'MT', role: 'Duty manager' },
  weather: { label: 'Partly sunny', temperature: 27, wind: 11 },
}

export const SITES = [
  { id: 'AD', name: 'Tidewild Cove', area: 'Adventure land', color: '#2f9e6e' },
  { id: 'SP', name: 'Nova Reach', area: 'Space land', color: '#6a5cd6' },
  { id: 'FT', name: 'Briarwood', area: 'Fairytale land', color: '#d0841c' },
  { id: 'EN', name: 'Gateway Plaza', area: 'Entrance', color: '#e0464f' },
]

const rotate = (x, z, angle) => [x * Math.cos(angle) + z * Math.sin(angle), -x * Math.sin(angle) + z * Math.cos(angle)]

// A switchback queue: `lanes` lanes `length` metres long, 1.2 m apart, guests enter at the far lane
// and leave from lane 0 at local x = 0. Returns rail placements and the guests' serpentine path.
export function switchback({ x, z, rotation = 0, lanes = 4, length = 14 }) {
  const toWorld = (localX, localZ) => {
    const [worldX, worldZ] = rotate(localX, localZ, rotation)
    return [x + worldX, z + worldZ]
  }
  const rails = []
  const turns = []
  const railAt = (localX, localZ) => {
    const [worldX, worldZ] = toWorld(localX, localZ)
    rails.push({ position: [worldX, 0, worldZ], rotation: rotation + Math.PI / 2 })
  }
  for (let boundary = -1; boundary < lanes; boundary++) {
    const localZ = (boundary + 0.5) * 1.2
    const outer = boundary === -1 || boundary === lanes - 1
    const turnAtFar = boundary % 2 === 0
    for (let along = 1; along < length; along += 2) {
      if (!outer && ((turnAtFar && along > length - 2) || (!turnAtFar && along < 2))) continue
      railAt(along, localZ)
    }
    if (!outer) {
      const [turnX, turnZ] = toWorld(turnAtFar ? length + 0.2 : -0.2, localZ)
      turns.push({ position: [turnX, 0, turnZ], rotation: rotation + (turnAtFar ? Math.PI / 2 : -Math.PI / 2) })
    }
  }
  const path = []
  for (let lane = lanes - 1; lane >= 0; lane--) {
    const fromFar = (lanes - 1 - lane) % 2 === 0
    const localZ = lane * 1.2
    path.push(toWorld(fromFar ? length - 0.5 : 0.5, localZ), toWorld(fromFar ? 0.5 : length - 0.5, localZ))
  }
  path.push(toWorld(-2.5, 0))
  const canopies = []
  for (let along = 3.2; along < length; along += 6.6) {
    const [canopyX, canopyZ] = toWorld(along, (lanes - 1) * 0.6)
    canopies.push({ position: [canopyX, 0, canopyZ], rotation: rotation + Math.PI / 2, scale: [Math.max(1, (lanes * 1.2 + 0.6) / 3.6), 1, 1] })
  }
  return { rails, turns, path, canopies }
}

// Trees scattered over boxes, skipping keep-out boxes, from a small seeded generator.
export function scatter({ seed, boxes, avoid, count, kinds }) {
  let state = seed
  const random = () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
  const items = []
  let tries = 0
  while (items.length < count && tries < count * 40) {
    tries++
    const box = boxes[Math.floor(random() * boxes.length)]
    const x = box[0] + random() * (box[2] - box[0])
    const z = box[1] + random() * (box[3] - box[1])
    if (avoid.some((zone) => x > zone[0] && x < zone[2] && z > zone[1] && z < zone[3])) continue
    if (items.some((item) => Math.hypot(item.position[0] - x, item.position[2] - z) < 5)) continue
    items.push({ kind: kinds[Math.floor(random() * kinds.length)], position: [x, 0, z], rotation: random() * Math.PI * 2, scale: 0.85 + random() * 0.4 })
  }
  return items
}

// ---------- the four lands ----------

const ADVENTURE = {
  view: { target: [10, 4, -2], azimuth: 0.42, polar: 0.92, distance: 250 },
  ground: { lawn: '#9cc979', bounds: [-140, -110, 160, 110] },
  paving: '#e8d8bf',
  walkways: [
    { points: roundedRect(10, -3, 100, 69, 14), closed: true, width: 8 },
    { points: [[-90, 0], [110, 0]], width: 9 },
    { points: [[6, 0], [6, 66]], width: 8 },
    { points: [[78, 0], [78, -72]], width: 7 },
  ],
  plazas: [
    { x: 6, z: 0, radius: 14 },
    { x: -36, z: -64, w: 30, d: 10 },
    { x: 38, z: 54, w: 28, d: 10 },
  ],
  water: [{ x: -38, z: 29, w: 50, d: 18 }],
  monorail: { points: roundedRect(12, -3, 120, 88, 28), station: { at: 0.0, position: [132, 0, -10], rotation: 0 } },
  coaster: { offset: [0, 0, -32] },
  flume: { offset: [-38, 0, 30] },
  buildings: [{ node: 'showhouse_temple', position: [42, 0, 30], rotation: 0, rideId: 'temple' }],
  ferris: { position: [96, 0, 28], rotation: 1.15 },
  queues: [
    { rideId: 'riptide', x: -48, z: -61.6, rotation: 0, lanes: 4, length: 24 },
    { rideId: 'kalua', x: -66, z: 7.4, rotation: 0, lanes: 4, length: 15 },
    { rideId: 'temple', x: 30, z: 51.2, rotation: 0, lanes: 4, length: 22 },
    { rideId: 'sunspoke', x: 70, z: 47, rotation: 0, lanes: 3, length: 14 },
  ],
  stands: [
    { id: 'S-AD1', node: 'stand_kiosk_a', name: 'Coconut Shack', kind: 'food', position: [-18, 0, 7.5], rotation: Math.PI },
    { id: 'S-AD2', node: 'stand_kiosk_b', name: 'Lagoon Sips', kind: 'food', position: [56, 0, 7.5], rotation: Math.PI },
    { id: 'S-AD3', node: 'cart_popcorn', name: 'Popcorn cart 4', kind: 'food', position: [28, 0, -6.2], rotation: 0 },
    { id: 'S-AD4', node: 'cart_icecream', name: 'Frost cart 2', kind: 'food', position: [-62, 0, -6.2], rotation: 0 },
    { id: 'S-AD5', node: 'shop_adventure', name: 'Expedition Outfitters', kind: 'retail', position: [-24, 0, 77], rotation: Math.PI },
  ],
  tables: [[-30, -8], [-24, -9], [44, 8.5], [66, 8.5], [-10, 74], [18, 75]],
  props: { trees: ['tree_palm', 'tree_palm', 'tree_round_a', 'tree_round_b'], treeCount: 70, lamps: { from: -84, to: 104, z: [-5.6, 5.6], step: 16 } },
  avoid: [[-62, -60, 64, -8], [-76, 12, -2, 46], [20, 12, 62, 47], [70, 6, 122, 50], [-112, -100, 134, 96, 'ring']],
}

const SPACE = {
  view: { target: [12, 6, -6], azimuth: 0.42, polar: 0.9, distance: 205 },
  ground: { lawn: '#a7c98d', bounds: [-120, -100, 120, 100] },
  paving: '#dfe2ea',
  walkways: [
    { points: roundedRect(0, 4, 62, 56, 14), closed: true, width: 8 },
    { points: [[0, 8], [0, 60]], width: 9 },
    { points: [[-62, 22], [62, 22]], width: 8 },
  ],
  plazas: [
    { x: 0, z: 22, radius: 16 },
    { x: 34, z: -30, w: 30, d: 26 },
  ],
  water: [{ x: -36, z: -30, w: 24, d: 18 }],
  monorail: { points: roundedRect(0, 4, 82, 74, 26), station: { position: [-82, 0, 10], rotation: 0 } },
  buildings: [{ node: 'showhouse_space', position: [-4, 0, -22], rotation: 0, rideId: 'comet' }],
  ferris: { position: [34, 0, -34], rotation: 1.15, rideId: 'orbit' },
  queues: [
    { rideId: 'comet', x: -14, z: 6.4, rotation: 0, lanes: 4, length: 20 },
    { rideId: 'orbit', x: 24, z: -8, rotation: 0, lanes: 3, length: 14 },
  ],
  stands: [
    { id: 'S-SP1', node: 'stand_kiosk_b', name: 'Nebula Shakes', kind: 'food', position: [-26, 0, 28], rotation: 0 },
    { id: 'S-SP2', node: 'stand_kiosk_a', name: 'Rocket Dogs', kind: 'food', position: [24, 0, 30], rotation: 0 },
    { id: 'S-SP3', node: 'shop_space', name: 'Launchpad Gifts', kind: 'retail', position: [-30, 0, 46], rotation: Math.PI / 2 },
    { id: 'S-SP4', node: 'cart_icecream', name: 'Frost cart 5', kind: 'food', position: [12, 0, 40], rotation: 0 },
  ],
  tables: [[-14, 32], [-8, 36], [14, 34], [20, 38], [-18, 40]],
  props: { trees: ['tree_round_a', 'tree_conifer', 'tree_round_b'], treeCount: 48, lamps: { from: -56, to: 56, z: [17.4, 26.6], step: 14 } },
  avoid: [[-32, -44, 24, 2], [10, -52, 62, -10], [-50, -42, -22, -18], [-96, -84, 96, 92, 'ring']],
}

const FAIRYTALE = {
  view: { target: [0, 4, 6], azimuth: 0.42, polar: 0.9, distance: 205 },
  ground: { lawn: '#9fcc7c', bounds: [-130, -110, 130, 110] },
  paving: '#ead9c4',
  walkways: [
    { points: roundedRect(0, 20, 70, 28, 18), closed: true, width: 10 },
    { points: [[0, -9], [0, 48]], width: 8 },
    { points: [[0, 48], [0, 80]], width: 9 },
  ],
  plazas: [
    { x: 0, z: -2, w: 26, d: 10 },
    { x: -36, z: 20, radius: 13 },
  ],
  water: [],
  monorail: { points: roundedRect(0, 4, 100, 80, 28), station: { position: [100, 0, 10], rotation: 0 } },
  parade: roundedRect(0, 20, 70, 28, 18),
  buildings: [
    { node: 'castle', position: [0, 0, -30], rotation: 0, rideId: 'castle' },
    { node: 'showhouse_tale', position: [40, 0, 16], rotation: 0, rideId: 'lantern' },
  ],
  carousel: { position: [-36, 0, 20] },
  queues: [
    { rideId: 'gallop', x: -50, z: 33, rotation: 0, lanes: 3, length: 12 },
    { rideId: 'lantern', x: 30, z: 36, rotation: 0, lanes: 3, length: 14 },
  ],
  stands: [
    { id: 'S-FT1', node: 'stand_kiosk_a', name: 'Honeybun Bakery', kind: 'food', position: [-16, 0, 56], rotation: Math.PI / 2 },
    { id: 'S-FT2', node: 'cart_popcorn', name: 'Popcorn cart 9', kind: 'food', position: [10, 0, 58], rotation: -Math.PI / 2 },
    { id: 'S-FT3', node: 'shop_tale', name: 'The Spindle Shop', kind: 'retail', position: [-30, 0, 64], rotation: Math.PI },
    { id: 'S-FT4', node: 'stand_kiosk_b', name: 'Apple Cider Well', kind: 'food', position: [14, 0, -4], rotation: Math.PI },
  ],
  tables: [[-12, 62], [-6, 68], [16, 66], [22, 62]],
  props: { trees: ['tree_round_a', 'tree_round_b', 'tree_conifer'], treeCount: 64, lamps: null },
  avoid: [[-22, -52, 22, -6], [-46, 10, -26, 30], [22, 0, 58, 36], [-76, -10, 76, 50], [-114, -92, 114, 96, 'ring']],
}

const ENTRANCE = {
  view: { target: [0, 3, 18], azimuth: 0.42, polar: 0.92, distance: 210 },
  ground: { lawn: '#9cc979', bounds: [-140, -110, 140, 150] },
  paving: '#e6dccd',
  walkways: [
    { points: [[0, -60], [0, 28]], width: 14 },
    { points: [[-40, -34], [40, -34]], width: 10 },
  ],
  plazas: [
    { x: 0, z: -24, w: 70, d: 40 },
    { x: 0, z: 18, w: 60, d: 14 },
  ],
  water: [],
  parking: { minX: -84, maxX: 84, minZ: 32, maxZ: 118 },
  tramLoop: roundedRect(0, 75, 94, 50, 16),
  monorail: { points: roundedRect(0, 10, 108, 82, 28), station: { position: [108, 0, -10], rotation: 0 } },
  buildings: [{ node: 'entrance_gate', position: [0, 0, 4], rotation: 0, rideId: 'gates' }],
  queues: [],
  stands: [
    { id: 'S-EN1', node: 'shop_adventure', name: 'Gladewheel Emporium', kind: 'retail', position: [-30, 0, -50], rotation: 0 },
    { id: 'S-EN2', node: 'shop_tale', name: 'Ticket and Pass Center', kind: 'retail', position: [30, 0, -50], rotation: 0 },
    { id: 'S-EN3', node: 'stand_kiosk_b', name: 'Morning Brew', kind: 'food', position: [-22, 0, -14], rotation: Math.PI / 2 },
    { id: 'S-EN4', node: 'cart_popcorn', name: 'Popcorn cart 1', kind: 'food', position: [20, 0, -18], rotation: -Math.PI / 2 },
  ],
  tables: [[-28, -24], [-20, -28], [24, -28], [30, -24]],
  props: { trees: ['tree_round_a', 'tree_round_b', 'tree_conifer'], treeCount: 50, lamps: null, balloons: [[8, -8], [-10, -40]] },
  avoid: [[-40, -60, 40, 28], [-100, 22, 100, 132], [-120, -100, 124, 102, 'ring']],
}

export const LAYOUTS = { AD: ADVENTURE, SP: SPACE, FT: FAIRYTALE, EN: ENTRANCE }

// Rides and facilities per land. capacity = theoretical riders per hour.
export const RIDES = {
  AD: [
    { id: 'riptide', name: 'Riptide Runner', kind: 'coaster', capacity: 1150, wait: 45, footprint: { x: 1, z: -31, rx: 66, rz: 26 }, top: 34 },
    { id: 'kalua', name: 'Kalua Falls', kind: 'flume', capacity: 900, wait: 35, footprint: { x: -39, z: 29, rx: 38, rz: 18 }, top: 16 },
    { id: 'temple', name: 'Temple of Echoes', kind: 'darkride', capacity: 1400, wait: 25, footprint: { x: 42, z: 30, rx: 24, rz: 19 }, top: 22 },
    { id: 'sunspoke', name: 'Sunspoke Wheel', kind: 'ferris', capacity: 720, wait: 15, footprint: { x: 96, z: 28, rx: 14, rz: 14 }, top: 48 },
  ],
  SP: [
    { id: 'comet', name: 'Comet Run', kind: 'darkcoaster', capacity: 1300, wait: 0, footprint: { x: -4, z: -22, rx: 29, rz: 23 }, top: 30, state: 'down' },
    { id: 'orbit', name: 'Orbit Wheel', kind: 'ferris', capacity: 720, wait: 20, footprint: { x: 34, z: -34, rx: 14, rz: 14 }, top: 48 },
    { id: 'monorail', name: 'Skyloop Monorail', kind: 'monorail', capacity: 2400, wait: 5, footprint: { x: -82, z: 10, rx: 8, rz: 18 }, top: 12 },
  ],
  FT: [
    { id: 'gallop', name: 'Gilded Gallop', kind: 'carousel', capacity: 800, wait: 10, footprint: { x: -36, z: 20, rx: 9, rz: 9 }, top: 11 },
    { id: 'lantern', name: 'Lantern Tale', kind: 'darkride', capacity: 1100, wait: 30, footprint: { x: 40, z: 16, rx: 19, rz: 15 }, top: 20, state: 'testing' },
    { id: 'castle', name: 'Halvenmoor Castle', kind: 'walkthrough', capacity: 1600, wait: 5, footprint: { x: 0, z: -30, rx: 22, rz: 22 }, top: 32 },
  ],
  EN: [
    { id: 'gates', name: 'Main Gates', kind: 'gate', capacity: 6000, wait: 4, footprint: { x: 0, z: 4, rx: 27, rz: 9 }, top: 14 },
    { id: 'tram', name: 'Lot Tram Line', kind: 'tram', capacity: 1800, wait: 6, footprint: { x: 0, z: 26, rx: 12, rz: 6 }, top: 4 },
  ],
}

export const STAFF_NAMES = ['Linh Vo', 'Omar Haddad', 'Priya Nair', 'Jonas Berg', 'Ana Ruiz', 'Kenji Sato', 'Zoe Clarke', 'Tuan Pham', 'Ines Duarte', 'Ravi Patel', 'Mara Quinn', 'Leo Fischer']

// One ride's day for the bottom strip, as park clock minutes.
export const RIDE_DAY = [
  { key: 'checks', label: 'Opening checks', at: 7 * 60 + 40 },
  { key: 'rope', label: 'Rope drop', at: 9 * 60 },
  { key: 'peak', label: 'Peak queue', at: 12 * 60 + 30 },
  { key: 'down', label: 'Downtime', at: 13 * 60 + 25 },
  { key: 'recovery', label: 'Recovery', at: 13 * 60 + 50 },
  { key: 'closing', label: 'Closing', at: 22 * 60 },
]

export const SHOWS = [
  { id: 'SH1', name: 'Lanterns of Briarwood parade', siteId: 'FT', at: 14 * 60 },
  { id: 'SH2', name: 'Starfall stage show', siteId: 'SP', at: 15 * 60 + 30 },
  { id: 'SH3', name: 'Cove drummers', siteId: 'AD', at: 13 * 60 + 45 },
  { id: 'SH4', name: 'Night glow parade', siteId: 'FT', at: 20 * 60 + 30 },
]
