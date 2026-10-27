// Records a study page to MP4 frame by frame: node study/record.mjs <page.html> <out.mp4>
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
const [pagePath, outPath] = process.argv.slice(2);
const FRAMES_PER_SECOND = 30;
const require = createRequire("<your folder>");
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FRAMES_PER_SECOND), "-c:v", "mjpeg", "-i", "pipe:0", "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", resolve(outPath)], { stdio: ["pipe", "inherit", "inherit"], windowsHide: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.goto(`file:///${resolve(pagePath).replaceAll("\\", "/")}`);
  const duration = await page.evaluate(() => window.FILM.duration);
  for (let frame = 0; frame < Math.round(duration * FRAMES_PER_SECOND); frame += 1) {
    await page.evaluate((seconds) => window.renderAt(seconds), frame / FRAMES_PER_SECOND);
    const buffer = await page.locator("canvas").screenshot({ type: "jpeg", quality: 92 });
    if (!encoder.stdin.write(buffer)) {
      await once(encoder.stdin, "drain");
    }
  }
  encoder.stdin.end();
  await once(encoder, "close");
} finally {
  await browser.close();
}
