# Themes and render styles

Two independent layers. A **theme** is a token set (colours only). A **render style** decides how
surfaces are shaded and lines drawn. Every page carries all of both; `data-theme` and `data-style` on the
body pick one, so `?theme=patent&style=hatching` works on any built page and in `record`.

## Themes (`kit/themes.mjs`)

| Theme | Paper | Ink | Path colours (`--ma-flow`, `--ma-flow-2`) |
|---|---|---|---|
| `light` (default) | warm white | near black | blue, burnt orange |
| `dark` | near black | light grey | light blue, amber |
| `blueprint` | cyanotype blue | white | yellow, pink |
| `patent` | ivory paper | brown-black ink | red ink, blue ink |

Machine CSS uses the shared tokens, never raw colours, for anything that should follow the theme:
`--ma-flow`, `--ma-flow-2`, `--ma-heat`, `--ma-wire`, `--ma-glass`, `--ma-glass-fill`, `--ma-ink`, and
the kit's `--anatomy-*` tones. Material tints (wood, brass) may be scoped to `light` and `dark`; other
themes then fall back to their own tones, which is what a blueprint or patent drawing does anyway. Light
sources (a glowing filament, a spark) keep their real colours in every theme.

## Render styles (`kit/styles.mjs`)

| Style | Surfaces | Locked to |
|---|---|---|
| `line` (default) | the Anatomy look: four flat shade tones, fine outlines | — |
| `dither` | ordered 4 x 4 Bayer dither; ink cells 9, 6, 4, 2, 0 of 16 from the deepest side to the top | the part's surface |
| `halftone` | dots at 45 degrees, dot area following the shade | the part's surface |
| `hatching` | engraving hatch, line weight by shade, cross-hatched in the deepest shade, alternate directions on adjacent sides | the part's surface |
| `pixel` | the drawing point-sampled on a coarse grid (7 px blocks in films, 3 px on pages), ink thickened first so lines survive, posterised to 12 levels per channel, shade tones remapped to four clearly separate mixes | the screen grid |

**No swimming.** Pattern fills are SVG patterns in the user space of the part that uses them, so a
pattern rides with an assembly when it flies apart and stays still on a still part; the zoom frame
magnifies patterns with the drawing. Pixel works the other way: its grid never moves and the drawing moves
under it. Do not mix the two (for example a screen-fixed dither on moving parts), which is what makes
patterns crawl.

**Legibility.** Text (title, readout, steps, trace, legend, badges) is HTML above the SVG and is never
patterned or pixelated. Thin parts in pixel style survive because ink is thickened before sampling; if a
part still breaks up, draw it heavier in `figure.mjs` for that style rather than shrinking the block.

## Checking a look

`node cli.mjs verify <folder>` renders every theme and style pair (`shots/verify/look-*.png`) and fails on
any console error. `node cli.mjs style-sheet <folder>` makes the labelled 3 x 3 sheet
(`examples/style-sheet.png` for the example). Look at it: patterns readable at the film's size, nothing
swimming between two film frames, the zoom frame readable in every style.

## Measuring swimming (required for a moving machine)

Dither is drawn as round dots a little wider than the cell (3 px in films): a one-pixel square flickers
under sub-pixel motion and rotation, which reads as analog TV noise. `node scripts/swim.mjs <film.html>
<folder> [seconds]` then `uv run --no-project --with numpy --with pillow python scripts/swim.py <folder>`
moves the whole drawing half a pixel and turns it 0.4 degrees, and prints the residual left after the
ideal motion is taken out. Line style is the floor. Falcon 9, 2026-10-12: square dither 25.9 / 13.4, round
dots 18.6 / 9.9, line 16.2 / 6.9 grey levels. A pattern style more than about 3 levels over line is
swimming: enlarge the cell or lower the contrast. Effects (fire, steam, glow) are never patterned.
