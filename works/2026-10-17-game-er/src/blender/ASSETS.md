# game-er asset pack (pass 1)

Seven GLBs in `app/public/assets/`, 7.8 MB total, built procedurally in Blender 5.2 from the scripts in this folder.
Look: toy isometric (light cool palette, brand blue `#2f6fe4`). Reference sheets: `refs/<asset>.md`; reference images
(30, Wikimedia Commons, licences listed in each sheet) stay in `refs/` and are never shown in the app or film.

Conventions for every file:
- Metres, y up, models face +z (forward), sit on y = 0. Each top-level node is one asset (or variant); clone it to
  instance. Moving parts are child nodes whose origin is the pivot.
- Material names the app may use: `triage` (patient tag, recolour per level 1-5: `#e5484d`, `#f5822a`, `#f2c94c`,
  `#30a46c`, `#3e8ee8`), `status` (bed or bay state lamp: free, occupied, cleaning), `glow_*` (emissive lamps and
  screens, bloom candidates), `glow_screen` (monitors and boards).
- Rebuild: `pwsh blender/run.ps1 blender/build_all.py [-ScriptArgs family ...]`, then `blender/preview.py`,
  `blender/compare_render.py` and `uv run --no-project --with pillow python blender/compose_compare.py`.
  Node inventory: `node blender/inspect_glb.mjs` (last output in `glb-inventory.txt`).

| GLB | Size | Script | Where it goes |
|---|---|---|---|
| vehicles.glb | 2.2 MB | vehicles.py | ambulance bay, road, arrivals |
| helicopter.glb | 0.7 MB | helicopter.py | helipad arrivals |
| beds.glb | 0.9 MB | beds.py | cubicles, resus, corridors, porter moves, ambulance unloading |
| imaging.glb | 0.5 MB | imaging.py | CT and X-ray rooms |
| furniture.glb | 1.8 MB | furniture.py | waiting room, triage, nurses' station, cubicles, resus, lab |
| building.glb | 0.8 MB | building.py | shell, entrances, canopy, helipad, site |
| people.glb | 1.1 MB | people.py | staff and visitors everywhere |

## vehicles.glb

Origin on the ground at the middle of the wheelbase. Wheels spin about x; rear wheels are one object per side (dual).

| Node | Real scale | Moving children (pivot) |
|---|---|---|
| amb_type3_a | Type III ambulance, 7.3 x 2.7 (mirrors) x 3.1 m, wheelbase 4.0 m; white, blue band, orange stripe | `_wheel_fl/fr/rl/rr` (axle), `_door_rear_l/r` (outer hinge, swing about y), `_door_side` (kerb side -x, hinge at front edge), `_lightbar` and `_cab_lightbar` (flash) |
| amb_type3_b | same body, navy band, red stripe, other roof units | same names with `amb_type3_b_` |
| amb_van | Type II high-roof van, 6.5 x 2.5 x 2.9 m, wheelbase 3.65 m | `_wheel_*`, `_door_rear_l/r`, `_door_side`, `_lightbar` |

## helicopter.glb

Origin on the ground under the rotor mast (mast at z +0.2). Fuselage 10.2 m, rotor 10.2 m, height 3.5 m.

| Node | Moving children (pivot) |
|---|---|
| heli_a (blue belly, orange line), heli_b (navy belly, red line) | `_rotor_main` (hub at y 3.3, spin about y), `_rotor_tail` (fan centre y 2.05 z -6.0, spin about x), `_door_clam_l/r` (rear clamshells, outer hinge) |

## beds.glb

Head end to +z, origin on the floor under the deck centre. Backrest hinge on every bed is the line z = +0.25 at the
deck top; positive rotation about x lifts the head.

| Node | Real scale | Moving children |
|---|---|---|
| stretcher_ed | ED stretcher 2.1 x 0.75 m, deck 0.72 m, IV pole, O2 bottle | `_backrest`, `_castor_fl/fr/rl/rr` |
| stretcher_cot | ambulance cot 2.27 x 0.63 m (with handles), deck 0.92 m, X frame | `_backrest`, `_castor_*` |
| bed_ward | acute bed 2.29 x 1.04 m, deck 0.60 m, boards, split rails | `_backrest`, `_castor_*`, `_status` (foot-board lamp, `status`), `_head_rails` |
| patient_a/b/c | covered figures 1.72 / 1.60 / 1.80 m, three blanket colours and hair/skin tones | `_upper` (chest, head, pillow; hinge at z +0.25, tilt with the backrest), `_legs`, `_tag` (`triage`) |
| wheelchair | transport chair 0.67 x 0.89 m, 0.60 m wheels | `_wheel_l/r` (spin about x), `_castor_l/r` |

Place a patient on a bed by putting its root at the bed root plus the deck top height (0.72, 0.92 or 0.60 m).

## imaging.glb

| Node | Real scale | Moving children |
|---|---|---|
| ct_scanner | gantry 2.1 x 1.97 x 0.95 m, bore 0.78 m at 1.03 m, couch to z +2.85 | `_table` (slides along -z into the bore), `_status` (ring light around the bore, `status`) |
| ct_console | desk 1.6 x 0.75 m, two monitors, chair | none |
| xray_room | floor-mounted tube stand on a 3 m rail, 2.2 m table, wall bucky stand, generator; 3.3 x 2.5 x 3.7 m | `_column` (slides along z), `_tube` (moves along y), `_detector` (moves along y) |
| lead_screen | mobile lead screen 1.0 x 1.55 m | none |

## furniture.glb

| Node | Real scale | Moving children |
|---|---|---|
| triage_desk | two-sided booth 1.8 x 0.75 m, glass screen, staff and patient chairs | none |
| nurses_station | L counter 4.0 m + 1.6 m return, 4 monitors, 3 chairs, tracking board 2.3 m up | `_board` (`glow_screen`) |
| seats_row3, seats_row4 | beam seating, 0.58 m per place, two colours | none |
| side_table, checkin_kiosk | 0.5 m table; kiosk 1.58 m with screen | none |
| cubicle | 2.6 x 3.0 m bay, headwall (gases, sockets, light), monitor, chair, low partition | `_curtain` (hinge x +1.25, scale x to draw), `_status` |
| resus_bay | 3.6 x 4.0 m bay, procedure light, ventilator cart, monitor tower with defibrillator, floor box marking | `_status`, `_vent_castorl/r` |
| crash_cart | 0.8 x 0.65 m, five drawers, defibrillator | `_castor_*` |
| monitor_stand, iv_pole, workstation_cart | rolling stands, 1.4-2.0 m | workstation `_castor_*` |
| lab_analyzer | 1.5 x 0.8 x 1.2 m chemistry analyser | `_rotor` (sample carousel, spin about y) |
| lab_bench | 2.4 m bench, centrifuge, microscope | `_lid` (centrifuge lid, hinge at its back edge) |
| sign_plate_a (red), sign_plate_b (blue) | blank lit sign plates on posts, 2.5 and 1.7 m wide, 2.95 m high; no text, the app draws its own | none |

## building.glb

Module grid 4 m, floor-to-floor 4.2 m, outside face +z.

| Node | Real scale | Moving children |
|---|---|---|
| wall_low | 4.0 x 1.2 m cutaway interior wall | none |
| wall_full, wall_window, wall_corner | 4.0 x 4.2 m cladding wall, ribbon-window wall, 0.5 m column | none |
| floor_tile, floor_tile_alt | 4 x 4 m vinyl, top at y 0 | none |
| entrance_walkin | 6 m glass vestibule, curved canopy to z +4.6 | `_door_l/_door_r` (slide along x from the closed position) |
| entrance_ambulance | 4 m bay doors with red-lit hood and ramp | `_door_l/_door_r` |
| ambulance_canopy | 9 x 10 m drive-through canopy, 4.3 m clearance, clearance bar | none |
| helipad | 18 m pad, 12 m touchdown square, own cross-and-H marking, green edge lights, floodlights | `_windsock` (pivot at the mast top, turn about y) |
| road_tile, parking_mark | 8 x 8 m road with kerbs and lane dashes; 3.3 x 7.5 m bay | none |
| bollard, lamp_post (6 m), bench, shrub, tree_a/b/c | site props, three tree shapes | none |

## people.glb

Each root holds an armature `<root>_rig` (bones hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R)
with rigid parts on the bones. 1.75 m, facing +z. Clips per root, 24 fps, named `<root>_<clip>`:
`idle` (2 s), `walk` (1 s loop at 1.4 m/s), `push_bed` (1 s loop, hands at bed-handle height, 1.0 m/s),
`chart` (2 s, tablet in the left hand for nurse and doctor), `sit` (2 s loop, hips 0.42 m lower for a 0.45 m seat).

| Node | Look |
|---|---|
| staff_nurse | teal scrubs, stethoscope, tablet, white clogs |
| staff_doctor | navy scrubs and scrub cap, stethoscope, tablet |
| staff_porter | grey polo, dark trousers (pushes beds) |
| staff_paramedic | dark green uniform with reflective bands |
| visitor | casual clothes, for the waiting room (use `sit`) |

## Checks done

- Contact sheets (`previews/<glb>.png`, three angles, back-face culling on) and compare sheets
  (`previews/<asset>-compare.png`, reference photos next to side and three-quarter renders with a 1.75 m post) for
  all 12 main assets were looked at. Fixed from them: helicopter glazing covering the whole pod (lib `cut_loft`
  slot bug in Blender 5.2), helicopter skid legs leaning the wrong way and floating, cabin glazing too small, van
  band wrapping the nose, Type III step bumper floating, paramedic bands and waist hem sticking out.
- Known simplifications: the X-ray tube stand is the floor-mounted type (a ceiling-rail stand would float in a
  cutaway room); the resus procedure light stands on the floor for the same reason; the bed's head rails stay on
  the frame instead of riding with the backrest; Workbench previews show white paint as mid grey.
