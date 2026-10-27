"""Renders one model from an app GLB as a slow arc on a dark studio floor.

blender --background --factory-startup --python turntable.py -- <glb> <objectName> <outDir> [frames] [arcDegrees] [startDegrees]
Frames are written as JPEG sequence 0000.jpg ... at 1920x1080.
"""
import math
import sys

import bpy
from mathutils import Vector

glb_path, object_name, out_dir = sys.argv[sys.argv.index("--") + 1:][:3]
extra = sys.argv[sys.argv.index("--") + 4:]
frame_count = int(extra[0]) if len(extra) > 0 else 108
arc_degrees = float(extra[1]) if len(extra) > 1 else 180.0
start_degrees = float(extra[2]) if len(extra) > 2 else 20.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb_path)

# Keep only the requested model (and its children); everything else in the file is deleted.
target = bpy.data.objects[object_name]
keep = {target} | set(target.children_recursive)
for obj in list(bpy.data.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.update()


def world_bounds(objects):
    corners = []
    for obj in objects:
        if obj.type == "MESH":
            corners += [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    high = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return low, high


low, high = world_bounds(keep)
center = (low + high) / 2
size = high - low

# Pivot at the footprint centre, resting on the floor at z = 0.
pivot = bpy.data.objects.new("pivot", None)
bpy.context.scene.collection.objects.link(pivot)
pivot.location = Vector((center.x, center.y, low.z))
bpy.context.view_layer.update()
target.parent = pivot
target.matrix_parent_inverse = pivot.matrix_world.inverted()
pivot.location = Vector((0, 0, 0))
bpy.context.view_layer.update()
height = size.z
radius = math.hypot(size.x, size.y) / 2

# Floor and world.
scene = bpy.context.scene
world = bpy.data.worlds.new("studio")
world.use_nodes = True
background = world.node_tree.nodes["Background"]
background.inputs[0].default_value = (0.0035, 0.004, 0.006, 1)
background.inputs[1].default_value = 1.0
scene.world = world

bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
floor = bpy.context.object
floor_material = bpy.data.materials.new("floor")
floor_material.use_nodes = True
nodes = floor_material.node_tree.nodes
links = floor_material.node_tree.links
floor_shader = nodes["Principled BSDF"]
floor_shader.inputs["Roughness"].default_value = 0.42
# Radial fade: dark graphite under the model, melting into the black world with distance (no horizon line).
fade_start = max(radius, height / 2)
coordinates = nodes.new("ShaderNodeTexCoord")
distance_node = nodes.new("ShaderNodeVectorMath")
distance_node.operation = "LENGTH"
links.new(coordinates.outputs["Object"], distance_node.inputs[0])
fade = nodes.new("ShaderNodeMapRange")
fade.inputs["From Min"].default_value = fade_start * 0.9
fade.inputs["From Max"].default_value = fade_start * 3.6
fade.inputs["To Min"].default_value = 1.0
fade.inputs["To Max"].default_value = 0.0
fade.clamp = True
links.new(distance_node.outputs["Value"], fade.inputs["Value"])
tint = nodes.new("ShaderNodeMix")
tint.data_type = "RGBA"
tint.inputs["A"].default_value = (0.0035, 0.004, 0.006, 1)
tint.inputs["B"].default_value = (0.05, 0.056, 0.07, 1)
links.new(fade.outputs["Result"], tint.inputs["Factor"])
links.new(tint.outputs["Result"], floor_shader.inputs["Base Color"])
# Far floor loses its sheen too: grazing reflections of the lights were drawing a bright horizon band.
sheen = nodes.new("ShaderNodeMath")
sheen.operation = "MULTIPLY"
sheen.inputs[1].default_value = 0.5
links.new(fade.outputs["Result"], sheen.inputs[0])
links.new(sheen.outputs["Value"], floor_shader.inputs["Specular IOR Level"])
floor.data.materials.append(floor_material)


def add_area_light(name, location, energy, color, size_meters):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.size = size_meters
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    direction = Vector((0, 0, height * 0.45)) - Vector(location)
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return light


span = max(radius, height / 1.4)
add_area_light("key", (-2.2 * span, -2.6 * span, 2.4 * span + height * 0.4), 170 * span ** 2, (1.0, 0.92, 0.80), 2.2 * span)
add_area_light("rim_right", (2.6 * span, 2.8 * span, 1.4 * span + height * 0.5), 260 * span ** 2, (0.55, 0.72, 1.0), 1.6 * span)
add_area_light("rim_left", (-3.0 * span, 2.4 * span, 1.0 * span + height * 0.5), 130 * span ** 2, (0.75, 0.80, 1.0), 1.6 * span)
add_area_light("fill", (2.8 * span, -3.0 * span, 0.6 * span), 22 * span ** 2, (1.0, 0.95, 0.9), 3.0 * span)

# Camera: three-quarter view, a little above the model.
camera_data = bpy.data.cameras.new("camera")
camera_data.lens = 55
camera_data.sensor_width = 36
camera = bpy.data.objects.new("camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
horizontal_half = math.atan(18 / camera_data.lens)
vertical_half = math.atan(10.125 / camera_data.lens)
distance = max(radius / math.tan(horizontal_half), (height / 2) / math.tan(vertical_half) * 1.15) + radius * 0.3
elevation = math.radians(13)
look_at = Vector((0, 0, height * 0.46))
camera.location = look_at + Vector((0, -distance * math.cos(elevation), distance * math.sin(elevation)))
camera.rotation_euler = (look_at - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.dof.use_dof = False

# Render settings.
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 95
eevee = scene.eevee
eevee.taa_render_samples = 48
for name, value in (("use_raytracing", True), ("use_shadows", True)):
    if hasattr(eevee, name):
        setattr(eevee, name, value)
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast" if "AgX - Medium High Contrast" in [item.identifier for item in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"

for frame in range(frame_count):
    progress = frame / (frame_count - 1)
    smooth = progress  # constant angular speed reads as a turntable
    pivot.rotation_euler = (0, 0, math.radians(start_degrees + arc_degrees * smooth))
    scene.render.filepath = f"{out_dir}/{frame:04d}.jpg"
    bpy.ops.render.render(write_still=True)
print("done", object_name)
