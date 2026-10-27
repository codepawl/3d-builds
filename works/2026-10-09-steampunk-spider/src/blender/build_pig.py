"""Build Porkour's editable Blender model, articulated GLB, and studio preview.

All authoring coordinates use the runtime's +Y up / +Z forward convention.
Blender conversion happens in point(); exported local limb geometry is +Y long.
Run with Blender --background --python build_pig.py.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector


ASSETS = Path(__file__).resolve().parents[1] / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def point(coordinates):
    horizontal, vertical, forward = coordinates
    return Vector((horizontal, -forward, vertical))


def material(name, color, roughness=0.4):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = 0.22
    shader.inputs["Coat Roughness"].default_value = 0.25
    return result


skin = material("Peach pink porcelain", (0.92, 0.48, 0.43), 0.34)
snout_material = material("Rose snout", (0.86, 0.30, 0.34), 0.36)
ear_material = material("Warm ear velvet", (0.70, 0.21, 0.26), 0.49)
cheek_material = material("Coral cheeks", (0.98, 0.31, 0.33), 0.43)
eye_material = material("Espresso glossy eyes", (0.034, 0.017, 0.024), 0.1)
nostril_material = material("Nostril rose shadow", (0.25, 0.07, 0.10), 0.55)
hoof_material = material("Cocoa soft hooves", (0.19, 0.105, 0.12), 0.38)
white_material = material("Eye glints", (1.0, 0.94, 0.84), 0.16)


def attach(child, parent):
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def ellipsoid(name, center, radii, surface, parent=None, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    result = bpy.context.object
    result.name = name
    for vertex in result.data.vertices:
        local = vertex.co.copy()
        vertex.co = point((local.x * radii[0], local.y * radii[1], local.z * radii[2]))
    result.location = point(center)
    result.data.materials.append(surface)
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    bpy.context.view_layer.update()
    if parent:
        attach(result, parent)
    return result


def tube(name, coordinates, radius, surface, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
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
    if parent:
        attach(result, parent)
    return result


body = ellipsoid("Body", (0, 0.75, -0.20), (0.67, 0.56, 1.0), skin, segments=48, rings=32)
head = ellipsoid("Head", (0, 0.98, 0.69), (0.55, 0.49, 0.55), skin, segments=48, rings=32)
ellipsoid("Snout", (0, 0.86, 1.20), (0.30, 0.215, 0.175), snout_material, head)

for side, label in ((-1, "L"), (1, "R")):
    ellipsoid(f"Nostril_{label}", (side * 0.105, 0.88, 1.365), (0.039, 0.055, 0.014), nostril_material, head, 20, 12)
    ellipsoid(f"Eye_{label}", (side * 0.325, 1.11, 1.115), (0.086, 0.104, 0.066), eye_material, head, 28, 18)
    ellipsoid(f"Glint_{label}", (side * 0.315 - 0.018, 1.15, 1.170), (0.024, 0.027, 0.013), white_material, head, 16, 10)
    ellipsoid(f"Cheek_{label}", (side * 0.365, 0.876, 1.101), (0.078, 0.046, 0.016), cheek_material, head, 20, 12)

tube("Smile", [(-0.14, 0.703, 1.168), (-0.07, 0.666, 1.18), (0, 0.655, 1.18), (0.07, 0.666, 1.18), (0.14, 0.703, 1.168)], 0.012, nostril_material, head)


def ear(label, side):
    pivot = bpy.data.objects.new(f"Ear_{label}", None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = point((side * 0.36, 1.30, 0.62))
    bpy.context.view_layer.update()
    attach(pivot, head)
    outline = [(-0.13, 0, 0), (-0.24, 0.16, 0.015), (-0.17, 0.37, 0.09), (-0.035, 0.44, 0.14), (0.11, 0.19, 0.025), (0.14, 0.01, 0)]
    vertices = []
    for depth in (-0.05, 0.05):
        for horizontal, vertical, forward in outline:
            vertices.append(point((horizontal * -side, vertical, forward + depth)))
    vertices.extend([point((0, 0.17, -0.047)), point((0, 0.17, 0.07))])
    faces = []
    for index in range(6):
        next_index = (index + 1) % 6
        faces.append((12, next_index, index))
        faces.append((13, index + 6, next_index + 6))
        faces.append((index, next_index, next_index + 6, index + 6))
    mesh = bpy.data.meshes.new(f"Ear_{label}_Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new(f"Ear_{label}_Surface", mesh)
    bpy.context.collection.objects.link(result)
    result.parent = pivot
    result.data.materials.append(skin)
    modifier = result.modifiers.new("Soft rounded ear", "SUBSURF")
    modifier.levels = 2
    modifier.render_levels = 2
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    inset = ellipsoid(f"Ear_{label}_Inside", (0, 0, 0), (0.077, 0.145, 0.018), ear_material, segments=24, rings=16)
    inset.parent = pivot
    inset.location = point((side * 0.035, 0.17, 0.084))
    inset.rotation_euler.x = math.radians(-11)
    return pivot


ear("L", -1)
ear("R", 1)

tail = bpy.data.objects.new("Tail_0", None)
bpy.context.collection.objects.link(tail)
tail.location = point((0, 0.86, -1.11))
tail_coordinates = [(0, 0, 0), (0.025, 0.045, -0.13)]
for index in range(29):
    progress = index / 28
    angle = progress * math.pi * 2.15
    radius = 0.125 * (1 - progress * 0.38)
    tail_coordinates.append((0.025 + radius * math.sin(angle), 0.17 - radius * math.cos(angle), -0.16 - progress * 0.14))
tail_mesh = tube("Tail_Curl", tail_coordinates, 0.035, skin)
tail_mesh.parent = tail


def limb(name, position, endpoint, radius):
    result = ellipsoid(name, (0, 0, 0), (radius, 0.50, radius), skin, segments=24, rings=16)
    for vertex in result.data.vertices:
        vertex.co.z += 0.5
    displacement = point(endpoint) - point(position)
    result.location = point(position)
    result.rotation_mode = "QUATERNION"
    result.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(displacement.normalized())
    result.scale.z = displacement.length
    return result


for label, side, forward in (("FL", -1, 0.59), ("FR", 1, 0.59), ("BL", -1, -0.64), ("BR", 1, -0.64)):
    hip = (side * 0.47, 0.64, forward)
    knee = (side * 0.65, 0.35, forward - 0.08)
    ankle = (side * 0.70, 0.13, forward)
    limb(f"Leg_{label}_Upper", hip, knee, 0.15)
    limb(f"Leg_{label}_Lower", knee, ankle, 0.115)
    foot = ellipsoid(f"Foot_{label}", ankle, (0.155, 0.11, 0.18), hoof_material, segments=24, rings=16)
    for side_offset in (-0.052, 0.052):
        ellipsoid(f"Hoof_{label}_{side_offset}", (ankle[0] + side_offset, 0.105, forward + 0.105), (0.08, 0.082, 0.10), hoof_material, foot, 16, 12)


model_objects = [item for item in bpy.context.scene.objects if item.type in {"MESH", "EMPTY"}]
bpy.ops.object.select_all(action="DESELECT")
for item in model_objects:
    item.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=str(ASSETS / "pig.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False)

# Studio objects are saved in the editable file but are excluded from the GLB.
floor_material = material("Preview ivory floor", (0.71, 0.76, 0.66), 0.8)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.012))
floor = bpy.context.object
floor.name = "Preview_Floor"
floor.data.materials.append(floor_material)


def area_light(name, coordinates, energy, size):
    bpy.ops.object.light_add(type="AREA", location=point(coordinates))
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (point((0, 0.7, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()


area_light("Preview_Key", (-3, 5, 4), 500, 4)
area_light("Preview_Fill", (3, 2.5, 2), 180, 3)
area_light("Preview_Rim", (1, 4, -3), 450, 3)
bpy.ops.object.camera_add(location=point((3.5, 2.35, 5.3)))
camera = bpy.context.object
camera.name = "Preview_Camera"
camera.rotation_euler = (point((0, 0.78, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.5
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world.color = (0.24, 0.24, 0.24)
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ASSETS / "pig-preview.png")
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "pig.blend"))
bpy.ops.render.render(write_still=True)
print(f"PIG_ASSET_COMPLETE meshes={sum(item.type == 'MESH' for item in model_objects)} source_vertices={sum(len(item.data.vertices) for item in model_objects if item.type == 'MESH')}")
