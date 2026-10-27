import bpy
import bmesh
import math
import os
import struct
import zlib
from mathutils import Vector, Matrix, Euler

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(PROJECT_ROOT, "app/public/assets")
TEX_DIR = os.path.join(PROJECT_ROOT, "blender/tex_cache")


def ensure_dirs():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    os.makedirs(TEX_DIR, exist_ok=True)


def write_png_rgba(filepath, width, height, pixel_fn):
    """Write a minimal valid RGBA8 PNG procedurally without external dependencies."""
    if os.path.exists(filepath):
        return filepath
    raw_rows = []
    for y in range(height):
        row = bytearray([0])  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = pixel_fn(x, y, width, height)
            row.extend((
                max(0, min(255, int(r))),
                max(0, min(255, int(g))),
                max(0, min(255, int(b))),
                max(0, min(255, int(a))),
            ))
        raw_rows.append(bytes(row))
    raw_data = b"".join(raw_rows)

    def make_chunk(chunk_type, data):
        chunk = struct.pack(">I", len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return chunk + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw_data, 9)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", idat)
        + make_chunk(b"IEND", b"")
    )
    with open(filepath, "wb") as f:
        f.write(png_bytes)
    return filepath


def ensure_procedural_textures():
    ensure_dirs()
    textures = {}

    # 1. Silicon Wafer Rainbow Lithography Die Grid Texture
    wafer_path = os.path.join(TEX_DIR, "wafer_die_albedo.png")
    def wafer_px(x, y, w, h):
        gx = x % 16
        gy = y % 16
        if gx == 0 or gy == 0:
            return (215, 165, 75, 255)
        if gx == 8 or gy == 8:
            return (95, 130, 185, 255)
        u = x / float(w)
        v = y / float(h)
        phase = (u * 3.5 + v * 2.8 + ((x // 16) * 0.37 + (y // 16) * 0.53)) * math.pi * 2.0
        r = 55 + 55 * (0.5 + 0.5 * math.sin(phase))
        g = 95 + 75 * (0.5 + 0.5 * math.sin(phase + 2.1))
        b = 155 + 80 * (0.5 + 0.5 * math.sin(phase + 4.2))
        if (gx in (3, 4, 11, 12)) and (gy in (3, 4, 5, 10, 11, 12)):
            r = min(255, r + 28)
            g = min(255, g + 32)
            b = min(255, b + 20)
        return (r, g, b, 255)
    textures["wafer"] = write_png_rgba(wafer_path, 128, 128, wafer_px)

    # 2. Cleanroom Perforated Waffle Tile Texture
    tile_path = os.path.join(TEX_DIR, "cleanroom_tile_albedo.png")
    def tile_px(x, y, w, h):
        tx = x % 32
        ty = y % 32
        if tx == 0 or ty == 0 or tx == 31 or ty == 31:
            return (175, 188, 204, 255)
        if tx == 1 or ty == 1:
            return (248, 251, 255, 255)
        if 4 <= tx <= 27 and 4 <= ty <= 27:
            hx = (tx - 4) % 4
            hy = (ty - 4) % 4
            if hx in (1, 2) and hy in (1, 2):
                return (148, 162, 180, 255)
        return (236, 242, 249, 255)
    textures["tile"] = write_png_rgba(tile_path, 128, 128, tile_px)

    # 3. Cleanroom Panel Metal Micro-Seam Texture
    panel_path = os.path.join(TEX_DIR, "panel_metal_albedo.png")
    def panel_px(x, y, w, h):
        px = x % 64
        py = y % 64
        if px == 0 or py == 0:
            return (206, 216, 228, 255)
        if px == 1 or py == 1:
            return (250, 252, 255, 255)
        grain = int(3.0 * math.sin(x * 0.45) + 2.0 * math.cos(y * 0.25))
        return (240 + grain, 245 + grain, 251 + grain, 255)
    textures["panel"] = write_png_rgba(panel_path, 128, 128, panel_px)

    # 4. Operator Console Telemetry Screen Texture
    screen_path = os.path.join(TEX_DIR, "console_screen_emissive.png")
    def screen_px(x, y, w, h):
        if x < 4 or x >= w - 4 or y < 4 or y >= h - 4:
            return (15, 25, 42, 255)
        dx = x - 38
        dy = y - 64
        dist = math.hypot(dx, dy)
        if dist < 26:
            if int(dx) % 5 == 0 or int(dy) % 5 == 0:
                return (20, 45, 70, 255)
            if (dx * dx + dy * dy) % 17 < 2:
                return (245, 158, 11, 255)
            return (16, 185, 129, 255)
        if 74 <= x <= 118:
            row = (y - 14) // 18
            ry = (y - 14) % 18
            if 0 <= row < 5 and 3 <= ry <= 11:
                bar_len = [38, 32, 41, 27, 35][row]
                if x - 74 < bar_len:
                    return (29, 92, 255, 255) if row % 2 == 0 else (6, 182, 212, 255)
                return (30, 45, 68, 255)
        return (18, 30, 48, 255)
    textures["screen"] = write_png_rgba(screen_path, 128, 128, screen_px)

    return textures


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm, do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)


def set_bsdf_input(bsdf, name_candidates, value):
    for name in name_candidates:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
            return True
    return False


def make_pbr_material(
    name,
    base_color=(0.9, 0.93, 0.96, 1.0),
    metallic=0.1,
    roughness=0.3,
    emission_color=None,
    emission_strength=0.0,
    alpha=1.0,
    transmission=0.0,
    image_path=None,
):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    if len(base_color) == 3:
        base_color = (base_color[0], base_color[1], base_color[2], 1.0)

    set_bsdf_input(bsdf, ["Base Color"], base_color)
    set_bsdf_input(bsdf, ["Metallic"], metallic)
    set_bsdf_input(bsdf, ["Roughness"], roughness)

    if alpha < 1.0:
        set_bsdf_input(bsdf, ["Alpha"], alpha)
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "surface_render_method"):
            try:
                mat.surface_render_method = "BLENDED"
            except Exception:
                pass

    if transmission > 0.0:
        set_bsdf_input(bsdf, ["Transmission Weight", "Transmission"], transmission)

    if image_path and os.path.exists(image_path):
        tex_node = nodes.new(type="ShaderNodeTexImage")
        img = bpy.data.images.load(image_path, check_existing=True)
        tex_node.image = img
        links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        if emission_strength > 0.0 and emission_color is None:
            if "Emission Color" in bsdf.inputs:
                links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])

    if emission_color is not None:
        if len(emission_color) == 3:
            emission_color = (emission_color[0], emission_color[1], emission_color[2], 1.0)
        set_bsdf_input(bsdf, ["Emission Color", "Emission"], emission_color)

    if emission_strength > 0.0:
        set_bsdf_input(bsdf, ["Emission Strength"], emission_strength)

    return mat


def get_palette():
    tex = ensure_procedural_textures()
    p = {}
    p["white"] = make_pbr_material("Mat_CleanWhite", (0.94, 0.96, 0.985, 1.0), metallic=0.06, roughness=0.26, image_path=tex["panel"])
    p["light_panel"] = make_pbr_material("Mat_LightPanel", (0.83, 0.87, 0.93, 1.0), metallic=0.14, roughness=0.30)
    p["silver"] = make_pbr_material("Mat_AnodizedSilver", (0.72, 0.77, 0.84, 1.0), metallic=0.82, roughness=0.25)
    p["chrome"] = make_pbr_material("Mat_StainlessChrome", (0.88, 0.91, 0.95, 1.0), metallic=0.94, roughness=0.14)
    p["slate"] = make_pbr_material("Mat_SlateFrame", (0.16, 0.21, 0.29, 1.0), metallic=0.62, roughness=0.38)
    p["dark_steel"] = make_pbr_material("Mat_DarkSteel", (0.11, 0.14, 0.20, 1.0), metallic=0.70, roughness=0.42)
    p["rubber"] = make_pbr_material("Mat_Rubber", (0.08, 0.10, 0.13, 1.0), metallic=0.05, roughness=0.76)

    p["brand_blue"] = make_pbr_material("Mat_BrandCobalt", (0.11, 0.36, 0.98, 1.0), metallic=0.20, roughness=0.24)
    p["brand_blue_dark"] = make_pbr_material("Mat_BrandNavy", (0.06, 0.20, 0.60, 1.0), metallic=0.28, roughness=0.30)

    p["wafer"] = make_pbr_material("Mat_SiliconWafer", (0.35, 0.50, 0.82, 1.0), metallic=0.86, roughness=0.11, image_path=tex["wafer"])
    p["waffle_tile"] = make_pbr_material("Mat_WaffleTile", (0.91, 0.94, 0.97, 1.0), metallic=0.18, roughness=0.32, image_path=tex["tile"])
    p["copper"] = make_pbr_material("Mat_CopperGold", (0.85, 0.52, 0.14, 1.0), metallic=0.88, roughness=0.20)
    p["hot_lot"] = make_pbr_material("Mat_HotLotOrange", (0.98, 0.28, 0.08, 1.0), metallic=0.18, roughness=0.24, emission_color=(0.98, 0.28, 0.08), emission_strength=0.35)
    p["safety_yellow"] = make_pbr_material("Mat_SafetyYellow", (0.96, 0.68, 0.10, 1.0), metallic=0.12, roughness=0.30)
    p["upw_teal"] = make_pbr_material("Mat_UPWTeal", (0.06, 0.62, 0.88, 1.0), metallic=0.22, roughness=0.26)
    p["ceramic_insulator"] = make_pbr_material("Mat_CeramicBushing", (0.52, 0.34, 0.28, 1.0), metallic=0.08, roughness=0.22)

    p["glass_dark"] = make_pbr_material("Mat_ViewportGlass", (0.10, 0.18, 0.28, 1.0), metallic=0.15, roughness=0.08, alpha=0.62, transmission=0.45)
    p["glass_clear"] = make_pbr_material("Mat_ClearGlass", (0.68, 0.82, 0.95, 1.0), metallic=0.10, roughness=0.06, alpha=0.42, transmission=0.60)
    p["glass_yellow_litho"] = make_pbr_material("Mat_YellowBayGlass", (0.98, 0.68, 0.12, 1.0), metallic=0.08, roughness=0.10, alpha=0.55, transmission=0.45, emission_color=(0.98, 0.65, 0.10), emission_strength=0.45)
    p["foup_smoke"] = make_pbr_material("Mat_FOUPSmokePoly", (0.18, 0.22, 0.28, 1.0), metallic=0.12, roughness=0.12, alpha=0.72, transmission=0.35)

    p["emit_green"] = make_pbr_material("Mat_EmitGreen", (0.08, 0.82, 0.45, 1.0), metallic=0.0, roughness=0.2, emission_color=(0.08, 0.92, 0.50), emission_strength=3.5)
    p["emit_amber"] = make_pbr_material("Mat_EmitAmber", (0.98, 0.65, 0.10, 1.0), metallic=0.0, roughness=0.2, emission_color=(1.0, 0.68, 0.12), emission_strength=3.5)
    p["emit_red"] = make_pbr_material("Mat_EmitRed", (0.95, 0.20, 0.20, 1.0), metallic=0.0, roughness=0.2, emission_color=(1.0, 0.22, 0.22), emission_strength=3.5)
    p["emit_blue"] = make_pbr_material("Mat_EmitBlue", (0.18, 0.52, 1.0, 1.0), metallic=0.0, roughness=0.2, emission_color=(0.22, 0.58, 1.0), emission_strength=3.5)
    p["emit_cyan"] = make_pbr_material("Mat_EmitCyan", (0.06, 0.82, 0.96, 1.0), metallic=0.0, roughness=0.18, emission_color=(0.08, 0.88, 1.0), emission_strength=3.2)
    p["emit_white"] = make_pbr_material("Mat_EmitWhite", (0.95, 0.98, 1.0, 1.0), metallic=0.0, roughness=0.15, emission_color=(0.95, 0.98, 1.0), emission_strength=2.4)
    p["console_screen"] = make_pbr_material("Mat_ConsoleScreen", (0.1, 0.2, 0.35, 1.0), metallic=0.05, roughness=0.15, emission_strength=2.0, image_path=tex["screen"])

    p["suit_white"] = make_pbr_material("Mat_BunnySuitWhite", (0.93, 0.95, 0.98, 1.0), metallic=0.04, roughness=0.45)
    p["suit_blue"] = make_pbr_material("Mat_BunnySuitBlue", (0.18, 0.44, 0.92, 1.0), metallic=0.06, roughness=0.42)
    p["suit_amber"] = make_pbr_material("Mat_BunnySuitAmber", (0.95, 0.68, 0.16, 1.0), metallic=0.06, roughness=0.42)
    p["suit_teal"] = make_pbr_material("Mat_BunnySuitTeal", (0.08, 0.64, 0.76, 1.0), metallic=0.06, roughness=0.42)
    p["skin"] = make_pbr_material("Mat_SkinTone", (0.86, 0.68, 0.56, 1.0), metallic=0.02, roughness=0.52)
    p["nitrile_glove"] = make_pbr_material("Mat_NitrileGlove", (0.22, 0.56, 0.96, 1.0), metallic=0.05, roughness=0.35)

    p["asphalt"] = make_pbr_material("Mat_Asphalt", (0.22, 0.25, 0.30, 1.0), metallic=0.04, roughness=0.82)
    p["concrete"] = make_pbr_material("Mat_Concrete", (0.78, 0.82, 0.86, 1.0), metallic=0.05, roughness=0.68)
    p["foliage_1"] = make_pbr_material("Mat_FoliageSage", (0.28, 0.58, 0.42, 1.0), metallic=0.02, roughness=0.62)
    p["foliage_2"] = make_pbr_material("Mat_FoliageEmerald", (0.20, 0.48, 0.35, 1.0), metallic=0.02, roughness=0.65)
    p["trunk"] = make_pbr_material("Mat_TreeTrunk", (0.38, 0.28, 0.22, 1.0), metallic=0.02, roughness=0.78)
    p["solar_panel"] = make_pbr_material("Mat_SolarCell", (0.07, 0.14, 0.30, 1.0), metallic=0.65, roughness=0.16)

    return p


def make_root(name, loc=(0.0, 0.0, 0.0)):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.5
    root.location = Vector(loc)
    bpy.context.collection.objects.link(root)
    return root


def polish_mesh(mesh, angle_deg=38.0):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        face.smooth = True
        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x * 0.5 + 0.5, co.y * 0.5 + 0.5
            elif ax >= ay and ax >= az:
                u, v = co.y * 0.5 + 0.5, co.z * 0.5 + 0.5
            else:
                u, v = co.x * 0.5 + 0.5, co.z * 0.5 + 0.5
            loop[uv_layer].uv = (u, v)

    thresh = math.radians(angle_deg)
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            ang = edge.link_faces[0].normal.angle(edge.link_faces[1].normal, 0.0)
            edge.smooth = ang < thresh
        else:
            edge.smooth = False

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def add_bevel_box(
    name,
    size=(1.0, 1.0, 1.0),
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    bevel_width=0.02,
    segments=2,
    mat=None,
    parent=None,
    pivot_offset=(0.0, 0.0, 0.0),
):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    ox, oy, oz = pivot_offset
    for v in bm.verts:
        v.co.x = v.co.x * sx + ox
        v.co.y = v.co.y * sy + oy
        v.co.z = v.co.z * sz + oz

    if bevel_width > 0.0:
        max_b = min(sx, sy, sz) * 0.32
        bw = min(bevel_width, max_b)
        bmesh.ops.bevel(
            bm,
            geom=list(bm.verts) + list(bm.edges),
            offset=bw,
            segments=segments,
            profile=0.5,
            affect="EDGES",
        )

    bm.to_mesh(mesh)
    bm.free()
    polish_mesh(mesh)

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def add_bevel_cylinder(
    name,
    radius=0.5,
    depth=1.0,
    vertices=24,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    bevel_width=0.015,
    segments=2,
    mat=None,
    parent=None,
    pivot_offset=(0.0, 0.0, 0.0),
):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=vertices,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    ox, oy, oz = pivot_offset
    for v in bm.verts:
        v.co.x += ox
        v.co.y += oy
        v.co.z += oz

    if bevel_width > 0.0:
        cap_edges = [
            e for e in bm.edges
            if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.z - e.link_faces[1].normal.z) > 0.5
        ]
        if cap_edges:
            bw = min(bevel_width, radius * 0.3, depth * 0.3)
            bmesh.ops.bevel(
                bm,
                geom=cap_edges,
                offset=bw,
                segments=segments,
                profile=0.5,
                affect="EDGES",
            )

    bm.to_mesh(mesh)
    bm.free()
    polish_mesh(mesh)

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def merge_objects_into(target_obj, source_objs):
    if not source_objs:
        return target_obj

    bpy.context.view_layer.update()
    target_inv = target_obj.matrix_world.inverted()
    target_mesh = target_obj.data

    mat_map = {m.name: idx for idx, m in enumerate(target_mesh.materials) if m}

    bm = bmesh.new()
    bm.from_mesh(target_mesh)
    bm.loops.layers.uv.verify()

    for src in source_objs:
        if src is None or src.type != "MESH":
            continue
        rel_mat = target_inv @ src.matrix_world
        src_mesh = src.data
        src_bm = bmesh.new()
        src_bm.from_mesh(src_mesh)
        src_bm.transform(rel_mat)

        local_to_target = {}
        for i, m in enumerate(src_mesh.materials):
            if m is None:
                local_to_target[i] = 0
                continue
            if m.name not in mat_map:
                target_mesh.materials.append(m)
                mat_map[m.name] = len(target_mesh.materials) - 1
            local_to_target[i] = mat_map[m.name]

        for f in src_bm.faces:
            f.material_index = local_to_target.get(f.material_index, 0)

        temp_mesh = bpy.data.meshes.new("_temp_merge")
        src_bm.to_mesh(temp_mesh)
        src_bm.free()
        bm.from_mesh(temp_mesh)
        bpy.data.meshes.remove(temp_mesh, do_unlink=True)

        bpy.data.objects.remove(src, do_unlink=True)
        bpy.data.meshes.remove(src_mesh, do_unlink=True)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(target_mesh)
    bm.free()
    polish_mesh(target_mesh)
    return target_obj


def create_wheel(name, loc=(0.0, 0.0, 0.0), radius=0.35, width=0.22, parent=None, pal=None, axis="X"):
    if pal is None:
        pal = get_palette()
    rot = (0.0, math.pi / 2.0, 0.0) if axis == "X" else (math.pi / 2.0, 0.0, 0.0)

    tire = add_bevel_cylinder(
        name,
        radius=radius,
        depth=width,
        vertices=24,
        loc=loc,
        rot=rot,
        bevel_width=min(0.03, width * 0.18),
        mat=pal["rubber"],
        parent=parent,
    )
    parts = []
    rim = add_bevel_cylinder(
        name + "_rim",
        radius=radius * 0.64,
        depth=width * 1.03,
        vertices=20,
        loc=loc,
        rot=rot,
        bevel_width=0.012,
        mat=pal["silver"],
        parent=parent,
    )
    parts.append(rim)
    hub = add_bevel_cylinder(
        name + "_hub",
        radius=radius * 0.26,
        depth=width * 1.12,
        vertices=16,
        loc=loc,
        rot=rot,
        bevel_width=0.01,
        mat=pal["brand_blue"],
        parent=parent,
    )
    parts.append(hub)
    bolt_r = radius * 0.44
    for i in range(6):
        ang = i * (math.pi * 2.0 / 6.0)
        if axis == "X":
            bloc = (loc[0], loc[1] + math.cos(ang) * bolt_r, loc[2] + math.sin(ang) * bolt_r)
        else:
            bloc = (loc[0] + math.cos(ang) * bolt_r, loc[1], loc[2] + math.sin(ang) * bolt_r)
        bolt = add_bevel_cylinder(
            f"{name}_b{i}",
            radius=radius * 0.06,
            depth=width * 1.10,
            vertices=6,
            loc=bloc,
            rot=rot,
            bevel_width=0.004,
            mat=pal["chrome"],
            parent=parent,
        )
        parts.append(bolt)

    merge_objects_into(tire, parts)
    return tire


def create_signal_tower(prefix, loc=(0.0, 0.0, 0.0), parent=None, pal=None, state="running"):
    if pal is None:
        pal = get_palette()
    base = add_bevel_cylinder(
        f"{prefix}_SignalTower",
        radius=0.055,
        depth=0.06,
        vertices=16,
        loc=(loc[0], loc[1], loc[2] + 0.03),
        bevel_width=0.008,
        mat=pal["slate"],
        parent=parent,
    )
    parts = []
    pole = add_bevel_cylinder(
        f"{prefix}_pole",
        radius=0.022,
        depth=0.22,
        vertices=12,
        loc=(loc[0], loc[1], loc[2] + 0.14),
        bevel_width=0.003,
        mat=pal["chrome"],
        parent=parent,
    )
    parts.append(pole)

    colors = [
        ("blue", pal["emit_blue"] if state in ("running", "maint") else pal["brand_blue_dark"]),
        ("green", pal["emit_green"] if state == "running" else pal["light_panel"]),
        ("amber", pal["emit_amber"] if state in ("idle", "yellow") else pal["safety_yellow"]),
        ("red", pal["emit_red"] if state == "down" else pal["slate"]),
    ]
    z_cur = loc[2] + 0.27
    for cname, cmat in colors:
        ring = add_bevel_cylinder(
            f"{prefix}_{cname}",
            radius=0.042,
            depth=0.055,
            vertices=16,
            loc=(loc[0], loc[1], z_cur),
            bevel_width=0.005,
            mat=cmat,
            parent=parent,
        )
        parts.append(ring)
        z_cur += 0.058

    cap = add_bevel_cylinder(
        f"{prefix}_cap",
        radius=0.044,
        depth=0.025,
        vertices=16,
        loc=(loc[0], loc[1], z_cur - 0.015),
        bevel_width=0.006,
        mat=pal["slate"],
        parent=parent,
    )
    parts.append(cap)
    return merge_objects_into(base, parts)


def create_foup_pod(
    name,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    parent=None,
    pal=None,
    variant="standard",
    separate_door=True,
    door_name=None,
):
    if pal is None:
        pal = get_palette()

    shell_mat = pal["white"]
    accent_mat = pal["brand_blue"]
    if variant == "hot":
        shell_mat = pal["hot_lot"]
        accent_mat = pal["safety_yellow"]
    elif variant == "eng":
        shell_mat = pal["brand_blue"]
        accent_mat = pal["emit_cyan"]

    pod = add_bevel_box(
        name,
        size=(0.40, 0.38, 0.32),
        loc=loc,
        rot=rot,
        bevel_width=0.028,
        mat=shell_mat,
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.17),
    )
    parts = []
    base_plate = add_bevel_box(
        f"{name}_base",
        size=(0.42, 0.40, 0.025),
        loc=loc,
        rot=rot,
        bevel_width=0.008,
        mat=pal["slate"],
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.0125),
    )
    parts.append(base_plate)

    visor = add_bevel_box(
        f"{name}_visor",
        size=(0.32, 0.04, 0.24),
        loc=loc,
        rot=rot,
        bevel_width=0.008,
        mat=pal["foup_smoke"],
        parent=parent,
        pivot_offset=(0.0, -0.175, 0.17),
    )
    parts.append(visor)

    for i in range(5):
        wz = 0.07 + i * 0.045
        wdisc = add_bevel_cylinder(
            f"{name}_wafer_{i}",
            radius=0.145,
            depth=0.006,
            vertices=20,
            loc=loc,
            rot=rot,
            bevel_width=0.001,
            mat=pal["wafer"],
            parent=parent,
            pivot_offset=(0.0, -0.02, wz),
        )
        parts.append(wdisc)

    neck = add_bevel_cylinder(
        f"{name}_neck",
        radius=0.035,
        depth=0.04,
        vertices=16,
        loc=loc,
        rot=rot,
        bevel_width=0.004,
        mat=pal["chrome"],
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.345),
    )
    flange = add_bevel_cylinder(
        f"{name}_flange",
        radius=0.075,
        depth=0.018,
        vertices=16,
        loc=loc,
        rot=rot,
        bevel_width=0.005,
        mat=accent_mat,
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.37),
    )
    parts.extend([neck, flange])

    for sx in (-0.21, 0.21):
        handle = add_bevel_box(
            f"{name}_h_{sx}",
            size=(0.03, 0.16, 0.045),
            loc=loc,
            rot=rot,
            bevel_width=0.008,
            mat=accent_mat,
            parent=parent,
            pivot_offset=(sx, 0.0, 0.18),
        )
        parts.append(handle)

    merge_objects_into(pod, parts)

    if separate_door:
        dname = door_name or f"{name}_Door"
        door = add_bevel_box(
            dname,
            size=(0.34, 0.022, 0.26),
            loc=(0.0, -0.195, 0.04),
            bevel_width=0.008,
            mat=pal["silver"],
            parent=pod,
            pivot_offset=(0.0, 0.0, 0.13),
        )
        latch = add_bevel_box(
            f"{dname}_latch",
            size=(0.14, 0.03, 0.05),
            loc=(0.0, -0.195, 0.04),
            bevel_width=0.005,
            mat=accent_mat,
            parent=pod,
            pivot_offset=(0.0, -0.008, 0.13),
        )
        merge_objects_into(door, [latch])

    return pod


def create_load_port(
    prefix,
    loc=(0.0, 0.0, 0.0),
    parent=None,
    pal=None,
    door_name="LoadPortDoor_01",
    foup_variant=None,
):
    if pal is None:
        pal = get_palette()

    ped = add_bevel_box(
        f"{prefix}_Pedestal",
        size=(0.56, 0.52, 0.92),
        loc=(loc[0], loc[1], loc[2] + 0.46),
        bevel_width=0.02,
        mat=pal["light_panel"],
        parent=parent,
    )
    parts = []
    plinth = add_bevel_box(
        f"{prefix}_plinth",
        size=(0.58, 0.54, 0.08),
        loc=(loc[0], loc[1], loc[2] + 0.04),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=parent,
    )
    stage_pad = add_bevel_box(
        f"{prefix}_stage",
        size=(0.46, 0.44, 0.035),
        loc=(loc[0], loc[1] - 0.02, loc[2] + 0.935),
        bevel_width=0.008,
        mat=pal["chrome"],
        parent=parent,
    )
    led_bar = add_bevel_box(
        f"{prefix}_led",
        size=(0.42, 0.02, 0.02),
        loc=(loc[0], loc[1] - 0.26, loc[2] + 0.89),
        bevel_width=0.004,
        mat=pal["emit_green"] if foup_variant else pal["emit_blue"],
        parent=parent,
    )
    parts.extend([plinth, stage_pad, led_bar])
    merge_objects_into(ped, parts)

    door_obj = add_bevel_box(
        door_name,
        size=(0.42, 0.035, 0.40),
        loc=(loc[0], loc[1] + 0.22, loc[2] + 0.92),
        bevel_width=0.01,
        mat=pal["slate"],
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.20),
    )
    d_frame = add_bevel_box(
        f"{door_name}_port",
        size=(0.34, 0.045, 0.32),
        loc=(loc[0], loc[1] + 0.22, loc[2] + 0.92),
        bevel_width=0.008,
        mat=pal["chrome"],
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.20),
    )
    merge_objects_into(door_obj, [d_frame])

    if foup_variant:
        create_foup_pod(
            f"{prefix}_FOUP",
            loc=(loc[0], loc[1] - 0.02, loc[2] + 0.95),
            parent=parent,
            pal=pal,
            variant=foup_variant,
            separate_door=False,
        )

    return ped, door_obj


def add_vent_grille(prefix, center, size=(0.5, 0.03, 0.35), slats=6, axis="Y", parent=None, pal=None):
    if pal is None:
        pal = get_palette()
    frame = add_bevel_box(
        f"{prefix}_Vent",
        size=size,
        loc=center,
        bevel_width=0.006,
        mat=pal["dark_steel"],
        parent=parent,
    )
    parts = []
    sx, sy, sz = size
    for i in range(slats):
        t = (i + 0.5) / float(slats) - 0.5
        z_pos = center[2] + t * (sz * 0.82)
        if axis == "Y":
            slat = add_bevel_box(
                f"{prefix}_s{i}",
                size=(sx * 0.88, sy * 1.15, sz / (slats * 2.2)),
                loc=(center[0], center[1], z_pos),
                rot=(0.35, 0.0, 0.0),
                bevel_width=0.002,
                mat=pal["silver"],
                parent=parent,
            )
        else:
            slat = add_bevel_box(
                f"{prefix}_s{i}",
                size=(sx * 1.15, sy * 0.88, sz / (slats * 2.2)),
                loc=(center[0], center[1], z_pos),
                rot=(0.0, 0.35, 0.0),
                bevel_width=0.002,
                mat=pal["silver"],
                parent=parent,
            )
        parts.append(slat)
    return merge_objects_into(frame, parts)


def add_signage_plate(prefix, loc, size=(0.48, 0.025, 0.14), parent=None, pal=None, accent="blue"):
    if pal is None:
        pal = get_palette()
    mat_main = pal["brand_blue"] if accent == "blue" else (pal["safety_yellow"] if accent == "yellow" else pal["hot_lot"])
    plate = add_bevel_box(
        f"{prefix}_SignPlate",
        size=size,
        loc=loc,
        bevel_width=0.005,
        mat=mat_main,
        parent=parent,
    )
    strip = add_bevel_box(
        f"{prefix}_SignStrip",
        size=(size[0] * 0.82, size[1] * 1.15, size[2] * 0.32),
        loc=(loc[0], loc[1], loc[2] + size[2] * 0.12),
        bevel_width=0.003,
        mat=pal["white"],
        parent=parent,
    )
    return merge_objects_into(plate, [strip])


def add_operator_console(prefix, loc=(0.0, 0.0, 0.0), parent=None, pal=None, arm_name=None):
    if pal is None:
        pal = get_palette()
    post = add_bevel_cylinder(
        arm_name if arm_name else f"{prefix}_ConsoleArm",
        radius=0.025,
        depth=0.45,
        vertices=12,
        loc=loc,
        bevel_width=0.004,
        mat=pal["silver"],
        parent=parent,
        pivot_offset=(0.0, 0.0, 0.22),
    )
    parts = []
    boom = add_bevel_box(
        f"{prefix}_boom",
        size=(0.05, 0.28, 0.04),
        loc=loc,
        bevel_width=0.006,
        mat=pal["silver"],
        parent=parent,
        pivot_offset=(0.0, -0.14, 0.22),
    )
    bezel = add_bevel_box(
        f"{prefix}_bezel",
        size=(0.44, 0.04, 0.30),
        loc=loc,
        rot=(0.22, 0.0, 0.0),
        bevel_width=0.008,
        mat=pal["slate"],
        parent=parent,
        pivot_offset=(0.0, -0.28, 0.32),
    )
    screen = add_bevel_box(
        f"{prefix}_screen",
        size=(0.39, 0.045, 0.25),
        loc=loc,
        rot=(0.22, 0.0, 0.0),
        bevel_width=0.004,
        mat=pal["console_screen"],
        parent=parent,
        pivot_offset=(0.0, -0.282, 0.32),
    )
    kb = add_bevel_box(
        f"{prefix}_kb",
        size=(0.38, 0.16, 0.02),
        loc=loc,
        bevel_width=0.004,
        mat=pal["light_panel"],
        parent=parent,
        pivot_offset=(0.0, -0.34, 0.12),
    )
    parts.extend([boom, bezel, screen, kb])
    return merge_objects_into(post, parts)


def export_glb(filename):
    ensure_dirs()
    out_path = os.path.join(ASSETS_DIR, filename)
    bpy.context.view_layer.update()

    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.data and len(obj.vertex_groups) == 0:
            polish_mesh(obj.data)

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=True,
        export_nla_strips=True,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    print(f"[EXPORTED] {filename} ({size_kb:.1f} KB) -> {out_path}")
    return out_path
