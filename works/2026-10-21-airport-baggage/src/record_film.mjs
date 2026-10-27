// Records the 30 s film with a virtual clock. Usage: node record_film.mjs [firstFrame] [lastFrame]
// Writes frames to shots/frames and progress to shots/film.log. Encode afterwards with encode_film.ps1.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { buildWorld } from './src/sim/layout.js';
import { createSimulation } from './src/sim/simulation.js';

const FPS = 30;
const TOTAL_FRAMES = 30 * FPS;
const firstFrame = Number(process.argv[2] ?? 0);
const lastFrame = Number(process.argv[3] ?? TOTAL_FRAMES - 1);
const framesDirectory = path.resolve('shots/frames');
const logPath = path.resolve('shots/film.log');
fs.mkdirSync(framesDirectory, { recursive: true });
const log = (text) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${text}\n`);
fs.writeFileSync(logPath, '');

// Plan the film from the simulation: pick the start time so the tracked bag tips into its chute at film second 11.6.
const planningSim = createSimulation(buildWorld(), { heroArrival: 60 });
const hero = planningSim.heroPlan;
const TIP_AT = 11.6;
const startTime = Math.round((hero.leaveTime - TIP_AT) * 100) / 100;
log(`hero arch ${hero.archTime.toFixed(2)} ct ${hero.ctEntryTime.toFixed(2)}-${hero.ctExitTime.toFixed(2)} leave ${hero.leaveTime.toFixed(2)} foot ${hero.footTime.toFixed(2)} start ${startTime}`);

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (error) => log(`pageerror ${error.message}`));

await page.addInitScript(() => {
  let virtualNow = 0;
  const realStart = Date.now();
  let nextId = 1;
  let callbacks = [];
  window.requestAnimationFrame = (callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.push({ id, callback });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    callbacks = callbacks.filter((entry) => entry.id !== id);
  };
  performance.now = () => virtualNow;
  Date.now = () => realStart + virtualNow;
  window.__advance = (milliseconds) => {
    virtualNow += milliseconds;
    const due = callbacks;
    callbacks = [];
    for (const entry of due) entry.callback(virtualNow);
  };
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
});

await page.goto(`http://127.0.0.1:5434/?film=1&start=${startTime}`, { waitUntil: 'load' });
for (let attempt = 0; attempt < 600; attempt += 1) {
  await page.evaluate(() => window.__advance(0));
  const ready = await page.evaluate(() => Boolean(window.__plant && window.__sim && window.__camera));
  if (ready) break;
  await page.waitForTimeout(100);
}
// A few frames at zero time step let the models settle (zero delta, nothing moves).
for (let index = 0; index < 4; index += 1) {
  await page.evaluate(() => window.__advance(0));
  await page.waitForTimeout(50);
}
const simStart = await page.evaluate(() => window.__sim.time);
log(`sim time at first frame ${simStart.toFixed(3)}`);

// ---- Helpers --------------------------------------------------------------------------------
const heroId = await page.evaluate(() => window.__sim.heroPlan.id);
const screenOfHero = () =>
  page.evaluate((id) => {
    const position = window.__plant.positionOfBag(id);
    if (!position) return null;
    const camera = window.__camera;
    const projected = position.clone().project(camera);
    return { x: (projected.x * 0.5 + 0.5) * 1920, y: (-projected.y * 0.5 + 0.5) * 1080 };
  }, heroId);
const centreOf = async (selector) => {
  const box = await page.locator(selector).first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

let cursor = { x: 1500, y: 700 };
let cursorGoal = null; // function returning {x, y} or null
let cursorSpeed = 0.2;
await page.mouse.move(cursor.x, cursor.y);

async function stepCursor() {
  if (!cursorGoal) return;
  const goal = await cursorGoal();
  if (!goal) return;
  cursor = { x: cursor.x + (goal.x - cursor.x) * cursorSpeed, y: cursor.y + (goal.y - cursor.y) * cursorSpeed };
  await page.mouse.move(cursor.x, cursor.y);
}

const captions = [
  [0.3, 4.4, 'Every bag rides belts, a scanner and a tilt-tray sorter'],
  [5.0, 8.4, 'Follow the pink bag: read, then scanned in the CT tunnel'],
  [8.6, 12.4, 'It rides a tray and tips into its chute'],
  [13.6, 18.4, 'Pick a flight and the camera flies to its chute'],
  [19.4, 24.0, 'Next site: make-up area and ramp'],
  [24.8, 29.6, 'Tugs, containers and a belt loader finish the trip'],
];

let dragging = false;
let wideDrag = false;
let wideFrame = 0;
let dragFrame = 0;
const done = { click: false, flightsTab: false, flightRow: false, siteButton: false, zoomOut: false };

for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
  const time = frame / FPS;

  // Captions
  const caption = captions.find(([from, to]) => time >= from && time < to);
  await page.evaluate((text) => window.__app.setState({ caption: text }), caption ? caption[2] : '');

  // Beat 1 (0 to 4.8 s): slow orbit is built in; a few real wheel notches ease the camera in.
  if (time < 4.6 && frame % 6 === 0) {
    await page.mouse.wheel(0, -4);
  }
  // Move the cursor toward the tracked bag from 3.2 s on.
  if (time >= 3.2 && !done.click) {
    cursorGoal = screenOfHero;
    cursorSpeed = time < 4.4 ? 0.12 : 0.5;
  }
  // Beat 2: click the moving bag at 4.8 s; its card opens and the camera follows.
  if (time >= 4.8 && !done.click) {
    const target = await screenOfHero();
    if (target) {
      await page.mouse.move(target.x, target.y);
      cursor = target;
      await page.mouse.down();
      await page.mouse.up();
      done.click = true;
      cursorGoal = null;
      log(`click hero at frame ${frame} screen ${target.x.toFixed(0)},${target.y.toFixed(0)}`);
      // Park the cursor on empty ground and start a slow real drag-orbit to keep the camera moving.
      cursor = { x: 1010, y: 800 };
      await page.mouse.move(cursor.x, cursor.y);
      await page.mouse.down();
      dragging = true;
      dragFrame = 0;
    }
  }
  if (dragging && time < 13.3) {
    dragFrame += 1;
    cursor = { x: 1010 - Math.floor(dragFrame / 12), y: 800 };
    await page.mouse.move(cursor.x, cursor.y);
  }
  if (dragging && time >= 13.3) {
    await page.mouse.up();
    dragging = false;
  }
  // Beat 3 (13.6 to 19 s): open the Flights tab, click a flight row, the camera flies to its chute.
  if (time >= 13.4 && !done.flightsTab) {
    cursorGoal = () => centreOf('button[data-tab="flights"]');
    cursorSpeed = 0.18;
  }
  if (time >= 14.4 && !done.flightsTab) {
    await page.mouse.click(cursor.x, cursor.y);
    done.flightsTab = true;
    cursorGoal = () => centreOf('button[data-row="flight"][data-flight="MA 530"]');
    cursorSpeed = 0.2;
    log(`flights tab at frame ${frame}`);
  }
  if (time >= 15.6 && done.flightsTab && !done.flightRow) {
    await page.mouse.click(cursor.x, cursor.y);
    done.flightRow = true;
    cursorGoal = null;
    log(`flight row at frame ${frame}`);
  }
  // Keep a slow wheel zoom going during the fly and hold so no frame repeats.
  if (done.flightRow && time >= 17.8 && time < 18.9 && frame % 5 === 0) {
    await page.mouse.wheel(0, 3);
  }
  // Beat 4 (19 to 24.5 s): switch site from the top bar.
  if (time >= 18.4 && !done.siteButton) {
    cursorGoal = () => centreOf('button[data-site="ramp"]');
    cursorSpeed = 0.16;
  }
  if (time >= 19.6 && !done.siteButton) {
    await page.mouse.click(cursor.x, cursor.y);
    done.siteButton = true;
    cursorGoal = null;
    log(`site switch at frame ${frame}`);
  }
  // Beat 5 (24.6 to 30 s): wheel out and drag up to a wide shot of the whole operation.
  if (time >= 24.6 && time < 28.2) {
    if (!wideDrag) {
      cursor = { x: 1010, y: 800 };
      await page.mouse.move(cursor.x, cursor.y);
      await page.mouse.down();
      wideDrag = true;
      wideFrame = 0;
    }
    wideFrame += 1;
    cursor = { x: 1010 - Math.floor(wideFrame * 0.7), y: 800 + Math.floor(wideFrame * 0.45) };
    await page.mouse.move(cursor.x, cursor.y);
    if (frame % 3 === 0) await page.mouse.wheel(0, 20);
  }
  if (time >= 28.2 && wideDrag) {
    await page.mouse.up();
    wideDrag = false;
  }
  await stepCursor();

  await page.evaluate(async () => {
    window.__advance(1000 / 30);
    await new Promise((resolve) => setTimeout(resolve, 6));
  });
  await page.screenshot({ path: path.join(framesDirectory, `frame_${String(frame).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 96 });
  if (frame % 30 === 0) {
    const simTime = await page.evaluate(() => window.__sim.time);
    log(`frame ${frame} film ${time.toFixed(2)} s sim ${simTime.toFixed(2)}`);
  }
}
log('done');
await browser.close();
