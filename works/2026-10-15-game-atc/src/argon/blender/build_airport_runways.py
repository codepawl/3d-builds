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
    finalize_mesh_object,
    create_root_node,
    export_family_glb,
)


def build_runway_strip(name, x_offset, length, width, displaced_threshold, mats):
    """Build a detailed precision instrument runway with threshold piano keys, aiming blocks, PAPIs & edge lights."""
    root = create_root_node(name, location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    # 0:asphalt, 1:concrete_light, 2:marking_white, 3:marking_yellow, 4:marking_red, 5:emit_white, 6:emit_red, 7:emit_green, 8:amber, 9:slate_dark
    rmats = [
        mats['asphalt'], mats['concrete_light'], mats['marking_white'], mats['marking_yellow'],
        mats['marking_red'], mats['emit_white'], mats['emit_red'], mats['emit_green'],
        mats['amber'], mats['slate_dark']
    ]

    # Concrete sub-base shoulder & chamfered asphalt runway deck
    add_beveled_box(bm, size=(width + 4.0, length + 8.0, 0.28), center=(0.0, 0.0, 0.14), bevel_width=0.10, mat_idx=1)
    add_beveled_box(bm, size=(width, length, 0.36), center=(0.0, 0.0, 0.22), bevel_width=0.08, mat_idx=0)

    z_mark = 0.42
    half_l = length * 0.5
    half_w = width * 0.5

    # White side edge stripes
    for sx in (-1.0, 1.0):
        add_beveled_box(bm, size=(0.55, length - 4.0, 0.04), center=(sx * (half_w - 0.85), 0.0, z_mark), bevel_width=0.008, mat_idx=2)

    # Centerline dashed stripes
    num_dashes = 15
    dash_step = (length - 28.0) / num_dashes
    for i in range(num_dashes):
        dy = -half_l + 15.0 + (i + 0.5) * dash_step
        add_beveled_box(bm, size=(0.50, dash_step * 0.52, 0.04), center=(0.0, dy, z_mark), bevel_width=0.008, mat_idx=2)

    # Threshold "piano key" stripes at both ends (+Y and -Y)
    for end_sign in (-1.0, 1.0):
        ty = end_sign * (half_l - 6.5)
        for kx in (-6.5, -4.8, -3.1, -1.4, 1.4, 3.1, 4.8, 6.5):
            add_beveled_box(bm, size=(0.85, 5.2, 0.04), center=(kx, ty, z_mark), bevel_width=0.008, mat_idx=2)
        # Aiming point fixed-distance blocks
        ay = end_sign * (half_l - 22.0)
        for sx in (-4.2, 4.2):
            add_beveled_box(bm, size=(2.2, 7.5, 0.04), center=(sx, ay, z_mark), bevel_width=0.008, mat_idx=2)
        # Touchdown zone double bars
        for t_off in (13.5, 29.5):
            tzy = end_sign * (half_l - t_off)
            for sx in (-4.8, -3.4, 3.4, 4.8):
                add_beveled_box(bm, size=(0.70, 3.6, 0.04), center=(sx, tzy, z_mark), bevel_width=0.008, mat_idx=2)
        # Yellow blast-pad chevrons at extreme ends
        by = end_sign * (half_l - 1.8)
        for ang_sign in (-1.0, 1.0):
            add_beveled_box(
                bm, size=(width * 0.42, 0.65, 0.04),
                center=(ang_sign * width * 0.18, by, z_mark),
                rotation=(0.0, 0.0, ang_sign * end_sign * 0.55),
                bevel_width=0.008, mat_idx=3
            )
        # Threshold green/red bar lights
        for lx in range(-int(half_w) + 2, int(half_w), 3):
            add_cylinder_part(bm, radius1=0.16, radius2=0.14, depth=0.18, segments=10, center=(float(lx), end_sign * (half_l - 3.2), 0.46), axis='Z', mat_idx=7 if end_sign < 0 else 6)

    if displaced_threshold:
        # Displaced threshold arrows on secondary runway
        for ay in (-half_l + 9.0, -half_l + 12.0):
            add_beveled_box(bm, size=(0.55, 2.2, 0.04), center=(0.0, ay, z_mark), bevel_width=0.008, mat_idx=3)

    # Elevated runway edge lights along both sides + 4-box PAPI slope indicators
    for ey in range(-int(half_l) + 8, int(half_l) - 4, 12):
        for sx in (-1.0, 1.0):
            add_cylinder_part(bm, radius1=0.14, radius2=0.10, depth=0.38, segments=10, center=(sx * (half_w + 0.9), float(ey), 0.44), axis='Z', mat_idx=8)
            add_cylinder_part(bm, radius1=0.12, radius2=0.12, depth=0.16, segments=10, center=(sx * (half_w + 0.9), float(ey), 0.68), axis='Z', mat_idx=5)

    # PAPI 4-light visual approach slope indicator boxes on left side of both touchdown zones
    for end_sign in (-1.0, 1.0):
        py = end_sign * (half_l - 20.0)
        for idx in range(4):
            px = -half_w - 2.6 - idx * 1.35
            add_beveled_box(bm, size=(0.85, 1.10, 0.52), center=(px, py, 0.52), bevel_width=0.04, mat_idx=4)
            # Two white, two red PAPI lenses
            lens_mat = 5 if idx < 2 else 6
            add_cylinder_part(bm, radius1=0.16, radius2=0.16, depth=0.12, segments=10, center=(px, py + end_sign * 0.56, 0.54), axis='Y', mat_idx=lens_mat)

    # Illuminated Yellow/Black Runway Holding Position Signboards at exits
    for sy in (-18.0, 18.0):
        add_beveled_box(bm, size=(0.35, 2.4, 0.95), center=(half_w + 2.4, sy, 0.72), bevel_width=0.04, mat_idx=4)
        add_beveled_box(bm, size=(0.40, 2.1, 0.68), center=(half_w + 2.4, sy, 0.74), bevel_width=0.02, mat_idx=2)

    finalize_mesh_object(f"{name}_Mesh", bm, rmats, parent=root, uv_scale=0.08)


def build_taxiway_modules(x_base, mats):
    """Build modular Taxiway Straight, 90-deg Curve, T-Intersection & Rapid Exit with yellow lines & blue edge lights."""
    tmats = [
        mats['taxiway'], mats['concrete_light'], mats['marking_yellow'],
        mats['slate_dark'], mats['emit_blue'], mats['emit_green'], mats['marking_red']
    ]

    # 1. Taxiway_Straight_A
    r1 = create_root_node("Taxiway_Straight_A", location=(x_base, -32.0, 0.0))
    bm1 = bmesh.new()
    add_beveled_box(bm1, size=(12.0, 28.0, 0.26), center=(0.0, 0.0, 0.13), bevel_width=0.08, mat_idx=1)
    add_beveled_box(bm1, size=(10.2, 28.0, 0.34), center=(0.0, 0.0, 0.19), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm1, size=(0.38, 27.6, 0.04), center=(0.0, 0.0, 0.38), bevel_width=0.008, mat_idx=2)
    # Double hold-short bar near +Y end
    add_beveled_box(bm1, size=(9.2, 0.38, 0.04), center=(0.0, 10.5, 0.38), bevel_width=0.008, mat_idx=2)
    add_beveled_box(bm1, size=(9.2, 0.38, 0.04), center=(0.0, 11.3, 0.38), bevel_width=0.008, mat_idx=6)
    for wy in (-10.0, 0.0, 10.0):
        add_cylinder_part(bm1, radius1=0.14, radius2=0.14, depth=0.08, segments=10, center=(0.0, wy, 0.39), axis='Z', mat_idx=5)
        for sx in (-5.5, 5.5):
            add_cylinder_part(bm1, radius1=0.12, radius2=0.10, depth=0.42, segments=10, center=(sx, wy, 0.45), axis='Z', mat_idx=4)
    finalize_mesh_object("Taxiway_Straight_Mesh", bm1, tmats, parent=r1, uv_scale=0.12)

    # 2. Taxiway_Curve_90
    r2 = create_root_node("Taxiway_Curve_90", location=(x_base, 0.0, 0.0))
    bm2 = bmesh.new()
    add_beveled_box(bm2, size=(16.0, 16.0, 0.26), center=(0.0, 0.0, 0.13), bevel_width=0.12, mat_idx=1)
    add_beveled_box(bm2, size=(10.2, 12.0, 0.34), center=(0.0, -2.0, 0.19), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm2, size=(12.0, 10.2, 0.34), center=(2.0, 0.0, 0.19), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm2, size=(0.38, 8.0, 0.04), center=(0.0, -4.0, 0.38), bevel_width=0.008, mat_idx=2)
    add_beveled_box(bm2, size=(8.0, 0.38, 0.04), center=(4.0, 0.0, 0.38), bevel_width=0.008, mat_idx=2)
    finalize_mesh_object("Taxiway_Curve_Mesh", bm2, tmats, parent=r2, uv_scale=0.12)

    # 3. Taxiway_Intersection_T
    r3 = create_root_node("Taxiway_Intersection_T", location=(x_base, 24.0, 0.0))
    bm3 = bmesh.new()
    add_beveled_box(bm3, size=(22.0, 18.0, 0.26), center=(0.0, 0.0, 0.13), bevel_width=0.10, mat_idx=1)
    add_beveled_box(bm3, size=(21.6, 10.2, 0.34), center=(0.0, -2.0, 0.19), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm3, size=(10.2, 14.0, 0.34), center=(0.0, 2.0, 0.19), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm3, size=(21.0, 0.38, 0.04), center=(0.0, -2.0, 0.38), bevel_width=0.008, mat_idx=2)
    add_beveled_box(bm3, size=(0.38, 10.5, 0.04), center=(0.0, 3.2, 0.38), bevel_width=0.008, mat_idx=2)
    finalize_mesh_object("Taxiway_Intersection_Mesh", bm3, tmats, parent=r3, uv_scale=0.12)

    # 4. Taxiway_RapidExit (high-speed 35-degree runway turnoff)
    r4 = create_root_node("Taxiway_RapidExit", location=(x_base, 48.0, 0.0))
    bm4 = bmesh.new()
    add_beveled_box(bm4, size=(10.5, 22.0, 0.32), center=(0.0, 0.0, 0.16), rotation=(0.0, 0.0, 0.55), bevel_width=0.08, mat_idx=0)
    add_beveled_box(bm4, size=(0.38, 21.0, 0.04), center=(0.0, 0.0, 0.34), rotation=(0.0, 0.0, 0.55), bevel_width=0.008, mat_idx=2)
    finalize_mesh_object("Taxiway_RapidExit_Mesh", bm4, tmats, parent=r4, uv_scale=0.12)


def build_apron_and_als(x_apron, x_als, mats):
    """Build Concrete Gate Parking Apron Pad Group and Approach Light Bridge (ALS)."""
    # 7. Apron_GatePad_Group
    r_apron = create_root_node("Apron_GatePad_Group", location=(x_apron, 0.0, 0.0))
    bm_a = bmesh.new()
    amats = [
        mats['apron'], mats['concrete_light'], mats['marking_yellow'],
        mats['marking_red'], mats['Marking_White'] if 'Marking_White' in mats else mats['marking_white'],
        mats['steel'], mats['amber']
    ]
    add_beveled_box(bm_a, size=(56.0, 32.0, 0.32), center=(0.0, 0.0, 0.16), bevel_width=0.12, mat_idx=0)
    for gx in (-18.0, 0.0, 18.0):
        # Yellow aircraft lead-in centerline & nosewheel stop bars
        add_beveled_box(bm_a, size=(0.36, 24.0, 0.04), center=(gx, -2.0, 0.34), bevel_width=0.008, mat_idx=2)
        for stop_y in (6.0, 8.5, 11.0):
            add_beveled_box(bm_a, size=(2.2, 0.28, 0.04), center=(gx, stop_y, 0.34), bevel_width=0.008, mat_idx=2)
        # Red safety equipment staging outline box & ground power pit hatch
        add_beveled_box(bm_a, size=(12.5, 0.25, 0.04), center=(gx, 12.8, 0.34), bevel_width=0.008, mat_idx=3)
        add_beveled_box(bm_a, size=(1.2, 1.2, 0.08), center=(gx + 3.5, 9.5, 0.35), bevel_width=0.02, mat_idx=5)
        add_beveled_box(bm_a, size=(2.4, 1.4, 0.05), center=(gx, 11.8, 0.34), bevel_width=0.01, mat_idx=6)

    finalize_mesh_object("Apron_GatePad_Mesh", bm_a, amats, parent=r_apron, uv_scale=0.08)

    # 8. Approach_Light_Bridge_ALS (ALSF-2 style red/white approach lighting gantry pier)
    r_als = create_root_node("Approach_Light_Bridge_ALS", location=(x_als, 0.0, 0.0))
    bm_l = bmesh.new()
    lmats = [mats['crimson'], mats['white'], mats['steel'], mats['emit_white'], mats['emit_red'], mats['concrete_light']]

    # Central spine catwalk pier & 5 crossbars with sequenced flashers
    add_beveled_box(bm_l, size=(1.2, 34.0, 0.35), center=(0.0, 0.0, 1.85), bevel_width=0.05, mat_idx=0)
    for py in (-14.0, -7.0, 0.0, 7.0, 14.0):
        # Concrete pier base + red/white support column
        add_beveled_box(bm_l, size=(1.8, 1.8, 0.55), center=(0.0, py, 0.28), bevel_width=0.06, mat_idx=5)
        add_cylinder_part(bm_l, radius1=0.28, radius2=0.24, depth=1.6, segments=12, center=(0.0, py, 1.15), axis='Z', mat_idx=0)
        # Crossbar
        bar_w = 14.5 if abs(py) < 1.0 else 7.8
        add_beveled_box(bm_l, size=(bar_w, 0.45, 0.28), center=(0.0, py, 2.12), bevel_width=0.04, mat_idx=1)
        # High-intensity approach lamps along crossbar
        num_lamps = 7 if abs(py) < 1.0 else 5
        for l_idx in range(num_lamps):
            lx = (l_idx - (num_lamps - 1) * 0.5) * 1.45
            emit_m = 4 if (py > 5.0 and abs(lx) > 1.8) else 3
            add_cylinder_part(bm_l, radius1=0.18, radius2=0.14, depth=0.22, segments=10, center=(lx, py, 2.34), axis='Y', mat_idx=emit_m)

    finalize_mesh_object("Approach_Light_Bridge_Mesh", bm_l, lmats, parent=r_als, uv_scale=0.15)


def build_airport_runways(output_dir):
    clear_scene()
    mats = get_standard_materials()

    # 1 & 2. Primary & Secondary Instrument Runways
    build_runway_strip("Runway_09L_27R", x_offset=-65.0, length=120.0, width=18.0, displaced_threshold=False, mats=mats)
    build_runway_strip("Runway_09R_27L", x_offset=-36.0, length=104.0, width=16.0, displaced_threshold=True, mats=mats)

    # 3..6. Modular Taxiways
    build_taxiway_modules(x_base=-8.0, mats=mats)

    # 7 & 8. Concrete Apron Gate Pads & Approach Lighting System Bridge
    build_apron_and_als(x_apron=38.0, x_als=82.0, mats=mats)

    export_family_glb(os.path.join(output_dir, "airport_runways.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_airport_runways(out_dir)
