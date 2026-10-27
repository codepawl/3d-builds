import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, build_foup_pod_mesh, build_efem_load_port,
    build_operator_console, build_signal_tower, finalize_and_export_glb
)


def build_interbay_stocker(pal, x_off=-4.8):
    root = make_empty("Stocker_Interbay_Tower", loc=(x_off, 0, 0))

    # 1. Outer Cleanroom Stocker Frame (3.4m wide x 1.7m deep x 3.1m high)
    add_box("STK_Base", (3.44, 1.74, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.015, parent=root)
    add_box("STK_BackWall", (3.40, 0.16, 2.76), (0, -0.78, 1.60), mat=pal["cool_grey"], bevel=0.018, parent=root)
    add_box("STK_SideWall_L", (0.20, 1.70, 2.76), (-1.60, 0, 1.60), mat=pal["white"], bevel=0.016, parent=root)
    add_box("STK_SideWall_R", (0.20, 1.70, 2.76), (1.60, 0, 1.60), mat=pal["white"], bevel=0.016, parent=root)
    add_box("STK_TopCrown", (3.46, 1.76, 0.24), (0, 0, 3.08), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # Top OHT Ceiling Interface Transfer Port (where OHT vehicles drop FOUPs into the stocker)
    add_hollow_frame("STK_OHT_Port", (0.72, 0.72, 0.16), thickness=0.08,
                     loc=(-0.95, 0.15, 3.22), rot=(math.radians(90), 0, 0), mat=pal["safety_yellow"], parent=root)

    # 2. Internal Honeycomb FOUP Storage Shelves (4 columns x 3 tiers along back wall)
    col_xs = (-1.12, -0.38, 0.38, 1.12)
    tier_zs = (0.48, 1.24, 2.00)
    occupied = {(0, 0): False, (1, 0): True, (2, 1): False, (3, 1): False, (0, 2): True, (2, 2): False}
    for c_i, cx in enumerate(col_xs):
        # Vertical rack dividers
        add_box(f"STK_RackPost_{c_i}", (0.05, 0.52, 2.65), (cx - 0.34, -0.42, 1.55),
                mat=pal["steel"], bevel=0.004, parent=root)
        for t_i, tz in enumerate(tier_zs):
            add_box(f"STK_Shelf_{c_i}_{t_i}", (0.58, 0.48, 0.04), (cx, -0.42, tz),
                    mat=pal["dark_slate"], bevel=0.005, parent=root)
            is_occ = (c_i, t_i) in occupied
            led_m = pal["emit_orange"] if occupied.get((c_i, t_i)) else (pal["emit_green"] if is_occ else pal["emit_cyan"])
            add_box(f"STK_SlotLED_{c_i}_{t_i}", (0.42, 0.03, 0.025), (cx, -0.18, tz),
                    mat=led_m, bevel=0.003, parent=root)
            if is_occ:
                build_foup_pod_mesh(f"STK_StoredFOUP_{c_i}_{t_i}", loc=(cx, -0.42, tz + 0.02),
                                    rot_z=0.0, parent=root, hot_lot=occupied[(c_i, t_i)], include_door_pivot=False)

    # 3. Articulated 2-Axis Stocker Crane (Stocker_Mast along X -> Stocker_Fork along Z)
    add_box("STK_CraneRail_Bot", (3.00, 0.14, 0.08), (0, 0.18, 0.26), mat=pal["steel"], bevel=0.005, parent=root)
    add_box("STK_CraneRail_Top", (3.00, 0.14, 0.08), (0, 0.18, 2.90), mat=pal["steel"], bevel=0.005, parent=root)

    mast_piv = make_empty("Stocker_Mast", loc=(0.15, 0.18, 0.30), parent=root)
    add_box("STK_MastBase", (0.38, 0.32, 0.14), (0, 0, 0.07), mat=pal["brand_blue"], bevel=0.008, parent=mast_piv)
    add_box("STK_MastColumn", (0.14, 0.14, 2.52), (0, 0, 1.32), mat=pal["chrome"], bevel=0.006, parent=mast_piv)

    fork_piv = make_empty("Stocker_Fork", loc=(0, 0, 1.15), parent=mast_piv)
    add_box("STK_ForkCarriage", (0.34, 0.28, 0.18), (0, 0, 0), mat=pal["brand_blue_dark"], bevel=0.008, parent=fork_piv)
    add_box("STK_ForkPlate", (0.44, 0.44, 0.04), (0, 0.22, -0.05), mat=pal["steel"], bevel=0.005, parent=fork_piv)
    build_foup_pod_mesh("STK_CraneFOUP", loc=(0, 0.22, -0.03), rot_z=0.0,
                        parent=fork_piv, hot_lot=True, include_door_pivot=False)

    # Front Open Inspection Frame + Manual Load Port on Front-Right
    add_hollow_frame("STK_FrontFrame", (3.16, 0.08, 2.68), thickness=0.10,
                     loc=(0, 0.82, 1.60), mat=pal["brand_blue"], parent=root)
    build_efem_load_port("STK_Manual_LP", loc=(1.12, 1.12, 0.0), rot_z=0.0,
                         parent=root, with_foup=False, hot_lot=False)
    build_operator_console("STK_Console", loc=(-1.62, 0.88, 1.28), rot_z=math.radians(20), parent=root)
    build_signal_tower("STK_SignalTower", loc=(1.48, 0.68, 3.20), parent=root, state="RUN")
    return root


def build_undertrack_buffer(pal, x_off=0.0):
    root = make_empty("Stocker_Undertrack_Buffer", loc=(x_off, 0, 0))

    # Overhead Side-Track FOUP Buffer Shelf (4 FOUP slots, supported on cleanroom display stanchions)
    add_box("UTB_ShelfBeam", (2.60, 0.62, 0.10), (0, 0, 0.12), mat=pal["white"], bevel=0.012, parent=root)
    add_box("UTB_BackGuard", (2.60, 0.08, 0.42), (0, -0.27, 0.36), mat=pal["brand_blue"], bevel=0.010, parent=root)
    # Top ceiling hanger brackets
    for hx in (-1.05, 0.0, 1.05):
        add_box(f"UTB_HangerArm_{hx:.2f}", (0.10, 0.56, 0.68), (hx, -0.02, 0.48),
                mat=pal["steel"], bevel=0.006, parent=root)
    add_box("UTB_TopRail", (2.64, 0.18, 0.10), (0, -0.22, 0.84), mat=pal["dark_slate"], bevel=0.008, parent=root)

    # 4 Kinematic FOUP Buffer Pedestals + 2 Buffered FOUPs
    for idx, sx in enumerate((-0.90, -0.30, 0.30, 0.90), start=1):
        add_box(f"UTB_Pad_{idx}", (0.46, 0.44, 0.04), (sx, 0.02, 0.18),
                mat=pal["dark_slate"], bevel=0.005, parent=root)
        has_pod = idx in (1, 3)
        is_hot = (idx == 3)
        add_box(f"UTB_LED_{idx}", (0.34, 0.03, 0.025), (sx, 0.29, 0.12),
                mat=(pal["emit_orange"] if is_hot else (pal["emit_green"] if has_pod else pal["emit_cyan"])),
                bevel=0.003, parent=root)
        if has_pod:
            build_foup_pod_mesh(f"UTB_FOUP_{idx}", loc=(sx, 0.02, 0.20), rot_z=0.0,
                                parent=root, hot_lot=is_hot, include_door_pivot=False)
    return root


def build_n2_purge_stocker(pal, x_off=4.2):
    root = make_empty("Stocker_Nitrogen_Purge", loc=(x_off, 0, 0))

    # Continuous N2-Purge FOUP Cabinet (2.1m wide x 1.4m deep x 2.55m high)
    add_box("N2S_Base", (2.14, 1.44, 0.20), (0, 0, 0.10), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_box("N2S_BackCab", (2.10, 0.96, 2.20), (0, -0.22, 1.30), mat=pal["white"], bevel=0.018, parent=root)
    add_box("N2S_LeftN2Bay", (0.48, 1.38, 2.20), (-0.81, 0, 1.30), mat=pal["cool_grey"], bevel=0.016, parent=root)
    add_box("N2S_TopCap", (2.16, 1.44, 0.22), (0, 0, 2.50), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # N2 Purge Flowmeter Bank on Left Bay (glowing cyan flow tubes & stainless manifold pipes)
    add_box("N2S_GaugeRecess", (0.32, 0.05, 0.95), (-0.81, 0.68, 1.45), mat=pal["dark_slate"], bevel=0.006, parent=root)
    for gx in (-0.90, -0.81, -0.72):
        add_cylinder(f"N2S_FlowTube_{gx:.2f}", radius=0.022, depth=0.72, vertices=12,
                     loc=(gx, 0.70, 1.45), mat=pal["emit_cyan"], bevel=0.003, parent=root)
    add_cylinder("N2S_RoofSupplyPipe", radius=0.06, depth=0.45, vertices=16,
                 loc=(-0.81, -0.25, 2.82), mat=pal["steel"], bevel=0.005, parent=root)

    # 2 Internal N2 Purge Shelves holding 2 FOUPs each
    for t_i, tz in enumerate((0.52, 1.32), start=1):
        add_box(f"N2S_Shelf_{t_i}", (1.42, 0.56, 0.05), (0.24, 0.25, tz),
                mat=pal["steel"], bevel=0.006, parent=root)
        for p_i, px in enumerate((-0.08, 0.56), start=1):
            add_cylinder(f"N2S_Nozzle_{t_i}_{p_i}", radius=0.08, depth=0.04, vertices=16,
                         loc=(px, 0.25, tz + 0.04), mat=pal["emit_cyan"], bevel=0.003, parent=root)
            if (t_i + p_i) % 2 == 0:
                build_foup_pod_mesh(f"N2S_FOUP_{t_i}_{p_i}", loc=(px, 0.25, tz + 0.05),
                                    rot_z=0.0, parent=root, hot_lot=(t_i == 2), include_door_pivot=False)

    # Articulated Hinged Service Door Frame (pivot at right edge so it swings open cleanly)
    door_piv = make_empty("Service_Door", loc=(0.98, 0.66, 1.30), parent=root)
    add_hollow_frame("N2S_DoorFrame", (1.48, 0.06, 2.08), thickness=0.07,
                     loc=(-0.74, 0, 0), mat=pal["brand_blue_dark"], parent=door_piv)
    add_box("N2S_DoorHandle", (0.04, 0.08, 0.24), (-1.38, 0.04, 0), mat=pal["chrome"], bevel=0.004, parent=door_piv)

    build_signal_tower("N2S_SignalTower", loc=(0.82, 0.42, 2.61), parent=root, state="RUN")
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_interbay_stocker(pal, x_off=-4.8)
    build_undertrack_buffer(pal, x_off=0.0)
    build_n2_purge_stocker(pal, x_off=4.2)
    finalize_and_export_glb("stocker_units.glb")


if __name__ == "__main__":
    main()
