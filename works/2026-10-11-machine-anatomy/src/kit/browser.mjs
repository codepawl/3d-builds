// Finds Playwright and a Chrome to drive. Playwright is not a dependency of this repository: install it
// once (`npm install --no-save playwright` here, or anywhere and point MACHINE_ANATOMY_PLAYWRIGHT at its
// index.mjs). Chrome comes from CHROME_PATH, the usual install places, or Playwright's own Chromium.
import { existsSync } from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
];

async function loadPlaywright() {
  const pointed = process.env.MACHINE_ANATOMY_PLAYWRIGHT;
  if (pointed) return import(pointed.startsWith("file:") ? pointed : pathToFileURL(pointed).href);
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright not found. Run `npm install --no-save playwright` in this repository, or set MACHINE_ANATOMY_PLAYWRIGHT to a Playwright index.mjs.");
  }
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
}

// Recording and checks run below normal priority, so the machine stays usable; children inherit it.
export function lowerPriority() {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
}

export async function launchBrowser() {
  const playwright = await loadPlaywright();
  const chromium = playwright.chromium ?? playwright.default.chromium;
  const executablePath = chromePath();
  return chromium.launch({ executablePath, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text", "--disable-gpu"] });
}

export function watchProblems(page, problems) {
  page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text()}`));
  page.on("pageerror", (error) => problems.push(`page error: ${error}`));
}
