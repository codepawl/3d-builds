import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS_DIR = './shots';
const FRAMES_DIR = path.join(SHOTS_DIR, 'frames');

fs.mkdirSync(FRAMES_DIR, { recursive: true });
// Clean any leftover frames from prior runs
for (const f of fs.readdirSync(FRAMES_DIR)) {
  if (f.endsWith('.png')) {
    fs.unlinkSync(path.join(FRAMES_DIR, f));
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

async function main() {
  console.log('Launching GPU-accelerated Chromium at 1920x1080 for 30s (900 frames) film capture...');
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

  // Deterministic virtual clock override (performance.now, Date.now, requestAnimationFrame)
  // + visible interactive cursor overlay driven by real Playwright mouse/wheel events
  await page.addInitScript(() => {
    const BASE_EPOCH_MS = 1760565600000;
    let virtualTimeMs = 15000; // Start 15s into cycle so all tools, OHTs, and engineers are in active motion
    let nextRafId = 1;
    const rafCallbacks = new Map();

    Date.now = () => Math.floor(BASE_EPOCH_MS + virtualTimeMs);
    performance.now = () => virtualTimeMs;

    window.requestAnimationFrame = (cb) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    };

    window.cancelAnimationFrame = (id) => {
      rafCallbacks.delete(id);
    };

    window.__advanceVirtualClock = (dtMs = 1000 / 30) => {
      virtualTimeMs += dtMs;
      const entries = Array.from(rafCallbacks.entries());
      rafCallbacks.clear();
      for (const [, cb] of entries) {
        try {
          cb(virtualTimeMs);
        } catch (err) {
          console.error('RAF error:', err);
        }
      }
      if (window.__updateCursorRipple) {
        window.__updateCursorRipple(dtMs);
      }
    };

    // Inject visible custom cursor that tracks real browser mouse events
    window.addEventListener('DOMContentLoaded', () => {
      const cursorRoot = document.createElement('div');
      cursorRoot.id = '__film_cursor__';
      Object.assign(cursorRoot.style, {
        position: 'fixed',
        left: '960px',
        top: '520px',
        width: '32px',
        height: '32px',
        pointerEvents: 'none',
        zIndex: '2147483647',
        transform: 'translate(-3px, -2px)',
      });

      const ripple = document.createElement('div');
      Object.assign(ripple.style, {
        position: 'absolute',
        left: '-14px',
        top: '-14px',
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        border: '2.5px solid #2563eb',
        background: 'rgba(59, 130, 246, 0.22)',
        opacity: '0',
        transform: 'scale(0.4)',
        pointerEvents: 'none',
      });

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '26');
      svg.setAttribute('height', '26');
      svg.setAttribute('viewBox', '0 0 26 26');
      svg.style.filter = 'drop-shadow(0 2px 5px rgba(15, 23, 42, 0.45))';

      const pathEl = document.createElementNS(svgNS, 'path');
      pathEl.setAttribute('d', 'M3 2 L3 21 L8.2 16.2 L12.2 23.5 L15.2 22 L11.2 14.8 L18.5 14.8 Z');
      pathEl.setAttribute('fill', '#ffffff');
      pathEl.setAttribute('stroke', '#0f172a');
      pathEl.setAttribute('stroke-width', '1.8');
      pathEl.setAttribute('stroke-linejoin', 'round');

      svg.appendChild(pathEl);
      cursorRoot.appendChild(ripple);
      cursorRoot.appendChild(svg);
      document.body.appendChild(cursorRoot);

      let rippleAgeMs = 9999;
      let isPressed = false;

      window.addEventListener(
        'mousemove',
        (e) => {
          cursorRoot.style.left = `${e.clientX}px`;
          cursorRoot.style.top = `${e.clientY}px`;
        },
        { capture: true, passive: true }
      );

      window.addEventListener(
        'mousedown',
        () => {
          isPressed = true;
          rippleAgeMs = 0;
          svg.style.transform = 'scale(0.9)';
        },
        { capture: true, passive: true }
      );

      window.addEventListener(
        'mouseup',
        () => {
          isPressed = false;
          svg.style.transform = 'scale(1.0)';
        },
        { capture: true, passive: true }
      );

      window.addEventListener(
        'wheel',
        () => {
          rippleAgeMs = 0;
        },
        { capture: true, passive: true }
      );

      window.__updateCursorRipple = (dtMs) => {
        if (rippleAgeMs < 420) {
          rippleAgeMs += dtMs;
          const p = Math.min(1, rippleAgeMs / 420);
          const scale = 0.45 + p * 1.25;
          const alpha = (1 - p) * 0.9;
          ripple.style.opacity = String(alpha);
          ripple.style.transform = `scale(${scale.toFixed(3)})`;
        } else if (isPressed) {
          ripple.style.opacity = '0.45';
          ripple.style.transform = 'scale(0.85)';
        } else {
          ripple.style.opacity = '0';
        }
      };
    });
  });

  console.log('Opening http://localhost:5425 ...');
  await page.goto('http://localhost:5425', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 });

  // Warm up the virtual clock so all 23 GLB assets finish Suspense mounting and shaders compile
  console.log('Warming up WebGL scene and GLB assets...');
  for (let w = 0; w < 60; w++) {
    await page.evaluate(() => window.__advanceVirtualClock(1000 / 30));
    await page.waitForTimeout(15);
  }
  await page.waitForSelector('[data-pin-unit-id="OHT-01"]', { timeout: 10000 });
  console.log('Scene ready. Starting 900-frame (30.0s @ 30fps) deterministic capture...');

  // Helper to get live center coordinates of a selector on screen
  async function getElementCenter(selector, fallback) {
    try {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      }, selector);
      return box || fallback;
    } catch {
      return fallback;
    }
  }

  let curX = 960;
  let curY = 520;
  await page.mouse.move(curX, curY);

  // Saved waypoint targets resolved dynamically just before each cursor glide
  let ohtTarget = { x: 860, y: 390 };
  let tabToolsTarget = { x: 1625, y: 782 };
  let rowEuvTarget = { x: 1640, y: 835 };
  let rowEtchTarget = { x: 1640, y: 945 };
  let site2BtnTarget = { x: 760, y: 34 };
  let f2UnitTarget = { x: 850, y: 420 };
  let emptyGroundTarget = { x: 430, y: 185 };

  const TOTAL_FRAMES = 900;
  const DT_MS = 1000 / 30;

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    // =========================================================================
    // 0 - 5 s (Frames 0 - 149): Slow orbit over AetherFab F1 with things moving
    // =========================================================================
    if (f === 0) {
      curX = 980;
      curY = 520;
      await page.mouse.move(curX, curY);
      await page.mouse.down({ button: 'left' });
    } else if (f > 0 && f <= 134) {
      const p = f / 134;
      curX = lerp(980, 740, p);
      curY = lerp(520, 482, Math.sin(p * Math.PI));
      await page.mouse.move(curX, curY);
    } else if (f === 135) {
      await page.mouse.up({ button: 'left' });
      ohtTarget = await getElementCenter('[data-pin-unit-id="OHT-01"]', { x: 860, y: 400 });
    } else if (f > 135 && f < 150) {
      // Continuously refine live screen position of moving OHT-01 pin as cursor glides to it
      ohtTarget = await getElementCenter('[data-pin-unit-id="OHT-01"]', ohtTarget);
      const p = smoothstep(135, 149, f);
      curX = lerp(740, ohtTarget.x, p);
      curY = lerp(482, ohtTarget.y, p);
      await page.mouse.move(curX, curY);
    }

    // =========================================================================
    // 5 - 12 s (Frames 150 - 359): Click moving unit (OHT-01), card opens &
    // updates live while camera smoothly follows OHT-01 along the monorail loop
    // =========================================================================
    else if (f === 150) {
      ohtTarget = await getElementCenter('[data-pin-unit-id="OHT-01"]', ohtTarget);
      curX = ohtTarget.x;
      curY = ohtTarget.y;
      await page.mouse.click(curX, curY);
    } else if (f > 150 && f < 170) {
      // Move cursor slightly aside so it doesn't obscure the tracked OHT vehicle
      const p = smoothstep(150, 170, f);
      curX = lerp(ohtTarget.x, 820, p);
      curY = lerp(ohtTarget.y, 520, p);
      await page.mouse.move(curX, curY);
    } else if (f === 170) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 170 && f <= 332) {
      // Gentle slow orbit while camera follows moving OHT-01 and right detail card ticks live
      const p = (f - 170) / (332 - 170);
      curX = lerp(820, 965, p);
      curY = lerp(520, 495, p);
      await page.mouse.move(curX, curY);
    } else if (f === 333) {
      await page.mouse.up({ button: 'left' });
      tabToolsTarget = await getElementCenter('[data-tab-id="tools"]', { x: 1625, y: 782 });
    } else if (f > 333 && f < 346) {
      const p = smoothstep(333, 345, f);
      curX = lerp(965, tabToolsTarget.x, p);
      curY = lerp(495, tabToolsTarget.y, p);
      await page.mouse.move(curX, curY);
    } else if (f === 346) {
      // Click "Fab Tools" tab in the bottom-right panel
      await page.mouse.click(tabToolsTarget.x, tabToolsTarget.y);
      await page.waitForTimeout(8);
      rowEuvTarget = await getElementCenter('[data-row-unit-id="EUV-01"]', { x: 1640, y: 835 });
    } else if (f > 346 && f < 360) {
      rowEuvTarget = await getElementCenter('[data-row-unit-id="EUV-01"]', rowEuvTarget);
      const p = smoothstep(346, 359, f);
      curX = lerp(tabToolsTarget.x, rowEuvTarget.x, p);
      curY = lerp(tabToolsTarget.y, rowEuvTarget.y, p);
      await page.mouse.move(curX, curY);
    }

    // =========================================================================
    // 12 - 18 s (Frames 360 - 539): Click a list row in bottom-right panel
    // and the camera flies there (EUV-01 at 12.0s, then ETCH-01 at 15.2s)
    // =========================================================================
    else if (f === 360) {
      rowEuvTarget = await getElementCenter('[data-row-unit-id="EUV-01"]', rowEuvTarget);
      curX = rowEuvTarget.x;
      curY = rowEuvTarget.y;
      await page.mouse.click(curX, curY);
    } else if (f > 360 && f < 380) {
      const p = smoothstep(360, 379, f);
      curX = lerp(rowEuvTarget.x, 880, p);
      curY = lerp(rowEuvTarget.y, 515, p);
      await page.mouse.move(curX, curY);
    } else if (f === 380) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 380 && f <= 440) {
      const p = (f - 380) / (440 - 380);
      curX = lerp(880, 790, p);
      curY = lerp(515, 495, p);
      await page.mouse.move(curX, curY);
    } else if (f === 441) {
      await page.mouse.up({ button: 'left' });
      rowEtchTarget = await getElementCenter('[data-row-unit-id="ETCH-01"]', { x: 1640, y: 945 });
    } else if (f > 441 && f < 455) {
      rowEtchTarget = await getElementCenter('[data-row-unit-id="ETCH-01"]', rowEtchTarget);
      const p = smoothstep(441, 454, f);
      curX = lerp(790, rowEtchTarget.x, p);
      curY = lerp(495, rowEtchTarget.y, p);
      await page.mouse.move(curX, curY);
    } else if (f === 455) {
      // Click second list row (ETCH-01 Plasma Etch Cluster) -> Camera flies to Etch bay
      rowEtchTarget = await getElementCenter('[data-row-unit-id="ETCH-01"]', rowEtchTarget);
      curX = rowEtchTarget.x;
      curY = rowEtchTarget.y;
      await page.mouse.click(curX, curY);
    } else if (f > 455 && f < 474) {
      const p = smoothstep(455, 473, f);
      curX = lerp(rowEtchTarget.x, 850, p);
      curY = lerp(rowEtchTarget.y, 510, p);
      await page.mouse.move(curX, curY);
    } else if (f === 474) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 474 && f <= 522) {
      const p = (f - 474) / (522 - 474);
      curX = lerp(850, 925, p);
      curY = lerp(510, 492, p);
      await page.mouse.move(curX, curY);
    } else if (f === 523) {
      await page.mouse.up({ button: 'left' });
      site2BtnTarget = await getElementCenter('[data-site-id="fab2"]', { x: 760, y: 34 });
    } else if (f > 523 && f < 540) {
      site2BtnTarget = await getElementCenter('[data-site-id="fab2"]', site2BtnTarget);
      const p = smoothstep(523, 539, f);
      curX = lerp(925, site2BtnTarget.x, p);
      curY = lerp(492, site2BtnTarget.y, p);
      await page.mouse.move(curX, curY);
    }

    // =========================================================================
    // 18 - 24 s (Frames 540 - 719): Switch to another site (AetherFab F2 —
    // 2 nm Ramp-Up), explore the new site and click F2-EUV-01 for a closer look
    // =========================================================================
    else if (f === 540) {
      site2BtnTarget = await getElementCenter('[data-site-id="fab2"]', site2BtnTarget);
      curX = site2BtnTarget.x;
      curY = site2BtnTarget.y;
      await page.mouse.click(curX, curY);
    } else if (f > 540 && f < 556) {
      const p = smoothstep(540, 555, f);
      curX = lerp(site2BtnTarget.x, 940, p);
      curY = lerp(site2BtnTarget.y, 510, p);
      await page.mouse.move(curX, curY);
    } else if (f === 556) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 556 && f <= 622) {
      const p = (f - 556) / (622 - 556);
      curX = lerp(940, 770, p);
      curY = lerp(510, 485, p);
      await page.mouse.move(curX, curY);
    } else if (f === 623) {
      await page.mouse.up({ button: 'left' });
      f2UnitTarget = await getElementCenter('[data-pin-unit-id="F2-EUV-01"]', { x: 780, y: 430 });
    } else if (f > 623 && f < 638) {
      f2UnitTarget = await getElementCenter('[data-pin-unit-id="F2-EUV-01"]', f2UnitTarget);
      const p = smoothstep(623, 637, f);
      curX = lerp(770, f2UnitTarget.x, p);
      curY = lerp(485, f2UnitTarget.y, p);
      await page.mouse.move(curX, curY);
    } else if (f === 638) {
      f2UnitTarget = await getElementCenter('[data-pin-unit-id="F2-EUV-01"]', f2UnitTarget);
      curX = f2UnitTarget.x;
      curY = f2UnitTarget.y;
      await page.mouse.click(curX, curY);
    } else if (f > 638 && f < 652) {
      const p = smoothstep(638, 651, f);
      curX = lerp(f2UnitTarget.x, 860, p);
      curY = lerp(f2UnitTarget.y, 515, p);
      await page.mouse.move(curX, curY);
    } else if (f === 652) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 652 && f <= 705) {
      const p = (f - 652) / (705 - 652);
      curX = lerp(860, 780, p);
      curY = lerp(515, 495, p);
      await page.mouse.move(curX, curY);
    } else if (f === 706) {
      await page.mouse.up({ button: 'left' });
    } else if (f > 706 && f < 720) {
      // Glide cursor to empty ground to close the detail card at 24.0s
      const p = smoothstep(706, 719, f);
      curX = lerp(780, emptyGroundTarget.x, p);
      curY = lerp(495, emptyGroundTarget.y, p);
      await page.mouse.move(curX, curY);
    }

    // =========================================================================
    // 24 - 30 s (Frames 720 - 899): Click empty ground to close card, then pull
    // back with wheel events + slow orbit drag to a wide shot filling the frame
    // =========================================================================
    else if (f === 720) {
      await page.mouse.click(emptyGroundTarget.x, emptyGroundTarget.y);
    } else if (f > 720 && f <= 765) {
      const p = smoothstep(720, 765, f);
      curX = lerp(emptyGroundTarget.x, 780, p);
      curY = lerp(emptyGroundTarget.y, 510, p);
      await page.mouse.move(curX, curY);
      // Smoothly scroll wheel out over frames 722..762 so camera pulls back to wide shot
      if (f % 2 === 0 && f <= 760) {
        await page.mouse.wheel(0, 62);
      }
    } else if (f === 766) {
      await page.mouse.down({ button: 'left' });
    } else if (f > 766 && f < 899) {
      const p = (f - 766) / (898 - 766);
      curX = lerp(780, 1020, p);
      curY = lerp(510, 488, p);
      await page.mouse.move(curX, curY);
    } else if (f === 899) {
      await page.mouse.up({ button: 'left' });
    }

    // Let any React click/state commit settle, then step virtual clock by 1/30 s
    await page.evaluate(() => new Promise((r) => setTimeout(r, 2)));
    await page.evaluate((dt) => window.__advanceVirtualClock(dt), DT_MS);

    const framePath = path.join(FRAMES_DIR, `frame_${String(f).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath });

    if (f % 90 === 0 || f === TOTAL_FRAMES - 1) {
      console.log(`Captured frame ${f + 1}/${TOTAL_FRAMES} (t=${((f + 1) / 30).toFixed(1)}s)`);
    }
  }

  await browser.close();
  console.log('Finished capturing all 900 frames!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
