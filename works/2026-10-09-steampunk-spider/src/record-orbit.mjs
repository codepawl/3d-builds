// Records the orbit shot of the battle video from the prototype as it runs today, without editing it.
// Playwright injects orbit-page-driver.js, which steps the page's own animation loop on a virtual clock
// and aims its camera; this file plays the storyboard shared with the Opus spider, pipes every frame to
// ffmpeg and writes the foot, steam and walking events next to the video.
// Usage: node record-orbit.mjs
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  ORBIT_SHOT,
  BODY_LOOK_HEIGHT_IN_SPANS,
  TRACKING_RATE,
  orbitCameraAt,
  orbitCameraOffset,
  describeOrbitShot,
} from "../spider-opus/src/orbit-storyboard.mjs";

const WIDTH = 1920;
const HEIGHT = 1080;
const FRAMES_PER_SECOND = 30;
const SIMULATION_STEPS_PER_FRAME = 2;
const SIMULATION_STEPS_PER_SECOND = FRAMES_PER_SECOND * SIMULATION_STEPS_PER_FRAME;
const PAGE_URL = "http://127.0.0.1:5186/";
const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const THREE_PACKAGE_DIRECTORY = `${process.env.JS67_DIR}/node_modules/three`; // JS67_DIR: your 67.js checkout
// The spider backs up to this line on the open floor, then the obstacles are switched on ahead of it.
const START_LINE_Z = -2.4;
const COURSE_END_Z = 5;
const LONGEST_BACK_UP_SECONDS = 40;
const SETTLE_SECONDS = 3;

const outputDirectory = fileURLToPath(new URL("../spider-opus/artifacts/battle/final/", import.meta.url));
const videoPath = `${outputDirectory}astra-orbit.mp4`;
const eventsPath = `${outputDirectory}astra-orbit-events.json`;

// The preview server listens as soon as it is imported; a child process can be stopped again.
async function startPreviewServer() {
  const server = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url))], {
    stdio: "ignore",
    windowsHide: true,
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await fetch(PAGE_URL).catch(() => null);
    if (response?.ok) {
      return server;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill();
  throw new Error(`the preview server did not answer at ${PAGE_URL}`);
}

// server.mjs serves three.js from a checkout that has since moved, so the page cannot load it today.
// The recorder answers those requests itself from where the package lives now.
function serveThreePackage(route) {
  const requestedPath = new URL(route.request().url()).pathname;
  const pathInsidePackage = requestedPath.slice("/vendor/three/".length);
  return route.fulfill({ path: `${THREE_PACKAGE_DIRECTORY}/${pathInsidePackage}` });
}

function startVideoEncoder(outputPath) {
  return spawn(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "image2pipe", "-framerate", String(FRAMES_PER_SECOND), "-c:v", "mjpeg", "-i", "pipe:0",
      "-vf", "scale=in_range=pc:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p",
      "-c:v", "libx264", "-preset", "medium", "-crf", "17",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-movflags", "+faststart", "-r", String(FRAMES_PER_SECOND), outputPath,
    ],
    { stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
  );
}

async function writeFrame(encoder, frameDataUrl) {
  const frameBase64 = frameDataUrl.slice(frameDataUrl.indexOf(",") + 1);
  if (!encoder.stdin.write(Buffer.from(frameBase64, "base64"))) {
    await once(encoder.stdin, "drain");
  }
}

function cameraPoseAt(seconds, cameraDistance) {
  const pose = orbitCameraAt(seconds);
  return {
    offset: orbitCameraOffset(pose, cameraDistance),
    visibleHeightInSpans: pose.visibleHeightInSpans,
    headWeight: pose.headWeight,
    lookHeightInSpans: BODY_LOOK_HEIGHT_IN_SPANS,
    trackingRate: TRACKING_RATE,
  };
}

async function advance(page, seconds) {
  await page.evaluate((stepCount) => window.orbitDriver.advance(stepCount), Math.round(seconds * SIMULATION_STEPS_PER_SECOND));
  return page.evaluate(() => window.orbitDriver.telemetry());
}

async function clickControl(page, selector) {
  await page.evaluate((controlSelector) => document.querySelector(controlSelector).click(), selector);
}

// Backs the spider up to the start line on the open floor (it reverses without turning), then switches the
// obstacle course on and lets the feet and hoses settle.
async function walkToStartLine(page) {
  await advance(page, 0.1);
  await page.evaluate((z) => window.orbitDriver.leadSpiderTo(0, z), START_LINE_Z);
  let telemetry;
  for (let second = 0; second < LONGEST_BACK_UP_SECONDS; second++) {
    telemetry = await advance(page, 1);
    const hasArrived = Math.abs(telemetry.position[2] - START_LINE_Z) < 0.02 && telemetry.speed < 0.005;
    if (hasArrived && telemetry.movingLegs.length === 0) {
      break;
    }
  }
  assert.ok(Math.abs(telemetry.position[2] - START_LINE_Z) < 0.05, `the spider stopped at z ${telemetry.position[2]}`);
  assert.ok(Math.abs(telemetry.yaw) < 0.02, `the spider turned to ${telemetry.yaw} while backing up`);
  await clickControl(page, "#terrain");
  telemetry = await advance(page, SETTLE_SECONDS);
  assert.equal(telemetry.hasTerrain, true, "the obstacle course is off");
  assert.equal(telemetry.isPixel, false, "pixel mode is on");
}

const CUES = [
  { seconds: ORBIT_SHOT.walkStartSeconds, action: (courseEndZ) => window.orbitDriver.leadSpiderTo(0, courseEndZ) },
  { seconds: ORBIT_SHOT.haltSeconds, action: () => window.orbitDriver.halt() },
  { seconds: ORBIT_SHOT.steamBurstSeconds, action: () => window.orbitDriver.ventSteam() },
];

// Cues fire right after the frame at their time is captured, so they are logged at that shot time.
async function runCues(page, frame) {
  for (const cue of CUES) {
    if (Math.round(cue.seconds * FRAMES_PER_SECOND) === frame) {
      await page.evaluate(cue.action, COURSE_END_Z);
    }
  }
}

function timelineEntry(frame, telemetry) {
  return {
    videoSecond: frame / FRAMES_PER_SECOND,
    position: telemetry.position.map((value) => Number(value.toFixed(2))),
    speed: Number(telemetry.speed.toFixed(2)),
    yaw: Number(telemetry.yaw.toFixed(2)),
    movingLegs: telemetry.movingLegs,
  };
}

async function recordFrames(page, encoder, cameraDistance) {
  const timeline = [];
  const totalFrames = ORBIT_SHOT.durationSeconds * FRAMES_PER_SECOND;
  let telemetry;
  for (let frame = 0; frame < totalFrames; frame++) {
    const captured = await page.evaluate(
      ({ cameraPose, stepCount }) => {
        window.orbitDriver.setCameraPose(cameraPose);
        window.orbitDriver.advance(stepCount);
        return { frameDataUrl: window.orbitDriver.captureFrame(), telemetry: window.orbitDriver.telemetry() };
      },
      { cameraPose: cameraPoseAt(frame / FRAMES_PER_SECOND, cameraDistance), stepCount: SIMULATION_STEPS_PER_FRAME },
    );
    telemetry = captured.telemetry;
    if (frame === 0) {
      await page.evaluate(() => window.orbitDriver.startShot());
    }
    if (frame % FRAMES_PER_SECOND === 0) {
      timeline.push(timelineEntry(frame, telemetry));
    }
    await writeFrame(encoder, captured.frameDataUrl);
    await runCues(page, frame);
  }
  return { timeline, widestFootReach: telemetry.widestFootReach };
}

function countEventTypes(events) {
  const counts = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}

async function recordOrbitShot(browser) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript({ path: fileURLToPath(new URL("./orbit-page-driver.js", import.meta.url)) });
  await page.route("**/vendor/three/**", serveThreePackage);
  await page.goto(PAGE_URL);
  // The page's frame clock is stepped by hand, so the wait polls on a timer instead of on frames.
  await page.waitForFunction(() => window.spiderDebug?.ready === true, null, { polling: 100, timeout: 60000 });
  const rig = await page.evaluate(() => window.orbitDriver.prepare());
  await page.evaluate((cameraPose) => window.orbitDriver.setCameraPose(cameraPose), cameraPoseAt(0, rig.cameraDistance));
  await clickControl(page, "#pixel");
  await walkToStartLine(page);

  const encoder = startVideoEncoder(videoPath);
  let recording;
  try {
    recording = await recordFrames(page, encoder, rig.cameraDistance);
    encoder.stdin.end();
    const [exitCode] = await once(encoder, "close");
    assert.equal(exitCode, 0, "ffmpeg encoding failed");
  } catch (error) {
    encoder.kill();
    throw error;
  }
  const events = await page.evaluate(() => window.orbitDriver.drainEvents());
  await page.close();
  assert.deepEqual(errors, [], "the page logged errors");
  const sheet = {
    durationSeconds: ORBIT_SHOT.durationSeconds,
    legSpan: rig.legSpan,
    camera: { projection: "orthographic", frustumHeight: rig.frustumHeight, distance: rig.cameraDistance },
    // 1 is the edge of the 16:9 frame; the battle panel keeps the middle 56 percent of the width.
    widestFootReach: Number(recording.widestFootReach.toFixed(3)),
    storyboard: describeOrbitShot(),
    events,
    timeline: recording.timeline,
  };
  await writeFile(eventsPath, JSON.stringify(sheet, null, 2));
  return { videoPath, eventsPath, eventCounts: countEventTypes(events), widestFootReach: sheet.widestFootReach, rig };
}

// Heavy local jobs run below normal priority so the machine stays usable; Chrome and ffmpeg inherit it.
setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
await mkdir(outputDirectory, { recursive: true });
const server = await startPreviewServer();
const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: [
    "--use-angle=d3d11",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
});
try {
  console.log(JSON.stringify(await recordOrbitShot(browser)));
} finally {
  await browser.close();
  server.kill();
}
