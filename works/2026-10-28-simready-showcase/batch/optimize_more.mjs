// Second pass on an optimized glb: simplifies meshes within a tiny error and re-encodes geometry with meshopt.
// Textures are written back untouched, so they are not compressed twice.
// Usage: node optimize_more.mjs <input.glb> <output.glb> <error> <meshopt-level>   (prints one JSON line)
// <error> is the simplify error as a fraction of each mesh's size, for example 0.0001.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, simplify, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { measure } from './prototypes.mjs';

const [inputPath, outputPath, errorText, meshoptLevel] = process.argv.slice(2);
const simplifyError = Number(errorText);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const document = await io.read(inputPath);
const before = measure(document, fs.statSync(inputPath).size);
const steps = [dequantize(), weld()];
if (simplifyError > 0) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: simplifyError }));
steps.push(meshopt({ encoder: MeshoptEncoder, level: meshoptLevel }));
await document.transform(...steps);
await io.write(outputPath, document);
const after = measure(document, fs.statSync(outputPath).size);
console.log(JSON.stringify({ before, after }));
