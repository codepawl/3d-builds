# the first transistor

An interactive isometric figure and a 30 second film of the first transistor, built with Claude Opus 5.5.

- Post: https://x.com/anxuanng/status/2109418771379048802 (quote post of the post that introduced the Anatomy skill, by @wheresryan22: https://x.com/wheresryan22/status/2108948624004526516)
- Caption: "Opus 5.5 built the anatomy of the first transistor. A tiny current controls a bigger one. Every chip today is billions of these."
- Page: `first-transistor-anatomy.html` opens in a browser with no server. Press the machine's controls, or take it apart with the on-page controls.

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

`design/research-notes.md` lists the sources: the Computer History Museum page on the point-contact transistor, Wikipedia (Point-contact transistor, History of the transistor), PBS "Transistorized!" and the Nobel Prize 1956 summary. The Nokia Bell Labs page could not be reached.
Sound comes from `sound.mjs`. It synthesises every tap in code, so the repo has no sound sample.
The figure is the 1947 point-contact transistor. An first took the transistor for a light bulb, which led to the separate Edison piece. The film follows `../../design/film-spec-v2.md`.
