"""Lock structure family -> lock_structure.glb (walls, center wall, floor, sill, mule track). Run with Blender."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *
import canal_params as P

reset_scene()
M = P.MODULE_LENGTH
H = P.WALL_HEIGHT
half = M / 2

concrete = textured_material("concrete_light", "#c9ced6", 0.10, 0.9, seed=1)
concrete_dark = textured_material("concrete_dark", "#9aa3b0", 0.12, 0.95, seed=2)
concrete_floor = textured_material("concrete_floor", "#8d97a5", 0.14, 0.95, seed=4)
joint = make_material("joint_dark", "#5d6672", 1.0)
culvert_dark = make_material("culvert_dark", "#1c2430", 1.0)
kerb_yellow = make_material("kerb_yellow", "#f2c230", 0.8)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
rail_steel = make_material("rail_steel", "#4d5560", 0.45, 0.8)
rack_steel = make_material("rack_steel", "#b9772f", 0.5, 0.7)
gauge_black = make_material("gauge_black", "#20262e", 0.8)
gauge_white = make_material("gauge_white", "#f1f3f6", 0.8)
hatch = make_material("hatch_cover", "#5b6572", 0.6, 0.5)
lamp_glow = make_material("lamp_warm_on", "#ffe9b0", 0.4, emission_hex="#ffd98a", emission_strength=4.0)
lamp_post_mat = make_material("lamp_post_grey", "#5a636f", 0.6, 0.4)
sleeper = textured_material("sleeper_concrete", "#aab1bb", 0.10, 0.9, seed=7)


def side_wall_outline():
    return [(0, -3), (15, -3), (15, 5), (11, 5), (11, 12), (8.5, 12), (8.5, 19), (6.5, 19), (6.5, 24.5),
            (5.9, H), (0.3, H), (0, H - 0.3)]


def add_joints(part, face_x, toward):
    """Expansion joints (vertical) and construction joints (horizontal) as thin proud strips on a wall face.
    toward is +1 or -1: the direction from the face into the water."""
    x = face_x + 0.012 * toward
    for y in (-half + 0.06, 0.0, half - 0.06):
        part.box((x, y, H / 2 - 1.5), (0.04, 0.12, H - 3.0), joint)
    for z in (5.0, 10.0, 15.0, 20.0):
        part.box((x, 0, z), (0.04, M - 0.3, 0.1), joint)


def add_ladder(part, face_x, toward, y):
    x = face_x + 0.12 * toward
    for offset in (-0.25, 0.25):
        part.box((x, y + offset, H / 2 - 0.5), (0.1, 0.06, H - 1.0), steel)
    z = 0.4
    while z < H - 1.0:
        part.box((x, y, z), (0.1, 0.5, 0.04), steel)
        z += 0.3


def add_gauge(part, face_x, toward, y):
    x = face_x + 0.03 * toward
    for index in range(int(H)):
        material = gauge_black if index % 2 == 0 else gauge_white
        part.box((x, y, index + 0.5), (0.06, 0.7, 1.0), material)


def add_lamp_post(part, x, y, z):
    part.cylinder((x, y, z + 3.0), 0.12, 6.0, lamp_post_mat, segments=8)
    part.box((x, y, z + 6.1), (0.5, 0.9, 0.2), lamp_post_mat, bevel=0.04)
    part.box((x, y, z + 5.94), (0.4, 0.8, 0.08), lamp_glow)


def add_bollard(part, x, y, z):
    part.cylinder((x, y, z + 0.1), 0.65, 0.2, steel, segments=14)
    part.cylinder((x, y, z + 0.7), 0.32, 1.0, steel, segments=14, bevel=0.04)
    part.cylinder((x, y, z + 1.25), 0.45, 0.2, steel, segments=14, bevel=0.05)


def add_manhole(part, x, y, z):
    part.cylinder((x, y, z + 0.03), 0.6, 0.06, hatch, segments=16)


def side_wall(name, variant, pocket=False):
    part = Part(name)
    if not pocket:
        part.prism(side_wall_outline(), -half, half, concrete)
    else:
        # gate pocket: the open leaf lies in a recess P.GATE_POCKET_DEPTH deep, from y = -9.5 to y = +11.5
        pocket_start = 11.5 - (P.GATE_LEAF_LENGTH + 1.8)
        pocket_end = 11.5
        depth = P.GATE_POCKET_DEPTH
        part.prism(side_wall_outline(), -half, pocket_start, concrete)
        part.prism(side_wall_outline(), pocket_end, half, concrete)
        recessed = [(0, -3), (15, -3), (15, 5), (11, 5), (11, 12), (8.5, 12), (8.5, 19), (6.5, 19), (6.5, 24.5),
                    (5.9, H), (depth, H), (depth, 0), (0, 0)]
        part.prism(recessed, pocket_start, pocket_end, concrete_dark)
    part.box((0.5, 0, H + 0.1), (1.0, M - 0.2, 0.25), kerb_yellow, bevel=0.06)         # kerb strip on the edge
    part.box((3.6, 0, H - 0.03), (3.8, M - 0.1, 0.06), concrete_dark)                  # worked top surface
    part.box((5.3, 0, H + 0.1), (0.3, M - 0.1, 0.3), concrete_dark, bevel=0.05)        # outer curb
    add_joints(part, 0.0, -1)
    if variant == "b":
        add_ladder(part, 0.0, -1, -half + 3.0)
        add_ladder(part, 0.0, -1, half - 3.0)
        add_gauge(part, 0.0, -1, 0.0)
        add_lamp_post(part, 5.2, -8.0, H)
    if variant == "c":
        add_bollard(part, 1.0, -9.0, H)
        add_bollard(part, 1.0, 9.0, H)
        add_manhole(part, 4.3, -4.0, H)
        add_manhole(part, 4.3, 4.0, H)
        add_manhole(part, 4.3, 12.0, H)
        add_lamp_post(part, 5.2, 4.0, H)
    return part


def center_wall(name, variant):
    part = Part(name)
    width = P.CENTER_WALL_WIDTH / 2
    part.prism([(-width, -3), (width, -3), (width, H), (-width, H)], -half, half, concrete)
    for sign in (-1, 1):
        part.box((sign * (width - 0.5), 0, H + 0.1), (1.0, M - 0.2, 0.25), kerb_yellow, bevel=0.06)
        part.box((sign * (width - 3.5), 0, H - 0.03), (4.0, M - 0.1, 0.06), concrete_dark)
        add_joints(part, sign * width, sign)
    part.box((0, 0, H - 0.02), (3.0, M - 0.1, 0.05), concrete_dark)                     # central service strip
    if variant == "b":
        for sign in (-1, 1):
            add_gauge(part, sign * width, sign, 0.0)
            add_ladder(part, sign * width, sign, half - 3.0)
            add_ladder(part, sign * width, sign, -half + 3.0)
        add_lamp_post(part, 0, -8.0, H)
        add_lamp_post(part, 0, 8.0, H)
        for y in (-5.0, 5.0):
            part.box((0, y, H + 0.25), (2.4, 2.4, 0.5), concrete_dark, bevel=0.08)      # valve-house plinths
            part.box((0, y, H + 0.55), (1.6, 1.6, 0.1), hatch)
    else:
        add_manhole(part, 0, 0, H)
    return part


def chamber_floor(name, variant):
    part = Part(name)
    width = P.CHAMBER_WIDTH
    part.box((0, 0, -P.FLOOR_THICKNESS / 2), (width, M, P.FLOOR_THICKNESS), concrete_floor)
    part.slot(culvert_dark)
    obj = part.build(location=(0, 0, 0))
    ports_x = P.PORT_X_ROW_A if variant == "a" else P.PORT_X_ROW_B
    cutter = Part(name + "_cut")
    for row, y in enumerate(P.CROSS_CULVERT_Y):
        xs = ports_x
        if variant == "b" and row % 2 == 1:
            xs = [x + 1.75 for x in ports_x[:-1]]
        for x in xs:
            cutter.cylinder((x, y, -P.PORT_DEPTH / 2 + 0.05), P.PORT_RADIUS, P.PORT_DEPTH + 0.5, culvert_dark,
                            segments=16)
    cutter_obj = cutter.build(location=(0, 0, 0))
    modifier = obj.modifiers.new("ports", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.object = cutter_obj
    modifier.solver = "EXACT"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="ports")
    bpy.data.objects.remove(cutter_obj, do_unlink=True)
    dark_index = obj.data.materials.find("culvert_dark")
    for polygon in obj.data.polygons:
        centre = polygon.center
        interior = abs(centre.x) < width / 2 - 0.02 and abs(centre.y) < half - 0.02
        if interior and -P.PORT_DEPTH - 0.1 < centre.z < -0.005:
            polygon.material_index = dark_index
    obj.data.shade_flat()          # big boolean fans shade badly when smooth; ports stay crisp
    return obj


def chamber_sill(name):
    part = Part(name)
    width = P.CHAMBER_WIDTH
    part.box((0, 3.5, (P.SILL_HEIGHT - 3.0) / 2), (width, 11.0, P.SILL_HEIGHT + 3.0), concrete_dark, bevel=0.25)
    part.box((0, 3.5, P.SILL_HEIGHT - 0.01), (width - 0.4, 10.6, 0.04), concrete_floor)
    # V-shaped miter sill ridge: apex points to +Y (higher water), hinge line is y = 0
    angle = math.radians(P.GATE_CLOSED_ANGLE_DEG)
    reach = (width / 2 + P.GATE_HINGE_FROM_INNER_FACE) / math.cos(angle)
    for sign in (-1, 1):
        mid_x = sign * (width / 2 + P.GATE_HINGE_FROM_INNER_FACE) / 2
        mid_y = reach * math.sin(angle) / 2
        part.box((mid_x, mid_y, P.SILL_HEIGHT + 0.25), (reach, 0.7, 0.5), steel, bevel=0.08,
                 rot_z=-sign * angle)
    for sign in (-1, 1):                                                                    # hinge pintle blocks
        part.box((sign * (width / 2 + 0.2), 0, P.SILL_HEIGHT + 0.5), (1.2, 1.2, 1.0), steel, bevel=0.1)
    return part


def mule_track(name, variant):
    part = Part(name)
    gauge = P.MULE_GAUGE
    count = int(M / 1.0)
    for index in range(count):
        y = -half + 0.5 + index
        part.box((0, y, 0.12), (2.3, 0.35, 0.24), sleeper, bevel=0.03)
    for sign in (-1, 1):
        part.box((sign * gauge / 2, 0, 0.24 + 0.1), (0.14, M, 0.2), rail_steel, bevel=0.02)
        part.box((sign * gauge / 2, 0, 0.24 + 0.23), (0.2, M, 0.06), rail_steel)
    part.box((0, 0, 0.24 + 0.08), (0.14, M, 0.16), rack_steel)
    for index in range(int(M / 0.3)):
        y = -half + 0.15 + index * 0.3
        part.box((0, y, 0.24 + 0.19), (0.12, 0.14, 0.06), rack_steel)                      # rack teeth
    if variant == "b":
        for index in range(3):
            y = -half + 4.0 + index * 11.0
            part.box((1.5, y, 0.14), (0.8, 2.0, 0.28), hatch, bevel=0.03)                   # cable pit covers
            part.box((-1.5, y, 0.14), (0.8, 2.0, 0.28), hatch, bevel=0.03)
    return part


nodes = []


def finish(root_name, part_or_obj, pivot, use, clips=""):
    root = make_root(root_name)
    obj = part_or_obj if isinstance(part_or_obj, bpy.types.Object) else part_or_obj.build()
    obj.name = root_name + "_mesh"
    obj.parent = root
    register("lock_structure.glb", root, pivot, "none: long axis along Y, symmetric", clips, use)
    nodes.append(root)


for variant in "abc":
    finish(f"wall_side_{variant}", side_wall(f"wall_side_{variant}_part", variant),
           "inner face x=0, floor level z=0, module centre y=0; right-hand wall (outer side +X), rotate 180 deg about Z for the left wall",
           "side wall module, 30.5 m long, 25 m above the chamber floor")

gate_wall_obj = side_wall("wall_side_gate_part", "a", pocket=True)
finish("wall_side_gate", gate_wall_obj,
       "inner face x=0, floor z=0; gate hinge pintle at local (x=1.6, y=+10.0); pocket for the open leaf runs from y=+11.5 back to y=-9.5",
       "side wall module with the gate pocket where a miter leaf lies when open")

for variant in "ab":
    finish(f"wall_center_{variant}", center_wall(f"wall_center_{variant}_part", variant),
           "centre of the wall x=0, floor level z=0, module centre y=0",
           "centre wall between the two lanes, 18 m wide, 25 m above the chamber floor")
    obj = chamber_floor(f"chamber_floor_{variant}_part", variant)
    finish(f"chamber_floor_{variant}", obj, "chamber centre line x=0, floor surface z=0, module centre y=0",
           "chamber floor slab with culvert ports: 40 in variant a (5 rows x 8), 43 in variant b (staggered 9/8 rows)")
finish("chamber_sill", chamber_sill("chamber_sill_part"),
       "chamber centre x=0, gate hinge line y=0, lower floor z=0 (top at z=8.5)",
       "sill block between two chambers, step height 8.5 m, miter ridge pointing to +Y")
for variant in "ab":
    finish(f"mule_track_{variant}", mule_track(f"mule_track_{variant}_part", variant),
           "track centre line x=0, sleeper bottom z=0, module centre y=0",
           "mule track with centre rack, gauge 1.5 m, 30.5 m module (sits on the wall top 2.5 m from the inner edge)")

export_glb("lock_structure.glb")
