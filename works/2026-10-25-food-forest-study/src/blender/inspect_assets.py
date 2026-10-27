import bpy, sys, os, glob
LIB = "<your folder>/assets-lib/models"
names = ["grass_medium_01","grass_medium_02","grass_bermuda_01","shrub_01","shrub_02","shrub_03","shrub_04","shrub_sorrel_01","fern_02","nettle_plant","weed_plant_02","flower_gazania","flower_heliophila","flower_ursinia","tree_small_02","island_tree_01","island_tree_02","island_tree_03","dandelion_01","celandine_01"]
for n in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    p = f"{LIB}/{n}/{n}_2k.gltf"
    if not os.path.exists(p):
        print("MISSING", n); continue
    bpy.ops.import_scene.gltf(filepath=p)
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    tris=sum(len(o.data.polygons) for o in meshes)
    from mathutils import Vector
    mn=Vector((1e9,)*3); mx=Vector((-1e9,)*3)
    for o in meshes:
        for c in o.bound_box:
            w=o.matrix_world@Vector(c)
            mn=Vector(map(min,mn,w)); mx=Vector(map(max,mx,w))
    print("ASSET",n,"objs",len(meshes),"faces",tris,"size",tuple(round(v,3) for v in (mx-mn)),"min",tuple(round(v,3) for v in mn),"mats",[m.name for o in meshes for m in o.data.materials][:4])
