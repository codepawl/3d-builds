---
license: cc-by-4.0
pretty_name: SimReady GLB
tags:
- 3d
- gltf
- glb
- web
- three.js
- simready
- nvidia
size_categories:
- 1K<n<10K
configs:
- config_name: default
  data_files:
  - split: train
    path:
    - "thumbs/*.webp"
    - "thumbs/metadata.jsonl"
---

# SimReady GLB

![A grid of SimReady models rendered from this dataset](assets/hero.webp)

**[Open the 3D viewer](https://huggingface.co/spaces/codepawl/simready-glb-viewer)** to search all {{assets}} models and
orbit any of them in the browser.

Web-ready glTF binary (`.glb`) copies of the 3D models in
[nvidia/simready-assets](https://huggingface.co/datasets/nvidia/simready-assets). Each file loads directly in
three.js, Babylon.js, model-viewer or any glTF 2.0 viewer.

Models by NVIDIA SimReady, licensed CC BY 4.0. This dataset converts and compresses them. It does not change what
they show. If you use these files, credit NVIDIA as the original author and link the source dataset.

| | Blender export | This dataset |
|---|---|---|
| Assets | {{assets}} | {{assets}} |
| Total size | {{blenderSize}} | {{optimizedSize}} |
| Triangles | {{blenderTriangles}} | {{optimizedTriangles}} |
| Largest texture edge | 4096 px | 1024 px |

Example: the V8 engine (`engineAssembly_v8_engine_a01`) is an {{v8BlenderSize}} glb out of Blender and
{{v8OptimizedSize}} here. Its first frame in Chrome took 9.4 s before and 0.57 s after.

## What is in it

- `glb/<asset>.glb`: one file per SimReady asset folder, named like the folder in the source dataset.
- `thumbs/<asset>.webp`: a 512 px render of each glb, with `thumbs/metadata.jsonl` holding its category, size,
  triangles and draw calls. The Dataset Viewer above shows this table.
- `manifest.jsonl`: one line per asset with size, triangles, draw calls and textures before and after optimization.

## Download

All files, about {{optimizedSize}}:

```bash
hf download codepawl/simready-glb --repo-type dataset --local-dir simready-glb
```

One category, for example every food model:

```bash
hf download codepawl/simready-glb --repo-type dataset --include "glb/food_*" --local-dir simready-glb
```

One file from Python:

```python
from huggingface_hub import hf_hub_download

path = hf_hub_download("codepawl/simready-glb", "glb/engineAssembly_v8_engine_a01.glb", repo_type="dataset")
```

## Loading in three.js

The geometry uses `EXT_meshopt_compression` and the textures use `EXT_texture_webp`, so set the meshopt decoder:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('engineAssembly_v8_engine_a01.glb', (gltf) => scene.add(gltf.scene));
```

## Physics and moving parts

{{physicsAssets}} files carry the rigid bodies, mass and physics materials of their SimReady USD. {{jointAssets}} of
them also carry joints, {{jointCount}} in all: door hinges, drawer slides, buttons, wheels and lids. Each file holds
this data in two forms:

- `KHR_physics_rigid_bodies`, the Khronos glTF physics extension. Each part has a `motion` with its mass, center of
  mass and inertia. Each mesh has a convex hull `collider` with friction and restitution. Each joint has its limits.
  Loaders that do not read the extension ignore it.
- Plain node extras, which three.js puts in `object.userData`. A moving part has
  `joints: [{ type, parent, pivot, axis, min, max, unit }]`, with the pivot and axis in model space at rest.
  Revolute limits are in degrees and prismatic limits are in meters. Parts also have `mass` in kg and `density` in
  kg/m³.

Open a door or a drawer in three.js from its rest pose (the part's parent is at the model origin):

```js
import * as THREE from 'three';

function movePart(part, value) {
  const { type, pivot, axis } = part.userData.joints[0];
  const direction = new THREE.Vector3(...axis);
  if (type === 'prismatic') {
    part.position.addScaledVector(direction, value);
    return;
  }
  const turn = new THREE.Quaternion().setFromAxisAngle(direction, THREE.MathUtils.degToRad(value));
  const center = new THREE.Vector3(...pivot);
  part.position.sub(center).applyQuaternion(turn).add(center);
  part.quaternion.premultiply(turn);
}

movePart(gltf.scene.getObjectByName('door_01_obj_00'), 90);
```

The 3D viewer shows a slider for each moving part. The files from before the physics data are kept at the `v1` tag:
add `--revision v1` to the download command.

## How the files were made

1. Download `simready_usd/` from each asset folder. `source_assets/` is skipped because it holds a second copy of
   the textures for MDL shaders.
2. Check that `.metadata/LICENSE.txt` is CC BY 4.0.
3. Import the USD in Blender 5.2 and remove the collision, proxy and grasp helper prims. Export a glb with the
   original textures.
4. Optimize with glTF Transform 4.5. Remove the USD instance prototypes Blender brings in next to the placed parts,
   remove duplicate mesh instances, then dedup, prune and weld.
5. Resize textures to 1024 px as WebP. Compress geometry with meshopt at its high level
   (`EXT_meshopt_compression` with octahedral normals and quantized attributes).
6. Read the rigid bodies, mass, physics materials and joints from the USD layers and write them into the glb JSON.
   The USD is Z-up, so joint frames and axes are turned to the glb's Y-up.

Assets with UDIM textures have each tile split into its own material before the export, with its UVs moved into 0-1.
Blender's own UDIM handling in the glTF exporter drops the faces of some tiles.

No mesh simplification is applied. The triangle drop comes from removed duplicates and helper geometry.

The conversion scripts are in
[codepawl/3d-builds](https://github.com/codepawl/3d-builds/tree/main/works/2026-10-28-simready-showcase/batch).

## Known gaps

SimReady collides with signed distance fields built from each render mesh. The glbs use the convex hull of each
mesh instead, which every engine can build, so hollow parts such as a cabinet body or a basket collide as if filled.
`KHR_physics_rigid_bodies` is still a Khronos review draft, so check that your engine reads it; the node extras work
with any loader. Joint drives and USD simulation settings are not carried over. Materials are converted to glTF PBR,
so MDL-only shader effects are lost.

Two joints in the USD are left out because they hold nothing: the fixed joint of
`ladder_multiPurpose_aluminium_a05` points at a part with no rigid body, and one fixed joint of
`serviceTool_brakeCaliper_pistonWindBackKit_a01` joins a body to itself.

## Changelog

- 2026-10-29: Added physics from the USD files: rigid bodies, mass, physics materials and {{jointCount}} joints, as
  `KHR_physics_rigid_bodies` and as node extras. The viewer shows a slider for each moving part. The files before this
  change are at the `v1` tag.
- 2026-10-29: Geometry is encoded at meshopt's high level. The set went from 4.0 GB to {{optimizedSize}} with the same
  triangles and no visible change in any of the 2,595 thumbnails.
- 2026-10-29: {{udimCount}} files with UDIM textures were missing geometry, because Blender's glTF exporter dropped
  the faces of some texture tiles (for example crate_plywood_b01 kept only its metal frame). They are exported again
  with the tiles split before the export.
- 2026-10-29: 1,305 files carried a second copy of some parts at the origin, the USD instance prototypes
  Blender imports next to the placed parts (for example the eyeglasses showed two pairs of arms). Those copies are
  removed. Added thumbnails, the Dataset Viewer table and the 3D viewer Space.
- 2026-10-28: first release.
