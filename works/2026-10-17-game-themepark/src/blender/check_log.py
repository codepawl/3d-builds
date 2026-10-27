"""Measure the log boat mesh: faces whose centre is above 0.85 m near mid-length (should be none if the top is open).
Usage: blender --background --factory-startup --python check_log.py"""
from pathlib import Path

import bpy

glb = Path(__file__).resolve().parent.parent / "app" / "public" / "assets" / "flume.glb"
bpy.ops.import_scene.gltf(filepath=str(glb))
log = bpy.data.objects["flume_log_a"]
for obj in [log] + list(log.children_recursive):
    if obj.type != "MESH":
        continue
    top_faces = [p for p in obj.data.polygons if p.center.z > 0.85 and abs(p.center.y) < 1.5]
    materials = sorted({obj.data.materials[p.material_index].name for p in top_faces}) if top_faces else []
    print(f"rendered check {obj.name}: faces {len(obj.data.polygons)}, closed-top faces {len(top_faces)} {materials}")
