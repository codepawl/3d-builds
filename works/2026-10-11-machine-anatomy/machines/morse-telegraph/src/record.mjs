// Records shots/morse-telegraph-anatomy.mp4 from the light film page (node build.mjs --film), frame by
// frame, on the page's own deterministic clock (?clock=manual): no screen recording. The figure reports
// what happens as timed events; sound.mjs renders the sound track from that log.
//   node record.mjs             record the film
//   node record.mjs --preview   only the still frames, without encoding (to check the framing)
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
const filmFile = join(HERE, "morse-telegraph-anatomy-film.html");
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });
const preview = process.argv.includes("--preview");

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
// The film in order: the whole model alone, one slow letter with its steps named and the zoom frame
// born, words at a working pace, the take-apart and back, and the telegraph sending again at the end.
const INSET_BORN_AT = 5.6;
const APART_AT = 16.5;
const CLOSE_AT = 21.3;
const POSTER_AT = 20.3;
// The film first sends one letter slowly, with its five steps named as the signal reaches each part.
// A is a dot and a dash, so both kinds of mark are seen being made.
const SLOW = { text: "A", at: 5, to: 10.4, pace: 0.85 };
// The film opens with the working telegraph sending at normal speed, with no zoom frame and no step labels.
const OPENING = { text: "WHAT H", at: 0, pace: 0.1 };
// Then a word at a working pace, before the model comes apart, and the next word after it is back together.
const WORDS = [
  { text: "TH GOD", at: 10.4, pace: 0.1 },
  { text: " WROUGHT", at: 25, pace: 0.1 },
];
const STILLS = [["opening", 1], ["sending-early", 3], ["birth", 6.15], ["birth-held", 7.2], ["slow-marking", 8.2], ["sending", 13.4], ["apart", 20.3], ["end", 27.6]];
// The wide framing holds the model above the middle, clear of the trace under it.
const WIDE_LIFT = 112;
const BASE_WEIGHT = 1.7;

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// Camera keyframes: time, then the point of the drawing held at the centre of the frame, and the zoom.
function cameraKeys(view) {
  const wide = { x: view.width / 2, y: view.height / 2 + WIDE_LIFT, zoom: 1 };
  const apartZoom = Math.min((FRAME.width - 150) / view.apart.width, (FRAME.height - 290) / view.apart.height);
  const apart = { x: view.apart.x, y: view.apart.y + 70 / apartZoom, zoom: apartZoom };
  return [
    [0, wide],
    [APART_AT, wide],
    [APART_AT + 1.9, apart],
    [CLOSE_AT + 0.8, apart],
    [CLOSE_AT + 3.4, wide],
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

// The zoom frame is born once, during the slow letter. It fades away before the model comes apart and
// comes back, without a second birth, once the model is together again.
function insetAt(time) {
  const shown = Math.max(1 - smooth((time - (APART_AT - 0.6)) / 0.5), smooth((time - (CLOSE_AT + 3.6)) / 0.7));
  return { seconds: time - INSET_BORN_AT, shown };
}

// The five numbered steps show during the slow letter only.
function stepsAt(time) {
  return smooth((time - (SLOW.at - 0.1)) / 0.3) * (1 - smooth((time - (SLOW.to - 0.5)) / 0.4));
}

// How many seconds one beat lasts in the step of the clock that starts at `time`.
function paceAt(time) {
  let pace = OPENING.pace;
  for (const word of [SLOW, ...WORDS]) {
    if (time >= word.at - 0.1 - 1e-9) pace = word.pace;
  }
  return pace;
}

function textAt(frame) {
  for (const part of [OPENING, SLOW, ...WORDS]) {
    if (frame === Math.round(part.at * FPS) + 1) return part.text;
  }
  return null;
}

function encoderFor(file) {
  const colour = ["-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", ...colour, "-movflags", "+faststart", file];
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
}

// Plays the storyboard one frame at a time and returns what the figure reported: its events and its state per frame.
async function film(page, encoder) {
  const view = await page.evaluate(() => window.__morse.view());
  const keys = cameraKeys(view);
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  const stillFrames = new Map(STILLS.map(([name, second]) => [Math.round(second * FPS), name]));
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const stepStart = (frame - 1) / FPS;
    let apart = null;
    if (frame === Math.round(APART_AT * FPS) + 1) apart = true;
    if (frame === Math.round(CLOSE_AT * FPS) + 1) apart = false;
    const told = await page.evaluate(
      ({ camera, inset, steps, pace, text, apart, step }) => {
        const morse = window.__morse;
        if (apart !== null) morse.setApart(apart);
        morse.setPace(pace);
        if (text) morse.send(text);
        if (step > 0) morse.advance(step);
        morse.inset(inset.seconds, inset.shown);
        morse.steps(steps);
        morse.camera(camera.x, camera.y, camera.zoom, camera.weight);
        return { state: morse.state(), events: morse.takeEvents() };
      },
      { camera: cameraAt(keys, time), inset: insetAt(time), steps: stepsAt(time), pace: paceAt(stepStart + 0.5 / FPS), text: textAt(frame), apart, step: frame === 0 ? 0 : 1 / FPS },
    );
    events.push(...told.events);
    states.push(told.state);
    if (preview) {
      if (frame % 150 === 0) console.log(`frame ${frame}/${frames} · ${JSON.stringify(told.state)}`);
      if (stillFrames.has(frame)) await page.screenshot({ type: "png", path: join(shots, `preview-${stillFrames.get(frame)}.png`) });
      continue;
    }
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === Math.round(POSTER_AT * FPS)) await page.screenshot({ type: "png", path: join(shots, "morse-telegraph-anatomy-poster.png") });
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
  const strike = events.find((event) => event.name === "stylus-strike" && event.at > CLOSE_AT + 4);
  const seated = events.find((event) => event.name === "apart-seated");
  const checks = [syncOf(keyDown, "key click"), syncOf(strike, "stylus tick"), syncOf(seated, "reassembly tap")];
  for (const check of checks) {
    const before = states[check.frame - 1];
    const now = states[check.frame];
    check.picture = `frame ${check.frame - 1}: closed ${before.closed}, marking ${before.marking}, open ${before.open} -> frame ${check.frame}: closed ${now.closed}, marking ${now.marking}, open ${now.open}`;
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

function writeFilms(silent, soundFile) {
  const out = join(shots, "morse-telegraph-anatomy.mp4");
  const web = join(shots, "morse-telegraph-anatomy-web.mp4");
  const audio = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "copy", ...audio, "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", ...audio, "-shortest", "-movflags", "+faststart", web], { stdio: "inherit" });
  for (const [name, second] of STILLS) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(shots, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,75))',scale=480:-1,tile=4x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  return { out, web };
}

async function record(browser) {
  const context = await browser.newContext({ viewport: FRAME, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => message.type() === "error" && problems.push(message.text()));
  page.on("pageerror", (error) => problems.push(String(error)));
  await page.goto(`${pathToFileURL(filmFile).href}?clock=manual`);
  const silent = join(shots, "film-silent.mp4");
  const encoder = preview ? null : encoderFor(silent);
  const { events, states, keys } = await film(page, encoder);
  await context.close();
  console.log(problems.length ? `console problems while filming:\n${problems.join("\n")}` : "no console problems while filming");
  const sent = states[states.length - 1];
  console.log(`sent in the film · ${sent.sent} · the tape reads ${sent.read} · ${sent.marks} marks`);
  console.log(`timeline · ${events.filter((event) => /^apart|^key-down|^stylus-release/.test(event.name)).map((event) => `${event.name} ${event.at}`).join(" · ")}`);
  if (preview) return;
  encoder.stdin.end();
  await new Promise((resolve) => encoder.on("exit", resolve));

  const eventsFile = join(shots, "film-events.json");
  writeFileSync(eventsFile, JSON.stringify(events));
  writeFileSync(join(shots, "film-frames.json"), JSON.stringify(states));
  const soundFile = join(shots, "film-sound.wav");
  const track = buildSoundtrack(eventsFile, soundFile, SECONDS);
  console.log(`sound · ${track.events} events · ${JSON.stringify(track.counts)}`);
  console.log(soundReport(track));
  const { out, web } = writeFilms(silent, soundFile);
  console.log(filmSoundReport(out));
  for (const check of syncChecks(events, states)) console.log(`sync · ${check.label} (${check.name}) sounds at ${check.at.toFixed(4)} s · first shown in frame ${check.frame} · picture trails by ${check.lateFrames} frame · ${check.picture}`);
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · slow letter ${JSON.stringify(SLOW)} · words ${JSON.stringify(WORDS)} · zoom frame born at ${INSET_BORN_AT} s · apart at ${APART_AT} s, closing at ${CLOSE_AT} s · camera ${JSON.stringify(keys)}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, ${STILLS.length} video frames and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await record(browser);
} finally {
  await browser.close();
}
