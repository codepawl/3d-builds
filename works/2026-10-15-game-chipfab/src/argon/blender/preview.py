import bpy
import math
import os
import sys
from mathutils import Vector

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(PROJECT_ROOT, "app/public/assets")
PREVIEWS_DIR = os.path.join(PROJECT_ROOT, "blender/previews")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)


def compute_bounds(objs):
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in objs:
        if obj.type == "MESH" and obj.data and len(obj.data.vertices) > 0:
            found = True
            for corner in obj.bound_box:
                wc = obj.matrix_world @ Vector(corner)
                min_v.x = min(min_v.x, wc.x)
                min_v.y = min(min_v.y, wc.y)
                min_v.z = min(min_v.z, wc.z)
                max_v.x = max(max_v.x, wc.x)
                max_v.y = max(max_v.y, wc.y)
                max_v.z = max(max_v.z, wc.z)
    if not found:
        return Vector((-1, -1, 0)), Vector((1, 1, 2))
    return min_v, max_v


def setup_studio_lighting_and_world():
    scene = bpy.context.scene
    # Render engine
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = eng
            break
        except Exception:
            pass

    # World background (light cool studio background so dark/white/cobalt/emissive all pop)
    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.83, 0.87, 0.92, 1.0)
        bg.inputs[1].default_value = 0.95

    # Key Sun Light
    key_data = bpy.data.lights.new("KeySun", type="SUN")
    key_data.energy = 3.2
    key_data.color = (1.0, 0.98, 0.95)
    key_obj = bpy.data.objects.new("KeySun", key_data)
    key_obj.rotation_euler = (math.radians(48), math.radians(-18), math.radians(32))
    bpy.context.collection.objects.link(key_obj)

    # Fill Sun Light (from opposite rear side so rear views are well-lit)
    fill_data = bpy.data.lights.new("FillSun", type="SUN")
    fill_data.energy = 1.8
    fill_data.color = (0.88, 0.94, 1.0)
    fill_obj = bpy.data.objects.new("FillSun", fill_data)
    fill_obj.rotation_euler = (math.radians(55), math.radians(15), math.radians(-145))
    bpy.context.collection.objects.link(fill_obj)

    # Rim / Top Light
    rim_data = bpy.data.lights.new("RimSun", type="SUN")
    rim_data.energy = 1.2
    rim_data.color = (0.95, 0.97, 1.0)
    rim_obj = bpy.data.objects.new("RimSun", rim_data)
    rim_obj.rotation_euler = (math.radians(15), math.radians(0), math.radians(90))
    bpy.context.collection.objects.link(rim_obj)


def point_camera_at(cam_obj, cam_pos, target_pos, ortho_scale=None, lens=42.0):
    cam_obj.location = Vector(cam_pos)
    direction = Vector(target_pos) - Vector(cam_pos)
    rot_quat = direction.to_track_quat("-Z", "Y")
    cam_obj.rotation_euler = rot_quat.to_euler()
    if ortho_scale is not None:
        cam_obj.data.type = "ORTHO"
        cam_obj.data.ortho_scale = ortho_scale
    else:
        cam_obj.data.type = "PERSP"
        cam_obj.data.lens = lens
    cam_obj.data.clip_start = 0.05
    cam_obj.data.clip_end = 500.0


def stitch_2x2_grid(img_paths, out_path, tile_w, tile_h):
    """Combine 4 tile PNGs into a single 2x2 contact sheet PNG using Blender's image buffer."""
    out_w = tile_w * 2
    out_h = tile_h * 2
    sheet = bpy.data.images.new("ContactSheet", width=out_w, height=out_h, alpha=True)
    sheet_pixels = [0.12, 0.15, 0.20, 1.0] * (out_w * out_h)

    # Blender images are bottom-to-top:
    # Top-left: (0, tile_h), Top-right: (tile_w, tile_h)
    # Bottom-left: (0, 0), Bottom-right: (tile_w, 0)
    offsets = [
        (0, tile_h),
        (tile_w, tile_h),
        (0, 0),
        (tile_w, 0),
    ]

    for idx, p in enumerate(img_paths):
        if not os.path.exists(p):
            continue
        tile_img = bpy.data.images.load(p)
        tpix = list(tile_img.pixels)
        ox, oy = offsets[idx]
        for row in range(tile_h):
            src_start = row * tile_w * 4
            src_end = src_start + tile_w * 4
            dst_row = oy + row
            dst_start = (dst_row * out_w + ox) * 4
            dst_end = dst_start + tile_w * 4
            sheet_pixels[dst_start:dst_end] = tpix[src_start:src_end]
        bpy.data.images.remove(tile_img, do_unlink=True)

    # Draw 2px divider lines between quadrants
    for x in range(out_w):
        for dy in (-1, 0):
            ry = tile_h + dy
            idx = (ry * out_w + x) * 4
            sheet_pixels[idx:idx+4] = [0.22, 0.32, 0.48, 1.0]
    for y in range(out_h):
        for dx in (-1, 0):
            rx = tile_w + dx
            idx = (y * out_w + rx) * 4
            sheet_pixels[idx:idx+4] = [0.22, 0.32, 0.48, 1.0]

    sheet.pixels = sheet_pixels
    sheet.filepath_raw = out_path
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet, do_unlink=True)


def render_glb_contact_sheet(glb_filename, tile_w=800, tile_h=480):
    os.makedirs(PREVIEWS_DIR, exist_ok=True)
    glb_path = os.path.join(ASSETS_DIR, glb_filename)
    base_name = os.path.splitext(glb_filename)[0]
    out_sheet_path = os.path.join(PREVIEWS_DIR, f"{base_name}.png")

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=glb_path)
    bpy.context.view_layer.update()

    # Enforce backface culling on all materials
    for mat in bpy.data.materials:
        mat.use_backface_culling = True

    mesh_objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.name.startswith("Icosphere")]
    min_v, max_v = compute_bounds(mesh_objs)
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    span_xy = max(size.x, size.y, 1.0)
    span_max = max(size.x, size.y, size.z, 1.0)

    # Print diagnostic summary for verification
    top_nodes = [o for o in bpy.data.objects if o.parent is None and not o.name.startswith("Icosphere")]
    print(f"\n--- VERIFYING {glb_filename} ---")
    print(f"  Total Meshes: {len(mesh_objs)} | Bounds: ({size.x:.2f}m x {size.y:.2f}m x {size.z:.2f}m) | Z_min={min_v.z:.3f}m")
    for tn in top_nodes:
        desc = [c for c in bpy.data.objects if c == tn or c.parent == tn or (c.parent and c.parent.parent == tn)]
        bmin, bmax = compute_bounds(desc)
        bsz = bmax - bmin
        print(f"  Variant Root: {tn.name} -> ({bsz.x:.2f}m x {bsz.y:.2f}m x {bsz.z:.2f}m), Z_min={bmin.z:.3f}m")

    setup_studio_lighting_and_world()

    # Subtle ground reference grid plane slightly below min_v.z
    ground_z = min(0.0, min_v.z) - 0.01
    bpy.ops.mesh.primitive_plane_add(size=span_max * 3.0, location=(center.x, center.y, ground_z))
    g_obj = bpy.context.active_object
    g_mat = bpy.data.materials.new("PreviewGround")
    g_mat.use_nodes = True
    g_mat.use_backface_culling = True
    g_bsdf = g_mat.node_tree.nodes.get("Principled BSDF")
    if g_bsdf:
        g_bsdf.inputs["Base Color"].default_value = (0.76, 0.81, 0.88, 1.0)
        g_bsdf.inputs["Roughness"].default_value = 0.85
    g_obj.data.materials.append(g_mat)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene = bpy.context.scene
    scene.camera = cam_obj
    scene.render.resolution_x = tile_w
    scene.render.resolution_y = tile_h
    scene.render.image_settings.file_format = "PNG"

    # Compute 4 camera views:
    # 1. Isometric Front-Left 3/4 Overview (Ortho)
    # 2. Isometric Back-Right 3/4 Overview (Ortho)
    # 3. Low Front Elevation / Ground Contact Check (Ortho)
    # 4. Close-Up 3/4 Perspective on first/center Variant
    ortho_full = max(size.x * 1.06, size.z * (tile_w / float(tile_h)) * 1.35, size.y * 1.25, 2.2)
    dist = span_max * 2.2 + 5.0

    # Find first variant bounds for View 4 close-up
    v_focus_center = center
    v_focus_scale = ortho_full * 0.45
    variant_roots = sorted(
        [
            o for o in bpy.data.objects
            if o.parent is None and o != g_obj and o != cam_obj
            and o.type in ("EMPTY", "ARMATURE", "MESH")
            and not o.name.startswith("Icosphere")
        ],
        key=lambda o: o.location.x,
    )
    if variant_roots:
        v0 = variant_roots[0]
        v0_desc = [c for c in bpy.data.objects if c == v0 or c.parent == v0 or (c.parent and c.parent.parent == v0)]
        vmin, vmax = compute_bounds(v0_desc)
        v_focus_center = (vmin + vmax) * 0.5
        vsz = vmax - vmin
        v_focus_scale = max(vsz.x, vsz.y, vsz.z) * 1.45

    views = [
        (
            "iso_front_left",
            (center.x - dist * 0.55, center.y - dist * 0.85, center.z + dist * 0.62),
            center,
            ortho_full,
        ),
        (
            "iso_back_right",
            (center.x + dist * 0.55, center.y + dist * 0.85, center.z + dist * 0.62),
            center,
            ortho_full,
        ),
        (
            "front_elevation",
            (center.x, center.y - dist * 1.1, center.z + size.z * 0.18),
            Vector((center.x, center.y, center.z)),
            ortho_full * 0.96,
        ),
        (
            "detail_closeup",
            (v_focus_center.x - dist * 0.35, v_focus_center.y - dist * 0.45, v_focus_center.z + dist * 0.38),
            v_focus_center,
            max(v_focus_scale, 1.5),
        ),
    ]

    temp_tiles = []
    for vname, cpos, ctarget, oscale in views:
        tpath = os.path.join(PREVIEWS_DIR, f"_tmp_{base_name}_{vname}.png")
        point_camera_at(cam_obj, cpos, ctarget, ortho_scale=oscale)
        scene.render.filepath = tpath
        bpy.ops.render.render(write_still=True)
        temp_tiles.append(tpath)

    stitch_2x2_grid(temp_tiles, out_sheet_path, tile_w, tile_h)
    for tp in temp_tiles:
        if os.path.exists(tp):
            os.remove(tp)

    print(f"[PREVIEW SAVED] {out_sheet_path}")


def main():
    os.makedirs(PREVIEWS_DIR, exist_ok=True)
    if "--" in sys.argv:
        targets = [a if a.endswith(".glb") else f"{a}.glb" for a in sys.argv[sys.argv.index("--") + 1:]]
    else:
        targets = sorted([f for f in os.listdir(ASSETS_DIR) if f.lower().endswith(".glb")])
    print(f"Rendering contact sheets for {len(targets)} GLB file(s) in {ASSETS_DIR}")
    for gf in targets:
        render_glb_contact_sheet(gf)


if __name__ == "__main__":
    main()

