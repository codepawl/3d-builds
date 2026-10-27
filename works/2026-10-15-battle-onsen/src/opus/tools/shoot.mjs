// Screenshots of every preset, DOF off and on, at progress 0, 0.5 and 1, through the window.battle hook.
// Usage: node tools/shoot.mjs [port] [filter]
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const port = Number(process.argv[2] || 5505);
const filter = process.argv[3] || "";
const shotsDirectory = fileURLToPath(new URL("../shots/pass2/", import.meta.url));
await mkdir(shotsDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const consoleProblems = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    consoleProblems.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
await page.goto(`http://localhost:${port}/?capture=1`);
await page.waitForFunction(() => window.battle && window.battle.ready === true, null, { timeout: 120000 });

async function shoot(name, { preset, depthOfField, progress, lateral = 0, yawOffset = 0 }) {
  if (filter && !name.includes(filter)) {
    return;
  }
  await page.evaluate(
    (settings) => {
      window.battle.setPreset(settings.preset, true);
      window.battle.setToggle("dof", settings.depthOfField);
      window.battle.setToggle("dslr", true);
      window.battle.placeCamera(settings.progress, settings.lateral, { yawOffset: settings.yawOffset, pitch: 0 });
      window.battle.step(1 / 60, 40);
    },
    { preset, depthOfField, progress, lateral, yawOffset }
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${shotsDirectory}${name}.png` });
  console.log("shot", name);
}

const progressLabel = (progress) => String(progress).replace(".", "");
for (const preset of ["morning", "golden", "blue", "night"]) {
  for (const depthOfField of [false, true]) {
    for (const progress of [0, 0.5, 1]) {
      await shoot(`${preset}_${depthOfField ? "dof" : "nodof"}_p${progressLabel(progress)}`, { preset, depthOfField, progress });
    }
  }
}
// The five path points the recording passes, at the edges of its sideways drift (0.45 m) and yaw sway (0.14 rad).
for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
  await shoot(`path_p${progressLabel(progress)}_left`, { preset: "golden", depthOfField: true, progress, lateral: -0.45, yawOffset: 0.14 });
  await shoot(`path_p${progressLabel(progress)}_right`, { preset: "night", depthOfField: true, progress, lateral: 0.45, yawOffset: -0.14 });
}
console.log(consoleProblems.length ? consoleProblems.slice(0, 20).join("\n") : "no console errors");
await browser.close();
