# Gladewheel: live theme park operations

A real-time 3D operations app for a made-up park, Gladewheel Park, drawn as a toy isometric strategy game.
Vite + React + React Three Fiber + drei, pinned versions in `package.json`.

## Run

```
npm ci
npm run dev        # http://localhost:5431
```

## What is in it

- Four lands (site switcher, top bar): Tidewild Cove (adventure: Riptide Runner steel coaster, Kalua Falls log flume,
  Temple of Echoes dark ride, Sunspoke Wheel), Nova Reach (space: Comet Run indoor coaster, Orbit Wheel, Skyloop
  monorail station), Briarwood (fairytale: Halvenmoor Castle, Gilded Gallop carousel, Lantern Tale dark ride, parade
  route with three floats), Gateway Plaza (entrance gates, parking lot, lot trams).
- One plain data model (`src/data.js`, `src/sim.js`): rides, units (coaster trains, log boats, monorail, trams,
  service carts, floats, staff), stands, queues, tickets, events and a park clock. A seeded simulation moves them:
  trains run the Blender spline (station dwell, 2.8 m/s chain lift, gravity on the circuit, brakes), boats climb and
  splash (the splash mesh is driven per drop), the wheels turn with level gondolas, horses bob, the monorail stops
  and opens its doors, queues shuffle forward in pulses, and rides go down, test and reopen on a script.
- Guests are instanced crowds (about 330 to 480 per land) with the walk, idle and wave clips baked per part.
- Dashboard: search, site switcher, weather, live clock, user; four KPI cards; a detail card for any clicked object
  with live fields and a progress bar (closes on empty ground or Esc); one ride's day on the bottom strip; tabs of
  rides, vehicles, food and shops, tickets and staff. A row click flies the camera there and follows moving units;
  clicking a moving unit in the world follows it too (from at least 40 m above a coaster train).

## Tools

- `node tools/shoot.mjs` (dev server running): screenshots in `shots/`, close-ups in `shots/closeups/`, fps and draw calls.
- `node tools/film.mjs` then `pwsh tools/encode.ps1`: the 30 s film on a virtual clock, driven by real mouse input,
  encoded at below-normal priority to `shots/film.mp4` and `shots/film-web.mp4`.
