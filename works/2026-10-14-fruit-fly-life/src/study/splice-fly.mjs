// Replaces the wing and fly functions in src/fly.js with study/fly-body.js and sets the measured placement.
import { readFileSync, writeFileSync } from "node:fs";
const [sourcePath, bodyPath] = process.argv.slice(2);
const source = readFileSync(sourcePath, "utf8");
const start = source.indexOf("  // A wing:");
const end = source.indexOf("  function frame(context) {");
if (start < 0 || end < 0) {
  throw new Error("markers not found");
}
let result = source.slice(0, start) + readFileSync(bodyPath, "utf8") + source.slice(end);
result = result.replace(/    fly\(context, \{ x: \d+, y: \d+, angle: -?[\d.]+, scale: [\d.]+, seed: 21 \}\);/, "    fly(context, { x: 495, y: 385, angle: -0.41, scale: 1, seed: 21 });");
writeFileSync(sourcePath, result);
