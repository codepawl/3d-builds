# Shared modelling helpers for the Orglet Office assets.
# Every helper takes positions, sizes and rotations in the app's frame (y up, the front of an asset faces +z)
# and converts them to Blender's z-up frame, so the scripts read like the three.js scene they feed.
import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

# app (x, y, z) -> Blender (x, -z, y); the glTF exporter's +Y-up conversion maps it back exactly.
APP_TO_BLENDER = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def app_location(x, y, z):
    return Vector((x, -z, y))


def app_rotation_matrix(rotation):
    app_matrix = Euler(rotation, 'XYZ').to_matrix()
    return APP_TO_BLENDER @ app_matrix @ APP_TO_BLENDER.transposed()


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_color(value):
    value = value.lstrip('#')
    red, green, blue = (int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return (srgb_to_linear(red), srgb_to_linear(green), srgb_to_linear(blue), 1.0)


_materials = {}


def material(name, color='#ffffff', roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0,
             image=None, double_sided=False):
    """One Principled material per name; asking again for a name returns the same material."""
    if name in _materials:
        return _materials[name]
    new_material = bpy.data.materials.new(name)
    new_material.use_backface_culling = not double_sided
    new_material.use_nodes = True
    principled = new_material.node_tree.nodes['Principled BSDF']
    principled.inputs['Base Color'].default_value = hex_color(color)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = metallic
    if emission:
        principled.inputs['Emission Color'].default_value = hex_color(emission)
        principled.inputs['Emission Strength'].default_value = emission_strength
    if image is not None:
        texture_node = new_material.node_tree.nodes.new('ShaderNodeTexImage')
        texture_node.image = image
        new_material.node_tree.links.new(texture_node.outputs['Color'], principled.inputs['Base Color'])
    _materials[name] = new_material
    return new_material


def reset_material_cache():
    _materials.clear()


# ---------- small procedural textures, saved as PNG so the glTF exporter embeds them ----------

def _lattice_value(x, y, seed):
    hashed = math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return hashed - math.floor(hashed)


def value_noise(x, y, seed=0, period=None):
    """Smooth 2D value noise; with a period it tiles so textures repeat without seams."""
    cell_x = math.floor(x)
    cell_y = math.floor(y)
    fraction_x = x - cell_x
    fraction_y = y - cell_y
    fraction_x = fraction_x * fraction_x * (3 - 2 * fraction_x)
    fraction_y = fraction_y * fraction_y * (3 - 2 * fraction_y)

    def corner(offset_x, offset_y):
        corner_x = cell_x + offset_x
        corner_y = cell_y + offset_y
        if period:
            corner_x %= period
            corner_y %= period
        return _lattice_value(corner_x, corner_y, seed)

    top = corner(0, 0) * (1 - fraction_x) + corner(1, 0) * fraction_x
    bottom = corner(0, 1) * (1 - fraction_x) + corner(1, 1) * fraction_x
    return top * (1 - fraction_y) + bottom * fraction_y


def baked_image(name, size, pixel_function, folder):
    """pixel_function(u, v) returns sRGB (r, g, b) in 0..1 for u, v in 0..1."""
    image = bpy.data.images.new(name, size, size, alpha=False)
    pixels = []
    for row in range(size):
        for column in range(size):
            red, green, blue = pixel_function(column / size, row / size)
            pixels.extend((min(1, max(0, red)), min(1, max(0, green)), min(1, max(0, blue)), 1.0))
    image.pixels.foreach_set(pixels)
    os.makedirs(folder, exist_ok=True)
    image.filepath_raw = os.path.join(folder, f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    return image


# ---------- mesh building ----------

def box_project_uvs(bm, scale):
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        normal = face.normal
        dominant_axis = max(range(3), key=lambda axis: abs(normal[axis]))
        for loop in face.loops:
            position = loop.vert.co
            if dominant_axis == 0:
                loop[uv_layer].uv = (position.y * scale, position.z * scale)
            elif dominant_axis == 1:
                loop[uv_layer].uv = (position.x * scale, position.z * scale)
            else:
                loop[uv_layer].uv = (position.x * scale, position.y * scale)


def place(obj, location=(0, 0, 0), rotation=(0, 0, 0), parent=None):
    obj.parent = parent
    obj.location = app_location(*location)
    obj.rotation_euler = app_rotation_matrix(rotation).to_euler()
    return obj


def empty(name, location=(0, 0, 0), rotation=(0, 0, 0), parent=None):
    """A named pivot: the app finds it by name and rotates or hides it (limbs, cards, legs of a board)."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(obj)
    return place(obj, location, rotation, parent)


def mesh_object(name, bm, material_for_mesh, location=(0, 0, 0), rotation=(0, 0, 0), parent=None,
                uv_scale=1.0, smooth=True):
    box_project_uvs(bm, uv_scale)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    mesh.materials.append(material_for_mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return place(obj, location, rotation, parent)


def add_bevel(obj, width, segments=3, harden=True, angle_degrees=None):
    if width <= 0:
        return obj
    modifier = obj.modifiers.new('Bevel', 'BEVEL')
    modifier.width = width
    modifier.segments = segments
    modifier.use_clamp_overlap = True
    modifier.harden_normals = harden
    if angle_degrees is None:
        modifier.limit_method = 'NONE'
    else:
        modifier.limit_method = 'ANGLE'
        modifier.angle_limit = math.radians(angle_degrees)
    return obj


def rounded_box(name, size, radius, material_for_mesh, location=(0, 0, 0), rotation=(0, 0, 0), parent=None,
                segments=3, uv_scale=1.0):
    """size is (width x, height y, depth z) in app units; radius rounds every edge."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    blender_size = Vector((size[0], size[2], size[1]))
    for vertex in bm.verts:
        vertex.co = Vector((vertex.co.x * blender_size.x, vertex.co.y * blender_size.y, vertex.co.z * blender_size.z))
    obj = mesh_object(name, bm, material_for_mesh, location, rotation, parent, uv_scale)
    # Big radii on small parts read as soft and toy-like: keep those smooth instead of hardened.
    is_soft = radius > 0.3 * min(size)
    return add_bevel(obj, min(radius, 0.49 * min(size)), segments=4 if is_soft else segments, harden=not is_soft)


def cylinder(name, radius_bottom, radius_top, height, material_for_mesh, location=(0, 0, 0), rotation=(0, 0, 0),
             parent=None, segments=24, bevel=0.0, uv_scale=1.0):
    """An upright cylinder or cone centred on location; rotate it to lay it along another axis."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius_bottom, radius2=radius_top, depth=height)
    obj = mesh_object(name, bm, material_for_mesh, location, rotation, parent, uv_scale)
    return add_bevel(obj, bevel, segments=2, harden=True, angle_degrees=40)


def sphere(name, radius, material_for_mesh, location=(0, 0, 0), scale=(1, 1, 1), parent=None, segments=24,
           rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=max(8, segments // 2), radius=radius)
    for vertex in bm.verts:
        vertex.co = Vector((vertex.co.x * scale[0], vertex.co.y * scale[2], vertex.co.z * scale[1]))
    return mesh_object(name, bm, material_for_mesh, location, rotation, parent)


def blob(name, radius, material_for_mesh, location=(0, 0, 0), scale=(1, 1, 1), parent=None, seed=0,
         roughness=0.18, frequency=2.2, subdivisions=3):
    """A lumpy, smooth-shaded rounded mass for bushes and tree crowns."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    offset = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for vertex in bm.verts:
        direction = vertex.co.normalized()
        lump = noise.noise(direction * frequency + offset) * roughness * radius
        vertex.co = direction * (radius + lump)
        vertex.co = Vector((vertex.co.x * scale[0], vertex.co.y * scale[2], vertex.co.z * scale[1]))
    return mesh_object(name, bm, material_for_mesh, location, (0, 0, 0), parent)


def leaf(name, length, width, material_for_mesh, location, yaw, pitch, bend=0.25, parent=None):
    """A curved, pointed leaf blade, double-sided; it rises from location along its pitch and yaw."""
    bm = bmesh.new()
    segments = 5
    rows = []
    for index in range(segments + 1):
        along = index / segments
        half_width = width * 0.5 * math.sin(math.pi * min(0.98, along * 0.9 + 0.08))
        droop = bend * along * along * length
        center = Vector((0.0, along * length, -droop))
        rows.append((bm.verts.new(center + Vector((-half_width, 0, 0.0))),
                     bm.verts.new(center + Vector((0.0, 0, 0.02 * length))),
                     bm.verts.new(center + Vector((half_width, 0, 0.0)))))
    for index in range(segments):
        left_a, middle_a, right_a = rows[index]
        left_b, middle_b, right_b = rows[index + 1]
        bm.faces.new((left_a, middle_a, middle_b, left_b))
        bm.faces.new((middle_a, right_a, right_b, middle_b))
    # Local leaf frame: grows along +y (Blender), droops along -z. Turn it into an app-frame rotation.
    rotation_matrix = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(pitch, 3, 'X')
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rotation_matrix)
    bm.normal_update()
    return mesh_object(name, bm, material_for_mesh, location, (0, 0, 0), parent)


# ---------- finishing ----------

def descendants(root):
    found = []
    for child in root.children:
        found.append(child)
        found.extend(descendants(child))
    return found


def apply_modifiers(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    new_mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    old_mesh = obj.data
    obj.modifiers.clear()
    obj.data = new_mesh
    bpy.data.meshes.remove(old_mesh)


def merge_by_material(root, keep_names=()):
    """Joins the static meshes under root into one mesh per material, so each asset is a few draw calls.
    Objects named in keep_names (moving or recoloured parts) and everything below them stay separate."""
    kept = set()
    for obj in descendants(root):
        if obj.name in keep_names:
            kept.add(obj)
            kept.update(descendants(obj))
    groups = {}
    for obj in descendants(root):
        if obj in kept or obj.type != 'MESH':
            continue
        apply_modifiers(obj)
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for material_name, objects in groups.items():
        # Re-parent the pieces straight under the root, keeping where they are in the world.
        for obj in objects:
            world_matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world_matrix
        target = objects[0]
        if len(objects) > 1:
            with bpy.context.temp_override(active_object=target, object=target,
                                           selected_objects=objects, selected_editable_objects=objects):
                bpy.ops.object.join()
        target.name = f'{root.name}_{material_name}'
        target.data.name = target.name
    for obj in kept:
        if obj.type == 'MESH':
            apply_modifiers(obj)
    # Pivots that only grouped merged pieces are now empty; drop them so the GLB carries no stray nodes.
    for obj in descendants(root):
        if obj.type == 'EMPTY' and obj not in kept and not obj.children:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()


def export_glb(roots, path):
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for child in descendants(root):
            child.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_extras=False, export_cameras=False, export_lights=False)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')


def seeded(seed):
    return random.Random(seed)
