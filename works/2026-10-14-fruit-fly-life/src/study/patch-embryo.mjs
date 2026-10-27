import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
let text = readFileSync(path, "utf8");
const swap = (from, to) => {
  if (!text.includes(from)) {
    throw new Error(`not found: ${from.slice(0, 70)}`);
  }
  text = text.replace(from, to);
};
// Drop the old appendage drawing inside shell(); dorsalAppendages() replaces it.
const start = text.indexOf("    // Dorsal appendages: two filaments");
const end = text.indexOf("    // Scale bar: 100 µm.");
text = text.slice(0, start) + "    dorsalAppendages(context);\n" + text.slice(end);
// Pole cells sit inside the shell at the posterior pole.
swap("const [x, y] = toScreen(1.0 + 0.05 * easeOut(pole) + Math.cos(turn) * 0.04, Math.sin(turn) * 0.32);",
     "const [x, y] = toScreen(0.9 + Math.cos(turn) * 0.035, Math.sin(turn) * 0.3);");
writeFileSync(path, text);
