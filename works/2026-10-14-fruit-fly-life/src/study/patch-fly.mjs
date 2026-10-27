import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
};
// Wider wings that lie over the abdomen's sides, starting at the back of the thorax.
swap(`      outline.push([side * (20 + Math.sin(along * Math.PI) * 95 * (1 - along * 0.25)), 20 + along * 470]);`,
     `      outline.push([side * (30 + Math.sin(along * Math.PI * 0.85) * 165), 40 + along * 440]);`);
swap(`      outline.push([side * (20 + Math.sin(along * Math.PI) * 10 + along * 50), 20 + along * 470]);`,
     `      outline.push([side * (25 + Math.sin(along * Math.PI) * 30 + along * 20), 40 + along * 440]);`);
swap(`    const rotated = outline.map(([x, y]) => rotatePoint([x, y], side * 0.18));`, `    const rotated = outline.map(([x, y]) => rotatePoint([x, y], side * 0.12));`);
swap(`      tracePath(context, place([[side * 25, 30], [side * 70 * reach, 200], [side * 95 * reach, 470]].map(([x, y]) => rotatePoint([x, y], side * 0.18))), false);`,
     `      tracePath(context, place([[side * 30, 50], [side * (40 + 110 * reach), 240], [side * (35 + 120 * reach), 470]].map(([x, y]) => rotatePoint([x, y], side * 0.12))), false);`);
// The shadow side of the orange is what the frame shows, so measure shade across the visible part.
swap(`    const light = [centerX - radius * 0.5, centerY - radius * 0.5];
    const shade = (x, y) => clamp(Math.hypot(x - light[0], y - light[1]) / (radius * 1.6));`,
     `    const light = [150, 520];
    const shade = (x, y) => clamp((Math.hypot(x - light[0], y - light[1]) - 150) / 900);`);
swap(`density: (x, y) => shade(x, y) ** 2.2, seed: 12, alpha: 0.7 });`, `density: (x, y) => shade(x, y) ** 1.6, seed: 12, alpha: 0.75 });`);
swap(`density: (x, y) => shade(x, y) ** 4, seed: 13, alpha: 0.6 });`, `density: (x, y) => shade(x, y) ** 2.5, seed: 13, alpha: 0.65 });`);
// Thorax fur runs along the body, not in a whirl.
swap(`strokeField(context, thoraxBox, { count: 7000, color: "#5a3a1c", width: 1, length: [6, 14], angleAt: (px, py) => Math.atan2(py - thoraxCenter[1], px - thoraxCenter[0]) + Math.PI / 2 + 0.3, seed: seed + 5, alpha: 0.5 });`,
     `strokeField(context, thoraxBox, { count: 4500, color: "#5a3a1c", width: 1, length: [5, 11], angleAt: (px, py) => angle + Math.PI / 2 + (px - thoraxCenter[0]) / 300, density: (px, py) => 0.3 + 0.7 * clamp((py - thoraxCenter[1] + 120) / 240), seed: seed + 5, alpha: 0.45 });`);
swap(`angleAt: (px, py) => Math.atan2(py - thoraxCenter[1], px - thoraxCenter[0]) + Math.PI / 2, seed: seed + 6, alpha: 0.4 });`,
     `angleAt: (px, py) => angle + Math.PI / 2 + (px - thoraxCenter[0]) / 300, seed: seed + 6, alpha: 0.35 });`);
// Smaller fly, smaller eyes.
swap(`      compoundEye(context, eyeX, eyeY, 74 * scale, 88 * scale, angle + side * 0.25, seed + side);`, `      compoundEye(context, eyeX, eyeY, 60 * scale, 70 * scale, angle + side * 0.25, seed + side);`);
swap(`    fly(context, { x: 545, y: 440, angle: -0.38, scale: 1, seed: 21 });`, `    fly(context, { x: 560, y: 420, angle: -0.38, scale: 0.82, seed: 21 });`);
writeFileSync(path, text);
