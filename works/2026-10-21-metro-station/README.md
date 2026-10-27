# A live metro with the station cut open

A metro network in 3D with trains, stations cut open to show the platforms, escalators, signals and a depot, driven by a seeded simulation.

- Post: https://x.com/anxuanng/status/2112965553858249122
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber, Blender 5.2

## How it was made
1. A topic and a toy isometric look (light cool palette, teal brand color, one stripe color per line) were chosen. The original first prompt was not kept (see prompts.md).
2. Pass 1 built the Blender asset pack: trains, track, tunnel, station module, viaducts, sheds, city and people. `design/ASSETS.md` lists every root and its size.
3. Pass 2 built the app. A plain data model drives both the 3D view and the dashboard.
4. Rounds of fixes followed. An reported texture glitches where blocks overlapped, so `src/tools/psd-check.mjs` and `psd-coplanar.mjs` look for coplanar faces. An also asked to check that train doors line up with platform doors.
5. The film was recorded in stages with `src/tools/stage-shots.mjs` and `film.mjs`. This took several rounds, not one shot.

## Run it
```
npm --prefix src install
npm --prefix src run dev        # http://127.0.0.1:5431
```
With the server running, `node src/tools/film.mjs` records the film. Encode with ffmpeg. To rebuild the models, run the scripts in `src/blender/` with Blender 5.2.

## Design
Look: light cool palette, teal brand color, a coral stripe for one line. Rail head top is z = 0, and the station module is 9.8 m so modules abut with no scaling. Recolor by material name: `LineStripe` per line, `FigureShirt` for crowd density. See `design/ASSETS.md`.

## Assets and credits
All models are procedural Blender scripts made for this project. No external model, texture or sound is used. Left out: rendered film files.

## Prompts
See prompts.md.
