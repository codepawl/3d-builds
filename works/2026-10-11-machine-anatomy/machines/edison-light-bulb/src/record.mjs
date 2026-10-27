// Records shots/edison-light-bulb-anatomy.mp4 from the light film page (node build.mjs --film), frame by
// frame, on the page's own deterministic clock (?clock=manual): no screen recording. The figure reports
// what happens as timed events; sound.mjs renders the sound track from that log. Also checks that the
// shareable page is self-contained. Film order per ../_anatomy-series/film-spec-v2.md.
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
const NAME = "edison-light-bulb-anatomy";
const pageFile = join(HERE, `${NAME}.html`);
const filmFile = join(HERE, `${NAME}-film.html`);
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
const POSTER_AT = 15.7;
// 0-4.6 s: the lamp already works at normal speed, no zoom frame, no step labels (amendment 2026-10-12).
// Then one slow switch-on with the five numbered steps; the zoom frame is born as the current reaches the lamp.
const SLOW = { from: 4.6, to: 12, speed: 0.3 };
// 3. At normal speed: on and off, on again, dimmer, brighter, air let in, burnt out, a new filament.
// 4. The zoom frame fades, the lamp comes apart, holds and goes back together. 5. It ends lit.
const STORY = [
  [0.3, "setSwitch", true],
  [1.5, "setSwitch", false],
  [2.1, "setSwitch", true],
  [2.9, "setVolts", 55],
  [3.7, "setVolts", 115],
  [4.3, "setSwitch", false],
  [4.4, "setVolts", 100],
  [SLOW.from, "holdZoom", false],
  [SLOW.from, "setSwitch", true],
  [SLOW.to, "setSwitch", false],
  [12.8, "setSwitch", true],
  [14.2, "setSwitch", false],
  [14.9, "setSwitch", true],
  [16.7, "letAirIn"],
  [18.7, "mend"],
  [19.9, "setApart", true],
  [25, "setApart", false],
  [27.6, "setSwitch", true],
];
const STILLS = [["one", 1], ["lit", 3], ["birth", 5.9], ["slow", 6.4], ["lit-late", 15.7], ["burning", 17.3], ["burnt", 18.4], ["apart", 24.6], ["end", 29.8]];

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// The five numbered steps show during the slow switch-on only.
function stepsAt(time) {
  return smooth((time - (SLOW.from - 0.3)) / 0.3) * (1 - smooth((time - (SLOW.to + 0.1)) / 0.4));
}

function speedAt(time) {
  return time >= SLOW.from - 1e-9 && time < SLOW.to - 1e-9 ? SLOW.speed : 1;
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
    soundOn: document.querySelector("[data-sound]").getAttribute("aria-pressed"),
  }));
  await context.close();
  const others = requests.filter((url) => url !== pathToFileURL(pageFile).href);
  console.log(`self-contained check · ${(statSync(pageFile).size / 1024).toFixed(0)} KB · theme ${facts.theme} · requests ${requests.length} (other than the page itself: ${others.length}) · title "${facts.title}" · background ${facts.background} · sound button pressed: ${facts.soundOn}`);
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
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const stepStart = (frame - 1) / FPS;
    // An action falls in the step of the clock that starts at its time.
    const due = STORY.filter(([at]) => Math.round(at * FPS) === frame - 1).map(([, name, value]) => [name, value]);
    const told = await page.evaluate(
      ({ due, speed, steps, step, first }) => {
        const lamp = window.__lamp;
        if (first) lamp.holdZoom(true);
        lamp.setSpeed(speed);
        for (const [name, value] of due) lamp[name](value);
        if (step > 0) lamp.advance(step);
        lamp.steps(steps);
        return { state: lamp.state(), events: lamp.takeEvents() };
      },
      { due, speed: speedAt(stepStart + 0.5 / FPS), steps: stepsAt(time), step: frame === 0 ? 0 : 1 / FPS, first: frame === 0 },
    );
    events.push(...told.events);
    states.push(told.state);
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === Math.round(POSTER_AT * FPS)) await page.screenshot({ type: "png", path: join(shots, `${NAME}-poster.png`) });
    if (frame % 150 === 0) console.log(`frame ${frame}/${frames} · ${JSON.stringify(told.state)}`);
  }
  console.log(`last frame · ${JSON.stringify(states[states.length - 1])}`);
  return { events, states };
}

// For one event, the first frame whose picture can show it, and how far the picture trails the sound.
function syncOf(event, label, states) {
  const frame = Math.ceil(event.at * FPS - 1e-6);
  const late = frame - event.at * FPS;
  const before = states[Math.max(0, frame - 1)];
  const now = states[Math.min(states.length - 1, frame)];
  return `sync · ${label} (${event.name}) sounds at ${event.at.toFixed(4)} s · first shown in frame ${frame} · picture trails by ${Math.round(late * 100) / 100} frame · frame ${frame - 1}: closed ${before.closed}, broken ${before.broken}, open ${before.open} -> frame ${frame}: closed ${now.closed}, broken ${now.broken}, open ${now.open}`;
}

function timeline(events, states) {
  const at = (name, from = 0) => events.find((event) => event.name === name && event.at >= from)?.at;
  const firstFrame = (test) => states.findIndex(test) / FPS;
  const lines = [
    `zoom frame born at ${firstFrame((state) => state.zoomAge >= 0).toFixed(2)} s`,
    `slow switch-on closes at ${at("switch-on")?.toFixed(2)} s, 2,000 K passed at ${firstFrame((state) => state.kelvin >= 2000).toFixed(2)} s`,
    `switch events: ${events.filter((event) => event.name.startsWith("switch")).map((event) => `${event.name.slice(7)} ${event.at.toFixed(2)}`).join(", ")}`,
    `air in at ${at("air-in")?.toFixed(2)} s, burnt out at ${at("burn-out")?.toFixed(2)} s, new filament at ${at("mend")?.toFixed(2)} s`,
    `apart: first piece leaves at ${at("piece-leave")?.toFixed(2)} s, all apart at ${at("apart-hold")?.toFixed(2)} s, closing from ${at("apart-close")?.toFixed(2)} s, seated at ${at("apart-seated")?.toFixed(2)} s`,
    `zoom frame hidden from ${firstFrame((state) => state.zoomAge > 0 && state.zoomShown === 0).toFixed(2)} s; last frame ${JSON.stringify(states[states.length - 1])}`,
  ];
  return lines;
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
  const { events, states } = await film(page, encoder);
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

  const firstClick = events.find((event) => event.name === "switch-on" && event.at > SLOW.to);
  const burnOut = events.find((event) => event.name === "burn-out");
  const seated = events.find((event) => event.name === "apart-seated");
  if (firstClick) console.log(syncOf(firstClick, "switch click", states));
  if (burnOut) console.log(syncOf(burnOut, "filament tick", states));
  if (seated) console.log(syncOf(seated, "reassembly tap", states));
  const lines = timeline(events, states);
  for (const line of lines) console.log(`timeline · ${line}`);
  for (const [name, second] of STILLS) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(shots, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,75))',scale=480:-1,tile=4x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · slow switch-on ${JSON.stringify(SLOW)} · story ${JSON.stringify(STORY)}\n${lines.join("\n")}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, ${STILLS.length} video frames and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await checkSelfContained(browser);
  if (!process.argv.includes("--check")) await record(browser);
} finally {
  await browser.close();
}
