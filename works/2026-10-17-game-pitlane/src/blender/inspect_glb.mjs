// Print each GLB's size, root nodes with their direct children, animation clips, triangle count.
// Usage: node blender/inspect_glb.mjs [file.glb ...]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "public", "assets");
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(ASSETS).filter((name) => name.endsWith(".glb")).map((name) => join(ASSETS, name));
let total = 0;
for (const file of files) {
  const buffer = readFileSync(file);
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const size = statSync(file).size;
  total += size;
  let triangles = 0;
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives) {
      triangles += primitive.indices !== undefined ? gltf.accessors[primitive.indices].count / 3 : 0;
    }
  }
  console.log(`\n## ${file.split(/[\/]/).pop()}  ${(size / 1024).toFixed(0)} KB, ${triangles} triangles, ${(gltf.materials || []).length} materials`);
  for (const rootIndex of gltf.scenes[0].nodes) {
    const node = gltf.nodes[rootIndex];
    const children = (node.children || []).map((index) => gltf.nodes[index].name);
    console.log(`- ${node.name}: ${children.join(", ")}`);
  }
  const clips = (gltf.animations || []).map((animation) => animation.name);
  if (clips.length) console.log(`- clips: ${clips.join(", ")}`);
}
console.log(`\ntotal ${(total / 1024 / 1024).toFixed(2)} MB`);
