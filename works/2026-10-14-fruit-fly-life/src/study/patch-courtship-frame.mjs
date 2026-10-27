// Keep the camera inside the drawn table, and extend the wing on her side.
import { readFileSync, writeFileSync } from "node:fs";

const path = `${process.argv[2]}/src/adult.js`;
let text = readFileSync(path, "utf8");
function replace(from, to) {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
}
replace(`    context.save();
    context.translate(540, 540);
    context.scale(scale, scale);
    context.translate(-focusX, -focusY);
    aerialBackground(context);`, `    // The view never leaves the drawn table: clamp the focus by half the visible width.
    const halfView = 540 / scale;
    const viewX = clamp(focusX, halfView, SIZE - halfView);
    const viewY = clamp(focusY, halfView, SIZE - halfView);
    context.save();
    context.translate(540, 540);
    context.scale(scale, scale);
    context.translate(-viewX, -viewY);
    aerialBackground(context);`);
replace("* maleRight[1] > 0 ? 1 : -1;", "* maleRight[1] > 0 ? -1 : 1;");
writeFileSync(path, text);
