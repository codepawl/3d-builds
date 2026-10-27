// Screenshots at 1920x1080. node tools/shoot.mjs out_dir lesson:step[:theme[:extra]] ...   (lesson and step are zero-based)
// extra: "press" holds the 3D button, "pot=200" sets the knob, "wait=3" waits longer.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const [outDir, ...jobs] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (message.type() === 'error' && !/404/.test(message.text())) problems.push(message.text().slice(0, 300)) })
page.on('pageerror', (error) => problems.push(`pageerror ${error.message.slice(0, 300)}`))
await page.goto('http://127.0.0.1:5244/')
await page.waitForFunction(() => window.__app && window.__camera, null, { timeout: 30000 })
for (const job of jobs) {
  const [lessonText, stepText, theme = 'daylight', ...extras] = job.split(':')
  const lesson = Number(lessonText)
  const step = Number(stepText)
  await page.evaluate(([l, s, t]) => { window.__app.setTheme(t); window.__app.go(l, s) }, [lesson, step, theme])
  let waitSeconds = 3.6
  for (const extra of extras) {
    if (extra.startsWith('wait=')) waitSeconds = Number(extra.slice(5))
    if (extra === 'current') await page.evaluate(() => window.__app.setCurrent(true))
    if (extra === 'nocurrent') await page.evaluate(() => window.__app.setCurrent(false))
    if (extra.startsWith('pot=')) await page.evaluate((v) => window.__app.setControl('pot', v), Number(extra.slice(4)))
    if (extra.startsWith('pwm=')) await page.evaluate((v) => window.__app.setControl('pwm', v), Number(extra.slice(4)))
    if (extra.startsWith('angle=')) await page.evaluate((v) => window.__app.setControl('angle', v), Number(extra.slice(6)))
  }
  await page.waitForTimeout(waitSeconds * 1000)
  if (extras.includes('press')) {
    const point = await page.evaluate(([l]) => {
      const cols = l === 5 ? [25, 27] : [24, 26]
      return window.__app.screenOf(window.__app.targets.button(cols))
    }, [lesson])
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.waitForTimeout(700)
  }
  const file = `${outDir}/L${lesson + 1}-S${step + 1}-${theme}${extras.includes('press') ? '-press' : ''}.png`
  await page.screenshot({ path: file })
  if (extras.includes('press')) await page.mouse.up()
  console.log('saved', file)
}
console.log('problems', JSON.stringify(problems.slice(0, 6)))
await browser.close()
