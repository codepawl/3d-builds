import * as THREE from 'three';
import { loadFonts, makeCanvas, paintPaper, canvasToTexture, seededRandom } from './paint.js';
import { Book, leafAngle, leafProgress } from './book.js';
import { paintCover, paintColophon, DIAL_STOPS } from './art1.js';
import { buildTitanic } from './art1b.js';
import { buildStation } from './art2b.js';
import { findOverlaps } from './audit.js';
import { PAGE_WIDTH, PAGE_DEPTH, PIXELS_PER_CM } from './config.js';

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a05);
const camera = new THREE.PerspectiveCamera(30, 1, 5, 900);

await loadFonts();
const spreads = [await buildTitanic(renderer), await buildStation(renderer)];
const book = new Book({
  renderer,
  scene,
  spreads,
  coverCanvas: paintCover((PAGE_WIDTH + 1.4) * PIXELS_PER_CM, (PAGE_DEPTH + 0.7) * PIXELS_PER_CM),
  colophonCanvas: paintColophon(PAGE_WIDTH * PIXELS_PER_CM, PAGE_DEPTH * PIXELS_PER_CM),
  endpaperCanvas: (() => {
    const endpaper = makeCanvas(PAGE_WIDTH * 10, PAGE_DEPTH * 10, 1);
    paintPaper(endpaper.getContext('2d'), endpaper.logicalWidth, endpaper.logicalHeight, 5, [228, 214, 186]);
    return endpaper;
  })(),
});

// desk: dark walnut with long grain
const deskCanvas = makeCanvas(1024, 1024, 1);
{
  const context = deskCanvas.getContext('2d');
  const random = seededRandom(7);
  context.fillStyle = '#4a2c18';
  context.fillRect(0, 0, 1024, 1024);
  for (let line = 0; line < 900; line += 1) {
    const y = random() * 1024;
    context.strokeStyle = `rgba(${random() < 0.5 ? '20,10,4' : '120,74,40'},${0.05 + random() * 0.12})`;
    context.lineWidth = 0.6 + random() * 2.4;
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) context.lineTo(x, y + Math.sin(x / 140 + line) * 3 * random());
    context.stroke();
  }
}
const deskTexture = canvasToTexture(THREE, deskCanvas, renderer, { repeat: true });
deskTexture.repeat.set(9, 9);
const desk = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: deskTexture, roughness: 0.62, metalness: 0 }));
desk.rotation.x = -Math.PI / 2;
desk.position.y = book.deskY - 0.01;
desk.receiveShadow = true;
scene.add(desk);

// lamp light: one warm spot with soft shadows, a dim cool fill
scene.add(new THREE.HemisphereLight(0xffe8c8, 0x1c120a, 0.7));
const lamp = new THREE.SpotLight(0xffd0a0, 5.6, 0, 0.7, 0.9, 0);
lamp.position.set(-95, 105, 70);
lamp.target.position.set(0, 4, 8);
lamp.castShadow = true;
lamp.shadow.mapSize.set(3072, 3072);
lamp.shadow.camera.near = 60;
lamp.shadow.camera.far = 400;
lamp.shadow.bias = -0.00025;
lamp.shadow.normalBias = 0.06;
lamp.shadow.radius = 8;
scene.add(lamp, lamp.target);
const fill = new THREE.DirectionalLight(0xb7c8d8, 0.35);
fill.position.set(80, 60, 80);
scene.add(fill);

// state that the reader (or the recorder) drives
const view = { yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 };
const live = { t: 0, slide: 0, flap: 0, wheelStop: 0, steam: 0, wheelAngle: 0 };
const goal = { t: 0, slide: 0, flap: 0, wheelAngle: 0, steam: 0 };
let captionKind = null;
let drag = null;

const dockLabel = document.getElementById('page-label');
const noteCard = document.getElementById('note');
const hintLine = document.getElementById('hint');
const pageNames = ['Cover', 'RMS Titanic', 'Steam power station', 'Sources'];

function visibleSpread() {
  const index = Math.round(live.t) - 1;
  return index >= 0 && index < spreads.length ? index : -1;
}

function fitDistance(aspect, open) {
  const verticalFov = (camera.fov * Math.PI) / 180;
  const horizontalHalf = Math.tan(verticalFov / 2) * aspect;
  const needWidth = (PAGE_WIDTH * (open ? 1.04 : 1.3)) / 2 / horizontalHalf;
  const needHeight = (open ? 86 : 96) / (2 * Math.tan(verticalFov / 2));
  return Math.max(needWidth, needHeight);
}

function placeCamera() {
  const aspect = camera.aspect;
  const openness = Math.min(1, Math.max(0, live.t));
  const smooth = openness * openness * (3 - 2 * openness);
  const mix = (closed, open) => closed + (open - closed) * smooth;
  const target = new THREE.Vector3(view.focusX * smooth, mix(-0.5, 12) + view.focusY * smooth, mix(22, 6) + view.focusZ * smooth);
  const elevation = mix(0.95, 0.5) + view.pitch;
  const azimuth = view.yaw;
  const distance = mix(fitDistance(aspect, false), fitDistance(aspect, true)) * view.zoom;
  camera.position.set(
    target.x + distance * Math.sin(azimuth) * Math.cos(elevation),
    target.y + distance * Math.sin(elevation),
    target.z + distance * Math.cos(azimuth) * Math.cos(elevation),
  );
  camera.lookAt(target);
}

function applyMechanisms() {
  spreads[0].setSlide(live.slide);
  spreads[0].setFlap(live.flap);
  spreads[0].setWheelAngle(live.wheelAngle);
  spreads[1].setSteam(live.steam);
}

function updateCaption() {
  const index = visibleSpread();
  if (index < 0 || !captionKind) {
    noteCard.classList.remove('shown');
    return;
  }
  const info = spreads[index].caption(captionKind);
  noteCard.innerHTML = '';
  const heading = document.createElement('h2');
  heading.textContent = info.heading;
  const body = document.createElement('p');
  body.textContent = info.body;
  noteCard.append(heading, body);
  noteCard.classList.add('shown');
}

let lastCaptionKey = '';
function refreshCaption() {
  const index = visibleSpread();
  const key = `${index}|${captionKind}|${captionKind === 'wheel' ? spreads[0].currentStop() : ''}`;
  if (key !== lastCaptionKey) {
    lastCaptionKey = key;
    updateCaption();
  }
}

function refreshDock() {
  const page = Math.round(live.t);
  dockLabel.textContent = pageNames[page];
  const index = visibleSpread();
  hintLine.textContent = index >= 0 ? spreads[index].hints : page === 0 ? 'Open the cover.' : '';
  document.getElementById('prev').disabled = goal.t <= 0.001;
  document.getElementById('next').disabled = goal.t >= 2.999;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function renderNow() {
  book.setT(live.t);
  applyMechanisms();
  placeCamera();
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  refreshDock();
  refreshCaption();
}

// ---- pointer input -------------------------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  raycaster.setFromCamera(pointer, camera);
}

function pick() {
  const hits = raycaster.intersectObjects(book.group.children, true);
  for (const hit of hits) {
    if (hit.object.userData.handle) return { kind: 'handle', hit };
    if (hit.object.userData.leaf !== undefined) return { kind: 'leaf', hit };
    if (hit.object.isMesh && hit.object.material && hit.object.material.alphaTest > 0 && hit.face === null) continue;
  }
  return hits.length ? { kind: 'other', hit: hits[0] } : { kind: 'none' };
}

function planeHit(point, normal) {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  const target = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, target) ? target : null;
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  setPointer(event);
  const picked = pick();
  const index = visibleSpread();
  drag = { startX: event.clientX, startY: event.clientY, moved: 0, mode: 'orbit', yaw: view.yaw, pitch: view.pitch };
  if (picked.kind === 'handle' && index >= 0) {
    const kind = picked.hit.object.userData.handle.kind;
    const owner = kind === 'steam' ? 1 : 0;
    if (owner === index) {
      drag.mode = kind;
      captionKind = kind;
      if (kind === 'slider') {
        const frame = spreads[0].frames.hull;
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(frame.matrixWorld);
        const point = planeHit(frame.getWorldPosition(new THREE.Vector3()), normal);
        drag.grab = point ? frame.worldToLocal(point.clone()).x - spreads[0].handles.slider.position.x : 0;
      }
      if (kind === 'wheel') {
        const center = spreads[0].frames.wheel.getWorldPosition(new THREE.Vector3());
        const point = planeHit(center, new THREE.Vector3(0, 1, 0));
        drag.startBearing = point ? Math.atan2(point.x - center.x, -(point.z - center.z)) : 0;
        drag.startAngle = live.wheelAngle;
      }
      if (kind === 'steam') {
        const point = planeHit(new THREE.Vector3(0, spreads[1].tabHolder.getWorldPosition(new THREE.Vector3()).y, 0), new THREE.Vector3(0, 1, 0));
        drag.grab = point ? point.x - spreads[1].tabHolder.position.x : 0;
      }
    }
  } else if (picked.kind === 'leaf' && picked.hit.object.userData.leaf === book.grabLeaf()) {
    drag.mode = 'page';
    drag.leaf = picked.hit.object.userData.leaf;
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  drag.moved += Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
  setPointer(event);
  if (drag.mode === 'orbit') {
    view.yaw = Math.max(-0.5, Math.min(0.5, drag.yaw - (event.clientX - drag.startX) * 0.004));
    view.pitch = Math.max(-0.22, Math.min(0.3, drag.pitch + (event.clientY - drag.startY) * 0.003));
    renderNow();
    return;
  }
  if (drag.mode === 'page') {
    const point = planeHit(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
    if (!point) return;
    const angle = Math.atan2(Math.max(0, point.y), point.z);
    goal.t = drag.leaf + leafProgress(angle);
    live.t = goal.t;
    goal.snap = false;
    return;
  }
  if (drag.mode === 'slider') {
    const frame = spreads[0].frames.hull;
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(frame.matrixWorld);
    const point = planeHit(frame.getWorldPosition(new THREE.Vector3()), normal);
    if (point) {
      const local = frame.worldToLocal(point.clone()).x - drag.grab;
      goal.slide = (local - spreads[0].sliderHome) / spreads[0].sliderTravel;
      live.slide = Math.min(1, Math.max(0, goal.slide));
    }
  } else if (drag.mode === 'wheel') {
    const center = spreads[0].frames.wheel.getWorldPosition(new THREE.Vector3());
    const point = planeHit(center, new THREE.Vector3(0, 1, 0));
    if (point) {
      const bearing = Math.atan2(point.x - center.x, -(point.z - center.z));
      live.wheelAngle = drag.startAngle - (bearing - drag.startBearing);
      goal.wheelAngle = live.wheelAngle;
    }
  } else if (drag.mode === 'steam') {
    const point = planeHit(new THREE.Vector3(0, spreads[1].tabHolder.getWorldPosition(new THREE.Vector3()).y, 0), new THREE.Vector3(0, 1, 0));
    if (point) {
      const x = point.x - drag.grab;
      live.steam = Math.min(1, Math.max(0, (x + spreads[1].tabTravel) / (2 * spreads[1].tabTravel)));
      goal.steam = live.steam;
    }
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (!drag) return;
  const finished = drag;
  drag = null;
  canvas.releasePointerCapture(event.pointerId);
  if (finished.mode === 'page') {
    goal.t = Math.round(live.t);
    goal.snap = true;
  } else if (finished.mode === 'flap' || (finished.mode === 'orbit' && false)) {
    // handled below
  }
  if (finished.mode === 'flap' && finished.moved < 6) goal.flap = goal.flap > 0.5 ? 0 : 1;
  if (finished.mode === 'wheel') {
    const step = Math.PI / 4;
    goal.wheelAngle = Math.round(live.wheelAngle / step) * step;
  }
  if (finished.mode === 'slider') goal.slide = live.slide > 0.5 ? 1 : 0;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  view.zoom = Math.max(0.55, Math.min(1.25, view.zoom * (1 + event.deltaY * 0.001)));
  renderNow();
}, { passive: false });

function turn(direction) {
  goal.t = Math.min(3, Math.max(0, Math.round(goal.t) + direction));
  goal.snap = true;
  captionKind = null;
}
document.getElementById('prev').addEventListener('click', () => turn(-1));
document.getElementById('next').addEventListener('click', () => turn(1));
window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'PageDown') turn(1);
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') turn(-1);
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const follow = (value, target, rate) => value + (target - value) * (1 - Math.exp(-dt * rate));
  if (!window.__recording) {
    if (!drag || drag.mode !== 'page') live.t = follow(live.t, goal.t, goal.snap ? 5 : 18);
    if (Math.abs(live.t - goal.t) < 0.002) live.t = goal.t;
    if (!drag || drag.mode !== 'slider') live.slide = follow(live.slide, Math.min(1, Math.max(0, goal.slide)), 8);
    live.flap = follow(live.flap, goal.flap, 7);
    if (!drag || drag.mode !== 'wheel') live.wheelAngle = follow(live.wheelAngle, goal.wheelAngle, 9);
    if (!drag || drag.mode !== 'steam') live.steam = follow(live.steam, goal.steam, 8);
    renderNow();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- hooks for tests and the recorder --------------------------------------------------------------------------
function footprint(spreadIndex, psiDegrees) {
  // smallest height of any pop-up piece above the near leaf's front face, and its largest reach past the far leaf
  const spread = spreads[spreadIndex];
  const far = book.leaves[spreadIndex];
  const near = book.leaves[spreadIndex + 1];
  const psi = (psiDegrees * Math.PI) / 180;
  const board = far.thickness + far.offset;
  spread.update(psi, { y: near.offset - board * Math.cos(psi), z: board * Math.sin(psi) });
  spread.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let lowest = Infinity;
  let behind = Infinity;
  const inward = new THREE.Vector3(0, -Math.cos(psi), Math.sin(psi));
  spread.root.traverse((object) => {
    if (!object.isMesh) return;
    box.setFromObject(object);
    const corners = [box.min, box.max];
    for (const corner of corners) {
      const local = spread.root.worldToLocal(corner.clone());
      lowest = Math.min(lowest, local.y);
    }
  });
  return { psi: psiDegrees, lowest: Number(lowest.toFixed(3)), overlaps: findOverlaps(spread.root, 0.5) };
}

window.book = {
  ready: true,
  apply(next) {
    window.__recording = true;
    Object.assign(live, {
      t: next.t ?? live.t, slide: next.slide ?? live.slide, flap: next.flap ?? live.flap,
      steam: next.steam ?? live.steam, wheelAngle: next.wheelAngle ?? live.wheelAngle,
    });
    Object.assign(view, { yaw: next.yaw ?? view.yaw, pitch: next.pitch ?? view.pitch, zoom: next.zoom ?? view.zoom, focusX: next.focusX ?? view.focusX, focusY: next.focusY ?? view.focusY, focusZ: next.focusZ ?? view.focusZ });
    if ('caption' in next) captionKind = next.caption;
    renderNow();
  },
  // World centre of a detail, in the current state, so the reel can frame it whole.
  locate(name) {
    const spot = {
      boilerWindow: () => spreads[0].frames.hull.localToWorld(new THREE.Vector3(0.6, 1.65, 0)),
      flap: () => spreads[0].frames.flapPivot.localToWorld(new THREE.Vector3(2.6, -1.0, 0)),
      wheel: () => spreads[0].frames.wheel.getWorldPosition(new THREE.Vector3()),
      steamLoop: () => spreads[1].layers[1].frame.localToWorld(new THREE.Vector3(-9.5, 6.1, 0)),
    }[name]();
    return { x: spot.x, y: spot.y, z: spot.z, cameraDistanceAtZoomOne: camera.position.distanceTo(new THREE.Vector3(view.focusX, 0, 0)) };
  },
  dialStops: DIAL_STOPS.length,
  audit() {
    const results = [];
    for (let spreadIndex = 0; spreadIndex < spreads.length; spreadIndex += 1) {
      for (const psi of [0, 15, 30, 45, 60, 75, 90, 112, 120, 150, 180]) results.push({ spread: spreadIndex, ...footprint(spreadIndex, psi) });
    }
    book.setT(live.t);
    return results;
  },
  state: () => ({ ...live, view: { ...view } }),
};
renderNow();
document.body.classList.add('ready');
