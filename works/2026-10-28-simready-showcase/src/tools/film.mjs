// Records the film at 1920x1080, 30 fps, on a virtual clock. Usage: node film.mjs <framesFolder>
// Env: APP_URL (default http://127.0.0.1:5530/film.html), STRIDE (screenshot every Nth frame, default 1), END_FRAME.
// The page is driven only by real mouse moves, clicks, drags and a key press at the times in web/src/script.js;
// every input is logged to out/input_events.json and the page's own state changes to out/state_events.json.
import { setPriority, constants as osConstants } from 'node:os';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL); // Chrome children inherit it
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const framesFolder = process.argv[2];
const stride = Number(process.env.STRIDE ?? 1);
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5530/film.html';
mkdirSync(framesFolder, { recursive: true });

const chromePath = process.env.CHROME_PATH
  ?? undefined;
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (error) => console.error('pageerror', error.message));
page.on('console', (message) => { if (message.type() === 'error') console.error('console', message.text()); });

await page.addInitScript(() => {
  let virtualNow = 0;
  let queue = [];
  let nextId = 1;
  performance.now = () => virtualNow;
  Date.now = () => 1.78e12 + virtualNow;
  window.requestAnimationFrame = (callback) => { queue.push(callback); return nextId++; };
  window.__tick = () => {
    virtualNow += 1000 / 30;
    const callbacks = queue;
    queue = [];
    for (const callback of callbacks) callback(virtualNow);
  };
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.id = 'film-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 13 18" width="26" height="36"><path d="M1 1 L1 14 L4.4 10.9 L6.9 16.6 L9 15.7 L6.6 10.2 L11 10 Z" fill="#e9e5d8" stroke="#0b0b0d" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    document.body.append(cursor);
    window.addEventListener('mousemove', (event) => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
  });
});

await page.goto(appUrl);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 300000, polling: 250 });
const startError = await page.evaluate(() => window.__error ?? null);
if (startError) throw new Error(startError);
const script = await page.evaluate(() => window.__script);
const endFrame = Number(process.env.END_FRAME ?? Math.round(script.endSeconds * 30));

let frameIndex = 0;
let cursor = { x: 1500, y: 760 };
const inputEvents = [];
await page.mouse.move(cursor.x, cursor.y);

async function advance(frames) {
  for (let index = 0; index < frames; index++) {
    await page.evaluate(async () => { await window.__prepare(); window.__tick(); });
    if (frameIndex % stride === 0) await page.screenshot({ path: `${framesFolder}/f${String(frameIndex).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 95 });
    frameIndex++;
  }
}
const advanceTo = async (frame) => { if (frame > frameIndex) await advance(frame - frameIndex); };
const smooth = (progress) => progress * progress * (3 - 2 * progress);

async function glideTo(pointOf, frames) {
  const from = { ...cursor };
  for (let index = 1; index <= frames; index++) {
    const [x, y] = await pointOf();
    const to = x === 0 && y === 0 ? from : { x, y }; // the target is not laid out yet: hold
    const eased = smooth(index / frames);
    cursor = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
    await page.mouse.move(cursor.x, cursor.y);
    await advance(1);
  }
}
const logInput = (kind, target) => inputEvents.push({ frame: frameIndex, kind, target });
const point = (name, argument) => () => page.evaluate(([key, value]) => window.__points[key](value), [name, argument]);
const seconds = (value) => Math.round(value * 30);

async function clickAt(time, pointOf, target, glideFrames = 28) {
  await advanceTo(seconds(time) - glideFrames);
  await glideTo(pointOf, glideFrames);
  logInput('click', target);
  await page.mouse.down();
  await advance(2);
  await page.mouse.up();
}

await advanceTo(seconds(script.grab) - 36);
await glideTo(point('handle'), 36);
logInput('click', 'slider.grab');
await page.mouse.down();
let handleX = script.handleStartX;
for (const segment of script.dragSegments) {
  if (segment.hold !== undefined) { await advance(segment.hold); continue; }
  const startX = handleX;
  for (let index = 1; index <= segment.frames; index++) {
    handleX = startX + (segment.to - startX) * smooth(index / segment.frames);
    cursor = { x: handleX, y: cursor.y + Math.sin(index / 6) * 0.6 };
    await page.mouse.move(cursor.x, cursor.y);
    if (index % 6 === 0) logInput('drag', 'slider');
    await advance(1);
  }
}
await page.mouse.up();
await glideTo(async () => [1300, 760], 12);
await advanceTo(seconds(script.closeupKey));
logInput('key', 'Space');
await page.keyboard.press('Space');
for (const [index, time] of script.stepClicks.entries()) await clickAt(time, point('step', index), `row:step${index}`, 30);
await clickAt(script.setClick, point('set'), 'button:set', 36);
await glideTo(async () => [300, 920], 50);
await advanceTo(endFrame);

mkdirSync(join(projectRoot, 'out'), { recursive: true });
writeFileSync(join(projectRoot, 'out', 'input_events.json'), JSON.stringify(inputEvents, null, 2));
const { effectCues } = await import(pathToFileURL(join(projectRoot, 'web', 'src', 'script.js')).href);
writeFileSync(join(projectRoot, 'out', 'cue_events.json'), JSON.stringify(effectCues(script), null, 2));
writeFileSync(join(projectRoot, 'out', 'state_events.json'), JSON.stringify(await page.evaluate(() => window.__stateEvents), null, 2));
console.log('frames', frameIndex, 'inputs', inputEvents.length);
await browser.close();
