import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

# ==============================================================================
# PALETTE & PROCEDURAL PBR MATERIAL LIBRARY
# Matches reference warehouse-game look: cool light-slate world, crisp white
# structures, strong electric cobalt brand colour (#1D5BFF), safety amber,
# cyan, crimson, emerald accents, dark slate glazing, and emissive indicators.
# ==============================================================================

PALETTE = {
    # Surfaces & Terrain
    "terrain_water":       (0.48, 0.67, 0.88, 1.0),
    "terrain_shallow":     (0.60, 0.78, 0.94, 1.0),
    "terrain_sand":        (0.88, 0.86, 0.78, 1.0),
    "terrain_grass_low":   (0.72, 0.82, 0.74, 1.0),
    "terrain_grass_mid":   (0.62, 0.75, 0.66, 1.0),
    "terrain_hill_rock":   (0.66, 0.71, 0.79, 1.0),
    "terrain_rim":         (0.52, 0.58, 0.68, 1.0),
    "asphalt_dark":        (0.22, 0.25, 0.31, 1.0),
    "asphalt_taxi":        (0.28, 0.32, 0.39, 1.0),
    "concrete_apron":      (0.76, 0.80, 0.87, 1.0),
    "concrete_light":      (0.85, 0.88, 0.93, 1.0),
    # Structures & Vehicles
    "body_white":          (0.95, 0.97, 0.99, 1.0),
    "body_cool_grey":      (0.82, 0.86, 0.92, 1.0),
    "slate_mid":           (0.45, 0.51, 0.60, 1.0),
    "slate_dark":          (0.18, 0.22, 0.29, 1.0),
    "glass_dark":          (0.09, 0.14, 0.22, 1.0),
    "glass_tinted_blue":   (0.14, 0.26, 0.42, 1.0),
    "steel_brushed":       (0.68, 0.72, 0.78, 1.0),
    "chrome_bright":       (0.88, 0.91, 0.95, 1.0),
    "tire_rubber":         (0.11, 0.12, 0.14, 1.0),
    # Brand & Airline Liveries (Made-up only)
    "brand_cobalt":        (0.11, 0.36, 0.98, 1.0),  # Primary strong brand blue
    "brand_cobalt_dark":   (0.07, 0.22, 0.68, 1.0),
    "livery_cyan":         (0.04, 0.68, 0.84, 1.0),  # Veloce Jet
    "livery_amber":        (0.96, 0.60, 0.06, 1.0),  # Solstice Airways / GSE yellow
    "livery_crimson":      (0.91, 0.22, 0.24, 1.0),  # Meridian Heavy / ARFF red
    "livery_emerald":      (0.08, 0.72, 0.50, 1.0),  # Archipelago Commuter
    "livery_orange":       (0.97, 0.42, 0.08, 1.0),  # Windsock / Utility / Marshaller
    # Foliage & Characters
    "foliage_pine":        (0.28, 0.54, 0.44, 1.0),
    "foliage_leaf":        (0.38, 0.66, 0.48, 1.0),
    "trunk_wood":          (0.42, 0.34, 0.28, 1.0),
    "skin_warm":           (0.88, 0.70, 0.58, 1.0),
    "k9_coat":             (0.58, 0.42, 0.26, 1.0),
    "k9_dark":             (0.22, 0.18, 0.15, 1.0),
    "cloud_white":         (0.92, 0.95, 0.99, 1.0),
    "cloud_storm_base":    (0.46, 0.53, 0.66, 1.0),
}


def clear_scene():
    """Reset the Blender scene completely."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def _create_procedural_grid_image(name, bg_rgba, line_rgba, size=128, border=6, stripe=False):
    """Create a small procedurally baked texture image in memory (packed into GLB)."""
    if name in bpy.data.images:
        return bpy.data.images[name]
    img = bpy.data.images.new(name=name, width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            is_line = (x < border or x >= size - border or y < border or y >= size - border)
            if stripe and ((x + y) % 32 < 14):
                is_line = True
            col = line_rgba if is_line else bg_rgba
            pixels[idx:idx + 4] = col
    img.pixels[:] = pixels
    img.pack()
    return img


def make_pbr_material(
    name,
    base_color=(0.9, 0.9, 0.9, 1.0),
    metallic=0.0,
    roughness=0.45,
    emissive_color=None,
    emissive_strength=0.0,
    alpha=1.0,
    grid_line_color=None,
    stripe_pattern=False,
):
    """Create a Blender 5.2 Principled BSDF material with backface culling enabled."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    if hasattr(mat, "use_backface_culling_shadow"):
        mat.use_backface_culling_shadow = True

    if len(base_color) == 3:
        base_color = (base_color[0], base_color[1], base_color[2], alpha)
    else:
        base_color = (base_color[0], base_color[1], base_color[2], alpha)

    mat.diffuse_color = base_color

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = None
    for n in nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break
    if bsdf is None:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')

    if grid_line_color is not None:
        tex_img = _create_procedural_grid_image(
            f"Tex_{name}",
            bg_rgba=base_color,
            line_rgba=grid_line_color,
            size=128,
            border=5,
            stripe=stripe_pattern,
        )
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = tex_img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = base_color

    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = metallic
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = roughness

    if alpha < 0.999:
        if 'Alpha' in bsdf.inputs:
            bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = 'BLENDED'
        elif hasattr(mat, "blend_method"):
            mat.blend_method = 'BLEND'

    if emissive_color is not None and emissive_strength > 0.0:
        ecol = (
            (emissive_color[0], emissive_color[1], emissive_color[2], 1.0)
            if len(emissive_color) == 3
            else emissive_color
        )
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = ecol
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = ecol
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = emissive_strength

    return mat


def get_standard_materials():
    """Return a dictionary of shared PBR materials for the ATC world."""
    m = {}
    m['white'] = make_pbr_material(
        "Mat_Body_White", PALETTE["body_white"], metallic=0.05, roughness=0.35,
        grid_line_color=(0.89, 0.92, 0.96, 1.0)
    )
    m['cool_grey'] = make_pbr_material(
        "Mat_Body_CoolGrey", PALETTE["body_cool_grey"], metallic=0.08, roughness=0.42,
        grid_line_color=(0.76, 0.81, 0.88, 1.0)
    )
    m['slate_mid'] = make_pbr_material("Mat_Slate_Mid", PALETTE["slate_mid"], metallic=0.15, roughness=0.48)
    m['slate_dark'] = make_pbr_material("Mat_Slate_Dark", PALETTE["slate_dark"], metallic=0.20, roughness=0.40)
    m['glass_dark'] = make_pbr_material("Mat_Glass_Dark", PALETTE["glass_dark"], metallic=0.35, roughness=0.12)
    m['glass_blue'] = make_pbr_material("Mat_Glass_Blue", PALETTE["glass_tinted_blue"], metallic=0.30, roughness=0.15)
    m['steel'] = make_pbr_material("Mat_Steel_Brushed", PALETTE["steel_brushed"], metallic=0.75, roughness=0.28)
    m['chrome'] = make_pbr_material("Mat_Chrome", PALETTE["chrome_bright"], metallic=0.90, roughness=0.15)
    m['tire'] = make_pbr_material("Mat_Tire_Rubber", PALETTE["tire_rubber"], metallic=0.02, roughness=0.82)

    # Brand & Liveries
    m['cobalt'] = make_pbr_material("Mat_Brand_Cobalt", PALETTE["brand_cobalt"], metallic=0.12, roughness=0.32)
    m['cobalt_dark'] = make_pbr_material("Mat_Brand_CobaltDark", PALETTE["brand_cobalt_dark"], metallic=0.15, roughness=0.36)
    m['cyan'] = make_pbr_material("Mat_Livery_Cyan", PALETTE["livery_cyan"], metallic=0.12, roughness=0.32)
    m['amber'] = make_pbr_material("Mat_Livery_Amber", PALETTE["livery_amber"], metallic=0.10, roughness=0.35)
    m['crimson'] = make_pbr_material("Mat_Livery_Crimson", PALETTE["livery_crimson"], metallic=0.12, roughness=0.34)
    m['emerald'] = make_pbr_material("Mat_Livery_Emerald", PALETTE["livery_emerald"], metallic=0.10, roughness=0.36)
    m['orange'] = make_pbr_material("Mat_Livery_Orange", PALETTE["livery_orange"], metallic=0.08, roughness=0.38)
    m['hazard_yellow'] = make_pbr_material(
        "Mat_Hazard_Stripes", PALETTE["livery_amber"], metallic=0.08, roughness=0.38,
        grid_line_color=(0.15, 0.17, 0.22, 1.0), stripe_pattern=True
    )

    # Emissive Lights & Holograms
    m['emit_red'] = make_pbr_material(
        "Mat_Emit_Red", (0.98, 0.18, 0.18, 1.0), roughness=0.2,
        emissive_color=(1.0, 0.15, 0.15), emissive_strength=4.5
    )
    m['emit_green'] = make_pbr_material(
        "Mat_Emit_Green", (0.15, 0.95, 0.45, 1.0), roughness=0.2,
        emissive_color=(0.12, 0.98, 0.42), emissive_strength=4.5
    )
    m['emit_amber'] = make_pbr_material(
        "Mat_Emit_Amber", (1.0, 0.72, 0.12, 1.0), roughness=0.2,
        emissive_color=(1.0, 0.68, 0.08), emissive_strength=4.5
    )
    m['emit_cyan'] = make_pbr_material(
        "Mat_Emit_Cyan", (0.15, 0.85, 1.0, 1.0), roughness=0.2,
        emissive_color=(0.12, 0.82, 1.0), emissive_strength=4.0
    )
    m['emit_white'] = make_pbr_material(
        "Mat_Emit_White", (0.98, 0.99, 1.0, 1.0), roughness=0.15,
        emissive_color=(0.95, 0.98, 1.0), emissive_strength=5.0
    )
    m['emit_blue'] = make_pbr_material(
        "Mat_Emit_Blue", (0.20, 0.50, 1.0, 1.0), roughness=0.2,
        emissive_color=(0.18, 0.48, 1.0), emissive_strength=4.2
    )

    # Terrain & Pavements
    m['asphalt'] = make_pbr_material(
        "Mat_Asphalt_Runway", PALETTE["asphalt_dark"], metallic=0.02, roughness=0.78,
        grid_line_color=(0.20, 0.23, 0.29, 1.0)
    )
    m['taxiway'] = make_pbr_material(
        "Mat_Asphalt_Taxiway", PALETTE["asphalt_taxi"], metallic=0.02, roughness=0.74,
        grid_line_color=(0.25, 0.29, 0.36, 1.0)
    )
    m['apron'] = make_pbr_material(
        "Mat_Concrete_Apron", PALETTE["concrete_apron"], metallic=0.04, roughness=0.62,
        grid_line_color=(0.68, 0.73, 0.81, 1.0)
    )
    m['concrete_light'] = make_pbr_material("Mat_Concrete_Light", PALETTE["concrete_light"], metallic=0.03, roughness=0.58)
    m['marking_white'] = make_pbr_material("Mat_Marking_White", (0.96, 0.97, 0.99, 1.0), roughness=0.50)
    m['marking_yellow'] = make_pbr_material("Mat_Marking_Yellow", (0.98, 0.78, 0.12, 1.0), roughness=0.48)
    m['marking_red'] = make_pbr_material("Mat_Marking_Red", (0.90, 0.22, 0.22, 1.0), roughness=0.50)

    m['water'] = make_pbr_material("Mat_Water_Sea", PALETTE["terrain_water"], metallic=0.15, roughness=0.22)
    m['shallow'] = make_pbr_material("Mat_Water_Shallow", PALETTE["terrain_shallow"], metallic=0.10, roughness=0.28)
    m['sand'] = make_pbr_material("Mat_Coast_Sand", PALETTE["terrain_sand"], roughness=0.75)
    m['grass_low'] = make_pbr_material("Mat_Grass_Low", PALETTE["terrain_grass_low"], roughness=0.72)
    m['grass_mid'] = make_pbr_material("Mat_Grass_Mid", PALETTE["terrain_grass_mid"], roughness=0.74)
    m['rock'] = make_pbr_material("Mat_Hill_Rock", PALETTE["terrain_hill_rock"], roughness=0.68)
    m['rim'] = make_pbr_material("Mat_Terrain_Rim", PALETTE["terrain_rim"], roughness=0.65)

    # Foliage & Characters
    m['pine'] = make_pbr_material("Mat_Foliage_Pine", PALETTE["foliage_pine"], roughness=0.68)
    m['leaf'] = make_pbr_material("Mat_Foliage_Leaf", PALETTE["foliage_leaf"], roughness=0.65)
    m['wood'] = make_pbr_material("Mat_Trunk_Wood", PALETTE["trunk_wood"], roughness=0.78)
    m['skin'] = make_pbr_material("Mat_Char_Skin", PALETTE["skin_warm"], roughness=0.55)
    m['k9_coat'] = make_pbr_material("Mat_K9_Coat", PALETTE["k9_coat"], roughness=0.65)
    m['k9_dark'] = make_pbr_material("Mat_K9_Dark", PALETTE["k9_dark"], roughness=0.60)
    m['cloud_white'] = make_pbr_material("Mat_Cloud_White", PALETTE["cloud_white"], roughness=0.80)
    m['cloud_storm'] = make_pbr_material("Mat_Cloud_Storm", PALETTE["cloud_storm_base"], roughness=0.82)
    return m


# ==============================================================================
# PROCEDURAL BMESH GEOMETRY HELPERS (CLEAN TOPOLOGY, BEVELS, OUTWARD NORMALS)
# ==============================================================================

def _tag_faces_mat_and_smooth(faces, mat_idx=0, smooth=True):
    for f in faces:
        f.material_index = mat_idx
        f.smooth = smooth


def add_beveled_box(
    bm,
    size=(1.0, 1.0, 1.0),
    center=(0.0, 0.0, 0.0),
    rotation=(0.0, 0.0, 0.0),
    bevel_width=0.03,
    bevel_segments=2,
    mat_idx=0,
    scale_top=(1.0, 1.0),
):
    """Create a beveled box (or tapered prism if scale_top != (1,1)) in bm."""
    sx, sy, sz = size
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret['verts']

    for v in verts:
        vx = v.co.x * sx
        vy = v.co.y * sy
        vz = v.co.z * sz
        if v.co.z > 0:
            vx *= scale_top[0]
            vy *= scale_top[1]
        v.co = Vector((vx, vy, vz))

    # Collect edges and faces belonging to these verts
    vert_set = set(verts)
    edges = [e for e in bm.edges if e.verts[0] in vert_set and e.verts[1] in vert_set]
    faces = [f for f in bm.faces if all(v in vert_set for v in f.verts)]
    _tag_faces_mat_and_smooth(faces, mat_idx=mat_idx, smooth=True)

    if bevel_width > 0.0001 and bevel_segments > 0:
        min_dim = min(sx, sy, sz)
        bw = min(bevel_width, min_dim * 0.32)
        bev = bmesh.ops.bevel(
            bm,
            geom=edges,
            offset=bw,
            offset_type='OFFSET',
            segments=bevel_segments,
            profile=0.5,
            affect='EDGES',
        )
        _tag_faces_mat_and_smooth(bev.get('faces', []), mat_idx=mat_idx, smooth=True)
        verts = [v for v in (set(verts) | set(bev.get('verts', []))) if v.is_valid]

    if any(abs(r) > 1e-6 for r in rotation):
        rot_mat = Euler(rotation, 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_mat, verts=verts)

    if any(abs(c) > 1e-6 for c in center):
        bmesh.ops.translate(bm, vec=Vector(center), verts=verts)

    return verts


def add_cylinder_part(
    bm,
    radius1=0.5,
    radius2=None,
    depth=1.0,
    segments=24,
    center=(0.0, 0.0, 0.0),
    axis='Z',
    rotation=(0.0, 0.0, 0.0),
    bevel_width=0.02,
    bevel_segments=2,
    mat_idx=0,
    cap_ends=True,
):
    """Create a beveled cylinder or cone frustum oriented along X, Y, or Z."""
    if radius2 is None:
        radius2 = radius1
    ret = bmesh.ops.create_cone(
        bm,
        cap_ends=cap_ends,
        cap_tris=False,
        segments=segments,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
    )
    verts = ret['verts']
    vert_set = set(verts)
    faces = [f for f in bm.faces if all(v in vert_set for v in f.verts)]
    _tag_faces_mat_and_smooth(faces, mat_idx=mat_idx, smooth=True)

    if cap_ends and bevel_width > 0.0001 and bevel_segments > 0:
        # Bevel the top and bottom cap rim edges
        rim_edges = [
            e for e in bm.edges
            if e.verts[0] in vert_set and e.verts[1] in vert_set
            and abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4
        ]
        bw = min(bevel_width, min(max(radius1, 0.01), max(radius2, 0.01), depth) * 0.28)
        if rim_edges and bw > 0.0001:
            bev = bmesh.ops.bevel(
                bm,
                geom=rim_edges,
                offset=bw,
                offset_type='OFFSET',
                segments=bevel_segments,
                profile=0.5,
                affect='EDGES',
            )
            _tag_faces_mat_and_smooth(bev.get('faces', []), mat_idx=mat_idx, smooth=True)
            verts = [v for v in (set(verts) | set(bev.get('verts', []))) if v.is_valid]

    if axis == 'X':
        rot_axis = Euler((0.0, math.pi / 2.0, 0.0), 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_axis, verts=verts)
    elif axis == 'Y':
        rot_axis = Euler((-math.pi / 2.0, 0.0, 0.0), 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_axis, verts=verts)

    if any(abs(r) > 1e-6 for r in rotation):
        rot_mat = Euler(rotation, 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_mat, verts=verts)

    if any(abs(c) > 1e-6 for c in center):
        bmesh.ops.translate(bm, vec=Vector(center), verts=verts)

    return verts


def add_uv_sphere_part(
    bm,
    radius=0.5,
    scale=(1.0, 1.0, 1.0),
    center=(0.0, 0.0, 0.0),
    u_segments=20,
    v_segments=12,
    mat_idx=0,
):
    """Create a smooth ellipsoid/sphere in bm."""
    ret = bmesh.ops.create_uvsphere(
        bm,
        u_segments=u_segments,
        v_segments=v_segments,
        radius=radius,
    )
    verts = ret['verts']
    vert_set = set(verts)
    faces = [f for f in bm.faces if all(v in vert_set for v in f.verts)]
    _tag_faces_mat_and_smooth(faces, mat_idx=mat_idx, smooth=True)

    for v in verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
        v.co += Vector(center)
    return verts


def add_lofted_fuselage(
    bm,
    sections,
    segments=24,
    mat_idx=0,
    nose_mat_idx=None,
    tail_mat_idx=None,
    belly_mat_idx=None,
    stripe_z_range=None,
    stripe_mat_idx=None,
):
    """
    Build a smooth contoured fuselage/hull along Y from cross-section stations.
    Each station in `sections` is (y, z_center, rx, rz).
    """
    rings = []
    for y, zc, rx, rz in sections:
        ring = []
        r_x = max(rx, 0.008)
        r_z = max(rz, 0.008)
        for i in range(segments):
            ang = (2.0 * math.pi * i) / segments
            vx = math.cos(ang) * r_x
            vz = zc + math.sin(ang) * r_z
            v = bm.verts.new((vx, y, vz))
            ring.append(v)
        rings.append(ring)

    created_faces = []
    for r_idx in range(len(rings) - 1):
        r0 = rings[r_idx]
        r1 = rings[r_idx + 1]
        y_mid = 0.5 * (sections[r_idx][0] + sections[r_idx + 1][0])
        zc_mid = 0.5 * (sections[r_idx][1] + sections[r_idx + 1][1])
        for i in range(segments):
            ni = (i + 1) % segments
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True
            f_z = sum(v.co.z for v in f.verts) * 0.25
            m_use = mat_idx
            if stripe_z_range is not None and stripe_mat_idx is not None:
                if stripe_z_range[0] <= (f_z - zc_mid) <= stripe_z_range[1]:
                    m_use = stripe_mat_idx
            if belly_mat_idx is not None and (f_z - zc_mid) < -0.18 * sections[r_idx][3]:
                m_use = belly_mat_idx
            if nose_mat_idx is not None and r_idx == 0:
                m_use = nose_mat_idx
            if tail_mat_idx is not None and r_idx == len(rings) - 2:
                m_use = tail_mat_idx
            f.material_index = m_use
            created_faces.append(f)

    # Cap front & rear ends with a center vertex fan
    y0, zc0, _, _ = sections[0]
    v_front = bm.verts.new((0.0, y0 + 0.02, zc0))
    for i in range(segments):
        ni = (i + 1) % segments
        f = bm.faces.new((rings[0][ni], rings[0][i], v_front))
        f.smooth = True
        f.material_index = nose_mat_idx if nose_mat_idx is not None else mat_idx
        created_faces.append(f)

    yN, zcN, _, _ = sections[-1]
    v_back = bm.verts.new((0.0, yN - 0.02, zcN))
    for i in range(segments):
        ni = (i + 1) % segments
        f = bm.faces.new((rings[-1][i], rings[-1][ni], v_back))
        f.smooth = True
        f.material_index = tail_mat_idx if tail_mat_idx is not None else mat_idx
        created_faces.append(f)

    return created_faces


def add_airfoil_wing(
    bm,
    root_pos=(0.5, 0.0, 0.0),
    span=6.0,
    root_chord=2.2,
    tip_chord=0.8,
    sweep=1.8,
    dihedral=0.35,
    thick_root=0.26,
    thick_tip=0.10,
    side=1,
    winglet_height=0.0,
    mat_idx=0,
    tip_mat_idx=None,
):
    """
    Build a multi-section contoured airfoil wing (side = +1 for Right/+X, -1 for Left/-X)
    with optional blended winglet/sharklet and positive outward normals.
    """
    # Airfoil profile points around chord: (u in [-0.5..+0.5] from TE to LE, z_factor)
    profile = [
        (0.50, 0.00),    # Leading edge center
        (0.42, 0.44),    # Upper LE shoulder
        (0.15, 0.56),    # Upper max camber
        (-0.20, 0.36),   # Upper aft slope
        (-0.50, 0.05),   # Trailing edge upper
        (-0.50, -0.05),  # Trailing edge lower
        (-0.20, -0.26),  # Lower aft slope
        (0.15, -0.38),   # Lower max thickness
        (0.42, -0.30),   # Lower LE shoulder
    ]
    n_prof = len(profile)

    stations = [
        (0.0, root_chord, thick_root, 0.0, 0.0, mat_idx),
        (0.45, root_chord * 0.68 + tip_chord * 0.32, thick_root * 0.65 + thick_tip * 0.35, sweep * 0.42, dihedral * 0.45, mat_idx),
        (0.92, tip_chord * 1.08, thick_tip * 1.05, sweep * 0.92, dihedral * 0.92, mat_idx),
        (1.00, tip_chord, thick_tip, sweep, dihedral, tip_mat_idx if tip_mat_idx is not None else mat_idx),
    ]
    if winglet_height > 0.01:
        stations.append((
            1.04,
            tip_chord * 0.62,
            thick_tip * 0.75,
            sweep + tip_chord * 0.38,
            dihedral + winglet_height,
            tip_mat_idx if tip_mat_idx is not None else mat_idx,
        ))

    rings = []
    for s_frac, chord, thick, y_sweep, z_dih, _ in stations:
        ring = []
        x_pos = (root_pos[0] + s_frac * span) * side
        y_center = root_pos[1] - y_sweep
        z_center = root_pos[2] + z_dih
        for u, zf in profile:
            vy = y_center + u * chord
            vz = z_center + zf * thick
            ring.append(bm.verts.new((x_pos, vy, vz)))
        rings.append(ring)

    for idx in range(len(rings) - 1):
        r0 = rings[idx]
        r1 = rings[idx + 1]
        m_use = stations[idx + 1][5]
        for i in range(n_prof):
            ni = (i + 1) % n_prof
            if side > 0:
                f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            else:
                f = bm.faces.new((r0[ni], r0[i], r1[i], r1[ni]))
            f.smooth = True
            f.material_index = m_use

    # Cap root and tip
    f_root = bm.faces.new(rings[0][::-1] if side > 0 else rings[0])
    f_root.smooth = False
    f_root.material_index = mat_idx

    f_tip = bm.faces.new(rings[-1] if side > 0 else rings[-1][::-1])
    f_tip.smooth = True
    f_tip.material_index = tip_mat_idx if tip_mat_idx is not None else mat_idx


def add_vertical_tail(
    bm,
    base_pos=(0.0, -5.0, 0.8),
    height=3.2,
    root_chord=2.8,
    tip_chord=1.2,
    sweep=1.8,
    thick_root=0.26,
    thick_tip=0.12,
    mat_idx=0,
    accent_mat_idx=None,
):
    """Build a swept vertical stabilizer fin with optional livery accent band."""
    profile = [
        (0.00, 0.50),    # Leading edge
        (0.45, 0.36),    # Right LE shoulder
        (0.52, 0.08),    # Right max camber
        (0.08, -0.50),   # Trailing edge right
        (-0.08, -0.50),  # Trailing edge left
        (-0.52, 0.08),   # Left max camber
        (-0.45, 0.36),   # Left LE shoulder
    ]
    n_prof = len(profile)
    stations = [
        (0.00, root_chord, thick_root, 0.0, mat_idx),
        (0.55, root_chord * 0.58 + tip_chord * 0.42, thick_root * 0.6 + thick_tip * 0.4, sweep * 0.55, accent_mat_idx if accent_mat_idx is not None else mat_idx),
        (1.00, tip_chord, thick_tip, sweep, accent_mat_idx if accent_mat_idx is not None else mat_idx),
    ]
    rings = []
    for h_frac, chord, thick, y_sw, _ in stations:
        ring = []
        vz = base_pos[2] + h_frac * height
        yc = base_pos[1] - y_sw
        for xf, yf in profile:
            vx = base_pos[0] + xf * thick
            vy = yc + yf * chord
            ring.append(bm.verts.new((vx, vy, vz)))
        rings.append(ring)

    for idx in range(len(rings) - 1):
        r0 = rings[idx]
        r1 = rings[idx + 1]
        m_use = stations[idx + 1][4]
        for i in range(n_prof):
            ni = (i + 1) % n_prof
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True
            f.material_index = m_use

    f_base = bm.faces.new(rings[0][::-1])
    f_base.material_index = mat_idx
    f_tip = bm.faces.new(rings[-1])
    f_tip.material_index = accent_mat_idx if accent_mat_idx is not None else mat_idx


def apply_box_uvs(bm, scale=0.25):
    """Assign clean non-overlapping box-projected UVs to all loops in bm."""
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x * scale, co.y * scale
            elif ax >= ay and ax >= az:
                u, v = co.y * scale, co.z * scale
            else:
                u, v = co.x * scale, co.z * scale
            loop[uv_layer].uv = (u % 1.0 if scale == 0 else u, v % 1.0 if scale == 0 else v)


def finalize_mesh_object(
    name,
    bm,
    materials,
    parent=None,
    location=(0.0, 0.0, 0.0),
    rotation=(0.0, 0.0, 0.0),
    uv_scale=0.2,
    auto_sharp_angle_deg=38.0,
):
    """
    Finalize a bmesh into a Blender Mesh Object:
    - Remove tiny duplicate vertices
    - Recalculate all face normals outward (critical for backface culling!)
    - Generate box UVs
    - Apply smooth shading with sharp edge tags on angles > auto_sharp_angle_deg
    - Assign materials and parent transform
    """
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    apply_box_uvs(bm, scale=uv_scale)

    sharp_rad = math.radians(auto_sharp_angle_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            ang = e.calc_face_angle(0.0)
            if ang > sharp_rad:
                e.smooth = False
            else:
                e.smooth = True

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    for mat in materials:
        mesh.materials.append(mat)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = Vector(location)
    obj.rotation_euler = Euler(rotation, 'XYZ')
    if parent is not None:
        obj.parent = parent
    return obj


def create_root_node(name, location=(0.0, 0.0, 0.0), parent=None):
    """Create a named Empty root node for an asset variant or sub-assembly."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = 'PLAIN_AXES'
    empty.empty_display_size = 0.5
    bpy.context.collection.objects.link(empty)
    empty.location = Vector(location)
    if parent is not None:
        empty.parent = parent
    return empty


def create_wheel_node(
    name,
    parent,
    location,
    radius=0.42,
    width=0.26,
    mat_tire=None,
    mat_rim=None,
    mat_hub=None,
    num_bolts=6,
):
    """
    Create a separate named wheel object with its local origin (pivot) at (0,0,0)
    (the axle center) so rotating around X spins the wheel in place.
    Includes beveled rubber tire, recessed metallic rim, center hub cap, and lug bolts.
    """
    bm = bmesh.new()
    # Tire outer drum along X axis
    add_cylinder_part(
        bm, radius1=radius, radius2=radius, depth=width,
        segments=24, center=(0.0, 0.0, 0.0), axis='X',
        bevel_width=width * 0.16, bevel_segments=2, mat_idx=0
    )
    # Recessed rim discs on both sides
    rim_r = radius * 0.62
    for side in (-1, 1):
        add_cylinder_part(
            bm, radius1=rim_r, radius2=rim_r * 0.92, depth=width * 0.18,
            segments=20, center=(side * width * 0.45, 0.0, 0.0), axis='X',
            bevel_width=0.015, bevel_segments=1, mat_idx=1
        )
        # Hub cap center
        add_cylinder_part(
            bm, radius1=rim_r * 0.34, radius2=rim_r * 0.28, depth=width * 0.14,
            segments=14, center=(side * width * 0.53, 0.0, 0.0), axis='X',
            bevel_width=0.01, bevel_segments=1, mat_idx=2
        )
        # Lug bolts around hub
        bolt_ring_r = rim_r * 0.58
        for b in range(num_bolts):
            ang = (2.0 * math.pi * b) / num_bolts
            by = math.cos(ang) * bolt_ring_r
            bz = math.sin(ang) * bolt_ring_r
            add_cylinder_part(
                bm, radius1=radius * 0.055, radius2=radius * 0.055, depth=width * 0.08,
                segments=8, center=(side * width * 0.53, by, bz), axis='X',
                bevel_width=0.005, bevel_segments=1, mat_idx=2
            )

    mats = [mat_tire, mat_rim, mat_hub or mat_rim]
    return finalize_mesh_object(name, bm, mats, parent=parent, location=location, uv_scale=1.0)


def export_family_glb(output_path):
    """Export the current Blender scene to a compact, standards-compliant GLB."""
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_animations=True,
        export_nla_strips=True,
    )
    size_kb = os.path.getsize(output_path) / 1024.0
    print(f"[EXPORTED] {output_path} ({size_kb:.1f} KB)")
