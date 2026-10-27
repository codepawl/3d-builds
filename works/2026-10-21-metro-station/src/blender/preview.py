"""Render angle shots of one GLB (optionally one root node of it) to PNGs.
Run: blender --background --factory-startup --python preview.py -- <glb> <out_prefix> <root_or_all> [view ...]
Views: iso, back, side, front, top, close (close = three-quarter near the first-found root's front)."""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

VIEWS = {
    "iso": (35, 28, False),
    "back": (215, 28, False),
    "side": (0, 0, True),
    "front": (90, 0, True),
    "top": (0, 89.9, True),
    "close": (60, 18, False),
}


def descendants(node):
    return [node] + list(node.children_recursive)


def bounds(objects):
    corners = []
    for node in objects:
        if node.type == "MESH":
            corners += [node.matrix_world @ Vector(corner) for corner in node.bound_box]
    low = Vector((min(c[i] for c in corners) for i in range(3)))
    high = Vector((max(c[i] for c in corners) for i in range(3)))
    return low, high


def main():
    glb_path, out_prefix, root_name = sys.argv[sys.argv.index("--") + 1:][:3]
    requested = sys.argv[sys.argv.index("--") + 4:] or ["iso", "side", "front", "top"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    roots = [node for node in bpy.data.objects if node.parent is None]
    if root_name != "all":
        chosen = [node for node in roots if node.name == root_name][0]
        for node in roots:
            if node is not chosen:
                for member in descendants(node):
                    member.hide_render = True
        visible = descendants(chosen)
        chosen_location = chosen.matrix_world.translation
    else:
        visible = list(bpy.data.objects)
        chosen_location = Vector((0, 0, 0))
    low, high = bounds(visible)
    center = (low + high) / 2
    radius = (high - low).length / 2

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 500
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.55, 0.72, 0.88, 1)
    background.inputs["Strength"].default_value = 0.8
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 2.6
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))
    scene.collection.objects.link(sun)
    camera_data = bpy.data.cameras.new("Cam")
    camera = bpy.data.objects.new("Cam", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    for view in requested:
        azimuth, elevation, orthographic = VIEWS[view]
        azimuth_rad = math.radians(azimuth)
        elevation_rad = math.radians(elevation)
        direction = Vector((math.cos(elevation_rad) * math.cos(azimuth_rad - math.pi / 2),
                            math.cos(elevation_rad) * math.sin(azimuth_rad - math.pi / 2),
                            math.sin(elevation_rad)))
        camera.location = center + direction * radius * 3.2
        look = center - camera.location
        camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
        camera_data.type = "ORTHO" if orthographic else "PERSP"
        camera_data.ortho_scale = radius * 2.1 if orthographic else 50
        camera_data.lens = 50
        camera_data.clip_end = radius * 20
        if not orthographic:
            camera.location = center + direction * radius * 4.6
            look = center - camera.location
            camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = f"{out_prefix}-{view}.png"
        bpy.ops.render.render(write_still=True)
        sidecar = {"center": list(center), "radius": radius, "root_location": list(chosen_location)}
        with open(f"{out_prefix}-{view}.json", "w") as sidecar_file:
            json.dump(sidecar, sidecar_file)
        print("RENDERED", scene.render.filepath)


main()
