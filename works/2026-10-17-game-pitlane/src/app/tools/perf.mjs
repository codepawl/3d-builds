// Frame-time experiments: toggles features one at a time and measures fps for each.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('http://localhost:5429/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(3000)
const measure = () => page.evaluate(() => new Promise((resolve) => {
  const times = []
  const tick = (time) => {
    times.push(time)
    if (times.length < 120) requestAnimationFrame(tick)
    else resolve(((times.length - 1) / ((times.at(-1) - times[0]) / 1000)).toFixed(1))
  }
  requestAnimationFrame(tick)
}))
console.log('stats', await page.evaluate(() => {
  let meshes = 0
  let instanced = 0
  window.boxlineScene.traverse((object) => { if (object.isInstancedMesh) instanced++; else if (object.isMesh) meshes++ })
  return { meshes, instanced, gpu: window.boxlineRenderer.getContext().getParameter(window.boxlineRenderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) }
}))
console.log('baseline', await measure())
await page.evaluate(() => { window.boxlineRenderer.shadowMap.enabled = false; window.boxlineScene.traverse((object) => { if (object.material) object.material.needsUpdate = true }) })
await page.waitForTimeout(800)
console.log('no shadows', await measure())
await page.evaluate(() => { window.boxlineScene.traverse((object) => { if (object.isGroup && object.children.some((child) => child.name.startsWith('crew_') || child.name.startsWith('mechanic') || child.name.startsWith('marshal'))) object.visible = false }) })
console.log('no shadows, no people', await measure())
await browser.close()
