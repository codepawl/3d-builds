// Screen doors versus train doors. Needs the dev server on 5431: node tools/psd-check.mjs
// For every station and both faces it steps the simulation until a train dwells there with doors open, then reads the
// rendered instance matrices: train door-pair centres against screen-door unit centres (metres along the track) and the lateral gap.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

fs.mkdirSync('<your folder>/viz-metro/app/shots/psd', { recursive: true })
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const problems = []
page.on('pageerror', (error) => problems.push(String(error.stack || error.message).slice(0, 400)))
await page.goto('http://127.0.0.1:5431/')
await page.waitForFunction(() => window.__appReady === true && window.__world, null, { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate(() => window.__app.setPaused(true))

const report = { rows: [], stops: [], missing: [], layout: [], problems }
for (const siteId of ['harbour', 'ring']) {
  if (siteId !== 'harbour') {
    await page.evaluate((id) => window.__store.setState({ siteId: id }), siteId)
    await page.waitForTimeout(3000)
    await page.evaluate(() => window.__app.setPaused(true))
  }
  const pending = await page.evaluate(() => {
    const world = window.__world
    window.__pending = []
    world.siteStations.forEach((station) => [1, -1].forEach((dir) => window.__pending.push({ id: station.id, dir })))
    window.__stopRecords = window.__stopRecords ?? {}
    return window.__pending.length
  })
  for (let round = 0; round < pending + 2; round += 1) {
    const hit = await page.evaluate(() => {
      const sim = window.__sim
      const world = window.__world
      const stationById = Object.fromEntries(world.siteStations.map((station) => [station.id, station]))
      for (let step = 0; step < 300000; step += 1) {
        sim.stepOnce()
        for (const train of sim.trains) {
          if (train.ghost || train.state !== 'dwell' || !train.atStationId) continue
          const station = stationById[train.atStationId]
          if (!station) continue
          const key = `${train.id}@${station.id}@${train.stopLog?.[station.id]}`
          const delta = train.s - station.s
          const record = (window.__stopRecords[key] ??= { train: train.id, station: station.id, dir: train.dir, maxAbs: 0 })
          record.maxAbs = Math.max(record.maxAbs, Math.abs(delta))
          record.delta = delta
          if (train.dwellTimer === train.dwellTotal) record.arrivalStepM = Math.abs(train.s - (train.previous?.s ?? train.s))
          const index = window.__pending.findIndex((entry) => entry.id === station.id && entry.dir === train.dir)
          if (index >= 0 && train.doorOpen >= 0.999) {
            const entry = window.__pending.splice(index, 1)[0]
            return { ...entry, trainId: train.id, delta }
          }
        }
        if (window.__pending.length === 0) break
      }
      return null
    })
    if (!hit) break
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))
    const rows = await page.evaluate((target) => {
      const world = window.__world
      const frame = world.stationFrames[target.id]
      const cos = Math.cos(frame.yaw)
      const sin = Math.sin(frame.yaw)
      const read = (assembly, namePattern) => {
        const out = []
        assembly.meshes.forEach((mesh, partIndex) => {
          const name = assembly.parts[partIndex].name
          if (!namePattern.test(name)) return
          const matrix = new world.group.matrixWorld.constructor()
          for (let index = 0; index < mesh.count; index += 1) {
            mesh.getMatrixAt(index, matrix)
            const e = matrix.elements
            const dx = e[12] - frame.x
            const dz = e[14] - frame.z
            out.push({ name, u: dx * cos - dz * sin, z: dx * sin + dz * cos, y: e[13] - frame.y })
          }
        })
        return out
      }
      const doorLeaves = []
      Object.values(world.trainAssemblies).forEach((assembly) => doorLeaves.push(...read(assembly, /Door_[LR]\d_[ab](00\d)?$/)))
      const psdLeaves = read(world.psdUnits, /^Psd_Leaf_[ab]_1$/)
      const psdFrames = read(world.psdUnits, /Frame_1$/)
      const onFace = (item) => item.z * target.dir > 0 && Math.abs(item.u) < 70 && Math.abs(item.y) < 4 && Math.abs(item.z) < 9
      const platformSide = doorLeaves.filter((leaf) => onFace(leaf) && Math.abs(leaf.z) < 6.5)
      const outerSide = doorLeaves.filter((leaf) => onFace(leaf) && Math.abs(leaf.z) >= 6.5)
      // Leaves a and b of one door move apart equally, so the mean of the two is the door centre at any opening.
      // Sorted by u the leaves of a door are neighbours; pair them by taking consecutive ones.
      platformSide.sort((first, second) => first.u - second.u)
      const centres = []
      for (let index = 0; index + 1 < platformSide.length; index += 2) centres.push((platformSide[index].u + platformSide[index + 1].u) / 2)
      const units = psdFrames.filter(onFace)
      const psdFace = psdLeaves.filter(onFace)
      return {
        doorCount: platformSide.length / 2,
        doorZ: platformSide.length ? Math.abs(platformSide[0].z) : null,
        psdLeafZ: psdFace.length ? Math.abs(psdFace[0].z) : null,
        centres,
        unitCentres: units.map((unit) => unit.u).sort((first, second) => first - second),
        outerCount: outerSide.length,
      }
    }, hit)
    const nearest = (value, list) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best) ? item - value : best), Infinity)
    const offsets = rows.centres.map((centre) => nearest(centre, rows.unitCentres))
    const maxOffset = Math.max(...offsets.map(Math.abs))
    const lateral = rows.doorZ !== null && rows.psdLeafZ !== null ? Math.abs(rows.doorZ - rows.psdLeafZ) - 0.03 - 0.04 : null
    report.rows.push({ station: hit.id, dir: hit.dir, train: hit.trainId, stopDelta: Number(hit.delta.toFixed(4)), doors: rows.doorCount, units: rows.unitCentres.length, maxOffsetCm: Number((maxOffset * 100).toFixed(2)), lateralGapM: lateral === null ? null : Number(lateral.toFixed(3)), outerLeaves: rows.outerCount })
  }
  const missing = await page.evaluate(() => window.__pending.map((entry) => `${entry.id}/${entry.dir}`))
  report.missing.push(...missing)
  const layout = await page.evaluate(() => {
    const world = window.__world
    const out = []
    Object.entries(world.psdLayouts).forEach(([stationId, faces]) => Object.entries(faces).forEach(([dir, face]) => {
      const spans = []
      face.doorCentres.forEach((centre) => spans.push([centre - 1.11, centre + 1.11]))
      face.panels.forEach(([from, to]) => spans.push([from, to]))
      spans.sort((first, second) => first[0] - second[0])
      let worst = 0
      for (let index = 1; index < spans.length; index += 1) worst = Math.max(worst, Math.abs(spans[index][0] - spans[index - 1][1]))
      out.push({ stationId, dir, units: face.doorCentres.length, panels: face.panels.length, worstJoinErrorM: worst, minPanel: Math.min(...face.panels.map(([from, to]) => to - from)) })
    }))
    return out
  })
  report.layout.push(...layout)
}
report.stops = await page.evaluate(() => Object.values(window.__stopRecords).map((record) => ({ ...record, maxAbsCm: Number((record.maxAbs * 100).toFixed(2)) })))
fs.writeFileSync('<your folder>/viz-metro/app/shots/psd/psd-check.json', JSON.stringify(report, null, 1))
console.table(report.rows)
console.log('missing (no dwelling train seen on that face)', report.missing.join(' '))
console.log('stops', report.stops.length, 'max |s - station.s| cm', Math.max(...report.stops.map((record) => record.maxAbsCm)))
console.log('largest single-step move on the arrival step (m)', Math.max(...report.stops.map((record) => record.arrivalStepM ?? 0)))
console.log('layout joins max error m', Math.max(...report.layout.map((entry) => entry.worstJoinErrorM)), 'min panel', Math.min(...report.layout.map((entry) => entry.minPanel)))
console.log('max offset cm', Math.max(...report.rows.map((row) => row.maxOffsetCm)), 'gaps', [...new Set(report.rows.map((row) => row.lateralGapM))].join(','))
console.log('problems', problems)
await browser.close()
