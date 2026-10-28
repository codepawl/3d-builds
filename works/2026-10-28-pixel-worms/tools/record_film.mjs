// Records the 30 s Pixel Worms film on a virtual clock (1/60 s per frame, 1800 frames), driven by a real mouse (page.mouse.move).
// Usage: node record_film.mjs [growth] [--stills f1,f2,...]   (with --stills only those frames are saved, in shots/_stills)
// Writes shots/_frames/frame_0000.png ..., shots/input_events.json (every mouse input) and shots/state_log.json (per frame).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(import.meta.dirname, "..").split(path.sep).join("/");
const argv = process.argv.slice(2);
const growth = argv.find((arg) => /^[0-9.]+$/.test(arg)) ?? '1.2';
const stillsArg = argv.includes('--stills') ? argv[argv.indexOf('--stills') + 1] : null;
const stillFrames = stillsArg ? new Set(stillsArg.split(',').map(Number)) : null;
const plan = JSON.parse(fs.readFileSync(`${ROOT}/tools/film_plan.json`, 'utf8'));
const outDir = path.join(ROOT, 'shots', stillFrames ? '_stills' : '_frames');
fs.mkdirSync(outDir, { recursive: true });
const FRAME_MS = 1000 / 60;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript({ path: `${ROOT}/tools/film_plan.js` });
await context.addInitScript(() => {
  let virtualNow = 1000;
  let nextId = 1;
  const queue = new Map();
  performance.now = () => virtualNow;
  window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };
  window.__advanceVirtualFrame = (dtMs) => {
    virtualNow += dtMs;
    const callbacks = Array.from(queue.values());
    queue.clear();
    callbacks.forEach((callback) => callback(virtualNow));
  };
  // A drawn mouse cursor that follows the real mouse events (headless screenshots do not contain the OS cursor).
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
await page.goto(`http://127.0.0.1:5471/?manual=1&growth=${growth}`, { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
await page.mouse.move(1010, 760);

const inputLog = [];
const stateLog = [];
let previousAlive = new Map();
let previousFleeing = new Set();
let lastScreen = new Map();
const startAlive = await page.evaluate(() => window.__app.creatures().map((creature) => [creature.id, creature.kind]));
previousAlive = new Map(startAlive);

for (let frame = 0; frame < plan.totalFrames; frame++) {
  if (frame === plan.pullFrame) {
    await page.evaluate((pullAmount) => { window.__app.pullBack(pullAmount); window.__app.setHud(false); document.getElementById('__virtual_cursor').style.display = 'none'; }, plan.pullAmount ?? 1);
  }
  // The planner picks a goal, the smoothed cursor moves toward it, and the real mouse is moved there.
  const decision = await page.evaluate(([planArg, frameNumber]) => {
    const goal = window.__film.goalFor(frameNumber, planArg);
    return { goal, cursor: window.__film.nextCursor(goal) };
  }, [plan, frame]);
  await page.mouse.move(decision.cursor.x, decision.cursor.y);
  inputLog.push({ frame, kind: 'move', target: decision.goal.label, x: decision.cursor.x, y: decision.cursor.y });
  await page.evaluate((dt) => window.__advanceVirtualFrame(dt), FRAME_MS);
  const snapshot = await page.evaluate(() => {
    const app = window.__app;
    const state = app.step(1, true);
    const alive = app.creatures().map((creature) => ({ id: creature.id, name: creature.name, kind: creature.kind, mode: creature.mode, x: creature.x, z: creature.z, screen: app.worldToScreen(creature.x, creature.z, 0.6) }));
    return { state, alive };
  });
  const aliveNames = new Set(snapshot.alive.map((creature) => creature.id));
  const eaten = [];
  for (const [name, kind] of previousAlive) {
    if (!aliveNames.has(name)) eaten.push({ id: name, name: String(name), kind });
  }
  previousAlive = new Map(snapshot.alive.map((creature) => [creature.id, creature.kind]));
  // Where each eaten creature stood is not in the new list; take it from the previous frame's record.
  const eatenWithScreen = eaten.map((entry) => ({ ...entry, screenX: lastScreen.get(entry.id) ?? 960 }));
  const fleeingNow = new Set(snapshot.alive.filter((creature) => creature.mode === "flee").map((creature) => creature.id));
  const startedFleeing = snapshot.alive.filter((creature) => fleeingNow.has(creature.id) && !previousFleeing.has(creature.id)).map((creature) => ({ name: creature.name, kind: creature.kind, screenX: creature.screen.x }));
  previousFleeing = fleeingNow;
  lastScreen = new Map(snapshot.alive.map((creature) => [creature.id, creature.screen.x]));
  stateLog.push({ frame, time: frame / 60, worms: snapshot.state.wormCount, eatenTotal: snapshot.state.creaturesEaten, eaten: eatenWithScreen, startedFleeing, zoom: snapshot.state.zoom, chunksLeft: snapshot.state.chunksLeft, chunkEvents: snapshot.state.chunkEvents, hazardEvents: snapshot.state.hazardEvents });
  if (stillFrames ? stillFrames.has(frame) : true) await page.screenshot({ path: path.join(outDir, `frame_${String(frame).padStart(4, '0')}.png`) });
  if (frame % 120 === 0) console.log(`f${frame} worms=${snapshot.state.wormCount} eaten=${snapshot.state.creaturesEaten} goal=${decision.goal.label}`);
}
if (!stillFrames) {
  fs.writeFileSync(path.join(ROOT, 'shots', 'input_events.json'), JSON.stringify(inputLog, null, 1));
  fs.writeFileSync(path.join(ROOT, 'shots', 'state_log.json'), JSON.stringify(stateLog));
}
await browser.close();

