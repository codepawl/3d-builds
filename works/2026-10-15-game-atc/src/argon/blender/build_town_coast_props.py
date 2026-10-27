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
    add_uv_sphere_part,
    finalize_mesh_object,
    create_root_node,
    export_family_glb,
)


def build_town_blocks(x_comm, x_res, mats):
    """
    1 & 2. `Town_Block_Commercial` & `Town_Block_Residential`:
    - Stylised miniature urban & suburban blocks matching the cool white/slate/cobalt reference palette.
    """
    bmats = [
        mats['white'], mats['cool_grey'], mats['cobalt'], mats['glass_dark'],
        mats['slate_dark'], mats['concrete_light'], mats['grass_low'],
        mats['amber'], mats['crimson'], mats['emerald']
    ]

    # 1. Town_Block_Commercial (Office towers + regional logistics warehouse on city block pad)
    r_c = create_root_node("Town_Block_Commercial", location=(x_comm, 0.0, 0.0))
    bm_c = bmesh.new()
    add_beveled_box(bm_c, size=(20.0, 18.0, 0.40), center=(0.0, 0.0, 0.20), bevel_width=0.10, mat_idx=5)
    # Mid-rise office tower A
    add_beveled_box(bm_c, size=(6.8, 6.2, 9.5), center=(-4.8, 3.6, 4.95), bevel_width=0.18, mat_idx=0)
    add_beveled_box(bm_c, size=(7.0, 6.4, 0.55), center=(-4.8, 3.6, 9.45), bevel_width=0.06, mat_idx=2)
    for wz in (2.2, 4.4, 6.6, 8.2):
        add_beveled_box(bm_c, size=(6.9, 5.2, 0.95), center=(-4.8, 3.6, wz), bevel_width=0.03, mat_idx=3)
    # Mid-rise office tower B
    add_beveled_box(bm_c, size=(6.2, 5.8, 7.2), center=(4.8, 3.8, 3.8), bevel_width=0.16, mat_idx=1)
    for wz in (2.0, 4.0, 6.0):
        add_beveled_box(bm_c, size=(5.2, 5.9, 0.90), center=(4.8, 3.8, wz), bevel_width=0.03, mat_idx=3)
    # Logistics warehouse block in front (-Y)
    add_beveled_box(bm_c, size=(15.5, 6.8, 3.6), center=(0.0, -4.2, 2.0), bevel_width=0.14, mat_idx=0)
    add_beveled_box(bm_c, size=(15.8, 7.0, 0.45), center=(0.0, -4.2, 3.55), bevel_width=0.05, mat_idx=2)
    for dx in (-5.0, -1.8, 1.8, 5.0):
        add_beveled_box(bm_c, size=(1.6, 0.25, 1.8), center=(dx, -7.55, 1.3), bevel_width=0.03, mat_idx=4)
    finalize_mesh_object("Town_Block_Commercial_Mesh", bm_c, bmats, parent=r_c, uv_scale=0.12)

    # 2. Town_Block_Residential (Terraced townhomes & courtyard houses with pitched roofs)
    r_r = create_root_node("Town_Block_Residential", location=(x_res, 0.0, 0.0))
    bm_r = bmesh.new()
    add_beveled_box(bm_r, size=(18.0, 16.0, 0.36), center=(0.0, 0.0, 0.18), bevel_width=0.10, mat_idx=6)
    houses = [
        ((-4.8, 3.6), (4.6, 3.8, 2.6), 2),
        ((0.4, 3.6),  (4.4, 3.8, 2.8), 4),
        ((5.4, 3.6),  (4.6, 3.8, 2.5), 8),
        ((-4.5, -3.4),(4.8, 4.0, 2.7), 4),
        ((1.2, -3.4), (5.2, 4.0, 2.9), 2),
        ((6.2, -3.4), (3.8, 3.6, 2.4), 7),
    ]
    for (hx, hy), (sx, sy, sz), roof_m in houses:
        add_beveled_box(bm_r, size=(sx, sy, sz), center=(hx, hy, 0.36 + sz * 0.5), bevel_width=0.08, mat_idx=0)
        add_beveled_box(bm_r, size=(sx + 0.12, sy * 0.72, 0.75), center=(hx, hy, 0.36 + sz * 0.58), bevel_width=0.02, mat_idx=3)
        # Pitched / mansard roof cap
        add_beveled_box(bm_r, size=(sx + 0.35, sy + 0.35, 1.15), center=(hx, hy, 0.36 + sz + 0.52), bevel_width=0.08, mat_idx=roof_m, scale_top=(0.82, 0.18))
    finalize_mesh_object("Town_Block_Residential_Mesh", bm_r, bmats, parent=r_r, uv_scale=0.14)


def build_lighthouse_ship_turbine(x_lh, x_ship, x_turb, mats):
    """3, 4 & 5. Coastal Headland Lighthouse, Coastal Container Ship, and Offshore Wind Turbine."""
    # 3. Coastal_Lighthouse_Pier + Rotating `Lighthouse_Beacon` at (0,0,0)
    r_lh = create_root_node("Coastal_Lighthouse_Pier", location=(x_lh, 0.0, 0.0))
    bm_lh = bmesh.new()
    lmats = [mats['white'], mats['crimson'], mats['rock'], mats['slate_dark'], mats['glass_blue'], mats['emit_amber']]

    # Stone breakwater pier & keeper cottage
    add_beveled_box(bm_lh, size=(9.5, 14.0, 1.4), center=(0.0, -1.5, 0.7), bevel_width=0.25, mat_idx=2, scale_top=(0.88, 0.92))
    add_beveled_box(bm_lh, size=(4.2, 5.2, 2.6), center=(-1.5, -3.8, 2.5), bevel_width=0.10, mat_idx=0)
    add_beveled_box(bm_lh, size=(4.5, 5.5, 1.1), center=(-1.5, -3.8, 4.25), bevel_width=0.08, mat_idx=1, scale_top=(0.80, 0.20))

    # Striped lighthouse tower bands
    for seg_i, (z_bot, z_top, r1, r2, m_i) in enumerate((
        (1.3, 4.3, 1.75, 1.52, 0),
        (4.3, 7.3, 1.52, 1.32, 1),
        (7.3, 10.3, 1.32, 1.14, 0),
        (10.3, 12.8, 1.14, 1.00, 1),
    )):
        h = z_top - z_bot
        add_cylinder_part(bm_lh, radius1=r1, radius2=r2, depth=h, segments=16, center=(1.2, 2.2, z_bot + h * 0.5), axis='Z', bevel_width=0.04, mat_idx=m_i)
    # Gallery balcony, glass lantern room & dome cap
    add_cylinder_part(bm_lh, radius1=1.48, radius2=1.48, depth=0.35, segments=16, center=(1.2, 2.2, 12.95), axis='Z', mat_idx=3)
    add_cylinder_part(bm_lh, radius1=0.96, radius2=0.96, depth=1.65, segments=14, center=(1.2, 2.2, 13.9), axis='Z', mat_idx=4)
    add_cylinder_part(bm_lh, radius1=1.12, radius2=0.18, depth=1.05, segments=16, center=(1.2, 2.2, 15.15), axis='Z', mat_idx=1)
    finalize_mesh_object("Coastal_Lighthouse_Structure", bm_lh, lmats, parent=r_lh)

    # Separate Rotating Fresnel Beacon inside lantern room (pivot at (0,0,0)!)
    bm_bcn = bmesh.new()
    add_cylinder_part(bm_bcn, radius1=0.45, radius2=0.45, depth=0.65, segments=12, center=(0.0, 0.0, 0.0), axis='Z', mat_idx=0)
    add_cylinder_part(bm_bcn, radius1=0.32, radius2=0.55, depth=0.85, segments=12, center=(0.0, 0.55, 0.0), axis='Y', mat_idx=1)
    finalize_mesh_object("Lighthouse_Beacon", bm_bcn, [mats['steel'], mats['emit_amber']], parent=r_lh, location=(1.2, 2.2, 13.85))

    # 4. Cargo_Ship_Coaster (Stylised coastal container vessel for the bay + rotating Ship_Radar_Scanner)
    r_sh = create_root_node("Cargo_Ship_Coaster", location=(x_ship, 0.0, 0.0))
    bm_sh = bmesh.new()
    smats = [mats['cobalt'], mats['crimson'], mats['white'], mats['slate_dark'], mats['glass_dark'], mats['amber'], mats['cyan'], mats['emerald']]
    hull_sections = [
        (11.0,  1.2, 0.15, 1.15),
        (9.2,   1.1, 1.85, 1.25),
        (5.5,   1.0, 3.10, 1.20),
        (-6.5,  1.0, 3.10, 1.20),
        (-10.2, 1.1, 2.35, 1.15),
        (-11.2, 1.2, 0.85, 0.95),
    ]
    add_lofted_fuselage(bm_sh, hull_sections, segments=18, mat_idx=0, belly_mat_idx=1)
    # Flat cargo deck
    add_beveled_box(bm_sh, size=(5.6, 17.5, 0.45), center=(0.0, -0.5, 1.95), bevel_width=0.08, mat_idx=3)
    # Aft bridge superstructure
    add_beveled_box(bm_sh, size=(4.8, 3.8, 4.2), center=(0.0, -7.2, 4.1), bevel_width=0.12, mat_idx=2)
    add_beveled_box(bm_sh, size=(5.2, 2.6, 1.35), center=(0.0, -6.8, 6.55), bevel_width=0.08, mat_idx=2)
    add_beveled_box(bm_sh, size=(5.3, 1.8, 0.65), center=(0.0, -6.4, 6.65), bevel_width=0.03, mat_idx=4)
    # Exhaust funnel with cobalt brand stripe
    add_beveled_box(bm_sh, size=(1.4, 1.8, 2.4), center=(0.0, -8.4, 7.2), bevel_width=0.08, mat_idx=0)
    # Colorful stacked containers on forward deck
    containers = [
        ((-1.35, 3.5, 2.85), 5), ((1.35, 3.5, 2.85), 0),
        ((-1.35, 3.5, 4.25), 6), ((1.35, 3.5, 4.25), 1),
        ((-1.35, -1.5, 2.85), 7), ((1.35, -1.5, 2.85), 5),
        ((-1.35, -1.5, 4.25), 0), ((1.35, -1.5, 4.25), 6),
    ]
    for c_pos, c_mat in containers:
        add_beveled_box(bm_sh, size=(2.35, 4.4, 1.35), center=c_pos, bevel_width=0.06, mat_idx=c_mat)
    finalize_mesh_object("Cargo_Ship_Hull", bm_sh, smats, parent=r_sh)

    bm_sr = bmesh.new()
    add_cylinder_part(bm_sr, radius1=0.14, radius2=0.12, depth=0.85, segments=10, center=(0.0, 0.0, 0.42), axis='Z', mat_idx=0)
    add_beveled_box(bm_sr, size=(1.65, 0.24, 0.22), center=(0.0, 0.0, 0.90), bevel_width=0.03, mat_idx=1)
    finalize_mesh_object("Ship_Radar_Scanner", bm_sr, [mats['steel'], mats['white']], parent=r_sh, location=(0.0, -6.8, 7.25))

    # 5. Wind_Turbine_Offshore (Tower + Yawing `Turbine_Nacelle` + Spinning 3-Blade `Turbine_Rotor` at (0,0,0)!)
    r_wt = create_root_node("Wind_Turbine_Offshore", location=(x_turb, 0.0, 0.0))
    bm_wt = bmesh.new()
    add_cylinder_part(bm_wt, radius1=1.85, radius2=1.65, depth=1.6, segments=16, center=(0.0, 0.0, 0.8), axis='Z', bevel_width=0.08, mat_idx=0)
    add_cylinder_part(bm_wt, radius1=1.15, radius2=0.62, depth=18.5, segments=16, center=(0.0, 0.0, 10.6), axis='Z', bevel_width=0.06, mat_idx=1)
    finalize_mesh_object("Wind_Turbine_Tower", bm_wt, [mats['amber'], mats['white']], parent=r_wt)

    # Separate Yawing Nacelle at top of tower (pivot at (0,0,0)!)
    bm_nac = bmesh.new()
    add_beveled_box(bm_nac, size=(1.85, 4.2, 1.95), center=(0.0, -0.6, 0.95), bevel_width=0.22, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm_nac, size=(1.90, 3.6, 0.35), center=(0.0, -0.6, 0.95), bevel_width=0.04, mat_idx=1)
    nac_node = finalize_mesh_object("Turbine_Nacelle", bm_nac, [mats['white'], mats['cobalt']], parent=r_wt, location=(0.0, 0.0, 19.8))

    # Separate Spinning 3-Blade Rotor at front of nacelle (pivot at hub center (0,0,0), rotates around Y!)
    bm_rot = bmesh.new()
    add_cylinder_part(bm_rot, radius1=0.88, radius2=0.18, depth=1.85, segments=16, center=(0.0, 0.75, 0.0), axis='Y', bevel_width=0.05, mat_idx=0)
    for i in range(3):
        ang = (2.0 * math.pi * i) / 3.0
        bx = math.cos(ang) * 4.4
        bz = math.sin(ang) * 4.4
        add_beveled_box(
            bm_rot, size=(8.2, 0.20, 0.68),
            center=(bx, 0.75, bz),
            rotation=(0.24, -ang, 0.0),
            bevel_width=0.04, mat_idx=0
        )
        tx = math.cos(ang) * 8.1
        tz = math.sin(ang) * 8.1
        add_beveled_box(
            bm_rot, size=(1.3, 0.22, 0.56),
            center=(tx, 0.75, tz),
            rotation=(0.24, -ang, 0.0),
            bevel_width=0.02, mat_idx=1
        )
    finalize_mesh_object("Turbine_Rotor", bm_rot, [mats['white'], mats['crimson']], parent=nac_node, location=(0.0, 1.55, 0.95))


def build_tree_clusters(x_pine, x_decid, mats):
    """6 & 7. Chunky Stylized Tree Clusters (`Tree_Cluster_Pine` & `Tree_Cluster_Deciduous`)."""
    # 6. Tree_Cluster_Pine
    r_p = create_root_node("Tree_Cluster_Pine", location=(x_pine, 0.0, 0.0))
    bm_p = bmesh.new()
    for tx, ty, sc in ((-1.8, 0.8, 1.0), (1.6, 1.1, 0.85), (0.2, -1.6, 1.15), (-1.4, -1.4, 0.72)):
        add_cylinder_part(bm_p, radius1=0.28 * sc, radius2=0.20 * sc, depth=1.6 * sc, segments=8, center=(tx, ty, 0.8 * sc), axis='Z', mat_idx=0)
        for tier, (z_b, r_b, h_t) in enumerate(((1.2, 1.55, 1.8), (2.3, 1.22, 1.7), (3.3, 0.85, 1.5))):
            add_cylinder_part(
                bm_p, radius1=r_b * sc, radius2=0.12 * sc, depth=h_t * sc, segments=7,
                center=(tx, ty, (z_b + h_t * 0.5) * sc), axis='Z', bevel_width=0.05, mat_idx=1
            )
    finalize_mesh_object("Tree_Cluster_Pine_Mesh", bm_p, [mats['wood'], mats['pine']], parent=r_p)

    # 7. Tree_Cluster_Deciduous
    r_d = create_root_node("Tree_Cluster_Deciduous", location=(x_decid, 0.0, 0.0))
    bm_d = bmesh.new()
    for tx, ty, sc in ((-1.8, 0.9, 1.0), (1.7, 0.7, 0.88), (0.0, -1.5, 1.12)):
        add_cylinder_part(bm_d, radius1=0.30 * sc, radius2=0.22 * sc, depth=2.0 * sc, segments=8, center=(tx, ty, 1.0 * sc), axis='Z', mat_idx=0)
        add_uv_sphere_part(bm_d, radius=1.55 * sc, scale=(1.05, 1.0, 0.88), center=(tx, ty, 2.85 * sc), u_segments=10, v_segments=8, mat_idx=1)
        add_uv_sphere_part(bm_d, radius=1.10 * sc, scale=(1.0, 1.0, 0.90), center=(tx + 0.55 * sc, ty - 0.35 * sc, 3.45 * sc), u_segments=10, v_segments=8, mat_idx=2)
    finalize_mesh_object("Tree_Cluster_Deciduous_Mesh", bm_d, [mats['wood'], mats['leaf'], mats['pine']], parent=r_d)


def build_town_coast_props(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_town_blocks(x_comm=-52.0, x_res=-26.0, mats=mats)
    build_lighthouse_ship_turbine(x_lh=-4.0, x_ship=18.0, x_turb=38.0, mats=mats)
    build_tree_clusters(x_pine=54.0, x_decid=66.0, mats=mats)

    export_family_glb(os.path.join(output_dir, "town_coast_props.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_town_coast_props(out_dir)
