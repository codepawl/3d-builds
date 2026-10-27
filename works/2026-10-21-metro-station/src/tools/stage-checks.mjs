// Numeric checks for stages, tour and playback. Run with the dev server up: node tools/stage-checks.mjs
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import crypto from 'node:crypto'

const outDir = '<your folder>/viz-metro/app/shots/stages'
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${(error.stack || error.message).slice(0, 400)}`))
await page.goto('http://127.0.0.1:5431/')
await page.waitForFunction(() => window.__appReady === true && window.__app && window.__app.stages, null, { timeout: 60000 })
await page.waitForTimeout(1500)
const results = {}

// Counts pixels whose colour differs by more than 12 in any channel, comparing two screenshots inside the page.
const pixelDifference = (bufferA, bufferB) => page.evaluate(async ([a, b]) => {
  const load = async (base64) => {
    const blob = await (await fetch('data:image/png;base64,' + base64)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data
  }
  const first = await load(a)
  const second = await load(b)
  let different = 0
  for (let index = 0; index < first.length; index += 4) {
    if (Math.abs(first[index] - second[index]) > 12 || Math.abs(first[index + 1] - second[index + 1]) > 12 || Math.abs(first[index + 2] - second[index + 2]) > 12) different += 1
  }
  return { differentPixels: different, totalPixels: first.length / 4 }
}, [bufferA.toString('base64'), bufferB.toString('base64')])

// ---- 1. Pause freezes every moving thing (1 s of real time).
const snapshotState = () => page.evaluate(() => {
  const sim = window.__sim
  return JSON.stringify({
    time: sim.time,
    accumulator: sim.accumulator,
    trains: sim.trains.map((train) => [train.id, train.s, train.speed, train.doorOpen, train.wheelAngle]),
    agents: sim.agents.map((agent) => [agent.id, agent.u, agent.v, agent.y]),
    poses: sim.trains.filter((train) => !train.ghost).map((train) => { const pose = window.__world.poseOf({ type: 'train', id: train.id }); return pose ? [pose.x, pose.y, pose.z, pose.yaw] : null }),
    depot: sim.depot.trains.map((train) => [train.s, train.wheelAngle]),
    renderTime: sim.renderTime,
  })
})
await page.evaluate(() => { window.__app.setPaused(false); window.__app.setSpeed(1); window.__app.goToStage('doors-open') })
await page.waitForTimeout(2500)
const runningA = await snapshotState()
await page.waitForTimeout(700)
const runningB = await snapshotState()
await page.keyboard.press('Space')
await page.waitForTimeout(400)
const pausedA = await snapshotState()
const pausedImageA = await page.screenshot()
await page.waitForTimeout(1000)
const pausedB = await snapshotState()
const pausedImageB = await page.screenshot()
const parsed = (text) => JSON.parse(text)
results.pause = {
  runningMoves: runningA !== runningB,
  pausedStateIdentical: pausedA === pausedB,
  pausedSimTime: [parsed(pausedA).time, parsed(pausedB).time],
  trainsCompared: parsed(pausedA).trains.length,
  agentsCompared: parsed(pausedA).agents.length,
  pausedScreenshotDifference: await pixelDifference(pausedImageA, pausedImageB),
}
// Same two-second gap while running, for scale.
await page.keyboard.press('Space')
const runningShotA = await page.screenshot()
await page.waitForTimeout(1000)
const runningShotB = await page.screenshot()
results.pause.runningScreenshotDifference = await pixelDifference(runningShotA, runningShotB)
await page.keyboard.press('Space')
// Step advances exactly one fixed step while paused.
await page.waitForTimeout(300)
const beforeStep = parsed(await snapshotState()).time
await page.evaluate(() => window.__app.stepOnePaused())
await page.waitForTimeout(200)
results.pause.stepAdvanced = Number((parsed(await snapshotState()).time - beforeStep).toFixed(3))
await page.keyboard.press('Space')

// ---- 2. Same seed, same first 20 events at 1x, 5x and 0.25x (fresh simulation per speed, jittery frame times).
results.determinism = await page.evaluate(() => {
  const run = (speed, frameSeconds) => {
    const sim = window.__app.createSimulation(11)
    sim.speed = speed
    let frames = 0
    let wobble = 0
    while (sim.events.length < 20 && frames < 400000) {
      wobble = (wobble + 1) % 5
      sim.advance(frameSeconds * (0.6 + wobble * 0.2))
      frames += 1
    }
    const first = sim.events.slice(0, 20).map((event) => `${event.n}:${event.kind}:${event.stationId}:${event.trainId ?? event.agentId}`)
    return { speed, frames, simTime: Number(sim.time.toFixed(1)), first }
  }
  const runs = [run(1, 1 / 60), run(5, 1 / 60), run(0.25, 1 / 60)]
  // Longer window: the whole event log for the first 300 simulated seconds, hashed, at the same three speeds.
  const longRun = (speed) => {
    const sim = window.__app.createSimulation(11)
    sim.speed = speed
    while (sim.time < 300) sim.advance(1 / 60)
    const text = sim.events.map((event) => `${event.n}:${event.kind}:${event.stationId}:${event.trainId ?? event.agentId}:${event.time.toFixed(1)}`).join('|')
    let hash = 0
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0
    return { speed, total: sim.eventTotal, hash }
  }
  const long = [longRun(1), longRun(5), longRun(0.25)]
  return { long, longIdentical: long.every((entry) => entry.hash === long[0].hash && entry.total === long[0].total), runs: runs.map((entry) => ({ speed: entry.speed, frames: entry.frames, simTime: entry.simTime })), identical: runs.every((entry) => JSON.stringify(entry.first) === JSON.stringify(runs[0].first)), firstFive: runs[0].first.slice(0, 5) }
})

// ---- 3. Tour visits every stage once (click the Tour button, let it run).
await page.evaluate(() => { window.__app.setPaused(false); window.__app.setSpeed(1) })
const tourStart = Date.now()
await page.click('.tour')
const seenStages = []
for (let tick = 0; tick < 1200; tick += 1) {
  const state = await page.evaluate(() => ({ tour: window.__app.tour ? window.__app.tour.phase : null, stage: window.__app.stageKey, speed: window.__sim.speed }))
  if (seenStages[seenStages.length - 1] !== state.stage && state.tour) seenStages.push(state.stage)
  if (!state.tour && tick > 5) break
  await page.waitForTimeout(250)
}
const visits = await page.evaluate(() => window.__app.tourVisits)
results.tour = {
  realSeconds: Number(((Date.now() - tourStart) / 1000).toFixed(1)),
  stageOrder: seenStages,
  visits: visits.map((visit) => `${visit.key}@event${visit.eventNumber}`),
  eachOnce: visits.length === 6 && new Set(visits.map((visit) => visit.key)).size === 6 && visits.every((visit) => visit.eventNumber !== null),
  speedRestored: await page.evaluate(() => window.__app.speedSetting),
}
// A click stops a running tour.
await page.click('.tour')
await page.waitForTimeout(600)
await page.mouse.click(960, 560)
results.tour.clickStops = await page.evaluate(() => window.__app.tour === null)

// ---- 4. At 1x the followed train still moves every frame.
const followResult = await page.evaluate(async () => {
  window.__app.setPaused(false)
  window.__app.setSpeed(1)
  const candidate = window.__sim.trains.filter((train) => !train.ghost && train.state === 'run' && train.speed > 6)[0]
  window.__bus.push({ type: 'fly', ref: { type: 'train', id: candidate.id }, follow: true })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const samples = []
  await new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      const pose = window.__world.poseOf({ type: 'train', id: candidate.id })
      samples.push({ x: pose.x, z: pose.z, speed: candidate.speed, time: performance.now() })
      if (performance.now() - start > 3000) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const deltas = samples.slice(1).map((sample, index) => Math.hypot(sample.x - samples[index].x, sample.z - samples[index].z))
  return { id: candidate.id, frames: samples.length, framesMoved: deltas.filter((delta) => delta > 1e-6).length, minDelta: Math.min(...deltas), maxDelta: Math.max(...deltas), minSpeed: Math.min(...samples.map((sample) => sample.speed)) }
})
results.follow = followResult

// ---- 5. Speed controls by keys: + steps up, - steps down; speed 10x runs ~10x sim time.
await page.evaluate(() => window.__app.setSpeed(1))
await page.keyboard.press('+')
await page.keyboard.press('+')
const afterPlus = await page.evaluate(() => window.__app.speedSetting)
await page.keyboard.press('-')
const afterMinus = await page.evaluate(() => window.__app.speedSetting)
const rates = {}
for (const speed of [0.25, 1, 10]) {
  await page.evaluate((value) => window.__app.setSpeed(value), speed)
  await page.waitForTimeout(600)
  const before = await page.evaluate(() => window.__sim.time)
  await page.waitForTimeout(2000)
  const after = await page.evaluate(() => window.__sim.time)
  rates[`${speed}x`] = Number(((after - before) / 2).toFixed(2))
}
results.speed = { afterTwoPlus: afterPlus, afterMinus, simSecondsPerRealSecond: rates }
await page.evaluate(() => window.__app.setSpeed(1))

// ---- 6. Controls screenshot: a selected train with its card, stage bar and playback strip.
await page.keyboard.press('4')
await page.evaluate(() => {
  const train = window.__sim.trains.filter((candidate) => candidate.id === 'H-02')[0]
  window.__store.setState({ selected: { type: 'train', id: train.id } })
})
await page.waitForTimeout(2500)
await page.screenshot({ path: `${outDir}/7-controls.png` })
results.keys = { stageAfterKey4: await page.evaluate(() => window.__app.stageKey) }
console.log(JSON.stringify(results, null, 2))
console.log('problems', problems)
await browser.close()
