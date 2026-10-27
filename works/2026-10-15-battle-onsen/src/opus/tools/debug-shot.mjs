// Renders one debug view with ambient light removed, to check direct light and shadows.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("console", (message) => { if (message.text().startsWith("NORMALINFO")) console.log(message.text()); });
await page.goto("http://localhost:5505/?capture=1");
await page.evaluate(([variant, progress, pitch]) => { window.debugVariant = variant; window.debugProgress = progress; window.debugPitch = pitch; }, [process.argv[3] || "", Number(process.argv[4] ?? 0.5), Number(process.argv[5] ?? -0.2)]);
await page.waitForFunction(() => window.battle && window.battle.ready === true, null, { timeout: 120000 });
await page.evaluate(() => {
  window.battle.setPreset("morning", true);
  window.battle.placeCamera(window.debugProgress ?? 0.5, 0, { yawOffset: 0, pitch: window.debugPitch ?? -0.2 });
  window.battle.step(1 / 60, 2);
  const { scene, lights } = window.sceneDebug;
  lights.hemisphere.intensity = 0;
  scene.environmentIntensity = 0;
  if (window.debugVariant === "noshadow") lights.sun.castShadow = false;
  if (window.debugVariant === "normalpixels") { scene.traverse((child) => { if (child.isMesh && child.material.name === "ground" && child.material.normalMap) { const image = child.material.normalMap.image; const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); const data = context.getImageData(0, 0, canvas.width, canvas.height).data; const sums = [0, 0, 0]; for (let index = 0; index < data.length; index += 4) { sums[0] += data[index]; sums[1] += data[index + 1]; sums[2] += data[index + 2]; } const count = data.length / 4; console.log("NORMALINFO pixels " + sums.map((value) => (value / count).toFixed(1)).join(",") + " first " + Array.from(data.slice(0, 8)).join(",")); } }); }
  if (window.debugVariant === "nonormalall") scene.traverse((child) => { if (child.isMesh && child.material.normalMap) { child.material.normalMap = null; child.material.needsUpdate = true; } });
  if (window.debugVariant === "normalinfo") { const found = []; scene.traverse((child) => { if (child.isMesh && child.material.normalMap && found.length < 3) found.push([child.material.name, child.material.normalScale.toArray(), child.material.normalMap.colorSpace, child.geometry.attributes.tangent ? 1 : 0]); }); console.log("NORMALINFO " + JSON.stringify(found)); }
  if (window.debugVariant === "noreceive") scene.traverse((child) => { if (child.isMesh && child.material.name === "ground") { child.receiveShadow = false; child.material.needsUpdate = true; } });
  if (window.debugVariant === "nocast") scene.traverse((child) => { if (child.isMesh && child.material.name === "ground") { child.castShadow = false; } });
  if (window.debugVariant === "nosteam") { window.sceneDebug.steam.material.uniforms.steamOpacity.value = 0; window.sceneDebug.steam.applyPreset = () => {}; lights.hemisphere.intensity = 0.55; scene.environmentIntensity = 0.55; }
  if (window.debugVariant === "plain") scene.traverse((child) => { if (child.isMesh && child.material.name === "ground") { child.material = new child.material.constructor({ color: 0xffffff }); } });
  if (window.debugVariant === "nonormal") scene.traverse((child) => { if (child.isMesh && child.material.name === "ground") { child.material.normalMap = null; child.material.needsUpdate = true; } });
  if (window.debugVariant === "auto") { window.sceneDebug.renderer.shadowMap.autoUpdate = true; }
  window.battle.step(1 / 60, 1);
});
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await page.screenshot({ path: process.argv[2] });
await browser.close();
