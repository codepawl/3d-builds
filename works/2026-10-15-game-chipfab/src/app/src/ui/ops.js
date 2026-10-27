// Numbers the dashboard derives from the sim state: ops clock, KPIs, the followed lot and its route.
import { SITES, STAGES } from '../data.js'
import { availability, lotQueueMinutes, OPS_MINUTES_PER_SECOND } from '../sim.js'

const MINUTE = 60 * 1000
// The ops day starts at 07:10 local; Date.now is read once so a virtual clock can drive it.
const OPS_DAY_START = (() => {
  const start = new Date(Date.now())
  start.setHours(7, 10, 0, 0)
  return start.getTime()
})()

export function formatClock(simSeconds) {
  const date = new Date(OPS_DAY_START + simSeconds * OPS_MINUTES_PER_SECOND * MINUTE)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatCount(value) {
  return Math.round(value).toLocaleString('en-US')
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

function fabKpis(state) {
  const { baseline } = state.site
  const { stats } = state
  const liveYield = stats.yieldCount ? stats.yieldSum / stats.yieldCount : 93
  const queued = state.lots.filter((lot) => lot.state === 'queued' || lot.state === 'atTool')
  const averageQueue = queued.length ? queued.reduce((sum, lot) => sum + lotQueueMinutes(state, lot), 0) / queued.length : 10
  const shiftFraction = Math.min(1, (state.clock + 190) / 720)
  return {
    starts: baseline.starts + stats.lotsStarted * 25,
    startsShift: Math.round(baseline.starts * 0.5 * shiftFraction / 25) + stats.lotsStarted,
    yield: baseline.yield + (liveYield - 93) * 0.08,
    cycleDays: baseline.cycleDays + (averageQueue - 12) * 0.02,
    availability: baseline.availability * 0.4 + availability(state) * 0.6,
    baselineAvailability: baseline.availability,
    wip: state.lots.length,
    moves: stats.moves,
  }
}

export function siteKpis(state, world) {
  if (state.site.kind === 'fab') return fabKpis(state)
  const fabs = SITES.filter((site) => site.kind === 'fab').map((site) => fabKpis(world.sites[site.id]))
  const weight = (key) => fabs.reduce((sum, kpis, index) => sum + kpis[key] * fabs[index].starts, 0) / fabs.reduce((sum, kpis) => sum + kpis.starts, 0)
  return {
    starts: fabs.reduce((sum, kpis) => sum + kpis.starts, 0),
    startsShift: fabs.reduce((sum, kpis) => sum + kpis.startsShift, 0),
    yield: weight('yield'),
    cycleDays: weight('cycleDays'),
    availability: weight('availability'),
    baselineAvailability: state.site.baseline.availability,
    wip: fabs.reduce((sum, kpis) => sum + kpis.wip, 0),
    moves: fabs.reduce((sum, kpis) => sum + kpis.moves, 0),
  }
}

// The lot the bottom timeline follows: the selected lot, the lot on a selected vehicle or tool,
// or the hot lot furthest along in its current step.
export function focusLot(state, selectedId) {
  if (state.site.kind !== 'fab') return null
  const selected = state.lots.find((lot) => lot.id === selectedId)
  if (selected) return selected
  const vehicle = state.vehicles.find((candidate) => candidate.id === selectedId)
  if (vehicle?.job) return state.lots.find((lot) => lot.id === vehicle.job.lotId)
  const tool = state.tools.find((candidate) => candidate.id === selectedId)
  if (tool?.lotId) return state.lots.find((lot) => lot.id === tool.lotId)
  const hot = state.lots.filter((lot) => lot.priority === 'hot')
  return hot.find((lot) => lot.state === 'processing') ?? hot[0] ?? state.lots[0]
}

// One entry per route stage of the lot's current layer, with an actual or estimated clock time.
export function routeTimeline(state, lot) {
  let estimate = state.clock
  return STAGES.map((stage, index) => {
    let status = 'upcoming'
    if (index < lot.stageIndex) status = 'done'
    else if (index === lot.stageIndex) status = 'current'
    const started = lot.stageStarts[index]
    if (status === 'upcoming') estimate += (stage.minutes[0] + stage.minutes[1]) / 2 + 8
    const time = status === 'upcoming' ? estimate : started ?? state.clock
    const progress = status === 'current' ? lot.progress : status === 'done' ? 1 : 0
    return { ...stage, status, time: formatClock(time), progress }
  })
}
