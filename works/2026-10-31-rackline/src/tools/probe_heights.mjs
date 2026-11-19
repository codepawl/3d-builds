import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5493/tools/measure.html')
await page.waitForFunction(() => window.ready)
const result = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null)
  return THREE ? 'three' : 'none'
})
console.log(result)
const parts = await page.evaluate(async () => {
  const model = await window.measureAsset('vehicle_forklift_red_b01')
  const groups = {}
  for (const part of model.parts) {
    const group = part.parent.replace(/_b01.*/, '')
    groups[group] = groups[group] || { count: 0, min: [9, 9, 9], max: [-9, -9, -9], materials: new Set() }
    groups[group].count++
    part.min.forEach((value, axis) => { groups[group].min[axis] = Math.min(groups[group].min[axis], value) })
    part.max.forEach((value, axis) => { groups[group].max[axis] = Math.max(groups[group].max[axis], value) })
    groups[group].materials.add(part.material)
  }
  return Object.entries(groups).map(([name, group]) => `${name} n=${group.count} ${group.min} .. ${group.max} materials=${group.materials.size}`)
})
console.log(parts.join('\n'))
const shelves = await page.evaluate(async () => {
  const output = {}
  for (const name of ['rack_large_empty_a02', 'rack_large_empty_a01', 'conveyor_belt_a08']) {
    output[name] = await window.heightsAlong(name)
  }
  return output
})
console.log(JSON.stringify(shelves))
await browser.close()
