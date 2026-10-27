// Seeded simulation of the four sites. Plain objects only: the 3D view and the dashboard both read this.
// LC-1 runs one launch cycle every PERIOD seconds; tau is time relative to liftoff (negative = countdown).
import { SITES } from './sites.js'
import { GROUND, createRandom } from './terrain.js'

export const PERIOD = 180
export const LIFTOFF_AT = 8.5
export const CATCH_TAU = 21
export const MISSION_SCALE = 18
export const AXIS = { x: 0, z: 30 }
const GRIP_RADIUS = 22.5
const HINGE_Z = 7.5

export const PHASES = [
  { id: 'rollout', label: 'Rollout', start: -140, end: -110 },
  { id: 'stack', label: 'Stack', start: -110, end: -85 },
  { id: 'load', label: 'Propellant load', start: -85, end: -20 },
  { id: 'terminal', label: 'Terminal count', start: -20, end: 0 },
  { id: 'ascent', label: 'Liftoff', start: 0, end: 8 },
  { id: 'boostback', label: 'Boostback', start: 8, end: 17 },
  { id: 'catch', label: 'Tower catch', start: 17, end: 21 },
  { id: 'safing', label: 'Safing', start: 21, end: 40 },
]
export const HOLD = { start: -50, end: -44 }

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const ease = (value) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t
const span = (tau, start, end) => ease((tau - start) / (end - start))

// ---------- paths ----------
function createPath(points, closed = false) {
  const list = closed ? [...points, points[0]] : points
  const lengths = [0]
  for (let index = 1; index < list.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(list[index][0] - list[index - 1][0], list[index][1] - list[index - 1][1]))
  }
  return { points: list, lengths, total: lengths[lengths.length - 1], closed }
}

function samplePath(path, distance) {
  const clamped = path.closed ? ((distance % path.total) + path.total) % path.total : Math.min(path.total, Math.max(0, distance))
  let index = 1
  while (index < path.lengths.length - 1 && path.lengths[index] < clamped) index++
  const [ax, az] = path.points[index - 1]
  const [bx, bz] = path.points[index]
  const segment = path.lengths[index] - path.lengths[index - 1] || 1
  const t = (clamped - path.lengths[index - 1]) / segment
  return { x: lerp(ax, bx, t), z: lerp(az, bz, t), heading: Math.atan2(bx - ax, bz - az) }
}

function ellipsePoints(cx, cz, rx, rz, count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return [cx + Math.cos(angle) * rx, cz + Math.sin(angle) * rz]
  })
}

// ---------- particles (white dots: exhaust, steam, wakes, vents) ----------
export const PARTICLE_COUNT = 90000
function createParticles() {
  return {
    position: new Float32Array(PARTICLE_COUNT * 3),
    velocity: new Float32Array(PARTICLE_COUNT * 3),
    age: new Float32Array(PARTICLE_COUNT).fill(1),
    life: new Float32Array(PARTICLE_COUNT).fill(1),
    size0: new Float32Array(PARTICLE_COUNT),
    size1: new Float32Array(PARTICLE_COUNT),
    drag: new Float32Array(PARTICLE_COUNT),
    lift: new Float32Array(PARTICLE_COUNT),
    warm: new Uint8Array(PARTICLE_COUNT),
    cursor: 0,
  }
}

function emit(world, x, y, z, vx, vy, vz, life, size0, size1, drag = 0.6, lift = 0, warm = 0) {
  const particles = world.particles
  const index = particles.cursor
  particles.cursor = (index + 1) % PARTICLE_COUNT
  particles.position.set([x, y, z], index * 3)
  particles.velocity.set([vx, vy, vz], index * 3)
  particles.age[index] = 0
  particles.life[index] = life
  particles.size0[index] = size0
  particles.size1[index] = size1
  particles.drag[index] = drag
  particles.lift[index] = lift
  particles.warm[index] = warm
}

function stepParticles(world, dt) {
  const particles = world.particles
  for (let index = 0; index < PARTICLE_COUNT; index++) {
    if (particles.age[index] >= particles.life[index]) continue
    particles.age[index] += dt
    const base = index * 3
    const damping = Math.exp(-particles.drag[index] * dt)
    particles.velocity[base] *= damping
    particles.velocity[base + 1] = particles.velocity[base + 1] * damping + particles.lift[index] * dt
    particles.velocity[base + 2] *= damping
    particles.position[base] += particles.velocity[base] * dt
    particles.position[base + 1] += particles.velocity[base + 1] * dt
    particles.position[base + 2] += particles.velocity[base + 2] * dt
    if (particles.position[base + 1] < GROUND + 0.4) {
      particles.position[base + 1] = GROUND + 0.4
      particles.velocity[base + 1] = Math.abs(particles.velocity[base + 1]) * 0.2
    }
  }
}

// Emits `rate` per second worth of particles this step with a seeded fractional carry.
function burst(world, key, rate, dt, spawn) {
  const carry = (world.carry[key] ?? 0) + rate * dt
  const count = Math.floor(carry)
  world.carry[key] = carry - count
  for (let index = 0; index < count; index++) spawn(world.random)
}

// ---------- LC-1 launch cycle ----------
export function cycleOf(time) {
  const shifted = time - LIFTOFF_AT + 140
  const cycle = Math.floor(shifted / PERIOD)
  return { cycle, tau: shifted - cycle * PERIOD - 140 }
}

export function phaseOf(tau) {
  return PHASES.find((phase) => tau >= phase.start && tau < phase.end) ?? PHASES[PHASES.length - 1]
}

// Countdown clock in mission seconds: 1 s = 1 min before terminal count, real seconds in terminal count,
// and flight compressed MISSION_SCALE times after liftoff.
export function missionSeconds(tau) {
  if (tau >= 0) return tau * MISSION_SCALE
  if (tau >= -20) return tau
  const holdDone = Math.min(HOLD.end - HOLD.start, Math.max(0, HOLD.end - Math.max(tau, HOLD.start)))
  return -20 - ((-20 - tau) - holdDone) * 60
}

function gripPoint(angle) {
  return { x: GRIP_RADIUS * Math.sin(angle), z: HINGE_Z + GRIP_RADIUS * Math.cos(angle) }
}

const SHIP_MODELS = ['ship_crew', 'ship_cargo', 'ship_tanker']
const SPMT_PATH_LC1 = createPath([[-330, 222], [-150, 214], [-20, 212], [-20, 100], [-6, 80], [19.5, 62], [19.5, 18.75]])

// Pose of everything on the launch pad at a given tau. Heights are relative to the pad ground.
export function padPose(tau) {
  const pose = {
    booster: { x: AXIS.x, y: 20, z: AXIS.z, tilt: 0, fins: 0, engines: 0, visible: true },
    ship: { x: AXIS.x, y: 91, z: AXIS.z, tilt: 0, turn: 0, engines: 0, visible: true, onSpmt: false },
    carriageDy: 0,
    armLeft: 0,
    armRight: 0,
    qdArm: 1.35,
    mountQd: 0,
    spmtDistance: 0,
  }
  const grip = (shipBase) => shipBase + 27 - 82
  // Rollout and stack.
  if (tau < -110) {
    const progress = span(tau, -140, -110)
    pose.spmtDistance = progress * SPMT_PATH_LC1.total
    pose.ship.onSpmt = true
    pose.carriageDy = lerp(0, grip(5.1), span(tau, -130, -114))
    const swing = span(tau, -130, -122) * (Math.PI / 3)
    pose.armLeft = swing
    pose.armRight = swing
    pose.mountQd = 0
  } else if (tau < -85) {
    pose.spmtDistance = SPMT_PATH_LC1.total
    const lift = span(tau, -110, -100)
    const swingBack = span(tau, -100, -92)
    const lower = span(tau, -92, -88)
    const angle = (Math.PI / 3) * (1 - swingBack)
    const point = gripPoint(angle)
    const base = lerp(5.1, 95, lift) - 4 * lower
    pose.ship = { ...pose.ship, x: point.x, z: point.z + (AXIS.z - (HINGE_Z + GRIP_RADIUS)), y: base, turn: angle }
    pose.carriageDy = grip(base)
    pose.armLeft = angle
    pose.armRight = angle
    pose.qdArm = 1.35 * (1 - span(tau, -87, -85))
  } else if (tau < 0) {
    pose.spmtDistance = SPMT_PATH_LC1.total * (1 - span(tau, -84, -60))
    pose.carriageDy = lerp(grip(91), 0, span(tau, -72, -60))
    pose.qdArm = 1.35 * span(tau, -3, -1)
    pose.mountQd = span(tau, -0.6, 0) * 0.9
    pose.booster.engines = tau > -0.4 ? 1 : 0
  }
  if (tau >= -84 && tau < 0) {
    pose.ship.x = AXIS.x
    pose.ship.z = AXIS.z
    pose.ship.y = 91
    pose.ship.turn = 0
  }
  // Flight.
  if (tau >= 0 && tau < 40) {
    pose.qdArm = 1.35
    pose.mountQd = 0.9 * (1 - span(tau, 30, 34))
    const open = span(tau, 12, 16) * (1 - span(tau, 20.4, 21.05))
    pose.armLeft = -0.61 * open
    pose.armRight = 0.61 * open
    pose.ship.visible = tau < 16
    if (tau < 8) {
      const base = 20 + 7 * tau * tau
      const tilt = -0.0055 * tau * tau
      pose.booster = { ...pose.booster, x: 0.18 * tau ** 3, y: base, tilt, engines: 1 }
      pose.ship = { ...pose.ship, x: pose.booster.x - Math.sin(tilt) * 71, y: base + Math.cos(tilt) * 71, tilt, engines: 0 }
    } else {
      const s = tau - 8
      const sepTilt = -0.0055 * 64
      const sepX = 0.18 * 512
      pose.ship = {
        ...pose.ship,
        x: sepX - Math.sin(sepTilt) * 71 + 46 * s + 4 * s * s,
        y: 468 + Math.cos(sepTilt) * 71 + 112 * s + 9 * s * s,
        tilt: sepTilt - 0.03 * s,
        engines: 1,
      }
      if (tau < 17) {
        // Hermite curve from separation back over the pad.
        const u = (tau - 8) / 9
        const h00 = 2 * u ** 3 - 3 * u ** 2 + 1
        const h10 = u ** 3 - 2 * u ** 2 + u
        const h01 = -2 * u ** 3 + 3 * u ** 2
        const h11 = u ** 3 - u ** 2
        const duration = 9
        const x = h00 * sepX + h10 * 34.6 * duration + h01 * AXIS.x + h11 * 0 * duration
        const y = h00 * 468 + h10 * 112 * duration + h01 * 230 + h11 * -75 * duration
        let tilt = lerp(sepTilt, 1.75, span(tau, 8, 10))
        tilt = lerp(tilt, 0, span(tau, 13, 16.5))
        pose.booster = { ...pose.booster, x, y, tilt, engines: tau > 10 && tau < 13 ? 0.6 : 0, fins: Math.sin(tau * 2.1) * 0.35 * span(tau, 12, 14) }
      } else if (tau < CATCH_TAU) {
        const u = (tau - 17) / 4
        pose.booster = { ...pose.booster, x: AXIS.x, y: 23.8 + 206.2 * (1 - u) ** 2, tilt: Math.sin(tau * 3) * 0.015 * (1 - u), engines: tau > 17.4 ? 1 : 0, fins: Math.sin(tau * 3.3) * 0.2 * (1 - u) }
      } else {
        const settle = tau < 24 ? Math.sin((tau - CATCH_TAU) * 5) * 0.35 * Math.exp(-(tau - CATCH_TAU) * 2) : 0
        const lower = span(tau, 25, 31)
        pose.booster = { ...pose.booster, x: AXIS.x, y: 23.8 - settle - 3.8 * lower, tilt: 0, engines: 0 }
        pose.carriageDy = -settle - 3.8 * lower
        if (tau > 32) pose.carriageDy = lerp(-3.8, 0, span(tau, 33, 38))
      }
    }
    if (tau >= 30) {
      pose.ship = { ...pose.ship, visible: true, onSpmt: true, engines: 0, tilt: 0 }
      pose.spmtDistance = 0
    }
  }
  return pose
}

// ---------- world ----------
function staticEntity(site, item) {
  const isTank = item.kind === 'tank'
  return {
    id: item.id,
    siteId: site.id,
    kind: item.kind,
    name: item.name,
    model: item.model,
    position: { x: item.x, y: item.water ? 0 : GROUND, z: item.z },
    heading: item.rotation ?? 0,
    list: isTank ? 'tanks' : item.kind === 'checkpoint' || item.kind === 'weather' ? 'range' : null,
    fluid: item.fluid,
    capacity: item.capacity,
    level: isTank ? 0.6 : 0,
    boiloff: 0.1,
    static: true,
  }
}

function mover(site, options) {
  return {
    siteId: site.id,
    list: 'vehicles',
    position: { x: 0, y: GROUND, z: 0 },
    heading: 0,
    speed: 0,
    wheelAngle: 0,
    steer: 0,
    direction: 1,
    pause: 0,
    ...options,
    path: options.path ? createPath(options.path, options.closed) : null,
  }
}

function createSiteMovers(site) {
  const movers = []
  const add = (options) => movers.push(mover(site, options))
  if (site.id === 'lc1') {
    movers.push({ id: 'b-14', siteId: 'lc1', kind: 'booster', model: 'booster_a', name: 'Kestrel booster B-14', list: 'vehicles', scripted: true, position: { x: 0, y: GROUND + 20, z: 30 }, heading: 0 })
    movers.push({ id: 'ship-lc1', siteId: 'lc1', kind: 'ship', model: 'ship_crew', name: 'Heron ship', list: 'vehicles', scripted: true, position: { x: 0, y: GROUND + 91, z: 30 }, heading: 0 })
    add({ id: 'bt-tern', kind: 'boat', model: 'recovery_boat', name: 'Recovery vessel Tern', path: ellipsePoints(430, 40, 50, 130, 32), closed: true, cruise: 5, distance: 0, water: true })
    add({ id: 'bt-skua', kind: 'boat', model: 'range_boat', name: 'Range boat Skua', path: [[400, -320], [480, -80], [455, 180], [390, 330]], cruise: 11, distance: 260, pauseAtEnds: 2, water: true })
    add({ id: 'sp-41', kind: 'spmt', model: 'spmt_short', name: 'Transporter SP-41', scripted: true })
    const tankerPath = [[-600, 224], [-420, 224], [-300, 222], [-150, 214], [-20, 212], [-20, 150], [-128, 150], [-128, 12]]
    add({ id: 'tk-201', kind: 'tanker', model: 'tanker_truck', name: 'Cryo tanker 201', cargo: 'LOX', path: tankerPath, cruise: 13, distance: 520, pauseAtEnds: 5 })
    add({ id: 'tk-207', kind: 'tanker', model: 'tanker_truck', name: 'Cryo tanker 207', cargo: 'LNG', path: tankerPath, cruise: 12, distance: 140, direction: -1, pauseAtEnds: 5 })
    add({ id: 'vn-12', kind: 'van', model: 'crew_van', name: 'Pad crew van 12', path: [[-20, 196], [-20, 100], [72, 100], [92, -60], [96, -78]], cruise: 7, distance: 60, pauseAtEnds: 4 })
    add({ id: 'pk-03', kind: 'pickup', model: 'pickup_crew', name: 'Beach patrol 3', path: [[160, 200], [222, 60], [228, -120], [204, -250]], cruise: 8, distance: 120, pauseAtEnds: 3 })
    add({ id: 'pk-08', kind: 'pickup', model: 'pickup_single', name: 'Farm tech 8', path: [[-20, 150], [-128, 150], [-128, 30]], cruise: 6, distance: 40, pauseAtEnds: 6 })
  }
  if (site.id === 'lc2') {
    add({ id: 'cr-90', kind: 'crane', model: 'crawler_crane', name: 'Crawler crane CR-90', scripted: true, heading: 0.552, position: { x: -1.3, y: GROUND, z: -40.6 } })
    add({ id: 'sp-17', kind: 'spmt', model: 'spmt_flat', name: 'Transporter SP-17', path: [[-110, 120], [-20, 130], [-20, 96], [-10, 70], [30, 60]], cruise: 4, distance: 40, pauseAtEnds: 8 })
    add({ id: 'pk-11', kind: 'pickup', model: 'pickup_crew', name: 'Steel crew 11', path: [[-20, 200], [-20, 100], [-10, 76], [36, 60]], cruise: 7, distance: 20, pauseAtEnds: 5 })
    add({ id: 'vn-04', kind: 'van', model: 'crew_van', name: 'Weld crew van 4', path: [[-600, 224], [-150, 214], [-20, 212], [-20, 130], [-110, 130], [-110, 20]], cruise: 12, distance: 300, pauseAtEnds: 5 })
  }
  if (site.id === 'ts3') {
    movers.push({ id: 'ship-ts3', siteId: 'ts3', kind: 'ship', model: 'ship_tanker', name: 'Heron ship S-29', list: 'vehicles', scripted: true, position: { x: 0, y: GROUND + 22.6, z: 0 }, heading: 0 })
    add({ id: 'pk-21', kind: 'pickup', model: 'pickup_single', name: 'Stand tech 21', path: [[-20, 200], [-20, 60], [0, 40]], cruise: 7, distance: 80, pauseAtEnds: 6 })
    add({ id: 'tk-310', kind: 'tanker', model: 'tanker_truck', name: 'Cryo tanker 310', cargo: 'LOX', path: [[-600, 224], [-150, 214], [-20, 212], [-20, 60], [-44, 40]], cruise: 12, distance: 400, pauseAtEnds: 6 })
  }
  if (site.id === 'yard') {
    add({ id: 'sp-52', kind: 'spmt', model: 'spmt_stand', name: 'Transporter SP-52', carries: 'booster_b', path: [[0, -12], [0, 60], [0, 150], [0, 206], [260, 213], [640, 222]], cruise: 9, distance: 70, pauseAtEnds: 9 })
    add({ id: 'sp-58', kind: 'spmt', model: 'spmt_short', name: 'Transporter SP-58', carries: 'ship_cargo', path: [[-82, 2], [-82, 60], [-40, 92], [40, 92], [60, 120]], cruise: 5, distance: 60, pauseAtEnds: 7 })
    add({ id: 'cr-77', kind: 'crane', model: 'crawler_crane', name: 'Crawler crane CR-77', scripted: true, position: { x: 40, y: GROUND, z: 130 } })
    add({ id: 'vn-31', kind: 'van', model: 'crew_van', name: 'Shift van 31', path: [[-600, 214], [-200, 212], [0, 210], [0, 150], [-60, 120], [-100, 96]], cruise: 12, distance: 500, pauseAtEnds: 5 })
    add({ id: 'pk-40', kind: 'pickup', model: 'pickup_crew', name: 'Tile crew 40', path: [[-120, 60], [60, 60], [100, 80]], cruise: 6, distance: 30, pauseAtEnds: 5 })
    add({ id: 'pk-44', kind: 'pickup', model: 'pickup_single', name: 'Yard safety 44', path: [[140, 140], [140, -60], [-140, -60], [-140, 140]], closed: true, cruise: 7, distance: 100 })
  }
  return movers
}

export function createWorld() {
  const world = { time: 0, random: createRandom(20261017), carry: {}, particles: createParticles(), events: [], sites: {}, currentSite: 'lc1' }
  for (const site of SITES) {
    const statics = site.statics.filter((item) => item.id).map((item) => staticEntity(site, item))
    const movers = createSiteMovers(site)
    world.sites[site.id] = { site, entities: [...movers, ...statics], byId: Object.fromEntries([...movers, ...statics].map((entity) => [entity.id, entity])) }
  }
  world.pad = padPose(cycleOf(0).tau)
  world.lastPhase = null
  pushEvent(world, 'info', 'LC-1 terminal count running, flight 7 of B-14')
  return world
}

function pushEvent(world, level, text, siteId = 'lc1') {
  world.events.unshift({ id: `${world.time.toFixed(2)}-${world.events.length}`, time: world.time, level, text, siteId })
  if (world.events.length > 40) world.events.pop()
}

function stepMover(entity, dt) {
  if (!entity.path) return
  const previous = entity.heading
  if (entity.pause > 0) {
    entity.pause -= dt
    entity.speed = 0
  } else {
    entity.speed = entity.cruise
    entity.distance += entity.direction * entity.cruise * dt
    if (!entity.path.closed) {
      if (entity.distance >= entity.path.total) {
        entity.distance = entity.path.total
        entity.direction = -1
        entity.pause = entity.pauseAtEnds ?? 0
      } else if (entity.distance <= 0) {
        entity.distance = 0
        entity.direction = 1
        entity.pause = entity.pauseAtEnds ?? 0
      }
    }
  }
  // Look slightly ahead so turns are smooth.
  const ahead = samplePath(entity.path, entity.distance + entity.direction * 4)
  const here = samplePath(entity.path, entity.distance)
  entity.position.x = here.x
  entity.position.z = here.z
  entity.position.y = entity.water ? 0 : GROUND
  const targetHeading = Math.atan2(ahead.x - here.x, ahead.z - here.z)
  if (Number.isFinite(targetHeading) && (Math.abs(ahead.x - here.x) + Math.abs(ahead.z - here.z) > 0.01)) {
    let delta = targetHeading - entity.heading
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    entity.heading += delta * Math.min(1, dt * 4)
  }
  let turn = entity.heading - previous
  turn = Math.atan2(Math.sin(turn), Math.cos(turn))
  entity.steer = lerp(entity.steer, Math.max(-0.5, Math.min(0.5, (turn / Math.max(dt, 1e-3)) * 2)), Math.min(1, dt * 3))
  entity.wheelAngle += (entity.speed * dt) / 0.4
}

function stepLc1(world, dt) {
  const state = world.sites.lc1
  const { tau, cycle } = cycleOf(world.time)
  const pose = padPose(tau)
  world.pad = pose
  world.tau = tau
  world.cycle = cycle
  const booster = state.byId['b-14']
  booster.position = { x: pose.booster.x, y: GROUND + pose.booster.y, z: pose.booster.z }
  booster.pose = pose.booster
  const shipNumber = 31 + cycle + (tau >= 30 ? 1 : 0)
  const ship = state.byId['ship-lc1']
  ship.serial = `S-${shipNumber}`
  ship.name = `Heron ship S-${shipNumber}`
  ship.model = SHIP_MODELS[shipNumber % 3]
  ship.pose = pose.ship
  ship.flights = 0
  const spmt = state.byId['sp-41']
  const sample = samplePath(SPMT_PATH_LC1, pose.spmtDistance)
  const previous = { ...spmt.position }
  spmt.position = { x: sample.x, y: GROUND, z: sample.z }
  spmt.heading = sample.heading
  spmt.speed = Math.hypot(sample.x - previous.x, sample.z - previous.z) / Math.max(dt, 1e-3)
  if (pose.ship.onSpmt) ship.position = { x: sample.x, y: GROUND + 5.1, z: sample.z }
  else ship.position = { x: pose.ship.x, y: GROUND + pose.ship.y, z: pose.ship.z }
  ship.heading = pose.ship.onSpmt ? sample.heading : 0
  booster.flights = 6 + cycle + (tau >= CATCH_TAU ? 1 : 0)

  // Propellant: vehicles and the farm.
  const shipLoad = tau < -80 || tau >= 30 ? 0 : tau < 8 ? span(tau, -80, -30) : lerp(1, 0.58, span(tau, 8, 16))
  const boosterLoad = tau < -75 ? 0 : tau < 0 ? span(tau, -75, -22) : tau < 8 ? lerp(1, 0.12, tau / 8) : tau < CATCH_TAU ? lerp(0.12, 0.04, (tau - 8) / 13) : lerp(0.04, 0, span(tau, 22, 34))
  ship.load = shipLoad
  booster.load = boosterLoad
  const refill = tau >= -20 ? span(tau, -20, 40) * 0.5 : tau < -85 ? 0.5 + span(tau, -140, -85) * 0.5 : 0
  for (const entity of state.entities) {
    if (entity.kind !== 'tank') continue
    const share = entity.fluid === 'LN2' ? 0.08 : entity.id.includes('h') ? 0.18 : 0.34
    const drawn = tau >= -85 && tau < -20 ? span(tau, -85, -20) : 1 - refill
    entity.level = Math.min(0.985, 0.95 - share * (tau < -85 ? 1 - refill : drawn) + Math.sin(world.time * 0.3 + entity.position.x) * 0.002)
    entity.boiloff = 0.09 + 0.05 * (0.5 + 0.5 * Math.sin(world.time * 0.21 + entity.position.z * 0.1)) + (entity.fluid === 'CH4' ? 0.03 : 0)
    entity.loading = tau >= -85 && tau < -20 && entity.fluid !== 'LN2'
  }

  // Range.
  const wind = 52 + 14 * Math.sin(world.time / 7) + 6 * Math.sin(world.time / 2.3) + (tau >= -50 && tau < -44 ? 26 * Math.sin(((tau + 50) / 6) * Math.PI) : 0)
  world.range = {
    road: tau >= -90 && tau < 26,
    airspace: tau >= -60 && tau < 30,
    marineHold: tau >= -70 && tau < -52,
    marine: tau >= -90 && tau < 30,
    wind,
    groundWind: 14 + 3 * Math.sin(world.time / 5.3),
    hold: tau >= HOLD.start && tau < HOLD.end,
  }

  // Events on phase changes.
  const phase = phaseOf(tau)
  if (world.lastPhase && phase.id !== world.lastPhase) {
    const messages = {
      rollout: [`${ship.serial} rolling out from staging on SP-41`, 'info'],
      stack: [`Tower arms lifting ${ship.serial} onto B-14`, 'info'],
      load: ['Propellant load started, LOX and CH4 flowing', 'info'],
      terminal: ['Terminal count, go for launch', 'go'],
      ascent: [`Liftoff, B-14 flight ${booster.flights + 1} with ${ship.serial}`, 'go'],
      boostback: ['Stage separation, B-14 boostback burn', 'info'],
      catch: ['B-14 landing burn, catch arms open', 'warn'],
      safing: ['B-14 caught by the tower arms', 'go'],
    }
    const [text, level] = messages[phase.id]
    pushEvent(world, level, text)
  }
  if (world.range.hold && !world.lastHold) pushEvent(world, 'hold', `Hold: winds aloft ${wind.toFixed(0)} kt over the 80 kt limit`)
  if (world.range.marineHold && !world.lastMarine) pushEvent(world, 'warn', 'Marine: fishing vessel inside hazard area, Skua intercepting')
  world.lastPhase = phase.id
  world.lastHold = world.range.hold
  world.lastMarine = world.range.marineHold

  // Particles only for the site on screen.
  if (world.currentSite !== 'lc1') return
  const ground = GROUND
  if (pose.booster.engines > 0 && tau < 8) {
    const base = pose.booster
    const height = base.y
    // Hero moment: a white-hot core at the nozzles, a long plume of dots trailing the climbing vehicle,
    // and a big steam cloud that billows out of the mount and rises long after the vehicle has cleared the tower.
    burst(world, 'core', 2600, dt, (random) => {
      const angle = random() * Math.PI * 2
      const radius = random() * 2.6
      emit(world, base.x + Math.cos(angle) * radius, ground + height - 1.5, base.z + Math.sin(angle) * radius, (random() - 0.5) * 6, -55 - random() * 25, (random() - 0.5) * 6, 0.3 + random() * 0.3, 1.7, 1.0, 2, 0, 2)
    })
    burst(world, 'plume', 4200, dt, (random) => {
      const angle = random() * Math.PI * 2
      const radius = random() * 4
      const spread = 7 + random() * 7
      emit(world, base.x + Math.cos(angle) * radius, ground + height - 2, base.z + Math.sin(angle) * radius, Math.cos(angle) * spread * random(), -45 - random() * 45, Math.sin(angle) * spread * random(), 1.8 + random() * 2.4, 1.0, 2.0, 0.45, 0, 1)
    })
    if (height < 420) {
      burst(world, 'steam', 9000 * (1 - height / 420), dt, (random) => {
        const angle = random() * Math.PI * 2
        const speed = 45 + random() * 85
        const reach = 10 + random() * 16
        emit(world, AXIS.x + Math.cos(angle) * reach, ground + 3 + random() * 10, AXIS.z + Math.sin(angle) * reach, Math.cos(angle) * speed, 14 + random() * 30, Math.sin(angle) * speed, 9 + random() * 7, 1.1, 2.6 + random() * 1.0, 0.7, 8)
      })
    }
  }
  if (tau >= -20 && tau < 0) {
    burst(world, 'vent', 22, dt, (random) => emit(world, AXIS.x + (random() - 0.5) * 6, ground + 92 + random() * 4, AXIS.z - 4, -4 - random() * 3, 1 + random(), -2 + random() * 2, 2.5, 0.7, 2.2, 0.8, 0.6))
  }
  if (tau >= -2 && tau < 0) {
    burst(world, 'deluge', 900, dt, (random) => {
      const angle = random() * Math.PI * 2
      emit(world, AXIS.x + Math.cos(angle) * 9, ground + 18, AXIS.z + Math.sin(angle) * 9, Math.cos(angle) * 14, 12 + random() * 8, Math.sin(angle) * 14, 1.6, 0.6, 1.2, 1, -6)
    })
  }
  const engineBurn = (key, rate, entityPose, speed) => {
    const up = { x: -Math.sin(entityPose.tilt), y: Math.cos(entityPose.tilt) }
    burst(world, key, rate, dt, (random) => {
      const spread = 6
      emit(world, entityPose.x + (random() - 0.5) * 5, ground + entityPose.y - 1, entityPose.z + (random() - 0.5) * 5, -up.x * speed + (random() - 0.5) * spread, -up.y * speed + (random() - 0.5) * spread, (random() - 0.5) * spread, 0.45 + random() * 0.4, 0.8, 1.5, 1.4, 0, 1)
    })
  }
  if (tau >= 8 && tau < 16) engineBurn('shipburn', 400, pose.ship, 60)
  if (pose.booster.engines > 0 && tau >= 8) engineBurn('boosterburn', tau > 17 ? 900 : 500, pose.booster, 55)
  if (tau > 19.4 && tau < CATCH_TAU + 0.3) {
    burst(world, 'catchsteam', 900, dt, (random) => {
      const angle = random() * Math.PI * 2
      const speed = 18 + random() * 26
      emit(world, AXIS.x + Math.cos(angle) * 10, ground + 21, AXIS.z + Math.sin(angle) * 10, Math.cos(angle) * speed, 3 + random() * 6, Math.sin(angle) * speed, 3 + random() * 2.5, 0.8, 2.2, 1, 1.8)
    })
  }
  for (const entity of state.entities) {
    if (entity.kind === 'tank' && entity.loading && entity.model === 'tank_vertical_lox') {
      burst(world, `vent-${entity.id}`, 7, dt, (random) => emit(world, entity.position.x + (random() - 0.5) * 2, entity.position.y + 31, entity.position.z + (random() - 0.5) * 2, 1 + random(), 2 + random() * 2, (random() - 0.5), 3, 0.5, 1.8, 0.5, 0.4))
    }
    if (entity.kind === 'boat' && entity.speed > 0) wake(world, entity, dt)
  }
}

function wake(world, entity, dt) {
  const length = entity.model === 'recovery_boat' ? 30 : 7
  const sternX = entity.position.x - Math.sin(entity.heading) * length
  const sternZ = entity.position.z - Math.cos(entity.heading) * length
  const sideX = Math.cos(entity.heading)
  const sideZ = -Math.sin(entity.heading)
  burst(world, `wake-${entity.id}`, entity.model === 'recovery_boat' ? 70 : 60, dt, (random) => {
    const side = random() < 0.5 ? -1 : 1
    const spread = 1.5 + random() * 3
    emit(world, sternX + sideX * side * (random() * 4), 0.25, sternZ + sideZ * side * (random() * 4), sideX * side * spread, 0, sideZ * side * spread, 6 + random() * 3, 0.55, 1.1, 0.25, 0)
  })
}

function stepLc2(world) {
  const state = world.sites.lc2
  const crane = state.byId['cr-90']
  const cycle = (world.time + 12) % 60
  // Test lift: hook down to the module, lift 34 m, hold for the load test, set it back down.
  const lift = span(cycle, 10, 22) * (1 - span(cycle, 38, 50))
  crane.lift = lift
  crane.slew = Math.sin(world.time * 0.05) * 0.03
  crane.progress = cycle / 60
  crane.speed = lift > 0 && lift < 1 ? 1 : 0
}

function stepTs3(world, dt) {
  const state = world.sites.ts3
  const ship = state.byId['ship-ts3']
  const cycle = (world.time + 30) % 45
  ship.cycle = cycle
  ship.firing = cycle >= 8 && cycle < 14
  ship.armRetract = span(cycle, 2, 5) * (1 - span(cycle, 22, 26))
  ship.load = cycle < 8 ? span(cycle, 0, 6) : cycle < 14 ? lerp(1, 0.82, (cycle - 8) / 6) : lerp(0.82, 0, span(cycle, 16, 30))
  ship.position = { x: 0, y: GROUND + 22.6, z: 0 }
  ship.pose = { x: 0, y: 22.6, z: 0, tilt: 0, engines: ship.firing ? 1 : 0, visible: true }
  if (world.currentSite !== 'ts3' || !ship.firing) return
  burst(world, 'ts-plume', 700, dt, (random) => {
    const angle = random() * Math.PI * 2
    emit(world, Math.cos(angle) * 2.5, GROUND + 21, Math.sin(angle) * 2.5, (random() - 0.5) * 5, -60 - random() * 20, (random() - 0.5) * 5, 0.35, 0.8, 1.3, 1.2, 0, 1)
  })
  burst(world, 'ts-steam', 800, dt, (random) => {
    const angle = random() * Math.PI * 2
    const speed = 20 + random() * 30
    emit(world, Math.cos(angle) * 6, GROUND + 2 + random() * 3, Math.sin(angle) * 6, Math.cos(angle) * speed, 3 + random() * 6, Math.sin(angle) * speed, 3.5 + random() * 2, 0.8, 2.2, 0.9, 2)
  })
}

function stepYard(world) {
  const state = world.sites.yard
  const crane = state.byId['cr-77']
  crane.slew = Math.sin(world.time * 0.09) * 0.9 + 0.4
  crane.lift = 0.5 + 0.5 * Math.sin(world.time * 0.2)
  crane.speed = 1
  const megaDoorTarget = Math.hypot(state.byId['sp-52'].position.x, state.byId['sp-52'].position.z - 20) < 70 ? 1 : 0
  const highDoorTarget = Math.hypot(state.byId['sp-58'].position.x + 82, state.byId['sp-58'].position.z - 10) < 40 ? 1 : 0
  state.doors = state.doors ?? { mega: 0, high: 0 }
  state.doors.mega += (megaDoorTarget - state.doors.mega) * 0.04
  state.doors.high += (highDoorTarget - state.doors.high) * 0.04
}

export function stepWorld(world, dt) {
  world.time += dt
  for (const id of Object.keys(world.sites)) {
    for (const entity of world.sites[id].entities) if (entity.path && !entity.scripted) stepMover(entity, dt)
  }
  stepLc1(world, dt)
  stepLc2(world)
  stepTs3(world, dt)
  stepYard(world)
  if (world.currentSite !== 'lc1') {
    for (const entity of world.sites[world.currentSite].entities) if (entity.kind === 'boat' && entity.speed > 0) wake(world, entity, dt)
  }
  stepParticles(world, dt)
}

// ---------- read models for the dashboard ----------
export function clock(seconds) {
  const sign = seconds < 0 ? '−' : '+'
  const total = Math.floor(Math.abs(seconds))
  const hours = String(Math.floor(total / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const secs = String(total % 60).padStart(2, '0')
  return `T${sign}${hours}:${minutes}:${secs}`
}

export function flightTelemetry(world, which) {
  const tau = world.tau
  const seconds = Math.max(0, tau) * MISSION_SCALE
  if (which === 'ship') {
    const altitude = tau < 0 ? 0 : tau < 8 ? 65 * (tau / 8) ** 2 : 65 + (tau - 8) * 14
    const speed = tau < 0 ? 0 : tau < 8 ? 1.6 * (tau / 8) ** 1.5 : 1.6 + (tau - 8) * 0.55
    return { altitude, speed, seconds }
  }
  let altitude = 0
  let speed = 0
  if (tau >= 0 && tau < 8) {
    altitude = 65 * (tau / 8) ** 2
    speed = 1.6 * (tau / 8) ** 1.5
  } else if (tau >= 8 && tau < 17) {
    const u = (tau - 8) / 9
    altitude = 65 + 30 * Math.sin(u * Math.PI * 0.8) - 60 * u * u
    speed = 1.6 - 1.2 * Math.sin(u * Math.PI * 0.5) + 0.5 * u
  } else if (tau >= 17 && tau < CATCH_TAU) {
    const u = (tau - 17) / 4
    altitude = 4.2 * (1 - u) ** 2
    speed = 0.45 * (1 - u)
  }
  return { altitude: Math.max(0, altitude), speed: Math.max(0, speed), seconds }
}

export const STAGES = [
  { id: 'b-14', label: 'B-14', where: 'lc1' },
  { id: 'ship-lc1', label: 'Ship LC-1', where: 'lc1' },
  { id: 'sp-52', label: 'B-16', where: 'yard' },
  { id: 'sp-58', label: 'S-33', where: 'yard' },
  { id: 'ship-ts3', label: 'S-29', where: 'ts3' },
]
