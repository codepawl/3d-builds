"""Build every asset family in one Blender session; a failing family is reported, the rest still build.
Usage: blender --background --factory-startup --python build_all.py -- [family ...]
Families: cars, crew, pitgear, pitlane, paddock, track, roadcars (default: all)."""
import importlib
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

FAMILIES = ["cars", "crew", "pitgear", "pitlane", "paddock", "track", "roadcars"]
arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
families = [name for argument in arguments for name in argument.split(",") if name]
for family in families or FAMILIES:
    try:
        importlib.import_module(family).build()
    except Exception:
        print(f"Error building {family}")
        traceback.print_exc()
