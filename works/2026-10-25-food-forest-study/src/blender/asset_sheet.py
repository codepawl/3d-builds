import bpy, os, math
from mathutils import Vector
LIB = "<your folder>/assets-lib/models"
names = ["grass_medium_01","grass_medium_02","grass_bermuda_01","shrub_01","shrub_02","shrub_03","shrub_04","shrub_sorrel_01","fern_02","nettle_plant","weed_plant_02","flower_gazania","flower_heliophila","flower_ursinia","tree_small_02","island_tree_01","island_tree_02","island_tree_03"]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
cols=6
for i,n in enumerate(names):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{LIB}/{n}/{n}_2k.gltf")
    new=[o for o in bpy.data.objects if o not in before]
    meshes=[o for o in new if o.type=="MESH"]
    mn=Vector((1e9,)*3); mx=Vector((-1e9,)*3)
    for o in meshes:
        for c in o.bound_box:
            w=o.matrix_world@Vector(c); mn=Vector(map(min,mn,w)); mx=Vector(map(max,mx,w))
    span=max(mx.x-mn.x,mx.z-mn.z,0.01)
    s=2.4/span
    root=bpy.data.objects.new("r",None); sc.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent=root
    root.scale=(s,s,s)
    root.location=((i%cols)*3-7.5 - (mn.x+mx.x)/2*s,0-(mn.y+mx.y)/2*s,-(i//cols)*3 - mn.z*s)
sun=bpy.data.lights.new("s","SUN"); sun.energy=4; so=bpy.data.objects.new("s",sun); so.rotation_euler=(0.9,0.2,0.5); sc.collection.objects.link(so)
w=bpy.data.worlds.new("w"); w.use_nodes=True; w.node_tree.nodes["Background"].inputs[1].default_value=1.0; sc.world=w
cam=bpy.data.cameras.new("c"); cam.type="ORTHO"; cam.ortho_scale=19
co=bpy.data.objects.new("c",cam); co.location=(0,-30,-3.5); co.rotation_euler=(math.pi/2,0,0); sc.collection.objects.link(co); sc.camera=co
sc.render.engine="CYCLES"; sc.cycles.samples=24; sc.cycles.device="GPU"
sc.render.resolution_x=1800; sc.render.resolution_y=1000
sc.render.filepath="<your folder>/food-forest-study/out/asset_sheet.png"
bpy.ops.render.render(write_still=True)
