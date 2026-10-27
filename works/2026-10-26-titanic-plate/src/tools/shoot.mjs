// Screenshots of the plate page: node tools/shoot.mjs   (run from Git Bash)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const playwright = await import('file:///<your folder>/orglet/node_modules/playwright/index.mjs');
const { chromium } = playwright.default || playwright;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'web');
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const url = request.url.split('?')[0];
  const file = path.join(webDir, url === '/' ? 'index.html' : url);
  if (!file.startsWith(webDir) || !fs.existsSync(file)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const only = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const problems = [];
async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.plate && window.plate.ready, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  return page;
}

try {
  if (!only || only === 'desktop') {
    const page = await open(1920, 1080);
    console.log('people', await page.evaluate(() => window.plate.peopleCount), 'lights', await page.evaluate(() => window.plate.lights));
    console.log('floating as authored', JSON.stringify(await page.evaluate(() => window.plate.floatingFigures(true))));
    console.log('floating now', JSON.stringify(await page.evaluate(() => window.plate.floatingFigures(false))));
    await page.screenshot({ path: path.join(outDir, 'desktop-home.png') });
    for (const id of ['boilers', 'dining', 'stairs', 'bridge', 'engines', 'pool']) {
      await page.evaluate((name) => window.plate.flyTo(name), id);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(outDir, `closeup-${id}.png`) });
    }
    await page.close();
  }
  if (!only || only === 'phone') {
    const page = await open(390, 844);
    await page.screenshot({ path: path.join(outDir, 'phone-home.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log('phone horizontal overflow', overflow);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `console problems:\n${[...new Set(problems)].join('\n')}` : 'no console problems');
