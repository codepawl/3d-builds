# Pitlane asset pack (pass 1)

Seven GLBs in `app/public/assets/`, 17 MB in total. All are in metres, y up, and face +z (forward), with roots sitting on
y = 0. Each family is one GLB so that repeats can be instanced. The full node lists are in `blender/glb-inventory.txt`
(`node blender/inspect_glb.mjs`). Rebuild with `pwsh blender/run.ps1 blender/build_all.py [-ScriptArgs cars,crew,...]`.
Render the sheets with `blender/preview.py` (contact sheets), `blender/compare_render.py` followed by
`compose_compare.py` (reference-versus-render sheets), and `blender/clip_poses.py` (crew clip poses). The reference
sheets are in `blender/refs/*.md`, and the images and licences are in `blender/refs/manifest.json`. They are for
modelling only, so never show them in the app or the film.

## Shared material names (app may recolour)
- `<team>_primary / _secondary / _accent` for each team: halvard (cobalt #2557e8, off-white, lime #c6f432, which is
  our team), ostrava (coral and white), kestrel (violet, graphite and cyan), sable (yellow, graphite and white). All
  four teams are made up.
- `compound_soft / _medium / _hard / _inter / _wet` are the tyre bands: red, yellow, white, green and blue.
- `glow_red / glow_green / glow_amber / glow_white / glow_blue` and `screen` are emissive, so the app can bloom them.
- Colour helpers: `helmet_<hex>` (driver helmets), `championship_orange`, `medical_teal`, `blanket_halvard`,
  `seat_*`, `crowd_*`, `flag_*`.

## cars.glb (3.9 MB, 121k triangles), from refs/race_car.md
Roots: `car_halvard_07` and `car_halvard_22` (our two cars, with different helmets), plus the rivals
`car_ostrava_11`, `car_kestrel_31` and `car_sable_44`. Each car measures 5.40 x 0.97 x 1.90 m (length x height x width;
the camera pod puts the top at 1.0 m). The wheelbase is 3.40 m: the front axle is at z +1.70 and the rear axle at
-1.70. The origin is on the ground midway between the axles.
- `<car>_body`: the full static body (tub, sidepods, halo, wings, floor, suspension, driver).
- `<car>_steer_fl / _steer_fr`: empties at the front hub centres. Rotate them about y to steer.
- `<car>_wheel_fl / _fr` (children of the steer empties) and `<car>_wheel_rl / _rr`: the origin is at the hub, so spin
  them about x. Tyres are 0.705 m (front) and 0.71 m (rear) across. The band material follows the fitted compound
  (07 and 22 use medium). To show a tyre change, swap the band material or hide the wheel and show a `tyre_*` from
  pitgear.
- `<car>_drs_flap`: the top flap of the rear wing. Its origin is on the trailing-edge hinge; rotate x by -0.3 rad to
  open it.
- Anchors: `<car>_jack_front` (under the nose, y 0.16) and `<car>_jack_rear` (under the crash structure) mark where the
  jack saddles go. `<car>_number` is the nose number-plate decal spot.
- Where it goes: on track, in the pit box, on stands in the garage (raise the car 0.12 m when it is on the jacks).

## crew.glb (1.2 MB, 33k triangles), from refs/pit_crew.md
Roots: `crew_halvard_a`, `crew_halvard_b` (our stop crew in two colour arrangements), `crew_ostrava`, `crew_kestrel`,
`mechanic_halvard` (team shirt and headset) and `marshal` (orange overalls and cap). Each is 1.78 m tall with the
origin between the feet, facing +z.
- Armature `<root>_rig` has the bones hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R and shin.L/R. Body parts
  are rigid meshes parented to the bones.
- Anchors that follow the bones: `<root>_grip_R` (right hand, where the wheel gun or jack handle attaches) and
  `<root>_grip_carry` (chest, where a carried tyre or blanket attaches).
- Clips `<root>_<clip>` at 24 fps:
  - `idle`: 2 s.
  - `run`: 0.67 s loop, for about 5 m/s.
  - `jack_up`: 2 s. Ready crouch, lean back to lift, hold, release.
  - `gun`: 2 s. Kneel at hub height, gun on with a shake from frames 6 to 18, gun off.
  - `carry_tyre`: 1 s walk loop holding a tyre at the chest.
  - `work`: 2 s. Bent over the car, hands alternating.
- Where they go: the stop crew stands in pit-box positions, mirroring pit_crew/01. That is 2 jack operators, 4 gun
  operators, 4 tyre-off and 4 tyre-on carriers, and 2 stabilisers. Mechanics work in the garage, marshals stand at the
  marshal posts.

## pitgear.glb (2.6 MB, 82k triangles), from refs/pit_tools.md and refs/tyre.md
- `front_jack` (1.84 m long) and `rear_jack` (1.14 m): `<jack>_frame` is the static wheeled base. `<jack>_lever` is the
  pole, saddle and handle; its pivot is on the wheel axle (y 0.1), and rotating x by about +0.12 rad lifts the saddle.
  `<jack>_handle` is the anchor where the crew grip goes.
- `wheel_gun`: the origin is at the grip (attach it to `grip_R`), with the socket pointing +z. It has a hose stub and a
  green ready lamp.
- `tyre_<compound>` (rear size, 0.71 x 0.375 m) and `tyre_front_<compound>` (0.705 x 0.28 m) come in soft, medium,
  hard, inter and wet. They stand upright with the origin at the hub and spin about x.
- `blanket_<compound>`: a tyre in a Halvard blanket with a compound tag and an amber plug lamp.
- `tyre_rack_soft / _medium / _hard`: a 1.04 x 1.88 m trolley holding four blanketed tyres.
  `tyre_stack_inter / _wet`: four bare tyres lying flat.
- `car_stand_front` (0.42 m) and `car_stand_rear` (0.5 m): the stands under the car in the garage.
- `release_gantry`: 2.6 m tall and 2.8 m wide over the pit box. The lamps `release_gantry_red`, `_amber` and `_green`
  are separate objects, so show or hide them for the release.
- `tool_trolley` (a garage chest with a laptop screen) and `tyre_cart` (a hand cart with one blanketed tyre).

## pitlane.glb (2.5 MB, 85k triangles), from refs/garage.md and refs/pit_wall.md
- `garage_<team>` comes in halvard, ostrava, kestrel, sable and plain. Each box is 12.1 x 9 x 15 m (17 m including the
  roof overhang), two storeys, with the open front facing +z towards the pit lane. Tile the boxes along x every 12 m.
  - Doors `garage_<team>_door_1 / _door_2` are roller shutters whose origin sits at the top of the opening (y 4.3).
    They are exported open (scale y 0.04); set scale y to 1 to close them. `_drum_1 / _drum_2` are the roll housings.
  - Anchors `garage_<team>_bay_1 / _bay_2` mark where the cars park, nose to +z.
  - Inside: a team wall panel, a monitor gantry with screen glow, benches, ceiling light strips and bay lines.
  - Outside: glazed upper floor, team plate and number plate (blank, for decals), canopy downlights, back roller door
    and windows, roof AC units and a skylight.
- `stand_<team>` (4 teams): the strategy stand, 4.9 x 2.5 x 3.6 m. It has 4 stools facing -z over the pit wall, two
  rows of screens, a roof, an antenna and steps. Anchor: `stand_<team>_seat_1`.
- `pit_wall_section`: 12 m of 1.1 m wall with a 3.6 m debris fence. The track is on -z and the pit lane on +z.

## paddock.glb (3.2 MB, 107k triangles), from refs/team_truck.md and refs/hospitality.md
- `truck_<team>` (4 teams): a cab-over tractor with a 13.6 m box trailer, 16.5 m long, 4.1 m tall and 2.55 m wide
  (2.96 m across the mirrors). The cab faces +z. It has 10 wheel objects, `truck_<team>_wheel_0..9`, each spinning
  about x from its hub, plus marker lights (glow_amber), tail lights and a blank side plate.
- `hospitality_<team>` (halvard, ostrava, kestrel): a 14 x 9 m two-storey unit, 8.4 m tall plus the roof canopy (12.2 m
  overall with the stair). The glass front faces +z. It has a balcony rail, an outside stair, an awning, planters and
  a blank plate.

## track.glb (3.2 MB, 94k triangles), from refs/kerb.md, refs/grandstand.md and refs/marshal_post.md
- Kerbs:
  - `kerb_straight`: 6 m long (along z) x 1.2 m wide, red and white with ridges.
  - `kerb_curve`: a 20 degree arc at a 30 m radius. Its origin is at the arc start and it curves towards -x.
- Grandstands:
  - `grandstand_covered`: 30 m long with 14 rows and a roof, facing +z, with crowd dots.
  - `grandstand_open`: 15 m long with 8 rows.
- `marshal_post`: a hut with a flag rack and a fence gap, with the track on +z. `marshal_post_panel` is the LED flag
  panel (glow_amber); recolour it for yellow, green, red or blue.
- Barriers:
  - `armco_section`: 4 m.
  - `tyre_wall`: 4 m.
  - `debris_fence`: 6 m.
  - `concrete_barrier`: 4 m, with a fence, for the street circuit.
- Lights and signs:
  - `floodlight_pole`: 12 m, for the night street circuit.
  - `start_gantry`: 14 m. The lights `start_gantry_light_1..5` are separate glow_red objects.
  - `drs_board`: marks the overtaking zones.
  - `billboard`: a blank plate.
- Scenery:
  - Parkland circuit: `tree_park_a`, `tree_park_b`.
  - Street circuit: `palm_a`, `palm_b`.
  - Desert circuit: `desert_shrub`, `rock_a`, `rock_b`.

## roadcars.glb (0.7 MB, 21k triangles), from refs/safety_car.md
- `safety_car`: a GT coupe, 4.62 x 1.40 x 2.00 m including the light bar and mirrors. It is white with championship
  orange and graphite stripes.
- `medical_car`: an estate, 4.72 x 1.53 x 2.00 m, white with a teal band.
- On both cars the wheels `<root>_wheel_fl/fr/rl/rr` spin about x from their hubs, and `<root>_lightbar_amber` and
  `<root>_lightbar_green` are glow lenses the app can flash.

## Known gaps
- Materials are flat PBR colours with no baked textures. The UVs are smart-projected, so textures can be added later.
- The safety car is the weakest likeness. It reads as a generic GT at app scale, but the cabin is lower and flatter
  than the reference.
- Number and sponsor plates are blank, so the app draws the numbers and names as decals at the `_number` and plate
  anchors.
- The pit-lane surface, the box markings and the track ribbon itself are not modelled, so the app draws them.
