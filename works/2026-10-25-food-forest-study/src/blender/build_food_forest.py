"""Builds blender/food_forest.blend (six shots, procedural growth) and events.json.
Run: blender.exe -b -P build_food_forest.py"""
import bpy
import math
import random
import json
import os
import sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ff_lib as lib  # noqa: E402

PROJECT = os.path.dirname(HERE)
FPS = 30
TOTAL_FRAMES = 450
rng = random.Random(11)

# ----------------------------------------------------------------------------- timing and stages
SHOTS = {1: (0.0, 2.16), 2: (2.16, 5.28), 3: (5.28, 6.60), 4: (6.60, 8.96), 5: (8.96, 12.24), 6: (12.24, 15.0)}
STAGE_A = Vector((0, 0, 0))  # shot 1 desk
STAGE_B = Vector((2.5, 2.5, 0))  # shots 2-5 desk
STAGE_C = Vector((5.0, 5.0, 0))  # shot 6 dining table
PAPER_WIDTH = 0.46
PAPER_DEPTH = 0.32
COMPASS_CENTER = Vector((0.03, 0.04, 0))
COMPASS_RADIUS = 0.045
COMPASS_LEG = 0.125
DRAW_START = 2.15
DRAW_SECONDS = 1.05

# Each shot moves on a Catmull-Rom spline through its keys (camera, focus target, lens), already moving at the cut,
# with a slight handheld drift. Moves: 1 low macro tracking the pencil and craning up with the bush, 2 orbit round the
# compass ring, 3 low hero crane rising with the tree, 4 low slider along the meadow past the pen, 5 crane-down arc
# reveal of the whole sheet, 6 slow arc round the plate.
CAMERAS = {
    1: dict(stage=STAGE_A, fstop=8.0, keys=[
        ((-0.020, -0.165, 0.032), (0.030, 0.0, 0.008), 58),
        ((0.010, -0.155, 0.048), (0.038, 0.0, 0.016), 60),
        ((0.032, -0.140, 0.072), (0.034, 0.0, 0.030), 63),
        ((0.048, -0.125, 0.098), (0.022, 0.0, 0.044), 66)]),
    2: dict(stage=STAGE_B, fstop=5.6, keys=[
        ((-0.084, -0.205, 0.210), (0.030, 0.050, 0.000), 55),
        ((0.007, -0.229, 0.190), (0.030, 0.048, 0.004), 56),
        ((0.100, -0.221, 0.170), (0.030, 0.045, 0.008), 58),
        ((0.165, -0.194, 0.150), (0.030, 0.045, 0.012), 60)]),
    3: dict(stage=STAGE_B, fstop=6.0, keys=[
        ((-0.060, -0.200, 0.018), (0.030, 0.040, 0.020), 50),
        ((-0.030, -0.210, 0.040), (0.030, 0.040, 0.040), 49),
        ((0.010, -0.210, 0.070), (0.030, 0.040, 0.060), 48)]),
    4: dict(stage=STAGE_B, fstop=4.0, keys=[
        # Starts where the meadow is born (back right) and slides toward the camera side as it spreads.
        ((0.355, 0.020, 0.032), (0.170, 0.110, 0.010), 45),
        ((0.360, -0.030, 0.036), (0.170, 0.060, 0.010), 45),
        ((0.365, -0.080, 0.042), (0.170, 0.010, 0.012), 44),
        ((0.370, -0.130, 0.050), (0.175, -0.040, 0.015), 43)]),
    5: dict(stage=STAGE_B, fstop=5.6, keys=[
        ((-0.300, -0.500, 0.550), (0.000, 0.020, 0.020), 36),
        ((-0.180, -0.480, 0.450), (0.000, 0.020, 0.030), 37),
        ((-0.040, -0.420, 0.360), (0.000, 0.030, 0.035), 38),
        ((0.080, -0.360, 0.290), (0.000, 0.030, 0.040), 40)]),
    6: dict(stage=STAGE_C, fstop=3.5, keys=[
        ((-0.120, -0.700, 0.100), (0.000, 0.000, 0.085), 46),
        ((-0.040, -0.650, 0.090), (0.000, 0.000, 0.087), 47),
        ((0.040, -0.600, 0.085), (0.000, 0.000, 0.088), 47),
        ((0.100, -0.560, 0.080), (0.000, 0.000, 0.090), 48)]),
}
HANDHELD = [(0.43, 0.0), (0.71, 1.7), (1.13, 4.1)]  # (Hz, phase) of the drift


def shot_start_frame(shot):
    return round(SHOTS[shot][0] * FPS)


def shot_for_time(seconds):
    for shot in range(6, 0, -1):
        if seconds >= SHOTS[shot][0] - 1e-6:
            return shot
    return 1


def shot_progress(shot, seconds):
    start = shot_start_frame(shot) / FPS
    end = (shot_start_frame(shot + 1) / FPS) if shot < 6 else TOTAL_FRAMES / FPS
    return min(max((seconds - start) / (end - start), 0.0), 1.0)


def catmull_rom(points, progress):
    """Point on a uniform Catmull-Rom spline through points; the end tangents keep it moving at both cuts."""
    first = points[0] * 2 - points[1]
    last = points[-1] * 2 - points[-2]
    padded = [first] + points + [last]
    segments = len(points) - 1
    position = progress * segments
    index = min(int(position), segments - 1)
    local = position - index
    p0, p1, p2, p3 = padded[index], padded[index + 1], padded[index + 2], padded[index + 3]
    local_squared = local * local
    local_cubed = local_squared * local
    return 0.5 * ((2 * p1) + (p2 - p0) * local + (2 * p0 - 5 * p1 + 4 * p2 - p3) * local_squared
                  + (3 * p1 - p0 - 3 * p2 + p3) * local_cubed)


def handheld(shot, seconds, scale):
    drift = Vector((0, 0, 0))
    for axis in range(3):
        for frequency, phase in HANDHELD:
            drift[axis] += math.sin(2 * math.pi * frequency * seconds + phase + shot * 1.3 + axis * 2.1)
    return drift * scale / len(HANDHELD)


def camera_state(shot, seconds):
    spec = CAMERAS[shot]
    stage = spec["stage"]
    progress = shot_progress(shot, seconds)
    locations = [Vector(key[0]) for key in spec["keys"]]
    targets = [Vector(key[1]) for key in spec["keys"]]
    lenses = [Vector((key[2], 0, 0)) for key in spec["keys"]]
    location = catmull_rom(locations, progress)
    target = catmull_rom(targets, progress)
    lens = catmull_rom(lenses, progress).x
    distance = (location - target).length
    location = location + handheld(shot, seconds, distance * 0.006) + stage
    target = target + handheld(shot + 7, seconds, distance * 0.002) + stage
    return location, target, lens


def project(shot, seconds, point):
    """Screen position (x, y in 0..1) of a world point, or None when behind the camera."""
    location, target, lens = camera_state(shot, seconds)
    forward = (target - location).normalized()
    right = forward.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(forward)
    offset = Vector(point) - location
    depth = offset.dot(forward)
    if depth < 0.01:
        return None
    x = 0.5 + (offset.dot(right) / depth) * lens / 36.0
    y = 0.5 + (offset.dot(up) / depth) * lens / 36.0 * (1920 / 1080)
    return x, y


# ----------------------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 0
scene.frame_end = TOTAL_FRAMES - 1
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100


def new_collection(name, hidden=False):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    if hidden:
        bpy.context.view_layer.layer_collection.children[name].exclude = True
    return collection


stage_collection = new_collection("stage")
growth_collection = new_collection("growth")
asset_collections = {
    "grass": new_collection("assets_grass", True),
    "flowers": new_collection("assets_flowers", True),
    "shrubs": new_collection("assets_shrubs", True),
    "trees": new_collection("assets_trees", True),
    "trees_autumn": new_collection("assets_trees_autumn", True),
    "leaves": new_collection("assets_leaves", True),
}

# ----------------------------------------------------------------------------- assets
ASSET_PLAN = {
    "grass": [("grass_medium_02", 0.010), ("grass_bermuda_01", 0.007)],
    "flowers": [("flower_gazania", 0.0045), ("flower_heliophila", 0.009), ("flower_ursinia", 0.007), ("celandine_01", 0.006)],
    "shrubs": [("shrub_04", 0.020), ("shrub_01", 0.016), ("shrub_03", 0.024), ("nettle_plant", 0.018), ("fern_02", 0.014), ("shrub_02", 0.020)],
    "trees": [("tree_small_02", 0.115), ("island_tree_01", 0.085), ("island_tree_02", 0.075), ("island_tree_03", 0.075)],
}
layer_height = {"grass": 0.009, "flowers": 0.007, "shrubs": 0.019, "trees": 0.10}
imported_materials = {}
for layer, plan in ASSET_PLAN.items():
    for asset_name, height in plan:
        objects = lib.import_asset(asset_name, height, asset_collections[layer])
        for obj in objects:
            for material in obj.data.materials:
                imported_materials[material.name] = (material, layer)
for material, layer in imported_materials.values():
    if layer in ("grass", "shrubs"):
        lib.tint_foliage(material, 1.30, 1.45, (1.08, 1.04, 0.64))
    elif layer == "trees":
        lib.tint_foliage(material, 1.35, 1.50, (1.08, 1.04, 0.62))

# Autumn copies of the trees (object-level materials) for the plate in shot 6.
autumn_materials = {}
for obj in asset_collections["trees"].objects:
    duplicate = obj.copy()
    asset_collections["trees_autumn"].objects.link(duplicate)
    for slot in duplicate.material_slots:
        base = slot.material
        if base.name not in autumn_materials:
            autumn_materials[base.name] = lib.make_autumn_copy(base, 12.9, 15.0)
        if not any(word in base.name for word in ("leaves", "branch")):
            continue
        slot.link = "OBJECT"
        slot.material = autumn_materials[base.name]

def almond_leaf_mesh(name, length, width, curl=0.25, steps=10):
    """A flat pointed leaf along x with its sides curled up a little, so it reads as a leaf, not a chip."""
    vertices = [(0.0, 0.0, 0.0)]
    for index in range(1, steps):
        along = index / steps
        half_width = width / 2 * math.sin(math.pi * along) ** 0.8
        vertices.append((length * along, half_width, curl * half_width))
    vertices.append((length, 0.0, 0.0))
    for index in range(steps - 1, 0, -1):
        along = index / steps
        half_width = width / 2 * math.sin(math.pi * along) ** 0.8
        vertices.append((length * along, -half_width, curl * half_width))
    vertices = [(x - length / 2, y, z) for x, y, z in vertices]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [list(range(len(vertices)))])
    mesh.update()
    return mesh


leaf_mesh = almond_leaf_mesh("leaf_a", 0.0048, 0.0024)
leaf_material = lib.new_material("leaf_gold", (0.85, 0.55, 0.06), 0.6)
asset_collections["leaves"].objects.link(bpy.data.objects.new("leaf_a", leaf_mesh))
leaf_mesh.materials.append(leaf_material)
leaf_mesh_b = almond_leaf_mesh("leaf_b", 0.0036, 0.0022, curl=0.35)
leaf_mesh_b.materials.append(lib.new_material("leaf_amber", (0.8, 0.38, 0.04), 0.6))
asset_collections["leaves"].objects.link(bpy.data.objects.new("leaf_b", leaf_mesh_b))

kind_count = {name: len(collection.objects) for name, collection in asset_collections.items()}
tree_index = {obj.name.split(".")[0]: i for i, obj in enumerate(asset_collections["trees"].objects)}

# ----------------------------------------------------------------------------- shared materials
paper_material = lib.graph_paper_material()
desk_material = lib.wood_material("desk_walnut", (0.95, 0.80, 0.66), 3.0, saturation=0.72)
table_material = lib.wood_material("table_oak", (1.05, 0.95, 0.82), 1.6, rotate=0.0, saturation=0.55)
cream_paper = lib.new_material("sketch_paper", (0.88, 0.82, 0.68), 0.8)
ceramic = lib.new_material("ceramic_white", (0.86, 0.85, 0.80), 0.18, coat_weight=0.5)
steel = lib.steel_material()
dark_steel = lib.steel_material("dark_steel", (0.12, 0.12, 0.13), 0.35)
copper = lib.new_material("rose_copper", (0.92, 0.48, 0.30), 0.3, 0.75)
rubber = lib.new_material("rubber_black", (0.02, 0.02, 0.022), 0.5)
glass = lib.glass_material("glass", 1.45, (0.95, 0.98, 1.0))
tea = lib.new_material("tea", (0.35, 0.16, 0.05), 0.05)
teal = lib.new_material("teal_wall", (0.008, 0.035, 0.05), 0.9)
lamp_black = lib.new_material("lamp_black", (0.006, 0.006, 0.007), 0.45)
lamp_glow = lib.new_material("lamp_glow", (1.0, 0.7, 0.35), 0.5, emission_strength=8.0)
lamp_glow.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.65, 0.3, 1.0)


def book_materials():
    return [lib.new_material(f"book_{i}", color, 0.55) for i, color in enumerate([(0.30, 0.07, 0.06), (0.22, 0.26, 0.10), (0.08, 0.12, 0.22)])]


# ----------------------------------------------------------------------------- props
def add_box(name, size, location, material, rotation=(0, 0, 0)):
    return lib.mesh_object(name, lib.box_mesh(name, size), stage_collection, material, False, location, rotation)


def add_desk(origin, material, size=(6.0, 4.0)):
    return add_box("desk", (size[0], size[1], 0.04), origin + Vector((0, 0, -0.02)), material)


def build_mug(location):
    outer = [(0.0, 0.0), (0.034, 0.0), (0.040, 0.004), (0.0425, 0.06), (0.043, 0.09), (0.0415, 0.0925),
             (0.038, 0.0905), (0.0375, 0.01), (0.0, 0.009)]
    mug = lib.mesh_object("mug", lib.lathe_mesh("mug", outer), stage_collection, ceramic, True, location)
    handle = lib.mesh_object("mug_handle", lib.torus_mesh("mug_handle", 0.022, 0.0045), stage_collection, ceramic, True,
                             location + Vector((0.047, 0, 0.05)), (math.pi / 2, 0, 0))
    handle.scale = (1.0, 1.0, 1.3)
    liquid = lib.mesh_object("tea", lib.lathe_mesh("tea", [(0, 0.0770), (0.0375, 0.0770)]), stage_collection, tea, True, location)
    return mug


def build_plate(location):
    profile = [(0.0, 0.006), (0.08, 0.006), (0.115, 0.014), (0.128, 0.026), (0.130, 0.0285), (0.1285, 0.0295),
               (0.126, 0.0285), (0.113, 0.0165), (0.08, 0.0085), (0.0, 0.0085)]
    foot = [(0.0, 0.0), (0.07, 0.0), (0.075, 0.006)]
    lib.mesh_object("plate_foot", lib.lathe_mesh("plate_foot", foot), stage_collection, ceramic, True, location)
    return lib.mesh_object("plate", lib.lathe_mesh("plate", profile, 96), stage_collection, ceramic, True, location)


def build_glass(location, height=0.095, radius=0.034, water=0.07):
    wall = [(radius * 0.8, 0.0), (radius * 0.88, 0.0), (radius, 0.0), (radius * 1.12, height),
            (radius * 1.12 - 0.0016, height), (radius - 0.0016, 0.004), (radius * 0.8, 0.004)]
    lib.mesh_object("glass", lib.lathe_mesh("glass", wall), stage_collection, glass, True, location)
    water_material = lib.glass_material("water", 1.33, (0.95, 0.98, 1.0))
    water_profile = [(0.0, 0.004), (radius - 0.0016, 0.004), (radius * (1 + 0.12 * water / height) - 0.0016, water), (0.0, water)]
    lib.mesh_object("water", lib.lathe_mesh("water", water_profile), stage_collection, water_material, True, location)


def build_bowl(location):
    profile = [(0.0, 0.0), (0.03, 0.0), (0.05, 0.012), (0.062, 0.035), (0.0625, 0.036), (0.060, 0.035),
               (0.048, 0.014), (0.028, 0.004), (0.0, 0.004)]
    lib.mesh_object("bowl", lib.lathe_mesh("bowl", profile), stage_collection, dark_steel, True, location)


def build_spoon(location, rotation_z):
    root = bpy.data.objects.new("spoon", None)
    stage_collection.objects.link(root)
    root.location = location
    root.rotation_euler = (0, 0, rotation_z)
    bowl = lib.mesh_object("spoon_bowl", lib.sphere_mesh("spoon_bowl", 0.02, (1.0, 0.7, 0.18)), stage_collection, steel, True, (0.0, 0.0, 0.0035))
    handle = lib.mesh_object("spoon_handle", lib.box_mesh("spoon_handle", (0.006, 0.12, 0.0025)), stage_collection, steel, False, (0.0, -0.07, 0.0013))
    bowl.parent = root
    handle.parent = root


def build_fork(location, rotation_z):
    root = bpy.data.objects.new("fork", None)
    stage_collection.objects.link(root)
    root.location = location
    root.rotation_euler = (0, 0, rotation_z)
    parts = [lib.mesh_object("fork_handle", lib.box_mesh("fork_handle", (0.007, 0.11, 0.0025)), stage_collection, steel, False, (0, -0.075, 0.0013)),
             lib.mesh_object("fork_head", lib.box_mesh("fork_head", (0.022, 0.03, 0.0022)), stage_collection, steel, False, (0, -0.005, 0.0012))]
    for index in range(4):
        parts.append(lib.mesh_object(f"fork_tine{index}", lib.box_mesh("tine", (0.0032, 0.03, 0.0022)), stage_collection, steel, False,
                                     (-0.0085 + index * 0.0057, 0.025, 0.0012)))
    for part in parts:
        part.parent = root


def build_lamp(location):
    base = lib.mesh_object("lamp_base", lib.lathe_mesh("lamp_base", [(0, 0), (0.055, 0), (0.055, 0.006), (0.012, 0.01), (0.012, 0.19), (0, 0.19)]),
                           stage_collection, lamp_black, True, location)
    shade = lib.mesh_object("lamp_shade", lib.lathe_mesh("lamp_shade", [(0.02, 0.27), (0.05, 0.285), (0.09, 0.255), (0.1, 0.205), (0.0985, 0.2), (0.088, 0.203), (0.085, 0.25), (0.05, 0.278), (0.02, 0.265)]),
                            stage_collection, lamp_black, True, location)
    glow = lib.mesh_object("lamp_glow", lib.lathe_mesh("lamp_glow", [(0.0, 0.208), (0.085, 0.208)]), stage_collection, lamp_glow, True, location)
    bulb = bpy.data.lights.new("lamp_light", "POINT")
    bulb.energy = 8.0
    bulb.color = (1.0, 0.66, 0.34)
    bulb.shadow_soft_size = 0.03
    bulb_object = bpy.data.objects.new("lamp_light", bulb)
    bulb_object.location = location + Vector((0, 0, 0.215))
    stage_collection.objects.link(bulb_object)


def build_book_stack(location):
    materials = book_materials()
    z = 0.0
    for index, material in enumerate(materials):
        thickness = 0.026 - index * 0.003
        yaw = rng.uniform(-0.18, 0.18)
        cover = add_box(f"book{index}_cover", (0.21, 0.15, thickness), location + Vector((rng.uniform(-0.01, 0.01), 0, z + thickness / 2)), material, (0, 0, yaw))
        pages = add_box(f"book{index}_pages", (0.205, 0.145, thickness - 0.004), location + Vector((0.004, 0, z + thickness / 2)), cream_paper, (0, 0, yaw))
        pages.location.x = cover.location.x + 0.004 * math.cos(yaw)
        z += thickness


def build_glasses(location, yaw):
    root = bpy.data.objects.new("glasses", None)
    stage_collection.objects.link(root)
    root.location = location
    root.rotation_euler = (0, 0, yaw)
    for side in (-1, 1):
        ring = lib.mesh_object("lens_ring", lib.torus_mesh("lens_ring", 0.0155, 0.0007, 40, 8), stage_collection, dark_steel, True, (side * 0.0215, 0, 0.0009))
        disc = lib.mesh_object("lens", lib.lathe_mesh("lens", [(0, 0.0009), (0.0155, 0.0009)]), stage_collection, glass, True, (side * 0.0215, 0, 0))
        arm = add_box("arm", (0.0012, 0.095, 0.0012), Vector((side * 0.037, -0.05, 0.0009)), dark_steel, (0, 0, side * 0.08))
        for part in (ring, disc, arm):
            part.parent = root
    bridge = add_box("bridge", (0.012, 0.0012, 0.0012), Vector((0, 0.002, 0.0009)), dark_steel)
    bridge.parent = root


def build_paperclip(location, yaw):
    outline = [(-0.017, 0.0), (0.014, 0.0), (0.017, 0.0035), (0.014, 0.0063), (-0.012, 0.0063), (-0.0155, 0.0035),
               (-0.0125, 0.0012), (0.008, 0.0012), (0.0105, 0.0035), (0.008, 0.005)]
    curve = lib.poly_curve("paperclip", [(x, y - 0.003, 0.0) for x, y in outline], 0.0003, stage_collection, steel)
    curve.location = location + Vector((0, 0, 0.0004))
    curve.rotation_euler = (0, 0, yaw)


def place_pencil(name, location, direction, material=None):
    pencil = lib.build_pencil(name, stage_collection, material or copper, rubber, steel)
    pencil.location = location
    pencil.rotation_mode = "QUATERNION"
    pencil.rotation_quaternion = Vector(direction).normalized().to_track_quat("Z", "Y")
    return pencil


def paper_sheet(origin):
    paper = add_box("paper", (PAPER_WIDTH, PAPER_DEPTH, 0.0004), origin + Vector((0, 0, 0.0002)), paper_material)
    return paper


# ----------------------------------------------------------------------------- stage A (shot 1)
desk_a = add_desk(STAGE_A, desk_material)
paper_sheet(STAGE_A)
pencil_a = lib.build_pencil("pencil_stroke", stage_collection, copper, rubber, steel)
pencil_a.rotation_mode = "QUATERNION"
pencil_a.rotation_quaternion = Vector((0.55, 0.35, 0.75)).normalized().to_track_quat("Z", "Y")


def tip_x(seconds):
    return 0.030 + 0.0139 * seconds


PENCIL_LIFT_START = 1.70
PENCIL_LIFT_SECONDS = 0.55
PENCIL_REST = pencil_a.rotation_quaternion.copy()


def smooth_step(value):
    value = min(max(value, 0.0), 1.0)
    return value * value * (3 - 2 * value)


def pencil_pose(seconds):
    """The tip draws along x with a small hand wobble, then eases off the paper in an arc and keeps drifting."""
    lift = smooth_step((seconds - PENCIL_LIFT_START) / PENCIL_LIFT_SECONDS)
    drawing_seconds = min(seconds, PENCIL_LIFT_START) + (seconds - min(seconds, PENCIL_LIFT_START)) * (1 - 0.6 * lift)
    wobble_y = 0.0006 * math.sin(seconds * 9.0) * (1 - lift)
    location = Vector((tip_x(drawing_seconds), wobble_y, 0.0006))
    location += Vector((0.010 * lift, 0.012 * lift, 0.030 * lift * lift))
    tilt = math.radians(4.0) * math.sin(seconds * 2.3) + math.radians(14.0) * lift
    rotation = Matrix.Rotation(tilt, 4, "Y").to_quaternion() @ PENCIL_REST
    return STAGE_A + location, rotation


for frame in range(0, shot_start_frame(2)):
    pencil_a.location, pencil_a.rotation_quaternion = pencil_pose(frame / FPS)
    pencil_a.keyframe_insert("location", frame=frame)
    pencil_a.keyframe_insert("rotation_quaternion", frame=frame)

# ----------------------------------------------------------------------------- stage B (shots 2-5)
desk_b = add_desk(STAGE_B, desk_material)
paper_sheet(STAGE_B)
build_mug(STAGE_B + Vector((0.17, 0.25, 0.0)))
build_mug_extra = None
build_book_stack(STAGE_B + Vector((-0.27, 0.23, 0.0)))
build_glasses(STAGE_B + Vector((-0.12, 0.185, 0.0004)), 0.5)
build_paperclip(STAGE_B + Vector((0.255, -0.10, 0.0)), 0.6)
place_pencil("pen_right", STAGE_B + Vector((0.31, -0.10, 0.0045)), (0.12, 1.0, 0.0))
for offset, yaw in ((Vector((0.15, 0.235, 0.0)), 0.12), (Vector((0.18, 0.225, 0.0032)), -0.08)):
    add_box("sketch", (0.26, 0.19, 0.0028), STAGE_B + offset + Vector((0, 0, 0.0014)), cream_paper, (0, 0, yaw))
place_pencil("pen_spare_1", STAGE_B + Vector((0.10, 0.215, 0.0075)), (0.9, 0.15, 0.02))
place_pencil("pen_spare_2", STAGE_B + Vector((0.10, 0.235, 0.0075)), (0.92, 0.10, 0.02))

# compass rig: hinge/handle plus two legs, keyed per frame
hinge = bpy.data.objects.new("compass_hinge", None)
stage_collection.objects.link(hinge)
for name, mesh in (("hinge_knob", lib.sphere_mesh("hinge_knob", 0.006, (1, 1, 0.8))),
                   ("handle", lib.cylinder_mesh("handle", 0.0035, 0.0035, 0.045))):
    part = lib.mesh_object(name, mesh, stage_collection, steel, True, (0, 0, 0.0 if name == "hinge_knob" else 0.004))
    part.parent = hinge
legs = []
for name in ("leg_needle", "leg_lead"):
    leg = lib.mesh_object(name, lib.cylinder_mesh(name, 0.0028, 0.0008, 1.0, 12), stage_collection, steel, True)
    leg.rotation_mode = "QUATERNION"
    legs.append(leg)
lead_tip = lib.mesh_object("lead_tip", lib.cylinder_mesh("lead_tip", 0.0007, 0.0004, 0.006, 8), stage_collection, rubber, True)

COMPASS_HEIGHT = math.sqrt(COMPASS_LEG ** 2 - (COMPASS_RADIUS / 2) ** 2)
THETA_START = -math.pi / 2


def compass_theta(seconds):
    progress = min(max((seconds - DRAW_START) / DRAW_SECONDS, 0.0), 1.0)
    progress = progress * progress * (3 - 2 * progress) * 0.35 + progress * 0.65
    # Follow-through: the hand keeps turning a little past the closed ring while it lifts.
    follow = smooth((seconds - (DRAW_START + DRAW_SECONDS)) / 0.7) * 0.45
    return THETA_START - 2 * math.pi * progress - follow


def smooth(value):
    value = min(max(value, 0.0), 1.0)
    return value * value * (3 - 2 * value)


def compass_pose(seconds):
    theta = compass_theta(seconds)
    lift = smooth((seconds - (DRAW_START + DRAW_SECONDS + 0.05)) / 1.2)
    shift = Vector((0.04 * lift, 0.10 * lift, 0.26 * lift * lift))
    center = STAGE_B + COMPASS_CENTER + shift
    direction = Vector((math.cos(theta), math.sin(theta), 0))
    foot_lead = center + direction * COMPASS_RADIUS + Vector((0, 0, 0.0004))
    hinge_position = center + direction * (COMPASS_RADIUS / 2) + Vector((0, 0, COMPASS_HEIGHT))
    return hinge_position, center + Vector((0, 0, 0.0004)), foot_lead


def key_leg(leg, start_point, end_point, frame):
    axis = end_point - start_point
    leg.location = start_point
    leg.rotation_quaternion = axis.normalized().to_track_quat("Z", "Y")
    leg.scale = (1, 1, axis.length)
    for path in ("location", "rotation_quaternion", "scale"):
        leg.keyframe_insert(path, frame=frame)


for frame in range(shot_start_frame(2), shot_start_frame(3)):
    seconds = frame / FPS
    hinge_position, foot_needle, foot_lead = compass_pose(seconds)
    hinge.location = hinge_position
    hinge.keyframe_insert("location", frame=frame)
    key_leg(legs[0], hinge_position, foot_needle, frame)
    key_leg(legs[1], hinge_position, foot_lead, frame)
    lead_tip.location = foot_lead
    lead_tip.keyframe_insert("location", frame=frame)
far = Vector((0, 0, 6.0))
frame = shot_start_frame(3)
hinge.location = hinge_position + far
hinge.keyframe_insert("location", frame=frame)
key_leg(legs[0], hinge_position + far, foot_needle + far, frame)
key_leg(legs[1], hinge_position + far, foot_lead + far, frame)
lead_tip.location = foot_lead + far
lead_tip.keyframe_insert("location", frame=frame)

# ----------------------------------------------------------------------------- stage C (shot 6)
table = add_box("table_top", (1.6, 0.66, 0.035), STAGE_C + Vector((0, 0.08, -0.0175)), table_material)
wall = add_box("wall", (2.0, 0.02, 2.0), STAGE_C + Vector((0, 0.62, 0.5)), teal)
wall.visible_shadow = False
floor = add_box("floor", (2.0, 2.0, 0.02), STAGE_C + Vector((0, 0.3, -0.85)), teal)
build_plate(STAGE_C + Vector((0, 0.0, 0.0)))
build_spoon(STAGE_C + Vector((-0.185, -0.03, 0.0)), 0.18)
build_fork(STAGE_C + Vector((0.185, -0.075, 0.0)), -0.12)
build_glass(STAGE_C + Vector((0.17, 0.03, 0.0)), 0.085, 0.027, 0.06)
build_bowl(STAGE_C + Vector((0.215, 0.13, 0.0)))
build_lamp(STAGE_C + Vector((0.30, 0.20, 0.0)))
add_box("sheet_c", (0.20, 0.14, 0.003), STAGE_C + Vector((0.30, -0.05, 0.0015)), cream_paper, (0, 0, 0.3))

# ----------------------------------------------------------------------------- growth emitters
events = []
event_serial = [0]


def add_event(kind, shot, start, peak, end, x, size, **extra):
    event_serial[0] += 1
    record = dict(id=f"ev{event_serial[0]:04d}", kind=kind, shot=shot, start=round(start, 3), peak=round(peak, 3),
                  end=round(end, 3), x=round(min(max(x, 0.0), 1.0), 3), size=round(min(max(size, 0.0), 1.0), 3))
    record.update(extra)
    events.append(record)


def visible_samples(entries, layer, height_scale):
    """Per entry: (shot, peak, x, size) for entries visible in the camera of the shot active at their peak."""
    samples = []
    for entry in entries:
        peak = entry["start"] + lib.GROWTH_PEAK_U * entry["dur"]
        if peak < 0.0 or peak >= 15.0:
            continue
        shot = shot_for_time(peak)
        position = Vector(entry["pos"]) + Vector((0, 0, entry["size"] * height_scale * 0.5))
        screen = project(shot, peak, position)
        if screen is None or not (0.0 <= screen[0] <= 1.0 and 0.0 <= screen[1] <= 1.0):
            continue
        samples.append(dict(shot=shot, start=entry["start"], peak=peak, end=entry["start"] + entry["dur"], x=screen[0],
                            size=entry["size"] * height_scale / 0.12))
    return samples


def record_group_events(kind, entries, height_scale, chunk, bucket_seconds=None):
    samples = sorted(visible_samples(entries, kind, height_scale), key=lambda s: (s["shot"], s["peak"]))
    if bucket_seconds:
        buckets = {}
        for sample in samples:
            key = (sample["shot"], int(sample["peak"] / bucket_seconds))
            buckets.setdefault(key, []).append(sample)
        groups = [buckets[key] for key in sorted(buckets)]
    else:
        groups = []
        for index in range(0, len(samples), chunk):
            group = [s for s in samples[index:index + chunk]]
            groups.append(group)
    for group in groups:
        if not group:
            continue
        count = len(group)
        size = sum(s["size"] for s in group) / count
        if bucket_seconds:
            size = min(1.0, 0.15 + count / 300.0)
        add_event(kind, group[0]["shot"], min(s["start"] for s in group), sum(s["peak"] for s in group) / count,
                  max(s["end"] for s in group), sum(s["x"] for s in group) / count, size, count=count)


def make_layer(name, layer, entries, group_kind, autumn=False, chunk=8, bucket_seconds=None):
    collection_key = "trees_autumn" if autumn else layer
    group = lib.build_growth_group(name + "_group", asset_collections[collection_key])
    lib.make_emitter(name, entries, growth_collection, group, ("start", "dur", "size", "yaw", "tilt", "lag"))
    record_group_events(group_kind, entries, layer_height[layer], chunk, bucket_seconds)


# Growth is slow enough to read: a sprout on the line swells to full size over these multiples of the base duration.
GROWTH_STRETCH = {"grass": 2.4, "flowers": 2.4, "shrubs": 2.6, "trees": 2.2}


def plant(pos, layer, start, dur, size=None, lag=0.0, kind=None, tilt=0.12, stretch=True):
    count = kind_count[layer]
    if stretch:
        dur = dur * GROWTH_STRETCH[layer]
    return dict(pos=tuple(pos), start=start, dur=dur, size=size if size is not None else rng.uniform(0.7, 1.35),
                yaw=rng.uniform(0, 2 * math.pi), tilt=rng.uniform(-tilt, tilt), lag=lag,
                kind=rng.randrange(count) if kind is None else kind)


# --- shot 1: strip behind the pencil
strip_grass, strip_flowers, strip_shrubs, strip_trees = [], [], [], []
for _ in range(1500):
    x = rng.uniform(-0.050, 0.054)
    y = rng.gauss(0.0, 0.0065)
    arrival = (x - 0.030) / 0.0139 + 0.10
    strip_grass.append(plant(STAGE_A + Vector((x, y, 0)), "grass", arrival + rng.uniform(0.0, 0.25), 0.55, rng.uniform(1.2, 2.2)))
for _ in range(40):
    x = rng.uniform(-0.045, 0.054)
    arrival = max((x - 0.030) / 0.0139 + 0.25, -9.0)
    strip_flowers.append(plant(STAGE_A + Vector((x, rng.gauss(0.0, 0.006), 0)), "flowers", arrival + rng.uniform(0, 0.5), 0.6, rng.uniform(0.7, 1.3)))
for index in range(60):
    x = rng.uniform(-0.035, 0.050)
    y = rng.uniform(-0.004, 0.012)
    start = max(0.05 + 1.0 * (x + 0.035) / 0.085 + rng.uniform(-0.1, 0.1), (x - 0.030) / 0.0139 + 0.15)
    strip_shrubs.append(plant(STAGE_A + Vector((x, y, 0)), "shrubs", start, rng.uniform(0.6, 0.9), rng.uniform(1.0, 1.9), lag=0.2))
for x, y, start, size, kind in ((-0.030, 0.004, 0.10, 0.9, tree_index["island_tree_01"]), (-0.012, 0.008, 0.15, 1.0, tree_index["island_tree_02"]),
                                (0.004, 0.002, 0.25, 0.85, tree_index["tree_small_02"]), (0.018, 0.007, 0.30, 0.8, tree_index["island_tree_02"]),
                                (-0.040, 0.006, 0.35, 0.7, tree_index["island_tree_03"]), (0.032, 0.004, 0.55, 0.7, tree_index["island_tree_01"]),
                                (0.045, 0.006, 1.00, 0.55, tree_index["tree_small_02"]), (-0.020, 0.000, 0.60, 0.7, tree_index["tree_small_02"])):
    strip_trees.append(plant(STAGE_A + Vector((x, y, 0)), "trees", start, 1.0, size, lag=0.3, kind=kind, tilt=0.05))
make_layer("a_grass", "grass", strip_grass, "grass", chunk=40)
make_layer("a_flowers", "flowers", strip_flowers, "grass", chunk=30)
make_layer("a_shrubs", "shrubs", strip_shrubs, "shrub", chunk=1)
make_layer("a_trees", "trees", strip_trees, "tree", chunk=1)

# --- shot 2/3: compass ring, mound, tree
ring_grass, ring_flowers = [], []
for _ in range(700):
    theta_progress = rng.random()
    theta = THETA_START - 2 * math.pi * theta_progress
    radius = COMPASS_RADIUS + rng.gauss(0, 0.0045)
    position = STAGE_B + COMPASS_CENTER + Vector((math.cos(theta) * radius, math.sin(theta) * radius, 0))
    drawn_progress = min(max(theta_progress, 0.0), 1.0)
    eased = drawn_progress
    # Invert the easing used by the compass so grass appears right behind the lead.
    lo, hi = 0.0, 1.0
    for _ in range(30):
        mid = (lo + hi) / 2
        value = mid * mid * (3 - 2 * mid) * 0.35 + mid * 0.65
        if value < eased:
            lo = mid
        else:
            hi = mid
    time_at = DRAW_START + DRAW_SECONDS * (lo + hi) / 2
    ring_grass.append(plant(position, "grass", time_at + 0.07, 0.55, rng.uniform(0.9, 1.6)))
    if rng.random() < 0.06:
        ring_flowers.append(plant(position, "flowers", time_at + 0.15, 0.6, rng.uniform(0.8, 1.3)))
mound_grass, mound_flowers, mound_shrubs = [], [], []
mound_height = 0.012
for _ in range(1500):
    radius = COMPASS_RADIUS * math.sqrt(rng.random()) * 0.98
    theta = rng.uniform(0, 2 * math.pi)
    dome = mound_height * (1 - (radius / COMPASS_RADIUS) ** 2)
    position = STAGE_B + COMPASS_CENTER + Vector((math.cos(theta) * radius, math.sin(theta) * radius, dome * 0.6))
    start = 3.2 + (1 - radius / COMPASS_RADIUS) * 1.05 + rng.uniform(-0.1, 0.15)
    mound_grass.append(plant(position, "grass", start, 0.7, rng.uniform(1.0, 1.9)))
    if rng.random() < 0.08:
        mound_flowers.append(plant(position, "flowers", start + 0.15, 0.7, rng.uniform(0.9, 1.5)))
    if rng.random() < 0.05:
        mound_shrubs.append(plant(position, "shrubs", start + 0.25, 0.8, rng.uniform(0.9, 1.5), lag=0.2))
centre_tree = [plant(STAGE_B + COMPASS_CENTER + Vector((0, 0, 0.004)), "trees", 3.90, 2.6, 0.95, lag=0.30, stretch=False, kind=tree_index["island_tree_02"], tilt=0.0),
               plant(STAGE_B + COMPASS_CENTER + Vector((0.004, 0.003, 0.004)), "trees", 3.92, 2.6, 0.9, lag=0.30, stretch=False, kind=tree_index["island_tree_01"], tilt=0.0),
               plant(STAGE_B + COMPASS_CENTER + Vector((-0.004, 0.002, 0.004)), "trees", 3.94, 2.6, 0.92, lag=0.30, stretch=False, kind=tree_index["island_tree_02"], tilt=0.0),
               plant(STAGE_B + COMPASS_CENTER + Vector((0.002, -0.004, 0.004)), "trees", 3.96, 2.6, 0.88, lag=0.30, stretch=False, kind=tree_index["island_tree_01"], tilt=0.0)]
make_layer("b_ring_grass", "grass", ring_grass, "grass", chunk=14)
make_layer("b_ring_flowers", "flowers", ring_flowers, "grass", chunk=10)
make_layer("b_mound_grass", "grass", mound_grass, "grass", chunk=30)
make_layer("b_mound_flowers", "flowers", mound_flowers, "grass", chunk=20)
make_layer("b_mound_shrubs", "shrubs", mound_shrubs, "shrub", chunk=1)
make_layer("b_centre_tree", "trees", centre_tree, "tree", chunk=1)

# --- shots 4/5: meadow across the sheet
meadow_origin = Vector((0.20, 0.12))


def inside_sheet(x, y):
    margin_x = 0.018 + 0.020 * (0.5 + 0.5 * math.sin(11 * y + 1.3))
    margin_y = 0.018 + 0.025 * (0.5 + 0.5 * math.sin(9 * x + 0.4))
    if abs(x) > PAPER_WIDTH / 2 - margin_x or abs(y) > PAPER_DEPTH / 2 - margin_y:
        return False
    if (x - COMPASS_CENTER.x) ** 2 + (y - COMPASS_CENTER.y) ** 2 < (COMPASS_RADIUS + 0.004) ** 2:
        return False
    return True


def meadow_start(x, y, lag):
    distance = math.hypot(x - meadow_origin.x, y - meadow_origin.y)
    return 6.0 + 4.2 * distance / 0.6 + lag + rng.uniform(-0.2, 0.25)


meadow_grass, meadow_flowers, meadow_shrubs, meadow_trees = [], [], [], []
attempts = 0
while len(meadow_grass) < 4800 and attempts < 40000:
    attempts += 1
    x = rng.uniform(-PAPER_WIDTH / 2, PAPER_WIDTH / 2)
    y = rng.uniform(-PAPER_DEPTH / 2, PAPER_DEPTH / 2)
    if not inside_sheet(x, y):
        continue
    position = STAGE_B + Vector((x, y, 0.0003))
    meadow_grass.append(plant(position, "grass", meadow_start(x, y, 0.0), 0.8, rng.uniform(0.9, 1.7)))
    if rng.random() < 0.16:
        meadow_flowers.append(plant(position + Vector((rng.uniform(-0.003, 0.003), rng.uniform(-0.003, 0.003), 0)), "flowers",
                                    meadow_start(x, y, 0.2), 0.8, rng.uniform(0.8, 1.6)))
    if rng.random() < 0.02:
        meadow_shrubs.append(plant(position, "shrubs", meadow_start(x, y, 0.3), 0.9, rng.uniform(0.9, 1.8), lag=0.2))
for x, y, start, size, kind in (
        (0.12, 0.14, 8.2, 1.15, 0), (0.20, 0.05, 8.7, 1.0, 0), (-0.15, 0.10, 9.2, 1.1, 2), (-0.05, -0.08, 9.8, 0.9, 0),
        (0.15, -0.12, 10.2, 0.95, 0), (-0.22, -0.05, 10.6, 0.85, 1), (0.06, 0.18, 9.5, 1.0, 0), (-0.12, 0.17, 10.9, 0.85, 0),
        (0.25, 0.15, 8.0, 0.9, 3), (0.0, -0.17, 11.3, 0.7, 0)):
    meadow_trees.append(plant(STAGE_B + Vector((x * 0.75, y * 0.75, 0.0003)), "trees", start, 1.4, size * 1.15, lag=0.3, kind=[tree_index["island_tree_02"], tree_index["tree_small_02"], tree_index["island_tree_01"]][len(meadow_trees) % 3], tilt=0.04))
make_layer("b_meadow_grass", "grass", meadow_grass, "meadow", bucket_seconds=0.4)
make_layer("b_meadow_flowers", "flowers", meadow_flowers, "meadow", bucket_seconds=0.4)
make_layer("b_meadow_shrubs", "shrubs", meadow_shrubs, "shrub", chunk=1)
make_layer("b_meadow_trees", "trees", meadow_trees, "tree", chunk=1)

# --- shot 6: grove on the plate with autumn colour, falling leaves
plate_grass, plate_trees = [], []
for _ in range(520):
    radius = 0.112 * math.sqrt(rng.random())
    theta = rng.uniform(0, 2 * math.pi)
    plate_grass.append(plant(STAGE_C + Vector((math.cos(theta) * radius, math.sin(theta) * radius, 0.0085)), "grass", 9.0 + rng.uniform(0, 0.8), 0.7, rng.uniform(0.9, 1.6)))
for x, y, start, size, kind in ((-0.060, 0.012, 11.1, 1.75, tree_index["tree_small_02"]), (0.020, -0.014, 11.4, 1.95, tree_index["tree_small_02"]),
                                (0.070, 0.028, 11.0, 1.7, tree_index["tree_small_02"]), (-0.010, 0.045, 11.6, 1.85, tree_index["tree_small_02"]),
                                (-0.025, -0.020, 11.3, 1.3, tree_index["island_tree_01"]), (0.045, -0.025, 11.5, 1.2, tree_index["island_tree_01"])):
    plate_trees.append(plant(STAGE_C + Vector((x, y, 0.0085)), "trees", start - 2.0, 1.0, size, lag=0.3, kind=kind, tilt=0.03))
make_layer("c_grass", "grass", plate_grass, "grass", chunk=40)
make_layer("c_trees", "trees", plate_trees, "tree", autumn=True, chunk=1)

leaves = []
for _ in range(70):
    leaves.append(dict(pos=tuple(STAGE_C + Vector((rng.uniform(-0.09, 0.10), rng.uniform(-0.03, 0.06), rng.uniform(0.09, 0.185)))),
                       start=rng.uniform(12.5, 14.5), life=2.6, vx=rng.uniform(-0.004, 0.012), vy=rng.uniform(-0.006, 0.004),
                       phase=rng.uniform(0, 6.28), fall=rng.uniform(0.028, 0.05), kind=rng.randrange(2)))
leaf_group = lib.build_leaf_fall_group("leaf_group", asset_collections["leaves"])
lib.make_emitter("c_leaves", leaves, growth_collection, leaf_group, ("start", "life", "vx", "vy", "phase", "fall"))
for leaf in leaves:
    middle = leaf["start"] + 1.0
    position = Vector(leaf["pos"]) + Vector((leaf["vx"] * 1.0, leaf["vy"] * 1.0, -leaf["fall"] * 1.0))
    screen = project(6, min(middle, 14.99), position)
    if screen and 0 <= screen[0] <= 1 and leaf["start"] < 15.0:
        add_event("leaf", 6, leaf["start"], leaf["start"], min(leaf["start"] + leaf["life"], 15.0), screen[0], 0.08)

# --- strokes, cuts
tip_screen_start = project(1, 0.0, STAGE_A + Vector((tip_x(0.0), 0, 0.0006)))
tip_screen_end = project(1, 2.15, STAGE_A + Vector((tip_x(2.15), 0, 0.0006)))
add_event("pencil", 1, 0.0, 1.08, 2.16, tip_screen_start[0], 0.5, x_end=round(min(max(tip_screen_end[0], 0), 1), 3))
lead_start = project(2, DRAW_START, compass_pose(DRAW_START)[2])
lead_end = project(2, DRAW_START + DRAW_SECONDS, compass_pose(DRAW_START + DRAW_SECONDS)[2])
add_event("compass", 2, 2.10, 2.65, DRAW_START + DRAW_SECONDS, lead_start[0], 0.6, x_end=round(min(max(lead_end[0], 0), 1), 3))
for shot in range(2, 7):
    start = shot_start_frame(shot) / FPS
    add_event("cut", shot, start, start, start, 0.5, 1.0)
events.sort(key=lambda e: (e["start"], e["id"]))

# ----------------------------------------------------------------------------- lights, world
sun_direction = Vector((0.64, -0.64, -0.42)).normalized()
sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 3.0
sun_data.color = (1.0, 0.72, 0.45)
sun_data.angle = math.radians(2.5)
sun = bpy.data.objects.new("sun", sun_data)
sun.rotation_euler = sun_direction.to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(sun)


def area_light(name, location, target, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(obj)


for stage in (STAGE_A, STAGE_B):
    area_light(f"fill_{stage.x}", stage + Vector((0.8, -1.0, 0.8)), stage + Vector((0, 0, 0)), 90, (0.65, 0.78, 1.0), 1.2)
area_light("c_key", STAGE_C + Vector((-0.6, -0.9, 0.5)), STAGE_C + Vector((0, 0, 0.08)), 200, (1.0, 0.82, 0.6), 0.8)
area_light("c_fill", STAGE_C + Vector((0.8, -0.8, 0.3)), STAGE_C + Vector((0, 0, 0.08)), 30, (0.7, 0.85, 1.0), 0.8)
world = bpy.data.worlds.new("world")
world.use_nodes = True
background = world.node_tree.nodes["Background"]
background.inputs["Color"].default_value = (0.50, 0.62, 0.80, 1.0)
background.inputs["Strength"].default_value = 0.25
scene.world = world

# ----------------------------------------------------------------------------- cameras
for shot in range(1, 7):
    spec = CAMERAS[shot]
    camera_data = bpy.data.cameras.new(f"cam{shot}")
    camera_data.sensor_width = 36
    camera_data.dof.use_dof = True
    camera_data.dof.aperture_fstop = spec["fstop"]
    camera_data.clip_start = 0.005
    camera_data.clip_end = 50
    camera = bpy.data.objects.new(f"cam{shot}", camera_data)
    target = bpy.data.objects.new(f"focus{shot}", None)
    scene.collection.objects.link(camera)
    scene.collection.objects.link(target)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    camera_data.dof.focus_object = target
    first = shot_start_frame(shot)
    last = shot_start_frame(shot + 1) if shot < 6 else TOTAL_FRAMES
    for frame in range(first, last):
        location, focus_point, lens = camera_state(shot, frame / FPS)
        camera.location = location
        target.location = focus_point
        camera_data.lens = lens
        camera.keyframe_insert("location", frame=frame)
        target.keyframe_insert("location", frame=frame)
        camera_data.keyframe_insert("lens", frame=frame)
    marker = scene.timeline_markers.new(f"shot{shot}", frame=first)
    marker.camera = camera
scene.camera = bpy.data.objects["cam1"]

# ----------------------------------------------------------------------------- render settings
scene.render.engine = "CYCLES"
cycles = scene.cycles
cycles.samples = 64
cycles.use_adaptive_sampling = True
cycles.adaptive_threshold = 0.02
cycles.use_denoising = True
cycles.denoiser = "OPTIX"
cycles.max_bounces = 5
cycles.diffuse_bounces = 3
cycles.glossy_bounces = 3
cycles.transmission_bounces = 6
cycles.caustics_reflective = False
cycles.caustics_refractive = False
cycles.sample_clamp_indirect = 8
cycles.device = "GPU"
preferences = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        preferences.compute_device_type = backend
        preferences.get_devices()
        usable = [d for d in preferences.devices if d.type == backend]
        if usable:
            for device in preferences.devices:
                device.use = device.type == backend
            print("RENDER DEVICE", backend, [d.name for d in usable])
            break
    except Exception as error:  # noqa: BLE001
        print("device backend failed", backend, error)
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.45
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.compression = 15
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.view_settings.exposure = 0.0
try:
    scene.view_settings.look = "None"
except TypeError:
    pass

exec(open(os.path.join(HERE, "ff_compositor.py")).read())

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "food_forest.blend"), compress=True)
with open(os.path.join(PROJECT, "events.json"), "w", encoding="utf-8") as handle:
    json.dump(events, handle, indent=1)
print("BUILD OK events", len(events), "growth objects", len(growth_collection.objects))
