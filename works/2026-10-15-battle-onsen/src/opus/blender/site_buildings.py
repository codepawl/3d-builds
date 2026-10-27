"""Ryokan, deck, roofs with snow, stone lantern, bamboo spout, fence and buckets."""
import math

from mathutils import Matrix, Vector

from lib_mesh import (
    add_blob,
    add_box,
    add_cylinder,
    add_grid_surface,
    fractal_noise,
    mix_rgb,
    placement_matrix,
    seeded_random,
    smoothstep,
    solid_color,
)
from site_layout import (
    DECK_MAX_X,
    DECK_MAX_Y,
    DECK_MIN_X,
    DECK_MIN_Y,
    DECK_TOP,
    FENCE_MAX_Y,
    FENCE_MIN_Y,
    FENCE_X,
    LANTERN_POSITION,
    RYOKAN_BACK_Y,
    RYOKAN_FLOOR,
    RYOKAN_FRONT_Y,
    RYOKAN_GROUND_WALL_TOP,
    RYOKAN_LEFT_X,
    RYOKAN_RIGHT_X,
    SPOUT_END,
    SPOUT_START,
)

WHITE = solid_color((1.0, 1.0, 1.0))
SNOW_COLOR = solid_color((0.95, 0.965, 0.99), jitter=0.03, jitter_scale=0.5)
DARK_WOOD_COLOR = solid_color((1.0, 1.0, 1.0), jitter=0.08, jitter_scale=2.0)
WEATHERED_WOOD_COLOR = solid_color((0.9, 0.9, 0.92), jitter=0.12, jitter_scale=1.5)
STONE_COLOR = solid_color((0.62, 0.6, 0.57), jitter=0.15, jitter_scale=0.4)


def box_between(builder, material, minimum, maximum, color=DARK_WOOD_COLOR, bevel=0.0, uv_scale=1.0):
    size = (maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2])
    center = ((maximum[0] + minimum[0]) * 0.5, (maximum[1] + minimum[1]) * 0.5, (maximum[2] + minimum[2]) * 0.5)
    return add_box(builder, material, size, placement_matrix(center), color, bevel=bevel, uv_scale=uv_scale)


def beam_between(builder, material, start, end, width, height, color=DARK_WOOD_COLOR, uv_scale=1.0):
    """A box running from start to end, with its long axis on local X so wood grain follows it."""
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    length = direction.length
    center = (start_vector + end_vector) * 0.5
    rotation = direction.to_track_quat("X", "Z").to_matrix().to_4x4()
    world_matrix = Matrix.Translation(center) @ rotation
    return add_box(builder, material, (length, width, height), world_matrix, color, uv_scale=uv_scale)


# ---------------------------------------------------------------- deck


def build_deck(builder):
    plank_width = 0.145
    gap = 0.012
    plank_thickness = 0.045
    random_generator = seeded_random(3)
    y_position = DECK_MIN_Y
    while y_position + plank_width <= DECK_MAX_Y + 0.001:
        tint = random_generator.uniform(0.82, 1.0)
        color = solid_color((tint, tint * 0.98, tint * 0.96), jitter=0.1, jitter_scale=1.2, seed_offset=y_position * 13.0)
        offset = random_generator.uniform(0, 3)
        faces = box_between(
            builder,
            "deck_wood",
            (DECK_MIN_X, y_position, DECK_TOP - plank_thickness),
            (DECK_MAX_X, y_position + plank_width, DECK_TOP),
            color,
            uv_scale=1.6,
        )
        shift_uvs(builder, "deck_wood", faces, offset)
        y_position += plank_width + gap
    box_between(builder, "dark_wood", (DECK_MIN_X + 0.02, DECK_MIN_Y + 0.02, DECK_TOP - plank_thickness - 0.03), (DECK_MAX_X - 0.02, DECK_MAX_Y, DECK_TOP - plank_thickness - 0.005), solid_color((0.25, 0.22, 0.2)), uv_scale=1.5)
    for x_value in (DECK_MIN_X + 0.1, -2.6, -0.2, 2.2, 4.6, 6.5, DECK_MAX_X - 0.1):
        box_between(builder, "dark_wood", (x_value - 0.06, DECK_MIN_Y, -0.2), (x_value + 0.06, DECK_MAX_Y, DECK_TOP - plank_thickness))
    for y_value in (DECK_MIN_Y + 0.08, 6.4, DECK_MAX_Y - 0.08):
        for x_value in (DECK_MIN_X + 0.1, -0.2, 4.6, DECK_MAX_X - 0.1):
            box_between(builder, "dark_wood", (x_value - 0.07, y_value - 0.07, -0.3), (x_value + 0.07, y_value + 0.07, DECK_TOP - 0.15))
    box_between(builder, "dark_wood", (DECK_MIN_X - 0.03, DECK_MIN_Y - 0.03, DECK_TOP - 0.2), (DECK_MAX_X + 0.03, DECK_MIN_Y + 0.01, DECK_TOP - 0.02))
    box_between(builder, "dark_wood", (DECK_MAX_X - 0.01, DECK_MIN_Y - 0.03, DECK_TOP - 0.2), (DECK_MAX_X + 0.03, DECK_MAX_Y, DECK_TOP - 0.02))
    box_between(builder, "dark_wood", (DECK_MIN_X - 0.03, DECK_MIN_Y - 0.03, DECK_TOP - 0.2), (DECK_MIN_X + 0.01, DECK_MAX_Y, DECK_TOP - 0.02))
    add_box(builder, "stone", (1.1, 0.5, 0.16), placement_matrix((1.25, 3.55, 0.12), 0.04), STONE_COLOR, bevel=0.03, uv_scale=0.6)
    add_box(builder, "stone", (0.9, 0.42, 0.14), placement_matrix((1.3, 3.15, -0.06), -0.06), solid_color((0.4, 0.4, 0.37), jitter=0.15, jitter_scale=0.3), bevel=0.03, uv_scale=0.6)


def shift_uvs(builder, material, faces, offset):
    uv_layer = builder.bmesh_for(material).loops.layers.uv["UVMap"]
    for face in faces:
        for loop in face.loops:
            loop[uv_layer].uv.x += offset


# ---------------------------------------------------------------- ryokan walls


def build_ryokan(builder):
    box_between(builder, "stone", (RYOKAN_LEFT_X - 0.1, RYOKAN_FRONT_Y, -0.2), (RYOKAN_RIGHT_X + 0.1, RYOKAN_BACK_Y + 0.1, RYOKAN_FLOOR), STONE_COLOR, uv_scale=0.8)
    build_engawa(builder)
    build_ground_floor_walls(builder)
    build_front_bays(builder)
    build_upper_floor(builder)
    lower_roof_eave = (RYOKAN_LEFT_X - 1.75, RYOKAN_FRONT_Y - 1.75, RYOKAN_RIGHT_X + 1.75, RYOKAN_BACK_Y + 1.75)
    build_hipped_roof(builder, lower_roof_eave, 2.47, 0.42, seed=1)
    upper_roof_eave = (-6.7, 9.9, 5.7, 16.6)
    build_hipped_roof(builder, upper_roof_eave, 5.72, 0.55, seed=2)
    build_paper_lantern(builder)


def build_engawa(builder):
    floor_top = RYOKAN_FLOOR - 0.02
    y_start = DECK_MAX_Y
    plank_count = int((RYOKAN_FRONT_Y - y_start) / 0.16)
    for index in range(plank_count):
        y_low = y_start + index * 0.16
        box_between(builder, "deck_wood", (RYOKAN_LEFT_X, y_low, floor_top - 0.04), (RYOKAN_RIGHT_X, y_low + 0.15, floor_top), WEATHERED_WOOD_COLOR, uv_scale=1.6)
    box_between(builder, "dark_wood", (RYOKAN_LEFT_X, y_start - 0.02, DECK_TOP - 0.02), (RYOKAN_RIGHT_X, RYOKAN_FRONT_Y, floor_top - 0.04))
    for x_value in (-6.35, -2.5, 1.5, 5.35):
        box_between(builder, "dark_wood", (x_value - 0.09, 9.0, floor_top), (x_value + 0.09, 9.18, 2.66))
    beam_between(builder, "dark_wood", (RYOKAN_LEFT_X - 0.3, 9.09, 2.55), (RYOKAN_RIGHT_X + 0.3, 9.09, 2.55), 0.16, 0.18)
    add_box(builder, "stone", (0.7, 0.4, 0.2), placement_matrix((-1.5, 8.75, 0.42), 0.0), STONE_COLOR, bevel=0.03, uv_scale=0.6)


def build_ground_floor_walls(builder):
    wall_bottom = RYOKAN_FLOOR
    wall_top = RYOKAN_GROUND_WALL_TOP
    plaster = solid_color((0.93, 0.9, 0.84), jitter=0.04, jitter_scale=2.0)
    box_between(builder, "plaster", (RYOKAN_LEFT_X, RYOKAN_FRONT_Y + 0.05, wall_bottom), (RYOKAN_LEFT_X + 0.12, RYOKAN_BACK_Y, wall_top), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (RYOKAN_RIGHT_X - 0.12, RYOKAN_FRONT_Y + 0.05, wall_bottom), (RYOKAN_RIGHT_X, RYOKAN_BACK_Y, wall_top), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (RYOKAN_LEFT_X, RYOKAN_BACK_Y - 0.12, wall_bottom), (RYOKAN_RIGHT_X, RYOKAN_BACK_Y, wall_top), plaster, uv_scale=2.0)
    for y_value in (RYOKAN_FRONT_Y, 12.0, 14.0, RYOKAN_BACK_Y - 0.06):
        for x_value in (RYOKAN_LEFT_X, RYOKAN_RIGHT_X):
            box_between(builder, "dark_wood", (x_value - 0.09, y_value - 0.09, wall_bottom - 0.05), (x_value + 0.09, y_value + 0.09, wall_top + 0.05))
    for x_value in (RYOKAN_LEFT_X - 0.02, RYOKAN_RIGHT_X - 0.1):
        beam_between(builder, "dark_wood", (x_value + 0.06, RYOKAN_FRONT_Y, wall_bottom + 0.08), (x_value + 0.06, RYOKAN_BACK_Y, wall_bottom + 0.08), 0.14, 0.12)
        beam_between(builder, "dark_wood", (x_value + 0.06, RYOKAN_FRONT_Y, 2.35), (x_value + 0.06, RYOKAN_BACK_Y, 2.35), 0.14, 0.12)
    side_window(builder, RYOKAN_RIGHT_X + 0.01, 12.6, 1.4, 1.0, "right")
    side_window(builder, RYOKAN_LEFT_X - 0.01, 13.2, 1.4, 1.0, "left")


def side_window(builder, x_value, y_center, width, height, side):
    z_bottom = RYOKAN_FLOOR + 0.95
    outward = 1.0 if side == "right" else -1.0
    shoji_x = x_value + outward * 0.005
    box_between(builder, "shoji", (min(shoji_x, shoji_x + outward * 0.02), y_center - width / 2, z_bottom), (max(shoji_x, shoji_x + outward * 0.02), y_center + width / 2, z_bottom + height), WHITE)
    frame_x = x_value + outward * 0.04
    for z_value in (z_bottom - 0.05, z_bottom + height):
        box_between(builder, "dark_wood", (frame_x - 0.04, y_center - width / 2 - 0.06, z_value), (frame_x + 0.04, y_center + width / 2 + 0.06, z_value + 0.06))
    for y_value in (y_center - width / 2 - 0.06, y_center + width / 2):
        box_between(builder, "dark_wood", (frame_x - 0.04, y_value, z_bottom - 0.05), (frame_x + 0.04, y_value + 0.06, z_bottom + height + 0.06))
    for index in range(1, 8):
        y_value = y_center - width / 2 + index * width / 8
        box_between(builder, "bamboo", (frame_x + outward * 0.03 - 0.012, y_value - 0.012, z_bottom), (frame_x + outward * 0.03 + 0.012, y_value + 0.012, z_bottom + height), solid_color((0.75, 0.7, 0.55)))


def build_front_bays(builder):
    bay_width = 2.0
    wall_y = RYOKAN_FRONT_Y
    for bay_index in range(7):
        x_value = RYOKAN_LEFT_X + bay_index * bay_width
        box_between(builder, "dark_wood", (x_value - 0.09, wall_y - 0.09, RYOKAN_FLOOR - 0.05), (x_value + 0.09, wall_y + 0.09, RYOKAN_GROUND_WALL_TOP + 0.05))
    beam_between(builder, "dark_wood", (RYOKAN_LEFT_X, wall_y - 0.02, 2.75), (RYOKAN_RIGHT_X, wall_y - 0.02, 2.75), 0.2, 0.2)
    beam_between(builder, "dark_wood", (RYOKAN_LEFT_X, wall_y - 0.04, RYOKAN_FLOOR + 2.12), (RYOKAN_RIGHT_X, wall_y - 0.04, RYOKAN_FLOOR + 2.12), 0.12, 0.1)
    for bay_index in range(6):
        x_start = RYOKAN_LEFT_X + bay_index * bay_width + 0.09
        x_end = x_start + bay_width - 0.18
        if bay_index == 5:
            build_plaster_bay_with_window(builder, x_start, x_end)
        else:
            build_shoji_bay(builder, x_start, x_end, bay_index == 2)
    box_between(builder, "plaster", (RYOKAN_LEFT_X, wall_y, RYOKAN_FLOOR + 2.17), (RYOKAN_RIGHT_X, wall_y + 0.1, RYOKAN_GROUND_WALL_TOP), solid_color((0.93, 0.9, 0.84), jitter=0.04), uv_scale=2.0)


def build_shoji_bay(builder, x_start, x_end, is_entrance):
    wall_y = RYOKAN_FRONT_Y
    panel_bottom = RYOKAN_FLOOR + (0.05 if is_entrance else 0.42)
    panel_top = RYOKAN_FLOOR + 2.07
    if not is_entrance:
        box_between(builder, "dark_wood", (x_start, wall_y - 0.02, RYOKAN_FLOOR), (x_end, wall_y + 0.06, panel_bottom), DARK_WOOD_COLOR, uv_scale=0.8)
    middle = (x_start + x_end) * 0.5
    for panel_start, panel_end, depth_offset in ((x_start, middle + 0.02, 0.0), (middle - 0.02, x_end, 0.035)):
        panel_y = wall_y + depth_offset
        box_between(builder, "shoji", (panel_start + 0.04, panel_y, panel_bottom + 0.04), (panel_end - 0.04, panel_y + 0.015, panel_top - 0.04), WHITE)
        frame_y = panel_y - 0.015
        box_between(builder, "dark_wood", (panel_start, frame_y, panel_bottom), (panel_end, frame_y + 0.045, panel_bottom + 0.05))
        box_between(builder, "dark_wood", (panel_start, frame_y, panel_top - 0.05), (panel_end, frame_y + 0.045, panel_top))
        box_between(builder, "dark_wood", (panel_start, frame_y, panel_bottom), (panel_start + 0.045, frame_y + 0.045, panel_top))
        box_between(builder, "dark_wood", (panel_end - 0.045, frame_y, panel_bottom), (panel_end, frame_y + 0.045, panel_top))
    box_between(builder, "dark_wood", (x_start, wall_y - 0.04, panel_top), (x_end, wall_y + 0.06, panel_top + 0.06))
    if is_entrance:
        build_noren(builder, x_start, x_end)


def build_noren(builder, x_start, x_end):
    rod_y = RYOKAN_FRONT_Y - 0.18
    rod_z = RYOKAN_FLOOR + 2.0
    add_cylinder(builder, "bamboo", 0.018, 0.018, x_end - x_start + 0.2, placement_matrix((x_start - 0.1, rod_y, rod_z), 0.0, 0.0, math.pi / 2), solid_color((0.8, 0.75, 0.55)), segments=8)
    strip_count = 3
    strip_width = (x_end - x_start) / strip_count
    for index in range(strip_count):
        strip_start = x_start + index * strip_width + 0.015
        strip_end = strip_start + strip_width - 0.03
        sway = (index - 1) * 0.015

        def position_function(u_value, v_value, strip_start=strip_start, strip_end=strip_end, sway=sway):
            x_value = strip_start + (strip_end - strip_start) * u_value
            z_value = rod_z - 0.95 * v_value
            ripple = 0.012 * math.sin(u_value * math.pi * 3.0) * v_value + sway * v_value * v_value
            return Vector((x_value, rod_y + ripple, z_value))

        def uv_function(position, strip_start=strip_start):
            return ((position.x - strip_start) / (strip_width * 1.0) * 0.33 + index * 0.33, (position.z - rod_z + 0.95) / 0.95)

        add_grid_surface(builder, "noren", position_function, 6, 6, WHITE, uv_function, smooth=True)
        add_grid_surface(builder, "noren", position_function, 6, 6, WHITE, uv_function, smooth=True, flip=True)


def build_plaster_bay_with_window(builder, x_start, x_end):
    wall_y = RYOKAN_FRONT_Y
    plaster = solid_color((0.93, 0.9, 0.84), jitter=0.04)
    window_bottom = RYOKAN_FLOOR + 0.9
    window_top = RYOKAN_FLOOR + 1.75
    window_left = x_start + 0.45
    window_right = x_end - 0.45
    box_between(builder, "plaster", (x_start, wall_y, RYOKAN_FLOOR), (x_end, wall_y + 0.1, window_bottom), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (x_start, wall_y, window_top), (x_end, wall_y + 0.1, RYOKAN_FLOOR + 2.17), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (x_start, wall_y, window_bottom), (window_left, wall_y + 0.1, window_top), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (window_right, wall_y, window_bottom), (x_end, wall_y + 0.1, window_top), plaster, uv_scale=2.0)
    box_between(builder, "shoji", (window_left, wall_y + 0.04, window_bottom), (window_right, wall_y + 0.055, window_top), WHITE)
    for index in range(1, 9):
        x_value = window_left + index * (window_right - window_left) / 9
        box_between(builder, "bamboo", (x_value - 0.012, wall_y - 0.04, window_bottom), (x_value + 0.012, wall_y - 0.016, window_top), solid_color((0.75, 0.7, 0.55)))
    box_between(builder, "dark_wood", (window_left - 0.05, wall_y - 0.05, window_bottom - 0.05), (window_right + 0.05, wall_y + 0.02, window_bottom))
    box_between(builder, "dark_wood", (window_left - 0.05, wall_y - 0.05, window_top), (window_right + 0.05, wall_y + 0.02, window_top + 0.05))


def build_upper_floor(builder):
    left_x = -5.5
    right_x = 4.5
    front_y = 11.0
    back_y = 15.5
    bottom_z = 3.3
    top_z = 5.72
    plaster = solid_color((0.93, 0.9, 0.84), jitter=0.04, jitter_scale=2.0)
    box_between(builder, "plaster", (left_x, front_y + 0.05, bottom_z), (left_x + 0.12, back_y, top_z), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (right_x - 0.12, front_y + 0.05, bottom_z), (right_x, back_y, top_z), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (left_x, back_y - 0.12, bottom_z), (right_x, back_y, top_z), plaster, uv_scale=2.0)
    for x_value in (left_x, -3.0, -0.5, 2.0, right_x):
        box_between(builder, "dark_wood", (x_value - 0.09, front_y - 0.09, bottom_z), (x_value + 0.09, front_y + 0.09, top_z + 0.04))
    for x_value in (left_x, right_x):
        for y_value in (13.25, back_y):
            box_between(builder, "dark_wood", (x_value - 0.09, y_value - 0.09, bottom_z), (x_value + 0.09, y_value + 0.09, top_z + 0.04))
    window_bottom = 4.25
    window_top = 5.35
    box_between(builder, "plaster", (left_x, front_y, bottom_z), (right_x, front_y + 0.1, window_bottom), plaster, uv_scale=2.0)
    box_between(builder, "plaster", (left_x, front_y, window_top), (right_x, front_y + 0.1, top_z), plaster, uv_scale=2.0)
    for bay_start in (left_x, -3.0, -0.5, 2.0):
        bay_end = bay_start + 2.5
        box_between(builder, "shoji", (bay_start + 0.09, front_y + 0.03, window_bottom), (bay_end - 0.09, front_y + 0.045, window_top), WHITE)
        box_between(builder, "dark_wood", (bay_start + 0.09, front_y - 0.04, window_bottom - 0.05), (bay_end - 0.09, front_y + 0.03, window_bottom))
        box_between(builder, "dark_wood", (bay_start + 0.09, front_y - 0.04, window_top), (bay_end - 0.09, front_y + 0.03, window_top + 0.05))
        box_between(builder, "dark_wood", ((bay_start + bay_end) / 2 - 0.025, front_y - 0.02, window_bottom), ((bay_start + bay_end) / 2 + 0.025, front_y + 0.03, window_top))
    beam_between(builder, "dark_wood", (left_x - 0.2, front_y - 0.05, top_z - 0.08), (right_x + 0.2, front_y - 0.05, top_z - 0.08), 0.18, 0.18)
    build_upper_railing(builder, left_x, right_x, front_y)


def build_upper_railing(builder, left_x, right_x, front_y):
    rail_y = front_y - 0.45
    for x_value in [left_x + 0.2 + index * 0.8 for index in range(13)]:
        if x_value > right_x - 0.1:
            break
        box_between(builder, "dark_wood", (x_value - 0.035, rail_y - 0.035, 4.0), (x_value + 0.035, rail_y + 0.035, 4.75))
    beam_between(builder, "dark_wood", (left_x + 0.1, rail_y, 4.75), (right_x - 0.1, rail_y, 4.75), 0.1, 0.07)
    beam_between(builder, "dark_wood", (left_x + 0.1, rail_y, 4.35), (right_x - 0.1, rail_y, 4.35), 0.05, 0.05)
    add_snow_roll(builder, (left_x + 0.15, rail_y, 4.8), (right_x - 0.15, rail_y, 4.8), 0.06, seed=12)


# ---------------------------------------------------------------- roofs


def build_hipped_roof(builder, eave_rectangle, eave_height, slope, seed):
    min_x, min_y, max_x, max_y = eave_rectangle
    half_depth = (max_y - min_y) * 0.5
    ridge_height = eave_height + half_depth * slope
    middle_y = (min_y + max_y) * 0.5
    ridge_start = (min_x + half_depth, middle_y, ridge_height)
    ridge_end = (max_x - half_depth, middle_y, ridge_height)
    front_left = (min_x, min_y, eave_height)
    front_right = (max_x, min_y, eave_height)
    back_left = (min_x, max_y, eave_height)
    back_right = (max_x, max_y, eave_height)
    planes = [
        (front_left, front_right, ridge_end, ridge_start),
        (back_right, back_left, ridge_start, ridge_end),
        (back_left, front_left, ridge_start, ridge_start),
        (front_right, back_right, ridge_end, ridge_end),
    ]
    for plane_index, corners in enumerate(planes):
        build_roof_plane(builder, corners, seed * 10 + plane_index)
    for start, end in ((front_left, front_right), (front_right, back_right), (back_right, back_left), (back_left, front_left)):
        build_fascia(builder, start, end)
        lip_start = Vector(start) + Vector((0, 0, 0.17))
        lip_end = Vector(end) + Vector((0, 0, 0.17))
        add_snow_roll(builder, lip_start, lip_end, 0.16, seed=seed * 7 + int(start[0] * 3), droop=0.05)
        add_icicles(builder, Vector(start) + Vector((0, 0, -0.14)), Vector(end) + Vector((0, 0, -0.14)), seed * 13 + int(start[1]))
    add_snow_roll(builder, Vector(ridge_start) + Vector((0, 0, 0.24)), Vector(ridge_end) + Vector((0, 0, 0.24)), 0.24, seed=seed * 5)
    for eave_corner in (front_left, front_right, back_right, back_left):
        ridge_point = ridge_start if eave_corner[0] < 0 and eave_corner[0] == min_x else ridge_end
        add_snow_roll(builder, Vector(eave_corner) + Vector((0, 0, 0.22)), Vector(ridge_point) + Vector((0, 0, 0.24)), 0.17, seed=seed * 3 + int(eave_corner[1]))


def bilinear(corners, u_value, v_value):
    corner_00, corner_10, corner_11, corner_01 = [Vector(corner) for corner in corners]
    bottom = corner_00.lerp(corner_10, u_value)
    top = corner_01.lerp(corner_11, u_value)
    return bottom.lerp(top, v_value)


def build_roof_plane(builder, corners, seed):
    edge_u = Vector(corners[1]) - Vector(corners[0])
    edge_v = Vector(corners[3]) - Vector(corners[0])
    if edge_v.length < 1e-4:
        edge_v = Vector(corners[2]) - Vector(corners[0])
    plane_normal = edge_u.cross(Vector(corners[2]) - Vector(corners[0])).normalized()
    if plane_normal.z < 0:
        plane_normal = -plane_normal
    long_axis = edge_u.normalized()
    up_axis = plane_normal.cross(long_axis).normalized()
    divisions_u = max(4, int(edge_u.length / 0.35))
    divisions_v = 14

    def tile_position(u_value, v_value):
        return bilinear(corners, u_value, v_value) + plane_normal * 0.02

    def tile_uv(position):
        relative = position - Vector(corners[0])
        return (relative.dot(long_axis) / 1.6, relative.dot(up_axis) / 1.6)

    def tile_color(position, normal):
        return (0.85, 0.85, 0.88, 1.0)

    add_grid_surface(builder, "roof_tile", tile_position, divisions_u, 4, tile_color, tile_uv, smooth=False)

    def soffit_position(u_value, v_value):
        return bilinear(corners, u_value, v_value) - plane_normal * 0.1

    def wood_uv(position):
        relative = position - Vector(corners[0])
        return (relative.dot(long_axis) / 1.5, relative.dot(up_axis) / 1.5)

    add_grid_surface(builder, "dark_wood", soffit_position, divisions_u, 4, DARK_WOOD_COLOR, wood_uv, smooth=False, flip=True)

    def snow_position(u_value, v_value):
        base = bilinear(corners, u_value, v_value)
        lump = fractal_noise(base.x * 0.9 + seed, base.y * 0.9, base.z * 0.9, octaves=3, base_scale=1.0)
        edge_soften = smoothstep(0.0, 0.06, v_value)
        thickness = (0.17 + 0.05 * lump) * (0.6 + 0.4 * edge_soften)
        return base + plane_normal * (0.04 + thickness)

    def snow_uv(position):
        return (position.x / 2.0, position.y / 2.0)

    add_grid_surface(builder, "snow", snow_position, divisions_u, divisions_v, SNOW_COLOR, snow_uv, smooth=True)


def build_fascia(builder, start, end):
    direction = (Vector(end) - Vector(start)).normalized()
    beam_between(builder, "dark_wood", Vector(start) - direction * 0.05 + Vector((0, 0, -0.03)), Vector(end) + direction * 0.05 + Vector((0, 0, -0.03)), 0.08, 0.2)


def add_snow_roll(builder, start, end, radius, seed, droop=0.0):
    """A soft rounded snow sausage along an edge: eave lips, ridges, rails."""
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    length = direction.length
    rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    world_matrix = Matrix.Translation(start_vector) @ rotation

    def deform(position):
        along = position.z / max(length, 1e-4)
        bump = 1.0 + 0.22 * fractal_noise(along * length * 1.4 + seed, position.x * 3, position.y * 3, octaves=2, base_scale=1.0)
        taper = 0.55 + 0.45 * smoothstep(0.0, 0.04, along) * smoothstep(1.0, 0.96, along)
        result = Vector((position.x * bump * taper, position.y * bump * taper * 0.75, position.z))
        return result

    add_cylinder(builder, "snow", radius, radius, length, world_matrix, SNOW_COLOR, segments=10, caps=True, uv_scale=(1.0, 1.0), deform=lambda position: deform(position) + Vector((0, -droop, 0)))


# ---------------------------------------------------------------- lantern, spout, fence, props


def build_stone_lantern(builder):
    base_x, base_y = LANTERN_POSITION
    random_generator = seeded_random(17)
    mossy_stone = moss_stone_color()

    def hexagonal(radius_bottom, radius_top, height, z_value, rotation=0.0):
        return add_cylinder(builder, "stone", radius_bottom, radius_top, height, placement_matrix((base_x, base_y, z_value), rotation), mossy_stone, segments=6, smooth=False, uv_scale=(1.5, 0.5))

    add_box(builder, "stone", (1.0, 0.9, 0.3), placement_matrix((base_x, base_y, -0.05), 0.3), mossy_stone, bevel=0.06, uv_scale=0.6)
    hexagonal(0.36, 0.3, 0.2, 0.1)
    hexagonal(0.26, 0.2, 0.08, 0.3)
    add_cylinder(builder, "stone", 0.12, 0.1, 0.72, placement_matrix((base_x, base_y, 0.38)), mossy_stone, segments=14, uv_scale=(1.0, 0.5))
    add_cylinder(builder, "stone", 0.135, 0.135, 0.05, placement_matrix((base_x, base_y, 0.72)), mossy_stone, segments=14)
    hexagonal(0.2, 0.33, 0.14, 1.1)
    hexagonal(0.33, 0.33, 0.04, 1.24)
    firebox_bottom = 1.28
    firebox_height = 0.34
    for corner_index in range(6):
        angle = corner_index * math.pi / 3
        add_box(builder, "stone", (0.06, 0.06, firebox_height), placement_matrix((base_x + 0.22 * math.cos(angle), base_y + 0.22 * math.sin(angle), firebox_bottom + firebox_height / 2), angle), mossy_stone, uv_scale=0.5)
    for face_index in range(6):
        angle = face_index * math.pi / 3 + math.pi / 6
        center = (base_x + 0.19 * math.cos(angle), base_y + 0.19 * math.sin(angle), firebox_bottom + firebox_height / 2)
        is_window = face_index % 3 != 2
        if is_window:
            add_box(builder, "lantern_glow", (0.02, 0.2, 0.24), placement_matrix(center, angle), WHITE)
        else:
            add_box(builder, "stone", (0.04, 0.22, firebox_height), placement_matrix(center, angle), mossy_stone, uv_scale=0.5)
    hexagonal(0.25, 0.25, 0.05, firebox_bottom + firebox_height)
    roof_base = firebox_bottom + firebox_height + 0.05

    def curl_roof(position):
        radial = math.hypot(position.x, position.y)
        lift = 0.06 * smoothstep(0.35, 0.56, radial)
        return Vector((position.x, position.y, position.z + lift))

    add_cylinder(builder, "stone", 0.56, 0.12, 0.3, placement_matrix((base_x, base_y, roof_base)), mossy_stone, segments=6, smooth=False, uv_scale=(2.0, 0.5), deform=curl_roof)
    add_cylinder(builder, "stone", 0.56, 0.56, 0.05, placement_matrix((base_x, base_y, roof_base - 0.04)), mossy_stone, segments=6, smooth=False, deform=curl_roof)
    add_cylinder(builder, "stone", 0.1, 0.07, 0.07, placement_matrix((base_x, base_y, roof_base + 0.3)), mossy_stone, segments=10)
    add_blob(builder, "stone", 0.08, (1, 1, 1.25), placement_matrix((base_x, base_y, roof_base + 0.43)), mossy_stone, subdivisions=2)
    add_cylinder(builder, "stone", 0.02, 0.0, 0.08, placement_matrix((base_x, base_y, roof_base + 0.52)), mossy_stone, segments=8)
    add_snow_cap(builder, (base_x, base_y, roof_base + 0.12), 0.46, 0.46, 0.13, random_generator, flatten=0.55)
    add_snow_cap(builder, (base_x + 0.12, base_y - 0.08, 0.33), 0.32, 0.26, 0.06, random_generator, flatten=0.3)
    return (base_x, base_y, firebox_bottom + firebox_height * 0.5)


def moss_stone_color():
    def color_function(position, normal):
        variation = fractal_noise(position.x * 5, position.y * 5, position.z * 5, octaves=3)
        color = mix_rgb((0.55, 0.53, 0.49), (0.4, 0.39, 0.36), 0.5 + 0.5 * variation)
        moss = smoothstep(0.3, 0.7, fractal_noise(position.x * 3, position.y * 3, position.z * 3 + 4, octaves=2)) * (1.0 - smoothstep(0.2, 1.5, position.z))
        color = mix_rgb(color, (0.25, 0.32, 0.16), moss * 0.6)
        return (*color, 1.0)

    return color_function


def add_snow_cap(builder, center, radius_x, radius_y, thickness, random_generator, flatten=0.4):
    seed_offset = random_generator.uniform(0, 50)

    def deform(position):
        bump = 1.0 + 0.15 * fractal_noise(position.x * 4 + seed_offset, position.y * 4, position.z * 4, octaves=3, base_scale=1.0)
        result = position * bump
        if result.z < 0.0:
            result.z *= flatten
        return result

    add_blob(builder, "snow", 1.0, (radius_x, radius_y, thickness), placement_matrix(center), SNOW_COLOR, subdivisions=3, deform=deform, uv_scale=0.6)


def bamboo_color():
    def color_function(position, normal):
        return (0.95, 0.95, 0.9, 1.0)

    return color_function


def bamboo_pole(builder, start, end, radius, node_spacing=0.32):
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    length = direction.length
    rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    world_matrix = Matrix.Translation(start_vector) @ rotation

    def node_bulge(position):
        phase = (position.z / node_spacing) % 1.0
        ring = math.exp(-((min(phase, 1.0 - phase)) * 22.0) ** 2) * 0.12
        scale = 1.0 + ring
        return Vector((position.x * scale, position.y * scale, position.z))

    segment_count = max(2, int(length / 0.04))
    add_tube(builder, "bamboo", radius, length, segment_count, world_matrix, node_bulge)


def add_tube(builder, material, radius, length, length_segments, world_matrix, deform):
    ring_segments = 10

    def position_function(u_value, v_value):
        angle = u_value * 2.0 * math.pi
        local = Vector((radius * math.cos(angle), radius * math.sin(angle), v_value * length))
        return world_matrix @ deform(local)

    def uv_function(position):
        local = world_matrix.inverted() @ position
        return ((math.atan2(local.y, local.x) / (2.0 * math.pi)) % 1.0, local.z / 0.9)

    add_grid_surface(builder, material, position_function, ring_segments, length_segments, bamboo_color(), uv_function, smooth=True, flip=True)


def build_bamboo_spout(builder):
    start = Vector(SPOUT_START)
    end = Vector(SPOUT_END)
    bamboo_pole(builder, start - (end - start).normalized() * 0.3, end, 0.052)
    support_point = start.lerp(end, 0.62)
    for side in (-1.0, 1.0):
        perpendicular = Vector((-(end - start).y, (end - start).x, 0)).normalized() * 0.28 * side
        foot = Vector((support_point.x, support_point.y, 0.0)) + perpendicular
        top = Vector((support_point.x, support_point.y, support_point.z + 0.18)) - perpendicular
        foot.z = -0.05
        bamboo_pole(builder, foot, top, 0.028)
    back_post_base = Vector((start.x - 0.15, start.y + 0.2, -0.1))
    bamboo_pole(builder, back_post_base, back_post_base + Vector((0, 0, 1.35)), 0.06)
    add_cylinder(builder, "bamboo", 0.065, 0.065, 0.02, placement_matrix(back_post_base + Vector((0, 0, 1.35))), solid_color((0.82, 0.8, 0.62)), segments=10)
    random_generator = seeded_random(5)
    add_snow_cap(builder, back_post_base + Vector((0, 0, 1.37)), 0.07, 0.07, 0.05, random_generator, flatten=0.3)
    rope_center = start.lerp(end, 0.62) + Vector((0, 0, 0.0))
    add_cylinder(builder, "dark_wood", 0.06, 0.06, 0.05, Matrix.Translation(rope_center) @ (end - start).to_track_quat("Z", "Y").to_matrix().to_4x4(), solid_color((0.5, 0.42, 0.3)), segments=10)


def build_fence(builder):
    post_spacing = 1.8
    y_value = FENCE_MIN_Y
    while y_value <= FENCE_MAX_Y + 0.01:
        bamboo_pole(builder, (FENCE_X, y_value, -0.1), (FENCE_X, y_value, 1.95), 0.05)
        y_value += post_spacing
    for rail_height in (0.35, 1.0, 1.65):
        bamboo_pole(builder, (FENCE_X + 0.07, FENCE_MIN_Y, rail_height), (FENCE_X + 0.07, FENCE_MAX_Y, rail_height), 0.025, node_spacing=0.45)
    slat_spacing = 0.07
    slat_count = int((FENCE_MAX_Y - FENCE_MIN_Y) / slat_spacing)
    random_generator = seeded_random(21)
    for index in range(slat_count):
        slat_y = FENCE_MIN_Y + index * slat_spacing
        top = 1.82 + random_generator.uniform(-0.02, 0.02)
        add_cylinder(builder, "bamboo", 0.03, 0.028, top + 0.1, placement_matrix((FENCE_X, slat_y, -0.1)), solid_color((0.9, 0.86, 0.72), jitter=0.12, jitter_scale=0.2, seed_offset=index), segments=7, caps=False, uv_scale=(0.3, 2.0))
    add_snow_roll(builder, (FENCE_X, FENCE_MIN_Y, 1.82), (FENCE_X, FENCE_MAX_Y, 1.82), 0.07, seed=33)
    for rail_height in (1.0, 1.65):
        add_snow_roll(builder, (FENCE_X + 0.1, FENCE_MIN_Y + 0.4, rail_height + 0.04), (FENCE_X + 0.1, FENCE_MAX_Y - 0.4, rail_height + 0.04), 0.035, seed=int(rail_height * 10))


def build_bucket(builder, location, tilt=0.0, rotation=0.0):
    radius = 0.15
    height = 0.17
    world_matrix = placement_matrix(location, rotation, tilt)
    light_wood = solid_color((1.0, 1.0, 1.0), jitter=0.05)
    add_cylinder(builder, "bucket_wood", radius * 0.95, radius, height, world_matrix, light_wood, segments=18, caps=False, uv_scale=(6.0, 0.6))
    add_cylinder(builder, "bucket_wood", radius * 0.93, radius * 0.97, height - 0.01, world_matrix @ Matrix.Translation((0, 0, 0.01)) @ Matrix.Scale(1.0, 4), solid_color((0.85, 0.82, 0.78)), segments=18, caps=False, uv_scale=(6.0, 0.6), deform=lambda position: Vector((position.x * 0.9, position.y * 0.9, position.z)))
    add_cylinder(builder, "bucket_wood", radius * 0.86, radius * 0.86, 0.015, world_matrix @ Matrix.Translation((0, 0, 0.012)), solid_color((0.8, 0.75, 0.7)), segments=18, uv_scale=(1.0, 1.0))
    for hoop_height in (0.03, 0.13):
        hoop_radius = radius * (0.95 + 0.05 * hoop_height / height) + 0.006
        add_cylinder(builder, "copper", hoop_radius, hoop_radius, 0.018, world_matrix @ Matrix.Translation((0, 0, hoop_height)), solid_color((0.72, 0.45, 0.3)), segments=18, caps=False)


def build_props(builder):
    build_bucket(builder, (2.05, 4.42, DECK_TOP))
    build_bucket(builder, (2.38, 4.5, DECK_TOP), rotation=0.6)
    build_bucket(builder, (2.21, 4.46, DECK_TOP + 0.17), rotation=1.1)
    build_bucket(builder, (-1.6, 4.35, DECK_TOP), rotation=0.3)
    stool_center = (-1.15, 4.45, DECK_TOP)
    light_wood = solid_color((1.0, 1.0, 1.0), jitter=0.05)
    add_box(builder, "bucket_wood", (0.36, 0.24, 0.03), placement_matrix((stool_center[0], stool_center[1], DECK_TOP + 0.2), 0.15), light_wood, bevel=0.008, uv_scale=0.5)
    for side in (-1, 1):
        add_box(builder, "bucket_wood", (0.03, 0.22, 0.185), placement_matrix((stool_center[0] + side * 0.14 * math.cos(0.15), stool_center[1] + side * 0.14 * math.sin(0.15), DECK_TOP + 0.092), 0.15), light_wood, uv_scale=0.5)
    bench_y = 9.45
    add_box(builder, "deck_wood", (2.2, 0.36, 0.05), placement_matrix((3.1, bench_y, DECK_TOP + 0.42)), WEATHERED_WOOD_COLOR, bevel=0.01, uv_scale=1.6)
    for x_offset in (-0.95, 0.95):
        add_box(builder, "dark_wood", (0.07, 0.3, 0.4), placement_matrix((3.1 + x_offset, bench_y, DECK_TOP + 0.2)), DARK_WOOD_COLOR)
    folded_towel_color = solid_color((0.92, 0.9, 0.86))
    add_box(builder, "noren", (0.32, 0.2, 0.05), placement_matrix((2.6, bench_y, DECK_TOP + 0.47), 0.1), folded_towel_color, bevel=0.015, uv_scale=0.2)
    for x_offset in (-0.07, 0.07):
        add_box(builder, "dark_wood", (0.1, 0.23, 0.03), placement_matrix((-0.9 + x_offset, 8.62, DECK_TOP + 0.015), 0.05), DARK_WOOD_COLOR, bevel=0.01, uv_scale=0.4)


def build_paper_lantern(builder):
    center = (-1.5, 9.35, 2.25)

    def ribs(position):
        ribbing = 1.0 + 0.03 * math.cos(position.z * 90.0)
        return Vector((position.x * ribbing, position.y * ribbing, position.z))

    add_blob(builder, "lantern_glow", 0.22, (1.0, 1.0, 1.45), placement_matrix(center), solid_color((1.0, 0.95, 0.85)), subdivisions=3, deform=ribs)
    for z_offset in (0.3, -0.3):
        add_cylinder(builder, "dark_wood", 0.12, 0.12, 0.05, placement_matrix((center[0], center[1], center[2] + z_offset - 0.025)), DARK_WOOD_COLOR, segments=14)
    add_cylinder(builder, "dark_wood", 0.01, 0.01, 0.25, placement_matrix((center[0], center[1], center[2] + 0.3)), DARK_WOOD_COLOR, segments=6)
    return center


def add_icicles(builder, start, end, seed):
    """Icicles hanging under an eave: uneven lengths, gaps, a few long ones."""
    random_generator = seeded_random(seed)
    direction = end - start
    length = direction.length
    count = int(length / 0.16)
    ice_color = solid_color((0.82, 0.9, 0.97))
    for index in range(count):
        if random_generator.random() < 0.45:
            continue
        along = (index + random_generator.uniform(0.1, 0.9)) / count
        root = start + direction * along
        icicle_length = random_generator.uniform(0.04, 0.16)
        if random_generator.random() < 0.18:
            icicle_length = random_generator.uniform(0.22, 0.42)
        radius = 0.012 + icicle_length * 0.06
        world_matrix = Matrix.Translation(root) @ Matrix.Rotation(math.pi, 4, "X")

        def ripple(position, icicle_length=icicle_length):
            wobble = 1.0 + 0.25 * math.sin(position.z / max(icicle_length, 0.01) * 18.0)
            return Vector((position.x * wobble, position.y * wobble, position.z))

        add_cylinder(builder, "ice", radius, 0.0015, icicle_length, world_matrix, ice_color, segments=6, caps=False, deform=ripple)
