// App state shared by the 3D view and the dashboard. The sim world is mutable and read each
// frame by the scene; the dashboard re-renders on `version`, bumped a few times a second.
import { useSyncExternalStore } from 'react'
import { createWorld, stepWorld } from './sim/index.js'
import { byId, patientPose } from './sim/er.js'

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search)
export const world = createWorld(Number(params.get('warm') ?? 60))

const listeners = new Set()
let uiState = { siteId: params.get('site') ?? 'MP', selectedId: null, tab: 'patients', search: '', version: 0, focusPatientId: null }

export function getUi() {
  return uiState
}

export function setUi(patch) {
  uiState = { ...uiState, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUi() {
  return useSyncExternalStore(subscribe, getUi)
}

// Re-renders only when the selected value changes; the selector must return a primitive.
export function useUiValue(selector) {
  return useSyncExternalStore(subscribe, () => selector(uiState))
}

const DASHBOARD_REFRESH_SECONDS = 0.2
let sinceRefresh = 0

export function advanceWorld(dt) {
  stepWorld(world, dt)
  sinceRefresh += dt
  if (sinceRefresh >= DASHBOARD_REFRESH_SECONDS) {
    sinceRefresh = 0
    setUi({ version: uiState.version + 1 })
  }
}

export function currentSite() {
  return world.sites[uiState.siteId]
}

function unitPosition(unit) {
  return { x: unit.position.x, y: unit.position.y ?? 0, z: unit.position.z }
}

// Resolves any selectable id to { type, item, position } in the current site.
export function findEntity(id, state = currentSite()) {
  if (!id) return null
  const patient = byId(state.patients, id)
  if (patient) {
    if (patient.gone) return null
    const carrier = patient.carrier
    if (carrier?.type === 'vehicle' || carrier?.type === 'heli') {
      const unit = byId(carrier.type === 'vehicle' ? state.vehicles : state.helis, carrier.id)
      return unit ? { type: 'patient', item: patient, position: unitPosition(unit) } : null
    }
    const pose = patientPose(state, patient)
    return pose ? { type: 'patient', item: patient, position: { x: pose.x, y: pose.y, z: pose.z } } : null
  }
  const bed = byId(state.beds, id)
  if (bed) return { type: 'bed', item: bed, position: { x: bed.x, y: 0, z: bed.z } }
  const vehicle = byId(state.vehicles, id)
  if (vehicle) return vehicle.phase === 'away' ? null : { type: 'vehicle', item: vehicle, position: unitPosition(vehicle) }
  const heli = byId(state.helis, id)
  if (heli) return heli.phase === 'away' ? null : { type: 'heli', item: heli, position: unitPosition(heli) }
  const person = byId(state.people, id)
  if (person) return person.hidden || person.removed ? null : { type: 'person', item: person, position: { x: person.position.x, y: 0, z: person.position.z } }
  const room = byId(state.rooms, id)
  if (room) return { type: 'room', item: room, position: { x: room.x, y: 0, z: room.z } }
  return null
}

// Where the camera looks when following: an ambulance or helicopter mid-handover is followed by
// its cot, so the camera goes with the patient into the department.
export function followPoint(entity, state = currentSite()) {
  if (!entity) return null
  if ((entity.type === 'vehicle' || entity.type === 'heli') && (entity.item.phase === 'handover' || entity.item.phase === 'crewBack')) {
    const cot = byId(state.trolleys, entity.item.cotId)
    if (cot && !cot.hidden) return { x: cot.position.x, y: 0.9, z: cot.position.z }
  }
  if (entity.type === 'heli') return { ...entity.position, y: entity.position.y + 1.5 }
  return { x: entity.position.x, y: entity.type === 'vehicle' ? 1.4 : 0.9, z: entity.position.z }
}

// Click handler for 3D objects. A drag that ends on an object is a camera move, not a pick.
export function selectEntity(event, id) {
  event.stopPropagation()
  if (event.delta > 6) return
  setUi({ selectedId: id })
}

// Camera commands; the scene registers the drei CameraControls instance here.
// `followId` keeps the camera on a moving selection until the user drags or picks a site.
export const camera = { controls: null, followId: null }

export const FLY_DISTANCE = { patient: 17, bed: 18, vehicle: 30, heli: 62, person: 15, room: 19 }

export function flyTo(entity, followId = null) {
  const controls = camera.controls
  if (!controls || !entity) return
  camera.followId = followId
  const point = followPoint(entity)
  controls.moveTo(point.x, point.y, point.z, true)
  controls.dollyTo(FLY_DISTANCE[entity.type], true)
  if (controls.polarAngle > 1.0) controls.rotatePolarTo(0.95, true)
}

export function followSelection() {
  let entity = camera.followId && findEntity(camera.followId)
  if (!entity) return
  // During a hand-over the camera goes with the cot, so the selection (ring, pin, card) moves to the
  // patient on it instead of staying on the ambulance.
  if ((entity.type === 'vehicle' || entity.type === 'heli') && (entity.item.phase === 'handover' || entity.item.phase === 'crewBack')) {
    const cot = byId(currentSite().trolleys, entity.item.cotId)
    const cotPatient = cot && !cot.hidden && cot.patientId && findEntity(cot.patientId)
    if (cotPatient) {
      const wasSelected = uiState.selectedId === camera.followId
      camera.followId = cotPatient.item.id
      if (wasSelected) setUi({ selectedId: cotPatient.item.id })
      entity = cotPatient
    }
  }
  const point = followPoint(entity)
  camera.controls.moveTo(point.x, point.y, point.z, true)
}

export function siteView(state) {
  const { center, width } = state.layout
  return { target: [center.x + width * 0.05, 0, center.z - 4], azimuth: 0.42, polar: 0.92, distance: width * 0.92 + 8 }
}

export function viewSite(state, animate = true) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = null
  const view = siteView(state)
  controls.moveTo(...view.target, animate)
  controls.rotateTo(view.azimuth, view.polar, animate)
  controls.dollyTo(view.distance, animate)
}

export function zoomBy(factor) {
  const controls = camera.controls
  if (controls) controls.dollyTo(controls.distance * factor, true)
}

export function rotateBy(radians) {
  const controls = camera.controls
  if (controls) controls.rotate(radians, 0, true)
}

export function switchSite(siteId) {
  setUi({ siteId, selectedId: null, search: '', focusPatientId: null })
  viewSite(world.sites[siteId])
}
