"""Diagnostic: per mesh node of a GLB, list materials of faces in the front metre and the longest edge.
Usage: blender --background --factory-startup --python probe.py -- <glb> <node prefix>"""
import sys
from collections import Counter

import bpy

glb_path, prefix = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.import_scene.gltf(filepath=glb_path)
bpy.context.view_layer.update()
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or not obj.name.startswith(prefix):
        continue
    mesh = obj.data
    world = obj.matrix_world
    points = [world @ vertex.co for vertex in mesh.vertices]
    front = max(point.y for point in points)
    near_nose = Counter(mesh.materials[polygon.material_index].name for polygon in mesh.polygons if (world @ polygon.center).y > front - 1.0)
    longest = max(mesh.edges, key=lambda edge: (points[edge.vertices[0]] - points[edge.vertices[1]]).length)
    length = (points[longest.vertices[0]] - points[longest.vertices[1]]).length
    print(f"probe {obj.name}: front {front:.2f} nose materials {dict(near_nose)} longest edge {length:.2f} at {points[longest.vertices[0]]} {points[longest.vertices[1]]}")

# Normal check at the nose end (glTF import puts the app's +z forward on Blender -y).
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or not obj.name.endswith("_body") or not obj.name.startswith(prefix):
        continue
    world = obj.matrix_world
    points = [world @ vertex.co for vertex in obj.data.vertices]
    nose_y = min(point.y for point in points)
    inward = Counter()
    for polygon in obj.data.polygons:
        center = world @ polygon.center
        if center.y < nose_y + 1.0 and abs(center.x) < 1.3:
            axis_point = center.copy()
            axis_point.x = 0
            axis_point.z = 1.8
            outward = (world.to_3x3() @ polygon.normal).dot(center - axis_point) > 0
            inward[(obj.data.materials[polygon.material_index].name, "out" if outward else "in")] += 1
    print(f"probe {obj.name} nose normals {dict(inward)}")
