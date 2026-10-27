"""Checked bag variants. Each bag lies on its back on the belt: long axis X (travel), handle at the +X end,
wheels at the -X end, origin at the centre of the underside. Sizes are length x width x depth in metres."""
import math
import sys

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, export_glb, mat, reset_scene


def add_tag(part, size, x_offset=0.0):
    """IATA-style paper tag lying on the top face, with a printed barcode and a dark header strip."""
    top = size[2]
    part.box((0.22, 0.075, 0.004), (x_offset + size[0] * 0.30, -size[1] * 0.12, top + 0.002), mat("tag_paper"), bevel=0.0008, seg=1)
    part.box((0.22, 0.02, 0.0045), (x_offset + size[0] * 0.30, -size[1] * 0.12 + 0.028, top + 0.002), mat("cam_black"), bevel=0.0005, seg=1)
    for k in range(7):
        part.box((0.012, 0.025, 0.005), (x_offset + size[0] * 0.30 - 0.08 + k * 0.026, -size[1] * 0.12 - 0.012, top + 0.002),
                 mat("cam_black"), bevel=0.0005, seg=1)


def add_wheels_and_handle(part, size, trim_color):
    length, width, depth = size
    for sign in (1, -1):
        part.cyl(0.032, 0.03, (-length / 2 + 0.03, sign * (width / 2 - 0.07), 0.034), mat("rubber_black"), axis="Y", segs=14, bevel=0.003)
        part.box((0.07, 0.05, 0.05), (-length / 2 + 0.03, sign * (width / 2 - 0.07), 0.065), mat(trim_color), bevel=0.006)
    part.box((0.04, 0.2, 0.035), (length / 2 + 0.02, 0.0, depth / 2), mat("cam_black"), bevel=0.01)
    for sign in (1, -1):
        part.box((0.04, 0.03, 0.05), (length / 2 + 0.005, sign * 0.09, depth / 2), mat("cam_black"), bevel=0.006)


def hard_case(name, size, color, ribs=5):
    length, width, depth = size
    part = Part(name)
    shell = mat(f"{name}_shell", color, rough=0.28)
    trim = mat(f"{name}_trim", "navy", rough=0.5)
    part.box(size, (0, 0, depth / 2), shell, bevel=min(0.08, depth * 0.3), seg=4)
    part.box((length * 0.98, width * 1.002, 0.012), (0, 0, depth / 2), mat("zip_line", "black", rough=0.5), bevel=0.003, seg=1)
    for k in range(ribs):
        y = (k - (ribs - 1) / 2) * (width * 0.72 / max(ribs - 1, 1))
        part.box((length * 0.78, 0.016, 0.014), (-0.01, y, depth + 0.004), shell, bevel=0.005)
    for sx in (1, -1):
        for sy in (1, -1):
            part.box((0.05, 0.05, 0.05), (sx * (length / 2 - 0.035), sy * (width / 2 - 0.035), depth * 0.78), trim, bevel=0.012)
    add_wheels_and_handle(part, size, "navy")
    add_tag(part, size)
    part.build()


def soft_case(name, size, color):
    length, width, depth = size
    part = Part(name)
    cloth = mat(f"{name}_cloth", color, rough=0.85)
    part.box(size, (0, 0, depth / 2), cloth, bevel=0.09, seg=4)
    part.box((length * 0.6, width * 0.82, 0.05), (-0.02, 0, depth + 0.015), mat(f"{name}_pocket", "steel_dark", rough=0.8), bevel=0.02, seg=3)
    part.box((length * 0.56, 0.012, 0.012), (-0.02, width * 0.28, depth + 0.045), mat("zip_line"), bevel=0.003, seg=1)
    part.box((length * 0.98, width * 1.004, 0.012), (0, 0, depth * 0.45), mat("zip_line"), bevel=0.003, seg=1)
    add_wheels_and_handle(part, size, "black")
    add_tag(part, (length, width, depth + 0.05))
    part.build()


def duffel(name, color):
    part = Part(name)
    cloth = mat(f"{name}_cloth", color, rough=0.85)
    stations = [(-0.35, 0.78), (-0.32, 0.95), (-0.2, 1.0), (0.2, 1.0), (0.32, 0.95), (0.35, 0.78)]
    rings = []
    for x, factor in stations:
        ring = []
        for k in range(18):
            angle = 2 * math.pi * k / 18
            ring.append((x, 0.19 * factor * math.cos(angle), max(0.13 + 0.13 * factor * math.sin(angle), 0.0)))
        rings.append(ring)
    part.skin(rings, cloth, bevel=0.0)
    for x in (-0.36, 0.36):
        part.cyl(0.12, 0.02, (x, 0, 0.13), mat(f"{name}_end", "navy", rough=0.7), axis="X", segs=18, bevel=0.004)
    part.box((0.5, 0.012, 0.012), (0, 0, 0.262), mat("zip_line"), bevel=0.002, seg=1)
    for x in (-0.14, 0.14):
        part.box((0.05, 0.34, 0.02), (x, 0, 0.215), mat("strap_black", "black", rough=0.8), bevel=0.006)
        part.box((0.04, 0.03, 0.09), (x, 0.0, 0.29), mat("strap_black"), bevel=0.01)
    part.box((0.34, 0.03, 0.02), (0, 0, 0.335), mat("strap_black"), bevel=0.008)
    part.box((0.2, 0.075, 0.004), (0.22, -0.1, 0.262), mat("tag_paper"), bevel=0.0008, seg=1)
    part.build()


def backpack(name, color):
    size = (0.52, 0.34, 0.20)
    length, width, depth = size
    part = Part(name)
    cloth = mat(f"{name}_cloth", color, rough=0.8)
    part.box(size, (0, 0, depth / 2), cloth, bevel=0.07, seg=4)
    part.box((0.34, 0.28, 0.06), (-0.04, 0, depth + 0.02), mat(f"{name}_pocket", "navy", rough=0.8), bevel=0.02, seg=3)
    part.box((0.3, 0.012, 0.012), (-0.04, 0.0, depth + 0.055), mat("zip_line"), bevel=0.003, seg=1)
    for sign in (1, -1):
        part.box((0.46, 0.06, 0.02), (0, sign * 0.1, -0.005), mat("strap_black"), bevel=0.006)   # shoulder straps
    part.box((0.1, 0.16, 0.035), (length / 2 + 0.01, 0, depth * 0.55), mat("strap_black"), bevel=0.012)
    part.box((0.2, 0.075, 0.004), (0.12, -0.08, depth + 0.052), mat("tag_paper"), bevel=0.0008, seg=1)
    part.build()


def main():
    reset_scene()
    mat("zip_line", "black", rough=0.5)
    mat("strap_black", "black", rough=0.8)
    hard_case("bag_hard_blue", (0.68, 0.45, 0.26), "blue")
    hard_case("bag_hard_orange", (0.78, 0.50, 0.30), "orange", ribs=7)
    hard_case("bag_hard_teal", (0.58, 0.40, 0.23), "teal", ribs=4)
    soft_case("bag_soft_grey", (0.62, 0.40, 0.24), "steel_dark")
    duffel("bag_duffel_green", "green")
    backpack("bag_backpack_red", "red")
    export_glb("bags.glb")


main()
