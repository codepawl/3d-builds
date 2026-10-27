# James Watt's steam engine

An interactive isometric figure and a 30 second film of James Watt's steam engine, built with Claude Opus 5.5.

- Post: https://x.com/anxuanng/status/2109388572763828385 (quote post of the post that introduced the Anatomy skill, by @wheresryan22: https://x.com/wheresryan22/status/2108948624004526516)
- Caption: "Opus 5.5 built the anatomy of James Watt's steam engine. The machine that powered the Industrial Revolution."
- Page: `watt-steam-engine-anatomy.html` opens in a browser with no server. Press the machine's controls, or take it apart with the on-page controls.

## Files

- `poster.jpg`: one still from the film.
- `src/`: the code. `model.mjs` is the model with no DOM, `layout.mjs` the size table and `build.mjs` the page builder.
  - `live.js`, `apart.js` and `explode.mjs` hold the moving parts.
  - `record.mjs` records the film and `sound.mjs` makes the sound.
  - `test-model.mjs` and `verify.mjs` are the checks.
- `design/`: research notes and the event list and timeline of the film that was posted.

## Run it

Run these from `src/`. The scripts import the vendored Anatomy kit from `../../../src/anatomy-kit/`.

1. `node test-model.mjs` runs the model checks.
2. `node build.mjs` writes the page. Add `--dark` for the dark theme or `--film` for the 1920 by 1080 film card.
3. `node record.mjs` plays the film card frame by frame and records the film. It needs Chrome, ffmpeg and Playwright (run `npm install` in the series folder first). Set `CHROME_PATH` if Chrome is not in its default place.

## Sources and credits

`design/research-notes.md` lists the sources: Wikipedia (Watt steam engine, parallel motion linkage, sun and planet gear, centrifugal governor, Lap Engine, Old Bess) and notes on Science Museum Group pages.
Sound comes from `sound.mjs`. It synthesises every tap in code, so the repo has no sound sample.
An chose the steam engine over a generic "Watt" machine. The research notes cover the parallel motion linkage, the sun and planet gear and the governor. The film follows `../../design/film-spec-v2.md`.
