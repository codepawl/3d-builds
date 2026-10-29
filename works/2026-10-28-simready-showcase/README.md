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
4. `optimize.mjs` removes the USD instance prototypes Blender imports (`prototypes.mjs`) and duplicate mesh
   instances, then runs dedup, prune and weld. It resizes textures to 1024 px as WebP and compresses geometry with
   meshopt. It does not simplify meshes.
5. Each result goes to `out/manifest.jsonl` with the numbers before and after.

Run it with `npm install` in `batch/`, then `node run.mjs <asset-list.txt> <work-root> 2`. Each Blender runs at below
normal priority with `BLENDER_THREADS` threads (default 3). A conversion that passes `BLENDER_TIMEOUT_MINUTES` (default
30) is killed with its process tree. A full run took about 8 hours on a 10 MB/s line.

Five assets (two coilovers and three robot trolleys) use UDIM textures with 2 to 14 tiles on meshes of about a million
polygons. Blender's glTF exporter splits UDIM tiles in Python and did not finish them in two hours. `usd_to_glb.py`
now does that split with numpy before the export, so each tile gets its own material and the export takes seconds.
The exporter's own UDIM handling also dropped the faces of some tiles: the first release of crate_plywood_b01 kept
only its metal frame. Every UDIM asset now goes through the numpy split. `replace_from_recheck.mjs <recheck>/out <work-root>/out`
swaps in a re-run glb when it has more triangles than the published one.

SimReady places its parts as instanceable prims that reference prototypes in `payloads/instances.usda`. Blender's USD
import also brings each prototype in, as a scene-root object at the origin, so a moved part (the eyeglasses' arms, a
door) showed twice and an unmoved one overlapped itself. The first release carried them in 1,305 of 2,595 files.
`remove_prototypes.mjs <work-root>/out` repairs finished glbs by editing only their JSON chunk, so nothing is
re-encoded, and refreshes `manifest.jsonl`.

## Physics and moving parts (`batch/add_physics.mjs`)

`add_physics.mjs <list> <glb-in> <glb-out> <usd-cache> <report.jsonl>` reads each asset's `base.usda`,
`instances.usda` and `Physics/physics.usda` with the small USDA reader in `usda.mjs`. It writes the rigid bodies,
mass, physics materials and joints into the glb JSON as `KHR_physics_rigid_bodies`, and mirrors each joint into the
moving part's node extras (`joints: [{ type, parent, pivot, axis, min, max, unit }]`). The USD is Z-up and the glbs
are Y-up, so a joint's Y axis becomes the frame's Z column with its limits negated. Where Blender merged a body prim
into its only mesh, a wrapper node with the body's name and USD transform goes above the mesh. `apply_physics.mjs`
moves the results into the published set. `scan_physics.mjs` is the first survey of what the USD layers hold.

`space/physics.html` is a playground for that data: it drops a few models into Rapier with their mass, friction,
convex-hull colliders and joints, and you drag any part with the mouse. `src/tools/physics_film.mjs` records the 32 s
physics film the same way as the first one, and `make_sound.py` takes `INPUTS`, `SECONDS` and `OUTPUT` for it.

## Thumbnails and the viewer (`batch/thumbs/`, `space/`)

- `render_thumbs.mjs` renders every glb to a 512 px WebP in headless Chrome, with the film's three.js studio look.
- `build_index.mjs <manifest.jsonl> <thumbs> <space>` writes `thumbs/metadata.jsonl` for the Hugging Face Dataset
  Viewer and `space/assets.json` for the viewer.
- `build_atlas.mjs <thumbs> <space>` packs them into 26 sprite sheets (`space/atlas/`), so a page of the viewer's grid
  is two requests instead of 120 redirects to the dataset.
- `make_sheet.mjs` lays thumbnails out in a grid, for the dataset card's hero image.
- `space/` is the static Space at https://huggingface.co/spaces/codepawl/simready-glb-viewer. It loads thumbnails and
  glbs straight from the dataset. `serve_space.mjs` serves it with a local copy of the files
  (`http://127.0.0.1:5541/?base=/data/`).

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
