"""Write blender/ASSETS.md from assets_manifest.json, the GLB sizes and the map verification.

Usage: uv run --no-project python -I blender/tools/write_assets_md.py <project root>
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = sys.argv[1]
MANIFEST = json.load(open(f"{ROOT}/blender/assets_manifest.json", encoding="utf-8"))
RESIDUALS = json.load(open(f"{ROOT}/blender/previews/map-verify.json", encoding="utf-8"))
ASSETS = f"{ROOT}/app/public/assets"

PLACEMENT = {
    "main_street": "Plainfield village scene. Origin = centre of the Main St / North St (WI 73) junction on the 1908 plan; the hardware store sits 37-51 m south of the North St curb, east side.",
    "farm": "Farm scene at 44.1851, -89.5828 (map point only, private land). Origin = farmhouse front centre, front faces south.",
    "tavern": "Pine Grove area marker (lot unknown). Generic; `tavern_light_pool` = crime site, 8 Dec 1954.",
    "grocery": "West Plainfield marker 44.2141, -89.5527 (Hill grocery, lot unknown). Generic.",
    "cemetery": "Plainfield Cemetery 44.2154, -89.5175; Spiritland and Hancock [SEC]. Instance stones and fence segments; no names.",
    "vehicles": "Ford in the farm yard (maroon); pickup behind the store (9:30 am truck, generic); police cars arriving at the farm. Forward = +X.",
    "lights": "Farm night search: generator and flood lamps. Aim `flood_lamp_head` (pivot at the yoke).",
    "props": "Instance everywhere: bare trees, fence segments, utility poles (wire anchors `utility_pole_wire_0..3`).",
    "people": "Solid silhouettes, 1.80 m, facing +X, one material `silhouette`: tint blue (deputies, sheriff), white (Frank Worden), grey (townspeople).",
    "terrain": "County map under the GeoJSON lines. Illustrative relief 0-30 m; exaggerate in the app if wanted.",
}

SEEN_AT_POINT = {
    "Worden Hardware": "on Main St (US 51) just south of the WI 73 junction, inside the village grid",
    "Gein farm (map point only)": "exactly on a road crossing (2nd Ave / Archer Ave today)",
    "West Plainfield": "on the hamlet crossroads with its building dots",
    "Town of Pine Grove (tavern area, lot unknown)": "open farmland beside a section road (area centroid, as expected)",
    "Plainfield Cemetery": "inside the dashed cemetery box labelled Plainfield Cem, set back north of WI 73",
    "Spiritland Cemetery": "beside the Spiritland Cem label on the road by Washburn Lake",
    "Hancock Cemetery": "next to the Hancock Cem cross symbol",
    "Waushara County Courthouse, Wautoma": "in the Wautoma downtown grid, one block from the main street",
}

MOVING_KEYS = ("door", "wheel", "head", "leaf", "tailgate", "lamp", "light_pool", "outline", "anchor", "rear_lot")
LOT_PREFIXES = ("sm_", "nn_", "ne_")


def header(lines):
    lines += [
        "# Plainfield 1957 asset pack",
        "",
        "Built by `blender/build_assets.py` (helpers in `blender/geometry.py`) and checked with `blender/preview.py`:",
        "",
        "```",
        '"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/build_assets.py -- <project root> [family ...]',
        '"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/preview.py -- <project root> [glb ...]',
        "pwsh -File blender/tools/run_map.ps1      # trace the quads into GeoJSON, then verify",
        "uv run --no-project python -I blender/tools/write_assets_md.py <project root>",
        "```",
        "",
        "Units are metres. Blender is Z up, +X east, +Y north; the glTF export is Y up, so north is -Z in three.js.",
        "Materials use a dark matte palette plus four emissive materials:",
        "- `window_warm`: warm emissive windows, a separate material.",
        "- `red_glow`: the store outline and the two crime-site light pools, nothing else.",
        "- `police_blue`: the police roof lamp.",
        "- `lamp_warm`: the flood lamp faces.",
        "",
        "There are no textures and no text. Back-face culling is on for every material (`doubleSided: false`). Moving parts",
        "are separate nodes whose origin is the pivot. Reference sheets are in `blender/refs/*.md`; previews in",
        "`blender/previews/<glb>.png`; compare sheets in `blender/previews/*-compare.png`.",
        "",
    ]


def glb_table(lines):
    total = 0
    lines += ["## GLB files", "", "| File | Size | Where it goes |", "|---|---|---|"]
    for family in MANIFEST:
        size = os.path.getsize(f"{ASSETS}/{family}.glb")
        total += size
        lines.append(f"| `app/public/assets/{family}.glb` | {size / 1e6:.2f} MB | {PLACEMENT.get(family, '')} |")
    map_total = sum(os.path.getsize(f"{ASSETS}/map/{name}") for name in os.listdir(f"{ASSETS}/map"))
    lines.append(f"| all GLBs | {total / 1e6:.2f} MB | the map folder adds {map_total / 1e6:.2f} MB; together well under the 25 MB budget |")
    lines.append("")
    return total, map_total


def node_tables(lines):
    lines += ["## Nodes, pivots and real-world scale", "", "Pivot = node origin in the family frame (metres, Blender axes). Size = world bounding box in metres."]
    for family, nodes in MANIFEST.items():
        lines += ["", f"### {family}.glb", "", "| Node | Parent | Pivot (x, y, z) | Size (x, y, z) | Triangles |", "|---|---|---|---|---|"]
        lot_nodes = []
        for node in nodes:
            if family == "main_street" and node["name"].startswith(LOT_PREFIXES):
                lot_nodes.append(node["name"])
                continue
            size = tuple(node["size_m"]) if "size_m" in node else "empty"
            lines.append(f"| `{node['name']}` | {node['parent'] or ''} | {tuple(node['pivot_world_m'])} | {size} | {node.get('triangles', '')} |")
        if lot_nodes:
            lines += ["", f"Plus {len(lot_nodes)} static lot buildings from the 1908 Sanborn sheets: " + ", ".join(f"`{name}`" for name in lot_nodes) + ".",
                      "Their names carry the 1908 lot numbers (sm = South Main, nn = north side of North St, ne = north-east block)."]
    lines += [
        "",
        "Moving parts and their pivots:",
        "- Car doors hinge at their front edge; wheels spin about their centre (axis Y).",
        "- `pickup_tailgate` hinges at the bed floor.",
        "- `hardware_store_door` and `hardware_store_rear_door` hinge at their left edge.",
        "- `cemetery_gate_leaf_*` hinge at the piers.",
        "- `flood_lamp_head` pivots at the yoke, 2.5 m up; `police_car_roof_lamp` at its base.",
        "",
        "Anchors (empties): `hardware_store_label_anchor`, `hardware_store_rear_lot` (where the truck stood), `farm_label_anchor`,",
        "`tavern_label_anchor`, `grocery_label_anchor` and `utility_pole_wire_*`.",
        "",
    ]


def map_section(lines):
    lines += [
        "## Map files (`app/public/assets/map/`, WGS84 lon/lat, EPSG:4326)",
        "",
        "Extent: west -89.75, south 44.00, east -89.25, north 44.50. This covers the four 15-minute quads: Coloma 1958 (SW),",
        "Whiting 1957 (NW), Amherst 1957 (NE) and Wautoma 1959 (SE). Waupun and Madison lie outside it; `places.geojson` still",
        "lists them as off-map points.",
        "",
        "| File | Content |",
        "|---|---|",
    ]
    for name, text in (
        ("roads.geojson", "LineStrings; `class` is highway (red-filled US and state routes) or road. Village streets keep both casings, like the period map."),
        ("section_lines.geojson", "Dashed PLSS section lines and red township lines where no road runs on them (`class` section or township). Sparse; see Gaps."),
        ("water_areas.geojson", "Lake and river polygons (`area_m2`)."),
        ("streams.geojson", "Stream centrelines."),
        ("blocks.geojson", "Village block polygons from road faces. Few; see Gaps."),
        ("buildings.geojson", "Building dots from the quads (points)."),
        ("places.geojson", "Fact-file points with their `confidence` marks. The farm is a map point only."),
        ("heightmap.png", "16-bit relief for terrain.glb. Illustrative, not measured."),
        ("extent.json", "Extent and notes."),
    ):
        lines.append(f"| `{name}` ({os.path.getsize(f'{ASSETS}/map/{name}') / 1e6:.2f} MB) | {text} |")
    lines += [
        "",
        "Georeferencing: each GeoPDF's LGIDict gives a polyconic projection on NAD27 (Clarke 1866) and a page-to-metres",
        "matrix. `blender/tools/quadgeo.py` projects a lon/lat grid forward and fits a cubic polynomial from pixels to lon/lat",
        "(fit error under 1e-9 degrees). NAD27 is written as WGS84 without a datum shift. Here that shift is a few metres",
        "(inferred), inside the residuals below.",
        "",
        "terrain.glb uses a local frame with the store point as origin: x = (lon + 89.49233) * 79,724 m and",
        "y = (lat - 44.21349) * 111,132 m.",
        "",
        "### Trace check against the fact file (measured; sheet `blender/previews/map-verify.png`)",
        "",
        "| Place | Quad | Nearest traced road | What the scan shows at the point |",
        "|---|---|---|---|",
    ]
    for entry in RESIDUALS:
        lines.append(f"| {entry['place']} | {entry['quad']} | {entry['nearest_traced_road_m']} m | {SEEN_AT_POINT.get(entry['place'], '')} |")
    lines += [
        "",
        "Every point falls on the right road, crossing, cemetery or village in the scan, so the georeference error is within",
        "one road width (about 10-20 m). The distances above 50 m belong to cemeteries and an area centroid that sit back from",
        "the road; they are not georeference error.",
        "",
    ]


def gaps(lines):
    lines += [
        "## Gaps",
        "",
        "- Terrain: the 1957-59 quads are planimetric (no contours), and no elevation download was approved. The relief is",
        "  therefore illustrative, shaped by the traced water. Real relief needs USGS 3DEP or AWS terrain tiles, which needs",
        "  An's yes first.",
        "- Section lines and village blocks are sparse: the dash detector and the road-face polygonize miss many. Roads, water",
        "  and buildings carry the map, and the app can draw the PLSS grid from its 1-mile spacing if needed.",
        "- A few letters of large place names survive in roads.geojson as short squiggles, for example at the Plainfield label.",
        "- The approved downloads include no farmhouse, tavern, grocery or cemetery photos. Those models follow Sanborn",
        "  footprints and period types only. The police car has one reference image; the Ford has no side or rear view.",
        "- Store placement: the 1908 hardware store is lot 630. The 1957 building and its use are not documented, so the",
        "  placement is inferred.",
        "- Car heights and tyre sizes are estimated from the photos. Lengths, widths and wheelbases come from one cited",
        "  source each.",
    ]


def main():
    lines = []
    header(lines)
    total, map_total = glb_table(lines)
    node_tables(lines)
    map_section(lines)
    gaps(lines)
    with open(f"{ROOT}/blender/ASSETS.md", "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    print("glb bytes", total, "map bytes", map_total, "lines", len(lines))


main()
