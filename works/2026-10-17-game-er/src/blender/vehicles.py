"""Ambulances: vehicles.glb (refs/ambulance.md).

Roots face +forward, sit on y = 0, origin on the ground at the middle of the wheelbase:
- amb_type3_a: Type III, 6.8 m, white with brand blue band and orange stripe.
- amb_type3_b: Type III, same body with navy band, red stripe and a different roof unit layout.
- amb_van: Type II high-roof van ambulance, 6.0 m.
Moving parts (own origins at their pivots): <root>_wheel_fl/fr (single), <root>_wheel_rl/rr (dual, one object
per side), <root>_door_rear_l/r (hinge on the outer vertical edge, swing about up), <root>_door_side (hinge at its
front edge). Lamps use glow_* materials; the light bar is its own object <root>_lightbar so the app can flash it.
Kerb side (patient side door) is the vehicle's right, which is -x when facing +forward.
"""
from lib import box, combine, cylinder, export, material, reset_scene, root, slab, wheel
from parts import bolts_row, palette, vent

WHEEL_RADIUS = 0.40


def panel_outline(prefix, side_x, forward, up, width, height, mats, thickness=0.012):
    """Four thin dark strips on a side face drawing a panel line around a door or hatch."""
    sign = 1 if side_x > 0 else -1
    face_x = side_x + sign * thickness / 2
    strip = 0.018
    return [
        box(f"{prefix}_top", (thickness, strip, width), (face_x, up + height / 2, forward), mats["dark"], 0.0),
        box(f"{prefix}_bottom", (thickness, strip, width), (face_x, up - height / 2, forward), mats["dark"], 0.0),
        box(f"{prefix}_front", (thickness, height, strip), (face_x, up, forward + width / 2), mats["dark"], 0.0),
        box(f"{prefix}_back", (thickness, height, strip), (face_x, up, forward - width / 2), mats["dark"], 0.0),
    ]


def cross_plate(prefix, side_x, forward, up, mats, size=0.55):
    """Own emblem: a white rounded plate with a brand-blue cross (not a real agency symbol)."""
    sign = 1 if side_x > 0 else -1
    return [
        box(f"{prefix}_plate", (0.02, size, size), (side_x + sign * 0.012, up, forward), mats["white"], 0.06),
        box(f"{prefix}_bar_up", (0.03, size * 0.7, size * 0.22), (side_x + sign * 0.02, up, forward), mats["brand"], 0.01),
        box(f"{prefix}_bar_across", (0.03, size * 0.22, size * 0.7), (side_x + sign * 0.02, up, forward), mats["brand"], 0.01),
    ]


def front_end(prefix, front, width, mats):
    """Bumper, grille with slats, headlamps, indicator and grille warning lamps."""
    parts = [
        box(f"{prefix}_bumper", (width + 0.06, 0.28, 0.22), (0, 0.52, front), mats["grey"], 0.06),
        box(f"{prefix}_plate_mount", (0.5, 0.12, 0.02), (0, 0.52, front + 0.12), mats["white"], 0.01),
        box(f"{prefix}_grille", (width * 0.5, 0.42, 0.06), (0, 0.98, front - 0.06), mats["dark"], 0.03),
    ]
    for index in range(4):
        parts.append(box(f"{prefix}_grille_slat{index}", (width * 0.46, 0.025, 0.03), (0, 0.84 + index * 0.09, front - 0.02), mats["chrome"], 0.008))
    for side in (1, -1):
        parts += [
            box(f"{prefix}_headlamp{side}", (0.34, 0.2, 0.06), (side * width * 0.36, 1.0, front - 0.07), mats["light_white"], 0.04),
            box(f"{prefix}_indicator{side}", (0.12, 0.08, 0.05), (side * width * 0.36, 0.86, front - 0.06), mats["light_amber"], 0.02),
            box(f"{prefix}_grille_lamp{side}", (0.12, 0.06, 0.04), (side * width * 0.18, 0.72, front - 0.02), mats["light_red"], 0.015),
        ]
    return parts


def cab(prefix, mats, body, width=2.04, front=3.42, back=1.18, roof=2.32):
    """Cutaway cab: side profile extruded across, windscreen, side windows, cab doors, mirrors."""
    outline = [(front - 0.02, 0.42), (front + 0.02, 0.95), (front - 0.12, 1.32), (2.45, 1.42),
               (1.98, roof - 0.04), (1.85, roof), (back, roof), (back, 0.42)]
    parts = [slab(f"{prefix}_shell", outline, width, body, plane="side", round_by=0.07)]
    parts.append(slab(f"{prefix}_windscreen", [(2.42, 1.47), (2.47, 1.47), (2.0, roof - 0.07), (1.95, roof - 0.07)],
                      width - 0.16, mats["glass"], plane="side", round_by=0.01))
    parts.append(box(f"{prefix}_hood_crease", (width * 0.6, 0.02, 0.9), (0, 1.40, 2.9), mats["panel"], 0.01))
    for side in (1, -1):
        face = side * (width / 2 + 0.006)
        parts += [
            box(f"{prefix}_window{side}", (0.02, 0.55, 0.75), (face, 1.86, 1.62), mats["glass"], 0.03),
            box(f"{prefix}_handle{side}", (0.03, 0.04, 0.16), (face + side * 0.01, 1.42, 1.45), mats["dark"], 0.01),
            box(f"{prefix}_mirror_arm{side}", (0.3, 0.04, 0.04), (side * (width / 2 + 0.15), 1.75, 2.02), mats["dark"], 0.01),
            box(f"{prefix}_mirror{side}", (0.06, 0.38, 0.2), (side * (width / 2 + 0.3), 1.72, 2.0), mats["dark"], 0.03),
            box(f"{prefix}_step{side}", (0.2, 0.05, 0.5), (side * (width / 2 - 0.05), 0.45, 1.6), mats["grey"], 0.015),
        ]
        parts += panel_outline(f"{prefix}_door{side}", side * width / 2, 1.6, 1.45, 0.95, 1.6, mats)
    parts += front_end(prefix, front, width, mats)
    return parts


def module(prefix, mats, band, stripe, length=4.55, width=2.44, back=-3.35, floor=0.78, top=2.88):
    """Patient module: rounded box with band and stripe, compartment doors, windows, emblem, rear frame."""
    middle_forward = back + length / 2
    middle_up = (floor + top) / 2
    parts = [
        box(f"{prefix}_module", (width, top - floor, length), (0, middle_up, middle_forward), mats["white"], 0.09),
        box(f"{prefix}_band", (width + 0.02, 0.36, length - 0.1), (0, 1.38, middle_forward), band, 0.02),
        box(f"{prefix}_stripe", (width + 0.025, 0.08, length - 0.1), (0, 1.12, middle_forward), stripe, 0.01),
        box(f"{prefix}_skirt", (width - 0.04, 0.12, length - 0.2), (0, floor - 0.02, middle_forward), mats["grey"], 0.03),
        box(f"{prefix}_rear_frame", (width + 0.02, top - floor - 0.05, 0.08), (0, middle_up, back - 0.02), mats["panel"], 0.03),
        box(f"{prefix}_rear_bumper", (width - 0.1, 0.2, 0.28), (0, 0.68, back - 0.12), mats["dark"], 0.03),
        box(f"{prefix}_rear_step_tread", (width - 0.3, 0.02, 0.22), (0, 0.785, back - 0.14), mats["grey"], 0.005),
    ]
    for side in (1, -1):
        face_x = side * width / 2
        parts += [
            box(f"{prefix}_tail{side}", (0.18, 0.32, 0.04), (side * (width / 2 - 0.16), 1.15, back - 0.07), mats["tail"], 0.02),
            box(f"{prefix}_reverse{side}", (0.18, 0.1, 0.04), (side * (width / 2 - 0.16), 0.93, back - 0.07), mats["light_white"], 0.02),
            box(f"{prefix}_marker_rear{side}", (0.03, 0.08, 0.08), (face_x + side * 0.01, 2.7, back + 0.15), mats["light_amber"], 0.01),
            box(f"{prefix}_side_lamp_hi{side}", (0.03, 0.14, 0.28), (face_x + side * 0.015, 2.62, back + 0.4), mats["light_red"], 0.02),
            box(f"{prefix}_side_lamp_mid{side}", (0.03, 0.12, 0.24), (face_x + side * 0.015, 1.0, middle_forward + 0.4), mats["light_red"], 0.02),
            box(f"{prefix}_scene_light{side}", (0.03, 0.12, 0.4), (face_x + side * 0.015, 2.72, middle_forward - 0.6), mats["light_white"], 0.02),
        ]
        # Compartment doors along the street side (+x) and behind the patient door on the kerb side.
        compartments = [(-2.6, 0.9), (-1.6, 0.9), (0.3, 0.75)] if side > 0 else [(-2.6, 0.9), (-1.65, 0.8)]
        for index, (forward, door_width) in enumerate(compartments):
            parts += panel_outline(f"{prefix}_comp{side}_{index}", face_x, forward, 1.95, door_width, 1.35, mats)
            parts.append(box(f"{prefix}_comp_handle{side}_{index}", (0.03, 0.05, 0.14), (face_x + side * 0.02, 1.95, forward + door_width / 2 - 0.12), mats["chrome"], 0.01))
        parts += cross_plate(f"{prefix}_emblem{side}", face_x, -1.0 if side > 0 else -0.6, 2.38, mats)
        parts += bolts_row(f"{prefix}_rivets{side}_", (face_x + side * 0.006, 0.86, back + 0.15), (0, 0, 0.42), 11, mats, radius=0.01, axis="x")
    parts += vent(f"{prefix}_vent_front", (0, 2.5, back + length + 0.012), (0.6, 0.3), mats)
    return parts


def lightbar(name, group, mats, forward, top, width):
    """Roof-front warning lamps, a separate object so the app can flash it."""
    parts = [box(f"{name}_base", (width, 0.06, 0.3), (0, top + 0.03, forward), mats["dark"], 0.02)]
    lamp_width = width / 5
    colours = ["light_red", "light_white", "light_red", "light_white", "light_red"]
    for index, colour in enumerate(colours):
        parts.append(box(f"{name}_lamp{index}", (lamp_width * 0.92, 0.13, 0.26), (-width / 2 + lamp_width * (index + 0.5), top + 0.12, forward), mats[colour], 0.03))
    return combine(name, parts, origin=(0, top, forward), parent=group)


def roof_units(prefix, mats, top, back, layout):
    parts = []
    if layout == "a":
        parts += [box(f"{prefix}_ac", (1.1, 0.24, 0.9), (0, top + 0.12, back + 1.3), mats["panel"], 0.06)]
        parts += vent(f"{prefix}_ac_vent", (0, top + 0.12, back + 1.76), (0.8, 0.16), mats, slats=4)
        parts += [cylinder(f"{prefix}_roof_vent", 0.16, 0.12, (0.6, top + 0.06, back + 3.0), mats["grey"], round_by=0.03)]
    else:
        parts += [box(f"{prefix}_ac", (0.9, 0.2, 0.7), (0.55, top + 0.1, back + 1.0), mats["panel"], 0.05),
                  box(f"{prefix}_rack", (1.6, 0.06, 1.4), (-0.1, top + 0.08, back + 2.6), mats["grey"], 0.02),
                  cylinder(f"{prefix}_antenna", 0.015, 0.6, (-0.8, top + 0.3, back + 3.8), mats["dark"])]
    for side in (1, -1):
        parts.append(box(f"{prefix}_rear_corner_lamp{side}", (0.2, 0.14, 0.12), (side * 1.05, top - 0.12, back - 0.04), mats["light_red"], 0.02))
        parts.append(box(f"{prefix}_rear_mid_lamp{side}", (0.22, 0.12, 0.1), (side * 0.3, top - 0.12, back - 0.04), mats["light_amber"], 0.02))
    return parts


def rear_doors(prefix, group, mats, band, back, width, floor, height):
    """Two rear doors, each hinged on its outer vertical edge (origin on the hinge, swing about up)."""
    door_width = width / 2 - 0.08
    for side, suffix in ((1, "l"), (-1, "r")):
        hinge_x = side * (width / 2 - 0.04)
        middle_x = hinge_x - side * door_width / 2
        bottom = floor + 0.12
        parts = [
            box(f"{prefix}_rd{suffix}_skin", (door_width, height, 0.06), (middle_x, bottom + height / 2, back - 0.05), mats["white"], 0.03),
            box(f"{prefix}_rd{suffix}_band", (door_width, 0.36, 0.065), (middle_x, 1.38, back - 0.05), band, 0.01),
            box(f"{prefix}_rd{suffix}_window", (door_width * 0.7, 0.5, 0.07), (middle_x, bottom + height - 0.42, back - 0.05), mats["glass"], 0.04),
            box(f"{prefix}_rd{suffix}_handle", (0.05, 0.16, 0.04), (hinge_x - side * (door_width - 0.1), 1.65, back - 0.1), mats["chrome"], 0.01),
            box(f"{prefix}_rd{suffix}_lamp", (0.16, 0.1, 0.03), (middle_x, bottom + height - 0.1, back - 0.09), mats["light_amber"], 0.01),
        ]
        for index, up in enumerate((bottom + 0.3, bottom + height - 0.3)):
            parts.append(cylinder(f"{prefix}_rd{suffix}_hinge{index}", 0.025, 0.14, (hinge_x, up, back - 0.07), mats["steel"]))
        combine(f"{prefix}_door_rear_{suffix}", parts, origin=(hinge_x, bottom, back - 0.05), parent=group)


def side_door(prefix, group, mats, band, face_x, front_edge, width, floor, height):
    """Kerb-side patient door with window, hinged at its front edge."""
    sign = 1 if face_x > 0 else -1
    middle = front_edge - width / 2
    bottom = floor + 0.08
    parts = [
        box(f"{prefix}_sd_skin", (0.05, height, width), (face_x + sign * 0.02, bottom + height / 2, middle), mats["white"], 0.03),
        box(f"{prefix}_sd_band", (0.055, 0.36, width), (face_x + sign * 0.02, 1.38, middle), band, 0.01),
        box(f"{prefix}_sd_window", (0.06, 0.52, width * 0.6), (face_x + sign * 0.02, bottom + height - 0.42, middle), mats["glass"], 0.04),
        box(f"{prefix}_sd_handle", (0.04, 0.05, 0.16), (face_x + sign * 0.05, 1.65, front_edge - width + 0.15), mats["chrome"], 0.01),
    ]
    combine(f"{prefix}_door_side", parts, origin=(face_x + sign * 0.02, bottom, front_edge), parent=group)


def chassis(prefix, mats, front_axle, rear_axle, width):
    parts = [
        box(f"{prefix}_frame", (0.9, 0.2, front_axle - rear_axle + 1.6), (0, 0.5, (front_axle + rear_axle) / 2), mats["black"], 0.03),
        box(f"{prefix}_fuel_tank", (0.5, 0.35, 0.9), (0.62, 0.55, rear_axle + 1.5), mats["grey"], 0.08),
        cylinder(f"{prefix}_exhaust", 0.045, 1.2, (-0.5, 0.36, rear_axle - 0.9), mats["steel"], axis="forward"),
    ]
    for side in (1, -1):
        parts.append(box(f"{prefix}_mudflap{side}", (0.4, 0.4, 0.02), (side * (width / 2 - 0.3), 0.42, rear_axle - 0.55), mats["black"], 0.01))
    return parts


def wheels(prefix, group, front_axle, rear_axle, front_track, rear_track, dual=True):
    for side, suffix in ((1, "l"), (-1, "r")):
        wheel(f"{prefix}_wheel_f{suffix}", WHEEL_RADIUS, 0.24, (side * front_track / 2, WHEEL_RADIUS, front_axle), group, bolts=8)
        if dual:
            inner = wheel(f"{prefix}_rear_inner{suffix}", WHEEL_RADIUS, 0.22, (side * (rear_track / 2 - 0.25), WHEEL_RADIUS, rear_axle), None, bolts=8)
            outer = wheel(f"{prefix}_rear_outer{suffix}", WHEEL_RADIUS, 0.22, (side * rear_track / 2, WHEEL_RADIUS, rear_axle), None, bolts=8)
            combine(f"{prefix}_wheel_r{suffix}", [inner, outer], origin=(side * (rear_track / 2 - 0.125), WHEEL_RADIUS, rear_axle), parent=group)
        else:
            wheel(f"{prefix}_wheel_r{suffix}", WHEEL_RADIUS * 0.9, 0.24, (side * rear_track / 2, WHEEL_RADIUS * 0.9, rear_axle), group, bolts=6)


def type3(name, mats, band_colour, stripe_colour, layout):
    group = root(name)
    band = material(f"{name}_band", band_colour, roughness=0.4)
    stripe = material(f"{name}_stripe", stripe_colour, roughness=0.3, metallic=0.2)
    front_axle, rear_axle = 2.7, -1.3
    body = cab(name, mats, mats["white"]) + module(name, mats, band, stripe) + chassis(name, mats, front_axle, rear_axle, 2.44)
    body += roof_units(name, mats, 2.88, -3.35, layout)
    combine(f"{name}_body", body, parent=group)
    lightbar(f"{name}_lightbar", group, mats, forward=1.12, top=2.88, width=2.2)
    lightbar(f"{name}_cab_lightbar", group, mats, forward=1.5, top=2.32, width=1.3)
    rear_doors(name, group, mats, band, back=-3.35, width=2.44, floor=0.78, height=1.78)
    side_door(name, group, mats, band, face_x=-1.22, front_edge=1.05, width=0.8, floor=0.78, height=1.85)
    wheels(name, group, front_axle, rear_axle, front_track=1.78, rear_track=2.02)
    return group


def type2_van(name, mats):
    """High-roof van ambulance (Type II): one-piece body, sliding side door, rear doors."""
    group = root(name)
    band = material(f"{name}_band", "#2f6fe4", roughness=0.4)
    width, back, top = 2.02, -3.0, 2.68
    outline = [(3.02, 0.38), (3.06, 0.9), (2.92, 1.12), (2.25, 1.3), (1.55, 2.15), (1.35, top), (back, top), (back, 0.38)]
    body = [
        slab(f"{name}_shell", outline, width, mats["white"], plane="side", round_by=0.1),
        slab(f"{name}_windscreen", [(2.2, 1.36), (2.26, 1.36), (1.6, 2.12), (1.54, 2.12)], width - 0.14, mats["glass"], plane="side", round_by=0.01),
        box(f"{name}_band", (width + 0.02, 0.32, 4.9), (0, 1.15, -0.5), band, 0.02),
        box(f"{name}_stripe", (width + 0.025, 0.07, 4.4), (0, 0.92, -0.6), mats["accent"], 0.01),
        box(f"{name}_roof_cap", (width - 0.1, 0.12, 4.0), (0, top + 0.02, -0.8), mats["panel"], 0.05),
        box(f"{name}_rear_bumper", (width - 0.05, 0.18, 0.24), (0, 0.5, back - 0.1), mats["dark"], 0.04),
    ]
    body += front_end(name, 3.06, width * 0.95, mats)
    for side in (1, -1):
        face = side * (width / 2 + 0.006)
        body += [
            box(f"{name}_cab_window{side}", (0.02, 0.5, 0.7), (face, 1.72, 1.2), mats["glass"], 0.03),
            box(f"{name}_mirror{side}", (0.06, 0.32, 0.18), (side * (width / 2 + 0.22), 1.68, 1.6), mats["dark"], 0.03),
            box(f"{name}_tail{side}", (0.14, 0.42, 0.04), (side * (width / 2 - 0.1), 1.0, back - 0.02), mats["tail"], 0.02),
            box(f"{name}_side_lamp{side}", (0.03, 0.12, 0.26), (face + side * 0.01, 2.45, back + 0.4), mats["light_red"], 0.02),
        ]
        body += panel_outline(f"{name}_cab_door{side}", side * width / 2, 1.15, 1.4, 0.9, 1.5, mats)
        body += cross_plate(f"{name}_emblem{side}", side * width / 2, -1.6, 1.85, mats, size=0.5)
    body += panel_outline(f"{name}_slide_track", -width / 2, -0.2, 2.42, 1.4, 0.02, mats)
    body += chassis(name, mats, 1.85, -1.8, width)
    combine(f"{name}_body", body, parent=group)
    lightbar(f"{name}_lightbar", group, mats, forward=1.0, top=top, width=1.8)
    rear_doors(name, group, mats, band, back=back, width=width, floor=0.42, height=1.95)
    side_door(name, group, mats, band, face_x=-width / 2, front_edge=0.5, width=1.25, floor=0.42, height=1.9)
    wheels(name, group, 1.85, -1.8, front_track=1.72, rear_track=1.72, dual=False)
    return group


def build():
    reset_scene()
    mats = palette()
    type3("amb_type3_a", mats, "#2f6fe4", "#ff7a2f", "a").location.x = -3.5
    type3("amb_type3_b", mats, "#1d3f8f", "#e5484d", "b")
    type2_van("amb_van", mats).location.x = 3.5
    export("vehicles.glb")


if __name__ == "__main__":
    build()
