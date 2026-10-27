// Render styles: how surfaces are shaded and lines drawn, independent of the colour theme (themes.mjs).
//   line      the Anatomy look: four flat shade tones and fine outlines
//   dither    ordered 4x4 Bayer dither, one density per shade level, drawn as round dots
//   halftone  dots whose size follows the shade
//   hatching  engraving hatch whose density follows the shade, cross-hatched in the deepest shade
//   pixel     the drawing sampled on a coarse screen grid and blown up with hard edges, in a small palette
// The three pattern styles use SVG patterns in user space of the part that is filled, so the pattern is
// locked to the machine's surfaces: it travels with a part that moves and never swims over a still one.
// Pixel works on the screen grid instead: the grid stays put and the drawing moves under it.

export const STYLE_NAMES = ["line", "dither", "halftone", "hatching", "pixel"];
export const DEFAULT_STYLE = "line";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
// Shade levels 0 to 3 are the kit's four side tones (0 the deepest), level 4 the top faces.
const LEVELS = [0, 1, 2, 3, 4];
const DITHER_INK = [9, 6, 4, 2, 0];
const COVERAGE = [0.46, 0.3, 0.19, 0.1, 0];
const HATCH_ANGLES = [45, 45, 135, 45, 0];
const PIXEL_MIX = [42, 29, 19, 10, 0];
const PIXEL_LEVELS = 12;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function paperRect(size) {
  return `<rect class="ma-paper" width="${size}" height="${size}"/>`;
}

function ditherPattern(level, cell) {
  const size = cell * 4;
  let ink = "";
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      // Round dots a little wider than the cell: under sub-pixel motion and rotation a dot's edge moves
      // smoothly, where a one-pixel square flickers on and off (measured in references/themes-and-styles.md).
      if (BAYER[row][column] < DITHER_INK[level]) ink += `<circle cx="${(column + 0.5) * cell}" cy="${(row + 0.5) * cell}" r="${round(cell * 0.56)}"/>`;
    }
  }
  return `<pattern id="ma-dither-${level}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${paperRect(size)}<g class="ma-ink">${ink}</g></pattern>`;
}

function halftonePattern(level, cell) {
  const size = cell * 4;
  const radius = size * Math.sqrt(COVERAGE[level] / Math.PI);
  const dot = radius > 0 ? `<circle class="ma-ink" cx="${size / 2}" cy="${size / 2}" r="${round(radius)}"/>` : "";
  return `<pattern id="ma-halftone-${level}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">${paperRect(size)}${dot}</pattern>`;
}

// One band of ink across a square tile, turned with the tile, so the hatch tiles without seams.
function hatchPattern(level, cell) {
  const size = cell * 3;
  const width = round(COVERAGE[level] * size * (level === 0 ? 0.62 : 1));
  const across = width > 0 ? `<rect class="ma-ink" y="${round((size - width) / 2)}" width="${size}" height="${width}"/>` : "";
  const down = level === 0 ? `<rect class="ma-ink" x="${round((size - width) / 2)}" width="${width}" height="${size}"/>` : "";
  return `<pattern id="ma-hatch-${level}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${HATCH_ANGLES[level]})">${paperRect(size)}${across}${down}</pattern>`;
}

function discreteTable() {
  const values = [];
  for (let index = 0; index < PIXEL_LEVELS; index++) values.push(round(index / (PIXEL_LEVELS - 1)));
  return values.join(" ");
}

// Point-samples the drawing once per block and spreads each sample over its block. Thin ink is first
// thickened (erode for dark ink on light paper, dilate for light ink on dark paper), so lines survive.
function pixelFilter(name, thicken, { width, height, block, inkRadius }) {
  const middle = (block - 1) / 2;
  const table = discreteTable();
  return `<filter id="${name}" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feMorphology in="SourceGraphic" operator="${thicken}" radius="${inkRadius}" result="inked"/><feFlood x="${middle}" y="${middle}" width="1" height="1" flood-color="#000"/><feComposite width="${block}" height="${block}"/><feTile result="grid"/><feComposite in="inked" in2="grid" operator="in"/><feMorphology operator="dilate" radius="${middle}"/><feComponentTransfer><feFuncR type="discrete" tableValues="${table}"/><feFuncG type="discrete" tableValues="${table}"/><feFuncB type="discrete" tableValues="${table}"/></feComponentTransfer></filter>`;
}

// The <defs> every page carries, so the style can switch at run time with `data-style` on the body.
// `cell` is the dither cell in user units; `block` the pixel block (odd, so a block centres on a sample).
export function styleDefs({ width, height, cell = 2, block = 7 }) {
  const oddBlock = block % 2 === 1 ? block : block + 1;
  const inkRadius = Math.max(1, Math.floor(oddBlock / 3));
  const patterns = LEVELS.map((level) => ditherPattern(level, cell) + halftonePattern(level, cell * 1.5) + hatchPattern(level, cell * 1.5)).join("");
  const filters = pixelFilter("ma-pixel-dark-ink", "erode", { width, height, block: oddBlock, inkRadius }) + pixelFilter("ma-pixel-light-ink", "dilate", { width, height, block: oddBlock, inkRadius });
  return `<defs>${patterns}${filters}</defs>`;
}

function shadeRules(style, prefix) {
  const rules = [];
  for (const level of [0, 1, 2, 3]) rules.push(`.iso[data-style="${style}"] .iso-shade[data-shade="${level}"]{fill:url(#${prefix}-${level})}`);
  rules.push(`.iso[data-style="${style}"] .iso-top,.iso[data-style="${style}"] .iso-solid[data-lit]>.iso-top{fill:url(#${prefix}-4)}`);
  rules.push(`.iso[data-style="${style}"] .iso-solid[data-lit]>.iso-shade{fill:url(#${prefix}-3)}`);
  rules.push(`.iso[data-style="${style}"] .iso-solid[data-seamless]>.iso-shade,.iso[data-style="${style}"] .iso-solid[data-seamless]>.iso-top{stroke:none}`);
  return rules.join("\n");
}

function pixelRules() {
  const mixes = PIXEL_MIX.map((share, level) => `--ma-pixel-${level}:color-mix(in srgb,var(--ma-ink) ${share}%,var(--anatomy-card))`).join(";");
  const shades = [0, 1, 2, 3].map((level) => `--anatomy-shade-${level}:var(--ma-pixel-${level})`).join(";");
  return [
    `.iso[data-style="pixel"]{${mixes}}`,
    `.iso[data-style="pixel"] [data-dyn="pixel-root"],.iso[data-style="pixel"] [data-dyn="pixel-root"] *{${shades};--anatomy-top:var(--ma-pixel-4);--anatomy-lit-top:var(--ma-pixel-4);--anatomy-lit-shade:var(--ma-pixel-3)}`,
    `.iso[data-style="pixel"] [data-dyn="pixel-root"]{filter:url(#ma-pixel-dark-ink)}`,
    `.iso[data-style="pixel"][data-theme="dark"] [data-dyn="pixel-root"],.iso[data-style="pixel"][data-theme="blueprint"] [data-dyn="pixel-root"]{filter:url(#ma-pixel-light-ink)}`,
    `.iso[data-style="pixel"] .ma-pixel-backing{fill:var(--anatomy-card)}`,
  ].join("\n");
}

export function styleCss() {
  return [
    `.ma-paper{fill:var(--anatomy-card)}.ma-ink{fill:var(--ma-ink)}`,
    `.ma-pixel-backing{fill:none}`,
    shadeRules("dither", "ma-dither"),
    shadeRules("halftone", "ma-halftone"),
    shadeRules("hatching", "ma-hatch"),
    pixelRules(),
  ].join("\n");
}

// The backing rectangle gives the pixel filter an opaque canvas to sample; it is invisible otherwise.
export function pixelRoot(width, height, body) {
  return `<g data-dyn="pixel-root"><rect class="ma-pixel-backing" width="${width}" height="${height}"/>${body}</g>`;
}
