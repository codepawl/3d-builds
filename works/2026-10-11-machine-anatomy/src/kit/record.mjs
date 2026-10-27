// Records the film from the built film page, frame by frame, on the page's own deterministic clock
// (?clock=manual): no screen recording. The figure reports what happens as timed events; kit/sound.mjs
// renders the sound track from that log. The order of the film is the approved shape (kit/film.mjs) and
// the machine's story; the recording is checked against that shape. Adapted from the Edison recorder.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, lowerPriority, watchProblems } from "./browser.mjs";
import { baseName, pageFileName } from "./build.mjs";
import { filmShapeProblems, filmSpecOf, formatOf, formatSuffix, speedAt, stepsAt } from "./film.mjs";
import { loadMachine } from "./page.mjs";
import { compareCommand } from "./compare.mjs";
import { causalityProblems, functionProblems, timeShownProblems } from "./causality.mjs";
import { buildSoundtrack, measureLoudness, measureSpectrum } from "./sound.mjs";
import { collisionProblems, measureScene } from "./overlap.mjs";

export function variantOf(machine, { format = "16:9", style, theme }) {
  const chosenStyle = style ?? machine.style ?? "line";
  const chosenTheme = theme ?? machine.theme ?? "light";
  const themePart = chosenTheme === "light" ? "" : `-${chosenTheme}`;
  const stylePart = chosenStyle === "line" ? "" : `-${chosenStyle}`;
  const name = `${baseName(machine)}${stylePart}${themePart}${formatSuffix(format)}`;
  return { name, style: chosenStyle, theme: chosenTheme, format };
}

function encoderFor(file, fps) {
  const colour = ["-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-color_range", "tv", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", ...colour, "-movflags", "+faststart", file];
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
}

// Plays the story one frame at a time and returns what the figure reported: its events and its state per frame.
// Where things sit on screen, measured in the page every few frames: the rows of the legend, the visible
// badges, and the box of every assembly that has a badge (the subject). Pure DOM reads, no drawing.
function measureLayout() {
  const width = innerWidth;
  const height = innerHeight;
  const clip = (rect) => ({ left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(width, rect.right), bottom: Math.min(height, rect.bottom), area: Math.max(1, rect.width * rect.height) });
  const shown = (rect) => rect.right > rect.left && rect.bottom > rect.top;
  const pieces = window.__anatomy.pieces;
  const legendShown = Number(getComputedStyle(document.body).getPropertyValue("--ma-apart") || 0) > 0.05;
  const legend = legendShown ? Array.from(document.querySelectorAll(".ma-film-legend li")).map((row) => row.getBoundingClientRect()).map(clip) : [];
  const badges = Array.from(document.querySelectorAll("[data-badge]")).filter((badge) => Number(badge.style.opacity || 0) > 0.3).map((badge) => ({ name: `badge ${badge.textContent}`, ...clip(badge.getBoundingClientRect()) }));
  const parts = {};
  for (const node of document.querySelectorAll('[data-dyn="world"] > .ma-item')) {
    const piece = node.getAttribute("data-piece");
    if (!pieces[piece] || pieces[piece].badge === false) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width * rect.height < 1) continue;
    const box = parts[piece] ?? { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    parts[piece] = { left: Math.min(box.left, rect.left), top: Math.min(box.top, rect.top), right: Math.max(box.right, rect.right), bottom: Math.max(box.bottom, rect.bottom) };
  }
  const partBoxes = Object.entries(parts).map(([name, box]) => ({ name, whole: (box.right - box.left) * (box.bottom - box.top), ...clip({ ...box, width: box.right - box.left, height: box.bottom - box.top }) }));
  const visible = partBoxes.filter(shown);
  const overlaps = [];
  for (const row of legend) {
    for (const thing of badges.concat(visible)) {
      const across = Math.min(row.right, thing.right) - Math.max(row.left, thing.left);
      const down = Math.min(row.bottom, thing.bottom) - Math.max(row.top, thing.top);
      if (across > 1 && down > 1) overlaps.push(thing.name);
    }
  }
  const top = Math.min(...visible.map((box) => box.top));
  const bottom = Math.max(...visible.map((box) => box.bottom));
  const left = Math.min(...visible.map((box) => box.left));
  const right = Math.max(...visible.map((box) => box.right));
  const onScreen = {};
  for (const box of partBoxes) onScreen[box.name] = shown(box) ? ((box.right - box.left) * (box.bottom - box.top)) / Math.max(1, box.whole) : 0;
  return { overlaps: [...new Set(overlaps)], // A subject lying on its side fills the width instead: the larger share counts.
    subjectShare: visible.length ? Math.max((bottom - top) / height, (right - left) / width) : 0, onScreen };
}

// Layout rules the owner set after the first Falcon 9 cut (references/film.md): the legend never covers a
// part or a badge; the subject fills at least `minimum.subject` of the frame height; listed events
// (`film.onScreen`) happen with their parts at least 60% inside the frame.
export function layoutProblems(spec, events, states, onScreen = []) {
  const problems = [];
  const measured = states.map((state, frame) => ({ frame, layout: state.layout })).filter((entry) => entry.layout);
  const least = (spec.minimum.subject ?? 0.25);
  const small = measured.filter((entry) => entry.layout.subjectShare < least);
  if (small.length) problems.push(`the subject fills only ${Math.round(small[0].layout.subjectShare * 100)}% of the frame height or width at ${(small[0].frame / spec.fps).toFixed(2)} s, under ${Math.round(least * 100)}% (${small.length} measured frames)`);
  for (const [name, pieces] of onScreen) {
    const event = events.find((item) => item.name === name);
    if (!event) {
      problems.push(`the event ${name} never happens`);
      continue;
    }
    const after = measured.find((entry) => entry.frame / spec.fps >= event.at);
    const off = pieces.filter((piece) => !after || (after.layout.onScreen[piece] ?? 0) < 0.6);
    if (off.length) problems.push(`${name} at ${event.at.toFixed(2)} s happens with ${off.join(", ")} off screen`);
  }
  return problems;
}

async function film(page, encoder, spec, story, posterFile) {
  const events = [];
  const states = [];
  const frames = spec.fps * spec.seconds;
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / spec.fps;
    const stepStart = (frame - 1) / spec.fps;
    // An action falls in the step of the clock that starts at its time.
    const due = story.filter(([at]) => Math.round(at * spec.fps) === frame - 1).map(([, name, value]) => [name, value]);
    const told = await page.evaluate(
      ({ due, speed, steps, step, first }) => {
        const figure = window.__anatomy;
        if (first) figure.act("holdZoom", true);
        figure.act("setSpeed", speed);
        for (const [name, value] of due) figure.act(name, value);
        if (step > 0) figure.advance(step);
        figure.act("steps", steps);
        return { state: figure.state(), events: figure.takeEvents() };
      },
      { due, speed: speedAt(spec, stepStart + 0.5 / spec.fps), steps: stepsAt(spec, time), step: frame === 0 ? 0 : 1 / spec.fps, first: frame === 0 },
    );
    events.push(...told.events);
    if (frame % 5 === 0) told.state.layout = await page.evaluate(measureLayout);
    // Every half second, and at every apart frame sampled, the collision check (kit/overlap.mjs).
    if (frame % 15 === 0) told.state.collisions = await page.evaluate(measureScene, { pieces: told.state.open > 0.99 && told.state.resting });
    states.push(told.state);
    const image = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!encoder.stdin.write(image)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
    if (frame === Math.round(spec.posterAt * spec.fps)) await page.screenshot({ type: "png", path: posterFile });
    if (frame % 150 === 0) console.log(`frame ${frame}/${frames} · ${told.state.readout}`);
  }
  return { events, states };
}

// For one event, the first frame whose picture can show it, and how far the picture trails the sound.
function syncOf(event, label, fps) {
  const frame = Math.ceil(event.at * fps - 1e-6);
  const late = frame - event.at * fps;
  return `sync · ${label} (${event.name}) sounds at ${event.at.toFixed(4)} s · first shown in frame ${frame} · picture trails by ${Math.round(late * 100) / 100} frame`;
}

function timeline(spec, events, states) {
  const at = (name, from = 0) => events.find((event) => event.name === name && event.at >= from)?.at;
  const firstFrame = (test) => states.findIndex(test) / spec.fps;
  return [
    `zoom frame born at ${firstFrame((state) => state.zoomAge >= 0).toFixed(2)} s`,
    `slow run ${spec.slow.from} to ${spec.slow.to} s at ${spec.slow.speed}x`,
    `apart: first piece leaves at ${at("piece-leave")?.toFixed(2)} s, all apart at ${at("apart-hold")?.toFixed(2)} s, closing from ${at("apart-close")?.toFixed(2)} s, seated at ${at("apart-seated")?.toFixed(2)} s`,
    `zoom frame hidden from ${firstFrame((state) => state.zoomAge > 0 && state.zoomShown === 0).toFixed(2)} s`,
    `events: ${Object.entries(countsOf(events)).map(([name, count]) => `${name} ${count}`).join(", ")}`,
  ];
}

function countsOf(events) {
  const counts = {};
  for (const event of events) counts[event.name] = (counts[event.name] ?? 0) + 1;
  return counts;
}

export function soundLine(label, file) {
  const loudness = measureLoudness(file);
  const spectrum = measureSpectrum(file);
  return `${label} · integrated ${loudness.integrated} LUFS · true peak ${loudness.truePeak} dBFS · below 120 Hz ${spectrum.below120}% · 120 Hz to 3.5 kHz ${spectrum.from120to3500}% · above 3.5 kHz ${spectrum.above3500}%`;
}

export function muxFilms(folder, variant, soundFile) {
  const silent = join(folder, "film-silent.mp4");
  const out = join(folder, `${variant.name}.mp4`);
  const web = join(folder, `${variant.name}-web.mp4`);
  const audio = soundFile ? ["-i", soundFile] : [];
  const audioCodec = soundFile ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest"] : ["-an"];
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, ...audio, "-c:v", "copy", ...audioCodec, "-movflags", "+faststart", out], { stdio: "inherit" });
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, ...audio, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", ...audioCodec, "-movflags", "+faststart", web], { stdio: "inherit" });
  return { out, web };
}

function stillsAndSheet(folder, out, stills, fps) {
  for (const [name, second] of stills) {
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(second), "-i", out, "-frames:v", "1", join(folder, `video-frame-${name}.png`)], { stdio: "inherit" });
  }
  const every = Math.round(fps * 2.5);
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-vf", `select='not(mod(n\\,${every}))',scale=480:-1,tile=4x3`, "-frames:v", "1", join(folder, "video-sheet.png")], { stdio: "inherit" });
}

async function recordVariant(browser, loaded, variant) {
  const { machine, dir } = loaded;
  const spec = filmSpecOf(machine.film);
  const frame = formatOf(variant.format);
  const folder = join(dir, "shots", variant.name);
  mkdirSync(folder, { recursive: true });
  const context = await browser.newContext({ viewport: { width: frame.width, height: frame.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  watchProblems(page, problems);
  const filmUrl = pathToFileURL(join(dir, pageFileName(machine, { film: true, format: variant.format }))).href;
  await page.goto(`${filmUrl}?clock=manual&style=${variant.style}&theme=${variant.theme}`);
  const encoder = encoderFor(join(folder, "film-silent.mp4"), spec.fps);
  const story = machine.film.story(spec);
  const { events, states } = await film(page, encoder, spec, story, join(folder, `${variant.name}-poster.png`));
  encoder.stdin.end();
  await new Promise((resolve) => encoder.on("exit", resolve));
  await context.close();
  console.log(problems.length ? `console problems while filming:\n${problems.join("\n")}` : "no console problems while filming");
  writeFileSync(join(folder, "film-events.json"), JSON.stringify(events));
  writeFileSync(join(folder, "film-frames.json"), JSON.stringify(states));
  return { spec, folder, events, states, problems };
}

export async function recordCommand(dir, { format = "16:9", style, theme, sound = true, checkOnly = false } = {}) {
  lowerPriority();
  const loaded = await loadMachine(dir);
  const variant = variantOf(loaded.machine, { format, style, theme });
  if (checkOnly) return 0;
  const browser = await launchBrowser();
  let recorded;
  try {
    recorded = await recordVariant(browser, loaded, variant);
  } finally {
    await browser.close();
  }
  const { spec, folder, events, states } = recorded;
  let soundFile = null;
  if (sound && loaded.machine.sound !== false) {
    soundFile = join(folder, "film-sound.wav");
    const track = buildSoundtrack(join(folder, "film-events.json"), soundFile, spec.seconds, loaded.machine.sound);
    console.log(`sound track (wav) · ${track.events} events · one linear gain of ${track.gainDb.toFixed(1)} dB, no limiter · integrated ${track.integrated} LUFS · true peak ${track.truePeak} dBFS · samples at full scale ${track.clipped}`);
  }
  const { out, web } = muxFilms(folder, variant, soundFile);
  if (soundFile) console.log(soundLine("film sound (from the mp4)", out));
  for (const [label, name, from] of loaded.machine.film.sync ?? []) {
    const event = events.find((item) => item.name === name && item.at >= from);
    if (event) console.log(syncOf(event, label, spec.fps));
  }
  const lines = timeline(spec, events, states);
  for (const line of lines) console.log(`timeline · ${line}`);
  const collisionSamples = states.map((state, frame) => ({ at: frame / spec.fps, collisions: state.collisions })).filter((sample) => sample.collisions);
  const shape = filmShapeProblems(spec, events, states).concat(layoutProblems(spec, events, states, loaded.machine.film.onScreen ?? []), collisionProblems(collisionSamples, loaded.machine.film.overlapAllowed ?? []), functionProblems(loaded.machine.functions, states, spec.fps), causalityProblems(loaded.machine.film.bodies, states), timeShownProblems(loaded.machine.film, states));
  for (const problem of shape) console.log(`FAIL film shape: ${problem}`);
  stillsAndSheet(folder, out, loaded.machine.film.stills ?? [], spec.fps);
  writeFileSync(join(folder, "video-notes.txt"), `${variant.name} · ${spec.fps * spec.seconds} frames at ${spec.fps} fps · ${JSON.stringify(spec.slow)} · ${JSON.stringify(spec.apart)}\n${lines.join("\n")}\n${shape.length ? shape.join("\n") : "film shape ok"}\n`);
  copyFileSync(web, join(dir, "shots", `${variant.name}-web.mp4`));
  console.log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB), ${web} (${(statSync(web).size / 1e6).toFixed(1)} MB), poster, stills and video-sheet.png in ${folder}`);
  await compareCommand(dir, { variant: variant.name });
  console.log(shape.length ? `film shape failed: ${shape.length} problems` : "film shape matches the approved order");
  return shape.length || recorded.problems.length ? 1 : 0;
}
