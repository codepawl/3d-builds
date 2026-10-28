# Draft 3 (60 fps, quiet world, writhing worms, carcass chunks)

Film: shots/film*.mp4, 1920x1080, 60 fps, 30 s. Draft 2 is in shots/_prev2. Internal resolution 640x360 (3x). Nobody has listened to the sound.
Changes: composite grade (quiet world, worm mask in alpha 0.5, worm-only outline and dither rules) in src/chase-camera.js; thin 20-point worms with 3D rearing and bite dips in src/worm-renderer.js; cohesion, chunk attractors, reach and bite in src/worms.js; carcass chunks in src/chunks.js (worms are born only as chunks are finished, released at a capped rate from src/main.js); 60 fps plan in tools/film_plan.*; chunk bite cues in sound/make_sound.py.
Still weak: swarm sits in the village from 19 s on instead of sweeping to the woods; rearing worms look stiff at about 6 s; heap reads near black at distance; growth is 15 to 27 percent a second late (12 to 923 in 30 s cannot stay under 10 percent a second).
