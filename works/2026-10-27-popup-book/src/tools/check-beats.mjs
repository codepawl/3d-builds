// Stills of the reel at chosen seconds, at full size, with no clock: node tools/check-beats.mjs 6.5 10.5 13 16 25
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';
import { startServer, projectRoot } from './serve.mjs';
import { stateAt } from './reel-states.mjs';

os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const outDir = path.join(projectRoot, 'out', 'check');
fs.mkdirSync(outDir, { recursive: true });
const seconds = process.argv.slice(2).map(Number);
const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
await page.goto(url);
await page.waitForFunction(() => window.book && window.book.ready, null, { timeout: 280000 });
await page.addStyleTag({ content: '* { transition: none !important; }' });
for (const second of seconds) {
  await page.evaluate((state) => window.book.apply(state), stateAt(second));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `t${second}.png`) });
}
console.log('problems', JSON.stringify(problems));
await browser.close();
server.close();
