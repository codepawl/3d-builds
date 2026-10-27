// Renders the film's sound track offline from the event log the recorder takes from the figure's own
// clock. The aim is a close, quiet recording of a well-oiled machine: every sound is a short, soft tap.
// A tap is a few milliseconds of noise that fades in (never an instant onset), heard through two heavily
// damped resonances that are dead within about 35 ms. Nothing is continuous: between events the track is
// silent. There is no limiter, no saturation and no clipping; the whole mix is scaled by one linear gain.
//   node sound.mjs shots/film-events.json shots/film-sound.wav 30
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RATE = 48000;
const TARGET_LUFS = -23;
const PEAK_CEILING_DB = -3;
const HIGH_PASS = 110;
const LOW_PASS = 3500;
const PITCH_SPREAD = 0.07;
const LEVEL_SPREAD_DB = 2;
const LATE_SPREAD = 0.004;
const TAP_LENGTH = 0.07;
const decibels = (value) => 10 ** (value / 20);

// What is tapped. `modes` are two resonances as [frequency in Hz, ring time in seconds, share];
// `attack` is the fade-in of the blow and `blow` how fast its noise dies away.
const BODIES = {
  key: { modes: [[210, 0.006, 1], [430, 0.004, 0.45]], attack: 0.005, blow: 0.006 },
  release: { modes: [[290, 0.005, 1], [560, 0.0035, 0.4]], attack: 0.004, blow: 0.005 },
  tik: { modes: [[820, 0.0035, 1], [1450, 0.0025, 0.5]], attack: 0.003, blow: 0.003 },
  tk: { modes: [[1100, 0.003, 1], [1900, 0.002, 0.4]], attack: 0.003, blow: 0.0025 },
  wood: { modes: [[260, 0.007, 1], [520, 0.005, 0.4]], attack: 0.005, blow: 0.006 },
  reseat: { modes: [[170, 0.009, 1], [340, 0.006, 0.5]], attack: 0.006, blow: 0.008 },
};

// How loud each kind of tap peaks, against the key going down.
const LEVELS = { key: decibels(0), step: decibels(-4), stepSecond: decibels(-10), part: decibels(-6), reseat: decibels(-3), release: decibels(-10) };
const STEP_SECOND_AFTER = 0.028;

// A very short, quiet, diffuse tail instead of distinct reflections.
const TAIL = { seconds: 0.12, from: 0.006, taps: 48, levelDb: -18 };

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

// `pan` runs from -1 (left) to 1 (right) with equal power; the taps stay near the middle.
function addSample(track, index, value, pan) {
  if (index < 0 || index >= track.length) return;
  const angle = ((Math.min(1, Math.max(-1, pan * 0.5)) + 1) * Math.PI) / 4;
  track.left[index] += value * Math.cos(angle);
  track.right[index] += value * Math.sin(angle);
}

// No two taps are the same: a few per cent of pitch, a couple of decibels, a few milliseconds.
function variationOf(random) {
  const spread = () => random() * 2 - 1;
  return { pitch: 1 + spread() * PITCH_SPREAD, level: decibels(spread() * LEVEL_SPREAD_DB), late: random() * LATE_SPREAD };
}

function resonanceOf(frequency, ringTime) {
  const radius = Math.exp(-1 / (ringTime * RATE));
  const turn = (2 * Math.PI * frequency) / RATE;
  return { feedback: 2 * radius * Math.cos(turn), damping: radius * radius, drive: Math.sin(turn), last: 0, before: 0 };
}

function ring(resonance, input) {
  const value = resonance.feedback * resonance.last - resonance.damping * resonance.before + resonance.drive * input;
  resonance.before = resonance.last;
  resonance.last = value;
  return value;
}

// The blow: noise that fades in along a raised cosine and then dies away.
function blowLevel(time, body) {
  const fadeIn = time < body.attack ? 0.5 - 0.5 * Math.cos((Math.PI * time) / body.attack) : 1;
  return fadeIn * Math.exp(-Math.max(0, time - body.attack) / body.blow);
}

// One tap, rendered on its own and brought to an exact peak, so the levels above are what is heard.
function tap(track, random, at, body, level, pan) {
  const variation = variationOf(random);
  const count = Math.round(TAP_LENGTH * RATE);
  const samples = new Float32Array(count);
  const resonances = body.modes.map(([frequency, ringTime]) => resonanceOf(frequency * variation.pitch, ringTime));
  let peak = 0;
  for (let index = 0; index < count; index++) {
    const blow = (random() * 2 - 1) * blowLevel(index / RATE, body);
    let sample = 0;
    for (let mode = 0; mode < resonances.length; mode++) sample += ring(resonances[mode], blow) * body.modes[mode][2];
    // The last few milliseconds fade to nothing, so no tap ends on a step.
    samples[index] = sample * Math.min(1, (count - index) / (0.01 * RATE));
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const start = Math.round((at + variation.late) * RATE);
  const scale = (level * variation.level) / Math.max(peak, 1e-9);
  for (let index = 0; index < count; index++) addSample(track, start + index, samples[index] * scale, pan);
}

const VOICES = {
  // A soft, felted "tok" as the key reaches its stop.
  "key-down": (track, random, event) => tap(track, random, event.at, BODIES.key, LEVELS.key, event.pan),
  // Each rotor that steps: a small dry "tik-tk", the ratchet and then its pawl.
  "rotor-step": (track, random, event) => {
    for (let rotor = 0; rotor < event.count; rotor++) {
      const at = event.at + rotor * 0.045;
      tap(track, random, at, BODIES.tik, LEVELS.step, -0.2);
      tap(track, random, at + STEP_SECOND_AFTER, BODIES.tk, LEVELS.stepSecond, -0.2);
    }
  },
  // A fainter, lighter tap as the key comes back up. The lamp is silent.
  "key-up": (track, random, event) => tap(track, random, event.at, BODIES.release, LEVELS.release, event.pan),
  // Parts leaving and landing: gentle wooden taps; the last reseat is only slightly heavier.
  "piece-leave": (track, random, event) => tap(track, random, event.at, BODIES.wood, LEVELS.part * decibels(-3), (event.number - 6) / 9),
  "piece-land": (track, random, event) => tap(track, random, event.at, BODIES.wood, LEVELS.part, (event.number - 6) / 9),
  "apart-seated": (track, random, event) => tap(track, random, event.at, BODIES.reseat, LEVELS.reseat, 0),
};

function onePole(samples, cutoff) {
  const share = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  const out = new Float32Array(samples.length);
  let state = 0;
  for (let index = 0; index < samples.length; index++) {
    state += share * (samples[index] - state);
    out[index] = state;
  }
  return out;
}

// Two one-pole stages each way: gentle slopes with no resonance of their own, so nothing rings.
function bandLimited(samples) {
  const low = onePole(onePole(samples, LOW_PASS), LOW_PASS);
  const rumble = onePole(onePole(low, HIGH_PASS), HIGH_PASS);
  const out = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) out[index] = low[index] - rumble[index];
  return out;
}

// A sparse, decaying scatter of quiet copies at random times and signs, different on each side:
// it reads as a small soft room and has no regular spacing to colour the sound.
function tailTaps(random) {
  const taps = [];
  let energy = 0;
  for (let index = 0; index < TAIL.taps; index++) {
    const delay = TAIL.from + random() * (TAIL.seconds - TAIL.from);
    const level = (random() < 0.5 ? -1 : 1) * Math.exp((-4.6 * delay) / TAIL.seconds);
    taps.push([Math.round(delay * RATE), level]);
    energy += level * level;
  }
  const scale = decibels(TAIL.levelDb) / Math.sqrt(energy);
  return taps.map(([offset, level]) => [offset, level * scale]);
}

function withTail(dry, taps) {
  const dull = onePole(dry, 1800);
  const out = Float32Array.from(dry);
  for (const [offset, level] of taps) {
    for (let index = offset; index < dry.length; index++) out[index] += dull[index - offset] * level;
  }
  return out;
}

function renderTrack(events, seconds) {
  const track = createTrack(seconds);
  const random = randomOf(1932);
  for (const event of events) {
    const voice = VOICES[event.name];
    if (voice) voice(track, random, event);
  }
  track.left = bandLimited(withTail(track.left, tailTaps(random)));
  track.right = bandLimited(withTail(track.right, tailTaps(random)));
  return track;
}

function peakOf(track) {
  let peak = 0;
  for (let index = 0; index < track.length; index++) peak = Math.max(peak, Math.abs(track.left[index]), Math.abs(track.right[index]));
  return peak;
}

function meanSquareOf(track) {
  let sum = 0;
  for (let index = 0; index < track.length; index++) sum += track.left[index] ** 2 + track.right[index] ** 2;
  return sum / (track.length * 2);
}

// Writes the mix times one linear gain as 16-bit PCM and returns how many samples reached full scale.
function writeWav(file, track, gain) {
  const data = Buffer.alloc(track.length * 4);
  let clipped = 0;
  for (let index = 0; index < track.length; index++) {
    for (const [side, offset] of [[track.left, 0], [track.right, 2]]) {
      const value = Math.round(side[index] * gain * 32767);
      if (Math.abs(value) >= 32767) clipped += 1;
      data.writeInt16LE(Math.max(-32768, Math.min(32767, value)), index * 4 + offset);
    }
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
  return clipped;
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

// In-place radix-2 FFT of a complex signal held as two arrays.
function transform(real, imaginary) {
  const size = real.length;
  for (let index = 1, swapped = 0; index < size; index++) {
    let bit = size >> 1;
    for (; swapped & bit; bit >>= 1) swapped ^= bit;
    swapped ^= bit;
    if (index < swapped) {
      [real[index], real[swapped]] = [real[swapped], real[index]];
      [imaginary[index], imaginary[swapped]] = [imaginary[swapped], imaginary[index]];
    }
  }
  for (let span = 2; span <= size; span <<= 1) {
    const angle = (-2 * Math.PI) / span;
    for (let start = 0; start < size; start += span) {
      for (let step = 0; step < span / 2; step++) {
        const cosine = Math.cos(angle * step);
        const sine = Math.sin(angle * step);
        const upper = start + step;
        const lower = upper + span / 2;
        const partReal = real[lower] * cosine - imaginary[lower] * sine;
        const partImaginary = real[lower] * sine + imaginary[lower] * cosine;
        real[lower] = real[upper] - partReal;
        imaginary[lower] = imaginary[upper] - partImaginary;
        real[upper] += partReal;
        imaginary[upper] += partImaginary;
      }
    }
  }
}

// Where the energy of a file lies, as shares of the whole: below 120 Hz, 120 Hz to 3.5 kHz, above 3.5 kHz.
// ffmpeg decodes the file to mono samples and one FFT over all of them sorts the energy by frequency.
export function measureSpectrum(file) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const samples = new Float32Array(run.stdout.buffer, run.stdout.byteOffset, Math.floor(run.stdout.length / 4));
  let size = 1;
  while (size < samples.length) size <<= 1;
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  real.set(samples);
  transform(real, imaginary);
  const bands = { below120: 0, from120to3500: 0, above3500: 0 };
  let whole = 0;
  for (let bin = 1; bin < size / 2; bin++) {
    const frequency = (bin * RATE) / size;
    const energy = real[bin] ** 2 + imaginary[bin] ** 2;
    whole += energy;
    if (frequency < 120) bands.below120 += energy;
    else if (frequency <= LOW_PASS) bands.from120to3500 += energy;
    else bands.above3500 += energy;
  }
  for (const name of Object.keys(bands)) bands[name] = Math.round((bands[name] / whole) * 1000000) / 10000;
  return bands;
}

// One linear gain, found by measuring: it aims at the loudness target and is then lowered, never
// raised, until the true peak is under the ceiling. Quiet wins when the two disagree.
function master(track, outFile) {
  let gain = decibels(PEAK_CEILING_DB - 0.1) / Math.max(peakOf(track), 1e-9);
  let clipped = writeWav(outFile, track, gain);
  let reading = measureLoudness(outFile);
  const tooLoud = Math.max(reading.integrated - TARGET_LUFS, reading.truePeak - PEAK_CEILING_DB, 0);
  if (tooLoud > 0) {
    gain *= decibels(-tooLoud - 0.1);
    clipped = writeWav(outFile, track, gain);
    reading = measureLoudness(outFile);
  }
  const peakDb = 20 * Math.log10(peakOf(track) * gain);
  const rmsDb = 10 * Math.log10(meanSquareOf(track) * gain * gain);
  return { ...reading, gainDb: 20 * Math.log10(gain), samplePeakDb: Math.round(peakDb * 10) / 10, crestDb: Math.round((peakDb - rmsDb) * 10) / 10, clipped };
}

export function buildSoundtrack(eventsFile, outFile, seconds) {
  const events = JSON.parse(readFileSync(eventsFile, "utf8"));
  const mastered = master(renderTrack(events, seconds), outFile);
  const counts = {};
  for (const event of events) counts[event.name] = (counts[event.name] ?? 0) + 1;
  return { counts, events: events.length, ...mastered, spectrum: measureSpectrum(outFile) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [eventsFile, outFile, seconds] = process.argv.slice(2);
  console.log(JSON.stringify(buildSoundtrack(eventsFile, outFile, Number(seconds ?? 30)), null, 1));
}
