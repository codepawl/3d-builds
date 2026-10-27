# The Titanic, deck by deck

An old-encyclopedia cutaway plate of RMS Titanic in 3D. You see her from the starboard side with the hull cut away from bow to stern, so every deck reads as a stage, from the grand staircase down to the boiler rooms.

- Post: https://x.com/anxuanng/status/2114742781520593343
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.170.0 (CDN import map)

## How it was made
1. An sent a picture of an encyclopedia cutaway plate and asked to learn its theme and apply it to the Titanic, so people can see what was inside her (see prompts.md).
2. `design/PLAN.md` set the look (the illustrated cutaway plate), what people must see, and the real numbers to check. `design/facts.md` marks each number as measured or inferred.
3. The page was built in `src/web/`: the ship (`ship.js`), the rooms with figures doing their jobs (`rooms.js`, `figures.js`), labels (`callouts.js`) and the plate styling (`style.css`, `post.js`).
4. Stills (`src/tools/shoot.mjs`) and a film (`src/tools/record-reel.mjs`) checked each deck.
5. A sound mix was cut from CC0 recordings (`src/sound/make_sound.py`).

## Run it
```
uv run --no-project python -m http.server 8080 --directory src/web
```
Open http://localhost:8080/index.html. It loads three.js from jsDelivr, so it needs a network connection.

## Design
Look: illustrated cutaway plate, a three-quarter high view of the starboard side with the near hull cut away. First class luxury sits at the top, third class lower and the fire and coal of the boiler rooms at the bottom. Decks from the top are Boat, A to G, Orlop and Tank top. See `design/PLAN.md` for the rooms.

## Assets and credits
- Everything on screen is built in code. No external model or texture is used.
- Sound: CC0 recordings named by Freesound ID and author in `src/sound/make_sound.py` (sea, wind, creak, fire, room tone and others), and CC0 orchestral notes. The audio files are not included.
- Facts: see `design/facts.md`.
- Left out: the film, stills and audio.

## Prompts
See prompts.md.
