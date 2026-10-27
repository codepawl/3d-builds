"""Beds, stretchers, covered patients and a wheelchair: beds.glb (refs/stretcher.md, refs/hospital_bed.md).

All roots sit on y = 0 with the head end towards +forward and the origin on the floor under the deck centre.
- stretcher_ed: ED transport stretcher, 2.10 x 0.80 m, deck top 0.72 m.
- stretcher_cot: ambulance powered cot, 2.06 x 0.58 m, deck top 0.92 m (raised) on an X frame.
- bed_ward: acute-care bed, 2.20 x 1.00 m, deck top 0.60 m, head and foot boards.
  Each has <root>_backrest (hinge across x at the deck top, rotate about x; positive lifts the head end) and
  <root>_castor_fl/fr/rl/rr (spin about x at the axle). `bed_ward` also has <root>_status (state lamp on the
  foot board, material `status`).
- patient_a/b/c: covered figures lying on their back, origin on the mattress top under the hips, head to +forward.
  <root>_upper (blanket over the chest, head, pillow) hinges at forward +0.25, the same line as every backrest
  hinge when the patient origin sits at the deck centre, so the app tilts it with the backrest. <root>_tag is the
  triage tag (material `triage`, recoloured by level).
- wheelchair: transport chair, rear wheels 0.60 m, <root>_wheel_l/r and <root>_castor_l/r.
"""
import math

from lib import box, combine, cylinder, export, loft, material, reset_scene, root, sphere, turn
from parts import caster, palette

HINGE_FORWARD = 0.25


def castors(name, group, mats, half_width, half_length, radius):
    for side, side_name in ((1, "l"), (-1, "r")):
        for end, end_name in ((1, "f"), (-1, "r")):
            caster(f"{name}_castor_{end_name}{side_name}", (side * half_width, radius, end * half_length), group, mats, radius=radius)


def backrest(name, group, mats, deck_top, width, head_end, cover):
    """Head section of the deck and mattress, hinged at HINGE_FORWARD."""
    length = head_end - HINGE_FORWARD
    middle = (HINGE_FORWARD + head_end) / 2
    parts = [
        box(f"{name}_br_frame", (width, 0.05, length), (0, deck_top - 0.115, middle), mats["steel"], 0.015),
        box(f"{name}_br_mattress", (width - 0.04, 0.11, length - 0.02), (0, deck_top - 0.055, middle), cover, 0.045),
        box(f"{name}_br_sheet", (width - 0.03, 0.02, length - 0.06), (0, deck_top + 0.002, middle), mats["sheet"], 0.01),
        box(f"{name}_pillow", (width * 0.6, 0.1, 0.38), (0, deck_top + 0.05, head_end - 0.25), mats["sheet"], 0.045),
    ]
    combine(f"{name}_backrest", parts, origin=(0, deck_top - 0.1, HINGE_FORWARD), parent=group)


def foot_deck(name, mats, deck_top, width, foot_end, cover):
    length = HINGE_FORWARD - foot_end
    middle = (HINGE_FORWARD + foot_end) / 2
    return [
        box(f"{name}_deck_frame", (width, 0.05, length), (0, deck_top - 0.115, middle), mats["steel"], 0.015),
        box(f"{name}_mattress", (width - 0.04, 0.11, length - 0.02), (0, deck_top - 0.055, middle), cover, 0.045),
        box(f"{name}_sheet", (width - 0.03, 0.02, length - 0.06), (0, deck_top + 0.002, middle), mats["sheet"], 0.01),
    ]


def side_rails(name, mats, deck_top, half_width, start, end, height=0.3):
    parts = []
    for side in (1, -1):
        x = side * (half_width + 0.02)
        middle = (start + end) / 2
        parts += [
            cylinder(f"{name}_rail_top{side}", 0.017, end - start, (x, deck_top + height, middle), mats["chrome"], axis="forward", sides=10),
            cylinder(f"{name}_rail_low{side}", 0.014, end - start, (x, deck_top + height * 0.45, middle), mats["chrome"], axis="forward", sides=10),
        ]
        for post in (start + 0.05, middle, end - 0.05):
            parts.append(cylinder(f"{name}_rail_post{side}_{post:.2f}", 0.014, height + 0.08, (x, deck_top + height / 2 - 0.04, post), mats["chrome"], sides=10))
    return parts


def stretcher_ed(mats):
    name = "stretcher_ed"
    group = root(name)
    deck_top, width, half_length = 0.72, 0.68, 1.0
    parts = [
        box(f"{name}_base", (0.62, 0.16, 1.9), (0, 0.24, 0), mats["panel"], 0.06),
        box(f"{name}_base_bumper", (0.66, 0.05, 1.95), (0, 0.17, 0), mats["dark"], 0.02),
        box(f"{name}_pedal_box", (0.3, 0.1, 0.2), (0, 0.26, -0.85), mats["grey"], 0.03),
        box(f"{name}_column", (0.22, deck_top - 0.42, 0.3), (0, 0.48 + (deck_top - 0.6) / 2, 0.15), mats["grey"], 0.04),
        box(f"{name}_bellows", (0.26, 0.2, 0.34), (0, 0.4, 0.15), mats["dark"], 0.05),
        box(f"{name}_push_bar", (width - 0.08, 0.04, 0.04), (0, deck_top + 0.25, -half_length - 0.06), mats["chrome"], 0.015),
        cylinder(f"{name}_iv_socket", 0.02, 0.12, (width / 2 - 0.05, deck_top - 0.05, half_length - 0.03), mats["steel"], sides=10),
        cylinder(f"{name}_iv_pole", 0.012, 1.1, (width / 2 - 0.05, deck_top + 0.55, half_length - 0.03), mats["chrome"], sides=8),
        box(f"{name}_o2_holder", (0.14, 0.4, 0.12), (0, 0.42, -0.55), mats["steel"], 0.03),
        cylinder(f"{name}_o2_cylinder", 0.05, 0.42, (0, 0.46, -0.55), material("o2_green", "#3aa46a", roughness=0.4), sides=12, round_by=0.02),
    ]
    for side in (1, -1):
        parts.append(cylinder(f"{name}_push_post{side}", 0.017, 0.3, (side * (width / 2 - 0.06), deck_top + 0.1, -half_length - 0.06), mats["chrome"], sides=10))
    parts += foot_deck(name, mats, deck_top, width, -half_length, mats["mattress"])
    parts += side_rails(name, mats, deck_top, width / 2, -0.6, 0.6)
    combine(f"{name}_frame", parts, parent=group)
    backrest(name, group, mats, deck_top, width, half_length, mats["mattress"])
    castors(name, group, mats, 0.27, 0.85, 0.075)
    return group


def stretcher_cot(mats):
    name = "stretcher_cot"
    group = root(name)
    deck_top, width, half_length = 0.92, 0.56, 1.0
    cover = material("cot_cover", "#ff8a3d", roughness=0.7)
    parts = [
        box(f"{name}_base_rail_l", (0.05, 0.05, 1.7), (0.24, 0.17, -0.05), mats["steel"], 0.015),
        box(f"{name}_base_rail_r", (0.05, 0.05, 1.7), (-0.24, 0.17, -0.05), mats["steel"], 0.015),
        box(f"{name}_base_cross_f", (0.5, 0.05, 0.05), (0, 0.17, 0.78), mats["steel"], 0.015),
        box(f"{name}_base_cross_r", (0.5, 0.05, 0.05), (0, 0.17, -0.88), mats["steel"], 0.015),
        box(f"{name}_battery", (0.2, 0.12, 0.28), (0, 0.32, -0.75), material("battery_yellow", "#f2c94c", roughness=0.5), 0.03),
        box(f"{name}_load_bar", (0.42, 0.04, 0.05), (0, deck_top - 0.12, half_length + 0.1), mats["chrome"], 0.015),
        box(f"{name}_foot_handle", (width - 0.06, 0.04, 0.05), (0, deck_top - 0.05, -half_length - 0.1), mats["chrome"], 0.015),
        box(f"{name}_strap_chest", (width + 0.02, 0.015, 0.06), (0, deck_top + 0.005, 0.35), mats["dark"], 0.005),
        box(f"{name}_strap_legs", (width + 0.02, 0.015, 0.06), (0, deck_top + 0.005, -0.5), mats["dark"], 0.005),
    ]
    for side in (1, -1):
        for direction in (1, -1):
            leg = box(f"{name}_xleg{side}_{direction}", (0.04, 1.0, 0.05), (side * 0.2, 0.52, 0.0), mats["steel"], 0.012)
            turn(leg, "x", direction * math.radians(50))
            parts.append(leg)
        parts.append(cylinder(f"{name}_load_wheel{side}", 0.05, 0.04, (side * 0.18, deck_top - 0.16, half_length + 0.1), mats["dark"], axis="x", sides=12))
    parts += foot_deck(name, mats, deck_top, width, -half_length, cover)
    parts += side_rails(name, mats, deck_top, width / 2, -0.55, 0.3, height=0.18)
    combine(f"{name}_frame", parts, parent=group)
    backrest(name, group, mats, deck_top, width, half_length, cover)
    castors(name, group, mats, 0.24, 0.8, 0.065)
    return group


def bed_ward(mats):
    name = "bed_ward"
    group = root(name)
    deck_top, width, half_length = 0.6, 0.9, 1.05
    parts = [
        box(f"{name}_base", (0.8, 0.12, 1.9), (0, 0.2, 0), mats["panel"], 0.05),
        box(f"{name}_base_cover", (0.7, 0.08, 1.6), (0, 0.29, 0), mats["white"], 0.04),
        box(f"{name}_lift_head", (0.2, 0.22, 0.2), (0, 0.4, 0.6), mats["grey"], 0.03),
        box(f"{name}_lift_foot", (0.2, 0.22, 0.2), (0, 0.4, -0.6), mats["grey"], 0.03),
        box(f"{name}_head_board", (width + 0.06, 0.55, 0.06), (0, 0.72, half_length + 0.04), mats["wood"], 0.04),
        box(f"{name}_head_board_frame", (width + 0.1, 0.06, 0.08), (0, 1.0, half_length + 0.04), mats["panel"], 0.03),
        box(f"{name}_foot_board", (width + 0.06, 0.42, 0.06), (0, 0.66, -half_length - 0.04), mats["wood"], 0.04),
        box(f"{name}_foot_board_frame", (width + 0.1, 0.06, 0.08), (0, 0.88, -half_length - 0.04), mats["panel"], 0.03),
        box(f"{name}_control_panel", (0.3, 0.14, 0.02), (0, 0.72, -half_length - 0.08), mats["screen_dark"], 0.01),
        box(f"{name}_chart_holder", (0.24, 0.3, 0.02), (0.28, 0.7, -half_length - 0.08), mats["plastic"], 0.01),
    ]
    for side in (1, -1):
        parts.append(cylinder(f"{name}_bumper{side}", 0.04, 0.06, (side * 0.48, 0.95, half_length + 0.06), mats["dark"], sides=12))
    parts += foot_deck(name, mats, deck_top, width, -half_length, material("bed_mattress", "#6c9fd9", roughness=0.75))
    parts += side_rails(name, mats, deck_top, width / 2, -0.75, -0.05)
    combine(f"{name}_frame", parts, parent=group)
    status_lamp = box(f"{name}_status_lamp", (0.06, 0.06, 0.02), (-0.3, 0.72, -half_length - 0.085), mats["status"], 0.01)
    combine(f"{name}_status", [status_lamp], origin=(-0.3, 0.72, -half_length - 0.085), parent=group)
    backrest(name, group, mats, deck_top, width, half_length, material("bed_mattress", "#6c9fd9", roughness=0.75))
    # The head rails ride with the backrest on a real bed; here they stay on the frame at the head end.
    rails = side_rails(f"{name}_head", mats, deck_top, width / 2, 0.15, 0.8)
    combine(f"{name}_head_rails", rails, parent=group)
    castors(name, group, mats, 0.38, 0.85, 0.075)
    return group


def patient(name, mats, blanket_colour, hair_colour, skin_colour, length):
    """A calm covered figure: blanket loft over the legs and chest, head on a pillow, arms under the blanket."""
    group = root(name)
    blanket = material(f"{name}_blanket", blanket_colour, roughness=0.92)
    skin = material(f"{name}_skin", skin_colour, roughness=0.7)
    hair = material(f"{name}_hair", hair_colour, roughness=0.9)
    foot = HINGE_FORWARD - length * 0.62
    legs = loft(f"{name}_legs_shape", [
        (foot - 0.02, 0.0, 0.0, 0.02),
        (foot, 0.16, 0.07, 0.05),
        (foot + 0.15, 0.22, 0.09, 0.07),
        (foot + 0.6, 0.27, 0.08, 0.07),
        (HINGE_FORWARD - 0.05, 0.3, 0.1, 0.08),
        (HINGE_FORWARD + 0.02, 0.31, 0.1, 0.08),
    ], blanket, sides=20)
    edge = box(f"{name}_blanket_hem", (0.62, 0.02, 0.06), (0, 0.04, foot + 0.1), mats["sheet"], 0.008)
    combine(f"{name}_legs", [legs, edge], parent=group)
    chest_end = HINGE_FORWARD + length * 0.25
    upper = [
        loft(f"{name}_chest", [(HINGE_FORWARD - 0.02, 0.31, 0.1, 0.08), (HINGE_FORWARD + 0.2, 0.3, 0.13, 0.1),
                               (chest_end, 0.26, 0.12, 0.09), (chest_end + 0.02, 0.0, 0.0, 0.09)], blanket, sides=20),
        box(f"{name}_fold", (0.6, 0.04, 0.12), (0, 0.17, chest_end - 0.05), mats["sheet"], 0.02),
        cylinder(f"{name}_neck", 0.05, 0.1, (0, 0.11, chest_end + 0.06), skin, axis="forward", sides=12),
        sphere(f"{name}_head", 0.105, (0, 0.14, chest_end + 0.17), skin, scale=(0.9, 0.95, 1.05), segments=18),
        sphere(f"{name}_hair", 0.108, (0, 0.13, chest_end + 0.2), hair, scale=(0.95, 0.9, 1.0), segments=18),
        box(f"{name}_wristband", (0.06, 0.03, 0.025), (0.2, 0.17, HINGE_FORWARD + 0.05), mats["sheet"], 0.008),
    ]
    combine(f"{name}_upper", upper, origin=(0, 0.0, HINGE_FORWARD), parent=group)
    tag = [
        box(f"{name}_tag_card", (0.1, 0.012, 0.14), (0.24, 0.19, HINGE_FORWARD - 0.15), mats["triage"], 0.004),
        box(f"{name}_tag_label", (0.07, 0.014, 0.04), (0.24, 0.19, HINGE_FORWARD - 0.12), mats["sheet"], 0.003),
    ]
    combine(f"{name}_tag", tag, origin=(0.24, 0.19, HINGE_FORWARD - 0.15), parent=group)
    return group


def wheelchair(mats):
    name = "wheelchair"
    group = root(name)
    frame_colour = material("chair_frame", "#7a8699", roughness=0.35, metallic=0.7)
    upholstery = material("chair_seat", "#2b313b", roughness=0.8)
    parts = [
        box(f"{name}_seat", (0.46, 0.05, 0.44), (0, 0.5, 0.05), upholstery, 0.02),
        box(f"{name}_back", (0.44, 0.42, 0.04), (0, 0.76, -0.2), upholstery, 0.02),
        box(f"{name}_footplate", (0.36, 0.02, 0.14), (0, 0.12, 0.42), frame_colour, 0.01),
    ]
    for side in (1, -1):
        x = side * 0.24
        parts += [
            cylinder(f"{name}_handle_post{side}", 0.014, 0.6, (x, 0.75, -0.24), frame_colour, sides=10),
            cylinder(f"{name}_grip{side}", 0.02, 0.12, (x, 1.04, -0.3), mats["dark"], axis="forward", sides=10),
            cylinder(f"{name}_seat_rail{side}", 0.014, 0.5, (x, 0.48, 0.05), frame_colour, axis="forward", sides=10),
            cylinder(f"{name}_arm{side}", 0.025, 0.36, (x, 0.7, 0.0), mats["dark"], axis="forward", sides=10),
            cylinder(f"{name}_front_post{side}", 0.014, 0.42, (x * 0.85, 0.3, 0.28), frame_colour, sides=10),
        ]
    combine(f"{name}_frame", parts, parent=group)
    for side, suffix in ((1, "l"), (-1, "r")):
        rim = [
            cylinder(f"{name}_tyre{suffix}", 0.3, 0.035, (side * 0.3, 0.3, -0.1), mats["dark"], axis="x", sides=28, round_by=0.012),
            cylinder(f"{name}_rim{suffix}", 0.27, 0.03, (side * 0.3, 0.3, -0.1), mats["steel"], axis="x", sides=28),
            cylinder(f"{name}_hub{suffix}", 0.04, 0.06, (side * 0.3, 0.3, -0.1), mats["grey"], axis="x", sides=12),
            cylinder(f"{name}_pushrim{suffix}", 0.26, 0.012, (side * 0.33, 0.3, -0.1), mats["chrome"], axis="x", sides=28),
        ]
        combine(f"{name}_wheel_{suffix}", rim, origin=(side * 0.3, 0.3, -0.1), parent=group)
        caster(f"{name}_castor_{suffix}", (side * 0.2, 0.07, 0.36), group, mats, radius=0.07, width=0.03)
    return group


def build():
    reset_scene()
    mats = palette()
    layout = [
        (stretcher_ed(mats), -3.0), (stretcher_cot(mats), -1.8), (bed_ward(mats), -0.4),
        (patient("patient_a", mats, "#b9d3f0", "#2a2420", "#c99a78", 1.72), 1.0),
        (patient("patient_b", mats, "#f2f4f7", "#8a6a4a", "#e2bf9f", 1.6), 2.0),
        (patient("patient_c", mats, "#cfe5d6", "#c9c3bb", "#8d5a3b", 1.8), 3.0),
        (wheelchair(mats), 4.0),
    ]
    for group, x in layout:
        group.location.x = x
    export("beds.glb")


if __name__ == "__main__":
    build()
