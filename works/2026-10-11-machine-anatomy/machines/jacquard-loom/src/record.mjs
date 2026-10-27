// Records shots/jacquard-loom-anatomy.mp4 from the light film page (node build.mjs --film), frame by
// frame, on the page's own deterministic clock (?clock=manual): no screen recording. The figure reports
// what happens as timed events; sound.mjs renders the sound track from that log. Also checks that the
// shareable page is self-contained.
//   node record.mjs            check + record
//   node record.mjs --check    only the self-contained check
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildSoundtrack, measureLoudness } from "./sound.mjs";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageFile = join(HERE, "jacquard-loom-anatomy.html");
const filmFile = join(HERE, "jacquard-loom-anatomy-film.html");
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
const APART_AT = 3;
const CLOSE_AT = 9;
const POSTER_AT = 8;
// When the loom weaves, and how long one pick lasts there: one slow pick, two read slowly, five at working pace.
const WEAVE = [
  { from: 0.5, to: 3, pickSeconds: 2.5 },
  { from: 13.3, to: 21.7, pickSeconds: 4.2 },
  { from: 22, to: 29, pickSeconds: 1.4 },
];
const BASE_WEIGHT = 1.7;
// At the wide framing the loom stands left of centre and the detail window fills the right of the frame.
const WIDE_SHIFT = 400;

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// Camera keyframes: time, then the point of the drawing held at the centre of the frame, and the zoom.
function cameraKeys(view, points) {
  const centre = { x: view.width / 2, y: view.height / 2, zoom: 1 };
  const wide = { x: view.width / 2 + WIDE_SHIFT, y: view.height / 2, zoom: 1 };
  const apartZoom = Math.min((FRAME.width - 150) / view.apart.width, (FRAME.height - 260) / view.apart.height);
  const apart = { x: view.apart.x, y: view.apart.y + 62 / apartZoom, zoom: apartZoom };
  const head = { x: points.head[0], y: points.head[1], zoom: 2.7 };
  const read = { x: points.read[0], y: points.read[1], zoom: 3.2 };
  const shed = { x: points.shed[0], y: points.shed[1], zoom: 1.9 };
  return [
    [0, wide],
    [APART_AT, wide],
    [4.8, apart],
    [9.3, apart],
    [12.3, centre],
    [13.2, centre],
    [16.4, head],
    [18.9, read],
    [20.2, shed],
    [21.9, shed],
    [23.6, wide],
    [SECONDS, wide],
  ];
}

function cameraAt(keys, time) {
  let index = 0;
  while (index < keys.length - 2 && time >= keys[index + 1][0]) index++;
  const [fromTime, from] = keys[index];
  const [toTime, to] = keys[index + 1];
  const share = smooth((time - fromTime) / (toTime - fromTime));
  const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * share);
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, zoom, weight: BASE_WEIGHT * zoom ** 0.45 };
}

// The detail window shows with the wide framing only: over the first pick and again after the pull back.
function detailAt(time) {
  return Math.max(1 - smooth((time - 2.5) / 0.5), smooth((time - 23.1) / 0.8));
}

function weaveAt(time) {
  const found = WEAVE.find((part) => time >= part.from - 1e-9 && time < part.to - 1e-9);
  return found ? found.pickSeconds : null;
}

async function checkSelfContained(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requests = [];
  const problems = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => message.type() === "error" && problems.push(message.text()));
  page.on("pageerror", (error) => problems.push(String(error)));
  await page.goto(pathToFileURL(pageFile).href);
  await page.waitForTimeout(1500);
  const facts = await page.evaluate(() => ({
    title: document.title,
    theme: document.body.getAttribute("data-theme"),
    background: getComputedStyle(document.body).backgroundColor,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
    readout: document.querySelector("[data-readout]").textContent,
    external: Array.from(document.querySelectorAll("[src],link[href]")).length,
    storage: /localStorage|sessionStorage/.test(document.documentElement.innerHTML),
  }));
  await context.close();
  const others = requests.filter((url) => url !== pathToFileURL(pageFile).href);
  console.log(`self-contained check · ${(statSync(pageFile).size / 1024).toFixed(0)} KB · theme ${facts.theme} · requests ${requests.length} (other than the page itself: ${others.length}) · title "${facts.title}" · background ${facts.background}`);
  console.log(`at 390 px: scrollWidth ${facts.scrollWidth} vs innerWidth ${facts.innerWidth} · elements with src/href ${facts.external} · mentions web storage ${facts.storage} · readout "${facts.readout}" · console problems ${problems.length}`);
  if (others.length) console.log(others.join("\n"));
  if (problems.length) console.log(problems.join("\n"));
}

function encoderFor(file) {
  const colour = ["-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", ...colour, "-movflags", "+faststart", file];
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
}

// Plays the storyboard one frame at a time and returns what the figure reported: its events and its state per frame.
async function film(page, encoder) {
  const facts = await page.evaluate(() => ({
    view: window.__loom.view(),
    head: window.__loom.project([-30, 0, 170]),
    read: window.__loom.project([-37, 0, 169]),
    shed: window.__loom.project([32, 0, 98]),
  }));
  const keys = cameraKeys(facts.view, facts);
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const stepStart = (frame - 1) / FPS;
    let apart = null;
    if (frame === APART_AT * FPS + 1) apart = true;
    if (frame === CLOSE_AT * FPS + 1) apart = false;
    const told = await page.evaluate(
      ({ camera, detail, pickSeconds, apart, step }) => {
        const loom = window.__loom;
        if (apart !== null) loom.setApart(apart);
        loom.setWeaving(pickSeconds !== null);
        if (pickSeconds !== null) loom.setPickSeconds(pickSeconds);
        if (step > 0) loom.advance(step);
        loom.detail(detail);
        loom.camera(camera.x, camera.y, camera.zoom, camera.weight);
        return { state: loom.state(), events: loom.takeEvents() };
      },
      { camera: cameraAt(keys, time), detail: detailAt(time), pickSeconds: frame === 0 ? null : weaveAt(stepStart + 0.5 / FPS), apart, step: frame === 0 ? 0 : 1 / FPS },
    );
    events.push(...told.events);
    states.push(told.state);
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === POSTER_AT * FPS) await page.screenshot({ type: "png", path: join(shots, "jacquard-loom-anatomy-poster.png") });
    if (frame % 150 === 0) console.log(`frame ${frame}/${frames} · ${JSON.stringify(told.state)}`);
  }
  console.log(`last frame · ${JSON.stringify(states[states.length - 1])}`);
  return { events, states, keys };
}

// For one event, the first frame whose picture can show it, and how far the picture trails the sound.
function syncOf(event, label) {
  const frame = Math.ceil(event.at * FPS - 1e-6);
  const late = frame - event.at * FPS;
  return { label, name: event.name, at: event.at, frame, lateFrames: Math.round(late * 100) / 100 };
}

function syncChecks(events, states) {
  const seat = events.find((event) => event.name === "card-seat" && event.at > 17);
  const knockSound = events.find((event) => event.name === "shuttle-knock" && event.at > 17);
  const seated = events.find((event) => event.name === "apart-seated");
  const checks = [syncOf(seat, "card seat"), syncOf(knockSound, "shuttle knock"), syncOf(seated, "reassembly thunk")];
  for (const check of checks) {
    const before = states[check.frame - 1];
    const now = states[check.frame];
    check.picture = `frame ${check.frame - 1}: phase ${before.phase}, open ${before.open} -> frame ${check.frame}: phase ${now.phase}, open ${now.open}`;
  }
  return checks;
}

function syncSheet(video, checks) {
  const wanted = checks.flatMap((check) => [check.frame - 1, check.frame, check.frame + 1]);
  const select = wanted.map((frame) => `eq(n\\,${frame})`).join("+");
  const sheet = join(shots, "video-sync-sheet.png");
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vf", `select='${select}',scale=960:-1,tile=3x3`, "-frames:v", "1", "-fps_mode", "passthrough", sheet], { stdio: "inherit" });
  return sheet;
}

async function record(browser) {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => message.type() === "error" && problems.push(message.text()));
  page.on("pageerror", (error) => problems.push(String(error)));
  await page.goto(`${pathToFileURL(filmFile).href}?clock=manual&picks=0`);
  const silent = join(shots, "film-silent.mp4");
  const encoder = encoderFor(silent);
  const { events, states, keys } = await film(page, encoder);
  encoder.stdin.end();
  await new Promise((resolve) => encoder.on("exit", resolve));
  await context.close();
  if (problems.length) console.log(`console problems while filming:\n${problems.join("\n")}`);

  const eventsFile = join(shots, "film-events.json");
  writeFileSync(eventsFile, JSON.stringify(events));
  writeFileSync(join(shots, "film-frames.json"), JSON.stringify(states));
  const soundFile = join(shots, "film-sound.wav");
  const track = buildSoundtrack(eventsFile, soundFile, SECONDS);
  console.log(`sound · ${track.events} events · ${JSON.stringify(track.counts)} · needle ticks ${track.ticks}`);
  console.log(`sound master · gain ${track.gain.toFixed(1)} dB into the limiter · integrated ${track.integrated} LUFS · range ${track.range} LU · true peak ${track.truePeak} dBFS`);

  const out = join(shots, "jacquard-loom-anatomy.mp4");
  const web = join(shots, "jacquard-loom-anatomy-web.mp4");
  const audio = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "copy", ...audio, "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", ...audio, "-shortest", "-movflags", "+faststart", web], { stdio: "inherit" });
  const final = measureLoudness(out);
  console.log(`film loudness (from the mp4) · integrated ${final.integrated} LUFS · true peak ${final.truePeak} dBFS`);

  const checks = syncChecks(events, states);
  for (const check of checks) console.log(`sync · ${check.label} (${check.name}) sounds at ${check.at.toFixed(4)} s · first shown in frame ${check.frame} · picture trails by ${check.lateFrames} frame · ${check.picture}`);
  const sheet = syncSheet(out, checks);
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,75))',scale=640:-1,tile=4x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · weave ${JSON.stringify(WEAVE)} · apart at ${APART_AT} s, closing at ${CLOSE_AT} s · camera ${JSON.stringify(keys)}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, ${sheet} and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
try {
  await checkSelfContained(browser);
  if (!process.argv.includes("--check")) await record(browser);
} finally {
  await browser.close();
}
