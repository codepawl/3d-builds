"""Entry point: blender --background --factory-startup --python blender/build_assets.py

Writes public/assets/site.glb, pines.glb, mountains.glb and layout.json.
"""
import json
import math
import os
import sys
import time

import bpy

SCRIPT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIRECTORY)

import foliage_textures  # noqa: E402
import lib_materials  # noqa: E402
import nature  # noqa: E402
import site_buildings  # noqa: E402
import site_ground  # noqa: E402
import site_layout  # noqa: E402
from lib_mesh import MeshBuilder  # noqa: E402

OUTPUT_DIRECTORY = os.path.join(os.path.dirname(SCRIPT_DIRECTORY), "public", "assets")

CAMERA_PATH_BLENDER = [
    (-1.2, -9.6),
    (-0.7, -7.2),
    (2.2, -6.3),
    (5.0, -4.2),
    (6.7, -0.9),
    (7.3, 2.0),
    (7.9, 4.3),
    (8.1, 5.4),
]


def clear_scene():
    for scene_object in list(bpy.data.objects):
        bpy.data.objects.remove(scene_object, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def export_glb(file_name):
    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIRECTORY, file_name)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_yup=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_image_format="AUTO",
        export_normals=True,
        export_tangents=False,
        export_cameras=False,
        export_lights=False,
    )
    print(f"exported {output_path} {os.path.getsize(output_path) / 1e6:.2f} MB")


def to_three(x_value, y_value, z_value):
    """Blender Z-up to three.js Y-up."""
    return [round(x_value, 4), round(z_value, 4), round(-y_value, 4)]


def build_site(materials):
    builder = MeshBuilder("site")
    site_ground.build_inner_terrain(builder)
    site_ground.build_outer_terrain(builder)
    site_ground.build_rim_rocks(builder)
    site_ground.build_snow_piles(builder)
    site_ground.build_shrubs(builder)
    site_buildings.build_deck(builder)
    site_buildings.build_ryokan(builder)
    lantern_light = site_buildings.build_stone_lantern(builder)
    site_buildings.build_bamboo_spout(builder)
    site_buildings.build_fence(builder)
    site_buildings.build_props(builder)
    builder.build_objects(materials)
    return lantern_light


def build_pines(materials):
    variants = (
        ("pine_a", 101, 16, 8, 2, True, 6),
        ("pine_b", 202, 14, 7, 2, True, 6),
        ("pine_far", 303, 11, 7, 1, False, 3),
        ("pine_distant", 404, 7, 5, 0, False, 2),
    )
    for variant_name, seed, tiers, branches, side_fronds, snow_clumps, frond_segments in variants:
        builder = MeshBuilder(variant_name)
        nature.build_pine(builder, seed, tiers, branches, side_fronds, snow_clumps, frond_segments)
        builder.build_objects(materials)


def build_mountains(materials):
    builder = MeshBuilder("mountains")
    nature.build_mountains(builder)
    builder.build_objects(materials)


def write_layout(lantern_light):
    keep_out = [
        (site_layout.RYOKAN_LEFT_X - 2.5, site_layout.DECK_MIN_Y, max(site_layout.RYOKAN_RIGHT_X, site_layout.DECK_MAX_X) + 2.5, site_layout.RYOKAN_BACK_Y + 2.0),
        (-6.5, -5.5, 6.5, 4.5),
        (site_layout.FENCE_X - 0.6, site_layout.FENCE_MIN_Y, site_layout.FENCE_X + 0.6, site_layout.FENCE_MAX_Y),
    ]
    near_pines, far_pines = nature.scatter_pines(CAMERA_PATH_BLENDER, keep_out, site_layout.ground_height)

    def path_point(point):
        x_value, y_value = point
        inside_deck = site_layout.DECK_MIN_X < x_value < site_layout.DECK_MAX_X and site_layout.DECK_MIN_Y < y_value < site_layout.DECK_MAX_Y
        floor = site_layout.DECK_TOP if inside_deck else site_layout.ground_height(x_value, y_value)
        return to_three(x_value, y_value, floor)

    def pine_entry(pine):
        x_value, y_value, z_value, rotation, scale, variant = pine
        return {"position": to_three(x_value, y_value, z_value), "rotation": round(rotation, 3), "scale": round(scale, 3), "variant": variant}

    spout_end = site_layout.SPOUT_END
    layout = {
        "waterLevel": site_layout.WATER_LEVEL,
        "poolOutline": [[round(x_value, 3), round(-y_value, 3)] for x_value, y_value in site_layout.pool_outline_points(96)],
        "deck": {
            "minX": site_layout.DECK_MIN_X,
            "maxX": site_layout.DECK_MAX_X,
            "minZ": -site_layout.DECK_MAX_Y,
            "maxZ": -site_layout.DECK_MIN_Y,
            "top": site_layout.DECK_TOP,
        },
        "cameraPath": [path_point(point) for point in CAMERA_PATH_BLENDER],
        "lights": {
            "lantern": to_three(*lantern_light),
            "spoutEnd": to_three(spout_end[0], spout_end[1], spout_end[2] - 0.03),
            "paperLantern": to_three(-1.5, 9.35, 2.25),
            "windowsLower": [to_three(-4.5, 9.5, 1.6), to_three(0.5, 9.5, 1.6), to_three(4.4, 9.6, 1.7)],
            "windowsUpper": to_three(-0.5, 10.4, 4.8),
        },
        "nearPines": [pine_entry(pine) for pine in near_pines],
        "farPines": [pine_entry(pine) for pine in far_pines],
    }
    output_path = os.path.join(OUTPUT_DIRECTORY, "layout.json")
    with open(output_path, "w", encoding="utf-8") as layout_file:
        json.dump(layout, layout_file)
    print(f"wrote {output_path}: {len(near_pines)} near pines, {len(far_pines)} far pines")


def main():
    start_time = time.time()
    clear_scene()
    materials = lib_materials.build_site_materials()
    frond_color, frond_alpha = foliage_textures.frond_atlas()
    materials.add("frond", roughness=0.8, base_image=lib_materials.make_image("frond_atlas", frond_color, alpha_array=frond_alpha), use_image_alpha=True)
    materials.add("foliage_core", roughness=0.9, base_image=lib_materials.make_image("foliage_core_color", foliage_textures.core_texture()))
    mountain_color, mountain_height = lib_materials.stone_texture(81)
    materials.add(
        "mountain",
        roughness=0.92,
        normal_image=lib_materials.make_image("mountain_normal", lib_materials.height_to_normal(mountain_height, 6.0), non_color=True),
    )
    lantern_light = build_site(materials)
    export_glb("site.glb")
    clear_scene()
    build_pines(materials)
    export_glb("pines.glb")
    clear_scene()
    build_mountains(materials)
    export_glb("mountains.glb")
    write_layout(lantern_light)
    print(f"done in {time.time() - start_time:.1f} s")


main()
