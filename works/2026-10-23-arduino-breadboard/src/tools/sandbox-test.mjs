// Drives Build your own with the real mouse: tray -> board, wires, Run. node tools/sandbox-test.mjs out_dir
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = process.argv[2] ?? 'shots/dev'
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (message.type() === 'error' && !/404/.test(message.text())) problems.push(message.text().slice(0, 300)) })
page.on('pageerror', (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`))
await page.goto('http://127.0.0.1:5244/')
await page.waitForFunction(() => window.__app && window.__camera, null, { timeout: 30000 })
await page.evaluate(() => { localStorage.removeItem('hookup-sandbox-v1'); window.__app.go(6, 0) })
await page.waitForTimeout(3000)

const at = (ref) => page.evaluate((r) => window.__app.at(r), ref)
const chip = async (id) => {
  const box = await page.locator(`[data-item="${id}"]`).boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function dragTo(from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 })
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.waitForTimeout(150)
  await page.mouse.up()
}
await dragTo(await chip('res-220'), await at([12, 'c']))
await page.waitForTimeout(900)
await dragTo(await chip('led-red'), await at([16, 'e']))
await page.waitForTimeout(900)
await page.screenshot({ path: `${outDir}/sandbox-parts.png` })
await dragTo(await at({ uno: '13' }), await at([12, 'a']))
await page.waitForTimeout(500)
await dragTo(await at([17, 'a']), await at({ rail: 'botMinus', i: 9 }))
await page.waitForTimeout(500)
await dragTo(await at({ uno: 'GND' }), await at({ rail: 'botMinus', i: 2 }))
await page.waitForTimeout(800)
await page.screenshot({ path: `${outDir}/sandbox-wired.png` })
await page.getByRole('button', { name: 'Run' }).click()
await page.evaluate(() => window.__app.setCurrent(true))
await page.waitForTimeout(1300)
await page.screenshot({ path: `${outDir}/sandbox-run.png` })
console.log(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('hookup-sandbox-v1')))))
console.log('problems', JSON.stringify(problems.slice(0, 6)))
await browser.close()
