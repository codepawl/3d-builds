import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
// A first instar larva is slender, about five to six times as long as wide.
swap("const body = bodyGeometry(path, headDistance, bodyLength, egg.halfWidth * 0.6, time, { crawling: !inside, swing });",
     "const body = bodyGeometry(path, headDistance, bodyLength, egg.halfWidth * 0.44, time, { crawling: !inside, swing });");
swap("const body = bodyGeometry(path, path.length, path.length, egg.halfWidth * 0.56, time, { swing });",
     "const body = bodyGeometry(path, path.length, path.length, egg.halfWidth * 0.5, time, { swing });");
// Flesh cells: rounded polygons with pale gaps between them and concentric rings inside, like Kevin's print.
swap(`    context.fillStyle = "#e6b873";
    context.fillRect(0, 0, SIZE, SIZE);`, `    context.fillStyle = "#f2dcaa";
    context.fillRect(0, 0, SIZE, SIZE);`);
swap(`        trace(context, polygon);
        context.fillStyle = tones[Math.floor(hash(row, column, 6) * tones.length)];
        context.fill();
        context.strokeStyle = "rgba(150,92,40,0.45)";
        context.lineWidth = 1.5;
        context.stroke();`, `        const shrunk = polygon.map(([pointX, pointY]) => [x + (pointX - x) * 0.86, y + (pointY - y) * 0.86]);
        context.lineJoin = "round";
        trace(context, shrunk);
        context.fillStyle = tones[Math.floor(hash(row, column, 6) * tones.length)];
        context.fill();
        context.strokeStyle = "rgba(140,84,36,0.7)";
        context.lineWidth = 2;
        context.stroke();
        [0.72, 0.5].forEach((ring, ringIndex) => {
          trace(context, shrunk.map(([pointX, pointY]) => [x + (pointX - x) * ring - radius * 0.06, y + (pointY - y) * ring - radius * 0.06]));
          context.strokeStyle = ringIndex ? "rgba(255,236,190,0.6)" : "rgba(170,105,45,0.35)";
          context.lineWidth = 1.4;
          context.stroke();
        });`);
writeFileSync(path, text);
