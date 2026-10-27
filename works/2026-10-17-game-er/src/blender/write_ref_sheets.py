"""Write blender/refs/<asset>.md for every main asset: real type, dimensions with sources, proportions,
parts list, and the reference images that are still on disk (source page and licence from manifest.json).
Usage: uv run --no-project python blender/write_ref_sheets.py

Source tags: [W] Wikipedia article text saved in refs/sources, [P] measured on the reference photo against a
known size in the same photo (wheel, door, person), [S] typical manufacturer spec-sheet value, not fetched
(inferred), [F] US federal standard (GSA KKK-A-1822F, FAA AC 150/5390-2D) as cited by Wikipedia, value not fetched.
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REFS = Path(__file__).resolve().parent / "refs"

SHEETS = {
    "ambulance": {
        "type": "US Type III ambulance: cutaway van chassis-cab (E-450 class) with a square aluminium patient module; "
                "variant Type II high-roof van ambulance. Own livery: white, brand blue band, orange reflective stripe.",
        "dimensions": [
            "Overall length 6.7-7.0 m (Type III, 14 ft module) [S] and [P] ambulance/01: length = 7.6 wheel diameters of 0.82 m = 6.2 m plus bumpers",
            "Module body width 2.44 m (96 in, the KKK-A-1822F maximum body width) [F]",
            "Overall height 2.8-2.9 m to light bar [S]; [P] ambulance/01 module top at 3.4 wheel diameters = 2.8 m",
            "Wheelbase 4.0 m (158-176 in cutaway chassis) [S]; rear dual wheels; tyre diameter 0.80 m (LT225/75R16) [S]",
            "Patient compartment interior length 2.95 m, headroom 1.73 m (KKK-A-1822F minimums 116 in and 68 in) [F]",
            "Type II van: 6.0 m long, 2.0 m wide, 2.7 m high, wheelbase 3.66 m [S]",
        ],
        "proportions": "module length : cab length about 2.3 : 1; module top 0.45 m above cab roof; module floor 0.85 m above "
                       "ground; rear doors split 50/50, each 0.65 m wide, 1.6 m high; side door forward on the kerb side.",
        "parts": "front: grille, headlamps, bumper, windscreen, warning lamps in grille, mirrors | side: cab door, cab window, "
                 "fuel flap, curb-side entry door with window, two compartment doors, reflective stripe, wheels with "
                 "hubs (single front, dual rear), steps | top: light bar on module front edge, roof AC unit, vents | back: "
                 "two rear doors with windows (MOVE, hinge outer edge), step bumper, corner warning lamps, tail lamps. "
                 "Moving: wheels, door_rear_L, door_rear_R, door_side; lights emissive.",
    },
    "helicopter": {
        "type": "Light twin-engine medical helicopter, EC135/H135 class: pod-and-boom fuselage, 4-blade bearingless main "
                "rotor, ducted fan (fenestron) tail, skids, rear clamshell doors for the stretcher. Own scheme.",
        "dimensions": [
            "Fuselage length 10.2 m, height 3.51 m [W] EC135 wikitext specifications",
            "Main rotor diameter 10.2 m; length with rotors turning 12.16 m [W]",
            "Skid track 2.0 m, cabin width 1.5 m [P] helicopter/01 (skid track about 0.57 of cabin length)",
            "Max take-off weight 2,910 kg [W] (used for the app's sheet, not the model)",
        ],
        "proportions": "cabin pod 4.0 m of the 10.2 m fuselage; tail boom tapers to a fenestron of 1.0 m diameter with a "
                       "vertical fin above; rotor mast at 2.9 m; horizontal stabiliser with end plates at 70% of length.",
        "parts": "front: rounded nose, large windscreen, chin windows | side: pilot door, sliding cabin door, engine cowlings "
                 "with exhausts, tail boom, stabiliser, fin, fenestron | top: 4-blade rotor head (MOVE about up), "
                 "engine intakes | back: clamshell doors (MOVE), skid gear with cross tubes. Moving: rotor_main, "
                 "rotor_tail, door_clam_L/R; beacons and nav lights emissive.",
    },
    "helipad": {
        "type": "Hospital ground or rooftop heliport: square touchdown and lift-off area (TLOF) inside a final approach "
                "area (FATO), hospital marking, perimeter lights, wind cone.",
        "dimensions": [
            "TLOF at least the design helicopter's rotor diameter, 12 m for a 10.2 m rotor; FATO 1.5 x overall length = 18 m [F] FAA AC 150/5390-2D",
            "Perimeter lights every 7.5 m or less, green, flush or 0.1 m high [F]",
            "Wind cone 2.4 m long on a 3-4 m mast [F]",
            "[P] helipad/01 rooftop pad on a hospital wing roughly 3 floors (12 m) above the street",
        ],
        "proportions": "pad square 18 m with a 12 m TLOF inset; marking cross and H about 0.6 of the TLOF.",
        "parts": "deck slab, TLOF outline, red cross/H marking (own design, not a sign of a real hospital), green perimeter "
                 "lights (glow), floodlights, wind cone on mast, safety net/railing on the edge.",
    },
    "stretcher": {
        "type": "Ambulance powered cot (Ferno/Stryker class) and ED transport stretcher (trolley).",
        "dimensions": [
            "Cot length 2.06 m, width 0.58 m, height 0.36-1.05 m [S]; [P] stretcher/01 cot width about 0.55 of the 1.1 m door opening",
            "ED stretcher 2.1 m long, 0.8 m wide (with rails), deck height 0.55-0.9 m, 150-200 mm castors [S]",
        ],
        "proportions": "mattress 0.1 m thick; backrest 0.7 m of deck length, raised up to 60 degrees; X-frame legs on the cot.",
        "parts": "mattress with orange/blue cover, backrest (MOVE, hinge at 0.7 m from foot), side rails, IV pole socket, "
                 "push handles, X-frame legs (cot), base with bumper and 4 castors (MOVE), loading wheels at the head.",
    },
    "hospital_bed": {
        "type": "Electric acute-care hospital bed: four-section deck, head and foot boards, split side rails, base on castors.",
        "dimensions": [
            "Overall 2.2 m long, 1.0 m wide with rails, deck height 0.4-0.8 m, castors 125-150 mm [S]",
            "[P] hospital_bed/02: length about 2.2 x width; head board 0.95 m high from floor; rails 0.35 m above mattress",
        ],
        "proportions": "head board taller than foot board (1.0 : 0.8); rails two per side, head rails 0.7 m long.",
        "parts": "base frame with cover, 4 castors (MOVE), lift columns, deck with mattress, backrest section (MOVE), "
                 "knee break, head board, foot board with control panel, split side rails, bumper wheels, IV socket.",
    },
    "ct_scanner": {
        "type": "Multislice CT scanner: ring gantry with 70-80 cm bore on a pedestal, patient couch with sliding table top.",
        "dimensions": [
            "Gantry 2.0-2.2 m wide, 1.9-2.0 m high, 0.9-1.0 m deep; bore 0.70-0.80 m [S]",
            "Couch 2.4 m long base, table top travel 1.6-2.0 m, height 0.5-1.0 m [S]",
            "[P] ct_scanner/03 opened gantry: rotor ring about 1.6 m against the person beside it",
        ],
        "proportions": "bore centre at 0.53 of gantry height; gantry face rounded square with a tilted outer cover; couch "
                       "base 0.45 m wide, table top 0.5 m wide.",
        "parts": "gantry cover, bore ring with laser markers, front control panels with small screens, status lights (glow), "
                 "pedestal, couch base with bellows, sliding table top (MOVE along forward), head rest, control console "
                 "behind lead glass with two monitors.",
    },
    "xray": {
        "type": "General radiography room: ceiling-suspended X-ray tube on rails, floating table, upright wall bucky stand, "
                "operator console behind a lead screen.",
        "dimensions": [
            "Room 5 x 4 m, ceiling 2.8-3.0 m; ceiling rails 4 m [S]",
            "Table 2.2 x 0.8 m, height 0.7 m; wall stand 0.6 m wide, detector travel 0.3-1.8 m [S]",
            "[P] xray/01: wall stand column 2.0 m against the door; tube head 0.5 m wide",
        ],
        "proportions": "tube head on a telescopic column hanging from a carriage that runs on two rails.",
        "parts": "ceiling rails and carriage (MOVE along forward), telescopic column, tube head with collimator and light "
                 "(MOVE up), table with base, wall stand column and detector (MOVE up), generator cabinet, lead screen "
                 "with window, console screen.",
    },
    "nurses_station": {
        "type": "ED nurses' station and triage desk: low counter with a raised transaction ledge, workstations, "
                "status board; triage desk is a smaller two-sided booth by the walk-in entrance.",
        "dimensions": [
            "Counter height 0.75 m work surface, 1.05-1.1 m ledge, depth 0.6 m [S] (ADA desk height 0.71-0.86 m)",
            "[P] nurses_station/01: counter about 0.6 of standing staff height; monitors 0.45 m wide",
        ],
        "proportions": "U or L shaped counter 4-6 m long; ledge band 0.3 m above the work surface.",
        "parts": "counter body with panels, ledge, work surface, 3-4 monitors (screens emissive), keyboards, chairs, "
                 "tracking board on a post (emissive), sign plate, phone, chart rack.",
    },
    "waiting_room": {
        "type": "ED waiting area: beam seating (rows of 3-4 joined chairs), side tables, check-in kiosk, TV screen.",
        "dimensions": ["Seat height 0.45 m, seat width 0.55-0.6 m per place, back height 0.8-0.85 m [S]; [P] waiting_room/01 chair back about half of door height"],
        "proportions": "beam on two T legs; arm rests between seats.",
        "parts": "beam, legs with feet, seats and backs (upholstered), arm rests, side table, kiosk with screen (emissive).",
    },
    "lab_analyzer": {
        "type": "Clinical chemistry analyser (floor-standing) plus centrifuge on a lab bench.",
        "dimensions": ["Analyser about 1.5 m long, 0.8 m deep, 1.2 m high [S]; [P] lab_analyzer/02 sample carousel 0.5 m diameter"],
        "proportions": "low cabinet with a glass lid over the carousel; touch screen on an arm at one end.",
        "parts": "cabinet with panels and vents, glass lid, sample carousel and reagent rotor, probe arm, touch screen "
                 "(emissive), status lamp, tube racks; bench with centrifuge and microscope.",
    },
    "staff": {
        "type": "ED staff in scrubs (nurse, doctor), porter in polo and trousers, paramedic in uniform with reflective bands.",
        "dimensions": ["Figure 1.75 m (adult average) used as scale everywhere [S]"],
        "proportions": "scrub top V-neck with chest pocket, short sleeves; trousers loose; badge on lanyard; "
                       "stethoscope around neck for doctors and nurses ([P] staff/01, staff/02).",
        "parts": "head, hair or scrub cap, torso, arms, hands, legs, shoes (clogs/trainers), badge, stethoscope, tablet. "
                 "Armature bones and clips idle, walk, push_bed, chart, sit.",
    },
    "ed_building": {
        "type": "Emergency department front: ambulance bay under a drive-through canopy, separate walk-in entrance with "
                "sliding doors and a canopy, illuminated EMERGENCY-style sign plate (text-free in the model).",
        "dimensions": [
            "Ambulance bay canopy clearance 4.0-4.3 m (vehicle 2.9 m plus light bar) [S]; [P] ed_building/01 canopy about 1.5 x ambulance height",
            "Sliding door 2.4-2.8 m clear opening, 2.4 m high [S]; floor-to-floor 4.2 m [S]",
        ],
        "proportions": "canopy depth 8-10 m, about 1.3 ambulance lengths; walk-in canopy lighter and curved ([P] ed_building/02).",
        "parts": "wall modules with windows and panel joints, sliding doors (MOVE), canopy with columns, lights (glow), "
                 "bollards, sign plate (glow), helipad, lamp posts, trees, kerbs.",
    },
}


def images_section(asset, manifest):
    lines = []
    for entry in manifest.get(asset, []):
        if (REFS / entry["file"]).exists():
            lines.append(f"- `{entry['file']}`: {entry['title']} | {entry['page']} | {entry['licence']} | {entry['artist']}")
    return lines or ["- none kept"]


def main():
    manifest = json.loads((REFS / "manifest.json").read_text(encoding="utf-8"))
    for asset, sheet in SHEETS.items():
        lines = [f"# {asset}", "", "Reference images are for modelling only; never shown in the app or film.", "",
                 "## Real type", sheet["type"], "", "## Dimensions"]
        lines += [f"- {item}" for item in sheet["dimensions"]]
        lines += ["", "## Proportions", sheet["proportions"], "", "## Parts", sheet["parts"], "", "## Images"]
        lines += images_section(asset, manifest)
        (REFS / f"{asset}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(asset)


main()
