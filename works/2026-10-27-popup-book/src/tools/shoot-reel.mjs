// Stills of the reel at chosen seconds, through the same stateAt the recorder uses: node tools/shoot-reel.mjs 4.5 13 [--scale=2]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';
import { startServer, projectRoot } from './serve.mjs';
import { stateAt } from './reel-states.mjs';

os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const scaleArgument = process.argv.find((argument) => argument.startsWith('--scale='));
const scale = scaleArgument ? Number(scaleArgument.split('=')[1]) : 1;
const seconds = process.argv.slice(2).filter((argument) => !argument.startsWith('--')).map(Number);
const outDir = path.join(projectRoot, 'out', 'reel-stills');
fs.mkdirSync(outDir, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message.slice(0, 200)));
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text().slice(0, 200)); });
await page.goto(url);
await page.waitForFunction(() => window.book && window.book.ready, null, { timeout: 120000 });
await page.addStyleTag({ content: '* { transition: none !important; }' });
for (const second of seconds) {
  await page.evaluate((state) => window.book.apply(state), stateAt(second));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `s${second}.png`) });
}
console.log('problems', JSON.stringify(problems));
await browser.close();
server.close();
