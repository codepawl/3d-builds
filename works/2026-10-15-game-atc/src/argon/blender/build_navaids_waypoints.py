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


def build_radar_primary_asr(x_offset, mats):
    """
    1. Airport Surveillance Radar (ASR-11 style) with equipment shelter, steel lattice pedestal,
    rotating parabolic mesh reflector + SSR antenna (`Radar_Dish_Assembly` at (0,0,0)),
    and rotating soft translucent radar sweep cone (`Radar_Sweep_Cone` at (0,0,0)).
    """
    root = create_root_node("Radar_Primary_ASR", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    nmats = [
        mats['white'], mats['cobalt'], mats['steel'], mats['slate_dark'],
        mats['concrete_light'], mats['orange'], mats['emit_red'], mats['emit_cyan']
    ]

    # Concrete pad & equipment shelter cabin with HVAC & warning stripes
    add_beveled_box(bm, size=(9.5, 9.5, 0.45), center=(0.0, 0.0, 0.22), bevel_width=0.10, mat_idx=4)
    add_beveled_box(bm, size=(4.8, 3.6, 2.8), center=(-1.8, -1.8, 1.8), bevel_width=0.10, mat_idx=0)
    add_beveled_box(bm, size=(4.9, 3.7, 0.35), center=(-1.8, -1.8, 2.95), bevel_width=0.05, mat_idx=1)

    # Tapered 4-legged steel radar tower pedestal & top service platform with handrail
    for sx in (-1.6, 1.6):
        for sy in (-1.6, 1.6):
            add_cylinder_part(
                bm, radius1=0.22, radius2=0.18, depth=11.5, segments=10,
                center=(sx * 0.78, sy * 0.78, 6.0),
                rotation=(-sy * 0.06, sx * 0.06, 0.0), axis='Z', mat_idx=2
            )
    for hz in (3.5, 7.0, 10.5):
        w = 2.8 - hz * 0.08
        add_beveled_box(bm, size=(w, w, 0.22), center=(0.0, 0.0, hz), bevel_width=0.04, mat_idx=5 if hz > 8 else 0)
    # Top platform deck
    add_cylinder_part(bm, radius1=2.8, radius2=2.8, depth=0.38, segments=16, center=(0.0, 0.0, 11.8), axis='Z', bevel_width=0.06, mat_idx=3)
    add_cylinder_part(bm, radius1=1.15, radius2=0.95, depth=1.55, segments=16, center=(0.0, 0.0, 12.75), axis='Z', bevel_width=0.08, mat_idx=0)

    finalize_mesh_object("Radar_Primary_Pedestal", bm, nmats, parent=root)

    # Separate Rotating Parabolic ASR Reflector + Top MSSR Array (pivot at (0,0,0)!)
    bm_dish = bmesh.new()
    # Turntable gear housing
    add_cylinder_part(bm_dish, radius1=0.88, radius2=0.88, depth=0.75, segments=16, center=(0.0, 0.0, 0.38), axis='Z', mat_idx=0)
    # Curved multi-panel parabolic primary reflector
    for seg in (-2, -1, 0, 1, 2):
        ang = seg * 0.22
        px = math.sin(ang) * 2.15
        py = -0.35 + (1.0 - math.cos(ang)) * 1.45
        add_beveled_box(
            bm_dish, size=(1.12, 0.28, 2.35),
            center=(px, py, 1.85),
            rotation=(0.08, 0.0, -ang),
            bevel_width=0.04, bevel_segments=2, mat_idx=1
        )
    # Forward feedhorn boom extending along +Y
    add_beveled_box(bm_dish, size=(0.22, 2.65, 0.22), center=(0.0, 1.15, 1.35), rotation=(0.18, 0.0, 0.0), bevel_width=0.03, mat_idx=2)
    add_beveled_box(bm_dish, size=(0.58, 0.48, 0.52), center=(0.0, 2.45, 1.65), bevel_width=0.05, mat_idx=3)
    # Top Secondary Surveillance Radar (SSR) planar array bar in cobalt & white
    add_beveled_box(bm_dish, size=(5.60, 0.45, 0.58), center=(0.0, -0.25, 3.35), bevel_width=0.06, mat_idx=3)
    add_beveled_box(bm_dish, size=(5.40, 0.50, 0.26), center=(0.0, -0.25, 3.35), bevel_width=0.03, mat_idx=4)
    finalize_mesh_object(
        "Radar_Dish_Assembly", bm_dish,
        [mats['steel'], mats['orange'], mats['slate_dark'], mats['white'], mats['cobalt']],
        parent=root, location=(0.0, 0.0, 13.50)
    )

    # Separate Soft Translucent Radar Sweep Wedge (pivot at (0,0,0) so rotating around Z sweeps the sector!)
    mat_sweep = make_pbr_material(
        "Mat_Radar_Sweep_Light", (0.12, 0.78, 1.0, 0.28),
        roughness=0.15, emissive_color=(0.15, 0.82, 1.0), emissive_strength=2.2, alpha=0.28
    )
    bm_sw = bmesh.new()
    add_beveled_box(
        bm_sw, size=(2.6, 12.0, 0.14),
        center=(0.0, 6.2, 0.0), bevel_width=0.04, mat_idx=0, scale_top=(1.0, 1.0)
    )
    finalize_mesh_object("Radar_Sweep_Cone", bm_sw, [mat_sweep], parent=root, location=(0.0, 0.0, 15.2))


def build_radar_enroute_radome(x_offset, mats):
    """2. Long-Range En-Route ARSR Geodesic Radome Tower + Rotating Beacon."""
    root = create_root_node("Radar_Enroute_Radome", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    rmats = [mats['white'], mats['cobalt'], mats['cool_grey'], mats['slate_dark'], mats['emit_red'], mats['steel']]

    # Base building & cylindrical tower pedestal
    add_beveled_box(bm, size=(9.2, 9.2, 3.2), center=(0.0, 0.0, 1.6), bevel_width=0.18, mat_idx=2)
    add_cylinder_part(bm, radius1=2.8, radius2=2.5, depth=9.5, segments=16, center=(0.0, 0.0, 7.6), axis='Z', bevel_width=0.12, mat_idx=0)
    add_cylinder_part(bm, radius1=3.8, radius2=3.8, depth=0.55, segments=20, center=(0.0, 0.0, 12.4), axis='Z', bevel_width=0.08, mat_idx=1)

    # Faceted geodesic radome sphere
    add_uv_sphere_part(bm, radius=4.35, scale=(1.0, 1.0, 0.96), center=(0.0, 0.0, 15.8), u_segments=16, v_segments=10, mat_idx=0)
    # Lightning arrestor masts around collar
    for ang_deg in (0, 90, 180, 270):
        ang = math.radians(ang_deg)
        add_cylinder_part(bm, radius1=0.06, radius2=0.04, depth=2.8, segments=8, center=(math.cos(ang) * 3.55, math.sin(ang) * 3.55, 13.8), axis='Z', mat_idx=5)

    finalize_mesh_object("Radar_Enroute_Structure", bm, rmats, parent=root)

    # Separate Rotating Top Obstruction Beacon at apex (pivot at (0,0,0)!)
    bm_b = bmesh.new()
    add_cylinder_part(bm_b, radius1=0.26, radius2=0.20, depth=0.55, segments=12, center=(0.0, 0.0, 0.28), axis='Z', mat_idx=0)
    add_uv_sphere_part(bm_b, radius=0.24, center=(0.0, 0.0, 0.62), u_segments=10, v_segments=8, mat_idx=1)
    finalize_mesh_object("Radome_Beacon_Rotator", bm_b, [mats['steel'], mats['emit_red']], parent=root, location=(0.0, 0.0, 20.05))


def build_vor_and_ils(x_vor, x_loc, x_gs, mats):
    """3, 4 & 5. Doppler VOR/DME Station, ILS Localizer Array, and ILS Glideslope Tower."""
    # 3. VOR_DME_Station
    r_vor = create_root_node("VOR_DME_Station", location=(x_vor, 0.0, 0.0))
    bm_v = bmesh.new()
    vmats = [mats['white'], mats['orange'], mats['steel'], mats['concrete_light'], mats['emit_red'], mats['slate_dark']]

    # Checkerboard ground shelter & circular metallic counterpoise roof disc
    add_beveled_box(bm_v, size=(5.6, 5.6, 2.6), center=(0.0, 0.0, 1.3), bevel_width=0.12, mat_idx=0)
    add_beveled_box(bm_v, size=(5.68, 5.68, 0.48), center=(0.0, 0.0, 2.2), bevel_width=0.05, mat_idx=1)
    add_cylinder_part(bm_v, radius1=6.5, radius2=6.5, depth=0.24, segments=24, center=(0.0, 0.0, 2.72), axis='Z', bevel_width=0.05, mat_idx=2)
    # Central VOR fiberglass cone & ring of 12 Doppler sideband antennas
    add_cylinder_part(bm_v, radius1=1.15, radius2=0.22, depth=3.2, segments=16, center=(0.0, 0.0, 4.4), axis='Z', bevel_width=0.06, mat_idx=0)
    add_cylinder_part(bm_v, radius1=0.68, radius2=0.45, depth=0.95, segments=16, center=(0.0, 0.0, 5.1), axis='Z', mat_idx=1)
    for i in range(12):
        ang = (2.0 * math.pi * i) / 12.0
        ax, ay = math.cos(ang) * 5.2, math.sin(ang) * 5.2
        add_cylinder_part(bm_v, radius1=0.10, radius2=0.08, depth=0.95, segments=8, center=(ax, ay, 3.3), axis='Z', mat_idx=2)
        add_cylinder_part(bm_v, radius1=0.28, radius2=0.28, depth=0.42, segments=10, center=(ax, ay, 3.85), axis='Z', mat_idx=0)
    finalize_mesh_object("VOR_DME_Mesh", bm_v, vmats, parent=r_vor)

    # 4. ILS_Localizer_Array
    r_loc = create_root_node("ILS_Localizer_Array", location=(x_loc, 0.0, 0.0))
    bm_l = bmesh.new()
    lmats = [mats['crimson'], mats['white'], mats['steel'], mats['concrete_light'], mats['emit_red']]
    add_beveled_box(bm_l, size=(16.5, 1.8, 0.45), center=(0.0, 0.0, 0.22), bevel_width=0.06, mat_idx=3)
    add_beveled_box(bm_l, size=(15.8, 0.35, 0.28), center=(0.0, 0.0, 1.35), bevel_width=0.04, mat_idx=0)
    for idx in range(8):
        lx = -6.3 + idx * 1.8
        add_cylinder_part(bm_l, radius1=0.12, radius2=0.10, depth=1.8, segments=8, center=(lx, 0.0, 1.15), axis='Z', mat_idx=0 if idx % 2 == 0 else 1)
        # Log-periodic dipole boom pointing +Y
        add_beveled_box(bm_l, size=(0.85, 2.2, 0.14), center=(lx, 0.85, 2.05), bevel_width=0.02, mat_idx=1)
        add_cylinder_part(bm_l, radius1=0.12, radius2=0.12, depth=0.15, segments=8, center=(lx, 0.0, 2.25), axis='Z', mat_idx=4)
    finalize_mesh_object("ILS_Localizer_Mesh", bm_l, lmats, parent=r_loc)

    # 5. ILS_Glideslope_Tower
    r_gs = create_root_node("ILS_Glideslope_Tower", location=(x_gs, 0.0, 0.0))
    bm_g = bmesh.new()
    add_beveled_box(bm_g, size=(3.6, 3.2, 2.5), center=(-2.2, 0.0, 1.25), bevel_width=0.10, mat_idx=1)
    add_beveled_box(bm_g, size=(3.68, 3.28, 0.35), center=(-2.2, 0.0, 2.2), bevel_width=0.04, mat_idx=0)
    add_cylinder_part(bm_g, radius1=0.32, radius2=0.22, depth=11.0, segments=12, center=(0.8, 0.0, 5.5), axis='Z', mat_idx=0)
    for gz in (4.2, 7.5, 10.2):
        add_beveled_box(bm_g, size=(0.8, 1.9, 0.32), center=(0.8, 0.85, gz), bevel_width=0.03, mat_idx=1)
    add_cylinder_part(bm_g, radius1=0.18, radius2=0.18, depth=0.25, segments=10, center=(0.8, 0.0, 11.15), axis='Z', mat_idx=4)
    finalize_mesh_object("ILS_Glideslope_Mesh", bm_g, lmats, parent=r_gs)


def build_waypoint_pylons_and_windsock(x_wp_a, x_wp_b, x_ws, mats):
    """6, 7 & 8. RNAV Waypoint Fix Pylon A, Holding Stack Fix Pylon B, and Windsock Mast."""
    # 6. Waypoint_Fix_Pylon_A (Compulsory RNAV / Intersection Fix Marker)
    r_wpa = create_root_node("Waypoint_Fix_Pylon_A", location=(x_wp_a, 0.0, 0.0))
    bm_wa = bmesh.new()
    wmats = [mats['cobalt'], mats['white'], mats['slate_dark'], mats['emit_cyan'], mats['emit_amber'], mats['steel']]

    # Triangular tactical base pad & faceted beacon obelisk with top fix nameplate
    add_cylinder_part(bm_wa, radius1=2.4, radius2=2.1, depth=0.45, segments=6, center=(0.0, 0.0, 0.22), axis='Z', bevel_width=0.06, mat_idx=2)
    add_cylinder_part(bm_wa, radius1=1.45, radius2=0.42, depth=5.8, segments=3, center=(0.0, 0.0, 3.2), axis='Z', bevel_width=0.08, mat_idx=0)
    add_cylinder_part(bm_wa, radius1=0.85, radius2=1.35, depth=1.6, segments=3, center=(0.0, 0.0, 6.8), axis='Z', bevel_width=0.06, mat_idx=3)
    # Top 5-letter waypoint callsign billboard plate
    add_beveled_box(bm_wa, size=(3.4, 0.35, 1.15), center=(0.0, 0.0, 8.4), bevel_width=0.05, mat_idx=2)
    add_beveled_box(bm_wa, size=(3.1, 0.42, 0.85), center=(0.0, 0.0, 8.4), bevel_width=0.03, mat_idx=1)
    finalize_mesh_object("Waypoint_Pylon_A_Base", bm_wa, wmats, parent=r_wpa)

    # Separate Rotating Holographic Ring around Pylon A (pivot at (0,0,0)!)
    bm_ra = bmesh.new()
    for i in range(6):
        ang = (2.0 * math.pi * i) / 6.0
        add_beveled_box(
            bm_ra, size=(1.15, 0.24, 0.28),
            center=(math.cos(ang) * 2.15, math.sin(ang) * 2.15, 0.0),
            rotation=(0.0, 0.0, ang + math.pi * 0.5), bevel_width=0.03, mat_idx=0
        )
    finalize_mesh_object("Pylon_Ring_Rotator", bm_ra, [mats['emit_cyan']], parent=r_wpa, location=(0.0, 0.0, 4.5))

    # 7. Waypoint_Holding_Pylon_B (Terminal Holding Stack Fix Marker with dual rotating level rings)
    r_wpb = create_root_node("Waypoint_Holding_Pylon_B", location=(x_wp_b, 0.0, 0.0))
    bm_wb = bmesh.new()
    add_cylinder_part(bm_wb, radius1=2.6, radius2=2.3, depth=0.50, segments=8, center=(0.0, 0.0, 0.25), axis='Z', bevel_width=0.06, mat_idx=2)
    add_cylinder_part(bm_wb, radius1=0.65, radius2=0.45, depth=9.2, segments=8, center=(0.0, 0.0, 4.8), axis='Z', bevel_width=0.05, mat_idx=1)
    add_beveled_box(bm_wb, size=(3.8, 0.38, 1.25), center=(0.0, 0.0, 10.1), bevel_width=0.05, mat_idx=4)
    finalize_mesh_object("Waypoint_Pylon_B_Column", bm_wb, wmats, parent=r_wpb)

    for r_name, rz, r_mat in (("Hold_Ring_Lower", 3.6, mats['emit_cyan']), ("Hold_Ring_Upper", 6.8, mats['emit_amber'])):
        bm_hr = bmesh.new()
        for i in range(8):
            ang = (2.0 * math.pi * i) / 8.0
            add_beveled_box(
                bm_hr, size=(1.15, 0.26, 0.30),
                center=(math.cos(ang) * 2.45, math.sin(ang) * 2.45, 0.0),
                rotation=(0.0, 0.0, ang + math.pi * 0.5), bevel_width=0.03, mat_idx=0
            )
        finalize_mesh_object(r_name, bm_hr, [r_mat], parent=r_wpb, location=(0.0, 0.0, rz))

    # 8. Windsock_Mast (Illuminated Segmented Airfield Windsock with Swivel Cone at (0,0,0)!)
    r_ws = create_root_node("Windsock_Mast", location=(x_ws, 0.0, 0.0))
    bm_ws = bmesh.new()
    add_cylinder_part(bm_ws, radius1=1.8, radius2=1.8, depth=0.18, segments=16, center=(0.0, 0.0, 0.09), axis='Z', mat_idx=1)
    add_cylinder_part(bm_ws, radius1=0.14, radius2=0.10, depth=6.2, segments=12, center=(0.0, 0.0, 3.1), axis='Z', mat_idx=5)
    # Overhead night floodlight cage
    add_cylinder_part(bm_ws, radius1=0.35, radius2=0.12, depth=0.35, segments=12, center=(0.0, 0.0, 6.45), axis='Z', mat_idx=3)
    finalize_mesh_object("Windsock_Pole", bm_ws, wmats, parent=r_ws)

    # Separate Pivoting Windsock Fabric Cone (pivot at mast swivel (0,0,0)!)
    bm_cone = bmesh.new()
    # 5 alternating orange and white tapered fabric rings extending along +Y
    for seg in range(5):
        r1 = 0.45 - seg * 0.055
        r2 = 0.45 - (seg + 1) * 0.055
        y_pos = 0.55 + seg * 0.58
        z_droop = -seg * 0.06
        add_cylinder_part(
            bm_cone, radius1=r1, radius2=r2, depth=0.58, segments=14,
            center=(0.0, y_pos, z_droop), axis='Y', rotation=(0.10, 0.0, 0.0),
            bevel_width=0.01, mat_idx=0 if seg % 2 == 0 else 1
        )
    finalize_mesh_object("Windsock_Cone", bm_cone, [mats['orange'], mats['white']], parent=r_ws, location=(0.0, 0.0, 5.75))


def build_navaids_waypoints(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_radar_primary_asr(-48.0, mats)
    build_radar_enroute_radome(-28.0, mats)
    build_vor_and_ils(x_vor=-8.0, x_loc=12.0, x_gs=28.0, mats=mats)
    build_waypoint_pylons_and_windsock(x_wp_a=42.0, x_wp_b=54.0, x_ws=66.0, mats=mats)

    export_family_glb(os.path.join(output_dir, "navaids_waypoints.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_navaids_waypoints(out_dir)
