"""Ship family -> ships.glb: container ship (2 variants), product tanker (2 variants), bulk carrier (1).
All Panamax-size and made-up. Origin = midship on the centre line at the waterline (z=0), keel below at -draft.
Bow faces -Y. Propeller and rudder are separate nodes pivoted on their axes."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *

reset_scene()

glass = make_material("ship_glass", "#22313f", 0.15, 0.2)
white = make_material("ship_white", "#f1f2ee", 0.55)
deck_grey = make_material("ship_deck_grey", "#7d8791", 0.8)
deck_dark = make_material("ship_hatch_dark", "#4f5963", 0.7)
antifoul = make_material("ship_antifoul", "#8a3b2d", 0.8)
boot_black = make_material("ship_boot_black", "#23282f", 0.8)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
dark = make_material("mule_dark", "#2a2f36", 0.6, 0.4)
prop_brass = make_material("prop_brass", "#c79a3a", 0.35, 0.9)
rudder_paint = make_material("ship_rudder", "#6e3a2f", 0.6)
yellow = make_material("safety_yellow", "#f2b92d", 0.6)
orange_boat = make_material("lifeboat_orange", "#e8662a", 0.6)
pipe_mat = make_material("deck_pipe", "#8b99a8", 0.5, 0.5)
fender_black = make_material("fender_rubber", "#1b1f24", 0.9)
container_hex = ["#b5472f", "#2f6f8f", "#d89a2b", "#4c7a52", "#8f939a", "#a8c1d4", "#e8e4d8", "#7a3f5c"]
container_mats = [make_material(f"container_{i}", hex_code, 0.7) for i, hex_code in enumerate(container_hex)]


from hulls import smooth, Hull


def house(part, y_center, base_z, tiers, width, length, tier_height, mats, bridge_wings=True, front_taper=0.0):
    """Stepped accommodation block. tiers = number of decks; the top deck is the wheelhouse."""
    z = base_z
    top_width = width
    for tier in range(tiers):
        tier_width = width - 1.2 * (tier // 2)
        tier_length = length - 0.8 * (tier // 3)
        part.box((0, y_center, z + tier_height / 2), (tier_width, tier_length, tier_height), mats["house"], bevel=0.25)
        part.box((0, y_center - tier_length / 2 - 0.02, z + tier_height * 0.55), (tier_width - 2.0, 0.08, 1.1), glass)
        for side in (-1, 1):
            part.box((side * (tier_width / 2 + 0.02), y_center, z + tier_height * 0.55),
                     (0.08, tier_length - 2.0, 1.1), glass)
        part.box((0, y_center, z + tier_height - 0.05), (tier_width + 0.3, tier_length + 0.3, 0.1), mats["trim"], bevel=0.04)
        top_width = tier_width
        z += tier_height
    wheelhouse_width = width + (6.0 if bridge_wings else 1.0)
    part.box((0, y_center - length * 0.1, z + 1.5), (wheelhouse_width, length * 0.55, 3.0), mats["house"], bevel=0.25)
    part.box((0, y_center - length * 0.1 - length * 0.275 - 0.02, z + 1.6), (wheelhouse_width - 1.2, 0.1, 1.4), glass)
    for side in (-1, 1):
        part.box((side * (wheelhouse_width / 2 + 0.02), y_center - length * 0.1, z + 1.6), (0.1, length * 0.4, 1.4), glass)
    part.box((0, y_center - length * 0.1, z + 3.1), (wheelhouse_width + 0.4, length * 0.6, 0.2), mats["trim"], bevel=0.05)
    part.cylinder((0, y_center - length * 0.1 + 1.0, z + 5.2), 0.14, 4.0, steel, segments=8)               # mast
    part.box((0, y_center - length * 0.1 + 1.0, z + 7.3), (2.2, 0.15, 0.15), steel)
    part.box((0.0, y_center - length * 0.1, z + 3.6), (1.4, 0.3, 0.5), dark, bevel=0.05)                    # radar
    return z + 3.1


def funnel(part, y_position, base_z, height, mats):
    part.box((0, y_position, base_z + height / 2), (6.2, 8.0, height), mats["funnel"], bevel=0.7)
    part.box((0, y_position, base_z + height * 0.7), (6.3, 8.1, 1.4), mats["funnel_band"], bevel=0.3)
    part.box((0, y_position, base_z + height + 0.15), (5.6, 7.2, 0.3), dark, bevel=0.1)


def lifeboats(part, y_position, z):
    for side in (-1, 1):
        part.box((side * 14.5, y_position, z), (2.4, 9.0, 2.0), orange_boat, bevel=0.5)
        part.box((side * 14.5, y_position, z + 1.3), (0.2, 9.0, 0.5), steel)


def bollards(part, y_position, half_width, z):
    for side in (-1, 1):
        part.cylinder((side * (half_width - 1.2), y_position, z + 0.5), 0.35, 1.0, steel, segments=10, bevel=0.04)


def bow_deck(part, hull, mats):
    spec = hull.spec
    y_front = hull.y_of(0.04)
    part.box((0, hull.y_of(0.07), spec["free"] + spec["bow_sheer"] * 0.45 + 0.7), (2.4, 3.0, 1.4), steel, bevel=0.2)   # windlass
    for side in (-1, 1):
        part.cylinder((side * 4.0, hull.y_of(0.085), spec["free"] + spec["bow_sheer"] * 0.2 + 0.4), 0.4, 0.8, steel, segments=10)
    part.cylinder((0, hull.y_of(0.04), spec["free"] + spec["bow_sheer"] * 0.9 + 3.0), 0.1, 6.0, white, segments=8)   # jack staff
    return y_front


def containers(part, hull, y_start, y_end, max_tier, seed, rows_cap=11, front_shift=0.0):
    generator = random.Random(seed)
    spec = hull.spec
    bay = 12.19 + 0.35
    free = spec["free"]
    y = y_start
    while y + bay <= y_end:
        s = (y + bay / 2 + spec["L"] / 2) / spec["L"]
        usable = 2 * (hull.half_width(s) - 1.6)
        rows = min(rows_cap, int(usable / 2.6))
        if rows >= 3:
            hatch_width = rows * 2.6
            part.box((0, y + bay / 2, free + 0.7), (hatch_width + 0.6, bay - 0.1, 1.4), deck_dark, bevel=0.06)
            for row in range(rows):
                x = (row - (rows - 1) / 2) * 2.6
                tiers = generator.choice([max_tier - 2, max_tier - 1, max_tier - 1, max_tier])
                tiers = max(2, tiers)
                for tier in range(tiers):
                    material = container_mats[generator.randrange(len(container_mats))]
                    part.box((x, y + bay / 2, free + 1.4 + (tier + 0.5) * 2.59), (2.44, 12.19, 2.52), material, bevel=0.05)
        y += bay
    return y


def finish_ship(part, root, hull, prop_y, prop_radius, prop_z, rudder_y, rudder_top_z, rudder_depth, name):
    spec = hull.spec
    hull_object = part.build(parent=root)
    # propeller: separate object, pivot on the hub, spins about Y
    propeller = Part(name + "_propeller")
    propeller.cylinder((0, 0, 0), 0.7, 1.8, prop_brass, axis="Y", segments=16, bevel=0.1)
    propeller.cylinder((0, 0.95, 0), 0.5, 0.5, prop_brass, axis="Y", segments=16, radius_top=0.2)
    for blade in range(5):
        angle = blade * 2 * math.pi / 5
        propeller.box((math.sin(angle) * prop_radius / 2, 0.0, math.cos(angle) * prop_radius / 2),
                      (1.6, 0.22, prop_radius), prop_brass, bevel=0.06, rot_y=angle)
    prop_object = propeller.build(parent=root, location=(0, prop_y, prop_z))
    rudder = Part(name + "_rudder")
    rudder.box((0, 1.6, -rudder_depth / 2), (0.9, 3.8, rudder_depth), rudder_paint, bevel=0.25)
    rudder.cylinder((0, 0, 0.3), 0.25, 1.2, steel, segments=10)
    rudder_object = rudder.build(parent=root, location=(0, rudder_y, rudder_top_z))
    add_clip(prop_object, "prop_spin", "rotation_euler", 1, [(1, 0.0), (30, math.radians(360))])
    add_clip(rudder_object, "rudder_swing", "rotation_euler", 2, [(1, 0.0), (15, math.radians(25)), (45, math.radians(-25)), (60, 0.0)])
    return hull_object, prop_object, rudder_object


def make_mats(top_hex, house_hex, funnel_hex, band_hex, tag):
    return {
        "topside": make_material(f"hull_top_{tag}", top_hex, 0.6),
        "boot": boot_black, "bottom": antifoul, "deck": deck_grey,
        "house": make_material(f"house_{tag}", house_hex, 0.55),
        "trim": make_material(f"house_trim_{tag}", "#d9dbd6", 0.6),
        "funnel": make_material(f"funnel_{tag}", funnel_hex, 0.55),
        "funnel_band": make_material(f"funnel_band_{tag}", band_hex, 0.55),
    }


def cargo_ship(tag, top_hex, funnel_hex, band_hex, seed):
    spec = dict(L=294.1, B=32.3, T=12.0, free=9.2, entrance=0.22, run=0.80, stern_taper=0.28, bow_power=1.45, rake=7.0,
                bilge=2.4, flare=0.14, bow_sheer=3.0, stem_depth=2.4, stern_keel_z=-3.4, stern_lift_start=0.82)
    hull = Hull(spec)
    root = make_root(f"ship_cargo_{tag}")
    mats = make_mats(top_hex, "#f1f2ee", funnel_hex, band_hex, "cargo_" + tag)
    part = Part(root.name + "_hull")
    hull.build(part, mats)
    house_y = hull.y_of(0.715)
    containers(part, hull, hull.y_of(0.165), house_y - 10.5, 6, seed)
    containers(part, hull, house_y + 10.0, hull.y_of(0.925), 5, seed + 1)
    top = house(part, house_y, spec["free"], 6, 28.0, 15.0, 3.0, mats)
    funnel(part, house_y + 14.0, spec["free"] + 3.0, 15.0 + 3.0, mats)
    lifeboats(part, house_y, spec["free"] + 4.0)
    bow_deck(part, hull, mats)
    bollards(part, hull.y_of(0.945), 16.0, spec["free"])
    finish_ship(part, root, hull, spec["L"] / 2 - 7.0, 3.5, -(spec["T"] - 3.8), spec["L"] / 2 - 4.0, -3.2, 8.5,
                root.name)
    return root


def tanker(tag, top_hex, house_hex, funnel_hex, band_hex):
    spec = dict(L=228.6, B=32.2, T=12.2, free=8.2, entrance=0.14, run=0.86, stern_taper=0.30, bow_power=1.7, rake=4.0,
                bilge=2.0, flare=0.08, bow_sheer=2.4, stem_depth=2.6, stern_keel_z=-3.6, stern_lift_start=0.84)
    hull = Hull(spec)
    root = make_root(f"ship_tanker_{tag}")
    mats = make_mats(top_hex, house_hex, funnel_hex, band_hex, "tanker_" + tag)
    part = Part(root.name + "_hull")
    hull.build(part, mats)
    free = spec["free"]
    y_start, y_end = hull.y_of(0.14), hull.y_of(0.80)
    part.box((0, (y_start + y_end) / 2, free + 1.6), (1.4, y_end - y_start, 1.4), pipe_mat, bevel=0.35)           # main deck line
    for index in range(int((y_end - y_start) / 6.0)):
        y = y_start + 3.0 + index * 6.0
        part.box((0, y, free + 0.7), (0.6, 0.6, 1.4), steel)
        part.box((0, y, free + 2.45), (8.0, 0.5, 0.5), pipe_mat, bevel=0.1) if index % 4 == 0 else None         # cross manifolds
    for side in (-1, 1):                                                                                      # tank hatches and vents
        for index in range(7):
            y = y_start + 12.0 + index * 22.0
            part.cylinder((side * 9.0, y, free + 0.4), 1.0, 0.8, steel, segments=14, bevel=0.06)
            part.cylinder((side * 12.0, y + 6.0, free + 1.8), 0.15, 3.6, steel, segments=8)
    for index in range(int((y_end - y_start) / 4.0) + 1):                                                    # raised catwalk with rails
        y = y_start + index * 4.0
        for side in (-0.8, 0.8):
            part.box((side * 1.0, y, free + 3.4), (0.07, 0.07, 1.1), yellow)
    part.box((0, (y_start + y_end) / 2, free + 2.95), (1.8, y_end - y_start, 0.1), deck_dark)
    for side in (-1, 1):
        part.box((side * 0.9, (y_start + y_end) / 2, free + 3.9), (0.06, y_end - y_start, 0.06), yellow)
        part.cylinder((side * 6.0, hull.y_of(0.47), free + 3.0), 0.3, 6.0, steel, segments=8)                   # hose crane post
        part.box((side * 6.0, hull.y_of(0.47) - 5.0, free + 6.2), (0.35, 10.0, 0.35), yellow, rot_x=math.radians(-12))
    house_y = hull.y_of(0.915)
    house(part, house_y, free, 5, 27.0, 17.0, 3.0, mats)
    funnel(part, house_y + 9.5, free + 3.0, 14.0, mats)
    lifeboats(part, house_y - 1.0, free + 3.5)
    bow_deck(part, hull, mats)
    part.cylinder((0, hull.y_of(0.10), free + 5.0), 0.2, 10.0, white, segments=8)                           # fore mast
    bollards(part, hull.y_of(0.955), 15.5, free)
    finish_ship(part, root, hull, spec["L"] / 2 - 7.0, 3.5, -(spec["T"] - 3.8), spec["L"] / 2 - 4.0, -3.4, 8.5, root.name)
    return root


def bulk_carrier():
    spec = dict(L=225.0, B=32.2, T=13.5, free=5.8, entrance=0.15, run=0.84, stern_taper=0.30, bow_power=1.7, rake=4.0,
                bilge=2.2, flare=0.08, bow_sheer=2.6, stem_depth=2.6, stern_keel_z=-4.0, stern_lift_start=0.84)
    hull = Hull(spec)
    root = make_root("ship_bulk_a")
    mats = make_mats("#3c4a5c", "#eceee9", "#3c4a5c", "#e8a33a", "bulk")
    part = Part(root.name + "_hull")
    hull.build(part, mats)
    free = spec["free"]
    hatch_length = 17.5
    y = hull.y_of(0.15)
    cranes = []
    for index in range(7):
        y_center = y + hatch_length / 2
        part.box((0, y_center, free + 0.9), (21.0, hatch_length - 1.4, 1.8), deck_dark, bevel=0.12)
        for rib in range(-3, 4):
            part.box((rib * 2.8, y_center, free + 1.85), (0.2, hatch_length - 2.0, 0.12), steel)
        part.box((0, y_center, free + 0.25), (23.0, hatch_length - 0.6, 0.5), deck_grey)
        if index in (1, 3, 5):
            cranes.append(y + hatch_length + 0.2)
        y += hatch_length + 0.2
    for crane_y in cranes:
        part.cylinder((11.6, crane_y, free + 2.2), 1.2, 4.4, white, segments=14, bevel=0.1)                    # crane pedestal
        part.box((11.6, crane_y, free + 5.2), (3.0, 3.6, 3.0), white, bevel=0.2)
        angle = math.radians(25)
        part.box((11.6, crane_y - 11.0 * math.cos(angle), free + 6.0 + 11.0 * math.sin(angle)), (0.8, 22.0, 0.8),
                 yellow, rot_x=-angle, bevel=0.1)
    house_y = hull.y_of(0.905)
    house(part, house_y, free, 5, 26.0, 17.0, 3.0, mats)
    funnel(part, house_y + 9.0, free + 3.0, 12.0, mats)
    lifeboats(part, house_y, free + 3.5)
    bow_deck(part, hull, mats)
    bollards(part, hull.y_of(0.955), 15.5, free)
    finish_ship(part, root, hull, spec["L"] / 2 - 7.0, 3.6, -(spec["T"] - 3.8), spec["L"] / 2 - 4.0, -3.9, 9.0, root.name)
    return root


ships = [cargo_ship("a", "#2d4a73", "#2d4a73", "#e8573d", 5), cargo_ship("b", "#2f6f5e", "#2f6f5e", "#f2b92d", 11),
         tanker("a", "#7a3b30", "#e9e6df", "#7a3b30", "#f2f2ee"), tanker("b", "#46525f", "#dfe6ea", "#46525f", "#e8a33a"),
         bulk_carrier()]
lengths = {"ship_cargo_a": "294 m", "ship_cargo_b": "294 m", "ship_tanker_a": "229 m", "ship_tanker_b": "229 m",
           "ship_bulk_a": "225 m"}
for ship in ships:
    register("ships.glb", ship, "midship, centre line, waterline z=0 (keel below); children *_propeller pivot at the hub, *_rudder at the stock top",
             "bow toward -Y (blender) = +Z (glTF); stern +Y", "prop_spin (30 f loop), rudder_swing (60 f)",
             f"{ship.name.replace('ship_', '').replace('_', ' ')} ship, {lengths[ship.name]} long, at design draft")
export_glb("ships.glb", with_animation=True)
