// Mutable run-time state shared between the simulation, the 3D parts and the UI. Written every frame by
// the Simulation component; read by parts in their own frame callbacks (no React re-render per frame).
import { createContext, useSyncExternalStore } from 'react'

export const live = {
  drive: {}, // brightness 0..1 per named output, e.g. drive.pin13
  pressed: false, // the 3D push button is held down
  hover: false, // the pointer is over something draggable: orbit controls step aside
  potAngle: 135, // degrees of knob travel, 0..270
  servoAngle: 90, // degrees, 0..180
  callbacks: {}, // set by the app: setPot(angle)
  step: 0,
}

export const SceneContext = createContext({ theme: null, step: 0, curves: {}, labels: false, current: false, sandbox: false })

// Readouts published to the UI a few times a second.
let readouts = {}
const listeners = new Set()
export function publish(changes) {
  readouts = { ...readouts, ...changes }
  listeners.forEach((listener) => listener())
}
export function useReadouts() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => readouts)
}

// Callout labels pinned to 3D points: scenes set the list, a projector inside the canvas moves the DOM pins.
const labelChannels = {}
let labelEntries = []
const labelListeners = new Set()
export const labelNodes = new Map()
// Each source (lesson callouts, current labels, ...) owns a channel so they do not wipe each other.
export function setLabelEntries(entries, channel = 'callouts') {
  labelChannels[channel] = entries
  labelEntries = Object.values(labelChannels).flat()
  labelListeners.forEach((listener) => listener())
}
export function useLabelEntries() {
  return useSyncExternalStore((listener) => {
    labelListeners.add(listener)
    return () => labelListeners.delete(listener)
  }, () => labelEntries)
}
