// The score, synthesized in code and following the film's timeline:
// a soft pad per beat, plucks as the points appear, a rising figure while 2-opt untangles
// (pitch follows the real fraction of crossings removed), a bell chord when crossings reach 0,
// a slow melody for the pen, and a pulse locked to the crank for the ride.
// Writes sound/score_raw.wav (32-bit float, 48 kHz stereo); loudness is set later with ffmpeg.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./browser.mjs";
import { DURATION, PEN_END, PEN_START, PHASE, RIDE_START, STAGES, phaseTime } from "./timeline.mjs";
import { buildPenPlan } from "./penplan.mjs";

const RATE = 48000;
const left = new Float32Array(DURATION * RATE);
const right = new Float32Array(DURATION * RATE);
const meta = JSON.parse(await readFile(path.join(ROOT, "data", "meta.json"), "utf8"));
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const random = (() => {
  let state = 12345;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
})();

// Add a voice: `sample(time)` from `start` for `length` seconds, panned (-1 left .. 1 right).
function addVoice(start, length, pan, sample) {
  const first = Math.max(0, Math.round(start * RATE));
  const last = Math.min(left.length, Math.round((start + length) * RATE));
  const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
  const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let index = first; index < last; index += 1) {
    const value = sample(index / RATE - start);
    left[index] += value * leftGain;
    right[index] += value * rightGain;
  }
}

// Soft bell: a sine with a quiet octave and a faint inharmonic partial, exponential decay.
function bell(start, midi, gain, decay, pan = 0) {
  const base = frequency(midi);
  addVoice(start, decay * 6, pan, (time) => {
    const envelope = Math.min(1, time / 0.006) * Math.exp(-time / decay);
    const phase = 2 * Math.PI * base * time;
    return gain * envelope * (Math.sin(phase) + 0.25 * Math.sin(2 * phase) * Math.exp(-time / (decay * 0.4))
      + 0.06 * Math.sin(2.76 * phase) * Math.exp(-time / (decay * 0.25)));
  });
}

// Warm pad note: additive harmonics rolled off fast (no aliasing), slow swell in and out.
function padNote(start, length, midi, gain, pan) {
  const base = frequency(midi);
  const detune = 1.003;
  const attack = Math.min(1.2, length / 3);
  addVoice(start, length + 1.5, pan, (time) => {
    const swell = Math.min(1, time / attack) * (time > length ? Math.exp(-(time - length) / 0.5) : 1);
    let value = 0;
    for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
      const amplitude = Math.exp(-harmonic * 0.9) / harmonic;
      value += amplitude * (Math.sin(2 * Math.PI * base * harmonic * time)
        + Math.sin(2 * Math.PI * base * detune * harmonic * time + harmonic));
    }
    return gain * swell * value;
  });
}

function padChord(start, length, notes, gain) {
  notes.forEach((midi, index) => padNote(start, length, midi, gain, (index / (notes.length - 1)) * 1.2 - 0.6));
}

// Low soft thump for the ride pulse: a sine falling from 90 to 50 Hz.
function thump(start, gain) {
  addVoice(start, 0.5, 0, (time) => {
    const phase = 2 * Math.PI * (50 * time + (40 * (1 - Math.exp(-time * 25))) / 25);
    return gain * Math.min(1, time / 0.004) * Math.exp(-time / 0.12) * Math.sin(phase);
  });
}

// Pentatonic over D (D E F# A B) across octaves, for plucks and figures.
const PENTATONIC = [0, 2, 4, 7, 9];
const scaleNote = (root, step) => root + 12 * Math.floor(step / 5) + PENTATONIC[((step % 5) + 5) % 5];

const STAGE_CHORDS = [
  [50, 57, 61, 66], // Dmaj7
  [47, 54, 57, 61, 62], // Bm9
  [43, 50, 54, 59], // Gmaj7
  [40, 47, 50, 54, 55], // Em9
  [45, 52, 57, 62, 64], // Asus
];

for (const [index, stage] of STAGES.entries()) {
  const stageMeta = meta.stages[index];
  padChord(stage.start, stage.length, STAGE_CHORDS[index], 0.045);
  // Plucks as the points appear: a few more per stage, thinning out while Lloyd relaxes.
  const appearEnd = phaseTime(stage, PHASE.tourStart);
  const pluckCount = 8 + index * 4;
  for (let pluck = 0; pluck < pluckCount; pluck += 1) {
    const fraction = (pluck / pluckCount) ** 1.6;
    const start = stage.start + fraction * (appearEnd - stage.start);
    bell(start, scaleNote(74, Math.floor(random() * 8)), 0.07 * (1 - fraction * 0.5), 0.22, random() * 1.4 - 0.7);
  }
  // Tension when the crossings light up: a soft major second, high and quiet.
  const crossingsAt = phaseTime(stage, PHASE.crossingsStart);
  bell(crossingsAt, 81, 0.05, 0.6, -0.3);
  bell(crossingsAt + 0.05, 83, 0.05, 0.6, 0.3);
  // The rising figure: 16th notes through the untangling, pitch = fraction of crossings removed.
  const untangleStart = phaseTime(stage, PHASE.untangleStart);
  const resolvedAt = phaseTime(stage, PHASE.resolved);
  const startingCrossings = stageMeta.snapshots[0].crossings;
  const stepLength = 0.125;
  for (let time = untangleStart; time < resolvedAt - 0.05; time += stepLength) {
    const progress = (time - untangleStart) / (resolvedAt - untangleStart);
    const snapshot = stageMeta.snapshots[Math.min(stageMeta.snapshots.length - 1, Math.floor(progress * (stageMeta.snapshots.length - 1)))];
    const removed = 1 - snapshot.crossings / startingCrossings;
    const step = Math.round(removed * 9) + (Math.round((time - untangleStart) / stepLength) % 2);
    bell(time, scaleNote(62 + (index % 2) * 2, step), 0.06 + 0.03 * removed, 0.18, Math.sin(time * 3) * 0.5);
  }
  // Resolve when crossings hit 0: an open bell chord over a low root.
  for (const [voice, midi] of [62, 69, 74, 78].entries()) bell(resolvedAt + voice * 0.03, midi, 0.07, 1.6, voice * 0.4 - 0.6);
  bell(resolvedAt, 38, 0.12, 1.2);
}

// The pen. Its speed comes from the same plan the picture uses, so the build follows the time-lapse:
// notes get denser and climb as the speed rises (x1 -> x8 -> x64), thin out for each close-up,
// and the pad swells. Chords move every 2.5 seconds.
const finalStageMeta = meta.stages[meta.stages.length - 1];
const finalCount = finalStageMeta.count;
const lloydBytes = await readFile(path.join(ROOT, "data", `stage${meta.stages.length - 1}_lloyd.bin`));
const lloydAll = new Float32Array(lloydBytes.buffer, lloydBytes.byteOffset, lloydBytes.byteLength / 4);
const finalPoints = lloydAll.subarray(lloydAll.length - finalCount * 2);
const tourBytes = await readFile(path.join(ROOT, "data", `stage${meta.stages.length - 1}_tours.bin`));
const toursAll = new Uint16Array(tourBytes.buffer, tourBytes.byteOffset, tourBytes.byteLength / 2);
const finalTour = toursAll.subarray(toursAll.length - finalCount);
const labelBytes = await readFile(path.join(ROOT, "data", "labels.bin"));
const penPlan = buildPenPlan(finalPoints, finalTour, new Uint8Array(labelBytes), PEN_END - PEN_START);
console.log(`pen: ${penPlan.baseEdgesPerSecond.toFixed(1)} edges/s at x1; close-ups: `
  + penPlan.windows.map((window) => `${window.name} edges ${window.start}-${window.end} at `
    + `${(PEN_START + penPlan.timeOfEdge(window.start)).toFixed(1)}-${(PEN_START + penPlan.timeOfEdge(window.end)).toFixed(1)} s`).join("; "));

const PEN_CHORDS = [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 61], [50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 64]];
for (let chordIndex = 0; PEN_START + chordIndex * 2.5 < PEN_END; chordIndex += 1) {
  const start = PEN_START + chordIndex * 2.5;
  const speed = penPlan.speedAtEdge(penPlan.edgeAtTime(chordIndex * 2.5 + 1.25));
  const intensity = Math.min(1, Math.log(speed / 4) / Math.log(64));
  padChord(start, Math.min(2.5, PEN_END - start), PEN_CHORDS[chordIndex % PEN_CHORDS.length], 0.035 + 0.03 * intensity);
}
let noteIndex = 0;
for (let time = PEN_START; time < PEN_END - 0.1;) {
  const speed = penPlan.speedAtEdge(penPlan.edgeAtTime(time - PEN_START));
  const intensity = Math.min(1, Math.log(speed / 4) / Math.log(64));
  const chord = PEN_CHORDS[Math.floor((time - PEN_START) / 2.5) % PEN_CHORDS.length];
  const climb = Math.round(intensity * 8);
  const midi = chord[noteIndex % chord.length] + 12 + (climb >= 4 ? 12 : 0) + (noteIndex % 4 === 3 ? 7 : 0);
  bell(time, midi, 0.05 + 0.03 * intensity, 0.35 - 0.2 * intensity, Math.sin(noteIndex * 0.9) * 0.6);
  if (intensity > 0.6 && noteIndex % 4 === 0) thump(time, 0.12 * intensity);
  noteIndex += 1;
  // From one note every 0.6 s at x4 to about eight a second at x256.
  time += 0.6 / (1 + 6.5 * intensity);
}
// The loop closes: the biggest resolve of the film.
for (const [voice, midi] of [50, 57, 62, 66, 69, 74].entries()) bell(PEN_END + voice * 0.04, midi, 0.08, 2.2, voice * 0.3 - 0.75);
bell(PEN_END, 38, 0.16, 1.6);
padChord(PEN_END, RIDE_START - PEN_END + 0.5, [38, 50, 57, 62, 66], 0.05);

// The ride: one bar = one crank turn = 3 s = four beats. Pulse on beats 1 and 3, arpeggio in 8ths.
const RIDE_CHORDS = [[43, 50, 55, 59], [42, 50, 54, 57], [40, 47, 52, 55], [45, 52, 57, 61]];
const bar = 3;
for (let barIndex = 0; RIDE_START + barIndex * bar < DURATION - 0.5; barIndex += 1) {
  const barStart = RIDE_START + barIndex * bar;
  const chord = RIDE_CHORDS[barIndex % RIDE_CHORDS.length];
  padChord(barStart, bar, chord, 0.04);
  thump(barStart, 0.32);
  thump(barStart + bar / 2, 0.22);
  for (let eighth = 0; eighth < 8; eighth += 1) {
    const start = barStart + eighth * (bar / 8);
    if (start > DURATION - 1.2) break;
    const midi = chord[eighth % chord.length] + 24;
    bell(start, midi, 0.045, 0.25, eighth % 2 ? 0.45 : -0.45);
  }
}
padChord(DURATION - 2.2, 1.6, [50, 57, 62, 66, 69], 0.05);

// A small Schroeder reverb (four combs, two all-passes per channel) for space.
function reverb(input, delays) {
  const output = new Float32Array(input.length);
  for (const delaySeconds of delays) {
    const delay = Math.round(delaySeconds * RATE);
    const buffer = new Float32Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
      buffer[index] = input[index] + (index >= delay ? 0.78 * buffer[index - delay] : 0);
      output[index] += buffer[index] * 0.25;
    }
  }
  for (const delaySeconds of [0.005, 0.0017]) {
    const delay = Math.round(delaySeconds * RATE);
    const copy = output.slice();
    for (let index = 0; index < output.length; index += 1) {
      const delayed = index >= delay ? output[index - delay] : 0;
      output[index] = -0.7 * copy[index] + (index >= delay ? copy[index - delay] : 0) + 0.7 * delayed;
    }
  }
  return output;
}
const wetLeft = reverb(left, [0.0297, 0.0371, 0.0411, 0.0437]);
const wetRight = reverb(right, [0.0313, 0.0353, 0.0429, 0.0457]);
// Gentle low-pass on the dry mix keeps the bells soft, never shrill.
let smoothedLeft = 0;
let smoothedRight = 0;
const interleaved = new Float32Array(left.length * 2);
let peak = 0;
for (let index = 0; index < left.length; index += 1) {
  smoothedLeft += 0.35 * (left[index] - smoothedLeft);
  smoothedRight += 0.35 * (right[index] - smoothedRight);
  const fadeOut = Math.min(1, (DURATION - index / RATE) / 0.8);
  interleaved[2 * index] = (smoothedLeft + 0.3 * wetLeft[index]) * fadeOut;
  interleaved[2 * index + 1] = (smoothedRight + 0.3 * wetRight[index]) * fadeOut;
  peak = Math.max(peak, Math.abs(interleaved[2 * index]), Math.abs(interleaved[2 * index + 1]));
}
for (let index = 0; index < interleaved.length; index += 1) interleaved[index] *= 0.5 / peak;

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + interleaved.byteLength, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(3, 20); // IEEE float
header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 8, 28);
header.writeUInt16LE(8, 32);
header.writeUInt16LE(32, 34);
header.write("data", 36);
header.writeUInt32LE(interleaved.byteLength, 40);
await mkdir(path.join(ROOT, "sound"), { recursive: true });
await writeFile(path.join(ROOT, "sound", "score_raw.wav"), Buffer.concat([header, Buffer.from(interleaved.buffer)]));
console.log(`score written, raw peak before scaling ${peak.toFixed(3)}`);
