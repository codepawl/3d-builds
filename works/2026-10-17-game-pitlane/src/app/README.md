# Boxline, race weekend operations

A real-time 3D operations app for a made-up single-seater team (Halvard Racing in the Meridian Formula Series) that
looks like a toy isometric strategy game. Every model is a Blender GLB from `public/assets` (see
`../blender/ASSETS.md`); the track ribbon, pit-lane surface, box markings, kerb placement, verges and night light
pools are drawn in the app.

## Run

```
npm ci
npm run dev        # http://localhost:5429
npm run build && npm run preview:perf   # production build on :5439, used for fps and the film
```

## What is in it

- Three circuits, switched from the top bar: Ashgrove Park (parkland, day), Lumen Harbour (street circuit at night,
  floodlights and harbour) and Sahra Dunes (desert). Each has its own track shape, barriers, scenery and race state.
- A seeded simulation (`src/sim.js`) runs eight cars round the lap with a curvature speed profile, following
  distances, DRS, yellow-flag sectors, lap timing, tyre wear and energy. Stops are scheduled per car: box call half a
  lap out, the crew runs out of the garage, the car takes the pit entry at the 80 km/h limit, stops in its box, the
  jacks lift it, four gunners and eight tyre carriers change the wheels (the band colour follows the fitted
  compound), the front jack is pulled clear, the release light goes green and the car rejoins.
- Our 16-person stop crew, rival crews, mechanics on the spare chassis on stands, tyre runners and marshals all
  play their Blender clips at times set by the simulation. People are drawn as instanced body parts posed from
  bones-only rigs; static repeats are instanced per material.
- Dashboard: top bar with search, site switcher, weather, race lap, local clock and user; KPI cards (race position,
  gap to leader, average pit stop, tyre life left); a detail card for any clicked object with live fields and a
  progress bar; a timeline strip that follows car 07's pit stop (box call, entry, stationary, release, back on track)
  over the race strategy (stints by compound, undercut window, current lap); tabs of Cars, Crew, Stops and Race
  control; zoom, rotate, pit-lane and whole-circuit camera buttons.
- Clicking a car or person selects it and follows it; clicking a list row flies the camera there. Esc or a click on
  empty ground closes the card.

Lap times and gaps are shown at race scale: a simulated lap takes about 22 s so the world keeps moving, and lap
times and gaps are multiplied by 4.1. Stop times are real seconds.

## Tools

- `node tools/shoot.mjs [overview selected pitstop garage paddock track post roadcars racks car site2 site3]`:
  review screenshots into `shots/`; `node tools/shoot.mjs fps` measures frame rate.
- `node tools/cpu.mjs`: frames per second and CPU time per frame.
- `node tools/film.mjs` then `pwsh tools/encode.ps1`: the 30 s film on a virtual clock, driven only by real
  mouse input, into `shots/film.mp4` and `shots/film-web.mp4`. Set `BOXLINE_URL` to record from the preview build.

## Checks (2026-10-18)

- Film: `shots/film.mp4` 1920x1080, 30 fps, 900 frames, yuv420p, 41.7 MB; `shots/film-web.mp4` 15.3 MB.
  mpdecimate drops 0 frames. Car 07 is clicked at 5.0 s, stops at about 7.8 s and is released at about 10.4 s.
- Frame rate on the production build at 1920x1080 (RTX 3060 shared with other jobs, about 33% busy):
  52-58 fps in the pit-lane view, CPU 16-18 ms per frame; 2,250 draw calls including the shadow pass.
- Known gaps: car numbers are not drawn on the noses; the grandstand close-up in `shots/` frames the garage roof
  rather than the stand; drei Html pins log a harmless removeChild error when the site switches.
