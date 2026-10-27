# Opus 5.5 built the anatomy of a machine

Seven interactive isometric figures of machines that changed the world, each with a 30 second film. The machines are a loom, a cipher machine, a light bulb, a steam engine, a telegraph, a transistor and a rocket.

- Posts: the table below. Six are quote posts of the post that introduced the Anatomy skill, https://x.com/wheresryan22/status/2108948624004526516 by @wheresryan22. That post is the inspiration for the series. None of its media is in this repo.
- Live page: none. Each machine page is one HTML file in `machines/<machine>/`.
- Made with: Claude Opus 5.5 in Claude Code and the Anatomy skill (https://skills.wheresryan.sh/anatomy, source https://github.com/wheresryan22/anatomy, MIT). A shared engine in `src/` grew out of it. The code is plain SVG and JavaScript, with no three.js. The recorder needs Node 20 or newer, ffmpeg and Chrome.

| Machine | Post | Date | Folder |
| --- | --- | --- | --- |
| Jacquard loom | https://x.com/anxuanng/status/2109285847057231992 | 2026-10-11 | `machines/jacquard-loom/` |
| Enigma machine | https://x.com/anxuanng/status/2109315922402095199 | 2026-10-11 | `machines/enigma/` |
| Edison's light bulb | https://x.com/anxuanng/status/2109372974080119272 | 2026-10-11 | `machines/edison-light-bulb/` |
| James Watt's steam engine | https://x.com/anxuanng/status/2109388572763828385 | 2026-10-11 | `machines/watt-steam-engine/` |
| Morse telegraph | https://x.com/anxuanng/status/2109403670270161369 | 2026-10-11 | `machines/morse-telegraph/` |
| The first transistor | https://x.com/anxuanng/status/2109418771379048802 | 2026-10-11 | `machines/first-transistor/` |
| SpaceX Falcon 9 | https://x.com/anxuanng/status/2109691075661381696 | 2026-10-12 | `machines/falcon-9/` |

## How it was made

1. An saw the Anatomy skill and asked for a video and a post with it. The first machine was the Jacquard loom. The messages are in `prompts.md`.
2. Each machine started with research. The agent read sources such as patents, museum pages and encyclopedias, wrote notes, and only then wrote the model. The notes are in `machines/<machine>/design/`. The Jacquard loom has none.
3. Each machine has a pure model with tests. It also has a drawing made of isometric parts, moving parts, and a page that comes apart.
4. A recorder plays the page frame by frame at 1920 by 1080 and 30 frames a second. A script synthesises the sound from the event list. The sound is quiet taps with no tones, after An rejected an earlier mix as harsh and toy-like.
5. The Enigma needed a second pass because An found it too simple. After An's film notes, the next four machines used one film shape (`design/film-spec-v2.md`). The machine works from the first frame. One zoom frame grows out of a source rectangle. Then come a slow run, normal running, a take-apart and a rebuild. The Jacquard and Enigma films keep the older shape.
6. The Falcon 9 tested a new shared engine built from the earlier pieces. It took several rounds of fixes: a full launch pad, flame, collisions, turn rates and parts that never moved. Each fix became a rule in the engine.
7. Loudness and peak of the sound were measured. Nobody listened to it in the checks.

## Run it

1. Run `npm install` in this folder to install Playwright for the recorder.
2. Open any `machines/<machine>/<machine>-anatomy.html` in a browser.
3. To rebuild one of the first six machines, run `node build.mjs` in its `src/` folder. The README of each machine lists the other scripts.
4. To rebuild the Falcon 9, run `node ../../../src/cli.mjs build .` in `machines/falcon-9/src/`. Its README explains the reference pictures.
5. To check the engine, run `node --test test/motion.test.mjs test/kit.test.mjs` in `src/`. All 21 tests pass.

## Design

- The look is a light isometric line drawing. It has a numbered legend, a readout, and a trace strip that says the chain of events in plain words. The pages also have a dark theme. The engine adds the blueprint and patent themes and the dither, halftone, hatching and pixel styles (`src/references/themes-and-styles.md`).
- Every sentence on a machine page ties to a sourced fact. The engine's lint fails the build on a text with no source (`src/references/truth-control.md`).
- The exploded view moves each assembly along its real removal axis. An audit replays it to check the paint order and that no part passes through another.
- `design/film-spec-v2.md` is the film shape An approved. `design/falcon9-intake.md` holds the answers to the engine's intake questions for the Falcon 9.

### The shared engine

`src/` holds two kits.

- The shared kit: `src/kit/`, `src/cli.mjs`, `src/references/` and `src/test/`. It has the page builder, runtime, themes, render styles, motion helpers, exploded view, truth lint, film recorder and sound. A new machine writes only its model, layout, drawing, live hooks and facts. `src/SKILL.md` is the skill text that an agent follows. The agent asks the intake questions once, researches and writes the facts, builds the machine folder, then runs lint, test, build, audit, verify and record.
- The Anatomy kit: `src/anatomy-kit/`, copied from Anatomy by Ryan (MIT). The first six machines import its isometric drawing helpers. The shared kit keeps its own copy of two of these files in `src/kit/vendor/`.

The engine's own Edison example and its showreel are not copied here. The `new` command and the parts of `src/SKILL.md` that point to `examples/` have nothing to copy from. Use `machines/falcon-9/src/` as the worked example.

## Assets and credits

- Anatomy by Ryan, https://github.com/wheresryan22/anatomy, MIT. It gave the drawing kit and the idea. Licence texts: `src/anatomy-kit/LICENSE` and `src/THIRD_PARTY_NOTICES.md`.
- The shared engine is MIT (`src/LICENSE`).
- Sources of facts, per machine: `machines/<machine>/design/research-notes.md`. For the Falcon 9, also `machines/falcon-9/src/facts.json`.
- Reference pictures are left out because their licences were not checked. Each machine README gives their names and sources.
- Sound is synthesised in code. The repo has no sample, music or font file.
- Left out: videos (`*.mp4`), frame dumps and the dark and film pages. Rebuild the pages with `node build.mjs --dark` and `--film`. The showreel with music that was tried for the Falcon 9 is also left out.

## Prompts

See `prompts.md`.
