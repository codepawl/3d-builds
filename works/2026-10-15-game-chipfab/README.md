# Waferline: a live chip fab you can play like a strategy game

A live 300 mm chip fab for the invented Northmere Semiconductor. Overhead hoist vehicles carry wafer pods between tools while people in bunny suits walk the bays.

- Post: https://x.com/anxuanng/status/2110816730163605912
- Opus 5.5 vs Argon on the same brief: https://x.com/anxuanng/status/2112583451958538598
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber 9.8.1 and drei 10.7.9, Vite 8, Blender 5.2, Playwright and ffmpeg for the film

## How it was made
1. An asked for a post like the airport one about air traffic control, and for the method to become a reusable skill. Then the main session ran several subjects in parallel. `prompts.md` has the messages.
2. The plan is `design/TOPIC-chipfab.md`.
3. Pass 1 (33 minutes): a build agent got `design/PASS1-chipfab.md` and modelled the whole asset pack in Blender, one GLB per asset family, with contact-sheet previews and an `ASSETS.md`.
4. Pass 2 (37 minutes): the agent got `design/PASS2-chipfab.md` and built the app on those GLB files with a seeded simulation, a dashboard, screenshots and the film.
5. Film: 30 s, 1920x1080, 30 fps, virtual clock, real mouse input, ffmpeg H.264. It has no sound.
6. Battle: a second model, Argon (called Gemini 4 Argon in the posts), got the same brief plus the rule not to read the Opus folder (`design/ARGON-PASS1-chipfab.md`, `design/ARGON-PASS2-chipfab.md`). Its code is in `src/argon`.
7. Honest note: the notes record run times only. Opus took about 70 minutes for both passes. Argon took about 85 minutes. Fix rounds were not counted.

## Run it
Run these commands from this folder:

```sh
cd src/app
npm ci
npm run dev
```

Open http://localhost:5425. Node 20 or later is needed. The GLB files are already in `src/app/public/assets`, so you do not need Blender to run the app.

Capture scripts: `tools/closeups.mjs`, `tools/film.mjs`, `tools/probe.mjs`, `tools/shoot.mjs`. They import `playwright` and need `ffmpeg` on PATH. Install Playwright with `npm i --no-save playwright` and `npx playwright install chromium`. Start the dev server, then run for example `node tools/film.mjs`. The film goes to `shots/`. The scripts replace `requestAnimationFrame`, `performance.now` and `Date`, so the film does not depend on machine speed.

To rebuild the models you need Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. Edit `src/blender/run.ps1` for another path.

```sh
pwsh src/blender/run.ps1 src/blender/campus.py
pwsh src/blender/run.ps1 src/blender/cleanroom.py
pwsh src/blender/run.ps1 src/blender/people.py
pwsh src/blender/run.ps1 src/blender/tools.py
pwsh src/blender/run.ps1 src/blender/transport.py
```

The Argon version:

```sh
cd src/argon/app
npm install
npm run dev
```

Open http://localhost:5425. `verify_app.mjs` and `record_film.mjs` are its check and film scripts. They need Playwright and ffmpeg like the scripts above. Build its models first with `blender --background --factory-startup --python src/argon/blender/build_all.py`.

## Design
- Sites are Fab 1 Cedar, Fab 2 Larch (under ramp-up) and the Lakeport campus. `design/TOPIC-chipfab.md` is the plan.
- `src/sim.js` is a seeded simulation, one second per fab minute. A lot waits in a bay stocker, a hoist vehicle drives its bay loop, lowers 2.6 m to a load port and carries the pod to a free tool. The lot then moves through litho, etch, clean, deposition, implant, anneal, CMP and metrology.
- Tools break down, a ticket opens and a technician walks to the tool and repairs it. Trucks drive the campus ring road.
- `src/geometry.json` holds footprints and port anchors that `scripts/extract_geometry.py` reads from the GLBs, so the simulation knows where every port is.
- The bottom timeline follows a hot lot through its route.
- Argon's version is in `src/argon`. The posts describe it as a compact block with every tool labeled.
- Look and UI rules came from the brief: a clean isometric world in a light, cool palette with one strong brand colour, pins and selection rings, a dashboard with KPI cards, a detail card, a bottom timeline and tabbed lists, no eyebrow labels, no divider lines between rows and no close button on side panels.
- Plan and brief files are in `design/`. Asset tables are in `src/blender/ASSETS.md`.

This game shares most of its code with the other game folders in this repo (the live-X-as-a-strategy-game series). The stack, the file layout (`sim`, `store`, `scene`, `ui`), the dashboard design and the capture scripts follow one pattern. The world, the simulation and the Blender models are written for each subject. Each folder is complete on its own, so the shared code is copied, not factored out.

## Assets and credits
- 3D models: all original, modelled procedurally by the Python scripts in `src/blender` and exported as GLB. Shipped in `src/app/public/assets`: `campus.glb` (2.1 MB), `cleanroom.glb` (0.7 MB), `oht.glb` (1.7 MB), `people.glb` (0.4 MB), `stocker.glb` (1.0 MB), `subfab.glb` (0.6 MB), `tools.glb` (5.8 MB), `trucks.glb` (0.7 MB).
- Textures: none downloaded. The Blender scripts bake or draw any texture.
- Company, products and tools are invented. Fonts are system UI fonts and are not shipped.
- Sound and music: none. The films have no audio.
- Inspiration: a public video of a 3D warehouse app that looks like a game (https://www.youtube.com/watch?v=Cv5RSFlfPSM). Its name, logo, text and layout were not copied. The video is not included.
- Three.js, React, React Three Fiber, drei, postprocessing and Vite are MIT licensed and come from npm. `npm ci` installs them. Blender is GPL and is not included.
- Argon version: the models are original and built by its own Blender scripts in `src/argon/blender`. Its GLB files (51 MB) are left out for size. The Blender build recreates them.

## Prompts
See prompts.md.
