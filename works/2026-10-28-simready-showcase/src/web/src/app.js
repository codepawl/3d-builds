// SimReady showcase: five real NVIDIA SimReady assets in one three.js scene, shown through ASCII and 1-bit dither at once.
// Every frame is a function of the (virtual) clock and of the clicks, drags and key presses the page has received.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { AsciiPass, FONT_FAMILY } from './ascii.js';
import { Compositor } from './composite.js';
import { loadAssets, ASSET_DEFS, JAW_TRAVEL } from './assets.js';
import { SHOTS, WIDTH, HEIGHT } from './shots.js';

const FRAME_SECONDS = 1 / 30;
const DISSOLVE_SECONDS = 0.6;
const RAIL_SHIFT_PX = 190; // the 3D view centres in the space right of the rail
const ASCII_CELL = { width: 8, height: 15 };
const GRAB_RADIUS_PX = 130;
const DRAG_PX_FOR_FULL_TRAVEL = 380;
const FLIP_SECONDS = 0.8;

const query = new URLSearchParams(location.search);
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const easeInOut = (value) => { const x = clamp01(value); return x * x * (3 - 2 * x); };

async function loadFonts() {
  const bold = new FontFace(FONT_FAMILY, 'url(./fonts/JetBrainsMono-Bold.woff2)', { weight: '700' });
  const mono = new FontFace('JetBrainsMono', 'url(./fonts/JetBrainsMono-Bold.woff2)', { weight: '100 900' });
  await Promise.all([bold.load(), mono.load()]);
  document.fonts.add(bold);
  document.fonts.add(mono);
}

function makeRenderer() {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}

function makeScene(assets) {
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff2e0, 3.4);
  key.position.set(3.5, 5.5, 4.5);
  const rim = new THREE.DirectionalLight(0xc8d4ff, 1.4);
  rim.position.set(-4, 3, -4);
  scene.add(key, rim);
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.08, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.55, metalness: 0.2 }),
  );
  shelf.position.y = -0.04;
  scene.add(shelf);
  for (const asset of assets) scene.add(asset.holder);
  return { scene, shelf };
}

function buildRail(onSelect) {
  const rail = document.getElementById('rail');
  const rows = new Map();
  const entries = [
    ...ASSET_DEFS.map((definition) => ({ id: definition.id, name: definition.label, meta: `${definition.megabytes} MB  ·  ${definition.triangles} tris` })),
    { id: 'lineup', name: 'all five', meta: '5 assets  ·  one shelf' },
  ];
  for (const entry of entries) {
    const row = document.createElement('button');
    row.className = 'row';
    row.dataset.asset = entry.id;
    row.innerHTML = `<span class="marker"></span><span class="name">${entry.name}</span><span class="meta">${entry.meta}</span>`;
    row.addEventListener('click', () => onSelect(entry.id));
    rail.append(row);
    rows.set(entry.id, row);
  }
  return rows;
}

async function main() {
  await loadFonts();
  const renderer = makeRenderer();
  const assets = await loadAssets('./');
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const { scene, shelf } = makeScene(assets);

  const environment = await new HDRLoader().loadAsync('./assets/lilienstein_2k.hdr');
  environment.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environment;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 80);
  camera.layers.enable(1);
  camera.layers.enable(2);
  camera.setViewOffset(WIDTH, HEIGHT, -RAIL_SHIFT_PX, 0, WIDTH, HEIGHT);

  const rawTarget = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType, samples: 4 });
  const makeFrameTarget = () => new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.UnsignedByteType });
  const frameTargets = { previous: makeFrameTarget(), current: makeFrameTarget(), ascii: makeFrameTarget() };
  const ascii = new AsciiPass(renderer);
  ascii.resize(WIDTH, HEIGHT, ASCII_CELL.width, ASCII_CELL.height);
  ascii.material.uniforms.uExposure.value = Number(query.get('asciiExposure') ?? 2.2);
  const compositor = new Compositor(renderer, WIDTH, HEIGHT);
  compositor.composite.material.uniforms.uExposure.value = Number(query.get('exposure') ?? 1.0);
  const effectObjects = assets.flatMap((asset) => asset.effects);

  const state = {
    clock: 0,
    current: { shotId: 'v8', start: 0 },
    previous: null,
    dissolveStart: -10,
    spinStart: null,
    flipped: false,
    flipStart: -10,
    viseDrag: null,
    viseGrabbed: false,
    handleScreen: [0, 0],
  };
  const pointer = { x: 1500, y: 700, smoothedX: 1500 };
  const stateEvents = [];
  const rows = buildRail(select);

  function select(shotId) {
    if (shotId === state.current.shotId) return;
    state.previous = { ...state.current };
    state.current = { shotId, start: state.clock };
    state.dissolveStart = state.clock;
    if (shotId === 'fan') assetById.get('fan').setSpinning(true);
    if (shotId === 'lineup') {
      assetById.get('fan').setSpinning(true);
      assetById.get('turbo').setSpinning(true);
    }
    stateEvents.push({ time: state.clock, kind: 'select', target: shotId });
  }

  document.getElementById('spin').addEventListener('click', () => {
    assetById.get('turbo').setSpinning(true);
    state.spinStart = state.clock;
    stateEvents.push({ time: state.clock, kind: 'spin', target: 'turbo' });
  });

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    state.flipped = !state.flipped;
    state.flipStart = state.clock;
  });

  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!state.viseDrag) return;
    const travel = ((event.clientX - state.viseDrag.startX) / DRAG_PX_FOR_FULL_TRAVEL) * JAW_TRAVEL;
    assetById.get('vise').jawTarget = Math.min(JAW_TRAVEL, Math.max(0, state.viseDrag.startJaw + travel));
  });
  window.addEventListener('pointerdown', (event) => {
    if (state.current.shotId !== 'vise') return;
    const distance = Math.hypot(event.clientX - state.handleScreen[0], event.clientY - state.handleScreen[1]);
    if (distance > GRAB_RADIUS_PX) return;
    state.viseDrag = { startX: event.clientX, startJaw: assetById.get('vise').jawTarget };
    state.viseGrabbed = true;
    stateEvents.push({ time: state.clock, kind: 'grab', target: 'vise.handle' });
  });
  window.addEventListener('pointerup', () => { state.viseDrag = null; });

  const worldPoint = new THREE.Vector3();
  const projectPart = (assetId, partName) => {
    assetById.get(assetId).part(partName).getWorldPosition(worldPoint);
    worldPoint.project(camera);
    return [(worldPoint.x * 0.5 + 0.5) * WIDTH, (1 - (worldPoint.y * 0.5 + 0.5)) * HEIGHT];
  };

  function applyLayout(shot) {
    shelf.visible = Boolean(shot.shelf);
    for (const asset of assets) {
      const placement = shot.assets[asset.id];
      asset.holder.visible = Boolean(placement);
      if (!placement) continue;
      asset.holder.position.fromArray(placement.position);
      asset.holder.scale.setScalar(placement.fitHeight ? placement.fitHeight / asset.height : placement.scale);
    }
  }

  function flipAmount() {
    const progress = easeInOut((state.clock - state.flipStart) / FLIP_SECONDS);
    return state.flipped ? progress : 1 - progress;
  }

  function renderShot(shotId, shotStart, target) {
    const shot = SHOTS[shotId];
    const time = Math.max(0, state.clock - shotStart);
    applyLayout(shot);
    shot.camera(time, camera, shot.subject ? assetById.get(shot.subject).height : 1);
    camera.updateMatrixWorld(true);
    renderer.setRenderTarget(rawTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    ascii.render(scene, camera, effectObjects, frameTargets.ascii);
    const wipe = shot.wipe({
      time,
      pointer,
      spinAge: state.spinStart === null ? -1 : state.clock - state.spinStart,
      project: projectPart,
    });
    compositor.mix(rawTarget.texture, frameTargets.ascii.texture, wipe, flipAmount(), target);
  }

  const actionsByAsset = [...document.querySelectorAll('[data-for]')];
  const grabTag = document.getElementById('grab');
  const endCard = document.getElementById('endcard');
  const dimmer = document.getElementById('dimmer');

  function updateInterface() {
    const shotId = state.current.shotId;
    for (const [id, row] of rows) row.classList.toggle('selected', id === shotId);
    for (const element of actionsByAsset) {
      const visible = element.dataset.for === shotId && !(element.id === 'spin' && state.spinStart !== null);
      element.classList.toggle('visible', visible);
    }
    const showGrab = shotId === 'vise' && !state.viseGrabbed && state.clock - state.current.start > 0.8;
    grabTag.style.display = showGrab ? 'block' : 'none';
    if (showGrab) {
      grabTag.style.left = `${state.handleScreen[0]}px`;
      grabTag.style.top = `${state.handleScreen[1]}px`;
    }
    const cardAge = shotId === 'lineup' ? state.clock - state.current.start : -1;
    const cardAmount = easeInOut((cardAge - 1.4) / 0.45);
    endCard.style.opacity = String(cardAmount);
    dimmer.style.opacity = String(cardAmount * 0.72);
  }

  function renderFrame() {
    const dissolveProgress = (state.clock - state.dissolveStart) / DISSOLVE_SECONDS;
    if (state.previous && dissolveProgress < 1) renderShot(state.previous.shotId, state.previous.start, frameTargets.previous);
    renderShot(state.current.shotId, state.current.start, frameTargets.current);
    if (state.current.shotId === 'vise') state.handleScreen = projectPart('vise', 'handle_01_obj_00');
    renderer.setRenderTarget(null);
    const amount = state.previous && dissolveProgress < 1 ? easeInOut(dissolveProgress) : 1;
    compositor.blend(frameTargets.previous.texture, frameTargets.current.texture, amount, null);
    updateInterface();
  }

  function step(deltaSeconds) {
    state.clock += deltaSeconds;
    pointer.smoothedX += (pointer.x - pointer.smoothedX) * 0.2;
    for (const asset of assets) asset.advance(deltaSeconds);
  }

  if (query.has('shot')) {
    state.current = { shotId: query.get('shot'), start: -Number(query.get('at') ?? 1) };
    if (query.has('spin')) {
      state.spinStart = -Number(query.get('spin'));
      for (const asset of assets) { asset.setSpinning(true); asset.spinBlend = 1; }
    }
  }

  // Warm up shaders and textures for every shot before the film starts.
  for (const shotId of Object.keys(SHOTS)) renderShot(shotId, 0, frameTargets.current);
  state.clock = 0;

  window.__app = {
    state,
    stateEvents,
    pointer,
    rowPoint(id) {
      const box = rows.get(id).getBoundingClientRect();
      return [box.x + box.width / 2, box.y + box.height / 2];
    },
    handlePoint: () => state.handleScreen,
    heights: Object.fromEntries(assets.map((asset) => [asset.id, asset.height])),
  };

  let lastTime = null;
  function loop(timeMs) {
    const now = timeMs / 1000;
    const deltaSeconds = lastTime === null ? FRAME_SECONDS : Math.min(now - lastTime, 0.1);
    lastTime = now;
    step(deltaSeconds);
    renderFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__ready = true;
}

main().catch((error) => {
  console.error(error);
  document.title = `ERROR ${error.message}`;
  window.__error = String(error.stack ?? error);
});
