// Copies the DISCS constant from the parts file in front of blueprintPupa, once.
import { readFileSync, writeFileSync } from "node:fs";

const [targetPath, partsPath] = process.argv.slice(2);
let target = readFileSync(targetPath, "utf8");
if (!target.includes("  const DISCS = [")) {
  const parts = readFileSync(partsPath, "utf8");
  const start = parts.indexOf("  const DISCS = [");
  const end = parts.indexOf("  ];", start) + "  ];\n".length;
  const at = target.indexOf("  function blueprintPupa(");
  target = target.slice(0, at) + parts.slice(start, end) + "\n" + target.slice(at);
  writeFileSync(targetPath, target);
  console.log("inserted DISCS");
}
