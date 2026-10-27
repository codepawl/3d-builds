"""Process tools for the cleanroom bays, exported to tools.glb.

Every tool is a root empty `tool_<kind>_<variant>` facing +forward (its load ports on the
front, where the OHT lowers pods), sitting on y = 0, metres. Children:
  <root>_body          the static shell (one mesh)
  <root>_status        the signal-tower lamp, material `status`, recoloured by tool state
  <root>_portN         empty on each load port plate where a pod's bottom sits
  <root>_portN_door    pod door opener, pivot at its bottom hinge, rotates about x
plus the moving parts listed per tool (cluster robots, CMP heads and platens, wet-bench gantry).
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import anchor, box, combine, cylinder, export, material, reset_scene, root, sphere, turn  # noqa: E402
from parts import bolts, light_tower, load_port, palette, plate, screen, seams, vent  # noqa: E402

PORT_SEAT = 0.92


def ports(name, xs, forward, mats, group):
    parts = []
    for index, x in enumerate(xs):
        port_parts, _ = load_port(f"{name}_port{index}", (x, 0.0, forward), mats, group)
        parts += port_parts
        anchor(f"{name}_port{index}", (x, PORT_SEAT, forward), group)
    return parts


def finish(name, group, parts, tower_at, mats):
    tower_parts, lamp = light_tower(name, tower_at, mats)
    combine(f"{name}_body", parts + tower_parts, parent=group)
    combine(f"{name}_status", [lamp], origin=tower_at, parent=group)


def feet(prefix, width, depth, center_forward, mats):
    """Levelling feet under the four corners of a module."""
    parts = []
    for index, (side, end) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        parts.append(cylinder(f"{prefix}_foot{index}", 0.05, 0.08, (side * (width / 2 - 0.12), 0.04, center_forward + end * (depth / 2 - 0.12)), mats["steel"], sides=10))
    return parts


# --- lithography -------------------------------------------------------------------------------

def litho(name, mats, large):
    """A scanner with its coater/developer track in front. `large` is the bigger, taller
    generation with a light-source module on the left side."""
    group = root(name)
    width = 4.0 if large else 3.2
    height = 3.1 if large else 2.6
    scanner_depth = 6.4 if large else 4.8
    track_depth = 2.2
    scanner_center = -track_depth - scanner_depth / 2
    parts = [
        box(f"{name}_track", (width, 2.2, track_depth), (0, 1.15, -track_depth / 2 + 0.25), mats["shell"], 0.08),
        box(f"{name}_trackbase", (width - 0.1, 0.1, track_depth - 0.1), (0, 0.05, -track_depth / 2 + 0.25), mats["trim"], 0.02),
        box(f"{name}_scanner", (width, height, scanner_depth), (0, height / 2 + 0.05, scanner_center), mats["shell"], 0.14),
        box(f"{name}_skirt", (width - 0.08, 0.12, scanner_depth - 0.08), (0, 0.06, scanner_center), mats["trim"], 0.02),
        box(f"{name}_band", (width + 0.02, 0.16, scanner_depth * 0.9), (0, height * 0.72, scanner_center), mats["brand"], 0.03),
        # the yellow-lit wafer stage window on both sides
        box(f"{name}_stage_glow", (width + 0.03, 0.42, 1.6), (0, 1.25, scanner_center + scanner_depth * 0.2), mats["yellow"], 0.03),
        box(f"{name}_roofdeck", (width - 0.6, 0.12, scanner_depth - 0.8), (0, height + 0.1, scanner_center), mats["panel"], 0.04),
    ]
    for index in range(2 if large else 1):
        duct_forward = scanner_center - scanner_depth * 0.25 + index * 1.2
        parts.append(cylinder(f"{name}_exhaust{index}", 0.22, 0.6, (width * 0.25, height + 0.4, duct_forward), mats["steel"], sides=20, round_by=0.03))
        parts.append(cylinder(f"{name}_exhaustcap{index}", 0.26, 0.06, (width * 0.25, height + 0.73, duct_forward), mats["trim"], sides=20, round_by=0.02))
    for side in (-1, 1):
        face = "+x" if side > 0 else "-x"
        parts += seams(f"{name}_seam{side}", face, (side * width / 2, height / 2 + 0.05, scanner_center), scanner_depth, height * 0.9, 5, mats)
        parts += vent(f"{name}_vent{side}", face, (side * width / 2, 0.55, scanner_center - scanner_depth * 0.3), 1.2, 0.5, mats)
    parts += seams(f"{name}_trackseam", "+f", (0, 1.15, 0.25), width, 2.0, 4, mats)
    parts += plate(f"{name}_sign", "+f", (-width * 0.3, 1.95, 0.25), 0.7, 0.24, mats)
    parts += screen(f"{name}_hmi", "+f", (width * 0.3, 1.45, 0.25), mats)
    parts += bolts(f"{name}_hmi", "+f", (width * 0.3, 1.45, 0.25), 0.5, 0.38, mats)
    if large:
        source_forward = scanner_center - scanner_depth * 0.15
        parts += [
            box(f"{name}_source", (1.6, 2.4, 3.2), (-width / 2 - 0.95, 1.25, source_forward), mats["panel"], 0.12),
            box(f"{name}_sourceband", (1.62, 0.14, 3.0), (-width / 2 - 0.95, 2.05, source_forward), mats["brand"], 0.03),
            cylinder(f"{name}_beampipe", 0.18, 0.5, (-width / 2 - 0.05, 1.7, source_forward), mats["steel"], axis="x", sides=18, round_by=0.02),
        ]
        parts += vent(f"{name}_sourcevent", "-x", (-width / 2 - 1.75, 1.0, source_forward), 2.0, 0.8, mats, slats=8)
        for index in range(3):
            parts.append(cylinder(f"{name}_coolant{index}", 0.05, 2.0, (-width / 2 - 0.4 + index * 0.18, 2.6, source_forward + 0.8), mats["steel"], axis="forward", sides=10))
    port_xs = [-0.6, 0.6] if not large else [-0.9, 0.0, 0.9]
    parts += ports(name, port_xs, 0.75, mats, group)
    finish(name, group, parts, (width / 2 - 0.25, 2.25, 0.0), mats)
    return group


# --- cluster tools (etch, deposition) ----------------------------------------------------------

def cluster(name, mats, kind, chamber_count, robot_mats):
    """An equipment front end with load ports, two load locks and a hexagonal transfer chamber
    with process chambers around it. Etch chambers carry an RF match box on a flat lid,
    deposition chambers a domed lid with a showerhead gas line. The transfer robot is
    `<root>_robot` (pivot at the chamber centre, turns about up), seen through a glass lid."""
    group = root(name)
    hub_forward = -2.9
    hub_radius = 1.0
    parts = [
        box(f"{name}_efem", (3.0, 2.2, 1.2), (0, 1.1, -0.6), mats["shell"], 0.07),
        box(f"{name}_efemfilter", (2.9, 0.14, 1.1), (0, 2.26, -0.6), mats["panel"], 0.03),
        box(f"{name}_efemband", (3.02, 0.12, 1.22), (0, 1.75, -0.6), mats["brand"], 0.02),
        cylinder(f"{name}_hub", hub_radius, 1.0, (0, 1.05, hub_forward), mats["panel"], sides=6, round_by=0.05),
        cylinder(f"{name}_hublid", hub_radius * 0.92, 0.04, (0, 1.57, hub_forward), mats["glass"], sides=6),
        cylinder(f"{name}_hubframe", hub_radius * 0.6, 0.55, (0, 0.28, hub_forward), mats["trim"], sides=6),
    ]
    for side in (-1, 1):
        parts.append(box(f"{name}_loadlock{side}", (0.75, 0.8, 0.9), (side * 0.48, 1.05, -1.65), mats["steel"], 0.05))
        parts.append(box(f"{name}_loadlockframe{side}", (0.6, 0.65, 0.8), (side * 0.48, 0.33, -1.65), mats["trim"], 0.03))
    # Chambers fan symmetrically around the back of the hub; the load locks take the front.
    spread = math.radians(160 if chamber_count == 3 else 240)
    step = spread / (chamber_count - 1)
    angles = [math.pi - spread / 2 + step * index for index in range(chamber_count)]
    for index, angle in enumerate(angles):
        direction_x = math.sin(angle)
        direction_forward = math.cos(angle)
        center_x = direction_x * 2.05
        center_forward = hub_forward + direction_forward * 2.05
        chamber = box(f"{name}_chamber{index}", (1.2, 1.1, 1.2), (center_x, 1.05, center_forward), mats["shell"], 0.08)
        turn(chamber, "up", angle)
        frame = box(f"{name}_chamberframe{index}", (1.0, 0.5, 1.0), (center_x, 0.25, center_forward), mats["trim"], 0.03)
        turn(frame, "up", angle)
        slit = box(f"{name}_slit{index}", (0.5, 0.35, 0.5), (direction_x * 1.25, 1.05, hub_forward + direction_forward * 1.25), mats["steel"], 0.03)
        turn(slit, "up", angle)
        parts += [chamber, frame, slit]
        if kind == "etch":
            parts.append(cylinder(f"{name}_lid{index}", 0.5, 0.14, (center_x, 1.67, center_forward), mats["steel"], sides=28, round_by=0.03))
            match_box = box(f"{name}_match{index}", (0.5, 0.36, 0.42), (center_x, 1.92, center_forward), mats["brand"], 0.04)
            turn(match_box, "up", angle)
            parts.append(match_box)
            parts.append(cylinder(f"{name}_feed{index}", 0.05, 0.3, (center_x + direction_x * 0.3, 2.0, center_forward + direction_forward * 0.3), mats["steel"], sides=10))
        else:
            parts.append(cylinder(f"{name}_lidring{index}", 0.52, 0.08, (center_x, 1.64, center_forward), mats["steel"], sides=28, round_by=0.02))
            parts.append(sphere(f"{name}_dome{index}", 0.48, (center_x, 1.66, center_forward), mats["panel"], scale=(1, 0.6, 1), segments=24))
            parts.append(cylinder(f"{name}_gasline{index}", 0.035, 0.5, (center_x, 2.15, center_forward), mats["steel"], sides=10))
            parts.append(sphere(f"{name}_valve{index}", 0.07, (center_x, 2.4, center_forward), mats["brand"], segments=12))
        gas_box = box(f"{name}_gasbox{index}", (0.5, 0.9, 0.35), (direction_x * 2.95, 0.75, hub_forward + direction_forward * 2.95), mats["panel"], 0.04)
        turn(gas_box, "up", angle)
        parts.append(gas_box)
    parts += seams(f"{name}_efemseam", "+f", (0, 1.1, 0.0), 3.0, 1.9, 3, mats)
    parts += plate(f"{name}_sign", "+f", (-0.95, 1.95, 0.0), 0.6, 0.2, mats)
    parts += screen(f"{name}_hmi", "+f", (1.05, 1.95, 0.0), mats, width=0.36, height=0.24)
    port_xs = [-0.9, 0.0, 0.9] if chamber_count == 4 else [-0.6, 0.6]
    parts += ports(name, port_xs, 0.5, mats, group)
    finish(name, group, parts, (1.3, 2.33, -0.2), mats)
    robot_parts = [
        cylinder(f"{name}_robotbase", 0.22, 0.16, (0, 1.25, hub_forward), robot_mats, sides=20, round_by=0.03),
        box(f"{name}_robotarm1", (0.16, 0.08, 0.55), (0, 1.36, hub_forward + 0.25), robot_mats, 0.03),
        box(f"{name}_robotarm2", (0.14, 0.07, 0.45), (0, 1.43, hub_forward + 0.62), robot_mats, 0.03),
        box(f"{name}_robotblade", (0.3, 0.02, 0.3), (0, 1.47, hub_forward + 0.88), mats["steel"], 0.008),
    ]
    combine(f"{name}_robot", robot_parts, origin=(0, 1.25, hub_forward), parent=group)
    return group


# --- implant, furnace, CMP, metrology, wet bench -----------------------------------------------

def implanter(name, mats):
    """An ion implanter: high-voltage terminal at the back, analyser magnet and beamline running
    forward to the end station with its load ports."""
    group = root(name)
    parts = [
        box(f"{name}_endstation", (3.0, 2.3, 2.0), (0, 1.15, -1.0), mats["shell"], 0.08),
        box(f"{name}_endband", (3.02, 0.14, 2.02), (0, 1.85, -1.0), mats["brand"], 0.02),
        cylinder(f"{name}_beamline", 0.28, 2.6, (0, 1.4, -3.3), mats["steel"], axis="forward", sides=24, round_by=0.03),
        box(f"{name}_beamstand", (0.8, 1.1, 2.2), (0, 0.55, -3.3), mats["trim"], 0.04),
        box(f"{name}_magnet", (1.6, 1.4, 1.4), (0.3, 1.4, -5.0), mats["brand"], 0.14),
        box(f"{name}_magnetcore", (1.7, 0.5, 1.0), (0.3, 1.4, -5.0), mats["trim"], 0.06),
        box(f"{name}_terminal", (2.8, 2.6, 2.4), (0.6, 1.3, -7.0), mats["panel"], 0.12),
        box(f"{name}_terminalskirt", (2.7, 0.12, 2.3), (0.6, 0.06, -7.0), mats["trim"], 0.02),
    ]
    for index in range(4):
        parts.append(cylinder(f"{name}_flange{index}", 0.34, 0.06, (0, 1.4, -2.2 - index * 0.7), mats["trim"], axis="forward", sides=24, round_by=0.01))
    for index in range(3):
        parts.append(cylinder(f"{name}_insulator{index}", 0.12, 0.5, (-0.3 + index * 0.45, 2.85, -7.0), mats["shell"], sides=16, round_by=0.04))
    parts += vent(f"{name}_termvent", "+x", (2.0, 1.2, -7.0), 1.8, 1.4, mats, slats=9)
    parts += seams(f"{name}_termseam", "-x", (-0.8, 1.3, -7.0), 2.4, 2.4, 3, mats)
    parts += seams(f"{name}_endseam", "+f", (0, 1.15, 0.0), 3.0, 2.0, 3, mats)
    parts += plate(f"{name}_sign", "+f", (-0.9, 1.95, 0.0), 0.6, 0.2, mats)
    parts += screen(f"{name}_hmi", "+f", (0.95, 1.45, 0.0), mats)
    parts += ports(name, [-0.6, 0.6], 0.5, mats, group)
    finish(name, group, parts + feet(f"{name}_end", 3.0, 2.0, -1.0, mats), (1.25, 2.3, -0.2), mats)
    return group


def furnace(name, mats, tube_count):
    """A vertical diffusion/anneal furnace: a pod stocker front with a window onto its shelves,
    and tall heater towers behind with exhaust stacks."""
    group = root(name)
    width = 1.4 * tube_count + 0.6
    # The pod stocker front is open behind its window: sill, header, side posts and a back wall.
    window_width = width * 0.6
    post_width = (width - window_width) / 2
    parts = [
        box(f"{name}_sill", (width, 1.25, 1.6), (0, 0.625, -0.8), mats["shell"], 0.08),
        box(f"{name}_header", (width, 0.4, 1.6), (0, 2.4, -0.8), mats["shell"], 0.08),
        box(f"{name}_backwall", (width, 2.6, 1.0), (0, 1.3, -1.1), mats["shell"], 0.08),
        box(f"{name}_window", (window_width, 0.95, 0.04), (0, 1.72, -0.02), mats["glass"], 0.02),
        box(f"{name}_band", (width + 0.02, 0.14, 1.62), (0, 2.42, -0.8), mats["brand"], 0.02),
    ]
    for side in (-1, 1):
        parts.append(box(f"{name}_post{side}", (post_width, 2.6, 1.6), (side * (window_width + post_width) / 2, 1.3, -0.8), mats["shell"], 0.06))
    slot_count = int(window_width / 0.42)
    for shelf in range(2):
        parts.append(box(f"{name}_shelf{shelf}", (window_width, 0.03, 0.5), (0, 1.285 + shelf * 0.45, -0.35), mats["steel"], 0.0))
        for slot in range(slot_count):
            pod_x = (slot - (slot_count - 1) / 2) * 0.42
            parts.append(box(f"{name}_shelfpod{shelf}_{slot}", (0.36, 0.3, 0.32), (pod_x, 1.45 + shelf * 0.45, -0.35), mats["panel"], 0.04))
    for index in range(tube_count):
        tower_x = -width / 2 + 0.7 + index * 1.4 + 0.3 * (tube_count == 1)
        parts += [
            box(f"{name}_tower{index}", (1.2, 3.4, 1.8), (tower_x, 1.7, -2.6), mats["panel"], 0.1),
            cylinder(f"{name}_heater{index}", 0.42, 0.5, (tower_x, 3.55, -2.6), mats["steel"], sides=24, round_by=0.04),
            cylinder(f"{name}_stack{index}", 0.09, 0.5, (tower_x + 0.3, 3.9, -3.1), mats["steel"], sides=12),
        ]
        parts += vent(f"{name}_towervent{index}", "+u", (tower_x, 3.4, -2.0), 0.8, 0.4, mats, slats=5)
    parts += seams(f"{name}_seam", "+f", (0, 1.3, 0.0), width, 2.4, tube_count + 1, mats)
    parts += plate(f"{name}_sign", "+f", (-width / 2 + 0.5, 0.85, 0.0), 0.6, 0.2, mats)
    parts += screen(f"{name}_hmi", "+f", (width / 2 - 0.45, 1.0, 0.0), mats)
    parts += ports(name, [-0.6, 0.6], 0.5, mats, group)
    finish(name, group, parts, (width / 2 - 0.2, 2.6, -0.3), mats)
    return group


def cmp(name, mats, platen_count):
    """A chemical-mechanical polisher: front end with ports, an open polishing deck behind a low
    glass rim. Each `<root>_platenN` spins about up at its centre; each `<root>_headN`
    (carrier on its arm) also spins about up at the same centre."""
    group = root(name)
    deck_depth = 2.6
    width = 1.3 * platen_count + 0.5
    deck_forward = -1.4 - deck_depth / 2
    parts = [
        box(f"{name}_efem", (width, 2.0, 1.4), (0, 1.0, -0.7), mats["shell"], 0.07),
        box(f"{name}_efemband", (width + 0.02, 0.14, 1.42), (0, 1.6, -0.7), mats["brand"], 0.02),
        box(f"{name}_deck", (width, 1.1, deck_depth), (0, 0.55, deck_forward), mats["shell"], 0.08),
        box(f"{name}_tub", (width - 0.2, 0.06, deck_depth - 0.2), (0, 1.12, deck_forward), mats["trim"], 0.02),
        box(f"{name}_slurry", (0.5, 0.5, 0.5), (width / 2 - 0.35, 1.35, deck_forward - deck_depth / 2 + 0.35), mats["panel"], 0.05),
    ]
    for side in (-1, 1):
        parts.append(box(f"{name}_rimx{side}", (0.04, 0.5, deck_depth), (side * (width / 2 - 0.02), 1.35, deck_forward), mats["glass"], 0.01))
    parts.append(box(f"{name}_rimback", (width, 0.5, 0.04), (0, 1.35, deck_forward - deck_depth / 2 + 0.02), mats["glass"], 0.01))
    for index in range(platen_count):
        platen_x = -width / 2 + 0.9 + index * 1.3
        center = (platen_x, 1.15, deck_forward + 0.3)
        combine(f"{name}_platen{index}", [
            cylinder(f"{name}_pad{index}", 0.55, 0.06, (platen_x, 1.18, deck_forward + 0.3), mats["brand"], sides=40, round_by=0.01),
            cylinder(f"{name}_padgroove{index}", 0.3, 0.065, (platen_x, 1.18, deck_forward + 0.3), mats["panel"], sides=40),
            cylinder(f"{name}_padhub{index}", 0.08, 0.07, (platen_x, 1.18, deck_forward + 0.3), mats["steel"], sides=16),
        ], origin=center, parent=group)
        combine(f"{name}_head{index}", [
            cylinder(f"{name}_carrier{index}", 0.17, 0.12, (platen_x + 0.25, 1.28, deck_forward + 0.3), mats["steel"], sides=24, round_by=0.02),
            cylinder(f"{name}_spindle{index}", 0.05, 0.45, (platen_x + 0.25, 1.55, deck_forward + 0.3), mats["steel"], sides=12),
            box(f"{name}_arm{index}", (0.44, 0.12, 0.16), (platen_x + 0.08, 1.8, deck_forward + 0.3), mats["trim"], 0.04),
        ], origin=center, parent=group)
        parts.append(cylinder(f"{name}_conditioner{index}", 0.05, 0.4, (platen_x - 0.45, 1.35, deck_forward - 0.25), mats["steel"], sides=10))
    parts += seams(f"{name}_seam", "+f", (0, 1.0, 0.0), width, 1.8, 3, mats)
    parts += plate(f"{name}_sign", "+f", (-width / 2 + 0.45, 1.75, 0.0), 0.55, 0.2, mats)
    parts += screen(f"{name}_hmi", "+f", (width / 2 - 0.4, 1.35, 0.0), mats)
    parts += vent(f"{name}_vent", "+x", (width / 2, 0.55, deck_forward), 1.6, 0.5, mats)
    parts += ports(name, [-0.6, 0.6], 0.5, mats, group)
    finish(name, group, parts, (width / 2 - 0.2, 2.0, -0.2), mats)
    return group


def metrology(name, mats, inspection):
    """A compact metrology tool with a measuring column, or (`inspection`) a wider optical
    inspection tool with a dome and a second screen."""
    group = root(name)
    width = 2.4 if inspection else 1.7
    parts = [
        box(f"{name}_body", (width, 1.9, 2.0), (0, 0.95, -1.0), mats["shell"], 0.08),
        box(f"{name}_band", (width + 0.02, 0.12, 2.02), (0, 1.55, -1.0), mats["brand"], 0.02),
        box(f"{name}_window", (width * 0.5, 0.4, 0.04), (0, 1.15, 0.0), mats["glass"], 0.02),
        box(f"{name}_windowglow", (width * 0.46, 0.06, 0.03), (0, 1.0, -0.02), mats["lamp"], 0.0),
    ]
    if inspection:
        parts.append(sphere(f"{name}_dome", 0.55, (0, 1.9, -1.2), mats["panel"], scale=(1, 0.55, 1), segments=24))
        parts.append(cylinder(f"{name}_domering", 0.58, 0.06, (0, 1.92, -1.2), mats["trim"], sides=32, round_by=0.01))
        parts += screen(f"{name}_hmi2", "+x", (width / 2, 1.4, -0.6), mats)
    else:
        parts.append(cylinder(f"{name}_column", 0.22, 0.7, (0.2, 2.25, -1.3), mats["panel"], sides=24, round_by=0.04))
        parts.append(cylinder(f"{name}_columncap", 0.25, 0.08, (0.2, 2.62, -1.3), mats["brand"], sides=24, round_by=0.02))
    parts += vent(f"{name}_vent", "-x", (-width / 2, 0.5, -1.0), 1.2, 0.4, mats)
    parts += plate(f"{name}_sign", "+f", (-width / 2 + 0.35, 1.7, 0.0), 0.4, 0.14, mats)
    parts += screen(f"{name}_hmi", "+f", (width / 2 - 0.3, 1.5, 0.0), mats, width=0.32, height=0.22)
    port_xs = [-0.6, 0.6] if inspection else [0.0]
    parts += ports(name, port_xs, 0.5, mats, group)
    finish(name, group, parts + feet(name, width, 2.0, -1.0, mats), (width / 2 - 0.15, 1.9, -1.8), mats)
    return group


def wet_bench(name, mats, tank_count):
    """A wet bench running along x: chemical tanks under an exhaust hood, a load station with a
    port at the -x end. `<root>_gantry` is the wafer-carrier robot; pivot at its foot on the
    rail, slides along x across the tanks."""
    group = root(name)
    length = 1.0 * tank_count + 1.6
    start_x = -length / 2
    parts = [
        box(f"{name}_cabinet", (length, 0.95, 1.6), (0, 0.475, -0.8), mats["shell"], 0.06),
        box(f"{name}_deck", (length, 0.06, 1.6), (0, 0.98, -0.8), mats["panel"], 0.02),
        box(f"{name}_backwall", (length, 1.4, 0.2), (0, 1.7, -1.5), mats["shell"], 0.05),
        box(f"{name}_hood", (length, 0.3, 1.1), (0, 2.4, -1.05), mats["panel"], 0.06),
        box(f"{name}_hoodglow", (length - 0.3, 0.03, 0.12), (0, 2.24, -0.6), mats["lamp"], 0.0),
        box(f"{name}_rail", (length - 0.2, 0.06, 0.1), (0, 2.1, -1.35), mats["steel"], 0.02),
        box(f"{name}_band", (length + 0.02, 0.12, 1.62), (0, 0.8, -0.8), mats["brand"], 0.02),
        cylinder(f"{name}_exhaust", 0.2, 0.7, (length / 2 - 0.4, 2.9, -1.2), mats["steel"], sides=18, round_by=0.03),
    ]
    tank_colours = ["#78c6e8", "#9fe0d0", "#c8d2ff", "#78c6e8", "#b8e8f8"]
    for index in range(tank_count):
        tank_x = start_x + 1.5 + index * 1.0
        parts.append(box(f"{name}_tank{index}", (0.8, 0.12, 0.9), (tank_x, 1.0, -0.8), mats["trim"], 0.02))
        liquid = material(f"liquid{index}", tank_colours[index % len(tank_colours)], roughness=0.05)
        parts.append(box(f"{name}_liquid{index}", (0.68, 0.04, 0.78), (tank_x, 1.04, -0.8), liquid, 0.0))
    parts += vent(f"{name}_vent", "+f", (length / 4, 0.45, 0.0), length / 2 - 0.4, 0.4, mats, slats=5)
    parts += seams(f"{name}_seam", "+f", (0, 0.47, 0.0), length, 0.9, tank_count + 1, mats)
    parts += plate(f"{name}_sign", "+f", (-length / 4, 0.62, 0.0), 0.6, 0.2, mats)
    parts += screen(f"{name}_hmi", "-x", (-length / 2, 1.5, -0.8), mats)
    parts += ports(name, [start_x + 0.4], 0.5, mats, group)
    finish(name, group, parts, (length / 2 - 0.15, 2.55, -0.4), mats)
    foot = (start_x + 1.5, 2.13, -1.35)
    combine(f"{name}_gantry", [
        box(f"{name}_carriage", (0.4, 0.2, 0.2), (foot[0], 2.23, -1.35), mats["brand"], 0.04),
        box(f"{name}_boom", (0.1, 0.9, 0.1), (foot[0], 1.75, -1.15), mats["steel"], 0.02),
        box(f"{name}_basket", (0.5, 0.3, 0.1), (foot[0], 1.3, -1.0), mats["trim"], 0.02),
    ], origin=foot, parent=group)
    return group


def main():
    reset_scene()
    mats = palette()
    robot = material("robot", "#e9edf2", roughness=0.3, metallic=0.4)
    litho("tool_litho_a", mats, large=False)
    litho("tool_litho_b", mats, large=True)
    cluster("tool_etch_a", mats, "etch", 4, robot)
    cluster("tool_etch_b", mats, "etch", 3, robot)
    cluster("tool_dep_a", mats, "dep", 4, robot)
    cluster("tool_dep_b", mats, "dep", 3, robot)
    implanter("tool_implant_a", mats)
    furnace("tool_furnace_a", mats, 2)
    furnace("tool_furnace_b", mats, 1)
    cmp("tool_cmp_a", mats, 3)
    cmp("tool_cmp_b", mats, 2)
    metrology("tool_metro_a", mats, inspection=False)
    metrology("tool_metro_b", mats, inspection=True)
    wet_bench("tool_wet_a", mats, 4)
    wet_bench("tool_wet_b", mats, 3)
    export("tools.glb")


main()
