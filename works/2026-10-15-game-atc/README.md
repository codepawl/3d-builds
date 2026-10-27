# Squawk: a live air traffic control center you can play like a strategy game

A live air traffic control console for the invented Ondra Bay airspace. It has three sectors, aircraft on real-looking routes, a drifting storm cell and separation rings.

- Post: https://x.com/anxuanng/status/2110801686923264126
- Part 2, Opus 5.5 vs Argon on the same brief (quote post): https://x.com/anxuanng/status/2112249972850917704
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber 9.8.1 and drei 10.7.9, Vite 8, Blender 5.2, Playwright and ffmpeg for the film

## How it was made
1. An asked for a post like the airport one about air traffic control, and for the method to become a reusable skill. Then the main session ran several subjects in parallel. `prompts.md` has the messages.
2. The plan is `design/TOPIC-atc.md`.
3. Pass 1 (34 minutes): a build agent got `design/PASS1-atc.md` and modelled the whole asset pack in Blender, one GLB per asset family, with contact-sheet previews and an `ASSETS.md`.
4. Pass 2 (36 minutes): the agent got `design/PASS2-atc.md` and built the app on those GLB files with a seeded simulation, a dashboard, screenshots and the film.
5. Film: 30 s, 1920x1080, 30 fps, virtual clock, real mouse input, ffmpeg H.264. It has no sound.
6. Battle: a second model, Argon (called Gemini 4 Argon in the posts), got the same brief plus the rule not to read the Opus folder (`design/ARGON-PASS1-atc.md`, `design/ARGON-PASS2-atc.md`). Its code is in `src/argon`.
7. Honest note: the notes record run times only. Opus took about 70 minutes for both passes. Argon took about 2 hours 20 minutes. Fix rounds were not counted.

## Run it
Run these commands from this folder:

```sh
cd src/app
npm ci
npm run dev
```

Open http://localhost:5424. Node 20 or later is needed. The GLB files are already in `src/app/public/assets`, so you do not need Blender to run the app.

Capture scripts: `tools/closeups.mjs`, `tools/film.mjs`, `tools/shoot.mjs`. They import `playwright` and need `ffmpeg` on PATH. Install Playwright with `npm i --no-save playwright` and `npx playwright install chromium`. Start the dev server, then run for example `node tools/film.mjs`. The film goes to `shots/`. The scripts replace `requestAnimationFrame`, `performance.now` and `Date`, so the film does not depend on machine speed.

To rebuild the models you need Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. Edit `src/blender/run.ps1` for another path.

```sh
pwsh src/blender/run.ps1 src/blender/aircraft.py
pwsh src/blender/run.ps1 src/blender/airport.py
pwsh src/blender/run.ps1 src/blender/birds.py
pwsh src/blender/run.ps1 src/blender/nav.py
pwsh src/blender/run.ps1 src/blender/world.py
```

The Argon version:

```sh
cd src/argon/app
npm install
npm run dev
```

Open http://localhost:5424. `verify_app.mjs` and `record_film.mjs` are its check and film scripts. They need Playwright and ffmpeg like the scripts above.

## Design
- Sites are control sectors: Ondra Approach, Ondra Tower (runways 27L and 27R) and Saltline Sector (en route, FL240 to FL400). `design/TOPIC-atc.md` is the plan.
- The radar picture has data tags that stack when they overlap, history trails, a drop line to the ground, range rings, airways painted on the terrain and a rotating sweep.
- Separation rings turn amber when a pair closes inside 2.4 times the sector minimum and red below the minimum. A storm cell drifts across and makes traffic reroute.
- The bottom timeline follows one arrival: handoff, descend, hold, approach, land, vacate. You can give an aircraft climb, descend and slow instructions from its card.
- Six invented airframes in five invented liveries, birds, towns, nature, nav fixes and weather come from the Blender scripts in `src/blender`. `ASSETS.md` has the node and pivot tables.
- Argon's version (SkyVigil, Port Solis Regional Airspace) is in `src/argon`. It has three sectors too, plus waypoint pylons, a three-tier holding stack and storm cells that force route deviations.
- Look and UI rules came from the brief: a clean isometric world in a light, cool palette with one strong brand colour, pins and selection rings, a dashboard with KPI cards, a detail card, a bottom timeline and tabbed lists, no eyebrow labels, no divider lines between rows and no close button on side panels.
- Plan and brief files are in `design/`. Asset tables are in `src/blender/ASSETS.md`.

This game shares most of its code with the other game folders in this repo (the live-X-as-a-strategy-game series). The stack, the file layout (`sim`, `store`, `scene`, `ui`), the dashboard design and the capture scripts follow one pattern. The world, the simulation and the Blender models are written for each subject. Each folder is complete on its own, so the shared code is copied, not factored out.

## Assets and credits
- 3D models: all original, modelled procedurally by the Python scripts in `src/blender` and exported as GLB. Shipped in `src/app/public/assets`: `aircraft.glb` (4.3 MB), `airport_buildings.glb` (1.8 MB), `airport_props.glb` (1.0 MB), `birds.glb` (0.2 MB), `nature.glb` (0.3 MB), `nav.glb` (0.5 MB), `town.glb` (0.9 MB), `weather.glb` (0.7 MB).
- Textures: none downloaded. The Blender scripts bake or draw any texture.
- Airport, airlines, callsigns, fixes and cities are invented. Fonts are system UI fonts and are not shipped.
- Sound and music: none. The films have no audio.
- Inspiration: a public video of a 3D warehouse app that looks like a game (https://www.youtube.com/watch?v=Cv5RSFlfPSM). Its name, logo, text and layout were not copied. The video is not included.
- Three.js, React, React Three Fiber, drei, postprocessing and Vite are MIT licensed and come from npm. `npm ci` installs them. Blender is GPL and is not included.
- Argon version: the models are original and built by its own Blender scripts in `src/argon/blender`.

## Prompts
See prompts.md.
