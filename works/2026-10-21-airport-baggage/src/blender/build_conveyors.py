"""Conveyor family: straight / curve90 / incline / merge modules, diverter paddle, read arch, check-in desk.

Module length 2.0 m, belt 0.80 m, frame 0.96 m, belt top 0.80 m. Flow is Blender +X.
"""
import math
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, add_clip, empty, export_glb, mat, reset_scene

BELT_TOP = 0.80
HALF_BELT = 0.40
HALF_FRAME = 0.48
CURVE_RADIUS = 1.5
MODULE = 2.0
INCLINE_RISE = 0.5


def setup_materials():
    lib.mat("belt_rubber", "belt", rough=0.85, texture=lib.make_belt_texture())
    mat("frame_steel", "steel", rough=0.45, metal=0.5)
    mat("guard_blue", "blue", rough=0.4)
    mat("leg_dark", "steel_dark", rough=0.6, metal=0.4)
    mat("motor_navy", "navy", rough=0.5, metal=0.3)
    mat("rubber_black", "rubber", rough=0.9)
    mat("cam_black", "black", rough=0.35)
    mat("lens_blue", "blue", rough=0.1, emit="blue", emit_strength=0.6)
    mat("panel_white", "white", rough=0.5)
    mat("safety_yellow", "yellow", rough=0.5)
    mat("screen_dark", "screen", rough=0.2, emit="screen", emit_strength=0.4)
    mat("tag_paper", "tag_paper", rough=0.8)
    mat("arch_lamp_idle", "teal", rough=0.3, emit="teal", emit_strength=1.2)
    mat("arch_lamp_ok", "green", rough=0.3, emit="green", emit_strength=0.25)
    mat("arch_lamp_noread", "orange", rough=0.3, emit="orange", emit_strength=0.25)
    mat("printer_lamp_ready", "green", rough=0.3, emit="green", emit_strength=1.0)


def path_lengths(path):
    lengths = [0.0]
    for a, b in zip(path, path[1:]):
        lengths.append(lengths[-1] + (Vector(b) - Vector(a)).length)
    return lengths


def sample(path, distance):
    """Point and unit tangent at `distance` along a poly-line path."""
    lengths = path_lengths(path)
    distance = max(0.0, min(distance, lengths[-1]))
    for i in range(len(path) - 1):
        if distance <= lengths[i + 1] + 1e-9:
            a, b = Vector(path[i]), Vector(path[i + 1])
            fraction = (distance - lengths[i]) / max(lengths[i + 1] - lengths[i], 1e-9)
            return a.lerp(b, fraction), (b - a).normalized()
    return Vector(path[-1]), (Vector(path[-1]) - Vector(path[-2])).normalized()


def slice_path(path, start, end):
    lengths = path_lengths(path)
    points = [tuple(sample(path, start)[0])]
    points += [tuple(p) for p, l in zip(path, lengths) if start + 1e-6 < l < end - 1e-6]
    points.append(tuple(sample(path, end)[0]))
    return points


def side(profile, sign):
    return [(a * sign, b) for a, b in profile]


SIDE_WEB = [(0.41, -0.22), (0.48, -0.22), (0.48, 0.10), (0.41, 0.10)]
SIDE_CAP = [(0.385, 0.10), (0.495, 0.10), (0.495, 0.14), (0.385, 0.14)]
PAN = [(-0.42, -0.22), (0.42, -0.22), (0.42, -0.19), (-0.42, -0.19)]


def build_module(name, path, root, motor=True, gap=None, half_scale=1.0):
    """Build `<name>_frame` and `<name>_belt` along a path whose z is the belt top height."""
    total = path_lengths(path)[-1]
    frame = Part(name + "_frame")
    belt = Part(name + "_belt")
    belt.sweep([(-HALF_BELT * half_scale, -0.045), (HALF_BELT * half_scale, -0.045),
                (HALF_BELT * half_scale, 0.0), (-HALF_BELT * half_scale, 0.0)], path, mat("belt_rubber"), bevel=0.004)
    scale = half_scale
    for sign in (1, -1):
        spans = [(0, total)]
        if gap and sign == 1:
            spans = [(0, gap[0]), (gap[1], total)]
        for start, end in spans:
            piece = slice_path(path, start, end)
            frame.sweep([(a * scale, b) for a, b in side(SIDE_WEB, sign)], piece, mat("frame_steel"), bevel=0.005)
            frame.sweep([(a * scale, b) for a, b in side(SIDE_CAP, sign)], piece, mat("guard_blue"), bevel=0.006)
    frame.sweep([(a * scale, b) for a, b in PAN], path, mat("leg_dark"), bevel=0.004)
    # end rollers (drive and tail) sit inside the frame ends
    for distance in (0.04, total - 0.04):
        point, tangent = sample(path, distance)
        angle = math.atan2(tangent.y, tangent.x)
        frame.cyl(0.055, 2 * HALF_BELT * scale + 0.02, (point.x, point.y, point.z - 0.075), mat("leg_dark"),
                  segs=16, rot=(math.pi / 2, 0, angle), bevel=0.004)
    # legs, floor pads, cross braces and guard posts
    leg_count = max(2, int(total / 1.0) + 1)
    for k in range(leg_count):
        point, tangent = sample(path, 0.2 + (total - 0.4) * k / (leg_count - 1))
        lateral = Vector((0, 0, 1)).cross(tangent).normalized()
        angle = math.atan2(tangent.y, tangent.x)
        height = point.z - 0.22
        for sign in (1, -1):
            base = point + lateral * (0.445 * scale * sign)
            frame.box((0.07, 0.07, height), (base.x, base.y, height / 2), mat("leg_dark"), bevel=0.008, rot=(0, 0, angle))
            frame.cyl(0.075, 0.015, (base.x, base.y, 0.0075), mat("rubber_black"), segs=12, bevel=0.003)
        frame.box((0.04, 2 * 0.445 * scale, 0.04), (point.x, point.y, 0.3), mat("leg_dark"), bevel=0.006, rot=(0, 0, angle))
    post_count = int(total / 0.5)
    for k in range(post_count + 1):
        point, tangent = sample(path, total * k / post_count)
        if gap and gap[0] < total * k / post_count < gap[1]:
            continue
        lateral = Vector((0, 0, 1)).cross(tangent).normalized()
        angle = math.atan2(tangent.y, tangent.x)
        for sign in (1, -1):
            if gap and sign == 1 and gap[0] - 0.05 < total * k / post_count < gap[1] + 0.05:
                continue
            base = point + lateral * (0.5 * scale * sign)
            frame.box((0.05, 0.03, 0.2), (base.x, base.y, point.z - 0.02), mat("leg_dark"), bevel=0.005, rot=(0, 0, angle))
    if motor:
        point, tangent = sample(path, total - 0.25)
        lateral = Vector((0, 0, 1)).cross(tangent).normalized()
        angle = math.atan2(tangent.y, tangent.x)
        base = point - lateral * (0.64 * scale)
        frame.cyl(0.10, 0.30, (base.x, base.y, point.z - 0.20), mat("motor_navy"), segs=20,
                  rot=(math.pi / 2, 0, angle), bevel=0.01)
        gear = point - lateral * (0.54 * scale)
        frame.box((0.2, 0.12, 0.22), (gear.x, gear.y, point.z - 0.17), mat("leg_dark"), bevel=0.012, rot=(0, 0, angle))
    frame.build(root)
    belt.build(root)


def arc_path(radius, start_z, end_z=None, steps=24, sweep=math.pi / 2):
    end_z = start_z if end_z is None else end_z
    return [(radius * math.sin(sweep * i / steps), radius * (1 - math.cos(sweep * i / steps)),
             start_z + (end_z - start_z) * i / steps) for i in range(steps + 1)]


def build_modules():
    straight = empty("conv_straight")
    build_module("conv_straight", [(0, 0, BELT_TOP), (MODULE, 0, BELT_TOP)], straight)
    curve = empty("conv_curve90")
    build_module("conv_curve90", arc_path(CURVE_RADIUS, BELT_TOP), curve, motor=False)
    incline = empty("conv_incline")
    build_module("conv_incline", [(0, 0, BELT_TOP), (MODULE, 0, BELT_TOP + INCLINE_RISE)], incline)
    merge = empty("conv_merge")
    build_module("conv_merge", [(0, 0, BELT_TOP), (MODULE, 0, BELT_TOP)], merge, gap=(0.7, 1.7))
    feeder = empty("conv_merge_feeder", parent=merge)
    build_module("conv_merge_feeder", [(0.1, 1.5, BELT_TOP), (1.2, 0.55, BELT_TOP)], feeder, motor=False, half_scale=0.9)


def build_paddle():
    root = empty("diverter_paddle")
    post = Part("diverter_paddle_post")
    post.cyl(0.10, 1.0, (0, 0, 0.5), mat("leg_dark"), bevel=0.01)
    post.box((0.28, 0.28, 0.04), (0, 0, 0.02), mat("leg_dark"), bevel=0.008)
    post.box((0.16, 0.16, 0.16), (0, 0, 1.12), mat("motor_navy"), bevel=0.015)
    post.box((0.05, 0.05, 0.04), (0.0, -0.1, 1.14), mat("lens_blue"), bevel=0.005)
    post.build(root)
    arm = Part("diverter_paddle_arm")
    arm.box((0.9, 0.05, 0.30), (0.5, 0, 0.95), mat("guard_blue"), bevel=0.012)
    arm.box((0.86, 0.02, 0.22), (0.5, -0.03, 0.95), mat("rubber_black"), bevel=0.005)
    arm.box((0.12, 0.12, 0.34), (0.0, 0, 0.95), mat("motor_navy"), bevel=0.02)
    arm.box((0.9, 0.06, 0.02), (0.5, 0, 1.11), mat("safety_yellow"), bevel=0.004)
    paddle = arm.build(root, pivot=(0, 0, 0.95))
    paddle.location = (0, 0, 0.95)
    add_clip(paddle, "paddle_swing", "rotation_euler", 2,
             [(1, 0.0), (8, -0.95), (24, -0.95), (32, 0.0)])


def build_read_arch():
    root = empty("read_arch")
    body = Part("read_arch_body")
    body.box((0.5, 0.14, 1.62), (0, 0.62, 0.81), mat("guard_blue"), bevel=0.02, seg=3)
    body.box((0.5, 0.14, 1.62), (0, -0.62, 0.81), mat("guard_blue"), bevel=0.02, seg=3)
    body.box((0.56, 1.5, 0.2), (0, 0, 1.68), mat("guard_blue"), bevel=0.03, seg=3)
    for sign in (1, -1):
        body.box((0.6, 0.2, 0.04), (0, 0.62 * sign, 0.02), mat("leg_dark"), bevel=0.008)
        body.box((0.3, 0.02, 0.5), (0, 0.545 * sign, 1.05), mat("panel_white"), bevel=0.006)  # RFID antenna
        for z in (0.95, 1.2, 1.4):
            body.box((0.1, 0.07, 0.07), (0.0, 0.52 * sign, z), mat("cam_black"), bevel=0.01)
            body.cyl(0.022, 0.02, (0.0, 0.485 * sign, z), mat("lens_blue"), axis="Y", segs=12, bevel=0.002)
    for y in (-0.5, -0.25, 0.0, 0.25, 0.5):
        body.box((0.12, 0.12, 0.08), (0.0, y, 1.54), mat("cam_black"), bevel=0.012)
        body.cyl(0.026, 0.02, (0.0, y, 1.495), mat("lens_blue"), axis="Z", segs=12, bevel=0.002)
    body.box((0.62, 1.58, 0.04), (0, 0, 1.80), mat("leg_dark"), bevel=0.008)
    body.build(root)
    for index, state in enumerate(("idle", "ok", "noread")):
        lamp = Part(f"read_arch_lamp_{state}")
        lamp.box((0.14, 0.2, 0.06), (0, -0.28 + 0.28 * index, 1.85), mat(f"arch_lamp_{state}"), bevel=0.012)
        lamp.build(root)


def build_checkin_desk():
    root = empty("checkin_desk")
    desk = Part("checkin_desk_body")
    desk.box((1.9, 0.8, 0.94), (0, 1.1, 0.47), mat("panel_white"), bevel=0.02, seg=3)
    desk.box((2.0, 0.9, 0.06), (0, 1.1, 1.0), mat("guard_blue"), bevel=0.02, seg=3)
    desk.box((1.8, 0.04, 0.12), (0, 0.68, 0.08), mat("leg_dark"), bevel=0.006)
    for x in (-0.6, 0.0, 0.6):                                                  # recessed front panels
        desk.box((0.5, 0.012, 0.58), (x, 0.698, 0.5), mat("frame_steel"), bevel=0.004, seg=1)
    desk.box((1.9, 0.012, 0.05), (0, 0.698, 0.86), mat("guard_blue"), bevel=0.003, seg=1)
    desk.box((0.04, 0.9, 0.4), (-0.97, 1.1, 0.2), mat("leg_dark"), bevel=0.006)   # end plinth
    desk.box((0.5, 0.04, 0.34), (-0.45, 1.25, 1.2), mat("screen_dark"), bevel=0.01)   # monitor
    desk.box((0.1, 0.08, 0.16), (-0.45, 1.3, 1.1), mat("leg_dark"), bevel=0.01)
    desk.box((0.34, 0.26, 0.16), (0.35, 0.95, 1.11), mat("leg_dark"), bevel=0.02)     # tag printer
    desk.box((0.22, 0.012, 0.012), (0.35, 0.80, 1.12), mat("black"), bevel=0.001)
    desk.box((0.1, 0.002, 0.16), (0.35, 0.7, 1.08), mat("tag_paper"), bevel=0.0005, seg=1)
    desk.box((0.04, 0.04, 0.45), (0.9, 1.1, 1.3), mat("leg_dark"), bevel=0.006)
    desk.box((0.7, 0.04, 0.22), (0.9, 1.1, 1.62), mat("guard_blue"), bevel=0.01)
    desk.build(root)
    lamp = Part("checkin_desk_printer_lamp")
    lamp.box((0.04, 0.02, 0.02), (0.5, 0.82, 1.17), mat("printer_lamp_ready"), bevel=0.003)
    lamp.build(root)
    build_module("checkin_desk", [(-0.95, 0.0, 0.8), (0.95, 0.0, 0.8)], root, motor=False, half_scale=0.97)


def main():
    reset_scene()
    setup_materials()
    build_modules()
    build_paddle()
    build_read_arch()
    build_checkin_desk()
    export_glb("conveyors.glb")


main()
