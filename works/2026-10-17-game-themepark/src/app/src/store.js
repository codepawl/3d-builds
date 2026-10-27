// App state shared by the 3D view and the dashboard. The sim world is mutable and read each
// frame by the scene; the dashboard re-renders on `version`, bumped a few times a second.
import { useSyncExternalStore } from 'react'
import { createWorld, stepWorld } from './sim.js'
import { LAYOUTS } from './data.js'

export const world = createWorld()

const listeners = new Set()
let uiState = { siteId: 'AD', selectedId: null, tab: 'rides', search: '', version: 0 }

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
  stepWorld(world, dt, uiState.siteId)
  sinceRefresh += dt
  if (sinceRefresh >= DASHBOARD_REFRESH_SECONDS) {
    sinceRefresh = 0
    setUi({ version: uiState.version + 1 })
  }
}

export function currentSite() {
  return world.sites[uiState.siteId]
}

// Resolves any selectable id to { type, item, position } in the current land.
export function findEntity(id, state = currentSite()) {
  if (!id) return null
  const ride = state.rides.find((candidate) => candidate.id === id)
  if (ride) return { type: 'ride', item: ride, position: { x: ride.footprint.x, y: 0, z: ride.footprint.z } }
  const unit = state.units.find((candidate) => candidate.id === id)
  if (unit) return { type: unit.kind, item: unit, position: unit.position }
  const stand = state.stands.find((candidate) => candidate.id === id)
  if (stand) return { type: 'stand', item: stand, position: { x: stand.x, y: 0, z: stand.z } }
  return null
}

export function selectEntity(event, id) {
  event.stopPropagation()
  if (event.delta > 6) return
  setUi({ selectedId: id })
  // Moving things are followed as soon as they are picked.
  const entity = findEntity(id)
  if (entity && MOVING.has(entity.type)) flyTo(entity, id)
}

const MOVING = new Set(['train', 'boat', 'monorail', 'tram', 'cart', 'float'])

export const camera = { controls: null, followId: null }

const FLY = { train: 62, boat: 44, monorail: 70, tram: 46, cart: 30, float: 40, staff: 18, stand: 32 }

export function flyDistance(entity) {
  if (entity.type === 'ride') return Math.max(entity.item.footprint.rx, entity.item.footprint.rz) * 2.2 + entity.item.top * 0.8 + 18
  return FLY[entity.type] ?? 40
}

function targetHeight(entity) {
  if (entity.type === 'train') return entity.position.y
  if (entity.type === 'ride') return Math.min(12, entity.item.top * 0.3)
  return entity.position.y + 1
}

// Followed rides keep the camera above the tallest structure: a coaster train is watched from at
// least 40 m above it, never from between the supports.
const FOLLOW_LIMITS = { train: { polar: 0.86, distance: 62 }, boat: { polar: 0.95, distance: 40 }, monorail: { polar: 1.0, distance: 56 } }

export function flyTo(entity, followId = null) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = followId
  controls.moveTo(entity.position.x, targetHeight(entity), entity.position.z, true)
  controls.dollyTo(flyDistance(entity), true)
  const limits = FOLLOW_LIMITS[entity.type]
  if (limits && controls.polarAngle > limits.polar) controls.rotatePolarTo(limits.polar, true)
}

export function followSelection() {
  const entity = camera.followId && findEntity(camera.followId)
  if (!entity || entity.type === 'ride' || entity.type === 'stand') return
  const controls = camera.controls
  controls.moveTo(entity.position.x, targetHeight(entity), entity.position.z, true)
  const limits = FOLLOW_LIMITS[entity.type]
  if (limits) {
    if (Math.abs(controls.polarAngle - limits.polar) > 0.02) controls.rotatePolarTo(limits.polar, true)
    if (controls.distance < limits.distance - 0.5) controls.dollyTo(limits.distance, true)
  }
}

export function viewSite(siteId, animate = true) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = null
  const view = LAYOUTS[siteId].view
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
  viewSite(siteId)
}

export function selectAndFly(id) {
  setUi({ selectedId: id })
  const entity = findEntity(id)
  if (entity) flyTo(entity, id)
}
