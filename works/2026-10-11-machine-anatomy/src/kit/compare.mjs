// Reference compare: each reference image (reference/images/sources.json) beside the film still that shows
// the figure at a similar moment and angle, in one sheet, shots/reference-compare.png. The agent opens it
// and notes what differs before calling a machine done (references/reference-images.md).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, lowerPriority } from "./browser.mjs";
import { baseName } from "./build.mjs";
import { loadMachine } from "./page.mjs";

const ROW_HEIGHT = 360;

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The still each image is compared with: its `compare` name, else the film's first still.
function stillFor(entry, stillsFolder, firstStill) {
  const name = entry.compare ?? firstStill;
  const file = join(stillsFolder, `video-frame-${name}.png`);
  return existsSync(file) ? { name, file } : null;
}

function rowHtml(entry, imagesFolder, still) {
  const reference = pathToFileURL(join(imagesFolder, entry.file)).href;
  const figure = still ? `<img src="${pathToFileURL(still.file).href}">` : `<div class="missing">no still yet: record the film</div>`;
  const caption = `${escapeHtml(entry.file)} · ${escapeHtml(entry.shows)}<br>still: ${escapeHtml(still?.name ?? "none")}`;
  return `<div class="row"><img src="${reference}">${figure}<p>${caption}</p></div>`;
}

function sheetHtml(rows) {
  const css = `body{margin:0;padding:16px;background:#f4f3ef;font:13px/1.4 system-ui,sans-serif;color:#222}.row{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.row img{height:${ROW_HEIGHT}px;width:auto;background:#fff}.missing{height:${ROW_HEIGHT}px;width:480px;display:flex;align-items:center;justify-content:center;background:#e6e3dc}.row p{width:260px;margin:0}`;
  return `<!doctype html><html><head><style>${css}</style></head><body>${rows.join("")}</body></html>`;
}

// Writes shots/reference-compare.png from the default variant's stills (or the one named).
export async function compareCommand(dir, { variant } = {}) {
  lowerPriority();
  const loaded = await loadMachine(dir);
  const imagesFolder = join(dir, "reference", "images");
  const sourcesPath = join(imagesFolder, "sources.json");
  if (!existsSync(sourcesPath)) {
    console.log("compare: reference/images/sources.json is missing");
    return 1;
  }
  const entries = JSON.parse(readFileSync(sourcesPath, "utf8")).images ?? [];
  const stillsFolder = join(dir, "shots", variant ?? baseName(loaded.machine));
  const firstStill = loaded.machine.film?.stills?.[0]?.[0];
  const rows = entries.map((entry) => rowHtml(entry, imagesFolder, stillFor(entry, stillsFolder, firstStill)));
  const out = join(dir, "shots", "reference-compare.png");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const sheetPath = join(dir, "shots", "reference-compare.html");
    writeFileSync(sheetPath, sheetHtml(rows));
    await page.goto(pathToFileURL(sheetPath).href, { waitUntil: "load" });
    await page.screenshot({ path: out, fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(`wrote ${out}: ${entries.length} reference images beside stills from ${stillsFolder}; open it and note what differs`);
  return 0;
}
