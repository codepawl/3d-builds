import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const results = [];
for (const engine of ["three", "67"]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5178/?engine=" + engine);
  await page.waitForFunction(() => window.sealDebug?.ready);
  const bounds = await page.locator("#seal-canvas").boundingBox();
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [center],
  });
  for (let step = 1; step <= 8; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: center.x, y: center.y - step * 9 }],
    });
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(200);
  const touch = await page.evaluate(() => window.sealDebug.state);
  await page.waitForTimeout(3100);
  const held = await page.evaluate(() => window.sealDebug.state);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator("#restart").click();
  await page.locator("#seal-canvas").focus();
  for (let note = 0; note < 44; note++) {
    await page.keyboard.press(note % 2 ? "ArrowDown" : "ArrowUp");
    await page.waitForTimeout(160);
  }
  const loop = await page.evaluate(() => window.sealDebug.state);
  const sound = await page.evaluate(async () => {
    const audio = window.sealDebug.audio;
    const analyser = audio.context.createAnalyser();
    analyser.fftSize = 4096;
    audio.master.connect(analyser);
    await new Promise((resolve) => setTimeout(resolve, 500));
    audio.play(72);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const waveform = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(waveform);
    const rms = Math.sqrt(
      waveform.reduce((sum, value) => sum + value * value, 0) / waveform.length,
    );
    const peak = Math.max(...waveform.map(Math.abs));
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(spectrum);
    let strongest = 1;
    for (let index = 2; index < spectrum.length; index++)
      if (spectrum[index] > spectrum[strongest]) strongest = index;
    const dominantHz =
      (strongest * audio.context.sampleRate) / analyser.fftSize;
    audio.setMuted(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    audio.play(72);
    await new Promise((resolve) => setTimeout(resolve, 120));
    analyser.getFloatTimeDomainData(waveform);
    const mutedRms = Math.sqrt(
      waveform.reduce((sum, value) => sum + value * value, 0) / waveform.length,
    );
    audio.setMuted(false);
    audio.master.disconnect(analyser);
    return { rms, peak, dominantHz, mutedRms };
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(300);
  const narrow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: innerWidth,
    buttons: [...document.querySelectorAll("button,a")].map((element) => ({
      text: element.textContent.trim(),
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
    })),
  }));
  await page.locator("#seal-canvas").blur();
  await page.screenshot({
    path: new URL(
      `./artifacts/${engine}/narrow.png`,
      import.meta.url,
    ).pathname.slice(1),
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#seal-canvas").focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(100);
  const reducedHeld = await page.evaluate(() => window.sealDebug.state);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(100);
  const reducedReleased = await page.evaluate(() => window.sealDebug.state);
  const report = {
    engine,
    errors,
    touch,
    held,
    loop,
    sound,
    narrow,
    reducedHeld,
    reducedReleased,
  };
  results.push(report);
  if (
    errors.length ||
    !touch.dragging ||
    touch.position !== 1 ||
    held.position !== 0 ||
    loop.position !== 2 ||
    sound.rms < 0.01 ||
    sound.peak > 1 ||
    Math.abs(sound.dominantHz - 523.25) > 20 ||
    sound.mutedRms > 0.001 ||
    narrow.scrollWidth > narrow.width ||
    narrow.buttons.some(
      (button) => button.left < 0 || button.right > narrow.width,
    ) ||
    reducedReleased.offset.some((value) => value !== 0)
  )
    process.exitCode = 1;
  await page.close();
}
await writeFile(
  new URL("./artifacts/checks.json", import.meta.url),
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map(({ engine, errors, sound, narrow, loop, touch, held }) => ({
      engine,
      errors,
      sound,
      narrow,
      loopPosition: loop.position,
      touchPosition: touch.position,
      heldPosition: held.position,
    })),
  ),
);
await browser.close();
