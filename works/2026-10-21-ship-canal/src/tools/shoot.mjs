import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = '<your folder>/viz-canal/app/shots'
fs.mkdirSync(outDir, { recursive: true })
const steps = JSON.parse(process.argv[2] || '[]')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
  headless: false,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const problems = []
page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text().slice(0, 300)}`) })
page.on('pageerror', (error) => problems.push(`pageerror: ${(error.stack || error.message).slice(0, 700)}`))
await page.goto('http://127.0.0.1:5433/')
try { await page.waitForFunction(() => window.__appReady === true, null, { timeout: 40000 }) } catch (error) { console.log('NOT READY'); console.log(problems.slice(0, 10)); await page.screenshot({ path: outDir + '/not-ready.png' }); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)

for (const step of steps) {
  if (step.eval) await page.evaluate(step.eval)
  if (step.click) await page.click(step.click)
  if (step.wait) await page.waitForTimeout(step.wait)
  if (step.fps) {
    const fps = await page.evaluate(() => new Promise((resolve) => {
      let frames = 0
      const start = performance.now()
      const tick = () => {
        frames += 1
        if (performance.now() - start >= 4000) resolve(frames / ((performance.now() - start) / 1000))
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))
    console.log('fps', fps.toFixed(1))
  }
  if (step.shot) await page.screenshot({ path: `${outDir}/${step.shot}.png` })
  if (step.log) console.log(await page.evaluate(step.log))
}
console.log('problems', problems.slice(0, 12))
await browser.close()
