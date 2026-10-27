import { useSyncExternalStore } from 'react'

// Tiny external store: React reads it for the dashboard, the 3D scene writes the live snapshot into it.
const state = {
  siteId: 'harbour',
  selected: null,
  tab: 'trains',
  search: '',
  snapshot: null,
  detail: null,
  orbiting: false,
  following: null,
  switching: 0,
  paused: false,
  speed: 1,
  slowAtEvents: true,
  stageKey: null,
  pendingStage: null,
  visitedStages: [],
  tour: null,
  lastTourVisits: [],
  followDistance: 'mid',
}
const listeners = new Set()
let version = 0

export function getState() {
  return state
}

export function setState(patch) {
  Object.assign(state, patch)
  version += 1
  listeners.forEach((listener) => listener())
}

export function useStore(selector) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => selector(state, version),
  )
}

// Camera commands are consumed by the camera rig inside the canvas.
export const cameraBus = {
  pending: [],
  push(command) {
    this.pending.push(command)
  },
}

if (typeof window !== 'undefined') {
  window.__store = { getState, setState }
  window.__bus = cameraBus
}
