// Close-ups of every main asset type at 1920x1080 into shots/closeups/: node tools/closeups.mjs [url]
// Needs the dev server. Moves the camera through window.squawkLookAt and switches sectors with the
// real site menu.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const folder = path.join(root, 'shots', 'closeups')
mkdirSync(folder, { recursive: true })
const url = process.argv[2] ?? 'http://localhost:5424/'

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()))
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(url)
await page.waitForTimeout(5000)

async function site(index) {
  await page.keyboard.press('Escape')
  await page.click('.site-button')
  await page.waitForTimeout(250)
  await page.click(`.site-menu button:nth-child(${index})`)
  await page.waitForTimeout(2500)
}

async function shoot(name, from, to) {
  await page.evaluate(([position, target]) => window.squawkLookAt(position, target), [from, to])
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(folder, `${name}.png`) })
}

await site(1)
await shoot('tower-terminal', [140, 70, -60], [90, 8, -200])
await shoot('parked-aircraft', [-40, 32, -120], [-75, 2, -170])
await shoot('radar-hangars', [-200, 55, -80], [-270, 8, -190])
await shoot('runway-threshold', [300, 26, 10], [200, 0, -45])
await shoot('birds-coast', [330, 80, 170], [330, 25, 300])
const flight = await page.evaluate(() => window.squawkSite().flights.find((candidate) => candidate.altitude > 300)?.id)
if (flight) {
  const position = await page.evaluate((id) => window.squawkSite().flights.find((candidate) => candidate.id === id).position, flight)
  await shoot('tower-arrival', [position.x + 40, position.y + 18, position.z + 45], [position.x, position.y, position.z])
}

await site(2)
await shoot('holding-fix', [1330, 160, 110], [1200, 20, -50])
const weather = await page.evaluate(() => ({ x: window.squawkSite().weather.x, z: window.squawkSite().weather.z }))
await shoot('storm-cell', [weather.x + 150, 420, weather.z + 1000], [weather.x, 180, weather.z])

await site(3)
await shoot('vor-airway', [-430, 230, -80], [-600, 30, -300])
await shoot('town', [-1250, 420, -380], [-1500, 0, -700])
const cruiser = await page.evaluate(() => {
  const state = window.squawkSite()
  const flight = state.flights.find((candidate) => candidate.phase === 'cruise')
  return flight ? flight.position : null
})
if (cruiser) await shoot('enroute-jet', [cruiser.x + 160, cruiser.y + 70, cruiser.z + 160], [cruiser.x, cruiser.y, cruiser.z])

console.log(problems.length ? `problems:\n${problems.slice(0, 8).join('\n')}` : 'no console errors')
await browser.close()
