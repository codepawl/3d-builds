// Builds web/data/totals.json (set totals) and web/data/set.json (the models shown in the "whole set" beat) from the
// batch manifest, and copies those models into web/models/set/. Reads the batch output (BATCH_OUT), never writes there.
// Usage: node tools/totals.mjs [maxModels]   (default 16)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_OUT = process.env.BATCH_OUT ?? 'batch-out/out';
const SET_ASSET_COUNT = 2595; // asset folders in huggingface.co/datasets/nvidia/simready-assets
const maxModels = Number(process.argv[2] ?? 16);

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim()).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

const byAsset = new Map();
for (const row of readJsonLines(join(BATCH_OUT, 'manifest.jsonl'))) byAsset.set(row.asset, row);
const rows = [...byAsset.values()].filter((row) => row.source?.folderBytes && row.optimized?.bytes);
// Failures that a later retry fixed are in the manifest too, so only the ones still missing count.
const failedAssets = new Set(readJsonLines(join(BATCH_OUT, 'failures.jsonl')).map((row) => row.asset));
const failed = [...failedAssets].filter((asset) => !byAsset.has(asset)).length;

// "Before" is the Blender glb, the same format as the result. The listed folder sizes add up to about 470 GB, but
// the folders share texture files and the Hub stores 80.7 GB, so a folder total would overstate the saving.
const sourceBytes = rows.reduce((sum, row) => sum + row.blender.bytes, 0);
const optimizedBytes = rows.reduce((sum, row) => sum + row.optimized.bytes, 0);
const ratios = rows.map((row) => row.blender.bytes / row.optimized.bytes).sort((a, b) => a - b);
const middle = Math.floor(ratios.length / 2);
const medianRatio = ratios.length === 0 ? 0 : ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;

const totals = {
  generatedAt: new Date().toISOString(),
  setAssetCount: SET_ASSET_COUNT,
  optimizedCount: rows.length,
  failedCount: failed,
  sourceGB: sourceBytes / 1e9,
  optimizedGB: optimizedBytes / 1e9,
  medianRatio,
  complete: rows.length + failed >= SET_ASSET_COUNT,
};
mkdirSync(join(root, 'web', 'data'), { recursive: true });
writeFileSync(join(root, 'web', 'data', 'totals.json'), JSON.stringify(totals, null, 2));

// The set beat: models that fit a cell without shrinking below about 260 px tall (the film fits each model into a
// 275 px wide cell at 270 px per unit of height, seen from yaws 20 to 36 degrees), skipping tiny and flat assets.
// One asset per category first, preferring the largest triangle counts, then the next best of any category, up to maxModels.
const MIN_LARGEST_EDGE_METERS = 0.3;
const MIN_FLATNESS = 0.12; // smallest edge / largest edge below this is a flat box
const MAX_WIDTH_OVER_HEIGHT = 1.05; // widest view of the box over its height
const VIEW_YAWS_DEGREES = [20, 28, 36];
function dimensionsOf(row) {
  const size = row.bounds.max.map((value, axis) => value - row.bounds.min[axis]);
  return { largest: Math.max(...size), smallest: Math.min(...size), width: size[0], height: size[1], depth: size[2] };
}
function widestViewOverHeight({ width, height, depth }) {
  const views = VIEW_YAWS_DEGREES.map((degrees) => {
    const yaw = (degrees * Math.PI) / 180;
    return width * Math.cos(yaw) + depth * Math.sin(yaw);
  });
  return Math.max(...views) / height;
}
const candidates = rows.filter((row) => {
  if (!row.bounds || !existsSync(join(BATCH_OUT, 'glb', `${row.asset}.glb`))) return false;
  const dimensions = dimensionsOf(row);
  if (dimensions.largest < MIN_LARGEST_EDGE_METERS || dimensions.smallest / dimensions.largest < MIN_FLATNESS) return false;
  return widestViewOverHeight(dimensions) <= MAX_WIDTH_OVER_HEIGHT;
}).sort((a, b) => b.optimized.triangles - a.optimized.triangles);
const seenCategories = new Set();
const chosen = [];
for (const row of candidates) {
  const category = row.asset.split('_')[0];
  if (seenCategories.has(category)) continue;
  seenCategories.add(category);
  chosen.push(row);
}
for (const row of candidates) {
  if (chosen.length >= maxModels) break;
  if (!chosen.includes(row)) chosen.push(row);
}
chosen.splice(maxModels);

const setFolder = join(root, 'web', 'models', 'set');
mkdirSync(setFolder, { recursive: true });
for (const stale of readdirSync(setFolder)) rmSync(join(setFolder, stale));
const models = [];
for (const row of chosen) {
  copyFileSync(join(BATCH_OUT, 'glb', `${row.asset}.glb`), join(setFolder, `${row.asset}.glb`));
  models.push({
    asset: row.asset, category: row.asset.split('_')[0], file: `models/set/${row.asset}.glb`,
    folderBytes: row.source.folderBytes, optimizedBytes: row.optimized.bytes, triangles: row.optimized.triangles,
  });
}
writeFileSync(join(root, 'web', 'data', 'set.json'), JSON.stringify({ models }, null, 2));
console.log(JSON.stringify(totals), 'models', models.length, models.map((model) => model.asset).join(' '));
