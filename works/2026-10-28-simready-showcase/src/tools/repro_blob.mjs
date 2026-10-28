// Tries to reproduce net::ERR_BLOB_OUT_OF_MEMORY on the raw 888 MB V8: (1) compare.html raw vs optimized, (2) three raw loads at once.
// Prints every console error and warning that mentions blob/texture. Usage: node repro_blob.mjs
import { setPriority, constants as osConstants } from 'node:os';
import { createRequire } from 'node:module';
setPriority(0, osConstants.priority.PRIORITY_BELOW_NORMAL);
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:5530';
const raw = 'models/test/engineAssembly_v8_engine_a01.blender.glb';
const chromePath = process.env.CHROME_PATH;
const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(url, label) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const messages = [];
  page.on('console', (message) => { if (/blob|texture|ERR_/i.test(message.text())) messages.push(message.text().slice(0, 160)); });
  page.on('requestfailed', (request) => messages.push(`requestfailed ${request.failure()?.errorText}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 400000, polling: 500 });
  return { page, label, messages };
}

const first = await open(`${base}/compare.html?a=${raw}&b=models/test/v8.nosimp.glb&yaw=35`, 'compare');
console.log(first.label, first.messages.length, first.messages.slice(0, 2));
await first.page.close();
const pages = await Promise.all([1, 2, 3].map((index) => open(`${base}/measure.html?url=${raw}`, `concurrent${index}`)));
for (const entry of pages) console.log(entry.label, entry.messages.length, entry.messages.slice(0, 2), JSON.stringify(await entry.page.evaluate(() => window.__result)).slice(0, 200));
await browser.close();
