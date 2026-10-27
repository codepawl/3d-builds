"""Print node names, animations and counts of each GLB. Run: uv run --no-project python inspect_glb.py"""
import json
import struct
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
asset_dir = Path(__file__).parent.parent / "app" / "public" / "assets"
total_bytes = 0
for glb_path in sorted(asset_dir.glob("*.glb")):
    data = glb_path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    total_bytes += len(data)
    animations = [animation["name"] for animation in document.get("animations", [])]
    triangles = sum(document["accessors"][primitive["indices"]]["count"] // 3
                    for mesh in document["meshes"] for primitive in mesh["primitives"] if "indices" in primitive)
    top_level = [document["nodes"][index]["name"] for index in document["scenes"][0]["nodes"]]
    print(f"{glb_path.name}: {len(data) / 1e6:.2f} MB, {len(document['nodes'])} nodes, {len(document['meshes'])} meshes, "
          f"{triangles} triangles, animations={animations}")
    print("  roots:", ", ".join(top_level))
print(f"TOTAL {total_bytes / 1e6:.2f} MB")
