// Numbers for the dashboard, derived from the sim each refresh.
import { STAGES, VISIT_MINUTES_PER_SECOND } from '../data.js'
import { byId, stageIndex } from '../sim/er.js'

export function formatClock(seconds) {
  const total = ((Math.floor(seconds) % 86400) + 86400) % 86400
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatTime(seconds) {
  return formatClock(seconds).slice(0, 5)
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`
  return `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min`
}

export const wallClock = (state) => state.site.startClock + state.clock

// Visit minutes since the patient arrived.
export function minutesInDepartment(state, patient) {
  const end = patient.stageAt[5] ?? state.clock
  return (end - patient.stageAt[0]) * VISIT_MINUTES_PER_SECOND
}

// Wall-clock time of a visit moment, on the compressed visit scale counted back from now.
export function visitTime(state, simTime) {
  return wallClock(state) - (state.clock - simTime) * VISIT_MINUTES_PER_SECOND * 60
}

const WAITING_NEEDS = new Set(['triage', 'in-triage', 'bed', 'to-bed'])

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function siteKpis(state) {
  const { baseline } = state.site
  const live = state.patients.filter((patient) => !patient.gone)
  const recent = median(state.counters.doorToDoctor)
  const doorToDoctor = recent === null ? baseline.doorToDoctor : baseline.doorToDoctor * 0.55 + recent * 0.45
  const waitingTriage = live.filter((patient) => patient.needs === 'triage' || patient.needs === 'in-triage').length
  const waitingBed = live.filter((patient) => patient.needs === 'bed' || patient.needs === 'to-bed').length
  const offload = live.filter((patient) => patient.needs === 'handover' && patient.carrier?.type === 'trolley').length
  const freeBeds = state.beds.filter((bed) => bed.state === 'free' && !bed.reservedFor)
  const cleaning = state.beds.filter((bed) => bed.state === 'cleaning').length
  const priorArrivals = 160
  const lwbsCount = Math.round((baseline.lwbs / 100) * priorArrivals) + state.counters.lwbs
  const lwbs = (lwbsCount / (priorArrivals + state.counters.arrivals)) * 100
  return {
    baseline,
    doorToDoctor,
    waiting: live.filter((patient) => WAITING_NEEDS.has(patient.needs)).length + offload,
    waitingTriage,
    waitingBed,
    offload,
    freeBeds: freeBeds.length,
    totalBeds: state.beds.length,
    freeResus: freeBeds.filter((bed) => bed.kind === 'resus').length,
    cleaning,
    lwbs,
    lwbsCount,
  }
}

// The patient the bottom strip follows: the selection's patient, else the one picked from a list,
// else the latest ambulance or helicopter arrival still in the department.
export function focusPatient(state, selectedId, focusPatientId) {
  const live = (patient) => patient && !patient.gone
  const direct = byId(state.patients, selectedId)
  if (live(direct)) return direct
  const related = byId(state.vehicles, selectedId) ?? byId(state.helis, selectedId) ?? byId(state.beds, selectedId) ?? byId(state.people, selectedId) ?? byId(state.rooms, selectedId)
  const relatedId = related?.patientId ?? related?.reservedBy
  if (relatedId && live(byId(state.patients, relatedId))) return byId(state.patients, relatedId)
  if (live(byId(state.patients, focusPatientId))) return byId(state.patients, focusPatientId)
  const arrivals = state.patients.filter((patient) => live(patient) && patient.mode !== 'walk-in' && patient.carrier && patient.carrier.type !== 'vehicle' && patient.carrier.type !== 'heli')
  return arrivals.sort((a, b) => b.stageAt[0] - a.stageAt[0])[0] ?? state.patients.find(live)
}

// Stage strip: done stages show when they happened, the current one is live, later ones show an estimate.
export function visitTimeline(state, patient) {
  const current = stageIndex(patient)
  const estimates = [0, 8, 22, 45, 70, 95]
  return STAGES.map((stage, index) => {
    const at = patient.stageAt[index]
    let status = 'upcoming'
    if (at !== null) status = index === current && index < STAGES.length - 1 ? 'current' : 'done'
    if (index === current + 1 && at === null) status = 'next'
    const label = index === STAGES.length - 1 && patient.outcome ? (patient.outcome === 'admit' ? 'Admitted' : patient.outcome === 'left' ? 'Left' : 'Discharged') : stage.label
    const time = at !== null ? formatTime(visitTime(state, at)) : formatTime(visitTime(state, patient.stageAt[0]) + estimates[index] * 60 * (1 + patient.level * 0.1))
    return { key: stage.key, label, status: status === 'next' ? 'upcoming' : status, time }
  })
}

export function pendingTests(patient) {
  return patient.tests.filter((test) => test.state !== 'done').map((test) => test.name)
}
