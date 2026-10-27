// Numbers the dashboard derives from the sim state: clock, KPIs, the followed arrival and its step times.
import { ARRIVAL_STEPS, AIRCRAFT_TYPES } from '../data.js'
import { arrivalsPerHour, averageDelay } from '../sim.js'

const two = (value) => String(Math.floor(value)).padStart(2, '0')

export function formatClock(seconds) {
  const day = ((seconds % 86400) + 86400) % 86400
  return `${two(day / 3600)}:${two((day % 3600) / 60)}:${two(day % 60)}`
}

export function formatTime(seconds) {
  const day = ((seconds % 86400) + 86400) % 86400
  return `${two(day / 3600)}:${two((day % 3600) / 60)}`
}

export function delayLabel(delay) {
  return delay < 1 ? 'On time' : `+${Math.round(delay)} min`
}

export function separationTone(state, lateral) {
  if (lateral === null) return 'ok'
  const minimum = state.site.minimumSeparation
  if (lateral < minimum) return 'bad'
  if (lateral < minimum * 1.8) return 'warn'
  return 'ok'
}

export function siteKpis(state) {
  const live = state.flights.filter((flight) => flight.phase !== 'parked')
  const airborne = live.filter((flight) => flight.altitude > 50)
  const arrivals = live.filter((flight) => flight.kind === 'arrival')
  const separation = state.minimumSeparation
  return {
    inSector: live.length,
    airborne: airborne.length,
    ground: live.length - airborne.length,
    arrivals: arrivals.length,
    holding: live.filter((flight) => flight.hold).length,
    perHour: arrivalsPerHour(state),
    delay: averageDelay(state),
    separation: separation ? separation.lateral : null,
    separationIds: separation ? separation.ids : [],
    activeConflicts: state.conflicts.filter((conflict) => conflict.state === 'active').length,
  }
}

// The arrival the timeline follows: the selected one, else the arrival closest to landing.
export function focusFlight(state, selectedId) {
  const selected = state.flights.find((flight) => flight.id === selectedId)
  if (selected?.kind === 'arrival' && selected.phase !== 'parked') return selected
  const arrivals = state.flights.filter((flight) => flight.kind === 'arrival' && flight.phase !== 'parked' && !flight.steps.vacate)
  const stepCount = (flight) => Object.keys(flight.steps).length
  arrivals.sort((a, b) => stepCount(b) - stepCount(a) || a.bornAt - b.bornAt)
  return arrivals[0] ?? null
}

const STEP_AFTER_EXIT = { hold: 240, approach: 540, land: 900, vacate: 960 }

// Estimated clock time of each step not reached yet, walking the remaining route at current speed.
function estimateSteps(state, flight) {
  const site = state.site
  const knots = Math.max(flight.speed, 140)
  const secondsPerUnit = 3600 / (site.nm * knots)
  const points = flight.mode === 'track' ? flight.track.slice(flight.trackIndex + 1) : flight.route.slice(flight.legIndex)
  const estimates = {}
  let elapsed = 0
  let from = flight.position
  for (const point of points) {
    elapsed += Math.hypot(point.x - from.x, point.z - from.z) * secondsPerUnit
    from = point
    if (point.hold) estimates.hold = state.clock + elapsed
    if (point.final) estimates.approach = state.clock + elapsed
    if (point.step && point.step !== 'approach') estimates[point.step] = state.clock + elapsed
    if (point.exit) estimates.exit = state.clock + elapsed
  }
  if (estimates.exit) {
    Object.entries(STEP_AFTER_EXIT).forEach(([key, offset]) => {
      estimates[key] = estimates[key] ?? estimates.exit + offset
    })
  }
  if (estimates.approach && !estimates.land) {
    const finalNm = 7.3
    estimates.land = estimates.approach + (finalNm / AIRCRAFT_TYPES[flight.type].approach) * 3600
    estimates.vacate = estimates.land + 60
  }
  if (!estimates.hold && estimates.approach) estimates.hold = estimates.approach
  if (estimates.land && !estimates.vacate) estimates.vacate = estimates.land + 60
  return estimates
}

export function arrivalTimeline(state, flight) {
  const estimates = estimateSteps(state, flight)
  const recorded = ARRIVAL_STEPS.map((step) => flight.steps[step.key])
  const lastDone = recorded.reduce((last, value, index) => (typeof value === 'number' ? index : last), -1)
  return ARRIVAL_STEPS.map((step, index) => {
    const value = flight.steps[step.key]
    if (value === 'skipped') return { ...step, status: 'skipped', time: 'Not needed' }
    if (typeof value === 'number') return { ...step, status: index === lastDone ? 'current' : 'done', time: formatTime(value) }
    const estimate = estimates[step.key]
    return { ...step, status: 'upcoming', time: estimate ? `ETA ${formatTime(estimate)}` : 'Pending' }
  })
}
