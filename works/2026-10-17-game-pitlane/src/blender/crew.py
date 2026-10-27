"""Pit crew, garage mechanics and marshals with armatures and clips: crew.glb (refs/pit_crew.md).

Roots, 1.78 m tall, on y = 0, facing +forward:
  crew_halvard_a, crew_halvard_b   stop crew in team overalls and visor helmets (two colour arrangements)
  crew_ostrava, crew_kestrel       rival stop crews
  mechanic_halvard                 garage mechanic, team shirt and headset, no helmet
  marshal                          orange overalls, cap
Armature `<root>_rig`: hips, spine, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R; body parts are rigid
meshes parented to their bone. Anchors: `<root>_grip_R` (right hand, for the wheel gun or jack handle) and
`<root>_grip_carry` (chest, for a carried tyre), both follow their bones.
Clips (glTF animations, 24 fps), named `<root>_<clip>`: idle (2 s), run (0.67 s loop, about 5 m/s),
jack_up (2 s: lean on the jack pole and lift, hold, release), gun (2 s: kneel at the hub, gun on, nut spun, off),
carry_tyre (1 s loop walk holding a tyre at the chest), work (2 s: bent over the car, hands working).
"""
import math

import bpy
from mathutils import Matrix

from lib import box, combine, cylinder, export, loft, material, point, reset_scene, root, sphere
from parts import TEAMS, palette, tube

FPS = 24
BONES = {
    "hips": ((0, 0.93, 0), (0, 1.06, 0), None),
    "spine": ((0, 1.06, 0), (0, 1.46, 0), "hips"),
    "head": ((0, 1.46, 0), (0, 1.78, 0), "spine"),
    "upper_arm.L": ((0.22, 1.41, 0), (0.25, 1.13, 0), "spine"),
    "forearm.L": ((0.25, 1.13, 0), (0.26, 0.88, 0), "upper_arm.L"),
    "upper_arm.R": ((-0.22, 1.41, 0), (-0.25, 1.13, 0), "spine"),
    "forearm.R": ((-0.25, 1.13, 0), (-0.26, 0.88, 0), "upper_arm.R"),
    "thigh.L": ((0.1, 0.93, 0), (0.1, 0.5, 0), "hips"),
    "shin.L": ((0.1, 0.5, 0), (0.1, 0.06, 0), "thigh.L"),
    "thigh.R": ((-0.1, 0.93, 0), (-0.1, 0.5, 0), "hips"),
    "shin.R": ((-0.1, 0.5, 0), (-0.1, 0.06, 0), "thigh.R"),
}
ROLES = {
    "crew_halvard_a": {"team": "halvard", "suit": "primary", "band": "accent", "head": "helmet", "skin": "#c58c62"},
    "crew_halvard_b": {"team": "halvard", "suit": "primary", "band": "secondary", "head": "helmet", "skin": "#8d5a3b"},
    "crew_ostrava": {"team": "ostrava", "suit": "primary", "band": "secondary", "head": "helmet", "skin": "#e0b48f"},
    "crew_kestrel": {"team": "kestrel", "suit": "secondary", "band": "accent", "head": "helmet", "skin": "#c58c62"},
    "mechanic_halvard": {"team": "halvard", "suit": "secondary", "band": "primary", "head": "headset", "skin": "#e0b48f"},
    "marshal": {"team": None, "suit": "#ff7a1a", "band": "#f4f6fa", "head": "cap", "skin": "#8d5a3b"},
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


def bind_to_bone(rig, bone_name, obj):
    """Parent an object to a bone while keeping its world placement."""
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


def attach(rig, bone_name, parts):
    obj = combine(f"{rig.name}_{bone_name.replace('.', '_')}", parts, origin=BONES[bone_name][0])
    return bind_to_bone(rig, bone_name, obj)


def grip(rig, name, bone_name, location):
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = point(*location)
    return bind_to_bone(rig, bone_name, empty)


def limb(prefix, start, end, radius, mat, end_radius=None):
    middle = tuple((first + second) / 2 for first, second in zip(start, end))
    return cylinder(prefix, radius, math.dist(start, end), middle, mat, sides=16, round_by=radius * 0.6, radius_end=end_radius)


def colour(spec, key, mats):
    value = spec[key]
    if value.startswith("#"):
        return material(f"suit_{value[1:].lower()}", value, roughness=0.75)
    return mats[f"{spec['team']}_{value}"]


def build_person(name, spec, mats):
    group = root(name)
    rig = make_rig(f"{name}_rig", group)
    suit = colour(spec, "suit", mats)
    band = colour(spec, "band", mats)
    skin = material(f"skin_{spec['skin'][1:]}", spec["skin"], roughness=0.7)
    boots = material("boots", "#23272e", roughness=0.6)
    glove = material("glove", "#2f343d", roughness=0.8)
    attach(rig, "hips", [sphere(f"{name}_pelvis", 0.16, (0, 0.99, 0), suit, scale=(1.05, 0.7, 0.8), segments=18),
                         loft(f"{name}_belt", [(1.015, 0.172, 0.13, 0), (1.065, 0.172, 0.13, 0)], band, sides=20, axis="up")])
    torso = [
        sphere(f"{name}_chest", 0.195, (0, 1.27, 0), suit, scale=(1.06, 1.12, 0.76), segments=20),
        loft(f"{name}_chest_band", [(1.30, 0.204, 0.148, 0), (1.37, 0.198, 0.143, 0)], band, sides=24, axis="up"),
        box(f"{name}_badge", (0.08, 0.05, 0.012), (0.09, 1.38, 0.15), mats["plate"], 0.005),
        cylinder(f"{name}_neck", 0.056, 0.1, (0, 1.47, 0), skin if spec["head"] != "helmet" else suit, sides=12),
    ]
    if spec["head"] == "headset":
        torso.append(box(f"{name}_radio", (0.08, 0.12, 0.05), (-0.12, 1.08, -0.15), boots, 0.015))
    attach(rig, "spine", torso)
    if spec["head"] == "helmet":
        helmet_mat = mats[f"{spec['team']}_secondary"] if spec["suit"] == "primary" else mats[f"{spec['team']}_primary"]
        head_parts = [
            sphere(f"{name}_helmet", 0.15, (0, 1.62, 0.0), helmet_mat, scale=(0.9, 1.0, 1.02), segments=22),
            sphere(f"{name}_visor", 0.12, (0, 1.62, 0.065), mats["glass"], scale=(0.95, 0.5, 0.75), segments=16),
        ]
    else:
        hair = material("hair", "#2a2420", roughness=0.9)
        head_parts = [
            sphere(f"{name}_skull", 0.115, (0, 1.61, 0.0), skin, scale=(0.92, 1.1, 1.0), segments=20),
            sphere(f"{name}_hair", 0.118, (0, 1.64, -0.015), hair, scale=(0.95, 1.0, 1.0), segments=18),
            box(f"{name}_nose", (0.03, 0.04, 0.03), (0, 1.59, 0.115), skin, 0.012),
        ]
        if spec["head"] == "headset":
            head_parts += [tube(f"{name}_headband", [(0.12, 1.6, 0), (0.1, 1.72, 0), (0, 1.755, 0), (-0.1, 1.72, 0), (-0.12, 1.6, 0)], 0.012, boots, sides=6),
                           sphere(f"{name}_cupL", 0.05, (0.125, 1.6, 0), boots, scale=(0.6, 1, 1), segments=12),
                           sphere(f"{name}_cupR", 0.05, (-0.125, 1.6, 0), boots, scale=(0.6, 1, 1), segments=12),
                           tube(f"{name}_mic", [(0.12, 1.57, 0.02), (0.08, 1.54, 0.1), (0.03, 1.555, 0.12)], 0.006, boots, sides=5)]
        else:
            cap = material("cap_white", "#f4f6fa", roughness=0.6)
            head_parts += [sphere(f"{name}_cap_crown", 0.122, (0, 1.67, -0.005), cap, scale=(0.97, 0.75, 1.02), segments=18),
                           box(f"{name}_cap_brim", (0.17, 0.015, 0.12), (0, 1.675, 0.13), cap, 0.006)]
    attach(rig, "head", head_parts)
    for suffix in ("L", "R"):
        shoulder, elbow = BONES[f"upper_arm.{suffix}"][0], BONES[f"upper_arm.{suffix}"][1]
        wrist = BONES[f"forearm.{suffix}"][1]
        attach(rig, f"upper_arm.{suffix}", [sphere(f"{name}_shoulder{suffix}", 0.075, shoulder, band, segments=14),
                                            limb(f"{name}_upper{suffix}", shoulder, elbow, 0.066, suit, end_radius=0.056)])
        attach(rig, f"forearm.{suffix}", [limb(f"{name}_fore{suffix}", elbow, wrist, 0.052, suit, end_radius=0.045),
                                          box(f"{name}_cuff{suffix}", (0.1, 0.03, 0.1), (wrist[0], wrist[1] + 0.03, wrist[2]), band, 0.01),
                                          sphere(f"{name}_hand{suffix}", 0.052, (wrist[0], wrist[1] - 0.04, wrist[2]), glove, scale=(0.75, 1.2, 1.0), segments=12)])
        hip, knee = BONES[f"thigh.{suffix}"][0], BONES[f"thigh.{suffix}"][1]
        ankle = BONES[f"shin.{suffix}"][1]
        attach(rig, f"thigh.{suffix}", [limb(f"{name}_thigh{suffix}", hip, knee, 0.077, suit, end_radius=0.063)])
        attach(rig, f"shin.{suffix}", [
            limb(f"{name}_shin{suffix}", knee, (ankle[0], ankle[1] + 0.08, ankle[2]), 0.061, suit, end_radius=0.052),
            sphere(f"{name}_kneepad{suffix}", 0.06, (knee[0], knee[1] - 0.02, knee[2] + 0.04), band, scale=(1, 1, 0.6), segments=10),
            box(f"{name}_boot{suffix}", (0.11, 0.11, 0.28), (ankle[0], ankle[1], 0.045), boots, 0.04),
        ])
    grip(rig, f"{name}_grip_R", "forearm.R", (-0.26, 0.84, 0.0))
    grip(rig, f"{name}_grip_carry", "spine", (0, 1.05, 0.42))
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


def stride_poses(swing, step_frames, lean, arms):
    poses = []
    frames = [1 + step_frames * index for index in range(5)]
    for frame, phase in zip(frames, (1, 0, -1, 0, 1)):
        rotations = {"thigh.L": -swing * phase, "thigh.R": swing * phase,
                     "shin.L": swing * 0.9 if phase == -1 else 6, "shin.R": swing * 0.9 if phase == 1 else 6, "spine": lean}
        rotations.update(arms(phase))
        poses.append((frame, rotations, 0.0 if phase else 0.035))
    return poses


def make_clips(rig):
    clip(rig, "idle", [(1, {"forearm.L": -10, "forearm.R": -10}, 0.0),
                       (25, {"spine": 2, "head": (-4, 8, 0), "forearm.L": -14, "forearm.R": -8}, -0.01),
                       (49, {"forearm.L": -10, "forearm.R": -10}, 0.0)])
    clip(rig, "run", stride_poses(42, 4, 12, lambda phase: {"upper_arm.L": 45 * phase, "upper_arm.R": -45 * phase,
                                                            "forearm.L": -70, "forearm.R": -70}))
    clip(rig, "carry_tyre", stride_poses(20, 6, 6, lambda phase: {"upper_arm.L": (-28, 0, 12), "upper_arm.R": (-28, 0, -12),
                                                                  "forearm.L": -62, "forearm.R": -62}))
    ready = {"spine": 22, "thigh.L": -35, "thigh.R": -10, "shin.L": 40, "shin.R": 25,
             "upper_arm.L": -55, "upper_arm.R": -55, "forearm.L": -25, "forearm.R": -25, "head": -12}
    lifted = {"spine": -12, "thigh.L": -15, "thigh.R": 12, "shin.L": 18, "shin.R": 10,
              "upper_arm.L": -22, "upper_arm.R": -22, "forearm.L": -12, "forearm.R": -12, "head": 6}
    clip(rig, "jack_up", [(1, ready, -0.08), (10, lifted, -0.02), (38, lifted, -0.02), (49, ready, -0.08)])
    kneel = {"spine": 24, "thigh.L": -88, "shin.L": 92, "thigh.R": 4, "shin.R": 92,
             "upper_arm.L": -72, "upper_arm.R": -70, "forearm.L": -28, "forearm.R": -24, "head": -8}
    gun_on = dict(kneel, **{"upper_arm.R": -78, "forearm.R": -14, "upper_arm.L": -80, "forearm.L": -14, "spine": 30})
    jitter = dict(gun_on, **{"forearm.R": -18, "forearm.L": -18})
    clip(rig, "gun", [(1, kneel, -0.45), (6, gun_on, -0.45), (9, jitter, -0.45), (12, gun_on, -0.45), (15, jitter, -0.45),
                      (18, gun_on, -0.45), (30, kneel, -0.45), (49, kneel, -0.45)])
    bent = {"spine": 38, "head": 10, "thigh.L": -12, "thigh.R": -12, "shin.L": 10, "shin.R": 10,
            "upper_arm.L": -70, "upper_arm.R": -62, "forearm.L": -35, "forearm.R": -20}
    reach = dict(bent, **{"upper_arm.R": -78, "forearm.R": -40, "upper_arm.L": -60, "forearm.L": -20})
    clip(rig, "work", [(1, bent, -0.04), (13, reach, -0.04), (25, bent, -0.04), (37, reach, -0.04), (49, bent, -0.04)])


def build():
    reset_scene()
    mats = palette()
    bpy.context.scene.render.fps = FPS
    for name, spec in ROLES.items():
        make_clips(build_person(name, spec, mats))
    export("crew.glb", animations=True)


if __name__ == "__main__":
    build()
