// Records a film on a virtual clock (dev server on 5432):
//   node tools/film.mjs [vertical]       the 45 s app walkthrough, then tools/sound.mjs [vertical] and tools/encode.ps1 [-Vertical]
//   node tools/film.mjs life dry [vertical]  the documentary on the same virtual clock without capturing a frame: rewrites only the log (hits,
//                                        footfalls); the frames stay
//   node tools/film.mjs life [vertical]  the documentary (film.html: no UI, no cursor, no clicks) into shots/frames-life[-vertical]
//                                        and shots/film_log_life[_vertical].json, then tools/sound.mjs life [vertical] and
//                                        tools/encode.ps1 -Name life [-Vertical]
// Landscape: a 960 x 540 page at 2x (1920 x 1080 frames) into shots/frames and shots/film_log.json.
// Vertical: a 540 x 960 page at 2x (1080 x 1920 frames, the portrait layout) into shots/frames-vertical and
// shots/film_log_vertical.json.
// Time advances exactly 1/30 s per captured frame (requestAnimationFrame, performance.now and Date.now are
// replaced before the app loads). The app is driven only by real mouse moves, clicks and wheel events.
// The page is 960 x 540 at device scale 2: frames are 1920 x 1080 and every word is twice its desktop size,
// so the film stays readable on a phone. Mouse coordinates below are page (CSS) pixels.
// Writes shots/frames/*.jpg and shots/film_log.json (the frame of every reveal, for the sound hits).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Heavy job: run below normal priority; Chromium inherits it.
os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL)
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('<your folder>/orglet/node_modules/playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const vertical = process.argv.includes('vertical')
const life = process.argv.includes('life')
const dry = process.argv.includes('dry')
const PAGE = vertical ? { width: 540, height: 960 } : { width: 960, height: 540 }
const framesDirectory = path.join(root, 'shots', `frames${life ? '-life' : ''}${vertical ? '-vertical' : ''}`)
const logFile = path.join(root, 'shots', `film_log${life ? '_life' : ''}${vertical ? '_vertical' : ''}.json`)
// Mouse rest points in page pixels: over open map, clear of the panels, in each layout.
const SPOTS = vertical ? { start: { x: 400, y: 600 }, rest: { x: 500, y: 250 } } : { start: { x: 750, y: 410 }, rest: { x: 920, y: 120 } }
if (!process.env.FILM_FROM && !dry) fs.rmSync(framesDirectory, { recursive: true, force: true })
fs.mkdirSync(framesDirectory, { recursive: true })

const FPS = 30
const FRAME_MS = 1000 / FPS
const TOTAL_FRAMES = 45 * FPS

function virtualClock(withCursor) {
  let now = 0
  const epoch = Date.UTC(2026, 9, 18, 12, 0)
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
  if (!withCursor) return
  // A small, quiet cursor: headless screenshots do not draw the system pointer.
  addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#e8e8e8" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', opacity: '0.85', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '30px', height: '30px', marginLeft: '-15px', marginTop: '-15px', borderRadius: '50%', border: '2px solid rgba(236,236,236,0.8)', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
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
      ring.style.opacity = String(Math.max(0, ringFrames / 12) * 0.8)
      ring.style.transform = `scale(${1.3 - ringFrames / 24})`
      ringFrames = Math.max(0, ringFrames - 1)
    }
  })
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: PAGE, deviceScaleFactor: 2 })
await page.addInitScript(virtualClock, !life)
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
const session = await page.context().newCDPSession(page)
const advance = (milliseconds) => page.evaluate((step) => window.advanceVirtualFrame(step), milliseconds)

async function screenshot(frame) {
  const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true, clip: { x: 0, y: 0, width: PAGE.width, height: PAGE.height, scale: 2 } })
  fs.writeFileSync(path.join(framesDirectory, `${String(frame).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'))
}

// The documentary: load, wait for the models, start the clock at frame 0 and capture every frame. Its log holds
// the soft hits the script asks for. FILM_FROM and FILM_TO (seconds) record a part, for quick checks.
if (life) {
  await page.goto('http://localhost:5432/film.html')
  await page.waitForSelector('canvas')
  for (let index = 0; index < 400 && !(await page.evaluate(() => window.film?.ready)); index++) {
    await advance(FRAME_MS)
    await page.waitForTimeout(50)
  }
  const { duration, hits } = await page.evaluate(() => ({ duration: window.film.duration, hits: window.film.hits }))
  const firstFrame = Math.round(Number(process.env.FILM_FROM ?? 0) * FPS)
  const totalFrames = Math.round(Number(process.env.FILM_TO ?? duration) * FPS)
  await page.evaluate((at) => window.film.start(at), firstFrame / FPS)
  for (let frame = firstFrame; frame < totalFrames; frame++) {
    await advance(FRAME_MS)
    if (!dry) await screenshot(frame)
    if (frame % 300 === 0) console.log(`frame ${frame} / ${totalFrames}`)
  }
  // Every footstep sound lands on a footfall the figures make (Mannequin.jsx), in film seconds.
  const footfalls = (await page.evaluate(() => window.__footfalls)).sort((first, second) => first.seconds - second.seconds)
  const log = hits.map((seconds) => ({ frame: Math.round(seconds * FPS), seconds, label: 'hit' }))
  fs.writeFileSync(logFile, JSON.stringify({ frames: totalFrames, fps: FPS, width: PAGE.width * 2, height: PAGE.height * 2, log, footfalls, problems }, null, 2))
  console.log('frames', totalFrames, 'problems', problems.length, problems.slice(0, 5))
  await browser.close()
  process.exit(0)
}
await page.goto('http://localhost:5432/')
await page.waitForSelector('canvas')
// Warm up: let assets load and the first frames render before frame 0.
for (let index = 0; index < 60; index++) {
  await page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), FRAME_MS)
  await page.waitForTimeout(25)
}
await page.waitForTimeout(1500)
for (let index = 0; index < 20; index++) {
  await page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), FRAME_MS)
  await page.waitForTimeout(25)
}

let frame = 0
let mouse = { ...SPOTS.start }
await page.mouse.move(mouse.x, mouse.y)
const log = []
let lastMoment = null
let lastReveals = 0

async function capture() {
  if (frame >= TOTAL_FRAMES) return
  await page.evaluate((milliseconds) => {
    window.advanceVirtualFrame(milliseconds)
    window.tickFilmCursor()
  }, FRAME_MS)
  const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true, clip: { x: 0, y: 0, width: PAGE.width, height: PAGE.height, scale: 2 } })
  fs.writeFileSync(path.join(framesDirectory, `${String(frame).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'))
  // Moments the autoplay reaches, and reveals (new places or names), for the sound's soft hits.
  const now = await page.evaluate(() => ({ moment: window.app?.state().eventId, reveals: window.app?.reveals() ?? 0 }))
  if (now.moment !== lastMoment) log.push({ frame, seconds: frame / FPS, label: `moment ${now.moment}` })
  if (now.reveals > lastReveals) log.push({ frame, seconds: frame / FPS, label: 'reveal' })
  lastMoment = now.moment
  lastReveals = now.reveals
  frame++
}

async function holdUntil(seconds) {
  while (frame < Math.round(seconds * FPS) && frame < TOTAL_FRAMES) await capture()
}

const ease = (value) => (value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2)

async function glide(target, frames) {
  const start = { ...mouse }
  for (let index = 1; index <= frames; index++) {
    const progress = ease(index / frames)
    mouse = { x: start.x + (target.x - start.x) * progress, y: start.y + (target.y - start.y) * progress }
    await page.mouse.move(mouse.x, mouse.y)
    await capture()
  }
}

async function centreOf(selector) {
  const locator = page.locator(selector).first()
  await locator.waitFor({ state: 'visible', timeout: 5000 })
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function clickAt(selector, label, glideFrames = 16) {
  const point = await centreOf(selector)
  await glide(point, glideFrames)
  await page.mouse.down()
  await capture()
  await page.mouse.up()
  log.push({ frame, seconds: frame / FPS, label, click: true })
  console.log(`${(frame / FPS).toFixed(2)} s  ${label}`)
  await capture()
}

async function wheel(deltaY, times, gap) {
  for (let index = 0; index < times; index++) {
    await page.mouse.wheel(0, deltaY)
    for (let step = 0; step < gap; step++) await capture()
  }
}

// 0-3 s: the engraved panorama, PLAINFIELD, WISCONSIN 1957 (the film opens directly on it); one click plays.
await holdUntil(3.0)
await clickAt('.intro-button', 'open case file', 24)
// 3-5 s: the first date on the county map; one click on 8 Dec 1954 skips the family deaths.
await glide(SPOTS.rest, 20)
await holdUntil(4.4)
await clickAt('[data-event="e1954"]', '8 Dec 1954', 14)
// 5-42 s: the timeline plays itself; the scene does the telling. The cursor rests out of the way.
await glide(SPOTS.rest, 24)
while (lastMoment !== 'e1968' && frame < 43 * FPS) await capture()
await holdUntil(Math.min(42.6, frame / FPS + 0.75))
// The end: every mark and both victims' names.
await clickAt('[data-event="end"]', 'whole case', 14)
await glide(SPOTS.rest, 30)
await holdUntil(45)

fs.writeFileSync(logFile, JSON.stringify({ frames: frame, fps: FPS, width: PAGE.width * 2, height: PAGE.height * 2, log, problems }, null, 2))
console.log('frames', frame, 'problems', problems.length, problems.slice(0, 5))
await browser.close()
