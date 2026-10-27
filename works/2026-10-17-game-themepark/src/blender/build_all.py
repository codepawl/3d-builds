"""Build asset families in one Blender session; a failing family is reported, the rest still build.
Usage: blender --background --factory-startup --python build_all.py -- [family ...]
Families: coaster, rides, flume, buildings, transport, people, props (default: all)."""
import importlib
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
for cached in ("lib", "parts"):
    sys.modules.pop(cached, None)

FAMILIES = ["coaster", "rides", "flume", "buildings", "transport", "people", "props"]
arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for family in arguments or FAMILIES:
    try:
        importlib.import_module(family).build()
    except Exception:
        print(f"Error building {family}")
        traceback.print_exc()
