# Honking Seal

A plump procedural seal you can stretch with a mouse or finger. Each pull or change of direction plays the next note of a tune on a synthesized trumpet.

- Post: https://x.com/anxuanng/status/2108588612308926961
- Live page: https://honkingseal.codepawl.com/ (linked in a reply by An under the post)
- Made with: Astra in Codex (as the post says, "three.js and Codex"), three.js, and 67.js Renderer67 0.3.3 for the second renderer

## How it was made

1. The idea was a seal that plays a song when you squish it. The original prompt was not kept. The Codex session is not in the Claude Code transcripts, so `prompts.md` describes the request from the project notes.
2. The seal geometry, the deformation and the pointer math are procedural code in `src/seal-model.js`. No downloaded model is used.
3. The sound is synthesized in `src/audio.js`. There is no recording and no sample.
4. The page has two renderers. Three.js draws the first version. A local adapter lets 67.js draw the second.
5. The checks are a unit test for the note logic and three browser scripts: `smoke.mjs`, `checks.mjs` and `live-smoke.mjs`.

## Run it

The dev server and the build read three.js, gl-matrix and the 67.js engine from one folder where you installed them (`npm install three gl-matrix esbuild`, plus the 67.js engine sources in `src/`). Set `JS67_DIR` to that folder first, for example `export JS67_DIR=/path/to/67.js`. The page was made against 67.js 0.3.3. Then, from this folder:

```
node src/server.mjs
node --test src/interaction.test.mjs
node src/build.mjs
```

Open http://127.0.0.1:5178. The header shows the three.js renderer; the 67.js switch is marked "coming soon" in this copy (`?engine=67` is not wired to a link). `build.mjs` writes a static `dist/` folder. The browser scripts (`smoke.mjs`, `checks.mjs`) need Playwright (`npm install playwright`, and `npx playwright install chromium` or `CHROME_PATH` for your own Chrome) and the dev server running. Checked 2026-10-27: they still assume the old gesture (a note on the first upward pull), while the page now plays a note on the downward return, so their note assertions fail; the sound, layout and error checks pass. `live-smoke.mjs` compares against the deployed site and needs a built `dist/`.
Audio starts after the first interaction.

## Design

A pull stretches the seal and a spring returns it. Each stroke plays one note. Staying still for three seconds restarts the tune. Controls turn the trumpet and the sound on or off, and arrow keys and Space also squeeze.
`src/README.md` is the original project note. `poster.jpg` is a frame of the 67.js version.

## Assets and credits

The seal, the toon shading and the trumpet sound are generated in code. The font is Inter (`src/assets/inter.ttf`, SIL Open Font License, https://rsms.me/inter/).
The posted video used the song "Careless Whisper", which is copyrighted. This repo leaves out that melody and the other song that the page offered, "Smooth Operator". The page here plays only "Twinkle, Twinkle, Little Star" (public domain). Everything else in the note logic is unchanged, so you can add your own melody in `src/melody.js`.
Some browser checks may still expect the removed songs. They have not been re-run for this repo.

## Prompts
See prompts.md.
