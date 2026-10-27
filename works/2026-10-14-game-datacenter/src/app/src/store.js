// The one model both views read: a world per site, the active site and the selection.
// The 3D view reads it every frame; React components re-render on a slower UI tick.
import { useSyncExternalStore } from 'react'
import { SITES, buildWorld } from './world.js'
import { siteMetrics, stepWorld } from './sim.js'

const FIXED_STEP = 1 / 30
const UI_TICK_SECONDS = 0.25

const worlds = new Map()
const listeners = new Set()

export const model = {
  siteId: SITES[0].id,
  selectedId: null,
  version: 0,
}

let accumulator = 0
let sinceUiTick = 0

export function activeWorld() {
  if (!worlds.has(model.siteId)) {
    const site = SITES.find((candidate) => candidate.id === model.siteId)
    const world = buildWorld(site)
    // Warm up so temperatures and loads have settled before anyone looks.
    world.nextIncidentAt = Infinity
    for (let step = 0; step < 90; step++) stepWorld(world, FIXED_STEP)
    world.time = 0
    world.trend = siteMetrics(world)
    world.nextIncidentAt = 2.2
    worlds.set(model.siteId, world)
  }
  return worlds.get(model.siteId)
}

function notify() {
  model.version += 1
  for (const listener of listeners) listener()
}

export function advance(deltaSeconds) {
  const world = activeWorld()
  accumulator += Math.min(deltaSeconds, 0.25)
  while (accumulator >= FIXED_STEP) {
    stepWorld(world, FIXED_STEP)
    accumulator -= FIXED_STEP
  }
  sinceUiTick += deltaSeconds
  if (sinceUiTick >= UI_TICK_SECONDS) {
    sinceUiTick = 0
    notify()
  }
}

export function select(id) {
  model.selectedId = id
  notify()
}

export function switchSite(siteId) {
  model.siteId = siteId
  model.selectedId = null
  notify()
}

export function selectedEntity() {
  return model.selectedId ? activeWorld().index.get(model.selectedId) : null
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Components call this to re-render on every UI tick and read the model directly.
export function useModelVersion() {
  return useSyncExternalStore(subscribe, () => model.version)
}
