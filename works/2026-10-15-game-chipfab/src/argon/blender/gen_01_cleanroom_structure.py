import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, add_vent_grille, add_bolt_row, finalize_and_export_glb
)


def build_floor_cleanroom(pal, x_off=-10.0):
    root = make_empty("Floor_Cleanroom_Tile_4m", loc=(x_off, 0, 0))
    # Sub-frame steel pedestal grid + main floor deck (4.0m x 4.0m x 0.20m)
    add_box("CR_SubBase", (3.96, 3.96, 0.12), (0, 0, 0.06), mat=pal["dark_slate"], bevel=0.01, parent=root)
    add_box("CR_MainDeck", (4.00, 4.00, 0.08), (0, 0, 0.16), mat=pal["white"], bevel=0.012, parent=root)

    # Raised tile grid plates & perforated airflow return strips
    for gx in range(-1, 2):
        for gy in range(-1, 2):
            cx, cy = gx * 1.15, gy * 1.15
            tmat = pal["cool_grey"] if (gx + gy) % 2 == 0 else pal["white"]
            add_box(f"CR_Tile_{gx}_{gy}", (1.08, 1.08, 0.018), (cx, cy, 0.205),
                    mat=tmat, bevel=0.005, parent=root)
            # Perforated air-return grating slots on center row
            if gy == 0:
                for s in range(-2, 3):
                    add_box(f"CR_Perf_{gx}_{s}", (0.86, 0.06, 0.022), (cx, cy + s * 0.16, 0.207),
                            mat=pal["dark_slate"], bevel=0.002, parent=root)

    # Cobalt-blue AGV/Engineer aisle walk-line strips on front & back edges
    add_box("CR_AisleStripe_F", (3.96, 0.12, 0.018), (0, 1.84, 0.206), mat=pal["brand_blue"], bevel=0.003, parent=root)
    add_box("CR_AisleStripe_B", (3.96, 0.12, 0.018), (0, -1.84, 0.206), mat=pal["brand_blue"], bevel=0.003, parent=root)
    return root


def build_floor_litho(pal, x_off=-5.0):
    root = make_empty("Floor_LithoBay_Tile_4m", loc=(x_off, 0, 0))
    add_box("LB_SubBase", (3.96, 3.96, 0.12), (0, 0, 0.06), mat=pal["dark_slate"], bevel=0.01, parent=root)
    add_box("LB_MainDeck", (4.00, 4.00, 0.08), (0, 0, 0.16), mat=pal["litho_floor"], bevel=0.012, parent=root)

    # Vibration-isolated scanner inertia pad in center
    add_box("LB_VibrationPad", (2.60, 2.60, 0.028), (0, 0, 0.21), mat=pal["cool_grey"], bevel=0.008, parent=root)
    add_box("LB_PadTrim", (2.72, 2.72, 0.016), (0, 0, 0.204), mat=pal["safety_yellow"], bevel=0.004, parent=root)

    # Yellow-room safe-light LED guide strips
    add_box("LB_AmberLED_F", (3.88, 0.08, 0.022), (0, 1.84, 0.208), mat=pal["emit_amber"], bevel=0.003, parent=root)
    add_box("LB_AmberLED_B", (3.88, 0.08, 0.022), (0, -1.84, 0.208), mat=pal["emit_amber"], bevel=0.003, parent=root)
    return root


def build_wall_partition(pal, x_off=0.0):
    root = make_empty("Wall_Cutaway_Partition_4m", loc=(x_off, 0, 0))
    # Base plinth + main insulated cleanroom wall (4.0m wide x 0.28m thick x 3.2m high)
    add_box("WP_Plinth", (4.00, 0.32, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.012, parent=root)
    # Left, Center, Right vertical pilasters
    for idx, px in enumerate((-1.88, 0.0, 1.88)):
        add_box(f"WP_Pilaster_{idx}", (0.24, 0.30, 2.90), (px, 0, 1.65),
                mat=pal["white"], bevel=0.015, parent=root)

    # Lower wall panels with air-return louver vents
    for idx, wx in enumerate((-0.94, 0.94)):
        add_box(f"WP_LowerWall_{idx}", (1.68, 0.24, 1.05), (wx, 0, 0.72),
                mat=pal["white"], bevel=0.012, parent=root)
        add_vent_grille(f"WP_ReturnVent_F_{idx}", width=1.20, height=0.42, slats=6,
                        loc=(wx, 0.125, 0.58), frame_mat=pal["cool_grey"], slat_mat=pal["dark_slate"], parent=root)
        add_vent_grille(f"WP_ReturnVent_B_{idx}", width=1.20, height=0.42, slats=6,
                        loc=(wx, -0.125, 0.58), rot=(0, 0, math.pi),
                        frame_mat=pal["cool_grey"], slat_mat=pal["dark_slate"], parent=root)
        # Upper inspection window bay (flush bevel frame + reflective dark glass)
        add_hollow_frame(f"WP_WinFrame_{idx}", (1.66, 0.28, 1.35), thickness=0.08,
                         loc=(wx, 0, 1.92), mat=pal["brand_blue"], parent=root)
        add_box(f"WP_WinGlass_{idx}", (1.52, 0.10, 1.22), (wx, 0, 1.92),
                mat=pal["glass_dark"], bevel=0.005, parent=root)
        # Upper header fascia above window
        add_box(f"WP_UpperHeader_{idx}", (1.68, 0.26, 0.50), (wx, 0, 2.85),
                mat=pal["cool_grey"], bevel=0.012, parent=root)

    # Cutaway top architectural cap in strong cobalt brand blue
    add_box("WP_CutawayCap", (4.04, 0.36, 0.14), (0, 0, 3.16), mat=pal["brand_blue"], bevel=0.018, parent=root)
    add_box("WP_LEDStrip_F", (3.80, 0.03, 0.04), (0, 0.155, 2.68), mat=pal["emit_cyan"], bevel=0.004, parent=root)
    return root


def build_wall_airlock(pal, x_off=5.0):
    root = make_empty("Wall_Airlock_Gowning_4m", loc=(x_off, 0, 0))
    # Left & Right structural side jamb walls
    for side, sx in (("L", -1.45), ("R", 1.45)):
        add_box(f"AL_Wall_{side}", (1.10, 0.36, 3.10), (sx, 0, 1.55), mat=pal["white"], bevel=0.016, parent=root)
        add_box(f"AL_Base_{side}", (1.14, 0.40, 0.20), (sx, 0, 0.10), mat=pal["dark_slate"], bevel=0.012, parent=root)
        add_vent_grille(f"AL_Vent_{side}", width=0.75, height=0.45, slats=6,
                        loc=(sx, 0.185, 0.65), frame_mat=pal["cool_grey"], slat_mat=pal["dark_slate"], parent=root)

    # Overhead air-shower lintel & cutaway cap
    add_box("AL_Lintel", (1.84, 0.42, 0.72), (0, 0, 2.74), mat=pal["cool_grey"], bevel=0.016, parent=root)
    add_box("AL_CutawayCap", (4.04, 0.44, 0.14), (0, 0, 3.16), mat=pal["brand_blue"], bevel=0.018, parent=root)
    add_box("AL_StatusSign", (1.20, 0.05, 0.22), (0, 0.22, 2.72), mat=pal["dark_slate"], bevel=0.008, parent=root)
    add_box("AL_StatusGlow", (1.08, 0.02, 0.12), (0, 0.245, 2.72), mat=pal["emit_green"], bevel=0.003, parent=root)

    # Badge access terminal on right wall
    add_box("AL_BadgeBox", (0.18, 0.06, 0.28), (1.08, 0.20, 1.32), mat=pal["dark_slate"], bevel=0.008, parent=root)
    add_box("AL_BadgeLED", (0.12, 0.02, 0.14), (1.08, 0.23, 1.35), mat=pal["emit_cyan"], bevel=0.003, parent=root)

    # Articulated Sliding Doors (Airlock_Door_L and Airlock_Door_R with origins at their local centers)
    for side, dx in (("L", -0.46), ("R", 0.46)):
        door_piv = make_empty(f"Airlock_Door_{side}", loc=(dx, 0, 1.18), parent=root)
        add_box(f"AL_DoorFrame_{side}", (0.90, 0.10, 2.34), (0, 0, 0),
                mat=pal["brand_blue"], bevel=0.012, parent=door_piv)
        add_box(f"AL_DoorGlass_{side}", (0.64, 0.12, 1.50), (0, 0, 0.22),
                mat=pal["glass_dark"], bevel=0.006, parent=door_piv)
        add_box(f"AL_DoorKick_{side}", (0.76, 0.12, 0.42), (0, 0, -0.88),
                mat=pal["steel"], bevel=0.006, parent=door_piv)
    return root


def build_ceiling_ffu(pal, x_off=10.0):
    root = make_empty("Ceiling_FFU_Canopy_4m", loc=(x_off, 0, 0))
    # Suspended 4m x 4m cleanroom HEPA ceiling grid frame (positioned sitting on z=0..0.45 for easy preview/instancing)
    add_hollow_frame("FFU_OuterGrid", (4.00, 0.26, 4.00), thickness=0.18,
                     loc=(0, 0, 0.20), rot=(math.radians(90), 0, 0), mat=pal["white"], parent=root)
    # Cross T-bars
    add_box("FFU_Cross_X", (3.80, 0.16, 0.22), (0, 0, 0.20), mat=pal["cool_grey"], bevel=0.008, parent=root)
    add_box("FFU_Cross_Y", (0.16, 3.80, 0.22), (0, 0, 0.20), mat=pal["cool_grey"], bevel=0.008, parent=root)

    # 4 Fan Filter Units in the 4 quadrants, each with an articulated spinning blower fan!
    quads = [(-0.96, -0.96, 1), (0.96, -0.96, 2), (-0.96, 0.96, 3), (0.96, 0.96, 4)]
    for qx, qy, idx in quads:
        add_box(f"FFU_Housing_{idx}", (1.68, 1.68, 0.18), (qx, qy, 0.18),
                mat=pal["cool_grey"], bevel=0.012, parent=root)
        add_cylinder(f"FFU_Shroud_{idx}", radius=0.44, depth=0.14, vertices=24,
                     loc=(qx, qy, 0.30), mat=pal["dark_slate"], bevel=0.010, parent=root)
        # Articulated Fan Rotor (origin at center of fan!)
        fan_piv = make_empty(f"FFU_Fan_{idx}", loc=(qx, qy, 0.34), parent=root)
        add_cylinder(f"FFU_Hub_{idx}", radius=0.12, depth=0.08, vertices=16,
                     loc=(0, 0, 0), mat=pal["brand_blue"], bevel=0.006, parent=fan_piv)
        for b in range(6):
            ang = b * (math.pi / 3.0)
            bx = math.cos(ang) * 0.24
            by = math.sin(ang) * 0.24
            add_box(f"FFU_Blade_{idx}_{b}", (0.28, 0.10, 0.025), (bx, by, 0),
                    rot=(math.radians(18), 0, ang), mat=pal["steel"], bevel=0.003, parent=fan_piv)

    # Teardrop LED cleanroom lighting strips along T-bars
    add_box("FFU_Light_X", (3.60, 0.08, 0.04), (0, 0, 0.08), mat=pal["emit_cyan"], bevel=0.004, parent=root)
    add_box("FFU_Light_Y", (0.08, 3.60, 0.04), (0, 0, 0.08), mat=pal["emit_cyan"], bevel=0.004, parent=root)
    return root


def build_pillar_safety(pal, x_off=14.0):
    root = make_empty("Pillar_Safety_Station", loc=(x_off, 0, 0))
    # Structural column (0.75m x 0.75m x 3.2m)
    add_box("PS_Base", (0.86, 0.86, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("PS_Column", (0.76, 0.76, 2.90), (0, 0, 1.65), mat=pal["white"], bevel=0.020, parent=root)
    add_box("PS_TopCap", (0.88, 0.88, 0.16), (0, 0, 3.16), mat=pal["brand_blue"], bevel=0.016, parent=root)

    # Bay Identification Signage Plate on upper front
    add_box("PS_SignPlate", (0.62, 0.06, 0.28), (0, 0.39, 2.65), mat=pal["brand_blue_dark"], bevel=0.008, parent=root)
    add_box("PS_SignGlow", (0.52, 0.02, 0.14), (0, 0.42, 2.65), mat=pal["emit_cyan"], bevel=0.003, parent=root)

    # Hinged Fire / Safety Cabinet on front face
    add_box("PS_CabBody", (0.48, 0.14, 0.75), (0, 0.42, 1.35), mat=pal["safety_yellow"], bevel=0.010, parent=root)
    cab_door = make_empty("Cabinet_Door", loc=(-0.22, 0.49, 1.35), parent=root)
    add_box("PS_CabDoorMesh", (0.44, 0.03, 0.68), (0.22, 0, 0), mat=pal["emit_red"], bevel=0.006, parent=cab_door)
    add_box("PS_CabWindow", (0.26, 0.04, 0.42), (0.22, 0.005, 0.05), mat=pal["glass_dark"], bevel=0.004, parent=cab_door)

    # Side Safety Eyewash Bowl & Shower Pull Rod
    add_cylinder("PS_EyewashBowl", radius=0.16, depth=0.10, vertices=16,
                 loc=(0.52, 0, 1.05), mat=pal["safety_yellow"], bevel=0.008, parent=root)
    add_cylinder("PS_ShowerPipe", radius=0.025, depth=1.10, vertices=12,
                 loc=(0.52, 0, 1.60), mat=pal["steel"], bevel=0.003, parent=root)
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_floor_cleanroom(pal, x_off=-10.0)
    build_floor_litho(pal, x_off=-5.0)
    build_wall_partition(pal, x_off=0.0)
    build_wall_airlock(pal, x_off=5.0)
    build_ceiling_ffu(pal, x_off=10.0)
    build_pillar_safety(pal, x_off=14.2)
    finalize_and_export_glb("cleanroom_structure.glb")


if __name__ == "__main__":
    main()
