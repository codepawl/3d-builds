import os
import sys
import math
import random
import bpy
import bmesh

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.append(SCRIPT_DIR)

import procedural_materials as mats
import mesh_helpers as helpers


def build_hinoki_deck_and_steps(hinoki_mat, cedar_mat, wet_stone_mat, snow_mat):
    bm_hinoki = bmesh.new()
    bm_cedar = bmesh.new()
    bm_stone = bmesh.new()
    bm_snow = bmesh.new()
    deck_min_x = -3.75
    deck_max_x = 2.05
    deck_min_z = -4.65
    deck_max_z = -2.42
    deck_y = 0.28
    plank_count = 18
    total_depth = deck_max_z - deck_min_z
    plank_depth = (total_depth / plank_count) - 0.007
    for p_idx in range(plank_count):
        pz = deck_min_z + (p_idx + 0.5) * (total_depth / plank_count)
        center_x = (deck_min_x + deck_max_x) * 0.5
        width_x = deck_max_x - deck_min_x
        helpers.add_box_in_three_coords(bm_hinoki, (center_x, deck_y - 0.02, pz), (width_x, 0.04, plank_depth))
    helpers.add_box_in_three_coords(bm_hinoki, (-0.85, deck_y - 0.018, -2.40), (5.84, 0.044, 0.07))
    helpers.add_box_in_three_coords(bm_cedar, (-0.85, 0.21, -2.48), (5.84, 0.08, 0.10))
    helpers.add_box_in_three_coords(bm_cedar, (-0.85, 0.21, -3.55), (5.84, 0.08, 0.10))
    helpers.add_box_in_three_coords(bm_cedar, (-3.70, 0.21, -3.55), (0.10, 0.08, 2.22))
    helpers.add_box_in_three_coords(bm_cedar, (2.00, 0.21, -3.55), (0.10, 0.08, 2.22))
    post_x_list = [-3.65, -2.25, -0.85, 0.55, 1.95]
    post_z_list = [-2.52, -3.55, -4.50]
    for px in post_x_list:
        for pz in post_z_list:
            helpers.add_box_in_three_coords(bm_cedar, (px, 0.10, pz), (0.11, 0.28, 0.11))
            helpers.add_sculpted_boulder_in_three_coords(bm_stone, None, (px, 0.03, pz), (0.16, 0.07, 0.16), 900, False, 2)
    helpers.add_box_in_three_coords(bm_hinoki, (-3.96, 0.20, -2.85), (0.46, 0.045, 0.88))
    helpers.add_box_in_three_coords(bm_cedar, (-3.96, 0.12, -2.85), (0.40, 0.14, 0.82))
    helpers.add_box_in_three_coords(bm_hinoki, (-4.26, 0.12, -2.65), (0.44, 0.045, 0.80))
    helpers.add_box_in_three_coords(bm_cedar, (-4.26, 0.05, -2.65), (0.38, 0.12, 0.74))
    helpers.add_box_in_three_coords(bm_hinoki, (-0.25, 0.18, -2.26), (1.18, 0.045, 0.28))
    helpers.add_box_in_three_coords(bm_cedar, (-0.25, 0.08, -2.26), (1.08, 0.16, 0.22))
    helpers.add_sculpted_boulder_in_three_coords(bm_stone, bm_snow, (1.82, 0.29, -2.52), (0.36, 0.06, 0.24), 951, True, 3)
    helpers.finalize_bmesh_to_object(bm_hinoki, "RyokanHinokiDeck", hinoki_mat, uv_scale=0.65, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_cedar, "DeckCedarSubstructure", cedar_mat, uv_scale=0.6, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_stone, "DeckFoundationStones", wet_stone_mat, uv_scale=0.8, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_snow, "DeckCornerSnow", snow_mat, uv_scale=0.6, smooth_shading=True)


def build_ryokan_main_structure(cedar_mat, plaster_mat, shoji_mat):
    bm_cedar = bmesh.new()
    bm_plaster = bmesh.new()
    bm_shoji = bmesh.new()
    front_z = -4.55
    back_z = -8.15
    left_x = -3.85
    right_x = 1.95
    center_x = (left_x + right_x) * 0.5
    center_z = (front_z + back_z) * 0.5
    width_x = right_x - left_x
    depth_z = front_z - back_z
    helpers.add_box_in_three_coords(bm_cedar, (center_x, 0.18, center_z), (width_x + 0.20, 0.36, depth_z + 0.20))
    helpers.add_box_in_three_coords(bm_plaster, (center_x, 1.55, center_z), (width_x - 0.08, 2.38, depth_z - 0.08))
    bay_x_coords = [-3.85, -2.40, -0.95, 0.50, 1.95]
    for bx in bay_x_coords:
        helpers.add_box_in_three_coords(bm_cedar, (bx, 1.55, front_z), (0.13, 2.48, 0.13))
        helpers.add_box_in_three_coords(bm_cedar, (bx, 1.55, back_z), (0.13, 2.48, 0.13))
    veranda_posts_x = [-3.68, 1.95]
    for vpx in veranda_posts_x:
        helpers.add_box_in_three_coords(bm_cedar, (vpx, 1.18, -2.68), (0.105, 1.84, 0.105))
    helpers.add_box_in_three_coords(bm_cedar, (-0.86, 2.06, -2.68), (5.80, 0.13, 0.12))
    helpers.add_box_in_three_coords(bm_cedar, (center_x, 0.38, front_z + 0.02), (width_x, 0.10, 0.10))
    helpers.add_box_in_three_coords(bm_cedar, (center_x, 2.08, front_z + 0.02), (width_x, 0.11, 0.11))
    helpers.add_box_in_three_coords(bm_cedar, (center_x, 2.52, front_z + 0.02), (width_x + 0.24, 0.14, 0.14))
    for bay_idx in range(4):
        b_left = bay_x_coords[bay_idx] + 0.06
        b_right = bay_x_coords[bay_idx + 1] - 0.06
        b_mid = (b_left + b_right) * 0.5
        b_span = b_right - b_left
        helpers.add_box_in_three_coords(bm_cedar, (b_mid, 0.56, front_z + 0.03), (b_span, 0.32, 0.05))
        for slat_idx in range(7):
            sx = b_left + 0.06 + (b_span - 0.12) * (slat_idx / 6.0)
            helpers.add_box_in_three_coords(bm_cedar, (sx, 0.56, front_z + 0.058), (0.018, 0.28, 0.015))
        helpers.add_box_in_three_coords(bm_shoji, (b_mid, 1.38, front_z + 0.035), (b_span - 0.04, 1.32, 0.02))
        v_bars = 6
        for v_idx in range(v_bars + 1):
            vx = b_left + 0.02 + (b_span - 0.04) * (v_idx / float(v_bars))
            bar_thick = 0.032 if (v_idx in (0, 3, 6)) else 0.015
            helpers.add_box_in_three_coords(bm_cedar, (vx, 1.38, front_z + 0.052), (bar_thick, 1.34, 0.025))
        h_bars = 5
        for h_idx in range(h_bars + 1):
            hy = 0.72 + 1.32 * (h_idx / float(h_bars))
            bar_thick = 0.032 if (h_idx in (0, 5)) else 0.014
            helpers.add_box_in_three_coords(bm_cedar, (b_mid, hy, front_z + 0.052), (b_span, bar_thick, 0.025))
    helpers.add_box_in_three_coords(bm_shoji, (right_x + 0.01, 1.40, -5.95), (0.03, 1.22, 1.50))
    for z_idx in range(5):
        wz = -6.68 + z_idx * 0.36
        helpers.add_box_in_three_coords(bm_cedar, (right_x + 0.03, 1.40, wz), (0.03, 1.25, 0.024))
    for y_idx in range(4):
        wy = 0.82 + y_idx * 0.38
        helpers.add_box_in_three_coords(bm_cedar, (right_x + 0.03, wy, -5.95), (0.03, 0.024, 1.54))
    helpers.finalize_bmesh_to_object(bm_cedar, "RyokanCedarTimber", cedar_mat, uv_scale=0.5, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_plaster, "RyokanPlasterWalls", plaster_mat, uv_scale=0.4, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_shoji, "ShojiGlowingScreens", shoji_mat, uv_scale=0.5, smooth_shading=False)


def add_pitched_roof_with_snow(bm_tile, bm_cedar, bm_snow, x_range, z_range, ridge_y, eaves_y):
    x_min, x_max = x_range
    z_min, z_max = z_range
    z_mid = (z_min + z_max) * 0.5
    half_span_z = (z_max - z_min) * 0.5
    x_steps = 36
    z_steps = 20
    thickness = 0.11
    for side in (-1, 1):
        grid_bot = []
        grid_top = []
        snow_bot = []
        snow_top = []
        for ix in range(x_steps + 1):
            u = ix / float(x_steps)
            wx = x_min + (x_max - x_min) * u
            row_bot = []
            row_top = []
            s_row_bot = []
            s_row_top = []
            for iz in range(z_steps + 1):
                v = iz / float(z_steps)
                wz = z_mid + side * half_span_z * v
                sag = 0.12 * (v * (1.0 - v))
                wy = ridge_y * (1.0 - v) + eaves_y * v - sag
                row_bot.append(bm_tile.verts.new(helpers.three_to_blender(wx, wy, wz)))
                row_top.append(bm_tile.verts.new(helpers.three_to_blender(wx, wy + thickness, wz)))
                edge_taper = math.sin(max(0.03, min(0.97, u)) * math.pi) ** 0.28
                eaves_pillow = math.sin(max(0.05, min(0.97, v)) * math.pi) ** 0.35
                drift_1 = 0.028 * math.sin(wx * 1.45 + wz * 1.65)
                drift_2 = 0.014 * (1.0 - abs(math.sin(wx * 3.2 - wz * 2.4)))
                cornice = 0.035 * math.exp(-((v - 0.88) / 0.10) ** 2)
                snow_h = (0.19 * edge_taper * eaves_pillow + cornice + drift_1 + drift_2)
                snow_z_overhang = wz + side * (0.045 * (v ** 2) + 0.015 * math.sin(wx * 2.7))
                s_row_bot.append(bm_snow.verts.new(helpers.three_to_blender(wx, wy + thickness - 0.02, snow_z_overhang)))
                s_row_top.append(bm_snow.verts.new(helpers.three_to_blender(wx, wy + thickness + max(0.02, snow_h), snow_z_overhang)))
            grid_bot.append(row_bot)
            grid_top.append(row_top)
            snow_bot.append(s_row_bot)
            snow_top.append(s_row_top)
        for ix in range(x_steps):
            for iz in range(z_steps):
                bm_tile.faces.new((grid_top[ix][iz], grid_top[ix + 1][iz], grid_top[ix + 1][iz + 1], grid_top[ix][iz + 1]))
                bm_tile.faces.new((grid_bot[ix][iz], grid_bot[ix][iz + 1], grid_bot[ix + 1][iz + 1], grid_bot[ix + 1][iz]))
                bm_snow.faces.new((snow_top[ix][iz], snow_top[ix + 1][iz], snow_top[ix + 1][iz + 1], snow_top[ix][iz + 1]))
                bm_snow.faces.new((snow_bot[ix][iz], snow_bot[ix][iz + 1], snow_bot[ix + 1][iz + 1], snow_bot[ix + 1][iz]))
        for ix in range(x_steps):
            bm_tile.faces.new((grid_bot[ix][z_steps], grid_top[ix][z_steps], grid_top[ix + 1][z_steps], grid_bot[ix + 1][z_steps]))
            bm_snow.faces.new((snow_bot[ix][z_steps], snow_top[ix][z_steps], snow_top[ix + 1][z_steps], snow_bot[ix + 1][z_steps]))
            bm_snow.faces.new((snow_top[ix][0], snow_bot[ix][0], snow_bot[ix + 1][0], snow_top[ix + 1][0]))
        for iz in range(z_steps):
            bm_tile.faces.new((grid_bot[0][iz], grid_top[0][iz], grid_top[0][iz + 1], grid_bot[0][iz + 1]))
            bm_tile.faces.new((grid_top[x_steps][iz], grid_bot[x_steps][iz], grid_bot[x_steps][iz + 1], grid_top[x_steps][iz + 1]))
            bm_snow.faces.new((snow_bot[0][iz], snow_top[0][iz], snow_top[0][iz + 1], snow_bot[0][iz + 1]))
            bm_snow.faces.new((snow_top[x_steps][iz], snow_bot[x_steps][iz], snow_bot[x_steps][iz + 1], snow_top[x_steps][iz + 1]))
    helpers.add_box_in_three_coords(bm_tile, ((x_min + x_max) * 0.5, ridge_y + 0.14, z_mid), (x_max - x_min + 0.12, 0.16, 0.22))
    rafter_count = 16
    for r_idx in range(rafter_count + 1):
        rx = x_min + 0.15 + (x_max - x_min - 0.30) * (r_idx / float(rafter_count))
        helpers.add_cylinder_between_three_points(
            bm_cedar,
            (rx, ridge_y - 0.04, z_mid),
            (rx, eaves_y - 0.05, z_max + 0.06),
            0.032,
            0.032,
            6,
        )


def add_veranda_lean_to_roof(bm_tile, bm_cedar, bm_snow):
    x_min, x_max = (-3.95, 2.25)
    z_top, z_bot = (-4.58, -2.52)
    y_top, y_bot = (2.48, 1.98)
    x_steps = 32
    z_steps = 16
    grid_bot = []
    grid_top = []
    snow_bot = []
    snow_top = []
    for ix in range(x_steps + 1):
        u = ix / float(x_steps)
        wx = x_min + (x_max - x_min) * u
        r_bot, r_top, s_bot, s_top = [], [], [], []
        for iz in range(z_steps + 1):
            v = iz / float(z_steps)
            wz = z_top + (z_bot - z_top) * v
            wy = y_top * (1.0 - v) + y_bot * v - 0.04 * v * (1.0 - v)
            r_bot.append(bm_tile.verts.new(helpers.three_to_blender(wx, wy, wz)))
            r_top.append(bm_tile.verts.new(helpers.three_to_blender(wx, wy + 0.08, wz)))
            edge_u = math.sin(max(0.04, min(0.96, u)) * math.pi) ** 0.30
            edge_v = math.sin(max(0.05, min(0.96, v)) * math.pi) ** 0.38
            ripple = 0.018 * math.sin(wx * 2.1 + wz * 1.8) + 0.010 * (1.0 - abs(math.cos(wx * 3.7)))
            cornice = 0.025 * math.exp(-((v - 0.86) / 0.11) ** 2)
            sh = max(0.015, 0.15 * edge_u * edge_v + cornice + ripple)
            overhang_z = wz + 0.038 * (v ** 2) + 0.012 * math.sin(wx * 3.1)
            s_bot.append(bm_snow.verts.new(helpers.three_to_blender(wx, wy + 0.07, overhang_z)))
            s_top.append(bm_snow.verts.new(helpers.three_to_blender(wx, wy + 0.07 + sh, overhang_z)))
        grid_bot.append(r_bot)
        grid_top.append(r_top)
        snow_bot.append(s_bot)
        snow_top.append(s_top)
    for ix in range(x_steps):
        for iz in range(z_steps):
            bm_tile.faces.new((grid_top[ix][iz], grid_top[ix + 1][iz], grid_top[ix + 1][iz + 1], grid_top[ix][iz + 1]))
            bm_tile.faces.new((grid_bot[ix][iz], grid_bot[ix][iz + 1], grid_bot[ix + 1][iz + 1], grid_bot[ix + 1][iz]))
            bm_snow.faces.new((snow_top[ix][iz], snow_top[ix + 1][iz], snow_top[ix + 1][iz + 1], snow_top[ix][iz + 1]))
            bm_snow.faces.new((snow_bot[ix][iz], snow_bot[ix][iz + 1], snow_bot[ix + 1][iz + 1], snow_bot[ix + 1][iz]))
    for ix in range(x_steps):
        bm_tile.faces.new((grid_bot[ix][z_steps], grid_top[ix][z_steps], grid_top[ix + 1][z_steps], grid_bot[ix + 1][z_steps]))
        bm_snow.faces.new((snow_bot[ix][z_steps], snow_top[ix][z_steps], snow_top[ix + 1][z_steps], snow_bot[ix + 1][z_steps]))
    for r_idx in range(16):
        rx = x_min + 0.12 + (x_max - x_min - 0.24) * (r_idx / 15.0)
        helpers.add_cylinder_between_three_points(bm_cedar, (rx, y_top - 0.03, z_top), (rx, y_bot - 0.03, z_bot), 0.026, 0.026, 6)


def build_roofs_and_fences(tile_mat, cedar_mat, snow_mat, bamboo_mat, twine_mat, glow_mat):
    bm_tile = bmesh.new()
    bm_cedar = bmesh.new()
    bm_snow = bmesh.new()
    add_pitched_roof_with_snow(bm_tile, bm_cedar, bm_snow, (-4.30, 2.35), (-8.55, -4.05), 3.68, 2.48)
    add_veranda_lean_to_roof(bm_tile, bm_cedar, bm_snow)
    rng = random.Random(8811)
    for ic_idx in range(22):
        ix = -3.75 + ic_idx * 0.27 + rng.uniform(-0.04, 0.04)
        ic_len = rng.uniform(0.07, 0.17)
        helpers.add_cylinder_between_three_points(bm_snow, (ix, 2.00, -2.50), (ix, 2.00 - ic_len, -2.50), 0.013, 0.0025, 6)
    helpers.finalize_bmesh_to_object(bm_tile, "RyokanTiledRoofs", tile_mat, uv_scale=0.8, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_cedar, "RyokanRoofRafters", cedar_mat, uv_scale=0.5, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_snow, "RyokanRoofSnowBlanket", snow_mat, uv_scale=0.35, smooth_shading=True)

    bm_andon_wood = bmesh.new()
    bm_andon_glow = bmesh.new()
    ax, ay, az = (0.85, 1.82, -3.10)
    helpers.add_cylinder_between_three_points(bm_andon_wood, (ax, 2.18, az), (ax, ay + 0.16, az), 0.012, 0.012, 6)
    helpers.add_box_in_three_coords(bm_andon_wood, (ax, ay + 0.15, az), (0.28, 0.032, 0.28))
    helpers.add_box_in_three_coords(bm_andon_wood, (ax, ay - 0.15, az), (0.26, 0.032, 0.26))
    helpers.add_box_in_three_coords(bm_andon_glow, (ax, ay, az), (0.20, 0.26, 0.20))
    for cx_off in (-0.11, 0.11):
        for cz_off in (-0.11, 0.11):
            helpers.add_box_in_three_coords(bm_andon_wood, (ax + cx_off, ay, az + cz_off), (0.020, 0.30, 0.020))
    helpers.finalize_bmesh_to_object(bm_andon_wood, "EavesAndonFrame", cedar_mat, uv_scale=0.8, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_andon_glow, "EavesAndonGlow", glow_mat, uv_scale=0.8, smooth_shading=False)

    bm_bamboo = bmesh.new()
    bm_twine = bmesh.new()
    bm_fence_snow = bmesh.new()
    for p_idx in range(18):
        fx = 2.02 + p_idx * 0.095
        fz = -4.45 + p_idx * 0.035
        pole_h = 1.30 + 0.02 * math.sin(p_idx * 1.7)
        helpers.add_cylinder_between_three_points(bm_bamboo, (fx, -0.20, fz), (fx, pole_h, fz), 0.038, 0.036, 10)
    for rail_y in (0.42, 0.84, 1.20):
        helpers.add_cylinder_between_three_points(bm_bamboo, (2.00, rail_y, -4.45), (3.68, rail_y, -3.82), 0.032, 0.032, 10)
        for tie_idx in range(5):
            tx = 2.08 + tie_idx * 0.38
            tz = -4.42 + tie_idx * 0.14
            helpers.add_box_in_three_coords(bm_twine, (tx, rail_y, tz), (0.088, 0.068, 0.088))
    for s_idx in range(20):
        frac = s_idx / 19.0
        sx = 2.04 + frac * 1.58
        sz = -4.44 + frac * 0.59
        sh = 0.042 * math.sin(frac * math.pi) ** 0.4 + 0.008 * math.sin(s_idx * 1.9)
        helpers.add_box_in_three_coords(bm_fence_snow, (sx, 1.33, sz), (0.10, max(0.018, sh), 0.095), -0.35, 0.35)
    helpers.finalize_bmesh_to_object(bm_bamboo, "BambooPrivacyFence", bamboo_mat, uv_scale=0.9, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_twine, "FenceHempTwine", twine_mat, uv_scale=0.8, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_fence_snow, "FenceTopSnow", snow_mat, uv_scale=0.6, smooth_shading=True)


def main():
    helpers.clear_scene()
    hinoki_mat = mats.create_hinoki_deck_material()
    cedar_mat = mats.create_weathered_cedar_material()
    wet_stone_mat = mats.create_wet_stone_floor_material()
    snow_mat = mats.create_snow_material()
    plaster_mat = mats.create_plaster_wall_material()
    shoji_mat = mats.create_shoji_paper_material()
    tile_mat = mats.create_roof_tile_material()
    bamboo_mat = mats.create_bamboo_material()
    twine_mat = mats.create_black_twine_material()
    glow_mat = mats.create_lantern_glow_material()
    build_hinoki_deck_and_steps(hinoki_mat, cedar_mat, wet_stone_mat, snow_mat)
    build_ryokan_main_structure(cedar_mat, plaster_mat, shoji_mat)
    build_roofs_and_fences(tile_mat, cedar_mat, snow_mat, bamboo_mat, twine_mat, glow_mat)
    output_path = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "public", "models", "ryokan_and_deck.glb"))
    helpers.export_glb_scene(output_path)


if __name__ == "__main__":
    main()
