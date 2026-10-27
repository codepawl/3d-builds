// Seeded simulation of every site. Fab sites: lots flow stocker -> OHT -> tool load port ->
// process -> OHT -> next tool or stocker, bays exchange lots through the interbay system, tools
// go down and technicians walk over to fix them, engineers walk the bays. The campus site
// runs trucks on the ring road. One sim second is one ops minute.
import geometry from './geometry.json'
import { CAMPUS_BUILDINGS, CAMPUS_ROAD, PEOPLE_NAMES, PRODUCTS, SITES, STAGES, TOOL_KINDS, TOOL_MODELS } from './data.js'

export const OPS_MINUTES_PER_SECOND = 1
export const RAIL_Y = 4.6
export const SUBFAB_DEPTH = 5.2
export const TILE = 6
const LANE = 2
const TOOL_GAP = 1.3
const ROW_MARGIN = 0.4
const CORRIDOR = 6
const VEHICLE_MAX_SPEED = 4.5
const VEHICLE_CRUISE_SPEED = 1.1
const VEHICLE_ACCEL = 2.8
const VEHICLE_DECEL = 3.0
const VEHICLE_GAP = 1.5
const HOIST_SPEED = 2.0
const GRIP_SECONDS = 0.5
const WALK_SPEED = 1.3
const POD_HANG = 1.045
const WAFERS_PER_LOT = 25

// ---------- helpers ----------

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function between(rng, [low, high]) {
  return low + (high - low) * rng()
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)]
}

export function rotateY([x, y, z], angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [x * cos + z * sin, y, -x * sin + z * cos]
}

function footprint(name, angle) {
  const { min, max } = geometry[name]
  const corners = [
    [min[0], 0, min[2]],
    [max[0], 0, min[2]],
    [min[0], 0, max[2]],
    [max[0], 0, max[2]],
  ].map((corner) => rotateY(corner, angle))
  return {
    minX: Math.min(...corners.map((corner) => corner[0])),
    maxX: Math.max(...corners.map((corner) => corner[0])),
    minZ: Math.min(...corners.map((corner) => corner[2])),
    maxZ: Math.max(...corners.map((corner) => corner[2])),
    height: max[1],
  }
}

function anchorWorld(origin, angle, anchor) {
  const rotated = rotateY(anchor, angle)
  return { x: origin.x + rotated[0], y: rotated[1], z: origin.z + rotated[2] }
}

// ---------- OHT loop of one bay ----------
// Line A runs +z at x = xc - LANE, U-turns around (xc, zb), line B runs -z at x = xc + LANE,
// U-turns around (xc, za) back to the start.

export function loopLength(bay) {
  return 2 * (bay.zb - bay.za) + 2 * Math.PI * LANE
}

export function loopPoint(bay, s) {
  const straight = bay.zb - bay.za
  const turn = Math.PI * LANE
  let distance = ((s % bay.loop) + bay.loop) % bay.loop
  if (distance < straight) return { x: bay.xc - LANE, z: bay.za + distance, heading: 0 }
  distance -= straight
  if (distance < turn) {
    const angle = Math.PI + distance / LANE
    return { x: bay.xc + Math.cos(angle) * LANE, z: bay.zb - Math.sin(angle) * LANE, heading: distance / LANE }
  }
  distance -= turn
  if (distance < straight) return { x: bay.xc + LANE, z: bay.zb - distance, heading: Math.PI }
  distance -= straight
  const angle = distance / LANE
  return { x: bay.xc + Math.cos(angle) * LANE, z: bay.za - Math.sin(angle) * LANE, heading: Math.PI + distance / LANE }
}

function loopParameter(bay, x, z) {
  if (x < bay.xc) return z - bay.za
  return (bay.zb - bay.za) + Math.PI * LANE + (bay.zb - z)
}

// ---------- fab layout ----------

function rowHalfWidth(slots, angle) {
  let need = 3
  for (const slot of slots) {
    if (slot === 'install') {
      need = Math.max(need, LANE + 6.4)
      continue
    }
    const name = slot.startsWith('stocker') ? slot : `tool_${slot}`
    const anchor = geometry[name].anchors[slot.startsWith('stocker') ? 'oht0' : 'port0']
    const box = footprint(name, angle)
    const anchorX = rotateY(anchor, angle)[0]
    const reach = angle > 0 ? anchorX - box.minX : box.maxX - anchorX
    need = Math.max(need, LANE + reach + ROW_MARGIN)
  }
  return 3 + TILE * Math.ceil((need - 3) / TILE)
}

function buildFab(siteDef, rng) {
  const bays = []
  const tools = []
  const stockers = []
  const installs = []
  let xStart = 0
  let zbMax = 0
  const counters = {}
  siteDef.bays.forEach((bayDef, bayIndex) => {
    const halfA = rowHalfWidth(bayDef.rowA, Math.PI / 2)
    const halfB = rowHalfWidth(bayDef.rowB, -Math.PI / 2)
    const xc = xStart + halfA
    const bay = { index: bayIndex, name: bayDef.name, floor: bayDef.floor, xc, xStart, xEnd: xc + halfB, za: 0, zb: 0, toolIds: [], stockerId: null }
    for (const [row, slots, angle] of [['A', bayDef.rowA, Math.PI / 2], ['B', bayDef.rowB, -Math.PI / 2]]) {
      const lineX = row === 'A' ? xc - LANE : xc + LANE
      let cursor = 1
      for (const slot of slots) {
        if (slot === 'install') {
          const width = 5
          const depth = 6
          const centerX = row === 'A' ? lineX - 0.8 - depth / 2 : lineX + 0.8 + depth / 2
          installs.push({ id: `${siteDef.id}-INS-${installs.length + 1}`, bay: bayIndex, x: centerX, z: cursor + width / 2, width: depth, depth: width })
          cursor += width + TOOL_GAP
          continue
        }
        const isStocker = slot.startsWith('stocker')
        const name = isStocker ? slot : `tool_${slot}`
        const anchors = geometry[name].anchors
        const box = footprint(name, angle)
        const anchorX = rotateY(anchors[isStocker ? 'oht0' : 'port0'], angle)[0]
        const origin = { x: lineX - anchorX, z: cursor - box.minZ }
        cursor += box.maxZ - box.minZ + TOOL_GAP
        const center = { x: origin.x + (box.minX + box.maxX) / 2, y: 0, z: origin.z + (box.minZ + box.maxZ) / 2 }
        if (isStocker) {
          const stocker = {
            id: `${siteDef.id}-STK-${bayIndex + 1}`,
            name: `Stocker ${bayIndex + 1}${row}`,
            node: name,
            bay: bayIndex,
            origin,
            angle,
            center,
            height: box.height,
            lots: [],
            crane: 0,
            craneTarget: 0,
            moves: 0,
            ports: ['oht0', 'oht1'].map((key) => anchorWorld(origin, angle, anchors[key])),
            capacity: name === 'stocker_b' ? 96 : 48,
          }
          bay.stockerId = stocker.id
          stockers.push(stocker)
          continue
        }
        const variant = slot
        const kind = variant.split('_')[0]
        counters[kind] = (counters[kind] ?? 0) + 1
        const ports = Object.keys(anchors)
          .filter((key) => /^port\d$/.test(key))
          .sort()
          .map((key) => ({ ...anchorWorld(origin, angle, anchors[key]), lotId: null, reservedBy: null }))
        const tool = {
          id: `${siteDef.id}-${TOOL_KINDS[kind].prefix}-${String(counters[kind]).padStart(2, '0')}`,
          name: `${TOOL_KINDS[kind].prefix}-${String(counters[kind]).padStart(2, '0')}`,
          kind,
          variant,
          model: TOOL_MODELS[variant],
          bay: bayIndex,
          origin,
          angle,
          center,
          height: box.height,
          ports,
          state: 'idle',
          lotId: null,
          progress: 0,
          duration: 1,
          busySeconds: 0,
          totalSeconds: 0,
          utilisationBase: between(rng, [0.72, 0.9]),
          wph: Math.round(between(rng, TOOL_KINDS[kind].wph)),
          processedToday: Math.floor(between(rng, [8, 30])),
          alarm: null,
          ticketId: null,
          downSince: null,
          maintenanceUntil: null,
          mover: 0,
        }
        bay.toolIds.push(tool.id)
        tools.push(tool)
      }
      bay.rowLength = Math.max(bay.rowLength ?? 0, cursor)
    }
    zbMax = Math.max(zbMax, Math.ceil(bay.rowLength / 4) * 4)
    bays.push(bay)
    xStart = bay.xEnd
  })
  for (const bay of bays) {
    bay.za = 0
    bay.zb = zbMax
    bay.loop = loopLength(bay)
  }
  for (const tool of tools) {
    const bay = bays[tool.bay]
    tool.ports.forEach((port) => {
      port.s = loopParameter(bay, port.x, port.z)
    })
  }
  for (const stocker of stockers) {
    const bay = bays[stocker.bay]
    stocker.ports.forEach((port) => {
      port.s = loopParameter(bay, port.x, port.z)
    })
  }
  const width = xStart
  const front = TILE * Math.ceil((zbMax + LANE + 1 + CORRIDOR) / TILE)
  const layout = { width, back: -TILE, front, corridorZ: front - CORRIDOR / 2, zb: zbMax, center: { x: width / 2, z: (front - TILE) / 2 } }
  return { bays, tools, stockers, installs, layout }
}

// ---------- lots ----------

let lotCounter = 2071

function newLot(state, rng, stageIndex = 0) {
  const product = pick(rng, PRODUCTS)
  const roll = rng()
  const priority = roll < 0.12 ? 'hot' : roll < 0.2 ? 'eng' : roll < 0.25 ? 'mon' : 'normal'
  lotCounter += 1 + Math.floor(rng() * 7)
  const step = Math.floor(between(rng, [12, product.steps - 40]))
  return {
    id: `${state.site.id}-${product.code}${lotCounter}`,
    name: `${product.code}${lotCounter}.${1 + Math.floor(rng() * 3)}`,
    product,
    priority,
    wafers: priority === 'mon' ? 3 : WAFERS_PER_LOT,
    step,
    layer: Math.floor(step / 48) + 1,
    stageIndex,
    place: null,
    state: 'queued',
    queueSince: state.clock - between(rng, [0, 25]),
    progress: 0,
    toolId: null,
    stageStarts: STAGES.map(() => null),
    inlineYield: between(rng, [88, 97.5]),
    dueDays: Math.round(between(rng, [9, 36])),
  }
}

function toolKindBays(state, kind) {
  return [...new Set(state.tools.filter((tool) => tool.kind === kind).map((tool) => tool.bay))]
}

function stockerOfBay(state, bayIndex) {
  return state.stockers.find((stocker) => stocker.bay === bayIndex)
}

function putInStocker(state, lot, stocker) {
  lot.place = { type: 'stocker', id: stocker.id }
  lot.state = 'queued'
  lot.toolId = null
  if (!stocker.lots.includes(lot.id)) stocker.lots.push(lot.id)
  stocker.craneTarget = (stocker.lots.length % 8) / 7
}

function removeFromStocker(stocker, lot) {
  stocker.lots = stocker.lots.filter((id) => id !== lot.id)
  stocker.craneTarget = state01(stocker)
  stocker.moves++
}

function state01(stocker) {
  return ((stocker.moves * 3) % 8) / 7
}

// ---------- world ----------

function createFab(siteDef) {
  const rng = random(siteDef.seed)
  const built = buildFab(siteDef, rng)
  const state = {
    site: siteDef,
    rng,
    clock: 0,
    ...built,
    lots: [],
    vehicles: [],
    people: [],
    tickets: [],
    stats: { lotsStarted: 0, lotsOut: 0, moves: 0, stepsDone: 0, waferPasses: 0, yieldSum: 0, yieldCount: 0 },
    nextTicket: 401 + siteDef.seed * 3,
    dispatchTimer: 0,
  }
  // Vehicles spread around each bay loop.
  let vehicleNumber = 1
  for (const bay of state.bays) {
    for (let index = 0; index < siteDef.vehiclesPerBay; index++) {
      const variant = index === siteDef.vehiclesPerBay - 1 && bay.index === 1 ? 'oht_c' : index % 2 ? 'oht_b' : 'oht_a'
      state.vehicles.push({
        id: `${siteDef.id}-V${String(vehicleNumber).padStart(2, '0')}`,
        name: `OHT ${siteDef.id === 'F1' ? 'C' : 'L'}-${String(vehicleNumber).padStart(2, '0')}`,
        variant,
        bay: bay.index,
        s: (bay.loop / siteDef.vehiclesPerBay) * index + rng() * 2,
        speed: 0,
        job: null,
        hoist: 0,
        gripTimer: 0,
        carrying: null,
        tripsToday: Math.floor(between(rng, [40, 120])),
        distanceToday: between(rng, [4, 11]),
        position: { x: 0, y: RAIL_Y, z: 0 },
        heading: 0,
        wheel: 0,
      })
      vehicleNumber++
    }
  }
  placeVehicles(state)
  // Lots start spread over stockers with a stage served by some bay.
  for (let index = 0; index < siteDef.lots; index++) {
    const stageIndex = Math.floor(rng() * STAGES.length)
    const lot = newLot(state, rng, stageIndex)
    lot.stageStarts[stageIndex] = state.clock
    const bays = toolKindBays(state, STAGES[stageIndex].toolKind)
    const stocker = stockerOfBay(state, bays.length ? pick(rng, bays) : 0)
    putInStocker(state, lot, stocker)
    state.lots.push(lot)
  }
  // Make sure the timeline has a hot lot to follow.
  if (!state.lots.some((lot) => lot.priority === 'hot')) state.lots[0].priority = 'hot'
  // People: engineers walk tools, technicians answer tickets.
  const personCount = siteDef.id === 'F1' ? 12 : 7
  for (let index = 0; index < personCount; index++) {
    const role = index % 3 === 2 ? 'technician' : 'engineer'
    const bay = state.bays[index % state.bays.length]
    const position = { x: bay.xc, y: 0, z: 2 + rng() * (bay.zb - 4) }
    state.people.push({
      id: `${siteDef.id}-P${index + 1}`,
      name: PEOPLE_NAMES[(index + siteDef.seed) % PEOPLE_NAMES.length],
      role,
      bay: bay.index,
      position,
      heading: rng() * Math.PI * 2,
      path: [],
      state: 'idle',
      timer: rng() * 4,
      toolId: null,
      ticketId: null,
      walked: between(rng, [1.2, 4.5]),
    })
  }
  // Fab 2 has tools still in qualification.
  if (siteDef.id === 'F2') {
    state.tools.filter((tool, index) => index % 4 === 1).forEach((tool) => {
      tool.state = 'maintenance'
      tool.maintenanceUntil = 40 + rng() * 80
      tool.alarm = 'Qualification runs'
    })
  }
  // Warm up so the first frame already looks like a running fab.
  for (let step = 0; step < 1800; step++) stepFab(state, 0.1)
  state.tools.forEach((tool) => {
    tool.processedToday += Math.floor(rng() * 6)
  })
  return state
}

function createCampus(siteDef) {
  const rng = random(siteDef.seed)
  const corners = CAMPUS_ROAD
  const segments = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length]
    return { from: corner, to: next, length: Math.hypot(next[0] - corner[0], next[1] - corner[1]) }
  })
  const roadLength = segments.reduce((sum, segment) => sum + segment.length, 0)
  const stops = { gas: 156, dock: 514, substation: 282 }
  const trucks = [
    { id: 'T1', name: 'Tube trailer 14', node: 'truck_tube', role: 'Bulk nitrogen delivery', stop: 'gas', s: 20, cargo: 'Nitrogen, 4,800 m³' },
    { id: 'T2', name: 'Box truck 03', node: 'truck_box', role: 'Packaged parts to the dock', stop: 'dock', s: 300, cargo: '42 trays of packaged parts' },
    { id: 'T3', name: 'Service van 7', node: 'van_service', role: 'Substation service', stop: 'substation', s: 520, cargo: 'Relay test kit' },
    { id: 'T4', name: 'Box truck 05', node: 'truck_box', role: 'Spares from the warehouse', stop: 'dock', s: 120, cargo: 'Pump and chamber spares' },
  ].map((truck) => ({ ...truck, speed: 0, waitUntil: 0, position: { x: 0, y: 0, z: 0 }, heading: 0, trips: Math.floor(between(rng, [2, 6])), wheel: 0 }))
  const state = {
    site: siteDef,
    rng,
    clock: 0,
    buildings: CAMPUS_BUILDINGS.map((building) => ({ ...building })),
    trucks,
    road: { segments, length: roadLength, stops },
    layout: { width: 260, center: { x: 10, z: 30 } },
    stats: { lotsStarted: 0, lotsOut: 0, moves: 0 },
    tickets: [],
  }
  stepCampus(state, 0)
  return state
}

export function roadPoint(road, s) {
  let distance = ((s % road.length) + road.length) % road.length
  for (const segment of road.segments) {
    if (distance <= segment.length) {
      const t = distance / segment.length
      const dx = segment.to[0] - segment.from[0]
      const dz = segment.to[1] - segment.from[1]
      return { x: segment.from[0] + dx * t, z: segment.from[1] + dz * t, heading: Math.atan2(dx, dz) }
    }
    distance -= segment.length
  }
  return { x: 0, z: 0, heading: 0 }
}

export function createWorld() {
  const sites = {}
  for (const siteDef of SITES) sites[siteDef.id] = siteDef.kind === 'fab' ? createFab(siteDef) : createCampus(siteDef)
  return { sites }
}

export function stepWorld(world, dt) {
  for (const state of Object.values(world.sites)) {
    if (state.site.kind === 'fab') stepFab(state, dt)
    else stepCampus(state, dt, world)
  }
}

// ---------- fab step ----------

function stepFab(state, dt) {
  state.clock += dt
  state.dispatchTimer -= dt
  if (state.dispatchTimer <= 0) {
    state.dispatchTimer = 0.4
    dispatch(state)
  }
  stepTools(state, dt)
  stepVehicles(state, dt)
  stepInterbay(state)
  stepPeople(state, dt)
  for (const stocker of state.stockers) stocker.crane += (stocker.craneTarget - stocker.crane) * Math.min(1, dt * 1.2)
}

function freePort(tool) {
  return tool.ports.findIndex((port) => !port.lotId && !port.reservedBy)
}

function toolAvailable(tool) {
  return tool.state === 'idle' || tool.state === 'running'
}

function idleVehicle(state, bayIndex, near) {
  const bay = state.bays[bayIndex]
  const candidates = state.vehicles.filter((vehicle) => vehicle.bay === bayIndex && !vehicle.job)
  if (!candidates.length) return null
  // Closest one behind the pickup along the loop direction.
  candidates.sort((a, b) => ((near - a.s + bay.loop) % bay.loop) - ((near - b.s + bay.loop) % bay.loop))
  return candidates[0]
}

function queueOrder(state) {
  const rank = { hot: 0, eng: 1, mon: 2, normal: 3 }
  return [...state.lots].sort((a, b) => rank[a.priority] - rank[b.priority] || a.queueSince - b.queueSince)
}

function bestTool(state, kind, bayIndex, excludeId = null) {
  const candidates = state.tools.filter((tool) => tool.kind === kind && tool.bay === bayIndex && tool.id !== excludeId && toolAvailable(tool) && freePort(tool) >= 0)
  candidates.sort((a, b) => queuedAt(a) - queuedAt(b))
  return candidates[0] ?? null
}

function queuedAt(tool) {
  return tool.ports.filter((port) => port.lotId || port.reservedBy).length + (tool.lotId ? 1 : 0)
}

function assignJob(state, lot, vehicle, from, tool) {
  const portIndex = freePort(tool)
  const port = tool.ports[portIndex]
  port.reservedBy = lot.id
  vehicle.job = { lotId: lot.id, from, to: { type: 'port', toolId: tool.id, portIndex, s: port.s, y: port.y }, phase: 'toPickup' }
  lot.state = 'moving'
  lot.toolId = tool.id
}

function assignToStocker(state, lot, vehicle, from, stocker) {
  vehicle.job = { lotId: lot.id, from, to: { type: 'stocker', id: stocker.id, s: stocker.ports[0].s, y: stocker.ports[0].y }, phase: 'toPickup' }
  lot.state = 'moving'
}

function dispatch(state) {
  for (const lot of queueOrder(state)) {
    const stage = STAGES[lot.stageIndex]
    if (lot.state === 'queued' && lot.place.type === 'stocker') {
      const stocker = state.stockers.find((candidate) => candidate.id === lot.place.id)
      const servingBays = toolKindBays(state, stage.toolKind)
      if (!servingBays.length) {
        // No tool of this kind in the fab yet (ramp-up): the step is done at the sister fab.
        lot.stageIndex = (lot.stageIndex + 1) % STAGES.length
        lot.step += 1
        continue
      }
      if (!servingBays.includes(stocker.bay)) {
        removeFromStocker(stocker, lot)
        lot.state = 'transfer'
        lot.place = { type: 'interbay', fromBay: stocker.bay, toBay: pick(state.rng, servingBays), until: state.clock + between(state.rng, [6, 11]) }
        continue
      }
      const tool = bestTool(state, stage.toolKind, stocker.bay)
      if (!tool) continue
      const pickup = { type: 'stocker', id: stocker.id, s: stocker.ports[1].s, y: stocker.ports[1].y }
      const vehicle = idleVehicle(state, stocker.bay, pickup.s)
      if (!vehicle) continue
      assignJob(state, lot, vehicle, pickup, tool)
    } else if (lot.state === 'waiting' && lot.place.type === 'port') {
      const tool = state.tools.find((candidate) => candidate.id === lot.place.toolId)
      const port = tool.ports[lot.place.portIndex]
      const pickup = { type: 'port', toolId: tool.id, portIndex: lot.place.portIndex, s: port.s, y: port.y }
      const vehicle = idleVehicle(state, tool.bay, pickup.s)
      if (!vehicle) continue
      const next = bestTool(state, STAGES[lot.stageIndex].toolKind, tool.bay, tool.id)
      if (next) assignJob(state, lot, vehicle, pickup, next)
      else assignToStocker(state, lot, vehicle, pickup, stockerOfBay(state, tool.bay))
    }
  }
}

function openTicket(state, tool, title) {
  const ticket = { id: `T-${state.nextTicket++}`, toolId: tool.id, title, opened: state.clock, state: 'open', personId: null, closedAt: null }
  state.tickets.unshift(ticket)
  tool.ticketId = ticket.id
  state.tickets = state.tickets.filter((candidate, index) => candidate.state !== 'closed' || index < 14)
  return ticket
}

const ALARMS = {
  litho: ['Reticle stage drift', 'Wafer stage interlock', 'Overlay out of spec'],
  etch: ['RF reflected power high', 'Chamber pressure fault', 'Endpoint signal lost'],
  dep: ['Precursor flow low', 'Heater zone fault', 'Particle count high'],
  implant: ['Beam current unstable', 'Source arc count high', 'Dose cup fault'],
  furnace: ['Tube temperature deviation', 'Boat elevator fault', 'Exhaust pressure low'],
  cmp: ['Pad life reached', 'Slurry flow low', 'Head pressure fault'],
  metro: ['Calibration due', 'Stage vibration high', 'Recipe mismatch'],
  wet: ['Bath temperature low', 'Chemical concentration drift', 'Rinse resistivity low'],
}

function stepTools(state, dt) {
  const breakdownRate = state.site.id === 'F2' ? 1 / 420 : 1 / 900
  for (const tool of state.tools) {
    tool.totalSeconds += dt
    tool.mover += dt
    if (tool.state === 'running') tool.busySeconds += dt
    if (tool.state === 'maintenance' && tool.maintenanceUntil !== null && state.clock >= tool.maintenanceUntil && !tool.ticketId) {
      tool.state = 'idle'
      tool.alarm = null
      tool.maintenanceUntil = null
    }
    if (tool.state === 'down' || tool.state === 'maintenance') continue
    if (tool.state === 'running' && state.rng() < breakdownRate * dt) {
      tool.state = 'down'
      tool.alarm = pick(state.rng, ALARMS[tool.kind])
      tool.downSince = state.clock
      openTicket(state, tool, tool.alarm)
      continue
    }
    if (tool.lotId) {
      const lot = state.lots.find((candidate) => candidate.id === tool.lotId)
      tool.progress = Math.min(1, tool.progress + dt / tool.duration)
      lot.progress = tool.progress
      if (tool.progress >= 1) finishStep(state, tool, lot)
      continue
    }
    const port = tool.ports.find((candidate) => {
      const lot = candidate.lotId && state.lots.find((item) => item.id === candidate.lotId)
      return lot && lot.state === 'atTool'
    })
    if (port) {
      const lot = state.lots.find((candidate) => candidate.id === port.lotId)
      tool.lotId = lot.id
      tool.progress = 0
      const minutes = STAGES[lot.stageIndex].minutes
      tool.duration = between(state.rng, minutes) * (lot.wafers < 10 ? 0.4 : 1)
      tool.state = 'running'
      lot.state = 'processing'
      lot.progress = 0
      lot.stageStarts[lot.stageIndex] = state.clock
    } else {
      tool.state = 'idle'
    }
  }
}

function finishStep(state, tool, lot) {
  tool.lotId = null
  tool.progress = 0
  tool.processedToday += 1
  state.stats.stepsDone += 1
  state.stats.waferPasses += lot.wafers
  if (STAGES[lot.stageIndex].key === 'metro') {
    lot.inlineYield = Math.max(80, Math.min(99.2, lot.inlineYield + (state.rng() - 0.55) * 1.6))
    state.stats.yieldSum += lot.inlineYield
    state.stats.yieldCount += 1
  }
  lot.step += 7 + Math.floor(state.rng() * 7)
  lot.stageIndex = (lot.stageIndex + 1) % STAGES.length
  if (lot.stageIndex === 0) {
    lot.layer += 1
    lot.stageStarts = STAGES.map(() => null)
  }
  lot.state = 'waiting'
  lot.progress = 0
  lot.queueSince = state.clock
  if (lot.step >= lot.product.steps) {
    // Lot finished its route: it ships to sort, and a fresh lot starts in its place.
    state.stats.lotsOut += 1
    lot.step = 1 + Math.floor(state.rng() * 6)
    lot.layer = 1
    lot.stageIndex = 0
    state.stats.lotsStarted += 1
  }
  tool.state = 'idle'
}

function stepVehicles(state, dt) {
  for (const vehicle of state.vehicles) {
    const bay = state.bays[vehicle.bay]
    const job = vehicle.job
    const phase = job?.phase
    if (phase === 'lowerPick' || phase === 'lowerDrop' || phase === 'raisePick' || phase === 'raiseDrop') {
      stepHoist(state, vehicle, dt)
      continue
    }
    const target = phase === 'toPickup' ? job.from.s : phase === 'toDrop' ? job.to.s : null
    let desired = target === null ? VEHICLE_CRUISE_SPEED : VEHICLE_MAX_SPEED
    let distance = Infinity
    if (target !== null) {
      distance = (target - vehicle.s + bay.loop) % bay.loop
      desired = Math.min(desired, Math.sqrt(2 * VEHICLE_DECEL * distance) + 0.05)
    }
    let gap = Infinity
    for (const other of state.vehicles) {
      if (other === vehicle || other.bay !== vehicle.bay) continue
      const ahead = (other.s - vehicle.s + bay.loop) % bay.loop
      if (ahead > 0 && ahead < gap) gap = ahead
    }
    if (gap < Infinity) desired = Math.min(desired, Math.max(0, Math.sqrt(2 * VEHICLE_DECEL * Math.max(0, gap - VEHICLE_GAP))))
    const change = desired - vehicle.speed
    vehicle.speed += Math.max(-VEHICLE_DECEL * 2 * dt, Math.min(VEHICLE_ACCEL * dt, change))
    vehicle.speed = Math.max(0, vehicle.speed)
    let move = vehicle.speed * dt
    if (target !== null && move >= distance - 0.005) {
      move = distance
      vehicle.speed = 0
      job.phase = phase === 'toPickup' ? 'lowerPick' : 'lowerDrop'
      job.drop = RAIL_Y - POD_HANG - (phase === 'toPickup' ? job.from.y : job.to.y)
    }
    vehicle.s = (vehicle.s + move) % bay.loop
    vehicle.distanceToday += move / 1000
    vehicle.wheel += move / 0.06
  }
  placeVehicles(state)
}

function stepHoist(state, vehicle, dt) {
  const job = vehicle.job
  const lot = state.lots.find((candidate) => candidate.id === job.lotId)
  if (job.phase === 'lowerPick' || job.phase === 'lowerDrop') {
    vehicle.hoist = Math.min(job.drop, vehicle.hoist + HOIST_SPEED * dt)
    if (vehicle.hoist < job.drop) return
    vehicle.gripTimer += dt
    if (vehicle.gripTimer < GRIP_SECONDS) return
    vehicle.gripTimer = 0
    if (job.phase === 'lowerPick') {
      if (job.from.type === 'port') {
        const tool = state.tools.find((candidate) => candidate.id === job.from.toolId)
        tool.ports[job.from.portIndex].lotId = null
      } else {
        removeFromStocker(state.stockers.find((candidate) => candidate.id === job.from.id), lot)
      }
      lot.place = { type: 'vehicle', id: vehicle.id }
      vehicle.carrying = lot.id
      job.phase = 'raisePick'
    } else {
      vehicle.carrying = null
      if (job.to.type === 'port') {
        const tool = state.tools.find((candidate) => candidate.id === job.to.toolId)
        const port = tool.ports[job.to.portIndex]
        port.lotId = lot.id
        port.reservedBy = null
        lot.place = { type: 'port', toolId: tool.id, portIndex: job.to.portIndex }
        lot.state = 'atTool'
        lot.queueSince = state.clock
      } else {
        putInStocker(state, lot, state.stockers.find((candidate) => candidate.id === job.to.id))
      }
      state.stats.moves += 1
      vehicle.tripsToday += 1
      job.phase = 'raiseDrop'
    }
    return
  }
  vehicle.hoist = Math.max(0, vehicle.hoist - HOIST_SPEED * dt)
  if (vehicle.hoist > 0) return
  if (job.phase === 'raisePick') job.phase = 'toDrop'
  else vehicle.job = null
}

function placeVehicles(state) {
  for (const vehicle of state.vehicles) {
    const point = loopPoint(state.bays[vehicle.bay], vehicle.s)
    vehicle.position.x = point.x
    vehicle.position.z = point.z
    vehicle.position.y = RAIL_Y
    vehicle.heading = point.heading
  }
}

function stepInterbay(state) {
  for (const lot of state.lots) {
    if (lot.state !== 'transfer' || state.clock < lot.place.until) continue
    putInStocker(state, lot, stockerOfBay(state, lot.place.toBay))
    lot.queueSince = state.clock
  }
}

// ---------- people ----------

function workSpot(state, tool) {
  const bay = state.bays[tool.bay]
  const side = tool.origin.x < bay.xc ? -1 : 1
  const port = tool.ports[Math.floor(tool.ports.length / 2)]
  return { x: bay.xc + side * 0.9, z: port.z + (state.rng() - 0.5) * 0.6, face: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
}

function bayAt(state, x) {
  return state.bays.find((bay) => x >= bay.xStart && x < bay.xEnd) ?? state.bays[0]
}

// Paths keep to the bay aisles and the front corridor so nobody walks through a tool.
function routeTo(state, person, bayIndex, spot) {
  const fromBay = bayAt(state, person.position.x)
  const toBay = state.bays[bayIndex]
  const inCorridor = person.position.z > state.layout.zb + 1
  const path = []
  if (!inCorridor) path.push([fromBay.xc, person.position.z])
  if (fromBay.index !== bayIndex || inCorridor) {
    path.push([fromBay.xc, state.layout.corridorZ], [toBay.xc, state.layout.corridorZ])
  }
  path.push([toBay.xc, spot.z], [spot.x, spot.z])
  person.path = path
  person.bay = bayIndex
  person.face = spot.face
  person.state = 'walk'
}

function stepPeople(state, dt) {
  for (const person of state.people) {
    if (person.role === 'technician' && !person.ticketId) {
      const ticket = state.tickets.find((candidate) => candidate.state === 'open')
      if (ticket) {
        const tool = state.tools.find((candidate) => candidate.id === ticket.toolId)
        ticket.state = 'assigned'
        ticket.personId = person.id
        person.ticketId = ticket.id
        person.toolId = tool.id
        routeTo(state, person, tool.bay, workSpot(state, tool))
      }
    }
    if (person.state === 'walk') {
      const [targetX, targetZ] = person.path[0]
      const dx = targetX - person.position.x
      const dz = targetZ - person.position.z
      const distance = Math.hypot(dx, dz)
      const step = WALK_SPEED * dt
      if (distance > 0.001) person.heading = Math.atan2(dx, dz)
      if (distance <= step) {
        person.position.x = targetX
        person.position.z = targetZ
        person.path.shift()
        if (!person.path.length) arrive(state, person)
      } else {
        person.position.x += (dx / distance) * step
        person.position.z += (dz / distance) * step
      }
      person.walked += step / 1000
      continue
    }
    person.timer -= dt
    if (person.timer > 0) continue
    if (person.state === 'work' && person.ticketId) {
      finishRepair(state, person)
      continue
    }
    if (person.role === 'technician' && person.state !== 'idle') {
      person.state = 'idle'
      person.timer = 3 + state.rng() * 4
      continue
    }
    if (person.role === 'engineer' || person.state === 'idle') {
      const ownBay = state.rng() < 0.75 ? person.bay : Math.floor(state.rng() * state.bays.length)
      const candidates = state.tools.filter((tool) => tool.bay === ownBay)
      if (!candidates.length) continue
      const tool = pick(state.rng, candidates)
      person.toolId = tool.id
      routeTo(state, person, ownBay, workSpot(state, tool))
    }
  }
}

function arrive(state, person) {
  person.heading = person.face
  person.state = 'work'
  if (person.ticketId) {
    const ticket = state.tickets.find((candidate) => candidate.id === person.ticketId)
    const tool = state.tools.find((candidate) => candidate.id === person.toolId)
    ticket.state = 'working'
    tool.state = 'maintenance'
    person.timer = 14 + state.rng() * 12
  } else {
    person.timer = 5 + state.rng() * 7
  }
}

function finishRepair(state, person) {
  const ticket = state.tickets.find((candidate) => candidate.id === person.ticketId)
  const tool = state.tools.find((candidate) => candidate.id === person.toolId)
  ticket.state = 'closed'
  ticket.closedAt = state.clock
  tool.ticketId = null
  tool.alarm = null
  tool.downSince = null
  tool.state = tool.lotId ? 'running' : 'idle'
  person.ticketId = null
  person.state = 'idle'
  person.timer = 2
}

// ---------- campus ----------

function stepCampus(state, dt, world) {
  state.clock += dt
  const road = state.road
  for (const truck of state.trucks) {
    if (state.clock < truck.waitUntil) {
      truck.speed = 0
      continue
    }
    const stopAt = road.stops[truck.stop]
    const distance = (stopAt - truck.s + road.length) % road.length
    let desired = 9
    if (distance < 40) desired = Math.min(desired, Math.sqrt(2 * 1.6 * distance) + 0.2)
    let gap = Infinity
    for (const other of state.trucks) {
      if (other === truck) continue
      const ahead = (other.s - truck.s + road.length) % road.length
      if (ahead > 0 && ahead < gap) gap = ahead
    }
    desired = Math.min(desired, Math.max(0, (gap - 16) * 0.8))
    truck.speed += Math.max(-4 * dt, Math.min(1.8 * dt, desired - truck.speed))
    truck.speed = Math.max(0, truck.speed)
    const move = truck.speed * dt
    if (distance > 0.5 && move >= distance - 0.3) {
      truck.s = stopAt
      truck.speed = 0
      truck.waitUntil = state.clock + 9 + state.rng() * 5
      truck.trips += 1
      continue
    }
    truck.s = (truck.s + move) % road.length
    truck.wheel += move / 0.5
  }
  for (const truck of state.trucks) {
    const point = roadPoint(road, truck.s)
    // Drive on the right-hand lane of the two-way road.
    const sideX = Math.cos(point.heading) * 2.2
    const sideZ = -Math.sin(point.heading) * 2.2
    truck.position.x = point.x + sideX
    truck.position.z = point.z + sideZ
    truck.heading = point.heading
  }
  if (world) state.fabs = SITES.filter((siteDef) => siteDef.kind === 'fab').map((siteDef) => world.sites[siteDef.id])
}

// ---------- derived numbers ----------

export function toolUtilisation(tool) {
  const live = tool.totalSeconds > 0 ? tool.busySeconds / tool.totalSeconds : 0
  return Math.min(0.99, tool.utilisationBase * 0.7 + live * 0.3)
}

export function lotQueueMinutes(state, lot) {
  if (lot.state === 'processing') return 0
  return Math.max(0, Math.round(state.clock - lot.queueSince))
}

export function availability(state) {
  const up = state.tools.filter((tool) => tool.state === 'running' || tool.state === 'idle').length
  return (up / state.tools.length) * 100
}
