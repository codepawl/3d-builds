import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { setPriority, constants } from "node:os";
import assert from "node:assert/strict";

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const source = await readFile(
  new URL("./footsteps.mjs", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-gpu", "--disable-renderer-backgrounding"],
});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async (moduleSource) => {
    const module = await import(
      `data:text/javascript;base64,${btoa(moduleSource)}`
    );
    const audio = module.createMechanicalAudio();
    audio.beginTimeline();
    for (let index = 0; index < 8; index++)
      audio.emit("step", index % 2 ? -1 : 1);
    audio.emit("jump");
    const events = audio.events.map((event, index) => ({
      ...event,
      seconds: index * 0.5,
    }));
    const bytes = await module.renderMechanicalAudio(events, 5);
    const decoder = new OfflineAudioContext(2, 240000, 48000);
    const buffer = await decoder.decodeAudioData(bytes.buffer.slice(0));
    const highContext = new OfflineAudioContext(2, buffer.length, 48000);
    const source = highContext.createBufferSource();
    source.buffer = buffer;
    const filter = highContext.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2000;
    source.connect(filter).connect(highContext.destination);
    source.start();
    const high = await highContext.startRendering();
    let energy = 0,
      highEnergy = 0,
      peak = 0;
    for (let channel = 0; channel < 2; channel++) {
      const samples = buffer.getChannelData(channel);
      const highSamples = high.getChannelData(channel);
      for (let index = 0; index < samples.length; index++) {
        energy += samples[index] ** 2;
        highEnergy += highSamples[index] ** 2;
        peak = Math.max(peak, Math.abs(samples[index]));
      }
    }
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return {
      base64: btoa(binary),
      peak,
      highEnergyRatio: highEnergy / energy,
      events,
    };
  }, source);
  assert.ok(result.peak > 0.01 && result.peak < 0.95);
  assert.ok(result.highEnergyRatio < 0.03, "treble energy remains restrained");
  await writeFile(
    new URL("./artifacts/mechanical-audio-preview.wav", import.meta.url),
    Buffer.from(result.base64, "base64"),
  );
  delete result.base64;
  await writeFile(
    new URL("./artifacts/audio-check.json", import.meta.url),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      peak: result.peak,
      highEnergyRatio: result.highEnergyRatio,
    }),
  );
} finally {
  await browser.close();
}
