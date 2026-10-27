// Layout check for the lean visualization: node tools/check.mjs [width height scale] (dev server on 5432).
// Default: the landscape film page, 960 x 540 at 2x (1920 x 1080 frames). Portrait: node tools/check.mjs 540 960 2.
// Pauses the autoplay, then selects every moment by a real click and screenshots each of its shots late in the shot,
// into shots/check/ or shots/check-portrait/. Reports, per shot: every intersection between the timeline, the
// caption, the sound toggle and the visible 3D labels; labels cut by the frame edge; the caption's size in frame
// pixels and at a 360 px wide thumbnail; and whether the caption is one line (landscape) or at most two (portrait).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('<your folder>/orglet/node_modules/playwright')
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const width = Number(process.argv[2] ?? 960)
const height = Number(process.argv[3] ?? 540)
const scale = Number(process.argv[4] ?? 2)
const portraitRun = height > width
const outDirectory = path.join(root, 'shots', portraitRun ? 'check-portrait' : 'check')
fs.rmSync(outDirectory, { recursive: true, force: true })
fs.mkdirSync(outDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text())
})
await page.goto('http://localhost:5432/')
await page.waitForTimeout(1500)
await page.screenshot({ path: path.join(outDirectory, '00-opening.png') })
await page.click('.intro-button')
await page.waitForTimeout(600)
await page.keyboard.press('Space')
await page.mouse.move(width / 2, height / 2)

async function measure() {
  return page.evaluate(() => {
    const boxes = []
    for (const element of document.querySelectorAll('.reserve')) {
      const rect = element.getBoundingClientRect()
      if (rect.width > 1) boxes.push({ name: element.className.split(' ')[0], rect })
    }
    const cut = []
    for (const element of document.querySelectorAll('#label-layer [data-visible="1"]')) {
      const rect = element.getBoundingClientRect()
      boxes.push({ name: `label:${element.textContent.slice(0, 30)}`, rect })
      if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) cut.push(element.textContent.slice(0, 30))
    }
    const overlaps = []
    for (let first = 0; first < boxes.length; first++) {
      for (let second = first + 1; second < boxes.length; second++) {
        const a = boxes[first].rect
        const b = boxes[second].rect
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (x > 0 && y > 0) overlaps.push(`${boxes[first].name} x ${boxes[second].name} (${Math.round(x)}x${Math.round(y)})`)
      }
    }
    const caption = document.querySelector('.caption p')
    const captionSize = parseFloat(getComputedStyle(caption).fontSize)
    const captionLines = Math.round(caption.getBoundingClientRect().height / parseFloat(getComputedStyle(caption).lineHeight))
    const labelSizes = [...document.querySelectorAll('#label-layer [data-visible="1"] small, #label-layer [data-visible="1"] span')].map((element) => parseFloat(getComputedStyle(element).fontSize))
    return {
      moment: window.app.state().eventId,
      scene: window.app.state().scale,
      caption: caption.textContent,
      captionSize,
      captionLines,
      smallestLabel: labelSizes.length ? Math.min(...labelSizes) : null,
      date: document.querySelector('.when')?.textContent,
      labels: [...document.querySelectorAll('#label-layer [data-visible="1"]')].map((element) => element.textContent),
      hiddenLabels: [...document.querySelectorAll('#label-layer [data-visible="0"]')].map((element) => element.textContent),
      overlaps,
      cut,
    }
  })
}

// Each moment with its shot start times (beats.js) and the length of its beat.
const moments = await page.evaluate(async () => {
  const { BEATS } = await import('/src/beats.js')
  return Object.entries(BEATS).map(([id, beat]) => ({ id, starts: beat.shots.map((shot) => shot.at ?? 0), hold: Number.isFinite(beat.hold) ? beat.hold : 3 }))
})
const DAY = ['e1957morning', 'e0930', 'e1700', 'eslip', 'enight']
const report = []
let failures = 0
for (const moment of moments) {
  // The hour stops of 16 Nov 1957 show once the day is selected.
  if (DAY.includes(moment.id) && !(await page.locator(`[data-event="${moment.id}"]`).isVisible())) await page.click('[data-event="DAY"]')
  await page.click(`[data-event="${moment.id}"]`)
  const started = Date.now()
  for (let shot = 0; shot < moment.starts.length; shot++) {
    const shotEnd = shot + 1 < moment.starts.length ? moment.starts[shot + 1] : Math.max(moment.hold, moment.starts[shot] + 1.4)
    const wait = (shotEnd - 0.2) * 1000 - (Date.now() - started)
    if (wait > 0) await page.waitForTimeout(wait)
    const name = `${moment.id}-${shot + 1}`
    await page.screenshot({ path: path.join(outDirectory, `${name}.png`) })
    const result = await measure()
    const thumbnail = Math.round(((result.captionSize * scale) * 360) / (width * scale) * 10) / 10
    const tooManyLines = result.captionLines > (portraitRun ? 2 : 1)
    if (result.overlaps.length || result.cut.length || tooManyLines) failures++
    report.push({ shot: name, ...result, captionAtThumbnail: thumbnail })
    console.log(`${name}  scene=${result.scene} caption=${result.captionSize * scale}px (${thumbnail}px at 360 wide, ${result.captionLines} line) labels=${result.labels.length} smallest label=${(result.smallestLabel ?? 0) * scale}px`)
    console.log(`   ${result.date} | ${result.caption}`)
    console.log(`   labels: ${result.labels.join(' | ')}`)
    if (result.hiddenLabels.length) console.log(`   hidden: ${result.hiddenLabels.join(' | ')}`)
    for (const overlap of result.overlaps) console.log(`   OVERLAP ${overlap}`)
    for (const label of result.cut) console.log(`   CUT ${label}`)
    if (tooManyLines) console.log(`   CAPTION ${result.captionLines} lines`)
  }
}
fs.writeFileSync(path.join(outDirectory, 'report.json'), JSON.stringify({ width, height, scale, failures, report, problems }, null, 2))
console.log(`shots with a problem: ${failures}; page problems: ${problems.length}`, problems.slice(0, 5))
await browser.close()
