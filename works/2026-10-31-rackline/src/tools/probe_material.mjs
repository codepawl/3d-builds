// Prints what the browser actually loaded for one model's materials and vertex data.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (message) => console.log('console:', message.text().slice(0, 300)))
await page.goto('http://localhost:5493/tools/probe_material.html')
await page.waitForFunction(() => window.result, null, { timeout: 60000 })
console.log(JSON.stringify(await page.evaluate(() => window.result), null, 1))
await browser.close()
