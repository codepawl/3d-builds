import sys
sys.path.insert(0, r"battle-onsen-opus/blender")
import bpy
import lib_materials
from lib_mesh import MeshBuilder, add_box, placement_matrix, solid_color
materials = lib_materials.MaterialLibrary()
materials.add("probe", roughness=0.5)
builder = MeshBuilder("probe")
add_box(builder, "probe", (1, 1, 1), placement_matrix((0, 0, 0)), solid_color((0.5, 0.2, 0.1)))
objects = builder.build_objects(materials)
mesh = objects[0].data
print("ATTR", [(attribute.name, attribute.domain, attribute.data_type) for attribute in mesh.color_attributes], "active", mesh.color_attributes.active_color_name, "render", mesh.color_attributes.render_color_index)
print("ALLATTR", [(attribute.name, attribute.domain, attribute.data_type) for attribute in mesh.attributes])
