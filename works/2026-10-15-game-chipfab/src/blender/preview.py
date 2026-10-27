"""Render a Workbench contact sheet for each GLB: its top-level nodes laid out on a labelled grid,
seen from three angles (front-left iso, back-right iso, top), stacked into one PNG with back-face
culling on so flipped normals and holes show as missing faces.

Usage: blender --background --factory-startup --python preview.py -- [glb ...]
With no GLB given, every GLB in app/public/assets is rendered. Sheets go to blender/previews/.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "app" / "public" / "assets"
PREVIEWS = HERE / "previews"
VIEWS = {
    "front-left": Vector((-0.6, -1.0, 0.75)),
    "back-right": Vector((0.7, 1.0, 0.65)),
    "top": Vector((0.0, -0.08, 1.0)),
}
TILE_WIDTH = 1600


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.armatures, bpy.data.actions, bpy.data.cameras):
        for block in list(collection):
            collection.remove(block)


def bounds(obj):
    corners = []
    for child in [obj] + list(obj.children_recursive):
        if child.type == "MESH":
            corners += [child.matrix_world @ Vector(corner) for corner in child.bound_box]
    return corners


def extent(corners):
    low = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    high = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return low, high


def lay_out(roots):
    """Place roots on a grid, each scaled to fill its cell so small parts stay readable, with
    its name and real size (width x height x depth, metres) written on the floor in front."""
    cell = 10.0
    columns = max(1, math.ceil(math.sqrt(len(roots))))
    for index, obj in enumerate(roots):
        low, high = extent(bounds(obj))
        width, depth, height = high.x - low.x, high.y - low.y, high.z - low.z
        factor = cell * 0.8 / max(width, depth, height)
        obj.scale = obj.scale * factor
        bpy.context.view_layer.update()
        low, high = extent(bounds(obj))
        column = index % columns
        row = index // columns
        center = (low + high) / 2
        obj.location.x += column * cell - center.x
        obj.location.y += -row * cell - center.y
        obj.location.z -= low.z
        label_data = bpy.data.curves.new(f"label_{obj.name}", "FONT")
        label_data.body = f"{obj.name}  {width:.2f} x {height:.2f} x {depth:.2f} m"
        label_data.size = cell * 0.04
        label_data.align_x = "CENTER"
        label = bpy.data.objects.new(f"label_{obj.name}", label_data)
        bpy.context.scene.collection.objects.link(label)
        label.location = (column * cell, -row * cell - cell * 0.42, 0.01)


def render_view(direction, corners, size, path):
    """Frame every corner tightly: project them on the camera's right and up axes and size
    the orthographic frame and image height from that footprint."""
    scene = bpy.context.scene
    direction = direction.normalized()
    rotation = (-direction).to_track_quat("-Z", "Y")
    right = rotation @ Vector((1, 0, 0))
    up = rotation @ Vector((0, 1, 0))
    across = [corner.dot(right) for corner in corners]
    upward = [corner.dot(up) for corner in corners]
    frame_width = (max(across) - min(across)) * 1.06
    frame_height = (max(upward) - min(upward)) * 1.06
    center = right * (max(across) + min(across)) / 2 + up * (max(upward) + min(upward)) / 2
    depth_middle = sum(corner.dot(direction) for corner in corners) / len(corners)
    camera_data = bpy.data.cameras.new("preview")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(frame_width, frame_height)
    camera_data.clip_end = size * 20
    camera = bpy.data.objects.new("preview", camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + direction * (depth_middle + size * 4)
    camera.rotation_euler = rotation.to_euler()
    scene.camera = camera
    scene.render.resolution_x = TILE_WIDTH
    scene.render.resolution_y = max(200, int(TILE_WIDTH * min(1.2, frame_height / frame_width)))
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)


def stack(paths, target):
    """Stack the view renders vertically into one sheet."""
    images = [bpy.data.images.load(str(path)) for path in paths]
    width = images[0].size[0]
    height = sum(image.size[1] for image in images)
    pixels = numpy.zeros((height, width, 4), dtype=numpy.float32)
    top = height
    for image in images:
        image_height = image.size[1]
        data = numpy.array(image.pixels[:], dtype=numpy.float32).reshape(image_height, width, 4)
        pixels[top - image_height:top] = data
        top -= image_height
    sheet = bpy.data.images.new(target.stem, width, height, alpha=False)
    sheet.pixels = pixels.ravel()
    sheet.filepath_raw = str(target)
    sheet.file_format = "PNG"
    sheet.save()
    for image in images:
        bpy.data.images.remove(image)
    bpy.data.images.remove(sheet)
    for path in paths:
        path.unlink()


def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_cavity = True
    shading.show_shadows = True
    shading.show_backface_culling = True
    shading.show_object_outline = True
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.world = scene.world or bpy.data.worlds.new("preview")
    scene.world.color = (0.86, 0.89, 0.94)


def preview(glb_path):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("Icosphere"):
            # bone display shapes the importer adds for armatures, not part of the asset
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.scene.frame_set(0)
    roots = sorted((obj for obj in bpy.context.scene.objects if obj.parent is None and bounds(obj)), key=lambda obj: obj.name)
    lay_out(roots)
    bpy.context.view_layer.update()
    for mat in bpy.data.materials:
        # Workbench draws the viewport colour, which the glTF importer leaves grey.
        shader = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if shader:
            # diffuse_color is display space; the shader input is linear.
            red, green, blue, _ = shader.inputs["Base Color"].default_value
            alpha = shader.inputs["Alpha"].default_value
            mat.diffuse_color = (red ** (1 / 2.2), green ** (1 / 2.2), blue ** (1 / 2.2), alpha)
    corners = [corner for obj in roots for corner in bounds(obj)]
    corners += [label.matrix_world @ Vector(corner) for label in bpy.context.scene.objects if label.type == "FONT" for corner in label.bound_box]
    low, high = extent(corners)
    size = max(high.x - low.x, high.y - low.y, high.z - low.z)
    PREVIEWS.mkdir(exist_ok=True)
    paths = []
    for view_name, direction in VIEWS.items():
        path = PREVIEWS / f"_{glb_path.stem}_{view_name}.png"
        render_view(direction, corners, size, path)
        paths.append(path)
    target = PREVIEWS / f"{glb_path.stem}.png"
    stack(paths, target)
    print(f"rendered {target} roots={len(roots)}")


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    glbs = [Path(argument) for argument in arguments] or sorted(ASSETS.glob("*.glb"))
    configure_render()
    for glb_path in glbs:
        preview(glb_path)


main()
