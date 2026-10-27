import * as THREE from "three";
import { RoomEnvironment } from "/vendor/three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "/vendor/three/examples/jsm/controls/OrbitControls.js";
import { createSeal } from "./seal-model.js";
import { MelodyPlayer, GestureNotes } from "./melody.js";
import { TrumpetAudio } from "./audio.js";
import { cartoonizeSeal } from "./cartoon.js";

const canvas = document.querySelector("#seal-canvas");
const stage = document.querySelector(".stage");
const melody = new MelodyPlayer();
const gestures = new GestureNotes();
const audio = new TrumpetAudio();
const targetOffset = new THREE.Vector3();
const currentOffset = new THREE.Vector3();
const velocity = new THREE.Vector3();
const grip = new THREE.Vector3(0, 0.4, 0.8);
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane();
const dragOrigin = new THREE.Vector3();
const intersectionPoint = new THREE.Vector3();
let dragPointer = null;
let hornEquipped = true;
let playingAmount = 0;
let previousFrame = performance.now();
let renderer;
let animationFrame;
let sceneDirty = true;
let orbit;
let hovered = false;
const gaze = new THREE.Vector2();
const gazeTarget = new THREE.Vector2();
let lastIdleRender = 0;
let orbiting = false;
let cameraDirty = true;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// Keep the prototype source while the public toy ships on Three.js.
const engine = "three";
const seal = createSeal(THREE);
cartoonizeSeal(seal);
document
  .querySelector(`[data-engine="${engine}"]`)
  .setAttribute("aria-current", "page");

try {
  if (engine === "67") {
    const { SealRenderer67 } = await import("./renderer-67.js");
    renderer = new SealRenderer67(canvas, seal.group);
  } else {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
} catch (error) {
  document.querySelector("#scene-error").hidden = false;
  throw error;
}
const scene = new THREE.Scene();
if (engine === "three") {
  const environment = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = environmentGenerator.fromScene(environment, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.65;
  environment.dispose();
  environmentGenerator.dispose();
}
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
const cameraDirection = new THREE.Vector3(-3.4, 1.35, 6.4);
scene.add(new THREE.HemisphereLight(0xf6fff9, 0x94b6a4, 0.9));
const keyLight = new THREE.DirectionalLight(0xfff6e8, 1.1);
keyLight.position.set(-3, 5, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xe4efff, 0.15);
fillLight.position.set(4, 2, -3);
scene.add(fillLight);
scene.add(seal.group);

const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 256;
const shadowContext = shadowCanvas.getContext("2d");
const shadowGradient = shadowContext.createRadialGradient(
  128,
  128,
  10,
  128,
  128,
  126,
);
shadowGradient.addColorStop(0, "rgba(74,109,86,0.18)");
shadowGradient.addColorStop(0.55, "rgba(74,109,86,0.065)");
shadowGradient.addColorStop(1, "rgba(74,109,86,0)");
shadowContext.fillStyle = shadowGradient;
shadowContext.fillRect(0, 0, 256, 256);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(5.2, 4),
  new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -1.25;
scene.add(shadow);

function resize() {
  sceneDirty = true;
  const { width, height } = canvas.getBoundingClientRect();
  camera.aspect = width / Math.max(1, height);
  camera.position
    .copy(cameraDirection)
    .multiplyScalar(Math.max(1, 0.92 / camera.aspect));
  camera.lookAt(0, 0.15, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(stage);
resize();

function updateSongDisplay() {
  const length = melody.song.notes.length;
  document.querySelector("#note-number").textContent =
    `${melody.position} / ${length}`;
  document.querySelector("#progress-fill").style.width =
    `${(melody.position / length) * 100}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuemax', length);
  document
    .querySelector(".progress-track")
    .setAttribute("aria-valuenow", melody.position);
}
document.querySelector('#song-title').addEventListener('change', event => {
  melody.selectSong(event.target.value);
  gestures.reset();
  updateSongDisplay();
});

function triggerNote(force = 0.5) {
  if (!hornEquipped) {

    return;
  }
  const result = melody.playNext(performance.now());
  if (!result) return;
  audio.play(result.note, force);
  playingAmount = 1;
  updateSongDisplay();
}

function updatePointer(event) {
  const rectangle = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rectangle.left) / rectangle.width) * 2 - 1,
    (-(event.clientY - rectangle.top) / rectangle.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.classList.add('pointer-input');
  if (dragPointer !== null || event.button !== 0) return;
  updatePointer(event);
  const hit = raycaster.intersectObjects(seal.bodyMeshes, true)[0];
  if (!hit) return;
  orbit.enabled = false;
  dragPointer = event.pointerId;
  grip.copy(seal.group.worldToLocal(hit.point.clone()));
  dragPlane.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()),
    hit.point,
  );
  raycaster.ray.intersectPlane(dragPlane, dragOrigin);
  gestures.reset();
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("dragging");
  canvas.focus({ preventScroll: true });
  audio.unlock().catch(() => {});
});

canvas.addEventListener("pointermove", (event) => {
  if (dragPointer !== event.pointerId) {
    if (orbiting) return;
    updatePointer(event);
    hovered = Boolean(raycaster.intersectObjects(seal.bodyMeshes, true)[0]);
    gazeTarget.set(pointer.x * 0.1, pointer.y * 0.06);
    return;
  }
  updatePointer(event);
  if (!raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) return;
  const displacement = intersectionPoint.clone().sub(dragOrigin);
  displacement.applyQuaternion(seal.group.quaternion.clone().invert());
  targetOffset.set(
    THREE.MathUtils.clamp(displacement.x, -2.3, 2.3),
    THREE.MathUtils.clamp(displacement.y, -1.65, 1.9),
    THREE.MathUtils.clamp(displacement.z, -1, 1),
  );
  const point = { x: displacement.x, y: displacement.y };
  const movedDistance = Math.hypot(
    point.x - gestures.lastPoint.x,
    point.y - gestures.lastPoint.y,
  );
  if (movedDistance > 0.015) {
    melody.moved(performance.now());

  }
  if (gestures.move(point)) triggerNote(Math.min(1, targetOffset.length()));
});

function endDrag(event) {
  if (event.pointerId !== dragPointer) return;
  if (event.type === "pointerup" && gestures.release())
    triggerNote(Math.min(1, targetOffset.length()));
  else gestures.reset();
  dragPointer = null;
  orbit.enabled = true;
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  targetOffset.set(0, 0, 0);
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("lostpointercapture", endDrag);
canvas.addEventListener('pointerleave', () => {
  hovered = false;
  gazeTarget.set(0, 0);
});
window.addEventListener("blur", () => {
  if (dragPointer !== null) endDrag({ pointerId: dragPointer });
});

canvas.addEventListener("keydown", (event) => {
  canvas.classList.remove('pointer-input');
  const directions = {
    ArrowUp: [0, 0.8, 0],
    ArrowDown: [0, -0.65, 0],
    ArrowLeft: [-0.8, 0, 0],
    ArrowRight: [0.8, 0, 0],
    " ": [0, -0.55, 0],
  };
  if (!directions[event.key]) return;
  event.preventDefault();
  audio
    .unlock()
    .then(() => {

      const point = { x: targetOffset.x, y: targetOffset.y };
      if (gestures.move(point)) triggerNote(0.6);
    })
    .catch(() => {});
  grip.set(0, 0.3, 0.8);
  targetOffset.fromArray(directions[event.key]);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') canvas.classList.remove('pointer-input');
});
canvas.addEventListener("keyup", (event) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)
  )
    {
      if (gestures.move({ x: 0, y: 0 })) triggerNote(0.6);
      targetOffset.set(0, 0, 0);
    }
});

document.querySelector("#horn-toggle").addEventListener("click", () => {
  hornEquipped = !hornEquipped;
  seal.setHornVisible(hornEquipped);
  sceneDirty = true;
  document
    .querySelector("#horn-toggle")
    .setAttribute("aria-pressed", hornEquipped);
  document.querySelector("#horn-label").textContent = hornEquipped
    ? "Put trumpet away"
    : "Give a trumpet";
  audio.unlock().catch(() => {});
});
document.querySelector("#sound-toggle").addEventListener("click", () => {
  audio.setMuted(!audio.muted);
  document
    .querySelector("#sound-toggle")
    .setAttribute("aria-pressed", audio.muted);
  document
    .querySelector("#sound-toggle")
    .setAttribute("aria-label", audio.muted ? "Unmute sound" : "Mute sound");
  audio.unlock().catch(() => {});
});
document.querySelector("#restart").addEventListener("click", () => {
  melody.reset();
  updateSongDisplay();
});

function render(now) {
  if (document.hidden) return;
  const delta = Math.min(0.033, (now - previousFrame) / 1000);
  previousFrame = now;
  const acceleration = targetOffset
    .clone()
    .sub(currentOffset)
    .multiplyScalar(dragPointer !== null ? 165 : 105)
    .addScaledVector(velocity, dragPointer !== null ? -21 : -8);
  velocity.addScaledVector(acceleration, delta);
  currentOffset.addScaledVector(velocity, delta);
  if (reducedMotion.matches) {
    currentOffset.copy(targetOffset);
    velocity.set(0, 0, 0);
  }
  if (currentOffset.length() < 0.0001 && velocity.length() < 0.001)
    currentOffset.set(0, 0, 0);
  playingAmount *= Math.exp(-delta * 7.5);
  orbit.update();
  const activePull = currentOffset.lengthSq() > 0.000001 || velocity.lengthSq() > 0.000001;
  if (
    sceneDirty ||
    activePull ||
    playingAmount > 0.001
  ) {
    seal.setPlaying(playingAmount);
    seal.deform({
      offset: currentOffset,
      grip,
      stretch: Math.max(0, currentOffset.y) * 0.45,
      squash: Math.max(0, -currentOffset.y) * 0.6,
      time: reducedMotion.matches ? 0 : now / 1000,
    });
    shadow.scale.x = 1 + Math.max(0, -currentOffset.y) * 0.2;
    sceneDirty = false;
  }
  if (cameraDirty || now - lastIdleRender >= 33 || activePull) {
    const time = reducedMotion.matches ? 0 : now / 1000;
    const breath = time ? Math.sin(time * 1.7) : 0;
    gaze.lerp(gazeTarget, 1 - Math.exp(-delta * 5));
    seal.group.scale.set(1 + breath * 0.006, 1 + breath * 0.012, 1 + breath * 0.006);
    seal.group.position.y = breath * 0.012;
    seal.group.rotation.y = reducedMotion.matches ? 0 : gaze.x;
    seal.group.rotation.z = reducedMotion.matches ? 0 : -gaze.y * 0.35;
    seal.applyIdle?.(time, Math.min(1, currentOffset.length() + (hovered ? 0.2 : 0)));
    renderer.render(scene, camera);
    cameraDirty = false;
    lastIdleRender = now;
  }
  if (melody.checkIdle(now)) updateSongDisplay();
  animationFrame = requestAnimationFrame(render);
}
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(animationFrame);
  if (document.hidden) {
    if (dragPointer !== null) endDrag({ pointerId: dragPointer });
  } else {
    previousFrame = performance.now();
    animationFrame = requestAnimationFrame(render);
  }
});
orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 0.15, 0);
orbit.enablePan = false;
orbit.enableDamping = true;
orbit.dampingFactor = 0.09;
orbit.minDistance = 4;
orbit.maxDistance = 14;
orbit.minPolarAngle = 0.25;
orbit.maxPolarAngle = Math.PI * 0.8;
orbit.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
orbit.addEventListener('start', () => { orbiting = true; });
orbit.addEventListener('end', () => { orbiting = false; });
orbit.addEventListener('change', () => { cameraDirty = true; });
animationFrame = requestAnimationFrame(render);

window.sealDebug = {
  ready: true,
  engine,
  seal,
  scene,
  renderer,
  camera,
  melody,
  audio,
  get state() {
    return {
      dragging: dragPointer !== null,
      offset: currentOffset.toArray(),
      target: targetOffset.toArray(),
      hornEquipped,
      muted: audio.muted,
      position: melody.position,
      notes: [...melody.history],
      audioState: audio.context?.state || "locked",
    };
  },
};

