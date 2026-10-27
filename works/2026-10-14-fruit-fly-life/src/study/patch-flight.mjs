// Flight for beat 5: a wing beat drawn as a blurred fan, a cast shadow that drops away with height, and the ground
// pieces exported for the aerial shot.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/fly.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
}

replace("legsFree = [1, 1, 1], eyePigment = 1 }) {", "legsFree = [1, 1, 1], eyePigment = 1, wingBeat = 0, height = 0 }) {");
replace(`    context.filter = "blur(18px)";
    context.fillStyle = "rgba(90,25,10,0.18)";
    tracePath(context, place(ellipse(40, 230, 170, 330, 0, 40)).map(([px, py]) => [px + 30, py + 26]));`,
`    // Off the ground the shadow drops away, spreads and fades.
    context.filter = \`blur(\${18 + height * 0.08}px)\`;
    context.fillStyle = \`rgba(90,25,10,\${0.18 / (1 + height / 150)})\`;
    tracePath(context, place(ellipse(40, 230, 170, 330, 0, 40)).map(([px, py]) => [px + 30 + height * 0.6, py + 26 + height]));`);
replace("    [-1, 1].forEach((side) => wing(context, place, side, seed + side, wingSpread, wingOpen));",
`    // At 200 beats a second every frame catches a new phase: the wings read as a fan of faint outlines between the
    // top and the bottom of the stroke, with the two ends drawn in full.
    if (wingBeat > 0) {
      const STROKE_TOP = -0.15;
      const STROKE_BOTTOM = 1.45;
      [-1, 1].forEach((side) => {
        for (let ghost = 0; ghost <= 8; ghost += 1) {
          const open = lerp(STROKE_TOP, STROKE_BOTTOM, ghost / 8);
          const turn = -side * open;
          const outline = wingOutline(side).map(([pointX, pointY]) => {
            const deltaX = pointX - side * 75;
            const deltaY = pointY - 60;
            return [side * 75 + deltaX * Math.cos(turn) - deltaY * Math.sin(turn), 60 + deltaX * Math.sin(turn) + deltaY * Math.cos(turn)];
          });
          tracePath(context, place(outline));
          context.fillStyle = \`rgba(255,255,255,\${0.05 * wingBeat})\`;
          context.fill();
          context.strokeStyle = \`rgba(60,70,110,\${0.22 * wingBeat})\`;
          context.lineWidth = 1;
          context.stroke();
        }
        wing(context, place, side, seed + side, wingSpread, STROKE_TOP);
        wing(context, place, side, seed + side, wingSpread, STROKE_BOTTOM);
      });
    } else {
      [-1, 1].forEach((side) => wing(context, place, side, seed + side, wingSpread, wingOpen));
    }`);
replace("  return { frame, fly, ground, wingGuides };", "  return { frame, fly, ground, wingGuides, background, orange, sketchShade, strokeField, tracePath, ellipse };");
writeFileSync(path, text);
