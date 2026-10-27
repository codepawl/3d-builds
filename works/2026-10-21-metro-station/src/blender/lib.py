"""Shared helpers for the metro asset pack. Units are metres, +X along the track, +Z up, rail head top at z=0."""
import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ASSET_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
SHARP_ANGLE_DEGREES = 35.0

_material_cache = {}
NAME_PREFIX = ""  # set per asset so child names stay unique across variants in one file


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _material_cache.clear()


def hex_to_linear(hex_color):
    hex_color = hex_color.lstrip("#")
    channels = [int(hex_color[index:index + 2], 16) / 255.0 for index in (0, 2, 4)]
    return [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]


def material(name, hex_color, roughness=0.55, metallic=0.0, emission_hex=None, emission_strength=0.0, alpha=1.0):
    if name in _material_cache:
        return _material_cache[name]
    new_material = bpy.data.materials.new(name)
    new_material.use_nodes = True
    shader = new_material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = hex_to_linear(hex_color) + [1.0]
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission_hex:
        shader.inputs["Emission Color"].default_value = hex_to_linear(emission_hex) + [1.0]
        shader.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        shader.inputs["Alpha"].default_value = alpha
        new_material.surface_render_method = "BLENDED"
    new_material.use_backface_culling = True
    new_material.diffuse_color = hex_to_linear(hex_color) + [1.0]
    _material_cache[name] = new_material
    return new_material


class Mesh:
    """Accumulates primitives into one mesh object with one material slot per material used."""

    def __init__(self, name, location=(0, 0, 0)):
        self.name = name
        self.location = location
        self.bm = bmesh.new()
        self.materials = []

    def _slot(self, mat):
        if mat not in self.materials:
            self.materials.append(mat)
        return self.materials.index(mat)

    def _finish_primitive(self, verts, slot, matrix, bevel):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        faces = {face for vert in verts for face in vert.link_faces}
        for face in faces:
            face.material_index = slot
        if bevel > 0:
            edges = {edge for vert in verts for edge in vert.link_edges}
            result = bmesh.ops.bevel(self.bm, geom=list(verts) + list(edges) + list(faces), offset=bevel, segments=2,
                                     affect="EDGES", profile=0.7)
            for new_face in result["faces"]:
                new_face.material_index = slot

    def box(self, size, center, mat, bevel=0.015, rotation=(0, 0, 0)):
        slot = self._slot(mat)
        created = bmesh.ops.create_cube(self.bm, size=1.0)
        scale = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        placement = Matrix.LocRotScale(Vector(center), Euler(rotation), None)
        limit = 0.45 * min(size)
        self._finish_primitive(created["verts"], slot, placement @ scale, min(bevel, limit))

    def cylinder(self, radius, depth, center, mat, axis="Z", segments=24, bevel=0.0, radius_top=None):
        slot = self._slot(mat)
        top_radius = radius if radius_top is None else radius_top
        created = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments,
                                        radius1=radius, radius2=top_radius, depth=depth)
        rotations = {"Z": (0, 0, 0), "X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0)}
        placement = Matrix.LocRotScale(Vector(center), Euler(rotations[axis]), None)
        self._finish_primitive(created["verts"], slot, placement, min(bevel, 0.45 * min(radius, depth / 2)))

    def sphere(self, radii, center, mat, subdivisions=2):
        slot = self._slot(mat)
        created = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1.0)
        scale = Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
        self._finish_primitive(created["verts"], slot, Matrix.Translation(Vector(center)) @ scale, 0.0)

    def loft(self, rings, mat, cap_start=True, cap_end=True, closed=True):
        """Bridge consecutive rings (lists of 3D points of equal length) into a surface; rings run along +X."""
        slot = self._slot(mat)
        ring_verts = [[self.bm.verts.new(point) for point in ring] for ring in rings]
        count = len(rings[0])
        new_faces = []
        for first, second in zip(ring_verts[:-1], ring_verts[1:]):
            span = count if closed else count - 1
            for index in range(span):
                following = (index + 1) % count
                new_faces.append(self.bm.faces.new((first[index], first[following], second[following], second[index])))
        if closed and cap_start:
            new_faces.append(self.bm.faces.new(ring_verts[0][::-1]))
        if closed and cap_end:
            new_faces.append(self.bm.faces.new(ring_verts[-1]))
        for face in new_faces:
            face.material_index = slot

    def arc_shell(self, inner_radius, outer_radius, x_start, x_end, start_degrees, end_degrees, center_yz, mat, steps=6):
        """Closed solid of a ring sector around the X axis (angle 0 = +Y, 90 = +Z)."""
        slot = self._slot(mat)
        center_y, center_z = center_yz
        angles = [math.radians(start_degrees + (end_degrees - start_degrees) * index / steps) for index in range(steps + 1)]

        def corner(x, radius, angle):
            return self.bm.verts.new((x, center_y + radius * math.cos(angle), center_z + radius * math.sin(angle)))

        grid = {(x, radius, index): corner(x, radius, angle)
                for x in (x_start, x_end) for radius in (inner_radius, outer_radius) for index, angle in enumerate(angles)}
        quads = []
        for index in range(steps):
            for radius in (inner_radius, outer_radius):
                quads.append((grid[(x_start, radius, index)], grid[(x_start, radius, index + 1)],
                              grid[(x_end, radius, index + 1)], grid[(x_end, radius, index)]))
            for x in (x_start, x_end):
                quads.append((grid[(x, inner_radius, index)], grid[(x, inner_radius, index + 1)],
                              grid[(x, outer_radius, index + 1)], grid[(x, outer_radius, index)]))
        for index in (0, steps):
            quads.append((grid[(x_start, inner_radius, index)], grid[(x_end, inner_radius, index)],
                          grid[(x_end, outer_radius, index)], grid[(x_start, outer_radius, index)]))
        for quad in quads:
            self.bm.faces.new(quad).material_index = slot

    def prism(self, outline_xz, y_min, y_max, mat, bevel=0.0):
        """Extrude a polygon given as (x, z) points (counter-clockwise seen from -Y) between two Y values."""
        slot = self._slot(mat)
        front = [self.bm.verts.new((x, y_min, z)) for x, z in outline_xz]
        back = [self.bm.verts.new((x, y_max, z)) for x, z in outline_xz]
        faces = [self.bm.faces.new(front), self.bm.faces.new(back[::-1])]
        count = len(outline_xz)
        for index in range(count):
            following = (index + 1) % count
            faces.append(self.bm.faces.new((front[following], front[index], back[index], back[following])))
        for face in faces:
            face.material_index = slot

    def build(self, parent=None):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        limit = math.radians(SHARP_ANGLE_DEGREES)
        for face in bm.faces:
            face.smooth = True
        for edge in bm.edges:
            if len(edge.link_faces) == 2:
                edge.smooth = edge.calc_face_angle(0.0) < limit
        uv_layer = bm.loops.layers.uv.new("UVMap")
        for face in bm.faces:
            normal = face.normal
            axis = max(range(3), key=lambda index: abs(normal[index]))
            for loop in face.loops:
                coordinate = loop.vert.co
                pair = [(1, 2), (0, 2), (0, 1)][axis]
                loop[uv_layer].uv = (coordinate[pair[0]], coordinate[pair[1]])
        mesh_data = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh_data)
        bm.free()
        for mat in self.materials:
            mesh_data.materials.append(mat)
        mesh_object = bpy.data.objects.new(NAME_PREFIX + self.name, mesh_data)
        bpy.context.scene.collection.objects.link(mesh_object)
        mesh_object.location = self.location
        mesh_object.parent = parent
        return mesh_object


def empty(name, location=(0, 0, 0), parent=None):
    node = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(node)
    node.location = location
    node.parent = parent
    return node


def rotated_ring(points_yz, x, scale=1.0, center_z=2.4):
    """Place a (y, z) profile at station x, scaled about its vertical middle."""
    return [(x, y * scale, center_z + (z - center_z) * scale) for y, z in points_yz]


def export_glb(filename, roots, animation_mode="ACTIONS"):
    bpy.ops.object.select_all(action="DESELECT")
    for root in roots:
        root.select_set(True)
        for child in root.children_recursive:
            child.select_set(True)
    os.makedirs(ASSET_DIR, exist_ok=True)
    path = os.path.join(ASSET_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_animations=True, export_animation_mode=animation_mode, export_yup=True)
    print("EXPORTED", path, os.path.getsize(path))
    return path


# Palette: toy isometric, light cool, one strong brand colour (teal).
PALETTE = {
    "body_white": ("#EEF2F6", 0.35, 0.1),
    "body_grey": ("#C5CEDA", 0.5, 0.1),
    "dark_metal": ("#3A4350", 0.6, 0.5),
    "rubber": ("#23282F", 0.85, 0.0),
    "glass": ("#2B4560", 0.1, 0.0),
    "concrete": ("#B9BEC6", 0.9, 0.0),
    "concrete_dark": ("#8D939D", 0.9, 0.0),
    "steel": ("#8A93A0", 0.4, 0.8),
    "teal": ("#12A59A", 0.5, 0.0),
    "line_stripe": ("#FF6B4A", 0.45, 0.0),
    "yellow": ("#F2C230", 0.6, 0.0),
    "red_signal": ("#FF2B2B", 0.4, 0.0),
}


def pal(name):
    hex_color, roughness, metallic = PALETTE[name]
    return material(name, hex_color, roughness, metallic)
