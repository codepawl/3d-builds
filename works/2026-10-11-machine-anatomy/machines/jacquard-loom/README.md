# the Jacquard loom

An interactive isometric figure and a 30 second film of the Jacquard loom, built with Claude Opus 5.5.

- Post: https://x.com/anxuanng/status/2109285847057231992 (quote post of the post that introduced the Anatomy skill, by @wheresryan22: https://x.com/wheresryan22/status/2108948624004526516)
- Caption: "Opus 5.5 built the anatomy of the Jacquard loom with this skill. The 1804 machine that wove patterns from punched cards, the idea computers later borrowed. Punch a hole and the cloth changes."
- Page: `jacquard-loom-anatomy.html` opens in a browser with no server. Press the machine's controls, or take it apart with the on-page controls.

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

No research notes file was kept for this machine. Three reference pictures from Wikimedia Commons guided the drawing and are left out of the repo, because their licences were not checked: `Jacquard_2.jpg`, `Telaio_Jacquard_1849.jpg` and `A_Jacquard_loom_showing_information_punchcards,_National_Museum_of_Scotland.jpg`. Search each name on commons.wikimedia.org to get the picture and its licence.
Sound comes from `sound.mjs`. It synthesises every tap in code, so the repo has no sound sample.
This was the first machine of the series. Its film has the first shape: the loom weaves from 0.5 s, comes apart at 3 s and closes at 9 s (see `design/film-timeline.txt`). The later machines use the shape in `../../design/film-spec-v2.md`.
