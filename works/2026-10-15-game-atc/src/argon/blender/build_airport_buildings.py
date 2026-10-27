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
    create_wheel_node,
    export_family_glb,
)


def build_control_tower(x_offset, mats):
    """
    1. Iconic ATC Control Tower (~42m tall):
    - Base operations podium with entrance canopy & HVAC units
    - Fluted octagonal concrete/white shaft with cobalt brand stripe & vertical window core
    - Cantilevered upper equipment deck & safety catwalk with railings
    - 360-degree angled dark-tinted visual control cab (VCR) with structural mullions
    - Rooftop rotating Surface Movement Radar (`Tower_SMR_Dish`), `Tower_Anemometer`,
      and `Tower_Beacon_Rotator` (all separate moving nodes with local pivot at (0,0,0)!)
    """
    root = create_root_node("Control_Tower_Main", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    bmats = [
        mats['white'], mats['cool_grey'], mats['cobalt'], mats['glass_dark'],
        mats['slate_dark'], mats['steel'], mats['emit_red'], mats['emit_amber'], mats['emit_cyan']
    ]

    # Base podium building
    add_beveled_box(bm, size=(14.0, 14.0, 4.8), center=(0.0, 0.0, 2.4), bevel_width=0.25, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(14.4, 14.4, 0.65), center=(0.0, 0.0, 4.65), bevel_width=0.10, mat_idx=2)
    # Recessed podium ribbon windows
    add_beveled_box(bm, size=(14.15, 11.2, 1.85), center=(0.0, 0.0, 2.65), bevel_width=0.05, mat_idx=3)
    add_beveled_box(bm, size=(11.2, 14.15, 1.85), center=(0.0, 0.0, 2.65), bevel_width=0.05, mat_idx=3)
    # Entrance canopy (+Y)
    add_beveled_box(bm, size=(5.2, 2.6, 0.35), center=(0.0, 8.1, 3.4), bevel_width=0.06, mat_idx=2)

    # Tall tapered tower shaft with 4 structural buttress fins
    add_cylinder_part(bm, radius1=3.6, radius2=2.85, depth=26.0, segments=12, center=(0.0, 0.0, 17.5), axis='Z', bevel_width=0.15, mat_idx=0)
    for ang_deg in (0, 90, 180, 270):
        ang = math.radians(ang_deg)
        bx = math.cos(ang) * 3.1
        by = math.sin(ang) * 3.1
        add_beveled_box(
            bm, size=(1.15, 1.45, 25.5),
            center=(bx, by, 17.4),
            rotation=(0.0, 0.0, ang),
            bevel_width=0.10, bevel_segments=2, mat_idx=1,
            scale_top=(0.78, 0.78),
        )
    # Vertical elevator glazing strip & cobalt brand collar near top of shaft
    add_beveled_box(bm, size=(1.25, 6.6, 22.0), center=(0.0, 0.0, 17.5), bevel_width=0.04, mat_idx=3)
    add_cylinder_part(bm, radius1=3.25, radius2=3.45, depth=2.2, segments=16, center=(0.0, 0.0, 28.5), axis='Z', bevel_width=0.10, mat_idx=2)

    # Upper TRACON / technical equipment deck & observation catwalk
    add_cylinder_part(bm, radius1=4.2, radius2=5.4, depth=3.2, segments=16, center=(0.0, 0.0, 31.2), axis='Z', bevel_width=0.15, mat_idx=0)
    add_cylinder_part(bm, radius1=5.8, radius2=5.8, depth=0.45, segments=24, center=(0.0, 0.0, 33.0), axis='Z', bevel_width=0.08, mat_idx=4)
    # Catwalk safety handrail ring
    for i in range(16):
        ang = (2.0 * math.pi * i) / 16
        add_cylinder_part(
            bm, radius1=0.05, radius2=0.05, depth=1.15, segments=8,
            center=(math.cos(ang) * 5.55, math.sin(ang) * 5.55, 33.7), axis='Z', mat_idx=5
        )

    # 360-degree outward-cantilevered ATC Control Cab (dark tinted glass + angled mullions)
    add_cylinder_part(bm, radius1=4.45, radius2=5.35, depth=3.4, segments=12, center=(0.0, 0.0, 34.8), axis='Z', bevel_width=0.06, mat_idx=3)
    for i in range(12):
        ang = (2.0 * math.pi * i) / 12
        mx = math.cos(ang) * 4.88
        my = math.sin(ang) * 4.88
        add_beveled_box(
            bm, size=(0.18, 0.24, 3.55),
            center=(mx, my, 34.8),
            rotation=(-0.25 * math.sin(ang), 0.25 * math.cos(ang), ang),
            bevel_width=0.02, mat_idx=4,
        )

    # Cab roof overhang disc, communications mast & obstruction lights
    add_cylinder_part(bm, radius1=5.75, radius2=4.60, depth=0.85, segments=16, center=(0.0, 0.0, 36.85), axis='Z', bevel_width=0.12, mat_idx=0)
    add_cylinder_part(bm, radius1=5.80, radius2=5.80, depth=0.28, segments=16, center=(0.0, 0.0, 36.65), axis='Z', bevel_width=0.04, mat_idx=2)
    # VHF/UIF antenna masts
    for ax, ay in ((-2.4, -2.0), (2.4, -2.0)):
        add_cylinder_part(bm, radius1=0.09, radius2=0.04, depth=4.6, segments=10, center=(ax, ay, 39.4), axis='Z', mat_idx=5)
        add_cylinder_part(bm, radius1=0.16, radius2=0.16, depth=0.22, segments=10, center=(ax, ay, 41.75), axis='Z', mat_idx=6)

    finalize_mesh_object("Control_Tower_Structure", bm, bmats, parent=root, uv_scale=0.12)

    # Separate Rotating Surface Movement Radar (SMR) on roof center (pivot at (0,0,0)!)
    bm_smr = bmesh.new()
    add_cylinder_part(bm_smr, radius1=0.55, radius2=0.45, depth=0.85, segments=14, center=(0.0, 0.0, 0.42), axis='Z', mat_idx=0)
    add_beveled_box(bm_smr, size=(3.85, 0.42, 0.68), center=(0.0, 0.0, 1.05), bevel_width=0.08, bevel_segments=2, mat_idx=1)
    add_beveled_box(bm_smr, size=(3.60, 0.46, 0.24), center=(0.0, 0.0, 1.05), bevel_width=0.03, mat_idx=2)
    finalize_mesh_object(
        "Tower_SMR_Dish", bm_smr, [mats['steel'], mats['white'], mats['cobalt']],
        parent=root, location=(0.0, 0.0, 37.25)
    )

    # Separate Rotating Anemometer wind sensor (pivot at (0,0,0)!)
    bm_anem = bmesh.new()
    add_cylinder_part(bm_anem, radius1=0.06, radius2=0.05, depth=1.20, segments=10, center=(0.0, 0.0, 0.60), axis='Z', mat_idx=0)
    for i in range(3):
        ang = (2.0 * math.pi * i) / 3.0
        add_beveled_box(
            bm_anem, size=(0.65, 0.05, 0.05),
            center=(math.cos(ang) * 0.32, math.sin(ang) * 0.32, 1.15),
            rotation=(0.0, 0.0, ang), bevel_width=0.01, mat_idx=0
        )
        add_cylinder_part(
            bm_anem, radius1=0.12, radius2=0.08, depth=0.14, segments=10,
            center=(math.cos(ang) * 0.65, math.sin(ang) * 0.65, 1.15), axis='Y', mat_idx=1
        )
    finalize_mesh_object(
        "Tower_Anemometer", bm_anem, [mats['steel'], mats['orange']],
        parent=root, location=(2.2, 2.2, 37.25)
    )

    # Separate Rotating Aerodrome Beacon (green/white airport locator beacon at (0,0,0)!)
    bm_bcn = bmesh.new()
    add_cylinder_part(bm_bcn, radius1=0.35, radius2=0.30, depth=0.65, segments=14, center=(0.0, 0.0, 0.32), axis='Z', mat_idx=0)
    add_cylinder_part(bm_bcn, radius1=0.28, radius2=0.28, depth=0.55, segments=14, center=(0.0, 0.0, 0.72), axis='X', mat_idx=1)
    add_cylinder_part(bm_bcn, radius1=0.24, radius2=0.24, depth=0.62, segments=12, center=(0.0, 0.0, 0.72), axis='X', mat_idx=2)
    finalize_mesh_object(
        "Tower_Beacon_Rotator", bm_bcn, [mats['steel'], mats['cobalt'], mats['emit_green']],
        parent=root, location=(-2.2, 2.2, 37.25)
    )


def build_terminal_concourse(x_offset, mats):
    """
    2. Main Passenger Terminal Concourse (~54m x 22m):
    - Curved/chamfered roof with skylights, cobalt brand fascia, recessed glazing
    - 4 spinning rooftop HVAC fans (`Terminal_HVAC_Fan_1..4`)
    - 3 articulated Passenger Boarding Bridges (`JetBridge_Boom_1..3` + `JetBridge_Cab_1..3`)
    """
    root = create_root_node("Terminal_Concourse_Main", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    bmats = [
        mats['white'], mats['cool_grey'], mats['cobalt'], mats['glass_dark'],
        mats['glass_blue'], mats['steel'], mats['amber'], mats['emit_amber'], mats['slate_dark']
    ]

    # Main 2-level concourse hall
    add_beveled_box(bm, size=(52.0, 18.0, 8.6), center=(0.0, 0.0, 4.3), bevel_width=0.35, bevel_segments=2, mat_idx=0)
    # Recessed curtain-wall window bays on airside (+Y) and landside (-Y)
    add_beveled_box(bm, size=(48.5, 18.25, 5.2), center=(0.0, 0.0, 4.4), bevel_width=0.08, mat_idx=3)
    # Structural vertical white columns along facade
    for cx in range(-22, 24, 6):
        add_beveled_box(bm, size=(0.75, 18.45, 8.5), center=(float(cx), 0.0, 4.25), bevel_width=0.08, mat_idx=0)

    # Cantilevered aerodynamic roof wing with cobalt fascia band & skylights
    add_beveled_box(bm, size=(54.5, 21.5, 1.35), center=(0.0, 0.0, 9.15), bevel_width=0.30, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(54.8, 21.8, 0.48), center=(0.0, 0.0, 9.15), bevel_width=0.08, mat_idx=2)
    for sx in (-16.0, 0.0, 16.0):
        add_beveled_box(bm, size=(9.5, 6.5, 0.55), center=(sx, 0.0, 9.95), bevel_width=0.12, mat_idx=4, scale_top=(0.88, 0.85))

    # Rooftop HVAC chiller housings (fan blades are separate child nodes!)
    hvac_xs = (-21.0, -7.0, 7.0, 21.0)
    for hx in hvac_xs:
        add_beveled_box(bm, size=(3.2, 2.8, 1.15), center=(hx, -5.2, 10.35), bevel_width=0.10, mat_idx=1)
        add_cylinder_part(bm, radius1=0.95, radius2=0.95, depth=0.30, segments=16, center=(hx, -5.2, 10.95), axis='Z', mat_idx=8)

    # Gate number signage plates (G1, G2, G3) on airside fascia
    for gx in (-16.0, 0.0, 16.0):
        add_beveled_box(bm, size=(2.4, 0.25, 1.10), center=(gx, 10.85, 9.15), bevel_width=0.04, mat_idx=6)
        # Fixed rotunda Vestibule pier for each JetBridge
        add_cylinder_part(bm, radius1=2.1, radius2=2.1, depth=5.6, segments=16, center=(gx, 10.8, 3.8), axis='Z', bevel_width=0.12, mat_idx=0)
        add_cylinder_part(bm, radius1=2.18, radius2=2.18, depth=0.45, segments=16, center=(gx, 10.8, 6.35), axis='Z', mat_idx=2)

    finalize_mesh_object("Terminal_Structure", bm, bmats, parent=root, uv_scale=0.10)

    # Separate spinning HVAC Fan nodes (pivot at (0,0,0)!)
    for idx, hx in enumerate(hvac_xs, start=1):
        bm_fan = bmesh.new()
        add_cylinder_part(bm_fan, radius1=0.22, radius2=0.22, depth=0.18, segments=12, center=(0.0, 0.0, 0.0), axis='Z', mat_idx=0)
        for b in range(6):
            ang = (2.0 * math.pi * b) / 6.0
            add_beveled_box(
                bm_fan, size=(0.78, 0.20, 0.04),
                center=(math.cos(ang) * 0.45, math.sin(ang) * 0.45, 0.0),
                rotation=(0.25, 0.0, ang), bevel_width=0.008, mat_idx=1
            )
        finalize_mesh_object(
            f"Terminal_HVAC_Fan_{idx}", bm_fan, [mats['steel'], mats['slate_dark']],
            parent=root, location=(hx, -5.2, 11.05)
        )

    # 3 Separate Articulated JetBridge Booms + End Cabs (pivots at rotunda hinge (0,0,0)!)
    for idx, gx in enumerate((-16.0, 0.0, 16.0), start=1):
        bm_jb = bmesh.new()
        # Telescopic bridge corridor extending along +Y from (0,0,0)
        add_beveled_box(bm_jb, size=(2.15, 9.5, 2.45), center=(0.0, 4.75, 0.0), bevel_width=0.10, mat_idx=0)
        add_beveled_box(bm_jb, size=(2.22, 8.2, 0.95), center=(0.0, 4.75, 0.15), bevel_width=0.03, mat_idx=2)
        add_beveled_box(bm_jb, size=(2.20, 9.2, 0.32), center=(0.0, 4.75, -0.85), bevel_width=0.03, mat_idx=1)
        jb_boom = finalize_mesh_object(
            f"JetBridge_Boom_{idx}", bm_jb, [mats['white'], mats['cobalt'], mats['glass_dark']],
            parent=root, location=(gx, 10.8, 4.4)
        )
        # Docking cab & support bogie at end of boom (pivot at (0,0,0)!)
        bm_cab = bmesh.new()
        add_cylinder_part(bm_cab, radius1=1.45, radius2=1.45, depth=2.55, segments=14, center=(0.0, 0.0, 0.0), axis='Z', bevel_width=0.08, mat_idx=0)
        # Accordion rubber canopy hood
        add_beveled_box(bm_cab, size=(1.95, 1.15, 2.35), center=(0.0, 1.35, 0.0), bevel_width=0.08, mat_idx=1)
        # Support column down to apron
        add_cylinder_part(bm_cab, radius1=0.22, radius2=0.22, depth=3.8, segments=12, center=(0.0, -0.4, -2.3), axis='Z', mat_idx=2)
        jb_cab = finalize_mesh_object(
            f"JetBridge_Cab_{idx}", bm_cab, [mats['white'], mats['slate_dark'], mats['steel']],
            parent=jb_boom, location=(0.0, 9.5, 0.0)
        )
        create_wheel_node(f"JetBridge_Wheel_{idx}", jb_cab, (0.0, -0.4, -4.05), radius=0.35, width=0.35, mat_tire=mats['tire'], mat_rim=mats['steel'])


def build_maintenance_hangar(name, x_offset, accent_mat, mats):
    """3 & 4. Wide-Span Maintenance Hangars A & B with Sliding Doors & Roof Vent Fans."""
    root = create_root_node(name, location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    bmats = [mats['white'], mats['cool_grey'], accent_mat, mats['glass_dark'], mats['slate_dark'], mats['steel'], mats['emit_white']]

    # Side walls, rear wall & arched truss roof leaving front (+Y) open for aircraft bay
    add_beveled_box(bm, size=(28.0, 26.0, 11.2), center=(0.0, 0.0, 5.6), bevel_width=0.25, bevel_segments=2, mat_idx=0)
    # Recessed dark interior bay cavity on +Y front face
    add_beveled_box(bm, size=(23.6, 2.2, 8.8), center=(0.0, 12.1, 4.4), bevel_width=0.08, mat_idx=4)
    # Bold header fascia beam in accent colour with high-bay floodlights
    add_beveled_box(bm, size=(28.6, 26.6, 1.35), center=(0.0, 0.0, 10.2), bevel_width=0.12, mat_idx=2)
    for lx in (-8.5, 0.0, 8.5):
        add_beveled_box(bm, size=(1.6, 0.45, 0.35), center=(lx, 13.35, 9.15), bevel_width=0.04, mat_idx=6)

    # Side technical office annex
    add_beveled_box(bm, size=(4.5, 18.0, 5.2), center=(15.8, -1.5, 2.6), bevel_width=0.15, mat_idx=1)
    add_beveled_box(bm, size=(4.65, 14.5, 1.8), center=(15.8, -1.5, 3.1), bevel_width=0.04, mat_idx=3)

    # Rooftop structural steel arch ribs
    for ry in range(-10, 12, 5):
        add_beveled_box(bm, size=(28.4, 0.65, 0.85), center=(0.0, float(ry), 11.45), bevel_width=0.08, mat_idx=5)

    finalize_mesh_object(f"{name}_Structure", bm, bmats, parent=root, uv_scale=0.12)

    # Separate Left & Right Sliding Hangar Doors (local pivot at (0,0,0) center of each door leaf!)
    for side_tag, sx in (("L", -6.2), ("R", 6.2)):
        bm_d = bmesh.new()
        add_beveled_box(bm_d, size=(11.8, 0.42, 8.75), center=(0.0, 0.0, 4.38), bevel_width=0.06, mat_idx=0)
        add_beveled_box(bm_d, size=(11.2, 0.48, 1.35), center=(0.0, 0.0, 4.85), bevel_width=0.03, mat_idx=1)
        add_beveled_box(bm_d, size=(11.85, 0.46, 0.55), center=(0.0, 0.0, 1.15), bevel_width=0.02, mat_idx=2)
        finalize_mesh_object(
            f"{name}_Door_{side_tag}", bm_d, [mats['cool_grey'], mats['glass_dark'], accent_mat],
            parent=root, location=(sx, 12.85, 0.0)
        )


def build_arff_fire_station(x_offset, mats):
    """5. Airport Rescue & Firefighting Station with 3 Roll-Up Apparatus Bay Doors & Hose Tower."""
    root = create_root_node("ARFF_Fire_Station", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    bmats = [mats['white'], mats['crimson'], mats['slate_dark'], mats['glass_dark'], mats['amber'], mats['emit_red']]

    # Main 3-bay apparatus building
    add_beveled_box(bm, size=(20.0, 14.0, 6.2), center=(0.0, 0.0, 3.1), bevel_width=0.20, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(20.4, 14.4, 0.85), center=(0.0, 0.0, 5.85), bevel_width=0.10, mat_idx=1)
    # Drill / watch tower on right corner
    add_beveled_box(bm, size=(4.8, 4.8, 12.5), center=(8.2, -4.2, 6.25), bevel_width=0.18, mat_idx=0)
    add_beveled_box(bm, size=(5.0, 5.0, 1.6), center=(8.2, -4.2, 10.8), bevel_width=0.05, mat_idx=3)
    add_cylinder_part(bm, radius1=0.28, radius2=0.24, depth=0.45, segments=12, center=(8.2, -4.2, 12.7), axis='Z', mat_idx=5)

    finalize_mesh_object("ARFF_Station_Structure", bm, bmats, parent=root, uv_scale=0.14)

    # 3 Separate Roll-Up Fire Bay Doors (pivot at top roller shaft (0,0,0)!)
    for idx, bx in enumerate((-5.6, 0.0, 5.6), start=1):
        bm_fb = bmesh.new()
        add_beveled_box(bm_fb, size=(4.2, 0.28, 4.4), center=(0.0, 0.0, -2.2), bevel_width=0.04, mat_idx=0)
        add_beveled_box(bm_fb, size=(3.8, 0.32, 1.2), center=(0.0, 0.0, -1.6), bevel_width=0.02, mat_idx=1)
        finalize_mesh_object(
            f"FireBay_Door_{idx}", bm_fb, [mats['crimson'], mats['glass_dark']],
            parent=root, location=(bx, 7.02, 4.45)
        )


def build_airport_buildings(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_control_tower(-65.0, mats)
    build_terminal_concourse(-12.0, mats)
    build_maintenance_hangar("Maintenance_Hangar_A", 42.0, mats['cobalt'], mats)
    build_maintenance_hangar("Maintenance_Hangar_B", 78.0, mats['amber'], mats)
    build_arff_fire_station(110.0, mats)

    export_family_glb(os.path.join(output_dir, "airport_buildings.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_airport_buildings(out_dir)
