// Downloads the USD files, textures and licence of each picked SimReady asset into raw/<asset>.
import fs from 'node:fs';
import path from 'node:path';

const REPOSITORY = 'https://huggingface.co/datasets/nvidia/simready-assets';
const ASSETS = process.argv.slice(3);
const outputRoot = process.argv[2];

async function listFiles(asset) {
  const response = await fetch(`https://huggingface.co/api/datasets/nvidia/simready-assets/tree/main/${asset}?recursive=true&limit=1000`);
  const entries = await response.json();
  return entries
    .filter((entry) => entry.type === 'file')
    .map((entry) => entry.path)
    .filter((filePath) => !filePath.includes('/.thumbs/'))
    .filter((filePath) => filePath.includes('/simready_usd/') || filePath.endsWith('LICENSE.txt'));
}

for (const asset of ASSETS) {
  const files = await listFiles(asset);
  for (const filePath of files) {
    const target = path.join(outputRoot, filePath);
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const response = await fetch(`${REPOSITORY}/resolve/main/${filePath}`);
    if (!response.ok) {
      console.log('failed', filePath, response.status);
      continue;
    }
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  console.log('done', asset, files.length);
}
