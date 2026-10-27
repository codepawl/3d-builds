import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import gen_01_cleanroom_structure
import gen_02_litho_scanners
import gen_03_etch_dep_clusters
import gen_04_implant_anneal_tools
import gen_05_cmp_wet_metrology
import gen_06_oht_network_foup
import gen_07_stocker_units
import gen_08_subfab_utilities
import gen_09_campus_buildings
import gen_10_campus_vehicles_props
import gen_11_fab_characters
import preview


def main():
    t0 = time.time()
    generators = [
        ("cleanroom_structure.glb", gen_01_cleanroom_structure.main),
        ("litho_scanners.glb", gen_02_litho_scanners.main),
        ("etch_dep_clusters.glb", gen_03_etch_dep_clusters.main),
        ("implant_anneal_tools.glb", gen_04_implant_anneal_tools.main),
        ("cmp_wet_metrology.glb", gen_05_cmp_wet_metrology.main),
        ("oht_network_foup.glb", gen_06_oht_network_foup.main),
        ("stocker_units.glb", gen_07_stocker_units.main),
        ("subfab_utilities.glb", gen_08_subfab_utilities.main),
        ("campus_buildings.glb", gen_09_campus_buildings.main),
        ("campus_vehicles_props.glb", gen_10_campus_vehicles_props.main),
        ("fab_characters.glb", gen_11_fab_characters.main),
    ]

    for glb_name, fn in generators:
        fn()
        preview.render_glb_contact_sheet(glb_name)

    print(f"[SUITE DONE] Built & previewed {len(generators)} GLB families in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
