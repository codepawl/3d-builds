// Motion that reads as physical without a physics engine: damped springs for keys, levers, returns and
// the exploded view; inertia for anything that spins up and coasts down; kinematic joints solved from the
// model (revolute, prismatic, gear mesh, crank-slider, four-bar). Pure functions, no DOM: the build, the
// page, the film and the tests all use this one file. World vectors are [x, y, z].

const LONGEST_SPRING_STEP = 1 / 240;

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function smoothstep(from, to, value) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

export function easeOutCubic(share) {
  const left = 1 - clamp(share, 0, 1);
  return 1 - left * left * left;
}

// ---- springs -------------------------------------------------------------------------------------------

// A spring with unit mass. `stiffness` and `damping` are per second squared and per second.
export function createSpring({ stiffness, damping, value = 0, target = value }) {
  return { stiffness, damping, value, velocity: 0, target, settled: value === target };
}

// Stiffness and damping for a spring that settles in about `settleSeconds` with the given damping ratio.
// A ratio of 1 is critical: the fastest return that never passes the target.
export function springFor(settleSeconds, dampingRatio = 1) {
  const naturalFrequency = 6.6 / (settleSeconds * Math.max(0.3, dampingRatio));
  return { stiffness: naturalFrequency * naturalFrequency, damping: 2 * dampingRatio * naturalFrequency };
}

export function dampingRatioOf(spring) {
  return spring.damping / (2 * Math.sqrt(spring.stiffness));
}

// The largest share of a step the spring can pass its target by, from its damping ratio.
export function overshootBound(spring) {
  const ratio = dampingRatioOf(spring);
  if (ratio >= 1) return 0;
  return Math.exp((-Math.PI * ratio) / Math.sqrt(1 - ratio * ratio));
}

export function setSpringTarget(spring, target) {
  if (spring.target === target) return;
  spring.target = target;
  spring.settled = false;
}

// Semi-implicit Euler in short pieces, so a long jump of the clock cannot shake the spring loose.
// A spring held to the rate its actuator can give (a thruster, a fin, a motor): the value never moves
// faster than `maxRate` per second, so a turn has a cause that limits it. Returns the value.
export function stepRateLimited(spring, seconds, maxRate) {
  const before = spring.value;
  stepSpring(spring, seconds);
  const limit = maxRate * seconds;
  const wanted = spring.value - before;
  const change = Math.max(-limit, Math.min(limit, wanted));
  if (change !== wanted && seconds > 0) {
    spring.value = before + change;
    spring.velocity = change / seconds;
    spring.settled = false;
  }
  return spring.value;
}

export function stepSpring(spring, seconds) {
  if (spring.settled) return spring.value;
  const pieces = Math.max(1, Math.ceil(seconds / LONGEST_SPRING_STEP));
  const piece = seconds / pieces;
  for (let index = 0; index < pieces; index++) {
    const pull = spring.stiffness * (spring.target - spring.value) - spring.damping * spring.velocity;
    spring.velocity += pull * piece;
    spring.value += spring.velocity * piece;
  }
  if (Math.abs(spring.value - spring.target) < 0.0005 && Math.abs(spring.velocity) < 0.004) {
    spring.value = spring.target;
    spring.velocity = 0;
    spring.settled = true;
  }
  return spring.value;
}

// ---- inertia -------------------------------------------------------------------------------------------

// Something that spins: it spins up towards its driven speed and coasts down when the drive stops, each
// as a first-order lag with its own time constant. Speeds are in turns per second, the angle in turns.
export function createInertia({ spinUpSeconds, coastSeconds = spinUpSeconds, speed = 0, angle = 0 }) {
  return { spinUpSeconds, coastSeconds, speed, angle };
}

// Exact for a constant drive over the step, so the result does not depend on the frame rate.
export function stepInertia(inertia, drivenSpeed, seconds) {
  const speedingUp = Math.abs(drivenSpeed) > Math.abs(inertia.speed);
  const timeConstant = speedingUp ? inertia.spinUpSeconds : inertia.coastSeconds;
  const decay = Math.exp(-seconds / timeConstant);
  const startSpeed = inertia.speed;
  const endSpeed = drivenSpeed + (startSpeed - drivenSpeed) * decay;
  inertia.angle += drivenSpeed * seconds + (startSpeed - drivenSpeed) * timeConstant * (1 - decay);
  inertia.speed = endSpeed;
  return inertia.angle;
}

// ---- joints --------------------------------------------------------------------------------------------

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function unitVector(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return scale(vector, 1 / length);
}

export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// A hinge: `point` turned by `angle` radians about the line through `pivot` along `axis` (Rodrigues).
export function revolute(pivot, axis, angle, point) {
  const direction = unitVector(axis);
  const offset = subtract(point, pivot);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const along = scale(direction, dot(direction, offset) * (1 - cosine));
  const turned = add(add(scale(offset, cosine), scale(cross(direction, offset), sine)), along);
  return add(pivot, turned);
}

// A slide: the point `travel` units along `axis` from `origin`.
export function prismatic(origin, axis, travel) {
  return add(origin, scale(unitVector(axis), travel));
}

// Two meshed spur gears. The driven gear turns the other way, slower by the tooth ratio. `phase` is the
// driven gear's angle at a driver angle of zero, chosen so a tooth sits in a gap (see meshPhase).
export function gearMesh({ driverTeeth, drivenTeeth, driverAngle, phase = 0 }) {
  const ratio = driverTeeth / drivenTeeth;
  return { drivenAngle: -driverAngle * ratio + phase, ratio };
}

// The phase that puts a tooth of the driven gear in a gap of the driver on the line of centres. Angles
// are measured from that line, with tooth 0 of each gear centred on it at angle zero.
export function meshPhase(drivenTeeth) {
  return Math.PI + Math.PI / drivenTeeth;
}

// A crank turning in the xz plane about `centre`, a rod of `rodLength` to a slider on the line through
// the centre along x. Returns the crank pin, the slider pin and the rod's angle.
export function crankSlider({ centre = [0, 0, 0], crankRadius, rodLength, crankAngle }) {
  if (rodLength <= crankRadius) throw new Error("crankSlider: the rod must be longer than the crank");
  const pin = [centre[0] + crankRadius * Math.cos(crankAngle), centre[1], centre[2] + crankRadius * Math.sin(crankAngle)];
  const rise = pin[2] - centre[2];
  const reach = Math.sqrt(rodLength * rodLength - rise * rise);
  const slider = [pin[0] + reach, centre[1], centre[2]];
  return { pin, slider, rodAngle: Math.atan2(-rise, reach) };
}

// The two points where circles (centre, radius) in a plane meet; `branch` picks one (1 or -1).
function circleMeet(firstCentre, firstRadius, secondCentre, secondRadius, branch) {
  const gap = Math.hypot(secondCentre[0] - firstCentre[0], secondCentre[1] - firstCentre[1]);
  if (gap > firstRadius + secondRadius + 1e-9 || gap < Math.abs(firstRadius - secondRadius) - 1e-9 || gap === 0) return null;
  const along = (firstRadius * firstRadius - secondRadius * secondRadius + gap * gap) / (2 * gap);
  const across = Math.sqrt(Math.max(0, firstRadius * firstRadius - along * along));
  const unitX = (secondCentre[0] - firstCentre[0]) / gap;
  const unitY = (secondCentre[1] - firstCentre[1]) / gap;
  const footX = firstCentre[0] + along * unitX;
  const footY = firstCentre[1] + along * unitY;
  return [footX - branch * across * unitY, footY + branch * across * unitX];
}

// A planar four-bar in (x, z): ground pivots A at the origin and D at `ground` along x, the crank AB of
// length `crank` at `crankAngle`, the coupler BC and the rocker DC. Returns null where it cannot assemble.
export function fourBar({ ground, crank, coupler, rocker, crankAngle, branch = 1 }) {
  const pivotA = [0, 0];
  const pivotD = [ground, 0];
  const pointB = [crank * Math.cos(crankAngle), crank * Math.sin(crankAngle)];
  const pointC = circleMeet(pointB, coupler, pivotD, rocker, branch);
  if (!pointC) return null;
  const rockerAngle = Math.atan2(pointC[1] - pivotD[1], pointC[0] - pivotD[0]);
  const toWorld = (point) => [point[0], 0, point[1]];
  return { a: toWorld(pivotA), b: toWorld(pointB), c: toWorld(pointC), d: toWorld(pivotD), rockerAngle };
}

export const MotionApi = {
  clamp,
  smoothstep,
  easeOutCubic,
  createSpring,
  springFor,
  dampingRatioOf,
  overshootBound,
  setSpringTarget,
  stepSpring,
  stepRateLimited,
  createInertia,
  stepInertia,
  unitVector,
  distance,
  revolute,
  prismatic,
  gearMesh,
  meshPhase,
  crankSlider,
  fourBar,
};
