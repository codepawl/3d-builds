import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
// Blueprint: keep the larva inside the shell.
swap("    const path = makePath([eggPoint(egg, 0.95, 0), eggPoint(egg, -0.92, 0)]);\n    const swing",
     "    const path = makePath([eggPoint(egg, 0.86, 0), eggPoint(egg, -0.84, 0)]);\n    const swing");
swap("const body = bodyGeometry(path, path.length, path.length * 0.98, egg.halfWidth * 0.62, time, { swing });",
     "const body = bodyGeometry(path, path.length, path.length, egg.halfWidth * 0.56, time, { swing });");
// Paper: start the path behind the tail so it is never clamped, and crawl all the way out toward the yeast.
swap(`      eggPoint(egg, 0.92, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.4, 0.25), eggPoint(egg, -1.9, 0.9), [300, 840],`,
     `      eggPoint(egg, 1.6, 0), eggPoint(egg, -0.9, 0), eggPoint(egg, -1.4, 0.25), eggPoint(egg, -1.9, 0.9), [300, 840], [200, 900],`);
swap("    const bodyLength = egg.halfLength * 2 * 0.95;\n    const startHead = makePath([eggPoint(egg, 0.92, 0), eggPoint(egg, -0.9, 0)]).length;",
     "    const bodyLength = egg.halfLength * 2 * 0.86;\n    const startHead = makePath([eggPoint(egg, 1.6, 0), eggPoint(egg, -0.84, 0)]).length;");
swap("    const crawlOut = progress(local, 1.8, 3.4);", "    const crawlOut = progress(local, 1.8, 3.8);");
swap("    const headDistance = lerp(startHead, startHead + 300, advance)", "    const headDistance = lerp(startHead, startHead + 560, advance)");
writeFileSync(path, text);
