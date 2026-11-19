// Screenshots at the real window size: node tools/shoot.mjs <name> [cameraX,Y,Z] [targetX,Y,Z] [extra seconds]
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const outputDir = 'shots'
fs.mkdirSync(outputDir, { recursive: true })
const views = JSON.parse(process.argv[2])
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console ${message.text().slice(0, 300)}`)
})
const startedAt = Date.now()
await page.goto(`http://localhost:5493/?preroll=240&${process.argv[3] ?? ''}`)
await page.waitForFunction(() => window.__app?.ready, null, { timeout: 180000 })
console.log('ready after', Date.now() - startedAt, 'ms')
await page.waitForTimeout(2500)
for (const view of views) {
  if (view.camera) await page.evaluate(({ camera, target }) => window.__app.setView(camera, target), view)
  await page.waitForTimeout(view.wait ?? 1500)
  await page.screenshot({ path: `${outputDir}/${view.name}.png` })
  console.log('shot', view.name)
}
const stats = await page.evaluate(() => {
  const sim = window.__app.sim
  return { time: sim.time, shipped: sim.shipped.length, kpis: document.getElementById('kpis').innerText.replace(/\n/g, ' ') }
})
console.log(stats, problems.slice(0, 8))
await browser.close()
