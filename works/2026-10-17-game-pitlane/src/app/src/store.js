import { Vector3 } from 'three'
// App state shared by the 3D view and the dashboard. The simulation state is mutable and read every frame by the
// scene; the dashboard re-renders on `version`, bumped a few times a second.
import { useSyncExternalStore } from 'react'
import { createWorld, stepSite } from './sim.js'

export const world = createWorld()

const listeners = new Set()
let uiState = { siteId: 'ashgrove', selectedId: null, tab: 'cars', search: '', version: 0 }

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

export function useUiValue(selector) {
  return useSyncExternalStore(subscribe, () => selector(uiState))
}

const DASHBOARD_REFRESH_SECONDS = 0.2
let sinceRefresh = 0

export function advanceWorld(dt) {
  stepSite(currentSite(), dt)
  sinceRefresh += dt
  if (sinceRefresh >= DASHBOARD_REFRESH_SECONDS) {
    sinceRefresh = 0
    setUi({ version: uiState.version + 1 })
  }
}

export function currentSite() {
  return world.sites[uiState.siteId]
}

// Half extents (x across, z along the model's forward axis) and height of everything selectable.
const FOOTPRINTS = {
  car: [0.97, 2.75, 1.0],
  spare: [0.97, 2.75, 1.0],
  person: [0.34, 0.34, 1.78],
  garage: [6.05, 8.6, 9.9],
  truck: [1.48, 8.4, 4.1],
  hospitality: [7.9, 6.1, 8.4],
  stand: [2.45, 1.25, 3.6],
  gantry: [1.4, 0.45, 2.7],
  rack: [0.55, 0.55, 1.9],
  jack: [0.3, 0.9, 1.0],
  post: [1.85, 1.5, 3.5],
  roadcar: [1.0, 2.33, 1.45],
  grandstand: [15.3, 6.8, 10.9],
  grandstand_open: [7.5, 3.5, 5.9],
}

// Resolves any selectable id to { type, item, position, heading, footprint } in the current site.
export function findEntity(id, state = currentSite()) {
  if (!id) return null
  const car = state.cars.find((candidate) => candidate.id === id)
  if (car) return { type: 'car', item: car, position: { x: car.position.x, y: car.lift, z: car.position.z }, heading: car.heading, footprint: FOOTPRINTS.car }
  const person = state.people.find((candidate) => candidate.id === id)
  if (person) return { type: 'person', item: person, position: person.position, heading: person.heading, footprint: FOOTPRINTS.person }
  if (id === 'spare') return { type: 'spare', item: state.spareCar, position: { x: state.spareCar.x, y: 0, z: state.spareCar.z }, heading: state.spareCar.heading, footprint: FOOTPRINTS.spare }
  const item = state.statics.find((candidate) => candidate.id === id)
  if (item) {
    const key = item.node === 'grandstand_open' ? 'grandstand_open' : item.type
    return { type: item.type, item, position: { x: item.x, y: 0, z: item.z }, heading: item.heading, footprint: FOOTPRINTS[key] }
  }
  return null
}

// Click handler for 3D objects. A drag that ends on an object is a camera move, not a pick.
export function selectEntity(event, id) {
  event.stopPropagation()
  if (event.delta > 6) return
  select(id, true)
}

// Selecting something flies the camera there; a moving car or person is followed until the user drags.
export function select(id, fromScene = false) {
  setUi({ selectedId: id })
  const entity = findEntity(id)
  if (!entity) return
  const moving = entity.type === 'car' || entity.type === 'person'
  if (fromScene && !moving) return
  flyTo(entity, moving ? id : null)
}

export const camera = { controls: null, followId: null }
const followTarget = new Vector3()

const FLY_DISTANCE = { car: 46, person: 24, spare: 28, garage: 70, truck: 70, hospitality: 90, stand: 34, gantry: 30, rack: 22, jack: 22, post: 40, roadcar: 30, grandstand: 110 }
const MIN_FOLLOW_HEIGHT = 14

export function flyTo(entity, followId = null) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = followId
  controls.moveTo(entity.position.x, 1, entity.position.z, true)
  controls.dollyTo(FLY_DISTANCE[entity.type] ?? 40, true)
  // Keep the camera above every roof: polar angle so that distance * cos(polar) clears the tallest model.
  const distance = FLY_DISTANCE[entity.type] ?? 40
  const maxPolar = Math.acos(Math.min(0.95, MIN_FOLLOW_HEIGHT / distance))
  if (controls.polarAngle > maxPolar) controls.rotatePolarTo(maxPolar, true)
}

export function followSelection() {
  const entity = camera.followId && findEntity(camera.followId)
  if (!entity) return
  // Ease in while far away, then lock on so a car at 60 m/s does not run out of frame.
  const target = camera.controls.getTarget(followTarget)
  const close = Math.hypot(target.x - entity.position.x, target.z - entity.position.z) < 40
  camera.controls.moveTo(entity.position.x, 1, entity.position.z, !close)
}

export function siteView() {
  return { target: [-12, 0, 8], azimuth: Math.PI - 0.55, polar: 0.98, distance: 150 }
}

export function wideView() {
  // At night the whole-circuit button ends closer, with the pit building and the near bends filling the frame.
  if (currentSite().site.night) return { target: [-10, 0, -64], azimuth: Math.PI - 0.38, polar: 0.74, distance: 285 }
  return { target: [4, 0, -52], azimuth: Math.PI - 0.38, polar: 0.86, distance: 470 }
}

export function applyView(view, animate = true) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = null
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
  setUi({ siteId, selectedId: null, search: '' })
  applyView(siteView())
}
