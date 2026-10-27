# ATC world asset pack

Every asset is modelled procedurally in Blender 5.2 by the scripts in this folder and exported to
`app/public/assets/` as one GLB per family, so repeats can be instanced. All designs are original:
no real airline, airport, livery, logo or chart. Total size about 9.8 MB.

## Conventions

- Units are metres. Models face +z, sit on y = 0 and are centred on x = 0 (three.js space).
- The world is compressed so the map reads at strategy-game zoom: an airliner is 15-24 m long
  (about half of a real one, with a chunkier fuselage), buildings are about half size, and the
  vehicles are modelled at real size with a 0.6 scale on their root node. Weather is nominal
  (a storm cell about 60 m wide) and is scaled by the app to its radius. Birds are real size and
  the app scales flocks up.
- Each top-level node is one asset or variant. Its static geometry is merged into `<name>_body`;
  every moving or glowing part is its own child node named `<name>_<part>` with its origin at the
  pivot (positions below are local, as (x, up, forward)).
- Materials: `livery` and `livery_accent` (aircraft) are recoloured per made-up airline; `brand`
  (#ff6b3d) is the app's one strong colour; any material starting with `glow_` is emissive and
  meant for bloom (`glow_window` can be dimmed by day). Wheels share one vertex-coloured `wheel`
  material. Every mesh has smart-projected UVs; there are no image textures yet.
- Shading: smooth with sharp edges above 40 degrees, bevel modifiers baked in.

## Families and where they go

| File | Assets | Real-world scale | Where it goes |
| --- | --- | --- | --- |
| `aircraft.glb` (4.4 MB) | `jet_a` twinjet, `jet_b` stretched twinjet with winglets, `jet_c` regional rear-engine T-tail, `jet_d` widebody, `prop_a` high-wing turboprop, `prop_b` commuter turboprop | 10-24 m long, 12-21 m span | every flight; type chosen from the flight's type code, livery per airline |
| `airport_buildings.glb` (1.8 MB) | `tower_main`, `tower_small`, `terminal_main`, `terminal_pier`, `hangar_a`, `hangar_b`, `fire_station`, `radar_asr`, `radar_weather`, `fuel_farm` | tower 28 m, terminal 42 m | the airport site; `radar_asr` antenna drives the radar-sweep light |
| `airport_props.glb` (1.1 MB) | `localizer`, `glideslope`, `approach_lights`, `papi`, `windsock`, `sign_runway`, `sign_taxi`, `edge_light_blue`, `edge_light_white`, `follow_me`, `fire_truck`, `tug` | 0.6-24 m | runway ends (localizer past the far end, glideslope and PAPI beside the touchdown zone, approach lights before the threshold), taxiway edges, apron vehicles |
| `nav.glb` (0.5 MB) | `fix_pylon`, `fix_pylon_tall`, `holding_marker`, `vor_station`, `ndb_station` | 5-12 m | waypoints and fixes on the map; holding fix of the stack; navaids at route junctions |
| `town.glb` (0.9 MB) | `house_a`, `house_b`, `house_c`, `apartment_a`, `apartment_b`, `church`, `factory`, `warehouse`, `water_tower` | houses 5 m, blocks 9-14 m | towns on the terrain |
| `nature.glb` (0.3 MB) | `tree_conifer_a/b`, `tree_round_a/b`, `bush`, `rock_a/b`, `lighthouse`, `boat_fishing`, `boat_sail` | trees 5-8.5 m | hills, coastline, sea; rocks and bush sink slightly into the ground, boat hulls sit with the waterline at y = 0 |
| `weather.glb` (0.7 MB) | `storm_cell_a`, `storm_cell_b`, `cloud_a`, `cloud_b`, `cloud_c` | nominal, scaled by the app | the drifting weather cell and scattered cloud at altitude |
| `birds.glb` (0.2 MB) | `bird_gull`, `bird_swift` (skinned, with armatures) | 1.4 m and 0.9 m span | flocks over the coast and near the runways (bird-strike hazard) |

## Moving parts

- Aircraft: `<v>_fan_left/right` or `<v>_prop_left/right` spin about z; `<v>_gear_nose`,
  `<v>_gear_main_left/right` are empties pivoting at the top of the leg (rotate about x to
  retract), with `_strut` and `_wheel_l/_wheel_r` (spin about x) under them; `<v>_nav_left` (red,
  left = +x), `<v>_nav_right` (green), `<v>_beacon_top/bottom` (red), `<v>_strobe` and
  `<v>_landing_light` (white) blink. Empties: `<v>_trail_left/right` (exhausts, or wingtips on the
  turboprops) start the history line; `<v>_label` holds the data tag; `<v>_fin` the fin mark.
- Buildings: `radar_asr_antenna` spins about y; `hangar_*_door_left/right` slide along x (pivot
  bottom centre); `fire_station_door0..2` roll up (pivot at the top edge); beacons and lamps glow;
  `tower_main_cab_view` marks the cab for a camera; `*_label` empties pin names.
- Props: `approach_lights_bar0..4` (0 nearest the threshold) for the sequenced flash;
  `papi_lens0..3` are recoloured red or white by glide path; `windsock_sock` swings about y and
  droops about z at the mast top; `fire_truck_turret` turns about y; vehicle wheels
  `<v>_wheel_*` spin about x; `sign_*_text` anchors the sign legend the app draws.
- Nav: `<v>_ring` glow torus to pulse or recolour when a flight is cleared to the fix
  (`fix_pylon_tall_ring1` is its second ring); `vor_station_sweep` spins about y; `<v>_tip` and
  `ndb_station_tip_left/right` are red obstacle lights; `<v>_label` pins the fix name.
- World: `lighthouse_lamp` spins about y; `church_light` and `water_tower_light` are obstacle
  lights; `factory_smoke` anchors a smoke plume; `storm_cell_*_lightning0/1` are glow bolts to flash
  and `storm_cell_*_core` the rain shaft.
- Birds: bones `<v>_body` (root), `<v>_head`, `<v>_tail`, `<v>_wing_l`, `<v>_tip_l`, `<v>_wing_r`,
  `<v>_tip_r`. Clips `<v>_flap` (one wingbeat: 0.5 s gull, 0.25 s swift; loop) and `<v>_glide`
  (2 s loop), 24 fps.

## Scripts

- `lib.py` shared helpers (adapted from the Groundline pack; `cut_loft` fixed so skin patches are
  really trimmed, plus `torus`, `rod`, a `front` plane for `slab` and parent-relative origins).
- `aircraft.py`, `airport.py`, `nav.py`, `world.py`, `birds.py` build the families.
- `run.ps1 <script> [-ScriptArgs ...]` runs Blender headless at below-normal priority once no other
  blender.exe is running.
- `preview.py -- <glb> <png> [node prefix]` renders the contact sheets in `previews/` (three angles,
  back-face culling, Workbench) and prints each node's size; `inventory.py -- <md>` lists the nodes
  below; `probe.py` was the diagnostic used for the windshield fix.

## Node inventory (generated by inventory.py)

### aircraft.glb (4367 KB)

- **`jet_a`**
  - `jet_a_beacon_bottom` mesh at (0.00, 0.52, 0.10)
  - `jet_a_beacon_top` mesh at (0.00, 3.21, 0.10)
  - `jet_a_body` mesh at (0.00, 0.00, -0.00)
  - `jet_a_fan_left` mesh at (2.69, 0.70, 2.58)
  - `jet_a_fan_right` mesh at (-2.69, 0.70, 2.58)
  - `jet_a_fin` empty at (0.16, 4.43, -6.80)
  - `jet_a_gear_main_left` empty at (1.31, 1.04, -0.40)
    - `jet_a_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_a_gear_main_left_wheel_l` mesh at (0.26, -0.68, -0.00)
    - `jet_a_gear_main_left_wheel_r` mesh at (-0.26, -0.68, -0.00)
  - `jet_a_gear_main_right` empty at (-1.31, 1.04, -0.40)
    - `jet_a_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_a_gear_main_right_wheel_l` mesh at (0.26, -0.68, -0.00)
    - `jet_a_gear_main_right_wheel_r` mesh at (-0.26, -0.68, -0.00)
  - `jet_a_gear_nose` empty at (0.00, 0.81, 5.70)
    - `jet_a_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_a_gear_nose_wheel_l` mesh at (0.18, -0.55, -0.00)
    - `jet_a_gear_nose_wheel_r` mesh at (-0.18, -0.55, -0.00)
  - `jet_a_label` empty at (0.00, 4.65, -0.00)
  - `jet_a_landing_light` mesh at (1.19, 1.09, 2.80)
  - `jet_a_nav_left` mesh at (6.95, 1.65, -1.55)
  - `jet_a_nav_right` mesh at (-6.95, 1.65, -1.55)
  - `jet_a_strobe` mesh at (0.00, 2.71, -8.25)
  - `jet_a_trail_left` empty at (2.69, 0.70, -0.52)
  - `jet_a_trail_right` empty at (-2.69, 0.70, -0.52)
- **`jet_b`**
  - `jet_b_beacon_bottom` mesh at (0.00, 0.52, 0.10)
  - `jet_b_beacon_top` mesh at (0.00, 3.21, 0.10)
  - `jet_b_body` mesh at (0.00, 0.00, -0.00)
  - `jet_b_fan_left` mesh at (2.89, 0.68, 2.58)
  - `jet_b_fan_right` mesh at (-2.89, 0.68, 2.58)
  - `jet_b_fin` empty at (0.16, 4.43, -8.00)
  - `jet_b_gear_main_left` empty at (1.31, 1.04, -0.40)
    - `jet_b_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_b_gear_main_left_wheel_l` mesh at (0.26, -0.68, -0.00)
    - `jet_b_gear_main_left_wheel_r` mesh at (-0.26, -0.68, -0.00)
  - `jet_b_gear_main_right` empty at (-1.31, 1.04, -0.40)
    - `jet_b_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_b_gear_main_right_wheel_l` mesh at (0.26, -0.68, -0.00)
    - `jet_b_gear_main_right_wheel_r` mesh at (-0.26, -0.68, -0.00)
  - `jet_b_gear_nose` empty at (0.00, 0.81, 6.70)
    - `jet_b_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_b_gear_nose_wheel_l` mesh at (0.18, -0.55, -0.00)
    - `jet_b_gear_nose_wheel_r` mesh at (-0.18, -0.55, -0.00)
  - `jet_b_label` empty at (0.00, 4.65, -0.10)
  - `jet_b_landing_light` mesh at (1.19, 1.09, 2.80)
  - `jet_b_nav_left` mesh at (7.45, 1.69, -1.83)
  - `jet_b_nav_right` mesh at (-7.45, 1.69, -1.83)
  - `jet_b_strobe` mesh at (0.00, 2.71, -9.45)
  - `jet_b_trail_left` empty at (2.89, 0.68, -0.77)
  - `jet_b_trail_right` empty at (-2.89, 0.68, -0.77)
- **`jet_c`**
  - `jet_c_beacon_bottom` mesh at (0.00, 0.51, -0.70)
  - `jet_c_beacon_top` mesh at (0.00, 2.92, -0.70)
  - `jet_c_body` mesh at (0.00, 0.00, -0.00)
  - `jet_c_fan_left` mesh at (1.87, 2.25, -3.19)
  - `jet_c_fan_right` mesh at (-1.87, 2.25, -3.19)
  - `jet_c_fin` empty at (0.14, 3.86, -6.12)
  - `jet_c_gear_main_left` empty at (1.18, 0.98, -1.20)
    - `jet_c_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_c_gear_main_left_wheel_l` mesh at (0.23, -0.66, -0.00)
    - `jet_c_gear_main_left_wheel_r` mesh at (-0.23, -0.66, -0.00)
  - `jet_c_gear_main_right` empty at (-1.18, 0.98, -1.20)
    - `jet_c_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_c_gear_main_right_wheel_l` mesh at (0.23, -0.66, -0.00)
    - `jet_c_gear_main_right_wheel_r` mesh at (-0.23, -0.66, -0.00)
  - `jet_c_gear_nose` empty at (0.00, 0.77, 4.94)
    - `jet_c_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_c_gear_nose_wheel_l` mesh at (0.18, -0.51, -0.00)
    - `jet_c_gear_nose_wheel_r` mesh at (-0.18, -0.51, -0.00)
  - `jet_c_label` empty at (0.00, 4.36, -0.10)
  - `jet_c_landing_light` mesh at (1.06, 1.03, 1.76)
  - `jet_c_nav_left` mesh at (6.25, 1.52, -2.19)
  - `jet_c_nav_right` mesh at (-6.25, 1.52, -2.19)
  - `jet_c_strobe` mesh at (0.00, 2.47, -7.45)
  - `jet_c_trail_left` empty at (1.87, 2.25, -5.67)
  - `jet_c_trail_right` empty at (-1.87, 2.25, -5.67)
- **`jet_d`**
  - `jet_d_beacon_bottom` mesh at (0.00, 0.60, 0.40)
  - `jet_d_beacon_top` mesh at (0.00, 4.22, 0.40)
  - `jet_d_body` mesh at (0.00, 0.00, -0.00)
  - `jet_d_fan_left` mesh at (3.98, 0.86, 3.57)
  - `jet_d_fan_right` mesh at (-3.98, 0.86, 3.57)
  - `jet_d_fin` empty at (0.22, 5.91, -10.37)
  - `jet_d_gear_main_left` empty at (1.78, 1.31, -0.10)
    - `jet_d_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_d_gear_main_left_wheel_l` mesh at (0.71, -0.82, -0.00)
    - `jet_d_gear_main_left_wheel_r` mesh at (-0.71, -0.82, -0.00)
  - `jet_d_gear_main_right` empty at (-1.78, 1.31, -0.10)
    - `jet_d_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_d_gear_main_right_wheel_l` mesh at (0.71, -0.82, -0.00)
    - `jet_d_gear_main_right_wheel_r` mesh at (-0.71, -0.82, -0.00)
  - `jet_d_gear_nose` empty at (0.00, 0.99, 8.87)
    - `jet_d_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `jet_d_gear_nose_wheel_l` mesh at (0.18, -0.73, -0.00)
    - `jet_d_gear_nose_wheel_r` mesh at (-0.18, -0.73, -0.00)
  - `jet_d_label` empty at (0.00, 5.66, -0.00)
  - `jet_d_landing_light` mesh at (1.62, 1.36, 3.93)
  - `jet_d_nav_left` mesh at (10.25, 2.20, -2.13)
  - `jet_d_nav_right` mesh at (-10.25, 2.20, -2.13)
  - `jet_d_strobe` mesh at (0.00, 3.57, -12.25)
  - `jet_d_trail_left` empty at (3.98, 0.86, -0.92)
  - `jet_d_trail_right` empty at (-3.98, 0.86, -0.92)
- **`prop_a`**
  - `prop_a_beacon_bottom` mesh at (0.00, 0.53, -0.60)
  - `prop_a_beacon_top` mesh at (0.00, 2.77, -0.00)
  - `prop_a_body` mesh at (0.00, 0.00, -0.00)
  - `prop_a_fin` empty at (0.14, 3.45, -5.40)
  - `prop_a_gear_main_left` empty at (1.15, 0.85, 0.30)
    - `prop_a_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_a_gear_main_left_wheel_l` mesh at (0.18, -0.53, -0.00)
    - `prop_a_gear_main_left_wheel_r` mesh at (-0.18, -0.53, -0.00)
  - `prop_a_gear_main_right` empty at (-1.15, 0.85, 0.30)
    - `prop_a_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_a_gear_main_right_wheel_l` mesh at (0.18, -0.53, -0.00)
    - `prop_a_gear_main_right_wheel_r` mesh at (-0.18, -0.53, -0.00)
  - `prop_a_gear_nose` empty at (0.00, 0.80, 4.90)
    - `prop_a_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_a_gear_nose_wheel_l` mesh at (0.15, -0.58, -0.00)
    - `prop_a_gear_nose_wheel_r` mesh at (-0.15, -0.58, -0.00)
  - `prop_a_label` empty at (0.00, 4.07, -0.10)
  - `prop_a_landing_light` mesh at (1.10, 2.37, 1.75)
  - `prop_a_nav_left` mesh at (7.65, 2.67, 0.60)
  - `prop_a_nav_right` mesh at (-7.65, 2.67, 0.60)
  - `prop_a_prop_left` mesh at (2.30, 2.17, 2.90)
  - `prop_a_prop_right` mesh at (-2.30, 2.17, 2.90)
  - `prop_a_strobe` mesh at (0.00, 2.35, -7.00)
  - `prop_a_trail_left` empty at (7.60, 2.67, 0.19)
  - `prop_a_trail_right` empty at (-7.60, 2.67, 0.19)
- **`prop_b`**
  - `prop_b_beacon_bottom` mesh at (0.00, 0.48, -0.80)
  - `prop_b_beacon_top` mesh at (0.00, 2.53, -0.20)
  - `prop_b_body` mesh at (0.00, 0.00, -0.00)
  - `prop_b_fin` empty at (0.14, 3.30, -3.60)
  - `prop_b_gear_main_left` empty at (1.05, 0.77, 0.10)
    - `prop_b_gear_main_left_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_b_gear_main_left_wheel_l` mesh at (0.18, -0.45, -0.00)
    - `prop_b_gear_main_left_wheel_r` mesh at (-0.18, -0.45, -0.00)
  - `prop_b_gear_main_right` empty at (-1.05, 0.77, 0.10)
    - `prop_b_gear_main_right_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_b_gear_main_right_wheel_l` mesh at (0.18, -0.45, -0.00)
    - `prop_b_gear_main_right_wheel_r` mesh at (-0.18, -0.45, -0.00)
  - `prop_b_gear_nose` empty at (0.00, 0.73, 3.50)
    - `prop_b_gear_nose_strut` mesh at (0.00, 0.00, -0.00)
    - `prop_b_gear_nose_wheel_l` mesh at (0.15, -0.50, -0.00)
    - `prop_b_gear_nose_wheel_r` mesh at (-0.15, -0.50, -0.00)
  - `prop_b_label` empty at (0.00, 3.83, 0.10)
  - `prop_b_landing_light` mesh at (1.10, 2.13, 1.55)
  - `prop_b_nav_left` mesh at (6.25, 2.39, 0.40)
  - `prop_b_nav_right` mesh at (-6.25, 2.39, 0.40)
  - `prop_b_prop_left` mesh at (2.30, 1.93, 2.70)
  - `prop_b_prop_right` mesh at (-2.30, 1.93, 2.70)
  - `prop_b_strobe` mesh at (0.00, 2.20, -5.20)
  - `prop_b_trail_left` empty at (6.20, 2.39, -0.01)
  - `prop_b_trail_right` empty at (-6.20, 2.39, -0.01)

### airport_buildings.glb (1803 KB)

- **`fire_station`**
  - `fire_station_beacon` mesh at (-8.20, 8.80, -0.50)
  - `fire_station_body` mesh at (0.00, 0.00, -0.00)
  - `fire_station_door0` mesh at (-4.00, 3.40, 3.55)
  - `fire_station_door1` mesh at (0.00, 3.40, 3.55)
  - `fire_station_door2` mesh at (4.00, 3.40, 3.55)
  - `fire_station_label` empty at (0.00, 10.00, -0.00)
- **`fuel_farm`**
  - `fuel_farm_body` mesh at (0.00, 0.00, -0.00)
  - `fuel_farm_label` empty at (0.00, 7.00, -0.00)
- **`hangar_a`**
  - `hangar_a_body` mesh at (0.00, 0.00, -0.00)
  - `hangar_a_door_left` mesh at (5.50, 0.00, 10.30)
  - `hangar_a_door_right` mesh at (-5.50, 0.00, 10.30)
  - `hangar_a_label` empty at (0.00, 12.00, -0.00)
  - `hangar_a_lamp` mesh at (0.00, 6.30, 10.45)
- **`hangar_b`**
  - `hangar_b_body` mesh at (0.00, 0.00, -0.00)
  - `hangar_b_door_left` mesh at (4.00, 0.00, 7.30)
  - `hangar_b_door_right` mesh at (-4.00, 0.00, 7.30)
  - `hangar_b_label` empty at (0.00, 10.00, -0.00)
  - `hangar_b_lamp` mesh at (0.00, 5.30, 7.45)
- **`radar_asr`**
  - `radar_asr_antenna` mesh at (0.00, 14.30, 0.50)
  - `radar_asr_beacon` mesh at (0.00, 16.50, 0.20)
  - `radar_asr_body` mesh at (0.00, 0.00, -0.00)
  - `radar_asr_label` empty at (0.00, 18.00, -0.00)
- **`radar_weather`**
  - `radar_weather_beacon` mesh at (0.00, 14.15, -0.00)
  - `radar_weather_body` mesh at (0.00, 0.00, -0.00)
  - `radar_weather_label` empty at (0.00, 16.00, -0.00)
- **`terminal_main`**
  - `terminal_main_body` mesh at (0.00, 0.00, -0.00)
  - `terminal_main_label` empty at (0.00, 9.00, -0.00)
- **`terminal_pier`**
  - `terminal_pier_body` mesh at (0.00, 0.00, -0.00)
  - `terminal_pier_label` empty at (0.00, 8.00, -0.00)
- **`tower_main`**
  - `tower_main_beacon` mesh at (0.60, 27.85, 0.40)
  - `tower_main_body` mesh at (0.00, 0.00, -0.00)
  - `tower_main_cab_view` empty at (0.00, 23.05, -0.00)
  - `tower_main_label` empty at (0.00, 29.35, -0.00)
- **`tower_small`**
  - `tower_small_beacon` mesh at (0.60, 15.65, 0.40)
  - `tower_small_body` mesh at (0.00, 0.00, -0.00)
  - `tower_small_cab_view` empty at (0.00, 10.85, -0.00)
  - `tower_small_label` empty at (0.00, 17.15, -0.00)

### airport_props.glb (1063 KB)

- **`approach_lights`**
  - `approach_lights_bar0` mesh at (0.00, 0.60, -0.00)
  - `approach_lights_bar1` mesh at (0.00, 0.85, -6.00)
  - `approach_lights_bar2` mesh at (0.00, 1.10, -12.00)
  - `approach_lights_bar3` mesh at (0.00, 1.35, -18.00)
  - `approach_lights_bar4` mesh at (0.00, 1.60, -24.00)
  - `approach_lights_body` mesh at (0.00, 0.00, -0.00)
- **`edge_light_blue`**
  - `edge_light_blue_body` mesh at (0.00, 0.00, -0.00)
  - `edge_light_blue_lens` mesh at (0.00, 0.48, -0.00)
- **`edge_light_white`**
  - `edge_light_white_body` mesh at (0.00, 0.00, -0.00)
  - `edge_light_white_lens` mesh at (0.00, 0.48, -0.00)
- **`fire_truck`**
  - `fire_truck_beacon_l` mesh at (0.90, 3.10, 3.40)
  - `fire_truck_beacon_r` mesh at (-0.90, 3.10, 3.40)
  - `fire_truck_body` mesh at (0.00, 0.00, -0.00)
  - `fire_truck_turret` mesh at (0.00, 3.30, 2.00)
  - `fire_truck_wheel_al` mesh at (1.20, 0.60, 3.00)
  - `fire_truck_wheel_ar` mesh at (-1.20, 0.60, 3.00)
  - `fire_truck_wheel_bl` mesh at (1.20, 0.60, -0.60)
  - `fire_truck_wheel_br` mesh at (-1.20, 0.60, -0.60)
  - `fire_truck_wheel_cl` mesh at (1.20, 0.60, -2.40)
  - `fire_truck_wheel_cr` mesh at (-1.20, 0.60, -2.40)
- **`follow_me`**
  - `follow_me_body` mesh at (0.00, 0.00, -0.00)
  - `follow_me_light_bar` mesh at (0.00, 1.86, -0.18)
  - `follow_me_sign_face` mesh at (0.00, 1.86, -0.29)
  - `follow_me_wheel_fl` mesh at (0.85, 0.36, 1.30)
  - `follow_me_wheel_fr` mesh at (-0.85, 0.36, 1.30)
  - `follow_me_wheel_rl` mesh at (0.85, 0.36, -1.30)
  - `follow_me_wheel_rr` mesh at (-0.85, 0.36, -1.30)
- **`glideslope`**
  - `glideslope_body` mesh at (0.00, 0.00, -0.00)
  - `glideslope_lamp` mesh at (0.00, 9.20, -0.00)
- **`localizer`**
  - `localizer_body` mesh at (0.00, 0.00, -0.00)
  - `localizer_lamp` mesh at (6.50, 2.40, 0.10)
- **`papi`**
  - `papi_body` mesh at (0.00, 0.00, -0.00)
  - `papi_lens0` mesh at (0.00, 0.55, 0.47)
  - `papi_lens1` mesh at (1.60, 0.55, 0.47)
  - `papi_lens2` mesh at (3.20, 0.55, 0.47)
  - `papi_lens3` mesh at (4.80, 0.55, 0.47)
- **`sign_runway`**
  - `sign_runway_body` mesh at (0.00, 0.00, -0.00)
  - `sign_runway_text` empty at (0.00, 0.85, 0.20)
- **`sign_taxi`**
  - `sign_taxi_body` mesh at (0.00, 0.00, -0.00)
  - `sign_taxi_text` empty at (0.00, 0.85, 0.20)
- **`tug`**
  - `tug_beacon` mesh at (0.30, 2.35, -0.90)
  - `tug_body` mesh at (0.00, 0.00, -0.00)
  - `tug_wheel_fl` mesh at (1.00, 0.42, 1.10)
  - `tug_wheel_fr` mesh at (-1.00, 0.42, 1.10)
  - `tug_wheel_rl` mesh at (1.00, 0.42, -1.10)
  - `tug_wheel_rr` mesh at (-1.00, 0.42, -1.10)
- **`windsock`**
  - `windsock_body` mesh at (0.00, 0.00, -0.00)
  - `windsock_lamp` mesh at (0.00, 5.30, -0.00)
  - `windsock_sock` mesh at (0.00, 4.70, -0.00)

### birds.glb (195 KB)

Clips: `bird_gull_flap` (12 frames), `bird_gull_glide` (48 frames), `bird_swift_flap` (6 frames), `bird_swift_glide` (48 frames)

- **`bird_gull`**
  - `bird_gull_mesh` mesh at (0.00, 0.00, -0.00)
- **`bird_swift`**
  - `bird_swift_mesh` mesh at (0.00, 0.00, -0.00)

### nature.glb (285 KB)

- **`boat_fishing`**
  - `boat_fishing_body` mesh at (0.00, 0.00, -0.00)
- **`boat_sail`**
  - `boat_sail_body` mesh at (0.00, 0.00, -0.00)
- **`bush`**
  - `bush_body` mesh at (0.00, 0.00, -0.00)
- **`lighthouse`**
  - `lighthouse_body` mesh at (0.00, 0.00, -0.00)
  - `lighthouse_lamp` mesh at (0.00, 11.90, -0.00)
- **`rock_a`**
  - `rock_a_body` mesh at (0.00, 0.00, -0.00)
- **`rock_b`**
  - `rock_b_body` mesh at (0.00, 0.00, -0.00)
- **`tree_conifer_a`**
  - `tree_conifer_a_body` mesh at (0.00, 0.00, -0.00)
- **`tree_conifer_b`**
  - `tree_conifer_b_body` mesh at (0.00, 0.00, -0.00)
- **`tree_round_a`**
  - `tree_round_a_body` mesh at (0.00, 0.00, -0.00)
- **`tree_round_b`**
  - `tree_round_b_body` mesh at (0.00, 0.00, -0.00)

### nav.glb (541 KB)

- **`fix_pylon`**
  - `fix_pylon_body` mesh at (0.00, 0.00, -0.00)
  - `fix_pylon_label` empty at (0.00, 7.20, -0.00)
  - `fix_pylon_ring` mesh at (0.00, 0.45, -0.00)
  - `fix_pylon_tip` mesh at (0.00, 6.55, -0.00)
- **`fix_pylon_tall`**
  - `fix_pylon_tall_body` mesh at (0.00, 0.00, -0.00)
  - `fix_pylon_tall_label` empty at (0.00, 9.70, -0.00)
  - `fix_pylon_tall_ring` mesh at (0.00, 0.45, -0.00)
  - `fix_pylon_tall_ring1` mesh at (0.00, 0.53, -0.00)
  - `fix_pylon_tall_tip` mesh at (0.00, 9.05, -0.00)
- **`holding_marker`**
  - `holding_marker_body` mesh at (0.00, 0.00, -0.00)
  - `holding_marker_label` empty at (0.00, 4.60, -0.00)
  - `holding_marker_ring` mesh at (0.00, 0.42, -0.00)
- **`ndb_station`**
  - `ndb_station_body` mesh at (0.00, 0.00, -0.00)
  - `ndb_station_label` empty at (0.00, 11.50, -0.00)
  - `ndb_station_ring` mesh at (0.00, 0.28, -0.00)
  - `ndb_station_tip_left` mesh at (6.00, 10.10, -0.00)
  - `ndb_station_tip_right` mesh at (-6.00, 10.10, 0.00)
- **`vor_station`**
  - `vor_station_body` mesh at (0.00, 0.00, -0.00)
  - `vor_station_label` empty at (0.00, 8.00, -0.00)
  - `vor_station_ring` mesh at (0.00, 3.24, -0.00)
  - `vor_station_sweep` mesh at (0.00, 6.15, -0.00)

### town.glb (888 KB)

- **`apartment_a`**
  - `apartment_a_body` mesh at (0.00, 0.00, -0.00)
- **`apartment_b`**
  - `apartment_b_body` mesh at (0.00, 0.00, -0.00)
- **`church`**
  - `church_body` mesh at (0.00, 0.00, -0.00)
  - `church_light` mesh at (0.00, 13.60, 4.40)
- **`factory`**
  - `factory_body` mesh at (0.00, 0.00, -0.00)
  - `factory_smoke` empty at (5.00, 12.20, -5.50)
- **`house_a`**
  - `house_a_body` mesh at (0.00, 0.00, -0.00)
- **`house_b`**
  - `house_b_body` mesh at (0.00, 0.00, -0.00)
- **`house_c`**
  - `house_c_body` mesh at (0.00, 0.00, -0.00)
- **`warehouse`**
  - `warehouse_body` mesh at (0.00, 0.00, -0.00)
- **`water_tower`**
  - `water_tower_body` mesh at (0.00, 0.00, -0.00)
  - `water_tower_light` mesh at (0.00, 11.75, -0.00)

### weather.glb (688 KB)

- **`cloud_a`**
  - `cloud_a_body` mesh at (0.00, 0.00, -0.00)
- **`cloud_b`**
  - `cloud_b_body` mesh at (0.00, 0.00, -0.00)
- **`cloud_c`**
  - `cloud_c_body` mesh at (0.00, 0.00, -0.00)
- **`storm_cell_a`**
  - `storm_cell_a_body` mesh at (0.00, 0.00, -0.00)
  - `storm_cell_a_core` mesh at (0.00, 0.00, -0.00)
  - `storm_cell_a_label` empty at (0.00, 67.80, -0.00)
  - `storm_cell_a_lightning0` mesh at (-22.80, 10.20, 0.00)
  - `storm_cell_a_lightning1` mesh at (22.80, 10.20, -0.00)
- **`storm_cell_b`**
  - `storm_cell_b_body` mesh at (0.00, 0.00, -0.00)
  - `storm_cell_b_core` mesh at (0.00, 0.00, -0.00)
  - `storm_cell_b_label` empty at (0.00, 51.32, -0.00)
  - `storm_cell_b_lightning0` mesh at (-16.72, 7.48, 0.00)
  - `storm_cell_b_lightning1` mesh at (16.72, 7.48, -0.00)
