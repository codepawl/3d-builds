// The style sheet: the same frame of a machine in every render style in the light theme, plus dither and
// hatching in blueprint and patent, laid out as one labelled 3 x 3 image.
//   node cli.mjs style-sheet <folder> [--out examples/style-sheet.png]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, lowerPriority, watchProblems } from "./browser.mjs";
import { pageFileName } from "./build.mjs";
import { loadMachine } from "./page.mjs";

export const SHEET_TILES = [
  ["light", "line"],
  ["light", "dither"],
  ["light", "halftone"],
  ["light", "hatching"],
  ["light", "pixel"],
  ["blueprint", "dither"],
  ["blueprint", "hatching"],
  ["patent", "dither"],
  ["patent", "hatching"],
];
const SETTLE_SECONDS = 6;

async function shootTile(page, url, theme, style, file) {
  await page.goto(`${url}?clock=manual&theme=${theme}&style=${style}`);
  await page.evaluate((seconds) => {
    window.__anatomy.act("start");
    for (let step = 0; step < seconds * 60; step++) window.__anatomy.advance(1 / 60);
  }, SETTLE_SECONDS);
  await page.screenshot({ path: file });
}

function sheetHtml(tiles) {
  const cells = tiles.map(({ file, theme, style }) => `<figure><img src="${pathToFileURL(file).href}"><figcaption>${style} · ${theme}</figcaption></figure>`).join("");
  return `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e9e9e5;font:600 22px/1 ui-sans-serif,system-ui,sans-serif;color:#26262a}main{display:grid;grid-template-columns:repeat(3,640px);gap:0;width:1920px}figure{margin:0;display:flex;flex-direction:column-reverse}img{display:block;width:640px;height:360px}figcaption{padding:14px 16px 12px;background:#e9e9e5}</style><main>${cells}</main>`;
}

export async function styleSheetCommand(dir, { out } = {}) {
  lowerPriority();
  const { machine } = await loadMachine(dir);
  const url = pathToFileURL(join(dir, pageFileName(machine, { film: true, format: "16:9" }))).href;
  const folder = join(dir, "shots", "style-sheet");
  mkdirSync(folder, { recursive: true });
  const target = resolve(out ?? join(dir, "..", "style-sheet.png"));
  const problems = [];
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    watchProblems(page, problems);
    const tiles = [];
    for (const [theme, style] of SHEET_TILES) {
      const file = join(folder, `${style}-${theme}.png`);
      await shootTile(page, url, theme, style, file);
      tiles.push({ file, theme, style });
    }
    const sheetFile = join(folder, "sheet.html");
    writeFileSync(sheetFile, sheetHtml(tiles));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(pathToFileURL(sheetFile).href);
    await page.locator("main").screenshot({ path: target });
    await context.close();
  } finally {
    await browser.close();
  }
  console.log(problems.length ? `style sheet problems:\n${problems.join("\n")}` : `wrote ${target} · ${SHEET_TILES.length} tiles, full-size tiles in ${folder}`);
  return problems.length ? 1 : 0;
}
