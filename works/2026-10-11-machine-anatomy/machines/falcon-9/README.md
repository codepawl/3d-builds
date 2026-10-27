# SpaceX Falcon 9

An interactive isometric figure and a 35 second film of one Falcon 9 flight, from the pad to a droneship landing, built on the shared kit in `../../src/`.

- Post: https://x.com/anxuanng/status/2109691075661381696 (a plain post, not a quote)
- Caption: "Opus 5.5 built the anatomy of SpaceX's Falcon 9, quite impressive result."
- Page: `falcon-9-anatomy.html` opens in a browser with no server.

## Files

- `poster.jpg`: one still from the film.
- `src/`: the machine folder that the engine reads.
  - `model.mjs` is the pure flight model.
  - `layout.mjs` and `figure.mjs` hold the sizes and the drawing.
  - `live.js` holds the moving parts.
  - `machine.mjs` holds the assemblies, texts, film story and sound voices.
  - `facts.json` holds the sourced facts.
  - `test-model.mjs` and `verify-machine.mjs` are the checks.
- `design/`: the research notes and the event list of the film.

## Run it

Run these from `src/`. Get the reference pictures first (see the credits below), or the lint step fails.

1. Run `node ../../../src/cli.mjs test .` to check the model. All 28 checks pass.
2. Run `node ../../../src/cli.mjs lint .` to tie every text to a fact and to check the reference pictures.
3. Run `node ../../../src/cli.mjs build .` to write the page.
4. Run `node ../../../src/cli.mjs audit .` to check the paint order of the exploded view.
5. Run `node ../../../src/cli.mjs record .` to record the film. Add `--style dither` for the dither look. The posted film used the default line style.

Recording needs Chrome, ffmpeg and Playwright. Run `npm install` in the series folder first.

## Sources and credits

`design/research-notes.md` lists the sources: the SpaceX Falcon 9 page, the Falcon User's Guide, and Wikipedia pages on reusable launch development, drone ships, Falcon 9 and Merlin. Facts that the guide does not give are marked inferred in `src/facts.json`.

Seven reference photos guided the pad, the booster and the engine section. They come from SpaceX, NASA and the US Space Force. They are left out because their licences were not checked. `src/reference/images/sources.json` gives the Wikimedia Commons page of each one. Put the files that it names into `src/reference/images/` before you run the lint step.

The film sound is synthesised in code by the engine. A showreel with music was tried and dropped, and no music is in the repo.

## Notes

The first builds had no complete launch pad, an overlapping legend, a second stage that turned too fast and parts that never moved. Each round of fixes became a rule in the engine. The rules are to look at reference pictures before drawing, to check collisions, to limit turn rates, and to show every working part working. The film grew from 30 to 35 seconds so the flip and the landing burn get screen time.
