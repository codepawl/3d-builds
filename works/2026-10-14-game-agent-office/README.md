# Orglet Office: a live 3D office for AI workers

A small isometric office where AI workers carry task cards from desk to desk. Every model is built in Blender and runs live in three.js.

- Post: https://x.com/anxuanng/status/2110453070236922090
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber 9.8.1 and drei 10.7.9, Vite 8, Blender 5.2, Playwright and ffmpeg for the film

## How it was made
1. An asked the main session to copy the idea of a 3D warehouse app that looks like a game, on other subjects (reference video, not included). `prompts.md` has the messages.
2. The plan is `design/TOPIC-agents.md`: subject, sites, world, data, KPIs and the bottom timeline.
3. Pass 1 (31 minutes): a build agent got `design/BRIEF-COMMON.md` and the topic file. It built the app with models made from code primitives and checked it with Playwright screenshots at 1920x1080.
4. Pass 2 (24 minutes): the same folder got `design/BRIEF-BLENDER.md`. The agent rebuilt every model in Blender, exported GLB files and loaded them in three.js. It kept the simulation, dashboard, interactions and film shape.
5. Self-review: the agent took the overview, selected-object, second-site and close-up screenshots, looked at each one, fixed problems and measured the frame rate.
6. Film: a 30 s, 1920x1080, 30 fps recording with a virtual clock, driven only by real mouse input and encoded with ffmpeg. The post uses the pass 2 film. It has no sound.
7. Honest note: the project notes give the run times above but do not count fix rounds. Pass 1 and pass 2 were one agent run each.

## Run it
Run these commands from this folder:

```sh
cd src/app
npm ci
npm run dev
```

Open http://localhost:5422. Node 20 or later is needed. The GLB files are already in `src/app/public/assets`, so you do not need Blender to run the app.

Capture scripts: `scripts/browser.mjs`, `scripts/film.mjs`, `scripts/screenshots.mjs`. They import `playwright` and need `ffmpeg` on PATH. Install Playwright with `npm i --no-save playwright` and `npx playwright install chromium`. Start the dev server, then run for example `node scripts/film.mjs`. The film goes to `shots/`. The scripts replace `requestAnimationFrame`, `performance.now` and `Date`, so the film does not depend on machine speed.

To rebuild the models you need Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. Edit `src/blender/run.ps1` for another path.

```sh
pwsh src/blender/run.ps1 src/blender/build_office.py
```

## Design
- The subject comes from the docs of Orglet, CodePawl's desktop app for AI workers (dropped as a product on 2026-10-24). The plan told the agent to show only real concepts from those docs. `design/TOPIC-agents.md` lists the rooms, the data and the KPIs.
- The world is a set of spaces. Each space is a small office with a lead desk, a research corner, a code room, a review room and approval stations. The made-up workers walk between them carrying task cards.
- A held action (send, pay, delete) makes a worker wait at an approval station. The card then offers Allow once, Always this tool and Refuse.
- Characters have named pivots (`Body`, `LegL`, `LegR`, `ArmL`, `ArmR`, `Card`) that the app poses. Materials named `Tint_*` are white in the GLB and take a colour in the app.
- Camera: orbit, zoom, and a fly-to from any list row.
- Look and UI rules came from the brief: a clean isometric world in a light, cool palette with one strong brand colour, pins and selection rings, a dashboard with KPI cards, a detail card, a bottom timeline and tabbed lists, no eyebrow labels, no divider lines between rows and no close button on side panels.
- Plan and brief files are in `design/`. Asset tables are in `src/blender/ASSETS.md`.

This game shares most of its code with the other game folders in this repo (the live-X-as-a-strategy-game series). The stack, the file layout (`sim`, `store`, `scene`, `ui`), the dashboard design and the capture scripts follow one pattern. The world, the simulation and the Blender models are written for each subject. Each folder is complete on its own, so the shared code is copied, not factored out.

## Assets and credits
- 3D models: all original, modelled procedurally by the Python scripts in `src/blender` and exported as GLB. Shipped in `src/app/public/assets`: `furniture.glb` (2.4 MB), `nature.glb` (0.2 MB), `orglet.glb` (0.3 MB), `room.glb` (0.2 MB).
- Textures: none downloaded. The Blender scripts bake or draw any texture.
- Fonts: Inter Variable through the `@fontsource-variable/inter` package (SIL OFL 1.1). `npm ci` installs it and it is not copied here.
- Sound and music: none. The films have no audio.
- Inspiration: a public video of a 3D warehouse app that looks like a game (https://www.youtube.com/watch?v=Cv5RSFlfPSM). Its name, logo, text and layout were not copied. The video is not included.
- Three.js, React, React Three Fiber, drei, postprocessing and Vite are MIT licensed and come from npm. `npm ci` installs them. Blender is GPL and is not included.

## Prompts
See prompts.md.
