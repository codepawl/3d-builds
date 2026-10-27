# Theme park asset pack (pass 1)

All GLBs are in `app/public/assets/`. Units are metres. App space is three.js: x side, y up, z forward; every
asset stands on y = 0 and faces +z unless stated. One GLB per family, so repeats can be instanced from one root.
Reference sheets (real type, dimensions with sources, proportions, parts, images with licences) are in
`blender/refs/<asset>.md`, and the images are in `blender/refs/<asset>/`. They are modelling references only;
never show them in the app or film.

Material names the app can use:
- `brand` / `brand_dark`: park coral #f0545c.
- `status`: ride state lamp to recolour (open green, down red, testing amber).
- `glow_*`: emissive lamps to bloom.
- `sign_blank`: blank plates to draw labels on.
- `screen`: wait boards and consoles.
- `car_paint_<model>`: parked cars, tint per instance.

Rebuild everything with `pwsh blender/run.ps1 -Script blender/build_all.py`; it waits for any other blender.exe and
runs below normal priority. Families: coaster, rides, flume, buildings, transport, people, props.
Check with `blender/preview.py` (contact sheets in `blender/previews/<glb>.png`), `blender/compare_render.py` and
`compose_compare.py` (`blender/previews/<asset>-compare.png`), and `node blender/inspect_glb.mjs` (inventory).

## coaster.glb + coaster_track.json (adventure side, steel coaster)

- **Placement.** Origin is the layout centre. The footprint is about 121 x 43 m, the lift crest is 32.6 m and the
  first drop is about 30 m.
- **Track roots.**
  - `coaster_track`: `coaster_track_rails` (2 rails and a box spine) and `coaster_track_ties`.
  - `coaster_supports`: `coaster_support_columns` and `coaster_support_footings`. Above 14 m the legs are
    twin and splayed.
  - `coaster_lift`: `coaster_lift_chain`, `coaster_lift_walkway` and `coaster_lift_drive`.
  - `coaster_brakes`: `coaster_brake_fins`.
  - `coaster_station`: origin at (-36, 0, -20). Children are `coaster_station_deck`, `_canopy`, `_gates`,
    `_booth` and the lamp `coaster_station_status`.
- **Trains.** `coaster_train_a` (coral) and `coaster_train_b` (violet) have `<train>_car_1` (lead, with nose)
  to `_car_5`. Each car's pivot is at the track centreline (rail-centre height) at the car's middle.
  Place each car separately on the spline, 2.9 m apart: car_1 at distance d, car_2 at d - 2.9, and so on.
  Orient each car with the tangent and the `up` vector.
- **coaster_track.json.**
  - `points`: 325 points at 1 m spacing, closed loop.
  - `up`: banked up vectors, up to 60 degrees.
  - `length`: total length in metres.
  - `station`, `lift`, `brakes`: index ranges (index = metres).
  - `carPitch` = 2.9.
  - The lift needs chain speed, about 2 m/s. The station is on the straight at z = -20 from x = -48 to -24.

## rides.glb (Ferris wheel and carousel)

- **`ferris_wheel`.** About 46 m tall (Wonder Wheel class) with 24 gondolas.
  - Fixed parts: `ferris_base` (deck, booth, fence, sign plate), `ferris_towers` and the lamp `ferris_status`.
  - Moving parts: `ferris_rotor`, an empty at the hub (0, 24, 0). Turn it about x, about one revolution per
    6 to 8 minutes in real time; speed it up for the film.
  - The rotor's children are `ferris_wheel_frame` and `gondola_01` to `gondola_24`. Each gondola's origin is
    its hanger pin on the rim, 21 m from the hub. Counter-rotate each gondola by minus the rotor angle so the
    cars stay level.
- **`carousel`.** Root at (40, 0, 0) in the file; move it freely. 15 m platform, crown 10.5 m.
  - Fixed parts: `carousel_base` (plinth, fence, console, sign) and `carousel_status`.
  - Moving parts: `carousel_rotor`, an empty at the centre. Turn it about +y, counter-clockwise from above,
    about 5 rpm. Its children are `carousel_deck`, `horse_01` to `horse_22` and `chariot_01` and `_02`.
  - Each horse's origin is on its pole at platform height (0.55 m). Bob it in y between 0 and 0.35 m, with the
    phase offset per horse.

## flume.glb + flume_path.json (adventure land, jungle river ride)

- **Placement.** Footprint about 69 x 29 m. The lift rises to 14.2 m and the final drop is about 13 m into
  the splash pool.
- **Roots.**
  - `flume_channel`: `flume_trough`, `flume_water` and `flume_trestles`.
  - `flume_lift`: `flume_lift_belt` (with cleats) and `flume_lift_walkway`.
  - `flume_pool`: root at (-17, 0, 12). Children are `flume_pool_basin` and `flume_splash`. `flume_splash` has
    its origin at the water surface; show and scale it up for about 1.5 s when a boat reaches the end of the
    drop.
  - `flume_station`: root at (-17.5, 0, -15). Children are `flume_station_deck` and `flume_status`.
- **Boats.** `flume_log_a`, `_b` and `_c` are hollow logs 4.6 x 1.4 m. The origin is on the trough floor at the
  boat centre.
- **flume_path.json.**
  - `points` and `up`: 173 points at 1 m along the trough floor, closed loop.
  - `station`, `lift`, `drop`: index ranges.
  - `boatLength` = 4.6.

## buildings.glb (landmarks)

Each building's origin is at its footprint centre with the entrance facing +z. The file offsets them so they do
not overlap.

- **`castle`** (fairytale land): 38 x 38 x 32 m including the moat and bridge. Children are `castle_body` and
  `castle_lights` (bulbs around the gate).
- **`showhouse_space`** (space land, holds the indoor coaster): 48 x 36 m box with a dome and a 26 m fin.
- **`showhouse_temple`** (adventure dark ride): 40 x 30 m with a stepped temple facade.
- **`showhouse_tale`** (fairytale dark ride): 36 x 28 m with a half-timbered facade and tower.
- **Children of each show building:**
  - `<name>_body`
  - `<name>_glow`: lamps.
  - `<name>_entrance`: canopy, doorway, sign plate.
  - `<name>_marquee`: glow strips.
  - `<name>_board`: wait-time board. Its screen mesh is `<name>_board_screen` inside the combined board.
- **`entrance_gate`** (entrance plaza): about 49 m wide. Arch, 8 turnstiles, 2 ticket booths, flags and
  planters. Children are `entrance_gate_body` and `entrance_gate_lights`.

## stands.glb (repeatable small buildings and queue parts)

- **Food:**
  - `stand_kiosk_a`: 4 x 3 m box kiosk with a striped awning.
  - `stand_kiosk_b`: round drinks kiosk.
  - `cart_icecream`.
  - `cart_popcorn`.
- **Shops** (10 x 8 m, one per land):
  - `shop_adventure`: thatch roof and porch.
  - `shop_space`: white slab and violet disc.
  - `shop_tale`: gable and timbers.
- **Queues:**
  - `queue_rail_straight`: 2 m along z, origin at the centre, posts at both ends.
  - `queue_rail_turn`: 180-degree U-turn for 1.2 m switchback lanes, centre at the origin, opening towards -z.
  - `queue_canopy`: 6.4 x 3.6 m shade sail.
  - `fastpass_merge`: podium with scanner, glow strip, sign and glass gate.
  - `wait_board`: children are `wait_board_frame`, `wait_board_screen` and `wait_board_status`.
- **Seating:** `table_umbrella` (table, 4 chairs, umbrella).

## transport.glb

- **Monorail** (straddle beam, ALWEG type):
  - `monorail_beam`: 4 m segment, 0.8 x 1.5 m section, origin at the top centre. Lay segments along a loop with
    the beam top at y = 6.5.
  - `monorail_pylon`: place every 20 m or so.
  - `monorail_station`: 30 m elevated platform beside a beam at x = 0, with stair tower and light strip.
- **Monorail cars:** `monorail_car_lead`, `_mid` and `_tail`, each 10 m plus a nose, origin on the beam top.
  - Car pitch is 13.2 m from the lead centre to the mid centre and 10.6 m from mid to mid. Simplest: run them
    along the path with a 12 m gap.
  - Doors are `<car>_door_L1`, `_L2`, `_R1` and `_R2`, with their origin at the door centre. Slide them 0.9 m
    along z at stations.
- **Tram:**
  - `tram_tractor`: 4.2 m.
  - `tram_trailer`: 6.5 m with 6 benches.
  - Wheels are `*_wheel_fl`, `_fr`, `_rl` and `_rr`, with their origin at the axle. Spin them about x.
- **Maintenance carts:**
  - `maint_cart_bed`: open bed, toolbox, cones, ladder.
  - `maint_cart_box`: cargo box.
  - Both have an amber beacon (`glow_amber`) and wheels named as above.
- **Parked cars:** `car_hatch`, `car_sedan`, `car_suv`, for the parking lot. Tint `car_paint_<model>`.
- **Parade floats:** `float_cake`, `float_rocket`, `float_carriage`. Each has an 8 x 3 m deck with skirts,
  bulbs and a driver cab at +z.

## people.glb

- **Characters:**
  - `guest_a` to `guest_f`: adults, 1.75 m.
  - `guest_child_a` and `guest_child_b`: root scale 0.72, 1.26 m.
  - `staff_operator`: coral polo, visor, badge.
  - `staff_tech`: coverall, orange vest, hard hat, tool belt.
- **Rig:** each has `<root>_rig` with bones hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R and
  shin.L/R. Meshes are bone-parented rigid parts.
- **Clips** (24 fps, glTF animations named `<root>_<clip>`):
  - `idle`: 2 s.
  - `walk`: 1 s loop. Move adults at 1.4 m/s and children at 1.0 m/s.
  - `wave`: 2 s.
  - `operate`: 2 s, hands on the console with a button press.
- **Crowds:** instance the guests with a random clip phase. Crowds above about 300 should use far-LOD dots.

## props.glb

- **Trees:** `tree_round_a`, `tree_round_b`, `tree_palm` (adventure), `tree_conifer`.
- **Planting:** `bush_a`, `bush_b`, `flower_bed`, `planter_box`.
- **Street furniture:** `lamp_post` (`lamp_post_glow`), `bench`, `trash_bin`, `bollard`, `info_kiosk`.
- **Parking and plaza:** `parking_light` (8 m), `balloon_cluster` (plaza vendor).

## Inventory

Generated by `node blender/inspect_glb.mjs` and kept in full in `blender/glb-inventory.txt` (sizes, triangles, root nodes and their children, clips).

Known gap: `lib.cut_loft` does not trim, because assigning the material resets the face tags it relies on. Use `trimmed_loft` in flume.py instead; it trims by face position.
