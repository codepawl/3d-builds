// Opens headless Chromium on a page of this folder, served through a request route
// (ES modules do not load from file:// URLs).
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = "http://film.local/";
const CONTENT_TYPES = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".json": "application/json",
  ".bin": "application/octet-stream",
};

export async function openPage(pageName, viewport = { width: 1920, height: 1080 }) {
  const browser = await chromium.launch({ args: ["--disable-renderer-backgrounding"] });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("console", (message) => console.log("[page]", message.text()));
  page.on("pageerror", (error) => console.error("[page error]", error.message));
  await page.route(`${ORIGIN}**`, async (route) => {
    const relative = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    const filePath = path.join(ROOT, relative);
    try {
      const body = await readFile(filePath);
      const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
      await route.fulfill({ status: 200, body, contentType });
    } catch {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });
  await page.goto(ORIGIN + pageName);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return { browser, page };
}
