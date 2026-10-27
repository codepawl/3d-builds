"""Lock equipment family -> lock_equipment.glb: miter gate leaves, a rolling gate, valve houses, signal posts."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *
import canal_params as P

reset_scene()

gate_blue = textured_material("gate_steel_blue", "#47607a", 0.08, 0.6, seed=11)
gate_dark = make_material("gate_steel_dark", "#2f3d4e", 0.55, 0.6)
safety_yellow = make_material("safety_yellow", "#f2b92d", 0.6)
rubber = make_material("seal_rubber", "#1b1f24", 0.9)
grating = make_material("grating_grey", "#6a727d", 0.5, 0.6)
concrete = textured_material("concrete_light", "#c9ced6", 0.10, 0.9, seed=1)
concrete_dark = textured_material("concrete_dark", "#9aa3b0", 0.12, 0.95, seed=2)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
roof_blue = make_material("roof_blue", "#3f6fa8", 0.6)
door_grey = make_material("door_grey", "#555e6a", 0.6, 0.3)
valve_red = make_material("valve_wheel_red", "#d6432f", 0.5)
lamp_off = make_material("lamp_off", "#2a3039", 0.5)
lamp_red_off = make_material("lamp_red_off", "#4a2424", 0.4)
lamp_green_off = make_material("lamp_green_off", "#24402c", 0.4)
lamp_amber_off = make_material("lamp_amber_off", "#4a3d1c", 0.4)
pole = make_material("pole_grey", "#59626e", 0.6, 0.4)

THICKNESS = P.GATE_THICKNESS
LENGTH = P.GATE_LEAF_LENGTH
CLOSED = math.radians(P.GATE_CLOSED_ANGLE_DEG)
OPEN = math.radians(90.0)
FPS = 30


def build_leaf(root_name, height, hand):
    """One miter gate leaf. hand=+1 extends along +X (left-hand leaf), -1 along -X. Origin = bottom of the hinge."""
    sign = hand
    part = Part(root_name + "_leaf")
    # skin plate on the -Y face, girders and frames on the +Y side
    part.box((sign * LENGTH / 2, -THICKNESS / 2 + 0.15, height / 2), (LENGTH - 0.6, 0.3, height - 0.2), gate_blue,
             bevel=0.05)
    level_count = max(4, int(height / 4.2))
    for index in range(level_count):
        z = 1.0 + index * (height - 2.2) / (level_count - 1)
        part.box((sign * LENGTH / 2, 0.15, z), (LENGTH - 1.2, THICKNESS - 0.5, 0.45), gate_dark, bevel=0.05)
        part.box((sign * LENGTH / 2, THICKNESS / 2 - 0.12, z), (LENGTH - 1.2, 0.2, 0.9), gate_blue, bevel=0.04)
    frame_count = 6
    for index in range(1, frame_count):
        x = sign * (index * LENGTH / frame_count)
        part.box((x, 0.1, height / 2), (0.35, THICKNESS - 0.4, height - 0.8), gate_dark, bevel=0.04)
    # quoin post at the hinge (round) and miter post at the toe with a rubber seal
    part.cylinder((0, 0, height / 2), 0.9, height, gate_dark, segments=16, bevel=0.06)
    part.box((sign * (LENGTH - 0.4), 0, height / 2), (0.9, THICKNESS - 0.3, height), gate_dark, bevel=0.08)
    part.box((sign * (LENGTH - 0.1), 0.2, height / 2), (0.2, 0.5, height - 0.6), rubber)
    # top walkway with grating and a yellow handrail on the +Y side
    part.box((sign * LENGTH / 2, 0, height + 0.08), (LENGTH - 0.4, THICKNESS - 0.2, 0.16), grating, bevel=0.03)
    rail_y = THICKNESS / 2 - 0.1
    post_count = 9
    for index in range(post_count + 1):
        x = sign * (0.6 + index * (LENGTH - 1.2) / post_count)
        part.box((x, rail_y, height + 0.7), (0.07, 0.07, 1.1), safety_yellow)
    part.box((sign * LENGTH / 2, rail_y, height + 1.2), (LENGTH - 0.8, 0.07, 0.07), safety_yellow)
    part.box((sign * LENGTH / 2, rail_y, height + 0.7), (LENGTH - 0.8, 0.05, 0.05), safety_yellow)
    # hinge pintle bracket at the top and a bottom sill shoe
    part.cylinder((0, 0, height + 0.3), 0.55, 0.6, steel, segments=12, bevel=0.04)
    part.box((sign * (LENGTH - 0.5), 0, 0.2), (1.2, THICKNESS - 0.2, 0.4), steel, bevel=0.05)
    return part


def make_leaf_node(root_name, height, hand):
    root = make_root(root_name)
    leaf_object = build_leaf(root_name, height, hand).build()
    leaf_object.name = root_name + "_mesh"
    leaf_object.parent = root
    closed_angle = CLOSED * hand
    open_angle = -OPEN * hand
    root.rotation_euler[2] = closed_angle                    # rest pose = closed
    add_clip(root, "gate_open", "rotation_euler", 2, [(1, closed_angle), (60, open_angle)])
    add_clip(root, "gate_close", "rotation_euler", 2, [(1, open_angle), (60, closed_angle)])
    root.rotation_euler[2] = closed_angle
    return root


gate_roots = []
for height, tag in ((20.0, "h20"), (23.0, "h23"), (25.5, "h25")):
    for hand, suffix in ((1, "L"), (-1, "R")):
        gate_roots.append((make_leaf_node(f"gate_{tag}_{suffix}", height, hand), tag, suffix))


def rolling_gate():
    root = make_root("gate_rolling")
    part = Part("gate_rolling_body")
    width = 35.0
    depth = 7.0
    height = 24.0
    part.box((0, 0, height / 2 + 0.4), (width, depth, height), gate_blue, bevel=0.15)
    for index in range(-5, 6):
        part.box((index * 3.0, -depth / 2 - 0.12, height / 2 + 0.4), (0.5, 0.25, height - 0.8), gate_dark, bevel=0.04)
    for z in (4.0, 9.0, 14.0, 19.0):
        part.box((0, -depth / 2 - 0.1, z), (width - 0.8, 0.22, 0.5), gate_dark, bevel=0.04)
        part.box((0, depth / 2 + 0.1, z), (width - 0.8, 0.22, 0.5), gate_dark, bevel=0.04)
    part.box((0, 0, height + 0.5), (width - 0.4, depth - 0.2, 0.2), grating, bevel=0.03)
    for y in (-depth / 2 + 0.2, depth / 2 - 0.2):
        part.box((0, y, height + 1.1), (width - 0.6, 0.07, 0.07), safety_yellow)
        for index in range(17):
            part.box((-width / 2 + 0.5 + index * (width - 1.0) / 16, y, height + 1.0), (0.07, 0.07, 1.0),
                     safety_yellow)
    for x in (-width / 2 + 3.0, width / 2 - 3.0):
        for y in (-2.2, 2.2):
            part.cylinder((x, y, 0.45), 0.45, 0.5, steel, axis="Y", segments=14)               # trolley wheels
    part.box((0, 0, 0.2), (width, depth - 1.0, 0.4), steel, bevel=0.05)
    part.build(parent=root)
    return root


rolling_root = rolling_gate()


def valve_house(variant):
    root = make_root(f"valve_house_{variant}")
    body = Part(f"valve_house_{variant}_body")
    wall_material = concrete if variant == "a" else concrete_dark
    body.box((0, 0, 1.6), (3.4, 3.0, 3.2), wall_material, bevel=0.1)
    body.box((0, 0, 3.35), (3.7, 3.3, 0.3), roof_blue, bevel=0.08)
    body.box((0, -1.52, 1.1), (1.0, 0.1, 2.0), door_grey, bevel=0.03)
    body.box((1.0, -1.52, 2.2), (0.8, 0.1, 0.5), door_grey)
    body.box((0, 0, 3.7), (1.2, 1.2, 0.5), steel, bevel=0.05)                                 # stem cap housing
    if variant == "b":
        body.box((-1.2, 0, 3.8), (0.8, 2.0, 0.6), steel, bevel=0.05)
    body.build(parent=root)
    stem = Part(f"valve_house_{variant}_stem")
    stem.cylinder((0, 0, 0.0), 0.1, 3.0, steel, segments=8)
    stem.cylinder((0, 0, 1.5), 0.2, 0.2, steel, segments=8)
    stem_object = stem.build(parent=root, location=(0, 0, 3.6))
    stem_object.name = f"valve_house_{variant}_stem"
    wheel = Part(f"valve_house_{variant}_wheel")
    wheel.cylinder((0, 0, 0), 0.12, 0.14, valve_red, segments=12)                       # hub
    for angle in range(0, 180, 45):
        wheel.box((0, 0, 0.0), (1.1, 0.06, 0.05), valve_red, rot_z=math.radians(angle))  # spokes
    for index in range(16):                                                              # rim segments
        angle = index * math.pi / 8
        wheel.box((math.cos(angle) * 0.56, math.sin(angle) * 0.56, 0), (0.24, 0.07, 0.07), valve_red,
                  rot_z=angle + math.pi / 2)
    wheel_object = wheel.build(parent=root, location=(1.0, -1.7, 2.0))
    wheel_object.rotation_euler[0] = math.radians(90)
    wheel_object.name = f"valve_house_{variant}_wheel"
    for state, offset, off_material in (("open", -0.5, lamp_green_off), ("closed", 0.5, lamp_red_off)):
        lamp = Part(f"valve_house_{variant}_lamp_{state}")
        lamp.cylinder((0, 0, 0), 0.16, 0.12, off_material, axis="Y", segments=12)
        lamp.build(parent=root, location=(offset + 0.0, -1.55, 2.9)).name = f"valve_house_{variant}_lamp_{state}"
    add_clip(stem_object, "valve_open", "location", 2, [(1, 3.6), (45, 4.8)])
    add_clip(stem_object, "valve_close", "location", 2, [(1, 4.8), (45, 3.6)])
    add_clip(wheel_object, "valve_open", "rotation_euler", 1, [(1, 0.0), (45, math.radians(720))])
    add_clip(wheel_object, "valve_close", "rotation_euler", 1, [(1, math.radians(720)), (45, 0.0)])
    return root


valve_roots = [valve_house("a"), valve_house("b")]


def signal_post(variant):
    root = make_root(f"signal_post_{variant}")
    body = Part(f"signal_post_{variant}_body")
    body.cylinder((0, 0, 3.0), 0.12, 6.0, pole, segments=10)
    body.box((0, 0, 0.3), (0.7, 0.7, 0.6), concrete, bevel=0.05)
    head_count = 3 if variant == "a" else 2
    body.box((0, -0.18, 6.0 - 0.0), (0.7, 0.3, 0.3 + 0.7 * head_count), door_grey, bevel=0.06)
    body.build(parent=root)
    states = [("red", lamp_red_off), ("amber", lamp_amber_off), ("green", lamp_green_off)]
    if head_count == 2:
        states = [("red", lamp_red_off), ("green", lamp_green_off)]
    top = 6.0 + 0.35 * (head_count - 1)
    for index, (state, off_material) in enumerate(states):
        lamp = Part(f"signal_post_{variant}_lamp_{state}")
        lamp.cylinder((0, 0, 0), 0.24, 0.12, off_material, axis="Y", segments=16)
        lamp.build(parent=root, location=(0, -0.36, top - index * 0.7)).name = f"signal_post_{variant}_lamp_{state}"
    return root


signal_roots = [signal_post("a"), signal_post("b")]

for root, tag, suffix in gate_roots:
    register("lock_equipment.glb", root, "hinge pintle at the leaf bottom (origin); rotates about Z (glTF Y)",
             "leaf extends along local %sX; skin plate on -Y, girders on +Y; rest pose = closed" % ("+" if suffix == "L" else "-"),
             "gate_open, gate_close (60 frames at 30 fps)",
             f"miter gate leaf {suffix}, {tag[1:]} m high x 19.2 m long x 3 m thick; closed V apex points to +Y at 17.1 deg")
register("lock_equipment.glb", rolling_root, "centre of the gate at floor level (slides along X)",
         "gate faces along Y; slides along X", "none (app slides it)", "rolling gate 35 x 7 x 24 m")
for root in valve_roots:
    register("lock_equipment.glb", root, "house base centre at the floor; children valve_*_stem pivot at the top of the stem, *_wheel at its axis",
             "door on -Y", "valve_open, valve_close (45 frames)",
             "culvert valve house 3.4 x 3.0 x 4 m; lamps lamp_open / lamp_closed swap materials")
for root in signal_roots:
    register("lock_equipment.glb", root, "pole foot", "lamps face -Y", "none (app swaps lamp materials)",
             "chamber signal post, 6 m, lamp objects are separate nodes")

export_glb("lock_equipment.glb", with_animation=True)
