// Static data: invented airlines, aircraft types, the airport and the three control sectors.
// Map units: x is east, z is south, y is up. Headings are degrees from north (-z), clockwise.
// Every name, code and livery here is made up; nothing comes from a real airline, airport or chart.

export const AIRPORT = { code: 'QOND', name: 'Ondra Bay International', city: 'Ondra Bay' }

// One simulated second per real second times this; the clock in the top bar runs at the same rate.
export const TIME_SCALE = 8

export const AIRLINES = {
  ODR: { code: 'ODR', name: 'Ondra Air', spoken: 'Ondra', color: '#2f5bea', accent: '#ffb547', mark: 'wave' },
  SLX: { code: 'SLX', name: 'Saltline', spoken: 'Saltline', color: '#e0553a', accent: '#253047', mark: 'chevron' },
  KSR: { code: 'KSR', name: 'Kestrel Regional', spoken: 'Kestrel', color: '#16936f', accent: '#f3f6fa', mark: 'wing' },
  NBX: { code: 'NBX', name: 'Northbay Express', spoken: 'Northbay', color: '#7a4fd6', accent: '#ffd166', mark: 'star' },
  AMJ: { code: 'AMJ', name: 'Amberjet', spoken: 'Amber', color: '#d98a0b', accent: '#1f2a3d', mark: 'sun' },
}

// Simple white shapes on a 24-unit grid for the airline tiles.
export const MARK_SHAPES = {
  wave: { path: 'M4 14c3-4 5-4 8 0s5 4 8 0', stroke: 2.4 },
  chevron: { path: 'M5 8l7 7 7-7', stroke: 2.6 },
  wing: { path: 'M3 15l18-7-6 9z' },
  star: { path: 'M12 4l2.3 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.8 2.6 1.1-5.3-4-3.7 5.4-.6z' },
  sun: { path: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z' },
}

// Invented type designators mapped to the Blender airframes. `approach` and `cruise` are knots.
export const AIRCRAFT_TYPES = {
  TJ20: { variant: 'jet_a', name: 'Twinjet 200', wake: 'M', approach: 140, cruise: 450 },
  TJ23: { variant: 'jet_b', name: 'Twinjet 230', wake: 'M', approach: 145, cruise: 455 },
  RJ90: { variant: 'jet_c', name: 'Regional 90', wake: 'M', approach: 135, cruise: 430 },
  WB35: { variant: 'jet_d', name: 'Widebody 350', wake: 'H', approach: 150, cruise: 480 },
  TP72: { variant: 'prop_a', name: 'Turboprop 72', wake: 'M', approach: 120, cruise: 270 },
  TP40: { variant: 'prop_b', name: 'Commuter 40', wake: 'L', approach: 110, cruise: 240 },
}

export const CITIES = [
  { code: 'QVRN', name: 'Varnholm' },
  { code: 'QTAL', name: 'Talmouth' },
  { code: 'QBRE', name: 'Bresca' },
  { code: 'QKIL', name: 'Kilnamore' },
  { code: 'QSUN', name: 'Sunmere' },
  { code: 'QAST', name: 'Astrel' },
  { code: 'QLOR', name: 'Lorrin' },
  { code: 'QPEL', name: 'Pellagh' },
]

// The six steps the bottom timeline follows for one arrival.
export const ARRIVAL_STEPS = [
  { key: 'handoff', label: 'Handoff' },
  { key: 'descend', label: 'Descend' },
  { key: 'hold', label: 'Hold' },
  { key: 'approach', label: 'Approach' },
  { key: 'land', label: 'Land' },
  { key: 'vacate', label: 'Vacate' },
]

// ---------- airport ----------
// Two parallel runways. Arrivals land on 27R (north), departures leave from 27L (south).
export const RUNWAYS = {
  R1: { id: 'R1', name: '27R', reverseName: '09L', z: -50, from: -210, to: 210, width: 20 },
  R2: { id: 'R2', name: '27L', reverseName: '09R', z: 40, from: -240, to: 240, width: 24 },
}

export const TAXIWAY_Z = -100
export const STAND_Z = -168
export const STAND_X = [-125, -75, -25, 25, 75, 125]
const VACATE_X = -150
const DEPARTURE_CONNECTOR_X = 262

// Track points carry an altitude (ft) and a target speed (kt); `ground` marks taxiing.
export function arrivalTrack(entry, standX) {
  const runway = RUNWAYS.R1
  const track = [
    { ...entry, step: 'approach' },
    { x: runway.to, z: runway.z, altitude: 50, speed: entry.landingSpeed, step: 'land' },
    { x: runway.to - 32, z: runway.z, altitude: 0, speed: entry.landingSpeed - 8 },
    { x: VACATE_X + 50, z: runway.z, altitude: 0, speed: 26 },
    { x: VACATE_X + 8, z: runway.z - 4, altitude: 0, speed: 18, step: 'vacate' },
    { x: VACATE_X, z: runway.z - 24, altitude: 0, speed: 18, ground: true },
    { x: VACATE_X + 10, z: TAXIWAY_Z, altitude: 0, speed: 18, ground: true },
  ]
  // In the approach sector the aircraft is handed to tower once it vacates the runway.
  if (standX === null) return track.slice(0, 5)
  return [
    ...track,
    { x: standX - 14, z: TAXIWAY_Z, altitude: 0, speed: 16, ground: true },
    { x: standX, z: TAXIWAY_Z - 16, altitude: 0, speed: 8, ground: true },
    { x: standX, z: STAND_Z, altitude: 0, speed: 3, ground: true, stand: true },
  ]
}

export function departureTaxiTrack(standX) {
  const runway = RUNWAYS.R2
  return [
    { x: standX, z: STAND_Z, altitude: 0, speed: 4, ground: true },
    { x: standX, z: TAXIWAY_Z - 22, altitude: 0, speed: 4, ground: true, reverse: true },
    { x: standX + 18, z: TAXIWAY_Z, altitude: 0, speed: 16, ground: true },
    { x: DEPARTURE_CONNECTOR_X - 14, z: TAXIWAY_Z, altitude: 0, speed: 18, ground: true },
    { x: DEPARTURE_CONNECTOR_X, z: TAXIWAY_Z + 14, altitude: 0, speed: 14, ground: true },
    { x: DEPARTURE_CONNECTOR_X, z: runway.z - 26, altitude: 0, speed: 6, ground: true, holdShort: true },
  ]
}

export function takeoffTrack(climbTo) {
  const runway = RUNWAYS.R2
  return [
    { x: DEPARTURE_CONNECTOR_X, z: runway.z - 26, altitude: 0, speed: 8, ground: true },
    { x: runway.to - 6, z: runway.z, altitude: 0, speed: 10, ground: true },
    { x: runway.to - 20, z: runway.z, altitude: 0, speed: 160 },
    { x: runway.to - 190, z: runway.z, altitude: 0, speed: 160, liftoff: true },
    { x: runway.from - 140, z: runway.z, altitude: climbTo, speed: 200 },
  ]
}

// ---------- sectors ----------

const TOWER_SITE = {
  id: 'TWR',
  name: 'Ondra Tower',
  area: 'Runways 27L and 27R',
  frequency: '118.350',
  // Map units per nautical mile; separation minimum in NM; feet to map units for height.
  nm: 50,
  minimumSeparation: 2.5,
  altitudeScale: 0.03,
  aircraftScale: 1,
  sceneryScale: 1,
  extent: { x: 820, z: 560 },
  coast: { z: 330, amplitude: 70 },
  hasAirport: true,
  groundBoost: 5,
  radar: { x: -300, z: -150, range: 760 },
  view: { distance: 620, azimuth: 0.38, polar: 0.86, target: [0, 0, -20] },
  towns: [
    { x: 470, z: -330, radius: 120, count: 46 },
    { x: -560, z: -280, radius: 110, count: 38 },
    { x: -420, z: 230, radius: 80, count: 22 },
  ],
  fixes: [
    { id: 'ODRIN', x: 700, z: -50, kind: 'fix_pylon_tall', note: 'Final approach fix, 2,500 ft' },
    { id: 'ON', x: -560, z: -50, kind: 'ndb_station', note: 'Locator beacon, 27R climb-out' },
    { id: 'OND', x: -380, z: 160, kind: 'vor_station', note: 'Ondra VOR' },
  ],
  airways: [
    { from: [820, -50], to: [210, -50], kind: 'final' },
    { from: [-240, 40], to: [-820, 40], kind: 'route' },
    { from: [-500, 40], to: [-820, 330], kind: 'route' },
  ],
  // Arrivals start on a long final; departures come from the stands.
  arrivalEntry: { x: 820, z: -50, altitude: 2700, speed: 165 },
  departureExits: [
    [{ name: 'DUNMO', x: -620, z: 180, altitude: 3000, speed: 210 }, { x: -1000, z: 420, altitude: 4000, speed: 230, exit: true }],
    [{ name: 'HESTA', x: -620, z: -230, altitude: 3000, speed: 210 }, { x: -1000, z: -480, altitude: 4000, speed: 230, exit: true }],
  ],
  arrivalEvery: 15,
  turnaroundSeconds: 22,
  maxFlights: 12,
  weather: null,
  birds: { x: 330, z: 300, radius: 120 },
}

const APPROACH_SITE = {
  id: 'APP',
  name: 'Ondra Approach',
  area: 'Terminal area, 40 NM',
  frequency: '124.725',
  nm: 70,
  minimumSeparation: 3,
  altitudeScale: 0.012,
  aircraftScale: 3,
  sceneryScale: 1.7,
  extent: { x: 1650, z: 1180 },
  coast: { z: 420, amplitude: 160 },
  hasAirport: true,
  groundBoost: 3,
  radar: { x: -300, z: -150, range: 1650 },
  view: { distance: 1900, azimuth: 0.38, polar: 0.8, target: [0, 0, -40] },
  towns: [
    { x: 470, z: -330, radius: 130, count: 40 },
    { x: -620, z: -320, radius: 140, count: 46 },
    { x: 1100, z: -760, radius: 150, count: 40 },
    { x: -1150, z: 160, radius: 120, count: 30 },
  ],
  fixes: [
    { id: 'KILNA', x: 1200, z: -50, kind: 'holding_marker', note: 'Holding fix, stack from 5,000 ft' },
    { id: 'ODRIN', x: 720, z: -50, kind: 'fix_pylon_tall', note: 'Final approach fix, 2,500 ft' },
    { id: 'ARVEN', x: 1500, z: -980, kind: 'fix_pylon', note: 'Arrival gate, north-east' },
    { id: 'MERRO', x: 1500, z: 980, kind: 'fix_pylon', note: 'Arrival gate, south-east' },
    { id: 'TOLSA', x: 1280, z: 480, kind: 'fix_pylon', note: 'Arrival route, south-east' },
    { id: 'VESPA', x: -1480, z: -820, kind: 'fix_pylon', note: 'Arrival gate, west' },
    { id: 'PELLO', x: 420, z: -720, kind: 'vor_station', note: 'Pello VOR, downwind' },
    { id: 'DUNMO', x: -900, z: 260, kind: 'fix_pylon', note: 'Departure route, south-west' },
    { id: 'HESTA', x: -820, z: -480, kind: 'ndb_station', note: 'Departure route, north-west' },
  ],
  airways: [
    { from: [1200, -50], to: [210, -50], kind: 'final' },
    { from: [1650, -1100], to: [1200, -50], kind: 'route' },
    { from: [1650, 1100], to: [1280, 480], kind: 'route' },
    { from: [1280, 480], to: [1200, -50], kind: 'route' },
    { from: [-1650, -900], to: [420, -720], kind: 'route' },
    { from: [420, -720], to: [1200, -50], kind: 'route' },
    { from: [-240, 40], to: [-900, 260], kind: 'route' },
    { from: [-900, 260], to: [-1650, 900], kind: 'route' },
    { from: [-240, 40], to: [-820, -480], kind: 'route' },
    { from: [-820, -480], to: [-1650, -1100], kind: 'route' },
  ],
  arrivalRoutes: [
    [{ name: 'ARVEN', x: 1650, z: -1100, altitude: 11000, speed: 250 }, { name: 'KILNA', x: 1200, z: -50, altitude: 5000, speed: 210, hold: true }],
    [{ name: 'MERRO', x: 1650, z: 1100, altitude: 10000, speed: 250 }, { name: 'TOLSA', x: 1280, z: 480, altitude: 7000, speed: 230 }, { name: 'KILNA', x: 1200, z: -50, altitude: 5000, speed: 210, hold: true }],
    [{ name: 'VESPA', x: -1650, z: -900, altitude: 12000, speed: 260 }, { name: 'PELLO', x: 420, z: -720, altitude: 8000, speed: 240 }, { name: 'KILNA', x: 1200, z: -50, altitude: 5000, speed: 210, hold: true }],
  ],
  finalEntry: { name: 'ODRIN', x: 720, z: -50, altitude: 2500, speed: 170 },
  departureExits: [
    [{ name: 'DUNMO', x: -900, z: 260, altitude: 6000, speed: 250 }, { x: -1750, z: 960, altitude: 13000, speed: 280, exit: true }],
    [{ name: 'HESTA', x: -820, z: -480, altitude: 7000, speed: 250 }, { x: -1750, z: -1160, altitude: 14000, speed: 280, exit: true }],
  ],
  holdStack: [5000, 6000, 7000, 8000],
  // Simulated seconds between two aircraft leaving the holding fix for the final.
  finalSpacing: 95,
  arrivalEvery: 13,
  departureEvery: 11,
  maxFlights: 18,
  weather: { x: 900, z: 900, radius: 170, drift: { x: -2.2, z: -9 }, wrap: { from: 1500, to: -1500 } },
  birds: { x: 260, z: 520, radius: 160 },
}

const ENROUTE_SITE = {
  id: 'CTR',
  name: 'Saltline Sector',
  area: 'En route, FL240 to FL400',
  frequency: '132.180',
  nm: 90,
  minimumSeparation: 5,
  altitudeScale: 0.0058,
  aircraftScale: 5,
  sceneryScale: 4,
  extent: { x: 2600, z: 1850 },
  coast: { z: 480, amplitude: 360 },
  hasAirport: false,
  groundBoost: 1,
  radar: { x: 0, z: 0, range: 2600 },
  view: { distance: 3500, azimuth: 0.38, polar: 0.8, target: [0, 0, 0] },
  towns: [
    { x: -1500, z: -700, radius: 260, count: 40 },
    { x: 700, z: -1100, radius: 240, count: 34 },
    { x: 1700, z: 300, radius: 200, count: 26 },
    { x: -400, z: 200, radius: 220, count: 30 },
  ],
  fixes: [
    { id: 'BARRA', x: -600, z: -300, kind: 'vor_station', note: 'Barra VOR, airway junction' },
    { id: 'SELKA', x: 400, z: 300, kind: 'vor_station', note: 'Selka VOR, airway junction' },
    { id: 'TERNA', x: 1300, z: 950, kind: 'fix_pylon_tall', note: 'Top of descent gate for Ondra Bay' },
    { id: 'MAVIK', x: -1900, z: -600, kind: 'fix_pylon', note: 'Airway L612 entry' },
    { id: 'ROSKO', x: 1900, z: 100, kind: 'fix_pylon', note: 'Airway L612 exit' },
    { id: 'LUNDE', x: 500, z: -1500, kind: 'ndb_station', note: 'Airway M45 entry' },
  ],
  airways: [
    { from: [-2600, -720], to: [-600, -300], kind: 'route' },
    { from: [-600, -300], to: [2600, 180], kind: 'route' },
    { from: [550, -1850], to: [400, 300], kind: 'route' },
    { from: [400, 300], to: [180, 1850], kind: 'route' },
    { from: [-2450, 1500], to: [400, 300], kind: 'route' },
    { from: [400, 300], to: [2450, -1450], kind: 'route' },
    { from: [-600, -300], to: [1300, 950], kind: 'route' },
    { from: [1300, 950], to: [2600, 1650], kind: 'route' },
  ],
  overflightRoutes: [
    { level: 350, points: [[-2600, -720], [-600, -300], [2600, 180]] },
    { level: 340, points: [[2600, 180], [-600, -300], [-2600, -720]] },
    { level: 370, points: [[550, -1850], [400, 300], [180, 1850]] },
    { level: 360, points: [[180, 1850], [400, 300], [550, -1850]] },
    { level: 390, points: [[-2450, 1500], [400, 300], [2450, -1450]] },
    { level: 380, points: [[2450, -1450], [400, 300], [-2450, 1500]] },
  ],
  arrivalRoute: [
    { x: -2600, z: -720, altitude: 34000, speed: 450 },
    { name: 'BARRA', x: -600, z: -300, altitude: 30000, speed: 430 },
    { name: 'TERNA', x: 1300, z: 950, altitude: 15000, speed: 320 },
    { x: 2700, z: 1700, altitude: 11000, speed: 280, exit: true },
  ],
  arrivalEvery: 14,
  overflightEvery: 5,
  maxFlights: 20,
  weather: { x: -200, z: -1400, radius: 300, drift: { x: 2, z: 13 }, wrap: { from: -2300, to: 2300 } },
  birds: null,
}

export const SITES = [TOWER_SITE, APPROACH_SITE, ENROUTE_SITE]
