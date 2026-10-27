import { PHASE, flightGeometry, siteById, shipSpec, CHAMBER_LENGTH, CHAMBER_WIDTH, LIFT } from '../data/canal.js'

const FIXED_STEP = 1 / 60
const SHIP_COUNT = 16
const QUEUE_SPACING = 380
const QUEUE_SHIFT_SECONDS = 30
const MINIMUM_GAP = 40
const WAIT_DISTANCE = 250
const OUT_DISTANCE = 255
const DEPART_DISTANCE = 760
const FILL_EASE = 0.6 // share of the fill that runs at constant speed, the rest is eased

const smooth = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}
export const easeMove = smooth
export const fillCurve = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return FILL_EASE * clamped + (1 - FILL_EASE) * smooth(clamped)
}
const lerp = (from, to, amount) => from + (to - from) * amount

// A lane carries ships one at a time through the chambers. The whole schedule is computed once and evaluated by time.
class Lane {
  constructor(geometry, laneId, uphill, offset) {
    this.geometry = geometry
    this.id = laneId
    this.uphill = uphill
    this.offset = offset
    const chambers = geometry.chambers
    this.order = uphill ? [...Array(chambers).keys()] : [...Array(chambers).keys()].reverse()
    this.rest = uphill ? 0 : 1
    this.waitS = uphill ? geometry.gateS(0) - WAIT_DISTANCE : geometry.gateS(chambers) + WAIT_DISTANCE
    this.outS = uphill ? geometry.gateS(chambers) + OUT_DISTANCE : geometry.gateS(0) - OUT_DISTANCE
    this.departS = uphill ? this.outS + DEPART_DISTANCE : this.outS - DEPART_DISTANCE
    this.levelSegments = Array.from({ length: chambers }, () => [])
    this.gateEvents = Array.from({ length: chambers + 1 }, () => [])
    this.events = []
    this.ships = []
    this.build()
  }

  gateIn(chamber) { return this.uphill ? chamber : chamber + 1 }
  gateOut(chamber) { return this.uphill ? chamber + 1 : chamber }

  build() {
    const { geometry, order, rest } = this
    const freeAt = Array(geometry.chambers).fill(0)
    let previousStart = -MINIMUM_GAP
    const levelY = (chamber, fraction) => lerp(geometry.lowY(chamber), geometry.highY(chamber), fraction)
    const addEvent = (time, text, kind, shipIndex, chamber) => this.events.push({ time, text, kind, shipIndex, chamber })
    for (let index = 0; index < SHIP_COUNT; index += 1) {
      const spec = shipSpec(this.id, index)
      const segments = []
      const first = order[0]
      const startMove = Math.max(freeAt[first] + PHASE.open, previousStart + MINIMUM_GAP)
      previousStart = startMove
      const ship = { index, spec, segments, startMove }
      const entryGate = this.gateIn(first)
      // The entry gate stays open while the ship tows in and closes behind it, as the next chambers' gates already do.
      const entryEvent = { open0: startMove - PHASE.open, open1: startMove, close0: startMove + PHASE.approach, close1: startMove + PHASE.approach + PHASE.close }
      this.gateEvents[entryGate].push(entryEvent)
      addEvent(startMove - PHASE.open, `Gate ${entryGate + 1} opening for ${spec.name}`, 'gate', index, first)
      segments.push({ kind: 'move', t0: startMove, t1: startMove + PHASE.approach, s0: this.waitS, s1: geometry.chamberCentreS(first), chamber: first, level: rest, entering: true })
      let arrival = startMove + PHASE.approach
      for (let step = 0; step < order.length; step += 1) {
        const chamber = order[step]
        const next = order[step + 1]
        const centre = geometry.chamberCentreS(chamber)
        const closeEnd = arrival + PHASE.close
        const fillEnd = closeEnd + PHASE.fill
        segments.push({ kind: 'close', t0: arrival, t1: closeEnd, s0: centre, s1: centre, chamber })
        segments.push({ kind: 'fill', t0: closeEnd, t1: fillEnd, s0: centre, s1: centre, chamber })
        this.levelSegments[chamber].push({ t0: closeEnd, t1: fillEnd, from: rest, to: 1 - rest, shipIndex: index })
        addEvent(arrival, `${spec.name} in chamber ${chamber + 1}`, 'arrive', index, chamber)
        addEvent(closeEnd, `Chamber ${chamber + 1} ${this.uphill ? 'filling' : 'emptying'}`, 'fill', index, chamber)
        addEvent(fillEnd, `Chamber ${chamber + 1} level with next`, 'level', index, chamber)
        const openStart = next === undefined ? fillEnd : Math.max(fillEnd, freeAt[next])
        const moveStart = openStart + PHASE.open
        segments.push({ kind: 'hold', t0: fillEnd, t1: moveStart, s0: centre, s1: centre, chamber })
        const exitGate = this.gateOut(chamber)
        this.gateEvents[exitGate].push({ open0: openStart, open1: moveStart, close0: null, close1: null })
        addEvent(openStart, `Gate ${exitGate + 1} opening`, 'gate', index, chamber)
        const target = next === undefined ? this.outS : geometry.chamberCentreS(next)
        const moveEnd = moveStart + PHASE.move
        segments.push({ kind: 'move', t0: moveStart, t1: moveEnd, s0: centre, s1: target, chamber, level: 1 - rest, nextChamber: next, leaving: next === undefined })
        const events = this.gateEvents[exitGate]
        events[events.length - 1].close0 = moveEnd
        events[events.length - 1].close1 = moveEnd + PHASE.close
        const drainStart = moveEnd + PHASE.close
        const drainEnd = drainStart + PHASE.drain
        this.levelSegments[chamber].push({ t0: drainStart, t1: drainEnd, from: 1 - rest, to: rest, shipIndex: null })
        freeAt[chamber] = drainEnd
        arrival = moveEnd
      }
      segments.push({ kind: 'depart', t0: arrival, t1: arrival + PHASE.depart, s0: this.outS, s1: this.departS, chamber: order[order.length - 1], level: 1 - rest })
      addEvent(arrival, `${spec.name} cleared the flight`, 'clear', index, order[order.length - 1])
      ship.endTime = arrival + PHASE.depart
      ship.flightTime = arrival - startMove
      ship.clearTime = arrival
      this.ships.push(ship)
    }
    this.events.sort((a, b) => a.time - b.time)
    this.levelOf = (chamber, fraction) => levelY(chamber, fraction)
  }

  levelFraction(chamber, time) {
    const segments = this.levelSegments[chamber]
    let value = this.rest
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      if (time < segment.t0) break
      if (time >= segment.t1) value = segment.to
      else return lerp(segment.from, segment.to, fillCurve((time - segment.t0) / (segment.t1 - segment.t0)))
    }
    return value
  }

  activeLevelSegment(chamber, time) {
    return this.levelSegments[chamber].find((segment) => time >= segment.t0 - 1.2 && time <= segment.t1 + 1.2) ?? null
  }

  levelY(chamber, time) {
    return this.levelOf(chamber, this.levelFraction(chamber, time))
  }

  valveFraction(chamber, time) {
    const segment = this.activeLevelSegment(chamber, time)
    if (!segment) return 0
    return Math.min(1, smooth((time - (segment.t0 - 1.2)) / 1.2), smooth((segment.t1 + 1.2 - time) / 1.2))
  }

  gateFraction(gate, time) {
    const events = this.gateEvents[gate]
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]
      if (time >= event.open0 && time < event.open1) return smooth((time - event.open0) / (event.open1 - event.open0))
      if (event.close0 !== null && time >= event.open1 && time < event.close0) return 1
      if (event.close0 !== null && time >= event.close0 && time < event.close1) return 1 - smooth((time - event.close0) / (event.close1 - event.close0))
    }
    return 0
  }

  queueRank(index, time) {
    let rank = 0
    for (let other = 0; other < index; other += 1) {
      rank += 1 - smooth((time - this.ships[other].startMove) / QUEUE_SHIFT_SECONDS)
    }
    return rank
  }

  pose(index, time) {
    const ship = this.ships[index]
    const lowest = this.geometry.lowerWaterY
    const highest = this.geometry.upperWaterY
    const sign = this.uphill ? 1 : -1
    const startLevel = this.uphill ? lowest : highest
    if (time < ship.startMove) {
      const rank = this.queueRank(index, time)
      if (rank > 3.3) return { visible: false }
      return { visible: true, state: 'queued', s: this.waitS - sign * QUEUE_SPACING * rank, y: startLevel, chamber: null, rank, moving: rank !== Math.round(rank), speed: 0 }
    }
    if (time >= ship.endTime) return { visible: false, finished: true }
    const segments = ship.segments
    let segment = segments[segments.length - 1]
    for (let cursor = 0; cursor < segments.length; cursor += 1) {
      if (time < segments[cursor].t1) { segment = segments[cursor]; break }
    }
    const progress = Math.min(1, Math.max(0, (time - segment.t0) / (segment.t1 - segment.t0)))
    let s = segment.s0
    let y = null
    let speed = 0
    if (segment.kind === 'move') {
      const eased = smooth(progress)
      s = lerp(segment.s0, segment.s1, eased)
      speed = Math.abs((segment.s1 - segment.s0) * 6 * progress * (1 - progress) / (segment.t1 - segment.t0))
      y = segment.entering ? startLevel : this.levelOf(segment.chamber, segment.level)
      if (segment.leaving) y = this.levelOf(segment.chamber, segment.level)
    } else if (segment.kind === 'depart') {
      const eased = 1 - (1 - progress) * (1 - progress)
      s = lerp(segment.s0, segment.s1, eased)
      speed = Math.abs((segment.s1 - segment.s0) * 2 * (1 - progress) / (segment.t1 - segment.t0))
      y = this.levelOf(segment.chamber, segment.level)
    } else {
      y = this.levelY(segment.chamber, time)
    }
    const middle = (chamber) => (this.geometry.lowY(chamber) + this.geometry.highY(chamber)) / 2
    let holdY = y
    if (segment.kind === 'close' || segment.kind === 'fill' || segment.kind === 'hold') holdY = middle(segment.chamber)
    if (segment.kind === 'move') {
      const start = segment.entering ? y : middle(segment.chamber)
      const end = segment.leaving ? y : middle(segment.nextChamber)
      holdY = lerp(start, end, smooth(progress))
    }
    return { visible: true, state: segment.kind, s, y, holdY, chamber: segment.chamber, progress, moving: segment.kind === 'move' || segment.kind === 'depart', speed, segment, ship }
  }
}

function buildFlight(siteId, offsetA, offsetB) {
  const site = siteById[siteId]
  const geometry = flightGeometry(site.chambers, site.floorBase)
  return {
    siteId,
    geometry,
    lanes: { A: new Lane(geometry, 'A', true, offsetA), B: new Lane(geometry, 'B', false, offsetB) },
  }
}

export function createSimulation() {
  const flights = {
    flight: buildFlight('flight', 0, -22),
    lake: buildFlight('lake', -50, -48),
  }
  flights.control = flights.flight
  const simulation = {
    time: 0,
    renderTime: 0,
    accumulator: 0, // fraction of one fixed step, 0 up to 1
    speed: 1, // fixed steps per real-time step; fractional values accumulate, the step length never changes
    paused: false,
    stepsRun: 0,
    flights,
    advance(delta) {
      if (this.paused) return
      this.accumulator += (delta * this.speed) / FIXED_STEP
      while (this.accumulator >= 1) {
        this.runStep()
        this.accumulator -= 1
      }
      this.renderTime = this.time + this.accumulator * FIXED_STEP
    },
    runStep() {
      this.time += FIXED_STEP
      this.stepsRun += 1
      this.renderTime = this.time
      if (this.observer) this.observer(this)
    },
    // One fixed step while paused.
    stepOnce() {
      this.accumulator = 0
      this.runStep()
    },
    runFor(seconds) {
      this.time += seconds
      this.accumulator = 0
      this.renderTime = this.time
    },
    seek(seconds) {
      this.time = seconds
      this.accumulator = 0
      this.renderTime = seconds
    },
    laneTime(lane) { return this.renderTime + lane.offset },
  }
  return simulation
}

export const waterPerLockageMillionLitres = (CHAMBER_LENGTH * CHAMBER_WIDTH * LIFT) / 1000
