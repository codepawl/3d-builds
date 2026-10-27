import os
import sys
import math
import bpy
import bmesh

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.append(SCRIPT_DIR)

import procedural_materials as mats
import mesh_helpers as helpers


def add_hexagonal_roof_snow_cap(bm_snow, cx, base_y, cz, s):
    rings = 8
    sides = 24
    grid_bot = []
    grid_top = []
    for r_idx in range(rings + 1):
        frac = r_idx / float(rings)
        ring_b = []
        ring_t = []
        for a_idx in range(sides):
            angle = (2.0 * math.pi * a_idx) / sides
            hex_mod = 1.0 + 0.065 * math.cos(angle * 6.0)
            radius = (0.06 + frac * 0.38) * s * hex_mod
            wx = cx + math.cos(angle) * radius
            wz = cz + math.sin(angle) * radius
            roof_slope_y = base_y + (1.0 - frac) * 0.145 * s - 0.02 * (frac ** 2) * s
            snow_profile = math.sin(max(0.05, min(0.96, frac)) * math.pi) ** 0.50
            drift = 0.010 * s * math.sin(angle * 3.0 + frac * 4.0)
            snow_thick = max(0.014 * s, (0.072 * snow_profile + drift) * s)
            ring_b.append(bm_snow.verts.new(helpers.three_to_blender(wx, roof_slope_y, wz)))
            ring_t.append(bm_snow.verts.new(helpers.three_to_blender(wx, roof_slope_y + snow_thick, wz)))
        grid_bot.append(ring_b)
        grid_top.append(ring_t)
    for r_idx in range(rings):
        for a_idx in range(sides):
            nxt = (a_idx + 1) % sides
            bm_snow.faces.new((grid_top[r_idx][a_idx], grid_top[r_idx + 1][a_idx], grid_top[r_idx + 1][nxt], grid_top[r_idx][nxt]))
            bm_snow.faces.new((grid_bot[r_idx][a_idx], grid_bot[r_idx][nxt], grid_bot[r_idx + 1][nxt], grid_bot[r_idx + 1][a_idx]))
    for a_idx in range(sides):
        nxt = (a_idx + 1) % sides
        bm_snow.faces.new((grid_bot[rings][a_idx], grid_top[rings][a_idx], grid_top[rings][nxt], grid_bot[rings][nxt]))
        bm_snow.faces.new((grid_top[0][a_idx], grid_bot[0][a_idx], grid_bot[0][nxt], grid_top[0][nxt]))


def add_stone_lantern_toro(bm_granite, bm_glow, bm_snow, base_center_three, scale_factor=1.0):
    cx, base_y, cz = base_center_three
    s = scale_factor
    for leg_idx in range(4):
        angle = (math.pi * 0.25) + (math.pi * 0.5 * leg_idx)
        foot_x = cx + math.cos(angle) * 0.25 * s
        foot_z = cz + math.sin(angle) * 0.25 * s
        mid_x = cx + math.cos(angle) * 0.20 * s
        mid_z = cz + math.sin(angle) * 0.20 * s
        top_x = cx + math.cos(angle) * 0.14 * s
        top_z = cz + math.sin(angle) * 0.14 * s
        helpers.add_cylinder_between_three_points(
            bm_granite,
            (foot_x, base_y - 0.04, foot_z),
            (mid_x, base_y + 0.14 * s, mid_z),
            0.072 * s,
            0.064 * s,
            8,
        )
        helpers.add_cylinder_between_three_points(
            bm_granite,
            (mid_x, base_y + 0.14 * s, mid_z),
            (top_x, base_y + 0.28 * s, top_z),
            0.064 * s,
            0.056 * s,
            8,
        )

    chudai_y = base_y + 0.31 * s
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, chudai_y - 0.04 * s, cz),
        (cx, chudai_y + 0.02 * s, cz),
        0.22 * s,
        0.27 * s,
        6,
    )
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, chudai_y + 0.02 * s, cz),
        (cx, chudai_y + 0.055 * s, cz),
        0.27 * s,
        0.24 * s,
        6,
    )

    firebox_bot_y = chudai_y + 0.055 * s
    firebox_top_y = firebox_bot_y + 0.28 * s
    helpers.add_cylinder_between_three_points(
        bm_glow,
        (cx, firebox_bot_y + 0.015 * s, cz),
        (cx, firebox_top_y - 0.015 * s, cz),
        0.132 * s,
        0.132 * s,
        12,
    )
    for pillar_idx in range(6):
        p_angle = (2.0 * math.pi * pillar_idx) / 6.0
        px = cx + math.cos(p_angle) * 0.162 * s
        pz = cz + math.sin(p_angle) * 0.162 * s
        helpers.add_cylinder_between_three_points(
            bm_granite,
            (px, firebox_bot_y, pz),
            (px, firebox_top_y, pz),
            0.025 * s,
            0.025 * s,
            6,
        )

    kasa_bot_y = firebox_top_y
    kasa_mid_y = kasa_bot_y + 0.095 * s
    kasa_top_y = kasa_bot_y + 0.21 * s
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, kasa_bot_y - 0.01 * s, cz),
        (cx, kasa_bot_y + 0.025 * s, cz),
        0.48 * s,
        0.46 * s,
        6,
    )
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, kasa_bot_y + 0.025 * s, cz),
        (cx, kasa_mid_y, cz),
        0.46 * s,
        0.32 * s,
        6,
    )
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, kasa_mid_y, cz),
        (cx, kasa_top_y, cz),
        0.32 * s,
        0.085 * s,
        6,
    )
    for corner_idx in range(6):
        c_angle = (2.0 * math.pi * corner_idx) / 6.0
        c_in_x = cx + math.cos(c_angle) * 0.34 * s
        c_in_z = cz + math.sin(c_angle) * 0.34 * s
        c_out_x = cx + math.cos(c_angle) * 0.49 * s
        c_out_z = cz + math.sin(c_angle) * 0.49 * s
        helpers.add_cylinder_between_three_points(
            bm_granite,
            (c_in_x, kasa_mid_y - 0.01 * s, c_in_z),
            (c_out_x, kasa_bot_y + 0.045 * s, c_out_z),
            0.032 * s,
            0.022 * s,
            6,
        )

    add_hexagonal_roof_snow_cap(bm_snow, cx, kasa_bot_y + 0.04 * s, cz, s)

    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, kasa_top_y, cz),
        (cx, kasa_top_y + 0.04 * s, cz),
        0.095 * s,
        0.075 * s,
        8,
    )
    helpers.add_cylinder_between_three_points(
        bm_granite,
        (cx, kasa_top_y + 0.04 * s, cz),
        (cx, kasa_top_y + 0.16 * s, cz),
        0.068 * s,
        0.012 * s,
        10,
    )


def build_bamboo_spout_kakehi(bamboo_mat, twine_mat, snow_mat):
    bm_bamboo = bmesh.new()
    bm_twine = bmesh.new()
    bm_snow = bmesh.new()
    stand_bot = (2.22, 0.04, -2.42)
    stand_top = (2.22, 0.92, -2.42)
    helpers.add_cylinder_between_three_points(bm_bamboo, stand_bot, stand_top, 0.072, 0.068, 14)
    for ring_y in (0.28, 0.56, 0.84):
        helpers.add_cylinder_between_three_points(
            bm_bamboo,
            (2.22, ring_y - 0.012, -2.42),
            (2.22, ring_y + 0.012, -2.42),
            0.078,
            0.078,
            14,
        )
    spout_start = (2.26, 0.82, -2.46)
    spout_end = (1.56, 0.55, -1.66)
    helpers.add_cylinder_between_three_points(bm_bamboo, spout_start, spout_end, 0.052, 0.048, 14)
    for fushi_t in (0.28, 0.65):
        fx = spout_start[0] + (spout_end[0] - spout_start[0]) * fushi_t
        fy = spout_start[1] + (spout_end[1] - spout_start[1]) * fushi_t
        fz = spout_start[2] + (spout_end[2] - spout_start[2]) * fushi_t
        helpers.add_cylinder_between_three_points(
            bm_bamboo,
            (fx + 0.008, fy + 0.003, fz - 0.008),
            (fx - 0.008, fy - 0.003, fz + 0.008),
            0.056,
            0.056,
            14,
        )
    helpers.add_cylinder_between_three_points(
        bm_twine,
        (1.60, 0.565, -1.70),
        (1.55, 0.545, -1.65),
        0.036,
        0.036,
        10,
    )
    leg_1_bot = (1.66, 0.04, -2.14)
    leg_1_top = (1.98, 0.78, -1.86)
    leg_2_bot = (2.04, 0.04, -1.80)
    leg_2_top = (1.72, 0.78, -2.08)
    helpers.add_cylinder_between_three_points(bm_bamboo, leg_1_bot, leg_1_top, 0.032, 0.028, 10)
    helpers.add_cylinder_between_three_points(bm_bamboo, leg_2_bot, leg_2_top, 0.032, 0.028, 10)
    helpers.add_box_in_three_coords(bm_twine, (1.85, 0.65, -1.97), (0.11, 0.08, 0.11), 0.6)
    helpers.add_box_in_three_coords(bm_twine, (2.22, 0.81, -2.42), (0.15, 0.09, 0.15), 0.6)

    for s_idx in range(10):
        frac = s_idx / 9.0
        sx = 2.22 + (1.75 - 2.22) * frac
        sy = 0.855 + (0.66 - 0.855) * frac
        sz = -2.42 + (-1.88 + 2.42) * frac
        sh = 0.026 * math.sin(frac * math.pi) ** 0.5
        helpers.add_box_in_three_coords(bm_snow, (sx, sy, sz), (0.062, max(0.012, sh), 0.062), 0.72, 0.4)

    helpers.finalize_bmesh_to_object(bm_bamboo, "BambooWaterSpout", bamboo_mat, uv_scale=1.2, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_twine, "BambooSpoutTwine", twine_mat, uv_scale=1.0, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_snow, "BambooSpoutSnow", snow_mat, uv_scale=0.8, smooth_shading=True)


def add_wooden_bucket_oke(bm_hinoki, bm_copper, center_three, radius, height):
    cx, base_y, cz = center_three
    segments = 24
    wall_thick = 0.016
    outer_r = radius
    inner_r = radius - wall_thick
    top_y = base_y + height
    inner_bot_y = base_y + 0.022
    outer_bot_ring = []
    outer_top_ring = []
    inner_bot_ring = []
    inner_top_ring = []
    for idx in range(segments):
        angle = (2.0 * math.pi * idx) / segments
        ca = math.cos(angle)
        sa = math.sin(angle)
        stave_groove = 1.0 - 0.012 * (1.0 - abs(math.sin(angle * 8.0)))
        or_b = outer_r * 0.93 * stave_groove
        or_t = outer_r * stave_groove
        outer_bot_ring.append(bm_hinoki.verts.new(helpers.three_to_blender(cx + ca * or_b, base_y, cz + sa * or_b)))
        outer_top_ring.append(bm_hinoki.verts.new(helpers.three_to_blender(cx + ca * or_t, top_y, cz + sa * or_t)))
        inner_top_ring.append(bm_hinoki.verts.new(helpers.three_to_blender(cx + ca * inner_r, top_y, cz + sa * inner_r)))
        inner_bot_ring.append(bm_hinoki.verts.new(helpers.three_to_blender(cx + ca * inner_r * 0.93, inner_bot_y, cz + sa * inner_r * 0.93)))
    for idx in range(segments):
        nxt = (idx + 1) % segments
        bm_hinoki.faces.new((outer_bot_ring[idx], outer_bot_ring[nxt], outer_top_ring[nxt], outer_top_ring[idx]))
        bm_hinoki.faces.new((outer_top_ring[idx], outer_top_ring[nxt], inner_top_ring[nxt], inner_top_ring[idx]))
        bm_hinoki.faces.new((inner_top_ring[idx], inner_top_ring[nxt], inner_bot_ring[nxt], inner_bot_ring[idx]))
    bm_hinoki.faces.new(inner_bot_ring)
    bm_hinoki.faces.new(list(reversed(outer_bot_ring)))
    for band_frac in (0.24, 0.74):
        by = base_y + height * band_frac
        br = outer_r * (0.93 + 0.07 * band_frac) + 0.004
        helpers.add_cylinder_between_three_points(
            bm_copper,
            (cx, by - 0.009, cz),
            (cx, by + 0.009, cz),
            br,
            br,
            segments,
            False,
        )


def add_hinoki_bath_stool(bm_hinoki, center_three, yaw_rad):
    cx, base_y, cz = center_three
    helpers.add_box_in_three_coords(bm_hinoki, (cx, base_y + 0.155, cz), (0.32, 0.032, 0.21), yaw_rad)
    cos_y = math.cos(yaw_rad)
    sin_y = math.sin(yaw_rad)
    for side in (-0.115, 0.115):
        lx = cx + side * cos_y
        lz = cz - side * sin_y
        helpers.add_box_in_three_coords(bm_hinoki, (lx, base_y + 0.072, lz), (0.032, 0.144, 0.20), yaw_rad)
    helpers.add_box_in_three_coords(bm_hinoki, (cx, base_y + 0.065, cz), (0.22, 0.028, 0.045), yaw_rad)


def build_deck_buckets_stools_and_towels(hinoki_mat, copper_mat, towel_mat):
    bm_hinoki = bmesh.new()
    bm_copper = bmesh.new()
    bm_towel = bmesh.new()
    deck_y = 0.28
    add_wooden_bucket_oke(bm_hinoki, bm_copper, (0.12, deck_y, -2.78), 0.145, 0.185)
    add_wooden_bucket_oke(bm_hinoki, bm_copper, (-0.12, deck_y, -3.02), 0.105, 0.125)
    add_hinoki_bath_stool(bm_hinoki, (0.38, deck_y, -3.08), 0.28)
    helpers.add_box_in_three_coords(bm_towel, (0.38, deck_y + 0.185, -3.08), (0.18, 0.028, 0.13), 0.35, 0.25)
    helpers.add_box_in_three_coords(bm_towel, (0.39, deck_y + 0.208, -3.08), (0.16, 0.022, 0.12), 0.38, 0.25)

    add_wooden_bucket_oke(bm_hinoki, bm_copper, (0.88, deck_y, -2.85), 0.148, 0.19)
    add_hinoki_bath_stool(bm_hinoki, (1.22, deck_y, -3.12), -0.35)
    add_wooden_bucket_oke(bm_hinoki, bm_copper, (1.22, deck_y + 0.17, -3.12), 0.125, 0.155)
    helpers.add_box_in_three_coords(bm_towel, (0.62, deck_y + 0.018, -2.68), (0.22, 0.025, 0.15), -0.18, 0.25)

    helpers.finalize_bmesh_to_object(bm_hinoki, "OnsenWoodenBucketsAndStools", hinoki_mat, uv_scale=1.2, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_copper, "BucketCopperBands", copper_mat, uv_scale=1.0, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_towel, "FoldedOnsenTowels", towel_mat, uv_scale=1.0, smooth_shading=True)


def main():
    helpers.clear_scene()
    granite_mat = mats.create_granite_lantern_material()
    glow_mat = mats.create_lantern_glow_material()
    snow_mat = mats.create_snow_material()
    bamboo_mat = mats.create_bamboo_material()
    twine_mat = mats.create_black_twine_material()
    hinoki_mat = mats.create_hinoki_deck_material()
    copper_mat = mats.create_copper_band_material()
    towel_mat = mats.create_towel_fabric_material()
    bm_granite = bmesh.new()
    bm_glow = bmesh.new()
    bm_snow = bmesh.new()
    add_stone_lantern_toro(bm_granite, bm_glow, bm_snow, (-3.30, 0.28, -2.75), 0.86)
    add_stone_lantern_toro(bm_granite, bm_glow, bm_snow, (2.45, 0.42, -2.05), 0.80)
    helpers.finalize_bmesh_to_object(bm_granite, "StoneLanternsToro", granite_mat, uv_scale=0.9, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_glow, "StoneLanternGlowCores", glow_mat, uv_scale=1.0, smooth_shading=False)
    helpers.finalize_bmesh_to_object(bm_snow, "StoneLanternSnowCaps", snow_mat, uv_scale=0.8, smooth_shading=True)
    build_bamboo_spout_kakehi(bamboo_mat, twine_mat, snow_mat)
    build_deck_buckets_stools_and_towels(hinoki_mat, copper_mat, towel_mat)
    output_path = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "public", "models", "onsen_props.glb"))
    helpers.export_glb_scene(output_path)


if __name__ == "__main__":
    main()
