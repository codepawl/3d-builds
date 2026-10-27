"""Medical helicopters: helicopter.glb (refs/helicopter.md).

Light twin-engine type with a pod-and-boom fuselage (10.2 m), 10.2 m four-blade main rotor, ducted tail fan,
skids and rear clamshell doors. Roots sit on y = 0 (skids), face +forward, origin on the ground under the mast:
- heli_a: white with brand blue belly and orange cheat line.
- heli_b: white with navy belly and a red cheat line.
Moving parts (origins at their pivots): <root>_rotor_main (spins about up at the hub), <root>_rotor_tail (spins
about x at the fan centre), <root>_door_clam_l/r (hinge on the outer vertical edge). Beacons and nav lights glow.
"""
import math

from lib import box, combine, cut_loft, cylinder, export, loft, material, reset_scene, root, slab, sphere, turn
from parts import palette

MAST_FORWARD = 0.2
HUB_UP = 3.3
NOSE = 3.65
TAIL = -6.55

# Fuselage rings: (forward position, half width, half height, centre height).
SECTIONS = [
    (NOSE, 0.0, 0.0, 1.12),
    (NOSE - 0.12, 0.38, 0.4, 1.14),
    (3.2, 0.62, 0.68, 1.26),
    (2.6, 0.74, 0.82, 1.4),
    (1.6, 0.78, 0.88, 1.46),
    (0.2, 0.78, 0.88, 1.48),
    (-1.0, 0.72, 0.8, 1.5),
    (-1.6, 0.5, 0.56, 1.68),
    (-2.2, 0.26, 0.3, 1.9),
    (-4.6, 0.18, 0.22, 1.96),
    (TAIL + 0.7, 0.16, 0.2, 2.0),
    (TAIL + 0.6, 0.0, 0.0, 2.0),
]


def scaled(sections, factor):
    return [(position, half_width * factor, half_height * factor, centre) for position, half_width, half_height, centre in sections]


def fuselage(name, mats, white, belly, stripe):
    def paint_zone(center_x, center_up, center_forward):
        if center_up < 1.3 and center_forward > -1.7:
            return 1
        if 1.3 <= center_up < 1.42 and center_forward > -4.0:
            return 2
        return 0

    parts = [loft(f"{name}_skin", SECTIONS, [white, belly, stripe], sides=32, material_for_face=paint_zone)]
    glass_rings = scaled(SECTIONS[:6], 1.012)
    parts.append(cut_loft(f"{name}_windscreen", glass_rings, mats["glass"],
                          keep=lambda x, up, forward: forward > 2.15 and up > 1.05 or (forward > 2.9 and up > 0.8 and abs(x) < 0.45)))
    parts.append(cut_loft(f"{name}_cabin_windows", glass_rings, mats["glass"],
                          keep=lambda x, up, forward: 0.1 < forward < 2.0 and 1.4 < up < 2.15 and abs(x) > 0.4))
    parts += [
        box(f"{name}_engine_deck", (1.1, 0.5, 2.8), (0, 2.42, -0.3), white, 0.18),
        box(f"{name}_cowl_line", (1.12, 0.02, 2.6), (0, 2.3, -0.3), mats["dark"], 0.0),
        cylinder(f"{name}_mast", 0.12, 0.7, (0, HUB_UP - 0.4, MAST_FORWARD), mats["grey"], sides=14),
        box(f"{name}_mast_fairing", (0.6, 0.3, 0.9), (0, 2.75, MAST_FORWARD), white, 0.12),
        box(f"{name}_sliding_door_line", (1.58, 0.75, 0.02), (0, 1.55, 0.2), mats["dark"], 0.0),
        box(f"{name}_step_l", (0.08, 0.04, 0.5), (0.8, 0.62, 1.2), mats["steel"], 0.01),
        box(f"{name}_step_r", (0.08, 0.04, 0.5), (-0.8, 0.62, 1.2), mats["steel"], 0.01),
        sphere(f"{name}_searchlight", 0.14, (0.0, 0.6, 2.4), mats["light_white"], segments=12),
        box(f"{name}_beacon_belly", (0.1, 0.06, 0.18), (0, 0.6, -0.4), mats["light_red"], 0.02),
    ]
    for side in (1, -1):
        parts += [
            cylinder(f"{name}_exhaust{side}", 0.11, 0.35, (side * 0.38, 2.45, -1.75), mats["dark"], axis="forward", sides=14),
            box(f"{name}_intake{side}", (0.04, 0.22, 0.6), (side * 0.56, 2.48, 0.6), mats["dark"], 0.03),
            box(f"{name}_door_line_pilot{side}", (0.012, 0.9, 0.02), (side * 0.78, 1.55, 2.2), mats["dark"], 0.0),
        ]
        parts.append(box(f"{name}_cowl_vent{side}", (0.02, 0.22, 0.5), (side * 0.555, 2.42, -0.9), mats["dark"], 0.006))
        for index in range(4):
            parts.append(box(f"{name}_cowl_slat{side}_{index}", (0.02, 0.012, 0.46), (side * 0.565, 2.34 + index * 0.055, -0.9), mats["grey"], 0.003))
    return parts


def tail(name, mats, white, belly):
    fan_forward = TAIL + 0.55
    fin = [(TAIL + 1.4, 1.75), (TAIL + 0.1, 1.55), (TAIL - 0.05, 2.45), (TAIL + 0.35, 3.15), (TAIL + 0.75, 3.15), (TAIL + 1.0, 2.3)]
    parts = [
        slab(f"{name}_fin", fin, 0.24, white, plane="side", round_by=0.05),
        cylinder(f"{name}_duct_ring", 0.52, 0.3, (0, 2.05, fan_forward), belly, axis="x", sides=28, round_by=0.05),
        cylinder(f"{name}_duct_hole", 0.42, 0.32, (0, 2.05, fan_forward), mats["dark"], axis="x", sides=28),
        box(f"{name}_stabiliser", (2.6, 0.08, 0.5), (0, 1.97, -4.4), white, 0.03),
        sphere(f"{name}_beacon_fin", 0.07, (0, 3.18, TAIL + 0.55), mats["light_red"], segments=10),
        box(f"{name}_tail_skid", (0.06, 0.3, 0.5), (0, 1.55, TAIL + 0.9), mats["grey"], 0.02),
    ]
    for side, lamp in ((1, "light_green"), (-1, "light_red")):
        parts += [
            slab(f"{name}_endplate{side}", [(-4.2, 1.75), (-4.7, 1.8), (-4.75, 2.35), (-4.35, 2.3)], 0.05, belly,
                 plane="side", center=(side * 1.3, 0, 0), round_by=0.01),
            sphere(f"{name}_nav{side}", 0.05, (side * 1.34, 1.97, -4.2), mats[lamp], segments=10),
        ]
    return parts


def skids(name, mats):
    parts = []
    for side in (1, -1):
        parts += [
            cylinder(f"{name}_skid{side}", 0.05, 3.2, (side * 1.0, 0.06, 0.6), mats["grey"], axis="forward", sides=12, round_by=0.02),
            cylinder(f"{name}_skid_toe{side}", 0.05, 0.5, (side * 1.0, 0.2, 2.35), mats["grey"], axis="forward", sides=12),
        ]
        turn(parts[-1], "x", math.radians(-35))
        for leg_forward in (1.5, -0.6):
            # Leg from the cross tube end (x 0.7, up 0.6) down to the skid (x 1.0, up 0.08): 0.6 m long, leaning out 30 degrees.
            leg = cylinder(f"{name}_leg{side}_{leg_forward}", 0.045, 0.62, (side * 0.85, 0.34, leg_forward), mats["grey"], sides=12)
            turn(leg, "forward", side * math.radians(30))
            parts.append(leg)
    for leg_forward in (1.5, -0.6):
        parts.append(cylinder(f"{name}_cross_{leg_forward}", 0.05, 1.46, (0, 0.6, leg_forward), mats["grey"], axis="x", sides=12, round_by=0.02))
    return parts


def main_rotor(name, group, mats):
    hub = (0, HUB_UP, MAST_FORWARD)
    blade = material("rotor_blade", "#3a404b", roughness=0.5)
    parts = [
        cylinder(f"{name}_hub", 0.28, 0.2, hub, mats["grey"], sides=20, round_by=0.05),
        cylinder(f"{name}_hub_cap", 0.14, 0.18, (0, HUB_UP + 0.15, MAST_FORWARD), mats["steel"], sides=14, round_by=0.04),
    ]
    for index in range(4):
        angle = index * math.pi / 2 + math.pi / 4
        blade_part = box(f"{name}_blade{index}", (0.3, 0.05, 4.8), (0, HUB_UP, MAST_FORWARD + 2.65), blade, 0.02)
        tip = box(f"{name}_tip{index}", (0.3, 0.052, 0.25), (0, HUB_UP, MAST_FORWARD + 5.0), mats["accent"], 0.02)
        for piece in (blade_part, tip):
            # turn() spins about the piece's own origin; rotate the offset about the hub by hand instead.
            offset = piece.location.copy()
            offset.y += MAST_FORWARD
            rotated_x = offset.x * math.cos(angle) - offset.y * math.sin(angle)
            rotated_y = offset.x * math.sin(angle) + offset.y * math.cos(angle)
            piece.location.x = rotated_x
            piece.location.y = rotated_y - MAST_FORWARD
            turn(piece, "up", angle)
            parts.append(piece)
    combine(f"{name}_rotor_main", parts, origin=hub, parent=group)


def tail_rotor(name, group, mats):
    """Ten fan blades around a hub inside the duct; each blade's long axis points away from the hub."""
    fan_up, fan_forward = 2.05, TAIL + 0.55
    parts = [cylinder(f"{name}_fan_hub", 0.1, 0.18, (0, fan_up, fan_forward), mats["grey"], axis="x", sides=14)]
    for index in range(10):
        angle = 2 * math.pi * index / 10
        center = (0, fan_up + 0.24 * math.cos(angle), fan_forward + 0.24 * math.sin(angle))
        parts.append(turn(box(f"{name}_fan_blade{index}", (0.02, 0.32, 0.08), center, mats["steel"], 0.005), "x", angle))
    combine(f"{name}_rotor_tail", parts, origin=(0, fan_up, fan_forward), parent=group)


def clamshell_doors(name, group, white):
    for side, suffix in ((1, "l"), (-1, "r")):
        hinge_x = side * 0.5
        parts = [box(f"{name}_clam{suffix}", (0.5, 0.7, 0.06), (side * 0.25, 1.45, -1.62), white, 0.04)]
        turn(parts[0], "up", side * math.radians(-20))
        combine(f"{name}_door_clam_{suffix}", parts, origin=(hinge_x, 1.1, -1.55), parent=group)


def helicopter(name, mats, belly_colour, stripe_colour):
    group = root(name)
    white = mats["white"]
    belly = material(f"{name}_belly", belly_colour, roughness=0.35)
    stripe = material(f"{name}_stripe", stripe_colour, roughness=0.35)
    combine(f"{name}_body", fuselage(name, mats, white, belly, stripe) + tail(name, mats, white, belly) + skids(name, mats), parent=group)
    main_rotor(name, group, mats)
    tail_rotor(name, group, mats)
    clamshell_doors(name, group, white)
    return group


def build():
    reset_scene()
    mats = palette()
    helicopter("heli_a", mats, "#2f6fe4", "#ff7a2f").location.x = -3
    helicopter("heli_b", mats, "#1d3f8f", "#e5484d").location.x = 3
    export("helicopter.glb")


if __name__ == "__main__":
    build()
