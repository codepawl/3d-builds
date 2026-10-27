"""ED staff and a visitor with armatures and clips: people.glb (refs/staff.md).

Roots, 1.75 m tall, on y = 0, facing +forward:
- staff_nurse (teal scrubs, tablet), staff_doctor (navy scrubs, stethoscope, tablet), staff_porter (grey polo,
  dark trousers), staff_paramedic (dark green uniform with reflective bands), visitor (casual clothes, for the
  waiting room and walk-ins).
Each has an armature `<root>_rig` with bones hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R;
body parts are rigid meshes parented to their bone. Clips (glTF animations, 24 fps), named <root>_<clip>:
idle (2 s), walk (1 s loop, 1.4 m/s), push_bed (1 s loop, arms forward at bed-handle height 0.95 m, 1.0 m/s),
chart (2 s, tablet in the left hand, right hand taps, head down), sit (2 s loop, seated on a 0.45 m seat with
the hips 0.42 m lower; small breathing motion).
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
    "staff_nurse": {"top": "#3fb6b0", "pants": "#3fb6b0", "skin": "#c58c62", "hair": "#2a2420", "shoes": "#f4f6f9",
                    "cap": None, "tablet": True, "stethoscope": True, "bands": False, "long_hair": True},
    "staff_doctor": {"top": "#2a4a7f", "pants": "#2a4a7f", "skin": "#e0b48f", "hair": "#5a4030", "shoes": "#2b313b",
                     "cap": "#2a4a7f", "tablet": True, "stethoscope": True, "bands": False, "long_hair": False},
    "staff_porter": {"top": "#8b96a8", "pants": "#2f3644", "skin": "#8d5a3b", "hair": "#1d1a18", "shoes": "#23272e",
                     "cap": None, "tablet": False, "stethoscope": False, "bands": False, "long_hair": False},
    "staff_paramedic": {"top": "#2f5b4a", "pants": "#2b3a35", "skin": "#d7a982", "hair": "#3a2a20", "shoes": "#1d2128",
                        "cap": None, "tablet": False, "stethoscope": False, "bands": True, "long_hair": False},
    "visitor": {"top": "#c96b4e", "pants": "#4a5a7a", "skin": "#b98a64", "hair": "#2a2420", "shoes": "#e9ecf1",
                "cap": None, "tablet": False, "stethoscope": False, "bands": False, "long_hair": True},
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


def torso_parts(name, mats, colours, top, skin):
    parts = [
        sphere(f"{name}_chest", 0.19, (0, 1.27, 0), top, scale=(1.05, 1.12, 0.75), segments=20),
        cylinder(f"{name}_neck", 0.055, 0.1, (0, 1.46, 0), skin, sides=12),
        box(f"{name}_vneck", (0.1, 0.08, 0.02), (0, 1.39, 0.135), skin, 0.02),
        box(f"{name}_pocket", (0.1, 0.09, 0.015), (0.09, 1.3, 0.14), top, 0.01),
        box(f"{name}_badge", (0.06, 0.08, 0.012), (-0.09, 1.3, 0.145), mats["white"], 0.005),
        box(f"{name}_badge_clip", (0.02, 0.02, 0.014), (-0.09, 1.35, 0.146), mats["brand"], 0.003),
    ]
    if colours["stethoscope"]:
        tube = material("stethoscope", "#2b313b", roughness=0.4)
        for side in (1, -1):
            parts.append(cylinder(f"{name}_steth_tube{side}", 0.012, 0.3, (side * 0.09, 1.3, 0.13), tube, sides=8))
        parts += [cylinder(f"{name}_steth_neck", 0.012, 0.22, (0, 1.44, -0.03), tube, axis="x", sides=8),
                  cylinder(f"{name}_steth_bell", 0.03, 0.015, (0.09, 1.14, 0.14), mats["chrome"], axis="forward", sides=12)]
    if colours["bands"]:
        for index, up in enumerate((1.14, 1.24)):
            parts.append(sphere(f"{name}_band{index}", 0.2, (0, up, 0), mats["reflective"], scale=(1.04, 0.09, 0.76), segments=20))
        parts.append(box(f"{name}_shoulder_patch", (0.08, 0.06, 0.012), (0.17, 1.38, 0.1), mats["brand"], 0.005))
    return parts


def head_parts(name, colours, skin):
    hair = material(f"{name}_hair", colours["hair"], roughness=0.9)
    parts = [
        sphere(f"{name}_skull", 0.115, (0, 1.6, 0.0), skin, scale=(0.92, 1.1, 1.0), segments=20),
        sphere(f"{name}_hair", 0.118, (0, 1.63, -0.015), hair, scale=(0.95, 1.0, 1.0), segments=18),
        box(f"{name}_nose", (0.03, 0.04, 0.03), (0, 1.58, 0.115), skin, 0.012),
    ]
    if colours["long_hair"]:
        parts.append(sphere(f"{name}_bun", 0.06, (0, 1.62, -0.13), hair, segments=12))
    if colours["cap"]:
        cap = material(f"{name}_cap", colours["cap"], roughness=0.8)
        parts.append(sphere(f"{name}_scrub_cap", 0.124, (0, 1.665, -0.01), cap, scale=(0.97, 0.7, 1.02), segments=18))
    return parts


def build_person(name, mats, colours):
    group = root(name)
    rig = make_rig(f"{name}_rig", group)
    top = material(f"{name}_top", colours["top"], roughness=0.85)
    skin = material(f"{name}_skin", colours["skin"], roughness=0.7)
    pants = material(f"{name}_pants", colours["pants"], roughness=0.85)
    shoes = material(f"{name}_shoes", colours["shoes"], roughness=0.5)
    attach(rig, "hips", [sphere(f"{name}_pelvis", 0.16, (0, 0.98, 0), pants, scale=(1.05, 0.7, 0.8), segments=18),
                         sphere(f"{name}_hem", 0.17, (0, 1.06, 0), top, scale=(1.02, 0.32, 0.8), segments=20)])
    attach(rig, "spine", torso_parts(name, mats, colours, top, skin))
    attach(rig, "head", head_parts(name, colours, skin))
    for side, suffix in ((1, "L"), (-1, "R")):
        shoulder, elbow = BONES[f"upper_arm.{suffix}"][0], BONES[f"upper_arm.{suffix}"][1]
        wrist = BONES[f"forearm.{suffix}"][1]
        sleeve_end = tuple(first + (second - first) * 0.55 for first, second in zip(shoulder, elbow))
        attach(rig, f"upper_arm.{suffix}", [sphere(f"{name}_shoulder{suffix}", 0.07, shoulder, top, segments=14),
                                            limb(f"{name}_sleeve{suffix}", shoulder, sleeve_end, 0.068, top, end_radius=0.062),
                                            limb(f"{name}_upper{suffix}", sleeve_end, elbow, 0.052, skin, end_radius=0.048)])
        forearm = [limb(f"{name}_fore{suffix}", elbow, wrist, 0.047, skin, end_radius=0.04),
                   sphere(f"{name}_hand{suffix}", 0.048, (wrist[0], wrist[1] - 0.04, wrist[2]), skin, scale=(0.75, 1.2, 1.0), segments=12)]
        if suffix == "L" and colours["tablet"]:
            forearm += [box(f"{name}_tablet", (0.2, 0.012, 0.27), (wrist[0] - 0.04, wrist[1] - 0.02, wrist[2] + 0.12), mats["dark"], 0.01),
                        box(f"{name}_tablet_screen", (0.17, 0.004, 0.23), (wrist[0] - 0.04, wrist[1] - 0.012, wrist[2] + 0.12), mats["screen"], 0.0)]
        attach(rig, f"forearm.{suffix}", forearm)
        hip, knee = BONES[f"thigh.{suffix}"][0], BONES[f"thigh.{suffix}"][1]
        ankle = BONES[f"shin.{suffix}"][1]
        attach(rig, f"thigh.{suffix}", [limb(f"{name}_thigh{suffix}", hip, knee, 0.08, pants, end_radius=0.066)])
        shin = [limb(f"{name}_shin{suffix}", knee, (ankle[0], ankle[1] + 0.08, ankle[2]), 0.064, pants, end_radius=0.056),
                box(f"{name}_shoe{suffix}", (0.11, 0.1, 0.27), (ankle[0], ankle[1], 0.045), shoes, 0.045)]
        if colours["bands"]:
            shin.append(box(f"{name}_leg_band{suffix}", (0.135, 0.03, 0.135), (ankle[0], 0.32, 0), mats["reflective"], 0.01))
        attach(rig, f"shin.{suffix}", shin)
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


def walk_poses(swing, arms):
    """Four-beat walk; `arms` is None for a natural swing or a fixed arm pose (pushing a bed)."""
    poses = []
    for frame, phase in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
        rotations = {"thigh.L": -swing * phase, "thigh.R": swing * phase,
                     "shin.L": 18 if phase == -1 else 4, "shin.R": 18 if phase == 1 else 4, "spine": 4}
        if arms:
            rotations.update(arms)
        else:
            rotations.update({"upper_arm.L": swing * 0.7 * phase, "upper_arm.R": -swing * 0.7 * phase, "forearm.L": -12, "forearm.R": -12})
        poses.append((frame, rotations, 0.0 if phase else 0.03))
    return poses


def make_clips(rig):
    clip(rig, "idle", [(1, {"forearm.L": -10}, 0.0),
                       (25, {"spine": 2, "head": (-4, 8, 0), "forearm.L": -14}, -0.01),
                       (49, {"forearm.L": -10}, 0.0)])
    clip(rig, "walk", walk_poses(26, None))
    push_arms = {"upper_arm.L": -55, "upper_arm.R": -55, "forearm.L": -35, "forearm.R": -35, "spine": 10}
    clip(rig, "push_bed", walk_poses(20, push_arms))
    hold = {"upper_arm.L": -25, "forearm.L": -75, "head": 22, "spine": 3}
    tap = dict(hold, **{"upper_arm.R": -30, "forearm.R": -70})
    rest = dict(hold, **{"upper_arm.R": -20, "forearm.R": -55})
    clip(rig, "chart", [(1, rest, 0.0), (12, tap, 0.0), (24, rest, 0.0), (36, tap, 0.0), (49, rest, 0.0)])
    seated = {"thigh.L": -90, "thigh.R": -90, "shin.L": 90, "shin.R": 90, "upper_arm.L": -20, "upper_arm.R": -20,
              "forearm.L": -50, "forearm.R": -50}
    breathe = dict(seated, spine=-3, head=-4)
    clip(rig, "sit", [(1, seated, -0.42), (25, breathe, -0.42), (49, seated, -0.42)])


def build():
    reset_scene()
    mats = palette()
    bpy.context.scene.render.fps = FPS
    for index, (name, colours) in enumerate(ROLES.items()):
        rig = build_person(name, mats, colours)
        rig.parent.location.x = index * 1.0
        make_clips(rig)
    export("people.glb", animations=True)


if __name__ == "__main__":
    build()
