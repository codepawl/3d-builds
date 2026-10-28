# SimReady showcase

A 24 s, 16:9 (1920x1080, 30 fps) film for an X post about NVIDIA's free SimReady assets on Hugging Face
(`huggingface.co/datasets/nvidia/simready-assets`). Verified 2026-10-28 from the HF API: 2,595 asset folders, dataset
licence CC BY 4.0, created 2026-06-29, updated 2026-10-27. Point of the film: these are real, textured, articulated
models that drop straight into a browser scene, light enough for 3D work and videos.

## Assets (each folder's `.metadata/LICENSE.txt` is CC BY 4.0, checked 2026-10-28)

Converted in Blender 5.2 with `tools/usd_to_glb.py` (USD import, textures shrunk to 1024, JPEG, glb). Numbers are
measured from the glb files; refresh them in the UI if a file is re-exported.

| File | Source folder | Downloaded | glb | Triangles | Moving parts |
|---|---|---|---|---|---|
| `web/models/v8.glb` | `engineAssembly_v8_engine_a01` | 1.7 GB | 27.5 MB | 959k | 9 gears + strap separate; hero, slow orbit |
| `web/models/turbo.glb` | `engineComponent_turbocompressor_a01` | 168 MB | 13.1 MB | 363k | `turbine_01`, `turbine_02` spin |
| `web/models/fan.glb` | `climate_shopFan_pedestal_a01` | 72 MB | 31.4 MB | 1.05M | `blade_01` spins |
| `web/models/vise.glb` | `equipment_bench_vise_a01` | 115 MB | 3.1 MB | 106k | `slidingJaw_01`, `screw_01`, `handle_01` slide and turn |
| `web/models/extinguisher.glb` | `fireExtinguisher_abc_a03` | 13 MB | 3.8 MB | 109k | none, turntable |

"Downloaded" is what `tools/download.mjs` fetched per asset (the `simready_usd` folder without thumbnails, plus the licence).

Each glb lists every mesh node twice (USD reference copies); the loader keeps the first node per mesh and hides the rest.

## Look: Dither + ASCII showcase (`visualize-in-3d` references/looks.md)

- Real three.js PBR scene (studio HDRI `~/Documents/social/assets-lib/hdri/lilienstein_2k.hdr` or similar, one key
  light, soft contact shadow) on a near-black ground.
- Two passes in the same frame: ASCII (reuse `~/Documents/social/demos/ascii-depths/web/src/ascii.js` and its
  JetBrains Mono font) and 1-bit ordered Bayer dither (off-white ink on near-black, 2-3 px cells). A soft wipe splits
  them across the subject, and a thin band (about 40-80 px) of the raw render rides the wipe edge.
- Each shot moves the wipe differently: left-to-right sweep, a radial wipe from the clicked part, a wipe that
  follows the cursor during the vise drag, a diagonal on the end lineup.
- Monospace UI in the same two colours: a left rail with the five assets (name, glb MB, triangles), a small header
  "NVIDIA SimReady / Hugging Face / CC BY 4.0". House UI rules: no eyebrows, no divider lines, no coloured left
  borders; the selected row is a subtle fill with a filled marker.

## Beats (driven only by real clicks, drags and keys on a virtual clock, visible cursor)

1. 0.0-4.5 V8 engine, low hero orbit, sweep from ASCII to dither.
2. 4.5 click "turbo" row. Turbo: click a "spin" button, both turbines spin up with motion blur glyphs; radial wipe.
3. 9.0 click "fan" row. Fan blades spin; camera cranes from low front to three-quarter.
4. 13.0 click "vise" row. Drag the jaw handle: the jaw slides open, the screw and handle turn with it; wipe follows the cursor.
5. 17.0 click "extinguisher" row. Turntable, key press `Space` flips which side is ASCII.
6. 20.0-24.0 all five on one shelf line, diagonal wipe, end card: "2,595 free 3D assets · NVIDIA SimReady on Hugging
   Face · CC BY 4.0 · assets by NVIDIA".

Every transition between assets is a dither dissolve, never a pop. Nothing stops dead (film.md, Motion).

## Sound

Every click, drag step and key press gets its own sound from `input_events.json` (film.md, Sound). Recordings to
reuse: `~/Documents/social/demos/grid-power/sound/sources/` (click_a, click_b, switch_a, whoosh) with their credits.
Add a short turbine whir and fan hum from CC0 recordings if found. Mix to -16 LUFS, true peak under -1 dBFS.

## Output

`out/simready-showcase.mp4` (H.264, yuv420p, AAC), contact sheets in `out/sheets/`, peak stills in `out/stills/`.
`CREDITS.md` lists every asset folder (CC BY 4.0, NVIDIA) and every sound.
