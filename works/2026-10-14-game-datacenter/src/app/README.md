# Kelvin: data hall operations

A real-time 3D operations app for an AI data center campus, made to look like a strategy game. Three data halls on a made-up campus; racks with GPU trays that glow by temperature, hot and cold aisles, cable trays, cooling units, a chiller yard, a substation, a battery room, robot swap carts and technicians. All names and numbers are invented.

## Run

```
npm install
npm run dev        # http://localhost:5421
```

`npm run build` makes a production bundle in `dist/`.

## Use

- Drag to orbit, right-drag to pan, wheel to zoom. The buttons on the right zoom, turn and return to the whole hall.
- Click any rack, cart, technician, cooling unit, chiller, the substation or the battery room to open its card. Click empty ground or press Esc to close it.
- Click a row in Jobs, Alerts, Tickets or Fleet to select it and fly the camera there.
- Switch halls from the site switcher in the top bar. Press `/` to search.

## How it is built

- `src/world.js` builds a hall: layout, racks, jobs, equipment and units.
- `src/sim.js` advances it at a fixed 30 Hz step: loads and temperatures, incidents (a failing GPU tray, a worn fan bearing), tickets, dispatch and unit movement along aisles.
- `src/store.js` holds the active hall and the selection. The 3D view reads the model every frame; the dashboard re-renders four times a second.
- `src/scene/` is the React Three Fiber view: instanced racks and GPU trays (the tray glow bars and rack status strips take their colour from the model every frame), bloom on the trays, N8AO ambient occlusion, soft shadows, camera moves through drei `CameraControls`. `assets.jsx` loads the GLBs, draws repeated assets as one instanced mesh per part, and clones the ones that animate (fan rotors, cart wheels, lift and beacon, technician limbs).
- `blender/` holds the Blender Python scripts that model every asset procedurally (bevels, panel lines, vents, bolts, wheels with hubs, PBR materials, small baked textures in `blender/textures/`) and export `public/assets/hall.glb`, `cooling.glb`, `power.glb`, `units.glb` and `campus.glb`. Rebuild with `pwsh blender/run.ps1 [hall cooling power units campus]`: it waits for any other Blender, runs Blender 5.2 headless at below-normal priority and prints the export lines. `node scripts/inspect-glb.mjs` lists the nodes, triangle counts and sizes.
- `src/ui/` is the dashboard: top bar, KPI cards, detail card, training run timeline, tabbed lists, camera buttons.

## Screenshots and film

With the dev server running:

```
npm run shots      # shots/01-overview.png ... 05-third-site.png
npm run film       # shots/film.mp4, 30 s at 1920x1080, 30 fps (node scripts/film.mjs <url> film-blender.mp4 for another name)
node scripts/closeups.mjs   # shots/blender/closeup-*.png, one per main asset type
```

Both use Playwright from `playwright` and headless Chromium on the GPU. The film overrides `requestAnimationFrame`, `performance.now` and `Date` and advances them 1/30 s per captured frame, so it is smooth whatever the machine does. It drives the app only through real mouse input, and ffmpeg encodes at below-normal priority.
