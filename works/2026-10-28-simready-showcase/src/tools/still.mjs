// Previews single moments without running the film. Usage: node still.mjs <outFolder> <name>=<query> [<name>=<query> ...]
// Example: node still.mjs out/previews turbo=shot=turbo&at=4&spin=2&face=-90
// Each query is passed to the page (?shot=<id>&at=<seconds into the shot>&spin=<seconds since the spin click>).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';


const outFolder = process.argv[2];
const requests = process.argv.slice(3).map((argument) => {
  const split = argument.indexOf('=');
  return { name: argument.slice(0, split), query: argument.slice(split + 1) };
});
mkdirSync(outFolder, { recursive: true });
const chromePath = process.env.CHROME_PATH;
const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:5530/';

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const request of requests) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.addInitScript(() => {
    let virtualNow = 0;
    let queue = [];
    window.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
    window.__tick = () => {
      virtualNow += 1000 / 30;
      const callbacks = queue;
      queue = [];
      for (const callback of callbacks) callback(virtualNow);
    };
  });
  await page.goto(`${baseUrl}?${request.query}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 120000, polling: 250 });
  for (let index = 0; index < 4; index++) await page.evaluate(() => window.__tick());
  await page.screenshot({ path: `${outFolder}/${request.name}.png` });
  await page.close();
}
await browser.close();
