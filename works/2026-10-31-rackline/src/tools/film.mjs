// Records the film: one unbroken take, a real cursor, on a virtual clock. node tools/film.mjs <preroll> <heroId>
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL)

const preroll = process.argv[2]
const heroId = process.argv[3]
const outputRoot = path.resolve('out')
const framesDir = path.join(outputRoot, 'frames')
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })
const FPS = 30
const FRAME_MS = 1000 / FPS
const TOTAL_FRAMES = 730

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 31, 1, 0)
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
    cursor.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.8 1.5-3.9-7.3L4.8 19z" fill="#fff" stroke="#10151b" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' })
    document.body.appendChild(cursor)
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'fixed', width: '36px', height: '36px', marginLeft: '-18px', marginTop: '-18px', borderRadius: '50%', border: '3px solid #35d6bf', zIndex: 99998, pointerEvents: 'none', opacity: '0' })
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
      ring.style.transform = `scale(${1.5 - ringFrames / 20})`
      ringFrames = Math.max(0, ringFrames - 1)
    }
  })
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(virtualClock)
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(`http://localhost:5493/?preroll=${preroll}&dpr=1.5`)
await page.waitForFunction(() => {
  window.advanceVirtualFrame?.(0)
  return window.__app?.ready
}, null, { timeout: 240000, polling: 1000 })
for (let index = 0; index < 20; index++) {
  await page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), 0)
  await page.waitForTimeout(100)
}

const session = await page.context().newCDPSession(page)
const inputEvents = []
const log = fs.createWriteStream(path.join(outputRoot, 'film.log'))
let frame = 0
let mouse = { x: 1250, y: 640 }
await page.mouse.move(mouse.x, mouse.y)

async function capture() {
  await page.evaluate((milliseconds) => {
    window.advanceVirtualFrame(milliseconds)
    window.tickFilmCursor()
  }, FRAME_MS)
  const { data } = await session.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
  fs.writeFileSync(path.join(framesDir, `${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))
  frame++
  if (frame % 30 === 0) log.write(`${frame}/${TOTAL_FRAMES} ${new Date().toISOString()}\n`)
}

const ease = (progress) => (progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2)

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

async function click(targetName) {
  inputEvents.push({ frame, kind: 'click', target: targetName })
  await page.mouse.down()
  await capture()
  await page.mouse.up()
  await capture()
}

// Orbit by holding the left button, so the camera always moves through the app's own controls.
async function orbit(deltaX, deltaY, frames) {
  inputEvents.push({ frame, kind: 'drag', target: 'orbit' })
  await page.mouse.down()
  await glide({ x: mouse.x + deltaX, y: mouse.y + deltaY }, frames)
  await page.mouse.up()
}

async function wheel(amount, steps) {
  inputEvents.push({ frame, kind: 'wheel', target: 'zoom' })
  for (let index = 0; index < steps; index++) {
    await page.mouse.wheel(0, amount)
    await capture()
    await capture()
  }
}

const screenOfForklift = (id) => page.evaluate((forkliftId) => {
  const forklift = window.__app.sim.forklifts.find((item) => item.id === forkliftId)
  return window.__app.screenOf([forklift.x, 1.6, forklift.z])
}, id)

const busiestLine = () => page.evaluate(() => {
  const { lines, time } = window.__app.sim
  const active = lines.filter((line) => line.conveyorCases.length && line.jammedUntil <= time).sort((first, second) => second.conveyorCases.length - first.conveyorCases.length)
  const line = active[0] ?? lines.find((item) => item.order) ?? lines[0]
  return window.__app.screenOf([(line.pickX + line.packX) / 2, 1, line.z])
})

const busiestDock = () => page.evaluate(() => {
  const doors = window.__app.sim.outbound
  const door = doors.find((item) => item.pallets.length) ?? doors.find((item) => item.reserved) ?? doors[0]
  return window.__app.screenOf([door.x, 3.6, -15.8])
})

async function hold(frames) {
  for (let index = 0; index < frames; index++) await capture()
}

async function checkSelected(expected) {
  const kind = await page.evaluate(() => window.__app.selected()?.kind ?? 'none')
  if (kind !== expected) problems.push(`frame ${frame}: expected ${expected} selected, got ${kind}`)
}

const homeBox = await page.locator('#home').boundingBox()
const homePoint = { x: homeBox.x + homeBox.width / 2, y: homeBox.y + homeBox.height / 2 }

async function backToOverview() {
  await glide(homePoint, 20)
  await click('overview')
  await checkSelected('none')
  await hold(30)
}

const startSimTime = await page.evaluate(() => window.__app.sim.time)

// 0-2.5 s: the whole building running, a small orbit.
await orbit(-30, 0, 44)
await glide(() => screenOfForklift(heroId), 30)
await click(`forklift ${heroId}`)
await checkSelected('forklift')
// The camera flies down the aisle and the forks carry the pallet up to level four.
await hold(120)
await orbit(36, 0, 90)
await hold(119)
await backToOverview()
// The pick line, cases run along the belt.
await glide(() => busiestLine(), 22)
await click('pick line')
await checkSelected('line')
await hold(70)
await backToOverview()
// The shipping dock, a pallet goes into the trailer, then back to the whole building.
await glide(() => busiestDock(), 22)
await click('dock')
await checkSelected('dock')
await hold(60)
await backToOverview()
await hold(Math.max(0, TOTAL_FRAMES - frame))

const simEvents = await page.evaluate((start) => window.__app.sim.events.filter((event) => event.time >= start), startSimTime)
fs.writeFileSync(path.join(outputRoot, 'sim_events.json'), JSON.stringify({ startSimTime, events: simEvents }, null, 1))
fs.writeFileSync(path.join(outputRoot, 'input_events.json'), JSON.stringify({ fps: FPS, frames: frame, events: inputEvents }, null, 1))
const kpis = await page.evaluate(() => document.getElementById('kpis').innerText.replace(/\n/g, ' '))
log.write(`done ${frame} ${kpis} ${problems.join(' | ')}\n`)
console.log('frames', frame, kpis, problems.length ? problems.join(' | ') : 'no page errors')
await browser.close()
