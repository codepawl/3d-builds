"""Build every Kelvin GLB, or only the ones named after `--`.

blender --background --factory-startup --python blender/build_all.py [-- hall cooling power units campus]
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ALL_ASSETS = ["hall", "cooling", "power", "units", "campus"]

requested = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ALL_ASSETS
for asset in requested:
    module = importlib.import_module(f"build_{asset}")
    module.main()
