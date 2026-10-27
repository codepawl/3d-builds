// Camera path around the pool, drag to look, wheel along the path, WASD to walk.
import * as THREE from "three";

const EYE_HEIGHT = 1.6;
// Path views aim between the pool and the ryokan so both stay in frame. Early on the target sits just north of
// the pool centre; on the deck at the end it moves north, so the view runs between the water and the lit facade.
const VIEW_TARGET_START = { x: -0.6, z: -3.4 };
const VIEW_TARGET_END = { x: -0.6, z: -4.4 };
// A slight downward tilt so the water surface sits in the lower half of the frame.
const BASE_PITCH = -0.07;
const RYOKAN_BOUNDS = { minX: -6.7, maxX: 5.7, frontZ: -10.0 };

function smoothstep(edgeLow, edgeHigh, value) {
  const amount = THREE.MathUtils.clamp((value - edgeLow) / (edgeHigh - edgeLow), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

export class CameraRig {
  constructor(camera, layout, domElement) {
    this.camera = camera;
    this.layout = layout;
    this.domElement = domElement;
    const pathPoints = layout.cameraPath.map((point) => new THREE.Vector3(point[0], 0, point[2]));
    this.path = new THREE.CatmullRomCurve3(pathPoints, false, "centripetal");
    this.progress = 0;
    this.targetProgress = 0;
    this.lateral = 0;
    this.yawOffset = 0;
    this.pitch = -0.04;
    this.walkOffset = new THREE.Vector3();
    this.pressedKeys = new Set();
    this.outlineRadii = this.buildOutlineRadii(layout.poolOutline);
    this.bindInput();
  }

  buildOutlineRadii(outline) {
    return outline.map(([pointX, pointZ]) => ({ angle: Math.atan2(pointZ, pointX), radius: Math.hypot(pointX, pointZ) })).sort((first, second) => first.angle - second.angle);
  }

  poolRatio(pointX, pointZ) {
    const angle = Math.atan2(pointZ, pointX);
    const radii = this.outlineRadii;
    let upperIndex = radii.findIndex((entry) => entry.angle >= angle);
    if (upperIndex <= 0) {
      upperIndex = upperIndex === -1 ? 0 : upperIndex;
    }
    const upper = radii[upperIndex];
    const lower = radii[(upperIndex - 1 + radii.length) % radii.length];
    let span = upper.angle - lower.angle;
    if (span <= 0) {
      span += Math.PI * 2;
    }
    let offset = angle - lower.angle;
    if (offset < 0) {
      offset += Math.PI * 2;
    }
    const radius = THREE.MathUtils.lerp(lower.radius, upper.radius, THREE.MathUtils.clamp(offset / span, 0, 1));
    return Math.hypot(pointX, pointZ) / radius;
  }

  floorHeight(pointX, pointZ) {
    const deck = this.layout.deck;
    const insideDeck = Math.min(pointX - deck.minX, deck.maxX - pointX, pointZ - deck.minZ, deck.maxZ - pointZ);
    const deckAmount = smoothstep(-0.45, 0.2, insideDeck);
    const insideEngawa = Math.min(pointX - RYOKAN_BOUNDS.minX, RYOKAN_BOUNDS.maxX - pointX, pointZ + 10.2, -9.0 - pointZ);
    const engawaAmount = smoothstep(-0.3, 0.2, insideEngawa);
    const poolAmount = smoothstep(1.05, 0.85, this.poolRatio(pointX, pointZ));
    let height = deck.top * deckAmount;
    height = THREE.MathUtils.lerp(height, 0.53, engawaAmount);
    height = THREE.MathUtils.lerp(height, this.layout.waterLevel - 0.62, poolAmount);
    return height;
  }

  bindInput() {
    const element = this.domElement;
    let dragPointerId = null;
    let lastX = 0;
    let lastY = 0;
    const activeTouches = new Map();
    element.addEventListener("pointerdown", (event) => {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size === 1) {
        dragPointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        element.setPointerCapture(event.pointerId);
      }
    });
    element.addEventListener("pointermove", (event) => {
      if (activeTouches.size >= 2 && activeTouches.has(event.pointerId)) {
        const previous = activeTouches.get(event.pointerId);
        this.nudgeProgress(-(event.clientY - previous.y) * 0.0012);
        activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        return;
      }
      if (event.pointerId !== dragPointerId) {
        return;
      }
      const sensitivity = event.pointerType === "touch" ? 0.006 : 0.0035;
      this.yawOffset += (event.clientX - lastX) * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (event.clientY - lastY) * sensitivity, -1.2, 1.2);
      lastX = event.clientX;
      lastY = event.clientY;
    });
    const endPointer = (event) => {
      activeTouches.delete(event.pointerId);
      if (event.pointerId === dragPointerId) {
        dragPointerId = null;
      }
    };
    element.addEventListener("pointerup", endPointer);
    element.addEventListener("pointercancel", endPointer);
    element.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.nudgeProgress(event.deltaY * 0.00045);
      },
      { passive: false }
    );
    window.addEventListener("keydown", (event) => this.pressedKeys.add(event.code));
    window.addEventListener("keyup", (event) => this.pressedKeys.delete(event.code));
    window.addEventListener("blur", () => this.pressedKeys.clear());
  }

  nudgeProgress(amount) {
    this.targetProgress = THREE.MathUtils.clamp(this.targetProgress + amount, 0, 1);
    this.returningToPath = true;
  }

  placeCamera(progress, lateral, options = {}) {
    this.progress = THREE.MathUtils.clamp(progress, 0, 1);
    this.targetProgress = this.progress;
    this.lateral = lateral || 0;
    this.yawOffset = options.yawOffset || 0;
    this.pitch = options.pitch || 0;
    this.walkOffset.set(0, 0, 0);
    this.applyTransform();
  }

  pathFrame(progress) {
    const point = this.path.getPointAt(progress);
    const tangent = this.path.getTangentAt(progress);
    tangent.y = 0;
    tangent.normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
    return { point, tangent, right };
  }

  update(deltaTime) {
    const progressBlend = 1 - Math.exp(-deltaTime * 4);
    this.progress += (this.targetProgress - this.progress) * progressBlend;
    if (this.returningToPath) {
      this.walkOffset.multiplyScalar(1 - progressBlend);
      if (this.walkOffset.lengthSq() < 1e-4) {
        this.returningToPath = false;
      }
    }
    this.applyWalking(deltaTime);
    this.applyTransform();
  }

  applyWalking(deltaTime) {
    const keys = this.pressedKeys;
    const forwardInput = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const sideInput = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    if (forwardInput === 0 && sideInput === 0) {
      return;
    }
    this.returningToPath = false;
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 4.2 : 1.6;
    const yaw = this.camera.rotation.y;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.walkOffset.addScaledVector(forward, forwardInput * speed * deltaTime);
    this.walkOffset.addScaledVector(right, sideInput * speed * deltaTime);
  }

  constrainPosition(position) {
    const distance = Math.hypot(position.x, position.z);
    if (distance > 45) {
      position.x *= 45 / distance;
      position.z *= 45 / distance;
    }
    const insideRyokanX = position.x > RYOKAN_BOUNDS.minX && position.x < RYOKAN_BOUNDS.maxX;
    if (insideRyokanX && position.z < RYOKAN_BOUNDS.frontZ && position.z > -17.5) {
      position.z = RYOKAN_BOUNDS.frontZ;
    }
  }

  // Every view along the path aims at the same point between the pool and the ryokan, so both stay in frame.
  lookYaw(pathPoint, progress) {
    const endAmount = smoothstep(0.6, 1.0, progress);
    const targetX = THREE.MathUtils.lerp(VIEW_TARGET_START.x, VIEW_TARGET_END.x, endAmount);
    const targetZ = THREE.MathUtils.lerp(VIEW_TARGET_START.z, VIEW_TARGET_END.z, endAmount);
    return Math.atan2(pathPoint.x - targetX, pathPoint.z - targetZ);
  }

  applyTransform() {
    const { point, right } = this.pathFrame(this.progress);
    const position = point.clone().addScaledVector(right, this.lateral).add(this.walkOffset);
    this.constrainPosition(position);
    this.walkOffset.copy(position).sub(point).addScaledVector(right, -this.lateral);
    position.y = this.floorHeight(position.x, position.z) + EYE_HEIGHT;
    const baseYaw = this.lookYaw(point, this.progress);
    this.camera.position.copy(position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(BASE_PITCH + this.pitch, baseYaw + this.yawOffset, 0);
    this.camera.updateMatrixWorld();
  }
}
