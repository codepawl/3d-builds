// Reads every asset's payloads/Physics/physics.usda from nvidia/simready-assets and summarizes its physics.
// Usage: node scan_physics.mjs <asset-list.txt> <output.jsonl>   (resumable: assets already in the output are skipped)
// One line per asset: rigid bodies, physics materials, and each joint's type, axis, limits and the two bodies it links.
import fs from 'node:fs';

const [listPath, outputPath] = process.argv.slice(2);
const BASE = 'https://huggingface.co/datasets/nvidia/simready-assets/resolve/main';
const WORKERS = 8;

const done = new Set();
if (fs.existsSync(outputPath)) {
  for (const line of fs.readFileSync(outputPath, 'utf8').split('\n').filter(Boolean)) done.add(JSON.parse(line).asset);
}
const assets = fs.readFileSync(listPath, 'utf8').split('\n').map((line) => line.trim()).filter((name) => name && !done.has(name));

function readJoints(text) {
  const joints = [];
  const jointPattern = /def Physics(\w+)Joint "([^"]+)"[\s\S]*?\n {8}\}/g;
  for (const match of text.matchAll(jointPattern)) {
    const body = match[0];
    const value = (name) => body.match(new RegExp(`${name} = ([^\\n]+)`))?.[1]?.trim();
    const target = (name) => body.match(new RegExp(`${name} = <([^>]+)>`))?.[1]?.split('/').at(-2);
    joints.push({
      type: match[1].toLowerCase(),
      name: match[2],
      axis: value('physics:axis')?.replaceAll('"', ''),
      lower: value('physics:lowerLimit'),
      upper: value('physics:upperLimit'),
      body0: target('physics:body0'),
      body1: target('physics:body1'),
      hasLocalFrame: /physics:localPos0/.test(body),
    });
  }
  return joints;
}

async function scan(asset) {
  const response = await fetch(`${BASE}/${asset}/simready_usd/payloads/Physics/physics.usda`);
  if (!response.ok) return { asset, error: `HTTP ${response.status}` };
  const text = await response.text();
  return {
    asset,
    rigidBodies: (text.match(/PhysicsRigidBodyAPI/g) ?? []).length,
    physicsMaterials: (text.match(/PhysicsMaterialAPI/g) ?? []).length,
    articulationRoot: /PhysicsArticulationRootAPI/.test(text),
    joints: readJoints(text),
  };
}

let next = 0;
async function worker() {
  while (next < assets.length) {
    const asset = assets[next];
    next += 1;
    let row;
    try {
      row = await scan(asset);
    } catch (error) {
      row = { asset, error: String(error.message ?? error) };
    }
    fs.appendFileSync(outputPath, JSON.stringify(row) + '\n');
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`scanned ${assets.length}`);
