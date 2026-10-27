// Platform-eye-level screenshots with train doors and screen doors open on both faces of one station.
// Usage: node tools/psd-shots.mjs [stationId]   Output: shots/psd/<station>-<view>.png at 1920x1080. Dev server on 5431 required.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = '<your folder>/viz-metro/app/shots/psd'
fs.mkdirSync(outDir, { recursive: true })
const stationId = process.argv[2] ?? 'H2'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: false })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(String(error.stack || error.message).slice(0, 400)))
await page.goto('http://127.0.0.1:5431/')
await page.waitForFunction(() => window.__appReady === true && window.__world, null, { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate(() => window.__app.setPaused(true))

// Step to a dwelling train on the +1 face, then park a second train of the same line on the -1 face with doors open.
const setup = await page.evaluate((id) => {
  const sim = window.__sim
  const station = window.__world.siteStations.find((entry) => entry.id === id)
  for (let step = 0; step < 300000; step += 1) {
    sim.stepOnce()
    const first = sim.trains.find((train) => !train.ghost && train.state === 'dwell' && train.atStationId === id && train.dir === 1 && train.doorOpen >= 0.999)
    if (!first) continue
    const other = sim.trains.find((train) => !train.ghost && train.lineId === station.lineId && train !== first && train.dir === -1 && train.state !== 'dwell')
    if (!other) return { error: 'no second train' }
    Object.assign(other, { state: 'dwell', atStationId: id, lastStationId: id, s: station.s, speed: 0, dir: -1, doorOpen: 1, doorTarget: 1, dwellTotal: 60, dwellTimer: 40, xover: null })
    first.dwellTotal = 60
    first.dwellTimer = 40
    sim.stepOnce()
    return { first: first.id, second: other.id, time: sim.time }
  }
  return { error: 'no dwell' }
}, stationId)
console.log(setup)
await page.evaluate(() => window.__app.setPaused(true))

const views = [
  { name: 'end-west', u: -60, z: 2.2, look: 1 },
  { name: 'end-east', u: 60, z: 2.2, look: -1 },
  { name: 'middle', u: 0, z: 2.2, look: 1 },
  { name: 'middle-across-south', u: -30, z: -3.8, lookZ: 1, close: true },
  { name: 'middle-across-north', u: -30, z: 3.8, lookZ: -1, close: true },
]
for (const view of views) {
  await page.evaluate(({ stationId, view }) => {
    const frame = window.__world.stationFrames[stationId]
    const cos = Math.cos(frame.yaw)
    const sin = Math.sin(frame.yaw)
    const eye = 1.1 + 1.6
    const toWorld = (u, z) => [frame.x + u * cos + z * sin, frame.y + eye, frame.z - u * sin + z * cos]
    const alongU = view.look ?? 0
    const alongZ = view.lookZ ?? 0
    const distance = view.close ? 7.5 : 4
    const camera = toWorld(view.u, view.z)
    const targetLocal = [view.u + alongU * distance, view.z + alongZ * distance]
    const target = toWorld(targetLocal[0], targetLocal[1])
    const dx = target[0] - camera[0]
    const dz = target[2] - camera[2]
    window.__bus.push({ type: 'pose', target, yaw: Math.atan2(-dx, -dz), pitch: 0.02, distance })
  }, { stationId, view })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/${stationId}-${view.name}.png` })
}
console.log('problems', problems)
await browser.close()
