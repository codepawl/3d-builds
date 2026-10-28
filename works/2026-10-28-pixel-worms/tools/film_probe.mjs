import path from 'node:path';
// Fast probe of the film plan: no rendering, no screenshots. Usage: node film_probe.mjs [growth] [filmOptionsJson] [--eats]
// Prints a line every 30 frames and, with --eats, one line per eaten creature (frame, kind, where it stood).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, "..").split(path.sep).join("/");
const plan = JSON.parse(fs.readFileSync(`${ROOT}/tools/film_plan.json`, 'utf8'));
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const showEats = process.argv.includes('--eats');
const growth = positional[0] ?? '1.2';
const filmOptions = positional[1] ?? '{}';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.addInitScript({ path: `${ROOT}/tools/film_plan.js` });
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 300)));
await page.goto(`http://127.0.0.1:5471/?manual=1&growth=${growth}`, { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
const rows = await page.evaluate(([plan, filmOptions, showEats]) => {
  const film = window.__film; Object.assign(film, JSON.parse(filmOptions));
  const out = [];
  let previous = new Map(window.__app.creatures().map((creature) => [creature.id, creature]));
  let eatsPerSecond = 0;
  for (let frame = 0; frame < plan.totalFrames; frame++) {
    if (frame === plan.pullFrame) window.__app.pullBack(plan.pullAmount ?? 1);
    const goal = film.goalFor(frame, plan);
    const cursor = film.nextCursor(goal);
    window.__app.setCursor(cursor.x, cursor.y);
    const state = window.__app.step(1, frame % 10 === 0);
    for (const hazard of state.hazardEvents) out.push(`  HAZARD t${(frame / 60).toFixed(2)} ${hazard.kind} killed=${hazard.killed} at ${hazard.x.toFixed(0)},${hazard.z.toFixed(0)} screen=${hazard.screen.x.toFixed(0)},${hazard.screen.y.toFixed(0)} worms=${state.wormCount}`);
    const now = new Map(window.__app.creatures().map((creature) => [creature.id, creature]));
    for (const [id, creature] of previous) {
      if (now.has(id)) continue;
      eatsPerSecond += 1;
      if (showEats) out.push(`  EAT f${frame} t${(frame / 60).toFixed(2)} ${creature.kind} at ${creature.x.toFixed(0)},${creature.z.toFixed(0)} worms=${state.wormCount}`);
    }
    previous = now;
    if (frame % 60 === 59) {
      const camera = state.camera;
      out.push(`t${((frame + 1) / 60).toFixed(0)}s worms=${state.wormCount} eaten=${state.creaturesEaten} (+${eatsPerSecond}) goal=${goal.label} front=${state.front.x.toFixed(0)},${state.front.z.toFixed(0)} cam=${camera.x.toFixed(0)},${camera.y.toFixed(0)},${camera.z.toFixed(0)}`);
      eatsPerSecond = 0;
    }
  }
  return out;
}, [plan, filmOptions, showEats]);
console.log(rows.join('\n'));
await browser.close();
