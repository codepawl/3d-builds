"""Reference-versus-render sheets for the main assets: the reference photos on the left, a side and a
three-quarter render of the matching node(s) on the right, written to previews/<asset>-compare.png.
Usage: blender --background --factory-startup --python compare.py -- [asset names]"""
import sys
from pathlib import Path

import bpy
import numpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "app" / "public" / "assets"
REFS = HERE / "refs"
OUT = HERE / "previews"
HEIGHT = 900

# asset -> (glb, nodes to keep, reference images, side direction in Blender space)
SHEETS = {
    "booster": ("rocket.glb", ["booster_a"], ["booster/booster-03.jpg", "booster/booster-02.jpg"], (0, -1, 0.05)),
    "ship": ("rocket.glb", ["ship_cargo"], ["ship/ship-03.jpg", "ship/ship-01.jpg"], (1, 0, 0.05)),
    "tower": ("pad.glb", ["tower"], ["tower/tower-03.jpg", "tower/tower-01.jpg"], (1, 0, 0.05)),
    "launch_mount": ("pad.glb", ["launch_mount"], ["launch_mount/launch_mount-01.jpg", "tower/tower-02.jpg"], (0, -1, 0.1)),
    "tank_farm": ("tanks.glb", ["tank_vertical_lox", "tank_sphere"], ["tank_farm/tank_farm-01.jpg", "tank_farm/tank_farm-04.jpg"], (0, -1, 0.1)),
    "high_bay": ("yard.glb", ["high_bay"], ["high_bay/high_bay-01.jpg", "high_bay/high_bay-02.jpg"], (0.7, -1, 0.05)),
    "spmt": ("vehicles.glb", ["spmt_short"], ["spmt/spmt-01.png", "spmt/spmt-02.jpg"], (1, 0, 0.12)),
    "crawler_crane": ("vehicles.glb", ["crawler_crane"], ["crawler_crane/crawler_crane-02.jpg", "crawler_crane/crawler_crane-01.jpg"], (1, 0, 0.05)),
    "recovery_boat": ("marine.glb", ["recovery_boat"], ["recovery_boat/recovery_boat-01.jpg", "recovery_boat/recovery_boat-02.jpg"], (1, 0.25, 0.08)),
    "weather_tower": ("props.glb", ["weather_tower"], ["weather_tower/weather_tower-01.jpg"], (1, -0.3, 0.05)),
}


def load_pixels(path):
    image = bpy.data.images.load(str(path))
    width, height = image.size
    pixels = numpy.array(image.pixels[:], dtype=numpy.float32).reshape(height, width, image.channels)
    bpy.data.images.remove(image)
    if pixels.shape[2] == 3:
        pixels = numpy.concatenate([pixels, numpy.ones((height, width, 1), dtype=numpy.float32)], axis=2)
    return pixels


def fit_height(pixels, height):
    rows = numpy.linspace(0, pixels.shape[0] - 1, height).astype(int)
    width = max(1, int(pixels.shape[1] * height / pixels.shape[0]))
    columns = numpy.linspace(0, pixels.shape[1] - 1, width).astype(int)
    return pixels[rows][:, columns]


def scene_setup():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_cavity = True
    shading.show_backface_culling = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = HEIGHT
    camera_data = bpy.data.cameras.new("compare")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("compare", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def render(scene, camera, direction, low, high, path):
    middle = (low + high) / 2
    size = high - low
    camera.data.ortho_scale = max(size.x, size.y, size.z) * 1.15
    direction = Vector(direction).normalized()
    camera.location = middle + direction * size.length * 3
    camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    camera.data.clip_end = size.length * 10
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    pixels = load_pixels(path)
    path.unlink()
    return pixels


def sheet(asset, glb, keep, references, side):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / glb))
    for obj in [obj for obj in bpy.context.scene.objects if obj.parent is None and obj.name not in keep]:
        for child in [obj] + list(obj.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for obj in bpy.context.scene.objects if obj.type == "MESH" for corner in obj.bound_box]
    low = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    high = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    scene, camera = scene_setup()
    tiles = [fit_height(load_pixels(REFS / reference), HEIGHT) for reference in references]
    tiles.append(render(scene, camera, side, low, high, OUT / f"_{asset}_side.png"))
    tiles.append(render(scene, camera, (-0.7, -1.0, 0.45), low, high, OUT / f"_{asset}_quarter.png"))
    pixels = numpy.concatenate(tiles, axis=1)
    image = bpy.data.images.new(f"{asset}_sheet", width=pixels.shape[1], height=pixels.shape[0], alpha=True)
    image.pixels = pixels.ravel()
    image.filepath_raw = str(OUT / f"{asset}-compare.png")
    image.file_format = "PNG"
    image.save()
    size = high - low
    print(f"rendered {asset}-compare.png: width {size.x:.1f} m, length {size.y:.1f} m, height {size.z:.1f} m")


arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT.mkdir(exist_ok=True)
for name in arguments or SHEETS:
    sheet(name, *SHEETS[name])
