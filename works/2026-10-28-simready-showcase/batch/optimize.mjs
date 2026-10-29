// Optimizes one Blender glb for the web and reports what each step changed.
// Usage: node optimize.mjs <input.glb> <output.glb> <max_texture_edge>   (prints one JSON line)
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { measure, removePrototypeRoots } from './prototypes.mjs';

const [inputPath, outputPath, maxTextureEdgeText] = process.argv.slice(2);
const maxTextureEdge = Number(maxTextureEdgeText);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// USD reference copies come through as a second node holding the same mesh at the same place.
function removeDuplicateInstances(document) {
  const seen = new Set();
  let removed = 0;
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const key = mesh.getName() + '|' + node.getWorldMatrix().map((value) => value.toFixed(5)).join(',');
    if (seen.has(key)) {
      node.setMesh(null);
      removed += 1;
    } else {
      seen.add(key);
    }
  }
  return removed;
}

const document = await io.read(inputPath);
const before = measure(document, fs.statSync(inputPath).size);
const prototypesRemoved = removePrototypeRoots(document).length;
const duplicateNodesRemoved = removeDuplicateInstances(document);

await document.transform(
  dedup(),
  prune(),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTextureEdge, maxTextureEdge] }),
  // 'high' adds the meshopt filters (octahedral normals and the like): 22% smaller than 'medium' on a 49 asset
  // sample with no visible change in the thumbnails (2026-10-29).
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

await io.write(outputPath, document);
const after = measure(document, fs.statSync(outputPath).size);
const bounds = getBounds(document.getRoot().listScenes()[0]);
console.log(JSON.stringify({ prototypesRemoved, duplicateNodesRemoved, before, after, bounds }));
