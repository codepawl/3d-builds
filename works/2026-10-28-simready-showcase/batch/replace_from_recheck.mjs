// Swaps in re-exported glbs that carry more geometry than the published ones.
// Blender's own UDIM handling in the glTF exporter dropped the faces of some tiles (crate_plywood_b01 kept 1,776 of
// 25,110 triangles). usd_to_glb.py now splits UDIM tiles itself, so assets re-run through run.mjs come out whole.
// Usage: node replace_from_recheck.mjs <recheck-out> <out> [--dry-run]
// For each asset in <recheck-out>/manifest.jsonl with more optimized triangles than <out>/manifest.jsonl: the old glb
// goes to <out>/../glb_before_udim_fix, the new glb and manifest row replace it, and its thumbnail is deleted so
// render_thumbs.mjs draws it again. Assets that did not gain triangles are left alone.
import fs from 'node:fs';
import path from 'node:path';

const [recheckFolder, outputFolder] = process.argv.slice(2);
const dryRun = process.argv.includes('--dry-run');
const backupFolder = path.join(outputFolder, '..', 'glb_before_udim_fix');
const manifestPath = path.join(outputFolder, 'manifest.jsonl');

function readManifest(file) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return new Map(rows.map((row) => [row.asset, row]));
}

const published = readManifest(manifestPath);
const rechecked = readManifest(path.join(recheckFolder, 'manifest.jsonl'));
fs.mkdirSync(backupFolder, { recursive: true });

const replaced = [];
for (const [asset, newRow] of rechecked) {
  const oldRow = published.get(asset);
  const oldTriangles = oldRow.optimized.triangles;
  const newTriangles = newRow.optimized.triangles;
  console.log(`${newTriangles > oldTriangles ? 'replace' : 'keep   '} ${asset} ${oldTriangles} -> ${newTriangles}`);
  if (newTriangles <= oldTriangles || dryRun) continue;

  const glbName = `${asset}.glb`;
  const publishedGlb = path.join(outputFolder, 'glb', glbName);
  const backupGlb = path.join(backupFolder, glbName);
  if (!fs.existsSync(backupGlb)) fs.copyFileSync(publishedGlb, backupGlb);
  fs.copyFileSync(path.join(recheckFolder, 'glb', glbName), publishedGlb);
  fs.rmSync(path.join(outputFolder, 'thumbs', `${asset}.webp`), { force: true });
  published.set(asset, newRow);
  replaced.push(asset);
}

if (!dryRun && replaced.length > 0) {
  fs.writeFileSync(manifestPath, [...published.values()].map((row) => JSON.stringify(row)).join('\n') + '\n');
}
console.log(`${replaced.length} replaced of ${rechecked.size} rechecked${dryRun ? ' (dry run)' : ''}`);
