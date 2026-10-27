"""Write blender/refs/<asset>.md reference sheets from the notes below and refs/manifest.json (images, licences).
Dimensions marked "photo scale" were measured on the reference photos against people or known parts in frame.
Usage: uv run --no-project python blender/make_ref_sheets.py"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REFS = Path(__file__).resolve().parent / "refs"
WIKI = "https://en.wikipedia.org/wiki/"

SHEETS = {
    "coaster_train": {
        "title": "Coaster train (coaster.glb: coaster_train_a / coaster_train_b)",
        "real": "Steel sit-down roller coaster train, 5 cars x 2 rows x 2 riders, polyurethane wheel assemblies (road, side guide, upstop) on tubular running rails.",
        "dimensions": [
            ("Car length (2 rows)", "2.6 m, pitch 2.9 m", "photo scale coaster_train/01 and /02: rider rows about 1.0-1.1 m apart, two rows per car"),
            ("Car width", "1.7 m", "photo scale coaster_train/01: two seated adults side by side plus walls"),
            ("Track gauge (rail centres)", "1.1 m", "photo scale coaster_track/03 and coaster_train/03; " + WIKI + "Roller_coaster_elements"),
            ("Wheel assembly", "road wheel ~0.22 m dia above rail, upstop below, guide wheel at the side", "coaster_train/03 (public domain close-up); " + WIKI + "Roller_coaster_train"),
            ("Train length", "5 x 2.9 m = 14.5 m", "derived"),
        ],
        "proportions": "Car length to width 1.5:1; seat back top 1.45 m above rail centre; lead car carries a nose fairing about 1 m long.",
        "parts": "Lead nose with lamps; per car: tub walls, floor, 4 bucket seats with headrests, 4 lap bars, side stripe and number plate, skirt, chassis, 4 wheel assemblies (road, upstop, guide, hub), rear bumper. Moving: each car (follows the spline).",
    },
    "coaster_track": {
        "title": "Coaster track, supports, lift, station (coaster.glb)",
        "real": "Steel coaster track with two tubular running rails over a box spine joined by ties, tubular columns on concrete footings, chain lift hill with service walkway.",
        "dimensions": [
            ("Lift hill height", "32.6 m crest, ~41 deg climb", WIKI + "Lift_hill (chain lift on the steepest climb); coaster_track/01 and /02 photo scale"),
            ("First drop", "about 30 m at up to 60 deg", WIKI + "Roller_coaster_elements"),
            ("Rail tube diameter", "0.16 m; spine 0.48 x 0.4 m", "photo scale coaster_track/03 against the 1.1 m gauge"),
            ("Support columns", "0.45-0.85 m diameter, twin splayed legs above 14 m", "coaster_track/01, /02, /03 photo scale"),
            ("Station", "26 m x 9.6 m canopy, platform 0.95 m above grade", "photo scale coaster_train/01, 5 cars + approach"),
        ],
        "proportions": "Layout 120 x 45 m footprint; lift run to rise about 1.15:1; ties every 2 m.",
        "parts": "Rails x2, spine, ties, columns, saddles, footings, cross braces, lift chain trough, walkway and handrail, drive house, brake fins, station deck, canopy, air gates, operator booth, status lamp, exit stairs.",
    },
    "ferris_wheel": {
        "title": "Ferris wheel (rides.glb: ferris_wheel)",
        "real": "Fixed park Ferris wheel of the Wonder Wheel class: 24 enclosed cars on a twin-rim wheel carried by A-frame towers.",
        "dimensions": [
            ("Overall height", "46 m (150 ft)", WIKI + "Wonder_Wheel"),
            ("Passenger cars", "24 fully enclosed cars", WIKI + "Wonder_Wheel"),
            ("Wheel diameter", "42 m, hub at 24 m", "ferris_wheel/02 photo scale against the 46 m height"),
            ("Gondola", "2.0 m wide x 2.4 m tall, 6 seats", "ferris_wheel/03 photo scale; " + WIKI + "Ferris_wheel"),
            ("Rim spacing (twin rims)", "2.6 m", "ferris_wheel/02 photo scale"),
        ],
        "proportions": "Height to diameter 1.1:1; tower legs splay to about 0.45 of the diameter at the base.",
        "parts": "Base platform, boarding deck with stairs and booth, 2 A-frame towers with braces, axle and hub, twin rims, 24 spokes per rim, rim cross ties, rim lamp ring, 24 gondolas with hangers. Moving: ferris_wheel_rotor (about x at the hub) and 24 gondolas (pivot at hanger, counter-rotate).",
    },
    "carousel": {
        "title": "Carousel (rides.glb: carousel)",
        "real": "Two-row (abreast) carousel with galloping horses on brass poles, crown-topped tent canopy, rounding boards with lamps, centre column.",
        "dimensions": [
            ("Platform diameter", "15 m", "carousel/02 photo scale against riders; " + WIKI + "Carousel"),
            ("Eave height / crown", "4.8 m / 8.5 m", "carousel/02 photo scale"),
            ("Horse", "1.6 m nose to tail, saddle 1.3 m above the platform", "carousel/03 photo scale against the adult-sized horse"),
            ("Rows", "2 rows x 12 horses, 2 chariots", "carousel/02"),
        ],
        "proportions": "Canopy diameter to eave height about 3.1:1; centre column diameter 0.17 of the platform.",
        "parts": "Base ring and steps, fence with gates, platform, centre column with panels, sweeps, poles, rounding boards with bulbs, canopy, crown and finial, horses, chariots. Moving: carousel_rotor (platform + canopy, about y) and each horse (bobs on its pole).",
    },
    "log_flume": {
        "title": "Log flume (flume.glb)",
        "real": "Log flume water ride: open trough on steel trestles, conveyor lift, final drop into a splash pool, hollow-log boats seating 4-5.",
        "dimensions": [
            ("Final drop", "about 15-23 m (75 ft on a large flume)", WIKI + "Log_flume_(attraction)"),
            ("Boat", "4.6 m long, 1.4 m wide, 4-5 riders in line", "log_flume/03 (public domain) photo scale"),
            ("Trough", "1.6 m inner width, 0.8 m deep", "log_flume/02 photo scale against riders"),
            ("Trestle height", "2-6 m on the run, lift to 16 m", "log_flume/01 and /02 photo scale"),
        ],
        "proportions": "Boat length to width 3.3:1; drop slope 40-45 deg; lift slope about 30 deg.",
        "parts": "Trough, trestles, lift conveyor, drop, splash pool, station deck, log boats with seats. Moving: each boat along flume_path.json.",
    },
    "monorail": {
        "title": "Monorail (transport.glb: monorail_*)",
        "real": "Straddle-beam (ALWEG type) monorail: rubber-tyred cars straddling a concrete beam on T-pylons.",
        "dimensions": [
            ("Beam width", "0.6-0.9 m (2-3 ft); here 0.8 m, depth 1.5 m", WIKI + "Monorail"),
            ("Car", "10 m long, 2.9 m wide, 3.3 m above the beam top", "monorail/01 photo scale against the beam; " + WIKI + "ALWEG"),
            ("Pylon height", "6.5 m to beam top", "monorail/01 photo scale"),
        ],
        "proportions": "Car length to height 3:1; skirt hides the beam to half its depth.",
        "parts": "Lead car with rounded nose and windscreen, middle cars, doors (separate), skirts, window band, beam segment, pylon with T-head. Moving: cars, doors.",
    },
    "castle": {
        "title": "Fairytale castle (buildings.glb: castle)",
        "real": "Romanesque Revival castle type: a tall palas with steep roofs, round towers with conical turret caps, gatehouse arch.",
        "dimensions": [
            ("Overall height", "34 m to the tallest spire (park scale; real type 65 m)", WIKI + "Neuschwanstein_Castle (150 m long complex); castle/01 photo scale"),
            ("Footprint", "36 x 26 m", "made-up park scale, proportions from castle/01, /02"),
            ("Turret diameter", "4-6 m with cones 1.6x their diameter", "castle/01, /03 photo scale"),
        ],
        "proportions": "Keep height to width about 1.1:1; turret cone height to diameter 1.6:1.",
        "parts": "Keep, 4 corner towers, main spire, cones, crenellations, windows, gate arch, bridge, flags.",
    },
    "dark_ride": {
        "title": "Show buildings (buildings.glb: showhouse_space, showhouse_temple, showhouse_tale)",
        "real": "Theme-park show building: a large windowless box (dark ride or indoor coaster) hidden behind a themed facade and entrance marquee.",
        "dimensions": [
            ("Box", "40-50 m x 30-40 m x 14-18 m", WIKI + "Dark_ride; photo scale dark_ride/01 (weak reference)"),
            ("Entrance canopy", "8 m wide, 4.5 m clear", "photo scale against guests in dark_ride/02"),
        ],
        "proportions": "Facade covers one long side; box walls plain with panel joints.",
        "parts": "Box, panel lines, facade, marquee with lamps, entrance and exit doors, rooftop plant units, status/wait board.",
    },
    "food_stand": {
        "title": "Food stands and shops (buildings.glb: stand_*, shop_*)",
        "real": "Concession kiosk with serving windows and awning, food carts, small retail shop fronts.",
        "dimensions": [
            ("Kiosk", "4 x 3 m, 3.2 m tall, counter 1.05 m", "food_stand/02 (public domain) photo scale; food_stand/03"),
            ("Cart", "2.4 x 1.2 m, umbrella 2.4 m", "photo scale"),
            ("Shop", "10 x 8 m, 5 m tall", "photo scale against doors 2.1 m"),
        ],
        "proportions": "Counter at 0.6 of a person's height; awning projects 1.2 m.",
        "parts": "Walls, serving window, counter, awning, menu board (sign_blank), roof sign, vents, bins; shops: display windows, door, awning, roof sign.",
    },
    "parking_tram": {
        "title": "Parking tram (transport.glb: tram_tractor, tram_trailer)",
        "real": "Trackless road train: a small tractor unit towing open-sided passenger trailers with bench rows and roofs.",
        "dimensions": [
            ("Tractor", "4.2 x 1.9 m, 2.5 m tall", "parking_tram/01 photo scale; " + WIKI + "Trackless_train"),
            ("Trailer", "6.5 x 2.1 m, 2.6 m tall, 6 benches", "parking_tram/01 photo scale"),
        ],
        "proportions": "Trailer roof on thin posts, floor at 0.5 m.",
        "parts": "Tractor cab, bonnet, wheels with hubs, lamps, drawbar; trailer floor, benches, posts, roof, wheels.",
    },
    "utility_cart": {
        "title": "Maintenance cart (transport.glb: maint_cart_*)",
        "real": "Electric utility vehicle (golf-cart class) with a two-seat cab and a rear cargo bed or box.",
        "dimensions": [
            ("Overall", "about 1.2 m wide, 2.4 m long, 1.8 m high", WIKI + "Golf_cart"),
            ("Utility version", "3.0 m long with box", "utility_cart/01 photo scale"),
        ],
        "proportions": "Wheel diameter 0.5 m; roof on four posts.",
        "parts": "Chassis, cowl, seat, roof, posts, windscreen, bed or box, toolbox, beacon (glow_amber), wheels with hubs, lamps.",
    },
    "parade_float": {
        "title": "Parade floats (transport.glb: float_*)",
        "real": "Parade float: a decorated flatbed trailer or self-propelled platform with skirts hiding the wheels and a raised centrepiece.",
        "dimensions": [
            ("Platform", "8 x 3 m, deck 1.0 m", "parade_float/02, /03 photo scale; " + WIKI + "Parade_float"),
            ("Centrepiece", "up to 5.5 m tall", "parade_float/01 photo scale"),
        ],
        "proportions": "Skirt to ground clearance 0.1 m; centrepiece 0.6 of the deck length.",
        "parts": "Deck, skirt with scallops, wheels, centrepiece (our own designs: cake, rocket, flower carriage), lamps.",
    },
    "people": {
        "title": "People (people.glb)",
        "real": "Park guests (adults and children), ride operators in park uniform, maintenance technicians.",
        "dimensions": [
            ("Adult height", "1.75 m", WIKI + "Human_height"),
            ("Child", "1.25 m", WIKI + "Human_height"),
        ],
        "proportions": "Head 1/7.5 of height; shoulder width 0.42 m.",
        "parts": "Armature (hips, spine, head, arms, legs), rigid parts per bone, caps or hard hats, clips walk, idle, wave, operate.",
    },
}


def main():
    manifest = json.loads((REFS / "manifest.json").read_text(encoding="utf-8"))
    folders = {"dark_ride": "dark_ride", "food_stand": "food_stand", "castle": "castle"}
    for asset, sheet in SHEETS.items():
        lines = [f"# {sheet['title']}", "", f"**Real type:** {sheet['real']}", "", "## Dimensions", "",
                 "| Part | Value | Source |", "| --- | --- | --- |"]
        lines += [f"| {part} | {value} | {source} |" for part, value, source in sheet["dimensions"]]
        lines += ["", f"## Proportions\n\n{sheet['proportions']}", "", f"## Parts\n\n{sheet['parts']}", "", "## Images", ""]
        for entry in manifest.get(folders.get(asset, asset), []):
            lines.append(f"- `{entry['file']}`: {entry['title']} ({entry['licence']}, {entry['artist'] or 'unknown author'}) {entry['page']}")
        lines.append("\nImages are modelling references only; never shown in the app or film.")
        (REFS / f"{asset}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(asset)


main()
