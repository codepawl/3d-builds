// Performance probe: draw calls and fps with the shadow pass on and off. node tools/probe.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('http://localhost:5425/')
await page.waitForFunction(() => window.waferlineRenderer && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(4000)
const fps = () => page.evaluate(() => new Promise((resolve) => {
  let frames = 0
  const start = performance.now()
  const count = () => { frames++; if (performance.now() - start < 3000) requestAnimationFrame(count); else resolve(frames * 1000 / (performance.now() - start)) }
  requestAnimationFrame(count)
}))
const calls = () => page.evaluate(() => new Promise((resolve) => {
  const info = window.waferlineRenderer.info
  info.autoReset = false
  info.reset()
  requestAnimationFrame(() => requestAnimationFrame(() => { const result = { calls: info.render.calls, triangles: info.render.triangles }; info.autoReset = true; resolve(result) }))
}))
console.log('base', (await fps()).toFixed(1), JSON.stringify(await calls()))
await page.evaluate(() => { window.waferlineRenderer.shadowMap.autoUpdate = false })
console.log('no shadow updates', (await fps()).toFixed(1), JSON.stringify(await calls()))
await page.evaluate(() => { window.waferlineRenderer.shadowMap.autoUpdate = true })
const timing = await page.evaluate(() => new Promise((resolve) => {
  const samples = []
  let last = performance.now()
  const tick = () => { const now = performance.now(); samples.push(now - last); last = now; if (samples.length < 120) requestAnimationFrame(tick); else resolve(samples.sort((a, b) => a - b)) }
  requestAnimationFrame(tick)
}))
console.log('frame ms p50', timing[60].toFixed(1), 'p90', timing[108].toFixed(1))
await browser.close()
