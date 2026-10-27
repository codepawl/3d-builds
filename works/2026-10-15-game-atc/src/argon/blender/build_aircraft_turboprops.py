import os
import sys
import math
import bmesh
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_common import (
    clear_scene,
    get_standard_materials,
    add_beveled_box,
    add_cylinder_part,
    add_lofted_fuselage,
    add_airfoil_wing,
    add_vertical_tail,
    finalize_mesh_object,
    create_root_node,
    create_wheel_node,
    export_family_glb,
)


def create_propeller_node(name, parent, location, radius=1.18, num_blades=6, mats=None):
    """
    Create a spinning multi-blade turboprop propeller node with local pivot at (0,0,0)
    (rotates around local Y axis).
    """
    bm = bmesh.new()
    # Aerodynamic spinner cone pointing +Y
    add_cylinder_part(
        bm, radius1=radius * 0.20, radius2=0.03, depth=radius * 0.48,
        segments=16, center=(0.0, radius * 0.18, 0.0), axis='Y',
        bevel_width=0.015, bevel_segments=2, mat_idx=1
    )
    # Spinner base ring
    add_cylinder_part(
        bm, radius1=radius * 0.21, radius2=radius * 0.21, depth=radius * 0.14,
        segments=16, center=(0.0, -radius * 0.08, 0.0), axis='Y',
        bevel_width=0.01, bevel_segments=1, mat_idx=2
    )
    # Scimitar/paddle propeller blades with yellow/amber safety tips
    for i in range(num_blades):
        ang = (2.0 * math.pi * i) / num_blades
        r_mid = radius * 0.52
        bx = math.cos(ang) * r_mid
        bz = math.sin(ang) * r_mid
        add_beveled_box(
            bm,
            size=(radius * 0.78, 0.04, radius * 0.14),
            center=(bx, 0.0, bz),
            rotation=(0.30, -ang, 0.0),
            bevel_width=0.008,
            bevel_segments=1,
            mat_idx=0,
        )
        # Yellow safety tip cap
        r_tip = radius * 0.88
        tx = math.cos(ang) * r_tip
        tz = math.sin(ang) * r_tip
        add_beveled_box(
            bm,
            size=(radius * 0.18, 0.044, radius * 0.135),
            center=(tx, 0.0, tz),
            rotation=(0.30, -ang, 0.0),
            bevel_width=0.006,
            bevel_segments=1,
            mat_idx=3,
        )

    return finalize_mesh_object(name, bm, mats, parent=parent, location=location, uv_scale=1.0)


def build_turboprop_variant(
    name,
    x_offset,
    length,
    radius_x,
    radius_z,
    wingspan,
    high_wing,
    t_tail,
    num_blades,
    has_cargo_door,
    tip_pods,
    livery_mat,
    belly_mat,
    mats,
):
    """Build a detailed procedural turboprop variant with separate spinning propellers and gear."""
    root = create_root_node(name, location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()

    # Materials: 0:white, 1:livery, 2:belly, 3:glass_dark, 4:steel, 5:chrome, 6:emit_red, 7:emit_green, 8:emit_white, 9:slate_dark
    body_mats = [
        mats['white'], livery_mat, belly_mat, mats['glass_dark'],
        mats['steel'], mats['chrome'], mats['emit_red'],
        mats['emit_green'], mats['emit_white'], mats['slate_dark']
    ]

    half_l = length * 0.5
    zc = 1.25
    sections = [
        (half_l,         zc - 0.18, 0.07, 0.07),
        (half_l - 0.42,  zc - 0.12, radius_x * 0.45, radius_z * 0.42),
        (half_l - 1.15,  zc - 0.04, radius_x * 0.82, radius_z * 0.78),
        (half_l - 2.10,  zc,        radius_x,        radius_z),
        (-half_l + 3.80, zc,        radius_x,        radius_z),
        (-half_l + 1.80, zc + 0.16, radius_x * 0.68, radius_z * 0.74),
        (-half_l + 0.55, zc + 0.28, radius_x * 0.32, radius_z * 0.36),
        (-half_l,        zc + 0.32, 0.11, 0.11),
    ]
    add_lofted_fuselage(
        bm, sections, segments=22, mat_idx=0,
        nose_mat_idx=9, tail_mat_idx=4, belly_mat_idx=2,
        stripe_z_range=(-0.10, 0.14), stripe_mat_idx=1
    )

    # Cockpit windows
    cockpit_y = half_l - 1.38
    for side in (-1.0, 1.0):
        add_beveled_box(
            bm, size=(radius_x * 0.50, 0.62, 0.32),
            center=(side * radius_x * 0.34, cockpit_y, zc + radius_z * 0.38),
            rotation=(0.22, side * 0.16, -side * 0.32),
            bevel_width=0.02, bevel_segments=1, mat_idx=3
        )
        add_beveled_box(
            bm, size=(radius_x * 0.35, 0.48, 0.28),
            center=(side * radius_x * 0.65, cockpit_y - 0.38, zc + radius_z * 0.34),
            rotation=(0.08, side * 0.20, -side * 0.12),
            bevel_width=0.02, bevel_segments=1, mat_idx=3
        )

    # Cabin windows (fewer on cargo variant)
    win_start = half_l - 2.75
    win_end = -half_l + 4.10
    num_wins = 4 if has_cargo_door else int((win_start - win_end) / 0.68)
    for side in (-1.0, 1.0):
        for w in range(num_wins):
            wy = win_start - w * 0.68
            add_beveled_box(
                bm, size=(0.08, 0.24, 0.30),
                center=(side * (radius_x * 0.98), wy, zc + 0.18),
                bevel_width=0.025, bevel_segments=1, mat_idx=3
            )

    # High or Low Wing Center Box & Main Wings
    wing_z = (zc + radius_z * 0.88) if high_wing else (zc - radius_z * 0.52)
    add_beveled_box(
        bm, size=(radius_x * 1.95, 2.35, 0.36),
        center=(0.0, 0.35, wing_z),
        bevel_width=0.08, bevel_segments=2, mat_idx=1 if high_wing else 2
    )
    if high_wing:
        # Sponson fairings at belly for main landing gear
        for side in (-1.0, 1.0):
            add_beveled_box(
                bm, size=(0.52, 2.45, 0.48),
                center=(side * (radius_x * 0.92), 0.15, zc - radius_z * 0.62),
                bevel_width=0.09, bevel_segments=2, mat_idx=2
            )

    half_span = wingspan * 0.5 - radius_x * 0.75
    root_chord = 1.95
    tip_chord = 1.05
    for side, nav_mat in ((-1, 6), (1, 7)):
        add_airfoil_wing(
            bm,
            root_pos=(radius_x * 0.72, 0.35, wing_z),
            span=half_span,
            root_chord=root_chord,
            tip_chord=tip_chord,
            sweep=0.45,
            dihedral=0.12 if high_wing else 0.42,
            thick_root=0.26,
            thick_tip=0.14,
            side=side,
            winglet_height=0.0 if tip_pods else 0.32,
            mat_idx=0,
            tip_mat_idx=1,
        )
        tx = side * (radius_x * 0.72 + half_span)
        ty = 0.35 - 0.45
        tz = wing_z + (0.12 if high_wing else 0.42)
        if tip_pods:
            # Flight inspection sensor pod on wingtip
            add_cylinder_part(
                bm, radius1=0.18, radius2=0.14, depth=1.65,
                segments=14, center=(tx, ty, tz), axis='Y',
                bevel_width=0.03, bevel_segments=1, mat_idx=1
            )
        # Nav light
        ret = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.12)
        for f in bm.faces:
            if all(v in set(ret['verts']) for v in f.verts):
                f.material_index = nav_mat
                f.smooth = True
        for v in ret['verts']:
            v.co += Vector((tx * 1.02, ty + 0.25, tz))

    # Vertical Tail Fin & Dorsal Fin Fillet
    tail_base_y = -half_l + 1.85
    tail_base_z = zc + radius_z * 0.65
    tail_h = radius_z * 2.25
    add_beveled_box(
        bm, size=(0.14, 2.20, 0.48),
        center=(0.0, tail_base_y + 1.15, tail_base_z + 0.12),
        rotation=(0.22, 0.0, 0.0), bevel_width=0.03, bevel_segments=1, mat_idx=1
    )
    add_vertical_tail(
        bm,
        base_pos=(0.0, tail_base_y, tail_base_z),
        height=tail_h,
        root_chord=2.15,
        tip_chord=1.05,
        sweep=1.05,
        thick_root=0.28,
        thick_tip=0.14,
        mat_idx=0,
        accent_mat_idx=1,
    )

    hstab_z = (tail_base_z + tail_h - 0.14) if t_tail else (zc + 0.28)
    hstab_y = (tail_base_y - 0.95) if t_tail else (-half_l + 1.45)
    for side in (-1, 1):
        add_airfoil_wing(
            bm,
            root_pos=(0.12, hstab_y, hstab_z),
            span=half_span * 0.36,
            root_chord=1.25,
            tip_chord=0.72,
            sweep=0.35,
            dihedral=0.05,
            thick_root=0.18,
            thick_tip=0.09,
            side=side,
            mat_idx=2,
            tip_mat_idx=1,
        )

    # Turboprop Engine Nacelles & Exhaust Stubs
    prop_positions = []
    eng_x = radius_x + half_span * 0.34
    eng_y = 0.85
    eng_z = wing_z - (0.18 if high_wing else -0.08)
    for side in (-1.0, 1.0):
        sx = side * eng_x
        add_beveled_box(
            bm, size=(0.68, 2.55, 0.66),
            center=(sx, eng_y, eng_z),
            bevel_width=0.14, bevel_segments=2, mat_idx=0
        )
        # Chin air intake scoop
        add_beveled_box(
            bm, size=(0.44, 0.85, 0.28),
            center=(sx, eng_y + 0.72, eng_z - 0.28),
            bevel_width=0.05, bevel_segments=1, mat_idx=9
        )
        # Side exhaust pipe
        add_cylinder_part(
            bm, radius1=0.09, radius2=0.10, depth=0.45,
            segments=12, center=(sx + side * 0.34, eng_y - 0.35, eng_z - 0.08),
            axis='Y', rotation=(0.0, 0.0, -side * 0.25), bevel_width=0.01, mat_idx=4
        )
        prop_positions.append(("L" if side < 0 else "R", (sx, eng_y + 1.38, eng_z + 0.06)))

    finalize_mesh_object(f"{name}_Fuselage", bm, body_mats, parent=root, location=(0.0, 0.0, 0.0), uv_scale=0.2)

    # Separate Cargo Door with hinge pivot at top edge (on freighter variant)
    if has_cargo_door:
        bm_door = bmesh.new()
        add_beveled_box(
            bm_door, size=(0.10, 1.85, 1.15),
            center=(0.0, 0.0, -0.58),
            bevel_width=0.02, bevel_segments=1, mat_idx=0
        )
        add_beveled_box(
            bm_door, size=(0.12, 1.55, 0.22),
            center=(-0.02, 0.0, -0.58),
            bevel_width=0.01, bevel_segments=1, mat_idx=1
        )
        finalize_mesh_object(
            f"{name}_Cargo_Door", bm_door, [mats['white'], mats['hazard_yellow']],
            parent=root, location=(-radius_x * 0.96, 1.45, zc + 0.65)
        )

    # Separate spinning 6-blade / 4-blade Propeller nodes (pivot at (0,0,0)!)
    for side_tag, ppos in prop_positions:
        create_propeller_node(
            f"{name}_Prop_{side_tag}",
            parent=root,
            location=ppos,
            radius=1.18 if num_blades == 6 else 1.02,
            num_blades=num_blades,
            mats=[mats['slate_dark'], mats['chrome'], mats['steel'], mats['amber']],
        )

    # Separate Nose and Main Landing Gear + Wheels
    from build_aircraft_jets import create_landing_gear_group
    create_landing_gear_group(
        prefix=name,
        parent=root,
        nose_pos=(0.0, half_l - 1.95, 0.28),
        main_x=(radius_x * 0.92) if high_wing else eng_x,
        main_y=0.10,
        main_z=0.30,
        wheel_r=0.28,
        dual_bogie=False,
        mats=mats,
    )
    return root


def build_aircraft_turboprops(output_dir):
    clear_scene()
    mats = get_standard_materials()

    # 1. High-wing Regional Commuter A (Skyward Regional - Cobalt Blue)
    build_turboprop_variant(
        name="Turboprop_Commuter_A",
        x_offset=-30.0,
        length=14.8,
        radius_x=0.96,
        radius_z=1.02,
        wingspan=16.2,
        high_wing=True,
        t_tail=True,
        num_blades=6,
        has_cargo_door=False,
        tip_pods=False,
        livery_mat=mats['cobalt'],
        belly_mat=mats['cool_grey'],
        mats=mats,
    )

    # 2. Island-Hopper Commuter B (Archipelago Air - Emerald & Slate)
    build_turboprop_variant(
        name="Turboprop_Commuter_B",
        x_offset=-10.0,
        length=13.8,
        radius_x=0.92,
        radius_z=0.96,
        wingspan=15.4,
        high_wing=True,
        t_tail=True,
        num_blades=6,
        has_cargo_door=False,
        tip_pods=False,
        livery_mat=mats['emerald'],
        belly_mat=mats['slate_mid'],
        mats=mats,
    )

    # 3. Regional Cargo Feeder (AeroFreight - Amber Yellow with hinged Cargo_Door)
    build_turboprop_variant(
        name="Turboprop_Cargo_Feeder",
        x_offset=10.0,
        length=15.2,
        radius_x=1.04,
        radius_z=1.06,
        wingspan=16.6,
        high_wing=True,
        t_tail=True,
        num_blades=6,
        has_cargo_door=True,
        tip_pods=False,
        livery_mat=mats['amber'],
        belly_mat=mats['slate_dark'],
        mats=mats,
    )

    # 4. Airspace Calibration & Utility Twin (Calibra Airspace - High-Vis Orange & Wingtip Pods)
    build_turboprop_variant(
        name="Turboprop_Utility_Twin",
        x_offset=30.0,
        length=11.6,
        radius_x=0.78,
        radius_z=0.82,
        wingspan=13.4,
        high_wing=False,
        t_tail=False,
        num_blades=4,
        has_cargo_door=False,
        tip_pods=True,
        livery_mat=mats['orange'],
        belly_mat=mats['cobalt_dark'],
        mats=mats,
    )

    export_family_glb(os.path.join(output_dir, "aircraft_turboprops.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_aircraft_turboprops(out_dir)
