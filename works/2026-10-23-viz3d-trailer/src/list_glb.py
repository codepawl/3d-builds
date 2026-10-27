"""Lists top-level objects of GLB files: blender --background --python list_glb.py -- out.txt a.glb b.glb"""
import sys
import bpy

arguments = sys.argv[sys.argv.index("--") + 1:]
output_path, glb_paths = arguments[0], arguments[1:]
lines = []
for glb_path in glb_paths:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    lines.append(f"## {glb_path}")
    for obj in bpy.data.objects:
        if obj.parent is None:
            mesh_count = sum(1 for child in obj.children_recursive if child.type == "MESH") + (1 if obj.type == "MESH" else 0)
            lines.append(f"{obj.name}\t{obj.type}\tmeshes={mesh_count}\tchildren={len(obj.children)}")
open(output_path, "w", encoding="utf-8").write("\n".join(lines))
