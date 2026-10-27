# SPDR

A steampunk spider prototype in Three.js with an editable Blender model.
The six-legged model follows the mechanical spider reference sheet supplied by the user.
Procedural motion draws on t3ssel8r's [animation explanation](https://www.youtube.com/watch?v=KPoeNZZ6H4s).

## Controls

- Move the pointer to lead the spider.
- Use arrow keys to move the target.
- Drag with the right mouse button to orbit. Scroll to zoom.
- Press Space to vent steam.
- Toggle Terrain for the obstacle course and Pixel for the rendering style.

## Local commands

Run these commands from `<your folder>`.

```powershell
node demos/procedural-pet/server.mjs
node --test demos/procedural-pet/motion.test.mjs demos/procedural-pet/strand-physics.test.mjs
node demos/procedural-pet/smoke.mjs
node demos/procedural-pet/build.mjs
node demos/procedural-pet/record.mjs
node demos/procedural-pet/capture-split.mjs
```

The preview uses port 5186. The build writes a static website to `dist`.
The development tools use Three.js, esbuild, Playwright and Chrome already installed on this machine.

## Assets and recordings

`assets/spider.blend` contains the editable model. `assets/spider.glb` is the web export.
`blender/build_spider.py` generates both files.

`environment.mjs` adds charcoal concrete, worn steel, restrained reflections,
blue-black fog, low drifting mist and pooled dust particles. Cool rim lighting and
the amber eye light establish the darker atmosphere. The directional shadow follows the spider through
the course; small, noisy dust wisps and grit spread from the solved foot contacts at landing, then settle under drag and gravity. Both comparison panels render
these effects from the same simulation.

Five hanging hoses use damped, fixed-step Verlet chains with one attachment each,
gravity, strong damping and a gravity-rest guide with surface collisions. They
hang independently of the torso's rotation and retain a small inertial lag.
The front legs follow overlapping curved paths over the edge, then support the
hull while the lower legs extend to raise it vertically before rolling over the crest. Velocity-matched paths connect that lift to
takeoff. Sole rotation follows the transfer. The jump
keeps its forward heading, with separate spring-driven feet trailing the hull;
a spring compresses and rebounds on landing. Brief temporal blur follows the
launch and flight. The right panel uses four-pixel blocks over that same frame.

`footsteps.mjs` synthesizes dull joint movement, varied metal foot contacts,
a low pneumatic release at takeoff and a heavier landing impact. Each contact
stores its weight, pitch, decay and noise offset for the same offline replay.
The website enables sound after the first click or keypress. The recorder renders the
same sound events offline using actual contact timestamps and mixes them over the music.

The recorder sends mouse and keyboard input to the running prototype and captures its canvas.
Each output lasts 20 seconds, showing the left and right sides in either smooth or pixel rendering.
The comparison recorder writes `artifacts/spider-vertical-lift.mp4`. It opens on
the front, follows a faster straight obstacle crossing and a brief inertial stop
at the wall, then tracks a wall climb, forward jump and landing with a slow camera.
It renders the same simulation on both sides: smooth on the left, pixel on the right.

The small graph measures frame intervals during capture. It is not a hardware benchmark.
The adjacent JSON files retain sampled simulation telemetry.

The user selected [0_0 (Slowed + Reverb), ilyhiryu](https://www.youtube.com/watch?v=W5_JxKjetVg) as the soundtrack.
The recording uses the excerpt from 1:43 to 2:03, with a short fade at the end.
The longer comparison starts at 1:43 and runs for 43.834 seconds.
Camera timing uses estimated bass onsets saved in `artifacts/music-beats.json`.
Music is included only in the exported videos, not the website.

Motion source notes and the limits of the biological reference are in
`MOTION-REFERENCES.md`.

