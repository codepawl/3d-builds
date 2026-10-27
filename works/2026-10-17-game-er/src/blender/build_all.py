"""Build every asset family in one Blender session; a failing family is reported, the rest still build.
Usage: blender --background --factory-startup --python build_all.py -- [family ...]
Families: vehicles, helicopter, beds, imaging, furniture, building, people (default: all)."""
import importlib
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

FAMILIES = ["vehicles", "helicopter", "beds", "imaging", "furniture", "building", "people"]
arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for family in arguments or FAMILIES:
    try:
        importlib.import_module(family).build()
    except Exception:
        print(f"Error building {family}")
        traceback.print_exc()
