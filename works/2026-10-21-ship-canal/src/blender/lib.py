"""Shared helpers for the viz-canal Blender scripts (Blender 5.x, run headless).

Conventions: metres, Z up in Blender. Vehicles and vessels face -Y (the glTF exporter turns that into +Z).
Every asset is a root Empty at the origin with child meshes; moving parts are their own child objects whose
origin is the hinge or axis.
"""
import bpy
import bmesh
import math
import json
import os
import random
import numpy as np
from mathutils import Matrix, Vector

ROOT = "<your folder>/viz-canal"
ASSETS = ROOT + "/app/public/assets"
REGISTRY = ROOT + "/blender/registry.json"


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_rgb(code):
    code = code.lstrip("#")
    return tuple(srgb_to_linear(int(code[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def make_material(name, color_hex, roughness=0.7, metallic=0.0, emission_hex=None, emission_strength=0.0,
                  alpha=None, texture=None):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if texture is not None:
        image_node = material.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.image = texture
        material.node_tree.links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*hex_rgb(color_hex), 1.0)
    if emission_hex:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emission_hex), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
    return material


def noise_texture(name, color_hex, variation=0.12, size=128, blocks=16, seed=3):
    """Small procedurally baked colour texture (speckle plus faint block tint) for concrete and plate."""
    existing = bpy.data.images.get(name)
    if existing:
        return existing
    generator = np.random.default_rng(seed)
    base = np.array(hex_rgb(color_hex))
    speckle = generator.normal(0.0, variation * 0.5, (size, size, 1))
    block = generator.normal(0.0, variation, (blocks, blocks, 1))
    block = np.kron(block, np.ones((size // blocks, size // blocks, 1)))
    pixels = np.clip(base[None, None, :] * (1.0 + speckle + block), 0.0, 1.0)
    rgba = np.concatenate([pixels, np.ones((size, size, 1))], axis=2)
    image = bpy.data.images.new(name, size, size)
    image.pixels = rgba.flatten().tolist()
    image.pack()
    return image


def textured_material(name, color_hex, variation=0.12, roughness=0.85, seed=3):
    texture = noise_texture(name + "_tex", color_hex, variation, seed=seed)
    return make_material(name, color_hex, roughness=roughness, texture=texture)


class Part:
    """Accumulates boxes, cylinders and custom faces into one mesh with several material slots."""

    def __init__(self, name):
        self.name = name
        self.mesh_builder = bmesh.new()
        self.materials = []

    def slot(self, material):
        if material not in self.materials:
            self.materials.append(material)
        return self.materials.index(material)

    def _finish_primitive(self, vertices, transform, material, bevel):
        builder = self.mesh_builder
        index = self.slot(material)
        for face in {face for vertex in vertices for face in vertex.link_faces}:
            face.material_index = index
        bmesh.ops.transform(builder, matrix=transform, verts=vertices)
        if bevel > 0:
            edges = list({edge for vertex in vertices for edge in vertex.link_edges})
            result = bmesh.ops.bevel(builder, geom=edges, offset=bevel, offset_type="OFFSET", segments=2,
                                     profile=0.5, affect="EDGES")
            for face in result["faces"]:
                face.material_index = index

    def box(self, center, size, material, bevel=0.0, rot_z=0.0, rot_x=0.0, rot_y=0.0):
        created = bmesh.ops.create_cube(self.mesh_builder, size=1.0)
        scale = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        rotation = (Matrix.Rotation(rot_z, 4, "Z") @ Matrix.Rotation(rot_y, 4, "Y") @ Matrix.Rotation(rot_x, 4, "X"))
        transform = Matrix.Translation(center) @ rotation @ scale
        bevel = min(bevel, min(size) * 0.45)
        self._finish_primitive(created["verts"], transform, material, bevel)

    def cylinder(self, center, radius, depth, material, axis="Z", segments=16, bevel=0.0, radius_top=None):
        created = bmesh.ops.create_cone(self.mesh_builder, cap_ends=True, segments=segments, radius1=radius,
                                        radius2=radius if radius_top is None else radius_top, depth=depth)
        if axis == "X":
            rotation = Matrix.Rotation(math.radians(90), 4, "Y")
        elif axis == "Y":
            rotation = Matrix.Rotation(math.radians(90), 4, "X")
        else:
            rotation = Matrix.Identity(4)
        bevel = min(bevel, radius * 0.45, depth * 0.45)
        self._finish_primitive(created["verts"], Matrix.Translation(center) @ rotation, material, bevel)

    def polygon(self, points, material):
        vertices = [self.mesh_builder.verts.new(point) for point in points]
        face = self.mesh_builder.faces.new(vertices)
        face.material_index = self.slot(material)
        return face

    def prism(self, outline_xz, y_min, y_max, material, bevel=0.0):
        """Extrude a closed outline given in (x, z) between two y values (for side profiles)."""
        builder = self.mesh_builder
        front = [builder.verts.new((x, y_min, z)) for x, z in outline_xz]
        back = [builder.verts.new((x, y_max, z)) for x, z in outline_xz]
        faces = [builder.faces.new(list(reversed(front))), builder.faces.new(back)]
        count = len(outline_xz)
        for i in range(count):
            j = (i + 1) % count
            faces.append(builder.faces.new([front[i], front[j], back[j], back[i]]))
        bmesh.ops.recalc_face_normals(builder, faces=faces)
        index = self.slot(material)
        for face in faces:
            face.material_index = index

    def build(self, parent=None, location=(0, 0, 0), smooth_degrees=50, unwrap_scale=0.25):
        builder = self.mesh_builder
        bmesh.ops.remove_doubles(builder, verts=builder.verts, dist=0.0005)
        bmesh.ops.recalc_face_normals(builder, faces=builder.faces)
        builder.normal_update()
        uv_layer = builder.loops.layers.uv.new("UVMap")
        for face in builder.faces:
            normal = face.normal
            axis = max(range(3), key=lambda a: abs(normal[a]))
            for loop in face.loops:
                position = loop.vert.co
                if axis == 0:
                    coordinates = (position.y, position.z)
                elif axis == 1:
                    coordinates = (position.x, position.z)
                else:
                    coordinates = (position.x, position.y)
                loop[uv_layer].uv = (coordinates[0] * unwrap_scale, coordinates[1] * unwrap_scale)
        mesh = bpy.data.meshes.new(self.name)
        builder.to_mesh(mesh)
        builder.free()
        for material in self.materials:
            mesh.materials.append(material)
        mesh.shade_smooth()
        mesh.set_sharp_from_angle(angle=math.radians(smooth_degrees))
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent is not None:
            obj.parent = parent
        obj.location = location
        return obj


def make_root(name):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    return root


def add_clip(obj, clip_name, data_path, index, frame_values, fps=30):
    """Key one channel (rotation_euler / location index) and push it to an NLA strip named clip_name."""
    animation = obj.animation_data_create()
    action = bpy.data.actions.new(f"{clip_name}_{obj.name}")
    animation.action = action
    for frame, value in frame_values:
        getattr(obj, data_path)[index] = value
        obj.keyframe_insert(data_path=data_path, index=index, frame=frame)
    track = animation.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, int(frame_values[0][0]), action)
    strip.name = clip_name
    animation.action = None
    getattr(obj, data_path)[index] = frame_values[0][1]


def bounds_of(root):
    """World-space bounding box (min, max) of a root and all its descendant meshes."""
    bpy.context.view_layer.update()
    low = Vector((1e9, 1e9, 1e9))
    high = Vector((-1e9, -1e9, -1e9))
    stack = [root]
    while stack:
        current = stack.pop()
        stack.extend(current.children)
        if current.type != "MESH":
            continue
        for corner in current.bound_box:
            world = current.matrix_world @ Vector(corner)
            low = Vector((min(low[i], world[i]) for i in range(3)))
            high = Vector((max(high[i], world[i]) for i in range(3)))
    return low, high


def register(file_name, root, pivot, facing, clips, use, extra_nodes=None):
    """Append one table row per node to blender/registry.json with the measured size."""
    low, high = bounds_of(root)
    size = [round(high[i] - low[i], 2) for i in range(3)]
    entries = []
    if os.path.exists(REGISTRY):
        with open(REGISTRY, "r", encoding="utf-8") as handle:
            entries = json.load(handle)
    entries = [e for e in entries if not (e["file"] == file_name and e["node"] == root.name)]
    entries.append({"file": file_name, "node": root.name, "pivot": pivot, "facing": facing, "clips": clips,
                    "size_xyz_m": size, "min": [round(v, 2) for v in low], "max": [round(v, 2) for v in high],
                    "use": use})
    with open(REGISTRY, "w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=1)


def export_glb(file_name, with_animation=False):
    os.makedirs(ASSETS, exist_ok=True)
    path = f"{ASSETS}/{file_name}"
    kwargs = dict(filepath=path, export_format="GLB", export_yup=True, export_apply=True, export_cameras=False,
                  export_lights=False, use_selection=False)
    if with_animation:
        kwargs.update(export_animations=True, export_animation_mode="NLA_TRACKS")
    else:
        kwargs.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kwargs)
    size_mb = os.path.getsize(path) / 1e6
    print(f"EXPORTED {file_name} {size_mb:.2f} MB")
