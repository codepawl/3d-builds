import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
swap("eggPoint(egg, 1.6, 0), eggPoint(egg, 0, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.6, 0.35), [420, 760], [300, 860], [220, 920],",
     "eggPoint(egg, 1.6, 0), eggPoint(egg, 0, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.5, 0.15), [300, 760], [250, 850], [230, 920],");
swap("    const headDistance = lerp(startHead, startHead + 560, advance)",
     "    // Stop with the head at the yeast, never past the end of the path.\n    const headDistance = lerp(startHead, Math.min(startHead + 560, path.length - 40), advance)");
writeFileSync(path, text);
