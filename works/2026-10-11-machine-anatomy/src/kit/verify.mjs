// Checks the built page in headless Chrome and takes the review screenshots. The same checks for every
// machine: the zoom frame's birth, the exploded view, the readouts against their templates, every theme
// and render style, phone width, the publish fragment and that the page is self-contained. A machine adds
// its own checks in verify-machine.mjs (export verifyMachine). Adapted from the Edison verify script.
import { collisionProblems, measureScene } from "./overlap.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, lowerPriority, watchProblems } from "./browser.mjs";
import { baseName, pageFileName } from "./build.mjs";
import { loadMachine } from "./page.mjs";
import { STYLE_NAMES } from "./styles.mjs";
import { THEME_NAMES, pageColoursOf } from "./themes.mjs";

function createChecks() {
  const problems = [];
  let count = 0;
  function expect(condition, message) {
    count += 1;
    if (!condition) problems.push(message);
    console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
  }
  return { problems, expect, count: () => count };
}

const stateOf = (page) => page.evaluate(() => window.__anatomy.state());

// Plays the manual clock and collects every readout shown on the way.
function play(page, seconds) {
  return page.evaluate((count) => {
    const seen = [];
    for (let step = 0; step < count; step++) {
      window.__anatomy.advance(1 / 60);
      if (step % 6 === 0) seen.push(window.__anatomy.state().readout);
    }
    return seen;
  }, Math.round(seconds * 60));
}

const opacityOf = (page, name) => page.evaluate((dyn) => getComputedStyle(document.querySelector(`[data-dyn="${dyn}"]`)).opacity, name);

async function zoomAndApart(context, url, machine, checks, readouts, shots) {
  const page = await context.newPage();
  await page.goto(`${url}?clock=manual`);
  const start = await stateOf(page);
  checks.expect(start.zoomAge < 0 && !start.working, `the page opens still, with no zoom frame: "${start.readout}"`);
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-still.png") });
  await page.evaluate(() => window.__anatomy.act("start"));
  readouts.push(...(await play(page, 0.25)));
  let state = await stateOf(page);
  for (let guard = 0; guard < 600 && !(state.zoomAge > 0.45); guard++) {
    readouts.push(...(await play(page, 1 / 30)));
    state = await stateOf(page);
  }
  const birth = await page.evaluate(() => ({ ties: (document.querySelector('[data-dyn="zoom-ties"]').getAttribute("d").match(/M/g) ?? []).length, width: Number(document.querySelector('[data-dyn="zoom-edge"]').getAttribute("width")) }));
  const tiesShown = Number(await opacityOf(page, "zoom-ties"));
  const sourceShown = Number(await opacityOf(page, "zoom-source"));
  checks.expect(birth.ties === 4 && tiesShown > 0.9 && sourceShown > 0.9 && birth.width < machine.page.zoom.width, `mid-birth (${state.zoomAge} s): source rectangle ${sourceShown}, four dashed lines ${tiesShown}, frame ${birth.width.toFixed(0)} of ${machine.page.zoom.width} wide`);
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-birth.png") });
  readouts.push(...(await play(page, 3.5)));
  const after = { frame: await opacityOf(page, "zoom"), source: await opacityOf(page, "zoom-source"), ties: await opacityOf(page, "zoom-ties") };
  checks.expect(after.frame === "1" && after.source === "0" && after.ties === "0", `after its birth only the zoom frame is left: frame ${after.frame}, rectangle ${after.source}, lines ${after.ties}`);
  checks.expect((await stateOf(page)).working, "the machine is working");
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-working.png") });
  await page.evaluate(() => window.__anatomy.act("setApart", true));
  readouts.push(...(await play(page, 9)));
  const apartCollisions = collisionProblems([{ label: "the page apart", collisions: await page.evaluate(measureScene, { pieces: true, step: 6 }) }], machine.film?.overlapAllowed ?? []);
  checks.expect(!apartCollisions.length, `apart on the page nothing covers anything: ${apartCollisions.join("; ") || "no collisions"}`);
  const pieces = Object.values(machine.pieces).filter((piece) => piece.badge !== false).length;
  const opened = await page.evaluate(() => ({ state: window.__anatomy.state(), badges: Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity) === 1).length }));
  checks.expect(opened.state.resting && opened.state.open === 1 && opened.badges === pieces && (await opacityOf(page, "zoom")) === "0", `apart: ${opened.badges} of ${pieces} numbered assemblies, zoom frame hidden, "${opened.state.readout}"`);
  await page.locator(".iso-plate").screenshot({ path: join(shots, "desk-apart.png") });
  await page.evaluate(() => window.__anatomy.act("setApart", false));
  readouts.push(...(await play(page, 9)));
  checks.expect((await stateOf(page)).open === 0, "and back together");
  await page.screenshot({ path: join(shots, "desk-page.png"), fullPage: true });
  await page.close();
}

async function keyboardApart(context, url, checks) {
  const page = await context.newPage();
  await page.goto(`${url}?tour=off`);
  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => window.__anatomy.state().apart && window.__anatomy.state().resting, null, { timeout: 30000 });
  checks.expect(true, "Shift+E takes it apart on the live clock");
  await page.keyboard.press("Shift+E");
  await page.waitForFunction(() => !window.__anatomy.state().apart && window.__anatomy.state().resting, null, { timeout: 30000 });
  checks.expect((await stateOf(page)).open === 0, "and Shift+E puts it back together");
  await page.close();
}

async function everyLook(context, url, checks, shots) {
  const page = await context.newPage();
  let shown = 0;
  for (const theme of THEME_NAMES) {
    for (const style of STYLE_NAMES) {
      await page.goto(`${url}?clock=manual&theme=${theme}&style=${style}`);
      await page.evaluate(() => window.__anatomy.act("start"));
      await play(page, 3);
      const look = await page.evaluate(() => ({ theme: document.body.dataset.theme, style: document.body.dataset.style }));
      if (look.theme === theme && look.style === style) shown += 1;
      await page.locator(".iso-plate").screenshot({ path: join(shots, `look-${theme}-${style}.png`) });
    }
  }
  checks.expect(shown === THEME_NAMES.length * STYLE_NAMES.length, `${shown} of ${THEME_NAMES.length * STYLE_NAMES.length} theme and style pairs render`);
  await page.close();
}

async function phone(browser, url, checks, shots, problems) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  watchProblems(page, problems);
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${url}?clock=manual`);
  await page.evaluate(() => window.__anatomy.act("start"));
  await play(page, 5);
  await page.screenshot({ path: join(shots, "phone-page.png"), fullPage: true });
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  checks.expect(widths.scroll <= widths.inner, `no sideways scroll at 390 px (${widths.scroll} vs ${widths.inner})`);
  checks.expect(requests.length === 1, `self-contained: ${requests.length} request (the page itself)`);
  await context.close();
}

async function publishCopy(browser, loaded, checks, shots, problems) {
  const theme = loaded.machine.theme ?? "light";
  const text = readFileSync(join(loaded.dir, "publish", `${baseName(loaded.machine)}.html`), "utf8");
  checks.expect(text.startsWith("<title>") && !/<!doctype|<html|<head|<meta|<body|<\/body|<\/html|<\/head/i.test(text), "the publish copy starts with the title and has no doctype, html, head, meta or body tags");
  const outside = text.replace(/http:\/\/www\.w3\.org\/[\w/]+/g, "");
  checks.expect(!/https?:\/\/|\bfetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/.test(outside), "no external URL, fetch or storage in it");
  const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await context.newPage();
  watchProblems(page, problems);
  const hostFile = join(shots, "publish-host.html");
  writeFileSync(hostFile, `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${text}</body></html>`);
  await page.goto(`${pathToFileURL(hostFile).href}?clock=manual`);
  await page.evaluate(() => window.__anatomy.act("start"));
  await play(page, 4);
  const facts = await page.evaluate(() => ({ theme: document.body.getAttribute("data-theme"), iso: document.body.classList.contains("iso"), background: getComputedStyle(document.body).backgroundColor, working: window.__anatomy.state().working }));
  checks.expect(facts.theme === theme && facts.iso && facts.working, `the publish copy runs: theme ${facts.theme}, background ${facts.background} (wanted ${pageColoursOf(theme).background})`);
  await context.close();
}

function checkReadouts(machine, readouts, checks) {
  const patterns = (machine.readouts ?? []).map((readout) => new RegExp(readout.pattern));
  const kitStates = /^(coming apart|going back together|apart · \w+ assemblies|.+ · then apart)$/;
  const distinct = Array.from(new Set(readouts));
  const strays = distinct.filter((text) => !kitStates.test(text) && !patterns.some((pattern) => pattern.test(text)));
  checks.expect(strays.length === 0, `${distinct.length} distinct readouts seen, all match a template${strays.length ? `; strays: ${strays.slice(0, 3).join(" | ")}` : ""}`);
}

export async function verifyCommand(dir) {
  lowerPriority();
  const loaded = await loadMachine(dir);
  const { machine } = loaded;
  const url = pathToFileURL(join(dir, pageFileName(machine))).href;
  const shots = join(dir, "shots", "verify");
  mkdirSync(shots, { recursive: true });
  const checks = createChecks();
  const readouts = [];
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 1250 }, deviceScaleFactor: 1.5 });
    context.on("page", (page) => watchProblems(page, checks.problems));
    await zoomAndApart(context, url, machine, checks, readouts, shots);
    await keyboardApart(context, url, checks);
    const machineChecks = join(dir, "verify-machine.mjs");
    if (existsSync(machineChecks)) {
      const { verifyMachine } = await import(pathToFileURL(machineChecks).href);
      await verifyMachine({ context, url, expect: checks.expect, play, stateOf, shots, readouts });
    }
    await everyLook(context, url, checks, shots);
    await context.close();
    await phone(browser, url, checks, shots, checks.problems);
    await publishCopy(browser, loaded, checks, shots, checks.problems);
  } finally {
    await browser.close();
  }
  checkReadouts(machine, readouts, checks);
  const failed = checks.problems.length;
  console.log(failed ? `verify failed: ${failed} problems\n${checks.problems.join("\n")}` : `verify passed: ${checks.count()} checks, no console errors`);
  return failed ? 1 : 0;
}
