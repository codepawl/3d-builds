"""Render one stop-crew figure at the middle frame of each clip (front-left view) to
blender/previews/_pose_<clip>.png, for checking the armature clips. Usage: blender ... --python clip_poses.py"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preview import ASSETS, PREVIEWS, bounds, clear_scene, configure_render, render_view  # noqa: E402

ROOT = "crew_halvard_a"
CLIPS = {"idle": 24, "run": 5, "jack_up": 24, "gun": 12, "carry_tyre": 7, "work": 13}

configure_render()
clear_scene()
bpy.ops.import_scene.gltf(filepath=str(ASSETS / "crew.glb"))
keep = bpy.data.objects[ROOT]
keep_set = {keep} | set(keep.children_recursive)
for obj in list(bpy.context.scene.objects):
    if obj not in keep_set:
        bpy.data.objects.remove(obj, do_unlink=True)
for mat in bpy.data.materials:
    shader = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
    if shader:
        red, green, blue, _ = shader.inputs["Base Color"].default_value
        mat.diffuse_color = (red ** (1 / 2.2), green ** (1 / 2.2), blue ** (1 / 2.2), 1.0)
rig = next(obj for obj in keep_set if obj.type == "ARMATURE")
rig.animation_data_create()
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
for clip, frame in CLIPS.items():
    action = bpy.data.actions.get(f"{ROOT}_{clip}")
    if action is None:
        print(f"Error: missing clip {clip}")
        continue
    rig.animation_data.action = action
    if hasattr(rig.animation_data, "action_slot") and action.slots:
        rig.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    corners = [corner + Vector((0, 0, 0)) for corner in bounds(keep)] + [Vector((-1, -1, 0)), Vector((1, 1, 1.9))]
    render_view(Vector((-0.9, -1.0, 0.35)), corners, 4.0, PREVIEWS / f"_pose_{clip}.png")
    print(f"rendered pose {clip}")
