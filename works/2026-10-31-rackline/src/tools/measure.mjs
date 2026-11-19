// Prints the real size and parts of each downloaded GLB: node tools/measure.mjs (dev server must be running).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const assetDir = path.resolve('public/assets')
const names = fs.readdirSync(assetDir).filter((file) => file.endsWith('.glb')).map((file) => file.replace('.glb', ''))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5493/tools/measure.html')
await page.waitForFunction(() => window.ready)
const results = {}
for (const name of names) {
  const result = await page.evaluate((assetName) => window.measureAsset(assetName), name)
  results[name] = result
  const size = result.max.map((value, axis) => +(value - result.min[axis]).toFixed(2))
  console.log(name, 'size', size, 'min', result.min, 'parts', result.parts.length)
}
fs.writeFileSync('../design/asset-sizes.json', JSON.stringify(results, null, 1))
await browser.close()
