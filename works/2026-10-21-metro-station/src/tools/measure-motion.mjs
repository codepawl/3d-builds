import { chromium } from 'playwright-core'

// Measures per-frame screen motion of the followed train in a 30 fps virtual-clock run (same clock as film.mjs).
const initScript = () => {
  const state = { now: 0, queue: [], nextId: 1 }
  window.__vt = state
  performance.now = () => state.now
  window.requestAnimationFrame = (callback) => { const id = state.nextId++; state.queue.push({ id, callback }); return id }
  window.cancelAnimationFrame = (id) => { state.queue = state.queue.filter((entry) => entry.id !== id) }
  window.__vtStep = (milliseconds) => {
    state.now += milliseconds
    const run = state.queue
    state.queue = []
    run.forEach((entry) => entry.callback(state.now))
  }
}
const FRAME_MS = 1000 / Number(process.env.FPS || 30)
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: false })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(initScript)
if (process.env.NO_INTERP) await page.addInitScript(() => { window.__noInterpolation = true })
await page.goto('http://127.0.0.1:5431/')
for (let attempt = 0; attempt < 600; attempt += 1) {
  await page.evaluate((ms) => window.__vtStep(ms), FRAME_MS)
  if (await page.evaluate(() => window.__appReady === true)) break
  await page.waitForTimeout(40)
}
await page.evaluate(() => window.__sim.runFor(288))
const trainId = process.argv[2] || 'H-05'
await page.evaluate((id) => window.__bus.push({ type: 'fly', ref: { type: 'train', id }, follow: true, minimum: 140 }), trainId)
for (let index = 0; index < Number(process.env.WARM || 20); index += 1) await page.evaluate((ms) => window.__vtStep(ms), FRAME_MS)
const rows = []
for (let index = 0; index < 60; index += 1) {
  await page.evaluate((ms) => window.__vtStep(ms), FRAME_MS)
  rows.push(await page.evaluate((id) => {
    const pose = window.__world.poseOf({ type: 'train', id })
    const fixed = window.__project({ type: 'station', id: 'H2' }, 0)
    const train = window.__sim.trains.find((candidate) => candidate.id === id)
    return { wx: pose.x, wz: pose.z, fx: fixed.x, fy: fixed.y, speed: train.speed, state: train.state }
  }, trainId))
}
// The train's screen position is relative to a camera that follows it, so also report a fixed world point's drift:
// the stuttering shows as frames where the train does not move on screen against the static scene.
const delta = (a, b, kx, ky) => Math.hypot(b[kx] - a[kx], b[ky] - a[ky])
const report = (label, values) => {
  const zero = values.filter((value) => value < 0.0005).length
  console.log(label, 'per-frame:', values.map((value) => value.toFixed(3)).join(' '))
  console.log(label, 'zero-motion frames', zero, 'of', values.length, 'min', Math.min(...values).toFixed(4), 'max', Math.max(...values).toFixed(4), 'mean', (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
}
console.log(JSON.stringify({ trainId, fps: 1000 / FRAME_MS, interpolation: !process.env.NO_INTERP, states: [...new Set(rows.map((row) => row.state))], speedRange: [Math.min(...rows.map((r) => r.speed)), Math.max(...rows.map((r) => r.speed))] }))
report('train world metres', rows.slice(1).map((row, index) => delta(rows[index], row, 'wx', 'wz')))
report('static station on screen px (camera motion)', rows.slice(1).map((row, index) => delta(rows[index], row, 'fx', 'fy')))
await browser.close()
