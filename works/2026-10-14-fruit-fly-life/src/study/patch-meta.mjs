import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
};
// While climbing out, draw the fly first so the case covers the part still inside; once free, draw it on top.
swap(`    if (pupaShows > 0) {
      context.save();`, `    const [outX, outY] = along(PUPA_HALF_LENGTH * 0.25 + climb * 2.4 * PUPA_HALF_LENGTH);
    const wiggle = Math.sin(time * 24) * 4 * (1 - progress(time, 6.4, 6.7));
    const stillInside = climb > 0 && climb < 0.75;
    if (stillInside) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale });
    }
    if (pupaShows > 0) {
      context.save();`);
swap(`    if (climb > 0) {
      const [outX, outY] = along(PUPA_HALF_LENGTH * 0.25 + climb * 2.4 * PUPA_HALF_LENGTH);
      // Wriggle while pulling free.
      const wiggle = Math.sin(time * 24) * 4 * (1 - progress(time, 6.4, 6.7));
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale });
    }`, `    if (climb >= 0.75) {
      drawFly(context, time, { x: outX + wiggle, y: outY, spread, pale });
    }`);
writeFileSync(path, text);
