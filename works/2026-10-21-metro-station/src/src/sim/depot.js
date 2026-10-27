import { PathSampler, smoothstep } from './path.js'
import { depotLayout, TRAIN_HALF_LENGTH } from '../data/network.js'

function sCurve(x0, z0, x1, z1, pieces = 18) {
  const points = []
  for (let index = 0; index <= pieces; index += 1) {
    const t = index / pieces
    points.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * smoothstep(t)])
  }
  return points
}

const WASH_HALF = 22
const TASK_TITLES = ['Brake pad inspection', 'Bogie lubrication', 'Door drive service', 'Pantograph wear check', 'Interior deep clean', 'Wheel profile turning']

// The depot is a small deterministic yard: trains leave a road, pass the wash plant and head out to the line,
// and other trains come back from the west and take the free road.
export class DepotSimulation {
  constructor(simulation) {
    this.simulation = simulation
    this.layout = depotLayout
    this.slots = [
      ...depotLayout.stablingZ.map((z, index) => ({ id: `Road ${index + 1}`, z, kind: 'stabling' })),
      ...depotLayout.workshopZ.map((z, index) => ({ id: `Workshop ${index + 1}`, z, kind: 'workshop' })),
    ]
    this.arrivalRoutes = this.slots.map((slot) => this.buildArrival(slot))
    this.departureRoutes = this.slots.map((slot) => this.buildDeparture(slot))
    this.taskCounter = 1040
    this.trains = this.slots.map((slot, index) => ({
      id: `D-${index + 1}`,
      slotIndex: index,
      stage: slot.kind === 'workshop' ? 'maintenance' : 'stored',
      route: null,
      s: 0,
      speed: 0,
      wheelAngle: 0,
      timer: 0,
      centreX: depotLayout.stableCentreX,
      centreZ: slot.z,
      task: slot.kind === 'workshop' ? this.newTask(index) : null,
    }))
    this.departCountdown = 6
    this.washCycles = 3
    this.washActive = false
    this.brushAngle = 0
    this.departuresMade = 0
    this.trackedDeparted = false
  }

  newTask(index) {
    this.taskCounter += 1
    return {
      id: `WO-${this.taskCounter}`,
      title: TASK_TITLES[(index + this.taskCounter) % TASK_TITLES.length],
      progress: 0.2 + 0.5 * (((index * 37) % 10) / 10),
      rate: 1 / 150,
    }
  }

  buildArrival(slot) {
    const [fanA, fanB] = depotLayout.westFan
    const points = [[depotLayout.leadStart, 0], [fanA, 0], ...sCurve(fanA, 0, fanB, slot.z), [depotLayout.stableCentreX, slot.z]]
    return new PathSampler(points, { step: 2 })
  }

  buildDeparture(slot) {
    const [fanA, fanB] = depotLayout.eastFan
    const points = [[depotLayout.stableCentreX, slot.z], [fanA, slot.z], ...sCurve(fanA, slot.z, fanB, 0), [depotLayout.leadEnd, 0]]
    return new PathSampler(points, { step: 2 })
  }

  openTasks() {
    return this.trains.filter((train) => train.task && train.stage === 'maintenance').length + 3
  }

  availability() {
    const inMaintenance = this.trains.filter((train) => train.stage === 'maintenance').length
    const total = this.trains.length + this.simulation.trains.length
    return (total - inMaintenance) / total
  }

  step(dt) {
    this.washActive = false
    this.departCountdown -= dt
    if (this.departCountdown <= 0) {
      const candidate = this.trains.find((train, index) => train.stage === 'stored' && (this.departuresMade > 0 || index === 1))
      if (candidate) this.depart(candidate)
      this.departCountdown = 70
    }
    this.trains.forEach((train) => {
      if (train.stage === 'maintenance' && train.task) {
        train.task.progress += train.task.rate * dt
        if (train.task.progress >= 1) {
          train.task = this.newTask(train.slotIndex)
          train.task.progress = 0
        }
      }
      if (train.stage === 'departing') this.moveDeparting(train, dt)
      else if (train.stage === 'arriving') this.moveArriving(train, dt)
      else if (train.stage === 'gone') {
        train.timer -= dt
        if (train.timer <= 0) this.beginArrival(train)
      }
    })
    if (this.washActive) this.brushAngle += dt * 5
  }

  depart(train) {
    train.stage = 'departing'
    train.route = this.departureRoutes[train.slotIndex]
    train.s = 0
    train.speed = 0
    this.departuresMade += 1
    const isTracked = !this.trackedDeparted
    train.trackedForTimeline = isTracked
    if (isTracked) {
      this.trackedDeparted = true
      this.simulation.completeStep('leave')
    }
  }

  moveDeparting(train, dt) {
    const pose = train.route.at(train.s)
    const nearWash = Math.abs(pose.x - depotLayout.washX) < WASH_HALF + TRAIN_HALF_LENGTH
    const limit = nearWash ? 2.6 : pose.x > depotLayout.eastFan[0] ? 9 : 5
    if (nearWash) this.washActive = true
    const wasBefore = pose.x < depotLayout.washX
    train.speed += Math.sign(limit - train.speed) * Math.min(Math.abs(limit - train.speed), (limit > train.speed ? 0.8 : 1.5) * dt)
    train.s += train.speed * dt
    train.wheelAngle += (train.speed * dt) / 0.46
    const after = train.route.at(train.s)
    train.centreX = after.x
    train.centreZ = after.z
    if (wasBefore && after.x >= depotLayout.washX) {
      this.washCycles += 1
      if (train.trackedForTimeline) this.simulation.completeStep('wash')
    }
    if (after.x > depotLayout.leadEnd - 4) {
      train.stage = 'gone'
      train.timer = 140
      train.route = null
      if (train.trackedForTimeline) {
        this.simulation.enterService('H-01')
        train.trackedForTimeline = false
      }
    }
  }

  beginArrival(train) {
    const free = this.slots.findIndex((slot, index) => slot.kind === 'stabling' && !this.trains.some((other) => other !== train && other.slotIndex === index && other.stage !== 'gone'))
    if (free < 0) {
      train.timer = 20
      return
    }
    train.slotIndex = free
    train.route = this.arrivalRoutes[free]
    train.stage = 'arriving'
    train.s = -60
    train.speed = 8
  }

  moveArriving(train, dt) {
    const total = train.route.length
    const remaining = total - train.s
    const brake = Math.sqrt(2 * 0.8 * Math.max(0, remaining - 0.1))
    const limit = Math.min(train.route.at(train.s).x > depotLayout.westFan[0] ? 5 : 9, brake)
    train.speed += Math.sign(limit - train.speed) * Math.min(Math.abs(limit - train.speed), 1.2 * dt)
    train.s += train.speed * dt
    train.wheelAngle += (train.speed * dt) / 0.46
    const pose = train.route.at(train.s)
    train.centreX = pose.x
    train.centreZ = pose.z
    if (remaining < 0.35 && train.speed < 0.6) {
      train.stage = 'stored'
      train.speed = 0
      train.route = null
      train.centreX = depotLayout.stableCentreX
      train.centreZ = this.slots[train.slotIndex].z
    }
  }
}
