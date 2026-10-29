// Browse the codepawl/simready-glb dataset and orbit any model. Thumbnails and glb files load straight from the dataset.
// ?base=<url> points at another copy of the dataset files (used to test against a local folder before upload).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const DATASET_BASE = 'https://huggingface.co/datasets/codepawl/simready-glb/resolve/main/';
const SOURCE_BASE = 'https://huggingface.co/datasets/nvidia/simready-assets/tree/main/';
const fileBase = new URLSearchParams(location.search).get('base') ?? DATASET_BASE;
const PAGE_SIZE = 120;
// Thumbnails come from sprite sheets built by batch/thumbs/build_atlas.mjs: sheet n holds assets n*100 to n*100+99
// in assets.json order, 10 per row. One request per sheet instead of one per tile.
const ATLAS_TILES_PER_ROW = 10;
const ATLAS_TILES_PER_SHEET = ATLAS_TILES_PER_ROW * ATLAS_TILES_PER_ROW;

const elements = {
  browse: document.getElementById('browse'),
  detail: document.getElementById('detail'),
  query: document.getElementById('query'),
  category: document.getElementById('category'),
  movingOnly: document.getElementById('moving-only'),
  count: document.getElementById('count'),
  grid: document.getElementById('grid'),
  sentinel: document.getElementById('sentinel'),
  empty: document.getElementById('empty'),
  canvas: document.getElementById('view'),
  stageStatus: document.getElementById('stage-status'),
  assetName: document.getElementById('asset-name'),
  assetCategory: document.getElementById('asset-category'),
  ratioValue: document.getElementById('ratio-value'),
  stats: document.getElementById('stats'),
  download: document.getElementById('download'),
  downloadLabel: document.getElementById('download-label'),
  copyCode: document.getElementById('copy-code'),
  copyLabel: document.getElementById('copy-label'),
  sourceLink: document.getElementById('source-link'),
  parts: document.getElementById('parts'),
  partList: document.getElementById('part-list'),
  partsOpen: document.getElementById('parts-open'),
  partsReset: document.getElementById('parts-reset'),
};

// ---------- data ----------

/** "handTool_hammer_a01" -> "handTool". */
function categoryOf(name) {
  return name.split('_')[0];
}

/** "handTool" -> "Hand tool", "IV" stays "IV". */
function humanize(word) {
  const spaced = word.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  if (spaced === spaced.toUpperCase()) return spaced;
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function toAsset(row, index) {
  const [name, blenderBytes, bytes, blenderTriangles, triangles, blenderDrawCalls, drawCalls, textures, blenderTextureEdge, joints = 0] = row;
  const category = categoryOf(name);
  return {
    index, name, blenderBytes, bytes, blenderTriangles, triangles, blenderDrawCalls, drawCalls, textures, blenderTextureEdge, joints, category,
    searchText: `${name} ${humanize(name.replace(/_/g, ' '))}`.toLowerCase(),
  };
}

const assets = (await (await fetch('./assets.json')).json()).map(toAsset);
const assetsByName = new Map(assets.map((asset) => [asset.name, asset]));

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

const numberFormat = new Intl.NumberFormat('en-US');

/** Fills an element with an asset name that may wrap after each underscore, never inside a word. */
function setBreakableName(element, name) {
  const parts = name.split('_');
  element.replaceChildren();
  parts.forEach((part, index) => {
    element.append(index < parts.length - 1 ? `${part}_` : part);
    if (index < parts.length - 1) element.append(document.createElement('wbr'));
  });
}

function fileUrl(path) {
  return `${fileBase}${path}`;
}

// ---------- browse ----------

function fillCategories() {
  const counts = new Map();
  for (const asset of assets) counts.set(asset.category, (counts.get(asset.category) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
  const options = [`<option value="">All categories</option>`];
  for (const [category, count] of sorted) options.push(`<option value="${category}">${humanize(category)} (${count})</option>`);
  elements.category.innerHTML = options.join('');
}

let filtered = assets;
let shownCount = 0;

function applyFilters() {
  const terms = elements.query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const category = elements.category.value;
  const movingOnly = elements.movingOnly.getAttribute('aria-pressed') === 'true';
  filtered = assets.filter((asset) => (!category || asset.category === category)
    && (!movingOnly || asset.joints > 0)
    && terms.every((term) => asset.searchText.includes(term)));
  elements.count.textContent = `${numberFormat.format(filtered.length)} models`;
  elements.empty.hidden = filtered.length > 0;
  elements.grid.replaceChildren();
  shownCount = 0;
  showMore();
}

function makeTile(asset) {
  const item = document.createElement('li');
  item.className = 'tile';
  const link = document.createElement('a');
  link.href = `#/m/${encodeURIComponent(asset.name)}`;
  link.title = asset.name;
  const image = document.createElement('div');
  image.className = 'thumb';
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', humanize(asset.name.replace(/_/g, ' ')));
  const sheet = Math.floor(asset.index / ATLAS_TILES_PER_SHEET);
  const cell = asset.index % ATLAS_TILES_PER_SHEET;
  const column = cell % ATLAS_TILES_PER_ROW;
  const row = Math.floor(cell / ATLAS_TILES_PER_ROW);
  const step = 100 / (ATLAS_TILES_PER_ROW - 1);
  image.style.backgroundImage = `url(./atlas/${sheet}.webp)`;
  image.style.backgroundPosition = `${column * step}% ${row * step}%`;
  const meta = document.createElement('div');
  meta.className = 'tile-meta';
  const name = document.createElement('span');
  name.className = 'tile-name';
  setBreakableName(name, asset.name);
  const size = document.createElement('span');
  size.className = 'tile-size';
  size.textContent = formatBytes(asset.bytes);
  meta.append(name, size);
  link.append(image, meta);
  item.append(link);
  return item;
}

function showMore() {
  const next = filtered.slice(shownCount, shownCount + PAGE_SIZE);
  elements.grid.append(...next.map(makeTile));
  shownCount += next.length;
}

new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting) && shownCount < filtered.length && !elements.browse.hidden) showMore();
}, { rootMargin: '800px' }).observe(elements.sentinel);

elements.query.addEventListener('input', applyFilters);
elements.category.addEventListener('change', applyFilters);
elements.movingOnly.addEventListener('click', () => {
  const pressed = elements.movingOnly.getAttribute('aria-pressed') === 'true';
  elements.movingOnly.setAttribute('aria-pressed', String(!pressed));
  applyFilters();
});
elements.movingOnly.hidden = !assets.some((asset) => asset.joints > 0);

// ---------- 3D view ----------

let viewer = null;

function createViewer() {
  const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.4);
  keyLight.position.set(3.5, 5.5, 4.5);
  scene.add(keyLight);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, elements.canvas);
  controls.enableDamping = true;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  function resize() {
    const { clientWidth, clientHeight } = elements.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(elements.canvas);

  renderer.setAnimationLoop(() => {
    if (elements.detail.hidden) return;
    controls.update();
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, controls, loader, model: null, loadToken: 0 };
}

function disposeTree(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** Seen from the front-right and a bit above, at a distance that fits the bounding sphere. */
function frameModel(root) {
  const { camera, controls } = viewer;
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.95;
  const direction = new THREE.Vector3(Math.sin(0.61) * Math.cos(0.38), Math.sin(0.38), Math.cos(0.61) * Math.cos(0.38));
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  camera.near = sphere.radius / 100;
  camera.far = sphere.radius * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(sphere.center);
  controls.minDistance = sphere.radius * 0.3;
  controls.maxDistance = sphere.radius * 8;
  controls.update();
}

const FAILED_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4m0 3h.01"/></svg>';

function setStageStatus(state, text) {
  elements.stageStatus.className = `stage-status ${state}`;
  if (state === 'loading') elements.stageStatus.innerHTML = `<span class="spinner"></span><span>${text}</span>`;
  else if (state === 'failed') elements.stageStatus.innerHTML = `${FAILED_ICON}<span>${text}</span>`;
  else elements.stageStatus.replaceChildren();
}

async function loadModel(asset) {
  viewer ??= createViewer();
  const token = ++viewer.loadToken;
  showParts(null);
  if (viewer.model) {
    viewer.scene.remove(viewer.model);
    disposeTree(viewer.model);
    viewer.model = null;
  }
  setStageStatus('loading', 'Loading');
  try {
    const gltf = await viewer.loader.loadAsync(fileUrl(`glb/${encodeURIComponent(asset.name)}.glb`), (event) => {
      if (token !== viewer.loadToken) return;
      const total = event.total || asset.bytes;
      setStageStatus('loading', `Loading ${Math.min(100, Math.round((event.loaded / total) * 100))}%`);
    });
    if (token !== viewer.loadToken) {
      disposeTree(gltf.scene);
      return;
    }
    viewer.model = gltf.scene;
    viewer.scene.add(gltf.scene);
    frameModel(gltf.scene);
    showParts(gltf.scene);
    setStageStatus('done', '');
  } catch (error) {
    if (token !== viewer.loadToken) return;
    console.error(error);
    setStageStatus('failed', 'This model did not load. Try again or download the file.');
  }
}

// ---------- moving parts ----------

// add_physics.mjs mirrors each SimReady joint into the moving part's node extras (three.js userData.joints):
// { type, parent, pivot, axis, min, max, unit } with pivot and axis in scene space at rest. A part's pose is its
// parent's pose times its own joint motion, so a glass pane fixed to a door swings with the door.
const FREE_RANGE = { revolute: [-180, 180], prismatic: [-0.5, 0.5] };

let rig = null;

/** "door_04_obj_00" -> "Door 04", "sm_door1_a01_obj_00" -> "Door1". */
function partLabel(name) {
  return humanize(name.replace(/_obj_\d+$/, '').replace(/^sm_/, '').replace(/_[a-z]\d\d$/, '').replace(/_/g, ' '));
}

function buildRig(model) {
  model.updateMatrixWorld(true);
  const parts = [];
  model.traverse((object) => {
    const joint = object.userData.joints?.find((item) => item.type !== 'fixed') ?? object.userData.joints?.[0];
    if (!joint) return;
    const [low, high] = FREE_RANGE[joint.type] ?? [0, 0];
    parts.push({
      object,
      joint,
      parent: joint.parent ? model.getObjectByName(joint.parent) : null,
      rest: object.matrixWorld.clone(),
      pivot: new THREE.Vector3(...joint.pivot).applyMatrix4(model.matrixWorld),
      axis: new THREE.Vector3(...joint.axis).transformDirection(model.matrixWorld),
      min: joint.min ?? low,
      max: joint.max ?? high,
      value: 0,
      depth: 0,
    });
  });
  for (const part of parts) {
    for (let object = part.object.parent; object; object = object.parent) part.depth += 1;
    part.value = THREE.MathUtils.clamp(0, part.min, part.max);
  }
  parts.sort((first, second) => first.depth - second.depth);
  return { model, parts, byObject: new Map(parts.map((part) => [part.object, part])) };
}

/** Motion of a part in scene space: its parent's motion, then its own joint. */
function partMotion(part, cache) {
  if (cache.has(part)) return cache.get(part);
  const parentPart = part.parent ? rig.byObject.get(part.parent) : null;
  const motion = parentPart ? partMotion(parentPart, cache).clone() : new THREE.Matrix4();
  if (part.joint.type === 'revolute') {
    const rotation = new THREE.Matrix4().makeRotationAxis(part.axis, THREE.MathUtils.degToRad(part.value));
    motion.multiply(new THREE.Matrix4().makeTranslation(part.pivot))
      .multiply(rotation)
      .multiply(new THREE.Matrix4().makeTranslation(part.pivot.clone().negate()));
  } else if (part.joint.type === 'prismatic') {
    motion.multiply(new THREE.Matrix4().makeTranslation(part.axis.clone().multiplyScalar(part.value)));
  }
  cache.set(part, motion);
  return motion;
}

function poseRig() {
  const cache = new Map();
  for (const part of rig.parts) {
    const world = partMotion(part, cache).clone().multiply(part.rest);
    part.object.parent.updateMatrixWorld(true);
    const local = part.object.parent.matrixWorld.clone().invert().multiply(world);
    local.decompose(part.object.position, part.object.quaternion, part.object.scale);
    part.object.updateMatrixWorld(true);
  }
}

function formatJointValue(part) {
  if (part.joint.type === 'revolute') return `${Math.round(part.value)}°`;
  if (part.max - part.min < 0.05) return `${(part.value * 1000).toFixed(1)} mm`;
  return `${Math.round(part.value * 100)} cm`;
}

function showParts(model) {
  rig = model ? buildRig(model) : null;
  const sliders = rig ? rig.parts.filter((part) => part.joint.type === 'revolute' || part.joint.type === 'prismatic') : [];
  elements.parts.hidden = sliders.length === 0;
  elements.partList.replaceChildren(...sliders.map((part, index) => {
    const item = document.createElement('li');
    item.className = 'part';
    const id = `part-${index}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    const name = document.createElement('span');
    name.textContent = partLabel(part.object.name);
    const output = document.createElement('output');
    output.textContent = formatJointValue(part);
    label.append(name, output);
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = part.min;
    input.max = part.max;
    input.step = part.joint.type === 'revolute' ? 1 : 0.001;
    input.value = part.value;
    input.addEventListener('input', () => {
      part.value = Number(input.value);
      output.textContent = formatJointValue(part);
      poseRig();
    });
    part.input = input;
    part.output = output;
    item.append(label, input);
    return item;
  }));
}

function setAllParts(pick) {
  if (!rig) return;
  for (const part of rig.parts) {
    if (!part.input) continue;
    part.value = pick(part);
    part.input.value = part.value;
    part.output.textContent = formatJointValue(part);
  }
  poseRig();
}

elements.partsOpen.addEventListener('click', () => setAllParts((part) => (Math.abs(part.max) >= Math.abs(part.min) ? part.max : part.min)));
elements.partsReset.addEventListener('click', () => setAllParts((part) => THREE.MathUtils.clamp(0, part.min, part.max)));

// ---------- detail page ----------

function statRow(label, before, after) {
  const beforeText = before === null ? '' : `<span class="before">${before} → </span>`;
  return `<dt>${label}</dt><dd>${beforeText}${after}</dd>`;
}

function snippetFor(asset) {
  return [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",
    '',
    'const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);',
    `loader.load('${DATASET_BASE}glb/${asset.name}.glb', (gltf) => scene.add(gltf.scene));`,
  ].join('\n');
}

let currentAsset = null;

function showDetail(asset) {
  currentAsset = asset;
  document.title = `${asset.name} · SimReady GLB Viewer`;
  setBreakableName(elements.assetName, asset.name);
  elements.assetCategory.textContent = humanize(asset.category);
  elements.ratioValue.textContent = `${Math.round(asset.blenderBytes / asset.bytes)}× smaller`;
  elements.stats.innerHTML = [
    statRow('File size', formatBytes(asset.blenderBytes), formatBytes(asset.bytes)),
    statRow('Triangles', numberFormat.format(asset.blenderTriangles), numberFormat.format(asset.triangles)),
    statRow('Draw calls', numberFormat.format(asset.blenderDrawCalls), numberFormat.format(asset.drawCalls)),
    statRow('Textures', null, numberFormat.format(asset.textures)),
    statRow('Largest texture', `${asset.blenderTextureEdge} px`, `${Math.min(asset.blenderTextureEdge, 1024)} px`),
  ].join('');
  elements.download.href = `${DATASET_BASE}glb/${encodeURIComponent(asset.name)}.glb?download=true`;
  elements.downloadLabel.textContent = `Download .glb (${formatBytes(asset.bytes)})`;
  elements.copyLabel.textContent = 'Copy three.js code';
  elements.sourceLink.href = `${SOURCE_BASE}${encodeURIComponent(asset.name)}`;
  loadModel(asset);
}

elements.copyCode.addEventListener('click', async () => {
  if (!currentAsset) return;
  try {
    await navigator.clipboard.writeText(snippetFor(currentAsset));
    elements.copyLabel.textContent = 'Copied';
  } catch {
    elements.copyLabel.textContent = 'Copy blocked by the browser';
  }
});

// ---------- routing ----------

let browseScroll = 0;

function route() {
  const match = location.hash.match(/^#\/m\/(.+)$/);
  const asset = match ? assetsByName.get(decodeURIComponent(match[1])) : null;
  if (asset) {
    if (!elements.browse.hidden) browseScroll = window.scrollY;
    elements.browse.hidden = true;
    elements.detail.hidden = false;
    window.scrollTo(0, 0);
    showDetail(asset);
    return;
  }
  document.title = 'SimReady GLB Viewer';
  elements.detail.hidden = true;
  elements.browse.hidden = false;
  window.scrollTo(0, browseScroll);
}

fillCategories();
applyFilters();
window.addEventListener('hashchange', route);
route();
