# A live airport baggage system

An airport baggage handling system in 3D, from the check-in desk to the hold of the plane, with scanners, a tilt-tray sorter, chutes, tug trains and a belt loader.

- Post: https://x.com/anxuanng/status/2112964456745763191
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber, Blender 5.2

## How it was made
1. A topic and a toy isometric look were chosen. The original prompt was not kept as a file (see prompts.md).
2. Pass 1 built six Blender GLB packs: bags, conveyors, logistics, ramp, screening and sorter. `design/ASSETS.md` lists each node, its size and its clips. The other notes in `design/` describe the real equipment.
3. Pass 2 built the app with three sites: the sorter hall, check-in, and make-up and ramp.
4. A seeded simulation plans every bag analytically (path, scanner, tray, chute) at a fixed 1/60 s step.
5. The stage views were checked with screenshots (`src/check_stages.mjs`) and the film was recorded with `src/record_film.mjs`. Two scripted passes were needed, not one shot.

## Run it
```
npm --prefix src install
npm --prefix src run dev        # http://127.0.0.1:5434
```
Add `?start=58` to the address to start the simulation at second 58. With the server running, `node src/check_shots.mjs` saves screenshots and `node src/record_film.mjs` records frames. Encode with ffmpeg (`-crf 18 -pix_fmt yuv420p`). To rebuild the models, run `src/blender/gen_assets.py` and the build scripts with Blender 5.2.

## Design
The simulation routes the bags. It does not play a fixed animation path: each bag gets a planned path through the scanner, a tray and a chute. The sites are the sorter hall (CT, reject line, 46-tray sorter, 7 chutes), check-in (4 desks) and the ramp (carousels, containers, tug trains). See `design/README.md`.

## Assets and credits
All models are procedural Blender scripts made for this project. No external model, texture or sound is used. Left out: rendered film files.

## Prompts
See prompts.md.
