import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS_DIR = './shots';
const FRAMES_DIR = path.join(SHOTS_DIR, '_frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

const TOTAL_FRAMES = 900; // 30 seconds @ 30 fps
const DT_MS = 1000 / 30;

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

async function getElementCenter(page, selector) {
  const el = await page.$(selector);
  if (!el) return null;
  const box = await el.boundingBox();
  if (!box) return null;
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
}

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

  // Deterministic Virtual Clock Init Script (overrides Date.now, performance.now, requestAnimationFrame)
  await context.addInitScript(() => {
    let virtualPerfNow = 1000.0;
    let virtualDateNow = Date.UTC(2026, 9, 16, 9, 42, 30);
    let rafIdCounter = 1;
    let rafQueue = new Map();

    const origPerfNow = performance.now.bind(performance);
    performance.now = () => virtualPerfNow;
    Date.now = () => Math.round(virtualDateNow);

    window.requestAnimationFrame = (cb) => {
      const id = rafIdCounter++;
      rafQueue.set(id, cb);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      rafQueue.delete(id);
    };

    window.__advanceVirtualFrame = (dtMs) => {
      virtualPerfNow += dtMs;
      virtualDateNow += dtMs;
      const currentCallbacks = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of currentCallbacks) {
        try {
          cb(virtualPerfNow);
        } catch (err) {
          console.error(err);
        }
      }
    };

    // Visible Pointer Cursor Overlay
    window.addEventListener('DOMContentLoaded', () => {
      const cur = document.createElement('div');
      cur.id = '__virtual_cursor';
      cur.style.cssText = `
        position: fixed;
        left: 960px;
        top: 540px;
        width: 26px;
        height: 26px;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-3px, -2px);
      `;
      cur.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M4 3L12.5 23.5L15.8 15.8L23.5 12.5L4 3Z" fill="#0f172a" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
        </svg>
        <div id="__cursor_ring" style="
          position:absolute; left:-8px; top:-8px; width:28px; height:28px;
          border-radius:50%; border:2.5px solid #1d5bff; opacity:0;
          transform:scale(0.5); transition: transform 0.18s ease, opacity 0.18s ease;
        "></div>
      `;
      document.body.appendChild(cur);

      window.addEventListener(
        'mousemove',
        (e) => {
          cur.style.left = `${e.clientX}px`;
          cur.style.top = `${e.clientY}px`;
        },
        true
      );
      window.addEventListener(
        'mousedown',
        () => {
          const ring = document.getElementById('__cursor_ring');
          if (ring) {
            ring.style.opacity = '0.95';
            ring.style.transform = 'scale(1.35)';
          }
        },
        true
      );
      window.addEventListener(
        'mouseup',
        () => {
          const ring = document.getElementById('__cursor_ring');
          if (ring) {
            ring.style.opacity = '0';
            ring.style.transform = 'scale(0.5)';
          }
        },
        true
      );
    });
  });

  const page = await context.newPage();
  console.log('Loading http://localhost:5424 for 30s film capture...');
  await page.goto('http://localhost:5424', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Warm up 25 virtual frames so GLBs, shadows, and textures are 100% uploaded
  for (let w = 0; w < 25; w++) {
    await page.evaluate((dt) => window.__advanceVirtualFrame(dt), DT_MS);
    await page.waitForTimeout(15);
  }

  let cursorX = 960;
  let cursorY = 540;
  let isDragging = false;

  const moveCursorSmooth = async (targetX, targetY, alpha) => {
    const t = easeInOutQuad(Math.min(1, Math.max(0, alpha)));
    cursorX = cursorX + (targetX - cursorX) * t;
    cursorY = cursorY + (targetY - cursorY) * t;
    await page.mouse.move(cursorX, cursorY);
  };

  let targetCache = {};

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const sec = f / 30.0;

    // ================== 0 - 5s (Frames 0..149): Slow orbit over Port Solis Tower ==================
    if (f === 2) {
      cursorX = 680;
      cursorY = 480;
      await page.mouse.move(cursorX, cursorY);
      await page.mouse.down();
      isDragging = true;
    } else if (f > 2 && f < 146) {
      cursorX += 2.1;
      cursorY += Math.sin(f * 0.04) * 0.35;
      await page.mouse.move(cursorX, cursorY);
    } else if (f === 146 && isDragging) {
      await page.mouse.up();
      isDragging = false;
    }

    // ================== 5 - 12s (Frames 150..359): Click moving aircraft unit, card opens & updates live ==================
    if (f === 150) {
      targetCache.pinAzr =
        (await getElementCenter(page, '.pin-flight.status-approach')) ||
        (await getElementCenter(page, '[data-row-id="FLT-AZR402"]')) || { x: 860, y: 460 };
    }
    if (f > 150 && f < 172 && targetCache.pinAzr) {
      await moveCursorSmooth(targetCache.pinAzr.x, targetCache.pinAzr.y, (f - 150) / 22);
    }
    if (f === 172) {
      const freshPin =
        (await getElementCenter(page, '.pin-flight.status-approach')) ||
        (await getElementCenter(page, '[data-row-id="FLT-AZR402"]'));
      if (freshPin) {
        cursorX = freshPin.x;
        cursorY = freshPin.y;
        await page.mouse.click(cursorX, cursorY);
      }
    }
    // Issue a live controller climb clearance on the open detail card at ~8.5s (frame 255)
    if (f === 235) {
      targetCache.climbBtn = await getElementCenter(page, '.ctrl-btn');
    }
    if (f > 235 && f < 258 && targetCache.climbBtn) {
      await moveCursorSmooth(targetCache.climbBtn.x, targetCache.climbBtn.y, (f - 235) / 23);
    }
    if (f === 258 && targetCache.climbBtn) {
      await page.mouse.click(targetCache.climbBtn.x, targetCache.climbBtn.y);
    }
    // Gentle camera orbit while following selected aircraft (frames 265..355)
    if (f === 268) {
      cursorX = 880;
      cursorY = 520;
      await page.mouse.move(cursorX, cursorY);
      await page.mouse.down();
      isDragging = true;
    } else if (f > 268 && f < 355) {
      cursorX -= 1.3;
      await page.mouse.move(cursorX, cursorY);
    } else if (f === 355 && isDragging) {
      await page.mouse.up();
      isDragging = false;
    }

    // ================== 12 - 18s (Frames 360..539): Click a list row and camera flies there ==================
    if (f === 360) {
      targetCache.rowMrd = await getElementCenter(page, '[data-row-id="FLT-MRD801"]');
    }
    if (f > 360 && f < 385 && targetCache.rowMrd) {
      await moveCursorSmooth(targetCache.rowMrd.x, targetCache.rowMrd.y, (f - 360) / 25);
    }
    if (f === 385 && targetCache.rowMrd) {
      await page.mouse.click(targetCache.rowMrd.x, targetCache.rowMrd.y);
    }
    // At 15.2s (frame 456), click another list row (SKW-209 turboprop on approach)
    if (f === 440) {
      targetCache.rowSkw = await getElementCenter(page, '[data-row-id="FLT-SKW209"]');
    }
    if (f > 440 && f < 462 && targetCache.rowSkw) {
      await moveCursorSmooth(targetCache.rowSkw.x, targetCache.rowSkw.y, (f - 440) / 22);
    }
    if (f === 462 && targetCache.rowSkw) {
      await page.mouse.click(targetCache.rowSkw.x, targetCache.rowSkw.y);
    }

    // ================== 18 - 24s (Frames 540..719): Switch to another site (Solis Bay Approach) ==================
    if (f === 540) {
      targetCache.siteApp = await getElementCenter(page, '[data-site-id="approach"]');
    }
    if (f > 540 && f < 565 && targetCache.siteApp) {
      await moveCursorSmooth(targetCache.siteApp.x, targetCache.siteApp.y, (f - 540) / 25);
    }
    if (f === 565 && targetCache.siteApp) {
      await page.mouse.click(targetCache.siteApp.x, targetCache.siteApp.y);
    }
    // Click holding heavy flight MRD-904 in Approach TMA at frame 620
    if (f === 600) {
      targetCache.rowMrd904 = await getElementCenter(page, '[data-row-id="FLT-MRD904"]');
    }
    if (f > 600 && f < 622 && targetCache.rowMrd904) {
      await moveCursorSmooth(targetCache.rowMrd904.x, targetCache.rowMrd904.y, (f - 600) / 22);
    }
    if (f === 622 && targetCache.rowMrd904) {
      await page.mouse.click(targetCache.rowMrd904.x, targetCache.rowMrd904.y);
    }
    // Slow orbit over Approach TMA (frames 630..715)
    if (f === 630) {
      cursorX = 760;
      cursorY = 480;
      await page.mouse.move(cursorX, cursorY);
      await page.mouse.down();
      isDragging = true;
    } else if (f > 630 && f < 715) {
      cursorX += 1.4;
      await page.mouse.move(cursorX, cursorY);
    } else if (f === 715 && isDragging) {
      await page.mouse.up();
      isDragging = false;
    }

    // ================== 24 - 30s (Frames 720..899): Pull back to wide shot where site fills most of frame ==================
    if (f === 720) {
      targetCache.overviewBtn = await getElementCenter(page, '.cam-btn[title="Reset Sector Overview"]');
    }
    if (f > 720 && f < 742 && targetCache.overviewBtn) {
      await moveCursorSmooth(targetCache.overviewBtn.x, targetCache.overviewBtn.y, (f - 720) / 22);
    }
    if (f === 742 && targetCache.overviewBtn) {
      await page.mouse.click(targetCache.overviewBtn.x, targetCache.overviewBtn.y);
    }
    // Click empty ground at frame 755 to close the right detail card cleanly
    if (f === 755) {
      cursorX = 480;
      cursorY = 320;
      await page.mouse.click(cursorX, cursorY);
    }
    // Smooth wide orbit + gentle wheel pullback across frames 760..899
    if (f === 760) {
      cursorX = 820;
      cursorY = 460;
      await page.mouse.move(cursorX, cursorY);
      await page.mouse.down();
      isDragging = true;
    } else if (f > 760 && f < 898) {
      cursorX -= 1.5;
      cursorY += Math.cos(f * 0.05) * 0.25;
      await page.mouse.move(cursorX, cursorY);
      if (f % 28 === 0 && f < 830) {
        await page.mouse.wheel(0, 65);
      }
    } else if (f === 898 && isDragging) {
      await page.mouse.up();
      isDragging = false;
    }

    // Advance virtual simulation clock by 1/30s and capture frame
    await page.evaluate((dt) => window.__advanceVirtualFrame(dt), DT_MS);
    const framePath = path.join(FRAMES_DIR, `frame_${String(f).padStart(4, '0')}.jpg`);
    await page.screenshot({ path: framePath, type: 'jpeg', quality: 94 });

    if (f % 150 === 0 || f === TOTAL_FRAMES - 1) {
      console.log(`Captured frame ${f + 1}/${TOTAL_FRAMES} (${sec.toFixed(1)}s)`);
    }
  }

  await browser.close();
  console.log('All 900 frames captured. Encoding shots/film.mp4 ...');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
