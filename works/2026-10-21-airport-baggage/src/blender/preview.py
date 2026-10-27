"""Contact sheets and compare sheets for the exported GLBs (Workbench, back-face culling on).

Usage: blender --background --factory-startup --python preview.py -- <family>.glb
Writes previews/<family>-contact.png and previews/<node>-compare.png for nodes listed in BLOCKOUTS.
The compare reference is a dimension blockout drawn from blender/refs/<asset>.md (no photos were downloaded).
"""
import math
import os
import sys

import bmesh
import bpy
import numpy
from mathutils import Matrix, Vector

ROOT = "<your folder>/viz-baggage"
OUT = ROOT + "/blender/previews"

# name of the exported node -> blockout pieces drawn from the reference sheet, in asset space.
# ("box", size, center) and ("cyl", radius, length, center, axis) and ("prism", polygon_xz, depth_y, center_y)
BLOCKOUTS = {
    "conv_straight": [("box", (2.0, 0.8, 0.05), (1.0, 0, 0.775)),
                      ("box", (2.0, 0.07, 0.32), (1.0, 0.445, 0.74)), ("box", (2.0, 0.07, 0.32), (1.0, -0.445, 0.74))]
                     + [("box", (0.07, 0.07, 0.58), (x, s * 0.445, 0.29)) for x in (0.2, 1.0, 1.8) for s in (1, -1)],
    "tilt_blue": [("box", (1.15, 0.85, 0.04), (0, 0, 1.0)), ("box", (0.9, 0.6, 0.55), (0, 0, 0.7)),
                  ("box", (1.15, 0.05, 0.1), (0, 0.45, 1.05)), ("box", (1.15, 0.05, 0.1), (0, -0.45, 1.05))],
    "ct_scanner": [("box", (2.1, 1.6, 0.8), (0, 0, 0.4)), ("box", (2.1, 1.6, 0.4), (0, 0, 1.75)),
                   ("box", (2.1, 0.325, 0.75), (0, 0.6375, 1.175)), ("box", (2.1, 0.325, 0.75), (0, -0.6375, 1.175))],
    "uld_ld3_grey": [("prism", [(-1.005, 1.625), (1.005, 1.625), (1.005, 0.45), (0.78, 0.0), (-0.78, 0.0), (-1.005, 0.45)],
                      1.534, 0.0)],
    "baggage_tug_blue": [("box", (1.4, 2.9, 0.5), (0, 0, 0.55)), ("box", (1.2, 0.9, 0.35), (0, -0.9, 0.97)),
                         ("box", (1.3, 1.2, 0.06), (0, 0.5, 1.64)), ("box", (0.08, 0.08, 0.7), (0.6, 0.0, 1.3)),
                         ("box", (0.08, 0.08, 0.7), (-0.6, 0.0, 1.3))]
                        + [("cyl", 0.3, 0.25, (s * 0.58, y, 0.3), "X") for s in (1, -1) for y in (-0.85, 0.85)],
    "belt_loader": [("box", (2.0, 3.4, 0.9), (0, 0.4, 0.85)), ("box", (0.8, 4.6, 0.25), (0, -1.9, 1.45)),
                    ("box", (1.9, 1.0, 1.0), (0, 1.5, 1.7))]
                   + [("cyl", 0.35, 0.3, (s * 0.9, y, 0.35), "X") for s in (1, -1) for y in (-0.6, 1.4)],
}

PALETTE = {"ground": (0.82, 0.86, 0.9, 1)}


def new_material(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    return material


def setup_scene(width, height):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = "PNG"
    world = bpy.data.worlds.new("w")
    world.color = (0.9, 0.93, 0.96)
    scene.world = world
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_backface_culling = True
    shading.show_cavity = True
    shading.show_shadows = True
    shading.background_type = "WORLD"
    scene.display.shading.shadow_intensity = 0.4
    camera = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    camera.data.type = "ORTHO"
    camera.data.clip_end = 500
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def world_bounds(roots):
    low = Vector((1e9, 1e9, 1e9))
    high = Vector((-1e9, -1e9, -1e9))
    stack = list(roots)
    while stack:
        obj = stack.pop()
        stack.extend(obj.children)
        if obj.type == "MESH":
            for corner in obj.bound_box:
                point = obj.matrix_world @ Vector(corner)
                low = Vector(map(min, low, point))
                high = Vector(map(max, high, point))
    return low, high


def aim(camera, azimuth, elevation, target, distance=80):
    direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    camera.location = target + direction * distance
    camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()


def frame(camera, low, high, aspect):
    """Centre the orthographic camera on the bounding box corners as seen from the camera."""
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    corners = [inverse @ Vector((x, y, z)) for x in (low.x, high.x) for y in (low.y, high.y) for z in (low.z, high.z)]
    min_x, max_x = min(c.x for c in corners), max(c.x for c in corners)
    min_y, max_y = min(c.y for c in corners), max(c.y for c in corners)
    camera.location += camera.matrix_world.to_3x3() @ Vector(((min_x + max_x) / 2, (min_y + max_y) / 2, 0))
    camera.data.ortho_scale = max(max_x - min_x, (max_y - min_y) * aspect) * 1.08 + 0.3


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def read_pixels(path):
    image = bpy.data.images.load(path)
    array = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(array)
    shape = (image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)
    return array.reshape(shape)


def write_pixels(array, path):
    height, width = array.shape[:2]
    image = bpy.data.images.new("sheet", width, height, alpha=True)
    image.pixels.foreach_set(array.ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def add_figure(location):
    figure = []
    body = bpy.data.objects.new("figure_body", bpy.data.meshes.new("figure_body"))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.45, 0.28, 1.5), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, 0.75), verts=bm.verts)
    bm.to_mesh(body.data)
    bm.free()
    head = bpy.data.objects.new("figure_head", bpy.data.meshes.new("figure_head"))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.15)
    bmesh.ops.translate(bm, vec=(0, 0, 1.65), verts=bm.verts)
    bm.to_mesh(head.data)
    bm.free()
    paint = new_material("figure", (0.95, 0.45, 0.2, 1))
    for obj in (body, head):
        obj.data.materials.append(paint)
        obj.location = location
        bpy.context.scene.collection.objects.link(obj)
        figure.append(obj)
    return figure


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before and o.parent is None]


def contact_sheet(glb, name_filter=None):
    family = os.path.splitext(os.path.basename(glb))[0]
    if name_filter:
        family += "-" + name_filter.replace(":", "_")
    scene, camera = setup_scene(900, 640)
    roots = import_glb(glb)
    roots.sort(key=lambda o: o.name)
    if name_filter:
        kind, node = name_filter.split(":")
        for root in list(roots):
            if (kind == "only") != (root.name == node):
                for child in root.children_recursive:
                    bpy.data.objects.remove(child)
                bpy.data.objects.remove(root)
                roots.remove(root)
    cursor_x, cursor_y, row_height = 0.0, 0.0, 0.0
    small = all(world_bounds([r])[1].x - world_bounds([r])[0].x < 1.0 for r in roots)
    row_limit = 3.4 if small else 16.0
    placed = []
    for root in roots:
        low, high = world_bounds([root])
        if low.x > high.x:
            continue
        width, depth = high.x - low.x, high.y - low.y
        if cursor_x + width > row_limit:
            cursor_x, cursor_y, row_height = 0.0, cursor_y - row_height - 1.5, 0.0
        root.location += Vector((cursor_x - low.x, cursor_y - high.y, 0))
        bpy.context.view_layer.update()
        placed.append(root)
        if not small or not placed[:-1]:
            add_figure((cursor_x + width + 0.5, cursor_y - depth / 2 - 0.4, 0))
        cursor_x += width + (1.3 if not small else 0.3)
        row_height = max(row_height, depth)
    low, high = world_bounds(bpy.data.objects[:])
    centre = (low + high) / 2
    span = high - low
    shots = [(0.6, 0.62, 1.0), (math.pi + 0.6, 0.62, 1.0), (0.0, math.pi / 2 - 0.001, 1.0), (math.pi / 2 + 0.3, 0.3, 1.0)]
    images = []
    for index, (azimuth, elevation, _) in enumerate(shots):
        aim(camera, azimuth, elevation, centre)
        frame(camera, low, high, 900 / 640)
        path = f"{OUT}/_{family}_{index}.png"
        render(path)
        images.append(read_pixels(path))
        os.remove(path)
    sheet = numpy.concatenate([numpy.concatenate([images[2], images[3]], axis=1),
                               numpy.concatenate([images[0], images[1]], axis=1)], axis=0)
    write_pixels(sheet, f"{OUT}/{family}-contact.png")
    print("CONTACT", family, [r.name for r in placed])


def blockout_objects(pieces):
    paint = new_material("blockout", (0.55, 0.6, 0.66, 1))
    created = []
    for piece in pieces:
        bm = bmesh.new()
        if piece[0] == "box":
            bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=Vector(piece[1]), verts=bm.verts)
            bmesh.ops.translate(bm, vec=Vector(piece[2]), verts=bm.verts)
        elif piece[0] == "cyl":
            bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=piece[1], radius2=piece[1], depth=piece[2])
            axis_rotation = {"X": Matrix.Rotation(math.pi / 2, 4, "Y"), "Y": Matrix.Rotation(math.pi / 2, 4, "X"), "Z": Matrix()}[piece[4]]
            bmesh.ops.transform(bm, matrix=Matrix.Translation(piece[3]) @ axis_rotation, verts=bm.verts)
        else:
            polygon, depth, centre_y = piece[1], piece[2], piece[3]
            front = [bm.verts.new((x, centre_y - depth / 2, z)) for x, z in polygon]
            back = [bm.verts.new((x, centre_y + depth / 2, z)) for x, z in polygon]
            bm.faces.new(front)
            bm.faces.new(back[::-1])
            count = len(polygon)
            for i in range(count):
                bm.faces.new((front[i], front[(i + 1) % count], back[(i + 1) % count], back[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh = bpy.data.meshes.new("blockout")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(paint)
        obj = bpy.data.objects.new("blockout", mesh)
        bpy.context.scene.collection.objects.link(obj)
        created.append(obj)
    return created


def add_ruler(origin):
    paint_a = new_material("ruler_a", (0.9, 0.2, 0.2, 1))
    paint_b = new_material("ruler_b", (1, 1, 1, 1))
    created = []
    for index in range(4):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(0.25, 0.05, 0.05), verts=bm.verts)
        mesh = bpy.data.meshes.new("ruler")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(paint_a if index % 2 == 0 else paint_b)
        obj = bpy.data.objects.new("ruler", mesh)
        obj.location = origin + Vector((0.125 + 0.25 * index, 0, 0))
        bpy.context.scene.collection.objects.link(obj)
        created.append(obj)
    return created


def compare_sheet(glb, node_name, pieces):
    scene, camera = setup_scene(800, 600)
    roots = import_glb(glb)
    target = next((r for r in roots if r.name == node_name), None)
    if target is None:
        return
    for root in roots:
        if root is not target:
            root.hide_render = True
            for child in root.children_recursive:
                child.hide_render = True
    low, high = world_bounds([target])
    blockout = blockout_objects(pieces)
    low = Vector(map(min, low, world_bounds(blockout)[0]))
    high = Vector(map(max, high, world_bounds(blockout)[1]))
    ruler = add_ruler(Vector((low.x, low.y - 0.5, low.z - 0.2)))
    centre = (low + high) / 2
    span = (high - low) + Vector((0, 1.4, 0.6))
    rows = []
    for view, (azimuth, elevation, fit) in (("side", (0.0, 0.0, span.z)), ("top", (0.0, math.pi / 2 - 0.001, span.y))):
        aim(camera, azimuth, elevation, centre)
        camera.data.ortho_scale = max(span.x * 1.1, fit * 1.1 * 800 / 600)
        pair = []
        for show_model in (False, True):
            for obj in blockout:
                obj.hide_render = show_model
            target.hide_render = not show_model
            for child in target.children_recursive:
                child.hide_render = not show_model
            path = f"{OUT}/_{node_name}_{view}_{show_model}.png"
            render(path)
            pair.append(read_pixels(path))
            os.remove(path)
        rows.append(numpy.concatenate(pair, axis=1))
    sheet = numpy.concatenate([rows[1], rows[0]], axis=0)
    write_pixels(sheet, f"{OUT}/{node_name}-compare.png")
    print("COMPARE", node_name, "span", tuple(round(v, 2) for v in (high - low)))


def main():
    glb = sys.argv[sys.argv.index("--") + 1]
    path = f"{ROOT}/app/public/assets/{glb}"
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mode = sys.argv[sys.argv.index("--") + 2] if len(sys.argv) > sys.argv.index("--") + 2 else "all"
    name_filter = sys.argv[sys.argv.index("--") + 3] if len(sys.argv) > sys.argv.index("--") + 3 else None
    if mode in ("all", "contact"):
        contact_sheet(path, name_filter)
        bpy.ops.wm.read_factory_settings(use_empty=True)
    if mode in ("all", "compare"):
        for node_name, pieces in BLOCKOUTS.items():
            bpy.ops.wm.read_factory_settings(use_empty=True)
            compare_sheet(path, node_name, pieces)


main()
