import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, add_vent_grille, build_signal_tower,
    build_operator_console, build_efem_load_port, finalize_and_export_glb
)


def build_cmp_polisher(pal, x_off=-6.5):
    root = make_empty("CMP_Polisher_TriPlaten", loc=(x_off, 0, 0))

    # 1. Lower Slurry & Mechanical Drive Cabinet (2.5m x 2.6m)
    add_box("CMP_Base", (2.52, 2.60, 0.20), (0, -0.20, 0.10), mat=pal["dark_slate"], bevel=0.015, parent=root)
    add_box("CMP_LowerDeck", (2.46, 1.95, 0.88), (0, -0.45, 0.64), mat=pal["white"], bevel=0.020, parent=root)
    add_box("CMP_RearWall", (2.46, 0.34, 1.15), (0, -1.25, 1.65), mat=pal["cool_grey"], bevel=0.016, parent=root)
    add_box("CMP_TopCanopy", (2.52, 1.98, 0.20), (0, -0.45, 2.30), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # Dark chemical-resistant wet polishing basin on top of lower deck
    add_box("CMP_WetBasin", (2.28, 1.68, 0.08), (0, -0.42, 1.10), mat=pal["dark_slate"], bevel=0.010, parent=root)

    # 2. 3 Articulated Rotating Polishing Platens (Platen_1, Platen_2, Platen_3)
    platen_coords = [(-0.58, -0.68, 1), (0.58, -0.68, 2), (-0.58, -0.05, 3)]
    for px, py, idx in platen_coords:
        plat_piv = make_empty(f"Platen_{idx}", loc=(px, py, 1.16), parent=root)
        add_cylinder(f"CMP_PlatenBase_{idx}", radius=0.38, depth=0.07, vertices=24,
                     loc=(0, 0, 0), mat=pal["steel"], bevel=0.006, parent=plat_piv)
        add_cylinder(f"CMP_Pad_{idx}", radius=0.35, depth=0.025, vertices=24,
                     loc=(0, 0, 0.045), mat=pal["litho_floor"], bevel=0.004, parent=plat_piv)
        add_cylinder(f"CMP_CenterNut_{idx}", radius=0.06, depth=0.035, vertices=12,
                     loc=(0, 0, 0.055), mat=pal["brand_blue"], bevel=0.003, parent=plat_piv)

    # Articulated Diamond Pad Conditioner Sweep Arm
    cond_piv = make_empty("Conditioner_Arm", loc=(0.0, -0.98, 1.24), parent=root)
    add_cylinder("CMP_CondPost", radius=0.06, depth=0.18, vertices=16, loc=(0, 0, 0), mat=pal["chrome"], parent=cond_piv)
    add_box("CMP_CondBoom", (0.48, 0.07, 0.04), (-0.22, 0.14, 0.06),
            rot=(0, 0, math.radians(-28)), mat=pal["steel"], bevel=0.004, parent=cond_piv)
    add_cylinder("CMP_CondDisk", radius=0.08, depth=0.03, vertices=16,
                 loc=(-0.42, 0.25, 0.04), mat=pal["copper"], bevel=0.003, parent=cond_piv)

    # 3. Overhead Articulated Multi-Head Wafer Carrier Carousel (Carrier_Carousel)
    car_piv = make_empty("Carrier_Carousel", loc=(0.0, -0.38, 1.98), parent=root)
    add_cylinder("CMP_CarouselHub", radius=0.26, depth=0.22, vertices=20,
                 loc=(0, 0, 0.10), mat=pal["brand_blue_dark"], bevel=0.010, parent=car_piv)
    add_box("CMP_CarouselCross", (1.36, 0.24, 0.12), (0, 0, 0),
            rot=(0, 0, math.radians(35)), mat=pal["white"], bevel=0.010, parent=car_piv)
    for h_i, (hx, hy) in enumerate(((-0.48, -0.28), (0.48, -0.28), (-0.48, 0.28)), start=1):
        add_cylinder(f"CMP_CarrierShaft_{h_i}", radius=0.07, depth=0.48, vertices=16,
                     loc=(hx, hy, -0.26), mat=pal["chrome"], bevel=0.004, parent=car_piv)
        add_cylinder(f"CMP_CarrierHead_{h_i}", radius=0.19, depth=0.10, vertices=20,
                     loc=(hx, hy, -0.52), mat=pal["copper"], bevel=0.006, parent=car_piv)

    # Post-CMP Megasonic Brush Cleaner Module on Front-Right of wet deck
    add_box("CMP_PostCleaner", (0.68, 0.56, 0.42), (0.62, -0.02, 1.32), mat=pal["cool_grey"], bevel=0.010, parent=root)
    add_box("CMP_CleanerGlow", (0.52, 0.40, 0.04), (0.62, -0.02, 1.54), mat=pal["emit_cyan"], bevel=0.004, parent=root)

    # 4. Front 3-Port EFEM
    add_box("CMP_EFEM", (2.42, 0.52, 2.08), (0, 0.78, 1.04), mat=pal["white"], bevel=0.018, parent=root)
    for idx, lx in enumerate((-0.76, 0.0, 0.76), start=1):
        build_efem_load_port(f"CMP_LP_{idx}", loc=(lx, 1.28, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=False)

    build_operator_console("CMP_Console", loc=(1.26, 0.85, 1.25), rot_z=math.radians(-22), parent=root)
    build_signal_tower("CMP_SignalTower", loc=(-1.08, -0.45, 2.40), parent=root, state="RUN")
    return root


def build_wet_bench(pal, x_off=-1.8):
    root = make_empty("Wet_Bench_Auto", loc=(x_off, 0, 0))

    # Wide Automated Wet Chemical Etch & Clean Bench (2.7m wide x 1.8m deep x 2.3m high)
    add_box("WET_Base", (2.72, 1.82, 0.20), (0, -0.05, 0.10), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_box("WET_LowerCab", (2.68, 1.74, 0.88), (0, -0.05, 0.64), mat=pal["white"], bevel=0.018, parent=root)
    add_box("WET_BackPlenum", (2.68, 0.42, 1.22), (0, -0.71, 1.68), mat=pal["cool_grey"], bevel=0.016, parent=root)
    add_box("WET_SideWall_L", (0.20, 1.74, 1.22), (-1.24, -0.05, 1.68), mat=pal["white"], bevel=0.014, parent=root)
    add_box("WET_SideWall_R", (0.20, 1.74, 1.22), (1.24, -0.05, 1.68), mat=pal["white"], bevel=0.014, parent=root)
    add_box("WET_TopCanopy", (2.74, 1.80, 0.22), (0, -0.05, 2.38), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # 5 Recessed Quartz Chemical & Ultra-Pure Water (UPW) Baths with submerged wafers!
    bath_mats = [pal["emit_cyan"], pal["emit_amber"], pal["emit_cyan"], pal["ice_blue"], pal["emit_cyan"]]
    for idx, bx in enumerate((-0.88, -0.44, 0.0, 0.44, 0.88)):
        add_box(f"WET_QuartzTank_{idx}", (0.36, 0.68, 0.18), (bx, -0.12, 1.15),
                mat=pal["cool_grey"], bevel=0.006, parent=root)
        add_box(f"WET_ChemBath_{idx}", (0.30, 0.60, 0.06), (bx, -0.12, 1.22),
                mat=bath_mats[idx], bevel=0.003, parent=root)
        # Wafer batch submerged in bath #1 and #4
        if idx in (1, 3):
            for w in range(-2, 3):
                add_cylinder(f"WET_BathWafer_{idx}_{w}", radius=0.13, depth=0.010, vertices=18,
                             loc=(bx, -0.12 + w * 0.08, 1.26), rot=(math.radians(90), 0, 0),
                             mat=pal["wafer"], bevel=0.002, parent=root)

    # Articulated 2-Axis Overhead Wafer Batch Transfer Gantry (Gantry_Bridge -> Gantry_Hoist)
    bridge_piv = make_empty("Gantry_Bridge", loc=(-0.22, -0.18, 2.02), parent=root)
    add_box("WET_GantryBeam", (0.24, 0.88, 0.12), (0, 0, 0), mat=pal["brand_blue"], bevel=0.008, parent=bridge_piv)
    hoist_piv = make_empty("Gantry_Hoist", loc=(0, 0.05, -0.28), parent=bridge_piv)
    add_box("WET_HoistMast", (0.12, 0.12, 0.48), (0, 0, 0.12), mat=pal["chrome"], bevel=0.005, parent=hoist_piv)
    add_box("WET_GripperFork", (0.32, 0.36, 0.08), (0, 0, -0.14), mat=pal["steel"], bevel=0.005, parent=hoist_piv)
    for w in range(-2, 3):
        add_cylinder(f"WET_HoistWafer_{w}", radius=0.14, depth=0.012, vertices=20,
                     loc=(0, w * 0.05, -0.22), rot=(math.radians(90), 0, 0),
                     mat=pal["wafer"], bevel=0.002, parent=hoist_piv)

    # Articulated Sliding Chemical Sash Frame on Front (Hood_Door)
    hood_piv = make_empty("Hood_Door", loc=(0, 0.78, 1.88), parent=root)
    add_hollow_frame("WET_SashFrame", (2.26, 0.05, 0.56), thickness=0.06,
                     loc=(0, 0, 0), mat=pal["brand_blue_dark"], parent=hood_piv)

    # Top Acid/Alkali Scrubber Exhaust Ducts
    for ex in (-0.75, 0.75):
        add_cylinder(f"WET_Exhaust_{ex:.2f}", radius=0.15, depth=0.38, vertices=16,
                     loc=(ex, -0.55, 2.66), mat=pal["steel"], bevel=0.008, parent=root)

    # 2 Front EFEM Load Ports on left & right ends
    for idx, lx in enumerate((-0.72, 0.72), start=1):
        build_efem_load_port(f"WET_LP_{idx}", loc=(lx, 1.05, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=False)

    build_signal_tower("WET_SignalTower", loc=(1.15, 0.55, 2.49), parent=root, state="RUN")
    return root


def build_metrology_eb(pal, x_off=2.8):
    root = make_empty("Metrology_EB_Inspector", loc=(x_off, 0, 0))

    # E-Beam Defect Inspection & CD-SEM Tool (1.9m x 2.0m x 2.35m)
    add_box("EB_IsoGraniteBase", (1.92, 2.00, 0.34), (0, -0.10, 0.17), mat=pal["dark_slate"], bevel=0.016, parent=root)
    add_box("EB_MainChamber", (1.84, 1.28, 1.25), (0, -0.42, 0.96), mat=pal["white"], bevel=0.020, parent=root)
    add_box("EB_TopCollar", (1.88, 1.32, 0.18), (0, -0.42, 1.66), mat=pal["brand_blue"], bevel=0.015, parent=root)

    # High-Precision Cylindrical Magnetic Electron-Beam Column on top
    add_cylinder("EB_VacuumBell", radius=0.42, depth=0.28, vertices=24,
                 loc=(0, -0.42, 1.88), mat=pal["steel"], bevel=0.012, parent=root)
    add_cylinder("EB_ElectronCol", radius=0.24, depth=0.62, vertices=24,
                 loc=(0, -0.42, 2.30), mat=pal["chrome"], bevel=0.010, parent=root)
    add_cylinder("EB_MagneticLens_1", radius=0.28, depth=0.10, vertices=24,
                 loc=(0, -0.42, 2.18), mat=pal["brand_blue_dark"], bevel=0.006, parent=root)
    add_cylinder("EB_MagneticLens_2", radius=0.28, depth=0.10, vertices=24,
                 loc=(0, -0.42, 2.42), mat=pal["copper"], bevel=0.006, parent=root)
    add_cylinder("EB_BeamGlow", radius=0.26, depth=0.05, vertices=24,
                 loc=(0, -0.42, 2.30), mat=pal["emit_cyan"], bevel=0.004, parent=root)
    add_cylinder("EB_IonGetterPump", radius=0.14, depth=0.28, vertices=16,
                 loc=(0.34, -0.42, 2.35), rot=(0, math.radians(90), 0),
                 mat=pal["steel"], bevel=0.006, parent=root)

    # Articulated Laser-Interferometer Stage inside Front Inspection Bay (SEM_Stage)
    stage_piv = make_empty("SEM_Stage", loc=(0, 0.18, 1.15), parent=root)
    add_box("EB_StageTable", (0.48, 0.48, 0.08), (0, 0, 0), mat=pal["steel"], bevel=0.006, parent=stage_piv)
    add_cylinder("EB_Wafer", radius=0.15, depth=0.012, vertices=24,
                 loc=(0, 0, 0.05), mat=pal["wafer"], bevel=0.002, parent=stage_piv)

    # 2 Front EFEM Load Ports
    for idx, lx in enumerate((-0.44, 0.44), start=1):
        build_efem_load_port(f"EB_LP_{idx}", loc=(lx, 0.96, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 2), hot_lot=True)

    # Dual Operator Wafer-Map Monitors
    build_operator_console("EB_Console_1", loc=(0.98, 0.58, 1.25), rot_z=math.radians(-22), parent=root)
    build_signal_tower("EB_SignalTower", loc=(-0.78, -0.42, 1.76), parent=root, state="RUN")
    return root


def build_metrology_optical(pal, x_off=6.8):
    root = make_empty("Metrology_Optical_Scatter", loc=(x_off, 0, 0))

    # Compact Inline Optical Overlay & Film-Thickness Scatterometry Tool (1.7m x 1.8m x 2.15m)
    add_box("OPT_Base", (1.72, 1.78, 0.22), (0, -0.08, 0.11), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_box("OPT_LowerBody", (1.66, 1.22, 0.92), (0, -0.34, 0.68), mat=pal["cool_grey"], bevel=0.018, parent=root)
    add_box("OPT_BackArch", (1.66, 0.44, 0.92), (0, -0.72, 1.58), mat=pal["white"], bevel=0.016, parent=root)
    add_box("OPT_TopBridge", (1.70, 1.26, 0.20), (0, -0.34, 2.08), mat=pal["brand_blue"], bevel=0.016, parent=root)

    # Wafer Chuck on Metrology Deck
    add_cylinder("OPT_Chuck", radius=0.22, depth=0.08, vertices=24,
                 loc=(0, -0.22, 1.18), mat=pal["dark_slate"], bevel=0.006, parent=root)
    add_cylinder("OPT_Wafer", radius=0.15, depth=0.012, vertices=24,
                 loc=(0, -0.22, 1.23), mat=pal["wafer"], bevel=0.002, parent=root)

    # Articulated Spectroscopic Ellipsometer Optical Scanning Head (Optical_Head)
    opt_piv = make_empty("Optical_Head", loc=(0, -0.22, 1.68), parent=root)
    add_box("OPT_HeadBody", (0.58, 0.28, 0.22), (0, 0, 0), mat=pal["brand_blue_dark"], bevel=0.008, parent=opt_piv)
    # Angled incident & detector optical barrels (classic ellipsometer V-configuration!)
    add_cylinder("OPT_EmitterBarrel", radius=0.065, depth=0.34, vertices=16,
                 loc=(-0.18, 0, -0.14), rot=(0, math.radians(32), 0),
                 mat=pal["chrome"], bevel=0.004, parent=opt_piv)
    add_cylinder("OPT_DetectorBarrel", radius=0.065, depth=0.34, vertices=16,
                 loc=(0.18, 0, -0.14), rot=(0, math.radians(-32), 0),
                 mat=pal["chrome"], bevel=0.004, parent=opt_piv)
    add_cylinder("OPT_LaserSpot", radius=0.04, depth=0.03, vertices=16,
                 loc=(0, 0, -0.28), mat=pal["emit_cyan"], bevel=0.003, parent=opt_piv)

    # 2 Front EFEM Load Ports
    for idx, lx in enumerate((-0.42, 0.42), start=1):
        build_efem_load_port(f"OPT_LP_{idx}", loc=(lx, 0.78, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=False)

    build_operator_console("OPT_Console", loc=(0.88, 0.48, 1.22), rot_z=math.radians(-20), parent=root)
    build_signal_tower("OPT_SignalTower", loc=(-0.68, -0.34, 2.18), parent=root, state="RUN")
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_cmp_polisher(pal, x_off=-6.5)
    build_wet_bench(pal, x_off=-1.8)
    build_metrology_eb(pal, x_off=2.8)
    build_metrology_optical(pal, x_off=6.8)
    finalize_and_export_glb("cmp_wet_metrology.glb")


if __name__ == "__main__":
    main()
