// App state shared by the 3D view and the dashboard. The sim world is mutable and read each
// frame by the scene; the dashboard re-renders on `version`, bumped a few times a second.
import { useSyncExternalStore } from 'react'
import geometry from './geometry.json'
import { createWorld, RAIL_Y, rotateY, stepWorld } from './sim.js'

export const world = createWorld()

const listeners = new Set()
let uiState = { siteId: 'F1', selectedId: null, tab: 'lots', search: '', version: 0 }

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

const POD_HANG = 1.045

// Where a lot is right now: on a load port, under a vehicle's hoist, or inside a stocker.
export function lotPosition(state, lot) {
  const place = lot.place
  if (place.type === 'port') {
    const port = state.tools.find((tool) => tool.id === place.toolId).ports[place.portIndex]
    return { x: port.x, y: port.y, z: port.z }
  }
  if (place.type === 'vehicle') {
    const vehicle = state.vehicles.find((candidate) => candidate.id === place.id)
    return { x: vehicle.position.x, y: RAIL_Y - POD_HANG - vehicle.hoist, z: vehicle.position.z }
  }
  const stockerBay = place.type === 'interbay' ? place.toBay : null
  const stocker = place.type === 'stocker' ? state.stockers.find((candidate) => candidate.id === place.id) : state.stockers.find((candidate) => candidate.bay === stockerBay)
  return stocker.center
}

function buildingCenter(building) {
  const { min, max } = geometry[building.node]
  const center = rotateY([(min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2], building.rotation)
  return { x: building.position[0] + center[0], y: 0, z: building.position[2] + center[2] }
}

// Resolves any selectable id to { type, item, position } in the current site.
export function findEntity(id, state = currentSite()) {
  if (!id) return null
  if (state.site.kind === 'campus') {
    const building = state.buildings.find((candidate) => candidate.id === id)
    if (building) return { type: 'building', item: building, position: buildingCenter(building) }
    const truck = state.trucks.find((candidate) => candidate.id === id)
    if (truck) return { type: 'truck', item: truck, position: truck.position }
    return null
  }
  const tool = state.tools.find((candidate) => candidate.id === id)
  if (tool) return { type: 'tool', item: tool, position: tool.center }
  const vehicle = state.vehicles.find((candidate) => candidate.id === id)
  if (vehicle) return { type: 'vehicle', item: vehicle, position: vehicle.position }
  const lot = state.lots.find((candidate) => candidate.id === id)
  if (lot) return { type: 'lot', item: lot, position: lotPosition(state, lot) }
  const person = state.people.find((candidate) => candidate.id === id)
  if (person) return { type: 'person', item: person, position: person.position }
  const stocker = state.stockers.find((candidate) => candidate.id === id)
  if (stocker) return { type: 'stocker', item: stocker, position: stocker.center }
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

export const FLY_DISTANCE = { tool: 30, stocker: 28, vehicle: 22, lot: 22, person: 16, building: 150, truck: 70 }

export function flyTo(position, distance, followId = null) {
  const controls = camera.controls
  if (!controls) return
  camera.followId = followId
  controls.moveTo(position.x, followTargetY(followId && findEntity(followId)), position.z, true)
  controls.dollyTo(distance, true)
}

// The camera aims at the height of what it follows: an OHT vehicle runs 4.6 m up.
function followTargetY(entity) {
  if (currentSite().site.kind !== 'fab') return 0
  if (entity?.type === 'vehicle') return 3.6
  if (entity?.type === 'lot') return Math.max(1.2, entity.position.y)
  return 1.2
}

export function followSelection() {
  const entity = camera.followId && findEntity(camera.followId)
  if (!entity) return
  camera.controls.moveTo(entity.position.x, followTargetY(entity), entity.position.z, true)
}

export function siteView(state) {
  if (state.site.kind === 'campus') return { target: [12, 0, 22], azimuth: 0.42, polar: 0.92, distance: 330 }
  const { layout } = state
  return { target: [layout.width / 2, -1, (layout.front + layout.back) / 2 + 2], azimuth: 0.32, polar: 0.93, distance: layout.width * 1.12 + 22 }
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
  const site = world.sites[siteId].site
  setUi({ siteId, selectedId: null, tab: site.kind === 'campus' ? 'buildings' : 'lots', search: '' })
  viewSite(world.sites[siteId])
}
