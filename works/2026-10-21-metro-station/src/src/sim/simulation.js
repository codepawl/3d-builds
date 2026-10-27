import { lines, stations, lineById, stationById, sites, CAR_CENTRES, TRAIN_HALF_LENGTH, LANE_OFFSET, PLATFORM_HALF_LENGTH } from '../data/network.js'
import { DepotSimulation } from './depot.js'

// Seeded random numbers so every run of the day looks the same.
export function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIXED_STEP = 0.1
const MAX_STEPS_PER_FRAME = 40
const SERVICE_BRAKE = 0.95
const ACCELERATION = 0.9
const SAFETY_MARGIN = 38
const CAR_CAPACITY = 1500
const SERVICE_DAY_START = 6 * 3600 + 12 * 60

// Station-local geometry shared with the renderer (u along the line, v to the left of travel).
export const STATION_GEOMETRY = {
  mezzanineHalfLength: 24.5,
  escalatorV: 2.6,
  escalatorU: 14,
  lipV: 15.05,
  gateV: 0.9,
  stairsTopU: 24.4,
  stairsBottomU: 34.6,
  stairsV: 2.6,
  platformHalfWidth: 5.3,
  elevatedEscalatorLowerV: 29,
}

export class Simulation {
  constructor(seed = 11) {
    this.random = createRandom(seed)
    this.time = 0
    this.accumulator = 0
    // Playback: speed only changes how many fixed steps run per frame, never the step length.
    this.speed = 1
    this.paused = false
    this.events = []
    this.eventTotal = 0
    this.nextAgentId = 1
    this.incidents = []
    this.nextIncidentId = 1
    this.trains = []
    this.agents = []
    this.departures = {}
    this.passengerEntries = []
    this.stationStates = {}
    this.depot = new DepotSimulation(this)
    this.timelineSteps = []
    this.timelineTrainId = 'H-01'
    this.scheduledIncidents = [
      { at: 330, lineId: 'H', stationId: 'H2', title: 'Door fault', detail: 'Door 3 on car 2 will not close', duration: 95 },
      { at: 780, lineId: 'C', stationId: 'C4', title: 'Door fault', detail: 'Platform door 2 out of sync', duration: 70 },
      { at: 1150, lineId: 'R', stationId: 'R3', title: 'Door fault', detail: 'Door 1 on car 5 stuck open', duration: 60 },
    ]
    this.substations = [
      { id: 'SS-1', name: 'Substation North', feeds: 'Harbour west', load: 0.52, phase: 0.3 },
      { id: 'SS-2', name: 'Substation Quay', feeds: 'Harbour east', load: 0.61, phase: 1.4 },
      { id: 'SS-3', name: 'Substation Cedar', feeds: 'Cedar line', load: 0.47, phase: 2.2 },
      { id: 'SS-4', name: 'Substation Depot', feeds: 'Depot yard', load: 0.38, phase: 3.1 },
    ]
    stations.forEach((station) => {
      this.stationStates[station.id] = {
        id: station.id,
        waiting: [18, 34, 52, 25, 14][Math.floor(this.random() * 5)] + Math.floor(this.random() * 20),
        entriesPerMinute: station.baseDemand * 3,
        crowding: 0.2,
        lastHeadway: null,
      }
    })
    this.createTrains()
    this.logIncident('info', 'Service day started', 'All lines running to timetable', null, null, true)
  }

  // ---------- setup ----------
  lineStations(lineId) {
    return stations.filter((station) => station.lineId === lineId).sort((a, b) => a.s - b.s)
  }

  createTrains() {
    lines.forEach((line) => {
      const count = line.fleet
      const half = count / 2
      for (let index = 0; index < count; index += 1) {
        const dir = index % 2 === 0 ? 1 : -1
        const slot = Math.floor(index / 2)
        const spacing = line.path.length / half
        const base = line.kind === 'loop' ? 60 + slot * spacing : 140 + slot * 330
        const s = dir > 0 ? base : line.kind === 'loop' ? base + spacing / 2 : base + 150
        const train = {
          id: `${line.short}-${String(index + 1).padStart(2, '0')}`,
          lineId: line.id,
          s: Math.min(line.path.length - 160, s),
          dir,
          speed: 0,
          state: 'run',
          doorOpen: 0,
          doorTarget: 0,
          dwellTimer: 0,
          dwellTotal: 0,
          load: 0.25 + this.random() * 0.4,
          delay: Math.floor(this.random() * 18),
          wheelAngle: 0,
          xover: null,
          fault: null,
          holdReason: '',
          authority: 0,
          lastStationId: null,
          atStationId: null,
          overrunTarget: 0,
          changeEndsTimer: 0,
          ghost: false,
          departedAt: 0,
        }
        this.trains.push(train)
      }
    })
    // The first Harbour train is the one the bottom timeline follows: it starts in the depot.
    const tracked = this.trains.find((train) => train.id === this.timelineTrainId)
    if (tracked) {
      tracked.ghost = true
      tracked.state = 'depot'
    }
    this.buildTimelineSteps()
  }

  buildTimelineSteps() {
    const harbour = this.lineStations('H')
    this.timelineSteps = [
      { id: 'leave', label: 'Leaves shed', detail: 'Depot stabling road 2', status: 'next', at: null },
      { id: 'wash', label: 'Wash plant', detail: 'Brush cycle 2.5 m/s', status: 'next', at: null },
      { id: 'service', label: 'Enters service', detail: 'Saltmarket turnback', status: 'next', at: null },
      ...harbour.slice(0, 3).map((station) => ({ id: `stop-${station.id}`, label: station.name, detail: station.interchange ? 'Interchange with Cedar' : 'Station stop', status: 'next', at: null, interchange: station.interchange })),
      { id: 'terminus', label: 'Eastgate', detail: 'Terminus, change ends', status: 'next', at: null },
      { id: 'turnback', label: 'Turnback', detail: 'Crossover to westbound road', status: 'next', at: null },
    ]
  }

  completeStep(stepId) {
    const step = this.timelineSteps.find((candidate) => candidate.id === stepId)
    if (step && step.status !== 'done') {
      step.status = 'done'
      step.at = this.time
      const next = this.timelineSteps.find((candidate) => candidate.status === 'next')
      if (next) next.status = 'active'
    }
  }

  enterService(trainId) {
    const train = this.trains.find((candidate) => candidate.id === trainId)
    if (!train) return
    train.ghost = false
    train.s = 63
    train.dir = -1
    train.speed = 0
    train.state = 'changeEnds'
    train.changeEndsTimer = 4
    train.delay = 0
    this.completeStep('service')
    this.logIncident('info', `${trainId} entered service`, 'Left depot, wash cycle complete', trainId, null, true)
  }

  // ---------- stepping ----------
  advance(deltaSeconds) {
    if (this.paused) return
    // Fractional speeds accumulate: 0.25x runs one fixed step every fourth frame at 10 ms frames, 5x runs five.
    this.accumulator += Math.min(deltaSeconds, 0.25) * this.speed
    let stepsThisFrame = 0
    while (this.accumulator >= FIXED_STEP && stepsThisFrame < MAX_STEPS_PER_FRAME) {
      this.stepOnce()
      this.accumulator -= FIXED_STEP
      stepsThisFrame += 1
    }
    if (this.accumulator >= FIXED_STEP) this.accumulator = FIXED_STEP * 0.999
  }

  // One fixed step with the pose captured first, so the renderer can blend it. Also the "Step" button while paused.
  stepOnce() {
    this.capturePrevious()
    this.step(FIXED_STEP)
  }

  // Appends to the event log the stage cameras and the tour wait on. Order is the simulation order, so it is the same at any speed.
  emit(kind, fields = {}) {
    this.eventTotal += 1
    this.events.push({ n: this.eventTotal, time: this.time, kind, ...fields })
    if (this.events.length > 600) this.events.shift()
  }

  // Which stage of a station visit a train is in (null between stations); drives the card's stage line.
  stageKeyOf(train) {
    if (train.ghost) return 'depot'
    if (train.state === 'changeEnds' || train.state === 'overrun') return 'turnback'
    if (train.state === 'dwell' || train.state === 'fault') {
      const progress = train.dwellTotal - train.dwellTimer
      return progress < 2.2 || train.state === 'fault' ? 'doors' : 'boarding'
    }
    if (train.lastStationId && train.departedS !== undefined && Math.abs(train.s - train.departedS) < 150) return 'departs'
    return null
  }

  trackStages() {
    this.trains.forEach((train) => {
      const key = this.stageKeyOf(train)
      if (key !== train.stageKey) {
        train.stageKey = key
        train.stageSince = this.time
      }
    })
  }

  // Fraction of the next fixed step already elapsed; the renderer blends the previous and current pose with it.
  get alpha() {
    return Math.min(1, Math.max(0, this.accumulator / FIXED_STEP))
  }

  // Time the renderer shows: the sim runs whole steps, the picture trails by the unconsumed remainder.
  get renderTime() {
    return this.time - FIXED_STEP + this.alpha * FIXED_STEP
  }

  // Stores the pose before a step so rendering can interpolate between two fixed steps.
  capturePrevious() {
    const keep = (item, keys) => {
      const previous = item.previous ?? (item.previous = {})
      keys.forEach((key) => { previous[key] = item[key] })
    }
    this.trains.forEach((train) => keep(train, ['s', 'doorOpen', 'wheelAngle']))
    this.depot.trains.forEach((train) => keep(train, ['s', 'wheelAngle', 'centreX', 'centreZ']))
    this.agents.forEach((agent) => keep(agent, ['u', 'v', 'y']))
  }

  // Interpolated value of a numeric field. A jump larger than maxJump (teleport, turnback) is not blended.
  blend(item, key, maxJump = Infinity) {
    const current = item[key]
    const before = item.previous?.[key]
    if (globalThis.__noInterpolation) return current // measurement switch: show the raw fixed-step pose
    if (before === undefined || Math.abs(current - before) > maxJump) return current
    return before + (current - before) * this.alpha
  }

  runFor(seconds) {
    const steps = Math.round(seconds / FIXED_STEP)
    for (let index = 0; index < steps; index += 1) this.step(FIXED_STEP)
  }

  step(dt) {
    this.time += dt
    this.updateIncidents()
    this.depot.step(dt)
    this.trains.forEach((train) => {
      if (train.ghost) return
      this.updateTrain(train, dt)
    })
    this.updateStations(dt)
    this.updateAgents(dt)
    this.trackStages()
    this.substations.forEach((substation) => {
      const base = substation.load
      substation.current = Math.max(0.2, Math.min(0.98, base + 0.18 * Math.sin(this.time / 40 + substation.phase) + this.nearbyTrainsLoad(substation) * 0.02))
    })
  }

  nearbyTrainsLoad(substation) {
    return this.trains.filter((train) => !train.ghost && train.speed > 3).length / (this.substations.length * 2)
  }

  updateIncidents() {
    this.scheduledIncidents.forEach((scheduled) => {
      if (scheduled.started || this.time < scheduled.at) return
      const candidates = this.trains.filter((train) => train.lineId === scheduled.lineId && !train.ghost)
      const station = stationById[scheduled.stationId]
      if (!station) return
      // Pick the train closest to the station so the fault shows up where it is named.
      const sorted = [...candidates].sort((a, b) => Math.abs(a.s - station.s) - Math.abs(b.s - station.s))
      const victim = sorted[0]
      if (!victim) return
      scheduled.started = true
      victim.fault = { remaining: scheduled.duration, armed: true, stationId: station.id, incidentId: null }
      scheduled.victimId = victim.id
    })
  }

  logIncident(severity, title, detail, trainId, stationId, resolved = false) {
    const incident = {
      id: `INC-${String(this.nextIncidentId).padStart(3, '0')}`,
      severity, title, detail, trainId, stationId,
      startedAt: this.time,
      resolvedAt: resolved ? this.time : null,
    }
    this.nextIncidentId += 1
    this.incidents.unshift(incident)
    return incident
  }

  // ---------- trains ----------
  leaderGap(train, line) {
    const half = TRAIN_HALF_LENGTH
    let best = Infinity
    let leader = null
    const length = line.path.length
    this.trains.forEach((other) => {
      if (other === train || other.lineId !== train.lineId || other.ghost || other.dir !== train.dir) return
      let distance = (other.s - train.s) * train.dir
      if (line.kind === 'loop') distance = ((distance % length) + length) % length
      if (distance <= 0) return
      const gap = distance - 2 * half
      if (gap < best) {
        best = gap
        leader = other
      }
    })
    return { gap: best, leader }
  }

  nextStation(train, line) {
    const list = this.lineStations(train.lineId)
    const length = line.path.length
    let best = null
    let bestDistance = Infinity
    list.forEach((station) => {
      let distance = (station.s - train.s) * train.dir
      if (line.kind === 'loop') distance = ((distance % length) + length) % length
      const eligible = distance > 0.5 || (distance > -0.01 && train.lastStationId !== station.id)
      if (eligible && distance < bestDistance) {
        bestDistance = distance
        best = station
      }
    })
    return { station: best, distance: bestDistance }
  }

  updateTrain(train, dt) {
    const line = lineById[train.lineId]
    const length = line.path.length
    train.wheelAngle += (train.speed * dt) / 0.46

    if (train.state === 'dwell' || train.state === 'fault') {
      this.updateDwell(train, line, dt)
      return
    }
    if (train.state === 'changeEnds') {
      train.changeEndsTimer -= dt
      train.doorOpen = Math.max(0, train.doorOpen - dt)
      if (train.changeEndsTimer <= 0) {
        const outward = train.dir
        const farS = outward > 0 ? length - 130 : 130
        const nearS = outward > 0 ? length - 180 : 180
        train.xover = { sx0: farS, sx1: nearS, fromOff: -LANE_OFFSET * outward, toOff: LANE_OFFSET * outward }
        train.dir = -outward
        train.state = 'run'
        this.emit('turnback', { trainId: train.id, lineId: train.lineId, stationId: train.lastStationId, dir: train.dir })
        train.holdReason = ''
        if (train.id === this.timelineTrainId && this.timelineSteps.find((step) => step.id === 'terminus')?.status === 'done') this.completeStep('turnback')
      }
      return
    }

    // Target speed: cruise, braking curve to the stop, moving-block limit behind the train ahead.
    let targetStop = null
    let stopDistance = Infinity
    if (train.state === 'overrun') {
      targetStop = train.overrunTarget
      stopDistance = (train.overrunTarget - train.s) * train.dir
    } else {
      const next = this.nextStation(train, line)
      if (next.station) {
        targetStop = next.station.s
        stopDistance = next.distance
      }
    }
    const brakingSpeed = Math.sqrt(2 * SERVICE_BRAKE * Math.max(0, stopDistance))
    const { gap, leader } = this.leaderGap(train, line)
    const leaderSpeed = Math.sqrt(2 * SERVICE_BRAKE * Math.max(0, gap - SAFETY_MARGIN))
    let cruise = train.state === 'overrun' ? 6 : line.cruise
    if (train.xover) cruise = 6
    const target = Math.min(cruise, brakingSpeed, leaderSpeed)
    if (target < train.speed) train.speed = Math.max(target, train.speed - SERVICE_BRAKE * 1.25 * dt)
    else train.speed = Math.min(target, train.speed + ACCELERATION * dt)
    train.holdReason = leaderSpeed < Math.min(cruise, brakingSpeed) - 0.4 && train.speed < 3 ? 'Waiting for train ahead' : ''
    train.authority = Math.min(Math.max(0, gap - SAFETY_MARGIN), (train.speed * train.speed) / (2 * SERVICE_BRAKE) + 18)

    // Never move past the mark: the train glides onto it, so the screen doors and train doors meet to the millimetre.
    const travel = targetStop !== null ? Math.min(train.speed * dt, Math.max(0, stopDistance)) : train.speed * dt
    train.s += train.dir * travel
    if (line.kind === 'loop') train.s = ((train.s % length) + length) % length

    if (train.xover) {
      const passed = (train.s - train.xover.sx1) * train.dir
      if (passed > TRAIN_HALF_LENGTH + 6) train.xover = null
    }

    if (targetStop !== null && stopDistance - travel < 0.005 && train.speed < 0.7) {
      train.speed = 0
      train.s = targetStop
      if (train.state === 'overrun') {
        train.state = 'changeEnds'
        train.changeEndsTimer = 12
        return
      }
      this.arriveAtStation(train, line, this.nextStationAt(train, targetStop))
    }
  }

  nextStationAt(train, s) {
    return this.lineStations(train.lineId).find((station) => Math.abs(station.s - s) < 1)
  }

  arriveAtStation(train, line, station) {
    train.state = 'dwell'
    train.atStationId = station.id
    train.lastStationId = station.id
    ;(train.stopLog ??= {})[station.id] = this.time
    const stationState = this.stationStates[station.id]
    const alight = Math.round(CAR_CAPACITY * train.load * (0.22 + this.random() * 0.2))
    const boarding = Math.min(stationState.waiting, Math.round(CAR_CAPACITY * (0.9 - train.load * 0.7)))
    train.load = Math.max(0.05, Math.min(0.98, train.load - alight / CAR_CAPACITY + boarding / CAR_CAPACITY))
    stationState.waiting = Math.max(0, stationState.waiting - boarding)
    stationState.lastBoarded = boarding
    stationState.lastAlighted = alight
    train.dwellTotal = station.terminal ? 22 : 13 + this.random() * 5
    train.dwellTimer = train.dwellTotal
    train.doorPhase = 0
    train.doorsOpenEmitted = false
    train.doorsClosedEmitted = false
    this.emit('arrive', { trainId: train.id, lineId: train.lineId, stationId: station.id, dir: train.dir })
    // Passengers stepping off: a visible sample of the real count.
    const visible = Math.min(14, Math.round(alight / 18))
    for (let index = 0; index < visible; index += 1) this.spawnAlighting(station, train, index)
    // Timeline for the tracked train.
    if (train.id === this.timelineTrainId) {
      this.completeStep(`stop-${station.id}`)
      if (station.id === 'H5') this.completeStep('terminus')
    }
    if (station.terminal) {
      const outward = (station.s < line.path.length / 2 ? -1 : 1)
      train.terminalOutward = outward === train.dir
    }
  }

  updateDwell(train, line, dt) {
    const station = stationById[train.atStationId]
    const progress = train.dwellTotal - train.dwellTimer
    const faulted = train.fault && train.fault.remaining > 0 && train.fault.armed
    if (faulted && !train.fault.announced) {
      train.fault.announced = true
      const scheduled = this.scheduledIncidents.find((candidate) => candidate.victimId === train.id && !candidate.incident)
      if (scheduled) scheduled.incident = this.logIncident('fault', scheduled.title, `${scheduled.detail} - ${train.id} at ${station.name}`, train.id, station.id)
      train.delay += 5
    }
    if (faulted) {
      train.state = 'fault'
      train.fault.remaining -= dt
      train.delay += dt * 0.9
      // Doors keep trying to close but never latch.
      train.doorTarget = 0
      train.doorOpen = 0.55 + 0.45 * Math.abs(Math.sin(this.time * 0.9))
      if (train.fault.remaining <= 0) {
        train.fault.armed = false
        const scheduled = this.scheduledIncidents.find((candidate) => candidate.victimId === train.id)
        if (scheduled && scheduled.incident) scheduled.incident.resolvedAt = this.time
        train.state = 'dwell'
        train.dwellTimer = 3
        train.dwellTotal = 6
      }
      this.maybeSpawnBoarding(train, station, dt)
      return
    }
    train.dwellTimer -= dt
    const closeStart = train.dwellTotal - 3.5
    const target = progress < 2.2 ? 0 : progress > closeStart ? 0 : 1
    train.doorTarget = target
    train.doorOpen += Math.sign(target - train.doorOpen) * Math.min(Math.abs(target - train.doorOpen), dt * 0.9)
    if (!train.doorsOpenEmitted && train.doorOpen >= 0.95) {
      train.doorsOpenEmitted = true
      this.emit('doorsOpen', { trainId: train.id, lineId: train.lineId, stationId: station.id, dir: train.dir })
    }
    if (!train.doorsClosedEmitted && progress > 2.2 && train.doorsOpenEmitted && train.doorOpen <= 0.01) {
      train.doorsClosedEmitted = true
      this.emit('doorsClosed', { trainId: train.id, lineId: train.lineId, stationId: station.id, dir: train.dir })
    }
    this.maybeSpawnBoarding(train, station, dt)
    if (train.dwellTimer > 0) return
    const { gap } = this.leaderGap(train, line)
    if (gap < SAFETY_MARGIN + 25) {
      train.holdReason = 'Held at platform'
      return
    }
    if (train.doorOpen > 0.01) return
    train.holdReason = ''
    this.recordDeparture(train, station)
    train.departedS = train.s
    this.emit('depart', { trainId: train.id, lineId: train.lineId, stationId: station.id, dir: train.dir })
    const atEnd = station.terminal && train.terminalOutward
    if (atEnd) {
      train.state = 'overrun'
      train.overrunTarget = train.dir > 0 ? line.path.length - 63 : 63
      if (train.id === this.timelineTrainId && station.id === 'H5') this.completeStep('terminus')
    } else {
      train.state = 'run'
    }
    train.atStationId = null
  }

  recordDeparture(train, station) {
    const key = `${station.id}:${train.dir}`
    const previous = this.departures[key]
    if (previous !== undefined) {
      const headway = this.time - previous
      const state = this.stationStates[station.id]
      state.lastHeadway = headway
      const list = (this.headwaySamples ??= {})
      const lineList = (list[station.lineId] ??= [])
      lineList.push(headway)
      if (lineList.length > 10) lineList.shift()
    }
    this.departures[key] = this.time
    const lateness = train.delay
    const samples = (this.onTimeSamples ??= {})
    const lineSamples = (samples[station.lineId] ??= [])
    lineSamples.push(lateness < 75 ? 1 : 0)
    if (lineSamples.length > 24) lineSamples.shift()
    // A little recovery at each stop: drivers shave the dwell.
    train.delay = Math.max(0, train.delay - 6)
  }

  // ---------- stations and passengers ----------
  rushFactor() {
    const hours = ((SERVICE_DAY_START + this.time) / 3600) % 24
    const morning = Math.exp(-Math.pow((hours - 8.2) / 1.1, 2))
    return 0.8 + 1.4 * morning
  }

  updateStations(dt) {
    const rush = this.rushFactor()
    stations.forEach((station) => {
      const state = this.stationStates[station.id]
      const rate = (station.baseDemand * 3 * rush) / 60
      state.arrivalAccumulator = (state.arrivalAccumulator || 0) + rate * dt
      while (state.arrivalAccumulator >= 1) {
        state.arrivalAccumulator -= 1
        state.waiting = Math.min(380, state.waiting + 1)
        this.passengerEntries.push({ stationId: station.id, at: this.time })
        state.visibleSpawnCounter = (state.visibleSpawnCounter || 0) + 1
        if (state.visibleSpawnCounter >= 3) {
          state.visibleSpawnCounter = 0
          this.spawnEntering(station)
        }
      }
      state.crowding = Math.min(1, state.waiting / 260)
    })
    while (this.passengerEntries.length > 0 && this.passengerEntries[0].at < this.time - 60) this.passengerEntries.shift()
    const counts = {}
    this.passengerEntries.forEach((entry) => {
      counts[entry.stationId] = (counts[entry.stationId] || 0) + 1
    })
    stations.forEach((station) => {
      this.stationStates[station.id].entriesPerMinute = counts[station.id] || 0
    })
  }

  entranceWaypoints(station, side) {
    const geometry = STATION_GEOMETRY
    const line = lineById[station.lineId]
    const sign = side
    const rail = 0
    if (line.buried) {
      // side +1 is the first entrance (west end of the platform), -1 the second; both sit on the far side of the cut.
      const farSide = this.stationStates[station.id].entranceSide ?? 1
      const entranceU = -sign * geometry.escalatorU
      const stairsU = -sign
      return {
        lip: [entranceU, farSide * geometry.lipV, rail + 12.1],
        escalatorLow: [entranceU, farSide * geometry.escalatorV, rail + 6.65],
        gate: [entranceU, farSide * geometry.gateV, rail + 6.65],
        stairsTop: [stairsU * geometry.stairsTopU, -sign * farSide * geometry.stairsV, rail + 6.65],
        stairsBottom: [stairsU * geometry.stairsBottomU, -sign * farSide * geometry.stairsV, rail + 1.15],
      }
    }
    const platformY = 1.15
    const k = (line.railY + 1.1) / 5.5
    return {
      lip: [-sign * 20, sign * (geometry.elevatedEscalatorLowerV), -line.railY + 0.1],
      escalatorLow: [-sign * 20, sign * geometry.elevatedEscalatorLowerV, -line.railY + 0.1],
      gate: [-sign * 20, sign * 10.2, platformY],
      stairsTop: [-sign * 20, sign * 9.2, platformY],
      stairsBottom: [-sign * 20, sign * 9.2, platformY],
      k,
    }
  }

  spawnEntering(station) {
    if (this.agents.length > 420) return
    const waitingHere = this.agents.filter((agent) => agent.stationId === station.id && agent.kind === 'entering').length
    if (waitingHere > 26) return
    const side = this.random() < 0.5 ? 1 : -1
    const way = this.entranceWaypoints(station, side)
    const travelDirection = this.random() < 0.5 ? 1 : -1
    const platformSide = -travelDirection
    const spotU = (this.random() - 0.5) * 2 * (PLATFORM_HALF_LENGTH - 8)
    const spotV = platformSide * (2.6 + this.random() * 1.6)
    const line = lineById[station.lineId]
    const y = line.buried ? 1.15 : 1.15
    const path = [way.lip, way.escalatorLow, way.gate]
    if (line.buried) path.push(way.stairsTop, way.stairsBottom)
    path.push([spotU, spotV, y])
    this.agents.push(this.makeAgent(station, path, 'entering', { travelDirection, stationBase: line.buried ? 0 : 0 }))
  }

  spawnAlighting(station, train, index) {
    if (this.agents.length > 420) return
    const line = lineById[station.lineId]
    const platformSide = -train.dir
    const doorU = (this.random() - 0.5) * 2 * 50
    const exitSide = this.random() < 0.5 ? 1 : -1
    const way = this.entranceWaypoints(station, exitSide)
    const start = [doorU, platformSide * 5.0, 1.15]
    const path = [start, [doorU, platformSide * 3.4, 1.15]]
    if (line.buried) path.push(way.stairsBottom, way.stairsTop)
    path.push(way.gate)
    if (line.buried) path.push(way.escalatorLow)
    path.push(way.lip)
    const agent = this.makeAgent(station, path, 'exiting', { delay: index * 0.6 + this.random() * 1.2 })
    this.agents.push(agent)
  }

  makeAgent(station, path, kind, extra = {}) {
    return {
      id: this.nextAgentId++,
      stationId: station.id,
      path,
      segment: 0,
      segmentT: 0,
      kind,
      waiting: false,
      boardingTarget: null,
      wait: extra.delay || 0,
      phase: this.random() * 6.28,
      variant: Math.floor(this.random() * 3),
      done: false,
      travelDirection: extra.travelDirection || 0,
      u: path[0][0],
      v: path[0][1],
      y: path[0][2],
      heading: 0,
    }
  }

  maybeSpawnBoarding(train, station, dt) {
    // Waiting passengers on the platform side of this train walk to the nearest door and board.
    if (train.doorOpen < 0.6) return
    this.agents.forEach((agent) => {
      if (agent.stationId !== station.id || agent.kind !== 'entering' || !agent.waiting || agent.travelDirection !== train.dir) return
      if (agent.boardingTarget) return
      if (this.random() < 0.08 * dt * 10) {
        const doorU = Math.round(agent.u / 4.9) * 4.9
        agent.boardingTarget = [[agent.u, agent.v, 1.15], [doorU, agent.v, 1.15], [doorU, -agent.travelDirection * 5.6, 1.15]]
        agent.boardSegments = agent.boardingTarget
        agent.segment = 0
        agent.segmentT = 0
        agent.path = agent.boardingTarget
        agent.waiting = false
        agent.kind = 'boarding'
      }
    })
  }

  updateAgents(dt) {
    const survivors = []
    this.agents.forEach((agent) => {
      if (agent.wait > 0) {
        agent.wait -= dt
        survivors.push(agent)
        return
      }
      if (agent.waiting) {
        survivors.push(agent)
        return
      }
      const from = agent.path[agent.segment]
      const to = agent.path[agent.segment + 1]
      if (!to) {
        if (agent.kind === 'entering') {
          agent.waiting = true
          survivors.push(agent)
        }
        return
      }
      const dx = to[0] - from[0]
      const dv = to[1] - from[1]
      const dy = to[2] - from[2]
      const distance = Math.hypot(dx, dv, dy) || 0.01
      const slope = Math.abs(dy) > 0.5
      const speed = slope ? 0.6 : 1.25
      agent.segmentT += (speed * dt) / distance
      const t = Math.min(1, agent.segmentT)
      agent.u = from[0] + dx * t
      agent.v = from[1] + dv * t
      agent.y = from[2] + dy * t
      agent.heading = Math.atan2(dv, dx)
      if (agent.segmentT >= 1) {
        agent.segment += 1
        agent.segmentT = 0
        if (agent.kind === 'entering') {
          if (agent.segment === 1) this.emit('escalator', { stationId: agent.stationId, agentId: agent.id })
          if (agent.segment === 2) this.emit('gate', { stationId: agent.stationId, agentId: agent.id })
        }
        if (agent.segment >= agent.path.length - 1) {
          if (agent.kind === 'entering') agent.waiting = true
          else {
            agent.u = to[0]
            agent.v = to[1]
            agent.y = to[2]
            return
          }
        }
      }
      survivors.push(agent)
    })
    this.agents = survivors
  }

  // ---------- readouts ----------
  clockText() {
    const total = Math.floor(SERVICE_DAY_START + this.time)
    const hours = Math.floor(total / 3600) % 24
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  }

  trainStatus(train) {
    if (train.ghost) return 'depot'
    if (train.state === 'fault') return 'fault'
    if (train.holdReason) return 'held'
    if (train.state === 'dwell') return 'dwell'
    if (train.state === 'changeEnds') return 'turnback'
    return 'running'
  }

  lineHeadway(lineId) {
    const samples = this.headwaySamples?.[lineId]
    if (!samples || samples.length === 0) return null
    return samples.reduce((sum, value) => sum + value, 0) / samples.length
  }

  onTime(lineId) {
    const samples = this.onTimeSamples?.[lineId]
    if (!samples || samples.length === 0) return 1
    return samples.reduce((sum, value) => sum + value, 0) / samples.length
  }

  kpis(siteId) {
    const site = sites.find((candidate) => candidate.id === siteId)
    if (site.id === 'depot') {
      const depotTrains = this.depot.trains
      const inDepot = depotTrains.filter((train) => train.stage !== 'gone').length
      return {
        first: { label: 'Trains in depot', value: String(inDepot), note: `of ${depotTrains.length} assigned` },
        second: { label: 'Wash cycles today', value: String(this.depot.washCycles), note: 'brush plant' },
        third: { label: 'Work orders open', value: String(this.depot.openTasks()), note: 'workshop roads 1-2' },
        fourth: { label: 'Fleet available', value: `${Math.round((this.depot.availability()) * 100)}%`, note: 'ready for service' },
      }
    }
    const lineList = lines.filter((line) => site.lineIds.includes(line.id))
    const inService = this.trains.filter((train) => !train.ghost && lineList.some((line) => line.id === train.lineId)).length
    const headways = lineList.map((line) => this.lineHeadway(line.id)).filter((value) => value !== null)
    const headway = headways.length ? headways.reduce((sum, value) => sum + value, 0) / headways.length : null
    const onTimeRates = lineList.map((line) => this.onTime(line.id))
    const onTime = onTimeRates.reduce((sum, value) => sum + value, 0) / onTimeRates.length
    const lineIds = lineList.map((line) => line.id)
    const perMinute = stations.filter((station) => lineIds.includes(station.lineId)).reduce((sum, station) => sum + this.stationStates[station.id].entriesPerMinute, 0)
    return {
      first: { label: 'Trains in service', value: String(inService), note: `${this.trains.filter((train) => train.ghost).length} in depot` },
      second: { label: 'Average headway', value: headway === null ? '-' : `${Math.floor(headway / 60)}:${String(Math.round(headway % 60)).padStart(2, '0')}`, note: 'minutes per train' },
      third: { label: 'On time', value: `${Math.round(onTime * 100)}%`, note: 'within 75 s of timetable' },
      fourth: { label: 'Passengers per hour', value: perMinute * 60 >= 1000 ? `${((perMinute * 60) / 1000).toFixed(1)}k` : String(Math.round(perMinute * 60)), note: 'gate entries' },
    }
  }

  // Aspect of a signal mast for trains travelling `dir` at position `s` on a line.
  signalAspect(lineId, dir, s) {
    const line = lineById[lineId]
    const ahead = (train, distance) => {
      if (train.ghost || train.lineId !== lineId || train.dir !== dir) return false
      const front = train.s + dir * TRAIN_HALF_LENGTH
      const rear = train.s - dir * TRAIN_HALF_LENGTH
      const lo = Math.min(front, rear)
      const hi = Math.max(front, rear)
      const from = Math.min(s, s + dir * distance)
      const to = Math.max(s, s + dir * distance)
      return hi >= from && lo <= to
    }
    if (this.trains.some((train) => ahead(train, 130))) return 'red'
    if (this.trains.some((train) => ahead(train, 260))) return 'yellow'
    return 'green'
  }
}

export function createSimulation() {
  return new Simulation()
}

export { CAR_CENTRES }
