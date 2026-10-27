# Bagline, a live baggage handling operations view

Vite + React + React Three Fiber, six Blender GLB packs from `app/public/assets`. Port 5434.

Run: `npm install` then `npm run dev` in `app`, open http://127.0.0.1:5434/ (add `?start=58` to pick the simulation second).
Checks: `node check_shots.mjs` (screenshots in `shots`, fps). Film: dev server running, then `node record_film.mjs` (frames, log in `shots`), encode with ffmpeg crf 18 yuv420p faststart.

Sites: Sorter hall (CT, reject line to search room, 46-tray tilt sorter, 7 chutes, early bag store), Check-in (4 desks, collector, decline), Make-up and ramp (carousels, containers, tug trains, belt loader, aircraft).
Simulation: seeded, fixed 1/60 s step, every bag planned analytically (path, scanner, tray, chute), previous and current pose interpolated at render.
