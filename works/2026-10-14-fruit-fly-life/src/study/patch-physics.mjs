// Emergence physics (legs folded until their pair is out, nothing inside the case shows) and a camera that flinches
// with each hit.
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

patch("src/fly.js", [
  ["wingSpread = 1, legSwing = 0, legTime = 0 }) {", "wingSpread = 1, legSwing = 0, legTime = 0, legsFree = [1, 1, 1] }) {"],
  ["    const SWING_BY_PAIR = [0.7, 0.4, 0.25];", `    const SWING_BY_PAIR = [0.7, 0.4, 0.25];
    // Folded against the body, pointing back, as the legs lie inside the pupal case.
    const FOLDED = [1.3, 1.55, 1.6];`],
  ["          const bent = segmentAngle + swing * (1 + segment * 0.4);\n          joints.push([lastX + side * Math.cos(bent) * length, lastY + Math.sin(bent) * length]);",
   "          const free = legsFree[pair];\n          const bent = lerp(FOLDED[segment], segmentAngle, free) + swing * free * (1 + segment * 0.4);\n          const reach = length * lerp(0.75, 1, free);\n          joints.push([lastX + side * Math.cos(bent) * reach, lastY + Math.sin(bent) * reach]);"],
]);

patch("src/metamorphosis.js", [
  ["  function drawFly(context, time, { x, y, spread, pale, alpha = 1, clip = null, rock = 0, legSwing = 0 }) {",
   "  function drawFly(context, time, { x, y, spread, pale, alpha = 1, clip = null, rock = 0, legSwing = 0, legsFree = [1, 1, 1], hideInside = false }) {"],
  ["wingSpread: spread, legSwing, legTime: time });", "wingSpread: spread, legSwing, legTime: time, legsFree });"],
  ["    if (clip) {\n      trace(context, clip);\n      context.clip();\n    }",
   `    if (clip) {
      trace(context, clip);
      context.clip();
    }
    if (hideInside) {
      // Everything except the case below its opening: the part of the fly still inside stays hidden.
      context.beginPath();
      context.rect(-SIZE, -SIZE, SIZE * 3, SIZE * 3);
      const body = pupaOutline(1.04).filter((point) => lengthwiseOf(point) < PUPA_HALF_LENGTH * 0.62);
      body.forEach(([pointX, pointY], index) => (index ? context.lineTo(pointX, pointY) : context.moveTo(pointX, pointY)));
      context.closePath();
      context.clip("evenodd");
    }`],
  ["    const legSwing = clamp((climb - 0.3) / 0.2) * (1 - progress(time, 6.9, 7.3));",
   `    const legSwing = clamp((climb - 0.3) / 0.2) * (1 - progress(time, 6.9, 7.3));
    // Each pair unfolds only once its hips are past the opening: front, then middle, then hind.
    const legsFree = [clamp((climb - 0.3) / 0.12), clamp((climb - 0.5) / 0.12), clamp((climb - 0.72) / 0.12)];`],
  ["      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });\n      drawPtilinum",
   "      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing, legsFree, hideInside: true });\n      drawPtilinum"],
  ["    if (climb >= 0.75) {\n      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });",
   "    if (climb >= 0.75) {\n      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing, legsFree, hideInside: climb < 1 });"],
  // The camera flinches with each hit: a quick zoom in and out about the case's head end, and a small shake.
  ["    Ink.paper(context, SIZE);\n    Larva.fruitFlesh(context);\n    const onOrange",
   `    const hit = impactAt(time);
    if (hit > 0.02 && push <= 0) {
      const [tipX, tipY] = along(PUPA_HALF_LENGTH * 0.9);
      const flinch = 1 + 0.045 * hit;
      const shakeX = (hash(Math.floor(time * 30), 1) - 0.5) * 8 * hit;
      const shakeY = (hash(Math.floor(time * 30), 2) - 0.5) * 8 * hit;
      context.translate(tipX + shakeX, tipY + shakeY);
      context.scale(flinch, flinch);
      context.translate(-tipX, -tipY);
    }
    Ink.paper(context, SIZE);
    Larva.fruitFlesh(context);
    const onOrange`],
]);
