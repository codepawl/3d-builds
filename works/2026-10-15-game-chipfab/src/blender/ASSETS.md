# Waferline asset pack (pass 1)

Eight GLBs in `app/public/assets/`, 13.1 MB in total, about 420k triangles. Every model is procedural
(Blender 5.2 scripts in this folder), original, and carries no real brand or logo.

## Conventions

- Units are metres at real-world scale. In three.js space x is to the side, y is up and z (+forward) is the front.
  Every root faces +z and stands on y = 0, centred on its own origin unless a row below says otherwise.
- One root node per asset or variant. Load each GLB once and clone a root per instance.
- Moving parts are separate child nodes. Each has its origin at its pivot, so rotating or translating the node is enough.
- Anchors are empty nodes, named in the tables, that mark where pods sit or attach.
- Shared material names, kept stable across files so the app can find them:
  - `shell` `#eef1f5`, `panel` `#d9dfe7`, `trim` `#3a4250`, `steel` (metallic), `brand` `#13a594` (the one brand colour), `rubber`.
  - `glass`: alpha 0.35, BLEND. Tool and stocker interiors read through it.
  - Glow materials for bloom: `glow_screen` (cyan HMI screens), `glow_litho` (yellow litho light), `glow_lamp`
    (white lamps), `glow_amber`, `glow_red`.
  - `status`: the tool-state lamp (default green emissive). Set its colour and emissive per tool from the state:
    running, idle, down, maintenance. Clone the material per tool.
  - `suit_accent` on people: gloves, boots, badge and visor frame. Recolour it per role.
  - Pod colours: `pod_#c9d3df` and similar (shell) and `pod_<band colour>` (emissive band).
- Rebuild one family with `pwsh blender/run.ps1 -Script blender/<script>.py`. The runner waits while any other blender.exe is
  running and runs Blender at below-normal priority. Contact sheets come from `blender/preview.py` (all GLBs, or the paths
  given after `-ScriptArgs`). Node lists come from `uv run --no-project python blender/inspect_glb.py`.

## tools.glb (5.9 MB): process tools on the cleanroom floor, script `tools.py`

Every tool root `tool_<kind>_<variant>` has these children:

| Child | Meaning |
| --- | --- |
| `_body` | the static shell |
| `_status` | signal-tower lamp, material `status`; pivot at the tower foot |
| `_portN` | anchor on load port N: a pod's origin (its bottom centre) goes here, y = 0.92 |
| `_portN_door` | pod door opener, pivot at its bottom hinge; rotate about x (about -1.4 rad) to open |

Ports always sit on the +z front, which is where the OHT lowers pods. Run the rails over the port line, not over the tool
bodies: the tallest tools (litho_b, the furnaces) reach about 3.9-4.2 m. Sizes are width x height x depth in metres, rounded;
some are estimates, and the exact bounding box of each root is printed under it in `previews/tools.png`.

| Root | Size | Extra moving parts | Notes |
| --- | --- | --- | --- |
| `tool_litho_a` | 3.2 x 2.9 x 7.4 | none | scanner with coater/developer track; yellow stage window; 2 ports |
| `tool_litho_b` | 5.9 x 3.6 x 9.6 | none | larger generation with a light-source module on its -x side; 3 ports |
| `tool_etch_a`, `tool_etch_b` | 5.8 x 2.2 x 6.2, 5.2 x 2.2 x 5.8 | `_robot` | 4 or 3 chambers with RF match boxes; `_robot` turns about y at the hub centre (0, 1.25, -2.9) under the glass lid |
| `tool_dep_a`, `tool_dep_b` | about the same as etch | `_robot` | domed chambers with gas lines |
| `tool_implant_a` | 3.3 x 3.1 x 8.9 | none | end station, beamline, analyser magnet, high-voltage terminal |
| `tool_furnace_a`, `tool_furnace_b` | 3.4 x 4.2 x 4.2, 2.0 x 4.2 x 4.1 | none | vertical furnace towers; pods visible on shelves behind the front window |
| `tool_cmp_a`, `tool_cmp_b` | 4.4 x 2.1 x 4.7, 3.1 x 2.1 x 4.7 | `_platenN`, `_headN` | both spin about y at the platen centre; open deck behind a glass rim |
| `tool_metro_a` | 1.7 x 2.7 x 2.0 | none | metrology tool with measuring column; 1 port |
| `tool_metro_b` | 2.5 x 2.5 x 2.0 | none | optical inspection tool with dome; 2 ports |
| `tool_wet_a`, `tool_wet_b` | 5.6 x 3.3 x 2.4, 4.6 x 3.3 x 2.4 | `_gantry` | tanks along x; `_gantry` slides along x (its pivot is on the rail; the travel is about the tank row, +-1.5 m) |

## oht.glb (1.8 MB): overhead hoist transport and pods, script `transport.py`

| Root | Size | Children and pivots | Where it goes |
| --- | --- | --- | --- |
| `oht_a`, `oht_b`, `oht_c` | 0.54 x 1.0 x 0.93 | `_shell`, `_wheel0-3` (spin about x), `_hoist` (gripper: translate down along -y from its pivot at the body floor), `_belts` (same pivot: scale y with the drop), `_hoist_pod` (anchor under the hoist where the carried pod's origin goes) | Origin on the rail running surface: put the root at the rail height (about 3.8 m above the floor) and the body hangs below. A carried pod's bottom hangs 1.05 m below the rail, so at a 3.8 m rail lowering it to a load port seat at 0.92 m is a hoist drop of about 1.85 m. `oht_c` is the dark maintenance vehicle with an amber beacon. |
| `rail_straight` | 0.32 x 1.0 x 4.0 | one mesh | 4 m tile along z; hangers rise to y = 1 (the ceiling) |
| `rail_curve` | 2.1 x 1.0 x 2.1 | one mesh | quarter circle, radius 2, from the tile's south edge (0, -2) heading +z to its east edge (2, 0) heading +x; rotate in 90 degree steps |
| `rail_junction` | 2.2 x 1.0 x 4.0 | one mesh | straight plus a curve branching east, with a teal switch box |
| `foup_std`, `foup_hot`, `foup_eng`, `foup_mon` | 0.44 x 0.36 x 0.35 | `_body`, `_door` (pivot at its bottom front edge, rotates about x) | Wafer pods. The band colour marks the lot: grey for standard, orange-red emissive for hot lots, violet for engineering, teal for monitor. |

## stocker.glb (1.1 MB): pod stockers, script `transport.py`

| Root | Size | Children |
| --- | --- | --- |
| `stocker_a` (4 bays), `stocker_b` (8 bays) | 5.0 x 3.3 x 2.9, 9.0 x 3.3 x 2.9 | `_body`; `_crane` (mast and fork, slides along x behind the glass, pivot at its foot); `_port0-1` and `_port0-1_door` (manual load ports at the -x front); `_oht0-1` (roof anchors where the OHT drops pods, y = 3.33) |

## cleanroom.glb (0.7 MB): bay shell kit on a 6 m grid, script `cleanroom.py`

The roof is cut away. Walls stop at 4.2 m with a coloured section cap (teal, or yellow on litho walls).

| Root | Size | Notes |
| --- | --- | --- |
| `floor_a`, `floor_aisle`, `floor_litho` | 6 x 0.12 x 6 | raised floor of 0.6 m tiles with perforated tiles, top at y = 0. `floor_aisle` has yellow aisle lines along z; `floor_litho` is warm-tinted with a yellow glow trim. |
| `wall_a`, `wall_litho` | 6 x 4.26 x 0.25 | along x, centred; window band at 1.1-2.5 m (amber filtered glass on the litho wall) |
| `wall_door` | 6 x 4.26 x 0.26 | 1.6 m opening; `_doorL` and `_doorR` slide outward along x from their pivots at the opening centre |
| `column_a` | 0.7 x 4.26 x 0.7 | with an amber foot guard |
| `airshower_a` | 1.46 x 2.6 x 1.72 | walk-through along z; `_doorF` and `_doorB` swing about y at the -x hinge |
| `cart_terminal` | 0.6 x 1.48 x 0.5 | engineer terminal cart; `_wheel0-3` spin about x |
| `sign_bay` | 0.9 x 3.1 x 0.4 | bay number sign on a post |

## subfab.glb (0.6 MB): utility floor under the cleanroom, script `cleanroom.py`

| Root | Size | Notes |
| --- | --- | --- |
| `slab_waffle` | 6.2 x 0.6 x 6.2 | the cleanroom floor seen from below, top at y = 0; hang it at the cleanroom floor level |
| `pump_a`, `pump_b` | 0.64 x 1.65 x 1.4 and 1.8 | dry vacuum pumps with status lamp |
| `chiller_a` | 2.4 x 1.7 x 1.8 | `_fan0-1` spin about y |
| `gascab_a` | 1.0 x 2.5 x 0.64 | gas cabinet with bottles behind glass |
| `scrubber_a` | 1.5 x 2.9 x 1.3 | exhaust abatement |
| `piperack_a` | 1.5 x 2.5 x 6.0 | colour-coded process lines along z; tile end to end |

## campus.glb (2.2 MB): exterior site, script `campus.py`

Real-world size. The campus map can use these as they are; next to bay-scale assets they are about 15-30 times larger.

| Root | Size | Moving parts | Notes |
| --- | --- | --- | --- |
| `bldg_fab_main` | 80 x 29 x 64 | none | 300 mm fab with rooftop air handlers and exhaust stacks, front support spine, entrance canopy, sign plate |
| `bldg_fab_ramp` | 101 x 48 x 66 | `_crane_jib` (turns about y at the mast top) | second fab under ramp-up: half-fitted roof, scaffold, tower crane on its +x side |
| `bldg_packaging` | 50 x 12.5 x 37 | none | advanced packaging plant with 4 loading docks on the front and skylights |
| `bldg_upw` | 27 x 9.6 x 20 | none | ultra-pure water hall, 4 storage tanks, membrane skids |
| `gas_yard` | 30 x 12.8 x 20 | none | cryogenic tanks, horizontal tanks, vaporisers, fenced pad |
| `cooling_tower` | 18.6 x 7.5 x 8.6 | `_fan0-2` (spin about y) | three-cell tower |
| `substation` | 24 x 9.3 x 16 | none | 3 transformers, gantry, fence |
| `bldg_admin` | 30 x 15.6 x 15 | none | office block with glazed ribbons |
| `tree_a`, `tree_b`, `lamp_post` | 3.3 x 5.4, 2.9 x 5.7, 6 m tall | none | scatter props |

## trucks.glb (0.7 MB): road vehicles, script `campus.py`

| Root | Size | Notes |
| --- | --- | --- |
| `truck_tube` | 2.7 x 3.6 x 12.3 | bulk gas tube trailer; `_wheel0-5` spin about x |
| `truck_box` | 2.7 x 3.9 x 7.3 | box truck with a teal cab |
| `van_service` | 2.1 x 2.3 x 5.6 | service van with a roof ladder and amber beacon |

## people.glb (0.4 MB): bunny-suit people with clips, script `people.py`

| Root | Size | Clips |
| --- | --- | --- |
| `person_engineer` | 0.62 x 1.78 x 0.45 | `person_engineer_idle` (2 s), `_walk` (1 s loop, about 1.3 m/s stride), `_work` (2 s, tapping a tool screen) |
| `person_technician` | 0.62 x 1.78 x 0.45 | the same three as `person_technician_*`, plus `person_technician_carry` (1 s walk holding a pod at chest height) |

Each person root holds `<root>_rig`, an armature with the bones `hips`, `spine`, `head`, `upper_arm.L/R`, `forearm.L/R`,
`thigh.L/R` and `shin.L/R`. The body parts are rigid meshes parented to their bones, so there is no skinning. Play the
clips with an AnimationMixer on a clone made with `SkeletonUtils.clone`. The engineer holds a tablet in the right hand;
the technician wears a respirator pack and a tool belt and holds a wrench.

## Not in this pass

- No baked textures. Panels, vents, seams and floor tiles are geometry and flat PBR colour.
- No real text on signs. The sign plates carry a blank white label strip, which the app can overlay with a decal or an HTML label.
- People are rigid-limb rigs, not skinned: chunky and readable at strategy-game distance, but not for close-ups.
