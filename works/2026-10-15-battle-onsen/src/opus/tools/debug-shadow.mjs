// Checks that the sun shadow map exists and is used.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto("http://localhost:5505/?capture=1");
await page.waitForFunction(() => window.battle && window.battle.ready === true, null, { timeout: 120000 });
const report = await page.evaluate(() => {
  window.battle.step(1 / 60, 2);
  const { renderer, scene, lights } = window.sceneDebug;
  const shadow = lights.sun.shadow;
  let receivers = 0;
  let casters = 0;
  scene.traverse((child) => {
    if (child.isMesh && child.receiveShadow) receivers += 1;
    if (child.isMesh && child.castShadow) casters += 1;
  });
  return {
    shadowEnabled: renderer.shadowMap.enabled,
    type: renderer.shadowMap.type,
    mapExists: Boolean(shadow.map),
    mapSize: shadow.map ? [shadow.map.width, shadow.map.height] : null,
    sunIntensity: lights.sun.intensity,
    sunPosition: lights.sun.position.toArray(),
    castShadow: lights.sun.castShadow,
    receivers,
    casters,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
