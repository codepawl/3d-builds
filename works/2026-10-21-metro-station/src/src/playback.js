import { STAGES, stageByKey } from './data/stages.js'
import { getState, setState, cameraBus } from './store.js'

export const SPEEDS = [0.25, 1, 2, 5, 10]
const TOUR_SPEED = 5
const SLOW_SPEED = 0.25
const FLY_SECONDS = 1.2
const HOLD_SECONDS = 2.6
const GIVE_UP_SECONDS = 90
const FOLLOW_DISTANCES = { close: 70, mid: 160, wide: 340 }

let simulation = null

export function attachSimulation(target) {
  simulation = target
}

export function switchSite(siteId) {
  if (getState().siteId === siteId) return
  const current = getState()
  setState({
    siteId,
    selected: null,
    detail: null,
    following: null,
    snapshot: null,
    switching: current.switching + 1,
    tab: siteId === 'depot' ? 'trains' : current.tab === 'tasks' ? 'trains' : current.tab,
  })
}

// ---------------------------------------------------------------- playback
export function setSpeed(speed) {
  setState({ speed })
}

export function stepSpeed(direction) {
  const index = SPEEDS.indexOf(getState().speed)
  const next = Math.min(SPEEDS.length - 1, Math.max(0, index + direction))
  setSpeed(SPEEDS[next])
}

export function setPaused(paused) {
  setState({ paused })
}

export function togglePause() {
  setPaused(!getState().paused)
}

// Advances exactly one fixed step while paused.
export function stepOnePaused() {
  if (!simulation) return
  if (!getState().paused) setPaused(true)
  simulation.stepOnce()
}

export function toggleSlowAtEvents() {
  setState({ slowAtEvents: !getState().slowAtEvents })
}

// ---------------------------------------------------------------- stages
function markVisited(key) {
  const visited = getState().visitedStages
  setState({ stageKey: key, visitedStages: visited.includes(key) ? visited : [...visited, key] })
}

// Flies the camera to a stage preset (switching site first when it lives on another one).
export function goToStage(key) {
  const stage = stageByKey[key]
  if (!stage) return
  markVisited(key)
  if (getState().siteId !== stage.siteId) {
    setState({ pendingStage: key })
    switchSite(stage.siteId)
    return
  }
  cameraBus.push({ type: 'stage', key })
}

export function stepStage(direction) {
  const index = STAGES.findIndex((stage) => stage.key === getState().stageKey)
  const next = index < 0 ? (direction > 0 ? 0 : STAGES.length - 1) : (index + direction + STAGES.length) % STAGES.length
  goToStage(STAGES[next].key)
}

export function setFollowDistance(name) {
  setState({ followDistance: name })
  cameraBus.push({ type: 'followDistance', distance: FOLLOW_DISTANCES[name] })
}

export function followSelected() {
  const selected = getState().selected
  if (!selected || selected.type !== 'train') return
  cameraBus.push({ type: 'fly', ref: selected, follow: true, minimum: FOLLOW_DISTANCES[getState().followDistance] })
  cameraBus.push({ type: 'followDistance', distance: FOLLOW_DISTANCES[getState().followDistance] })
}

export function stopFollowing() {
  cameraBus.push({ type: 'unfollow' })
}

export { FOLLOW_DISTANCES }

// ---------------------------------------------------------------- tour
export function startTour() {
  const state = getState()
  if (state.tour) return
  const savedSpeed = state.speed
  setState({
    speed: Math.max(savedSpeed, TOUR_SPEED),
    paused: false,
    tour: { index: -1, phase: 'start', timer: 0, savedSpeed, visits: [], eventNumber: 0 },
    visitedStages: [],
  })
}

export function stopTour() {
  const tour = getState().tour
  if (!tour) return
  setState({ tour: null, speed: tour.savedSpeed, lastTourVisits: tour.visits })
}

function matchingEvent(stage, afterNumber) {
  const wanted = stage.event
  return simulation.events.find((event) => (
    event.n > afterNumber
    && event.kind === wanted.kind
    && event.stationId === wanted.stationId
    && (wanted.dir === undefined || event.dir === wanted.dir)
  ))
}

// Runs every frame before the simulation advances: drives the tour and returns the speed the simulation should use.
export function updatePlayback(deltaSeconds) {
  const state = getState()
  if (!simulation) return
  simulation.paused = state.paused
  let wanted = state.speed
  const tour = state.tour
  if (tour) {
    if (tour.phase === 'start' || (tour.phase === 'hold' && tour.timer <= 0)) {
      const nextIndex = tour.index + 1
      if (nextIndex >= STAGES.length) {
        stopTour()
        return
      }
      tour.index = nextIndex
      tour.phase = 'fly'
      tour.timer = FLY_SECONDS
      goToStage(STAGES[nextIndex].key)
    } else if (tour.phase === 'fly') {
      tour.timer -= deltaSeconds
      if (tour.timer <= 0 && getState().siteId === STAGES[tour.index].siteId && getState().pendingStage === null) {
        tour.phase = 'wait'
        tour.timer = 0
        tour.eventNumber = simulation.eventTotal
      }
    } else if (tour.phase === 'wait') {
      tour.timer += deltaSeconds
      const stage = STAGES[tour.index]
      const event = matchingEvent(stage, tour.eventNumber)
      if (event || tour.timer > GIVE_UP_SECONDS) {
        tour.visits.push({ key: stage.key, eventNumber: event ? event.n : null, eventTime: event ? event.time : null })
        tour.phase = 'hold'
        tour.timer = HOLD_SECONDS
      }
    } else if (tour.phase === 'hold') {
      tour.timer -= deltaSeconds
      if (state.slowAtEvents) wanted = Math.min(wanted, SLOW_SPEED)
    }
  }
  // Ease toward the wanted speed so the slow-down is not a jump; the simulation still only runs whole fixed steps.
  const current = simulation.speed
  const eased = Math.abs(current - wanted) < 0.02 ? wanted : current + (wanted - current) * (1 - Math.exp(-deltaSeconds * 7))
  simulation.speed = eased
}

export function installPlaybackHandle(extra) {
  window.__app = {
    ...(window.__app ?? {}),
    stages: STAGES,
    goToStage,
    stepStage,
    setSpeed,
    togglePause,
    setPaused,
    stepOnePaused,
    startTour,
    stopTour,
    ...extra,
    get speed() { return simulation ? simulation.speed : null },
    get speedSetting() { return getState().speed },
    get paused() { return getState().paused },
    get stageKey() { return getState().stageKey },
    get tour() { return getState().tour },
    get tourVisits() { return getState().lastTourVisits },
  }
}
