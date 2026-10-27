// Records shots/first-transistor-anatomy.mp4 from the light film page (node build.mjs --film), frame by
// frame, on the page's own deterministic clock (?clock=manual): no screen recording. The figure reports
// what happens as timed events; sound.mjs renders the sound track from that log. Also checks that the
// shareable page is self-contained. Same recipe as ../enigma-anatomy/record.mjs.
//   node record.mjs            check + record
//   node record.mjs --check    only the self-contained check
//   node record.mjs --preview  plays the storyboard and saves a few stills (shots/preview-*.png), no film
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
const NAME = "first-transistor-anatomy";
const pageFile = join(HERE, `${NAME}.html`);
const filmFile = join(HERE, `${NAME}-film.html`);
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
// Film spec v2 (../_anatomy-series/film-spec-v2.md). The film opens on the whole device, centred, with
// no magnified view.
const OPENING = 5;
// Then one slow walk through the five steps, each one named as the current reaches it. The magnified
// view is born just before the charges enter the germanium, which is what it shows.
const WALK = { from: OPENING + 0.2, seconds: 6.4 };
const WALK_END = WALK.from + WALK.seconds;
const BIRTH_AT = OPENING;
const MAKE_ROOM_SECONDS = 1;
// Then it runs at normal speed, the longest part: the batteries are switched off and on again, and the
// input is turned down and up, so that the output is seen to follow.
const BIAS_OFF_AT = 13;
const BIAS_ON_AT = 14.5;
const LEVELS = [[0, 0.5], [15.6, 0.5], [16.3, 0.2], [17.3, 0.2], [18.0, 0.62], [18.9, 0.62], [19.5, 0.5], [SECONDS, 0.5]];
// Only then it comes apart: the magnified view fades first, the assemblies leave one by one, hold with
// the numbered legend and go back together. It ends assembled and running.
const DETAIL_OFF_AT = 19.4;
const APART_AT = 19.9;
const CLOSE_AT = 24.3;
const BACK_AT = CLOSE_AT + 3.2;
const POSTER_AT = 9.0;
const INSET_GAP = 30;
const LEGEND_ROOM = 290;
const LEGEND_LIFT = 60;
const BASE_WEIGHT = 1.7;
const PREVIEW = process.argv.includes("--preview");
const PREVIEW_TIMES = [1, 3, BIRTH_AT + 0.35, 6, 9, 13.3, 18.6, 23.6, 29.3];

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// Camera keyframes: time, then the point of the drawing held at the centre of the frame, and the zoom.
// `centred` holds the device in the middle of the frame; `beside` moves it left by just what the
// magnified view needs; `apart` fits the exploded pose into the frame above the legend.
function cameraKeys(view) {
  const middle = view.height / 2;
  const centred = { x: view.rest.x, y: middle, zoom: 1 };
  const overlap = FRAME.width / 2 + view.rest.width / 2 + INSET_GAP - view.detailLeft;
  const beside = { x: view.rest.x + Math.max(0, overlap), y: middle, zoom: 1 };
  const apartZoom = Math.min((FRAME.width - 150) / view.apart.width, (FRAME.height - LEGEND_ROOM) / view.apart.height);
  const apart = { x: view.apart.x, y: view.apart.y + LEGEND_LIFT / apartZoom, zoom: apartZoom };
  return [
    [0, centred],
    [BIRTH_AT, centred],
    [BIRTH_AT + MAKE_ROOM_SECONDS, beside],
    [APART_AT, beside],
    [APART_AT + 1.9, apart],
    [CLOSE_AT + 0.6, apart],
    [BACK_AT, beside],
    [SECONDS, beside],
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

// Once born, the magnified view shows with the device assembled: it fades before the device comes
// apart and returns when it is back together.
function detailAt(time) {
  return Math.max(1 - smooth((time - DETAIL_OFF_AT) / (APART_AT - DETAIL_OFF_AT)), smooth((time - (BACK_AT - 0.4)) / 0.8));
}

// The five numbered steps show during the walk-through only.
function stepsAt(time) {
  return smooth((time - (WALK.from - 0.2)) / 0.3) * (1 - smooth((time - (WALK_END + 0.25)) / 0.4));
}

function levelAt(time) {
  let index = 0;
  while (index < LEVELS.length - 2 && time >= LEVELS[index + 1][0]) index++;
  const [fromTime, from] = LEVELS[index];
  const [toTime, to] = LEVELS[index + 1];
  return Math.round((from + (to - from) * smooth((time - fromTime) / (toTime - fromTime))) * 1000) / 1000;
}

const frameOf = (seconds) => Math.round(seconds * FPS) + 1;

// What the storyboard asks of the figure just before the step of the clock that ends in `frame`.
function actionsAt(frame) {
  const actions = [];
  if (frame === frameOf(WALK.from)) actions.push(["walk", WALK.seconds]);
  if (frame === frameOf(BIAS_OFF_AT)) actions.push(["setBias", false]);
  if (frame === frameOf(BIAS_ON_AT)) actions.push(["setBias", true]);
  if (frame === frameOf(APART_AT)) actions.push(["setApart", true]);
  if (frame === frameOf(CLOSE_AT)) actions.push(["setApart", false]);
  if (frame > frameOf(LEVELS[1][0])) actions.push(["setLevel", levelAt(frame / FPS)]);
  return actions;
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
  const view = await page.evaluate(() => window.__transistor.view());
  const keys = cameraKeys(view);
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const told = await page.evaluate(
      ({ camera, detail, birth, steps, actions, step }) => {
        const transistor = window.__transistor;
        for (const [name, value] of actions) transistor[name](value);
        if (step > 0) transistor.advance(step);
        transistor.detail(detail);
        transistor.birth(birth);
        transistor.steps(steps);
        transistor.camera(camera.x, camera.y, camera.zoom, camera.weight);
        return { state: transistor.state(), events: transistor.takeEvents() };
      },
      { camera: cameraAt(keys, time), detail: detailAt(time), birth: time - BIRTH_AT, steps: stepsAt(time), actions: actionsAt(frame), step: frame === 0 ? 0 : 1 / FPS },
    );
    events.push(...told.events);
    states.push(told.state);
    if (PREVIEW) {
      const wanted = PREVIEW_TIMES.some((second) => Math.round(second * FPS) === frame);
      if (wanted) await page.screenshot({ type: "png", path: join(shots, `preview-${time.toFixed(2)}.png`) });
      continue;
    }
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === Math.round(POSTER_AT * FPS)) await page.screenshot({ type: "png", path: join(shots, `${NAME}-poster.png`) });
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
  const firstLabel = events.find((event) => event.name === "step-label");
  const switchOff = events.find((event) => event.name === "bias-switch");
  const seated = events.find((event) => event.name === "apart-seated");
  const checks = [syncOf(firstLabel, "first step label"), syncOf(switchOff, "bias switch"), syncOf(seated, "reassembly tap")];
  for (const check of checks) {
    const before = states[check.frame - 1];
    const now = states[check.frame];
    check.picture = `frame ${check.frame - 1}: walk ${before.walk}, bias ${before.biasOn}, open ${before.open} -> frame ${check.frame}: walk ${now.walk}, bias ${now.biasOn}, open ${now.open}`;
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
  if (PREVIEW) {
    await film(page, null);
    await context.close();
    console.log(problems.length ? `console problems in the preview:\n${problems.join("\n")}` : "preview stills written, no console problems");
    return;
  }
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

  const out = join(shots, `${NAME}.mp4`);
  const web = join(shots, `${NAME}-web.mp4`);
  const audio = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "copy", ...audio, "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", ...audio, "-shortest", "-movflags", "+faststart", web], { stdio: "inherit" });
  console.log(filmSoundReport(out));

  for (const check of syncChecks(events, states)) console.log(`sync · ${check.label} (${check.name}) sounds at ${check.at.toFixed(4)} s · first shown in frame ${check.frame} · picture trails by ${check.lateFrames} frame · ${check.picture}`);
  const gains = states.filter((state) => state.biasOn && !state.apart).map((state) => state.voltageGain);
  console.log(`gain shown while running · voltage ×${Math.min(...gains)} to ×${Math.max(...gains)} · bias off for ${states.filter((state) => !state.biasOn).length} frames`);
  for (const [name, second] of [["opening", 1], ["running", 3], ["birth", BIRTH_AT + 0.35], ["birth-late", 6], ["slow", 9], ["bias-off", 13.3], ["apart", 23.6], ["end", 29.3]]) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(shots, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,60))',scale=480:-1,tile=5x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  const timeline = `opening 0-${OPENING} s · walk ${WALK.from}-${WALK_END} s · zoom frame born at ${BIRTH_AT} s · running ${WALK_END}-${APART_AT} s · bias off ${BIAS_OFF_AT}-${BIAS_ON_AT} s · input levels ${JSON.stringify(LEVELS)} · zoom frame fades from ${DETAIL_OFF_AT} s · apart at ${APART_AT} s, closing at ${CLOSE_AT} s, wide again by ${BACK_AT} s`;
  console.log(`timeline · ${timeline}`);
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · ${timeline} · camera ${JSON.stringify(keys)}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, seven video frames and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await checkSelfContained(browser);
  if (!process.argv.includes("--check")) await record(browser);
} finally {
  await browser.close();
}
