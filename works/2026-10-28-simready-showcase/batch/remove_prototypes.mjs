// Repairs already-optimized glbs that still carry leftover USD instance prototypes (see prototypes.mjs), and refreshes
// their manifest.jsonl rows. optimize.mjs removes them itself since 2026-10-29; this fixes the files made before.
//
// A prototype shares its mesh with the placed node, so removing it only touches the glb's JSON chunk: the node is
// dropped and the other node indices are renumbered. The binary chunk is copied unchanged, nothing is re-encoded.
// Usage: node remove_prototypes.mjs <outFolder> [--only a,b] [--backup <folder>] [--dry-run]
//   <outFolder> holds glb/ and manifest.jsonl. Each changed glb is first copied to the backup folder
//   (default <outFolder>/../glb_before_prototype_fix).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGlb, writeGlb, multiply, localMatrix, baseName } from './glb_json.mjs';

function readArgument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function matrixKey(matrix) {
  return matrix.map((value) => value.toFixed(5)).join(',');
}

// ---------- the same rule as prototypes.mjs, on raw glTF JSON ----------

/**
 * Scene-root nodes with a mesh and no children whose mesh a nested node also uses.
 *
 * Files from before the fix went through optimize.mjs's duplicate removal, which emptied whichever of two copies at
 * the same place it met second. Where that emptied the placed node and kept the prototype, the prototype is the
 * only copy of that part: its mesh is handed back to the empty placed node (same name, same place) before it goes.
 * Returns [{ prototype, heir }] with heir undefined when nothing needs handing back.
 */
function findPrototypeRoots(gltf) {
  const scene = gltf.scenes[gltf.scene ?? 0];
  const rootNodes = new Set(scene.nodes);
  const nestedMeshes = new Set();
  const emptyNestedByPlace = new Map(); // "base name|world matrix" -> node index
  function walk(nodeIndex, parentMatrix) {
    const node = gltf.nodes[nodeIndex];
    const world = multiply(parentMatrix, localMatrix(node));
    if (!rootNodes.has(nodeIndex)) {
      if (node.mesh !== undefined) nestedMeshes.add(node.mesh);
      else if (!(node.children?.length > 0)) emptyNestedByPlace.set(`${baseName(node.name)}|${matrixKey(world)}`, nodeIndex);
    }
    for (const child of node.children ?? []) walk(child, world);
  }
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const root of scene.nodes) walk(root, identity);

  const found = [];
  for (const index of scene.nodes) {
    const node = gltf.nodes[index];
    if (node.mesh === undefined || node.children?.length > 0 || !nestedMeshes.has(node.mesh)) continue;
    const place = `${baseName(node.name)}|${matrixKey(localMatrix(node))}`;
    found.push({ prototype: index, heir: emptyNestedByPlace.get(place) });
  }
  return found;
}

/** Deletes nodes and renumbers every node reference this dataset's files can hold. */
function deleteNodes(gltf, doomed) {
  const doomedSet = new Set(doomed);
  const newIndex = new Map();
  const keptNodes = [];
  gltf.nodes.forEach((node, index) => {
    if (doomedSet.has(index)) return;
    newIndex.set(index, keptNodes.length);
    keptNodes.push(node);
  });
  const remap = (indices) => indices.filter((index) => newIndex.has(index)).map((index) => newIndex.get(index));
  gltf.nodes = keptNodes;
  for (const scene of gltf.scenes) scene.nodes = remap(scene.nodes);
  for (const node of gltf.nodes) {
    if (node.children) node.children = remap(node.children);
  }
  if (gltf.skins?.length || gltf.animations?.length) throw new Error('skins or animations are not handled');
}

/** The same numbers optimize.mjs records, counted over the nodes still in the file. */
function measureJson(gltf, bytes, previous) {
  let triangles = 0;
  let drawCalls = 0;
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION];
      triangles += accessor.count / 3;
      drawCalls += 1;
    }
  }
  return {
    bytes,
    triangles: Math.round(triangles),
    drawCalls,
    textures: gltf.textures?.length ?? 0,
    largestTextureEdge: previous.largestTextureEdge,
  };
}

const outFolder = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const manifestPath = join(outFolder, 'manifest.jsonl');
const backupFolder = readArgument('--backup') ?? join(outFolder, '..', 'glb_before_prototype_fix');
mkdirSync(backupFolder, { recursive: true });

const rows = readFileSync(manifestPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const only = readArgument('--only')?.split(',');
let changedCount = 0;
let handedBackCount = 0;

for (const row of rows) {
  if (only && !only.includes(row.asset)) continue;
  const glbPath = join(outFolder, 'glb', `${row.asset}.glb`);
  const { gltf, rest } = readGlb(glbPath);
  const prototypes = findPrototypeRoots(gltf);
  if (prototypes.length === 0) continue;
  changedCount += 1;
  const heirs = prototypes.filter((found) => found.heir !== undefined);
  handedBackCount += heirs.length;
  if (heirs.length > 0) console.log(`${row.asset}: ${heirs.length} meshes handed back to their placed node`);
  if (dryRun) continue;

  const backupPath = join(backupFolder, `${row.asset}.glb`);
  if (!existsSync(backupPath)) copyFileSync(glbPath, backupPath);
  for (const { prototype, heir } of heirs) gltf.nodes[heir].mesh = gltf.nodes[prototype].mesh;
  deleteNodes(gltf, prototypes.map((found) => found.prototype));
  writeGlb(glbPath, gltf, rest);

  const repaired = readGlb(glbPath);
  if (findPrototypeRoots(repaired.gltf).length > 0) throw new Error(`${row.asset}: prototypes left after repair`);
  row.optimized = measureJson(repaired.gltf, readFileSync(glbPath).length, row.optimized);
  row.prototypesRemoved = prototypes.length;
}

if (!dryRun) writeFileSync(manifestPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
console.log(`${changedCount} files ${dryRun ? 'would change' : 'changed'}, ${handedBackCount} meshes handed back`);
