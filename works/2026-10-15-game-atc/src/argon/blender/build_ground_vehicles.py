import os
import sys
import math
import bmesh
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_common import (
    clear_scene,
    get_standard_materials,
    add_beveled_box,
    add_cylinder_part,
    finalize_mesh_object,
    create_root_node,
    create_wheel_node,
    export_family_glb,
)


def _add_vehicle_lights_and_plates(bm, width, front_y, back_y, z_bumper, mat_head=5, mat_tail=6, mat_plate=7):
    """Add recessed headlights, red taillights, and front/rear license/ID plates."""
    for side in (-1.0, 1.0):
        # Headlights
        add_beveled_box(
            bm, size=(0.24, 0.08, 0.14),
            center=(side * (width * 0.36), front_y + 0.02, z_bumper + 0.18),
            bevel_width=0.015, bevel_segments=1, mat_idx=mat_head
        )
        # Taillights
        add_beveled_box(
            bm, size=(0.22, 0.08, 0.14),
            center=(side * (width * 0.36), back_y - 0.02, z_bumper + 0.18),
            bevel_width=0.015, bevel_segments=1, mat_idx=mat_tail
        )
    # Signage ID plates
    add_beveled_box(bm, size=(0.48, 0.06, 0.14), center=(0.0, front_y + 0.02, z_bumper + 0.06), bevel_width=0.01, mat_idx=mat_plate)
    add_beveled_box(bm, size=(0.48, 0.06, 0.14), center=(0.0, back_y - 0.02, z_bumper + 0.06), bevel_width=0.01, mat_idx=mat_plate)


def build_pushback_tug(x_offset, mats):
    """1. Heavy Low-Profile Pushback Tractor + Pivoting Towbar & 4 Chunky Wheels."""
    root = create_root_node("Vehicle_Pushback_Tug", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    # 0:white, 1:cobalt, 2:slate_dark, 3:glass_dark, 4:steel, 5:emit_white, 6:emit_red, 7:hazard_yellow, 8:emit_amber
    vmats = [
        mats['white'], mats['cobalt'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['hazard_yellow'], mats['emit_amber']
    ]

    # Heavy ballast chassis slab
    add_beveled_box(bm, size=(2.60, 5.40, 0.85), center=(0.0, 0.0, 0.72), bevel_width=0.10, bevel_segments=2, mat_idx=0)
    # Cobalt brand side stripe & heavy front/rear ballast bumpers
    add_beveled_box(bm, size=(2.66, 3.80, 0.28), center=(0.0, 0.0, 0.82), bevel_width=0.04, bevel_segments=1, mat_idx=1)
    add_beveled_box(bm, size=(2.68, 0.55, 0.68), center=(0.0, 2.55, 0.65), bevel_width=0.08, bevel_segments=2, mat_idx=7)
    add_beveled_box(bm, size=(2.68, 0.55, 0.68), center=(0.0, -2.55, 0.65), bevel_width=0.08, bevel_segments=2, mat_idx=7)

    # Forward panoramic operator cab
    add_beveled_box(bm, size=(1.95, 1.85, 0.95), center=(0.0, 1.35, 1.52), bevel_width=0.08, bevel_segments=2, mat_idx=0, scale_top=(0.88, 0.86))
    add_beveled_box(bm, size=(1.82, 1.65, 0.56), center=(0.0, 1.38, 1.58), bevel_width=0.04, bevel_segments=1, mat_idx=3, scale_top=(0.90, 0.88))

    # Rear engine deck with louver vents & amber beacon
    add_beveled_box(bm, size=(2.10, 2.20, 0.42), center=(0.0, -1.10, 1.32), bevel_width=0.06, bevel_segments=2, mat_idx=2)
    for v_idx in range(5):
        add_beveled_box(bm, size=(1.45, 0.16, 0.08), center=(0.0, -0.45 - v_idx * 0.32, 1.54), bevel_width=0.015, mat_idx=4)
    add_cylinder_part(bm, radius1=0.12, radius2=0.10, depth=0.22, segments=12, center=(0.0, 1.35, 2.08), axis='Z', mat_idx=8)

    _add_vehicle_lights_and_plates(bm, 2.55, 2.82, -2.82, 0.48)
    finalize_mesh_object("Tug_Body", bm, vmats, parent=root)

    # Separate Pivoting Towbar at front hitch (pivot at (0,0,0) hitch pin!)
    bm_tb = bmesh.new()
    add_cylinder_part(bm_tb, radius1=0.08, radius2=0.08, depth=3.20, segments=12, center=(0.0, 1.60, 0.0), axis='Y', mat_idx=0)
    add_beveled_box(bm_tb, size=(0.55, 0.52, 0.18), center=(0.0, 3.15, 0.0), bevel_width=0.03, mat_idx=1)
    finalize_mesh_object("Tug_Towbar", bm_tb, [mats['amber'], mats['steel']], parent=root, location=(0.0, 2.82, 0.55))

    # 4 heavy industrial wheels
    for tag, wx, wy in (("FL", -1.18, 1.65), ("FR", 1.18, 1.65), ("RL", -1.18, -1.65), ("RR", 1.18, -1.65)):
        create_wheel_node(f"Tug_Wheel_{tag}", root, (wx, wy, 0.52), radius=0.52, width=0.38, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['cobalt'])


def build_fuel_tanker(x_offset, mats):
    """2. Aviation Jet-A1 Fuel Tanker Truck + Articulated Refueling Boom & 6 Wheels."""
    root = create_root_node("Vehicle_Fuel_Tanker", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    vmats = [
        mats['white'], mats['cobalt'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['crimson'], mats['emit_amber']
    ]

    # Long truck frame rails & side hose lockers
    add_beveled_box(bm, size=(2.30, 8.20, 0.48), center=(0.0, 0.0, 0.65), bevel_width=0.06, mat_idx=2)
    add_beveled_box(bm, size=(2.42, 3.60, 0.62), center=(0.0, -0.55, 0.78), bevel_width=0.06, mat_idx=4)

    # Forward cab with windshield, side windows, mirrors & amber beacon
    add_beveled_box(bm, size=(2.38, 2.15, 1.85), center=(0.0, 2.95, 1.65), bevel_width=0.10, bevel_segments=2, mat_idx=0, scale_top=(0.94, 0.90))
    add_beveled_box(bm, size=(2.12, 0.14, 0.72), center=(0.0, 3.98, 1.92), bevel_width=0.02, mat_idx=3)
    add_beveled_box(bm, size=(2.42, 1.15, 0.65), center=(0.0, 3.10, 1.90), bevel_width=0.02, mat_idx=3)
    add_beveled_box(bm, size=(1.65, 0.12, 0.52), center=(0.0, 4.04, 1.15), bevel_width=0.02, mat_idx=2)
    add_cylinder_part(bm, radius1=0.11, radius2=0.09, depth=0.20, segments=12, center=(0.0, 2.95, 2.66), axis='Z', mat_idx=8)

    # Elliptical cylindrical fuel tank with cobalt livery band, top catwalk & fill hatches
    add_cylinder_part(bm, radius1=1.18, radius2=1.18, depth=5.60, segments=24, center=(0.0, -1.15, 1.95), axis='Y', bevel_width=0.22, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(2.40, 5.20, 0.36), center=(0.0, -1.15, 1.95), bevel_width=0.05, mat_idx=1)
    # Red FLAMMABLE hazard diamond plates on sides & rear
    add_beveled_box(bm, size=(2.44, 0.65, 0.42), center=(0.0, -2.65, 1.95), bevel_width=0.02, mat_idx=7)
    # Top inspection catwalk & 3 dome manholes
    add_beveled_box(bm, size=(0.68, 4.90, 0.10), center=(0.0, -1.15, 3.16), bevel_width=0.02, mat_idx=4)
    for hy in (-2.8, -1.15, 0.5):
        add_cylinder_part(bm, radius1=0.26, radius2=0.24, depth=0.18, segments=14, center=(0.0, hy, 3.24), axis='Z', mat_idx=4)

    _add_vehicle_lights_and_plates(bm, 2.38, 4.05, -4.10, 0.55)
    finalize_mesh_object("Tanker_Body", bm, vmats, parent=root)

    # Separate Pivoting Underwing Refueling Boom Arm (pivot at base swivel (0,0,0)!)
    bm_boom = bmesh.new()
    add_cylinder_part(bm_boom, radius1=0.12, radius2=0.10, depth=1.15, segments=12, center=(0.0, 0.0, 0.55), axis='Z', mat_idx=0)
    add_cylinder_part(bm_boom, radius1=0.08, radius2=0.07, depth=2.45, segments=12, center=(0.0, 1.15, 1.05), axis='Y', rotation=(0.25, 0.0, 0.0), mat_idx=1)
    finalize_mesh_object("Fuel_Boom_Arm", bm_boom, [mats['steel'], mats['cobalt']], parent=root, location=(0.82, 1.55, 1.05))

    # 6 wheels (Front steer + Dual rear tandem axles)
    for tag, wx, wy in (
        ("FL", -1.08, 2.85), ("FR", 1.08, 2.85),
        ("ML", -1.08, -1.85), ("MR", 1.08, -1.85),
        ("RL", -1.08, -3.05), ("RR", 1.08, -3.05),
    ):
        create_wheel_node(f"Tanker_Wheel_{tag}", root, (wx, wy, 0.48), radius=0.48, width=0.32, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['chrome'])


def build_catering_hilift(x_offset, mats):
    """3. High-Lift Catering Truck + Separate Scissor-Lift Mechanism & Rising Box Body."""
    root = create_root_node("Vehicle_Catering_HiLift", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    vmats = [
        mats['white'], mats['cobalt'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['amber'], mats['emit_amber']
    ]

    # Low-entry chassis & cab
    add_beveled_box(bm, size=(2.32, 7.10, 0.44), center=(0.0, 0.0, 0.58), bevel_width=0.06, mat_idx=2)
    add_beveled_box(bm, size=(2.36, 1.95, 1.52), center=(0.0, 2.55, 1.48), bevel_width=0.09, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(2.16, 0.14, 0.65), center=(0.0, 3.48, 1.68), bevel_width=0.02, mat_idx=3)
    add_beveled_box(bm, size=(2.40, 1.05, 0.58), center=(0.0, 2.65, 1.68), bevel_width=0.02, mat_idx=3)
    # Forward aircraft-docking bridge platform over cab roof
    add_beveled_box(bm, size=(2.20, 1.85, 0.18), center=(0.0, 2.60, 2.38), bevel_width=0.03, mat_idx=4)
    add_beveled_box(bm, size=(2.24, 0.24, 0.28), center=(0.0, 3.55, 2.45), bevel_width=0.05, mat_idx=7)

    _add_vehicle_lights_and_plates(bm, 2.32, 3.55, -3.55, 0.48)
    finalize_mesh_object("Catering_Chassis", bm, vmats, parent=root)

    # Separate Scissor-Lift Frame (pivot at base (0,0,0) on chassis bed!)
    bm_sc = bmesh.new()
    for sx in (-0.78, 0.78):
        add_beveled_box(bm_sc, size=(0.12, 3.40, 0.16), center=(sx, 0.0, 0.65), rotation=(0.34, 0.0, 0.0), bevel_width=0.02, mat_idx=0)
        add_beveled_box(bm_sc, size=(0.12, 3.40, 0.16), center=(sx, 0.0, 0.65), rotation=(-0.34, 0.0, 0.0), bevel_width=0.02, mat_idx=0)
    add_cylinder_part(bm_sc, radius1=0.10, radius2=0.08, depth=1.35, segments=12, center=(0.0, 0.2, 0.65), axis='Z', rotation=(-0.35, 0.0, 0.0), mat_idx=1)
    finalize_mesh_object("Catering_Scissor_Lift", bm_sc, [mats['amber'], mats['chrome']], parent=root, location=(0.0, -0.85, 0.80))

    # Separate Insulated Rising Box Body (pivot at bottom center of box (0,0,0)!)
    bm_box = bmesh.new()
    add_beveled_box(bm_box, size=(2.44, 4.65, 2.15), center=(0.0, 0.0, 1.08), bevel_width=0.08, bevel_segments=2, mat_idx=0)
    # Cobalt brand stripe & chiller unit on front wall
    add_beveled_box(bm_box, size=(2.48, 4.20, 0.38), center=(0.0, 0.0, 1.15), bevel_width=0.03, mat_idx=1)
    add_beveled_box(bm_box, size=(1.55, 0.45, 0.62), center=(0.0, 2.42, 1.65), bevel_width=0.05, mat_idx=2)
    # Roll-up front/rear loading doors
    add_beveled_box(bm_box, size=(1.45, 0.08, 1.65), center=(0.0, -2.31, 0.98), bevel_width=0.02, mat_idx=2)
    finalize_mesh_object("Catering_Box_Body", bm_box, [mats['white'], mats['cobalt'], mats['steel']], parent=root, location=(0.0, -0.85, 1.85))

    for tag, wx, wy in (("FL", -1.06, 2.35), ("FR", 1.06, 2.35), ("RL", -1.06, -2.15), ("RR", 1.06, -2.15)):
        create_wheel_node(f"Catering_Wheel_{tag}", root, (wx, wy, 0.46), radius=0.46, width=0.30, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['chrome'])


def build_baggage_tractor_and_carts(x_offset, mats):
    """4. Electric Baggage Tractor + 2 Articulated Baggage Dollies with ULD Containers."""
    root = create_root_node("Vehicle_Baggage_Tractor_Carts", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    vmats = [
        mats['white'], mats['cobalt'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['amber'], mats['emit_amber']
    ]

    # Compact electric tow tractor at front (+Y)
    ty = 3.20
    add_beveled_box(bm, size=(1.58, 2.85, 0.68), center=(0.0, ty, 0.58), bevel_width=0.08, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(1.62, 2.20, 0.22), center=(0.0, ty, 0.62), bevel_width=0.03, mat_idx=1)
    add_beveled_box(bm, size=(1.42, 1.45, 1.05), center=(0.0, ty - 0.15, 1.38), bevel_width=0.07, bevel_segments=2, mat_idx=0, scale_top=(0.88, 0.85))
    add_beveled_box(bm, size=(1.30, 1.25, 0.62), center=(0.0, ty - 0.12, 1.42), bevel_width=0.03, mat_idx=3)
    add_cylinder_part(bm, radius1=0.09, radius2=0.08, depth=0.18, segments=10, center=(0.0, ty - 0.15, 1.98), axis='Z', mat_idx=8)

    _add_vehicle_lights_and_plates(bm, 1.55, ty + 1.42, ty - 1.42, 0.38)
    finalize_mesh_object("Tractor_Body", bm, vmats, parent=root)

    for tag, wx, wy in (("FL", -0.74, ty + 0.88), ("FR", 0.74, ty + 0.88), ("RL", -0.74, ty - 0.88), ("RR", 0.74, ty - 0.88)):
        create_wheel_node(f"Tractor_Wheel_{tag}", root, (wx, wy, 0.34), radius=0.34, width=0.22, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['cobalt'])

    # Two articulated baggage dolly carts trailing behind (-Y)
    for idx, (cy, uld_mat) in enumerate(((0.0, mats['cobalt']), (-3.15, mats['amber'])), start=1):
        cart_node = create_root_node(f"Dolly_Cart_{idx}", location=(0.0, cy, 0.0), parent=root)
        bm_c = bmesh.new()
        # Steel roller bed frame
        add_beveled_box(bm_c, size=(1.75, 2.35, 0.18), center=(0.0, 0.0, 0.42), bevel_width=0.03, mat_idx=0)
        # Moulded aviation ULD baggage container with angled lower corners & cargo door
        add_beveled_box(bm_c, size=(1.62, 1.95, 1.38), center=(0.0, 0.0, 1.20), bevel_width=0.07, bevel_segments=2, mat_idx=1)
        add_beveled_box(bm_c, size=(1.66, 1.35, 0.92), center=(0.0, 0.0, 1.22), bevel_width=0.02, mat_idx=2)
        finalize_mesh_object(f"Dolly_Bed_ULD_{idx}", bm_c, [mats['steel'], mats['white'], uld_mat], parent=cart_node)

        # Hinged tow tongue at front of cart (pivot at (0,0,0))
        bm_t = bmesh.new()
        add_beveled_box(bm_t, size=(0.14, 0.78, 0.08), center=(0.0, 0.38, 0.0), bevel_width=0.015, mat_idx=0)
        finalize_mesh_object(f"Dolly_Tongue_{idx}", bm_t, [mats['amber']], parent=cart_node, location=(0.0, 1.18, 0.40))

        for tag, wx, wy in (("FL", -0.78, 0.75), ("FR", 0.78, 0.75), ("RL", -0.78, -0.75), ("RR", 0.78, -0.75)):
            create_wheel_node(f"Dolly{idx}_Wheel_{tag}", cart_node, (wx, wy, 0.24), radius=0.24, width=0.16, mat_tire=mats['tire'], mat_rim=mats['steel'])


def build_followme_van(x_offset, mats):
    """5. Airport 'FOLLOW ME' Marshalling SUV/Van + Folding Rooftop LED Matrix SignBoard."""
    root = create_root_node("Vehicle_FollowMe_Van", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    vmats = [
        mats['amber'], mats['hazard_yellow'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['white'], mats['emit_amber']
    ]

    # Lower body & upper greenhouse
    add_beveled_box(bm, size=(1.92, 4.45, 0.78), center=(0.0, 0.0, 0.68), bevel_width=0.09, bevel_segments=2, mat_idx=0)
    add_beveled_box(bm, size=(1.96, 3.60, 0.28), center=(0.0, -0.15, 0.72), bevel_width=0.03, mat_idx=1)
    add_beveled_box(bm, size=(1.76, 2.95, 0.72), center=(0.0, -0.32, 1.36), bevel_width=0.08, bevel_segments=2, mat_idx=0, scale_top=(0.88, 0.90))
    add_beveled_box(bm, size=(1.62, 2.75, 0.48), center=(0.0, -0.30, 1.38), bevel_width=0.03, mat_idx=3, scale_top=(0.90, 0.92))

    # Front grille & roof amber lightbar
    add_beveled_box(bm, size=(1.25, 0.10, 0.34), center=(0.0, 2.20, 0.68), bevel_width=0.02, mat_idx=2)
    add_beveled_box(bm, size=(1.18, 0.28, 0.14), center=(0.0, 0.55, 1.78), bevel_width=0.03, mat_idx=8)

    _add_vehicle_lights_and_plates(bm, 1.88, 2.22, -2.22, 0.42)
    finalize_mesh_object("FollowMe_Body", bm, vmats, parent=root)

    # Separate Folding Rooftop LED Signboard (pivot at bottom hinge (0,0,0)!)
    bm_sign = bmesh.new()
    add_beveled_box(bm_sign, size=(1.38, 0.14, 0.68), center=(0.0, 0.0, 0.36), bevel_width=0.03, mat_idx=0)
    # Glowing amber matrix arrows & chevrons on rear face
    add_beveled_box(bm_sign, size=(1.22, 0.06, 0.52), center=(0.0, -0.06, 0.36), bevel_width=0.015, mat_idx=1)
    finalize_mesh_object("FollowMe_SignBoard", bm_sign, [mats['slate_dark'], mats['emit_amber']], parent=root, location=(0.0, -1.15, 1.72))

    for tag, wx, wy in (("FL", -0.88, 1.35), ("FR", 0.88, 1.35), ("RL", -0.88, -1.35), ("RR", 0.88, -1.35)):
        create_wheel_node(f"FollowMe_Wheel_{tag}", root, (wx, wy, 0.38), radius=0.38, width=0.25, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['chrome'])


def build_arff_crashtender(x_offset, mats):
    """6. 6x6 Airport Rescue & Firefighting Crash Tender + Rotating Roof Foam Cannon Boom."""
    root = create_root_node("Vehicle_ARFF_CrashTender", location=(x_offset, 0.0, 0.0))
    bm = bmesh.new()
    vmats = [
        mats['crimson'], mats['white'], mats['slate_dark'], mats['glass_dark'],
        mats['steel'], mats['emit_white'], mats['emit_red'], mats['hazard_yellow'], mats['emit_amber']
    ]

    # Aggressive chamfered 6x6 heavy chassis & water/foam tank body
    add_beveled_box(bm, size=(2.75, 8.60, 0.65), center=(0.0, 0.0, 0.78), bevel_width=0.08, mat_idx=2)
    add_beveled_box(bm, size=(2.82, 8.40, 1.65), center=(0.0, 0.0, 1.82), bevel_width=0.14, bevel_segments=2, mat_idx=0, scale_top=(0.92, 0.94))
    # High-vis white/yellow stripe & aluminum equipment roll-up shutters along sides
    add_beveled_box(bm, size=(2.86, 7.80, 0.28), center=(0.0, -0.15, 1.42), bevel_width=0.03, mat_idx=1)
    for sy in (-2.55, -0.95, 0.65):
        add_beveled_box(bm, size=(2.88, 1.25, 0.95), center=(0.0, sy, 1.85), bevel_width=0.03, mat_idx=4)

    # Angled panoramic forward tactical cab
    add_beveled_box(bm, size=(2.58, 1.85, 0.78), center=(0.0, 3.35, 2.02), bevel_width=0.06, mat_idx=3, scale_top=(0.90, 0.85))
    # Roof emergency lightbars
    add_beveled_box(bm, size=(1.95, 0.36, 0.18), center=(0.0, 3.25, 2.74), bevel_width=0.04, mat_idx=6)
    add_beveled_box(bm, size=(1.95, 0.36, 0.18), center=(0.0, -3.65, 2.74), bevel_width=0.04, mat_idx=8)

    _add_vehicle_lights_and_plates(bm, 2.70, 4.30, -4.30, 0.65)
    finalize_mesh_object("ARFF_Body", bm, vmats, parent=root)

    # Separate Rotating Roof Water/Foam Monitor Turret Boom (pivot at turret swivel (0,0,0)!)
    bm_tur = bmesh.new()
    add_cylinder_part(bm_tur, radius1=0.34, radius2=0.28, depth=0.38, segments=16, center=(0.0, 0.0, 0.19), axis='Z', mat_idx=0)
    add_cylinder_part(bm_tur, radius1=0.14, radius2=0.11, depth=1.85, segments=14, center=(0.0, 0.75, 0.48), axis='Y', rotation=(0.18, 0.0, 0.0), mat_idx=1)
    add_cylinder_part(bm_tur, radius1=0.16, radius2=0.18, depth=0.32, segments=14, center=(0.0, 1.65, 0.65), axis='Y', rotation=(0.18, 0.0, 0.0), mat_idx=2)
    finalize_mesh_object("Turret_Boom", bm_tur, [mats['steel'], mats['white'], mats['crimson']], parent=root, location=(0.0, 2.15, 2.65))

    for tag, wx, wy in (
        ("FL", -1.26, 2.65), ("FR", 1.26, 2.65),
        ("ML", -1.26, -1.25), ("MR", 1.26, -1.25),
        ("RL", -1.26, -2.75), ("RR", 1.26, -2.75),
    ):
        create_wheel_node(f"ARFF_Wheel_{tag}", root, (wx, wy, 0.58), radius=0.58, width=0.40, mat_tire=mats['tire'], mat_rim=mats['steel'], mat_hub=mats['crimson'])


def build_ground_vehicles(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_pushback_tug(-20.0, mats)
    build_fuel_tanker(-12.0, mats)
    build_catering_hilift(-4.0, mats)
    build_baggage_tractor_and_carts(4.0, mats)
    build_followme_van(12.0, mats)
    build_arff_crashtender(20.0, mats)

    export_family_glb(os.path.join(output_dir, "ground_vehicles.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_ground_vehicles(out_dir)
