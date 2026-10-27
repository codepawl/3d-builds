import bpy
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import argon_fab_lib as fl


def build_oht_network():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: OHT_Vehicle (Overhead Hoist Transport Shuttle with FOUP Hoist)
    # =========================================================================
    v1_root = fl.make_root("OHT_Vehicle", loc=(-10.5, 0.0, 0.0))
    hull = fl.add_bevel_box(
        "OHT_Chassis",
        size=(0.82, 1.08, 0.56),
        loc=(0.0, 0.0, 0.62),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    v1_parts = []
    # Top rail bogie carrier block
    bogie = fl.add_bevel_box(
        "oht_bogie",
        size=(0.48, 0.92, 0.22),
        loc=(0.0, 0.0, 0.98),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=v1_root,
    )
    # Cobalt Blue side brand stripes & front optical LiDAR bumper
    for sx in (-0.415, 0.415):
        stripe = fl.add_bevel_box(
            f"oht_stripe_{sx}",
            size=(0.02, 0.92, 0.14),
            loc=(sx, 0.0, 0.72),
            bevel_width=0.005,
            mat=pal["brand_blue"],
            parent=v1_root,
        )
        led = fl.add_bevel_box(
            f"oht_led_{sx}",
            size=(0.025, 0.78, 0.04),
            loc=(sx, 0.0, 0.56),
            bevel_width=0.004,
            mat=pal["emit_cyan"],
            parent=v1_root,
        )
        v1_parts.extend([stripe, led])

    sensor = fl.add_bevel_cylinder(
        "oht_sensor",
        radius=0.09,
        depth=0.14,
        vertices=16,
        loc=(0.0, -0.54, 0.58),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.01,
        mat=pal["glass_dark"],
        parent=v1_root,
    )
    v1_parts.extend([bogie, sensor])
    v1_parts.append(fl.add_signage_plate("oht_id", (0.0, -0.55, 0.76), size=(0.38, 0.02, 0.10), parent=v1_root, pal=pal))
    fl.merge_objects_into(hull, v1_parts)

    # 4 Separate Named Guide/Drive Wheels with hubs (`Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR`)
    wheel_locs = [
        ("Wheel_FL", (-0.28, -0.34, 1.02)),
        ("Wheel_FR", (0.28, -0.34, 1.02)),
        ("Wheel_RL", (-0.28, 0.34, 1.02)),
        ("Wheel_RR", (0.28, 0.34, 1.02)),
    ]
    for wname, wloc in wheel_locs:
        fl.create_wheel(wname, loc=wloc, radius=0.11, width=0.06, parent=v1_root, pal=pal, axis="X")

    # Separate Moving Hoist Stage (`HoistStage`) that drops down on 4 hoist belts carrying a FOUP
    hoist = fl.add_bevel_box(
        "HoistStage",
        size=(0.46, 0.44, 0.06),
        loc=(0.0, 0.0, 0.44),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v1_root,
    )
    h_parts = []
    for bx in (-0.18, 0.18):
        for by in (-0.16, 0.16):
            belt = fl.add_bevel_box(
                f"hoist_belt_{bx}_{by}",
                size=(0.025, 0.012, 0.24),
                loc=(0.0, 0.0, 0.44),
                bevel_width=0.002,
                mat=pal["slate"],
                parent=v1_root,
                pivot_offset=(bx, by, 0.12),
            )
            h_parts.append(belt)
    # Carried FOUP pod under hoist stage
    foup_carried = fl.create_foup_pod(
        "oht_foup_pod",
        loc=(0.0, 0.0, 0.06),
        parent=v1_root,
        pal=pal,
        variant="hot",
        separate_door=False,
    )
    h_parts.append(foup_carried)
    fl.merge_objects_into(hoist, h_parts)

    # Separate Moving Gripper Jaws (`Gripper_L`, `Gripper_R`) parented to HoistStage
    fl.add_bevel_box(
        "Gripper_L",
        size=(0.06, 0.24, 0.08),
        loc=(-0.10, 0.0, -0.04),
        bevel_width=0.008,
        mat=pal["brand_blue"],
        parent=hoist,
        pivot_offset=(-0.03, 0.0, -0.02),
    )
    fl.add_bevel_box(
        "Gripper_R",
        size=(0.06, 0.24, 0.08),
        loc=(0.10, 0.0, -0.04),
        bevel_width=0.008,
        mat=pal["brand_blue"],
        parent=hoist,
        pivot_offset=(0.03, 0.0, -0.02),
    )

    # =========================================================================
    # VARIANT 2: OHT_Rail_Straight (4m Dual-Track Ceiling Monorail Segment)
    # =========================================================================
    v2_root = fl.make_root("OHT_Rail_Straight", loc=(-6.5, 0.0, 0.0))
    rail_main = fl.add_bevel_box(
        "RailStraight_Beam",
        size=(0.72, 4.0, 0.12),
        loc=(0.0, 0.0, 0.18),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v2_root,
    )
    r2_parts = []
    for rx in (-0.28, 0.28):
        track = fl.add_bevel_box(
            f"r2_trk_{rx}",
            size=(0.10, 4.0, 0.16),
            loc=(rx, 0.0, 0.12),
            bevel_width=0.01,
            mat=pal["slate"],
            parent=v2_root,
        )
        bus = fl.add_bevel_box(
            f"r2_bus_{rx}",
            size=(0.03, 3.98, 0.04),
            loc=(rx * 0.72, 0.0, 0.12),
            bevel_width=0.004,
            mat=pal["copper"],
            parent=v2_root,
        )
        r2_parts.extend([track, bus])
    for hy in (-1.5, 0.0, 1.5):
        hanger = fl.add_bevel_cylinder(
            f"r2_hang_{hy}",
            radius=0.035,
            depth=0.55,
            vertices=12,
            loc=(0.0, hy, 0.48),
            bevel_width=0.005,
            mat=pal["chrome"],
            parent=v2_root,
        )
        r2_parts.append(hanger)
    fl.merge_objects_into(rail_main, r2_parts)

    # =========================================================================
    # VARIANT 3: OHT_Rail_Curve90 (90-Degree Curved OHT Monorail Segment)
    # =========================================================================
    v3_root = fl.make_root("OHT_Rail_Curve90", loc=(-2.8, 0.0, 0.0))
    curve_hub = fl.add_bevel_box(
        "RailCurve_Support",
        size=(0.72, 0.40, 0.14),
        loc=(0.0, -1.2, 0.18),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v3_root,
    )
    c_parts = []
    segs = 8
    rad_c = 1.4
    for i in range(segs):
        ang = (i + 0.5) * (math.pi * 0.5 / segs)
        cx = -rad_c + math.cos(ang) * rad_c
        cy = -1.2 + math.sin(ang) * rad_c
        seg_box = fl.add_bevel_box(
            f"r3_seg_{i}",
            size=(0.72, 0.42, 0.14),
            loc=(cx, cy, 0.18),
            rot=(0.0, 0.0, ang),
            bevel_width=0.012,
            mat=pal["silver"],
            parent=v3_root,
        )
        seg_bus = fl.add_bevel_box(
            f"r3_bus_{i}",
            size=(0.56, 0.40, 0.05),
            loc=(cx, cy, 0.10),
            rot=(0.0, 0.0, ang),
            bevel_width=0.005,
            mat=pal["brand_blue"],
            parent=v3_root,
        )
        c_parts.extend([seg_box, seg_bus])
        if i in (1, 4, 7):
            ch = fl.add_bevel_cylinder(
                f"r3_hang_{i}",
                radius=0.035,
                depth=0.55,
                vertices=12,
                loc=(cx, cy, 0.48),
                bevel_width=0.005,
                mat=pal["chrome"],
                parent=v3_root,
            )
            c_parts.append(ch)
    fl.merge_objects_into(curve_hub, c_parts)

    # =========================================================================
    # VARIANT 4: OHT_Rail_Junction (Track Diverge/Merge Switch Module)
    # =========================================================================
    v4_root = fl.make_root("OHT_Rail_Junction", loc=(1.2, 0.0, 0.0))
    j_main = fl.add_bevel_box(
        "RailJunction_Frame",
        size=(1.45, 3.2, 0.14),
        loc=(0.0, 0.0, 0.18),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v4_root,
    )
    j_parts = []
    for jy in (-1.2, 0.0, 1.2):
        jh = fl.add_bevel_cylinder(
            f"r4_hang_{jy}",
            radius=0.035,
            depth=0.55,
            vertices=12,
            loc=(0.0, jy, 0.48),
            bevel_width=0.005,
            mat=pal["chrome"],
            parent=v4_root,
        )
        j_parts.append(jh)
    spur = fl.add_bevel_box(
        "r4_spur",
        size=(0.72, 1.8, 0.14),
        loc=(0.55, 0.45, 0.18),
        rot=(0.0, 0.0, -0.42),
        bevel_width=0.012,
        mat=pal["silver"],
        parent=v4_root,
    )
    sig_box = fl.add_bevel_box(
        "r4_sig",
        size=(0.24, 0.24, 0.18),
        loc=(-0.55, -0.8, 0.30),
        bevel_width=0.01,
        mat=pal["emit_green"],
        parent=v4_root,
    )
    j_parts.extend([spur, sig_box])
    fl.merge_objects_into(j_main, j_parts)

    # Separate Moving Switch Tongue (`SwitchRailBlade`) with pivot at switch hinge
    fl.add_bevel_box(
        "SwitchRailBlade",
        size=(0.14, 1.25, 0.12),
        loc=(0.0, -0.65, 0.12),
        rot=(0.0, 0.0, -0.18),
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=v4_root,
        pivot_offset=(0.0, 0.625, 0.0),
    )

    # =========================================================================
    # VARIANT 5: Stocker_Tower_Large (Tall Automated FOUP Buffer Stocker Tower)
    # =========================================================================
    v5_root = fl.make_root("Stocker_Tower_Large", loc=(6.2, 0.0, 0.0))
    stk_body = fl.add_bevel_box(
        "Stocker_MainFrame",
        size=(3.6, 2.2, 0.22),
        loc=(0.0, 0.0, 0.11),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v5_root,
    )
    s5_parts = []
    # Rear and side cleanroom enclosure walls (4.2m tall reaching OHT rail height!)
    s_back = fl.add_bevel_box(
        "s5_back",
        size=(3.55, 0.22, 4.1),
        loc=(0.0, 0.98, 2.25),
        bevel_width=0.03,
        mat=pal["white"],
        parent=v5_root,
    )
    s_left = fl.add_bevel_box(
        "s5_left",
        size=(0.22, 2.15, 4.1),
        loc=(-1.66, 0.0, 2.25),
        bevel_width=0.03,
        mat=pal["white"],
        parent=v5_root,
    )
    s_right = fl.add_bevel_box(
        "s5_right",
        size=(0.22, 2.15, 4.1),
        loc=(1.66, 0.0, 2.25),
        bevel_width=0.03,
        mat=pal["white"],
        parent=v5_root,
    )
    s_crown = fl.add_bevel_box(
        "s5_crown",
        size=(3.64, 2.24, 0.28),
        loc=(0.0, 0.0, 4.35),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v5_root,
    )
    # Front clear viewing window showing internal FOUP shelf matrix
    s_glass = fl.add_bevel_box(
        "s5_glass",
        size=(3.15, 0.08, 3.25),
        loc=(0.0, -0.98, 2.45),
        bevel_width=0.015,
        mat=pal["glass_clear"],
        parent=v5_root,
    )
    s5_parts.extend([s_back, s_left, s_right, s_crown, s_glass])

    # Internal honeycomb shelf matrix + buffered FOUP pods on rear rack
    for row_z in (0.95, 1.65, 2.35, 3.05, 3.75):
        shelf = fl.add_bevel_box(
            f"s5_shelf_{row_z}",
            size=(3.1, 0.52, 0.05),
            loc=(0.0, 0.55, row_z),
            bevel_width=0.008,
            mat=pal["silver"],
            parent=v5_root,
        )
        s5_parts.append(shelf)
        for col_idx, col_x in enumerate((-1.1, -0.38, 0.38, 1.1)):
            if (int(row_z * 10) + col_idx) % 3 != 0:
                vtype = "hot" if (col_idx == 1 and row_z > 2.0) else ("eng" if col_idx == 3 else "standard")
                pod = fl.create_foup_pod(
                    f"s5_pod_{row_z}_{col_idx}",
                    loc=(col_x, 0.52, row_z + 0.03),
                    parent=v5_root,
                    pal=pal,
                    variant=vtype,
                    separate_door=False,
                )
                s5_parts.append(pod)

    s5_parts.append(fl.create_signal_tower("s5_tower", loc=(1.48, -0.88, 4.50), parent=v5_root, pal=pal, state="running"))
    s5_parts.append(fl.add_operator_console("s5_op", loc=(-1.45, -1.15, 0.95), parent=v5_root, pal=pal))

    # Ground-level manual/AGV load port (`GroundPortDoor`)
    ped, _ = fl.create_load_port(
        "s5_ground_lp",
        loc=(0.85, -1.28, 0.0),
        parent=v5_root,
        pal=pal,
        door_name="GroundPortDoor",
        foup_variant="standard",
    )
    s5_parts.append(ped)
    fl.merge_objects_into(stk_body, s5_parts)

    # Separate Moving Parts for Stocker Tower:
    # 1. StockerCraneX (vertical mast gantry sliding along X inside stocker)
    crane_x = fl.add_bevel_box(
        "StockerCraneX",
        size=(0.24, 0.24, 3.85),
        loc=(-0.25, -0.15, 2.15),
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=v5_root,
    )
    # 2. StockerCraneZ (vertical elevator carriage sliding along Z on StockerCraneX)
    crane_z = fl.add_bevel_box(
        "StockerCraneZ",
        size=(0.48, 0.42, 0.22),
        loc=(0.0, 0.0, 0.15),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=crane_x,
    )
    # 3. StockerFork (telescoping FOUP fork with carried Hot Lot FOUP, parented to StockerCraneZ)
    fork = fl.add_bevel_box(
        "StockerFork",
        size=(0.38, 0.48, 0.06),
        loc=(0.0, 0.12, 0.12),
        bevel_width=0.008,
        mat=pal["chrome"],
        parent=crane_z,
    )
    f_pod = fl.create_foup_pod(
        "s5_crane_pod",
        loc=(0.0, 0.12, 0.15),
        parent=crane_z,
        pal=pal,
        variant="hot",
        separate_door=False,
    )
    fl.merge_objects_into(fork, [f_pod])

    # 4. OHTPortShutter (upper OHT handoff port shutter at Z=3.85)
    fl.add_bevel_box(
        "OHTPortShutter",
        size=(0.68, 0.62, 0.06),
        loc=(-0.85, -0.35, 4.48),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v5_root,
    )

    # =========================================================================
    # VARIANT 6: ReticleStocker_Pod (EUV / DUV Photomask Reticle Library Stocker)
    # =========================================================================
    v6_root = fl.make_root("ReticleStocker_Pod", loc=(11.2, 0.0, 0.0))
    ret_body = fl.add_bevel_box(
        "ReticleStocker_Cabinet",
        size=(2.1, 1.9, 2.55),
        loc=(0.0, 0.0, 1.275),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v6_root,
    )
    r6_parts = []
    r6_crown = fl.add_bevel_box(
        "r6_crown",
        size=(2.16, 1.96, 0.22),
        loc=(0.0, 0.0, 2.58),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v6_root,
    )
    r6_win = fl.add_bevel_box(
        "r6_win",
        size=(1.45, 0.08, 1.55),
        loc=(0.0, -0.94, 1.55),
        bevel_width=0.012,
        mat=pal["glass_yellow_litho"],
        parent=v6_root,
    )
    r6_parts.extend([r6_crown, r6_win])
    r6_parts.append(fl.create_signal_tower("r6_tower", loc=(0.82, -0.75, 2.70), parent=v6_root, pal=pal, state="running"))
    fl.merge_objects_into(ret_body, r6_parts)

    # Separate Rotary Reticle Storage Carousel (`ReticleCarousel`) & Load Door (`ReticleDoor`)
    carousel = fl.add_bevel_cylinder(
        "ReticleCarousel",
        radius=0.62,
        depth=1.28,
        vertices=16,
        loc=(0.0, 0.05, 1.55),
        bevel_width=0.02,
        mat=pal["chrome"],
        parent=v6_root,
    )
    fl.add_bevel_box(
        "ReticleDoor",
        size=(0.55, 0.06, 0.42),
        loc=(0.0, -0.96, 0.85),
        bevel_width=0.01,
        mat=pal["silver"],
        parent=v6_root,
        pivot_offset=(0.0, 0.0, 0.21),
    )

    fl.export_glb("oht_network.glb")


def build_foup_wafer_props():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANTS 1..3: FOUP_Standard, FOUP_HotLot, FOUP_Engineering
    # =========================================================================
    f1 = fl.make_root("FOUP_Standard", loc=(-6.0, 0.0, 0.0))
    fl.create_foup_pod("FOUP_Std_Body", loc=(0.0, 0.0, 0.0), parent=f1, pal=pal, variant="standard", separate_door=True, door_name="FOUPDoor_Std")

    f2 = fl.make_root("FOUP_HotLot", loc=(-4.2, 0.0, 0.0))
    fl.create_foup_pod("FOUP_Hot_Body", loc=(0.0, 0.0, 0.0), parent=f2, pal=pal, variant="hot", separate_door=True, door_name="FOUPDoor_Hot")

    f3 = fl.make_root("FOUP_Engineering", loc=(-2.4, 0.0, 0.0))
    fl.create_foup_pod("FOUP_Eng_Body", loc=(0.0, 0.0, 0.0), parent=f3, pal=pal, variant="eng", separate_door=True, door_name="FOUPDoor_Eng")

    # =========================================================================
    # VARIANT 4: Wafer_300mm_Display (Patterned 300mm Silicon Wafer + Carrier Ring)
    # =========================================================================
    f4 = fl.make_root("Wafer_300mm_Display", loc=(-0.6, 0.0, 0.0))
    stand = fl.add_bevel_box(
        "Wafer_Stand",
        size=(0.48, 0.36, 0.08),
        loc=(0.0, 0.0, 0.04),
        bevel_width=0.012,
        mat=pal["slate"],
        parent=f4,
    )
    frame_ring = fl.add_bevel_cylinder(
        "Wafer_CarrierRing",
        radius=0.22,
        depth=0.025,
        vertices=32,
        loc=(0.0, 0.0, 0.28),
        rot=(math.pi * 0.38, 0.0, 0.0),
        bevel_width=0.004,
        mat=pal["silver"],
        parent=f4,
    )
    wafer_disc = fl.add_bevel_cylinder(
        "Wafer_Silicon300mm",
        radius=0.18,
        depth=0.032,
        vertices=32,
        loc=(0.0, 0.0, 0.28),
        rot=(math.pi * 0.38, 0.0, 0.0),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=f4,
    )
    fl.merge_objects_into(stand, [frame_ring, wafer_disc])

    # =========================================================================
    # VARIANT 5: AGV_PodTransporter (Autonomous Cleanroom Ground Robot + Arm)
    # =========================================================================
    f5 = fl.make_root("AGV_PodTransporter", loc=(2.0, 0.0, 0.0))
    agv_body = fl.add_bevel_box(
        "AGV_Chassis",
        size=(0.95, 1.38, 0.46),
        loc=(0.0, 0.0, 0.34),
        bevel_width=0.04,
        mat=pal["white"],
        parent=f5,
    )
    a5_parts = []
    agv_band = fl.add_bevel_box(
        "agv_band",
        size=(0.98, 1.40, 0.10),
        loc=(0.0, 0.0, 0.42),
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=f5,
    )
    agv_lidar = fl.add_bevel_cylinder(
        "agv_lidar",
        radius=0.09,
        depth=0.08,
        vertices=16,
        loc=(0.0, -0.66, 0.22),
        bevel_width=0.008,
        mat=pal["emit_cyan"],
        parent=f5,
    )
    # Rear FOUP buffer cradle with carried Standard FOUP
    agv_foup = fl.create_foup_pod(
        "agv_foup",
        loc=(0.0, 0.34, 0.58),
        parent=f5,
        pal=pal,
        variant="standard",
        separate_door=False,
    )
    a5_parts.extend([agv_band, agv_lidar, agv_foup])
    fl.merge_objects_into(agv_body, a5_parts)

    # 4 Separate Wheels (`AGV_Wheel_FL`, `AGV_Wheel_FR`, `AGV_Wheel_RL`, `AGV_Wheel_RR`)
    for wname, wloc in [
        ("AGV_Wheel_FL", (-0.46, -0.44, 0.16)),
        ("AGV_Wheel_FR", (0.46, -0.44, 0.16)),
        ("AGV_Wheel_RL", (-0.46, 0.44, 0.16)),
        ("AGV_Wheel_RR", (0.46, 0.44, 0.16)),
    ]:
        fl.create_wheel(wname, loc=wloc, radius=0.16, width=0.09, parent=f5, pal=pal, axis="X")

    # Separate Articulated 6-Axis Robot Arm on front of AGV (`AGVTurret` -> `AGVArmLower` -> `AGVArmUpper`)
    turret = fl.add_bevel_cylinder(
        "AGVTurret",
        radius=0.16,
        depth=0.18,
        vertices=18,
        loc=(0.0, -0.32, 0.65),
        bevel_width=0.015,
        mat=pal["slate"],
        parent=f5,
    )
    arm_low = fl.add_bevel_box(
        "AGVArmLower",
        size=(0.12, 0.12, 0.46),
        loc=(0.0, 0.0, 0.08),
        rot=(0.25, 0.0, 0.0),
        bevel_width=0.012,
        mat=pal["chrome"],
        parent=turret,
        pivot_offset=(0.0, 0.0, 0.22),
    )
    arm_up = fl.add_bevel_box(
        "AGVArmUpper",
        size=(0.10, 0.42, 0.10),
        loc=(0.0, 0.0, 0.42),
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=arm_low,
        pivot_offset=(0.0, -0.18, 0.0),
    )

    # =========================================================================
    # VARIANT 6: Manual_PGV_Cart (Cleanroom Stainless FOUP Push-Cart)
    # =========================================================================
    f6 = fl.make_root("Manual_PGV_Cart", loc=(4.6, 0.0, 0.0))
    cart_body = fl.add_bevel_box(
        "PGV_Frame",
        size=(0.74, 1.05, 0.12),
        loc=(0.0, 0.0, 0.24),
        bevel_width=0.02,
        mat=pal["chrome"],
        parent=f6,
    )
    c6_parts = []
    # Vertical push-handle & top FOUP docking deck
    deck6 = fl.add_bevel_box(
        "pgv_deck",
        size=(0.68, 0.78, 0.56),
        loc=(0.0, -0.08, 0.58),
        bevel_width=0.025,
        mat=pal["white"],
        parent=f6,
    )
    handle_bar = fl.add_bevel_box(
        "pgv_handle",
        size=(0.64, 0.18, 0.45),
        loc=(0.0, 0.42, 0.92),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=f6,
    )
    pgv_foup = fl.create_foup_pod(
        "pgv_foup",
        loc=(0.0, -0.08, 0.86),
        parent=f6,
        pal=pal,
        variant="hot",
        separate_door=False,
    )
    c6_parts.extend([deck6, handle_bar, pgv_foup])
    fl.merge_objects_into(cart_body, c6_parts)

    for wname, wloc in [
        ("PGV_Wheel_FL", (-0.34, -0.38, 0.12)),
        ("PGV_Wheel_FR", (0.34, -0.38, 0.12)),
        ("PGV_Wheel_RL", (-0.34, 0.38, 0.12)),
        ("PGV_Wheel_RR", (0.34, 0.38, 0.12)),
    ]:
        fl.create_wheel(wname, loc=wloc, radius=0.12, width=0.06, parent=f6, pal=pal, axis="X")

    fl.add_bevel_box(
        "DockLatch",
        size=(0.24, 0.18, 0.06),
        loc=(0.0, -0.48, 0.82),
        bevel_width=0.008,
        mat=pal["brand_blue"],
        parent=f6,
        pivot_offset=(0.0, -0.08, 0.0),
    )

    fl.export_glb("foup_wafer_props.glb")


def build_subfab_equipment():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: SubFab_DryPumpSkid (Multi-Stage Roots Vacuum Dry Pump Skid)
    # =========================================================================
    s1_root = fl.make_root("SubFab_DryPumpSkid", loc=(-8.0, 0.0, 0.0))
    skid1 = fl.add_bevel_box(
        "DryPump_Skid",
        size=(1.6, 2.2, 0.16),
        loc=(0.0, 0.0, 0.08),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=s1_root,
    )
    p1_parts = []
    # Twin horizontal cast-metal vacuum pump bodies + vertical stainless foreline bellows
    for px in (-0.38, 0.38):
        pbody = fl.add_bevel_cylinder(
            f"dp_body_{px}",
            radius=0.28,
            depth=1.45,
            vertices=18,
            loc=(px, 0.05, 0.52),
            rot=(math.pi / 2.0, 0.0, 0.0),
            bevel_width=0.02,
            mat=pal["silver"],
            parent=s1_root,
        )
        riser = fl.add_bevel_cylinder(
            f"dp_riser_{px}",
            radius=0.14,
            depth=1.35,
            vertices=16,
            loc=(px, -0.35, 1.38),
            bevel_width=0.015,
            mat=pal["chrome"],
            parent=s1_root,
        )
        p1_parts.extend([pbody, riser])
    ctrl_box = fl.add_bevel_box(
        "dp_ctrl",
        size=(0.55, 0.38, 0.95),
        loc=(0.0, -0.82, 0.64),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=s1_root,
    )
    p1_parts.append(ctrl_box)
    fl.merge_objects_into(skid1, p1_parts)

    # Separate rotating isolation valve handwheel (`ValveHandle`) with connecting stem
    valve = fl.add_bevel_cylinder(
        "ValveHandle",
        radius=0.16,
        depth=0.04,
        vertices=14,
        loc=(-0.38, -0.56, 1.55),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.008,
        mat=pal["hot_lot"],
        parent=s1_root,
    )
    v_stem = fl.add_bevel_cylinder(
        "valve_stem",
        radius=0.035,
        depth=0.18,
        vertices=10,
        loc=(-0.38, -0.46, 1.55),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.004,
        mat=pal["chrome"],
        parent=s1_root,
    )
    fl.merge_objects_into(valve, [v_stem])

    # =========================================================================
    # VARIANT 2: SubFab_PointScrubber (POU Thermal/Wet Abatement Scrubber)
    # =========================================================================
    s2_root = fl.make_root("SubFab_PointScrubber", loc=(-4.0, 0.0, 0.0))
    sc_base = fl.add_bevel_box(
        "Scrubber_Cabinet",
        size=(1.55, 1.65, 2.25),
        loc=(0.0, 0.0, 1.125),
        bevel_width=0.035,
        mat=pal["white"],
        parent=s2_root,
    )
    p2_parts = []
    # Cylindrical combustion / wet-wash reaction column + glowing flame sight-glass
    col_rx = fl.add_bevel_cylinder(
        "sc_rx_col",
        radius=0.42,
        depth=2.55,
        vertices=20,
        loc=(-0.22, -0.25, 1.35),
        bevel_width=0.02,
        mat=pal["silver"],
        parent=s2_root,
    )
    flame_port = fl.add_bevel_cylinder(
        "sc_flame",
        radius=0.16,
        depth=0.12,
        vertices=16,
        loc=(-0.22, -0.66, 1.75),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.01,
        mat=pal["emit_amber"],
        parent=s2_root,
    )
    sc_band = fl.add_bevel_box(
        "sc_band",
        size=(1.59, 1.69, 0.20),
        loc=(0.0, 0.0, 2.15),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=s2_root,
    )
    p2_parts.extend([col_rx, flame_port, sc_band])
    p2_parts.append(fl.create_signal_tower("sc_sig", loc=(0.55, -0.62, 2.28), parent=s2_root, pal=pal, state="running"))
    fl.merge_objects_into(sc_base, p2_parts)

    fl.add_bevel_cylinder(
        "ScrubberFan",
        radius=0.28,
        depth=0.16,
        vertices=16,
        loc=(0.38, 0.25, 2.34),
        bevel_width=0.015,
        mat=pal["slate"],
        parent=s2_root,
    )

    # =========================================================================
    # VARIANT 3: SubFab_ProcessChiller (Dual-Loop Process Chiller / Heat Exchanger)
    # =========================================================================
    s3_root = fl.make_root("SubFab_ProcessChiller", loc=(0.0, 0.0, 0.0))
    ch_body = fl.add_bevel_box(
        "Chiller_Unit",
        size=(1.45, 1.95, 1.85),
        loc=(0.0, 0.0, 0.925),
        bevel_width=0.035,
        mat=pal["white"],
        parent=s3_root,
    )
    p3_parts = []
    ch_band = fl.add_bevel_box(
        "ch_band",
        size=(1.49, 1.99, 0.18),
        loc=(0.0, 0.0, 1.76),
        bevel_width=0.015,
        mat=pal["upw_teal"],
        parent=s3_root,
    )
    # Top glycol supply/return insulated pipes
    for px in (-0.35, 0.35):
        gpipe = fl.add_bevel_cylinder(
            f"ch_pipe_{px}",
            radius=0.11,
            depth=0.65,
            vertices=16,
            loc=(px, 0.25, 2.15),
            bevel_width=0.01,
            mat=pal["upw_teal"] if px < 0 else pal["brand_blue"],
            parent=s3_root,
        )
        p3_parts.append(gpipe)
    p3_parts.append(ch_band)
    p3_parts.append(fl.add_vent_grille("ch_vent", (0.0, -0.98, 0.85), size=(1.1, 0.04, 0.85), slats=7, axis="Y", parent=s3_root, pal=pal))
    fl.merge_objects_into(ch_body, p3_parts)

    fl.add_bevel_cylinder(
        "PumpMotorRotor",
        radius=0.22,
        depth=0.35,
        vertices=16,
        loc=(0.0, -0.45, 2.02),
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=s3_root,
    )

    # =========================================================================
    # VARIANT 4: SubFab_GasCabinet_VMB (Specialty Gas Cabinet with Dual Cylinders)
    # =========================================================================
    s4_root = fl.make_root("SubFab_GasCabinet_VMB", loc=(4.0, 0.0, 0.0))
    gc_body = fl.add_bevel_box(
        "GasCabinet_Enclosure",
        size=(1.35, 0.95, 2.25),
        loc=(0.0, 0.0, 1.125),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=s4_root,
    )
    p4_parts = []
    # Internal high-purity specialty gas cylinders (SiH4, NF3, WF6)
    for gx, gmat in ((-0.32, pal["hot_lot"]), (0.32, pal["brand_blue"])):
        cyl = fl.add_bevel_cylinder(
            f"gc_cyl_{gx}",
            radius=0.18,
            depth=1.45,
            vertices=18,
            loc=(gx, 0.05, 0.85),
            bevel_width=0.02,
            mat=gmat,
            parent=s4_root,
        )
        p4_parts.append(cyl)
    exhaust_stack = fl.add_bevel_cylinder(
        "gc_stack",
        radius=0.14,
        depth=0.48,
        vertices=16,
        loc=(0.0, 0.0, 2.48),
        bevel_width=0.01,
        mat=pal["silver"],
        parent=s4_root,
    )
    p4_parts.append(exhaust_stack)
    p4_parts.append(fl.create_signal_tower("gc_sig", loc=(0.45, -0.32, 2.28), parent=s4_root, pal=pal, state="running"))
    fl.merge_objects_into(gc_body, p4_parts)

    # Separate Hinged Gas Cabinet Doors (`GasDoor_L`, `GasDoor_R`) with pivots at outer hinges
    fl.add_bevel_box(
        "GasDoor_L",
        size=(0.62, 0.05, 1.85),
        loc=(-0.64, -0.48, 0.20),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=s4_root,
        pivot_offset=(0.31, 0.0, 0.925),
    )
    fl.add_bevel_box(
        "GasDoor_R",
        size=(0.62, 0.05, 1.85),
        loc=(0.64, -0.48, 0.20),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=s4_root,
        pivot_offset=(-0.31, 0.0, 0.925),
    )

    # =========================================================================
    # VARIANT 5: SubFab_Slurry_CDS (Chemical & CMP Slurry Bulk Dispense System)
    # =========================================================================
    s5_root = fl.make_root("SubFab_Slurry_CDS", loc=(8.0, 0.0, 0.0))
    cds_base = fl.add_bevel_box(
        "SlurryCDS_Sump",
        size=(2.1, 1.45, 0.35),
        loc=(0.0, 0.0, 0.175),
        bevel_width=0.025,
        mat=pal["slate"],
        parent=s5_root,
    )
    p5_parts = []
    cds_frame = fl.add_bevel_box(
        "cds_frame",
        size=(2.0, 0.45, 2.05),
        loc=(0.0, 0.45, 1.20),
        bevel_width=0.03,
        mat=pal["white"],
        parent=s5_root,
    )
    # Twin cylindrical translucent PFA chemical/slurry day-tanks
    for tx, tmat in ((-0.52, pal["upw_teal"]), (0.52, pal["white"])):
        tank = fl.add_bevel_cylinder(
            f"cds_tank_{tx}",
            radius=0.38,
            depth=1.35,
            vertices=20,
            loc=(tx, -0.15, 1.02),
            bevel_width=0.025,
            mat=tmat,
            parent=s5_root,
        )
        p5_parts.append(tank)
    p5_parts.append(cds_frame)
    p5_parts.append(fl.create_signal_tower("cds_sig", loc=(0.82, 0.45, 2.25), parent=s5_root, pal=pal, state="running"))
    fl.merge_objects_into(cds_base, p5_parts)

    # Separate rotating slurry mixer agitator (`StirrerShaft`)
    fl.add_bevel_cylinder(
        "StirrerShaft",
        radius=0.14,
        depth=0.32,
        vertices=16,
        loc=(-0.52, -0.15, 1.82),
        bevel_width=0.012,
        mat=pal["brand_blue"],
        parent=s5_root,
    )

    fl.export_glb("subfab_equipment.glb")


if __name__ == "__main__":
    build_oht_network()
    build_foup_wafer_props()
    build_subfab_equipment()
