// Screenshots at 1920x1080 for visual review: node tools/shoot.mjs [url]
// Writes shots/overview.png, selected.png, closeup.png, site2.png (tower), site3.png (en route)
// and prints the frame rate measured on each view.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const url = process.argv[2] ?? 'http://localhost:5424/'
const shot = (page, name) => page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()))
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(url)
await page.waitForTimeout(6000)

const measureFps = (label) =>
  page
    .evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0
          const start = performance.now()
          const count = () => {
            frames++
            if (performance.now() - start < 3000) requestAnimationFrame(count)
            else resolve((frames * 1000) / (performance.now() - start))
          }
          requestAnimationFrame(count)
        }),
    )
    .then((fps) => console.log('fps', label, fps.toFixed(1)))

console.log('renderer', await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
}))
await measureFps('overview')
await shot(page, 'overview')

// Click a moving aircraft in the 3D view.
const flightId = await page.evaluate(() => window.squawkPick('moving'))
const position = await page.evaluate((id) => window.squawkScreenPosition(id), flightId)
console.log('click', flightId, position)
if (position) await page.mouse.click(position.x, position.y)
await page.waitForTimeout(800)
await page.click('.locate')
await page.waitForTimeout(2500)
await measureFps('selected')
await shot(page, 'selected')

// Close-up: zoom with the wheel while the camera follows the selection.
await page.mouse.move(960, 560)
for (let step = 0; step < 4; step++) {
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(120)
}
await page.waitForTimeout(2000)
await shot(page, 'closeup')

for (const [index, name] of [[1, 'site2'], [3, 'site3']]) {
  await page.keyboard.press('Escape')
  await page.click('.site-button')
  await page.waitForTimeout(300)
  await page.click(`.site-menu button:nth-child(${index})`)
  await page.waitForTimeout(4500)
  await measureFps(name)
  await shot(page, name)
}

console.log(problems.length ? `problems:\n${problems.slice(0, 8).join('\n')}` : 'no console errors')
await browser.close()
