import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(PROJECT_ROOT, "app/public/assets")
PREVIEWS_DIR = os.path.join(PROJECT_ROOT, "blender/previews")
TEX_DIR = os.path.join(PROJECT_ROOT, "blender/tex_cache")


def ensure_dirs():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    os.makedirs(PREVIEWS_DIR, exist_ok=True)
    os.makedirs(TEX_DIR, exist_ok=True)


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
    ensure_dirs()


def _create_procedural_png_textures():
    """Generate small procedural PNG textures for wafer dies, console screens, and cleanroom panels."""
    ensure_dirs()
    textures = {}

    # 1. Wafer Die Grid Texture (128x128)
    wafer_path = os.path.join(TEX_DIR, "tex_wafer_die.png")
    if not os.path.exists(wafer_path):
        img = bpy.data.images.new("tex_wafer_die", width=128, height=128, alpha=False)
        pixels = [0.0] * (128 * 128 * 4)
        for y in range(128):
            for x in range(128):
                idx = (y * 128 + x) * 4
                # Scribe lines every 16 px
                gx = x % 16
                gy = y % 16
                if gx == 0 or gy == 0:
                    # Bright copper/gold scribe line
                    r, g, b = 0.85, 0.62, 0.22
                elif gx in (1, 15) or gy in (1, 15):
                    r, g, b = 0.18, 0.22, 0.45
                else:
                    # Sub-blocks inside die (SRAM / logic blocks)
                    sub = ((x // 4) + (y // 4)) % 3
                    if sub == 0:
                        r, g, b = 0.22, 0.36, 0.78
                    elif sub == 1:
                        r, g, b = 0.72, 0.48, 0.18
                    else:
                        r, g, b = 0.16, 0.58, 0.68
                pixels[idx] = r
                pixels[idx + 1] = g
                pixels[idx + 2] = b
                pixels[idx + 3] = 1.0
        img.pixels = pixels
        img.filepath_raw = wafer_path
        img.file_format = 'PNG'
        img.save()
    textures['wafer'] = bpy.data.images.load(wafer_path, check_existing=True)

    # 2. Operator Console Screen Texture (128x128)
    ui_path = os.path.join(TEX_DIR, "tex_console_ui.png")
    if not os.path.exists(ui_path):
        img = bpy.data.images.new("tex_console_ui", width=128, height=128, alpha=False)
        pixels = [0.0] * (128 * 128 * 4)
        for y in range(128):
            for x in range(128):
                idx = (y * 128 + x) * 4
                # Dark slate background
                r, g, b = 0.06, 0.10, 0.18
                # Top header bar in brand blue
                if y > 108:
                    r, g, b = 0.15, 0.39, 0.92
                # Circular wafer map on left (center 42, 60, radius 28)
                dx = x - 42
                dy = y - 58
                dist = math.sqrt(dx * dx + dy * dy)
                if dist < 28:
                    if int(dx) % 5 == 0 or int(dy) % 5 == 0:
                        r, g, b = 0.08, 0.22, 0.35
                    elif (dx * dy) % 11 == 0:
                        r, g, b = 0.95, 0.62, 0.12  # warning die
                    else:
                        r, g, b = 0.12, 0.80, 0.55  # good yield green die
                # Right side telemetry bars
                if 80 <= x <= 118 and 20 <= y <= 96:
                    row = (y - 20) // 14
                    rem = (y - 20) % 14
                    if 3 <= rem <= 9:
                        bar_len = 22 + (row * 7) % 16
                        if x - 80 < bar_len:
                            r, g, b = (0.18, 0.65, 0.95) if row != 2 else (0.12, 0.82, 0.52)
                        else:
                            r, g, b = 0.12, 0.18, 0.28
                pixels[idx] = r
                pixels[idx + 1] = g
                pixels[idx + 2] = b
                pixels[idx + 3] = 1.0
        img.pixels = pixels
        img.filepath_raw = ui_path
        img.file_format = 'PNG'
        img.save()
    textures['ui'] = bpy.data.images.load(ui_path, check_existing=True)

    return textures


def make_pbr_mat(name, base_color, roughness=0.3, metallic=0.0,
                 emit_color=None, emit_strength=0.0, tex_image=None):
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

    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if tex_image is not None:
        tex_node = nodes.new(type="ShaderNodeTexImage")
        tex_node.image = tex_image
        links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        if emit_strength > 0.0 and "Emission Color" in bsdf.inputs:
            links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emit_strength

    if emit_color is not None and emit_strength > 0.0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emit_color, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emit_strength
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emit_color, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emit_strength

    return mat


def get_palette():
    texs = _create_procedural_png_textures()
    pal = {
        # Core cleanroom & architectural palette (light cool palette + strong cobalt brand blue)
        "white": make_pbr_mat("Mat_Body_White", (0.95, 0.97, 0.99), roughness=0.26, metallic=0.04),
        "cool_grey": make_pbr_mat("Mat_Body_CoolGrey", (0.83, 0.87, 0.92), roughness=0.34, metallic=0.10),
        "mid_grey": make_pbr_mat("Mat_Panel_MidGrey", (0.60, 0.66, 0.74), roughness=0.40, metallic=0.20),
        "dark_slate": make_pbr_mat("Mat_Chassis_Dark", (0.14, 0.18, 0.25), roughness=0.45, metallic=0.35),
        "rubber_black": make_pbr_mat("Mat_Rubber_Black", (0.07, 0.08, 0.10), roughness=0.68, metallic=0.05),

        # Strong brand colour (Cobalt / Ultramarine Blue from reference)
        "brand_blue": make_pbr_mat("Mat_Brand_Blue", (0.14, 0.38, 0.92), roughness=0.24, metallic=0.15),
        "brand_blue_dark": make_pbr_mat("Mat_Brand_Blue_Dark", (0.09, 0.23, 0.60), roughness=0.30, metallic=0.25),
        "ice_blue": make_pbr_mat("Mat_Ice_Blue", (0.72, 0.86, 0.98), roughness=0.22, metallic=0.08),

        # Metals & Semiconductor materials
        "steel": make_pbr_mat("Mat_Steel_Brushed", (0.78, 0.82, 0.88), roughness=0.22, metallic=0.88),
        "chrome": make_pbr_mat("Mat_Steel_Chrome", (0.90, 0.93, 0.97), roughness=0.12, metallic=0.95),
        "copper": make_pbr_mat("Mat_Copper_Gold", (0.86, 0.52, 0.16), roughness=0.20, metallic=0.90),
        "gold": make_pbr_mat("Mat_Gold_Optics", (0.94, 0.74, 0.22), roughness=0.16, metallic=0.92),
        "wafer": make_pbr_mat("Mat_Silicon_Wafer", (0.25, 0.35, 0.75), roughness=0.10, metallic=0.85,
                              tex_image=texs['wafer']),
        "console_ui": make_pbr_mat("Mat_Console_UI", (0.10, 0.20, 0.35), roughness=0.15, metallic=0.05,
                                   emit_color=(1.0, 1.0, 1.0), emit_strength=1.4, tex_image=texs['ui']),

        # Windows & Safety Glass (opaque/reflective dark glass so back-face culling is 100% solid)
        "glass_dark": make_pbr_mat("Mat_Glass_Dark", (0.08, 0.16, 0.28), roughness=0.08, metallic=0.25,
                                   emit_color=(0.05, 0.14, 0.26), emit_strength=0.35),
        "glass_amber": make_pbr_mat("Mat_Glass_Amber", (0.92, 0.58, 0.08), roughness=0.10, metallic=0.15,
                                    emit_color=(0.95, 0.55, 0.05), emit_strength=0.85),
        "litho_floor": make_pbr_mat("Mat_Litho_Floor", (0.96, 0.86, 0.52), roughness=0.28, metallic=0.06),

        # Industrial / Safety Accents
        "safety_yellow": make_pbr_mat("Mat_Safety_Yellow", (0.96, 0.74, 0.10), roughness=0.30, metallic=0.08),
        "hot_lot_orange": make_pbr_mat("Mat_HotLot_Orange", (0.95, 0.34, 0.12), roughness=0.25, metallic=0.12,
                                       emit_color=(0.95, 0.30, 0.08), emit_strength=0.6),
        "foliage_green": make_pbr_mat("Mat_Foliage_Green", (0.24, 0.64, 0.42), roughness=0.55, metallic=0.0),
        "trunk_brown": make_pbr_mat("Mat_Trunk_Brown", (0.38, 0.28, 0.20), roughness=0.70, metallic=0.0),
        "skin_tone": make_pbr_mat("Mat_Skin_Tone", (0.90, 0.73, 0.62), roughness=0.45, metallic=0.0),

        # Emissives (glowing lights, plasma, status towers, UPW baths)
        "emit_green": make_pbr_mat("Mat_Emit_Green", (0.10, 0.90, 0.50), roughness=0.15,
                                   emit_color=(0.10, 0.95, 0.52), emit_strength=3.5),
        "emit_amber": make_pbr_mat("Mat_Emit_Amber", (0.98, 0.68, 0.10), roughness=0.15,
                                   emit_color=(1.0, 0.68, 0.08), emit_strength=3.2),
        "emit_red": make_pbr_mat("Mat_Emit_Red", (0.95, 0.20, 0.20), roughness=0.15,
                                 emit_color=(0.98, 0.18, 0.18), emit_strength=3.5),
        "emit_cyan": make_pbr_mat("Mat_Emit_Cyan", (0.08, 0.82, 0.96), roughness=0.12,
                                  emit_color=(0.06, 0.85, 1.0), emit_strength=3.2),
        "emit_purple": make_pbr_mat("Mat_Emit_Purple", (0.72, 0.28, 0.98), roughness=0.12,
                                    emit_color=(0.75, 0.25, 1.0), emit_strength=3.4),
        "emit_orange": make_pbr_mat("Mat_Emit_Orange", (1.0, 0.45, 0.08), roughness=0.15,
                                    emit_color=(1.0, 0.42, 0.05), emit_strength=3.8),
    }
    return pal


def _finalize_bmesh_to_obj(bm, name, mat, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, bevel_width=0.0, bevel_segs=2):
    if bevel_width > 0.0:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.verts) + list(bm.edges),
            offset=bevel_width,
            offset_type='OFFSET',
            segments=bevel_segs,
            profile=0.5,
            affect='EDGES',
            clamp_overlap=True,
        )
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # Create simple planar/box UV projection right in bmesh so every mesh always has clean UVs
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x * 0.5 + 0.5, co.y * 0.5 + 0.5
            elif ax >= ay:
                u, v = co.y * 0.5 + 0.5, co.z * 0.5 + 0.5
            else:
                u, v = co.x * 0.5 + 0.5, co.z * 0.5 + 0.5
            loop[uv_layer].uv = (u, v)

    # Smooth faces with angle > 35 deg sharp edges
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            angle = edge.calc_face_angle(0.0)
            edge.smooth = (angle < math.radians(38.0))
        else:
            edge.smooth = False
    for face in bm.faces:
        face.smooth = True

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, 'XYZ')
    if mat is not None:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def make_empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.2
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, 'XYZ')
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def add_box(name, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), mat=None,
            bevel=0.02, segs=2, parent=None, bottom_origin=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
        if bottom_origin:
            v.co.z += sz * 0.5
    return _finalize_bmesh_to_obj(bm, name, mat, loc, rot, parent, bevel_width=bevel, bevel_segs=segs)


def add_cylinder(name, radius=0.5, depth=1.0, vertices=24, loc=(0, 0, 0), rot=(0, 0, 0),
                 mat=None, bevel=0.012, segs=2, parent=None, bottom_origin=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices,
                          radius1=radius, radius2=radius, depth=depth)
    if bottom_origin:
        for v in bm.verts:
            v.co.z += depth * 0.5
    return _finalize_bmesh_to_obj(bm, name, mat, loc, rot, parent, bevel_width=bevel, bevel_segs=segs)


def add_cone(name, radius1=0.5, radius2=0.25, depth=1.0, vertices=24, loc=(0, 0, 0), rot=(0, 0, 0),
             mat=None, bevel=0.01, segs=2, parent=None, bottom_origin=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices,
                          radius1=radius1, radius2=radius2, depth=depth)
    if bottom_origin:
        for v in bm.verts:
            v.co.z += depth * 0.5
    return _finalize_bmesh_to_obj(bm, name, mat, loc, rot, parent, bevel_width=bevel, bevel_segs=segs)


def add_sphere(name, radius=0.5, segments=20, ring_count=12, loc=(0, 0, 0), rot=(0, 0, 0),
               mat=None, parent=None, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=ring_count, radius=radius)
    sx, sy, sz = scale
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    return _finalize_bmesh_to_obj(bm, name, mat, loc, rot, parent, bevel_width=0.0)


def add_octagonal_prism(name, radius=1.0, depth=1.0, loc=(0, 0, 0), rot=(0, 0, 0),
                        mat=None, bevel=0.02, parent=None, bottom_origin=False, sides=8):
    return add_cylinder(name, radius=radius, depth=depth, vertices=sides, loc=loc, rot=rot,
                        mat=mat, bevel=bevel, segs=2, parent=parent, bottom_origin=bottom_origin)


def add_hollow_frame(name, outer_size=(1.0, 1.0, 0.1), thickness=0.08, loc=(0, 0, 0),
                     rot=(0, 0, 0), mat=None, parent=None):
    """Build a 4-bar rectangular window/door frame with clean beveled bars."""
    frame_grp = make_empty(name, loc=loc, rot=rot, parent=parent)
    ox, oy, oz = outer_size
    t = thickness
    # Top and bottom bars (along X)
    add_box(f"{name}_Top", (ox, oy, t), (0, 0, (oz - t) * 0.5), mat=mat, bevel=0.008, parent=frame_grp)
    add_box(f"{name}_Bot", (ox, oy, t), (0, 0, -(oz - t) * 0.5), mat=mat, bevel=0.008, parent=frame_grp)
    # Left and right bars (along Z)
    inner_z = max(0.02, oz - 2 * t)
    add_box(f"{name}_L", (t, oy, inner_z), (-(ox - t) * 0.5, 0, 0), mat=mat, bevel=0.008, parent=frame_grp)
    add_box(f"{name}_R", (t, oy, inner_z), ((ox - t) * 0.5, 0, 0), mat=mat, bevel=0.008, parent=frame_grp)
    return frame_grp


def add_vent_grille(name, width=0.5, height=0.3, slats=5, loc=(0, 0, 0), rot=(0, 0, 0),
                    frame_mat=None, slat_mat=None, parent=None):
    """Create a realistic recessed louver vent grille with outer bezel and angled slats."""
    pal = get_palette()
    if frame_mat is None:
        frame_mat = pal["cool_grey"]
    if slat_mat is None:
        slat_mat = pal["dark_slate"]
    grp = make_empty(name, loc=loc, rot=rot, parent=parent)
    add_box(f"{name}_Backing", (width, 0.02, height), (0, 0, 0), mat=slat_mat, bevel=0.004, parent=grp)
    for i in range(slats):
        z = -height * 0.38 + (height * 0.76) * (i / max(1, slats - 1))
        add_box(f"{name}_Slat_{i}", (width * 0.88, 0.032, height / (slats * 1.8)),
                (0, 0.012, z), rot=(math.radians(20), 0, 0), mat=frame_mat, bevel=0.003, parent=grp)
    return grp


def add_bolt_row(name, start_pos, end_pos, count=4, radius=0.016, depth=0.018,
                 mat=None, parent=None, axis='Y'):
    """Add a row of hexagonal bolt heads for industrial detail."""
    pal = get_palette()
    if mat is None:
        mat = pal["steel"]
    s = Vector(start_pos)
    e = Vector(end_pos)
    rot = (math.radians(90), 0, 0) if axis == 'Y' else ((0, math.radians(90), 0) if axis == 'X' else (0, 0, 0))
    for i in range(count):
        t = i / max(1, count - 1) if count > 1 else 0.5
        p = s.lerp(e, t)
        add_cylinder(f"{name}_Bolt_{i}", radius=radius, depth=depth, vertices=6,
                     loc=p, rot=rot, mat=mat, bevel=0.003, segs=1, parent=parent)


def build_signal_tower(name, loc=(0, 0, 0), parent=None, state="RUN"):
    """Build a 4-lamp SECS/GEM semiconductor equipment status signal tower."""
    pal = get_palette()
    tower = make_empty(name, loc=loc, parent=parent)
    # Chrome mounting base + pole
    add_cylinder(f"{name}_Base", radius=0.055, depth=0.04, vertices=16,
                 loc=(0, 0, 0.02), mat=pal["dark_slate"], bevel=0.005, parent=tower)
    add_cylinder(f"{name}_Pole", radius=0.022, depth=0.22, vertices=12,
                 loc=(0, 0, 0.14), mat=pal["chrome"], bevel=0.002, parent=tower)
    # 4 lamp tiers: Blue (OHT/Auto), Green (Run), Amber (Idle), Red (Alarm)
    mats = [
        pal["emit_cyan"],
        pal["emit_green"] if state == "RUN" else pal["cool_grey"],
        pal["emit_amber"] if state in ("IDLE", "LITHO") else pal["cool_grey"],
        pal["emit_red"] if state == "DOWN" else pal["cool_grey"],
    ]
    z0 = 0.27
    for idx, m in enumerate(mats):
        z = z0 + idx * 0.075
        add_cylinder(f"{name}_Tier_{idx}", radius=0.042, depth=0.062, vertices=16,
                     loc=(0, 0, z), mat=m, bevel=0.004, parent=tower)
        add_cylinder(f"{name}_Ring_{idx}", radius=0.044, depth=0.012, vertices=16,
                     loc=(0, 0, z - 0.032), mat=pal["dark_slate"], bevel=0.002, parent=tower)
    # Top cap
    add_cylinder(f"{name}_Cap", radius=0.045, depth=0.025, vertices=16,
                 loc=(0, 0, z0 + 4 * 0.075 - 0.02), mat=pal["dark_slate"], bevel=0.005, parent=tower)
    return tower


def build_operator_console(name, loc=(0, 0, 0), rot_z=0.0, parent=None):
    """Build an articulated swing-arm operator monitor + keyboard + E-stop station."""
    pal = get_palette()
    root = make_empty(name, loc=loc, rot=(0, 0, rot_z), parent=parent)
    # Mounting bracket & swing arm
    add_box(f"{name}_Mount", (0.08, 0.14, 0.18), (0, 0, 0), mat=pal["dark_slate"], bevel=0.008, parent=root)
    add_box(f"{name}_Arm", (0.06, 0.24, 0.05), (0, 0.12, 0.02), mat=pal["steel"], bevel=0.006, parent=root)
    # Monitor bezel
    add_box(f"{name}_Bezel", (0.52, 0.05, 0.36), (0, 0.25, 0.14),
            rot=(math.radians(-12), 0, 0), mat=pal["dark_slate"], bevel=0.012, parent=root)
    # Glowing UI Screen
    add_box(f"{name}_Screen", (0.46, 0.015, 0.30), (0, 0.275, 0.14),
            rot=(math.radians(-12), 0, 0), mat=pal["console_ui"], bevel=0.003, parent=root)
    # Keyboard tray + E-stop button
    add_box(f"{name}_KeyTray", (0.48, 0.22, 0.03), (0, 0.32, -0.10),
            rot=(math.radians(8), 0, 0), mat=pal["cool_grey"], bevel=0.006, parent=root)
    add_cylinder(f"{name}_EStop_Collar", radius=0.028, depth=0.02, vertices=12,
                 loc=(0.18, 0.34, -0.075), mat=pal["safety_yellow"], bevel=0.003, parent=root)
    add_cylinder(f"{name}_EStop_Btn", radius=0.020, depth=0.028, vertices=12,
                 loc=(0.18, 0.34, -0.058), mat=pal["emit_red"], bevel=0.005, parent=root)
    return root


def build_foup_pod_mesh(name, loc=(0, 0, 0), rot_z=0.0, parent=None, hot_lot=False, include_door_pivot=True):
    """Build a detailed 300mm FOUP wafer pod with 25 visible wafers inside and articulated front door."""
    pal = get_palette()
    pod = make_empty(name, loc=loc, rot=(0, 0, rot_z), parent=parent)
    body_mat = pal["hot_lot_orange"] if hot_lot else pal["white"]
    trim_mat = pal["safety_yellow"] if hot_lot else pal["brand_blue"]

    # Base plate with 3 kinematic coupling pads
    add_box(f"{name}_Base", (0.42, 0.40, 0.04), (0, 0, 0.02), mat=pal["dark_slate"], bevel=0.008, parent=pod)
    # Curved/beveled shell walls (Left, Right, Back, Top) leaving front recess so wafer stack is visible!
    add_box(f"{name}_Top", (0.42, 0.40, 0.045), (0, 0, 0.415), mat=body_mat, bevel=0.012, parent=pod)
    add_box(f"{name}_Back", (0.42, 0.06, 0.36), (0, -0.17, 0.22), mat=body_mat, bevel=0.012, parent=pod)
    add_box(f"{name}_Wall_L", (0.045, 0.36, 0.36), (-0.187, -0.01, 0.22), mat=body_mat, bevel=0.010, parent=pod)
    add_box(f"{name}_Wall_R", (0.045, 0.36, 0.36), (0.187, -0.01, 0.22), mat=body_mat, bevel=0.010, parent=pod)

    # Side ergonomic robotic/manual handles in brand color
    add_box(f"{name}_Handle_L", (0.035, 0.18, 0.14), (-0.22, 0.0, 0.23), mat=trim_mat, bevel=0.008, parent=pod)
    add_box(f"{name}_Handle_R", (0.035, 0.18, 0.14), (0.22, 0.0, 0.23), mat=trim_mat, bevel=0.008, parent=pod)

    # Top SEMI standard OHT robotic mushroom flange
    add_cylinder(f"{name}_Flange_Neck", radius=0.045, depth=0.04, vertices=16,
                 loc=(0, 0, 0.45), mat=pal["steel"], bevel=0.004, parent=pod)
    add_cylinder(f"{name}_Flange_Cap", radius=0.095, depth=0.024, vertices=20,
                 loc=(0, 0, 0.478), mat=trim_mat, bevel=0.006, parent=pod)

    # Stack of silicon wafers inside (8 representative thick wafer discs so they read clearly at game zoom)
    for w_i in range(7):
        wz = 0.075 + w_i * 0.046
        add_cylinder(f"{name}_Wafer_{w_i}", radius=0.148, depth=0.012, vertices=24,
                     loc=(0, -0.01, wz), mat=pal["wafer"], bevel=0.002, parent=pod)

    # Articulated Front Door (pivot at bottom-front of door so it can slide down/open into EFEM)
    if include_door_pivot:
        door_piv = make_empty(f"{name}_Door", loc=(0, 0.185, 0.04), parent=pod)
        # Windowed front door frame so the glowing wafers inside are visible even when closed!
        add_hollow_frame(f"{name}_DoorFrame", (0.36, 0.028, 0.35), thickness=0.045,
                         loc=(0, 0, 0.175), mat=trim_mat, parent=door_piv)
        add_box(f"{name}_DoorLatch_L", (0.04, 0.034, 0.06), (-0.11, 0.004, 0.175),
                mat=pal["steel"], bevel=0.004, parent=door_piv)
        add_box(f"{name}_DoorLatch_R", (0.04, 0.034, 0.06), (0.11, 0.004, 0.175),
                mat=pal["steel"], bevel=0.004, parent=door_piv)
    return pod


def build_efem_load_port(name, loc=(0, 0, 0), rot_z=0.0, parent=None, with_foup=False, hot_lot=False):
    """Build a 300mm EFEM Load Port (docking pedestal + articulated FOUP opener door + status LEDs)."""
    pal = get_palette()
    lp = make_empty(name, loc=loc, rot=(0, 0, rot_z), parent=parent)
    # Pedestal column (from z=0 to z=0.92m SEMI standard load port height)
    add_box(f"{name}_Pedestal", (0.52, 0.48, 0.90), (0, 0, 0.45), mat=pal["white"], bevel=0.018, parent=lp)
    add_box(f"{name}_BaseKick", (0.54, 0.50, 0.10), (0, 0, 0.05), mat=pal["dark_slate"], bevel=0.010, parent=lp)
    # Kinematic docking stage table
    add_box(f"{name}_StagePlate", (0.48, 0.46, 0.05), (0, 0.02, 0.925), mat=pal["steel"], bevel=0.008, parent=lp)
    # Status bar on front edge (Green/Cyan ready bar)
    led_mat = pal["emit_orange"] if hot_lot else (pal["emit_green"] if with_foup else pal["emit_cyan"])
    add_box(f"{name}_StatusLED", (0.40, 0.03, 0.025), (0, 0.25, 0.86), mat=led_mat, bevel=0.004, parent=lp)
    # Articulated EFEM Opener Door (slides vertically into pedestal to open FOUP)
    opener = make_empty(f"{name}_Door", loc=(0, -0.22, 0.95), parent=lp)
    add_box(f"{name}_OpenerPlate", (0.40, 0.04, 0.42), (0, 0, 0.21), mat=pal["dark_slate"], bevel=0.008, parent=opener)
    add_box(f"{name}_OpenerSuction", (0.28, 0.05, 0.28), (0, 0.01, 0.21), mat=pal["steel"], bevel=0.006, parent=opener)

    if with_foup:
        build_foup_pod_mesh(f"{name}_FOUP", loc=(0, 0.02, 0.95), rot_z=math.pi,
                            parent=lp, hot_lot=hot_lot, include_door_pivot=False)
    return lp


def build_wheel_with_hub(name, radius=0.22, width=0.12, loc=(0, 0, 0), parent=None, rot_z=0.0):
    """Build a separate wheel object whose origin (0,0,0) is at its axle center."""
    pal = get_palette()
    # Build tire + rim + hubcap + 6 lug bolts into a single mesh whose origin is (0,0,0)
    bm = bmesh.new()

    # Outer rubber tire (cylinder along X axis)
    ret_tire = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24,
                                     radius1=radius, radius2=radius, depth=width)
    bmesh.ops.rotate(bm, verts=ret_tire["verts"], cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.radians(90), 3, 'Y'))

    obj_tire = _finalize_bmesh_to_obj(bm, name, pal["rubber_black"], loc=loc,
                                      rot=(0, 0, rot_z), parent=parent, bevel_width=0.015, bevel_segs=2)

    # Rim & hubcap children parented to the wheel so rotating `name` rotates the whole wheel assembly!
    add_cylinder(f"{name}_Rim", radius=radius * 0.64, depth=width * 1.06, vertices=20,
                 loc=(0, 0, 0), rot=(0, math.radians(90), 0), mat=pal["cool_grey"],
                 bevel=0.008, parent=obj_tire)
    add_cylinder(f"{name}_Hub", radius=radius * 0.28, depth=width * 1.16, vertices=16,
                 loc=(0, 0, 0), rot=(0, math.radians(90), 0), mat=pal["brand_blue"],
                 bevel=0.006, parent=obj_tire)
    for i in range(6):
        ang = i * (2 * math.pi / 6.0)
        by = math.cos(ang) * (radius * 0.45)
        bz = math.sin(ang) * (radius * 0.45)
        add_cylinder(f"{name}_Lug_{i}", radius=radius * 0.06, depth=width * 1.12, vertices=6,
                     loc=(0, by, bz), rot=(0, math.radians(90), 0), mat=pal["chrome"],
                     bevel=0.002, parent=obj_tire)
    return obj_tire


def finalize_and_export_glb(out_filename):
    """Recalculate normals on all meshes, orient roots to face -Y, snap Z_min=0, and export GLB."""
    ensure_dirs()
    out_path = os.path.join(ASSETS_DIR, out_filename)

    # Rotate top-level Empty variant roots by 180 deg around Z so their front (+Y) faces -Y camera
    for root in [o for o in bpy.data.objects if o.parent is None and o.type == 'EMPTY']:
        root.rotation_euler = Euler((0.0, 0.0, math.pi), 'XYZ')

    bpy.context.view_layer.update()

    # Ensure every top-level variant root rests cleanly on Z = 0.000m (no floating or sinking)
    for root in [o for o in bpy.data.objects if o.parent is None]:
        desc_meshes = []
        stack = [root]
        while stack:
            curr = stack.pop()
            if curr.type == 'MESH' and curr.data is not None and len(curr.data.vertices) > 0:
                desc_meshes.append(curr)
            stack.extend(list(curr.children))
        if desc_meshes:
            min_z = min(
                (m.matrix_world @ v.co).z
                for m in desc_meshes
                for v in m.data.vertices
            )
            if abs(min_z) > 1e-4:
                root.location.z -= min_z

    bpy.context.view_layer.update()

    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.data is not None:
            s = obj.scale
            if s.x < 0 or s.y < 0 or s.z < 0:
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bmesh.ops.scale(bm, vec=s, verts=bm.verts)
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
                bm.to_mesh(obj.data)
                bm.free()
                obj.scale = (1.0, 1.0, 1.0)
            else:
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
                bm.to_mesh(obj.data)
                bm.free()
            obj.data.update()

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_animations=True,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    print(f"[EXPORTED] {out_filename} ({size_kb:.1f} KB)")
    return out_path

