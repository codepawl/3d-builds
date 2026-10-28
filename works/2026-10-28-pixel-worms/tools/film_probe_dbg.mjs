import path from 'node:path';
// Fast probe of the film plan: no rendering, no screenshots. Usage: node film_probe.mjs [growth]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, "..").split(path.sep).join("/");
const plan = JSON.parse(fs.readFileSync(`${ROOT}/tools/film_plan.json`, 'utf8'));
const growth = process.argv[2] ?? '4';
const filmOptions = process.argv[3] ?? '{}';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.addInitScript({ path: `${ROOT}/tools/film_plan.js` });
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 300)));
await page.goto(`http://127.0.0.1:5471/?manual=1&growth=${growth}`, { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
const rows = await page.evaluate(([plan, filmOptions]) => {
  const film = window.__film; Object.assign(film, JSON.parse(filmOptions)); 
  const out = [];
  let lastEaten = 0;
  for (let frame = 0; frame < plan.totalFrames; frame++) {
    if (frame === plan.pullFrame) window.__app.pullBack(1);
    const goal = film.goalFor(frame, plan);
    const cursor = film.nextCursor(goal);
    window.__app.setCursor(cursor.x, cursor.y);
    const state = window.__app.step(1, frame % 10 === 0);
    if (frame >= 100 && frame < 400 && frame % 20 === 0) {
      out.push(`f${frame} worms=${state.wormCount} goal=${goal.label}@${goal.x.toFixed(0)},${goal.z.toFixed(0)} front=${state.front.x.toFixed(0)},${state.front.z.toFixed(0)} cen=${state.centroid.x.toFixed(0)},${state.centroid.z.toFixed(0)} target=${state.target.x.toFixed(0)},${state.target.z.toFixed(0)} head=${state.heading.toFixed(2)} cur=${cursor.x.toFixed(0)},${cursor.y.toFixed(0)}`);
      lastEaten = state.creaturesEaten;
    }
  }
  return out;
}, [plan, filmOptions]);
console.log(rows.join('\n'));
await browser.close();
