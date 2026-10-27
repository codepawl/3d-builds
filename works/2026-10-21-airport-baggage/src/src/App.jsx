import Scene from './world/Scene.jsx';
import Dashboard from './ui/Dashboard.jsx';
import { sim } from './appContext.js';
import { flyTo, rig, selectBag, selectUnit, switchSite, clearSelection } from './runtime.js';
import { STAGES } from './stages.js';
import { SPEED_STEPS } from './sim/simulation.js';
import { goToStage, installPlaybackInput, nextStage, previousStage, setPaused, setSlowAtEvents, setSpeed, startTour, stepOnce, stopTour, tourLog } from './playback.js';
import { getState } from './store.js';
import { setState } from './store.js';

// Handles for the check scripts and the film recorder.
window.__sim = sim;
window.__app = {
  flyTo, rig, selectBag, selectUnit, switchSite, clearSelection, setState,
  // Stage cameras and playback, for the checks and the film.
  stages: STAGES,
  speeds: SPEED_STEPS,
  goToStage, nextStage, previousStage, startTour, stopTour, tourLog,
  setSpeed, setPaused, stepOnce, setSlowAtEvents,
  get speed() { return getState().speed; },
  get paused() { return getState().paused; },
  get effectiveSpeed() { return sim.state.speed; },
  get touring() { return getState().touring; },
};
installPlaybackInput();

export default function App() {
  return (
    <>
      <div className="viewport">
        <Scene />
      </div>
      <Dashboard />
    </>
  );
}
