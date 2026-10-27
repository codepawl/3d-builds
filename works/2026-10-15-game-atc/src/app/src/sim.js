// The seeded traffic simulation. Each sector runs its own world: flights follow routes, the
// controller (simulated) clears levels, sequences arrivals through the hold, steers traffic around
// weather and resolves conflicts. The scene and the dashboard only read this state.
import {
  AIRCRAFT_TYPES, AIRLINES, AIRPORT, CITIES, RUNWAYS, SITES, STAND_X, STAND_Z, TIME_SCALE,
  arrivalTrack, departureTaxiTrack, takeoffTrack,
} from './data.js'

const START_CLOCK = 9 * 3600 + 40 * 60
const PREWARM_SECONDS = 110
const HISTORY_EVERY = 0.9
const HISTORY_LENGTH = 16
const TURN_RATE = 3
const CLIMB_FPM = 2200
const DESCENT_FPM = 1800
const DEPARTURE_SPACING = 75
const LOG_LENGTH = 40
// Pairs inside this many times the separation minimum (and within 1,000 ft) raise an amber alert.
const ALERT_FACTOR = 2.4

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (random, list) => list[Math.floor(random() * list.length)]

export function bearing(from, to) {
  const degrees = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI
  return (degrees + 360) % 360
}

function turnToward(current, target, maxStep) {
  const difference = ((target - current + 540) % 360) - 180
  const step = Math.max(-maxStep, Math.min(maxStep, difference))
  return (current + step + 360) % 360
}

function approach(current, target, maxStep) {
  if (Math.abs(target - current) <= maxStep) return target
  return current + Math.sign(target - current) * maxStep
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// Map units travelled per real second at one knot.
const unitsPerKnot = (site) => (site.nm * TIME_SCALE) / 3600

function log(state, flight, text, kind = 'instruction') {
  state.log.unshift({ id: `${state.clock.toFixed(1)}-${flight?.id ?? 'sys'}-${state.log.length}`, at: state.clock, flightId: flight?.id ?? null, callsign: flight?.callsign ?? '', text, kind })
  if (state.log.length > LOG_LENGTH) state.log.length = LOG_LENGTH
  if (flight) flight.lastInstruction = text
}

export const formatLevel = (feet) => (feet >= 18000 ? `FL${Math.round(feet / 100)}` : `${Math.round(feet).toLocaleString('en-US')} ft`)

// ---------- flights ----------

function newFlight(state, kind, { typeKey, airlineCode } = {}) {
  const random = state.random
  const airline = airlineCode ?? pick(random, Object.keys(AIRLINES))
  const type = typeKey ?? pick(random, state.site.id === 'CTR' ? ['TJ20', 'TJ23', 'RJ90', 'WB35', 'TJ20'] : ['TJ20', 'TJ23', 'RJ90', 'TP72', 'TP40', 'WB35'])
  let number
  do number = 100 + Math.floor(random() * 880)
  while (state.usedNumbers.has(`${airline}${number}`))
  state.usedNumbers.add(`${airline}${number}`)
  const city = pick(random, CITIES)
  const flight = {
    id: `${state.site.id}-${state.nextId++}`,
    callsign: `${airline}${number}`,
    spoken: `${AIRLINES[airline].spoken} ${number}`,
    airline,
    type,
    kind,
    origin: kind === 'departure' ? { code: AIRPORT.code, name: AIRPORT.city } : city,
    destination: kind === 'arrival' ? { code: AIRPORT.code, name: AIRPORT.city } : pick(random, CITIES.filter((other) => other !== city)),
    squawk: Array.from({ length: 4 }, () => Math.floor(random() * 8)).join(''),
    phase: 'cruise',
    mode: 'steer',
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    altitude: 0,
    clearedAltitude: 0,
    levelOverride: null,
    speed: 0,
    targetSpeed: 0,
    speedOverride: null,
    route: [],
    legIndex: 0,
    track: null,
    trackIndex: 0,
    hold: null,
    history: [],
    historyTimer: random() * HISTORY_EVERY,
    steps: {},
    bornAt: state.clock,
    delay: kind === 'arrival' ? Math.floor(random() * 7) : 0,
    alert: 'none',
    lastInstruction: '',
    standIndex: null,
    gearDown: false,
    removed: false,
  }
  state.flights.push(flight)
  return flight
}

function setAltitudeVisual(state, flight) {
  flight.position.y = flight.altitude * state.site.altitudeScale
}

function startSteering(state, flight, route) {
  flight.mode = 'steer'
  flight.track = null
  flight.route = route
  flight.legIndex = 0
  clearForLeg(state, flight, false)
}

// Applies the altitude and speed of the next waypoint, the way a controller clears each leg.
function clearForLeg(state, flight, speak = true) {
  const target = flight.route[flight.legIndex]
  if (!target) return
  const level = flight.levelOverride ?? (target.hold ? freeStackLevel(state, flight) : target.altitude)
  const changed = level !== flight.clearedAltitude
  flight.clearedAltitude = level
  flight.targetSpeed = target.speed
  flight.speedOverride = null
  if (speak && changed) {
    const verb = level < flight.altitude ? 'descend and maintain' : 'climb and maintain'
    log(state, flight, `${verb} ${formatLevel(level)}${target.name ? `, direct ${target.name}` : ''}`)
  }
}

// The lowest holding level nobody else is using, so arrivals descend onto the top of the stack.
function freeStackLevel(state, flight) {
  const taken = new Set(state.flights.filter((other) => other.hold && other !== flight).map((other) => other.hold.level))
  let level = state.site.holdStack[0]
  while (taken.has(level)) level += 1000
  return level
}

function startTrack(state, flight, points) {
  flight.mode = 'track'
  flight.track = [{ x: flight.position.x, z: flight.position.z, altitude: flight.altitude, speed: flight.speed }, ...points.slice(1)]
  flight.trackIndex = 0
}

function freeStand(state) {
  const taken = new Set(state.flights.filter((flight) => flight.standIndex !== null).map((flight) => flight.standIndex))
  const free = STAND_X.map((_, index) => index).filter((index) => !taken.has(index))
  return free.length ? free[Math.floor(state.random() * free.length)] : null
}

function spawnTowerArrival(state) {
  const standIndex = freeStand(state)
  if (standIndex === null) return
  const site = state.site
  const flight = newFlight(state, 'arrival')
  const type = AIRCRAFT_TYPES[flight.type]
  const entry = { ...site.arrivalEntry, landingSpeed: type.approach }
  flight.position = { x: entry.x, y: 0, z: entry.z }
  flight.altitude = entry.altitude
  flight.speed = entry.speed
  flight.heading = 270
  flight.phase = 'approach'
  flight.gearDown = true
  flight.standIndex = standIndex
  flight.steps = { handoff: state.clock, descend: state.clock, hold: 'skipped', approach: state.clock }
  startTrack(state, flight, arrivalTrack(entry, STAND_X[standIndex]))
  setAltitudeVisual(state, flight)
  log(state, flight, `cleared ILS 27R, contact tower ${site.frequency}`, 'handoff')
}

function spawnApproachArrival(state) {
  const site = state.site
  const route = site.arrivalRoutes[state.arrivalCycle++ % site.arrivalRoutes.length]
  const flight = newFlight(state, 'arrival')
  flight.position = { x: route[0].x, y: 0, z: route[0].z }
  flight.altitude = route[0].altitude
  flight.speed = route[0].speed
  flight.heading = bearing(route[0], route[1])
  flight.phase = 'descend'
  flight.steps = { handoff: state.clock }
  startSteering(state, flight, [...route.slice(1), { ...site.finalEntry, final: true }])
  setAltitudeVisual(state, flight)
  log(state, flight, `radar contact, descend ${formatLevel(flight.clearedAltitude)}`, 'handoff')
}

function spawnApproachDeparture(state) {
  const flight = newFlight(state, 'departure')
  const track = takeoffTrack(1500)
  flight.position = { x: track[0].x, y: 0, z: track[0].z }
  flight.heading = 180
  flight.phase = 'holdShort'
  flight.mode = 'track'
  flight.track = track
  flight.trackIndex = 0
  flight.gearDown = true
  flight.holding = true
  flight.departureRoute = state.site.departureExits[state.departureCycle++ % state.site.departureExits.length]
}

function spawnOverflight(state) {
  const site = state.site
  const routeIndex = state.overflightCycle++ % site.overflightRoutes.length
  const plan = site.overflightRoutes[routeIndex]
  const flight = newFlight(state, 'overflight')
  const cruise = AIRCRAFT_TYPES[flight.type].cruise
  const level = plan.level * 100
  const route = plan.points.map(([x, z], index) => ({ x, z, altitude: level, speed: cruise, exit: index === plan.points.length - 1 }))
  // Push the exit beyond the map edge so aircraft fly off the screen before they disappear.
  const last = route[route.length - 1]
  const previous = route[route.length - 2]
  const outward = distance(last, previous)
  last.x += ((last.x - previous.x) / outward) * 300
  last.z += ((last.z - previous.z) / outward) * 300
  flight.position = { x: route[0].x, y: 0, z: route[0].z }
  flight.altitude = level
  flight.speed = cruise
  flight.heading = bearing(route[0], route[1])
  flight.phase = 'cruise'
  startSteering(state, flight, route.slice(1))
  setAltitudeVisual(state, flight)
  log(state, flight, `radar contact, maintain ${formatLevel(level)}`, 'handoff')
}

function spawnEnrouteArrival(state) {
  const route = state.site.arrivalRoute
  const flight = newFlight(state, 'arrival', { typeKey: pick(state.random, ['TJ20', 'TJ23', 'RJ90']) })
  flight.position = { x: route[0].x, y: 0, z: route[0].z }
  flight.altitude = route[0].altitude
  flight.speed = route[0].speed
  flight.heading = bearing(route[0], route[1])
  flight.phase = 'cruise'
  flight.steps = { handoff: state.clock }
  startSteering(state, flight, route.slice(1))
  setAltitudeVisual(state, flight)
  log(state, flight, `radar contact, expect descent at BARRA`, 'handoff')
}

// ---------- movement ----------

function moveAlongTrack(state, flight, dt) {
  const site = state.site
  const simDt = dt * TIME_SCALE
  if (flight.holding) {
    flight.speed = approach(flight.speed, 0, 6 * simDt)
    return
  }
  const next = flight.track[flight.trackIndex + 1]
  if (!next) return finishTrack(state, flight)
  const accelerating = next.speed > flight.speed
  const rate = accelerating ? (next.ground ? 2 : 3.2) : flight.altitude > 0 ? 1.6 : 2.6
  flight.speed = approach(flight.speed, next.speed, rate * simDt)
  const boost = next.ground || (flight.altitude === 0 && flight.speed < 60) ? site.groundBoost : 1
  let travel = Math.max(flight.speed, 2) * unitsPerKnot(site) * boost * dt
  while (travel > 0) {
    const from = flight.track[flight.trackIndex]
    const to = flight.track[flight.trackIndex + 1]
    if (!to) return finishTrack(state, flight)
    const remaining = distance(flight.position, to)
    const heading = bearing(from, to)
    flight.heading = turnToward(flight.heading, to.reverse ? (heading + 180) % 360 : heading, (to.ground ? 30 : 8) * simDt)
    if (travel < remaining) {
      const fraction = travel / remaining
      flight.position.x += (to.x - flight.position.x) * fraction
      flight.position.z += (to.z - flight.position.z) * fraction
      const segment = distance(from, to) || 1
      const along = 1 - (remaining - travel) / segment
      flight.altitude = from.altitude + (to.altitude - from.altitude) * Math.max(0, Math.min(1, along))
      travel = 0
    } else {
      flight.position.x = to.x
      flight.position.z = to.z
      flight.altitude = to.altitude
      travel -= remaining
      flight.trackIndex++
      reachTrackPoint(state, flight, to)
      if (flight.mode !== 'track' || flight.holding || flight.removed) break
    }
  }
  setAltitudeVisual(state, flight)
}

function reachTrackPoint(state, flight, point) {
  if (point.step === 'land') {
    flight.steps.land = state.clock
    flight.phase = 'landing'
    state.runwayUse.R1 = { flightId: flight.id, since: state.clock }
    state.landings.push(state.clock)
    log(state, flight, 'landed runway 27R', 'event')
  }
  if (point.step === 'vacate') {
    flight.steps.vacate = state.clock
    flight.phase = 'taxiIn'
    if (state.runwayUse.R1?.flightId === flight.id) state.runwayUse.R1 = null
    if (flight.standIndex !== null) log(state, flight, `taxi to stand ${flight.standIndex + 1} via A`)
  }
  if (point.holdShort) {
    flight.holding = true
    flight.phase = 'holdShort'
  }
  if (point.liftoff) {
    flight.phase = 'climb'
    if (state.runwayUse.R2?.flightId === flight.id) state.runwayUse.R2 = null
  }
  if (point.stand) {
    flight.phase = 'parked'
    flight.parkedUntil = state.clock + state.site.turnaroundSeconds * TIME_SCALE * (0.8 + state.random() * 0.6)
  }
}

function finishTrack(state, flight) {
  if (flight.phase === 'parked') return
  if (flight.kind === 'arrival') {
    log(state, flight, 'vacated, handed to ground', 'handoff')
    removeFlight(state, flight)
    return
  }
  flight.phase = 'climb'
  flight.gearDown = false
  startSteering(state, flight, flight.departureRoute)
  log(state, flight, `climb ${formatLevel(flight.clearedAltitude)}, direct ${flight.departureRoute[0].name}`)
}

function removeFlight(state, flight) {
  flight.removed = true
  if (state.runwayUse.R1?.flightId === flight.id) state.runwayUse.R1 = null
  if (state.runwayUse.R2?.flightId === flight.id) state.runwayUse.R2 = null
}

function steer(state, flight, dt) {
  const site = state.site
  const simDt = dt * TIME_SCALE
  if (flight.hold) return flyHold(state, flight, dt)
  const target = flight.route[flight.legIndex]
  if (!target) return removeFlight(state, flight)
  flight.heading = turnToward(flight.heading, bearing(flight.position, target), TURN_RATE * simDt)
  const climbing = flight.clearedAltitude > flight.altitude
  const urgent = flight.levelOverride !== null && flight.levelOverride === flight.clearedAltitude
  const verticalRate = ((climbing ? CLIMB_FPM : DESCENT_FPM) * (site.id === 'CTR' ? 1.3 : 1) * (urgent ? 1.5 : 1)) / 60
  if (!climbing && flight.clearedAltitude < flight.altitude && flight.kind === 'arrival' && !flight.steps.descend) {
    flight.steps.descend = state.clock
    flight.phase = 'descend'
  }
  flight.altitude = approach(flight.altitude, flight.clearedAltitude, verticalRate * simDt)
  flight.speed = approach(flight.speed, flight.speedOverride ?? flight.targetSpeed, 1.6 * simDt)
  if (flight.kind === 'departure' && flight.altitude > 400) flight.gearDown = false
  const step = flight.speed * unitsPerKnot(site) * dt
  const radians = (flight.heading * Math.PI) / 180
  flight.position.x += Math.sin(radians) * step
  flight.position.z -= Math.cos(radians) * step
  setAltitudeVisual(state, flight)
  // A waypoint counts as passed inside one turn radius (or when the aircraft starts moving away).
  const turnRadius = (flight.speed * unitsPerKnot(site)) / ((TURN_RATE * TIME_SCALE * Math.PI) / 180)
  if (distance(flight.position, target) < Math.max(site.nm * 0.4, turnRadius * 0.5)) reachWaypoint(state, flight, target)
}

function reachWaypoint(state, flight, target) {
  if (target.detour) flight.avoiding = false
  if (target.exit) {
    if (flight.kind === 'arrival') {
      flight.steps.exitedAt = state.clock
      state.landings.push(state.clock)
    }
    log(state, flight, flight.kind === 'arrival' ? 'contact Ondra Approach 124.725' : 'leaving the sector, frequency change approved', 'handoff')
    removeFlight(state, flight)
    return
  }
  if (target.final) {
    flight.phase = 'approach'
    flight.steps.approach = state.clock
    flight.gearDown = true
    const type = AIRCRAFT_TYPES[flight.type]
    startTrack(state, flight, arrivalTrack({ ...target, landingSpeed: type.approach, speed: type.approach + 20 }, null))
    log(state, flight, 'cleared ILS approach runway 27R')
    return
  }
  if (target.hold) return arriveAtHoldingFix(state, flight, target)
  if (target.name === 'TERNA' && flight.kind === 'arrival') flight.phase = 'descend'
  flight.legIndex++
  clearForLeg(state, flight)
}

function arriveAtHoldingFix(state, flight, fix) {
  const site = state.site
  const someoneWaiting = state.flights.some((other) => other.hold && other !== flight)
  if (state.clock >= state.nextFinalSlot && !someoneWaiting) {
    flight.steps.hold = 'skipped'
    state.nextFinalSlot = state.clock + site.finalSpacing
    flight.legIndex++
    clearForLeg(state, flight)
    return
  }
  const level = freeStackLevel(state, flight)
  const radius = site.nm * 1.3
  const headingRadians = (flight.heading * Math.PI) / 180
  const center = { x: fix.x + Math.cos(headingRadians) * radius, z: fix.z + Math.sin(headingRadians) * radius }
  flight.hold = { center, radius, angle: Math.atan2(fix.z - center.z, fix.x - center.x), turned: 0, level, enteredAt: state.clock }
  flight.phase = 'hold'
  flight.steps.hold = state.clock
  flight.clearedAltitude = level
  flight.targetSpeed = 200
  log(state, flight, `hold at ${fix.name} as published, maintain ${formatLevel(level)}, expect further clearance in ${Math.round(site.finalSpacing / 60) + 1} min`)
}

function flyHold(state, flight, dt) {
  const site = state.site
  const simDt = dt * TIME_SCALE
  const hold = flight.hold
  flight.altitude = approach(flight.altitude, flight.clearedAltitude, (DESCENT_FPM / 60) * simDt)
  flight.speed = approach(flight.speed, 200, 1.6 * simDt)
  const angularStep = (flight.speed * unitsPerKnot(site) * dt) / hold.radius
  hold.angle += angularStep
  hold.turned += angularStep
  flight.position.x = hold.center.x + Math.cos(hold.angle) * hold.radius
  flight.position.z = hold.center.z + Math.sin(hold.angle) * hold.radius
  const tangent = bearing({ x: 0, z: 0 }, { x: -Math.sin(hold.angle), z: Math.cos(hold.angle) })
  flight.heading = turnToward(flight.heading, tangent, 20 * simDt)
  flight.delay += simDt / 60
  setAltitudeVisual(state, flight)
  if (hold.turned < Math.PI * 2) return
  hold.turned -= Math.PI * 2
  const first = state.flights.filter((other) => other.hold).sort((a, b) => a.hold.enteredAt - b.hold.enteredAt)[0]
  if (first !== flight || state.clock < state.nextFinalSlot) return
  flight.hold = null
  flight.phase = 'descend'
  state.nextFinalSlot = state.clock + site.finalSpacing
  flight.legIndex++
  clearForLeg(state, flight)
  // The stack steps down behind the aircraft that left.
  state.flights.filter((other) => other.hold).forEach((other) => {
    const index = site.holdStack.indexOf(other.hold.level)
    if (index > 0 && !state.flights.some((another) => another.hold?.level === site.holdStack[index - 1])) {
      other.hold.level = site.holdStack[index - 1]
      other.clearedAltitude = other.hold.level
      log(state, other, `descend ${formatLevel(other.hold.level)} in the hold`)
    }
  })
}

// ---------- tower ground flow ----------

function releaseParked(state) {
  if (state.flights.some((flight) => flight.phase === 'taxiOut')) return
  for (const flight of state.flights) {
    if (flight.phase !== 'parked' || state.clock < flight.parkedUntil) continue
    // Turnaround done: the same aircraft leaves as a new departure.
    const departure = newFlight(state, 'departure', { typeKey: flight.type, airlineCode: flight.airline })
    removeFlight(state, flight)
    const standX = STAND_X[flight.standIndex]
    departure.standIndex = flight.standIndex
    departure.position = { x: standX, y: 0, z: STAND_Z }
    departure.heading = 0
    departure.phase = 'taxiOut'
    departure.gearDown = true
    departure.mode = 'track'
    departure.track = departureTaxiTrack(standX)
    departure.trackIndex = 0
    departure.departureRoute = state.site.departureExits[state.departureCycle++ % state.site.departureExits.length]
    log(state, departure, 'push and start approved, taxi to holding point 27L via A')
    return
  }
}

// Releases the first aircraft waiting at the 27L holding point once the runway is free.
function releaseTakeoff(state) {
  if (state.runwayUse.R2 || state.clock - state.lastDeparture < DEPARTURE_SPACING) return
  const waiting = state.flights.find((flight) => flight.holding && flight.phase === 'holdShort' && flight.speed < 1)
  if (!waiting) return
  waiting.holding = false
  waiting.phase = 'takeoff'
  waiting.standIndex = null
  waiting.track = takeoffTrack(state.site.id === 'TWR' ? 1800 : 1500)
  waiting.trackIndex = 0
  waiting.position.x = waiting.track[0].x
  waiting.position.z = waiting.track[0].z
  state.runwayUse.R2 = { flightId: waiting.id, since: state.clock }
  state.lastDeparture = state.clock
  state.departures.push(state.clock)
  log(state, waiting, 'runway 27L, wind 260 at 9, cleared for take-off')
}

// ---------- weather ----------

function stepWeather(state, dt) {
  const weather = state.weather
  if (!weather) return
  weather.x += weather.drift.x * dt
  weather.z += weather.drift.z * dt
  const goingSouth = weather.drift.z > 0
  if ((goingSouth && weather.z > weather.wrap.to) || (!goingSouth && weather.z < weather.wrap.to)) weather.z = weather.wrap.from
  weather.flash = Math.max(0, weather.flash - dt * 3)
  weather.flashTimer -= dt
  if (weather.flashTimer <= 0) {
    weather.flash = 1
    weather.flashSide = state.random() < 0.5 ? 0 : 1
    weather.flashTimer = 1.4 + state.random() * 2.6
  }
}

// Inserts a detour waypoint when the next leg passes through the cell.
function avoidWeather(state, flight) {
  const weather = state.weather
  if (!weather || flight.mode !== 'steer' || flight.hold || flight.avoiding) return
  const target = flight.route[flight.legIndex]
  if (!target || target.final || target.hold) return
  const legX = target.x - flight.position.x
  const legZ = target.z - flight.position.z
  const legLength = Math.hypot(legX, legZ)
  if (legLength < 1) return
  const along = ((weather.x - flight.position.x) * legX + (weather.z - flight.position.z) * legZ) / legLength
  if (along < 0 || along > legLength) return
  const closest = { x: flight.position.x + (legX / legLength) * along, z: flight.position.z + (legZ / legLength) * along }
  const margin = weather.radius * 1.35
  if (distance(closest, weather) > margin) return
  const awayX = closest.x - weather.x
  const awayZ = closest.z - weather.z
  const awayLength = Math.hypot(awayX, awayZ) || 1
  const sideX = awayLength > 1 ? awayX / awayLength : -legZ / legLength
  const sideZ = awayLength > 1 ? awayZ / awayLength : legX / legLength
  const detour = { ...target, name: undefined, exit: false, detour: true, x: weather.x + sideX * weather.radius * 1.9, z: weather.z + sideZ * weather.radius * 1.9 }
  flight.route.splice(flight.legIndex, 0, detour)
  flight.avoiding = true
  const newHeading = Math.round(bearing(flight.position, detour) / 10) * 10 || 360
  const turnRight = ((newHeading - flight.heading + 540) % 360) - 180 > 0
  log(state, flight, `turn ${turnRight ? 'right' : 'left'} heading ${String(newHeading).padStart(3, '0')}, avoiding weather`)
  state.reroutes++
}

// ---------- conflicts ----------

const airborne = (flight) => !flight.removed && flight.altitude > 300

function stepConflicts(state) {
  const site = state.site
  const flying = state.flights.filter(airborne)
  state.flights.forEach((flight) => {
    flight.alert = 'none'
  })
  let minimum = null
  const active = new Set()
  const nextDistances = new Map()
  for (let first = 0; first < flying.length; first++) {
    for (let second = first + 1; second < flying.length; second++) {
      const a = flying[first]
      const b = flying[second]
      const lateral = distance(a.position, b.position) / site.nm
      const vertical = Math.abs(a.altitude - b.altitude)
      if (vertical < 1000 && (!minimum || lateral < minimum.lateral)) minimum = { lateral, vertical, ids: [a.id, b.id] }
      if (vertical >= 1000 || lateral > site.minimumSeparation * ALERT_FACTOR) continue
      // Aircraft on the approach or take-off path to the parallel runways are separated by the
      // procedure itself (tower's runway separation), not by the radar minimum.
      if (a.mode === 'track' || b.mode === 'track') continue
      // The holding stack is separated by its levels; aircraft stepping down in it are not a conflict.
      if (a.hold && b.hold) continue
      const key = [a.id, b.id].sort().join('|')
      // Like a short-term conflict alert: inside the minimum always counts, otherwise only when closing.
      const previous = state.pairDistances.get(key)
      nextDistances.set(key, lateral)
      const closing = previous !== undefined && lateral < previous - 1e-4
      const isActive = state.conflicts.some((candidate) => candidate.key === key && candidate.state === 'active')
      // A pair that was just resolved is not re-alerted for a while unless it is inside the minimum.
      const cooling = state.clock - (state.resolvedAt.get(key) ?? -1e9) < 120
      if (!isActive && lateral >= site.minimumSeparation && (!closing || cooling)) continue
      const level = lateral < site.minimumSeparation ? 'red' : 'amber'
      ;[a, b].forEach((flight) => {
        if (flight.alert !== 'red') flight.alert = level
      })
      active.add(key)
      let conflict = state.conflicts.find((candidate) => candidate.key === key && candidate.state === 'active')
      if (!conflict) {
        conflict = { key, id: `C${state.nextConflict++}`, ids: [a.id, b.id], callsigns: [a.callsign, b.callsign], startedAt: state.clock, minimum: lateral, worst: level, state: 'active', action: '' }
        state.conflicts.unshift(conflict)
        resolveConflict(state, conflict, a, b)
      }
      conflict.minimum = Math.min(conflict.minimum, lateral)
      if (level === 'red') conflict.worst = 'red'
    }
  }
  state.conflicts.forEach((conflict) => {
    if (conflict.state === 'active' && !active.has(conflict.key)) {
      conflict.state = 'resolved'
      conflict.resolvedAt = state.clock
      state.resolvedAt.set(conflict.key, state.clock)
    }
  })
  state.pairDistances = nextDistances
  // Keep every active conflict and the most recent resolved ones.
  let resolvedKept = 0
  state.conflicts = state.conflicts.filter((conflict) => conflict.state === 'active' || resolvedKept++ < 20)
  state.minimumSeparation = minimum
}

// The simulated controller moves one aircraft 2,000 ft away: the one not on a fixed approach.
function resolveConflict(state, conflict, a, b) {
  const candidates = [a, b].filter((flight) => flight.mode === 'steer' && !flight.hold)
  if (!candidates.length) {
    conflict.action = 'Sequenced on final'
    return
  }
  const mover = candidates.find((flight) => flight.kind === 'overflight') ?? candidates[0]
  const other = mover === a ? b : a
  const upward = mover.altitude >= other.altitude
  const floor = state.site.id === 'CTR' ? 12000 : 3000
  const level = Math.max(floor, Math.round((other.altitude + (upward ? 2000 : -2000)) / 1000) * 1000)
  mover.levelOverride = level
  mover.clearedAltitude = level
  conflict.action = `${mover.callsign} ${upward ? 'climb' : 'descend'} ${formatLevel(level)}`
  log(state, mover, `${upward ? 'climb' : 'descend'} ${formatLevel(level)} immediately, traffic ${other.callsign}`, 'conflict')
}

// ---------- controller input from the dashboard ----------

export function issueInstruction(state, flight, kind) {
  if (flight.mode !== 'steer' || flight.hold) return
  if (kind === 'climb' || kind === 'descend') {
    const floor = state.site.id === 'CTR' ? 12000 : 3000
    const level = Math.max(floor, (flight.levelOverride ?? flight.clearedAltitude) + (kind === 'climb' ? 1000 : -1000))
    flight.levelOverride = level
    flight.clearedAltitude = level
    log(state, flight, `${kind} and maintain ${formatLevel(level)}`)
  }
  if (kind === 'slow') {
    flight.speedOverride = Math.max(160, Math.round((flight.speedOverride ?? flight.targetSpeed) - 20))
    log(state, flight, `reduce speed ${flight.speedOverride} knots`)
  }
}

export const canInstruct = (flight) => flight.mode === 'steer' && !flight.hold

// ---------- world ----------

function createSite(site, seed) {
  const state = {
    site,
    random: seededRandom(seed),
    clock: START_CLOCK,
    flights: [],
    log: [],
    conflicts: [],
    pairDistances: new Map(),
    resolvedAt: new Map(),
    landings: [],
    departures: [],
    usedNumbers: new Set(),
    nextId: 1,
    nextConflict: 101,
    arrivalCycle: 0,
    departureCycle: 0,
    overflightCycle: 0,
    nextFinalSlot: 0,
    lastDeparture: -1e9,
    runwayUse: { R1: null, R2: null },
    timers: { arrival: 0, departure: 3, overflight: 0, arrivalEnroute: 4 },
    minimumSeparation: null,
    reroutes: 0,
    weather: site.weather ? { ...site.weather, flash: 0, flashTimer: 1, flashSide: 0 } : null,
  }
  if (site.id === 'TWR') {
    // Four aircraft already on stands, part way through their turnarounds.
    ;[0, 2, 3, 5].forEach((standIndex, order) => {
      const flight = newFlight(state, 'arrival')
      flight.position = { x: STAND_X[standIndex], y: 0, z: STAND_Z }
      flight.phase = 'parked'
      flight.mode = 'track'
      flight.track = [flight.position]
      flight.standIndex = standIndex
      flight.gearDown = true
      flight.steps = { handoff: 0, descend: 0, hold: 'skipped', approach: 0, land: 0, vacate: 0 }
      flight.parkedUntil = state.clock + (6 + order * 22) * TIME_SCALE
    })
  }
  for (let time = 0; time < PREWARM_SECONDS; time += 0.1) stepSite(state, 0.1, false)
  return state
}

export function createWorld() {
  const sites = {}
  SITES.forEach((site, index) => {
    sites[site.id] = createSite(site, 7919 * (index + 3))
  })
  return { sites }
}

function spawn(state, dt) {
  const site = state.site
  const timers = state.timers
  const live = state.flights.length
  timers.arrival -= dt
  timers.departure -= dt
  timers.overflight -= dt
  timers.arrivalEnroute -= dt
  if (site.id === 'TWR') {
    if (timers.arrival <= 0 && live < site.maxFlights) {
      spawnTowerArrival(state)
      timers.arrival = site.arrivalEvery * (0.85 + state.random() * 0.3)
    }
    releaseParked(state)
  }
  if (site.id === 'APP') {
    // Flow control: with three in the hold, new arrivals are held upstream.
    const holding = state.flights.filter((flight) => flight.hold).length
    if (timers.arrival <= 0 && live < site.maxFlights && holding < 3) {
      spawnApproachArrival(state)
      timers.arrival = site.arrivalEvery * (0.8 + state.random() * 0.4)
    }
    const departureWaiting = state.flights.some((flight) => flight.phase === 'holdShort')
    if (timers.departure <= 0 && live < site.maxFlights && !departureWaiting) {
      spawnApproachDeparture(state)
      timers.departure = site.departureEvery * (0.85 + state.random() * 0.3)
    }
  }
  if (site.id === 'CTR') {
    if (timers.overflight <= 0 && live < site.maxFlights) {
      spawnOverflight(state)
      timers.overflight = site.overflightEvery * (0.8 + state.random() * 0.4)
    }
    if (timers.arrivalEnroute <= 0 && live < site.maxFlights) {
      spawnEnrouteArrival(state)
      timers.arrivalEnroute = site.arrivalEvery * (0.85 + state.random() * 0.3)
    }
  }
  if (site.hasAirport) releaseTakeoff(state)
}

function stepSite(state, dt, moveWeather = true) {
  state.clock += dt * TIME_SCALE
  spawn(state, dt)
  for (const flight of state.flights) {
    if (flight.removed || flight.phase === 'parked') continue
    if (flight.mode === 'track') moveAlongTrack(state, flight, dt)
    else {
      avoidWeather(state, flight)
      steer(state, flight, dt)
    }
    flight.historyTimer -= dt
    if (flight.historyTimer <= 0 && !flight.removed) {
      flight.historyTimer = HISTORY_EVERY
      flight.history.push({ ...flight.position })
      if (flight.history.length > HISTORY_LENGTH) flight.history.shift()
    }
  }
  state.flights = state.flights.filter((flight) => !flight.removed)
  if (moveWeather) stepWeather(state, dt)
  stepConflicts(state)
}

export function stepWorld(world, dt) {
  Object.values(world.sites).forEach((state) => stepSite(state, dt))
}

// ---------- read helpers for the dashboard ----------

export function arrivalsPerHour(state) {
  const window = 3600
  const recent = state.landings.filter((time) => state.clock - time < window).length
  const elapsed = Math.min(window, state.clock - START_CLOCK)
  return elapsed > 0 ? Math.round((recent / elapsed) * window) : 0
}

export function averageDelay(state) {
  const arrivals = state.flights.filter((flight) => flight.kind === 'arrival' && flight.phase !== 'parked')
  if (!arrivals.length) return 0
  return arrivals.reduce((sum, flight) => sum + flight.delay, 0) / arrivals.length
}

// Seconds of simulated flying left along the route (or track) to its end.
export function remainingSeconds(state, flight) {
  const points = flight.mode === 'track' ? flight.track.slice(flight.trackIndex + 1) : flight.route.slice(flight.legIndex)
  let total = 0
  let from = flight.position
  for (const point of points) {
    total += distance(from, point)
    from = point
  }
  const knots = Math.max(flight.speed, 60)
  return (total / state.site.nm / knots) * 3600
}


export function routeProgress(state, flight) {
  const total = (state.clock - flight.bornAt) + remainingSeconds(state, flight)
  return total > 0 ? Math.min(1, (state.clock - flight.bornAt) / total) : 0
}

export function nextWaypointName(flight) {
  if (flight.hold) return 'Holding'
  if (flight.mode === 'track') {
    if (flight.phase === 'approach') return 'Runway 27R'
    if (flight.phase === 'takeoff' || flight.phase === 'holdShort') return 'Runway 27L'
    if (flight.phase === 'taxiIn' || flight.phase === 'landing') return flight.standIndex !== null ? `Stand ${flight.standIndex + 1}` : 'Taxiway A'
    if (flight.phase === 'parked') return `Stand ${flight.standIndex + 1}`
    return 'Holding point 27L'
  }
  const named = flight.route.slice(flight.legIndex).find((point) => point.name)
  return named?.name ?? 'Sector exit'
}
