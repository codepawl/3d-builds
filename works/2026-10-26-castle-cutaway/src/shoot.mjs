// Renders still frames at given times (static ?t= mode) for checking. Usage: node shoot.mjs out.png t1 t2 ...
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../demo-harness/node_modules/playwright/index.mjs';
import { serveFolder } from '../pokemon-duel/serve.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const [outputFolder, ...times] = process.argv.slice(2);
const server = await serveFolder(here);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
await page.goto(`${server.origin}/index.html?t=${times[0]}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 90000 });
for (const time of times) {
  await page.evaluate((value) => window.renderAt(Number(value)), time);
  await page.screenshot({ path: join(outputFolder, `still-${String(time).replace('.', '_')}.png`) });
}
console.log('problems', JSON.stringify(problems.slice(0, 8)));
await browser.close();
server.close();
