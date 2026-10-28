# Blender 5.2: import one SimReady USD and export it as a plain .glb with its original textures.
# This is the "straight out of Blender" stage; optimize.mjs does the rest.
# Usage: blender -b --factory-startup --python usd_to_glb.py -- <input.usd> <output.glb>
import os
import sys
import time
import bpy
import numpy

arguments = sys.argv[sys.argv.index("--") + 1:]
input_path = arguments[0]
output_path = arguments[1]
started = time.time()


def log_stage(stage):
    # Stage timings show where a slow asset spends its time when the batch kills it.
    meshes = [candidate for candidate in bpy.data.objects if candidate.type == "MESH"]
    triangles = sum(len(candidate.data.polygons) for candidate in meshes)
    print(f"[stage] {stage} {time.time() - started:.1f}s objects {len(bpy.data.objects)} meshes {len(meshes)} "
          f"mesh datablocks {len(bpy.data.meshes)} polygons {triangles}", flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=input_path, import_lights=False, import_cameras=False)
log_stage("imported")

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
log_stage("pruned")


def tile_path(tiled_image, tile_number):
    # A tiled image's path carries the <UDIM> token or the 1001 tile's number.
    raw_path = tiled_image.filepath
    if "<UDIM>" in raw_path:
        return raw_path.replace("<UDIM>", str(tile_number))
    return raw_path.replace("1001", str(tile_number))


def material_for_tile(material, tile_number, cache):
    """A copy of the material whose UDIM images are replaced by the single image of one tile."""
    key = (material.name, tile_number)
    if key not in cache:
        tile_material = material.copy()
        tile_material.name = f"{material.name}_{tile_number}"
        for node in tile_material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None and node.image.source == "TILED":
                single_path = bpy.path.abspath(tile_path(node.image, tile_number))
                if not os.path.exists(single_path):
                    # Trolley c01 has a few faces with UVs on tile 1021, which ships no texture. Blender shows no
                    # texture there either; the 1001 tile is the closest stand-in.
                    print(f"[udim] {tile_material.name}: no file for tile {tile_number}, using 1001", flush=True)
                    single_path = bpy.path.abspath(tile_path(node.image, 1001))
                single = bpy.data.images.load(single_path, check_existing=True)
                single.colorspace_settings.name = node.image.colorspace_settings.name
                node.image = single
        cache[key] = tile_material
    return cache[key]


def uses_tiled_image(material):
    if material is None or material.node_tree is None:
        return False
    return any(node.type == "TEX_IMAGE" and node.image is not None and node.image.source == "TILED"
               for node in material.node_tree.nodes)


def split_udim_tiles(mesh_object, cache):
    """Moves each face to a per-tile material and its UVs into 0-1.

    Blender's glTF exporter does this split itself, in Python, loop by loop. On the million-polygon coilovers and
    robot trolleys (2 to 14 tiles) it ran for over two hours without finishing. Numpy does it in seconds.
    """
    mesh = mesh_object.data
    if mesh.uv_layers.active is None or not any(uses_tiled_image(slot.material) for slot in mesh_object.material_slots):
        return
    polygon_count = len(mesh.polygons)
    loop_count = len(mesh.loops)
    uvs = numpy.empty(loop_count * 2, dtype=numpy.float32)
    mesh.uv_layers.active.data.foreach_get("uv", uvs)
    uvs = uvs.reshape(-1, 2)
    loop_starts = numpy.empty(polygon_count, dtype=numpy.int32)
    loop_totals = numpy.empty(polygon_count, dtype=numpy.int32)
    material_indices = numpy.empty(polygon_count, dtype=numpy.int32)
    mesh.polygons.foreach_get("loop_start", loop_starts)
    mesh.polygons.foreach_get("loop_total", loop_totals)
    mesh.polygons.foreach_get("material_index", material_indices)

    polygon_of_loop = numpy.repeat(numpy.arange(polygon_count), loop_totals)
    uv_sums = numpy.zeros((polygon_count, 2))
    numpy.add.at(uv_sums, polygon_of_loop, uvs)
    tile_offsets = numpy.floor(uv_sums / loop_totals[:, None]).astype(numpy.int32)
    tile_numbers = 1001 + tile_offsets[:, 0] + 10 * tile_offsets[:, 1]

    original_materials = [slot.material for slot in mesh_object.material_slots]
    new_slot_of = {}
    new_indices = material_indices.copy()
    for material_index, tile_number in set(zip(material_indices.tolist(), tile_numbers.tolist())):
        material = original_materials[material_index]
        if not uses_tiled_image(material):
            continue
        if (material_index, tile_number) not in new_slot_of:
            mesh.materials.append(material_for_tile(material, tile_number, cache))
            new_slot_of[(material_index, tile_number)] = len(mesh.materials) - 1
        selected = (material_indices == material_index) & (tile_numbers == tile_number)
        new_indices[selected] = new_slot_of[(material_index, tile_number)]
    mesh.polygons.foreach_set("material_index", new_indices)

    moved_polygons = new_indices != material_indices
    moved_loops = moved_polygons[polygon_of_loop]
    uvs[moved_loops] -= tile_offsets[polygon_of_loop][moved_loops]
    mesh.uv_layers.active.data.foreach_set("uv", uvs.reshape(-1))
    mesh.update()
    print(f"[udim] {mesh_object.name}: {len(new_slot_of)} tile materials, {int(moved_polygons.sum())} polygons moved",
          flush=True)


tile_material_cache = {}
for scene_object in [candidate for candidate in bpy.data.objects if candidate.type == "MESH"]:
    split_udim_tiles(scene_object, tile_material_cache)
log_stage("udim split")

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_image_format="AUTO",
    export_apply=True,
    export_yup=True,
)
log_stage("exported")
