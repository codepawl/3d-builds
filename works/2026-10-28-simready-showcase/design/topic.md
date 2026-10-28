# SimReady optimized: film plan (v2)

An, 2026-10-28, replacing v1: the film shows **what the optimization changed**, before vs after, with measured
numbers. Models are rendered clean (lit PBR). Dither and ASCII only on what is around them (backdrop, floor,
transitions, UI, stat readouts); mask the model out of both passes. The whole set (2,595 assets) is optimized and
published as a Hugging Face repo, linked in a reply under the post.

Source: `huggingface.co/datasets/nvidia/simready-assets`, 2,595 asset folders, 80.7 GB (`usedStorage`), CC BY 4.0
per folder (checked by `batch/run.mjs` on every asset).

## Pipeline (`batch/`)

1. Download `simready_usd/` without `.thumbs/` and `source_assets/`. `source_assets/` repeats every texture and is
   referenced only by MDL shader files that Blender ignores. V8: 1.7 GB folder, half of it that copy.
2. Blender 5.2 USD -> glb with the original textures (`usd_to_glb.py`).
3. `optimize.mjs`: drop duplicate mesh instances left by USD references, dedup, prune, weld, textures to WebP at
   1024 max edge, meshopt geometry compression. No simplify: at error 0.0001 it broke curved shading into facets.
4. Delete the download. `run.mjs` runs it all, 2 workers, results in `<work-root>/out/` (`glb/`,
   `manifest.jsonl` with per-stage numbers, `failures.jsonl`).

## Measured on the hero assets (2026-10-28)

| Asset | HF folder | Blender glb | Optimized | Triangles | Draw calls | Textures |
|---|---|---|---|---|---|---|
| V8 `engineAssembly_v8_engine_a01` | 1.7 GB | 888 MB | 9.3 MB | 1.92M -> 1.14M | 82 -> 64 | 47 x 4096 PNG -> 44 x 1024 WebP |
| Vise `equipment_bench_vise_a01` | 127 MB | 60 MB | 1.2 MB | 212k | 16 | 3 x 4096 -> 3 x 1024 |
| IV pole `IV_pole_a01` | 421 MB | - | 3.3 MB | | | |
| Extinguisher `fireExtinguisher_abc_a03` | 19 MB | - | 1.1 MB | | | |

The 888 MB V8 glb is slow, not broken: first frame 10.4 s against 0.57 s optimized (`web/data/load_times.json`). Its
textures failed once with `net::ERR_BLOB_OUT_OF_MEMORY`, but only with a second model loaded in the same page; alone
it loaded fully, so the film and post claim only the measured load time.

## Beats (real clicks, drags and keys on a virtual clock, every input has a sound)

1. Before: the V8 as NVIDIA ships it, 1.7 GB. Load the 888 MB glb: show the real failed render and the real error.
2. Pipeline: one row per step, each click applies it and the stat panel counts to the measured numbers
   (size, triangles, draw calls, texture size). The model stays clean and on screen.
3. Look held: same camera, raw 4K vs optimized 1K side by side on an asset that loads raw (vise), with a drag
   slider across it, then a close-up.
4. The whole set: many optimized assets load into one scene fast, with the set totals from the manifest.
5. End card: the Hugging Face repo name, "Models by NVIDIA SimReady, CC BY 4.0".
