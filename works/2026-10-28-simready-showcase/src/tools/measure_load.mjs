// Measures load-to-first-frame in real Chrome (real clock) for raw and optimized glbs, and captures the raw V8's real
// failed render as an orbit of transparent stills. Needs the server from tools/serve.mjs (default port 5530).
// Usage: node measure_load.mjs   -> web/data/load_times.json, web/captures/v8raw_###.png
import { setPriority, constants as osConstants } from "node:os";
setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL); // Chrome children inherit it
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.APP_URL ?? 'http://127.0.0.1:5530';
const chromePath = process.env.CHROME_PATH;
const captureFolder = join(root, 'web', 'captures');
mkdirSync(captureFolder, { recursive: true });

const targets = [
  { id: 'vise_raw', url: 'models/test/equipment_bench_vise_a01.blender.glb', runs: 3 },
  { id: 'alternator_raw', url: 'models/test/electricalSystem_alternator_d01.blender.glb', runs: 3 },
  { id: 'alternator_opt', url: 'models/test/electricalSystem_alternator_d01.glb', runs: 3 },
  { id: 'vise_opt', url: 'models/vise.opt.glb', runs: 3 },
  { id: 'v8_opt', url: 'models/test/v8.nosimp.glb', runs: 3 },
  { id: 'v8_raw', url: 'models/test/engineAssembly_v8_engine_a01.blender.glb', runs: 1, capture: true },
];
const orbitFrames = 220;
const orbitDegreesPerFrame = 4 / 30;
const onlyId = process.env.ONLY ?? null;
import { existsSync, readFileSync } from "node:fs";
const jsonPath = join(root, "web", "data", "load_times.json");
const output = onlyId && existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")) : {};

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const target of targets) {
  if (onlyId && target.id !== onlyId) continue;
  const runs = [];
  for (let run = 0; run < target.runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const messages = [];
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) messages.push(message.text()); });
    await page.goto(`${base}/measure.html?url=${encodeURIComponent(target.url)}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 500 });
    const result = await page.evaluate(() => window.__result);
    const blobFailures = messages.filter((text) => text.includes('ERR_BLOB_OUT_OF_MEMORY'));
    runs.push({ ...result, consoleMessages: messages.length, blobOutOfMemory: blobFailures.length, sampleError: blobFailures[0] ?? messages[0] ?? null });
    if (target.capture && run === 0) {
      for (let index = 0; index < orbitFrames; index++) {
        const yaw = -30 + index * orbitDegreesPerFrame;
        await page.evaluate(([value]) => window.__renderAt(value, 14, 0.9), [yaw]);
        await page.screenshot({ path: join(captureFolder, `v8raw_${String(index).padStart(3, '0')}.png`), omitBackground: true });
      }
    }
    await page.close();
  }
  const times = runs.map((run) => run.firstFrameMs).sort((a, b) => a - b);
  output[target.id] = { url: target.url, runs, medianFirstFrameMs: times[Math.floor(times.length / 2)] };
  console.log(target.id, JSON.stringify(runs.map((run) => [Math.round(run.firstFrameMs), run.blobOutOfMemory])));
}
await browser.close();
output.orbitFrames = orbitFrames;
output.measuredAt = new Date().toISOString();
writeFileSync(jsonPath, JSON.stringify(output, null, 2));
