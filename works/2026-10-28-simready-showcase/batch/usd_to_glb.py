# Blender 5.2: import one SimReady USD and export it as a plain .glb with its original textures.
# This is the "straight out of Blender" stage; optimize.mjs does the rest.
# Usage: blender -b --factory-startup --python usd_to_glb.py -- <input.usd> <output.glb>
import sys
import bpy

arguments = sys.argv[sys.argv.index("--") + 1:]
input_path = arguments[0]
output_path = arguments[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=input_path, import_lights=False, import_cameras=False)

# Physics payloads, grasp helpers and reference copies come in as extra objects; keep only what renders.
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

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_image_format="AUTO",
    export_apply=True,
    export_yup=True,
)
