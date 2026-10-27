// Records the 30 s, 1920x1080, 30 fps reel frame by frame. Playwright's fake clock drives the page; every frame
// the book is set to the exact state for that second through window.book.apply (in-page calls, no mouse).
// Usage (Git Bash): node tools/record-reel.mjs [framesDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'file:///<your folder>/orglet/node_modules/playwright/index.mjs';
import { startServer, projectRoot } from './serve.mjs';

os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const FPS = 30;
const DURATION = 30;
const framesDir = process.argv[2] || path.join(projectRoot, 'out', 'reel-frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

import { stateAt, BEATS } from './reel-states.mjs';
export { BEATS };
const step = Number(process.env.FRAME_STEP || 1);

const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const SUPERSAMPLE = Number(process.env.SUPERSAMPLE || 2);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SUPERSAMPLE });
const problems = [];
page.on('pageerror', (error) => problems.push(error.message.slice(0, 200)));
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text().slice(0, 200)); });
await page.clock.install({ time: new Date('2026-10-27T10:00:00Z') });
await page.goto(url);
for (let attempt = 0; attempt < 900; attempt += 1) {
  await page.clock.runFor(100);
  if (await page.evaluate(() => Boolean(window.book && window.book.ready))) break;
  await page.waitForTimeout(60);
}
await page.addStyleTag({ content: '* { transition: none !important; }' });
await page.evaluate((state) => window.book.apply(state), stateAt(0));
await page.clock.runFor(1500);
await page.waitForTimeout(400);
const fakeNow = await page.evaluate(() => Date.now());
await page.clock.pauseAt(fakeNow + 100);

const total = DURATION * FPS;
for (let frame = 0; frame < total; frame += step) {
  await page.evaluate((state) => window.book.apply(state), stateAt(frame / FPS));
  await page.clock.runFor((1000 / FPS) * step);
  await page.screenshot({ path: path.join(framesDir, `f${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
  if (frame % 100 === 0) console.log('frame', frame, 'of', total);
}
console.log('problems', JSON.stringify(problems));
await browser.close();
server.close();
