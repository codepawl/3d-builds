# Rackline: a live automated pallet warehouse

[![Remix on Collab.Market](https://collab.market/badge/remix-on-collab-market.svg)](https://collab.market/anxuanng/rackline?utm_source=badge)

A live warehouse in three.js, built from NVIDIA's free SimReady models. Pallets come in at three receiving doors, forklifts put them in the racks, two pick lines pack orders, and forklifts carry the packed pallets to two shipping doors.

- Post: https://x.com/anxuanng/status/2116504653215248436
- Play it and make your own version: https://collab.market/anxuanng/rackline
- Made with: Claude Opus 5.5 in Claude Code, three.js, NVIDIA SimReady models converted to GLB in [codepawl/simready-glb](https://huggingface.co/datasets/codepawl/simready-glb)

## How it was made

1. The brief in `design/TOPIC.md` follows the real process, from receiving to put-away, order, retrieval, case pick, pack out and ship. It uses real aisle widths, travel speeds and lift speeds.
2. `src/tools/fetch_assets.py` downloaded the SimReady models. `src/tools/measure.mjs` measured each one, and the sizes are in `design/asset-sizes.json`.
3. A seeded simulation (`src/src/sim.js`) plans every pallet, forklift and order on a fixed step. The scene follows the simulation and does not play a fixed animation.
4. The forklift model was split into chassis, mast stage and cab with forks, so the mast can lift.
5. The film is one unbroken take with real mouse input, recorded on a virtual clock by `src/tools/film.mjs`. The sound was generated with ElevenLabs and mixed by `sound/mix.py`.

## Run it

```
python src/tools/fetch_assets.py
npm --prefix src install
npx --prefix src vite src --port 5493 --strictPort
```

Open `http://localhost:5493`. Click a forklift, pick line, dock or rack to see what it does. Query parameters: `preroll` (sim seconds run before the first frame, default 900), `seed` (default 7), `dpr`.

Checks, run from `src`:

- `node tools/simcheck.mjs <hours>` prints the sim's numbers over a run.
- `node tools/gapcheck.mjs` lists forklifts that come closer than 2.2 m.

The recording tools (`film.mjs`, `shoot.mjs`, `measure.mjs`) need Playwright: `npm --prefix src install -D playwright`. Run them from `src` while the dev server runs.

## Assets and credits

- NVIDIA SimReady models, CC BY 4.0. They are not in this folder. `src/tools/fetch_assets.py` downloads them from codepawl/simready-glb into `src/public/assets`. The full list is in `design/CREDITS.md`.
- Poly Haven, CC0: the HDRI `empty_warehouse_01` and the `concrete_floor_worn_001` floor textures, included in `src/public`.
- Built in code: pick and pack gantries, trailers, dock door frames, floor paint, lane marks and labels.
- Left out: the film, the frames and the ElevenLabs sound files. `sound/cues.json` and the mix scripts are kept.

## Prompts

See prompts.md.
