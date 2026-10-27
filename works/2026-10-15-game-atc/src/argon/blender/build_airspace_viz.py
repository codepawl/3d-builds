import os
import sys
import math
import bmesh
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_common import (
    clear_scene,
    get_standard_materials,
    make_pbr_material,
    add_beveled_box,
    add_cylinder_part,
    add_uv_sphere_part,
    finalize_mesh_object,
    create_root_node,
    export_family_glb,
)


def build_weather_cells(x_heavy, x_mod, mats):
    """
    1 & 2. Drifting Convective Weather Cells (`Weather_Cell_CB_Heavy` & `Weather_Cell_Moderate`):
    - Stylised volumetric cumulonimbus storm cloud cluster with anvil top, dark rain-shaft base,
      internal glowing lightning bolts (`Lightning_Core_1`, `Lightning_Core_2`),
      and ground radar precipitation contour ring (`Rain_Curtain_Ring`).
    """
    mat_rain = make_pbr_material(
        "Mat_Rain_Shaft", (0.28, 0.44, 0.68, 0.42),
        roughness=0.35, emissive_color=(0.20, 0.45, 0.85), emissive_strength=0.8, alpha=0.42
    )

    # 1. Weather_Cell_CB_Heavy
    r_cb = create_root_node("Weather_Cell_CB_Heavy", location=(x_heavy, 0.0, 0.0))
    bm = bmesh.new()
    cmats = [mats['cloud_white'], mats['cloud_storm'], mats['emit_amber'], mats['emit_red'], mat_rain]

    # Billowing storm base & towering cumulus billows
    puffs = [
        ((0.0, 0.0, 5.2),   (6.5, 5.8, 2.4), 1),
        ((-3.8, 1.5, 5.8),  (4.4, 4.0, 2.2), 1),
        ((4.0, -1.2, 5.6),  (4.6, 4.2, 2.1), 1),
        ((0.5, 2.8, 6.2),   (4.2, 3.8, 2.3), 0),
        ((-2.2, -2.5, 6.4), (4.0, 3.8, 2.4), 0),
        ((0.0, 0.0, 8.2),   (5.2, 4.8, 3.2), 0),
        ((-2.4, 0.8, 9.6),  (4.2, 3.8, 2.6), 0),
        ((2.2, -0.6, 9.8),  (4.4, 3.9, 2.7), 0),
    ]
    for center, scale, m_idx in puffs:
        add_uv_sphere_part(bm, radius=1.0, scale=scale, center=center, u_segments=18, v_segments=12, mat_idx=m_idx)

    # Translucent downdraft rain shaft pillar beneath storm core
    add_cylinder_part(bm, radius1=4.8, radius2=3.6, depth=4.6, segments=20, center=(0.0, 0.0, 2.4), axis='Z', bevel_width=0.10, mat_idx=4)
    finalize_mesh_object("Weather_CB_CloudMass", bm, cmats, parent=r_cb)

    # Separate Rotating Storm Anvil Top Cap (pivot at (0,0,0)!)
    bm_anv = bmesh.new()
    add_uv_sphere_part(bm_anv, radius=1.0, scale=(8.2, 6.4, 1.65), center=(0.0, 0.0, 0.0), u_segments=20, v_segments=12, mat_idx=0)
    add_uv_sphere_part(bm_anv, radius=1.0, scale=(6.0, 4.5, 1.35), center=(1.8, 0.8, 0.65), u_segments=16, v_segments=10, mat_idx=0)
    finalize_mesh_object("Storm_Anvil_Swirl", bm_anv, [mats['cloud_white']], parent=r_cb, location=(0.0, 0.0, 11.6))

    # Separate Pulsing Lightning Bolt Cores (pivots at (0,0,0)!)
    for idx, (lx, ly, lmat) in enumerate(((-1.6, 1.2, mats['emit_amber']), (1.8, -1.0, mats['emit_red'])), start=1):
        bm_lt = bmesh.new()
        add_beveled_box(bm_lt, size=(0.28, 0.28, 2.4), center=(0.0, 0.0, 1.2), rotation=(0.22, -0.18, 0.0), bevel_width=0.03, mat_idx=0)
        add_beveled_box(bm_lt, size=(0.24, 0.24, 2.2), center=(0.35, -0.25, -0.6), rotation=(-0.25, 0.22, 0.0), bevel_width=0.03, mat_idx=0)
        finalize_mesh_object(f"Lightning_Core_{idx}", bm_lt, [lmat], parent=r_cb, location=(lx, ly, 4.2))

    # Separate Ground Radar Precipitation Contour Ring (pivot at (0,0,0)!)
    bm_rc = bmesh.new()
    for i in range(16):
        ang = (2.0 * math.pi * i) / 16.0
        add_beveled_box(
            bm_rc, size=(1.65, 0.35, 0.14),
            center=(math.cos(ang) * 6.4, math.sin(ang) * 5.6, 0.12),
            rotation=(0.0, 0.0, ang + math.pi * 0.5), bevel_width=0.02, mat_idx=0 if i % 2 == 0 else 1
        )
    finalize_mesh_object("Rain_Curtain_Ring", bm_rc, [mats['emit_amber'], mats['emit_red']], parent=r_cb, location=(0.0, 0.0, 0.0))

    # 2. Weather_Cell_Moderate (Developing medium convective cell)
    r_mod = create_root_node("Weather_Cell_Moderate", location=(x_mod, 0.0, 0.0))
    bm_m = bmesh.new()
    mod_puffs = [
        ((0.0, 0.0, 4.2),  (4.6, 4.0, 1.8), 1),
        ((-2.4, 0.8, 4.8), (3.4, 3.0, 1.8), 0),
        ((2.5, -0.7, 4.9), (3.5, 3.1, 1.7), 0),
        ((0.0, 0.2, 6.4),  (3.8, 3.4, 2.2), 0),
    ]
    for center, scale, m_idx in mod_puffs:
        add_uv_sphere_part(bm_m, radius=1.0, scale=scale, center=center, u_segments=16, v_segments=10, mat_idx=m_idx)
    add_cylinder_part(bm_m, radius1=3.2, radius2=2.4, depth=3.6, segments=16, center=(0.0, 0.0, 1.9), axis='Z', mat_idx=4)
    finalize_mesh_object("Weather_Mod_CloudMass", bm_m, cmats, parent=r_mod)


def build_separation_rings(x_nom, x_amb, x_red, mats):
    """
    3, 4 & 5. Tactical Aircraft Separation Rings (`Separation_Ring_Nominal`, `Separation_Ring_Amber`, `Separation_Ring_Red`):
    - "separation rings that turn amber and red when two aircraft get too close"
    - Includes outer segmented range ring, compass tick marks, forward velocity vector pointer,
      and separate rotating inner conflict alert spinner (`SepRing_Spinner_*` at (0,0,0)!).
    """
    configs = [
        ("Separation_Ring_Nominal", "SepRing_Spinner_Nominal", x_nom, mats['emit_cyan'], mats['cobalt']),
        ("Separation_Ring_Amber",   "SepRing_Spinner_Amber",   x_amb, mats['emit_amber'], mats['amber']),
        ("Separation_Ring_Red",     "SepRing_Spinner_Red",     x_red, mats['emit_red'],   mats['crimson']),
    ]
    for r_name, spin_name, x_pos, emit_mat, solid_mat in configs:
        root = create_root_node(r_name, location=(x_pos, 0.0, 0.0))
        bm = bmesh.new()
        radius = 5.5
        # 24 outer segmented halo arcs + cardinal heading ticks
        for i in range(24):
            ang = (2.0 * math.pi * i) / 24.0
            is_cardinal = (i % 6 == 0)
            seg_len = 1.15 if not is_cardinal else 1.35
            seg_w = 0.22 if not is_cardinal else 0.38
            add_beveled_box(
                bm, size=(seg_len, seg_w, 0.16),
                center=(math.cos(ang) * radius, math.sin(ang) * radius, 0.0),
                rotation=(0.0, 0.0, ang + math.pi * 0.5),
                bevel_width=0.02, mat_idx=0 if i % 2 == 0 else 1
            )
        # Forward heading chevron arrow at +Y
        add_beveled_box(bm, size=(0.24, 1.85, 0.18), center=(-0.55, radius + 0.95, 0.0), rotation=(0.0, 0.0, -0.52), bevel_width=0.02, mat_idx=0)
        add_beveled_box(bm, size=(0.24, 1.85, 0.18), center=(0.55, radius + 0.95, 0.0), rotation=(0.0, 0.0, 0.52), bevel_width=0.02, mat_idx=0)
        finalize_mesh_object(f"{r_name}_OuterHalo", bm, [emit_mat, solid_mat], parent=root)

        # Separate inner rotating alert ring (pivot at (0,0,0)!)
        bm_sp = bmesh.new()
        in_r = 3.6
        for i in range(8):
            ang = (2.0 * math.pi * i) / 8.0
            add_beveled_box(
                bm_sp, size=(1.35, 0.18, 0.14),
                center=(math.cos(ang) * in_r, math.sin(ang) * in_r, 0.0),
                rotation=(0.0, 0.0, ang + math.pi * 0.5), bevel_width=0.02, mat_idx=0
            )
        finalize_mesh_object(spin_name, bm_sp, [emit_mat], parent=root, location=(0.0, 0.0, 0.0))


def build_holding_stack_and_pins(x_hold, x_pin, x_gate, mats):
    """
    6, 7 & 8. `Holding_Stack_Racetrack`, `Altitude_Drop_Pin`, and `Airway_Gate_Chevron`:
    - "arrivals descending along the approach into a holding stack"
    - "altitude shown by a thin drop line from each aircraft to the ground"
    - "airway lines and approach paths drawn on the map"
    """
    # 6. Holding_Stack_Racetrack (3-tier vertical holding pattern racetrack oval with directional chevrons)
    r_hold = create_root_node("Holding_Stack_Racetrack", location=(x_hold, 0.0, 0.0))
    bm_h = bmesh.new()
    hmats = [mats['emit_cyan'], mats['emit_amber'], mats['cobalt'], mats['white']]

    for tier_idx, (tz, t_mat) in enumerate(((2.0, 0), (5.0, 0), (8.0, 1))):
        # Straight inbound/outbound legs
        for sx in (-4.2, 4.2):
            for seg in (-4.5, -1.5, 1.5, 4.5):
                add_beveled_box(bm_h, size=(0.24, 2.1, 0.18), center=(sx, seg, tz), bevel_width=0.02, mat_idx=t_mat)
        # Semicircular turns at +Y and -Y ends
        for end_sign in (-1.0, 1.0):
            for k in range(7):
                ang = (math.pi * (k + 0.5)) / 7.0
                if end_sign < 0:
                    ang += math.pi
                px = math.cos(ang) * 4.2
                py = end_sign * 6.0 + math.sin(ang) * 4.2
                add_beveled_box(
                    bm_h, size=(1.45, 0.24, 0.18),
                    center=(px, py, tz), rotation=(0.0, 0.0, ang + math.pi * 0.5),
                    bevel_width=0.02, mat_idx=t_mat
                )
        # Corner altitude reference posts
        add_cylinder_part(bm_h, radius1=0.10, radius2=0.10, depth=2.8, segments=8, center=(-4.2, 6.0, tz - 1.4), axis='Z', mat_idx=2)

    finalize_mesh_object("Holding_Stack_Mesh", bm_h, hmats, parent=r_hold)

    # 7. Altitude_Drop_Pin (Ground target reticle + vertical graduated altitude stem)
    r_pin = create_root_node("Altitude_Drop_Pin", location=(x_pin, 0.0, 0.0))
    bm_p = bmesh.new()
    add_cylinder_part(bm_p, radius1=0.08, radius2=0.08, depth=10.0, segments=10, center=(0.0, 0.0, 5.0), axis='Z', mat_idx=0)
    for hz in range(2, 10, 2):
        add_beveled_box(bm_p, size=(0.75, 0.14, 0.14), center=(0.0, 0.0, float(hz)), bevel_width=0.02, mat_idx=1)
    finalize_mesh_object("Altitude_Stem", bm_p, [mats['cobalt'], mats['emit_cyan']], parent=r_pin)

    # Separate rotating ground target reticle ring (pivot at (0,0,0)!)
    bm_ret = bmesh.new()
    add_cylinder_part(bm_ret, radius1=1.45, radius2=1.25, depth=0.12, segments=16, center=(0.0, 0.0, 0.06), axis='Z', mat_idx=0)
    for ang_deg in (0, 90, 180, 270):
        ang = math.radians(ang_deg)
        add_beveled_box(bm_ret, size=(0.85, 0.22, 0.16), center=(math.cos(ang) * 1.65, math.sin(ang) * 1.65, 0.10), rotation=(0.0, 0.0, ang), bevel_width=0.02, mat_idx=1)
    finalize_mesh_object("Reticle_Base_Ring", bm_ret, [mats['cobalt'], mats['emit_cyan']], parent=r_pin, location=(0.0, 0.0, 0.0))

    # 8. Airway_Gate_Chevron (Directional airway / final approach corridor gate marker)
    r_gate = create_root_node("Airway_Gate_Chevron", location=(x_gate, 0.0, 0.0))
    bm_g = bmesh.new()
    for sx in (-1.0, 1.0):
        add_beveled_box(
            bm_g, size=(0.42, 3.6, 0.28),
            center=(sx * 1.15, 0.0, 0.45),
            rotation=(0.0, 0.0, sx * 0.58),
            bevel_width=0.04, mat_idx=0
        )
        add_beveled_box(
            bm_g, size=(0.32, 2.6, 0.24),
            center=(sx * 0.85, 2.2, 0.45),
            rotation=(0.0, 0.0, sx * 0.58),
            bevel_width=0.03, mat_idx=1
        )
    finalize_mesh_object("Airway_Chevron_Mesh", bm_g, [mats['emit_cyan'], mats['cobalt']], parent=r_gate)


def build_airspace_viz(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_weather_cells(x_heavy=-46.0, x_mod=-26.0, mats=mats)
    build_separation_rings(x_nom=-10.0, x_amb=4.0, x_red=18.0, mats=mats)
    build_holding_stack_and_pins(x_hold=34.0, x_pin=48.0, x_gate=58.0, mats=mats)

    export_family_glb(os.path.join(output_dir, "airspace_viz.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_airspace_viz(out_dir)
