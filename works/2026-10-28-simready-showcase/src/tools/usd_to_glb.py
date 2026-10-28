# Blender 5.2: import one SimReady USD, shrink every texture to a maximum edge, export a .glb.
# Usage: blender -b --factory-startup --python usd_to_glb.py -- <input.usd> <output.glb> <max_texture_edge>
import sys
import bpy

arguments = sys.argv[sys.argv.index("--") + 1:]
input_path = arguments[0]
output_path = arguments[1]
max_texture_edge = int(arguments[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=input_path, import_lights=False, import_cameras=False)

# Physics payloads, grasp helpers and reference copies come in as extra objects; keep only what renders once.
SKIPPED_BRANCHES = ("referenceprims", "grasp", "collision", "collider", "proxy")


def belongs_to_skipped_branch(scene_object):
    current = scene_object
    while current is not None:
        if current.name.lower().startswith(SKIPPED_BRANCHES):
            return True
        current = current.parent
    return False


for scene_object in [candidate for candidate in bpy.data.objects if belongs_to_skipped_branch(candidate)]:
    bpy.data.objects.remove(scene_object, do_unlink=True)

for image in bpy.data.images:
    if image.size[0] == 0:
        continue
    width, height = image.size
    longest_edge = max(width, height)
    if longest_edge > max_texture_edge:
        scale = max_texture_edge / longest_edge
        image.scale(max(1, int(width * scale)), max(1, int(height * scale)))

mesh_objects = [scene_object for scene_object in bpy.data.objects if scene_object.type == "MESH"]
triangle_count = 0
for mesh_object in mesh_objects:
    mesh_object.data.calc_loop_triangles()
    triangle_count += len(mesh_object.data.loop_triangles)
print("MESHES", len(mesh_objects), "TRIANGLES", triangle_count, "IMAGES", len(bpy.data.images))

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_image_format="JPEG",
    export_jpeg_quality=85,
    export_apply=True,
    export_yup=True,
)
