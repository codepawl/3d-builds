"""Birds for the ATC world (flocks near the coast, a bird-strike hazard near the runways), exported
with armatures and clips to app/public/assets/birds.glb. Original designs.

bird_gull    white body, grey wings with dark tips, 1.4 m span
bird_swift   dark sickle-winged bird, 0.9 m span

Each bird is an armature node named after it with one skinned mesh child <name>_mesh. Bones
(<name>_ prefix): body, head, tail, wing_l, tip_l, wing_r, tip_r; wings flap about the bone's own
x axis. Clips: <name>_flap (one wingbeat, 0.5 s gull, 0.25 s swift, loops) and <name>_glide (2 s loop). Birds are at real size; the
app scales flocks up so they read on the map.
"""
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import combine, cylinder, export, loft, material, point, reset_scene, slab, sphere

FPS = 24


def materials(dark):
    return {
        "body": material("bird_dark" if dark else "bird_white", "#4a5262" if dark else "#fbfcfe", roughness=0.7),
        "wing": material("bird_wing_dark" if dark else "bird_wing", "#3a4150" if dark else "#c3ccd8", roughness=0.7),
        "tip": material("bird_tip", "#262b35", roughness=0.7),
        "beak": material("bird_beak", "#ffc83a", roughness=0.5),
        "eye": material("bird_eye", "#11141a", roughness=0.2),
    }


def wing_outline(span, chord, sweep):
    """Left wing in (x, forward), from the root at x=0.06 to the tip, with vertices at the stations
    the skinning bends at (root, elbow, hand)."""
    stations = [0.06, 0.2, 0.35, 0.5, 0.62, 0.72]
    leading = []
    trailing = []
    for station in stations:
        fraction = station / 0.72
        x = span * fraction
        local_chord = chord * (1.0 - 0.75 * fraction ** 1.6)
        lead = chord * 0.35 - sweep * fraction ** 2
        leading.append((x, lead))
        trailing.append((x, lead - local_chord))
    return leading + list(reversed(trailing))


def build_mesh(name, span, chord, sweep, length, mats):
    parts = [loft(f"{name}_trunk", [
        (length * 0.5, 0, 0, 0.02),
        (length * 0.42, 0.05, 0.05, 0.02),
        (length * 0.2, 0.08, 0.08, 0.0),
        (-length * 0.1, 0.075, 0.07, 0.0),
        (-length * 0.35, 0.04, 0.035, 0.01),
        (-length * 0.48, 0, 0, 0.015),
    ], mats["body"], sides=16)]
    parts.append(sphere(f"{name}_head", 0.07 * length / 0.6, (0, 0.04, length * 0.36), mats["body"], segments=14))
    parts.append(cylinder(f"{name}_beak", 0.018, 0.09 * length / 0.6, (0, 0.03, length * 0.5), mats["beak"], axis="forward", sides=8, radius_end=0.002))
    for side in (1, -1):
        parts.append(sphere(f"{name}_eye{side}", 0.012, (side * 0.045, 0.06, length * 0.4), mats["eye"], segments=8))
    outline = wing_outline(span / 2, chord, sweep)
    for side, label in ((1, "l"), (-1, "r")):
        mirrored = [(side * x, forward) for x, forward in outline]
        parts.append(slab(f"{name}_wing_{label}", mirrored, 0.025, mats["wing"], center=(0, 0.02, 0), round_by=0.008))
        tip = [(side * x, forward) for x, forward in outline if x > span / 2 * 0.7]
        parts.append(slab(f"{name}_tip_{label}", tip, 0.03, mats["tip"], center=(0, 0.02, 0), round_by=0.006))
    tail = [(-0.02, -length * 0.3), (0.02, -length * 0.3), (0.09, -length * 0.55), (0, -length * 0.5), (-0.09, -length * 0.55)]
    parts.append(slab(f"{name}_tail", tail, 0.02, mats["wing"], center=(0, 0.02, 0), round_by=0.006))
    return combine(f"{name}_mesh", parts)


def smoothstep(edge0, edge1, value):
    t = min(1.0, max(0.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def bone_weights(x, forward, span, length):
    """Weights per bone for a vertex at app (x, forward): body near the centre line, head and tail
    along it, wing from the root to the elbow, tip beyond, blended over a short band."""
    half = span / 2
    reach = abs(x)
    side = "l" if x > 0 else "r"
    wing = smoothstep(0.05, 0.1, reach)
    tip = smoothstep(half * 0.45, half * 0.55, reach)
    weights = {f"wing_{side}": wing * (1 - tip), f"tip_{side}": wing * tip}
    centre = 1 - wing
    head = smoothstep(length * 0.22, length * 0.3, forward)
    tail = smoothstep(-length * 0.25, -length * 0.32, forward)
    weights["head"] = centre * head
    weights["tail"] = centre * tail
    weights["body"] = centre * (1 - head - tail)
    return weights


def build_armature(name, span, length):
    data = bpy.data.armatures.new(f"{name}_rig")
    armature = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    half = span / 2

    def add(label, head, tail, parent=None):
        bone = data.edit_bones.new(f"{name}_{label}")
        bone.head = point(*head)
        bone.tail = point(*tail)
        bone.roll = 0.0
        if parent:
            bone.parent = data.edit_bones[f"{name}_{parent}"]
        return bone

    add("body", (0, 0, -length * 0.2), (0, 0, length * 0.2))
    add("head", (0, 0.02, length * 0.25), (0, 0.04, length * 0.45), "body")
    add("tail", (0, 0.01, -length * 0.28), (0, 0.01, -length * 0.5), "body")
    for side, label in ((1, "l"), (-1, "r")):
        add(f"wing_{label}", (side * 0.07, 0.02, 0), (side * half * 0.5, 0.02, 0), "body")
        add(f"tip_{label}", (side * half * 0.5, 0.02, 0), (side * half, 0.02, 0), f"wing_{label}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def skin(mesh, armature, name, span, length):
    for label in ("body", "head", "tail", "wing_l", "tip_l", "wing_r", "tip_r"):
        mesh.vertex_groups.new(name=f"{name}_{label}")
    for vertex in mesh.data.vertices:
        x = vertex.co.x
        forward = -vertex.co.y
        for label, weight in bone_weights(x, forward, span, length).items():
            if weight > 0.001:
                mesh.vertex_groups[f"{name}_{label}"].add([vertex.index], weight, "REPLACE")
    mesh.parent = armature
    modifier = mesh.modifiers.new("rig", "ARMATURE")
    modifier.object = armature


def key_clip(armature, clip_name, frames):
    """frames: list of (frame, {bone label: (rotation about the bone's x axis in degrees)}).
    The wing bones' x axis runs along the body (roll 0), so a positive angle lifts both wings."""
    action = bpy.data.actions.new(clip_name)
    action.use_fake_user = True
    armature.animation_data.action = action
    for frame, angles in frames:
        for label, degrees in angles.items():
            pose_bone = armature.pose.bones[f"{armature.name}_{label}"]
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = (math.radians(degrees), 0, 0)
            pose_bone.keyframe_insert("rotation_euler", frame=frame)
    # Each clip goes on its own NLA track named after it; the exporter writes one animation per track.
    armature.animation_data.action = None
    track = armature.animation_data.nla_tracks.new()
    track.name = clip_name
    track.strips.new(clip_name, int(action.frame_range[0]), action)
    return action


def both(wing, tip):
    return {"wing_l": wing, "wing_r": wing, "tip_l": tip, "tip_r": tip}


def build_bird(name, span, chord, sweep, length, dark, beat):
    mats = materials(dark)
    mesh = build_mesh(name, span, chord, sweep, length, mats)
    armature = build_armature(name, span, length)
    skin(mesh, armature, name, span, length)
    armature.animation_data_create()
    half_beat = round(beat * FPS / 2)
    key_clip(armature, f"{name}_flap", [
        (1, {**both(40, 15), "tail": 0, "head": 0}),
        (1 + half_beat // 2, {**both(5, 25), "tail": -4, "head": 2}),
        (1 + half_beat, {**both(-35, -20), "tail": 0, "head": 0}),
        (1 + half_beat + half_beat // 2, {**both(0, -30), "tail": 4, "head": -2}),
        (1 + 2 * half_beat, {**both(40, 15), "tail": 0, "head": 0}),
    ])
    glide_length = 2 * FPS
    key_clip(armature, f"{name}_glide", [
        (1, {**both(6, -4), "tail": 0, "head": 0}),
        (1 + glide_length // 2, {**both(10, -8), "tail": 6, "head": -3}),
        (1 + glide_length, {**both(6, -4), "tail": 0, "head": 0}),
    ])
    # Leave the default pose at rest so the exported bind pose is the flat-winged model.
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_euler = (0, 0, 0)
    return armature


def main():
    reset_scene()
    bpy.context.scene.render.fps = FPS
    build_bird("bird_gull", span=1.4, chord=0.24, sweep=0.12, length=0.6, dark=False, beat=0.5)
    build_bird("bird_swift", span=0.9, chord=0.14, sweep=0.2, length=0.38, dark=True, beat=0.25)
    export("birds.glb", animations="NLA_TRACKS")


main()
