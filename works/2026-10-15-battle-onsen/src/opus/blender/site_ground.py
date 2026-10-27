"""Terrain, pool basin, rim rocks, snow piles and shrubs."""
import math

from mathutils import Vector

from nature import add_frond

from lib_mesh import (
    add_blob,
    assign_box_uvs,
    add_grid_surface,
    fractal_noise,
    mix_rgb,
    paint_faces,
    placement_matrix,
    seeded_random,
    smoothstep,
    clamp_unit,
)
from site_layout import (
    INNER_TERRAIN_HALF_SIZE,
    WATER_LEVEL,
    ground_height,
    pool_radius_at,
    pool_ratio,
    hill_height,
)

SNOW_WHITE = (0.93, 0.95, 0.98)
WET_EARTH = (0.24, 0.22, 0.2)
POOL_PEBBLES = (0.42, 0.45, 0.38)
ROCK_BASE = (0.42, 0.40, 0.37)


def ground_color(position, normal):
    ratio = pool_ratio(position.x, position.y)
    variation = fractal_noise(position.x, position.y, 0.0, octaves=3, base_scale=1.5)
    if ratio < 1.0:
        pebble = mix_rgb(POOL_PEBBLES, (0.3, 0.34, 0.27), 0.5 + 0.5 * variation)
        return (*pebble, 1.0)
    wet_amount = 1.0 - smoothstep(1.02, 1.3 + 0.12 * variation, ratio)
    snow = mix_rgb(SNOW_WHITE, (0.86, 0.89, 0.94), 0.5 + 0.5 * fractal_noise(position.x, position.y, 4.0, octaves=2, base_scale=6.0))
    slope_rock = smoothstep(0.75, 0.55, normal.z)
    color = mix_rgb(snow, (0.38, 0.36, 0.34), slope_rock * 0.7)
    color = mix_rgb(color, WET_EARTH, wet_amount)
    return (*color, 1.0)


def terrain_uv(position):
    return (position.x / 2.0, position.y / 2.0)


def build_inner_terrain(builder):
    half_size = INNER_TERRAIN_HALF_SIZE
    cells = 128

    def position_function(u_value, v_value):
        x_value = -half_size + 2.0 * half_size * u_value
        y_value = -half_size + 2.0 * half_size * v_value
        return Vector((x_value, y_value, ground_height(x_value, y_value)))

    add_grid_surface(builder, "ground", position_function, cells, cells, ground_color, terrain_uv)


def build_outer_terrain(builder):
    """Hills from 16 m out to 160 m, with the inner square cut out so the two grids meet on shared edges."""


    part_bmesh = builder.bmesh_for("ground")
    uv_layer = part_bmesh.loops.layers.uv["UVMap"]
    half_extent = 160.0
    step = 4.0
    count = int(2 * half_extent / step)
    vert_grid = {}
    for index_y in range(count + 1):
        for index_x in range(count + 1):
            x_value = -half_extent + index_x * step
            y_value = -half_extent + index_y * step
            vert_grid[(index_x, index_y)] = part_bmesh.verts.new((x_value, y_value, hill_height(x_value, y_value)))
    faces = []
    inner = INNER_TERRAIN_HALF_SIZE
    for index_y in range(count):
        for index_x in range(count):
            x_low = -half_extent + index_x * step
            y_low = -half_extent + index_y * step
            if x_low >= -inner and x_low + step <= inner and y_low >= -inner and y_low + step <= inner:
                continue
            face = part_bmesh.faces.new(
                [
                    vert_grid[(index_x, index_y)],
                    vert_grid[(index_x + 1, index_y)],
                    vert_grid[(index_x + 1, index_y + 1)],
                    vert_grid[(index_x, index_y + 1)],
                ]
            )
            face.smooth = True
            faces.append(face)
    part_bmesh.normal_update()
    for face in faces:
        for loop in face.loops:
            loop[uv_layer].uv = terrain_uv(loop.vert.co)
    paint_faces(part_bmesh, faces, ground_color)


def rock_color_function(snow_allowed):
    def color_function(position, normal):
        variation = fractal_noise(position.x * 2.0, position.y * 2.0, position.z * 2.0, octaves=3, base_scale=0.6)
        color = mix_rgb(ROCK_BASE, (0.3, 0.29, 0.27), 0.5 + 0.5 * variation)
        lichen = smoothstep(0.2, 0.6, fractal_noise(position.x, position.y, position.z + 7.0, octaves=2, base_scale=0.4))
        color = mix_rgb(color, (0.46, 0.47, 0.36), lichen * 0.35)
        wet = 1.0 - smoothstep(WATER_LEVEL + 0.02, WATER_LEVEL + 0.22, position.z)
        color = mix_rgb(color, (0.17, 0.19, 0.15), wet * 0.85)
        # Snow on stone is added per pixel in the browser (src/surface-snow.js), so the colour here is bare rock.
        return (*color, 1.0)

    return color_function


def snow_on_rock_allowed(ratio, height):
    steam_melt = smoothstep(1.03, 1.22, ratio)
    return steam_melt * smoothstep(WATER_LEVEL + 0.25, WATER_LEVEL + 0.4, height)


def rock_deform_function(random_generator, roughness):
    """Noise plus a handful of flat cleavage planes, so stones read as split granite, not blobs."""
    seed_offset = random_generator.uniform(0, 100)
    cut_planes = []
    for _ in range(7):
        plane_normal = Vector((random_generator.uniform(-1, 1), random_generator.uniform(-1, 1), random_generator.uniform(-0.4, 1))).normalized()
        cut_planes.append((plane_normal, random_generator.uniform(0.72, 0.92)))

    def deform(position):
        direction = position.normalized()
        displacement = fractal_noise(direction.x * 1.6 + seed_offset, direction.y * 1.6, direction.z * 1.6, octaves=4, base_scale=1.0)
        detail = fractal_noise(direction.x * 6.0 + seed_offset, direction.y * 6.0, direction.z * 6.0, octaves=3, base_scale=1.0)
        result = position * (1.0 + roughness * displacement + 0.05 * detail)
        radius = position.length
        for plane_normal, plane_offset in cut_planes:
            reach = result.dot(plane_normal) - plane_offset * radius
            if reach > 0.0:
                result = result - plane_normal * reach * 0.92
        if result.z < -0.15 * radius:
            result.z = -0.15 * radius + (result.z + 0.15 * radius) * 0.3
        snow_lift = smoothstep(0.45, 0.85, direction.z) * 0.06 * radius
        result.z += snow_lift
        return result

    return deform


def add_rock(builder, location, radius, scale, rotation_z, random_generator, snow_allowed=snow_on_rock_allowed, roughness=0.22):
    faces = add_blob(
        builder,
        "stone",
        radius,
        scale,
        placement_matrix(location, rotation_z, random_generator.uniform(-0.15, 0.15), random_generator.uniform(-0.15, 0.15)),
        rock_color_function(snow_allowed),
        subdivisions=4,
        deform=rock_deform_function(random_generator, roughness),
        uv_scale=0.8,
    )
    return faces


def add_snow_shell(builder, rock_faces, max_thickness, snow_allowed, random_generator):
    """Snow lying on a rock: its upward-facing surface pushed out and up, thinning to nothing where the rock
    turns steep, so the snow follows the stone instead of sitting on it like a lid."""
    seed_offset = random_generator.uniform(0, 50)
    snow_bmesh = builder.bmesh_for("snow")

    def thickness_at(vert):
        position = vert.co
        lump = fractal_noise(position.x * 2.2 + seed_offset, position.y * 2.2, position.z * 2.2, octaves=3, base_scale=1.0)
        cover = smoothstep(0.62, 0.93, vert.normal.z + 0.12 * lump)
        cover *= snow_allowed(pool_ratio(position.x, position.y), position.z)
        return cover * max_thickness * (1.0 + 0.45 * lump)

    shell_verts = {}
    shell_faces = []
    for face in rock_faces:
        thicknesses = [thickness_at(vert) for vert in face.verts]
        if max(thicknesses) < 0.004:
            continue
        corners = []
        for vert, thickness in zip(face.verts, thicknesses):
            if vert not in shell_verts:
                offset = vert.normal * (0.004 + thickness * 0.6) + Vector((0.0, 0.0, thickness * 0.4))
                shell_verts[vert] = snow_bmesh.verts.new(vert.co + offset)
            corners.append(shell_verts[vert])
        shell_face = snow_bmesh.faces.new(corners)
        shell_face.smooth = True
        shell_faces.append(shell_face)
    snow_bmesh.normal_update()
    assign_box_uvs(snow_bmesh, shell_faces, 0.6)

    def color_function(position, normal):
        shade = 0.95 + 0.05 * fractal_noise(position.x * 4, position.y * 4, position.z * 4, octaves=2)
        return (0.95 * shade, 0.965 * shade, 0.99 * shade, 1.0)

    paint_faces(snow_bmesh, shell_faces, color_function)


def build_rim_rocks(builder):
    random_generator = seeded_random(4242)
    rock_count = 38
    for index in range(rock_count):
        angle = 2.0 * math.pi * (index + random_generator.uniform(-0.25, 0.25)) / rock_count
        is_deck_side = 1.25 < angle < 1.95
        is_camera_side = 3.8 < angle < 5.7
        radius_from_center = pool_radius_at(angle) + random_generator.uniform(0.05, 0.3)
        location_x = radius_from_center * math.cos(angle)
        location_y = radius_from_center * math.sin(angle)
        size = random_generator.uniform(0.42, 0.72)
        if is_deck_side:
            scale = (random_generator.uniform(1.2, 1.5), random_generator.uniform(0.9, 1.1), 0.36)
            location_z = 0.02
        elif is_camera_side:
            # Low, flat stones on the near side so the water stays visible from the start of the path.
            scale = (random_generator.uniform(1.2, 1.5), random_generator.uniform(0.85, 1.05), random_generator.uniform(0.34, 0.44))
            location_z = random_generator.uniform(-0.1, -0.03)
        else:
            scale = (random_generator.uniform(1.0, 1.45), random_generator.uniform(0.8, 1.05), random_generator.uniform(0.5, 0.75))
            location_z = random_generator.uniform(-0.04, 0.1)
        faces = add_rock(builder, (location_x, location_y, location_z), size, scale, angle + random_generator.uniform(-0.4, 0.4), random_generator)
        if not is_deck_side:
            add_snow_shell(builder, faces, 0.08, snow_on_rock_allowed, random_generator)
    build_outer_boulders(builder, random_generator)
    build_submerged_stones(builder, random_generator)


def build_outer_boulders(builder, random_generator):
    """A second ring of larger stones behind the pool, mostly on the far left and right."""
    boulder_specs = [
        (2.35, 1.05, (1.3, 1.0, 0.8)),
        (2.6, 0.9, (1.2, 1.1, 0.9)),
        (2.95, 0.8, (1.4, 0.9, 0.7)),
        (3.3, 0.75, (1.1, 1.0, 0.75)),
        (3.65, 0.7, (1.3, 1.0, 0.6)),
        (-0.35, 0.85, (1.3, 1.0, 0.7)),
        (0.15, 0.7, (1.2, 0.9, 0.65)),
        (-0.75, 0.65, (1.1, 1.0, 0.6)),
        (4.1, 0.6, (1.2, 0.9, 0.6)),
        (5.0, 0.62, (1.3, 1.0, 0.55)),
    ]
    for angle, size, scale in boulder_specs:
        radius_from_center = pool_radius_at(angle) + 0.75 + random_generator.uniform(0.0, 0.3)
        location = (radius_from_center * math.cos(angle), radius_from_center * math.sin(angle), size * 0.15)
        faces = add_rock(builder, location, size, scale, angle + random_generator.uniform(-0.6, 0.6), random_generator, snow_allowed=lambda ratio, height: 1.0)
        add_snow_shell(builder, faces, 0.13, lambda ratio, height: 1.0, random_generator)


def build_submerged_stones(builder, random_generator):
    for _ in range(14):
        angle = random_generator.uniform(0, 2.0 * math.pi)
        distance = pool_radius_at(angle) * random_generator.uniform(0.2, 0.85)
        location = (distance * math.cos(angle), distance * math.sin(angle), ground_height(distance * math.cos(angle), distance * math.sin(angle)) + 0.03)
        size = random_generator.uniform(0.12, 0.3)
        add_rock(builder, location, size, (1.3, 1.0, 0.5), angle, random_generator, snow_allowed=lambda ratio, height: 0.0)


def snow_pile_color(position, normal):
    shade = 0.94 + 0.05 * fractal_noise(position.x * 3, position.y * 3, position.z * 3, octaves=2)
    return (0.94 * shade, 0.96 * shade, 0.99 * shade, 1.0)


def add_snow_pile(builder, location, size, scale, rotation_z, random_generator):
    seed_offset = random_generator.uniform(0, 80)

    def deform(position):
        bump = 1.0 + 0.16 * fractal_noise(position.x * 1.5 + seed_offset, position.y * 1.5, position.z * 1.5, octaves=3, base_scale=1.0)
        result = position * bump
        if result.z < 0:
            result.z *= 0.2
        return result

    add_blob(builder, "snow", size, scale, placement_matrix(location, rotation_z), snow_pile_color, subdivisions=3, deform=deform, uv_scale=0.6)


def build_snow_piles(builder):
    random_generator = seeded_random(99)
    piles = [
        ((-6.4, 4.5, -0.1), 1.1, (1.6, 1.0, 0.55)),
        ((-6.6, 1.0, -0.1), 0.9, (1.4, 1.0, 0.5)),
        ((10.3, 8.9, -0.1), 1.0, (1.5, 1.1, 0.6)),
        ((7.4, -6.0, -0.15), 1.4, (1.8, 1.2, 0.5)),
        ((-4.0, -6.8, -0.1), 1.0, (1.7, 1.0, 0.45)),
        ((3.9, -9.9, -0.1), 0.9, (1.6, 1.1, 0.4)),
        ((-6.9, 9.6, -0.05), 0.8, (1.3, 1.0, 0.6)),
        ((6.0, 9.6, -0.05), 0.8, (1.2, 1.0, 0.65)),
    ]
    for location, size, scale in piles:
        add_snow_pile(builder, location, size, scale, random_generator.uniform(0, 3.0), random_generator)


def build_shrubs(builder):
    """Dwarf pine clumps under snow, like a ryokan garden: a dense core per lump with needle sprays breaking its outline."""
    random_generator = seeded_random(7)
    shrub_locations = [(-5.9, 7.2), (-4.3, -4.4), (8.4, -2.8), (-6.2, -3.4), (10.4, 6.8), (-6.1, 2.6)]
    for x_value, y_value in shrub_locations:
        base_height = ground_height(x_value, y_value) - 0.05
        lump_count = random_generator.randrange(4, 7)
        for lump_index in range(lump_count):
            angle = random_generator.uniform(0, 2 * math.pi)
            spread = random_generator.uniform(0.0, 0.55) if lump_index > 0 else 0.0
            lump_size = random_generator.uniform(0.32, 0.5) * (1.15 if lump_index == 0 else 1.0)
            seed_offset = random_generator.uniform(0, 60)

            def leaf_deform(position, seed_offset=seed_offset):
                bump = 1.0 + 0.14 * fractal_noise(position.x * 7 + seed_offset, position.y * 7, position.z * 7, octaves=3, base_scale=1.0)
                result = position * bump
                if result.z < 0:
                    result.z *= 0.4
                else:
                    result.z *= 1.12
                return result

            def leaf_color(position, normal):
                shade = 0.5 + 0.5 * fractal_noise(position.x * 9, position.y * 9, position.z * 9, octaves=2)
                green = mix_rgb((0.13, 0.21, 0.11), (0.22, 0.31, 0.16), shade)
                snow_noise = fractal_noise(position.x * 3, position.y * 3, position.z * 3 + 5.0, octaves=2)
                snow_amount = smoothstep(0.35, 0.65, normal.z + 0.3 * snow_noise)
                return (*mix_rgb(green, SNOW_WHITE, snow_amount), 1.0)

            location = (x_value + spread * math.cos(angle), y_value + spread * math.sin(angle), base_height + random_generator.uniform(0.0, 0.12))
            add_blob(builder, "foliage_core", lump_size * 0.85, (1.25, 1.1, 0.85), placement_matrix(location, random_generator.uniform(0, 3)), leaf_color, subdivisions=3, deform=leaf_deform)
            add_shrub_sprays(builder, location, lump_size, random_generator)


def add_shrub_sprays(builder, center, lump_size, random_generator):
    spray_count = 14
    for spray_index in range(spray_count):
        yaw = spray_index * 2 * math.pi / spray_count + random_generator.uniform(-0.25, 0.25)
        pitch = random_generator.uniform(-0.15, 0.35)
        length = lump_size * random_generator.uniform(0.8, 1.1)
        base = (center[0] + 0.15 * math.cos(yaw), center[1] + 0.15 * math.sin(yaw), center[2] + random_generator.uniform(-0.1, 0.12))
        is_snowy = random_generator.random() < 0.75
        add_frond(builder, base, yaw, length, 0.42, 0.18, random_generator.uniform(-0.3, 0.3), pitch, is_snowy, random_generator.uniform(0.75, 1.0))
