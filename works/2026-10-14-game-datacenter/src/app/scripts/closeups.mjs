// Close-up screenshots of each main asset type at 1920x1080, with the camera placed directly.
// Usage: node scripts/closeups.mjs [baseUrl] [subfolder of shots/]   (dev server on port 5421 must be running)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shotsDirectory = path.join(root, 'shots', process.argv[3] ?? 'blender')
mkdirSync(shotsDirectory, { recursive: true })
const baseUrl = process.argv[2] ?? 'http://localhost:5421/'

// Each close-up: an entity id, the camera offset from it, and the height the camera looks at.
const CLOSE_UPS = [
  { name: 'closeup-racks', id: 'H1-B06', eye: [3.0, 3.0, 6.4], lookHeight: 1.2 },
  { name: 'closeup-rack-tops', id: 'H1-C04', eye: [-4.0, 5.6, 4.0], lookHeight: 2.2 },
  { name: 'closeup-cooling-unit', id: 'H1-CRAH1', eye: [6.0, 3.6, 4.0], lookHeight: 1.1 },
  { name: 'closeup-chiller', id: 'H1-CH1', eye: [-6.0, 6.0, 7.0], lookHeight: 0.8 },
  { name: 'closeup-substation', id: 'H1-SUB', eye: [6.5, 5.5, 8.5], lookHeight: 1.0 },
  { name: 'closeup-battery-room', id: 'H1-BAT', eye: [6.5, 6.5, 6.0], lookHeight: 0.8 },
  { name: 'closeup-robot-cart', id: 'H1-RC1', eye: [4.0, 3.4, 5.4], lookHeight: 0.6 },
  { name: 'closeup-technician', id: 'H1-T1', eye: [-3.0, 6.5, 5.0], lookHeight: 1.0 },
]

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`error: ${message.text()}`)
})

await page.goto(baseUrl)
await page.waitForTimeout(6000)
for (const shot of CLOSE_UPS) {
  await page.evaluate(({ id, eye, lookHeight }) => {
    const position = window.kelvin.positionOf(id)
    window.kelvin.lookFrom(
      { x: position.x + eye[0], y: eye[1], z: position.z + eye[2] },
      { x: position.x, y: lookHeight, z: position.z },
    )
  }, shot)
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(shotsDirectory, `${shot.name}.png`) })
  console.log('saved', shot.name)
}

// Campus: neighbour halls, roads, trees and the chiller pipes from a low corner.
await page.evaluate(() => window.kelvin.lookFrom({ x: 40, y: 14, z: 30 }, { x: 22, y: 1, z: 2 }))
await page.waitForTimeout(700)
await page.screenshot({ path: path.join(shotsDirectory, 'closeup-campus.png') })
console.log('saved closeup-campus')
console.log(problems.length ? problems.slice(0, 15).join('\n') : 'no console errors')
await browser.close()
