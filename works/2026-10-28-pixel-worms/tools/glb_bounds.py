import json, struct, sys, io
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    low = [1e9] * 3
    high = [-1e9] * 3
    for mesh in gltf["meshes"]:
        for primitive in mesh["primitives"]:
            accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
            for axis in range(3):
                low[axis] = min(low[axis], accessor["min"][axis])
                high[axis] = max(high[axis], accessor["max"][axis])
    anims = [a.get("name") for a in gltf.get("animations", [])]
    name = path.replace("\\", "/").split("/")[-1]
    print(name, "size", [round(high[i] - low[i], 2) for i in range(3)], "min", [round(v, 2) for v in low], "anims", anims)
