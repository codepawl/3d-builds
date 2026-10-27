# Squawk · Ondra Bay air traffic control

A live air traffic control console that plays like a strategy game. Three control sectors of an
invented airspace around Ondra Bay International (QOND) run in real time: aircraft fly departure
routes, arrival routes, a holding stack and the final approach, an en-route sector crosses its
airways at altitude, a storm cell drifts across and makes traffic reroute, and a simulated
controller clears levels, sequences arrivals and resolves conflicts. Every model is from the
Blender kit in `../blender` (see `ASSETS.md`), running in three.js.

All names are made up: the airport and its code, the airlines (Ondra Air, Saltline, Kestrel
Regional, Northbay Express, Amberjet), callsigns, aircraft type designators, fixes and cities.
Nothing comes from a real airline, airport or chart.

## Run

```sh
npm install
npm run dev        # http://localhost:5424
```

Stack (exact versions in `package.json`): Vite 8, React 19, React Three Fiber 9, drei 10,
postprocessing (N8AO ambient occlusion, bloom, SMAA), three 0.186.

## What is on screen

- **Sectors** (site switcher, top bar): Ondra Approach (terminal area with the holding fix KILNA,
  arrival gates, departure routes and the airport), Ondra Tower (the two runways 27L/27R,
  taxiway A, six stands, terminal, tower, radar) and Saltline Sector (en route, FL240 to FL400,
  VOR junctions BARRA and SELKA, arrivals descending toward Ondra Bay).
- **Aircraft**: six invented airframes in five liveries, fans and props spinning, gear down on
  approach and the ground, beacons and strobes blinking, banking in turns.
- **Radar picture**: data tags next to each aircraft (callsign; altitude in hundreds of feet with
  climb or descent arrow and cleared level; ground speed; type, and stand on the tower view) that
  stack upward when they would overlap, history dots and trail, a drop line to the ground,
  separation rings (half the sector minimum) that turn amber when a pair closes inside 2.4 times
  the minimum and red below it, the rotating radar sweep, range rings, airways and the final
  approach painted onto the terrain.
- **Dashboard**: KPI cards (aircraft in sector, arrivals per hour, average delay, minimum
  separation now), a detail card for any clicked aircraft, fix, runway, tower or storm cell with
  live fields, a progress bar and instructions you can give (climb, descend, slow), the arrival
  timeline at the bottom (handoff, descend, hold, approach, land, vacate with times and ETAs), and
  tabs for traffic, alerts, runways and the controller log. A list row flies the camera to its
  aircraft and follows it. Empty ground or Esc closes the card; `/` focuses search.

## Code map

- `src/data.js` sectors, routes, fixes, airlines, aircraft types, runway and taxi tracks.
- `src/sim.js` the seeded simulation (one world per sector; ×8 simulated time).
- `src/store.js` shared UI state and camera commands; `src/status.js` status labels and icons.
- `src/scene/` the 3D view: `Terrain.jsx` (height field, towns, trees, boats), `mapShader.js`
  (sweep, rings and airways in the terrain shader), `Airport.jsx`, `Traffic.jsx`, `Overlays.jsx`
  (fixes, storm cell, clouds, gulls), `assets.jsx` (GLB loading, liveries, instancing).
- `src/ui/` the dashboard.
- `tools/shoot.mjs` review screenshots with frame rate, `tools/closeups.mjs` asset close-ups,
  `tools/film.mjs` the 30 s film on a virtual clock driven by real mouse input.

## Film

```sh
node tools/film.mjs                      # writes shots/frames/0000.png ... 0899.png
# then encode at below-normal priority (see ../README or the pass report)
```

`shots/film.mp4` is H.264 yuv420p, crf 18, faststart; `shots/film-web.mp4` is the copy under
25 MB.
