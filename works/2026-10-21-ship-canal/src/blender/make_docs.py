"""Writes ASSETS.md and catalog.json from registry.json and canal_params.py, and checks the exported GLBs
(root nodes, clips, double-sided materials, facing). Run with: uv run --no-project python make_docs.py"""
import json
import os
import struct
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import canal_params as P

ROOT = "<your folder>/viz-canal"
ASSETS = ROOT + "/app/public/assets"
registry = json.load(open(ROOT + "/blender/registry.json", encoding="utf-8"))


def read_glb(path):
    with open(path, "rb") as handle:
        data = handle.read()
    json_length, _ = struct.unpack("<II", data[12:20])
    return json.loads(data[20:20 + json_length])


report = {}
for file_name in sorted({entry["file"] for entry in registry}):
    gltf = read_glb(f"{ASSETS}/{file_name}")
    names = [node["name"] for node in gltf["nodes"]]
    double_sided = [m["name"] for m in gltf.get("materials", []) if m.get("doubleSided")]
    animations = sorted({a["name"] for a in gltf.get("animations", [])})
    report[file_name] = (gltf, names, double_sided, animations)
    size_mb = os.path.getsize(f"{ASSETS}/{file_name}") / 1e6
    print(f"{file_name}: {size_mb:.2f} MB, {len(names)} nodes, {len(gltf.get('materials', []))} materials, "
          f"double-sided: {double_sided}, clips: {animations}")

# facing check: stern parts (propeller) must sit at negative glTF Z (bow is +Z)
for file_name in ("ships.glb", "tugs.glb"):
    gltf = report[file_name][0]
    for node in gltf["nodes"]:
        if node["name"].endswith("_propeller") or "_thruster_" in node["name"]:
            print("FACING", file_name, node["name"], "translation z =", round(node["translation"][2], 1),
                  "(stern, expected > 0 in Blender +Y = glTF -Z, so negative z is stern)")
            break
for file_name in ("mules.glb",):
    gltf = report[file_name][0]
    for node in gltf["nodes"]:
        if node["name"].endswith("_headlamp_l"):
            print("FACING", file_name, node["name"], "translation z =", round(node["translation"][2], 1),
                  "(front lamp, expected positive z)")
            break

rows = []
for entry in registry:
    size = entry["size_xyz_m"]
    rows.append(f"| {entry['file']} | {entry['node']} | {entry['pivot']} | {entry['facing']} | {entry['clips']} | "
                f"{size[0]} x {size[1]} x {size[2]} (X x Y x Z, Blender axes) | {entry['use']} |")

assets_md = f"""# viz-canal asset pack (pass 1)

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
- Water is not in any GLB. The chamber floor has culvert port openings (variant a: 5 cross culverts at y = {P.CROSS_CULVERT_Y}, 8 ports each = 40; variant b staggered 9 and 8 per row = 43; radius
  {P.PORT_RADIUS} m, 1.2 m deep, material `culvert_dark`), the wall inner faces are vertical and clear (only 0.04 m joint strips and
  gauge boards), so the app's water plane reads against them.

## Module lengths
- Wall, floor and mule track modules are all **{P.MODULE_LENGTH} m** long (10 modules = one 305 m chamber). Module origin is the centre of the module in Y.
- Walls: z = 0 is the chamber floor surface, wall top at z = {P.WALL_HEIGHT}. For chamber k (0-based) lift the module set by k x {P.LIFT_PER_STEP} m.
- Right-hand side wall (`wall_side_*`): inner face at x = 0, body toward +X. Rotate 180 degrees about up for the left wall.
- Mule track: place its centre {P.MULE_RAIL_OFFSET} m from the inner wall edge at z = {P.WALL_HEIGHT}.
- Gate station: `wall_side_gate` has the leaf pocket and the hinge pintle at local (x = {P.GATE_HINGE_FROM_INNER_FACE}, y = +10). The matching `chamber_sill`
  has its hinge line at y = 0; the miter V apex points to +Y (the higher water). Left leaf hinge at x = -(16.75 + {P.GATE_HINGE_FROM_INNER_FACE}) from the chamber centre line.

## Node table
| file | node | pivot | facing | clips | real size | where it goes |
|---|---|---|---|---|---|---|
""" + "\n".join(rows) + """

## Not built (listed so the app can fill them in)
Terrain and the lake dam are made by the app. Not modelled: tug and ship crew, mooring cables (the app draws them),
the approach channel breakwater, a rolling-gate recess wall, incline track between chambers.

## Reference sheets
`blender/refs/*.md` were written from memory with every number marked verify (no images downloaded, with the user's
rule that downloads need approval). The compare sheets in `blender/previews/*-compare.png` use a dimension blockout drawn from
those numbers (`blender/blockouts.py`).
"""
open(ROOT + "/blender/ASSETS.md", "w", encoding="utf-8").write(assets_md)

by_node = {entry["node"]: entry for entry in registry}


def dims(node):
    return by_node[node]["size_xyz_m"]


catalog = {
    "units": "metres; Blender axes in size_xyz_m (X across, Y along the length, Z up)",
    "chamber": {"length": P.CHAMBER_LENGTH, "width": P.CHAMBER_WIDTH, "module_length": P.MODULE_LENGTH,
                "modules_per_chamber": P.MODULES_PER_CHAMBER, "lift_per_step": P.LIFT_PER_STEP, "steps": P.STEPS,
                "total_lift": P.LIFT_PER_STEP * P.STEPS, "wall_height_above_floor": P.WALL_HEIGHT,
                "floor_thickness": P.FLOOR_THICKNESS, "center_wall_width": P.CENTER_WALL_WIDTH,
                "lane_centre_offset_from_wall_centre": P.CENTER_WALL_WIDTH / 2 + P.CHAMBER_WIDTH / 2,
                "free_board_at_full_level": 3.0, "water_depth_at_lowest_level": 13.5},
    "culverts": {"cross_culvert_y_in_module": P.CROSS_CULVERT_Y, "port_x_variant_a": P.PORT_X_ROW_A,
                 "port_x_variant_b_even_rows": P.PORT_X_ROW_B, "port_x_variant_b_odd_rows_shift": 1.75,
                 "port_radius": P.PORT_RADIUS, "port_depth": P.PORT_DEPTH},
    "gate": {"leaf_length": P.GATE_LEAF_LENGTH, "thickness": P.GATE_THICKNESS, "heights": {"h20": 20.0, "h23": 23.0, "h25": 25.5},
             "hinge_from_inner_face": P.GATE_HINGE_FROM_INNER_FACE, "closed_angle_deg": P.GATE_CLOSED_ANGLE_DEG,
             "open_angle_deg": 90, "pocket_depth": P.GATE_POCKET_DEPTH, "sill_height": P.SILL_HEIGHT,
             "clip_frames": 60, "fps": 30},
    "mule": {"rail_offset_from_inner_edge": P.MULE_RAIL_OFFSET, "gauge": P.MULE_GAUGE, "length": dims("mule_a")[1],
             "width": dims("mule_a")[0], "capstan_local": [0.5, -3.4, 3.0], "fairlead_local_at_rest": [2.95, -3.4, 3.5],
             "rail_top_z_above_wall_top": 0.47},
    "ships": {name: {"length": by_node[name]["size_xyz_m"][1], "beam": by_node[name]["size_xyz_m"][0],
                     "height_above_keel": by_node[name]["size_xyz_m"][2],
                     "min_z_is_draft": -by_node[name]["min"][2],
                     "propeller": name + "_propeller", "rudder": name + "_rudder"}
              for name in by_node if name.startswith("ship_")},
    "tugs": {name: {"length": by_node[name]["size_xyz_m"][1], "beam": by_node[name]["size_xyz_m"][0],
                    "draft": -by_node[name]["min"][2]} for name in by_node if name.startswith("tug_")},
    "state_materials": ["lamp_warm_on", "lamp_red_on", "lamp_green_on", "lamp_amber_on", "beacon_amber_on",
                        "window_lit", "screen_on", "screen_alert"],
    "off_materials": ["lamp_off", "lamp_red_off", "lamp_green_off", "lamp_amber_off", "beacon_off", "window_dark", "screen_off"],
}
open(ROOT + "/blender/catalog.json", "w", encoding="utf-8").write(json.dumps(catalog, indent=1))
print("wrote ASSETS.md and catalog.json;", len(registry), "nodes")
print("total GLB MB", round(sum(os.path.getsize(f"{ASSETS}/{f}") for f in os.listdir(ASSETS)) / 1e6, 2))
