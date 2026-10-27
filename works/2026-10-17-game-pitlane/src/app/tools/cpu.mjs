// Measures JS time spent inside animation-frame callbacks (CPU side of each frame) next to the frame rate.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => {
  const original = window.requestAnimationFrame.bind(window)
  window.frameWork = []
  window.requestAnimationFrame = (callback) => original((time) => {
    const start = performance.now()
    callback(time)
    window.frameWork.push(performance.now() - start)
  })
})
await page.goto(process.env.BOXLINE_URL ?? 'http://localhost:5439/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { window.frameWork = [] })
await page.waitForTimeout(4000)
console.log(await page.evaluate(() => {
  const work = window.frameWork.slice().sort((a, b) => a - b)
  const mean = work.reduce((sum, value) => sum + value, 0) / work.length
  return `frames ${work.length} in 4 s (${(work.length / 4).toFixed(1)} fps), CPU per frame mean ${mean.toFixed(1)} ms, p95 ${work[Math.floor(work.length * 0.95)].toFixed(1)} ms`
}))
await browser.close()
