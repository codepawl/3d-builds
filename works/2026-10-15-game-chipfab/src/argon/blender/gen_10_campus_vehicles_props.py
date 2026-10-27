import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder, add_sphere,
    build_wheel_with_hub, build_foup_pod_mesh, finalize_and_export_glb
)


def build_wafer_transport_truck(pal, x_off=-7.5):
    root = make_empty("Vehicle_Wafer_Transport_Truck", loc=(x_off, 0, 0))

    # Chassis Frame (sits above axle height z=0.28m)
    add_box("TRK_Chassis", (1.26, 3.30, 0.18), (0, 0, 0.34), mat=pal["dark_slate"], bevel=0.012, parent=root)

    # Cab-Over Driver Cabin (Front: y from +0.85 to +1.72)
    add_box("TRK_CabBody", (1.36, 0.88, 1.05), (0, 1.26, 0.92), mat=pal["white"], bevel=0.024, parent=root)
    add_box("TRK_Windshield", (1.22, 0.08, 0.46), (0, 1.68, 1.08), mat=pal["glass_dark"], bevel=0.008, parent=root)
    add_box("TRK_SideWin_L", (0.06, 0.48, 0.42), (-0.66, 1.32, 1.08), mat=pal["glass_dark"], bevel=0.006, parent=root)
    add_box("TRK_SideWin_R", (0.06, 0.48, 0.42), (0.66, 1.32, 1.08), mat=pal["glass_dark"], bevel=0.006, parent=root)
    add_box("TRK_Grille", (0.86, 0.06, 0.24), (0, 1.70, 0.64), mat=pal["brand_blue"], bevel=0.008, parent=root)
    add_box("TRK_Bumper", (1.40, 0.16, 0.18), (0, 1.68, 0.38), mat=pal["dark_slate"], bevel=0.012, parent=root)
    for hx in (-0.48, 0.48):
        add_box(f"TRK_Headlight_{hx:.2f}", (0.20, 0.05, 0.10), (hx, 1.71, 0.56),
                mat=pal["emit_cyan"], bevel=0.004, parent=root)
    # Roof Aerodynamic Fairing
    add_box("TRK_AeroRoof", (1.32, 0.68, 0.28), (0, 1.18, 1.56),
            rot=(math.radians(-14), 0, 0), mat=pal["brand_blue"], bevel=0.016, parent=root)

    # Climate-Controlled Cleanroom Cargo Box (y from -1.68 to +0.76)
    add_box("TRK_CargoBox", (1.46, 2.42, 1.38), (0, -0.46, 1.12), mat=pal["white"], bevel=0.022, parent=root)
    add_box("TRK_LiveryStripe_L", (0.04, 2.28, 0.26), (-0.72, -0.46, 1.18),
            mat=pal["brand_blue"], bevel=0.005, parent=root)
    add_box("TRK_LiveryStripe_R", (0.04, 2.28, 0.26), (0.72, -0.46, 1.18),
            mat=pal["brand_blue"], bevel=0.005, parent=root)
    add_box("TRK_ReeferUnit", (0.88, 0.28, 0.36), (0, 0.82, 1.62), mat=pal["cool_grey"], bevel=0.012, parent=root)

    # Articulated Rear Roll-Up Cargo Door (Truck_Rear_Door, origin at top header hinge)
    door_piv = make_empty("Truck_Rear_Door", loc=(0, -1.68, 1.72), parent=root)
    add_box("TRK_RearDoorPanel", (1.24, 0.05, 1.16), (0, 0, -0.58),
            mat=pal["cool_grey"], bevel=0.008, parent=door_piv)
    add_box("TRK_RearLatchBar", (0.56, 0.07, 0.06), (0, -0.02, -0.98),
            mat=pal["steel"], bevel=0.004, parent=door_piv)

    for tx in (-0.54, 0.54):
        add_box(f"TRK_Taillight_{tx:.2f}", (0.20, 0.05, 0.08), (tx, -1.68, 0.38),
                mat=pal["emit_red"], bevel=0.004, parent=root)

    # 4 Articulated Wheels with Hubs (origins at axle centers, z = 0.28m, radius = 0.28m)
    wheels = [
        ("Truck_Wheel_FL", (-0.66, 1.18, 0.28)),
        ("Truck_Wheel_FR", (0.66, 1.18, 0.28)),
        ("Truck_Wheel_RL", (-0.66, -0.92, 0.28)),
        ("Truck_Wheel_RR", (0.66, -0.92, 0.28)),
    ]
    for wname, wloc in wheels:
        build_wheel_with_hub(wname, radius=0.28, width=0.18, loc=wloc, parent=root)
    return root


def build_cryo_gas_tanker(pal, x_off=-4.2):
    root = make_empty("Vehicle_Cryo_Gas_Tanker", loc=(x_off, 0, 0))

    # Long Cryogenic Tanker Chassis (y from -1.95 to +1.85)
    add_box("TNK_Chassis", (1.28, 3.70, 0.18), (0, -0.05, 0.34), mat=pal["dark_slate"], bevel=0.012, parent=root)

    # Tractor Cab in Brand Blue & White
    add_box("TNK_CabBody", (1.38, 0.92, 1.08), (0, 1.38, 0.94), mat=pal["brand_blue"], bevel=0.024, parent=root)
    add_box("TNK_Windshield", (1.24, 0.08, 0.46), (0, 1.82, 1.10), mat=pal["glass_dark"], bevel=0.008, parent=root)
    add_box("TNK_Bumper", (1.42, 0.16, 0.18), (0, 1.82, 0.38), mat=pal["dark_slate"], bevel=0.012, parent=root)

    # Cylindrical Cryogenic Liquid Nitrogen Tank Barrel (y from -1.88 to +0.82)
    add_cylinder("TNK_CryoBarrel", radius=0.64, depth=2.68, vertices=24,
                 loc=(0, -0.52, 1.10), rot=(math.radians(90), 0, 0),
                 mat=pal["white"], bevel=0.022, parent=root)
    add_cylinder("TNK_BlueRing_1", radius=0.65, depth=0.32, vertices=24,
                 loc=(0, -0.15, 1.10), rot=(math.radians(90), 0, 0),
                 mat=pal["brand_blue"], bevel=0.008, parent=root)
    add_cylinder("TNK_SteelEndCap", radius=0.58, depth=0.16, vertices=24,
                 loc=(0, -1.90, 1.10), rot=(math.radians(90), 0, 0),
                 mat=pal["steel"], bevel=0.012, parent=root)
    # Rear Cryogenic Transfer Pump & Hose Box
    add_box("TNK_ValveBox", (0.86, 0.28, 0.56), (0, -1.95, 0.72), mat=pal["cool_grey"], bevel=0.010, parent=root)

    # 6 Articulated Wheels (Front Steer, Mid Drive, Rear Tandem)
    wheels = [
        ("Tanker_Wheel_FL", (-0.68, 1.35, 0.28)),
        ("Tanker_Wheel_FR", (0.68, 1.35, 0.28)),
        ("Tanker_Wheel_ML", (-0.68, -0.55, 0.28)),
        ("Tanker_Wheel_MR", (0.68, -0.55, 0.28)),
        ("Tanker_Wheel_RL", (-0.68, -1.35, 0.28)),
        ("Tanker_Wheel_RR", (0.68, -1.35, 0.28)),
    ]
    for wname, wloc in wheels:
        build_wheel_with_hub(wname, radius=0.28, width=0.18, loc=wloc, parent=root)
    return root


def build_cleanroom_pgv(pal, x_off=-1.2):
    root = make_empty("Vehicle_Cleanroom_PGV", loc=(x_off, 0, 0))

    # Compact Cleanroom Person-Guided / Automated Maintenance & FOUP Cart (1.15m x 0.74m)
    add_box("PGV_BaseBody", (0.72, 1.12, 0.34), (0, 0, 0.27), mat=pal["white"], bevel=0.016, parent=root)
    add_box("PGV_BlueBumper", (0.76, 1.16, 0.08), (0, 0, 0.14), mat=pal["brand_blue"], bevel=0.010, parent=root)
    add_box("PGV_LaserScanner", (0.28, 0.06, 0.06), (0, 0.58, 0.16), mat=pal["emit_cyan"], bevel=0.004, parent=root)

    # Rear Operator Push Upright + Console Screen + Amber Strobe
    add_box("PGV_Mast", (0.48, 0.14, 0.68), (0, -0.46, 0.76), mat=pal["steel"], bevel=0.010, parent=root)
    add_box("PGV_Console", (0.42, 0.22, 0.06), (0, -0.42, 1.12),
            rot=(math.radians(25), 0, 0), mat=pal["console_ui"], bevel=0.005, parent=root)
    add_cylinder("PGV_Strobe", radius=0.045, depth=0.08, vertices=14,
                 loc=(0.18, -0.46, 1.18), mat=pal["emit_amber"], bevel=0.005, parent=root)

    # Articulated Scissor-Lift FOUP Platform + Carried FOUP Pod (PGV_Lift_Table)
    lift_piv = make_empty("PGV_Lift_Table", loc=(0, 0.12, 0.52), parent=root)
    add_box("PGV_StagePlate", (0.56, 0.56, 0.05), (0, 0, 0), mat=pal["steel"], bevel=0.006, parent=lift_piv)
    build_foup_pod_mesh("PGV_FOUP", loc=(0, 0, 0.03), rot_z=0.0,
                        parent=lift_piv, hot_lot=False, include_door_pivot=False)

    # 4 Articulated Cleanroom Caster Wheels (z = 0.11m, radius = 0.11m)
    wheels = [
        ("PGV_Wheel_FL", (-0.34, 0.36, 0.11)),
        ("PGV_Wheel_FR", (0.34, 0.36, 0.11)),
        ("PGV_Wheel_RL", (-0.34, -0.36, 0.11)),
        ("PGV_Wheel_RR", (0.34, -0.36, 0.11)),
    ]
    for wname, wloc in wheels:
        build_wheel_with_hub(wname, radius=0.11, width=0.07, loc=wloc, parent=root)
    return root


def build_interfab_skyway(pal, x_off=2.0):
    root = make_empty("Bridge_Interfab_Skyway", loc=(x_off, 0, 0))

    # Elevated Inter-Fab Cleanroom OHT Skybridge & Utility Pipe Truss (3.8m span supported on 2 piers)
    for sx in (-1.45, 1.45):
        add_box(f"SKY_PierBase_{sx:.2f}", (0.56, 0.92, 0.20), (sx, 0, 0.10),
                mat=pal["dark_slate"], bevel=0.012, parent=root)
        add_box(f"SKY_PierCol_{sx:.2f}", (0.36, 0.72, 1.45), (sx, 0, 0.92),
                mat=pal["cool_grey"], bevel=0.014, parent=root)

    # Enclosed Cleanroom Skyway Gallery above piers (z from 1.62m to 2.75m)
    add_box("SKY_FloorDeck", (3.80, 1.36, 0.16), (0, 0, 1.70), mat=pal["dark_slate"], bevel=0.014, parent=root)
    add_box("SKY_RoofDeck", (3.84, 1.42, 0.18), (0, 0, 2.68), mat=pal["brand_blue"], bevel=0.016, parent=root)
    for wy in (-0.62, 0.62):
        add_box(f"SKY_GlassWall_{wy:.2f}", (3.60, 0.06, 0.82), (0, wy, 2.18),
                mat=pal["glass_dark"], bevel=0.006, parent=root)
    # Rooftop UPW & N2 Inter-Plant Pipes
    add_cylinder("SKY_Pipe_UPW", radius=0.08, depth=3.80, vertices=16,
                 loc=(0, -0.32, 2.88), rot=(0, math.radians(90), 0),
                 mat=pal["brand_blue_dark"], bevel=0.005, parent=root)
    add_cylinder("SKY_Pipe_N2", radius=0.07, depth=3.80, vertices=16,
                 loc=(0, 0.32, 2.88), rot=(0, math.radians(90), 0),
                 mat=pal["emit_cyan"], bevel=0.005, parent=root)

    # Articulated Center Fire/Cleanroom Isolation Damper Gate (Skyway_Damper)
    damp_piv = make_empty("Skyway_Damper", loc=(0, 0, 2.18), parent=root)
    add_box("SKY_DamperFrame", (0.14, 1.24, 0.78), (0, 0, 0), mat=pal["safety_yellow"], bevel=0.008, parent=damp_piv)
    return root


def build_security_gate(pal, x_off=5.8):
    root = make_empty("Gate_Campus_Security", loc=(x_off, 0, 0))

    # Security Guard Booth + Articulated Barrier Boom Arm
    add_box("GAT_IslandPad", (1.60, 2.20, 0.16), (-0.55, 0, 0.08), mat=pal["dark_slate"], bevel=0.012, parent=root)
    add_box("GAT_BoothBody", (1.18, 1.48, 1.85), (-0.65, 0, 1.08), mat=pal["white"], bevel=0.020, parent=root)
    add_box("GAT_BoothRoof", (1.32, 1.62, 0.18), (-0.65, 0, 2.08), mat=pal["brand_blue"], bevel=0.016, parent=root)
    add_box("GAT_BoothWin_F", (0.88, 0.08, 0.78), (-0.65, 0.72, 1.28), mat=pal["glass_dark"], bevel=0.006, parent=root)
    add_box("GAT_BoothWin_R", (0.08, 1.08, 0.78), (-0.05, 0, 1.28), mat=pal["glass_dark"], bevel=0.006, parent=root)

    # Barrier Pedestal + Articulated Boom Arm (Gate_Barrier_Arm with origin at pivot axle!)
    add_box("GAT_Pedestal", (0.32, 0.32, 0.88), (0.05, 0.72, 0.56), mat=pal["safety_yellow"], bevel=0.010, parent=root)
    arm_piv = make_empty("Gate_Barrier_Arm", loc=(0.05, 0.72, 0.86), parent=root)
    add_cylinder("GAT_ArmHub", radius=0.09, depth=0.12, vertices=16,
                 loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=pal["dark_slate"], bevel=0.005, parent=arm_piv)
    add_box("GAT_ArmBar", (1.85, 0.05, 0.10), (0.92, 0, 0), mat=pal["white"], bevel=0.005, parent=arm_piv)
    for sx in (0.35, 0.85, 1.35, 1.75):
        add_box(f"GAT_Stripe_{sx:.2f}", (0.18, 0.06, 0.105), (sx, 0, 0),
                mat=pal["emit_red"], bevel=0.003, parent=arm_piv)
    return root


def build_campus_trees_sign(pal, x_off=8.8):
    root = make_empty("Prop_Campus_Trees_Planter", loc=(x_off, 0, 0))

    # Architectural Concrete Planter + 2 Stylized Isometric Trees + Campus Monument Sign
    add_box("PRP_PlanterWall", (2.20, 1.40, 0.36), (0, -0.35, 0.18), mat=pal["white"], bevel=0.016, parent=root)
    add_box("PRP_SoilBed", (1.96, 1.16, 0.08), (0, -0.35, 0.34), mat=pal["trunk_brown"], bevel=0.008, parent=root)

    for idx, (tx, tz_scale) in enumerate(((-0.52, 1.0), (0.52, 0.85)), start=1):
        add_cylinder(f"PRP_Trunk_{idx}", radius=0.10, depth=0.95 * tz_scale, vertices=12,
                     loc=(tx, -0.35, 0.78 * tz_scale), mat=pal["trunk_brown"], bevel=0.006, parent=root)
        add_sphere(f"PRP_CanopyMain_{idx}", radius=0.52 * tz_scale, segments=16, ring_count=12,
                   loc=(tx, -0.35, 1.48 * tz_scale), mat=pal["foliage_green"], parent=root, scale=(1.0, 1.0, 0.88))
        add_sphere(f"PRP_CanopyTop_{idx}", radius=0.36 * tz_scale, segments=14, ring_count=10,
                   loc=(tx + 0.12, -0.30, 1.88 * tz_scale), mat=pal["foliage_green"], parent=root)

    # Illuminated AetherSil Campus Monument Sign in Front
    add_box("PRP_SignBase", (1.42, 0.32, 0.24), (0, 0.68, 0.12), mat=pal["dark_slate"], bevel=0.010, parent=root)
    add_box("PRP_SignMonolith", (1.28, 0.22, 1.15), (0, 0.68, 0.80), mat=pal["brand_blue"], bevel=0.016, parent=root)
    add_box("PRP_SignGlowBar", (1.06, 0.24, 0.18), (0, 0.68, 1.12), mat=pal["emit_cyan"], bevel=0.006, parent=root)
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_wafer_transport_truck(pal, x_off=-7.5)
    build_cryo_gas_tanker(pal, x_off=-4.2)
    build_cleanroom_pgv(pal, x_off=-1.2)
    build_interfab_skyway(pal, x_off=2.0)
    build_security_gate(pal, x_off=5.8)
    build_campus_trees_sign(pal, x_off=8.8)
    finalize_and_export_glb("campus_vehicles_props.glb")


if __name__ == "__main__":
    main()
