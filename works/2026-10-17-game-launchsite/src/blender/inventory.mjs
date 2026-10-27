// Lists every GLB in app/public/assets: size, root nodes and their named children (moving parts, anchors).
// Usage: node blender/inventory.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "public", "assets");
let total = 0;
for (const file of readdirSync(assets).filter((name) => name.endsWith(".glb"))) {
  const buffer = readFileSync(join(assets, file));
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString("utf8"));
  const size = statSync(join(assets, file)).size;
  total += size;
  console.log(`\n${file} ${(size / 1048576).toFixed(2)} MB`);
  const roots = json.scenes[0].nodes;
  const describe = (index, depth) => {
    const node = json.nodes[index];
    const children = node.children || [];
    if (depth > 0 && !node.name.endsWith("_body") && !node.name.endsWith("_frame")) {
      console.log(`${"  ".repeat(depth)}${node.name} at [${(node.translation || [0, 0, 0]).map((v) => v.toFixed(2)).join(", ")}]`);
    }
    children.forEach((child) => describe(child, depth + 1));
  };
  for (const index of roots) {
    console.log(`- ${json.nodes[index].name}`);
    describe(index, 0);
  }
}
console.log(`\ntotal ${(total / 1048576).toFixed(2)} MB`);
