"""Render a contact sheet per GLB and reference-versus-render compare sheets.

Run: blender --background --factory-startup --python blender/preview.py -- <project root> [glb name ...]
Writes blender/previews/<asset>.png (four angles) and blender/previews/<asset>-compare.png.
Back-face culling is on for every material so flipped normals show as holes.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ARGUMENTS = sys.argv[sys.argv.index("--") + 1:]
ROOT = ARGUMENTS[0]
ONLY = set(ARGUMENTS[1:])
ASSETS = os.path.join(ROOT, "app", "public", "assets")
REFS = os.path.join(ROOT, "blender", "refs")
OUT = os.path.join(ROOT, "blender", "previews")
TEMP = os.path.join(OUT, "_frames")
WIDTH, HEIGHT = 640, 420
DEFAULT_ANGLES = [(35, 22), (125, 18), (215, 30), (300, 60)]

COMPARES = [
    # (sheet name, glb, focus root, [(reference image, crop box as fractions or None, azimuth, elevation, lens)])
    ("ford49", "vehicles", "ford49_sedan", [("ford49/custom_tudor_sicnag_21632372983.jpg", None, -38, 12, 50), ("ford49/tudor_obrien.jpg", None, 0, 10, 50)]),
    ("pickup", "vehicles", "pickup_generic", [("pickup/f100_1953_deluxe_sicnag.jpg", None, 42, 10, 50), ("pickup/f100_1953_bobpb.jpg", (0.0, 0.0, 1.0, 1.0), 150, 12, 50)]),
    ("police_car", "vehicles", "police_car_generic", [("police_car/detroit_police_1955_pd.jpg", None, 100, 6, 50)]),
    ("main_street", "main_street", "main_street", [("main_street/sanborn_1908_sheet3.jpg", (0.33, 0.04, 0.96, 0.40), 0, 90, 0)]),
    ("bank_1923", "main_street", "bank_1923", [("main_street/plainfield_1923.jpg", None, 62, 6, 40)]),
]


def clear():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            collection.remove(block)


def setup_scene():
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 16
    world = bpy.data.worlds.get("preview") or bpy.data.worlds.new("preview")
    world.use_nodes = True  # deprecated in 6.0, still needed in 5.2
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.006, 0.006, 0.007, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world
    for name, energy, colour, rotation in (("key", 3.2, (1.0, 0.8, 0.6), (50, 0, -35)), ("fill", 0.5, (0.6, 0.7, 1.0), (60, 0, 150))):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        light.color = colour
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = [math.radians(value) for value in rotation]
        scene.collection.objects.link(obj)
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def import_glb(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, f"{name}.glb"))
    for material in bpy.data.materials:
        material.use_backface_culling = True


def descendants(root_name):
    root = bpy.data.objects.get(root_name)
    keep = set()
    stack = [root] if root else []
    while stack:
        current = stack.pop()
        keep.add(current.name)
        stack.extend(current.children)
    return keep


def focus(root_name):
    keep = descendants(root_name) if root_name else None
    for obj in bpy.context.scene.objects:
        if obj.type in ("MESH", "EMPTY"):
            obj.hide_render = keep is not None and obj.name not in keep and obj.name != "preview_floor"
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render and obj.name != "preview_floor"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector([min(corner[i] for corner in corners) for i in range(3)])
    high = Vector([max(corner[i] for corner in corners) for i in range(3)])
    return low, high


def add_floor(low, high):
    size = max((high - low).length, 1.0) * 1.5
    mesh = bpy.data.meshes.new("preview_floor")
    center = (low + high) / 2
    mesh.from_pydata([(center.x - size, center.y - size, low.z - 0.01), (center.x + size, center.y - size, low.z - 0.01), (center.x + size, center.y + size, low.z - 0.01), (center.x - size, center.y + size, low.z - 0.01)], [], [(0, 1, 2, 3)])
    material = bpy.data.materials.new("preview_floor")
    material.use_nodes = True
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1)
    mesh.materials.append(material)
    floor = bpy.data.objects.new("preview_floor", mesh)
    bpy.context.scene.collection.objects.link(floor)


def aim(camera, low, high, azimuth, elevation, lens):
    center = (low + high) / 2
    radius = max((high - low).length / 2, 0.5)
    direction = Vector((math.cos(math.radians(azimuth)) * math.cos(math.radians(elevation)), math.sin(math.radians(azimuth)) * math.cos(math.radians(elevation)), math.sin(math.radians(elevation))))
    if lens == 0:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = max(high.x - low.x, (high.y - low.y) * WIDTH / HEIGHT) * 1.05
        distance = radius * 3
    else:
        camera.data.type = "PERSP"
        camera.data.lens = lens
        field = 2 * math.atan(18 / lens)
        distance = radius / math.sin(field / 2) * 1.05
    camera.location = center + direction * distance
    camera.rotation_euler = (0.0, 0.0, 0.0) if elevation >= 89 else (-direction).to_track_quat("-Z", "Y").to_euler()
    camera.data.clip_end = distance * 4
    camera.data.clip_start = max(distance / 2000, 0.01)


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(path)
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)
    return pixels


def load_reference(relative, crop, height):
    image = bpy.data.images.load(os.path.join(REFS, relative))
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)
    if crop:
        left, top, right, bottom = crop
        rows, columns = pixels.shape[:2]
        pixels = pixels[int((1 - bottom) * rows):int((1 - top) * rows), int(left * columns):int(right * columns)]
    rows, columns = pixels.shape[:2]
    width = int(columns * height / rows)
    row_index = (np.arange(height) * rows / height).astype(int)
    column_index = (np.arange(width) * columns / width).astype(int)
    return pixels[row_index][:, column_index]


def save(pixels, path):
    rows, columns = pixels.shape[:2]
    image = bpy.data.images.new("sheet", columns, rows, alpha=True)
    image.pixels.foreach_set(np.ascontiguousarray(pixels).ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def contact_sheet(name):
    clear()
    camera = setup_scene()
    import_glb(name)
    low, high = focus(None)
    if name != "terrain":
        add_floor(low, high)
    frames = []
    for index, (azimuth, elevation) in enumerate(DEFAULT_ANGLES):
        aim(camera, low, high, azimuth, elevation, 50)
        frames.append(render(os.path.join(TEMP, f"{name}_{index}.png")))
    top = np.concatenate([frames[2], frames[3]], axis=1)
    bottom = np.concatenate([frames[0], frames[1]], axis=1)
    save(np.concatenate([top, bottom], axis=0), os.path.join(OUT, f"{name}.png"))
    print("contact", name, flush=True)


def compare_sheet(sheet_name, glb, root_name, views):
    clear()
    camera = setup_scene()
    import_glb(glb)
    low, high = focus(root_name)
    add_floor(low, high)
    rows = []
    for relative, crop, azimuth, elevation, lens in views:
        aim(camera, low, high, azimuth, elevation, lens)
        frame = render(os.path.join(TEMP, f"{sheet_name}_compare.png"))
        reference = load_reference(relative, crop, HEIGHT)
        row = np.concatenate([reference, frame], axis=1)
        rows.append(row)
    width = max(row.shape[1] for row in rows)
    padded = [np.pad(row, ((0, 0), (0, width - row.shape[1]), (0, 0))) for row in rows]
    save(np.concatenate(padded[::-1], axis=0), os.path.join(OUT, f"{sheet_name}-compare.png"))
    print("compare", sheet_name, flush=True)


def main():
    os.makedirs(TEMP, exist_ok=True)
    names = sorted(file[:-4] for file in os.listdir(ASSETS) if file.endswith(".glb"))
    for name in names:
        if not ONLY or name in ONLY:
            contact_sheet(name)
    for sheet_name, glb, root_name, views in COMPARES:
        if not ONLY or glb in ONLY or sheet_name in ONLY:
            compare_sheet(sheet_name, glb, root_name, views)


main()
