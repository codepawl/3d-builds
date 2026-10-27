# A live ship canal

A made-up ship canal in 3D, from the first lock gate to a container ship rising in its chamber, with towing locomotives, tugs and a control center view.

- Post: https://x.com/anxuanng/status/2112963271297024441
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber and N8AO, Blender 5.2

## How it was made
1. A topic and a look (toy isometric) were chosen for the skill. The original prompt was not kept as a file (see prompts.md).
2. Pass 1 built the asset pack in Blender: lock walls, miter gates, valves, ships, tugs and mules. `design/ASSETS.md` lists every part and clip.
3. Pass 2 built the app. Terrain, water, foam and mooring cables are made in the app, and a seeded simulation drives the lock.
4. The page was checked with screenshots at each stage of a lock cycle (`src/tools/stages-check.mjs`), and a 30 fps film was recorded with `src/tools/film.mjs`.
5. This came from two scripted passes, not one shot. Known gaps: ships are scaled 0.95 to fit the chamber, and the opening shows about 12 moving units.

## Run it
```
npm --prefix src install
npm --prefix src run dev        # http://127.0.0.1:5433
```
Film: with the dev server running, `node src/tools/film.mjs 900` records 900 frames. Encoding to MP4 needs ffmpeg. To rebuild the models, run the scripts in `src/blender/` with Blender 5.2.

## Design
The canal has a three-step lock flight, a single lock at lake level, and a control center camera preset. The simulation runs at a fixed 1/60 s step. A schedule per lane is computed once, and ships queue when the flight is busy. See `design/ASSETS.md` and the reference notes in `design/`.

## Assets and credits
All models are procedural Blender scripts made for this project. No external model, texture or sound is used. Left out: rendered film files.

## Prompts
See prompts.md.
