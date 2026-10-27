// Screenshots at 1920x1080 for visual review, with an fps measurement: node tools/shoot.mjs [url]
// Clicks objects for real at their projected screen positions and switches sites with the menu.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
mkdirSync(path.join(root, 'shots'), { recursive: true })
const url = process.argv[2] ?? 'http://localhost:5425/'
const shot = (page, name) => page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()))
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(url)
await page.waitForFunction(() => document.querySelectorAll('.row').length > 0 && window.waferlineScreenPosition, null, { timeout: 60000 })
await page.waitForTimeout(5000)

async function measureFps(seconds = 4) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const count = () => {
          frames++
          if (performance.now() - start < duration * 1000) requestAnimationFrame(count)
          else resolve((frames * 1000) / (performance.now() - start))
        }
        requestAnimationFrame(count)
      }),
    seconds,
  )
}

const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
})
console.log('renderer', renderer)
console.log('fps overview', (await measureFps()).toFixed(1), 'draw calls', await page.evaluate(() => window.waferlineRenderer.info.render.calls))
await shot(page, 'overview')

async function clickEntity(kind) {
  const id = await page.evaluate((pickKind) => window.waferlinePick(pickKind), kind)
  const position = id && (await page.evaluate((entityId) => window.waferlineScreenPosition(entityId), id))
  console.log('click', kind, id, position && `${Math.round(position.x)},${Math.round(position.y)}`)
  if (position) await page.mouse.click(position.x, position.y)
  await page.waitForTimeout(400)
  const selected = await page.evaluate(() => document.querySelector('.detail h2')?.textContent ?? null)
  console.log('  card', selected)
  return id
}

// A running tool picked in the 3D view, then the camera flies to it with the card's button.
await clickEntity('runningTool')
await page.waitForTimeout(800)
await shot(page, 'selected')
await page.click('.locate')
await page.waitForTimeout(2600)
await shot(page, 'closeup')

// Back to the whole site, then pick a moving OHT vehicle.
await page.click('[aria-label="Whole site"]')
await page.waitForTimeout(2500)
await page.mouse.wheel(0, -500)
await page.waitForTimeout(1500)
await clickEntity('movingVehicle')
await page.click('.locate')
await page.waitForTimeout(2600)
console.log('fps close', (await measureFps(3)).toFixed(1))
await shot(page, 'vehicle')

// Escape closes the card.
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
console.log('card after Esc', await page.evaluate(() => Boolean(document.querySelector('.detail'))))

// Second fab and the campus through the site switcher.
for (const [index, name] of [[2, 'site2'], [3, 'campus']]) {
  await page.click('.site-button')
  await page.waitForTimeout(300)
  await page.click(`.site-menu button:nth-child(${index})`)
  await page.waitForTimeout(4500)
  console.log(`fps ${name}`, (await measureFps(3)).toFixed(1))
  await shot(page, name)
}

console.log(problems.length ? `problems:\n${problems.slice(0, 8).join('\n')}` : 'no console errors')
await browser.close()
