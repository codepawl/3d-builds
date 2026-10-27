import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import argon_fab_lib as fl


def create_rigged_bunny_suit_character(
    variant_name,
    root_loc,
    suit_mat,
    accent_mat,
    prop_type="tablet",
    pal=None,
):
    """Create a chunky, readable cleanroom engineer in a full bunny suit,
    bound to a complete humanoid Armature with 5 named NLA animation clips:
    Idle, Walk, Inspect, CarryFOUP, WorkConsole.
    """
    if pal is None:
        pal = fl.get_palette()

    # 1. Create Armature at root_loc
    arm_data = bpy.data.armatures.new(f"{variant_name}_ArmData")
    arm_obj = bpy.data.objects.new(variant_name, arm_data)
    arm_obj.location = Vector(root_loc)
    bpy.context.collection.objects.link(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(bname, head, tail, parent_bone=None):
        b = eb.new(bname)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent_bone:
            b.parent = parent_bone
        return b

    b_root = add_bone("Root", (0, 0, 0.0), (0, 0, 0.25))
    b_hips = add_bone("Hips", (0, 0, 0.86), (0, 0, 1.02), b_root)
    b_spine = add_bone("Spine", (0, 0, 1.02), (0, 0, 1.38), b_hips)
    b_head = add_bone("Head", (0, 0, 1.40), (0, 0, 1.78), b_spine)

    b_uarm_l = add_bone("UpperArm_L", (-0.23, 0, 1.34), (-0.26, 0, 1.06), b_spine)
    b_farm_l = add_bone("Forearm_L", (-0.26, 0, 1.06), (-0.26, -0.06, 0.78), b_uarm_l)

    b_uarm_r = add_bone("UpperArm_R", (0.23, 0, 1.34), (0.26, 0, 1.06), b_spine)
    b_farm_r = add_bone("Forearm_R", (0.26, 0, 1.06), (0.26, -0.06, 0.78), b_uarm_r)

    b_thigh_l = add_bone("Thigh_L", (-0.11, 0, 0.86), (-0.11, 0, 0.46), b_hips)
    b_shin_l = add_bone("Shin_L", (-0.11, 0, 0.46), (-0.11, 0, 0.05), b_thigh_l)

    b_thigh_r = add_bone("Thigh_R", (0.11, 0, 0.86), (0.11, 0, 0.46), b_hips)
    b_shin_r = add_bone("Shin_R", (0.11, 0, 0.46), (0.11, 0, 0.05), b_thigh_r)

    bpy.ops.object.mode_set(mode="OBJECT")

    # 2. Build modular body parts with bone tags, then merge into a single skinned Mesh
    part_specs = []

    def add_part(pname, bone_name, obj):
        part_specs.append((bone_name, obj))

    # Pelvis / Hips
    add_part("hips", "Hips", fl.add_bevel_box(f"{variant_name}_hips", (0.34, 0.24, 0.20), (0, 0, 0.90), bevel_width=0.04, mat=suit_mat))
    # PAPR Cleanroom HEPA Belt Pack on back of waist
    add_part("papr", "Hips", fl.add_bevel_box(f"{variant_name}_papr", (0.22, 0.10, 0.14), (0, 0.15, 0.96), bevel_width=0.02, mat=pal["slate"]))
    add_part("papr_led", "Hips", fl.add_bevel_box(f"{variant_name}_pled", (0.08, 0.02, 0.03), (0, 0.20, 0.99), bevel_width=0.004, mat=pal["emit_green"]))

    # Torso / Coverall Chest + Accent Shoulder Yoke + Front Zipper Strip
    add_part("torso", "Spine", fl.add_bevel_box(f"{variant_name}_torso", (0.38, 0.26, 0.40), (0, 0, 1.18), bevel_width=0.05, mat=suit_mat))
    add_part("yoke", "Spine", fl.add_bevel_box(f"{variant_name}_yoke", (0.42, 0.28, 0.11), (0, 0, 1.34), bevel_width=0.03, mat=accent_mat))
    add_part("zip", "Spine", fl.add_bevel_box(f"{variant_name}_zip", (0.04, 0.02, 0.36), (0, -0.13, 1.18), bevel_width=0.005, mat=pal["slate"]))
    add_part("badge", "Spine", fl.add_bevel_box(f"{variant_name}_badge", (0.09, 0.02, 0.06), (-0.11, -0.135, 1.26), bevel_width=0.005, mat=pal["brand_blue"]))

    # Bunny-Suit Hooded Head + Goggles Visor + Cleanroom Face Mask
    add_part("hood", "Head", fl.add_bevel_box(f"{variant_name}_hood", (0.28, 0.29, 0.32), (0, 0, 1.56), bevel_width=0.07, mat=suit_mat))
    add_part("goggles", "Head", fl.add_bevel_box(f"{variant_name}_goggles", (0.24, 0.08, 0.10), (0, -0.125, 1.59), bevel_width=0.02, mat=pal["glass_dark"]))
    add_part("goggle_rim", "Head", fl.add_bevel_box(f"{variant_name}_grim", (0.25, 0.06, 0.11), (0, -0.115, 1.59), bevel_width=0.015, mat=accent_mat))
    add_part("mask", "Head", fl.add_bevel_box(f"{variant_name}_mask", (0.20, 0.07, 0.11), (0, -0.125, 1.48), bevel_width=0.02, mat=pal["white"]))

    # Left & Right Arms + Blue Nitrile Cleanroom Gloves
    add_part("uarm_l", "UpperArm_L", fl.add_bevel_cylinder(f"{variant_name}_ual", 0.068, 0.28, 14, (-0.25, 0, 1.20), bevel_width=0.02, mat=suit_mat))
    add_part("farm_l", "Forearm_L", fl.add_bevel_cylinder(f"{variant_name}_fal", 0.060, 0.24, 14, (-0.26, -0.02, 0.94), bevel_width=0.015, mat=suit_mat))
    add_part("glove_l", "Forearm_L", fl.add_bevel_box(f"{variant_name}_gl", (0.09, 0.11, 0.11), (-0.26, -0.04, 0.78), bevel_width=0.02, mat=pal["nitrile_glove"]))

    add_part("uarm_r", "UpperArm_R", fl.add_bevel_cylinder(f"{variant_name}_uar", 0.068, 0.28, 14, (0.25, 0, 1.20), bevel_width=0.02, mat=suit_mat))
    add_part("farm_r", "Forearm_R", fl.add_bevel_cylinder(f"{variant_name}_far", 0.060, 0.24, 14, (0.26, -0.02, 0.94), bevel_width=0.015, mat=suit_mat))
    add_part("glove_r", "Forearm_R", fl.add_bevel_box(f"{variant_name}_gr", (0.09, 0.11, 0.11), (0.26, -0.04, 0.78), bevel_width=0.02, mat=pal["nitrile_glove"]))

    # Role-specific Cleanroom Handheld Prop attached to Forearm_R
    if prop_type == "tablet":
        add_part("prop", "Forearm_R", fl.add_bevel_box(f"{variant_name}_tab", (0.22, 0.16, 0.02), (0.22, -0.14, 0.80), rot=(0.35, 0, 0), bevel_width=0.005, mat=pal["console_screen"]))
    elif prop_type == "reticle_case":
        add_part("prop", "Forearm_R", fl.add_bevel_box(f"{variant_name}_rcase", (0.24, 0.24, 0.06), (0.26, -0.12, 0.76), bevel_width=0.01, mat=pal["emit_amber"]))
    elif prop_type == "tool_kit":
        add_part("prop", "Forearm_R", fl.add_bevel_box(f"{variant_name}_tkit", (0.14, 0.28, 0.20), (0.34, -0.04, 0.68), bevel_width=0.015, mat=pal["brand_blue"]))
    else:
        add_part("prop", "Forearm_R", fl.add_bevel_box(f"{variant_name}_scan", (0.07, 0.16, 0.09), (0.26, -0.12, 0.80), bevel_width=0.01, mat=pal["emit_cyan"]))

    # Left & Right Legs + Knee-High Cleanroom Booties
    add_part("thigh_l", "Thigh_L", fl.add_bevel_cylinder(f"{variant_name}_thl", 0.082, 0.40, 14, (-0.11, 0, 0.66), bevel_width=0.02, mat=suit_mat))
    add_part("shin_l", "Shin_L", fl.add_bevel_cylinder(f"{variant_name}_shl", 0.075, 0.38, 14, (-0.11, 0, 0.28), bevel_width=0.015, mat=suit_mat))
    add_part("boot_l", "Shin_L", fl.add_bevel_box(f"{variant_name}_btl", (0.13, 0.24, 0.11), (-0.11, -0.04, 0.055), bevel_width=0.02, mat=accent_mat))

    add_part("thigh_r", "Thigh_R", fl.add_bevel_cylinder(f"{variant_name}_thr", 0.082, 0.40, 14, (0.11, 0, 0.66), bevel_width=0.02, mat=suit_mat))
    add_part("shin_r", "Shin_R", fl.add_bevel_cylinder(f"{variant_name}_shr", 0.075, 0.38, 14, (0.11, 0, 0.28), bevel_width=0.015, mat=suit_mat))
    add_part("boot_r", "Shin_R", fl.add_bevel_box(f"{variant_name}_btr", (0.13, 0.24, 0.11), (0.11, -0.04, 0.055), bevel_width=0.02, mat=accent_mat))

    # Combine all parts into one Mesh using native per-part vertex group + transform_apply + join
    bpy.ops.object.select_all(action="DESELECT")
    part_objs = []
    for bname, pobj in part_specs:
        vg = pobj.vertex_groups.new(name=bname)
        vg.add(list(range(len(pobj.data.vertices))), 1.0, "REPLACE")
        pobj.select_set(True)
        part_objs.append(pobj)

    bpy.context.view_layer.objects.active = part_objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()

    char_mesh_obj = bpy.context.view_layer.objects.active
    char_mesh_obj.name = f"{variant_name}_Mesh"
    char_mesh_obj.data.name = f"{variant_name}_MeshData"
    char_mesh_obj.parent = arm_obj
    char_mesh_obj.location = Vector((0.0, 0.0, 0.0))
    bpy.ops.object.select_all(action="DESELECT")

    arm_mod = char_mesh_obj.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = arm_obj

    # 3. Create 5 Named Animation Clips on the Armature (Idle, Walk, Inspect, CarryFOUP, WorkConsole)
    arm_obj.animation_data_create()
    pbones = arm_obj.pose.bones
    for pb in pbones:
        pb.rotation_mode = "XYZ"

    def reset_pose():
        for pb in pbones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)

    def key_all(frame):
        for bname in ("Hips", "Spine", "Head", "UpperArm_L", "Forearm_L", "UpperArm_R", "Forearm_R", "Thigh_L", "Shin_L", "Thigh_R", "Shin_R"):
            pb = pbones[bname]
            pb.keyframe_insert(data_path="rotation_euler", frame=frame)
            if bname == "Hips":
                pb.keyframe_insert(data_path="location", frame=frame)

    def bake_clip(clip_name, keyframes_fn):
        act = bpy.data.actions.new(name=f"{variant_name}_{clip_name}")
        arm_obj.animation_data.action = act
        keyframes_fn()
        if hasattr(arm_obj.animation_data, "action_slot") and hasattr(act, "slots") and len(act.slots) > 0:
            slot = arm_obj.animation_data.action_slot
        else:
            slot = None
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, act)
        strip.name = clip_name
        if slot is not None and hasattr(strip, "action_slot"):
            try:
                strip.action_slot = slot
            except Exception:
                pass
        track.mute = True
        arm_obj.animation_data.action = None

    # Clip 1: Idle (breathing + subtle head look)
    def anim_idle():
        reset_pose()
        key_all(1)
        pbones["Hips"].location = (0, 0, -0.015)
        pbones["Spine"].rotation_euler = (0.04, 0, 0)
        pbones["Head"].rotation_euler = (0, 0, 0.12)
        pbones["UpperArm_L"].rotation_euler = (0.06, 0, 0.05)
        pbones["UpperArm_R"].rotation_euler = (-0.12, 0, -0.05)
        key_all(13)
        reset_pose()
        key_all(25)

    # Clip 2: Walk (cleanroom bay stride)
    def anim_walk():
        reset_pose()
        pbones["Thigh_L"].rotation_euler = (0.42, 0, 0)
        pbones["Shin_L"].rotation_euler = (-0.18, 0, 0)
        pbones["Thigh_R"].rotation_euler = (-0.42, 0, 0)
        pbones["Shin_R"].rotation_euler = (-0.35, 0, 0)
        pbones["UpperArm_L"].rotation_euler = (-0.35, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.35, 0, 0)
        pbones["Hips"].location = (0, 0, 0.02)
        key_all(1)

        pbones["Thigh_L"].rotation_euler = (-0.42, 0, 0)
        pbones["Shin_L"].rotation_euler = (-0.35, 0, 0)
        pbones["Thigh_R"].rotation_euler = (0.42, 0, 0)
        pbones["Shin_R"].rotation_euler = (-0.18, 0, 0)
        pbones["UpperArm_L"].rotation_euler = (0.35, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (-0.35, 0, 0)
        pbones["Hips"].location = (0, 0, -0.02)
        key_all(13)

        pbones["Thigh_L"].rotation_euler = (0.42, 0, 0)
        pbones["Shin_L"].rotation_euler = (-0.18, 0, 0)
        pbones["Thigh_R"].rotation_euler = (-0.42, 0, 0)
        pbones["Shin_R"].rotation_euler = (-0.35, 0, 0)
        pbones["UpperArm_L"].rotation_euler = (-0.35, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.35, 0, 0)
        pbones["Hips"].location = (0, 0, 0.02)
        key_all(25)

    # Clip 3: Inspect (raising tablet/instrument & checking wafer load port)
    def anim_inspect():
        reset_pose()
        pbones["UpperArm_R"].rotation_euler = (0.55, 0, 0)
        pbones["Forearm_R"].rotation_euler = (0.65, 0, 0)
        pbones["Head"].rotation_euler = (-0.15, 0, -0.18)
        key_all(1)
        pbones["Spine"].rotation_euler = (0.12, 0, 0.10)
        pbones["Head"].rotation_euler = (0.10, 0, 0.22)
        pbones["UpperArm_L"].rotation_euler = (0.45, 0, 0)
        key_all(13)
        reset_pose()
        pbones["UpperArm_R"].rotation_euler = (0.55, 0, 0)
        pbones["Forearm_R"].rotation_euler = (0.65, 0, 0)
        pbones["Head"].rotation_euler = (-0.15, 0, -0.18)
        key_all(25)

    # Clip 4: CarryFOUP (both arms raised forward holding a FOUP pod)
    def anim_carry():
        reset_pose()
        pbones["UpperArm_L"].rotation_euler = (0.52, 0, -0.12)
        pbones["Forearm_L"].rotation_euler = (0.72, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.52, 0, 0.12)
        pbones["Forearm_R"].rotation_euler = (0.72, 0, 0)
        pbones["Thigh_L"].rotation_euler = (0.28, 0, 0)
        pbones["Thigh_R"].rotation_euler = (-0.28, 0, 0)
        key_all(1)
        pbones["Thigh_L"].rotation_euler = (-0.28, 0, 0)
        pbones["Thigh_R"].rotation_euler = (0.28, 0, 0)
        pbones["Hips"].location = (0, 0, 0.015)
        key_all(13)
        pbones["Thigh_L"].rotation_euler = (0.28, 0, 0)
        pbones["Thigh_R"].rotation_euler = (-0.28, 0, 0)
        pbones["Hips"].location = (0, 0, 0.0)
        key_all(25)

    # Clip 5: WorkConsole (typing / operating tool touchscreen console)
    def anim_console():
        reset_pose()
        pbones["UpperArm_L"].rotation_euler = (0.48, 0, 0)
        pbones["Forearm_L"].rotation_euler = (0.58, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.58, 0, 0)
        pbones["Forearm_R"].rotation_euler = (0.45, 0, 0)
        key_all(1)
        pbones["UpperArm_L"].rotation_euler = (0.58, 0, 0)
        pbones["Forearm_L"].rotation_euler = (0.45, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.48, 0, 0)
        pbones["Forearm_R"].rotation_euler = (0.62, 0, 0)
        pbones["Head"].rotation_euler = (0.08, 0, 0.08)
        key_all(13)
        pbones["UpperArm_L"].rotation_euler = (0.48, 0, 0)
        pbones["Forearm_L"].rotation_euler = (0.58, 0, 0)
        pbones["UpperArm_R"].rotation_euler = (0.58, 0, 0)
        pbones["Forearm_R"].rotation_euler = (0.45, 0, 0)
        pbones["Head"].rotation_euler = (0.0, 0, 0.0)
        key_all(25)

    bake_clip("Idle", anim_idle)
    bake_clip("Walk", anim_walk)
    bake_clip("Inspect", anim_inspect)
    bake_clip("CarryFOUP", anim_carry)
    bake_clip("WorkConsole", anim_console)
    reset_pose()
    bpy.context.scene.frame_set(1)
    for trk in arm_obj.animation_data.nla_tracks:
        trk.mute = False

    return arm_obj


def build_fab_characters():
    fl.clear_scene()
    pal = fl.get_palette()

    create_rigged_bunny_suit_character(
        "Engineer_Process_White",
        root_loc=(-3.0, 0.0, 0.0),
        suit_mat=pal["suit_white"],
        accent_mat=pal["brand_blue"],
        prop_type="tablet",
        pal=pal,
    )
    create_rigged_bunny_suit_character(
        "Engineer_Litho_Amber",
        root_loc=(-1.0, 0.0, 0.0),
        suit_mat=pal["suit_white"],
        accent_mat=pal["suit_amber"],
        prop_type="reticle_case",
        pal=pal,
    )
    create_rigged_bunny_suit_character(
        "Technician_Maint_Blue",
        root_loc=(1.0, 0.0, 0.0),
        suit_mat=pal["suit_blue"],
        accent_mat=pal["safety_yellow"],
        prop_type="tool_kit",
        pal=pal,
    )
    create_rigged_bunny_suit_character(
        "Operator_Lead_Teal",
        root_loc=(3.0, 0.0, 0.0),
        suit_mat=pal["suit_white"],
        accent_mat=pal["suit_teal"],
        prop_type="scanner",
        pal=pal,
    )

    fl.export_glb("fab_characters.glb")


def create_axial_fan(name, loc, radius=0.95, parent=None, pal=None):
    hub = fl.add_bevel_cylinder(
        name,
        radius=radius * 0.28,
        depth=0.18,
        vertices=16,
        loc=loc,
        bevel_width=0.015,
        mat=pal["brand_blue"],
        parent=parent,
    )
    blades = []
    for i in range(6):
        ang = i * (math.pi / 3.0)
        bx = math.cos(ang) * (radius * 0.54)
        by = math.sin(ang) * (radius * 0.54)
        blade = fl.add_bevel_box(
            f"{name}_b{i}",
            size=(radius * 0.64, radius * 0.22, 0.035),
            loc=(loc[0] + bx, loc[1] + by, loc[2] + 0.02),
            rot=(0.30 * math.sin(ang), 0.30 * math.cos(ang), ang),
            bevel_width=0.005,
            mat=pal["silver"],
            parent=parent,
        )
        blades.append(blade)
    return fl.merge_objects_into(hub, blades)


def build_support_plant_buildings():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: Plant_UPW_System (Ultra-Pure Water Treatment Plant)
    # =========================================================================
    p1_root = fl.make_root("Plant_UPW_System", loc=(-16.0, 0.0, 0.0))
    pad1 = fl.add_bevel_box(
        "UPW_Foundation",
        size=(8.5, 6.5, 0.35),
        loc=(0.0, 0.0, 0.175),
        bevel_width=0.04,
        mat=pal["concrete"],
        parent=p1_root,
    )
    p1_parts = []
    # Twin tall Ultra-Pure Water Storage Silos with Cobalt & Teal bands
    for sx in (-2.4, -0.4):
        silo = fl.add_bevel_cylinder(
            f"upw_silo_{sx}",
            radius=0.88,
            depth=4.2,
            vertices=24,
            loc=(sx, 1.4, 2.45),
            bevel_width=0.04,
            mat=pal["white"],
            parent=p1_root,
        )
        band = fl.add_bevel_cylinder(
            f"upw_band_{sx}",
            radius=0.90,
            depth=0.35,
            vertices=24,
            loc=(sx, 1.4, 3.85),
            bevel_width=0.015,
            mat=pal["upw_teal"],
            parent=p1_root,
        )
        p1_parts.extend([silo, band])

    # Reverse Osmosis (RO) Membrane Pressure Tube Skid & UV TOC Reactors
    ro_skid = fl.add_bevel_box(
        "upw_ro_skid",
        size=(3.6, 2.2, 2.1),
        loc=(2.0, 1.2, 1.4),
        bevel_width=0.03,
        mat=pal["white"],
        parent=p1_root,
    )
    p1_parts.append(ro_skid)
    for rz in (0.95, 1.45, 1.95):
        tube = fl.add_bevel_cylinder(
            f"upw_rotube_{rz}",
            radius=0.18,
            depth=3.2,
            vertices=16,
            loc=(2.0, -0.05, rz),
            rot=(0.0, math.pi / 2.0, 0.0),
            bevel_width=0.015,
            mat=pal["upw_teal"],
            parent=p1_root,
        )
        p1_parts.append(tube)

    # 3 Mixed-Bed Deionization Polishing Columns with glowing UV TOC sight tubes
    for dx in (-2.5, -1.2, 0.1):
        di_col = fl.add_bevel_cylinder(
            f"upw_di_{dx}",
            radius=0.42,
            depth=2.4,
            vertices=20,
            loc=(dx, -1.5, 1.55),
            bevel_width=0.025,
            mat=pal["brand_blue"],
            parent=p1_root,
        )
        uv_glow = fl.add_bevel_cylinder(
            f"upw_uv_{dx}",
            radius=0.14,
            depth=1.8,
            vertices=16,
            loc=(dx + 0.52, -1.5, 1.35),
            bevel_width=0.01,
            mat=pal["emit_cyan"],
            parent=p1_root,
        )
        p1_parts.extend([di_col, uv_glow])

    # Degasifier blower column housing beneath UPWBlowerFan
    blower_col = fl.add_bevel_cylinder(
        "upw_blower_col",
        radius=0.66,
        depth=0.90,
        vertices=24,
        loc=(2.4, -1.6, 0.78),
        bevel_width=0.025,
        mat=pal["white"],
        parent=p1_root,
    )
    blower_rim = fl.add_bevel_cylinder(
        "upw_blower_rim",
        radius=0.58,
        depth=0.08,
        vertices=24,
        loc=(2.4, -1.6, 1.22),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=p1_root,
    )
    p1_parts.extend([blower_col, blower_rim])

    fl.merge_objects_into(pad1, p1_parts)
    create_axial_fan("UPWBlowerFan", loc=(2.4, -1.6, 1.28), radius=0.55, parent=p1_root, pal=pal)

    # =========================================================================
    # VARIANT 2: Plant_GasYard_Cryo (Bulk Industrial Cryogenic Gas Yard)
    # =========================================================================
    p2_root = fl.make_root("Plant_GasYard_Cryo", loc=(-5.5, 0.0, 0.0))
    pad2 = fl.add_bevel_box(
        "GasYard_Pad",
        size=(8.0, 6.5, 0.35),
        loc=(0.0, 0.0, 0.175),
        bevel_width=0.04,
        mat=pal["concrete"],
        parent=p2_root,
    )
    p2_parts = []
    # 3 Tall Vertical Cryogenic Dewars (LN2, LOX, LAr)
    for idx, gx in enumerate((-2.3, 0.0, 2.3), start=1):
        dewar = fl.add_bevel_cylinder(
            f"cryo_dewar_{idx}",
            radius=0.82,
            depth=4.8,
            vertices=24,
            loc=(gx, 1.2, 2.75),
            bevel_width=0.05,
            mat=pal["white"],
            parent=p2_root,
        )
        stripe = fl.add_bevel_cylinder(
            f"cryo_stripe_{idx}",
            radius=0.84,
            depth=0.38,
            vertices=24,
            loc=(gx, 1.2, 4.25),
            bevel_width=0.015,
            mat=pal["brand_blue"] if idx != 2 else pal["upw_teal"],
            parent=p2_root,
        )
        p2_parts.extend([dewar, stripe])

    # Finned Ambient Atmospheric Vaporizer Towers in front
    for vx in (-2.2, -0.8, 0.8, 2.2):
        vap = fl.add_bevel_box(
            f"cryo_vap_{vx}",
            size=(0.85, 0.85, 2.85),
            loc=(vx, -1.35, 1.78),
            bevel_width=0.02,
            mat=pal["silver"],
            parent=p2_root,
        )
        p2_parts.append(vap)

    fl.merge_objects_into(pad2, p2_parts)
    fl.add_bevel_box(
        "GasYardGate",
        size=(1.8, 0.08, 1.25),
        loc=(-0.9, -3.1, 0.35),
        bevel_width=0.01,
        mat=pal["safety_yellow"],
        parent=p2_root,
        pivot_offset=(0.9, 0.0, 0.625),
    )

    # =========================================================================
    # VARIANT 3: Plant_CoolingTowers (3-Cell Modular Induced-Draft Cooling Bank)
    # =========================================================================
    p3_root = fl.make_root("Plant_CoolingTowers", loc=(5.5, 0.0, 0.0))
    basin = fl.add_bevel_box(
        "CoolingTower_Basin",
        size=(9.2, 5.2, 0.75),
        loc=(0.0, 0.0, 0.375),
        bevel_width=0.04,
        mat=pal["concrete"],
        parent=p3_root,
    )
    p3_parts = []
    water = fl.add_bevel_box(
        "ct_water",
        size=(8.8, 4.8, 0.12),
        loc=(0.0, 0.0, 0.72),
        bevel_width=0.01,
        mat=pal["upw_teal"],
        parent=p3_root,
    )
    ct_body = fl.add_bevel_box(
        "ct_body",
        size=(8.8, 4.6, 2.85),
        loc=(0.0, 0.0, 2.15),
        bevel_width=0.05,
        mat=pal["white"],
        parent=p3_root,
    )
    ct_band = fl.add_bevel_box(
        "ct_band",
        size=(8.9, 4.7, 0.35),
        loc=(0.0, 0.0, 3.42),
        bevel_width=0.03,
        mat=pal["brand_blue"],
        parent=p3_root,
    )
    p3_parts.extend([water, ct_body, ct_band])

    for idx, cx in enumerate((-2.8, 0.0, 2.8), start=1):
        shroud = fl.add_bevel_cylinder(
            f"ct_shroud_{idx}",
            radius=1.18,
            depth=0.55,
            vertices=24,
            loc=(cx, 0.0, 3.82),
            bevel_width=0.03,
            mat=pal["light_panel"],
            parent=p3_root,
        )
        throat = fl.add_bevel_cylinder(
            f"ct_throat_{idx}",
            radius=1.06,
            depth=0.06,
            vertices=24,
            loc=(cx, 0.0, 4.08),
            bevel_width=0.01,
            mat=pal["dark_steel"],
            parent=p3_root,
        )
        p3_parts.extend([shroud, throat])
        p3_parts.append(
            fl.add_vent_grille(f"ct_louver_f_{idx}", (cx, -2.32, 1.85), size=(2.2, 0.08, 1.65), slats=8, axis="Y", parent=p3_root, pal=pal)
        )
        # Separate Named Axial Cooling Fan Rotor (`CoolingFan_01..03`) with pivot at center!
        create_axial_fan(f"CoolingFan_0{idx}", loc=(cx, 0.0, 4.20), radius=1.00, parent=p3_root, pal=pal)

    fl.merge_objects_into(basin, p3_parts)

    # =========================================================================
    # VARIANT 4: Plant_PowerSubstation (High-Voltage Fab Electrical Substation)
    # =========================================================================
    p4_root = fl.make_root("Plant_PowerSubstation", loc=(16.5, 0.0, 0.0))
    pad4 = fl.add_bevel_box(
        "Substation_Pad",
        size=(8.5, 6.5, 0.35),
        loc=(0.0, 0.0, 0.175),
        bevel_width=0.04,
        mat=pal["concrete"],
        parent=p4_root,
    )
    p4_parts = []
    # Twin Step-Down Oil-Filled Power Transformers with Radiator Banks & HV Bushings
    for tx in (-2.0, 1.8):
        xfmr = fl.add_bevel_box(
            f"sub_xfmr_{tx}",
            size=(2.1, 1.8, 2.2),
            loc=(tx, 0.6, 1.45),
            bevel_width=0.04,
            mat=pal["light_panel"],
            parent=p4_root,
        )
        cons = fl.add_bevel_cylinder(
            f"sub_cons_{tx}",
            radius=0.34,
            depth=1.7,
            vertices=18,
            loc=(tx, 1.1, 2.95),
            rot=(0.0, math.pi / 2.0, 0.0),
            bevel_width=0.02,
            mat=pal["silver"],
            parent=p4_root,
        )
        p4_parts.extend([xfmr, cons])
        # Cooling radiator fin banks on left/right of transformer
        for rx in (-1.22, 1.22):
            rad_bank = fl.add_bevel_box(
                f"sub_rad_{tx}_{rx}",
                size=(0.32, 1.45, 1.75),
                loc=(tx + rx, 0.6, 1.45),
                bevel_width=0.015,
                mat=pal["slate"],
                parent=p4_root,
            )
            p4_parts.append(rad_bank)
        # 3 Angled Ceramic HV Bushings on top of each transformer
        for bx in (-0.55, 0.0, 0.55):
            bushing = fl.add_bevel_cylinder(
                f"sub_bush_{tx}_{bx}",
                radius=0.11,
                depth=1.15,
                vertices=14,
                loc=(tx + bx, 0.25, 3.05),
                rot=(0.22, 0.0, 0.0),
                bevel_width=0.01,
                mat=pal["ceramic_insulator"],
                parent=p4_root,
            )
            p4_parts.append(bushing)

    # Switchgear Relay Control House in front
    sw_house = fl.add_bevel_box(
        "sub_swhouse",
        size=(4.6, 1.8, 2.35),
        loc=(0.0, -1.85, 1.52),
        bevel_width=0.035,
        mat=pal["white"],
        parent=p4_root,
    )
    sw_band = fl.add_bevel_box(
        "sub_swband",
        size=(4.68, 1.88, 0.24),
        loc=(0.0, -1.85, 2.58),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=p4_root,
    )
    p4_parts.extend([sw_house, sw_band])
    fl.merge_objects_into(pad4, p4_parts)

    fl.add_bevel_box(
        "SwitchgearDoor",
        size=(0.95, 0.08, 1.85),
        loc=(-0.475, -2.76, 0.35),
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=p4_root,
        pivot_offset=(0.475, 0.0, 0.925),
    )

    fl.export_glb("support_plant_buildings.glb")


def build_campus_vehicles():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: Truck_WaferDelivery (Air-Ride Climate-Controlled Wafer Box Truck)
    # =========================================================================
    v1_root = fl.make_root("Truck_WaferDelivery", loc=(-5.5, 0.0, 0.0))
    chassis1 = fl.add_bevel_box(
        "WaferTruck_Body",
        size=(2.35, 6.8, 0.32),
        loc=(0.0, 0.2, 0.65),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v1_root,
    )
    t1_parts = []
    # Cab-over tractor front
    cab1 = fl.add_bevel_box(
        "wt_cab",
        size=(2.25, 1.75, 2.15),
        loc=(0.0, -2.45, 1.75),
        bevel_width=0.06,
        mat=pal["white"],
        parent=v1_root,
    )
    windshield1 = fl.add_bevel_box(
        "wt_windshield",
        size=(2.05, 0.12, 0.85),
        loc=(0.0, -3.30, 2.15),
        bevel_width=0.015,
        mat=pal["glass_dark"],
        parent=v1_root,
    )
    grille1 = fl.add_bevel_box(
        "wt_grille",
        size=(1.55, 0.08, 0.55),
        loc=(0.0, -3.32, 1.18),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=v1_root,
    )
    # Insulated Cleanroom Box Body with Cobalt Blue Brand Livery Stripe
    box1 = fl.add_bevel_box(
        "wt_box",
        size=(2.42, 4.95, 2.55),
        loc=(0.0, 1.05, 2.08),
        bevel_width=0.05,
        mat=pal["white"],
        parent=v1_root,
    )
    livery1 = fl.add_bevel_box(
        "wt_livery",
        size=(2.46, 4.85, 0.42),
        loc=(0.0, 1.05, 2.25),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v1_root,
    )
    reefer1 = fl.add_bevel_box(
        "wt_reefer",
        size=(1.45, 0.48, 0.68),
        loc=(0.0, -1.62, 2.98),
        bevel_width=0.03,
        mat=pal["light_panel"],
        parent=v1_root,
    )
    # Headlights & Taillights
    for hx in (-0.85, 0.85):
        hl = fl.add_bevel_box(f"wt_hl_{hx}", (0.28, 0.06, 0.16), (hx, -3.33, 0.92), bevel_width=0.005, mat=pal["emit_white"], parent=v1_root)
        tl = fl.add_bevel_box(f"wt_tl_{hx}", (0.26, 0.06, 0.14), (hx, 3.55, 0.72), bevel_width=0.005, mat=pal["emit_red"], parent=v1_root)
        t1_parts.extend([hl, tl])

    t1_parts.extend([cab1, windshield1, grille1, box1, livery1, reefer1])
    fl.merge_objects_into(chassis1, t1_parts)

    # 6 Separate Wheels with Hubs (`Wheel_FL`, `Wheel_FR`, `Wheel_ML`, `Wheel_MR`, `Wheel_RL`, `Wheel_RR`)
    for wname, wloc in [
        ("Wheel_FL", (-1.12, -2.35, 0.46)),
        ("Wheel_FR", (1.12, -2.35, 0.46)),
        ("Wheel_ML", (-1.12, 1.45, 0.46)),
        ("Wheel_MR", (1.12, 1.45, 0.46)),
        ("Wheel_RL", (-1.12, 2.65, 0.46)),
        ("Wheel_RR", (1.12, 2.65, 0.46)),
    ]:
        fl.create_wheel(wname, loc=wloc, radius=0.46, width=0.26, parent=v1_root, pal=pal, axis="X")

    # Separate Moving Rear Door (`RearDoor`), Hydraulic Tail-Lift (`TailLift`), and Reefer Fan (`ReeferFan`)
    fl.add_bevel_box(
        "RearDoor",
        size=(2.18, 0.08, 2.25),
        loc=(0.0, 3.53, 3.25),
        bevel_width=0.015,
        mat=pal["silver"],
        parent=v1_root,
        pivot_offset=(0.0, 0.0, -1.125),
    )
    fl.add_bevel_box(
        "TailLift",
        size=(2.15, 0.95, 0.08),
        loc=(0.0, 3.58, 0.80),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=v1_root,
        pivot_offset=(0.0, 0.475, 0.0),
    )
    fl.add_bevel_cylinder(
        "ReeferFan",
        radius=0.22,
        depth=0.08,
        vertices=16,
        loc=(-0.38, -1.86, 2.98),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=v1_root,
    )

    # =========================================================================
    # VARIANT 2: Truck_ChemTanker (High-Purity Cryo / Chemical Tanker Truck)
    # =========================================================================
    v2_root = fl.make_root("Truck_ChemTanker", loc=(0.0, 0.0, 0.0))
    chassis2 = fl.add_bevel_box(
        "ChemTanker_Chassis",
        size=(2.35, 7.2, 0.32),
        loc=(0.0, 0.3, 0.65),
        bevel_width=0.03,
        mat=pal["slate"],
        parent=v2_root,
    )
    t2_parts = []
    cab2 = fl.add_bevel_box(
        "ct_cab",
        size=(2.25, 1.85, 2.15),
        loc=(0.0, -2.55, 1.75),
        bevel_width=0.06,
        mat=pal["brand_blue"],
        parent=v2_root,
    )
    ws2 = fl.add_bevel_box(
        "ct_ws",
        size=(2.05, 0.12, 0.85),
        loc=(0.0, -3.45, 2.15),
        bevel_width=0.015,
        mat=pal["glass_dark"],
        parent=v2_root,
    )
    tank2 = fl.add_bevel_cylinder(
        "ct_tank",
        radius=1.08,
        depth=5.15,
        vertices=24,
        loc=(0.0, 1.15, 1.92),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.08,
        mat=pal["chrome"],
        parent=v2_root,
    )
    tank_band = fl.add_bevel_cylinder(
        "ct_band",
        radius=1.10,
        depth=0.55,
        vertices=24,
        loc=(0.0, 1.15, 1.92),
        rot=(math.pi / 2.0, 0.0, 0.0),
        bevel_width=0.02,
        mat=pal["upw_teal"],
        parent=v2_root,
    )
    t2_parts.extend([cab2, ws2, tank2, tank_band])
    fl.merge_objects_into(chassis2, t2_parts)

    for wname, wloc in [
        ("Tanker_Wheel_FL", (-1.12, -2.45, 0.46)),
        ("Tanker_Wheel_FR", (1.12, -2.45, 0.46)),
        ("Tanker_Wheel_ML", (-1.12, 1.55, 0.46)),
        ("Tanker_Wheel_MR", (1.12, 1.55, 0.46)),
        ("Tanker_Wheel_RL", (-1.12, 2.75, 0.46)),
        ("Tanker_Wheel_RR", (1.12, 2.75, 0.46)),
    ]:
        fl.create_wheel(wname, loc=wloc, radius=0.46, width=0.26, parent=v2_root, pal=pal, axis="X")

    fl.add_bevel_box(
        "ValveCabinetDoor",
        size=(0.95, 0.12, 0.95),
        loc=(-0.475, 3.75, 1.25),
        bevel_width=0.015,
        mat=pal["white"],
        parent=v2_root,
        pivot_offset=(0.475, 0.0, 0.475),
    )

    # =========================================================================
    # VARIANT 3: Service_UtilityVan (Cleanroom Facilities Electric Van)
    # =========================================================================
    v3_root = fl.make_root("Service_UtilityVan", loc=(5.2, 0.0, 0.0))
    van_body = fl.add_bevel_box(
        "UtilityVan_Body",
        size=(1.95, 4.4, 1.75),
        loc=(0.0, 0.0, 1.22),
        bevel_width=0.08,
        mat=pal["white"],
        parent=v3_root,
    )
    v3_parts = []
    v_stripe = fl.add_bevel_box(
        "van_stripe",
        size=(1.99, 4.35, 0.24),
        loc=(0.0, 0.0, 1.15),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=v3_root,
    )
    v_ws = fl.add_bevel_box(
        "van_ws",
        size=(1.75, 0.14, 0.72),
        loc=(0.0, -2.16, 1.55),
        bevel_width=0.015,
        mat=pal["glass_dark"],
        parent=v3_root,
    )
    lightbar = fl.add_bevel_box(
        "van_beacon",
        size=(1.15, 0.28, 0.14),
        loc=(0.0, -1.15, 2.16),
        bevel_width=0.015,
        mat=pal["emit_amber"],
        parent=v3_root,
    )
    v3_parts.extend([v_stripe, v_ws, lightbar])
    fl.merge_objects_into(van_body, v3_parts)

    for wname, wloc in [
        ("Van_Wheel_FL", (-0.94, -1.35, 0.38)),
        ("Van_Wheel_FR", (0.94, -1.35, 0.38)),
        ("Van_Wheel_RL", (-0.94, 1.35, 0.38)),
        ("Van_Wheel_RR", (0.94, 1.35, 0.38)),
    ]:
        fl.create_wheel(wname, loc=wloc, radius=0.38, width=0.22, parent=v3_root, pal=pal, axis="X")

    fl.add_bevel_box(
        "SideDoor",
        size=(0.08, 1.15, 1.45),
        loc=(-0.98, 0.15, 1.18),
        bevel_width=0.015,
        mat=pal["white"],
        parent=v3_root,
    )

    fl.export_glb("campus_vehicles.glb")


def build_campus_environment():
    fl.clear_scene()
    pal = fl.get_palette()

    # =========================================================================
    # VARIANT 1: Campus_PipeBridge (Elevated Inter-Building Pipe & OHT Skybridge)
    # =========================================================================
    e1_root = fl.make_root("Campus_PipeBridge", loc=(-16.0, 0.0, 0.0))
    pb_base = fl.add_bevel_box(
        "PipeBridge_Deck",
        size=(2.8, 8.0, 0.28),
        loc=(0.0, 0.0, 3.85),
        bevel_width=0.025,
        mat=pal["silver"],
        parent=e1_root,
    )
    e1_parts = []
    for cy in (-3.2, 3.2):
        for cx in (-1.2, 1.2):
            col = fl.add_bevel_box(
                f"pb_col_{cx}_{cy}",
                size=(0.34, 0.34, 3.85),
                loc=(cx, cy, 1.925),
                bevel_width=0.02,
                mat=pal["slate"],
                parent=e1_root,
            )
            e1_parts.append(col)
    # Glazed upper OHT inter-fab corridor + lower utility process pipes
    sky_glass = fl.add_bevel_box(
        "pb_glass",
        size=(2.6, 7.9, 1.45),
        loc=(0.0, 0.0, 4.72),
        bevel_width=0.03,
        mat=pal["glass_clear"],
        parent=e1_root,
    )
    sky_roof = fl.add_bevel_box(
        "pb_roof",
        size=(2.85, 8.05, 0.24),
        loc=(0.0, 0.0, 5.55),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=e1_root,
    )
    e1_parts.extend([sky_glass, sky_roof])
    for px, pmat in ((-0.85, pal["upw_teal"]), (-0.28, pal["brand_blue"]), (0.28, pal["copper"]), (0.85, pal["safety_yellow"])):
        pipe = fl.add_bevel_cylinder(
            f"pb_pipe_{px}",
            radius=0.14,
            depth=8.0,
            vertices=16,
            loc=(px, 0.0, 3.42),
            rot=(math.pi / 2.0, 0.0, 0.0),
            bevel_width=0.01,
            mat=pmat,
            parent=e1_root,
        )
        e1_parts.append(pipe)
    fl.merge_objects_into(pb_base, e1_parts)

    fl.add_bevel_box(
        "BridgeExpansionJoint",
        size=(2.9, 0.38, 1.85),
        loc=(0.0, 0.0, 4.65),
        bevel_width=0.02,
        mat=pal["slate"],
        parent=e1_root,
    )

    # =========================================================================
    # VARIANT 2: Campus_SecurityGate (Security Checkpoint & Rising Barrier Arm)
    # =========================================================================
    e2_root = fl.make_root("Campus_SecurityGate", loc=(-8.0, 0.0, 0.0))
    island = fl.add_bevel_box(
        "Gate_Island",
        size=(5.2, 3.4, 0.22),
        loc=(0.0, 0.0, 0.11),
        bevel_width=0.025,
        mat=pal["concrete"],
        parent=e2_root,
    )
    e2_parts = []
    booth = fl.add_bevel_box(
        "gate_booth",
        size=(2.1, 2.2, 2.45),
        loc=(-1.2, 0.0, 1.42),
        bevel_width=0.04,
        mat=pal["white"],
        parent=e2_root,
    )
    b_win = fl.add_bevel_box(
        "gate_win",
        size=(2.16, 1.65, 1.05),
        loc=(-1.2, -0.1, 1.68),
        bevel_width=0.015,
        mat=pal["glass_dark"],
        parent=e2_root,
    )
    b_roof = fl.add_bevel_box(
        "gate_roof",
        size=(2.35, 2.45, 0.24),
        loc=(-1.2, 0.0, 2.72),
        bevel_width=0.025,
        mat=pal["brand_blue"],
        parent=e2_root,
    )
    ped_post = fl.add_bevel_box(
        "gate_post",
        size=(0.38, 0.38, 1.08),
        loc=(0.25, -0.85, 0.72),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=e2_root,
    )
    e2_parts.extend([booth, b_win, b_roof, ped_post])
    fl.merge_objects_into(island, e2_parts)

    # Separate Rising Security Gate Barrier Arm (`BarrierArm`) with pivot at hinge post!
    fl.add_bevel_box(
        "BarrierArm",
        size=(2.6, 0.08, 0.12),
        loc=(0.35, -0.85, 1.02),
        bevel_width=0.01,
        mat=pal["hot_lot"],
        parent=e2_root,
        pivot_offset=(1.25, 0.0, 0.0),
    )

    # =========================================================================
    # VARIANT 3: Campus_RoadKit (Asphalt Roadway, Crosswalk & Dock Apron)
    # =========================================================================
    e3_root = fl.make_root("Campus_RoadKit", loc=(0.0, 0.0, 0.0))
    road = fl.add_bevel_box(
        "Road_Asphalt",
        size=(6.5, 6.5, 0.14),
        loc=(0.0, 0.0, 0.07),
        bevel_width=0.015,
        mat=pal["asphalt"],
        parent=e3_root,
    )
    e3_parts = []
    for sx in (-3.05, 3.05):
        curb = fl.add_bevel_box(
            f"road_curb_{sx}",
            size=(0.45, 6.5, 0.22),
            loc=(sx, 0.0, 0.11),
            bevel_width=0.015,
            mat=pal["concrete"],
            parent=e3_root,
        )
        e3_parts.append(curb)
    for cx in (-1.8, -0.9, 0.0, 0.9, 1.8):
        stripe = fl.add_bevel_box(
            f"road_cw_{cx}",
            size=(0.42, 1.6, 0.02),
            loc=(cx, 0.0, 0.145),
            bevel_width=0.003,
            mat=pal["white"],
            parent=e3_root,
        )
        e3_parts.append(stripe)
    fl.merge_objects_into(road, e3_parts)

    # =========================================================================
    # VARIANT 4: Campus_Landscaping (Stylised Isometric Trees, Planter & Lamp)
    # =========================================================================
    e4_root = fl.make_root("Campus_Landscaping", loc=(8.0, 0.0, 0.0))
    planter = fl.add_bevel_box(
        "Landscape_Planter",
        size=(4.6, 3.2, 0.38),
        loc=(0.0, 0.0, 0.19),
        bevel_width=0.03,
        mat=pal["concrete"],
        parent=e4_root,
    )
    e4_parts = []
    lawn = fl.add_bevel_box(
        "land_lawn",
        size=(4.2, 2.8, 0.12),
        loc=(0.0, 0.0, 0.38),
        bevel_width=0.02,
        mat=pal["foliage_2"],
        parent=e4_root,
    )
    e4_parts.append(lawn)
    # 2 Stylised Layered Isometric Trees
    for tx, ty, sc in ((-1.1, 0.2, 1.0), (0.85, -0.25, 0.85)):
        trunk = fl.add_bevel_cylinder(
            f"tree_tr_{tx}",
            radius=0.16 * sc,
            depth=1.45 * sc,
            vertices=12,
            loc=(tx, ty, 1.05 * sc),
            bevel_width=0.015,
            mat=pal["trunk"],
            parent=e4_root,
        )
        can1 = fl.add_bevel_box(
            f"tree_c1_{tx}",
            size=(1.55 * sc, 1.55 * sc, 0.95 * sc),
            loc=(tx, ty, 1.95 * sc),
            bevel_width=0.22 * sc,
            mat=pal["foliage_1"],
            parent=e4_root,
        )
        can2 = fl.add_bevel_box(
            f"tree_c2_{tx}",
            size=(1.10 * sc, 1.10 * sc, 0.78 * sc),
            loc=(tx, ty, 2.65 * sc),
            bevel_width=0.18 * sc,
            mat=pal["foliage_2"],
            parent=e4_root,
        )
        e4_parts.extend([trunk, can1, can2])

    pole = fl.add_bevel_cylinder(
        "lamp_pole",
        radius=0.06,
        depth=3.4,
        vertices=12,
        loc=(1.85, 1.1, 1.85),
        bevel_width=0.008,
        mat=pal["slate"],
        parent=e4_root,
    )
    e4_parts.append(pole)
    fl.merge_objects_into(planter, e4_parts)

    fl.add_bevel_box(
        "LampHead",
        size=(0.65, 0.26, 0.10),
        loc=(1.85, 1.1, 3.55),
        bevel_width=0.015,
        mat=pal["emit_white"],
        parent=e4_root,
        pivot_offset=(-0.28, 0.0, 0.0),
    )

    # =========================================================================
    # VARIANT 5: Campus_SolarCarport (Solar Canopy & Emergency Backup Generator)
    # =========================================================================
    e5_root = fl.make_root("Campus_SolarCarport", loc=(16.0, 0.0, 0.0))
    pad5 = fl.add_bevel_box(
        "SolarGen_Pad",
        size=(6.2, 4.4, 0.25),
        loc=(0.0, 0.0, 0.125),
        bevel_width=0.03,
        mat=pal["concrete"],
        parent=e5_root,
    )
    e5_parts = []
    gen_box = fl.add_bevel_box(
        "gen_enclosure",
        size=(3.4, 1.65, 1.95),
        loc=(-1.0, 0.8, 1.20),
        bevel_width=0.035,
        mat=pal["white"],
        parent=e5_root,
    )
    gen_band = fl.add_bevel_box(
        "gen_band",
        size=(3.46, 1.70, 0.22),
        loc=(-1.0, 0.8, 2.02),
        bevel_width=0.02,
        mat=pal["brand_blue"],
        parent=e5_root,
    )
    # Angled Solar PV Canopy Roof over right side
    solar_roof = fl.add_bevel_box(
        "solar_roof",
        size=(5.8, 3.8, 0.14),
        loc=(0.0, 0.0, 3.35),
        rot=(0.18, 0.0, 0.0),
        bevel_width=0.02,
        mat=pal["solar_panel"],
        parent=e5_root,
    )
    for px in (-2.2, 2.2):
        spost = fl.add_bevel_box(
            f"solar_post_{px}",
            size=(0.24, 0.24, 3.2),
            loc=(px, 0.0, 1.72),
            bevel_width=0.015,
            mat=pal["slate"],
            parent=e5_root,
        )
        e5_parts.append(spost)
    e5_parts.extend([gen_box, gen_band, solar_roof])
    fl.merge_objects_into(pad5, e5_parts)

    create_axial_fan("GenExhaustFan", loc=(0.72, 0.8, 1.25), radius=0.52, parent=e5_root, pal=pal)
    fl.add_bevel_box(
        "GenDoor",
        size=(0.85, 0.06, 1.45),
        loc=(-1.42, -0.04, 0.45),
        bevel_width=0.01,
        mat=pal["silver"],
        parent=e5_root,
        pivot_offset=(0.425, 0.0, 0.725),
    )

    fl.export_glb("campus_environment.glb")


if __name__ == "__main__":
    build_fab_characters()
    build_support_plant_buildings()
    build_campus_vehicles()
    build_campus_environment()
