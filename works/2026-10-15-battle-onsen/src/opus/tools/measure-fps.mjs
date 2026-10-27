// Frame cost at 1920x1080 on this machine's GPU, per preset and toggle state.
// Loads the page in capture mode (its own loop stopped), renders frames through window.battle.step and forces the GPU
// to finish each one with a one-pixel readback, so the time is real render time, not requestAnimationFrame pacing.
// It also times each frame on the GPU itself with EXT_disjoint_timer_query_webgl2; that number is less disturbed
// when other programs share the GPU, which wall time is not.
// Usage: node tools/measure-fps.mjs [port] [framesPerSample]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const port = Number(process.argv[2] || 5505);
const framesPerSample = Number(process.argv[3] || 400);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://localhost:${port}/?capture=1`);
await page.waitForFunction(() => window.battle && window.battle.ready, null, { timeout: 120000 });

const gpuName = await page.evaluate(() => {
  const context = window.sceneDebug.renderer.getContext();
  const extension = context.getExtension("WEBGL_debug_renderer_info");
  return extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unknown";
});
console.log(`GPU: ${gpuName}`);

async function timeFrames(frameCount) {
  return page.evaluate(async (count) => {
    const context = window.sceneDebug.renderer.getContext();
    const pixel = new Uint8Array(4);
    function renderSynced() {
      window.battle.step(1 / 60, 1);
      context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
    }
    for (let warmup = 0; warmup < 30; warmup += 1) {
      renderSynced();
    }
    const frameTimes = [];
    for (let frame = 0; frame < count; frame += 1) {
      const start = performance.now();
      renderSynced();
      frameTimes.push(performance.now() - start);
    }
    frameTimes.sort((first, second) => first - second);
    const average = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
    const gpuTimes = await timeFramesOnGpu(context, count);
    return {
      averageMilliseconds: average,
      medianMilliseconds: frameTimes[Math.floor(frameTimes.length / 2)],
      slowMilliseconds: frameTimes[Math.floor(frameTimes.length * 0.95)],
      gpuMedianMilliseconds: gpuTimes.length ? gpuTimes[Math.floor(gpuTimes.length / 2)] : NaN,
      gpuSlowMilliseconds: gpuTimes.length ? gpuTimes[Math.floor(gpuTimes.length * 0.95)] : NaN,
      gpuSamples: gpuTimes.length,
    };

    // WebGL only hands out query results after the page has yielded, so the queries are collected first and
    // read once the frames are done.
    async function timeFramesOnGpu(gl, frames) {
      const timerExtension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      if (!timerExtension) {
        return [];
      }
      const queries = [];
      for (let frame = 0; frame < frames; frame += 1) {
        const query = gl.createQuery();
        gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, query);
        window.battle.step(1 / 60, 1);
        gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
        queries.push(query);
        if (frame % 20 === 19) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT);
      const times = [];
      for (const query of queries) {
        if (!disjoint && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
          times.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        }
        gl.deleteQuery(query);
      }
      return times.sort((first, second) => first - second);
    }
  }, frameCount);
}

const cases = [];
for (const progress of [0, 0.5, 1]) {
  for (const preset of ["morning", "golden", "blue", "night"]) {
    cases.push({ preset, progress, depthOfField: false, dslr: false });
  }
  cases.push({ preset: "night", progress, depthOfField: true, dslr: true });
}

for (const testCase of cases) {
  await page.evaluate(({ preset, progress, depthOfField, dslr }) => {
    window.battle.setPreset(preset, true);
    window.battle.setToggle("dof", depthOfField);
    window.battle.setToggle("dslr", dslr);
    window.battle.placeCamera(progress, 0, {});
  }, testCase);
  const result = await timeFrames(framesPerSample);
  const label = `${testCase.preset.padEnd(7)} p${testCase.progress} dof+dslr=${testCase.depthOfField}`;
  const average = result.averageMilliseconds.toFixed(2);
  const median = result.medianMilliseconds.toFixed(2);
  const slow = result.slowMilliseconds.toFixed(2);
  const fps = (1000 / result.averageMilliseconds).toFixed(0);
  const gpuMedian = result.gpuMedianMilliseconds.toFixed(2);
  const gpuSlow = result.gpuSlowMilliseconds.toFixed(2);
  console.log(`${label}: wall ${average} ms average (${fps} fps), ${median} ms median, ${slow} ms 95th percentile; GPU ${gpuMedian} ms median, ${gpuSlow} ms 95th (${result.gpuSamples} samples)`);
}

await browser.close();
