import { sim } from './appContext.js';
import { SPEED_STEPS } from './sim/simulation.js';
import { STAGES } from './stages.js';
import { getState, setState } from './store.js';
import { flyTo, rig } from './runtime.js';
import { siteOfPosition } from './model.js';

const FLIGHT_SECONDS = 1.0;
const SLOW_SPEED = 0.25;
const SLOW_WINDOW_SECONDS = 0.5; // simulated seconds before and after the stage event
const TOUR_HOLD_AFTER_EVENT = 0.6; // simulated seconds

// What the tour has done, for the checks: one entry per stage, in order.
export const tourLog = [];
const tour = { active: false, index: -1, eventTime: 0, flightLeft: 0 };

// ---- Stage cameras ---------------------------------------------------------------------------

// The stage Next and Previous step from, kept even when the bar's marker is cleared.
let lastStageIndex = -1;

export function goToStage(index) {
  const stage = STAGES[index];
  if (!stage) return;
  lastStageIndex = index;
  rig.getFollowPosition = null;
  rig.orbitRate = 0;
  setState({
    stageIndex: index,
    selection: null,
    following: false,
    orbiting: false,
    siteId: siteOfPosition(stage.view.target[0]),
  });
  flyTo(stage.view, FLIGHT_SECONDS);
}

export function pickStage(index) {
  stopTour();
  goToStage(index);
}

export function nextStage() {
  stopTour();
  const current = lastStageIndex;
  goToStage(current < 0 ? 0 : (current + 1) % STAGES.length);
}

export function previousStage() {
  stopTour();
  const current = lastStageIndex;
  goToStage(current <= 0 ? STAGES.length - 1 : current - 1);
}

// ---- Speed and pause -------------------------------------------------------------------------

export function setSpeed(value) {
  const nearest = SPEED_STEPS.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), SPEED_STEPS[0]);
  setState({ speed: nearest });
}

export function stepSpeed(direction) {
  const index = SPEED_STEPS.indexOf(getState().speed);
  const next = Math.min(SPEED_STEPS.length - 1, Math.max(0, index + direction));
  setState({ speed: SPEED_STEPS[next] });
}

export function setPaused(paused) {
  setState({ paused });
}

export function togglePause() {
  setPaused(!getState().paused);
}

// One fixed step while paused.
export function stepOnce() {
  if (!getState().paused) setPaused(true);
  sim.stepForward();
}

export function setSlowAtEvents(enabled) {
  setState({ slowAtEvents: enabled });
}

// ---- Tour ------------------------------------------------------------------------------------

function enterTourStage(index) {
  goToStage(index);
  tour.index = index;
  tour.flightLeft = FLIGHT_SECONDS;
  // The event must come after the camera has arrived, so look one flight ahead in simulated time.
  const lead = FLIGHT_SECONDS * getState().speed;
  tour.eventTime = STAGES[index].eventAfter(sim, sim.time + lead);
  tourLog.push({ key: STAGES[index].key, enteredAt: sim.time, eventTime: tour.eventTime, doneAt: null });
  setState({ tourIndex: index });
}

export function startTour() {
  if (tour.active) return;
  tourLog.length = 0;
  tour.active = true;
  setState({ touring: true, selection: null, following: false });
  enterTourStage(0);
}

export function stopTour() {
  if (!tour.active) return;
  tour.active = false;
  tour.index = -1;
  setState({ touring: false, tourIndex: -1, slowed: false });
}

export function toggleTour() {
  if (tour.active) stopTour();
  else startTour();
}

// Called once per rendered frame before the simulation advances: sets the effective speed and moves the tour on.
export function updatePlayback(deltaSeconds) {
  const state = getState();
  let speed = state.speed;
  let slowed = false;
  if (tour.active && state.slowAtEvents) {
    const distance = sim.time - tour.eventTime;
    if (distance > -SLOW_WINDOW_SECONDS && distance < SLOW_WINDOW_SECONDS) {
      speed = Math.min(speed, SLOW_SPEED);
      slowed = true;
    }
  }
  sim.state.speed = speed;
  sim.state.paused = state.paused;
  if (slowed !== state.slowed) setState({ slowed });

  if (!tour.active) return;
  tour.flightLeft -= Math.min(deltaSeconds, 0.1);
  if (tour.flightLeft > 0 || sim.time < tour.eventTime + TOUR_HOLD_AFTER_EVENT) return;
  tourLog[tourLog.length - 1].doneAt = sim.time;
  if (tour.index + 1 < STAGES.length) enterTourStage(tour.index + 1);
  else stopTour();
}

// ---- Keys and clicks ---------------------------------------------------------------------------

export function installPlaybackInput() {
  // Any click or drag outside the playback controls stops the tour.
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!tour.active) return;
      if (event.target instanceof Element && event.target.closest('[data-keeps-tour]')) return;
      stopTour();
    },
    true,
  );
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.isContentEditable)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key >= '1' && event.key <= String(STAGES.length)) {
      pickStage(Number(event.key) - 1);
    } else if (event.key === ' ') {
      event.preventDefault();
      togglePause();
    } else if (event.key === '-' || event.key === '_') {
      stepSpeed(-1);
    } else if (event.key === '+' || event.key === '=') {
      stepSpeed(1);
    } else if (event.key === 'Escape') {
      stopTour();
    }
  });
}
