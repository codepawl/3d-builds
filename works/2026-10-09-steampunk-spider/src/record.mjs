import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";
import { spawnSync } from "node:child_process";
setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const output = new URL("./artifacts/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-renderer-backgrounding"],
});
try {
  for (const pixel of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:5186/");
    await page.waitForFunction(() => spiderDebug.ready);
    if (!pixel) await page.locator("#pixel").click();
    await page.locator("#terrain").click();
    await page.locator("#reset").click();
    await page.evaluate(() => spiderDebug.setSide("left"));
    await page.waitForTimeout(800);
    await page.addStyleTag({
      content:
        "header, footer, #loading { display: none !important; } #world { outline: none !important; cursor: none !important; }",
    });
    await page.evaluate(() => {
      const stream = document.querySelector("canvas").captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 7000000,
      });
      window.captureDone = new Promise((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 32768)
            binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
          stream.getTracks().forEach((track) => track.stop());
          resolve(btoa(binary));
        };
      });
      window.captureRecorder = recorder;
      recorder.start();
    });
    async function leadTo(x, z, seconds) {
      const target = await page.evaluate(
        ([x, z]) => spiderDebug.project(x, z),
        [x, z],
      );
      await page.mouse.move(target.x, target.y, { steps: 20 });
      await page.waitForTimeout(seconds * 1000);
    }
    const started = performance.now();
    const telemetry = [];
    async function until(seconds) {
      const delay = started + seconds * 1000 - performance.now();
      if (delay > 0) await page.waitForTimeout(delay);
      telemetry.push({
        seconds,
        ...(await page.evaluate(() => spiderDebug.state)),
      });
    }
    await leadTo(0, -2.8, 0);
    await until(5);
    await leadTo(0, 2.8, 0);
    await page.locator("#world").focus();
    await page.keyboard.press("Space");
    await until(10);
    await page.evaluate(() => spiderDebug.setSide("right"));
    await page.waitForTimeout(150);
    await leadTo(0, -2.8, 0);
    await until(15);
    await leadTo(0, 2.8, 0);
    await page.keyboard.press("Space");
    await until(20.2);
    const report = await page.evaluate(() => spiderDebug.state);
    await page.evaluate(() => captureRecorder.stop());
    const bytes = Buffer.from(await page.evaluate(() => captureDone), "base64");
    for (let index = 1; index < telemetry.length; index++) {
      const current = telemetry[index];
      const previous = telemetry[index - 1];
      if (
        current.steps <= previous.steps ||
        Math.hypot(
          current.position[0] - previous.position[0],
          current.position[2] - previous.position[2],
        ) < 0.08
      ) {
        throw new Error(
          `Spider stalled during ${previous.seconds}-${current.seconds}s`,
        );
      }
    }
    const name = pixel ? "spider-side-pixel" : "spider-side-smooth";
    const webm = new URL(name + ".webm", output).pathname.slice(1),
      mp4 = new URL(name + ".mp4", output).pathname.slice(1);
    await writeFile(webm, bytes);
    const encoded = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        webm,
        "-i",
        new URL("soundtrack.m4a", output).pathname.slice(1),
        "-t",
        "20",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vf",
        "fps=30",
        "-c:v",
        "libx264",
        "-threads",
        "4",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-af",
        "volume=0.7,afade=t=out:st=19.5:d=0.5",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        mp4,
      ],
      { windowsHide: true, encoding: "utf8" },
    );
    if (encoded.status !== 0) throw new Error(encoded.stderr);
    await page.screenshot({
      path: new URL(name + ".png", output).pathname.slice(1),
    });
    await writeFile(
      new URL(name + ".json", output),
      JSON.stringify(
        { errors, telemetry, musicStartSeconds: 103, ...report },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        file: mp4,
        pixel,
        steps: report.steps,
        vents: report.vents,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
