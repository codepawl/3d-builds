import { useSyncExternalStore } from 'react';
import { createWorld } from './world.js';
import { stepWorld } from './simulation.js';

// The world is mutated in place by the simulation every frame (cheap for the 3D view);
// the dashboard re-renders when the version changes, a few times per second.
export const world = createWorld();

// Run the office for a couple of minutes before the first frame, so it opens mid-day and busy.
const PREWARM_SECONDS = 150;
const PREWARM_STEP = 0.1;
for (let elapsed = 0; elapsed < PREWARM_SECONDS; elapsed += PREWARM_STEP) {
  stepWorld(world, PREWARM_STEP);
}

const listeners = new Set();
const UI_REFRESH_SECONDS = 0.2;
let secondsSinceRefresh = 0;

export function notify() {
  world.version += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function advance(deltaSeconds) {
  stepWorld(world, deltaSeconds);
  secondsSinceRefresh += deltaSeconds;
  if (secondsSinceRefresh >= UI_REFRESH_SECONDS) {
    secondsSinceRefresh = 0;
    notify();
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorldVersion() {
  return useSyncExternalStore(subscribe, () => world.version);
}

export function select(selection) {
  world.selection = selection;
  notify();
}

export function switchSpace(spaceId) {
  world.activeSpaceId = spaceId;
  world.selection = null;
  notify();
}
