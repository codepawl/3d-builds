// Measures the optimization one cumulative step at a time (same steps and order as optimize.mjs).
// Usage: node stages.mjs <input.glb> <output.json> <max_texture_edge>
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inputPath, outputPath, edgeText] = process.argv.slice(2);
const maxTextureEdge = Number(edgeText);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function measure(document, label) {
  const root = document.getRoot();
  let triangles = 0;
  let drawCalls = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      triangles += (indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount()) / 3;
      drawCalls += 1;
    }
  }
  let largestTextureEdge = 0;
  for (const texture of root.listTextures()) {
    const size = texture.getSize();
    if (size) largestTextureEdge = Math.max(largestTextureEdge, size[0], size[1]);
  }
  const bytes = (await io.writeBinary(document)).byteLength;
  return { label, bytes, triangles: Math.round(triangles), drawCalls, textures: root.listTextures().length, largestTextureEdge };
}

function removeDuplicateInstances(document) {
  const seen = new Set();
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const key = mesh.getName() + '|' + node.getWorldMatrix().map((value) => value.toFixed(5)).join(',');
    if (seen.has(key)) node.setMesh(null);
    else seen.add(key);
  }
}

const document = await io.read(inputPath);
const stages = [{ ...(await measure(document, 'blender')), bytes: fs.statSync(inputPath).size }];
removeDuplicateInstances(document);
await document.transform(dedup(), prune());
stages.push(await measure(document, 'instances'));
await document.transform(weld());
stages.push(await measure(document, 'weld'));
await document.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTextureEdge, maxTextureEdge] }));
stages.push(await measure(document, 'textures'));
await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
stages.push(await measure(document, 'meshopt'));
fs.writeFileSync(outputPath, JSON.stringify({ input: inputPath, stages }, null, 2));
console.log(JSON.stringify(stages));
