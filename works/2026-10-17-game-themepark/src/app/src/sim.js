// The live park: a seeded simulation of rides, vehicles, guests, stands, staff and tickets.
// The 3D view reads positions from it every frame; the dashboard reads it a few times a second.
import { LAYOUTS, RIDES, SITES, STAFF_NAMES, switchback } from './data.js'
import { COASTER_TRACK, FLUME_TRACK, makePath, samplePath, sampleTrack, trackHeight } from './paths.js'

const GRAVITY = 9.81
export const LIFT_SPEED = 2.8
const COASTER_CREST = 94
const COASTER_STOP = 38
const COASTER_DWELL = 9
export const MONORAIL_HEIGHT = 6.5
export const PARK_MINUTES_PER_SECOND = 0.2
const START_CLOCK = 12 * 60 + 41

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const approach = (current, target, rate, dt) => (current < target ? Math.min(target, current + rate * dt) : Math.max(target, current - rate * dt))

// ---------- coaster ----------

function coasterTargetSpeed(along) {
  if (along >= COASTER_STOP && along < 46) return 2.2
  if (along >= 46 && along <= COASTER_CREST) return LIFT_SPEED
  if (along > COASTER_CREST || along < 5) {
    const travelled = along > COASTER_CREST ? along - COASTER_CREST : along + COASTER_TRACK.length - COASTER_CREST
    const height = trackHeight(COASTER_TRACK, along)
    const free = Math.sqrt(LIFT_SPEED * LIFT_SPEED + 2 * GRAVITY * Math.max(0, 32.3 - height))
    return Math.max(5, free * (1 - 0.0012 * travelled))
  }
  if (along >= 5 && along < 15) return 2.6
  return 2.0
}

export function coasterPhase(train) {
  const along = train.along
  if (train.dwell > 0) return 'loading'
  if (along >= COASTER_STOP && along < 46) return 'dispatch'
  if (along >= 46 && along <= COASTER_CREST) return 'lift'
  if (along > COASTER_CREST && along < COASTER_CREST + 30) return 'drop'
  if (along >= 5 && along < 15) return 'brakes'
  if (along >= 15 && along < COASTER_STOP) return 'returning'
  return 'circuit'
}

function stepCoasterTrain(train, dt, random) {
  if (train.dwell > 0) {
    train.dwell -= dt
    train.speed = 0
    if (train.dwell <= 0) {
      train.lapsToday++
      train.riders = 16 + Math.floor(random() * 5)
    }
    return
  }
  const along = train.along
  const target = coasterTargetSpeed(along)
  const free = along > COASTER_CREST || along < 5
  if (free) train.speed = target
  else if (along >= 15 && along < COASTER_STOP) train.speed = Math.min(approach(train.speed, target, 6, dt), 0.4 + Math.sqrt(2 * 1.2 * Math.max(0, COASTER_STOP - along)))
  else train.speed = approach(train.speed, target, along < 15 ? 7 : 2.5, dt)
  const next = along + train.speed * dt
  if (along < COASTER_STOP && next >= COASTER_STOP) {
    train.along = COASTER_STOP
    train.dwell = COASTER_DWELL
    train.riders = 0
    return
  }
  train.along = next % COASTER_TRACK.length
  train.maxHeight = Math.max(train.maxHeight, trackHeight(COASTER_TRACK, train.along))
}

// ---------- log flume ----------

function flumeTargetSpeed(along) {
  const [stationStart, stationEnd] = FLUME_TRACK.station
  if (along >= stationStart && along < stationEnd) return 1.0
  if (along >= FLUME_TRACK.lift[0] && along < FLUME_TRACK.lift[1]) return 2.2
  if (along >= FLUME_TRACK.drop[0] && along < FLUME_TRACK.drop[1] + 1) {
    const height = trackHeight(FLUME_TRACK, along)
    return Math.sqrt(2.8 * 2.8 + 2 * GRAVITY * Math.max(0, 12.8 - height))
  }
  if (along >= FLUME_TRACK.station[1] && along < FLUME_TRACK.lift[0]) return 1.6
  if (along > FLUME_TRACK.length - 12 || along < stationStart) return 1.2
  return 2.8
}

function stepBoat(boat, dt, state) {
  const target = flumeTargetSpeed(boat.along)
  const inDrop = boat.along >= FLUME_TRACK.drop[0] && boat.along < FLUME_TRACK.drop[1] + 1
  boat.speed = inDrop ? target : approach(boat.speed, target, boat.speed > target + 2 ? 5 : 1.5, dt)
  const before = boat.along
  boat.along = (boat.along + boat.speed * dt) % FLUME_TRACK.length
  const splashAt = FLUME_TRACK.drop[1] - 1
  if (before < splashAt && boat.along >= splashAt) {
    state.splash = { age: 0, boatId: boat.id }
    boat.splashes++
  }
  if (before < FLUME_TRACK.station[0] && boat.along >= FLUME_TRACK.station[0]) boat.riders = 0
  if (before < FLUME_TRACK.station[1] && boat.along >= FLUME_TRACK.station[1]) boat.riders = 3 + (boat.splashes % 3)
}

export function boatPhase(boat) {
  const along = boat.along
  if (along >= FLUME_TRACK.station[0] && along < FLUME_TRACK.station[1]) return 'loading'
  if (along >= FLUME_TRACK.lift[0] && along < FLUME_TRACK.lift[1]) return 'lift'
  if (along >= FLUME_TRACK.drop[0] && along < FLUME_TRACK.drop[1] + 2) return 'drop'
  return 'floating'
}

// ---------- loop movers: monorail, trams, carts, floats ----------

function stepLoopMover(mover, dt) {
  if (mover.dwell > 0) {
    mover.dwell -= dt
    mover.speed = 0
    if (mover.dwell <= 0) mover.sinceStop = 0
    return
  }
  const length = mover.path.length
  let toStop = Infinity
  let nextStop = null
  for (const stop of mover.stops) {
    let ahead = (((stop.at - mover.s) % length) + length) % length
    if (ahead < 0.5 && (mover.sinceStop ?? 99) < 1) ahead += length
    if (ahead < toStop) {
      toStop = ahead
      nextStop = stop
    }
  }
  const brakeLimit = Math.sqrt(2 * mover.decel * Math.max(0, toStop)) + 0.2
  mover.speed = Math.min(approach(mover.speed, mover.cruise, mover.accel, dt), brakeLimit)
  const step = mover.speed * dt
  if (nextStop && step >= toStop) {
    mover.s = nextStop.at
    mover.dwell = nextStop.dwell
    mover.speed = 0
    return
  }
  mover.s = (mover.s + step) % length
  mover.sinceStop = (mover.sinceStop ?? 99) + step
}

function placeOnPath(mover, offset, out, height = 0) {
  samplePath(mover.path, mover.s - offset, out)
  out.y = height
  return out
}

function nearestAlong(path, x, z) {
  let best = 0
  let bestDistance = Infinity
  const point = {}
  for (let s = 0; s < path.length; s += 0.5) {
    samplePath(path, s, point)
    const distance = Math.hypot(point.x - x, point.z - z)
    if (distance < bestDistance) {
      bestDistance = distance
      best = s
    }
  }
  return best
}

// ---------- guests ----------

const GUEST_VARIANTS = ['guest_a', 'guest_b', 'guest_c', 'guest_d', 'guest_e', 'guest_f', 'guest_child_a', 'guest_child_b']

function makeGuest(random) {
  const roll = random()
  const variant = roll < 0.16 ? GUEST_VARIANTS[6 + Math.floor(random() * 2)] : GUEST_VARIANTS[Math.floor(random() * 6)]
  const child = variant.startsWith('guest_child')
  return { variant, child, x: 0, z: 0, heading: 0, phase: random(), moving: true, clip: 'walk', speed: child ? 0.95 + random() * 0.15 : 1.25 + random() * 0.25 }
}

function buildCrowd(layout, queues, random, density) {
  const guests = []
  const walkways = layout.walkways.map((walkway) => ({ ...walkway, path: makePath(walkway.points, walkway.closed) }))
  const totalLength = walkways.reduce((sum, walkway) => sum + walkway.path.length * walkway.width, 0)
  for (const walkway of walkways) {
    const count = Math.round(((walkway.path.length * walkway.width) / totalLength) * density)
    for (let index = 0; index < count; index++) {
      const guest = makeGuest(random)
      guest.mode = 'walk'
      guest.walkway = walkway
      guest.s = random() * walkway.path.length
      guest.direction = random() < 0.5 ? 1 : -1
      guest.offset = (random() - 0.5) * (walkway.width - 1.6)
      guests.push(guest)
    }
  }
  for (const queue of queues) {
    if (!queue.guestPath) continue
    const spacing = 0.78
    const count = Math.floor((queue.guestPath.length / spacing) * queue.fill)
    for (let index = 0; index < count; index++) {
      const guest = makeGuest(random)
      guest.mode = 'queue'
      guest.queue = queue
      guest.s = queue.guestPath.length - index * spacing - 0.4
      guest.offset = (random() - 0.5) * 0.25
      guests.push(guest)
    }
  }
  return guests
}

function stepGuests(state, dt) {
  const point = {}
  for (const guest of state.guests) {
    if (guest.mode === 'walk') {
      const walkway = guest.walkway
      const path = walkway.path
      guest.s += guest.direction * guest.speed * dt
      if (!path.closed && (guest.s < 0 || guest.s > path.length)) {
        guest.direction *= -1
        guest.s = Math.max(0, Math.min(path.length, guest.s))
      }
      samplePath(path, guest.s, point)
      const normalX = Math.cos(point.heading)
      const normalZ = -Math.sin(point.heading)
      guest.x = point.x + normalX * guest.offset
      guest.z = point.z + normalZ * guest.offset
      guest.heading = guest.direction > 0 ? point.heading : point.heading + Math.PI
      guest.phase = (guest.phase + dt * (guest.speed / (guest.child ? 1.0 : 1.4))) % 1
      guest.moving = true
    } else if (guest.mode === 'queue') {
      const queue = guest.queue
      const moving = queue.pulse > 0 && queue.open
      if (moving) {
        guest.s += 0.78 * (dt / 0.9)
        if (guest.s > queue.guestPath.length) guest.s -= Math.floor((queue.guestPath.length / 0.78) * queue.fill) * 0.78
      }
      samplePath(queue.guestPath, Math.max(0, guest.s), point)
      guest.x = point.x + Math.cos(point.heading) * guest.offset
      guest.z = point.z - Math.sin(point.heading) * guest.offset
      guest.heading = point.heading
      guest.moving = moving
      guest.phase = (guest.phase + dt * (moving ? 0.9 : 0.5)) % 1
    } else {
      guest.phase = (guest.phase + dt * 0.5) % 1
    }
  }
  for (const queue of state.queues) {
    queue.timer -= dt
    if (queue.timer <= 0) {
      queue.timer = queue.interval
      queue.pulse = 0.9
    }
    queue.pulse = Math.max(0, queue.pulse - dt)
  }
}

// ---------- building a land ----------

function rideState(ride) {
  return { ...ride, state: ride.state ?? 'open', ridersToday: 0, rph: 0, wait: ride.wait, satisfaction: 88 + ride.capacity / 400, nextCheck: 15 * 60 + ride.capacity / 20 }
}

function buildSite(site, index) {
  const random = seeded(1009 + index * 7919)
  const layout = LAYOUTS[site.id]
  const rides = RIDES[site.id].map(rideState)
  const state = { site, layout, rides, units: [], stands: [], tickets: [], events: [], guests: [], queues: [], time: 0, splash: null, ferrisAngle: random() * 6, carouselAngle: 0, staffOnShift: 0 }

  state.queues = layout.queues.map((spec, queueIndex) => {
    const geometry = switchback(spec)
    const ride = rides.find((candidate) => candidate.id === spec.rideId)
    return {
      id: `Q-${site.id}${queueIndex + 1}`,
      rideId: spec.rideId,
      ...geometry,
      guestPath: makePath(geometry.path),
      fill: ride.state === 'down' ? 0.08 : Math.min(0.95, 0.35 + ride.wait / 70),
      open: ride.state === 'open',
      interval: 3.2 + queueIndex * 0.7,
      timer: queueIndex * 0.9,
      pulse: 0,
    }
  })
  state.stands = layout.stands.map((stand) => ({ ...stand, x: stand.position[0], z: stand.position[2], salesToday: 2000 + random() * 9000, stock: 0.35 + random() * 0.6, perHour: 300 + random() * 600, served: Math.floor(200 + random() * 900) }))

  if (layout.monorail) {
    const path = makePath(layout.monorail.points, true)
    const station = layout.monorail.station.position
    const stopAt = nearestAlong(path, station[0], station[2])
    state.units.push({ id: `MR-${site.id}`, name: `Skyloop train ${index + 1}`, kind: 'monorail', path, s: (stopAt + path.length * 0.55) % path.length, speed: 0, cruise: 11, accel: 1.1, decel: 1.0, stops: [{ at: stopAt, dwell: 7 }], dwell: 0, riders: 64, capacity: 120, position: { x: 0, y: MONORAIL_HEIGHT, z: 0 }, heading: 0, doors: 0, loops: 14 + index * 3 })
  }
  if (site.id === 'AD') {
    const cycleProbe = { along: COASTER_STOP, speed: 0, dwell: COASTER_DWELL, lapsToday: 0, riders: 0, maxHeight: 0 }
    let cycle = 0
    let departed = false
    for (let step = 0; step < 4000; step++) {
      stepCoasterTrain(cycleProbe, 1 / 30, random)
      cycle += 1 / 30
      if (cycleProbe.dwell <= 0) departed = true
      else if (departed) break
    }
    state.coasterCycle = cycle
    const trains = ['a', 'b'].map((letter, trainIndex) => ({ id: `RR-${trainIndex + 1}`, name: `Riptide train ${trainIndex + 1}`, node: `coaster_train_${letter}`, kind: 'train', rideId: 'riptide', along: COASTER_STOP, speed: 0, dwell: 2 + trainIndex * 0.01, riders: 20, lapsToday: 88 + trainIndex * 3, maxHeight: 0, position: { x: 0, y: 0, z: 0 } }))
    for (let step = 0; step < (cycle / 2) * 30; step++) stepCoasterTrain(trains[1], 1 / 30, random)
    state.units.push(...trains)
    const boats = ['a', 'b', 'c'].map((letter, boatIndex) => ({ id: `KF-${boatIndex + 1}`, name: `Log boat ${boatIndex + 1}`, node: `flume_log_${letter}`, kind: 'boat', rideId: 'kalua', along: FLUME_TRACK.station[0] + boatIndex * 0.01, speed: 1, riders: 4, splashes: 140 + boatIndex * 5, position: { x: 0, y: 0, z: 0 } }))
    boats.forEach((boat, boatIndex) => {
      boat.along = (FLUME_TRACK.station[0] + boatIndex * 58) % FLUME_TRACK.length
    })
    state.units.push(...boats)
  }
  if (site.id === 'FT') {
    const path = makePath(layout.parade, true)
    ;['float_cake', 'float_carriage', 'float_rocket'].forEach((node, floatIndex) => {
      state.units.push({ id: `PF-${floatIndex + 1}`, name: ['Honey Cake float', 'Moonlit Carriage float', 'Starhopper float'][floatIndex], node, kind: 'float', path, s: path.length * 0.62 - floatIndex * 22, speed: 1.3, cruise: 1.3, accel: 0.5, decel: 0.5, stops: [], dwell: 0, position: { x: 0, y: 0, z: 0 }, heading: 0 })
    })
  }
  if (site.id === 'EN') {
    const path = makePath(layout.tramLoop, true)
    const stopAt = nearestAlong(path, 0, 25)
    ;[0, 0.5].forEach((share, tramIndex) => {
      state.units.push({ id: `TR-${tramIndex + 1}`, name: `Lot tram ${tramIndex + 1}`, kind: 'tram', path, s: (stopAt + path.length * (share + 0.12)) % path.length, speed: 0, cruise: 5.5, accel: 0.8, decel: 0.9, stops: [{ at: stopAt, dwell: 8 }], dwell: 0, riders: 30 + tramIndex * 12, capacity: 72, position: { x: 0, y: 0, z: 0 }, heading: 0 })
    })
  }
  // Maintenance carts drive the main walkway.
  const ring = makePath(layout.walkways[0].points, layout.walkways[0].closed)
  const cartCount = site.id === 'EN' ? 1 : 2
  for (let cartIndex = 0; cartIndex < cartCount; cartIndex++) {
    state.units.push({ id: `MC-${site.id}${cartIndex + 1}`, name: `Service cart ${index * 2 + cartIndex + 11}`, node: cartIndex % 2 ? 'maint_cart_box' : 'maint_cart_bed', kind: 'cart', path: ring, s: ring.length * (0.2 + cartIndex * 0.5), speed: 0, cruise: 3.6, accel: 1, decel: 1.2, stops: [{ at: ring.length * (0.45 + cartIndex * 0.5) % ring.length, dwell: 10 }], dwell: 0, position: { x: 0, y: 0, z: 0 }, heading: 0, ticketId: null })
  }

  // Staff: an operator at each queue exit, a technician walking the main path.
  state.queues.forEach((queue, queueIndex) => {
    const exit = queue.path[queue.path.length - 1]
    state.units.push({ id: `OP-${site.id}${queueIndex + 1}`, name: STAFF_NAMES[(index * 3 + queueIndex) % STAFF_NAMES.length], kind: 'staff', role: 'Ride operator', node: 'staff_operator', rideId: queue.rideId, position: { x: exit[0] - 1.2, y: 0, z: exit[1] + 1.4 }, heading: Math.PI / 2, clip: 'operate', shift: 0.3 + queueIndex * 0.12 })
  })
  state.units.push({ id: `TC-${site.id}1`, name: STAFF_NAMES[(index * 3 + 7) % STAFF_NAMES.length], kind: 'staff', role: 'Technician', node: 'staff_tech', path: ring, s: ring.length * 0.7, speed: 1.3, position: { x: 0, y: 0, z: 0 }, heading: 0, clip: 'walk', shift: 0.55 })

  state.guests = buildCrowd(layout, state.queues, random, { AD: 480, SP: 330, FT: 320, EN: 380 }[site.id])
  if (site.id === 'FT') {
    // Families lining the parade route watch and wave.
    const route = makePath(layout.parade, true)
    const point = {}
    for (let s = 0; s < route.length; s += 2.3) {
      if (random() < 0.45) continue
      samplePath(route, s, point)
      const guest = makeGuest(random)
      const side = random() < 0.5 ? 1 : -1
      guest.mode = 'watch'
      guest.clip = random() < 0.5 ? 'wave' : 'idle'
      guest.x = point.x + Math.cos(point.heading) * 5.6 * side
      guest.z = point.z - Math.sin(point.heading) * 5.6 * side
      guest.heading = point.heading - (side * Math.PI) / 2
      guest.moving = false
      state.guests.push(guest)
    }
  }
  if (site.id === 'SP') {
    state.tickets.push({ id: 'T-2207', rideId: 'comet', title: 'Block sensor fault on lift 2', priority: 'high', status: 'in progress', progress: 0.55, opened: 12 * 60 + 18 })
  }
  if (site.id === 'FT') state.tickets.push({ id: 'T-2211', rideId: 'lantern', title: 'Test cycles after vehicle swap', priority: 'medium', status: 'in progress', progress: 0.7, opened: 12 * 60 + 5 })
  if (site.id === 'AD') state.tickets.push({ id: 'T-2209', rideId: 'temple', title: 'Projector 6 flicker in scene 3', priority: 'low', status: 'scheduled', progress: 0.1, opened: 11 * 60 + 52 })
  if (site.id === 'EN') state.tickets.push({ id: 'T-2203', rideId: 'gates', title: 'Turnstile 5 card reader slow', priority: 'low', status: 'assigned', progress: 0.3, opened: 11 * 60 + 40 })
  state.tickets.push({ id: `T-21${90 + index}`, rideId: rides[0].id, title: 'Daily restraint check', priority: 'routine', status: 'done', progress: 1, opened: 7 * 60 + 45 })
  state.focusRideId = rides[0].id
  return state
}

export function createWorld() {
  const world = { clock: START_CLOCK, sites: {}, guestsByLand: {}, satisfaction: 91.4 }
  SITES.forEach((site, index) => {
    world.sites[site.id] = buildSite(site, index)
    world.guestsByLand[site.id] = { AD: 6120, SP: 4870, FT: 5340, EN: 1980 }[site.id]
  })
  world.random = seeded(4242)
  return world
}

// ---------- stepping ----------

function stepUnits(state, dt, world) {
  const point = {}
  const track = { position: [0, 0, 0], tangent: [0, 0, 1], up: [0, 1, 0] }
  const coasterOffset = state.layout.coaster?.offset
  const flumeOffset = state.layout.flume?.offset
  for (const unit of state.units) {
    switch (unit.kind) {
      case 'train':
        stepCoasterTrain(unit, dt, world.random)
        sampleTrack(COASTER_TRACK, unit.along, track)
        unit.position.x = track.position[0] + coasterOffset[0]
        unit.position.y = track.position[1]
        unit.position.z = track.position[2] + coasterOffset[2]
        unit.heading = Math.atan2(track.tangent[0], track.tangent[2])
        break
      case 'boat':
        stepBoat(unit, dt, state)
        sampleTrack(FLUME_TRACK, unit.along, track)
        unit.position.x = track.position[0] + flumeOffset[0]
        unit.position.y = track.position[1]
        unit.position.z = track.position[2] + flumeOffset[2]
        unit.heading = Math.atan2(track.tangent[0], track.tangent[2])
        break
      case 'monorail':
      case 'tram':
      case 'cart':
      case 'float': {
        stepLoopMover(unit, dt)
        const height = unit.kind === 'monorail' ? MONORAIL_HEIGHT : 0
        placeOnPath(unit, unit.kind === 'monorail' ? 13 : unit.kind === 'tram' ? 6 : 0, point, height)
        unit.position.x = point.x
        unit.position.y = height
        unit.position.z = point.z
        unit.heading = point.heading
        if (unit.kind === 'monorail') unit.doors = approach(unit.doors, unit.dwell > 1 ? 1 : 0, 1.5, dt)
        break
      }
      case 'staff':
        if (unit.path) {
          unit.s = (unit.s + unit.speed * dt) % unit.path.length
          samplePath(unit.path, unit.s, point)
          unit.position.x = point.x + Math.cos(point.heading) * 3
          unit.position.z = point.z - Math.sin(point.heading) * 3
          unit.heading = point.heading
        }
        break
      default:
        break
    }
  }
}

// Ride numbers drift, rides go down and come back, stands sell and restock.
function stepNumbers(state, dt, world) {
  const random = world.random
  const minutes = dt * PARK_MINUTES_PER_SECOND
  for (const ride of state.rides) {
    if (ride.state === 'open') {
      ride.rph = approach(ride.rph || ride.capacity * 0.9, ride.capacity * (0.86 + 0.1 * Math.sin(state.time * 0.13 + ride.capacity)), 40, dt)
      ride.ridersToday += (ride.rph / 60) * minutes
      ride.wait = Math.max(5, ride.wait + (random() - 0.48) * dt * 0.5)
    } else {
      ride.rph = approach(ride.rph, 0, 200, dt)
      ride.wait = ride.state === 'down' ? 0 : ride.wait
    }
  }
  for (const stand of state.stands) {
    stand.salesToday += (stand.perHour / 60) * minutes * (0.8 + random() * 0.4)
    stand.stock -= minutes * 0.004
    if (stand.stock < 0.18) stand.stock = 0.92
  }
  for (const ticket of state.tickets) {
    if (ticket.status === 'in progress') ticket.progress = Math.min(1, ticket.progress + dt * 0.006)
  }
  if (state.splash) {
    state.splash.age += dt
    if (state.splash.age > 1.6) state.splash = null
  }
  state.ferrisAngle += dt * ((Math.PI * 2) / 120)
  state.carouselAngle += dt * 0.5
}

// Scripted operational events so statuses change while you watch.
const SCRIPT = [
  { at: 24, siteId: 'FT', rideId: 'lantern', state: 'open', text: 'Lantern Tale reopened after test cycles', tone: 'ok', ticket: 'T-2211' },
  { at: 46, siteId: 'SP', rideId: 'comet', state: 'testing', text: 'Comet Run sensor replaced, running test cycles', tone: 'warn' },
  { at: 70, siteId: 'AD', rideId: 'temple', state: 'down', text: 'Temple of Echoes paused: guest assist in scene 4', tone: 'bad' },
  { at: 95, siteId: 'AD', rideId: 'temple', state: 'open', text: 'Temple of Echoes back in service', tone: 'ok' },
  { at: 120, siteId: 'SP', rideId: 'comet', state: 'open', text: 'Comet Run reopened', tone: 'ok', ticket: 'T-2207' },
]

function formatClock(minutes) {
  const hours = Math.floor(minutes / 60) % 24
  const rest = Math.floor(minutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function stepScript(world) {
  const elapsed = (world.clock - START_CLOCK) / PARK_MINUTES_PER_SECOND
  for (const item of SCRIPT) {
    if (item.done || elapsed < item.at) continue
    item.done = true
    const state = world.sites[item.siteId]
    const ride = state.rides.find((candidate) => candidate.id === item.rideId)
    ride.state = item.state
    const queue = state.queues.find((candidate) => candidate.rideId === ride.id)
    if (queue) queue.open = item.state === 'open'
    if (item.state === 'open' && ride.wait < 10) ride.wait = 18
    if (item.ticket) {
      const ticket = state.tickets.find((candidate) => candidate.id === item.ticket)
      if (ticket) {
        ticket.status = 'done'
        ticket.progress = 1
      }
    }
    state.events.unshift({ time: formatClock(world.clock), text: item.text, tone: item.tone })
  }
}

// The current land steps in full; the others advance their numbers so switching is seamless.
export function stepWorld(world, dt, activeSiteId) {
  world.clock += dt * PARK_MINUTES_PER_SECOND
  for (const state of Object.values(world.sites)) {
    state.time += dt
    stepNumbers(state, dt, world)
    if (state.site.id === activeSiteId) {
      stepUnits(state, dt, world)
      stepGuests(state, dt)
    }
  }
  for (const id of Object.keys(world.guestsByLand)) world.guestsByLand[id] += dt * (id === 'EN' ? 0.6 : 0.35) * (world.random() > 0.3 ? 1 : -1)
  world.satisfaction = 91.4 + Math.sin(world.clock * 0.05) * 0.6
  stepScript(world)
}

export { formatClock, START_CLOCK }
