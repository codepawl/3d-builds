# SimReady showcase

A 24 s film of five free NVIDIA SimReady 3D assets (a V8 engine, a turbocharger, a pedestal fan, a bench vise and a fire extinguisher) running in three.js. Every frame mixes an ASCII pass and a 1-bit dither pass, with a thin band of the raw PBR render on the wipe between them. The turbine wheels, the fan blades and the vise jaw are NVIDIA's own separate parts, so they move.

- Post: (added after posting)
- Made with: Claude Opus 5.5 in Claude Code, the visualize-in-3d skill (https://github.com/codepawl/viz3d), three.js, Blender 5.2

## How it was made
1. The spec is `design/topic.md`: the five assets, the look, the beats and the sound.
2. `src/tools/download.mjs` fetches each asset's `simready_usd` folder and licence from https://huggingface.co/datasets/nvidia/simready-assets. The V8 folder is 1.7 GB.
3. `src/tools/usd_to_glb.py` imports the USD in Blender 5.2, shrinks every texture to 1024 px and exports a glb. The V8 comes out at 27.5 MB, the vise at 3.1 MB.
4. The page (`src/web/`) renders the real lit scene, then `src/web/src/ascii.js` and the dither pass in `src/web/src/composite.js`. A wipe mask blends the two per shot (`src/web/src/shots.js`).
5. `src/tools/film.mjs` records the film on a virtual clock at 1/30 s per frame, with real mouse clicks, a drag and a key press. It logs every input to `out/input_events.json`. `src/sound/make_sound.py` gives each input its own CC0 sound and mixes to -16 LUFS.

Two review rounds of stills and contact sheets are in `design/notes/`.

## Run it
The models are not in this folder (about 79 MB together). Make them first:
```
node src/tools/download.mjs raw engineAssembly_v8_engine_a01 engineComponent_turbocompressor_a01 climate_shopFan_pedestal_a01 equipment_bench_vise_a01 fireExtinguisher_abc_a03
blender -b --factory-startup --python src/tools/usd_to_glb.py -- raw/engineAssembly_v8_engine_a01/simready_usd/sm_engineAssembly_v8_engine_a01_01.usd src/web/models/v8.glb 1024
```
Run the second line for each asset, with the output names `v8`, `turbo`, `fan`, `vise` and `extinguisher`. Then serve the page with `node src/tools/serve.mjs 5530` and open http://127.0.0.1:5530/.

To record the film, run `npm install playwright` and then `node src/tools/film.mjs out/frames` while the server runs. Set `CHROME_PATH` if Playwright's own Chromium is not installed. To mix the sound, run `uv run --with numpy --with scipy --with soundfile --with pyloudnorm python src/sound/make_sound.py`.

## Design
- Dither + ASCII showcase look: one monospace face, off-white ink on near black, and the two passes share every shot.
- The wipe moves differently in each shot: a sweep on the V8, a radial wipe from the turbo inlet, a split across the fan head, a wipe that follows the vise drag, and a diagonal over the lineup.
- Every frame is a function of the virtual clock, so any frame renders the same in any order.

## Assets and credits
- 3D models: NVIDIA SimReady, CC BY 4.0. Each folder's own licence file says so. See `CREDITS.md`.
- Sound: Freesound recordings, all CC0, in `src/sound/sources/`. Authors are in `CREDITS.md`.
- three.js (MIT), JetBrains Mono (OFL), the Poly Haven HDRI (CC0).
- Left out: the models, the film, frames and audio renders.

## Prompts
See prompts.md.
