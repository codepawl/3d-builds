// Play-mode frame cost with 600 worms and several opponents on screen. Usage: node tools/perf_play.mjs [--base http://127.0.0.1:4177]
// Prints real requestAnimationFrame fps, then ms per frame split by worms, creatures, opponents and shadows, plus renderer.info.
import os from 'node:os';
import { createRequire } from 'node:module';

os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');
const index = process.argv.indexOf('--base');
const base = index >= 0 ? process.argv[index + 1] : 'http://127.0.0.1:4177';

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 200)));
await page.goto(`${base}/?play&notutorial&worms=700&seed=1`, { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 600; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
// Opponents come and go, so keep the field stocked: a fresh set every 2 s.
await page.evaluate(() => {
  const stock = () => {
    const swarm = window.__debug.swarm;
    if (swarm.count < 625) swarm.spawn(swarm.front.x, swarm.front.z, 625 - swarm.count); // hold the swarm near 625 while opponents thin it
    for (const kind of ['birds', 'hen', 'crows', 'farmer', 'hedgehog', 'badger', 'mower']) {
      if (window.__debug.hazards.opponents.list.filter((o) => o.kind === kind && !o.done).length === 0) window.__debug.spawnOpponent(kind);
    }
  };
  stock();
  window.__stocker = setInterval(stock, 1000);
});
await page.waitForTimeout(2500);

const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - start < 6000) requestAnimationFrame(tick);
        else resolve((frames * 1000) / (performance.now() - start));
      };
      requestAnimationFrame(tick);
    }),
);

const split = await page.evaluate(() => {
  clearInterval(window.__stocker);
  const debug = window.__debug;
  const gl = document.getElementById('view').getContext('webgl2');
  const time = (label, work, runs = 20) => {
    work();
    gl.finish();
    const start = performance.now();
    for (let run = 0; run < runs; run++) work();
    gl.finish();
    return [label, +((performance.now() - start) / runs).toFixed(2)];
  };
  const out = { worms: debug.swarm.count, opponents: debug.hazards.opponents.list.length };
  const rows = [];
  rows.push(time('sim step', () => window.__app.step(1, false)));
  // Which part of the sim step costs what (ms per step, wrapped methods).
  const parts = { swarm: debug.swarm, creatures: debug.creatures, hazards: debug.hazards, growth: debug.growth, chunks: debug.chunks, director: debug.director };
  const spent = {};
  for (const [name, owner] of Object.entries(parts)) {
    const original = owner.step.bind(owner);
    spent[name] = 0;
    owner.step = (...args) => {
      const started = performance.now();
      const result = original(...args);
      spent[name] += performance.now() - started;
      return result;
    };
  }
  const runs = 60;
  const stepStart = performance.now();
  for (let run = 0; run < runs; run++) window.__app.step(1, false);
  out.simTotalMs = +((performance.now() - stepStart) / runs).toFixed(2);
  out.simParts = Object.fromEntries(Object.entries(spent).map(([name, total]) => [name, +(total / runs).toFixed(2)]));
  rows.push(time('full render', () => window.__app.render()));
  debug.renderer.info.autoReset = false;
  const counts = (work) => {
    debug.renderer.info.reset();
    work();
    return `${debug.renderer.info.render.calls} calls, ${Math.round(debug.renderer.info.render.triangles / 1000)}k tris`;
  };
  const toggle = (label, object) => {
    object.visible = false;
    const row = time(`render without ${label}`, () => window.__app.render());
    row.push(counts(() => window.__app.render()));
    rows.push(row);
    object.visible = true;
  };
  toggle('worms', debug.wormRenderer.mesh);
  toggle('creatures', debug.creatures.group);
  toggle('opponents+hazards', debug.hazards.group);
  debug.sun.castShadow = false;
  rows.push(time('render without shadows', () => window.__app.render()));
  debug.sun.castShadow = true;
  out.rows = rows;
  out.info = counts(() => window.__app.render());
  return out;
});
console.log(JSON.stringify({ rafFps: +fps.toFixed(1), ...split }, null, 1));
await page.screenshot({ path: process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : 'NUL' }).catch(() => {});
await browser.close();
