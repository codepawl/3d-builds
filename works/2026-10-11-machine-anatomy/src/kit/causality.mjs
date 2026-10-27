// Completeness and causality (references/completeness-and-causality.md), as pure checks over what the
// recorder samples each frame (the figure's snapshot, its readout and the film time).
//
// Completeness: `machine.functions` lists every working part of the machine and its setting, each with the
// snapshot key that moves when it works (`probe`) and the film seconds it is shown working (`shown`), or an
// `outOfScope` reason. Lint checks the list; the recorder checks that each probe really changes near each
// shown time.
//
// Causality: `film.bodies` lists the bodies whose motion the film shows (`angle`: snapshot key in radians,
// `clock`: snapshot key of the machine's own seconds, `cause(state)`: the cause acting now, or "none",
// `maxRate`: the most degrees per second the real body turns). A turn that speeds up or slows down while no
// cause acts fails, and so does a turn faster than the body can turn. A clock that runs faster or slower
// than the film must be shown in the readout (`film.timeShown`, a pattern).

const WINDOW_SECONDS = 1.5;
const CHANGE = 0.005;
const ANGULAR_ACCELERATION = 0.03;
const SHORTEST_STEP = 1e-3;
const COMPRESSION_TOLERANCE = 0.2;
const LEAST_FRAMES = 3;
const PACE_SECONDS = 0.25;
// The kit's own take-apart status lines replace the readout while the parts move; those frames are skipped.
const KIT_STATUS = /^(coming apart|going back together|apart · \w+ assemblies|.+ · then apart)$/;

// ---- completeness ---------------------------------------------------------------------------------------

export function lintFunctions(machine) {
  const problems = [];
  const functions = machine.functions;
  if (!Array.isArray(functions) || !functions.length) return ["the machine lists no functions (machine.functions: every working part and what shows it)"];
  const parts = new Set(Object.keys(machine.pieces ?? {}));
  const seconds = machine.film?.seconds ?? 30;
  for (const entry of functions) {
    const name = entry.id ?? "(unnamed)";
    if (!entry.id || !entry.does) problems.push(`function ${name} needs an id and a "does" line`);
    if (!parts.has(entry.part)) problems.push(`function ${name} names part "${entry.part}", which is not an assembly`);
    if (entry.outOfScope) continue;
    if (!entry.probe || !(entry.shown ?? []).length) {
      problems.push(`function ${name} is never shown working: give it a probe and shown film seconds, or an outOfScope reason`);
      continue;
    }
    for (const time of entry.shown) {
      if (!(time >= 0 && time <= seconds)) problems.push(`function ${name} is shown at ${time} s, outside the ${seconds} s film`);
    }
  }
  return problems;
}

function rangeNear(states, fps, key, time) {
  const first = Math.max(0, Math.floor((time - WINDOW_SECONDS) * fps));
  const last = Math.min(states.length - 1, Math.ceil((time + WINDOW_SECONDS) * fps));
  const values = [];
  for (let frame = first; frame <= last; frame++) {
    const value = Number(states[frame]?.[key]);
    if (Number.isFinite(value)) values.push(value);
  }
  return values.length ? Math.max(...values) - Math.min(...values) : null;
}

export function functionProblems(functions = [], states, fps) {
  const problems = [];
  for (const entry of functions) {
    if (entry.outOfScope || !entry.probe) continue;
    for (const time of entry.shown ?? []) {
      const change = rangeNear(states, fps, entry.probe, time);
      if (change === null) problems.push(`function ${entry.id}: the film never reports "${entry.probe}"`);
      else if (change < CHANGE) problems.push(`function ${entry.id} is not seen working near ${time} s ("${entry.probe}" does not change)`);
    }
  }
  return problems;
}

// ---- causality ------------------------------------------------------------------------------------------

function turnSamples(body, states) {
  const samples = [];
  for (const state of states) {
    const angle = Number(state[body.angle]);
    const clock = Number(state[body.clock]);
    if (Number.isFinite(angle) && Number.isFinite(clock)) samples.push({ angle, clock, cause: body.cause(state), at: state.time });
  }
  return samples;
}

function rates(samples) {
  const turned = [];
  for (let index = 1; index < samples.length; index++) {
    const seconds = samples[index].clock - samples[index - 1].clock;
    if (seconds < SHORTEST_STEP) continue;
    turned.push({ rate: (samples[index].angle - samples[index - 1].angle) / seconds, clock: samples[index].clock, cause: samples[index].cause, at: samples[index].at });
  }
  return turned;
}

// Returns problems, at most one sentence per kind and body, with the worst value and when it happened.
export function causalityProblems(bodies = [], states) {
  const problems = [];
  for (const body of bodies) {
    const turned = rates(turnSamples(body, states));
    let fastest = null;
    let uncaused = null;
    for (let index = 0; index < turned.length; index++) {
      const sample = turned[index];
      const degrees = Math.abs(sample.rate) * (180 / Math.PI);
      if (degrees > body.maxRate && (!fastest || degrees > fastest.degrees)) fastest = { degrees, at: sample.at };
      if (index === 0) continue;
      const seconds = sample.clock - turned[index - 1].clock;
      const acceleration = Math.abs(sample.rate - turned[index - 1].rate) / Math.max(seconds, SHORTEST_STEP);
      if (sample.cause === "none" && acceleration > ANGULAR_ACCELERATION && (!uncaused || acceleration > uncaused.acceleration)) uncaused = { acceleration, at: sample.at };
    }
    if (fastest) problems.push(`${body.name} turns at ${fastest.degrees.toFixed(1)} deg/s at ${fastest.at.toFixed(2)} s, faster than the ${body.maxRate} deg/s it can`);
    if (uncaused) problems.push(`${body.name} changes its turn (${uncaused.acceleration.toFixed(2)} rad/s²) at ${uncaused.at.toFixed(2)} s with nothing acting on it`);
  }
  return problems;
}

// A machine clock that runs faster or slower than the film must say so in the readout.
export function timeShownProblems(film, states) {
  if (!film.clock || !film.timeShown) return [];
  const pattern = new RegExp(film.timeShown);
  let hidden = null;
  let run = 0;
  // The pace is measured over about half a second, so a model clock that moves in fixed steps reads true.
  let earlier = 0;
  for (let index = 1; index < states.length; index++) {
    while (earlier < index - 1 && states[index].time - states[earlier + 1].time >= PACE_SECONDS) earlier++;
    const filmSeconds = states[index].time - states[earlier].time;
    const clockSeconds = Number(states[index][film.clock]) - Number(states[earlier][film.clock]);
    if (!(filmSeconds > 0) || !Number.isFinite(clockSeconds) || clockSeconds <= 0) continue;
    if (KIT_STATUS.test(states[index].readout ?? "")) continue;
    const factor = clockSeconds / filmSeconds;
    const unshown = Math.abs(factor - 1) > COMPRESSION_TOLERANCE && !pattern.test(states[index].readout ?? "");
    run = unshown ? run + 1 : 0;
    // One odd frame (a clock that stops partway through it, at touchdown) is not a visible change of pace.
    if (run >= LEAST_FRAMES && (!hidden || Math.abs(factor - 1) > Math.abs(hidden.factor - 1))) hidden = { factor, at: states[index].time };
  }
  return hidden ? [`time runs at ×${hidden.factor.toFixed(1)} at ${hidden.at.toFixed(2)} s and the readout does not show it`] : [];
}
