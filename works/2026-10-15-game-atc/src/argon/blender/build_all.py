import os
import sys
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from build_terrain_sectors import build_terrain_sectors
from build_airport_runways import build_airport_runways
from build_airport_buildings import build_airport_buildings
from build_aircraft_jets import build_aircraft_jets
from build_aircraft_turboprops import build_aircraft_turboprops
from build_ground_vehicles import build_ground_vehicles
from build_navaids_waypoints import build_navaids_waypoints
from build_airspace_viz import build_airspace_viz
from build_town_coast_props import build_town_coast_props
from build_characters_crew import build_characters_crew


def main():
    t0 = time.time()
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "public", "assets"))
    os.makedirs(out_dir, exist_ok=True)

    builders = [
        ("terrain_sectors.glb",     build_terrain_sectors),
        ("airport_runways.glb",     build_airport_runways),
        ("airport_buildings.glb",   build_airport_buildings),
        ("aircraft_jets.glb",       build_aircraft_jets),
        ("aircraft_turboprops.glb",  build_aircraft_turboprops),
        ("ground_vehicles.glb",     build_ground_vehicles),
        ("navaids_waypoints.glb",   build_navaids_waypoints),
        ("airspace_viz.glb",        build_airspace_viz),
        ("town_coast_props.glb",    build_town_coast_props),
        ("characters_crew.glb",     build_characters_crew),
    ]

    for label, fn in builders:
        print(f"=== Building {label} ===")
        fn(out_dir)

    total_bytes = sum(
        os.path.getsize(os.path.join(out_dir, f))
        for f in os.listdir(out_dir)
        if f.endswith(".glb")
    )
    print(f"=== ALL 10 ASSET FAMILIES BUILT IN {time.time() - t0:.1f}s | TOTAL: {total_bytes / (1024*1024):.2f} MB ===")


if __name__ == "__main__":
    main()
