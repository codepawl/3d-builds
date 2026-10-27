import { STAGES, STAGE_LANE, STAGE_SITE, STAGE_FLY_SECONDS, stageTimes } from './data/stages.js'
import { getState, setState, cameraBus } from './store.js'

export const SPEEDS = [0.25, 1, 2, 5, 10]
const TOUR_SPEED = 5
const SLOW_SPEED = 0.25
const SLOW_WINDOW_SECONDS = 0.5 // simulation seconds on each side of a stage's key event
const TOUR_LEAD_SECONDS = 5 // the tour starts this long before the approach event

let simulation = null
let times = null
const tourState = { active: false, index: 0, flyLeft: 0, restoreSpeed: 1, visited: [], startedAt: 0 }
const eventLog = []
const eventCursor = {}

function laneA() {
  return simulation.flights[STAGE_SITE].lanes[STAGE_LANE]
}

function laneTimeOf(lane) {
  return simulation.renderTime + lane.offset
}

// Events are logged in the order the stepped clock passes them, merged across both lanes of the flight.
function observeEvents(sim) {
  const lanes = Object.values(sim.flights[STAGE_SITE].lanes)
  const due = []
  lanes.forEach((lane) => {
    let cursor = eventCursor[lane.id] ?? lane.events.findIndex((event) => event.time - lane.offset > sim.time)
    if (cursor < 0) cursor = lane.events.length
    while (cursor < lane.events.length && lane.events[cursor].time - lane.offset <= sim.time) {
      const event = lane.events[cursor]
      due.push({ time: event.time - lane.offset, lane: lane.id, text: event.text, kind: event.kind })
      cursor += 1
    }
    eventCursor[lane.id] = cursor
  })
  due.sort((a, b) => a.time - b.time || a.lane.localeCompare(b.lane))
  due.forEach((entry) => eventLog.push(entry))
}

function resetEventLog() {
  eventLog.length = 0
  Object.keys(eventCursor).forEach((key) => delete eventCursor[key])
  Object.values(simulation.flights[STAGE_SITE].lanes).forEach((lane) => {
    const next = lane.events.findIndex((event) => event.time - lane.offset > simulation.time)
    eventCursor[lane.id] = next < 0 ? lane.events.length : next
  })
}

export function bindSimulation(created) {
  simulation = created
  times = stageTimes(laneA())
  simulation.observer = observeEvents
  resetEventLog()
  simulation.speed = getState().speed
  simulation.paused = getState().paused
  exposeApp()
}

export function setSpeed(speed) {
  setState({ speed })
}

export function stepSpeed(direction) {
  const index = SPEEDS.indexOf(getState().speed)
  const next = Math.min(SPEEDS.length - 1, Math.max(0, (index < 0 ? 1 : index) + direction))
  setSpeed(SPEEDS[next])
}

export function setPaused(paused) {
  setState({ paused })
}

export function togglePaused() {
  setPaused(!getState().paused)
}

export function stepOnce() {
  setPaused(true)
  simulation.stepOnce()
}

export function stageOnFlight() {
  return getState().siteId === STAGE_SITE
}

// Flies the camera to a stage preset. `seek` also moves the simulation clock so the stage is in full swing (for checks and films).
export function goStage(index, options = {}) {
  if (!stageOnFlight() || index < 0 || index >= STAGES.length) return false
  if (options.seek) simulation.seek(times[index].showAt - laneA().offset)
  setState({ stageIndex: index })
  cameraBus.push({ type: 'stage', camera: STAGES[index].camera, snap: Boolean(options.snap) })
  return true
}

export function nextStage() {
  const current = getState().stageIndex
  goStage(current === null ? 0 : Math.min(STAGES.length - 1, current + 1))
}

export function previousStage() {
  const current = getState().stageIndex
  goStage(current === null ? 0 : Math.max(0, current - 1))
}

export function startTour() {
  if (!stageOnFlight() || tourState.active) return
  tourState.active = true
  tourState.index = 0
  tourState.visited = []
  tourState.restoreSpeed = getState().speed
  simulation.seek(times[0].eventAt - laneA().offset - TOUR_LEAD_SECONDS)
  setState({ tour: { index: 0 }, paused: false, speed: Math.max(getState().speed, TOUR_SPEED) })
  tourState.flyLeft = STAGE_FLY_SECONDS
  goStage(0)
}

export function stopTour() {
  if (!tourState.active) return
  tourState.active = false
  setState({ tour: null, speed: tourState.restoreSpeed })
}

export function toggleTour() {
  if (tourState.active) stopTour()
  else startTour()
}

export function setSlowAtEvents(value) {
  setState({ slowAtEvents: value })
}

// Runs once per rendered frame, before the simulation advances. Chooses the step rate and moves the tour along.
export function tick(wallDelta) {
  if (!simulation) return
  const state = getState()
  simulation.paused = state.paused
  let target = state.speed
  if (tourState.active) {
    const lane = laneA()
    const eventAt = times[tourState.index].eventAt
    const slow = state.slowAtEvents
    if (tourState.flyLeft > 0) {
      tourState.flyLeft -= wallDelta
      target = Math.min(target, slow ? SLOW_SPEED : 1)
    } else if (laneTimeOf(lane) >= eventAt) {
      tourState.visited.push(tourState.index)
      if (tourState.index >= STAGES.length - 1) {
        stopTour()
        target = getState().speed
      } else {
        tourState.index += 1
        tourState.flyLeft = STAGE_FLY_SECONDS
        setState({ tour: { index: tourState.index } })
        goStage(tourState.index)
      }
    } else if (slow && Math.abs(laneTimeOf(lane) - eventAt) < SLOW_WINDOW_SECONDS + 0.4 * Math.abs(simulation.speed)) {
      target = Math.min(target, SLOW_SPEED)
    }
    simulation.speed += (target - simulation.speed) * (1 - Math.exp(-wallDelta * 8))
    if (Math.abs(simulation.speed - target) < 0.01) simulation.speed = target
  } else {
    simulation.speed = target
  }
}

function exposeApp() {
  window.__app = {
    stages: STAGES,
    stageTimes: () => times,
    get sim() { return simulation },
    get speed() { return getState().speed },
    get effectiveSpeed() { return simulation.speed },
    get paused() { return getState().paused },
    get stageIndex() { return getState().stageIndex },
    get tour() { return { active: tourState.active, index: tourState.index, visited: [...tourState.visited] } },
    speeds: SPEEDS,
    setSpeed,
    pause: () => setPaused(true),
    play: () => setPaused(false),
    togglePause: togglePaused,
    step: stepOnce,
    goStage,
    nextStage,
    previousStage,
    startTour,
    stopTour,
    setSlowAtEvents,
    eventLog,
    resetEventLog,
    // Drives the simulation with a fixed frame length at the given speed, outside the render loop (for the determinism check).
    drive(wallSeconds, speed, frameSeconds = 1 / 60) {
      const savedSpeed = simulation.speed
      const savedPaused = simulation.paused
      simulation.paused = false
      simulation.speed = speed
      const frames = Math.round(wallSeconds / frameSeconds)
      for (let frame = 0; frame < frames; frame += 1) simulation.advance(frameSeconds)
      simulation.speed = savedSpeed
      simulation.paused = savedPaused
    },
  }
}
