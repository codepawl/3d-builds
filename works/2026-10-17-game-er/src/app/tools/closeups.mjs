// Close-ups of every main asset type at 1920x1080 into shots/closeups/: node tools/closeups.mjs [url]
// Needs the dev server. Moves the camera through window.waferlineLookAt, reads positions from
// window.waferlineSite and switches sites with the real site menu.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const folder = path.join(root, 'shots', 'closeups')
mkdirSync(folder, { recursive: true })
const url = process.argv[2] ?? 'http://localhost:5428/'

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(url)
await page.waitForFunction(() => window.waferlineLookAt && document.querySelectorAll('.row').length > 0, null, { timeout: 60000 })
await page.waitForTimeout(4000)

async function shoot(name, target, offset) {
  const position = target.map((value, index) => value + offset[index])
  await page.evaluate(([from, to]) => window.waferlineLookAt(from, to), [position, target])
  await page.waitForTimeout(1400)
  await page.screenshot({ path: path.join(folder, `${name}.png`) })
  console.log('shot', name)
}

const fab = () =>
  page.evaluate(() => {
    const state = window.waferlineSite()
    return {
      layout: state.layout,
      tools: state.tools.map((tool) => ({ variant: tool.variant, kind: tool.kind, center: [tool.center.x, 0, tool.center.z], angle: tool.angle })),
      stockers: state.stockers.map((stocker) => [stocker.center.x, 0, stocker.center.z]),
      vehicles: state.vehicles.map((vehicle) => ({ id: vehicle.id, phase: vehicle.job?.phase ?? 'idle', position: [vehicle.position.x, 4, vehicle.position.z] })),
      people: state.people.map((person) => ({ state: person.state, position: [person.position.x, 0.9, person.position.z] })),
    }
  })

// Tools seen from the aisle side so their load ports and pods face the camera.
const toolView = (tool, distance) => {
  const outward = Math.sign(-Math.sin(tool.angle)) || 1
  return [-outward * distance * 0.75, distance * 0.75, distance * 0.55]
}

let state = await fab()
const kinds = ['litho_b', 'litho_a', 'etch_a', 'dep_b', 'implant_a', 'furnace_a', 'cmp_a', 'metro_b', 'wet_a']
for (const variant of kinds) {
  const tool = state.tools.find((candidate) => candidate.variant === variant)
  if (tool) await shoot(`tool-${variant}`, [tool.center[0], 1.2, tool.center[2]], toolView(tool, variant.startsWith('litho') || variant.startsWith('implant') ? 13 : 10))
}
// A large tool top from above, to check for shading streaks.
const litho = state.tools.find((candidate) => candidate.variant === 'litho_b')
await shoot('litho-top', [litho.center[0], 3.5, litho.center[2]], [2, 9, 4])
await shoot('stocker', [state.stockers[1][0], 1.6, state.stockers[1][2]], [7, 6, 7])

// An OHT vehicle with its hoist down, waiting a moment for one if none is lowering now.
let lowering = null
for (let attempt = 0; attempt < 20 && !lowering; attempt++) {
  state = await fab()
  lowering = state.vehicles.find((vehicle) => vehicle.phase.startsWith('lower'))
  if (!lowering) await page.waitForTimeout(500)
}
const vehicle = lowering ?? state.vehicles[0]
await shoot('oht-hoist', [vehicle.position[0], 3, vehicle.position[2]], [4.5, 2.5, 5.5])
state = await fab()
const walker = state.people.find((person) => person.state === 'work') ?? state.people[0]
await shoot('people', walker.position, [0, 2.6, 4.8])
await shoot('subfab', [state.layout.width * 0.35, -3.5, state.layout.front - 3], [6, 3, 16])
await shoot('rail-turn', [15, 4.6, state.layout.zb + 1], [8, 7, 10])

// Campus buildings and a truck.
await page.click('.site-button')
await page.waitForTimeout(300)
await page.click('.site-menu button:nth-child(3)')
await page.waitForTimeout(4000)
await shoot('campus-fabs', [0, 10, -20], [40, 70, 120])
await shoot('campus-utilities', [40, 4, 64], [30, 40, 60])
const truck = await page.evaluate(() => {
  const truckState = window.waferlineSite().trucks[0]
  return [truckState.position.x, 2, truckState.position.z]
})
await shoot('truck', truck, [12, 8, 14])

console.log(problems.length ? `problems:\n${problems.slice(0, 8).join('\n')}` : 'no page errors')
await browser.close()
