"""Aircraft for the ATC world, exported to app/public/assets/aircraft.glb. All original designs.

jet_a     twinjet airliner, white body, coloured fin and nacelles
jet_b     stretched twinjet with blended winglets and a coloured belly
jet_c     regional jet with rear-mounted engines and a T-tail
jet_d     widebody twinjet with big nacelles and raked tips
prop_a    high-wing twin turboprop with a T-tail and gear sponsons
prop_b    short commuter turboprop with a low tail

Materials `livery` and `livery_accent` are recoloured per made-up airline in the app. Every moving
part is a separate node named after its variant (Blender does not allow two objects with one name):
<v>_fan_left/right or <v>_prop_left/right (spin about z), <v>_gear_nose and <v>_gear_main_left/right
(retract about x, pivot at the top of the leg, wheels are children), <v>_nav_*, <v>_beacon_*,
<v>_strobe and <v>_landing_light (glow). Empties: <v>_trail_left/right at the exhausts or wingtips
for the history line, <v>_label above the cabin for the data tag, <v>_fin for the fin mark.
"""
import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (anchor, attach, box, combine, cut_loft, cylinder, export, loft, material, mirror_x, point,
                 reset_scene, root, slab, sphere, turn, wheel)

DIHEDRAL = math.radians(5)


def materials():
    return {
        "body": material("body", "#fbfcfe", roughness=0.38, metallic=0.05),
        "belly": material("belly", "#e3e8f0", roughness=0.45, metallic=0.05),
        "livery": material("livery", "#2f6bff", roughness=0.36, metallic=0.05),
        "accent": material("livery_accent", "#ffb547", roughness=0.36, metallic=0.05),
        "wing": material("wing", "#e7ebf2", roughness=0.45, metallic=0.1),
        "walkway": material("wing_walkway", "#cdd4de", roughness=0.6),
        "metal": material("metal", "#c9d0db", roughness=0.28, metallic=0.75),
        "fan": material("fan", "#4b5468", roughness=0.35, metallic=0.7),
        "glass": material("glass", "#1d2633", roughness=0.1, metallic=0.4),
        "seam": material("seam", "#cfd6e1", roughness=0.5),
        "gear": material("gear", "#9aa3b2", roughness=0.4, metallic=0.6),
        "red": material("glow_red", "#ff3b3b", emission="#ff3b3b", strength=4),
        "green": material("glow_green", "#3dff8a", emission="#3dff8a", strength=4),
        "white": material("glow_white", "#ffffff", emission="#ffffff", strength=4),
    }


def fuselage_sections(nose, tail, center, radius_x, radius_up, seam_step=1.7):
    """Rings for the fuselage: a rounded nose, a barrel with shallow panel seams, and a tail
    cone sweeping up towards the fin. The nose profile scales with the fuselage radius."""
    scale = radius_x / 1.25
    barrel_front = nose - 2.4 * scale
    barrel_back = tail + 5.0 * scale
    nose_rings = [
        (nose, 0, 0, center - 0.22 * scale),
        (nose - 0.08 * scale, 0.32 * scale, 0.3 * scale, center - 0.21 * scale),
        (nose - 0.32 * scale, 0.66 * scale, 0.64 * scale, center - 0.16 * scale),
        (nose - 0.8 * scale, 0.96 * scale, 0.96 * scale, center - 0.09 * scale),
        (nose - 1.5 * scale, 1.16 * scale, 1.2 * scale, center - 0.03 * scale),
        (barrel_front, radius_x, radius_up, center),
    ]
    barrel = []
    seam = barrel_front - seam_step
    while seam > barrel_back + 0.5:
        for offset, depth in ((0.03, 0.0), (0.0, 0.007), (-0.03, 0.0)):
            barrel.append((seam + offset, radius_x - depth, radius_up - depth, center))
        seam -= seam_step
    span = barrel_back - tail
    tail_rings = [
        (barrel_back, radius_x, radius_up, center),
        (barrel_back - span * 0.3, radius_x * 0.9, radius_up * 0.9, center + 0.14 * scale),
        (barrel_back - span * 0.6, radius_x * 0.64, radius_up * 0.62, center + 0.42 * scale),
        (barrel_back - span * 0.85, radius_x * 0.32, radius_up * 0.3, center + 0.72 * scale),
        (tail + 0.12, 0.13 * scale, 0.12 * scale, center + 0.85 * scale),
        (tail, 0, 0, center + 0.86 * scale),
    ]
    return nose_rings + barrel + tail_rings


def surface_x(radius_x, radius_up, height):
    """Half width of the fuselage ellipse at `height` above its centre, and the surface tilt there."""
    sine = height / radius_up
    return radius_x * math.sqrt(max(0.0, 1 - sine * sine)), math.asin(sine)


def windshield(name, nose, center, scale, mats):
    """A wrap-around cockpit glass band cut from the nose rings, laid just outside them."""
    lift = 1.015
    sections = [
        (nose - 0.32 * scale, 0.66 * scale * lift, 0.64 * scale * lift, center - 0.16 * scale),
        (nose - 0.8 * scale, 0.96 * scale * lift, 0.96 * scale * lift, center - 0.09 * scale),
        (nose - 1.5 * scale, 1.16 * scale * lift, 1.2 * scale * lift, center - 0.03 * scale),
    ]

    def keep(center_x, center_up, center_forward):
        return (center + 0.3 * scale < center_up < center + 0.62 * scale
                and abs(center_x) < 0.95 * scale and center_forward < nose - 0.8 * scale)

    return cut_loft(name, sections, mats["glass"], keep, sides=40)


def cabin_windows(prefix, start, end, center, radius_x, radius_up, mats, skip=(), pitch=0.42):
    windows = []
    height = 0.38 * radius_up / 1.3
    half_width, tilt = surface_x(radius_x, radius_up, height)
    forward = start
    index = 0
    while forward > end:
        if not any(low <= forward <= high for low, high in skip):
            window = box(f"{prefix}{index}", (0.05, 0.27, 0.19), (half_width + 0.005, center + height, forward), mats["glass"], round_by=0.07, segments=2)
            turn(window, "forward", tilt)
            windows.append(window)
        forward -= pitch
        index += 1
    return windows


def door_outline(name, forward, center, radius_x, radius_up, mats):
    """Door frame, panel and porthole as skin patches on the +x side (static in this world)."""

    def patch(label, half_length, low, high, lift, mat):
        sections = [(forward + half_length * (1 - 2 * step / 3), radius_x * lift, radius_up * lift, center) for step in range(4)]
        return cut_loft(f"{name}_{label}", sections, mat, lambda x, up, along: x > 0 and low < up < high, sides=96)

    frame = patch("frame", 0.36, center - 0.5, center + 0.72, 1.004, mats["seam"])
    panel = patch("panel", 0.31, center - 0.44, center + 0.66, 1.008, mats["body"])
    half_width, tilt = surface_x(radius_x * 1.008, radius_up * 1.008, 0.4)
    port = box(f"{name}_port", (0.05, 0.22, 0.16), (half_width, center + 0.4, forward), mats["glass"], round_by=0.06, segments=2)
    turn(port, "forward", tilt)
    return [frame, panel, port]


def fuselage(name, nose, tail, center, radius_x, radius_up, mats, belly_livery, wing_forward):
    """Fuselage skin with a belly colour and an accent cheatline, windshield, windows and doors."""
    slots = [mats["body"], mats["livery"] if belly_livery else mats["belly"], mats["accent"]]
    belly_line = center - (0.5 if belly_livery else 0.85) * radius_up / 1.3

    def paint_zone(center_x, center_up, center_forward):
        if center_up < belly_line:
            return 1
        # A thin accent band under the windows, fading out over the nose and tail cone.
        if center - 0.08 * radius_up < center_up < center + 0.06 * radius_up and tail + 3 < center_forward < nose - 2.6:
            return 2
        return 0

    scale = radius_x / 1.25
    parts = [loft(f"{name}_fuselage", fuselage_sections(nose, tail, center, radius_x, radius_up), slots, sides=40, material_for_face=paint_zone)]
    parts.append(windshield(f"{name}_windshield", nose, center, scale, mats))
    door_positions = [nose - 2.1 * scale, tail + 5.4 * scale]
    skip = [(position - 0.45, position + 0.45) for position in door_positions] + [(wing_forward - 0.3, wing_forward + 0.4)]
    one_side = cabin_windows(f"{name}_window", nose - 2.75 * scale, tail + 5.6 * scale, center, radius_x, radius_up, mats, skip)
    for index, position in enumerate(door_positions):
        one_side += door_outline(f"{name}_door{index}", position, center, radius_x, radius_up, mats)
    return parts + one_side + mirror_x(one_side)


def turbofan(prefix, center, scale, mats):
    """Turbofan nacelle with a recessed inlet; the fan is returned separately to spin."""
    x, up, forward = center
    length = 2.7 * scale
    lip = 0.55 * scale

    def ring(offset, radius):
        return (forward + offset, radius, radius, up)

    nacelle = loft(f"{prefix}_nacelle", [
        ring(-0.28 * scale, lip * 0.86), ring(0.0, lip * 0.95), ring(-0.06 * scale, lip * 1.08),
        ring(-0.5 * scale, lip * 1.13), ring(-length * 0.55, lip * 1.08), ring(-length * 0.85, lip * 0.82),
        ring(-length, lip * 0.62),
    ], [mats["livery"]], sides=28, x=x)
    lip_ring = loft(f"{prefix}_lip", [
        ring(-0.02 * scale, lip * 0.93), ring(0.01 * scale, lip * 0.97),
        ring(-0.07 * scale, lip * 1.085), ring(-0.12 * scale, lip * 1.095),
    ], [mats["metal"]], sides=28, x=x)
    exhaust = loft(f"{prefix}_exhaust", [
        ring(-length + 0.02, lip * 0.6), ring(-length - 0.35 * scale, lip * 0.42),
        ring(-length - 0.6 * scale, lip * 0.12), ring(-length - 0.64 * scale, 0),
    ], [mats["metal"]], sides=20, x=x)
    fan_center = (x, up, forward - 0.24 * scale)
    blades = [loft(f"{prefix}_spinner", [
        (fan_center[2] + 0.22 * scale, 0, 0, up), (fan_center[2] + 0.14 * scale, 0.09 * scale, 0.09 * scale, up),
        (fan_center[2], 0.17 * scale, 0.17 * scale, up), (fan_center[2] - 0.06 * scale, 0.17 * scale, 0.17 * scale, up),
    ], [mats["metal"]], sides=16, x=x)]
    blade_count = 18
    for index in range(blade_count):
        blade = box(f"{prefix}_blade{index}", (0.1 * scale, lip * 0.62, 0.03), (0, 0, 0), mats["fan"], round_by=0.012, segments=1)
        blade.matrix_world = (
            Matrix.Translation(point(*fan_center))
            @ Matrix.Rotation(2 * math.pi * index / blade_count, 4, Vector((0, -1, 0)))
            @ Matrix.Translation(point(0, lip * 0.5, 0))
            @ Matrix.Rotation(0.55, 4, Vector((0, 0, 1)))
        )
        blades.append(blade)
    blades.append(cylinder(f"{prefix}_fanback", lip * 0.84, 0.04, (x, up, fan_center[2] - 0.08), mats["fan"], axis="forward", sides=24))
    exhaust_tip = (x, up, forward - length - 0.64 * scale)
    return [nacelle, lip_ring, exhaust], blades, fan_center, exhaust_tip


def propeller(prefix, hub, blade_length, mats, blade_count=6):
    """Spinner plus scimitar-ish blades around a hub on the forward axis."""
    x, up, forward = hub
    parts = [loft(f"{prefix}_spinner", [
        (forward + 0.55, 0, 0, up), (forward + 0.42, 0.16, 0.16, up), (forward + 0.15, 0.27, 0.27, up), (forward - 0.1, 0.28, 0.28, up),
    ], [mats["livery"]], sides=18, x=x)]
    for index in range(blade_count):
        blade = box(f"{prefix}_blade{index}", (0.2, blade_length, 0.05), (0, 0, 0), mats["fan"], round_by=0.025, segments=2)
        blade.matrix_world = (
            Matrix.Translation(point(*hub))
            @ Matrix.Rotation(2 * math.pi * index / blade_count, 4, Vector((0, -1, 0)))
            @ Matrix.Translation(point(0, blade_length * 0.5 + 0.12, 0))
            @ Matrix.Rotation(0.5, 4, Vector((0, 0, 1)))
        )
        tip = box(f"{prefix}_tip{index}", (0.21, 0.12, 0.055), (0, 0, 0), mats["accent"], round_by=0.025, segments=2)
        tip.matrix_world = blade.matrix_world @ Matrix.Translation(point(0, blade_length * 0.5 - 0.06, 0))
        parts += [blade, tip]
    return parts


def landing_gear(name, wheel_center, radius, width, strut_top, mats, parent, twin_gap):
    """A gear leg node pivoting at the top of its strut, wheels as its children."""
    x, up, forward = wheel_center
    leg = attach(root(name, (x, strut_top, forward)), parent)
    struts = [
        cylinder(f"{name}_strut_main", 0.09, strut_top - up, (x, (up + strut_top) / 2, forward), mats["gear"], sides=10),
        cylinder(f"{name}_axle", 0.06, twin_gap + width, (x, up, forward), mats["gear"], axis="x", sides=8),
        cylinder(f"{name}_oleo", 0.12, min(0.4, (strut_top - up) * 0.4), (x, up + radius + 0.2, forward), mats["metal"], sides=12),
        box(f"{name}_brace", (0.06, (strut_top - up) * 0.7, 0.06), (x, (up + strut_top) / 2 + 0.1, forward - 0.25), mats["gear"], round_by=0.02),
    ]
    turn(struts[-1], "x", 0.5)
    combine(f"{name}_strut", struts, origin=(x, strut_top, forward), parent=leg)
    for side, label in ((-1, "r"), (1, "l")):
        wheel(f"{name}_wheel_{label}", radius, width, (x + side * twin_gap / 2, up, forward), leg)
    return leg


def lights(name, group, left_tip, top, bottom, tail_point, landing, mats):
    """Navigation lights (red on the left wing, which is +x for a model facing +z), beacons,
    tail strobe and a landing light, each its own node so the app can blink them."""
    def lamp(label, position, mat, radius, scale=(1, 1, 1)):
        bulb = sphere(f"{name}_{label}_bulb", radius, position, mat, scale=scale, segments=10)
        combine(f"{name}_{label}", [bulb], origin=position, parent=group)

    lamp("nav_left", left_tip, mats["red"], 0.13)
    lamp("nav_right", (-left_tip[0], left_tip[1], left_tip[2]), mats["green"], 0.13)
    lamp("beacon_top", top, mats["red"], 0.15, scale=(1, 0.6, 1))
    lamp("beacon_bottom", bottom, mats["red"], 0.15, scale=(1, 0.6, 1))
    lamp("strobe", tail_point, mats["white"], 0.1)
    lamp("landing_light", landing, mats["white"], 0.12, scale=(1, 0.7, 1))


def build_jet(name, nose, tail, center=1.85, radius_x=1.25, radius_up=1.3, rear_engines=False, winglets=False,
              belly_livery=False, engine_scale=1.0, span=6.9, wing_forward=0.5, raked=False):
    mats = materials()
    group = root(name)
    static = fuselage(name, nose, tail, center, radius_x, radius_up, mats, belly_livery, wing_forward)
    size = radius_x / 1.25

    # Low swept wing with dihedral, flap-track fairings and a walkway panel near the root.
    wing_up = center - radius_up * 0.62
    sweep = 3.8 * span / 6.9
    tip_chord = 0.9 if not raked else 0.6
    wing_outline = [(0.0, 2.2 * size), (span, 2.2 * size - sweep), (span, 2.2 * size - sweep - tip_chord), (0.0, -2.0 * size)]
    wing = slab(f"{name}_wing", wing_outline, 0.3 * size, mats["wing"], center=(0.0, wing_up, wing_forward), round_by=0.11, taper_span=span, taper=0.6)
    turn(wing, "forward", DIHEDRAL)
    walkway = slab(f"{name}_walkway", [(radius_x * 0.8, 0.6 * size), (radius_x + 1.4, 0.0), (radius_x + 1.4, -1.0), (radius_x * 0.8, -1.2 * size)], 0.02, mats["walkway"], center=(0.0, wing_up + 0.15 * size + 0.03, wing_forward), round_by=0.0)
    turn(walkway, "forward", DIHEDRAL)
    wing_parts = [wing, walkway]
    for track, along in enumerate((0.3, 0.5, 0.7)):
        tip_x = span * along
        trailing = wing_forward - 2.0 * size - 0.5 * along
        lift = math.tan(DIHEDRAL) * tip_x
        wing_parts.append(sphere(f"{name}_track{track}", 0.5, (tip_x, wing_up + lift - 0.12, trailing - 0.15), mats["wing"], scale=(0.16, 0.2, 1.2), segments=12))
    tip_lift = math.tan(DIHEDRAL) * span
    tip_forward = wing_forward + 2.2 * size - sweep - tip_chord / 2
    if winglets:
        winglet = slab(f"{name}_winglet", [(0.4, 0.0), (-0.75, 1.15), (-1.05, 1.15), (-0.75, 0.0)], 0.12, mats["livery"], plane="side", center=(span - 0.03, wing_up + tip_lift + 0.05, tip_forward + 0.3), round_by=0.05)
        turn(winglet, "forward", math.radians(-12))
        wing_parts.append(winglet)
    static += wing_parts + mirror_x(wing_parts)
    static.append(sphere(f"{name}_fairing", 1.0, (0, wing_up, wing_forward + 0.1), mats["belly"], scale=(radius_x * 0.88, 0.5 * size, 3.15 * size), segments=24))

    # Tail: fin and stabiliser, or a T-tail with the stabiliser on top of the fin.
    fin_height = (3.3 if rear_engines else 3.6) * size
    fin_root = tail + 3.6 * size
    fin_base = center + 0.6 * size
    static.append(slab(f"{name}_fin", [(fin_root, fin_base), (tail + 1.15 * size, fin_base + fin_height), (tail + 0.2 * size, fin_base + fin_height), (tail + 0.15, fin_base + 0.15)], 0.28 * size, mats["livery"], plane="side", round_by=0.1))
    static.append(slab(f"{name}_dorsal", [(fin_root + 1.2 * size, center + radius_up * 0.9), (fin_root - 0.4, fin_base + 0.8 * size), (fin_root - 0.4, fin_base + 0.3 * size)], 0.2 * size, mats["livery"], plane="side", round_by=0.08))
    static.append(box(f"{name}_fin_cap", (0.3 * size, 0.12, 1.0 * size), (0, fin_base + fin_height + 0.02, tail + 0.65 * size), mats["accent"], round_by=0.05))
    stab_span = 3.3 * size
    if rear_engines:
        stabilizer_up = fin_base + fin_height - 0.05
        stabilizer_outline = [(0.1, tail + 1.2), (2.9 * size, tail - 0.3), (2.9 * size, tail - 0.9), (0.1, tail + 0.1)]
    else:
        stabilizer_up = center + 0.65 * size
        stabilizer_outline = [(0.2, tail + 2.6 * size), (stab_span, tail + 0.85 * size), (stab_span, tail + 0.25 * size), (0.2, tail + 0.45 * size)]
    stabilizer = slab(f"{name}_stabilizer", stabilizer_outline, 0.17 * size, mats["livery"] if rear_engines else mats["wing"], center=(0, stabilizer_up, 0), round_by=0.07, taper_span=stab_span, taper=0.5)
    turn(stabilizer, "forward", math.radians(0 if rear_engines else 4))
    static += [stabilizer] + mirror_x([stabilizer])
    static.append(cylinder(f"{name}_apu", 0.11, 0.25, (0, center + 0.86 * size, tail - 0.08), mats["metal"], axis="forward", sides=12))

    # Engines on underwing pylons, or on the rear fuselage.
    if rear_engines:
        engine_center = (radius_x + 0.75, center + 0.55, tail + 4.2)
        pylon = slab(f"{name}_pylon", [(-0.2, tail + 4.2), (radius_x + 0.5, tail + 3.6), (radius_x + 0.5, tail + 2.6), (-0.2, tail + 2.4)], 0.22, mats["wing"], center=(0, center + 0.55, 0), round_by=0.08)
        nacelle_scale = 0.8
    else:
        engine_x = span * 0.39
        engine_center = (engine_x, wing_up + math.tan(DIHEDRAL) * engine_x - 0.48 * engine_scale - 0.1, wing_forward + 2.2 * size - sweep * 0.39 + 1.6 * engine_scale)
        pylon_top = engine_center[1] + 0.55 * engine_scale
        pylon = slab(f"{name}_pylon", [(engine_center[2] - 0.5, pylon_top), (engine_center[2] - 2.6 * engine_scale, pylon_top + 0.4), (engine_center[2] - 2.0 * engine_scale, pylon_top - 0.15)], 0.2, mats["wing"], plane="side", center=(engine_x, 0, 0), round_by=0.07)
        nacelle_scale = engine_scale
    nacelle_parts, fan_parts, fan_center, exhaust_tip = turbofan(f"{name}_engine", engine_center, nacelle_scale, mats)
    static += nacelle_parts + [pylon] + mirror_x(nacelle_parts + [pylon])
    mirrored_fan = mirror_x(fan_parts)
    combine(f"{name}_fan_left", fan_parts, origin=fan_center, parent=group)
    combine(f"{name}_fan_right", mirrored_fan, origin=(-fan_center[0], fan_center[1], fan_center[2]), parent=group)
    anchor(f"{name}_trail_left", exhaust_tip, group)
    anchor(f"{name}_trail_right", (-exhaust_tip[0], exhaust_tip[1], exhaust_tip[2]), group)

    # Gear: twin main wheels under the wing root, twin nose wheels.
    main_radius = 0.36 * size
    gear_wheels = 4 if radius_x > 1.4 else 2
    for side, label in ((1, "left"), (-1, "right")):
        landing_gear(f"{name}_gear_main_{label}", (side * radius_x * 1.05, main_radius, wing_forward - 0.9), main_radius, 0.24 * size, wing_up, mats, group, 0.52 * size * gear_wheels / 2)
    landing_gear(f"{name}_gear_nose", (0, 0.26, nose - 2.3 * size), 0.26, 0.18, center - radius_up * 0.8, mats, group, 0.36)

    lights(name, group,
           left_tip=(span + 0.05, wing_up + tip_lift, tip_forward),
           top=(0, center + radius_up + 0.06, wing_forward - 0.4),
           bottom=(0, wing_up - 0.52 * size, wing_forward - 0.4),
           tail_point=(0, center + 0.86 * size, tail - 0.25),
           landing=(radius_x * 0.95, wing_up + 0.05, wing_forward + 2.3 * size),
           mats=mats)

    combine(f"{name}_body", static, parent=group)
    anchor(f"{name}_label", (0, center + radius_up + 1.5, (nose + tail) / 2), group)
    anchor(f"{name}_fin", (0.16 * size, fin_base + fin_height * 0.55, tail + 1.2 * size), group)
    return group


def build_turboprop(name, nose, tail, center=1.55, radius_x=0.95, radius_up=1.0, span=7.6, wing_forward=0.6, t_tail=True):
    mats = materials()
    group = root(name)
    static = fuselage(name, nose, tail, center, radius_x, radius_up, mats, belly_livery=False, wing_forward=wing_forward)

    # High straight-tapered wing on a fairing across the cabin roof.
    wing_up = center + radius_up * 0.92
    chord = 2.3
    wing_outline = [(0.0, chord * 0.5), (span, chord * 0.32), (span, -chord * 0.18), (0.0, -chord * 0.5)]
    wing = slab(f"{name}_wing", wing_outline, 0.26, mats["wing"], center=(0, wing_up, wing_forward), round_by=0.1, taper_span=span, taper=0.45)
    turn(wing, "forward", math.radians(1.5))
    wing_parts = [wing]
    static.append(sphere(f"{name}_wing_fairing", 1.0, (0, wing_up - 0.05, wing_forward), mats["body"], scale=(radius_x * 0.75, 0.32, chord * 0.62), segments=20))

    # Nacelles slung under the wing with the propeller in front and an exhaust stub at the side.
    engine_x = 2.3
    hub = (engine_x, wing_up - 0.3, wing_forward + chord * 0.5 + 1.15)
    nacelle = loft(f"{name}_nacelle", [
        (hub[2] - 0.05, 0.3, 0.3, hub[1]), (hub[2] - 0.4, 0.42, 0.46, hub[1] - 0.04), (hub[2] - 1.6, 0.46, 0.52, hub[1] - 0.02),
        (hub[2] - 3.2, 0.36, 0.38, hub[1] + 0.05), (hub[2] - 3.9, 0.12, 0.12, hub[1] + 0.1), (hub[2] - 4.0, 0, 0, hub[1] + 0.1),
    ], [mats["livery"]], sides=24, x=engine_x)
    intake = sphere(f"{name}_intake", 1.0, (engine_x, hub[1] - 0.45, hub[2] - 0.55), mats["fan"], scale=(0.2, 0.1, 0.18), segments=12)
    exhaust = cylinder(f"{name}_exhaust", 0.11, 0.35, (engine_x + 0.42, hub[1] + 0.05, hub[2] - 1.9), mats["metal"], axis="x", sides=12)
    wing_parts += [nacelle, intake, exhaust]
    static += wing_parts + mirror_x(wing_parts)
    prop_parts = propeller(f"{name}_prop", hub, 1.15, mats)
    mirrored_prop = mirror_x(prop_parts)
    combine(f"{name}_prop_left", prop_parts, origin=hub, parent=group)
    combine(f"{name}_prop_right", mirrored_prop, origin=(-hub[0], hub[1], hub[2]), parent=group)
    tip_lift = math.tan(math.radians(1.5)) * span
    anchor(f"{name}_trail_left", (span, wing_up + tip_lift, wing_forward - chord * 0.18), group)
    anchor(f"{name}_trail_right", (-span, wing_up + tip_lift, wing_forward - chord * 0.18), group)

    # Main gear folds into sponsons on the lower fuselage.
    sponson = sphere(f"{name}_sponson", 1.0, (radius_x * 0.85, center - radius_up * 0.7, wing_forward - 0.3), mats["belly"], scale=(0.42, 0.42, 1.5), segments=18)
    static += [sponson] + mirror_x([sponson])
    for side, label in ((1, "left"), (-1, "right")):
        landing_gear(f"{name}_gear_main_{label}", (side * (radius_x + 0.2), 0.32, wing_forward - 0.3), 0.32, 0.2, center - radius_up * 0.7, mats, group, 0.36)
    landing_gear(f"{name}_gear_nose", (0, 0.22, nose - 1.7), 0.22, 0.14, center - radius_up * 0.75, mats, group, 0.3)

    # Tail.
    fin_root = tail + 3.4
    fin_base = center + 0.45
    fin_height = 2.9
    static.append(slab(f"{name}_fin", [(fin_root, fin_base), (tail + 1.6, fin_base + fin_height), (tail + 0.5, fin_base + fin_height), (tail + 0.15, fin_base + 0.1)], 0.24, mats["livery"], plane="side", round_by=0.09))
    static.append(slab(f"{name}_dorsal", [(fin_root + 1.6, center + radius_up * 0.85), (fin_root - 0.4, fin_base + 0.7), (fin_root - 0.4, fin_base + 0.2)], 0.18, mats["livery"], plane="side", round_by=0.07))
    stab_up = fin_base + fin_height - 0.06 if t_tail else center + 0.55
    stab_forward = tail + 1.0 if t_tail else tail + 1.6
    stabilizer = slab(f"{name}_stabilizer", [(0.1, stab_forward + 0.7), (2.6, stab_forward + 0.15), (2.6, stab_forward - 0.45), (0.1, stab_forward - 0.6)], 0.15, mats["accent"] if t_tail else mats["wing"], center=(0, stab_up, 0), round_by=0.06, taper_span=2.6, taper=0.4)
    static += [stabilizer] + mirror_x([stabilizer])
    static.append(box(f"{name}_ventral", (0.16, 0.5, 1.2), (0, center - radius_up * 0.55, tail + 1.6), mats["belly"], round_by=0.06))

    lights(name, group,
           left_tip=(span + 0.05, wing_up + tip_lift, wing_forward),
           top=(0, wing_up + 0.3, wing_forward - 0.6),
           bottom=(0, center - radius_up - 0.02, wing_forward - 1.2),
           tail_point=(0, center + 0.8, tail - 0.2),
           landing=(1.1, wing_up - 0.1, wing_forward + chord * 0.5),
           mats=mats)

    combine(f"{name}_body", static, parent=group)
    anchor(f"{name}_label", (0, wing_up + 1.6, (nose + tail) / 2), group)
    anchor(f"{name}_fin", (0.14, fin_base + fin_height * 0.5, tail + 1.4), group)
    return group


def main():
    reset_scene()
    build_jet("jet_a", nose=8.0, tail=-8.0)
    build_jet("jet_b", nose=9.0, tail=-9.2, winglets=True, belly_livery=True, engine_scale=1.08, span=7.4)
    build_jet("jet_c", nose=7.0, tail=-7.2, center=1.7, radius_x=1.12, radius_up=1.16, rear_engines=True, span=6.2, wing_forward=-0.3)
    build_jet("jet_d", nose=12.0, tail=-12.0, center=2.4, radius_x=1.7, radius_up=1.76, engine_scale=1.45, span=10.2, wing_forward=0.8, raked=True)
    build_turboprop("prop_a", nose=6.6, tail=-6.8)
    build_turboprop("prop_b", nose=5.2, tail=-5.0, radius_x=0.85, radius_up=0.9, center=1.4, span=6.2, wing_forward=0.4, t_tail=False)
    export("aircraft.glb")


main()
