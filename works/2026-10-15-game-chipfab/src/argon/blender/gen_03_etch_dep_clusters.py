import sys
import os
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, make_empty, add_box, add_cylinder,
    add_octagonal_prism, add_bolt_row, build_signal_tower,
    build_operator_console, build_efem_load_port, finalize_and_export_glb
)


def _build_vacuum_robot(name, loc, parent, pal):
    """Build an articulated dual-blade SCARA/frog-leg vacuum transfer robot with origin at center pivot."""
    rob = make_empty(name, loc=loc, parent=parent)
    add_cylinder(f"{name}_Hub", radius=0.18, depth=0.14, vertices=20,
                 loc=(0, 0, 0), mat=pal["dark_slate"], bevel=0.008, parent=rob)
    add_cylinder(f"{name}_Cap", radius=0.12, depth=0.06, vertices=16,
                 loc=(0, 0, 0.09), mat=pal["brand_blue"], bevel=0.006, parent=rob)
    # Linked scissor arms + end-effector blade holding a 300mm patterned silicon wafer
    add_box(f"{name}_ArmL", (0.10, 0.42, 0.035), (-0.08, -0.16, 0.06),
            rot=(0, 0, math.radians(-18)), mat=pal["chrome"], bevel=0.004, parent=rob)
    add_box(f"{name}_ArmR", (0.10, 0.42, 0.035), (0.08, -0.16, 0.06),
            rot=(0, 0, math.radians(18)), mat=pal["chrome"], bevel=0.004, parent=rob)
    add_box(f"{name}_Wrist", (0.20, 0.14, 0.04), (0, -0.36, 0.08),
            mat=pal["steel"], bevel=0.004, parent=rob)
    add_cylinder(f"{name}_Wafer", radius=0.15, depth=0.012, vertices=24,
                 loc=(0, -0.48, 0.105), mat=pal["wafer"], bevel=0.002, parent=rob)
    return rob


def build_plasma_etch_cluster(pal, x_off=-5.5):
    root = make_empty("Cluster_PlasmaEtch", loc=(x_off, 0, 0))

    # 1. Central Octagonal Vacuum Transfer Chamber (centered at y = -0.35)
    cy = -0.35
    add_octagonal_prism("Etch_TransferBase", radius=0.92, depth=0.92,
                        loc=(0, cy, 0.46), mat=pal["dark_slate"], bevel=0.015, parent=root, sides=8)
    add_octagonal_prism("Etch_TransferBody", radius=0.96, depth=0.38,
                        loc=(0, cy, 1.11), mat=pal["steel"], bevel=0.015, parent=root, sides=8)
    # Recessed dark interior cavity floor so the articulated robot stands out clearly from top/iso view
    add_cylinder("Etch_TransferWell", radius=0.72, depth=0.06, vertices=24,
                 loc=(0, cy, 1.29), mat=pal["dark_slate"], bevel=0.005, parent=root)
    # Beveled viewport flange rim around the transfer chamber
    add_octagonal_prism("Etch_ViewportRim", radius=0.88, depth=0.06,
                        loc=(0, cy, 1.32), mat=pal["brand_blue"], bevel=0.008, parent=root, sides=8)

    # Articulated Vacuum Transfer Robot at exact center of octagonal chamber
    _build_vacuum_robot("Transfer_Robot_Arm", loc=(0, cy, 1.35), parent=root, pal=pal)

    # 2. 4 Radial ICP/RIE Plasma Etch Process Chambers around back & sides
    angles_deg = [-85, -32, 32, 85]
    for idx, deg in enumerate(angles_deg, start=1):
        rad = math.radians(deg)
        dist = 1.48
        px = math.sin(rad) * dist
        py = cy - math.cos(rad) * dist

        ch_grp = make_empty(f"Etch_Chamber_{idx}", loc=(px, py, 0), rot=(0, 0, -rad), parent=root)
        # Support frame + turbo pump underneath
        add_box(f"Etch_ChPed_{idx}", (0.76, 0.76, 0.78), (0, 0, 0.39),
                mat=pal["cool_grey"], bevel=0.014, parent=ch_grp)
        add_cylinder(f"Etch_TurboPump_{idx}", radius=0.18, depth=0.36, vertices=16,
                     loc=(0, -0.22, 0.55), mat=pal["steel"], bevel=0.006, parent=ch_grp)
        # Main Cylindrical Vacuum Process Body
        add_cylinder(f"Etch_ChBody_{idx}", radius=0.44, depth=0.52, vertices=24,
                     loc=(0, 0, 1.04), mat=pal["white"], bevel=0.014, parent=ch_grp)
        # Glowing Purple ICP Plasma Viewport Ring!
        add_cylinder(f"Etch_PlasmaGlow_{idx}", radius=0.455, depth=0.065, vertices=24,
                     loc=(0, 0, 1.12), mat=pal["emit_purple"], bevel=0.004, parent=ch_grp)
        # Hinged Chamber Lid + RF Matchbox Dome on top (pivot at back hinge of lid)
        lid_piv = make_empty(f"Chamber_{idx}_Lid", loc=(0, -0.40, 1.30), parent=ch_grp)
        add_cylinder(f"Etch_LidPlate_{idx}", radius=0.44, depth=0.10, vertices=24,
                     loc=(0, 0.40, 0.05), mat=pal["steel"], bevel=0.010, parent=lid_piv)
        add_box(f"Etch_RFMatch_{idx}", (0.38, 0.42, 0.28), (0, 0.40, 0.24),
                mat=pal["brand_blue"], bevel=0.010, parent=lid_piv)
        add_cylinder(f"Etch_GasLine_{idx}", radius=0.04, depth=0.22, vertices=12,
                     loc=(0.14, 0.40, 0.42), mat=pal["copper"], bevel=0.003, parent=lid_piv)

    # 3. Dual Load-Lock Modules + Front 3-Port EFEM
    for side, lx in (("L", -0.38), ("R", 0.38)):
        add_box(f"Etch_LoadLock_{side}", (0.48, 0.54, 0.48), (lx, 0.58, 1.10),
                mat=pal["steel"], bevel=0.010, parent=root)
        add_cylinder(f"Etch_LLViewport_{side}", radius=0.14, depth=0.04, vertices=16,
                     loc=(lx, 0.58, 1.35), mat=pal["glass_dark"], bevel=0.004, parent=root)

    add_box("Etch_EFEM_Body", (2.36, 0.58, 2.15), (0, 1.12, 1.08), mat=pal["white"], bevel=0.018, parent=root)
    add_box("Etch_EFEM_Crown", (2.40, 0.62, 0.22), (0, 1.12, 2.24), mat=pal["brand_blue"], bevel=0.015, parent=root)

    for idx, lx in enumerate((-0.76, 0.0, 0.76), start=1):
        build_efem_load_port(f"Etch_LP_{idx}", loc=(lx, 1.64, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx in (1, 2)), hot_lot=(idx == 2))

    build_operator_console("Etch_Console", loc=(1.22, 1.18, 1.25), rot_z=math.radians(-25), parent=root)
    build_signal_tower("Etch_SignalTower", loc=(-1.04, 1.18, 2.35), parent=root, state="RUN")
    return root


def build_cvd_ald_cluster(pal, x_off=0.0):
    root = make_empty("Cluster_CVD_ALD", loc=(x_off, 0, 0))
    cy = -0.30

    # Central Hexagonal Vacuum Transfer Chamber
    add_octagonal_prism("CVD_TransferBase", radius=0.88, depth=0.90,
                        loc=(0, cy, 0.45), mat=pal["dark_slate"], bevel=0.015, parent=root, sides=6)
    add_octagonal_prism("CVD_TransferBody", radius=0.92, depth=0.40,
                        loc=(0, cy, 1.10), mat=pal["cool_grey"], bevel=0.015, parent=root, sides=6)
    add_cylinder("CVD_TransferWell", radius=0.68, depth=0.05, vertices=24,
                 loc=(0, cy, 1.29), mat=pal["dark_slate"], bevel=0.005, parent=root)

    _build_vacuum_robot("CVD_Transfer_Arm", loc=(0, cy, 1.34), parent=root, pal=pal)

    # 3 Radial PECVD / ALD Heated Deposition Chambers (-62, 0, +62 deg)
    for idx, deg in enumerate((-62, 0, 62), start=1):
        rad = math.radians(deg)
        dist = 1.44
        px = math.sin(rad) * dist
        py = cy - math.cos(rad) * dist

        ch_grp = make_empty(f"CVD_Chamber_{idx}", loc=(px, py, 0), rot=(0, 0, -rad), parent=root)
        add_box(f"CVD_Ped_{idx}", (0.82, 0.82, 0.80), (0, 0, 0.40),
                mat=pal["white"], bevel=0.014, parent=ch_grp)
        add_box(f"CVD_Body_{idx}", (0.88, 0.88, 0.46), (0, 0, 1.03),
                mat=pal["steel"], bevel=0.015, parent=ch_grp)
        # Thermal orange/amber heater glow ring
        add_cylinder(f"CVD_HeatRing_{idx}", radius=0.42, depth=0.06, vertices=24,
                     loc=(0, 0, 1.28), mat=pal["emit_orange"], bevel=0.004, parent=ch_grp)
        # Hinged Copper/Gold Showerhead Heater Lid
        lid_piv = make_empty(f"CVD_Lid_{idx}", loc=(0, -0.42, 1.30), parent=ch_grp)
        add_cylinder(f"CVD_Dome_{idx}", radius=0.38, depth=0.22, vertices=24,
                     loc=(0, 0.42, 0.11), mat=pal["copper"], bevel=0.012, parent=lid_piv)
        # Precursor Ampoule Canisters on back of chamber
        for side_x in (-0.22, 0.22):
            add_cylinder(f"CVD_Ampoule_{idx}_{side_x:.2f}", radius=0.09, depth=0.34, vertices=16,
                         loc=(side_x, -0.34, 1.42), mat=pal["brand_blue"], bevel=0.006, parent=ch_grp)

    # Front EFEM + 3 Load Ports
    add_box("CVD_EFEM_Body", (2.32, 0.56, 2.10), (0, 1.08, 1.05), mat=pal["white"], bevel=0.018, parent=root)
    add_box("CVD_EFEM_Crown", (2.36, 0.60, 0.20), (0, 1.08, 2.20), mat=pal["brand_blue_dark"], bevel=0.015, parent=root)
    for idx, lx in enumerate((-0.74, 0.0, 0.74), start=1):
        build_efem_load_port(f"CVD_LP_{idx}", loc=(lx, 1.58, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 3), hot_lot=False)

    build_operator_console("CVD_Console", loc=(-1.20, 1.12, 1.25), rot_z=math.radians(25), parent=root)
    build_signal_tower("CVD_SignalTower", loc=(1.02, 1.12, 2.30), parent=root, state="RUN")
    return root


def build_pvd_metal_cluster(pal, x_off=5.5):
    root = make_empty("Cluster_PVD_Metal", loc=(x_off, 0, 0))
    cy = -0.35

    # Central PVD Ultra-High Vacuum Transfer Chamber
    add_octagonal_prism("PVD_TransferBase", radius=0.94, depth=0.92,
                        loc=(0, cy, 0.46), mat=pal["dark_slate"], bevel=0.015, parent=root, sides=8)
    add_octagonal_prism("PVD_TransferBody", radius=0.98, depth=0.40,
                        loc=(0, cy, 1.12), mat=pal["steel"], bevel=0.015, parent=root, sides=8)
    add_cylinder("PVD_TransferWell", radius=0.72, depth=0.05, vertices=24,
                 loc=(0, cy, 1.31), mat=pal["dark_slate"], bevel=0.005, parent=root)

    _build_vacuum_robot("PVD_Transfer_Arm", loc=(0, cy, 1.36), parent=root, pal=pal)

    # 4 Radial PVD Magnetron Sputter Chambers with Rotating Magnetron Cathodes
    angles_deg = [-80, -28, 28, 80]
    for idx, deg in enumerate(angles_deg, start=1):
        rad = math.radians(deg)
        dist = 1.50
        px = math.sin(rad) * dist
        py = cy - math.cos(rad) * dist

        ch_grp = make_empty(f"PVD_Chamber_{idx}", loc=(px, py, 0), rot=(0, 0, -rad), parent=root)
        add_cylinder(f"PVD_Ped_{idx}", radius=0.38, depth=0.80, vertices=20,
                     loc=(0, 0, 0.40), mat=pal["dark_slate"], bevel=0.010, parent=ch_grp)
        # High-vacuum Cryo Pump cylinder attached on radial exterior
        add_cylinder(f"PVD_CryoPump_{idx}", radius=0.18, depth=0.52, vertices=16,
                     loc=(0, -0.44, 0.72), mat=pal["brand_blue_dark"], bevel=0.008, parent=ch_grp)
        add_cylinder(f"PVD_Body_{idx}", radius=0.46, depth=0.56, vertices=24,
                     loc=(0, 0, 1.08), mat=pal["steel"], bevel=0.014, parent=ch_grp)
        add_cylinder(f"PVD_PlasmaRing_{idx}", radius=0.47, depth=0.06, vertices=24,
                     loc=(0, 0, 1.22), mat=pal["emit_cyan"], bevel=0.004, parent=ch_grp)

        # Articulated Rotating Magnetron Cathode Assembly on top (pivot at chamber center)
        mag_piv = make_empty(f"Magnetron_Rotor_{idx}", loc=(0, 0, 1.40), parent=ch_grp)
        add_cylinder(f"PVD_MagDisk_{idx}", radius=0.34, depth=0.10, vertices=20,
                     loc=(0, 0, 0.05), mat=pal["copper"], bevel=0.008, parent=mag_piv)
        add_box(f"PVD_MagArm_{idx}", (0.52, 0.16, 0.14), (0, 0, 0.16),
                mat=pal["brand_blue"], bevel=0.008, parent=mag_piv)
        add_cylinder(f"PVD_MagWeight_{idx}", radius=0.10, depth=0.16, vertices=16,
                     loc=(0.16, 0, 0.24), mat=pal["chrome"], bevel=0.005, parent=mag_piv)

    # Front EFEM + 3 Load Ports
    add_box("PVD_EFEM_Body", (2.36, 0.58, 2.15), (0, 1.12, 1.08), mat=pal["white"], bevel=0.018, parent=root)
    add_box("PVD_EFEM_Crown", (2.40, 0.62, 0.22), (0, 1.12, 2.24), mat=pal["brand_blue"], bevel=0.015, parent=root)
    for idx, lx in enumerate((-0.76, 0.0, 0.76), start=1):
        build_efem_load_port(f"PVD_LP_{idx}", loc=(lx, 1.64, 0.0), rot_z=0.0,
                             parent=root, with_foup=(idx == 1), hot_lot=False)

    build_operator_console("PVD_Console", loc=(1.22, 1.18, 1.25), rot_z=math.radians(-25), parent=root)
    build_signal_tower("PVD_SignalTower", loc=(-1.04, 1.18, 2.35), parent=root, state="IDLE")
    return root


def main():
    clear_scene()
    pal = get_palette()
    build_plasma_etch_cluster(pal, x_off=-5.5)
    build_cvd_ald_cluster(pal, x_off=0.0)
    build_pvd_metal_cluster(pal, x_off=5.5)
    finalize_and_export_glb("etch_dep_clusters.glb")


if __name__ == "__main__":
    main()
