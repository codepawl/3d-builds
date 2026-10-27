import bpy
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import argon_fab_lib as fl


def build_litho_scanners():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: LithoScanner_EUV (High-NA EUV Photolithography Scanner)
    # =========================================================================
    v1_root = fl.make_root("LithoScanner_EUV", loc=(-5.5, 0.0, 0.0))

    body = fl.add_bevel_box(
        "EUV_MainEnclosure",
        size=(3.4, 4.4, 0.24),
        loc=(0.0, 0.2, 0.12),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v1_root,
    )
    parts = []
    cab_main = fl.add_bevel_box(
        "euv_cab_main",
        size=(3.3, 3.0, 2.75),
        loc=(0.0, 0.0, 1.60),
        bevel_width=0.05,
        mat=pal["white"],
        parent=v1_root,
    )
    cab_source = fl.add_bevel_box(
        "euv_cab_source",
        size=(2.8, 1.4, 2.35),
        loc=(0.0, 2.15, 1.40),
        bevel_width=0.04,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    source_vessel = fl.add_bevel_cylinder(
        "euv_vessel",
        radius=0.68,
        depth=1.25,
        vertices=24,
        loc=(0.0, 2.45, 1.55),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.03,
        mat=pal["silver"],
        parent=v1_root,
    )
    efem = fl.add_bevel_box(
        "euv_efem",
        size=(3.1, 0.85, 2.35),
        loc=(0.0, -1.85, 1.40),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v1_root,
    )
    crown = fl.add_bevel_box(
        "euv_crown",
        size=(3.36, 3.06, 0.28),
        loc=(0.0, 0.0, 2.86),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    win_front = fl.add_bevel_box(
        "euv_win_front",
        size=(1.75, 0.08, 0.88),
        loc=(0.0, -1.48, 1.88),
        bevel_width=0.015,
        mat=pal["glass_yellow_litho"],
        parent=v1_root,
    )
    win_left = fl.add_bevel_box(
        "euv_win_left",
        size=(0.08, 1.65, 0.92),
        loc=(-1.64, -0.1, 1.75),
        bevel_width=0.015,
        mat=pal["glass_yellow_litho"],
        parent=v1_root,
    )
    for hx in (-0.85, 0.85):
        ffu = fl.add_bevel_box(
            f"euv_ffu_{hx}",
            size=(1.2, 1.8, 0.18),
            loc=(hx, -0.1, 3.08),
            bevel_width=0.02,
            mat=pal["silver"],
            parent=v1_root,
        )
        parts.append(ffu)

    for vy in (-0.9, 0.9):
        parts.append(
            fl.add_vent_grille(f"euv_vent_l_{vy}", (-1.66, vy, 0.82), size=(0.05, 0.85, 0.55), slats=6, axis="X", parent=v1_root, pal=pal)
        )
        parts.append(
            fl.add_vent_grille(f"euv_vent_r_{vy}", (1.66, vy, 0.82), size=(0.05, 0.85, 0.55), slats=6, axis="X", parent=v1_root, pal=pal)
        )

    parts.extend([cab_main, cab_source, source_vessel, efem, crown, win_front, win_left])
    parts.append(fl.add_signage_plate("euv_sign", (0.0, -2.28, 2.32), size=(1.1, 0.04, 0.22), parent=v1_root, pal=pal))
    parts.append(fl.create_signal_tower("euv_tower", loc=(1.38, -2.10, 2.58), parent=v1_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.92, 0.0, 0.92), start=1):
        fvar = "hot" if idx == 1 else ("standard" if idx == 2 else None)
        ped, _ = fl.create_load_port(
            f"euv_lp{idx}",
            loc=(lx, -2.52, 0.0),
            parent=v1_root,
            pal=pal,
            door_name=f"LoadPortDoor_0{idx}",
            foup_variant=fvar,
        )
        parts.append(ped)

    fl.merge_objects_into(body, parts)

    stage = fl.add_bevel_cylinder(
        "WaferStage_Chuck",
        radius=0.36,
        depth=0.14,
        vertices=24,
        loc=(0.0, -0.35, 1.38),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v1_root,
    )
    w_on_stage = fl.add_bevel_cylinder(
        "euv_stage_wafer",
        radius=0.16,
        depth=0.01,
        vertices=24,
        loc=(0.0, -0.35, 1.46),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=v1_root,
    )
    fl.merge_objects_into(stage, [w_on_stage])

    ret_bridge = fl.add_bevel_box(
        "ReticleBridge",
        size=(1.35, 0.34, 0.16),
        loc=(0.0, -0.35, 2.08),
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    ret_lens = fl.add_bevel_cylinder(
        "ret_lens",
        radius=0.22,
        depth=0.28,
        vertices=20,
        loc=(0.0, -0.35, 1.92),
        bevel_width=0.01,
        mat=pal["emit_amber"],
        parent=v1_root,
    )
    fl.merge_objects_into(ret_bridge, [ret_lens])

    fl.add_operator_console("euv_op", loc=(1.68, -1.75, 1.15), parent=v1_root, pal=pal, arm_name="OperatorArm")

    # =========================================================================
    # VARIANT 2: LithoScanner_ArFi (193i ArF Immersion Twin-Stage Scanner)
    # =========================================================================
    v2_root = fl.make_root("LithoScanner_ArFi", loc=(0.0, 0.0, 0.0))
    body2 = fl.add_bevel_box(
        "ArFi_MainEnclosure",
        size=(2.9, 3.8, 0.22),
        loc=(0.0, 0.1, 0.11),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v2_root,
    )
    parts2 = []
    cab2 = fl.add_bevel_box(
        "arfi_cab",
        size=(2.8, 2.8, 2.45),
        loc=(0.0, 0.1, 1.42),
        bevel_width=0.045,
        mat=pal["white"],
        parent=v2_root,
    )
    crown2 = fl.add_bevel_box(
        "arfi_crown",
        size=(2.86, 2.86, 0.24),
        loc=(0.0, 0.1, 2.56),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    beam_duct = fl.add_bevel_cylinder(
        "arfi_beam_duct",
        radius=0.16,
        depth=2.6,
        vertices=16,
        loc=(0.0, 0.15, 2.84),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v2_root,
    )
    win2 = fl.add_bevel_box(
        "arfi_win",
        size=(1.45, 0.08, 0.82),
        loc=(0.0, -1.30, 1.68),
        bevel_width=0.012,
        mat=pal["glass_yellow_litho"],
        parent=v2_root,
    )
    parts2.extend([cab2, crown2, beam_duct, win2])
    parts2.append(fl.add_signage_plate("arfi_sign", (0.0, -1.31, 2.25), size=(0.95, 0.04, 0.20), parent=v2_root, pal=pal, accent="yellow"))
    parts2.append(fl.create_signal_tower("arfi_tower", loc=(-1.18, -1.15, 2.68), parent=v2_root, pal=pal, state="running"))

    for idx, lx in enumerate((-0.55, 0.55), start=1):
        ped, _ = fl.create_load_port(
            f"arfi_lp{idx}",
            loc=(lx, -1.62, 0.0),
            parent=v2_root,
            pal=pal,
            door_name=f"ArFi_LoadPortDoor_0{idx}",
            foup_variant="standard" if idx == 1 else None,
        )
        parts2.append(ped)

    fl.merge_objects_into(body2, parts2)

    imm_stage = fl.add_bevel_cylinder(
        "ImmersionStage",
        radius=0.32,
        depth=0.14,
        vertices=24,
        loc=(0.0, -0.35, 1.32),
        bevel_width=0.015,
        mat=pal["chrome"],
        parent=v2_root,
    )
    imm_w = fl.add_bevel_cylinder(
        "arfi_wafer",
        radius=0.15,
        depth=0.01,
        vertices=20,
        loc=(0.0, -0.35, 1.40),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=v2_root,
    )
    fl.merge_objects_into(imm_stage, [imm_w])

    # =========================================================================
    # VARIANT 3: LithoTrack_CoaterDev (Photoresist Coater / Developer Track)
    # =========================================================================
    v3_root = fl.make_root("LithoTrack_CoaterDev", loc=(5.5, 0.0, 0.0))
    body3 = fl.add_bevel_box(
        "Track_MainEnclosure",
        size=(2.6, 4.2, 0.20),
        loc=(0.0, 0.1, 0.10),
        bevel_width=0.025,
        mat=pal["slate"],
        parent=v3_root,
    )
    parts3 = []
    cab3 = fl.add_bevel_box(
        "track_cab",
        size=(2.5, 3.4, 2.25),
        loc=(0.0, 0.2, 1.32),
        bevel_width=0.04,
        mat=pal["white"],
        parent=v3_root,
    )
    header3 = fl.add_bevel_box(
        "track_header",
        size=(2.56, 3.46, 0.20),
        loc=(0.0, 0.2, 2.38),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v3_root,
    )
    for wy in (-0.8, 0.2, 1.2):
        wbox = fl.add_bevel_box(
            f"track_win_{wy}",
            size=(0.08, 0.72, 0.95),
            loc=(-1.24, wy, 1.58),
            bevel_width=0.01,
            mat=pal["glass_yellow_litho"],
            parent=v3_root,
        )
        parts3.append(wbox)
    parts3.extend([cab3, header3])
    parts3.append(fl.create_signal_tower("track_tower", loc=(1.05, -1.35, 2.48), parent=v3_root, pal=pal, state="idle"))

    for idx, lx in enumerate((-0.78, 0.0, 0.78), start=1):
        ped, _ = fl.create_load_port(
            f"track_lp{idx}",
            loc=(lx, -1.82, 0.0),
            parent=v3_root,
            pal=pal,
            door_name=f"Track_LoadPortDoor_0{idx}",
            foup_variant="eng" if idx == 2 else None,
        )
        parts3.append(ped)

    fl.merge_objects_into(body3, parts3)

    shuttle = fl.add_bevel_box(
        "TrackWaferShuttle",
        size=(0.42, 0.42, 0.08),
        loc=(0.0, 0.0, 1.45),
        bevel_width=0.01,
        mat=pal["chrome"],
        parent=v3_root,
    )
    sw = fl.add_bevel_cylinder(
        "track_sw",
        radius=0.15,
        depth=0.01,
        vertices=20,
        loc=(0.0, 0.0, 1.50),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=v3_root,
    )
    fl.merge_objects_into(shuttle, [sw])

    fl.add_bevel_box(
        "ChemDrawer_01",
        size=(0.55, 0.85, 0.58),
        loc=(-1.25, -0.65, 0.52),
        bevel_width=0.015,
        mat=pal["light_panel"],
        parent=v3_root,
        pivot_offset=(0.275, 0.0, 0.0),
    )

    fl.export_glb("litho_scanners.glb")


def build_cluster_unit(
    root_name,
    root_loc,
    num_chambers=6,
    chamber_radius=0.56,
    ring_radius=1.52,
    glow_mat_key="emit_cyan",
    num_load_ports=3,
    extra_magnetrons=False,
    prefix="Etch",
):
    pal = fl.get_palette()
    root = fl.make_root(root_name, loc=root_loc)

    # Central vacuum transfer chamber base (lowered slightly so top recessed robot well is visible!)
    base = fl.add_bevel_cylinder(
        f"{prefix}_TransferHub",
        radius=1.02,
        depth=1.24,
        vertices=8,
        loc=(0.0, 0.35, 0.62),
        bevel_width=0.04,
        mat=pal["silver"],
        parent=root,
    )
    parts = []
    # Dark interior vacuum well floor so the central robot + silicon wafer contrast sharply!
    well_floor = fl.add_bevel_cylinder(
        f"{prefix}_well_floor",
        radius=0.78,
        depth=0.04,
        vertices=16,
        loc=(0.0, 0.35, 1.25),
        bevel_width=0.008,
        mat=pal["dark_steel"],
        parent=root,
    )
    parts.append(well_floor)

    # Perimeter cobalt-blue octagonal lid collar around the open robot well
    for rseg in range(8):
        rang = rseg * (math.pi / 4.0)
        rx = math.cos(rang) * 0.86
        ry = 0.35 + math.sin(rang) * 0.86
        cseg = fl.add_bevel_box(
            f"{prefix}_collar_{rseg}",
            size=(0.24, 0.72, 0.16),
            loc=(rx, ry, 1.32),
            rot=(0.0, 0.0, rang),
            bevel_width=0.015,
            mat=pal["brand_blue"],
            parent=root,
        )
        parts.append(cseg)

    start_ang = -math.pi * 0.18
    end_ang = math.pi * 1.18
    for i in range(num_chambers):
        t = i / float(max(1, num_chambers - 1))
        ang = start_ang + t * (end_ang - start_ang)
        cx = math.cos(ang) * ring_radius
        cy = 0.35 + math.sin(ang) * ring_radius

        ch_body = fl.add_bevel_cylinder(
            f"{prefix}_ch_{i}",
            radius=chamber_radius,
            depth=1.18,
            vertices=16,
            loc=(cx, cy, 0.96),
            bevel_width=0.03,
            mat=pal["white"],
            parent=root,
        )
        turbo = fl.add_bevel_cylinder(
            f"{prefix}_turbo_{i}",
            radius=chamber_radius * 0.55,
            depth=0.45,
            vertices=14,
            loc=(cx, cy, 0.25),
            bevel_width=0.015,
            mat=pal["slate"],
            parent=root,
        )
        glow_ring = fl.add_bevel_cylinder(
            f"{prefix}_glow_{i}",
            radius=chamber_radius * 1.02,
            depth=0.08,
            vertices=16,
            loc=(cx, cy, 1.22),
            bevel_width=0.008,
            mat=pal[glow_mat_key],
            parent=root,
        )
        rf_box = fl.add_bevel_box(
            f"{prefix}_rf_{i}",
            size=(0.42, 0.42, 0.32),
            loc=(cx, cy, 1.70),
            rot=(0.0, 0.0, ang),
            bevel_width=0.015,
            mat=pal["light_panel"],
            parent=root,
        )
        gx = math.cos(ang) * (ring_radius * 0.66)
        gy = 0.35 + math.sin(ang) * (ring_radius * 0.66)
        gate = fl.add_bevel_box(
            f"{prefix}_gate_{i}",
            size=(0.38, 0.44, 0.48),
            loc=(gx, gy, 1.02),
            rot=(0.0, 0.0, ang),
            bevel_width=0.015,
            mat=pal["chrome"],
            parent=root,
        )
        parts.extend([ch_body, turbo, glow_ring, rf_box, gate])

    efem_w = 2.45 if num_load_ports <= 3 else 2.95
    efem = fl.add_bevel_box(
        f"{prefix}_efem",
        size=(efem_w, 0.82, 1.95),
        loc=(0.0, -1.25, 0.98),
        bevel_width=0.035,
        mat=pal["white"],
        parent=root,
    )
    efem_band = fl.add_bevel_box(
        f"{prefix}_efem_band",
        size=(efem_w + 0.04, 0.86, 0.20),
        loc=(0.0, -1.25, 1.88),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=root,
    )
    for lx in (-0.42, 0.42):
        llock = fl.add_bevel_box(
            f"{prefix}_ll_{lx}",
            size=(0.52, 0.58, 0.55),
            loc=(lx, -0.62, 1.05),
            bevel_width=0.02,
            mat=pal["chrome"],
            parent=root,
        )
        parts.append(llock)

    parts.extend([efem, efem_band])
    parts.append(fl.create_signal_tower(f"{prefix}_tower", loc=(efem_w * 0.42, -1.45, 1.98), parent=root, pal=pal, state="running"))
    parts.append(fl.add_operator_console(f"{prefix}_op", loc=(-efem_w * 0.52, -1.35, 0.95), parent=root, pal=pal))

    span = efem_w * 0.72
    for idx in range(num_load_ports):
        frac = (idx / float(max(1, num_load_ports - 1))) - 0.5 if num_load_ports > 1 else 0.0
        px = frac * span
        fvar = "standard" if idx == 0 else ("hot" if idx == 1 else None)
        ped, _ = fl.create_load_port(
            f"{prefix}_lp{idx+1}",
            loc=(px, -1.92, 0.0),
            parent=root,
            pal=pal,
            door_name=f"{prefix}_LoadPortDoor_0{idx+1}",
            foup_variant=fvar,
        )
        parts.append(ped)

    fl.merge_objects_into(base, parts)

    # Separate Moving Part 1: Central Vacuum Wafer Transfer Robot (`TransferRobotArm`) visible in top well!
    robot = fl.add_bevel_cylinder(
        f"{prefix}_TransferRobotArm",
        radius=0.19,
        depth=0.14,
        vertices=16,
        loc=(0.0, 0.35, 1.32),
        bevel_width=0.012,
        mat=pal["chrome"],
        parent=root,
    )
    r_parts = []
    arm1 = fl.add_bevel_box(
        f"{prefix}_r_arm1",
        size=(0.16, 0.54, 0.045),
        loc=(0.0, 0.58, 1.38),
        bevel_width=0.006,
        mat=pal["chrome"],
        parent=root,
    )
    wafer_blade = fl.add_bevel_cylinder(
        f"{prefix}_r_wafer",
        radius=0.18,
        depth=0.015,
        vertices=24,
        loc=(0.0, 0.76, 1.41),
        bevel_width=0.002,
        mat=pal["wafer"],
        parent=root,
    )
    r_parts.extend([arm1, wafer_blade])
    fl.merge_objects_into(robot, r_parts)

    if extra_magnetrons:
        for midx, mx in enumerate((-1.25, 1.25), start=1):
            mag = fl.add_bevel_cylinder(
                f"MagnetronHead_0{midx}",
                radius=0.34,
                depth=0.22,
                vertices=18,
                loc=(mx, 1.25, 1.72),
                bevel_width=0.015,
                mat=pal["copper"],
                parent=root,
            )
            fin = fl.add_bevel_box(
                f"mag_fin_{midx}",
                size=(0.58, 0.12, 0.08),
                loc=(mx, 1.25, 1.84),
                bevel_width=0.008,
                mat=pal["chrome"],
                parent=root,
            )
            fl.merge_objects_into(mag, [fin])


def build_etch_deposition_clusters():
    fl.clear_scene()
    build_cluster_unit(
        "ClusterTool_PlasmaEtch",
        root_loc=(-5.8, 0.0, 0.0),
        num_chambers=6,
        chamber_radius=0.52,
        ring_radius=1.50,
        glow_mat_key="emit_cyan",
        num_load_ports=3,
        extra_magnetrons=False,
        prefix="Etch",
    )
    build_cluster_unit(
        "ClusterTool_CVD_ALD",
        root_loc=(0.0, 0.0, 0.0),
        num_chambers=5,
        chamber_radius=0.56,
        ring_radius=1.48,
        glow_mat_key="emit_amber",
        num_load_ports=3,
        extra_magnetrons=False,
        prefix="CVD",
    )
    build_cluster_unit(
        "ClusterTool_PVD_Metal",
        root_loc=(5.8, 0.0, 0.0),
        num_chambers=4,
        chamber_radius=0.62,
        ring_radius=1.55,
        glow_mat_key="emit_blue",
        num_load_ports=4,
        extra_magnetrons=True,
        prefix="PVD",
    )
    fl.export_glb("etch_deposition_clusters.glb")


if __name__ == "__main__":
    build_litho_scanners()
    build_etch_deposition_clusters()
