# Plainfield 1957 asset pack

Built by `blender/build_assets.py` (helpers in `blender/geometry.py`) and checked with `blender/preview.py`:

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/build_assets.py -- <project root> [family ...]
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/preview.py -- <project root> [glb ...]
pwsh -File blender/tools/run_map.ps1      # trace the quads into GeoJSON, then verify
uv run --no-project python -I blender/tools/write_assets_md.py <project root>
```

Units are metres. Blender is Z up, +X east, +Y north; the glTF export is Y up, so north is -Z in three.js.
Materials use a dark matte palette plus four emissive materials:
- `window_warm`: warm emissive windows, a separate material.
- `red_glow`: the store outline and the two crime-site light pools, nothing else.
- `police_blue`: the police roof lamp.
- `lamp_warm`: the flood lamp faces.

There are no textures and no text. Back-face culling is on for every material (`doubleSided: false`). Moving parts
are separate nodes whose origin is the pivot. Reference sheets are in `blender/refs/*.md`; previews in
`blender/previews/<glb>.png`; compare sheets in `blender/previews/*-compare.png`.

## GLB files

| File | Size | Where it goes |
|---|---|---|
| `app/public/assets/main_street.glb` | 1.31 MB | Plainfield village scene. Origin = centre of the Main St / North St (WI 73) junction on the 1908 plan; the hardware store sits 37-51 m south of the North St curb, east side. |
| `app/public/assets/farm.glb` | 0.15 MB | Farm scene at 44.1851, -89.5828 (map point only, private land). Origin = farmhouse front centre, front faces south. |
| `app/public/assets/tavern.glb` | 0.06 MB | Pine Grove area marker (lot unknown). Generic; `tavern_light_pool` = crime site, 8 Dec 1954. |
| `app/public/assets/grocery.glb` | 0.05 MB | West Plainfield marker 44.2141, -89.5527 (Hill grocery, lot unknown). Generic. |
| `app/public/assets/cemetery.glb` | 0.10 MB | Plainfield Cemetery 44.2154, -89.5175; Spiritland and Hancock [SEC]. Instance stones and fence segments; no names. |
| `app/public/assets/vehicles.glb` | 0.33 MB | Ford in the farm yard (maroon); pickup behind the store (9:30 am truck, generic); police cars arriving at the farm. Forward = +X. |
| `app/public/assets/lights.glb` | 0.03 MB | Farm night search: generator and flood lamps. Aim `flood_lamp_head` (pivot at the yoke). |
| `app/public/assets/props.glb` | 0.15 MB | Instance everywhere: bare trees, fence segments, utility poles (wire anchors `utility_pole_wire_0..3`). |
| `app/public/assets/people.glb` | 0.15 MB | Solid silhouettes, 1.80 m, facing +X, one material `silhouette`: tint blue (deputies, sheriff), white (Frank Worden), grey (townspeople). |
| `app/public/assets/terrain.glb` | 0.82 MB | County map under the GeoJSON lines. Illustrative relief 0-30 m; exaggerate in the app if wanted. |
| all GLBs | 3.16 MB | the map folder adds 4.46 MB; together well under the 25 MB budget |

## Nodes, pivots and real-world scale

Pivot = node origin in the family frame (metres, Blender axes). Size = world bounding box in metres.

### main_street.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `bank_1923` | main_street | (-15.24, -14.758, 0.0) | (19.3, 10.1, 10.93) | 432 |
| `hardware_store` | main_street | (15.24, -44.124, 0.0) | empty |  |
| `hardware_store_body` | hardware_store | (15.24, -44.124, 0.0) | (16.17, 13.79, 8.9) | 276 |
| `hardware_store_door` | hardware_store | (15.24, -43.574, 0.0) | (0.07, 1.1, 2.28) | 24 |
| `hardware_store_label_anchor` | hardware_store | (23.19, -44.124, 11.0) | empty |  |
| `hardware_store_light_pool` | hardware_store | (22.395, -44.924, 0.0) | (5.2, 5.2, 0.02) | 92 |
| `hardware_store_outline` | hardware_store | (15.24, -44.124, 0.0) | (16.14, 13.79, 8.96) | 144 |
| `hardware_store_rear_door` | hardware_store | (15.24, -43.174, 0.0) | (0.06, 1.9, 2.33) | 12 |
| `hardware_store_rear_lot` | hardware_store | (37.14, -44.124, 0.0) | empty |  |
| `main_street` |  | (0.0, 0.0, 0.0) | empty |  |
| `street_ground` | main_street | (0.0, 0.0, 0.0) | (260.0, 246.79, 0.35) | 96 |

Plus 28 static lot buildings from the 1908 Sanborn sheets: `ne_house_0`, `ne_house_1`, `ne_house_2`, `ne_lot118_tin_shop`, `ne_lot119_implements`, `nn_lot105_general`, `nn_lot106_post_office`, `nn_lot107_shoes`, `nn_lot108_saloon`, `nn_lot109_meat`, `nn_lot112_barber`, `nn_lot113_drugs`, `nn_lot114_saloon`, `nn_lot115_shop`, `nn_walker_block`, `sm_east_house_0`, `sm_east_house_1`, `sm_east_house_2`, `sm_lot604_shed`, `sm_lot605_livery`, `sm_lot609_opera_house`, `sm_lot611_shop`, `sm_lot628_village_hall`, `sm_lot629_bottling`, `sm_lot631_shop`, `sm_lot632_furniture`, `sm_lot633_saloon`, `sm_stark_block`.
Their names carry the 1908 lot numbers (sm = South Main, nn = north side of North St, ne = north-east block).

### farm.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `barn` | farm | (14.0, 26.0, 0.0) | (9.67, 12.9, 10.15) | 128 |
| `farm` |  | (0.0, 0.0, 0.0) | empty |  |
| `farm_label_anchor` | farm | (0.0, 5.0, 14.0) | empty |  |
| `farmhouse` | farm | (0.0, 0.0, 0.0) | empty |  |
| `farmhouse_body` | farmhouse | (0.0, 0.0, 0.0) | (14.38, 12.91, 10.0) | 252 |
| `machine_shed` | farm | (-14.0, 24.0, 0.0) | (9.6, 6.6, 3.37) | 36 |
| `privy` | farm | (-6.0, 30.0, 0.0) | (1.88, 1.9, 2.62) | 96 |
| `pump` | farm | (3.0, 12.0, 0.0) | (1.0, 1.0, 1.41) | 80 |
| `summer_kitchen_door` | farm | (-1.58, 16.5, 0.0) | (0.05, 0.85, 1.98) | 12 |
| `summer_kitchen_shed` | farm | (-2.0, 16.5, 0.0) | (5.5, 4.36, 4.01) | 108 |
| `woodshed` | farm | (6.0, 14.0, 0.0) | (3.6, 4.6, 2.57) | 36 |

### tavern.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `tavern_body` | tavern_generic | (0.0, 0.0, 0.0) | (7.95, 13.8, 7.16) | 176 |
| `tavern_door` | tavern_generic | (-1.606, 0.0, 0.0) | (0.95, 0.05, 2.08) | 12 |
| `tavern_generic` |  | (0.0, 0.0, 0.0) | empty |  |
| `tavern_label_anchor` | tavern_generic | (0.0, 6.0, 9.0) | empty |  |
| `tavern_light_pool` | tavern_generic | (0.5, 4.5, 0.0) | (4.4, 4.4, 0.02) | 92 |
| `tavern_rear_shed` | tavern_generic | (0.0, 12.2, 0.0) | (5.1, 4.6, 3.17) | 36 |

### grocery.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `grocery_body` | grocery_generic | (0.0, 0.0, 0.0) | (8.2, 15.1, 6.82) | 168 |
| `grocery_door` | grocery_generic | (-0.5, 0.0, 0.0) | (1.0, 0.07, 2.18) | 24 |
| `grocery_generic` |  | (0.0, 0.0, 0.0) | empty |  |
| `grocery_label_anchor` | grocery_generic | (0.0, 6.0, 9.824) | empty |  |
| `grocery_side_shed` | grocery_generic | (5.4, 4.0, 0.0) | (6.6, 4.1, 3.17) | 36 |

### cemetery.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `cemetery_fence_segment` | cemetery_props | (0.0, 0.0, 0.0) | (2.47, 0.12, 1.3) | 540 |
| `cemetery_gate` | cemetery_props | (0.0, -4.0, 0.0) | empty |  |
| `cemetery_gate_leaf_left` | cemetery_gate | (-1.5, -4.0, 0.0) | (1.48, 0.05, 1.44) | 168 |
| `cemetery_gate_leaf_right` | cemetery_gate | (1.5, -4.0, 0.0) | (1.48, 0.05, 1.44) | 168 |
| `cemetery_gate_pier_left` | cemetery_gate | (-1.72, -4.0, 0.0) | (0.56, 0.56, 2.13) | 88 |
| `cemetery_gate_pier_right` | cemetery_gate | (1.72, -4.0, 0.0) | (0.56, 0.56, 2.13) | 88 |
| `cemetery_props` |  | (0.0, 0.0, 0.0) | empty |  |
| `stone_flat_marker` | cemetery_props | (7.8, 0.0, 0.0) | (0.6, 0.3, 0.1) | 12 |
| `stone_low_family` | cemetery_props | (9.4, 0.0, 0.0) | (1.42, 0.32, 0.72) | 24 |
| `stone_obelisk` | cemetery_props | (6.2, 0.0, 0.0) | (0.64, 0.64, 1.9) | 46 |
| `stone_slab_round` | cemetery_props | (3.0, 0.0, 0.0) | (0.76, 0.28, 1.05) | 68 |
| `stone_slab_square` | cemetery_props | (4.6, 0.0, 0.0) | (0.66, 0.32, 1.02) | 36 |

### vehicles.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `ford49_body` | ford49_sedan | (0.0, 0.0, 0.0) | (5.36, 1.82, 1.26) | 652 |
| `ford49_door_left` | ford49_sedan | (0.58, 0.911, 0.0) | (1.12, 0.03, 0.61) | 24 |
| `ford49_door_right` | ford49_sedan | (0.58, -0.911, 0.0) | (1.12, 0.03, 0.61) | 24 |
| `ford49_sedan` | vehicles | (0.0, 0.0, 0.0) | empty |  |
| `ford49_wheel_front_left` | ford49_sedan | (1.448, 0.75, 0.35) | (0.7, 0.21, 0.7) | 104 |
| `ford49_wheel_front_right` | ford49_sedan | (1.448, -0.75, 0.35) | (0.7, 0.21, 0.7) | 104 |
| `ford49_wheel_rear_left` | ford49_sedan | (-1.448, 0.75, 0.35) | (0.7, 0.21, 0.7) | 104 |
| `ford49_wheel_rear_right` | ford49_sedan | (-1.448, -0.75, 0.35) | (0.7, 0.21, 0.7) | 104 |
| `pickup_body` | pickup_generic | (0.0, 4.0, 0.0) | (5.04, 1.9, 1.53) | 576 |
| `pickup_door_left` | pickup_generic | (0.6, 4.905, 0.0) | (1.15, 0.02, 0.65) | 12 |
| `pickup_door_right` | pickup_generic | (0.6, 3.095, 0.0) | (1.15, 0.02, 0.65) | 12 |
| `pickup_generic` | vehicles | (0.0, 4.0, 0.0) | empty |  |
| `pickup_tailgate` | pickup_generic | (-2.62, 4.0, 0.72) | (0.04, 1.32, 0.48) | 12 |
| `pickup_wheel_front_left` | pickup_generic | (1.397, 4.79, 0.37) | (0.74, 0.2, 0.74) | 104 |
| `pickup_wheel_front_right` | pickup_generic | (1.397, 3.21, 0.37) | (0.74, 0.19, 0.74) | 104 |
| `pickup_wheel_rear_left` | pickup_generic | (-1.397, 4.79, 0.37) | (0.74, 0.2, 0.74) | 104 |
| `pickup_wheel_rear_right` | pickup_generic | (-1.397, 3.21, 0.37) | (0.74, 0.19, 0.74) | 104 |
| `police_car_body` | police_car_generic | (0.0, -4.0, 0.0) | (5.36, 1.93, 1.28) | 580 |
| `police_car_door_front_left` | police_car_generic | (0.72, -3.032, 0.0) | (1.1, 0.02, 0.58) | 12 |
| `police_car_door_front_right` | police_car_generic | (0.72, -4.968, 0.0) | (1.1, 0.02, 0.58) | 12 |
| `police_car_door_rear_left` | police_car_generic | (-0.42, -3.032, 0.0) | (1.0, 0.02, 0.58) | 12 |
| `police_car_door_rear_right` | police_car_generic | (-0.42, -4.968, 0.0) | (1.0, 0.02, 0.58) | 12 |
| `police_car_generic` | vehicles | (0.0, -4.0, 0.0) | empty |  |
| `police_car_roof_lamp` | police_car_generic | (-0.35, -4.0, 1.6) | (0.19, 0.2, 0.21) | 116 |
| `police_car_wheel_front_left` | police_car_generic | (1.467, -3.2, 0.35) | (0.7, 0.2, 0.7) | 104 |
| `police_car_wheel_front_right` | police_car_generic | (1.467, -4.8, 0.35) | (0.7, 0.2, 0.7) | 104 |
| `police_car_wheel_rear_left` | police_car_generic | (-1.467, -3.2, 0.35) | (0.7, 0.2, 0.7) | 104 |
| `police_car_wheel_rear_right` | police_car_generic | (-1.467, -4.8, 0.35) | (0.7, 0.2, 0.7) | 104 |
| `vehicles` |  | (0.0, 0.0, 0.0) | empty |  |

### lights.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `flood_lamp` | lights | (2.0, 0.0, 0.0) | empty |  |
| `flood_lamp_head` | flood_lamp | (2.0, 0.0, 2.5) | (0.24, 0.42, 0.34) | 100 |
| `flood_lamp_stand` | flood_lamp | (2.0, 0.0, 0.0) | (1.08, 1.24, 2.38) | 80 |
| `generator` | lights | (0.0, 0.0, 0.0) | (1.5, 0.8, 1.05) | 136 |
| `lights` |  | (0.0, 0.0, 0.0) | empty |  |

### props.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `board_fence_segment` | props | (5.0, 6.0, 0.0) | (2.55, 0.13, 1.3) | 60 |
| `farm_wire_fence_segment` | props | (0.0, 6.0, 0.0) | (3.1, 0.12, 1.25) | 76 |
| `props` |  | (0.0, 0.0, 0.0) | empty |  |
| `tree_bare_elm` | props | (0.0, 0.0, 0.0) | (5.58, 3.53, 14.84) | 820 |
| `tree_bare_oak` | props | (10.0, 0.0, 0.0) | (5.94, 4.76, 12.2) | 820 |
| `tree_bare_small` | props | (18.0, 0.0, 0.0) | (2.74, 2.0, 6.56) | 820 |
| `utility_pole` | props | (25.0, 0.0, 0.0) | empty |  |
| `utility_pole_body` | utility_pole | (25.0, 0.0, 0.0) | (2.4, 0.3, 9.1) | 144 |
| `utility_pole_wire_0` | utility_pole | (23.95, 0.0, 8.78) | empty |  |
| `utility_pole_wire_1` | utility_pole | (24.55, 0.0, 8.78) | empty |  |
| `utility_pole_wire_2` | utility_pole | (25.45, 0.0, 8.78) | empty |  |
| `utility_pole_wire_3` | utility_pole | (26.05, 0.0, 8.78) | empty |  |

### people.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `man_entering_doorway` | people | (0.0, 4.8, 0.0) | (1.13, 0.55, 1.78) | 368 |
| `people` |  | (0.0, 0.0, 0.0) | empty |  |
| `police_flashlight` | people | (0.0, 1.2, 0.0) | (0.94, 0.55, 1.8) | 380 |
| `police_hands_on_hips` | people | (0.0, 3.6, 0.0) | (0.39, 0.8, 1.8) | 360 |
| `police_standing` | people | (0.0, 0.0, 0.0) | (0.39, 0.55, 1.8) | 360 |
| `police_walking` | people | (0.0, 2.4, 0.0) | (0.91, 0.55, 1.78) | 360 |
| `townsperson_pointing` | people | (0.0, 8.4, 0.0) | (0.75, 0.55, 1.82) | 368 |
| `townsperson_standing` | people | (0.0, 6.0, 0.0) | (0.44, 0.55, 1.82) | 368 |
| `townsperson_walking` | people | (0.0, 7.2, 0.0) | (0.91, 0.55, 1.81) | 368 |

### terrain.glb

| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |
|---|---|---|---|---|
| `terrain` |  | (0.0, 0.0, 0.0) | (39869.37, 55566.0, 29.99) | 45056 |

Moving parts and their pivots:
- Car doors hinge at their front edge; wheels spin about their centre (axis Y).
- `pickup_tailgate` hinges at the bed floor.
- `hardware_store_door` and `hardware_store_rear_door` hinge at their left edge.
- `cemetery_gate_leaf_*` hinge at the piers.
- `flood_lamp_head` pivots at the yoke, 2.5 m up; `police_car_roof_lamp` at its base.

Anchors (empties): `hardware_store_label_anchor`, `hardware_store_rear_lot` (where the truck stood), `farm_label_anchor`,
`tavern_label_anchor`, `grocery_label_anchor` and `utility_pole_wire_*`.

## Map files (`app/public/assets/map/`, WGS84 lon/lat, EPSG:4326)

Extent: west -89.75, south 44.00, east -89.25, north 44.50. This covers the four 15-minute quads: Coloma 1958 (SW),
Whiting 1957 (NW), Amherst 1957 (NE) and Wautoma 1959 (SE). Waupun and Madison lie outside it; `places.geojson` still
lists them as off-map points.

| File | Content |
|---|---|
| `roads.geojson` (3.33 MB) | LineStrings; `class` is highway (red-filled US and state routes) or road. Village streets keep both casings, like the period map. |
| `section_lines.geojson` (0.00 MB) | Dashed PLSS section lines and red township lines where no road runs on them (`class` section or township). Sparse; see Gaps. |
| `water_areas.geojson` (0.04 MB) | Lake and river polygons (`area_m2`). |
| `streams.geojson` (0.09 MB) | Stream centrelines. |
| `blocks.geojson` (0.00 MB) | Village block polygons from road faces. Few; see Gaps. |
| `buildings.geojson` (0.47 MB) | Building dots from the quads (points). |
| `places.geojson` (0.00 MB) | Fact-file points with their `confidence` marks. The farm is a map point only. |
| `heightmap.png` (0.52 MB) | 16-bit relief for terrain.glb. Illustrative, not measured. |
| `extent.json` (0.00 MB) | Extent and notes. |

Georeferencing: each GeoPDF's LGIDict gives a polyconic projection on NAD27 (Clarke 1866) and a page-to-metres
matrix. `blender/tools/quadgeo.py` projects a lon/lat grid forward and fits a cubic polynomial from pixels to lon/lat
(fit error under 1e-9 degrees). NAD27 is written as WGS84 without a datum shift. Here that shift is a few metres
(inferred), inside the residuals below.

terrain.glb uses a local frame with the store point as origin: x = (lon + 89.49233) * 79,724 m and
y = (lat - 44.21349) * 111,132 m.

### Trace check against the fact file (measured; sheet `blender/previews/map-verify.png`)

| Place | Quad | Nearest traced road | What the scan shows at the point |
|---|---|---|---|
| Worden Hardware | wautoma | 2.6 m | on Main St (US 51) just south of the WI 73 junction, inside the village grid |
| Gein farm (map point only) | coloma | 9.4 m | exactly on a road crossing (2nd Ave / Archer Ave today) |
| West Plainfield | coloma | 2.9 m | on the hamlet crossroads with its building dots |
| Town of Pine Grove (tavern area, lot unknown) | whiting | 145.1 m | open farmland beside a section road (area centroid, as expected) |
| Plainfield Cemetery | coloma | 163.4 m | inside the dashed cemetery box labelled Plainfield Cem, set back north of WI 73 |
| Spiritland Cemetery | amherst | 18.1 m | beside the Spiritland Cem label on the road by Washburn Lake |
| Hancock Cemetery | coloma | 57.2 m | next to the Hancock Cem cross symbol |
| Waushara County Courthouse, Wautoma | wautoma | 47.7 m | in the Wautoma downtown grid, one block from the main street |

Every point falls on the right road, crossing, cemetery or village in the scan, so the georeference error is within
one road width (about 10-20 m). The distances above 50 m belong to cemeteries and an area centroid that sit back from
the road; they are not georeference error.

## Gaps

- Terrain: the 1957-59 quads are planimetric (no contours), and no elevation download was approved. The relief is
  therefore illustrative, shaped by the traced water. Real relief needs USGS 3DEP or AWS terrain tiles, which needs
  An's yes first.
- Section lines and village blocks are sparse: the dash detector and the road-face polygonize miss many. Roads, water
  and buildings carry the map, and the app can draw the PLSS grid from its 1-mile spacing if needed.
- A few letters of large place names survive in roads.geojson as short squiggles, for example at the Plainfield label.
- The approved downloads include no farmhouse, tavern, grocery or cemetery photos. Those models follow Sanborn
  footprints and period types only. The police car has one reference image; the Ford has no side or rear view.
- Store placement: the 1908 hardware store is lot 630. The 1957 building and its use are not documented, so the
  placement is inferred.
- Car heights and tyre sizes are estimated from the photos. Lengths, widths and wheelbases come from one cited
  source each.
