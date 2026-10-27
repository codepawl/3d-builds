// Stage cameras, playback and tour checks at 1920x1080. Usage: node check_stages.mjs [shots|checks|all] [stageIds...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] ?? 'all';
const wantedStages = process.argv.slice(3);
const outputDirectory = path.resolve('shots', 'stages');
fs.mkdirSync(outputDirectory, { recursive: true });
const baseUrl = `http://127.0.0.1:5434/?start=${process.env.START ?? 58}`;
const browserArguments = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl', '--disable-renderer-backgrounding'];

const browser = await chromium.launch({ headless: true, args: browserArguments });
const logs = [];

async function openPage(url = baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (message) => message.type() === 'error' && logs.push(`error: ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__plant && window.__sim && window.__app?.stages, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  return page;
}

const results = {};

if (mode === 'shots' || mode === 'all') {
  const page = await openPage();
  await page.evaluate(() => { window.__app.rig.orbitRate = 0; });
  const stages = await page.evaluate(() => window.__app.stages.map((stage) => ({ key: stage.key, id: stage.id, unitId: stage.unitId })));
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (wantedStages.length && !wantedStages.includes(stage.id)) continue;
    await page.keyboard.press(String(stage.key));
    await page.waitForTimeout(1400);
    // Wait for the stage's own event, then shoot just after it.
    const waitedFor = await page.evaluate(async (stageIndex) => {
      const sim = window.__sim;
      const eventTime = window.__app.stages[stageIndex].eventAfter(sim, sim.time);
      const startedAt = performance.now();
      while (sim.time < eventTime + 0.15 && performance.now() - startedAt < 40000) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return eventTime;
    }, index);
    const fraction = await page.evaluate((unitId) => {
      if (!unitId) return null;
      const bounds = window.__plant.boundsOfUnit(unitId);
      const camera = window.__camera;
      if (!bounds) return null;
      camera.updateMatrixWorld();
      const corners = [];
      for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
        const point = bounds.centre.clone();
        point.x += dx * bounds.size.x; point.y += dy * bounds.size.y; point.z += dz * bounds.size.z;
        point.project(camera);
        corners.push(point);
      }
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      return { width: (Math.max(...xs) - Math.min(...xs)) / 2, height: (Math.max(...ys) - Math.min(...ys)) / 2 };
    }, stage.unitId);
    const file = path.join(outputDirectory, `${stage.key}-${stage.id}.png`);
    await page.screenshot({ path: file });
    console.log('shot', stage.key, stage.id, 'event', waitedFor.toFixed(1), 'unit fraction of frame', fraction ? `w ${fraction.width.toFixed(2)} h ${fraction.height.toFixed(2)}` : 'n/a');
  }
  if (!wantedStages.length) {
    // Bar with the loader stage active, then a selected loader: following clears the bar marker; Close and Wide must stay outside the aircraft.
    await page.keyboard.press('9');
    await page.waitForTimeout(1500);
    await page.mouse.move(960, 600);
    await page.screenshot({ path: path.join(outputDirectory, '0-stage-bar-and-playback.png') });
    await page.evaluate(() => { window.__app.selectUnit('loader-1'); });
    await page.click('[data-follow="close"]');
    await page.waitForTimeout(1800);
    const followCheck = async (label) => {
      const info = await page.evaluate(() => {
        const camera = window.__camera;
        const bounds = window.__plant.boundsOfUnit('aircraft-1');
        const inside = Math.abs(camera.position.x - bounds.centre.x) < bounds.size.x / 2 && Math.abs(camera.position.y - bounds.centre.y) < bounds.size.y / 2 && Math.abs(camera.position.z - bounds.centre.z) < bounds.size.z / 2;
        const active = [...document.querySelectorAll('.stage-button.active')].map((element) => element.dataset.stage);
        return { cameraInsideAircraftBox: inside, activeStageButtons: active };
      });
      console.log('follow', label, JSON.stringify(info));
    };
    await followCheck('loader close');
    await page.evaluate(() => { window.__app.selectUnit('aircraft-1'); });
    for (const name of ['close', 'mid', 'wide']) {
      await page.click(`[data-follow="${name}"]`);
      await page.waitForTimeout(1800);
      await followCheck('aircraft ' + name);
      if (name === 'close') await page.screenshot({ path: path.join(outputDirectory, '0-follow-aircraft-close.png') });
    }
    await page.evaluate(() => { window.__app.selectUnit('loader-1'); window.__app.setSpeed(5); window.__app.setPaused(true); });
    await page.click('[data-follow="mid"]');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(outputDirectory, '0-card-follow-paused.png') });
    await page.evaluate(() => window.__app.setPaused(false));
  }
  await page.close();
}

if (mode === 'checks' || mode === 'all') {
  // 1. Pause freezes every moving thing: compare the pose of everything over one second.
  {
    const page = await openPage();
    const snapshot = () => page.evaluate(() => {
      const sim = window.__sim;
      const values = [sim.time, sim.state.accumulator];
      sim.trays.forEach((tray) => values.push(...tray.current, ...tray.previous));
      sim.activeEntries.forEach((entry) => values.push(entry.id, ...entry.current));
      sim.ambientBags.forEach((bag) => values.push(...bag.current));
      sim.trainParts.forEach((part) => values.push(...part.current));
      const signals = sim.signals;
      values.push(signals.craneX, signals.craneLift, signals.gantryPhase, signals.archPhase, signals.scanResultAge);
      return values;
    });
    await page.evaluate(() => { window.__app.setPaused(true); });
    await page.waitForTimeout(300);
    const before = await snapshot();
    await page.waitForTimeout(1000);
    const after = await snapshot();
    let maxDifference = 0;
    for (let index = 0; index < before.length; index += 1) {
      if (typeof before[index] === 'number') maxDifference = Math.max(maxDifference, Math.abs(before[index] - after[index]));
      else if (before[index] !== after[index]) maxDifference = Infinity;
    }
    // The rendered meshes too: compare world matrices of every plant mesh.
    const meshHash = () => page.evaluate(() => {
      let sum = 0;
      let count = 0;
      window.__plant.root.traverse((object) => {
        if (!object.isMesh && !object.isInstancedMesh) return;
        object.updateWorldMatrix(true, false);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) if (material?.map?.offset) sum += material.map.offset.x + material.map.offset.y;
        for (const value of object.matrixWorld.elements) sum += value;
        if (object.isInstancedMesh && object.instanceMatrix) for (let i = 0; i < object.instanceMatrix.array.length; i += 1) sum += object.instanceMatrix.array[i];
        count += 1;
      });
      return { sum, count };
    });
    const hashBefore = await meshHash();
    await page.waitForTimeout(1000);
    const hashAfter = await meshHash();
    results.pause = { values: before.length, maxDifference, meshCount: hashAfter.count, meshSumDifference: Math.abs(hashBefore.sum - hashAfter.sum) };
    // Step advances exactly one fixed step.
    const stepBefore = await page.evaluate(() => window.__sim.time);
    await page.evaluate(() => window.__app.stepOnce());
    const stepAfter = await page.evaluate(() => window.__sim.time);
    results.step = { advanced: stepAfter - stepBefore, expected: 1 / 60 };
    await page.close();
  }

  // 2. The first 20 events are identical at 1x, 5x and 0.25x.
  {
    const traces = {};
    for (const speed of [1, 5, 0.25]) {
      const page = await openPage();
      traces[speed] = await page.evaluate(async (speedValue) => {
        const sim = window.__sim;
        // Every page starts from the same seed and the same jump; compare the first 20 events after a fixed simulation time.
        const fromTime = 62;
        window.__app.setSpeed(speedValue);
        const startedAt = performance.now();
        const later = () => sim.state.eventTrace.filter((entry) => entry.time >= fromTime);
        while (later().length < 20 && performance.now() - startedAt < 90000) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const wall = (performance.now() - startedAt) / 1000;
        return { wall, events: later().slice(0, 20).map((entry) => `${entry.planId}:${entry.type}@${entry.time.toFixed(3)}`) };
      }, speed);
      await page.close();
    }
    const reference = traces[1].events.join('|');
    results.eventOrder = {
      count: traces[1].events.length,
      same5x: traces[5].events.join('|') === reference,
      same025x: traces[0.25].events.join('|') === reference,
      wallSeconds: { '1x': traces[1].wall, '5x': traces[5].wall, '0.25x': traces[0.25].wall },
      first3: traces[1].events.slice(0, 3),
    };
  }

  // 3. The tour visits every stage once, in order; a click stops it.
  {
    const page = await openPage();
    await page.evaluate(() => window.__app.setSpeed(5));
    await page.click('[data-tour]');
    const startedAt = Date.now();
    await page.waitForFunction(() => !window.__app.touring, null, { timeout: 240000 });
    const log = await page.evaluate(() => window.__app.tourLog.map((entry) => ({ ...entry })));
    results.tour = {
      wallSeconds: (Date.now() - startedAt) / 1000,
      keys: log.map((entry) => entry.key),
      allDone: log.every((entry) => entry.doneAt !== null && entry.doneAt >= entry.eventTime),
      eachOnce: new Set(log.map((entry) => entry.key)).size === log.length && log.length === 9,
    };
    await page.click('[data-tour]');
    await page.waitForTimeout(500);
    await page.mouse.click(900, 600);
    const stoppedByClick = await page.evaluate(() => !window.__app.touring);
    results.tour.clickStops = stoppedByClick;
    await page.mouse.move(900, 500);
    await page.mouse.down();
    await page.mouse.move(700, 520, { steps: 4 });
    await page.mouse.up();
    // Tour again, and stop it with a drag.
    await page.click('[data-tour]');
    await page.waitForTimeout(400);
    await page.mouse.move(900, 500);
    await page.mouse.down();
    await page.mouse.move(800, 520, { steps: 4 });
    await page.mouse.up();
    results.tour.dragStops = await page.evaluate(() => !window.__app.touring);
    await page.close();
  }

  // 4. Frame rate at 10x, and the status text.
  {
    const page = await openPage();
    await page.evaluate(() => window.__app.setSpeed(10));
    await page.keyboard.press('5');
    await page.waitForTimeout(2500);
    const measure = () => page.evaluate(() => new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        if (performance.now() - start < 4000) requestAnimationFrame(tick);
        else resolve((frames * 1000) / (performance.now() - start));
      };
      requestAnimationFrame(tick);
    }));
    const simStart = await page.evaluate(() => window.__sim.time);
    const fps10 = await measure();
    const simEnd = await page.evaluate(() => window.__sim.time);
    results.fps10x = { fps: Number(fps10.toFixed(1)), simSecondsPerRealSecond: Number(((simEnd - simStart) / 4).toFixed(2)) };
    await page.evaluate(() => window.__app.setSpeed(1));
    await page.waitForTimeout(500);
    results.fps1x = Number((await measure()).toFixed(1));
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
}

console.log(logs.slice(0, 10).join('\n'));
await browser.close();
