import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_hollow_frame, add_vent_grille, finalize_and_export_glb
)


def _build_roof_fan(name, loc, radius, parent, pal):
    fan_piv = make_empty(name, loc=loc, parent=parent)
    add_cylinder(f"{name}_Hub", radius=radius * 0.25, depth=0.08, vertices=16,
                 loc=(0, 0, 0), mat=pal["brand_blue"], bevel=0.005, parent=fan_piv)
    for b in range(6):
        ang = b * (math.pi / 3.0)
        bx = math.cos(ang) * (radius * 0.55)
        by = math.sin(ang) * (radius * 0.55)
        add_box(f"{name}_Blade_{b}", (radius * 0.65, radius * 0.22, 0.03), (bx, by, 0),
                rot=(math.radians(18), 0, ang), mat=pal["steel"], bevel=0.004, parent=fan_piv)
    return fan_piv


def build_fab1_shell(pal, x_off=-21.0):
    root = make_empty("Building_Fab1_Shell", loc=(x_off, 0, 0))

    # 1. Foundation Plinth (5.4m x 4.2m) + 3-Story Cleanroom/Subfab/Interstitial Massing
    add_box("F1_Foundation", (5.40, 4.20, 0.24), (0, 0, 0.12), mat=pal["dark_slate"], bevel=0.020, parent=root)
    add_box("F1_SubfabTier", (5.20, 3.90, 0.95), (0, -0.10, 0.71), mat=pal["cool_grey"], bevel=0.022, parent=root)
    add_box("F1_CleanroomTier", (5.28, 3.96, 1.65), (0, -0.10, 2.00), mat=pal["white"], bevel=0.025, parent=root)
    add_box("F1_BrandFascia", (5.36, 4.04, 0.34), (0, -0.10, 2.98), mat=pal["brand_blue"], bevel=0.022, parent=root)

    # Front Glass Admin/Engineering Spine Atrium
    add_box("F1_AtriumFrame", (3.60, 0.65, 2.35), (-0.45, 1.98, 1.40), mat=pal["white"], bevel=0.020, parent=root)
    for wx in (-1.60, -0.45, 0.70):
        add_box(f"F1_AtriumGlass_{wx:.2f}", (0.98, 0.08, 1.85), (wx, 2.28, 1.45),
                mat=pal["glass_dark"], bevel=0.008, parent=root)
    add_box("F1_EntranceCanopy", (1.60, 0.55, 0.12), (-0.45, 2.48, 0.95),
            mat=pal["brand_blue_dark"], bevel=0.012, parent=root)
    add_box("F1_SignGlow", (1.80, 0.05, 0.18), (-0.45, 1.95, 2.98),
            mat=pal["emit_cyan"], bevel=0.005, parent=root)

    # Rooftop Make-Up Air Unit (MAU) Penthouse + Exhaust Stacks + 2 Articulated Roof Fans
    add_box("F1_RoofMAU", (3.40, 1.80, 0.58), (-0.60, -0.55, 3.44), mat=pal["cool_grey"], bevel=0.018, parent=root)
    for idx, fx in enumerate((-1.35, 0.15), start=1):
        add_cylinder(f"F1_FanShroud_{idx}", radius=0.46, depth=0.22, vertices=24,
                     loc=(fx, -0.55, 3.82), mat=pal["dark_slate"], bevel=0.010, parent=root)
        _build_roof_fan(f"Fab1_Roof_Fan_{idx}", loc=(fx, -0.55, 3.90), radius=0.40, parent=root, pal=pal)

    for sx in (1.45, 2.05):
        add_cylinder(f"F1_ExhaustStack_{sx:.2f}", radius=0.22, depth=0.85, vertices=20,
                     loc=(sx, -0.85, 3.55), mat=pal["steel"], bevel=0.010, parent=root)
    return root


def build_fab2_rampup(pal, x_off=-13.5):
    root = make_empty("Building_Fab2_RampUp", loc=(x_off, 0, 0))

    # Fab 2 Under Ramp-Up / Tool Move-In Shell (5.0m x 4.0m)
    add_box("F2_Foundation", (5.10, 4.10, 0.24), (0, 0, 0.12), mat=pal["dark_slate"], bevel=0.020, parent=root)
    add_box("F2_MainHall", (4.20, 3.70, 2.45), (-0.38, -0.10, 1.46), mat=pal["white"], bevel=0.025, parent=root)
    add_box("F2_TopFascia", (4.28, 3.78, 0.30), (-0.38, -0.10, 2.82), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # Tool Move-In Cleanroom Rigging Bay on Front-Left with Articulated Roll-Up Door (Fab2_Rigging_Door)
    add_box("F2_RiggingPortal", (1.60, 0.36, 1.85), (-1.15, 1.78, 1.16),
            mat=pal["safety_yellow"], bevel=0.015, parent=root)
    add_box("F2_RiggingRecess", (1.28, 0.22, 1.56), (-1.15, 1.76, 1.02),
            mat=pal["dark_slate"], bevel=0.008, parent=root)
    door_piv = make_empty("Fab2_Rigging_Door", loc=(-1.15, 1.85, 1.48), parent=root)
    add_box("F2_RollUpPanel", (1.24, 0.06, 0.68), (0, 0, 0), mat=pal["cool_grey"], bevel=0.008, parent=door_piv)

    # Cleanroom windows along front-right
    for wx in (0.15, 1.05):
        add_box(f"F2_Window_{wx:.2f}", (0.72, 0.08, 1.10), (wx, 1.74, 1.65),
                mat=pal["glass_dark"], bevel=0.006, parent=root)

    # Articulated Construction/Commissioning Tower Crane on Right Side (Crane_Turret -> Crane_Boom -> Crane_Hook)
    add_box("F2_CranePad", (0.86, 0.86, 0.26), (2.05, 0.85, 0.36), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("F2_CraneMast", (0.42, 0.42, 3.10), (2.05, 0.85, 2.02), mat=pal["safety_yellow"], bevel=0.012, parent=root)

    turret_piv = make_empty("Crane_Turret", loc=(2.05, 0.85, 3.62), parent=root)
    add_box("F2_TurretCab", (0.64, 0.68, 0.48), (0, 0, 0.22), mat=pal["brand_blue"], bevel=0.012, parent=turret_piv)
    add_box("F2_CounterJib", (1.15, 0.34, 0.24), (0.68, 0, 0.28), mat=pal["dark_slate"], bevel=0.010, parent=turret_piv)

    boom_piv = make_empty("Crane_Boom", loc=(-0.22, 0, 0.32), parent=turret_piv)
    add_box("F2_BoomArm", (2.65, 0.28, 0.24), (-1.28, 0, 0.18),
            rot=(0, math.radians(8), 0), mat=pal["safety_yellow"], bevel=0.010, parent=boom_piv)

    hook_piv = make_empty("Crane_Hook", loc=(-2.35, 0, -0.55), parent=boom_piv)
    add_cylinder("F2_HoistCable", radius=0.025, depth=0.95, vertices=10,
                 loc=(0, 0, 0.45), mat=pal["steel"], bevel=0.002, parent=hook_piv)
    add_box("F2_LiftedToolCrate", (0.78, 0.68, 0.62), (0, 0, -0.28),
            mat=pal["brand_blue_dark"], bevel=0.012, parent=hook_piv)
    return root


def build_packaging_plant(pal, x_off=-6.2):
    root = make_empty("Building_Packaging_Plant", loc=(x_off, 0, 0))

    # Advanced 2.5D/3D Chiplet Packaging Plant (4.6m x 3.6m x 2.9m)
    add_box("AP_Foundation", (4.68, 3.68, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.018, parent=root)
    add_box("AP_MainBody", (4.52, 3.44, 2.25), (0, -0.05, 1.34), mat=pal["white"], bevel=0.024, parent=root)
    add_box("AP_BlueBand", (4.60, 3.52, 0.28), (0, -0.05, 2.58), mat=pal["brand_blue"], bevel=0.020, parent=root)

    # Rooftop Sawtooth Cleanroom Skylight Monitors
    for sy in (-0.95, 0.0, 0.85):
        add_box(f"AP_SkylightBay_{sy:.2f}", (3.60, 0.62, 0.36), (-0.20, sy, 2.86),
                mat=pal["cool_grey"], bevel=0.014, parent=root)
        add_box(f"AP_SkylightGlass_{sy:.2f}", (3.40, 0.08, 0.24), (-0.20, sy + 0.29, 2.86),
                mat=pal["glass_dark"], bevel=0.005, parent=root)

    # 2 Front Truck Loading Dock Bays with Articulated Roll-Up Doors (AP1_Dock_Door_1, AP1_Dock_Door_2)
    for idx, dx in enumerate((-1.15, 0.05), start=1):
        add_box(f"AP_DockSurround_{idx}", (0.98, 0.18, 1.42), (dx, 1.68, 0.92),
                mat=pal["dark_slate"], bevel=0.010, parent=root)
        d_piv = make_empty(f"AP1_Dock_Door_{idx}", loc=(dx, 1.72, 1.30), parent=root)
        add_box(f"AP_DoorPanel_{idx}", (0.82, 0.06, 0.65), (0, 0, 0),
                mat=pal["brand_blue_dark"], bevel=0.008, parent=d_piv)

    # Right-side Office Glass Window & Sign
    add_box("AP_OfficeGlass", (1.15, 0.08, 1.35), (1.42, 1.66, 1.42), mat=pal["glass_dark"], bevel=0.006, parent=root)
    add_box("AP_SignLED", (1.20, 0.05, 0.16), (1.42, 1.72, 2.58), mat=pal["emit_cyan"], bevel=0.004, parent=root)
    return root


def build_upw_plant(pal, x_off=0.5):
    root = make_empty("Support_UPW_Plant", loc=(x_off, 0, 0))

    # Ultra-Pure Water (UPW) Plant Pad + Filtration Hall + 4 Polishing Tanks
    add_box("UPW_Pad", (4.10, 3.40, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.018, parent=root)
    add_box("UPW_PumpHall", (2.10, 2.95, 2.15), (-0.88, -0.08, 1.28), mat=pal["white"], bevel=0.020, parent=root)
    add_box("UPW_HallCrown", (2.18, 3.02, 0.24), (-0.88, -0.08, 2.46), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # 4 Vertical Cylindrical Deionization & RO Polishing Tanks on Right Side
    tank_coords = [(0.68, -0.78, 1), (1.52, -0.78, 2), (0.68, 0.62, 3), (1.52, 0.62, 4)]
    for tx, ty, idx in tank_coords:
        add_cylinder(f"UPW_Tank_{idx}", radius=0.36, depth=2.35, vertices=24,
                     loc=(tx, ty, 1.38), mat=pal["white"], bevel=0.015, parent=root)
        add_cylinder(f"UPW_BlueBelt_{idx}", radius=0.37, depth=0.28, vertices=24,
                     loc=(tx, ty, 1.85), mat=pal["brand_blue"], bevel=0.008, parent=root)
        add_cylinder(f"UPW_CyanRing_{idx}", radius=0.375, depth=0.07, vertices=24,
                     loc=(tx, ty, 2.22), mat=pal["emit_cyan"], bevel=0.004, parent=root)

    # Overhead Stainless Water Manifold Pipe Bridge linking tanks to hall
    add_box("UPW_PipeBridge", (2.55, 0.24, 0.12), (0.35, -0.08, 2.66), mat=pal["steel"], bevel=0.008, parent=root)
    add_cylinder("UPW_MainHeaderPipe", radius=0.09, depth=2.60, vertices=18,
                 loc=(0.35, -0.08, 2.80), rot=(0, math.radians(90), 0),
                 mat=pal["brand_blue"], bevel=0.005, parent=root)

    # Articulated Degasifier Blower Fan on Pump Hall Roof (UPW_Blower_Fan)
    add_cylinder("UPW_FanCollar", radius=0.38, depth=0.18, vertices=20,
                 loc=(-0.88, -0.08, 2.66), mat=pal["dark_slate"], bevel=0.008, parent=root)
    _build_roof_fan("UPW_Blower_Fan", loc=(-0.88, -0.08, 2.74), radius=0.34, parent=root, pal=pal)
    return root


def build_gas_yard(pal, x_off=6.5):
    root = make_empty("Support_Gas_Yard", loc=(x_off, 0, 0))

    # Bulk Cryogenic Gas Yard Pad (4.1m x 3.4m)
    add_box("GY_ConcretePad", (4.10, 3.40, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.018, parent=root)
    add_box("GY_ControlHouse", (1.28, 1.40, 1.65), (-1.22, 0.78, 1.04), mat=pal["white"], bevel=0.018, parent=root)
    add_box("GY_HouseCap", (1.34, 1.46, 0.18), (-1.22, 0.78, 1.94), mat=pal["brand_blue"], bevel=0.014, parent=root)

    # 3 Tall Cryogenic Dewar Storage Silos (LIN / LOX / LAR) along Rear
    silo_xs = (-1.18, 0.0, 1.18)
    silo_bands = (pal["brand_blue"], pal["emit_cyan"], pal["brand_blue_dark"])
    for idx, (sx, bmat) in enumerate(zip(silo_xs, silo_bands), start=1):
        add_cylinder(f"GY_SiloLegs_{idx}", radius=0.42, depth=0.38, vertices=20,
                     loc=(sx, -0.62, 0.40), mat=pal["dark_slate"], bevel=0.010, parent=root)
        add_cylinder(f"GY_DewarSilo_{idx}", radius=0.48, depth=2.65, vertices=24,
                     loc=(sx, -0.62, 1.88), mat=pal["white"], bevel=0.020, parent=root)
        add_cylinder(f"GY_IDBand_{idx}", radius=0.49, depth=0.26, vertices=24,
                     loc=(sx, -0.62, 2.48), mat=bmat, bevel=0.008, parent=root)
        add_cylinder(f"GY_CrownDome_{idx}", radius=0.34, depth=0.18, vertices=20,
                     loc=(sx, -0.62, 3.26), mat=pal["steel"], bevel=0.012, parent=root)

    # Ambient Finned Aluminum Cryo Vaporizer Racks in Front-Right
    for vx in (0.18, 0.85, 1.48):
        add_box(f"GY_Vaporizer_{vx:.2f}", (0.42, 0.88, 1.85), (vx, 0.78, 1.14),
                mat=pal["ice_blue"], bevel=0.012, parent=root)
        for fin in (-0.12, 0.0, 0.12):
            add_box(f"GY_Fin_{vx:.2f}_{fin:.2f}", (0.04, 0.94, 1.72), (vx + fin, 0.78, 1.14),
                    mat=pal["chrome"], bevel=0.003, parent=root)

    # Safety Bollards along front edge
    for bx in (-1.75, -0.85, 0.05, 0.95, 1.75):
        add_cylinder(f"GY_Bollard_{bx:.2f}", radius=0.06, depth=0.52, vertices=12,
                     loc=(bx, 1.54, 0.48), mat=pal["safety_yellow"], bevel=0.006, parent=root)
    return root


def build_cooling_tower_bank(pal, x_off=12.5):
    root = make_empty("Support_Cooling_Tower_Bank", loc=(x_off, 0, 0))

    # 3-Cell Forced-Draft Cooling Tower Bank over Chilled Water Basin (4.4m x 2.7m x 2.55m)
    add_box("CT_BasinWalls", (4.40, 2.72, 0.42), (0, 0, 0.21), mat=pal["dark_slate"], bevel=0.018, parent=root)
    add_box("CT_WaterSurface", (4.16, 2.48, 0.08), (0, 0, 0.39), mat=pal["emit_cyan"], bevel=0.006, parent=root)

    # Main 3-Cell Cooling Tower Body
    add_box("CT_MainBody", (4.12, 2.28, 1.62), (0, 0, 1.22), mat=pal["white"], bevel=0.022, parent=root)
    add_box("CT_TopDeck", (4.24, 2.40, 0.18), (0, 0, 2.10), mat=pal["brand_blue"], bevel=0.018, parent=root)

    # Louver intake grilles & 3 Articulated Multi-Blade Top Exhaust Fans (CT_Fan_1..3)
    for idx, cx in enumerate((-1.32, 0.0, 1.32), start=1):
        add_vent_grille(f"CT_Intake_F_{idx}", width=1.10, height=1.12, slats=7,
                        loc=(cx, 1.15, 1.18), frame_mat=pal["cool_grey"], slat_mat=pal["dark_slate"], parent=root)
        add_vent_grille(f"CT_Intake_B_{idx}", width=1.10, height=1.12, slats=7,
                        loc=(cx, -1.15, 1.18), rot=(0, 0, math.pi),
                        frame_mat=pal["cool_grey"], slat_mat=pal["dark_slate"], parent=root)
        # Cylindrical Venturi Fan Shroud Stack on Roof
        add_cylinder(f"CT_FanStack_{idx}", radius=0.54, depth=0.38, vertices=24,
                     loc=(cx, 0, 2.36), mat=pal["cool_grey"], bevel=0.014, parent=root)
        add_cylinder(f"CT_StackRim_{idx}", radius=0.56, depth=0.06, vertices=24,
                     loc=(cx, 0, 2.54), mat=pal["brand_blue_dark"], bevel=0.006, parent=root)
        # Articulated Fan Rotor (CT_Fan_1, CT_Fan_2, CT_Fan_3)
        _build_roof_fan(f"CT_Fan_{idx}", loc=(cx, 0, 2.44), radius=0.46, parent=root, pal=pal)
    return root


def build_power_substation(pal, x_off=18.5):
    root = make_empty("Support_Power_Substation", loc=(x_off, 0, 0))

    # High-Voltage 161kV Power Substation Yard (4.1m x 3.4m)
    add_box("SUB_Foundation", (4.10, 3.40, 0.22), (0, 0, 0.11), mat=pal["dark_slate"], bevel=0.018, parent=root)
    # GIS Switchgear Control Building along Rear
    add_box("SUB_GIS_House", (3.76, 1.18, 1.95), (0, -0.92, 1.18), mat=pal["white"], bevel=0.020, parent=root)
    add_box("SUB_GIS_Fascia", (3.84, 1.24, 0.22), (0, -0.92, 2.24), mat=pal["brand_blue"], bevel=0.016, parent=root)
    add_box("SUB_StatusStrip", (3.40, 0.04, 0.08), (0, -0.32, 2.24), mat=pal["emit_green"], bevel=0.004, parent=root)

    # 2 Heavy Step-Down Power Transformers in Front Yard
    for idx, tx in enumerate((-1.05, 1.05), start=1):
        add_box(f"SUB_XfmrTank_{idx}", (1.18, 1.04, 1.38), (tx, 0.55, 0.90),
                mat=pal["cool_grey"], bevel=0.016, parent=root)
        # Side Cooling Radiator Fin Banks
        for rx in (-0.68, 0.68):
            add_box(f"SUB_Radiator_{idx}_{rx:.2f}", (0.18, 0.88, 1.12), (tx + rx, 0.55, 0.88),
                    mat=pal["dark_slate"], bevel=0.008, parent=root)
        # Top Oil Conservator Drum
        add_cylinder(f"SUB_Conservator_{idx}", radius=0.18, depth=0.92, vertices=18,
                     loc=(tx, 0.25, 1.82), rot=(0, math.radians(90), 0),
                     mat=pal["steel"], bevel=0.008, parent=root)
        # 3 Ceramic HV Bushings with Copper Terminals
        for bx in (-0.34, 0.0, 0.34):
            add_cylinder(f"SUB_Bushing_{idx}_{bx:.2f}", radius=0.075, depth=0.58, vertices=14,
                         loc=(tx + bx, 0.68, 1.85), rot=(math.radians(-12), 0, 0),
                         mat=pal["white"], bevel=0.006, parent=root)
            add_cylinder(f"SUB_BushTip_{idx}_{bx:.2f}", radius=0.045, depth=0.14, vertices=12,
                         loc=(tx + bx, 0.74, 2.18), rot=(math.radians(-12), 0, 0),
                         mat=pal["copper"], bevel=0.004, parent=root)

    # Overhead High-Voltage Busbar Gantry Frame
    for gx in (-1.82, 0.0, 1.82):
        add_box(f"SUB_GantryPost_{gx:.2f}", (0.14, 0.14, 2.55), (gx, 0.10, 1.48),
                mat=pal["steel"], bevel=0.008, parent=root)
    add_box("SUB_GantryBeam", (3.86, 0.18, 0.16), (0, 0.10, 2.78), mat=pal["brand_blue_dark"], bevel=0.010, parent=root)
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_fab1_shell(pal, x_off=-21.0)
    build_fab2_rampup(pal, x_off=-13.5)
    build_packaging_plant(pal, x_off=-6.2)
    build_upw_plant(pal, x_off=0.5)
    build_gas_yard(pal, x_off=6.5)
    build_cooling_tower_bank(pal, x_off=12.5)
    build_power_substation(pal, x_off=18.5)
    finalize_and_export_glb("campus_buildings.glb")


if __name__ == "__main__":
    main()
