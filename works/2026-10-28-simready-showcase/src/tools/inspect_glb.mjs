// Prints the node tree of a glb: name, mesh bounding box, transform. Usage: node inspect_glb.mjs <file> [depth]
import { readFileSync } from 'node:fs';

const buffer = readFileSync(process.argv[2]);
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.slice(20, 20 + jsonLength).toString());
const maxDepth = Number(process.argv[3] ?? 3);
const format = (values) => values.map((value) => value.toFixed(2)).join(',');

function print(index, depth) {
  const node = gltf.nodes[index];
  const extra = [];
  if (node.mesh !== undefined) {
    const accessor = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
    extra.push(`mesh${node.mesh} min=${format(accessor.min)} max=${format(accessor.max)}`);
  }
  if (node.translation) extra.push(`t=${format(node.translation)}`);
  if (node.rotation) extra.push(`r=${format(node.rotation)}`);
  if (node.scale) extra.push(`s=${format(node.scale)}`);
  if (node.matrix) extra.push('matrix');
  console.log(`${' '.repeat(depth * 2)}[${index}] ${node.name} ${extra.join(' ')}`);
  if (depth < maxDepth) (node.children ?? []).forEach((child) => print(child, depth + 1));
}

gltf.scenes[gltf.scene ?? 0].nodes.forEach((root) => print(root, 0));
