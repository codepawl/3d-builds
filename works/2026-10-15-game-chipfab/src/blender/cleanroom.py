"""Cleanroom shell kit (cleanroom.glb) and the sub-fab utility floor (subfab.glb).

Bay pieces snap to a 6 m grid, metres, y = 0 is the cleanroom floor:
  floor_<v>      6 x 6 m raised-floor tile, top at y = 0, centred on the origin
  wall_<v>       6 m wall along x, cut at 4.2 m with a coloured section cap (the roof is
                 cut away), centred on the origin; wall_door has an air-shower opening whose
                 _doorL/_doorR leaves slide along x from their pivots at the opening edges
  column_a       building column, 0.6 m square
  airshower_a    walk-through air shower booth; _doorF/_doorB swing about up at their hinges
  cart_terminal  wheeled engineer terminal; _wheelN spin about x
  sign_bay       bay number sign on a post
Sub-fab pieces sit on the sub-fab floor at their own y = 0:
  slab_waffle    6 x 6 m waffle slab (the cleanroom floor seen from below), top at y = 0
  pump_<v>, chiller_a (_fanN spin about up), gascab_a, scrubber_a, piperack_a (6 m along forward)
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import box, combine, cylinder, export, material, reset_scene, root, sphere, wheel  # noqa: E402
from parts import bolts, palette, plate, screen, seams, vent  # noqa: E402

WALL_HEIGHT = 4.2
MODULE = 6.0


# --- floors ----------------------------------------------------------------------------------

def floor(name, mats, top_colour, aisle=False, yellow=False):
    """A raised floor of 0.6 m tiles: a slab with thin grout lines, perforated tiles as darker
    insets, and optional aisle lines (aisle) or a warm litho-bay tint (yellow)."""
    group = root(name)
    top = material(f"floor_{top_colour}", top_colour, roughness=0.55)
    parts = [box(f"{name}_slab", (MODULE, 0.12, MODULE), (0, -0.06, 0), top, 0.01)]
    count = int(MODULE / 0.6)
    for index in range(1, count):
        offset = -MODULE / 2 + index * 0.6
        parts.append(box(f"{name}_gx{index}", (0.012, 0.004, MODULE), (offset, 0.001, 0), mats["panel"], 0.0))
        parts.append(box(f"{name}_gz{index}", (MODULE, 0.004, 0.012), (0, 0.001, offset), mats["panel"], 0.0))
    perforated = material("floor_perforated", "#c4ccd6", roughness=0.7)
    for row in range(count):
        for column in range(count):
            if (row + column * 2) % 4 == 1 and not (aisle and 3 <= column <= 6):
                center = (-MODULE / 2 + 0.3 + column * 0.6, 0.002, -MODULE / 2 + 0.3 + row * 0.6)
                parts.append(box(f"{name}_perf{row}_{column}", (0.5, 0.004, 0.5), center, perforated, 0.0))
    if aisle:
        line = material("aisle_line", "#f2c230", roughness=0.5)
        for side in (-1, 1):
            parts.append(box(f"{name}_line{side}", (0.08, 0.006, MODULE), (side * 1.2, 0.003, 0), line, 0.0))
        for index in range(3):
            parts.append(box(f"{name}_dash{index}", (0.06, 0.006, 0.6), (0, 0.003, -2.0 + index * 2.0), line, 0.0))
    if yellow:
        parts.append(box(f"{name}_glowtrim", (MODULE - 0.2, 0.01, 0.06), (0, 0.005, -MODULE / 2 + 0.15), mats["yellow"], 0.0))
    combine(f"{name}_mesh", parts, parent=group)


# --- walls and columns -----------------------------------------------------------------------

def wall(name, mats, kind):
    """A 6 m wall along x. `plain` is a panel wall with a window band, `litho` has amber
    filtered glass and a glowing yellow cap, `door` has an air-shower opening with sliding
    leaves."""
    group = root(name)
    thickness = 0.22
    cap = mats["yellow"] if kind == "litho" else mats["brand"]
    glass = material("litho_glass", "#e9c45a", roughness=0.1) if kind == "litho" else mats["glass"]
    parts = []
    if kind == "door":
        opening = 1.6
        side_width = (MODULE - opening) / 2
        for side in (-1, 1):
            center_x = side * (opening / 2 + side_width / 2)
            parts.append(box(f"{name}_panel{side}", (side_width, WALL_HEIGHT, thickness), (center_x, WALL_HEIGHT / 2, 0), mats["shell"], 0.03))
            parts.append(box(f"{name}_cap{side}", (side_width, 0.06, thickness + 0.02), (center_x, WALL_HEIGHT + 0.03, 0), cap, 0.01))
        parts.append(box(f"{name}_lintel", (opening, WALL_HEIGHT - 2.4, thickness), (0, 2.4 + (WALL_HEIGHT - 2.4) / 2, 0), mats["shell"], 0.03))
        parts.append(box(f"{name}_lintelcap", (opening, 0.06, thickness + 0.02), (0, WALL_HEIGHT + 0.03, 0), cap, 0.01))
        for side in (-1, 1):
            parts.append(box(f"{name}_jamb{side}", (0.08, 2.5, thickness + 0.04), (side * (opening / 2 + 0.04), 1.25, 0), mats["trim"], 0.02))
        parts.append(box(f"{name}_head", (opening + 0.16, 0.1, thickness + 0.04), (0, 2.45, 0), mats["trim"], 0.02))
        parts.append(box(f"{name}_doorsign", (0.5, 0.16, 0.02), (0, 2.65, thickness / 2 + 0.01), mats["screen"], 0.01))
        for side, leaf_name in ((-1, "doorL"), (1, "doorR")):
            pivot = (side * opening / 2, 0, 0)
            combine(f"{name}_{leaf_name}", [
                box(f"{name}_{leaf_name}_leaf", (opening / 2, 2.36, 0.05), (side * opening / 4, 1.2, 0), mats["panel"], 0.015),
                box(f"{name}_{leaf_name}_window", (opening / 2 - 0.25, 0.7, 0.06), (side * opening / 4, 1.6, 0), mats["glass"], 0.01),
            ], origin=pivot, parent=group)
    else:
        parts += [
            box(f"{name}_lower", (MODULE, 1.1, thickness), (0, 0.55, 0), mats["shell"], 0.03),
            box(f"{name}_upper", (MODULE, WALL_HEIGHT - 2.5, thickness), (0, 2.5 + (WALL_HEIGHT - 2.5) / 2, 0), mats["shell"], 0.03),
            box(f"{name}_window", (MODULE, 1.4, 0.06), (0, 1.8, 0), glass, 0.0),
            box(f"{name}_cap", (MODULE, 0.06, thickness + 0.02), (0, WALL_HEIGHT + 0.03, 0), cap, 0.01),
        ]
        for index in range(4):
            mullion_x = -MODULE / 2 + 0.05 + index * (MODULE - 0.1) / 3
            parts.append(box(f"{name}_mullion{index}", (0.08, 1.4, thickness - 0.02), (mullion_x, 1.8, 0), mats["trim"], 0.01))
        for face, sign in (("+f", 1), ("-f", -1)):
            parts += seams(f"{name}_seam{sign}", face, (0, 0.55, sign * thickness / 2), MODULE, 1.0, 4, mats)
            parts += seams(f"{name}_useam{sign}", face, (0, 3.35, sign * thickness / 2), MODULE, 1.6, 4, mats)
        parts += vent(f"{name}_return", "+f", (MODULE / 2 - 0.6, 0.35, thickness / 2), 0.7, 0.3, mats, slats=4)
    combine(f"{name}_mesh", parts, parent=group)


def column(name, mats):
    group = root(name)
    combine(f"{name}_mesh", [
        box(f"{name}_shaft", (0.6, WALL_HEIGHT, 0.6), (0, WALL_HEIGHT / 2, 0), mats["panel"], 0.04),
        box(f"{name}_cap", (0.64, 0.06, 0.64), (0, WALL_HEIGHT + 0.03, 0), mats["brand"], 0.01),
        box(f"{name}_guard", (0.7, 0.4, 0.7), (0, 0.2, 0), mats["amber"], 0.03),
        box(f"{name}_tag", (0.3, 0.2, 0.02), (0, 1.8, 0.31), mats["shell"], 0.005),
    ], parent=group)


def air_shower(name, mats):
    """Walk-through air shower: a booth with nozzle panels and a door at each end."""
    group = root(name)
    parts = [
        box(f"{name}_sidel", (0.12, 2.3, 1.6), (-0.66, 1.15, 0), mats["shell"], 0.04),
        box(f"{name}_sider", (0.12, 2.3, 1.6), (0.66, 1.15, 0), mats["shell"], 0.04),
        box(f"{name}_roof", (1.44, 0.3, 1.6), (0, 2.45, 0), mats["panel"], 0.05),
        box(f"{name}_band", (1.46, 0.08, 1.62), (0, 2.25, 0), mats["brand"], 0.01),
        box(f"{name}_floor", (1.2, 0.04, 1.6), (0, 0.02, 0), mats["trim"], 0.01),
        box(f"{name}_lamp", (0.4, 0.05, 0.04), (0, 2.45, 0.82), mats["status"], 0.01),
    ]
    for side in (-1, 1):
        for index in range(6):
            parts.append(cylinder(f"{name}_nozzle{side}_{index}", 0.03, 0.03, (side * 0.6, 0.7 + (index % 3) * 0.5, -0.3 + (index // 3) * 0.6), mats["steel"], axis="x", sides=10))
    combine(f"{name}_mesh", parts, parent=group)
    for end, door_name in ((1, "doorF"), (-1, "doorB")):
        hinge = (-0.58, 0, end * 0.8)
        combine(f"{name}_{door_name}", [
            box(f"{name}_{door_name}_leaf", (1.14, 2.2, 0.04), (0, 1.12, end * 0.8), mats["panel"], 0.015),
            box(f"{name}_{door_name}_window", (0.5, 0.6, 0.05), (0, 1.55, end * 0.8), mats["glass"], 0.01),
            box(f"{name}_{door_name}_handle", (0.04, 0.3, 0.06), (0.45, 1.05, end * 0.83), mats["steel"], 0.01),
        ], origin=hinge, parent=group)


def cart_terminal(name, mats):
    group = root(name)
    parts = [
        box(f"{name}_base", (0.6, 0.06, 0.5), (0, 0.16, 0), mats["panel"], 0.02),
        box(f"{name}_post", (0.08, 0.95, 0.08), (0, 0.66, -0.15), mats["steel"], 0.02),
        box(f"{name}_tray", (0.55, 0.04, 0.35), (0, 0.95, 0.02), mats["shell"], 0.015),
        box(f"{name}_keyboard", (0.4, 0.02, 0.14), (0, 0.98, 0.08), mats["trim"], 0.006),
        box(f"{name}_scanner", (0.06, 0.12, 0.05), (0.24, 1.02, 0.12), mats["brand"], 0.01),
    ]
    parts += screen(f"{name}_monitor", "+f", (0, 1.32, -0.14), mats, width=0.5, height=0.32)
    combine(f"{name}_mesh", parts, parent=group)
    for index, (side, end) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        wheel(f"{name}_wheel{index}", 0.06, 0.04, (side * 0.24, 0.06, end * 0.19), group, bolts=3)


def bay_sign(name, mats):
    group = root(name)
    parts = [
        box(f"{name}_post", (0.08, 2.6, 0.08), (0, 1.3, 0), mats["steel"], 0.02),
        box(f"{name}_foot", (0.4, 0.04, 0.4), (0, 0.02, 0), mats["trim"], 0.01),
        box(f"{name}_board", (0.9, 0.5, 0.06), (0, 2.85, 0), mats["brand"], 0.03),
        box(f"{name}_number", (0.5, 0.26, 0.07), (-0.1, 2.85, 0), mats["shell"], 0.01),
    ]
    parts += bolts(f"{name}_board", "+f", (0, 2.85, 0.03), 0.78, 0.38, mats)
    combine(f"{name}_mesh", parts, parent=group)


# --- sub-fab ---------------------------------------------------------------------------------

def waffle_slab(name, mats):
    """The cleanroom floor slab seen from the sub-fab: a concrete grid of beams with square
    air holes, 0.6 m deep."""
    group = root(name)
    concrete = material("concrete", "#c9cdd3", roughness=0.85)
    parts = []
    beams = 6
    pitch = MODULE / beams
    for index in range(beams + 1):
        offset = -MODULE / 2 + index * pitch
        parts.append(box(f"{name}_bx{index}", (0.22, 0.6, MODULE), (offset, -0.3, 0), concrete, 0.02))
        parts.append(box(f"{name}_bz{index}", (MODULE, 0.6, 0.22), (0, -0.3, offset), concrete, 0.02))
    combine(f"{name}_mesh", parts, parent=group)


def pump(name, mats, large):
    """A dry vacuum pump: housing with a motor drum, inlet and exhaust lines and status lamp."""
    group = root(name)
    length = 1.4 if large else 1.0
    parts = [
        box(f"{name}_housing", (0.6, 0.8, length), (0, 0.45, 0), mats["shell"], 0.05),
        box(f"{name}_plinth", (0.56, 0.06, length - 0.06), (0, 0.03, 0), mats["trim"], 0.01),
        cylinder(f"{name}_motor", 0.2, 0.4, (0, 0.55, length / 2 + 0.2), mats["brand"], axis="forward", sides=24, round_by=0.03),
        cylinder(f"{name}_inlet", 0.06, 0.8, (0.15, 1.25, -length / 4), mats["steel"], sides=14),
        cylinder(f"{name}_exhaust", 0.05, 0.6, (-0.15, 1.15, -length / 4), mats["steel"], sides=14),
        box(f"{name}_lamp", (0.1, 0.04, 0.04), (0.2, 0.86, length / 2), mats["status"], 0.01),
    ]
    parts += vent(f"{name}_vent", "+x", (0.3, 0.45, 0), length * 0.6, 0.4, mats, slats=5)
    parts += plate(f"{name}_id", "-x", (-0.3, 0.6, 0), 0.3, 0.12, mats)
    combine(f"{name}_mesh", parts, parent=group)


def chiller(name, mats):
    group = root(name)
    parts = [
        box(f"{name}_body", (2.4, 1.6, 1.2), (0, 0.8, 0), mats["shell"], 0.06),
        box(f"{name}_band", (2.42, 0.1, 1.22), (0, 1.3, 0), mats["brand"], 0.01),
    ]
    parts += vent(f"{name}_vent", "+f", (-0.5, 0.6, 0.6), 1.0, 0.7, mats, slats=7)
    parts += screen(f"{name}_hmi", "+f", (0.7, 1.0, 0.6), mats, width=0.3, height=0.2)
    for index in range(3):
        parts.append(cylinder(f"{name}_pipe{index}", 0.06, 1.2, (-0.8 + index * 0.3, 0.6, -0.6 - 0.0), mats["steel"], axis="forward", sides=12))
    for index in range(2):
        parts.append(cylinder(f"{name}_shroud{index}", 0.42, 0.12, (-0.55 + index * 1.1, 1.66, 0), mats["trim"], sides=28, round_by=0.02))
    combine(f"{name}_mesh", parts, parent=group)
    for index in range(2):
        center = (-0.55 + index * 1.1, 1.7, 0)
        blades = [box(f"{name}_blade{index}_{blade}", (0.7, 0.02, 0.12), center, mats["panel"], 0.01) for blade in range(3)]
        for blade_index, blade in enumerate(blades):
            blade.rotation_euler.z = blade_index * math.pi / 3
        blades.append(cylinder(f"{name}_hubcap{index}", 0.08, 0.05, center, mats["steel"], sides=14))
        combine(f"{name}_fan{index}", blades, origin=center, parent=group)


def gas_cabinet(name, mats):
    """A ventilated gas cabinet: a glazed door onto two cylinders, a panel of regulators, and
    an exhaust duct on top."""
    group = root(name)
    parts = [
        box(f"{name}_body", (1.0, 2.1, 0.6), (0, 1.05, 0), mats["shell"], 0.04),
        box(f"{name}_window", (0.5, 0.9, 0.04), (-0.18, 1.3, 0.3), mats["glass"], 0.01),
        cylinder(f"{name}_duct", 0.12, 0.4, (0.2, 2.3, -0.1), mats["steel"], sides=16),
        box(f"{name}_hazard", (0.9, 0.1, 0.02), (0, 1.95, 0.305), mats["amber"], 0.0),
    ]
    for index in range(2):
        parts.append(cylinder(f"{name}_bottle{index}", 0.11, 1.3, (-0.3 + index * 0.25, 0.75, 0.0), mats["brand"], sides=16, round_by=0.04))
    for index in range(3):
        parts.append(cylinder(f"{name}_gauge{index}", 0.04, 0.03, (0.32, 1.1 + index * 0.18, 0.31), mats["steel"], axis="forward", sides=12))
    parts += screen(f"{name}_hmi", "+f", (0.32, 1.7, 0.3), mats, width=0.2, height=0.14)
    combine(f"{name}_mesh", parts, parent=group)


def scrubber(name, mats):
    group = root(name)
    combine(f"{name}_mesh", [
        cylinder(f"{name}_tank", 0.5, 2.0, (0, 1.05, 0), mats["shell"], sides=28, round_by=0.06),
        cylinder(f"{name}_band", 0.51, 0.1, (0, 1.6, 0), mats["brand"], sides=28),
        sphere(f"{name}_top", 0.5, (0, 2.05, 0), mats["shell"], scale=(1, 0.35, 1), segments=24),
        box(f"{name}_skid", (1.3, 0.1, 1.3), (0, 0.05, 0), mats["trim"], 0.02),
        cylinder(f"{name}_outlet", 0.1, 0.8, (0, 2.5, 0), mats["steel"], sides=14),
        box(f"{name}_panel", (0.4, 0.6, 0.2), (0.62, 0.8, 0), mats["panel"], 0.03),
        box(f"{name}_lamp", (0.04, 0.06, 0.1), (0.83, 1.0, 0), mats["status"], 0.01),
    ], parent=group)


def pipe_rack(name, mats):
    """A 6 m rack of colour-coded process lines on two levels, running along forward."""
    group = root(name)
    parts = []
    for end in (-1, 1):
        for side in (-1, 1):
            parts.append(box(f"{name}_leg{end}{side}", (0.08, 2.4, 0.08), (side * 0.7, 1.2, end * 2.6), mats["steel"], 0.01))
        for level in (1.4, 2.3):
            parts.append(box(f"{name}_beam{end}{level}", (1.5, 0.08, 0.1), (0, level, end * 2.6), mats["steel"], 0.01))
    colours = ["#5b8def", "#2fb37a", "#e8a33c", "#cfd6de", "#9a7cf0", "#e5484d"]
    for index, colour in enumerate(colours):
        level = 1.5 if index < 3 else 2.4
        line = material(f"pipe_{colour}", colour, roughness=0.35, metallic=0.3)
        radius = 0.07 if index % 3 == 0 else 0.05
        parts.append(cylinder(f"{name}_line{index}", radius, MODULE, (-0.45 + (index % 3) * 0.45, level, 0), line, axis="forward", sides=16))
    combine(f"{name}_mesh", parts, parent=group)


def main():
    reset_scene()
    mats = palette()
    floor("floor_a", mats, "#f4f6f9")
    floor("floor_aisle", mats, "#f4f6f9", aisle=True)
    floor("floor_litho", mats, "#f7efd6", yellow=True)
    wall("wall_a", mats, "plain")
    wall("wall_litho", mats, "litho")
    wall("wall_door", mats, "door")
    column("column_a", mats)
    air_shower("airshower_a", mats)
    cart_terminal("cart_terminal", mats)
    bay_sign("sign_bay", mats)
    export("cleanroom.glb")

    reset_scene()
    mats = palette()
    waffle_slab("slab_waffle", mats)
    pump("pump_a", mats, large=False)
    pump("pump_b", mats, large=True)
    chiller("chiller_a", mats)
    gas_cabinet("gascab_a", mats)
    scrubber("scrubber_a", mats)
    pipe_rack("piperack_a", mats)
    export("subfab.glb")


main()
