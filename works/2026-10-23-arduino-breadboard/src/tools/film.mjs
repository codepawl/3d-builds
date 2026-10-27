// Deterministic 30 s film (1920x1080, 30 fps): a virtual clock replaces requestAnimationFrame, performance.now and Date.now,
// and the app is driven only by real mouse moves, clicks and drags with a visible cursor. One frame = 1/30 s of virtual time.
// node tools/film.mjs [totalFrames] [output]
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'

const OUT_DIR = '<your folder>/viz-learn-arduino/shots'
const FPS = 30
const TOTAL_FRAMES = Number(process.argv[2] || 900)
const OUTPUT = process.argv[3] || `${OUT_DIR}/film.mp4`
const LOG = `${OUT_DIR}/film.log`
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(LOG, '')
const log = (...parts) => {
  const line = parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')
  fs.appendFileSync(LOG, `${line}\n`)
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
      try { entry.callback(state.now) } catch (error) { console.error('frame error', error) }
    })
  }
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.id = 'film-cursor'
    cursor.innerHTML = '<svg width="38" height="38" viewBox="0 0 28 28"><path d="M5 3 L5 21 L10 16.5 L13.4 24 L16.6 22.6 L13.3 15.4 L20 15 Z" fill="#101c26" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="ripple"></span>'
    const style = document.createElement('style')
    style.textContent = '#film-cursor{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}#film-cursor .ripple{position:absolute;left:-14px;top:-14px;width:30px;height:30px;border-radius:50%;border:3px solid #ff5a3c;opacity:0}#film-cursor.down .ripple{animation:ripple .45s ease-out}@keyframes ripple{from{opacity:.95;transform:scale(.3)}to{opacity:0;transform:scale(1.9)}}'
    document.head.appendChild(style)
    document.body.appendChild(cursor)
    window.addEventListener('mousemove', (event) => { cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)` }, true)
    window.addEventListener('mousedown', () => { cursor.classList.remove('down'); void cursor.offsetWidth; cursor.classList.add('down') }, true)
  })
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.setDefaultTimeout(15000)
const problems = []
page.on('console', (message) => { if (message.type() === 'error' && !/404|unmount a root/.test(message.text())) problems.push(message.text().slice(0, 300)) })
page.on('pageerror', (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`))
await page.addInitScript(initScript)
await page.goto('http://127.0.0.1:5244/')

for (let attempt = 0; attempt < 600; attempt += 1) {
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const ready = await page.evaluate(() => Boolean(window.__app) && Boolean(window.__camera) && Boolean(document.querySelector('canvas')))
  if (ready && attempt > 20) break
  await page.waitForTimeout(40)
}
// Pre-roll: let the scene settle and the first blink start, a whole number of seconds of virtual time.
for (let index = 0; index < 45; index += 1) {
  await page.evaluate(() => window.__vtStep(1000 / 30))
  await page.waitForTimeout(8)
}

const ffmpeg = spawn('ffmpeg', [
  '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv', '-r', String(FPS), '-movflags', '+faststart', OUTPUT,
], { stdio: ['pipe', 'inherit', 'inherit'] })
try { os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL) } catch (error) { log('priority', error.message) }

let frameIndex = 0
let mouse = { x: 1100, y: 640 }
const started = Date.now()
async function tick() {
  if (frameIndex >= TOTAL_FRAMES) return
  await page.evaluate(() => window.__vtStep(1000 / 30))
  const image = await page.screenshot({ type: 'jpeg', quality: 95 })
  if (!ffmpeg.stdin.write(image)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve))
  frameIndex += 1
  if (frameIndex % 30 === 0) log('frame', frameIndex, 'elapsed s', Math.round((Date.now() - started) / 1000))
}
async function holdUntil(frame) { while (frameIndex < Math.min(frame, TOTAL_FRAMES)) await tick() }
const ease = (t) => t * t * (3 - 2 * t)
async function moveTo(target, frames) {
  const start = { ...mouse }
  for (let index = 1; index <= frames; index += 1) {
    const t = ease(index / frames)
    mouse = { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t }
    await page.mouse.move(mouse.x, mouse.y)
    await tick()
  }
}
async function click(label) {
  log('click', label, 'at', frameIndex)
  await page.mouse.down()
  await tick()
  await page.mouse.up()
  await tick()
}
async function centre(selector, index = 0) {
  const box = await page.locator(selector).nth(index).boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function thumbNow() {
  const box = await page.locator('.big-range').first().boundingBox()
  const fraction = await page.evaluate(() => {
    const input = document.querySelector('.big-range')
    return (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))
  })
  return { x: box.x + 17 + fraction * (box.width - 34), y: box.y + box.height / 2 }
}
async function thumbAt(fraction) {
  const box = await page.locator('.big-range').first().boundingBox()
  return { x: box.x + 17 + fraction * (box.width - 34), y: box.y + box.height / 2 }
}
const screenOf = (point) => page.evaluate((p) => window.__app.screenOf(p), point)
const targetOf = (name, argument) => page.evaluate(([n, a]) => window.__app.targets[n](a), [name, argument])
const lessonButton = (lesson) => `ol.lessons li:nth-child(${lesson}) button`
async function openLesson(lesson, dot) {
  await moveTo(await centre(lessonButton(lesson)), 14)
  await click(`lesson ${lesson}`)
  if (dot !== undefined) {
    await moveTo(await centre('.dot', dot), 6)
    await click(`dot ${dot}`)
  }
}

await page.mouse.move(mouse.x, mouse.y)
const hold = (frames) => holdUntil(frameIndex + frames)
const sandboxPoint = (reference) => page.evaluate((r) => window.__app.at(r), reference)
const chipPoint = (item) => centre(`[data-item="${item}"]`)
// A real press-drag-release from one screen point to another.
async function dragBetween(from, to, frames) {
  await moveTo(from, 9)
  await page.mouse.down()
  await tick()
  await moveTo(to, frames)
  await hold(4)
  await page.mouse.up()
  await tick()
}

// 0-1 s: the Uno large in frame, its L LED blinking; the cursor heads for Next.
await moveTo(await centre('.next'), 30)
// Step 2 of Blink: the bench camera shows the loose jumpers on the tray; the GND jumper is picked up, carried and pressed in, end by end.
await click('next: breadboard and GND jumper')
await hold(72)
await click('next: resistor and LED from the tray')
await hold(40)
await click('next: the two jumpers')
await hold(68)
// The current view, off until now: red dots from the pin, blue back to GND.
await moveTo(await centre('.current-switch'), 10)
await click('show current')
await hold(40)

// The button lesson, built, then a real press on the 3D button.
await openLesson(2, 2)
await hold(28)
const button = await screenOf(await targetOf('button', [24, 26]))
await moveTo(button, 14)
await page.mouse.down()
await hold(20)
await page.mouse.up()
await hold(4)

// The potentiometer: drag the knob and the LED fades.
await openLesson(4, 3)
await hold(20)
const knob = await screenOf(await targetOf('potKnob', 24))
await moveTo(knob, 8)
await page.mouse.down()
await moveTo({ x: knob.x + 150, y: knob.y + 6 }, 14)
await moveTo({ x: knob.x - 130, y: knob.y }, 18)
await page.mouse.up()
await hold(4)

// The servo sweeps on its own.
await openLesson(5, 3)
await hold(34)

// One theme switch.
await moveTo(await centre('.theme-button'), 8)
await click('theme night')
await hold(4)

// Build your own, about 8 s: tray to board, two wires, Run.
await moveTo(await centre(lessonButton(7)), 12)
await click('lesson 7')
await hold(30)
await dragBetween(await chipPoint('res-220'), await sandboxPoint([12, 'c']), 22)
await hold(18)
await dragBetween(await chipPoint('led-red'), await sandboxPoint([16, 'e']), 20)
await hold(18)
await dragBetween(await sandboxPoint({ uno: '13' }), await sandboxPoint([12, 'a']), 18)
await hold(6)
await dragBetween(await sandboxPoint([17, 'a']), await sandboxPoint({ uno: 'GND' }), 22)
await hold(6)
await moveTo(await centre('.run-button'), 10)
await click('run')
await hold(36)

// The full traffic light circuit, large in frame.
await openLesson(6, 3)
await holdUntil(TOTAL_FRAMES)
ffmpeg.stdin.end()
await new Promise((resolve) => ffmpeg.on('close', resolve))
log('frames', frameIndex, 'problems', problems.slice(0, 5))
await browser.close()
