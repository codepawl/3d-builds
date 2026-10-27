"""tanks.glb (propellant farm, refs/tank_farm.md) and yard.glb (build yard, refs/high_bay.md).
Every node stands on y = 0 centred on its footprint; doors are separate nodes that slide up."""
import math

from lib import box, combine, cylinder, export, loft, reset_scene, root, rod, slab, sphere, torus
from parts import around, ladder, lamp, lattice_tower, palette, railing


# --- tank farm ------------------------------------------------------------------------------------

def vertical_tank(name, radius, height, materials, stiffener_every=4.0):
    """Double-wall vertical cryo tank on a plinth: domed top, stiffener rings, caged ladder, top rail, vent."""
    group = root(name)
    sections = [(1.0, radius, radius, 0), (height - radius * 0.25, radius, radius, 0),
                (height - radius * 0.08, radius * 0.75, radius * 0.75, 0), (height, radius * 0.35, radius * 0.35, 0), (height + 0.05, 0, 0, 0)]
    parts = [loft(f"{name}_shell", sections, materials["clay"], sides=48, axis="up"),
             cylinder(f"{name}_plinth", radius + 0.8, 1.0, (0, 0.5, 0), materials["concrete"], sides=48, round_by=0.15)]
    level = 1.0 + stiffener_every
    index = 0
    while level < height - radius * 0.3:
        parts.append(torus(f"{name}_stiffener{index}", radius + 0.04, 0.06, (0, level, 0), materials["frame"], segments=48, sides=4))
        level += stiffener_every
        index += 1
    parts += ladder(f"{name}_ladder", (0, 1.0, radius + 0.15), height - 1.0, materials["frame"])
    parts += railing(f"{name}_rail", [around(radius * 0.7, math.radians(a), height - radius * 0.1) for a in range(-60, 61, 20)], 1.1, materials["frame"])
    parts.append(cylinder(f"{name}_vent", 0.25, 3.0, (radius * 0.4, height + 1.0, 0), materials["steel"], sides=10))
    parts.append(cylinder(f"{name}_valve_box", 0.9, 1.6, (0, 1.8, -radius - 0.9), materials["frame"], sides=12, round_by=0.1))
    parts.append(cylinder(f"{name}_outlet", 0.3, 3.0, (0, 1.6, -radius - 1.5), materials["steel"], axis="forward", sides=10))
    parts.append(lamp(f"{name}_top_light", (0, height + 0.3, 0), materials["glow_red"], radius=0.2))
    combine(f"{name}_body", parts, parent=group)
    return group


def horizontal_tank(name, radius, length, materials):
    """Bullet tank on concrete saddles with a top walkway and valve set at one end."""
    group = root(name)
    centre = radius + 1.4
    half = length / 2
    sections = [(-half, 0, 0, centre), (-half + radius * 0.25, radius * 0.7, radius * 0.7, centre), (-half + radius * 0.6, radius, radius, centre),
                (half - radius * 0.6, radius, radius, centre), (half - radius * 0.25, radius * 0.7, radius * 0.7, centre), (half, 0, 0, centre)]
    parts = [loft(f"{name}_shell", sections, materials["clay"], sides=32, axis="forward")]
    saddles = 4 if length > 25 else 3
    for index in range(saddles):
        z = -half + radius + index * (length - 2 * radius) / (saddles - 1)
        parts.append(box(f"{name}_saddle{index}", (radius * 1.7, centre - radius * 0.4, 1.0), (0, (centre - radius * 0.4) / 2, z), materials["concrete"], round_by=0.08))
        parts.append(torus(f"{name}_band{index}", radius + 0.04, 0.05, (0, 0, 0), materials["frame"], segments=32, sides=4))
        band = parts[-1]
        band.rotation_euler = (math.pi / 2, 0, 0)
        band.location = (0, -z, centre)
    parts.append(box(f"{name}_walk", (0.9, 0.12, length * 0.7), (0, centre + radius + 0.1, 0), materials["frame"], round_by=0.0))
    parts += railing(f"{name}_rail", [(0.45, centre + radius + 0.15, -length * 0.35), (0.45, centre + radius + 0.15, length * 0.35)], 1.0, materials["frame"])
    parts += ladder(f"{name}_ladder", (radius + 0.3, 0, half - radius - 1.4), centre + radius, materials["frame"], facing="x", cage=False)
    for index in range(3):
        parts.append(cylinder(f"{name}_valve{index}", 0.22, 1.2, (-0.8 + index * 0.8, 1.0, half + 0.6), materials["steel"], sides=10))
        parts.append(cylinder(f"{name}_wheel{index}", 0.28, 0.06, (-0.8 + index * 0.8, 1.7, half + 0.6), materials["dark"], sides=12))
    combine(f"{name}_body", parts, parent=group)
    return group


def sphere_tank(name, radius, materials):
    """Spherical cryo tank on ten equator legs with cross-bracing and a straight stair to the top."""
    group = root(name)
    centre = radius + 3.0
    parts = [sphere(f"{name}_shell", radius, (0, centre, 0), materials["clay"], segments=48),
             torus(f"{name}_equator", radius + 0.05, 0.12, (0, centre, 0), materials["frame"], segments=64, sides=4),
             cylinder(f"{name}_ring_base", radius + 1.4, 0.6, (0, 0.3, 0), materials["concrete"], sides=48, round_by=0.1)]
    legs = 10
    for index in range(legs):
        angle = 2 * math.pi * index / legs
        x, _, z = around(radius * 0.98, angle, 0)
        parts.append(cylinder(f"{name}_leg{index}", 0.45, centre, (x, centre / 2, z), materials["frame"], sides=12))
        parts.append(box(f"{name}_foot{index}", (1.6, 0.6, 1.6), (x, 0.6, z), materials["concrete"], round_by=0.1))
        nx, _, nz = around(radius * 0.98, 2 * math.pi * (index + 1) / legs, 0)
        parts.append(rod(f"{name}_brace{index}a", (x, 1.0, z), (nx, centre - 1.5, nz), 0.1, materials["frame"]))
        parts.append(rod(f"{name}_brace{index}b", (nx, 1.0, nz), (x, centre - 1.5, z), 0.1, materials["frame"]))
    parts.append(rod(f"{name}_stair", (radius + 6, 0.5, 0), (2.0, centre + radius - 0.3, 0), 0.6, materials["frame"], sides=4))
    parts.append(box(f"{name}_top_platform", (4, 0.3, 4), (0, centre + radius + 0.1, 0), materials["frame"], round_by=0.05))
    parts += railing(f"{name}_top_rail", [(-2, centre + radius + 0.25, -2), (2, centre + radius + 0.25, -2), (2, centre + radius + 0.25, 2), (-2, centre + radius + 0.25, 2), (-2, centre + radius + 0.25, -2)], 1.1, materials["frame"], post_spacing=1.4)
    parts.append(lamp(f"{name}_light", (0, centre + radius + 1.6, 0), materials["glow_red"], radius=0.25))
    combine(f"{name}_body", parts, parent=group)
    return group


def vaporizer_bank(name, columns, materials):
    """Ambient-air vaporizers: finned columns (cross-shaped fins round a core) in two rows, manifolds on top."""
    group = root(name)
    parts = [box(f"{name}_slab", (columns * 1.6 + 1, 0.4, 4.6), (0, 0.2, 0), materials["concrete"], round_by=0.05)]
    for row in (-1, 1):
        for index in range(columns):
            x = (index - (columns - 1) / 2) * 1.6
            z = row * 1.0
            parts.append(cylinder(f"{name}_core{row}{index}", 0.12, 8.0, (x, 4.4, z), materials["steel"], sides=8))
            for fin in range(4):
                angle = math.pi / 4 * fin
                width = 1.2
                piece = box(f"{name}_fin{row}{index}{fin}", (width, 8.0, 0.04), (x, 4.4, z), materials["clay"], round_by=0.0)
                piece.rotation_euler = (0, 0, angle)
                parts.append(piece)
        parts.append(cylinder(f"{name}_manifold{row}", 0.2, columns * 1.6, (0, 8.6, row * 1.0), materials["steel"], axis="x", sides=10))
    parts.append(cylinder(f"{name}_header", 0.3, 4.0, ((columns * 1.6) / 2 + 0.5, 8.6, 0), materials["steel"], axis="forward", sides=10))
    combine(f"{name}_body", parts, parent=group)
    return group


def pump_skid(name, materials):
    group = root(name)
    parts = [box(f"{name}_base", (6, 0.5, 3), (0, 0.25, 0), materials["frame"], round_by=0.08)]
    for index in range(2):
        z = -0.7 + index * 1.4
        parts.append(cylinder(f"{name}_motor{index}", 0.45, 1.8, (-1.2, 1.0, z), materials["clay"], axis="x", sides=16, round_by=0.08))
        parts.append(cylinder(f"{name}_pump{index}", 0.55, 0.9, (0.6, 1.0, z), materials["steel"], axis="x", sides=16, round_by=0.08))
        parts.append(rod(f"{name}_pipe{index}", (1.1, 1.0, z), (2.8, 2.4, z), 0.16, materials["steel"], sides=8))
    parts.append(box(f"{name}_panel", (0.6, 1.8, 1.2), (-2.6, 1.4, 0), materials["clay"], round_by=0.08))
    parts.append(lamp(f"{name}_status", (-2.6, 2.45, 0), materials["glow_amber"], radius=0.12))
    combine(f"{name}_body", parts, parent=group)
    return group


def pipe_rack(name, length, materials):
    """A pipe rack along forward: T bents every 6 m carrying four lines."""
    group = root(name)
    parts = []
    bents = int(length / 6) + 1
    for index in range(bents):
        z = -length / 2 + index * length / (bents - 1)
        parts.append(box(f"{name}_post{index}", (0.35, 4.0, 0.35), (0, 2.0, z), materials["frame"], round_by=0.04))
        parts.append(box(f"{name}_arm{index}", (3.2, 0.3, 0.3), (0, 4.0, z), materials["frame"], round_by=0.04))
        parts.append(box(f"{name}_footing{index}", (0.9, 0.3, 0.9), (0, 0.15, z), materials["concrete"], round_by=0.04))
    for line, radius in enumerate((0.35, 0.3, 0.25, 0.2)):
        parts.append(cylinder(f"{name}_line{line}", radius, length, (-1.2 + line * 0.8, 4.15 + radius, 0), materials["steel"] if line < 2 else materials["clay"], axis="forward", sides=12))
    combine(f"{name}_body", parts, parent=group)
    return group


def build_tanks():
    reset_scene()
    materials = palette()
    vertical_tank("tank_vertical_lox", 4.5, 30.0, materials)
    vertical_tank("tank_vertical_ch4", 4.5, 26.0, materials, stiffener_every=3.5)
    vertical_tank("tank_vertical_n2", 3.5, 18.0, materials)
    horizontal_tank("tank_horizontal_long", 1.85, 34.0, materials)
    horizontal_tank("tank_horizontal_short", 1.6, 20.0, materials)
    sphere_tank("tank_sphere", 10.0, materials)
    vaporizer_bank("vaporizer_bank", 6, materials)
    pump_skid("pump_skid", materials)
    pipe_rack("pipe_rack", 36.0, materials)
    export("tanks.glb")


# --- build yard -----------------------------------------------------------------------------------

def bay(name, width, height, depth, door_width, materials, doors=1):
    """Clad stacking bay: girt bands every 9 m, door slot(s) on +z with a sliding door node each,
    rooftop crane house, external stair tower, wall vents and lights."""
    group = root(name)
    parts = [box(f"{name}_shell", (width, height, depth), (0, height / 2, 0), materials["clay"], round_by=0.3)]
    level = 9.0
    index = 0
    while level < height - 2:
        parts.append(box(f"{name}_girt{index}", (width + 0.5, 0.45, depth + 0.5), (0, level, 0), materials["frame"], round_by=0.08))
        level += 9.0
        index += 1
    parts.append(box(f"{name}_parapet", (width + 0.8, 1.6, depth + 0.8), (0, height + 0.3, 0), materials["frame"], round_by=0.15))
    parts.append(box(f"{name}_crane_house", (width * 0.5, 5.0, depth * 0.4), (0, height + 2.5, -depth * 0.1), materials["clay"], round_by=0.3))
    door_height = height - 9.0
    door_centres = [0.0] if doors == 1 else [-width / 4, width / 4]
    for door_index, x in enumerate(door_centres):
        parts.append(box(f"{name}_slot{door_index}", (door_width + 1.4, door_height + 0.8, 0.6), (x, (door_height + 0.8) / 2, depth / 2 + 0.05), materials["dark"], round_by=0.05))
        for side in (-1, 1):
            parts.append(box(f"{name}_jamb{door_index}{side}", (0.8, door_height + 1.5, 1.0), (x + side * (door_width / 2 + 1.1), (door_height + 1.5) / 2, depth / 2 + 0.4), materials["frame"], round_by=0.1))
    stair = lattice_tower(f"{name}_stair", (width / 2 + 2.2, 0, depth * 0.25), 3.6, 0.0, height, max(4, int(height / 9)), materials["frame"], column=0.35, brace=0.08)
    parts += stair
    for vent in range(4):
        parts.append(box(f"{name}_vent{vent}", (0.3, 2.0, 2.4), (-width / 2 - 0.15, 6 + vent * 9, -depth / 4), materials["frame"], round_by=0.05))
    for lamp_index, x in enumerate((-width / 2 + 1, width / 2 - 1)):
        parts.append(lamp(f"{name}_light{lamp_index}", (x, height + 1.3, depth / 2 + 0.5), materials["glow_red"], radius=0.3))
        parts.append(lamp(f"{name}_flood{lamp_index}", (x * 0.6, 8.5, depth / 2 + 0.6), materials["glow_white"], radius=0.3))
    parts.append(box(f"{name}_sign_plate", (6.0, 2.0, 0.2), (-width / 2 + 5, height - 5, depth / 2 + 0.3), materials["frame"], round_by=0.05))
    combine(f"{name}_body", parts, parent=group)
    for door_index, x in enumerate(door_centres):
        panels = []
        for panel in range(int(door_height / 4.5)):
            panels.append(box(f"{name}_door{door_index}_panel{panel}", (door_width, 4.3, 0.4), (x, 2.25 + panel * 4.5, depth / 2 + 0.55), materials["frame"], round_by=0.08))
        combine(f"{name}_door{door_index}", panels, origin=(x, 0, depth / 2 + 0.55), parent=group)
    return group


def tent(name, width, length, materials):
    """Sprung fabric tent: half-ellipse shell with ribs every 5 m and an end door."""
    group = root(name)
    height = width * 0.45
    half = length / 2
    shell = loft(f"{name}_shell", [(-half, width / 2, height, 0), (half, width / 2, height, 0)], materials["clay"], sides=40, axis="forward",
                 keep_face=lambda cx, cu, cf: cu > 0.01 and abs(cf) < half - 0.01)
    parts = [shell, box(f"{name}_floor", (width + 1, 0.3, length + 1), (0, 0.15, 0), materials["concrete"], round_by=0.05)]
    arc = [(width / 2 * math.cos(math.pi * step / 12), height * math.sin(math.pi * step / 12)) for step in range(13)]
    for end_side in (-1, 1):
        parts.append(slab(f"{name}_end{end_side}", arc, 0.3, materials["clay"], plane="front", center=(0, 0, end_side * half), round_by=0.05))
    ribs = int(length / 5)
    for index in range(ribs + 1):
        z = -half + index * length / ribs
        for step in range(12):
            (x0, y0), (x1, y1) = arc[step], arc[step + 1]
            parts.append(rod(f"{name}_rib{index}_{step}", (x0 * 1.01, y0 * 1.01, z), (x1 * 1.01, y1 * 1.01, z), 0.12, materials["frame"]))
    parts.append(box(f"{name}_door", (width * 0.4, height * 0.6, 0.3), (0, height * 0.3, half + 0.1), materials["dark"], round_by=0.05))
    combine(f"{name}_body", parts, parent=group)
    return group


def office(name, materials):
    group = root(name)
    parts = [box(f"{name}_block", (30, 13, 14), (0, 6.5, 0), materials["clay"], round_by=0.25)]
    for floor in range(3):
        for side in (-1, 1):
            parts.append(box(f"{name}_band{floor}{side}", (27, 1.6, 0.2), (0, 2.6 + floor * 4.2, side * 7.05), materials["glass"], round_by=0.03))
    parts.append(box(f"{name}_canopy", (8, 0.4, 3), (0, 3.4, 8.5), materials["frame"], round_by=0.05))
    for index in range(3):
        parts.append(box(f"{name}_hvac{index}", (3, 1.6, 2.2), (-9 + index * 9, 13.8, 0), materials["frame"], round_by=0.1))
    parts.append(cylinder(f"{name}_antenna", 0.08, 6, (12, 16, -4), materials["steel"], sides=6))
    combine(f"{name}_body", parts, parent=group)
    return group


def build_yard():
    reset_scene()
    materials = palette()
    bay("high_bay", 25.0, 81.0, 30.0, 11.0, materials)
    bay("mega_bay", 45.0, 90.0, 60.0, 13.0, materials, doors=2)
    bay("mid_bay", 40.0, 26.0, 80.0, 13.0, materials)
    tent("tent", 30.0, 60.0, materials)
    office("office", materials)
    export("yard.glb")
