"""Contact sheet of one GLB: every top-level node laid out on a grid, rendered from three angles
(front-left quarter, top-down at the app's tilt, low back-right) with back-face culling on, and
stitched into one PNG. Prints each node's size in metres for the scale check.

Usage: blender --background --factory-startup --python preview.py -- <glb> <png> [node name prefix]
"""
import math
import sys
from pathlib import Path

import bpy
import numpy
from mathutils import Vector

arguments = sys.argv[sys.argv.index("--") + 1:]
glb_path, png_path = arguments[:2]
only_prefix = tuple(arguments[2].split(",")) if len(arguments) > 2 else ("",)
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=glb_path)
bpy.context.view_layer.update()

for action in bpy.data.actions:
    print(f"clip {action.name}: frames {action.frame_range[0]:.0f}-{action.frame_range[1]:.0f}")
roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
# The importer adds "Icosphere" bone-display shapes for armatures; they are not in the file.
for obj in [obj for obj in roots if not obj.name.startswith(only_prefix) or obj.name.startswith("Icosphere")]:
    for child in [obj] + list(obj.children_recursive):
        bpy.data.objects.remove(child, do_unlink=True)
roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]


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


# Lay the nodes out on a grid, row by row, each cell as wide as the largest node.
measured = []
for obj in roots:
    corners = bounds(obj)
    if corners:
        low, high = extent(corners)
        measured.append((obj, low, high))
        size = high - low
        print(f"size {obj.name}: width {size.x:.2f} m, length {size.y:.2f} m, height {size.z:.2f} m, base {low.z:.2f}")
# Shelf packing: largest first, rows wrap at about the square root of the total footprint.
measured.sort(key=lambda entry: -(entry[2].y - entry[1].y))
gap = 1.0
row_limit = math.sqrt(sum((high.x - low.x + gap) * (high.y - low.y + gap) for _, low, high in measured)) * 1.2
cursor_x = 0.0
row_top = 0.0
row_depth = 0.0
for obj, low, high in measured:
    width = high.x - low.x
    depth = high.y - low.y
    if cursor_x > 0 and cursor_x + width > row_limit:
        cursor_x = 0.0
        row_top -= row_depth + gap
        row_depth = 0.0
    obj.location.x += cursor_x - low.x
    obj.location.y += row_top - high.y
    cursor_x += width + gap
    row_depth = max(row_depth, depth)
bpy.context.view_layer.update()

everything = [corner for obj, _, _ in measured for corner in bounds(obj)]
low, high = extent(everything)
middle = (low + high) / 2
radius = max(high.x - low.x, high.y - low.y, high.z - low.z) * 0.62

floor_mesh = bpy.data.meshes.new("floor")
floor_mesh.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
floor = bpy.data.objects.new("floor", floor_mesh)
floor.scale = (radius * 4, radius * 4, 1)
floor.location = (middle.x, middle.y, low.z - 0.01)
bpy.context.scene.collection.objects.link(floor)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_cavity = True
shading.show_shadows = False  # stencil shadows streak off open skin patches
shading.show_backface_culling = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 900

camera_data = bpy.data.cameras.new("preview")
camera_data.type = "ORTHO"
camera_data.ortho_scale = radius * 2.15
camera = bpy.data.objects.new("preview", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

views = {
    "quarter": Vector((-0.55, -1.0, 0.75)),
    "top": Vector((0.25, -0.45, 1.0)),
    "back": Vector((0.9, 0.8, 0.3)),
}
output = Path(png_path)
tiles = []
for label, direction in views.items():
    direction = direction.normalized()
    camera.location = middle + direction * radius * 4
    camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    tile_path = output.with_name(f"{output.stem}_{label}.png")
    scene.render.filepath = str(tile_path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(tile_path))
    pixels = numpy.array(image.pixels[:], dtype=numpy.float32).reshape(image.size[1], image.size[0], 4)
    tiles.append(pixels)
    bpy.data.images.remove(image)
    tile_path.unlink()

# The three views side by side, quarter on the left.
sheet_pixels = numpy.concatenate(tiles, axis=1)
height, width = sheet_pixels.shape[:2]
sheet = bpy.data.images.new("sheet", width=width, height=height, alpha=True)
sheet.pixels = sheet_pixels.ravel()
sheet.filepath_raw = str(output)
sheet.file_format = "PNG"
sheet.save()
print(f"rendered {output} roots={[obj.name for obj in roots]}")
