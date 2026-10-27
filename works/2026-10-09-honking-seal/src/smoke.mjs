import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const engine = process.argv[2] || "three";
const output = new URL("./artifacts/" + engine + "/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--disable-renderer-backgrounding"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:5178/?engine=" + engine);
await page.waitForFunction(() => window.sealDebug?.ready);
await page.waitForTimeout(500);
await page.screenshot({
  path: new URL("desktop.png", output).pathname.slice(1),
  fullPage: true,
});
const bounds = await page.locator("#seal-canvas").boundingBox();
const center = {
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
};
await page.mouse.move(center.x, center.y);
await page.mouse.down();
await page.mouse.move(center.x, center.y - 160, { steps: 12 });
await page.waitForTimeout(200);
await page.screenshot({
  path: new URL("stretch.png", output).pathname.slice(1),
});
const stretched = await page.evaluate(() => window.sealDebug.state);
await page.mouse.move(center.x, center.y + 110, { steps: 16 });
await page.waitForTimeout(200);
await page.screenshot({
  path: new URL("squash.png", output).pathname.slice(1),
});
await page.mouse.up();
await page.waitForTimeout(1000);
const released = await page.evaluate(() => window.sealDebug.state);
await page.waitForTimeout(2300);
const idle = await page.evaluate(() => window.sealDebug.state);
await page.locator("#horn-toggle").click();
await page.locator("#seal-canvas").focus();
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(200);
const withoutHorn = await page.evaluate(() => window.sealDebug.state);
await page.locator("#horn-toggle").click();
await page.locator("#seal-canvas").focus();
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(200);
const withHorn = await page.evaluate(() => window.sealDebug.state);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await page.screenshot({
  path: new URL("mobile.png", output).pathname.slice(1),
  fullPage: true,
});
const report = { errors, stretched, released, idle, withoutHorn, withHorn };
await writeFile(new URL("smoke.json", output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
if (
  errors.length ||
  !stretched.dragging ||
  !stretched.notes.length ||
  released.offset.some((value) => Math.abs(value) > 0.01) ||
  idle.position !== 0 ||
  withoutHorn.position !== 0 ||
  withHorn.position !== 1 ||
  withHorn.audioState !== "running"
)
  process.exitCode = 1;
