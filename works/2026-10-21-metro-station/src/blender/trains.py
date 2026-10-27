"""Metro cars -> trains.glb. Run: blender --background --factory-startup --python trains.py"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lib
from lib import Mesh, empty, material, pal

BODY_HALF_WIDTH = 1.5
GAUGE_HALF = 0.7535
DOOR_PITCH = 4.9
BOGIE_X = 6.5
WHEEL_RADIUS = 0.42
HALF_PROFILE = [(1.38, 0.95), (1.50, 1.05), (1.50, 3.18), (1.45, 3.50), (1.28, 3.70), (0.85, 3.80), (0.0, 3.83)]
FULL_PROFILE = HALF_PROFILE + [(-y, z) for y, z in reversed(HALF_PROFILE[:-1])]


def beam(mesh, start, end, thickness_y, thickness_z, mat):
    """Box from start to end in the XZ plane."""
    dx = end[0] - start[0]
    dz = end[1] - start[1]
    length = math.hypot(dx, dz)
    center = ((start[0] + end[0]) / 2, 0.0, (start[1] + end[1]) / 2)
    mesh.box((length, thickness_y, thickness_z), center, mat, bevel=0.01, rotation=(0, -math.atan2(dz, dx), 0))


def door_centres(is_cab):
    if is_cab:
        return [-7.8, -2.9, 2.0, 6.9]
    return [-7.35, -2.45, 2.45, 7.35]


def build_wheelset(name, parent, location):
    wheel_mesh = Mesh(name, location)
    steel = pal("steel")
    dark = pal("dark_metal")
    wheel_mesh.cylinder(0.065, 1.95, (0, 0, 0), dark, axis="Y", segments=12)
    for side in (-1, 1):
        y = side * GAUGE_HALF
        wheel_mesh.cylinder(WHEEL_RADIUS, 0.13, (0, y, 0), steel, axis="Y", segments=32)
        wheel_mesh.cylinder(WHEEL_RADIUS + 0.04, 0.03, (0, y - side * 0.05, 0), steel, axis="Y", segments=32)
        wheel_mesh.cylinder(0.15, 0.17, (0, y + side * 0.02, 0), dark, axis="Y", segments=16)
        wheel_mesh.cylinder(0.07, 0.19, (0, y + side * 0.02, 0), steel, axis="Y", segments=12)
        for bolt in range(6):
            angle = bolt * math.pi / 3
            wheel_mesh.cylinder(0.025, 0.2, (math.cos(angle) * 0.24, y + side * 0.02, math.sin(angle) * 0.24),
                                dark, axis="Y", segments=8)
    return wheel_mesh.build(parent)


def build_bogie(name, parent, x, powered):
    bogie_mesh = Mesh(name, (x, 0, 0))
    dark = pal("dark_metal")
    steel = pal("steel")
    rubber = pal("rubber")
    for side in (-1, 1):
        bogie_mesh.box((2.7, 0.16, 0.25), (0, side * 0.52, 0.62), dark, bevel=0.03)
        for spring_x in (-0.9, 0.9):
            bogie_mesh.cylinder(0.08, 0.3, (spring_x, side * 0.52, 0.86), steel, segments=12)
        bogie_mesh.box((0.3, 0.1, 0.3), (0, side * 0.52, 0.45), dark, bevel=0.02)
    bogie_mesh.box((0.35, 1.2, 0.25), (0, 0, 0.62), dark, bevel=0.03)
    bogie_mesh.box((0.7, 0.7, 0.12), (0, 0, 0.83), steel, bevel=0.02)
    bogie_mesh.box((0.2, 3.7, 0.08), (0.0, 0, 0.30), rubber, bevel=0.015)
    for side in (-1, 1):
        bogie_mesh.box((0.32, 0.16, 0.1), (0, side * 1.85, 0.2), steel, bevel=0.02)
        bogie_mesh.box((0.1, 0.1, 0.16), (0, side * 1.75, 0.27), rubber, bevel=0.01)
    if powered:
        for motor_x in (-0.62, 0.62):
            bogie_mesh.cylinder(0.19, 0.75, (motor_x, 0, 0.5), dark, axis="Y", segments=20)
            bogie_mesh.box((0.3, 0.3, 0.22), (motor_x * 1.5, 0, 0.45), steel, bevel=0.02)
    bogie_object = bogie_mesh.build(parent)
    for index, axle_x in enumerate((-1.15, 1.15)):
        build_wheelset(f"Wheelset_{name[-1]}{index + 1}", bogie_object, (axle_x, 0, WHEEL_RADIUS))
    return bogie_object


def body_rings(length, is_cab):
    half = length / 2
    rings = [lib.rotated_ring(FULL_PROFILE, -half)]
    if not is_cab:
        rings.append(lib.rotated_ring(FULL_PROFILE, half))
        return rings
    for x_offset, scale in ((2.4, 1.0), (1.4, 0.98), (0.6, 0.92), (0.0, 0.84)):
        rings.append(lib.rotated_ring(FULL_PROFILE, half - x_offset, scale))
    return rings


def build_car(kind, offset_y):
    lib.NAME_PREFIX = f"{kind}_"
    is_cab = kind == "Cab"
    powered = kind in ("Motor", "MotorPanto")
    length = 20.4 if is_cab else 19.6
    half = length / 2
    root = empty(f"Car_{kind}", (0, offset_y, 0))
    white = pal("body_white")
    grey = pal("body_grey")
    dark = pal("dark_metal")
    rubber = pal("rubber")
    glass = pal("glass")
    stripe = material("LineStripe", "#FF6B4A", 0.45)
    teal = pal("teal")

    body = Mesh("Body")
    body.loft(body_rings(length, is_cab), white)
    stripe_length = length - 0.4 if not is_cab else length - 3.0
    body.box((stripe_length, 3.02, 0.24), (-0.2 if is_cab else 0, 0, 1.62), stripe, bevel=0.01)
    centres = door_centres(is_cab)
    for centre in centres:
        for side in (-1, 1):
            body.box((1.5, 0.04, 2.0), (centre, side * 1.50, 2.1), dark, bevel=0.01)
    span_starts = [-half + 0.6] + [centre + 0.75 for centre in centres]
    span_ends = [centre - 0.75 for centre in centres] + [half - 0.6 if not is_cab else centres[-1] + 0.75]
    window_spans = [(start, end) for start, end in zip(span_starts, span_ends) if end - start > 0.8]
    for start, end in window_spans:
        for side in (-1, 1):
            body.box((end - start, 0.04, 0.9), ((start + end) / 2, side * 1.49, 2.55), glass, bevel=0.01)
    for side in (-1, 1):
        body.box((0.7, 0.02, 0.25), (-1.0 if is_cab else 0.0, side * 1.505, 1.95), teal, bevel=0.005)
    # roof
    pod_xs = (-4.5, 2.2) if is_cab else (-4.2, 4.2)
    for pod_x in pod_xs:
        body.box((2.6, 1.5, 0.2), (pod_x, 0, 3.88), grey, bevel=0.04)
        for vent in range(3):
            body.box((0.5, 1.1, 0.03), (pod_x - 0.7 + vent * 0.7, 0, 3.99), dark, bevel=0.005)
    body.box((length - 6.5 if not is_cab else 8.0, 0.18, 0.08), (0 if not is_cab else -2.8, 0, 3.87), dark, bevel=0.01)
    # underframe
    body.box((length - 3, 2.9, 0.12), (-0.6 if is_cab else 0, 0, 0.97), dark, bevel=0.02)
    body.box((2.4, 1.9, 0.5 if powered else 0.35), (-2.4, 0, 0.7), grey, bevel=0.03)
    body.box((1.8, 1.4, 0.35), (2.8, 0, 0.75), dark, bevel=0.03)
    body.cylinder(0.17, 1.8, (0.4, 0.6, 0.78), grey, axis="X", segments=16)
    body.cylinder(0.17, 1.8, (0.4, -0.6, 0.78), grey, axis="X", segments=16)
    # ends
    back_sign = -1
    body.box((0.2, 2.4, 2.7), (back_sign * (half + 0.1), 0, 2.2), rubber, bevel=0.05)
    if not is_cab:
        body.box((0.2, 2.4, 2.7), (half + 0.1, 0, 2.2), rubber, bevel=0.05)
    else:
        body.box((0.06, 2.0, 1.0), (half + 0.0, 0, 2.75), glass, bevel=0.01, rotation=(0, -0.12, 0))
        body.box((0.06, 1.2, 0.2), (half - 0.02, 0, 3.38), material("DestinationSign", "#FFB347", 0.4, 0, "#FFB347", 2.0), bevel=0.01)
        for side in (-1, 1):
            body.box((0.07, 0.3, 0.14), (half + 0.0, side * 0.95, 1.55), material("Headlight", "#FFFFFF", 0.3, 0, "#FFFFF0", 4.0), bevel=0.02)
            body.box((0.07, 0.2, 0.1), (half + 0.0, side * 1.12, 1.55), material("Taillight", "#FF2B2B", 0.3, 0, "#FF2020", 2.0), bevel=0.02)
        body.box((0.45, 0.55, 0.4), (half + 0.15, 0, 1.2), pal("steel"), bevel=0.04)
        body.box((0.04, 1.6, 0.18), (half + 0.02, 0, 1.4), dark, bevel=0.01)
        body.box((0.3, 0.05, 0.3), (-3.0, 0, 4.1), grey, bevel=0.02)
    body.build(root)

    for index, centre in enumerate(centres, start=1):
        for side_name, side in (("L", 1), ("R", -1)):
            for leaf_name, leaf_offset in (("a", -0.35), ("b", 0.35)):
                leaf = Mesh(f"Door_{side_name}{index}_{leaf_name}", (centre + leaf_offset, side * 1.54, 2.075))
                leaf.box((0.7, 0.05, 1.95), (0, 0, 0), white, bevel=0.015)
                leaf.box((0.46, 0.056, 0.85), (0, 0, 0.45), glass, bevel=0.01)
                closing_edge_x = -leaf_offset / 0.35 * -0.33
                leaf.box((0.04, 0.06, 1.9), (-closing_edge_x, 0, 0), rubber, bevel=0.005)
                leaf.build(root)

    build_bogie("Bogie_A", root, -BOGIE_X, powered)
    build_bogie("Bogie_B", root, BOGIE_X, powered)

    if kind == "MotorPanto":
        base = Mesh("Pantograph_Base", (0.0, 0, 3.98))
        base.box((1.6, 0.9, 0.1), (0, 0, 0), dark, bevel=0.02)
        for dx in (-0.6, 0.6):
            base.cylinder(0.05, 0.12, (dx, 0.3, 0.1), grey, segments=10)
            base.cylinder(0.05, 0.12, (dx, -0.3, 0.1), grey, segments=10)
        base_object = base.build(root)
        lower = Mesh("Pantograph_Lower", (0.0, 0, 0.12))
        beam(lower, (0, 0), (0.7, 0.55), 0.1, 0.07, dark)
        lower_object = lower.build(base_object)
        upper = Mesh("Pantograph_Upper", (0.7, 0, 0.55))
        beam(upper, (0, 0), (-0.7, 0.55), 0.08, 0.06, dark)
        upper.box((0.18, 2.0, 0.05), (-0.7, 0, 0.57), pal("steel"), bevel=0.01)
        upper.box((0.08, 1.9, 0.03), (-0.7, 0, 0.61), rubber, bevel=0.005)
        upper.build(lower_object)
    lib.NAME_PREFIX = ""
    return root


def main():
    lib.reset_scene()
    roots = [build_car(kind, index * 8.0) for index, kind in enumerate(("Cab", "Motor", "Trailer", "MotorPanto"))]
    lib.export_glb("trains.glb", roots)


main()
