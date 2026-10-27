// Records shots/film-blender.mp4 (pass 1 kept shots/film.mp4): 30 s, 1920x1080, 30 fps, on a virtual clock that advances 1/30 s per captured frame.
// The app is driven only by real mouse moves, clicks, drags and wheel events, with a drawn cursor.
import { spawn } from 'node:child_process';
import os from 'node:os';
import { openPage } from './browser.mjs';

const OUTPUT = './shots/film-blender.mp4';
const FRAMES_PER_SECOND = 30;
const TOTAL_FRAMES = 30 * FRAMES_PER_SECOND;

// Runs in the page before any app code.
function installVirtualClock() {
  const frameMilliseconds = 1000 / 30;
  const epoch = new Date('2026-10-14T03:12:00Z').getTime();
  let virtualMilliseconds = 0;
  let callbacks = [];
  let nextId = 1;
  const RealDate = Date;
  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(epoch + virtualMilliseconds);
      } else {
        super(...args);
      }
    }
    static now() {
      return epoch + virtualMilliseconds;
    }
  }
  window.Date = VirtualDate;
  performance.now = () => virtualMilliseconds;
  window.requestAnimationFrame = (callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.push({ id, callback });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    callbacks = callbacks.filter((entry) => entry.id !== id);
  };
  window.__advanceFrame = () => {
    virtualMilliseconds += frameMilliseconds;
    const due = callbacks;
    callbacks = [];
    for (const entry of due) {
      entry.callback(virtualMilliseconds);
    }
  };

  const cursorSvg =
    '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2l16 12-7 1.2 4.2 7.6-3 1.6-4.2-7.8L4 21z" fill="#1d2030" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.className = 'film-cursor';
    cursor.innerHTML = cursorSvg;
    cursor.style.left = '960px';
    cursor.style.top = '560px';
    document.body.appendChild(cursor);
    const moveCursor = (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    };
    window.addEventListener('pointermove', moveCursor, true);
    window.addEventListener('pointerdown', () => (cursor.style.transform = 'translate(-3px, -2px) scale(0.85)'), true);
    window.addEventListener('pointerup', () => (cursor.style.transform = ''), true);
  });
}

const { browser, page, errors } = await openPage(installVirtualClock);

const encoder = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FRAMES_PER_SECOND), '-i', '-',
  '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  OUTPUT,
]);
os.setPriority(encoder.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
encoder.stderr.on('data', (data) => process.stderr.write(data));

let frameCount = 0;
let cursor = { x: 960, y: 560 };

async function captureFrame() {
  await page.evaluate(() => window.__advanceFrame());
  const image = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!encoder.stdin.write(image)) {
    await new Promise((resolve) => encoder.stdin.once('drain', resolve));
  }
  frameCount += 1;
}

async function hold(frames) {
  for (let index = 0; index < frames; index += 1) {
    await captureFrame();
  }
}

function easeInOut(progress) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

// Moves the real mouse toward a target over a number of frames; the target may move (a walking orglet).
async function moveTo(getTarget, frames) {
  const start = { ...cursor };
  for (let index = 1; index <= frames; index += 1) {
    const target = typeof getTarget === 'function' ? await getTarget() : getTarget;
    const progress = easeInOut(index / frames);
    cursor = { x: start.x + (target.x - start.x) * progress, y: start.y + (target.y - start.y) * progress };
    await page.mouse.move(cursor.x, cursor.y);
    await captureFrame();
  }
}

async function click() {
  await page.mouse.down();
  await captureFrame();
  await page.mouse.up();
  await captureFrame();
}

async function drag(delta, frames) {
  await page.mouse.down();
  const start = { ...cursor };
  for (let index = 1; index <= frames; index += 1) {
    const progress = easeInOut(index / frames);
    cursor = { x: start.x + delta.x * progress, y: start.y + delta.y * progress };
    await page.mouse.move(cursor.x, cursor.y);
    await captureFrame();
  }
  await page.mouse.up();
}

async function wheel(totalDelta, frames) {
  for (let index = 0; index < frames; index += 1) {
    await page.mouse.wheel(0, totalDelta / frames);
    await captureFrame();
  }
}

async function center(selector, index = 0) {
  const box = await page.locator(selector).nth(index).boundingBox();
  return { x: box.x + box.width * 0.35, y: box.y + box.height / 2 };
}

// Let the scene settle before the first recorded frame (not encoded).
for (let index = 0; index < 45; index += 1) {
  await page.evaluate(() => window.__advanceFrame());
}
await page.mouse.move(cursor.x, cursor.y);

// 0-5 s: slow orbit over the whole site while everyone moves.
await hold(10);
await drag({ x: -320, y: 0 }, 125);
await hold(15);

// 5-12 s: follow a walking orglet with the cursor and click it; its card opens and ticks.
const walkerId = await page.evaluate(() => {
  const world = window.__office.world;
  const space = world.spaces.find((candidate) => candidate.id === world.activeSpaceId);
  const onScreen = (orglet) => {
    const point = window.__office.project({ type: 'orglet', id: orglet.id });
    return point.x > 500 && point.x < 1350 && point.y > 260 && point.y < 760;
  };
  const walkers = space.orglets.filter((orglet) => orglet.path.length > 2 && onScreen(orglet));
  const fallback = space.orglets.filter((orglet) => !orglet.lead && onScreen(orglet));
  return (walkers[0] ?? fallback[0] ?? space.orglets[1]).id;
});
const walkerPoint = () => page.evaluate((id) => {
  const point = window.__office.project({ type: 'orglet', id });
  return { x: point.x, y: point.y - 4 };
}, walkerId);
await moveTo(walkerPoint, 50);
await click();
for (let index = 0; index < 156; index += 1) {
  await moveTo(walkerPoint, 1);
}

// 12-18 s: click a row in the list; the camera flies to that orglet.
const rowCount = await page.locator('.rows button').count();
const rowIndex = await page.evaluate((count) => {
  const world = window.__office.world;
  const space = world.spaces.find((candidate) => candidate.id === world.activeSpaceId);
  const selectedIndex = space.orglets.findIndex((orglet) => orglet.id === world.selection?.id);
  const working = space.orglets.findIndex((orglet, index) => index !== selectedIndex && !orglet.lead && orglet.phase === 'working');
  return Math.min(count - 1, working >= 0 ? working : (selectedIndex + 2) % count);
}, rowCount);
await moveTo(await center('.rows button', rowIndex), 40);
await click();
await moveTo({ x: cursor.x - 220, y: cursor.y - 120 }, 40);
await hold(98);

// 18-24 s: switch to another space; the world changes.
await moveTo(await center('.space-button'), 40);
await click();
await hold(12);
await moveTo(await center('.space-menu li button', 2), 26);
await click();
await moveTo({ x: 980, y: 520 }, 50);
await hold(50);

// 24-30 s: pull back to a wide shot.
await wheel(120, 90);
await drag({ x: 160, y: -40 }, 70);
await hold(TOTAL_FRAMES - frameCount);

encoder.stdin.end();
await new Promise((resolve) => encoder.on('close', resolve));
console.log('frames', frameCount, 'errors', JSON.stringify(errors.filter((text) => !text.includes('unmount a root')).slice(0, 5)));
await browser.close();
