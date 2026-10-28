# Credits

## 3D assets: NVIDIA SimReady, CC BY 4.0

All five models are from the NVIDIA SimReady asset collection on Hugging Face
(https://huggingface.co/datasets/nvidia/simready-assets), licence CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). Each asset folder's `.metadata/LICENSE.txt` says CC BY 4.0.
Converted from USD to glb with Blender 5.2 (`src/tools/usd_to_glb.py`, textures shrunk to 1024 px, JPEG); the meshes and
materials are otherwise NVIDIA's.

| File | Asset folder | Credit |
|---|---|---|
| `src/web/models/v8.glb` | `engineAssembly_v8_engine_a01` | NVIDIA, CC BY 4.0 |
| `src/web/models/turbo.glb` | `engineComponent_turbocompressor_a01` | NVIDIA, CC BY 4.0 |
| `src/web/models/fan.glb` | `climate_shopFan_pedestal_a01` | NVIDIA, CC BY 4.0 |
| `src/web/models/vise.glb` | `equipment_bench_vise_a01` | NVIDIA, CC BY 4.0 |
| `src/web/models/extinguisher.glb` | `fireExtinguisher_abc_a03` | NVIDIA, CC BY 4.0 |

## Sound (Freesound recordings, CC0)

The recordings are CC0 Freesound files, kept in `src/sound/sources/`. Each is cut to a single hit or filtered as noted.

| Use | File | Author | Licence |
|---|---|---|---|
| Row clicks | `click_a_278205_IanStarGem.ogg` | IanStarGem (Freesound 278205) | CC0 |
| Vise grab, Space key (pitched up) | `click_b_397602_Nightflame.ogg` | Nightflame (Freesound 397602) | CC0 |
| Spin button | `switch_a_257958_FillSoko.ogg` | FillSoko (Freesound 257958) | CC0 |
| Drag steps (screw ratchet) | `switch_b_440499_ChrisTutorials.ogg` | ChrisTutorials (Freesound 440499) | CC0 |
| Turbine and fan whir (band-passed, pitched) | `hum_148292_RutgerMuller.ogg` | RutgerMuller (Freesound 148292) | CC0 |

## Code and fonts

- three.js (MIT), vendored in `src/web/vendor`.
- JetBrains Mono Bold (SIL OFL 1.1).
- Studio HDRI `lilienstein_2k.hdr` from Poly Haven (CC0).
