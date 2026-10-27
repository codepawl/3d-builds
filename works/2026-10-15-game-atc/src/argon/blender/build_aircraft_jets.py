import os
import sys
import math
import bmesh
from mathutils import Vector, Euler

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


def create_turbofan_rotor(name, parent, location, radius=0.55, mats=None):
    """Create a spinning turbofan blade assembly with pivot at (0,0,0) around Y axis."""
    bm = bmesh.new()
    # Central spinner cone pointing +Y
    add_cylinder_part(
        bm, radius1=radius * 0.34, radius2=0.03, depth=radius * 0.75,
        segments=16, center=(0.0, radius * 0.25, 0.0), axis='Y',
        bevel_width=0.01, bevel_segments=1, mat_idx=2
    )
    # Hub disc
    add_cylinder_part(
        bm, radius1=radius * 0.35, radius2=radius * 0.35, depth=radius * 0.25,
        segments=16, center=(0.0, -radius * 0.05, 0.0), axis='Y',
        bevel_width=0.01, bevel_segments=1, mat_idx=1
    )
    # 12 angled fan blades
    num_blades = 12
    for i in range(num_blades):
        ang = (2.0 * math.pi * i) / num_blades
        bx = math.cos(ang) * (radius * 0.58)
        bz = math.sin(ang) * (radius * 0.58)
        add_beveled_box(
            bm,
            size=(radius * 0.62, 0.038, radius * 0.18),
            center=(bx, 0.0, bz),
            rotation=(0.38, -ang, 0.0),
            bevel_width=0.006,
            bevel_segments=1,
            mat_idx=0,
        )
    return finalize_mesh_object(name, bm, mats, parent=parent, location=location, uv_scale=1.0)


def create_landing_gear_group(prefix, parent, nose_pos, main_x, main_y, main_z, wheel_r=0.34, dual_bogie=False, mats=None):
    """Create nose and main landing gear struts and wheel nodes with local pivots at (0,0,0)."""
    # Nose gear strut (pivot at top attachment)
    bm_n = bmesh.new()
    strut_h = abs(nose_pos[2]) + 0.35
    add_cylinder_part(
        bm_n, radius1=0.08, radius2=0.07, depth=strut_h,
        segments=12, center=(0.0, 0.0, -strut_h * 0.5), axis='Z',
        bevel_width=0.01, mat_idx=0
    )
    # Nose gear doors & torque link
    add_beveled_box(bm_n, size=(0.04, 0.55, 0.35), center=(0.22, 0.0, -0.18), bevel_width=0.01, mat_idx=1)
    add_beveled_box(bm_n, size=(0.04, 0.55, 0.35), center=(-0.22, 0.0, -0.18), bevel_width=0.01, mat_idx=1)
    # Nose taxi light
    add_cylinder_part(bm_n, radius1=0.07, radius2=0.07, depth=0.06, segments=10, center=(0.0, 0.12, -strut_h * 0.45), axis='Y', mat_idx=2)

    nose_strut = finalize_mesh_object(
        f"{prefix}_Gear_Nose", bm_n, [mats['steel'], mats['white'], mats['emit_white']],
        parent=parent, location=(0.0, nose_pos[1], nose_pos[2] + strut_h)
    )
    create_wheel_node(
        f"{prefix}_Wheel_Nose", nose_strut, location=(0.0, 0.0, -strut_h),
        radius=wheel_r * 0.82, width=0.22, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['chrome']
    )

    # Main gear L & R
    main_strut_h = abs(main_z) + 0.45
    for side_tag, sx in (("L", -1.0), ("R", 1.0)):
        bm_m = bmesh.new()
        add_cylinder_part(
            bm_m, radius1=0.10, radius2=0.09, depth=main_strut_h,
            segments=12, center=(0.0, 0.0, -main_strut_h * 0.5), axis='Z',
            bevel_width=0.01, mat_idx=0
        )
        # Side brace & gear door panel
        add_beveled_box(
            bm_m, size=(0.45, 0.08, 0.08),
            center=(-sx * 0.22, 0.0, -main_strut_h * 0.35),
            rotation=(0.0, sx * 0.55, 0.0), bevel_width=0.01, mat_idx=0
        )
        add_beveled_box(
            bm_m, size=(0.05, 0.90, 0.55),
            center=(sx * 0.22, 0.0, -0.28),
            bevel_width=0.01, mat_idx=1
        )
        if dual_bogie:
            add_beveled_box(
                bm_m, size=(0.36, 0.95, 0.12),
                center=(0.0, 0.0, -main_strut_h),
                bevel_width=0.015, mat_idx=0
            )
        m_strut = finalize_mesh_object(
            f"{prefix}_Gear_Main_{side_tag}", bm_m, [mats['steel'], mats['cool_grey']],
            parent=parent, location=(sx * main_x, main_y, main_z + main_strut_h)
        )
        create_wheel_node(
            f"{prefix}_Wheel_Main_{side_tag}", m_strut, location=(0.0, 0.0, -main_strut_h),
            radius=wheel_r, width=0.34 if not dual_bogie else 0.42,
            mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['chrome']
        )


def build_jet_variant(
    name,
    x_offset,
    length,
    radius_x,
    radius_z,
    wingspan,
    wing_chord_root,
    wing_chord_tip,
    wing_sweep,
    winglet_h,
    rear_engines,
    t_tail,
    dual_bogie,
    livery_mat,
    belly_mat,
    mats,
):
    """Build a complete procedural jet airliner variant with moving fans & landing gear."""
    root = create_root_node(name, location=(x_offset, 0.0, 0.0))

    bm = bmesh.new()
    # Material table for main body mesh:
    # 0: white, 1: livery_mat, 2: belly_mat, 3: glass_dark, 4: steel, 5: chrome,
    # 6: emit_red, 7: emit_green, 8: emit_white, 9: slate_dark
    body_mats = [
        mats['white'], livery_mat, belly_mat, mats['glass_dark'],
        mats['steel'], mats['chrome'], mats['emit_red'],
        mats['emit_green'], mats['emit_white'], mats['slate_dark']
    ]

    half_l = length * 0.5
    zc = 1.45  # Fuselage centerline height above ground
    sections = [
        (half_l,          zc - 0.22, 0.08, 0.08),
        (half_l - 0.45,   zc - 0.16, radius_x * 0.42, radius_z * 0.38),
        (half_l - 1.25,   zc - 0.06, radius_x * 0.78, radius_z * 0.75),
        (half_l - 2.30,   zc,        radius_x * 0.96, radius_z * 0.96),
        (half_l - 3.40,   zc,        radius_x,        radius_z),
        (-half_l + 4.80,  zc,        radius_x,        radius_z),
        (-half_l + 2.40,  zc + 0.12, radius_x * 0.74, radius_z * 0.78),
        (-half_l + 0.75,  zc + 0.28, radius_x * 0.36, radius_z * 0.40),
        (-half_l,         zc + 0.34, 0.14, 0.14),
    ]
    add_lofted_fuselage(
        bm, sections, segments=24, mat_idx=0,
        nose_mat_idx=1, tail_mat_idx=4, belly_mat_idx=2,
        stripe_z_range=(-0.12, 0.16), stripe_mat_idx=1
    )

    # Recessed dark wrap-around cockpit windshield panels
    cockpit_y = half_l - 1.55
    for side in (-1.0, 1.0):
        add_beveled_box(
            bm, size=(radius_x * 0.52, 0.72, 0.34),
            center=(side * radius_x * 0.36, cockpit_y, zc + radius_z * 0.38),
            rotation=(0.24, side * 0.18, -side * 0.35),
            bevel_width=0.02, bevel_segments=1, mat_idx=3
        )
        add_beveled_box(
            bm, size=(radius_x * 0.38, 0.56, 0.30),
            center=(side * radius_x * 0.68, cockpit_y - 0.42, zc + radius_z * 0.34),
            rotation=(0.10, side * 0.22, -side * 0.12),
            bevel_width=0.02, bevel_segments=1, mat_idx=3
        )

    # Row of recessed cabin windows & passenger doors along both sides
    win_start_y = half_l - 3.3
    win_end_y = -half_l + 5.0
    num_wins = int((win_start_y - win_end_y) / 0.72)
    for side in (-1.0, 1.0):
        # Forward and aft cabin door frames
        for dy in (win_start_y + 0.55, win_end_y - 0.45):
            add_beveled_box(
                bm, size=(0.08, 0.62, 1.05),
                center=(side * (radius_x * 0.96), dy, zc + 0.15),
                bevel_width=0.015, bevel_segments=1, mat_idx=4
            )
            add_beveled_box(
                bm, size=(0.10, 0.48, 0.88),
                center=(side * (radius_x * 0.97), dy, zc + 0.15),
                bevel_width=0.01, bevel_segments=1, mat_idx=0
            )
        # Cabin oval window ports
        for w in range(num_wins):
            wy = win_start_y - w * 0.72
            add_beveled_box(
                bm, size=(0.08, 0.26, 0.34),
                center=(side * (radius_x * 0.985), wy, zc + 0.26),
                bevel_width=0.03, bevel_segments=1, mat_idx=3
            )

    # Wing Box Fairing under belly
    add_beveled_box(
        bm, size=(radius_x * 2.15, wing_chord_root * 1.25, radius_z * 0.65),
        center=(0.0, 0.25, zc - radius_z * 0.68),
        bevel_width=0.14, bevel_segments=2, mat_idx=2
    )

    # Swept Main Wings (Left & Right) + Navigation Lights
    half_span = wingspan * 0.5 - radius_x * 0.85
    for side, nav_mat in ((-1, 6), (1, 7)):
        add_airfoil_wing(
            bm,
            root_pos=(radius_x * 0.82, 0.45, zc - radius_z * 0.42),
            span=half_span,
            root_chord=wing_chord_root,
            tip_chord=wing_chord_tip,
            sweep=wing_sweep,
            dihedral=half_span * 0.085,
            thick_root=wing_chord_root * 0.13,
            thick_tip=wing_chord_tip * 0.11,
            side=side,
            winglet_height=winglet_h,
            mat_idx=0,
            tip_mat_idx=1,
        )
        # Wingtip navigation strobe pod
        tip_x = side * (radius_x * 0.82 + half_span)
        tip_y = 0.45 - wing_sweep + wing_chord_tip * 0.25
        tip_z = zc - radius_z * 0.42 + half_span * 0.085
        add_uv_sphere_light(bm, center=(tip_x, tip_y, tip_z), radius=0.14, mat_idx=nav_mat)

        # Flap track fairings (canoe pods under the wing)
        for f_frac in (0.28, 0.52, 0.74):
            fx = side * (radius_x * 0.82 + half_span * f_frac)
            fy = 0.45 - wing_sweep * f_frac - (wing_chord_root * (1 - f_frac) + wing_chord_tip * f_frac) * 0.45
            fz = zc - radius_z * 0.48 + half_span * 0.085 * f_frac
            add_beveled_box(
                bm, size=(0.18, 1.15, 0.24),
                center=(fx, fy, fz), bevel_width=0.04, bevel_segments=1, mat_idx=2
            )

    # Vertical Tail Fin
    tail_base_y = -half_l + 2.15
    tail_base_z = zc + radius_z * 0.68
    tail_h = radius_z * 2.35
    add_vertical_tail(
        bm,
        base_pos=(0.0, tail_base_y, tail_base_z),
        height=tail_h,
        root_chord=wing_chord_root * 0.88,
        tip_chord=wing_chord_tip * 1.18,
        sweep=wing_sweep * 0.55,
        thick_root=0.34,
        thick_tip=0.16,
        mat_idx=0,
        accent_mat_idx=1,
    )

    # Horizontal Stabilizers (at top of fin if t_tail else at tailcone)
    hstab_z = (tail_base_z + tail_h - 0.18) if t_tail else (zc + 0.25)
    hstab_y = (tail_base_y - wing_sweep * 0.52) if t_tail else (-half_l + 1.85)
    hstab_span = half_span * 0.36
    for side in (-1, 1):
        add_airfoil_wing(
            bm,
            root_pos=(0.15 if t_tail else radius_x * 0.35, hstab_y, hstab_z),
            span=hstab_span,
            root_chord=wing_chord_root * 0.54,
            tip_chord=wing_chord_tip * 0.72,
            sweep=wing_sweep * 0.32,
            dihedral=0.05 if t_tail else 0.28,
            thick_root=0.22,
            thick_tip=0.10,
            side=side,
            winglet_height=0.0,
            mat_idx=2,
            tip_mat_idx=1,
        )

    # Dorsal SATCOM antenna fairing, VHF blade antennas & red anti-collision beacons
    add_beveled_box(
        bm, size=(0.55, 1.65, 0.22),
        center=(0.0, 1.8, zc + radius_z + 0.06),
        bevel_width=0.08, bevel_segments=2, mat_idx=0
    )
    for ay in (3.6, -1.8):
        add_beveled_box(
            bm, size=(0.05, 0.42, 0.32),
            center=(0.0, ay, zc + radius_z + 0.14),
            rotation=(0.25, 0.0, 0.0), bevel_width=0.01, mat_idx=0
        )
    # Red dorsal & ventral beacon lights + white tail cone strobe
    add_uv_sphere_light(bm, center=(0.0, 0.4, zc + radius_z + 0.12), radius=0.13, mat_idx=6)
    add_uv_sphere_light(bm, center=(0.0, -0.5, zc - radius_z - 0.22), radius=0.13, mat_idx=6)
    add_uv_sphere_light(bm, center=(0.0, -half_l - 0.06, zc + 0.34), radius=0.12, mat_idx=8)

    # Engine Nacelles & Pylons (stationary outer cowlings on body mesh; rotors are separate child nodes!)
    nacelle_r = radius_z * (0.48 if not rear_engines else 0.36)
    nacelle_len = wing_chord_root * (0.86 if not rear_engines else 0.78)
    fan_positions = []
    for side in (-1.0, 1.0):
        if rear_engines:
            ex = side * (radius_x + nacelle_r * 0.95)
            ey = -half_l + 4.35
            ez = zc + 0.42
            # Horizontal pylon strut
            add_beveled_box(
                bm, size=(nacelle_r * 1.1, nacelle_len * 0.65, 0.24),
                center=(side * (radius_x + nacelle_r * 0.35), ey, ez),
                bevel_width=0.04, bevel_segments=1, mat_idx=2
            )
        else:
            ex = side * (radius_x + half_span * 0.34)
            ey = 0.75 - wing_sweep * 0.24
            ez = zc - radius_z * 0.62
            # Underwing pylon strut
            add_beveled_box(
                bm, size=(0.26, nacelle_len * 0.78, 0.58),
                center=(ex, ey - 0.15, ez + nacelle_r * 0.85),
                bevel_width=0.04, bevel_segments=1, mat_idx=2
            )

        # Chrome intake ring lip
        add_cylinder_part(
            bm, radius1=nacelle_r * 0.96, radius2=nacelle_r * 1.02, depth=nacelle_len * 0.18,
            segments=20, center=(ex, ey + nacelle_len * 0.44, ez), axis='Y',
            bevel_width=0.03, bevel_segments=2, mat_idx=5
        )
        # Main nacelle barrel in livery / white
        add_cylinder_part(
            bm, radius1=nacelle_r * 1.02, radius2=nacelle_r * 0.86, depth=nacelle_len * 0.68,
            segments=20, center=(ex, ey + nacelle_len * 0.02, ez), axis='Y',
            bevel_width=0.03, bevel_segments=2, mat_idx=1
        )
        # Exhaust nozzle cone
        add_cylinder_part(
            bm, radius1=nacelle_r * 0.78, radius2=nacelle_r * 0.56, depth=nacelle_len * 0.34,
            segments=18, center=(ex, ey - nacelle_len * 0.44, ez), axis='Y',
            bevel_width=0.015, bevel_segments=1, mat_idx=9
        )
        fan_positions.append(("L" if side < 0 else "R", (ex, ey + nacelle_len * 0.34, ez)))

    finalize_mesh_object(f"{name}_Fuselage", bm, body_mats, parent=root, location=(0.0, 0.0, 0.0), uv_scale=0.18)

    # Separate spinning turbofan rotor nodes (pivots at local origin (0,0,0)!)
    for side_tag, fpos in fan_positions:
        create_turbofan_rotor(
            f"{name}_Fan_{side_tag}",
            parent=root,
            location=fpos,
            radius=nacelle_r * 0.82,
            mats=[mats['slate_dark'], mats['steel'], mats['chrome']],
        )

    # Separate retractable landing gear struts & rotating wheels (pivots at local origin!)
    create_landing_gear_group(
        prefix=name,
        parent=root,
        nose_pos=(0.0, half_l - 2.45, 0.32),
        main_x=radius_x + 1.05,
        main_y=-0.45,
        main_z=0.38,
        wheel_r=0.38 if dual_bogie else 0.32,
        dual_bogie=dual_bogie,
        mats=mats,
    )
    return root


def add_uv_sphere_light(bm, center, radius=0.12, mat_idx=6):
    ret = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=radius)
    verts = ret['verts']
    vert_set = set(verts)
    for f in bm.faces:
        if all(v in vert_set for v in f.verts):
            f.material_index = mat_idx
            f.smooth = True
    for v in verts:
        v.co += Vector(center)


def build_aircraft_jets(output_dir):
    clear_scene()
    mats = get_standard_materials()

    # 1. Narrowbody A (Azura Air - Primary Cobalt Blue Brand Livery)
    build_jet_variant(
        name="Jet_Narrowbody_Azura",
        x_offset=-36.0,
        length=18.2,
        radius_x=1.22,
        radius_z=1.28,
        wingspan=17.4,
        wing_chord_root=2.85,
        wing_chord_tip=0.92,
        wing_sweep=2.45,
        winglet_h=0.85,
        rear_engines=False,
        t_tail=False,
        dual_bogie=False,
        livery_mat=mats['cobalt'],
        belly_mat=mats['cool_grey'],
        mats=mats,
    )

    # 2. Narrowbody B (Solstice Airways - Warm Amber & Slate Livery)
    build_jet_variant(
        name="Jet_Narrowbody_Solstice",
        x_offset=-13.0,
        length=17.4,
        radius_x=1.18,
        radius_z=1.24,
        wingspan=16.8,
        wing_chord_root=2.70,
        wing_chord_tip=0.88,
        wing_sweep=2.30,
        winglet_h=0.95,
        rear_engines=False,
        t_tail=False,
        dual_bogie=False,
        livery_mat=mats['amber'],
        belly_mat=mats['slate_mid'],
        mats=mats,
    )

    # 3. Widebody Heavy (Meridian Heavy - Crimson & Cool-Grey Livery)
    build_jet_variant(
        name="Jet_Widebody_Meridian",
        x_offset=14.0,
        length=24.6,
        radius_x=1.72,
        radius_z=1.80,
        wingspan=23.8,
        wing_chord_root=4.10,
        wing_chord_tip=1.15,
        wing_sweep=3.65,
        winglet_h=0.45,
        rear_engines=False,
        t_tail=False,
        dual_bogie=True,
        livery_mat=mats['crimson'],
        belly_mat=mats['cool_grey'],
        mats=mats,
    )

    # 4. Regional Express T-Tail Jet (Veloce Jet - Cyan & Cobalt Dark Livery)
    build_jet_variant(
        name="Jet_Regional_Veloce",
        x_offset=38.0,
        length=14.6,
        radius_x=0.98,
        radius_z=1.02,
        wingspan=13.6,
        wing_chord_root=2.15,
        wing_chord_tip=0.76,
        wing_sweep=1.85,
        winglet_h=0.65,
        rear_engines=True,
        t_tail=True,
        dual_bogie=False,
        livery_mat=mats['cyan'],
        belly_mat=mats['cobalt_dark'],
        mats=mats,
    )

    export_family_glb(os.path.join(output_dir, "aircraft_jets.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_aircraft_jets(out_dir)
