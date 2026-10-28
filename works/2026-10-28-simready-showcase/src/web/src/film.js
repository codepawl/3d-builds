// SimReady optimized: a before and after comparison on a virtual clock. Models are clean lit PBR on a transparent
// canvas; the dither and ASCII backdrop sits behind them on its own canvas, so no model goes through either pass.
// Every number on screen is read from web/data/*.json (measured), never typed here.
// "As shipped" V8 (an 888 MB glb that cannot share a page with a second model) is shown from stills captured in real
// Chrome (web/captures); the optimized side is rendered live from the same camera.
import * as THREE from 'three';
import { Backdrop } from './backdrop.js';
import { makeStudioRenderer, loadEnvironment, makeStudioScene, makeLoader, frameBox, WIDTH, HEIGHT, FIELD_OF_VIEW } from './studio.js';
import { SCRIPT, REPO_NAME } from './script.js';
import { LOGOS } from './logos.js';

const FRAME_SECONDS = 1 / 30;
const FONT_FAMILY = 'JetBrainsMono';
const V8_ZOOM = 0.9; // measure_load.mjs captures the raw V8 with the same zoom, yaw and elevation
const V8_SCALE = 0.66; // the V8 is drawn at this fraction of the captured size, raw stills and live model alike
const V8_CENTRE = [620, 450];
const ORBIT_DEGREES_PER_SECOND = 4;
const ORBIT_START_YAW = -30;
const ORBIT_SECONDS = 5.5; // the orbit runs at full speed this long after the progress beat starts, then eases to a stop
const ORBIT_STOP_SECONDS = 1.8;
const STEP_STAGE = [0, 1, 3, 4]; // step click -> index in stages_v8.json (blender, instances, weld, textures, meshopt)
const HORIZON = [790, 800, 640, 700]; // per beat: alternator slider, progress, whole set, end card
const COUNT_SECONDS = 0.9; // how long a panel takes to count to its new numbers after a click
const HF_FOLDER_LABEL = 'HF folder 1.7 GB'; // the V8 folder on Hugging Face (topic.md); the other numbers come from web/data
const TRACK_STAGES = 6; // NVIDIA original, Blender glb, three optimization steps, ours
const STEP_NAMES = ['export to glb', 'dedupe instances', 'textures to WebP', 'meshopt geometry'];

// the set beat: one small camera per cell, so models never overlap and every one is shown at one scale
const SET_COLUMNS = 4;
const SET_CELL = { x: 630, y: 45, width: 315, height: 330 };
const SET_UNIT_PX = 270; // one unit of model height is this many pixels tall
const SET_MAX_WIDTH_PX = 275;
const SET_FOV = 14;
const SET_YAWS = [20, 28, 36];

const query = new URLSearchParams(location.search);
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
const lerp = (from, to, amount) => from + (to - from) * amount;
const byId = (id) => document.getElementById(id);

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e7) return `${Math.round(bytes / 1e6)} MB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}
const formatCount = (value) => (value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${Math.round(value / 1e3)}k` : String(Math.round(value)));
const formatSeconds = (milliseconds) => `${(milliseconds / 1000).toFixed(2)} s`;

const STEP_ICON_ATTRIBUTES = 'class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
// line icons for the pipeline steps: copy (dedupe instances), image (textures), cube (geometry)
const STEP_ICONS = [
  `<svg ${STEP_ICON_ATTRIBUTES}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
  `<svg ${STEP_ICON_ATTRIBUTES}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/></svg>`,
  `<svg ${STEP_ICON_ATTRIBUTES}><path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/></svg>`,
];

const ICONS = {
  pass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#7be08a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5L17 9"/></svg>',
  slow: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#f2b84b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  open: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>',
  forward: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M2 5l9 7-9 7zM12 5l9 7-9 7z"/></svg>',
};

async function loadFonts() {
  const face = new FontFace(FONT_FAMILY, 'url(./fonts/JetBrainsMono-Bold.woff2)', { weight: '100 900' });
  await face.load();
  document.fonts.add(face);
}

function makeBayerPattern() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext('2d');
  context.fillStyle = '#e9e5d8';
  context.fillRect(0, 0, 1, 1);
  context.fillRect(1, 1, 1, 1);
  document.documentElement.style.setProperty('--bayer', `url(${canvas.toDataURL()})`);
}

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
const SHADOW = shadowTexture();

function addContactShadow(parent, box, scale = 1.7) {
  const size = box.getSize(new THREE.Vector3());
  const side = Math.max(size.x, size.z) * scale;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(side, side),
    new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthWrite: false, toneMapped: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  const centre = box.getCenter(new THREE.Vector3());
  shadow.position.set(centre.x, box.min.y + 0.002, centre.z);
  parent.add(shadow);
}

/** Horizontal extent (world units) of a box as seen from a camera at this yaw. */
function widthAtYaw(box, yawDegrees) {
  const yaw = THREE.MathUtils.degToRad(yawDegrees);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  let low = Infinity;
  let high = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const z of [box.min.z, box.max.z]) {
      const along = new THREE.Vector3(x, 0, z).dot(right);
      low = Math.min(low, along);
      high = Math.max(high, along);
    }
  }
  return high - low;
}

async function main() {
  await loadFonts();
  makeBayerPattern();
  const [stagesFile, loadTimes, totals, setFile, alternatorFile] = await Promise.all(
    ['stages_v8', 'load_times', 'totals', 'set', 'opt_alternator'].map((name) => fetch(`./data/${name}.json`).then((response) => response.json())),
  );
  const stages = stagesFile.stages;
  const rawFirstFrameMs = loadTimes.v8_raw.medianFirstFrameMs;
  const optFirstFrameMs = loadTimes.v8_opt.medianFirstFrameMs;

  const renderer = makeStudioRenderer(byId('view'));
  const backdrop = new Backdrop(byId('backdrop'), WIDTH, HEIGHT, FONT_FAMILY);
  const beforeContext = byId('before').getContext('2d');
  const environment = await loadEnvironment();
  const loader = makeLoader();

  async function loadInto(scene, url) {
    const gltf = await loader.loadAsync(url);
    scene.add(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    addContactShadow(scene, box);
    return { object: gltf.scene, box };
  }
  const sceneV8 = makeStudioScene(environment);
  const v8 = await loadInto(sceneV8, 'models/v8.opt.glb');
  const sceneAlternatorRaw = makeStudioScene(environment);
  await loadInto(sceneAlternatorRaw, 'models/test/electricalSystem_alternator_d01.blender.glb');
  const sceneAlternatorOpt = makeStudioScene(environment);
  const alternatorOpt = await loadInto(sceneAlternatorOpt, 'models/test/electricalSystem_alternator_d01.glb');

  // ---- the whole set: every model fitted to one scale and shown in its own cell
  const sceneSet = makeStudioScene(environment);
  const setModels = [];
  const setCamera = new THREE.PerspectiveCamera(SET_FOV, SET_CELL.width / SET_CELL.height);
  const setDistance = SET_CELL.height / 2 / Math.tan(THREE.MathUtils.degToRad(SET_FOV / 2)) / SET_UNIT_PX;
  const maxWidthUnits = SET_MAX_WIDTH_PX / SET_UNIT_PX;
  for (const [index, entry] of setFile.models.entries()) {
    const gltf = await loader.loadAsync(entry.file);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const widest = Math.max(...SET_YAWS.map((yaw) => widthAtYaw(box, yaw)));
    const scale = Math.min(1 / size.y, maxWidthUnits / widest);
    const holder = new THREE.Group();
    gltf.scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const inner = new THREE.Group();
    inner.add(gltf.scene);
    inner.scale.setScalar(scale);
    holder.add(inner);
    addContactShadow(holder, new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 0.01, 0.3)));
    holder.visible = false;
    holder.userData = { index, asset: entry.asset, heightUnits: size.y * scale };
    sceneSet.add(holder);
    setModels.push(holder);
  }
  function frameSetCamera(yawDegrees) {
    const yaw = THREE.MathUtils.degToRad(yawDegrees);
    const elevation = THREE.MathUtils.degToRad(12);
    const target = new THREE.Vector3(0, 0.5, 0);
    setCamera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elevation) * setDistance,
      target.y + Math.sin(elevation) * setDistance,
      target.z + Math.cos(yaw) * Math.cos(elevation) * setDistance,
    );
    setCamera.near = 0.1;
    setCamera.far = 50;
    setCamera.updateProjectionMatrix();
    setCamera.lookAt(target);
  }
  // measured pixel size of each set model in its cell, for the self-review (window.__setMetrics)
  window.__setMetrics = [];
  for (const yaw of SET_YAWS) {
    frameSetCamera(yaw);
    setCamera.updateMatrixWorld();
    for (const holder of setModels) {
      const box = new THREE.Box3().setFromObject(holder.children[0]);
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(setCamera);
            left = Math.min(left, point.x); right = Math.max(right, point.x);
            top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
          }
        }
      }
      window.__setMetrics.push({
        asset: holder.userData.asset, yaw,
        widthPx: Math.round(((right - left) / 2) * SET_CELL.width),
        heightPx: Math.round(((bottom - top) / 2) * SET_CELL.height),
      });
    }
  }

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, WIDTH / HEIGHT);

  // ---- state: a function of the virtual clock and of the inputs the page has received
  const events = { steps: SCRIPT.stepClicks.map(() => null), grab: null, key: null, set: null };
  const state = { clock: 0, sliderX: SCRIPT.handleStartX, sliderTarget: SCRIPT.handleStartX, dragging: false };
  const stateEvents = [];
  const mark = (kind, target) => stateEvents.push({ time: state.clock, kind, target });

  byId('setBtn').addEventListener('click', () => { if (events.set === null) { events.set = state.clock; mark('set', 'all'); } });
  const stepsHost = byId('steps');
  const stepDeltas = [
    `${HF_FOLDER_LABEL.replace('HF folder ', '')} → ${formatBytes(stages[0].bytes)}`,
    `-${formatCount(stages[0].triangles - stages[1].triangles)} triangles`,
    `-${formatBytes(stages[1].bytes - stages[3].bytes)}`,
    `-${formatBytes(stages[3].bytes - stages[4].bytes)}`,
  ];
  STEP_NAMES.forEach((name, index) => {
    const button = document.createElement('button');
    button.className = 'step';
    button.dataset.step = String(index);
    button.innerHTML = `<span class="mark">${ICONS.open}</span>${index === 0 ? LOGOS.blender : STEP_ICONS[index - 1]}<span>${name}</span><span class="delta">${stepDeltas[index]}</span>`;
    button.addEventListener('click', () => {
      if (events.steps[index] === null && (index === 0 || events.steps[index - 1] !== null)) { events.steps[index] = state.clock; mark('step', String(index)); }
    });
    stepsHost.append(button);
  });
  const handle = byId('handle');
  handle.addEventListener('pointerdown', () => { state.dragging = true; if (events.grab === null) events.grab = state.clock; });
  window.addEventListener('pointermove', (event) => { if (state.dragging) state.sliderTarget = Math.min(1700, Math.max(220, event.clientX)); });
  window.addEventListener('pointerup', () => { state.dragging = false; });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (events.key === null) { events.key = state.clock; mark('key', 'Space'); }
  });

  function sliderAt(time) {
    let frame = (time - SCRIPT.grab) * 30;
    let position = SCRIPT.handleStartX;
    if (frame <= 0) return position;
    for (const segment of SCRIPT.dragSegments) {
      if (segment.hold !== undefined) {
        frame -= segment.hold;
        if (frame <= 0) return position;
        continue;
      }
      if (frame < segment.frames) return lerp(position, segment.to, smooth(frame / segment.frames));
      frame -= segment.frames;
      position = segment.to;
    }
    return position;
  }

  function seek(time) {
    state.clock = time;
    events.steps = SCRIPT.stepClicks.map((click) => (time >= click ? click : null));
    events.grab = time >= SCRIPT.grab ? SCRIPT.grab : null;
    events.key = time >= SCRIPT.closeupKey ? SCRIPT.closeupKey : null;
    events.set = time >= SCRIPT.setClick ? SCRIPT.setClick : null;
    state.sliderX = sliderAt(time);
    state.sliderTarget = state.sliderX;
  }

  // ---- the raw V8, from stills captured in real Chrome (transparent, an orbit starting at the first frame)
  const frameCache = new Map();
  const progressStart = SCRIPT.beats[1];
  const lastStepIndex = SCRIPT.stepClicks.length - 1;
  /** Orbit time: full speed for ORBIT_SECONDS after the progress beat starts, then an exponential ease toward a stop. */
  function orbitTime(time) {
    const since = Math.max(0, time - progressStart);
    if (since <= ORBIT_SECONDS) return since;
    return ORBIT_SECONDS + ORBIT_STOP_SECONDS * (1 - Math.exp(-(since - ORBIT_SECONDS) / ORBIT_STOP_SECONDS));
  }
  const orbitFrameIndex = (time) => Math.min(loadTimes.orbitFrames - 1, Math.max(0, Math.round(orbitTime(time) * 30)));
  async function ensureFrame(index) {
    if (frameCache.has(index)) return;
    const image = new Image();
    image.src = `./captures/v8raw_${String(index).padStart(3, '0')}.png`;
    await image.decode();
    frameCache.set(index, image);
    if (frameCache.size > 6) frameCache.delete(frameCache.keys().next().value);
  }
  /** The optimized model fades in over the raw stills once the last step has run: same camera, same pixels. */
  const liveAmount = (time) => (events.steps[lastStepIndex] === null ? 0 : smooth((time - SCRIPT.stepClicks[lastStepIndex] - 0.3) / 0.8));
  async function prepare(time) {
    if (time >= progressStart && time < SCRIPT.beats[2]) await ensureFrame(orbitFrameIndex(time));
  }

  const beatOf = (time) => SCRIPT.beats.filter((start) => time >= start).length - 1;

  function placeCamera(time, beat) {
    camera.clearViewOffset();
    if (beat === 1) {
      frameBox(camera, v8.box, ORBIT_START_YAW + orbitTime(time) * ORBIT_DEGREES_PER_SECOND, 14, V8_ZOOM);
      const fullWidth = WIDTH * V8_SCALE;
      const fullHeight = HEIGHT * V8_SCALE;
      camera.setViewOffset(fullWidth, fullHeight, fullWidth / 2 - V8_CENTRE[0], fullHeight / 2 - V8_CENTRE[1], WIDTH, HEIGHT);
    } else if (beat === 0) {
      const closeup = events.key === null ? 0 : smooth((time - events.key) / 1.3);
      const size = alternatorOpt.box.getSize(new THREE.Vector3());
      const shift = new THREE.Vector3(size.x * 0.02 * closeup, size.y * (-0.1 + 0.04 * closeup), 0);
      const sinceBeat = time - SCRIPT.beats[0];
      frameBox(camera, alternatorOpt.box, 30 - (sinceBeat + 1.2) * 3 - closeup * 14, 18 - closeup * 4, 1.45 + closeup * 0.5, shift);
    }
  }

  function renderView(time, beat) {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.clear();
    byId('view').style.opacity = '1';
    if (beat === 1) {
      byId('view').style.opacity = String(liveAmount(time));
      if (liveAmount(time) > 0) renderer.render(sceneV8, camera);
    } else if (beat === 0) {
      renderer.setScissorTest(true);
      const split = Math.round(state.sliderX);
      renderer.setScissor(0, 0, split, HEIGHT);
      renderer.render(sceneAlternatorRaw, camera);
      renderer.setScissor(split, 0, WIDTH - split, HEIGHT);
      renderer.render(sceneAlternatorOpt, camera);
      renderer.setScissorTest(false);
    } else if (beat === 2) {
      const sinceSet = events.set === null ? -1 : time - events.set;
      frameSetCamera(28 + 8 * Math.sin((time - SCRIPT.beats[2]) * 0.9));
      renderer.setScissorTest(true);
      for (const holder of setModels) {
        const age = sinceSet - 0.35 - holder.userData.index * 0.1;
        const grow = smooth(age / 0.6);
        for (const other of setModels) other.visible = false;
        if (grow <= 0.001) continue;
        holder.visible = true;
        holder.scale.setScalar(0.2 + 0.8 * grow);
        const column = holder.userData.index % SET_COLUMNS;
        const row = Math.floor(holder.userData.index / SET_COLUMNS);
        const left = SET_CELL.x + column * SET_CELL.width;
        const bottom = HEIGHT - (SET_CELL.y + (row + 1) * SET_CELL.height);
        renderer.setViewport(left, bottom, SET_CELL.width, SET_CELL.height);
        renderer.setScissor(left, bottom, SET_CELL.width, SET_CELL.height);
        renderer.render(sceneSet, setCamera);
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, WIDTH, HEIGHT);
    }
  }

  function drawBefore(time, beat) {
    beforeContext.clearRect(0, 0, WIDTH, HEIGHT);
    if (beat !== 1) return;
    const image = frameCache.get(orbitFrameIndex(time));
    if (!image) return;
    beforeContext.drawImage(image, V8_CENTRE[0] - (WIDTH / 2) * V8_SCALE, V8_CENTRE[1] - (HEIGHT / 2) * V8_SCALE, WIDTH * V8_SCALE, HEIGHT * V8_SCALE);
  }

  // ---- interface
  const pages = { 0: byId('pageVise'), 1: byId('pageProgress'), 2: byId('pageSet'), 3: byId('pageEnd') };
  const stat = (stage) => ({
    bytes: stage.bytes, triangles: stage.triangles, drawCalls: stage.drawCalls, textures: stage.textures,
    edge: stage.largestTextureEdge, texturePixels: stage.textures * stage.largestTextureEdge ** 2,
  });
  const countAmount = (click, time) => (click === null ? 0 : smooth((time - click) / COUNT_SECONDS));

  /** The optimized column's numbers, walked through the pipeline steps by the clicks (step 0 is the export). */
  function optimizedStats(time) {
    let from = 0;
    let to = 0;
    let started = -99;
    SCRIPT.stepClicks.forEach((click, index) => {
      if (index >= 1 && events.steps[index] !== null && time >= events.steps[index]) { from = to; to = STEP_STAGE[index]; started = events.steps[index]; }
    });
    const amount = smooth((time - started) / COUNT_SECONDS);
    const before = stat(stages[from]);
    const after = stat(stages[to]);
    const mix = (key) => lerp(before[key], after[key], amount);
    return {
      bytes: mix('bytes'), triangles: mix('triangles'), drawCalls: mix('drawCalls'), textures: Math.round(mix('textures')),
      edge: amount > 0.5 ? after.edge : before.edge, texturePixels: mix('texturePixels'),
      settled: events.steps[lastStepIndex] !== null && time - events.steps[lastStepIndex] >= COUNT_SECONDS,
    };
  }

  const percentLess = (now, before) => {
    const percent = Math.round((1 - now / before) * 100);
    return percent >= 1 ? `-${percent}%` : '';
  };

  function columnHtml(rows) {
    return rows.map((row) => `<div class="row ${row.className ?? ''}"><span class="label">${row.label}</span><span class="value">${row.value}</span><span class="delta">${row.delta ?? ''}</span></div>`).join('');
  }

  // ---- the progress track: NVIDIA original -> Blender glb -> three optimization steps -> ours
  const trackNodes = [
    { logo: LOGOS.nvidia, name: 'NVIDIA original', sub: HF_FOLDER_LABEL },
    { logo: LOGOS.blender, name: 'Blender glb', sub: `${formatBytes(stages[0].bytes)}, ${formatSeconds(rawFirstFrameMs)}` },
    { logo: '', name: STEP_NAMES[1], sub: stepDeltas[1] },
    { logo: '', name: STEP_NAMES[2], sub: stepDeltas[2] },
    { logo: '', name: STEP_NAMES[3], sub: stepDeltas[3] },
    { logo: '', name: 'ours', sub: `${formatBytes(stages[4].bytes)}, ${formatSeconds(optFirstFrameMs)}` },
  ];
  const trackHost = byId('trackNodes');
  const trackMarks = trackNodes.map((node) => {
    const element = document.createElement('div');
    element.className = 'node';
    element.innerHTML = `<span class="mark"></span><span class="name">${node.logo}<span>${node.name}</span></span><span class="sub">${node.sub}</span>`;
    trackHost.append(element);
    return { element, mark: element.querySelector('.mark'), lit: null };
  });

  /** Track position in stages: each click moves one stage along while its numbers count; "ours" arrives after the last count. */
  function trackProgress(time) {
    let position = 0;
    for (const click of events.steps) position += countAmount(click, time);
    const last = events.steps[lastStepIndex];
    if (last !== null) position += smooth((time - last - COUNT_SECONDS) / 0.7);
    return position;
  }

  function updateProgressPage(time) {
    const raw = stat(stages[0]);
    const optimized = optimizedStats(time);
    const exported = events.steps[0] !== null;
    const optimizing = events.steps[1] !== null;
    const rawAmount = countAmount(events.steps[0], time);
    const textures = (value) => `${value.textures} × ${value.edge}<small>px</small>`;
    const rawDim = exported ? '' : 'dim';
    const optDim = optimizing ? '' : 'dim';
    const dash = '-';
    const rawLoaded = exported && rawAmount >= 1;

    byId('colRaw').innerHTML = columnHtml([
      { label: 'size', value: formatBytes(raw.bytes * rawAmount), className: rawDim },
      { label: 'triangles', value: formatCount(raw.triangles * rawAmount), className: rawDim },
      { label: 'draw calls', value: String(Math.round(raw.drawCalls * rawAmount)), className: rawDim },
      { label: 'textures', value: textures({ textures: Math.round(raw.textures * rawAmount), edge: raw.edge }), className: rawDim },
      { label: 'first frame', value: exported ? formatSeconds(rawFirstFrameMs * rawAmount) : dash, className: rawLoaded ? 'slow' : rawDim },
    ]);
    const changed = (now, before) => (optimizing && now < before ? 'hot' : '');
    byId('colOpt').innerHTML = columnHtml([
      { label: 'size', value: formatBytes(optimized.bytes), className: optDim || changed(optimized.bytes, raw.bytes), delta: optimizing ? percentLess(optimized.bytes, raw.bytes) : '' },
      { label: 'triangles', value: formatCount(optimized.triangles), className: optDim || changed(optimized.triangles, raw.triangles), delta: optimizing ? percentLess(optimized.triangles, raw.triangles) : '' },
      { label: 'draw calls', value: String(Math.round(optimized.drawCalls)), className: optDim || changed(optimized.drawCalls, raw.drawCalls), delta: optimizing ? percentLess(optimized.drawCalls, raw.drawCalls) : '' },
      { label: 'textures', value: textures(optimized), className: optDim || changed(optimized.texturePixels, raw.texturePixels), delta: optimizing ? percentLess(optimized.texturePixels, raw.texturePixels) : '' },
      { label: 'first frame', value: optimized.settled ? formatSeconds(optFirstFrameMs) : dash, className: optimized.settled ? 'hot' : optDim, delta: optimized.settled ? `${(rawFirstFrameMs / optFirstFrameMs).toFixed(0)}× faster` : '' },
    ]);
    byId('headRaw').innerHTML = `${LOGOS.blender}<span>Blender glb</span>${ICONS.slow}`;
    const doneSteps = events.steps.slice(1).filter((value) => value !== null).length;
    byId('headOpt').innerHTML = `<span>ours</span>${optimizing ? `<small>${doneSteps} of 3 steps</small>` : ''}${optimized.settled ? ICONS.pass : ICONS.open}`;

    const position = trackProgress(time);
    byId('trackFill').style.width = `${(position / (TRACK_STAGES - 1)) * 100}%`;
    trackMarks.forEach((node, index) => {
      const lit = position >= index - 0.001;
      if (node.lit !== lit) {
        node.lit = lit;
        node.mark.innerHTML = lit ? ICONS.pass : ICONS.open;
        node.element.classList.toggle('lit', lit);
      }
    });

    byId('steps').querySelectorAll('.step').forEach((button, index) => {
      const done = events.steps[index] !== null;
      button.classList.toggle('done', done);
      button.querySelector('.mark').innerHTML = done ? ICONS.pass : ICONS.open;
    });
  }

  function updateVisePage(time) {
    const closeup = events.key === null ? 0 : smooth((time - events.key) / 1.3);
    const before = alternatorFile.before;
    const after = alternatorFile.after;
    byId('sideRaw').innerHTML = `<div class="tag">${ICONS.slow}as shipped</div><div class="bigvalue">${formatBytes(before.bytes)}</div>
      <div class="line">${before.textures} × ${before.largestTextureEdge} px</div><div class="line">first frame ${formatSeconds(loadTimes.alternator_raw.medianFirstFrameMs)}</div>`;
    byId('sideOpt').innerHTML = `<div class="tag">optimized${ICONS.pass}</div><div class="bigvalue">${formatBytes(after.bytes)}</div>
      <div class="line">${after.textures} × ${after.largestTextureEdge} px WebP</div><div class="line">first frame ${formatSeconds(loadTimes.alternator_opt.medianFirstFrameMs)}</div>`;
    const top = `${lerp(96, 800, closeup)}px`;
    byId('sideRaw').style.top = top;
    byId('sideOpt').style.top = top;
    byId('slider').style.left = `${state.sliderX}px`;
    byId('handle').style.left = `${state.sliderX}px`;
    const grabbed = events.grab !== null;
    byId('grabTag').style.left = `${state.sliderX}px`;
    byId('grabTag').style.display = !grabbed ? 'block' : 'none';
    const sinceBeat = time - SCRIPT.beats[0];
    byId('keyHint').style.opacity = String(events.key === null && time > SCRIPT.beats[0] + 3.9 ? smooth((sinceBeat - 3.9) / 0.4) : 0);
  }

  function updateSetPage(time) {
    const sinceSet = events.set === null ? -1 : time - events.set;
    const amount = smooth((sinceSet - 0.2) / 1.8);
    const optimizedWidth = Math.max(4, (totals.optimizedGB / totals.sourceGB) * 100);
    byId('setLabelSource').innerHTML = `${LOGOS.blender}<span>blender glb</span>`;
    byId('setCount').innerHTML = `${Math.round(totals.optimizedCount * amount).toLocaleString('en-US')} / ${totals.setAssetCount.toLocaleString('en-US')}<small>done</small>`;
    byId('setSource').textContent = `${(totals.sourceGB * amount).toFixed(1)} GB`;
    byId('setOptimized').textContent = `${(totals.optimizedGB * amount).toFixed(2)} GB`;
    byId('setBarSource').style.width = `${100 * amount}%`;
    byId('setBarOpt').style.width = `${optimizedWidth * amount}%`;
    byId("setRatio").innerHTML = `${(totals.medianRatio * amount).toFixed(0)}× smaller<small>median</small>`;
    byId('setBtn').style.display = events.set === null ? 'flex' : 'none';
  }

  function updateEndPage(time) {
    const age = time - SCRIPT.beats[3];
    byId('end').innerHTML = `<div class="l1 brand">${LOGOS.nvidia}<span>Models by NVIDIA SimReady, CC BY 4.0</span></div><div class="l2 brand">${LOGOS.huggingface}<span>${REPO_NAME}</span></div><div class="l3">Music: Hypnothis by Kevin MacLeod (incompetech.com), CC BY 4.0</div>`;
    byId('end').style.opacity = String(smooth((age - 0.3) / 0.5));
  }

  function sweepPosition(time) {
    for (const cut of SCRIPT.beats.slice(1)) {
      const progress = (time - (cut - 0.2)) / 0.85;
      if (progress >= 0 && progress <= 1) return progress * (WIDTH + 300);
    }
    return -1;
  }
  function dipAmount(time) {
    return Math.max(0, ...SCRIPT.beats.slice(1).map((cut) => 1 - Math.abs(time - cut) / 0.14)) * 0.92;
  }

  function renderFrame() {
    const time = state.clock;
    const beat = beatOf(time);
    placeCamera(time, beat);
    backdrop.render(time, HORIZON[beat], sweepPosition(time));
    drawBefore(time, beat);
    renderView(time, beat);
    for (const page of new Set(Object.values(pages))) page.classList.toggle('on', page === pages[beat]);
    if (beat === 0) updateVisePage(time);
    if (beat === 1) updateProgressPage(time);
    if (beat === 2) updateSetPage(time);
    if (beat === 3) updateEndPage(time);
    byId('dimmer').style.opacity = String(dipAmount(time));
  }

  function step(deltaSeconds) {
    state.clock += deltaSeconds;
    state.sliderX += (state.sliderTarget - state.sliderX) * 0.4;
  }

  window.__script = SCRIPT;
  window.__stateEvents = stateEvents;
  window.__prepare = () => prepare(state.clock + FRAME_SECONDS);
  window.__renderAt = async (time) => {
    seek(time);
    await prepare(time);
    renderFrame();
  };
  window.__points = {
    step: (index) => rect(`#steps .step[data-step="${index}"]`),
    handle: () => rect('handle'),
    set: () => rect('setBtn'),
  };
  function rect(idOrSelector) {
    const element = idOrSelector.startsWith('#') ? document.querySelector(idOrSelector) : byId(idOrSelector);
    const box = element.getBoundingClientRect();
    return [box.x + box.width / 2, box.y + box.height / 2];
  }

  if (query.has('t')) await window.__renderAt(Number(query.get('t')));

  function loop() {
    step(FRAME_SECONDS);
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
