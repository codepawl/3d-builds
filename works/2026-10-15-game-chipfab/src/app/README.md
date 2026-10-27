# Waferline

A live operations app for an invented chip company (Northmere Semiconductor, Lakeport campus) that plays like a
strategy game: a 300 mm fab floor seen from above with the roof cut away, overhead hoist vehicles carrying wafer
pods between tool load ports, engineers and technicians in bunny suits walking the bays, the sub-fab utility level
open along the front edge, and a campus view with the support buildings and delivery trucks. Every model comes from
the Blender pack in `public/assets` (see `../blender/ASSETS.md`). All names, products, tools and numbers are made up.

## Run

```
npm ci
npm run dev        # http://localhost:5425
```

Stack (exact versions in `package.json`): Vite 8, React 19, three 0.186, @react-three/fiber 9, drei 10,
@react-three/postprocessing 3 (N8AO ambient occlusion, bloom, SMAA).

## How it works

- `src/data.js`: sites (Fab 1 Cedar, Fab 2 Larch under ramp-up, Lakeport campus), bays as rows of GLB variants,
  route stages, invented tool models and products.
- `src/geometry.json`: footprints and anchors (load ports, stocker roof ports, hoist pivots) read from the GLBs by
  `scripts/extract_geometry.py`, so the simulation knows where every port is without loading three.js.
- `src/sim.js`: a seeded simulation, one sim second per fab minute. Lots queue in bay stockers, an OHT vehicle drives
  its bay loop to the pickup, lowers its hoist (2.6 m to a load port), carries the pod to a free tool port, the tool
  processes the step, and the lot moves to the next stage (litho, etch, clean, deposition, implant, anneal, CMP,
  metrology) in the same bay or through the interbay system to another bay. Tools break down, a ticket opens, a
  technician walks the aisles and front corridor to the tool and repairs it. Trucks drive the campus ring road.
- `src/store.js`: shared state, entity lookup, camera commands (fly to, follow, site view).
- `src/scene/`: `FabWorld.jsx` (floors, walls, rails, instanced tools and stockers, moving tool parts, sub-fab),
  `Units.jsx` (vehicles with hoists, instanced pods, animated people, ring, pins, tag), `Campus.jsx`.
- `src/ui/Dashboard.jsx`: top bar (search, site switcher, live clock, tickets, user), KPI cards (wafer starts, line
  yield, cycle time, tool availability), the detail card for any clicked object, the route timeline of a hot lot,
  list tabs (lots, tools, transport, people, tickets; buildings and trucks on the campus) and camera buttons.

Click any tool, stocker, vehicle, pod or person to open its card; click a list row to fly there and follow it;
the locate button on the card follows a moving object; Esc or a click on empty floor closes the card; `/` focuses
search, Enter flies to the first match.

## Checks

- `node tools/shoot.mjs`: overview, selected tool, close-up, vehicle, Fab 2 and campus screenshots plus fps.
- `node tools/closeups.mjs`: close-ups of every tool family, stocker, OHT hoist, people, sub-fab, rail turn,
  campus buildings and a truck in `shots/closeups/`.
- `node tools/probe.mjs`: fps and draw calls with the shadow pass on and off.
- `node tools/film.mjs`: 900 frames on a virtual clock (requestAnimationFrame, performance.now and Date.now
  overridden), driven only by real mouse clicks, drags and wheel events with a drawn cursor; then encode
  `shots/frames` with ffmpeg (H.264, yuv420p, crf 18, faststart) to `shots/film.mp4` and a 6 Mbit/s copy
  `shots/film-web.mp4`.
