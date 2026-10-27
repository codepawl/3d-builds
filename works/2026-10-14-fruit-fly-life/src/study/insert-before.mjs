// Inserts a function that does not exist yet just before another function: node insert-before.mjs <file> <before> <parts> <name>
import { readFileSync, writeFileSync } from "node:fs";
const [targetPath, beforeName, partsPath, name] = process.argv.slice(2);
const target = readFileSync(targetPath, "utf8");
if (target.includes(`  function ${name}(`)) {
  process.exit(0);
}
const parts = readFileSync(partsPath, "utf8");
const start = parts.indexOf(`  function ${name}(`);
const end = parts.indexOf("\n  }\n", start) + "\n  }\n".length;
const at = target.indexOf(`  function ${beforeName}(`);
writeFileSync(targetPath, target.slice(0, at) + parts.slice(start, end) + "\n" + target.slice(at));
console.log(`inserted ${name}`);
