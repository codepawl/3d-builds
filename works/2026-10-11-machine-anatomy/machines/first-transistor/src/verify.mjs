// Checks the built page in headless Chrome and takes the review screenshots.
//   node verify.mjs
// 1. Drives the real page with the keyboard and the pointer: bias off and on, input level up to
//    clipping and down again, apart and back together, and compares what it shows with the pure model.
// 2. Checks the publishable copy (publish/first-transistor-anatomy.html).
// 3. Captures the figure on the deterministic clock: desktop, apart, bias off, phone width and a close-up.
import { mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { TransistorApi as Transistor } from "./model.mjs";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NAME = "first-transistor-anatomy";
const pageUrl = pathToFileURL(join(HERE, `${NAME}.html`)).href;
const publishFile = join(HERE, "publish", `${NAME}.html`);
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const problems = [];
let checks = 0;

function expect(condition, message) {
  checks += 1;
  if (!condition) problems.push(message);
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
}

function watch(page, requests = null) {
  page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text()}`));
  page.on("pageerror", (error) => problems.push(`page error: ${error}`));
  if (requests) page.on("request", (request) => requests.push(request.url()));
}

const readoutOf = (page) => page.evaluate(() => document.querySelector("[data-readout]").textContent);
const stateOf = (page) => page.evaluate(() => window.__transistor.state());
const textOf = (page, name) => page.evaluate((dyn) => document.querySelector(`[data-dyn="${dyn}"]`).textContent, name);

async function interact(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const page = await context.newPage();
  const requests = [];
  watch(page, requests);
  await page.goto(pageUrl);
  await page.waitForTimeout(700);

  const wanted = Transistor.describe(Transistor.createParameters());
  expect((await page.title()) === "First Transistor Anatomy", `title: ${await page.title()}`);
  expect((await readoutOf(page)) === wanted, `readout at the start: "${await readoutOf(page)}" (model: "${wanted}")`);
  const start = await stateOf(page);
  expect(start.charges > 0 && start.outflow > start.charges, `running: ${start.charges} charges cross, ${start.outflow} flow out`);
  expect((await page.locator("[data-sound]").getAttribute("aria-pressed")) === "false", "sound is off until asked for");
  const moved = await page.evaluate(async () => {
    const first = document.querySelector('[data-dyn="wave-out"]').getAttribute("d");
    await new Promise((resolve) => setTimeout(resolve, 400));
    return first !== document.querySelector('[data-dyn="wave-out"]').getAttribute("d");
  });
  expect(moved, "the output trace moves on its own");

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("b");
  await page.waitForTimeout(900);
  const off = await stateOf(page);
  expect((await readoutOf(page)) === "bias off · no gain", `B switches the batteries off: "${await readoutOf(page)}"`);
  expect(off.charges === 0 && off.outflow === 0, `bias off: no charges drawn (${off.charges}, ${off.outflow})`);
  expect((await textOf(page, "label-out")) === "output · 0.00 V swing", `bias off: ${await textOf(page, "label-out")}`);
  const levers = await page.evaluate(() => ["on", "off"].map((name) => getComputedStyle(document.querySelector(`[data-dyn="lever-${name}"]`)).display));
  expect(levers[0] === "none" && levers[1] !== "none", `the switch lever is drawn open (${levers.join(", ")})`);
  await page.locator("[data-bias]").click();
  expect((await readoutOf(page)) === wanted, "the Bias button switches them on again");
  await page.locator('[data-hit="bias"]').click({ force: true });
  expect((await readoutOf(page)) === "bias off · no gain", "a click on the drawn switch opens it");
  await page.locator('[data-hit="bias"]').focus();
  await page.keyboard.press("Enter");
  expect((await readoutOf(page)) === wanted, "Enter on the drawn switch closes it");

  await page.locator(".iso-stage").focus();
  for (let press = 0; press < 10; press++) await page.keyboard.press("ArrowRight");
  const loud = Transistor.measureGain(Transistor.createParameters({ inputLevel: 1 }));
  expect((await readoutOf(page)).endsWith("clipping"), `ten presses of the right arrow reach full input: "${await readoutOf(page)}"`);
  expect((await textOf(page, "label-out")) === `output · ${loud.outputSwing.toFixed(2)} V swing`, `clipped output label matches the model: ${await textOf(page, "label-out")}`);
  await page.locator("[data-level]").fill("20");
  const quiet = Transistor.measureGain(Transistor.createParameters({ inputLevel: 0.2 }));
  expect((await textOf(page, "label-out")) === `output · ${quiet.outputSwing.toFixed(2)} V swing`, `slider at 20: ${await textOf(page, "label-out")} (model ${quiet.outputSwing.toFixed(2)} V)`);
  expect((await textOf(page, "label-in")) === `input · ${quiet.inputSwing.toFixed(2)} V swing`, `slider at 20: ${await textOf(page, "label-in")}`);
  const shown = await stateOf(page);
  expect(Math.abs(shown.voltageGain - Transistor.smallSignalGain(Transistor.createParameters()).voltage) < 0.001, `gain on the page ${shown.voltageGain} is the model's`);

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__transistor.state().apart && window.__transistor.state().resting, null, { timeout: 30000 });
  expect((await readoutOf(page)) === "apart · paused", `Shift+E takes it apart: "${await readoutOf(page)}"`);
  const badges = await page.evaluate(() => Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) > 0.9).length);
  expect(badges === 7, `seven numbered assemblies (${badges} badges shown)`);
  const inside = await page.evaluate(() => {
    const frame = document.querySelector(".iso-stage").getBoundingClientRect();
    return Array.from(document.querySelectorAll("[data-badge]")).every((badge) => {
      const box = badge.getBoundingClientRect();
      return box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom;
    });
  });
  expect(inside, "every badge is inside the card while apart");
  const paused = await stateOf(page);
  expect(paused.charges === 0, "apart: no charges drawn");
  await page.locator("[data-apart]").click();
  await page.waitForFunction(() => !window.__transistor.state().apart && window.__transistor.state().resting, null, { timeout: 30000 });
  await page.waitForTimeout(1300);
  const again = await stateOf(page);
  expect(again.open === 0 && again.charges > 0, `back together it runs again (${again.charges} charges)`);
  const order = await page.evaluate(() => Array.from(document.querySelector('[data-dyn="world"]').children).map((node) => node.getAttribute("data-piece")).join(","));
  expect(order.split(",").length === 23 && order.startsWith("stand"), "the items are back in their assembled order");
  const others = requests.filter((url) => url !== pageUrl);
  expect(others.length === 0, `no request other than the page itself (${others.length})`);
  await context.close();
}

async function checkPublish(browser) {
  const text = readFileSync(publishFile, "utf8");
  expect(text.startsWith("<title>First Transistor Anatomy</title><style>"), "publish copy starts with the title and the styles");
  expect(!/<!doctype|<html|<head|<meta|<body/i.test(text), "publish copy has no doctype, html, head, meta or body tag");
  expect(text.includes('<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>'), "publish copy carries the light-theme start-up");
  expect(!/https?:\/\/(?!www\.w3\.org)/.test(text) && !/\bfetch\(|localStorage|sessionStorage/.test(text), "publish copy has no outside URL, fetch or storage");
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();
  watch(page);
  // The host puts the copy inside the body of its own page; so does this check.
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${text}</body></html>`);
  await page.waitForTimeout(700);
  const facts = await page.evaluate(() => ({ theme: document.body.getAttribute("data-theme"), iso: document.body.classList.contains("iso"), readout: document.querySelector("[data-readout]").textContent, charges: window.__transistor.state().charges }));
  expect(facts.theme === "light" && facts.iso && facts.charges > 0, `publish copy runs on its own: theme ${facts.theme}, readout "${facts.readout}", ${facts.charges} charges`);
  await context.close();
}

async function capture(browser, viewport, file, search, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: options.scale ?? 1 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?clock=manual${search}`);
  await page.evaluate((seconds) => {
    for (let frame = 0; frame < seconds * 30; frame++) window.__transistor.advance(1 / 30);
  }, options.seconds ?? 3.3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow <= 0, `${file}: no sideways overflow at ${viewport.width} px (${overflow})`);
  if (options.clip) {
    const box = await page.locator(".iso-stage").boundingBox();
    const clip = { x: box.x + box.width * options.clip[0], y: box.y + box.height * options.clip[1], width: box.width * options.clip[2], height: box.height * options.clip[3] };
    await page.screenshot({ path: join(shots, file), clip });
  } else await page.screenshot({ path: join(shots, file), fullPage: true });
  await context.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
try {
  await interact(browser);
  await checkPublish(browser);
  await capture(browser, { width: 1000, height: 900 }, "desk-page.png", "");
  await capture(browser, { width: 1000, height: 900 }, "desk-apart.png", "&apart=1", { seconds: 0.1 });
  await capture(browser, { width: 1000, height: 900 }, "desk-bias-off.png", "&bias=off");
  await capture(browser, { width: 390, height: 844 }, "phone-page.png", "", { scale: 2 });
  await capture(browser, { width: 390, height: 844 }, "phone-apart.png", "&apart=1", { scale: 2, seconds: 0.1 });
  await capture(browser, { width: 1000, height: 900 }, "close-wedge.png", "", { scale: 4, clip: [0.3, 0.12, 0.42, 0.6] });
} finally {
  await browser.close();
}
console.log(`${checks} checks, ${problems.length} problems`);
if (problems.length) console.log(problems.join("\n"));
process.exit(problems.length ? 1 : 0);
