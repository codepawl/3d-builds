// Pure model of a Boulton & Watt double-acting rotative beam engine of the 1780s. One number, the crank
// angle, sets every part: the planet gear's place round the sun, the connecting rod, the beam, Watt's
// parallel motion, the piston, the air pump bucket, the plug rod and the four valves. A second, small
// model turns it: steam torque through the throttle, a load, the flywheel's inertia and the centrifugal
// governor that moves the throttle. No DOM in here; the build, the page, the tests and the film read it.
//
// The engine is drawn in one plane: x runs along the beam from the cylinder (negative) to the flywheel,
// z is up. Angles are measured anticlockwise from +x, as seen from the front.

const TAU = Math.PI * 2;
const DEGREE = Math.PI / 180;
const SAMPLES = 1440;

const GEOMETRY = {
  beamPivot: [0, 220],
  beamHalf: 100,
  // Watt's parallel motion: the main link hangs from the beam end, the back link from half-way along
  // the beam, and the radius rod ties the back link's lower end to a fixed point on the frame.
  motionInner: 50,
  motionLink: 26,
  radiusRod: 50,
  // The anchor stands a little inside the beam end, in the middle of the arc the end swings through.
  radiusAnchor: [-97, 194],
  // Sun and planet: the sun gear is on the flywheel shaft, the planet gear is fixed to the connecting rod.
  shaft: [100, 70],
  sunRadius: 15,
  planetRadius: 15,
  teeth: 20,
  connectingRod: 150,
  pistonRod: 75,
  pumpRod: 173,
  plugAt: 56,
};

// How wide, in crank angle, the valves take to change over at each end of the stroke.
const CHANGEOVER = 0.26;

const GOVERNOR = {
  arm: 24,
  link: 12,
  restAngle: 22 * DEGREE,
  topAngle: 62 * DEGREE,
  // The share of the nominal speed at which the balls leave their stops.
  liftSpeed: 0.8,
  openAngle: 30 * DEGREE,
  shutAngle: 56 * DEGREE,
  leastOpening: 0.03,
  // Turns of the governor spindle for one turn of the flywheel (the two belt pulleys).
  ratio: 1.5,
};

const ENGINE = {
  // Crank speed at "speed 1", in radians a second: 0.55 double strokes a second.
  nominal: TAU * 0.55,
  inertia: 7,
  steamTorque: 1,
  loadTorque: 0.7,
  drag: 0.15,
  ballLag: 0.35,
  longestStep: 1 / 240,
  gearTicksPerTurn: 4,
};

const STEPS = [
  { label: "Steam enters the cylinder", from: 0.02 },
  { label: "Piston is pushed", from: 0.14 },
  { label: "Beam rocks", from: 0.28 },
  { label: "Sun-and-planet gear turns the flywheel", from: 0.44 },
  { label: "Used steam goes to the condenser", from: 0.6 },
  { label: "Governor trims the speed", from: 0.78 },
];

const TRACE = ["steam pushes piston", "beam rocks", "gear turns flywheel", "governor trims the steam"];

function smooth(from, to, value) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

function clamp(value, least, most) {
  return Math.min(most, Math.max(least, value));
}

function wrapTurn(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

// The same angle between -half a turn and +half a turn.
function wrapSigned(angle) {
  const turned = wrapTurn(angle);
  return turned > Math.PI ? turned - TAU : turned;
}

// The two points that lie `radiusA` from `centreA` and `radiusB` from `centreB`.
function circleMeet(centreA, radiusA, centreB, radiusB) {
  const across = [centreB[0] - centreA[0], centreB[1] - centreA[1]];
  const distance = Math.hypot(across[0], across[1]);
  const along = (radiusA * radiusA - radiusB * radiusB + distance * distance) / (2 * distance);
  const off = Math.sqrt(Math.max(0, radiusA * radiusA - along * along));
  const foot = [centreA[0] + (across[0] * along) / distance, centreA[1] + (across[1] * along) / distance];
  const side = [(-across[1] * off) / distance, (across[0] * off) / distance];
  return [
    [foot[0] + side[0], foot[1] + side[1]],
    [foot[0] - side[0], foot[1] - side[1]],
  ];
}

function rightmost(points) {
  return points[0][0] >= points[1][0] ? points[0] : points[1];
}

// Where the planet gear's centre is for this crank angle: it is held at a fixed distance from the shaft.
function planetCentre(crank, geometry) {
  const reach = geometry.sunRadius + geometry.planetRadius;
  return [geometry.shaft[0] + reach * Math.cos(crank), geometry.shaft[1] + reach * Math.sin(crank)];
}

// The beam end over the flywheel is one connecting rod away from the planet gear and one half-beam
// away from the pivot. Positive beam angle: the flywheel end is up.
function beamEndAt(crank, geometry) {
  const planet = planetCentre(crank, geometry);
  return rightmost(circleMeet(geometry.beamPivot, geometry.beamHalf, planet, geometry.connectingRod));
}

// Watt's parallel motion for one beam angle. `inner` (B) and `end` (C) are on the beam; `back` (E) hangs
// from B on the back link and is held by the radius rod; `rodTop` (D) completes the parallelogram and
// carries the piston rod; `pumpTop` (F) is the middle of the back link and carries the air pump rod.
function linkageAt(beamAngle, geometry) {
  const pivot = geometry.beamPivot;
  const direction = [-Math.cos(beamAngle), -Math.sin(beamAngle)];
  const inner = [pivot[0] + direction[0] * geometry.motionInner, pivot[1] + direction[1] * geometry.motionInner];
  const end = [pivot[0] + direction[0] * geometry.beamHalf, pivot[1] + direction[1] * geometry.beamHalf];
  const back = rightmost(circleMeet(inner, geometry.motionLink, geometry.radiusAnchor, geometry.radiusRod));
  const rodTop = [end[0] + back[0] - inner[0], end[1] + back[1] - inner[1]];
  const pumpTop = [(inner[0] + back[0]) / 2, (inner[1] + back[1]) / 2];
  return { inner, end, back, rodTop, pumpTop };
}

// The planet gear cannot turn on the rod, so it rolls round the sun and turns it. For a carrier angle
// `crank` and a planet (rod) angle `rodAngle`, rolling without slip gives the sun's angle. With equal
// gears the sun turns twice for every turn of the crank.
function sunAngleAt(crank, rodAngle, geometry) {
  const ratio = geometry.planetRadius / geometry.sunRadius;
  return crank * (1 + ratio) - (rodAngle - Math.PI / 2) * ratio + Math.PI / geometry.teeth;
}

// Every moving point of the engine for one crank angle, without the valves.
function linksAt(crank, geometry = GEOMETRY) {
  const planet = planetCentre(crank, geometry);
  const beamEnd = beamEndAt(crank, geometry);
  const beamAngle = Math.atan2(beamEnd[1] - geometry.beamPivot[1], beamEnd[0] - geometry.beamPivot[0]);
  const motion = linkageAt(beamAngle, geometry);
  const rodAngle = Math.atan2(beamEnd[1] - planet[1], beamEnd[0] - planet[0]);
  return {
    crank,
    planet,
    beamEnd,
    beamAngle,
    rodAngle,
    sunAngle: sunAngleAt(crank, rodAngle, geometry),
    ...motion,
    pistonZ: motion.rodTop[1] - geometry.pistonRod,
    pumpZ: motion.pumpTop[1] - geometry.pumpRod,
    plugDrop: geometry.plugAt * Math.sin(beamAngle),
  };
}

// One turn of the crank, sampled: where the piston turns round, how far it travels and how far the
// piston rod's top strays from a straight vertical line.
function measureCycle(geometry = GEOMETRY) {
  const heights = [];
  let high = 0;
  let low = 0;
  let leftmost = Infinity;
  let rightmostX = -Infinity;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const links = linksAt((sample / SAMPLES) * TAU, geometry);
    heights.push(links.pistonZ);
    if (links.pistonZ > heights[high]) high = sample;
    if (links.pistonZ < heights[low]) low = sample;
    leftmost = Math.min(leftmost, links.rodTop[0]);
    rightmostX = Math.max(rightmostX, links.rodTop[0]);
  }
  const travelPerRadian = [];
  let meanTravel = 0;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const before = heights[(sample + SAMPLES - 1) % SAMPLES];
    const after = heights[(sample + 1) % SAMPLES];
    const slope = Math.abs(after - before) / ((2 * TAU) / SAMPLES);
    travelPerRadian.push(slope);
    meanTravel += slope / SAMPLES;
  }
  return {
    top: (high / SAMPLES) * TAU,
    bottom: (low / SAMPLES) * TAU,
    pistonHigh: heights[high],
    pistonLow: heights[low],
    stroke: heights[high] - heights[low],
    rodStray: rightmostX - leftmost,
    rodLine: (rightmostX + leftmost) / 2,
    travelPerRadian,
    meanTravel,
  };
}

const CYCLE = measureCycle(GEOMETRY);

// Which stroke the piston is on and how far through it, by crank angle.
function strokeAt(crank) {
  const sinceTop = wrapTurn(crank - CYCLE.top);
  const downSpan = wrapTurn(CYCLE.bottom - CYCLE.top);
  if (sinceTop < downSpan) return { direction: "down", share: sinceTop / downSpan };
  return { direction: "up", share: (sinceTop - downSpan) / (TAU - downSpan) };
}

// 1 while the engine is set for the down stroke, 0 for the up stroke, easing across each dead centre.
function downSetting(crank) {
  const fromTop = wrapSigned(crank - CYCLE.top);
  const fromBottom = wrapSigned(crank - CYCLE.bottom);
  if (Math.abs(fromTop) < Math.abs(fromBottom)) return smooth(-CHANGEOVER / 2, CHANGEOVER / 2, fromTop);
  return 1 - smooth(-CHANGEOVER / 2, CHANGEOVER / 2, fromBottom);
}

// The four valves, each from 0 (shut) to 1 (open). On the down stroke steam is let in above the piston
// and the space below is open to the condenser; on the up stroke it is the other way round. At each
// changeover the exhaust valve of an end shuts before its steam valve opens, so steam never blows
// straight through to the condenser.
function valvesAt(crank) {
  const down = downSetting(crank);
  return {
    topSteam: smooth(0.5, 1, down),
    topExhaust: 1 - smooth(0, 0.5, down),
    bottomSteam: 1 - smooth(0, 0.5, down),
    bottomExhaust: smooth(0.5, 1, down),
  };
}

function poseAt(crank, geometry = GEOMETRY) {
  return { ...linksAt(crank, geometry), valves: valvesAt(crank), stroke: strokeAt(crank) };
}

// How much the piston moves per radian of crank here, against the average: the pulse of the torque.
function torquePulse(crank) {
  const place = (wrapTurn(crank) / TAU) * SAMPLES;
  const first = Math.floor(place) % SAMPLES;
  const share = place - Math.floor(place);
  const slope = CYCLE.travelPerRadian[first] * (1 - share) + CYCLE.travelPerRadian[(first + 1) % SAMPLES] * share;
  return slope / CYCLE.meanTravel;
}

// ---- governor ------------------------------------------------------------------------------------------

// A conical pendulum: the balls hang at the angle where their weight balances the pull outwards, so the
// cosine of the angle falls with the square of the speed. Below the lift speed they rest on their stops.
function ballAngleFor(speed) {
  if (speed <= GOVERNOR.liftSpeed) return GOVERNOR.restAngle;
  const cosine = Math.cos(GOVERNOR.restAngle) * (GOVERNOR.liftSpeed / speed) ** 2;
  return Math.min(GOVERNOR.topAngle, Math.acos(cosine));
}

// How far below the top pivot the balls hang, and how far the sleeve has risen from its rest.
function ballDrop(ballAngle) {
  return GOVERNOR.arm * Math.cos(ballAngle);
}

function sleeveRise(ballAngle) {
  return 2 * GOVERNOR.link * (Math.cos(GOVERNOR.restAngle) - Math.cos(ballAngle));
}

// The sleeve works the throttle: wide open until the balls pass the open angle, nearly shut at the shut angle.
function throttleFor(ballAngle) {
  const closed = (ballAngle - GOVERNOR.openAngle) / (GOVERNOR.shutAngle - GOVERNOR.openAngle);
  return clamp(1 - closed, GOVERNOR.leastOpening, 1);
}

// ---- running -------------------------------------------------------------------------------------------

// A beam engine cannot start from a dead centre, so it is barred over: the model starts it part-way
// down a stroke, already turning slowly.
function createEngine(load = 0.5) {
  return { crank: CYCLE.top + 0.7, speed: 0.4, ballAngle: GOVERNOR.restAngle, load, strokes: 0, time: 0 };
}

function advanceOnce(engine, seconds, events) {
  const throttle = throttleFor(engine.ballAngle);
  const steam = ENGINE.steamTorque * throttle * torquePulse(engine.crank);
  const torque = steam - ENGINE.loadTorque * engine.load - ENGINE.drag * engine.speed;
  const before = strokeAt(engine.crank).direction;
  const tickBefore = Math.floor((linksAt(engine.crank).sunAngle / TAU) * ENGINE.gearTicksPerTurn);
  engine.speed = Math.max(0, engine.speed + (torque / ENGINE.inertia) * seconds);
  engine.crank += engine.speed * ENGINE.nominal * seconds;
  engine.ballAngle += ((ballAngleFor(engine.speed) - engine.ballAngle) * seconds) / ENGINE.ballLag;
  engine.time += seconds;
  const stroke = strokeAt(engine.crank);
  if (stroke.direction !== before) {
    engine.strokes += 1;
    events.push({ name: "changeover", direction: stroke.direction, speed: engine.speed, at: engine.time });
  }
  const tickAfter = Math.floor((linksAt(engine.crank).sunAngle / TAU) * ENGINE.gearTicksPerTurn);
  if (tickAfter !== tickBefore) events.push({ name: "gear", speed: engine.speed, at: engine.time });
}

// Advances the engine by `seconds` in short steps and returns what happened: valve changeovers and gear ticks.
function stepEngine(engine, seconds) {
  const events = [];
  const steps = Math.max(1, Math.ceil(seconds / ENGINE.longestStep));
  for (let step = 0; step < steps; step++) advanceOnce(engine, seconds / steps, events);
  return events;
}

// Runs the engine until its speed has settled for its load, then parks the count and the clock at zero.
function settleEngine(engine, seconds = 40) {
  stepEngine(engine, seconds);
  // Stop exactly at the top of a stroke, so a reader starts on a clean down stroke.
  for (let guard = 0; guard < 4000 && strokeAt(engine.crank).direction !== "up"; guard++) stepEngine(engine, 1 / 240);
  for (let guard = 0; guard < 4000 && strokeAt(engine.crank).direction !== "down"; guard++) stepEngine(engine, 1 / 240);
  engine.strokes = 0;
  engine.time = 0;
  return engine;
}

function flywheelTurnsPerMinute(engine) {
  const ratio = 1 + GEOMETRY.planetRadius / GEOMETRY.sunRadius;
  return ((engine.speed * ENGINE.nominal * ratio) / TAU) * 60;
}

function governorState(engine) {
  return {
    ballAngle: engine.ballAngle,
    ballDrop: ballDrop(engine.ballAngle),
    sleeveRise: sleeveRise(engine.ballAngle),
    throttle: throttleFor(engine.ballAngle),
    flywheelTurns: flywheelTurnsPerMinute(engine),
  };
}

// How brightly each of the six film steps shows, for a share of one stroke.
function stepsAt(share) {
  return STEPS.map((step) => smooth(step.from, step.from + 0.05, share));
}

// A wave that runs along the four words under the figure once per stroke.
function traceAt(share) {
  return TRACE.map((_, index) => {
    const start = index * 0.2;
    return smooth(start - 0.04, start + 0.06, share) * (1 - smooth(start + 0.3, start + 0.42, share));
  });
}

export const EngineApi = {
  TAU,
  DEGREE,
  GEOMETRY,
  GOVERNOR,
  ENGINE,
  CYCLE,
  CHANGEOVER,
  STEPS,
  TRACE,
  smooth,
  clamp,
  wrapTurn,
  circleMeet,
  planetCentre,
  linkageAt,
  sunAngleAt,
  linksAt,
  measureCycle,
  strokeAt,
  valvesAt,
  poseAt,
  torquePulse,
  ballAngleFor,
  ballDrop,
  sleeveRise,
  throttleFor,
  createEngine,
  stepEngine,
  settleEngine,
  flywheelTurnsPerMinute,
  governorState,
  stepsAt,
  traceAt,
};
