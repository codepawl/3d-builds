import bpy
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import argon_fab_lib as fl


def create_rooftop_fan(name, loc, radius=0.65, parent=None, pal=None):
    """Create a separate named rotating fan rotor centered at local (0,0,0) with 6 visible angled blades."""
    hub = fl.add_bevel_cylinder(
        name,
        radius=radius * 0.28,
        depth=0.16,
        vertices=16,
        loc=loc,
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=parent,
    )
    blades = []
    for i in range(6):
        ang = i * (math.pi / 3.0)
        bx = math.cos(ang) * (radius * 0.55)
        by = math.sin(ang) * (radius * 0.55)
        blade = fl.add_bevel_box(
            f"{name}_b{i}",
            size=(radius * 0.62, radius * 0.22, 0.035),
            loc=(loc[0] + bx, loc[1] + by, loc[2] + 0.02),
            rot=(0.28 * math.sin(ang), 0.28 * math.cos(ang), ang),
            bevel_width=0.005,
            mat=pal["silver"],
            parent=parent,
        )
        blades.append(blade)
    return fl.merge_objects_into(hub, blades)


def build_fab_buildings():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: FabBuilding_Logic300mm (300mm Flagship Logic Fab Cutaway Shell)
    # =========================================================================
    v1_root = fl.make_root("FabBuilding_Logic300mm", loc=(-22.0, 0.0, 0.0))
    hull = fl.add_bevel_box(
        "Logic300_Structure",
        size=(16.0, 12.0, 0.6),
        loc=(0.0, 0.0, 0.3),
        bevel_width=0.06,
        mat=pal["concrete"],
        parent=v1_root,
    )
    v1_parts = []
    sub_wall_back = fl.add_bevel_box(
        "l1_sub_back",
        size=(15.8, 0.45, 2.2),
        loc=(0.0, 5.75, 1.7),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    sub_wall_left = fl.add_bevel_box(
        "l1_sub_left",
        size=(0.45, 11.8, 2.2),
        loc=(-7.75, 0.0, 1.7),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    sub_wall_right = fl.add_bevel_box(
        "l1_sub_right",
        size=(0.45, 11.8, 2.2),
        loc=(7.75, 0.0, 1.7),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    waffle_deck = fl.add_bevel_box(
        "l1_waffle_deck",
        size=(15.4, 11.4, 0.28),
        loc=(0.0, 0.1, 2.65),
        bevel_width=0.02,
        mat=pal["waffle_tile"],
        parent=v1_root,
    )
    upper_back = fl.add_bevel_box(
        "l1_upper_back",
        size=(15.8, 0.42, 4.0),
        loc=(0.0, 5.75, 4.8),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    upper_left = fl.add_bevel_box(
        "l1_upper_left",
        size=(0.42, 11.8, 4.0),
        loc=(-7.75, 0.0, 4.8),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    upper_right = fl.add_bevel_box(
        "l1_upper_right",
        size=(0.42, 11.8, 4.0),
        loc=(7.75, 0.0, 4.8),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    fascia_back = fl.add_bevel_box(
        "l1_fascia_back",
        size=(16.1, 0.55, 0.65),
        loc=(0.0, 5.75, 6.65),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    fascia_left = fl.add_bevel_box(
        "l1_fascia_left",
        size=(0.55, 12.1, 0.65),
        loc=(-7.75, 0.0, 6.65),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    fascia_right = fl.add_bevel_box(
        "l1_fascia_right",
        size=(0.55, 12.1, 0.65),
        loc=(7.75, 0.0, 6.65),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    fascia_front = fl.add_bevel_box(
        "l1_fascia_front",
        size=(16.1, 0.42, 0.50),
        loc=(0.0, -5.75, 6.65),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    v1_parts.extend([
        sub_wall_back, sub_wall_left, sub_wall_right, waffle_deck,
        upper_back, upper_left, upper_right,
        fascia_back, fascia_left, fascia_right, fascia_front,
    ])

    for cx in (-7.75, -3.8, 0.0, 3.8, 7.75):
        col = fl.add_bevel_box(
            f"l1_col_{cx}",
            size=(0.38, 0.38, 6.2),
            loc=(cx, -5.75, 3.4),
            bevel_width=0.02,
            mat=pal["slate"],
            parent=v1_root,
        )
        v1_parts.append(col)

    for tx in (-5.5, -1.8, 1.8, 5.5):
        truss = fl.add_bevel_box(
            f"l1_truss_{tx}",
            size=(0.24, 11.6, 0.28),
            loc=(tx, 0.0, 6.55),
            bevel_width=0.015,
            mat=pal["silver"],
            parent=v1_root,
        )
        led = fl.add_bevel_box(
            f"l1_led_{tx}",
            size=(0.12, 10.6, 0.04),
            loc=(tx, 0.0, 6.39),
            bevel_width=0.005,
            mat=pal["emit_white"],
            parent=v1_root,
        )
        v1_parts.extend([truss, led])

    roof_slab = fl.add_bevel_box(
        "l1_roof_back",
        size=(15.9, 3.8, 0.25),
        loc=(0.0, 4.0, 6.95),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    v1_parts.append(roof_slab)
    for fx, idx in ((-4.2, 1), (4.2, 2)):
        ahu = fl.add_bevel_box(
            f"l1_ahu_{idx}",
            size=(3.2, 2.2, 1.05),
            loc=(fx, 4.1, 7.55),
            bevel_width=0.04,
            mat=pal["white"],
            parent=v1_root,
        )
        shroud = fl.add_bevel_cylinder(
            f"l1_shroud_{idx}",
            radius=0.82,
            depth=0.22,
            vertices=24,
            loc=(fx, 4.1, 8.15),
            bevel_width=0.02,
            mat=pal["slate"],
            parent=v1_root,
        )
        v1_parts.extend([ahu, shroud])
        create_rooftop_fan(f"RooftopFan_0{idx}", loc=(fx, 4.1, 8.32), radius=0.72, parent=v1_root, pal=pal)

    for wy in (-3.6, 0.0, 3.6):
        win = fl.add_bevel_box(
            f"l1_win_{wy}",
            size=(0.48, 2.4, 1.5),
            loc=(-7.75, wy, 4.7),
            bevel_width=0.015,
            mat=pal["glass_dark"],
            parent=v1_root,
        )
        v1_parts.append(win)
        v1_parts.append(
            fl.add_vent_grille(f"l1_vent_{wy}", (-7.78, wy, 1.65), size=(0.08, 1.8, 0.8), slats=5, axis="X", parent=v1_root, pal=pal)
        )

    for dx, idx in ((4.6, 1), (6.4, 2)):
        frame = fl.add_bevel_box(
            f"l1_dframe_{idx}",
            size=(1.35, 0.35, 1.65),
            loc=(dx, -5.75, 1.42),
            bevel_width=0.02,
            mat=pal["slate"],
            parent=v1_root,
        )
        v1_parts.append(frame)
        fl.add_bevel_box(
            f"DockDoor_0{idx}",
            size=(1.18, 0.08, 1.48),
            loc=(dx, -5.75, 2.15),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=v1_root,
            pivot_offset=(0.0, 0.0, -0.74),
        )

    v1_parts.append(fl.add_signage_plate("l1_sign", (-5.2, -5.98, 6.65), size=(3.2, 0.08, 0.42), parent=v1_root, pal=pal))
    fl.merge_objects_into(hull, v1_parts)

    # =========================================================================
    # VARIANT 2: FabBuilding_RampUp (Second Fab Under Ramp-Up with Tower Crane)
    # =========================================================================
    v2_root = fl.make_root("FabBuilding_RampUp", loc=(0.0, 0.0, 0.0))
    hull2 = fl.add_bevel_box(
        "RampUp_Structure",
        size=(15.0, 11.0, 0.6),
        loc=(0.0, 0.0, 0.3),
        bevel_width=0.06,
        mat=pal["concrete"],
        parent=v2_root,
    )
    v2_parts = []
    for cx in (-6.8, -2.4, 2.4, 6.8):
        for cy in (-4.8, 0.0, 4.8):
            scol = fl.add_bevel_box(
                f"r2_col_{cx}_{cy}",
                size=(0.36, 0.36, 6.2),
                loc=(cx, cy, 3.4),
                bevel_width=0.02,
                mat=pal["slate"],
                parent=v2_root,
            )
            v2_parts.append(scol)
    deck_installed = fl.add_bevel_box(
        "r2_deck_left",
        size=(8.2, 10.2, 0.26),
        loc=(-3.0, 0.0, 2.55),
        bevel_width=0.02,
        mat=pal["waffle_tile"],
        parent=v2_root,
    )
    deck_raw = fl.add_bevel_box(
        "r2_deck_right",
        size=(6.0, 10.2, 0.22),
        loc=(4.1, 0.0, 2.53),
        bevel_width=0.02,
        mat=pal["silver"],
        parent=v2_root,
    )
    cladding_back = fl.add_bevel_box(
        "r2_clad_back",
        size=(14.2, 0.38, 5.8),
        loc=(0.0, 5.1, 3.5),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v2_root,
    )
    cladding_left = fl.add_bevel_box(
        "r2_clad_left",
        size=(0.38, 10.4, 5.8),
        loc=(-7.1, 0.0, 3.5),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v2_root,
    )
    brand_header = fl.add_bevel_box(
        "r2_brand",
        size=(14.5, 0.48, 0.6),
        loc=(0.0, 5.1, 6.3),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    safety_rail = fl.add_bevel_box(
        "r2_safety_rail",
        size=(6.2, 0.12, 0.9),
        loc=(4.0, -4.8, 3.1),
        bevel_width=0.015,
        mat=pal["safety_yellow"],
        parent=v2_root,
    )
    crane_mast = fl.add_bevel_box(
        "r2_crane_mast",
        size=(0.75, 0.75, 9.2),
        loc=(6.2, 4.2, 4.9),
        bevel_width=0.02,
        mat=pal["safety_yellow"],
        parent=v2_root,
    )
    v2_parts.extend([deck_installed, deck_raw, cladding_back, cladding_left, brand_header, safety_rail, crane_mast])
    fl.merge_objects_into(hull2, v2_parts)

    jib = fl.add_bevel_box(
        "TowerCraneJib",
        size=(9.5, 0.52, 0.52),
        loc=(6.2, 4.2, 9.55),
        bevel_width=0.02,
        mat=pal["safety_yellow"],
        parent=v2_root,
        pivot_offset=(-2.8, 0.0, 0.26),
    )
    cweight = fl.add_bevel_box(
        "jib_cw",
        size=(1.4, 0.68, 0.65),
        loc=(6.2, 4.2, 9.55),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=v2_root,
        pivot_offset=(1.5, 0.0, 0.28),
    )
    cab = fl.add_bevel_box(
        "jib_cab",
        size=(0.75, 0.65, 0.80),
        loc=(6.2, 4.2, 9.55),
        bevel_width=0.02,
        mat=pal["glass_dark"],
        parent=v2_root,
        pivot_offset=(0.0, -0.55, 0.35),
    )
    fl.merge_objects_into(jib, [cweight, cab])

    trolley = fl.add_bevel_box(
        "TowerCraneTrolley",
        size=(0.55, 0.58, 0.24),
        loc=(-3.8, 0.0, -0.05),
        bevel_width=0.015,
        mat=pal["slate"],
        parent=jib,
    )
    hook = fl.add_bevel_cylinder(
        "TowerCraneHook",
        radius=0.06,
        depth=2.2,
        vertices=12,
        loc=(0.0, 0.0, -0.12),
        bevel_width=0.005,
        mat=pal["chrome"],
        parent=trolley,
        pivot_offset=(0.0, 0.0, -1.1),
    )
    block = fl.add_bevel_box(
        "hook_block",
        size=(0.35, 0.22, 0.35),
        loc=(0.0, 0.0, -0.12),
        bevel_width=0.015,
        mat=pal["safety_yellow"],
        parent=trolley,
        pivot_offset=(0.0, 0.0, -2.25),
    )
    fl.merge_objects_into(hook, [block])

    fl.add_bevel_box(
        "MoveInDoor",
        size=(2.4, 0.10, 2.6),
        loc=(-3.6, -4.8, 5.2),
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=v2_root,
        pivot_offset=(0.0, 0.0, -1.3),
    )

    # =========================================================================
    # VARIANT 3: FabBuilding_Packaging (Advanced 2.5D/3D Packaging Cutaway Plant)
    # =========================================================================
    v3_root = fl.make_root("FabBuilding_Packaging", loc=(22.0, 0.0, 0.0))
    hull3 = fl.add_bevel_box(
        "Packaging_Structure",
        size=(14.0, 10.5, 0.5),
        loc=(0.0, 0.0, 0.25),
        bevel_width=0.05,
        mat=pal["concrete"],
        parent=v3_root,
    )
    v3_parts = []
    floor_pack = fl.add_bevel_box(
        "p3_floor",
        size=(13.4, 9.9, 0.24),
        loc=(0.0, 0.0, 0.62),
        bevel_width=0.02,
        mat=pal["waffle_tile"],
        parent=v3_root,
    )
    wall_b = fl.add_bevel_box(
        "p3_wall_b",
        size=(13.8, 0.38, 4.4),
        loc=(0.0, 5.0, 2.7),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    wall_l = fl.add_bevel_box(
        "p3_wall_l",
        size=(0.38, 10.2, 4.4),
        loc=(-6.7, 0.0, 2.7),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    wall_r = fl.add_bevel_box(
        "p3_wall_r",
        size=(0.38, 10.2, 4.4),
        loc=(6.7, 0.0, 2.7),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    # Perimeter cutaway Cobalt Blue fascia frame (open cutaway center!)
    p_fb = fl.add_bevel_box("p3_fb", (14.1, 0.50, 0.52), (0.0, 5.0, 4.85), bevel_width=0.03, mat=pal["brand_blue"], parent=v3_root)
    p_ff = fl.add_bevel_box("p3_ff", (14.1, 0.42, 0.48), (0.0, -5.0, 4.85), bevel_width=0.03, mat=pal["brand_blue"], parent=v3_root)
    p_fl = fl.add_bevel_box("p3_fl", (0.50, 10.4, 0.52), (-6.7, 0.0, 4.85), bevel_width=0.03, mat=pal["brand_blue"], parent=v3_root)
    p_fr = fl.add_bevel_box("p3_fr", (0.50, 10.4, 0.52), (6.7, 0.0, 4.85), bevel_width=0.03, mat=pal["brand_blue"], parent=v3_root)
    p_roof_rear = fl.add_bevel_box("p3_roof_rear", (13.8, 3.2, 0.22), (0.0, 3.5, 5.02), bevel_width=0.02, mat=pal["light_panel"], parent=v3_root)
    v3_parts.extend([floor_pack, wall_b, wall_l, wall_r, p_fb, p_ff, p_fl, p_fr, p_roof_rear])

    # Cutaway roof trusses & front columns on Packaging Plant
    for tx in (-4.2, 0.0, 4.2):
        ptruss = fl.add_bevel_box(f"p3_truss_{tx}", (0.22, 10.0, 0.24), (tx, 0.0, 4.78), bevel_width=0.015, mat=pal["silver"], parent=v3_root)
        pcol = fl.add_bevel_box(f"p3_col_{tx}", (0.34, 0.34, 4.4), (tx, -5.0, 2.65), bevel_width=0.02, mat=pal["slate"], parent=v3_root)
        v3_parts.extend([ptruss, pcol])

    glass_front = fl.add_bevel_box(
        "p3_glass_front",
        size=(8.0, 0.18, 3.2),
        loc=(-2.2, -5.0, 2.4),
        bevel_width=0.02,
        mat=pal["glass_clear"],
        parent=v3_root,
    )
    v3_parts.append(glass_front)
    for fx in (-3.5, 3.5):
        shroud = fl.add_bevel_cylinder(
            f"p3_shroud_{fx}",
            radius=0.72,
            depth=0.22,
            vertices=24,
            loc=(fx, 3.6, 5.20),
            bevel_width=0.015,
            mat=pal["silver"],
            parent=v3_root,
        )
        well = fl.add_bevel_cylinder(
            f"p3_well_{fx}",
            radius=0.64,
            depth=0.06,
            vertices=24,
            loc=(fx, 3.6, 5.19),
            bevel_width=0.008,
            mat=pal["slate"],
            parent=v3_root,
        )
        v3_parts.extend([shroud, well])
    fl.merge_objects_into(hull3, v3_parts)

    create_rooftop_fan("PackExhaustFan_01", loc=(-3.5, 3.6, 5.28), radius=0.62, parent=v3_root, pal=pal)
    create_rooftop_fan("PackExhaustFan_02", loc=(3.5, 3.6, 5.28), radius=0.62, parent=v3_root, pal=pal)
    for dx, idx in ((3.6, 1), (5.2, 2)):
        fl.add_bevel_box(
            f"PackDockDoor_0{idx}",
            size=(1.15, 0.08, 1.5),
            loc=(dx, -5.0, 2.1),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=v3_root,
            pivot_offset=(0.0, 0.0, -0.75),
        )

    fl.export_glb("fab_buildings.glb")


def build_cleanroom_bays():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: CleanroomBay_Standard (Standard White Cleanroom Bay Module)
    # =========================================================================
    b1_root = fl.make_root("CleanroomBay_Standard", loc=(-16.0, 0.0, 0.0))
    b1_floor = fl.add_bevel_box(
        "BayStd_Floor",
        size=(6.0, 6.0, 0.22),
        loc=(0.0, 0.0, 0.11),
        bevel_width=0.015,
        mat=pal["waffle_tile"],
        parent=b1_root,
    )
    b1_parts = []
    for px in (-2.6, 0.0, 2.6):
        for py in (-2.6, 0.0, 2.6):
            ped = fl.add_bevel_cylinder(
                f"b1_ped_{px}_{py}",
                radius=0.06,
                depth=0.12,
                vertices=10,
                loc=(px, py, 0.06),
                bevel_width=0.005,
                mat=pal["silver"],
                parent=b1_root,
            )
            b1_parts.append(ped)
    wall_rear = fl.add_bevel_box(
        "b1_wall_rear",
        size=(6.0, 0.22, 3.6),
        loc=(0.0, 2.89, 1.95),
        bevel_width=0.02,
        mat=pal["white"],
        parent=b1_root,
    )
    b1_parts.append(wall_rear)
    # Front corner columns + left/right upper tie-beams so ceiling FFU frame is physically supported!
    for sx in (-2.88, 2.88):
        fcol = fl.add_bevel_box(f"b1_fcol_{sx}", (0.22, 0.22, 3.6), (sx, -2.88, 1.95), bevel_width=0.015, mat=pal["white"], parent=b1_root)
        tie = fl.add_bevel_box(f"b1_tie_{sx}", (0.18, 6.0, 0.16), (sx, 0.0, 3.72), bevel_width=0.01, mat=pal["silver"], parent=b1_root)
        b1_parts.extend([fcol, tie])

    for wx in (-1.6, 1.6):
        win = fl.add_bevel_box(
            f"b1_win_{wx}",
            size=(1.8, 0.26, 1.3),
            loc=(wx, 2.89, 2.15),
            bevel_width=0.01,
            mat=pal["glass_clear"],
            parent=b1_root,
        )
        b1_parts.append(win)
        b1_parts.append(
            fl.add_vent_grille(f"b1_ret_{wx}", (wx, 2.76, 0.65), size=(1.6, 0.05, 0.45), slats=5, axis="Y", parent=b1_root, pal=pal)
        )
    for gy in (-2.8, 0.0, 2.8):
        beam = fl.add_bevel_box(
            f"b1_ffu_{gy}",
            size=(6.0, 0.16, 0.14),
            loc=(0.0, gy, 3.72),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=b1_root,
        )
        led = fl.add_bevel_box(
            f"b1_led_{gy}",
            size=(5.6, 0.06, 0.04),
            loc=(0.0, gy, 3.63),
            bevel_width=0.005,
            mat=pal["emit_white"],
            parent=b1_root,
        )
        b1_parts.extend([beam, led])

    b1_parts.append(fl.add_signage_plate("b1_sign", (0.0, 2.75, 3.35), size=(1.4, 0.04, 0.28), parent=b1_root, pal=pal))
    fl.merge_objects_into(b1_floor, b1_parts)

    fl.add_bevel_box(
        "BayDoor_SlideLeft",
        size=(0.95, 0.06, 2.2),
        loc=(-0.95, -2.88, 0.22),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=b1_root,
        pivot_offset=(0.475, 0.0, 1.1),
    )
    fl.add_bevel_box(
        "BayDoor_SlideRight",
        size=(0.95, 0.06, 2.2),
        loc=(0.95, -2.88, 0.22),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=b1_root,
        pivot_offset=(-0.475, 0.0, 1.1),
    )

    # =========================================================================
    # VARIANT 2: CleanroomBay_YellowLitho (Photolithography Yellow-Lit Bay)
    # =========================================================================
    b2_root = fl.make_root("CleanroomBay_YellowLitho", loc=(-8.0, 0.0, 0.0))
    b2_floor = fl.add_bevel_box(
        "BayLitho_Floor",
        size=(6.0, 6.0, 0.24),
        loc=(0.0, 0.0, 0.12),
        bevel_width=0.015,
        mat=pal["waffle_tile"],
        parent=b2_root,
    )
    b2_parts = []
    iso_pad = fl.add_bevel_box(
        "b2_iso_pad",
        size=(4.2, 3.6, 0.05),
        loc=(0.0, 0.2, 0.25),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=b2_root,
    )
    ywall_rear = fl.add_bevel_box(
        "b2_ywall_rear",
        size=(6.0, 0.18, 3.6),
        loc=(0.0, 2.89, 1.95),
        bevel_width=0.02,
        mat=pal["white"],
        parent=b2_root,
    )
    yglass_rear = fl.add_bevel_box(
        "b2_yglass_rear",
        size=(5.2, 0.22, 2.1),
        loc=(0.0, 2.89, 2.15),
        bevel_width=0.01,
        mat=pal["glass_yellow_litho"],
        parent=b2_root,
    )
    yglass_left = fl.add_bevel_box(
        "b2_yglass_left",
        size=(0.16, 5.6, 3.4),
        loc=(-2.9, 0.0, 1.95),
        bevel_width=0.01,
        mat=pal["glass_yellow_litho"],
        parent=b2_root,
    )
    # Front corner columns + side tie-beams so yellow-bay ceiling frame is fully supported!
    for sx in (-2.88, 2.88):
        fcol = fl.add_bevel_box(f"b2_fcol_{sx}", (0.22, 0.22, 3.6), (sx, -2.88, 1.95), bevel_width=0.015, mat=pal["white"], parent=b2_root)
        tie = fl.add_bevel_box(f"b2_tie_{sx}", (0.18, 6.0, 0.16), (sx, 0.0, 3.72), bevel_width=0.01, mat=pal["silver"], parent=b2_root)
        b2_parts.extend([fcol, tie])

    b2_parts.extend([iso_pad, ywall_rear, yglass_rear, yglass_left])

    for gy in (-2.4, 0.0, 2.4):
        beam = fl.add_bevel_box(
            f"b2_beam_{gy}",
            size=(6.0, 0.16, 0.14),
            loc=(0.0, gy, 3.72),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=b2_root,
        )
        yled = fl.add_bevel_box(
            f"b2_yled_{gy}",
            size=(5.6, 0.08, 0.05),
            loc=(0.0, gy, 3.62),
            bevel_width=0.005,
            mat=pal["emit_amber"],
            parent=b2_root,
        )
        b2_parts.extend([beam, yled])

    b2_parts.append(fl.add_signage_plate("b2_sign", (0.0, 2.75, 3.45), size=(1.8, 0.04, 0.28), parent=b2_root, pal=pal, accent="yellow"))
    fl.merge_objects_into(b2_floor, b2_parts)

    fl.add_bevel_box(
        "LithoDoor_L",
        size=(0.90, 0.06, 2.2),
        loc=(-0.90, -2.88, 0.24),
        bevel_width=0.01,
        mat=pal["glass_yellow_litho"],
        parent=b2_root,
        pivot_offset=(0.45, 0.0, 1.1),
    )
    fl.add_bevel_box(
        "LithoDoor_R",
        size=(0.90, 0.06, 2.2),
        loc=(0.90, -2.88, 0.24),
        bevel_width=0.01,
        mat=pal["glass_yellow_litho"],
        parent=b2_root,
        pivot_offset=(-0.45, 0.0, 1.1),
    )

    # =========================================================================
    # VARIANT 3: CleanroomWalkway_Corridor (Central Spine Chase & Gowning Airlock)
    # =========================================================================
    b3_root = fl.make_root("CleanroomWalkway_Corridor", loc=(0.0, 0.0, 0.0))
    b3_floor = fl.add_bevel_box(
        "Corridor_Floor",
        size=(6.0, 3.6, 0.22),
        loc=(0.0, 0.0, 0.11),
        bevel_width=0.015,
        mat=pal["waffle_tile"],
        parent=b3_root,
    )
    b3_parts = []
    for sy in (-1.45, 1.45):
        stripe = fl.add_bevel_box(
            f"b3_stripe_{sy}",
            size=(5.9, 0.12, 0.015),
            loc=(0.0, sy, 0.225),
            bevel_width=0.003,
            mat=pal["brand_blue"],
            parent=b3_root,
        )
        b3_parts.append(stripe)
    for bx in (-2.2, 0.0, 2.2):
        bol = fl.add_bevel_cylinder(
            f"b3_bol_{bx}",
            radius=0.065,
            depth=0.85,
            vertices=14,
            loc=(bx, 1.35, 0.64),
            bevel_width=0.01,
            mat=pal["safety_yellow"],
            parent=b3_root,
        )
        b3_parts.append(bol)
    # Support stanchions + Digital Fab KPI Wall Display Board on rear wall
    for kx in (-0.95, 0.95):
        kpost = fl.add_bevel_box(
            f"b3_kpost_{kx}",
            size=(0.12, 0.12, 2.45),
            loc=(kx, 1.68, 1.35),
            bevel_width=0.01,
            mat=pal["slate"],
            parent=b3_root,
        )
        b3_parts.append(kpost)
    kpi_board = fl.add_bevel_box(
        "b3_kpi_frame",
        size=(2.4, 0.14, 1.1),
        loc=(0.0, 1.68, 2.1),
        bevel_width=0.015,
        mat=pal["slate"],
        parent=b3_root,
    )
    kpi_screen = fl.add_bevel_box(
        "b3_kpi_scr",
        size=(2.26, 0.15, 0.96),
        loc=(0.0, 1.67, 2.1),
        bevel_width=0.008,
        mat=pal["console_screen"],
        parent=b3_root,
    )
    # Airlock doorway portal frame on left
    al_frame = fl.add_bevel_box(
        "b3_al_frame",
        size=(0.18, 1.32, 2.32),
        loc=(-2.90, 0.0, 1.28),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=b3_root,
    )
    b3_parts.extend([kpi_board, kpi_screen, al_frame])
    fl.merge_objects_into(b3_floor, b3_parts)

    fl.add_bevel_box(
        "AirlockDoor",
        size=(0.08, 1.1, 2.15),
        loc=(-2.92, -0.55, 0.22),
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=b3_root,
        pivot_offset=(0.0, 0.55, 1.075),
    )

    # =========================================================================
    # VARIANT 4: SubFabDeck_Module (Sub-Fab Structural Mezzanine & Pipe Rack)
    # =========================================================================
    b4_root = fl.make_root("SubFabDeck_Module", loc=(8.0, 0.0, 0.0))
    b4_floor = fl.add_bevel_box(
        "SubFab_Slab",
        size=(6.0, 6.0, 0.25),
        loc=(0.0, 0.0, 0.125),
        bevel_width=0.02,
        mat=pal["concrete"],
        parent=b4_root,
    )
    b4_parts = []
    for cx in (-2.6, 2.6):
        for cy in (-2.6, 2.6):
            col = fl.add_bevel_box(
                f"b4_col_{cx}_{cy}",
                size=(0.28, 0.28, 3.2),
                loc=(cx, cy, 1.85),
                bevel_width=0.015,
                mat=pal["slate"],
                parent=b4_root,
            )
            b4_parts.append(col)
        # Transverse pipe-rack support crossbeams connecting Y=-2.6 to Y=+2.6!
        xbeam = fl.add_bevel_box(
            f"b4_xbeam_{cx}",
            size=(0.24, 5.48, 0.20),
            loc=(cx, 0.0, 2.95),
            bevel_width=0.015,
            mat=pal["slate"],
            parent=b4_root,
        )
        b4_parts.append(xbeam)

    pipe_specs = [
        (-0.9, pal["upw_teal"], 0.09),
        (-0.3, pal["brand_blue"], 0.08),
        (0.3, pal["silver"], 0.14),
        (0.9, pal["copper"], 0.07),
    ]
    for py_off, pmat, prad in pipe_specs:
        pipe = fl.add_bevel_cylinder(
            f"b4_pipe_{py_off}",
            radius=prad,
            depth=5.9,
            vertices=16,
            loc=(0.0, py_off, 3.15),
            rot=(0.0, math.pi / 2.0, 0.0),
            bevel_width=0.008,
            mat=pmat,
            parent=b4_root,
        )
        b4_parts.append(pipe)
    fl.merge_objects_into(b4_floor, b4_parts)

    fl.add_bevel_box(
        "ServiceHatch_01",
        size=(1.1, 1.1, 0.05),
        loc=(-1.2, -1.2, 0.26),
        bevel_width=0.008,
        mat=pal["safety_yellow"],
        parent=b4_root,
        pivot_offset=(0.55, 0.0, 0.0),
    )

    # =========================================================================
    # VARIANT 5: CleanroomProps_Consoles (Cleanroom Operator Workstation Desk)
    # =========================================================================
    b5_root = fl.make_root("CleanroomProps_Consoles", loc=(15.0, 0.0, 0.0))
    desk = fl.add_bevel_box(
        "Console_Desk",
        size=(1.8, 0.85, 0.78),
        loc=(0.0, 0.0, 0.39),
        bevel_width=0.02,
        mat=pal["white"],
        parent=b5_root,
    )
    b5_parts = []
    top = fl.add_bevel_box(
        "c5_top",
        size=(1.88, 0.92, 0.05),
        loc=(0.0, 0.0, 0.80),
        bevel_width=0.01,
        mat=pal["silver"],
        parent=b5_root,
    )
    trim = fl.add_bevel_box(
        "c5_trim",
        size=(1.82, 0.04, 0.14),
        loc=(0.0, -0.42, 0.68),
        bevel_width=0.006,
        mat=pal["brand_blue"],
        parent=b5_root,
    )
    b5_parts.extend([top, trim])
    fl.merge_objects_into(desk, b5_parts)

    arm = fl.add_bevel_cylinder(
        "MonitorArm_Pivot",
        radius=0.035,
        depth=0.42,
        vertices=12,
        loc=(0.0, 0.22, 0.82),
        bevel_width=0.005,
        mat=pal["chrome"],
        parent=b5_root,
        pivot_offset=(0.0, 0.0, 0.21),
    )
    m_parts = []
    for mx in (-0.36, 0.36):
        mon = fl.add_bevel_box(
            f"c5_mon_{mx}",
            size=(0.64, 0.04, 0.40),
            loc=(0.0, 0.22, 0.82),
            bevel_width=0.008,
            mat=pal["slate"],
            parent=b5_root,
            pivot_offset=(mx, -0.08, 0.38),
        )
        scr = fl.add_bevel_box(
            f"c5_scr_{mx}",
            size=(0.58, 0.045, 0.34),
            loc=(0.0, 0.22, 0.82),
            bevel_width=0.004,
            mat=pal["console_screen"],
            parent=b5_root,
            pivot_offset=(mx, -0.085, 0.38),
        )
        m_parts.extend([mon, scr])
    fl.merge_objects_into(arm, m_parts)

    fl.export_glb("cleanroom_bays.glb")


if __name__ == "__main__":
    build_fab_buildings()
    build_cleanroom_bays()
