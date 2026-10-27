"""ED furniture and equipment: furniture.glb (refs/nurses_station.md, refs/waiting_room.md, refs/lab_analyzer.md).

Roots sit on y = 0, origin on the floor at the footprint centre, front (staff or patient side) to +forward.
- triage_desk (1.8 x 0.8 m, two-sided booth with screen and patient chair), nurses_station (L counter 4.0 x 2.4 m,
  four monitors, tracking board; <root>_board is the tracking board screen, `glow_screen`).
- seats_row3, seats_row4 (beam seating, 0.58 m per place), side_table, checkin_kiosk.
- cubicle (2.6 x 3.0 m bay: headwall with gas outlets and monitor, low partitions, <root>_curtain on the open
  front, hinge at x = +1.3 so the app can scale x to draw it), resus_bay (3.6 x 4.0 m: headwall, overhead light on a
  stand, ventilator, monitor tower), both with <root>_status (bay state lamp, material `status`).
- crash_cart, monitor_stand, iv_pole, workstation_cart, lab_analyzer (1.5 x 0.8 x 1.2 m with <root>_rotor spinning
  about up), lab_bench (centrifuge with <root>_lid hinge, microscope), sign_plate_a/b (blank emissive plates, no text).
"""
import math

from lib import box, combine, cylinder, export, material, reset_scene, root
from parts import caster, palette, screen, vent


def chair(prefix, mats, center, facing=1):
    x, _, forward = center
    upholstery = material("chair_dark", "#3a4250", roughness=0.8)
    return [
        box(f"{prefix}_seat", (0.46, 0.07, 0.44), (x, 0.47, forward), upholstery, 0.035),
        box(f"{prefix}_back", (0.42, 0.45, 0.06), (x, 0.76, forward - facing * 0.22), upholstery, 0.035),
        cylinder(f"{prefix}_post", 0.03, 0.38, (x, 0.24, forward), mats["steel"], sides=10),
        box(f"{prefix}_foot_a", (0.55, 0.03, 0.05), (x, 0.04, forward), mats["dark"], 0.01),
        box(f"{prefix}_foot_b", (0.05, 0.03, 0.55), (x, 0.04, forward), mats["dark"], 0.01),
    ]


def counter(prefix, mats, size, center, front_colour):
    """Station counter: body with recessed panel joints, work top, raised transaction ledge on the front."""
    width, depth = size
    x, _, forward = center
    parts = [
        box(f"{prefix}_body", (width, 0.72, depth), (x, 0.36, forward), mats["white"], 0.03),
        box(f"{prefix}_kick", (width - 0.04, 0.08, depth - 0.04), (x, 0.04, forward), mats["dark"], 0.01),
        box(f"{prefix}_top", (width + 0.04, 0.04, depth + 0.04), (x, 0.74, forward), mats["wood"], 0.015),
        box(f"{prefix}_ledge_wall", (width, 0.36, 0.1), (x, 0.92, forward + depth / 2 - 0.05), front_colour, 0.02),
        box(f"{prefix}_ledge", (width + 0.06, 0.04, 0.3), (x, 1.12, forward + depth / 2 - 0.05), mats["wood"], 0.015),
    ]
    joints = max(1, int(width / 0.9))
    for index in range(1, joints):
        joint_x = x - width / 2 + width * index / joints
        parts.append(box(f"{prefix}_joint{index}", (0.012, 0.6, 0.012), (joint_x, 0.4, forward + depth / 2 + 0.001), mats["panel"], 0.0))
    return parts


def triage_desk(mats):
    name = "triage_desk"
    group = root(name)
    parts = counter(name, mats, (1.8, 0.75), (0, 0, 0), mats["brand"])
    parts += screen(f"{name}_monitor", (0.5, 0.32, 0.03), (0.3, 1.0, -0.15), mats)
    parts += [
        box(f"{name}_monitor_stand", (0.05, 0.2, 0.05), (0.3, 0.84, -0.18), mats["dark"], 0.01),
        box(f"{name}_keyboard", (0.4, 0.02, 0.14), (0.3, 0.77, 0.0), mats["dark"], 0.006),
        box(f"{name}_glass_screen", (1.6, 0.5, 0.012), (0, 1.39, 0.33), mats["glass_light"], 0.004),
        box(f"{name}_bp_cuff_unit", (0.18, 0.22, 0.16), (-0.55, 0.87, -0.1), mats["plastic"], 0.03),
        box(f"{name}_thermometer", (0.06, 0.12, 0.06), (-0.3, 0.82, -0.1), mats["brand"], 0.02),
        box(f"{name}_queue_lamp", (0.3, 0.08, 0.04), (-0.55, 1.2, 0.28), mats["light_green"], 0.02),
    ]
    parts += chair(f"{name}_staff_chair", mats, (0.2, 0, -0.75), facing=-1)
    parts += chair(f"{name}_patient_chair", mats, (-0.2, 0, 0.85), facing=1)
    combine(f"{name}_body", parts, parent=group)
    return group


def nurses_station(mats):
    name = "nurses_station"
    group = root(name)
    parts = counter(f"{name}_long", mats, (4.0, 0.8), (0, 0, 0), mats["brand"])
    parts += counter(f"{name}_short", mats, (0.8, 1.6), (-1.6, 0, -1.2), mats["brand"])
    for index, x in enumerate((-1.2, -0.2, 0.8, 1.6)):
        parts += screen(f"{name}_monitor{index}", (0.48, 0.3, 0.03), (x, 1.0, -0.2), mats)
        parts += [box(f"{name}_stand{index}", (0.05, 0.2, 0.05), (x, 0.84, -0.23), mats["dark"], 0.01),
                  box(f"{name}_keys{index}", (0.4, 0.02, 0.14), (x, 0.77, -0.02), mats["dark"], 0.006)]
    for index, x in enumerate((-0.7, 0.3, 1.3)):
        parts += chair(f"{name}_chair{index}", mats, (x, 0, -0.85), facing=-1)
    parts += [
        box(f"{name}_phone", (0.18, 0.06, 0.2), (0.25, 0.79, -0.1), mats["dark"], 0.02),
        box(f"{name}_chart_rack", (0.5, 0.35, 0.25), (-1.6, 0.94, -1.5), mats["grey"], 0.02),
        box(f"{name}_printer", (0.4, 0.2, 0.35), (-1.6, 0.86, -0.7), mats["plastic"], 0.04),
        box(f"{name}_board_post", (0.1, 2.0, 0.1), (2.3, 1.0, -0.8), mats["grey"], 0.02),
        box(f"{name}_board_frame", (1.3, 0.75, 0.06), (2.3, 2.0, -0.8), mats["dark"], 0.03),
    ]
    combine(f"{name}_body", parts, parent=group)
    combine(f"{name}_board", [box(f"{name}_board_face", (1.2, 0.65, 0.01), (2.3, 2.0, -0.765), mats["screen"], 0.0)],
            origin=(2.3, 2.0, -0.765), parent=group)
    return group


def seats_row(name, mats, places, colour):
    group = root(name)
    seat = material(f"seat_{colour.lstrip('#')}", colour, roughness=0.85)
    pitch = 0.58
    span = pitch * places
    parts = [box(f"{name}_beam", (span, 0.06, 0.08), (0, 0.33, -0.05), mats["steel"], 0.02)]
    for leg_x in (-span / 2 + 0.25, span / 2 - 0.25):
        parts += [box(f"{name}_leg{leg_x:.2f}", (0.06, 0.32, 0.06), (leg_x, 0.17, -0.05), mats["steel"], 0.015),
                  box(f"{name}_foot{leg_x:.2f}", (0.08, 0.03, 0.55), (leg_x, 0.015, -0.05), mats["dark"], 0.01)]
    for index in range(places):
        x = -span / 2 + pitch * (index + 0.5)
        parts += [
            box(f"{name}_seat{index}", (0.5, 0.08, 0.46), (x, 0.43, 0.0), seat, 0.035),
            box(f"{name}_back{index}", (0.5, 0.42, 0.06), (x, 0.7, -0.24), seat, 0.035),
            box(f"{name}_shell{index}", (0.5, 0.44, 0.03), (x, 0.69, -0.28), mats["dark"], 0.012),
        ]
    for index in range(places + 1):
        x = -span / 2 + pitch * index
        parts += [box(f"{name}_arm{index}", (0.05, 0.03, 0.42), (x, 0.64, -0.02), mats["dark"], 0.012),
                  box(f"{name}_arm_post{index}", (0.03, 0.2, 0.03), (x, 0.53, 0.12), mats["steel"], 0.008)]
    combine(f"{name}_body", parts, parent=group)
    return group


def side_table(mats):
    group = root("side_table")
    parts = [box("side_table_top", (0.5, 0.04, 0.5), (0, 0.5, 0), mats["wood"], 0.015),
             box("side_table_leg", (0.06, 0.48, 0.06), (0, 0.25, 0), mats["steel"], 0.01),
             box("side_table_foot", (0.4, 0.02, 0.4), (0, 0.01, 0), mats["dark"], 0.008),
             box("side_table_leaflets", (0.2, 0.03, 0.28), (0.05, 0.535, 0.02), mats["sheet"], 0.005)]
    combine("side_table_body", parts, parent=group)
    return group


def checkin_kiosk(mats):
    name = "checkin_kiosk"
    group = root(name)
    parts = [
        box(f"{name}_column", (0.5, 1.2, 0.3), (0, 0.6, 0), mats["white"], 0.06),
        box(f"{name}_head", (0.56, 0.45, 0.12), (0, 1.35, 0.06), mats["brand"], 0.04),
        box(f"{name}_printer_slot", (0.18, 0.015, 0.02), (0, 1.0, 0.155), mats["dark"], 0.004),
        box(f"{name}_base", (0.6, 0.04, 0.42), (0, 0.02, 0.02), mats["grey"], 0.015),
    ]
    parts += screen(f"{name}_screen", (0.44, 0.34, 0.02), (0, 1.35, 0.12), mats)
    combine(f"{name}_body", parts, parent=group)
    return group


def headwall(prefix, mats, width, forward):
    """Bed-head service panel: rail, gas outlets (oxygen green, air black-white, vacuum yellow), sockets, light."""
    parts = [
        box(f"{prefix}_panel", (width, 0.32, 0.08), (0, 1.45, forward), mats["panel"], 0.03),
        box(f"{prefix}_rail", (width - 0.1, 0.04, 0.04), (0, 1.1, forward + 0.05), mats["steel"], 0.01),
        box(f"{prefix}_reading_light", (width - 0.2, 0.06, 0.06), (0, 1.66, forward + 0.03), mats["light_white"], 0.02),
    ]
    for index, colour in enumerate(("#3aa46a", "#2b313b", "#f2c94c", "#3aa46a")):
        parts.append(cylinder(f"{prefix}_gas{index}", 0.03, 0.04, (-0.45 + index * 0.13, 1.45, forward + 0.06),
                              material(f"gas_{colour.lstrip('#')}", colour, roughness=0.4), axis="forward", sides=12))
    for index in range(3):
        parts.append(box(f"{prefix}_socket{index}", (0.08, 0.08, 0.02), (0.25 + index * 0.12, 1.45, forward + 0.05), mats["white"], 0.01))
    return parts


def bay_monitor(prefix, mats, center):
    x, up, forward = center
    parts = screen(f"{prefix}_monitor", (0.38, 0.28, 0.06), center, mats)
    parts.append(box(f"{prefix}_monitor_arm", (0.05, 0.05, 0.25), (x, up - 0.05, forward - 0.15), mats["grey"], 0.015))
    return parts


def cubicle(mats):
    name = "cubicle"
    group = root(name)
    width, depth = 2.6, 3.0
    back = -depth / 2
    partition = material("partition", "#dfe8f1", roughness=0.5)
    parts = [
        box(f"{name}_floor", (width, 0.02, depth), (0, 0.01, 0), mats["floor"], 0.005),
        box(f"{name}_back_wall", (width, 1.9, 0.1), (0, 0.95, back + 0.05), partition, 0.03),
        box(f"{name}_side_wall", (0.08, 1.2, depth - 0.1), (-width / 2 + 0.04, 0.6, 0.05), partition, 0.03),
        box(f"{name}_side_cap", (0.1, 0.04, depth - 0.1), (-width / 2 + 0.04, 1.21, 0.05), mats["brand"], 0.015),
        box(f"{name}_curtain_track", (width, 0.03, 0.04), (0, 2.2, depth / 2 - 0.05), mats["steel"], 0.01),
        box(f"{name}_track_post", (0.05, 2.2, 0.05), (width / 2 - 0.03, 1.1, depth / 2 - 0.05), mats["steel"], 0.01),
        box(f"{name}_sharps", (0.2, 0.25, 0.14), (0.9, 1.1, back + 0.17), mats["light_amber"], 0.02),
        box(f"{name}_glove_box", (0.3, 0.14, 0.12), (0.9, 1.5, back + 0.16), mats["plastic"], 0.02),
        box(f"{name}_bay_number", (0.3, 0.2, 0.02), (-0.9, 1.75, back + 0.11), mats["brand"], 0.01),
    ]
    parts += headwall(name, mats, 1.6, back + 0.14)
    parts += bay_monitor(name, mats, (0.7, 1.75, back + 0.35))
    parts += chair(f"{name}_visitor_chair", mats, (-0.95, 0, 0.6), facing=1)
    combine(f"{name}_body", parts, parent=group)
    curtain_parts = []
    folds = 12
    for index in range(folds):
        x = width / 2 - 0.05 - (width - 0.1) * (index + 0.5) / folds
        curtain_parts.append(box(f"{name}_fold{index}", (width / folds + 0.02, 1.85, 0.03), (x, 1.2, depth / 2 - 0.05 + (0.03 if index % 2 else -0.03)), mats["curtain"], 0.012))
    curtain_parts.append(box(f"{name}_mesh_band", (width - 0.1, 0.3, 0.05), (0, 2.03, depth / 2 - 0.05), mats["sheet"], 0.01))
    combine(f"{name}_curtain", curtain_parts, origin=(width / 2 - 0.05, 0, depth / 2 - 0.05), parent=group)
    lamp = box(f"{name}_status_lamp", (0.12, 0.12, 0.03), (-0.9, 2.0, back + 0.11), mats["status"], 0.02)
    combine(f"{name}_status", [lamp], origin=(-0.9, 2.0, back + 0.11), parent=group)
    return group


def resus_bay(mats):
    name = "resus_bay"
    group = root(name)
    width, depth = 3.6, 4.0
    back = -depth / 2
    partition = material("partition_resus", "#e8e3f4", roughness=0.5)
    parts = [
        box(f"{name}_floor", (width, 0.02, depth), (0, 0.01, 0), material("floor_resus", "#d5dce6", roughness=0.6), 0.005),
        box(f"{name}_back_wall", (width, 2.1, 0.12), (0, 1.05, back + 0.06), partition, 0.03),
        box(f"{name}_side_wall", (0.1, 1.3, depth - 0.12), (-width / 2 + 0.05, 0.65, 0.06), partition, 0.03),
        box(f"{name}_side_cap", (0.12, 0.04, depth - 0.12), (-width / 2 + 0.05, 1.31, 0.06), mats["accent"], 0.015),
        box(f"{name}_floor_mark", (2.6, 0.005, 3.0), (0, 0.022, 0.1), mats["paint_red"], 0.0),
        box(f"{name}_floor_mark_inner", (2.5, 0.006, 2.9), (0, 0.023, 0.1), material("floor_resus", "#d5dce6", roughness=0.6), 0.0),
        # Overhead procedure light on a floor stand (real bays hang it from the ceiling, which the diorama cuts away).
        box(f"{name}_light_base", (0.6, 0.06, 0.6), (1.35, 0.03, -1.0), mats["grey"], 0.02),
        box(f"{name}_light_post", (0.08, 2.1, 0.08), (1.35, 1.08, -1.0), mats["white"], 0.02),
        box(f"{name}_light_arm", (1.1, 0.07, 0.07), (0.85, 2.12, -1.0), mats["white"], 0.02),
        cylinder(f"{name}_light_head", 0.32, 0.12, (0.3, 2.05, -0.8), mats["white"], sides=28, round_by=0.04),
        cylinder(f"{name}_light_face", 0.26, 0.01, (0.3, 1.985, -0.8), mats["light_white"], sides=28),
        # Ventilator on a cart and a monitor tower.
        box(f"{name}_vent_cart", (0.5, 0.8, 0.45), (-1.3, 0.48, -1.2), mats["plastic"], 0.04),
        box(f"{name}_ventilator", (0.4, 0.35, 0.3), (-1.3, 1.06, -1.2), mats["white"], 0.04),
        box(f"{name}_tower", (0.45, 1.4, 0.45), (1.4, 0.7, -1.65), mats["grey"], 0.04),
        box(f"{name}_defib", (0.36, 0.22, 0.3), (1.4, 1.52, -1.65), material("defib_red", "#d8323a", roughness=0.4), 0.04),
        box(f"{name}_bay_number", (0.4, 0.24, 0.02), (-1.2, 1.9, back + 0.13), mats["accent"], 0.01),
    ]
    parts += screen(f"{name}_vent_screen", (0.3, 0.22, 0.02), (-1.3, 1.1, -1.04), mats)
    parts += headwall(name, mats, 2.2, back + 0.16)
    parts += bay_monitor(name, mats, (0.9, 1.8, back + 0.38))
    parts += bay_monitor(f"{name}_b", mats, (-0.3, 1.8, back + 0.38))
    combine(f"{name}_body", parts, parent=group)
    for side in (1, -1):
        caster(f"{name}_vent_castor{'l' if side > 0 else 'r'}", (-1.3 + side * 0.2, 0.05, -1.0), group, mats, radius=0.05, width=0.03)
    lamp = box(f"{name}_status_lamp", (0.14, 0.14, 0.03), (-0.85, 1.9, back + 0.13), mats["status"], 0.02)
    combine(f"{name}_status", [lamp], origin=(-0.85, 1.9, back + 0.13), parent=group)
    return group


def crash_cart(mats):
    name = "crash_cart"
    group = root(name)
    red = material("cart_red", "#d8323a", roughness=0.45)
    parts = [
        box(f"{name}_body", (0.75, 0.9, 0.55), (0, 0.6, 0), red, 0.04),
        box(f"{name}_top", (0.8, 0.04, 0.6), (0, 1.07, 0), mats["dark"], 0.015),
        box(f"{name}_defib", (0.36, 0.2, 0.3), (0.12, 1.19, -0.05), mats["plastic"], 0.04),
        box(f"{name}_board", (0.5, 0.6, 0.02), (0, 0.75, -0.29), mats["plastic"], 0.01),
        box(f"{name}_push_handle", (0.7, 0.03, 0.03), (0, 1.0, 0.34), mats["chrome"], 0.01),
    ]
    parts += screen(f"{name}_defib_screen", (0.16, 0.12, 0.01), (0.12, 1.22, 0.11), mats)
    for index in range(5):
        up = 0.27 + index * 0.16
        parts += [box(f"{name}_drawer_line{index}", (0.72, 0.012, 0.01), (0, up + 0.07, 0.276), mats["dark"], 0.0),
                  box(f"{name}_drawer_handle{index}", (0.3, 0.025, 0.025), (0, up, 0.29), mats["chrome"], 0.008)]
    combine(f"{name}_body", parts, parent=group)
    for side_x in (0.3, -0.3):
        for end in (0.22, -0.22):
            caster(f"{name}_castor_{'f' if end > 0 else 'r'}{'l' if side_x > 0 else 'r'}", (side_x, 0.06, end), group, mats, radius=0.06, width=0.035)
    return group


def five_star_base(prefix, mats, center, radius=0.3):
    x, _, forward = center
    parts = [cylinder(f"{prefix}_hub", 0.05, 0.08, (x, 0.1, forward), mats["grey"], sides=12)]
    for index in range(5):
        angle = index * 1.2566
        parts.append(box(f"{prefix}_spoke{index}", (0.04, 0.03, radius), (x + math.sin(angle) * radius / 2, 0.08, forward + math.cos(angle) * radius / 2), mats["grey"], 0.01))
    return parts


def monitor_stand(mats):
    name = "monitor_stand"
    group = root(name)
    parts = [cylinder(f"{name}_pole", 0.02, 1.2, (0, 0.7, 0), mats["chrome"], sides=10),
             box(f"{name}_basket", (0.28, 0.1, 0.2), (0, 0.9, 0.05), mats["grey"], 0.02)]
    parts += screen(f"{name}_monitor", (0.34, 0.26, 0.08), (0, 1.35, 0.06), mats)
    parts += five_star_base(name, mats, (0, 0, 0))
    combine(f"{name}_body", parts, parent=group)
    return group


def iv_pole(mats):
    name = "iv_pole"
    group = root(name)
    bag = material("iv_bag", "#e9f3ff", roughness=0.2)
    parts = [cylinder(f"{name}_pole", 0.015, 1.9, (0, 1.05, 0), mats["chrome"], sides=10),
             box(f"{name}_hooks", (0.3, 0.02, 0.02), (0, 2.0, 0), mats["chrome"], 0.008),
             box(f"{name}_bag", (0.12, 0.2, 0.04), (0.12, 1.85, 0), bag, 0.02),
             box(f"{name}_pump", (0.14, 0.18, 0.1), (0, 1.25, 0.06), mats["plastic"], 0.02),
             box(f"{name}_pump_screen", (0.08, 0.05, 0.005), (0, 1.29, 0.112), mats["screen"], 0.0)]
    parts += five_star_base(name, mats, (0, 0, 0))
    combine(f"{name}_body", parts, parent=group)
    return group


def workstation_cart(mats):
    name = "workstation_cart"
    group = root(name)
    parts = [box(f"{name}_column", (0.12, 0.9, 0.12), (0, 0.55, 0), mats["grey"], 0.02),
             box(f"{name}_work_surface", (0.6, 0.04, 0.45), (0, 1.02, 0.05), mats["white"], 0.015),
             box(f"{name}_keyboard", (0.4, 0.02, 0.13), (0, 1.05, 0.12), mats["dark"], 0.006),
             box(f"{name}_drawer", (0.4, 0.12, 0.3), (0, 0.92, 0.0), mats["brand"], 0.02),
             box(f"{name}_base", (0.55, 0.06, 0.5), (0, 0.1, 0), mats["dark"], 0.02)]
    parts += screen(f"{name}_monitor", (0.46, 0.3, 0.03), (0, 1.32, -0.08), mats)
    combine(f"{name}_body", parts, parent=group)
    for x in (0.22, -0.22):
        for end in (0.2, -0.2):
            caster(f"{name}_castor_{'f' if end > 0 else 'r'}{'l' if x > 0 else 'r'}", (x, 0.045, end), group, mats, radius=0.045, width=0.03)
    return group


def lab_analyzer(mats):
    name = "lab_analyzer"
    group = root(name)
    parts = [
        box(f"{name}_cabinet", (1.5, 0.95, 0.8), (0, 0.48, 0), mats["white"], 0.05),
        box(f"{name}_plinth", (1.46, 0.08, 0.76), (0, 0.04, 0), mats["dark"], 0.01),
        box(f"{name}_deck", (1.1, 0.06, 0.7), (-0.15, 0.98, 0), mats["panel"], 0.02),
        box(f"{name}_lid", (1.1, 0.04, 0.7), (-0.15, 1.25, 0), mats["glass_light"], 0.02),
        box(f"{name}_lid_frame", (1.12, 0.26, 0.04), (-0.15, 1.12, -0.33), mats["grey"], 0.01),
        box(f"{name}_probe_arm", (0.06, 0.08, 0.4), (0.15, 1.14, 0.0), mats["steel"], 0.01),
        box(f"{name}_tube_rack", (0.3, 0.1, 0.1), (-0.5, 1.05, 0.28), mats["brand"], 0.01),
        box(f"{name}_screen_arm", (0.05, 0.4, 0.05), (0.62, 1.15, 0.2), mats["grey"], 0.01),
        box(f"{name}_status_lamp", (0.06, 0.2, 0.06), (0.65, 1.0, -0.3), mats["light_green"], 0.02),
        box(f"{name}_door_line", (0.012, 0.75, 0.01), (0, 0.45, 0.401), mats["dark"], 0.0),
    ]
    parts += screen(f"{name}_touch", (0.34, 0.24, 0.03), (0.62, 1.4, 0.28), mats)
    parts += vent(f"{name}_vent", (-0.45, 0.35, 0.405), (0.5, 0.3), mats)
    for index in range(10):
        parts.append(cylinder(f"{name}_tube{index}", 0.012, 0.09, (-0.62 + index * 0.028, 1.12, 0.28), mats["sheet"], sides=8))
    combine(f"{name}_body", parts, parent=group)
    rotor = [cylinder(f"{name}_carousel", 0.25, 0.06, (-0.4, 1.04, 0), mats["grey"], sides=32, round_by=0.01)]
    for index in range(16):
        angle = index * 2 * math.pi / 16
        rotor.append(cylinder(f"{name}_cup{index}", 0.015, 0.06, (-0.4 + math.cos(angle) * 0.2, 1.09, math.sin(angle) * 0.2), mats["brand"], sides=8))
    combine(f"{name}_rotor", rotor, origin=(-0.4, 1.04, 0), parent=group)
    return group


def lab_bench(mats):
    name = "lab_bench"
    group = root(name)
    parts = [
        box(f"{name}_top", (2.4, 0.05, 0.75), (0, 0.9, 0), mats["panel"], 0.015),
        box(f"{name}_cupboards", (2.36, 0.82, 0.7), (0, 0.45, 0), mats["white"], 0.03),
        box(f"{name}_upstand", (2.4, 0.12, 0.03), (0, 0.98, -0.36), mats["panel"], 0.01),
        box(f"{name}_centrifuge", (0.45, 0.3, 0.5), (-0.7, 1.08, 0), mats["white"], 0.08),
        box(f"{name}_centrifuge_panel", (0.3, 0.08, 0.01), (-0.7, 1.05, 0.255), mats["screen"], 0.0),
        box(f"{name}_microscope_base", (0.25, 0.05, 0.3), (0.5, 0.95, 0), mats["dark"], 0.02),
        box(f"{name}_microscope_arm", (0.08, 0.35, 0.08), (0.5, 1.15, -0.1), mats["white"], 0.02),
        cylinder(f"{name}_microscope_head", 0.05, 0.25, (0.5, 1.3, 0.0), mats["dark"], axis="forward", sides=12),
        box(f"{name}_rack", (0.35, 0.1, 0.15), (0.0, 0.98, 0.15), mats["brand"], 0.01),
        box(f"{name}_pipette_stand", (0.12, 0.3, 0.12), (0.95, 1.07, -0.2), mats["grey"], 0.02),
    ]
    for index in range(4):
        parts.append(box(f"{name}_door_line{index}", (0.01, 0.7, 0.01), (-0.885 + index * 0.59, 0.45, 0.351), mats["dark"], 0.0))
    combine(f"{name}_body", parts, parent=group)
    lid = [box(f"{name}_centrifuge_lid", (0.42, 0.04, 0.42), (-0.7, 1.25, -0.02), mats["brand"], 0.06)]
    combine(f"{name}_lid", lid, origin=(-0.7, 1.25, -0.23), parent=group)
    return group


def sign_plate(name, mats, width, colour):
    """Blank illuminated sign plate on two posts; the app may draw its own text."""
    group = root(name)
    face = material(f"glow_{name}", colour, roughness=0.3, emission=colour, strength=1.2)
    parts = [box(f"{name}_frame", (width + 0.1, 0.7, 0.16), (0, 2.6, 0), mats["dark"], 0.04),
             box(f"{name}_face_front", (width, 0.58, 0.01), (0, 2.6, 0.081), face, 0.0),
             box(f"{name}_face_back", (width, 0.58, 0.01), (0, 2.6, -0.081), face, 0.0)]
    for side in (1, -1):
        parts.append(box(f"{name}_post{side}", (0.1, 2.3, 0.1), (side * width * 0.4, 1.15, 0), mats["grey"], 0.02))
    combine(f"{name}_body", parts, parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    groups = [
        triage_desk(mats), nurses_station(mats), seats_row("seats_row3", mats, 3, "#3f5f8f"),
        seats_row("seats_row4", mats, 4, "#4f8a8b"), side_table(mats), checkin_kiosk(mats), cubicle(mats),
        resus_bay(mats), crash_cart(mats), monitor_stand(mats), iv_pole(mats), workstation_cart(mats),
        lab_analyzer(mats), lab_bench(mats), sign_plate("sign_plate_a", mats, 2.4, "#d8323a"),
        sign_plate("sign_plate_b", mats, 1.6, "#2f6fe4"),
    ]
    for index, group in enumerate(groups):
        group.location.x = (index % 4) * 5.0
        group.location.y = -(index // 4) * 5.0
    export("furniture.glb")


if __name__ == "__main__":
    build()
