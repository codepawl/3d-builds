// Steps renderAt frame by frame and saves PNGs.
//   node record.mjs frames <first> <last>     -> frames/00000.png ... (30 fps)
//   node record.mjs stills <t1,t2,...>        -> stills/t<seconds>.png
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openPage, ROOT } from "./browser.mjs";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
const [mode, first, last] = process.argv.slice(2);
const { browser, page } = await openPage("film.html");

async function shoot(seconds, file) {
  await page.evaluate((time) => window.renderAt(time), seconds);
  await page.screenshot({ path: file, type: "png" });
}

if (mode === "stills") {
  await mkdir(path.join(ROOT, "stills"), { recursive: true });
  for (const seconds of first.split(",").map(Number)) {
    await shoot(seconds, path.join(ROOT, "stills", `t${seconds.toFixed(2).padStart(5, "0")}.png`));
  }
} else {
  await mkdir(path.join(ROOT, "frames"), { recursive: true });
  const started = Date.now();
  for (let frame = Number(first); frame <= Number(last); frame += 1) {
    await shoot(frame / 30, path.join(ROOT, "frames", `${String(frame).padStart(5, "0")}.png`));
    if (frame % 100 === 0) console.log(`frame ${frame}, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}
await browser.close();
