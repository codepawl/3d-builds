// Screenshots a study page at one time: node study/shoot.mjs <page.html> <seconds> <out.png>
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
const [pagePath, seconds, outPath] = process.argv.slice(2);
const require = createRequire("<your folder>");
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on("pageerror", (error) => console.log("page error:", error.message));
  await page.goto(`file:///${resolve(pagePath).replaceAll("\\", "/")}`);
  await page.evaluate((value) => window.renderAt(value), Number(seconds));
  await page.locator("canvas").screenshot({ path: resolve(outPath) });
} finally {
  await browser.close();
}
