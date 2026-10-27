import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setPriority, constants } from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const artifact = (name) =>
  fileURLToPath(new URL(`./artifacts/${name}`, import.meta.url));
const duration = 43.834;
const music = JSON.parse(await readFile(artifact("music-beats.json"), "utf8"));
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-renderer-backgrounding"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:5186/?capture=compare");
  await page.waitForFunction(() => window.spiderDebug?.ready);
  await page.addStyleTag({
    content:
      "header, footer, #loading { display:none!important } #world { outline:none!important; cursor:none!important }",
  });
  // Compile the wall, mist and both render paths before the media clock starts.
  await page.evaluate(() => spiderDebug.startShowcase());
  await page.waitForTimeout(1800);
  await page.evaluate(
    ({ duration, beats }) => {
      const stream = document.querySelector("#world").captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 14000000,
      });
      window.captureDone = new Promise((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 32768) {
            binary += String.fromCharCode(
              ...bytes.subarray(offset, offset + 32768),
            );
          }
          stream.getTracks().forEach((track) => track.stop());
          resolve(btoa(binary));
        };
      });
      window.captureRecorder = recorder;
      spiderDebug.startShowcase({ duration, beats });
      recorder.start();
    },
    { duration, beats: music.beats },
  );
  const started = performance.now();
  const telemetry = [];
  const screenshotTimes = new Set([
    0, 3, 12, 24, 30, 32, 33, 34, 35, 36, 38, 42, 43.5,
  ]);
  const sampleTimes = Array.from(
    { length: Math.floor(duration * 2) + 1 },
    (_, index) => index / 2,
  );
  sampleTimes.push(duration + 0.2);
  for (const seconds of sampleTimes) {
    const delay = started + seconds * 1000 - performance.now();
    if (delay > 0) await page.waitForTimeout(delay);
    telemetry.push({
      seconds,
      ...(await page.evaluate(() => spiderDebug.state)),
    });
    if (screenshotTimes.has(seconds))
      await page.screenshot({ path: artifact(`split-${seconds}.png`) });
  }
  await page.evaluate(() => captureRecorder.stop());
  const bytes = Buffer.from(await page.evaluate(() => captureDone), "base64");
  await writeFile(artifact("spider-comparison.webm"), bytes);
  const soundEvents = await page.evaluate(() => spiderDebug.soundEvents);
  const audioBase64 = await page.evaluate(
    async ({ events, duration }) => {
      const { renderMechanicalAudio } = await import("./footsteps.mjs");
      const audioBytes = await renderMechanicalAudio(events, duration);
      let binary = "";
      for (let offset = 0; offset < audioBytes.length; offset += 32768) {
        binary += String.fromCharCode(
          ...audioBytes.subarray(offset, offset + 32768),
        );
      }
      return btoa(binary);
    },
    { events: soundEvents, duration },
  );
  await writeFile(
    artifact("mechanical-footsteps.wav"),
    Buffer.from(audioBase64, "base64"),
  );
  await writeFile(
    artifact("spider-comparison.json"),
    JSON.stringify(
      {
        errors,
        telemetry,
        soundEvents,
        musicStartSeconds: 103,
        duration,
        beatGrid: music,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(
    soundEvents.filter((event) => event.kind === "step").length <=
      soundEvents.filter((event) => event.kind === "lift").length + 2,
    "release frames must not retrigger foot contact sounds",
  );
  assert.equal(
    soundEvents.filter((event) => event.kind === "jump").length,
    1,
    "one pneumatic release accompanies takeoff",
  );
  assert.ok(
    new Set(
      soundEvents
        .filter((event) => event.kind === "step")
        .map((event) => event.weight.toFixed(2)),
    ).size > 12,
    "foot contacts retain varied impact weights",
  );
  const first = telemetry[0];
  const last = telemetry.at(-1);
  assert.ok(
    last.position[2] - first.position[2] > 7,
    "spider crosses at least seven world units",
  );
  assert.ok(last.position[2] > 2.7, "body clears obstacle course");
  assert.ok(
    Math.max(...telemetry.map((sample) => sample.position[1])) > 6,
    "spider climbs above the wall before jumping",
  );
  assert.ok(last.position[1] < 2, "spider lands on the far-side ground");
  assert.ok(
    telemetry.some((sample) => sample.airborne),
    "capture includes the airborne jump",
  );
  assert.equal(last.landed, true, "capture finishes after landing settles");
  assert.ok(
    soundEvents.some((event) => event.kind === "land"),
    "landing sound follows actual impact",
  );
  assert.ok(
    soundEvents.filter((event) => event.kind === "step").length > 20,
    "footstep audio follows actual foot contacts",
  );
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      artifact("spider-comparison.webm"),
      "-i",
      artifact("soundtrack-flight.m4a"),
      "-i",
      artifact("mechanical-footsteps.wav"),
      "-t",
      String(duration),
      "-map",
      "0:v:0",
      "-map",
      "[sound]",
      "-vf",
      "fps=30",
      "-c:v",
      "libx264",
      "-threads",
      "4",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-filter_complex",
      `[1:a]volume=0.16[music];[2:a]volume=3,aecho=0.9:0.9:85:0.18[steps];[music][steps]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,afade=t=out:st=${duration - 0.7}:d=0.7[sound]`,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      artifact("spider-snap-jump.mp4"),
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  if (encoded.status !== 0) throw new Error(encoded.stderr);
  console.log(
    JSON.stringify({
      file: artifact("spider-snap-jump.mp4"),
      errors,
      distance: last.position[2] - first.position[2],
      steps: last.steps,
    }),
  );
} finally {
  await browser.close();
}

