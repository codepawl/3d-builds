// App state shared by the 3D view and the dashboard. The sim world is mutable and read each
// frame by the scene; the dashboard re-renders on `version`, bumped a few times a second.
import { useSyncExternalStore } from 'react'
import { RUNWAYS } from './data.js'
import { createWorld, stepWorld } from './sim.js'

export const world = createWorld()

const listeners = new Set()
let uiState = { siteId: 'APP', selectedId: null, tab: 'traffic', search: '', version: 0 }

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

// Resolves any selectable id to { type, item, position } in the current site.
export function findEntity(id) {
  const state = currentSite()
  if (!id) return null
  const flight = state.flights.find((candidate) => candidate.id === id)
  if (flight) return { type: 'flight', item: flight, position: flight.position }
  if (id.startsWith('fix-')) {
    const fix = state.site.fixes.find((candidate) => `fix-${candidate.id}` === id)
    if (fix) return { type: 'fix', item: fix, position: { x: fix.x, y: 0, z: fix.z } }
  }
  if (id === 'weather' && state.weather) return { type: 'weather', item: state.weather, position: { x: state.weather.x, y: 0, z: state.weather.z } }
  if (id === 'tower' && state.site.hasAirport) return { type: 'tower', item: state.site, position: { x: 150, y: 0, z: -150 } }
  if (RUNWAYS[id] && state.site.hasAirport) {
    const runway = RUNWAYS[id]
    return { type: 'runway', item: runway, position: { x: (runway.from + runway.to) / 2, y: 0, z: runway.z } }
  }
  return null
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

export function closeDistance() {
  return currentSite().site.nm * 6
}

export function flyTo(position, distance = closeDistance(), followId = null) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = followId
  controls.moveTo(position.x, position.y ?? 0, position.z, true)
  controls.dollyTo(distance, true)
}

export function followSelection() {
  const entity = camera.followId && findEntity(camera.followId)
  if (!entity) return
  camera.controls.moveTo(entity.position.x, entity.position.y ?? 0, entity.position.z, true)
}

export function viewSite(state, animate = true) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = null
  const view = state.site.view
  // The new sector's zoom limit applies before the dolly, or the old sector's limit would clamp it.
  controls.maxDistance = view.distance * 1.5
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
  setUi({ siteId, selectedId: null })
  viewSite(world.sites[siteId])
}
