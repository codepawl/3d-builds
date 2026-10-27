"""Logistics family: LD3 containers (2 colours), bag carts (2 colours), early bag store rack and stacker crane,
make-up carousel. LD3 faces -Y (door side); carts face -Y (drawbar at -Y); carousel long axis is X."""
import math
import sys

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, add_clip, empty, export_glb, mat, reset_scene

LD3_DEPTH = 1.534
LD3_POLYGON = [(-1.005, 1.625), (1.005, 1.625), (1.005, 0.45), (0.78, 0.0), (-0.78, 0.0), (-1.005, 0.45)]


def ld3(variant, color):
    root = empty(f"uld_ld3_{variant}")
    body = Part(f"uld_ld3_{variant}_body")
    panel = mat(f"uld_panel_{variant}", color, rough=0.4, metal=0.5 if color == "alu" else 0.1)
    frame = mat("uld_frame", "steel_dark", rough=0.4, metal=0.7)
    half = LD3_DEPTH / 2
    body.skin([[(x, -half, z) for x, z in LD3_POLYGON], [(x, half, z) for x, z in LD3_POLYGON]], panel, bevel=0.014)
    for x, z in LD3_POLYGON:
        body.box((0.06, LD3_DEPTH + 0.02, 0.06), (x * 0.985, 0, z + (0.03 if z < 1 else -0.03)), frame, bevel=0.01)
    for x in (-0.75, -0.25, 0.25, 0.75):
        body.box((0.03, LD3_DEPTH * 0.92, 0.02), (x, 0, 1.626), panel, bevel=0.005)
    for y in (-0.5, 0.0, 0.5):
        body.box((0.02, 0.03, 0.9), (1.006, y, 1.0), panel, bevel=0.005)
        body.box((0.02, 0.03, 0.9), (-1.006, y, 1.0), panel, bevel=0.005)
    body.box((1.56, LD3_DEPTH + 0.04, 0.06), (0, 0, 0.03), frame, bevel=0.01)                   # base plate
    for x in (-0.45, 0.45):
        body.box((0.3, LD3_DEPTH + 0.05, 0.04), (x, 0, 0.03), mat("cam_black"), bevel=0.005)   # fork pockets
    for sx in (1, -1):
        for sy in (1, -1):
            body.box((0.1, 0.1, 0.1), (sx * 0.74, sy * (half - 0.03), 0.05), mat("cam_black"), bevel=0.01)
    body.box((1.5, 0.012, 1.0), (0, -half + 0.004, 0.92), mat("uld_interior", "lead", rough=0.8), bevel=0.002, seg=1)
    body.build(root)
    door = Part(f"uld_ld3_{variant}_door")
    scaled = [(x * 0.985, z * 0.985 + (0.0 if z > 1 else 0.012)) for x, z in LD3_POLYGON]
    door.skin([[(x, -half - 0.02, z) for x, z in scaled], [(x, -half, z) for x, z in scaled]], mat(f"uld_door_{variant}", color, rough=0.6), bevel=0.01)
    door.box((1.8, 0.012, 0.06), (0, -half - 0.027, 0.9), mat("safety_yellow"), bevel=0.004)     # latch strap
    door.box((1.8, 0.012, 0.06), (0, -half - 0.027, 1.3), mat("safety_yellow"), bevel=0.004)
    pivot = door.build(root, pivot=(0, -half - 0.01, 1.62))
    add_clip(pivot, "door_close", "rotation_euler", 0, [(1, -math.radians(100)), (20, 0.0)])
    add_clip(pivot, "door_open", "rotation_euler", 0, [(1, 0.0), (20, -math.radians(100))])


def bag_cart(variant, color):
    root = empty(f"bag_cart_{variant}")
    part = Part(f"bag_cart_{variant}_body")
    frame = mat(f"cart_frame_{variant}", color, rough=0.45)
    dark = mat("leg_dark")
    length, width = 1.3, 0.95
    part.box((length, width, 0.05), (0, 0, 0.27), mat("cart_deck", "steel_dark", rough=0.6), bevel=0.01)
    for sx in (1, -1):
        for sy in (1, -1):
            part.box((0.05, 0.05, 0.75), (sx * (length / 2 - 0.025), sy * (width / 2 - 0.025), 0.62), frame, bevel=0.01)
            part.cyl(0.1, 0.05, (sx * (length / 2 - 0.1), sy * (width / 2 - 0.08), 0.1), mat("rubber_black"), axis="X", segs=16, bevel=0.005)
            part.box((0.07, 0.07, 0.1), (sx * (length / 2 - 0.1), sy * (width / 2 - 0.08), 0.22), dark, bevel=0.008)
    for z in (0.5, 0.88):
        for sy in (1, -1):
            part.box((length, 0.035, 0.035), (0, sy * (width / 2 - 0.025), z), frame, bevel=0.008)
        for sx in (1, -1):
            part.box((0.035, width, 0.035), (sx * (length / 2 - 0.025), 0, z), frame, bevel=0.008)
    for x in (-0.3, 0.3):
        part.box((0.03, 0.03, 0.55), (x, width / 2 - 0.025, 0.58), frame, bevel=0.006)
        part.box((0.03, 0.03, 0.55), (x, -width / 2 + 0.025, 0.58), frame, bevel=0.006)
    part.box((0.04, 0.5, 0.04), (0, -width / 2 - 0.2, 0.3), dark, bevel=0.008, rot=(0, 0, 0))
    part.box((0.04, 0.35, 0.04), (0.2, -width / 2 - 0.1, 0.3), dark, bevel=0.008, rot=(0, 0, 0.0))
    part.build(root)


def ebs_rack():
    root = empty("ebs_rack")
    part = Part("ebs_rack_body")
    frame = mat("rack_frame", "blue", rough=0.4)
    shelf = mat("rack_shelf", "steel", rough=0.5, metal=0.4)
    tote = mat("tote_grey", "white", rough=0.6)
    width, depth, height = 2.0, 1.2, 4.0
    for sx in (-1, 0, 1):
        for sy in (1, -1):
            part.box((0.08, 0.08, height), (sx * (width / 2 - 0.04), sy * (depth / 2 - 0.04), height / 2), frame, bevel=0.01)
    for level in range(5):
        z = 0.35 + level * 0.8
        part.box((width, depth, 0.05), (0, 0, z), shelf, bevel=0.008)
        part.box((width, 0.06, 0.1), (0, depth / 2 - 0.03, z + 0.07), frame, bevel=0.008)
        part.box((width, 0.06, 0.1), (0, -depth / 2 + 0.03, z + 0.07), frame, bevel=0.008)
        for slot in range(2):
            if (level + slot) % 3 != 2:
                part.box((0.88, 0.72, 0.34), (-0.46 + slot * 0.92, 0, z + 0.2), tote, bevel=0.025, seg=2)
                part.box((0.4, 0.014, 0.1), (-0.46 + slot * 0.92, -0.368, z + 0.24), mat("lens_blue"), bevel=0.003, seg=1)
    for x in (-0.95, 0.95):
        part.box((0.06, depth, 0.06), (x, 0, height - 0.03), frame, bevel=0.01)
    part.build(root)


def ebs_crane():
    root = empty("ebs_crane")
    mast = Part("ebs_crane_mast")
    frame = mat("crane_frame", "yellow", rough=0.45)
    dark = mat("leg_dark")
    for sy in (1, -1):
        mast.box((0.08, 0.08, 4.3), (0, sy * 0.36, 2.15), frame, bevel=0.01)
    for z in (0.3, 1.2, 2.1, 3.0, 3.9):
        mast.box((0.08, 0.8, 0.06), (0, 0, z), frame, bevel=0.01)
    mast.box((0.9, 0.9, 0.2), (0, 0, 0.1), dark, bevel=0.02)
    mast.box((0.9, 0.9, 0.1), (0, 0, 4.25), dark, bevel=0.02)
    mast.build(root)
    carriage = Part("ebs_crane_carriage")
    carriage.box((0.9, 0.9, 0.08), (0, 0, 0.4), mat("alu_panel"), bevel=0.01)
    carriage.box((0.9, 0.06, 0.2), (0, 0.42, 0.52), dark, bevel=0.01)
    carriage.box((0.88, 0.7, 0.04), (0, 0, 0.46), mat("belt_rubber"), bevel=0.003, seg=1)
    carriage.box((0.3, 0.3, 0.3), (0, -0.6, 0.45), mat("motor_navy"), bevel=0.02)
    pivot = carriage.build(root, pivot=(0, 0, 0.4))
    add_clip(pivot, "lift_down", "location", 2, [(1, 3.4), (60, 0.4)])
    add_clip(pivot, "lift_up", "location", 2, [(1, 0.4), (60, 3.4)])


def carousel_makeup():
    root = empty("carousel_makeup")
    straight, radius, step = 6.0, 1.4, 0.5
    path = []
    count = int(straight / step)
    for k in range(count):
        path.append((-straight / 2 + k * step, -radius, 0.55))
    for k in range(16):
        angle = -math.pi / 2 + math.pi * k / 16
        path.append((straight / 2 + radius * math.cos(angle), radius * math.sin(angle), 0.55))
    for k in range(count):
        path.append((straight / 2 - k * step, radius, 0.55))
    for k in range(16):
        angle = math.pi / 2 + math.pi * k / 16
        path.append((-straight / 2 + radius * math.cos(angle), radius * math.sin(angle), 0.55))
    belt = Part("carousel_makeup_belt")
    belt.sweep([(-0.55, -0.05), (0.55, -0.05), (0.55, 0.0), (-0.55, 0.0)], path, mat("carousel_plate", "steel_dark", rough=0.55, metal=0.4), closed_path=True, bevel=0.004)
    belt.build(root)
    frame = Part("carousel_makeup_frame")
    for sign in (1, -1):
        frame.sweep([(sign * 0.56, -0.3), (sign * 0.63, -0.3), (sign * 0.63, 0.22), (sign * 0.56, 0.22)], path, mat("guard_blue"), closed_path=True, bevel=0.006)
    frame.sweep([(-0.6, -0.34), (0.6, -0.34), (0.6, -0.04), (-0.6, -0.04)], path, mat("frame_steel"), closed_path=True, bevel=0.005)
    for k in range(0, len(path), 4):
        x, y, z = path[k]
        frame.box((0.08, 0.08, 0.2), (x, y, 0.2), mat("leg_dark"), bevel=0.008)
        frame.box((0.08, 0.08, 0.2), (x, y, 0.1), mat("leg_dark"), bevel=0.008)
    for k in range(0, len(path), 6):
        x, y, z = path[k]
        frame.cyl(0.05, 0.4, (x, y, 0.2), mat("leg_dark"), bevel=0.004)
    frame.build(root)
    sign = Part("carousel_makeup_sign")
    sign.box((0.08, 0.08, 1.9), (-straight / 2 - radius - 0.9, 0, 0.95), mat("leg_dark"), bevel=0.01)
    sign.box((0.06, 1.0, 0.5), (-straight / 2 - radius - 0.9, 0, 2.15), mat("screen_flight", "screen", rough=0.2, emit="blue", emit_strength=0.9), bevel=0.01)
    sign.build(root)


def main():
    reset_scene()
    ld3("grey", "alu")
    ld3("blue", "blue")
    bag_cart("blue", "blue")
    bag_cart("orange", "orange")
    ebs_rack()
    ebs_crane()
    carousel_makeup()
    export_glb("logistics.glb")


main()
