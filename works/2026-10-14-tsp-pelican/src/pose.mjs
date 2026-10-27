// Moves the rest-pose stipple points into a pedalling pose. Every point belongs to one part
// (its label) and gets that part's rigid motion: wheels and chainring turn, pedals translate,
// leg bones follow the two-bone IK from pelican.mjs.
import { BIKE, GEAR_RATIO, LEG, PART, legJoints, pedalPosition } from "./pelican.mjs";

export const FPS = 30;
const SPIN_UP_SECONDS = 1.5;
const CRANK_TURNS_PER_SECOND = 1 / 3;

// Crank angle after `seconds` of riding: eases from rest up to a steady cadence of 20 rpm.
export function crankAngleAt(seconds) {
  const cruiseTime = Math.max(0, seconds - SPIN_UP_SECONDS);
  const spinUpTime = Math.min(seconds, SPIN_UP_SECONDS);
  // Speed ramps linearly over the spin-up, so turns there are the integral of a ramp.
  const spinUpTurns = (CRANK_TURNS_PER_SECOND * spinUpTime * spinUpTime) / (2 * SPIN_UP_SECONDS);
  const turns = spinUpTurns + CRANK_TURNS_PER_SECOND * cruiseTime;
  return LEG.restCrankAngle + turns * Math.PI * 2;
}

function rigidMotion(fromPivot, toPivot, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return (x, y) => {
    const offsetX = x - fromPivot.x;
    const offsetY = y - fromPivot.y;
    return [toPivot.x + cosine * offsetX - sine * offsetY, toPivot.y + sine * offsetX + cosine * offsetY];
  };
}

const angleOf = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
const translation = (from, to) => rigidMotion(from, to, 0);

function legMotions(restAngle, angle) {
  const rest = legJoints(restAngle);
  const now = legJoints(angle);
  return {
    thigh: rigidMotion(rest.hip, now.hip, angleOf(now.hip, now.knee) - angleOf(rest.hip, rest.knee)),
    shin: rigidMotion(rest.knee, now.knee, angleOf(now.knee, now.ankle) - angleOf(rest.knee, rest.ankle)),
    foot: translation(rest.ankle, now.ankle),
  };
}

export function partMotions(crankAngle) {
  const turn = crankAngle - LEG.restCrankAngle;
  const near = legMotions(LEG.restCrankAngle, crankAngle);
  const far = legMotions(LEG.restCrankAngle + Math.PI, crankAngle + Math.PI);
  const motions = [];
  motions[PART.rearWheel] = rigidMotion(BIKE.rearHub, BIKE.rearHub, turn * GEAR_RATIO);
  motions[PART.frontWheel] = rigidMotion(BIKE.frontHub, BIKE.frontHub, turn * GEAR_RATIO);
  motions[PART.crank] = rigidMotion(BIKE.bottomBracket, BIKE.bottomBracket, turn);
  motions[PART.nearPedal] = translation(pedalPosition(LEG.restCrankAngle), pedalPosition(crankAngle));
  motions[PART.farPedal] = translation(pedalPosition(LEG.restCrankAngle + Math.PI), pedalPosition(crankAngle + Math.PI));
  motions[PART.nearThigh] = near.thigh;
  motions[PART.nearShin] = near.shin;
  motions[PART.nearFoot] = near.foot;
  motions[PART.farThigh] = far.thigh;
  motions[PART.farShin] = far.shin;
  motions[PART.farFoot] = far.foot;
  return motions;
}

export function posePoints(restPoints, labels, crankAngle) {
  const motions = partMotions(crankAngle);
  const posed = new Float32Array(restPoints.length);
  for (let index = 0; index < labels.length; index += 1) {
    const motion = motions[labels[index]];
    const x = restPoints[2 * index];
    const y = restPoints[2 * index + 1];
    if (motion) {
      const [newX, newY] = motion(x, y);
      posed[2 * index] = newX;
      posed[2 * index + 1] = newY;
    } else {
      posed[2 * index] = x;
      posed[2 * index + 1] = y;
    }
  }
  return posed;
}
