// Prints the first crowd instance matrices to check people are placed.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() !== 'log' && message.type() !== 'debug') errors.push(message.text().slice(0, 200)) })
await page.goto('http://localhost:5429/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(2500)
console.log(JSON.stringify(await page.evaluate(() => {
  const found = []
  window.boxlineScene.traverse((object) => {
    if (object.isInstancedMesh && object.boundingSphere?.radius === 4000 && found.length < 3) found.push({ name: object.material.name, bs: object.boundingSphere?.radius, count: object.count, visible: object.visible, m: Array.from(object.instanceMatrix.array.slice(12, 15)).map((v) => v.toFixed(2)), parentVisible: object.parent.visible })
  })
  return found
})))
console.log(errors.slice(0, 5).join('\n'))
await browser.close()
