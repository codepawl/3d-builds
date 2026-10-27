// Measures pattern swimming: renders a film page, then the same frame with the whole drawing moved by half
// a pixel and turned by 0.4 degrees, and writes the crops so scripts/swim.py can compare each with the
// ideal (the first crop moved by exactly that motion). What remains after the motion is taken out is
// shimmer that the motion alone does not explain.
//   node scripts/swim.mjs <film.html> <out folder> [seconds] [x y width height]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser } from "../kit/browser.mjs";

const [file, out, seconds = "8", ...cropText] = process.argv.slice(2);
const crop = cropText.length === 4 ? cropText.map(Number) : [760, 140, 400, 800];
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// The pre-revision dither (one-pixel square ink cells, 2 px cell), put back in place for comparison.
function squareDither(cell) {
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const ink = [9, 6, 4, 2, 0];
  for (let level = 0; level < 5; level++) {
    const pattern = document.getElementById(`ma-dither-${level}`);
    pattern.setAttribute("width", cell * 4);
    pattern.setAttribute("height", cell * 4);
    let cells = `<rect class="ma-paper" width="${cell * 4}" height="${cell * 4}"/><g class="ma-ink">`;
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) if (bayer[row][column] < ink[level]) cells += `<rect x="${column * cell}" y="${row * cell}" width="${cell}" height="${cell}"/>`;
    pattern.innerHTML = `${cells}</g>`;
  }
}

async function shoot(name, transform) {
  await page.evaluate((value) => {
    document.querySelector('[data-dyn="lens"]').parentElement.style.transformOrigin = "960px 540px";
    document.querySelector('[data-dyn="lens"]').parentElement.style.transform = value;
  }, transform);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } });
}

for (const style of ["dither", "dither-square", "line"]) {
  await page.goto(`${pathToFileURL(file).href}?clock=manual&style=${style === "dither-square" ? "dither" : style}`);
  if (style === "dither-square") await page.evaluate(`(${squareDither})(2)`);
  await page.evaluate((time) => {
    const figure = window.__anatomy;
    figure.act("launch");
    for (let frame = 0; frame < time * 30; frame++) figure.advance(1 / 30);
  }, Number(seconds));
  await shoot(`${style}-still`, "none");
  await shoot(`${style}-shift`, "translate(0.5px, 0.25px)");
  await shoot(`${style}-turn`, "rotate(0.4deg)");
}
await browser.close();
console.log(`wrote crops to ${out}`);
