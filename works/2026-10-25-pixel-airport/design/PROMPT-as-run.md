Build a live pixel-art 3D airport that people can open in a browser and watch running.

Write one complete file, index.html, in this folder. No other files are needed. Work without asking questions and do not edit anything outside this folder.

## The look

- A pixel diorama: render the three.js scene at about 400x225 into a render target, then upscale to the
  window with nearest-neighbour filtering, so every pixel is a crisp block.
- Light with one warm sun and real shadows. Use flat colours from a small palette, a 1 px dark outline on
  aircraft and buildings, and dithered effects (exhaust heat, runway lights, clouds).
- A slow isometric camera that the viewer can orbit and zoom with the mouse or a finger.
- A day and night cycle of about 4 minutes. At night the runway edge lights, taxiway centre lights,
  terminal windows and aircraft beacons glow.

## The airport

- One runway (09/27), a parallel taxiway with exits, an apron with 6 gates and jet bridges, a terminal, a
  control tower, a fuel farm and a hangar.
- Aircraft of two or three sizes (narrow body, wide body, regional turboprop) with made-up airline liveries.

## What runs

A seeded simulation, never Math.random without a seed. Time comes from performance.now.

- Arrivals: approach on a glide path, touch down, roll out, leave at an exit, taxi to a free gate.
- At the gate: the jet bridge docks, a fuel truck, a baggage tug with carts and a catering truck drive up,
  then leave. Turnaround takes 2 to 4 simulated minutes.
- Departures: pushback tug, taxi to the holding point, wait for the runway, take off, climb out.
- Only one aircraft uses the runway at a time. Aircraft on the taxiway keep their distance and never pass
  through each other.

## The interface

- A small panel with the simulated clock, aircraft on the ground, in the air, and movements per hour.
- A flight board listing the next arrivals and departures with flight number, gate and status.
- Click an aircraft to follow it with the camera and show its flight number, type, gate and state.
- Speed buttons: 1x, 4x, 16x.
- Use a pixel font drawn in the canvas or a Google Fonts pixel font from fonts.googleapis.com.

## Technical

- three.js 0.170.0 from an import map pointing at https://cdn.jsdelivr.net/npm/three@0.170.0/ and its
  addons. No other network requests: the page must work where fetch to other hosts is blocked.
- No external models or textures. Build everything from code.
- It must run smoothly at 60 fps on a laptop and resize to any window, including a phone in portrait.
- Set window.sceneReady = true after the first frame is drawn.
