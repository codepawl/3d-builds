// Records shots/enigma-anatomy.mp4 from the light film page (node build.mjs --film), frame by frame, on
// the page's own deterministic clock (?clock=manual): no screen recording. The figure reports what
// happens as timed events; sound.mjs renders the sound track from that log. Also checks that the
// shareable page is self-contained. Same recipe as ../jacquard-loom-anatomy/record.mjs.
//   node record.mjs            check + record
//   node record.mjs --check    only the self-contained check
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildSoundtrack, measureLoudness, measureSpectrum } from "./sound.mjs";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageFile = join(HERE, "enigma-anatomy.html");
const filmFile = join(HERE, "enigma-anatomy-film.html");
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
const APART_AT = 11.7;
const CLOSE_AT = 19.8;
const POSTER_AT = 18.6;
// The film first plays one key press slowly, with its six steps named as the current reaches each part.
// G is on a cable, so the plugboard has something to swap.
const SLOW = { letter: "G", from: 0.4, to: 8, pressSeconds: 7.6 };
// Then the machine types at its normal pace: three letters before it comes apart, four after it is back together.
const TYPE = [
  { from: 8.1, to: 11.5, pressSeconds: 1.15 },
  { from: 24.2, to: 29.3, pressSeconds: 1.3 },
];
// The wide framing holds the machine a little above the middle, clear of the letter trace under it.
const WIDE_LIFT = 60;
const BASE_WEIGHT = 1.7;
// At the wide framing the machine stands left of centre and the detail window fills the right of the frame.
const WIDE_SHIFT = 440;

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// Camera keyframes: time, then the point of the drawing held at the centre of the frame, and the zoom.
function cameraKeys(view) {
  const wide = { x: view.width / 2 + WIDE_SHIFT, y: view.height / 2 + WIDE_LIFT, zoom: 1 };
  const apartZoom = Math.min((FRAME.width - 150) / view.apart.width, (FRAME.height - 270) / view.apart.height);
  const apart = { x: view.apart.x, y: view.apart.y + 66 / apartZoom, zoom: apartZoom };
  return [
    [0, wide],
    [APART_AT, wide],
    [APART_AT + 1.9, apart],
    [CLOSE_AT + 0.8, apart],
    [CLOSE_AT + 4.2, wide],
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

// The detail window shows with the wide framing only: while the machine types, before and after it is apart.
function detailAt(time) {
  return Math.max(1 - smooth((time - (APART_AT - 0.3)) / 0.5), smooth((time - (CLOSE_AT + 4)) / 0.8));
}

// The six numbered steps show during the slow key press only.
function stepsAt(time) {
  return smooth((time - (SLOW.from - 0.1)) / 0.3) * (1 - smooth((time - (SLOW.to - 0.25)) / 0.35));
}

// What the keyboard does in the step of the clock that starts at `time`: how long a press lasts there,
// and whether the machine picks its own next letter.
function typingAt(time) {
  if (time >= SLOW.from - 1e-9 && time < SLOW.to - 1e-9) return { pressSeconds: SLOW.pressSeconds, touring: false };
  const found = TYPE.find((part) => time >= part.from - 1e-9 && time < part.to - 1e-9);
  return found ? { pressSeconds: found.pressSeconds, touring: true } : { pressSeconds: null, touring: false };
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
    storage: /localStorage|sessionStorage|indexedDB/.test(document.documentElement.innerHTML),
    network: /\bfetch\(|XMLHttpRequest|https?:\/\//.test(document.documentElement.innerHTML.replace(/http:\/\/www\.w3\.org\/[\w/]+/g, "")),
  }));
  await context.close();
  const others = requests.filter((url) => url !== pathToFileURL(pageFile).href);
  console.log(`self-contained check · ${(statSync(pageFile).size / 1024).toFixed(0)} KB · theme ${facts.theme} · requests ${requests.length} (other than the page itself: ${others.length}) · title "${facts.title}" · background ${facts.background}`);
  console.log(`at 390 px: scrollWidth ${facts.scrollWidth} vs innerWidth ${facts.innerWidth} · elements with src/href ${facts.external} · mentions web storage ${facts.storage} · mentions fetch, XHR or a URL ${facts.network} · readout "${facts.readout}" · console problems ${problems.length}`);
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
  const view = await page.evaluate(() => window.__enigma.view());
  const keys = cameraKeys(view);
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const stepStart = (frame - 1) / FPS;
    let apart = null;
    if (frame === APART_AT * FPS + 1) apart = true;
    if (frame === Math.round(CLOSE_AT * FPS) + 1) apart = false;
    const plan = frame === 0 ? { pressSeconds: null, touring: false } : typingAt(stepStart + 0.5 / FPS);
    const told = await page.evaluate(
      ({ camera, detail, steps, plan, letter, apart, step }) => {
        const enigma = window.__enigma;
        if (apart !== null) enigma.setApart(apart);
        enigma.setTyping(plan.touring);
        if (plan.pressSeconds !== null) enigma.setPressSeconds(plan.pressSeconds);
        if (letter) enigma.type(letter);
        if (step > 0) enigma.advance(step);
        enigma.detail(detail);
        enigma.steps(steps);
        enigma.camera(camera.x, camera.y, camera.zoom, camera.weight);
        return { state: enigma.state(), events: enigma.takeEvents() };
      },
      { camera: cameraAt(keys, time), detail: detailAt(time), steps: stepsAt(time), plan, letter: frame === Math.round(SLOW.from * FPS) + 1 ? SLOW.letter : null, apart, step: frame === 0 ? 0 : 1 / FPS },
    );
    events.push(...told.events);
    states.push(told.state);
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === POSTER_AT * FPS) await page.screenshot({ type: "png", path: join(shots, "enigma-anatomy-poster.png") });
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
  const keyDown = events.find((event) => event.name === "key-down" && event.at > CLOSE_AT + 4);
  const lampOn = events.find((event) => event.name === "lamp-on" && event.at > CLOSE_AT + 4);
  const seated = events.find((event) => event.name === "apart-seated");
  const checks = [syncOf(keyDown, "key clack"), syncOf(lampOn, "lamp tone"), syncOf(seated, "reassembly thunk")];
  for (const check of checks) {
    const before = states[check.frame - 1];
    const now = states[check.frame];
    check.picture = `frame ${check.frame - 1}: phase ${before.phase}, open ${before.open} -> frame ${check.frame}: phase ${now.phase}, open ${now.open}`;
  }
  return checks;
}

function soundReport(track) {
  const spectrum = track.spectrum;
  return `sound track (wav) · one linear gain of ${track.gainDb.toFixed(1)} dB, no limiter · integrated ${track.integrated} LUFS · true peak ${track.truePeak} dBFS · sample peak ${track.samplePeakDb} dBFS · crest factor ${track.crestDb} dB · samples at full scale ${track.clipped} · below 120 Hz ${spectrum.below120}% · 120 Hz to 3.5 kHz ${spectrum.from120to3500}% · above 3.5 kHz ${spectrum.above3500}%`;
}

function filmSoundReport(file) {
  const spectrum = measureSpectrum(file);
  const loudness = measureLoudness(file);
  return `film sound (from the mp4) · integrated ${loudness.integrated} LUFS · true peak ${loudness.truePeak} dBFS · below 120 Hz ${spectrum.below120}% · 120 Hz to 3.5 kHz ${spectrum.from120to3500}% · above 3.5 kHz ${spectrum.above3500}%`;
}

async function record(browser) {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => message.type() === "error" && problems.push(message.text()));
  page.on("pageerror", (error) => problems.push(String(error)));
  await page.goto(`${pathToFileURL(filmFile).href}?clock=manual`);
  const silent = join(shots, "film-silent.mp4");
  const encoder = encoderFor(silent);
  const { events, states, keys } = await film(page, encoder);
  encoder.stdin.end();
  await new Promise((resolve) => encoder.on("exit", resolve));
  await context.close();
  console.log(problems.length ? `console problems while filming:\n${problems.join("\n")}` : "no console problems while filming");

  const eventsFile = join(shots, "film-events.json");
  writeFileSync(eventsFile, JSON.stringify(events));
  writeFileSync(join(shots, "film-frames.json"), JSON.stringify(states));
  const soundFile = join(shots, "film-sound.wav");
  const track = buildSoundtrack(eventsFile, soundFile, SECONDS);
  console.log(`sound · ${track.events} events · ${JSON.stringify(track.counts)}`);
  console.log(soundReport(track));

  const out = join(shots, "enigma-anatomy.mp4");
  const web = join(shots, "enigma-anatomy-web.mp4");
  const audio = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "copy", ...audio, "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", ...audio, "-shortest", "-movflags", "+faststart", web], { stdio: "inherit" });
  console.log(filmSoundReport(out));

  for (const check of syncChecks(events, states)) console.log(`sync · ${check.label} (${check.name}) sounds at ${check.at.toFixed(4)} s · first shown in frame ${check.frame} · picture trails by ${check.lateFrames} frame · ${check.picture}`);
  const typed = states[states.length - 1];
  console.log(`typed in the film · ${typed.input} -> ${typed.output} · rotors end at ${typed.positions}`);
  for (const [name, second] of [["slow", 4.4], ["typing", 10.2], ["apart", 18.6], ["end", 28.9]]) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(shots, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,75))',scale=480:-1,tile=4x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · slow press ${JSON.stringify(SLOW)} · typing ${JSON.stringify(TYPE)} · apart at ${APART_AT} s, closing at ${CLOSE_AT} s · camera ${JSON.stringify(keys)}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, four video frames and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await checkSelfContained(browser);
  if (!process.argv.includes("--check")) await record(browser);
} finally {
  await browser.close();
}
