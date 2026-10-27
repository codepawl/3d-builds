"""pad.glb: catch tower, tower under construction, launch mount with deluge plate, suborbital test stand.
From refs/tower.md and refs/launch_mount.md. Tower origin: tower centre on the ground; its front face is +z
and the vehicle axis sits at (0, *, 30) in front of it, which is where the launch mount goes."""
import math

from lib import box, combine, cylinder, export, reset_scene, root, rod, turn
from parts import annulus, around, ladder, lamp, lattice_tower, palette, railing, truss_beam

TOWER_WIDTH = 12.0
LATTICE_TOP = 130.0
VEHICLE_Z = 30.0
MOUNT_TOP = 20.0


def tower_body(name, modules_standing, materials, group):
    module_height = (LATTICE_TOP - 3.0) / 9
    top = 3.0 + module_height * modules_standing
    parts = [box(f"{name}_foundation", (18, 3, 18), (0, 1.5, 0), materials["concrete"], round_by=0.3)]
    parts += lattice_tower(f"{name}_lattice", (0, 0, 0), TOWER_WIDTH, 3.0, top, modules_standing, materials["frame"], column=1.3, brace=0.32)
    # Lift and stair shaft inside, cable trays on the back face.
    parts.append(box(f"{name}_shaft", (3.2, top - 3, 3.2), (-2.5, 3 + (top - 3) / 2, -2.5), materials["clay"], round_by=0.1))
    for index in range(int((top - 6) / 3.2)):
        level = 4.5 + index * 3.2
        parts.append(box(f"{name}_landing{index}", (2.6, 0.2, 1.4), (1.6, level, -4.2), materials["frame"], round_by=0.0))
        parts.append(rod(f"{name}_flight{index}", (0.4, level, -4.2), (2.8, level + 3.2, -4.2), 0.18, materials["frame"]))
    for sign in (-1, 1):
        parts.append(box(f"{name}_tray{sign}", (0.5, top - 4, 0.3), (sign * 4.2, 3 + (top - 4) / 2, -TOWER_WIDTH / 2 - 0.4), materials["dark"], round_by=0.0))
    # Carriage rails on the front columns.
    for sign in (-1, 1):
        parts.append(box(f"{name}_rail{sign}", (0.6, top - 8, 0.8), (sign * (TOWER_WIDTH / 2 - 0.2), 6 + (top - 8) / 2, TOWER_WIDTH / 2 + 0.7), materials["steel"], round_by=0.1))
    if modules_standing == 9:
        parts += roof(name, materials)
    else:
        parts.append(lamp(f"{name}_top_light", (TOWER_WIDTH / 2, top + 0.4, TOWER_WIDTH / 2), materials["glow_red"], radius=0.35))
    for level in (40, 80) if top > 80 else (40,):
        for sign in (-1, 1):
            parts.append(lamp(f"{name}_obstruction{level}{sign}", (sign * (TOWER_WIDTH / 2 + 0.5), level, TOWER_WIDTH / 2 + 0.5), materials["glow_red"], radius=0.3))
    combine(f"{name}_body", parts, parent=group)
    return top


def roof(name, materials):
    """Roof crane frame with pulleys over the front, and the lightning mast to 146 m."""
    parts = [box(f"{name}_roof_deck", (TOWER_WIDTH + 1, 1.0, TOWER_WIDTH + 1), (0, LATTICE_TOP + 0.5, 0), materials["frame"], round_by=0.2)]
    parts += truss_beam(f"{name}_roof_beam_l", (-4, LATTICE_TOP + 1, -6), (-4, LATTICE_TOP + 8, 9), 2.0, 2.0, materials["frame"], panels=6)
    parts += truss_beam(f"{name}_roof_beam_r", (4, LATTICE_TOP + 1, -6), (4, LATTICE_TOP + 8, 9), 2.0, 2.0, materials["frame"], panels=6)
    for sign in (-1, 1):
        parts.append(cylinder(f"{name}_pulley{sign}", 1.6, 0.8, (sign * 4, LATTICE_TOP + 8, 9.5), materials["steel"], axis="x", sides=20, round_by=0.1))
        parts.append(box(f"{name}_winch{sign}", (3, 2.4, 4), (sign * 3.5, LATTICE_TOP + 2.2, -3), materials["clay"], round_by=0.2))
    parts.append(cylinder(f"{name}_mast", 0.35, 14, (0, LATTICE_TOP + 9, -4), materials["steel"], sides=10, radius_end=0.12))
    parts.append(lamp(f"{name}_mast_light", (0, LATTICE_TOP + 16.2, -4), materials["glow_red"], radius=0.45))
    parts += railing(f"{name}_roof_rail", [(-6.5, LATTICE_TOP + 1, -6.5), (6.5, LATTICE_TOP + 1, -6.5), (6.5, LATTICE_TOP + 1, 6.5), (-6.5, LATTICE_TOP + 1, 6.5), (-6.5, LATTICE_TOP + 1, -6.5)], 1.1, materials["frame"], post_spacing=2.2)
    return parts


def catch_arm(name, side, materials, carriage):
    """A catch arm: a 4 m deep truss reaching 36 m forward from its hinge on the carriage, with the
    rail the catch pins land on and shock pads at the tip. Pivot: the hinge, rotate about up."""
    hinge = (side * 7.6, 82.0, TOWER_WIDTH / 2 + 1.5)
    x, up, forward = hinge
    length = 36.0
    parts = truss_beam(f"{name}_truss", (x, up, forward + 1.0), (x, up, forward + length), 3.2, 5.6, materials["frame"], panels=12, chord=0.34, web=0.16)
    parts += truss_beam(f"{name}_brace", (x, up - 2.8, forward + 1.0), (x, up - 2.8, forward + length * 0.55), 2.4, 1.6, materials["frame"], panels=6, chord=0.2, web=0.1)
    parts.append(box(f"{name}_rail", (0.9, 0.6, length - 10), (x - side * 1.9, up + 3.0, forward + 6 + (length - 10) / 2), materials["steel"], round_by=0.1))
    parts.append(box(f"{name}_hinge", (3.8, 8.0, 2.6), (x, up, forward), materials["clay"], round_by=0.3))
    for index in range(2):
        parts.append(box(f"{name}_pad{index}", (1.4, 1.3, 2.6), (x - side * 1.9, up + 3.6, forward + 18 + index * 6.5), materials["dark"], round_by=0.25))
    parts.append(box(f"{name}_tip", (3.4, 5.8, 1.2), (x, up, forward + length + 0.4), materials["clay"], round_by=0.25))
    parts.append(lamp(f"{name}_tip_light", (x, up + 2.4, forward + length + 0.8), materials["glow_amber"], radius=0.25))
    parts += railing(f"{name}_walk", [(x + side * 1.6, up + 2.8, forward + 2), (x + side * 1.6, up + 2.8, forward + length - 2)], 1.1, materials["frame"], post_spacing=3.0)
    return combine(name, parts, origin=hinge, parent=carriage)


def carriage(name, materials, group):
    """The carriage that rides the rails up and down, carrying both arms. Pivot: its base on the tower axis."""
    base_up = 78.0
    frame = root(name, (0, base_up, 0))
    frame.parent = group
    parts = []
    for sign in (-1, 1):
        parts.append(box(f"{name}_cheek{sign}", (2.2, 12, 4.5), (sign * (TOWER_WIDTH / 2 + 0.6), base_up + 6, TOWER_WIDTH / 2 + 0.6), materials["clay"], round_by=0.3))
        parts.append(box(f"{name}_side{sign}", (1.0, 12, TOWER_WIDTH + 2), (sign * (TOWER_WIDTH / 2 + 1.4), base_up + 6, 0), materials["frame"], round_by=0.2))
    parts.append(box(f"{name}_cross_top", (TOWER_WIDTH + 4, 1.6, 1.6), (0, base_up + 11.2, TOWER_WIDTH / 2 + 1.6), materials["clay"], round_by=0.2))
    parts.append(box(f"{name}_cross_low", (TOWER_WIDTH + 4, 1.6, 1.6), (0, base_up + 0.8, TOWER_WIDTH / 2 + 1.6), materials["clay"], round_by=0.2))
    parts.append(box(f"{name}_back", (TOWER_WIDTH + 4, 1.2, 1.2), (0, base_up + 6, -TOWER_WIDTH / 2 - 1.4), materials["frame"], round_by=0.2))
    body = combine(f"{name}_frame", parts, origin=(0, base_up, 0))
    body.parent = frame
    body.location = (0, 0, 0)
    for side, label in ((-1, "left"), (1, "right")):
        catch_arm(f"{name}_arm_{label}", side, materials, frame)
    return frame


def qd_arm(name, materials, group):
    """Ship quick-disconnect arm: a 20 m truss with an umbilical hood at its tip. Pivot: hinge, rotate about up."""
    hinge = (0.0, 94.2, TOWER_WIDTH / 2 + 0.8)
    x, up, forward = hinge
    parts = truss_beam(f"{name}_truss", (x, up, forward + 1), (x, up, forward + 16.6), 2.2, 2.6, materials["frame"], panels=7)
    parts.append(box(f"{name}_hood", (2.6, 4.0, 2.2), (x, up, forward + 17.6), materials["clay"], round_by=0.3))
    parts.append(box(f"{name}_hinge", (2.6, 4.0, 2.0), (x, up, forward), materials["clay"], round_by=0.3))
    for index in range(3):
        parts.append(cylinder(f"{name}_line{index}", 0.22, 16, (x - 0.6 + index * 0.6, up - 1.6, forward + 8.5), materials["dark"], axis="forward", sides=8))
    return combine(name, parts, origin=hinge, parent=group)


def tower(name):
    materials = palette()
    group = root(name)
    tower_body(name, 9, materials, group)
    carriage(f"{name}_carriage", materials, group)
    qd_arm(f"{name}_qd_arm", materials, group)
    return group


def tower_build(name):
    """The second pad's tower: five modules standing, a module waiting on the ground beside it."""
    materials = palette()
    group = root(name)
    top = tower_body(name, 5, materials, group)
    parts = lattice_tower(f"{name}_next", (20, 0, -6), TOWER_WIDTH, 0.5, 14.6, 1, materials["frame"], column=1.3, brace=0.32)
    parts.append(box(f"{name}_cribbing", (14, 0.5, 14), (20, 0.25, -6), materials["dark"], round_by=0.05))
    combine(f"{name}_module_waiting", parts, parent=group)
    return group, top


def mount(name, height, legs, materials, group, deluge=True):
    """Launch table on splayed legs with hold-down clamps; a steel deflector plate with water ports."""
    parts = [box(f"{name}_pad", (60, 1.0, 60), (0, 0.5, 0), materials["concrete"], round_by=0.4)]
    leg_radius = 10.0
    for index in range(legs):
        angle = 2 * math.pi * (index + 0.5) / legs
        foot = around(leg_radius + 1.2, angle, 1.0)
        head = around(leg_radius - 0.4, angle, height - 5.0)
        leg = rod(f"{name}_leg{index}", foot, head, 2.6, materials["clay"], sides=8)
        parts.append(leg)
        parts.append(box(f"{name}_footing{index}", (6.5, 1.6, 6.5), (foot[0], 1.8, foot[2]), materials["concrete"], round_by=0.2))
    parts.append(annulus(f"{name}_table", 4.9, 10.5, height - 6.0, height, (0, 0, 0), materials["clay"], sides=48))
    parts.append(annulus(f"{name}_skirt", 10.5, 10.8, height - 5.4, height - 0.6, (0, 0, 0), materials["frame"], sides=48))
    for index in range(20):
        angle = 2 * math.pi * index / 20
        x, _, z = around(5.4, angle, 0)
        clamp = box(f"{name}_clamp{index}", (0.9, 1.4, 1.2), (x, height + 0.7, z), materials["dark"], round_by=0.15)
        turn(clamp, "up", angle)
        parts.append(clamp)
    parts += railing(f"{name}_table_rail", [around(10.4, 2 * math.pi * index / 24, height) for index in range(25)], 1.1, materials["frame"], post_spacing=3.5)
    parts += lattice_tower(f"{name}_stair_tower", (13.5, 0, -6.0), 3.6, 1.0, height, max(2, int(height / 4)), materials["frame"], column=0.35, brace=0.09)
    for flight in range(int(height / 3.2)):
        level = 1.0 + flight * 3.2
        side = 1 if flight % 2 else -1
        parts.append(rod(f"{name}_flight{flight}", (13.5 - 1.4 * side, level, -6.0), (13.5 + 1.4 * side, level + 3.2, -6.0), 0.35, materials["frame"], sides=4))
    if deluge:
        parts.append(cylinder(f"{name}_deflector", 9.0, 1.2, (0, 1.6, 0), materials["steel"], sides=48, round_by=0.3))
        for index in range(36):
            angle = 2 * math.pi * index / 36
            parts.append(cylinder(f"{name}_port{index}", 0.22, 0.25, around(6.0 + (index % 2) * 1.8, angle, 2.3), materials["dark"], sides=8))
        for sign in (-1, 1):
            parts.append(cylinder(f"{name}_water_main{sign}", 0.9, 24, (sign * 2.5, 1.9, -20), materials["frame"], axis="forward", sides=14, round_by=0.1))
    return parts


def launch_mount(name):
    materials = palette()
    group = root(name)
    parts = mount(name, MOUNT_TOP, 6, materials, group)
    combine(f"{name}_body", parts, parent=group)
    hinge = (0, MOUNT_TOP - 1.0, -8.8)
    qd = [box(f"{name}_qd_boom", (2.0, 2.2, 5.0), (0, MOUNT_TOP - 1.0, -6.6), materials["clay"], round_by=0.25),
          box(f"{name}_qd_hood", (2.6, 3.2, 1.2), (0, MOUNT_TOP + 1.2, -4.4), materials["dark"], round_by=0.2)]
    combine(f"{name}_booster_qd", qd, origin=hinge, parent=group)
    return group


def test_stand(name):
    """Suborbital test stand: a 10 m stand on four legs and a 30 m service tower with a swing arm."""
    materials = palette()
    group = root(name)
    parts = mount(name, 10.0, 4, materials, group, deluge=False)
    parts.append(cylinder(f"{name}_deflector", 7.0, 0.9, (0, 1.4, 0), materials["steel"], sides=40, round_by=0.25))
    parts += lattice_tower(f"{name}_service", (0, 0, -16), 6.0, 1.0, 31.0, 4, materials["frame"], column=0.7, brace=0.2)
    parts += ladder(f"{name}_ladder", (3.4, 1.0, -16), 30.0, materials["frame"], facing="x")
    parts.append(lamp(f"{name}_top_light", (0, 31.6, -16), materials["glow_red"], radius=0.3))
    for index in range(3):
        parts.append(cylinder(f"{name}_feed{index}", 0.45, 30, (-8 + index * 1.4, 1.5, -2), materials["frame"], axis="x", sides=12))
    combine(f"{name}_body", parts, parent=group)
    hinge = (2.0, 26.0, -13.0)
    arm = truss_beam(f"{name}_arm", (2.0, 26.0, -12.0), (2.0, 26.0, -5.4), 1.6, 1.8, materials["frame"], panels=4)
    arm.append(box(f"{name}_arm_hood", (1.8, 2.4, 1.0), (2.0, 25.6, -4.8), materials["clay"], round_by=0.2))
    combine(f"{name}_swing_arm", arm, origin=hinge, parent=group)
    return group


def build():
    reset_scene()
    tower("tower")
    tower_build("tower_build")
    launch_mount("launch_mount")
    test_stand("test_stand")
    export("pad.glb")
