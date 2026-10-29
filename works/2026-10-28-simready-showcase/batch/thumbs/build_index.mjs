// Builds the two indexes that sit next to the files on Hugging Face, from manifest.jsonl:
//   <thumbDir>/metadata.jsonl  one row per thumbnail, read by the dataset viewer (image + flat stats columns)
//   <spaceDir>/assets.json     compact list the 3D viewer Space searches and browses
// Usage: node build_index.mjs <manifest.jsonl> <thumbDir> <spaceDir>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [manifestPath, thumbFolder, spaceFolder] = process.argv.slice(2);
const MEGABYTE = 1024 * 1024;

/** First word of the asset name, "handTool_hammer_a01" -> "handTool". */
function categoryOf(assetName) {
  return assetName.split('_')[0];
}

function megabytes(bytes) {
  return Math.round((bytes / MEGABYTE) * 100) / 100;
}

const entries = readFileSync(manifestPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
entries.sort((first, second) => first.asset.localeCompare(second.asset));

// Columns: name, blender bytes, optimized bytes, blender triangles, optimized triangles, blender draw calls,
// optimized draw calls, textures, blender largest texture edge, joints. Arrays keep the file a few hundred KB.
const spaceAssets = entries.map((entry) => [
  entry.asset,
  entry.blender.bytes,
  entry.optimized.bytes,
  entry.blender.triangles,
  entry.optimized.triangles,
  entry.blender.drawCalls,
  entry.optimized.drawCalls,
  entry.optimized.textures,
  entry.blender.largestTextureEdge,
  entry.physics?.joints ?? 0,
]);
writeFileSync(join(spaceFolder, 'assets.json'), JSON.stringify(spaceAssets));
console.log(`${entries.length} assets -> assets.json`);

// The viewer index must not point at thumbnails that are not there, so it waits for a complete set.
const missingThumbnails = entries.filter((entry) => !existsSync(join(thumbFolder, `${entry.asset}.webp`)));
if (missingThumbnails.length > 0) {
  console.error(`metadata.jsonl not written, ${missingThumbnails.length} thumbnails missing, first: ${missingThumbnails[0].asset}`);
  process.exit(1);
}

const viewerRows = entries.map((entry) => JSON.stringify({
  file_name: `${entry.asset}.webp`,
  asset: entry.asset,
  category: categoryOf(entry.asset),
  glb: `glb/${entry.asset}.glb`,
  size_mb: megabytes(entry.optimized.bytes),
  blender_size_mb: megabytes(entry.blender.bytes),
  times_smaller: Math.round((entry.blender.bytes / entry.optimized.bytes) * 10) / 10,
  triangles: entry.optimized.triangles,
  draw_calls: entry.optimized.drawCalls,
  textures: entry.optimized.textures,
  rigid_bodies: entry.physics?.rigidBodies ?? 0,
  joints: entry.physics?.joints ?? 0,
  license: 'CC-BY-4.0',
}));
writeFileSync(join(thumbFolder, 'metadata.jsonl'), `${viewerRows.join('\n')}\n`);
console.log(`${entries.length} rows -> metadata.jsonl`);
