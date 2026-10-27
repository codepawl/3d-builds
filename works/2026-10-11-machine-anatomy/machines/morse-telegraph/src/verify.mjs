// Checks the built page in headless Chrome and takes the review screenshots.
//   node verify.mjs
// 1. Drives the real page with the keyboard and the pointer: types WHAT and reads WHAT off the tape,
//    holds the space bar, sends a letter with the button, takes the model apart and puts it back.
// 2. On the deterministic clock: keys the letter A by hand, checks the lit path, the levers, the marks
//    and the trace, and captures the figure mid-signal, apart, at phone width and close up.
import { mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageUrl = pathToFileURL(join(HERE, "morse-telegraph-anatomy.html")).href;
const publishFile = join(HERE, "publish", "morse-telegraph-anatomy.html");
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const PACE = 0.13;
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

const stateOf = (page) => page.evaluate(() => window.__morse.state());
const readoutOf = (page) => page.evaluate(() => document.querySelector("[data-readout]").textContent);

async function interact(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  watch(page);
  await page.goto(`${pageUrl}?tour=off`);
  await page.locator(".iso-stage").focus();
  for (const letter of "what") await page.keyboard.press(letter);
  await page.waitForFunction(() => window.__morse.state().read === "WHAT" && window.__morse.state().idle, null, { timeout: 60000 });
  const typed = await stateOf(page);
  expect(typed.sent === "WHAT" && typed.read === "WHAT", `typed on the page: WHAT sent, the tape reads ${typed.read} (${typed.marks} marks)`);
  expect((await readoutOf(page)).includes("tape reads WHAT"), `the readout decodes the tape: ${await readoutOf(page)}`);

  await page.locator("[data-clear]").click();
  expect((await stateOf(page)).marks === 0, "Clear the tape leaves no marks");
  await page.locator(".iso-stage").focus();
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__morse.state().closed, null, { timeout: 10000 });
  expect((await readoutOf(page)).startsWith("key down"), `holding the space bar closes the circuit: ${await readoutOf(page)}`);
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__morse.state().idle && window.__morse.state().marks === 1, null, { timeout: 10000 });
  expect((await stateOf(page)).marks === 1, "letting go leaves one mark on the tape");

  const knob = await page.locator('[data-hit="key"]').boundingBox();
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__morse.state().closed, null, { timeout: 10000 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__morse.state().idle && window.__morse.state().marks === 2, null, { timeout: 10000 });
  expect((await stateOf(page)).marks === 2, "pressing the key's knob with the mouse makes a second mark");

  await page.locator("[data-clear]").click();
  await page.locator("[data-step]").click();
  await page.waitForFunction(() => window.__morse.state().read === "W" && window.__morse.state().idle, null, { timeout: 30000 });
  expect((await stateOf(page)).read === "W", "Send next letter sends W, the first letter of the first message");

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__morse.state().apart && window.__morse.state().resting, null, { timeout: 30000 });
  expect((await readoutOf(page)).startsWith("apart"), `Shift+E takes it apart: ${await readoutOf(page)}`);
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => !window.__morse.state().apart && window.__morse.state().resting, null, { timeout: 30000 });
  expect((await stateOf(page)).open === 0, "and back together");
  const facts = await page.evaluate(() => ({
    title: document.title,
    sound: document.querySelector("[data-sound]").getAttribute("aria-pressed"),
    external: document.querySelectorAll("[src],link[href]").length,
    storage: /localStorage|sessionStorage|indexedDB/.test(document.documentElement.innerHTML),
    network: /\bfetch\(|XMLHttpRequest|https?:\/\//.test(document.documentElement.innerHTML.replace(/http:\/\/www\.w3\.org\/[\w/]+/g, "")),
  }));
  const others = requests.filter((url) => !url.startsWith(pageUrl));
  expect(facts.title === "Morse Telegraph Anatomy", `title "${facts.title}"`);
  expect(facts.sound === "false", "sound is off until the reader turns it on");
  expect(others.length === 0 && facts.external === 0 && !facts.storage && !facts.network, `self-contained: ${others.length} other requests, ${facts.external} elements with src or href, storage ${facts.storage}, fetch or URL ${facts.network}`);
  await context.close();
}

async function capture(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?clock=manual`);
  const card = page.locator(".iso-plate");
  // The letter A by hand: a short press, a short gap, a long press.
  const read = await page.evaluate((pace) => {
    const morse = window.__morse;
    const beats = (count) => morse.advance(count * pace);
    morse.press();
    beats(1);
    morse.release();
    beats(1);
    morse.press();
    beats(3.2);
    morse.release();
    beats(8);
    return morse.state();
  }, PACE);
  expect(read.read === "A" && read.marks === 2, `keyed by hand on the manual clock: dot, dash reads ${read.read} (${read.marks} marks)`);

  await page.evaluate((pace) => {
    window.__morse.clearTape();
    window.__morse.send("A");
    window.__morse.advance(4.4 * pace);
  }, PACE);
  await card.screenshot({ path: join(shots, "desk-press.png") });
  const lit = await page.evaluate(() => {
    const segments = Array.from(document.querySelectorAll('[data-dyn="segment"]'));
    const tilted = Array.from(document.querySelectorAll('[data-dyn="tilt"]')).filter((node) => node.getAttribute("transform"));
    const colourOf = (name) => getComputedStyle(document.querySelector(`[data-segment="${name}"]`)).stroke;
    return {
      drawn: new Set(segments.filter((path) => path.getAttribute("d")).map((path) => path.getAttribute("data-segment"))).size,
      lit: new Set(segments.filter((path) => path.getAttribute("d") && getComputedStyle(path).opacity === "1").map((path) => path.getAttribute("data-segment"))).size,
      tilted: tilted.length,
      line: colourOf("line"),
      local: colourOf("toRegister"),
      letter: document.querySelector('[data-trace="letter"]').textContent,
      elements: Array.from(document.querySelectorAll(".mt-element")).map((node) => `${node.getAttribute("data-kind")}${node.style.getPropertyValue("--glow")}`).join(" "),
      stripMarks: document.querySelectorAll(".mt-strip-mark").length,
      readout: document.querySelector("[data-readout]").textContent,
      state: window.__morse.state(),
    };
  });
  expect(lit.drawn === 11 && lit.lit === 11, `mid-dash: ${lit.lit} of ${lit.drawn} stretches of the two circuits lit`);
  expect(lit.tilted === 5, `key, relay and register levers are all pulled (${lit.tilted} tilted groups: the register lever is drawn in two, and its stylus once more over the tape)`);
  expect(lit.line !== lit.local, `two circuit colours: line ${lit.line}, local ${lit.local}`);
  expect(lit.letter === "A" && lit.elements === ".1 -1", `the trace names A and lights dot, dash (${lit.letter}: ${lit.elements})`);
  expect(lit.state.closed && lit.state.marking && lit.stripMarks === 2, `circuit closed, stylus on the tape, ${lit.stripMarks} marks on the strip`);
  expect(lit.readout === "key down · circuit closed · tape reads …", `readout: ${lit.readout}`);

  const marks = await page.evaluate((pace) => {
    window.__morse.advance(10 * pace);
    return { d: document.querySelector('[data-dyn="marks"]').getAttribute("d"), state: window.__morse.state() };
  }, PACE);
  expect((marks.d.match(/M/g) ?? []).length === 2 && marks.state.read === "A", `after the letter: 2 marks drawn on the tape, read back as ${marks.state.read}`);
  const stylus = await page.evaluate(() => window.__morse.project([128, 24, 34]));
  const box = await page.locator(".iso-stage svg").boundingBox();
  const scale = box.width / 580;
  await page.screenshot({ path: join(shots, "close-register.png"), clip: { x: box.x + stylus[0] * scale - 150, y: box.y + stylus[1] * scale - 120, width: 300, height: 240 }, scale: "device" });
  const key = await page.evaluate(() => window.__morse.project([-100, 0, 20]));
  await page.screenshot({ path: join(shots, "close-key.png"), clip: { x: box.x + key[0] * scale - 150, y: box.y + key[1] * scale - 120, width: 300, height: 240 }, scale: "device" });

  await page.evaluate(() => {
    window.__morse.setApart(true);
    for (let step = 0; step < 420; step++) window.__morse.advance(1 / 60);
  });
  await card.screenshot({ path: join(shots, "desk-apart.png") });
  const opened = await page.evaluate(() => ({
    state: window.__morse.state(),
    badges: Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) === 1).length,
    legend: document.querySelectorAll(".mt-parts li").length,
  }));
  expect(opened.state.resting && opened.state.open === 1, "apart pose reached on the manual clock");
  expect(opened.badges === 10 && opened.legend === 10, `ten numbered assemblies apart (${opened.badges} badges, ${opened.legend} legend lines)`);
  await page.screenshot({ path: join(shots, "desk-page.png"), fullPage: true });
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const small = await phone.newPage();
  watch(small);
  await small.goto(`${pageUrl}?clock=manual`);
  await small.evaluate((pace) => {
    window.__morse.send("WH");
    window.__morse.advance(21 * pace);
  }, PACE);
  await small.locator(".iso-plate").screenshot({ path: join(shots, "phone-press.png") });
  await small.screenshot({ path: join(shots, "phone-page.png"), fullPage: true });
  const widths = await small.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  expect(widths.scroll <= widths.inner, `no sideways scroll at 390 px (${widths.scroll} vs ${widths.inner})`);
  await phone.close();
}

async function published(browser) {
  // The publish copy has no document tags of its own: the host page supplies them, so the check does too.
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();
  watch(page);
  const copy = readFileSync(publishFile, "utf8");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${copy}</body></html>`);
  await page.waitForFunction(() => Boolean(window.__morse));
  await page.locator(".iso-stage").focus();
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__morse.state().read.endsWith("E"), null, { timeout: 30000 });
  const facts = await page.evaluate(() => ({ theme: document.body.getAttribute("data-theme"), iso: document.body.classList.contains("iso"), background: getComputedStyle(document.body).backgroundColor }));
  expect(copy.startsWith("<title>Morse Telegraph Anatomy</title><style>") && !/<!doctype|<html|<head|<meta|<body/i.test(copy), "the publish copy starts with the title and styles and has no document tags");
  expect(copy.includes('<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>'), "it carries the fixed light-theme lines");
  expect(facts.theme === "light" && facts.iso, `inside a host page it sets the light theme (${facts.theme}, background ${facts.background}) and sends a typed E`);
  await context.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await interact(browser);
  await capture(browser);
  await published(browser);
} finally {
  await browser.close();
}
console.log(problems.length ? `verify failed: ${problems.length} problems\n${problems.join("\n")}` : `verify passed: ${checks} checks, no console errors`);
process.exit(problems.length ? 1 : 0);
