"""Render each main asset alone at real size next to a 1.75 m figure, from the side and from the front
three-quarter, for the reference-versus-render compare sheets (compose_compare.py adds the photos).
Usage: blender --background --factory-startup --python compare_render.py"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from preview import ASSETS, PREVIEWS, bounds, clear_scene, configure_render, render_view  # noqa: E402

# asset sheet name -> (glb, root node)
MAIN_ASSETS = {
    "coaster_train": ("coaster.glb", "coaster_train_a"),
    "coaster_track": ("coaster.glb", "coaster_track"),
    "ferris_wheel": ("rides.glb", "ferris_wheel"),
    "carousel": ("rides.glb", "carousel"),
    "log_flume": ("flume.glb", "flume_log_a"),
    "monorail": ("transport.glb", "monorail_car_lead"),
    "castle": ("buildings.glb", "castle"),
    "dark_ride": ("buildings.glb", "showhouse_temple"),
    "food_stand": ("stands.glb", "stand_kiosk_a"),
    "parking_tram": ("transport.glb", "tram_trailer"),
    "utility_cart": ("transport.glb", "maint_cart_box"),
    "parade_float": ("transport.glb", "float_carriage"),
    "people": ("people.glb", "staff_operator"),
}
VIEWS = {"side": Vector((1.0, 0.0, 0.08)), "three_quarter": Vector((0.75, -1.0, 0.45))}


def figure(height, x):
    """Grey 1.75 m person stand-in for scale."""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=height, location=(0, x, height / 2))
    stand_in = bpy.context.active_object
    stand_in.name = "scale_figure"
    return stand_in


def render_asset(sheet, glb, root_name):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / glb))
    bpy.context.scene.frame_set(0)
    keep = bpy.data.objects.get(root_name)
    if keep is None:
        print(f"Error: {root_name} missing in {glb}")
        return
    keep_set = {keep} | set(keep.children_recursive)
    for obj in list(bpy.context.scene.objects):
        if obj not in keep_set:
            bpy.data.objects.remove(obj, do_unlink=True)
    for mat in bpy.data.materials:
        shader = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if shader:
            red, green, blue, _ = shader.inputs["Base Color"].default_value
            mat.diffuse_color = (red ** (1 / 2.2), green ** (1 / 2.2), blue ** (1 / 2.2), 1.0)
    # Roots sit at spread-out positions in their files; bring the asset next to the scale figure.
    keep.location = (0, 0, 0)
    bpy.context.view_layer.update()
    corners = bounds(keep)
    low_y = min(corner.y for corner in corners)
    figure(1.75, low_y - 0.6)
    bpy.context.view_layer.update()
    corners = [corner for obj in bpy.context.scene.objects if obj.type == "MESH" for corner in
               (obj.matrix_world @ Vector(c) for c in obj.bound_box)]
    size = max(max(c[i] for c in corners) - min(c[i] for c in corners) for i in range(3))
    for view, direction in VIEWS.items():
        render_view(direction, corners, size, PREVIEWS / f"_compare_{sheet}_{view}.png")
    print(f"rendered compare {sheet}")


def main():
    configure_render()
    bpy.context.scene.display.shading.show_backface_culling = False
    for sheet, (glb, root_name) in MAIN_ASSETS.items():
        render_asset(sheet, glb, root_name)


main()
