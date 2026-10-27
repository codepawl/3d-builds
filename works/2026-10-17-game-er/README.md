# Bayflow: a live hospital emergency department you can play like a strategy game

A live 3D patient-flow view of three invented hospitals, with ambulances, a helipad, triage, resus bays, cubicles, imaging and a lab.

- Post: https://x.com/anxuanng/status/2111543476123042185
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber 9.8.1 and drei 10.7.9, Vite 8, Blender 5.2, Playwright and ffmpeg for the film

## How it was made
1. The subject is one of a series: an operations app on a new subject, built like the airport ramp. `prompts.md` has the only matching message from An and the plan file.
2. The plan is `design/TOPIC-er.md`: subject, sites, world, data, KPIs and the bottom timeline.
3. Reference step: the agent fetched reference images from Wikimedia Commons and US government sites (licences checked) and wrote a reference sheet per asset in `src/blender/refs`. The images were never shown in the app.
4. Pass 1 (24 minutes): the agent modelled the asset pack procedurally in Blender and exported GLB files.
5. Pass 2 (42 minutes): the agent built the app on those files with a seeded simulation, a dashboard, Playwright screenshots, an fps check and the 30 s film. The film has no sound.
6. Honest note: the original task message for this agent was not kept, so `prompts.md` cannot show it. The notes give run times only, not the number of fix rounds.

## Run it
Run these commands from this folder:

```sh
cd src/app
npm ci
npm run dev
```

Open http://localhost:5430. Node 20 or later is needed. The GLB files are already in `src/app/public/assets`, so you do not need Blender to run the app.

Capture scripts: `tools/closeups.mjs`, `tools/extract_geometry.mjs`, `tools/film.mjs`, `tools/forecast.mjs`, `tools/shoot.mjs`, `tools/simcheck.mjs`. They import `playwright` and need `ffmpeg` on PATH. Install Playwright with `npm i --no-save playwright` and `npx playwright install chromium`. Start the dev server, then run for example `node tools/film.mjs`. The film goes to `shots/`. The scripts replace `requestAnimationFrame`, `performance.now` and `Date`, so the film does not depend on machine speed.

To rebuild the models you need Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. Edit `src/blender/run.ps1` for another path.

```sh
pwsh src/blender/run.ps1 src/blender/build_all.py
```

## Design
- Sites are Marrow Point General (level 1 trauma), Ashby Vale Community and Little Harbour Children's, in the invented Linden Vale Health network. `design/TOPIC-er.md` is the plan.
- The app shows patient flow and capacity only. It makes no clinical decisions.
- Each hospital has its own seeded simulation (`src/sim/er.js`). `tools/simcheck.mjs` checks it and `tools/forecast.mjs` tests the forecast numbers.
- `ASSETS.md` lists a known simplification: the X-ray tube stand is the floor-mounted type, because a ceiling-rail stand would float in the model.
- Look and UI rules came from the brief: a clean isometric world in a light, cool palette with one strong brand colour, pins and selection rings, a dashboard with KPI cards, a detail card, a bottom timeline and tabbed lists, no eyebrow labels, no divider lines between rows and no close button on side panels.
- Plan and brief files are in `design/`. Asset tables are in `src/blender/ASSETS.md`.

This game shares most of its code with the other game folders in this repo (the live-X-as-a-strategy-game series). The stack, the file layout (`sim`, `store`, `scene`, `ui`), the dashboard design and the capture scripts follow one pattern. The world, the simulation and the Blender models are written for each subject. Each folder is complete on its own, so the shared code is copied, not factored out.

## Assets and credits
- 3D models: all original, modelled procedurally by the Python scripts in `src/blender` and exported as GLB. Shipped in `src/app/public/assets`: `beds.glb` (0.9 MB), `building.glb` (0.8 MB), `furniture.glb` (1.7 MB), `helicopter.glb` (0.7 MB), `imaging.glb` (0.5 MB), `people.glb` (1.1 MB), `vehicles.glb` (2.1 MB).
- Textures: none downloaded. The Blender scripts bake or draw any texture.
- Hospitals and health network are invented. Fonts are system UI fonts and are not shipped.
- Sound and music: none. The films have no audio.
- Inspiration: a public video of a 3D warehouse app that looks like a game (https://www.youtube.com/watch?v=Cv5RSFlfPSM). Its name, logo, text and layout were not copied. The video is not included.
- Three.js, React, React Three Fiber, drei, postprocessing and Vite are MIT licensed and come from npm. `npm ci` installs them. Blender is GPL and is not included.
- Reference photos (for measurement only, not copied here, not shipped in the app): 20 to 40 images from Wikimedia Commons and US government sites. `src/blender/refs/manifest.json` lists each image with its page URL, artist and licence (CC0, public domain, CC BY or CC BY-SA). `fetch_refs.mjs` downloads them again. The Wikipedia text extracts that the agent used for dimensions are left out. The reference sheets cite the article URLs.

## Prompts
See prompts.md.
