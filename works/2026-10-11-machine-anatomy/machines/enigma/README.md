# the Enigma machine

An interactive isometric figure and a 30 second film of the Enigma machine, built with Claude Opus 5.5.

- Post: https://x.com/anxuanng/status/2109315922402095199 (quote post of the post that introduced the Anatomy skill, by @wheresryan22: https://x.com/wheresryan22/status/2108948624004526516)
- Caption: "Opus 5.5 built the anatomy of the Enigma machine. The machine Germany used to hide its messages in World War II."
- Page: `enigma-anatomy.html` opens in a browser with no server. Press the machine's controls, or take it apart with the on-page controls.

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

`design/research-notes.md` lists the sources: Crypto Museum (Enigma I, wiring, how it works), Wikipedia (Enigma machine, Enigma rotor details) and Tony Sale's pages at codesandciphers.org.uk. It also lists what was verified and what was not.
Sound comes from `sound.mjs`. It synthesises every tap in code, so the repo has no sound sample.
The first build was too simple. An asked for more detail, and the second pass added the rotor internals, the plugboard jacks and cable plugs, and the stepping pawls. The model reproduces the published test vectors (`AAAAA` gives `BDZGO`). The film has the first shape, with the slow press of the letter G first.
