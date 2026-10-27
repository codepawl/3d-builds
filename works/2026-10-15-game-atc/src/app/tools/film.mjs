// Records the 30 s demo film with a virtual clock: node tools/film.mjs, then encode with ffmpeg.
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

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 14, 1, 40)
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
    cursor.id = 'film-cursor'
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#18212f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))', transition: 'none' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%', border: '3px solid #2a4fd8', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
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
await page.goto('http://localhost:5424/')
await page.waitForSelector('canvas')
await page.waitForTimeout(1500)

// CDP capture with speed-optimised PNG is lossless and about 3x faster than page.screenshot.
const session = await page.context().newCDPSession(page)
let frame = 0
let mouse = { x: 1500, y: 640 }
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

// Moves the cursor over `frames` frames; `target` may be a function re-evaluated each frame.
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

// Settle the scene on the virtual clock before recording.
for (let index = 0; index < 60; index++) await page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), FRAME_MS)

// 0-5 s: slow orbit over the approach sector while traffic moves.
await page.mouse.move(1180, 600)
mouse = { x: 1180, y: 600 }
await page.mouse.down()
await glide({ x: 1095, y: 594 }, 140)
await page.mouse.up()
await hold(150 - frame)

// 5-12 s: click a moving aircraft's data tag; its card opens, then the locate button flies the
// camera to it and keeps following while the card ticks.
// An airborne aircraft whose tag sits well inside the map area, nearest the middle of the screen.
const flightId = await page.evaluate(() => {
  const candidates = window.squawkSite().flights.filter((flight) => flight.mode === 'steer' && flight.altitude > 2000 && !flight.hold)
  const scored = candidates
    .map((flight) => {
      const tag = document.querySelector(`.data-tag[data-id="${flight.id}"]`)
      if (!tag) return null
      const box = tag.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      if (x < 420 || x > 1250 || y < 230 || y > 760) return null
      return { id: flight.id, distance: Math.hypot(x - 860, y - 500) }
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
  return scored[0]?.id ?? window.squawkPick('moving')
})
console.log('tracking', flightId)
await glide(() => centerOf(`.data-tag[data-id="${flightId}"]`), 30)
await click()
await hold(30)
await glide(() => centerOf('.locate'), 26)
await click()
await hold(360 - frame)

// 12-18 s: click a row in the traffic list; the camera flies to that aircraft.
const rowId = await page.evaluate((excluded) => {
  const list = document.querySelector('.rows').getBoundingClientRect()
  const rows = [...document.querySelectorAll('.rows .row')].filter((row) => {
    const box = row.getBoundingClientRect()
    return box.top >= list.top && box.bottom <= list.bottom && row.dataset.id !== excluded
  })
  const airborne = rows.find((row) => window.squawkSite().flights.find((flight) => flight.id === row.dataset.id)?.altitude > 1500)
  return (airborne ?? rows[0]).dataset.id
}, flightId)
console.log('list row', rowId)
await glide(() => centerOf(`.row[data-id="${rowId}"]`), 30)
await click()
await hold(540 - frame)

// 18-24 s: switch to the tower sector from the site switcher.
await glide(() => centerOf('.site-button'), 30)
await click()
await hold(10)
await glide(() => centerOf('.site-menu button:nth-child(1)'), 22)
await click()
await hold(720 - frame)

// 24-30 s: pull back to a wide shot of the airport with the wheel and a small orbit.
await glide({ x: 1060, y: 560 }, 20)
for (let step = 0; step < 3; step++) {
  await page.mouse.wheel(0, 120)
  await hold(5)
}
await page.mouse.down()
await glide({ x: 1135, y: 552 }, 100)
await page.mouse.up()
await hold(900 - frame)

console.log('frames', frame, problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
