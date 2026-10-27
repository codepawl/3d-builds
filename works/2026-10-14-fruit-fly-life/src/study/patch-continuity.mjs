// Eye pigment drawn inside the eye itself (no overlay that can drift), an empty eggshell that stays where the larva
// hatched, and the opening's zoom landing on the same fruit flesh the egg hatches on.
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

patch("src/fly.js", [
  ["  function compoundEye(context, centerX, centerY, radiusX, radiusY, rotation, seed) {",
   `  // pigment 0 is the white eye of a young pupa, 1 the adult's red.
  function eyeColor(red, white, pigment) {
    const parse = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    const [from, to] = [parse(white), parse(red)];
    return \`rgb(\${from.map((channel, index) => Math.round(lerp(channel, to[index], pigment))).join(",")})\`;
  }

  function compoundEye(context, centerX, centerY, radiusX, radiusY, rotation, seed, pigment = 1) {`],
  ['    context.fillStyle = "#8e1520";', '    context.fillStyle = eyeColor("#8e1520", "#e8dfc8", pigment);'],
  ['        context.fillStyle = lightness > 0.2 ? `rgb(${Math.round(lerp(190, 240, lightness))},${Math.round(lerp(40, 140, lightness))},${Math.round(lerp(50, 140, lightness))})` : hash(row, column, seed) > 0.5 ? "#b52532" : "#a01c2a";',
   '        context.fillStyle = lightness > 0.2 ? eyeColor("#f08c8c", "#fffaf0", pigment) : hash(row, column, seed) > 0.5 ? eyeColor("#b52532", "#f2ead6", pigment) : eyeColor("#a01c2a", "#ebe2cc", pigment);'],
  ['    context.fillStyle = "#2a0508";', '    context.fillStyle = eyeColor("#2a0508", "#cfc4aa", pigment);'],
  ["wingSpread = 1, wingOpen = 0, legSwing = 0, legTime = 0, legsFree = [1, 1, 1] }) {", "wingSpread = 1, wingOpen = 0, legSwing = 0, legTime = 0, legsFree = [1, 1, 1], eyePigment = 1 }) {"],
  ["      compoundEye(context, eyeX, eyeY, 37 * scale, 57 * scale, angle + side * 0.12, seed + side);", "      compoundEye(context, eyeX, eyeY, 37 * scale, 57 * scale, angle + side * 0.12, seed + side, eyePigment);"],
]);

let meta = readFileSync(`${root}/src/metamorphosis.js`, "utf8");
// Remove the overlay block (white and red circles) in the cutaway.
const start = meta.indexOf("      // Day 6: the eyes are still white; day 7 they colour from the inside out.");
const end = meta.indexOf("        context.globalCompositeOperation = \"source-over\";\n      }", start);
if (start < 0 || end < 0) {
  throw new Error("overlay block not found");
}
meta = meta.slice(0, start) + meta.slice(end + "        context.globalCompositeOperation = \"source-over\";\n      }".length);
meta = meta.replace("scale: 0.64, seed: 31, wingSpread: 0, legsFree: [0, 0, 0] });",
  "scale: 0.64, seed: 31, wingSpread: 0, legsFree: [0, 0, 0], eyePigment: stage === 2 ? 0 : stage === 3 ? easeOut(within) : 1 });");
// The shell the larva left stays on the flesh while it feeds.
meta = meta.replace("    eatenYeast(context, time);", `    eatenYeast(context, time);
    emptyShell(context, time);`);
meta = meta.replace("  // Food as it really is for a larva:", `  // The empty eggshell from the hatching, still lying on the flesh near where the larva started feeding.
  function emptyShell(context, time) {
    const fade = 1 - progress(time, 2.3, 2.6);
    if (fade <= 0) {
      return;
    }
    const [x, y] = along(-260, 170);
    context.save();
    context.globalAlpha = fade;
    context.translate(x, y);
    context.rotate(HEAD_DIRECTION + 0.5);
    context.beginPath();
    context.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(250,245,230,0.85)";
    context.fill();
    context.strokeStyle = "#1d1f33";
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = "rgba(80,60,40,0.6)";
    context.lineWidth = 1.4;
    [[-30, -8, -5, 6], [5, -10, 25, 4], [-10, 10, 18, -2]].forEach(([fromX, fromY, toX, toY]) => {
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.quadraticCurveTo((fromX + toX) / 2, fromY - 8, toX, toY);
      context.stroke();
    });
    [-1, 1].forEach((side) => {
      context.strokeStyle = "#1d1f33";
      context.beginPath();
      context.moveTo(-66, side * 6);
      context.lineTo(-110, side * 22);
      context.stroke();
    });
    context.restore();
  }

  // Food as it really is for a larva:`);
writeFileSync(`${root}/src/metamorphosis.js`, meta);

// The opening's punch in lands on the same flesh the egg hatches on.
patch("src/opening.js", [
  ["    Fly.ground(context);\n", "    Fly.ground(context);\n    // Zooming in, the orange's surface resolves into the juicy cells the egg hatches on.\n    const resolve = progress(time, 1.55, 1.85);\n    if (resolve > 0) {\n      context.save();\n      context.globalAlpha = resolve;\n      context.translate(eggPlace[0], eggPlace[1]);\n      context.scale(0.25, 0.25);\n      context.translate(-540, -540);\n      Larva.fruitFlesh(context);\n      context.restore();\n    }\n"],
]);
patch("study/opening.html", [["<script src=\"../src/opening.js\"></script>", "<script src=\"../src/larva.js\"></script>\n<script src=\"../src/opening.js\"></script>"]]);
