// Takes the four review screenshots plus one close-up per asset type, and measures frame rate at 1920x1080.
import { openPage, clickOrglet } from './browser.mjs';

import { mkdirSync } from 'node:fs';

const SHOTS = './shots/blender';
mkdirSync(SHOTS, { recursive: true });

// Close-ups fly the camera to a room of a kind (or a point on the grounds) through the same request the lists use.
const CLOSE_UPS = [
  ['05-desks-chairs-monitors', { kind: 'code', distance: 10 }],
  ['06-lead-desk', { kind: 'lead', distance: 11 }],
  ['07-approval-kiosks', { kind: 'approvals', distance: 9 }],
  ['08-routines-board', { kind: 'routines', distance: 9, board: true }],
  ['09-walls-floor-shelf', { kind: 'research', distance: 11 }],
  ['10-plants-trees', { x: -16, z: 9, distance: 12 }],
];

async function closeUp(request) {
  await page.evaluate((target) => {
    const world = window.__office.world;
    const space = world.spaces.find((candidate) => candidate.id === world.activeSpaceId);
    const room = target.kind ? space.rooms.find((candidate) => candidate.kind === target.kind) : target;
    // The routines board stands by the door of a front-row room; aim at it rather than the room centre.
    const boardOffset = target.board ? { x: -room.width / 2 + 1.5, z: -room.depth / 2 + 1 } : { x: 0, z: 0 };
    world.cameraRequest = { x: room.x + boardOffset.x, z: room.z + boardOffset.z, distance: target.distance };
  }, request);
  await page.waitForTimeout(2500);
}
const { browser, page, errors } = await openPage();
await page.waitForTimeout(5000);

const frameRate = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames += 1;
        if (performance.now() - start < 3000) {
          requestAnimationFrame(count);
        } else {
          resolve((frames * 1000) / (performance.now() - start));
        }
      }
      requestAnimationFrame(count);
    }),
);
console.log('fps', frameRate.toFixed(1));
console.log('renderer', await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
}));

await page.screenshot({ path: `${SHOTS}/01-overview.png` });

// Real-time frame deltas vary run to run, so by default pick a working orglet that is not under a panel.
const orgletName = process.argv[2] ?? (await page.evaluate(() => {
  const world = window.__office.world;
  const space = world.spaces.find((candidate) => candidate.id === world.activeSpaceId);
  const isClear = (orglet) => {
    const point = window.__office.project({ type: 'orglet', id: orglet.id });
    return document.elementFromPoint(point.x, point.y)?.tagName === 'CANVAS';
  };
  const candidates = space.orglets.filter((orglet) => !orglet.lead && isClear(orglet));
  return (candidates.find((orglet) => orglet.phase === 'working') ?? candidates[0]).name;
}));
console.log('selecting', orgletName);
await clickOrglet(page, orgletName);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/02-selected.png` });

// Clicking the selected orglet's row flies the camera in close.
await page.click('.rows button.is-selected');
await page.waitForTimeout(2200);
await page.screenshot({ path: `${SHOTS}/04-closeup.png` });

for (const [name, request] of CLOSE_UPS) {
  await closeUp(request);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

await page.click('.space-button');
await page.waitForTimeout(300);
await page.click('.space-menu li:nth-child(2) button');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOTS}/03-second-space.png` });

console.log('errors', JSON.stringify(errors.slice(0, 5)));
await browser.close();
