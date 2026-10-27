import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    build_foup_pod_mesh, build_wheel_with_hub, finalize_and_export_glb
)


def _build_oht_vehicle(name, pal, x_off, is_priority=False):
    root = make_empty(name, loc=(x_off, 0, 0))
    body_mat = pal["brand_blue"] if is_priority else pal["white"]
    trim_mat = pal["hot_lot_orange"] if is_priority else pal["brand_blue"]
    led_mat = pal["emit_orange"] if is_priority else pal["emit_green"]

    # Vehicle sits with bottom of side bumpers at z=0.05 so it rests cleanly on ground in preview
    # 1. Upper Monorail Bogie Carriage (at z = 0.72m)
    add_box(f"{name}_BogieSpine", (0.42, 0.88, 0.14), (0, 0, 0.74), mat=pal["dark_slate"], bevel=0.010, parent=root)
    add_box(f"{name}_PowerPickup", (0.48, 0.56, 0.06), (0, 0, 0.83), mat=pal["copper"], bevel=0.005, parent=root)

    # 4 Articulated Bogie Drive Wheels (origins at axle centers!)
    wheel_coords = [
        ("Wheel_FL", (-0.23, 0.30, 0.76)),
        ("Wheel_FR", (0.23, 0.30, 0.76)),
        ("Wheel_RL", (-0.23, -0.30, 0.76)),
        ("Wheel_RR", (0.23, -0.30, 0.76)),
    ]
    for wname, wloc in wheel_coords:
        build_wheel_with_hub(f"{name}_{wname}", radius=0.095, width=0.055, loc=wloc, parent=root)

    # 2. Main OHT Cowl & Wrap-Around FOUP Protection Shells
    add_box(f"{name}_UpperCowl", (0.74, 0.94, 0.16), (0, 0, 0.58), mat=body_mat, bevel=0.016, parent=root)
    add_box(f"{name}_FrontNose", (0.68, 0.18, 0.46), (0, 0.42, 0.32), mat=body_mat, bevel=0.016, parent=root)
    add_box(f"{name}_RearTail", (0.68, 0.18, 0.46), (0, -0.42, 0.32), mat=body_mat, bevel=0.016, parent=root)
    add_box(f"{name}_SideSkirt_L", (0.10, 0.88, 0.22), (-0.33, 0, 0.44), mat=trim_mat, bevel=0.010, parent=root)
    add_box(f"{name}_SideSkirt_R", (0.10, 0.88, 0.22), (0.33, 0, 0.44), mat=trim_mat, bevel=0.010, parent=root)

    # Front Optical Collision LiDAR Dome + Status LEDs
    add_cylinder(f"{name}_LidarDome", radius=0.08, depth=0.10, vertices=16,
                 loc=(0, 0.51, 0.26), rot=(math.radians(90), 0, 0),
                 mat=pal["glass_dark"], bevel=0.008, parent=root)
    add_box(f"{name}_LED_Front", (0.48, 0.03, 0.035), (0, 0.51, 0.44), mat=led_mat, bevel=0.004, parent=root)
    add_box(f"{name}_LED_Rear", (0.48, 0.03, 0.035), (0, -0.51, 0.44), mat=led_mat, bevel=0.004, parent=root)
    add_box(f"{name}_LED_SideL", (0.025, 0.62, 0.03), (-0.38, 0, 0.44), mat=pal["emit_cyan"], bevel=0.003, parent=root)
    add_box(f"{name}_LED_SideR", (0.025, 0.62, 0.03), (0.38, 0, 0.44), mat=pal["emit_cyan"], bevel=0.003, parent=root)

    if is_priority:
        for bx in (-0.22, 0.22):
            add_cylinder(f"{name}_Beacon_{bx:.2f}", radius=0.045, depth=0.06, vertices=14,
                         loc=(bx, 0.34, 0.68), mat=pal["emit_orange"], bevel=0.005, parent=root)

    # 3. Articulated Lateral Slide Stage + Vertical Hoist Gripper (Hoist_Slide -> Hoist_Gripper)
    slide_piv = make_empty(f"{name}_Hoist_Slide", loc=(0, 0, 0.50), parent=root)
    add_box(f"{name}_SlidePlate", (0.48, 0.48, 0.05), (0, 0, 0), mat=pal["steel"], bevel=0.005, parent=slide_piv)

    grip_piv = make_empty(f"{name}_Hoist_Gripper", loc=(0, 0, -0.04), parent=slide_piv)
    add_box(f"{name}_GripperHead", (0.34, 0.34, 0.06), (0, 0, 0), mat=pal["dark_slate"], bevel=0.006, parent=grip_piv)
    # 2 articulated locking claws gripping the FOUP top flange
    add_box(f"{name}_Claw_L", (0.06, 0.20, 0.05), (-0.11, 0, -0.04), mat=pal["chrome"], bevel=0.004, parent=grip_piv)
    add_box(f"{name}_Claw_R", (0.06, 0.20, 0.05), (0.11, 0, -0.04), mat=pal["chrome"], bevel=0.004, parent=grip_piv)

    # Carried 300mm FOUP pod suspended under the gripper
    build_foup_pod_mesh(f"{name}_Carried_FOUP", loc=(0, 0, -0.46), rot_z=0.0,
                        parent=grip_piv, hot_lot=is_priority, include_door_pivot=True)
    return root


def build_single_wafer(pal, x_off=0.6):
    root = make_empty("Wafer_300mm_Single", loc=(x_off, 0, 0))
    # Display cushion ring + 300mm (radius=0.15m) patterned silicon wafer with alignment notch
    add_cylinder("Wafer_StandRing", radius=0.12, depth=0.03, vertices=24,
                 loc=(0, 0, 0.015), mat=pal["dark_slate"], bevel=0.004, parent=root)
    add_cylinder("Wafer_Disc_300mm", radius=0.15, depth=0.008, vertices=32,
                 loc=(0, 0, 0.035), mat=pal["wafer"], bevel=0.002, parent=root)
    add_cylinder("Wafer_CopperRim", radius=0.152, depth=0.005, vertices=32,
                 loc=(0, 0, 0.034), mat=pal["copper"], bevel=0.001, parent=root)
    return root


def build_oht_rail_straight(pal, x_off=2.5):
    root = make_empty("OHT_Rail_Straight_4m", loc=(x_off, 0, 0))
    # 4m Twin-Rail Aluminum Extrusion (along Y axis: -2.0m to +2.0m)
    for side, rx in (("L", -0.22), ("R", 0.22)):
        add_box(f"Rail_Beam_{side}", (0.09, 4.00, 0.14), (rx, 0, 0.07),
                mat=pal["steel"], bevel=0.008, parent=root)
        add_box(f"Rail_Trim_{side}", (0.025, 4.00, 0.05), (rx * 1.18, 0, 0.07),
                mat=pal["brand_blue"], bevel=0.003, parent=root)
        # Contactless inductive power wire along inner rail
        add_cylinder(f"Rail_LitzCable_{side}", radius=0.014, depth=3.98, vertices=10,
                     loc=(rx * 0.78, 0, 0.09), rot=(math.radians(90), 0, 0),
                     mat=pal["copper"], bevel=0.002, parent=root)

    # Cross tie yokes & ceiling drop hanger rods every 1.2m
    for idx, ty in enumerate((-1.6, -0.53, 0.53, 1.6)):
        add_box(f"Rail_Yoke_{idx}", (0.56, 0.12, 0.06), (0, ty, 0.16),
                mat=pal["dark_slate"], bevel=0.006, parent=root)
        add_cylinder(f"Rail_Hanger_{idx}", radius=0.025, depth=0.42, vertices=12,
                     loc=(0, ty, 0.38), mat=pal["chrome"], bevel=0.003, parent=root)
    return root


def build_oht_rail_curve(pal, x_off=5.2):
    root = make_empty("OHT_Rail_Curve_90", loc=(x_off, 0, 0))
    # 90-degree curved twin-rail segment built from 8 beveled chord blocks (R=1.2m)
    r_center = 1.20
    segs = 8
    for i in range(segs):
        a0 = (i / segs) * (math.pi * 0.5)
        a1 = ((i + 1) / segs) * (math.pi * 0.5)
        amid = (a0 + a1) * 0.5
        for side, dr in (("Inner", -0.22), ("Outer", 0.22)):
            rad = r_center + dr
            chord = 2.0 * rad * math.sin((a1 - a0) * 0.5) * 1.06
            cx = -r_center + math.cos(amid) * rad
            cy = -0.60 + math.sin(amid) * rad
            add_box(f"Curve_Seg_{side}_{i}", (0.09, chord, 0.14), (cx, cy, 0.07),
                    rot=(0, 0, amid), mat=pal["steel"], bevel=0.006, parent=root)
        if i in (1, 4, 7):
            cx = -r_center + math.cos(amid) * r_center
            cy = -0.60 + math.sin(amid) * r_center
            add_box(f"Curve_Yoke_{i}", (0.56, 0.12, 0.06), (cx, cy, 0.16),
                    rot=(0, 0, amid), mat=pal["brand_blue"], bevel=0.006, parent=root)
            add_cylinder(f"Curve_Hanger_{i}", radius=0.025, depth=0.40, vertices=12,
                         loc=(cx, cy, 0.37), mat=pal["chrome"], bevel=0.003, parent=root)
    return root


def build_oht_rail_switch(pal, x_off=8.2):
    root = make_empty("OHT_Rail_Switch_Merge", loc=(x_off, 0, 0))
    # Straight main track (2.6m) + diverging branch stub + articulated Switch_Tongue
    for side, rx in (("L", -0.22), ("R", 0.22)):
        add_box(f"Sw_Main_{side}", (0.09, 2.60, 0.14), (rx, 0, 0.07),
                mat=pal["steel"], bevel=0.008, parent=root)
    # Diverging branch rails angled at 28 degrees to the right
    for side, off in (("L", -0.22), ("R", 0.22)):
        add_box(f"Sw_Branch_{side}", (0.09, 1.35, 0.14), (0.35 + off * 0.88, 0.35, 0.07),
                rot=(0, 0, math.radians(-28)), mat=pal["steel"], bevel=0.008, parent=root)

    # Overhead switch actuator box + cyan status bar
    add_box("Sw_ActuatorBox", (0.78, 0.85, 0.12), (0.12, 0.0, 0.19),
            mat=pal["brand_blue_dark"], bevel=0.010, parent=root)
    add_box("Sw_StatusLED", (0.52, 0.08, 0.03), (0.12, 0.0, 0.26),
            mat=pal["emit_cyan"], bevel=0.004, parent=root)

    # Articulated Switch Diverter Tongue (origin at pivot hinge)
    tongue_piv = make_empty("Switch_Tongue", loc=(0.0, -0.35, 0.07), parent=root)
    add_box("Sw_TongueBlade", (0.07, 0.78, 0.12), (0, 0.38, 0),
            rot=(0, 0, math.radians(-14)), mat=pal["safety_yellow"], bevel=0.005, parent=tongue_piv)
    return root


def main():
    clear_scene()
    pal = get_palette()
    _build_oht_vehicle("OHT_Vehicle_Standard", pal, x_off=-5.5, is_priority=False)
    _build_oht_vehicle("OHT_Vehicle_Priority", pal, x_off=-3.4, is_priority=True)
    build_foup_pod_mesh("FOUP_Pod_Standard", loc=(-1.6, 0, 0), rot_z=0.0, parent=None, hot_lot=False)
    build_foup_pod_mesh("FOUP_Pod_HotLot", loc=(-0.5, 0, 0), rot_z=0.0, parent=None, hot_lot=True)
    build_single_wafer(pal, x_off=0.6)
    build_oht_rail_straight(pal, x_off=2.5)
    build_oht_rail_curve(pal, x_off=5.2)
    build_oht_rail_switch(pal, x_off=8.2)
    finalize_and_export_glb("oht_network_foup.glb")


if __name__ == "__main__":
    main()
