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


def build_sector_terrain_tiles(mats):
    """
    Build the 3 main control sector stylized isometric terrain platters + 3 modular hill/cliff clusters:
    - `Terrain_TowerSector`: Coastal airport peninsula platter with seawall, sandy bay, graded airfield table & perimeter road.
    - `Terrain_ApproachSector`: Terminal area (TMA) coastal basin with terraced hills, river estuary, highway ribbons & town pads.
    - `Terrain_EnrouteSector`: Regional high-altitude sector terrain platter with mountain ridges, highland lake & coastal headland.
    - `Hill_Cluster_A`, `Hill_Cluster_B`, `Coast_Cliff_A`: Instancable terraced topographic formations.
    """
    # 0:rim, 1:water, 2:shallow, 3:sand, 4:grass_low, 5:grass_mid, 6:rock, 7:concrete_light, 8:asphalt, 9:cobalt
    tmats = [
        mats['rim'], mats['water'], mats['shallow'], mats['sand'],
        mats['grass_low'], mats['grass_mid'], mats['rock'],
        mats['concrete_light'], mats['asphalt'], mats['cobalt']
    ]

    # 1. Terrain_TowerSector (Airport Peninsula Sector Tile)
    r_twr = create_root_node("Terrain_TowerSector", location=(-110.0, 0.0, 0.0))
    bm1 = bmesh.new()
    # Chamfered geological base plinth + ocean water table
    add_beveled_box(bm1, size=(84.0, 84.0, 2.4), center=(0.0, 0.0, -1.2), bevel_width=0.45, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm1, size=(81.5, 81.5, 0.6), center=(0.0, 0.0, 0.1), bevel_width=0.15, mat_idx=1)
    # Shallow coastal shelf & sandy shoreline around south/west edges
    add_beveled_box(bm1, size=(74.0, 70.0, 0.55), center=(3.0, 4.0, 0.35), bevel_width=0.35, bevel_segments=2, mat_idx=2)
    add_beveled_box(bm1, size=(70.0, 66.0, 0.65), center=(4.0, 5.0, 0.60), bevel_width=0.40, bevel_segments=2, mat_idx=3)
    # Graded green airfield table with concrete seawall revetment
    add_beveled_box(bm1, size=(66.0, 62.0, 0.95), center=(4.5, 5.5, 0.95), bevel_width=0.35, bevel_segments=2, mat_idx=4)
    add_beveled_box(bm1, size=(56.0, 48.0, 0.25), center=(4.5, 5.5, 1.48), bevel_width=0.12, mat_idx=7)
    # Low perimeter hills on north edge (+Y)
    add_beveled_box(bm1, size=(24.0, 12.0, 2.2), center=(-14.0, 28.0, 2.1), bevel_width=0.45, mat_idx=5, scale_top=(0.75, 0.72))
    add_beveled_box(bm1, size=(14.0, 7.5, 2.0), center=(-15.0, 28.5, 3.6), bevel_width=0.35, mat_idx=6, scale_top=(0.68, 0.65))
    finalize_mesh_object("Terrain_TowerSector_Mesh", bm1, tmats, parent=r_twr, uv_scale=0.04)

    # 2. Terrain_ApproachSector (Terminal Manoeuvring Area / TMA Basin Tile)
    r_app = create_root_node("Terrain_ApproachSector", location=(0.0, 0.0, 0.0))
    bm2 = bmesh.new()
    add_beveled_box(bm2, size=(84.0, 84.0, 2.4), center=(0.0, 0.0, -1.2), bevel_width=0.45, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm2, size=(81.5, 81.5, 0.6), center=(0.0, 0.0, 0.1), bevel_width=0.15, mat_idx=1)
    # Two coastal land masses separated by a river estuary channel
    add_beveled_box(bm2, size=(48.0, 76.0, 0.95), center=(-15.0, 0.0, 0.65), bevel_width=0.45, bevel_segments=2, mat_idx=4)
    add_beveled_box(bm2, size=(26.0, 68.0, 0.95), center=(26.0, 4.0, 0.65), bevel_width=0.45, bevel_segments=2, mat_idx=4)
    # Estuary bridge & highway arterial ribbons
    add_beveled_box(bm2, size=(16.0, 3.2, 0.45), center=(10.0, -8.0, 1.35), bevel_width=0.08, mat_idx=7)
    add_beveled_box(bm2, size=(68.0, 2.2, 0.18), center=(-2.0, -8.0, 1.20), bevel_width=0.04, mat_idx=8)
    # Terraced hills flanking approach corridor
    for hx, hy, sx, sy, h1, h2 in ((-24.0, 22.0, 22.0, 18.0, 2.6, 4.4), (26.0, 20.0, 18.0, 20.0, 2.4, 3.8)):
        add_beveled_box(bm2, size=(sx, sy, h1), center=(hx, hy, 1.1 + h1 * 0.5), bevel_width=0.45, mat_idx=5, scale_top=(0.76, 0.76))
        add_beveled_box(bm2, size=(sx * 0.62, sy * 0.62, h2 - h1), center=(hx, hy, 1.1 + h1 + (h2 - h1) * 0.5), bevel_width=0.35, mat_idx=6, scale_top=(0.68, 0.68))
    finalize_mesh_object("Terrain_ApproachSector_Mesh", bm2, tmats, parent=r_app, uv_scale=0.04)

    # 3. Terrain_EnrouteSector (High-Altitude Regional Sector Tile with Mountain Ridge & Lake)
    r_enr = create_root_node("Terrain_EnrouteSector", location=(110.0, 0.0, 0.0))
    bm3 = bmesh.new()
    add_beveled_box(bm3, size=(84.0, 84.0, 2.4), center=(0.0, 0.0, -1.2), bevel_width=0.45, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm3, size=(81.5, 81.5, 0.90), center=(0.0, 0.0, 0.45), bevel_width=0.35, mat_idx=4)
    # Highland valley reservoir lake
    add_beveled_box(bm3, size=(28.0, 42.0, 0.35), center=(-14.0, -6.0, 0.85), bevel_width=0.25, mat_idx=1)
    # Multi-tier mountain range on east/north sector boundary
    peaks = [
        ((18.0, 14.0), (32.0, 38.0), 3.2, 6.2, 9.2),
        ((-12.0, 26.0), (28.0, 22.0), 2.8, 5.4, 7.8),
        ((20.0, -20.0), (26.0, 24.0), 2.5, 4.6, 6.5),
    ]
    for (px, py), (sx, sy), z1, z2, z3 in peaks:
        add_beveled_box(bm3, size=(sx, sy, z1), center=(px, py, 0.8 + z1 * 0.5), bevel_width=0.5, mat_idx=5, scale_top=(0.78, 0.78))
        add_beveled_box(bm3, size=(sx * 0.65, sy * 0.65, z2 - z1), center=(px, py, 0.8 + z1 + (z2 - z1) * 0.5), bevel_width=0.4, mat_idx=6, scale_top=(0.72, 0.72))
        add_beveled_box(bm3, size=(sx * 0.36, sy * 0.36, z3 - z2), center=(px, py, 0.8 + z2 + (z3 - z2) * 0.5), bevel_width=0.3, mat_idx=7, scale_top=(0.60, 0.60))
    finalize_mesh_object("Terrain_EnrouteSector_Mesh", bm3, tmats, parent=r_enr, uv_scale=0.04)

    # 4, 5 & 6. Modular Instancable Hill & Coastal Cliff Clusters
    r_ha = create_root_node("Hill_Cluster_A", location=(-45.0, 62.0, 0.0))
    bm_ha = bmesh.new()
    add_beveled_box(bm_ha, size=(18.0, 14.0, 2.2), center=(0.0, 0.0, 1.1), bevel_width=0.40, mat_idx=4, scale_top=(0.78, 0.78))
    add_beveled_box(bm_ha, size=(12.0, 9.5, 2.4), center=(-1.2, 0.6, 3.2), bevel_width=0.35, mat_idx=5, scale_top=(0.72, 0.72))
    add_beveled_box(bm_ha, size=(6.8, 5.4, 2.0), center=(-1.5, 0.8, 5.2), bevel_width=0.28, mat_idx=6, scale_top=(0.65, 0.65))
    finalize_mesh_object("Hill_Cluster_A_Mesh", bm_ha, tmats, parent=r_ha, uv_scale=0.08)

    r_hb = create_root_node("Hill_Cluster_B", location=(0.0, 62.0, 0.0))
    bm_hb = bmesh.new()
    add_beveled_box(bm_hb, size=(22.0, 16.0, 2.6), center=(0.0, 0.0, 1.3), bevel_width=0.45, mat_idx=5, scale_top=(0.80, 0.76))
    add_beveled_box(bm_hb, size=(9.5, 8.5, 3.2), center=(-4.2, 1.2, 4.0), bevel_width=0.35, mat_idx=6, scale_top=(0.65, 0.65))
    add_beveled_box(bm_hb, size=(8.2, 7.5, 2.4), center=(4.8, -1.0, 3.6), bevel_width=0.32, mat_idx=6, scale_top=(0.68, 0.68))
    finalize_mesh_object("Hill_Cluster_B_Mesh", bm_hb, tmats, parent=r_hb, uv_scale=0.08)

    r_cc = create_root_node("Coast_Cliff_A", location=(45.0, 62.0, 0.0))
    bm_cc = bmesh.new()
    add_beveled_box(bm_cc, size=(16.0, 10.0, 1.2), center=(0.0, 0.0, 0.6), bevel_width=0.25, mat_idx=3, scale_top=(0.88, 0.85))
    add_beveled_box(bm_cc, size=(13.5, 7.8, 3.4), center=(0.0, -0.8, 2.6), bevel_width=0.35, mat_idx=6, scale_top=(0.76, 0.72))
    add_beveled_box(bm_cc, size=(10.2, 5.8, 0.8), center=(0.0, -0.8, 4.5), bevel_width=0.20, mat_idx=4, scale_top=(0.85, 0.85))
    finalize_mesh_object("Coast_Cliff_A_Mesh", bm_cc, tmats, parent=r_cc, uv_scale=0.08)


def build_terrain_sectors(output_dir):
    clear_scene()
    mats = get_standard_materials()
    build_sector_terrain_tiles(mats)
    export_family_glb(os.path.join(output_dir, "terrain_sectors.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_terrain_sectors(out_dir)
