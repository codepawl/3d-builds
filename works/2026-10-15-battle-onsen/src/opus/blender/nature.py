"""Snow-laden pines and the distant mountain range."""
import math

from mathutils import Matrix, Vector

from lib_mesh import (
    add_blob,
    add_cylinder,
    fractal_noise,
    mix_rgb,
    placement_matrix,
    seeded_random,
    smoothstep,
    solid_color,
    MeshBuilder,
)
from mathutils import noise

SNOW_WHITE = (0.93, 0.95, 0.99)


def frond_profile(along):
    """Half width of the frond outline in foliage_textures, so the card hugs the needles."""
    ramp = smoothstep(0.0, 0.3, along)
    return max(0.12, 0.97 * ramp * max(0.0, 1.0 - along) ** 0.55)


def add_frond(builder, base, yaw, length, width, droop, roll, pitch, snowy, shade, segments_along=6):
    """One needle spray card: a drooping strip arched across its width, textured from the frond atlas."""
    part_bmesh = builder.bmesh_for("frond")
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    color_layer = part_bmesh.loops.layers.color["Col"]
    across_values = (-1.0, 0.0, 1.0)
    rotation = Matrix.Rotation(yaw, 3, "Z") @ Matrix.Rotation(-pitch, 3, "Y") @ Matrix.Rotation(roll, 3, "X")
    atlas_offset = 0.5 if snowy else 0.0
    rows = []
    for along_index in range(segments_along + 1):
        along = along_index / segments_along
        half_width = 0.5 * width * frond_profile(along) * 1.08
        row = []
        for across in across_values:
            local = Vector((along * length, across * half_width, -droop * length * along * along - 0.22 * half_width * across * across))
            vert = part_bmesh.verts.new(Vector(base) + rotation @ local)
            texture_across = across * half_width / (0.5 * width)
            row.append((vert, (atlas_offset + 0.5 * min(along, 0.995), 0.5 + 0.5 * texture_across)))
        rows.append(row)
    for along_index in range(segments_along):
        for across_index in range(len(across_values) - 1):
            corners = [rows[along_index][across_index], rows[along_index + 1][across_index], rows[along_index + 1][across_index + 1], rows[along_index][across_index + 1]]
            face = part_bmesh.faces.new([corner[0] for corner in corners])
            face.smooth = True
            for loop, corner in zip(face.loops, corners):
                loop[uv_layer].uv = corner[1]
                along_shade = shade * (0.82 + 0.18 * (corner[1][0] - atlas_offset) * 2.0)
                loop[color_layer] = (along_shade, along_shade, along_shade, 1.0)


def add_snow_clump(builder, base, yaw, length, droop, pitch, random_generator):
    """A lumpy pad of snow lying along the top of a branch."""
    clump_length = length * random_generator.uniform(0.45, 0.65)
    along = clump_length * 0.5 + length * 0.08
    sag = droop * length * (along / length) ** 2 - along * math.sin(pitch)
    center = (base[0] + along * math.cos(yaw), base[1] + along * math.sin(yaw), base[2] - sag + 0.05)
    lump_seed = random_generator.uniform(0, 100)

    def lumpy(position):
        bump = 1.0 + 0.3 * noise.noise(Vector((position.x * 2.6 + lump_seed, position.y * 2.6, position.z * 2.6)))
        lifted = position.z * (1.0 if position.z > 0 else 0.35)
        return Vector((position.x * bump, position.y * bump, lifted * bump))

    add_blob(
        builder,
        "snow",
        1.0,
        (clump_length * 0.5, clump_length * random_generator.uniform(0.22, 0.32), clump_length * 0.16),
        placement_matrix(center, yaw, 0.0, 2.0 * droop * along / length - pitch),
        solid_color((0.95, 0.96, 0.99), jitter=0.04, jitter_scale=0.5),
        subdivisions=2,
        deform=lumpy,
        uv_scale=0.6,
    )


def build_pine(builder, seed, tier_count, branches_per_tier, side_fronds, snow_clumps, frond_segments=6):
    """A 10 m snow-laden fir: tiers of drooping needle sprays around a dark core, snow on the upper sprays."""
    random_generator = seeded_random(seed)
    tree_height = 10.0
    add_cylinder(builder, "bark", 0.24, 0.05, tree_height, placement_matrix((0, 0, -0.3)), solid_color((1.0, 1.0, 1.0)), segments=9, caps=False, uv_scale=(1.0, 2.0))
    core_color = solid_color((0.15, 0.19, 0.14), jitter=0.15, jitter_scale=1.2, seed_offset=seed)
    add_cylinder(builder, "foliage_core", 0.95, 0.1, tree_height - 1.4, placement_matrix((0, 0, 1.0)), core_color, segments=10, caps=False, uv_scale=(3.0, 4.0))
    for tier_index in range(tier_count):
        tier_fraction = tier_index / max(1, tier_count - 1)
        tier_height = 1.15 + tier_fraction * (tree_height - 1.6)
        branch_length = 2.7 * (1.0 - tier_fraction) ** 0.95 + 0.65
        tier_phase = random_generator.uniform(0, 2 * math.pi)
        tier_shade = 0.62 + 0.38 * tier_fraction
        for branch_index in range(branches_per_tier):
            yaw = tier_phase + branch_index * 2 * math.pi / branches_per_tier + random_generator.uniform(-0.3, 0.3)
            length = branch_length * random_generator.uniform(0.85, 1.15)
            droop = random_generator.uniform(0.14, 0.28)
            pitch = random_generator.uniform(0.0, 0.18)
            width = 0.5 + 0.45 * length / 2.7
            height = tier_height + random_generator.uniform(-0.15, 0.15)
            base = (0.12 * math.cos(yaw), 0.12 * math.sin(yaw), height)
            is_snowy = tier_index > 0 and random_generator.random() < 0.85
            shade = tier_shade * random_generator.uniform(0.85, 1.1)
            add_frond(builder, base, yaw, length, width * 1.15, droop, random_generator.uniform(-0.15, 0.15), pitch, is_snowy, shade, frond_segments)
            for side_index in range(side_fronds):
                side = 1.0 if side_index % 2 == 0 else -1.0
                side_yaw = yaw + side * random_generator.uniform(0.18, 0.3)
                side_base = (base[0], base[1], height - 0.12 - 0.05 * side_index)
                add_frond(builder, side_base, side_yaw, length * random_generator.uniform(0.7, 0.85), width * 0.85, droop * 1.3, side * random_generator.uniform(0.45, 0.75), pitch - 0.08, False, shade * 0.8, frond_segments)
            if snow_clumps and is_snowy and length > 0.9 and random_generator.random() < 0.6:
                add_snow_clump(builder, base, yaw, length, droop, pitch, random_generator)
    for leader_index in range(3):
        leader_yaw = leader_index * 2 * math.pi / 3
        add_frond(builder, (0, 0, tree_height - 1.3), leader_yaw, 1.1, 0.55, -0.05, 0.0, 0.95, leader_index == 0, 1.0)


def build_mountains(builder):
    """A ring of snowy peaks from 140 m to 1.4 km, tallest behind the ryokan (+Y)."""
    angle_segments = 900
    ring_count = 120
    ring_radii = [140.0 * (1.4 / 0.14) ** (index / ring_count) for index in range(ring_count + 1)]

    def mountain_height(x_value, y_value):
        radius = math.hypot(x_value, y_value)
        angle = math.atan2(y_value, x_value)
        behind = 0.5 + 0.5 * math.sin(angle)
        envelope = smoothstep(180.0, 850.0, radius) * (1.0 - 0.3 * smoothstep(1100.0, 1400.0, radius))
        ridge_sum = 0.0
        amplitude = 1.0
        frequency = 1.0 / 260.0
        previous_ridge = 1.0
        for _ in range(8):
            sample = noise.noise(Vector((x_value * frequency, y_value * frequency, 1.7)))
            ridge = 1.0 - abs(sample)
            ridge_sum += ridge * ridge * amplitude * (0.35 + 0.65 * previous_ridge)
            previous_ridge = ridge
            amplitude *= 0.5
            frequency *= 2.05
        peak_scale = 70.0 + 190.0 * behind
        return envelope * peak_scale * ridge_sum - 6.0 + 22.0 * smoothstep(140.0, 260.0, radius)

    def position_function(u_value, v_value):
        angle = u_value * 2.0 * math.pi
        radius = ring_radii[min(ring_count, int(round(v_value * ring_count)))]
        x_value = radius * math.cos(angle)
        y_value = radius * math.sin(angle)
        return Vector((x_value, y_value, mountain_height(x_value, y_value)))

    def color_function(position, normal):
        height = position.z
        slope = normal.z
        variation = fractal_noise(position.x / 40.0, position.y / 40.0, 0.5, octaves=3)
        streaks = fractal_noise(position.x / 9.0, position.y / 9.0, position.z / 30.0, octaves=3)
        rock = mix_rgb((0.24, 0.23, 0.22), (0.4, 0.38, 0.36), 0.5 + 0.5 * variation)
        snow = mix_rgb((0.86, 0.89, 0.94), (0.96, 0.97, 1.0), 0.5 + 0.5 * variation)
        snow_amount = smoothstep(0.3, 0.55, slope + 0.12 * variation + 0.18 * streaks)
        color = mix_rgb(rock, snow, snow_amount)
        forest_amount = (1.0 - smoothstep(110.0, 190.0, height + 40.0 * variation)) * smoothstep(0.55, 0.75, slope)
        forest_speckle = 0.6 + 0.4 * smoothstep(-0.2, 0.4, fractal_noise(position.x / 8.0, position.y / 8.0, 3.0, octaves=2))
        forest = mix_rgb((0.13, 0.17, 0.13), SNOW_WHITE, 0.35 * (1.0 - forest_speckle))
        color = mix_rgb(color, forest, forest_amount * forest_speckle)
        return (*color, 1.0)

    from lib_mesh import add_grid_surface

    add_grid_surface(builder, "mountain", position_function, angle_segments, ring_count, color_function, lambda position: (position.x / 40.0, position.y / 40.0), smooth=True)
    return mountain_height


def scatter_pines(path_points, keep_out_rectangles, ground_height_function):
    """Pine transforms in Blender coordinates: near detailed pines and far simple ones."""
    random_generator = seeded_random(2024)
    near_pines = []
    far_pines = []
    dense_path = []
    for start, end in zip(path_points[:-1], path_points[1:]):
        steps = max(1, int(math.hypot(end[0] - start[0], end[1] - start[1]) / 0.5))
        for step in range(steps):
            fraction = step / steps
            dense_path.append((start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction))
    dense_path.append(path_points[-1])

    def is_clear(x_value, y_value, margin):
        for min_x, min_y, max_x, max_y in keep_out_rectangles:
            if min_x - margin < x_value < max_x + margin and min_y - margin < y_value < max_y + margin:
                return False
        for point in dense_path:
            if math.hypot(x_value - point[0], y_value - point[1]) < 5.0 + margin:
                return False
        return True

    attempts = 0
    while len(near_pines) < 30 and attempts < 8000:
        attempts += 1
        angle = random_generator.uniform(0, 2 * math.pi)
        distance = random_generator.uniform(10.0, 34.0)
        x_value = distance * math.cos(angle)
        y_value = distance * math.sin(angle) + 4.0
        if not is_clear(x_value, y_value, 2.5):
            continue
        if math.hypot(x_value, y_value) < 10.0:
            continue
        is_in_front_of_pool = y_value < 1.0
        if is_in_front_of_pool and math.hypot(x_value, y_value) < 24.0:
            continue
        if any(math.hypot(x_value - other[0], y_value - other[1]) < 3.4 for other in near_pines):
            continue
        scale = random_generator.uniform(0.75, 1.35)
        near_pines.append((x_value, y_value, ground_height_function(x_value, y_value) - 0.1, random_generator.uniform(0, 2 * math.pi), scale, random_generator.randrange(2)))
    attempts = 0
    while len(far_pines) < 900 and attempts < 30000:
        attempts += 1
        x_value = random_generator.uniform(-150, 150)
        y_value = random_generator.uniform(-150, 150)
        distance = math.hypot(x_value, y_value)
        if distance < 30.0 or distance > 150.0:
            continue
        clump = fractal_noise(x_value / 30.0, y_value / 30.0, 8.0, octaves=2)
        if clump < -0.05:
            continue
        scale = random_generator.uniform(0.8, 1.5)
        far_pines.append((x_value, y_value, ground_height_function(x_value, y_value) - 0.2, random_generator.uniform(0, 2 * math.pi), scale, 0))
    return near_pines, far_pines
