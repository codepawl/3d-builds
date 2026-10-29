// Lays thumbnails out in a grid on a solid background (README hero image, or a quick look at a test batch).
// Usage: node make_sheet.mjs <thumbFolder> <output.(png|webp|jpg)> [--names a,b,c] [--columns 8] [--cell 256] [--gap 0] [--background #f3f1ec]
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');

function readArgument(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const [thumbFolder, outputPath] = process.argv.slice(2);
const names = readArgument('--names', null)?.split(',')
  ?? readdirSync(thumbFolder).filter((name) => name.endsWith('.webp')).map((name) => name.slice(0, -5));
const columns = Number(readArgument('--columns', Math.min(8, names.length)));
const cell = Number(readArgument('--cell', 256));
const gap = Number(readArgument('--gap', 0));
const background = readArgument('--background', '#f3f1ec');
const rows = Math.ceil(names.length / columns);

const tiles = await Promise.all(names.map(async (name, index) => ({
  input: await sharp(join(thumbFolder, `${name}.webp`)).resize(cell, cell).toBuffer(),
  left: gap + (index % columns) * (cell + gap),
  top: gap + Math.floor(index / columns) * (cell + gap),
})));

await sharp({ create: { width: gap + columns * (cell + gap), height: gap + rows * (cell + gap), channels: 4, background } })
  .composite(tiles)
  .toFile(outputPath);
console.log(`${outputPath}: ${names.length} tiles, ${columns}x${rows}`);
