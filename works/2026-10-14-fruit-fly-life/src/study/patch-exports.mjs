import { readFileSync, writeFileSync } from "node:fs";
const swapIn = (path, pairs) => {
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`not found in ${path}: ${from.slice(0, 60)}`);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
};
const root = process.argv[2];
swapIn(`${root}/src/fly.js`, [
  ["  return { frame };", "  return { frame, fly };"],
  ["  function wing(context, place, side, seed) {\n    const outline = wingOutline(side);",
   `  function wing(context, place, side, seed, spread = 1) {
    // A wing not yet expanded is a small crumpled pad near the hinge: shrink toward the hinge and add folds.
    const hingeX = side * 75;
    const hingeY = 60;
    const outline = wingOutline(side).map(([pointX, pointY], index) => {
      const crumple = (1 - spread) * Math.sin(index * 1.7) * 14;
      return [hingeX + (pointX - hingeX) * (0.45 + 0.55 * spread) + crumple, hingeY + (pointY - hingeY) * (0.3 + 0.7 * spread) + crumple * 0.6];
    });`],
  ["  function fly(context, { x, y, angle, scale = 1, seed = 1 }) {", "  function fly(context, { x, y, angle, scale = 1, seed = 1, wingSpread = 1 }) {"],
  ["wing(context, place, side, seed + side));", "wing(context, place, side, seed + side, wingSpread));"],
]);
swapIn(`${root}/src/larva.js`, [
  ["  return { renderAt, DURATION };", "  return { renderAt, DURATION, smoothPath, bodyGeometry, drawLarvaPaper, fruitFlesh, yeastCluster };"],
]);
