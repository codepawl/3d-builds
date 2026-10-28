// Frame-time breakdown at the worm cap. Usage: node perf.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('pageerror', (error) => console.log('pageerror', error.message.slice(0, 200)));
await page.goto('http://127.0.0.1:5471/?manual=1', { waitUntil: 'domcontentloaded' });
for (let attempt = 0; attempt < 900; attempt++) {
  if (await page.evaluate(() => window.__app?.sceneReady)) break;
  await page.waitForTimeout(100);
}
const result = await page.evaluate(() => {
  const debug = window.__debug;
  const gl = document.getElementById('view').getContext('webgl2');
  debug.swarm.spawn(14, 9, 1488);
  window.__app.step(120, false);
  const time = (label, work, runs = 10) => {
    work();
    gl.finish();
    const start = Date.now();
    for (let index = 0; index < runs; index++) work();
    gl.finish();
    return [label, (Date.now() - start) / runs];
  };
  const out = [];
  out.push(time('sim step', () => window.__app.step(1, false)));
  out.push(time('worm mesh update (JS)', () => debug.wormRenderer.update(1)));
  out.push(time('full render', () => window.__app.render()));
  debug.sun.castShadow = false;
  out.push(time('render, no shadows', () => window.__app.render()));
  debug.sun.castShadow = true;
  debug.wormRenderer.mesh.visible = false;
  out.push(time('render, no worms', () => window.__app.render()));
  debug.wormRenderer.mesh.visible = true;
  debug.creatures.group.visible = false;
  out.push(time('render, no creatures', () => window.__app.render()));
  debug.creatures.group.visible = true;
  debug.sun.castShadow = false;
  debug.scene.children.forEach((child, index) => {
    if (child.isLight) return;
    child.visible = false;
    out.push(time(`hide #${index} ${child.type} kids=${child.children.length} tris~${child.geometry ? (child.geometry.index ? child.geometry.index.count / 3 : 0) : 0}`, () => window.__app.render(), 4));
    child.visible = true;
  });
  return out;
});
console.log(JSON.stringify(result));
await browser.close();
