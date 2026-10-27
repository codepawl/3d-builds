import * as THREE from "three";

function createOnsenCameraPositionCurve() {
  const controlPoints = [
    new THREE.Vector3(-0.45, 1.62, 5.55),
    new THREE.Vector3(-2.55, 1.62, 3.25),
    new THREE.Vector3(-3.65, 1.62, 0.65),
    new THREE.Vector3(-2.75, 1.54, -1.75),
    new THREE.Vector3(-1.65, 1.48, -2.85)
  ];
  return new THREE.CatmullRomCurve3(controlPoints, false, "catmullrom", 0.45);
}

function createOnsenCameraLookTargetCurve() {
  const targetPoints = [
    new THREE.Vector3(0.25, 1.15, -0.85),
    new THREE.Vector3(0.45, 1.12, -0.85),
    new THREE.Vector3(0.65, 1.10, -0.75),
    new THREE.Vector3(0.95, 1.10, -0.25),
    new THREE.Vector3(1.35, 1.10, 0.25)
  ];
  return new THREE.CatmullRomCurve3(targetPoints, false, "catmullrom", 0.45);
}

export function createCameraController(camera, domElement, callbacks) {
  const positionCurve = createOnsenCameraPositionCurve();
  const lookTargetCurve = createOnsenCameraLookTargetCurve();
  const worldUp = new THREE.Vector3(0.0, 1.0, 0.0);

  const state = {
    pathProgress: 0.0,
    lateralOffset: 0.0,
    yawOffset: 0.0,
    pitchOffset: 0.0,
    freeWalkPosition: new THREE.Vector3(),
    baseForwardYaw: 0.0,
    basePitch: -0.075,
    isDragging: false,
    lastPointerX: 0.0,
    lastPointerY: 0.0,
    pressedKeys: new Set()
  };

  function syncCameraFromPathPoint(progressValue, lateralValue, yawOffsetValue, pitchValue) {
    const clampedProgress = THREE.MathUtils.clamp(progressValue, 0.0, 1.0);
    state.pathProgress = clampedProgress;
    state.lateralOffset = Number.isFinite(lateralValue) ? lateralValue : 0.0;
    state.yawOffset = Number.isFinite(yawOffsetValue) ? yawOffsetValue : 0.0;
    state.pitchOffset = Number.isFinite(pitchValue) ? pitchValue : 0.0;

    const curvePoint = positionCurve.getPointAt(clampedProgress);
    const lookTarget = lookTargetCurve.getPointAt(clampedProgress);

    const dx = lookTarget.x - curvePoint.x;
    const dy = lookTarget.y - curvePoint.y;
    const dz = lookTarget.z - curvePoint.z;
    const horizDist = Math.max(1e-4, Math.hypot(dx, dz));

    const flatForward = new THREE.Vector3(dx / horizDist, 0.0, dz / horizDist);
    const rightVector = new THREE.Vector3().crossVectors(flatForward, worldUp).normalize();

    state.freeWalkPosition.copy(curvePoint).addScaledVector(rightVector, state.lateralOffset);
    state.baseForwardYaw = Math.atan2(-dx, -dz);
    state.basePitch = Math.atan2(dy, horizDist);

    applyCameraTransform();
  }

  function applyCameraTransform() {
    const totalYaw = state.baseForwardYaw + state.yawOffset;
    const totalPitch = THREE.MathUtils.clamp(
      state.basePitch + state.pitchOffset,
      -Math.PI * 0.44,
      Math.PI * 0.44
    );

    camera.position.copy(state.freeWalkPosition);
    const euler = new THREE.Euler(totalPitch, totalYaw, 0.0, "YXZ");
    camera.quaternion.setFromEuler(euler);
    camera.updateMatrixWorld();
  }

  function placeCamera(progress, lateral = 0.0, orientation = {}) {
    const yawOffset = orientation && Number.isFinite(orientation.yawOffset) ? orientation.yawOffset : 0.0;
    const pitch = orientation && Number.isFinite(orientation.pitch) ? orientation.pitch : 0.0;
    syncCameraFromPathPoint(progress, lateral, yawOffset, pitch);
  }

  function stepFreeWalkMovement(deltaTime) {
    if (state.pressedKeys.size === 0) {
      return;
    }
    const isFast = state.pressedKeys.has("ShiftLeft") || state.pressedKeys.has("ShiftRight");
    const moveSpeed = (isFast ? 4.8 : 2.2) * deltaTime;
    const currentYaw = state.baseForwardYaw + state.yawOffset;
    const forwardDir = new THREE.Vector3(-Math.sin(currentYaw), 0.0, -Math.cos(currentYaw));
    const rightDir = new THREE.Vector3(Math.cos(currentYaw), 0.0, -Math.sin(currentYaw));

    if (state.pressedKeys.has("KeyW") || state.pressedKeys.has("ArrowUp")) {
      state.freeWalkPosition.addScaledVector(forwardDir, moveSpeed);
    }
    if (state.pressedKeys.has("KeyS") || state.pressedKeys.has("ArrowDown")) {
      state.freeWalkPosition.addScaledVector(forwardDir, -moveSpeed);
    }
    if (state.pressedKeys.has("KeyD") || state.pressedKeys.has("ArrowRight")) {
      state.freeWalkPosition.addScaledVector(rightDir, moveSpeed);
    }
    if (state.pressedKeys.has("KeyA") || state.pressedKeys.has("ArrowLeft")) {
      state.freeWalkPosition.addScaledVector(rightDir, -moveSpeed);
    }
    state.freeWalkPosition.x = THREE.MathUtils.clamp(state.freeWalkPosition.x, -16.0, 16.0);
    state.freeWalkPosition.z = THREE.MathUtils.clamp(state.freeWalkPosition.z, -12.0, 14.0);
  }

  function update(deltaTime) {
    stepFreeWalkMovement(deltaTime);
    applyCameraTransform();
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    state.isDragging = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
  }

  function onPointerMove(event) {
    if (!state.isDragging) {
      return;
    }
    const deltaX = event.clientX - state.lastPointerX;
    const deltaY = event.clientY - state.lastPointerY;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.yawOffset -= deltaX * 0.0032;
    state.pitchOffset = THREE.MathUtils.clamp(
      state.pitchOffset - deltaY * 0.0028,
      -1.15,
      1.15
    );
    applyCameraTransform();
  }

  function onPointerUp() {
    state.isDragging = false;
  }

  function onWheel(event) {
    event.preventDefault();
    const scrollDelta = Math.sign(event.deltaY) * 0.032;
    const nextProgress = THREE.MathUtils.clamp(state.pathProgress + scrollDelta, 0.0, 1.0);
    syncCameraFromPathPoint(nextProgress, state.lateralOffset, state.yawOffset, state.pitchOffset);
  }

  function onKeyDown(event) {
    state.pressedKeys.add(event.code);
    if (event.code === "Digit1" && callbacks.onSelectPreset) {
      callbacks.onSelectPreset("morning");
    } else if (event.code === "Digit2" && callbacks.onSelectPreset) {
      callbacks.onSelectPreset("golden");
    } else if (event.code === "Digit3" && callbacks.onSelectPreset) {
      callbacks.onSelectPreset("blue");
    } else if (event.code === "Digit4" && callbacks.onSelectPreset) {
      callbacks.onSelectPreset("night");
    } else if (event.code === "KeyF" && callbacks.onToggleDof) {
      callbacks.onToggleDof();
    } else if (event.code === "KeyC" && callbacks.onToggleDslr) {
      callbacks.onToggleDslr();
    }
  }

  function onKeyUp(event) {
    state.pressedKeys.delete(event.code);
  }

  domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  placeCamera(0.0, 0.0, { yawOffset: 0.0, pitch: 0.0 });

  return {
    state,
    placeCamera,
    update
  };
}
