// Runs the visualize-in-3d coplanar check on the built harbour site. The check skips instanced meshes, so every instance of the
// station parts (platform modules, screen doors, panels, floor) is expanded to a plain mesh first. Dev server on 5431 required.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const checkSource = fs.readFileSync('<your folder>/skills/plugins/visualize-in-3d/skills/visualize-in-3d/scripts/coplanar-check.js', 'utf8')
  .replace("import * as THREE from 'three';", '')
  .replace('export function findCoplanarPairs', 'function findCoplanarPairs')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: false })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto('http://127.0.0.1:5431/')
await page.waitForFunction(() => window.__appReady === true && window.__world, null, { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => window.__app.setPaused(true))
const result = await page.evaluate(async (source) => {
  const THREE = await import('/node_modules/.vite/deps/three.js')
  const findCoplanarPairs = new Function('THREE', `${source}; return findCoplanarPairs`)(THREE)
  const world = window.__world
  const scene = new THREE.Group()
  const stationPartPattern = /Psd_|Station_Module|Station_Floor|Station_Wall|Mezzanine/
  let expanded = 0
  const psdGeometries = new Set([world.psdUnits, world.psdPanels, world.psdEndPosts].flatMap((assembly) => assembly.parts.map((part) => part.geometry)))
  const withoutPsd = new THREE.Group()
  world.group.traverse((object) => {
    if (!object.isInstancedMesh) return
    const matrix = new THREE.Matrix4()
    for (let index = 0; index < object.count; index += 1) {
      object.getMatrixAt(index, matrix)
      const mesh = new THREE.Mesh(object.geometry, object.material)
      mesh.name = object.geometry.name || object.material.name || 'part'
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(matrix)
      mesh.matrixWorld.copy(matrix)
      scene.add(mesh)
      if (!psdGeometries.has(object.geometry)) withoutPsd.add(mesh.clone())
      expanded += 1
    }
  })
  const tally = (list) => { const counts = {}; list.forEach((pair) => { const key = [pair.first, pair.second].sort().join(' | ') + ` gap ${pair.gapCm}cm`; counts[key] = (counts[key] ?? 0) + 1 }); return counts }
  const withPsd = tally(findCoplanarPairs(scene))
  const baseline = tally(findCoplanarPairs(withoutPsd))
  const added = {}
  Object.entries(withPsd).forEach(([key, count]) => { if (count !== (baseline[key] ?? 0)) added[key] = count - (baseline[key] ?? 0) })
  return { expanded, psdMeshes: scene.children.length - withoutPsd.children.length, addedByPsd: added }
}, checkSource)
console.log(JSON.stringify(result, null, 1))
await browser.close()
