// Records shots/film.mp4: 30 s, 1920x1080, 30 fps, on a virtual clock that advances exactly 1/30 s per captured frame.
// The app is driven only through real mouse clicks, drags and wheel events, with a drawn cursor.
// Usage: node scripts/film.mjs [baseUrl] [output file name in shots/]   (dev server on port 5421 must be running)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { constants, setPriority } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const output = path.join(root, 'shots', process.argv[3] ?? 'film.mp4')
const baseUrl = process.argv[2] ?? 'http://localhost:5421/'
const FPS = 30
const TOTAL_FRAMES = 30 * FPS
const WARMUP_FRAMES = 40

// Runs in the page before any app code: rAF, performance.now and Date only move when the recorder says so.
function installVirtualClock() {
  const epoch = Date.UTC(2026, 9, 14, 14, 38, 0)
  let virtualNow = 0
  let nextId = 1
  const callbacks = new Map()
  window.requestAnimationFrame = (callback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => callbacks.delete(id)
  performance.now = () => virtualNow
  const RealDate = Date
  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(epoch + virtualNow)
      else super(...args)
    }
    static now() {
      return epoch + virtualNow
    }
  }
  window.Date = VirtualDate
  window.advanceVirtualFrame = (milliseconds) => {
    virtualNow += milliseconds
    const due = [...callbacks.values()]
    callbacks.clear()
    for (const callback of due) callback(virtualNow)
    // Let React's scheduler commit the UI tick before the frame is captured.
    return new Promise((resolve) => setTimeout(resolve, 0))
  }

  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div')
    cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2.5l17 11.2-7.6 1.6 4.4 8.3-3.3 1.7-4.4-8.4L4 22.5z" fill="#14172a" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999', pointerEvents: 'none', transform: 'translate(-4px,-3px)' })
    const ripple = document.createElement('div')
    Object.assign(ripple.style, {
      position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%',
      background: 'rgba(91,75,255,0.28)', zIndex: '99998', pointerEvents: 'none', opacity: '0',
    })
    document.body.append(ripple, cursor)
    window.addEventListener('pointermove', (event) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
    window.addEventListener('pointerdown', (event) => {
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      ripple.style.opacity = '1'
    }, true)
    window.addEventListener('pointerup', () => {
      ripple.style.opacity = '0'
    }, true)
  })
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(installVirtualClock)
await page.goto(`${baseUrl}?film`)
await page.waitForSelector('canvas')
// The Blender GLBs load in real time while the virtual clock stands still; let them arrive before the warm-up frames.
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1500)

const session = await page.context().newCDPSession(page)
const encoder = spawn('ffmpeg', [
  '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
], { stdio: ['pipe', 'inherit', 'inherit'] })
setPriority(encoder.pid, constants.priority.PRIORITY_BELOW_NORMAL)

const mouse = { x: 760, y: 640 }
async function moveMouse(x, y) {
  mouse.x = x
  mouse.y = y
  await page.mouse.move(x, y)
}

function ease(fraction) {
  return fraction < 0.5 ? 2 * fraction * fraction : 1 - Math.pow(-2 * fraction + 2, 2) / 2
}

// Glide the cursor from where it is to a point over `frames` frames; `target` may be a function for moving things.
function glide(startFrame, frames, target) {
  let from = null
  return async (frame) => {
    if (frame < startFrame || frame > startFrame + frames) return
    if (!from) from = { ...mouse }
    const point = typeof target === 'function' ? await target() : target
    if (!point) return
    const progress = ease((frame - startFrame) / frames)
    await moveMouse(from.x + (point.x - from.x) * progress, from.y + (point.y - from.y) * progress)
  }
}

async function centerOf(selector) {
  const box = await page.locator(selector).first().boundingBox()
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
}

let chosenUnitId = null
async function unitStates() {
  return page.evaluate(() => window.kelvin.units())
}

// Carts inside an aisle hide behind the racks, so follow one that is driving down an open side corridor.
async function chosenUnitPoint() {
  if (!chosenUnitId) {
    const units = await unitStates()
    const moving = units.filter((unit) => unit.state === 'moving').sort((first, second) => second.waypoints - first.waypoints)
    const pick = moving.find((unit) => unit.id.includes('RC') && unit.inCorridor && unit.waypoints >= 2)
      ?? moving.find((unit) => unit.inCorridor)
      ?? moving.find((unit) => unit.id.includes('RC'))
      ?? units[0]
    chosenUnitId = pick.id
    console.log('following', chosenUnitId)
  }
  return page.evaluate((id) => window.kelvin.screenPositionOf(id), chosenUnitId)
}

let unitClickedAt = null
async function clickChosenUnitWhenClear(frame) {
  if (frame < 175 || frame > 240 || unitClickedAt !== null) return
  const point = await chosenUnitPoint()
  await moveMouse(point.x, point.y)
  const unit = (await unitStates()).find((candidate) => candidate.id === chosenUnitId)
  if (unit.inCorridor || frame === 240) {
    await page.mouse.down()
    await page.mouse.up()
    unitClickedAt = frame
    console.log('clicked unit at frame', frame)
  }
}

const actions = [
  // 0-5 s: slow orbit with a real drag on open ground.
  async (frame) => {
    if (frame === 2) {
      await moveMouse(700, 700)
      await page.mouse.down()
    }
    if (frame > 2 && frame < 140) await moveMouse(700 + (frame - 2) * 1.05, 700 - (frame - 2) * 0.12)
    if (frame === 140) await page.mouse.up()
  },
  // 5-12 s: chase a moving cart with the cursor and click it.
  glide(150, 24, chosenUnitPoint),
  clickChosenUnitWhenClear,
  glide(230, 40, { x: 1490, y: 300 }),
  // 12-18 s: open the alerts tab and click a row; the camera flies to it.
  glide(360, 22, () => centerOf('[data-tab="alerts"]')),
  async (frame) => {
    if (frame === 384) await page.mouse.click(mouse.x, mouse.y)
  },
  glide(392, 20, () => centerOf('.rows li:first-child .row')),
  async (frame) => {
    if (frame === 414) await page.mouse.click(mouse.x, mouse.y)
  },
  // 18-24 s: switch to Hall 2 from the site switcher.
  glide(545, 22, () => centerOf('[data-testid="site-switcher"]')),
  async (frame) => {
    if (frame === 569) await page.mouse.click(mouse.x, mouse.y)
  },
  glide(578, 16, () => centerOf('[data-site="h2"]')),
  async (frame) => {
    if (frame === 597) await page.mouse.click(mouse.x, mouse.y)
  },
  glide(605, 30, { x: 820, y: 620 }),
  // 24-30 s: pull back to a wide shot with the wheel, then a slow drag.
  async (frame) => {
    if (frame >= 724 && frame <= 732 && frame % 8 === 4) await page.mouse.wheel(0, 100)
    if (frame === 800) await page.mouse.down()
    if (frame > 800 && frame < 892) await moveMouse(820 - (frame - 800) * 0.9, 620)
    if (frame === 892) await page.mouse.up()
  },
]

async function advanceFrame() {
  await page.evaluate((milliseconds) => window.advanceVirtualFrame(milliseconds), 1000 / FPS)
}

for (let frame = 0; frame < WARMUP_FRAMES; frame++) await advanceFrame()
await moveMouse(mouse.x, mouse.y)

const started = Date.now()
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  for (const action of actions) await action(frame)
  await advanceFrame()
  const { data } = await session.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
  if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await new Promise((resolve) => encoder.stdin.once('drain', resolve))
  if (frame % 150 === 0) console.log(`frame ${frame}/${TOTAL_FRAMES} after ${((Date.now() - started) / 1000).toFixed(0)} s`)
}

encoder.stdin.end()
await new Promise((resolve) => encoder.on('close', resolve))
await browser.close()
console.log('wrote', output)
