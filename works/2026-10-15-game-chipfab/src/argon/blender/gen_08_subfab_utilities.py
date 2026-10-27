import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, add_vent_grille, build_signal_tower, finalize_and_export_glb
)


def build_dry_pump_skid(pal, x_off=-6.0):
    root = make_empty("Subfab_DryPump_Booster", loc=(x_off, 0, 0))

    # Heavy Steel Skid Base (1.6m x 1.1m)
    add_box("DP_SkidBase", (1.62, 1.12, 0.16), (0, 0, 0.08), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("DP_FramePost_L", (0.10, 1.04, 1.05), (-0.72, 0, 0.65), mat=pal["cool_grey"], bevel=0.008, parent=root)
    add_box("DP_FramePost_R", (0.10, 1.04, 1.05), (0.72, 0, 0.65), mat=pal["cool_grey"], bevel=0.008, parent=root)

    # Lower Dry-Screw Vacuum Pump Cylinder + Upper Roots Booster Pump
    add_cylinder("DP_MainPumpBarrel", radius=0.28, depth=1.18, vertices=24,
                 loc=(-0.10, 0.0, 0.48), rot=(0, math.radians(90), 0),
                 mat=pal["brand_blue"], bevel=0.012, parent=root)
    # Cooling fins along pump barrel
    for fx in (-0.42, -0.22, -0.02, 0.18):
        add_cylinder(f"DP_CoolFin_{fx:.2f}", radius=0.31, depth=0.035, vertices=24,
                     loc=(fx, 0.0, 0.48), rot=(0, math.radians(90), 0),
                     mat=pal["steel"], bevel=0.004, parent=root)

    # Upper Roots Mechanical Booster Pump
    add_box("DP_RootsBooster", (0.78, 0.48, 0.36), (-0.05, 0.0, 0.96),
            mat=pal["cool_grey"], bevel=0.014, parent=root)

    # Vertical Stainless Steel Vacuum Foreline Pipe rising to Cleanroom floor above
    add_cylinder("DP_ForelinePipe", radius=0.11, depth=0.72, vertices=20,
                 loc=(-0.15, 0.0, 1.48), mat=pal["chrome"], bevel=0.006, parent=root)
    add_cylinder("DP_ISOFlange_Bot", radius=0.16, depth=0.04, vertices=20,
                 loc=(-0.15, 0.0, 1.16), mat=pal["steel"], bevel=0.004, parent=root)
    add_cylinder("DP_ISOFlange_Top", radius=0.16, depth=0.04, vertices=20,
                 loc=(-0.15, 0.0, 1.84), mat=pal["steel"], bevel=0.004, parent=root)

    # Right-side Electronics & N2 Purge Control Box
    add_box("DP_CtrlBox", (0.38, 0.88, 0.92), (0.50, 0.0, 0.64), mat=pal["white"], bevel=0.012, parent=root)
    add_box("DP_StatusScreen", (0.04, 0.32, 0.22), (0.695, 0.15, 0.85), mat=pal["console_ui"], bevel=0.003, parent=root)
    add_box("DP_RunLED", (0.03, 0.24, 0.04), (0.695, -0.20, 0.96), mat=pal["emit_green"], bevel=0.003, parent=root)

    # Articulated Spinning Pump Motor Cooling Fan on left end (origin at fan axle center)
    fan_piv = make_empty("Pump_Cooling_Fan", loc=(-0.72, 0.0, 0.48), parent=root)
    add_cylinder("DP_FanHub", radius=0.08, depth=0.06, vertices=16,
                 loc=(0, 0, 0), rot=(0, math.radians(90), 0), mat=pal["dark_slate"], bevel=0.005, parent=fan_piv)
    for b in range(6):
        ang = b * (math.pi / 3.0)
        by = math.cos(ang) * 0.14
        bz = math.sin(ang) * 0.14
        add_box(f"DP_FanBlade_{b}", (0.025, 0.16, 0.06), (0, by, bz),
                rot=(ang, 0, 0), mat=pal["safety_yellow"], bevel=0.003, parent=fan_piv)
    return root


def build_pou_abatement(pal, x_off=-3.0):
    root = make_empty("Subfab_PointOfUse_Abatement", loc=(x_off, 0, 0))

    # Burn/Wet Point-of-Use Gas Scrubber Cabinet (1.45m x 1.25m x 2.15m)
    add_box("ABT_Base", (1.46, 1.26, 0.18), (0, 0, 0.09), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("ABT_Cabinet", (1.40, 1.18, 1.82), (0, 0, 1.09), mat=pal["white"], bevel=0.018, parent=root)
    add_box("ABT_TopHeader", (1.46, 1.24, 0.18), (0, 0, 2.08), mat=pal["brand_blue"], bevel=0.015, parent=root)

    # External Vertical Stainless Water-Quench Scrubber Column + Combustion Sight Glass
    add_cylinder("ABT_QuenchColumn", radius=0.24, depth=1.65, vertices=24,
                 loc=(0.36, 0.48, 1.18), mat=pal["steel"], bevel=0.010, parent=root)
    add_cylinder("ABT_BurnerHead", radius=0.28, depth=0.32, vertices=24,
                 loc=(0.36, 0.48, 2.15), mat=pal["copper"], bevel=0.010, parent=root)
    # Glowing orange thermal combustion viewport ring on burner!
    add_cylinder("ABT_FlameGlow", radius=0.26, depth=0.08, vertices=24,
                 loc=(0.36, 0.48, 1.88), mat=pal["emit_orange"], bevel=0.005, parent=root)

    # Top 4 Inlet Exhaust Pipes from process chambers above
    for ix in (-0.48, -0.24, 0.0):
        add_cylinder(f"ABT_InletPipe_{ix:.2f}", radius=0.055, depth=0.38, vertices=14,
                     loc=(ix, 0.10, 2.34), mat=pal["chrome"], bevel=0.004, parent=root)

    # Articulated Hinged Front Service Door on Left Bay (pivot at left hinge)
    door_piv = make_empty("Abatement_Door", loc=(-0.64, 0.60, 1.08), parent=root)
    add_box("ABT_DoorPanel", (0.68, 0.04, 1.56), (0.34, 0, 0), mat=pal["cool_grey"], bevel=0.008, parent=door_piv)
    add_box("ABT_WarnPlate", (0.42, 0.05, 0.22), (0.34, 0.005, 0.35), mat=pal["safety_yellow"], bevel=0.004, parent=door_piv)
    add_vent_grille("ABT_DoorVent", width=0.46, height=0.38, slats=5,
                    loc=(0.34, 0.02, -0.35), parent=door_piv)

    build_signal_tower("ABT_SignalTower", loc=(-0.52, 0.42, 2.17), parent=root, state="RUN")
    return root


def build_heat_exchanger_chiller(pal, x_off=0.0):
    root = make_empty("Subfab_HeatExchanger_Chiller", loc=(x_off, 0, 0))

    # Process Cooling Water (PCW) Chiller Skid (1.75m x 1.25m x 1.95m)
    add_box("CHL_Skid", (1.76, 1.26, 0.16), (0, 0, 0.08), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("CHL_Body", (1.12, 1.16, 1.58), (-0.28, 0, 0.95), mat=pal["white"], bevel=0.018, parent=root)
    add_box("CHL_TopShroud", (1.16, 1.20, 0.16), (-0.28, 0, 1.82), mat=pal["brand_blue"], bevel=0.014, parent=root)

    # Dual Insulated Stainless Heat-Exchanger Barrels on Right Side of Skid
    for tz in (0.55, 1.18):
        add_cylinder(f"CHL_HeatEx_{tz:.2f}", radius=0.22, depth=1.08, vertices=20,
                     loc=(0.54, 0, tz), rot=(math.radians(90), 0, 0),
                     mat=pal["steel"], bevel=0.010, parent=root)
        add_cylinder(f"CHL_BlueJacket_{tz:.2f}", radius=0.23, depth=0.64, vertices=20,
                     loc=(0.54, 0, tz), rot=(math.radians(90), 0, 0),
                     mat=pal["brand_blue_dark"], bevel=0.006, parent=root)

    # Vertical PCW Supply (Blue) and Return (Red) Riser Pipes + Valve Handwheels
    for px, pmat, vmat in ((0.42, pal["brand_blue"], pal["emit_cyan"]), (0.68, pal["emit_red"], pal["safety_yellow"])):
        add_cylinder(f"CHL_Riser_{px:.2f}", radius=0.06, depth=0.65, vertices=14,
                     loc=(px, 0.36, 1.68), mat=pmat, bevel=0.004, parent=root)
        add_cylinder(f"CHL_ValveWheel_{px:.2f}", radius=0.11, depth=0.03, vertices=16,
                     loc=(px, 0.48, 1.52), rot=(math.radians(90), 0, 0), mat=vmat, bevel=0.004, parent=root)

    # Front PID Temperature Display + Louver Vents
    add_box("CHL_Screen", (0.42, 0.04, 0.28), (-0.28, 0.59, 1.38), mat=pal["console_ui"], bevel=0.004, parent=root)
    add_vent_grille("CHL_FrontVent", width=0.82, height=0.58, slats=6,
                    loc=(-0.28, 0.59, 0.68), parent=root)

    # Articulated Top Condenser Fan (Chiller_Fan)
    fan_piv = make_empty("Chiller_Fan", loc=(-0.28, 0, 1.92), parent=root)
    add_cylinder("CHL_FanHub", radius=0.10, depth=0.06, vertices=16, loc=(0, 0, 0), mat=pal["dark_slate"], parent=fan_piv)
    for b in range(5):
        ang = b * (2 * math.pi / 5.0)
        bx = math.cos(ang) * 0.22
        by = math.sin(ang) * 0.22
        add_box(f"CHL_Blade_{b}", (0.26, 0.09, 0.025), (bx, by, 0),
                rot=(math.radians(18), 0, ang), mat=pal["steel"], bevel=0.003, parent=fan_piv)
    return root


def build_gas_cabinet_vmb(pal, x_off=3.0):
    root = make_empty("Subfab_GasCabinet_VMB", loc=(x_off, 0, 0))

    # Specialty Process Gas Cabinet + Side Valve Manifold Box (VMB)
    add_box("GAS_Base", (1.48, 0.92, 0.16), (0, 0, 0.08), mat=pal["dark_slate"], bevel=0.012, parent=root)
    # Recessed interior cabinet shell so internal gas cylinders are visible!
    add_box("GAS_BackWall", (1.02, 0.10, 1.96), (-0.20, -0.38, 1.14), mat=pal["cool_grey"], bevel=0.012, parent=root)
    add_box("GAS_SideL", (0.10, 0.84, 1.96), (-0.66, 0, 1.14), mat=pal["white"], bevel=0.012, parent=root)
    add_box("GAS_SideM", (0.10, 0.84, 1.96), (0.26, 0, 1.14), mat=pal["white"], bevel=0.012, parent=root)
    add_box("GAS_TopHood", (1.06, 0.88, 0.22), (-0.20, 0, 2.20), mat=pal["safety_yellow"], bevel=0.014, parent=root)

    # 2 High-Pressure Specialty Gas Cylinders inside cabinet (SiH4 & NF3)
    for idx, (cx, cmat) in enumerate(((-0.38, pal["brand_blue"]), (-0.02, pal["hot_lot_orange"])), start=1):
        add_cylinder(f"GAS_Cylinder_{idx}", radius=0.13, depth=1.28, vertices=20,
                     loc=(cx, -0.05, 0.80), mat=cmat, bevel=0.010, parent=root)
        add_cylinder(f"GAS_ValveNeck_{idx}", radius=0.05, depth=0.16, vertices=14,
                     loc=(cx, -0.05, 1.50), mat=pal["copper"], bevel=0.004, parent=root)
        add_box(f"GAS_PurgePanel_{idx}", (0.26, 0.08, 0.36), (cx, -0.25, 1.80),
                mat=pal["steel"], bevel=0.005, parent=root)

    # Dual Articulated Windowed Safety Doors (Cabinet_Door_L, Cabinet_Door_R)
    for side, hx, dx in (("L", -0.62, 0.21), ("R", 0.22, -0.21)):
        d_piv = make_empty(f"Cabinet_Door_{side}", loc=(hx, 0.40, 1.14), parent=root)
        add_hollow_frame(f"GAS_DoorFrame_{side}", (0.42, 0.05, 1.88), thickness=0.055,
                         loc=(dx, 0, 0), mat=pal["safety_yellow"], parent=d_piv)

    # Right-side Valve Manifold Box (VMB) + Coaxial Stainless Gas Lines on top
    add_box("GAS_VMB_Box", (0.42, 0.72, 1.45), (0.52, 0, 1.12), mat=pal["steel"], bevel=0.012, parent=root)
    add_box("GAS_VMB_LED", (0.28, 0.03, 0.06), (0.52, 0.37, 1.65), mat=pal["emit_green"], bevel=0.004, parent=root)
    for gx in (-0.38, -0.10, 0.45, 0.60):
        add_cylinder(f"GAS_CoaxTube_{gx:.2f}", radius=0.028, depth=0.45, vertices=12,
                     loc=(gx, 0, 2.50), mat=pal["chrome"], bevel=0.003, parent=root)
    return root


def build_waffle_column_rack(pal, x_off=6.0):
    root = make_empty("Subfab_Waffle_Column_Rack", loc=(x_off, 0, 0))

    # Heavy Sub-Fab Structural Column + Overhead Waffle Ceiling Slab & Color-Coded Utility Pipe Rack
    add_box("WCR_Footing", (0.96, 0.96, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_cylinder("WCR_ConcreteCol", radius=0.34, depth=2.30, vertices=24,
                 loc=(0, 0, 1.35), mat=pal["cool_grey"], bevel=0.012, parent=root)
    add_box("WCR_WaffleCap", (2.20, 2.20, 0.24), (0, 0, 2.62), mat=pal["white"], bevel=0.016, parent=root)

    # Waffle coffer recesses + air/pipe feedthrough holes
    for wx in (-0.58, 0.58):
        for wy in (-0.58, 0.58):
            add_box(f"WCR_Coffer_{wx:.1f}_{wy:.1f}", (0.76, 0.76, 0.08), (wx, wy, 2.48),
                    mat=pal["dark_slate"], bevel=0.006, parent=root)

    # Multi-tier Horizontal Utility Pipe Rack running across column (PCW Blue, N2 Cyan, Exhaust Yellow, Vac Steel)
    add_box("WCR_RackCross_1", (1.96, 0.12, 0.08), (0, -0.75, 1.95), mat=pal["dark_slate"], bevel=0.006, parent=root)
    add_box("WCR_RackCross_2", (1.96, 0.12, 0.08), (0, 0.75, 1.95), mat=pal["dark_slate"], bevel=0.006, parent=root)
    pipes = [
        (-0.78, pal["brand_blue"], 0.085),
        (-0.52, pal["emit_cyan"], 0.065),
        (0.52, pal["safety_yellow"], 0.095),
        (0.78, pal["steel"], 0.085),
    ]
    for px, pmat, prad in pipes:
        add_cylinder(f"WCR_Pipe_{px:.2f}", radius=prad, depth=2.20, vertices=18,
                     loc=(px, 0, 2.08), rot=(math.radians(90), 0, 0),
                     mat=pmat, bevel=0.005, parent=root)
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_dry_pump_skid(pal, x_off=-6.0)
    build_pou_abatement(pal, x_off=-3.0)
    build_heat_exchanger_chiller(pal, x_off=0.0)
    build_gas_cabinet_vmb(pal, x_off=3.0)
    build_waffle_column_rack(pal, x_off=6.0)
    finalize_and_export_glb("subfab_utilities.glb")


if __name__ == "__main__":
    main()
