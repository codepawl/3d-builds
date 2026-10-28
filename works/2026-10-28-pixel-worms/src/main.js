import * as THREE from 'three';
import { ChaseCamera } from './chase-camera.js';
import { WORLD, PLAY, SIM_DT, OUTPUT, LOW, SEED, RUN_SEED, START_WORMS, HORIZON_COLOR, SKY_TOP_COLOR } from './config.js';
import { createRandom, clamp, smoothstep, lerp } from './random.js';
import { makeToonMaterial, propFadeUniforms } from './look.js';
import { buildHeightfields, paintGround, buildTerrainMeshes } from './terrain.js';
import { buildProps, buildWater } from './props.js';
import { WormSwarm, WormRenderer, TAKEN_X, TAKEN_Z } from './worms.js';
import { Creatures, Specks, KINDS } from './creatures.js';
import { Chunks, FOOD } from './chunks.js';
import { Hazards } from './hazards.js';
import { buildObstacleMeshes } from './obstacles.js';
import { PlayUi } from './ui.js';
import { Sfx } from './audio.js';
import { Ability, LUNGE, DODGE } from './abilities.js';
import { announce } from './events.js';
import { Growth } from './growth.js';
import { Director, OPPONENT_KINDS } from './director.js';
import { TUNING } from './tuning.js';
import { reportWorldBuilt, hideLoader } from './loading.js';
import { Tutorial } from './tutorial.js';

const params = new URLSearchParams(location.search);
// The balance bots drive play mode on a manual clock with ?bot (and ?play, ?seed=N, ?tune=name:value).
const botMode = params.has('bot');
const manualClock = params.has('manual') || botMode;
// The film tools drive the page with ?manual=1 (or ?film); everything else is the game.
const filmMode = params.has('manual') || params.has('film');
const playMode = !filmMode;
const isPhone = playMode && (window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600);
const WORM_LIMIT = isPhone ? 250 : 600;
if (playMode) document.body.classList.add('play');

// Play fits the picture to the window: about 360 low-resolution rows on a laptop (240 on a phone) and a wider view when the
// window is taller than it is wide. The film keeps its fixed 640x360 / 1920x1080.
function fitPlayView() {
  const aspect = window.innerWidth / window.innerHeight;
  const shortSide = isPhone ? 230 : 360;
  const lowWidth = Math.round(aspect >= 1 ? shortSide * aspect : shortSide);
  const lowHeight = Math.round(aspect >= 1 ? shortSide : shortSide / aspect);
  const scale = isPhone ? 2 : 3;
  LOW.width = lowWidth;
  LOW.height = lowHeight;
  OUTPUT.width = lowWidth * scale;
  OUTPUT.height = lowHeight * scale;
  return aspect >= 1 ? 54 : 54 + (1 - aspect) * 32;
}
const startFov = playMode ? fitPlayView() : 54;
const START = { x: 14, z: 9.5 };
const START_HEADING = 2.9; // radians; forward = (sin, cos) on the x/z plane
let growthKey = Number(params.get('growth') ?? 1.5); // multiplies the worms each eaten creature adds
const SPECK_COLORS = { chicken: 0xf2e6c4, rabbit: 0xb59068, pig: 0xf0b8a8, deer: 0xa8703c, cow: 0xe8e8e8, villager: 0xd07a3a };
const TURN_RATE = 1.7; // film only: radians per second with the cursor at the screen edge
const FOLLOW_RATE = 0.8; // play: the most the camera turns per second to follow the way the swarm travels

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(OUTPUT.width, OUTPUT.height, false);
renderer.setClearColor(HORIZON_COLOR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Play redraws the shadow map every other frame: at this pixel size nobody sees the lag, and it saves a whole pass of the worms.
if (playMode) renderer.shadowMap.autoUpdate = false;
let frameCounter = 0;

const chaseCamera = new ChaseCamera(renderer, {
  lowWidth: LOW.width,
  lowHeight: LOW.height,
  outputWidth: OUTPUT.width,
  outputHeight: OUTPUT.height,
  fov: startFov,
  ditherLevels: 24,
  outlineStrength: 0.3,
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON_COLOR, 32, 125);
const sun = new THREE.DirectionalLight(0xfff1de, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(playMode ? 2048 : 4096, playMode ? 2048 : 4096);
const shadowCamera = sun.shadow.camera;
shadowCamera.left = -52;
shadowCamera.right = 52;
shadowCamera.top = 52;
shadowCamera.bottom = -52;
shadowCamera.near = 1;
shadowCamera.far = 160;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xf3f4f2, 0xa9a698, 2.2));

// Sky: a dome whose colour runs from the horizon haze to a deeper blue overhead. It follows the camera and ignores fog.
function buildSky() {
  const geometry = new THREE.SphereGeometry(400, 24, 14);
  const colors = [];
  const horizon = new THREE.Color(HORIZON_COLOR);
  const top = new THREE.Color(SKY_TOP_COLOR);
  const position = geometry.attributes.position;
  const mix = new THREE.Color();
  for (let index = 0; index < position.count; index++) {
    const height = clamp(position.getY(index) / 400, 0, 1);
    mix.copy(horizon).lerp(top, Math.pow(height, 0.55));
    colors.push(mix.r, mix.g, mix.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}
const sky = buildSky();
scene.add(sky);

// Meadow beyond the terrain grid, so the land runs on to the horizon with no rim.
function buildOuterGround() {
  const outer = new THREE.Shape();
  outer.moveTo(-1500, -1500);
  outer.lineTo(1500, -1500);
  outer.lineTo(1500, 1500);
  outer.lineTo(-1500, 1500);
  const hole = new THREE.Path();
  hole.moveTo(WORLD.minX, WORLD.minZ);
  hole.lineTo(WORLD.minX, WORLD.maxZ);
  hole.lineTo(WORLD.maxX, WORLD.maxZ);
  hole.lineTo(WORLD.maxX, WORLD.minZ);
  outer.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(outer);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, makeToonMaterial({ color: '#93a67f' }));
  mesh.receiveShadow = true;
  return mesh;
}
scene.add(buildOuterGround());

const random = createRandom(SEED);
const heightfields = buildHeightfields();
const groundTexture = paintGround();
const takenTexture = new THREE.DataTexture(new Uint8Array(TAKEN_X * TAKEN_Z), TAKEN_X, TAKEN_Z, THREE.RedFormat);
takenTexture.magFilter = THREE.NearestFilter;
takenTexture.minFilter = THREE.NearestFilter;
takenTexture.generateMipmaps = false;

const { top } = buildTerrainMeshes(heightfields, groundTexture, makeToonMaterial, takenTexture);
scene.add(top);
const water = buildWater();
scene.add(water);

const swarm = new WormSwarm(heightfields, createRandom(RUN_SEED + 1));
const debugWorms = Number(params.get('worms') ?? 0);
if (playMode) swarm.limit = Math.max(WORM_LIMIT, debugWorms);
const wormRenderer = new WormRenderer(swarm);
scene.add(wormRenderer.mesh);
const creatures = new Creatures(heightfields, createRandom(RUN_SEED + 2));
scene.add(creatures.group);
const chunks = new Chunks(heightfields, createRandom(RUN_SEED + 4));
scene.add(chunks.group);
const specks = new Specks(createRandom(RUN_SEED + 3));
scene.add(specks.mesh);
scene.add(buildObstacleMeshes(heightfields.groundHeight));
const hazards = new Hazards(heightfields, specks, chunks, { director: playMode });
scene.add(hazards.group);
// Play grows by fission (src/growth.js); the film keeps food-releases-worms.
const growth = playMode ? new Growth(swarm) : null;
if (growth) chunks.feeder = (x, z, food) => growth.feedAt(x, z, food);

// Target marker: a cream ring with a dark outer edge and a red dot, drawn over everything so it always shows where the swarm heads.
function buildMarker() {
  const marker = new THREE.Group();
  const flat = (geometry, color) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false, depthTest: false, transparent: true, opacity: 0.85 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 20;
    return mesh;
  };
  marker.add(flat(new THREE.RingGeometry(1.0, 1.28, 16), 0x3a1017));
  marker.add(flat(new THREE.RingGeometry(0.72, 1.0, 16), 0xfff0b8));
  const dot = flat(new THREE.CircleGeometry(0.22, 8), 0xc0303f);
  dot.position.y = 0.01;
  marker.add(dot);
  return marker;
}
const ring = buildMarker();
scene.add(ring);

const hud = document.getElementById('hud');
const sim = {
  tick: 0,
  time: 0,
  pointer: { x: OUTPUT.width / 2, y: OUTPUT.height * 0.62 },
  target: { x: START.x, z: START.z },
  heading: START_HEADING,
  focus: { x: START.x, z: START.z },
  position: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  pull: 0,
  pullGoal: Number(params.get('pull') ?? 0),
  eaten: 0,
  total: 0,
  foodCarry: 0,
  pendingFood: 0,
  foodSpot: null,
  chunkEvents: [],
  hazardEvents: [],
  chunksEaten: 0,
  lastFront: { x: START.x, z: START.z },
  travel: { x: 0, z: 0 }, // smoothed velocity of the swarm front, which the camera follows
  lungeTarget: null,
  travelFrom: { x: START.x, z: START.z },
  travelDir: { x: Math.sin(START_HEADING), z: Math.cos(START_HEADING) },
};
sim.pull = sim.pullGoal;

// Play state. 'start' shows the scene behind the title; 'playing' runs the hazard director; 'won' and 'lost' end the run.
const game = { state: playMode ? 'start' : 'film', startedAt: 0, endedAt: 0, peak: 1, eatenByKind: {} };
const sfx = new Sfx();
const input = { touch: false, held: false, downX: 0, downY: 0, tap: null };
const abilities = { lunge: new Ability(LUNGE), dodge: new Ability(DODGE) };
let ui = null;
const bot = { target: null };
const director = playMode ? new Director({ hazards, creatures, onUnlock: (kind, spec) => ui && game.state === 'playing' && ui.announceThreat(spec.icon, spec.toast) }) : null;
let latestWorld = null;
let tutorial = null;
let tutorialRequested = false; // the "How to play" button replays the tutorial on the next run
const AGAIN_KEY = 'pixel-worms-again';

const forward = () => ({ x: Math.sin(sim.heading), z: Math.cos(sim.heading) });

// Where the camera wants to be: behind the swarm and above it, looking ahead. Returns the pose without moving anything.
function cameraGoal() {
  const count = Math.max(swarm.count, START_WORMS);
  const size = smoothstep(Math.log(12), Math.log(1500), Math.log(count));
  const ahead = forward();
  const startBoost = (1 - smoothstep(12, 40, count)) * 3.5;
  // A lone worm gets a close, low camera so it fills a good part of the frame; it backs off as the swarm grows.
  const closeUp = 1 - smoothstep(1.5, 9, count);
  // Above a few hundred worms the swarm is wide: back off and look down so the front, the land ahead and the fleeing
  // creatures stay readable (about 14 to 22 m back, 8 to 14 m up, looking down about 30 degrees).
  const wide = smoothstep(Math.log(50), Math.log(450), Math.log(count));
  const distance = lerp(8.5, 13, size) + wide * 11 + startBoost + sim.pull * 46 - closeUp * 6.6;
  const height = lerp(4.2, 7, size) + wide * 8.4 + sim.pull * 52 - closeUp * 1.0;
  const lookAhead = (lerp(6, 4, size) + wide * 5 - closeUp * 3.2) * (1 - sim.pull * 0.4);
  const position = new THREE.Vector3(sim.focus.x - ahead.x * distance, 0, sim.focus.z - ahead.z * distance);
  position.x = clamp(position.x, PLAY.minX - 10, PLAY.maxX + 10);
  position.z = clamp(position.z, PLAY.minZ - 10, PLAY.maxZ + 10);
  const focusHeight = heightfields.simHeight(sim.focus.x, sim.focus.z);
  // Stay well above roofs and hills under and around the camera, so it never ends up inside a house.
  let ground = 0;
  for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) ground = Math.max(ground, heightfields.simHeight(position.x + dx, position.z + dz));
  position.y = Math.max(focusHeight + height, ground + 3 + sim.pull * 6);
  const lookAt = new THREE.Vector3(sim.focus.x + ahead.x * lookAhead, focusHeight + 0.4, sim.focus.z + ahead.z * lookAhead);
  // Pulled back: look down at the mass of worms and the trail behind the front, not ahead at the horizon.
  const trailX = lerp(sim.focus.x, swarm.centroid.x, 0.9);
  const trailZ = lerp(sim.focus.z, swarm.centroid.z, 0.9);
  lookAt.x = lerp(lookAt.x, trailX, sim.pull);
  lookAt.z = lerp(lookAt.z, trailZ, sim.pull);
  lookAt.y = lerp(lookAt.y, heightfields.simHeight(trailX, trailZ), sim.pull);
  return { position, lookAt, distance, height };
}

// Film: the cursor's offset from the screen centre turns the heading (the film tools steer this way).
function edgeSteeringDelta(dt) {
  const offset = (sim.pointer.x / OUTPUT.width) * 2 - 1;
  const steer = Math.sign(offset) * smoothstep(0.1, 0.85, Math.abs(offset));
  return -steer * TURN_RATE * dt;
}

// Play: the camera slowly turns to the way the swarm is actually travelling, so the cursor only aims and never swings the view.
// The title screen turns slowly.
function travelHeadingDelta(dt) {
  if (game.state === 'start') return 0.08 * dt;
  const movedX = swarm.front.x - sim.lastFront.x;
  const movedZ = swarm.front.z - sim.lastFront.z;
  sim.lastFront.x = swarm.front.x;
  sim.lastFront.z = swarm.front.z;
  if (sim.tick <= 2) return 0;
  const blend = 1 - Math.exp(-dt * 2);
  sim.travel.x += (movedX / dt - sim.travel.x) * blend;
  sim.travel.z += (movedZ / dt - sim.travel.z) * blend;
  const speed = Math.hypot(sim.travel.x, sim.travel.z);
  if (speed < 1.2) return 0;
  const difference = Math.atan2(sim.travel.x, sim.travel.z) - sim.heading;
  const wrapped = Math.atan2(Math.sin(difference), Math.cos(difference));
  return clamp(wrapped * 0.9, -FOLLOW_RATE, FOLLOW_RATE) * smoothstep(1.2, 3, speed) * dt;
}

function updateCamera(dt) {
  sim.heading += filmMode ? edgeSteeringDelta(dt) : travelHeadingDelta(dt);
  sim.pull += (sim.pullGoal - sim.pull) * (1 - Math.exp(-dt * 1.3));
  const anchor = swarm.count > 0 ? swarm.front : filmMode ? START : sim.focus;
  const ease = 1 - Math.exp(-dt * 1.8);
  sim.focus.x += (anchor.x - sim.focus.x) * ease;
  sim.focus.z += (anchor.z - sim.focus.z) * ease;
  const goal = cameraGoal();
  const smooth = 1 - Math.exp(-dt * 1.5);
  if (sim.tick <= 1) {
    sim.position.copy(goal.position);
    sim.lookAt.copy(goal.lookAt);
  } else {
    sim.position.lerp(goal.position, smooth);
    sim.lookAt.lerp(goal.lookAt, smooth);
  }
  chaseCamera.place(sim.position, sim.lookAt);
}

// Cursor pixels (output space, y down) to a point on the terrain, through the third-person camera.
function screenToGround(pixelX, pixelY) {
  const { origin, direction } = chaseCamera.rayThrough(pixelX, pixelY);
  const point = new THREE.Vector3();
  let previous = 0;
  for (let travelled = 0.5; travelled < 260; travelled += 0.75) {
    point.copy(origin).addScaledVector(direction, travelled);
    if (point.y <= heightfields.simHeight(point.x, point.z) + 0.05) {
      let low = previous;
      let high = travelled;
      for (let iteration = 0; iteration < 8; iteration++) {
        const middle = (low + high) / 2;
        point.copy(origin).addScaledVector(direction, middle);
        if (point.y <= heightfields.simHeight(point.x, point.z) + 0.05) high = middle;
        else low = middle;
      }
      point.copy(origin).addScaledVector(direction, high);
      return { x: clamp(point.x, PLAY.minX, PLAY.maxX), z: clamp(point.z, PLAY.minZ, PLAY.maxZ) };
    }
    previous = travelled;
  }
  // Cursor above the horizon: aim far ahead of the swarm.
  const ahead = forward();
  return { x: clamp(sim.focus.x + ahead.x * 40, PLAY.minX, PLAY.maxX), z: clamp(sim.focus.z + ahead.z * 40, PLAY.minZ, PLAY.maxZ) };
}

function worldToScreen(x, z, y = 0.5) {
  const projected = chaseCamera.project(x, y, z);
  const rect = canvas.getBoundingClientRect();
  const outX = projected.behind ? OUTPUT.width / 2 : projected.x;
  const outY = projected.behind ? OUTPUT.height : projected.y;
  return { x: rect.left + (outX * rect.width) / OUTPUT.width, y: rect.top + (outY * rect.height) / OUTPUT.height, behind: projected.behind };
}

// Keep the target within reach of the swarm so a far cursor pulls it along the ground instead of teleporting the goal.
function withinReach(ground) {
  const fromFront = Math.hypot(ground.x - sim.focus.x, ground.z - sim.focus.z);
  const reach = 60;
  const scale = fromFront > reach ? reach / fromFront : 1;
  return { x: sim.focus.x + (ground.x - sim.focus.x) * scale, z: sim.focus.z + (ground.z - sim.focus.z) * scale };
}

function stepOnce() {
  sim.tick += 1;
  sim.time = sim.tick * SIM_DT;
  updateCamera(SIM_DT);
  if (playMode && game.state === 'start') sim.target = { x: sim.focus.x, z: sim.focus.z };
  else if (input.touch && !input.held && input.tap) sim.target = input.tap;
  else if (bot.target) sim.target = withinReach(bot.target);
  else sim.target = withinReach(screenToGround(sim.pointer.x, sim.pointer.y));
  // A lunge keeps the point it was aimed at, so the burst runs straight along the snake path.
  const lunging = playMode && abilities.lunge.active(sim.time);
  const dodging = playMode && abilities.dodge.active(sim.time);
  if (lunging && sim.lungeTarget) sim.target = sim.lungeTarget;
  swarm.lungeLevel = lunging ? 1 : 0;
  swarm.dodgeLevel = dodging ? 1 : 0;
  hazards.dodge.active = dodging;
  hazards.dodge.age = abilities.dodge.secondsSinceStart(sim.time);
  swarm.attractors = [...hazards.attractors(), ...chunks.near(sim.focus.x, sim.focus.z, 16, 12)];
  // Hazards appear along the way the swarm is actually travelling (the camera can lag behind a turn).
  if (sim.tick % 20 === 0) {
    const movedX = swarm.front.x - sim.travelFrom.x;
    const movedZ = swarm.front.z - sim.travelFrom.z;
    const moved = Math.hypot(movedX, movedZ);
    if (moved > 1.5) {
      const mixX = sim.travelDir.x * 0.3 + (movedX / moved) * 0.7;
      const mixZ = sim.travelDir.z * 0.3 + (movedZ / moved) * 0.7;
      const mixLength = Math.hypot(mixX, mixZ) || 1;
      sim.travelDir = { x: mixX / mixLength, z: mixZ / mixLength };
    }
    sim.travelFrom = { x: swarm.front.x, z: swarm.front.z };
  }
  const ahead = sim.travelDir;
  const world = { swarm, front: swarm.front, forward: ahead, right: { x: -ahead.z, z: ahead.x } };
  latestWorld = world;
  if (tutorial && game.state === 'playing') tutorial.update(sim.time, swarm.count);
  if (director && game.state === 'playing' && !(tutorial && tutorial.holdsOpponents(sim.time))) {
    director.starvingFraction = growth.starvingFraction;
    director.step(sim.time, SIM_DT, world);
  }
  hazards.step(sim.time, SIM_DT, world);
  sim.hazardEvents = hazards.events.map((event) => ({ ...event }));
  swarm.step(sim.time, SIM_DT, sim.target);
  creatures.step(sim.time, SIM_DT, swarm);
  // A swallowed creature breaks into chunks; worms are born only as chunks are eaten, in proportion to the food in each.
  for (const creature of creatures.eatenEvents) {
    const kind = KINDS[creature.kindName];
    chunks.burst(creature, creature.kindName, kind.height);
    announce('creature-die', { creature });
    specks.burst(creature.x, heightfields.groundHeight(creature.x, creature.z), creature.z, SPECK_COLORS[creature.kindName], 8);
    sim.eaten += 1;
    game.eatenByKind[creature.kindName] = (game.eatenByKind[creature.kindName] ?? 0) + 1;
  }
  chunks.step(SIM_DT, swarm);
  sim.chunkEvents = [];
  for (const chunk of chunks.eatenEvents) {
    announce('worm-eat', { chunk });
    if (!playMode) sim.pendingFood += chunk.food * growthKey * (1 + swarm.count / 700);
    sim.foodSpot = { x: chunk.x, z: chunk.z };
    specks.burst(chunk.x, heightfields.groundHeight(chunk.x, chunk.z), chunk.z, 0x8c2f33, 5);
    sim.chunksEaten += 1;
    sim.chunkEvents.push({ kind: chunk.kindName, piece: chunk.piece, x: chunk.x, z: chunk.z, born: 0 });
  }
  if (growth && game.state === 'playing') growth.step(SIM_DT, (spot) => hazards.leaveRemains(sim.time, spot.x, spot.z, 0x4a403c, true));
  // Film: food becomes worms at a limited rate, so the swarm grows steadily (a few percent a second) and never jumps.
  if (!playMode && sim.pendingFood > 0) {
    const release = Math.min(sim.pendingFood, SIM_DT * (1.2 + 0.3 * swarm.count));
    sim.pendingFood -= release;
    sim.foodCarry += release;
    const born = Math.floor(sim.foodCarry);
    if (born > 0 && sim.foodSpot) {
      sim.foodCarry -= born;
      swarm.spawn(sim.foodSpot.x, sim.foodSpot.z, born);
      swarm.lengthen(Math.ceil(born * 0.6));
    }
  }
  specks.update(SIM_DT);
  if (playMode) {
    playSounds();
    checkEnd();
  }
}

// How loud a sound is, by its distance from what the camera looks at.
function loudnessAt(x, z) {
  return 1 - smoothstep(25, 90, Math.hypot(x - sim.focus.x, z - sim.focus.z));
}

const HAZARD_CUES = { 'bird-warn': ['peck'], 'hen-warn': ['peck'], 'crow-warn': ['caw'], 'farmer-warn': ['dive'], 'farmer-chop': ['snap'], 'hedgehog-warn': ['squeal'], 'badger-warn': ['grunt'], 'badger-bite': ['snap'], 'mower-warn': ['engine'], 'bird-eaten': ['chunk'], 'crow-eaten': ['chunk'], 'hen-eaten': ['chunk'], 'farmer-eaten': ['chunk'], 'hedgehog-eaten': ['chunk'], 'badger-eaten': ['chunk'], 'hawk-warn': ['hawk'], 'fox-warn': ['fox'], parry: ['parry'], 'hawk-dive': ['dive'], 'hawk-abort': ['hawk'], 'fox-snap': ['fox'], 'fox-overwhelmed': ['fox'], 'fox-eaten': ['chunk'], 'bear-snap': ['snap'], 'salt-shrivel': ['sizzle'] };

function playSounds() {
  for (const creature of creatures.eatenEvents) {
    const loudness = loudnessAt(creature.x, creature.z);
    sfx.play(KINDS[creature.kindName].height > 1.5 ? 'gore' : 'bite', loudness);
  }
  if (chunks.eatenEvents.length > 0) {
    const chunk = chunks.eatenEvents[0];
    sfx.play('chunk', loudnessAt(chunk.x, chunk.z));
  }
  for (const event of hazards.events) {
    for (const cue of HAZARD_CUES[event.kind] ?? []) sfx.play(cue, loudnessAt(event.x, event.z));
    if (event.kind === 'parry') ui.toast('dodge', 'Parry!');
    else if (event.kind === 'hawk-miss' || event.kind === 'fox-miss') ui.toast('dodge', 'Dodged');
  }
}

function checkEnd() {
  if (game.state !== 'playing') return;
  game.peak = Math.max(game.peak, swarm.count);
  if (swarm.count === 0) {
    sim.pendingFood = 0;
    endGame(false);
  } else if (sim.tick % 30 === 0 && creatures.alive() === 0) {
    endGame(true);
  }
}

function endGame(won) {
  game.state = won ? 'won' : 'lost';
  game.endedAt = sim.time;
  if (tutorial) tutorial.finish(false);
  const summary = { won, peak: game.peak, wormCount: swarm.count, seconds: game.endedAt - game.startedAt };
  setTimeout(() => ui.showEnd(summary), won ? 700 : 1300);
}

function beginPlay(fromGesture) {
  game.state = 'playing';
  game.startedAt = sim.time;
  game.peak = swarm.count;
  director.reset(sim.time);
  growth.splits = 0;
  abilities.lunge.reset();
  abilities.dodge.reset();
  input.tap = null;
  ui.showPlaying();
  if (fromGesture) sfx.unlock();
  if (tutorial && (tutorialRequested || Tutorial.pending())) tutorial.begin(sim.time);
  tutorialRequested = false;
}

function render() {
  wormRenderer.update(sim.time);
  creatures.applyPose(chaseCamera.camera);
  chunks.applyPose();
  water.userData.update(sim.time);
  takenTexture.image.data.set(swarm.taken);
  takenTexture.needsUpdate = true;
  // The marker keeps about the same size on screen at any distance, and swells while a lunge runs.
  const markerDistance = chaseCamera.camera.position.distanceTo(ring.position);
  const ringScale = (1 + 0.1 * Math.sin(sim.time * 5)) * clamp(markerDistance * 0.03, 0.6, 2) * (1 + 0.6 * swarm.lungeSmooth);
  ring.visible = game.state === 'playing' || filmMode;
  ring.position.set(sim.target.x, heightfields.simHeight(sim.target.x, sim.target.z) + 0.3, sim.target.z);
  ring.scale.setScalar(ringScale * (1 + sim.pull * 3));
  // The sun and its shadow box ride along with the camera focus, in 2 m steps so shadows do not shimmer.
  const sunX = Math.round(sim.focus.x / 2) * 2;
  const sunZ = Math.round(sim.focus.z / 2) * 2;
  sun.target.position.set(sunX, 0, sunZ);
  sun.position.set(sunX + 36, 21, sunZ - 15);
  sky.position.copy(sim.position);
  scene.fog.near = 32 + sim.pull * 30;
  scene.fog.far = 125 + sim.pull * 85;
  // Props that stand between the camera and the swarm dissolve in dither; the pull-back view turns that off.
  const swarmScreen = chaseCamera.project(sim.focus.x, heightfields.simHeight(sim.focus.x, sim.focus.z) + 0.5, sim.focus.z);
  propFadeUniforms.swarmScreen.value.set((swarmScreen.x / OUTPUT.width) * LOW.width, LOW.height - (swarmScreen.y / OUTPUT.height) * LOW.height);
  // Pulled back, the mass is wide and deep: trees over it on screen dissolve too, so none stands in the middle of the swarm.
  propFadeUniforms.swarmDepth.value = chaseCamera.camera.position.distanceTo(new THREE.Vector3(sim.focus.x, heightfields.simHeight(sim.focus.x, sim.focus.z), sim.focus.z)) + sim.pull * 40;
  propFadeUniforms.lowSize.value.set(LOW.width, LOW.height);
  propFadeUniforms.strength.value = 1;
  if (playMode) renderer.shadowMap.needsUpdate = frameCounter++ % 2 === 0;
  chaseCamera.render(scene);
  if (filmMode) hud.textContent = `Worms ${swarm.count.toLocaleString("en-US")}`;
  else if (game.state === 'playing') {
    ui.updateStats({ wormCount: swarm.count, seconds: sim.time - game.startedAt, eatenByKind: game.eatenByKind, creaturesLeft: creatures.alive() });
    ui.setHunger(growth.starvingFraction >= TUNING.hungerIconFraction || (swarm.count <= 3 && growth.starvingFraction > 0));
    ui.updateAbilities({ lunge: abilities.lunge.recharge(sim.time), dodge: abilities.dodge.recharge(sim.time) });
  }
}

function state() {
  return {
    tick: sim.tick,
    time: sim.time,
    wormCount: swarm.count,
    creaturesLeft: creatures.alive(),
    creaturesEaten: sim.eaten,
    creaturesTotal: sim.total,
    chunksLeft: chunks.list.length,
    chunksEaten: sim.chunksEaten,
    chunkEvents: sim.chunkEvents.map((event) => ({ ...event, screen: worldToScreen(event.x, event.z, 0.5) })),
    hazardEvents: sim.hazardEvents.map((event) => ({ ...event, screen: worldToScreen(event.x, event.z, 0.5) })),
    heading: sim.heading,
    zoom: 1 + sim.pull,
    target: { ...sim.target },
    centroid: { x: swarm.centroid.x, z: swarm.centroid.z },
    front: { x: swarm.front.x, z: swarm.front.z },
    camera: { x: sim.position.x, y: sim.position.y, z: sim.position.z },
    lunge: abilities.lunge.recharge(sim.time),
    dodge: abilities.dodge.recharge(sim.time),
  };
}

function setCursor(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  sim.pointer.x = ((clientX - rect.left) * OUTPUT.width) / rect.width;
  sim.pointer.y = ((clientY - rect.top) * OUTPUT.height) / rect.height;
}

window.__app = {
  sceneReady: false,
  setCursor,
  step(count = 1, draw = true) {
    for (let index = 0; index < count; index++) stepOnce();
    if (draw) render();
    return state();
  },
  render,
  lunge: () => tryLunge(),
  dodge: () => tryDodge(),
  // The balance bots: aim the swarm at a ground point, lunge at one, and read the field.
  bot: {
    aim(x, z) {
      bot.target = { x, z };
    },
    release() {
      bot.target = null;
    },
    lungeAt(x, z) {
      if (game.state !== 'playing' || !abilities.lunge.trigger(sim.time)) return false;
      sim.lungeTarget = withinReach({ x, z });
      return true;
    },
    dodge: () => game.state === 'playing' && abilities.dodge.trigger(sim.time),
    lungeReady: () => abilities.lunge.ready(sim.time),
    dodgeReady: () => abilities.dodge.ready(sim.time),
    field() {
      return {
        time: sim.time,
        front: { x: swarm.front.x, z: swarm.front.z },
        count: swarm.count,
        creatures: creatures.list.filter((creature) => creature.eatenAt < 0 && !creature.gone).map((creature) => ({ kind: creature.kindName, x: creature.x, z: creature.z, fleeing: creature.mode === 'flee' })),
        chunks: chunks.list.map((chunk) => ({ x: chunk.x, z: chunk.z })),
        incoming: hazards.incoming(sim.time),
        lanes: hazards.opponents.lanes(),
        traps: hazards.traps.map((trap) => ({ x: trap.spot.x, z: trap.spot.z })),
        salt: hazards.salt ? { x: hazards.salt.ring.x, z: hazards.salt.ring.z, radius: hazards.salt.ring.radius } : null,
        forward: { ...sim.travelDir },
      };
    },
    report() {
      return {
        state: game.state,
        seconds: game.state === 'playing' ? sim.time - game.startedAt : game.endedAt - game.startedAt,
        peak: game.peak,
        count: swarm.count,
        splits: growth.splits,
        starved: growth.starved,
        foodEaten: growth.foodEaten,
        foodWasted: growth.foodWasted,
        starving: growth.starvingFraction,
        creaturesEaten: sim.eaten,
        director: { spawned: { ...director.stats.spawned }, lost: { ...director.stats.lost }, respawned: director.stats.respawned, adapt: director.adapt, budget: director.budget },
        opponentsEaten: { ...hazards.opponents.stats.eaten },
      };
    },
  },
  start: () => beginPlay(false),
  setHud(visible) {
    hud.style.display = visible ? 'block' : 'none';
  },
  state,
  worldToScreen,
  // 0 = chase view behind the swarm, 1 = high pull-back over the land it has taken.
  pullBack(amount) {
    sim.pullGoal = amount;
  },
  creatures: () => creatures.list.map((creature, id) => ({ creature, id })).filter(({ creature }) => creature.eatenAt < 0).map(({ creature, id }) => ({ id, name: creature.name, kind: creature.kindName, mode: creature.mode, x: creature.x, z: creature.z })),
  chunks: () => chunks.list.map((chunk) => ({ x: chunk.x, z: chunk.z, age: chunk.age, piece: chunk.piece })),
  setEatGap(seconds) {
    creatures.eatGap = seconds;
  },
  setGrowth(value) {
    growthKey = value;
  },
  setSwarmSpread(scale) {
    swarm.spreadScale = scale;
  },
  setFleeScale(scale) {
    creatures.fleeScale = scale;
  },
  hazardLog: () => hazards.log.map((event) => ({ ...event })),
  setSwarmSpeed(scale) {
    swarm.speedScale = scale;
  },
  swarmBounds: () => ({ centroid: { ...swarm.centroid } }),
};

window.__debug = { spawnOpponent: (kind) => hazards.spawn(kind, sim.time, latestWorld, swarm.count), growth, director, OPPONENT_KINDS, chunks, hazards, scene, sun, swarm, wormRenderer, chaseCamera, creatures, renderer, sim };

window.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || input.held) setCursor(event.clientX, event.clientY);
});
// Left click lunges toward the cursor, right click dodges. The buttons in the HUD do the same for touch.
function tryLunge() {
  if (game.state !== 'playing' || !abilities.lunge.trigger(sim.time)) return false;
  sim.lungeTarget = withinReach(screenToGround(sim.pointer.x, sim.pointer.y));
  sfx.play('lunge');
  if (tutorial) tutorial.noteLunge();
  return true;
}

function tryDodge() {
  if (game.state !== 'playing' || !abilities.dodge.trigger(sim.time)) return false;
  sfx.play('dodge');
  if (tutorial) tutorial.noteDodge();
  return true;
}

if (playMode) window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('pointerdown', (event) => {
  if (game.state !== 'start') sfx.unlock();
  if (playMode && event.pointerType === 'mouse' && event.target === canvas) {
    setCursor(event.clientX, event.clientY);
    if (event.button === 0) {
      if (!tryLunge() && game.state === 'playing') ui.deny('lunge');
    } else if (event.button === 2) {
      if (!tryDodge() && game.state === 'playing') ui.deny('dodge');
    }
  }
  if (event.pointerType !== 'touch') return;
  input.touch = true;
  input.held = true;
  input.tap = null;
  setCursor(event.clientX, event.clientY);
});
// Letting go of a finger keeps its target: the swarm goes on to where the finger last pointed (a tap sets a target).
function releaseFinger(event) {
  if (event.pointerType !== 'touch' || !input.held) return;
  input.held = false;
  input.tap = withinReach(screenToGround(sim.pointer.x, sim.pointer.y));
}
window.addEventListener('pointerup', releaseFinger);
window.addEventListener('pointercancel', releaseFinger);

if (playMode) {
  window.addEventListener('resize', () => {
    const fov = fitPlayView();
    renderer.setSize(OUTPUT.width, OUTPUT.height, false);
    chaseCamera.resize(LOW.width, LOW.height, OUTPUT.width, OUTPUT.height, fov);
    if (window.__app.sceneReady) render();
  });
}

function playAgain() {
  sessionStorage.setItem(AGAIN_KEY, '1');
  location.reload();
}

async function start() {
  await creatures.populate();
  sim.total = creatures.list.length;
  scene.add(await buildProps(heightfields));
  swarm.spawn(START.x, START.z, START_WORMS, 0, Math.atan2(Math.cos(START_HEADING), Math.sin(START_HEADING)));
  if (debugWorms > 1) {
    swarm.spawn(START.x, START.z, debugWorms - 1);
    swarm.lengthen(debugWorms * 2);
  }
  if (growth) for (let worm = 0; worm < swarm.count; worm++) growth.seed(worm);
  swarm.rebuildPile();
  swarm.rebuildHash();
  if (playMode) {
    ui = new PlayUi({ onPlay: () => beginPlay(true), onAgain: playAgain, onLunge: tryLunge, onDodge: tryDodge, onHowTo: () => { tutorialRequested = true; beginPlay(true); }, sfx });
    if (!botMode && !params.has('notutorial')) {
      tutorial = window.__debug.tutorial = new Tutorial({
        scene,
        ui,
        touch: window.matchMedia('(pointer: coarse)').matches,
        world: {
          front: () => swarm.front,
          forward,
          creatures: () => creatures.list,
          eaten: () => sim.eaten,
          splits: () => growth.splits,
          incoming: () => hazards.incoming(sim.time),
          ground: (x, z) => heightfields.simHeight(x, z),
          time: () => sim.time,
          project: (x, y, z) => worldToScreen(x, z, y),
        },
      });
    }
    ui.showStart();
  }
  reportWorldBuilt();
  stepOnce();
  render();
  window.__app.sceneReady = true;
  hideLoader();
  if (playMode && (params.has('play') || botMode || sessionStorage.getItem(AGAIN_KEY))) {
    sessionStorage.removeItem(AGAIN_KEY);
    beginPlay(false);
  }
  let lastTime = null;
  let carry = 0;
  const frame = (timestamp) => {
    requestAnimationFrame(frame);
    if (manualClock) return;
    const realSeconds = lastTime === null ? 0 : Math.min(0.1, (timestamp - lastTime) / 1000);
    carry += realSeconds * (tutorial ? tutorial.timeScale : 1);
    lastTime = timestamp;
    let steps = 0;
    while (carry >= SIM_DT - 1e-6 && steps < 3) {
      stepOnce();
      carry -= SIM_DT;
      steps++;
    }
    if (steps > 0) render();
    if (tutorial) tutorial.frame(realSeconds, sim.time);
  };
  requestAnimationFrame(frame);
}

start();
