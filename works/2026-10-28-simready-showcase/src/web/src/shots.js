// One shot per asset plus the lineup: which assets stand where, how the camera moves, and how the wipe moves.
// Camera keys are orbit poses (azimuth from +z toward +x, degrees); the path is a Catmull-Rom spline through them.
import * as THREE from 'three';

export const WIDTH = 1920;
export const HEIGHT = 1080;
const BAND_HALF_WIDTH = 34;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const easeInOut = (value) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);
const lerp = (from, to, amount) => from + (to - from) * amount;

function buildCurves(keys, subjectHeight) {
  const positions = [];
  const targets = [];
  for (const key of keys) {
    const azimuth = THREE.MathUtils.degToRad(key.az);
    const elevation = THREE.MathUtils.degToRad(key.el);
    const target = new THREE.Vector3(key.tx ?? 0, key.ty * subjectHeight, 0);
    targets.push(target);
    positions.push(new THREE.Vector3(
      target.x + key.d * Math.sin(azimuth) * Math.cos(elevation),
      target.y + key.d * Math.sin(elevation),
      target.z + key.d * Math.cos(azimuth) * Math.cos(elevation),
    ));
  }
  return {
    position: new THREE.CatmullRomCurve3(positions, false, 'centripetal'),
    target: new THREE.CatmullRomCurve3(targets, false, 'centripetal'),
  };
}

/** Fields: azimuth/elevation in degrees, distance d, ty as a fraction of the subject height (1 for the lineup: world units). */
function makeRig(keys, spanSeconds) {
  const curveCache = new Map();
  const scratch = new THREE.Vector3();
  return (time, camera, subjectHeight = 1) => {
    if (!curveCache.has(subjectHeight)) curveCache.set(subjectHeight, buildCurves(keys, subjectHeight));
    const curves = curveCache.get(subjectHeight);
    const progress = clamp01(time / spanSeconds);
    curves.position.getPoint(progress, camera.position);
    curves.target.getPoint(progress, scratch);
    const distance = camera.position.distanceTo(scratch);
    // slight handheld drift
    camera.position.x += Math.sin(time * 1.3) * 0.008 * distance;
    camera.position.y += Math.sin(time * 1.0 + 1.0) * 0.006 * distance;
    camera.position.z += Math.sin(time * 1.1 + 2.0) * 0.008 * distance;
    scratch.y += Math.sin(time * 0.7 + 0.5) * 0.004 * distance;
    camera.lookAt(scratch);
  };
}

const lineWipe = (x, direction = [1, 0], y = HEIGHT / 2) => ({ mode: 'line', point: [x, y], direction, bandHalfWidth: BAND_HALF_WIDTH });

const TURBO_FACE_AZIMUTH = Number(new URLSearchParams(location.search).get('face') ?? 90);

export const SHOTS = {
  v8: {
    subject: 'v8',
    assets: { v8: { position: [0, 0, 0], scale: 1 } },
    camera: makeRig([
      { az: -62, el: 6, d: 6.2, ty: 0.5 },
      { az: -30, el: 9, d: 5.7, ty: 0.5 },
      { az: 4, el: 13, d: 5.2, ty: 0.5 },
      { az: 38, el: 16, d: 5.0, ty: 0.5 },
      { az: 62, el: 17, d: 5.1, ty: 0.5 },
    ], 8),
    wipe: ({ time }) => lineWipe(lerp(640, 1420, easeInOut((time - 0.2) / 4.6))),
  },
  turbo: {
    subject: 'turbo',
    assets: { turbo: { position: [0, 0, 0], scale: 1 } },
    // The camera swings round to the compressor inlet face (azimuth TURBO_FACE_AZIMUTH) and stays near it while the wheel spins.
    camera: makeRig([
      { az: TURBO_FACE_AZIMUTH + 60, el: 22, d: 5.2, ty: 0.5 },
      { az: TURBO_FACE_AZIMUTH + 22, el: 16, d: 4.6, ty: 0.5 },
      { az: TURBO_FACE_AZIMUTH + 4, el: 11, d: 4.3, ty: 0.5 },
      { az: TURBO_FACE_AZIMUTH - 10, el: 12, d: 4.4, ty: 0.5 },
      { az: TURBO_FACE_AZIMUTH - 22, el: 14, d: 4.6, ty: 0.5 },
    ], 7.5),
    wipe: ({ time, spinAge, project }) => {
      const centre = project('turbo', TURBO_FACE_AZIMUTH < 0 ? 'turbine_02_obj_00' : 'turbine_01_obj_00');
      const radius = spinAge < 0
        ? 140 + 40 * easeOut(time / 1.5)
        : 180 + easeOut(spinAge / 2) * 90 + Math.min(spinAge, 4) * 8;
      return { mode: 'radial', point: centre, radius, bandHalfWidth: BAND_HALF_WIDTH };
    },
  },
  fan: {
    subject: 'fan',
    assets: { fan: { position: [0, 0, 0], scale: 1 } },
    camera: makeRig([
      { az: 84, el: 2, d: 4.7, ty: 0.42 },
      { az: 72, el: 9, d: 4.9, ty: 0.47 },
      { az: 54, el: 20, d: 5.0, ty: 0.50 },
      { az: 36, el: 29, d: 5.0, ty: 0.53 },
      { az: 22, el: 33, d: 5.1, ty: 0.54 },
    ], 7),
    wipe: ({ time }) => lineWipe(1190 + Math.sin(time * 0.7 + 0.4) * 62, [-1, 0]),
  },
  vise: {
    subject: 'vise',
    assets: { vise: { position: [0, 0, 0], scale: 1 } },
    camera: makeRig([
      { az: 40, el: 27, d: 4.9, ty: 0.5, tx: 0.05 },
      { az: 24, el: 29, d: 4.7, ty: 0.5, tx: 0.05 },
      { az: 10, el: 31, d: 4.6, ty: 0.5, tx: 0.05 },
      { az: -4, el: 31, d: 4.7, ty: 0.5, tx: 0.05 },
      { az: -14, el: 30, d: 4.8, ty: 0.5, tx: 0.05 },
    ], 7),
    wipe: ({ pointer }) => lineWipe(pointer.smoothedX),
  },
  extinguisher: {
    subject: 'extinguisher',
    assets: { extinguisher: { position: [0, 0, 0], scale: 1 } },
    camera: makeRig([
      { az: 16, el: 9, d: 5.0, ty: 0.5 },
      { az: 6, el: 14, d: 4.7, ty: 0.5 },
      { az: -6, el: 19, d: 4.5, ty: 0.5 },
      { az: -16, el: 22, d: 4.5, ty: 0.5 },
    ], 6),
    wipe: ({ time }) => lineWipe(1165 + Math.sin(time * 0.9) * 55 + Math.sin(time * 2.3) * 12),
  },
  lineup: {
    // Two deep in a shallow arc: three in front, two behind, all fitted to similar heights.
    assets: {
      v8: { position: [-1.85, 0, 0.7], fitHeight: 1.0 },
      turbo: { position: [-0.85, 0, -1.2], fitHeight: 1.05 },
      fan: { position: [0.1, 0, 0.9], fitHeight: 1.5 },
      extinguisher: { position: [1.0, 0, -1.2], fitHeight: 1.25 },
      vise: { position: [1.8, 0, 0.7], fitHeight: 0.78 },
    },
    camera: makeRig([
      { az: -9, el: 13, d: 8.0, tx: -0.1, ty: 0.7 },
      { az: -4, el: 14, d: 7.9, tx: -0.1, ty: 0.7 },
      { az: 2, el: 14, d: 7.8, tx: -0.1, ty: 0.7 },
      { az: 6, el: 13.5, d: 7.8, tx: -0.1, ty: 0.7 },
      { az: 9, el: 13, d: 7.9, tx: -0.1, ty: 0.7 },
    ], 6),
    wipe: ({ time }) => {
      const direction = [1, 0.55];
      const length = Math.hypot(direction[0], direction[1]);
      const offset = lerp(-700, 240, easeOut(time / 3.2)) + Math.max(0, time - 3.2) * 14;
      const centre = [1160, HEIGHT / 2];
      return {
        mode: 'line',
        point: [centre[0] + (direction[0] / length) * offset, centre[1] + (direction[1] / length) * offset],
        direction,
        bandHalfWidth: 24,
      };
    },
  },
};
