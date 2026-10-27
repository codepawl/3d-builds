// Checks the built page in headless Chrome and takes the review screenshots.
//   node verify.mjs
// 1. Drives the real page with the keyboard and the pointer: clears the cables, sets AAA, types AAAAA and
//    reads BDZGO off the readout; then ADU and three keys for the double step; then plugs a cable.
// 2. Captures the figure on the deterministic clock: mid-press, apart, phone width and a close-up.
import { mkdirSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageUrl = pathToFileURL(join(HERE, "enigma-anatomy.html")).href;
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const PRESS_SECONDS = 2.2;
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

const readoutOf = (page) => page.evaluate(() => document.querySelector("[data-readout]").textContent);

async function typeAndRead(page, letters) {
  for (const letter of letters) await page.keyboard.press(letter);
  await page.waitForFunction((count) => window.__enigma.state().input.endsWith(count.text) && window.__enigma.state().phase >= 1, { text: letters.toUpperCase() }, { timeout: 60000 });
  return page.evaluate(() => window.__enigma.state());
}

async function interact(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?tour=off`);
  await page.locator("[data-clear]").click();
  await page.locator("[data-reset]").click();
  await page.locator(".iso-stage").focus();
  const first = await typeAndRead(page, "aaaaa");
  expect(first.output === "BDZGO", `typed on the page: AAAAA -> ${first.output} (want BDZGO), rotors ${first.positions} (want AAF)`);
  expect(first.positions === "AAF", "five keys moved the right rotor five letters");

  await page.locator('[data-hit="socket"][data-letter="A"]').click({ force: true });
  await page.locator('[data-hit="socket"][data-letter="T"]').click({ force: true });
  const cables = await page.evaluate(() => document.querySelectorAll(".en-cable").length);
  expect(cables === 1, `two socket clicks plug one cable (${cables} drawn)`);
  // The middle of a rotor is behind its neighbour, so the click is sent to the rotor's own hit area.
  await page.locator('[data-hit="rotor"][data-rotor="2"]').dispatchEvent("click");
  expect((await readoutOf(page)).includes("AAG"), `a click on the right rotor turns it one letter on: ${await readoutOf(page)}`);
  await page.locator('[data-hit="key"][data-letter="Q"]').click({ force: true });
  await page.waitForFunction(() => window.__enigma.state().phase >= 1 && window.__enigma.state().input.endsWith("Q"));
  expect((await page.evaluate(() => window.__enigma.state().positions)) === "AAH", "a click on the Q key types it");

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__enigma.state().apart && window.__enigma.state().resting, null, { timeout: 30000 });
  expect((await readoutOf(page)).startsWith("apart"), `Shift+E takes it apart: ${await readoutOf(page)}`);
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => !window.__enigma.state().apart && window.__enigma.state().resting, null, { timeout: 30000 });
  expect((await page.evaluate(() => window.__enigma.state().open)) === 0, "and back together");
  await context.close();

  const stepping = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const second = await stepping.newPage();
  watch(second);
  await second.goto(`${pageUrl}?positions=ADU&plugs=none&tour=off`);
  await second.locator(".iso-stage").focus();
  const seen = [];
  for (const letter of "xyz") seen.push((await typeAndRead(second, letter)).positions);
  expect(seen.join(" ") === "ADV AEW BFX", `double step on the page: ADU -> ${seen.join(" -> ")}`);
  await stepping.close();
}

async function capture(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?clock=manual`);
  const card = page.locator(".iso-plate");
  await page.evaluate((seconds) => {
    window.__enigma.type("G");
    window.__enigma.advance(seconds);
  }, PRESS_SECONDS * 0.7);
  await card.screenshot({ path: join(shots, "desk-press.png") });
  const lit = await page.evaluate(() => {
    const drawn = Array.from(document.querySelectorAll('[data-dyn="segment"]')).filter((path) => path.getAttribute("d"));
    return { drawn: drawn.map((path) => path.getAttribute("data-segment")), lit: drawn.filter((path) => getComputedStyle(path).opacity === "1").length };
  });
  expect(lit.drawn.length >= 12 && lit.lit === lit.drawn.length && lit.drawn.includes("plugIn"), `mid-press with G on a cable: ${lit.lit} of ${lit.drawn.length} drawn path pieces lit, cable piece included`);
  const shown = await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll("[data-trace]"));
    const colourOf = (name) => getComputedStyle(document.querySelector(`[data-segment="${name}"]`)).stroke;
    return {
      letters: chips.map((chip) => chip.lastChild.textContent).join(""),
      wanted: window.__enigma.trace().map((stage) => stage.letter).join(""),
      places: chips.map((chip) => chip.firstChild.textContent),
      litChips: chips.filter((chip) => getComputedStyle(chip).opacity === "1").length,
      wayIn: colourOf("right"),
      wayBack: colourOf("leftBack"),
      reflector: colourOf("reflector"),
      readout: document.querySelector("[data-readout]").textContent,
      wiresAssembled: document.querySelector('[data-dyn="wires"]').getAttribute("d"),
    };
  });
  expect(shown.letters.length === 11 && shown.letters === shown.wanted, `letter trace on the page: ${shown.letters} (model: ${shown.wanted})`);
  expect(shown.letters[0] === "G" && shown.letters[1] === "L" && shown.places[1] === "cable", `the trace starts G, then the cable gives L (${shown.places[1]})`);
  expect(shown.litChips === 11, `all 11 trace chips lit while the key is held (${shown.litChips})`);
  expect(shown.wayIn !== shown.wayBack && shown.reflector === shown.wayBack, `two path colours: in ${shown.wayIn}, back ${shown.wayBack}, reflector with the way back`);
  expect(shown.readout.startsWith("windows 01 01 02"), `the readout gives the rotor windows: ${shown.readout}`);
  expect(shown.wiresAssembled === "", "the rotor's wires stay hidden while it is closed");
  const stack = await page.evaluate(() => window.__enigma.project([-20, -66, 86]));
  const box = await page.locator(".iso-stage svg").boundingBox();
  const scale = box.width / 580;
  await page.screenshot({ path: join(shots, "close-rotors.png"), clip: { x: box.x + stack[0] * scale - 130, y: box.y + stack[1] * scale - 105, width: 260, height: 210 }, scale: "device" });
  await page.evaluate((seconds) => {
    window.__enigma.advance(seconds);
    window.__enigma.setApart(true);
    for (let step = 0; step < 420; step++) window.__enigma.advance(1 / 60);
  }, PRESS_SECONDS * 0.4);
  await card.screenshot({ path: join(shots, "desk-apart.png") });
  expect(await page.evaluate(() => window.__enigma.state().resting && window.__enigma.state().open === 1), "apart pose reached on the manual clock");
  const opened = await page.evaluate(() => ({
    wires: (document.querySelector('[data-dyn="wires"]').getAttribute("d").match(/M/g) ?? []).length,
    shown: getComputedStyle(document.querySelector('[data-dyn="wires"]')).opacity,
    badges: Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) === 1).length,
  }));
  expect(opened.wires === 26 && opened.shown === "1", `apart, the right rotor shows its 26 wires (${opened.wires} drawn, opacity ${opened.shown})`);
  expect(opened.badges === 11, `eleven numbered assemblies apart (${opened.badges})`);
  await page.screenshot({ path: join(shots, "desk-page.png"), fullPage: true });
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const small = await phone.newPage();
  watch(small);
  await small.goto(`${pageUrl}?clock=manual`);
  await small.evaluate((seconds) => {
    window.__enigma.type("E");
    window.__enigma.advance(seconds);
  }, PRESS_SECONDS * 0.7);
  await small.locator(".iso-plate").screenshot({ path: join(shots, "phone-press.png") });
  await small.screenshot({ path: join(shots, "phone-page.png"), fullPage: true });
  const widths = await small.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  expect(widths.scroll <= widths.inner, `no sideways scroll at 390 px (${widths.scroll} vs ${widths.inner})`);
  await phone.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await interact(browser);
  await capture(browser);
} finally {
  await browser.close();
}
console.log(problems.length ? `verify failed: ${problems.length} problems\n${problems.join("\n")}` : `verify passed: ${checks} checks, no console errors`);
process.exit(problems.length ? 1 : 0);
