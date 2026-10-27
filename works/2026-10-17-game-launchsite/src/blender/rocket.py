"""rocket.glb: the two-stage vehicle. Kestrel boosters (71 m x 9 m, 33 engines, grid fins) and Heron ships
(52 m x 9 m, 6 engines, four flaps) from refs/booster.md and refs/ship.md. Each stage stands on y = 0 with its
axis on x = z = 0; chines face +-x, the ship's heat tiles face -z."""
import math

from lib import combine, cylinder, export, loft, reset_scene, root, slab, turn, box, point
from parts import around, lamp, make_node, palette, ring_lines

RADIUS = 4.5


def engine(name, center, bell_radius, bell_height, materials):
    """One engine: bell (open end dark), throat, power head and two turbopump cans."""
    x, up, forward = center
    sections = [
        (up, bell_radius, bell_radius, forward),
        (up + bell_height * 0.35, bell_radius * 0.82, bell_radius * 0.82, forward),
        (up + bell_height * 0.75, bell_radius * 0.5, bell_radius * 0.5, forward),
        (up + bell_height, bell_radius * 0.38, bell_radius * 0.38, forward),
    ]
    bell = loft(f"{name}_bell", sections, [materials["steel"], materials["dark"]], sides=18, axis="up", x=x,
                material_for_face=lambda cx, cu, cf: 1 if cu < up + 0.01 else 0)
    head = cylinder(f"{name}_head", bell_radius * 0.45, bell_radius * 0.9, (x, up + bell_height + bell_radius * 0.45, forward),
                    materials["frame"], sides=12, round_by=0.05)
    pump = cylinder(f"{name}_pump", bell_radius * 0.18, bell_radius * 0.8, (x + bell_radius * 0.4, up + bell_height + 0.3, forward),
                    materials["frame"], sides=8)
    return [bell, head, pump]


def grid_fin(name, hinge_up, angle, materials, parent):
    """A grid fin sticking out radially: a frame 5 m across and 4 m out, 0.9 m deep, open cells.
    Built facing +forward, then turned to `angle`; the pivot is the hinge on the barrel."""
    mat = materials["frame"]
    width = 5.6
    reach = 4.6
    depth = 1.4
    start = RADIUS + 0.2
    parts = [
        box(f"{name}_inner", (width, depth, 0.35), (0, hinge_up, start), mat, round_by=0.08),
        box(f"{name}_outer", (width, depth, 0.3), (0, hinge_up, start + reach), mat, round_by=0.08),
        box(f"{name}_left", (0.3, depth, reach), (-width / 2, hinge_up, start + reach / 2), mat, round_by=0.08),
        box(f"{name}_right", (0.3, depth, reach), (width / 2, hinge_up, start + reach / 2), mat, round_by=0.08),
        box(f"{name}_actuator", (1.2, 1.4, 1.0), (0, hinge_up, RADIUS - 0.1), materials["dark"], round_by=0.15),
    ]
    for index in range(1, 9):
        offset = -width / 2 + index * width / 9
        parts.append(box(f"{name}_slat_x{index}", (0.06, depth * 0.96, reach), (offset, hinge_up, start + reach / 2), mat, round_by=0.0))
    for index in range(1, 8):
        offset = start + index * reach / 8
        parts.append(box(f"{name}_slat_z{index}", (width, depth * 0.96, 0.06), (0, hinge_up, offset), mat, round_by=0.0))
    hinge = (0, hinge_up, RADIUS)
    fin = combine(name, parts, origin=hinge, parent=parent)
    hinge_point = around(RADIUS, angle, hinge_up)
    fin.location = point(*hinge_point) - point(0, 0, 0)
    turn(fin, "up", angle)
    return fin


def booster(name, variant):
    materials = palette()
    group = root(name)
    height = 71.0
    body = loft(f"{name}_shell", [
        (0.6, RADIUS - 0.05, RADIUS - 0.05, 0), (4.0, RADIUS, RADIUS, 0), (height - 2.0, RADIUS, RADIUS, 0),
        (height - 1.95, RADIUS - 0.08, RADIUS - 0.08, 0), (height, RADIUS - 0.08, RADIUS - 0.08, 0),
    ], materials["steel"], sides=64, axis="up")
    parts = [body]
    parts += ring_lines(f"{name}_weld", RADIUS + 0.01, 4.0, height - 2.0, 1.83, materials["frame"], minor=0.03)
    parts.append(cylinder(f"{name}_skirt_rim", RADIUS + 0.12, 0.5, (0, 0.85, 0), materials["dark"], sides=64, round_by=0.1))
    parts.append(cylinder(f"{name}_heatshield", RADIUS - 0.1, 0.2, (0, 2.7, 0), materials["dark"], sides=48))
    # Vented hot-stage ring: dark slots around the top 1.8 m.
    slots = 30 if variant == "a" else 18
    for index in range(slots):
        angle = 2 * math.pi * index / slots
        x, _, z = around(RADIUS - 0.02, angle, 0)
        slot = box(f"{name}_vent{index}", (0.35, 1.2, 0.2), (x, height - 1.0, z), materials["dark"], round_by=0.05)
        turn(slot, "up", angle)
        parts.append(slot)
    # Chines (raceways) on +-x, aft vents, catch pins under the fins.
    for sign in (-1, 1):
        parts.append(box(f"{name}_chine{sign}", (0.8, height - 12, 1.3), (sign * (RADIUS + 0.25), 4 + (height - 12) / 2, 0), materials["frame"], round_by=0.3))
        parts.append(box(f"{name}_pin{sign}", (1.6, 0.9, 1.2), (sign * (RADIUS + 0.7), height - 9.5, 0), materials["dark"], round_by=0.15))
        for vent in range(3):
            parts.append(box(f"{name}_aftvent{sign}{vent}", (0.3, 0.8, 1.4), (sign * (RADIUS + 0.05), 5.5 + vent * 1.6, 2.6), materials["dark"], round_by=0.08))
    parts.append(box(f"{name}_qd_plate", (2.2, 3.0, 0.4), (0, 2.2, -RADIUS - 0.15), materials["frame"], round_by=0.1))
    # 33 engines: 3 / 10 / 20 rings, gimballed centre and middle, fixed outer ring.
    for ring_radius, count, offset in ((1.0, 3, 0.0), (2.45, 10, 0.1), (3.8, 20, 0.05)):
        for index in range(count):
            x, _, z = around(ring_radius, 2 * math.pi * (index + offset) / count, 0)
            parts += engine(f"{name}_engine{ring_radius}_{index}", (x, 0.0, z), 0.62, 2.2, materials)
    parts.append(lamp(f"{name}_beacon", (0, height - 4.0, RADIUS + 0.05), materials["glow_white"], radius=0.18))
    combine(f"{name}_body", parts, parent=group)
    fin_angles = [math.radians(a) for a in ((45, 135, 225, 315) if variant == "a" else (40, 140, 270))]
    for index, angle in enumerate(fin_angles):
        grid_fin(f"{name}_fin_{index}", height - 7.0, angle, materials, group)
    return group


def flap(name, hinge, side, span, length, root_chord, tip_chord, materials, parent):
    """A flap plate standing out from the side on +-x, hinge line vertical along the barrel."""
    x0, up, forward = hinge
    outline = [(0, -length / 2), (span, -length / 2 + (root_chord - tip_chord) * 0.2), (span, length / 2 - (root_chord - tip_chord) * 0.8), (0, length / 2)]
    points = [(x0 + side * px, up + pu) for px, pu in outline]
    if side < 0:
        points.reverse()
    plate = slab(f"{name}_plate", points, 0.6, materials["tile"], plane="front", center=(0, 0, forward), round_by=0.2)
    actuator = box(f"{name}_hinge", (0.8, length * 0.8, 1.0), (x0 + side * 0.2, up, forward), materials["dark"], round_by=0.2)
    return combine(name, [plate, actuator], origin=hinge, parent=parent)


def ship(name, variant):
    materials = palette()
    group = root(name)
    barrel_top = 35.0
    height = 52.0
    sections = [(0.4, RADIUS - 0.05, RADIUS - 0.05, 0), (3.0, RADIUS, RADIUS, 0), (barrel_top, RADIUS, RADIUS, 0)]
    steps = 12
    for step in range(1, steps + 1):
        t = step / steps
        radius = RADIUS * max(0.06, (1 - t ** 1.9)) ** 0.62
        sections.append((barrel_top + t * (height - barrel_top - 0.4), radius, radius, 0))
    sections.append((height, 0, 0, 0))
    body = loft(f"{name}_shell", sections, materials["steel"], sides=64, axis="up")
    tiles = [(up, rx * 1.012 + 0.03, rz * 1.012 + 0.03, offset) for up, rx, rz, offset in sections[1:-1]]
    tiles.append((height - 0.2, 0.0, 0.0, 0))
    heat_shield = loft(f"{name}_tiles", tiles, materials["tile"], sides=64, axis="up",
                       keep_face=lambda cx, cu, cf: cf < -0.3 or (cu > height - 1.0))
    parts = [body, heat_shield]
    parts += ring_lines(f"{name}_weld", RADIUS + 0.01, 3.0, barrel_top, 1.83, materials["frame"], minor=0.03)
    for sign in (-1, 1):
        parts.append(box(f"{name}_chine{sign}", (0.7, barrel_top - 6, 1.0), (sign * (RADIUS + 0.2), 3 + (barrel_top - 6) / 2, 0), materials["frame"], round_by=0.25))
    parts.append(box(f"{name}_qd_plate", (2.0, 2.4, 0.4), (0, 3.2, -RADIUS - 0.2), materials["frame"], round_by=0.1))
    if variant == "cargo":
        door = loft(f"{name}_door", [(37.0, RADIUS * 0.96 + 0.06, RADIUS * 0.96 + 0.06, 0), (44.0, RADIUS * 0.7 + 0.06, RADIUS * 0.7 + 0.06, 0)],
                    materials["dark"], sides=64, axis="up", keep_face=lambda cx, cu, cf: cf > 1.0 and abs(cx) < 2.6)
        parts.append(door)
    elif variant == "crew":
        for index in range(9):
            angle = math.radians(-40 + index * 10)
            x, _, z = around(RADIUS * 0.93 + 0.05, angle, 0)
            window = box(f"{name}_window{index}", (0.7, 0.9, 0.12), (x, 37.5, z), materials["glass"], round_by=0.08)
            turn(window, "up", angle)
            parts.append(window)
    else:
        for sign in (-1, 1):
            parts.append(cylinder(f"{name}_vent{sign}", 0.25, 0.6, (sign * 2.0, 30.0, RADIUS + 0.1), materials["dark"], axis="forward", sides=10))
    for index in range(3):
        x, _, z = around(1.1, 2 * math.pi * index / 3, 0)
        parts += engine(f"{name}_sl{index}", (x, 0.2, z), 0.65, 2.0, materials)
        x, _, z = around(3.0, 2 * math.pi * (index + 0.5) / 3, 0)
        parts += engine(f"{name}_vac{index}", (x, 0.0, z), 1.15, 3.0, materials)
    parts.append(lamp(f"{name}_beacon", (0, 46.0, RADIUS * 0.75 + 0.1), materials["glow_white"], radius=0.15))
    combine(f"{name}_body", parts, parent=group)
    for sign, label in ((-1, "l"), (1, "r")):
        flap(f"{name}_flap_aft_{label}", (sign * (RADIUS + 0.1), 6.5, -1.2), sign, 4.3, 9.0, 9.0, 6.5, materials, group)
        flap(f"{name}_flap_fwd_{label}", (sign * (RADIUS * 0.82), 40.5, -1.0), sign, 2.8, 5.0, 5.0, 3.0, materials, group)
    return group


def build():
    reset_scene()
    booster("booster_a", "a")
    booster("booster_b", "b")
    ship("ship_crew", "crew")
    ship("ship_cargo", "cargo")
    ship("ship_tanker", "tanker")
    export("rocket.glb")
