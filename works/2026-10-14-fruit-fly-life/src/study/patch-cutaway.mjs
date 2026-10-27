import { readFileSync, writeFileSync } from "node:fs";

const root = process.argv[2];
function patch(file, pairs) {
  const path = `${root}/${file}`;
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    }
    text = text.split(from).join(to);
  }
  writeFileSync(path, text);
}

// Hatching scene: a smear of yeast paste where the larva will feed, not oversized white cells.
patch("src/larva.js", [
  ["    yeastCluster(context, 230, 880, time);", "    yeastPaste(context, 230, 880, 95, 4);"],
  ["  function yeastCluster(context, centerX, centerY, time) {", `  function yeastPaste(context, centerX, centerY, radius, seed) {
    const outline = [];
    for (let step = 0; step < 50; step += 1) {
      const turn = (step / 50) * Math.PI * 2;
      const reach = radius * (1 + 0.12 * Math.sin(turn * 5 + seed) + 0.06 * Math.sin(turn * 11));
      outline.push([centerX + Math.cos(turn) * reach, centerY + Math.sin(turn) * reach * 0.8]);
    }
    trace(context, outline);
    context.fillStyle = "#e8d6a8";
    context.fill();
    context.save();
    trace(context, outline);
    context.clip();
    context.fillStyle = "rgba(150,110,60,0.45)";
    for (let speck = 0; speck < 200; speck += 1) {
      context.fillRect(centerX + (hash(speck, seed) - 0.5) * radius * 2.2, centerY + (hash(seed, speck) - 0.5) * radius * 1.8, 1.6, 1.6);
    }
    context.restore();
    trace(context, outline);
    context.strokeStyle = "rgba(110,70,30,0.8)";
    context.lineWidth = 2;
    context.stroke();
  }

  function yeastCluster(context, centerX, centerY, time) {`],
]);

patch("src/metamorphosis.js", [
  ["    { end: 6.0, camera: [0.95, 1.15, 0.04, 0, 20], draw: (context, local) => blueprintPupa(context, local * 2.5) },",
   "    { end: 6.0, camera: [1.0, 1.08, 0.02, 0, 10], draw: (context, local) => cutawayPupa(context, local * 2.5) },"],
  // Legs step only as the body moves: their clock is the distance climbed, one swing per push.
  ["legSwing, legTime: time, legsFree });", "legSwing, legTime: legClock ?? time, legsFree });"],
  ["legsFree = [1, 1, 1], hideInside = false, wingOpen = 0, stretch = 0 }) {", "legsFree = [1, 1, 1], hideInside = false, wingOpen = 0, stretch = 0, legClock = null }) {"],
  ["spread, pale, rock, legSwing, legsFree, hideInside: true, stretch: inflateOrSlip });", "spread, pale, rock, legSwing, legsFree, hideInside: true, stretch: inflateOrSlip, legClock: climb * 2.244 });"],
  ["spread, pale, rock, legSwing, legsFree, hideInside: climb < 1, wingOpen, stretch: climb < 1 ? inflate : 0 });", "spread, pale, rock, legSwing, legsFree, hideInside: climb < 1, wingOpen, stretch: climb < 1 ? inflate : 0, legClock: climb * 2.244 });"],
  // Once fully out, the feet stay planted.
  ["    const legSwing = clamp((climb - 0.3) / 0.2) * (1 - progress(time, 6.9, 7.3));", "    const legSwing = clamp((climb - 0.3) / 0.2) * (climb < 1 ? 1 : 0);"],
]);
