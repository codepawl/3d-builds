import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'

// Deterministic film: a virtual clock replaces requestAnimationFrame, performance.now and Date.now; the app is only driven
// through real mouse clicks, drags and wheel events with a visible cursor. One captured frame = 1/30 s of virtual time.
const OUT_DIR = '<your folder>/viz-canal/app/shots'
const FPS = 30
const TOTAL_FRAMES = Number(process.argv[2] || 900)
const OUTPUT = process.argv[3] || `${OUT_DIR}/film.mp4`
const LOG = `${OUT_DIR}/film.log`
const PLAN = { filmStart: 65.8, hero: 'A01', other: 'Vesper Line', opening: { target: [-8, 14, -430], yaw: -1.0, pitch: 0.5, distance: 640, snap: true } }
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(LOG, '')
const log = (...parts) => {
  const line = parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')
  fs.appendFileSync(LOG, `${line}\n`)
  console.log(line)
}

const initScript = () => {
  const state = { now: 0, queue: [], nextId: 1 }
  window.__vt = state
  performance.now = () => state.now
  const startDate = 1760000000000
  Date.now = () => startDate + state.now
  window.requestAnimationFrame = (callback) => {
    const id = state.nextId++
    state.queue.push({ id, callback })
    return id
  }
  window.cancelAnimationFrame = (id) => {
    state.queue = state.queue.filter((entry) => entry.id !== id)
  }
  window.__vtStep = (milliseconds) => {
    state.now += milliseconds
    // CSS animations and transitions follow the virtual clock too.
    document.getAnimations().forEach((animation) => {
      if (animation.__vtStart === undefined) {
        animation.__vtStart = state.now - (Number(animation.currentTime) || 0)
        animation.pause()
      }
      animation.currentTime = state.now - animation.__vtStart
    })
    const run = state.queue
    state.queue = []
    run.forEach((entry) => {
      try {
        entry.callback(state.now)
      } catch (error) {
        console.error('frame error', error)
      }
    })
  }
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.id = 'film-cursor'
    cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 21 L10 16.5 L13.4 24 L16.6 22.6 L13.3 15.4 L20 15 Z" fill="#14202b" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="ripple"></span>'
    const style = document.createElement('style')
    style.textContent = '#film-cursor{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}#film-cursor .ripple{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #0f9d8f;opacity:0}#film-cursor.down .ripple{animation:ripple .45s ease-out}@keyframes ripple{from{opacity:.9;transform:scale(.3)}to{opacity:0;transform:scale(1.8)}}'
    document.head.appendChild(style)
    document.body.appendChild(cursor)
    window.addEventListener('mousemove', (event) => { cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)` }, true)
    window.addEventListener('mousedown', () => { cursor.classList.remove('down'); void cursor.offsetWidth; cursor.classList.add('down') }, true)
  })
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text().slice(0, 300)) })
page.on('pageerror', (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`))
await page.addInitScript(initScript)
await page.goto('http://127.0.0.1:5433/')

// Warm-up: advance the virtual clock until the app has built its first snapshot.
for (let attempt = 0; attempt < 900; attempt += 1) {
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const ready = await page.evaluate(() => window.__appReady === true)
  if (ready) break
  await page.waitForTimeout(40)
}
for (let index = 0; index < 20; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
await page.evaluate((look) => window.__bus.push({ type: 'look', ...look }), PLAN.opening)
for (let index = 0; index < 90; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
const simulationTime = await page.evaluate(() => window.__sim.time)
const extra = PLAN.filmStart - simulationTime
if (extra < 0) throw new Error(`Simulation already at ${simulationTime}, past film start ${PLAN.filmStart}`)
await page.evaluate((seconds) => window.__sim.runFor(seconds), extra - 0.1)
for (let index = 0; index < 4; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
log('sim time at first frame', await page.evaluate(() => window.__sim.time))

const ffmpeg = spawn('ffmpeg', [
  '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv', '-r', String(FPS), '-movflags', '+faststart', OUTPUT,
], { stdio: ['pipe', 'inherit', 'inherit'] })
try { os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL) } catch (error) { log('priority', error.message) }

let frameIndex = 0
let mouse = { x: 960, y: 560 }
const started = Date.now()
async function tick() {
  if (frameIndex >= TOTAL_FRAMES) return
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const image = await page.screenshot({ type: 'jpeg', quality: 95 })
  if (!ffmpeg.stdin.write(image)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve))
  frameIndex += 1
  if (frameIndex % 30 === 0) log('frame', frameIndex, 'elapsed s', Math.round((Date.now() - started) / 1000))
}
async function hold(frames) { for (let index = 0; index < frames; index += 1) await tick() }
const ease = (t) => t * t * (3 - 2 * t)
async function moveTo(getTarget, frames) {
  const start = { ...mouse }
  for (let index = 1; index <= frames; index += 1) {
    const target = typeof getTarget === 'function' ? getTarget() : getTarget
    const t = ease(index / frames)
    mouse = { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t }
    await page.mouse.move(mouse.x, mouse.y)
    await tick()
  }
}
async function click() {
  await page.mouse.down()
  await tick()
  await page.mouse.up()
  await tick()
}
async function drag(dx, dy, frames) {
  await page.mouse.down()
  const start = { ...mouse }
  for (let index = 1; index <= frames; index += 1) {
    mouse = { x: start.x + (dx * index) / frames, y: start.y + (dy * index) / frames }
    await page.mouse.move(mouse.x, mouse.y)
    await tick()
  }
  await page.mouse.up()
  await tick()
}
async function boxCentre(selector) {
  const box = await page.locator(selector).first().boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
const shipPoint = async (id) => page.evaluate((shipId) => window.__project({ type: 'ship', id: shipId }, 4), id)
const heroLog = async (label) => log(label, frameIndex, await page.evaluate((id) => {
  const state = window.__store.getState()
  return { simTime: +window.__sim.time.toFixed(2), selected: state.selected, following: state.following, status: state.snapshot?.ships.find((ship) => ship.id === id)?.status }
}, PLAN.hero))

await page.mouse.move(mouse.x, mouse.y)
// 0-5 s: slow orbit over the flight with ships, mules and tugs moving; the cursor then tracks the hero ship and clicks it.
await hold(6)
await moveTo({ x: 1020, y: 520 }, 14)
await drag(-66, 4, 96)
await heroLog('before click')
let latest = await shipPoint(PLAN.hero)
await moveTo(() => latest ?? { x: 900, y: 500 }, 16)
while (frameIndex < 149) {
  latest = await shipPoint(PLAN.hero)
  mouse = { x: latest.x, y: latest.y }
  await page.mouse.move(mouse.x, mouse.y)
  await tick()
}
await click()
await heroLog('after click')
// 5-12 s: the card opens and updates live while the camera follows the hero up through the chamber; a slow drag keeps every frame different.
await moveTo({ x: 700, y: 760 }, 16)
await drag(54, 3, Math.max(20, 346 - frameIndex))
await heroLog('at 12 s')
await hold(Math.max(0, 360 - frameIndex))
// 12-18 s: click a list row and the camera flies to the downhill lane.
await page.locator(`.rows .row:has-text("${PLAN.other}")`).first().scrollIntoViewIfNeeded()
await moveTo(await boxCentre(`.rows .row:has-text("${PLAN.other}")`), 22)
await click()
await moveTo({ x: 1000, y: 480 }, 20)
await drag(-48, 2, Math.max(20, 536 - frameIndex))
await hold(Math.max(0, 540 - frameIndex))
// 18-24 s: switch to the single lock at lake level, then close in on its chamber.
await moveTo(await boxCentre('button.site-button:has-text("Orrin Lock")'), 24)
await click()
await hold(36)
await moveTo({ x: 1000, y: 470 }, 20)
while (frameIndex < 700) {
  await page.mouse.wheel(0, -34)
  await hold(5)
}
await moveTo(await boxCentre('button[aria-label="Orbit"]'), 14)
await click()
await hold(Math.max(0, 720 - frameIndex))
// 24-30 s: pull back with the wheel until the lock fills the frame.
await moveTo({ x: 1000, y: 470 }, 12)
await page.mouse.down()
const pullStart = { ...mouse }
const pullFrames = TOTAL_FRAMES - 6 - frameIndex
for (let index = 1; index <= pullFrames; index += 1) {
  mouse = { x: pullStart.x - (60 * index) / pullFrames, y: pullStart.y + (70 * index) / pullFrames }
  await page.mouse.move(mouse.x, mouse.y)
  if (index % 8 === 0) await page.mouse.wheel(0, 34)
  await tick()
}
await page.mouse.up()
await hold(Math.max(0, TOTAL_FRAMES - frameIndex))
ffmpeg.stdin.end()
await new Promise((resolve) => ffmpeg.on('close', resolve))
log('frames', frameIndex, 'problems', problems.slice(0, 5))
await browser.close()
