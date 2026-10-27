// Stills of the book at chosen states: node tools/shoot.mjs [name ...]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';
import { startServer, projectRoot } from './serve.mjs';

const outDir = path.join(projectRoot, 'out', 'stills');
fs.mkdirSync(outDir, { recursive: true });
const SHOTS = {
  closed: { size: [1920, 1080], state: { t: 0 } },
  p30: { size: [1920, 1080], state: { t: 0.268, caption: null } },
  p60: { size: [1920, 1080], state: { t: 0.536, caption: null } },
  p90: { size: [1920, 1080], state: { t: 0.803, caption: null } },
  low: { size: [1920, 1080], state: { t: 1, caption: null, pitch: -0.14, zoom: 0.8, yaw: 0.12 } },
  stationLow: { size: [1920, 1080], state: { t: 2, caption: null, pitch: -0.14, zoom: 0.8, yaw: -0.12 } },
  s60: { size: [1920, 1080], state: { t: 1.536, caption: null } },
  opening: { size: [1920, 1080], state: { t: 0.5 } },
  titanic: { size: [1920, 1080], state: { t: 1, caption: null } },
  boilers: { size: [1920, 1080], state: { t: 1, slide: 1, caption: 'slider', zoom: 0.8 } },
  flap: { size: [1920, 1080], state: { t: 1, flap: 1, caption: 'flap', zoom: 0.75, pitch: 0.12 } },
  volvelle: { size: [1920, 1080], state: { t: 1, wheelAngle: -Math.PI / 4 * 2, caption: 'wheel', zoom: 0.85, pitch: 0.2 } },
  turning: { size: [1920, 1080], state: { t: 1.5 } },
  station: { size: [1920, 1080], state: { t: 2, steam: 0.25, caption: 'steam' } },
  sources: { size: [1920, 1080], state: { t: 3 } },
  phone: { size: [390, 844], state: { t: 1, caption: null } },
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const problems = [];
for (const name of wanted) {
  const { size, state } = SHOTS[name];
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => problems.push(`${name}: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`${name}: ${message.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.book && window.book.ready, null, { timeout: 120000 });
  await page.addStyleTag({ content: '* { transition: none !important; }' });
  await page.evaluate((next) => window.book.apply(next), state);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  if (name === 'titanic') {
    const audit = await page.evaluate(() => window.book.audit());
    for (const row of audit) console.log('audit page', row.spread + 1, 'psi', row.psi, 'lowest', row.lowest, JSON.stringify(row.overlaps));
  }
  await page.close();
}
console.log('problems', JSON.stringify(problems.slice(0, 8)));
await browser.close();
server.close();
