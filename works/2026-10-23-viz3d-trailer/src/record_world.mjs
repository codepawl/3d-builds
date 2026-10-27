// Records UI-free world shots from the running apps on a virtual clock.
// Usage: node record_world.mjs <app> <shotId|all> [--frames N] [--probe]
import { createRequire } from 'node:module'
import { spawn, execSync } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('<your folder>/orglet/node_modules/playwright')
const toolsDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.dirname(toolsDir)
const DEMOS = '<your folder>/demos'
const FPS = 30
const FRAME_MS = 1000 / FPS

// shots.json: { appName: { dir, shots: { id: { warmup, seconds, orbit:[dx,dy], pan:[dx,dy], wheel } } } }
// A move is total mouse travel in pixels: orbit = left-drag, pan = right-drag, wheel = dolly (negative = in).
const APPS = JSON.parse(fs.readFileSync(path.join(toolsDir, 'shots.json'), 'utf8'))

// Hides every element that is not the canvas or an ancestor of it (panels, pins, drei Html labels).
const hideUserInterface = `
  html, body { background: #000 !important; }
  body *:not(canvas):not(:has(canvas)) { visibility: hidden !important; pointer-events: none !important; }
  canvas { visibility: visible !important; }
`

function virtualClock() {
  let now = 0
  const epoch = Date.UTC(2026, 9, 17, 0, 0)
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
}

const smoothstep = (t) => t * t * (3 - 2 * t)

async function startServer(appDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'))
  const port = Number(/--port (\d+)/.exec(pkg.scripts.dev)[1])
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port)], { cwd: appDir, stdio: 'ignore' })
  os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL)
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}/`)
      if (response.ok) return { child, port }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('dev server did not start')
}

function stopServer(child) {
  try {
    execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' })
  } catch {}
}

async function recordShot(browser, port, appName, shotId, shot, frameCount, probe) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.addInitScript(virtualClock)
  const problems = []
  page.on('pageerror', (error) => problems.push(error.message))
  await page.goto(`http://localhost:${port}/${shot.query || ''}`)
  await page.waitForSelector('canvas')
  await page.addStyleTag({ content: hideUserInterface })
  const step = () => page.evaluate((ms) => window.advanceVirtualFrame(ms), FRAME_MS)
  for (let index = 0; index < 240; index++) {
    await step()
    if (index % 4 === 0) await page.waitForTimeout(15)
  }
  if (shot.setup) await page.evaluate(shot.setup)
  const warmupFrames = Math.round((shot.warmup || 0) * FPS)
  for (let index = 0; index < warmupFrames; index++) {
    await step()
    if (index % 6 === 0) await page.waitForTimeout(5)
  }
  const outDir = path.join(projectDir, 'frames', `${appName}-${shotId}`)
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const session = await page.context().newCDPSession(page)
  const [orbitX, orbitY] = shot.orbit || [0, 0]
  const [panX, panY] = shot.pan || [0, 0]
  const wheelTotal = shot.wheel || 0
  const center = { x: 960, y: 560 }
  await page.mouse.move(center.x, center.y)
  let heldButton = null
  const hold = async (name) => {
    if (heldButton === name) return
    if (heldButton) await page.mouse.up({ button: heldButton })
    await page.mouse.down({ button: name })
    heldButton = name
  }
  let previousWheel = 0
  for (let frame = 0; frame < frameCount; frame++) {
    const progress = smoothstep(frame / (frameCount - 1))
    if (orbitX || orbitY) {
      await hold('left')
      await page.mouse.move(center.x + orbitX * progress, center.y + orbitY * progress)
    } else if (panX || panY) {
      await hold('right')
      await page.mouse.move(center.x + panX * progress, center.y + panY * progress)
    }
    const wheelNow = wheelTotal * progress
    if (wheelNow !== previousWheel) await page.mouse.wheel(0, wheelNow - previousWheel)
    previousWheel = wheelNow
    await step()
    const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true })
    fs.writeFileSync(path.join(outDir, `${String(frame).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'))
    if (probe && frame >= 1) break
  }
  if (heldButton) await page.mouse.up({ button: heldButton })
  await page.close()
  if (problems.length) console.log('page errors', appName, shotId, problems.slice(0, 3))
  console.log('recorded', appName, shotId)
}

const [appName, shotArg, ...flags] = process.argv.slice(2)
const frameFlag = flags.indexOf('--frames')
const probe = flags.includes('--probe')
const app = APPS[appName]
const { child, port } = await startServer(path.join(DEMOS, app.dir))
try {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const ids = shotArg === 'all' ? Object.keys(app.shots) : [shotArg]
  for (const id of ids) {
    const shot = app.shots[id]
    const frames = frameFlag >= 0 ? Number(flags[frameFlag + 1]) : Math.round((shot.seconds || 5) * FPS)
    await recordShot(browser, port, appName, id, shot, frames, probe)
  }
  await browser.close()
} finally {
  stopServer(child)
}
