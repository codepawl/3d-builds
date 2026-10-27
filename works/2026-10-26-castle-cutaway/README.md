# A castle plate you can slice open

An interactive pixel-style castle in an old encyclopedia cutaway plate. Villagers, guards and smiths live their day inside it, and you can open cutaway layers from several sides, pick a room, an object or a person, and read about it.

- Post: https://x.com/anxuanng/status/2114665745116508166
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js (vendored in `src/vendor/`)

## How it was made
1. An gave a reference image of a medieval castle cutaway plate and asked for an interactive version where people move and live, with cutaway layers that only appear on a click, for learning (see prompts.md).
2. A photoreal Blender version and a pixel version were built side by side. An preferred the pixel one and dropped the photoreal one.
3. Review rounds fixed too many UI panels covering the scene, clicks that hit hidden objects, too few props inside the walls, and missing paths. More castle types and real-looking trees were added, and a loading bar.
4. The film was recorded with `src/record.mjs`, with a sound mix built in Python (`src/sound/mix.py`) from CC0 recordings. Stills for review came from `src/shoot.mjs`.
This took many rounds, not one shot.

## Run it
```
uv run --no-project python -m http.server 8080 --directory src
```
Open http://localhost:8080/index.html. Three.js is included in `src/vendor/`, so no network is needed.

## Design
The castle follows real 14th-century English and French types (curtain walls, drum towers, a gatehouse, a keep). `design/castle.md` lists the measurements and the real castles they follow, marked approximate. The scene, people and props are in `src/world.js`, `src/kit.js` and `src/life.js`. `src/events.mjs` lists the events that drive sound.

## Assets and credits
- The pixel castle is built in code. No downloaded model or texture is in `src/`.
- The dropped photoreal variant used CC0 models, textures and HDRIs from Poly Haven and CC0 Freesound recordings. They are listed in `design/credits.json`. None are included.
- Sound sources are CC0 Freesound recordings listed in `src/sound/sources/manifest.json`. The audio files are not included, and `src/sound/tools/find_sounds.py` finds them again.
- Left out: the rendered film, stills and contact sheets.

## Prompts
See prompts.md.
