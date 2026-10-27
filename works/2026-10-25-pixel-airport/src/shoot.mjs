// Opens one side's page over http, waits in real time, and saves screenshots plus console errors.
// Usage: node shoot.mjs <side folder> [width] [height]
const { chromium } = await import('file:///<your folder>/demo-harness/node_modules/playwright/index.mjs');
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFolder } from '../pokemon-duel/serve.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const [side, width = '1280', height = '720'] = process.argv.slice(2);
const server = await serveFolder(join(here, side));
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)); });
page.on('pageerror', error => errors.push(error.message.slice(0, 300)));
await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
for (const seconds of [5, 20, 45]) {
  await page.waitForTimeout(seconds * 1000 - (seconds === 5 ? 0 : seconds === 20 ? 5000 : 20000));
  await page.screenshot({ path: join(here, side, `shot-${width}x${height}-${seconds}s.png`) });
}
console.log('sceneReady', await page.evaluate(() => window.sceneReady), 'errors', JSON.stringify(errors));
await browser.close();
server.close();
