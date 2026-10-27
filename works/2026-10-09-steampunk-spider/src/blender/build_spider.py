"""Reference-sheet arachnid: six legs, 2.8 m tall, 4.5 m width/depth.

Authoring coordinates are +Y up/+Z front. Each animated link has its proximal
pivot at local origin and its distal axis endpoint at +Y=1. Vertex colors store
procedural rust and chipped paint directly in GLB, without external textures.
"""

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

ASSETS = Path(__file__).resolve().parents[1] / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
random.seed(941)


def point(coordinates):
    horizontal, vertical, forward = coordinates
    return Vector((horizontal, -forward, vertical))


def material(name, color, roughness=0.65, metallic=0.6, emission=0, weathered=False):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if weathered:
        attribute = result.node_tree.nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "WearColor"
        result.node_tree.links.new(attribute.outputs["Color"], shader.inputs["Base Color"])
        result["weather_color"] = color
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = emission
    return result


armor = material("Chipped blue charcoal armor", (0.095, 0.13, 0.17), 0.83, 0.48, weathered=True)
iron = material("Battered dark iron", (0.060, 0.062, 0.059), 0.77, 0.60, weathered=True)
bronze = material("Corroded bronze fittings", (0.30, 0.19, 0.08), 0.71, 0.64, weathered=True)
black = material("Oiled dark cable and seams", (0.014, 0.012, 0.010), 0.78, 0.12)
amber = material("Small recessed amber lens", (0.65, 0.27, 0.009), 0.35, 0.10, 1.25)
red = material("Dim red diagnostics", (0.60, 0.009, 0.002), 0.35, 0.08, 1.1)


def finish(result, name, surface, smooth=False):
    result.name = name
    result.data.materials.append(surface)
    for polygon in result.data.polygons:
        polygon.use_smooth = smooth
    bpy.context.view_layer.update()
    return result


def mesh_object(name, vertices, faces, surface, smooth=False):
    geometry = bpy.data.meshes.new(f"{name}_Geometry")
    geometry.from_pydata([point(vertex) for vertex in vertices], [], faces)
    geometry.update()
    result = bpy.data.objects.new(name, geometry)
    bpy.context.collection.objects.link(result)
    return finish(result, name, surface, smooth)


def ellipsoid(name, center, radii, surface, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    result = bpy.context.object
    for vertex in result.data.vertices:
        local = vertex.co.copy()
        vertex.co = point((local.x * radii[0], local.y * radii[1], local.z * radii[2]))
    result.location = point(center)
    return finish(result, name, surface, True)


def box(name, center, radii, surface):
    bpy.ops.mesh.primitive_cube_add(size=2)
    result = bpy.context.object
    for vertex in result.data.vertices:
        vertex.co.x *= radii[0]
        vertex.co.y *= radii[2]
        vertex.co.z *= radii[1]
    result.location = point(center)
    return finish(result, name, surface)


def cylinder(name, start, end, radius, surface, sides=12):
    displacement = point(end) - point(start)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=displacement.length)
    result = bpy.context.object
    result.location = (point(start) + point(end)) * 0.5
    result.rotation_mode = "QUATERNION"
    result.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(displacement.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(result, name, surface)


def spike(name, start, end, radius, surface):
    displacement = point(end) - point(start)
    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=radius, radius2=0.004, depth=displacement.length)
    result = bpy.context.object
    result.location = (point(start) + point(end)) * 0.5
    result.rotation_mode = "QUATERNION"
    result.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(displacement.normalized())
    return finish(result, name, surface)


def hose(name, coordinates, radius=0.018, surface=black):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 7
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(coordinates) - 1)
    for control, coordinate in zip(spline.bezier_points, coordinates):
        control.co = point(coordinate)
        control.handle_left_type = "AUTO"
        control.handle_right_type = "AUTO"
    result = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(surface)
    bpy.ops.object.select_all(action="DESELECT")
    result.select_set(True)
    bpy.context.view_layer.objects.active = result
    bpy.ops.object.convert(target="MESH")
    return result


def torus(name, center, major_radius, minor_radius, surface, vertical=True):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=24, minor_segments=6)
    result = bpy.context.object
    result.location = point(center)
    if vertical:
        result.rotation_euler.x = math.pi / 2
    return finish(result, name, surface)


def combine(primary, details):
    bpy.ops.object.select_all(action="DESELECT")
    primary.select_set(True)
    for detail in details:
        detail.select_set(True)
    bpy.context.view_layer.objects.active = primary
    bpy.ops.object.join()


def shell_point(latitude, longitude, offset=0):
    dent = 0.030 * math.sin(longitude * 7 + latitude * 9) + 0.014 * math.sin(longitude * 13 - latitude * 4)
    radial = 1 + offset + dent
    return (0.68 * radial * math.sin(latitude) * math.cos(longitude), 2.01 + 0.59 * radial * math.cos(latitude), -0.10 + 0.78 * radial * math.sin(latitude) * math.sin(longitude))


body = ellipsoid("Body", (0, 2.01, -0.10), (0.647, 0.565, 0.749), iron, 32, 24)
body_details = []
latitude_rows = [0, 0.43, 0.86, 1.32, 1.84]
longitude_grid = [[index * math.tau / 9 + (0 if row == 0 else random.uniform(-0.12, 0.12)) for index in range(10)] for row in range(5)]
latitude_grid = [[latitude + (0 if row == 0 else random.uniform(-0.17, 0.17)) for column in range(10)] for row, latitude in enumerate(latitude_rows)]
for row in range(4):
    for column in range(9):
        vertices = []
        faces = []
        subdivisions = 10
        plate_offset = random.uniform(0.001, 0.025)
        for vertical_step in range(subdivisions + 1):
            progress = vertical_step / subdivisions
            left = longitude_grid[row][column] * (1 - progress) + longitude_grid[row + 1][column] * progress
            right = longitude_grid[row][column + 1] * (1 - progress) + longitude_grid[row + 1][column + 1] * progress
            for horizontal_step in range(subdivisions + 1):
                angular_progress = horizontal_step / subdivisions
                upper_latitude = latitude_grid[row][column] * (1 - angular_progress) + latitude_grid[row][column + 1] * angular_progress
                lower_latitude = latitude_grid[row + 1][column] * (1 - angular_progress) + latitude_grid[row + 1][column + 1] * angular_progress
                latitude = upper_latitude + 0.018 + (lower_latitude - upper_latitude - 0.033) * progress
                longitude = left + 0.02 + (right - left - 0.043) * angular_progress
                vertices.append(shell_point(latitude, longitude, plate_offset))
        for vertical_step in range(subdivisions):
            for horizontal_step in range(subdivisions):
                first = vertical_step * (subdivisions + 1) + horizontal_step
                faces.append((first, first + 1, first + subdivisions + 2, first + subdivisions + 1))
        panel = mesh_object("Irregular dented armor panel", vertices, faces, armor, True)
        modifier = panel.modifiers.new("Ragged thick plate", "SOLIDIFY")
        modifier.thickness = 0.016
        bpy.context.view_layer.objects.active = panel
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        body_details.append(panel)
        edge_points = [shell_point(latitude_grid[row + 1][column] + (latitude_grid[row + 1][column + 1] - latitude_grid[row + 1][column]) * progress / 5, longitude_grid[row + 1][column] + (longitude_grid[row + 1][column + 1] - longitude_grid[row + 1][column]) * progress / 5, plate_offset) for progress in range(6)]
        body_details.append(hose("Dark irregular plate edge", edge_points, 0.008))
        for progress in (0.15, 0.75):
            rivet_latitude = latitude_grid[row + 1][column] + (latitude_grid[row + 1][column + 1] - latitude_grid[row + 1][column]) * progress - 0.026
            rivet = shell_point(rivet_latitude, left + (right - left) * progress, plate_offset + 0.008)
            body_details.append(ellipsoid("Rusty plate rivet", rivet, (0.014, 0.014, 0.014), bronze, 10, 6))

body_details.append(spike("Top dorsal barb", (0, 2.565, -0.11), (0.025, 2.80, -0.17), 0.045, armor))
for latitude, longitude in [(0.65, 0.1), (0.75, 2.8), (1.05, 0.30), (1.10, 2.60), (1.45, 0), (1.48, math.pi), (0.58, 4.65), (1.12, 4.45), (1.39, 5.05)]:
    start = shell_point(latitude, longitude, 0.025)
    normal = Vector((math.sin(latitude) * math.cos(longitude), math.cos(latitude), math.sin(latitude) * math.sin(longitude)))
    end = tuple(start[index] + normal[index] * random.uniform(0.10, 0.17) for index in range(3))
    body_details.append(spike("Uneven shell horn", start, end, 0.043, armor))

# An irregular vaulted front lip shades the recessed gear, like the reference helmet.
brow_vertices = []
for depth in (0.57, 0.80):
    for radius in (0.30, 0.40):
        for index in range(13):
            angle = 0.07 + index / 12 * (math.pi - 0.14)
            irregular_radius = radius + 0.014 * math.sin(angle * 7)
            brow_vertices.append((irregular_radius * math.cos(angle), 1.65 + irregular_radius * math.sin(angle), depth - 0.03 * math.sin(angle)))
brow_faces = []
for index in range(12):
    brow_faces.extend([(index, index + 1, index + 14, index + 13), (index + 26, index + 39, index + 40, index + 27), (index + 13, index + 14, index + 40, index + 39), (index, index + 26, index + 27, index + 1)])
brow_faces.extend([(0, 13, 39, 26), (12, 38, 51, 25)])
body_details.append(mesh_object("Overhanging irregular helmet brow", brow_vertices, brow_faces, armor, True))

# Narrow vertical mechanism supports the large shell; no broad delivery chassis.
body_details.append(cylinder("Vertical torso crankcase", (0, 0.84, -0.03), (0, 1.48, -0.03), 0.16, iron, 18))
for height in (0.90, 1.08, 1.33, 1.50):
    body_details.append(torus("Bronze torso bearing", (0, height, -0.03), 0.19, 0.035, bronze, False))
for side in (-1, 1):
    body_details.append(cylinder("Shell lift piston", (side * 0.13, 1.10, -0.22), (side * 0.25, 1.78, -0.32), 0.038, bronze))
    body_details.append(cylinder("Shell lift rod", (side * 0.25, 1.52, -0.32), (side * 0.30, 1.86, -0.37), 0.016, iron))
    for height in (1.10, 1.38):
        body_details.append(cylinder("Torso lateral gearbox", (side * 0.12, height, 0.08), (side * 0.25, height, 0.08), 0.10, iron))
        body_details.append(cylinder("Gearbox brass cap", (side * 0.25, height, 0.08), (side * 0.27, height, 0.08), 0.067, bronze))
        body_details.append(ellipsoid("Torso red status", (side * 0.24, height + 0.07, 0.11), (0.018, 0.018, 0.018), red, 10, 6))
    for forward in (0.36, 0, -0.36):
        body_details.append(cylinder("Hip mechanical root", (side * 0.08, 1.04, forward * 0.8), (side * 0.38, 1.04, forward), 0.064, iron))
        body_details.append(cylinder("Hip bronze bearing", (side * 0.31, 1.04, forward), (side * 0.40, 1.04, forward), 0.080, bronze))
    body_details.append(hose("Side curled bronze fitting", [(side * 0.47, 1.94, -0.35), (side * 0.65, 1.78, -0.40), (side * 0.63, 1.52, -0.25), (side * 0.47, 1.50, -0.14), (side * 0.43, 1.68, -0.21)], 0.021, bronze))
    body_details.append(cylinder("Short battered exhaust", (side * 0.35, 2.29, -0.65), (side * 0.35, 2.51, -0.65), 0.042, iron))
    body_details.append(torus("Exhaust rim", (side * 0.35, 2.51, -0.65), 0.043, 0.009, bronze, False))

for index, horizontal in enumerate((-0.23, -0.13, -0.025, 0.085, 0.20)):
    forward = 0.14 + index * 0.025
    radius = (0.024, 0.035, 0.027, 0.039, 0.024)[index]
    strand = hose(f"Strand_{index}", [(horizontal, 1.51, forward), (horizontal + 0.045 * math.sin(index), 1.10, forward + 0.025), (horizontal - 0.05 * math.cos(index), 0.56, forward + 0.06), (horizontal * 1.20, 0.14, forward + 0.16), (horizontal * 1.50, radius, 0.52), (horizontal * 1.70 + 0.04 * index, radius, 0.81 + index * 0.09)], radius, bronze)
    collars = []
    for height in (0.52, 0.89, 1.27):
        collars.append(cylinder("Pipe crimp collar", (horizontal, height, forward), (horizontal, height + 0.035, forward), radius * 1.22, iron))
    combine(strand, collars)
body_details.append(hose("Dark loose engine cable", [(0.27, 1.49, 0.24), (0.36, 0.91, 0.27), (0.10, 0.77, 0.36), (-0.17, 1.02, 0.30), (-0.22, 1.43, 0.27)], 0.023))
for horizontal, vertical, forward, radius in [(-0.11, 1.35, 0.31, 0.095), (0.10, 1.23, 0.34, 0.082), (0.01, 1.03, 0.33, 0.10)]:
    body_details.append(torus("Exposed torso reduction gear", (horizontal, vertical, forward), radius, 0.014, bronze))
    body_details.append(cylinder("Torso gear center axle", (horizontal, vertical, forward - 0.05), (horizontal, vertical, forward + 0.02), radius * 0.42, iron, 8))
    for index in range(12):
        angle = index * math.tau / 12
        tooth = box("Exposed torso gear tooth", (horizontal + radius * math.cos(angle), vertical + radius * math.sin(angle), forward), (0.010, 0.019, 0.018), bronze)
        tooth.rotation_euler.y = -angle + math.pi / 2
        body_details.append(tooth)
combine(body, body_details)

# Recessed eye is a small light deep within a larger ornate concentric mechanism.
head = torus("Head", (0, 1.76, 0.62), 0.272, 0.032, iron)
head_details = []
for radius, depth, thickness, surface in [(0.245, 0.645, 0.024, bronze), (0.184, 0.681, 0.021, iron), (0.154, 0.711, 0.020, bronze), (0.102, 0.743, 0.012, iron)]:
    head_details.append(torus("Concentric recessed optic gear", (0, 1.76, depth), radius, thickness, surface))
head_details.append(ellipsoid("Small amber optical lens", (0, 1.76, 0.754), (0.055, 0.055, 0.012), amber, 28, 18))
for index in range(24):
    angle = index * math.tau / 24
    radius = 0.232 if index % 3 else 0.253
    tooth = box("Uneven bronze optical gear tooth", (radius * math.cos(angle), 1.76 + radius * math.sin(angle), 0.682), (0.015, 0.032 if index % 3 else 0.043, 0.018), bronze)
    tooth.rotation_euler.y = -angle + math.pi / 2
    head_details.append(tooth)
    if index % 3 == 0:
        head_details.append(cylinder("Optic retaining bolt", (0.278 * math.cos(angle), 1.76 + 0.278 * math.sin(angle), 0.632), (0.278 * math.cos(angle), 1.76 + 0.278 * math.sin(angle), 0.66), 0.017, bronze, 6))
for side in (-1, 1):
    head_details.append(hose("Curled optical copper fitting", [(side * 0.18, 1.59, 0.64), (side * 0.25, 1.46, 0.71), (side * 0.17, 1.40, 0.73), (side * 0.12, 1.49, 0.72), (side * 0.15, 1.54, 0.68)], 0.020, bronze))
    head_details.append(hose("Curved optic feed pipe", [(side * 0.12, 1.51, 0.68), (side * 0.21, 1.32, 0.64), (side * 0.24, 1.22, 0.52), (side * 0.13, 1.36, 0.46)], 0.017, bronze))
combine(head, head_details)
head.location += point((0, -0.11, -0.10))


def hinge(center, radius, nominal_length):
    details = []
    for width, hinge_radius, surface in ((0.073, radius, iron), (0.083, radius * 0.65, bronze)):
        bearing = cylinder("Sculpted revolute bearing", (-width, center, 0), (width, center, 0), hinge_radius, surface, 14)
        for vertex in bearing.data.vertices:
            vertex.co.z /= nominal_length
        details.append(bearing)
    for side in (-1, 1):
        details.append(cylinder("Axle hex fastener", (side * 0.084, center, 0), (side * 0.100, center, 0), radius * 0.32, iron, 6))
        for index in range(7):
            angle = index * math.tau / 7
            details.append(box("Knee bearing gear tooth", (side * 0.083, center + math.cos(angle) * radius * 0.81 / nominal_length, math.sin(angle) * radius * 0.81), (0.014, 0.012 / nominal_length, 0.013), bronze))
    return details


def leg_segment(name, start, end, nominal_length, kind):
    width = 0.063 if kind == "Lower" else 0.069
    outline = [(-width, 0), (width, 0), (width * 1.50, 0.18), (width * 0.72, 0.32), (width * 0.28, 0.58), (width * 0.86, 0.78), (width * 0.70, 1), (-width * 0.70, 1), (-width * 1.68, 0.75), (-width * 1.22, 0.58), (-width * 0.62, 0.34), (-width * 1.78, 0.16)]
    if kind == "Lower":
        outline = [(horizontal + math.sin(vertical * math.pi) * 0.06, vertical) for horizontal, vertical in outline]
    vertices = [(horizontal, vertical, depth) for depth in (-0.030, 0.030) for horizontal, vertical in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, next_index + count, index + count))
    result = mesh_object(name, vertices, faces, armor)
    details = hinge(0, 0.090, nominal_length)
    details.extend(hinge(1, 0.079, nominal_length))
    details.append(cylinder("Slender hydraulic cylinder", (-0.047, 0.13, 0.053), (-0.017, 0.58, 0.054), 0.024, bronze))
    details.append(cylinder("Offset piston shaft", (-0.017, 0.56, 0.054), (0.037, 0.86, 0.054), 0.011, iron))
    details.append(hose("External twisted linkage hose", [(-0.064, 0.07, -0.035), (-0.113, 0.36, -0.057), (-0.098, 0.68, -0.043), (-0.054, 0.97, -0.035)], 0.012, bronze))
    if kind == "Upper":
        details.append(spike("Angular hooked knee spur", (0.045, 0.93, 0), (0.132, 1.11, -0.009), 0.033, armor))
    for height in (0.42, 0.54, 0.68):
        details.append(box("Uneven armor weld seam", (0.015, height, 0.035), (0.045, 0.008, 0.008), iron))
    combine(result, details)
    displacement = point(end) - point(start)
    result.location = point(start)
    result.rotation_mode = "QUATERNION"
    result.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(displacement.normalized())
    result.scale.z = displacement.length
    return result


def knee_position(shoulder, ankle):
    displacement = Vector(ankle) - Vector(shoulder)
    distance = displacement.length
    direction = displacement / distance
    projection = (1.05 ** 2 - 1.50 ** 2 + distance ** 2) / (2 * distance)
    height = math.sqrt(1.05 ** 2 - projection ** 2)
    bend = Vector((0, 1, 0)) - direction * direction.y
    return Vector(shoulder) + direction * projection + bend.normalized() * height


for side, label in ((-1, "L"), (1, "R")):
    for index, forward in enumerate((1, 0, -1)):
        hip = (side * 0.38, 1.04, forward * 0.36)
        shoulder = (side * (0.68 if forward else 0.78), 1.08 if forward else 1.04, forward * 0.62)
        ankle = (side * (1.50 if forward else 2.05), 0.25, forward * 2.05)
        knee = knee_position(shoulder, ankle)
        leg_segment(f"Leg_{label}{index}_Coxa", hip, shoulder, 0.40, "Coxa")
        leg_segment(f"Leg_{label}{index}_Upper", shoulder, knee, 1.05, "Upper")
        leg_segment(f"Leg_{label}{index}_Lower", knee, ankle, 1.50, "Lower")
        foot = mesh_object(f"Foot_{label}{index}", [(-0.044, 0, -0.031), (0.044, 0, -0.031), (0.055, -0.12, 0.025), (-0.055, -0.12, 0.025), (-0.039, -0.21, 0.072), (0.039, -0.21, 0.072), (0.025, -0.25, 0.13), (-0.025, -0.25, 0.13), (0, -0.25, 0.20), (0, -0.15, 0.12)], [(0, 1, 2, 3), (3, 2, 5, 4), (4, 5, 6, 7), (7, 6, 8), (0, 3, 4, 7, 8, 9), (1, 9, 8, 6, 5, 2), (0, 9, 1)], armor)
        foot_details = hinge(0, 0.070, 1)
        foot_details.append(cylinder("Talon ankle piston", (0, -0.025, -0.053), (0, -0.16, 0.02), 0.015, bronze))
        combine(foot, foot_details)
        foot.location = point(ankle)
        foot.rotation_euler.z = 0 if forward == 1 else math.pi if forward == -1 else side * math.pi / 2


def apply_weather_colors(item):
    attribute = item.data.color_attributes.new(name="WearColor", type="FLOAT_COLOR", domain="CORNER")
    item.data.color_attributes.active_color = attribute
    for polygon in item.data.polygons:
        surface = item.data.materials[polygon.material_index]
        base = surface.get("weather_color")
        for loop_index in polygon.loop_indices:
            if base is None:
                attribute.data[loop_index].color = (1, 1, 1, 1)
                continue
            vertex = item.data.vertices[item.data.loops[loop_index].vertex_index]
            coordinate = vertex.co + item.location
            cloud = noise.noise_vector(coordinate * 16.0).x
            grain = noise.noise_vector(coordinate * 73.0).y
            rust = max(0, min(0.91, (cloud - 0.07) * 6.5))
            rust_color = (0.23, 0.087, 0.033) if surface != bronze else (0.17, 0.09, 0.039)
            brightness = 0.77 + grain * 0.24
            color = tuple(max(0.006, (base[channel] * (1 - rust) + rust_color[channel] * rust) * brightness) for channel in range(3))
            attribute.data[loop_index].color = (*color, 1)


# Ground hoses rest on the floor, and the dorsal tip respects the sheet height.
for vertex in body.data.vertices:
    world_height = vertex.co.z + body.location.z
    vertex.co.z = max(0, min(2.8, world_height)) - body.location.z
body.data.update()

model_objects = [item for item in bpy.context.scene.objects if item.type == "MESH"]
for item in model_objects:
    apply_weather_colors(item)
bpy.ops.object.select_all(action="DESELECT")
for item in model_objects:
    item.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=str(ASSETS / "spider.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False)

floor_material = material("Neutral reference studio floor", (0.31, 0.29, 0.255), 0.88, 0)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.003))
floor = bpy.context.object
floor.name = "Preview_Floor"
floor.data.materials.append(floor_material)


def area_light(name, coordinates, energy, size):
    bpy.ops.object.light_add(type="AREA", location=point(coordinates))
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.size = size
    light.rotation_euler = (point((0, 1.5, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()


area_light("Preview_Key", (-4, 6, 5), 700, 5)
area_light("Preview_Fill", (4, 3, 4), 330, 4)
area_light("Preview_Rim", (2, 5, -4), 900, 4)


def camera(name, coordinates, target):
    bpy.ops.object.camera_add(location=point(coordinates))
    result = bpy.context.object
    result.name = name
    result.rotation_euler = (point(target) - result.location).to_track_quat("-Z", "Y").to_euler()
    result.data.type = "ORTHO"
    result.data.ortho_scale = 5.9
    return result


front_camera = camera("Preview_Front_Camera", (0, 1.50, 8), (0, 1.38, 0))
camera("Preview_Isometric_Camera", (5.5, 3.4, 7), (0, 1.38, 0))
scene = bpy.context.scene
scene.camera = front_camera
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world.color = (0.20, 0.20, 0.20)
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ASSETS / "spider-preview.png")
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "spider.blend"))
if "--no-preview" not in sys.argv:
    bpy.ops.render.render(write_still=True)
print(f"SIX_LEG_ASSET_COMPLETE meshes={len(model_objects)} source_vertices={sum(len(item.data.vertices) for item in model_objects)}")
