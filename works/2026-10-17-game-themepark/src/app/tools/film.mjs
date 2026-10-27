// Records the 30 s Gladewheel film with a virtual clock: node tools/film.mjs, then tools/encode.ps1.
// Time only advances 1/30 s per captured frame; the app is driven by real mouse input only.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const framesDir = path.join(root, 'shots', 'frames')
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const FPS = 30
const FRAME_MS = 1000 / FPS
// Where the followed train should be on the lift when recording starts, so it crests about 9 s in.
const LIFT_START = Number(process.env.LIFT_START ?? 68.5)

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 18, 5, 41)
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
  Date.now = () => epoch + now
  window.advanceVirtualFrame = (milliseconds) => {
    now += milliseconds
    const due = [...callbacks.values()]
    callbacks.clear()
    due.forEach((callback) => callback(now))
  }
  addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#18212f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%', border: '3px solid #e0464f', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
    document.body.appendChild(ring)
    let ringFrames = 0
    addEventListener('mousemove', (event) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
    addEventListener('mousedown', (event) => {
      ring.style.left = `${event.clientX}px`
      ring.style.top = `${event.clientY}px`
      ringFrames = 12
    }, true)
    window.tickFilmCursor = () => {
      ring.style.opacity = String(Math.max(0, ringFrames / 12) * 0.9)
      ring.style.transform = `scale(${1.4 - ringFrames / 20})`
      ringFrames = Math.max(0, ringFrames - 1)
    }
  })
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(virtualClock)
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
await page.goto('http://localhost:5431/')
await page.waitForSelector('canvas')
const advance = () => page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), FRAME_MS)
for (let index = 0; index < 900; index++) {
  await advance()
  if (index % 30 === 0 && (await page.evaluate(() => document.querySelectorAll('.row').length > 0 && Boolean(window.parkTrainOnLift)))) break
  await page.waitForTimeout(20)
}
// Let models, shaders and the shadow map settle.
for (let index = 0; index < 120; index++) await advance()

const session = await page.context().newCDPSession(page)
let frame = 0
let mouse = { x: 1240, y: 520 }
await page.mouse.move(mouse.x, mouse.y)

async function capture() {
  await page.evaluate((milliseconds) => {
    window.advanceVirtualFrame(milliseconds)
    window.tickFilmCursor()
  }, FRAME_MS)
  const { data } = await session.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
  fs.writeFileSync(path.join(framesDir, `${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))
  frame++
}

async function hold(frames) {
  for (let index = 0; index < frames; index++) await capture()
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

async function glide(target, frames) {
  const start = { ...mouse }
  for (let index = 1; index <= frames; index++) {
    const goal = typeof target === 'function' ? await target() : target
    const progress = ease(index / frames)
    mouse = { x: start.x + (goal.x - start.x) * progress, y: start.y + (goal.y - start.y) * progress }
    await page.mouse.move(mouse.x, mouse.y)
    await capture()
  }
}

async function click() {
  await page.mouse.down()
  await capture()
  await page.mouse.up()
  await capture()
}

async function centerOf(selector) {
  const box = await page.locator(selector).first().boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Pre-roll the virtual clock (not recorded) until a train is partway up the lift hill.
let trainId = null
for (let index = 0; index < 3000 && !trainId; index++) {
  trainId = await page.evaluate(([from, to]) => window.parkTrainOnLift(from, to), [LIFT_START, LIFT_START + 0.12])
  if (!trainId) await advance()
}
console.log('pre-rolled to', trainId)

// 0-5 s: close over the lift hill and promenade, a slow drag orbit while trains, boats, the wheel and crowds move.
await page.evaluate(() => window.parkLookAt([58, 62, 52], [4, 10, -26]))
await advance()
await page.mouse.down()
await glide({ x: 1150, y: 526 }, 150)
await page.mouse.up()

// 5-12 s: click the train climbing the lift; its card opens and the camera follows it over the crest and down the drop.
await glide(() => page.evaluate((id) => window.parkTrainScreen(id, 5.8), trainId), 18)
await click()
const title = await page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? '')
console.log('card', title, 'at frame', frame)
const wanted = 'Riptide train ' + trainId.slice(3)
for (const back of [2, 8.7, 11.6]) {
  if ((await page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? '')) === wanted) break
  await glide(() => page.evaluate(([id, distance]) => window.parkTrainScreen(id, distance), [trainId, back]), 6)
  await click()
  console.log('retry card', await page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? ''))
}
await glide({ x: 1240, y: 700 }, 30)
await hold(Math.max(0, 360 - frame))

// 12-18 s: click the Kalua Falls row in the Rides list; the camera flies to the log flume.
await glide(() => centerOf('.row[data-id="kalua"]'), 24)
await click()
await glide({ x: 1180, y: 640 }, 30)
await hold(Math.max(0, 540 - frame))

// 18-24 s: switch to Briarwood, the fairytale land, and zoom towards the carousel and parade.
await glide(() => centerOf('.site-button'), 22)
await click()
await hold(6)
await glide(() => centerOf('.site-menu button[data-site="FT"]'), 18)
await click()
await glide({ x: 900, y: 560 }, 24)
await hold(30)
for (let step = 0; step < 3; step++) {
  await page.mouse.wheel(0, -160)
  await hold(10)
}
await hold(Math.max(0, 720 - frame))

// 24-30 s: pull back out to a wide shot of the whole land and orbit slowly.
for (let step = 0; step < 3; step++) {
  await page.mouse.wheel(0, 125)
  await hold(8)
}
await hold(10)
await page.mouse.down()
await glide({ x: 760, y: 548 }, Math.max(10, 900 - frame - 6))
await page.mouse.up()
await hold(Math.max(0, 900 - frame))

console.log('frames', frame, problems.length ? problems.join(' | ') : 'no page errors')
await browser.close()
