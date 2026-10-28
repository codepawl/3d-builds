// Stills for pass 2 (third-person open world). Virtual clock (performance.now and requestAnimationFrame pinned), the cursor
// is moved through __app.setCursor, fixed 1/30 s steps. A scripted "player" runs inside the page so a long run is a few calls.
// Usage: node shots.mjs [start,hunt,climb,end]    (all four by default; each one continues from the previous)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(import.meta.dirname, "..").split(path.sep).join("/");
const wanted = (process.argv[2] ?? 'start,hunt,climb,end').split(',');
const outputDir = path.join(ROOT, 'shots');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  let virtualNow = 1000;
  let nextId = 1;
  const queue = new Map();
  performance.now = () => virtualNow;
  window.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
  window.cancelAnimationFrame = (id) => queue.delete(id);
  window.__advanceVirtualFrame = (dtMs) => {
    virtualNow += dtMs;
    const callbacks = Array.from(queue.values());
    queue.clear();
    callbacks.forEach((callback) => callback(virtualNow));
  };
  // The scripted player: aims the cursor at the best goal each 3 ticks. spec = { kinds, point, stopWithin, ticks }.
  window.__drive = (spec) => {
    const app = window.__app;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    let done = 0;
    while (done < spec.ticks) {
      const state = app.state();
      let goal = spec.point ? { x: spec.point[0], z: spec.point[1], y: spec.point[2] ?? 0.5 } : null;
      if (!goal) {
        let bestScore = Infinity;
        for (const creature of app.creatures()) {
          const rank = spec.kinds.indexOf(creature.kind);
          if (rank < 0) continue;
          const distance = Math.hypot(creature.x - state.front.x, creature.z - state.front.z);
          const score = rank * 6 + distance;
          if (score < bestScore) { bestScore = score; goal = { x: creature.x, z: creature.z, y: 0.5 }; }
        }
      }
      if (!goal) break;
      if (spec.stopWithin && Math.hypot(goal.x - state.front.x, goal.z - state.front.z) < spec.stopWithin) break;
      const screen = app.worldToScreen(goal.x, goal.z, goal.y);
      const x = screen.behind ? 1880 : clamp(screen.x, 40, 1880);
      const y = screen.behind ? 760 : clamp(screen.y, 300, 1040);
      app.setCursor(x, y);
      app.step(3, false);
      done += 3;
    }
    return app.state();
  };
});
const page = await context.newPage();
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 300)));
page.on('console', (message) => { if (message.type() === 'error') console.log('console.error', message.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5471/?manual=1' + (process.env.QUERY ?? ''), { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}

const drive = (spec) => page.evaluate((arg) => window.__drive(arg), spec);
const log = (label, state) => console.log(label, JSON.stringify({ worms: state.wormCount, eaten: state.creaturesEaten, left: state.creaturesLeft, heading: +state.heading.toFixed(2) }));

async function snap(name, clip = null) {
  await page.evaluate(() => window.__app.render());
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), ...(clip ? { clip } : {}) });
  console.log(name, JSON.stringify(await page.evaluate(() => window.__app.state())));
}

const SMALL = ['chicken', 'rabbit', 'pig', 'deer', 'cow', 'villager'];
if (wanted.includes('start')) {
  // Cursor ring a few metres ahead of the 12 worms.
  await page.evaluate(() => { window.__app.setCursor(960, 640); window.__app.step(54, false); });
  await snap('01-start');
  await snap('01-start-crop', { x: 480, y: 300, width: 960, height: 540 });
}
if (wanted.includes('hunt')) {
  log('hunt small', await drive({ kinds: ['chicken', 'rabbit', 'pig'], ticks: 420 }));
  log('hunt pigs and deer', await drive({ kinds: ['pig', 'deer', 'rabbit'], ticks: 300 }));
  await snap('02-hunt');
}
if (wanted.includes('climb')) {
  log('feed', await drive({ kinds: SMALL, ticks: 2400 }));
  log('to the hamlet', await drive({ point: [72, 50, 1.0], stopWithin: 6, ticks: 2400 }));
  log('over the house', await drive({ point: [72, 44, 4.5], ticks: 360 }));
  await snap('03-climb');
}
if (wanted.includes('end')) {
  for (let round = 0; round < 12; round++) {
    const state = await drive({ kinds: SMALL, ticks: 1200 });
    log('feeding', state);
    if (state.wormCount >= 1400) break;
  }
  log('wander', await drive({ point: [-40, -20, 0.5], ticks: 900 }));
  await page.evaluate(() => window.__app.pullBack(1));
  await page.evaluate(() => window.__app.step(240, false));
  await snap('04-end');
  const timing = await page.evaluate(() => {
    const gl = document.getElementById('view').getContext('webgl2');
    let simTotal = 0;
    let drawTotal = 0;
    const frames = 40;
    for (let index = 0; index < frames; index++) {
      const t0 = Date.now();
      window.__app.step(1, false);
      const t1 = Date.now();
      window.__app.render();
      gl.finish();
      const t2 = Date.now();
      simTotal += t1 - t0;
      drawTotal += t2 - t1;
    }
    return { worms: window.__app.state().wormCount, simMsPerStep: simTotal / frames, drawMsPerFrame: drawTotal / frames, fps: 1000 / ((simTotal + drawTotal) / frames) };
  });
  console.log('timing', JSON.stringify(timing));
}
await browser.close();
