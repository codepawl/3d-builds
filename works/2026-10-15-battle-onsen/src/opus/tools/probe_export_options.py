import bpy
properties = bpy.ops.export_scene.gltf.get_rna_type().properties
for prop in properties:
    if any(key in prop.identifier for key in ("color", "instanc", "image", "draco", "apply", "yup", "attributes", "normals", "tangent")):
        default = getattr(prop, "default", None)
        items = [item.identifier for item in prop.enum_items] if prop.type == "ENUM" else ""
        print("OPT", prop.identifier, prop.type, default, items)
