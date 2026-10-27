// Records the 30 s Bayflow film on a virtual clock: node tools/film.mjs (dev server on 5430), then encode.
// Time only advances 1/30 s per captured frame; the app is driven by real mouse input only. The sim is
// seeded, so tools/forecast.mjs finds a start time where an ambulance backs in early and the helicopter
// lands at the end; the page warms up to just before it and the virtual clock pre-rolls the rest.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { forecast } from './forecast.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const framesDir = path.join(root, 'shots', 'frames')
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const FPS = 30
const FRAME_MS = 1000 / FPS
const plan = forecast().options[Number(process.env.OPTION ?? 0)]
console.log('plan', JSON.stringify(plan))

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 15, 7, 6)
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
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#18212f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%', border: '3px solid #2f6fe4', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
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
await page.goto(`http://localhost:5430/?warm=${Math.floor(plan.start - 14)}`)
await page.waitForSelector('canvas')
const advance = () => page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), FRAME_MS)
for (let index = 0; index < 900; index++) {
  await advance()
  if (index % 15 === 0 && (await page.evaluate(() => document.querySelectorAll('.row').length > 0 && Boolean(window.appLookAt)))) break
  await page.waitForTimeout(15)
}
const clock = () => page.evaluate(() => window.appSite().clock)
// Opening view: close over the treatment area with the ambulance bay and drive in frame.
await page.evaluate(() => {
  const { halfWidth, halfDepth, ambulanceBay } = window.appSite().layout
  window.appLookAt([halfWidth + 26, 30, ambulanceBay.doorZ + 40], [halfWidth - 6, 0, -halfDepth + 9])
})
let preroll = 0
while ((await clock()) < plan.start - FRAME_MS / 1000 / 2) {
  await advance()
  preroll++
}
console.log('pre-rolled', preroll, 'frames to clock', (await clock()).toFixed(2))

const session = await page.context().newCDPSession(page)
let frame = 0
let mouse = { x: 1240, y: 600 }
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

const screenPosition = (id) => page.evaluate((entityId) => window.appScreenPosition(entityId), id)
const title = () => page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? '')
const backingAmbulance = () => page.evaluate(() => window.appSite().vehicles.find((vehicle) => vehicle.phase === 'arriving' || vehicle.phase === 'reversing')?.id ?? null)

// 0-5 s: slow drag orbit over the department while staff move, beds roll and the ambulance comes up the drive.
await page.mouse.down()
await glide({ x: 1060, y: 590 }, 130)
await page.mouse.up()
await hold(8)

// 5-12 s: click the ambulance as it backs in; its card opens, the locate button follows it, and the
// camera goes with the cot into the department.
const ambulanceId = await backingAmbulance()
console.log('ambulance', ambulanceId, 'at frame', frame, 'clock', (await clock()).toFixed(2))
await glide(() => screenPosition(ambulanceId), Math.max(10, 150 - frame))
await click()
for (let retry = 0; retry < 3 && !(await title()).match(/Medic|Rescue|Transport/); retry++) {
  console.log('click hit', (await title()) || 'nothing', 'retrying')
  await glide(() => screenPosition(ambulanceId), 8)
  await click()
}
console.log('card', await title(), 'frame', frame)
await hold(14)
await glide(() => centerOf('.locate'), 22)
await click()
await hold(Math.max(0, 362 - frame))

// 12-18 s: the Imaging list; click a patient a porter is moving (or the next queued scan) and fly there.
// The simulation is skipped ahead (uncaptured) to just before a patient goes onto the CT couch, so the
// row click flies to the CT room and the couch slides into the bore within the beat.
let skipped = 0
while ((await clock()) < plan.ctLoading - 2.0) {
  await advance()
  skipped++
}
console.log('skipped', skipped, 'frames to clock', (await clock()).toFixed(2), 'ct loading planned', plan.ctLoading.toFixed(2))
await glide(() => centerOf('.tab:has-text("Imaging")'), 22)
await click()
await hold(6)
const imagingRow = await page.evaluate(() => {
  const ct = window.appSite().rooms.find((room) => room.kind === 'ct')
  const rows = [...document.querySelectorAll('.rows .row')]
  const onCouch = ct.patientId ?? ct.reservedBy
  const fallback = rows.find((row) => row.textContent.includes('Scanning') || row.textContent.includes('Porter moving')) ?? rows.find((row) => row.dataset.id.endsWith('-scan')) ?? rows[0]
  return (onCouch && rows.find((row) => row.dataset.id === `${onCouch}-scan`)?.dataset.id) || fallback.dataset.id
})
console.log('list row', imagingRow, 'ct', await page.evaluate(() => JSON.stringify((({ phase, patientId, reservedBy }) => ({ phase, patientId, reservedBy }))(window.appSite().rooms.find((room) => room.kind === 'ct')))))
await glide(() => centerOf(`.row[data-id="${imagingRow}"]`), 22)
await click()
await hold(Math.max(0, 540 - frame))

// 18-24 s: switch to the children's hospital, then lean in on its department.
await glide(() => centerOf('.site-button'), 22)
await click()
await hold(8)
await glide(() => centerOf('.site-menu button[data-site="LH"]'), 20)
await click()
await glide({ x: 900, y: 540 }, 18)
await hold(20)
for (let step = 0; step < 3; step++) {
  await page.mouse.wheel(0, -220)
  await hold(12)
}
await hold(Math.max(0, 720 - frame))

// 24-30 s: pull back to the whole site as the helicopter comes down on the pad.
for (let step = 0; step < 4; step++) {
  await page.mouse.wheel(0, 200)
  await hold(10)
}
await page.mouse.down({ button: 'right' })
await glide({ x: 820, y: 520 }, 24)
await page.mouse.up({ button: 'right' })
await hold(900 - frame)
const heli = await page.evaluate(() => window.appSite().helis[0])
console.log('heli at end', heli.phase, heli.position.y.toFixed(1))
console.log('frames', frame, problems.length ? problems.join(' | ') : 'no page errors')
await browser.close()
