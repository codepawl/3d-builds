"""Shared modelling helpers for the launch-site asset scripts (adapted from the ATC and Groundline packs).

Every helper takes coordinates in the app's space, three.js style: x to the side, y up and
z forward (models face +z and sit on y = 0). `point()` converts that to Blender's z-up space,
and the glTF exporter (export_yup) converts it back, so what is written here is what the app sees.
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


ASSETS = Path(__file__).resolve().parent.parent / "app" / "public" / "assets"
SHARP_ANGLE = math.radians(40)


def point(x, up, forward):
    return Vector((x, -forward, up))


def reset_scene():
    # Reloading factory settings from inside a running script crashes the depsgraph, so the
    # default objects are removed instead.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    MATERIALS.clear()


# --- materials -------------------------------------------------------------------------------

MATERIALS = {}


def srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_color(text):
    text = text.lstrip("#")
    return tuple(srgb_to_linear(int(text[index:index + 2], 16) / 255) for index in (0, 2, 4)) + (1.0,)


def material(name, color, roughness=0.6, metallic=0.0, emission=None, strength=0.0):
    """One Principled material per name. Names starting with `glow_` are lamps the app blooms,
    `livery` is recoloured per airline and `paint` takes a per-instance colour."""
    if name in MATERIALS:
        return MATERIALS[name]
    created = bpy.data.materials.new(name)
    created.use_nodes = True
    shader = created.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = hex_color(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = hex_color(emission)
        shader.inputs["Emission Strength"].default_value = strength
    MATERIALS[name] = created
    return created


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# --- primitives ------------------------------------------------------------------------------

def bevel(obj, width, segments=3):
    if width <= 0:
        return obj
    modifier = obj.modifiers.new("bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(35)
    modifier.harden_normals = False
    return obj


def _new_object(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def box(name, size, center, mat, round_by=0.06, segments=3):
    """Axis-aligned box; size is (x, up, forward) and round_by the bevel radius."""
    size_x, size_up, size_forward = size
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(size_x, size_forward, size_up), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    assign(obj, mat)
    return bevel(obj, min(round_by, min(size) * 0.48), segments)


def cylinder(name, radius, length, center, mat, axis="up", sides=20, round_by=0.0, radius_end=None):
    """Cylinder or cone along `axis` ('x', 'up' or 'forward'), centred on `center`."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=sides,
        radius1=radius, radius2=radius if radius_end is None else radius_end, depth=length,
    )
    if axis == "x":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif axis == "forward":
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    assign(obj, mat)
    return bevel(obj, round_by)


def sphere(name, radius, center, mat, scale=(1, 1, 1), segments=16):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=max(6, segments // 2), radius=radius)
    scale_x, scale_up, scale_forward = scale
    bmesh.ops.scale(bm, vec=(scale_x, scale_forward, scale_up), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    return assign(obj, mat)


def app_center(face):
    """A bmesh face centre as (x, up, forward) in app coordinates."""
    center = face.calc_center_median()
    return center.x, center.z, -center.y


def loft(name, sections, mat, sides=24, axis="forward", material_for_face=None, x=0.0, keep_face=None):
    """Skin a tube through elliptical rings.

    Each section is (position, radius_x, radius_other, offset_up): along `forward` the ring lies in
    the x/up plane, raised by offset_up; along `up` it lies in the x/forward plane. A zero radius
    closes the end in a point, otherwise ends are capped flat.
    `material_for_face(center_x, center_up, center_forward)` may return a slot index per face.
    """
    bm = bmesh.new()
    rings = []
    for position, radius_x, radius_other, offset in sections:
        if radius_x == 0 and radius_other == 0:
            location = point(x, offset, position) if axis == "forward" else point(x, position, offset)
            rings.append([bm.verts.new(location)])
            continue
        ring = []
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            across = radius_x * math.cos(angle)
            other = radius_other * math.sin(angle)
            if axis == "forward":
                ring.append(bm.verts.new(point(x + across, offset + other, position)))
            else:
                ring.append(bm.verts.new(point(x + across, position, offset + other)))
        rings.append(ring)
    for first, second in zip(rings, rings[1:]):
        if len(first) == 1 and len(second) == 1:
            continue
        for index in range(sides):
            following = (index + 1) % sides
            if len(first) == 1:
                bm.faces.new((first[0], second[following], second[index]))
            elif len(second) == 1:
                bm.faces.new((first[index], first[following], second[0]))
            else:
                bm.faces.new((first[index], first[following], second[following], second[index]))
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        if len(ring) > 1:
            face = bm.faces.new(ring)
            if flip:
                face.normal_flip()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if keep_face:
        dropped = [face for face in bm.faces if not keep_face(*app_center(face))]
        bmesh.ops.delete(bm, geom=dropped, context="FACES")
    if material_for_face:
        for face in bm.faces:
            face.material_index = material_for_face(*app_center(face))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    if isinstance(mat, (list, tuple)):
        for slot in mat:
            obj.data.materials.append(slot)
    else:
        assign(obj, mat)
    return obj


def slab(name, outline, thickness, mat, plane="flat", center=(0, 0, 0), round_by=0.05, taper_span=None, taper=0.0):
    """Extrude a polygon. `flat`: outline in (x, forward), thickness upwards.
    `side`: outline in (forward, up), thickness across x. `front`: outline in (x, up), thickness
    along forward. All are centred on their mid-plane.
    With `taper_span`, a flat slab thins towards |x| = taper_span by the `taper` fraction."""
    bm = bmesh.new()
    if plane == "flat":
        bottom = [bm.verts.new(point(x, -thickness / 2, forward)) for x, forward in outline]
        top = [bm.verts.new(point(x, thickness / 2, forward)) for x, forward in outline]
    elif plane == "front":
        bottom = [bm.verts.new(point(x, up, -thickness / 2)) for x, up in outline]
        top = [bm.verts.new(point(x, up, thickness / 2)) for x, up in outline]
    else:
        bottom = [bm.verts.new(point(-thickness / 2, up, forward)) for forward, up in outline]
        top = [bm.verts.new(point(thickness / 2, up, forward)) for forward, up in outline]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    count = len(outline)
    for index in range(count):
        following = (index + 1) % count
        bm.faces.new((bottom[index], bottom[following], top[following], top[index]))
    if taper_span:
        for vert in bm.verts:
            factor = 1 - taper * min(1.0, abs(vert.co.x) / taper_span)
            vert.co.z *= factor
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    assign(obj, mat)
    return bevel(obj, round_by)


def cut_loft(name, sections, mat, keep, sides=40):
    """A loft trimmed to the faces where keep(center_x, center_up, center_forward) is true,
    used for skin patches laid just outside a fuselage (windshield, door outlines)."""
    # Trimmed inside the bmesh: tagging faces with a missing material slot and deleting them later
    # does not work, because assigning the material resets every face to slot 0.
    return loft(name, sections, mat, sides=sides, keep_face=keep)


def turn(obj, axis, angle):
    """Rotate an object about its own origin around an app axis ('x', 'up', 'forward')."""
    blender_axis = {"x": Vector((1, 0, 0)), "up": Vector((0, 0, 1)), "forward": Vector((0, -1, 0))}[axis]
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Matrix.Rotation(angle, 4, blender_axis).to_quaternion() @ obj.rotation_quaternion
    return obj


def mirror_x(objects):
    """Copies of the objects reflected across x = 0 (with their modifiers)."""
    bpy.context.view_layer.update()
    copies = []
    for source in objects:
        copy = source.copy()
        copy.data = source.data.copy()
        bpy.context.scene.collection.objects.link(copy)
        copy.matrix_world = Matrix.Scale(-1, 4, Vector((1, 0, 0))) @ source.matrix_world
        copies.append(copy)
    return copies


# --- assembling ------------------------------------------------------------------------------

def combine(name, objects, origin=(0, 0, 0), parent=None):
    """Bake modifiers and transforms of `objects` into one mesh whose origin is `origin`
    (app coordinates), smooth shaded with sharp edges above 40 degrees. Sources are removed.
    A source tagged with paint(obj, colour) carries that colour as a vertex colour, so parts that
    differ only in colour can share one material and one draw call."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    origin_matrix = Matrix.Translation(-point(*origin))
    bm = bmesh.new()
    slots = []
    painted_ranges = []
    for source in objects:
        evaluated = source.evaluated_get(depsgraph)
        temporary = evaluated.to_mesh()
        matrix = origin_matrix @ source.matrix_world
        temporary.transform(matrix)
        if matrix.determinant() < 0:
            temporary.flip_normals()
        remap = []
        for evaluated_slot in temporary.materials:
            # to_mesh() lists the depsgraph's evaluated copies; storing those crashes Blender.
            slot = evaluated_slot.original
            if slot not in slots:
                slots.append(slot)
            remap.append(slots.index(slot))
        face_count = len(bm.faces)
        bm.from_mesh(temporary)
        bm.faces.ensure_lookup_table()
        for face in bm.faces[face_count:]:
            face.material_index = remap[face.material_index] if remap else 0
        painted_ranges.append((face_count, len(bm.faces), source.get("paint")))
        evaluated.to_mesh_clear()
    if any(colour for _, _, colour in painted_ranges):
        layer = bm.loops.layers.float_color.new("Color")
        for start, end, colour in painted_ranges:
            value = hex_color(colour) if colour else (1.0, 1.0, 1.0, 1.0)
            for face in bm.faces[start:end]:
                for loop in face.loops:
                    loop[layer] = value
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if "Color" in mesh.color_attributes:
        # The exporter writes the active colour attribute; a new one is not active by itself.
        mesh.color_attributes.active_color = mesh.color_attributes["Color"]
        mesh.attributes.default_color_name = "Color"
    for slot in slots:
        mesh.materials.append(slot)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.set_sharp_from_angle(angle=SHARP_ANGLE)
    for source in objects:
        bpy.data.objects.remove(source, do_unlink=True)
    obj = _new_object(name, mesh)
    obj.location = point(*origin)
    if parent:
        attach(obj, parent)
    return obj


def world_location(obj):
    """World position in a hierarchy of unrotated parents, without waiting for a depsgraph update."""
    location = obj.location.copy()
    while obj.parent:
        obj = obj.parent
        location += obj.location
    return location


def attach(obj, parent):
    """Parent `obj` keeping its world position; the helpers never rotate a parent."""
    location = obj.location.copy()
    obj.parent = parent
    obj.location = location - world_location(parent)
    return obj


def root(name, location=(0, 0, 0)):
    """An empty that groups one asset (or variant) in the exported scene."""
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = point(*location)
    return empty


def anchor(name, location, parent):
    """A named empty the app reads to place decals or attach things."""
    return attach(root(name, location), parent)


def unwrap_all():
    """Smart-project UVs on every mesh so the materials can take textures later."""
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.data.polygons:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")


def paint(obj, colour):
    """Tag an object with a vertex colour for combine(); its material should be white."""
    obj["paint"] = colour
    return obj


def export(file_name, animations=None):
    """Write every object to a GLB; `animations` is a glTF animation mode such as "NLA_TRACKS"."""
    unwrap_all()
    ASSETS.mkdir(parents=True, exist_ok=True)
    target = ASSETS / file_name
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", export_yup=True, export_apply=True,
        export_animations=bool(animations), export_animation_mode=animations or "ACTIONS", export_cameras=False, export_lights=False,
        export_vertex_color="ACTIVE",
    )
    triangles = sum(sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
                    for obj in bpy.context.scene.objects if obj.type == "MESH")
    print(f"exported {target.name}: {target.stat().st_size / 1024:.0f} KB, {triangles} triangles")


# --- shared parts ----------------------------------------------------------------------------

TYRE = "#2d323b"
HUB = "#c3c9d3"


def wheel(name, radius, width, center, parent, bolts=5):
    """Tyre with a rounded shoulder, hub and bolts; a separate object spinning about x.
    Tyre and hub share one material and differ by vertex colour (one draw call per wheel)."""
    shared = material("wheel", "#ffffff", roughness=0.6, metallic=0.25)
    parts = [
        paint(cylinder(f"{name}_tyre", radius, width, center, shared, axis="x", sides=24, round_by=width * 0.32), TYRE),
        paint(cylinder(f"{name}_hub", radius * 0.58, width * 1.04, center, shared, axis="x", sides=18, round_by=width * 0.08), HUB),
        paint(cylinder(f"{name}_cap", radius * 0.2, width * 1.12, center, shared, axis="x", sides=10), HUB),
    ]
    x, up, forward = center
    for index in range(bolts):
        angle = 2 * math.pi * index / bolts
        parts.append(cylinder(
            f"{name}_bolt{index}", radius * 0.05, width * 1.1,
            (x, up + math.sin(angle) * radius * 0.36, forward + math.cos(angle) * radius * 0.36),
            shared, axis="x", sides=6,
        ))
        paint(parts[-1], HUB)
    return combine(name, parts, origin=center, parent=parent)


def rod(name, start, end, radius, mat, sides=4):
    """A thin cylinder from `start` to `end` (app coordinates), for stays, wires and bolts."""
    start_point = point(*start)
    end_point = point(*end)
    obj = cylinder(name, radius, (end_point - start_point).length, (0, 0, 0), mat, sides=sides)
    obj.location = (start_point + end_point) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(end_point - start_point)
    return obj


def torus(name, major_radius, minor_radius, center, mat, segments=48, sides=8):
    """A ring lying flat (around the up axis), for glow rings and rails."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for segment in range(segments):
        around = 2 * math.pi * segment / segments
        ring = []
        for side in range(sides):
            tube = 2 * math.pi * side / sides
            reach = major_radius + minor_radius * math.cos(tube)
            ring.append(bm.verts.new(point(reach * math.sin(around), minor_radius * math.sin(tube), reach * math.cos(around))))
        rings.append(ring)
    for segment in range(segments):
        current = rings[segment]
        following = rings[(segment + 1) % segments]
        for side in range(sides):
            next_side = (side + 1) % sides
            bm.faces.new((current[side], current[next_side], following[next_side], following[side]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    return assign(obj, mat)
