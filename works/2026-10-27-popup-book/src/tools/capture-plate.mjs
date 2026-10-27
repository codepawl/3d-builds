// Renders the Titanic plate side-on at high resolution with its page furniture hidden, then cuts the ship out of the
// paper (flood fill from the border) so it can be printed on a pop-up card. Output: web/tex/ship-side.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';

const PLATE_SCALE = Number(process.env.PLATE_SCALE || 3);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(root, 'plate-src');
const outDir = path.join(root, 'web', 'tex');
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const file = path.join(webRoot, decodeURIComponent(request.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
import os from 'node:os';
os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const page = await browser.newPage({ viewport: { width: 3840, height: 1100 }, deviceScaleFactor: PLATE_SCALE });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
await page.addInitScript((ratio) => { window.__maxPixelRatio = ratio; }, PLATE_SCALE);
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.plate && window.plate.ready, null, { timeout: 180000 });
await page.addStyleTag({ content: '#title,#people,#labels,#leaders,#card{display:none !important} * {transition:none !important}' });
await page.evaluate(() => window.plate.view({ target: [134.5, 27, 0], distance: 205, az: 0, el: 0.1 }));
await page.waitForTimeout(3500);
const shot = await page.screenshot({ type: 'png' });
fs.writeFileSync(path.join(outDir, 'ship-raw.png'), shot);

const cutOut = await page.evaluate(async ([dataUrl, scaleFactor]) => {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const width = image.width;
  const height = image.height;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const picture = context.getImageData(0, 0, width, height);
  const data = picture.data;
  // paper colour: median of the border pixels
  const border = [];
  for (let x = 0; x < width; x += 7) { border.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]]); }
  const median = (index) => border.map((p) => p[index]).sort((a, b) => a - b)[Math.floor(border.length / 2)];
  const paper = [median(0), median(1), median(2)];
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const dr = data[i * 4] - paper[0];
    const dg = data[i * 4 + 1] - paper[1];
    const db = data[i * 4 + 2] - paper[2];
    solid[i] = Math.sqrt(dr * dr + dg * dg + db * db) > 46 ? 1 : 0;
  }
  // close small gaps in the ink so the flood cannot leak inside
  const grow = (source, radius) => {
    const result = new Uint8Array(source.length);
    const horizontal = new Uint8Array(source.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let hit = 0;
        for (let k = -radius; k <= radius && !hit; k += 1) {
          const nx = x + k;
          if (nx >= 0 && nx < width && source[y * width + nx]) hit = 1;
        }
        horizontal[y * width + x] = hit;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let hit = 0;
        for (let k = -radius; k <= radius && !hit; k += 1) {
          const ny = y + k;
          if (ny >= 0 && ny < height && horizontal[ny * width + x]) hit = 1;
        }
        result[y * width + x] = hit;
      }
    }
    return result;
  };
  const barrier = grow(solid, 4 * scaleFactor);
  const outside = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { stack.push(y * width, y * width + width - 1); }
  while (stack.length) {
    const index = stack.pop();
    if (outside[index] || barrier[index]) continue;
    outside[index] = 1;
    const x = index % width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (index >= width) stack.push(index - width);
    if (index < width * (height - 1)) stack.push(index + width);
  }
  // the outside region lost 4 px to the grown barrier: give them back by growing the outside mask into non-solid pixels
  const outsideGrown = grow(outside, 4 * scaleFactor);
  for (let i = 0; i < width * height; i += 1) {
    const isOutside = outsideGrown[i] && !solid[i];
    data[i * 4 + 3] = isOutside ? 0 : 255;
  }
  context.putImageData(picture, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.length; i += 32768) binary += String.fromCharCode(...buffer.subarray(i, i + 32768));
  let minX = width; let maxX = 0; let minY = height; let maxY = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return { png: btoa(binary), paper, box: [minX, minY, maxX, maxY] };
}, [`data:image/png;base64,${shot.toString('base64')}`, PLATE_SCALE]);
fs.writeFileSync(path.join(outDir, 'ship-side.png'), Buffer.from(cutOut.png, 'base64'));
fs.writeFileSync(path.join(outDir, 'ship-side.json'), JSON.stringify({ paper: cutOut.paper, box: cutOut.box, size: [3840 * PLATE_SCALE, 1100 * PLATE_SCALE], scale: PLATE_SCALE }));
console.log('paper', cutOut.paper, 'box', cutOut.box, 'problems', JSON.stringify(problems));
await browser.close();
server.close();
