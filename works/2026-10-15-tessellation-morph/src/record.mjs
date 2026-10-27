// Records the scripted Tessellation Morph run (index.html#record) to an MP4 with its flap soundtrack.
// Usage: node record.mjs [output.mp4] [--sketch] [--start=<station clock>] [--jump=<stations>]
// Drives Remotion's headless Chrome over the DevTools protocol, one deterministic frame at a time.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Point CHROME_PATH at a Chrome or chrome-headless-shell executable.
const chromePath = process.env.CHROME_PATH;
// --sketch records the same run in the pencil sketch style.
const sketchMode = process.argv.includes("--sketch");
const outputArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const defaultName = sketchMode ? "tessellation-sketch.mp4" : "tessellation-morph-hover.mp4";
const outputPath = resolve(outputArgument ?? join(here, defaultName));
// --start=<station clock> and --jump=<stations> pick another scramble run.
const optionValue = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=")[1];
const runParameters = new URLSearchParams();
for (const name of ["start", "jump"]) if (optionValue(name)) runParameters.set(name, optionValue(name));
const runOptions = runParameters.size ? "?" + runParameters : "";
const workPath = join(here, "out");
const VIEWPORT = 720;
const DEVICE_SCALE = 1.5;
const DEBUG_PORT = 9341;
const FPS = 30;

mkdirSync(workPath, { recursive: true });
mkdirSync(dirname(outputPath), { recursive: true });

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${join(workPath, "chrome-profile")}`,
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  "--enable-unsafe-swiftshader",
  "about:blank",
], { stdio: "ignore" });

async function waitForBrowser() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      return (await response.json()).webSocketDebuggerUrl;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  throw new Error("headless Chrome did not start");
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.error) waiter.reject(new Error(data.error.message));
    else waiter.resolve(data.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolvePromise, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolvePromise, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  return new Promise((ready) => socket.addEventListener("open", () => ready({ send, close: () => socket.close() })));
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

const client = await connect(await waitForBrowser());
const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
await client.send("Emulation.setDeviceMetricsOverride", { width: VIEWPORT, height: VIEWPORT, deviceScaleFactor: DEVICE_SCALE, mobile: false }, sessionId);
await client.send("Page.enable", {}, sessionId);
await client.send("Page.navigate", { url: pathToFileURL(join(here, "index.html")).href + (sketchMode ? "#record-sketch" : "#record") + runOptions }, sessionId);
for (let attempt = 0; attempt < 200; attempt++) {
  const ready = await evaluate(client, sessionId, "Boolean(window.tessellationRecorder) && document.fonts.status === 'loaded'");
  if (ready) break;
  await new Promise((done) => setTimeout(done, 100));
}
const duration = await evaluate(client, sessionId, "window.tessellationRecorder.duration");
const frameCount = Math.round(duration * FPS);

const videoOnlyPath = join(workPath, "video-only.mp4");
const encoder = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
  videoOnlyPath,
], { stdio: ["pipe", "inherit", "inherit"] });

const started = Date.now();
for (let frame = 0; frame < frameCount; frame++) {
  await evaluate(client, sessionId, `window.tessellationRecorder.frame(${frame / FPS})`);
  const shot = await client.send("Page.captureScreenshot", { format: "png" }, sessionId);
  const image = Buffer.from(shot.data, "base64");
  if (!encoder.stdin.write(image)) await new Promise((done) => encoder.stdin.once("drain", done));
  if (frame % 90 === 0) console.log(`frame ${frame}/${frameCount} after ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
encoder.stdin.end();
await new Promise((done) => encoder.on("close", done));

const soundtrackPath = join(workPath, "flaps.wav");
writeFileSync(soundtrackPath, Buffer.from(await evaluate(client, sessionId, "window.tessellationRecorder.soundtrack()"), "base64"));
client.close();
chrome.kill();

const muxer = spawn("ffmpeg", [
  "-y", "-loglevel", "error", "-i", videoOnlyPath, "-i", soundtrackPath,
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outputPath,
], { stdio: "inherit" });
await new Promise((done) => muxer.on("close", done));
console.log(`wrote ${outputPath} (${frameCount} frames in ${((Date.now() - started) / 1000).toFixed(0)} s)`);
