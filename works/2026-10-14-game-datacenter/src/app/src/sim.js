// Advances one hall in time: loads, temperatures, incidents, tickets and unit movement.
import { RACK } from './world.js'

const INCIDENT_SEQUENCE = ['gpu', 'cooling', 'gpu', 'gpu', 'cooling', 'gpu']
const ROBOT_DRAIN_PER_SECOND = 0.004
const ROBOT_CHARGE_PER_SECOND = 0.035
const LOW_BATTERY = 0.3
const SWAP_SECONDS = 6
const SERVICE_SECONDS = 8
const RUN_STEPS_PER_SECOND = 0.42

function approach(current, target, rate, dt) {
  return current + (target - current) * Math.min(1, rate * dt)
}

function nearestCrah(world, rack) {
  if (!rack.crahId) {
    const crahs = world.equipment.filter((item) => item.kind === 'crah')
    const nearest = crahs.reduce((best, crah) =>
      Math.hypot(crah.x - rack.x, crah.z - rack.z) < Math.hypot(best.x - rack.x, best.z - rack.z) ? crah : best)
    rack.crahId = nearest.id
  }
  return world.index.get(rack.crahId)
}

function updateRacks(world, dt) {
  const time = world.time
  for (const rack of world.racks) {
    const job = world.index.get(rack.jobId)
    const wave = Math.sin(time * 0.6 + rack.column * 0.7 + rack.row * 1.3)
    rack.load = approach(rack.load, job.targetLoad * (1 + 0.07 * wave), 0.8, dt)
    const crah = nearestCrah(world, rack)
    const inletTemperature = 21 + (1 - crah.health) * 55
    rack.inletTemperature = inletTemperature
    let hottest = 0
    rack.trayTemperatures.forEach((trayTemperature, tray) => {
      const target = tray === rack.failedTray ? 93 : inletTemperature + 38 * rack.load + tray * 1.1
      const next = approach(trayTemperature, target, 0.35, dt)
      rack.trayTemperatures[tray] = next
      hottest = Math.max(hottest, next)
    })
    rack.temperature = hottest
    const workingTrays = rack.failedTray === null ? RACK.trays : RACK.trays - 1
    const gpusOnline = workingTrays * RACK.gpusPerTray
    rack.gpusBusy = job.jobType === 'training' ? gpusOnline : Math.round(gpusOnline * rack.load)
    rack.powerKw = 14 + rack.load * 104 * (workingTrays / RACK.trays)
  }
}

function updateJobs(world, dt) {
  for (const job of world.jobs) {
    job.gpus = job.rackIds.reduce((sum, id) => sum + world.index.get(id).gpusBusy, 0)
    const ripple = 1 + 0.035 * Math.sin(world.time * 1.3 + job.tokensPerGpu)
    job.tokensPerSecond = job.gpus * job.tokensPerGpu * ripple
    job.progress += job.progressRate * dt
    if (job.progress >= 1) job.progress -= 1
  }
}

function updateEquipment(world, dt) {
  const averageLoad = world.racks.reduce((sum, rack) => sum + rack.load, 0) / world.racks.length
  for (const item of world.equipment) {
    if (item.kind === 'crah') {
      if (item.degradeTo !== undefined) item.health = approach(item.health, item.degradeTo, 0.25, dt)
      item.fanSpeed = approach(item.fanSpeed, item.health > 0.85 ? 0.68 + averageLoad * 0.2 : 1, 1, dt)
      item.supplyTemperature = 18 + (1 - item.health) * 32
    } else if (item.kind === 'chiller') {
      item.load = approach(item.load, averageLoad * 0.9 + 0.05 * Math.sin(world.time * 0.4 + item.x + item.z), 0.5, dt)
      item.waterTemperature = 12.5 + item.load * 3.2
    } else if (item.kind === 'battery') {
      item.charge = 0.97 + 0.015 * Math.sin(world.time * 0.05)
    }
  }
  const substation = world.equipment.find((item) => item.kind === 'substation')
  substation.megawatts = siteMetrics(world).powerMegawatts
}

function updateRun(world, dt) {
  const run = world.run
  run.step = Math.min(run.totalSteps, run.step + RUN_STEPS_PER_SECOND * dt)
  run.loss = Math.max(0.8, run.loss - dt * 0.00003)
  run.stepsPerSecond = RUN_STEPS_PER_SECOND
}

function addAlert(world, fields) {
  const alert = { id: `AL-${world.counters.alert++}`, kind: 'alert', createdAt: world.time, resolved: false, ...fields }
  world.alerts.unshift(alert)
  world.index.set(alert.id, alert)
  return alert
}

function addTicket(world, fields) {
  const ticket = { id: `TK-${world.counters.ticket++}`, kind: 'ticket', createdAt: world.time, status: 'queued', progress: 0, assigneeId: null, ...fields }
  world.tickets.unshift(ticket)
  world.index.set(ticket.id, ticket)
  return ticket
}

function startIncident(world) {
  const kind = INCIDENT_SEQUENCE[world.incidentCount % INCIDENT_SEQUENCE.length]
  world.incidentCount += 1
  if (kind === 'gpu') {
    const candidates = world.racks.filter((rack) => rack.failedTray === null && !world.tickets.some((t) => t.targetId === rack.id && t.status !== 'done'))
    const rack = candidates[Math.floor(world.random() * candidates.length)]
    rack.failedTray = Math.floor(world.random() * RACK.trays)
    const alert = addAlert(world, { severity: 'critical', title: `GPU tray ${rack.failedTray + 1} failing`, targetId: rack.id })
    addTicket(world, { title: `Swap GPU tray ${rack.failedTray + 1}`, targetId: rack.id, alertId: alert.id, needs: 'robot' })
    return
  }
  const candidates = world.equipment.filter((item) => item.kind === 'crah' && item.health > 0.85)
  if (candidates.length === 0) return
  const crah = candidates[Math.floor(world.random() * candidates.length)]
  crah.degradeTo = 0.58
  const alert = addAlert(world, { severity: 'warning', title: 'Fan bearing wearing out', targetId: crah.id })
  addTicket(world, { title: 'Replace fan bearing', targetId: crah.id, alertId: alert.id, needs: 'tech' })
}

function approachPoint(world, target) {
  if (target.kind === 'rack') return { x: target.x, z: target.aisleZ }
  return { x: target.x - target.side * 1.1, z: target.z }
}

// Units drive on a Manhattan grid: along their aisle to a side corridor, along the corridor, then into the target aisle.
function planPath(world, unit, destination) {
  const corridorX = world.layout.corridorX
  const side = Math.sign(unit.x + destination.x) || 1
  const corridor = side * corridorX
  const points = [
    { x: corridor, z: unit.z },
    { x: corridor, z: destination.z },
    { x: destination.x, z: destination.z },
  ]
  const path = points.filter((point, index) => {
    const previous = index === 0 ? unit : points[index - 1]
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 0.01
  })
  if (path.length === 0) path.push({ ...destination })
  return path
}

function pathLength(start, path) {
  let length = 0
  let previous = start
  for (const point of path) {
    length += Math.hypot(point.x - previous.x, point.z - previous.z)
    previous = point
  }
  return length
}

function sendUnit(world, unit, destination, purpose, task) {
  unit.path = planPath(world, unit, destination)
  unit.routeLength = Math.max(0.01, pathLength(unit, unit.path))
  unit.purpose = purpose
  unit.state = 'moving'
  unit.task = task
}

function isAvailable(unit) {
  if (unit.ticketId || unit.state === 'working' || unit.state === 'charging') return false
  return unit.kind !== 'robot' || unit.battery > LOW_BATTERY
}

function dispatchTickets(world) {
  for (const ticket of world.tickets) {
    if (ticket.status !== 'queued') continue
    const target = world.index.get(ticket.targetId)
    const destination = approachPoint(world, target)
    const candidates = world.units.filter((unit) => unit.kind === ticket.needs && isAvailable(unit))
    if (candidates.length === 0) continue
    const unit = candidates.reduce((best, candidate) =>
      Math.hypot(candidate.x - destination.x, candidate.z - destination.z) < Math.hypot(best.x - destination.x, best.z - destination.z) ? candidate : best)
    ticket.assigneeId = unit.id
    ticket.status = 'en route'
    unit.ticketId = ticket.id
    if (unit.kind === 'robot') unit.carrying = 'Spare GPU tray'
    sendUnit(world, unit, destination, 'ticket', `To ${target.name.replace('Cooling unit ', '')}`)
  }
}

function chooseNextMove(world, unit) {
  if (unit.kind === 'robot' && unit.battery < LOW_BATTERY) {
    sendUnit(world, unit, unit.home, 'dock', 'Low battery, heading to dock')
    return
  }
  const rack = world.racks[Math.floor(world.random() * world.racks.length)]
  const verb = unit.kind === 'robot' ? 'Patrolling' : 'Walking'
  sendUnit(world, unit, { x: rack.x, z: rack.aisleZ }, 'patrol', `${verb} to row ${rack.name.slice(-3, -2)}`)
  unit.inspectTarget = rack.name
}

function completeTicket(world, unit) {
  const ticket = world.index.get(unit.ticketId)
  const target = world.index.get(ticket.targetId)
  const alert = world.index.get(ticket.alertId)
  ticket.status = 'done'
  ticket.progress = 1
  ticket.closedAt = world.time
  alert.resolved = true
  if (target.kind === 'rack') target.failedTray = null
  else {
    delete target.degradeTo
    target.health = 0.97
  }
  unit.ticketId = null
  if (unit.kind === 'robot') {
    unit.carrying = 'Faulty GPU tray'
    sendUnit(world, unit, unit.home, 'dock', 'Returning faulty tray')
  } else {
    unit.state = 'idle'
    unit.task = 'Logging the repair'
    unit.waitUntil = world.time + 2
  }
}

function arrive(world, unit) {
  unit.speed = 0
  if (unit.purpose === 'ticket') {
    const ticket = world.index.get(unit.ticketId)
    ticket.status = 'in progress'
    unit.state = 'working'
    unit.workProgress = 0
    unit.task = unit.kind === 'robot' ? 'Swapping GPU tray' : 'Replacing fan bearing'
    const target = world.index.get(ticket.targetId)
    unit.heading = target.kind === 'rack' ? (target.facing > 0 ? Math.PI : 0) : (target.side > 0 ? Math.PI / 2 : -Math.PI / 2)
  } else if (unit.purpose === 'dock') {
    unit.carrying = null
    if (unit.kind === 'robot' && unit.battery < 0.85) {
      unit.state = 'charging'
      unit.task = 'Charging at dock'
    } else {
      unit.state = 'idle'
      unit.task = 'Docked'
      unit.waitUntil = world.time + 1.5
    }
  } else {
    unit.state = 'inspecting'
    unit.task = `Checking ${unit.inspectTarget}`
    unit.waitUntil = world.time + 1.8 + world.random() * 1.6
  }
}

function moveAlongPath(world, unit, dt) {
  unit.speed = approach(unit.speed, unit.maxSpeed, 3, dt)
  let budget = unit.speed * dt
  while (budget > 0 && unit.path.length > 0) {
    const next = unit.path[0]
    const dx = next.x - unit.x
    const dz = next.z - unit.z
    const distance = Math.hypot(dx, dz)
    if (distance > 0.001) unit.heading = Math.atan2(dx, dz)
    if (distance <= budget) {
      unit.x = next.x
      unit.z = next.z
      unit.path.shift()
      budget -= distance
    } else {
      unit.x += (dx / distance) * budget
      unit.z += (dz / distance) * budget
      budget = 0
    }
  }
  if (unit.kind === 'robot') unit.battery = Math.max(0, unit.battery - ROBOT_DRAIN_PER_SECOND * dt)
  if (unit.path.length === 0) arrive(world, unit)
}

function updateUnit(world, unit, dt) {
  if (unit.state === 'moving') {
    moveAlongPath(world, unit, dt)
    return
  }
  if (unit.state === 'working') {
    const ticket = world.index.get(unit.ticketId)
    unit.workProgress = Math.min(1, unit.workProgress + dt / (unit.kind === 'robot' ? SWAP_SECONDS : SERVICE_SECONDS))
    ticket.progress = unit.workProgress
    if (unit.kind === 'robot') unit.battery = Math.max(0, unit.battery - ROBOT_DRAIN_PER_SECOND * 0.5 * dt)
    if (unit.workProgress >= 1) completeTicket(world, unit)
    return
  }
  if (unit.state === 'charging') {
    unit.battery = Math.min(1, unit.battery + ROBOT_CHARGE_PER_SECOND * dt)
    if (unit.battery >= 0.95) {
      unit.state = 'idle'
      unit.task = 'Docked'
      unit.waitUntil = world.time + 0.5
    }
    return
  }
  if (world.time >= unit.waitUntil) chooseNextMove(world, unit)
}

function trimHistory(list, world) {
  const open = list.filter((item) => (item.kind === 'alert' ? !item.resolved : item.status !== 'done'))
  const closed = list.filter((item) => !open.includes(item)).slice(0, 6)
  for (const item of list) if (!open.includes(item) && !closed.includes(item)) world.index.delete(item.id)
  return list.filter((item) => open.includes(item) || closed.includes(item))
}

export function stepWorld(world, dt) {
  world.time += dt
  updateRacks(world, dt)
  updateJobs(world, dt)
  updateEquipment(world, dt)
  updateRun(world, dt)
  if (world.time >= world.nextIncidentAt) {
    startIncident(world)
    world.nextIncidentAt = world.time + 8 + world.random() * 6
    world.alerts = trimHistory(world.alerts, world)
    world.tickets = trimHistory(world.tickets, world)
  }
  dispatchTickets(world)
  for (const unit of world.units) updateUnit(world, unit, dt)
  updateTrends(world, dt)
}

// Slow moving averages give the KPI cards an honest "versus a minute ago" delta.
function updateTrends(world, dt) {
  const metrics = siteMetrics(world)
  if (!world.trend) world.trend = { ...metrics }
  for (const key of Object.keys(metrics)) world.trend[key] = approach(world.trend[key], metrics[key], 1 / 40, dt)
}

export function siteMetrics(world) {
  const tokensPerSecond = world.jobs.reduce((sum, job) => sum + job.tokensPerSecond, 0)
  const gpusBusy = world.racks.reduce((sum, rack) => sum + (rack.gpusBusy || 0), 0)
  const gpusTotal = world.racks.length * RACK.trays * RACK.gpusPerTray
  const crahs = world.equipment.filter((item) => item.kind === 'crah')
  const chillers = world.equipment.filter((item) => item.kind === 'chiller')
  const coolingStrain = crahs.reduce((sum, crah) => sum + (1 - crah.health), 0) / crahs.length
  const chillerLoad = chillers.reduce((sum, chiller) => sum + chiller.load, 0) / chillers.length
  const powerUsageEffectiveness = 1.09 + coolingStrain * 0.9 + chillerLoad * 0.04
  const itKilowatts = world.racks.reduce((sum, rack) => sum + rack.powerKw, 0)
  const powerMegawatts = (itKilowatts * powerUsageEffectiveness) / 1000
  return { tokensPerSecond, gpusBusy, gpusTotal, powerUsageEffectiveness, powerMegawatts }
}
