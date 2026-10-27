// Checks the built page in headless Chrome and takes the review screenshots.
//   node verify.mjs
// 1. Drives the real page with the keyboard and the pointer: switch on, read the readout, change the
//    voltage, let air in, fit a new filament, take it apart and put it back.
// 2. Captures the figure on the deterministic clock: off, the zoom frame mid-birth, lit, burnt out,
//    apart, a close-up of the filament, and the page at phone width.
// 3. Checks the publish copy: no doctype, html, head, meta or body tags, and it runs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NAME = "edison-light-bulb-anatomy";
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

function watch(page) {
  page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text()}`));
  page.on("pageerror", (error) => problems.push(`page error: ${error}`));
}

const stateOf = (page) => page.evaluate(() => window.__lamp.state());
const readoutOf = (page) => page.evaluate(() => document.querySelector("[data-readout]").textContent);

function play(page, seconds) {
  return page.evaluate((count) => {
    for (let step = 0; step < count; step++) window.__lamp.advance(1 / 60);
  }, Math.round(seconds * 60));
}

async function interact(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?tour=off`);
  const start = await stateOf(page);
  expect(!start.closed && start.kelvin === 295 && start.readout.startsWith("off"), `the page opens dark: "${start.readout}"`);
  expect(start.zoomAge < 0, "no zoom frame before the lamp is first switched on");

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__lamp.state().kelvin > 2090, null, { timeout: 30000 });
  const lit = await stateOf(page);
  expect(lit.closed && Math.abs(lit.amperes - 0.714) < 0.01, `Enter turns the key: ${lit.readout}`);
  expect(/^on · 0\.71 A · about 1,8[05]0 °C, yellow-white · lit for/.test(lit.readout), "the readout gives volts, amperes, a rough temperature and the time lit");
  await page.waitForFunction(() => window.__lamp.state().zoomAge > 3.3, null, { timeout: 30000 });
  const born = await page.evaluate(() => ({
    frame: getComputedStyle(document.querySelector('[data-dyn="zoom"]')).opacity,
    source: getComputedStyle(document.querySelector('[data-dyn="zoom-source"]')).opacity,
    ties: getComputedStyle(document.querySelector('[data-dyn="zoom-ties"]')).opacity,
    width: document.querySelector('[data-dyn="zoom-edge"]').getAttribute("width"),
  }));
  expect(born.frame === "1" && born.source === "0" && born.ties === "0", `after its birth only the zoom frame is left: frame ${born.frame}, source rectangle ${born.source}, dashed lines ${born.ties}, ${born.width} wide`);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => window.__lamp.state().volts === 90 && window.__lamp.state().kelvin < 2010, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const dimmer = await stateOf(page);
  expect(dimmer.brightness < lit.brightness && dimmer.amperes < lit.amperes, `two presses of arrow down: 90 V, brightness ${lit.brightness} -> ${dimmer.brightness}, ${dimmer.amperes} A`);
  await page.locator("[data-volts]").fill("115");
  await page.waitForFunction(() => window.__lamp.state().kelvin > 2240, null, { timeout: 30000 });
  expect((await stateOf(page)).brightness > lit.brightness, `the slider at 115 V: brighter (${(await stateOf(page)).brightness})`);

  await page.locator("[data-air]").click();
  await page.waitForFunction(() => window.__lamp.state().broken, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__lamp.state().brightness === 0, null, { timeout: 30000 });
  const burnt = await stateOf(page);
  expect(burnt.closed && burnt.amperes === 0 && burnt.readout.startsWith("filament burnt out"), `air let in: "${burnt.readout}"`);
  const pieces = await page.evaluate(() => (document.querySelector('[data-dyn="filament"]').getAttribute("d").match(/M/g) ?? []).length);
  expect(pieces === 2, `the burnt filament is drawn in ${pieces} pieces`);
  await page.locator("[data-mend]").click();
  await page.waitForFunction(() => window.__lamp.state().kelvin > 2200, null, { timeout: 30000 });
  expect(!(await stateOf(page)).broken, "a new filament lights again");

  await page.locator(".iso-stage").click({ position: { x: 40, y: 200 } });
  await page.waitForFunction(() => !window.__lamp.state().closed, null, { timeout: 30000 });
  expect(true, "a click on the figure turns the switch off");
  await page.locator("[data-switch]").click();
  await page.waitForFunction(() => window.__lamp.state().closed, null, { timeout: 30000 });

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__lamp.state().apart && window.__lamp.state().resting, null, { timeout: 30000 });
  const apart = await stateOf(page);
  expect(apart.readout.startsWith("apart") && !apart.wanted && apart.zoomShown === 0, `Shift+E switches it off, hides the zoom frame and takes it apart: "${apart.readout}"`);
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => !window.__lamp.state().apart && window.__lamp.state().resting, null, { timeout: 30000 });
  expect((await stateOf(page)).open === 0, "and back together");
  await context.close();
}

async function capture(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1250 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?clock=manual`);
  const card = page.locator(".iso-plate");
  await card.screenshot({ path: join(shots, "desk-off.png") });
  await page.evaluate(() => window.__lamp.setSwitch(true));
  await play(page, 0.85);
  await card.screenshot({ path: join(shots, "desk-birth.png") });
  const birth = await page.evaluate(() => ({
    age: window.__lamp.state().zoomAge,
    ties: (document.querySelector('[data-dyn="zoom-ties"]').getAttribute("d").match(/M/g) ?? []).length,
    tiesShown: getComputedStyle(document.querySelector('[data-dyn="zoom-ties"]')).opacity,
    source: getComputedStyle(document.querySelector('[data-dyn="zoom-source"]')).opacity,
    width: Number(document.querySelector('[data-dyn="zoom-edge"]').getAttribute("width")),
  }));
  expect(birth.age > 0.25 && birth.ties === 4 && birth.tiesShown === "1" && birth.source === "1" && birth.width > 30 && birth.width < 104, `mid-birth (${birth.age} s): source rectangle shown, four dashed lines, frame ${birth.width.toFixed(0)} of 104 wide`);
  await play(page, 4.5);
  await card.screenshot({ path: join(shots, "desk-lit.png") });
  const lit = await page.evaluate(() => {
    const drawn = Array.from(document.querySelectorAll('[data-dyn="segment"]'));
    const filament = document.querySelector('[data-dyn="filament"]');
    return {
      litSegments: drawn.filter((path) => getComputedStyle(path).opacity === "1").length,
      segments: drawn.length,
      colours: new Set(drawn.map((path) => getComputedStyle(path).stroke)).size,
      filament: getComputedStyle(filament).stroke,
      halo: getComputedStyle(document.querySelector('[data-dyn="halo"]')).opacity,
      chips: Array.from(document.querySelectorAll("[data-trace]")).filter((chip) => getComputedStyle(chip).opacity === "1").length,
    };
  });
  expect(lit.litSegments === 6 && lit.segments === 6 && lit.colours === 1, `lit: ${lit.litSegments} of ${lit.segments} pieces of the current path shown, in ${lit.colours} colour`);
  expect(lit.filament === "rgb(255, 226, 120)" && lit.halo === "1" && lit.chips === 4, `filament ${lit.filament}, halo ${lit.halo}, ${lit.chips} of 4 trace words lit`);
  const spot = await page.evaluate(() => window.__lamp.project([30, 0, 67]));
  const box = await page.locator(".iso-stage svg").boundingBox();
  const scale = box.width / 580;
  await page.screenshot({ path: join(shots, "close-filament.png"), clip: { x: box.x + spot[0] * scale - 90, y: box.y + spot[1] * scale - 110, width: 180, height: 230 }, scale: "device" });
  await page.evaluate(() => window.__lamp.letAirIn());
  await play(page, 0.5);
  await card.screenshot({ path: join(shots, "desk-burning.png") });
  await play(page, 3);
  await card.screenshot({ path: join(shots, "desk-burnt.png") });
  expect((await stateOf(page)).broken, "burnt out on the manual clock");
  await page.evaluate(() => {
    window.__lamp.mend();
    window.__lamp.setApart(true);
  });
  await play(page, 8);
  await card.screenshot({ path: join(shots, "desk-apart.png") });
  const opened = await page.evaluate(() => ({
    state: window.__lamp.state(),
    badges: Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) === 1).length,
    zoom: getComputedStyle(document.querySelector('[data-dyn="zoom"]')).opacity,
  }));
  expect(opened.state.resting && opened.state.open === 1 && opened.badges === 9 && opened.zoom === "0", `apart on the manual clock: ${opened.badges} numbered assemblies, zoom frame opacity ${opened.zoom}`);
  await page.screenshot({ path: join(shots, "desk-page.png"), fullPage: true });
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const small = await phone.newPage();
  watch(small);
  await small.goto(`${pageUrl}?clock=manual`);
  await small.evaluate(() => window.__lamp.setSwitch(true));
  await play(small, 5);
  await small.locator(".iso-plate").screenshot({ path: join(shots, "phone-lit.png") });
  await small.screenshot({ path: join(shots, "phone-page.png"), fullPage: true });
  const widths = await small.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  expect(widths.scroll <= widths.inner, `no sideways scroll at 390 px (${widths.scroll} vs ${widths.inner})`);
  await phone.close();
}

async function publishCopy(browser) {
  const text = readFileSync(publishFile, "utf8");
  expect(text.startsWith("<title>Edison Light Bulb Anatomy</title><style>"), "the publish copy starts with the title and the styles");
  expect(!/<!doctype|<html|<head|<meta|<body|<\/body|<\/html|<\/head/i.test(text), "it has no doctype, html, head, meta or body tags");
  expect(text.includes('<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>'), "it sets the light page colours and the two body attributes");
  const outside = text.replace(/http:\/\/www\.w3\.org\/[\w/]+/g, "");
  expect(!/https?:\/\/|\bfetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/.test(outside), "no external URL, fetch or storage in it");
  const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await context.newPage();
  watch(page);
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  // The publish copy is a fragment: a host page puts it inside its own body, as here.
  const hostFile = join(shots, "publish-host.html");
  writeFileSync(hostFile, `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${text}</body></html>`);
  await page.goto(`${pathToFileURL(hostFile).href}?clock=manual`);
  await page.evaluate(() => window.__lamp.setSwitch(true));
  await play(page, 4);
  const facts = await page.evaluate(() => ({ theme: document.body.getAttribute("data-theme"), iso: document.body.classList.contains("iso"), background: getComputedStyle(document.body).backgroundColor, kelvin: window.__lamp.state().kelvin }));
  expect(facts.theme === "light" && facts.iso && facts.background === "rgb(242, 242, 239)" && facts.kelvin > 2000 && requests.length === 1, `the publish copy runs: theme ${facts.theme}, background ${facts.background}, ${facts.kelvin} K, ${requests.length} request`);
  await page.locator(".iso-plate").screenshot({ path: join(shots, "publish-lit.png") });
  await context.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await interact(browser);
  await capture(browser);
  await publishCopy(browser);
} finally {
  await browser.close();
}
console.log(problems.length ? `verify failed: ${problems.length} problems\n${problems.join("\n")}` : `verify passed: ${checks} checks, no console errors`);
process.exit(problems.length ? 1 : 0);
