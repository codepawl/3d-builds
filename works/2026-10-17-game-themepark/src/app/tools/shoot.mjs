// Screenshots, close-ups and an fps measurement at 1920x1080: node tools/shoot.mjs [only-name ...]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const only = process.argv.slice(2)
fs.mkdirSync(path.join(root, 'shots', 'closeups'), { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()))
await page.goto('http://localhost:5431/')
await page.waitForFunction(() => document.querySelectorAll('.row').length > 0 && window.parkScreenPosition, null, { timeout: 120000 })
await page.waitForTimeout(12000)

const want = (name) => !only.length || only.some((prefix) => name.startsWith(prefix))
const shot = (name) => page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })
const stats = () => page.evaluate(() => `${window.parkStats?.calls} calls, ${Math.round((window.parkStats?.triangles ?? 0) / 1000)}k tris`)

async function measureFps(seconds = 4) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const times = []
        const start = performance.now()
        const tick = (now) => {
          times.push(now)
          if (now - start < duration * 1000) requestAnimationFrame(tick)
          else {
            const gaps = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b)
            resolve({ fps: +(((times.length - 1) / (times.at(-1) - times[0])) * 1000).toFixed(1), p95ms: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1) })
          }
        }
        requestAnimationFrame(tick)
      }),
    seconds,
  )
}

async function switchTo(siteId) {
  await page.click('.site-button')
  await page.click(`.site-menu button[data-site="${siteId}"]`)
  await page.waitForTimeout(3500)
}

async function closeup(name, position, target) {
  if (!want(`closeups/${name}`)) return
  await page.evaluate(([from, to]) => window.parkLookAt(from, to), [position, target])
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(root, 'shots', 'closeups', `${name}.png`) })
}

async function clickEntity(id) {
  const point = await page.evaluate((entityId) => window.parkScreenPosition(entityId), id)
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(1200)
  return page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? 'no card')
}

const report = {}
if (want('overview')) {
  await shot('overview')
  report.overview = { ...(await measureFps()), draws: await stats() }
}
if (want('selected')) {
  await page.evaluate(() => window.parkLookAt([-10, 90, 60], [0, 8, -30]))
  await page.waitForTimeout(800)
  report.selectedCard = await clickEntity('RR-1')
  await page.waitForTimeout(1500)
  await shot('selected')
  await page.keyboard.press('Escape')
}
if (want('closeups')) {
  await closeup('coaster-lift', [10, 45, 15], [0, 18, -50])
  await closeup('coaster-station', [-30, 22, -20], [-36, 2, -52])
  await closeup('flume', [-20, 30, 70], [-40, 5, 32])
  await closeup('ferris', [60, 30, 70], [96, 22, 28])
  await closeup('temple', [20, 30, 80], [42, 6, 34])
  await closeup('queue', [-40, 14, -40], [-36, 0, -60])
  await closeup('crowd', [10, 14, 22], [6, 0, 0])
  await closeup('monorail', [110, 20, 20], [132, 6, -8])
  await closeup('stands', [-10, 14, 22], [-18, 1, 6])
}
for (const [siteId, name, closeups] of [
  ['SP', 'site-space', [['space', [30, 40, 50], [-4, 8, -20]], ['space-wheel', [70, 30, 20], [46, 20, -32]]]],
  ['FT', 'site-fairytale', [['castle', [30, 40, 30], [0, 10, -30]], ['carousel', [-20, 14, 40], [-36, 3, 20]], ['floats', [10, 20, 70], [0, 1, 46]], ['tale', [60, 30, 50], [40, 6, 18]]]],
  ['EN', 'site-entrance', [['gate', [20, 30, 50], [0, 6, 4]], ['parking', [50, 40, 130], [10, 0, 75]], ['tram', [-20, 15, 40], [0, 1, 25]]]],
]) {
  if (!want(name) && !closeups.some(([closeupName]) => want(`closeups/${closeupName}`))) continue
  await switchTo(siteId)
  if (want(name)) {
    await shot(name)
    report[name] = { ...(await measureFps(3)), draws: await stats() }
  }
  for (const [closeupName, from, to] of closeups) await closeup(closeupName, from, to)
}
console.log(JSON.stringify(report, null, 1))
console.log(problems.length ? `problems: ${[...new Set(problems)].slice(0, 8).join(' | ')}` : 'no page errors')
await browser.close()
