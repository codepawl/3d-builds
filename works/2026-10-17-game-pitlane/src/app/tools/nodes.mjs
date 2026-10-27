// Counts scene nodes by top-level branch to see what the per-frame matrix update walks.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(process.env.BOXLINE_URL ?? 'http://localhost:5439/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(2000)
console.log(await page.evaluate(() => {
  const count = (object) => { let total = 0; object.traverse(() => total++); return total }
  const lines = []
  const walk = (object, depth) => {
    for (const child of object.children) {
      const total = count(child)
      if (total > 150) lines.push(`${'  '.repeat(depth)}${child.type} ${child.name || ''} children=${child.children.length} total=${total} auto=${child.matrixWorldAutoUpdate}`)
      if (total > 400 && depth < 4) walk(child, depth + 1)
    }
  }
  walk(window.boxlineScene, 0)
  return `scene total ${count(window.boxlineScene)}\n` + lines.join('\n')
}))
await browser.close()
