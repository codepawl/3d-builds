"""Builds every GLB of the launch-site pack, or only the families named after `--`.
Usage: blender --background --factory-startup --python build_all.py -- [rocket pad tanks yard vehicles marine props]"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import facilities
import pad
import rocket
import vehicles

FAMILIES = {
    "rocket": rocket.build,
    "pad": pad.build,
    "tanks": facilities.build_tanks,
    "yard": facilities.build_yard,
    "vehicles": vehicles.build_vehicles,
    "marine": vehicles.build_marine,
    "props": vehicles.build_props,
}

arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for family in arguments or FAMILIES:
    FAMILIES[family]()
