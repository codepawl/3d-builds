"""Shared helpers for the Food Forest study: materials, props, asset import, growth geometry nodes."""
import bpy
import bmesh
import math
import os
import numpy as np
from mathutils import Vector, Matrix

ASSET_LIB = "<your folder>/assets-lib"
BACK_C1 = 1.70158
BACK_C3 = BACK_C1 + 1.0
BACK_PEAK_U = 1.0 - 2.0 * BACK_C1 / (3.0 * BACK_C3)  # u where easeOutBack overshoots most
# Growth follows smootherstep plus a soft settle: it starts as a tiny sprout and swells fastest at the middle.
GROWTH_PEAK_U = 0.5
GROWTH_SETTLE = 0.12
SWAY_AMPLITUDE = 0.035


# ----------------------------------------------------------------------------- materials
def new_material(name, color, roughness=0.5, metallic=0.0, **extra):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes["Principled BSDF"]
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    for socket_name, value in extra.items():
        socket = principled.inputs.get(socket_name.replace("_", " "))
        if socket is not None:
            socket.default_value = value
    return material


def load_image(path, non_color=False):
    image = bpy.data.images.load(path, check_existing=True)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    return image


def wood_material(name, tint, scale, rotate=0.0, saturation=1.0):
    folder = f"{ASSET_LIB}/textures/wood_table_001"
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes["Principled BSDF"]
    coordinate = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    mapping.inputs["Rotation"].default_value = (0, 0, rotate)
    links.new(coordinate.outputs["Object"], mapping.inputs["Vector"])

    def texture(file_name, non_color):
        node = nodes.new("ShaderNodeTexImage")
        node.image = load_image(f"{folder}/{file_name}", non_color)
        links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    diffuse = texture("wood_table_001_diff_2k.jpg", False)
    roughness = texture("wood_table_001_rough_2k.jpg", True)
    normal_image = texture("wood_table_001_nor_gl_2k.jpg", True)
    tint_node = nodes.new("ShaderNodeMix")
    tint_node.data_type = "RGBA"
    tint_node.blend_type = "MULTIPLY"
    tint_node.inputs[0].default_value = 1.0
    tint_node.inputs[7].default_value = (*tint, 1.0)
    links.new(diffuse.outputs["Color"], tint_node.inputs[6])
    desaturate = nodes.new("ShaderNodeHueSaturation")
    desaturate.inputs["Saturation"].default_value = saturation
    links.new(tint_node.outputs[2], desaturate.inputs["Color"])
    links.new(desaturate.outputs["Color"], principled.inputs["Base Color"])
    links.new(roughness.outputs["Color"], principled.inputs["Roughness"])
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(normal_image.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    principled.inputs["Coat Weight"].default_value = 0.08
    return material


def glass_material(name, ior=1.45, color=(1.0, 1.0, 1.0)):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.remove(nodes["Principled BSDF"])
    clear = nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (*color, 1.0)
    gloss = nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.03
    mixer = nodes.new("ShaderNodeMixShader")
    mixer.inputs[0].default_value = 0.12
    material.node_tree.links.new(clear.outputs[0], mixer.inputs[1])
    material.node_tree.links.new(gloss.outputs[0], mixer.inputs[2])
    material.node_tree.links.new(mixer.outputs[0], nodes["Material Output"].inputs["Surface"])
    return material


def graph_paper_material():
    """Cream paper, orange 1 mm grid, heavier 10 mm lines; object coordinates are metres."""
    material = bpy.data.materials.new("graph_paper")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes["Principled BSDF"]
    principled.inputs["Roughness"].default_value = 0.75
    coordinate = nodes.new("ShaderNodeTexCoord")
    to_mm = nodes.new("ShaderNodeVectorMath")
    to_mm.operation = "SCALE"
    to_mm.inputs["Scale"].default_value = 1000.0
    links.new(coordinate.outputs["Object"], to_mm.inputs[0])
    separate = nodes.new("ShaderNodeSeparateXYZ")
    links.new(to_mm.outputs[0], separate.inputs[0])

    def math_node(operation, a, b=None, clamp=False):
        node = nodes.new("ShaderNodeMath")
        node.operation = operation
        node.use_clamp = clamp
        for index, value in enumerate((a, b)):
            if value is None:
                continue
            if isinstance(value, (int, float)):
                node.inputs[index].default_value = value
            else:
                links.new(value, node.inputs[index])
        return node.outputs[0]

    def line_mask(axis_socket, period, half_width):
        scaled = math_node("DIVIDE", axis_socket, period)
        fraction = math_node("FRACT", scaled)
        distance = math_node("ABSOLUTE", math_node("SUBTRACT", fraction, 0.5))  # 0.5 at line centre fraction=0 or 1
        edge_distance = math_node("SUBTRACT", 0.5, distance)  # 0 at line centre
        width = half_width / period
        return math_node("SUBTRACT", 1.0, math_node("DIVIDE", edge_distance, width, clamp=True))

    fine = math_node("MAXIMUM", line_mask(separate.outputs["X"], 1.0, 0.11), line_mask(separate.outputs["Y"], 1.0, 0.11))
    medium = math_node("MAXIMUM", line_mask(separate.outputs["X"], 5.0, 0.15), line_mask(separate.outputs["Y"], 5.0, 0.15))
    heavy = math_node("MAXIMUM", line_mask(separate.outputs["X"], 10.0, 0.25), line_mask(separate.outputs["Y"], 10.0, 0.25))
    strength = math_node("ADD", math_node("MULTIPLY", fine, 0.6), math_node("MULTIPLY", medium, 0.3))
    strength = math_node("ADD", strength, math_node("MULTIPLY", heavy, 1.0), clamp=True)
    mixer = nodes.new("ShaderNodeMix")
    mixer.data_type = "RGBA"
    mixer.inputs[6].default_value = (0.80, 0.68, 0.50, 1.0)
    mixer.inputs[7].default_value = (0.85, 0.33, 0.07, 1.0)
    links.new(strength, mixer.inputs[0])
    links.new(mixer.outputs[2], principled.inputs["Base Color"])
    return material


def tint_foliage(material, saturation=1.25, value=1.0, multiply=(1.0, 0.97, 0.78)):
    node_tree = material.node_tree
    principled = next((n for n in node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if principled is None or not principled.inputs["Base Color"].links:
        return None
    source = principled.inputs["Base Color"].links[0].from_socket
    hue_node = node_tree.nodes.new("ShaderNodeHueSaturation")
    hue_node.inputs["Saturation"].default_value = saturation
    hue_node.inputs["Value"].default_value = value
    node_tree.links.new(source, hue_node.inputs["Color"])
    multiplier = node_tree.nodes.new("ShaderNodeMix")
    multiplier.data_type = "RGBA"
    multiplier.blend_type = "MULTIPLY"
    multiplier.inputs[0].default_value = 1.0
    multiplier.inputs[7].default_value = (*multiply, 1.0)
    node_tree.links.new(hue_node.outputs["Color"], multiplier.inputs[6])
    node_tree.links.new(multiplier.outputs[2], principled.inputs["Base Color"])
    node_tree.links.new(multiplier.outputs[2], principled.inputs["Emission Color"])
    principled.inputs["Emission Strength"].default_value = 0.35
    return multiplier


def make_autumn_copy(material, start_seconds, end_seconds):
    """Copy of a tinted foliage material whose hue slides green to gold between the two clip times."""
    autumn = material.copy()
    autumn.name = material.name + "_autumn"
    node_tree = autumn.node_tree
    principled = next(n for n in node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if not principled.inputs["Base Color"].links:
        return autumn
    source = principled.inputs["Base Color"].links[0].from_socket
    shift = node_tree.nodes.new("ShaderNodeHueSaturation")
    node_tree.links.new(source, shift.inputs["Color"])
    node_tree.links.new(shift.outputs["Color"], principled.inputs["Base Color"])
    node_tree.links.new(shift.outputs["Color"], principled.inputs["Emission Color"])
    progress = f"min(max((frame/30-{start_seconds})/{end_seconds - start_seconds},0),1)"
    for socket_name, expression in (
        ("Hue", f"0.53-0.11*{progress}"),
        ("Saturation", f"0.95+0.3*{progress}"),
        ("Value", f"0.9+0.45*{progress}"),
    ):
        driver = shift.inputs[socket_name].driver_add("default_value").driver
        driver.type = "SCRIPTED"
        driver.expression = expression
    return autumn


# ----------------------------------------------------------------------------- meshes
def link_object(obj, collection):
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh_object(name, mesh, collection, material=None, smooth=True, location=(0, 0, 0), rotation=(0, 0, 0)):
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    if material is not None:
        mesh.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def lathe_mesh(name, profile, segments=72):
    """Surface of revolution around Z from a list of (radius, z) points."""
    bm = bmesh.new()
    rings = []
    for radius, height in profile:
        ring = []
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            ring.append(bm.verts.new((radius * math.cos(angle), radius * math.sin(angle), height)))
        rings.append(ring)
    for ring_index in range(len(rings) - 1):
        for index in range(segments):
            next_index = (index + 1) % segments
            quad = (rings[ring_index][index], rings[ring_index][next_index],
                    rings[ring_index + 1][next_index], rings[ring_index + 1][index])
            try:
                bm.faces.new(quad)
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def box_mesh(name, size):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def cylinder_mesh(name, radius_bottom, radius_top, length, segments=24, base_at_zero=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius_bottom, radius2=radius_top, depth=length)
    if base_at_zero:
        bmesh.ops.translate(bm, vec=(0, 0, length / 2), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def sphere_mesh(name, radius, scale=(1, 1, 1), segments=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2, radius=radius)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def torus_mesh(name, major, minor, major_segments=48, minor_segments=10):
    bm = bmesh.new()
    rings = []
    for i in range(major_segments):
        theta = 2 * math.pi * i / major_segments
        ring = []
        for j in range(minor_segments):
            phi = 2 * math.pi * j / minor_segments
            radius = major + minor * math.cos(phi)
            ring.append(bm.verts.new((radius * math.cos(theta), radius * math.sin(theta), minor * math.sin(phi))))
        rings.append(ring)
    for i in range(major_segments):
        for j in range(minor_segments):
            bm.faces.new((rings[i][j], rings[(i + 1) % major_segments][j],
                          rings[(i + 1) % major_segments][(j + 1) % minor_segments], rings[i][(j + 1) % minor_segments]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def poly_curve(name, points, bevel, collection, material, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinates in zip(spline.points, points):
        point.co = (*coordinates, 1.0)
    spline.use_cyclic_u = cyclic
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    return obj


def steel_material(name="steel", color=(0.62, 0.64, 0.67), roughness=0.28):
    return new_material(name, color, roughness, 1.0)


def build_pencil(name, collection, copper, rubber, steel, length=0.15):
    """Mechanical drafting pencil along +Z with the lead tip at the origin."""
    parts = [
        (cylinder_mesh(name + "_lead", 0.00035, 0.00035, 0.004), steel, 0.0),
        (cylinder_mesh(name + "_cone", 0.0008, 0.0026, 0.012), steel, 0.004),
        (cylinder_mesh(name + "_collar", 0.0034, 0.0034, 0.004), steel, 0.016),
        (cylinder_mesh(name + "_body", 0.0041, 0.0041, length - 0.02), copper, 0.020),
        (cylinder_mesh(name + "_grip", 0.0043, 0.0043, 0.020), rubber, 0.07),
        (cylinder_mesh(name + "_cap", 0.0030, 0.0030, 0.008), steel, length),
    ]
    root = bpy.data.objects.new(name, None)
    collection.objects.link(root)
    for mesh, material, z in parts:
        part = mesh_object(mesh.name, mesh, collection, material, location=(0, 0, z))
        part.parent = root
    return root


# ----------------------------------------------------------------------------- assets
def import_asset(name, target_height, collection, variants_keep=None):
    """Import a Poly Haven glTF, bake transforms, set origin at the base centre, scale so the mean
    object height equals target_height, and link every mesh into collection. Returns the objects."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{ASSET_LIB}/models/{name}/{name}_2k.gltf")
    new_objects = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new_objects if o.type == "MESH"]
    bounds = []
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        count = len(obj.data.vertices)
        coordinates = np.empty(count * 3, dtype=np.float32)
        obj.data.vertices.foreach_get("co", coordinates)
        coordinates = coordinates.reshape(-1, 3)
        low = coordinates.min(axis=0)
        high = coordinates.max(axis=0)
        bounds.append((obj, coordinates, low, high))
    mean_height = float(np.mean([high[2] - low[2] for _, _, low, high in bounds]))
    factor = target_height / max(mean_height, 1e-6)
    result = []
    for obj, coordinates, low, high in bounds:
        base = np.array([(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, low[2]], dtype=np.float32)
        coordinates = (coordinates - base) * factor
        obj.data.vertices.foreach_set("co", coordinates.reshape(-1))
        obj.data.update()
        obj.name = f"{name}.{len(result):02d}"
        link_object(obj, collection)
        result.append(obj)
    for obj in new_objects:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj)
    return result


# ----------------------------------------------------------------------------- growth geometry nodes
def build_growth_group(name, collection):
    """Instances points with per-point start time, duration, size, yaw, tilt, kind and xy lag.
    Scale follows smootherstep with a soft settle from scene time; points before their start are deleted."""
    group = bpy.data.node_groups.new(name, "GeometryNodeTree")
    group.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes = group.nodes
    links = group.links
    group_input = nodes.new("NodeGroupInput")
    group_output = nodes.new("NodeGroupOutput")
    scene_time = nodes.new("GeometryNodeInputSceneTime")
    seconds = scene_time.outputs["Seconds"]

    def attribute(attribute_name, data_type="FLOAT"):
        node = nodes.new("GeometryNodeInputNamedAttribute")
        node.data_type = data_type
        node.inputs["Name"].default_value = attribute_name
        return node.outputs["Attribute"]

    def math(operation, a, b=None, clamp=False):
        node = nodes.new("ShaderNodeMath")
        node.operation = operation
        node.use_clamp = clamp
        for index, value in enumerate((a, b)):
            if value is None:
                continue
            if isinstance(value, (int, float)):
                node.inputs[index].default_value = value
            else:
                links.new(value, node.inputs[index])
        return node.outputs[0]

    start = attribute("start")
    duration = attribute("dur")
    size = attribute("size")
    yaw = attribute("yaw")
    tilt = attribute("tilt")
    lag = attribute("lag")
    kind = attribute("kind", "INT")

    def eased(with_lag):
        elapsed = math("SUBTRACT", seconds, start)
        if with_lag:
            elapsed = math("SUBTRACT", elapsed, math("MULTIPLY", lag, duration))
        progress = math("DIVIDE", elapsed, duration, clamp=True)
        # smootherstep: p^3 * (p * (6p - 15) + 10)
        inner = math("ADD", math("MULTIPLY", progress, math("SUBTRACT", math("MULTIPLY", progress, 6.0), 15.0)), 10.0)
        smoother = math("MULTIPLY", math("MULTIPLY", math("MULTIPLY", progress, progress), progress), inner)
        # Soft settle: a small swell late in the growth that returns to 1 at the end.
        swell = math("SINE", math("MULTIPLY", progress, 3.14159265))
        settle = math("MULTIPLY", math("MULTIPLY", swell, math("MULTIPLY", progress, progress)), GROWTH_SETTLE)
        return math("ADD", smoother, settle)

    height_growth = eased(False)
    width_growth = eased(True)
    # Width never goes below a thin stalk so a young plant is a thin shoot first.
    width_scale = math("MULTIPLY", size, width_growth)
    height_scale = math("MULTIPLY", size, height_growth)

    before_start = nodes.new("FunctionNodeCompare")
    before_start.data_type = "FLOAT"
    before_start.operation = "LESS_THAN"
    links.new(seconds, before_start.inputs[0])
    links.new(start, before_start.inputs[1])
    delete = nodes.new("GeometryNodeDeleteGeometry")
    delete.domain = "POINT"
    links.new(group_input.outputs[0], delete.inputs["Geometry"])
    links.new(before_start.outputs["Result"], delete.inputs["Selection"])

    scale_vector = nodes.new("ShaderNodeCombineXYZ")
    links.new(width_scale, scale_vector.inputs["X"])
    links.new(width_scale, scale_vector.inputs["Y"])
    links.new(height_scale, scale_vector.inputs["Z"])
    # A slow breeze keeps every plant moving after it has grown.
    breeze_x = math("MULTIPLY", math("SINE", math("ADD", math("MULTIPLY", seconds, 1.6), math("MULTIPLY", yaw, 3.0))), SWAY_AMPLITUDE)
    breeze_y = math("MULTIPLY", math("SINE", math("ADD", math("MULTIPLY", seconds, 1.1), yaw)), SWAY_AMPLITUDE * 0.6)
    euler = nodes.new("ShaderNodeCombineXYZ")
    links.new(math("ADD", tilt, breeze_x), euler.inputs["X"])
    links.new(breeze_y, euler.inputs["Y"])
    links.new(yaw, euler.inputs["Z"])
    rotation = nodes.new("FunctionNodeEulerToRotation")
    links.new(euler.outputs["Vector"], rotation.inputs["Euler"])
    collection_info = nodes.new("GeometryNodeCollectionInfo")
    collection_info.inputs["Collection"].default_value = collection
    collection_info.inputs["Separate Children"].default_value = True
    collection_info.inputs["Reset Children"].default_value = True
    instancer = nodes.new("GeometryNodeInstanceOnPoints")
    instancer.inputs["Pick Instance"].default_value = True
    links.new(group_input.outputs[0], instancer.inputs["Points"])
    links.new(collection_info.outputs["Instances"], instancer.inputs["Instance"])
    links.new(kind, instancer.inputs["Instance Index"])
    links.new(rotation.outputs["Rotation"], instancer.inputs["Rotation"])
    links.new(scale_vector.outputs["Vector"], instancer.inputs["Scale"])
    links.new(instancer.outputs["Instances"], group_output.inputs[0])
    return group


def build_leaf_fall_group(name, collection):
    """Falling leaves: each point has start, life, drift (vx, vy), phase, fall speed."""
    group = bpy.data.node_groups.new(name, "GeometryNodeTree")
    group.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes = group.nodes
    links = group.links
    group_input = nodes.new("NodeGroupInput")
    group_output = nodes.new("NodeGroupOutput")
    seconds = nodes.new("GeometryNodeInputSceneTime").outputs["Seconds"]

    def attribute(attribute_name):
        node = nodes.new("GeometryNodeInputNamedAttribute")
        node.data_type = "FLOAT"
        node.inputs["Name"].default_value = attribute_name
        return node.outputs["Attribute"]

    def math(operation, a, b=None, clamp=False):
        node = nodes.new("ShaderNodeMath")
        node.operation = operation
        node.use_clamp = clamp
        for index, value in enumerate((a, b)):
            if value is None:
                continue
            if isinstance(value, (int, float)):
                node.inputs[index].default_value = value
            else:
                links.new(value, node.inputs[index])
        return node.outputs[0]

    start = attribute("start")
    life = attribute("life")
    vx = attribute("vx")
    vy = attribute("vy")
    phase = attribute("phase")
    fall = attribute("fall")
    age = math("SUBTRACT", seconds, start)
    outside = nodes.new("FunctionNodeBooleanMath")
    outside.operation = "OR"
    too_early = nodes.new("FunctionNodeCompare")
    too_early.data_type = "FLOAT"
    too_early.operation = "LESS_THAN"
    links.new(age, too_early.inputs[0])
    too_early.inputs[1].default_value = 0.0
    too_late = nodes.new("FunctionNodeCompare")
    too_late.data_type = "FLOAT"
    too_late.operation = "GREATER_THAN"
    links.new(age, too_late.inputs[0])
    links.new(life, too_late.inputs[1])
    links.new(too_early.outputs["Result"], outside.inputs[0])
    links.new(too_late.outputs["Result"], outside.inputs[1])
    delete = nodes.new("GeometryNodeDeleteGeometry")
    delete.domain = "POINT"
    links.new(group_input.outputs[0], delete.inputs["Geometry"])
    links.new(outside.outputs["Boolean"], delete.inputs["Selection"])

    sway = math("MULTIPLY", math("SINE", math("ADD", math("MULTIPLY", age, 3.0), phase)), 0.008)
    offset = nodes.new("ShaderNodeCombineXYZ")
    links.new(math("ADD", math("MULTIPLY", vx, age), sway), offset.inputs["X"])
    links.new(math("MULTIPLY", vy, age), offset.inputs["Y"])
    links.new(math("MULTIPLY", math("MULTIPLY", fall, age), -1.0), offset.inputs["Z"])
    move = nodes.new("GeometryNodeSetPosition")
    links.new(group_input.outputs[0], move.inputs["Geometry"])
    links.new(offset.outputs["Vector"], move.inputs["Offset"])

    spin = nodes.new("ShaderNodeCombineXYZ")
    links.new(math("ADD", math("MULTIPLY", age, 4.0), phase), spin.inputs["X"])
    links.new(math("MULTIPLY", age, 2.5), spin.inputs["Y"])
    links.new(math("MULTIPLY", age, 5.0), spin.inputs["Z"])
    rotation = nodes.new("FunctionNodeEulerToRotation")
    links.new(spin.outputs["Vector"], rotation.inputs["Euler"])
    collection_info = nodes.new("GeometryNodeCollectionInfo")
    collection_info.inputs["Collection"].default_value = collection
    collection_info.inputs["Separate Children"].default_value = True
    collection_info.inputs["Reset Children"].default_value = True
    instancer = nodes.new("GeometryNodeInstanceOnPoints")
    instancer.inputs["Pick Instance"].default_value = True
    links.new(move.outputs["Geometry"], instancer.inputs["Points"])
    links.new(collection_info.outputs["Instances"], instancer.inputs["Instance"])
    links.new(rotation.outputs["Rotation"], instancer.inputs["Rotation"])
    visible = math("SUBTRACT", 1.0, outside.outputs["Boolean"])
    visible_scale = nodes.new("ShaderNodeCombineXYZ")
    for axis in ("X", "Y", "Z"):
        links.new(visible, visible_scale.inputs[axis])
    links.new(visible_scale.outputs["Vector"], instancer.inputs["Scale"])
    links.new(instancer.outputs["Instances"], group_output.inputs[0])
    return group


def make_emitter(name, points, collection, group, float_names, int_names=("kind",)):
    """points: list of dicts with 'pos' plus the named attributes. Returns the emitter object."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([p["pos"] for p in points], [], [])
    for attribute_name in float_names:
        attribute = mesh.attributes.new(name=attribute_name, type="FLOAT", domain="POINT")
        attribute.data.foreach_set("value", [float(p.get(attribute_name, 0.0)) for p in points])
    for attribute_name in int_names:
        attribute = mesh.attributes.new(name=attribute_name, type="INT", domain="POINT")
        attribute.data.foreach_set("value", [int(p.get(attribute_name, 0)) for p in points])
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    modifier = obj.modifiers.new("growth", "NODES")
    modifier.node_group = group
    return obj
