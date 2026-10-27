# viz-canal asset pack (pass 1)

Look: toy isometric. Everything is procedural (Blender 5.2 scripts in `blender/build_*.py`, shared code in `blender/lib.py`),
PBR materials with backface culling on, UVs by box projection, small baked noise textures on concrete.
Units are metres. glTF is Y-up: Blender +Z (up) becomes +Y, Blender -Y (the way vehicles and vessels face) becomes +Z.

## Conventions
- Facing: every vessel and mule faces **Blender -Y = glTF +Z**; the bow is at +Z, the stern at -Z. Checked against the exported files
  (propeller node translation z is negative, mule headlamp z is positive).
- Every asset is a root node at the origin of its own coordinate system; position it in the app by name. Do not use the
  node translations of the roots, they are zero.
- Moving parts are child nodes named `<root>_<part>` with the node origin on the hinge or axis.
- Clips (glTF animations, exported from NLA tracks, 30 fps): `gate_open`, `gate_close`, `valve_open`, `valve_close`,
  `prop_spin`, `rudder_swing`, `wheel_roll`, `capstan_spin`, `arm_swing_out`, `thruster_steer`, `radar_sweep`. The app may also drive
  the node rotations directly: closed gate leaf rest rotation about Z is +17.1 degrees (left leaf) and -17.1 degrees (right leaf).
- Anything the app switches has its own material per state. Lamps and windows are separate nodes (`*_lamp_*`, `*_windows`,
  `*_screens`) that start on the `off` material; the `on` materials live on the `state_materials` swatch node of `site.glb`
  (`lamp_warm_on`, `lamp_red_on`, `lamp_green_on`, `lamp_amber_on`, `beacon_amber_on`, `window_lit`, `screen_on`,
  `screen_alert`). Swap by material name.
- Water is not in any GLB. The chamber floor has culvert port openings (variant a: 5 cross culverts at y = [-12.2, -6.1, 0.0, 6.1, 12.2], 8 ports each = 40; variant b staggered 9 and 8 per row = 43; radius
  0.5 m, 1.2 m deep, material `culvert_dark`), the wall inner faces are vertical and clear (only 0.04 m joint strips and
  gauge boards), so the app's water plane reads against them.

## Module lengths
- Wall, floor and mule track modules are all **30.5 m** long (10 modules = one 305 m chamber). Module origin is the centre of the module in Y.
- Walls: z = 0 is the chamber floor surface, wall top at z = 25.0. For chamber k (0-based) lift the module set by k x 8.5 m.
- Right-hand side wall (`wall_side_*`): inner face at x = 0, body toward +X. Rotate 180 degrees about up for the left wall.
- Mule track: place its centre 2.5 m from the inner wall edge at z = 25.0.
- Gate station: `wall_side_gate` has the leaf pocket and the hinge pintle at local (x = 1.6, y = +10). The matching `chamber_sill`
  has its hinge line at y = 0; the miter V apex points to +Y (the higher water). Left leaf hinge at x = -(16.75 + 1.6) from the chamber centre line.

## Node table
| file | node | pivot | facing | clips | real size | where it goes |
|---|---|---|---|---|---|---|
| mules.glb | mule_a | top of the rail under the mule centre; children wheel_* pivot at the axle, capstan at the drum axis, cable_arm at its hinge | faces -Y (hood at -Y, cab behind); ship side = +X | wheel_roll, capstan_spin, arm_swing_out (1 s loops at 30 fps) | 4.88 x 11.2 x 5.53 (X x Y x Z, Blender axes) | electric towing locomotive 10.4 x 3.3 x 5.2 m on the wall-top track; hands the line to the ship |
| mules.glb | mule_b | top of the rail under the mule centre; children wheel_* pivot at the axle, capstan at the drum axis, cable_arm at its hinge | faces -Y (hood at -Y, cab behind); ship side = +X | wheel_roll, capstan_spin, arm_swing_out (1 s loops at 30 fps) | 4.88 x 11.2 x 5.53 (X x Y x Z, Blender axes) | electric towing locomotive 10.4 x 3.3 x 5.2 m on the wall-top track; hands the line to the ship |
| mules.glb | mule_c | top of the rail under the mule centre; children wheel_* pivot at the axle, capstan at the drum axis, cable_arm at its hinge | faces -Y (hood at -Y, cab behind); ship side = +X | wheel_roll, capstan_spin, arm_swing_out (1 s loops at 30 fps) | 4.88 x 11.2 x 5.53 (X x Y x Z, Blender axes) | electric towing locomotive 10.4 x 3.3 x 5.2 m on the wall-top track; hands the line to the ship |
| ships.glb | ship_cargo_a | midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top | bow toward -Y (blender) = +Z (glTF); stern +Y | prop_spin (30 f loop), rudder_swing (60 f) | 34.4 x 301.1 x 46.58 (X x Y x Z, Blender axes) | cargo a ship, 294 m long, at design draft |
| ships.glb | ship_cargo_b | midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top | bow toward -Y (blender) = +Z (glTF); stern +Y | prop_spin (30 f loop), rudder_swing (60 f) | 34.4 x 301.1 x 46.58 (X x Y x Z, Blender axes) | cargo b ship, 294 m long, at design draft |
| ships.glb | ship_tanker_a | midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top | bow toward -Y (blender) = +Z (glTF); stern +Y | prop_spin (30 f loop), rudder_swing (60 f) | 33.48 x 232.6 x 42.78 (X x Y x Z, Blender axes) | tanker a ship, 229 m long, at design draft |
| ships.glb | ship_tanker_b | midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top | bow toward -Y (blender) = +Z (glTF); stern +Y | prop_spin (30 f loop), rudder_swing (60 f) | 33.48 x 232.6 x 42.78 (X x Y x Z, Blender axes) | tanker b ship, 229 m long, at design draft |
| ships.glb | ship_bulk_a | midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top | bow toward -Y (blender) = +Z (glTF); stern +Y | prop_spin (30 f loop), rudder_swing (60 f) | 33.46 x 229.0 x 41.68 (X x Y x Z, Blender axes) | bulk a ship, 225 m long, at design draft |
| site.glb | control_house_a | ground footprint centre, z=0 at ground (buoys at the waterline) | door on -Y | none | 10.4 x 10.4 x 7.8 (X x Y x Z, Blender axes) | control house on the centre wall, one floor, 10.4 x 8.4 x 5 m; *_windows swaps window_dark to window_lit |
| site.glb | control_house_b | ground footprint centre, z=0 at ground (buoys at the waterline) | door on -Y | none | 10.4 x 10.4 x 10.8 (X x Y x Z, Blender axes) | control house on the centre wall, two floors with radar dome, 10.4 x 8.4 x 9 m |
| site.glb | control_center | ground footprint centre, z=0 at ground (buoys at the waterline) | entrance on -Y | radar_sweep (90 f loop) | 71.5 x 33.75 x 36.6 (X x Y x Z, Blender axes) | canal control center 66 x 32 x 40 m; *_screens swaps screen_off to screen_on or screen_alert; *_radar sweeps |
| site.glb | light_tower | ground footprint centre, z=0 at ground (buoys at the waterline) | lamps face -Y | none | 3.2 x 1.78 x 18.35 (X x Y x Z, Blender axes) | floodlight tower 18 m; *_lamps swaps lamp_off to lamp_warm_on |
| site.glb | buoy_red | ground footprint centre, z=0 at ground (buoys at the waterline) | none | none | 1.97 x 1.98 x 6.0 (X x Y x Z, Blender axes) | channel buoy, 4 m; *_lamp swaps lamp_red_off to lamp_red_on |
| site.glb | buoy_green | ground footprint centre, z=0 at ground (buoys at the waterline) | none | none | 1.97 x 1.98 x 6.0 (X x Y x Z, Blender axes) | channel buoy, 4 m; *_lamp swaps lamp_green_off to lamp_green_on |
| site.glb | state_materials | ground footprint centre, z=0 at ground (buoys at the waterline) | none | none | 3.0 x 0.2 x 0.2 (X x Y x Z, Blender axes) | swatch node: carries the 'on' materials so the app can reuse them by name |
| lock_equipment.glb | gate_h20_L | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local +X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 21.25 (X x Y x Z, Blender axes) | miter gate leaf L, 20 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_h20_R | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local -X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 21.25 (X x Y x Z, Blender axes) | miter gate leaf R, 20 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_h23_L | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local +X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 24.25 (X x Y x Z, Blender axes) | miter gate leaf L, 23 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_h23_R | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local -X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 24.25 (X x Y x Z, Blender axes) | miter gate leaf R, 23 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_h25_L | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local +X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 26.75 (X x Y x Z, Blender axes) | miter gate leaf L, 25 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_h25_R | hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y) | leaf extends along local -X; skin plate on -Y, girders on +Y; rest pose = closed | gate_open, gate_close (60 frames at 30 fps) | 2.98 x 20.19 x 26.75 (X x Y x Z, Blender axes) | miter gate leaf R, 25 m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg |
| lock_equipment.glb | gate_rolling | centre of the gate at floor level (slides along X) | gate faces along Y; slides along X | none (app slides it) | 35.0 x 7.45 x 25.5 (X x Y x Z, Blender axes) | rolling gate 35 x 7 x 24 m |
| lock_equipment.glb | valve_house_a | house base centre at the floor; children valve_*_stem pivot at the top of the stem, *_wheel at its axis | door on -Y | valve_open, valve_close (45 frames) | 3.7 x 3.42 x 6.4 (X x Y x Z, Blender axes) | culvert valve house 3.4 x 3.0 x 4 m; lamps lamp_open / lamp_closed swap materials |
| lock_equipment.glb | valve_house_b | house base centre at the floor; children valve_*_stem pivot at the top of the stem, *_wheel at its axis | door on -Y | valve_open, valve_close (45 frames) | 3.7 x 3.42 x 6.4 (X x Y x Z, Blender axes) | culvert valve house 3.4 x 3.0 x 4 m; lamps lamp_open / lamp_closed swap materials |
| lock_equipment.glb | signal_post_a | pole foot | lamps face -Y | none (app swaps lamp materials) | 0.7 x 0.77 x 7.2 (X x Y x Z, Blender axes) | chamber signal post, 6 m, lamp objects are separate nodes |
| lock_equipment.glb | signal_post_b | pole foot | lamps face -Y | none (app swaps lamp materials) | 0.7 x 0.77 x 6.85 (X x Y x Z, Blender axes) | chamber signal post, 6 m, lamp objects are separate nodes |
| tugs.glb | tug_a | midship centre line at the waterline; *_thruster_l/r pivot on the steering axis | bow toward -Y (blender) = +Z (glTF) | thruster_steer (60 f) | 11.59 x 33.2 x 16.15 (X x Y x Z, Blender axes) | azimuth harbour tug 32 x 11 m, draft 4.8 m, for the approach channel and lake side |
| tugs.glb | tug_b | midship centre line at the waterline; *_thruster_l/r pivot on the steering axis | bow toward -Y (blender) = +Z (glTF) | thruster_steer (60 f) | 11.59 x 33.2 x 16.15 (X x Y x Z, Blender axes) | azimuth harbour tug 32 x 11 m, draft 4.8 m, for the approach channel and lake side |
| lock_structure.glb | wall_side_a | inner face x=0, floor level z=0, module centre y=0; right-hand wall (outer side +X), rotate 180 deg about Z for the left wall | none: long axis along Y, symmetric |  | 15.03 x 30.5 x 28.25 (X x Y x Z, Blender axes) | side wall module, 30.5 m long, 25 m above the chamber floor |
| lock_structure.glb | wall_side_b | inner face x=0, floor level z=0, module centre y=0; right-hand wall (outer side +X), rotate 180 deg about Z for the left wall | none: long axis along Y, symmetric |  | 15.17 x 30.5 x 34.2 (X x Y x Z, Blender axes) | side wall module, 30.5 m long, 25 m above the chamber floor |
| lock_structure.glb | wall_side_c | inner face x=0, floor level z=0, module centre y=0; right-hand wall (outer side +X), rotate 180 deg about Z for the left wall | none: long axis along Y, symmetric |  | 15.03 x 30.5 x 34.2 (X x Y x Z, Blender axes) | side wall module, 30.5 m long, 25 m above the chamber floor |
| lock_structure.glb | wall_side_gate | inner face x=0, floor z=0; gate hinge pintle at local (x=1.6, y=+10.0); pocket for the open leaf runs from y=+11.5 back to y=-9.5 | none: long axis along Y, symmetric |  | 15.03 x 30.5 x 28.25 (X x Y x Z, Blender axes) | side wall module with the gate pocket where a miter leaf lies when open |
| lock_structure.glb | wall_center_a | centre of the wall x=0, floor level z=0, module centre y=0 | none: long axis along Y, symmetric |  | 18.06 x 30.5 x 28.23 (X x Y x Z, Blender axes) | centre wall between the two lanes, 18 m wide, 25 m above the chamber floor |
| lock_structure.glb | chamber_floor_a | chamber centre line x=0, floor surface z=0, module centre y=0 | none: long axis along Y, symmetric |  | 33.5 x 30.5 x 3.0 (X x Y x Z, Blender axes) | chamber floor slab with culvert ports: 40 in variant a (5 rows x 8), 43 in variant b (staggered 9/8 rows) |
| lock_structure.glb | wall_center_b | centre of the wall x=0, floor level z=0, module centre y=0 | none: long axis along Y, symmetric |  | 18.34 x 30.5 x 34.2 (X x Y x Z, Blender axes) | centre wall between the two lanes, 18 m wide, 25 m above the chamber floor |
| lock_structure.glb | chamber_floor_b | chamber centre line x=0, floor surface z=0, module centre y=0 | none: long axis along Y, symmetric |  | 33.5 x 30.5 x 3.0 (X x Y x Z, Blender axes) | chamber floor slab with culvert ports: 40 in variant a (5 rows x 8), 43 in variant b (staggered 9/8 rows) |
| lock_structure.glb | chamber_sill | chamber centre x=0, gate hinge line y=0, lower floor z=0 (top at z=8.5) | none: long axis along Y, symmetric |  | 36.86 x 11.0 x 12.5 (X x Y x Z, Blender axes) | sill block between two chambers, step height 8.5 m, miter ridge pointing to +Y |
| lock_structure.glb | mule_track_a | track centre line x=0, sleeper bottom z=0, module centre y=0 | none: long axis along Y, symmetric |  | 2.3 x 30.5 x 0.5 (X x Y x Z, Blender axes) | mule track with centre rack, gauge 1.5 m, 30.5 m module (sits on the wall top 2.5 m from the inner edge) |
| lock_structure.glb | mule_track_b | track centre line x=0, sleeper bottom z=0, module centre y=0 | none: long axis along Y, symmetric |  | 3.8 x 30.5 x 0.5 (X x Y x Z, Blender axes) | mule track with centre rack, gauge 1.5 m, 30.5 m module (sits on the wall top 2.5 m from the inner edge) |

## Not built (listed so the app can fill them in)
Terrain and the lake dam are made by the app. Not modelled: tug and ship crew, mooring cables (the app draws them),
the approach channel breakwater, a rolling-gate recess wall, incline track between chambers.

## Reference sheets
`blender/refs/*.md` were written from memory with every number marked verify (no images downloaded, with the user's
rule that downloads need approval). The compare sheets in `blender/previews/*-compare.png` use a dimension blockout drawn from
those numbers (`blender/blockouts.py`).
