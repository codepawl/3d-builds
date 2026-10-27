import math
import random
import bpy
import bmesh
from mathutils import Vector


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def three_to_blender(x_three, y_three, z_three):
    return (float(x_three), float(-z_three), float(y_three))


def three_vec_to_blender(vec_three):
    return Vector((float(vec_three[0]), float(-vec_three[2]), float(vec_three[1])))


def assign_material_to_object(blender_obj, material):
    if blender_obj.data.materials:
        blender_obj.data.materials[0] = material
    else:
        blender_obj.data.materials.append(material)


def generate_box_uvs_for_bmesh(bm, uv_scale):
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        normal = face.normal
        abs_x = abs(normal.x)
        abs_y = abs(normal.y)
        abs_z = abs(normal.z)
        for loop in face.loops:
            co = loop.vert.co
            if abs_z >= abs_x and abs_z >= abs_y:
                u_coord = co.x * uv_scale
                v_coord = co.y * uv_scale
            elif abs_x >= abs_y:
                u_coord = co.y * uv_scale
                v_coord = co.z * uv_scale
            else:
                u_coord = co.x * uv_scale
                v_coord = co.z * uv_scale
            loop[uv_layer].uv = (u_coord, v_coord)


def finalize_bmesh_to_object(bm, object_name, material, uv_scale=0.5, smooth_shading=True):
    bm.normal_update()
    generate_box_uvs_for_bmesh(bm, uv_scale)
    mesh_data = bpy.data.meshes.new(object_name + "_Mesh")
    bm.to_mesh(mesh_data)
    bm.free()
    for poly in mesh_data.polygons:
        poly.use_smooth = smooth_shading
    scene_object = bpy.data.objects.new(object_name, mesh_data)
    bpy.context.collection.objects.link(scene_object)
    if material is not None:
        assign_material_to_object(scene_object, material)
    return scene_object


def add_box_in_three_coords(bm, center_three, size_three, rotation_y_rad=0.0, bevel_ratio=0.06):
    cx, cy, cz = center_three
    sx, sy, sz = size_three
    min_dim = min(sx, sy, sz)
    temp_bm = bmesh.new()
    bmesh.ops.create_cube(temp_bm, size=1.0)
    for v in temp_bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    if min_dim > 0.012 and bevel_ratio > 0.0:
        bevel_amt = min(0.012, min_dim * bevel_ratio)
        bmesh.ops.bevel(
            temp_bm,
            geom=list(temp_bm.edges),
            offset=bevel_amt,
            offset_type="OFFSET",
            segments=1,
            profile=0.5,
            affect="EDGES",
        )
    cos_y = math.cos(rotation_y_rad)
    sin_y = math.sin(rotation_y_rad)
    vert_map = {}
    for v in temp_bm.verts:
        lx, ly, lz = v.co.x, v.co.y, v.co.z
        rx = lx * cos_y + lz * sin_y + cx
        ry = ly + cy
        rz = -lx * sin_y + lz * cos_y + cz
        bx, by, bz = three_to_blender(rx, ry, rz)
        vert_map[v] = bm.verts.new((bx, by, bz))
    for f in temp_bm.faces:
        bm.faces.new([vert_map[v] for v in f.verts])
    temp_bm.free()


def add_cylinder_between_three_points(bm, start_three, end_three, radius_start, radius_end, segments=12, cap_ends=True):
    p0 = three_vec_to_blender(start_three)
    p1 = three_vec_to_blender(end_three)
    axis = p1 - p0
    length = axis.length
    if length < 1e-5:
        return
    direction = axis.normalized()
    up_ref = Vector((0.0, 0.0, 1.0))
    if abs(direction.dot(up_ref)) > 0.95:
        up_ref = Vector((1.0, 0.0, 0.0))
    tangent = direction.cross(up_ref).normalized()
    bitangent = direction.cross(tangent).normalized()
    ring_start = []
    ring_end = []
    for seg_idx in range(segments):
        angle = (2.0 * math.pi * seg_idx) / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        radial_unit = tangent * cos_a + bitangent * sin_a
        v_start = bm.verts.new(p0 + radial_unit * radius_start)
        v_end = bm.verts.new(p1 + radial_unit * radius_end)
        ring_start.append(v_start)
        ring_end.append(v_end)
    for seg_idx in range(segments):
        next_idx = (seg_idx + 1) % segments
        bm.faces.new((ring_start[seg_idx], ring_start[next_idx], ring_end[next_idx], ring_end[seg_idx]))
    if cap_ends and radius_start > 1e-4:
        bm.faces.new(list(reversed(ring_start)))
    if cap_ends and radius_end > 1e-4:
        bm.faces.new(ring_end)


def deterministic_hash_3d(x_val, y_val, z_val, seed):
    val = math.sin(x_val * 12.9898 + y_val * 78.233 + z_val * 37.719 + seed * 53.13) * 43758.5453
    return val - math.floor(val)


def compute_rock_fracture_displacement(nx, ny, nz, planes, phases):
    r_clip = 1.06
    for px, py, pz, p_dist in planes:
        dot_val = nx * px + ny * py + nz * pz
        if dot_val > 0.18:
            plane_r = p_dist / dot_val
            if plane_r < r_clip:
                blend = 0.55
                r_clip = r_clip * (1.0 - blend) + plane_r * blend
    s1 = math.sin(nx * 3.6 + ny * 2.4 + phases[0])
    s2 = math.cos(nz * 3.9 - nx * 3.1 + phases[1])
    ridge_1 = 1.0 - math.sqrt(s1 * s1 + 0.045)
    ridge_2 = 1.0 - math.sqrt(s2 * s2 + 0.045)
    strata = math.sin(ny * 8.2 + nx * 1.5 + phases[2]) * 0.032
    micro = math.sin(nx * 9.4 + nz * 9.1 + phases[3]) * 0.016
    scale = r_clip * (0.88 + 0.11 * ridge_1 + 0.08 * ridge_2) + strata + micro
    return max(0.54, min(1.18, scale))


def eval_boulder_local_pos(nx, ny, nz, rx, ry, rz, planes, phases):
    disp = compute_rock_fracture_displacement(nx, ny, nz, planes, phases)
    local_x = nx * rx * disp
    local_y = ny * ry * disp
    local_z = nz * rz * disp
    if local_y > ry * 0.54:
        local_y = ry * 0.54 + (local_y - ry * 0.54) * 0.38
    if local_y < -ry * 0.55:
        local_y = -ry * 0.55 + (local_y + ry * 0.55) * 0.30
    return local_x, local_y, local_z


def add_sculpted_boulder_in_three_coords(bm_rock, bm_snow, center_three, radii_three, seed, add_snow_cap=True, subdivisions=4):
    temp_bm = bmesh.new()
    bmesh.ops.create_icosphere(temp_bm, subdivisions=subdivisions, radius=1.0)
    rng = random.Random(seed)
    phases = [rng.uniform(0.0, math.pi * 2.0) for _ in range(6)]
    planes = []
    for _ in range(8):
        theta = rng.uniform(0.0, math.pi * 2.0)
        phi = rng.uniform(-0.70, 0.88)
        px = math.cos(phi) * math.cos(theta)
        py = math.sin(phi)
        pz = math.cos(phi) * math.sin(theta)
        p_dist = rng.uniform(0.75, 0.96)
        planes.append((px, py, pz, p_dist))

    rx, ry, rz = radii_three
    cx, cy, cz = center_three
    yaw = rng.uniform(0.0, math.pi * 2.0)
    cos_y = math.cos(yaw)
    sin_y = math.sin(yaw)

    for vert in temp_bm.verts:
        nx, ny, nz = vert.co.x, vert.co.y, vert.co.z
        local_x, local_y, local_z = eval_boulder_local_pos(nx, ny, nz, rx, ry, rz, planes, phases)
        world_x = local_x * cos_y + local_z * sin_y + cx
        world_y = local_y + cy
        world_z = -local_x * sin_y + local_z * cos_y + cz
        vert.co = three_vec_to_blender((world_x, world_y, world_z))

    vert_map = {}
    for vert in temp_bm.verts:
        vert_map[vert] = bm_rock.verts.new(vert.co)
    for face in temp_bm.faces:
        bm_rock.faces.new([vert_map[v] for v in face.verts])
    temp_bm.free()

    if add_snow_cap and bm_snow is not None and (cy + ry * 0.45) > 0.20:
        rings = 12
        segments = 32
        max_theta = 0.82
        top_thick_center = 0.045 + ry * 0.14

        ring_verts = []
        first_ring_coords = []
        for r_idx in range(1, rings + 1):
            t_r = r_idx / float(rings)
            curr_ring = []
            for s_idx in range(segments):
                angle = (2.0 * math.pi * s_idx) / segments
                lobe_amp = (t_r ** 1.2)
                lobes = 1.0 + lobe_amp * (
                    0.10 * math.sin(angle * 2.0 + phases[4])
                    + 0.07 * math.cos(angle * 3.0 + phases[5])
                    + 0.04 * math.sin(angle * 5.0 + phases[0])
                )
                theta = t_r * max_theta * lobes
                ny = math.cos(theta)
                sin_t = math.sin(theta)
                nx = sin_t * math.cos(angle)
                nz = sin_t * math.sin(angle)
                local_x, local_y, local_z = eval_boulder_local_pos(nx, ny, nz, rx, ry, rz, planes, phases)

                rim_fade = 1.0 - (t_r ** 2.4)
                lip_bulge = (t_r ** 1.6) * math.sin(t_r * math.pi) * 0.022
                drift_ripple = (t_r ** 1.4) * 0.010 * math.sin(local_x * 4.5 + phases[1]) * math.cos(local_z * 4.5 + phases[2])
                snow_lift = top_thick_center * max(0.0, rim_fade) + lip_bulge + drift_ripple * rim_fade
                radial_expand = 1.0 + 0.025 * (t_r ** 1.3) * math.sin(t_r * math.pi)
                if t_r >= 0.98:
                    snow_lift = -0.014
                    radial_expand = 0.975

                sx_loc = local_x * radial_expand
                sy_loc = local_y + snow_lift
                sz_loc = local_z * radial_expand

                wx = sx_loc * cos_y + sz_loc * sin_y + cx
                wy = sy_loc + cy
                wz = -sx_loc * sin_y + sz_loc * cos_y + cz
                if r_idx == 1:
                    first_ring_coords.append((wx, wy, wz))
                curr_ring.append(bm_snow.verts.new(three_vec_to_blender((wx, wy, wz))))
            ring_verts.append(curr_ring)

        avg_wx = sum(c[0] for c in first_ring_coords) / len(first_ring_coords)
        avg_wy = sum(c[1] for c in first_ring_coords) / len(first_ring_coords) + 0.0025
        avg_wz = sum(c[2] for c in first_ring_coords) / len(first_ring_coords)
        center_vert = bm_snow.verts.new(three_vec_to_blender((avg_wx, avg_wy, avg_wz)))

        for s_idx in range(segments):
            next_s = (s_idx + 1) % segments
            bm_snow.faces.new((center_vert, ring_verts[0][next_s], ring_verts[0][s_idx]))
        for r_idx in range(rings - 1):
            for s_idx in range(segments):
                next_s = (s_idx + 1) % segments
                v00 = ring_verts[r_idx][s_idx]
                v01 = ring_verts[r_idx][next_s]
                v11 = ring_verts[r_idx + 1][next_s]
                v10 = ring_verts[r_idx + 1][s_idx]
                bm_snow.faces.new((v00, v01, v11, v10))


def export_glb_scene(output_glb_path):
    bpy.ops.export_scene.gltf(
        filepath=output_glb_path,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
