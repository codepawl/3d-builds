# Tessellation Morph

A field of interlocking tiles that scrambles and morphs from one tessellation into another, with a hover lens that shows a second tiling under the cursor and an optional pencil sketch style.

- Posts: https://x.com/anxuanng/status/2110693812289126831 (morph), https://x.com/anxuanng/status/2110695512219521349 (sketch style)
- Live page: https://claude.ai/artifact/5uNMGZUGykvekG3YiYovCj
- Made with: Claude Opus 5.5 in Claude Code, three.js r128 from cdnjs, Web Audio

## How it was made
1. Opus wrote the whole piece as one HTML file: the tile shapes, the morph between tilings, the hover lens and the controls.
2. The tile sounds are synthesized in the page with Web Audio (filtered noise flaps and rattles), so there are no audio files.
3. A sketch style was added as a post pass (`sketch style` section in `index.html`) and posted as the second clip.
4. The films were recorded frame by frame from a scripted run (`#record` in the page) with `record.mjs`.

## Run it
Open `src/index.html` in a browser. It loads three.js and Google Fonts from the network.

To record the film, set `CHROME_PATH` to a Chrome or chrome-headless-shell executable, then:
```
node src/record.mjs tessellation.mp4
node src/record.mjs tessellation-sketch.mp4 --sketch
```
Add `--start=<station clock>` or `--jump=<stations>` for another scramble run.

## Design
- Each tiling is a set of tile outlines on a lattice. A morph moves every tile from its place in one tiling to its place in the next, with a staggered start so the change sweeps across the field.
- The hover lens draws a second tiling (for example glazed hexagons over Escher squares) inside a circle around the cursor.
- The sketch pass redraws the frame with pencil hatching and doubled edges.
- One quiet control card: Scramble, Hover lens, Sketch, Sound.

## Assets and credits
- three.js r128 (MIT), loaded from cdnjs.
- Fonts: Gloock, Figtree and IBM Plex Mono from Google Fonts (OFL).
- No models, textures or recorded sounds.

## Prompts
See prompts.md.
