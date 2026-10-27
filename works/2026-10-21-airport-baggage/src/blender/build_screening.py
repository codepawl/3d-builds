"""Hold baggage screening family: CT scanner (spinning gantry, lamp states), manual search room with table,
image review desk, flagged-bag marker. Flow is Blender +X; the scanner belt top is 0.80 m."""
import math
import sys

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, add_clip, empty, export_glb, mat, reset_scene

HOUSING = (2.1, 1.6, 1.95)
TUNNEL_WIDTH, TUNNEL_BASE, TUNNEL_TOP = 0.95, 0.80, 1.55
GANTRY_Z = (TUNNEL_BASE + TUNNEL_TOP) / 2


def ct_scanner():
    root = empty("ct_scanner")
    body = Part("ct_scanner_body")
    white = mat("ct_shell", "white", rough=0.35)
    blue = mat("guard_blue")
    dark = mat("leg_dark")
    glass = mat("glass_tint")
    half = TUNNEL_WIDTH / 2
    wall = HOUSING[1] / 2 - half
    body.box((HOUSING[0], HOUSING[1], TUNNEL_BASE), (0, 0, TUNNEL_BASE / 2), white, bevel=0.04, seg=3)
    body.box((HOUSING[0], HOUSING[1], HOUSING[2] - TUNNEL_TOP), (0, 0, (HOUSING[2] + TUNNEL_TOP) / 2), white, bevel=0.06, seg=3)
    for sign in (1, -1):
        centre_y = sign * (half + wall / 2)
        body.box((0.65, wall, TUNNEL_TOP - TUNNEL_BASE), (-0.725, centre_y, GANTRY_Z), white, bevel=0.03, seg=2)
        body.box((0.65, wall, TUNNEL_TOP - TUNNEL_BASE), (0.725, centre_y, GANTRY_Z), white, bevel=0.03, seg=2)
        body.box((0.8, wall, 0.12), (0, centre_y, TUNNEL_BASE + 0.06), white, bevel=0.02)
        body.box((0.8, wall, 0.1), (0, centre_y, TUNNEL_TOP - 0.05), white, bevel=0.02)
        body.box((HOUSING[0] * 0.98, 0.02, 0.06), (0, sign * (HOUSING[1] / 2 + 0.004), 0.42), blue, bevel=0.006)        # accent band
        body.box((0.01, 0.01, 0.8), (-0.45, sign * (HOUSING[1] / 2 + 0.003), 1.2), dark, bevel=0.002, seg=1)          # panel lines
        body.box((0.01, 0.01, 0.8), (0.45, sign * (HOUSING[1] / 2 + 0.003), 1.2), dark, bevel=0.002, seg=1)
        body.box((0.5, 0.01, 0.4), (-0.8, sign * (HOUSING[1] / 2 + 0.003), 0.4), dark, bevel=0.002, seg=1)           # service door
        for sx in (1, -1):
            body.box((0.12, 0.08, 0.1), (sx * 0.9, sign * 0.65, 0.05), dark, bevel=0.01)                           # feet
    for sx in (1, -1):
        x = sx * (HOUSING[0] / 2 + 0.02)
        for z in (TUNNEL_BASE, TUNNEL_TOP):
            body.box((0.06, TUNNEL_WIDTH + 0.12, 0.06), (x, 0, z), blue, bevel=0.012)
        for sign in (1, -1):
            body.box((0.06, 0.06, TUNNEL_TOP - TUNNEL_BASE + 0.06), (x, sign * (half + 0.03), GANTRY_Z), blue, bevel=0.012)
        for k in range(7):
            y = -half + 0.07 + k * (TUNNEL_WIDTH - 0.14) / 6
            body.box((0.012, 0.13, 0.62), (sx * (HOUSING[0] / 2 - 0.05), y, TUNNEL_BASE + 0.34), mat("lead_grey"), bevel=0.003, seg=1)
    body.box((0.04, 0.04, 0.35), (0.8, 0.6, HOUSING[2] + 0.175), dark, bevel=0.006)   # lamp stack post
    body.box((0.34, 0.06, 0.4), (-0.95, -1.0, 1.1), dark, bevel=0.015)               # operator panel on a stand
    body.box((0.04, 0.04, 0.8), (-0.95, -1.0, 0.4), dark, bevel=0.005)
    body.box((0.28, 0.012, 0.3), (-0.95, -1.03, 1.12), mat("screen_dark"), bevel=0.003, seg=1)
    body.build(root)
    belt = Part("ct_scanner_belt")
    belt.box((2.7, 0.8, 0.045), (0, 0, TUNNEL_BASE - 0.0225), mat("belt_rubber"), bevel=0.004, seg=1)
    belt.build(root)
    # gantry ring, built as a closed skin of rectangular sections around the X axis
    gantry = Part("ct_gantry")
    rings = []
    for k in range(32):
        angle = 2 * math.pi * k / 32
        c, s = math.cos(angle), math.sin(angle)
        rings.append([(x, y_r * c, GANTRY_Z + y_r * s) for x, y_r in ((-0.1, 0.52), (0.1, 0.52), (0.1, 0.7), (-0.1, 0.7))])
    gantry.skin(rings, mat("gantry_alu", "alu", rough=0.35, metal=0.7), closed_path=True, bevel=0.012)
    gantry.box((0.24, 0.16, 0.2), (0, 0, GANTRY_Z + 0.62), mat("alert_orange"), bevel=0.02)   # x-ray tube housing
    gantry.box((0.2, 0.5, 0.05), (0, 0, GANTRY_Z - 0.55), mat("cam_black"), bevel=0.01)       # detector array
    pivot = gantry.build(root, pivot=(0, 0, GANTRY_Z))
    add_clip(pivot, "ct_spin", "rotation_euler", 0, [(1, 0.0), (13, math.pi / 2), (25, math.pi), (37, 3 * math.pi / 2), (49, 2 * math.pi)])
    for index, (state, color, strength) in enumerate((("idle", "teal", 1.0), ("scanning", "blue", 0.25), ("clear", "green", 0.25), ("alarm", "red", 0.25))):
        lamp = Part(f"ct_lamp_{state}")
        lamp.cyl(0.045, 0.06, (0.8, 0.6, HOUSING[2] + 0.38 + 0.065 * index), mat(f"ct_lamp_{state}", color, rough=0.3, emit=color, emit_strength=strength),
                 segs=16, bevel=0.005)
        lamp.build(root)


def search_table():
    root = empty("search_table")
    part = Part("search_table_body")
    steel = mat("table_steel", "alu", rough=0.3, metal=0.8)
    dark = mat("leg_dark")
    part.box((2.4, 1.0, 0.05), (0, 0, 0.9), steel, bevel=0.012)
    part.box((2.44, 0.03, 0.08), (0, 0.5, 0.93), mat("guard_blue"), bevel=0.008)
    part.box((2.44, 0.03, 0.08), (0, -0.5, 0.93), mat("guard_blue"), bevel=0.008)
    part.box((2.2, 0.8, 0.03), (0, 0, 0.3), dark, bevel=0.008)
    for sx in (1, -1):
        for sy in (1, -1):
            part.box((0.07, 0.07, 0.88), (sx * 1.12, sy * 0.44, 0.44), dark, bevel=0.01)
    part.box((0.3, 0.22, 0.2), (0.85, 0.3, 1.025), mat("panel_white"), bevel=0.02, seg=2)   # trace detector
    part.box((0.2, 0.012, 0.1), (0.85, 0.19, 1.04), mat("screen_dark"), bevel=0.003, seg=1)
    part.box((2.4, 0.06, 0.05), (0, 0.45, 1.75), dark, bevel=0.008)                          # light bar
    part.box((2.2, 0.04, 0.02), (0, 0.45, 1.72), mat("lamp_white", "white", rough=0.3, emit="white", emit_strength=1.5), bevel=0.003, seg=1)
    for sx in (1, -1):
        part.box((0.05, 0.05, 0.85), (sx * 1.1, 0.45, 1.3), dark, bevel=0.008)
    part.build(root)


def search_room():
    root = empty("search_room")
    part = Part("search_room_walls")
    wall = mat("room_wall", "white", rough=0.6)
    base = mat("guard_blue")
    glass = mat("glass_tint")
    size_x, size_y, height = 4.0, 3.2, 2.6
    part.box((size_x, size_y, 0.05), (0, 0, 0.025), mat("concrete_floor"), bevel=0.01)
    part.box((size_x, 0.12, height), (0, size_y / 2, height / 2 + 0.05), wall, bevel=0.01)
    part.box((0.12, size_y, height), (-size_x / 2, 0, height / 2 + 0.05), wall, bevel=0.01)
    part.box((size_x, 0.14, 0.3), (0, size_y / 2 - 0.0, 0.2), base, bevel=0.01)
    part.box((0.14, size_y, 0.3), (-size_x / 2, 0, 0.2), base, bevel=0.01)
    part.box((1.2, 0.12, height), (-size_x / 2 + 1.0 + 0.6, -size_y / 2, height / 2 + 0.05), wall, bevel=0.01)   # front wall pieces around the door
    part.box((1.2, 0.12, height), (size_x / 2 - 0.6, -size_y / 2, height / 2 + 0.05), wall, bevel=0.01)
    part.box((size_x, 0.12, 0.6), (0, -size_y / 2, height - 0.25), wall, bevel=0.01)
    part.box((0.12, size_y, 0.5), (size_x / 2, 0, height - 0.2), wall, bevel=0.01)
    part.box((0.1, 2.0, 1.4), (size_x / 2, 0, 1.4), glass, bevel=0.004, seg=1)
    part.box((0.12, size_y, 0.5), (size_x / 2, 0, 0.3), base, bevel=0.01)
    part.build(root)


def review_desk():
    root = empty("review_desk")
    part = Part("review_desk_body")
    part.box((1.6, 0.8, 0.05), (0, 0, 0.75), mat("table_steel"), bevel=0.01)
    part.box((1.5, 0.04, 0.7), (0, -0.3, 0.38), mat("panel_white"), bevel=0.01)
    for sx in (1, -1):
        part.box((0.05, 0.7, 0.72), (sx * 0.75, 0, 0.36), mat("panel_white"), bevel=0.01)
        part.box((0.55, 0.04, 0.34), (sx * 0.32, 0.05, 1.07), mat("screen_dark"), bevel=0.01)
        part.box((0.05, 0.05, 0.2), (sx * 0.32, 0.12, 0.88), mat("leg_dark"), bevel=0.008)
    part.box((0.46, 0.46, 0.08), (0, 0.85, 0.5), mat("guard_blue"), bevel=0.03, seg=3)
    part.box((0.46, 0.08, 0.5), (0, 1.07, 0.78), mat("guard_blue"), bevel=0.03, seg=3)
    part.cyl(0.04, 0.4, (0, 0.85, 0.25), mat("leg_dark"), bevel=0.004)
    part.cyl(0.28, 0.04, (0, 0.85, 0.03), mat("leg_dark"), bevel=0.01)
    part.build(root)


def flag_marker():
    root = empty("bag_flag_marker")
    part = Part("bag_flag_marker_pin")
    glow = mat("flag_alert", "orange", rough=0.3, emit="orange", emit_strength=1.4)
    part.cyl(0.12, 0.2, (0, 0, 0.1), glow, radius2=0.0, rot=(math.pi, 0, 0), segs=4, bevel=0.0)
    part.cyl(0.12, 0.2, (0, 0, 0.3), glow, radius2=0.0, segs=4, bevel=0.0)
    part.build(root)


def main():
    reset_scene()
    ct_scanner()
    search_table()
    search_room()
    review_desk()
    flag_marker()
    export_glb("screening.glb")


main()
