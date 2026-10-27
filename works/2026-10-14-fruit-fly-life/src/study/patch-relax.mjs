import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
// The first surface layer: an even hexagonal sheet over the egg instead of the sunflower spiral.
swap("    const generations = [interiorLayout(128).map(([u, v]) => [u * 1.42, v * 1.12])];",
     `    const sheet = [];
    for (let row = -8; row <= 8; row += 1) {
      for (let column = -14; column <= 14; column += 1) {
        const point = [column * 0.075 + (row % 2) * 0.0375, row * 0.2];
        if (insideShell(...point)) {
          sheet.push(point);
        }
      }
    }
    const generations = [relax(sheet.slice(0, 128), 60)];`);
swap("      generations.push(next);", "      generations.push(relax(next, 60 / Math.SQRT2 ** level));");
writeFileSync(path, text);
