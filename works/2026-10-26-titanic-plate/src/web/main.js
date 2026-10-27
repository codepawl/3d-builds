import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PlatePost } from './post.js';
import { buildHull, buildDecks, buildExterior, buildSea, WATERLINE } from './ship.js';
import { buildStage, VOIDS } from './rooms.js';
import { buildFigureGroup, makeRng, makeSpec } from './figures.js';
import { Callouts, CALLOUTS, PEOPLE } from './callouts.js';

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#fff4de', '#8a7a66', 0.55));
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.position.set(134 - 120, 300, 200);
sun.target.position.set(134, 10, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -175, right: 175, top: 130, bottom: -130, near: 10, far: 700 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.12;
scene.add(sun, sun.target);

const stage = buildStage();
const ship = new THREE.Group();
ship.add(buildHull(), buildDecks(stage.deckLayout), buildExterior(), stage.meshes());
scene.add(ship);
scene.add(stage.crowdMeshes());
for (const light of stage.lights) {
  const point = new THREE.PointLight(light.color, light.intensity, 17, 1.8);
  point.position.set(light.x, light.y, light.z);
  scene.add(point);
}
const sea = buildSea();
sea.position.y = WATERLINE;
const seaScene = new THREE.Scene();
seaScene.add(sea);

const camera = new THREE.PerspectiveCamera(24, 1, 40, 2200);
const home = { target: [134, 22, 0], distance: 494, az: 0.3, el: 0.56 };
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 28;
controls.maxDistance = 1500;
controls.minAzimuthAngle = -0.8;
controls.maxAzimuthAngle = 1.1;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.66;

function placeCamera(view) {
  const [tx, ty, tz] = view.target;
  controls.target.set(tx, ty, tz);
  camera.position.set(
    tx + view.distance * Math.sin(view.az) * Math.cos(view.el),
    ty + view.distance * Math.sin(view.el),
    tz + view.distance * Math.cos(view.az) * Math.cos(view.el),
  );
  camera.lookAt(controls.target);
}

let flight = null;
function currentView() {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  return {
    target: controls.target.toArray(),
    distance,
    az: Math.atan2(offset.x, offset.z),
    el: Math.asin(offset.y / distance),
  };
}
function flyTo(view, seconds = 1.5) {
  flight = { from: currentView(), to: view, start: performance.now(), duration: seconds * 1000 };
}
function stepFlight(now) {
  if (!flight) return;
  const t = Math.min(1, (now - flight.start) / flight.duration);
  const eased = t * t * (3 - 2 * t);
  const mix = (a, b) => a + (b - a) * eased;
  placeCamera({
    target: flight.from.target.map((value, i) => mix(value, flight.to.target[i])),
    distance: mix(flight.from.distance, flight.to.distance),
    az: mix(flight.from.az, flight.to.az),
    el: mix(flight.from.el, flight.to.el),
  });
  if (t >= 1) flight = null;
}

const post = new PlatePost(renderer, 8, 8);
post.backdrop = seaScene;

const callouts = new Callouts(document.getElementById('labels'), document.getElementById('leaders'), (data) => {
  callouts.setActive(data);
  flyTo(data.focus);
});
document.getElementById('title').addEventListener('pointerdown', () => flyTo(home));
canvas.addEventListener('pointerdown', () => { flight = null; window.__userMoved = true; });

let viewWidth = 0;
let viewHeight = 0;
function phoneView() {
  return { target: [134, 20, 0], distance: 1060, az: 0.3, el: 0.5 };
}
function resize() {
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(1);
  renderer.setSize(viewWidth * pixelRatio, viewHeight * pixelRatio, false);
  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;
  post.resize(viewWidth * pixelRatio, viewHeight * pixelRatio);
  camera.aspect = viewWidth / viewHeight;
  const phone = viewWidth < 720;
  camera.fov = phone ? 30 : 24;
  if (!flight && !window.__userMoved) placeCamera(phone ? phoneView() : home);
  camera.setViewOffset(viewWidth, viewHeight, phone ? 0 : 55, phone ? 0 : viewHeight * 0.075, viewWidth, viewHeight);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Portraits and the exterior inset, drawn once through the same plate pipeline.
function renderPortraits() {
  const container = document.getElementById('people');
  const heading = document.createElement('h2');
  heading.className = 'people-title';
  heading.textContent = 'People aboard';
  container.appendChild(heading);
  const portraitScene = new THREE.Scene();
  portraitScene.add(new THREE.HemisphereLight('#fff4de', '#9a8a76', 0.9));
  const key = new THREE.DirectionalLight('#fff1d6', 2.6);
  key.position.set(-4, 5, 6);
  const rim = new THREE.DirectionalLight('#ffd9a0', 1.1);
  rim.position.set(5, 3, -4);
  portraitScene.add(key, rim);
  const portraitCamera = new THREE.PerspectiveCamera(11, 0.5, 1, 100);
  portraitCamera.position.set(0, 1.0, 12);
  portraitCamera.lookAt(0, 0.97, 0);
  const portraitPost = new PlatePost(renderer, 300, 600);
  const rng = makeRng(77);
  for (const person of PEOPLE) {
    let spec = makeSpec(person.kind, rng);
    if (person.kind === 'first') {
      while (!spec.woman) spec = makeSpec('first', rng);
    }
    if (person.kind === 'third') {
      while (spec.woman) spec = makeSpec('third', rng);
    }
    const figure = buildFigureGroup(spec, person.kind === 'sailor' ? 'raise' : 'stand', 1.0, true);
    portraitScene.add(figure);
    const item = document.createElement('div');
    item.className = 'person';
    const portrait = document.createElement('canvas');
    portraitPost.renderToCanvas(portraitScene, portraitCamera, portrait, 0.8);
    portraitScene.remove(figure);
    item.appendChild(portrait);
    item.insertAdjacentHTML('beforeend', `<b>${person.name}</b><span>${person.role}</span>`);
    container.appendChild(item);
  }
}

function renderInset() {
  const insetCanvas = document.getElementById('inset');
  const insetPost = new PlatePost(renderer, 520, 240);
  insetPost.backdrop = seaScene;
  const insetCamera = new THREE.PerspectiveCamera(19, 520 / 240, 40, 2200);
  insetCamera.position.set(134 - 40, 70, -470);
  insetCamera.lookAt(134, 22, 0);
  insetPost.renderToCanvas(scene, insetCamera, insetCanvas);
}

function frame(now) {
  stepFlight(now);
  controls.update();
  document.body.classList.toggle('zoomed', camera.position.distanceTo(controls.target) < 250 && viewWidth >= 720 && !window.__keepLabels);
  post.render(scene, camera, null);
  callouts.update(camera, viewWidth, viewHeight, document.getElementById('title').getBoundingClientRect().bottom);
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => {
  renderPortraits();
  renderInset();
  requestAnimationFrame(frame);
  window.plate = {
    ready: true,
    peopleCount: stage.crowd.count,
    floatingFigures: (raw = false, limit = 12) => stage.floatingFigures(raw, limit),
    lights: stage.lights.length,
    // test hooks used by tools/shoot.mjs and tools/record-reel.mjs
    view: (view) => { window.__userMoved = true; flight = null; placeCamera(view); },
    focusOf: (id) => CALLOUTS.find((entry) => entry.id === id).focus,
    homeView: () => ({ ...home }),
    flyTo: (id, seconds = 0.01) => {
      const data = CALLOUTS.find((entry) => entry.id === id);
      callouts.setActive(data);
      flyTo(data.focus, seconds);
    },
    home: () => { window.__userMoved = true; flight = null; placeCamera(home); },
    orbit: (degrees) => {
      const view = currentView();
      view.az += (degrees * Math.PI) / 180;
      window.__userMoved = true;
      flight = null;
      placeCamera(view);
    },
    keepLabels: (on) => { window.__keepLabels = on; },
    // samples the anchors' screen positions along the planned orbit, so the frozen slot order is the best for all of it
    lockLabels: (on, views = null) => {
      if (!on || !views) { callouts.lock(on); return; }
      const saved = currentView();
      const samples = views.map((view) => {
        placeCamera(view);
        camera.updateMatrixWorld();
        return callouts.items.map((item) => {
          const point = new THREE.Vector3(...item.data.anchor).project(camera);
          return { x: (point.x * 0.5 + 0.5) * viewWidth, y: (-point.y * 0.5 + 0.5) * viewHeight };
        });
      });
      placeCamera(saved);
      camera.updateMatrixWorld();
      callouts.lock(true, samples);
    },
    labelCrossings: () => callouts.crossings(),
    setUiOpacity: (value) => document.body.style.setProperty('--ui', String(value)),
  };
});
