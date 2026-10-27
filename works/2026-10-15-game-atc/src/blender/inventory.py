"""Print a Markdown inventory of every GLB in app/public/assets: size, top-level nodes, their child
nodes with pivots in app coordinates (x, up, forward), and animation clips. Feeds ASSETS.md.

Usage: blender --background --factory-startup --python inventory.py -- <output.md>
"""
import sys
from pathlib import Path

import bpy

ASSETS = Path(__file__).resolve().parent.parent / "app" / "public" / "assets"
output_path = Path(sys.argv[sys.argv.index("--") + 1])


def app_position(obj):
    """Local position of a node in the app's y-up space."""
    location = obj.location
    return f"({location.x:.2f}, {location.z:.2f}, {-location.y:.2f})"


def describe(obj, depth):
    lines = []
    for child in sorted(obj.children, key=lambda item: item.name):
        if child.name.startswith("Icosphere"):
            continue
        kind = {"MESH": "mesh", "EMPTY": "empty", "ARMATURE": "armature"}.get(child.type, child.type.lower())
        lines.append(f"{'  ' * depth}- `{child.name}` {kind} at {app_position(child)}")
        lines += describe(child, depth + 1)
    return lines


lines = []
for glb in sorted(ASSETS.glob("*.glb")):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    roots = sorted((obj for obj in bpy.context.scene.objects if obj.parent is None and not obj.name.startswith("Icosphere")), key=lambda item: item.name)
    lines.append(f"### {glb.name} ({glb.stat().st_size / 1024:.0f} KB)")
    lines.append("")
    clips = [f"`{action.name}` ({action.frame_range[1] - action.frame_range[0]:.0f} frames)" for action in bpy.data.actions]
    if clips:
        lines.append("Clips: " + ", ".join(clips))
        lines.append("")
    for root in roots:
        lines.append(f"- **`{root.name}`**")
        lines += describe(root, 1)
    lines.append("")
output_path.write_text("\n".join(lines), encoding="utf-8")
print(f"inventory written {output_path}")
