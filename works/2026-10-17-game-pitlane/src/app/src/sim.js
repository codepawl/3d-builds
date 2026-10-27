// Seeded race-weekend simulation. One state object per circuit holds the track, the cars, the pit boxes with their
// crews, the garages, the marshals and the race log. The 3D view and the dashboard both read it every frame.
import * as THREE from 'three'
import { COMPOUNDS, DRIVERS, GARAGE_TEAMS, LAYOUT, OUR_TEAM, RACE_LAPS, RACE_TIME_SCALE, SITES, TEAMS, garageX, personName } from './data.js'

export function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const lerp = (from, to, amount) => from + (to - from) * amount
const smooth = (amount) => amount * amount * (3 - 2 * amount)

// ---------------------------------------------------------------- paths

// Samples a Catmull-Rom curve every `step` metres. Heading is the y rotation that turns a model's +z along the path.
export function buildPath(points, closed, step = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal')
  const length = curve.getLength()
  const count = Math.max(2, Math.round(length / step))
  const xs = new Float32Array(count + 1)
  const zs = new Float32Array(count + 1)
  const headings = new Float32Array(count + 1)
  for (let index = 0; index <= count; index++) {
    const point = curve.getPointAt(index / count)
    const tangent = curve.getTangentAt(Math.min(index / count, 0.99999))
    xs[index] = point.x
    zs[index] = point.z
    headings[index] = Math.atan2(tangent.x, tangent.z)
  }
  const spacing = length / count
  const path = { length, count, spacing, xs, zs, headings, closed }
  path.at = (distance) => {
    const wrapped = closed ? ((distance % length) + length) % length : clamp(distance, 0, length)
    const position = wrapped / spacing
    const index = Math.min(count - 1, Math.floor(position))
    const fraction = position - index
    let headingDelta = headings[index + 1] - headings[index]
    if (headingDelta > Math.PI) headingDelta -= Math.PI * 2
    if (headingDelta < -Math.PI) headingDelta += Math.PI * 2
    return { x: lerp(xs[index], xs[index + 1], fraction), z: lerp(zs[index], zs[index + 1], fraction), heading: headings[index] + headingDelta * fraction }
  }
  path.nearest = (x, z) => {
    let best = 0
    let bestDistance = Infinity
    for (let index = 0; index <= count; index++) {
      const distance = (xs[index] - x) ** 2 + (zs[index] - z) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    return best * spacing
  }
  return path
}

const TOP_SPEED = 64
const CORNER_GRIP = 26
const BRAKING = 24
const ACCELERATION = 9
const PIT_SPEED = 22

// Speed limit along a closed track from curvature, then smoothed for braking and acceleration.
function speedProfile(track) {
  const { count, spacing, headings } = track
  const limits = new Float32Array(count + 1)
  const window = 6
  for (let index = 0; index <= count; index++) {
    const ahead = headings[(index + window) % count]
    const behind = headings[(index - window + count) % count]
    let turn = Math.abs(ahead - behind)
    if (turn > Math.PI) turn = Math.PI * 2 - turn
    const curvature = turn / (window * 2 * spacing)
    limits[index] = Math.min(TOP_SPEED, Math.sqrt(CORNER_GRIP / Math.max(curvature, 1e-4)))
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let index = count - 1; index >= 0; index--) {
      const next = limits[(index + 1) % count]
      limits[index] = Math.min(limits[index], Math.sqrt(next * next + 2 * BRAKING * spacing))
    }
    for (let index = 1; index <= count; index++) {
      const previous = limits[index - 1]
      limits[index] = Math.min(limits[index], Math.sqrt(previous * previous + 2 * ACCELERATION * spacing))
    }
    limits[0] = Math.min(limits[0], limits[count])
  }
  return (distance) => limits[Math.floor((((distance % track.length) + track.length) % track.length) / spacing)]
}

// ---------------------------------------------------------------- world

function boxSlots(box) {
  const slots = []
  const centerX = box.x
  const centerZ = LAYOUT.boxZ
  slots.push({ role: 'jack_front', x: centerX + 4.75, z: centerZ, heading: -Math.PI / 2 })
  slots.push({ role: 'jack_rear', x: centerX - 3.9, z: centerZ, heading: Math.PI / 2 })
  for (const axle of [1.7, -1.7]) {
    for (const side of [1, -1]) {
      const facing = side > 0 ? Math.PI : 0
      const wheel = `${axle > 0 ? 'f' : 'r'}${side > 0 ? 'l' : 'r'}`
      slots.push({ role: 'gun', wheel, side, axle, x: centerX + axle, z: centerZ + side * 1.62, heading: facing })
      slots.push({ role: 'tyre_off', wheel, side, axle, x: centerX + axle - 0.8, z: centerZ + side * 2.35, heading: facing })
      slots.push({ role: 'tyre_on', wheel, side, axle, x: centerX + axle + 0.85, z: centerZ + side * 2.55, heading: facing })
    }
  }
  slots.push({ role: 'stabiliser', side: 1, x: centerX - 0.2, z: centerZ + 1.5, heading: Math.PI })
  slots.push({ role: 'stabiliser', side: -1, x: centerX - 0.2, z: centerZ - 1.5, heading: 0 })
  return slots
}

const RIVAL_ROLES = new Set(['jack_front', 'jack_rear', 'gun', 'stabiliser'])

function makePerson(state, fields) {
  const person = {
    clip: 'idle',
    clipTime: (state.people.length * 0.37) % 2,
    carry: null,
    tool: null,
    move: null,
    status: 'standby',
    task: '',
    progress: 0,
    y: 0,
    ...fields,
  }
  person.name = personName(state.people.length + state.site.seed)
  person.position = { x: fields.home.x, y: 0, z: fields.home.z }
  person.heading = fields.home.heading
  state.people.push(person)
  return person
}

function moveTo(person, target, speed = 4.6) {
  const distance = Math.hypot(target.x - person.position.x, target.z - person.position.z)
  if (distance < 0.05) {
    person.position.x = target.x
    person.position.z = target.z
    person.heading = target.heading ?? person.heading
    person.move = null
    return
  }
  person.move = { fromX: person.position.x, fromZ: person.position.z, target, elapsed: 0, duration: distance / speed }
}

export function createSiteState(siteId) {
  const site = SITES[siteId]
  const random = seededRandom(site.seed * 977)
  const track = buildPath(site.track, true, 2)
  const speedAt = speedProfile(track)
  const state = {
    site,
    random,
    time: 0,
    track,
    speedAt,
    cars: [],
    boxes: [],
    people: [],
    statics: [],
    stops: [],
    messages: [],
    marshalPosts: [],
    yellow: null,
    nextYellowAt: 26 + random() * 10,
    baseLap: 17,
    weather: { ...site.weather, trend: random() * 6 },
    lapRecord: null,
  }
  state.sFinish = track.nearest(0, LAYOUT.straightZ)
  state.sEntry = track.nearest(LAYOUT.entryX, LAYOUT.straightZ)
  state.sExit = track.nearest(LAYOUT.exitX, LAYOUT.straightZ)
  state.pitSpan = (state.sExit - state.sEntry + track.length) % track.length

  // Garages, boxes and crews.
  for (let index = 0; index < LAYOUT.garageCount; index++) {
    const team = GARAGE_TEAMS[index] ?? null
    const x = garageX(index)
    state.statics.push({ id: `garage_${index}`, type: 'garage', node: `garage_${team ?? 'plain'}`, x, z: LAYOUT.garageZ, heading: Math.PI, team, label: team ? `${TEAMS[team].name} garage` : `Garage ${index + 1}` })
    if (!team) continue
    const box = { id: `box_${team}`, team, x, garageIndex: index, phase: 'idle', carId: null, stopTime: 0, gantry: 'off', crewIds: [], slots: boxSlots({ x }) }
    state.boxes.push(box)
    const roles = box.slots.filter((slot) => team === OUR_TEAM || RIVAL_ROLES.has(slot.role))
    roles.forEach((slot, slotIndex) => {
      const column = slotIndex % 6
      const row = Math.floor(slotIndex / 6)
      const home = { x: x - 4.4 + column * 1.75, z: 23.6 + row * 1.5, heading: Math.PI }
      const model = slotIndex % 2 === 0 ? TEAMS[team].crew : TEAMS[team].crewAlt
      const person = makePerson(state, { id: `${team}_crew_${slotIndex + 1}`, kind: 'crew', team, role: slot.role, model, recolor: TEAMS[team].recolor, boxId: box.id, slot, home })
      box.crewIds.push(person.id)
    })
    state.statics.push({ id: `stand_${team}`, type: 'stand', node: `stand_${team}`, x, z: 2.2, heading: 0, team, label: `${TEAMS[team].name} pit wall stand` })
    state.statics.push({ id: `gantry_${team}`, type: 'gantry', node: 'release_gantry', x: x + 6.6, z: 12.4, heading: -Math.PI / 2, team, label: `${TEAMS[team].short} release lights`, boxId: box.id })
    const racks = ['soft', 'medium', 'hard']
    racks.forEach((compound, rackIndex) => {
      state.statics.push({ id: `rack_${team}_${compound}`, type: 'rack', node: `tyre_rack_${compound}`, x: x - 4.6 + rackIndex * 1.3, z: 19.6, heading: Math.PI, team, compound, label: `${COMPOUNDS[compound].label} tyre rack`, sets: 2 + ((rackIndex + index) % 3) })
    })
    state.statics.push({ id: `stack_${team}_inter`, type: 'rack', node: 'tyre_stack_inter', x: x + 4.3, z: 19.8, heading: 0, team, compound: 'inter', label: 'Intermediate tyre stack', sets: 1 })
    state.statics.push({ id: `stack_${team}_wet`, type: 'rack', node: 'tyre_stack_wet', x: x + 5.2, z: 19.8, heading: 0, team, compound: 'wet', label: 'Wet tyre stack', sets: 1 })
    state.statics.push({ id: `front_jack_${team}`, type: 'jack', node: 'front_jack', x: x + 2.75, z: LAYOUT.boxZ, heading: -Math.PI / 2, team, boxId: box.id, end: 'front', label: 'Front jack' })
    state.statics.push({ id: `rear_jack_${team}`, type: 'jack', node: 'rear_jack', x: x - 2.6, z: LAYOUT.boxZ, heading: Math.PI / 2, team, boxId: box.id, end: 'rear', label: 'Rear jack' })
    // Paddock: a truck behind every team garage and hospitality further back.
    state.statics.push({ id: `truck_${team}`, type: 'truck', node: `truck_${team}`, x: x - 2.4, z: 50, heading: Math.PI, team, label: `${TEAMS[team].short} race transporter` })
    state.statics.push({ id: `truck2_${team}`, type: 'truck', node: `truck_${team}`, x: x + 2.4, z: 50, heading: Math.PI, team, label: `${TEAMS[team].short} parts transporter` })
    if (team !== 'sable') state.statics.push({ id: `hospitality_${team}`, type: 'hospitality', node: `hospitality_${team}`, x: x, z: 72, heading: Math.PI, team, label: `${TEAMS[team].name} hospitality` })
  }
  for (const truckIndex of [0, 1, 2, 9, 10, 11]) {
    const team = ['ostrava', 'kestrel', 'sable'][truckIndex % 3]
    state.statics.push({ id: `truck_extra_${truckIndex}`, type: 'truck', node: `truck_${team}`, x: garageX(truckIndex + 0.5), z: 50, heading: Math.PI, team, label: `Series logistics truck ${truckIndex + 1}` })
  }
  state.statics.push({ id: 'hospitality_series', type: 'hospitality', node: 'hospitality_kestrel', x: garageX(1), z: 72, heading: Math.PI, team: null, label: 'Series paddock club' })
  state.statics.push({ id: 'hospitality_media', type: 'hospitality', node: 'hospitality_ostrava', x: garageX(11), z: 72, heading: Math.PI, team: null, label: 'Media centre' })

  // Our garage: the spare chassis on stands with mechanics, and two tyre runners.
  const ourBox = state.boxes.find((box) => box.team === OUR_TEAM)
  state.spareCar = { id: 'spare', x: ourBox.x + 3, z: LAYOUT.garageZ - 2.5, heading: Math.PI, label: 'Spare chassis T1' }
  const spots = [[1.6, 0.8, -Math.PI / 2], [-1.6, -0.6, Math.PI / 2], [1.6, -1.6, -Math.PI / 2], [-1.3, 2.3, Math.PI * 0.75]]
  spots.forEach(([dx, dz, heading], index) => {
    const home = { x: state.spareCar.x + dx, z: state.spareCar.z + dz, heading }
    makePerson(state, { id: `halvard_mech_${index + 1}`, kind: 'mechanic', team: OUR_TEAM, role: 'mechanic', model: 'mechanic_halvard', home, clip: 'work', status: 'working', task: ['Floor change', 'Brake ducts', 'Gearbox check', 'Setup sheet'][index] })
  })
  for (let index = 0; index < 2; index++) {
    const home = { x: ourBox.x - 4.6 + index * 1.3, z: 20.6, heading: Math.PI }
    makePerson(state, { id: `halvard_runner_${index + 1}`, kind: 'mechanic', team: OUR_TEAM, role: 'mechanic', model: 'mechanic_halvard', home, runner: { from: home, to: { x: ourBox.x - 3.0 + index * 1.4, z: 27.5 + index, heading: 0 }, leg: 0, wait: index * 3 }, status: 'running', task: 'Tyre runs to the blanket ovens' })
  }
  for (const box of state.boxes.filter((candidate) => candidate.team !== OUR_TEAM)) {
    for (let index = 0; index < 2; index++) {
      const home = { x: box.x - 2 + index * 4, z: 27.2, heading: Math.PI * (index ? 0.8 : 1.2) }
      makePerson(state, { id: `${box.team}_mech_${index + 1}`, kind: 'mechanic', team: box.team, role: 'mechanic', model: TEAMS[box.team].crew, recolor: TEAMS[box.team].recolor, home, status: 'standby', task: 'Garage standby' })
    }
  }

  // Marshal posts round the lap, on the outside of the track facing it.
  const postCount = 8
  for (let index = 0; index < postCount; index++) {
    const distance = state.sFinish + track.length * ((index + 0.55) / postCount)
    const point = track.at(distance)
    const normalX = Math.cos(point.heading)
    const normalZ = -Math.sin(point.heading)
    const side = index % 2 === 0 ? 1 : -1
    const offset = 15
    const post = { id: `post_${index + 1}`, type: 'post', node: 'marshal_post', x: point.x + normalX * offset * side, z: point.z + normalZ * offset * side, heading: Math.atan2(-normalX * side, -normalZ * side), s: distance % track.length, turn: index * 2 + 2, flag: 'clear', label: `Marshal post ${index + 1}` }
    state.marshalPosts.push(post)
    state.statics.push(post)
    const home = { x: post.x + Math.sin(post.heading) * 1.6 + Math.cos(post.heading) * 2.6, z: post.z + Math.cos(post.heading) * 1.6 - Math.sin(post.heading) * 2.6, heading: post.heading }
    makePerson(state, { id: `marshal_${index + 1}`, kind: 'marshal', team: null, role: 'marshal', model: 'marshal', home, status: 'standby', task: `Turn ${post.turn} flag point`, postId: post.id })
  }

  state.statics.push({ id: 'safety_car', type: 'roadcar', node: 'safety_car', x: 84, z: LAYOUT.boxZ - 1.2, heading: Math.PI / 2, label: 'Safety car', status: 'standby' })
  state.statics.push({ id: 'medical_car', type: 'roadcar', node: 'medical_car', x: 84, z: LAYOUT.boxZ + 2.6, heading: Math.PI / 2, label: 'Medical car', status: 'standby' })
  ;[-150, -112, 112, 150].forEach((x, index) => {
    state.statics.push({ id: `grandstand_${index + 1}`, type: 'grandstand', node: index === 1 || index === 2 ? 'grandstand_open' : 'grandstand_covered', x, z: -29, heading: 0, label: `Grandstand ${String.fromCharCode(65 + index)}`, capacity: index === 1 || index === 2 ? 2400 : 6800 })
  })

  // Cars spread out round the lap in race order.
  DRIVERS.forEach((driver, index) => {
    const order = [2, 0, 1, 4, 3, 5, 6, 7][index]
    const startTyre = ['medium', 'medium', 'hard', 'soft', 'medium', 'hard', 'soft', 'medium'][index]
    const car = {
      ...driver,
      mode: 'track',
      s: (state.sEntry - 300 - order * 46 + track.length * 4) % track.length,
      u: 0,
      speed: 40,
      lapCount: 0,
      lapStartedAt: -random() * 10,
      lastLap: 90.8 + random() * 1.4,
      bestLap: 90.2 + random(),
      compound: startTyre,
      tyreAge: 6 + Math.floor(random() * 8),
      wear: 20 + random() * 25,
      energy: 60,
      damage: index === 4 ? 4 : index === 6 ? 2 : 0,
      laneOffset: (index % 3 - 1) * 1.6,
      nextStopLap: state.baseLap + [1, 3, 2, 4, 6, 7, 5, 8][index],
      stops: 0,
      lift: 0,
      wheelsOff: false,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      wheelSpin: 0,
      steer: 0,
      drs: false,
      status: 'racing',
      boxCalled: false,
      currentStop: null,
      fittedCompound: startTyre,
      pitTyre: index % 2 === 0 ? 'hard' : 'medium',
    }
    state.cars.push(car)
  })
  // Stops already made earlier in the race.
  const history = [['car11', 8, 'soft', 'hard', 2.61], ['car07', 9, 'soft', 'medium', 2.38], ['car31', 9, 'soft', 'medium', 2.74], ['car22', 11, 'soft', 'medium', 2.52], ['car44', 12, 'medium', 'soft', 2.9]]
  for (const [carId, lap, from, to, duration] of history) {
    const team = state.cars.find((car) => car.id === carId).team
    state.stops.unshift({ id: `stop_${carId}_history_${lap}`, carId, team, lap, from, to, duration, phase: 'done' })
  }
  placeCars(state)
  ranking(state)
  log(state, 'flag', `Green flag at ${site.name}. DRS enabled.`)
  log(state, 'info', `Track ${site.weather.trackTemp.toFixed(1)} °C, rain chance ${site.weather.rain}%`)
  return state
}

function log(state, kind, text) {
  state.messages.unshift({ id: `msg_${state.messages.length}_${Math.round(state.time * 10)}`, kind, text, time: state.time })
  if (state.messages.length > 40) state.messages.pop()
}

// ---------------------------------------------------------------- pit paths

function pitPath(box) {
  const x = box.x
  const lane = LAYOUT.fastLaneZ
  const z = LAYOUT.boxZ
  const entry = buildPath([[LAYOUT.entryX, LAYOUT.straightZ], [-140, -6.4], [-120, -1.6], [-104, 4.2], [-90, lane], [x - 22, lane], [x - 10, lane + 3.2], [x - 4, z - 0.3], [x, z]], false, 0.5)
  const exit = buildPath([[x, z], [x + 4, z - 0.2], [x + 10, z - 3.6], [x + 20, lane], [90, lane], [104, 4.2], [120, -1.6], [140, -6.4], [LAYOUT.exitX, LAYOUT.straightZ]], false, 0.5)
  return { entry, exit }
}

// ---------------------------------------------------------------- stepping

const STOP_DURATION = 2.45

function trackDistance(state, car) {
  const { track } = state
  if (car.mode === 'track') return car.s
  const pitLength = car.pit.entry.length + car.pit.exit.length
  const travelled = car.pitLeg === 'entry' ? car.u : car.pitLeg === 'stop' ? car.pit.entry.length : car.pit.entry.length + car.u
  return (state.sEntry + (travelled / pitLength) * state.pitSpan) % track.length
}

function placeCars(state) {
  for (const car of state.cars) {
    let point
    if (car.mode === 'track') {
      point = state.track.at(car.s)
      let offset = car.laneOffset
      if (car.boxCalled) {
        const toEntry = (state.sEntry - car.s + state.track.length) % state.track.length
        offset *= clamp(toEntry / 120, 0, 1)
      }
      point.x += Math.cos(point.heading) * offset
      point.z -= Math.sin(point.heading) * offset
    } else {
      const path = car.pitLeg === 'exit' ? car.pit.exit : car.pit.entry
      point = path.at(car.u)
    }
    let headingDelta = point.heading - car.heading
    while (headingDelta > Math.PI) headingDelta -= Math.PI * 2
    while (headingDelta < -Math.PI) headingDelta += Math.PI * 2
    car.steer = clamp(headingDelta * 18, -0.35, 0.35)
    car.position.x = point.x
    car.position.z = point.z
    car.heading = point.heading
  }
}

function ranking(state) {
  const { track } = state
  for (const car of state.cars) {
    const relative = (trackDistance(state, car) - state.sFinish + track.length * 4) % track.length
    car.total = car.lapCount * track.length + relative
  }
  const ordered = [...state.cars].sort((a, b) => b.total - a.total)
  const leader = ordered[0]
  ordered.forEach((car, index) => {
    car.racePosition = index + 1
    car.gap = ((leader.total - car.total) / 46) * RACE_TIME_SCALE
    car.interval = index === 0 ? 0 : ((ordered[index - 1].total - car.total) / 46) * RACE_TIME_SCALE
  })
  state.order = ordered.map((car) => car.id)
  state.raceLap = Math.min(RACE_LAPS, state.baseLap + leader.lapCount + 1)
}

function startStop(state, car, box) {
  const stop = { id: `stop_${car.id}_${car.stops + 1}`, carId: car.id, team: car.team, lap: state.baseLap + car.lapCount + 1, callAt: state.time, entryAt: null, stopAt: null, releaseAt: null, exitAt: null, duration: null, from: car.compound, to: car.pitTyre, phase: 'call' }
  state.stops.unshift(stop)
  car.currentStop = stop
  car.boxCalled = true
  box.phase = 'call'
  box.carId = car.id
  box.stop = stop
  for (const personId of box.crewIds) {
    const person = state.people.find((candidate) => candidate.id === personId)
    person.status = 'running'
    person.task = `Out to the box for car ${car.number}`
    person.carry = person.role === 'tyre_on' ? car.pitTyre : null
    person.tool = person.role === 'gun' ? 'gun' : null
    moveTo(person, person.slot, 4.4 + (person.home.x % 1) * 0.3)
  }
  if (car.team === OUR_TEAM) log(state, 'box', `Box, box. Car ${car.number} pits this lap for ${COMPOUNDS[car.pitTyre].label.toLowerCase()}s.`)
}

function stepCars(state, dt) {
  const { track } = state
  const onTrack = state.cars.filter((car) => car.mode === 'track').sort((a, b) => a.s - b.s)
  for (const car of state.cars) {
    const previousTotal = car.mode === 'track' ? car.s : null
    if (car.mode === 'track') {
      let target = state.speedAt(car.s) * car.pace
      if (state.yellow && ((car.s - state.yellow.from + track.length) % track.length) < state.yellow.span) target = Math.min(target, 34)
      if (car.boxCalled) {
        const toEntry = (state.sEntry - car.s + track.length) % track.length
        target = Math.min(target, Math.sqrt(PIT_SPEED * PIT_SPEED + 2 * BRAKING * Math.max(0, toEntry - 4)) + 6)
      }
      const index = onTrack.indexOf(car)
      const ahead = onTrack[(index + 1) % onTrack.length]
      if (ahead && ahead !== car) {
        const gap = (ahead.s - car.s + track.length) % track.length
        if (gap < 14) target = Math.min(target, ahead.speed * 0.98)
      }
      car.speed += clamp(target - car.speed, -BRAKING * 1.4 * dt, ACCELERATION * 1.3 * dt)
      const before = car.s
      car.s = (car.s + car.speed * dt) % track.length
      car.drs = state.speedAt(car.s) >= TOP_SPEED - 0.5 && car.speed > 55 && Math.abs(track.at(car.s).z - LAYOUT.straightZ) < 1
      // Box call half a lap before the pit entry on the lap the stop is due.
      const toEntry = (state.sEntry - car.s + track.length) % track.length
      if (!car.boxCalled && state.baseLap + car.lapCount + 1 >= car.nextStopLap && toEntry < 520 && toEntry > 300) {
        const box = state.boxes.find((candidate) => candidate.team === car.team)
        if (box.phase === 'idle') startStop(state, car, box)
      }
      if (car.boxCalled && ((before - state.sEntry + track.length) % track.length) > track.length - 80 && ((car.s - state.sEntry + track.length) % track.length) < 80) {
        const box = state.boxes.find((candidate) => candidate.team === car.team)
        car.mode = 'pit'
        car.pit = pitPath(box)
        car.pitLeg = 'entry'
        car.u = 0
        car.status = 'pit lane'
        car.currentStop.entryAt = state.time
        car.currentStop.phase = 'entry'
      }
    } else {
      stepPitCar(state, car, dt)
    }
    car.wheelSpin += (car.speed * dt) / 0.355
    // Lap counting on the finish line.
    const relative = (trackDistance(state, car) - state.sFinish + track.length * 4) % track.length
    if (car.lastRelative !== undefined && car.lastRelative > track.length * 0.75 && relative < track.length * 0.25) {
      car.lapCount++
      const lapSeconds = (state.time - car.lapStartedAt) * RACE_TIME_SCALE
      if (car.lapStartedAt > 0) {
        car.lastLap = lapSeconds
        car.bestLap = Math.min(car.bestLap, lapSeconds)
        if (!state.lapRecord || lapSeconds < state.lapRecord.time) {
          state.lapRecord = { carId: car.id, time: lapSeconds }
          if (car.mode === 'track') log(state, 'fast', `Fastest lap: car ${car.number}, ${formatLap(lapSeconds)}`)
        }
      }
      car.lapStartedAt = state.time
      car.tyreAge++
      car.wear = Math.min(96, car.wear + COMPOUNDS[car.compound].wearPerLap * (0.9 + state.random() * 0.2))
    }
    car.lastRelative = relative
    car.energy = clamp(car.energy + (car.speed > 58 ? -7 : car.speed < 30 ? 9 : 1.5) * dt, 8, 100)
    void previousTotal
  }
  placeCars(state)
}

function stepPitCar(state, car, dt) {
  const box = state.boxes.find((candidate) => candidate.team === car.team)
  const stop = car.currentStop
  if (car.pitLeg === 'entry') {
    const path = car.pit.entry
    const remaining = path.length - car.u
    const limitLine = 52
    let target = car.u < limitLine ? Math.sqrt(PIT_SPEED * PIT_SPEED + 2 * BRAKING * Math.max(0, limitLine - car.u)) : PIT_SPEED
    target = Math.min(target, Math.max(1.2, Math.sqrt(2 * 7.5 * Math.max(0, remaining - 0.05))))
    car.speed += clamp(target - car.speed, -BRAKING * 1.4 * dt, ACCELERATION * dt)
    car.u = Math.min(path.length, car.u + car.speed * dt)
    car.status = 'pit lane'
    if (path.length - car.u < 0.02) {
      car.u = path.length
      car.speed = 0
      car.pitLeg = 'stop'
      car.stopClock = 0
      car.stopLength = STOP_DURATION + state.random() * 0.45 + (car.team === OUR_TEAM ? -0.05 : 0.2)
      stop.stopAt = state.time
      stop.phase = 'stop'
      box.phase = 'stop'
      box.stopTime = 0
      box.gantry = 'red'
      car.status = 'stopped'
    }
  } else if (car.pitLeg === 'stop') {
    car.stopClock += dt
    box.stopTime = car.stopClock
    const t = car.stopClock
    const lift = smooth(clamp((t - 0.12) / 0.25, 0, 1)) * (1 - smooth(clamp((t - (car.stopLength - 0.42)) / 0.2, 0, 1)))
    car.lift = lift * 0.075
    car.wheelsOff = t > 0.72 && t < 1.12
    if (t > 0.92 && car.compound !== stop.to) {
      car.compound = stop.to
      car.tyreAge = 0
      car.wear = 0
    }
    if (t >= car.stopLength) {
      stop.releaseAt = state.time
      stop.duration = car.stopLength
      stop.phase = 'release'
      box.gantry = 'green'
      box.phase = 'released'
      box.releasedAt = state.time
      car.pitLeg = 'exit'
      car.u = 0
      car.stops++
      car.status = 'pit exit'
      car.nextStopLap = state.baseLap + car.lapCount + 1 + 6
      car.pitTyre = car.compound === 'hard' ? 'medium' : 'hard'
      if (car.team === OUR_TEAM) log(state, 'stop', `Car ${car.number} stationary ${car.stopLength.toFixed(2)} s, ${COMPOUNDS[stop.from].label} to ${COMPOUNDS[stop.to].label}.`)
      else log(state, 'stop', `${TEAMS[car.team].short} car ${car.number} pits, ${car.stopLength.toFixed(2)} s.`)
    }
  } else {
    const path = car.pit.exit
    const exitLine = path.length - 52
    const target = car.u < exitLine ? PIT_SPEED : PIT_SPEED + (car.u - exitLine) * 0.6
    car.speed += clamp(target - car.speed, -BRAKING * dt, ACCELERATION * 1.6 * dt)
    car.u = Math.min(path.length, car.u + car.speed * dt)
    if (box.gantry === 'green' && state.time - box.releasedAt > 1.4) box.gantry = 'off'
    if (car.u >= path.length - 0.01) {
      car.mode = 'track'
      car.s = state.sExit
      car.boxCalled = false
      car.status = 'racing'
      stop.exitAt = state.time
      stop.phase = 'done'
      car.currentStop = null
    }
  }
}

function stepBoxes(state, dt) {
  for (const box of state.boxes) {
    const crew = box.crewIds.map((id) => state.people.find((person) => person.id === id))
    if (box.phase === 'call' && crew.every((person) => !person.move)) box.phase = 'ready'
    if (box.phase === 'released' && state.time - box.releasedAt > 3.2) {
      box.phase = 'return'
      for (const person of crew) {
        person.carry = null
        person.status = 'running'
        person.task = 'Back to the garage'
        moveTo(person, person.home, 3.2)
      }
    }
    if (box.phase === 'return' && crew.every((person) => !person.move)) {
      box.phase = 'idle'
      box.carId = null
      box.gantry = 'off'
      for (const person of crew) {
        person.tool = null
        person.status = 'standby'
        person.task = 'Waiting in the garage'
      }
    }
    if (box.gantry === 'green' && box.phase !== 'released' && state.time - box.releasedAt > 1.4) box.gantry = 'off'
    if (box.phase === 'stop') {
      const car = state.cars.find((candidate) => candidate.id === box.carId)
      choreograph(state, box, car, crew)
    }
  }
}

// Positions and clip times of a crew during the stationary phase of a stop.
function choreograph(state, box, car, crew) {
  const t = car.stopClock
  const length = car.stopLength
  for (const person of crew) {
    const slot = person.slot
    person.status = 'working'
    if (person.role === 'jack_front' || person.role === 'jack_rear') {
      person.clip = 'jack_up'
      person.clipTime = clamp((t / length) * 2, 0, 1.98)
      person.task = person.role === 'jack_front' ? 'Lifting the nose' : 'Lifting the rear'
      person.progress = clamp(t / length, 0, 1)
      if (person.role === 'jack_front') {
        // Pull the jack clear of the car's exit line once it is down.
        const aside = smooth(clamp((t - (length - 0.36)) / 0.3, 0, 1))
        person.position.x = slot.x - 1.0 * aside
        person.position.z = slot.z + 2.6 * aside
        if (aside > 0) person.task = 'Jack clear'
      }
    } else if (person.role === 'gun') {
      person.clip = 'gun'
      const first = clamp((t - 0.1) / 0.62, 0, 1)
      const second = clamp((t - 1.12) / 0.7, 0, 1)
      person.clipTime = (t < 1.0 ? first : second) * 1.98
      person.task = t < 1.0 ? 'Wheel nut off' : 'Wheel nut on'
      person.progress = clamp(t / 1.85, 0, 1)
    } else if (person.role === 'tyre_off') {
      if (t > 0.72) {
        person.carry = box.stop.from
        const away = smooth(clamp((t - 0.72) / 0.7, 0, 1))
        person.position.x = slot.x - 0.5 * away
        person.position.z = slot.z + slot.side * 1.3 * away
        person.clip = 'carry_tyre'
        person.clipTime = (t * 1.3) % 1
        person.task = 'Old tyre away'
      } else {
        person.clip = 'idle'
        person.task = 'Ready at the wheel'
      }
      person.progress = clamp(t / 1.4, 0, 1)
    } else if (person.role === 'tyre_on') {
      const step = smooth(clamp((t - 0.62) / 0.4, 0, 1)) * (1 - smooth(clamp((t - 1.2) / 0.5, 0, 1)))
      person.position.x = slot.x + (slot.axle + box.x - slot.x + 0.15) * step
      person.position.z = slot.z - slot.side * 0.8 * step
      person.carry = t < 1.12 ? box.stop.to : null
      person.clip = t > 0.62 && t < 1.7 ? 'carry_tyre' : 'idle'
      person.clipTime = (t * 1.3) % 1
      person.task = t < 1.12 ? 'New tyre on' : 'Clear of the car'
      person.progress = clamp(t / 1.2, 0, 1)
    } else {
      person.clip = 'work'
      person.clipTime = (t * 0.9) % 2
      person.task = 'Holding the car level'
      person.progress = clamp(t / length, 0, 1)
    }
  }
}

function stepPeople(state, dt) {
  for (const person of state.people) {
    if (person.move) {
      const move = person.move
      move.elapsed += dt
      const amount = clamp(move.elapsed / move.duration, 0, 1)
      person.position.x = lerp(move.fromX, move.target.x, amount)
      person.position.z = lerp(move.fromZ, move.target.z, amount)
      const heading = Math.atan2(move.target.x - move.fromX, move.target.z - move.fromZ)
      person.heading = heading
      person.clip = person.carry ? 'carry_tyre' : 'run'
      person.clipTime = (person.clipTime + dt) % (person.carry ? 1 : 0.667)
      person.progress = amount
      if (amount >= 1) {
        person.move = null
        person.heading = move.target.heading ?? heading
        person.clip = 'idle'
        if (person.kind === 'crew' && person.status === 'running') {
          person.status = 'ready'
          person.task = 'In position'
        }
      }
      continue
    }
    if (person.runner) {
      const runner = person.runner
      runner.wait -= dt
      person.clip = 'idle'
      person.clipTime = (person.clipTime + dt) % 2
      if (runner.wait <= 0) {
        runner.leg = 1 - runner.leg
        person.carry = runner.leg === 1 ? 'soft' : null
        moveTo(person, runner.leg === 1 ? runner.to : runner.from, 1.6)
        runner.wait = 2.5
      }
      continue
    }
    const box = person.boxId && state.boxes.find((candidate) => candidate.id === person.boxId)
    if (box && box.phase === 'stop') continue
    if (person.kind === 'marshal') {
      const post = state.marshalPosts.find((candidate) => candidate.id === person.postId)
      person.clip = post.flag === 'yellow' ? 'work' : 'idle'
      person.status = post.flag === 'yellow' ? 'alert' : 'standby'
      person.task = post.flag === 'yellow' ? `Showing yellow at turn ${post.turn}` : `Turn ${post.turn} flag point`
    } else if (person.kind === 'mechanic' && person.status === 'working') {
      person.clip = 'work'
      person.progress = (state.time / 40 + person.home.x * 0.07) % 1
    } else if (box && (box.phase === 'ready' || box.phase === 'released' || box.phase === 'call')) {
      person.clip = person.role === 'tyre_on' || (person.role === 'tyre_off' && person.carry) ? 'carry_tyre' : 'idle'
      if (person.clip === 'carry_tyre') person.clipTime = 0.25
    } else {
      person.clip = 'idle'
    }
    if (person.clip !== 'carry_tyre') person.clipTime = (person.clipTime + dt) % 2
  }
}

function stepRaceControl(state, dt) {
  const { track } = state
  if (state.yellow && state.time > state.yellow.until) {
    for (const post of state.marshalPosts) post.flag = 'clear'
    log(state, 'clear', `Track clear at turn ${state.yellow.turn}.`)
    state.yellow = null
    state.nextYellowAt = state.time + 34 + state.random() * 20
  } else if (!state.yellow && state.time > state.nextYellowAt) {
    const post = state.marshalPosts[1 + Math.floor(state.random() * (state.marshalPosts.length - 2))]
    const reason = ['debris on the racing line', 'a car off at the exit', 'a stopped car on the verge', 'oil on the apex'][Math.floor(state.random() * 4)]
    state.yellow = { postId: post.id, turn: post.turn, from: (post.s - 90 + track.length) % track.length, span: 180, until: state.time + 12 }
    post.flag = 'yellow'
    log(state, 'yellow', `Yellow flag at turn ${post.turn}: ${reason}.`)
  }
  const weather = state.weather
  weather.trackTemp = state.site.weather.trackTemp + Math.sin(state.time / 60 + weather.trend) * 1.6
  weather.rain = Math.max(0, Math.round(state.site.weather.rain + Math.sin(state.time / 90 + weather.trend) * 4))
  void dt
}

export function stepSite(state, dt) {
  state.time += dt
  stepCars(state, dt)
  stepBoxes(state, dt)
  stepPeople(state, dt)
  stepRaceControl(state, dt)
  ranking(state)
}

export function createWorld() {
  const sites = {}
  for (const id of Object.keys(SITES)) sites[id] = createSiteState(id)
  return { sites }
}

export function formatLap(seconds) {
  if (!Number.isFinite(seconds)) return '--'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

// Strategy figures for a car: the planned stop lap and the undercut window before it.
export function strategyFor(state, car) {
  const lapNow = state.baseLap + car.lapCount + 1
  const lifeLeft = Math.max(0, 100 - car.wear)
  const lapsLeftOnTyre = Math.floor(lifeLeft / COMPOUNDS[car.compound].wearPerLap)
  return {
    lapNow,
    plannedStopLap: car.nextStopLap,
    undercutOpen: Math.min(car.nextStopLap, Math.max(lapNow, car.nextStopLap - 2)),
    undercutClose: car.nextStopLap,
    lifeLeft,
    lapsLeftOnTyre,
  }
}
