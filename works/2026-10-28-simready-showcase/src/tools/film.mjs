// 24 s film at 1920x1080, 30 fps, on a virtual clock. Usage: node film.mjs <framesFolder>
// Env: APP_URL (default http://127.0.0.1:5530/), STRIDE (screenshot every Nth frame, default 1), END_FRAME (default 720).
// The page is driven only by real mouse moves, clicks, drags and a key press; every input is logged to out/input_events.json.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const framesFolder = process.argv[2];
const stride = Number(process.env.STRIDE ?? 1);
const endFrame = Number(process.env.END_FRAME ?? 720);
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5530/';
mkdirSync(framesFolder, { recursive: true });

const chromePath = process.env.CHROME_PATH;
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
  window.requestAnimationFrame = (callback) => {
    queue.push(callback);
    return nextId++;
  };
  window.__tick = () => {
    virtualNow += 1000 / 30;
    const callbacks = queue;
    queue = [];
    for (const callback of callbacks) callback(virtualNow);
  };
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.id = 'film-cursor';
    cursor.innerHTML =
      '<svg viewBox="0 0 13 18" width="26" height="36"><path d="M1 1 L1 14 L4.4 10.9 L6.9 16.6 L9 15.7 L6.6 10.2 L11 10 Z" fill="#e9e5d8" stroke="#0b0b0d" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    document.body.append(cursor);
    window.addEventListener('mousemove', (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
  });
});

await page.goto(appUrl);
// requestAnimationFrame is replaced by the virtual clock, so poll on a timer.
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000, polling: 250 });
const startError = await page.evaluate(() => window.__error ?? null);
if (startError) throw new Error(startError);

let frameIndex = 0;
let cursor = { x: 1500, y: 700 };
const inputEvents = [];
await page.mouse.move(cursor.x, cursor.y);

async function advance(frames) {
  for (let index = 0; index < frames; index++) {
    await page.evaluate(() => window.__tick());
    if (frameIndex % stride === 0) await page.screenshot({ path: `${framesFolder}/f${String(frameIndex).padStart(4, '0')}.png` });
    frameIndex++;
  }
}

async function advanceTo(frame) {
  if (frame > frameIndex) await advance(frame - frameIndex);
}

const smooth = (progress) => progress * progress * (3 - 2 * progress);

async function glideTo(pointOf, frames) {
  const from = { ...cursor };
  for (let index = 1; index <= frames; index++) {
    const to = await pointOf();
    const eased = smooth(index / frames);
    cursor = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
    await page.mouse.move(cursor.x, cursor.y);
    await advance(1);
  }
}

const logInput = (kind, target) => inputEvents.push({ frame: frameIndex, kind, target });
const rowPoint = (id) => async () => {
  const [x, y] = await page.evaluate((rowId) => window.__app.rowPoint(rowId), id);
  return { x, y };
};
const selectorPoint = (selector) => async () => {
  const box = await page.locator(selector).first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const handlePoint = async () => {
  const [x, y] = await page.evaluate(() => window.__app.handlePoint());
  return { x, y };
};

// The click lands on `frame`: the glide runs just before it.
async function clickAt(frame, pointOf, target, glideFrames = 24) {
  await advanceTo(frame - glideFrames);
  await glideTo(pointOf, glideFrames);
  logInput('click', target);
  await page.mouse.down();
  await advance(2);
  await page.mouse.up();
}

async function dragFrom(startFrame, deltaX, frames, target) {
  await advanceTo(startFrame - 36);
  await glideTo(handlePoint, 36);
  logInput('click', `${target}.grab`);
  await page.mouse.down();
  const startX = cursor.x;
  for (let index = 1; index <= frames; index++) {
    cursor = { x: startX + deltaX * smooth(index / frames), y: cursor.y + Math.sin(index / 6) * 0.6 };
    await page.mouse.move(cursor.x, cursor.y);
    if (index % 6 === 0) logInput('drag', target);
    await advance(1);
  }
  await page.mouse.up();
}

const seconds = (value) => Math.round(value * 30);
await clickAt(seconds(4.5), rowPoint('turbo'), 'row:turbo');
await clickAt(seconds(6.1), selectorPoint('#spin'), 'button:spin', 30);
await clickAt(seconds(9.0), rowPoint('fan'), 'row:fan', 30);
await clickAt(seconds(13.0), rowPoint('vise'), 'row:vise', 30);
await dragFrom(seconds(15.0), 360, 36, 'vise.handle');
await clickAt(seconds(17.0), rowPoint('extinguisher'), 'row:extinguisher', 22);
await advanceTo(seconds(18.0));
await glideTo(async () => ({ x: 1250, y: 640 }), 20);
await advanceTo(seconds(18.8));
logInput('key', 'Space');
await page.keyboard.press('Space');
await clickAt(seconds(20.0), rowPoint('lineup'), 'row:lineup', 30);
await glideTo(async () => ({ x: 1330, y: 520 }), 70);
await advanceTo(endFrame);

mkdirSync(join(projectRoot, 'out'), { recursive: true });
writeFileSync(join(projectRoot, 'out', 'input_events.json'), JSON.stringify(inputEvents, null, 2));
writeFileSync(join(projectRoot, 'out', 'state_events.json'), JSON.stringify(await page.evaluate(() => window.__app.stateEvents), null, 2));
console.log('frames', frameIndex, 'inputs', inputEvents.length);
await browser.close();
