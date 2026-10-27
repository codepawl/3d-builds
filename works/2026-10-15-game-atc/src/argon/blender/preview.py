import os
import sys
import math
import bpy
from mathutils import Vector, Euler


def setup_studio_environment():
    """Configure EEVEE renderer, studio sun lights, and cool light-blue world background."""
    scene = bpy.context.scene

    # Select EEVEE engine in Blender 5.2
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    if 'BLENDER_EEVEE' in engines:
        scene.render.engine = 'BLENDER_EEVEE'
    elif 'BLENDER_EEVEE_NEXT' in engines:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    else:
        scene.render.engine = 'CYCLES'

    if hasattr(scene, "eevee"):
        if hasattr(scene.eevee, "taa_render_samples"):
            scene.eevee.taa_render_samples = 32

    # Cool light-slate sky world background matching warehouse-game reference
    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs[0].default_value = (0.83, 0.88, 0.95, 1.0)
        bg_node.inputs[1].default_value = 1.15

    # Key Sun, Fill Sun, and Back Rim Sun
    lights = [
        ("Sun_Key",  (0.85, -0.75, 1.15), 3.4, (1.0, 0.98, 0.95)),
        ("Sun_Fill", (-0.95, -0.55, 0.75), 1.6, (0.85, 0.92, 1.0)),
        ("Sun_Rim",  (0.15, 1.05, 0.85),   1.8, (0.92, 0.96, 1.0)),
    ]
    for l_name, direction, energy, col in lights:
        ldata = bpy.data.lights.new(name=l_name, type='SUN')
        ldata.energy = energy
        ldata.color = col
        lobj = bpy.data.objects.new(name=l_name, object_data=ldata)
        bpy.context.collection.objects.link(lobj)
        vec = Vector(direction).normalized()
        lobj.rotation_euler = vec.to_track_quat('Z', 'Y').to_euler()


def enforce_backface_culling():
    """Turn on back-face culling on every material in bpy.data.materials."""
    for mat in bpy.data.materials:
        mat.use_backface_culling = True
        if hasattr(mat, "use_backface_culling_shadow"):
            mat.use_backface_culling_shadow = True


def compute_scene_bounds(mesh_objects):
    """Compute world-space bounding box (min_v, max_v) across given mesh objects."""
    min_x = min_y = min_z = 1e9
    max_x = max_y = max_z = -1e9
    found = False
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in mesh_objects:
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            wc = eval_obj.matrix_world @ Vector(corner)
            min_x = min(min_x, wc.x)
            min_y = min(min_y, wc.y)
            min_z = min(min_z, wc.z)
            max_x = max(max_x, wc.x)
            max_y = max(max_y, wc.y)
            max_z = max(max_z, wc.z)
            found = True
    if not found:
        return Vector((-1, -1, 0)), Vector((1, 1, 2))
    return Vector((min_x, min_y, min_z)), Vector((max_x, max_y, max_z))


def point_camera_at(cam_obj, target, azimuth_deg, elevation_deg, distance, ortho_scale=None):
    """Position camera around `target` at spherical coordinates and aim directly at `target`."""
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    cx = target.x + distance * math.cos(el) * math.sin(az)
    cy = target.y - distance * math.cos(el) * math.cos(az)
    cz = target.z + distance * math.sin(el)
    cam_obj.location = Vector((cx, cy, cz))
    direction = (target - cam_obj.location).normalized()
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    if ortho_scale is not None:
        cam_obj.data.type = 'ORTHO'
        cam_obj.data.ortho_scale = ortho_scale
    else:
        cam_obj.data.type = 'PERSP'
        cam_obj.data.lens = 42.0


def stitch_2x2_contact_sheet(panel_paths, out_path, panel_w=800, panel_h=600):
    """Combine 4 rendered PNG panels (TL, TR, BL, BR) into one 1600x1200 contact sheet."""
    sheet_w = panel_w * 2
    sheet_h = panel_h * 2
    sheet_img = bpy.data.images.new("ContactSheet", width=sheet_w, height=sheet_h, alpha=True)
    sheet_pixels = [0.0] * (sheet_w * sheet_h * 4)

    offsets = [
        (0, panel_h),        # Top-Left (Blender image y=0 is bottom)
        (panel_w, panel_h),  # Top-Right
        (0, 0),              # Bottom-Left
        (panel_w, 0),        # Bottom-Right
    ]

    for p_path, (ox, oy) in zip(panel_paths, offsets):
        img = bpy.data.images.load(p_path)
        px = list(img.pixels)
        for y in range(panel_h):
            src_start = y * panel_w * 4
            dst_start = ((oy + y) * sheet_w + ox) * 4
            sheet_pixels[dst_start:dst_start + panel_w * 4] = px[src_start:src_start + panel_w * 4]
        bpy.data.images.remove(img)

    sheet_img.pixels[:] = sheet_pixels
    sheet_img.filepath_raw = out_path
    sheet_img.file_format = 'PNG'
    sheet_img.save()
    bpy.data.images.remove(sheet_img)


def render_glb_contact_sheet(glb_path, previews_dir):
    base_name = os.path.splitext(os.path.basename(glb_path))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_studio_environment()

    bpy.ops.import_scene.gltf(filepath=glb_path)
    enforce_backface_culling()
    bpy.context.view_layer.update()

    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    actions = [a.name for a in bpy.data.actions]
    total_verts = sum(len(o.data.vertices) for o in meshes)
    total_faces = sum(len(o.data.polygons) for o in meshes)

    min_v, max_v = compute_scene_bounds(meshes)
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    max_span = max(size.x, size.y, size.z, 1.0)

    print(
        f"[VERIFY] {base_name}.glb | Meshes:{len(meshes)} Armatures:{len(armatures)} "
        f"Clips:{len(actions)} Verts:{total_verts} Faces:{total_faces} "
        f"BBox:({size.x:.1f} x {size.y:.1f} x {size.z:.1f}m)"
    )

    # Create camera
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.clip_start = 0.1
    cam_data.clip_end = 2000.0
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    panel_w, panel_h = 800, 600
    bpy.context.scene.render.resolution_x = panel_w
    bpy.context.scene.render.resolution_y = panel_h
    bpy.context.scene.render.image_settings.file_format = 'PNG'

    dist = max_span * 1.45
    ortho_full = max(size.x * 1.06, max(size.y, size.z) * 1.38, 4.0)

    # Compute close-up target on central/hero section of the lineup
    hero_center = Vector((center.x * 0.25, center.y, center.z))
    ortho_zoom = max(ortho_full * 0.44, min(size.y, size.x) * 1.35, 3.2)

    views = [
        ("p1_iso_front", center,      28.0,  30.0, dist, ortho_full),
        ("p2_iso_back",  center,     -152.0, 30.0, dist, ortho_full),
        ("p3_hero_zoom", hero_center, 35.0,  22.0, dist * 0.55, ortho_zoom),
        ("p4_top_plan",  center,      0.0,   68.0, dist, ortho_full * 1.05),
    ]

    panel_paths = []
    for tag, tgt, az, el, d, o_scale in views:
        point_camera_at(cam_obj, tgt, az, el, d, ortho_scale=o_scale)
        p_path = os.path.join(previews_dir, f"_tmp_{base_name}_{tag}.png")
        bpy.context.scene.render.filepath = p_path
        bpy.ops.render.render(write_still=True)
        panel_paths.append(p_path)

    out_sheet = os.path.join(previews_dir, f"{base_name}.png")
    stitch_2x2_contact_sheet(panel_paths, out_sheet, panel_w=panel_w, panel_h=panel_h)
    for p_path in panel_paths:
        if os.path.exists(p_path):
            os.remove(p_path)
    print(f"[PREVIEW SAVED] {out_sheet}")


def main():
    assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    previews_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "previews"))
    os.makedirs(previews_dir, exist_ok=True)

    glb_files = sorted(f for f in os.listdir(assets_dir) if f.endswith(".glb"))
    for f in glb_files:
        render_glb_contact_sheet(os.path.join(assets_dir, f), previews_dir)


if __name__ == "__main__":
    main()
