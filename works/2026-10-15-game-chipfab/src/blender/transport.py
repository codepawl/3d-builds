"""Overhead hoist transport and pod storage, exported to oht.glb and stocker.glb.

oht.glb, metres, +forward is the direction of travel:
  oht_<v>      vehicle; origin on the rail running surface, the body hangs below it (y < 0).
               _wheelN spin about x; _hoist (gripper) moves straight down from its pivot at the
               body floor; _belts scale on y from the same pivot; _hoist_pod (empty, child of the
               hoist) is where a carried pod's origin goes.
  rail_<kind>  4 m track tiles centred on the origin, running surface at y = 0, hangers up to y = 1:
               straight (along forward), curve (south edge to east edge, radius 2), junction.
  foup_<v>     wafer pod, origin at its bottom centre, door faces +forward (_door, pivot at its
               bottom edge).
stocker.glb:
  stocker_<v>  pod stocker on y = 0, front +forward; _crane slides along x behind the glass,
               _portN load ports and _ohtN empties on the roof where the OHT drops pods.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import anchor, box, combine, cylinder, export, material, reset_scene, root, turn  # noqa: E402
from parts import load_port, palette, plate, screen, seams, vent  # noqa: E402

# --- pods ------------------------------------------------------------------------------------

def foup(name, mats, shell_colour, band_colour):
    """A front-opening wafer pod: tinted shell, top flange the hoist grips, side handles and a
    door with two latch keyholes. Returns the root."""
    group = root(name)
    shell = material(f"pod_{shell_colour}", shell_colour, roughness=0.35)
    band = material(f"pod_{band_colour}", band_colour, roughness=0.4, emission=band_colour, strength=0.4)
    parts = [
        box(f"{name}_shell", (0.39, 0.3, 0.32), (0, 0.17, -0.01), shell, 0.05),
        box(f"{name}_base", (0.36, 0.03, 0.3), (0, 0.015, -0.01), mats["trim"], 0.01),
        box(f"{name}_neck", (0.12, 0.03, 0.12), (0, 0.335, -0.01), mats["trim"], 0.01),
        box(f"{name}_flange", (0.26, 0.02, 0.2), (0, 0.355, -0.01), mats["panel"], 0.008),
        box(f"{name}_band", (0.395, 0.03, 0.3), (0, 0.24, -0.01), band, 0.01),
    ]
    for side in (-1, 1):
        parts.append(box(f"{name}_handle{side}", (0.03, 0.04, 0.18), (side * 0.205, 0.2, -0.02), mats["trim"], 0.012))
    combine(f"{name}_body", parts, parent=group)
    hinge = (0, 0.03, 0.155)
    combine(f"{name}_door", [
        box(f"{name}_doorpanel", (0.36, 0.27, 0.02), (0, 0.17, 0.16), mats["panel"], 0.012),
        cylinder(f"{name}_keyhole0", 0.016, 0.01, (-0.09, 0.17, 0.172), mats["trim"], axis="forward", sides=10),
        cylinder(f"{name}_keyhole1", 0.016, 0.01, (0.09, 0.17, 0.172), mats["trim"], axis="forward", sides=10),
    ], origin=hinge, parent=group)
    return group


# --- vehicles --------------------------------------------------------------------------------

def vehicle(name, mats, cover, accent, beacon=False):
    """An OHT vehicle hanging from its drive unit. `cover` is the body material, `accent` the
    side stripe; `beacon` adds the amber rotating lamp of the maintenance vehicle."""
    group = root(name)
    parts = [
        box(f"{name}_drive", (0.16, 0.12, 0.62), (0, 0.02, 0), mats["trim"], 0.03),
        box(f"{name}_hanger", (0.1, 0.12, 0.3), (0, -0.09, 0), mats["steel"], 0.02),
        box(f"{name}_body", (0.5, 0.36, 0.86), (0, -0.33, 0), cover, 0.07),
        box(f"{name}_stripe", (0.505, 0.06, 0.7), (0, -0.28, 0), accent, 0.015),
        box(f"{name}_bumperfront", (0.42, 0.1, 0.05), (0, -0.4, 0.44), mats["rubber"], 0.02),
        box(f"{name}_bumperback", (0.42, 0.1, 0.05), (0, -0.4, -0.44), mats["rubber"], 0.02),
        box(f"{name}_sensor", (0.14, 0.04, 0.02), (0, -0.22, 0.435), mats["screen"], 0.008),
        box(f"{name}_lampfront", (0.3, 0.03, 0.02), (0, -0.5, 0.43), mats["lamp"], 0.008),
        box(f"{name}_lampback", (0.3, 0.03, 0.02), (0, -0.5, -0.43), mats["red"], 0.008),
        box(f"{name}_skirt", (0.46, 0.42, 0.04), (0, -0.72, 0.4), cover, 0.03),
        box(f"{name}_skirtback", (0.46, 0.42, 0.04), (0, -0.72, -0.4), cover, 0.03),
    ]
    for side in (-1, 1):
        parts += vent(f"{name}_vent{side}", "+x" if side > 0 else "-x", (side * 0.25, -0.36, -0.2), 0.24, 0.12, mats, slats=3)
        parts += plate(f"{name}_id{side}", "+x" if side > 0 else "-x", (side * 0.25, -0.38, 0.17), 0.2, 0.08, mats)
    if beacon:
        parts.append(cylinder(f"{name}_beaconbase", 0.05, 0.03, (0.15, -0.135, -0.3), mats["trim"], sides=12))
        parts.append(cylinder(f"{name}_beacon", 0.04, 0.05, (0.15, -0.095, -0.3), mats["amber"], sides=12, round_by=0.01))
    combine(f"{name}_shell", parts, parent=group)
    for index, (side, end) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        center = (side * 0.1, 0.04, end * 0.22)
        combine(f"{name}_wheel{index}", [
            cylinder(f"{name}_tyre{index}", 0.045, 0.03, center, mats["rubber"], axis="x", sides=16, round_by=0.008),
            cylinder(f"{name}_hub{index}", 0.02, 0.034, center, mats["steel"], axis="x", sides=8),
        ], origin=center, parent=group)
    pivot = (0, -0.51, 0)
    combine(f"{name}_belts", [
        box(f"{name}_belt{index}", (0.03, 0.06, 0.008), (side_x, -0.54, side_z), mats["trim"], 0.0)
        for index, (side_x, side_z) in enumerate(((-0.1, -0.08), (0.1, -0.08), (0, 0.1)))
    ], origin=pivot, parent=group)
    hoist = combine(f"{name}_hoist", [
        box(f"{name}_gripper", (0.34, 0.06, 0.28), (0, -0.6, 0), mats["panel"], 0.02),
        box(f"{name}_claw0", (0.03, 0.06, 0.2), (-0.13, -0.65, 0), mats["steel"], 0.01),
        box(f"{name}_claw1", (0.03, 0.06, 0.2), (0.13, -0.65, 0), mats["steel"], 0.01),
    ], origin=pivot, parent=group)
    # A carried pod's origin (its bottom centre) goes here: the flange top (0.365 above the
    # bottom) meets the claw tips 0.17 below the pivot. Coordinates are local to the hoist.
    anchor(f"{name}_hoist_pod", (0, -0.17 - 0.365, 0), hoist)
    return group


# --- rail ------------------------------------------------------------------------------------

def rail_piece(prefix, center, heading, length, mats):
    """A straight piece of channel rail (top plate, two side plates with lips) centred on
    `center`, turned by `heading` about up from the forward axis."""
    x, up, forward = center
    pieces = [
        box(f"{prefix}_top", (0.24, 0.025, length), (x, 0.15, forward), mats["steel"], 0.006),
        box(f"{prefix}_sidel", (0.02, 0.15, length), (x - 0.11, 0.075, forward), mats["steel"], 0.004),
        box(f"{prefix}_sider", (0.02, 0.15, length), (x + 0.11, 0.075, forward), mats["steel"], 0.004),
        box(f"{prefix}_lipl", (0.05, 0.015, length), (x - 0.09, 0.0, forward), mats["panel"], 0.004),
        box(f"{prefix}_lipr", (0.05, 0.015, length), (x + 0.09, 0.0, forward), mats["panel"], 0.004),
        box(f"{prefix}_feeder", (0.03, 0.03, length), (x, 0.12, forward), mats["brand"], 0.004),
    ]
    for piece in pieces:
        # rotate each part about the piece centre
        offset_x = piece.location.x - x
        offset_forward = -piece.location.y - forward
        piece.location.x = x + offset_x * math.cos(heading) + offset_forward * math.sin(heading)
        piece.location.y = -(forward - offset_x * math.sin(heading) + offset_forward * math.cos(heading))
        turn(piece, "up", heading)
    return pieces


def hanger(prefix, center, mats):
    x, up, forward = center
    return [
        box(f"{prefix}_rod", (0.04, 0.85, 0.04), (x, 0.6, forward), mats["steel"], 0.01),
        box(f"{prefix}_yoke", (0.32, 0.04, 0.08), (x, 0.18, forward), mats["trim"], 0.01),
        box(f"{prefix}_plate", (0.2, 0.03, 0.2), (x, 1.02, forward), mats["trim"], 0.01),
    ]


def curve_parts(prefix, mats, segments=10):
    """Quarter circle of radius 2 around the cell corner (2, -2): from (0, -2) heading +forward
    to (2, 0) heading +x."""
    parts = []
    radius = 2.0
    for index in range(segments):
        angle = (index + 0.5) / segments * math.pi / 2
        center = (2 - radius * math.cos(angle), 0, -2 + radius * math.sin(angle))
        length = 2 * radius * math.sin(math.pi / 4 / segments) + 0.02
        parts += rail_piece(f"{prefix}_seg{index}", center, angle, length, mats)
    parts += hanger(f"{prefix}_hang", (2 - radius * math.cos(math.pi / 4), 0, -2 + radius * math.sin(math.pi / 4)), mats)
    return parts


def rails(mats):
    straight = root("rail_straight")
    combine("rail_straight_mesh", rail_piece("rail_s", (0, 0, 0), 0.0, 4.0, mats)
            + hanger("rail_s_h0", (0, 0, -1.0), mats) + hanger("rail_s_h1", (0, 0, 1.0), mats), parent=straight)
    curve = root("rail_curve")
    combine("rail_curve_mesh", curve_parts("rail_c", mats), parent=curve)
    junction = root("rail_junction")
    combine("rail_junction_mesh", rail_piece("rail_j", (0, 0, 0), 0.0, 4.0, mats) + curve_parts("rail_jc", mats)
            + hanger("rail_j_h0", (0, 0, 1.0), mats)
            + [box("rail_j_switch", (0.36, 0.08, 0.5), (0.05, 0.2, -1.4), mats["brand"], 0.02)], parent=junction)


# --- stockers --------------------------------------------------------------------------------

def stocker(name, mats, bays, pod_shell):
    """A pod stocker: a tall glazed cabinet with rows of shelved pods, a crane that slides along
    x, two manual load ports at the front and OHT drop ports on the roof."""
    group = root(name)
    length = 1.0 * bays + 1.0
    height = 3.2
    shelf_material = material(f"pod_{pod_shell}", pod_shell, roughness=0.35)
    # An open shell (control section, end, roof, base, back) so the shelves show through the glass.
    window_height = height - 1.05
    parts = [
        box(f"{name}_control", (0.9, height, 2.2), (-length / 2 + 0.45, height / 2, -1.1), mats["shell"], 0.08),
        box(f"{name}_end", (0.3, height, 2.2), (length / 2 - 0.15, height / 2, -1.1), mats["shell"], 0.06),
        box(f"{name}_roof", (length, 0.3, 2.2), (0, height - 0.15, -1.1), mats["shell"], 0.08),
        box(f"{name}_base", (length, 0.75, 2.2), (0, 0.375, -1.1), mats["shell"], 0.06),
        box(f"{name}_back", (length, height, 0.1), (0, height / 2, -2.15), mats["trim"], 0.02),
        box(f"{name}_glass", (length - 1.2, window_height, 0.04), (0.3, 0.75 + window_height / 2, -0.02), mats["glass"], 0.01),
        box(f"{name}_band", (length + 0.02, 0.14, 2.22), (0, 0.5, -1.1), mats["brand"], 0.02),
        box(f"{name}_roofdeck", (length - 0.2, 0.08, 2.0), (0, height + 0.04, -1.1), mats["panel"], 0.02),
        box(f"{name}_crane_rail", (length - 1.3, 0.06, 0.08), (0.3, height - 0.38, -0.6), mats["steel"], 0.01),
        box(f"{name}_floor_rail", (length - 1.3, 0.06, 0.08), (0.3, 0.78, -0.6), mats["steel"], 0.01),
    ]
    for row in range(4):
        shelf_up = 0.9 + row * 0.55
        parts.append(box(f"{name}_shelf{row}", (length - 1.3, 0.03, 0.5), (0.3, shelf_up, -1.0), mats["panel"], 0.0))
        for column in range(bays * 2):
            if (row * 7 + column * 3) % 5 == 0:
                continue
            pod_x = -length / 2 + 1.05 + column * 0.48
            parts.append(box(f"{name}_pod{row}_{column}", (0.36, 0.3, 0.32), (pod_x, shelf_up + 0.17, -1.0), shelf_material, 0.04))
    for index in range(2):
        port_x = -length / 2 + 1.2 + index * 0.9
        parts.append(box(f"{name}_ohtport{index}", (0.5, 0.06, 0.5), (port_x, height + 0.1, -0.5), mats["trim"], 0.02))
        anchor(f"{name}_oht{index}", (port_x, height + 0.13, -0.5), group)
    parts += seams(f"{name}_seam", "-x", (-length / 2, height / 2, -1.1), 2.2, height * 0.9, 3, mats)
    parts += vent(f"{name}_vent", "+x", (length / 2, height - 0.6, -1.1), 1.4, 0.5, mats, slats=5)
    parts += plate(f"{name}_sign", "+f", (-length / 2 + 0.5, height - 0.4, 0.0), 0.7, 0.24, mats)
    parts += screen(f"{name}_hmi", "+f", (-length / 2 + 0.5, 1.55, 0.0), mats)
    for index, port_x in enumerate((-length / 2 + 0.3, -length / 2 + 0.75)):
        port_parts, _ = load_port(f"{name}_port{index}", (port_x, 0.0, 0.45), mats, group)
        parts += port_parts
        anchor(f"{name}_port{index}", (port_x, 0.92, 0.45), group)
    combine(f"{name}_body", parts, parent=group)
    foot = (-length / 2 + 1.4, 0.7, -0.6)
    combine(f"{name}_crane", [
        box(f"{name}_mast", (0.12, height - 1.1, 0.12), (foot[0], (height + 0.3) / 2, -0.6), mats["steel"], 0.02),
        box(f"{name}_carriage", (0.4, 0.12, 0.42), (foot[0], 1.6, -0.82), mats["brand"], 0.03),
        box(f"{name}_fork", (0.3, 0.03, 0.3), (foot[0], 1.53, -1.0), mats["steel"], 0.01),
    ], origin=foot, parent=group)
    return group


def main():
    reset_scene()
    mats = palette()
    vehicle("oht_a", mats, mats["shell"], mats["brand"])
    vehicle("oht_b", mats, mats["panel"], mats["brand"])
    vehicle("oht_c", mats, mats["trim"], mats["amber"], beacon=True)
    rails(mats)
    foup("foup_std", mats, "#c9d3df", "#5a6b80")
    foup("foup_hot", mats, "#c9d3df", "#ff5a36")
    foup("foup_eng", mats, "#d7d0ec", "#7b5cff")
    foup("foup_mon", mats, "#e8e2c8", "#13a594")
    export("oht.glb")

    reset_scene()
    mats = palette()
    stocker("stocker_a", mats, 4, "#c9d3df")
    stocker("stocker_b", mats, 8, "#c9d3df")
    export("stocker.glb")


main()
