"""Ferris wheel and carousel: rides.glb (refs/ferris_wheel.md, refs/carousel.md).

ferris_wheel (origin at the base centre; wheel turns about x)
  ferris_base            platform, boarding deck, ramp, fence, operator booth, ferris_status lamp
  ferris_towers          two A-frame towers with braces and bearing blocks
  ferris_rotor           empty at the hub (y = 24 m): ferris_wheel_frame (rims, spokes, ties, lamp ring)
                         and gondola_01..24, each with its origin at the hanger pin on the rim.
                         The app turns ferris_rotor about x and turns each gondola by minus that angle.
carousel (origin at the centre, on the ground)
  carousel_base          plinth, steps, fence with gate, ticket podium, carousel_status lamp
  carousel_rotor         empty at the centre: carousel_deck (platform, column, poles, canopy, crown, rounding
                         boards, bulbs) plus horse_01..22 and chariot_01..02. Horses have their origin on their
                         pole at platform height; the app bobs them in y (0 to 0.35 m) and turns the rotor about y.
"""
import math

import bmesh
import bpy

from lib import _new_object, assign, box, combine, cylinder, export, loft, material, paint, point, reset_scene, root, sphere
from parts import beam_between, bulbs, palette

HUB_HEIGHT = 24.0
RIM_RADIUS = 21.0
RIM_HALF_SPACING = 1.3
GONDOLA_COUNT = 24


def torus(name, major, minor, center, mat, axis="x", major_segments=96, minor_segments=8):
    """Ring tube; `axis` is the ring's axis ('x' = ring in the up/forward plane, 'up' = horizontal ring)."""
    bm = bmesh.new()
    rings = []
    for i in range(major_segments):
        angle = 2 * math.pi * i / major_segments
        ring = []
        for j in range(minor_segments):
            tube = 2 * math.pi * j / minor_segments
            radial = major + minor * math.cos(tube)
            along = minor * math.sin(tube)
            if axis == "x":
                coords = (center[0] + along, center[1] + radial * math.sin(angle), center[2] + radial * math.cos(angle))
            else:
                coords = (center[0] + radial * math.cos(angle), center[1] + along, center[2] + radial * math.sin(angle))
            ring.append(bm.verts.new(point(*coords)))
        rings.append(ring)
    for i in range(major_segments):
        first = rings[i]
        second = rings[(i + 1) % major_segments]
        for j in range(minor_segments):
            following = (j + 1) % minor_segments
            bm.faces.new((first[j], first[following], second[following], second[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return assign(_new_object(name, mesh), mat)


# --- Ferris wheel ----------------------------------------------------------------------------

def gondola(index, mats, rotor, angle, colour):
    """Enclosed six-seat car hanging below its pin; built relative to the hub, origin at the pin."""
    pin = (0.0, RIM_RADIUS * math.sin(angle), RIM_RADIUS * math.cos(angle))
    x, up, forward = pin
    body = paint(box(f"g{index}_tub", (2.0, 0.9, 1.7), (x, up - 2.55, forward), mats["white"], 0.22), colour)
    parts = [
        body,
        box(f"g{index}_glass", (1.9, 1.0, 1.6), (x, up - 1.65, forward), mats["glass_light"], 0.12),
        paint(box(f"g{index}_roof", (2.15, 0.28, 1.85), (x, up - 1.03, forward), mats["white"], 0.12), colour),
        sphere(f"g{index}_dome", 0.35, (x, up - 0.85, forward), mats["white"], scale=(1.6, 0.5, 1.4), segments=16),
        box(f"g{index}_door", (0.04, 1.6, 0.8), (x + 1.0, up - 1.95, forward), mats["steel"], 0.02),
        box(f"g{index}_floor", (2.05, 0.1, 1.75), (x, up - 3.02, forward), mats["steel_dark"], 0.03),
        box(f"g{index}_plate", (0.04, 0.22, 0.5), (x - 1.01, up - 2.55, forward), mats["sign_blank"], 0.01),
        box(f"g{index}_yoke", (2.7, 0.14, 0.14), (x, up, forward), mats["steel_dark"], 0.04),
        cylinder(f"g{index}_pin", 0.11, 2.9, (x, up, forward), mats["chrome"], axis="x", sides=12),
        sphere(f"g{index}_lamp", 0.08, (x, up - 0.75, forward), mats["glow_warm"], segments=8),
    ]
    for side in (-1, 1):
        parts.append(box(f"g{index}_hanger_{side}", (0.08, 0.85, 0.12), (x + side * 0.75, up - 0.45, forward), mats["steel_dark"], 0.02))
    car = combine(f"gondola_{index + 1:02d}", parts, origin=pin, parent=rotor)
    return car


def build_ferris(mats):
    group = root("ferris_wheel")
    rotor = root("ferris_rotor", (0, HUB_HEIGHT, 0))
    rotor.parent = group
    frame = []
    for side in (-1, 1):
        x = side * RIM_HALF_SPACING
        frame.append(torus(f"rim_outer_{side}", RIM_RADIUS, 0.16, (x, 0, 0), mats["support"]))
        frame.append(torus(f"rim_inner_{side}", RIM_RADIUS - 1.6, 0.11, (x, 0, 0), mats["support"]))
        frame.append(torus(f"rim_lamps_{side}", RIM_RADIUS + 0.22, 0.05, (x, 0, 0), mats["glow_warm"], minor_segments=6))
        for spoke in range(GONDOLA_COUNT):
            angle = 2 * math.pi * (spoke + 0.5) / GONDOLA_COUNT
            rim = (x, RIM_RADIUS * math.sin(angle), RIM_RADIUS * math.cos(angle))
            frame.append(beam_between(f"spoke_{side}_{spoke}", (side * 0.9, 0, 0), rim, 0.07, mats["support"], sides=6))
        for truss in range(GONDOLA_COUNT * 2):
            angle_a = 2 * math.pi * truss / (GONDOLA_COUNT * 2)
            angle_b = 2 * math.pi * (truss + 1) / (GONDOLA_COUNT * 2)
            outer = (x, RIM_RADIUS * math.sin(angle_a), RIM_RADIUS * math.cos(angle_a))
            inner = (x, (RIM_RADIUS - 1.6) * math.sin(angle_b), (RIM_RADIUS - 1.6) * math.cos(angle_b))
            frame.append(beam_between(f"truss_{side}_{truss}", outer, inner, 0.05, mats["support"], sides=6))
    for tie in range(GONDOLA_COUNT * 2):
        angle = 2 * math.pi * tie / (GONDOLA_COUNT * 2)
        for radius in (RIM_RADIUS, RIM_RADIUS - 1.6):
            frame.append(cylinder(f"tie_{tie}_{radius}", 0.06, RIM_HALF_SPACING * 2,
                                  (0, radius * math.sin(angle), radius * math.cos(angle)), mats["support"], axis="x", sides=6))
    frame += [
        cylinder("hub", 1.1, 2.4, (0, 0, 0), mats["brand"], axis="x", sides=24, round_by=0.12),
        cylinder("hub_cap_l", 0.7, 0.3, (1.35, 0, 0), mats["steel"], axis="x", sides=20, round_by=0.05),
        cylinder("hub_cap_r", 0.7, 0.3, (-1.35, 0, 0), mats["steel"], axis="x", sides=20, round_by=0.05),
        cylinder("axle", 0.38, 7.2, (0, 0, 0), mats["steel_dark"], axis="x", sides=16),
        sphere("hub_lamp", 0.4, (0, 0, 1.0), mats["glow_warm"], segments=12),
    ]
    combine("ferris_wheel_frame", frame, parent=rotor)
    colours = ["#f0545c", "#7aaee8", "#e3bd55", "#7c6fe0"]
    for index in range(GONDOLA_COUNT):
        gondola(index, mats, rotor, 2 * math.pi * index / GONDOLA_COUNT - math.pi / 2, colours[index % 4])
    towers = []
    for side in (-1, 1):
        x_top = side * 3.4
        x_foot = side * 5.4
        top = (x_top, HUB_HEIGHT, 0)
        for forward in (-1, 1):
            towers.append(beam_between(f"leg_{side}_{forward}", top, (x_foot, 0.5, forward * 11.5), 0.5, mats["brand"], sides=14))
            towers.append(box(f"foot_{side}_{forward}", (1.8, 0.8, 1.8), (x_foot, 0.4, forward * 11.5), mats["concrete"], 0.06))
        for height in (6.0, 13.0, 19.0):
            spread = 11.5 * (HUB_HEIGHT - height) / (HUB_HEIGHT - 0.5)
            x_here = x_top + (x_foot - x_top) * (HUB_HEIGHT - height) / (HUB_HEIGHT - 0.5)
            towers.append(beam_between(f"brace_{side}_{height}", (x_here, height, -spread), (x_here, height, spread), 0.22, mats["brand"], sides=10))
        towers.append(box(f"bearing_{side}", (1.0, 1.6, 1.6), (side * 3.4, HUB_HEIGHT, 0), mats["steel_dark"], 0.1))
        towers.append(cylinder(f"crown_lamp_{side}", 0.25, 1.4, (side * 3.4, HUB_HEIGHT + 1.4, 0), mats["glow_amber"], sides=12))
    towers.append(beam_between("tower_tie", (-3.4, HUB_HEIGHT - 2.2, 0), (3.4, HUB_HEIGHT - 2.2, 0), 0.2, mats["brand_dark"], sides=10))
    combine("ferris_towers", towers, parent=group)
    base = [
        box("deck", (9.0, 0.5, 7.0), (0, 0.25, 0), mats["concrete"], 0.08),
        box("boarding", (4.0, 0.12, 4.0), (0, 0.56, 0), mats["paving"], 0.03),
        box("ramp", (2.4, 0.25, 4.0), (0, 0.15, 5.4), mats["concrete"], 0.05),
        box("booth", (2.0, 2.4, 1.8), (-3.6, 1.7, 2.4), mats["white"], 0.1),
        box("booth_roof", (2.3, 0.2, 2.1), (-3.6, 3.0, 2.4), mats["brand"], 0.06),
        box("booth_window", (0.06, 0.9, 1.2), (-2.58, 2.0, 2.4), mats["glass"], 0.02),
        box("sign_plate", (3.0, 0.8, 0.12), (0, 3.0, 7.8), mats["sign_blank"], 0.04),
        box("sign_post_l", (0.12, 3.0, 0.12), (-1.3, 1.5, 7.8), mats["steel"], 0.03),
        box("sign_post_r", (0.12, 3.0, 0.12), (1.3, 1.5, 7.8), mats["steel"], 0.03),
    ]
    for post in range(-4, 5):
        for forward in (-3.4, 3.4):
            base.append(box(f"fence_{post}_{forward}", (0.08, 1.0, 0.08), (post, 1.0, forward), mats["steel"], 0.02))
    for forward in (-3.4, 3.4):
        base.append(box(f"rail_{forward}", (8.2, 0.06, 0.06), (0, 1.45, forward), mats["brand"], 0.02))
    combine("ferris_base", base, parent=group)
    lamp = cylinder("ferris_status", 0.12, 0.3, (-3.6, 3.3, 2.4), mats["status"], sides=12)
    lamp.parent = group
    return group


# --- Carousel --------------------------------------------------------------------------------

PLATFORM_TOP = 0.55
CANOPY_EAVE = 4.8


def horse(name, mats, coat, saddle, mane):
    """Galloping horse facing +forward, origin on the pole at platform height (local coords)."""
    coat_mat = material(f"coat_{coat.lstrip('#')}", coat, roughness=0.35)
    saddle_mat = material(f"saddle_{saddle.lstrip('#')}", saddle, roughness=0.4)
    mane_mat = material(f"mane_{mane.lstrip('#')}", mane, roughness=0.5)
    body_y = 1.15
    parts = [
        sphere("body", 0.5, (0, body_y, 0), coat_mat, scale=(0.46, 0.62, 1.25), segments=20),
        beam_between("neck", (0, body_y + 0.12, 0.42), (0, body_y + 0.62, 0.72), 0.15, coat_mat, sides=12),
        sphere("head", 0.16, (0, body_y + 0.68, 0.9), coat_mat, scale=(0.85, 0.95, 1.9), segments=14),
        sphere("muzzle", 0.1, (0, body_y + 0.6, 1.12), coat_mat, scale=(0.9, 0.9, 1.0), segments=10),
        cylinder("ear_l", 0.04, 0.14, (0.07, body_y + 0.86, 0.82), coat_mat, sides=6, radius_end=0.0),
        cylinder("ear_r", 0.04, 0.14, (-0.07, body_y + 0.86, 0.82), coat_mat, sides=6, radius_end=0.0),
        box("mane", (0.07, 0.12, 0.55), (0, body_y + 0.55, 0.52), mane_mat, 0.03),
        box("saddle", (0.5, 0.1, 0.42), (0, body_y + 0.3, -0.05), saddle_mat, 0.04),
        box("saddle_cloth", (0.52, 0.32, 0.5), (0, body_y + 0.16, -0.05), saddle_mat, 0.03),
        box("bridle", (0.24, 0.04, 0.3), (0, body_y + 0.62, 0.95), mats["gold"], 0.01),
        beam_between("tail", (0, body_y + 0.15, -0.6), (0, body_y - 0.45, -0.85), 0.07, mane_mat, sides=8),
    ]
    legs = [
        ((0.14, body_y - 0.15, 0.4), (0.14, body_y - 0.42, 0.68), (0.14, body_y - 0.68, 0.5)),
        ((-0.14, body_y - 0.15, 0.4), (-0.14, body_y - 0.5, 0.6), (-0.14, body_y - 0.8, 0.42)),
        ((0.14, body_y - 0.15, -0.4), (0.14, body_y - 0.5, -0.62), (0.14, body_y - 0.8, -0.95)),
        ((-0.14, body_y - 0.15, -0.4), (-0.14, body_y - 0.52, -0.55), (-0.14, body_y - 0.85, -0.85)),
    ]
    for index, (hip, knee, hoof) in enumerate(legs):
        parts += [beam_between(f"thigh_{index}", hip, knee, 0.075, coat_mat, sides=8),
                  beam_between(f"shin_{index}", knee, hoof, 0.05, coat_mat, sides=8),
                  sphere(f"hoof_{index}", 0.06, hoof, mats["gold"], segments=8)]
    for side in (-1, 1):
        parts.append(box(f"stirrup_{side}", (0.03, 0.3, 0.06), (side * 0.27, body_y - 0.05, -0.05), mats["gold"], 0.01))
    return combine(name, parts, origin=(0, 0, 0))


def chariot(name, mats):
    parts = [
        box("seat_base", (0.9, 0.45, 1.3), (0, 0.23, 0), mats["brand"], 0.1),
        box("bench", (0.8, 0.1, 0.5), (0, 0.5, -0.25), mats["seat"], 0.04),
        box("back", (0.9, 0.8, 0.12), (0, 0.75, -0.6), mats["brand"], 0.06),
        box("side_l", (0.08, 0.5, 1.1), (0.45, 0.6, 0), mats["gold"], 0.03),
        box("side_r", (0.08, 0.5, 1.1), (-0.45, 0.6, 0), mats["gold"], 0.03),
        sphere("swan_front", 0.3, (0, 0.75, 0.55), mats["white"], scale=(0.8, 1.4, 0.8), segments=14),
    ]
    return combine(name, parts, origin=(0, 0, 0))


def build_carousel(mats):
    group = root("carousel", (40, 0, 0))
    base = [
        cylinder("plinth", 8.2, 0.35, (0, 0.175, 0), mats["concrete"], sides=64, round_by=0.05),
        cylinder("step", 8.7, 0.15, (0, 0.075, 0), mats["paving"], sides=64, round_by=0.03),
        box("console", (0.9, 1.1, 0.6), (9.9, 0.55, 0.6), mats["dark"], 0.06),
        box("console_screen", (0.6, 0.04, 0.35), (9.9, 1.12, 0.6), mats["screen"], 0.01),
        box("sign_plate", (2.6, 0.7, 0.1), (0, 2.6, 10.6), mats["sign_blank"], 0.04),
        box("sign_post_l", (0.1, 2.6, 0.1), (-1.1, 1.3, 10.6), mats["gold"], 0.03),
        box("sign_post_r", (0.1, 2.6, 0.1), (1.1, 1.3, 10.6), mats["gold"], 0.03),
    ]
    for post in range(40):
        angle = 2 * math.pi * post / 40
        if abs(math.cos(angle) - 1) < 0.02 or abs(angle - math.pi / 2) < 0.1:
            continue
        base.append(cylinder(f"fence_{post}", 0.05, 1.0, (9.3 * math.sin(angle), 0.5, 9.3 * math.cos(angle)), mats["gold"], sides=8))
    base.append(torus("fence_rail", 9.3, 0.04, (0, 1.0, 0), mats["gold"], axis="up", major_segments=80, minor_segments=6))
    combine("carousel_base", base, parent=group)
    lamp = cylinder("carousel_status", 0.1, 0.25, (9.9, 1.25, 0.6), mats["status"], sides=12)
    lamp.parent = group
    rotor = root("carousel_rotor")
    rotor.parent = group
    stripe_white = material("canopy_white", "#fbf6ef", roughness=0.6)
    stripe_colour = material("canopy_coral", "#f0545c", roughness=0.55)

    def stripes(center_x, center_up, center_forward):
        return int(((math.atan2(center_forward, center_x) + math.pi) / (2 * math.pi) * 24)) % 2

    deck = [
        cylinder("platform", 7.6, 0.22, (0, PLATFORM_TOP - 0.11, 0), mats["wood"], sides=64, round_by=0.04),
        cylinder("platform_band", 7.7, 0.16, (0, PLATFORM_TOP - 0.2, 0), mats["gold"], sides=64),
        cylinder("column", 1.3, CANOPY_EAVE, (0, PLATFORM_TOP + CANOPY_EAVE / 2, 0), mats["white"], sides=24, round_by=0.05),
        loft("canopy", [(CANOPY_EAVE + 0.4, 8.2, 8.2, 0), (CANOPY_EAVE + 0.6, 8.0, 8.0, 0), (CANOPY_EAVE + 3.9, 2.0, 2.0, 0), (CANOPY_EAVE + 4.1, 0.9, 0.9, 0)],
             [stripe_white, stripe_colour], sides=48, axis="up", material_for_face=stripes),
        cylinder("rounding_board", 8.25, 0.8, (0, CANOPY_EAVE + 0.2, 0), mats["white"], sides=64),
        cylinder("board_trim", 8.32, 0.12, (0, CANOPY_EAVE - 0.18, 0), mats["gold"], sides=64),
        cylinder("crown", 1.0, 0.7, (0, CANOPY_EAVE + 4.4, 0), mats["gold"], sides=20, round_by=0.05),
        cylinder("crown_cap", 1.05, 0.9, (0, CANOPY_EAVE + 5.2, 0), stripe_colour, sides=20, radius_end=0.1),
        sphere("finial", 0.22, (0, CANOPY_EAVE + 5.75, 0), mats["gold"], segments=12),
        bulbs("board_bulbs", (0, 0, 0), 8.36, 48, CANOPY_EAVE + 0.2, mats["glow_warm"], size=0.07),
        bulbs("column_bulbs", (0, 0, 0), 1.34, 16, PLATFORM_TOP + CANOPY_EAVE - 0.4, mats["glow_warm"], size=0.06),
    ]
    for panel in range(12):
        angle = 2 * math.pi * (panel + 0.5) / 12
        mirror = box(f"mirror_{panel}", (0.5, 1.2, 0.05), (1.32 * math.sin(angle), PLATFORM_TOP + 2.6, 1.32 * math.cos(angle)), mats["glass_light"], 0.03)
        mirror.rotation_euler = (0, 0, angle)
        plaque = box(f"plaque_{panel}", (1.4, 0.5, 0.06), (8.3 * math.sin(angle), CANOPY_EAVE + 0.2, 8.3 * math.cos(angle)), mats["gold"], 0.03)
        plaque.rotation_euler = (0, 0, angle)
        deck += [mirror, plaque]
    coats = [("#f6f2ea", "#f0545c", "#e3bd55"), ("#d9c7a6", "#7aaee8", "#6e4a31"), ("#9aa3ad", "#e3bd55", "#f6f2ea"),
             ("#3b3f46", "#f0545c", "#e3bd55"), ("#f6f2ea", "#7c6fe0", "#c79a5a")]
    horse_number = 0
    chariot_number = 0
    for row_radius, offset, count in ((6.3, 0.0, 12), (4.2, 0.5, 12)):
        for slot in range(count):
            angle = 2 * math.pi * (slot + offset) / count
            x = row_radius * math.cos(angle)
            forward = row_radius * math.sin(angle)
            deck.append(cylinder(f"pole_{row_radius}_{slot}", 0.04, CANOPY_EAVE, (x, PLATFORM_TOP + CANOPY_EAVE / 2, forward), mats["brass"], sides=8))
            heading = -angle
            if row_radius < 5 and slot in (0, 6):
                chariot_number += 1
                piece = chariot(f"chariot_{chariot_number:02d}", mats)
            else:
                coat, saddle, mane = coats[horse_number % len(coats)]
                horse_number += 1
                piece = horse(f"horse_{horse_number:02d}", mats, coat, saddle, mane)
            piece.parent = rotor
            piece.location = point(x, PLATFORM_TOP, forward)
            piece.rotation_euler = (0, 0, heading)
    combine("carousel_deck", deck, parent=rotor)
    return group


def build():
    reset_scene()
    mats = palette()
    build_ferris(mats)
    build_carousel(mats)
    export("rides.glb")


if __name__ == "__main__":
    build()
