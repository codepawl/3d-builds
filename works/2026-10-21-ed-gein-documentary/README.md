# The man who inspired Psycho, as a 3D documentary

A 3D documentary of the Ed Gein case in Plainfield, Wisconsin, told on a traced map of the county, with a date-ordered timeline and no gore.

- Post: https://x.com/anxuanng/status/2112907859583525292  (part 2, the arrest, the trial and the 27 years after, is a reply to it)
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js 0.186.1 with React Three Fiber, Blender 5.2 for the models

## How it was made
1. The prompt asked for a true-crime visualization of a notorious case, in the dark documentary style of a LEMMiNO video (see prompts.md).
2. A fact file with dates, places and sources came first. Every mark in the film comes from that file, and the file lists what never appears on screen. The fact file is not in this repo. The facts the app shows are in `src/src/data.js`.
3. The county map was traced from four USGS topographic quads into GeoJSON. The farm, the town and the other buildings are generic Blender models built from period photos (see `design/`).
4. The first build was an app with panels. It overlapped itself, and An asked for a cleaner layout, then for a plain 3D film with no UI, told from young to old.
5. The film was recorded in 16:9 and 9:16 with a headless browser (`src/tools/film.mjs`). The music and sound effects were synthesized in Python, apart from three CC0 recordings.
6. Rounds of fixes followed: UI overlap, event order by date, a figure that teleported through a door, and footstep sounds replaced with real recordings. This was not a one-shot build.

## Run it
```
npm --prefix src install
npm --prefix src run dev        # http://localhost:5432
```
Press S in the app for the sources overlay. `npm --prefix src run build` makes a static build. The film recorder needs the dev server running, then `node src/tools/film.mjs`. Details are in `design/app-notes.md`.

## Design
The view is exterior only. People are faceless grey capsule figures, victims appear as name labels and never as figures, and nothing graphic appears. Time runs from 1906 to 1984. `src/src/beats.js` lists the shots and `src/src/world.jsx` holds the behavior. `design/app-notes.md` says what each moment does. `design/ASSETS.md` and the other notes in `design/` describe the models.

## Assets and credits
- Map: USGS historical topographic quads (Coloma 1958, Whiting 1957, Amherst 1957, Wautoma 1959), public domain, traced to GeoJSON in `src/public/assets/map/`.
- Place coordinates: OpenStreetMap contributors, ODbL.
- Models: made for this project in Blender (`src/blender/`) and exported to `src/public/assets/*.glb`. The reference photos are not included.
- Sounds: three CC0 recordings from Freesound, listed in `src/tools/sounds/CREDITS.md`. The music and other effects are synthesized by `src/tools/music.py` and `src/tools/sfx.py`.
- Left out: rendered films and the raw fact file.

## Prompts
See prompts.md.
