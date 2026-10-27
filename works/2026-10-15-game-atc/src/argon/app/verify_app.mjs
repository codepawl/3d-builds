import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

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
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Opening http://localhost:5424 ...');
  await page.goto('http://localhost:5424', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // 1. Measure real-time FPS at 1920x1080 over 2.5 seconds
  const fpsResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      function count() {
        frames++;
        const elapsed = performance.now() - t0;
        if (elapsed < 2500) {
          requestAnimationFrame(count);
        } else {
          resolve({
            fps: +(frames / (elapsed / 1000)).toFixed(1),
            frames,
            elapsedMs: Math.round(elapsed),
          });
        }
      }
      requestAnimationFrame(count);
    });
  });
  console.log('[FPS CHECK]', JSON.stringify(fpsResult));

  // 2. Shot 1: Overview of Port Solis Tower Sector
  await page.screenshot({ path: path.join(SHOTS_DIR, '01_overview_tower.png') });
  console.log('Saved 01_overview_tower.png');

  // 3. Shot 2: Click a flight row (AZR-402) -> Detail card opens & camera flies to aircraft
  await page.click('[data-row-id="FLT-AZR402"]');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(SHOTS_DIR, '02_selected_flight_card.png') });
  console.log('Saved 02_selected_flight_card.png');

  // Zoom in closer on the selected Jet Airliner (AZR-402)
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(450);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS_DIR, '06_closeup_aircraft_jet.png') });
  console.log('Saved 06_closeup_aircraft_jet.png');

  // 4. Close-up of Turboprop Cargo Feeder (AFR-712) on Taxiway Alpha
  await page.click('[data-row-id="FLT-AFR712"]');
  await page.waitForTimeout(1200);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(450);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS_DIR, '07_closeup_turboprop_taxi.png') });
  console.log('Saved 07_closeup_turboprop_taxi.png');

  // 5. Close-up of Control Tower & Terminal Concourse (via Waypoints tab -> KPSA-TWR)
  await page.click('button[role="tab"]:has-text("Waypoints")');
  await page.waitForTimeout(300);
  await page.click('[data-row-id="NAV-TWR"]');
  await page.waitForTimeout(1300);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS_DIR, '05_closeup_tower_terminal.png') });
  console.log('Saved 05_closeup_tower_terminal.png');

  // 6. Close-up of ASR-11 Primary Radar & Waypoint Pylons
  await page.click('[data-row-id="NAV-ASR1"]');
  await page.waitForTimeout(1300);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS_DIR, '09_closeup_radar_navaids.png') });
  console.log('Saved 09_closeup_radar_navaids.png');

  // 7. Close-up of Ground Support Vehicles & Rigged Crew at Gate G1
  await page.click('button[role="tab"]:has-text("Apron")');
  await page.waitForTimeout(300);
  await page.click('[data-row-id="GSE-TUG-01"]');
  await page.waitForTimeout(1300);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(450);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS_DIR, '08_closeup_gse_crew.png') });
  console.log('Saved 08_closeup_gse_crew.png');

  // 8. Switch to Site 2: Solis Bay Approach (PSA TMA)
  await page.click('[data-site-id="approach"]');
  await page.waitForTimeout(1500);
  await page.click('button[role="tab"]:has-text("Flights")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS_DIR, '03_site_approach.png') });
  console.log('Saved 03_site_approach.png');

  // 9. Close-up of Convective CB Weather Cell in Approach Sector
  await page.click('button[role="tab"]:has-text("Apron")');
  await page.waitForTimeout(300);
  await page.click('[data-row-id="WX-TMA-CB"]');
  await page.waitForTimeout(1300);
  await page.click('.cam-btn[title="Zoom In"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS_DIR, '10_closeup_weather_cell.png') });
  console.log('Saved 10_closeup_weather_cell.png');

  // 10. Switch to Site 3: North Ridge En-Route Sector
  await page.click('[data-site-id="enroute"]');
  await page.waitForTimeout(1500);
  await page.click('button[role="tab"]:has-text("Flights")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS_DIR, '04_site_enroute.png') });
  console.log('Saved 04_site_enroute.png');

  console.log('[CONSOLE ERRORS]', errors.length, errors);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
