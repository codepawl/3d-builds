import sys
import os
import math
import bpy
import bmesh
from mathutils import Vector, Euler

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fab_lib import (
    clear_scene, get_palette, finalize_and_export_glb
)


def _add_part_to_bm(bm, shape, size, center, mat_idx, vgroup_layer, vg_idx, bevel_w=0.012):
    """Add a beveled box/cylinder/sphere to a combined character bmesh and assign vertex group & material index."""
    temp = bmesh.new()
    if shape == 'BOX':
        bmesh.ops.create_cube(temp, size=1.0)
        sx, sy, sz = size
        for v in temp.verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
        if bevel_w > 0:
            bmesh.ops.bevel(temp, geom=list(temp.verts) + list(temp.edges),
                            offset=bevel_w, offset_type='OFFSET', segments=2, profile=0.5,
                            affect='EDGES', clamp_overlap=True)
    elif shape == 'CYL':
        rad, depth = size
        bmesh.ops.create_cone(temp, cap_ends=True, cap_tris=False, segments=18,
                              radius1=rad, radius2=rad, depth=depth)
        if bevel_w > 0:
            bmesh.ops.bevel(temp, geom=list(temp.verts) + list(temp.edges),
                            offset=bevel_w, offset_type='OFFSET', segments=2, profile=0.5,
                            affect='EDGES', clamp_overlap=True)
    elif shape == 'SPHERE':
        sx, sy, sz = size
        bmesh.ops.create_uvsphere(temp, u_segments=18, v_segments=12, radius=0.5)
        for v in temp.verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz

    bmesh.ops.recalc_face_normals(temp, faces=temp.faces)
    cx, cy, cz = center
    for v in temp.verts:
        v.co.x += cx
        v.co.y += cy
        v.co.z += cz

    vert_map = {}
    for v in temp.verts:
        nv = bm.verts.new(v.co)
        nv[vgroup_layer][vg_idx] = 1.0
        vert_map[v] = nv
    for f in temp.faces:
        nf = bm.faces.new([vert_map[v] for v in f.verts])
        nf.material_index = mat_idx
        nf.smooth = True
    temp.free()


def build_rigged_character(name, x_off, suit_mat, trim_mat, visor_mat, badge_mat, prop_mode="tablet"):
    pal = get_palette()
    mats = [
        suit_mat,            # 0: Primary bunny suit
        trim_mat,            # 1: Collar, shoulder, knee & boot cuffs
        visor_mat,           # 2: Goggles / safety visor
        pal["dark_slate"],   # 3: Boot soles, belt, respirator pack
        pal["steel"],        # 4: Metallic clasps / tool / tablet frame
        badge_mat,           # 5: Glowing status badge / tablet screen
    ]

    # 1. Create Armature at (x_off, 0, 0)
    arm_data = bpy.data.armatures.new(f"{name}_ArmData")
    arm_obj = bpy.data.objects.new(name, arm_data)
    arm_obj.location = Vector((x_off, 0.0, 0.0))
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    eb = arm_data.edit_bones
    bone_defs = [
        ("Root", (0, 0, 0.0), (0, 0, 0.25), None),
        ("Hips", (0, 0, 0.86), (0, 0, 1.00), "Root"),
        ("Spine", (0, 0, 1.00), (0, 0, 1.22), "Hips"),
        ("Chest", (0, 0, 1.22), (0, 0, 1.44), "Spine"),
        ("Head", (0, 0, 1.44), (0, 0, 1.76), "Chest"),
        ("Arm_L", (-0.23, 0, 1.38), (-0.25, 0, 1.12), "Chest"),
        ("Forearm_L", (-0.25, 0, 1.12), (-0.25, 0, 0.84), "Arm_L"),
        ("Arm_R", (0.23, 0, 1.38), (0.25, 0, 1.12), "Chest"),
        ("Forearm_R", (0.25, 0, 1.12), (0.25, 0, 0.84), "Arm_R"),
        ("Leg_L", (-0.11, 0, 0.86), (-0.11, 0, 0.46), "Hips"),
        ("Shin_L", (-0.11, 0, 0.46), (-0.11, 0, 0.04), "Leg_L"),
        ("Leg_R", (0.11, 0, 0.86), (0.11, 0, 0.46), "Hips"),
        ("Shin_R", (0.11, 0, 0.46), (0.11, 0, 0.04), "Leg_R"),
    ]
    for bname, head, tail, pname in bone_defs:
        b = eb.new(bname)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if pname:
            b.parent = eb[pname]

    bpy.ops.object.mode_set(mode='OBJECT')
    for pbone in arm_obj.pose.bones:
        pbone.rotation_mode = 'XYZ'

    # 2. Build Character Mesh facing -Y (front camera direction)
    mesh = bpy.data.meshes.new(f"{name}_MeshData")
    mesh_obj = bpy.data.objects.new(f"{name}_Mesh", mesh)
    for m in mats:
        mesh_obj.data.materials.append(m)
    bpy.context.collection.objects.link(mesh_obj)
    mesh_obj.parent = arm_obj

    vg_map = {}
    for bname, _, _, _ in bone_defs:
        vg = mesh_obj.vertex_groups.new(name=bname)
        vg_map[bname] = vg.index

    bm = bmesh.new()
    dlayer = bm.verts.layers.deform.verify()

    # Hips & Pelvis + Belt
    _add_part_to_bm(bm, 'BOX', (0.34, 0.24, 0.18), (0, 0, 0.90), 0, dlayer, vg_map["Hips"], 0.025)
    _add_part_to_bm(bm, 'BOX', (0.36, 0.26, 0.05), (0, 0, 0.98), 3, dlayer, vg_map["Hips"], 0.008)

    # Spine & Chest + Shoulder Trim + Front Zipper & Telemetry Badge (on -Y front face!)
    _add_part_to_bm(bm, 'BOX', (0.34, 0.23, 0.22), (0, 0, 1.10), 0, dlayer, vg_map["Spine"], 0.025)
    _add_part_to_bm(bm, 'BOX', (0.38, 0.25, 0.24), (0, 0, 1.31), 0, dlayer, vg_map["Chest"], 0.028)
    _add_part_to_bm(bm, 'BOX', (0.42, 0.26, 0.07), (0, 0, 1.40), 1, dlayer, vg_map["Chest"], 0.015)
    _add_part_to_bm(bm, 'BOX', (0.04, 0.02, 0.36), (0, -0.125, 1.22), 1, dlayer, vg_map["Chest"], 0.004)
    _add_part_to_bm(bm, 'BOX', (0.09, 0.025, 0.055), (-0.10, -0.128, 1.32), 5, dlayer, vg_map["Chest"], 0.004)

    # Back Powered Air-Purifying Respirator (PAPR) Pack on +Y back face
    _add_part_to_bm(bm, 'BOX', (0.24, 0.12, 0.26), (0, 0.17, 1.24), 3, dlayer, vg_map["Chest"], 0.015)
    _add_part_to_bm(bm, 'CYL', (0.06, 0.04), (-0.06, 0.23, 1.24), 4, dlayer, vg_map["Chest"], 0.005)
    _add_part_to_bm(bm, 'BOX', (0.14, 0.02, 0.03), (0, 0.235, 1.33), 5, dlayer, vg_map["Chest"], 0.003)

    # Head: Cleanroom Bunny-Suit Hood + Goggles/Visor + Face Shield Mask on -Y front face
    _add_part_to_bm(bm, 'SPHERE', (0.28, 0.30, 0.31), (0, 0, 1.60), 0, dlayer, vg_map["Head"])
    _add_part_to_bm(bm, 'CYL', (0.11, 0.08), (0, 0, 1.44), 1, dlayer, vg_map["Head"], 0.008)
    _add_part_to_bm(bm, 'BOX', (0.23, 0.12, 0.085), (0, -0.11, 1.63), 2, dlayer, vg_map["Head"], 0.015)
    _add_part_to_bm(bm, 'BOX', (0.24, 0.10, 0.02), (0, -0.11, 1.675), 1, dlayer, vg_map["Head"], 0.004)
    _add_part_to_bm(bm, 'BOX', (0.19, 0.10, 0.10), (0, -0.115, 1.53), 0, dlayer, vg_map["Head"], 0.015)

    # Left & Right Arms + Forearms + Cleanroom Nitrile Gloves
    for side, sx in (("L", -1.0), ("R", 1.0)):
        _add_part_to_bm(bm, 'CYL', (0.065, 0.26), (sx * 0.25, 0, 1.25), 0, dlayer, vg_map[f"Arm_{side}"], 0.010)
        _add_part_to_bm(bm, 'CYL', (0.058, 0.24), (sx * 0.25, 0, 0.99), 0, dlayer, vg_map[f"Forearm_{side}"], 0.008)
        _add_part_to_bm(bm, 'CYL', (0.062, 0.045), (sx * 0.25, 0, 0.88), 1, dlayer, vg_map[f"Forearm_{side}"], 0.005)
        _add_part_to_bm(bm, 'SPHERE', (0.10, 0.11, 0.12), (sx * 0.25, 0, 0.82), 1, dlayer, vg_map[f"Forearm_{side}"])

    if prop_mode == "tablet":
        _add_part_to_bm(bm, 'BOX', (0.22, 0.16, 0.022), (0.25, -0.12, 0.82), 4, dlayer, vg_map["Forearm_R"], 0.004)
        _add_part_to_bm(bm, 'BOX', (0.18, 0.12, 0.025), (0.25, -0.12, 0.822), 5, dlayer, vg_map["Forearm_R"], 0.002)
    elif prop_mode == "reticle":
        _add_part_to_bm(bm, 'BOX', (0.22, 0.22, 0.05), (0.26, -0.12, 0.80), 1, dlayer, vg_map["Forearm_R"], 0.008)
    elif prop_mode == "toolkit":
        _add_part_to_bm(bm, 'BOX', (0.12, 0.24, 0.16), (0.33, 0.0, 0.74), 3, dlayer, vg_map["Forearm_R"], 0.010)

    # Left & Right Thighs + Shins + Cleanroom Tall Booties (with soles at Z = 0.000m!)
    for side, sx in (("L", -1.0), ("R", 1.0)):
        _add_part_to_bm(bm, 'CYL', (0.082, 0.40), (sx * 0.11, 0, 0.66), 0, dlayer, vg_map[f"Leg_{side}"], 0.012)
        _add_part_to_bm(bm, 'CYL', (0.074, 0.36), (sx * 0.11, 0, 0.28), 0, dlayer, vg_map[f"Shin_{side}"], 0.010)
        _add_part_to_bm(bm, 'CYL', (0.078, 0.05), (sx * 0.11, 0, 0.34), 1, dlayer, vg_map[f"Shin_{side}"], 0.006)
        _add_part_to_bm(bm, 'BOX', (0.13, 0.24, 0.10), (sx * 0.11, -0.04, 0.065), 1, dlayer, vg_map[f"Shin_{side}"], 0.015)
        _add_part_to_bm(bm, 'BOX', (0.135, 0.25, 0.03), (sx * 0.11, -0.04, 0.015), 3, dlayer, vg_map[f"Shin_{side}"], 0.005)

    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = (co.x * 0.5 + 0.5, co.z * 0.5)

    bm.to_mesh(mesh)
    bm.free()

    mod = mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
    mod.object = arm_obj
    return arm_obj


def create_character_animations(arm_objs):
    """Create 5 named animation clips (Idle, Walk, Inspect_Console, Carry_FOUP, Repair_Tool)
    with Idle set as the active default action at frame 1."""
    clip_specs = [
        ("Idle", 24),
        ("Walk", 24),
        ("Inspect_Console", 24),
        ("Carry_FOUP", 24),
        ("Repair_Tool", 24),
    ]

    for arm_obj in arm_objs:
        arm_obj.animation_data_create()
        pb = arm_obj.pose.bones
        idle_act = None

        for clip_name, _ in clip_specs:
            act = bpy.data.actions.new(name=f"{arm_obj.name}_{clip_name}")
            if clip_name == "Idle":
                idle_act = act
            arm_obj.animation_data.action = act

            for f in (1, 7, 13, 19, 25):
                phase = ((f - 1) / 24.0) * (2.0 * math.pi)
                s = math.sin(phase)
                c = math.cos(phase)

                for b in pb:
                    b.location = Vector((0, 0, 0))
                    b.rotation_euler = Euler((0, 0, 0), 'XYZ')

                if clip_name == "Idle":
                    pb["Chest"].rotation_euler = Euler((math.radians(1.5 * s), 0, math.radians(2.5 * s)), 'XYZ')
                    pb["Head"].rotation_euler = Euler((math.radians(2.0 * s), 0, math.radians(5.0 * s)), 'XYZ')
                    pb["Arm_L"].rotation_euler = Euler((math.radians(3.0 * s), 0, 0), 'XYZ')
                    pb["Arm_R"].rotation_euler = Euler((math.radians(-3.0 * s), 0, 0), 'XYZ')

                elif clip_name == "Walk":
                    pb["Leg_L"].rotation_euler = Euler((math.radians(24.0 * s), 0, 0), 'XYZ')
                    pb["Shin_L"].rotation_euler = Euler((math.radians(max(0.0, -24.0 * s)), 0, 0), 'XYZ')
                    pb["Leg_R"].rotation_euler = Euler((math.radians(-24.0 * s), 0, 0), 'XYZ')
                    pb["Shin_R"].rotation_euler = Euler((math.radians(max(0.0, 24.0 * s)), 0, 0), 'XYZ')
                    pb["Arm_L"].rotation_euler = Euler((math.radians(-18.0 * s), 0, 0), 'XYZ')
                    pb["Forearm_L"].rotation_euler = Euler((math.radians(-12.0), 0, 0), 'XYZ')
                    pb["Arm_R"].rotation_euler = Euler((math.radians(18.0 * s), 0, 0), 'XYZ')
                    pb["Forearm_R"].rotation_euler = Euler((math.radians(-12.0), 0, 0), 'XYZ')

                elif clip_name == "Inspect_Console":
                    pb["Chest"].rotation_euler = Euler((math.radians(-5.0), 0, math.radians(4.0 * s)), 'XYZ')
                    pb["Head"].rotation_euler = Euler((math.radians(-8.0), 0, math.radians(6.0 * s)), 'XYZ')
                    pb["Arm_R"].rotation_euler = Euler((math.radians(-32.0), 0, 0), 'XYZ')
                    pb["Forearm_R"].rotation_euler = Euler((math.radians(-42.0 - 6.0 * s), 0, 0), 'XYZ')
                    pb["Arm_L"].rotation_euler = Euler((math.radians(-20.0 - 8.0 * c), 0, 0), 'XYZ')

                elif clip_name == "Carry_FOUP":
                    pb["Leg_L"].rotation_euler = Euler((math.radians(16.0 * s), 0, 0), 'XYZ')
                    pb["Leg_R"].rotation_euler = Euler((math.radians(-16.0 * s), 0, 0), 'XYZ')
                    pb["Arm_L"].rotation_euler = Euler((math.radians(-38.0), 0, math.radians(10.0)), 'XYZ')
                    pb["Forearm_L"].rotation_euler = Euler((math.radians(-36.0), 0, 0), 'XYZ')
                    pb["Arm_R"].rotation_euler = Euler((math.radians(-38.0), 0, math.radians(-10.0)), 'XYZ')
                    pb["Forearm_R"].rotation_euler = Euler((math.radians(-36.0), 0, 0), 'XYZ')

                elif clip_name == "Repair_Tool":
                    pb["Chest"].rotation_euler = Euler((math.radians(-12.0), 0, 0), 'XYZ')
                    pb["Arm_R"].rotation_euler = Euler((math.radians(-48.0 - 15.0 * s), 0, 0), 'XYZ')
                    pb["Forearm_R"].rotation_euler = Euler((math.radians(-28.0 + 12.0 * s), 0, 0), 'XYZ')
                    pb["Arm_L"].rotation_euler = Euler((math.radians(-35.0), 0, 0), 'XYZ')

                for bname in ("Hips", "Chest", "Head", "Arm_L", "Forearm_L", "Arm_R", "Forearm_R", "Leg_L", "Shin_L", "Leg_R", "Shin_R"):
                    pb[bname].keyframe_insert(data_path="rotation_euler", frame=f)

            track = arm_obj.animation_data.nla_tracks.new()
            track.name = clip_name
            strip = track.strips.new(name=clip_name, start=1, action=act)
            strip.name = clip_name
            strip.blend_type = 'REPLACE'

        arm_obj.animation_data.action = idle_act
        for b in pb:
            b.location = Vector((0, 0, 0))
            b.rotation_euler = Euler((0, 0, 0), 'XYZ')
        bpy.context.scene.frame_set(1)


def main():
    clear_scene()
    pal = get_palette()
    c1 = build_rigged_character(
        "Char_Process_Engineer", x_off=-2.4,
        suit_mat=pal["white"], trim_mat=pal["brand_blue"],
        visor_mat=pal["glass_dark"], badge_mat=pal["emit_cyan"], prop_mode="tablet"
    )
    c2 = build_rigged_character(
        "Char_Litho_Specialist", x_off=-0.8,
        suit_mat=pal["white"], trim_mat=pal["safety_yellow"],
        visor_mat=pal["glass_amber"], badge_mat=pal["emit_amber"], prop_mode="reticle"
    )
    c3 = build_rigged_character(
        "Char_Maintenance_Tech", x_off=0.8,
        suit_mat=pal["ice_blue"], trim_mat=pal["brand_blue_dark"],
        visor_mat=pal["glass_dark"], badge_mat=pal["emit_green"], prop_mode="toolkit"
    )
    c4 = build_rigged_character(
        "Char_Shift_Lead", x_off=2.4,
        suit_mat=pal["white"], trim_mat=pal["gold"],
        visor_mat=pal["glass_dark"], badge_mat=pal["emit_orange"], prop_mode="tablet"
    )
    create_character_animations([c1, c2, c3, c4])
    finalize_and_export_glb("fab_characters.glb")


if __name__ == "__main__":
    main()
