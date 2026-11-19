// Seeded warehouse simulation. No DOM and no three.js: the same seed always gives the same day.
import {
  buildSlots, CARRY_OFFSET, CONVEYOR_TOP, EMPTY_STACK, INBOUND_DOORS, INBOUND_PICK_X, INBOUND_TRAILER_X, LANES, LANE_EXITS,
  LEFT_LANE_X, OUTBOUND_DOORS, OUTBOUND_DROP_Z, OUTBOUND_TRAILER_Z, PARKING_X, PARKING_Z, PICK_LINES, RIGHT_LANE_X,
  STAND_TOP, STATION_LANE_X, FRONT_LANE_Z, BACK_LANE_Z,
} from './layout.js'

export const STEP_SECONDS = 1 / 30
const CASES_PER_PALLET = 12
const FORKLIFT_COUNT = 6
const SKU_COUNT = 3
const TRAVEL_SPEED = 2.6
const REVERSE_SPEED = 1.3
const LIFT_SPEED = 0.7
const ACCELERATION = 1.3
const FOLLOW_LOOKAHEAD = 5.6
const FOLLOW_RADIUS = 2.3
const LANE_BLOCKING_LATERAL = 3
const LANE_CLEAR_RADIUS = 5.5
const CONVEYOR_SPEED = 0.6
const CASE_GAP = 0.72
const PALLET_ROLL_SPEED = 0.7
const MEAN_ORDER_SECONDS = 85
const MEAN_JAM_SECONDS = 600
const JAM_SECONDS = 24
const KPI_WINDOW_SECONDS = 1800
const TRAILER_CAPACITY = 10
const TRAILER_SWAP_SECONDS = 9
const RACK_FILL_TARGET = 0.68

function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function exponential(random, mean) {
  return -Math.log(1 - random()) * mean
}

// ---------- Paths ----------

function pointOnLane(laneId, coordinate) {
  const lane = LANES[laneId]
  const length = Math.hypot(lane.end[0] - lane.start[0], lane.end[1] - lane.start[1])
  const ratio = coordinate / length
  return [lane.start[0] + (lane.end[0] - lane.start[0]) * ratio, lane.start[1] + (lane.end[1] - lane.start[1]) * ratio]
}

function laneDirection(laneId) {
  const lane = LANES[laneId]
  const length = Math.hypot(lane.end[0] - lane.start[0], lane.end[1] - lane.start[1])
  return [(lane.end[0] - lane.start[0]) / length, (lane.end[1] - lane.start[1]) / length]
}

function laneCoordinateOf(laneId, point) {
  const direction = laneDirection(laneId)
  const lane = LANES[laneId]
  return (point[0] - lane.start[0]) * direction[0] + (point[1] - lane.start[1]) * direction[1]
}

// Breadth-first over lanes: which lanes to drive from one lane position to another.
function findLaneRoute(fromLane, fromCoordinate, toLane, toCoordinate) {
  if (fromLane === toLane && toCoordinate >= fromCoordinate - 0.01) return [{ lane: fromLane, enter: fromCoordinate, leave: toCoordinate }]
  const queue = [[{ lane: fromLane, enter: fromCoordinate }]]
  const visited = new Set()
  while (queue.length) {
    const route = queue.shift()
    const current = route[route.length - 1]
    for (const exit of LANE_EXITS[current.lane]) {
      if (exit.at < current.enter - 0.01) continue
      const nextEnter = exit.entry ?? 0
      const key = `${current.lane}>${exit.to}`
      if (visited.has(key)) continue
      visited.add(key)
      const nextRoute = route.slice(0, -1).concat([{ lane: current.lane, enter: current.enter, leave: exit.at }])
      if (exit.to === toLane && toCoordinate >= nextEnter - 0.01) {
        return nextRoute.concat([{ lane: exit.to, enter: nextEnter, leave: toCoordinate }])
      }
      queue.push(nextRoute.concat([{ lane: exit.to, enter: nextEnter }]))
    }
  }
  throw new Error(`no route ${fromLane} ${fromCoordinate} to ${toLane} ${toCoordinate}`)
}

// Rounds every corner of a polyline with a circular arc and samples it densely.
function buildPath(corners, radii, reverse = false) {
  const clean = corners.filter((point, index) => index === 0 || Math.hypot(point[0] - corners[index - 1][0], point[1] - corners[index - 1][1]) > 0.001)
  const points = [clean[0].slice()]
  for (let index = 1; index < clean.length - 1; index++) {
    const previous = clean[index - 1]
    const corner = clean[index]
    const next = clean[index + 1]
    const inLength = Math.hypot(corner[0] - previous[0], corner[1] - previous[1])
    const outLength = Math.hypot(next[0] - corner[0], next[1] - corner[1])
    const inDirection = [(corner[0] - previous[0]) / inLength, (corner[1] - previous[1]) / inLength]
    const outDirection = [(next[0] - corner[0]) / outLength, (next[1] - corner[1]) / outLength]
    const cross = inDirection[0] * outDirection[1] - inDirection[1] * outDirection[0]
    if (Math.abs(cross) < 0.01) {
      points.push(corner.slice())
      continue
    }
    const radius = Math.min(radii[index] ?? 2.4, inLength * 0.98, outLength * 0.98)
    // Right-angle corners only in this building, so the tangent distance equals the radius.
    const entry = [corner[0] - inDirection[0] * radius, corner[1] - inDirection[1] * radius]
    const center = [entry[0] + outDirection[0] * radius, entry[1] + outDirection[1] * radius]
    const startAngle = Math.atan2(entry[1] - center[1], entry[0] - center[0])
    const segments = 10
    for (let segment = 0; segment <= segments; segment++) {
      const angle = startAngle + (Math.sign(cross) * Math.PI * 0.5 * segment) / segments
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius])
    }
  }
  points.push(clean[clean.length - 1].slice())

  const samples = []
  let length = 0
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]
    const end = points[index + 1]
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1])
    if (segmentLength < 0.0001) continue
    const count = Math.max(1, Math.ceil(segmentLength / 0.25))
    for (let part = 0; part < count; part++) {
      const ratio = part / count
      samples.push({ x: start[0] + (end[0] - start[0]) * ratio, z: start[1] + (end[1] - start[1]) * ratio, s: length + segmentLength * ratio })
    }
    length += segmentLength
  }
  const last = points[points.length - 1]
  samples.push({ x: last[0], z: last[1], s: length })
  for (let index = 0; index < samples.length; index++) {
    const ahead = samples[Math.min(index + 1, samples.length - 1)]
    const behind = samples[Math.max(index - 1, 0)]
    samples[index].heading = Math.atan2(ahead.x - behind.x, ahead.z - behind.z) + (reverse ? Math.PI : 0)
  }
  for (let index = 0; index < samples.length; index++) {
    const ahead = samples[Math.min(index + 4, samples.length - 1)]
    const turn = Math.abs(angleDifference(ahead.heading, samples[index].heading))
    samples[index].speedLimit = turn > 0.08 ? 1.25 : 99
  }
  return { samples, length, reverse, gates: [] }
}

function angleDifference(first, second) {
  let difference = first - second
  while (difference > Math.PI) difference -= Math.PI * 2
  while (difference < -Math.PI) difference += Math.PI * 2
  return difference
}

function nearestS(path, point) {
  let best = 0
  let bestDistance = Infinity
  for (const sample of path.samples) {
    const distance = Math.hypot(sample.x - point[0], sample.z - point[1])
    if (distance < bestDistance) {
      bestDistance = distance
      best = sample.s
    }
  }
  return best
}

// A forward drive along lanes, optionally ending with a turn into a spur.
function buildRoutePath(from, toLane, toCoordinate, spurEnd, spurRadius) {
  const route = findLaneRoute(from.lane, from.coordinate, toLane, toCoordinate)
  const corners = [pointOnLane(from.lane, from.coordinate)]
  const radii = {}
  for (const leg of route) {
    const leave = pointOnLane(leg.lane, leg.leave)
    corners.push(leave)
  }
  if (spurEnd) {
    radii[corners.length - 1] = spurRadius
    corners.push(spurEnd)
  }
  const path = buildPath(corners, radii)
  for (let index = 0; index < route.length; index++) {
    const leg = route[index]
    if (!LANES[leg.lane].locked) continue
    const entry = pointOnLane(leg.lane, leg.enter)
    const isFirst = index === 0
    if (!isFirst) path.gates.push({ s: Math.max(0, nearestS(path, entry) - 3.2), acquire: leg.lane })
    const isLast = index === route.length - 1
    if (!isLast) {
      const exit = pointOnLane(leg.lane, leg.leave)
      path.gates.push({ s: nearestS(path, exit) + 3, release: leg.lane })
    }
  }
  path.gates.sort((first, second) => first.s - second.s)
  return path
}

// ---------- Creating the world ----------

export function createSim(seed = 7) {
  const random = createRandom(seed)
  const sim = {
    time: 0,
    random,
    nextId: 1,
    slots: buildSlots(),
    pallets: [],
    cases: [],
    forklifts: [],
    orders: [],
    pendingOrders: [],
    tasks: [],
    locks: {},
    shipped: [],
    nextOrderAt: 2,
    nextInboundAt: 0,
    minimumGap: Infinity,
    totalWaitSeconds: 0,
    events: [],
    lines: PICK_LINES.map((definition) => createLine(definition, random)),
    inbound: INBOUND_DOORS.map((definition) => ({ ...definition, pallets: [], received: 0 })),
    outbound: OUTBOUND_DOORS.map((definition) => ({
      ...definition, pallets: [], loaded: 0, state: 'loading', stateUntil: 0, trailerOffset: 0, reserved: false, trailersSent: 0,
    })),
    emptyStack: { ...EMPTY_STACK, count: 6, reserved: 0 },
  }
  fillRacks(sim)
  for (let index = 0; index < FORKLIFT_COUNT; index++) {
    const parkingIndex = index
    const point = [PARKING_X[parkingIndex], PARKING_Z]
    sim.forklifts.push({
      id: `FL-${index + 1}`,
      x: point[0],
      z: point[1],
      heading: 0,
      lift: 0.1,
      speed: 0,
      previous: { x: point[0], z: point[1], heading: 0, lift: 0.1 },
      steps: [],
      task: null,
      pallet: null,
      lanePosition: null,
      parkingIndex,
      parked: true,
      blockedBy: null,
      laneBlock: null,
      state: 'idle',
      stateLabel: 'Parked, waiting for a job',
      distance: 0,
      moves: 0,
      activePath: null,
      progress: 0,
      waited: 0,
    })
  }
  return sim
}

function createLine(definition, random) {
  return {
    ...definition,
    order: null,
    pickPallet: null,
    packPallet: null,
    retrieving: false,
    returning: false,
    shipPending: false,
    jammedUntil: 0,
    nextJamAt: 180 + exponential(random, MEAN_JAM_SECONDS),
    jams: 0,
    picked: 0,
    packed: 0,
    conveyorCases: [],
    pickGantry: createGantry(definition.pickX, definition.z),
    packGantry: createGantry(definition.packX, definition.z),
    dispenserAt: 0,
  }
}

function createGantry(x, z) {
  return { baseX: x, z, x, y: 2.4, headZ: z, phase: 'idle', phaseTime: 0, heldCase: null, fromPoint: null, toPoint: null }
}

function newPallet(sim, sku, cases, x, y, z, heading = 0) {
  const pallet = { id: sim.nextId++, sku, cases, x, y, z, heading, previous: { x, y, z, heading }, holder: null, order: null }
  sim.pallets.push(pallet)
  return pallet
}

function fillRacks(sim) {
  for (const slot of sim.slots) {
    if (sim.random() > RACK_FILL_TARGET) continue
    const sku = Math.floor(sim.random() * SKU_COUNT)
    const cases = sim.random() < 0.7 ? CASES_PER_PALLET : 6 + Math.floor(sim.random() * 6)
    slot.pallet = newPallet(sim, sku, cases, slot.x, slot.y, slot.z, Math.PI * 0.5)
    slot.pallet.slot = slot
  }
}

// ---------- Forklift step builders ----------

function palletEntryLift(height) {
  return height - 0.16
}
function palletHeldLift(height) {
  return height - 0.06
}
const TRAVEL_LIFT = 0.1

// Steps from wherever the forklift is on a lane into a spur, then the fork work, then backing out onto the lane.
function spurSteps(forklift, spur, work) {
  const steps = []
  const from = forklift.lanePosition
  const laneDirectionVector = laneDirection(spur.lane)
  const corner = spur.laneCorner
  const toCoordinate = laneCoordinateOf(spur.lane, corner)
  const path = buildRoutePath(from, spur.lane, toCoordinate, spur.preEnd, spur.radius)
  steps.push({ type: 'drive', path, label: spur.travelLabel })
  const backEntry = [corner[0] - laneDirectionVector[0] * spur.radius, corner[1] - laneDirectionVector[1] * spur.radius]
  const lateral = Math.hypot(spur.preEnd[0] - corner[0], spur.preEnd[1] - corner[1])
  if (lateral < LANE_BLOCKING_LATERAL) {
    // Followers are held back from the moment the turn starts, so there is room to back out later.
    path.laneBlockAtS = Math.max(0, nearestS(path, backEntry) - 1)
    path.laneBlockPoint = backEntry
  }
  steps.push({ type: 'lift', to: work.approachLift, label: work.liftLabel })
  steps.push({ type: 'drive', path: buildPath([spur.preEnd, spur.placeEnd], {}), label: work.enterLabel })
  steps.push({ type: 'lift', to: work.settleLift, label: work.settleLabel })
  steps.push({ type: 'do', action: work.action })
  steps.push({ type: 'drive', path: buildPath([spur.placeEnd, spur.preEnd], {}, true), label: 'Backing out' })
  steps.push({ type: 'lift', to: TRAVEL_LIFT, label: 'Lowering the mast' })
  steps.push({ type: 'laneClear', point: backEntry, direction: laneDirectionVector, label: 'Waiting to back onto the lane' })
  steps.push({
    type: 'drive',
    path: buildPath([spur.preEnd, corner, backEntry], { 1: spur.radius }, true),
    label: 'Backing out',
    endLane: { lane: spur.lane, coordinate: toCoordinate - spur.radius },
  })
  steps.push({ type: 'do', action: () => { forklift.laneBlock = null } })
  return steps
}

function lastEndLane(steps) {
  return steps.filter((step) => step.endLane).pop().endLane
}

function slotSpur(slot, travelLabel) {
  const laneX = LANES[slot.lane].start[0]
  const placeX = slot.x + slot.approachSign * CARRY_OFFSET
  const preX = placeX + slot.approachSign * 1.2
  return {
    lane: slot.lane,
    laneCorner: [laneX, slot.z],
    preEnd: [preX, slot.z],
    placeEnd: [placeX, slot.z],
    radius: Math.abs(preX - laneX),
    travelLabel,
  }
}

function lineStationSpur(line, travelLabel) {
  const placeX = line.pickX - CARRY_OFFSET
  const preX = placeX - 0.5
  return { lane: 'station', laneCorner: [STATION_LANE_X, line.z], preEnd: [preX, line.z], placeEnd: [placeX, line.z], radius: 2, travelLabel }
}

function packSpur(line, travelLabel) {
  const placeX = line.packX + CARRY_OFFSET
  const preX = placeX + 0.2
  return { lane: 'right', laneCorner: [RIGHT_LANE_X, line.z], preEnd: [preX, line.z], placeEnd: [placeX, line.z], radius: RIGHT_LANE_X - preX, travelLabel }
}

function inboundSpur(door, travelLabel) {
  const placeX = INBOUND_PICK_X + CARRY_OFFSET
  const preX = placeX + 0.25
  return { lane: 'left', laneCorner: [LEFT_LANE_X, door.z], preEnd: [preX, door.z], placeEnd: [placeX, door.z], radius: Math.abs(preX - LEFT_LANE_X), travelLabel }
}

function outboundSpur(door, travelLabel) {
  const placeZ = OUTBOUND_DROP_Z + CARRY_OFFSET
  const preZ = placeZ + 0.3
  return { lane: 'back', laneCorner: [door.x, BACK_LANE_Z], preEnd: [door.x, preZ], placeEnd: [door.x, placeZ], radius: BACK_LANE_Z - preZ, travelLabel }
}

function emptyStackSpur(stack, travelLabel) {
  const placeZ = stack.z - CARRY_OFFSET
  const preZ = placeZ - 0.3
  return { lane: 'front', laneCorner: [stack.x, FRONT_LANE_Z], preEnd: [stack.x, preZ], placeEnd: [stack.x, placeZ], radius: 2, travelLabel }
}

function pickWork(sim, forklift, height, pallet, labels) {
  return {
    approachLift: palletEntryLift(height),
    settleLift: palletHeldLift(height),
    liftLabel: labels.lift,
    enterLabel: labels.enter,
    settleLabel: 'Lifting the pallet clear',
    action: () => attachPallet(sim, forklift, pallet),
  }
}

function dropWork(sim, forklift, height, onDrop, labels) {
  return {
    approachLift: palletHeldLift(height) + 0.1,
    settleLift: palletEntryLift(height),
    liftLabel: labels.lift,
    enterLabel: labels.enter,
    settleLabel: 'Setting the pallet down',
    action: () => {
      const pallet = forklift.pallet
      releasePallet(sim, forklift, height)
      onDrop(pallet)
    },
  }
}

function attachPallet(sim, forklift, pallet) {
  forklift.pallet = pallet
  pallet.holder = forklift
  if (pallet.slot) {
    pallet.slot.pallet = null
    pallet.slot.reserved = false
    pallet.slot = null
  }
  sim.events.push({ time: sim.time, kind: 'grab', x: forklift.x, z: forklift.z, unit: forklift.id })
}

function releasePallet(sim, forklift, height) {
  const pallet = forklift.pallet
  pallet.holder = null
  pallet.y = height
  forklift.pallet = null
  forklift.moves++
  sim.events.push({ time: sim.time, kind: 'drop', x: forklift.x, z: forklift.z, unit: forklift.id })
}

function storeInSlot(pallet, slot) {
  pallet.slot = slot
  pallet.heading = Math.PI * 0.5
  pallet.x = slot.x
  pallet.z = slot.z
  pallet.y = slot.y
  slot.pallet = pallet
  slot.reserved = false
}

// ---------- Tasks ----------

function taskPriority(task) {
  return { ship: 0, clearPick: 1, retrieve: 2, putaway: 3 }[task.kind]
}

function dispatchTasks(sim) {
  if (!sim.tasks.length) return
  sim.tasks.sort((first, second) => taskPriority(first) - taskPriority(second) || first.createdAt - second.createdAt)
  for (const forklift of sim.forklifts) {
    if (forklift.task || !sim.tasks.length) continue
    if (forklift.steps.length && !forklift.parking) continue
    if (forklift.parking && forklift.steps.length) continue
    const task = sim.tasks.shift()
    startTask(sim, forklift, task)
  }
}

function leaveParking(forklift) {
  if (!forklift.parked) return []
  const parkPoint = [forklift.x, forklift.z]
  const corner = [forklift.x, FRONT_LANE_Z]
  const backEntry = [forklift.x - 1.5, FRONT_LANE_Z]
  forklift.parked = false
  const coordinate = laneCoordinateOf('front', backEntry)
  return [
    { type: 'laneClear', point: backEntry, direction: laneDirection('front'), label: 'Waiting to back onto the lane' },
    {
      type: 'drive',
      path: buildPath([parkPoint, corner, backEntry], { 1: 1.5 }, true),
      label: 'Leaving the parking bay',
      endLane: { lane: 'front', coordinate },
    },
    { type: 'do', action: () => { forklift.laneBlock = null } },
  ]
}

function startTask(sim, forklift, task) {
  forklift.task = task
  forklift.parking = false
  const opening = leaveParking(forklift)
  if (opening.length) forklift.lanePosition = opening[1].endLane
  const steps = opening.concat(taskSteps(sim, forklift, task))
  steps.push({ type: 'do', action: () => finishTask(sim, forklift) })
  forklift.steps = steps
}

function taskSteps(sim, forklift, task) {
  if (task.kind === 'putaway') {
    const pallet = task.pallet
    const door = task.door
    const pickSpur = inboundSpur(door, `Heading to ${door.id} for an inbound pallet`)
    const first = spurSteps(forklift, pickSpur, pickWork(sim, forklift, CONVEYOR_TOP, pallet, { lift: 'Lining up with the conveyor', enter: 'Sliding the forks in' }))
    first.splice(4, 0, { type: 'do', action: () => { door.pallets = door.pallets.filter((item) => item !== pallet) } })
    forklift.lanePosition = lastEndLane(first)
    const dropSpur = slotSpur(task.slot, `Putting away, ${task.slot.label}`)
    const second = spurSteps(forklift, dropSpur, dropWork(sim, forklift, task.slot.y, (dropped) => storeInSlot(dropped, task.slot), { lift: `Lifting to ${task.slot.label}`, enter: 'Sliding into the rack' }))
    forklift.lanePosition = lastEndLane(second)
    return first.concat(second)
  }
  if (task.kind === 'retrieve') {
    const slot = task.slot
    const line = task.line
    const first = spurSteps(forklift, slotSpur(slot, `Going to ${slot.label} for order ${task.line.order.id}`), pickWork(sim, forklift, slot.y, slot.pallet, { lift: `Lifting to ${slot.label}`, enter: 'Sliding the forks in' }))
    forklift.lanePosition = lastEndLane(first)
    const second = spurSteps(forklift, lineStationSpur(line, `Taking the pallet to ${line.id}`), dropWork(sim, forklift, STAND_TOP, (pallet) => {
      pallet.x = line.pickX
      pallet.z = line.z
      pallet.heading = Math.PI * 0.5
      line.pickPallet = pallet
      line.retrieving = false
      line.pickGantry.phase = 'idle'
    }, { lift: 'Lining up with the pick stand', enter: 'Rolling onto the stand' }))
    forklift.lanePosition = lastEndLane(second)
    return first.concat(second)
  }
  if (task.kind === 'clearPick') {
    const line = task.line
    const pallet = line.pickPallet
    const first = spurSteps(forklift, lineStationSpur(line, `Clearing the pallet at ${line.id}`), pickWork(sim, forklift, STAND_TOP, pallet, { lift: 'Lining up with the pick stand', enter: 'Sliding the forks in' }))
    first.splice(4, 0, { type: 'do', action: () => { line.pickPallet = null; line.returning = false } })
    forklift.lanePosition = lastEndLane(first)
    let second
    if (task.slot) {
      second = spurSteps(forklift, slotSpur(task.slot, `Returning to ${task.slot.label}`), dropWork(sim, forklift, task.slot.y, (dropped) => storeInSlot(dropped, task.slot), { lift: `Lifting to ${task.slot.label}`, enter: 'Sliding into the rack' }))
    } else {
      const stack = sim.emptyStack
      second = spurSteps(forklift, emptyStackSpur(stack, 'Taking the empty pallet to the stack'), dropWork(sim, forklift, STAND_TOP + Math.min(stack.count, 9) * 0.14, (dropped) => {
        stack.count++
        removePallet(sim, dropped)
      }, { lift: 'Lining up with the stack', enter: 'Sliding over the stack' }))
    }
    forklift.lanePosition = lastEndLane(second)
    return first.concat(second)
  }
  if (task.kind === 'ship') {
    const line = task.line
    const door = task.door
    const pallet = line.packPallet
    const first = spurSteps(forklift, packSpur(line, `Collecting order ${pallet.order.id}`), pickWork(sim, forklift, STAND_TOP, pallet, { lift: 'Lining up with the pack stand', enter: 'Sliding the forks in' }))
    first.splice(4, 0, { type: 'do', action: () => { line.packPallet = null; line.shipPending = false; line.dispenserAt = sim.time + 4 } })
    forklift.lanePosition = lastEndLane(first)
    const second = spurSteps(forklift, outboundSpur(door, `Loading order ${pallet.order.id} at ${door.id}`), dropWork(sim, forklift, CONVEYOR_TOP, (dropped) => {
      dropped.x = door.x
      dropped.z = OUTBOUND_DROP_Z
      dropped.heading = 0
      door.pallets.push(dropped)
      door.reserved = false
    }, { lift: 'Lining up with the dock conveyor', enter: 'Rolling onto the conveyor' }))
    forklift.lanePosition = lastEndLane(second)
    return first.concat(second)
  }
  throw new Error(`unknown task ${task.kind}`)
}

function removePallet(sim, pallet) {
  const index = sim.pallets.indexOf(pallet)
  if (index >= 0) sim.pallets.splice(index, 1)
}

function finishTask(sim, forklift) {
  forklift.task = null
  const next = nextTaskFor(sim)
  if (next) {
    startTask(sim, forklift, next)
    return
  }
  goPark(sim, forklift)
}

function nextTaskFor(sim) {
  if (!sim.tasks.length) return null
  sim.tasks.sort((first, second) => taskPriority(first) - taskPriority(second) || first.createdAt - second.createdAt)
  return sim.tasks.shift()
}

function goPark(sim, forklift) {
  const taken = new Set(sim.forklifts.filter((other) => other !== forklift && other.parkingIndex !== null).map((other) => other.parkingIndex))
  let index = forklift.parkingIndex
  if (index === null || taken.has(index)) {
    index = PARKING_X.findIndex((_, candidate) => !taken.has(candidate))
  }
  forklift.parkingIndex = index
  const x = PARKING_X[index]
  const corner = [x, FRONT_LANE_Z]
  forklift.parking = true
  const path = buildRoutePath(forklift.lanePosition, 'front', laneCoordinateOf('front', corner), [x, PARKING_Z], 1.8)
  forklift.steps = [
    { type: 'drive', path, label: 'Going to park' },
    { type: 'do', action: () => { forklift.parked = true; forklift.parking = false } },
  ]
}

// ---------- Per-step updates ----------

function stepOrders(sim) {
  if (sim.time >= sim.nextOrderAt) {
    sim.nextOrderAt = sim.time + exponential(sim.random, MEAN_ORDER_SECONDS)
    const order = {
      id: 4100 + sim.orders.length,
      sku: Math.floor(sim.random() * SKU_COUNT),
      cases: 4 + Math.floor(sim.random() * 5),
      createdAt: sim.time,
      shippedAt: null,
      state: 'queued',
    }
    sim.orders.push(order)
    sim.pendingOrders.push(order)
    sim.events.push({ time: sim.time, kind: 'order', order: order.id })
  }
  for (const line of sim.lines) {
    if (line.order || line.retrieving || line.pickPallet || line.returning) continue
    if (!sim.pendingOrders.length) continue
    const order = sim.pendingOrders[0]
    const candidates = sim.slots.filter((slot) => slot.pallet && !slot.reserved && slot.pallet.sku === order.sku && slot.pallet.cases > 0)
    if (!candidates.length) continue
    candidates.sort((first, second) => second.pallet.cases - first.pallet.cases || first.level - second.level)
    const slot = candidates[Math.floor(sim.random() * Math.min(candidates.length, 4))]
    sim.pendingOrders.shift()
    order.cases = Math.min(order.cases, slot.pallet.cases)
    order.state = 'retrieving'
    order.line = line.id
    slot.reserved = true
    line.order = order
    line.retrieving = true
    line.picked = 0
    line.packed = 0
    sim.tasks.push({ kind: 'retrieve', slot, line, createdAt: sim.time })
  }
}

function pickFreeSlot(sim) {
  const free = sim.slots.filter((candidate) => !candidate.pallet && !candidate.reserved)
  if (!free.length) return null
  return free[Math.floor(sim.random() * free.length)]
}

function stepInbound(sim) {
  const stored = sim.slots.filter((slot) => slot.pallet || slot.reserved).length
  const incoming = sim.inbound.reduce((sum, door) => sum + door.pallets.length, 0)
  const fill = (stored + incoming) / sim.slots.length
  if (sim.time >= sim.nextInboundAt && fill < RACK_FILL_TARGET) {
    sim.nextInboundAt = sim.time + 26
    const door = sim.inbound[Math.floor(sim.random() * sim.inbound.length)]
    if (door.pallets.length < 2) {
      const sku = Math.floor(sim.random() * SKU_COUNT)
      const pallet = newPallet(sim, sku, CASES_PER_PALLET, INBOUND_TRAILER_X, CONVEYOR_TOP, door.z, Math.PI * 0.5)
      door.pallets.push(pallet)
      door.received++
    }
  }
  for (const door of sim.inbound) {
    door.pallets.forEach((pallet, index) => {
      const limit = INBOUND_PICK_X - index * 1.6
      if (pallet.x < limit) pallet.x = Math.min(limit, pallet.x + PALLET_ROLL_SPEED * STEP_SECONDS)
    })
    const head = door.pallets[0]
    if (head && !head.requested && head.x >= INBOUND_PICK_X - 0.001) {
      const slot = pickFreeSlot(sim)
      if (slot) {
        head.requested = true
        slot.reserved = true
        sim.tasks.push({ kind: 'putaway', pallet: head, door, slot, createdAt: sim.time })
      }
    }
  }
}

const CASE_LAYOUT_COUNT = CASES_PER_PALLET

// A case's place on a pallet in pallet space: three layers of two by two.
export function caseOffset(index) {
  const layer = Math.floor(index / 4)
  const inLayer = index % 4
  return { x: (inLayer % 2 === 0 ? -0.25 : 0.25), y: 0.14 + layer * 0.262, z: inLayer < 2 ? -0.27 : 0.27 }
}

function gantryMove(gantry, toPoint, duration, nextPhase) {
  gantry.fromPoint = { x: gantry.x, y: gantry.y, z: gantry.headZ }
  gantry.toPoint = toPoint
  gantry.phaseDuration = duration
  gantry.phaseTime = 0
  gantry.nextPhase = nextPhase
  gantry.phase = 'moving'
}

function advanceGantry(gantry) {
  if (gantry.phase !== 'moving') return false
  gantry.phaseTime += STEP_SECONDS
  const progress = Math.min(1, gantry.phaseTime / gantry.phaseDuration)
  const eased = progress * progress * (3 - 2 * progress)
  gantry.x = gantry.fromPoint.x + (gantry.toPoint.x - gantry.fromPoint.x) * eased
  gantry.y = gantry.fromPoint.y + (gantry.toPoint.y - gantry.fromPoint.y) * eased
  gantry.headZ = gantry.fromPoint.z + (gantry.toPoint.z - gantry.fromPoint.z) * eased
  if (gantry.heldCase) {
    gantry.heldCase.x = gantry.x
    gantry.heldCase.y = gantry.y - 0.27
    gantry.heldCase.z = gantry.headZ
  }
  if (progress >= 1) gantry.phase = gantry.nextPhase
  return true
}

function stepLine(sim, line) {
  if (sim.time >= line.nextJamAt) {
    line.jammedUntil = sim.time + JAM_SECONDS
    line.nextJamAt = line.jammedUntil + exponential(sim.random, MEAN_JAM_SECONDS)
    line.jams++
    sim.events.push({ time: sim.time, kind: 'jam', line: line.id })
  }
  const jammed = sim.time < line.jammedUntil
  stepPickGantry(sim, line, jammed)
  if (!jammed) stepConveyor(line)
  stepPackGantry(sim, line)
  if (!line.packPallet && !line.shipPending && sim.time >= line.dispenserAt) {
    line.packPallet = newPallet(sim, 0, 0, line.packX, STAND_TOP, line.z + 1.7, Math.PI * 0.5)
    line.packPallet.feeding = true
  }
  if (line.packPallet?.feeding) {
    line.packPallet.z += (line.z - line.packPallet.z) * 0.05
    if (Math.abs(line.packPallet.z - line.z) < 0.01) {
      line.packPallet.z = line.z
      line.packPallet.feeding = false
    }
  }
  if (line.order && line.pickPallet && line.picked >= line.order.cases && !line.returning) {
    line.returning = true
    const pallet = line.pickPallet
    const slot = pallet.cases > 0 ? pickFreeSlot(sim) : null
    if (slot) slot.reserved = true
    sim.tasks.push({ kind: 'clearPick', line, slot, createdAt: sim.time })
  }
  if (line.order && line.packed >= line.order.cases && !line.shipPending && line.packPallet && !line.packPallet.feeding) {
    const door = sim.outbound.filter((item) => !item.reserved && item.pallets.length < 2 && item.state === 'loading')[0]
    if (door) {
      door.reserved = true
      line.shipPending = true
      line.packPallet.order = line.order
      line.order.state = 'shipping'
      sim.tasks.push({ kind: 'ship', line, door, createdAt: sim.time })
      line.order = null
    }
  }
}

function stepPickGantry(sim, line, jammed) {
  const gantry = line.pickGantry
  if (advanceGantry(gantry)) return
  const pallet = line.pickPallet
  if (gantry.phase === 'idle' || gantry.phase === 'wait') {
    if (jammed) return
    if (pallet && line.order && line.picked < line.order.cases && pallet.cases > 0 && !line.returning) {
      if (line.conveyorCases.length && line.conveyorCases[line.conveyorCases.length - 1].s < CASE_GAP) return
      const offset = caseOffset(pallet.cases - 1)
      gantryMove(gantry, { x: pallet.x + offset.z, y: 2.3, z: pallet.z + offset.x }, 0.7, 'descend')
      line.order.state = 'picking'
    }
    return
  }
  if (gantry.phase === 'descend') {
    const offset = caseOffset(pallet.cases - 1)
    gantryMove(gantry, { x: gantry.x, y: pallet.y + offset.y + 0.53, z: gantry.headZ }, 0.5, 'grab')
    return
  }
  if (gantry.phase === 'grab') {
    pallet.cases--
    line.picked++
    const free = { id: sim.nextId++, sku: pallet.sku, x: gantry.x, y: gantry.y - 0.27, z: gantry.headZ, heading: 0, order: line.order?.id ?? null }
    sim.cases.push(free)
    gantry.heldCase = free
    gantryMove(gantry, { x: gantry.x, y: 2.3, z: gantry.headZ }, 0.5, 'carry')
    return
  }
  if (gantry.phase === 'carry') {
    gantryMove(gantry, { x: line.conveyorStartX + 0.3, y: 2.3, z: line.z }, 0.7, 'lower')
    return
  }
  if (gantry.phase === 'lower') {
    gantryMove(gantry, { x: gantry.x, y: CONVEYOR_TOP + 0.54, z: line.z }, 0.45, 'place')
    return
  }
  if (gantry.phase === 'place') {
    const free = gantry.heldCase
    gantry.heldCase = null
    free.s = 0.3
    line.conveyorCases.push(free)
    sim.events.push({ time: sim.time, kind: 'placed', x: free.x, z: free.z, unit: line.id })
    gantryMove(gantry, { x: gantry.x, y: 2.3, z: gantry.headZ }, 0.4, 'wait')
  }
}

function stepConveyor(line) {
  const length = line.conveyorEndX - line.conveyorStartX
  for (let index = 0; index < line.conveyorCases.length; index++) {
    const item = line.conveyorCases[index]
    const limit = index === 0 ? length - 0.3 : line.conveyorCases[index - 1].s - CASE_GAP
    item.s = Math.min(limit, item.s + CONVEYOR_SPEED * STEP_SECONDS)
    item.x = line.conveyorStartX + item.s
    item.y = CONVEYOR_TOP
    item.z = line.z
  }
}

function stepPackGantry(sim, line) {
  const gantry = line.packGantry
  if (advanceGantry(gantry)) return
  const head = line.conveyorCases[0]
  const pallet = line.packPallet
  const length = line.conveyorEndX - line.conveyorStartX
  if (gantry.phase === 'idle' || gantry.phase === 'wait') {
    if (head && head.s >= length - 0.31 && pallet && !pallet.feeding && !line.shipPending) {
      gantryMove(gantry, { x: head.x, y: 2.3, z: line.z }, 0.6, 'descend')
    }
    return
  }
  if (gantry.phase === 'descend') {
    gantryMove(gantry, { x: gantry.x, y: CONVEYOR_TOP + 0.54, z: gantry.headZ }, 0.4, 'grab')
    return
  }
  if (gantry.phase === 'grab') {
    const item = line.conveyorCases.shift()
    gantry.heldCase = item
    gantryMove(gantry, { x: gantry.x, y: 2.3, z: gantry.headZ }, 0.4, 'carry')
    return
  }
  if (gantry.phase === 'carry') {
    const offset = caseOffset(pallet.cases)
    gantryMove(gantry, { x: pallet.x + offset.z, y: 2.3, z: pallet.z + offset.x }, 0.6, 'lower')
    return
  }
  if (gantry.phase === 'lower') {
    const offset = caseOffset(pallet.cases)
    gantryMove(gantry, { x: gantry.x, y: pallet.y + offset.y + 0.53, z: gantry.headZ }, 0.45, 'place')
    return
  }
  if (gantry.phase === 'place') {
    const item = gantry.heldCase
    gantry.heldCase = null
    sim.cases.splice(sim.cases.indexOf(item), 1)
    pallet.sku = item.sku
    pallet.cases++
    line.packed++
    gantryMove(gantry, { x: gantry.x, y: 2.3, z: gantry.headZ }, 0.4, 'wait')
  }
}

function stepDocks(sim) {
  for (const door of sim.outbound) {
    if (door.state === 'leaving') {
      door.trailerOffset = Math.min(1, door.trailerOffset + STEP_SECONDS / TRAILER_SWAP_SECONDS)
      if (door.trailerOffset >= 1) {
        door.state = 'arriving'
        door.loaded = 0
        door.trailersSent++
      }
      continue
    }
    if (door.state === 'arriving') {
      door.trailerOffset = Math.max(0, door.trailerOffset - STEP_SECONDS / TRAILER_SWAP_SECONDS)
      if (door.trailerOffset <= 0) door.state = 'loading'
      continue
    }
    door.pallets.forEach((pallet, index) => {
      const limit = OUTBOUND_TRAILER_Z + index * 1.6
      if (pallet.z > limit) pallet.z = Math.max(limit, pallet.z - PALLET_ROLL_SPEED * STEP_SECONDS)
    })
    const head = door.pallets[0]
    if (head && head.z <= OUTBOUND_TRAILER_Z + 0.001) {
      door.pallets.shift()
      removePallet(sim, head)
      door.loaded++
      const order = head.order
      if (order) {
        order.shippedAt = sim.time
        order.state = 'shipped'
        sim.shipped.push(order)
        sim.events.push({ time: sim.time, kind: 'shipped', order: order.id, door: door.id })
      }
      if (door.loaded >= TRAILER_CAPACITY) {
        door.state = 'leaving'
      }
    }
  }
}

function forkliftCenter(forklift) {
  return [forklift.x + Math.sin(forklift.heading) * 0.6, forklift.z + Math.cos(forklift.heading) * 0.6]
}

function currentDrive(forklift) {
  const step = forklift.steps[0]
  return step?.type === 'drive' ? step : null
}

function samplePath(path, s) {
  const samples = path.samples
  const clamped = Math.min(path.length, Math.max(0, s))
  let low = 0
  let high = samples.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (samples[middle].s <= clamped) low = middle
    else high = middle
  }
  const first = samples[low]
  const second = samples[high]
  const span = second.s - first.s
  const ratio = span > 0 ? (clamped - first.s) / span : 0
  return {
    x: first.x + (second.x - first.x) * ratio,
    z: first.z + (second.z - first.z) * ratio,
    heading: first.heading + angleDifference(second.heading, first.heading) * ratio,
    speedLimit: Math.min(first.speedLimit, second.speedLimit),
  }
}

// Leaving an aisle: the back lane has priority, so hold short while anything on it is close to the junction.
function addMergeBlockers(sim, forklift, path, blockers) {
  if (path.reverse) return
  const headingNegativeZ = Math.cos(forklift.heading) < -0.9
  if (!headingNegativeZ || forklift.z > BACK_LANE_Z + 7 || forklift.z < BACK_LANE_Z + 3.4) return
  const ahead = samplePath(path, forklift.progress + 5)
  if (ahead.z > BACK_LANE_Z + 0.5) return
  for (const other of sim.forklifts) {
    if (other === forklift) continue
    const center = forkliftCenter(other)
    if (Math.abs(center[1] - BACK_LANE_Z) > 1.6) continue
    const offset = center[0] - forklift.x
    if (offset > -3 && offset < 9) blockers.add(other)
  }
}

function findBlockers(sim, forklift) {
  const step = currentDrive(forklift)
  if (!step) return new Set()
  const blockers = new Set()
  const path = step.path
  const lookahead = path.reverse ? 2.6 : FOLLOW_LOOKAHEAD
  const direction = path.reverse ? -1 : 1
  for (let offset = 1; offset <= lookahead; offset += 0.8) {
    const sampleS = forklift.progress + offset
    if (sampleS > path.length + (path.reverse ? 0 : 0)) break
    const sample = samplePath(path, sampleS)
    for (const other of sim.forklifts) {
      if (other === forklift) continue
      const center = forkliftCenter(other)
      const gap = Math.hypot(center[0] - sample.x, center[1] - sample.z)
      if (gap < FOLLOW_RADIUS) blockers.add(other)
      if (other.laneBlock && Math.hypot(other.laneBlock[0] - sample.x, other.laneBlock[1] - sample.z) < FOLLOW_RADIUS) blockers.add(other)
    }
  }
  void direction
  addMergeBlockers(sim, forklift, path, blockers)
  return blockers
}

// May this forklift back out onto its lane? Nobody on the lane near that spot, and the lower id goes first at a tie.
function laneIsClear(sim, forklift, step) {
  for (const other of sim.forklifts) {
    if (other === forklift || other.parked) continue
    const center = forkliftCenter(other)
    const offsetX = center[0] - step.point[0]
    const offsetZ = center[1] - step.point[1]
    const distance = Math.hypot(offsetX, offsetZ)
    if (distance > LANE_CLEAR_RADIUS) continue
    // A forklift standing back from the spot is queueing behind this one and will not move first.
    if (other.speed < 0.05 && distance > 3.2) continue
    const lateral = Math.abs(offsetX * step.direction[1] - offsetZ * step.direction[0])
    if (lateral > FOLLOW_RADIUS) continue
    if (other.steps[0]?.type === 'laneClear' && other.id > forklift.id) continue
    return false
  }
  return true
}

// When two forklifts see each other, the one that is less directly ahead of the other yields nothing and goes first.
function hasRightOfWay(forklift, other) {
  const ownCenter = forkliftCenter(forklift)
  const otherCenter = forkliftCenter(other)
  const toOtherX = otherCenter[0] - ownCenter[0]
  const toOtherZ = otherCenter[1] - ownCenter[1]
  const otherAheadOfMe = toOtherX * Math.sin(forklift.heading) + toOtherZ * Math.cos(forklift.heading)
  const meAheadOfOther = -toOtherX * Math.sin(other.heading) - toOtherZ * Math.cos(other.heading)
  if (Math.abs(otherAheadOfMe - meAheadOfOther) > 0.01) return meAheadOfOther > otherAheadOfMe
  return forklift.id < other.id
}

function stepForkliftGates(sim, forklift, path) {
  for (const gate of path.gates) {
    if (gate.done) continue
    if (gate.acquire) {
      if (forklift.progress < gate.s - 4) break
      const holder = sim.locks[gate.acquire]
      if (holder && holder !== forklift.id) {
        // Hold at the gate until the aisle is free.
        return gate.s
      }
      sim.locks[gate.acquire] = forklift.id
      gate.done = true
    } else if (gate.release) {
      if (forklift.progress < gate.s) break
      if (sim.locks[gate.release] === forklift.id) delete sim.locks[gate.release]
      gate.done = true
    }
  }
  return Infinity
}

function stepForklifts(sim) {
  dispatchTasks(sim)
  const blockersByForklift = new Map()
  for (const forklift of sim.forklifts) blockersByForklift.set(forklift, findBlockers(sim, forklift))

  for (const forklift of sim.forklifts) {
    forklift.previous = { x: forklift.x, z: forklift.z, heading: forklift.heading, lift: forklift.lift }
    if (forklift.pallet) carryPallet(forklift)
    const step = forklift.steps[0]
    if (!step) {
      forklift.state = 'idle'
      forklift.stateLabel = 'Parked, waiting for a job'
      forklift.activePath = null
      continue
    }
    if (step.type === 'do') {
      forklift.steps.shift()
      step.action()
      continue
    }
    if (step.type === 'laneClear') {
      if (laneIsClear(sim, forklift, step)) {
        forklift.laneBlock = step.point
        forklift.steps.shift()
      } else {
        forklift.state = 'waiting'
        forklift.stateLabel = step.label
        sim.totalWaitSeconds += STEP_SECONDS
        forklift.waited += STEP_SECONDS
      }
      continue
    }
    if (step.type === 'lift') {
      forklift.state = 'working'
      forklift.stateLabel = step.label
      forklift.speed = 0
      const remaining = step.to - forklift.lift
      const change = Math.sign(remaining) * Math.min(Math.abs(remaining), LIFT_SPEED * STEP_SECONDS)
      forklift.lift += change
      if (Math.abs(step.to - forklift.lift) < 0.0005) forklift.steps.shift()
      continue
    }
    if (step.type === 'drive') {
      const path = step.path
      forklift.activePath = path
      forklift.stateLabel = step.label
      if (path.laneBlockPoint && forklift.progress >= path.laneBlockAtS) forklift.laneBlock = path.laneBlockPoint
      let stopAt = stepForkliftGates(sim, forklift, path)
      let stopped = false
      const blockers = blockersByForklift.get(forklift)
      for (const other of blockers) {
        const mutual = blockersByForklift.get(other)?.has(forklift)
        if (mutual) {
          const otherStep = currentDrive(other)
          const otherReversing = otherStep?.path.reverse ?? false
          if (path.reverse && !otherReversing) continue
          if (path.reverse === otherReversing && hasRightOfWay(forklift, other)) continue
        }
        stopped = true
        forklift.blockedBy = other.id
      }
      const stoppingDistance = (forklift.speed * forklift.speed) / (2 * ACCELERATION)
      const remaining = Math.min(path.length, stopAt) - forklift.progress
      const here = samplePath(path, forklift.progress)
      const maximum = Math.min(path.reverse ? REVERSE_SPEED : TRAVEL_SPEED, here.speedLimit)
      let target = maximum
      if (remaining <= stoppingDistance + 0.02) target = Math.min(target, Math.sqrt(Math.max(0.04, 2 * ACCELERATION * Math.max(remaining, 0))))
      if (stopped || (stopAt !== Infinity && remaining < 0.05)) target = 0
      const accelerationLimit = ACCELERATION * STEP_SECONDS * (stopped ? 2.2 : 1)
      forklift.speed += Math.max(-accelerationLimit, Math.min(accelerationLimit, target - forklift.speed))
      forklift.progress += forklift.speed * STEP_SECONDS
      forklift.distance += forklift.speed * STEP_SECONDS
      if (stopped && forklift.speed < 0.05) {
        forklift.state = 'waiting'
        forklift.stateLabel = `Waiting for ${forklift.blockedBy} to clear`
        sim.totalWaitSeconds += STEP_SECONDS
        forklift.waited += STEP_SECONDS
      } else if (stopAt !== Infinity && remaining < 0.2) {
        forklift.state = 'waiting'
        forklift.stateLabel = 'Waiting for the aisle to clear'
        sim.totalWaitSeconds += STEP_SECONDS
        forklift.waited += STEP_SECONDS
      } else {
        forklift.state = 'driving'
        forklift.blockedBy = null
      }
      const pose = samplePath(path, forklift.progress)
      forklift.x = pose.x
      forklift.z = pose.z
      forklift.heading = pose.heading
      if (forklift.progress >= path.length - 0.001) {
        for (const gate of path.gates) {
          if (gate.release && !gate.done && sim.locks[gate.release] === forklift.id) {
            delete sim.locks[gate.release]
            gate.done = true
          }
        }
        forklift.speed = 0
        forklift.progress = 0
        if (step.endLane) forklift.lanePosition = step.endLane
        forklift.steps.shift()
      }
    }
  }
  for (let first = 0; first < sim.forklifts.length; first++) {
    for (let second = first + 1; second < sim.forklifts.length; second++) {
      const centerOne = forkliftCenter(sim.forklifts[first])
      const centerTwo = forkliftCenter(sim.forklifts[second])
      const gap = Math.hypot(centerOne[0] - centerTwo[0], centerOne[1] - centerTwo[1])
      if (gap < sim.minimumGap) sim.minimumGap = gap
    }
  }
}

function carryPallet(forklift) {
  const pallet = forklift.pallet
  pallet.x = forklift.x + Math.sin(forklift.heading) * CARRY_OFFSET
  pallet.z = forklift.z + Math.cos(forklift.heading) * CARRY_OFFSET
  pallet.y = forklift.lift + 0.12
  pallet.heading = forklift.heading + Math.PI * 0.5
}

export function stepSim(sim) {
  for (const pallet of sim.pallets) pallet.previous = { x: pallet.x, y: pallet.y, z: pallet.z }
  sim.time += STEP_SECONDS
  stepOrders(sim)
  stepInbound(sim)
  for (const line of sim.lines) stepLine(sim, line)
  stepForklifts(sim)
  stepDocks(sim)
}

export function computeKpis(sim) {
  const windowStart = Math.max(0, sim.time - KPI_WINDOW_SECONDS)
  const recent = sim.shipped.filter((order) => order.shippedAt >= windowStart)
  const elapsedHours = Math.max(sim.time - windowStart, 60) / 3600
  const lastTwenty = sim.shipped.slice(-20)
  const averageSeconds = lastTwenty.length
    ? lastTwenty.reduce((sum, order) => sum + (order.shippedAt - order.createdAt), 0) / lastTwenty.length
    : 0
  const occupied = sim.slots.filter((slot) => slot.pallet).length
  return {
    ordersPerHour: recent.length / elapsedHours,
    orderToShipMinutes: averageSeconds / 60,
    rackFillPercent: (occupied / sim.slots.length) * 100,
    freeForklifts: sim.forklifts.filter((forklift) => !forklift.task).length,
    forkliftCount: sim.forklifts.length,
    queuedOrders: sim.pendingOrders.length,
    shippedTotal: sim.shipped.length,
  }
}

// Points of the path a forklift is still going to drive, for the line drawn on the floor.
export function remainingPathPoints(forklift, maximumPoints = 80, wholeRoute = false) {
  const points = []
  const samplesOf = (path, startS) => {
    for (const sample of path.samples) {
      if (sample.s >= startS) points.push([sample.x, sample.z])
    }
  }
  let isFirst = true
  for (const step of forklift.steps) {
    if (step.type !== 'drive') {
      if (!wholeRoute && !isFirst) break
      continue
    }
    if (step.path.reverse && !isFirst) break
    samplesOf(step.path, isFirst ? forklift.progress : 0)
    isFirst = false
    if (!wholeRoute) break
    if (points.length > maximumPoints * 4) break
  }
  const stride = Math.max(1, Math.floor(points.length / maximumPoints))
  const thinned = points.filter((_, index) => index % stride === 0)
  if (points.length) thinned.push(points[points.length - 1])
  return thinned
}

export const SIM_CONSTANTS = { CASE_LAYOUT_COUNT, CASES_PER_PALLET, LEFT_LANE_X, RIGHT_LANE_X }
