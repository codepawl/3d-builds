# Launch-site asset pack (pass 1)

Seven GLBs in `app/public/assets/`, 17.3 MB total, one file per family so repeats can be instanced. Units are metres.
Every node faces +z, stands on y = 0 and is centred on its footprint. All models are matte white clay for the
point-cloud look: materials `clay`, `steel_clay`, `frame_clay`, `concrete_clay`, `dark_clay`, `tile_clay`,
`glass_clay`, `rubber_clay`. Lamps use `glow_white`, `glow_red` and `glow_amber` (emissive). Wheels share the
vertex-coloured `wheel` material. UVs are smart-projected on every mesh. There are no characters, so there are no
armatures or clips. Moving parts are separate nodes, with their pivot at the joint.

Build: `pwsh blender/run.ps1 blender/build_all.py [-ScriptArgs rocket,pad,...]`, which runs headless at
below-normal priority and waits while another Blender is running. Sheets: `blender/preview.py` (contact sheet,
optional comma-separated name prefixes) and `blender/compare.py` (reference vs render). Inventory: `node blender/inventory.mjs`.
References: `blender/refs/<asset>.md` and `refs/manifest.json` (28 images with source and licence). These are for
modelling only. Never show them in the app or the film.

## Site layout these assets assume

- The tower origin is the tower centre. The vehicle axis and the `launch_mount` origin are at tower-local (0, 0, 30).
- Booster on the mount: base at y = 20 (mount table top). The ship stacks on the booster at y = 91. Leave both
  unrotated so their QD plates (-z) face the tower.
- Catch: the booster's catch pins (61.5 m above its base, on +-x) land on the arm rails at y = 85.3 with the
  carriage at its modelled height, so the booster base is at about y = 23.8 at the moment of the catch.
- The ship QD arm (y = 94.2) reaches the ship QD plate (ship base + 3.2 m) when the ship is stacked.

## rocket.glb (4.6 MB): Kestrel boosters, Heron ships. Refs: booster.md, ship.md

| Node | Real scale | Moving parts (pivot, axis) |
|---|---|---|
| `booster_a` | 71 m x 9 m, 33 engines, 4 grid fins, 30-slot hot-stage ring | `booster_a_fin_0..3`: hinge at y 64 on the barrel. Turn about local z (the radial axis) to steer. |
| `booster_b` | same body, 3 grid fins (90/90/180), 18-slot ring | `booster_b_fin_0..2`, same as above |
| `ship_crew` | 52 m x 9 m, window band, 6 engines | `_flap_fwd_l/r` (hinge y 40.5) and `_flap_aft_l/r` (hinge y 6.5): turn about local y (vertical hinge) |
| `ship_cargo` | same, payload door on +z | same flaps |
| `ship_tanker` | same, plain with vents | same flaps |

The heat tiles (darker) are on the -z half. The booster and ship `_beacon` lamps are white.

## pad.glb (2.6 MB): catch tower, tower under construction, launch mount, test stand. Refs: tower.md, launch_mount.md

| Node | Real scale | Moving parts |
|---|---|---|
| `tower` | 146.6 m to the mast tip, 12 m lattice in 9 modules, roof crane frame, red obstruction lamps | `tower_carriage` (origin y 78): translate along y. Its children `tower_carriage_arm_left/right` hinge at (+-7.6, 82, 7.5) world and turn about y. As modelled = closed (rails parallel at x +-5.7). Open = turn about 35 degrees outwards. `tower_qd_arm` hinges at (0, 94.2, 6.8) and turns about y to retract. |
| `tower_build` | 5 of 9 modules standing (second pad, under construction) | `tower_build_module_waiting`: the next module on cribbing at (20, 0, -6). Lift it with the crawler crane. |
| `launch_mount` | table top 20 m, 21 m table ring, 6 legs, 20 clamps, steel deluge plate with 36 water ports, 60 m pad, stair tower | `launch_mount_booster_qd`: hinge (0, 19, -8.8), turns about x to swing away |
| `test_stand` | suborbital stand: 10 m table on 4 legs, 31 m service tower | `test_stand_swing_arm`: hinge (2, 26, -13), turns about y |

## tanks.glb (1.3 MB): propellant farm. Ref: tank_farm.md

`tank_vertical_lox` (9 x 30 m), `tank_vertical_ch4` (9 x 26 m), `tank_vertical_n2` (7 x 18 m),
`tank_horizontal_long` (3.7 x 34 m, the 95,000 gal class), `tank_horizontal_short` (3.2 x 20 m), `tank_sphere`
(20 m sphere on 10 legs, 23 m tall), `vaporizer_bank` (12 finned columns, 8 m), `pump_skid`, `pipe_rack` (36 m,
lines along z). Static. Tank tops carry a red lamp.

## yard.glb (1.8 MB): build yard. Ref: high_bay.md

| Node | Real scale | Moving parts |
|---|---|---|
| `high_bay` | 25 x 30 m, 81 m (86 m with the crane house) | `high_bay_door0`: slide up along y |
| `mega_bay` | 45 x 60 m, 90 m | `mega_bay_door0`, `mega_bay_door1` |
| `mid_bay` | 40 x 80 m, 26 m | `mid_bay_door0` |
| `tent` | 30 x 60 m sprung tent | none |
| `office` | 30 x 14 m, 3 floors | none |

## vehicles.glb (6.5 MB): transporters, crane, crew vehicles. Refs: spmt.md, crawler_crane.md

| Node | Real scale | Moving parts |
|---|---|---|
| `spmt_stand` | 4 modules (9.8 m) x 8 axle lines, power pack at +z, upright stage stand | 32 `spmt_stand_bogie_<module>_<line>` nodes (kingpin pivot, turn about y to steer, twin wheels inside). Empty `spmt_stand_seat` at y 5.1 is where a stage's base sits. |
| `spmt_short` | 4 x 6 lines with the stand | 24 bogies, `spmt_short_seat` |
| `spmt_flat` | 2 x 6 lines, flat deck | 12 bogies |
| `crawler_crane` | 110 m lattice boom (109 m tall as modelled), 12 m crawlers | `crawler_crane_upper` (slews about y), its child `crawler_crane_boom` (foot pivot, modelled at 70 degrees, luff about x), `crawler_crane_hook` (rope and block, hangs from the boom tip with its pivot at the sheave; translate or scale along y) |
| `pickup_crew`, `pickup_single` | 5.4 x 2 m | `<name>_wheel_0..3`: spin about x |
| `crew_van` | 6.4 x 2 m | `crew_van_wheel_0..3` |
| `tanker_truck` | 18.6 m cryo tanker | `tanker_truck_wheel_0..17` |

## marine.glb (0.3 MB). Ref: recovery_boat.md

`recovery_boat` (62 x 14 m supply vessel, raised forecastle, forward deckhouse, open aft deck with a landing frame;
waterline y = 0, hull draft below y 0 to -1.5). Its `recovery_boat_aframe` stern frame has its feet at (0, 4.5, -29)
and turns about x. Also `range_boat` (14 m patrol boat, amber beacon) and `buoy` (range marker, amber light).

## props.glb (0.4 MB). Ref: weather_tower.md

`checkpoint` (booth, canopy, 4 jersey barriers, sign plate, amber flasher). Its `checkpoint_barrier_arm` pivots at
the post (-3.6, 1, 1.6), with a 6.5 m arm along +x that turns about z to lift. `weather_tower` (30 m three-leg
lattice, radome, anemometer booms, red beacon). `camera_mast` (20 m pole) with `camera_mast_head`, which turns
about y. `light_pole` (25 m, 4 lamp heads). `jersey_barrier` (3 m). `fence_panel` (3 m).

## Gaps

- No usable photos of a suborbital test stand were found (the search returned unrelated files, which were deleted).
  `test_stand` is derived from the launch-mount type.
- Many dimensions are photo estimates against a known size (9 m stage diameter, 1.8 m person, 2.4 m fence). Each sheet
  marks them "inferred". Overall vehicle and tower sizes have article sources.
- SPMT wheels are merged into their bogie, so they steer but do not spin. The crew vehicles' wheels do spin.
- The grid fin cells are a straight grid, not the real diagonal lattice.
