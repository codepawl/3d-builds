// Playwright checks for stage cameras, the tour and playback. Usage: node tools/stages-check.mjs [shots|checks|all]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const mode = process.argv[2] || 'all'
const outDir = '<your folder>/viz-canal/app/shots/stages'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text().slice(0, 300)}`) })
page.on('pageerror', (error) => problems.push(`pageerror: ${(error.stack || error.message).slice(0, 500)}`))
await page.goto('http://127.0.0.1:5433/')
await page.waitForFunction(() => window.__appReady === true && window.__app, null, { timeout: 60000 })
await page.waitForTimeout(1500)
const result = {}

if (mode === 'shots' || mode === 'all') {
  const stages = await page.evaluate(() => window.__app.stages.map((stage) => ({ id: stage.id, key: stage.key })))
  for (let index = 0; index < stages.length; index += 1) {
    // Seek to the stage's moment, snap the camera, and pause so the frame is the same as the check sees.
    await page.evaluate((stageIndex) => { window.__app.goStage(stageIndex, { seek: true, snap: true }); window.__app.pause() }, index)
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${outDir}/${index + 1}-${stages[index].id}.png` })
  }
  await page.evaluate(() => window.__app.play())
  await page.evaluate(() => window.__app.goStage(3, { seek: true, snap: true }))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/ui-stage-bar-playback.png` })
}

if (mode === 'checks' || mode === 'all') {
  // 1. Pause freezes everything: compare sim time, water levels, ship poses, gate fractions and the rendered pixels over 1 s.
  await page.evaluate(() => { window.__app.goStage(3, { seek: true, snap: true }); window.__app.play() })
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__app.pause())
  await page.waitForTimeout(600)
  const readState = () => page.evaluate(() => {
    const sim = window.__sim
    const lane = sim.flights.flight.lanes.A
    const laneB = sim.flights.flight.lanes.B
    const time = sim.renderTime
    const poses = [0, 1, 2].map((index) => lane.pose(index, sim.laneTime(lane)))
    return JSON.stringify({
      renderTime: time,
      steps: sim.stepsRun,
      levels: [0, 1, 2].map((chamber) => [lane.levelY(chamber, sim.laneTime(lane)), laneB.levelY(chamber, sim.laneTime(laneB))]),
      gates: [0, 1, 2, 3].map((gate) => [lane.gateFraction(gate, sim.laneTime(lane)), laneB.gateFraction(gate, sim.laneTime(laneB))]),
      ships: poses.map((pose) => [pose.s ?? null, pose.y ?? null]),
      mules: window.__world.poseOf({ type: 'ship', id: 'A01' }),
    })
  })
  const before = await readState()
  const shotBefore = await page.screenshot({ clip: { x: 0, y: 120, width: 1920, height: 760 } })
  await page.waitForTimeout(1000)
  const after = await readState()
  const shotAfter = await page.screenshot({ clip: { x: 0, y: 120, width: 1920, height: 760 } })
  result.pause = { stateIdentical: before === after, pixelsIdentical: shotBefore.equals(shotAfter), before: JSON.parse(before).levels[0], after: JSON.parse(after).levels[0], renderTime: JSON.parse(after).renderTime }
  // control: the same readout changes while playing
  await page.evaluate(() => window.__app.play())
  const playBefore = await readState()
  await page.waitForTimeout(1000)
  const playAfter = await readState()
  result.playChanges = { stateDiffers: playBefore !== playAfter, steps: [JSON.parse(playBefore).steps, JSON.parse(playAfter).steps] }
  await page.evaluate(() => window.__app.pause())

  // 2. Same seed, same first 20 events at 1x, 5x and 0.25x. Frame lengths differ on purpose.
  const logs = {}
  for (const [speed, frame] of [[1, 1 / 60], [5, 1 / 30], [0.25, 1 / 20]]) {
    logs[speed] = await page.evaluate(([runSpeed, frameSeconds]) => {
      const app = window.__app
      app.sim.seek(-40)
      app.resetEventLog()
      const target = 20
      let guard = 0
      while (app.eventLog.length < target && guard < 200000) { app.drive(frameSeconds, runSpeed, frameSeconds); guard += 1 }
      return { events: app.eventLog.slice(0, target).map((event) => `${event.lane}|${event.time.toFixed(3)}|${event.text}`), simTime: app.sim.time, frames: guard }
    }, [speed, frame])
  }
  result.events = {
    count: logs[1].events.length,
    same5: JSON.stringify(logs[1].events) === JSON.stringify(logs[5].events),
    same025: JSON.stringify(logs[1].events) === JSON.stringify(logs[0.25].events),
    first3: logs[1].events.slice(0, 3),
    last: logs[1].events[19],
    frames: { 1: logs[1].frames, 5: logs[5].frames, 0.25: logs[0.25].frames },
  }
  // Fixed step count equals simulated time at every speed: 60 steps per simulated second.
  result.stepLength = await page.evaluate(() => {
    const app = window.__app
    const out = {}
    for (const speed of [0.25, 1, 5, 10]) {
      app.sim.seek(0)
      const startSteps = app.sim.stepsRun
      app.drive(2, speed, 1 / 60)
      out[speed] = { steps: app.sim.stepsRun - startSteps, simSeconds: Number(app.sim.time.toFixed(4)) }
    }
    return out
  })

  // 3. Tour visits every stage once, in order, and any click stops it.
  await page.evaluate(() => { window.__app.setSpeed(10); window.__app.play(); window.__app.startTour() })
  const visited = []
  const started = Date.now()
  let lastIndex = -1
  while (Date.now() - started < 150000) {
    const tour = await page.evaluate(() => ({ ...window.__app.tour, stage: window.__app.stageIndex, speed: window.__app.effectiveSpeed }))
    if (tour.active && tour.index !== lastIndex) { lastIndex = tour.index; visited.push(tour.index) }
    if (!tour.active) { result.tourFinal = tour; break }
    await page.waitForTimeout(100)
  }
  result.tour = { stagesShown: visited, visitedEvents: await page.evaluate(() => window.__app.tour.visited), wallSeconds: (Date.now() - started) / 1000 }
  // click stops the tour
  await page.evaluate(() => { window.__app.setSpeed(1); window.__app.startTour() })
  await page.waitForTimeout(500)
  await page.mouse.click(960, 600)
  await page.waitForTimeout(300)
  result.tourStopsOnClick = await page.evaluate(() => !window.__app.tour.active)
}

if (mode === 'gates') {
  result.gates = await page.evaluate(() => {
    const lane = window.__sim.flights.flight.lanes.A
    const ship = lane.ships[0]
    const probes = { startMove: ship.startMove, arrive: ship.segments[0].t1, closeMid: (ship.segments[1].t0 + ship.segments[1].t1) / 2, closeEnd: ship.segments[1].t1, fillMid: (ship.segments[2].t0 + ship.segments[2].t1) / 2 }
    return Object.fromEntries(Object.entries(probes).map(([name, time]) => [name, [0, 1].map((gate) => Number(lane.gateFraction(gate, time).toFixed(2)))]))
  })
}

console.log(JSON.stringify(result, null, 1))
console.log('problems', problems.slice(0, 10))
await browser.close()
