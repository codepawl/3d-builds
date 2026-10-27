import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
// A smooth path: Catmull-Rom through the control points, so the body bends instead of folding at corners.
swap("  // Peristalsis:", `  function smoothPath(controls, perSegment = 16) {
    const points = [];
    for (let index = 0; index < controls.length - 1; index += 1) {
      const previous = controls[Math.max(0, index - 1)];
      const current = controls[index];
      const next = controls[index + 1];
      const after = controls[Math.min(controls.length - 1, index + 2)];
      for (let step = 0; step < perSegment; step += 1) {
        const t = step / perSegment;
        points.push([0, 1].map((axis) => 0.5 * (2 * current[axis] + (-previous[axis] + next[axis]) * t + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - after[axis]) * t * t + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + after[axis]) * t * t * t)));
      }
    }
    points.push(controls[controls.length - 1]);
    return makePath(points);
  }

  // Peristalsis:`);
swap(`    const path = makePath([
      eggPoint(egg, 1.6, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.4, 0.25), eggPoint(egg, -1.9, 0.9), [300, 840], [200, 900],
    ]);`, `    const path = smoothPath([
      eggPoint(egg, 1.6, 0), eggPoint(egg, 0, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.6, 0.35), [420, 760], [300, 860], [220, 920],
    ]);`);
// Wrinkles: irregular soft curves instead of chevrons.
swap(`      for (let wrinkle = 0; wrinkle < 7; wrinkle += 1) {
        const u = -0.6 + wrinkle * 0.2;
        trace(context, [eggPoint(egg, u, -0.7 * squash), eggPoint(egg, u + 0.08, 0), eggPoint(egg, u - 0.04, 0.8 * squash)], false);
        context.stroke();
      }`, `      for (let wrinkle = 0; wrinkle < 9; wrinkle += 1) {
        const u = -0.7 + hash(wrinkle, 7) * 1.4;
        const v = -0.6 + hash(wrinkle, 8) * 1.2;
        const [startX, startY] = eggPoint(egg, u, v * squash);
        const [endX, endY] = eggPoint(egg, u + (hash(wrinkle, 9) - 0.5) * 0.5, (v + (hash(wrinkle, 10) - 0.5) * 0.8) * squash);
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo((startX + endX) / 2 + (hash(wrinkle, 11) - 0.5) * 40, (startY + endY) / 2 + (hash(wrinkle, 12) - 0.5) * 40, endX, endY);
        context.stroke();
      }`);
writeFileSync(path, text);
