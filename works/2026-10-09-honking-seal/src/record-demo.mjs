import { chromium } from "playwright";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setPriority, constants } from "node:os";

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const pageUrl =
  process.env.DEMO_URL ||
  process.argv[2] ||
  "http://127.0.0.1:5178/?engine=three";
const outputDirectory = fileURLToPath(new URL("./artifacts/", import.meta.url));
const outputPath = (name) => `${outputDirectory}/${name}`;
const viewport = { width: 1440, height: 1000 };
await mkdir(outputDirectory, { recursive: true });

function runMedia(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command}: ${result.error?.message || result.stderr?.toString()}`,
    );
  }
  return result.stdout;
}

function writeWave(audioCapture, durationSeconds) {
  const sampleCount = Math.ceil(durationSeconds * audioCapture.sampleRate);
  const samples = new Float32Array(sampleCount);
  for (const chunk of audioCapture.chunks) {
    const offset = Math.round(chunk.frame - audioCapture.startFrame);
    for (
      let index = Math.max(0, -offset);
      index < chunk.samples.length && offset + index < sampleCount;
      index++
    ) {
      samples[offset + index] = chunk.samples[index];
    }
  }
  const wave = Buffer.alloc(44 + sampleCount * 2);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(audioCapture.sampleRate, 24);
  wave.writeUInt32LE(audioCapture.sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(sampleCount * 2, 40);
  let peak = 0;
  let energy = 0;
  for (let index = 0; index < sampleCount; index++) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    wave.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
  }
  return { wave, peak, rms: Math.sqrt(energy / sampleCount) };
}

function measureAudioWindow(wave, sampleRate, startSeconds, endSeconds) {
  const firstSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const lastSample = Math.min((wave.length - 44) / 2, Math.ceil(endSeconds * sampleRate));
  let peak = 0;
  let energy = 0;
  for (let index = firstSample; index < lastSample; index++) {
    const sample = wave.readInt16LE(44 + index * 2) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
  }
  return { peak, rms: Math.sqrt(energy / Math.max(1, lastSample - firstSample)) };
}

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: [
    "--disable-renderer-backgrounding",
    "--autoplay-policy=no-user-gesture-required",
    "--renderer-process-limit=2",
  ],
});
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  recordVideo: { dir: outputDirectory, size: viewport },
});
const page = await context.newPage();
const video = page.video();
const errors = [];
const trace = [];
page.on("pageerror", (error) => errors.push(error.message));
let recordingStart;

async function checkpoint(label) {
  trace.push(
    await page.evaluate(
      (label) => ({
        label,
        milliseconds: performance.now() - window.demoRecordingStart,
        ...window.sealDebug.state,
      }),
      label,
    ),
  );
}

async function caption(text) {
  await page.evaluate((text) => {
    document.querySelector("#demo-caption").textContent = text;
    document.querySelector("#demo-caption").style.display = text ? "block" : "none";
  }, text);
}

async function moveMouse(x, y, milliseconds = 450) {
  const from = await page.evaluate(() => window.demoMousePosition);
  const steps = Math.max(1, Math.round(milliseconds / 50));
  const movementStarted = performance.now();
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      from.x + ((x - from.x) * step) / steps,
      from.y + ((y - from.y) * step) / steps,
    );
    const remainingDelay = movementStarted + milliseconds * step / steps - performance.now();
    if (remainingDelay > 0) await page.waitForTimeout(remainingDelay);
  }
}

try {
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.sealDebug?.ready);
  await page.waitForTimeout(500);
  if (await page.evaluate(() => window.sealDebug.state.hornEquipped)) {
    await page.locator("#horn-toggle").click();
  }
  await page.evaluate(async () => {
    const audio = window.sealDebug.audio;
    await audio.unlock();
    const processorSource = `class Capture extends AudioWorkletProcessor {
      process(inputs) {
        const channels = inputs[0];
        if (channels?.length) {
          const samples = new Float32Array(channels[0].length);
          for (const channel of channels) {
            for (let index = 0; index < samples.length; index++) samples[index] += channel[index] / channels.length;
          }
          this.port.postMessage({ frame: currentFrame, samples }, [samples.buffer]);
        }
        return true;
      }
    } registerProcessor('demo-capture', Capture);`;
    const sourceUrl = URL.createObjectURL(
      new Blob([processorSource], { type: "text/javascript" }),
    );
    await audio.context.audioWorklet.addModule(sourceUrl);
    URL.revokeObjectURL(sourceUrl);
    const processor = new AudioWorkletNode(audio.context, "demo-capture");
    const silentOutput = audio.context.createGain();
    silentOutput.gain.value = 0;
    audio.master
      .connect(processor)
      .connect(silentOutput)
      .connect(audio.context.destination);
    window.demoAudioCapture = {
      sampleRate: audio.context.sampleRate,
      chunks: [],
    };
    processor.port.onmessage = ({ data }) =>
      window.demoAudioCapture.chunks.push({
        frame: data.frame,
        samples: Array.from(data.samples),
      });
    const style = document.createElement("style");
    style.textContent = `#demo-cursor {position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px;border-radius:50%;background:#fff8;box-shadow:0 0 0 2px #284c48,0 3px 10px #284c4833;z-index:9999;pointer-events:none;transition:width .12s,height .12s,margin .12s,background .12s} #demo-cursor.pressed {width:24px;height:24px;margin:-12px;background:#ffbd76b8;box-shadow:0 0 0 3px #284c48} #demo-caption {position:fixed;bottom:116px;left:50%;transform:translateX(-50%);padding:10px 19px;border-radius:24px;background:#ffffffdf;color:#355c52;font:500 18px system-ui;pointer-events:none;z-index:9998} #demo-marker {position:fixed;left:0;top:0;width:8px;height:8px;background:#000;z-index:10000;pointer-events:none}`;
    document.head.append(style);
    for (const identifier of ["demo-cursor", "demo-caption", "demo-marker"]) {
      const element = document.createElement("div");
      element.id = identifier;
      document.body.append(element);
    }
    window.demoMousePosition = { x: 100, y: 100 };
    window.addEventListener("pointermove", (event) => {
      window.demoMousePosition = { x: event.clientX, y: event.clientY };
      document.querySelector("#demo-cursor").style.transform =
        `translate(${event.clientX}px,${event.clientY}px)`;
    });
    window.addEventListener("pointerdown", () =>
      document.querySelector("#demo-cursor").classList.add("pressed"),
    );
    window.addEventListener("pointerup", () =>
      document.querySelector("#demo-cursor").classList.remove("pressed"),
    );
  });
  const bounds = await page.locator("#seal-canvas").boundingBox();
  const grip = {
    x: bounds.x + bounds.width * 0.5,
    y: bounds.y + bounds.height * 0.51,
  };
  await page.mouse.move(grip.x + 240, grip.y + 120);
  await caption("No trumpet yet");
  recordingStart = await page.evaluate(() => {
    window.demoRecordingStart = performance.now();
    window.demoAudioCapture.startFrame =
      window.sealDebug.audio.context.currentTime *
      window.demoAudioCapture.sampleRate;
    document.querySelector("#demo-marker").style.background = "#ff00ff";
    return window.demoRecordingStart;
  });
  await checkpoint("start-unequipped");
  await page.waitForTimeout(2500);
  await moveMouse(grip.x, grip.y, 500);
  await page.mouse.down();
  await moveMouse(grip.x, grip.y - 160, 650);
  await checkpoint("boing-up");
  await moveMouse(grip.x, grip.y + 95, 750);
  await checkpoint("boing-down");
  await page.mouse.up();
  await page.waitForTimeout(700);
  await caption("Give him a trumpet");
  const trumpetBounds = await page.locator("#horn-toggle").boundingBox();
  await moveMouse(
    trumpetBounds.x + trumpetBounds.width / 2,
    trumpetBounds.y + trumpetBounds.height / 2,
    700,
  );
  await page.mouse.click(
    trumpetBounds.x + trumpetBounds.width / 2,
    trumpetBounds.y + trumpetBounds.height / 2,
  );
  await checkpoint("trumpet-equipped");
  await page.waitForTimeout(600);
  await caption("One pull, one note");
  await moveMouse(grip.x, grip.y, 650);
  await page.mouse.down();
  await moveMouse(grip.x, grip.y - 165, 750);
  await page.mouse.up();
  await checkpoint("single-note");
  await page.waitForTimeout(500);
  await caption("3 seconds later…");
  await page.waitForTimeout(2700);
  await checkpoint("idle-reset");
  await caption("Keep squeezing");
  await moveMouse(grip.x, grip.y, 450);
  await page.mouse.down();
  for (let stroke = 0; stroke < 12; stroke++) {
    await moveMouse(grip.x, grip.y + (stroke % 2 === 0 ? -155 : 105), 520);
    await checkpoint(`melody-stroke-${stroke + 1}`);
  }
  await page.mouse.up();
  await page.waitForTimeout(350);
  await moveMouse(grip.x, grip.y, 400);
  await page.mouse.down();
  await moveMouse(grip.x + 180, grip.y, 650);
  await checkpoint("horizontal-right");
  await moveMouse(grip.x - 150, grip.y, 850);
  await checkpoint("horizontal-left");
  await page.mouse.up();
  await caption("");
  await moveMouse(grip.x + 250, grip.y + 140, 550);
  await page.waitForTimeout(2000);
  await checkpoint("finished");
  const audioCapture = await page.evaluate(() => window.demoAudioCapture);
  const duration = trace.at(-1).milliseconds / 1000;
  const waveResult = writeWave(audioCapture, duration);
  await writeFile(outputPath("demo-audio.wav"), waveResult.wave);
  await page.screenshot({ path: outputPath("demo-final.png") });
  await context.close();
  const videoPath = outputPath("demo-raw.webm");
  await rename(await video.path(), videoPath);
  const videoProbe = JSON.parse(
    runMedia("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-of",
      "json",
      videoPath,
    ]),
  );
  const rate = videoProbe.streams[0].r_frame_rate.split("/").map(Number);
  const framesPerSecond = rate[0] / rate[1];
  const markerPixels = runMedia("ffmpeg", [
    "-v",
    "error",
    "-threads",
    "2",
    "-i",
    videoPath,
    "-vf",
    "crop=2:2:2:2,scale=1:1",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  let firstMarkerFrame = -1;
  for (let offset = 0; offset < markerPixels.length; offset += 3) {
    if (
      markerPixels[offset] > 160 &&
      markerPixels[offset + 1] < 80 &&
      markerPixels[offset + 2] > 160
    ) {
      firstMarkerFrame = offset / 3;
      break;
    }
  }
  if (firstMarkerFrame < 0)
    throw new Error("Could not identify recording synchronization marker");
  const videoStartSeconds = firstMarkerFrame / framesPerSecond;
  const finalPath = outputPath("honking-seal-demo.mp4");
  runMedia("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-threads",
    "2",
    "-ss",
    String(videoStartSeconds),
    "-i",
    videoPath,
    "-i",
    outputPath("demo-audio.wav"),
    "-t",
    String(duration),
    "-vf",
    "drawbox=x=0:y=0:w=8:h=8:color=0xe8f5ef:t=fill,fps=30",
    "-c:v",
    "libx264",
    "-threads",
    "2",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    finalPath,
  ]);
  runMedia("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-threads",
    "2",
    "-i",
    finalPath,
    "-vf",
    `fps=9/${duration},scale=480:-1,tile=3x3`,
    "-frames:v",
    "1",
    outputPath("demo-contact-sheet.jpg"),
  ]);
  const finalProbe = JSON.parse(
    runMedia("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      finalPath,
    ]),
  );
  const checkpointSeconds = (label) => trace.find((entry) => entry.label === label).milliseconds / 1000;
  const boingAudio = measureAudioWindow(waveResult.wave, audioCapture.sampleRate, 0, checkpointSeconds("trumpet-equipped"));
  const hornAudio = measureAudioWindow(waveResult.wave, audioCapture.sampleRate, checkpointSeconds("trumpet-equipped"), duration);
  const idleWaitSeconds = checkpointSeconds("idle-reset") - checkpointSeconds("single-note");
  const checks = {
    noPageErrors: errors.length === 0,
    startsUnequipped: trace[0].hornEquipped === false,
    boingWithoutNotes:
      trace.find((entry) => entry.label === "boing-down").position === 0,
    singleNote:
      trace.find((entry) => entry.label === "single-note").position === 1,
    idleReset:
      trace.find((entry) => entry.label === "idle-reset").position === 0,
    melodyContinues:
      trace.find((entry) => entry.label === "melody-stroke-12").position === 12,
    horizontalNotes:
      trace.find((entry) => entry.label === "horizontal-left").position === 14,
    audioPresent: waveResult.peak > 0.01,
    boingAudioPresent: boingAudio.peak > 0.01,
    hornAudioPresent: hornAudio.peak > 0.01,
    idleWaitAtLeastThreeSeconds: idleWaitSeconds >= 3,
    h264Video: finalProbe.streams.some((stream) => stream.codec_name === "h264" && stream.pix_fmt === "yuv420p" && stream.r_frame_rate === "30/1"),
    aacAudio: finalProbe.streams.some((stream) => stream.codec_name === "aac"),
    durationInRange: duration >= 22 && duration <= 30,
  };
  const report = {
    pageUrl,
    viewport,
    recordingStart,
    videoStartSeconds,
    framesPerSecond,
    duration,
    audio: {
      peak: waveResult.peak,
      rms: waveResult.rms,
      sampleRate: audioCapture.sampleRate,
      boing: boingAudio,
      horn: hornAudio,
    },
    idleWaitSeconds,
    checks,
    errors,
    trace,
    finalProbe,
    videoPath,
    finalPath,
  };
  await writeFile(
    outputPath("demo-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({ finalPath, duration, checks, audio: report.audio }),
  );
  if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
} finally {
  await browser.close();
}
