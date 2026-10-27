# Learn Arduino in 3D

An Uno R3 and a half-size breadboard in 3D at real size, six lessons with four steps each, a bench to build your own circuits, and a highlighted code line that shows what the board is doing now.

- Post: https://x.com/anxuanng/status/2113568077841588243  (a quote of another creator's idea, rebuilt with viz3d)
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1, Vite 8.3.4

## How it was made
1. An saw a post about a learning visualization (credit: dilumsanjaya on X) and asked for a version built on the skill (see prompts.md).
2. A fact file (`design/FACTS.md`) gathered board and part sizes from the Arduino docs, and lists what is simplified.
3. The first build had six lessons: Blink, Button, Fade, Potentiometer, Servo and Traffic light. Each step places one part on the real-size board.
4. An reviewed it and asked for changes: wires must not appear from nowhere, the current flow must be easier to read and off by default, and a build-your-own mode.
5. The second round carried parts from a tray into the exact holes, added the "Show current" toggle, and added lesson 7, a sandbox with a circuit check.
6. Screenshots (`src/tools/shoot.mjs`) and a 30 s film (`src/tools/film.mjs`) checked each step. This needed two rounds, not one shot.

## Run it
```
npm --prefix src install
npm --prefix src run dev        # http://127.0.0.1:5244
```
With the server running, `node src/tools/shoot.mjs` saves screenshots, and `node src/tools/film.mjs` records the film on a virtual clock.

## Design
Real-size coordinates are in `src/src/layout.js`, the 3D parts in `src/src/parts.jsx`, and the lesson text, cameras, code and simulation in `src/src/lessons.js`. The sandbox saves to local storage. `design/README.md` has the notes from both rounds. `design/FACTS.md` lists simplifications, for example the servo pulse range and the made-up bounce lengths.

## Assets and credits
- Board sizes and pin facts: Arduino documentation (docs.arduino.cc, Uno Rev3 page). See `design/FACTS.md`.
- Models: built in code from the dimensions above. The chip, USB and jack positions were read from photographs by eye. No external model, texture or sound is used.
- Left out: rendered film files.

## Prompts
See prompts.md.
