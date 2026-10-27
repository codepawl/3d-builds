// Screenshots for review at 1920x1080 on a virtual clock: node tools/shoot.mjs [shot names...]
// Also measures real fps (no virtual clock) with: node tools/shoot.mjs fps
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shotsDir = path.join(root, 'shots')
fs.mkdirSync(shotsDir, { recursive: true })
const URL = process.env.BOXLINE_URL ?? 'http://localhost:5429/'
const wanted = process.argv.slice(2)
const args = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

function virtualClock() {
  let now = 0
  window.filmMode = true
  let nextId = 1
  const callbacks = new Map()
  window.requestAnimationFrame = (callback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => callbacks.delete(id)
  performance.now = () => now
  const epoch = Date.UTC(2026, 9, 18, 13, 0)
  Date.now = () => epoch + now
  window.advanceVirtualFrame = (milliseconds) => {
    now += milliseconds
    const due = [...callbacks.values()]
    callbacks.clear()
    due.forEach((callback) => callback(now))
  }
}

const browser = await chromium.launch({ headless: true, args })

if (wanted[0] === 'fps') {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(URL)
  await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
  await page.waitForTimeout(4000)
  for (const label of ['overview', 'close']) {
    if (label === 'close') {
      await page.evaluate(() => window.boxline.lookAt([20, 30, -20], [6, 0, 14]))
      await page.waitForTimeout(1500)
    }
    const result = await page.evaluate(() => new Promise((resolve) => {
      const times = []
      const start = performance.now()
      const tick = (time) => {
        times.push(time)
        if (time - start < 5000) requestAnimationFrame(tick)
        else {
          const gaps = times.slice(1).map((value, index) => value - times[index]).sort((a, b) => a - b)
          resolve({ fps: (times.length - 1) / ((times.at(-1) - times[0]) / 1000), p95: gaps[Math.floor(gaps.length * 0.95)] })
        }
      }
      requestAnimationFrame(tick)
    }))
    const info = await page.evaluate(() => window.boxlineRenderer.info.render)
    console.log(label, `fps ${result.fps.toFixed(1)}, p95 frame ${result.p95.toFixed(1)} ms, draw calls ${info.calls}, triangles ${info.triangles}`)
  }
  await browser.close()
  process.exit(0)
}

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(virtualClock)
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text())
})
await page.goto(URL)
const step = (frames = 1) => page.evaluate((count) => {
  for (let index = 0; index < count; index++) window.advanceVirtualFrame(1000 / 30)
}, frames)
for (let index = 0; index < 900; index++) {
  await step(1)
  if (index % 20 === 0 && (await page.evaluate(() => Boolean(window.boxline) && document.querySelectorAll('.row').length > 0))) break
  await page.waitForTimeout(15)
}
await step(60)

async function shot(name) {
  await step(2)
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`) })
  console.log('shot', name)
}
const want = (name) => wanted.length === 0 || wanted.includes(name)
const lookAt = (position, target) => page.evaluate(([from, to]) => window.boxline.lookAt(from, to), [position, target])
const stopPhase = () => page.evaluate(() => {
  const box = window.boxline.site().boxes.find((candidate) => candidate.team === 'halvard')
  return { phase: box.phase, t: box.stopTime }
})
const clickEntity = async (id) => {
  const point = await page.evaluate((entityId) => window.boxline.screenPosition(entityId, 0.5), id)
  await page.mouse.click(point.x, point.y)
}

if (want('overview')) {
  await step(150)
  await shot('overview')
}
if (want('selected') || want('pitstop')) {
  // Run the race until car 07 is stationary in its box, then click it for real.
  const carInPit = () => page.evaluate(() => { const car = window.boxline.site().cars.find((candidate) => candidate.id === 'car07'); return car.mode === 'pit' && car.pitLeg === 'entry' && car.u > 120 })
  for (let guard = 0; guard < 4000; guard++) {
    if (await carInPit()) break
    await step(3)
  }
  await page.evaluate(() => window.boxline.lookAt([-40, 60, -50], [-20, 0, 8]))
  await step(2)
  await clickEntity('car07')
  for (let guard = 0; guard < 400; guard++) {
    const { phase, t } = await stopPhase()
    if (phase === 'stop' && t > 0.9) break
    await step(1)
  }
  await shot('selected')
  await page.keyboard.press('Escape')
  await lookAt([12, 9, 3], [6, 0.5, 14])
  await step(2)
  await shot('pitstop')
}
if (want('garage')) {
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'garage_6' }))
  await lookAt([4, 13, 8], [7, 1, 27])
  await shot('closeup-garage')
}
if (want('paddock')) {
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'truck_halvard' }))
  await lookAt([-30, 40, 20], [0, 0, 60])
  await shot('closeup-paddock')
}
if (want('track')) {
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'grandstand_2' }))
  await lookAt([-40, 30, 30], [-12, 2, -18])
  await shot('closeup-grandstand')
}
if (want('post')) {
  const post = await page.evaluate(() => { const item = window.boxline.site().marshalPosts[2]; return { x: item.x, z: item.z } })
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'post_3' }))
  await lookAt([post.x + 16, 14, post.z + 16], [post.x, 1, post.z])
  await shot('closeup-marshal-post')
}
if (want('roadcars')) {
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'safety_car' }))
  await lookAt([76, 8, 4], [84, 0.5, 14])
  await shot('closeup-safety-car')
}
if (want('racks')) {
  await page.evaluate(() => window.boxline.setUi({ selectedId: 'rack_halvard_soft' }))
  await lookAt([-2, 5, 12], [2, 0.8, 20])
  await shot('closeup-tyre-racks')
}
if (want('car')) {
  const id = 'car22'
  await page.evaluate((carId) => window.boxline.select(carId), id)
  await step(60)
  await shot('closeup-car-on-track')
}
if (want('site2')) {
  await page.keyboard.press('Escape')
  await page.mouse.click(...Object.values(await page.evaluate(() => { const box = document.querySelector('.site-button').getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } })))
  await step(4)
  await page.locator('.site-menu button').nth(1).click()
  await step(90)
  await shot('site-lumen')
  await page.evaluate(() => window.boxline.lookAt([30, 40, -40], [6, 0, 14]))
  await step(4)
  await shot('site-lumen-close')
}
if (want('site3')) {
  await page.evaluate(() => window.boxline.setUi({ siteId: 'sahra', selectedId: null }))
  await step(90)
  await page.evaluate(() => window.boxline.lookAt([140, 260, -300], [4, 0, -40]))
  await step(4)
  await shot('site-sahra-wide')
}
console.log(problems.length ? `problems: ${[...new Set(problems)].slice(0, 6).join(' | ')}` : 'no page errors')
await browser.close()
