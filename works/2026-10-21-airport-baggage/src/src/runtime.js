import * as THREE from 'three';
import { getState, setState } from './store.js';
import { SITES, siteOfPosition } from './model.js';
import { sim } from './appContext.js';

// The plant is created once the models have loaded; actions read positions from it.
export const plantRef = { current: null };

export const rig = {
  target: new THREE.Vector3(11, 0.6, 14),
  azimuth: 0.42,
  elevation: 0.72,
  distance: 33,
  goal: { target: new THREE.Vector3(11, 0.6, 14), azimuth: 0.42, elevation: 0.72, distance: 33 },
  fly: null,
  getFollowPosition: null,
  orbitRate: 0,
  minimumFollowDistance: 4.5,
};

const MIN_DISTANCE = 5;
const MAX_DISTANCE = 120;

function viewToGoal(view) {
  return {
    target: new THREE.Vector3(view.target[0], view.target[1], view.target[2]),
    azimuth: view.azimuth,
    elevation: view.elevation,
    distance: view.distance,
  };
}

export function snapToView(view) {
  const goal = viewToGoal(view);
  rig.target.copy(goal.target);
  rig.azimuth = goal.azimuth;
  rig.elevation = goal.elevation;
  rig.distance = goal.distance;
  rig.goal.target.copy(goal.target);
  rig.goal.azimuth = goal.azimuth;
  rig.goal.elevation = goal.elevation;
  rig.goal.distance = goal.distance;
  rig.fly = null;
}

// Fly the camera to a view over a number of seconds; the end target may follow a moving object.
export function flyTo(view, seconds = 1.6, getEndTarget = null) {
  const to = viewToGoal(view);
  rig.fly = {
    from: { target: rig.target.clone(), azimuth: rig.azimuth, elevation: rig.elevation, distance: rig.distance },
    to,
    elapsed: 0,
    seconds,
    getEndTarget,
  };
}

function easeInOut(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

export function updateRig(deltaSeconds) {
  const dt = Math.min(deltaSeconds, 0.1);
  if (rig.fly) {
    const fly = rig.fly;
    fly.elapsed += dt;
    const fraction = easeInOut(Math.min(1, fly.elapsed / fly.seconds));
    const endTarget = fly.getEndTarget ? fly.getEndTarget() : null;
    if (endTarget) fly.to.target.copy(endTarget);
    rig.target.lerpVectors(fly.from.target, fly.to.target, fraction);
    let azimuthDifference = fly.to.azimuth - fly.from.azimuth;
    rig.azimuth = fly.from.azimuth + azimuthDifference * fraction;
    rig.elevation = fly.from.elevation + (fly.to.elevation - fly.from.elevation) * fraction;
    rig.distance = Math.exp(Math.log(fly.from.distance) + (Math.log(fly.to.distance) - Math.log(fly.from.distance)) * fraction);
    rig.goal.target.copy(rig.target);
    rig.goal.azimuth = rig.azimuth;
    rig.goal.elevation = rig.elevation;
    rig.goal.distance = rig.distance;
    if (fly.elapsed >= fly.seconds) {
      rig.fly = null;
    }
    return;
  }
  if (rig.getFollowPosition) {
    const position = rig.getFollowPosition();
    if (position) {
      rig.goal.target.lerp(position, 1 - Math.exp(-dt * 7));
    }
  }
  rig.goal.azimuth += rig.orbitRate * dt;
  const blend = 1 - Math.exp(-dt * 10);
  rig.target.lerp(rig.goal.target, rig.getFollowPosition ? 1 - Math.exp(-dt * 18) : blend);
  rig.azimuth += (rig.goal.azimuth - rig.azimuth) * blend;
  rig.elevation += (rig.goal.elevation - rig.elevation) * blend;
  rig.distance += (rig.goal.distance - rig.distance) * blend;
}

export function applyRigToCamera(camera) {
  const horizontal = Math.cos(rig.elevation);
  camera.position.set(
    rig.target.x + rig.distance * Math.sin(rig.azimuth) * horizontal,
    rig.target.y + rig.distance * Math.sin(rig.elevation),
    rig.target.z + rig.distance * Math.cos(rig.azimuth) * horizontal,
  );
  camera.lookAt(rig.target);
}

export function dragOrbit(deltaX, deltaY) {
  if (rig.fly) return;
  clearStageMarker();
  rig.goal.azimuth = Math.min(1.5, Math.max(-1.1, rig.goal.azimuth - deltaX * 0.006));
  rig.goal.elevation = Math.min(1.25, Math.max(rig.getFollowPosition ? 0.5 : 0.28, rig.goal.elevation + deltaY * 0.005));
}

export function dragPan(deltaX, deltaY) {
  if (rig.fly || rig.getFollowPosition) return;
  clearStageMarker();
  const scale = rig.distance * 0.0016;
  const rightX = Math.cos(rig.azimuth);
  const rightZ = -Math.sin(rig.azimuth);
  const forwardX = -Math.sin(rig.azimuth);
  const forwardZ = -Math.cos(rig.azimuth);
  rig.goal.target.x += (-deltaX * rightX + deltaY * forwardX) * scale;
  rig.goal.target.z += (-deltaX * rightZ + deltaY * forwardZ) * scale;
}

export function zoomBy(factor) {
  if (rig.fly) return;
  clearStageMarker();
  const minimum = rig.getFollowPosition ? rig.minimumFollowDistance : MIN_DISTANCE;
  rig.goal.distance = Math.min(MAX_DISTANCE, Math.max(minimum, rig.goal.distance * factor));
}

// The stage bar marks the stage the camera last went to; any other camera move clears it.
function clearStageMarker() {
  if (getState().stageIndex !== -1) setState({ stageIndex: -1 });
}

// ---- Actions used by the 3D view and the dashboard -----------------------------------------

export function positionOfSelection(selection) {
  const plant = plantRef.current;
  if (!plant || !selection) return null;
  if (selection.kind === 'bag') {
    const position = plant.positionOfBag(selection.planId);
    return position ? position.clone() : null;
  }
  const bounds = plant.boundsOfUnit(selection.unitId);
  return bounds ? bounds.centre : null;
}

export function clearSelection() {
  rig.getFollowPosition = null;
  setState({ selection: null, following: false });
}

// Camera distance in metres for each Follow setting.
export const FOLLOW_DISTANCES = { close: 6, mid: 13, wide: 26 };

function followPositionOf(selection) {
  return () => {
    const position = positionOfSelection(selection);
    if (position && selection.kind === 'bag') position.y += 0.4;
    return position;
  };
}

// Keeps the camera on the selected bag or unit at one of the three distances.
export function startFollow(distanceName = getState().followDistance, { fly = true, seconds = 1.2 } = {}) {
  const selection = getState().selection;
  if (!selection) return;
  clearStageMarker();
  let distance = FOLLOW_DISTANCES[distanceName] ?? FOLLOW_DISTANCES.mid;
  if (selection.kind === 'unit') {
    // Never closer than the unit's own size, so the camera stays outside a big unit such as the aircraft.
    const bounds = plantRef.current?.boundsOfUnit(selection.unitId);
    if (bounds) distance = Math.max(distance, Math.hypot(bounds.size.x, bounds.size.z) * 0.55);
  }
  const getPosition = followPositionOf(selection);
  const start = getPosition();
  setState({ following: true, followDistance: distanceName, orbiting: false });
  rig.orbitRate = 0;
  const viewAzimuth = rig.goal.azimuth;
  const azimuth = selection.kind === 'bag' ? Math.min(0.9, Math.max(0.1, viewAzimuth)) : viewAzimuth;
  const elevation = Math.max(0.5, rig.goal.elevation);
  if (fly && start) {
    flyTo({ target: [start.x, start.y, start.z], distance, azimuth, elevation }, seconds, getPosition);
  }
  rig.getFollowPosition = getPosition;
  rig.goal.distance = distance;
  rig.goal.elevation = elevation;
  rig.goal.azimuth = azimuth;
}

export function stopFollow() {
  rig.getFollowPosition = null;
  setState({ following: false });
}

export function selectBag(planId, { fly = true, seconds = 1.6 } = {}) {
  const plan = sim.planById(planId);
  if (!plan) return;
  setState({ selection: { kind: 'bag', planId } });
  startFollow(getState().followDistance, { fly, seconds });
}

export function selectUnit(unitId, { fly = false } = {}) {
  if (fly) clearStageMarker();
  const selection = { kind: 'unit', unitId };
  const bounds = plantRef.current?.boundsOfUnit(unitId);
  rig.getFollowPosition = null;
  setState({ selection, following: false, orbiting: false });
  rig.orbitRate = 0;
  if (fly && bounds) {
    const size = Math.max(bounds.size.x, bounds.size.z);
    const distance = Math.min(60, Math.max(11, size * 2.2 + 8));
    flyTo({ target: [bounds.centre.x, Math.max(0.6, bounds.centre.y * 0.6), bounds.centre.z], distance, azimuth: 0.45, elevation: 0.7 }, 1.6);
    setState({ siteId: siteOfPosition(bounds.centre.x) });
  }
}

export function switchSite(siteId, seconds = 2.2) {
  clearStageMarker();
  const site = SITES.find((candidate) => candidate.id === siteId);
  rig.getFollowPosition = null;
  setState({ siteId, selection: null, following: false });
  const farAway = rig.target.distanceTo(new THREE.Vector3(...site.view.target)) > 30;
  flyTo(site.view, farAway ? 0.05 : seconds);
}

export function resetView() {
  clearStageMarker();
  const site = SITES.find((candidate) => candidate.id === getState().siteId);
  rig.getFollowPosition = null;
  setState({ following: false });
  flyTo(site.view, 1.2);
}
