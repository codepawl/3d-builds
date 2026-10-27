import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder, add_cone,
    add_hollow_frame, add_vent_grille, add_bolt_row, build_signal_tower,
    build_operator_console, build_efem_load_port, finalize_and_export_glb
)


def build_euv_twinscan(pal, x_off=-5.5):
    root = make_empty("Litho_EUV_Twinscan", loc=(x_off, 0, 0))

    # 1. Heavy Vibration-Isolated Base Frame (3.4m x 3.2m)
    add_box("EUV_BasePlinth", (3.40, 3.10, 0.24), (0, -0.20, 0.12), mat=pal["dark_slate"], bevel=0.015, parent=root)

    # 2. Main Scanner Enclosure (Right/Center bulk: X from -0.6 to +1.65)
    add_box("EUV_MainCab_Back", (2.20, 1.80, 2.50), (0.50, -0.65, 1.49), mat=pal["white"], bevel=0.025, parent=root)
    add_box("EUV_MainCab_Left", (0.55, 2.30, 2.50), (-0.32, -0.40, 1.49), mat=pal["white"], bevel=0.020, parent=root)
    add_box("EUV_MainCab_Right", (0.45, 2.30, 2.50), (1.38, -0.40, 1.49), mat=pal["white"], bevel=0.020, parent=root)
    add_box("EUV_TopCrown", (2.34, 2.44, 0.28), (0.50, -0.38, 2.86), mat=pal["brand_blue"], bevel=0.022, parent=root)

    # Recessed Exposure Chamber Bay on Front-Center so Optics Column & Wafer Stage are clearly visible!
    add_box("EUV_ChamberFloor", (1.30, 1.00, 0.72), (0.52, 0.30, 0.60), mat=pal["dark_slate"], bevel=0.012, parent=root)
    # Zeiss-style multi-mirror EUV Projection Optics Barrel suspended from top
    add_cylinder("EUV_OpticsUpper", radius=0.44, depth=0.65, vertices=24,
                 loc=(0.52, 0.28, 2.35), mat=pal["steel"], bevel=0.012, parent=root)
    add_cone("EUV_OpticsCone", radius1=0.28, radius2=0.42, depth=0.42, vertices=24,
             loc=(0.52, 0.28, 1.85), mat=pal["gold"], bevel=0.010, parent=root)
    add_cylinder("EUV_LensRing", radius=0.31, depth=0.06, vertices=24,
                 loc=(0.52, 0.28, 1.62), mat=pal["emit_amber"], bevel=0.005, parent=root)

    # Articulated Twinscan Dual-Chuck Wafer Stage (origin at stage center for X/Y/theta motion)
    stage_piv = make_empty("Wafer_Stage", loc=(0.52, 0.28, 1.02), parent=root)
    add_box("EUV_StageBridge", (1.05, 0.56, 0.12), (0, 0, 0), mat=pal["steel"], bevel=0.008, parent=stage_piv)
    for side, cx in (("Expose", -0.25), ("Measure", 0.25)):
        add_box(f"EUV_Chuck_{side}", (0.38, 0.38, 0.08), (cx, 0, 0.09),
                mat=pal["copper"], bevel=0.006, parent=stage_piv)
        add_cylinder(f"EUV_Wafer_{side}", radius=0.15, depth=0.012, vertices=24,
                     loc=(cx, 0, 0.14), mat=pal["wafer"], bevel=0.002, parent=stage_piv)

    # Yellow-room safety glass frame around exposure bay
    add_hollow_frame("EUV_ViewFrame", (1.36, 0.08, 1.65), thickness=0.09,
                     loc=(0.52, 0.76, 1.80), mat=pal["brand_blue"], parent=root)
    add_box("EUV_AmberVisor", (1.20, 0.04, 0.38), (0.52, 0.77, 2.40),
            mat=pal["glass_amber"], bevel=0.005, parent=root)

    # 3. Rear LPP EUV Source Collector Drum & Cryo/RF Subsystems
    add_cylinder("EUV_SourceDrum", radius=0.72, depth=1.35, vertices=24,
                 loc=(0.52, -1.85, 1.35), rot=(math.radians(90), 0, 0),
                 mat=pal["steel"], bevel=0.018, parent=root)
    add_cylinder("EUV_SourceCap", radius=0.52, depth=0.18, vertices=20,
                 loc=(0.52, -2.55, 1.35), rot=(math.radians(90), 0, 0),
                 mat=pal["copper"], bevel=0.012, parent=root)
    add_bolt_row("EUV_DrumBolts", (-0.15, -1.20, 2.08), (1.15, -1.20, 2.08), count=6, parent=root)

    # 4. Left-side Coupled Coater/Developer Track Module
    add_box("EUV_TrackBody", (1.05, 2.30, 2.28), (-1.15, -0.40, 1.38), mat=pal["cool_grey"], bevel=0.020, parent=root)
    add_box("EUV_TrackTop", (1.10, 2.34, 0.18), (-1.15, -0.40, 2.60), mat=pal["brand_blue_dark"], bevel=0.015, parent=root)
    # Yellow litho windows on side of track
    for wy in (-1.0, -0.3, 0.4):
        add_box(f"EUV_TrackWin_{wy:.1f}", (0.05, 0.48, 0.85), (-1.68, wy, 1.65),
                mat=pal["glass_amber"], bevel=0.006, parent=root)
    add_vent_grille("EUV_RightVent", width=1.10, height=0.55, slats=6,
                    loc=(1.61, -0.40, 0.82), rot=(0, 0, math.radians(90)), parent=root)

    # Articulated Wafer Transfer Bridge linking Track and Scanner
    bridge_piv = make_empty("Track_Bridge", loc=(-0.60, 0.28, 1.15), parent=root)
    add_box("EUV_BridgeArm", (0.48, 0.26, 0.18), (0, 0, 0), mat=pal["brand_blue"], bevel=0.008, parent=bridge_piv)
    add_cylinder("EUV_BridgeWafer", radius=0.145, depth=0.012, vertices=20,
                 loc=(0.12, 0, 0.10), mat=pal["wafer"], bevel=0.002, parent=bridge_piv)

    # Top Cleanroom Exhaust Stacks & Laser Conduit
    for sx in (-1.15, 0.10, 0.95):
        add_cylinder(f"EUV_Exhaust_{sx:.1f}", radius=0.16, depth=0.42, vertices=16,
                     loc=(sx, -0.85, 3.12), mat=pal["steel"], bevel=0.008, parent=root)

    # 5. Front EFEM Interface Wall + 4 Load Ports (LP_1..LP_4)
    add_box("EUV_EFEM_Plenum", (3.20, 0.56, 2.25), (0.0, 1.02, 1.36), mat=pal["white"], bevel=0.020, parent=root)
    add_box("EUV_EFEM_Header", (3.24, 0.62, 0.24), (0.0, 1.04, 2.60), mat=pal["brand_blue"], bevel=0.015, parent=root)
    for idx, lx in enumerate((-1.15, -0.38, 0.38, 1.15), start=1):
        has_foup = idx in (1, 3)
        is_hot = (idx == 1)
        build_efem_load_port(f"EUV_LP_{idx}", loc=(lx, 1.54, 0.0), rot_z=0.0,
                             parent=root, with_foup=has_foup, hot_lot=is_hot)

    # 6. Operator Console & Dual Signal Towers
    build_operator_console("EUV_Console", loc=(1.62, 0.95, 1.32), rot_z=math.radians(-25), parent=root)
    build_signal_tower("EUV_SignalTower_1", loc=(-1.48, 1.18, 2.72), parent=root, state="RUN")
    build_signal_tower("EUV_SignalTower_2", loc=(1.48, 1.18, 2.72), parent=root, state="LITHO")
    return root


def build_duv_immersion(pal, x_off=0.0):
    root = make_empty("Litho_DUV_Immersion", loc=(x_off, 0, 0))

    # Base & Main Stepped Body (2.5m x 2.4m x 2.55m)
    add_box("DUV_Base", (2.46, 2.30, 0.22), (0, -0.15, 0.11), mat=pal["dark_slate"], bevel=0.015, parent=root)
    add_box("DUV_RearCab", (2.40, 1.45, 2.28), (0, -0.55, 1.36), mat=pal["cool_grey"], bevel=0.022, parent=root)
    add_box("DUV_SidePillar_L", (0.52, 0.95, 2.28), (-0.94, 0.55, 1.36), mat=pal["white"], bevel=0.018, parent=root)
    add_box("DUV_SidePillar_R", (0.52, 0.95, 2.28), (0.94, 0.55, 1.36), mat=pal["white"], bevel=0.018, parent=root)
    add_box("DUV_CrownArch", (2.46, 2.34, 0.24), (0, -0.05, 2.60), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # Immersion Lens Column & Articulated Wafer Stage in central viewing recess
    add_box("DUV_StageDeck", (1.32, 0.92, 0.68), (0, 0.45, 0.56), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_cylinder("DUV_ImmersionLens", radius=0.34, depth=0.72, vertices=24,
                 loc=(0, 0.45, 1.98), mat=pal["steel"], bevel=0.012, parent=root)
    add_cylinder("DUV_WaterRing", radius=0.37, depth=0.08, vertices=24,
                 loc=(0, 0.45, 1.60), mat=pal["emit_cyan"], bevel=0.005, parent=root)

    stage_piv = make_empty("DUV_Wafer_Stage", loc=(0, 0.45, 0.98), parent=root)
    add_box("DUV_ChuckBase", (0.56, 0.52, 0.10), (0, 0, 0), mat=pal["steel"], bevel=0.008, parent=stage_piv)
    add_cylinder("DUV_Wafer", radius=0.15, depth=0.012, vertices=24,
                 loc=(0, 0, 0.065), mat=pal["wafer"], bevel=0.002, parent=stage_piv)

    # Articulated Reticle Loader Arm on upper front-left
    ret_piv = make_empty("Reticle_Arm", loc=(-0.55, 0.65, 2.15), parent=root)
    add_cylinder("DUV_RetHub", radius=0.08, depth=0.12, vertices=16, loc=(0, 0, 0), mat=pal["brand_blue"], parent=ret_piv)
    add_box("DUV_RetBoom", (0.48, 0.12, 0.05), (0.22, 0, -0.02), mat=pal["chrome"], bevel=0.005, parent=ret_piv)
    add_box("DUV_ReticleMask", (0.18, 0.18, 0.02), (0.44, 0, -0.05), mat=pal["gold"], bevel=0.003, parent=ret_piv)

    # Yellow-room side inspection windows & vents
    for sx in (-1.21, 1.21):
        add_box(f"DUV_AmberWin_{sx:.1f}", (0.05, 0.76, 0.92), (sx, -0.45, 1.65),
                mat=pal["glass_amber"], bevel=0.006, parent=root)
        add_vent_grille(f"DUV_Vent_{sx:.1f}", width=0.82, height=0.45, slats=5,
                        loc=(sx, -0.45, 0.72), rot=(0, 0, math.radians(90 if sx > 0 else -90)), parent=root)

    # 3 Front EFEM Load Ports
    for idx, lx in enumerate((-0.78, 0.0, 0.78), start=1):
        build_efem_load_port(f"DUV_LP_{idx}", loc=(lx, 1.26, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 2), hot_lot=False)

    build_operator_console("DUV_Console", loc=(1.22, 0.90, 1.28), rot_z=math.radians(-20), parent=root)
    build_signal_tower("DUV_SignalTower", loc=(-1.05, 0.92, 2.72), parent=root, state="LITHO")
    return root


def build_track_coater(pal, x_off=5.0):
    root = make_empty("Litho_Track_Coater", loc=(x_off, 0, 0))

    # Long Coater/Developer Track chassis (2.6m wide x 1.9m deep x 2.3m high)
    add_box("TRK_Base", (2.60, 1.84, 0.20), (0, -0.10, 0.10), mat=pal["dark_slate"], bevel=0.015, parent=root)
    add_box("TRK_LowerCab", (2.56, 1.76, 0.92), (0, -0.10, 0.66), mat=pal["white"], bevel=0.018, parent=root)
    add_box("TRK_BackWall", (2.56, 0.48, 1.15), (0, -0.74, 1.68), mat=pal["cool_grey"], bevel=0.018, parent=root)
    add_box("TRK_TopPlenum", (2.62, 1.84, 0.24), (0, -0.10, 2.36), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # Open/Framed Spin-Coater & Hotplate Process Gallery (visible from isometric angle!)
    for i, sx in enumerate((-0.90, -0.30, 0.30, 0.90), start=1):
        # Chrome spin-coater cup bowl + wafer inside
        add_cylinder(f"TRK_SpinCup_{i}", radius=0.22, depth=0.16, vertices=20,
                     loc=(sx, -0.25, 1.22), mat=pal["chrome"], bevel=0.008, parent=root)
        add_cylinder(f"TRK_SpinWafer_{i}", radius=0.145, depth=0.012, vertices=20,
                     loc=(sx, -0.25, 1.31), mat=pal["wafer"], bevel=0.002, parent=root)
        # Bake hotplate module above back row with warm amber glow
        add_cylinder(f"TRK_BakePlate_{i}", radius=0.20, depth=0.08, vertices=20,
                     loc=(sx, -0.52, 1.78), mat=pal["emit_amber"], bevel=0.006, parent=root)

    # Articulated Linear Wafer Shuttle Robot moving along X axis
    shuttle_piv = make_empty("Track_Shuttle", loc=(0.0, 0.22, 1.26), parent=root)
    add_box("TRK_ShuttleCar", (0.34, 0.22, 0.12), (0, 0, 0), mat=pal["brand_blue"], bevel=0.008, parent=shuttle_piv)
    add_box("TRK_ShuttleBlade", (0.22, 0.38, 0.025), (0, -0.18, 0.08), mat=pal["steel"], bevel=0.003, parent=shuttle_piv)

    # Hinged lower photoresist chemical bottle cabinet doors
    for side, hx, offset_x in (("L", -1.18, 0.26), ("R", 1.18, -0.26)):
        c_door = make_empty(f"Chem_Door_{side}", loc=(hx, 0.79, 0.65), parent=root)
        add_box(f"TRK_ChemDoor_{side}", (0.52, 0.04, 0.72), (offset_x, 0, 0),
                mat=pal["cool_grey"], bevel=0.008, parent=c_door)
        add_box(f"TRK_ChemWin_{side}", (0.28, 0.05, 0.42), (offset_x, 0.005, 0.05),
                mat=pal["glass_amber"], bevel=0.004, parent=c_door)

    # 3 EFEM Load Ports on front
    for idx, lx in enumerate((-0.76, 0.0, 0.76), start=1):
        build_efem_load_port(f"TRK_LP_{idx}", loc=(lx, 1.05, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=True)

    build_signal_tower("TRK_SignalTower", loc=(1.12, 0.65, 2.48), parent=root, state="RUN")
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_euv_twinscan(pal, x_off=-5.5)
    build_duv_immersion(pal, x_off=0.0)
    build_track_coater(pal, x_off=5.0)
    finalize_and_export_glb("litho_scanners.glb")


if __name__ == "__main__":
    main()
