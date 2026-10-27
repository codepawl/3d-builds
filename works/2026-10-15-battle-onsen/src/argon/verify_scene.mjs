import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const currentFilePath = fileURLToPath(import.meta.url);
const projectDir = path.dirname(currentFilePath);
const shotsDir = path.join(projectDir, "shots", "pass2");

async function runVerification() {
  fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=d3d11",
      "--enable-gpu",
      "--ignore-gpu-blocklist"
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.toString());
  });

  await page.goto("http://127.0.0.1:5506/?capture=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.battle && window.battle.ready === true, null, { timeout: 20000 });

  const presets = ["morning", "golden", "blue", "night"];
  const dofStates = [false, true];
  const progressPoints = [0, 0.25, 0.5, 0.75, 1];

  for (const preset of presets) {
    for (const dofOn of dofStates) {
      for (const progress of progressPoints) {
        await page.evaluate(({ pName, dofVal, progVal }) => {
          window.battle.setPreset(pName, true);
          window.battle.setToggle("dslr", true);
          window.battle.setToggle("dof", dofVal);
          window.battle.placeCamera(progVal, 0.0, { yawOffset: 0.0, pitch: 0.0 });
          window.battle.step(1.0 / 30.0, 20);
        }, { pName: preset, dofVal: dofOn, progVal: progress });

        const dofLabel = dofOn ? "dof-on" : "dof-off";
        const progLabel = String(progress).replace(".", "_");
        const shotPath = path.join(shotsDir, `${preset}_${dofLabel}_p${progLabel}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`Saved ${path.basename(shotPath)}`);
      }
    }
  }

  const driftCases = [
    { prog: 0.5, lat: -0.45, yaw: -0.14, label: "drift_p0_5_neg" },
    { prog: 0.5, lat: 0.45, yaw: 0.14, label: "drift_p0_5_pos" },
    { prog: 1.0, lat: -0.45, yaw: -0.14, label: "drift_p1_0_neg" },
    { prog: 1.0, lat: 0.45, yaw: 0.14, label: "drift_p1_0_pos" }
  ];

  for (const dc of driftCases) {
    await page.evaluate(({ prog, lat, yaw }) => {
      window.battle.setPreset("blue", true);
      window.battle.setToggle("dslr", true);
      window.battle.setToggle("dof", true);
      window.battle.placeCamera(prog, lat, { yawOffset: yaw, pitch: 0.0 });
      window.battle.step(1.0 / 30.0, 20);
    }, dc);
    const shotPath = path.join(shotsDir, `${dc.label}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Saved ${path.basename(shotPath)}`);
  }

  await page.goto("http://127.0.0.1:5506/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.battle && window.battle.ready === true, null, { timeout: 20000 });

  const fpsResult = await page.evaluate(async () => {
    window.battle.setPreset("blue", true);
    window.battle.setToggle("dslr", true);
    window.battle.setToggle("dof", true);
    await new Promise((r) => setTimeout(r, 300));

    let frames = 0;
    const start = performance.now();
    return await new Promise((resolve) => {
      function countFrame(now) {
        frames++;
        if (now - start >= 2000.0) {
          const elapsedSec = (now - start) / 1000.0;
          resolve({
            fps: Number((frames / elapsedSec).toFixed(1)),
            frames,
            elapsedSec: Number(elapsedSec.toFixed(2))
          });
        } else {
          requestAnimationFrame(countFrame);
        }
      }
      requestAnimationFrame(countFrame);
    });
  });

  const stepBenchmark = await page.evaluate(() => {
    const start = performance.now();
    const totalFrames = 180;
    window.battle.step(1.0 / 60.0, totalFrames);
    const elapsedMs = performance.now() - start;
    const avgFrameMs = elapsedMs / totalFrames;
    return {
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      maxTheoreticalFps: Number((1000.0 / avgFrameMs).toFixed(1))
    };
  });

  console.log("Measured requestAnimationFrame FPS:", JSON.stringify(fpsResult));
  console.log("Measured synchronous step() performance:", JSON.stringify(stepBenchmark));
  if (consoleMessages.length > 0) {
    console.log("Console warnings/errors:", consoleMessages.join("\n"));
  }
  if (pageErrors.length > 0) {
    console.log("Page errors:", pageErrors.join("\n"));
  }

  await browser.close();
}

runVerification();
