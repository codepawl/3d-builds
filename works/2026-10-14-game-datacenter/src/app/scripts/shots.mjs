// Screenshots of the running app at 1920x1080: overview, a selected unit, a second site and a close-up.
// Usage: node scripts/shots.mjs [baseUrl] [subfolder of shots/]   (dev server on port 5421 must be running)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shotsDirectory = path.join(root, 'shots', process.argv[3] ?? '')
mkdirSync(shotsDirectory, { recursive: true })
const baseUrl = process.argv[2] ?? 'http://localhost:5421/'

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`)
})
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))

async function save(name) {
  await page.screenshot({ path: path.join(shotsDirectory, `${name}.png`) })
  console.log('saved', name)
}

async function measureFps(seconds = 3) {
  return page.evaluate((duration) => new Promise((resolve) => {
    let frames = 0
    const start = performance.now()
    function count() {
      frames += 1
      if (performance.now() - start < duration * 1000) requestAnimationFrame(count)
      else resolve(frames / ((performance.now() - start) / 1000))
    }
    requestAnimationFrame(count)
  }), seconds)
}

await page.goto(baseUrl)
await page.waitForTimeout(6000)
console.log('fps overview', (await measureFps()).toFixed(1))
await save('01-overview')

// Click a moving unit while it is in an open side corridor.
let target = null
for (let attempt = 0; attempt < 60 && !target; attempt++) {
  const units = await page.evaluate(() => window.kelvin.units())
  target = units.find((unit) => unit.state === 'moving' && unit.inCorridor)
  if (!target) await page.waitForTimeout(250)
}
const point = await page.evaluate((id) => window.kelvin.screenPositionOf(id), target.id)
await page.mouse.click(point.x, point.y)
await page.waitForTimeout(2500)
await save('02-selected-unit')

// Close-up: a rack from the Jobs list.
await page.click('[data-tab="jobs"]')
await page.click('.rows li:first-child .row')
await page.waitForTimeout(2500)
await page.mouse.click(960, 560)
await page.waitForTimeout(800)
await page.click('[data-testid="camera-plus"]')
await page.waitForTimeout(1500)
console.log('fps close-up', (await measureFps()).toFixed(1))
await save('03-close-up')

// Second site.
await page.click('[data-testid="site-switcher"]')
await page.click('[data-site="h2"]')
await page.waitForTimeout(4000)
await save('04-second-site')

await page.click('[data-testid="site-switcher"]')
await page.click('[data-site="h3"]')
await page.waitForTimeout(4000)
await save('05-third-site')

console.log(problems.length ? problems.slice(0, 15).join('\n') : 'no console errors')
await browser.close()
