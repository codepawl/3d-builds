// Motion on the beat for every beat of the film, and a fly that stays on the orange.
import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

// A shared beat clock: 120 BPM. Within each beat, story time surges at the downbeat and eases off without stopping,
// so every move pumps with the music; each downbeat also gives the frame a small zoom kick.
patch("src/ink.js", [
  ["  return {\n    PAPER,", `  const BEAT = 0.5;
  function beatTime(time) {
    const beat = Math.floor(time / BEAT);
    const phase = time / BEAT - beat;
    const surge = 1 - (1 - phase) ** 3;
    return (beat + 0.65 * surge + 0.35 * phase) * BEAT;
  }

  function beatPulse(context, time, size, strength = 0.018) {
    const phase = (time / BEAT) % 1;
    const scale = 1 + strength * Math.exp(-phase * 7);
    context.translate(size / 2, size / 2);
    context.scale(scale, scale);
    context.translate(-size / 2, -size / 2);
  }

  // Wraps a module's renderAt so it runs on beat time inside a pulsing frame.
  function onBeat(renderAt, size = 1080) {
    return (context, time) => {
      context.save();
      beatPulse(context, time, size);
      renderAt(context, beatTime(time));
      context.restore();
    };
  }

  return {
    BEAT, beatTime, beatPulse, onBeat,
    PAPER,`],
]);

for (const file of ["src/embryo.js", "src/larva.js", "src/metamorphosis.js"]) {
  const pairs = [["  return { renderAt, DURATION", "  return { renderAt: Ink.onBeat(renderAt), DURATION"]];
  patch(file, pairs);
}

patch("src/metamorphosis.js", [
  // Cuts land on beats.
  ["    { end: 1.4, camera:", "    { end: 1.5, camera:"],
  ["    { end: 1.85, camera:", "    { end: 2.0, camera:"],
  ["    { end: 2.25, camera:", "    { end: 2.5, camera:"],
  ["    { end: 3.35, camera:", "    { end: 3.5, camera:"],
  ["    { end: 4.75, camera:", "    { end: 5.0, camera:"],
  // The fly climbs out onto the orange and stays on it, instead of past its edge.
  ["    const [outX, outY] = along(PUPA_HALF_LENGTH * 0.25 + climb * 2.4 * PUPA_HALF_LENGTH);", "    const [outX, outY] = along(PUPA_HALF_LENGTH * 0.25 + climb * 1.45 * PUPA_HALF_LENGTH);"],
  ["    const flyEndX = CENTER[0] + DIRECTION[0] * (PUPA_HALF_LENGTH * 0.25 + 2.4 * PUPA_HALF_LENGTH);\n    const flyEndY = CENTER[1] + DIRECTION[1] * (PUPA_HALF_LENGTH * 0.25 + 2.4 * PUPA_HALF_LENGTH);",
   "    const flyEndX = CENTER[0] + DIRECTION[0] * (PUPA_HALF_LENGTH * 0.25 + 1.45 * PUPA_HALF_LENGTH);\n    const flyEndY = CENTER[1] + DIRECTION[1] * (PUPA_HALF_LENGTH * 0.25 + 1.45 * PUPA_HALF_LENGTH);"],
]);
