# Tideline: a live rocket launch site you can play like a strategy game

A live 3D launch complex on an invented coast, drawn in a point-cloud survey look. It has a catch tower, a booster and ship, a tank farm and transporters.

- Post: https://x.com/anxuanng/status/2111456240631234859
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber 9.8.1 and drei 10.7.9, Vite 8, Blender 5.2, Playwright and ffmpeg for the film

## How it was made
1. The subject is one of a series: an operations app on a new subject, built like the airport ramp. `prompts.md` has the only matching message from An and the plan file.
2. The plan is `design/TOPIC-launchsite.md`: subject, sites, world, data, KPIs and the bottom timeline.
3. Reference step: the agent fetched reference images from Wikimedia Commons and US government sites (licences checked) and wrote a reference sheet per asset in `src/blender/refs`. The images were never shown in the app.
4. Pass 1 (19 minutes): the agent modelled the asset pack procedurally in Blender and exported GLB files.
5. Pass 2 (41 minutes): the agent built the app on those files with a seeded simulation, a dashboard, Playwright screenshots, an fps check and the 30 s film. The film has no sound.
6. Honest note: the original task message for this agent was not kept, so `prompts.md` cannot show it. The notes give run times only, not the number of fix rounds.

## Run it
Run these commands from this folder:

```sh
cd src/app
npm ci
npm run dev
```

Open http://localhost:5426. Node 20 or later is needed. The GLB files are already in `src/app/public/assets`, so you do not need Blender to run the app.

Capture scripts: `tools/film.mjs`, `tools/flight.mjs`, `tools/meshinfo.mjs`, `tools/shoot.mjs`. They import `playwright` and need `ffmpeg` on PATH. Install Playwright with `npm i --no-save playwright` and `npx playwright install chromium`. Start the dev server, then run for example `node tools/film.mjs`. The film goes to `shots/`. The scripts replace `requestAnimationFrame`, `performance.now` and `Date`, so the film does not depend on machine speed.

To rebuild the models you need Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. Edit `src/blender/run.ps1` for another path.

```sh
pwsh src/blender/run.ps1 src/blender/build_all.py
```

## Design
- Sites are three pads and a build yard at Saltgrass Point. `design/TOPIC-launchsite.md` is the plan. The company is Tideline, the boosters are Kestrel and the ships are Heron.
- The terrain is a procedural heightmap of a flat coast with a causeway highway (`src/terrain.js`). No elevation data is downloaded.
- The bottom timeline follows one launch countdown, from rollout to the tower catch. Range status has road closure, airspace, marine and weather go or no-go.
- Before modelling, the agent wrote a reference sheet per asset in `src/blender/refs/*.md`. Each sheet gives real dimensions with sources, proportions and parts, and marks which values are estimates from photos.
- Look and UI rules came from the brief: a clean isometric world in a light, cool palette with one strong brand colour, pins and selection rings, a dashboard with KPI cards, a detail card, a bottom timeline and tabbed lists, no eyebrow labels, no divider lines between rows and no close button on side panels.
- Plan and brief files are in `design/`. Asset tables are in `src/blender/ASSETS.md`.

This game shares most of its code with the other game folders in this repo (the live-X-as-a-strategy-game series). The stack, the file layout (`sim`, `store`, `scene`, `ui`), the dashboard design and the capture scripts follow one pattern. The world, the simulation and the Blender models are written for each subject. Each folder is complete on its own, so the shared code is copied, not factored out.

## Assets and credits
- 3D models: all original, modelled procedurally by the Python scripts in `src/blender` and exported as GLB. Shipped in `src/app/public/assets`: `marine.glb` (0.3 MB), `pad.glb` (2.6 MB), `props.glb` (0.4 MB), `rocket.glb` (4.6 MB), `tanks.glb` (1.3 MB), `vehicles.glb` (6.5 MB), `yard.glb` (1.8 MB).
- Textures: none downloaded. The Blender scripts bake or draw any texture.
- Company, vehicles and site are invented. Fonts are system UI fonts and are not shipped.
- Sound and music: none. The films have no audio.
- Inspiration: a public video of a 3D warehouse app that looks like a game (https://www.youtube.com/watch?v=Cv5RSFlfPSM). Its name, logo, text and layout were not copied. The video is not included.
- Three.js, React, React Three Fiber, drei, postprocessing and Vite are MIT licensed and come from npm. `npm ci` installs them. Blender is GPL and is not included.
- Reference photos (for measurement only, not copied here, not shipped in the app): 20 to 40 images from Wikimedia Commons and US government sites. `src/blender/refs/manifest.json` lists each image with its page URL, artist and licence (CC0, public domain, CC BY or CC BY-SA). `fetch_refs.mjs` downloads them again. The Wikipedia text extracts that the agent used for dimensions are left out. The reference sheets cite the article URLs.

## Prompts
See prompts.md.
