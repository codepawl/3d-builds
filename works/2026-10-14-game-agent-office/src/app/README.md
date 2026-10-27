# Orglet Office

A live, game-like 3D view of the orglets (the AI workers in [Orglet](https://github.com/codepawl/orglet)) at work.
Each space is a small isometric office. Requests land at the lead desk, the lead plans them and hands out
task cards, and orglets carry the cards to the research corner or the code room. When an orglet hits an
action that sends, pays or deletes, it waits at an approval station. Finished work goes to the review room.

The data is made up. The concepts all come from Orglet's docs: orglets with a role and a runtime, spaces,
channels, a lead that plans and splits work, tools (browser, a granted folder edited in a private copy,
MCP servers, desktop apps), held actions answered with Allow once, Always this tool or Refuse, Auto mode
for low-risk actions, routines, token use and spending caps.

## Run

```sh
npm install
npm run dev        # http://localhost:5422
```

Node 20 or later. Versions are pinned in `package.json`.

## Use

- Click an orglet, a room floor, or a row in the lists to open its card. Rows and search results move the camera to the item.
- Drag to orbit, scroll to zoom. The buttons on the right zoom, rotate and return to the whole space.
- Use the space switcher in the top bar to change spaces. Each space has its own layout, orglets and work.
- When a held action is waiting, the orglet's card shows Allow once, Always this tool and Refuse.
- Ctrl K focuses search.

## Code

- `src/world.js`: the data model (spaces, rooms, orglets, tasks, approvals).
- `src/simulation.js`: advances the model in real time (walking, working, held actions, reports).
- `src/store.js`: holds the model and refreshes the dashboard a few times a second.
- `src/Scene.jsx`: lays out the 3D office. Furniture, wall modules, floor tiles and trees are drawn instanced per asset; kiosks, the server rack, the inbox tray and the routines board are cloned because they animate.
- `src/Character.jsx`: poses each orglet (named pivots `Body`, `LegL`, `LegR`, `ArmL`, `ArmR`, `Card`) and tints it.
- `src/assets.jsx`: loads the GLBs, instancing and cloning helpers.
- `blender/build_office.py`, `blender/common.py`: model every asset procedurally in Blender and export `public/assets/{furniture,room,nature,orglet}.glb`. Materials named `Tint_*` are white in the file and take a colour in the app.
- `src/App.jsx`: the dashboard.

## Rebuild the assets

```powershell
pwsh blender/run.ps1 blender/build_office.py   # waits for any other Blender, runs headless at below-normal priority
```

Needs Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.

## Screenshots and film

With the dev server running:

```sh
node scripts/screenshots.mjs   # shots/blender/01-overview.png ... 10-plants-trees.png, prints fps
node scripts/film.mjs          # shots/film-blender.mp4, 30 s at 1920x1080 and 30 fps on a virtual clock
```

Both scripts use the Playwright install at `playwright`
(see `scripts/browser.mjs`) and need `ffmpeg` on PATH for the film.
