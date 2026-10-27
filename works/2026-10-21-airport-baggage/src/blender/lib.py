"""Shared helpers for the baggage handling asset pack (Blender 5.x, run headless).

Every asset is built from Part objects: a bmesh that collects bevelled boxes, cylinders,
sweeps and skins, each with its own material slot, then becomes one mesh object with its
origin at the pivot. Units are metres. Flow / travel direction is Blender +X; vehicles face -Y.
"""
import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = "<your folder>/viz-baggage"
ASSET_DIR = ROOT + "/app/public/assets"
SHARP_ANGLE = math.radians(40)

_materials = {}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    bpy.context.scene.render.fps = 24
    common_materials()


def hexcolor(code):
    code = code.lstrip("#")
    channels = [int(code[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return (linear[0], linear[1], linear[2], 1.0)


PALETTE = {
    "blue": "2F6FE4", "navy": "23407A", "white": "F2F5F8", "steel": "C5CED7", "steel_dark": "6C7985",
    "concrete": "B9C0C6", "belt": "2B2F36", "rubber": "181A1D", "yellow": "F2C230", "orange": "FF6A2B",
    "green": "2FBF71", "red": "E5484D", "glass": "5A7690", "wood": "B58B5A", "teal": "1FA6A0",
    "purple": "7A5CD6", "pink": "E86FA3", "sand": "D9C7A0", "black": "101114", "lead": "3A4048",
    "alu": "AEB7BF", "tag_paper": "F7F7F2", "screen": "0F2740",
}


def mat(name, color=None, rough=0.55, metal=0.0, emit=None, emit_strength=0.0, texture=None):
    """Create (or reuse) a single-sided PBR material. `color` is a palette key or hex."""
    if name in _materials:
        return _materials[name]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    key = color or name
    base = hexcolor(PALETTE.get(key, key))
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = hexcolor(PALETTE.get(emit, emit))
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if texture is not None:
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = texture
        node.interpolation = "Closest"
        material.node_tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    _materials[name] = material
    return material


def make_belt_texture():
    """Small baked belt texture: dark rubber with fine transverse ribs and two lighter edge lines."""
    size = 64
    image = bpy.data.images.new("belt_ribs", size, size)
    pixels = []
    for row in range(size):
        for col in range(size):
            rib = 0.0 if row % 8 < 5 else 0.07
            edge = 0.10 if col < 2 or col >= size - 2 else 0.0
            level = 0.17 + rib + edge
            pixels.extend((level, level + 0.005, level + 0.015, 1.0))
    image.pixels = pixels
    image.pack()
    return image


class Part:
    """One exported mesh object collecting many primitives in a single bmesh."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.bm.loops.layers.uv.new("UVMap")
        self.slots = []

    def _slot(self, material):
        if material not in self.slots:
            self.slots.append(material)
        return self.slots.index(material)

    def _merge(self, tmp, material, matrix=None):
        if matrix is not None:
            bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
        index = self._slot(material)
        for face in tmp.faces:
            face.material_index = index
        mesh = bpy.data.meshes.new("tmp")
        tmp.to_mesh(mesh)
        tmp.free()
        self.bm.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)

    def _bevel(self, tmp, width, segments, min_angle):
        if width <= 0:
            return
        edges = [e for e in tmp.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > min_angle]
        if edges:
            bmesh.ops.bevel(tmp, geom=edges, offset=width, offset_type="OFFSET", segments=segments,
                            profile=0.5, affect="EDGES")

    def box(self, size, center, material, bevel=0.01, seg=2, rot=(0, 0, 0)):
        tmp = bmesh.new()
        tmp.loops.layers.uv.new("UVMap")
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        self._bevel(tmp, min(bevel, 0.45 * min(size)), seg, math.radians(30))
        matrix = Matrix.Translation(center) @ Euler(rot).to_matrix().to_4x4()
        self._merge(tmp, material, matrix)

    def cyl(self, radius, depth, center, material, axis="Z", segs=24, bevel=0.008, radius2=None, rot=None):
        tmp = bmesh.new()
        tmp.loops.layers.uv.new("UVMap")
        bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=segs, radius1=radius,
                              radius2=radius if radius2 is None else radius2, depth=depth)
        self._bevel(tmp, min(bevel, 0.4 * radius), 1, math.radians(30))
        if rot is None:
            rot = {"Z": (0, 0, 0), "X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0)}[axis]
        matrix = Matrix.Translation(center) @ Euler(rot).to_matrix().to_4x4()
        self._merge(tmp, material, matrix)

    def skin(self, rings, material, closed_ring=True, closed_path=False, caps=(True, True),
             bevel=0.0, seg=2, min_angle=math.radians(35)):
        """Quad skin between equal-length rings of 3D points; UVs are metres along path and ring."""
        tmp = bmesh.new()
        uv_layer = tmp.loops.layers.uv.new("UVMap")
        verts = [[tmp.verts.new(Vector(p)) for p in ring] for ring in rings]
        ring_count, point_count = len(rings), len(rings[0])
        centres = [sum((Vector(p) for p in ring), Vector()) / point_count for ring in rings]
        u_values = [0.0]
        for i in range(1, ring_count):
            u_values.append(u_values[-1] + (centres[i] - centres[i - 1]).length)
        closing = (centres[0] - centres[-1]).length
        v_values = [0.0]
        for j in range(1, point_count):
            v_values.append(v_values[-1] + (Vector(rings[0][j]) - Vector(rings[0][j - 1])).length)
        perimeter = v_values[-1] + (Vector(rings[0][0]) - Vector(rings[0][-1])).length
        for i in range(ring_count if closed_path else ring_count - 1):
            i2 = (i + 1) % ring_count
            u_start = u_values[i]
            u_end = u_values[i2] if i2 > i else u_values[-1] + closing
            for j in range(point_count if closed_ring else point_count - 1):
                j2 = (j + 1) % point_count
                v_start = v_values[j]
                v_end = v_values[j2] if j2 > j else perimeter
                face = tmp.faces.new((verts[i][j], verts[i][j2], verts[i2][j2], verts[i2][j]))
                for loop, uv in zip(face.loops, ((u_start, v_start), (u_start, v_end), (u_end, v_end), (u_end, v_start))):
                    loop[uv_layer].uv = uv
        if not closed_path:
            if caps[0]:
                tmp.faces.new(verts[0][::-1])
            if caps[1]:
                tmp.faces.new(verts[-1])
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        self._bevel(tmp, bevel, seg, min_angle)
        self._merge(tmp, material)

    def sweep(self, profile, path, material, closed_path=False, bevel=0.006, seg=1):
        """Sweep a (lateral, up) profile along a path of 3D points. Lateral is Z x tangent (left)."""
        rings = []
        count = len(path)
        for i, point in enumerate(path):
            previous = Vector(path[i - 1 if (i > 0 or closed_path) else 0])
            following = Vector(path[(i + 1) % count if (i < count - 1 or closed_path) else i])
            tangent = (following - previous).normalized()
            lateral = Vector((0, 0, 1)).cross(tangent).normalized()
            rings.append([Vector(point) + lateral * a + Vector((0, 0, b)) for a, b in profile])
        self.skin(rings, material, closed_path=closed_path, bevel=bevel, seg=seg)

    def build(self, parent=None, pivot=(0, 0, 0), name=None):
        """Turn the bmesh into an object whose origin sits at `pivot` (asset space)."""
        bm = self.bm
        uv_layer = bm.loops.layers.uv.active
        for face in bm.faces:
            face.smooth = True
            if all(abs(loop[uv_layer].uv.x) + abs(loop[uv_layer].uv.y) < 1e-9 for loop in face.loops):
                normal = face.normal
                axis = max(range(3), key=lambda k: abs(normal[k]))
                keep = [k for k in range(3) if k != axis]
                for loop in face.loops:
                    loop[uv_layer].uv = (loop.vert.co[keep[0]], loop.vert.co[keep[1]])
        for edge in bm.edges:
            if len(edge.link_faces) == 2 and edge.calc_face_angle(0.0) > SHARP_ANGLE:
                edge.smooth = False
        pivot = Vector(pivot)
        bmesh.ops.translate(bm, vec=-pivot, verts=bm.verts)
        mesh = bpy.data.meshes.new(name or self.name)
        bm.to_mesh(mesh)
        bm.free()
        for material in self.slots:
            mesh.materials.append(material)
        obj = bpy.data.objects.new(name or self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = pivot
        if parent is not None:
            bpy.context.view_layer.update()   # parent.matrix_world must be current before taking its inverse
            obj.parent = parent
            obj.matrix_parent_inverse = parent.matrix_world.inverted()
        return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.2
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def add_clip(obj, clip_name, data_path, index, keys, fps=24):
    """Key `keys` = [(frame, value), ...] on one channel and push it to its own NLA track."""
    if obj.animation_data is None:
        obj.animation_data_create()
    rest = getattr(obj, data_path)[index]
    action = bpy.data.actions.new(clip_name)
    obj.animation_data.action = action
    for frame, value in keys:
        vector = list(getattr(obj, data_path))
        vector[index] = value
        setattr(obj, data_path, vector)
        obj.keyframe_insert(data_path=data_path, index=index, frame=frame)
    vector = list(getattr(obj, data_path))
    vector[index] = rest
    setattr(obj, data_path, vector)
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, int(keys[0][0]), action)
    strip.name = clip_name
    obj.animation_data.action = None


def export_glb(filename):
    bpy.ops.object.select_all(action="SELECT")
    path = f"{ASSET_DIR}/{filename}"
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_apply=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_cameras=False, export_lights=False, export_yup=True)
    print("EXPORTED", path, round(os.path.getsize(path) / 1024), "KB")


def common_materials():
    """Materials shared by every family (so the same name always means the same look)."""
    mat("belt_rubber", "belt", rough=0.85, texture=make_belt_texture())
    mat("frame_steel", "steel", rough=0.45, metal=0.5)
    mat("guard_blue", "blue", rough=0.4)
    mat("leg_dark", "steel_dark", rough=0.6, metal=0.4)
    mat("motor_navy", "navy", rough=0.5, metal=0.3)
    mat("rubber_black", "rubber", rough=0.9)
    mat("cam_black", "black", rough=0.35)
    mat("lens_blue", "blue", rough=0.1, emit="blue", emit_strength=0.6)
    mat("panel_white", "white", rough=0.5)
    mat("safety_yellow", "yellow", rough=0.5)
    mat("alert_orange", "orange", rough=0.45)
    mat("screen_dark", "screen", rough=0.2, emit="screen", emit_strength=0.4)
    mat("tag_paper", "tag_paper", rough=0.8)
    mat("lead_grey", "lead", rough=0.7)
    mat("concrete_floor", "concrete", rough=0.95)
    mat("alu_panel", "alu", rough=0.35, metal=0.7)
    mat("glass_tint", "glass", rough=0.1, metal=0.1)
