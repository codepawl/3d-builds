// Stills of the launch cycle at chosen tau values (verification only; jumps sim time with tideline.skip).
// node tools/flight.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
await page.goto('http://localhost:5426/')
await page.waitForFunction(() => window.tideline && document.querySelectorAll('.pin').length > 3, null, { timeout: 60000 })
await page.waitForTimeout(1500)
const stills = [
  ['flight-ascent', 3, [20, 110, 30], -0.85, 0.12, 420],
  ['flight-high', 7, [80, 380, 30], -0.85, 0.05, 700],
  ['flight-boostback', 11.5, [40, 450, 30], -0.85, 0.05, 900],
  ['flight-landing', 19.6, [0, 70, 30], -0.85, 0.12, 330],
  ['flight-catch', 21.6, [0, 70, 30], -0.85, 0.12, 330],
  ['stack-lift', 40 + 140 - 104, [10, 60, 20], -0.85, 0.15, 320],
  ['stack-swing', 40 + 140 - 96, [10, 90, 20], -0.85, 0.15, 320],
]
for (const [name, tau, target, yaw, pitch, distance] of stills) {
  await page.evaluate(({ tau, target, yaw, pitch, distance }) => {
    const world = window.tideline.world
    const now = ((world.time - 8.5 + 140) % 180) - 140
    let delta = tau - now
    if (delta < 0) delta += 180
    window.tideline.skip(delta)
    window.tideline.look(target, yaw, pitch, distance)
  }, { tau, target, yaw, pitch, distance })
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })
  console.log('shot', name)
}
console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
