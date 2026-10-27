import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(process.env.BOXLINE_URL ?? 'http://localhost:5429/')
await page.waitForFunction(() => window.boxline && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(3000)
console.log(JSON.stringify(await page.evaluate(() => new Promise((resolve) => {
  let meshes = 0, instanced = 0, parts = {}
  window.boxlineScene.traverse((object) => { if (object.isInstancedMesh) { instanced++ } else if (object.isMesh) meshes++ })
  const gl = window.boxlineRenderer
  gl.info.autoReset = false
  gl.info.reset()
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const calls = gl.info.render.calls, triangles = gl.info.render.triangles
    gl.info.autoReset = true
    // JS time per frame
    const start = performance.now()
    let frames = 0
    const origin = window.requestAnimationFrame
    resolve({ meshes, instanced, callsPerFrame: calls, triangles })
  }))
}))))
const client = await page.context().newCDPSession(page)
await client.send('Profiler.enable')
await client.send('Profiler.start')
await page.waitForTimeout(3000)
const { profile } = await client.send('Profiler.stop')
const self = new Map()
const byId = new Map(profile.nodes.map((node) => [node.id, node]))
const dt = profile.timeDeltas
profile.samples.forEach((id, index) => { const node = byId.get(id); const key = `${node.callFrame.functionName || '(anon)'} ${node.callFrame.url.split('/').pop()}:${node.callFrame.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[index] || 0)) })
console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([key, value]) => `${(value / 1000).toFixed(0)}ms ${key}`).join('\n'))
await browser.close()
