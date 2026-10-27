import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const from = `    const zoomIn = easeInOut(progress(time, 2.3, 3.2));
    const zoomOut = easeInOut(progress(time, 4.1, 4.7));
    const amount = zoomIn * (1 - zoomOut);
    const [focusX, focusY] = toScreen(CLOSE_FOCUS[0] + Math.max(0, time - 3.2) * 0.03, CLOSE_FOCUS[1]);
    return { scale: lerp(1, 3.2, amount), focusX: lerp(SIZE / 2, focusX, amount), focusY: lerp(SIZE / 2, focusY, amount), amount };`;
const to = `    // A slow push from the first frame, then a quick punch in to the surface, then back out for the stripes.
    const creep = easeInOut(progress(time, 0, 2.5)) * 0.25;
    const punch = easeOut(progress(time, 2.5, 2.8));
    const zoomOut = easeInOut(progress(time, 4.1, 4.7));
    const amount = Math.max(creep, punch) * (1 - zoomOut);
    const [focusX, focusY] = toScreen(CLOSE_FOCUS[0] + Math.max(0, time - 2.8) * 0.03, CLOSE_FOCUS[1]);
    return { scale: lerp(1, 3.2, amount), focusX: lerp(SIZE / 2, focusX, amount), focusY: lerp(SIZE / 2, focusY, amount), amount };`;
if (!text.includes(from)) {
  throw new Error("camera block not found");
}
writeFileSync(path, text.replace(from, to));
