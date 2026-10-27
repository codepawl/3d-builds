# Food Forest, rebuilt in Blender

A shot-for-shot study of Freek Freriks' Houdini piece "Food Forest: Ketelbroek", rebuilt in Blender from CC0 assets. It is a 15 second, 1920x1080 clip of a pencil and a compass drawing a food forest that grows out of a sheet of graph paper.

- Post: https://x.com/anxuanng/status/2114356306983145619  (quote of the original)
- Inspiration: Freek Freriks, "Food Forest: Ketelbroek", made in Houdini, shared by @motionographer: https://x.com/motionographer/status/2112916128167076189. This repo copies nothing of his. The shot list in `design/BRIEF.md` is our own description.
- Made with: Claude Opus 5.5 in Claude Code, Blender 5.2, ffmpeg, Python

## How it was made
1. An asked for a remake that matches the original at about 90%, with the objects, background, scenes, effects and sound effects analyzed first (see prompts.md).
2. The reference video was watched frame by frame with contact sheets, a spectrogram and a sound timeline. Their text summaries are in `design/MANIFEST.txt` and `design/audio_timeline.txt`. The video and the sheets are not included.
3. `design/BRIEF.md` describes the world (desk, paper, props, light, lens, grade) and a table of shots with times and actions.
4. The scene and its growth animation come from `src/blender/build_food_forest.py` and a timeline in `design/events.json`. Frames render with `src/render.ps1`.
5. Sound is cut from CC0 Freesound recordings (`src/sound/render_sfx.py`, sources in `src/sound/manifest.json`).
6. The first version moved too stiffly, so the plant growth was rebuilt with overshoot and settle. The stiff timeline was dropped. This took rounds, not one shot.

## Run it
You need Blender 5.2 and the CC0 plant assets named in the brief.
```
powershell -File src/render.ps1
```
Read `design/RENDER.md` first for the render settings. The scripts expect the asset folder paths described in `design/BRIEF.md`. Edit them to point at your own copies.

## Design
Warm late-afternoon sun from the back left, a dark walnut desk, cream graph paper with an orange grid, macro depth of field, warm grade with light bloom and film grain. Shots use hard cuts only. See `design/BRIEF.md`.

## Assets and credits
- Plants and shrubs: CC0 scans from Poly Haven (grass_medium_01/02, grass_bermuda_01, shrub_01 to 04, shrub_sorrel_01, fern_02, nettle_plant, weed_plant_02, flower_gazania, flower_heliophila, flower_ursinia, tree_small_02, island_tree_01 to 03). Get them from https://polyhaven.com/a/<name>. They are not included.
- Sound: CC0 recordings from Freesound, listed with author and page in `src/sound/manifest.json`. The audio files are not included.
- Left out: the reference video, the contact sheets, the `.blend` files and the rendered clip.

## Prompts
See prompts.md.
