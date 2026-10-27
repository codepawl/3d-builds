"""Contact sheets and compare sheets. Usage (Blender 5): --python preview.py -- <file.glb> [more.glb ...]
Writes blender/previews/<node>-sheet.png per root node and <node>-compare.png where a blockout exists."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
import bpy
import math
import os
import numpy as np
from mathutils import Vector
from blockouts import BLOCKOUTS

ROOT = "<your folder>/viz-canal"
OUT = ROOT + "/blender/previews"
TMP = ROOT + "/blender/previews/tmp"
os.makedirs(TMP, exist_ok=True)
files = sys.argv[sys.argv.index("--") + 1:]
if os.environ.get("PREVIEW_ONLY"):
    only = set(os.environ["PREVIEW_ONLY"].split(","))
else:
    only = None


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_cavity = True
    shading.show_object_outline = False
    shading.background_type = "VIEWPORT"
    shading.background_color = (0.36, 0.43, 0.52)
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w") if not bpy.context.scene.world else bpy.context.scene.world
    bpy.context.scene.world = world
    world.color = (0.36, 0.43, 0.52)
    camera_data = bpy.data.cameras.new("cam")
    camera = bpy.data.objects.new("cam", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def bounds(objects):
    low = Vector((1e9,) * 3)
    high = Vector((-1e9,) * 3)
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            low = Vector((min(low[i], world[i]) for i in range(3)))
            high = Vector((max(high[i], world[i]) for i in range(3)))
    return low, high


def descendants(root):
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def colored(name, rgb):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, 1.0)
    return material


def add_box(name, center, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(material)
    return obj


def add_cylinder(name, center, radius, length, axis, material):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, location=center, vertices=24)
    obj = bpy.context.active_object
    obj.name = name
    if axis == "X":
        obj.rotation_euler[1] = math.radians(90)
    elif axis == "Y":
        obj.rotation_euler[0] = math.radians(90)
    obj.data.materials.append(material)
    return obj


def aim(camera, target, direction, ortho_scale, distance=2000.0):
    direction = Vector(direction).normalized()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.data.clip_start = 0.1
    camera.data.clip_end = 5000
    camera.location = Vector(target) + direction * distance
    look = Vector(target) - camera.location
    camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()


def render(scene, camera, path, width, height):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def load_pixels(path):
    image = bpy.data.images.load(path)
    width, height = image.size
    data = np.array(image.pixels[:]).reshape(height, width, 4)
    bpy.data.images.remove(image)
    return data


def save_array(array, path):
    height, width = array.shape[:2]
    image = bpy.data.images.new("sheet", width, height, alpha=True)
    image.pixels = array.flatten().tolist()
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def grid(images, columns):
    rows = []
    for start in range(0, len(images), columns):
        row = images[start:start + columns]
        while len(row) < columns:
            row.append(np.ones_like(images[0]))
        rows.append(np.concatenate(row, axis=1))
    return np.concatenate(rows[::-1], axis=0)       # image row 0 is the bottom in Blender pixel order


def contact_sheet(scene, camera, root, all_roots):
    for other in all_roots:
        hide = other is not root
        for obj in descendants(other):
            obj.hide_render = hide
    parts = descendants(root)
    low, high = bounds(parts)
    size = high - low
    extent = max(size)
    centre = (low + high) / 2
    figure_xy = (high.x + 1.2 + 0.3, centre.y)
    figure = add_box("figure", (figure_xy[0], figure_xy[1], 0.9), (0.5, 0.3, 1.8), colored("fig", (0.95, 0.35, 0.1)))
    scale = size.length * 1.15
    views = [("front-right", (1, -1.2, 0.8)), ("back-left", (-1, 1.2, 0.7)), ("side", (1, 0, 0.0)),
             ("top", (0, 0, 1))]
    tiles = []
    width, height = 640, 520
    for index, (label, direction) in enumerate(views):
        aim(camera, centre, direction, scale)
        path = f"{TMP}/tile{index}.png"
        render(scene, camera, path, width, height)
        tiles.append(load_pixels(path))
    if extent > 50:
        for index, (label, target_xy, span) in enumerate((("figure", figure_xy, 24.0),
                                                           ("stern", (0, high.y - 0.2 * size.y), 70.0))):
            aim(camera, (target_xy[0], target_xy[1], 6.0), (1, -1.2, 0.8), span)
            path = f"{TMP}/tile_close{index}.png"
            render(scene, camera, path, width, height)
            tiles.append(load_pixels(path))
    save_array(grid(tiles, 2), f"{OUT}/{root.name}-sheet.png")
    bpy.data.objects.remove(figure, do_unlink=True)
    for obj in all_roots:
        for child in descendants(obj):
            child.hide_render = False


def compare_sheet(scene, camera, root, all_roots):
    spec = BLOCKOUTS.get(root.name)
    if not spec:
        return
    for other in all_roots:
        for obj in descendants(other):
            obj.hide_render = other is not root
    low, high = bounds(descendants(root))
    size = high - low
    gap = max(size.z, 1.0) * 0.25 + 1.0
    lift = (high.z - low.z) + gap
    blockout_material = colored("blockout", (0.95, 0.55, 0.2))
    created = []
    for item in spec:
        if item[0] == "box":
            created.append(add_box("bo", (item[1][0], item[1][1], item[1][2] + lift), item[2], blockout_material))
        else:
            created.append(add_cylinder("bo", (item[1][0], item[1][1], item[1][2] + lift), item[2], item[3], item[4],
                                        blockout_material))
    # ruler along the long axis: 1 m segments for small assets, 10 m segments for big ones
    extent = max(size.x, size.y)
    unit = 1.0 if extent < 40 else 10.0
    dark = colored("ruler_a", (0.1, 0.1, 0.12))
    light = colored("ruler_b", (0.95, 0.95, 0.95))
    ruler_z = low.z - gap * 0.6
    for i in range(int(min(extent / unit, 30))):
        y_position = low.y + unit * (i + 0.5)
        created.append(add_box("ruler", (high.x + 0.5, y_position, ruler_z), (0.3 * unit, unit, 0.2 * unit),
                               dark if i % 2 == 0 else light))
    total_height = (high.z - low.z) * 2 + gap * 3
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z - gap * 0.6 + (lift + high.z - low.z) / 2))
    scale = max(size.y * 1.15, total_height * 1.4 * 1.5)
    width, height = 1500, 900
    aim(camera, centre, (1, 0, 0), scale)
    render(scene, camera, f"{TMP}/cmp_side.png", width, height)
    side = load_pixels(f"{TMP}/cmp_side.png")
    # top view: blockout beside the render along -x
    for obj in created:
        obj.location.z -= lift
        obj.location.x += (size.x + gap)
    aim(camera, ((low.x + high.x) / 2 + (size.x + gap) / 2, (low.y + high.y) / 2, 0), (0, 0, 1),
        max(size.y * 1.1 * width / 1000, (size.x * 2 + gap) * 1.3))
    render(scene, camera, f"{TMP}/cmp_top.png", width, 1000)
    top = load_pixels(f"{TMP}/cmp_top.png")
    save_array(np.concatenate([top, side], axis=0), f"{OUT}/{root.name}-compare.png")
    for obj in created:
        bpy.data.objects.remove(obj, do_unlink=True)
    for other in all_roots:
        for obj in descendants(other):
            obj.hide_render = False


for file_name in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{ROOT}/app/public/assets/{file_name}")
    scene, camera = setup_scene()
    all_roots = [obj for obj in scene.objects if obj.parent is None and obj.name != "cam"]
    for root in all_roots:
        if only and root.name not in only:
            continue
        contact_sheet(scene, camera, root, all_roots)
        compare_sheet(scene, camera, root, all_roots)
        print("PREVIEWED", root.name)
