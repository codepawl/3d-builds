// Wires the new pupa art and effects into the story: impact strength, debris, ghost wing guides.
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
  ["  return { frame, fly, ground };", `  // Blue construction outlines of the wings at full size, drawn before they unfold into them.
  function wingGuides(context, { x, y, angle, scale = 1, alpha = 1 }) {
    const place = (points) => points.map((point) => {
      const [rotatedX, rotatedY] = rotatePoint([point[0] * scale, point[1] * scale], angle);
      return [x + rotatedX, y + rotatedY];
    });
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = "rgba(70,90,200,0.75)";
    context.lineWidth = 1.4;
    context.setLineDash([6, 5]);
    [-1, 1].forEach((side) => {
      tracePath(context, place(wingOutline(side)));
      context.stroke();
    });
    context.restore();
  }

  return { frame, fly, ground, wingGuides };`],
]);

patch("src/metamorphosis.js", [
  ["      drawPupa(context, time, { seeThrough: flyInside * (1 - climb), capOpen });",
   "      drawPupa(context, time, { seeThrough: flyInside * (1 - climb), capOpen, impact: impactAt(time) });"],
  ["    if (climb >= 0.75) {\n      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });",
   `    drawDebris(context, time);
    const guides = progress(time, 6.8, 7.0) * (1 - progress(time, 7.6, 7.85));
    if (guides > 0) {
      Fly.wingGuides(context, { x: outX + wiggle, y: outY, angle: HEAD_DIRECTION + Math.PI / 2 + rock, scale: FLY_SCALE, alpha: guides });
    }
    if (climb >= 0.75) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale, rock, legSwing });`],
  ["  // Three nudges that grow", `  // How hard the last hit was: the small nudges give short lines, the pop the longest, then they fade.
  function impactAt(time) {
    if (time < 5.82) {
      return capLift(time) / 0.38 * 0.55;
    }
    return 1 - progress(time, 5.82, 6.15);
  }

  // Three nudges that grow`],
]);
