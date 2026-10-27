// Records a 1920x1080, 30 fps reel of the Titanic plate frame by frame, then encodes it.
// Playwright's fake clock drives requestAnimationFrame, so each frame advances exactly 1/30 s.
// Usage (Git Bash): node tools/record-reel.mjs [framesDir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(root, 'web');
const framesDir = process.argv[2] || path.join(root, 'out', 'reel-frames');
const FPS = 30;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const file = path.join(webRoot, decodeURIComponent(request.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message.slice(0, 200)));
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text().slice(0, 200)); });

await page.clock.install({ time: new Date('2026-10-26T10:00:00Z') });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
// keep fake time moving while fonts and shaders load
for (let attempt = 0; attempt < 900; attempt += 1) {
  await page.clock.runFor(100);
  if (await page.evaluate(() => Boolean(window.plate && window.plate.ready))) break;
  await page.waitForTimeout(60);
}
await page.addStyleTag({ content: '* { transition: none !important; }' });
const focus = {};
for (const id of ['stairs', 'dining', 'boilers', 'engines']) focus[id] = await page.evaluate((name) => window.plate.focusOf(name), id);
const home = await page.evaluate(() => window.plate.homeView());
await page.clock.runFor(1500);
await page.waitForTimeout(500);
const fakeNow = await page.evaluate(() => Date.now());
await page.clock.pauseAt(fakeNow + 100);

// Camera keyframes: seconds, view. Between two keys the camera eases (smoothstep); equal views hold.
const wide = (az, distance = home.distance) => ({ ...home, az, distance });
const close = (id, azShift = 0) => ({ ...focus[id], az: focus[id].az + azShift, el: Math.max(focus[id].el, 0.36) });
const keys = [
  { t: 0, view: wide(0.04, 520) },
  { t: 7.5, view: wide(0.36, 520) },
  { t: 10.5, view: close('stairs') },
  { t: 12.3, view: close('stairs', 0.12) },
  { t: 15, view: close('dining') },
  { t: 17.3, view: close('dining', 0.1) },
  { t: 20, view: close('boilers') },
  { t: 22.3, view: close('boilers', 0.1) },
  { t: 25, view: close('engines') },
  { t: 26.8, view: close('engines', 0.1) },
  { t: 30, view: wide(0.04, 520) },
  { t: 32, view: wide(0.04, 520) },
];
const smooth = (x) => x * x * (3 - 2 * x);
function viewAt(seconds) {
  let index = 0;
  while (index < keys.length - 2 && seconds > keys[index + 1].t) index += 1;
  const a = keys[index];
  const b = keys[index + 1];
  const x = Math.min(1, Math.max(0, (seconds - a.t) / (b.t - a.t)));
  const eased = x === 0 || x === 1 ? x : smooth(x);
  const mix = (p, q) => p + (q - p) * eased;
  return {
    target: a.view.target.map((value, i) => mix(value, b.view.target[i])),
    distance: mix(a.view.distance, b.view.distance),
    az: mix(a.view.az, b.view.az),
    el: mix(a.view.el, b.view.el),
  };
}

// Labels fade out over the first 0.6 s of the fly-in and come back once the camera is home again.
function uiOpacityAt(seconds) {
  if (seconds < 7.5) return 1;
  if (seconds < 8.1) return 1 - (seconds - 7.5) / 0.6;
  if (seconds < 30) return 0;
  if (seconds < 30.6) return (seconds - 30) / 0.6;
  return 1;
}

// Pre-roll: settle the labels at a mid-orbit view, freeze their slots, then park on the first view.
await page.evaluate(() => window.plate.keepLabels(true));
await page.evaluate((view) => window.plate.view(view), { ...home, az: 0.2, distance: 520 });
await page.clock.runFor(1500);
// the slot order is the one with the fewest leader crossings over the whole orbit, not just this view
const orbitViews = [];
for (let az = 0.04; az <= 0.361; az += 0.04) orbitViews.push(wide(az, 520));
await page.evaluate((views) => window.plate.lockLabels(true, views), orbitViews);
await page.clock.runFor(100);
await page.evaluate((view) => window.plate.view(view), viewAt(0));
await page.clock.runFor(1000);

const total = Math.round(keys[keys.length - 1].t * FPS);
let worstCrossings = 0;
const crossingFrames = [];
for (let frame = 0; frame < total; frame += 1) {
  await page.evaluate(([view, opacity]) => { window.plate.view(view); window.plate.setUiOpacity(opacity); }, [viewAt(frame / FPS), uiOpacityAt(frame / FPS)]);
  await page.clock.runFor(1000 / FPS);
  await page.screenshot({ path: path.join(framesDir, `f${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (uiOpacityAt(frame / FPS) > 0.05) {
    const crossings = await page.evaluate(() => window.plate.labelCrossings());
    if (crossings > 0) crossingFrames.push(frame);
    worstCrossings = Math.max(worstCrossings, crossings);
  }
  if (frame % 100 === 0) console.log('frame', frame, 'of', total);
}
console.log('leader crossings: worst', worstCrossings, 'frames with a crossing', crossingFrames.length, crossingFrames.slice(0, 10).join(','));
console.log('problems', JSON.stringify(problems));
await browser.close();
server.close();
