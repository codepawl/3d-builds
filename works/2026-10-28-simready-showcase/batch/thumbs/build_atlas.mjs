// Packs the thumbnails into sprite sheets for the viewer Space, so a page of the grid costs two requests, not 120.
// Sheet n holds assets n*100 .. n*100+99 in assets.json order, 10 per row, at 256 px each.
// Usage: node build_atlas.mjs <thumbDir> <spaceDir>   (reads <spaceDir>/assets.json, writes <spaceDir>/atlas/<n>.webp)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');
const [thumbFolder, spaceFolder] = process.argv.slice(2);
const TILES_PER_ROW = 10;
const TILES_PER_SHEET = TILES_PER_ROW * TILES_PER_ROW;
const TILE_SIZE = 256;

const names = JSON.parse(readFileSync(join(spaceFolder, 'assets.json'), 'utf8')).map((row) => row[0]);
const atlasFolder = join(spaceFolder, 'atlas');
mkdirSync(atlasFolder, { recursive: true });

const sheetCount = Math.ceil(names.length / TILES_PER_SHEET);
for (let sheet = 0; sheet < sheetCount; sheet += 1) {
  const sheetNames = names.slice(sheet * TILES_PER_SHEET, (sheet + 1) * TILES_PER_SHEET);
  const tiles = await Promise.all(sheetNames.map(async (name, index) => ({
    input: await sharp(join(thumbFolder, `${name}.webp`)).resize(TILE_SIZE, TILE_SIZE).toBuffer(),
    left: (index % TILES_PER_ROW) * TILE_SIZE,
    top: Math.floor(index / TILES_PER_ROW) * TILE_SIZE,
  })));
  const side = TILES_PER_ROW * TILE_SIZE;
  await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles)
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(join(atlasFolder, `${sheet}.webp`));
}
console.log(`${names.length} thumbnails -> ${sheetCount} sheets in ${atlasFolder}`);
