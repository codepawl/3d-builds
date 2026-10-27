import os
import bpy
import numpy as np


TEXTURE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_cache")


def ensure_texture_cache_directory():
    os.makedirs(TEXTURE_CACHE_DIR, exist_ok=True)


def compute_tileable_value_noise(grid_size, frequency, random_seed):
    generator = np.random.default_rng(random_seed)
    coarse_grid = generator.random((frequency, frequency), dtype=np.float32)
    padded_grid = np.pad(coarse_grid, ((0, 1), (0, 1)), mode="wrap")
    coordinates = np.linspace(0.0, float(frequency), grid_size, endpoint=False, dtype=np.float32)
    integer_indices = np.floor(coordinates).astype(np.int32)
    fractional_part = coordinates - integer_indices
    smooth_fraction = fractional_part * fractional_part * (3.0 - 2.0 * fractional_part)
    ix_grid, iy_grid = np.meshgrid(integer_indices, integer_indices, indexing="ij")
    fx_grid, fy_grid = np.meshgrid(smooth_fraction, smooth_fraction, indexing="ij")
    value_00 = padded_grid[ix_grid, iy_grid]
    value_10 = padded_grid[ix_grid + 1, iy_grid]
    value_01 = padded_grid[ix_grid, iy_grid + 1]
    value_11 = padded_grid[ix_grid + 1, iy_grid + 1]
    interpolated_x0 = value_00 * (1.0 - fx_grid) + value_10 * fx_grid
    interpolated_x1 = value_01 * (1.0 - fx_grid) + value_11 * fx_grid
    interpolated_xy = interpolated_x0 * (1.0 - fy_grid) + interpolated_x1 * fy_grid
    return interpolated_xy


def compute_fractal_noise(grid_size, base_frequency, octaves, seed_base):
    accumulated_noise = np.zeros((grid_size, grid_size), dtype=np.float32)
    amplitude = 1.0
    total_amplitude = 0.0
    current_frequency = base_frequency
    for octave_index in range(octaves):
        current_seed = seed_base + octave_index * 97
        layer_noise = compute_tileable_value_noise(grid_size, current_frequency, current_seed)
        accumulated_noise = accumulated_noise + layer_noise * amplitude
        total_amplitude = total_amplitude + amplitude
        amplitude = amplitude * 0.5
        current_frequency = min(grid_size // 2, current_frequency * 2)
    normalized_noise = accumulated_noise / max(total_amplitude, 1e-5)
    return normalized_noise


def compute_ridged_noise(grid_size, base_frequency, octaves, seed_base):
    accumulated = np.zeros((grid_size, grid_size), dtype=np.float32)
    amplitude = 1.0
    total_amplitude = 0.0
    current_frequency = base_frequency
    for octave_index in range(octaves):
        current_seed = seed_base + octave_index * 131
        layer = compute_tileable_value_noise(grid_size, current_frequency, current_seed)
        ridge = 1.0 - np.abs(layer * 2.0 - 1.0)
        ridge = ridge * ridge
        accumulated = accumulated + ridge * amplitude
        total_amplitude = total_amplitude + amplitude
        amplitude = amplitude * 0.52
        current_frequency = min(grid_size // 2, current_frequency * 2)
    return accumulated / max(total_amplitude, 1e-5)


def build_normal_map_from_height(height_field, strength):
    grad_y, grad_x = np.gradient(height_field)
    normal_x = -grad_x * strength
    normal_y = -grad_y * strength
    normal_z = np.ones_like(height_field)
    length = np.sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z)
    normal_x = (normal_x / length) * 0.5 + 0.5
    normal_y = (normal_y / length) * 0.5 + 0.5
    normal_z = (normal_z / length) * 0.5 + 0.5
    rgba_array = np.ones((height_field.shape[0], height_field.shape[1], 4), dtype=np.float32)
    rgba_array[:, :, 0] = np.clip(normal_x, 0.0, 1.0)
    rgba_array[:, :, 1] = np.clip(normal_y, 0.0, 1.0)
    rgba_array[:, :, 2] = np.clip(normal_z, 0.0, 1.0)
    return rgba_array


def save_and_pack_rgba_image(image_name, rgba_array, is_non_color):
    ensure_texture_cache_directory()
    height_px = rgba_array.shape[0]
    width_px = rgba_array.shape[1]
    existing_image = bpy.data.images.get(image_name)
    if existing_image is not None:
        bpy.data.images.remove(existing_image)
    blender_image = bpy.data.images.new(name=image_name, width=width_px, height=height_px, alpha=True)
    flattened_pixels = np.clip(rgba_array, 0.0, 1.0).astype(np.float32).ravel()
    blender_image.pixels.foreach_set(flattened_pixels)
    file_path = os.path.join(TEXTURE_CACHE_DIR, f"{image_name}.png")
    blender_image.filepath_raw = file_path
    blender_image.file_format = "PNG"
    blender_image.save()
    blender_image.pack()
    if is_non_color:
        blender_image.colorspace_settings.name = "Non-Color"
    return blender_image


def set_bsdf_input_safe(bsdf_node, socket_name, value):
    if socket_name in bsdf_node.inputs:
        bsdf_node.inputs[socket_name].default_value = value


def attach_textures_to_material(
    material_name,
    albedo_image,
    roughness_image,
    normal_image,
    normal_strength=1.0,
    metallic_value=0.0,
    emission_color=None,
    emission_strength=0.0,
):
    existing_material = bpy.data.materials.get(material_name)
    if existing_material is not None:
        return existing_material
    material = bpy.data.materials.new(name=material_name)
    material.use_nodes = True
    node_tree = material.node_tree
    bsdf_node = node_tree.nodes.get("Principled BSDF")
    if bsdf_node is None:
        bsdf_node = node_tree.nodes.new(type="ShaderNodeBsdfPrincipled")
    set_bsdf_input_safe(bsdf_node, "Metallic", metallic_value)
    if albedo_image is not None:
        albedo_node = node_tree.nodes.new(type="ShaderNodeTexImage")
        albedo_node.image = albedo_image
        node_tree.links.new(albedo_node.outputs["Color"], bsdf_node.inputs["Base Color"])
    if roughness_image is not None:
        roughness_node = node_tree.nodes.new(type="ShaderNodeTexImage")
        roughness_node.image = roughness_image
        node_tree.links.new(roughness_node.outputs["Color"], bsdf_node.inputs["Roughness"])
    if normal_image is not None:
        normal_tex_node = node_tree.nodes.new(type="ShaderNodeTexImage")
        normal_tex_node.image = normal_image
        normal_map_node = node_tree.nodes.new(type="ShaderNodeNormalMap")
        normal_map_node.inputs["Strength"].default_value = normal_strength
        node_tree.links.new(normal_tex_node.outputs["Color"], normal_map_node.inputs["Color"])
        node_tree.links.new(normal_map_node.outputs["Normal"], bsdf_node.inputs["Normal"])
    if emission_color is not None and emission_strength > 0.0:
        set_bsdf_input_safe(bsdf_node, "Emission Color", emission_color)
        set_bsdf_input_safe(bsdf_node, "Emission Strength", emission_strength)
    return material


def create_snow_material():
    existing = bpy.data.materials.get("SnowMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    wind_crust = compute_fractal_noise(grid_size, 6, 4, 101)
    powder_grain = compute_fractal_noise(grid_size, 36, 4, 202)
    crystal_glint = compute_ridged_noise(grid_size, 48, 3, 255)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.89 + wind_crust * 0.07 + powder_grain * 0.02
    albedo[:, :, 1] = 0.91 + wind_crust * 0.06 + powder_grain * 0.02
    albedo[:, :, 2] = 0.95 + wind_crust * 0.04 + powder_grain * 0.01
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.64 + wind_crust * 0.16 - crystal_glint * 0.18, 0.42, 0.84)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    height_field = wind_crust * 0.55 + powder_grain * 0.30 + crystal_glint * 0.15
    normal_rgba = build_normal_map_from_height(height_field, 2.8)
    albedo_img = save_and_pack_rgba_image("snow_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("snow_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("snow_normal", normal_rgba, True)
    material = attach_textures_to_material("SnowMaterial", albedo_img, rough_img, normal_img, 0.62)
    return material


def create_onsen_rock_material():
    existing = bpy.data.materials.get("OnsenRockMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    macro_noise = compute_fractal_noise(grid_size, 6, 5, 303)
    fracture_ridges = compute_ridged_noise(grid_size, 14, 4, 404)
    micro_pitting = compute_fractal_noise(grid_size, 40, 3, 455)
    mineral_stain = compute_fractal_noise(grid_size, 10, 4, 505)
    moss_patch = compute_fractal_noise(grid_size, 12, 4, 550)

    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    base_andesite = 0.11 + macro_noise * 0.14 + fracture_ridges * 0.09 + micro_pitting * 0.04
    crevice_dark = np.clip(0.45 - fracture_ridges, 0.0, 1.0) * 0.09
    sulfur_ochre = np.clip(mineral_stain - 0.56, 0.0, 1.0) * 0.16
    moss_mask = np.clip((moss_patch - 0.60) * 3.2, 0.0, 1.0) * np.clip(macro_noise, 0.2, 1.0)
    wet_patch = np.clip((0.52 - macro_noise) * 2.4, 0.0, 1.0)

    r_val = (base_andesite - crevice_dark + sulfur_ochre * 0.85) * (1.0 - wet_patch * 0.35)
    g_val = (base_andesite - crevice_dark + sulfur_ochre * 0.62) * (1.0 - wet_patch * 0.35)
    b_val = (base_andesite - crevice_dark - sulfur_ochre * 0.15) * (1.0 - wet_patch * 0.32)

    r_val = r_val * (1.0 - moss_mask) + (0.11 + micro_pitting * 0.05) * moss_mask
    g_val = g_val * (1.0 - moss_mask) + (0.20 + micro_pitting * 0.08) * moss_mask
    b_val = b_val * (1.0 - moss_mask) + (0.09 + micro_pitting * 0.04) * moss_mask

    albedo[:, :, 0] = np.clip(r_val, 0.04, 0.52)
    albedo[:, :, 1] = np.clip(g_val, 0.04, 0.52)
    albedo[:, :, 2] = np.clip(b_val, 0.04, 0.50)

    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = 0.62 + macro_noise * 0.20 + moss_mask * 0.18 - wet_patch * 0.42
    rough_val = np.clip(rough_val, 0.16, 0.90)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val

    height_field = macro_noise * 0.42 + fracture_ridges * 0.42 + micro_pitting * 0.16
    normal_rgba = build_normal_map_from_height(height_field, 6.2)
    albedo_img = save_and_pack_rgba_image("rock_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("rock_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("rock_normal", normal_rgba, True)
    material = attach_textures_to_material("OnsenRockMaterial", albedo_img, rough_img, normal_img, 1.20)
    return material


def create_wet_stone_floor_material():
    existing = bpy.data.materials.get("WetStoneFloorMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    stone_noise = compute_fractal_noise(grid_size, 10, 4, 606)
    vein_ridges = compute_ridged_noise(grid_size, 18, 4, 660)
    mineral_green = compute_fractal_noise(grid_size, 12, 3, 707)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.07 + stone_noise * 0.08 + vein_ridges * 0.04
    albedo[:, :, 1] = 0.10 + stone_noise * 0.09 + mineral_green * 0.05 + vein_ridges * 0.04
    albedo[:, :, 2] = 0.09 + stone_noise * 0.08 + mineral_green * 0.04 + vein_ridges * 0.03
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.14 + stone_noise * 0.20 + vein_ridges * 0.08, 0.12, 0.44)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    height_field = stone_noise * 0.6 + vein_ridges * 0.4
    normal_rgba = build_normal_map_from_height(height_field, 4.4)
    albedo_img = save_and_pack_rgba_image("wet_stone_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("wet_stone_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("wet_stone_normal", normal_rgba, True)
    material = attach_textures_to_material("WetStoneFloorMaterial", albedo_img, rough_img, normal_img, 0.95)
    return material


def create_weathered_cedar_material():
    existing = bpy.data.materials.get("WeatheredCedarMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    grain_x = compute_tileable_value_noise(grid_size, 64, 808)
    grain_y = compute_fractal_noise(grid_size, 8, 4, 909)
    wear_noise = compute_fractal_noise(grid_size, 14, 3, 955)
    wood_fiber = grain_x * 0.62 + grain_y * 0.38
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.13 + wood_fiber * 0.10 + wear_noise * 0.03
    albedo[:, :, 1] = 0.09 + wood_fiber * 0.07 + wear_noise * 0.02
    albedo[:, :, 2] = 0.06 + wood_fiber * 0.05 + wear_noise * 0.02
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.52 + wood_fiber * 0.24 - wear_noise * 0.10, 0.38, 0.84)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(wood_fiber, 3.6)
    albedo_img = save_and_pack_rgba_image("cedar_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("cedar_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("cedar_normal", normal_rgba, True)
    material = attach_textures_to_material("WeatheredCedarMaterial", albedo_img, rough_img, normal_img, 0.85)
    return material


def create_hinoki_deck_material():
    existing = bpy.data.materials.get("HinokiDeckMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    fine_grain = compute_tileable_value_noise(grid_size, 64, 1010)
    warm_variation = compute_fractal_noise(grid_size, 10, 4, 1111)
    wet_sheen_patch = compute_fractal_noise(grid_size, 6, 3, 1155)
    y_coords = np.linspace(0.0, 10.0, grid_size, endpoint=False, dtype=np.float32)
    plank_phase = np.abs(np.mod(y_coords, 1.0) - 0.5) * 2.0
    seam_mask = np.clip((plank_phase - 0.90) / 0.10, 0.0, 1.0)
    seam_2d = np.tile(seam_mask[:, np.newaxis], (1, grid_size))
    fiber = fine_grain * 0.58 + warm_variation * 0.42
    wet_mask = np.clip((wet_sheen_patch - 0.48) * 2.2, 0.0, 1.0)
    darken = (1.0 - seam_2d * 0.72) * (1.0 - wet_mask * 0.26)

    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    r_channel = (0.38 + fiber * 0.16) * darken
    g_channel = (0.26 + fiber * 0.12) * darken
    b_channel = (0.16 + fiber * 0.08) * darken
    albedo[:, :, 0] = np.clip(r_channel, 0.04, 0.72)
    albedo[:, :, 1] = np.clip(g_channel, 0.03, 0.62)
    albedo[:, :, 2] = np.clip(b_channel, 0.02, 0.48)

    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = 0.44 + fiber * 0.18 + seam_2d * 0.28 - wet_mask * 0.24
    rough_val = np.clip(rough_val, 0.20, 0.82)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val

    height_field = fiber * 0.65 - seam_2d * 0.95
    normal_rgba = build_normal_map_from_height(height_field, 3.8)
    albedo_img = save_and_pack_rgba_image("hinoki_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("hinoki_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("hinoki_normal", normal_rgba, True)
    material = attach_textures_to_material("HinokiDeckMaterial", albedo_img, rough_img, normal_img, 0.85)
    return material


def create_copper_band_material():
    existing = bpy.data.materials.get("CopperBandMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    patina_noise = compute_fractal_noise(grid_size, 16, 4, 1188)
    verdigris = np.clip((patina_noise - 0.62) * 3.0, 0.0, 1.0)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = (0.28 + patina_noise * 0.10) * (1.0 - verdigris) + 0.18 * verdigris
    albedo[:, :, 1] = (0.16 + patina_noise * 0.07) * (1.0 - verdigris) + 0.34 * verdigris
    albedo[:, :, 2] = (0.11 + patina_noise * 0.05) * (1.0 - verdigris) + 0.28 * verdigris
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.30 + patina_noise * 0.22 + verdigris * 0.28, 0.24, 0.78)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(patina_noise, 2.2)
    albedo_img = save_and_pack_rgba_image("copper_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("copper_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("copper_normal", normal_rgba, True)
    material = attach_textures_to_material("CopperBandMaterial", albedo_img, rough_img, normal_img, 0.6, 0.82)
    return material


def create_shoji_paper_material():
    existing = bpy.data.materials.get("ShojiPaperMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    washi_fiber = compute_fractal_noise(grid_size, 20, 4, 1212)
    fine_slubs = compute_ridged_noise(grid_size, 32, 3, 1255)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.94 + washi_fiber * 0.04 + fine_slubs * 0.02
    albedo[:, :, 1] = 0.89 + washi_fiber * 0.05 + fine_slubs * 0.02
    albedo[:, :, 2] = 0.79 + washi_fiber * 0.06 + fine_slubs * 0.02
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.72 + washi_fiber * 0.14, 0.65, 0.88)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(washi_fiber * 0.6 + fine_slubs * 0.4, 1.4)
    albedo_img = save_and_pack_rgba_image("shoji_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("shoji_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("shoji_normal", normal_rgba, True)
    material = attach_textures_to_material(
        "ShojiPaperMaterial",
        albedo_img,
        rough_img,
        normal_img,
        0.35,
        0.0,
        (1.0, 0.84, 0.62, 1.0),
        0.85,
    )
    return material


def create_plaster_wall_material():
    existing = bpy.data.materials.get("JurakuWallMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    sand_noise = compute_fractal_noise(grid_size, 24, 4, 1313)
    trowel_swirl = compute_fractal_noise(grid_size, 6, 3, 1366)
    combined = sand_noise * 0.65 + trowel_swirl * 0.35
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.36 + combined * 0.09
    albedo[:, :, 1] = 0.32 + combined * 0.08
    albedo[:, :, 2] = 0.25 + combined * 0.06
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.78 + sand_noise * 0.14, 0.70, 0.94)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(combined, 2.6)
    albedo_img = save_and_pack_rgba_image("juraku_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("juraku_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("juraku_normal", normal_rgba, True)
    material = attach_textures_to_material("JurakuWallMaterial", albedo_img, rough_img, normal_img, 0.7)
    return material


def create_roof_tile_material():
    existing = bpy.data.materials.get("KawaraRoofMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    x_coords = np.linspace(0.0, 28.0 * np.pi, grid_size, dtype=np.float32)
    y_coords = np.linspace(0.0, 14.0, grid_size, endpoint=False, dtype=np.float32)
    wave_1d = (np.sin(x_coords) * 0.5 + 0.5).astype(np.float32)
    wave_2d = np.tile(wave_1d[np.newaxis, :], (grid_size, 1))
    row_lap = np.clip((np.mod(y_coords, 1.0) - 0.88) / 0.12, 0.0, 1.0)
    row_2d = np.tile(row_lap[:, np.newaxis], (1, grid_size))
    weather_noise = compute_fractal_noise(grid_size, 12, 4, 1414)
    height_field = wave_2d * 0.68 - row_2d * 0.22 + weather_noise * 0.20
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    tile_shade = (0.12 + wave_2d * 0.07 + weather_noise * 0.04) * (1.0 - row_2d * 0.45)
    albedo[:, :, 0] = tile_shade
    albedo[:, :, 1] = tile_shade * 1.03
    albedo[:, :, 2] = tile_shade * 1.08
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.32 + weather_noise * 0.24 + row_2d * 0.18, 0.24, 0.68)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(height_field, 4.8)
    albedo_img = save_and_pack_rgba_image("kawara_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("kawara_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("kawara_normal", normal_rgba, True)
    material = attach_textures_to_material("KawaraRoofMaterial", albedo_img, rough_img, normal_img, 1.0)
    return material


def create_granite_lantern_material():
    existing = bpy.data.materials.get("GraniteLanternMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    speckle = compute_fractal_noise(grid_size, 36, 4, 1515)
    chisel_marks = compute_ridged_noise(grid_size, 24, 3, 1588)
    moss_patch = compute_fractal_noise(grid_size, 8, 4, 1616)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    stone_val = 0.30 + speckle * 0.20 + chisel_marks * 0.06
    moss_factor = np.clip((moss_patch - 0.56) * 2.5, 0.0, 1.0) * 0.42
    albedo[:, :, 0] = np.clip(stone_val * (1.0 - moss_factor) + 0.14 * moss_factor, 0.12, 0.64)
    albedo[:, :, 1] = np.clip(stone_val * (1.0 - moss_factor) + 0.24 * moss_factor, 0.14, 0.66)
    albedo[:, :, 2] = np.clip(stone_val * (1.0 - moss_factor) + 0.11 * moss_factor, 0.10, 0.62)
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.68 + speckle * 0.18 + moss_factor * 0.12, 0.52, 0.92)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(speckle * 0.65 + chisel_marks * 0.35, 4.2)
    albedo_img = save_and_pack_rgba_image("granite_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("granite_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("granite_normal", normal_rgba, True)
    material = attach_textures_to_material("GraniteLanternMaterial", albedo_img, rough_img, normal_img, 0.95)
    return material


def create_lantern_glow_material():
    existing = bpy.data.materials.get("LanternGlowMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    paper_grain = compute_fractal_noise(grid_size, 20, 4, 1666)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.98 - paper_grain * 0.04
    albedo[:, :, 1] = 0.88 - paper_grain * 0.06
    albedo[:, :, 2] = 0.70 - paper_grain * 0.08
    roughness = np.full((grid_size, grid_size, 4), 0.65, dtype=np.float32)
    albedo_img = save_and_pack_rgba_image("lantern_glow_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("lantern_glow_roughness", roughness, True)
    material = attach_textures_to_material(
        "LanternGlowMaterial",
        albedo_img,
        rough_img,
        None,
        1.0,
        0.0,
        (1.0, 0.80, 0.52, 1.0),
        1.8,
    )
    return material


def create_bamboo_material():
    existing = bpy.data.materials.get("BambooSpoutMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    bamboo_stripes = compute_tileable_value_noise(grid_size, 40, 1717)
    age_patina = compute_fractal_noise(grid_size, 8, 4, 1818)
    wet_moss = np.clip((age_patina - 0.58) * 2.8, 0.0, 1.0)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    r_val = (0.36 + bamboo_stripes * 0.11 + age_patina * 0.06) * (1.0 - wet_moss * 0.45)
    g_val = (0.39 + bamboo_stripes * 0.11 + age_patina * 0.05) * (1.0 - wet_moss * 0.20)
    b_val = (0.20 + bamboo_stripes * 0.06) * (1.0 - wet_moss * 0.45)
    albedo[:, :, 0] = np.clip(r_val, 0.08, 0.65)
    albedo[:, :, 1] = np.clip(g_val, 0.10, 0.68)
    albedo[:, :, 2] = np.clip(b_val, 0.05, 0.48)
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.28 + bamboo_stripes * 0.18 + wet_moss * 0.22, 0.20, 0.68)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(bamboo_stripes * 0.7 + age_patina * 0.3, 2.4)
    albedo_img = save_and_pack_rgba_image("bamboo_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("bamboo_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("bamboo_normal", normal_rgba, True)
    material = attach_textures_to_material("BambooSpoutMaterial", albedo_img, rough_img, normal_img, 0.65)
    return material


def create_black_twine_material():
    existing = bpy.data.materials.get("BlackTwineMaterial")
    if existing is not None:
        return existing
    grid_size = 128
    braid_noise = compute_ridged_noise(grid_size, 24, 3, 1855)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.06 + braid_noise * 0.05
    albedo[:, :, 1] = 0.05 + braid_noise * 0.04
    albedo[:, :, 2] = 0.05 + braid_noise * 0.04
    roughness = np.full((grid_size, grid_size, 4), 0.82, dtype=np.float32)
    normal_rgba = build_normal_map_from_height(braid_noise, 3.0)
    albedo_img = save_and_pack_rgba_image("twine_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("twine_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("twine_normal", normal_rgba, True)
    material = attach_textures_to_material("BlackTwineMaterial", albedo_img, rough_img, normal_img, 0.75)
    return material


def create_pine_bark_material():
    existing = bpy.data.materials.get("PineBarkMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    bark_plates = compute_fractal_noise(grid_size, 12, 4, 1919)
    deep_fissures = compute_ridged_noise(grid_size, 20, 4, 1955)
    lichen = np.clip((bark_plates - 0.68) * 3.0, 0.0, 1.0)
    combined = bark_plates * 0.55 + deep_fissures * 0.45
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = (0.14 + combined * 0.11) * (1.0 - lichen) + 0.24 * lichen
    albedo[:, :, 1] = (0.09 + combined * 0.07) * (1.0 - lichen) + 0.27 * lichen
    albedo[:, :, 2] = (0.07 + combined * 0.05) * (1.0 - lichen) + 0.22 * lichen
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.76 + combined * 0.16, 0.68, 0.94)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(combined, 4.8)
    albedo_img = save_and_pack_rgba_image("pine_bark_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("pine_bark_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("pine_bark_normal", normal_rgba, True)
    material = attach_textures_to_material("PineBarkMaterial", albedo_img, rough_img, normal_img, 1.05)
    return material


def create_pine_needle_material():
    existing = bpy.data.materials.get("PineNeedleMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    needle_tex = compute_ridged_noise(grid_size, 28, 4, 2020)
    macro_shade = compute_fractal_noise(grid_size, 8, 3, 2088)
    frost_speck = compute_fractal_noise(grid_size, 36, 3, 2121)
    frost_mask = np.clip((frost_speck - 0.65) * 2.6, 0.0, 1.0)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    green_r = 0.05 + needle_tex * 0.06 + macro_shade * 0.04
    green_g = 0.13 + needle_tex * 0.10 + macro_shade * 0.06
    green_b = 0.07 + needle_tex * 0.05 + macro_shade * 0.04
    albedo[:, :, 0] = green_r * (1.0 - frost_mask) + 0.80 * frost_mask
    albedo[:, :, 1] = green_g * (1.0 - frost_mask) + 0.85 * frost_mask
    albedo[:, :, 2] = green_b * (1.0 - frost_mask) + 0.90 * frost_mask
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.64 + needle_tex * 0.22 - frost_mask * 0.15, 0.48, 0.88)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(needle_tex * 0.75 + macro_shade * 0.25, 4.5)
    albedo_img = save_and_pack_rgba_image("pine_needle_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("pine_needle_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("pine_needle_normal", normal_rgba, True)
    material = attach_textures_to_material("PineNeedleMaterial", albedo_img, rough_img, normal_img, 0.95)
    return material


def create_mountain_slope_material():
    existing = bpy.data.materials.get("MountainSlopeMaterial")
    if existing is not None:
        return existing
    grid_size = 512
    ridge_noise = compute_fractal_noise(grid_size, 12, 5, 2222)
    cliff_striations = compute_ridged_noise(grid_size, 24, 4, 2323)
    combined_pattern = ridge_noise * 0.58 + cliff_striations * 0.42
    crag_mask = np.clip((combined_pattern - 0.58) * 4.5, 0.0, 1.0)
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    snow_r = 0.88 + ridge_noise * 0.08
    snow_g = 0.91 + ridge_noise * 0.06
    snow_b = 0.96 + ridge_noise * 0.03
    rock_r = 0.16 + cliff_striations * 0.10
    rock_g = 0.19 + cliff_striations * 0.10
    rock_b = 0.24 + cliff_striations * 0.12
    albedo[:, :, 0] = snow_r * (1.0 - crag_mask) + rock_r * crag_mask
    albedo[:, :, 1] = snow_g * (1.0 - crag_mask) + rock_g * crag_mask
    albedo[:, :, 2] = snow_b * (1.0 - crag_mask) + rock_b * crag_mask
    roughness = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    rough_val = np.clip(0.68 + crag_mask * 0.18, 0.58, 0.90)
    roughness[:, :, 0] = rough_val
    roughness[:, :, 1] = rough_val
    roughness[:, :, 2] = rough_val
    normal_rgba = build_normal_map_from_height(combined_pattern, 4.2)
    albedo_img = save_and_pack_rgba_image("mountain_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("mountain_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("mountain_normal", normal_rgba, True)
    material = attach_textures_to_material("MountainSlopeMaterial", albedo_img, rough_img, normal_img, 0.85)
    return material


def create_towel_fabric_material():
    existing = bpy.data.materials.get("TowelFabricMaterial")
    if existing is not None:
        return existing
    grid_size = 256
    weave_x = compute_tileable_value_noise(grid_size, 64, 2401)
    weave_y = compute_tileable_value_noise(grid_size, 64, 2402)
    fold_shade = compute_fractal_noise(grid_size, 8, 3, 2403)
    waffle = (weave_x + weave_y.T) * 0.5
    albedo = np.ones((grid_size, grid_size, 4), dtype=np.float32)
    albedo[:, :, 0] = 0.86 + waffle * 0.06 + fold_shade * 0.04
    albedo[:, :, 1] = 0.84 + waffle * 0.06 + fold_shade * 0.04
    albedo[:, :, 2] = 0.79 + waffle * 0.06 + fold_shade * 0.04
    roughness = np.full((grid_size, grid_size, 4), 0.86, dtype=np.float32)
    normal_rgba = build_normal_map_from_height(waffle * 0.7 + fold_shade * 0.3, 2.5)
    albedo_img = save_and_pack_rgba_image("towel_albedo", albedo, False)
    rough_img = save_and_pack_rgba_image("towel_roughness", roughness, True)
    normal_img = save_and_pack_rgba_image("towel_normal", normal_rgba, True)
    material = attach_textures_to_material("TowelFabricMaterial", albedo_img, rough_img, normal_img, 0.65)
    return material
