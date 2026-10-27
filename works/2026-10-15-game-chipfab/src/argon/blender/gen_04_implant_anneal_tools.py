import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, add_vent_grille, add_bolt_row, build_signal_tower,
    build_operator_console, build_efem_load_port, finalize_and_export_glb
)


def build_ion_implanter(pal, x_off=-5.2):
    root = make_empty("Ion_Implanter_HighCurrent", loc=(x_off, 0, 0))

    # 1. Heavy Shielded Base Frame (2.6m x 3.2m)
    add_box("IMP_Base", (2.60, 3.10, 0.22), (0, -0.25, 0.11), mat=pal["dark_slate"], bevel=0.015, parent=root)

    # 2. Rear High-Voltage Ion Source Enclosure + Cutaway Beamline Cavity
    add_box("IMP_HV_Enclosure", (2.52, 1.35, 1.42), (0, -1.10, 0.92), mat=pal["cool_grey"], bevel=0.020, parent=root)
    add_box("IMP_SideWall_L", (0.36, 2.50, 2.20), (-1.08, -0.45, 1.32), mat=pal["white"], bevel=0.018, parent=root)
    add_box("IMP_SideWall_R", (0.36, 2.50, 2.20), (1.08, -0.45, 1.32), mat=pal["white"], bevel=0.018, parent=root)
    add_box("IMP_RearArch", (2.56, 0.52, 2.30), (0, -1.52, 1.37), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # High-Voltage Safety Warning Stripe & Insulator Bushings in Rear Bay
    add_box("IMP_HV_Stripe", (1.70, 0.06, 0.14), (0, -0.42, 1.52), mat=pal["safety_yellow"], bevel=0.005, parent=root)
    for ix in (-0.55, 0.0, 0.55):
        add_cylinder(f"IMP_HV_Insulator_{ix:.2f}", radius=0.11, depth=0.38, vertices=16,
                     loc=(ix, -1.12, 1.82), mat=pal["white"], bevel=0.008, parent=root)
        add_cylinder(f"IMP_HV_Cap_{ix:.2f}", radius=0.13, depth=0.06, vertices=16,
                     loc=(ix, -1.12, 2.04), mat=pal["copper"], bevel=0.005, parent=root)

    # Visible Curved 90-Degree Magnetic Analyzer Dipole & Ion Beamline inside Top Cutaway!
    add_box("IMP_AnalyzerMagnet", (0.92, 0.88, 0.52), (-0.28, -0.82, 1.88),
            rot=(0, 0, math.radians(22)), mat=pal["brand_blue_dark"], bevel=0.015, parent=root)
    add_cylinder("IMP_BeamlineTube", radius=0.18, depth=1.15, vertices=20,
                 loc=(0.0, -0.20, 1.86), rot=(math.radians(90), 0, 0),
                 mat=pal["steel"], bevel=0.008, parent=root)
    add_cylinder("IMP_BeamGlowRing", radius=0.20, depth=0.08, vertices=20,
                 loc=(0.0, 0.12, 1.86), rot=(math.radians(90), 0, 0),
                 mat=pal["emit_cyan"], bevel=0.004, parent=root)

    # 3. Front Process Endstation with Articulated Wafer Scan Wheel (Endstation_Wheel)
    add_box("IMP_EndstationDeck", (1.76, 0.90, 0.95), (0, 0.25, 0.68), mat=pal["dark_slate"], bevel=0.014, parent=root)
    wheel_piv = make_empty("Endstation_Wheel", loc=(0, 0.35, 1.62), parent=root)
    add_cylinder("IMP_WheelHub", radius=0.16, depth=0.14, vertices=20,
                 loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=pal["brand_blue"], bevel=0.008, parent=wheel_piv)
    add_cylinder("IMP_WheelDisk", radius=0.46, depth=0.06, vertices=24,
                 loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=pal["steel"], bevel=0.006, parent=wheel_piv)
    for w_i in range(4):
        ang = w_i * (math.pi * 0.5)
        wx = math.cos(ang) * 0.26
        wz = math.sin(ang) * 0.26
        add_cylinder(f"IMP_ScanWafer_{w_i}", radius=0.11, depth=0.015, vertices=20,
                     loc=(wx, 0.035, wz), rot=(math.radians(90), 0, 0),
                     mat=pal["wafer"], bevel=0.002, parent=wheel_piv)

    # Side cooling louver vents
    for sx in (-1.27, 1.27):
        add_vent_grille(f"IMP_Vent_{sx:.2f}", width=1.10, height=0.52, slats=6,
                        loc=(sx, -0.55, 0.78), rot=(0, 0, math.radians(90 if sx > 0 else -90)), parent=root)

    # 4. Front 3-Port EFEM
    add_box("IMP_EFEM_Body", (2.40, 0.54, 2.15), (0, 1.00, 1.08), mat=pal["white"], bevel=0.018, parent=root)
    add_box("IMP_EFEM_Header", (2.44, 0.58, 0.20), (0, 1.00, 2.24), mat=pal["brand_blue"], bevel=0.014, parent=root)
    for idx, lx in enumerate((-0.76, 0.0, 0.76), start=1):
        build_efem_load_port(f"IMP_LP_{idx}", loc=(lx, 1.50, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 2), hot_lot=False)

    build_operator_console("IMP_Console", loc=(1.26, 1.05, 1.25), rot_z=math.radians(-22), parent=root)
    build_signal_tower("IMP_SignalTower", loc=(-1.05, 1.05, 2.34), parent=root, state="RUN")
    return root


def build_vertical_furnace(pal, x_off=0.0):
    root = make_empty("Furnace_Vertical_Diffusion", loc=(x_off, 0, 0))

    # Tall Vertical Diffusion/Oxidation Furnace Tower (2.2m wide x 2.3m deep x 3.1m high)
    add_box("FUR_Base", (2.24, 2.26, 0.22), (0, -0.15, 0.11), mat=pal["dark_slate"], bevel=0.015, parent=root)
    add_box("FUR_RearTower", (2.18, 1.10, 2.80), (0, -0.72, 1.62), mat=pal["cool_grey"], bevel=0.020, parent=root)
    add_box("FUR_SideWall_L", (0.38, 1.15, 2.80), (-0.90, 0.38, 1.62), mat=pal["white"], bevel=0.018, parent=root)
    add_box("FUR_SideWall_R", (0.38, 1.15, 2.80), (0.90, 0.38, 1.62), mat=pal["white"], bevel=0.018, parent=root)
    add_box("FUR_TopCap", (2.26, 2.30, 0.24), (0, -0.12, 3.12), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # Dual Upper Vertical Quartz Process Tubes with Glowing Orange Heater Coils!
    for idx, tx in enumerate((-0.38, 0.38), start=1):
        # Outer water-cooled stainless jacket sleeve (cut away in front)
        add_cylinder(f"FUR_ProcessTube_{idx}", radius=0.25, depth=1.18, vertices=24,
                     loc=(tx, -0.05, 2.32), mat=pal["copper"], bevel=0.010, parent=root)
        # Glowing orange heating element rings around tube
        for r_i in range(4):
            rz = 1.88 + r_i * 0.28
            add_cylinder(f"FUR_HeaterCoil_{idx}_{r_i}", radius=0.275, depth=0.08, vertices=24,
                         loc=(tx, -0.05, rz), mat=pal["emit_orange"], bevel=0.005, parent=root)
        # Bottom manifold flange
        add_cylinder(f"FUR_Flange_{idx}", radius=0.30, depth=0.08, vertices=24,
                     loc=(tx, -0.05, 1.70), mat=pal["steel"], bevel=0.006, parent=root)

    # Articulated Vertical Quartz Wafer-Boat Elevator below the process tubes (Boat_Elevator)
    elev_piv = make_empty("Boat_Elevator", loc=(-0.38, -0.05, 1.05), parent=root)
    add_box("FUR_ElevCarriage", (0.44, 0.36, 0.10), (0, 0, -0.28), mat=pal["brand_blue"], bevel=0.008, parent=elev_piv)
    add_cylinder("FUR_QuartzPed", radius=0.14, depth=0.16, vertices=18,
                 loc=(0, 0, -0.15), mat=pal["steel"], bevel=0.005, parent=elev_piv)
    # 3 vertical quartz boat rods + stack of 10 300mm wafers!
    for rod_ang in (0, 120, 240):
        rr = math.radians(rod_ang)
        add_cylinder(f"FUR_BoatRod_{rod_ang}", radius=0.015, depth=0.56, vertices=10,
                     loc=(math.cos(rr) * 0.16, math.sin(rr) * 0.16, 0.20),
                     mat=pal["chrome"], bevel=0.002, parent=elev_piv)
    for w_i in range(9):
        wz = -0.02 + w_i * 0.055
        add_cylinder(f"FUR_BoatWafer_{w_i}", radius=0.15, depth=0.012, vertices=20,
                     loc=(0, 0, wz), mat=pal["wafer"], bevel=0.002, parent=elev_piv)

    # Vertical lead-screw column for the boat elevator
    add_cylinder("FUR_LeadScrew", radius=0.04, depth=1.35, vertices=14,
                 loc=(0.0, -0.12, 0.95), mat=pal["chrome"], bevel=0.003, parent=root)

    # 2 Front EFEM Load Ports
    for idx, lx in enumerate((-0.46, 0.46), start=1):
        build_efem_load_port(f"FUR_LP_{idx}", loc=(lx, 1.18, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=True)

    build_operator_console("FUR_Console", loc=(1.12, 0.92, 1.28), rot_z=math.radians(-20), parent=root)
    build_signal_tower("FUR_SignalTower", loc=(-0.92, 0.82, 3.24), parent=root, state="RUN")
    return root


def build_rtp_anneal(pal, x_off=4.8):
    root = make_empty("Anneal_RTP_Laser", loc=(x_off, 0, 0))

    # Compact Rapid Thermal Processing / Millisecond Flash Anneal Tool (2.0m x 2.1m x 2.2m)
    add_box("RTP_Base", (2.04, 2.06, 0.20), (0, -0.10, 0.10), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_box("RTP_MainCab", (1.98, 1.36, 1.68), (0, -0.42, 1.04), mat=pal["white"], bevel=0.020, parent=root)
    add_box("RTP_TopHeader", (2.04, 1.42, 0.22), (0, -0.42, 1.98), mat=pal["brand_blue"], bevel=0.016, parent=root)

    # Circular High-Intensity Tungsten-Halogen / Flash Lamp Array Dome on top-center
    add_cylinder("RTP_ChamberBody", radius=0.58, depth=0.38, vertices=24,
                 loc=(0, -0.35, 2.24), mat=pal["steel"], bevel=0.012, parent=root)
    add_cylinder("RTP_LampGlowRing", radius=0.59, depth=0.08, vertices=24,
                 loc=(0, -0.35, 2.36), mat=pal["emit_orange"], bevel=0.005, parent=root)
    add_cylinder("RTP_GoldReflector", radius=0.46, depth=0.14, vertices=24,
                 loc=(0, -0.35, 2.46), mat=pal["gold"], bevel=0.010, parent=root)

    # Articulated Rotating Magnetic-Levitation Wafer Chuck Assembly (RTP_Rotor)
    rot_piv = make_empty("RTP_Rotor", loc=(0, -0.35, 2.55), parent=root)
    add_box("RTP_PyrometerBridge", (0.86, 0.16, 0.08), (0, 0, 0.04),
            mat=pal["brand_blue_dark"], bevel=0.006, parent=rot_piv)
    add_cylinder("RTP_SensorHead", radius=0.10, depth=0.12, vertices=16,
                 loc=(0, 0, 0.10), mat=pal["emit_amber"], bevel=0.004, parent=rot_piv)

    # Cooling water manifold pipes on right side (Supply Blue / Return Red)
    add_cylinder("RTP_Pipe_Supply", radius=0.04, depth=1.25, vertices=12,
                 loc=(1.02, -0.35, 1.15), mat=pal["brand_blue"], bevel=0.003, parent=root)
    add_cylinder("RTP_Pipe_Return", radius=0.04, depth=1.25, vertices=12,
                 loc=(1.02, -0.52, 1.15), mat=pal["emit_red"], bevel=0.003, parent=root)

    # Front EFEM + 2 Load Ports
    add_box("RTP_EFEM", (1.96, 0.50, 1.98), (0, 0.52, 1.00), mat=pal["cool_grey"], bevel=0.016, parent=root)
    for idx, lx in enumerate((-0.46, 0.46), start=1):
        build_efem_load_port(f"RTP_LP_{idx}", loc=(lx, 1.00, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 2), hot_lot=False)

    build_operator_console("RTP_Console", loc=(1.02, 0.65, 1.22), rot_z=math.radians(-20), parent=root)
    build_signal_tower("RTP_SignalTower", loc=(-0.82, -0.35, 2.10), parent=root, state="RUN")
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_ion_implanter(pal, x_off=-5.2)
    build_vertical_furnace(pal, x_off=0.0)
    build_rtp_anneal(pal, x_off=4.8)
    finalize_and_export_glb("implant_anneal_tools.glb")


if __name__ == "__main__":
    main()
