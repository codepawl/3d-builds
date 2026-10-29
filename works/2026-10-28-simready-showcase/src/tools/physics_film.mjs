// Records the physics showcase: the real viewer and the real physics page, driven only by mouse moves, clicks,
// drags and typing, at 1920x1080 and 30 fps on a virtual clock. Usage: node physics_film.mjs <framesFolder>
// Env: APP_URL (default http://127.0.0.1:5541/), BASE (dataset base passed to the pages, default /data/).
// Every input goes to out/physics_input_events.json with its frame, for the sound pass.
import { setPriority, constants as osConstants } from 'node:os';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL); // Chrome children inherit it
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const framesFolder = process.argv[2];
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5541/';
const base = process.env.BASE ?? '/data/';
const FPS = 30;
mkdirSync(framesFolder, { recursive: true });

const chromePath = process.env.CHROME_PATH;
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
page.on('pageerror', (error) => console.error('pageerror', error.message));
page.on('console', (message) => { if (message.type() === 'error') console.error('console', message.text()); });

await page.addInitScript(() => {
  let virtualNow = 0;
  let queue = [];
  let nextId = 1;
  performance.now = () => virtualNow;
  Date.now = () => 1.78e12 + virtualNow;
  window.requestAnimationFrame = (callback) => { queue.push(callback); return nextId++; };
  window.cancelAnimationFrame = () => {};
  window.__tick = () => {
    virtualNow += 1000 / 30;
    const callbacks = queue;
    queue = [];
    for (const callback of callbacks) callback(virtualNow);
  };
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.id = 'film-cursor';
    cursor.style.cssText = 'position:fixed;left:-50px;top:-50px;z-index:99;pointer-events:none;';
    cursor.innerHTML = '<svg viewBox="0 0 13 18" width="20" height="28" style="width:20px;height:28px"><path d="M1 1 L1 14 L4.4 10.9 L6.9 16.6 L9 15.7 L6.6 10.2 L11 10 Z" fill="#ffffff" stroke="#15171a" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    document.body.append(cursor);
    window.addEventListener('mousemove', (event) => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; }, true);
    const caption = document.createElement('div');
    caption.id = 'film-caption';
    caption.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:98;padding:10px 18px;border-radius:12px;'
      + 'background:#15171a;color:#fff;font:600 19px Inter,system-ui,sans-serif;letter-spacing:-0.01em;white-space:nowrap;opacity:0;transition:none;pointer-events:none;';
    document.body.append(caption);
  });
});

let frameIndex = 0;
let cursor = { x: 900, y: 520 };
const inputEvents = [];
const logInput = (kind, target) => inputEvents.push({ frame: frameIndex, kind, target });
const smooth = (progress) => progress * progress * (3 - 2 * progress);
const seconds = (value) => Math.round(value * FPS);

async function advance(frames, capture = true) {
  for (let index = 0; index < frames; index++) {
    await page.evaluate(() => window.__tick());
    if (!capture) continue;
    await page.screenshot({ path: `${framesFolder}/f${String(frameIndex).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
    frameIndex++;
  }
}

async function caption(text) {
  await page.evaluate((value) => {
    const element = document.getElementById('film-caption');
    element.textContent = value;
    element.style.opacity = value ? '1' : '0';
  }, text);
}

async function glideTo(target, frames) {
  const from = { ...cursor };
  for (let index = 1; index <= frames; index++) {
    const [x, y] = typeof target === 'function' ? await target() : target;
    const eased = smooth(index / frames);
    cursor = { x: from.x + (x - from.x) * eased, y: from.y + (y - from.y) * eased };
    await page.mouse.move(cursor.x, cursor.y);
    await advance(1);
  }
}

async function click(target, name, glideFrames = 22) {
  await glideTo(target, glideFrames);
  logInput('click', name);
  await page.mouse.down();
  await advance(2);
  await page.mouse.up();
}

/** Press at the cursor, move to a point over some frames, release. */
async function drag(to, frames, name) {
  logInput('click', `${name}.grab`);
  await page.mouse.down();
  await advance(2);
  const from = { ...cursor };
  for (let index = 1; index <= frames; index++) {
    const [x, y] = typeof to === 'function' ? await to() : to;
    const eased = smooth(index / frames);
    cursor = { x: from.x + (x - from.x) * eased, y: from.y + (y - from.y) * eased };
    await page.mouse.move(cursor.x, cursor.y);
    if (index % 6 === 0) logInput('drag', name);
    await advance(1);
  }
  await page.mouse.up();
  logInput('release', name);
}

async function centerOf(selector) {
  const box = await page.locator(selector).first().boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** Where a range input's thumb sits for a value fraction, and where it goes for another. */
async function sliderPoint(selector, fraction) {
  const box = await page.locator(selector).first().boundingBox();
  return [box.x + 8 + (box.width - 16) * fraction, box.y + box.height / 2];
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (await page.evaluate(predicate)) return;
    await advance(1, false);
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// ---------- scene 1: the viewer ----------

await page.goto(`${appUrl}?base=${base}`);
await waitUntil(() => document.querySelectorAll('#grid .tile').length > 20 && !document.getElementById('moving-only').hidden, 'grid');
await page.evaluate(() => document.fonts.ready);
await advance(6, false);
await page.mouse.move(cursor.x, cursor.y);
await caption('SimReady GLB now carries physics');
await advance(seconds(1.2));
await click(() => centerOf('#moving-only'), 'button:moving-parts', 26);
await caption('928 models with moving parts');
await advance(seconds(1.3));
await click(() => centerOf('#query'), 'input:search', 22);
for (const character of 'cabinet file') {
  logInput('key', character);
  await page.keyboard.type(character);
  await advance(3);
}
await advance(seconds(0.5));
await click(() => centerOf('a[href="#/m/cabinet_file_a01"]'), 'tile:cabinet', 24);
await caption('');
await waitUntil(() => document.getElementById('stage-status').classList.contains('done') && !document.getElementById('parts').hidden, 'cabinet');
await advance(4, false);
await advance(seconds(0.6));

const slider = (index) => `#part-list li:nth-child(${index}) input`;
await caption('Joints from the USD: hinges and slides');
await glideTo(() => sliderPoint(slider(3), 1), 24);
await drag(() => sliderPoint(slider(3), 0), seconds(1.3), 'slider:door');
await advance(seconds(0.3));
await glideTo(() => sliderPoint(slider(5), 0), 18);
await drag(() => sliderPoint(slider(5), 1), seconds(1.0), 'slider:drawer');
await advance(seconds(0.3));
await click(() => centerOf('#parts-open'), 'button:open-all', 22);
await advance(seconds(1.0));
const stage = await page.locator('#view').boundingBox();
await glideTo([stage.x + stage.width * 0.55, stage.y + stage.height * 0.6], 18);
await drag([stage.x + stage.width * 0.3, stage.y + stage.height * 0.55], seconds(1.2), 'orbit');
await advance(seconds(0.8));
await click(() => centerOf('#parts-reset'), 'button:reset', 22);
await advance(seconds(0.8));

// ---------- scene 2: the physics page ----------

await caption('');
await page.goto(`${appUrl}physics.html?base=${base}`);
await waitUntil(() => window.__ready === true, 'physics page');
await page.evaluate(() => document.fonts.ready);
await advance(2, false);
await page.mouse.move(cursor.x, cursor.y);
await caption('Real mass, friction and colliders, simulated in Rapier');
await advance(seconds(3.4));

const project = (point) => () => page.evaluate((value) => window.__project(...value), point);
const partCenter = (name) => page.evaluate((value) => window.__worldCenter(value), name);

await caption('Drag any part');
const door = await partCenter('door_03_obj_00');
await glideTo(project(door), 26);
await drag(project([door[0] + 0.55, door[1] - 0.05, door[2] + 0.35]), seconds(1.1), 'grab:door');
await advance(seconds(0.8));
const drawer = await partCenter('drawer_01_obj_00');
await glideTo(project([drawer[0] + 0.22, drawer[1], drawer[2]]), 22);
await drag(project([drawer[0] + 0.62, drawer[1], drawer[2]]), seconds(0.9), 'grab:drawer');
await advance(seconds(0.7));
const boxCenter = await page.evaluate(() => window.__modelCenter('box_cardboard_a01'));
if (boxCenter) {
  await glideTo(project(boxCenter), 24);
  await drag(project([boxCenter[0] - 0.4, boxCenter[1] + 1.4, boxCenter[2] - 0.3]), seconds(0.6), 'grab:box');
  await advance(seconds(1.2));
}
await caption('2,587 models · 5,546 joints · free on Hugging Face');
await glideTo([1180, 640], 30);
await advance(seconds(2.2));

mkdirSync(join(projectRoot, 'out'), { recursive: true });
writeFileSync(join(projectRoot, 'out', 'physics_input_events.json'), JSON.stringify(inputEvents, null, 2));
console.log('frames', frameIndex, 'inputs', inputEvents.length);
await browser.close();
