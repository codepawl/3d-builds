// Frame cost with one part of the scene switched off at a time, to find what is expensive.
// Usage: node tools/profile-parts.mjs [port] [frames]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const port = Number(process.argv[2] || 5505);
const frameCount = Number(process.argv[3] || 150);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://localhost:${port}/?capture=1`);
await page.waitForFunction(() => window.battle && window.battle.ready, null, { timeout: 120000 });

const experiments = {
  baseline: "",
  noReflection: "debug.water.renderReflection = () => {};",
  noSteam: "debug.steam.mesh.visible = false;",
  noSnowfall: "debug.scene.traverse((object) => { if (object.isPoints) object.visible = false; });",
  noShadows: "debug.renderer.shadowMap.enabled = false; debug.scene.traverse((object) => { if (object.material) [].concat(object.material).forEach((material) => { material.needsUpdate = true; }); });",
  basicShadows: "debug.renderer.shadowMap.type = 1; debug.scene.traverse((object) => { if (object.material) [].concat(object.material).forEach((material) => { material.needsUpdate = true; }); });",
  noPointLights: "for (const light of [debug.lights.lantern, debug.lights.paperLantern, debug.lights.shojiLight]) light.visible = false;",
  noPines: "debug.scene.traverse((object) => { if (object.isInstancedMesh) object.visible = false; });",
  baselineAgain: "",
};

for (const [name, setup] of Object.entries(experiments)) {
  await page.reload();
  await page.waitForFunction(() => window.battle && window.battle.ready, null, { timeout: 120000 });
  const milliseconds = await page.evaluate(
    ({ setupSource, count }) => {
      const debug = window.sceneDebug;
      new Function("debug", setupSource)(debug);
      window.battle.setPreset("night", true);
      window.battle.setToggle("dof", true);
      window.battle.setToggle("dslr", true);
      window.battle.placeCamera(0.5, 0, {});
      const context = debug.renderer.getContext();
      const pixel = new Uint8Array(4);
      const renderSynced = () => {
        window.battle.step(1 / 60, 1);
        context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
      };
      for (let warmup = 0; warmup < 30; warmup += 1) {
        renderSynced();
      }
      const start = performance.now();
      for (let frame = 0; frame < count; frame += 1) {
        renderSynced();
      }
      return (performance.now() - start) / count;
    },
    { setupSource: setup, count: frameCount }
  );
  console.log(`${name.padEnd(14)} ${milliseconds.toFixed(2)} ms`);
}
await browser.close();
