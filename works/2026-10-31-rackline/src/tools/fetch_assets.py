# Downloads the chosen SimReady GLBs and thumbnails from codepawl/simready-glb, then prints each file's size and parts.
import json
import struct
import sys
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "https://huggingface.co/datasets/codepawl/simready-glb/resolve/main"
PROJECT = Path(__file__).resolve().parent.parent
ASSET_DIR = PROJECT / "public" / "assets"
THUMB_DIR = PROJECT / "thumbs"

ASSETS = """
vehicle_forklift_blue_a01 vehicle_forklift_orange_a01 vehicle_forklift_red_b01
palletJack_lowProfile_a01 robotics_small_bot_a01 equipment_robot_charger_a01
conveyor_belt_a02 conveyor_belt_a05 conveyor_belt_a08 conveyor_belt_a35
rack_large_empty_a01 rack_large_empty_a02 rack_long_empty_a01 rack_h3m_s01 rack_f04
pallet_a01 pallet_b01 pallet_block_a05 pallet_block_a01
box_cardboard_a01 box_cardboard_b01 box_cardboard_c01 box_cardboard_d01 box_cardboard_c02 box_cardboard_d02
barrier_gate_safetyDock_a02 barrier_fence_metal_a02 sign_warning_a04
lighting_overheadLed_rectangularFrame_a01 lighting_overheadLed_lightPanel_a01
structure_wall_straight_a01 structure_wall_column_a01 structure_beam_a01 structure_ceiling_a01 structure_wall_entrance_a01
ladder_rolling_yellow_a02 bin_waste_a01 crate_blue_a01 pallet_assembly_b01
""".split()


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "game-warehouse"})
    with urllib.request.urlopen(request, timeout=120) as response:
        destination.write_bytes(response.read())


def read_glb_json(path: Path) -> dict:
    with path.open("rb") as handle:
        handle.read(12)
        chunk_length = struct.unpack("<I", handle.read(4))[0]
        handle.read(4)
        return json.loads(handle.read(chunk_length))


def mesh_bounds(document: dict) -> tuple:
    low = [1e9, 1e9, 1e9]
    high = [-1e9, -1e9, -1e9]
    for mesh in document.get("meshes", []):
        for primitive in mesh["primitives"]:
            accessor = document["accessors"][primitive["attributes"]["POSITION"]]
            for axis in range(3):
                low[axis] = min(low[axis], accessor["min"][axis])
                high[axis] = max(high[axis], accessor["max"][axis])
    return low, high


def main() -> None:
    for asset in ASSETS:
        destination = ASSET_DIR / f"{asset}.glb"
        try:
            download(f"{BASE_URL}/glb/{asset}.glb", destination)
            download(f"{BASE_URL}/thumbs/{asset}.webp", THUMB_DIR / f"{asset}.webp")
        except Exception as error:
            print(f"FAILED {asset}: {error}")
            continue
        document = read_glb_json(destination)
        node_names = [node.get("name", "") for node in document.get("nodes", [])]
        low, high = mesh_bounds(document)
        print(
            f"{asset} {destination.stat().st_size / 1e6:.2f}MB nodes={len(node_names)} "
            f"raw_bounds={[round(v, 2) for v in low]}..{[round(v, 2) for v in high]} "
            f"names={node_names[:14]}"
        )


main()
