// Screenshots single moments of the film without recording it. Usage: node still.mjs <outFolder> <seconds> [<seconds> ...]
// Writes <outFolder>/t<seconds>.png. Needs the server (tools/serve.mjs, port 5530).
import { setPriority, constants as osConstants } from 'node:os';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL);
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const outFolder = process.argv[2];
const times = process.argv.slice(3).map(Number);
mkdirSync(outFolder, { recursive: true });
const chromePath = process.env.CHROME_PATH
  ?? undefined;
const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:5530/film.html';

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (error) => console.error('pageerror', error.message));
page.on('console', (message) => { if (message.type() === 'error') console.error('console', message.text().slice(0, 300)); });
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; }); // stills are rendered by __renderAt only
await page.goto(baseUrl);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 300000, polling: 250 });
const error = await page.evaluate(() => window.__error ?? null);
if (error) throw new Error(error);
for (const time of times) {
  await page.evaluate((value) => window.__renderAt(value), time);
  await page.screenshot({ path: `${outFolder}/t${time}.png` });
}
await browser.close();
