// Moves the glbs written by add_physics.mjs into the published set and records their physics in manifest.jsonl.
// Usage: node apply_physics.mjs <out-folder> <physics-folder> [--dry-run]
//   <out-folder> holds glb/ and manifest.jsonl; <physics-folder> holds glb/ and report.jsonl from add_physics.mjs.
//   Each replaced glb is first moved to <out-folder>/../glb_before_physics. Assets without physics keep their file.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outFolder, physicsFolder] = process.argv.slice(2);
const dryRun = process.argv.includes('--dry-run');
const backupFolder = join(outFolder, '..', 'glb_before_physics');
const manifestPath = join(outFolder, 'manifest.jsonl');

const reports = new Map(readFileSync(join(physicsFolder, 'report.jsonl'), 'utf8').split('\n').filter(Boolean)
  .map((line) => JSON.parse(line)).map((row) => [row.asset, row]));
const rows = readFileSync(manifestPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));

if (!dryRun) mkdirSync(backupFolder, { recursive: true });
let replaced = 0;
let addedBytes = 0;
const failed = [];
for (const row of rows) {
  const report = reports.get(row.asset);
  if (!report || report.error) {
    failed.push(row.asset);
    continue;
  }
  row.physics = { rigidBodies: report.bodies, joints: report.joints, colliders: report.colliders };
  const physicsGlb = join(physicsFolder, 'glb', `${row.asset}.glb`);
  if (report.skipped || !existsSync(physicsGlb)) continue;
  const publishedGlb = join(outFolder, 'glb', `${row.asset}.glb`);
  const newBytes = statSync(physicsGlb).size;
  addedBytes += newBytes - row.optimized.bytes;
  row.optimized.bytes = newBytes;
  replaced += 1;
  if (dryRun) continue;
  if (!existsSync(join(backupFolder, `${row.asset}.glb`))) renameSync(publishedGlb, join(backupFolder, `${row.asset}.glb`));
  copyFileSync(physicsGlb, publishedGlb);
}

if (!dryRun) writeFileSync(manifestPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
console.log(JSON.stringify({ replaced, addedBytes, failed: failed.length, firstFailed: failed.slice(0, 5), dryRun }));
