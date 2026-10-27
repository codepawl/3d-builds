// Records the 30 s Boxline film on a virtual clock: node tools/film.mjs, then tools/encode.ps1.
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
const TOTAL = 900

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 18, 13, 0)
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
  // A visible cursor, since headless screenshots do not draw the system pointer.
  addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#16202f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '36px', height: '36px', marginLeft: '-18px', marginTop: '-18px', borderRadius: '50%', border: '3px solid #c6f432', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
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
      ring.style.opacity = String(Math.max(0, ringFrames / 12) * 0.95)
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
await page.goto(process.env.BOXLINE_URL ?? 'http://localhost:5429/')
await page.waitForSelector('canvas')
const advance = (frames) => page.evaluate(([count, milliseconds]) => {
  for (let index = 0; index < count; index++) window.advanceVirtualFrame(milliseconds)
}, [frames, FRAME_MS])
for (let index = 0; index < 900; index++) {
  await advance(1)
  if (index % 20 === 0 && (await page.evaluate(() => Boolean(window.boxline) && document.querySelectorAll('.row').length > 0))) break
  await page.waitForTimeout(15)
}

// Pre-roll the race so car 07 is on its pit-lane entry when the film starts and stops 2-3 s into its beat.
const car07 = () => page.evaluate(() => {
  const site = window.boxline.site()
  const car = site.cars.find((candidate) => candidate.id === 'car07')
  return { mode: car.mode, leg: car.pitLeg, remaining: car.pit ? +(car.pit.entry.length - car.u).toFixed(1) : null, called: car.boxCalled, time: +site.time.toFixed(2) }
})
const START_REMAINING = Number(process.env.START_REMAINING ?? 150)
let preroll = 0
for (let guard = 0; guard < 8000; guard++) {
  const state = await car07()
  if (state.mode === 'pit' && state.leg === 'entry' && state.remaining <= START_REMAINING) break
  const steps = state.called ? 1 : 6
  await advance(steps)
  preroll += steps
}
console.log('pre-roll frames', preroll)

const session = await page.context().newCDPSession(page)
let frame = 0
let mouse = { x: 1180, y: 470 }
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
const hold = async (frames) => {
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
const screenPosition = (id) => page.evaluate((entityId) => window.boxline.screenPosition(entityId, 0.45), id)
const until = async (endFrame) => hold(Math.max(0, endFrame - frame))
const log = async (label) => console.log(label, 'frame', frame, JSON.stringify(await car07()))

// 0-5 s: slow orbit over the pit lane while cars race past and car 07 comes down the pit lane.
await page.mouse.down()
await glide({ x: 900, y: 455 }, 126)
await page.mouse.up()
await log('orbit done')
// 5-12 s: click car 07 as it rolls to its box; the card opens and the camera follows the stop and the release.
await glide(() => screenPosition('car07'), 22)
// Press and release on the same frame: the car moves 0.7 m per frame.
await page.mouse.down()
await page.mouse.up()
await hold(2)
await log('clicked car')
for (let guard = 0; guard < 200 && frame < 360; guard++) {
  await capture()
  if (frame % 15 === 0) await log('follow')
}
await until(360)
// 12-18 s: click a timing-list row; the camera flies to that car and follows it round the lap.
const rowId = await page.evaluate(() => {
  const site = window.boxline.site()
  return site.order.find((id) => id !== 'car07' && site.cars.find((car) => car.id === id).mode === 'track')
})
console.log('row', rowId)
await glide(() => centerOf(`.row[data-id="${rowId}"]`), 26)
await click()
await until(540)
// 18-24 s: switch to the night street circuit from the site switcher.
await glide(() => centerOf('.site-button'), 24)
await click()
await hold(8)
await glide(() => centerOf('.site-menu button:nth-child(2)'), 20)
await click()
await until(720)
// 24-30 s: pull back to the whole circuit with the camera button and a gentle orbit drag.
await glide(() => centerOf('.camera-button[aria-label="Whole circuit"]'), 22)
await click()
await hold(40)
await glide({ x: 980, y: 420 }, 16)
await page.mouse.down()
await glide({ x: 1025, y: 412 }, 70)
await page.mouse.up()
await until(TOTAL)

console.log('frames', frame, problems.length ? problems.join(' | ') : 'no page errors')
await browser.close()
