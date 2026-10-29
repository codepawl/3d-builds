// Runs optimize_more.mjs over a list of assets for one setting and sums the result.
// Usage: node trial_more.mjs <asset-list.txt> <glb-folder> <out-folder> <error> <meshopt-level>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setPriority, constants as osConstants } from 'node:os';
import { fileURLToPath } from 'node:url';

setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL);
const [listPath, glbFolder, outFolder, errorText, meshoptLevel] = process.argv.slice(2);
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'optimize_more.mjs');
const assets = fs.readFileSync(listPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
fs.mkdirSync(outFolder, { recursive: true });

const totals = { bytesBefore: 0, bytesAfter: 0, trianglesBefore: 0, trianglesAfter: 0 };
const startedAt = Date.now();
for (const asset of assets) {
  const output = execFileSync(process.execPath, [script, path.join(glbFolder, `${asset}.glb`),
    path.join(outFolder, `${asset}.glb`), errorText, meshoptLevel], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const { before, after } = JSON.parse(output.trim().split('\n').pop());
  totals.bytesBefore += before.bytes;
  totals.bytesAfter += after.bytes;
  totals.trianglesBefore += before.triangles;
  totals.trianglesAfter += after.triangles;
  fs.appendFileSync(path.join(outFolder, 'results.jsonl'), JSON.stringify({ asset, before, after }) + '\n');
}
console.log(JSON.stringify({
  assets: assets.length,
  bytes: `${(totals.bytesBefore / 1e6).toFixed(0)} MB -> ${(totals.bytesAfter / 1e6).toFixed(0)} MB`,
  triangles: `${(totals.trianglesBefore / 1e6).toFixed(1)}M -> ${(totals.trianglesAfter / 1e6).toFixed(1)}M`,
  seconds: Math.round((Date.now() - startedAt) / 1000),
}));
