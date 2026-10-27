import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import gen_01_fab_buildings as g01
import gen_02_litho_etch as g02
import gen_03_implant_cmp_metro as g03
import gen_04_oht_foup_subfab as g04
import gen_05_characters_campus as g05


def main():
    t0 = time.time()
    print("=== Building All 14 Semiconductor Fab GLB Asset Families ===")
    g01.build_fab_buildings()
    g01.build_cleanroom_bays()
    g02.build_litho_scanners()
    g02.build_etch_deposition_clusters()
    g03.build_implant_furnace_tools()
    g03.build_cmp_wet_tools()
    g03.build_metrology_packaging_tools()
    g04.build_oht_network()
    g04.build_foup_wafer_props()
    g04.build_subfab_equipment()
    g05.build_fab_characters()
    g05.build_support_plant_buildings()
    g05.build_campus_vehicles()
    g05.build_campus_environment()
    elapsed = time.time() - t0
    print(f"=== All 14 GLB Asset Families Built Successfully in {elapsed:.1f}s ===")


if __name__ == "__main__":
    main()
