"""Mesh building helpers: primitives built straight into per-material bmeshes in world space.

Coordinates are Blender's: X right, Y away from the start camera, Z up. Units are metres.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise


class MeshBuilder:
    """Collects geometry per material and turns it into one object per material."""

    def __init__(self, group_name):
        self.group_name = group_name
        self.bmesh_by_material = {}

    def bmesh_for(self, material_name):
        if material_name not in self.bmesh_by_material:
            new_bmesh = bmesh.new()
            new_bmesh.loops.layers.color.new("Col")
            new_bmesh.loops.layers.uv.new("UVMap")
            self.bmesh_by_material[material_name] = new_bmesh
        return self.bmesh_by_material[material_name]

    def build_objects(self, materials, collection=None):
        created_objects = []
        for material_name, part_bmesh in self.bmesh_by_material.items():
            if len(part_bmesh.faces) == 0:
                part_bmesh.free()
                continue
            mesh_name = f"{self.group_name}__{material_name}"
            mesh = bpy.data.meshes.new(mesh_name)
            part_bmesh.to_mesh(mesh)
            part_bmesh.free()
            mesh.color_attributes.active_color_name = "Col"
            mesh.color_attributes.render_color_index = mesh.color_attributes.active_color_index
            mesh.materials.append(materials[material_name])
            mesh_object = bpy.data.objects.new(mesh_name, mesh)
            target_collection = collection or bpy.context.scene.collection
            target_collection.objects.link(mesh_object)
            created_objects.append(mesh_object)
        self.bmesh_by_material = {}
        return created_objects


def faces_of_verts(verts):
    face_set = set()
    for vert in verts:
        for face in vert.link_faces:
            face_set.add(face)
    return list(face_set)


def assign_box_uvs(part_bmesh, faces, uv_scale_metres, offset=(0.0, 0.0)):
    """Box projection in the part's local space, before it is moved into place."""
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    for face in faces:
        normal = face.normal
        axis_x = abs(normal.x)
        axis_y = abs(normal.y)
        axis_z = abs(normal.z)
        for loop in face.loops:
            coordinate = loop.vert.co
            if axis_z >= axis_x and axis_z >= axis_y:
                u_value = coordinate.x
                v_value = coordinate.y
            elif axis_y >= axis_x:
                u_value = coordinate.x
                v_value = coordinate.z
            else:
                u_value = coordinate.y
                v_value = coordinate.z
            loop[uv_layer].uv = (u_value / uv_scale_metres + offset[0], v_value / uv_scale_metres + offset[1])


def assign_cylinder_uvs(part_bmesh, faces, circumference_scale, length_scale, offset=(0.0, 0.0)):
    """Cylindrical projection around local Z: U wraps around, V runs along the length."""
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    for face in faces:
        center = face.calc_center_median()
        center_angle = math.atan2(center.y, center.x)
        for loop in face.loops:
            coordinate = loop.vert.co
            angle = math.atan2(coordinate.y, coordinate.x)
            if angle - center_angle > math.pi:
                angle -= 2.0 * math.pi
            if center_angle - angle > math.pi:
                angle += 2.0 * math.pi
            u_value = angle / (2.0 * math.pi) * circumference_scale
            v_value = coordinate.z / length_scale
            loop[uv_layer].uv = (u_value + offset[0], v_value + offset[1])


def paint_faces(part_bmesh, faces, color_function):
    """color_function(world_position, world_normal) returns an RGBA tuple."""
    color_layer = part_bmesh.loops.layers.color["Col"]
    for face in faces:
        for loop in face.loops:
            loop[color_layer] = color_function(loop.vert.co, loop.vert.normal)


def solid_color(rgb, jitter=0.0, jitter_scale=1.0, seed_offset=0.0):
    """A colour with a little world-space noise so large surfaces are not flat."""

    def color_function(position, normal):
        if jitter <= 0.0:
            return (rgb[0], rgb[1], rgb[2], 1.0)
        sample_point = Vector((position.x / jitter_scale + seed_offset, position.y / jitter_scale, position.z / jitter_scale))
        variation = noise.noise(sample_point) * jitter
        return (
            clamp_unit(rgb[0] * (1.0 + variation)),
            clamp_unit(rgb[1] * (1.0 + variation)),
            clamp_unit(rgb[2] * (1.0 + variation)),
            1.0,
        )

    return color_function


def clamp_unit(value):
    return max(0.0, min(1.0, value))


def smoothstep(edge_low, edge_high, value):
    if edge_high == edge_low:
        return 1.0 if value >= edge_high else 0.0
    t_value = clamp_unit((value - edge_low) / (edge_high - edge_low))
    return t_value * t_value * (3.0 - 2.0 * t_value)


def mix_rgb(color_a, color_b, amount):
    return tuple(color_a[index] * (1.0 - amount) + color_b[index] * amount for index in range(3))


def placement_matrix(location, rotation_z=0.0, rotation_x=0.0, rotation_y=0.0):
    translation = Matrix.Translation(Vector(location))
    rotation = (
        Matrix.Rotation(rotation_z, 4, "Z")
        @ Matrix.Rotation(rotation_y, 4, "Y")
        @ Matrix.Rotation(rotation_x, 4, "X")
    )
    return translation @ rotation


def finish_part(part_bmesh, verts, world_matrix, color_function, smooth, uv_mode, uv_scale):
    faces = faces_of_verts(verts)
    if uv_mode == "box":
        assign_box_uvs(part_bmesh, faces, uv_scale)
    elif uv_mode == "cylinder":
        assign_cylinder_uvs(part_bmesh, faces, uv_scale[0], uv_scale[1])
    bmesh.ops.transform(part_bmesh, matrix=world_matrix, verts=verts)
    part_bmesh.normal_update()
    for face in faces:
        face.smooth = smooth
    paint_faces(part_bmesh, faces, color_function)
    return faces


def add_box(builder, material_name, size, world_matrix, color_function, bevel=0.0, uv_scale=1.0, smooth=False):
    part_bmesh = builder.bmesh_for(material_name)
    result = bmesh.ops.create_cube(part_bmesh, size=1.0, matrix=Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    verts = result["verts"]
    if bevel > 0.0:
        edges = list({edge for vert in verts for edge in vert.link_edges})
        bevel_result = bmesh.ops.bevel(
            part_bmesh, geom=verts + edges, offset=bevel, segments=2, affect="EDGES", profile=0.5
        )
        verts = list({vert for vert in verts if vert.is_valid} | set(bevel_result["verts"]))
        verts = list({vert for face in faces_of_verts(verts) for vert in face.verts})
    part_bmesh.normal_update()
    return finish_part(part_bmesh, verts, world_matrix, color_function, smooth, "box", uv_scale)


def add_cylinder(
    builder,
    material_name,
    radius_bottom,
    radius_top,
    height,
    world_matrix,
    color_function,
    segments=12,
    caps=True,
    smooth=True,
    uv_scale=(1.0, 1.0),
    deform=None,
):
    """Cylinder standing on local Z = 0, growing to Z = height."""
    part_bmesh = builder.bmesh_for(material_name)
    result = bmesh.ops.create_cone(
        part_bmesh,
        cap_ends=caps,
        cap_tris=False,
        segments=segments,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=height,
        matrix=Matrix.Translation(Vector((0.0, 0.0, height * 0.5))),
    )
    verts = result["verts"]
    if deform is not None:
        for vert in verts:
            vert.co = deform(vert.co.copy())
    part_bmesh.normal_update()
    return finish_part(part_bmesh, verts, world_matrix, color_function, smooth, "cylinder", uv_scale)


def add_blob(builder, material_name, radius, scale, world_matrix, color_function, subdivisions=3, deform=None, uv_scale=1.0):
    """A displaced icosphere: rocks, snow lumps, branch clusters."""
    part_bmesh = builder.bmesh_for(material_name)
    result = bmesh.ops.create_icosphere(part_bmesh, subdivisions=subdivisions, radius=radius)
    verts = result["verts"]
    for vert in verts:
        scaled = Vector((vert.co.x * scale[0], vert.co.y * scale[1], vert.co.z * scale[2]))
        vert.co = deform(scaled) if deform is not None else scaled
    part_bmesh.normal_update()
    return finish_part(part_bmesh, verts, world_matrix, color_function, True, "box", uv_scale)


def add_grid_surface(builder, material_name, position_function, count_u, count_v, color_function, uv_function, smooth=True, flip=False):
    """A grid surface from position_function(u, v) with u and v in [0, 1]."""
    part_bmesh = builder.bmesh_for(material_name)
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    vert_rows = []
    for index_v in range(count_v + 1):
        row = []
        for index_u in range(count_u + 1):
            position = position_function(index_u / count_u, index_v / count_v)
            row.append(part_bmesh.verts.new(position))
        vert_rows.append(row)
    faces = []
    for index_v in range(count_v):
        for index_u in range(count_u):
            corner_verts = [
                vert_rows[index_v][index_u],
                vert_rows[index_v][index_u + 1],
                vert_rows[index_v + 1][index_u + 1],
                vert_rows[index_v + 1][index_u],
            ]
            if flip:
                corner_verts.reverse()
            unique_positions = {tuple(round(value, 6) for value in vert.co) for vert in corner_verts}
            if len(unique_positions) < 3:
                continue
            if len(unique_positions) == 3:
                corner_verts = deduplicate_corner_verts(corner_verts)
            try:
                face = part_bmesh.faces.new(corner_verts)
            except ValueError:
                continue
            face.smooth = smooth
            faces.append(face)
    part_bmesh.normal_update()
    for face in faces:
        for loop in face.loops:
            loop[uv_layer].uv = uv_function(loop.vert.co)
    paint_faces(part_bmesh, faces, color_function)
    return faces


def deduplicate_corner_verts(corner_verts):
    seen_positions = []
    unique_verts = []
    for vert in corner_verts:
        key = tuple(round(value, 6) for value in vert.co)
        if key in seen_positions:
            continue
        seen_positions.append(key)
        unique_verts.append(vert)
    return unique_verts


def add_polygon_fan(builder, material_name, outline_points, height, color_function, uv_scale=1.0, rings=6):
    """A flat polygon filled with concentric rings, so it has inner vertices for smooth shading."""
    part_bmesh = builder.bmesh_for(material_name)
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    center_x = sum(point[0] for point in outline_points) / len(outline_points)
    center_y = sum(point[1] for point in outline_points) / len(outline_points)
    center_vert = part_bmesh.verts.new((center_x, center_y, height))
    ring_verts = []
    for ring_index in range(1, rings + 1):
        fraction = ring_index / rings
        ring = []
        for point in outline_points:
            ring.append(
                part_bmesh.verts.new(
                    (center_x + (point[0] - center_x) * fraction, center_y + (point[1] - center_y) * fraction, height)
                )
            )
        ring_verts.append(ring)
    faces = []
    point_count = len(outline_points)
    first_ring = ring_verts[0]
    for index in range(point_count):
        faces.append(part_bmesh.faces.new([center_vert, first_ring[index], first_ring[(index + 1) % point_count]]))
    for ring_index in range(1, rings):
        inner = ring_verts[ring_index - 1]
        outer = ring_verts[ring_index]
        for index in range(point_count):
            next_index = (index + 1) % point_count
            faces.append(part_bmesh.faces.new([inner[index], outer[index], outer[next_index], inner[next_index]]))
    part_bmesh.normal_update()
    for face in faces:
        if face.normal.z < 0.0:
            face.normal_flip()
        face.smooth = True
        for loop in face.loops:
            loop[uv_layer].uv = (loop.vert.co.x / uv_scale, loop.vert.co.y / uv_scale)
    part_bmesh.normal_update()
    paint_faces(part_bmesh, faces, color_function)
    return faces


def fractal_noise(x_value, y_value, z_value=0.0, octaves=4, base_scale=1.0):
    total = 0.0
    amplitude = 1.0
    frequency = 1.0 / base_scale
    normaliser = 0.0
    for _ in range(octaves):
        total += amplitude * noise.noise(Vector((x_value * frequency, y_value * frequency, z_value * frequency)))
        normaliser += amplitude
        amplitude *= 0.5
        frequency *= 2.0
    return total / normaliser


def seeded_random(seed):
    return random.Random(seed)
