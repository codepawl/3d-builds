// Checks the built page in headless Chrome and takes the review screenshots.
//   node verify.mjs
// 1. Runs the page on its deterministic clock and reads the engine's state: strokes, valves, flows, the
//    flywheel's turns and the governor's answer to a change of load.
// 2. Drives the real page with the pointer and the keyboard: pause, one stroke, load, apart and back.
// 3. Checks that the page and its publish copy are self-contained, and captures desktop and phone shots.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageFile = join(HERE, "watt-steam-engine-anatomy.html");
const publishFile = join(HERE, "publish", "watt-steam-engine-anatomy.html");
const pageUrl = pathToFileURL(pageFile).href;
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

const stateOf = (page) => page.evaluate(() => window.__watt.state());
const readoutOf = (page) => page.evaluate(() => document.querySelector("[data-readout]").textContent);

function runFor(page, seconds) {
  return page.evaluate((count) => {
    for (let step = 0; step < count; step++) window.__watt.advance(1 / 60);
    return window.__watt.state();
  }, Math.round(seconds * 60));
}

async function onTheClock(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${pageUrl}?clock=manual`);
  const first = await stateOf(page);
  expect(first.strokes === 0 && first.direction === "down" && first.share < 0.05, `the page starts at the top of a down stroke (stroke share ${first.share}, speed ${first.speed})`);

  // A third of the way down: steam above the piston, exhaust below it.
  const reached = await page.evaluate(() => {
    for (let step = 0; step < 600 && window.__watt.state().share < 0.4; step++) window.__watt.advance(1 / 120);
    const glowOf = (selector) => Number(getComputedStyle(document.querySelector(selector)).opacity);
    const strokeOf = (selector) => getComputedStyle(document.querySelector(selector)).stroke;
    const fillOf = (selector) => getComputedStyle(document.querySelector(selector)).fill;
    return {
      state: window.__watt.state(),
      flows: Object.fromEntries(["steamMain", "steamTop", "steamBottom", "exhaustTop", "exhaustBottom", "condensate"].map((name) => [name, glowOf(`[data-flow="${name}"]`)])),
      steamColour: strokeOf('[data-flow="steamTop"]'),
      exhaustColour: strokeOf('[data-flow="exhaustBottom"]'),
      fillAbove: [glowOf('[data-fill="top-steam"]'), fillOf('[data-fill="top-steam"]')],
      fillBelow: [glowOf('[data-fill="bottom-exhaust"]'), fillOf('[data-fill="bottom-exhaust"]')],
      otherFills: glowOf('[data-fill="top-exhaust"]') + glowOf('[data-fill="bottom-steam"]'),
      trace: document.querySelector('[data-trace="0"]').textContent,
      empty: Array.from(document.querySelectorAll("[data-dyn]")).filter((node) => !node.innerHTML && !node.getAttribute("d") && !node.getAttribute("transform")).map((node) => node.getAttribute("data-dyn")),
    };
  });
  expect(reached.state.direction === "down" && reached.flows.steamTop === 1 && reached.flows.exhaustBottom === 1 && reached.flows.steamBottom === 0 && reached.flows.exhaustTop === 0, `down stroke: steam runs to the top port and exhaust leaves the bottom port (${JSON.stringify(reached.flows)})`);
  expect(reached.steamColour !== reached.exhaustColour, `steam ${reached.steamColour} and exhaust ${reached.exhaustColour} are two colours`);
  expect(reached.fillAbove[0] > 0.4 && reached.fillBelow[0] > 0.4 && reached.otherFills === 0 && reached.fillAbove[1] === reached.steamColour && reached.fillBelow[1] === reached.exhaustColour, `the cylinder is filled steam above the piston, exhaust below (${reached.fillAbove[0]}, ${reached.fillBelow[0]})`);
  expect(reached.trace === "steam pushes piston down", `the trace reads "${reached.trace}"`);
  expect(reached.empty.length === 0, `every live slot is drawn (${reached.empty.length} empty: ${reached.empty.join(", ")})`);
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-run.png") });
  const spot = await page.evaluate(() => window.__watt.project([-76, 0, 96]));
  const box = await page.locator(".iso-stage svg").boundingBox();
  const scale = box.width / 580;
  await page.screenshot({ path: join(shots, "close-cylinder.png"), clip: { x: box.x + spot[0] * scale - 120, y: box.y + spot[1] * scale - 150, width: 240, height: 300 }, scale: "device" });
  const wheel = await page.evaluate(() => window.__watt.project([70, 0, 110]));
  await page.screenshot({ path: join(shots, "close-gears.png"), clip: { x: box.x + wheel[0] * scale - 150, y: box.y + wheel[1] * scale - 150, width: 300, height: 300 }, scale: "device" });

  const up = await page.evaluate(() => {
    for (let step = 0; step < 1200 && !(window.__watt.state().direction === "up" && window.__watt.state().share > 0.4); step++) window.__watt.advance(1 / 120);
    const glowOf = (selector) => Number(getComputedStyle(document.querySelector(selector)).opacity);
    return { state: window.__watt.state(), steamBottom: glowOf('[data-flow="steamBottom"]'), exhaustTop: glowOf('[data-flow="exhaustTop"]'), steamTop: glowOf('[data-flow="steamTop"]'), trace: document.querySelector('[data-trace="0"]').textContent };
  });
  expect(up.state.strokes === 1 && up.steamBottom === 1 && up.exhaustTop === 1 && up.steamTop === 0 && up.trace.endsWith("up"), `up stroke: the valves have changed over, steam below and exhaust above ("${up.trace}")`);

  const before = await stateOf(page);
  const ran = await runFor(page, 12);
  const strokes = ran.strokes - before.strokes;
  const turns = ran.sunTurns - before.sunTurns;
  expect(strokes >= 10 && Math.abs(turns - strokes) < 1.1, `12 s of running: ${strokes} strokes and ${turns.toFixed(2)} turns of the flywheel, one turn per stroke`);
  expect(ran.speed > 0.85 && ran.speed < 0.97, `at half load the speed holds at ${ran.speed} of nominal, throttle ${ran.throttle}, balls ${ran.ballDegrees} degrees`);

  await page.evaluate(() => window.__watt.setLoad(0.9));
  const heavy = await runFor(page, 14);
  await page.evaluate(() => window.__watt.setLoad(0.1));
  const light = await runFor(page, 14);
  expect(heavy.speed < ran.speed && heavy.throttle > ran.throttle && heavy.ballDegrees < ran.ballDegrees, `more load: slower (${heavy.speed}), balls lower (${heavy.ballDegrees} degrees), throttle wider (${heavy.throttle})`);
  expect(light.speed > ran.speed && light.throttle < ran.throttle && light.ballDegrees > ran.ballDegrees, `less load: faster (${light.speed}), balls higher (${light.ballDegrees} degrees), throttle closer (${light.throttle})`);
  expect(/^strokes \d+ · \d+ rpm · balls \d+° · throttle \d+%$/.test(light.readout), `the readout gives strokes and the governor's state: ${light.readout}`);

  await page.evaluate(() => {
    window.__watt.setLoad(0.5);
    window.__watt.setApart(true);
    for (let step = 0; step < 480; step++) window.__watt.advance(1 / 60);
  });
  const apart = await page.evaluate(() => ({
    state: window.__watt.state(),
    badges: Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) === 1).length,
    flows: Array.from(document.querySelectorAll("[data-flow]")).filter((path) => Number(getComputedStyle(path).opacity) > 0).length,
  }));
  expect(apart.state.resting && apart.state.open === 1 && apart.badges === 10 && apart.flows === 0, `apart on the manual clock: ${apart.badges} numbered assemblies, flow lines hidden (${apart.flows} shown), readout "${apart.state.readout}"`);
  const stopped = await runFor(page, 1);
  expect(stopped.strokes === apart.state.strokes && stopped.pistonZ === apart.state.pistonZ, "the engine stands still while it is apart");
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-apart.png") });
  await page.screenshot({ path: join(shots, "desk-page.png"), fullPage: true });
  await context.close();
}

async function byHand(browser) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
  const page = await context.newPage();
  watch(page);
  await page.goto(pageUrl);
  expect((await page.locator("[data-sound]").getAttribute("aria-pressed")) === "false", "sound is off until the reader turns it on");
  await page.waitForFunction(() => window.__watt.state().strokes >= 2, null, { timeout: 30000 });
  await page.locator("[data-pause]").click();
  const paused = await stateOf(page);
  await page.waitForTimeout(500);
  const later = await stateOf(page);
  expect(paused.paused && later.pistonZ === paused.pistonZ && later.readout.startsWith("paused"), `Pause stops the engine: ${later.readout}`);
  await page.locator("[data-step]").click();
  await page.waitForFunction((count) => window.__watt.state().strokes === count + 1 && window.__watt.state().paused, paused.strokes, { timeout: 30000 });
  const stepped = await stateOf(page);
  expect(stepped.share < 0.08 || stepped.share > 0.92, `One stroke plays to the next dead centre and stops (stroke share ${stepped.share}, ${stepped.direction})`);
  await page.locator(".iso-stage").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((count) => window.__watt.state().strokes === count + 1 && window.__watt.state().paused, stepped.strokes, { timeout: 30000 });
  expect(true, "the right arrow plays one more stroke");
  await page.keyboard.press("Space");
  expect(!(await stateOf(page)).paused, "Space runs it again");
  await page.locator("[data-load]").fill("90");
  expect((await stateOf(page)).load === 0.9, "the load slider sets the load to 90 per cent");
  await page.locator(".iso-stage").focus();
  await page.keyboard.press("ArrowDown");
  expect(Math.abs((await stateOf(page)).load - 0.85) < 1e-9, "arrow down takes 5 per cent of load off");
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__watt.state().apart && window.__watt.state().resting, null, { timeout: 30000 });
  expect((await readoutOf(page)).startsWith("apart"), `Shift+E takes it apart: ${await readoutOf(page)}`);
  await page.locator("[data-apart]").click();
  await page.waitForFunction(() => !window.__watt.state().apart && window.__watt.state().resting, null, { timeout: 30000 });
  const back = await stateOf(page);
  expect(back.open === 0, "Put together brings it back");
  await page.waitForFunction((count) => window.__watt.state().strokes > count, back.strokes, { timeout: 30000 });
  expect(true, "and it runs again");
  await context.close();
}

async function selfContained(browser) {
  writeFileSync(join(shots, "host.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(publishFile, "utf8")}</body></html>`);
  for (const [name, file] of [["page", pageFile], ["publish copy", publishFile]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const requests = [];
    watch(page);
    page.on("request", (request) => requests.push(request.url()));
    // The publish copy has no document tags of its own: the host page supplies them.
    if (name === "page") await page.goto(`${pathToFileURL(file).href}?clock=manual`);
    else {
      await page.goto(`${pathToFileURL(join(HERE, "shots", "host.html")).href}?clock=manual`);
    }
    const facts = await page.evaluate(() => {
      for (let step = 0; step < 50; step++) window.__watt.advance(1 / 60);
      const source = document.documentElement.innerHTML.replace(/http:\/\/www\.w3\.org\/[\w/]+/g, "");
      return {
        title: document.title,
        theme: document.body.getAttribute("data-theme"),
        scroll: document.documentElement.scrollWidth,
        inner: innerWidth,
        external: document.querySelectorAll("[src],link[href]").length,
        storage: /localStorage|sessionStorage|indexedDB/.test(source),
        network: /\bfetch\(|XMLHttpRequest|https?:\/\//.test(source),
        strokes: window.__watt.state().share,
      };
    });
    const others = requests.filter((url) => !url.startsWith("file:"));
    expect(facts.title === "Watt Steam Engine Anatomy" && facts.theme === "light", `${name}: title "${facts.title}", theme ${facts.theme}`);
    expect(others.length === 0 && facts.external === 0 && !facts.storage && !facts.network, `${name}: self-contained (${others.length} other requests, ${facts.external} src/href, storage ${facts.storage}, fetch or URL ${facts.network})`);
    expect(facts.scroll <= facts.inner && facts.strokes > 0, `${name}: no sideways scroll at 390 px (${facts.scroll} vs ${facts.inner}) and the engine moves`);
    if (name === "page") {
      await page.locator(".iso-plate").screenshot({ path: join(shots, "phone-run.png") });
      await page.screenshot({ path: join(shots, "phone-page.png"), fullPage: true });
    }
    await context.close();
  }
  const published = readFileSync(publishFile, "utf8");
  const setup = '<style>html,body{background:#f2f2ef;color-scheme:light}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","light");</script>';
  expect(published.startsWith("<title>Watt Steam Engine Anatomy</title><style>") && published.includes(setup), "publish copy starts with the title and the styles, then the light-theme setup");
  expect(!/<!doctype|<html|<head|<meta|<body|<\/body|<\/html/i.test(published), "publish copy has no doctype, html, head, meta or body tags");
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await onTheClock(browser);
  await byHand(browser);
  await selfContained(browser);
} finally {
  await browser.close();
}
console.log(problems.length ? `verify failed: ${problems.length} problems\n${problems.join("\n")}` : `verify passed: ${checks} checks, no console errors`);
process.exit(problems.length ? 1 : 0);
