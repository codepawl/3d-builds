import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
// Clip costal and vertebral scutes to the inner ring so none spill over the marginals.
text = text.replace(`    scutes.forEach(({ polygon, tone }, index) => {
      context.fillStyle`, `    context.save();
    tracePath(context, place(outlinePoints(INNER)));
    context.clip();
    scutes.forEach(({ polygon, tone }, index) => {
      context.fillStyle`);
text = text.replace(`    context.lineWidth = 2.6;
    scutes.forEach(({ polygon }, index) => {
      wobblyPath(context, place(polygon), { closed: true, wobble: 0.7, seed: seed * 13 + index });
      context.stroke();
    });`, `    context.lineWidth = 2.6;
    scutes.forEach(({ polygon }, index) => {
      wobblyPath(context, place(polygon), { closed: true, wobble: 0.7, seed: seed * 13 + index });
      context.stroke();
    });
    context.restore();`);
writeFileSync(path, text);
