// Scene, light, one continuous camera spline, labels and the event export. Every frame is renderAt(t).
import * as THREE from 'three';
import { makeMaterials, smoothstep } from './kit.js';
import { buildWorld, SCRIPT, GATE_X } from './world.js';
import { buildLife } from './life.js';

const DURATION = 20;
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.95;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const PARCHMENT_DAY = new THREE.Color(0xf0e3c2);
const PARCHMENT_DUSK = new THREE.Color(0xe2c394);
scene.background = PARCHMENT_DAY.clone();
scene.fog = new THREE.Fog(PARCHMENT_DAY.clone(), 170, 420);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, 900);

const materials = makeMaterials();
const world = buildWorld(scene, materials);
const life = buildLife(scene);

// ---------- sun and sky ----------
const sun = new THREE.DirectionalLight(0xffe0a8, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -95;
sun.shadow.camera.right = 95;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
sun.target.position.set(-4, 0, 0);
const hemisphere = new THREE.HemisphereLight(0xfff0d0, 0xa98350, 0.95);
scene.add(hemisphere);

const SUN_DAY = new THREE.Color(0xffe2ac);
const SUN_DUSK = new THREE.Color(0xffa860);
const SKY_DAY = new THREE.Color(0xfff2d8);
const SKY_DUSK = new THREE.Color(0xf4c89c);
const sunPosition = new THREE.Vector3();

function setSky(t) {
  const dusk = world.dusk(t);
  const elevation = THREE.MathUtils.degToRad(42 - 20 * dusk);
  const azimuth = THREE.MathUtils.degToRad(-32 + 10 * dusk);
  sunPosition.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(180);
  sun.position.copy(sunPosition).add(sun.target.position);
  sun.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk);
  sun.intensity = 2.4 - 0.9 * dusk;
  hemisphere.color.copy(SKY_DAY).lerp(SKY_DUSK, dusk);
  hemisphere.intensity = 1.0 - 0.3 * dusk;
  scene.background.copy(PARCHMENT_DAY).lerp(PARCHMENT_DUSK, dusk);
  scene.fog.color.copy(scene.background);
  world.page.material.color.setRGB(1 - 0.12 * dusk, 1 - 0.2 * dusk, 1 - 0.32 * dusk);
  renderer.toneMappingExposure = 0.95 + 0.12 * dusk;
}

// ---------- birds ----------
const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x4a3828, side: THREE.DoubleSide });
const birds = [].map((index) => {
  const group = new THREE.Group();
  const wingGeometry = new THREE.PlaneGeometry(1.6, 0.5);
  wingGeometry.translate(0.8, 0, 0);
  const left = new THREE.Mesh(wingGeometry, birdMaterial);
  const right = new THREE.Mesh(wingGeometry, birdMaterial);
  right.rotation.y = Math.PI;
  group.add(left, right);
  scene.add(group);
  return { group, left, right, phase: index * 1.3, radius: 55 + index * 9, height: 46 + (index % 3) * 6, speed: 0.12 + index * 0.012 };
});

function updateBirds(t) {
  for (const bird of birds) {
    const angle = bird.phase + t * bird.speed;
    bird.group.position.set(-6 + Math.cos(angle) * bird.radius, bird.height + Math.sin(t * 0.7 + bird.phase) * 1.5, -2 + Math.sin(angle) * bird.radius * 0.8);
    bird.group.rotation.y = -angle - Math.PI / 2 + 0.2;
    const flap = Math.sin(t * 9 + bird.phase * 3) * 0.7;
    bird.left.rotation.z = flap;
    bird.right.rotation.z = -flap;
  }
}

// ---------- camera: one spline through timed waypoints, never at rest ----------
const rider = (t) => {
  const position = new THREE.Vector3();
  life.riderPath.position(life.riderDistance(t), position);
  return position;
};
function chase(t, offset, lookOffset, fov) {
  const base = rider(t);
  return { t, position: base.clone().add(new THREE.Vector3(...offset)).toArray(), target: base.clone().add(new THREE.Vector3(...lookOffset)).toArray(), fov };
}
const KEYS = [
  { t: 0.0, position: [-52, 98, 116], target: [-2, 2, 0], fov: 32 },
  { t: 2.4, position: [-50, 50, 74], target: [-20, 3, 14], fov: 34 },
  { t: 4.2, position: [-40, 16, 46], target: [-22, 3.5, 15], fov: 40 },
  chase(5.6, [-8, 7, 11], [0, 2, -2], 44),
  chase(6.9, [-1.5, 3.8, 8], [0, 1.8, -3], 50),
  chase(8.1, [0.6, 3.6, 7], [0, 1.8, -3], 52),
  chase(9.0, [0.0, 3.4, 6.6], [0, 1.8, -3], 52),
  { t: 9.9, position: [-21.2, 5.4, 4.2], target: [-20.5, 2.0, -8], fov: 50 },
  { t: 10.7, position: [-20.5, 7.5, -0.5], target: [-17, 2.5, -12], fov: 52 },
  { t: 11.5, position: [-16, 10.5, 0.5], target: [-11, 1.5, -12], fov: 50 },
  { t: 12.3, position: [-2, 17, 15], target: [10, 0, 2], fov: 42 },
  { t: 13.2, position: [8, -8.5, 58], target: [16, -9, 5], fov: 36 },
  { t: 14.2, position: [12, -2.6, 58], target: [16, -3, 5], fov: 36 },
  { t: 15.2, position: [15, 3.3, 58], target: [16, 3, 5], fov: 36 },
  { t: 16.1, position: [17, 9.4, 58], target: [16, 9, 5], fov: 36 },
  { t: 16.9, position: [18, 16, 58], target: [16, 15.5, 5], fov: 36 },
  { t: 17.7, position: [14, 23, 59], target: [16, 22.5, 5], fov: 36 },
  { t: 18.9, position: [-18, 60, 86], target: [4, 10, 0], fov: 34 },
  { t: 20.0, position: [-56, 100, 118], target: [-2, 3, 0], fov: 32 },
];

function hermite(values, times, index, t) {
  const count = values.length;
  const before = Math.max(0, index - 1);
  const after = Math.min(count - 1, index + 2);
  const h = times[index + 1] - times[index];
  const s = (t - times[index]) / h;
  const tangent = (from, to) => (values[to] - values[from]) / (times[to] - times[from]);
  const m0 = (index === 0 ? tangent(index, index + 1) : tangent(before, index + 1)) * h;
  const m1 = (index + 1 === count - 1 ? tangent(index, index + 1) : tangent(index, after)) * h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * values[index] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * values[index + 1] + (s3 - s2) * m1;
}

const KEY_TIMES = KEYS.map((key) => key.t);
function cameraState(t) {
  const clamped = Math.min(DURATION, Math.max(0, t));
  let index = 0;
  while (index < KEYS.length - 2 && KEYS[index + 1].t <= clamped) {
    index += 1;
  }
  const channel = (get) => hermite(KEYS.map(get), KEY_TIMES, index, clamped);
  const position = new THREE.Vector3(channel((k) => k.position[0]), channel((k) => k.position[1]), channel((k) => k.position[2]));
  const target = new THREE.Vector3(channel((k) => k.target[0]), channel((k) => k.target[1]), channel((k) => k.target[2]));
  const fov = channel((k) => k.fov);
  // slight handheld drift, a function of t only
  position.x += 0.18 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 3.1);
  position.y += 0.14 * Math.sin(t * 1.7 + 1) + 0.06 * Math.sin(t * 3.7);
  target.x += 0.1 * Math.sin(t * 1.1 + 2);
  target.y += 0.08 * Math.sin(t * 1.9);
  const roll = 0.004 * Math.sin(t * 0.9);
  return { position, target, fov, roll };
}

function applyCamera(t) {
  const state = cameraState(t);
  camera.position.copy(state.position);
  camera.fov = state.fov;
  camera.up.set(Math.sin(state.roll), Math.cos(state.roll), 0);
  camera.lookAt(state.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

// ---------- labels ----------
const labelLayer = document.getElementById('labels');
const LABELS = [
  { text: 'Keep', anchor: [16, 33, 4], window: [0.3, 2.3], offset: [140, -70] },
  { text: 'Gatehouse', anchor: [-22, 12.5, 12], window: [2.5, 4.9], offset: [-210, -70] },
  { text: 'Drawbridge', anchor: [-22, 0.6, 17], window: [4.0, 6.3], offset: [-250, 60] },
  { text: 'Inner bailey', anchor: [-8, 0, -12], window: [10.5, 12.4], offset: [60, 90] },
  { text: 'Dungeon', anchor: [28.3, -9, 5], window: [13.0, 14.3], offset: [70, 0] },
  { text: 'Food storage', anchor: [28.3, -3, 5], window: [14.0, 15.1], offset: [70, 0] },
  { text: 'Kitchen', anchor: [28.3, 3, 5], window: [14.9, 16.0], offset: [70, 0] },
  { text: 'Chapel', anchor: [28.3, 9, 5], window: [15.8, 16.8], offset: [70, 0] },
  { text: 'Great hall', anchor: [28.3, 15.5, 5], window: [16.5, 17.6], offset: [70, 0] },
  { text: "Lord's chambers", anchor: [28.3, 22.5, 5], window: [17.3, 18.6], offset: [70, 0] },
  { text: 'Keep', anchor: [16, 33, 4], window: [19.0, 20.1], offset: [150, -60] },
].map((label) => {
  const element = document.createElement('div');
  element.className = 'label';
  element.textContent = label.text;
  const dot = document.createElement('i');
  element.prepend(dot);
  labelLayer.appendChild(element);
  return { ...label, element, point: new THREE.Vector3(...label.anchor) };
});

function updateLabels(t) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const label of LABELS) {
    const [start, end] = label.window;
    const opacity = smoothstep(start, start + 0.45, t) * (1 - smoothstep(end - 0.45, end, t));
    label.element.style.opacity = String(opacity);
    if (opacity <= 0.001) {
      continue;
    }
    const projected = label.point.clone().project(camera);
    const anchorX = (projected.x * 0.5 + 0.5) * width;
    const anchorY = (-projected.y * 0.5 + 0.5) * height;
    const boxWidth = label.element.offsetWidth;
    const boxHeight = label.element.offsetHeight;
    let x = anchorX + label.offset[0] - (label.offset[0] < 0 ? boxWidth : 0);
    let y = anchorY + label.offset[1] - boxHeight / 2;
    x = Math.min(width - boxWidth - 40, Math.max(40, x));
    y = Math.min(height - boxHeight - 60, Math.max(50, y));
    label.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ---------- the frame ----------
function renderAt(t) {
  setSky(t);
  world.update(t);
  life.update(t);
  updateBirds(t);
  applyCamera(t);
  renderer.render(scene, camera);
  updateLabels(t);
  const dusk = world.dusk(t);
  document.getElementById('vignette').style.opacity = String(0.55 + 0.35 * dusk);
}
window.renderAt = renderAt;

// ---------- events for the sound track, from the same simulation ----------
const projectScratch = new THREE.Vector3();
function describe(event) {
  const state = cameraState(event.t);
  const probe = new THREE.PerspectiveCamera(state.fov, window.innerWidth / window.innerHeight, 0.5, 900);
  probe.position.copy(state.position);
  probe.lookAt(state.target);
  probe.updateMatrixWorld(true);
  projectScratch.copy(event.position).project(probe);
  const distance = state.position.distanceTo(event.position);
  return { ...event, position: event.position.toArray().map((v) => Math.round(v * 100) / 100), pan: Math.max(-1, Math.min(1, projectScratch.x)), distance: Math.round(distance * 10) / 10, onScreen: Math.abs(projectScratch.x) < 1.05 && Math.abs(projectScratch.y) < 1.05 && projectScratch.z < 1 };
}
window.getEvents = () => {
  const events = life.eventList(DURATION);
  const gate = new THREE.Vector3(GATE_X, 5, 12);
  events.push({ t: SCRIPT.bridgeStart, kind: 'chain', end: SCRIPT.bridgeLand, position: gate.clone(), surface: 'iron', gain: 1 });
  events.push({ t: SCRIPT.bridgeLand, kind: 'bridgeThud', position: new THREE.Vector3(GATE_X, 0.5, 19), surface: 'wood', gain: 1 });
  events.push({ t: SCRIPT.portcullisStart, kind: 'portcullis', end: SCRIPT.portcullisEnd, position: gate.clone(), surface: 'iron', gain: 1 });
  SCRIPT.bellTolls.forEach((toll) => events.push({ t: toll, kind: 'bell', position: world.anchors.bell.clone(), surface: 'bronze', gain: 1 }));
  events.sort((first, second) => first.t - second.t);
  return { duration: DURATION, events: events.map(describe) };
};
window.cameraAt = (t) => {
  const state = cameraState(t);
  return { position: state.position.toArray(), target: state.target.toArray(), fov: state.fov };
};

// ---------- clock ----------
const epoch = performance.now();
function frame() {
  const t = Math.min(DURATION, Math.max(0, (performance.now() - epoch) / 1000));
  renderAt(t);
  window.sceneReady = true;
  requestAnimationFrame(frame);
}
if (params.has('t')) {
  renderAt(Number(params.get('t')));
  window.sceneReady = true;
} else {
  requestAnimationFrame(frame);
}
