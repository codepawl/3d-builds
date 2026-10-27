// Takes the verification screenshots at 1920x1080 and measures fps. Usage: node check_shots.mjs [names...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve('shots');
fs.mkdirSync(outputDirectory, { recursive: true });
const wanted = process.argv.slice(2);

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));
await page.goto(`http://127.0.0.1:5434/?start=${process.env.START ?? 58}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__plant && window.__sim, null, { timeout: 90000 });
await page.waitForTimeout(2500);

const shots = {
  overview: async () => {
    await page.evaluate(() => { window.__app.rig.orbitRate = 0; });
    await page.waitForTimeout(600);
  },
  selected: async () => {
    await page.evaluate(() => window.__app.selectBag(window.__sim.heroPlan.id));
    await page.waitForTimeout(3500);
  },
  closeup_ct: async () => {
    await page.evaluate(() => window.__app.clearSelection());
    await page.evaluate(() => window.__app.flyTo({ target: [8, 1.2, 17.6], distance: 11, azimuth: 0.7, elevation: 0.5 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_sorter: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [16, 1, 10], distance: 12, azimuth: 0.5, elevation: 0.5 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_chute: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [15.5, 0.8, 12.5], distance: 8, azimuth: 0.6, elevation: 0.45 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_search: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [11, 1, 15], distance: 10, azimuth: 0.2, elevation: 0.9 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_store: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [-8, 1.5, 11], distance: 18, azimuth: 0.5, elevation: 0.6 }, 0.5));
    await page.waitForTimeout(1500);
  },
  site_checkin: async () => {
    await page.evaluate(() => window.__app.switchSite('checkin', 0.5));
    await page.waitForTimeout(1800);
  },
  closeup_desk: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [-34, 2.2, 9], distance: 10, azimuth: 0.5, elevation: 0.55 }, 0.5));
    await page.waitForTimeout(1500);
  },
  site_ramp: async () => {
    await page.evaluate(() => window.__app.switchSite('ramp', 0.5));
    await page.waitForTimeout(1800);
  },
  closeup_loader: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [80, 2, 26], distance: 14, azimuth: 0.7, elevation: 0.45 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_carousel: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [70, 1, -4], distance: 14, azimuth: 0.4, elevation: 0.6 }, 0.5));
    await page.waitForTimeout(1500);
  },
  closeup_tug: async () => {
    await page.evaluate(() => window.__app.flyTo({ target: [64, 1, 14], distance: 14, azimuth: 0.6, elevation: 0.5 }, 0.5));
    await page.waitForTimeout(1500);
  },
};

for (const [name, action] of Object.entries(shots)) {
  if (wanted.length && !wanted.includes(name)) continue;
  await action();
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) });
  console.log('shot', name);
}

const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        if (performance.now() - start < 3000) requestAnimationFrame(tick);
        else resolve((frames * 1000) / (performance.now() - start));
      };
      requestAnimationFrame(tick);
    }),
);
console.log('fps', fps.toFixed(1));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
