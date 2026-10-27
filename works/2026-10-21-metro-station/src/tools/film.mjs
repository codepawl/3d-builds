import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'

// Deterministic film: a virtual clock replaces requestAnimationFrame, performance.now and Date.now; the app is only driven
// through real mouse clicks, drags and wheel events with a visible cursor. One captured frame = 1/30 s of virtual time.
const OUT_DIR = '<your folder>/viz-metro/app/shots'
const FPS = 30
const TOTAL_FRAMES = Number(process.argv[2] || 900)
const OUTPUT = process.argv[3] || `${OUT_DIR}/film.mp4`
const PLAN = JSON.parse(fs.readFileSync(`${OUT_DIR}/film-plan.json`, 'utf8'))
fs.mkdirSync(OUT_DIR, { recursive: true })

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
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.CHROME_LOG ? ['--enable-logging=stderr', '--v=0'] : [])],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text().slice(0, 300)) })
page.on('pageerror', (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`))
await page.addInitScript(initScript)
await page.goto('http://127.0.0.1:5431/')

// Warm-up: advance the virtual clock until the app has built its first snapshot.
for (let attempt = 0; attempt < 600; attempt += 1) {
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const ready = await page.evaluate(() => window.__appReady === true)
  if (ready) break
  await page.waitForTimeout(40)
}

for (let index = 0; index < 20; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
// Opening camera: close on the Harbour cutaway at the station, set before recording (the same view a viewer gets from "fly to").
await page.evaluate((look) => window.__bus.push({ type: 'look', ...look }), PLAN.opening)
for (let index = 0; index < 150; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
const simulationTime = await page.evaluate(() => window.__sim.time)
const extra = PLAN.filmStart - simulationTime
if (extra < 0) throw new Error(`Simulation already at ${simulationTime}, past film start ${PLAN.filmStart}`)
await page.evaluate((seconds) => window.__sim.runFor(seconds), extra - 0.2)
for (let index = 0; index < 6; index += 1) await page.evaluate(() => window.__vtStep(1000 / 30))
console.log('sim time at start', await page.evaluate(() => window.__sim.time))

const ffmpeg = spawn('ffmpeg', [
  '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
  '-vf', 'scale=in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', OUTPUT,
], { stdio: ['pipe', 'inherit', 'inherit'] })
try { os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL) } catch (error) { console.log('priority', error.message) }

let frameIndex = 0
const timing = { step: 0, shot: 0, encode: 0 }
let mouse = { x: 960, y: 560 }
async function tick() {
  if (frameIndex >= TOTAL_FRAMES) return
  const t0 = Date.now()
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const t1 = Date.now()
  const image = await page.screenshot({ type: 'jpeg', quality: 95 })
  const t2 = Date.now()
  if (process.env.SAVE_FRAMES && frameIndex >= 360) fs.writeFileSync(`<your folder>/viz-metro/app/shots/dbg-${frameIndex}.jpg`, image)
  if (!ffmpeg.stdin.write(image)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve))
  const t3 = Date.now()
  timing.step += t1 - t0
  timing.shot += t2 - t1
  timing.encode += t3 - t2
  frameIndex += 1
  if (frameIndex % 60 === 0) {
    console.log('ms per frame: step', Math.round(timing.step / 60), 'screenshot', Math.round(timing.shot / 60), 'encode wait', Math.round(timing.encode / 60))
    timing.step = timing.shot = timing.encode = 0
  }
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
    mouse = { x: start.x + dx * index / frames, y: start.y + dy * index / frames }
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

await page.mouse.move(mouse.x, mouse.y)
const trainRef = { type: 'train', id: PLAN.trainId }
const trainPoint = async () => page.evaluate((ref) => window.__project(ref), trainRef)
const trainLog = async (label) => console.log(label, frameIndex, JSON.stringify(await page.evaluate((id) => {
  const train = window.__sim.trains.find((candidate) => candidate.id === id)
  return { state: train.state, speed: +train.speed.toFixed(2), s: +train.s.toFixed(1), door: +train.doorOpen.toFixed(2), simTime: +window.__sim.time.toFixed(1) }
}, PLAN.trainId)))
// 0-5 s: close on the cutaway while train A pulls into the platform; a slow real drag-orbit keeps every frame different.
await hold(8)
await moveTo({ x: 1010, y: 470 }, 14)
await drag(-44, 5, 100)
await trainLog('B before click')
// Track train B (about to arrive on the far road), then click it with a real click on the 3D view.
let latest = await trainPoint()
console.log('train point before click', latest)
await moveTo(() => latest ?? { x: 900, y: 500 }, 18)
while (frameIndex < 148) {
  latest = await trainPoint()
  mouse = { x: latest.x, y: latest.y }
  await page.mouse.move(mouse.x, mouse.y)
  await tick()
}
await click()
console.log('selected after click', await page.evaluate(() => window.__store.getState().selected))
await trainLog('B at click')
// 5-12 s: the card is open and updates live while the camera follows B into the station; a slow drag-orbit continues.
await moveTo({ x: 640, y: 700 }, 20)
await drag(58, 6, Math.max(20, 352 - frameIndex))
await trainLog('B at 12 s')
await hold(Math.max(0, 360 - frameIndex))
// 12-18 s: open the station list and click a row; the camera flies to that station.
await moveTo(await boxCentre('button[role="tab"]:has-text("Stations")'), 22)
await click()
await hold(10)
await moveTo(await boxCentre('.rows .row:has-text("Eastgate")'), 20)
await click()
await moveTo({ x: 1000, y: 470 }, 24)
while (frameIndex < 536) {
  await page.mouse.wheel(0, -12)
  await hold(4)
}
await hold(Math.max(0, 540 - frameIndex))
// 18-24 s: switch to the Ring Line, orbit, and move in on the viaduct.
await moveTo(await boxCentre('button.site-button:has-text("Ring Line")'), 24)
await click()
await moveTo({ x: mouse.x + 140, y: mouse.y - 50 }, 40)
await moveTo(await boxCentre('button[aria-label="Orbit"]'), 22)
await click()
await moveTo({ x: 980, y: 470 }, 22)
while (frameIndex < 700) {
  await page.mouse.wheel(0, -46)
  await hold(5)
}
await hold(Math.max(0, 720 - frameIndex))
// 24-30 s: pull back with the wheel until the whole ring fills the frame.
while (frameIndex < TOTAL_FRAMES - 12) {
  await page.mouse.wheel(0, PLAN.pullBack ?? 40)
  await hold(10)
}
await hold(Math.max(0, TOTAL_FRAMES - frameIndex))
ffmpeg.stdin.end()
await new Promise((resolve) => ffmpeg.on('close', resolve))
console.log('frames', frameIndex, 'problems', problems.slice(0, 5))
await browser.close()
