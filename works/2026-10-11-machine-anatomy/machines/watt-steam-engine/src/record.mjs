// Records shots/watt-steam-engine-anatomy.mp4 from the light film page (node build.mjs --film), frame by
// frame, on the page's own deterministic clock (?clock=manual): no screen recording. The figure reports
// what happens as timed events; sound.mjs renders the sound track from that log.
// Same recipe as ../enigma-anatomy/record.mjs.
//   node record.mjs
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
const NAME = "watt-steam-engine-anatomy";
const filmFile = join(HERE, `${NAME}-film.html`);
const shots = join(HERE, "shots");
mkdirSync(shots, { recursive: true });

const FPS = 30;
const SECONDS = 30;
const FRAME = { width: 1920, height: 1080 };
// The order of the film (film-spec-v2): the whole engine standing, centred, with no zoom frame; one slow
// stroke with its six steps named, the zoom frame being born as the steam reaches the cylinder; the
// engine at its own pace for about ten strokes, the load changed twice so the governor is seen to
// answer; only then the take-apart; and the engine assembled and running again at the end.
// Amendment 2026-10-12: the engine runs at its own pace from the first frame, with no zoom frame and no
// labels, until the first stroke boundary after OPENING; there the zoom frame is born and the slow
// labelled stroke begins (BEGIN.at is set by the recorder when it sees that boundary).
const OPENING = 4.7;
const BEGIN = { at: null, strokes: 0 };
const APART_AT = 17;
const CLOSE_AT = 22.8;
const POSTER_AT = 21.8;
// The slow stroke runs at this share of the engine's real pace until the piston reaches the bottom.
const SLOW = { scale: 0.19, easeBack: 0.5 };
// More load: the engine slows, the balls drop and the throttle opens. Then much less: it speeds up, the
// balls fly out and the governor trims the throttle. Half load again for the end.
// The two changes follow the end of the slow stroke (seconds after it); the last is fixed.
const LOAD_OFFSETS = [
  { after: 1.0, load: 0.9 },
  { after: 3.6, load: 0.15 },
];
// The zoom frame is born at `at` (the page's own timing, live.js BIRTH) and fades before the take-apart.
const INSET = { room: 1, goneFrom: APART_AT - 0.8, goneIn: 0.6 };
// The engine sits a little above the middle, since the steps and the trace run along the bottom. It
// moves right by ROOM_SHIFT, no more than the zoom frame on the left needs.
const ROOM_SHIFT = 225;
const WIDE_LIFT = 52;
const BASE_WEIGHT = 1.6;

function smooth(share) {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
}

// Camera keyframes: time, then the point of the drawing held at the centre of the frame, and the zoom.
function cameraKeys(view, at) {
  const centred = { x: view.width / 2, y: view.height / 2 + WIDE_LIFT, zoom: 1 };
  const aside = { x: centred.x - ROOM_SHIFT, y: centred.y, zoom: 1 };
  const apartZoom = Math.min((FRAME.width - 150) / view.apart.width, (FRAME.height - 290) / view.apart.height);
  const apart = { x: view.apart.x, y: view.apart.y + 76 / apartZoom, zoom: apartZoom };
  return [
    [0, centred],
    [at, centred],
    [at + INSET.room, aside],
    [APART_AT, aside],
    [APART_AT + 1.9, apart],
    [CLOSE_AT + 0.8, apart],
    [CLOSE_AT + 4.2, centred],
    [SECONDS, centred],
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

// The zoom frame: its age since the birth began (null before it) and how much of it still shows. It
// fades away before the engine comes apart and does not come back.
function insetAt(time) {
  const age = BEGIN.at !== null && time >= BEGIN.at ? time - BEGIN.at : null;
  return { age, fade: 1 - smooth((time - INSET.goneFrom) / INSET.goneIn) };
}

// How fast the engine's clock runs in the step that starts at `time`. `slowEnded` is the film time at
// which the slow stroke was seen to finish, or null while it is still running.
function scaleAt(time, slowEnded) {
  if (BEGIN.at === null || time < BEGIN.at) return 1;
  if (slowEnded === null) return SLOW.scale;
  return SLOW.scale + (1 - SLOW.scale) * smooth((time - slowEnded) / SLOW.easeBack);
}

// The six numbered steps show during the slow stroke only.
function stepsAt(time, slowEnded) {
  if (BEGIN.at === null) return 0;
  const fadeIn = smooth((time - (BEGIN.at - 0.2)) / 0.3);
  return slowEnded === null ? fadeIn : fadeIn * (1 - smooth((time - slowEnded - 0.1) / 0.4));
}

function loadsFor(slowEnded) {
  const changes = slowEnded === null ? [] : LOAD_OFFSETS.map((offset) => ({ at: slowEnded + offset.after, load: offset.load }));
  return [...changes, { at: CLOSE_AT, load: 0.5 }];
}

function loadAt(time, slowEnded) {
  let load = 0.5;
  for (const change of loadsFor(slowEnded)) {
    if (time >= change.at) load = change.load;
  }
  return load;
}

function encoderFor(file) {
  const colour = ["-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", ...colour, "-movflags", "+faststart", file];
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
}

// Plays the storyboard one frame at a time and returns what the figure reported: its events and its state per frame.
async function film(page, encoder) {
  const view = await page.evaluate(() => window.__watt.view());
  const events = [];
  const states = [];
  const frames = FPS * SECONDS;
  let slowEnded = null;
  let keys = cameraKeys(view, 1e9);
  let lastStrokes = 0;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / FPS;
    const stepStart = (frame - 1) / FPS;
    let apart = null;
    if (frame === Math.round(APART_AT * FPS) + 1) apart = true;
    if (frame === Math.round(CLOSE_AT * FPS) + 1) apart = false;
    const told = await page.evaluate(
      ({ camera, inset, steps, scale, load, apart, step }) => {
        const watt = window.__watt;
        if (apart !== null) watt.setApart(apart);
        watt.setScale(scale);
        watt.setLoad(load);
        if (step > 0) watt.advance(step);
        watt.inset(inset.age, inset.fade);
        watt.steps(steps);
        watt.camera(camera.x, camera.y, camera.zoom, camera.weight);
        return { state: watt.state(), events: watt.takeEvents() };
      },
      { camera: cameraAt(keys, time), inset: insetAt(time), steps: stepsAt(time, slowEnded), scale: scaleAt(stepStart, slowEnded), load: loadAt(stepStart, slowEnded), apart, step: frame === 0 ? 0 : 1 / FPS },
    );
    if (BEGIN.at === null && time >= OPENING && told.state.strokes > lastStrokes) {
      BEGIN.at = time;
      BEGIN.strokes = told.state.strokes;
      keys = cameraKeys(view, time);
    }
    lastStrokes = told.state.strokes;
    if (BEGIN.at !== null && slowEnded === null && time > BEGIN.at && told.state.strokes > BEGIN.strokes) slowEnded = time;
    events.push(...told.events);
    states.push(told.state);
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === Math.round(POSTER_AT * FPS)) await page.screenshot({ type: "png", path: join(shots, `${NAME}-poster.png`) });
    if (frame % 150 === 0) console.log(`frame ${frame}/${frames} · strokes ${told.state.strokes} · speed ${told.state.speed} · throttle ${told.state.throttle} · open ${told.state.open}`);
  }
  const last = states[states.length - 1];
  console.log(`zoom frame born at ${BEGIN.at} s · slow stroke ended at ${slowEnded} s · last frame: strokes ${last.strokes}, speed ${last.speed}, throttle ${last.throttle}, balls ${last.ballDegrees} degrees, readout "${last.readout}"`);
  return { events, states, keys, slowEnded };
}

// For one event, the first frame whose picture can show it, and how far the picture trails the sound.
function syncOf(event, label) {
  const frame = Math.ceil(event.at * FPS - 1e-6);
  const late = frame - event.at * FPS;
  return { label, name: event.name, at: event.at, frame, lateFrames: Math.round(late * 100) / 100 };
}

function syncChecks(events, states) {
  const valve = events.find((event) => event.name === "valve" && event.at > CLOSE_AT + 4.5);
  const seated = events.find((event) => event.name === "apart-seated");
  const checks = [syncOf(valve, "valve tick"), syncOf(seated, "reassembly tap")];
  for (const check of checks) {
    const before = states[check.frame - 1];
    const now = states[check.frame];
    check.picture = `frame ${check.frame - 1}: strokes ${before.strokes}, open ${before.open} -> frame ${check.frame}: strokes ${now.strokes}, open ${now.open}`;
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
  const { events, states, keys, slowEnded } = await film(page, encoder);
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
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", soundFile, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", ...audio, "-shortest", "-movflags", "+faststart", web], { stdio: "inherit" });
  console.log(filmSoundReport(out));

  for (const check of syncChecks(events, states)) console.log(`sync · ${check.label} (${check.name}) sounds at ${check.at.toFixed(4)} s · first shown in frame ${check.frame} · picture trails by ${check.lateFrames} frame · ${check.picture}`);
  for (const [name, second] of [["opening", 1], ["running", 3], ["birth", BEGIN.at + 0.7], ["slow", BEGIN.at + 3], ["trimmed", 15.4], ["apart", 21.8], ["end", 29]]) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(shots, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,75))',scale=480:-1,tile=4x3`, "-frames:v", "1", join(shots, "video-sheet.png")], { stdio: "inherit" });
  writeFileSync(join(shots, "video-notes.txt"), `frames ${FPS * SECONDS} at ${FPS} fps · slow stroke ${JSON.stringify(SLOW)}, ended at ${slowEnded} s · zoom frame ${JSON.stringify(INSET)} · loads ${JSON.stringify(loadsFor(slowEnded))}, begin ${BEGIN.at} s · apart at ${APART_AT} s, closing at ${CLOSE_AT} s · camera ${JSON.stringify(keys)}\n`);
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, seven video frames and video-sheet.png`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text"] });
try {
  await record(browser);
} finally {
  await browser.close();
}
