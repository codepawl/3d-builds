# Tideline: launch-site operations at Saltgrass Point

A live 3D operations app for a made-up launch complex on a flat subtropical coast. It looks like a strategy game and
is drawn in the point-cloud survey look. Every name, logo and number is invented: the company is Tideline, the
complex is Saltgrass Point, and the vehicles are Kestrel boosters and Heron ships.

## Run

```
npm install
npm run dev        # http://localhost:5426
```

The stack is Vite 8.3.4, React 19.3.0, three 0.186.1, @react-three/fiber 9.8.1, drei 10.7.9 and
@react-three/postprocessing 3.2.0. Every version is pinned exactly.

## What it shows

- **Four sites** in the site switcher: LC-1 Kittiwake (orbital pad with the catch tower), LC-2 Shearwater (pad under
  construction), TS-3 Petrel (suborbital test stand) and Halyard (the build yard 4 km inland). Switching sites swaps
  the whole world: its terrain, statics, movers and lists.
- **Terrain** is a procedural heightmap with no elevation download: beach, dunes, tidal flats, a lagoon and a highway
  on a causeway. It is drawn as about 100k instanced white dots, with a matte grey water plane, N8AO ambient occlusion,
  a tilt-shift blur, soft long shadows and no bloom.
- **Launch cycle on LC-1** (180 s loop, liftoff 8.5 s after load): rollout of the ship on a transporter, stacking by
  the tower arms, propellant load (farm levels fall and LOX tanks vent), a planned weather hold, terminal count,
  liftoff with exhaust, deluge and ground steam drawn as dots, stage separation, boostback, landing burn and the
  catch by the tower arms, then the set-down onto the mount. The mission clock runs 18 times faster after liftoff.
- **Things that move on their own**: cryo tankers, crew vans and pickups on the roads, the recovery vessel and the
  range boat with dot wakes, the camera mast heads tracking the vehicle, the checkpoint barrier lifting for vehicles,
  red obstruction lamps, the LC-2 crawler crane test-lifting tower module 6, TS-3 static fires every 45 s, and yard
  transporters carrying booster B-16 and ship S-33 with the bay doors opening for them.
- **Dashboard**: a top bar with the site switcher, search (Enter flies to the first match), a UTC clock, the range
  verdict, alerts and the user. KPI cards show the next launch or days to it, propellant loaded, stages ready and
  range go/no-go. A detail card opens for any clicked object, with live fields, a progress bar and a line chart.
  The countdown timeline runs along the bottom (rollout, stack, propellant load, terminal count, liftoff, boostback,
  tower catch). Tabbed lists sit at the bottom right (vehicles, tanks, tasks, range, events). There are zoom and
  camera buttons, and HUD furniture: a heading tape, a pitch ladder and range rings around the selection.
- **Controls**: left-drag orbits, right-drag pans, the wheel zooms. Click an object (or its list row) to select it;
  moving objects are followed. Esc or a click on empty ground closes the card.

## Code map

- `src/terrain.js`: the heightmap and the dot grid.
- `src/sites.js`: the site layouts.
- `src/sim.js`: the seeded simulation, which holds the launch pose, movers, particles and range.
- `src/store.js`: shared state and the read models for the dashboard.
- `src/scene.jsx`: the 3D view. Repeated statics are instanced, moving parts are driven by the sim, and invisible
  proxies handle picking.
- `src/ui.jsx`: the dashboard.
- `src/icons.jsx`: status icons, with a different shape for each state.

## Tools

- `node tools/shoot.mjs [names]`: verification screenshots and an fps probe, written to `shots/`.
- `node tools/flight.mjs`: stills of the launch cycle. It skips sim time, for checking only.
- `node tools/film.mjs`, then `pwsh tools/encode.ps1`: the 30 s film at `shots/film.mp4` (crf 18) and
  `shots/film-web.mp4` (under 25 MB). The film runs on a virtual clock and is driven only by real mouse input.
- `node tools/meshinfo.mjs`: triangle counts per GLB node.

## Known gaps

- The ship-stacking lift is stylized. The arms swing the ship from a stand beside the mount, and they do not grip it
  realistically.
- The flight is compressed. Vehicle speeds on screen run faster than real transporters, and the cards scale the
  speeds they show.
- The dots look like large balls in extreme close-ups. The look is made for mid to wide shots.
- Picking uses box proxies, so a click near a vehicle can select it even where the model is thin.
