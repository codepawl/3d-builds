"""Shared helpers for the Kelvin asset scripts: scene reset, materials, baked textures, bevelled primitives, joins and GLB export.

Conventions: Blender is Z-up and the glTF exporter turns it into three.js Y-up, so Blender -Y becomes three.js +Z.
Every asset faces Blender -Y (its front looks at three.js +Z), stands on z = 0 and is centred on its footprint.
"""
import math
import os

import bmesh
import bpy

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BLENDER_DIR)
ASSET_DIR = os.path.join(PROJECT_DIR, "public", "assets")
TEXTURE_DIR = os.path.join(BLENDER_DIR, "textures")

# One texel density for box-projected UVs: textures repeat every 1 / UV_DENSITY metres unless a part asks otherwise.
UV_DENSITY = 2.0


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _material_cache.clear()


def srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_color(value):
    value = value.lstrip("#")
    red, green, blue = (int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return (srgb_to_linear(red), srgb_to_linear(green), srgb_to_linear(blue), 1.0)


_material_cache = {}


def material(name, color="#ffffff", roughness=0.5, metallic=0.0, emission=None, emission_strength=1.0, texture=None, alpha_texture=False):
    """A Principled BSDF material the glTF exporter maps straight to PBR. `texture` is an image name made by `bake_texture`."""
    if name in _material_cache:
        return _material_cache[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = hex_color(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = hex_color(emission)
        shader.inputs["Emission Strength"].default_value = emission_strength
    if texture:
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = bpy.data.images[texture]
        mat.node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
        if alpha_texture:
            mat.node_tree.links.new(image_node.outputs["Alpha"], shader.inputs["Alpha"])
    _material_cache[name] = mat
    return mat


def clear_material_cache():
    _material_cache.clear()


def bake_texture(name, size, pixel_function):
    """Write a small procedural RGBA texture to blender/textures and load it. pixel_function(u, v) returns (r, g, b, a) in 0..1."""
    os.makedirs(TEXTURE_DIR, exist_ok=True)
    image = bpy.data.images.new(name, size, size, alpha=True)
    pixels = []
    for row in range(size):
        for column in range(size):
            pixels.extend(pixel_function((column + 0.5) / size, (row + 0.5) / size))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = os.path.join(TEXTURE_DIR, f"{name}.png")
    image.file_format = "PNG"
    image.save()
    return name


def hash_noise(x, y, seed=0):
    value = math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return value - math.floor(value)


def perforated_texture():
    """White sheet with round holes on a square grid; tinted by the material colour in the app."""
    def pixel(u, v):
        cell_u = (u * 8) % 1 - 0.5
        cell_v = (v * 8) % 1 - 0.5
        hole = math.hypot(cell_u, cell_v) < 0.3
        shade = 0.18 if hole else 0.92 + 0.04 * hash_noise(u, v)
        return (shade, shade, shade, 1)
    return bake_texture("perforated", 128, pixel)


def hex_vent_texture():
    """Dark faceplate with a honeycomb of vent holes, for GPU trays and switch panels."""
    def pixel(u, v):
        x = u * 10
        y = v * 10 / 0.866
        row = math.floor(y)
        if row % 2:
            x += 0.5
        distance = math.hypot(x % 1 - 0.5, (y % 1 - 0.5) * 0.866)
        shade = 0.05 if distance < 0.33 else 0.3
        return (shade, shade, shade * 1.15, 1)
    return bake_texture("hex_vent", 128, pixel)


def speckle_texture(name, base, spread, seed, blotch=0.4):
    """Asphalt, gravel and concrete: a base grey with fine speckles."""
    def pixel(u, v):
        noise = hash_noise(math.floor(u * 128), math.floor(v * 128), seed)
        coarse = hash_noise(math.floor(u * 16), math.floor(v * 16), seed + 1)
        shade = base + (noise - 0.5) * spread + (coarse - 0.5) * spread * blotch
        return (shade, shade, shade * 1.03, 1)
    return bake_texture(name, 128, pixel)


def coil_texture():
    """Condenser coil: fine vertical aluminium fins over a dark core."""
    def pixel(u, v):
        fin = (u * 48) % 1
        shade = 0.72 if fin < 0.35 else 0.32
        return (shade, shade * 1.02, shade * 1.06, 1)
    return bake_texture("coil", 128, pixel)


def fence_texture():
    """Chain-link diamonds with an alpha channel; the app renders it with an alpha test."""
    def pixel(u, v):
        diagonal_a = abs(((u + v) * 8) % 1 - 0.5)
        diagonal_b = abs(((u - v) * 8) % 1 - 0.5)
        wire = min(diagonal_a, diagonal_b) < 0.06
        return (0.55, 0.58, 0.64, 1.0 if wire else 0.0)
    return bake_texture("fence", 128, pixel)


def fan(prefix, radius, location, blade_material, hub_material, guard_material, housing_material, blades=5, housing_depth=0.08):
    """A fan: a static housing with a wire guard, and a separate rotor object (named `<prefix>_rotor`) pivoting on its axis."""
    x, y, z = location
    housing = cylinder(f"{prefix}_shroud", radius * 1.08, housing_depth, (x, y, z - housing_depth / 2), housing_material, vertices=40, cap=False, bevel=0)
    rim = torus(f"{prefix}_rim", radius * 1.08, 0.018, (x, y, z), guard_material, major_segments=40, minor_segments=8)
    rings = [torus(f"{prefix}_guard_{index}", radius * fraction, 0.006, (x, y, z + 0.035), guard_material, major_segments=36, minor_segments=6)
             for index, fraction in enumerate((0.35, 0.62, 0.9))]
    spokes = [box(f"{prefix}_spoke_{index}", (radius * 2.1, 0.012, 0.012), (x, y, z + 0.035), guard_material, bevel=0.003, segments=1,
                  rotation=(0, 0, index * math.pi / 4)) for index in range(4)]
    well = cylinder(f"{prefix}_well", radius * 1.06, 0.01, (x, y, z - housing_depth + 0.005), hub_material, vertices=40, bevel=0)
    static = join(f"{prefix}_housing", [housing, rim, well] + rings + spokes)
    hub = cylinder(f"{prefix}_hub", radius * 0.17, 0.06, (x, y, z - 0.02), hub_material, vertices=24, bevel=0.01)
    parts = [hub] + [blade(f"{prefix}_blade_{index}", radius * 0.84, radius * 0.3, 0.38, (x, y, z - 0.02), blade_material, index / blades * math.tau)
                     for index in range(blades)]
    rotor = join(f"{prefix}_rotor", parts)
    set_origin(rotor, (x, y, z))
    return static, rotor


def link_object(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def finish_object(obj, mat, bevel, segments, smooth=True, uv_density=UV_DENSITY):
    """Apply scale, bevel (with hardened normals so flat faces stay flat), box-project UVs and assign the material."""
    mesh = obj.data
    matrix = obj.matrix_basis.copy()
    mesh.transform(matrix)
    obj.matrix_basis.identity()
    if bevel > 0:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(40)
        modifier.harden_normals = True
        modifier.use_clamp_overlap = True
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        new_mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        obj.modifiers.clear()
        old_mesh = obj.data
        obj.data = new_mesh
        bpy.data.meshes.remove(old_mesh)
        mesh = new_mesh
    if smooth:
        mesh.shade_smooth()
    box_project_uvs(mesh, uv_density)
    mesh.materials.clear()
    mesh.materials.append(mat)
    return obj


def box_project_uvs(mesh, density=UV_DENSITY):
    """World-scale box projection: each face takes the two axes across its normal, so textures keep one size everywhere."""
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv_layer = mesh.uv_layers.active.data
    for polygon in mesh.polygons:
        normal = polygon.normal
        axis = max(range(3), key=lambda index: abs(normal[index]))
        first, second = [(1, 2), (0, 2), (0, 1)][axis]
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv_layer[loop_index].uv = (coordinate[first] * density, coordinate[second] * density)


def box(name, size, location, mat, bevel=0.01, segments=2, rotation=(0, 0, 0), uv_density=UV_DENSITY, smooth=True):
    """A bevelled box. size and location are in metres, Blender axes (x right, y back, z up)."""
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    bmesh.ops.create_cube(builder, size=1.0)
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.scale = size
    obj.rotation_euler = rotation
    obj.location = location
    return finish_object(obj, mat, bevel, segments, smooth=smooth, uv_density=uv_density)


def cylinder(name, radius, depth, location, mat, vertices=24, bevel=0.005, segments=2, rotation=(0, 0, 0), radius_top=None, cap=True):
    """A cylinder (or cone when radius_top differs) along its local Z."""
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    bmesh.ops.create_cone(
        builder, cap_ends=cap, cap_tris=False, segments=vertices,
        radius1=radius, radius2=radius if radius_top is None else radius_top, depth=depth,
    )
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.rotation_euler = rotation
    obj.location = location
    return finish_object(obj, mat, bevel, segments)


def sphere(name, radius, location, mat, scale=(1, 1, 1), segments=24, rings=16):
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    bmesh.ops.create_uvsphere(builder, u_segments=segments, v_segments=rings, radius=radius)
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.scale = scale
    obj.location = location
    return finish_object(obj, mat, 0, 0)


def torus(name, major_radius, minor_radius, location, mat, rotation=(0, 0, 0), major_segments=32, minor_segments=10):
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    for ring in range(major_segments):
        angle = ring / major_segments * math.tau
        for step in range(minor_segments):
            tube = step / minor_segments * math.tau
            distance = major_radius + minor_radius * math.cos(tube)
            builder.verts.new((distance * math.cos(angle), distance * math.sin(angle), minor_radius * math.sin(tube)))
    builder.verts.ensure_lookup_table()
    for ring in range(major_segments):
        for step in range(minor_segments):
            corner = ring * minor_segments + step
            right = ((ring + 1) % major_segments) * minor_segments + step
            up = ring * minor_segments + (step + 1) % minor_segments
            diagonal = ((ring + 1) % major_segments) * minor_segments + (step + 1) % minor_segments
            builder.faces.new((builder.verts[corner], builder.verts[right], builder.verts[diagonal], builder.verts[up]))
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.rotation_euler = rotation
    obj.location = location
    return finish_object(obj, mat, 0, 0)


def blade(name, length, chord, pitch, location, mat, angle):
    """One fan blade: a thin bevelled slab from the hub outward, twisted by `pitch` radians, around local Z."""
    center = (
        location[0] + math.cos(angle) * length / 2,
        location[1] + math.sin(angle) * length / 2,
        location[2],
    )
    return box(name, (length, chord, 0.012), center, mat, bevel=0.004, segments=1, rotation=(pitch, 0, angle))


def join(name, objects):
    """Join objects into one mesh object named `name` (materials become glTF primitives)."""
    objects = [obj for obj in objects if obj is not None]
    target = objects[0]
    with bpy.context.temp_override(active_object=target, selected_editable_objects=objects, object=target):
        bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def set_origin(obj, origin):
    """Move the object's origin to `origin` (world) without moving its geometry: pivots for wheels, limbs and rotors."""
    from mathutils import Matrix, Vector
    offset = Vector(origin) - obj.location
    obj.data.transform(Matrix.Translation(-offset))
    obj.location = obj.location + offset
    return obj


def parent(child, parent_object):
    """Parent keeping the child's world placement."""
    # matrix_world is only refreshed by a depsgraph update; without one a freshly moved origin reads as identity.
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent_object
    child.matrix_world = world
    return child


def empty(name, location=(0, 0, 0)):
    obj = link_object(bpy.data.objects.new(name, None))
    obj.location = location
    return obj


def export_glb(filename):
    os.makedirs(ASSET_DIR, exist_ok=True)
    path = os.path.join(ASSET_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=False,
    )
    print(f"exported {path} {os.path.getsize(path) / 1024:.0f} KB")


def grille_materials():
    """Light frame, pale slats and a mid-grey recess, so a vent reads as a grille from far away instead of a black rectangle."""
    return {
        "frame": material("grille_frame", "#f1f3f9", roughness=0.45, metallic=0.2),
        "slat": material("grille_slat", "#c4ccdd", roughness=0.4, metallic=0.35),
        "recess": material("grille_recess", "#6f7891", roughness=0.8),
    }


def louvre_grille(name, width, height, center, axis, side, grille, base_offset=0.0):
    """A wall vent: pale frame, tilted slats over a mid-grey recess. `axis` is the wall normal ('x' or 'y'), `side` is +1 or -1;
    `base_offset` is how far the wall surface sits from `center` along that normal."""
    center_x, center_y, center_z = center
    bar = 0.05

    def part(across, depth, up, along, outward, vertical, material_name, tilt=0.0):
        distance = side * (base_offset + outward)
        if axis == "y":
            return box(f"{name}_{material_name}", (across, depth, up), (center_x + along, center_y + distance, center_z + vertical),
                       grille[material_name], bevel=0.004, segments=1, rotation=(tilt, 0, 0))
        return box(f"{name}_{material_name}", (depth, across, up), (center_x + distance, center_y + along, center_z + vertical),
                   grille[material_name], bevel=0.004, segments=1, rotation=(0, tilt, 0))

    parts = [part(width, 0.02, height, 0, 0.01, 0, "recess")]
    slat_count = max(3, int(height / 0.075))
    slat_pitch = (height - 2 * bar) / slat_count
    for index in range(slat_count):
        vertical = -height / 2 + bar + (index + 0.5) * slat_pitch
        parts.append(part(width - 2 * bar, 0.045, 0.034, 0, 0.035, vertical, "slat", tilt=0.6))
    parts += [
        part(width, 0.05, bar, 0, 0.025, height / 2 - bar / 2, "frame"),
        part(width, 0.05, bar, 0, 0.025, -height / 2 + bar / 2, "frame"),
        part(bar, 0.05, height, -width / 2 + bar / 2, 0.025, 0, "frame"),
        part(bar, 0.05, height, width / 2 - bar / 2, 0.025, 0, "frame"),
    ]
    return parts


def flat_polygon(name, outline, thickness, center, mat):
    """An extruded flat shape: `outline` is a list of (across, up) points on a plate facing Blender -Y, extruded `thickness` toward -Y."""
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    face = builder.faces.new([builder.verts.new((across, 0, up)) for across, up in outline])
    extruded = bmesh.ops.extrude_face_region(builder, geom=[face])
    moved = [element for element in extruded["geom"] if isinstance(element, bmesh.types.BMVert)]
    bmesh.ops.translate(builder, vec=(0, -thickness, 0), verts=moved)
    bmesh.ops.recalc_face_normals(builder, faces=builder.faces[:])
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.location = center
    return finish_object(obj, mat, 0, 0)
