// One emergency department as plain data, advanced by stepSite(state, dt). Seeded, so the same
// warm-up gives the same department. The 3D view and the dashboard only read this state.
import { COMPLAINTS, FIRST_NAMES, LAST_NAMES, STAGES, TRIAGE, UNIT_NAMES } from '../data.js'
import { buildLayout, pathLength, route, seatApproach } from './layout.js'

export const DECK_HEIGHT = { stretcher_ed: 0.72, stretcher_cot: 0.92 }
const WALK_SPEED = 1.35
const PUSH_SPEED = 1.15
const COT_SPEED = 1.35

// ---------- helpers ----------

export function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const between = (random, [low, high]) => low + random() * (high - low)
const pick = (random, list) => list[Math.floor(random() * list.length)]
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

function turnToward(current, target, maxStep) {
  const difference = wrapAngle(target - current)
  if (Math.abs(difference) <= maxStep) return target
  return current + Math.sign(difference) * maxStep
}

// Moves `mover.position` along `points` (consumed as reached); returns true when the last is reached.
function moveAlong(mover, points, distance) {
  let remaining = distance
  while (remaining > 0 && points.length) {
    const target = points[0]
    const deltaX = target.x - mover.position.x
    const deltaZ = target.z - mover.position.z
    const length = Math.hypot(deltaX, deltaZ)
    if (length > 1e-4) mover.motionHeading = Math.atan2(deltaX, deltaZ)
    if (length <= remaining) {
      mover.position.x = target.x
      mover.position.z = target.z
      remaining -= length
      points.shift()
    } else {
      mover.position.x += (deltaX / length) * remaining
      mover.position.z += (deltaZ / length) * remaining
      remaining = 0
    }
  }
  mover.odometer = (mover.odometer ?? 0) + distance - remaining
  return points.length === 0
}

function addEvent(state, icon, tone, text, id = null) {
  state.events.unshift({ clock: state.clock, icon, tone, text, id })
  state.events.length = Math.min(state.events.length, 30)
}

function personName(random, title) {
  return `${title}${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)[0]}.`
}

// ---------- creation ----------

function createPerson(state, role, model, position, extra = {}) {
  const person = {
    id: `${state.site.id}-${role.slice(0, 2).toUpperCase()}${String((state.personCount = (state.personCount ?? 0) + 1)).padStart(2, "0")}`,
    role,
    model,
    name: personName(state.random, role === 'Doctor' ? 'Dr ' : ''),
    position: { x: position.x, z: position.z },
    heading: position.heading ?? 0,
    clip: 'idle',
    clipSpeed: 1,
    jobs: [],
    hidden: false,
    task: 'On shift',
    home: { ...position },
    restClip: 'idle',
    restHeading: position.heading ?? 0,
    ...extra,
  }
  state.people.push(person)
  return person
}

function testsFor(random, level) {
  const tests = []
  if (level <= 3 || random() < 0.3) tests.push('Bloods')
  if (level <= 2) tests.push('CT')
  else if (level === 3) {
    const roll = random()
    if (roll < 0.2) tests.push('CT')
    else if (roll < 0.55) tests.push('X-ray')
  } else if (random() < 0.3) tests.push('X-ray')
  if (level <= 2 && random() < 0.6) tests.push('ECG')
  return tests.map((name) => ({ name, state: 'pending' }))
}

function createPatient(state, mode, level = null) {
  const random = state.random
  const rolled = level ?? (mode === 'walk-in' ? pick(random, [2, 3, 3, 3, 4, 4, 4, 5, 5]) : pick(random, [1, 2, 2, 3, 3, 3, 4]))
  const patient = {
    id: `P-${String(Math.floor(1000 + random() * 8999))}`,
    level: rolled,
    mode,
    complaint: pick(random, state.site.children ? COMPLAINTS.child : COMPLAINTS.adult),
    age: state.site.children ? Math.floor(1 + random() * 15) : Math.floor(19 + random() * 70),
    figure: pick(random, ['patient_a', 'patient_b', 'patient_c']),
    tests: testsFor(random, rolled),
    stageAt: [state.clock, null, null, null, null, null],
    needs: 'triage',
    bedId: null,
    carrier: null,
    outcome: null,
    doctorId: null,
    gone: false,
  }
  while (state.patients.some((other) => other.id === patient.id)) patient.id = `P-${String(Math.floor(1000 + random() * 8999))}`
  state.patients.push(patient)
  state.counters.arrivals++
  return patient
}

export function createSite(site) {
  const layout = buildLayout(site)
  const random = seededRandom(site.seed)
  const state = {
    site,
    layout,
    random,
    clock: 0,
    beds: [],
    trolleys: [],
    patients: [],
    people: [],
    vehicles: [],
    helis: [],
    convoys: [],
    rooms: layout.rooms.map((room) => ({ ...room, patientId: null, reservedBy: null, table: 0, scansToday: Math.floor(20 + random() * 30), busyFor: 0 })),
    labQueue: [],
    events: [],
    counters: { arrivals: 0, seen: 0, admitted: 0, discharged: 0, lwbs: 0, doorToDoctor: [], ambulances: 0 },
    timers: { walkIn: between(random, site.walkInEvery) * 0.4 },
    schedule: { ambulance: [], heli: [] },
  }
  let time = 6
  for (let index = 0; index < 60; index++) {
    state.schedule.ambulance.push(time)
    time += between(random, site.ambulanceEvery)
  }
  if (site.helipad) {
    let heliTime = site.heliFirst ?? 40
    for (let index = 0; index < 40; index++) {
      state.schedule.heli.push(heliTime)
      heliTime += site.heliEvery * (0.8 + random() * 0.4)
    }
  }

  for (const bay of layout.beds) {
    const trolley = { id: `${site.id}-TR-${bay.id}`, model: 'stretcher_ed', homeBedId: bay.id, position: { x: bay.bedAt.x, z: bay.bedAt.z }, heading: bay.bedAt.heading, patientId: null, backrest: 0.5, hidden: false }
    state.trolleys.push(trolley)
    state.beds.push({ id: bay.id, kind: bay.kind, name: bay.name, x: bay.x, z: bay.z, bay, trolleyId: trolley.id, state: 'free', patientId: null, cleanTimer: 0, reservedFor: null, curtain: 0.15 })
  }

  layout.stationSpots.slice(0, 4).forEach((spot, index) => createPerson(state, 'Nurse', 'staff_nurse', spot, { restClip: index % 2 ? 'chart' : 'idle', task: 'Nurses station' }))
  layout.stationSpots.slice(4, 6).forEach((spot) => createPerson(state, 'Doctor', 'staff_doctor', spot, { restClip: 'chart', task: 'Reviewing board' }))
  createPerson(state, 'Doctor', 'staff_doctor', layout.stationSpots[2], { restClip: 'chart', task: 'Reviewing board' })
  layout.porterBase.forEach((spot) => createPerson(state, 'Porter', 'staff_porter', spot, { task: 'Porter base' }))
  layout.triageDesks.forEach((desk) => {
    const nurse = createPerson(state, 'Triage nurse', 'staff_nurse', desk.nurseSpot, { restClip: 'chart', task: desk.name, fixed: true })
    desk.nurseId = nurse.id
  })
  const ctRoom = state.rooms.find((room) => room.kind === 'ct')
  createPerson(state, 'Radiographer', 'staff_nurse', ctRoom.staffSpot, { restClip: 'chart', task: 'CT 1 console', fixed: true })
  const labRoom = state.rooms.find((room) => room.kind === 'lab')
  createPerson(state, 'Lab scientist', 'staff_doctor', labRoom.staffSpot, { restClip: 'chart', task: 'Laboratory', fixed: true })

  // Ambulances with their crews (hidden while inside the vehicle).
  site.ambulances.forEach((model, index) => {
    const vehicle = {
      id: `${site.id}-AMB${index + 1}`,
      name: `${UNIT_NAMES[model]} ${[12, 7, 21][index]}`,
      model,
      phase: 'away',
      position: { x: 0, z: 0 },
      heading: 0,
      path: [],
      doors: 0,
      speed: 0,
      odometer: 0,
      patientId: null,
      crew: [],
      cotId: null,
      timer: 0,
      tripsToday: 3 + index * 2,
    }
    vehicle.crew = [0, 1].map(() => createPerson(state, 'Paramedic', 'staff_paramedic', { x: 0, z: 0 }, { hidden: true, task: vehicle.name, vehicleId: vehicle.id }).id)
    const cot = { id: `${vehicle.id}-COT`, model: 'stretcher_cot', position: { x: 0, z: 0 }, heading: 0, patientId: null, backrest: 0.6, hidden: true }
    state.trolleys.push(cot)
    vehicle.cotId = cot.id
    state.vehicles.push(vehicle)
  })
  if (site.helipad) {
    const heli = { id: `${site.id}-AIR1`, name: 'Air 1', model: site.children ? 'heli_b' : 'heli_a', phase: 'away', position: { x: 0, y: 0, z: 0 }, heading: 0, rotor: 0, rotorAngle: 0, doors: 0, timer: 0, patientId: null, crew: [], cotId: null, tripsToday: 2 }
    heli.crew = [0, 1].map(() => createPerson(state, 'Flight medic', 'staff_paramedic', { x: 0, z: 0 }, { hidden: true, task: 'Air 1 crew', vehicleId: heli.id }).id)
    const cot = { id: `${heli.id}-COT`, model: 'stretcher_cot', position: { x: 0, z: 0 }, heading: 0, patientId: null, backrest: 0.6, hidden: true }
    state.trolleys.push(cot)
    heli.cotId = cot.id
    state.helis.push(heli)
  }

  seedOccupancy(state)
  return state
}

// A department mid-afternoon: most bays taken, people waiting, a few visitors.
function seedOccupancy(state) {
  const random = state.random
  const minutesAgo = (minutes) => state.clock - minutes / 0.25
  state.beds.forEach((bed, index) => {
    if (random() < 0.42 && index > 0) return
    const patient = createPatient(state, random() < 0.5 ? 'ambulance' : 'walk-in', bed.kind === 'resus' ? pick(random, [1, 2]) : null)
    const age = 25 + random() * 140
    patient.stageAt[0] = minutesAgo(age)
    patient.stageAt[1] = minutesAgo(age - 6)
    const progress = random()
    if (progress > 0.3) {
      patient.stageAt[2] = minutesAgo(age * 0.6)
      patient.needs = 'tests'
      patient.tests.forEach((test) => {
        if (random() < 0.5) test.state = 'done'
      })
      if (patient.tests.every((test) => test.state === 'done')) {
        patient.needs = 'decision'
        patient.stageAt[3] = minutesAgo(age * 0.3)
      }
    } else patient.needs = 'doctor'
    placeOnBed(state, patient, bed)
  })
  const seats = [...state.layout.seats]
  for (let index = 0; index < 6; index++) {
    const seat = seats.splice(Math.floor(random() * seats.length), 1)[0]
    const patient = createPatient(state, 'walk-in')
    patient.stageAt[0] = minutesAgo(10 + random() * 70)
    if (index % 2) {
      patient.needs = 'bed'
      patient.stageAt[1] = patient.stageAt[0] + 20
    }
    const person = createPerson(state, 'Patient', 'visitor', { ...seat }, { patientId: patient.id, restClip: 'sit', seatId: seat.id, task: 'Waiting room' })
    person.clip = 'sit'
    patient.carrier = { type: 'person', id: person.id }
    patient.seatId = seat.id
  }
  for (let index = 0; index < 5; index++) {
    const seat = seats.splice(Math.floor(random() * seats.length), 1)[0]
    const person = createPerson(state, 'Visitor', 'visitor', { ...seat }, { restClip: 'sit', seatId: seat.id, task: 'With a patient', fixed: true })
    person.clip = 'sit'
  }
}

function placeOnBed(state, patient, bed) {
  const trolley = state.trolleys.find((candidate) => candidate.id === bed.trolleyId)
  trolley.patientId = patient.id
  patient.carrier = { type: 'trolley', id: trolley.id }
  patient.bedId = bed.id
  bed.patientId = patient.id
  bed.state = 'occupied'
  bed.reservedFor = null
  bed.curtain = 0.15 + state.random() * 0.5
}

// ---------- queries used by the scene and dashboard ----------

export const byId = (list, id) => list.find((item) => item.id === id)

export function patientPose(state, patient) {
  const carrier = patient.carrier
  if (!carrier) return null
  if (patient.transfer) {
    const transfer = patient.transfer
    const t = Math.min(1, transfer.t)
    const eased = t * t * (3 - 2 * t)
    return { x: transfer.from.x + (transfer.to.x - transfer.from.x) * eased, y: transfer.from.y + (transfer.to.y - transfer.from.y) * eased + Math.sin(t * Math.PI) * 0.12, z: transfer.from.z + (transfer.to.z - transfer.from.z) * eased, heading: transfer.to.heading, backrest: transfer.to.backrest, onFigure: true }
  }
  if (carrier.type === 'trolley') {
    const trolley = byId(state.trolleys, carrier.id)
    if (!trolley || trolley.hidden) return null
    return { x: trolley.position.x, y: DECK_HEIGHT[trolley.model], z: trolley.position.z, heading: trolley.heading, backrest: trolley.backrest, onFigure: true }
  }
  if (carrier.type === 'room') {
    const room = byId(state.rooms, carrier.id)
    return roomPatientPose(room)
  }
  if (carrier.type === 'person') {
    const person = byId(state.people, carrier.id)
    if (!person || person.hidden) return null
    return { x: person.position.x, y: 0, z: person.position.z, heading: person.heading, onFigure: false }
  }
  return null
}

// Where a patient lies on the CT couch or X-ray table.
export function roomPatientPose(room) {
  if (room.kind === 'ct') return { x: room.x, y: 0.98, z: room.z + 1.75 - room.table * 1.25, heading: Math.PI, backrest: 0, onFigure: true }
  return { x: room.x - 0.35, y: 0.82, z: room.z - 0.25, heading: Math.PI, backrest: 0, onFigure: true }
}

export function stageIndex(patient) {
  let index = 0
  patient.stageAt.forEach((time, stage) => {
    if (time !== null) index = stage
  })
  return index
}

// ---------- people and their jobs ----------

function startJob(person, steps) {
  person.jobs.push(...steps)
}

function walkStep(target, options = {}) {
  return { kind: 'walk', target, options }
}

function runPerson(state, person, dt) {
  const step = person.jobs[0]
  if (!step) {
    person.state = 'rest'
    person.clip = person.restClip
    person.clipSpeed = 1
    if (person.restHeading !== undefined) person.heading = person.restHeading
    return
  }
  if (!step.started) {
    step.started = true
    if (step.kind === 'walk') {
      const target = typeof step.target === 'function' ? step.target() : step.target
      step.goal = target
      step.points = step.options.direct ? [...step.options.direct, { x: target.x, z: target.z }] : route(state.layout, person.position, target, step.options)
    }
    if (step.kind === 'call') step.done = step.run() !== false
  }
  let finished = false
  switch (step.kind) {
    case 'walk': {
      person.state = 'walk'
      person.clip = 'walk'
      person.clipSpeed = 1
      finished = moveAlong(person, step.points, WALK_SPEED * dt)
      person.heading = person.motionHeading ?? person.heading
      if (finished && step.goal.heading !== undefined) person.heading = step.goal.heading
      break
    }
    case 'wait': {
      person.state = 'work'
      person.clip = step.clip ?? 'idle'
      person.clipSpeed = 1
      if (step.heading !== undefined) person.heading = step.heading
      step.elapsed = (step.elapsed ?? 0) + dt
      finished = step.elapsed >= step.seconds
      break
    }
    case 'until': {
      person.state = 'work'
      if (step.clip) person.clip = step.clip
      finished = step.test()
      break
    }
    case 'call':
      finished = true
      break
    case 'convoy':
      person.state = 'convoy'
      finished = step.convoy.done
      break
    default:
      finished = true
  }
  if (finished) {
    const index = person.jobs.indexOf(step)
    if (index >= 0) person.jobs.splice(index, 1)
  }
}

// ---------- convoys: a trolley moved by one or two people ----------

// Legs: { points, mode: 'pull' | 'push', headFirst }. Pull legs back a trolley out of a bay with the
// pusher in front walking backwards; push legs have the pusher behind; headFirst legs end in a bay.
function createConvoy(state, trolley, pusher, leader, legs, speed) {
  const convoy = { id: `${trolley.id}-CV${state.clock.toFixed(1)}`, trolleyId: trolley.id, pusherId: pusher.id, leaderId: leader?.id ?? null, legs, leg: 0, pause: 0, pauseLength: 0, done: false, speed, direction: null, orbit: false }
  state.convoys.push(convoy)
  pusher.jobs.unshift({ kind: 'convoy', convoy })
  if (leader) leader.jobs.unshift({ kind: 'convoy', convoy })
  return convoy
}

function legDirection(trolley, leg) {
  const target = leg.points[0]
  return Math.atan2(target.x - trolley.position.x, target.z - trolley.position.z)
}

function approachPoint(person, desired, maxDistance) {
  const deltaX = desired.x - person.position.x
  const deltaZ = desired.z - person.position.z
  const length = Math.hypot(deltaX, deltaZ)
  if (length <= maxDistance) {
    person.position.x = desired.x
    person.position.z = desired.z
  } else {
    person.position.x += (deltaX / length) * maxDistance
    person.position.z += (deltaZ / length) * maxDistance
  }
}

function stepConvoy(state, convoy, dt) {
  const trolley = byId(state.trolleys, convoy.trolleyId)
  const pusher = byId(state.people, convoy.pusherId)
  const leader = convoy.leaderId && byId(state.people, convoy.leaderId)
  const leg = convoy.legs[convoy.leg]
  let moving = false
  if (convoy.direction === null) convoy.direction = legDirection(trolley, leg)
  if (convoy.pause > 0) {
    convoy.pause -= dt
    const upcoming = legDirection(trolley, leg)
    const target = leg.mode === 'pull' ? trolley.heading : leg.headFirst ? upcoming : upcoming + Math.PI
    trolley.heading = turnToward(trolley.heading, target, dt * 3.2)
    convoy.direction = turnToward(convoy.direction, upcoming, dt * 3.2)
  } else {
    const finished = moveAlong(trolley, leg.points, convoy.speed * dt)
    moving = true
    const motion = trolley.motionHeading ?? convoy.direction
    convoy.direction = turnToward(convoy.direction, motion, dt * 3.5)
    if (leg.mode !== 'pull') trolley.heading = turnToward(trolley.heading, leg.headFirst ? motion : motion + Math.PI, dt * 2.6)
    if (finished) {
      const next = convoy.legs[convoy.leg + 1]
      convoy.leg++
      if (!next) convoy.done = true
      else {
        convoy.orbit = leg.mode === 'pull' && next.mode === 'push'
        const needsTurn = Math.abs(wrapAngle(trolley.heading - (next.headFirst ? legDirection(trolley, next) : legDirection(trolley, next) + Math.PI))) > 0.6
        convoy.pauseLength = convoy.orbit || needsTurn ? 1.3 : 0
        convoy.pause = convoy.pauseLength
      }
    }
  }
  const direction = convoy.direction
  const along = { x: Math.sin(direction), z: Math.cos(direction) }
  const side = { x: along.z, z: -along.x }
  const halfLength = trolley.model === 'stretcher_cot' ? 1.2 : 1.1
  const currentLeg = convoy.legs[Math.min(convoy.leg, convoy.legs.length - 1)]
  const pulling = currentLeg.mode === 'pull' && convoy.pause <= 0
  // Pusher: in front while pulling, walking round the side when switching, behind while pushing.
  let angle = pulling ? 0 : Math.PI
  if (convoy.pause > 0 && convoy.orbit) angle = Math.PI * (1 - convoy.pause / convoy.pauseLength)
  const offset = halfLength + 0.48
  const pusherSpot = {
    x: trolley.position.x + (along.x * Math.cos(angle) + side.x * Math.sin(angle)) * offset,
    z: trolley.position.z + (along.z * Math.cos(angle) + side.z * Math.sin(angle)) * offset,
  }
  approachPoint(pusher, pusherSpot, Math.max(3 * dt, convoy.speed * dt * 1.6))
  if (convoy.pause > 0 && convoy.orbit) {
    pusher.clip = 'walk'
    pusher.clipSpeed = 0.8
    pusher.heading = direction + angle + Math.PI / 2
  } else if (pulling) {
    pusher.clip = 'push_bed'
    pusher.clipSpeed = -0.8
    pusher.heading = direction + Math.PI
  } else {
    pusher.clip = moving ? 'push_bed' : 'idle'
    pusher.clipSpeed = convoy.speed / 1.0
    pusher.heading = direction
  }
  if (leader) {
    const intoBay = currentLeg.headFirst && convoy.leg === convoy.legs.length - 1
    const leaderSpot = intoBay
      ? { x: trolley.position.x + side.x * 0.95 + along.x * 0.2, z: trolley.position.z + side.z * 0.95 + along.z * 0.2 }
      : pulling
        ? { x: trolley.position.x - along.x * (halfLength + 0.5), z: trolley.position.z - along.z * (halfLength + 0.5) }
        : { x: trolley.position.x + along.x * (halfLength + 0.55), z: trolley.position.z + along.z * (halfLength + 0.55) }
    approachPoint(leader, leaderSpot, Math.max(3 * dt, convoy.speed * dt * 1.6))
    leader.clip = moving ? 'walk' : 'idle'
    leader.clipSpeed = convoy.speed / WALK_SPEED
    leader.heading = pulling ? direction : direction
  }
}

// Legs from a bay (trolley at its bed spot) out to the corridor, then on to `to`.
function legsFromBay(state, bed, to, options = {}) {
  const bay = bed.bay
  const out = [{ x: bay.front.x, z: bay.front.z }]
  const onward = route(state.layout, bay.front, to, options)
  return [
    { mode: 'pull', points: out },
    { mode: 'push', points: onward, headFirst: false },
  ]
}

// Legs into a bay from anywhere: route to the bay front, then head first onto the bed spot.
function legsIntoBay(state, from, bed, options = {}) {
  const bay = bed.bay
  const approach = { x: bay.front.x, z: bay.front.z + 1.6 * bay.out }
  return [
    { mode: 'push', points: route(state.layout, from, approach, options), headFirst: false },
    { mode: 'push', points: [{ x: bay.front.x, z: bay.front.z }, { x: bay.bedAt.x, z: bay.bedAt.z }], headFirst: true },
  ]
}

// Cot legs: head first all the way, stopping at the bay front so the patient slides across.
function cotLegs(state, start, bed) {
  const bay = bed.bay
  const approach = { x: bay.front.x, z: bay.front.z + 1.6 * bay.out }
  return [
    { mode: 'push', points: [...start, ...route(state.layout, start[start.length - 1], approach)], headFirst: true },
    { mode: 'push', points: [{ x: bay.front.x, z: bay.front.z }], headFirst: true },
  ]
}

// ---------- department logic ----------

const isFree = (person) => person.jobs.length === 0 && !person.hidden && !person.fixed && !person.reserved

function freeBedFor(state, level) {
  const free = state.beds.filter((bed) => bed.state === 'free' && !bed.reservedFor)
  if (level <= 2) return free.find((bed) => bed.kind === 'resus') ?? free.find((bed) => bed.kind === 'cubicle')
  return free.find((bed) => bed.kind === 'cubicle') ?? null
}

function freeSeat(state) {
  const taken = new Set(state.people.filter((person) => person.seatId && !person.hidden).map((person) => person.seatId))
  const reserved = new Set(state.patients.filter((patient) => patient.seatId && !patient.gone).map((patient) => patient.seatId))
  const free = state.layout.seats.filter((seat) => !taken.has(seat.id) && !reserved.has(seat.id))
  return free.length ? pick(state.random, free) : null
}

function spawnWalkIn(state) {
  const seat = freeSeat(state)
  if (!seat) return
  const { walkIn } = state.layout
  const patient = createPatient(state, 'walk-in')
  patient.seatId = seat.id
  const person = createPerson(state, 'Patient', 'visitor', { ...walkIn.street, heading: Math.PI }, { patientId: patient.id, restClip: 'sit', task: 'Arriving on foot' })
  patient.carrier = { type: 'person', id: person.id }
  startJob(person, [
    walkStep(walkIn.kiosk, { direct: [walkIn.outside, walkIn.inside] }),
    { kind: 'wait', seconds: 3, clip: 'idle', heading: walkIn.kiosk.heading },
    walkStep(seat, { approach: seatApproach(state.layout, seat) }),
    { kind: 'call', run: () => (person.task = 'Waiting room') },
  ])
  person.seatId = seat.id
  person.restHeading = seat.heading
  addEvent(state, 'walk', 'info', `${patient.id} arrived on foot`, patient.id)
}

function seatedPerson(state, patient) {
  const person = patient.carrier?.type === 'person' && byId(state.people, patient.carrier.id)
  return person && person.jobs.length === 0 ? person : null
}

function runTriage(state) {
  for (const desk of state.layout.triageDesks) {
    if (desk.patientId) continue
    const waiting = state.patients.filter((patient) => patient.needs === 'triage' && patient.mode === 'walk-in' && seatedPerson(state, patient)).sort((a, b) => a.stageAt[0] - b.stageAt[0])[0]
    if (!waiting) continue
    const person = seatedPerson(state, waiting)
    const seat = byId(state.layout.seats, person.seatId)
    desk.patientId = waiting.id
    waiting.needs = 'in-triage'
    person.task = desk.name
    person.seatId = null
    const nextSeat = freeSeat(state) ?? seat
    startJob(person, [
      walkStep(desk.patientSpot, { exit: [...seatApproach(state.layout, seat)].reverse(), approach: [{ x: desk.x + 1.3, z: state.layout.frontZ }, { x: desk.x + 1.3, z: desk.patientSpot.z }] }),
      { kind: 'wait', seconds: 7 + state.random() * 4, clip: 'idle', heading: desk.patientSpot.heading },
      {
        kind: 'call',
        run: () => {
          waiting.stageAt[1] = state.clock
          waiting.needs = 'bed'
          desk.patientId = null
          person.seatId = nextSeat.id
          waiting.seatId = nextSeat.id
          person.task = 'Waiting for a bed'
          person.restHeading = nextSeat.heading
        },
      },
      walkStep(nextSeat, { approach: seatApproach(state.layout, nextSeat) }),
    ])
  }
}

function runBedding(state) {
  // Ambulance and helicopter patients already on a cot in the department get the next bed.
  if (state.patients.some((patient) => patient.needs === 'handover' && patient.carrier?.type === 'trolley')) return
  const waiting = state.patients
    .filter((patient) => patient.needs === 'bed' && patient.mode === 'walk-in' && seatedPerson(state, patient))
    .sort((a, b) => a.level - b.level || a.stageAt[0] - b.stageAt[0])
  for (const patient of waiting) {
    const bed = freeBedFor(state, patient.level)
    if (!bed) {
      const waitedSeconds = state.clock - patient.stageAt[0]
      if (patient.level >= 4 && waitedSeconds > 320 && state.random() < 0.0004) leaveWithoutBeingSeen(state, patient)
      continue
    }
    const person = seatedPerson(state, patient)
    const seat = byId(state.layout.seats, person.seatId)
    bed.reservedFor = patient.id
    patient.needs = 'to-bed'
    person.seatId = null
    patient.seatId = null
    person.task = `Walking to ${bed.name}`
    startJob(person, [
      walkStep({ ...bed.bay.front, heading: bed.bay.bedAt.heading }, { exit: [...seatApproach(state.layout, seat)].reverse() }),
      {
        kind: 'call',
        run: () => {
          person.hidden = true
          person.removed = true
          placeOnBed(state, patient, bed)
          patient.needs = 'doctor'
        },
      },
    ])
  }
}

function leaveWithoutBeingSeen(state, patient) {
  const person = seatedPerson(state, patient)
  const seat = byId(state.layout.seats, person.seatId)
  const { walkIn } = state.layout
  patient.needs = 'left'
  patient.outcome = 'left'
  person.seatId = null
  patient.seatId = null
  person.task = 'Left without being seen'
  state.counters.lwbs++
  addEvent(state, 'warning', 'bad', `${patient.id} left without being seen`, patient.id)
  startJob(person, [walkStep(walkIn.inside, { exit: [...seatApproach(state.layout, seat)].reverse() }), walkStep(walkIn.street, { direct: [walkIn.outside] }), { kind: 'call', run: () => finishPatient(state, patient, person) }])
}

function finishPatient(state, patient, person = null) {
  patient.gone = true
  patient.carrier = null
  if (person) {
    person.hidden = true
    person.removed = true
  }
}

function doctorSpot(bed) {
  const out = bed.bay.out
  return { x: bed.bay.front.x - 0.75, z: bed.bay.front.z - 0.65 * out, heading: out > 0 ? Math.PI * 0.85 : Math.PI * 0.15 }
}

function runDoctors(state) {
  const needing = state.patients
    .filter((patient) => (patient.needs === 'doctor' || patient.needs === 'decision') && !patient.doctorId && patient.bedId && patient.carrier?.type === 'trolley' && trolleyHome(state, patient))
    .sort((a, b) => a.level - b.level || a.stageAt[0] - b.stageAt[0])
  for (const patient of needing) {
    const doctor = state.people.find((person) => person.role === 'Doctor' && isFree(person))
    if (!doctor) return
    const bed = byId(state.beds, patient.bedId)
    patient.doctorId = doctor.id
    doctor.task = `${patient.needs === 'doctor' ? 'Assessing' : 'Reviewing'} ${patient.id}`
    startJob(doctor, [
      walkStep(doctorSpot(bed)),
      { kind: 'wait', seconds: 6 + state.random() * 3, clip: 'chart' },
      {
        kind: 'call',
        run: () => {
          patient.doctorId = null
          if (patient.needs === 'doctor') {
            patient.stageAt[2] = state.clock
            state.counters.seen++
            if (patient.stageAt[0] > 0) state.counters.doorToDoctor.push((state.clock - patient.stageAt[0]) * 0.25)
            if (state.counters.doorToDoctor.length > 20) state.counters.doorToDoctor.shift()
            patient.needs = patient.tests.some((test) => test.state !== 'done') ? 'tests' : 'decision'
            if (patient.needs === 'decision') patient.stageAt[3] = state.clock
          } else if (patient.needs === 'decision') {
            patient.stageAt[4] = state.clock
            patient.outcome = state.random() < [0, 0.9, 0.7, 0.45, 0.15, 0.06][patient.level] ? 'admit' : 'discharge'
            patient.needs = patient.outcome
          }
          doctor.task = 'Reviewing board'
        },
      },
      walkStep(doctor.home),
    ])
  }
}

const trolleyHome = (state, patient) => {
  const trolley = byId(state.trolleys, patient.carrier.id)
  return trolley && !trolley.moving
}

function runNurses(state) {
  const nurses = () => state.people.filter((person) => person.role === 'Nurse' && isFree(person))
  // Bedside tests first (bloods go to the lab), then cleaning, then rounds.
  for (const patient of state.patients) {
    if (patient.needs !== 'tests' || !patient.bedId || patient.carrier?.type !== 'trolley' || !trolleyHome(state, patient)) continue
    if (patient.tests.some((candidate) => candidate.state === 'transfer' || candidate.state === 'scanning')) continue
    const test = patient.tests.find((candidate) => (candidate.name === 'Bloods' || candidate.name === 'ECG') && candidate.state === 'pending')
    if (!test) continue
    const nurse = nurses()[0]
    if (!nurse) break
    const bed = byId(state.beds, patient.bedId)
    test.state = 'taking'
    nurse.task = `${test.name === 'Bloods' ? 'Taking bloods' : 'Recording ECG'}, ${patient.id}`
    const steps = [walkStep({ ...bed.bay.nurseSpot, heading: -Math.PI / 2 }), { kind: 'wait', seconds: 5, clip: 'chart' }]
    if (test.name === 'Bloods') {
      const lab = state.rooms.find((room) => room.kind === 'lab')
      steps.push(
        { kind: 'call', run: () => (nurse.task = `Bloods to the lab, ${patient.id}`) },
        walkStep({ x: lab.x + 2.6, z: lab.z + 2.6, heading: Math.PI }),
        { kind: 'wait', seconds: 1.5, clip: 'idle' },
        {
          kind: 'call',
          run: () => {
            test.state = 'running'
            state.labQueue.push({ patientId: patient.id, readyAt: state.clock + 18 })
          },
        },
      )
    } else steps.push({ kind: 'call', run: () => (test.state = 'done') })
    steps.push({ kind: 'call', run: () => (nurse.task = 'Nurses station') }, walkStep(nurse.home))
    startJob(nurse, steps)
  }
  for (const bed of state.beds) {
    if (bed.state !== 'cleaning' || bed.cleanerId) continue
    const nurse = nurses()[0]
    if (!nurse) break
    bed.cleanerId = nurse.id
    nurse.task = `Turning over ${bed.name}`
    startJob(nurse, [
      walkStep({ ...bed.bay.nurseSpot, heading: -Math.PI / 2 }),
      { kind: 'wait', seconds: 7, clip: 'chart' },
      {
        kind: 'call',
        run: () => {
          bed.state = 'free'
          bed.cleanerId = null
          nurse.task = 'Nurses station'
        },
      },
      walkStep(nurse.home),
    ])
  }
  const idle = nurses()
  if (idle.length > 2 && state.random() < 0.004) {
    const occupied = state.beds.filter((bed) => bed.state === 'occupied' && bed.patientId)
    if (occupied.length) {
      const bed = pick(state.random, occupied)
      const nurse = idle[0]
      nurse.task = `Obs round, ${bed.name}`
      startJob(nurse, [walkStep({ ...bed.bay.nurseSpot, heading: -Math.PI / 2 }), { kind: 'wait', seconds: 4, clip: 'chart' }, { kind: 'call', run: () => (nurse.task = 'Nurses station') }, walkStep(nurse.home)])
    }
  }
}

function runLab(state, dt) {
  for (const item of state.labQueue) {
    if (state.clock < item.readyAt) continue
    const patient = byId(state.patients, item.patientId)
    const test = patient?.tests.find((candidate) => candidate.name === 'Bloods')
    if (test) test.state = 'done'
    item.done = true
  }
  state.labQueue = state.labQueue.filter((item) => !item.done)
  const lab = state.rooms.find((room) => room.kind === 'lab')
  lab.busyFor = state.labQueue.length
  lab.rotor = (lab.rotor ?? 0) + dt * (state.labQueue.length ? 2.4 : 0.5)
}

function porters(state) {
  return state.people.filter((person) => person.role === 'Porter' && isFree(person))
}

function runImaging(state) {
  for (const patient of state.patients) {
    if (patient.needs !== 'tests' || patient.carrier?.type !== 'trolley' || !trolleyHome(state, patient)) continue
    const test = patient.tests.find((candidate) => (candidate.name === 'CT' || candidate.name === 'X-ray') && candidate.state === 'pending')
    if (!test || patient.tests.some((candidate) => candidate.state === 'taking')) continue
    const room = state.rooms.find((candidate) => candidate.kind === (test.name === 'CT' ? 'ct' : 'xray') && !candidate.reservedBy)
    if (!room) continue
    const porter = porters(state)[0]
    if (!porter) return
    const bed = byId(state.beds, patient.bedId)
    const trolley = byId(state.trolleys, bed.trolleyId)
    room.reservedBy = patient.id
    test.state = 'transfer'
    porter.task = `${patient.id} to ${room.name}`
    trolley.moving = true
    startJob(porter, [
      walkStep({ ...bed.bay.front, heading: bed.bay.bedAt.heading }),
      {
        kind: 'call',
        run: () => {
          createConvoy(state, trolley, porter, null, legsFromBay(state, bed, room.parkAt), PUSH_SPEED)
        },
      },
      {
        kind: 'call',
        run: () => {
          patient.transfer = { from: patientPose(state, patient), to: { ...roomPatientPose({ ...room, table: 0 }) }, t: 0 }
          patient.carrier = { type: 'room', id: room.id }
          room.patientId = patient.id
          room.phase = 'loading'
          room.timer = 0
          test.state = 'scanning'
          porter.task = `Waiting at ${room.name}`
        },
      },
      { kind: 'until', clip: 'idle', test: () => room.phase === 'done' },
      {
        kind: 'call',
        run: () => {
          const pose = patientPose(state, patient)
          patient.carrier = { type: 'trolley', id: trolley.id }
          patient.transfer = { from: pose, to: { x: trolley.position.x, y: DECK_HEIGHT.stretcher_ed, z: trolley.position.z, heading: trolley.heading, backrest: trolley.backrest }, t: 0 }
          room.patientId = null
          room.phase = null
          room.reservedBy = null
          room.scansToday++
          test.state = 'done'
          porter.task = `${patient.id} back to ${bed.name}`
        },
      },
      { kind: 'wait', seconds: 1.4, clip: 'idle' },
      {
        kind: 'call',
        run: () => {
          createConvoy(state, trolley, porter, null, legsIntoBay(state, trolley.position, bed), PUSH_SPEED)
        },
      },
      {
        kind: 'call',
        run: () => {
          trolley.moving = false
          porter.task = 'Porter base'
        },
      },
      walkStep(porter.home),
    ])
  }
}

function runRooms(state, dt) {
  for (const room of state.rooms) {
    if (room.kind === 'lab' || !room.phase) {
      room.table = Math.max(0, room.table - dt * 0.4)
      continue
    }
    room.timer += dt
    if (room.phase === 'loading' && room.timer > 1.6) {
      room.phase = 'scanning'
      room.timer = 0
    } else if (room.phase === 'scanning') {
      room.table = room.kind === 'ct' ? Math.min(1, room.timer / 3) * (room.timer < 8 ? 1 : Math.max(0, 1 - (room.timer - 8) / 3)) : Math.min(1, room.timer / 2)
      if (room.timer > (room.kind === 'ct' ? 11.5 : 7)) {
        room.phase = 'done'
        room.table = 0
      }
    }
  }
}

function runOutcomes(state) {
  for (const patient of state.patients) {
    if (patient.gone || patient.carrier?.type !== 'trolley' || !trolleyHome(state, patient)) continue
    const bed = patient.bedId && byId(state.beds, patient.bedId)
    if (!bed) continue
    if (patient.needs === 'discharge') {
      const { walkIn } = state.layout
      patient.needs = 'leaving'
      patient.stageAt[5] = state.clock
      state.counters.discharged++
      const trolley = byId(state.trolleys, bed.trolleyId)
      trolley.patientId = null
      bed.patientId = null
      bed.state = 'cleaning'
      const person = createPerson(state, 'Patient', 'visitor', { ...bed.bay.front, heading: 0 }, { patientId: patient.id, task: 'Discharged, going home' })
      patient.carrier = { type: 'person', id: person.id }
      addEvent(state, 'check', 'ok', `${patient.id} discharged home`, patient.id)
      startJob(person, [walkStep(walkIn.inside), walkStep(walkIn.street, { direct: [walkIn.outside] }), { kind: 'call', run: () => finishPatient(state, patient, person) }])
    }
    if (patient.needs === 'admit') {
      const porter = porters(state)[0]
      if (!porter) continue
      const trolley = byId(state.trolleys, bed.trolleyId)
      const { wardDoor } = state.layout
      patient.needs = 'to-ward'
      trolley.moving = true
      porter.task = `${patient.id} to the ward`
      startJob(porter, [
        walkStep({ ...bed.bay.front, heading: bed.bay.bedAt.heading }),
        {
          kind: 'call',
          run: () => {
            const legs = legsFromBay(state, bed, wardDoor.inside)
            legs.push({ mode: 'push', points: [{ ...wardDoor.outside }], headFirst: false })
            createConvoy(state, trolley, porter, null, legs, PUSH_SPEED)
          },
        },
        {
          kind: 'call',
          run: () => {
            patient.stageAt[5] = state.clock
            state.counters.admitted++
            addEvent(state, 'bed', 'info', `${patient.id} admitted to a ward`, patient.id)
            trolley.hidden = true
            porter.hidden = true
          },
        },
        { kind: 'wait', seconds: 10, clip: 'idle' },
        {
          kind: 'call',
          run: () => {
            finishPatient(state, patient)
            trolley.patientId = null
            bed.patientId = null
            trolley.hidden = false
            porter.hidden = false
            porter.task = `Returning bed to ${bed.name}`
            createConvoy(state, trolley, porter, null, [{ mode: 'push', points: [{ ...wardDoor.inside }], headFirst: false }, ...legsIntoBay(state, wardDoor.inside, bed)], PUSH_SPEED)
          },
        },
        {
          kind: 'call',
          run: () => {
            trolley.moving = false
            bed.state = 'cleaning'
            porter.task = 'Porter base'
          },
        },
        walkStep(porter.home),
      ])
    }
  }
}

// ---------- ambulances ----------

function ambulanceArrivals(state) {
  const bayBusy = state.vehicles.some((vehicle) => vehicle.phase !== 'away' && vehicle.phase !== 'departing')
  if (bayBusy) return
  const due = state.schedule.ambulance[0]
  if (due === undefined || state.clock < due) return
  const vehicle = state.vehicles.find((candidate) => candidate.phase === 'away')
  if (!vehicle) return
  state.schedule.ambulance.shift()
  const paths = state.layout.vehiclePaths
  vehicle.phase = 'arriving'
  vehicle.path = paths.arrive.slice(1).map((point) => ({ ...point }))
  vehicle.position = { ...paths.arrive[0] }
  vehicle.heading = -Math.PI / 2
  vehicle.motionHeading = -Math.PI / 2
  vehicle.timer = 0
  const patient = createPatient(state, 'ambulance')
  patient.carrier = { type: 'vehicle', id: vehicle.id }
  patient.needs = 'handover'
  vehicle.patientId = patient.id
  vehicle.eta = Math.round(pathLength(vehicle.path, vehicle.position) / 8)
  state.counters.ambulances++
  addEvent(state, 'ambulance', patient.level <= 2 ? 'warn' : 'info', `${vehicle.name} inbound, ${TRIAGE[patient.level].short}`, vehicle.id)
}

function stepVehicle(state, vehicle, dt) {
  const paths = state.layout.vehiclePaths
  if (vehicle.phase === 'away') return
  if (vehicle.phase === 'arriving') {
    const remaining = pathLength(vehicle.path, vehicle.position)
    vehicle.speed = Math.min(11, Math.max(2.2, remaining * 0.42))
    const done = moveAlong(vehicle, vehicle.path, vehicle.speed * dt)
    vehicle.heading = turnToward(vehicle.heading, vehicle.motionHeading, dt * 3)
    vehicle.eta = Math.round(remaining / 8)
    if (done) {
      vehicle.phase = 'reversing'
      vehicle.path = paths.reverse.slice(1).map((point) => ({ ...point }))
      addEvent(state, 'swap', 'info', `${vehicle.name} backing into the bay`, vehicle.id)
    }
    return
  }
  if (vehicle.phase === 'reversing') {
    const remaining = pathLength(vehicle.path, vehicle.position)
    vehicle.speed = Math.min(3.4, Math.max(1.3, remaining * 0.8))
    const done = moveAlong(vehicle, vehicle.path, vehicle.speed * dt)
    vehicle.heading = turnToward(vehicle.heading, vehicle.motionHeading + Math.PI, dt * 2.2)
    if (done) {
      vehicle.phase = 'parked'
      vehicle.speed = 0
      vehicle.heading = Math.PI / 2
      vehicle.timer = 0
    }
    return
  }
  if (vehicle.phase === 'parked') {
    vehicle.timer += dt
    vehicle.doors = Math.min(1, vehicle.timer / 0.9)
    if (vehicle.timer > 0.9) unloadAmbulance(state, vehicle)
    return
  }
  if (vehicle.phase === 'handover') {
    vehicle.doors = 1
    return
  }
  if (vehicle.phase === 'closing') {
    vehicle.timer += dt
    vehicle.doors = Math.max(0, 1 - vehicle.timer / 0.9)
    if (vehicle.timer > 1.4) {
      vehicle.phase = 'departing'
      vehicle.path = paths.depart.slice(1).map((point) => ({ ...point }))
    }
    return
  }
  if (vehicle.phase === 'departing') {
    const travelled = vehicle.odometer
    vehicle.speed = Math.min(11, (vehicle.speed || 1) + dt * 2.2)
    const done = moveAlong(vehicle, vehicle.path, vehicle.speed * dt)
    vehicle.heading = turnToward(vehicle.heading, vehicle.motionHeading, dt * 3)
    if (done || travelled > 400) {
      vehicle.phase = 'away'
      vehicle.speed = 0
      vehicle.tripsToday++
    }
  }
}

// The crew roll the cot out of the back, into the department and to a bay (or wait in the
// corridor for one), slide the patient across, and walk the empty cot back.
function unloadAmbulance(state, vehicle) {
  vehicle.phase = 'handover'
  const { ambulanceBay } = state.layout
  const patient = byId(state.patients, vehicle.patientId)
  const cot = byId(state.trolleys, vehicle.cotId)
  const [pusher, leader] = vehicle.crew.map((id) => byId(state.people, id))
  const rear = { x: vehicle.position.x - 3.6, z: vehicle.position.z }
  cot.position = { x: rear.x - 1.3, z: rear.z }
  cot.heading = -Math.PI / 2
  cot.hidden = false
  cot.patientId = patient.id
  patient.carrier = { type: 'trolley', id: cot.id }
  pusher.hidden = false
  leader.hidden = false
  pusher.position = { x: rear.x + 0.1, z: rear.z + 1.7 }
  leader.position = { x: rear.x - 3.2, z: rear.z + 0.4 }
  pusher.task = `Handing over ${patient.id}`
  leader.task = `Handing over ${patient.id}`
  handoverRun(state, vehicle, patient, cot, pusher, leader, { x: rear.x - 1.6, z: rear.z }, [ambulanceBay.inside], () => ({ x: rear.x - 1.0, z: rear.z }))
}

function handoverRun(state, carrierUnit, patient, cot, pusher, leader, entry, entryPath, returnPoint) {
  const { ambulanceBay } = state.layout
  const target = () => freeBedFor(state, patient.level)
  let bed = target()
  if (bed) bed.reservedFor = patient.id
  const start = entryPath.map((point) => ({ ...point }))
  const firstLegs = bed ? cotLegs(state, start, bed) : [{ mode: 'push', points: [...start, { ...ambulanceBay.waitSpot }], headFirst: true }]
  createConvoy(state, cot, pusher, leader, firstLegs, COT_SPEED)
  const afterFirst = [
    { kind: 'until', clip: 'idle', test: () => Boolean(bed || (bed = target())) },
    {
      kind: 'call',
      run: () => {
        if (bed.reservedFor !== patient.id) {
          bed.reservedFor = patient.id
          createConvoy(state, cot, pusher, leader, cotLegs(state, [{ x: cot.position.x, z: cot.position.z }], bed), COT_SPEED)
        }
      },
    },
    {
      kind: 'call',
      run: () => {
        const trolley = byId(state.trolleys, bed.trolleyId)
        patient.transfer = { from: patientPose(state, patient), to: { x: trolley.position.x, y: DECK_HEIGHT.stretcher_ed, z: trolley.position.z, heading: trolley.heading, backrest: trolley.backrest }, t: 0 }
        cot.patientId = null
        placeOnBed(state, patient, bed)
        patient.stageAt[1] = state.clock
        patient.needs = 'doctor'
        addEvent(state, 'bed', 'ok', `${patient.id} handed over in ${bed.name}`, patient.id)
      },
    },
    { kind: 'wait', seconds: 3.2, clip: 'chart' },
    {
      kind: 'call',
      run: () => {
        pusher.task = `${carrierUnit.name}, returning`
        leader.task = `${carrierUnit.name}, returning`
        const back = returnPoint()
        const out = bed.bay.out
        createConvoy(state, cot, pusher, leader, [{ mode: 'pull', points: [{ x: cot.position.x, z: cot.position.z + 1.6 * out }] }, { mode: 'push', points: [...route(state.layout, { x: cot.position.x, z: cot.position.z + 1.6 * out }, ambulanceBay.inside), { ...entry }, ...(back.via ?? []), { x: back.x, z: back.z }], headFirst: false }], COT_SPEED)
      },
    },
    {
      kind: 'call',
      run: () => {
        cot.hidden = true
        pusher.hidden = true
        leader.hidden = true
        carrierUnit.patientId = null
        carrierUnit.phase = carrierUnit.rotor === undefined ? 'closing' : 'crewBack'
        carrierUnit.timer = 0
      },
    },
  ]
  pusher.jobs.push(...afterFirst)
  // The second crew member's convoys are created by the pusher's steps; they just wait meanwhile.
  leader.jobs.push({ kind: 'until', clip: 'idle', test: () => cot.hidden })
}

// ---------- helicopter ----------

function heliApproachPoint(pad, t) {
  const start = { x: pad.x + 170, y: 70, z: pad.z - 130 }
  const control1 = { x: pad.x + 70, y: 48, z: pad.z - 60 }
  const control2 = { x: pad.x + 14, y: 18, z: pad.z - 8 }
  const end = { x: pad.x, y: 13, z: pad.z }
  const u = 1 - t
  const blend = (key) => u * u * u * start[key] + 3 * u * u * t * control1[key] + 3 * u * t * t * control2[key] + t * t * t * end[key]
  return { x: blend('x'), y: blend('y'), z: blend('z') }
}

const APPROACH_SECONDS = 26
const DESCENT_SECONDS = 7

function stepHeli(state, heli, dt) {
  const pad = state.layout.helipad
  heli.rotorAngle += heli.rotor * dt * 30
  if (heli.phase === 'away') {
    heli.rotor = 0
    const due = state.schedule.heli[0]
    if (due !== undefined && state.clock >= due) {
      state.schedule.heli.shift()
      heli.phase = 'approach'
      heli.timer = 0
      heli.rotor = 1
      const patient = createPatient(state, 'air', pick(state.random, [1, 2, 2]))
      patient.needs = 'handover'
      patient.carrier = { type: 'heli', id: heli.id }
      heli.patientId = patient.id
      addEvent(state, 'heli', 'warn', `${heli.name} inbound, ${TRIAGE[patient.level].short}`, heli.id)
    }
    return
  }
  heli.timer += dt
  if (heli.phase === 'approach') {
    const t = Math.min(1, heli.timer / APPROACH_SECONDS)
    const eased = 1 - (1 - t) * (1 - t) * 0.6 - 0.4 * (1 - t)
    const point = heliApproachPoint(pad, Math.min(1, eased))
    const ahead = heliApproachPoint(pad, Math.min(1, eased + 0.02))
    heli.position = point
    if (t < 0.97) heli.heading = Math.atan2(ahead.x - point.x, ahead.z - point.z)
    heli.eta = Math.round(APPROACH_SECONDS + DESCENT_SECONDS - heli.timer)
    if (t >= 1) {
      heli.phase = 'landing'
      heli.timer = 0
    }
    return
  }
  if (heli.phase === 'landing') {
    const t = Math.min(1, heli.timer / DESCENT_SECONDS)
    heli.position = { x: pad.x, y: 13 * (1 - t * t * (3 - 2 * t)), z: pad.z }
    heli.eta = Math.round(DESCENT_SECONDS - heli.timer)
    if (t >= 1) {
      heli.phase = 'landed'
      heli.timer = 0
      heli.touchdownAt = state.clock
      addEvent(state, 'heli', 'info', `${heli.name} landed on the helipad`, heli.id)
    }
    return
  }
  if (heli.phase === 'landed') {
    heli.rotor = Math.max(0.28, 1 - heli.timer / 12)
    heli.doors = Math.min(1, Math.max(0, (heli.timer - 3) / 1.2))
    if (heli.timer > 4.5 && heli.patientId && !heli.crewOut) {
      heli.crewOut = true
      heli.phase = 'handover'
      unloadHeli(state, heli)
    }
    return
  }
  if (heli.phase === 'handover') {
    heli.rotor = Math.max(0.28, heli.rotor - dt / 12)
    return
  }
  if (heli.phase === 'crewBack') {
    heli.doors = Math.max(0, 1 - heli.timer / 1.2)
    heli.rotor = Math.min(1, 0.28 + heli.timer / 6)
    if (heli.timer > 6.5) {
      heli.phase = 'departing'
      heli.timer = 0
    }
    return
  }
  if (heli.phase === 'departing') {
    const climb = Math.min(1, heli.timer / 4)
    const along = Math.max(0, 1 - (heli.timer - 4) / 22)
    heli.position = heli.timer < 4 ? { x: pad.x, y: 13 * climb * climb, z: pad.z } : heliApproachPoint(pad, along)
    if (heli.timer >= 4) {
      const next = heliApproachPoint(pad, Math.max(0, along - 0.02))
      heli.heading = turnToward(heli.heading, Math.atan2(next.x - heli.position.x, next.z - heli.position.z), dt * 1.2)
    }
    if (heli.timer > 26) {
      heli.phase = 'away'
      heli.crewOut = false
      heli.tripsToday++
    }
  }
}

function unloadHeli(state, heli) {
  const pad = state.layout.helipad
  const { ambulanceBay, halfWidth, driveX } = state.layout
  const patient = byId(state.patients, heli.patientId)
  const cot = byId(state.trolleys, heli.cotId)
  const [pusher, leader] = heli.crew.map((id) => byId(state.people, id))
  const back = { x: Math.sin(heli.heading + Math.PI), z: Math.cos(heli.heading + Math.PI) }
  const rear = { x: pad.x + back.x * 3.4, z: pad.z + back.z * 3.4 }
  cot.position = { ...rear }
  cot.heading = heli.heading
  cot.hidden = false
  cot.patientId = patient.id
  patient.carrier = { type: 'trolley', id: cot.id }
  pusher.hidden = false
  leader.hidden = false
  pusher.position = { x: rear.x + back.x * 1.6, z: rear.z + back.z * 1.6 }
  leader.position = { x: rear.x - back.x * 1.6, z: rear.z - back.z * 1.6 }
  pusher.task = `Handing over ${patient.id}`
  leader.task = `Handing over ${patient.id}`
  const walkway = [
    { x: pad.x - 11, z: pad.z + 3 },
    { x: driveX - 5, z: ambulanceBay.doorZ - 6 },
    { x: halfWidth + 2.4, z: ambulanceBay.doorZ - 2.6 },
    { x: halfWidth + 0.6, z: ambulanceBay.doorZ - 0.4 },
    { ...ambulanceBay.inside },
  ]
  handoverRun(state, heli, patient, cot, pusher, leader, { x: halfWidth + 2.4, z: ambulanceBay.doorZ - 2.6 }, walkway, () => ({ x: rear.x, z: rear.z, via: [{ x: driveX - 5, z: ambulanceBay.doorZ - 6 }, { x: pad.x - 11, z: pad.z + 3 }] }))
}

// ---------- step ----------

export function stepSite(state, dt) {
  state.clock += dt
  state.timers.walkIn -= dt
  if (state.timers.walkIn <= 0) {
    state.timers.walkIn = between(state.random, state.site.walkInEvery)
    spawnWalkIn(state)
  }
  ambulanceArrivals(state)
  state.vehicles.forEach((vehicle) => stepVehicle(state, vehicle, dt))
  state.helis.forEach((heli) => stepHeli(state, heli, dt))
  runTriage(state)
  runBedding(state)
  runDoctors(state)
  runNurses(state)
  runImaging(state)
  runOutcomes(state)
  runLab(state, dt)
  runRooms(state, dt)
  state.convoys.forEach((convoy) => stepConvoy(state, convoy, dt))
  state.convoys = state.convoys.filter((convoy) => !convoy.done)
  for (const person of state.people) if (!person.removed) runPerson(state, person, dt)
  for (const patient of state.patients) {
    if (patient.transfer) {
      patient.transfer.t += dt / 1.5
      if (patient.transfer.t >= 1) patient.transfer = null
    }
    if (patient.needs === 'tests' && patient.tests.every((test) => test.state === 'done')) {
      patient.needs = 'decision'
      patient.stageAt[3] = state.clock
    }
  }
  for (const bed of state.beds) {
    const target = bed.state === 'occupied' ? 0.62 : bed.state === 'cleaning' ? 0.1 : 0.05
    bed.curtain += (target - bed.curtain) * Math.min(1, dt * 0.8)
  }
  // Drop people and patients that have left, once nothing refers to them.
  if (Math.floor(state.clock) % 20 === 0 && Math.floor(state.clock - dt) % 20 !== 0) {
    state.people = state.people.filter((person) => !person.removed)
    state.patients = state.patients.filter((patient) => !patient.gone || state.clock - (patient.stageAt[5] ?? patient.stageAt[0]) < 240)
  }
}

export function stageLabel(patient) {
  return STAGES[stageIndex(patient)].label
}
