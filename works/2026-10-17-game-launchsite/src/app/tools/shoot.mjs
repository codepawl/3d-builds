// Verification screenshots at 1920x1080: node tools/shoot.mjs [name ...]. Writes shots/<name>.png and prints fps.
// Close-ups jump the camera with window.tideline.look (verification only; the film uses real input).
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const only = process.argv.slice(2)

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()) })
await page.goto('http://localhost:5426/')
await page.waitForFunction(() => window.tideline && document.querySelectorAll('.pin').length > 3, null, { timeout: 60000 })
await page.waitForTimeout(2500)

const want = (name) => only.length === 0 || only.includes(name)
async function snap(name) {
  await page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })
  console.log('shot', name)
}
async function look(site, target, yaw, pitch, distance, wait = 1200) {
  await page.evaluate(({ site, target, yaw, pitch, distance }) => {
    if (window.tideline.ui().siteId !== site) window.tideline.switchSite(site)
    setTimeout(() => window.tideline.look(target, yaw, pitch, distance), 50)
  }, { site, target, yaw, pitch, distance })
  await page.waitForTimeout(wait)
}

if (want('overview')) {
  await page.waitForTimeout(500)
  const fps = await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(window.__fps), 3000)))
  console.log('fps overview', fps.toFixed(1))
  await snap('overview')
}
if (want('selected')) {
  const point = await page.evaluate(() => window.tideline.screenOf('tk-201', 2))
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(2500)
  await snap('selected')
  await page.keyboard.press('Escape')
}
const closeups = [
  ['closeup-tower', 'lc1', [0, 60, 20], 0.9, 0.22, 260],
  ['closeup-farm', 'lc1', [-135, 12, -45], 0.6, 0.42, 190],
  ['closeup-boat', 'lc1', [430, 4, 40], 0.8, 0.3, 200],
  ['closeup-checkpoint', 'lc1', [-262, 3, 222], 0.7, 0.35, 70],
  ['site-lc2', 'lc2', [-10, 25, 0], 0.95, 0.42, 380],
  ['closeup-crane', 'lc2', [5, 50, -20], 2.3, 0.2, 240],
  ['site-ts3', 'ts3', [-10, 18, 0], 0.8, 0.45, 300],
  ['closeup-stand', 'ts3', [0, 30, 0], 0.6, 0.2, 140],
  ['site-yard', 'yard', [-10, 20, 40], 0.6, 0.5, 520],
  ['closeup-yard', 'yard', [0, 30, 80], 0.3, 0.3, 230],
]
for (const [name, site, target, yaw, pitch, distance] of closeups) {
  if (!want(name)) continue
  await look(site, target, yaw, pitch, distance, 2200)
  await snap(name)
}
for (const [name, site, rowId] of [['closeup-spmt', 'yard', 'sp-52'], ['closeup-ship-spmt', 'yard', 'sp-58'], ['closeup-tanker', 'lc1', 'tk-207']]) {
  if (!want(name)) continue
  await page.evaluate((site) => { if (window.tideline.ui().siteId !== site) window.tideline.switchSite(site) }, site)
  await page.waitForTimeout(800)
  await page.click(`.row[data-id="${rowId}"]`)
  await page.waitForTimeout(3500)
  await snap(name)
  await page.keyboard.press('Escape')
}
if (want('fps-liftoff')) {
  await look('lc1', [0, 60, 30], -0.85, 0.3, 420, 600)
  await page.evaluate(() => { const world = window.tideline.world; const now = ((world.time - 8.5 + 140) % 180) - 140; let delta = -0.5 - now; if (delta < 0) delta += 180; window.tideline.skip(delta) })
  const fps = await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(window.__fps), 2500)))
  console.log('fps lc1 liftoff', fps.toFixed(1), 'particles', await page.evaluate(() => window.tideline.world.particles.age.filter((age, index) => age < window.tideline.world.particles.life[index]).length))
  await snap('liftoff')
}
if (want('fps')) {
  await look('lc1', [-20, 20, 30], 0.72, 0.5, 620, 1500)
  const fps = await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(window.__fps), 4000)))
  console.log('fps lc1 overview', fps.toFixed(1))
}
console.log(problems.length ? problems.slice(0, 8).join('\n') : 'no page errors')
await browser.close()
