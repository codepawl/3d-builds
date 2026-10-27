"""Mesh helpers for the Plainfield asset pack: plain vertex/face generators, no bpy.ops.

Every part is created as its own object carrying one material name; `finish` assigns
materials and only then joins parts, so face material indices are never reset.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

MATERIALS = {
    # name: (base colour, roughness, metallic, emission colour, emission strength)
    "brick_dark": ((0.055, 0.045, 0.043), 0.9, 0.0, None, 0.0),
    "stone_dark": ((0.11, 0.107, 0.1), 0.85, 0.0, None, 0.0),
    "frame_dark": ((0.06, 0.06, 0.062), 0.88, 0.0, None, 0.0),
    "roof_dark": ((0.03, 0.03, 0.032), 0.8, 0.0, None, 0.0),
    "trim_dark": ((0.11, 0.11, 0.115), 0.7, 0.0, None, 0.0),
    "glass_dark": ((0.006, 0.0065, 0.008), 0.15, 0.0, None, 0.0),
    "window_warm": ((0.9, 0.55, 0.25), 0.5, 0.0, (1.0, 0.58, 0.26), 4.0),
    "lamp_warm": ((1.0, 0.9, 0.75), 0.4, 0.0, (1.0, 0.86, 0.66), 12.0),
    "red_glow": ((0.88, 0.15, 0.17), 0.5, 0.0, (0.88, 0.15, 0.17), 6.0),
    "police_blue": ((0.23, 0.44, 0.85), 0.4, 0.0, (0.23, 0.44, 0.85), 8.0),
    "car_maroon": ((0.075, 0.018, 0.022), 0.35, 0.1, None, 0.0),
    "car_dark": ((0.035, 0.037, 0.04), 0.4, 0.1, None, 0.0),
    "car_black": ((0.012, 0.012, 0.014), 0.35, 0.1, None, 0.0),
    "car_light": ((0.2, 0.2, 0.21), 0.4, 0.1, None, 0.0),
    "chrome_dim": ((0.3, 0.3, 0.31), 0.35, 0.0, None, 0.0),
    "rubber": ((0.015, 0.015, 0.015), 0.95, 0.0, None, 0.0),
    "lamp_off": ((0.5, 0.48, 0.42), 0.2, 0.0, None, 0.0),
    "tail_lamp": ((0.25, 0.02, 0.02), 0.3, 0.0, None, 0.0),
    "wood_dark": ((0.05, 0.042, 0.035), 0.9, 0.0, None, 0.0),
    "bark": ((0.045, 0.043, 0.042), 0.95, 0.0, None, 0.0),
    "metal_dark": ((0.08, 0.08, 0.085), 0.5, 0.8, None, 0.0),
    "ground_dark": ((0.022, 0.022, 0.024), 0.95, 0.0, None, 0.0),
    "road_dark": ((0.035, 0.035, 0.037), 0.9, 0.0, None, 0.0),
    "sidewalk": ((0.055, 0.055, 0.058), 0.9, 0.0, None, 0.0),
    "terrain_dark": ((0.03, 0.03, 0.032), 0.95, 0.0, None, 0.0),
    "silhouette": ((0.5, 0.5, 0.52), 0.9, 0.0, None, 0.0),
}


def material(name):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    base, roughness, metallic, emission, strength = MATERIALS[name]
    created = bpy.data.materials.new(name)
    created.use_nodes = True
    shader = created.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*base, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = strength
    created.use_backface_culling = True
    created.diffuse_color = (*base, 1.0)
    return created


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            collection.remove(block)


class Part:
    """Geometry in local coordinates plus one material name."""

    def __init__(self, vertices, faces, material_name):
        self.vertices = [Vector(vertex) for vertex in vertices]
        self.faces = faces
        self.material_name = material_name

    def transformed(self, matrix):
        return Part([matrix @ vertex for vertex in self.vertices], self.faces, self.material_name)


def box(x0, y0, z0, x1, y1, z1, material_name):
    vertices = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return Part(vertices, faces, material_name)


def centered_box(center, size, material_name):
    (cx, cy, cz), (sx, sy, sz) = center, size
    return box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, material_name)


def prism_xz(profile, y0, y1, material_name):
    """Extrude a closed (x, z) profile along y."""
    count = len(profile)
    vertices = [(x, y0, z) for x, z in profile] + [(x, y1, z) for x, z in profile]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces[0], faces[1] = tuple(range(count)), tuple(reversed(range(count, 2 * count)))
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, following + count, index + count))
    return Part(vertices, faces, material_name)


def prism_xy(profile, z0, z1, material_name):
    """Extrude a closed (x, y) footprint along z."""
    count = len(profile)
    vertices = [(x, y, z0) for x, y in profile] + [(x, y, z1) for x, y in profile]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, following + count, index + count))
    return Part(vertices, faces, material_name)


def frustum(start, end, radius_start, radius_end, sides, material_name):
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    helper = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    side_a = axis.cross(helper).normalized()
    side_b = axis.cross(side_a).normalized()
    vertices = []
    for center, radius in ((start, radius_start), (end, radius_end)):
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            vertices.append(center + (side_a * math.cos(angle) + side_b * math.sin(angle)) * radius)
    faces = [tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))]
    for index in range(sides):
        following = (index + 1) % sides
        faces.append((index, following, following + sides, index + sides))
    return Part(vertices, faces, material_name)


def cylinder(center, radius, depth, sides, axis, material_name):
    offset = {"x": Vector((depth / 2, 0, 0)), "y": Vector((0, depth / 2, 0)), "z": Vector((0, 0, depth / 2))}[axis]
    return frustum(Vector(center) - offset, Vector(center) + offset, radius, radius, sides, material_name)


def sphere(center, radius, rings, segments, material_name):
    center = Vector(center)
    vertices = [center + Vector((0, 0, -radius))]
    for ring in range(1, rings):
        polar = math.pi * ring / rings - math.pi / 2
        for segment in range(segments):
            azimuth = 2 * math.pi * segment / segments
            vertices.append(center + Vector((math.cos(polar) * math.cos(azimuth), math.cos(polar) * math.sin(azimuth), math.sin(polar))) * radius)
    vertices.append(center + Vector((0, 0, radius)))
    top = len(vertices) - 1
    faces = []
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.append((0, 1 + following, 1 + segment))
    for ring in range(rings - 2):
        base = 1 + ring * segments
        for segment in range(segments):
            following = (segment + 1) % segments
            faces.append((base + segment, base + following, base + segments + following, base + segments + segment))
    last = 1 + (rings - 2) * segments
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.append((last + segment, last + following, top))
    return Part(vertices, faces, material_name)


def loft(rings, material_name, cap=True):
    """Connect rings (lists of equal-length point lists) into a closed tube."""
    count = len(rings[0])
    vertices = [point for ring in rings for point in ring]
    faces = []
    for ring_index in range(len(rings) - 1):
        base = ring_index * count
        for index in range(count):
            following = (index + 1) % count
            faces.append((base + index, base + following, base + count + following, base + count + index))
    if cap:
        faces.append(tuple(reversed(range(count))))
        last = (len(rings) - 1) * count
        faces.append(tuple(range(last, last + count)))
    return Part(vertices, faces, material_name)


def body_ring(x, z_bottom, z_top, half_width, roundness=0.25, top_inset=0.85, bottom_inset=0.9):
    chamfer = roundness * (z_top - z_bottom)
    profile = [
        (-half_width * bottom_inset, z_bottom), (-half_width, z_bottom + chamfer), (-half_width, z_top - chamfer), (-half_width * top_inset, z_top),
        (half_width * top_inset, z_top), (half_width, z_top - chamfer), (half_width, z_bottom + chamfer), (half_width * bottom_inset, z_bottom),
    ]
    return [(x, y, z) for y, z in profile]


def rotation_z(degrees):
    return Matrix.Rotation(math.radians(degrees), 4, "Z")


def translation(offset):
    return Matrix.Translation(Vector(offset))


def finish(name, parts, location=(0, 0, 0), rotation_degrees=0.0, parent=None, bevel=0.0):
    """Create one object per material, assign that material, then join into `name`."""
    pieces = []
    for part in parts:
        mesh = bpy.data.meshes.new(f"{name}_piece")
        mesh.from_pydata([tuple(vertex) for vertex in part.vertices], [], part.faces)
        mesh.update()
        mesh.materials.append(material(part.material_name))
        piece = bpy.data.objects.new(f"{name}_piece", mesh)
        bpy.context.scene.collection.objects.link(piece)
        pieces.append(piece)
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for piece in pieces:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    if len(pieces) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    mesh_editor = bmesh.new()
    mesh_editor.from_mesh(joined.data)
    bmesh.ops.remove_doubles(mesh_editor, verts=mesh_editor.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(mesh_editor, faces=mesh_editor.faces)
    mesh_editor.to_mesh(joined.data)
    mesh_editor.free()
    joined.location = location
    joined.rotation_euler = (0, 0, math.radians(rotation_degrees))
    if parent is not None:
        joined.parent = parent
    if bevel > 0:
        modifier = joined.modifiers.new("bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(50)
        modifier.harden_normals = False
    return joined


def empty(name, location=(0, 0, 0), parent=None, rotation_degrees=0.0):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.5
    obj.location = location
    obj.rotation_euler = (0, 0, math.radians(rotation_degrees))
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def export_glb(path):
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)


def seeded(name):
    return random.Random(sum(ord(character) * (index + 1) for index, character in enumerate(name)))
