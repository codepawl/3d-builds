"""Cleanroom people in bunny suits, exported to people.glb with their animation clips.

Roots, 1.75 m tall, standing on y = 0, facing +forward:
  person_engineer    process engineer with a tablet
  person_technician  maintenance technician with a powered respirator pack and tool belt
Each has an armature `<root>_rig` with bones hips, spine, head, upper_arm.L/R, forearm.L/R,
thigh.L/R, shin.L/R; body parts are rigid meshes parented to their bone. Materials `suit_accent`
(gloves, boots, badge) can be recoloured per role. Clips (glTF animations) are named
<root>_idle (2 s), <root>_walk (1 s loop, 1.3 m/s), <root>_work (2 s, hands at a tool screen)
and person_technician_carry (1 s walk holding a pod at chest height).
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import box, combine, cylinder, export, material, point, reset_scene, root, sphere  # noqa: E402
from parts import palette  # noqa: E402

FPS = 24
# bone: (head, tail, parent) in app space (x, up, forward); .L is +x, the character's left.
BONES = {
    "hips": ((0, 0.92, 0), (0, 1.05, 0), None),
    "spine": ((0, 1.05, 0), (0, 1.45, 0), "hips"),
    "head": ((0, 1.45, 0), (0, 1.76, 0), "spine"),
    "upper_arm.L": ((0.22, 1.40, 0), (0.25, 1.13, 0), "spine"),
    "forearm.L": ((0.25, 1.13, 0), (0.26, 0.88, 0), "upper_arm.L"),
    "upper_arm.R": ((-0.22, 1.40, 0), (-0.25, 1.13, 0), "spine"),
    "forearm.R": ((-0.25, 1.13, 0), (-0.26, 0.88, 0), "upper_arm.R"),
    "thigh.L": ((0.1, 0.92, 0), (0.1, 0.5, 0), "hips"),
    "shin.L": ((0.1, 0.5, 0), (0.1, 0.06, 0), "thigh.L"),
    "thigh.R": ((-0.1, 0.92, 0), (-0.1, 0.5, 0), "hips"),
    "shin.R": ((-0.1, 0.5, 0), (-0.1, 0.06, 0), "thigh.R"),
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
    """Bake parts into one mesh with its origin at the bone head and parent it rigidly to the bone."""
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
    """A rounded capsule-like limb between two points (they differ only slightly in x)."""
    middle = tuple((first + second) / 2 for first, second in zip(start, end))
    length = math.dist(start, end)
    return cylinder(prefix, radius, length, middle, mat, sides=16, round_by=radius * 0.6, radius_end=end_radius)


def build_person(name, mats, technician):
    group = root(name)
    rig = make_rig(f"{name}_rig", group)
    suit = material("suit", "#f6f8fb", roughness=0.75)
    accent = material("suit_accent", "#7b5cff" if not technician else "#f2a93b", roughness=0.5)
    visor = material("visor", "#24323f", roughness=0.1, metallic=0.4)
    skin_band = material("mask", "#dfe6ee", roughness=0.6)

    attach(rig, "hips", [
        sphere(f"{name}_pelvis", 0.17, (0, 0.98, 0), suit, scale=(1.05, 0.7, 0.8), segments=18),
    ] + ([box(f"{name}_belt", (0.36, 0.07, 0.26), (0, 1.02, 0), accent, 0.03),
          box(f"{name}_pouch", (0.1, 0.12, 0.06), (0.14, 0.98, 0.13), mats["trim"], 0.02)] if technician else []))
    torso = [
        sphere(f"{name}_chest", 0.2, (0, 1.27, 0), suit, scale=(1.05, 1.15, 0.78), segments=20),
        box(f"{name}_zip", (0.02, 0.32, 0.02), (0, 1.25, 0.155), mats["panel"], 0.006),
        box(f"{name}_badge", (0.08, 0.05, 0.015), (0.09, 1.36, 0.15), accent, 0.006),
    ]
    if technician:
        torso += [
            box(f"{name}_pack", (0.3, 0.34, 0.14), (0, 1.25, -0.2), mats["panel"], 0.05),
            box(f"{name}_packband", (0.31, 0.05, 0.15), (0, 1.32, -0.2), accent, 0.01),
            cylinder(f"{name}_hose", 0.025, 0.3, (0.12, 1.5, -0.14), mats["trim"], sides=10),
            box(f"{name}_packlamp", (0.05, 0.03, 0.01), (-0.08, 1.15, -0.275), mats["status"], 0.005),
        ]
    attach(rig, "spine", torso)
    attach(rig, "head", [
        sphere(f"{name}_hood", 0.16, (0, 1.6, -0.01), suit, scale=(1.0, 1.12, 1.05), segments=20),
        box(f"{name}_visor", (0.22, 0.07, 0.06), (0, 1.62, 0.13), visor, 0.03),
        box(f"{name}_mask", (0.16, 0.08, 0.05), (0, 1.53, 0.135), skin_band, 0.025),
        box(f"{name}_visorframe", (0.25, 0.1, 0.04), (0, 1.62, 0.115), accent, 0.02),
    ])
    for side, suffix in ((1, "L"), (-1, "R")):
        shoulder, elbow = BONES[f"upper_arm.{suffix}"][0], BONES[f"upper_arm.{suffix}"][1]
        wrist = BONES[f"forearm.{suffix}"][1]
        attach(rig, f"upper_arm.{suffix}", [
            sphere(f"{name}_shoulder{suffix}", 0.075, shoulder, suit, segments=14),
            limb(f"{name}_upper{suffix}", shoulder, elbow, 0.075, suit, end_radius=0.066),
        ])
        forearm = [
            limb(f"{name}_fore{suffix}", elbow, wrist, 0.058, suit, end_radius=0.05),
            sphere(f"{name}_glove{suffix}", 0.055, (wrist[0], wrist[1] - 0.04, wrist[2]), accent, scale=(0.8, 1.2, 1.0), segments=12),
        ]
        if suffix == "R" and not technician:
            forearm.append(box(f"{name}_tablet", (0.02, 0.24, 0.17), (wrist[0] - 0.03, wrist[1] - 0.02, 0.06), mats["trim"], 0.01))
            forearm.append(box(f"{name}_tabletscreen", (0.024, 0.2, 0.13), (wrist[0] - 0.03, wrist[1] - 0.02, 0.06), mats["screen"], 0.005))
        if suffix == "L" and technician:
            forearm.append(box(f"{name}_wrench", (0.03, 0.2, 0.04), (wrist[0], wrist[1] - 0.12, 0.02), mats["steel"], 0.01))
        attach(rig, f"forearm.{suffix}", forearm)
        hip, knee = BONES[f"thigh.{suffix}"][0], BONES[f"thigh.{suffix}"][1]
        ankle = BONES[f"shin.{suffix}"][1]
        attach(rig, f"thigh.{suffix}", [limb(f"{name}_thigh{suffix}", hip, knee, 0.085, suit, end_radius=0.07)])
        attach(rig, f"shin.{suffix}", [
            limb(f"{name}_shin{suffix}", knee, (ankle[0], ankle[1] + 0.1, ankle[2]), 0.07, suit, end_radius=0.065),
            box(f"{name}_boot{suffix}", (0.12, 0.14, 0.26), (ankle[0], ankle[1] + 0.02, 0.04), accent, 0.05),
            box(f"{name}_sole{suffix}", (0.12, 0.03, 0.26), (ankle[0], ankle[1] - 0.045, 0.04), mats["rubber"], 0.01),
        ])
    return rig


# --- clips -----------------------------------------------------------------------------------

def key_pose(rig, frame, rotations, hips_up=0.0):
    """Key every bone at `frame`; `rotations` maps bone name to degrees about its x axis
    (positive swings the limb backwards for legs and arms)."""
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
    """Make one action from a list of (frame, rotations, hips_up)."""
    action = bpy.data.actions.new(f"{rig.parent.name}_{clip_name}")
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, rotations, hips_up in poses:
        key_pose(rig, frame, rotations, hips_up)
    # With more than one armature in the file the glTF exporter only finds actions on NLA
    # tracks, so each clip is parked on its own muted track.
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, 1, action)
    track.mute = True
    return action


def walk_poses(swing, carry):
    """A one-second stride: legs swing opposite, arms counter-swing unless carrying."""
    poses = []
    for frame, phase in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
        rotations = {
            "thigh.L": -swing * phase, "thigh.R": swing * phase,
            "shin.L": 18 if phase == -1 else 4, "shin.R": 18 if phase == 1 else 4,
            "spine": 4,
        }
        if carry:
            rotations.update({"upper_arm.L": -45, "upper_arm.R": -45, "forearm.L": -50, "forearm.R": -50})
        else:
            rotations.update({"upper_arm.L": swing * 0.7 * phase, "upper_arm.R": -swing * 0.7 * phase,
                              "forearm.L": -12, "forearm.R": -12})
        poses.append((frame, rotations, 0.0 if phase else 0.03))
    return poses


def make_clips(rig, technician):
    clip(rig, "idle", [
        (1, {"spine": 0, "head": (0, 0, 0), "forearm.R": -20 if not technician else -8}, 0.0),
        (25, {"spine": 2, "head": (-4, 8, 0), "forearm.R": -24 if not technician else -10}, -0.01),
        (49, {"spine": 0, "head": (0, 0, 0), "forearm.R": -20 if not technician else -8}, 0.0),
    ])
    clip(rig, "walk", walk_poses(24, carry=False))
    reach = {"upper_arm.L": -40, "upper_arm.R": -55, "forearm.L": -60, "forearm.R": -40, "head": 12, "spine": 6}
    tap = dict(reach, **{"forearm.R": -55, "upper_arm.R": -60})
    clip(rig, "work", [(1, reach, 0.0), (13, tap, 0.0), (25, reach, 0.0), (37, tap, 0.0), (49, reach, 0.0)])
    if technician:
        clip(rig, "carry", walk_poses(18, carry=True))


def main():
    reset_scene()
    mats = palette()
    bpy.context.scene.render.fps = FPS
    for name, technician in (("person_engineer", False), ("person_technician", True)):
        rig = build_person(name, mats, technician)
        make_clips(rig, technician)
    export("people.glb", animations=True)


main()
