// Turns beat 4 into a montage: the old renderAt becomes story(), darker case, burst on the cap, new shots appended.
import { readFileSync, writeFileSync } from "node:fs";

const [path, partsPath] = process.argv.slice(2);
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 60)}`);
  }
  text = text.replace(from, to);
};
swap("  function renderAt(context, time) {\n    Ink.setTime(time);\n    // The closing push",
  "  // The continuous story, in story seconds. The montage below cuts between it and other angles.\n  function story(context, time, { inside = true } = {}) {\n    // The closing push");
swap("    const flyInside = progress(time, 4.2, 5.4);", "    const flyInside = inside ? progress(time, 4.2, 5.4) : 0;");
swap("[176, 112, 52], brown);", "[122, 64, 30], brown);");
swap("    // The cap at the head end pops open on a hinge.\n    if (capOpen > 0) {", [
  "    // The cap at the head end pops open on a hinge, with burst lines and crumbs.",
  "    if (capOpen > 0 && capOpen < 1) {",
  "      const [tipX, tipY] = along(PUPA_HALF_LENGTH * 1.05);",
  "      context.strokeStyle = NAVY;",
  "      context.lineWidth = 2;",
  "      context.beginPath();",
  "      for (let ray = 0; ray < 12; ray += 1) {",
  "        const angle = HEAD_DIRECTION + (ray / 11 - 0.5) * 2.4;",
  "        const inner = 30 + capOpen * 30;",
  "        const outer = inner + 26 * (1 - capOpen);",
  "        context.moveTo(tipX + Math.cos(angle) * inner, tipY + Math.sin(angle) * inner);",
  "        context.lineTo(tipX + Math.cos(angle) * outer, tipY + Math.sin(angle) * outer);",
  "      }",
  "      context.stroke();",
  "      context.fillStyle = \"#2a1608\";",
  "      for (let crumb = 0; crumb < 14; crumb += 1) {",
  "        const angle = HEAD_DIRECTION + (hash(crumb, 2) - 0.5) * 2.6;",
  "        const distance = 20 + capOpen * (60 + hash(crumb, 3) * 90);",
  "        context.beginPath();",
  "        context.arc(tipX + Math.cos(angle) * distance, tipY + Math.sin(angle) * distance, 2 + hash(crumb, 4) * 3, 0, Math.PI * 2);",
  "        context.fill();",
  "      }",
  "    }",
  "    if (capOpen > 0) {",
].join("\n"));
swap("  return { renderAt, DURATION };\n", readFileSync(partsPath, "utf8"));
writeFileSync(path, text);
