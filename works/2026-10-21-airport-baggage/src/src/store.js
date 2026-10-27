import { useSyncExternalStore } from 'react';

// A tiny external store: the 3D view and the dashboard both read and write it.
const listeners = new Set();
let state = {
  siteId: 'hall',
  selection: null, // { kind: 'bag', planId } or { kind: 'unit', unitId }
  following: false,
  tab: 'bags',
  search: '',
  caption: '',
  orbiting: true,
  followDistance: 'mid',
  speed: 1,
  paused: false,
  stageIndex: -1, // the stage the camera was last sent to
  touring: false,
  tourIndex: -1,
  slowAtEvents: true,
  slowed: false, // easing to 0.25x around a stage event
};

export function getState() {
  return state;
}

export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}
