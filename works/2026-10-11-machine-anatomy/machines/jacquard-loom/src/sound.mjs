// Renders the film's sound track offline from the event log the recorder takes from the figure's own
// clock: every sound is synthesised here (no samples), then mastered with ffmpeg to -14 LUFS.
//   node sound.mjs shots/film-events.json shots/film-sound.wav 30
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RATE = 48000;
const TARGET_LUFS = -14;
const LIMIT = 0.72;
const DRIVE = 2.2;

function randomOf(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function createTrack(seconds) {
  const length = Math.ceil(seconds * RATE);
  return { length, left: new Float32Array(length), right: new Float32Array(length) };
}

// `pan` runs from -1 (left) to 1 (right) with equal power.
function addSample(track, index, value, pan) {
  if (index < 0 || index >= track.length) return;
  const angle = ((pan + 1) * Math.PI) / 4;
  track.left[index] += value * Math.cos(angle);
  track.right[index] += value * Math.sin(angle);
}

// A struck tone that rings and dies away: wood at a few hundred hertz, iron and wire higher up.
function strike(track, at, frequency, decay, level, pan = 0) {
  const start = Math.round(at * RATE);
  const count = Math.round(decay * 7 * RATE);
  for (let index = 0; index < count; index++) {
    const time = index / RATE;
    const attack = Math.min(1, time / 0.0015);
    addSample(track, start + index, Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time / decay) * attack * level, pan);
  }
}

const swell = (share) => Math.sin(Math.PI * share) ** 1.5;
const rising = (share) => share ** 1.4 * (1 - Math.max(0, (share - 0.82) / 0.18) ** 2);
const knock = (share) => (1 - share) ** 2;

// Noise through a band-pass whose centre slides from one pitch to another: air, whooshes and wood grain.
function breath(track, random, at, duration, from, to, sharpness, level, shape = swell, panFrom = 0, panTo = panFrom) {
  const start = Math.round(at * RATE);
  const count = Math.round(duration * RATE);
  let low = 0;
  let band = 0;
  for (let index = 0; index < count; index++) {
    const share = index / count;
    const centre = from * (to / from) ** share;
    const tuning = 2 * Math.sin((Math.PI * centre) / RATE);
    const high = random() * 2 - 1 - low - band / sharpness;
    band += tuning * high;
    low += tuning * band;
    addSample(track, start + index, band * shape(share) * level, panFrom + (panTo - panFrom) * share);
  }
}

// Stick-slip: a run of tiny wooden ticks that quickens, which the ear hears as a creak.
function creak(track, random, at, duration, rateFrom, rateTo, resonance, level, pan) {
  let time = 0;
  while (time < duration) {
    const share = time / duration;
    const rate = rateFrom + (rateTo - rateFrom) * share;
    const loudness = level * Math.sin(Math.PI * share) ** 0.8 * (0.6 + random() * 0.4);
    strike(track, at + time, resonance * (1 + share * 0.25) * (0.94 + random() * 0.12), 0.004, loudness, pan);
    strike(track, at + time, resonance * 1.7 * (0.95 + random() * 0.1), 0.003, loudness * 0.4, pan);
    time += (0.85 + random() * 0.3) / rate;
  }
}

function click(track, random, at, number, level) {
  const metal = number % 2 === 0;
  const pan = (number - 5.5) / 9;
  strike(track, at, metal ? 2300 + number * 130 : 520 + number * 45, metal ? 0.012 : 0.02, level, pan);
  strike(track, at, metal ? 3900 + number * 90 : 900 + number * 60, 0.006, level * 0.5, pan);
  breath(track, random, at, 0.02, 2400, 1500, 2.5, level * 0.8, knock, pan);
}

const VOICES = {
  "card-seat": (track, random, event) => {
    breath(track, random, event.at, 0.035, 2300, 1500, 2, 0.5, knock, -0.25);
    strike(track, event.at, 430, 0.018, 0.42, -0.25);
    strike(track, event.at, 760, 0.012, 0.26, -0.25);
    strike(track, event.at + 0.004, 1180, 0.008, 0.12, -0.25);
  },
  "needle-ticks": (track, random, event) => {
    event.lanes.forEach((lane, index) => {
      const pan = (lane - 3.5) / 8;
      strike(track, event.at + index * 0.014, 3100 + lane * 240, 0.006, 0.12, pan);
      strike(track, event.at + index * 0.014, 5200 + lane * 310, 0.004, 0.07, pan);
    });
  },
  treadle: (track, random, event) => creak(track, random, event.at, event.duration, 26, 50, 420, 0.13, 0.3),
  "griffe-lift": (track, random, event) => {
    strike(track, event.at, 96, 0.05, 0.62, -0.1);
    strike(track, event.at, 162, 0.03, 0.32, -0.1);
    strike(track, event.at, 1900, 0.01, 0.07, -0.1);
    creak(track, random, event.at + 0.05, event.duration * 0.8, 55, 120, 950, 0.13, -0.1);
  },
  "griffe-drop": (track, random, event) => {
    strike(track, event.at, 88, 0.045, 0.34, -0.1);
    strike(track, event.at, 150, 0.028, 0.16, -0.1);
    breath(track, random, event.at, 0.03, 900, 600, 1.5, 0.1, knock, -0.1);
  },
  shuttle: (track, random, event) => breath(track, random, event.at, event.duration, 650, 2300, 1.3, 0.3, swell, -0.6 * event.direction, 0.6 * event.direction),
  "shuttle-knock": (track, random, event) => {
    strike(track, event.at, 310, 0.02, 0.44, 0.2);
    strike(track, event.at, 540, 0.013, 0.25, 0.2);
    breath(track, random, event.at, 0.015, 2600, 2000, 2, 0.2, knock, 0.2);
  },
  "reed-beat": (track, random, event) => {
    strike(track, event.at, 72, 0.06, 0.78, 0.15);
    strike(track, event.at, 124, 0.04, 0.42, 0.15);
    breath(track, random, event.at, 0.05, 700, 350, 1, 0.3, knock, 0.15);
  },
  "apart-open": (track, random, event) => breath(track, random, event.at, event.duration, 320, 2800, 1.4, 0.26, rising, -0.3, 0.3),
  "apart-close": (track, random, event) => breath(track, random, event.at, event.duration, 2600, 340, 1.4, 0.22, swell, 0.3, -0.3),
  "piece-leave": (track, random, event) => click(track, random, event.at, event.number, 0.24),
  "piece-land": (track, random, event) => click(track, random, event.at, event.number, 0.3),
  "apart-seated": (track, random, event) => {
    strike(track, event.at, 84, 0.07, 0.78);
    strike(track, event.at, 140, 0.045, 0.42);
    strike(track, event.at, 430, 0.018, 0.3);
    breath(track, random, event.at, 0.04, 1900, 1300, 2, 0.35, knock);
  },
};

// A quiet fifth while the loom hangs apart, from the moment the last assembly arrives to the first one leaving.
function holdTone(track, from, to) {
  const start = Math.round(from * RATE);
  const count = Math.round((to - from + 0.4) * RATE);
  for (let index = 0; index < count; index++) {
    const time = index / RATE;
    const fadeIn = Math.min(1, time / 0.5);
    const fadeOut = Math.min(1, Math.max(0, (to - from + 0.4 - time) / 0.4));
    const tone = Math.sin(2 * Math.PI * 196 * time) + 0.7 * Math.sin(2 * Math.PI * 294 * time) + 0.3 * Math.sin(2 * Math.PI * 392.4 * time);
    addSample(track, start + index, tone * 0.012 * fadeIn * fadeOut, 0);
  }
}

// Workshop room tone: low, slowly breathing noise, so a silence is never digital black.
function roomTone(track, random) {
  let leftState = 0;
  let rightState = 0;
  for (let index = 0; index < track.length; index++) {
    const drift = 1 + 0.25 * Math.sin((2 * Math.PI * 0.11 * index) / RATE);
    leftState = leftState * 0.985 + (random() * 2 - 1) * 0.015;
    rightState = rightState * 0.985 + (random() * 2 - 1) * 0.015;
    track.left[index] += leftState * 0.07 * drift;
    track.right[index] += rightState * 0.07 * drift;
  }
}

function renderTrack(events, seconds) {
  const track = createTrack(seconds);
  const random = randomOf(1804);
  roomTone(track, random);
  let holdFrom = null;
  for (const event of events) {
    if (event.name === "apart-hold") holdFrom = event.at;
    if (event.name === "apart-close" && holdFrom !== null) {
      holdTone(track, holdFrom, event.at);
      holdFrom = null;
    }
    const voice = VOICES[event.name];
    if (voice) voice(track, random, event);
  }
  return track;
}

function writeWav(file, track) {
  let peak = 0;
  for (let index = 0; index < track.length; index++) peak = Math.max(peak, Math.abs(track.left[index]), Math.abs(track.right[index]));
  const scale = 1 / Math.max(peak, 1e-9);
  const rounded = (value) => (Math.tanh(value * scale * DRIVE) / Math.tanh(DRIVE)) * 0.7;
  const data = Buffer.alloc(track.length * 4);
  for (let index = 0; index < track.length; index++) {
    data.writeInt16LE(Math.round(rounded(track.left[index]) * 32767), index * 4);
    data.writeInt16LE(Math.round(rounded(track.right[index]) * 32767), index * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

// Integrated loudness and true peak of any file ffmpeg can read, from the EBU R128 meter.
export function measureLoudness(file) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const summary = run.stderr.slice(run.stderr.lastIndexOf("Summary:"));
  return {
    integrated: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)[1]),
    range: Number(/LRA:\s+(-?[\d.]+) LU/.exec(summary)[1]),
    truePeak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)[1]),
  };
}

// Gain into a limiter, repeated until the meter reads the target: the limiter holds the true peak under -1 dBFS.
function master(rawFile, outFile) {
  let gain = 0;
  let reading = null;
  for (let pass = 0; pass < 8; pass++) {
    const filter = `volume=${gain.toFixed(2)}dB,alimiter=limit=${LIMIT}:level=false:attack=2:release=60`;
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", rawFile, "-af", filter, "-ar", String(RATE), "-c:a", "pcm_s16le", outFile], { stdio: "inherit" });
    reading = measureLoudness(outFile);
    if (Math.abs(reading.integrated - TARGET_LUFS) < 0.15) break;
    gain += TARGET_LUFS - reading.integrated;
  }
  return { gain, ...reading };
}

export function buildSoundtrack(eventsFile, outFile, seconds) {
  const events = JSON.parse(readFileSync(eventsFile, "utf8"));
  const rawFile = outFile.replace(/\.wav$/, "-raw.wav");
  writeWav(rawFile, renderTrack(events, seconds));
  const mastered = master(rawFile, outFile);
  const counts = {};
  for (const event of events) counts[event.name] = (counts[event.name] ?? 0) + 1;
  const ticks = events.filter((event) => event.name === "needle-ticks").reduce((sum, event) => sum + event.lanes.length, 0);
  return { counts, ticks, events: events.length, ...mastered };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [eventsFile, outFile, seconds] = process.argv.slice(2);
  console.log(JSON.stringify(buildSoundtrack(eventsFile, outFile, Number(seconds ?? 30)), null, 1));
}
