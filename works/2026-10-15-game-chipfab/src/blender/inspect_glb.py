"""List each GLB's size, root nodes, their children, and animation clips.

Usage: uv run --no-project python blender/inspect_glb.py [glb ...]  (default: every GLB in app/public/assets)
"""
import json
import struct
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ASSETS = Path(__file__).resolve().parent.parent / "app" / "public" / "assets"


def read_gltf(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + json_length])


def describe(path):
    gltf = read_gltf(path)
    nodes = gltf["nodes"]
    print(f"\n## {path.name}  {path.stat().st_size / 1024:.0f} KB")
    scene_roots = gltf["scenes"][gltf.get("scene", 0)]["nodes"]
    for root_index in scene_roots:
        root_node = nodes[root_index]
        children = [nodes[child]["name"] for child in root_node.get("children", [])]
        print(f"- {root_node['name']}: {', '.join(children)}")
    for animation in gltf.get("animations", []):
        print(f"  clip {animation['name']} ({len(animation['channels'])} channels)")


def main():
    paths = [Path(argument) for argument in sys.argv[1:]] or sorted(ASSETS.glob("*.glb"))
    total = 0
    for path in paths:
        describe(path)
        total += path.stat().st_size
    print(f"\ntotal {total / 1024 / 1024:.1f} MB")


main()
