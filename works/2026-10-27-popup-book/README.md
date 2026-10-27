# How Big Things Work, a pop-up book

A pop-up book for adults who want the real numbers. Pages fold up into 3D scenes with paper mechanisms: the Titanic, a power station, a cooling tower and the grid frequency.

- Post: https://x.com/anxuanng/status/2114939687693594624  (scheduled for 2026-10-27 22:30, id not final)
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js (vendored)

## How it was made
1. An asked for an interactive book that teaches, built with the skill (see prompts.md).
2. Facts came first. English Wikipedia extracts on pop-up books, the Titanic, the Rankine cycle, thermal power stations, cooling towers and utility frequency were saved and read. `design/facts.md` marks each fact as measured, derived, recalled or placement. The extracts are not included.
3. The first pass reused the Titanic cutaway plate code (`src/plate-src/`). `src/tools/capture-plate.mjs` renders the ship's side image that the book page uses as a texture.
4. Four patch scripts changed the page in rounds (`src/tools/patch1.mjs` to `patch4.mjs`). The second pass added the mechanisms: parallel-fold layers, box folds, V-folds, a recessed box, a pull-tab, a lift flap, a volvelle, a tunnel and lecterns.
5. The film was recorded with `src/tools/record-reel.mjs` and checked against the beats with `check-beats.mjs`. Sound is mixed by `src/sound/make_sound.py`.

## Run it
Two large images are left out. Rebuild the ship texture first (needs the Titanic plate page running, see `src/tools/capture-plate.mjs`), then:
```
uv run --no-project python -m http.server 8080 --directory src/web
```
Open http://localhost:8080/index.html. Three.js is vendored in `src/web/vendor/`.

## Design
Paper mechanisms drawn in 3D, each solved as linkages so no roof passes through a wall. Page text uses real pop-up terms. See `design/facts.md`.

## Assets and credits
- Facts: English Wikipedia (CC BY-SA 4.0): Pop-up book, Titanic, Rankine cycle, Thermal power station, Cooling tower, Utility frequency.
- Sound: CC0 recordings (Freesound and Versilian sample libraries), cut by `src/sound/make_sound.py`. The audio is not included.
- Left out: `src/web/tex/ship-raw.png` and `ship-side.png` (43 MB and 29 MB, regenerated from the plate), the research extracts, the film and stills.

## Prompts
See prompts.md.
