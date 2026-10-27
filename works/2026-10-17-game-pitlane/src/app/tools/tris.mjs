// Lists the biggest triangle contributors in the scene (instanced count x triangles).
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('http://localhost:5429/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(2000)
console.log(await page.evaluate(() => {
  const totals = new Map()
  window.boxlineScene.traverse((object) => {
    if (!object.isMesh || !object.visible) return
    const triangles = (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3
    let key = object.material.name || object.material.type
    let node = object
    while (node.parent && !node.parent.isScene && node.parent.name === '' && node.parent.parent) node = node.parent
    key = (object.isInstancedMesh ? 'I:' : 'M:') + (object.parent?.name || object.name || key)
    totals.set(key, (totals.get(key) || 0) + triangles * (object.isInstancedMesh ? object.count : 1))
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([key, value]) => `${Math.round(value / 1000)}k ${key}`).join('\n')
}))
await browser.close()
