import bpy
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import argon_fab_lib as fl


def build_implant_furnace_tools():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: IonImplanter_HighCurrent (High-Current Beamline Ion Implanter)
    # =========================================================================
    v1_root = fl.make_root("IonImplanter_HighCurrent", loc=(-7.5, 0.0, 0.0))
    body1 = fl.add_bevel_box(
        "HCImplant_Enclosure",
        size=(2.8, 4.6, 0.22),
        loc=(0.0, 0.2, 0.11),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v1_root,
    )
    parts1 = []
    # Rear High-Voltage Terminal Enclosure (shielded with rounded corners & HV warning stripes)
    hv_box = fl.add_bevel_box(
        "hc_hv_box",
        size=(2.6, 2.2, 2.45),
        loc=(0.0, 1.35, 1.44),
        bevel_width=0.06,
        mat=pal["white"],
        parent=v1_root,
    )
    # Analyzer Magnet & Beamline Housing (central section with dark viewport)
    beam_box = fl.add_bevel_box(
        "hc_beam_box",
        size=(2.4, 1.6, 2.15),
        loc=(0.0, -0.35, 1.28),
        bevel_width=0.04,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    # Internal visible curved magnetic analyzer sector tube & copper coils
    mag_sector = fl.add_bevel_cylinder(
        "hc_mag_coil",
        radius=0.58,
        depth=0.65,
        vertices=20,
        loc=(0.0, 0.25, 1.38),
        bevel_width=0.02,
        mat=pal["copper"],
        parent=v1_root,
    )
    beam_win = fl.add_bevel_box(
        "hc_beam_win",
        size=(0.08, 1.25, 0.85),
        loc=(-1.20, -0.25, 1.45),
        bevel_width=0.012,
        mat=pal["glass_dark"],
        parent=v1_root,
    )
    # Front End-Station & EFEM Wafer Handler
    efem1 = fl.add_bevel_box(
        "hc_efem",
        size=(2.6, 0.85, 2.20),
        loc=(0.0, -1.55, 1.30),
        bevel_width=0.035,
        mat=pal["white"],
        parent=v1_root,
    )
    crown1 = fl.add_bevel_box(
        "hc_crown",
        size=(2.66, 4.45, 0.22),
        loc=(0.0, 0.20, 2.56),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    parts1.extend([hv_box, beam_box, mag_sector, beam_win, efem1, crown1])
    parts1.append(fl.add_vent_grille("hc_vent1", (-1.31, 1.35, 1.1), size=(0.05, 1.2, 0.7), slats=6, axis="X", parent=v1_root, pal=pal))
    parts1.append(fl.add_signage_plate("hc_sign", (0.0, -1.98, 2.15), size=(1.1, 0.04, 0.22), parent=v1_root, pal=pal, accent="yellow"))
    parts1.append(fl.create_signal_tower("hc_tower", loc=(1.08, -1.78, 2.68), parent=v1_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.62, 0.62), start=1):
        ped, _ = fl.create_load_port(
            f"hc_lp{idx}",
            loc=(lx, -2.22, 0.0),
            parent=v1_root,
            pal=pal,
            door_name=f"HC_LoadPortDoor_0{idx}",
            foup_variant="hot" if idx == 1 else "standard",
        )
        parts1.append(ped)

    fl.merge_objects_into(body1, parts1)

    # Separate Moving Parts for High-Current Implanter:
    # 1. ImplantEndStationWheel (pendulum wafer scan wheel visible inside front window)
    wheel = fl.add_bevel_cylinder(
        "ImplantEndStationWheel",
        radius=0.38,
        depth=0.12,
        vertices=20,
        loc=(0.0, -0.75, 1.42),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v1_root,
    )
    w_imp = fl.add_bevel_cylinder(
        "hc_wafer",
        radius=0.15,
        depth=0.015,
        vertices=20,
        loc=(0.0, -0.75, 1.42),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=v1_root,
        pivot_offset=(0.0, 0.0, 0.07),
    )
    fl.merge_objects_into(wheel, [w_imp])

    # 2. SourceAccessDoor (hinged HV ion source maintenance door at rear)
    fl.add_bevel_box(
        "SourceAccessDoor",
        size=(1.35, 0.08, 1.75),
        loc=(-0.675, 2.48, 0.45),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v1_root,
        pivot_offset=(0.675, 0.0, 0.875),
    )

    # =========================================================================
    # VARIANT 2: IonImplanter_MediumCurrent (Medium-Current Linear Implanter)
    # =========================================================================
    v2_root = fl.make_root("IonImplanter_MediumCurrent", loc=(-2.5, 0.0, 0.0))
    body2 = fl.add_bevel_box(
        "MCImplant_Enclosure",
        size=(2.5, 4.8, 0.22),
        loc=(0.0, 0.2, 0.11),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v2_root,
    )
    parts2 = []
    mc_cab = fl.add_bevel_box(
        "mc_cab",
        size=(2.35, 3.8, 2.25),
        loc=(0.0, 0.45, 1.34),
        bevel_width=0.045,
        mat=pal["white"],
        parent=v2_root,
    )
    mc_crown = fl.add_bevel_box(
        "mc_crown",
        size=(2.42, 3.86, 0.20),
        loc=(0.0, 0.45, 2.42),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    # Linear acceleration tube cryo-pump cylinders on side
    for cy in (-0.4, 0.5, 1.4):
        cryo = fl.add_bevel_cylinder(
            f"mc_cryo_{cy}",
            radius=0.22,
            depth=0.55,
            vertices=16,
            loc=(1.05, cy, 1.15),
            rot=(0.0, math.pi / 2.0, 0.0),
            bevel_width=0.015,
            mat=pal["chrome"],
            parent=v2_root,
        )
        parts2.append(cryo)
    parts2.extend([mc_cab, mc_crown])
    parts2.append(fl.create_signal_tower("mc_tower", loc=(-0.95, -1.32, 2.52), parent=v2_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.72, 0.0, 0.72), start=1):
        ped, _ = fl.create_load_port(
            f"mc_lp{idx}",
            loc=(lx, -1.72, 0.0),
            parent=v2_root,
            pal=pal,
            door_name=f"MC_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 2 else None,
        )
        parts2.append(ped)

    fl.merge_objects_into(body2, parts2)

    fl.add_bevel_box(
        "EFEMRobotArm",
        size=(0.35, 0.52, 0.14),
        loc=(0.0, -1.15, 1.25),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v2_root,
    )

    # =========================================================================
    # VARIANT 3: VerticalFurnace_Diffusion (4-Tube Vertical Diffusion / LPCVD)
    # =========================================================================
    v3_root = fl.make_root("VerticalFurnace_Diffusion", loc=(2.5, 0.0, 0.0))
    body3 = fl.add_bevel_box(
        "VFurnace_Enclosure",
        size=(2.4, 3.2, 0.22),
        loc=(0.0, 0.0, 0.11),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v3_root,
    )
    parts3 = []
    # Tall vertical furnace tower (3.6m high!)
    tower3 = fl.add_bevel_box(
        "vf_tower",
        size=(2.3, 2.4, 3.35),
        loc=(0.0, 0.25, 1.88),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    crown3 = fl.add_bevel_box(
        "vf_crown",
        size=(2.36, 2.46, 0.24),
        loc=(0.0, 0.25, 3.48),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v3_root,
    )
    # Glowing orange/amber vertical quartz furnace tube viewport windows
    for tx in (-0.55, 0.55):
        qtube = fl.add_bevel_cylinder(
            f"vf_qtube_{tx}",
            radius=0.34,
            depth=1.45,
            vertices=20,
            loc=(tx, -0.68, 2.55),
            bevel_width=0.02,
            mat=pal["emit_amber"],
            parent=v3_root,
        )
        win_v = fl.add_bevel_box(
            f"vf_win_{tx}",
            size=(0.56, 0.08, 1.55),
            loc=(tx, -0.95, 2.55),
            bevel_width=0.01,
            mat=pal["glass_dark"],
            parent=v3_root,
        )
        # Top heat exhaust chimney stacks
        chim = fl.add_bevel_cylinder(
            f"vf_chim_{tx}",
            radius=0.18,
            depth=0.45,
            vertices=16,
            loc=(tx, 0.45, 3.82),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=v3_root,
        )
        parts3.extend([qtube, win_v, chim])

    parts3.extend([tower3, crown3])
    parts3.append(fl.create_signal_tower("vf_sig", loc=(0.92, -0.82, 3.60), parent=v3_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.55, 0.55), start=1):
        ped, _ = fl.create_load_port(
            f"vf_lp{idx}",
            loc=(lx, -1.25, 0.0),
            parent=v3_root,
            pal=pal,
            door_name=f"VF_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 1 else "eng",
        )
        parts3.append(ped)

    fl.merge_objects_into(body3, parts3)

    # Separate Moving Parts for Vertical Furnace:
    # 1. QuartzBoatElevator (vertical wafer boat holding 50 wafers moving up into tube)
    boat = fl.add_bevel_cylinder(
        "QuartzBoatElevator",
        radius=0.20,
        depth=0.72,
        vertices=20,
        loc=(-0.55, -0.68, 1.45),
        bevel_width=0.01,
        mat=pal["wafer"],
        parent=v3_root,
    )
    # 2. WaferBoatLoader (rotary 5-wafer pitch transfer arm)
    fl.add_bevel_box(
        "WaferBoatLoader",
        size=(0.38, 0.42, 0.12),
        loc=(0.0, -0.45, 1.22),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v3_root,
    )

    # =========================================================================
    # VARIANT 4: ThermalTool_RTA (Rapid Thermal Anneal / Spike Anneal Tool)
    # =========================================================================
    v4_root = fl.make_root("ThermalTool_RTA", loc=(7.2, 0.0, 0.0))
    body4 = fl.add_bevel_box(
        "RTA_Enclosure",
        size=(2.1, 2.8, 0.20),
        loc=(0.0, 0.0, 0.10),
        bevel_width=0.025,
        mat=pal["slate"],
        parent=v4_root,
    )
    parts4 = []
    cab4 = fl.add_bevel_box(
        "rta_cab",
        size=(2.0, 2.1, 2.15),
        loc=(0.0, 0.2, 1.25),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v4_root,
    )
    crown4 = fl.add_bevel_box(
        "rta_crown",
        size=(2.06, 2.16, 0.20),
        loc=(0.0, 0.2, 2.28),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v4_root,
    )
    # Glowing circular halogen lamp dome on top of RTA chamber
    lamp_dome = fl.add_bevel_cylinder(
        "rta_dome",
        radius=0.58,
        depth=0.28,
        vertices=24,
        loc=(0.0, 0.35, 2.48),
        bevel_width=0.02,
        mat=pal["copper"],
        parent=v4_root,
    )
    lamp_glow = fl.add_bevel_cylinder(
        "rta_glow",
        radius=0.44,
        depth=0.08,
        vertices=20,
        loc=(0.0, 0.35, 2.62),
        bevel_width=0.01,
        mat=pal["emit_amber"],
        parent=v4_root,
    )
    parts4.extend([cab4, crown4, lamp_dome, lamp_glow])
    parts4.append(fl.create_signal_tower("rta_sig", loc=(0.78, -0.68, 2.38), parent=v4_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.48, 0.48), start=1):
        ped, _ = fl.create_load_port(
            f"rta_lp{idx}",
            loc=(lx, -1.12, 0.0),
            parent=v4_root,
            pal=pal,
            door_name=f"RTA_LoadPortDoor_0{idx}",
            foup_variant="hot" if idx == 1 else None,
        )
        parts4.append(ped)

    fl.merge_objects_into(body4, parts4)

    fl.add_bevel_cylinder(
        "RTAWaferRing",
        radius=0.22,
        depth=0.05,
        vertices=20,
        loc=(0.0, 0.35, 1.45),
        bevel_width=0.005,
        mat=pal["wafer"],
        parent=v4_root,
    )

    fl.export_glb("implant_furnace_tools.glb")


def build_cmp_wet_tools():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: CMP_Polisher_3Platen (300mm Chemical Mechanical Planarization)
    # =========================================================================
    v1_root = fl.make_root("CMP_Polisher_3Platen", loc=(-5.8, 0.0, 0.0))
    body1 = fl.add_bevel_box(
        "CMP_MainChassis",
        size=(2.9, 3.8, 1.18),
        loc=(0.0, 0.2, 0.59),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    parts1 = []
    deck_top = fl.add_bevel_box(
        "cmp_deck",
        size=(2.75, 2.75, 0.08),
        loc=(0.0, 0.45, 1.20),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v1_root,
    )
    rear_cab = fl.add_bevel_box(
        "cmp_rear_cab",
        size=(2.85, 0.85, 1.15),
        loc=(0.0, 1.65, 1.72),
        bevel_width=0.03,
        mat=pal["white"],
        parent=v1_root,
    )
    crown1 = fl.add_bevel_box(
        "cmp_crown",
        size=(2.90, 0.90, 0.22),
        loc=(0.0, 1.65, 2.32),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    parts1.extend([deck_top, rear_cab, crown1])
    parts1.append(fl.create_signal_tower("cmp_tower", loc=(1.18, 1.45, 2.44), parent=v1_root, pal=pal, state="running"))
    parts1.append(fl.add_operator_console("cmp_op", loc=(-1.48, -1.15, 0.95), parent=v1_root, pal=pal))

    for idx, lx in enumerate((-0.82, 0.0, 0.82), start=1):
        ped, _ = fl.create_load_port(
            f"cmp_lp{idx}",
            loc=(lx, -1.95, 0.0),
            parent=v1_root,
            pal=pal,
            door_name=f"CMP_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 1 else ("hot" if idx == 2 else None),
        )
        parts1.append(ped)

    fl.merge_objects_into(body1, parts1)

    # Separate Moving Parts for CMP Polisher:
    # 1. 3 Rotating Polishing Platens (`Platen_01`, `Platen_02`, `Platen_03`)
    platen_coords = [(-0.72, 0.15), (0.72, 0.15), (0.0, 1.02)]
    for pidx, (px, py) in enumerate(platen_coords, start=1):
        plat = fl.add_bevel_cylinder(
            f"Platen_0{pidx}",
            radius=0.46,
            depth=0.09,
            vertices=24,
            loc=(px, py, 1.28),
            bevel_width=0.012,
            mat=pal["upw_teal"] if pidx < 3 else pal["copper"],
            parent=v1_root,
        )
        pad_ring = fl.add_bevel_cylinder(
            f"plat_ring_{pidx}",
            radius=0.38,
            depth=0.10,
            vertices=20,
            loc=(px, py, 1.285),
            bevel_width=0.008,
            mat=pal["slate"],
            parent=v1_root,
        )
        fl.merge_objects_into(plat, [pad_ring])

    # 2. Overhead Multi-Head Wafer Carrier Carousel (`PolishingCarousel`)
    carousel = fl.add_bevel_cylinder(
        "PolishingCarousel",
        radius=0.92,
        depth=0.16,
        vertices=18,
        loc=(0.0, 0.48, 1.78),
        bevel_width=0.02,
        mat=pal["silver"],
        parent=v1_root,
    )
    c_heads = []
    for hidx, (hx, hy) in enumerate(platen_coords, start=1):
        head = fl.add_bevel_cylinder(
            f"cmp_head_{hidx}",
            radius=0.22,
            depth=0.36,
            vertices=16,
            loc=(0.0, 0.48, 1.78),
            bevel_width=0.01,
            mat=pal["chrome"],
            parent=v1_root,
            pivot_offset=(hx, hy - 0.48, -0.22),
        )
        c_heads.append(head)
    fl.merge_objects_into(carousel, c_heads)

    # 3. PadConditionerArm (swiveling diamond conditioner arm)
    fl.add_bevel_box(
        "PadConditionerArm",
        size=(0.12, 0.58, 0.08),
        loc=(-1.18, 0.15, 1.38),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v1_root,
        pivot_offset=(0.0, 0.24, 0.0),
    )

    # 4. CMPHoodDoor (sloped clear enclosure hood with top hinge)
    fl.add_bevel_box(
        "CMPHoodDoor",
        size=(2.68, 2.15, 0.72),
        loc=(0.0, 0.25, 2.12),
        bevel_width=0.02,
        mat=pal["glass_clear"],
        parent=v1_root,
        pivot_offset=(0.0, 0.0, -0.36),
    )

    # =========================================================================
    # VARIANT 2: WetBench_AutoDeck (Automated Acid/Base Wet Clean Bench)
    # =========================================================================
    v2_root = fl.make_root("WetBench_AutoDeck", loc=(0.0, 0.0, 0.0))
    body2 = fl.add_bevel_box(
        "WetBench_Chassis",
        size=(3.6, 2.2, 1.12),
        loc=(0.0, 0.1, 0.56),
        bevel_width=0.035,
        mat=pal["white"],
        parent=v2_root,
    )
    parts2 = []
    # Rear exhaust plenum & upper canopy with cobalt blue header
    plenum = fl.add_bevel_box(
        "wb_plenum",
        size=(3.6, 0.58, 2.35),
        loc=(0.0, 0.92, 1.18),
        bevel_width=0.03,
        mat=pal["white"],
        parent=v2_root,
    )
    canopy = fl.add_bevel_box(
        "wb_canopy",
        size=(3.64, 2.15, 0.24),
        loc=(0.0, 0.12, 2.32),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    gantry_rail = fl.add_bevel_box(
        "wb_gantry_rail",
        size=(3.48, 0.12, 0.12),
        loc=(0.0, 0.55, 1.88),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v2_root,
    )
    for px in (-1.72, 1.72):
        fpost = fl.add_bevel_box(
            f"wb_fpost_{px}",
            size=(0.12, 0.12, 1.18),
            loc=(px, -0.88, 1.68),
            bevel_width=0.01,
            mat=pal["silver"],
            parent=v2_root,
        )
        parts2.append(fpost)
    parts2.extend([plenum, canopy, gantry_rail])

    # 5 Illuminated Quartz Chemical Process Baths along X (SC1, DHF, DI Water, SC2, IPA Dry)
    bath_mats = [pal["emit_cyan"], pal["emit_amber"], pal["emit_blue"], pal["emit_cyan"], pal["emit_green"]]
    for bidx, bx in enumerate((-1.28, -0.64, 0.0, 0.64, 1.28)):
        tank = fl.add_bevel_box(
            f"wb_bath_{bidx}",
            size=(0.50, 0.62, 0.12),
            loc=(bx, 0.12, 1.16),
            bevel_width=0.01,
            mat=bath_mats[bidx],
            parent=v2_root,
        )
        parts2.append(tank)

    parts2.append(fl.create_signal_tower("wb_tower", loc=(1.55, -0.78, 2.44), parent=v2_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.85, 0.85), start=1):
        ped, _ = fl.create_load_port(
            f"wb_lp{idx}",
            loc=(lx, -1.25, 0.0),
            parent=v2_root,
            pal=pal,
            door_name=f"WB_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 1 else None,
        )
        parts2.append(ped)

    fl.merge_objects_into(body2, parts2)

    # Separate Moving Parts for Wet Bench:
    # 1. WetGantryCarriage (slides along X rail)
    carriage = fl.add_bevel_box(
        "WetGantryCarriage",
        size=(0.36, 0.34, 0.75),
        loc=(-0.64, 0.55, 1.68),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v2_root,
    )
    # 2. WetGripperLift (vertical cassette dipper arm parented to WetGantryCarriage)
    lifter = fl.add_bevel_box(
        "WetGripperLift",
        size=(0.34, 0.44, 0.28),
        loc=(0.0, -0.38, -0.18),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=carriage,
    )
    w_cass = fl.add_bevel_cylinder(
        "wb_wafer_batch",
        radius=0.15,
        depth=0.26,
        vertices=20,
        loc=(0.0, -0.38, -0.18),
        rot=(0.0, math.pi / 2.0, 0.0),
        bevel_width=0.005,
        mat=pal["wafer"],
        parent=carriage,
        pivot_offset=(0.0, 0.0, -0.12),
    )
    fl.merge_objects_into(lifter, [w_cass])

    # =========================================================================
    # VARIANT 3: WetTool_SingleWaferSpin (8-Chamber Single-Wafer Spin Cleaner)
    # =========================================================================
    v3_root = fl.make_root("WetTool_SingleWaferSpin", loc=(5.8, 0.0, 0.0))
    body3 = fl.add_bevel_box(
        "SpinClean_Enclosure",
        size=(2.7, 3.6, 2.35),
        loc=(0.0, 0.2, 1.18),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    parts3 = []
    crown3 = fl.add_bevel_box(
        "sc_crown",
        size=(2.76, 3.66, 0.22),
        loc=(0.0, 0.2, 2.32),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v3_root,
    )
    # Stacked circular spin chamber viewports on left & right sides
    for side_x in (-1.35, 1.35):
        for cy in (-0.3, 0.7):
            for cz in (1.05, 1.75):
                vp = fl.add_bevel_cylinder(
                    f"sc_vp_{side_x}_{cy}_{cz}",
                    radius=0.28,
                    depth=0.08,
                    vertices=18,
                    loc=(side_x, cy, cz),
                    rot=(0.0, math.pi / 2.0, 0.0),
                    bevel_width=0.01,
                    mat=pal["emit_cyan"],
                    parent=v3_root,
                )
                parts3.append(vp)
    parts3.append(crown3)
    parts3.append(fl.create_signal_tower("sc_tower", loc=(1.12, -1.42, 2.44), parent=v3_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.78, 0.0, 0.78), start=1):
        ped, _ = fl.create_load_port(
            f"sc_lp{idx}",
            loc=(lx, -1.85, 0.0),
            parent=v3_root,
            pal=pal,
            door_name=f"SC_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 2 else None,
        )
        parts3.append(ped)

    fl.merge_objects_into(body3, parts3)

    # Separate Moving Spin Chucks
    for sidx, sy in enumerate((-0.3, 0.7), start=1):
        fl.add_bevel_cylinder(
            f"SpinChuck_0{sidx}",
            radius=0.22,
            depth=0.12,
            vertices=20,
            loc=(0.0, sy, 1.35),
            bevel_width=0.01,
            mat=pal["wafer"],
            parent=v3_root,
        )

    fl.export_glb("cmp_wet_tools.glb")


def build_metrology_packaging_tools():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: Metrology_CDSEM (Inline e-Beam CD-SEM & Defect Review Tool)
    # =========================================================================
    v1_root = fl.make_root("Metrology_CDSEM", loc=(-6.8, 0.0, 0.0))
    body1 = fl.add_bevel_box(
        "CDSEM_Enclosure",
        size=(2.2, 2.6, 2.05),
        loc=(0.0, 0.2, 1.025),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    parts1 = []
    crown1 = fl.add_bevel_box(
        "sem_crown",
        size=(2.26, 2.66, 0.20),
        loc=(0.0, 0.2, 2.05),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    # Iconic vertical Electron Beam Column Tower protruding from top
    ecol_base = fl.add_bevel_cylinder(
        "sem_ecol_base",
        radius=0.38,
        depth=0.45,
        vertices=24,
        loc=(0.0, 0.35, 2.32),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=v1_root,
    )
    ecol_upper = fl.add_bevel_cylinder(
        "sem_ecol_upper",
        radius=0.24,
        depth=0.65,
        vertices=24,
        loc=(0.0, 0.35, 2.78),
        bevel_width=0.02,
        mat=pal["chrome"],
        parent=v1_root,
    )
    ecol_ring = fl.add_bevel_cylinder(
        "sem_ecol_ring",
        radius=0.27,
        depth=0.08,
        vertices=20,
        loc=(0.0, 0.35, 2.65),
        bevel_width=0.008,
        mat=pal["emit_cyan"],
        parent=v1_root,
    )
    parts1.extend([crown1, ecol_base, ecol_upper, ecol_ring])
    parts1.append(fl.create_signal_tower("sem_tower", loc=(0.88, -0.92, 2.15), parent=v1_root, pal=pal, state="running"))
    parts1.append(fl.add_operator_console("sem_op", loc=(-1.12, -0.85, 0.95), parent=v1_root, pal=pal))

    for idx, lx in enumerate((-0.52, 0.52), start=1):
        ped, _ = fl.create_load_port(
            f"sem_lp{idx}",
            loc=(lx, -1.35, 0.0),
            parent=v1_root,
            pal=pal,
            door_name=f"SEM_LoadPortDoor_0{idx}",
            foup_variant="hot" if idx == 1 else "standard",
        )
        parts1.append(ped)

    fl.merge_objects_into(body1, parts1)

    fl.add_bevel_cylinder(
        "SEMStage",
        radius=0.26,
        depth=0.14,
        vertices=20,
        loc=(0.0, 0.35, 1.25),
        bevel_width=0.01,
        mat=pal["wafer"],
        parent=v1_root,
    )

    # =========================================================================
    # VARIANT 2: Metrology_OpticalScatter (Optical Wafer Defect & OCD Inspector)
    # =========================================================================
    v2_root = fl.make_root("Metrology_OpticalScatter", loc=(-2.2, 0.0, 0.0))
    body2 = fl.add_bevel_box(
        "Optical_Enclosure",
        size=(2.1, 2.4, 2.10),
        loc=(0.0, 0.15, 1.05),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v2_root,
    )
    parts2 = []
    crown2 = fl.add_bevel_box(
        "opt_crown",
        size=(2.16, 2.46, 0.20),
        loc=(0.0, 0.15, 2.10),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    win2 = fl.add_bevel_box(
        "opt_win",
        size=(1.15, 0.08, 0.72),
        loc=(0.0, -1.04, 1.48),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=v2_root,
    )
    parts2.extend([crown2, win2])
    parts2.append(fl.create_signal_tower("opt_tower", loc=(0.82, -0.85, 2.20), parent=v2_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.48, 0.48), start=1):
        ped, _ = fl.create_load_port(
            f"opt_lp{idx}",
            loc=(lx, -1.28, 0.0),
            parent=v2_root,
            pal=pal,
            door_name=f"Opt_LoadPortDoor_0{idx}",
            foup_variant="eng" if idx == 1 else None,
        )
        parts2.append(ped)

    fl.merge_objects_into(body2, parts2)

    turret = fl.add_bevel_cylinder(
        "OpticalTurret",
        radius=0.22,
        depth=0.25,
        vertices=18,
        loc=(0.0, -0.35, 1.62),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v2_root,
    )
    beam = fl.add_bevel_cylinder(
        "opt_beam",
        radius=0.08,
        depth=0.28,
        vertices=14,
        loc=(0.0, -0.35, 1.42),
        bevel_width=0.005,
        mat=pal["emit_cyan"],
        parent=v2_root,
    )
    fl.merge_objects_into(turret, [beam])

    # =========================================================================
    # VARIANT 3: Packaging_ThermoBond (Advanced 3D IC CoWoS Die-to-Wafer Bonder)
    # =========================================================================
    v3_root = fl.make_root("Packaging_ThermoBond", loc=(2.4, 0.0, 0.0))
    body3 = fl.add_bevel_box(
        "ThermoBond_Enclosure",
        size=(2.5, 2.6, 2.15),
        loc=(0.0, 0.15, 1.075),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    parts3 = []
    crown3 = fl.add_bevel_box(
        "tb_crown",
        size=(2.56, 2.66, 0.20),
        loc=(0.0, 0.15, 2.15),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v3_root,
    )
    win3 = fl.add_bevel_box(
        "tb_win",
        size=(1.55, 0.08, 0.85),
        loc=(0.0, -1.14, 1.48),
        bevel_width=0.01,
        mat=pal["glass_clear"],
        parent=v3_root,
    )
    parts3.extend([crown3, win3])
    parts3.append(fl.create_signal_tower("tb_tower", loc=(0.98, -0.95, 2.25), parent=v3_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.55, 0.55), start=1):
        ped, _ = fl.create_load_port(
            f"tb_lp{idx}",
            loc=(lx, -1.38, 0.0),
            parent=v3_root,
            pal=pal,
            door_name=f"Bond_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 1 else None,
        )
        parts3.append(ped)

    fl.merge_objects_into(body3, parts3)

    fl.add_bevel_box(
        "BondHeadGantry",
        size=(1.15, 0.28, 0.34),
        loc=(0.0, -0.45, 1.58),
        bevel_width=0.015,
        mat=pal["copper"],
        parent=v3_root,
    )

    # =========================================================================
    # VARIANT 4: Packaging_WaferProber (Automated 300mm Wafer Test Prober)
    # =========================================================================
    v4_root = fl.make_root("Packaging_WaferProber", loc=(7.0, 0.0, 0.0))
    body4 = fl.add_bevel_box(
        "Prober_Base",
        size=(2.2, 2.4, 1.45),
        loc=(0.0, 0.1, 0.725),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v4_root,
    )
    parts4 = []
    post4 = fl.add_bevel_cylinder(
        "pr_post",
        radius=0.22,
        depth=1.95,
        vertices=18,
        loc=(0.92, 0.55, 1.05),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=v4_root,
    )
    parts4.append(post4)
    parts4.append(fl.create_signal_tower("pr_tower", loc=(-0.85, 0.85, 1.48), parent=v4_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.50, 0.50), start=1):
        ped, _ = fl.create_load_port(
            f"pr_lp{idx}",
            loc=(lx, -1.32, 0.0),
            parent=v4_root,
            pal=pal,
            door_name=f"Prober_LoadPortDoor_0{idx}",
            foup_variant="hot" if idx == 2 else None,
        )
        parts4.append(ped)

    fl.merge_objects_into(body4, parts4)

    # Hinged ATE Test Head Manipulator Arm over Prober Chuck
    test_head = fl.add_bevel_box(
        "TestHeadManipulator",
        size=(1.35, 1.15, 0.38),
        loc=(0.92, 0.55, 1.72),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v4_root,
        pivot_offset=(-0.85, -0.35, 0.0),
    )
    cables = fl.add_bevel_cylinder(
        "pr_cables",
        radius=0.14,
        depth=0.55,
        vertices=14,
        loc=(0.92, 0.55, 1.72),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=v4_root,
        pivot_offset=(-0.85, -0.35, 0.25),
    )
    fl.merge_objects_into(test_head, [cables])

    fl.export_glb("metrology_packaging_tools.glb")


if __name__ == "__main__":
    build_implant_furnace_tools()
    build_cmp_wet_tools()
    build_metrology_packaging_tools()
