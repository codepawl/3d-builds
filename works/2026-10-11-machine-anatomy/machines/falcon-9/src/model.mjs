// Pure model of one Falcon 9 flight with a droneship landing. No DOM in here: the build, the page, the film
// and the tests all read this one file.
//
// What is physics (flat Earth, one vertical plane, x downrange and h up): thrust along the body, gravity,
// drag from an exponential atmosphere, mass falling as propellant burns, a critically damped attitude
// spring standing in for the gimbals and the nitrogen thrusters. Max Q comes out of the integration.
// What is sourced (reference/notes.md): liftoff mass, thrust per engine, nine engines and one vacuum
// engine, the throttle range, and the ascent event times of the user's guide (max Q T+74 s, MECO T+147 s,
// separation T+151 s, second engine start T+158 s, fairing separation T+222 s). What is chosen: the masses
// of the stages, the specific impulse, the drag, the pitch program, the recovery burn times and the playback
// rate that compresses the eight minutes into a film. Every chosen value is listed in reference/notes.md.
import { clamp, createSpring, setSpringTarget, springFor, stepRateLimited, stepSpring } from "../../../src/kit/motion.mjs";

const GRAVITY = 9.81;
const LIFTOFF_MASS = 549054;
const ENGINE_THRUST = 845000;
const VACUUM_THRUST = 981000;
const ENGINE_COUNT = 9;
const MIN_THROTTLE = 108300 / 190000;
const SPECIFIC_IMPULSE = 300;
const VACUUM_IMPULSE = 348;
const UPPER_MASS = 126500;
const BOOSTER_DRY = 25600;
const BOOSTER_PROPELLANT = LIFTOFF_MASS - UPPER_MASS - BOOSTER_DRY;
const FAIRING_MASS = 1900;
const AIR_DENSITY = 1.225;
const SCALE_HEIGHT = 8500;
const STACK_DRAG_AREA = 3.6;
const BOOSTER_DRAG_AREA = 22;
const FIN_LIFT = 0.012;
const LONGEST_STEP = 1 / 50;

// Mission elapsed seconds from the user's guide (the first of its two sample timelines).
const TIMES = { engineStart: -3, liftoff: 0, maxQ: 74, meco: 147, separation: 151, ses1: 158, fairing: 222 };
// Chosen for the model: when the pitch-over starts, the throttle bucket round max Q, the recovery burns.
const PLAN = {
  pitchStart: 9,
  pitchKick: 0.07,
  pitchKickEnd: 22,
  throttleDownFrom: 52,
  throttleBack: 96,
  bucketThrottle: 0.7,
  flipEnd: 182,
  boostbackEngines: 3,
  boostbackSeconds: 15,
  boostbackPitch: -1.35,
  finsDeploy: 199,
  entryAltitude: 52000,
  entryEngines: 3,
  entrySpeedCut: 900,
  landingThrottle: 0.5,
  legsAltitude: 260,
  dragCredit: 0.3,
  pushSpeed: 1.6,
};
const ATTITUDE_SPRING = springFor(6, 1);
// Chosen turn rates in radians per second (model-values): in thin air only the cold-gas nitrogen thrusters
// turn the booster, slowly; a burning engine's gimbal or the grid fins in thicker air turn it faster.
const TURN_RATES = { thrusters: 0.12, engines: 0.22, fins: 0.3 };
const FIN_SPRING = springFor(1.6, 1);
const LEG_SPRING = springFor(2.4, 1);
const THROTTLE_SPRING = springFor(0.8, 1);

// The booster's phases, in the order they happen. The second stage has its own short list.
const PHASES = ["pad", "ignition", "liftoff", "ascent", "max-q", "full-power", "meco", "separation", "flip", "boostback", "coast", "entry-burn", "glide", "landing-burn", "landed"];
const PHASE_WORDS = {
  pad: "on the pad",
  ignition: "engines starting, held down",
  liftoff: "liftoff",
  ascent: "climbing, tipping downrange",
  "max-q": "max Q, engines throttled down",
  "full-power": "back to full power",
  meco: "main engine cutoff",
  separation: "stage separation",
  flip: "booster flips with nitrogen thrusters",
  boostback: "boostback burn",
  coast: "coasting, grid fins out",
  "entry-burn": "entry burn on 3 engines",
  glide: "grid fins steering",
  "landing-burn": "landing burn on the centre engine only",
  landed: "landed on the droneship",
};

// The film's numbered steps (the ascent) and the trace under the figure (the whole flight).
const STEPS = [
  { label: "Nine engines light, the clamps let go" },
  { label: "It climbs and tips over downrange" },
  { label: "Engines ease back through max Q" },
  { label: "Back to full power" },
];
const TRACE = ["lift off", "climb", "split in two", "turn around", "fairing drops, payload flies on", "brake on 3 engines", "land on the centre engine"];

function smooth(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

function densityAt(altitude) {
  return AIR_DENSITY * Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT);
}

function createBody(mass) {
  return { x: 0, h: 0, vx: 0, vh: 0, mass, attitude: createSpring({ ...ATTITUDE_SPRING, value: 0 }), pitch: 0, engines: 0, throttle: createSpring({ ...THROTTLE_SPRING, value: 0 }) };
}

function createFlight() {
  const booster = createBody(LIFTOFF_MASS);
  const upper = { x: 0, h: 0, vx: 0, vh: 0, mass: UPPER_MASS, pitch: 0, burning: false, fairingOn: true, apart: 0, apartSpeed: 0, fairingOpen: 0 };
  return {
    time: TIMES.engineStart + 0.8,
    phase: "pad",
    booster,
    upper,
    joined: true,
    propellant: BOOSTER_PROPELLANT,
    dynamicPressure: 0,
    peakPressure: { value: 0, at: 0 },
    fins: createSpring({ ...FIN_SPRING, value: 0 }),
    legs: createSpring({ ...LEG_SPRING, value: 0 }),
    entryStartSpeed: 0,
    boostbackEnd: Infinity,
    landedAt: null,
    pending: 0,
    history: [],
  };
}

// Pitch is the body's angle from straight up, positive toward downrange.
function pitchOfVelocity(body) {
  return Math.atan2(body.vx, body.vh);
}

function speedOf(body) {
  return Math.hypot(body.vx, body.vh);
}

function wantedThrottle(flight) {
  const time = flight.time;
  if (time < TIMES.meco) {
    const bucket = smooth(PLAN.throttleDownFrom, PLAN.throttleDownFrom + 8, time) * (1 - smooth(PLAN.throttleBack - 8, PLAN.throttleBack, time));
    return 1 - (1 - PLAN.bucketThrottle) * bucket;
  }
  return 1;
}

function ascentPitch(flight) {
  const time = flight.time;
  if (time < PLAN.pitchStart) return 0;
  if (time < PLAN.pitchKickEnd) return PLAN.pitchKick * smooth(PLAN.pitchStart, PLAN.pitchKickEnd, time);
  return Math.max(PLAN.pitchKick, pitchOfVelocity(flight.booster));
}

// The landing burn: one engine, throttled so that the deceleration brings the speed to zero at the deck.
function landingThrottle(booster) {
  const falling = Math.max(0, -booster.vh);
  const height = Math.max(0.5, booster.h);
  const drag = (0.5 * densityAt(booster.h) * speedOf(booster) ** 2 * BOOSTER_DRAG_AREA) / booster.mass;
  const needed = (falling * falling) / (2 * height) + GRAVITY - drag * PLAN.dragCredit;
  return clamp((needed * booster.mass) / ENGINE_THRUST, MIN_THROTTLE, 1);
}

function landingBurnDue(booster) {
  const falling = Math.max(0, -booster.vh);
  const drag = (0.5 * densityAt(booster.h) * speedOf(booster) ** 2 * BOOSTER_DRAG_AREA) / booster.mass;
  const braking = (PLAN.landingThrottle * ENGINE_THRUST) / booster.mass - GRAVITY + drag;
  return booster.vh < 0 && booster.h < 4000 && booster.h <= (falling * falling) / (2 * braking);
}

function enter(flight, phase, events) {
  if (flight.phase === phase) return;
  flight.phase = phase;
  flight.history.push({ phase, at: Math.round(flight.time * 100) / 100 });
  events.push({ name: `phase-${phase}`, phase });
}

// Decides the phase, the engines and the attitude target from the state. Returns nothing; writes flight.
function command(flight, events) {
  const booster = flight.booster;
  const time = flight.time;
  if (flight.phase === "landed") return;
  if (time < TIMES.engineStart) return;
  if (time < TIMES.liftoff) {
    enter(flight, "ignition", events);
    booster.engines = ENGINE_COUNT;
    setSpringTarget(booster.throttle, 1);
    return;
  }
  if (time < TIMES.meco) {
    if (time < PLAN.pitchStart) enter(flight, "liftoff", events);
    else if (time < PLAN.throttleDownFrom) enter(flight, "ascent", events);
    else if (time < PLAN.throttleBack) enter(flight, "max-q", events);
    else enter(flight, "full-power", events);
    booster.engines = ENGINE_COUNT;
    setSpringTarget(booster.throttle, wantedThrottle(flight));
    setSpringTarget(booster.attitude, ascentPitch(flight));
    return;
  }
  commandRecovery(flight, events);
}

function commandRecovery(flight, events) {
  const booster = flight.booster;
  const time = flight.time;
  if (time < TIMES.separation) {
    enter(flight, "meco", events);
    booster.engines = 0;
    setSpringTarget(booster.throttle, 0);
    return;
  }
  if (flight.joined) {
    flight.joined = false;
    enter(flight, "separation", events);
    flight.upper.apartSpeed = PLAN.pushSpeed;
    flight.booster.mass = BOOSTER_DRY + flight.propellant;
  }
  if (time < TIMES.ses1) {
    booster.engines = 0;
    return;
  }
  if (time < PLAN.flipEnd) {
    enter(flight, "flip", events);
    setSpringTarget(booster.attitude, PLAN.boostbackPitch);
    return;
  }
  if (time < PLAN.flipEnd + PLAN.boostbackSeconds) {
    enter(flight, "boostback", events);
    booster.engines = PLAN.boostbackEngines;
    setSpringTarget(booster.throttle, 1);
    setSpringTarget(booster.attitude, PLAN.boostbackPitch);
    return;
  }
  const retrograde = Math.atan2(-booster.vx, -booster.vh);
  setSpringTarget(booster.attitude, retrograde);
  if (time >= PLAN.finsDeploy && flight.fins.target === 0) {
    setSpringTarget(flight.fins, 1);
    events.push({ name: "fins-deploy" });
  }
  commandDescent(flight, events);
}

function commandDescent(flight, events) {
  const booster = flight.booster;
  const phase = flight.phase;
  if (phase === "boostback" || phase === "flip") {
    enter(flight, "coast", events);
    booster.engines = 0;
    setSpringTarget(booster.throttle, 0);
  }
  if (flight.phase === "coast" && booster.vh < 0 && booster.h < PLAN.entryAltitude) {
    enter(flight, "entry-burn", events);
    flight.entryStartSpeed = speedOf(booster);
    booster.engines = PLAN.entryEngines;
    setSpringTarget(booster.throttle, 1);
  }
  if (flight.phase === "entry-burn" && speedOf(booster) < flight.entryStartSpeed - PLAN.entrySpeedCut) {
    enter(flight, "glide", events);
    booster.engines = 0;
    setSpringTarget(booster.throttle, 0);
  }
  if (flight.phase === "glide" && landingBurnDue(booster)) enter(flight, "landing-burn", events);
  if (flight.phase === "landing-burn") {
    booster.engines = 1;
    setSpringTarget(booster.throttle, landingThrottle(booster));
    if (booster.h < PLAN.legsAltitude && flight.legs.target === 0) {
      setSpringTarget(flight.legs, 1);
      events.push({ name: "legs-deploy" });
    }
  }
}

// Grid fins move the centre of pressure: here a small sideways force toward the droneship, growing with
// the air's push on the fins.
function finForce(flight, droneshipX) {
  const booster = flight.booster;
  const deployed = flight.fins.value;
  if (deployed < 0.5 || flight.phase === "landed" || !Number.isFinite(droneshipX)) return 0;
  const secondsToGo = Math.max(0, booster.h) / Math.max(50, -booster.vh);
  const aim = droneshipX - (booster.x + booster.vx * secondsToGo);
  const pressure = 0.5 * densityAt(booster.h) * speedOf(booster) ** 2;
  return clamp(aim / 300, -1, 1) * FIN_LIFT * pressure * deployed * 120;
}

function burnRate(body, thrustEach, impulse) {
  return (body.engines * thrustEach * Math.max(0, body.throttle.value)) / (impulse * GRAVITY);
}

function moveBody(body, seconds, thrust, dragArea, sideForce = 0) {
  const speed = speedOf(body);
  const drag = 0.5 * densityAt(body.h) * speed * speed * dragArea;
  const along = speed > 0.01 ? [body.vx / speed, body.vh / speed] : [0, 0];
  const ax = (thrust * Math.sin(body.pitch) - drag * along[0] + sideForce) / body.mass;
  const ah = (thrust * Math.cos(body.pitch) - drag * along[1]) / body.mass - GRAVITY;
  body.vx += ax * seconds;
  body.vh += ah * seconds;
  body.x += body.vx * seconds;
  body.h += body.vh * seconds;
}

function stepBooster(flight, seconds, droneshipX, events) {
  const booster = flight.booster;
  stepSpring(booster.throttle, seconds);
  booster.pitch = turnBooster(flight, seconds);
  stepSpring(flight.fins, seconds);
  stepSpring(flight.legs, seconds);
  if (flight.phase === "landed" || flight.time < TIMES.engineStart) return;
  const used = Math.min(flight.propellant, burnRate(booster, ENGINE_THRUST, SPECIFIC_IMPULSE) * seconds);
  flight.propellant -= used;
  booster.mass -= used;
  const thrust = flight.propellant > 0 ? booster.engines * ENGINE_THRUST * Math.max(0, booster.throttle.value) : 0;
  const weight = booster.mass * GRAVITY;
  if (flight.phase === "ignition" || (booster.h <= 0 && thrust < weight)) return;
  moveBody(booster, seconds, thrust, flight.joined ? STACK_DRAG_AREA : BOOSTER_DRAG_AREA, finForce(flight, droneshipX));
  if (flight.phase === "landing-burn" && booster.h <= 0) touchDown(flight, events);
}

// Which actuator turns the booster now, and so how fast it may turn. Joined, the stack follows its pitch
// program on the engines' gimbals without a limit.
function turnRate(flight) {
  const booster = flight.booster;
  if (flight.joined || flight.phase === "landed") return Infinity;
  if (booster.engines > 0 && booster.throttle.value > 0.05) return TURN_RATES.engines;
  if (flight.fins.value > 0.5 && densityAt(booster.h) > 0.01) return TURN_RATES.fins;
  return TURN_RATES.thrusters;
}

// What turns the booster now, in words the film check reads: the stack's gimbals, a burning engine, the
// grid fins in air, the nitrogen thrusters in thin air, or the deck it stands on.
function turnCause(flight) {
  const booster = flight.booster;
  if (flight.phase === "landed" || booster.h <= 0) return "deck";
  if (flight.joined || (booster.engines > 0 && booster.throttle.value > 0.05)) return "engines";
  if (flight.fins.value > 0.5 && densityAt(booster.h) > 0.01) return "grid fins";
  return "nitrogen thrusters";
}

// The attitude spring, held to the turn rate: the booster never turns faster than its actuators allow.
function turnBooster(flight, seconds) {
  return stepRateLimited(flight.booster.attitude, seconds, turnRate(flight));
}

function touchDown(flight, events) {
  const booster = flight.booster;
  flight.touchdownSpeed = Math.hypot(booster.vx, booster.vh);
  booster.h = 0;
  booster.vx = 0;
  booster.vh = 0;
  booster.engines = 0;
  setSpringTarget(booster.throttle, 0);
  setSpringTarget(booster.attitude, 0);
  flight.landedAt = flight.time;
  enter(flight, "landed", events);
}

// While joined the second stage rides on the booster; afterwards it coasts, lights its engine and drops
// its fairing. `apart` is its distance from the booster along the stack in metres, for the drawing.
function stepUpper(flight, seconds, events) {
  const upper = flight.upper;
  const booster = flight.booster;
  if (flight.joined) {
    Object.assign(upper, { x: booster.x, h: booster.h, vx: booster.vx, vh: booster.vh, pitch: booster.pitch });
    return;
  }
  if (!upper.burning && flight.time >= TIMES.ses1) {
    upper.burning = true;
    events.push({ name: "ses-1" });
  }
  if (upper.fairingOn && flight.time >= TIMES.fairing) {
    upper.fairingOn = false;
    upper.mass -= FAIRING_MASS;
    events.push({ name: "fairing-separation" });
  }
  const thrust = upper.burning ? VACUUM_THRUST : 0;
  if (upper.burning) upper.mass -= (VACUUM_THRUST / (VACUUM_IMPULSE * GRAVITY)) * seconds;
  upper.pitch = Math.max(0.9, Math.min(upper.pitch, 1.35));
  moveBody(upper, seconds, thrust, 1.5);
  if (upper.burning) upper.apartSpeed += (thrust / upper.mass) * seconds;
  upper.apart += upper.apartSpeed * seconds;
  if (!upper.fairingOn) upper.fairingOpen += seconds;
}

// Advances the flight by `seconds` of mission time and returns what happened.
function step(flight, seconds, aimX = plannedLanding().aim) {
  const events = [];
  const piece = LONGEST_STEP;
  // Fixed pieces, the remainder carried over: the same flight for any frame rate or call pattern.
  flight.pending += seconds;
  while (flight.pending >= piece - 1e-12) {
    flight.pending -= piece;
    flight.time += piece;
    command(flight, events);
    stepBooster(flight, piece, aimX, events);
    stepUpper(flight, piece, events);
    trackPressure(flight);
  }
  return events;
}

function trackPressure(flight) {
  const booster = flight.booster;
  flight.dynamicPressure = 0.5 * densityAt(booster.h) * speedOf(booster) ** 2;
  if (flight.joined && flight.dynamicPressure > flight.peakPressure.value) flight.peakPressure = { value: flight.dynamicPressure, at: flight.time };
}

// The droneship waits where the booster comes down. The grid fins steer toward an aim point, the touchdown
// point of the same flight flown without fins; the droneship sits where the steered flight lands. Flown
// once and memoised (the model is deterministic).
let planned = null;
function flyWhole(aimX) {
  const flight = createFlight();
  while (flight.phase !== "landed" && flight.time < 900) step(flight, 0.5, aimX);
  return flight;
}

function plannedLanding() {
  if (planned) return planned;
  const unsteered = flyWhole(Number.NaN);
  const steered = flyWhole(unsteered.booster.x);
  planned = { aim: unsteered.booster.x, x: steered.booster.x, at: steered.landedAt, touchdownSpeed: steered.touchdownSpeed };
  return planned;
}

// How fast the film plays the flight: real time on the pad, then compressed, slower again for the
// landing burn. Eased by the page with a lag so the rate never jumps.
function coastRate(flight) {
  const falling = flight.booster.vh < 0;
  if (falling && flight.booster.h < 60000) return 12;
  if (falling && flight.booster.h < 80000) return 45;
  if (flight.time >= TIMES.fairing - 1 && flight.time < TIMES.fairing + 5) return 5;
  return flight.time < TIMES.fairing + 6 ? 30 : 300;
}

function playbackRate(flight) {
  const phase = flight.phase;
  if (phase === "pad" || phase === "ignition") return 1;
  if (phase === "liftoff") return 1 + 6 * smooth(1, PLAN.pitchStart, flight.time);
  if (phase === "ascent") return 12;
  if (phase === "max-q") return flight.time < TIMES.maxQ + 4 ? 18 : 55;
  if (phase === "full-power") return flight.time < TIMES.meco - 5 ? 80 : 4;
  if (phase === "meco" || phase === "separation") return 7;
  if (phase === "flip") return 8;
  if (phase === "boostback") return 20;
  if (phase === "coast") return coastRate(flight);
  if (phase === "entry-burn") return 12;
  if (phase === "glide") return flight.booster.h > 20000 ? 200 : flight.booster.h > 5000 ? 70 : 18;
  if (phase === "landing-burn") return 3.4;
  return 1;
}

// The page eases the playback rate toward the wanted one with a short lag, so it never jumps.
// Slowing down eases faster than speeding up, so a slow moment (the landing burn) is not run through at
// the speed of the coast before it.
const PLAYBACK_LAG = 0.4;
const PLAYBACK_BRAKE = 0.15;
function easePlayback(current, wanted, seconds) {
  const lag = wanted < current ? PLAYBACK_BRAKE : PLAYBACK_LAG;
  return current + (wanted - current) * Math.min(1, seconds / lag);
}

function throttleShare(flight) {
  return Math.max(0, flight.booster.throttle.value);
}

function phaseIndex(phase) {
  return PHASES.indexOf(phase);
}

function reached(flight, phase) {
  return phaseIndex(flight.phase) >= phaseIndex(phase);
}

function stepLevels(flight) {
  const time = flight.time;
  return [smooth(-1.5, 0.6, time), smooth(PLAN.pitchStart, PLAN.pitchStart + 10, time), reached(flight, "max-q") ? smooth(PLAN.throttleDownFrom, PLAN.throttleDownFrom + 8, time) : 0, reached(flight, "full-power") ? 1 : 0];
}

function traceLevels(flight) {
  return [reached(flight, "liftoff") ? 1 : 0, reached(flight, "ascent") ? 1 : 0, reached(flight, "separation") ? 1 : 0, reached(flight, "flip") ? 1 : 0, flight.time >= TIMES.fairing ? 1 : 0, reached(flight, "entry-burn") ? 1 : 0, reached(flight, "landing-burn") ? 1 : 0];
}

function clockText(time) {
  const sign = time < 0 ? "-" : "+";
  const whole = Math.floor(Math.abs(time));
  return `T${sign}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function enginesText(flight) {
  const booster = flight.booster;
  if (booster.engines === 0 || throttleShare(flight) < 0.05) return "engines off";
  const count = booster.engines === 1 ? "1 engine" : `${booster.engines} engines`;
  return `${count} at ${Math.round(throttleShare(flight) * 100)}%`;
}

// How much faster than real time the film runs, in plain words; nothing at real time.
function timeFactorText(factor) {
  if (!(factor > 0) || Math.abs(factor - 1) < 0.05) return "";
  const shown = factor >= 10 ? String(Math.round(factor)) : String(Math.round(factor * 10) / 10);
  return ` · time ×${shown}`;
}

function readoutOf(flight, factor = 1) {
  const booster = flight.booster;
  const height = booster.h >= 1000 ? `${(booster.h / 1000).toFixed(1)} km up` : `${Math.round(Math.max(0, booster.h))} m up`;
  return `${clockText(flight.time)}${timeFactorText(factor)} · ${PHASE_WORDS[flight.phase]} · ${enginesText(flight)} · ${height} · ${Math.round(speedOf(booster))} m/s`;
}

export const FalconApi = {
  turnCause,
  GRAVITY,
  LIFTOFF_MASS,
  ENGINE_THRUST,
  VACUUM_THRUST,
  ENGINE_COUNT,
  MIN_THROTTLE,
  BOOSTER_DRY,
  TIMES,
  PLAN,
  PHASES,
  PHASE_WORDS,
  STEPS,
  TRACE,
  clamp,
  smooth,
  densityAt,
  createFlight,
  step,
  speedOf,
  plannedLanding,
  playbackRate,
  easePlayback,
  throttleShare,
  phaseIndex,
  reached,
  stepLevels,
  traceLevels,
  clockText,
  readoutOf,
};
