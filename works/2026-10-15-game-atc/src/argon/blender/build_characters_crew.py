import os
import sys
import math
import bpy
import bmesh
from mathutils import Vector, Euler

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_common import (
    clear_scene,
    get_standard_materials,
    add_beveled_box,
    add_cylinder_part,
    add_uv_sphere_part,
    apply_box_uvs,
    export_family_glb,
)


def _tag_new_verts_bone(bm, bone_layer, before_count, bone_idx):
    bm.verts.ensure_lookup_table()
    for i in range(before_count, len(bm.verts)):
        bm.verts[i][bone_layer] = bone_idx


def _create_armature_and_skinned_mesh(arm_name, mesh_name, location, bone_defs, bm, bone_layer, materials):
    """
    Create an Armature object with `bone_defs`, finalize `bm` into a skinned Mesh object
    weighted via vertex groups, and parent the mesh to the armature.
    `bone_defs`: list of (bone_name, head_xyz, tail_xyz, parent_name_or_None)
    """
    arm_data = bpy.data.armatures.new(arm_name)
    arm_obj = bpy.data.objects.new(arm_name, arm_data)
    bpy.context.collection.objects.link(arm_obj)
    arm_obj.location = Vector(location)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    ebones = {}
    for b_name, head, tail, parent_name in bone_defs:
        eb = arm_data.edit_bones.new(b_name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        if parent_name and parent_name in ebones:
            eb.parent = ebones[parent_name]
        ebones[b_name] = eb
    bpy.ops.object.mode_set(mode='OBJECT')

    # Finalize mesh
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    apply_box_uvs(bm, scale=0.8)
    bm.verts.ensure_lookup_table()
    vert_bone_indices = [v[bone_layer] for v in bm.verts]

    mesh = bpy.data.meshes.new(mesh_name)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True
    for mat in materials:
        mesh.materials.append(mat)

    mesh_obj = bpy.data.objects.new(mesh_name, mesh)
    bpy.context.collection.objects.link(mesh_obj)
    mesh_obj.parent = arm_obj

    # Create vertex groups matching bone names and assign weights
    vgroups = []
    for b_name, _, _, _ in bone_defs:
        vgroups.append(mesh_obj.vertex_groups.new(name=b_name))

    for v_idx, b_idx in enumerate(vert_bone_indices):
        safe_idx = max(0, min(b_idx, len(vgroups) - 1))
        vgroups[safe_idx].add([v_idx], 1.0, 'REPLACE')

    mod = mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
    mod.object = arm_obj
    return arm_obj, mesh_obj


def _bake_nla_clips(arm_obj, clips):
    """
    Create named Actions with pose bone keyframes and push each into an NLA track
    so GLTF exports every clip by name.
    `clips`: list of (clip_name, keyframes_list)
      where keyframes_list is [(frame, {bone_name: (rx, ry, rz)}, {bone_name: (lx, ly, lz)}), ...]
    """
    arm_obj.animation_data_create()
    for pbone in arm_obj.pose.bones:
        pbone.rotation_mode = 'XYZ'

    for clip_name, keyframes in clips:
        action = bpy.data.actions.new(name=clip_name)
        arm_obj.animation_data.action = action

        for frame, rot_dict, loc_dict in keyframes:
            bpy.context.scene.frame_set(frame)
            for pbone in arm_obj.pose.bones:
                rot = rot_dict.get(pbone.name, (0.0, 0.0, 0.0))
                loc = loc_dict.get(pbone.name, (0.0, 0.0, 0.0))
                pbone.rotation_euler = Euler(rot, 'XYZ')
                pbone.location = Vector(loc)
                pbone.keyframe_insert(data_path="rotation_euler", frame=frame)
                pbone.keyframe_insert(data_path="location", frame=frame)

        track = arm_obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, action)
        strip.name = clip_name

    # Reset pose to rest & detach active action so NLA tracks export cleanly
    arm_obj.animation_data.action = None
    bpy.context.scene.frame_set(1)
    for pbone in arm_obj.pose.bones:
        pbone.rotation_euler = Euler((0.0, 0.0, 0.0), 'XYZ')
        pbone.location = Vector((0.0, 0.0, 0.0))


def build_human_character(arm_name, mesh_name, x_offset, is_marshaller, mats):
    """
    Build a stylized rigged human crew character:
    - `Crew_Marshaller`: High-vis neon vest, cobalt trousers, ear defenders, glowing orange marshalling wands.
    - `Crew_Controller_Tech`: ATC / ground engineer in crisp white shirt, cobalt vest, holding radar tablet.
    """
    bone_defs = [
        ("Root",      (0.0, 0.0, 0.0),   (0.0, 0.0, 0.45),  None),         # 0
        ("Pelvis",    (0.0, 0.0, 0.82),  (0.0, 0.0, 0.98),  "Root"),       # 1
        ("Torso",     (0.0, 0.0, 0.98),  (0.0, 0.0, 1.48),  "Pelvis"),     # 2
        ("Head",      (0.0, 0.0, 1.48),  (0.0, 0.0, 1.85),  "Torso"),      # 3
        ("Arm_L",     (-0.28, 0.0, 1.42),(-0.34, 0.0, 0.92),"Torso"),      # 4
        ("Arm_R",     (0.28, 0.0, 1.42), (0.34, 0.0, 0.92), "Torso"),      # 5
        ("Leg_L",     (-0.14, 0.0, 0.82),(-0.14, 0.0, 0.05),"Pelvis"),     # 6
        ("Leg_R",     (0.14, 0.0, 0.82), (0.14, 0.0, 0.05), "Pelvis"),     # 7
    ]

    bm = bmesh.new()
    bone_layer = bm.verts.layers.int.new('bone_idx')
    # 0:vest_mat, 1:cobalt, 2:slate_dark, 3:skin, 4:white, 5:emit_amber/orange, 6:glass_dark
    vest_mat = mats['amber'] if is_marshaller else mats['cobalt']
    cmats = [vest_mat, mats['cobalt_dark'], mats['slate_dark'], mats['skin'], mats['white'], mats['emit_amber'], mats['glass_dark']]

    # Pelvis (bone 1)
    n0 = len(bm.verts)
    add_beveled_box(bm, size=(0.44, 0.28, 0.24), center=(0.0, 0.0, 0.88), bevel_width=0.04, mat_idx=1)
    _tag_new_verts_bone(bm, bone_layer, n0, 1)

    # Torso + Reflective Safety Vest Stripes + Radio pack (bone 2)
    n0 = len(bm.verts)
    add_beveled_box(bm, size=(0.48, 0.30, 0.52), center=(0.0, 0.0, 1.24), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm, size=(0.50, 0.32, 0.08), center=(0.0, 0.0, 1.14), bevel_width=0.015, mat_idx=4)
    add_beveled_box(bm, size=(0.50, 0.32, 0.08), center=(0.0, 0.0, 1.32), bevel_width=0.015, mat_idx=4)
    add_beveled_box(bm, size=(0.14, 0.10, 0.18), center=(0.18, -0.16, 1.15), bevel_width=0.02, mat_idx=2)
    _tag_new_verts_bone(bm, bone_layer, n0, 2)

    # Head + Helmet/Cap + Visor + Ear Defenders (bone 3)
    n0 = len(bm.verts)
    add_uv_sphere_part(bm, radius=0.18, scale=(0.95, 0.95, 1.05), center=(0.0, 0.0, 1.66), u_segments=14, v_segments=10, mat_idx=3)
    # Safety helmet / cap & sunglasses visor
    add_uv_sphere_part(bm, radius=0.20, scale=(1.02, 1.08, 0.72), center=(0.0, 0.02, 1.75), u_segments=14, v_segments=10, mat_idx=4 if not is_marshaller else 0)
    add_beveled_box(bm, size=(0.28, 0.10, 0.08), center=(0.0, 0.15, 1.68), bevel_width=0.015, mat_idx=6)
    # Acoustic ear defenders
    for sx in (-0.20, 0.20):
        add_cylinder_part(bm, radius1=0.07, radius2=0.06, depth=0.06, segments=10, center=(sx, 0.0, 1.66), axis='X', mat_idx=2)
    _tag_new_verts_bone(bm, bone_layer, n0, 3)

    # Left & Right Arms + Illuminated Marshalling Wands or ATC Tablet (bones 4 & 5)
    for side, b_idx in ((-1.0, 4), (1.0, 5)):
        n0 = len(bm.verts)
        ax = side * 0.32
        add_beveled_box(bm, size=(0.15, 0.16, 0.48), center=(ax, 0.0, 1.18), bevel_width=0.04, mat_idx=4 if not is_marshaller else 0)
        add_uv_sphere_part(bm, radius=0.075, center=(ax, 0.02, 0.90), u_segments=10, v_segments=8, mat_idx=3)
        if is_marshaller:
            # Glowing marshalling wand extending forward/down from hand
            add_cylinder_part(bm, radius1=0.035, radius2=0.035, depth=0.14, segments=8, center=(ax, 0.08, 0.90), axis='Y', mat_idx=2)
            add_cylinder_part(bm, radius1=0.032, radius2=0.024, depth=0.38, segments=10, center=(ax, 0.32, 0.90), axis='Y', mat_idx=5)
        elif side > 0:
            # Illuminated radar tablet in right hand of Tech
            add_beveled_box(bm, size=(0.26, 0.34, 0.04), center=(ax - 0.05, 0.18, 0.92), rotation=(0.35, 0.0, 0.0), bevel_width=0.01, mat_idx=2)
            add_beveled_box(bm, size=(0.22, 0.28, 0.045), center=(ax - 0.05, 0.18, 0.925), rotation=(0.35, 0.0, 0.0), bevel_width=0.008, mat_idx=5)
        _tag_new_verts_bone(bm, bone_layer, n0, b_idx)

    # Left & Right Legs + Work Boots (bones 6 & 7)
    for side, b_idx in ((-1.0, 6), (1.0, 7)):
        n0 = len(bm.verts)
        lx = side * 0.14
        add_beveled_box(bm, size=(0.17, 0.18, 0.68), center=(lx, 0.0, 0.46), bevel_width=0.04, mat_idx=1)
        add_beveled_box(bm, size=(0.18, 0.28, 0.14), center=(lx, 0.05, 0.07), bevel_width=0.03, mat_idx=2)
        _tag_new_verts_bone(bm, bone_layer, n0, b_idx)

    arm_obj, _ = _create_armature_and_skinned_mesh(
        arm_name, mesh_name, (x_offset, 0.0, 0.0), bone_defs, bm, bone_layer, cmats
    )

    if is_marshaller:
        clips = [
            ("Marshaller_Idle", [
                (1,  {"Torso": (0.0, 0.0, 0.0),  "Arm_L": (-0.25, 0.0, -0.15), "Arm_R": (-0.25, 0.0, 0.15)}, {}),
                (15, {"Torso": (0.04, 0.0, 0.0), "Arm_L": (-0.35, 0.0, -0.22), "Arm_R": (-0.35, 0.0, 0.22)}, {"Pelvis": (0.0, 0.0, 0.02)}),
                (30, {"Torso": (0.0, 0.0, 0.0),  "Arm_L": (-0.25, 0.0, -0.15), "Arm_R": (-0.25, 0.0, 0.15)}, {}),
            ]),
            ("Marshaller_Walk", [
                (1,  {"Leg_L": (0.45, 0.0, 0.0),  "Leg_R": (-0.45, 0.0, 0.0), "Arm_L": (-0.35, 0.0, 0.0), "Arm_R": (0.35, 0.0, 0.0)}, {}),
                (15, {"Leg_L": (-0.45, 0.0, 0.0), "Leg_R": (0.45, 0.0, 0.0),  "Arm_L": (0.35, 0.0, 0.0),  "Arm_R": (-0.35, 0.0, 0.0)}, {"Pelvis": (0.0, 0.0, 0.03)}),
                (30, {"Leg_L": (0.45, 0.0, 0.0),  "Leg_R": (-0.45, 0.0, 0.0), "Arm_L": (-0.35, 0.0, 0.0), "Arm_R": (0.35, 0.0, 0.0)}, {}),
            ]),
            ("Marshaller_Signal_Turn", [
                (1,  {"Arm_L": (-1.45, 0.0, -0.65), "Arm_R": (-1.20, 0.0, 0.25), "Head": (0.0, 0.0, -0.20)}, {}),
                (15, {"Arm_L": (-1.45, 0.0, -0.65), "Arm_R": (-2.15, 0.0, 0.10), "Head": (0.0, 0.0, 0.20)}, {}),
                (30, {"Arm_L": (-1.45, 0.0, -0.65), "Arm_R": (-1.20, 0.0, 0.25), "Head": (0.0, 0.0, -0.20)}, {}),
            ]),
            ("Marshaller_Signal_Stop", [
                (1,  {"Arm_L": (-1.35, 0.0, -0.55), "Arm_R": (-1.35, 0.0, 0.55)}, {}),
                (15, {"Arm_L": (-2.45, 0.0, 0.35),  "Arm_R": (-2.45, 0.0, -0.35)}, {}),
                (30, {"Arm_L": (-1.35, 0.0, -0.55), "Arm_R": (-1.35, 0.0, 0.55)}, {}),
            ]),
        ]
    else:
        clips = [
            ("Tech_Idle", [
                (1,  {"Arm_R": (-0.65, 0.0, 0.15), "Head": (-0.15, 0.0, 0.0)}, {}),
                (15, {"Arm_R": (-0.72, 0.0, 0.18), "Head": (0.05, 0.0, 0.18)}, {"Pelvis": (0.0, 0.0, 0.02)}),
                (30, {"Arm_R": (-0.65, 0.0, 0.15), "Head": (-0.15, 0.0, 0.0)}, {}),
            ]),
            ("Tech_Walk", [
                (1,  {"Leg_L": (0.42, 0.0, 0.0),  "Leg_R": (-0.42, 0.0, 0.0), "Arm_L": (-0.35, 0.0, 0.0), "Arm_R": (-0.55, 0.0, 0.10)}, {}),
                (15, {"Leg_L": (-0.42, 0.0, 0.0), "Leg_R": (0.42, 0.0, 0.0),  "Arm_L": (0.35, 0.0, 0.0),  "Arm_R": (-0.45, 0.0, 0.10)}, {"Pelvis": (0.0, 0.0, 0.03)}),
                (30, {"Leg_L": (0.42, 0.0, 0.0),  "Leg_R": (-0.42, 0.0, 0.0), "Arm_L": (-0.35, 0.0, 0.0), "Arm_R": (-0.55, 0.0, 0.10)}, {}),
            ]),
            ("Tech_Inspect", [
                (1,  {"Torso": (0.12, 0.0, 0.0), "Arm_R": (-0.85, 0.0, 0.20), "Arm_L": (-0.45, 0.0, -0.15)}, {}),
                (15, {"Torso": (-0.08, 0.0, 0.15), "Arm_R": (-0.95, 0.0, 0.25), "Arm_L": (-1.35, 0.0, -0.25), "Head": (0.25, 0.0, 0.20)}, {}),
                (30, {"Torso": (0.12, 0.0, 0.0), "Arm_R": (-0.85, 0.0, 0.20), "Arm_L": (-0.45, 0.0, -0.15)}, {}),
            ]),
        ]

    _bake_nla_clips(arm_obj, clips)


def build_patrol_k9(x_offset, mats):
    """3. Rigged Airport Security / Wildlife Patrol K9 Dog (`Animal_Patrol_K9` / `Armature_K9`)."""
    bone_defs = [
        ("Root",   (0.0, 0.0, 0.0),    (0.0, 0.0, 0.25),   None),     # 0
        ("Body",   (0.0, -0.28, 0.48), (0.0, 0.28, 0.48),  "Root"),   # 1
        ("Head",   (0.0, 0.28, 0.56),  (0.0, 0.56, 0.72),  "Body"),   # 2
        ("Tail",   (0.0, -0.32, 0.52), (0.0, -0.65, 0.68), "Body"),   # 3
        ("Leg_FL", (-0.14, 0.22, 0.42),(-0.14, 0.22, 0.02),"Body"),   # 4
        ("Leg_FR", (0.14, 0.22, 0.42), (0.14, 0.22, 0.02), "Body"),   # 5
        ("Leg_BL", (-0.14, -0.24, 0.42),(-0.14, -0.24, 0.02),"Body"), # 6
        ("Leg_BR", (0.14, -0.24, 0.42),(0.14, -0.24, 0.02),"Body"),   # 7
    ]

    bm = bmesh.new()
    bone_layer = bm.verts.layers.int.new('bone_idx')
    kmats = [mats['k9_coat'], mats['k9_dark'], mats['cobalt'], mats['amber'], mats['white']]

    # Body + Cobalt/Amber K9 Patrol Harness (bone 1)
    n0 = len(bm.verts)
    add_beveled_box(bm, size=(0.30, 0.66, 0.28), center=(0.0, 0.0, 0.48), bevel_width=0.06, mat_idx=0)
    add_beveled_box(bm, size=(0.33, 0.28, 0.30), center=(0.0, 0.08, 0.49), bevel_width=0.03, mat_idx=2)
    add_beveled_box(bm, size=(0.35, 0.10, 0.12), center=(0.0, 0.08, 0.52), bevel_width=0.015, mat_idx=3)
    _tag_new_verts_bone(bm, bone_layer, n0, 1)

    # Head, Snout & Pointed Ears (bone 2)
    n0 = len(bm.verts)
    add_beveled_box(bm, size=(0.24, 0.26, 0.24), center=(0.0, 0.34, 0.66), bevel_width=0.05, mat_idx=0)
    add_beveled_box(bm, size=(0.14, 0.20, 0.13), center=(0.0, 0.50, 0.62), bevel_width=0.03, mat_idx=1)
    for sx in (-0.08, 0.08):
        add_beveled_box(bm, size=(0.06, 0.07, 0.14), center=(sx, 0.30, 0.82), bevel_width=0.015, mat_idx=1, scale_top=(0.3, 0.3))
    _tag_new_verts_bone(bm, bone_layer, n0, 2)

    # Tail (bone 3)
    n0 = len(bm.verts)
    add_beveled_box(bm, size=(0.08, 0.34, 0.08), center=(0.0, -0.46, 0.58), rotation=(0.38, 0.0, 0.0), bevel_width=0.02, mat_idx=1)
    _tag_new_verts_bone(bm, bone_layer, n0, 3)

    # 4 Legs (bones 4..7)
    for b_idx, (lx, ly) in ((4, (-0.12, 0.22)), (5, (0.12, 0.22)), (6, (-0.12, -0.24)), (7, (0.12, -0.24))):
        n0 = len(bm.verts)
        add_beveled_box(bm, size=(0.09, 0.10, 0.40), center=(lx, ly, 0.21), bevel_width=0.02, mat_idx=0)
        add_beveled_box(bm, size=(0.10, 0.13, 0.07), center=(lx, ly + 0.02, 0.035), bevel_width=0.015, mat_idx=1)
        _tag_new_verts_bone(bm, bone_layer, n0, b_idx)

    arm_obj, _ = _create_armature_and_skinned_mesh(
        "Armature_K9", "Animal_Patrol_K9", (x_offset, 0.0, 0.0), bone_defs, bm, bone_layer, kmats
    )

    clips = [
        ("K9_Idle", [
            (1,  {"Tail": (0.0, 0.0, -0.25), "Head": (0.05, 0.0, 0.0)}, {}),
            (15, {"Tail": (0.0, 0.0, 0.25),  "Head": (-0.08, 0.0, 0.15)}, {"Body": (0.0, 0.0, 0.015)}),
            (30, {"Tail": (0.0, 0.0, -0.25), "Head": (0.05, 0.0, 0.0)}, {}),
        ]),
        ("K9_Walk", [
            (1,  {"Leg_FL": (0.45, 0.0, 0.0), "Leg_BR": (0.45, 0.0, 0.0), "Leg_FR": (-0.45, 0.0, 0.0), "Leg_BL": (-0.45, 0.0, 0.0), "Tail": (0.0, 0.0, -0.20)}, {}),
            (15, {"Leg_FL": (-0.45, 0.0, 0.0),"Leg_BR": (-0.45, 0.0, 0.0),"Leg_FR": (0.45, 0.0, 0.0),  "Leg_BL": (0.45, 0.0, 0.0),  "Tail": (0.0, 0.0, 0.20)}, {"Body": (0.0, 0.0, 0.025)}),
            (30, {"Leg_FL": (0.45, 0.0, 0.0), "Leg_BR": (0.45, 0.0, 0.0), "Leg_FR": (-0.45, 0.0, 0.0), "Leg_BL": (-0.45, 0.0, 0.0), "Tail": (0.0, 0.0, -0.20)}, {}),
        ]),
        ("K9_Run", [
            (1,  {"Body": (0.14, 0.0, 0.0), "Leg_FL": (0.75, 0.0, 0.0), "Leg_FR": (0.65, 0.0, 0.0), "Leg_BL": (-0.75, 0.0, 0.0), "Leg_BR": (-0.65, 0.0, 0.0)}, {"Body": (0.0, 0.0, 0.06)}),
            (15, {"Body": (-0.12, 0.0, 0.0),"Leg_FL": (-0.75, 0.0, 0.0),"Leg_FR": (-0.65, 0.0, 0.0),"Leg_BL": (0.75, 0.0, 0.0),  "Leg_BR": (0.65, 0.0, 0.0)},  {"Body": (0.0, 0.0, 0.01)}),
            (30, {"Body": (0.14, 0.0, 0.0), "Leg_FL": (0.75, 0.0, 0.0), "Leg_FR": (0.65, 0.0, 0.0), "Leg_BL": (-0.75, 0.0, 0.0), "Leg_BR": (-0.65, 0.0, 0.0)}, {"Body": (0.0, 0.0, 0.06)}),
        ]),
    ]
    _bake_nla_clips(arm_obj, clips)


def build_coastal_gull(x_offset, mats):
    """4. Rigged Coastal Seagull (`Animal_Coastal_Gull` / `Armature_Gull`) with articulated flapping wings."""
    bone_defs = [
        ("Root",       (0.0, 0.0, 0.0),    (0.0, 0.0, 0.25),   None),     # 0
        ("Body",       (0.0, -0.25, 0.45), (0.0, 0.28, 0.48),  "Root"),   # 1
        ("Wing_L",     (-0.16, 0.05, 0.48),(-0.62, 0.05, 0.52),"Body"),   # 2
        ("Wing_Tip_L", (-0.62, 0.05, 0.52),(-1.12, -0.05, 0.48),"Wing_L"),# 3
        ("Wing_R",     (0.16, 0.05, 0.48), (0.62, 0.05, 0.52), "Body"),   # 4
        ("Wing_Tip_R", (0.62, 0.05, 0.52), (1.12, -0.05, 0.48),"Wing_R"), # 5
    ]

    bm = bmesh.new()
    bone_layer = bm.verts.layers.int.new('bone_idx')
    gmats = [mats['white'], mats['slate_mid'], mats['slate_dark'], mats['amber']]

    # Body, Head, Beak & Fan Tail (bone 1)
    n0 = len(bm.verts)
    add_uv_sphere_part(bm, radius=0.22, scale=(0.82, 1.45, 0.78), center=(0.0, 0.0, 0.46), u_segments=14, v_segments=10, mat_idx=0)
    add_uv_sphere_part(bm, radius=0.13, scale=(0.90, 1.05, 0.95), center=(0.0, 0.30, 0.58), u_segments=12, v_segments=8, mat_idx=0)
    add_cylinder_part(bm, radius1=0.045, radius2=0.01, depth=0.18, segments=8, center=(0.0, 0.46, 0.56), axis='Y', mat_idx=3)
    add_beveled_box(bm, size=(0.28, 0.26, 0.05), center=(0.0, -0.36, 0.46), bevel_width=0.015, mat_idx=0, scale_top=(0.6, 1.0))
    _tag_new_verts_bone(bm, bone_layer, n0, 1)

    # Inner & Outer Wings (bones 2,3 and 4,5)
    for side, b_in, b_out in ((-1.0, 2, 3), (1.0, 4, 5)):
        n0 = len(bm.verts)
        add_beveled_box(bm, size=(0.48, 0.26, 0.05), center=(side * 0.38, 0.04, 0.49), bevel_width=0.015, mat_idx=1)
        _tag_new_verts_bone(bm, bone_layer, n0, b_in)

        n0 = len(bm.verts)
        add_beveled_box(bm, size=(0.52, 0.20, 0.04), center=(side * 0.85, -0.02, 0.49), rotation=(0.0, 0.0, side * 0.18), bevel_width=0.012, mat_idx=2)
        _tag_new_verts_bone(bm, bone_layer, n0, b_out)

    arm_obj, _ = _create_armature_and_skinned_mesh(
        "Armature_Gull", "Animal_Coastal_Gull", (x_offset, 0.0, 0.0), bone_defs, bm, bone_layer, gmats
    )

    clips = [
        ("Gull_Idle_Perch", [
            (1,  {"Wing_L": (0.0, -0.35, 0.0), "Wing_R": (0.0, 0.35, 0.0)}, {}),
            (15, {"Wing_L": (0.0, -0.28, 0.0), "Wing_R": (0.0, 0.28, 0.0), "Body": (0.06, 0.0, 0.0)}, {}),
            (30, {"Wing_L": (0.0, -0.35, 0.0), "Wing_R": (0.0, 0.35, 0.0)}, {}),
        ]),
        ("Gull_Flap_Climb", [
            (1,  {"Wing_L": (0.0, 0.55, 0.0),  "Wing_Tip_L": (0.0, 0.35, 0.0),  "Wing_R": (0.0, -0.55, 0.0), "Wing_Tip_R": (0.0, -0.35, 0.0)}, {"Body": (0.0, 0.0, -0.04)}),
            (15, {"Wing_L": (0.0, -0.60, 0.0), "Wing_Tip_L": (0.0, -0.45, 0.0), "Wing_R": (0.0, 0.60, 0.0),  "Wing_Tip_R": (0.0, 0.45, 0.0)},  {"Body": (0.0, 0.0, 0.06)}),
            (30, {"Wing_L": (0.0, 0.55, 0.0),  "Wing_Tip_L": (0.0, 0.35, 0.0),  "Wing_R": (0.0, -0.55, 0.0), "Wing_Tip_R": (0.0, -0.35, 0.0)}, {"Body": (0.0, 0.0, -0.04)}),
        ]),
        ("Gull_Glide_Circle", [
            (1,  {"Body": (0.0, 0.18, 0.0),  "Wing_L": (0.0, 0.08, 0.0), "Wing_R": (0.0, -0.08, 0.0)}, {}),
            (15, {"Body": (0.0, -0.18, 0.0), "Wing_L": (0.0, 0.12, 0.0), "Wing_R": (0.0, -0.12, 0.0)}, {"Body": (0.0, 0.0, 0.04)}),
            (30, {"Body": (0.0, 0.18, 0.0),  "Wing_L": (0.0, 0.08, 0.0), "Wing_R": (0.0, -0.08, 0.0)}, {}),
        ]),
    ]
    _bake_nla_clips(arm_obj, clips)


def build_characters_crew(output_dir):
    clear_scene()
    mats = get_standard_materials()

    build_human_character("Armature_Marshaller", "Crew_Marshaller", -4.5, is_marshaller=True, mats=mats)
    build_human_character("Armature_Tech", "Crew_Controller_Tech", -1.5, is_marshaller=False, mats=mats)
    build_patrol_k9(1.5, mats)
    build_coastal_gull(4.5, mats)

    export_family_glb(os.path.join(output_dir, "characters_crew.glb"))


if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    build_characters_crew(out_dir)
