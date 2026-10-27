"""Imaging: imaging.glb (refs/ct_scanner.md, refs/xray.md).

Roots sit on y = 0, origin on the floor; the patient side faces +forward.
- ct_scanner: gantry 2.10 W x 1.95 H x 0.95 D m centred on forward 0, bore 0.78 m at 1.03 m; couch from
  forward 0.45 to 2.85. Moving: ct_scanner_table (table top, slides along -forward into the bore; origin at its
  rest centre), ct_scanner_status (ring light, material `status`, recoloured busy or free).
- ct_console: operator desk with two monitors and a chair, 1.6 x 0.75 m.
- xray_room: floor-mounted tube stand on a 3 m floor rail beside a 2.2 m table, wall bucky stand and generator.
  Moving: xray_room_column (slides along forward on the rail), xray_room_tube (tube head, moves up and down on
  the column), xray_room_detector (wall stand detector, moves up and down).
- lead_screen: mobile lead screen with window, 1.0 x 1.9 m.
"""
import bpy

from lib import box, combine, cylinder, export, material, reset_scene, root
from parts import palette, screen, vent


def cut(target, cutter):
    """Boolean difference applied when combine() evaluates the object; the cutter is removed afterwards."""
    modifier = target.modifiers.new("cut", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    cutter.hide_render = True
    cutter.hide_viewport = True
    return target


def ring(name, outer, inner, length, center, mat, axis="forward", sides=40):
    tube = cylinder(name, outer, length, center, mat, axis=axis, sides=sides)
    hole = cylinder(f"{name}_hole", inner, length + 0.2, center, mat, axis=axis, sides=sides)
    return cut(tube, hole), hole


def ct_scanner(mats):
    name = "ct_scanner"
    group = root(name)
    bore_up, bore_radius = 1.03, 0.39
    cutters = []
    shell = box(f"{name}_gantry", (2.1, 1.85, 0.95), (0, 1.05, 0), mats["white"], 0.22)
    bore_cut = cylinder(f"{name}_bore_cut", bore_radius + 0.04, 1.4, (0, bore_up, 0), mats["white"], axis="forward", sides=48)
    cut(shell, bore_cut)
    cutters.append(bore_cut)
    face, face_cut = ring(f"{name}_face_panel", 0.86, bore_radius + 0.04, 0.04, (0, bore_up, 0.48), mats["panel"], sides=56)
    liner, liner_cut = ring(f"{name}_bore_liner", bore_radius + 0.05, bore_radius, 1.0, (0, bore_up, 0), mats["plastic"], sides=48)
    lip, lip_cut = ring(f"{name}_bore_lip", bore_radius + 0.09, bore_radius - 0.01, 0.06, (0, bore_up, 0.5), mats["grey"], sides=48)
    cutters += [face_cut, liner_cut, lip_cut]
    parts = [
        shell, face, liner, lip,
        box(f"{name}_pedestal", (1.6, 0.14, 1.0), (0, 0.07, 0), mats["grey"], 0.05),
        box(f"{name}_cover_seam", (2.12, 0.015, 0.97), (0, 1.62, 0), mats["panel"], 0.0),
        box(f"{name}_couch_base", (0.5, 0.55, 1.6), (0, 0.3, 1.75), mats["white"], 0.08),
        box(f"{name}_couch_plinth", (0.6, 0.06, 1.9), (0, 0.03, 1.7), mats["grey"], 0.02),
        box(f"{name}_couch_bellows", (0.42, 0.25, 1.3), (0, 0.66, 1.75), mats["dark"], 0.04),
        box(f"{name}_couch_cradle", (0.46, 0.1, 2.1), (0, 0.83, 1.65), mats["panel"], 0.04),
        box(f"{name}_laser_window", (0.3, 0.03, 0.02), (0, bore_up + bore_radius + 0.14, 0.505), mats["light_red"], 0.005),
    ]
    for side in (1, -1):
        parts += screen(f"{name}_panel{side}", (0.2, 0.13, 0.03), (side * 0.62, bore_up + 0.35, 0.49), mats)
        parts += [box(f"{name}_button{side}_{index}", (0.04, 0.03, 0.02), (side * 0.62 - 0.06 + index * 0.06, bore_up + 0.22, 0.49), mats["brand"], 0.008) for index in range(3)]
        parts += vent(f"{name}_side_vent{side}", (side * 0.75, 0.45, -0.476), (0.4, 0.3), mats, slats=5)
    combine(f"{name}_body", parts, parent=group)
    for cutter in cutters:
        remove(cutter)
    status = ring(f"{name}_status_ring", bore_radius + 0.13, bore_radius + 0.1, 0.03, (0, bore_up, 0.5), mats["status"], sides=56)
    combine(f"{name}_status", [status[0]], origin=(0, bore_up, 0.5), parent=group)
    remove(status[1])
    table = [
        box(f"{name}_table_top", (0.5, 0.07, 2.0), (0, 0.92, 1.6), mats["plastic"], 0.03),
        box(f"{name}_table_pad", (0.42, 0.05, 1.7), (0, 0.97, 1.7), material("pad_grey", "#a7b4c6", roughness=0.8), 0.025),
        box(f"{name}_head_rest", (0.3, 0.1, 0.3), (0, 0.98, 0.75), mats["plastic"], 0.04),
    ]
    combine(f"{name}_table", table, origin=(0, 0.92, 1.6), parent=group)
    return group


def remove(obj):
    bpy.data.objects.remove(obj, do_unlink=True)


def ct_console(mats):
    name = "ct_console"
    group = root(name)
    chair_colour = material("chair_dark", "#3a4250", roughness=0.8)
    parts = [
        box(f"{name}_desk_top", (1.6, 0.04, 0.75), (0, 0.74, 0), mats["panel"], 0.02),
        box(f"{name}_desk_side_l", (0.04, 0.72, 0.7), (0.76, 0.36, 0), mats["grey"], 0.01),
        box(f"{name}_desk_side_r", (0.5, 0.72, 0.7), (-0.53, 0.36, 0), mats["grey"], 0.02),
        box(f"{name}_keyboard", (0.42, 0.02, 0.14), (0.25, 0.77, 0.12), mats["dark"], 0.006),
        box(f"{name}_intercom", (0.12, 0.08, 0.12), (-0.25, 0.8, 0.15), mats["dark"], 0.02),
        box(f"{name}_chair_seat", (0.48, 0.08, 0.46), (0.1, 0.48, 0.55), chair_colour, 0.04),
        box(f"{name}_chair_back", (0.44, 0.5, 0.06), (0.1, 0.8, 0.78), chair_colour, 0.04),
        cylinder(f"{name}_chair_post", 0.03, 0.4, (0.1, 0.24, 0.55), mats["steel"], sides=10),
        box(f"{name}_chair_foot", (0.55, 0.03, 0.06), (0.1, 0.04, 0.55), mats["dark"], 0.01),
        box(f"{name}_chair_foot2", (0.06, 0.03, 0.55), (0.1, 0.04, 0.55), mats["dark"], 0.01),
    ]
    for index, x in enumerate((0.42, -0.1)):
        parts += screen(f"{name}_monitor{index}", (0.5, 0.32, 0.03), (x, 1.03, -0.15), mats)
        parts += [box(f"{name}_stand{index}", (0.05, 0.2, 0.05), (x, 0.84, -0.19), mats["dark"], 0.01)]
    combine(f"{name}_body", parts, parent=group)
    return group


def xray_room(mats):
    name = "xray_room"
    group = root(name)
    rail_x = 1.2
    parts = [
        box(f"{name}_table_top", (0.8, 0.06, 2.2), (0, 0.72, 0), mats["plastic"], 0.03),
        box(f"{name}_table_pad", (0.7, 0.04, 1.9), (0, 0.765, 0), material("pad_grey", "#a7b4c6", roughness=0.8), 0.02),
        box(f"{name}_table_bucky", (0.6, 0.1, 0.6), (0, 0.64, 0), mats["grey"], 0.02),
        box(f"{name}_table_column", (0.45, 0.55, 0.5), (0, 0.32, 0), mats["white"], 0.05),
        box(f"{name}_table_foot", (0.7, 0.06, 0.8), (0, 0.03, 0), mats["grey"], 0.02),
        box(f"{name}_floor_rail", (0.16, 0.04, 3.0), (rail_x, 0.02, 0), mats["steel"], 0.01),
        box(f"{name}_wall_column", (0.32, 2.0, 0.2), (0, 1.0, -2.0), mats["white"], 0.05),
        box(f"{name}_wall_base", (0.6, 0.05, 0.4), (0, 0.025, -1.95), mats["grey"], 0.02),
        box(f"{name}_generator", (0.6, 1.6, 0.5), (-1.6, 0.8, -1.8), mats["panel"], 0.05),
        box(f"{name}_generator_lamp", (0.1, 0.04, 0.02), (-1.6, 1.45, -1.54), mats["light_green"], 0.01),
    ]
    parts += vent(f"{name}_generator_vent", (-1.6, 0.4, -1.54), (0.4, 0.3), mats)
    combine(f"{name}_base", parts, parent=group)
    column = [
        box(f"{name}_column_carriage", (0.32, 0.16, 0.45), (rail_x, 0.1, 0), mats["grey"], 0.04),
        box(f"{name}_column_post", (0.2, 2.3, 0.2), (rail_x, 1.3, 0), mats["white"], 0.05),
        box(f"{name}_column_top", (0.24, 0.08, 0.24), (rail_x, 2.48, 0), mats["brand"], 0.03),
    ]
    combine(f"{name}_column", column, origin=(rail_x, 0, 0), parent=group)
    tube = [
        box(f"{name}_tube_arm", (0.9, 0.12, 0.14), (rail_x - 0.5, 1.6, 0), mats["white"], 0.04),
        cylinder(f"{name}_tube_head", 0.15, 0.5, (0.0, 1.6, 0), mats["white"], axis="forward", sides=24, round_by=0.05),
        box(f"{name}_collimator", (0.28, 0.2, 0.28), (0.0, 1.42, 0), mats["panel"], 0.04),
        box(f"{name}_collimator_handle", (0.34, 0.04, 0.04), (0.0, 1.32, 0.16), mats["dark"], 0.01),
        box(f"{name}_collimator_light", (0.16, 0.01, 0.16), (0.0, 1.315, 0), mats["light_amber"], 0.0),
    ]
    combine(f"{name}_tube", tube, origin=(rail_x, 1.6, 0), parent=group)
    detector = [
        box(f"{name}_detector_box", (0.5, 0.5, 0.1), (0, 1.35, -1.85), mats["plastic"], 0.04),
        box(f"{name}_detector_face", (0.4, 0.4, 0.01), (0, 1.35, -1.795), mats["panel"], 0.0),
        box(f"{name}_detector_grip", (0.06, 0.4, 0.04), (0.29, 1.35, -1.85), mats["dark"], 0.01),
    ]
    combine(f"{name}_detector", detector, origin=(0, 1.35, -1.85), parent=group)
    return group


def lead_screen(mats):
    name = "lead_screen"
    group = root(name)
    parts = [
        box(f"{name}_panel", (1.0, 1.4, 0.06), (0, 0.85, 0), mats["panel"], 0.04),
        box(f"{name}_window", (0.6, 0.45, 0.07), (0, 1.3, 0), mats["lead_glass"], 0.02),
        box(f"{name}_foot", (1.0, 0.05, 0.4), (0, 0.06, 0), mats["grey"], 0.02),
        box(f"{name}_sign", (0.22, 0.22, 0.072), (0, 0.75, 0), mats["light_amber"], 0.02),
    ]
    for side in (1, -1):
        parts.append(cylinder(f"{name}_wheel{side}", 0.04, 0.03, (side * 0.42, 0.04, 0.15), mats["dark"], axis="x", sides=12))
    combine(f"{name}_body", parts, parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    ct_scanner(mats).location.x = -3
    ct_console(mats).location.x = 0
    xray_room(mats).location.x = 3
    lead_screen(mats).location.x = 6
    export("imaging.glb")


if __name__ == "__main__":
    build()
