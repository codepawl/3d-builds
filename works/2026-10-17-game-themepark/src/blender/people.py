"""Guests and staff with armatures and clips: people.glb (refs/people.md).

Roots, adults 1.75 m and children 1.26 m (root scale 0.72), standing on y = 0 and facing +forward:
guest_a .. guest_f (varied tees, shorts or trousers, caps, backpacks, skin tones), guest_child_a, guest_child_b,
staff_operator (park polo in brand coral, visor, name badge), staff_tech (grey coverall, orange vest, hard hat, tool belt).
Each has an armature `<root>_rig` with bones hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R;
body parts are rigid meshes parented to their bone. Clips (24 fps): <root>_idle (2 s), <root>_walk (1 s loop,
1.4 m/s for adults), <root>_wave (2 s, right arm), <root>_operate (2 s, both hands on a console, button press).
Rig and clip helpers come from the fulfillment pack (demos/game-fulfillment/blender/people.py).
"""
import math

import bpy
from mathutils import Matrix

from lib import box, combine, cylinder, export, material, point, reset_scene, root, sphere
from parts import palette

FPS = 24
BONES = {
    "hips": ((0, 0.92, 0), (0, 1.05, 0), None),
    "spine": ((0, 1.05, 0), (0, 1.45, 0), "hips"),
    "head": ((0, 1.45, 0), (0, 1.76, 0), "spine"),
    "upper_arm.L": ((0.21, 1.40, 0), (0.24, 1.13, 0), "spine"),
    "forearm.L": ((0.24, 1.13, 0), (0.25, 0.88, 0), "upper_arm.L"),
    "upper_arm.R": ((-0.21, 1.40, 0), (-0.24, 1.13, 0), "spine"),
    "forearm.R": ((-0.24, 1.13, 0), (-0.25, 0.88, 0), "upper_arm.R"),
    "thigh.L": ((0.1, 0.92, 0), (0.1, 0.5, 0), "hips"),
    "shin.L": ((0.1, 0.5, 0), (0.1, 0.06, 0), "thigh.L"),
    "thigh.R": ((-0.1, 0.92, 0), (-0.1, 0.5, 0), "hips"),
    "shin.R": ((-0.1, 0.5, 0), (-0.1, 0.06, 0), "thigh.R"),
}
ROLES = {
    "guest_a": {"shirt": "#f4a6c0", "legs": "#3a4a66", "skin": "#e0b48f", "hair": "#2a2420", "cap": None, "backpack": None, "shorts": True},
    "guest_b": {"shirt": "#7aaee8", "legs": "#d9c7a6", "skin": "#8d5a3b", "hair": "#1d1a18", "cap": "#f0545c", "backpack": None, "shorts": True},
    "guest_c": {"shirt": "#ffffff", "legs": "#2f3644", "skin": "#c58c62", "hair": "#5a3b25", "cap": None, "backpack": "#3f9a6b", "shorts": False},
    "guest_d": {"shirt": "#e3bd55", "legs": "#4a5568", "skin": "#f0c9a6", "hair": "#c99a5a", "cap": "#2b313b", "backpack": None, "shorts": True},
    "guest_e": {"shirt": "#3f9a6b", "legs": "#e9ecf1", "skin": "#6b4430", "hair": "#141210", "cap": None, "backpack": "#7c6fe0", "shorts": False},
    "guest_f": {"shirt": "#7c6fe0", "legs": "#2f3644", "skin": "#d8a27c", "hair": "#2a2420", "cap": "#e3bd55", "backpack": None, "shorts": True},
    "guest_child_a": {"shirt": "#f0545c", "legs": "#7aaee8", "skin": "#e0b48f", "hair": "#5a3b25", "cap": "#7aaee8", "backpack": None, "shorts": True},
    "guest_child_b": {"shirt": "#e3bd55", "legs": "#3f9a6b", "skin": "#8d5a3b", "hair": "#141210", "cap": None, "backpack": "#f4a6c0", "shorts": True},
    "staff_operator": {"shirt": "#f0545c", "legs": "#2f3644", "skin": "#c58c62", "hair": "#2a2420", "cap": "#b83a45", "backpack": None, "shorts": False, "badge": True},
    "staff_tech": {"shirt": "#8a93a1", "legs": "#8a93a1", "skin": "#e0b48f", "hair": "#2a2420", "cap": None, "backpack": None, "shorts": False, "tech": True},
}


def make_rig(name, group):
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = group
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, (head, tail, parent_name) in BONES.items():
        bone = data.edit_bones.new(bone_name)
        bone.head = point(*head)
        bone.tail = point(*tail)
        bone.roll = 0.0
        if parent_name:
            bone.parent = data.edit_bones[parent_name]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def attach(rig, bone_name, parts):
    head = BONES[bone_name][0]
    obj = combine(f"{rig.name}_{bone_name.replace('.', '_')}", parts, origin=head)
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    pose_bone = rig.pose.bones[bone_name]
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bone_tail_matrix = rig.matrix_world @ pose_bone.matrix @ Matrix.Translation((0, pose_bone.bone.length, 0))
    obj.matrix_parent_inverse = bone_tail_matrix.inverted()
    obj.matrix_world = world
    return obj


def limb(prefix, start, end, radius, mat, end_radius=None):
    middle = tuple((first + second) / 2 for first, second in zip(start, end))
    return cylinder(prefix, radius, math.dist(start, end), middle, mat, sides=16, round_by=radius * 0.6, radius_end=end_radius)


def build_person(name, mats, colours):
    group = root(name)
    rig = make_rig(f"{name}_rig", group)
    shirt = material(f"{name}_shirt", colours["shirt"], roughness=0.8)
    skin = material(f"{name}_skin", colours["skin"], roughness=0.7)
    legs = material(f"{name}_legs", colours["legs"], roughness=0.85)
    hair = material(f"{name}_hair", colours["hair"], roughness=0.9)
    shoes = material("shoes", "#2b2f36", roughness=0.6)
    sole = material("sole", "#f4f6f9", roughness=0.6)
    torso = [sphere(f"{name}_chest", 0.19, (0, 1.27, 0), shirt, scale=(1.05, 1.12, 0.75), segments=20),
             cylinder(f"{name}_neck", 0.055, 0.1, (0, 1.46, 0), skin, sides=12)]
    if colours.get("tech"):
        vest = material("tech_vest", "#ff8a2a", roughness=0.6)
        reflective = material("reflective", "#e6eaf0", roughness=0.2, metallic=0.5)
        torso += [sphere(f"{name}_vest", 0.198, (0, 1.25, 0), vest, scale=(1.06, 1.0, 0.77), segments=20),
                  box(f"{name}_band_low", (0.42, 0.035, 0.31), (0, 1.15, 0), reflective, 0.015),
                  box(f"{name}_band_high", (0.42, 0.035, 0.31), (0, 1.3, 0), reflective, 0.015)]
    if colours.get("badge"):
        torso.append(box(f"{name}_badge", (0.08, 0.05, 0.012), (0.08, 1.35, 0.145), mats["sign_blank"], 0.005))
        torso.append(box(f"{name}_collar", (0.2, 0.04, 0.12), (0, 1.43, 0.06), shirt, 0.015))
    if colours["backpack"]:
        pack = material(f"{name}_pack", colours["backpack"], roughness=0.7)
        torso += [box(f"{name}_backpack", (0.3, 0.38, 0.16), (0, 1.25, -0.2), pack, 0.06),
                  box(f"{name}_pack_pocket", (0.22, 0.14, 0.05), (0, 1.15, -0.29), pack, 0.03)]
    attach(rig, "spine", torso)
    hips = [sphere(f"{name}_pelvis", 0.16, (0, 0.98, 0), legs, scale=(1.05, 0.7, 0.8), segments=18)]
    if colours.get("tech"):
        belt = material("toolbelt", "#5a3b25", roughness=0.8)
        hips += [box(f"{name}_toolbelt", (0.36, 0.08, 0.27), (0, 1.03, 0), belt, 0.02),
                 box(f"{name}_pouch", (0.1, 0.14, 0.08), (0.17, 0.97, 0.06), belt, 0.02)]
    attach(rig, "hips", hips)
    head = [sphere(f"{name}_skull", 0.115, (0, 1.6, 0.0), skin, scale=(0.92, 1.1, 1.0), segments=20),
            sphere(f"{name}_hairdo", 0.118, (0, 1.63, -0.015), hair, scale=(0.95, 1.0, 1.0), segments=18),
            box(f"{name}_nose", (0.03, 0.04, 0.03), (0, 1.58, 0.115), skin, 0.012)]
    if colours.get("tech"):
        hat = material("hard_hat", "#f6f7fa", roughness=0.4)
        head += [sphere(f"{name}_hat", 0.135, (0, 1.67, 0), hat, scale=(1.0, 0.75, 1.08), segments=18),
                 box(f"{name}_hat_brim", (0.29, 0.02, 0.32), (0, 1.645, 0.01), hat, 0.008)]
    elif colours["cap"]:
        cap = material(f"{name}_cap", colours["cap"], roughness=0.6)
        head += [sphere(f"{name}_cap_crown", 0.122, (0, 1.66, -0.005), cap, scale=(0.97, 0.75, 1.02), segments=18),
                 box(f"{name}_cap_brim", (0.17, 0.015, 0.12), (0, 1.665, 0.13), cap, 0.006)]
    attach(rig, "head", head)
    forearm_mat = skin if colours["shorts"] else shirt
    shin_mat = skin if colours["shorts"] else legs
    for suffix in ("L", "R"):
        shoulder, elbow = BONES[f"upper_arm.{suffix}"][0], BONES[f"upper_arm.{suffix}"][1]
        wrist = BONES[f"forearm.{suffix}"][1]
        attach(rig, f"upper_arm.{suffix}", [sphere(f"{name}_shoulder{suffix}", 0.07, shoulder, shirt, segments=14),
                                            limb(f"{name}_upper{suffix}", shoulder, elbow, 0.062, shirt, end_radius=0.052)])
        attach(rig, f"forearm.{suffix}", [limb(f"{name}_fore{suffix}", elbow, wrist, 0.048, forearm_mat, end_radius=0.04),
                                          sphere(f"{name}_hand{suffix}", 0.048, (wrist[0], wrist[1] - 0.04, wrist[2]), skin, scale=(0.75, 1.2, 1.0), segments=12)])
        hip, knee = BONES[f"thigh.{suffix}"][0], BONES[f"thigh.{suffix}"][1]
        ankle = BONES[f"shin.{suffix}"][1]
        attach(rig, f"thigh.{suffix}", [limb(f"{name}_thigh{suffix}", hip, knee, 0.075, legs, end_radius=0.062)])
        attach(rig, f"shin.{suffix}", [
            limb(f"{name}_shin{suffix}", knee, (ankle[0], ankle[1] + 0.08, ankle[2]), 0.058, shin_mat, end_radius=0.045),
            box(f"{name}_shoe{suffix}", (0.11, 0.1, 0.26), (ankle[0], ankle[1], 0.045), shoes, 0.04),
            box(f"{name}_sole{suffix}", (0.112, 0.03, 0.262), (ankle[0], ankle[1] - 0.045, 0.045), sole, 0.01),
        ])
    return rig


def key_pose(rig, frame, rotations, hips_up=0.0):
    for bone_name in BONES:
        pose_bone = rig.pose.bones[bone_name]
        pose_bone.rotation_mode = "XYZ"
        angles = rotations.get(bone_name, 0.0)
        if isinstance(angles, (int, float)):
            angles = (angles, 0.0, 0.0)
        pose_bone.rotation_euler = tuple(math.radians(angle) for angle in angles)
        pose_bone.keyframe_insert("rotation_euler", frame=frame)
    hips = rig.pose.bones["hips"]
    hips.location = (0.0, hips_up, 0.0)
    hips.keyframe_insert("location", frame=frame)


def clip(rig, clip_name, poses):
    action = bpy.data.actions.new(f"{rig.parent.name}_{clip_name}")
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, rotations, hips_up in poses:
        key_pose(rig, frame, rotations, hips_up)
    # With several armatures in one file the exporter only finds actions parked on NLA tracks.
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, 1, action)
    track.mute = True
    return action


def walk_poses(swing):
    poses = []
    for frame, phase in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
        rotations = {"thigh.L": -swing * phase, "thigh.R": swing * phase,
                     "shin.L": 18 if phase == -1 else 4, "shin.R": 18 if phase == 1 else 4, "spine": 4,
                     "upper_arm.L": swing * 0.7 * phase, "upper_arm.R": -swing * 0.7 * phase, "forearm.L": -12, "forearm.R": -12}
        poses.append((frame, rotations, 0.0 if phase else 0.03))
    return poses


def make_clips(rig):
    clip(rig, "idle", [(1, {"head": (0, 0, 0), "forearm.L": -10}, 0.0),
                       (25, {"spine": 2, "head": (-4, 8, 0), "forearm.L": -14}, -0.01),
                       (49, {"head": (0, 0, 0), "forearm.L": -10}, 0.0)])
    clip(rig, "walk", walk_poses(26))
    wave_a = {"upper_arm.R": -160, "forearm.R": (-15, 0, 25), "head": (-6, -10, 0)}
    wave_b = {"upper_arm.R": -160, "forearm.R": (-15, 0, -25), "head": (-6, -10, 0)}
    clip(rig, "wave", [(1, {}, 0.0), (8, wave_a, 0.0), (16, wave_b, 0.0), (24, wave_a, 0.0), (32, wave_b, 0.0), (40, wave_a, 0.0), (49, {}, 0.0)])
    hands_on = {"upper_arm.L": -45, "upper_arm.R": -45, "forearm.L": -50, "forearm.R": -50, "head": 15, "spine": 6}
    press = {"upper_arm.L": -45, "upper_arm.R": -62, "forearm.L": -50, "forearm.R": -28, "head": 18, "spine": 8}
    look = {**hands_on, "head": (10, 18, 0)}
    clip(rig, "operate", [(1, hands_on, 0.0), (14, hands_on, 0.0), (20, press, 0.0), (26, hands_on, 0.0), (40, look, 0.0), (49, hands_on, 0.0)])


def build():
    reset_scene()
    mats = palette()
    bpy.context.scene.render.fps = FPS
    for index, (name, colours) in enumerate(ROLES.items()):
        rig = build_person(name, mats, colours)
        make_clips(rig)
        rig.parent.location = point(index * 1.2, 0, 0)
        if "child" in name:
            rig.parent.scale = (0.72, 0.72, 0.72)
    export("people.glb", animations=True)


if __name__ == "__main__":
    build()
