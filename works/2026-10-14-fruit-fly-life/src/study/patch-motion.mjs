// Smooth motion for beat 4: no boiling lines, a moving camera in every shot, subjects that keep moving.
import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 60)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

// Boiling lines at 8 per second read as stop motion; keep the hand wobble but hold it still.
patch("src/ink.js", [["  const BOIL_PER_SECOND = 8;", "  const BOIL_PER_SECOND = 0;"]]);

patch("src/metamorphosis.js", [
  // Dish: larvae crawl in toward the food and wriggle harder.
  ["      const start = 330 + hash(larva, 4) * 80;\n      const bend = Math.sin(local * 14 + larva) * 0.25;",
   "      const start = 330 + hash(larva, 4) * 80 - easeOut(local) * 70;\n      const bend = Math.sin(local * 16 + larva) * 0.4;"],
  // End-on: a peristaltic wave runs through the rings.
  ["      const radius = lerp(250, 60, amount) * (ring % 2 ? 1 : pulse);",
   "      const radius = lerp(250, 60, amount) * (1 + 0.06 * Math.sin(local * 14 - ring * 0.9)) * pulse;"],
  // Blueprint pupa turns slowly.
  ["    const center = [540, 560];\n    const angle = -0.35;", "    const center = [540, 560];\n    const angle = -0.35 + local * 0.18;"],
  // Each shot gets its own camera move.
  ["    { end: 1.0, draw: (context, local, time) => story(context, time * 2.0) },",
   "    { end: 1.0, camera: [1.0, 1.15, 0.03, -40, 20], draw: (context, local, time) => story(context, time * 2.0) },"],
  ["    { end: 1.4, draw: (context, local) => macroHead(context, 0.7 + local * 0.3, local) },",
   "    { end: 1.4, camera: [1.0, 1.1, -0.05, 30, -30], draw: (context, local) => macroHead(context, 0.7 + local * 0.3, local) },"],
  ["    { end: 1.85, draw: (context, local) => dish(context, local) },",
   "    { end: 1.85, camera: [1.05, 1.2, 0.12, 0, 0], draw: (context, local) => dish(context, local) },"],
  ["    { end: 2.25, draw: (context, local) => endOn(context, local) },",
   "    { end: 2.25, camera: [1.05, 1.25, -0.08, 30, 30], draw: (context, local) => endOn(context, local) },"],
  ["    { end: 3.35, draw: (context, local) => story(context, 2.5 + local * 1.7) },",
   "    { end: 3.35, camera: [1.2, 1.0, 0.04, 40, -40], draw: (context, local) => story(context, 2.5 + local * 1.7) },"],
  ["    { end: 4.75, draw: (context, local) => blueprintPupa(context, local * 1.4) },",
   "    { end: 4.75, camera: [0.95, 1.2, 0.05, 0, 20], draw: (context, local) => blueprintPupa(context, local * 1.4) },"],
  ["    { end: 8.0, draw: (context, local) => story(context, 5.2 + local * 2.8, { inside: false }) },",
   "    { end: 8.0, camera: [1.12, 1.0, 0.02, -20, 30], fadeCameraAt: 0.5, draw: (context, local) => story(context, 5.2 + local * 2.8, { inside: false }) },"],
  [`      if (time < shot.end || shot === SHOTS[SHOTS.length - 1]) {
        shot.draw(context, clamp((time - start) / (shot.end - start)), time);
        return;
      }`, `      if (time < shot.end || shot === SHOTS[SHOTS.length - 1]) {
        const local = clamp((time - start) / (shot.end - start));
        context.save();
        applyShotCamera(context, shot, local);
        shot.draw(context, local, time);
        context.restore();
        return;
      }`],
  ["  // ---------- the montage: fast cuts between angles ----------", `  // ---------- the montage: fast cuts between angles ----------

  // A camera that never stands still: zoom from one scale to another, a slow turn, a drift, and a small kick at the
  // start of each shot so the cut lands with energy. Scale stays above 1 so turning never shows the frame's edge.
  function applyShotCamera(context, shot, local) {
    if (!shot.camera) {
      return;
    }
    const [fromScale, toScale, turn, driftX, driftY] = shot.camera;
    const weight = shot.fadeCameraAt ? 1 - easeInOut(progress(local, shot.fadeCameraAt, shot.fadeCameraAt + 0.15)) : 1;
    const kick = 1 + 0.05 * (1 - easeOut(clamp(local * 5)));
    const scale = lerp(1, Math.max(1.06, lerp(fromScale, toScale, easeInOut(local))) * kick, weight);
    context.translate(540 + driftX * (local - 0.5) * weight, 540 + driftY * (local - 0.5) * weight);
    context.rotate(turn * (local - 0.5) * weight);
    context.scale(scale, scale);
    context.translate(-540, -540);
  }`],
]);
