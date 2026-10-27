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


def compute_pool_radius_at_angle(angle_rad):
    rx = 3.45
    rz = 3.05
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    ellipse_r = (rx * rz) / math.sqrt((rz * cos_a) ** 2 + (rx * sin_a) ** 2)
    organic_wave = 0.22 * math.sin(2.0 * angle_rad + 0.6) + 0.14 * math.cos(3.0 * angle_rad - 0.5)
    return ellipse_r + organic_wave


def get_pool_center_xz():
    return (0.35, 0.35)


def build_pool_basin_and_submerged_stones(wet_stone_mat):
    bm = bmesh.new()
    pool_cx, pool_cz = get_pool_center_xz()
    radial_steps = 32
    angular_steps = 72
    rings = []
    for r_idx in range(radial_steps + 1):
        frac = r_idx / float(radial_steps)
        ring_verts = []
        for a_idx in range(angular_steps):
            angle = (2.0 * math.pi * a_idx) / angular_steps
            max_r = compute_pool_radius_at_angle(angle) + 0.68
            radius = frac * max_r
            wx = pool_cx + radius * math.cos(angle)
            wz = pool_cz + radius * math.sin(angle)
            edge_blend = max(0.0, min(1.0, (frac - 0.70) / 0.30))
            smooth_edge = edge_blend * edge_blend * (3.0 - 2.0 * edge_blend)
            ripple = 0.032 * math.sin(wx * 2.5 + wz * 2.1) + 0.015 * math.cos(wx * 5.2 - wz * 4.8)
            wy = -0.58 * (1.0 - smooth_edge) + (-0.05) * smooth_edge + ripple * (1.0 - smooth_edge)
            bx, by, bz = helpers.three_to_blender(wx, wy, wz)
            ring_verts.append(bm.verts.new((bx, by, bz)))
        rings.append(ring_verts)
    for r_idx in range(radial_steps):
        for a_idx in range(angular_steps):
            next_a = (a_idx + 1) % angular_steps
            v00 = rings[r_idx][a_idx]
            v10 = rings[r_idx + 1][a_idx]
            v11 = rings[r_idx + 1][next_a]
            v01 = rings[r_idx][next_a]
            bm.faces.new((v00, v10, v11, v01))

    rng = random.Random(4201)
    for stone_idx in range(44):
        angle = rng.uniform(0.0, math.pi * 2.0)
        dist = rng.uniform(0.28, 2.75)
        sx = pool_cx + math.cos(angle) * dist
        sz = pool_cz + math.sin(angle) * dist
        sy = -0.51 + rng.uniform(-0.02, 0.05)
        rx = rng.uniform(0.20, 0.46)
        ry = rng.uniform(0.06, 0.14)
        rz = rng.uniform(0.18, 0.42)
        helpers.add_sculpted_boulder_in_three_coords(bm, None, (sx, sy, sz), (rx, ry, rz), 500 + stone_idx, False, 2)

    step_positions = [
        (-0.85, -0.14, -2.32, 0.56, 0.10, 0.35),
        (-0.70, -0.28, -1.92, 0.50, 0.10, 0.33),
        (0.25, -0.20, -2.18, 0.60, 0.11, 0.35),
    ]
    for sx, sy, sz, rx, ry, rz in step_positions:
        helpers.add_sculpted_boulder_in_three_coords(bm, None, (sx, sy, sz), (rx, ry, rz), 600, False, 3)
    helpers.finalize_bmesh_to_object(bm, "PoolBasinFloor", wet_stone_mat, uv_scale=0.65, smooth_shading=True)


def build_pool_perimeter_boulders_and_snow(rock_mat, snow_mat, wet_stone_mat):
    bm_rock = bmesh.new()
    bm_snow = bmesh.new()
    pool_cx, pool_cz = get_pool_center_xz()
    rng = random.Random(7719)
    boulder_count = 64
    for idx in range(boulder_count):
        angle = (2.0 * math.pi * idx) / boulder_count + rng.uniform(-0.035, 0.035)
        base_r = compute_pool_radius_at_angle(angle) + rng.uniform(-0.14, 0.16)
        wx = pool_cx + base_r * math.cos(angle)
        wz = pool_cz + base_r * math.sin(angle)
        is_deck_entry = (wz < -2.15) and (-2.05 < wx < 1.15)
        if is_deck_entry:
            rx = rng.uniform(0.26, 0.38)
            ry = rng.uniform(0.09, 0.15)
            rz = rng.uniform(0.24, 0.36)
            wy = 0.03 + rng.uniform(-0.015, 0.02)
            helpers.add_sculpted_boulder_in_three_coords(bm_rock, None, (wx, wy, wz), (rx, ry, rz), 1000 + idx, False, 3)
        else:
            is_low_wet_stone = (idx % 4 == 1)
            if is_low_wet_stone:
                rx = rng.uniform(0.30, 0.50)
                ry = rng.uniform(0.13, 0.22)
                rz = rng.uniform(0.28, 0.46)
                wy = 0.02 + rng.uniform(-0.02, 0.03)
                helpers.add_sculpted_boulder_in_three_coords(
                    bm_rock,
                    None,
                    (wx, wy, wz),
                    (rx, ry, rz),
                    2000 + idx,
                    False,
                    4,
                )
            else:
                size_boost = 1.16 if (idx % 5 == 0) else 0.94
                rx = rng.uniform(0.36, 0.62) * size_boost
                ry = rng.uniform(0.22, 0.40) * size_boost
                rz = rng.uniform(0.35, 0.60) * size_boost
                wy = 0.06 + ry * 0.20 + rng.uniform(-0.03, 0.04)
                helpers.add_sculpted_boulder_in_three_coords(
                    bm_rock,
                    bm_snow,
                    (wx, wy, wz),
                    (rx, ry, rz),
                    2000 + idx,
                    True,
                    4,
                )
            inner_r = base_r - rng.uniform(0.26, 0.44)
            ix = pool_cx + inner_r * math.cos(angle + 0.04)
            iz = pool_cz + inner_r * math.sin(angle + 0.04)
            helpers.add_sculpted_boulder_in_three_coords(
                bm_rock,
                None,
                (ix, -0.02 + rng.uniform(-0.02, 0.03), iz),
                (rng.uniform(0.18, 0.30), rng.uniform(0.08, 0.14), rng.uniform(0.18, 0.28)),
                5000 + idx,
                False,
                3,
            )

    outer_boulders = [
        (2.45, 0.24, -2.05, 0.58, 0.34, 0.50),
        (3.25, 0.34, -1.25, 0.76, 0.48, 0.66),
        (-2.65, 0.14, -1.60, 0.54, 0.20, 0.52),
        (-3.20, 0.24, -2.20, 0.54, 0.32, 0.46),
        (3.95, 0.30, 1.35, 0.76, 0.46, 0.66),
        (2.75, 0.24, 3.40, 0.64, 0.36, 0.56),
        (-2.55, 0.20, 3.45, 0.52, 0.26, 0.48),
    ]
    for idx, (bx, by, bz, rx, ry, rz) in enumerate(outer_boulders):
        add_cap = idx not in (0, 2)
        helpers.add_sculpted_boulder_in_three_coords(bm_rock, bm_snow, (bx, by, bz), (rx, ry, rz), 3000 + idx, add_cap, 4)

    helpers.finalize_bmesh_to_object(bm_rock, "PoolEdgeBoulders", rock_mat, uv_scale=0.80, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_snow, "PoolBoulderSnowCaps", snow_mat, uv_scale=0.70, smooth_shading=True)

    bm_steps = bmesh.new()
    stepping_stones = [
        (-1.15, 0.08, 5.45, 0.44, 0.06, 0.38),
        (-1.85, 0.08, 4.40, 0.40, 0.06, 0.35),
        (-2.65, 0.09, 3.25, 0.44, 0.06, 0.38),
        (-3.35, 0.09, 2.05, 0.42, 0.065, 0.36),
        (-3.70, 0.10, 0.85, 0.45, 0.065, 0.38),
        (-3.65, 0.10, -0.35, 0.42, 0.065, 0.36),
        (-3.45, 0.11, -1.45, 0.40, 0.065, 0.36),
        (-3.25, 0.12, -2.35, 0.46, 0.07, 0.40),
    ]
    for idx, (sx, sy, sz, rx, ry, rz) in enumerate(stepping_stones):
        helpers.add_sculpted_boulder_in_three_coords(bm_steps, None, (sx, sy, sz), (rx, ry, rz), 4000 + idx, False, 3)
    helpers.finalize_bmesh_to_object(bm_steps, "GardenSteppingStones", wet_stone_mat, uv_scale=0.85, smooth_shading=True)


def compute_snow_ground_height(wx, wz):
    pool_cx, pool_cz = get_pool_center_xz()
    dx = wx - pool_cx
    dz = wz - pool_cz
    dist = math.sqrt(dx * dx + dz * dz)
    angle = math.atan2(dz, dx)
    pool_r = compute_pool_radius_at_angle(angle)
    if dist < pool_r - 0.15:
        return -0.68
    if -4.8 <= wx <= 2.4 and -9.5 <= wz <= -2.85:
        return 0.05
    rim_blend = max(0.0, min(1.0, (dist - (pool_r - 0.15)) / 0.95))
    rim_smooth = rim_blend * rim_blend * (3.0 - 2.0 * rim_blend)
    drift_wave = 0.075 * math.sin(wx * 0.45 + 0.4) * math.cos(wz * 0.42 - 0.3)
    secondary_wave = 0.032 * math.sin(wx * 1.15 - wz * 0.95)
    micro_dune = 0.014 * (1.0 - abs(math.sin(wx * 2.6 + wz * 1.9)))
    valley_rise = 0.0
    if dist > 10.5:
        outer_d = dist - 10.5
        valley_rise = (outer_d ** 1.12) * 0.038
    base_h = 0.085 + drift_wave + secondary_wave + micro_dune + valley_rise
    if -4.8 <= wx <= -0.2 and -3.0 <= wz <= 6.8:
        path_flatten = max(0.0, 1.0 - abs(dist - 4.25) / 1.4)
        base_h = base_h * (1.0 - path_flatten * 0.68) + 0.08 * (path_flatten * 0.68)
    return -0.68 * (1.0 - rim_smooth) + base_h * rim_smooth


def build_near_snow_ground(snow_mat):
    bm = bmesh.new()
    grid_res = 104
    extent = 28.0
    vert_grid = []
    for ix in range(grid_res + 1):
        row = []
        u_frac = (ix / float(grid_res)) * 2.0 - 1.0
        wx = u_frac * extent
        for iz in range(grid_res + 1):
            v_frac = (iz / float(grid_res)) * 2.0 - 1.0
            wz = v_frac * extent
            wy = compute_snow_ground_height(wx, wz)
            bx, by, bz = helpers.three_to_blender(wx, wy, wz)
            row.append(bm.verts.new((bx, by, bz)))
        vert_grid.append(row)
    for ix in range(grid_res):
        for iz in range(grid_res):
            v00 = vert_grid[ix][iz]
            v10 = vert_grid[ix + 1][iz]
            v11 = vert_grid[ix + 1][iz + 1]
            v01 = vert_grid[ix][iz + 1]
            bm.faces.new((v00, v01, v11, v10))
    helpers.finalize_bmesh_to_object(bm, "SnowGroundNear", snow_mat, uv_scale=0.22, smooth_shading=True)


def build_mountain_amphitheater(mountain_mat):
    bm = bmesh.new()
    radial_rings = 56
    angular_slices = 160
    min_r = 24.0
    max_r = 155.0
    rings = []
    peaks = [
        (-44.0, -68.0, 23.5, 14.5),
        (-16.0, -76.0, 21.5, 13.5),
        (16.0, -74.0, 24.0, 14.0),
        (44.0, -62.0, 26.5, 14.5),
        (66.0, -30.0, 27.5, 15.0),
        (70.0, 4.0, 25.5, 14.5),
        (58.0, 36.0, 23.5, 14.5),
        (14.0, 72.0, 22.0, 15.0),
        (-38.0, 66.0, 21.5, 15.0),
        (-68.0, 18.0, 20.5, 14.5),
        (-68.0, -36.0, 22.0, 14.5),
    ]
    for r_idx in range(radial_rings + 1):
        t_rad = r_idx / float(radial_rings)
        radius = min_r + (max_r - min_r) * (t_rad ** 1.08)
        ring_verts = []
        for a_idx in range(angular_slices):
            angle = (2.0 * math.pi * a_idx) / angular_slices
            wx = radius * math.cos(angle)
            wz = radius * math.sin(angle)
            edge_in = max(0.0, min(1.0, (radius - min_r) / 14.0))
            smooth_in = edge_in * edge_in * (3.0 - 2.0 * edge_in)
            arete_1 = 1.0 - abs(math.sin(angle * 7.0 + t_rad * 1.8))
            arete_2 = 1.0 - abs(math.cos(angle * 15.0 - t_rad * 2.9))
            couloir = 1.0 - abs(math.sin(angle * 27.0 + t_rad * 4.2))
            ridge_crest = (arete_1 * arete_1) * 2.4 + (arete_2 * arete_2) * 1.2 + couloir * 0.45
            base_slope = ((radius - min_r) ** 0.85) * 0.032
            peak_sum = 0.0
            for px, pz, ph, pw in peaks:
                dist_sq = (wx - px) ** 2 + (wz - pz) ** 2
                influence = math.exp(-dist_sq / (2.0 * pw * pw))
                spur_angle = math.atan2(wz - pz, wx - px)
                spur_ridge = 1.0 - 0.26 * abs(math.sin(spur_angle * 4.0 + dist_sq * 0.002))
                crag_detail = 0.06 * (1.0 - abs(math.sin(wx * 0.22 - wz * 0.19)))
                peak_sum = peak_sum + ph * influence * (spur_ridge + crag_detail)
            near_match = compute_snow_ground_height(
                max(-27.0, min(27.0, wx)),
                max(-27.0, min(27.0, wz)),
            )
            mountain_h = near_match + smooth_in * (base_slope + peak_sum + ridge_crest * t_rad)
            bx, by, bz = helpers.three_to_blender(wx, mountain_h, wz)
            ring_verts.append(bm.verts.new((bx, by, bz)))
        rings.append(ring_verts)
    for r_idx in range(radial_rings):
        for a_idx in range(angular_slices):
            next_a = (a_idx + 1) % angular_slices
            v00 = rings[r_idx][a_idx]
            v10 = rings[r_idx + 1][a_idx]
            v11 = rings[r_idx + 1][next_a]
            v01 = rings[r_idx][next_a]
            bm.faces.new((v00, v10, v11, v01))
    helpers.finalize_bmesh_to_object(bm, "SnowyMountainRange", mountain_mat, uv_scale=0.055, smooth_shading=True)


def main():
    helpers.clear_scene()
    snow_mat = mats.create_snow_material()
    rock_mat = mats.create_onsen_rock_material()
    wet_stone_mat = mats.create_wet_stone_floor_material()
    mountain_mat = mats.create_mountain_slope_material()
    build_pool_basin_and_submerged_stones(wet_stone_mat)
    build_pool_perimeter_boulders_and_snow(rock_mat, snow_mat, wet_stone_mat)
    build_near_snow_ground(snow_mat)
    build_mountain_amphitheater(mountain_mat)
    output_path = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "public", "models", "onsen_pool_and_terrain.glb"))
    helpers.export_glb_scene(output_path)


if __name__ == "__main__":
    main()
