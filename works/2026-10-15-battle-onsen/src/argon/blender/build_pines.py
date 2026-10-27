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
import build_pool_and_terrain as terrain


def eval_tuft_local_pos(nx, ny, nz, rx, ry, rz, p0, p1, p2):
    s_val = math.sin(nx * 5.8 + nz * 5.4 + p0)
    needle_spike = 1.0 - math.sqrt(s_val * s_val + 0.05)
    shoot_wave = math.sin(nx * 4.2 - ny * 3.7 + p1) * math.cos(nz * 4.5 + p2)
    radial_boost = 0.80 + 0.26 * needle_spike + 0.12 * shoot_wave
    lx = nx * rx * radial_boost
    lz = nz * rz * radial_boost
    if ny >= 0.0:
        ly = (ny ** 0.84) * ry * (0.86 + 0.18 * needle_spike)
    else:
        ly = -((-ny) ** 1.15) * ry * (0.45 + 0.18 * abs(shoot_wave))
    return lx, ly, lz


def add_single_needle_tuft(
    bm_foliage,
    bm_snow,
    tuft_center,
    radii,
    seed,
    with_snow,
    subdivisions=2,
    snow_rings=4,
    snow_segments=12,
):
    temp_bm = bmesh.new()
    bmesh.ops.create_icosphere(temp_bm, subdivisions=subdivisions, radius=1.0)
    rng = random.Random(seed)
    rx, ry, rz = radii
    cx, cy, cz = tuft_center
    yaw = rng.uniform(0.0, math.pi * 2.0)
    pitch = rng.uniform(-0.18, 0.18)
    cos_y = math.cos(yaw)
    sin_y = math.sin(yaw)
    cos_p = math.cos(pitch)
    sin_p = math.sin(pitch)
    p0 = rng.uniform(0.0, 6.28)
    p1 = rng.uniform(0.0, 6.28)
    p2 = rng.uniform(0.0, 6.28)

    for v in temp_bm.verts:
        nx, ny, nz = v.co.x, v.co.y, v.co.z
        lx, ly, lz = eval_tuft_local_pos(nx, ny, nz, rx, ry, rz, p0, p1, p2)
        ry_p = ly * cos_p - lz * sin_p
        rz_p = ly * sin_p + lz * cos_p
        wx = lx * cos_y + rz_p * sin_y + cx
        wy = ry_p + cy
        wz = -lx * sin_y + rz_p * cos_y + cz
        v.co = helpers.three_vec_to_blender((wx, wy, wz))

    v_map = {}
    for v in temp_bm.verts:
        v_map[v] = bm_foliage.verts.new(v.co)
    for f in temp_bm.faces:
        bm_foliage.faces.new([v_map[v] for v in f.verts])
    temp_bm.free()

    if with_snow and bm_snow is not None:
        rings = snow_rings
        segments = snow_segments
        max_theta = 0.88
        lx0, ly0, lz0 = eval_tuft_local_pos(0.0, 1.0, 0.0, rx, ry, rz, p0, p1, p2)
        snow_thick_center = 0.032 + ry * 0.24
        ly0_s = ly0 + snow_thick_center
        ry_p0 = ly0_s * cos_p - lz0 * sin_p
        rz_p0 = ly0_s * sin_p + lz0 * cos_p
        wx0 = lx0 * cos_y + rz_p0 * sin_y + cx
        wy0 = ry_p0 + cy
        wz0 = -lx0 * sin_y + rz_p0 * cos_y + cz
        center_v = bm_snow.verts.new(helpers.three_vec_to_blender((wx0, wy0, wz0)))

        ring_verts = []
        for r_idx in range(1, rings + 1):
            t_r = r_idx / float(rings)
            curr_ring = []
            for s_idx in range(segments):
                angle = (2.0 * math.pi * s_idx) / segments
                lobes = 1.0 + 0.12 * math.sin(angle * 3.0 + p0) + 0.08 * math.cos(angle * 4.0 + p1)
                theta = t_r * max_theta * lobes
                ny = math.cos(theta)
                sin_t = math.sin(theta)
                nx = sin_t * math.cos(angle)
                nz = sin_t * math.sin(angle)
                lx, ly, lz = eval_tuft_local_pos(nx, ny, nz, rx, ry, rz, p0, p1, p2)

                rim_fade = 1.0 - (t_r ** 2.2)
                lip_bulge = math.sin(t_r * math.pi) * 0.016
                snow_lift = snow_thick_center * max(0.0, rim_fade) + lip_bulge
                radial_expand = 0.94 + 0.03 * math.sin(t_r * math.pi)
                if t_r >= 0.98:
                    snow_lift = -0.012
                    radial_expand = 0.90

                sx = lx * radial_expand
                sy = ly + snow_lift
                sz = lz * radial_expand
                ry_p = sy * cos_p - sz * sin_p
                rz_p = sy * sin_p + sz * cos_p
                wx = sx * cos_y + rz_p * sin_y + cx
                wy = ry_p + cy
                wz = -sx * sin_y + rz_p * cos_y + cz
                curr_ring.append(bm_snow.verts.new(helpers.three_vec_to_blender((wx, wy, wz))))
            ring_verts.append(curr_ring)

        for s_idx in range(segments):
            next_s = (s_idx + 1) % segments
            bm_snow.faces.new((center_v, ring_verts[0][next_s], ring_verts[0][s_idx]))
        for r_idx in range(rings - 1):
            for s_idx in range(segments):
                next_s = (s_idx + 1) % segments
                v00 = ring_verts[r_idx][s_idx]
                v01 = ring_verts[r_idx][next_s]
                v11 = ring_verts[r_idx + 1][next_s]
                v10 = ring_verts[r_idx + 1][s_idx]
                bm_snow.faces.new((v00, v01, v11, v10))


def add_pine_foliage_cluster(
    bm_foliage,
    bm_snow,
    cluster_pos,
    scale_r,
    scale_h,
    seed,
    snow_probability=0.82,
    sub_count=4,
    subdivisions=2,
    snow_rings=4,
    snow_segments=12,
):
    rng = random.Random(seed)
    cx, cy, cz = cluster_pos
    for s_idx in range(sub_count):
        if s_idx == 0:
            ox = 0.0
            oy = scale_h * 0.16
            oz = 0.0
            srx = scale_r * 0.68
            sry = scale_h * 0.62
            srz = scale_r * 0.65
        else:
            angle = (2.0 * math.pi * (s_idx - 1)) / max(1, sub_count - 1) + rng.uniform(-0.42, 0.42)
            dist = scale_r * rng.uniform(0.34, 0.56)
            ox = math.cos(angle) * dist
            oz = math.sin(angle) * dist
            oy = rng.uniform(-0.18, 0.12) * scale_h
            srx = scale_r * rng.uniform(0.46, 0.64)
            sry = scale_h * rng.uniform(0.48, 0.66)
            srz = scale_r * rng.uniform(0.44, 0.62)
        has_snow = rng.random() < snow_probability
        add_single_needle_tuft(
            bm_foliage,
            bm_snow,
            (cx + ox, cy + oy, cz + oz),
            (srx, sry, srz),
            seed + s_idx * 17,
            has_snow,
            subdivisions=subdivisions,
            snow_rings=snow_rings,
            snow_segments=snow_segments,
        )


def add_gnarled_onsen_pine(bm_bark, bm_foliage, bm_snow, base_pos, lean_dir_xz, scale, seed):
    rng = random.Random(seed)
    bx, by, bz = base_pos
    lx, lz = lean_dir_xz
    s = scale

    for r_idx in range(5):
        r_ang = (2.0 * math.pi * r_idx) / 5.0 + rng.uniform(-0.25, 0.25)
        r_end = (
            bx + math.cos(r_ang) * 0.55 * s,
            by - 0.12 * s,
            bz + math.sin(r_ang) * 0.55 * s,
        )
        r_start = (
            bx + math.cos(r_ang) * 0.12 * s,
            by + 0.22 * s,
            bz + math.sin(r_ang) * 0.12 * s,
        )
        helpers.add_cylinder_between_three_points(bm_bark, r_start, r_end, 0.11 * s, 0.04 * s, 7)

    p0 = (bx, by - 0.15, bz)
    p1 = (bx + lx * 0.62 * s, by + 1.05 * s, bz + lz * 0.58 * s)
    p2 = (p1[0] + lx * 0.78 * s, p1[1] + 1.10 * s, p1[2] + lz * 0.45 * s)
    p3 = (p2[0] + lx * 0.48 * s, p2[1] + 0.92 * s, p2[2] - lz * 0.22 * s)
    p4 = (p3[0] - lx * 0.18 * s, p3[1] + 0.72 * s, p3[2] + lz * 0.18 * s)

    helpers.add_cylinder_between_three_points(bm_bark, p0, p1, 0.25 * s, 0.19 * s, 10)
    helpers.add_cylinder_between_three_points(bm_bark, p1, p2, 0.19 * s, 0.14 * s, 10)
    helpers.add_cylinder_between_three_points(bm_bark, p2, p3, 0.14 * s, 0.095 * s, 9)
    helpers.add_cylinder_between_three_points(bm_bark, p3, p4, 0.095 * s, 0.045 * s, 8)

    limb_specs = [
        (p1, (p1[0] + lx * 0.65 * s, p1[1] + 0.18 * s, p1[2] - 0.52 * s), (p1[0] + lx * 1.25 * s, p1[1] + 0.12 * s, p1[2] - 0.95 * s), 0.72 * s, 0.28 * s),
        (p1, (p1[0] - lx * 0.35 * s, p1[1] + 0.25 * s, p1[2] + 0.48 * s), (p1[0] - lx * 0.75 * s, p1[1] + 0.22 * s, p1[2] + 0.92 * s), 0.65 * s, 0.26 * s),
        (p2, (p2[0] + lx * 0.58 * s, p2[1] + 0.16 * s, p2[2] + 0.48 * s), (p2[0] + lx * 1.15 * s, p2[1] + 0.08 * s, p2[2] + 0.92 * s), 0.78 * s, 0.30 * s),
        (p2, (p2[0] - lx * 0.42 * s, p2[1] + 0.28 * s, p2[2] - 0.44 * s), (p2[0] - lx * 0.88 * s, p2[1] + 0.32 * s, p2[2] - 0.85 * s), 0.70 * s, 0.27 * s),
        (p2, (p2[0] + lx * 0.25 * s, p2[1] + 0.35 * s, p2[2] - 0.55 * s), (p2[0] + lx * 0.52 * s, p2[1] + 0.42 * s, p2[2] - 1.05 * s), 0.64 * s, 0.25 * s),
        (p3, (p3[0] + lx * 0.48 * s, p3[1] + 0.18 * s, p3[2] + 0.28 * s), (p3[0] + lx * 0.92 * s, p3[1] + 0.15 * s, p3[2] + 0.52 * s), 0.74 * s, 0.28 * s),
        (p3, (p3[0] - lx * 0.38 * s, p3[1] + 0.30 * s, p3[2] - 0.28 * s), (p3[0] - lx * 0.72 * s, p3[1] + 0.38 * s, p3[2] - 0.55 * s), 0.66 * s, 0.26 * s),
        (p4, (p4[0] + lx * 0.22 * s, p4[1] + 0.18 * s, p4[2] - 0.18 * s), (p4[0] + lx * 0.42 * s, p4[1] + 0.25 * s, p4[2] - 0.32 * s), 0.68 * s, 0.26 * s),
        (p4, (p4[0] - lx * 0.20 * s, p4[1] + 0.24 * s, p4[2] + 0.22 * s), (p4[0] - lx * 0.38 * s, p4[1] + 0.35 * s, p4[2] + 0.40 * s), 0.60 * s, 0.24 * s),
    ]

    for b_idx, (b_start, b_mid, b_end, pad_r, pad_h) in enumerate(limb_specs):
        helpers.add_cylinder_between_three_points(bm_bark, b_start, b_mid, 0.082 * s, 0.052 * s, 7)
        helpers.add_cylinder_between_three_points(bm_bark, b_mid, b_end, 0.052 * s, 0.024 * s, 6)
        add_pine_foliage_cluster(
            bm_foliage,
            bm_snow,
            (b_mid[0], b_mid[1] + 0.08 * s, b_mid[2]),
            pad_r * 0.72,
            pad_h * 0.78,
            seed + b_idx * 41,
            snow_probability=0.78,
            sub_count=4,
            subdivisions=2,
            snow_rings=4,
            snow_segments=12,
        )
        add_pine_foliage_cluster(
            bm_foliage,
            bm_snow,
            (b_end[0], b_end[1] + 0.06 * s, b_end[2]),
            pad_r,
            pad_h,
            seed + b_idx * 41 + 19,
            snow_probability=0.88,
            sub_count=4,
            subdivisions=2,
            snow_rings=4,
            snow_segments=12,
        )


def add_conifer_pine_tree(bm_bark, bm_foliage, bm_snow, base_pos, height, radius, seed):
    bx, by, bz = base_pos
    dist_from_pool = math.hypot(bx, bz)
    is_near = dist_from_pool < 18.0
    rng = random.Random(seed)
    lean_x = rng.uniform(-0.18, 0.18)
    lean_z = rng.uniform(-0.18, 0.18)
    mid_y = by + height * 0.50
    top_y = by + height * 0.95
    p_base = (bx, by - 0.25, bz)
    p_mid = (bx + lean_x * 0.45, mid_y, bz + lean_z * 0.45)
    p_top = (bx + lean_x, top_y, bz + lean_z)

    helpers.add_cylinder_between_three_points(bm_bark, p_base, p_mid, radius * 0.14, radius * 0.085, 8)
    helpers.add_cylinder_between_three_points(bm_bark, p_mid, p_top, radius * 0.085, radius * 0.022, 7)

    branch_count = 16 if is_near else 13
    sub_count = 3 if is_near else 2
    snow_rings = 3 if is_near else 2
    snow_segments = 9 if is_near else 8
    golden_angle = 2.3999632
    base_angle_offset = rng.uniform(0.0, math.pi * 2.0)

    for b_idx in range(branch_count):
        frac = b_idx / float(branch_count - 1)
        h_frac = 0.20 + 0.74 * (frac ** 0.92)
        branch_y = by + height * h_frac + rng.uniform(-0.025, 0.025) * height
        t_trunk = max(0.0, min(1.0, (branch_y - by) / (height * 0.95)))
        trunk_x = bx + lean_x * t_trunk
        trunk_z = bz + lean_z * t_trunk

        azimuth = base_angle_offset + b_idx * golden_angle + rng.uniform(-0.28, 0.28)
        cos_a = math.cos(azimuth)
        sin_a = math.sin(azimuth)

        taper = (1.0 - frac * 0.74) * rng.uniform(0.84, 1.14)
        b_len = radius * taper * 1.05
        droop = height * (0.045 * (1.0 - frac * 0.65))

        b_start = (trunk_x, branch_y, trunk_z)
        b_mid = (
            trunk_x + cos_a * b_len * 0.54,
            branch_y - droop * 0.35 + 0.04 * height * frac,
            trunk_z + sin_a * b_len * 0.54,
        )
        b_end = (
            trunk_x + cos_a * b_len,
            branch_y - droop * 0.85 + 0.06 * height * frac,
            trunk_z + sin_a * b_len,
        )

        r_root = max(0.018, radius * 0.045 * (1.0 - frac * 0.65))
        helpers.add_cylinder_between_three_points(bm_bark, b_start, b_mid, r_root, r_root * 0.62, 6)
        helpers.add_cylinder_between_three_points(bm_bark, b_mid, b_end, r_root * 0.62, r_root * 0.28, 5)

        cluster_r = radius * (0.40 - frac * 0.22) * rng.uniform(0.88, 1.12)
        cluster_h = height * (0.085 - frac * 0.038) * rng.uniform(0.90, 1.12)

        if frac < 0.65:
            add_pine_foliage_cluster(
                bm_foliage,
                bm_snow,
                (b_mid[0], b_mid[1] + cluster_h * 0.25, b_mid[2]),
                cluster_r * 0.82,
                cluster_h * 0.85,
                seed + b_idx * 53 + 7,
                snow_probability=0.76,
                sub_count=max(2, sub_count - 1),
                subdivisions=1,
                snow_rings=snow_rings,
                snow_segments=snow_segments,
            )

        add_pine_foliage_cluster(
            bm_foliage,
            bm_snow,
            (b_end[0], b_end[1] + cluster_h * 0.22, b_end[2]),
            cluster_r,
            cluster_h,
            seed + b_idx * 53 + 23,
            snow_probability=0.88,
            sub_count=sub_count,
            subdivisions=1,
            snow_rings=snow_rings,
            snow_segments=snow_segments,
        )

    add_pine_foliage_cluster(
        bm_foliage,
        bm_snow,
        (p_top[0], p_top[1] + height * 0.03, p_top[2]),
        radius * 0.24,
        height * 0.065,
        seed + 999,
        snow_probability=0.92,
        sub_count=sub_count,
        subdivisions=1,
        snow_rings=snow_rings,
        snow_segments=snow_segments,
    )


def main():
    helpers.clear_scene()
    bark_mat = mats.create_pine_bark_material()
    needle_mat = mats.create_pine_needle_material()
    snow_mat = mats.create_snow_material()
    bm_bark = bmesh.new()
    bm_foliage = bmesh.new()
    bm_snow = bmesh.new()

    east_y = terrain.compute_snow_ground_height(5.15, -0.65)
    add_gnarled_onsen_pine(bm_bark, bm_foliage, bm_snow, (5.15, east_y, -0.65), (-0.72, 0.14), 0.92, 8100)

    west_y = terrain.compute_snow_ground_height(-6.65, -2.95)
    add_gnarled_onsen_pine(bm_bark, bm_foliage, bm_snow, (-6.65, west_y, -2.95), (0.62, 0.22), 0.94, 8200)

    conifer_specs = [
        (-6.2, -8.2, 6.4, 1.55),
        (-8.2, -5.6, 6.0, 1.48),
        (5.6, -7.4, 6.0, 1.48),
        (7.8, -4.8, 5.4, 1.38),
        (9.4, 4.8, 5.6, 1.40),
        (-8.2, 1.8, 5.8, 1.44),
        (-7.0, 5.2, 5.6, 1.38),
        (6.4, 6.2, 5.8, 1.42),
        (-6.5, -13.8, 6.8, 1.64),
        (6.0, -14.5, 6.6, 1.60),
        (9.2, -11.8, 6.4, 1.54),
        (-8.8, -12.0, 6.6, 1.60),
    ]
    rng = random.Random(9012)
    for idx in range(32):
        angle = rng.uniform(-math.pi * 0.95, math.pi * 0.35)
        dist = rng.uniform(16.8, 34.0)
        tx = math.cos(angle) * dist
        tz = math.sin(angle) * dist
        if tz > 2.0 and -6.5 < tx < 4.0:
            continue
        if tz < -4.0 and -5.0 < tx < 4.5:
            continue
        if tx > 4.0 and -3.5 < tz < 4.2:
            continue
        if tx > 3.5 and -6.0 < tz < 1.5:
            th = rng.uniform(4.4, 5.6)
        else:
            th = rng.uniform(6.0, 8.8)
        tr = th * rng.uniform(0.21, 0.25)
        conifer_specs.append((tx, tz, th, tr))
    for c_idx, (tx, tz, th, tr) in enumerate(conifer_specs):
        ty = terrain.compute_snow_ground_height(tx, tz)
        add_conifer_pine_tree(bm_bark, bm_foliage, bm_snow, (tx, ty, tz), th, tr, 9200 + c_idx * 47)

    helpers.finalize_bmesh_to_object(bm_bark, "PineTrunksAndBranches", bark_mat, uv_scale=0.7, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_foliage, "PineFoliageClusters", needle_mat, uv_scale=0.65, smooth_shading=True)
    helpers.finalize_bmesh_to_object(bm_snow, "PineBranchSnowCushions", snow_mat, uv_scale=0.55, smooth_shading=True)
    output_path = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "public", "models", "winter_pines.glb"))
    helpers.export_glb_scene(output_path)


if __name__ == "__main__":
    main()
