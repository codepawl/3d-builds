// Records a real play-mode session of Pixel Worms on a virtual clock (one fixed 1/60 s step per frame), driven by a scripted
// player that moves the real mouse (page.mouse) and clicks Play. No game code changes: play mode already exposes __app.step.
//
// Usage: node record_play.mjs --frames 14400 [--shots ranges.json] [--out shots/play-session]
//   without --shots : dry pass, writes only the logs (events.json, inputs.json)
//   with --shots    : same session again (deterministic), also saves a JPEG for every frame inside the listed [start, end) ranges
// Env: PLAYWRIGHT_FROM = a file path whose node_modules holds playwright. PORT = dev server port (default 5471).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const TOTAL_FRAMES = Number(option('--frames', 14400));
const OUT = path.resolve(ROOT, option('--out', 'shots/play-session'));
const shotRanges = option('--shots', null) ? JSON.parse(fs.readFileSync(option('--shots'), 'utf8')) : null;
const PORT = process.env.PORT ?? '5471';
const FRAME_MS = 1000 / 60;
const WIDTH = 1920;
const HEIGHT = 1080;
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const inShot = (frame) => shotRanges !== null && shotRanges.some(([start, end]) => frame >= start && frame < end);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${WIDTH},${HEIGHT}`] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  let virtualNow = 1000;
  let nextId = 1;
  const queue = new Map();
  performance.now = () => virtualNow;
  window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };
  // The page never gets a real frame callback, so the game loop only advances through __app.step.
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.id = '__virtual_cursor';
    cursor.style.cssText = 'position:fixed;left:1010px;top:760px;width:30px;height:30px;pointer-events:none;z-index:999999;transform:translate(-3px,-2px)';
    cursor.innerHTML = '<svg width="34" height="34" viewBox="0 0 28 28" fill="none"><path d="M4 3L12.5 23.5L15.8 15.8L23.5 12.5L4 3Z" fill="#fff6e0" stroke="#2a1014" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);
    window.addEventListener('mousemove', (event) => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; }, true);
  });
});

const page = await context.newPage();
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
const playButton = await page.evaluate(() => {
  const rect = document.getElementById('play-button').getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
});

// One frame inside the page: step the game once, then report everything the bot and the sound mixer need.
const STEP_AND_REPORT = () => {
  const app = window.__app;
  const debug = window.__debug;
  const state = app.step(1, true);
  const toScreen = (x, z) => { const screen = app.worldToScreen(x, z, 0.5); return { x: Math.round(screen.x), y: Math.round(screen.y) }; };
  return {
    tick: state.tick,
    time: state.time,
    worms: state.wormCount,
    heading: state.heading,
    front: state.front,
    eatenTotal: state.creaturesEaten,
    creaturesLeft: state.creaturesLeft,
    eaten: debug.creatures.eatenEvents.map((creature) => ({ kind: creature.kindName, name: String(creature.name), x: creature.x, z: creature.z, screen: toScreen(creature.x, creature.z) })),
    chunks: state.chunkEvents.map((event) => ({ kind: event.kind, piece: event.piece, screen: { x: Math.round(event.screen.x), y: Math.round(event.screen.y) } })),
    hazards: state.hazardEvents.map((event) => ({ kind: event.kind, killed: event.killed, x: event.x, z: event.z, screen: { x: Math.round(event.screen.x), y: Math.round(event.screen.y) } })),
    alive: app.creatures().map((creature) => ({ id: creature.id, kind: creature.kind, mode: creature.mode, x: creature.x, z: creature.z })),
    traps: debug.hazards.traps.map((trap) => ({ x: trap.spot.x, z: trap.spot.z, state: trap.state })),
    salt: debug.hazards.salt ? { x: debug.hazards.salt.x ?? null } : null,
    predators: debug.hazards.predators.map((predator) => ({ kind: predator.kind, state: predator.state, x: predator.x ?? predator.position?.x, z: predator.z ?? predator.position?.z })),
  };
};

// ---- the scripted player ----------------------------------------------------------------------------------------------
const TURN_GAIN = 1.5; // steering strength per radian of heading error
function offsetForSteer(steer) {
  // Inverse of the game's steer = sign * smoothstep(0.1, 0.85, |offset|).
  const magnitude = Math.abs(steer);
  if (magnitude < 0.01) return 0;
  let low = 0.1;
  let high = 0.85;
  for (let iteration = 0; iteration < 20; iteration++) {
    const middle = (low + high) / 2;
    if (smoothstep(0.1, 0.85, middle) < magnitude) low = middle;
    else high = middle;
  }
  return Math.sign(steer) * high;
}

const bot = { cursor: { x: 1010, y: 760 }, velocity: { x: 0, y: 0 }, targetId: null, targetSince: 0, skipUntil: new Map(), trapChase: null, trapsSnapped: 0, trapChaseDone: false };
const SMALL_FIRST = ['chicken', 'rabbit', 'pig'];

function chooseGoal(frame, snapshot) {
  const { front, heading, worms, alive, traps } = snapshot;
  const angleTo = (x, z) => wrapAngle(Math.atan2(x - front.x, z - front.z) - heading);
  // Once: steer the swarm into a bear trap when it is a few worms strong and a trap lies near.
  if (!bot.trapChaseDone && worms >= 6 && traps.length > 0) {
    const nearest = traps.map((trap) => ({ trap, distance: Math.hypot(trap.x - front.x, trap.z - front.z) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest.distance < 50) {
      if (bot.trapChase === null) bot.trapChase = { since: frame };
      if (frame - bot.trapChase.since < 1500) return { label: 'trap', x: nearest.trap.x, z: nearest.trap.z };
    }
  }
  const staying = alive.find((creature) => creature.id === bot.targetId);
  if (staying && frame - bot.targetSince < 420) return { label: staying.kind, x: staying.x, z: staying.z };
  if (staying) bot.skipUntil.set(staying.id, frame + 600);
  const wanted = worms < 40 ? SMALL_FIRST : null;
  let best = null;
  let bestScore = Infinity;
  for (const creature of alive) {
    if ((bot.skipUntil.get(creature.id) ?? -1) > frame) continue;
    if (wanted && !wanted.includes(creature.kind)) continue;
    const distance = Math.hypot(creature.x - front.x, creature.z - front.z);
    if (distance > 70) continue;
    const score = distance * (1 + 0.8 * Math.abs(angleTo(creature.x, creature.z)) / Math.PI);
    if (score < bestScore) { bestScore = score; best = creature; }
  }
  if (!best) {
    for (const creature of alive) {
      if ((bot.skipUntil.get(creature.id) ?? -1) > frame) continue;
      const distance = Math.hypot(creature.x - front.x, creature.z - front.z);
      const score = distance * (1 + 0.8 * Math.abs(angleTo(creature.x, creature.z)) / Math.PI);
      if (score < bestScore) { bestScore = score; best = creature; }
    }
  }
  bot.targetId = best ? best.id : null;
  bot.targetSince = frame;
  return best ? { label: best.kind, x: best.x, z: best.z } : { label: 'ahead', x: front.x + Math.sin(heading) * 30, z: front.z + Math.cos(heading) * 30 };
}

// Cursor goal on screen for the current goal, then a spring toward it so the hand arcs instead of jumping.
function steerCursor(frame, snapshot, goal) {
  const error = wrapAngle(Math.atan2(goal.x - snapshot.front.x, goal.z - snapshot.front.z) - snapshot.heading);
  const steer = clamp(-error * TURN_GAIN, -1, 1);
  const offset = offsetForSteer(steer);
  const seconds = frame / 60;
  const wobbleX = 14 * Math.sin(seconds * 1.7) + 8 * Math.sin(seconds * 3.1 + 1);
  const wantedX = clamp(WIDTH / 2 * (1 + offset) + wobbleX, 30, WIDTH - 30);
  const wantedY = 640 + 45 * Math.sin(seconds * 0.45) + 18 * Math.sin(seconds * 1.3 + 2);
  const stiffness = 90; // spring: about 0.15 s to settle, no overshoot
  const damping = 2 * Math.sqrt(stiffness);
  const dt = 1 / 60;
  bot.velocity.x += (stiffness * (wantedX - bot.cursor.x) - damping * bot.velocity.x) * dt;
  bot.velocity.y += (stiffness * (wantedY - bot.cursor.y) - damping * bot.velocity.y) * dt;
  bot.cursor.x += bot.velocity.x * dt;
  bot.cursor.y += bot.velocity.y * dt;
}

// Title: idle drift, then a smooth arc to the Play button and a click (press, release 4 frames later).
const TITLE_IDLE = 200;
const TITLE_ARC = 70;
const PRESS_FRAME = TITLE_IDLE + TITLE_ARC + 14;
const RELEASE_FRAME = PRESS_FRAME + 4;
const arcStart = { x: 1010, y: 760 };
function titleCursor(frame) {
  if (frame < TITLE_IDLE) {
    const seconds = frame / 60;
    return { x: arcStart.x + 26 * Math.sin(seconds * 0.9), y: arcStart.y + 14 * Math.sin(seconds * 1.3) };
  }
  const progress = clamp((frame - TITLE_IDLE) / TITLE_ARC, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const from = { x: arcStart.x + 26 * Math.sin((TITLE_IDLE / 60) * 0.9), y: arcStart.y + 14 * Math.sin((TITLE_IDLE / 60) * 1.3) };
  const bend = Math.sin(eased * Math.PI) * 60; // an arc, not a straight line
  return { x: from.x + (playButton.x - from.x) * eased + bend * 0.4, y: from.y + (playButton.y - from.y) * eased - bend };
}

// ---- main loop ---------------------------------------------------------------------------------------------------------
await page.mouse.move(arcStart.x, arcStart.y);
const events = [];
const inputs = [];
let previousModes = new Map();
let playStarted = false;
let snapshot = await page.evaluate(STEP_AND_REPORT); // frame -1: a first step so the bot has a state before frame 0
let lastLog = Date.now();

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  let cursor;
  let goalLabel = 'title';
  if (!playStarted) {
    cursor = titleCursor(frame);
    if (frame >= TITLE_IDLE + TITLE_ARC) cursor = { x: playButton.x, y: playButton.y };
    bot.cursor = { ...cursor };
  } else {
    const goal = chooseGoal(frame, snapshot);
    goalLabel = goal.label;
    steerCursor(frame, snapshot, goal);
    cursor = bot.cursor;
  }
  await page.mouse.move(cursor.x, cursor.y);
  inputs.push({ frame, kind: 'move', target: goalLabel, x: Math.round(cursor.x * 10) / 10, y: Math.round(cursor.y * 10) / 10 });
  if (frame === PRESS_FRAME) {
    await page.mouse.down();
    inputs.push({ frame, kind: 'press', target: 'play-button', x: cursor.x, y: cursor.y });
  }
  if (frame === RELEASE_FRAME) {
    await page.mouse.up();
    playStarted = true;
    bot.velocity = { x: 0, y: 0 };
    inputs.push({ frame, kind: 'click', target: 'play-button', x: cursor.x, y: cursor.y });
  }
  snapshot = await page.evaluate(STEP_AND_REPORT);
  const fleeing = [];
  for (const creature of snapshot.alive) {
    if (creature.mode === 'flee' && previousModes.get(creature.id) !== 'flee') fleeing.push({ kind: creature.kind, id: creature.id });
  }
  previousModes = new Map(snapshot.alive.map((creature) => [creature.id, creature.mode]));
  for (const hazard of snapshot.hazards) if (hazard.kind === 'bear-snap') bot.trapChaseDone = true;
  events.push({
    frame, worms: snapshot.worms, time: snapshot.time, eatenTotal: snapshot.eatenTotal, creaturesLeft: snapshot.creaturesLeft,
    eaten: snapshot.eaten, chunks: snapshot.chunks, hazards: snapshot.hazards, fleeing,
    predators: snapshot.predators.map((predator) => `${predator.kind}:${predator.state}`), traps: snapshot.traps.length, salt: snapshot.salt !== null, goal: goalLabel,
    cursor: [Math.round(cursor.x), Math.round(cursor.y)],
  });
  if (inShot(frame)) await page.screenshot({ path: path.join(OUT, 'frames', `f${String(frame).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 95 });
  if (Date.now() - lastLog > 15000) {
    lastLog = Date.now();
    console.log(`f${frame} worms=${snapshot.worms} eaten=${snapshot.eatenTotal} goal=${goalLabel}`);
  }
}
fs.writeFileSync(path.join(OUT, shotRanges ? 'events-shoot.json' : 'events.json'), JSON.stringify(events));
fs.writeFileSync(path.join(OUT, 'inputs.json'), JSON.stringify(inputs));
await browser.close();
console.log('done', TOTAL_FRAMES, 'frames');
