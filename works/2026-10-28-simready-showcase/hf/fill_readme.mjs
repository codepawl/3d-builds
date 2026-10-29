// Fills README.template.md with the numbers in the manifest and writes the dataset card.
// Usage: node fill_readme.mjs <work-root>/out   (reads manifest.jsonl, writes README.md there)
// udimCount counts the glbs kept in ../glb_before_udim_fix; the physics counts come from ../physics/report.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputFolder = process.argv[2];
const templatePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'README.template.md');
const rows = fs.readFileSync(path.join(outputFolder, 'manifest.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function gigabytes(bytes) {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function megabytes(bytes) {
  return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`;
}

const v8 = rows.find((row) => row.asset === 'engineAssembly_v8_engine_a01');
const udimBackupFolder = path.join(outputFolder, '..', 'glb_before_udim_fix');
const physicsRows = fs.readFileSync(path.join(outputFolder, '..', 'physics', 'report.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const values = {
  assets: rows.length.toLocaleString('en-US'),
  blenderSize: gigabytes(sum(rows.map((row) => row.blender.bytes))),
  optimizedSize: gigabytes(sum(rows.map((row) => row.optimized.bytes))),
  blenderTriangles: `${Math.round(sum(rows.map((row) => row.blender.triangles)) / 1e6)}M`,
  optimizedTriangles: `${Math.round(sum(rows.map((row) => row.optimized.triangles)) / 1e6)}M`,
  v8BlenderSize: megabytes(v8.blender.bytes),
  v8OptimizedSize: megabytes(v8.optimized.bytes),
  physicsAssets: physicsRows.filter((row) => row.bodies > 0).length.toLocaleString('en-US'),
  jointAssets: physicsRows.filter((row) => row.joints > 0).length.toLocaleString('en-US'),
  jointCount: sum(physicsRows.map((row) => row.joints ?? 0)).toLocaleString('en-US'),
  udimCount: fs.existsSync(udimBackupFolder) ? fs.readdirSync(udimBackupFolder).length.toLocaleString('en-US') : '0',
};

const card = fs.readFileSync(templatePath, 'utf8').replace(/\{\{(\w+)\}\}/g, (match, key) => {
  if (!(key in values)) throw new Error(`no value for ${match}`);
  return values[key];
});
fs.writeFileSync(path.join(outputFolder, 'README.md'), card);
console.log(values);
