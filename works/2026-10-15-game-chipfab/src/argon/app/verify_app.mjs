import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS_DIR = './shots';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.url()} -> ${req.failure()?.errorText}`);
  });

  console.log('Navigating to http://localhost:5425 ...');
  await page.goto('http://localhost:5425', { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Measure FPS over 1.5 seconds
  const fps = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      function tick() {
        frames++;
        const elapsed = performance.now() - t0;
        if (elapsed >= 1500) {
          resolve(Math.round((frames * 1000) / elapsed));
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  });
  console.log(`Measured FPS: ${fps}`);

  // 1. Overview of Site 1 (AetherFab F1 — 300 mm Logic)
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_01_overview.png') });
  console.log('Saved verify_01_overview.png');

  // 2. Click OHT-01 in the OHT & Fleet list -> Camera follows moving priority OHT vehicle + detail card opens
  await page.click('[data-row-unit-id="OHT-01"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_02_oht_follow.png') });
  console.log('Saved verify_02_oht_follow.png');

  // 3. Click ENG-01 in the OHT & Fleet list -> Rigged Bunny-Suit Litho Engineer close-up
  await page.click('[data-row-unit-id="ENG-01"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_09_engineer_closeup.png') });
  console.log('Saved verify_09_engineer_closeup.png');

  // 4. Switch to Fab Tools tab and click EUV-01 -> Yellow Litho Bay close-up + detail card
  await page.click('[data-tab-id="tools"]');
  await page.waitForTimeout(250);
  await page.click('[data-row-unit-id="EUV-01"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_03_litho_selected.png') });
  console.log('Saved verify_03_litho_selected.png');

  // 5. Click Stage 2 (ETCH-01) on the bottom Hot Lot Timeline Strip -> Plasma Etch & CVD/PVD Cluster Bay
  await page.click('[data-stage-tool="ETCH-01"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_04_etch_cvd_bay.png') });
  console.log('Saved verify_04_etch_cvd_bay.png');

  // 6. Click Stage 6 (CMP-01) on the bottom Hot Lot Timeline Strip -> South Bay (Implant, Furnace, RTP, CMP, Wet, SEM)
  await page.click('[data-stage-tool="CMP-01"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_05_implant_cmp_metro.png') });
  console.log('Saved verify_05_implant_cmp_metro.png');

  // 7. Toggle Sub-Fab Cutaway X-Ray and click EVT-104 (SUB-ABATE-01) -> Sub-Fab Utility Basement
  await page.click('[data-action="toggle-subfab"]');
  await page.click('[data-tab-id="events"]');
  await page.waitForTimeout(250);
  await page.click('[data-row-event-id="EVT-104"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_06_subfab_cutaway.png') });
  console.log('Saved verify_06_subfab_cutaway.png');
  await page.click('[data-action="toggle-subfab"]');

  // 8. Switch to Site 2 (AetherFab F2 — 2 nm Ramp-Up)
  await page.click('[data-site-id="fab2"]');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_07_site2_rampup.png') });
  console.log('Saved verify_07_site2_rampup.png');

  // 9. Switch to Site 3 (AetherPack AP1 — 3D Packaging)
  await page.click('[data-site-id="ap1"]');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(SHOTS_DIR, 'verify_08_site3_packaging.png') });
  console.log('Saved verify_08_site3_packaging.png');

  await browser.close();

  console.log('Console Errors:', consoleErrors.length);
  console.log('Page Errors:', pageErrors.length);
  console.log('Failed Requests:', failedRequests.length);
  if (consoleErrors.length > 0 || pageErrors.length > 0 || failedRequests.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
