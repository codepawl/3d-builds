// Replaces whole top-level functions inside the Fly module of src/fly.js with the versions in a parts file.
// A function runs from "  function <name>(" to the first line that is exactly "  }" after it.
//   node study/replace-functions.mjs src/fly.js study/fly-strokes.js
import { readFileSync, writeFileSync } from "node:fs";

const [targetPath, partsPath] = process.argv.slice(2);
let target = readFileSync(targetPath, "utf8");
const parts = readFileSync(partsPath, "utf8");

function functionSpans(text) {
  const spans = new Map();
  const pattern = /^ {2}function (\w+)\(/gm;
  let match;
  while ((match = pattern.exec(text))) {
    const end = text.indexOf("\n  }\n", match.index);
    spans.set(match[1], { start: match.index, end: end + "\n  }\n".length });
  }
  return spans;
}

const replacements = functionSpans(parts);
for (const [name, span] of replacements) {
  const current = functionSpans(target).get(name);
  if (!current) {
    throw new Error(`function ${name} not found in ${targetPath}`);
  }
  target = target.slice(0, current.start) + parts.slice(span.start, span.end) + target.slice(current.end);
  console.log(`replaced ${name}`);
}
writeFileSync(targetPath, target);
