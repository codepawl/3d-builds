// Screenshots of the required views at 1920x1080, driven by real clicks, plus fps per scale.
// Usage: node tools/shoot.mjs (dev server on 5432). Output: shots/*.png and shots/fps.json.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('<your folder>/orglet/node_modules/playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shots = path.join(root, 'shots')
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text().slice(0, 300)}`)
})

const wait = (milliseconds) => page.waitForTimeout(milliseconds)
const shoot = async (name) => {
  await page.screenshot({ path: path.join(shots, `${name}.png`) })
  console.log('shot', name)
}
const clickText = async (text) => page.getByRole('button', { name: text, exact: true }).first().click()
const clickAnchor = async (key) => {
  const point = await page.evaluate((anchorKey) => window.appProject(anchorKey), key)
  await page.mouse.click(point.x, point.y)
}
async function measureFps(label) {
  await wait(500)
  const result = await page.evaluate(() => new Promise((resolve) => {
    const start = performance.now()
    let frames = 0
    const tick = () => {
      frames++
      if (performance.now() - start < 3000) requestAnimationFrame(tick)
      else resolve(frames / ((performance.now() - start) / 1000))
    }
    requestAnimationFrame(tick)
  }))
  console.log('fps', label, result.toFixed(1))
  return result
}

const fps = {}
await page.goto('http://localhost:5432/')
await page.waitForSelector('canvas')
await wait(1500)
await shoot('00-warning')
await clickText('Continue')
await wait(3500)
await shoot('00-title')
await clickText('Open the case file')
await wait(3500)
await shoot('01-county')
fps.county = await measureFps('county')

await clickAnchor('pinegrove')
await wait(3000)
await shoot('02-place-card')

await page.locator('[data-event="DAY"]').click()
await wait(1500)
await page.locator('[data-event="e1700"]').click()
await wait(4000)
await shoot('03-village-dusk')
fps.village = await measureFps('village')

await clickText('Clues')
await wait(500)
await page.locator('[data-clue="c6"]').click()
await wait(10000)
await shoot('04-farm-night')
fps.farm = await measureFps('farm')

await page.locator('[data-clue="c1"]').click()
await wait(3500)
await shoot('05-clue-chain')

await clickText('Sources')
await wait(1200)
await shoot('06-sources')
await page.keyboard.press('Escape')
await wait(400)

await clickText('Quotes')
await clickText('Whole case')
await wait(3500)
await shoot('07-whole-case')

await page.locator('[data-event="e0930"]').count().then(async (count) => {
  if (count === 0) await page.locator('[data-event="DAY"]').click()
})
await wait(800)
await page.locator('[data-event="e0930"]').click()
await wait(3500)
await shoot('08-village-morning-truck')
await clickText('People')
await page.locator('[data-event="enight"]').click()
await wait(3500)
await shoot('09-farm-direct')

fs.writeFileSync(path.join(shots, 'fps.json'), JSON.stringify({ fps, problems }, null, 2))
console.log('problems', problems.length)
for (const problem of [...new Set(problems)].slice(0, 15)) console.log(' ', problem)
await browser.close()
