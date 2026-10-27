"""Procedural textures (numpy) and glTF-friendly Principled materials."""
import bpy
import numpy as np

TEXTURE_SIZE = 512


def value_noise_2d(size, cells, seed, octaves=4):
    """Tileable fractal value noise in [0, 1]."""
    generator = np.random.default_rng(seed)
    total = np.zeros((size, size), dtype=np.float32)
    amplitude = 1.0
    normaliser = 0.0
    cell_count = cells
    for _ in range(octaves):
        lattice = generator.random((cell_count, cell_count)).astype(np.float32)
        coordinates = np.arange(size, dtype=np.float32) * cell_count / size
        index_low = np.floor(coordinates).astype(int) % cell_count
        index_high = (index_low + 1) % cell_count
        fraction = coordinates - np.floor(coordinates)
        fraction = fraction * fraction * (3.0 - 2.0 * fraction)
        rows_low = lattice[index_low][:, index_low] * (1 - fraction)[None, :] + lattice[index_low][:, index_high] * fraction[None, :]
        rows_high = lattice[index_high][:, index_low] * (1 - fraction)[None, :] + lattice[index_high][:, index_high] * fraction[None, :]
        layer = rows_low * (1 - fraction)[:, None] + rows_high * fraction[:, None]
        total += layer * amplitude
        normaliser += amplitude
        amplitude *= 0.5
        cell_count *= 2
    return total / normaliser


def stretched_noise(size, cells_u, cells_v, seed):
    """Noise stretched along U, for wood grain."""
    generator = np.random.default_rng(seed)
    lattice = generator.random((cells_v, cells_u)).astype(np.float32)
    u_coordinates = np.arange(size, dtype=np.float32) * cells_u / size
    v_coordinates = np.arange(size, dtype=np.float32) * cells_v / size
    u_low = np.floor(u_coordinates).astype(int) % cells_u
    u_high = (u_low + 1) % cells_u
    v_low = np.floor(v_coordinates).astype(int) % cells_v
    v_high = (v_low + 1) % cells_v
    u_fraction = u_coordinates - np.floor(u_coordinates)
    v_fraction = v_coordinates - np.floor(v_coordinates)
    u_fraction = u_fraction * u_fraction * (3 - 2 * u_fraction)
    v_fraction = v_fraction * v_fraction * (3 - 2 * v_fraction)
    top = lattice[v_low][:, u_low] * (1 - u_fraction)[None, :] + lattice[v_low][:, u_high] * u_fraction[None, :]
    bottom = lattice[v_high][:, u_low] * (1 - u_fraction)[None, :] + lattice[v_high][:, u_high] * u_fraction[None, :]
    return top * (1 - v_fraction)[:, None] + bottom * v_fraction[:, None]


def height_to_normal(height, strength):
    gradient_v = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    gradient_u = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    normal_x = -gradient_u
    normal_y = -gradient_v
    normal_z = np.ones_like(height)
    length = np.sqrt(normal_x ** 2 + normal_y ** 2 + normal_z ** 2)
    normal = np.stack([normal_x / length, normal_y / length, normal_z / length], axis=-1)
    return normal * 0.5 + 0.5


def make_image(name, rgb_array, non_color=False, alpha_array=None):
    size_v, size_u = rgb_array.shape[0], rgb_array.shape[1]
    image = bpy.data.images.new(name, width=size_u, height=size_v, alpha=alpha_array is not None)
    # Set the colour space before writing pixels: changing it afterwards resets the generated buffer.
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    rgba = np.ones((size_v, size_u, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(rgb_array, 0.0, 1.0)
    if alpha_array is not None:
        rgba[..., 3] = np.clip(alpha_array, 0.0, 1.0)
    image.pixels.foreach_set(rgba.ravel())
    image.file_format = "PNG"
    image.pack()
    return image


def grain_texture(seed, light, dark, plank_rows=0):
    """Weathered wood: long grain along U, optional plank seams along V."""
    size = TEXTURE_SIZE
    grain = stretched_noise(size, 4, 96, seed)
    fine = stretched_noise(size, 16, 256, seed + 1)
    blotch = value_noise_2d(size, 6, seed + 2, octaves=3)
    rings = np.sin(grain * 18.0) * 0.5 + 0.5
    amount = np.clip(0.55 * rings + 0.25 * fine + 0.35 * (blotch - 0.5), 0, 1)
    color = np.array(light)[None, None, :] * (1 - amount[..., None]) + np.array(dark)[None, None, :] * amount[..., None]
    height = amount * 0.6 + fine * 0.4
    if plank_rows > 0:
        v_positions = (np.arange(size) * plank_rows / size) % 1.0
        seam = np.exp(-((np.minimum(v_positions, 1 - v_positions)) * 60.0) ** 2)
        color = color * (1 - 0.65 * seam[:, None, None])
        height = height - seam[:, None] * 1.5
    return color, height


def stone_texture(seed):
    size = TEXTURE_SIZE
    base = value_noise_2d(size, 8, seed, octaves=5)
    speckle = value_noise_2d(size, 64, seed + 3, octaves=2)
    value = 0.88 + 0.22 * (base - 0.5) + 0.16 * (speckle - 0.5)
    color = np.stack([value, value, value * 0.98], axis=-1)
    height = base * 0.7 + speckle * 0.3
    return color, height


def plaster_texture(seed):
    size = TEXTURE_SIZE
    base = value_noise_2d(size, 10, seed, octaves=5)
    stain = value_noise_2d(size, 3, seed + 5, octaves=3)
    value = 0.92 + 0.08 * (base - 0.5) - 0.12 * np.clip(stain - 0.55, 0, 1)
    color = np.stack([value, value * 0.97, value * 0.9], axis=-1)
    return color, base


def shoji_texture():
    """Washi paper with a kumiko lattice: 4 columns by 6 rows per 1 m panel tile."""
    size = TEXTURE_SIZE
    paper = value_noise_2d(size, 32, 77, octaves=3)
    fibres = stretched_noise(size, 64, 8, 78)
    color = np.ones((size, size, 3), dtype=np.float32) * (0.93 + 0.05 * (paper[..., None] - 0.5) + 0.03 * (fibres[..., None] - 0.5))
    positions = np.arange(size) / size
    column_lines = np.abs(((positions * 4.0) % 1.0) - 0.5) > 0.47
    row_lines = np.abs(((positions * 6.0) % 1.0) - 0.5) > 0.465
    lattice = column_lines[None, :] | row_lines[:, None]
    wood = np.array([0.32, 0.22, 0.14])
    color[lattice] = wood
    return color


def roof_tile_texture(seed):
    size = TEXTURE_SIZE
    base = value_noise_2d(size, 12, seed, octaves=4)
    positions = np.arange(size) / size
    channels = np.abs(np.sin(positions * np.pi * 8.0))
    courses = (positions * 10.0) % 1.0
    course_shadow = np.clip(courses * 3.0, 0, 1)
    height = channels[None, :] * 0.6 + course_shadow[:, None] * 0.4
    value = 0.2 + 0.08 * (base - 0.5) + 0.06 * height
    color = np.stack([value, value * 1.02, value * 1.08], axis=-1)
    return color, height


def bark_texture(seed):
    size = TEXTURE_SIZE
    plates = stretched_noise(size, 24, 3, seed)
    fine = value_noise_2d(size, 40, seed + 1, octaves=2)
    furrows = np.clip((plates - 0.35) * 3.0, 0, 1)
    value = 0.18 + 0.2 * furrows + 0.05 * (fine - 0.5)
    color = np.stack([value * 1.25, value * 0.95, value * 0.75], axis=-1)
    height = furrows * 0.8 + fine * 0.2
    return color.transpose(1, 0, 2), height.T


def bamboo_texture(seed):
    size = TEXTURE_SIZE
    streaks = stretched_noise(size, 2, 128, seed).T
    blotch = value_noise_2d(size, 5, seed + 2, octaves=3)
    green = np.array([0.5, 0.48, 0.33])
    straw = np.array([0.66, 0.6, 0.45])
    amount = np.clip(0.5 * streaks + 0.6 * (blotch - 0.3), 0, 1)
    color = green[None, None, :] * (1 - amount[..., None]) + straw[None, None, :] * amount[..., None]
    return color


def snow_texture(seed):
    size = TEXTURE_SIZE
    base = value_noise_2d(size, 16, seed, octaves=5)
    sparkle_source = np.random.default_rng(seed).random((size, size))
    height = base + (sparkle_source > 0.997) * 0.4
    value = 0.97 + 0.03 * (base - 0.5)
    color = np.stack([value, value, value], axis=-1)
    return color, height


def fabric_texture():
    size = TEXTURE_SIZE
    threads = np.sin(np.arange(size) * np.pi * 0.5) * 0.5 + 0.5
    weave = threads[None, :] * 0.5 + threads[:, None] * 0.5
    indigo = np.array([0.08, 0.12, 0.24])
    color = indigo[None, None, :] * (0.85 + 0.25 * weave[..., None])
    positions = np.arange(size) / size
    crest = (((positions[None, :] - 0.5) ** 2 + (positions[:, None] - 0.62) ** 2) < 0.012) & (
        ((positions[None, :] - 0.5) ** 2 + (positions[:, None] - 0.62) ** 2) > 0.007
    )
    color[crest] = np.array([0.85, 0.83, 0.78])
    return color


class MaterialLibrary:
    def __init__(self):
        self.materials = {}

    def __getitem__(self, name):
        return self.materials[name]

    def add(self, name, roughness=0.8, metallic=0.0, base_image=None, normal_image=None, normal_strength=1.0,
            emission_image=None, emission_color=None, emission_strength=0.0, alpha=1.0, use_image_alpha=False):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        shader = nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        vertex_color_node = nodes.new("ShaderNodeVertexColor")
        vertex_color_node.layer_name = "Col"
        if base_image is not None:
            texture_node = nodes.new("ShaderNodeTexImage")
            texture_node.image = base_image
            mix_node = nodes.new("ShaderNodeMix")
            mix_node.data_type = "RGBA"
            mix_node.blend_type = "MULTIPLY"
            mix_node.inputs["Factor"].default_value = 1.0
            links.new(texture_node.outputs["Color"], input_by_identifier(mix_node, "A_Color"))
            links.new(vertex_color_node.outputs["Color"], input_by_identifier(mix_node, "B_Color"))
            links.new(output_by_identifier(mix_node, "Result_Color"), shader.inputs["Base Color"])
            if use_image_alpha:
                links.new(texture_node.outputs["Alpha"], shader.inputs["Alpha"])
        else:
            links.new(vertex_color_node.outputs["Color"], shader.inputs["Base Color"])
        if normal_image is not None:
            normal_texture_node = nodes.new("ShaderNodeTexImage")
            normal_texture_node.image = normal_image
            normal_map_node = nodes.new("ShaderNodeNormalMap")
            normal_map_node.inputs["Strength"].default_value = normal_strength
            links.new(normal_texture_node.outputs["Color"], normal_map_node.inputs["Color"])
            links.new(normal_map_node.outputs["Normal"], shader.inputs["Normal"])
        if emission_image is not None:
            emission_texture_node = nodes.new("ShaderNodeTexImage")
            emission_texture_node.image = emission_image
            links.new(emission_texture_node.outputs["Color"], shader.inputs["Emission Color"])
            shader.inputs["Emission Strength"].default_value = max(emission_strength, 1.0)
        elif emission_color is not None:
            shader.inputs["Emission Color"].default_value = (*emission_color, 1.0)
            shader.inputs["Emission Strength"].default_value = max(emission_strength, 1.0)
        self.materials[name] = material
        return material


def input_by_identifier(node, identifier):
    for socket in node.inputs:
        if socket.identifier == identifier:
            return socket
    raise KeyError(identifier)


def output_by_identifier(node, identifier):
    for socket in node.outputs:
        if socket.identifier == identifier:
            return socket
    raise KeyError(identifier)


def textured(library, name, color_and_height, normal_strength, roughness, seed_name=None):
    color, height = color_and_height
    base_image = make_image(f"{name}_color", color)
    normal_image = make_image(f"{name}_normal", height_to_normal(height, normal_strength), non_color=True)
    return library.add(name, roughness=roughness, base_image=base_image, normal_image=normal_image)


def build_site_materials():
    library = MaterialLibrary()
    textured(library, "deck_wood", grain_texture(11, (0.56, 0.47, 0.38), (0.30, 0.24, 0.19)), 6.0, 0.78)
    textured(library, "dark_wood", grain_texture(12, (0.30, 0.21, 0.14), (0.14, 0.09, 0.06)), 4.0, 0.7)
    textured(library, "bucket_wood", grain_texture(13, (0.86, 0.72, 0.52), (0.62, 0.48, 0.32), plank_rows=0), 3.0, 0.55)
    textured(library, "stone", stone_texture(21), 10.0, 0.88)
    textured(library, "roof_tile", roof_tile_texture(31), 8.0, 0.55)
    textured(library, "plaster", plaster_texture(41), 3.0, 0.92)
    textured(library, "snow", snow_texture(51), 2.5, 0.72)
    textured(library, "bark", bark_texture(61), 8.0, 0.9)
    library.add("bamboo", roughness=0.45, base_image=make_image("bamboo_color", bamboo_texture(71)))
    shoji_image = make_image("shoji_color", shoji_texture())
    library.add("shoji", roughness=0.9, base_image=shoji_image, emission_image=shoji_image, emission_strength=1.0)
    library.add("noren", roughness=0.95, base_image=make_image("noren_color", fabric_texture()))
    library.add("lantern_glow", roughness=0.9, emission_color=(1.0, 0.62, 0.3), emission_strength=1.0)
    library.add("copper", roughness=0.4, metallic=0.85)
    textured(library, "ground", snow_texture(52), 3.0, 0.8)
    library.add("ice", roughness=0.06)
    return library
