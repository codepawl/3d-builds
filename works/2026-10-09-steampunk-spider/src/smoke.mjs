import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";
import assert from "node:assert/strict";
setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const root = new URL("./artifacts/", import.meta.url);
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-renderer-backgrounding"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
try {
  await page.goto("http://127.0.0.1:5186/");
  await page.waitForFunction(() => window.spiderDebug?.ready, {
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: new URL("pixel.png", root).pathname.slice(1) });
  await page.locator("#pixel").click();
  await page.screenshot({
    path: new URL("smooth.png", root).pathname.slice(1),
  });
  const initial = await page.evaluate(() => spiderDebug.state);
  const point = await page.evaluate(() => spiderDebug.project(0, 2));
  await page.mouse.move(point.x, point.y, { steps: 20 });
  await page.waitForTimeout(8500);
  const walked = await page.evaluate(() => spiderDebug.state);
  assert.ok(
    Math.hypot(
      walked.position[0] - initial.position[0],
      walked.position[2] - initial.position[2],
    ) > 1,
    "pointer moves the spider",
  );
  assert.ok(walked.steps > initial.steps, "feet take procedural steps");
  await page.locator("#hop").click();
  await page.waitForTimeout(180);
  const vented = await page.evaluate(() => spiderDebug.state);
  assert.ok(vented.smokeCount > 0, "vent emits actual smoke particles");
  await page.waitForTimeout(1000);
  await page.locator("#terrain").click();
  await page.locator("[data-mood=bouncy]").click();
  await page.locator("#wander").click();
  await page.waitForTimeout(1500);
  const terrain = await page.evaluate(() => spiderDebug.state);
  assert.equal(terrain.terrain, true);
  assert.ok(terrain.position.every(Number.isFinite));
  await page.locator("#side").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: new URL("side.png", root).pathname.slice(1) });
  await page.locator("#reset").click();
  await page.locator("#world").focus();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(800);
  const keyboard = await page.evaluate(() => spiderDebug.state);
  assert.ok(keyboard.target[2] < 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: new URL("mobile.png", root).pathname.slice(1),
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "no horizontal overflow",
  );
  assert.deepEqual(errors, []);
  const report = { errors, initial, walked, vented, terrain, keyboard };
  await writeFile(new URL("smoke.json", root), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      errors,
      steps: walked.steps,
      smokeCount: vented.smokeCount,
      terrain: terrain.terrain,
      frameMs: terrain.frameMs,
    }),
  );
} finally {
  await browser.close();
}
