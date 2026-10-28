# SimReady optimized

A 29 s film about optimizing all 2,595 free NVIDIA SimReady 3D models for the browser. The film shows what each step
changed, before and after, with measured numbers. The optimized set is on Hugging Face:
https://huggingface.co/datasets/codepawl/simready-glb

- Post: https://x.com/anxuanng/status/2115494696097394947
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js,
  Blender 5.2, glTF Transform 4.5

## What the film shows

1. An alternator split by a slider: the 381 MB original with 4096 px textures on the left, the 6.5 MB optimized copy
   with 1024 px WebP textures on the right.
2. A V8 engine on a progress track: NVIDIA original (1.7 GB folder), Blender glb (888 MB, 9.40 s to first frame),
   dedupe instances, textures to WebP, meshopt geometry, and the result (9.3 MB, 0.57 s).
3. The whole set: 224.9 GB of Blender glb files become 3.82 GB.

The models are rendered clean. The dither and ASCII passes stay on the backdrop.

## How the set was optimized (`batch/`)

1. `run.mjs` downloads each asset's `simready_usd` folder from
   https://huggingface.co/datasets/nvidia/simready-assets. It skips `source_assets/`, which holds a second copy of the
   textures. Files are cached by content hash, because many assets share the same textures.
2. It checks that the asset's licence is CC BY 4.0.
3. `usd_to_glb.py` imports the USD in Blender 5.2 and exports a glb with the original textures.
4. `optimize.mjs` removes duplicate mesh instances, then runs dedup, prune and weld. It resizes textures to 1024 px as
   WebP and compresses geometry with meshopt. It does not simplify meshes.
5. Each result goes to `out/manifest.jsonl` with the numbers before and after.

Run it with `npm install` in `batch/`, then `node run.mjs <asset-list.txt> <work-root> 5`. Set
`BLENDER_TIMEOUT_MINUTES` higher for very large assets. A full run took about 8 hours on a 10 MB/s line.

## The film (`src/`)

- `src/web/film.html` is the page, and `src/web/src/script.js` holds the timeline, the inputs and the sound cues.
- `src/tools/film.mjs` records it on a virtual clock with real clicks, drags and key presses.
- `src/sound/make_sound.py` places a soft sound on every input and mixes a music bed to -16 LUFS.
- `design/notes/rerecord.md` lists every step to record the film again.

The models are not in this folder. Download the optimized ones from the Hugging Face dataset into `src/web/models/`.
Then run `node src/tools/serve.mjs 5530` and open http://127.0.0.1:5530/film.html. The recorder needs
`npm install playwright`. Set `CHROME_PATH` if Playwright's own Chromium is not installed.

## Assets and credits

- 3D models: NVIDIA SimReady, CC BY 4.0. See `CREDITS.md`.
- Music: "Hypnothis" by Kevin MacLeod (incompetech.com), CC BY 4.0. Sound effects: Freesound recordings, all CC0.
- Brand glyphs: Simple Icons, CC0. The marks belong to their owners.
- three.js (MIT), JetBrains Mono (OFL), the Poly Haven HDRI (CC0).
- Left out: the models, the film, frames and audio renders.

## Prompts

See prompts.md.
