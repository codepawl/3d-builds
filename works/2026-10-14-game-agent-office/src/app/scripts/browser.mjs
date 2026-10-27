import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const APP_URL = 'http://localhost:5422/';

export async function openPage(initScript) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  if (initScript) {
    await page.addInitScript(initScript);
  }
  await page.goto(APP_URL);
  // Under the film's virtual clock nothing animates unless frames are advanced, so advance while waiting.
  await page.waitForFunction(() => {
    window.__advanceFrame?.();
    return window.__office?.project;
  }, null, { polling: 100 });
  return { browser, page, errors };
}

export async function clickOrglet(page, name) {
  const point = await page.evaluate((orgletName) => {
    const space = window.__office.world.spaces.find((candidate) => candidate.id === window.__office.world.activeSpaceId);
    const orglet = space.orglets.find((candidate) => candidate.name === orgletName);
    return window.__office.project({ type: 'orglet', id: orglet.id });
  }, name);
  await page.mouse.click(point.x, point.y);
  return point;
}
