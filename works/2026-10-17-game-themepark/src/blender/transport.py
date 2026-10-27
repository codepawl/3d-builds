"""Vehicles and the monorail: transport.glb (refs/monorail.md, parking_tram.md, utility_cart.md, parade_float.md).

Monorail (straddle beam; beam top is at y = 6.5 m on the pylons):
  monorail_beam      4 m beam segment, origin at the top centre of the segment, along forward
  monorail_pylon     T-pylon, origin on the ground; its cap meets the beam bottom at 5.0 m
  monorail_station   elevated platform beside the beam (beam at x = 0, platform +x), origin on the ground
  monorail_car_lead / monorail_car_mid / monorail_car_tail
                     10 m cars, origin on the beam top centre; doors `<car>_door_<side><n>` are children
                     with their origin at the door centre and slide 0.9 m along forward
Road vehicles (origin on the ground at the vehicle centre, facing +forward; wheels are children named *_wheel_*
with their origin at the axle, spinning about x):
  tram_tractor, tram_trailer (hitch 0.6 m beyond each end), maint_cart_bed, maint_cart_box,
  car_hatch, car_sedan, car_suv (paint material car_paint_<model> for the app to tint)
Parade floats: float_cake, float_rocket, float_carriage (8 x 3 m deck, skirts to 0.1 m, lamps glow).
"""
import math

from lib import box, combine, cylinder, export, loft, material, reset_scene, root, sphere, wheel
from parts import beam_between, palette

BEAM_TOP = 6.5


def build_monorail_infra(mats):
    beam = root("monorail_beam", (0, 0, 0))
    combine("monorail_beam_body", [box("beam", (0.8, 1.5, 4.0), (0, -0.75, 0), mats["concrete"], 0.04),
                                   box("power_rail_l", (0.06, 0.1, 4.0), (0.42, -0.35, 0), mats["steel_dark"], 0.01),
                                   box("power_rail_r", (0.06, 0.1, 4.0), (-0.42, -0.35, 0), mats["steel_dark"], 0.01)], parent=beam)
    pylon = root("monorail_pylon", (4, 0, 0))
    combine("monorail_pylon_body", [
        box("column", (1.0, BEAM_TOP - 1.5 - 0.6, 1.0), (0, (BEAM_TOP - 2.1) / 2, 0), mats["concrete"], 0.12),
        box("cap", (2.6, 0.6, 1.4), (0, BEAM_TOP - 1.8, 0), mats["concrete"], 0.1),
        box("bearing", (1.0, 0.1, 1.0), (0, BEAM_TOP - 1.45, 0), mats["steel_dark"], 0.02),
        box("footing", (2.2, 0.4, 2.2), (0, 0.2, 0), mats["concrete"], 0.05)], parent=pylon)
    station = root("monorail_station", (12, 0, 0))
    floor = BEAM_TOP + 0.3
    parts = [box("platform", (4.0, 0.5, 30), (3.0, floor - 0.25, 0), mats["concrete"], 0.08),
             box("edge", (0.3, 0.03, 30), (1.15, floor + 0.01, 0), material("edge_yellow", "#f2c53d", 0.6), 0.01),
             box("canopy", (5.0, 0.3, 30.6), (2.6, floor + 3.6, 0), mats["white"], 0.1),
             box("canopy_band", (5.1, 0.35, 0.2), (2.6, floor + 3.6, 15.3), mats["brand"], 0.05),
             box("stair_tower", (3.0, floor + 4.0, 4.0), (6.6, (floor + 4.0) / 2, -12), mats["white"], 0.15),
             box("stair_glass", (0.1, floor, 3.0), (8.12, floor / 2 + 1, -12), mats["glass_light"], 0.02),
             box("sign", (0.12, 0.6, 4.0), (5.1, floor + 2.6, 0), mats["sign_blank"], 0.03)]
    for forward in range(-12, 13, 6):
        parts += [box(f"column_{forward}", (0.6, floor - 0.5, 0.6), (3.0, (floor - 0.5) / 2, forward), mats["concrete"], 0.06),
                  cylinder(f"canopy_post_{forward}", 0.1, 3.6, (4.8, floor + 1.8, forward), mats["support"], sides=8),
                  box(f"bench_{forward}", (0.5, 0.45, 2.0), (4.4, floor + 0.23, forward + 3), mats["wood"], 0.05)]
    parts += [box("rail", (0.05, 0.05, 30), (4.95, floor + 1.0, 0), mats["steel"], 0.01)]
    combine("monorail_station_body", parts, parent=station)
    combine("monorail_station_lights", [box("strip", (0.2, 0.06, 29), (2.0, floor + 3.43, 0), mats["glow_warm"], 0.02)], parent=station)


def monorail_car(name, mats, kind, x_offset):
    group = root(name, (x_offset, BEAM_TOP, 0))
    body = material("monorail_body", "#f6f7fa", roughness=0.35, metallic=0.1)
    accent = material("monorail_accent", "#7c6fe0", roughness=0.4)
    length = 10.0
    parts = [box("body", (2.9, 2.7, length), (0, 1.65, 0), body, 0.45),
             box("window_band_l", (0.04, 0.8, length - 1.6), (1.46, 2.05, 0), mats["glass"], 0.03),
             box("window_band_r", (0.04, 0.8, length - 1.6), (-1.46, 2.05, 0), mats["glass"], 0.03),
             box("stripe_l", (0.04, 0.18, length - 0.6), (1.46, 1.35, 0), accent, 0.02),
             box("stripe_r", (0.04, 0.18, length - 0.6), (-1.46, 1.35, 0), accent, 0.02),
             box("roof_unit", (1.8, 0.35, 3.0), (0, 3.15, -1.5), mats["panel"], 0.1),
             box("skirt_l", (0.18, 1.1, length - 0.6), (0.6, -0.25, 0), body, 0.06),
             box("skirt_r", (0.18, 1.1, length - 0.6), (-0.6, -0.25, 0), body, 0.06),
             box("bogie_front", (1.0, 0.4, 1.6), (0, 0.2, 3.2), mats["dark"], 0.05),
             box("bogie_rear", (1.0, 0.4, 1.6), (0, 0.2, -3.2), mats["dark"], 0.05),
             box("number_plate", (0.03, 0.25, 0.6), (1.47, 2.7, 3.8), mats["sign_blank"], 0.01)]
    if kind in ("lead", "tail"):
        direction = 1 if kind == "lead" else -1
        nose = loft("nose", [(0, 1.45, 1.35, 1.65), (1.2, 1.4, 1.3, 1.6), (2.3, 1.1, 1.0, 1.4), (3.0, 0.6, 0.6, 1.25), (3.2, 0.0, 0.0, 1.2)],
                    body, sides=28)
        nose.scale = (1, direction, 1)
        nose.location = (0, -direction * (length / 2 - 0.4), 0)
        windscreen = loft("windscreen", [(1.0, 1.36, 0.5, 2.25), (2.0, 1.1, 0.45, 2.0), (2.6, 0.7, 0.3, 1.8)], mats["glass"], sides=20)
        windscreen.scale = (1, direction, 1)
        windscreen.location = (0, -direction * (length / 2 - 0.4), 0)
        parts += [nose, windscreen,
                  box("headlamp_l", (0.35, 0.12, 0.1), (0.7, 1.0, direction * (length / 2 + 2.15)), mats["glow_cool"] if direction > 0 else material("tail_lamp", "#ff4a4a", emission="#ff2a2a", strength=3.0), 0.03),
                  box("headlamp_r", (0.35, 0.12, 0.1), (-0.7, 1.0, direction * (length / 2 + 2.15)), mats["glow_cool"] if direction > 0 else material("tail_lamp", "#ff4a4a", emission="#ff2a2a", strength=3.0), 0.03)]
    else:
        parts += [box("gangway_f", (2.0, 2.3, 0.4), (0, 1.6, length / 2 + 0.15), mats["dark"], 0.1),
                  box("gangway_r", (2.0, 2.3, 0.4), (0, 1.6, -length / 2 - 0.15), mats["dark"], 0.1)]
    combine(f"{name}_body", parts, parent=group)
    for side, x in (("L", 1.47), ("R", -1.47)):
        for index, forward in enumerate((-2.2, 2.2)):
            combine(f"{name}_door_{side}{index + 1}",
                    [box("door", (0.06, 2.0, 1.2), (x, 1.5, forward), mats["steel"], 0.03),
                     box("door_glass", (0.07, 0.8, 0.9), (x, 2.0, forward), mats["glass"], 0.02)],
                    origin=(x, 1.5, forward), parent=group)
    return group


def tram_tractor(mats):
    group = root("tram_tractor", (30, 0, 0))
    paint = material("tram_green", "#3f9a6b", roughness=0.4)
    parts = [box("chassis", (1.7, 0.35, 4.0), (0, 0.55, 0), mats["dark"], 0.06),
             box("bonnet", (1.7, 0.85, 1.6), (0, 1.15, 1.1), paint, 0.25),
             box("grille", (1.0, 0.5, 0.06), (0, 1.1, 1.92), mats["steel_dark"], 0.03),
             box("cab_floor", (1.8, 0.2, 2.2), (0, 0.85, -0.8), paint, 0.06),
             box("seat", (1.2, 0.5, 0.6), (0, 1.25, -0.9), mats["seat"], 0.1),
             box("seat_back", (1.2, 0.7, 0.15), (0, 1.6, -1.3), mats["seat"], 0.06),
             box("roof", (2.0, 0.15, 2.6), (0, 2.45, -0.5), mats["white"], 0.06),
             box("windscreen", (1.6, 0.9, 0.05), (0, 1.95, 0.35), mats["glass_light"], 0.02),
             box("hitch", (0.2, 0.15, 0.5), (0, 0.5, -2.2), mats["steel_dark"], 0.03),
             box("plate", (0.5, 0.15, 0.03), (0, 0.75, 1.96), mats["sign_blank"], 0.01)]
    for side in (-1, 1):
        parts += [box(f"lamp_{side}", (0.25, 0.18, 0.08), (side * 0.6, 1.4, 1.93), mats["glow_warm"], 0.04),
                  cylinder(f"post_f_{side}", 0.04, 1.2, (side * 0.85, 1.85, 0.3), mats["steel"], sides=8),
                  cylinder(f"post_r_{side}", 0.04, 1.6, (side * 0.85, 1.65, -1.7), mats["steel"], sides=8),
                  box(f"fender_{side}", (0.3, 0.12, 0.9), (side * 0.85, 1.05, 1.2), mats["dark"], 0.05)]
    combine("tram_tractor_body", parts, parent=group)
    for side, x in (("l", 0.8), ("r", -0.8)):
        for axle, forward in (("f", 1.2), ("r", -1.2)):
            wheel(f"tram_tractor_wheel_{axle}{side}", 0.38, 0.28, (x, 0.38, forward), group)
    return group


def tram_trailer(mats):
    group = root("tram_trailer", (34, 0, 0))
    paint = material("tram_green", "#3f9a6b", roughness=0.4)
    parts = [box("floor", (2.1, 0.25, 6.5), (0, 0.55, 0), paint, 0.08),
             box("roof", (2.3, 0.15, 6.8), (0, 2.6, 0), mats["white"], 0.06),
             box("roof_trim", (2.35, 0.25, 6.85), (0, 2.45, 0), mats["brand"], 0.05),
             box("drawbar", (0.15, 0.12, 1.2), (0, 0.45, 3.7), mats["steel_dark"], 0.03),
             box("hitch_rear", (0.2, 0.15, 0.4), (0, 0.5, -3.4), mats["steel_dark"], 0.03)]
    for row in range(6):
        forward = -2.6 + row * 1.05
        parts += [box(f"bench_{row}", (1.9, 0.12, 0.45), (0, 1.05, forward), mats["wood"], 0.04),
                  box(f"back_{row}", (1.9, 0.5, 0.08), (0, 1.4, forward - 0.25), mats["wood"], 0.03)]
    for side in (-1, 1):
        for forward in (-3.1, -1.0, 1.0, 3.1):
            parts.append(cylinder(f"post_{side}_{forward}", 0.04, 1.9, (side * 1.0, 1.6, forward), mats["steel"], sides=8))
        parts += [box(f"step_{side}", (0.3, 0.06, 6.0), (side * 1.2, 0.4, 0), mats["steel_dark"], 0.02),
                  box(f"side_{side}", (0.06, 0.35, 6.5), (side * 1.02, 0.85, 0), paint, 0.03)]
    combine("tram_trailer_body", parts, parent=group)
    for side, x in (("l", 0.85), ("r", -0.85)):
        for axle, forward in (("f", 2.3), ("r", -2.3)):
            wheel(f"tram_trailer_wheel_{axle}{side}", 0.3, 0.22, (x, 0.3, forward), group)
    return group


def maint_cart(mats, name, x_offset, boxed):
    group = root(name, (x_offset, 0, 0))
    paint = material("maint_orange", "#f29b38", roughness=0.45)
    parts = [box("chassis", (1.15, 0.25, 2.9), (0, 0.4, 0), mats["dark"], 0.05),
             box("cowl", (1.2, 0.6, 0.7), (0, 0.8, 1.15), paint, 0.2),
             box("seat", (1.0, 0.25, 0.5), (0, 0.8, 0.2), mats["seat"], 0.06),
             box("seat_back", (1.0, 0.5, 0.12), (0, 1.15, -0.05), mats["seat"], 0.05),
             box("roof", (1.25, 0.08, 1.4), (0, 1.88, 0.45), mats["white"], 0.04),
             box("windscreen", (1.05, 0.75, 0.04), (0, 1.45, 1.05), mats["glass_light"], 0.02),
             cylinder("beacon", 0.09, 0.15, (0, 1.99, 0.2), mats["glow_amber"], sides=12),
             box("lamp_l", (0.18, 0.1, 0.05), (0.4, 0.85, 1.52), mats["glow_warm"], 0.02),
             box("lamp_r", (0.18, 0.1, 0.05), (-0.4, 0.85, 1.52), mats["glow_warm"], 0.02)]
    for side in (-1, 1):
        parts += [cylinder(f"post_f_{side}", 0.03, 1.0, (side * 0.55, 1.38, 1.05), mats["steel"], sides=8),
                  cylinder(f"post_r_{side}", 0.03, 1.15, (side * 0.55, 1.3, -0.15), mats["steel"], sides=8)]
    if boxed:
        parts += [box("cargo_box", (1.2, 1.1, 1.2), (0, 1.1, -0.85), mats["white"], 0.08),
                  box("box_band", (1.22, 0.2, 1.22), (0, 0.75, -0.85), paint, 0.03),
                  box("box_door", (0.9, 0.85, 0.03), (0, 1.15, -1.47), mats["panel"], 0.02)]
    else:
        parts += [box("bed", (1.2, 0.08, 1.2), (0, 0.6, -0.85), mats["steel"], 0.02)]
        parts += [box(f"bed_side_{s}", (0.05, 0.3, 1.2), (s * 0.6, 0.75, -0.85), paint, 0.02) for s in (-1, 1)]
        parts += [box("toolbox", (0.7, 0.3, 0.4), (0.15, 0.8, -0.65), material("toolbox_red", "#c84040", 0.5), 0.04),
                  box("cones", (0.25, 0.4, 0.25), (-0.35, 0.85, -1.15), material("cone_orange", "#ff7a1a", 0.6), 0.05),
                  box("ladder", (0.35, 0.06, 1.6), (0, 1.95, -0.2), mats["steel"], 0.02)]
    combine(f"{name}_body", parts, parent=group)
    for side, x in (("l", 0.52), ("r", -0.52)):
        for axle, forward in (("f", 1.0), ("r", -0.95)):
            wheel(f"{name}_wheel_{axle}{side}", 0.24, 0.2, (x, 0.24, forward), group)
    return group


CARS = {
    "car_hatch": {"size": (1.75, 4.0), "cabin": (1.5, 0.62, 2.1, -0.35), "colour": "#e9ecf1", "body_height": 0.75},
    "car_sedan": {"size": (1.8, 4.7), "cabin": (1.55, 0.6, 2.3, -0.1), "colour": "#6f86a8", "body_height": 0.72},
    "car_suv": {"size": (1.9, 4.8), "cabin": (1.7, 0.78, 2.8, -0.35), "colour": "#3b4250", "body_height": 0.9},
}


def parked_car(mats, name, spec, x_offset):
    group = root(name, (x_offset, 0, 12))
    width, length = spec["size"]
    cabin_width, cabin_height, cabin_length, cabin_offset = spec["cabin"]
    body_height = spec["body_height"]
    paint = material(f"car_paint_{name.split('_')[1]}", spec["colour"], roughness=0.3, metallic=0.4)
    floor = 0.3
    parts = [box("body", (width, body_height, length), (0, floor + body_height / 2, 0), paint, 0.22),
             box("cabin", (cabin_width, cabin_height, cabin_length), (0, floor + body_height + cabin_height / 2 - 0.05, cabin_offset), paint, 0.25),
             box("glass", (cabin_width + 0.02, cabin_height * 0.62, cabin_length - 0.3), (0, floor + body_height + cabin_height * 0.45, cabin_offset), mats["glass"], 0.12),
             box("bumper_f", (width - 0.1, 0.2, 0.12), (0, floor + 0.15, length / 2), mats["dark"], 0.05),
             box("bumper_r", (width - 0.1, 0.2, 0.12), (0, floor + 0.15, -length / 2), mats["dark"], 0.05),
             box("plate_f", (0.5, 0.12, 0.03), (0, floor + 0.35, length / 2 + 0.02), mats["sign_blank"], 0.01)]
    for side in (-1, 1):
        parts += [box(f"lamp_{side}", (0.35, 0.1, 0.05), (side * (width / 2 - 0.3), floor + body_height - 0.15, length / 2 - 0.01), mats["glow_warm"], 0.03),
                  box(f"tail_{side}", (0.3, 0.1, 0.05), (side * (width / 2 - 0.3), floor + body_height - 0.15, -length / 2 + 0.01), material("tail_lamp", "#ff4a4a", emission="#ff2a2a", strength=3.0), 0.03),
                  box(f"mirror_{side}", (0.18, 0.1, 0.12), (side * (width / 2 + 0.05), floor + body_height + 0.1, cabin_offset + cabin_length / 2 - 0.1), paint, 0.03)]
    combine(f"{name}_body", parts, parent=group)
    for side, x in (("l", width / 2 - 0.12), ("r", -width / 2 + 0.12)):
        for axle, forward in (("f", length * 0.33), ("r", -length * 0.33)):
            wheel(f"{name}_wheel_{axle}{side}", 0.33, 0.22, (x, 0.33, forward), group)
    return group


def float_deck(prefix, mats, colour):
    skirt = material(f"{prefix}_skirt", colour, roughness=0.6)
    parts = [box(f"{prefix}_deck", (3.0, 0.25, 8.0), (0, 0.9, 0), mats["white"], 0.08),
             box(f"{prefix}_skirt", (3.05, 0.8, 8.05), (0, 0.5, 0), skirt, 0.1)]
    for index in range(16):
        forward = -3.75 + index * 0.5
        for side in (-1, 1):
            parts.append(sphere(f"{prefix}_scallop_{index}_{side}", 0.22, (side * 1.53, 0.2, forward), skirt, scale=(0.3, 1, 1), segments=8))
    for index in range(10):
        forward = -3.6 + index * 0.8
        for side in (-1, 1):
            parts.append(sphere(f"{prefix}_bulb_{index}_{side}", 0.07, (side * 1.54, 1.0, forward), mats["glow_warm"], segments=6))
    parts.append(box(f"{prefix}_cab", (1.6, 0.9, 1.0), (0, 1.45, 3.4), mats["white"], 0.2))
    parts.append(box(f"{prefix}_cab_glass", (1.4, 0.4, 0.05), (0, 1.6, 3.92), mats["glass"], 0.02))
    return parts


def build_floats(mats):
    cake = root("float_cake", (60, 0, 0))
    parts = float_deck("cake", mats, "#f4a6c0")
    icing = material("icing", "#fff6f0", roughness=0.5)
    pink = material("cake_pink", "#f4a6c0", roughness=0.5)
    for tier, (radius, height) in enumerate(((1.4, 1.1), (1.05, 0.9), (0.7, 0.8))):
        base = 1.0 + sum(h for _, h in ((1.4, 1.1), (1.05, 0.9), (0.7, 0.8))[:tier])
        parts += [cylinder(f"tier_{tier}", radius, height, (0, base + height / 2, -0.8), pink if tier % 2 == 0 else icing, sides=32, round_by=0.08),
                  cylinder(f"drip_{tier}", radius + 0.04, 0.15, (0, base + height - 0.08, -0.8), icing, sides=32, round_by=0.05)]
    for candle in range(5):
        angle = candle * 2 * math.pi / 5
        parts += [cylinder(f"candle_{candle}", 0.06, 0.4, (0.4 * math.cos(angle), 4.0, -0.8 + 0.4 * math.sin(angle)), mats["white"], sides=8),
                  sphere(f"flame_{candle}", 0.07, (0.4 * math.cos(angle), 4.27, -0.8 + 0.4 * math.sin(angle)), mats["glow_amber"], scale=(1, 1.6, 1), segments=8)]
    combine("float_cake_body", parts, parent=cake)

    rocket = root("float_rocket", (66, 0, 0))
    parts = float_deck("rocket", mats, "#7c6fe0")
    rocket_body = loft("rocket_hull", [(1.4, 0.0, 0.0, 0), (1.5, 0.55, 0.55, 0), (3.0, 0.7, 0.7, 0), (4.4, 0.55, 0.55, 0), (5.4, 0.0, 0.0, 0)],
                       mats["white"], sides=24, axis="up")
    rocket_body.location = (0, 0.8, 0)
    parts += [rocket_body,
              cylinder("window", 0.25, 0.1, (0, 3.6, -0.15), mats["glass_light"], axis="forward", sides=16),
              cylinder("exhaust", 0.4, 0.5, (0, 1.4, -0.8), mats["glow_amber"], sides=16, radius_end=0.15),
              sphere("planet", 0.6, (0.9, 1.7, 2.0), material("planet", "#e3bd55", 0.5), segments=16)]
    for fin in range(3):
        angle = fin * 2 * math.pi / 3
        piece = box(f"fin_{fin}", (0.08, 1.0, 0.7), (0.65 * math.cos(angle), 2.6, -0.8 + 0.65 * math.sin(angle)), mats["brand"], 0.03)
        piece.rotation_euler = (0, 0, -angle)
        parts.append(piece)
    combine("float_rocket_body", parts, parent=rocket)

    carriage = root("float_carriage", (72, 0, 0))
    parts = float_deck("carriage", mats, "#3f9a6b")
    parts += [box("coach", (1.8, 1.4, 2.4), (0, 2.0, -1.0), mats["white"], 0.4),
              cylinder("coach_roof", 1.0, 2.4, (0, 2.75, -1.0), mats["roof_blue"], axis="forward", sides=24),
              box("coach_window", (1.82, 0.6, 0.8), (0, 2.2, -1.0), mats["glass"], 0.1),
              sphere("crown", 0.25, (0, 3.85, -1.0), mats["gold"], segments=10)]
    for side in (-1, 1):
        for forward in (-2.4, 0.4):
            parts += [cylinder(f"big_wheel_{side}_{forward}", 0.65, 0.1, (side * 1.0, 1.7, forward), mats["gold"], axis="x", sides=20),
                      cylinder(f"big_hub_{side}_{forward}", 0.15, 0.14, (side * 1.0, 1.7, forward), mats["white"], axis="x", sides=10)]
    for flower in range(14):
        angle = flower * 0.9
        parts.append(sphere(f"flower_{flower}", 0.22, (1.2 * math.cos(angle), 1.15, 1.6 + 0.8 * math.sin(angle)),
                            (mats["roof_pink"], mats["gold"], mats["white"])[flower % 3], segments=8))
    combine("float_carriage_body", parts, parent=carriage)


def build():
    reset_scene()
    mats = palette()
    build_monorail_infra(mats)
    monorail_car("monorail_car_lead", mats, "lead", -10)
    monorail_car("monorail_car_mid", mats, "mid", -14)
    monorail_car("monorail_car_tail", mats, "tail", -18)
    tram_tractor(mats)
    tram_trailer(mats)
    maint_cart(mats, "maint_cart_bed", 40, boxed=False)
    maint_cart(mats, "maint_cart_box", 43, boxed=True)
    for index, (name, spec) in enumerate(CARS.items()):
        parked_car(mats, name, spec, 30 + index * 3)
    build_floats(mats)
    export("transport.glb")


if __name__ == "__main__":
    build()
