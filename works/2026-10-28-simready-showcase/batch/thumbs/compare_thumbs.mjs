// Compares two thumbnail folders pixel by pixel and lists the assets that changed most.
// Usage: node compare_thumbs.mjs <reference-folder> <candidate-folder> [--top 10]
// Score: the share of pixels whose colour or alpha moved by more than THRESHOLD (default 24) of 255 in any channel.
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');
const [referenceFolder, candidateFolder] = process.argv.slice(2);
const topIndex = process.argv.indexOf('--top');
const top = topIndex === -1 ? 10 : Number(process.argv[topIndex + 1]);
const THRESHOLD = Number(process.env.THRESHOLD ?? 24);

async function readPixels(file) {
  return sharp(file).ensureAlpha().resize(256, 256).raw().toBuffer();
}

const scores = [];
for (const file of readdirSync(candidateFolder).filter((name) => name.endsWith('.webp'))) {
  const reference = await readPixels(join(referenceFolder, file));
  const candidate = await readPixels(join(candidateFolder, file));
  let changed = 0;
  for (let pixel = 0; pixel < reference.length; pixel += 4) {
    let largest = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      largest = Math.max(largest, Math.abs(reference[pixel + channel] - candidate[pixel + channel]));
    }
    if (largest > THRESHOLD) changed += 1;
  }
  scores.push([changed / (reference.length / 4), file.slice(0, -5)]);
}
scores.sort((a, b) => b[0] - a[0]);
const mean = scores.reduce((total, [score]) => total + score, 0) / scores.length;
console.log(`${scores.length} compared, mean ${(mean * 100).toFixed(2)}% pixels changed`);
for (const [score, name] of scores.slice(0, top)) console.log(`${(score * 100).toFixed(2)}% ${name}`);
