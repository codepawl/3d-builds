// One screenshot per stage preset at 1920x1080, taken a moment after the stage's key event so the acting unit is in view.
// Usage: node tools/stage-shots.mjs [stageNumber ...]   (no numbers = all). Output: shots/stages/<n>-<key>.png
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = '<your folder>/viz-metro/app/shots/stages'
fs.mkdirSync(outDir, { recursive: true })
const wanted = process.argv.slice(2).map(Number)

// Simulated seconds to run on after the event, so the picture shows the unit in the middle of the action.
const AFTER_EVENT_SECONDS = { gates: 0.6, escalator: 0.6, 'doors-open': 1.5, boarding: 0, departs: 13, turnback: 6 }

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${(error.stack || error.message).slice(0, 500)}`))
await page.goto('http://127.0.0.1:5431/')
await page.waitForFunction(() => window.__appReady === true && window.__app && window.__app.stages, null, { timeout: 60000 })
await page.waitForTimeout(1500)

const stages = await page.evaluate(() => window.__app.stages.map((stage) => ({ key: stage.key, number: stage.number, event: stage.event })))
for (const stage of stages) {
  if (wanted.length > 0 && !wanted.includes(stage.number)) continue
  const startNumber = await page.evaluate((key) => {
    window.__app.setPaused(false)
    window.__app.setSpeed(10)
    window.__app.goToStage(key)
    return window.__sim.eventTotal
  }, stage.key)
  // Let the camera fly (about a second) while the simulation runs ahead to the stage's event.
  const seen = await page.waitForFunction(({ event, startNumber }) => {
    const hit = window.__sim.events.find((entry) => entry.n > startNumber && entry.kind === event.kind && entry.stationId === event.stationId && (event.dir === undefined || entry.dir === event.dir))
    return hit ? hit.time : false
  }, { event: stage.event, startNumber }, { timeout: 240000, polling: 100 })
  const eventTime = await seen.jsonValue()
  await page.evaluate((speed) => window.__app.setSpeed(speed), stage.key === 'gates' || stage.key === 'escalator' ? 3 : 1)
  await page.waitForFunction(({ eventTime, extra }) => window.__sim.time >= eventTime + extra, { eventTime, extra: AFTER_EVENT_SECONDS[stage.key] }, { timeout: 60000, polling: 50 })
  if (stage.key === 'gates' || stage.key === 'escalator') {
    // Wait for a busy moment: two or more passengers on the escalator or at the gates of Old Mill.
    await page.waitForFunction(() => window.__sim.agents.filter((agent) => agent.stationId === 'H2' && agent.kind === 'entering' && agent.segment <= 2 && !agent.waiting && agent.wait <= 0).length >= 2, null, { timeout: 90000, polling: 50 })
  }
  await page.evaluate(() => window.__app.setPaused(true))
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${outDir}/${stage.number}-${stage.key}.png` })
  console.log('shot', stage.number, stage.key, 'event at', eventTime.toFixed(1))
}
console.log('problems', problems)
await browser.close()
