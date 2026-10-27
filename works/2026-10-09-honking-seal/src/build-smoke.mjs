import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setPriority, constants } from "node:os";
setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "dist");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("http://seal.test/**", async (route) => {
  const pathname = new URL(route.request().url()).pathname;
  const filename = resolve(
    directory,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  try {
    const body = await readFile(filename);
    const contentTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".ttf": "font/ttf",
    };
    await route.fulfill({
      body,
      contentType:
        contentTypes[extname(filename)] || "application/octet-stream",
    });
  } catch {
    await route.fulfill({ status: 404, body: "Not found" });
  }
});
for (const engine of ["three", "67"]) {
  await page.goto((process.env.SEAL_URL || "http://seal.test/") + "?engine=" + engine);
  await page.waitForFunction(() => window.sealDebug?.ready);
  const box = await page.locator('#seal-canvas').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const audio = window.sealDebug.audio;
    window.pullAnalyser = audio.context.createAnalyser();
    audio.master.connect(window.pullAnalyser);
  });
  await page.mouse.move(x, y - 150, { steps: 12 });
  const inhale = await page.evaluate(() => window.sealDebug.state.position);
  const sfxPeak = await page.evaluate(() => {
    const values = new Float32Array(window.pullAnalyser.fftSize);
    window.pullAnalyser.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs));
  });
  await page.mouse.move(x, y + 50, { steps: 12 });
  const exhale = await page.evaluate(() => window.sealDebug.state.position);
  await page.mouse.up();
  const released = await page.evaluate(() => window.sealDebug.state.position);
  const rebound = [];
  for (let sample = 0; sample < 12; sample++) {
    await page.waitForTimeout(75);
    rebound.push(await page.evaluate(() => window.sealDebug.state.offset[1]));
  }
  if (!rebound.some(value => value > 0.01) || !rebound.some(value => value < -0.01))
    throw Error('Missing elastic rebound: ' + JSON.stringify(rebound));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 180, {steps:12});
  await page.waitForTimeout(180);
  await page.screenshot({path: new URL('./artifacts/breath-stretch-'+engine+'.png',import.meta.url).pathname.slice(1)});
  await page.mouse.up();
  await page.waitForTimeout(200);
  if (inhale !== 0 || exhale !== 1 || released !== 1 || sfxPeak > 0.001)
    throw Error(JSON.stringify({ engine, inhale, exhale, released, sfxPeak }));
  console.log(JSON.stringify({engine, inhale, exhale, released, sfxPeak}));
  await page.waitForTimeout(200);
  await page.locator("#seal-canvas").focus();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  const state = await page.evaluate(() => ({
    engine: window.sealDebug.engine,
    position: window.sealDebug.state.position,
    audio: window.sealDebug.state.audioState,
  }));
  console.log(JSON.stringify(state));
  if (
    state.engine !== "three" ||
    state.position !== 3 ||
    state.audio !== "running"
  )
    process.exitCode = 1;
  const beforeOrbit = await page.evaluate(() => window.sealDebug.camera.position.toArray());
  await page.mouse.move(box.x + 20, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 100, {steps:12});
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterOrbit = await page.evaluate(() => window.sealDebug.camera.position.toArray());
  if (Math.hypot(...beforeOrbit.map((value,index)=>value-afterOrbit[index])) < 0.2) throw Error('Orbit failed');
  const beforeZoom = await page.evaluate(() => window.sealDebug.camera.position.length());
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  const afterZoom = await page.evaluate(() => window.sealDebug.camera.position.length());
  if (Math.abs(beforeZoom - afterZoom) < 0.2) throw Error('Zoom failed');
  const idleBefore = await page.evaluate(() => window.sealDebug.seal.group.scale.y);
  await page.waitForTimeout(250);
  const idleAfter = await page.evaluate(() => window.sealDebug.seal.group.scale.y);
  if (Math.abs(idleBefore-idleAfter)<0.00001) throw Error('Idle animation failed');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    comingSoon: document.querySelector('.coming-soon')?.textContent,
    prototypeLink: Boolean(document.querySelector('a[data-engine="67"]')),
  }));
  if (mobile.overflow || mobile.prototypeLink || !mobile.comingSoon?.includes('coming soon'))
    throw Error(JSON.stringify(mobile));
  await page.screenshot({path:new URL('./artifacts/breath-mobile.png',import.meta.url).pathname.slice(1)});
  await page.setViewportSize({width:1280,height:720});
}
await browser.close();
console.log(JSON.stringify({ errors }));
if (errors.length) process.exitCode = 1;
