// Screenshots at 1920x1080 for visual review, fps, and a check that people clips really play.
// Usage: node tools/shoot.mjs [main|closeups|all]
// Clicks objects for real at their projected screen positions and switches sites with the menu.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
mkdirSync(path.join(root, 'shots', 'closeups'), { recursive: true })
const only = process.argv[2] ?? 'all'
const url = process.argv[3] ?? 'http://localhost:5430/'
const shot = (page, name) => page.screenshot({ path: path.join(root, 'shots', `${name}.png`) })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()))
page.on('pageerror', (error) => problems.push(error.message))
await page.goto(url)
await page.waitForFunction(() => document.querySelectorAll('.row').length > 0 && window.appScreenPosition, null, { timeout: 120000 })
await page.waitForTimeout(5000)

async function measureFps(seconds = 4) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const count = () => {
          frames++
          if (performance.now() - start < duration * 1000) requestAnimationFrame(count)
          else resolve((frames * 1000) / (performance.now() - start))
        }
        requestAnimationFrame(count)
      }),
    seconds,
  )
}

const drawCalls = () => page.evaluate(() => `${window.appRenderer.info.render.calls} calls, ${Math.round(window.appRenderer.info.render.triangles / 1000)}k tris`)

async function switchTo(siteId) {
  await page.click('.site-button')
  await page.waitForTimeout(300)
  await page.click(`.site-menu button[data-site="${siteId}"]`)
  await page.waitForTimeout(4000)
}

async function lookAt(name, position, target, wait = 1200) {
  await page.evaluate(([from, to]) => window.appLookAt(from, to), [position, target])
  await page.waitForTimeout(wait)
  await page.screenshot({ path: path.join(root, 'shots', 'closeups', `${name}.png`) })
}

// Bones of every visible person: how many changed rotation over 300 ms (the clips are playing).
async function clipCheck() {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const bones = []
        window.appScene.traverse((object) => {
          if (/^thigh/i.test(object.name) && object.parent && object.visible) bones.push(object)
        })
        const before = bones.map((bone) => bone.quaternion.clone())
        setTimeout(() => {
          const moved = bones.filter((bone, index) => bone.quaternion.angleTo(before[index]) > 0.01).length
          resolve({ thighs: bones.length, moved })
        }, 300)
      }),
  )
}

if (only === 'all' || only === 'main') {
  const renderer = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl2')
    const info = context.getExtension('WEBGL_debug_renderer_info')
    return context.getParameter(info.UNMASKED_RENDERER_WEBGL)
  })
  console.log('renderer', renderer)
  await shot(page, '01-overview')
  console.log('overview fps', (await measureFps()).toFixed(1), await drawCalls())
  console.log('clips', JSON.stringify(await clipCheck()))

  // Select an occupied bay's patient by clicking it on screen.
  const target = await page.evaluate(() => {
    const state = window.appSite()
    const patient = state.patients.find((candidate) => !candidate.gone && candidate.carrier?.type === 'trolley' && candidate.bedId && candidate.level <= 3)
    return patient?.id
  })
  const bayPoint = await page.evaluate((id) => window.appFollowPoint(id), target)
  await page.evaluate((point) => window.appLookAt([point.x + 9, 14, point.z + 15], [point.x, 0.6, point.z]), bayPoint)
  await page.waitForTimeout(1500)
  const screen = await page.evaluate((id) => window.appScreenPosition(id), target)
  await page.mouse.click(screen.x, screen.y)
  await page.waitForTimeout(1200)
  console.log('clicked', target, 'card', await page.evaluate(() => document.querySelector('.detail h2')?.textContent))
  await shot(page, '02-selected-card')
  console.log('close-up fps', (await measureFps(3)).toFixed(1), await drawCalls())
  console.log('clips close', JSON.stringify(await clipCheck()))

  // Ambulance bay close-up and a list row fly-to.
  await page.keyboard.press('Escape')
  await page.click('.tab:has-text("Staff")')
  await page.waitForTimeout(300)
  await page.click('.rows .row >> nth=6')
  await page.waitForTimeout(2500)
  console.log('row card', await page.evaluate(() => document.querySelector('.detail h2')?.textContent))
  await shot(page, '03-list-row-fly')

  await switchTo('LH')
  await shot(page, '04-second-site')
  console.log('LH fps', (await measureFps(3)).toFixed(1), await drawCalls())
  await switchTo('AV')
  await shot(page, '05-third-site')
  await switchTo('MP')
}

if (only === 'all' || only === 'closeups') {
  const layout = await page.evaluate(() => {
    const state = window.appSite()
    const { halfWidth, halfDepth, ambulanceBay, helipad, rooms, cubicles, resus, nurseStation, triageDesks, walkIn } = state.layout
    return { halfWidth, halfDepth, ambulanceBay, helipad, rooms, cubicles, resus, nurseStation, triageDesks, walkIn }
  })
  const { halfWidth, halfDepth, ambulanceBay, helipad, rooms, cubicles, resus, nurseStation, triageDesks, walkIn } = layout
  const ct = rooms.find((room) => room.kind === 'ct')
  const xray = rooms.find((room) => room.kind === 'xray')
  const lab = rooms.find((room) => room.kind === 'lab')
  await lookAt('ambulance-bay', [ambulanceBay.parkX + 9, 9, ambulanceBay.doorZ + 12], [ambulanceBay.parkX - 2, 1, ambulanceBay.doorZ])
  await lookAt('cubicles', [cubicles[3].x + 4, 7.5, cubicles[3].z + 9], [cubicles[3].x, 0.6, cubicles[3].z])
  await lookAt('resus', [resus[0].x - 3, 8, resus[0].z + 9], [resus[0].x, 0.6, resus[0].z])
  await lookAt('imaging', [ct.x + 6, 9, ct.z + 11], [(ct.x + xray.x) / 2, 0.6, ct.z + 1])
  await lookAt('waiting-triage', [triageDesks[0].x + 6, 10, triageDesks[0].z + 10], [triageDesks[0].x - 6, 0.6, triageDesks[0].z])
  await lookAt('nurses-station', [nurseStation.x + 5, 7, nurseStation.z + 8], [nurseStation.x, 0.8, nurseStation.z])
  await lookAt('lab', [lab.x + 6, 7, lab.z + 8], [lab.x, 0.6, lab.z])
  await lookAt('entrance', [walkIn.inside.x + 8, 7, walkIn.inside.z + 14], [walkIn.inside.x, 1, walkIn.inside.z + 2])
  if (helipad) await lookAt('helipad', [helipad.x + 18, 16, helipad.z + 22], [helipad.x, 1, helipad.z])
  // A walking person, close.
  const walker = await page.evaluate(() => {
    const person = window.appSite().people.find((candidate) => !candidate.hidden && !candidate.removed && candidate.state === 'walk')
    return person && { x: person.position.x, z: person.position.z }
  })
  if (walker) await lookAt('person-walking', [walker.x + 3, 3.2, walker.z + 4], [walker.x, 1, walker.z], 400)
  console.log('clips', JSON.stringify(await clipCheck()))
  void halfWidth
  void halfDepth
}

console.log(problems.length ? `page problems: ${problems.slice(0, 5).join(' | ')}` : 'no page errors')
await browser.close()
