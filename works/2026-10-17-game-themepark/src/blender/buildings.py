"""Park buildings: buildings.glb (big landmarks) and stands.glb (small repeatable buildings and queue parts).
Reference sheets: refs/castle.md, refs/dark_ride.md, refs/food_stand.md.

buildings.glb roots (origin at the footprint centre on the ground, entrance facing +forward):
  castle            fairytale castle, 36 x 26 m, 34 m spire
  showhouse_space   indoor coaster show building with dome, 48 x 36 m
  showhouse_temple  adventure dark ride with stepped temple facade, 40 x 30 m
  showhouse_tale    fairytale dark ride with half-timbered facade, 36 x 28 m
  entrance_gate     park gate: arch, 8 turnstiles, 2 ticket booths, flags, 34 m wide
Each show building has `<name>_marquee` (glow strip) and `<name>_board` (screen the app writes the wait on).
stands.glb roots: stand_kiosk_a, stand_kiosk_b, cart_icecream, cart_popcorn, shop_adventure, shop_space,
shop_tale, table_umbrella, queue_rail_straight (2 m), queue_rail_turn (U-turn, 1.2 m lane), queue_canopy,
fastpass_merge, wait_board (`wait_board_screen`, `wait_board_status`).
"""
import math

from lib import box, combine, cylinder, export, material, reset_scene, root, slab, sphere
from parts import LAND_COLOURS, beam_between, bulbs, palette


def gable(name, width, depth, height, base_y, center, mat, along="x"):
    """Triangular roof prism; the ridge runs along x (or forward)."""
    x, _, forward = center
    if along == "x":
        return slab(name, [(-depth / 2, 0), (depth / 2, 0), (0, height)], width, mat, plane="side", center=(x, base_y, forward), round_by=0.08)
    roof = slab(name, [(-depth / 2, 0), (depth / 2, 0), (0, height)], width, mat, plane="side", center=(0, 0, 0), round_by=0.08)
    roof.rotation_euler = (0, 0, math.pi / 2)
    from lib import point
    roof.location = point(x, base_y, forward)
    return roof


def tower(prefix, radius, top, center, wall, roof, mats, cone_ratio=1.6, windows=3):
    x, base, forward = center
    height = top - base
    parts = [
        cylinder(f"{prefix}_body", radius, height, (x, base + height / 2, forward), wall, sides=24, round_by=0.05),
        cylinder(f"{prefix}_cornice", radius + 0.3, 0.5, (x, top, forward), mats["stone"], sides=24, round_by=0.05),
        cylinder(f"{prefix}_cone", radius + 0.45, radius * 2 * cone_ratio, (x, top + 0.25 + radius * cone_ratio, forward), roof, sides=24, radius_end=0.05),
        sphere(f"{prefix}_finial", 0.25, (x, top + 0.25 + radius * 2 * cone_ratio, forward), mats["gold"], segments=10),
        box(f"{prefix}_flag", (0.05, 0.7, 1.1), (x, top + radius * 2 * cone_ratio + 0.9, forward + 0.55), mats["brand"], 0.02),
        cylinder(f"{prefix}_flagpole", 0.04, 1.6, (x, top + radius * 2 * cone_ratio + 0.6, forward), mats["gold"], sides=6),
    ]
    for level in range(windows):
        for turn in range(4):
            angle = turn * math.pi / 2 + math.pi / 4
            y = base + height * (0.3 + 0.55 * level / max(1, windows))
            window = box(f"{prefix}_win_{level}_{turn}", (0.6, 1.3, 0.2), (x + radius * math.sin(angle), y, forward + radius * math.cos(angle)), mats["glass"], 0.08)
            window.rotation_euler = (0, 0, angle)
            parts.append(window)
    return parts


def merlons(prefix, length, y, center, mat, along="x", step=1.2):
    x, _, forward = center
    parts = []
    count = int(length / step)
    for index in range(count):
        offset = -length / 2 + step * (index + 0.5)
        spot = (x + offset, y, forward) if along == "x" else (x, y, forward + offset)
        parts.append(box(f"{prefix}_{index}", (0.6, 0.8, 0.6), spot, mat, 0.05))
    return parts


def build_castle(mats):
    group = root("castle", (0, 0, 0))
    wall = material("castle_wall", LAND_COLOURS["fairytale"]["main"], roughness=0.7)
    parts = [
        box("plinth", (38, 3.0, 28), (0, 1.5, 0), mats["stone"], 0.3),
        box("keep", (18, 16, 12), (0, 11, -3), wall, 0.15),
        gable("keep_roof", 18.6, 12.6, 7.0, 19.0, (0, 0, -3), mats["roof_blue"]),
        box("front_wall", (24, 8, 1.6), (0, 7, 11), wall, 0.1),
        box("side_wall_l", (1.6, 8, 20), (-15, 7, 0), wall, 0.1),
        box("side_wall_r", (1.6, 8, 20), (15, 7, 0), wall, 0.1),
        box("gate_recess", (5, 6.5, 0.4), (0, 6.25, 11.7), mats["dark"], 0.05),
        cylinder("gate_arch", 2.5, 0.42, (0, 9.5, 11.7), mats["dark"], axis="forward", sides=24),
        box("gate_trim", (6.4, 0.6, 0.5), (0, 3.3, 11.9), mats["gold"], 0.05),
        box("bridge", (5, 0.5, 6), (0, 2.8, 15), mats["wood"], 0.05),
        box("moat", (34, 0.1, 3.6), (0, 0.06, 15.8), mats["water"], 0.02),
        box("rose_window_frame", (3.2, 3.2, 0.3), (0, 15, 3.1), mats["gold"], 0.6),
        cylinder("rose_window", 1.3, 0.35, (0, 15, 3.15), mats["glass_light"], axis="forward", sides=24),
    ]
    parts += merlons("front_merlon", 24, 11.4, (0, 0, 11), wall)
    parts += merlons("left_merlon", 20, 11.4, (-15, 0, 0), wall, along="forward")
    parts += merlons("right_merlon", 20, 11.4, (15, 0, 0), wall, along="forward")
    for floor in range(3):
        for column in range(-3, 4):
            if column == 0 and floor == 2:
                continue
            parts.append(box(f"keep_win_{floor}_{column}", (0.9, 1.9, 0.2), (column * 2.4, 6.5 + floor * 3.8, 3.05), mats["glass"], 0.15))
            parts.append(box(f"keep_sill_{floor}_{column}", (1.2, 0.15, 0.3), (column * 2.4, 5.45 + floor * 3.8, 3.1), mats["stone"], 0.03))
    parts += tower("spire", 3.2, 26.0, (0, 3, -3), wall, mats["roof_blue"], mats, cone_ratio=1.25, windows=4)
    for index, (x, forward) in enumerate(((-15, 11), (15, 11), (-15, -10), (15, -10))):
        roof = mats["roof_pink"] if index % 2 == 0 else mats["roof_blue"]
        parts += tower(f"corner_{index}", 2.5, 15.0 if forward > 0 else 18.0, (x, 3, forward), wall, roof, mats, cone_ratio=1.6)
    for index, x in enumerate((-6, 6)):
        parts += tower(f"turret_{index}", 1.4, 23.0, (x, 19, 2.6), wall, mats["roof_pink"], mats, cone_ratio=1.8, windows=1)
    combine("castle_body", parts, parent=group)
    lights = bulbs("castle_lights", (0, 0, 11.9), 2.7, 18, 9.5, mats["glow_warm"], size=0.12, axis="x")
    lights.parent = group
    return group


def show_box(prefix, size, wall, trim, mats):
    width, height, depth = size
    parts = [box(f"{prefix}_box", size, (0, height / 2, 0), wall, 0.3),
             box(f"{prefix}_roof", (width - 0.2, 0.2, depth - 0.2), (0, height + 0.05, 0), material("roof_light", "#e6e9ef", roughness=0.8), 0.05),
             box(f"{prefix}_parapet_f", (width + 0.4, 0.8, 0.4), (0, height + 0.2, depth / 2), trim, 0.08),
             box(f"{prefix}_parapet_b", (width + 0.4, 0.8, 0.4), (0, height + 0.2, -depth / 2), trim, 0.08),
             box(f"{prefix}_parapet_l", (0.4, 0.8, depth), (-width / 2, height + 0.2, 0), trim, 0.08),
             box(f"{prefix}_parapet_r", (0.4, 0.8, depth), (width / 2, height + 0.2, 0), trim, 0.08),
             box(f"{prefix}_base", (width + 0.3, 0.6, depth + 0.3), (0, 0.3, 0), mats["concrete"], 0.05)]
    for index in range(int(width / 4)):
        x = -width / 2 + 4 * (index + 0.5)
        parts.append(box(f"{prefix}_rib_b_{index}", (0.25, height - 1, 0.15), (x, height / 2, -depth / 2 - 0.05), trim, 0.03))
    for index in range(int(depth / 4)):
        forward = -depth / 2 + 4 * (index + 0.5)
        for side in (-1, 1):
            parts.append(box(f"{prefix}_rib_{side}_{index}", (0.15, height - 1, 0.25), (side * (width / 2 + 0.05), height / 2, forward), trim, 0.03))
    for unit in range(3):
        x = -width / 4 + unit * width / 4
        parts += [box(f"{prefix}_ac_{unit}", (3.0, 1.4, 2.0), (x, height + 1.1, -depth / 4), mats["panel"], 0.12),
                  cylinder(f"{prefix}_fan_{unit}", 0.7, 0.1, (x - 0.6, height + 1.85, -depth / 4), mats["dark"], sides=16),
                  cylinder(f"{prefix}_fan2_{unit}", 0.7, 0.1, (x + 0.7, height + 1.85, -depth / 4), mats["dark"], sides=16)]
    parts += [box(f"{prefix}_exit_door", (2.4, 2.4, 0.2), (width / 2 - 4, 1.4, depth / 2 + 0.05), mats["steel_dark"], 0.04),
              box(f"{prefix}_service_door", (3.5, 4.0, 0.2), (-width / 2 + 5, 2.2, -depth / 2 - 0.1), mats["steel"], 0.04)]
    return parts


def entrance_feature(prefix, group, width, front, mats, glow):
    """Entrance canopy, marquee strip, sign plate and wait board on the +forward face."""
    canopy = [
        box(f"{prefix}_canopy", (9, 0.4, 4.5), (-width / 4, 5.0, front + 2.2), mats["brand"], 0.12),
        cylinder(f"{prefix}_canopy_post_l", 0.15, 4.8, (-width / 4 - 4, 2.4, front + 4.0), mats["support"], sides=10),
        cylinder(f"{prefix}_canopy_post_r", 0.15, 4.8, (-width / 4 + 4, 2.4, front + 4.0), mats["support"], sides=10),
        box(f"{prefix}_doorway", (5, 3.6, 0.2), (-width / 4, 1.9, front + 0.05), mats["dark"], 0.05),
        box(f"{prefix}_sign", (8, 2.0, 0.3), (-width / 4, 7.0, front + 0.2), mats["sign_blank"], 0.1),
    ]
    combine(f"{prefix}_entrance", canopy, parent=group)
    combine(f"{prefix}_marquee", [box(f"{prefix}_strip", (8.6, 0.12, 0.12), (-width / 4, 5.25, front + 4.5), glow, 0.03),
                                  box(f"{prefix}_strip_top", (8.4, 0.12, 0.12), (-width / 4, 8.1, front + 0.4), glow, 0.03)], parent=group)
    combine(f"{prefix}_board", [box(f"{prefix}_board_frame", (1.6, 1.0, 0.2), (-width / 4 + 6.5, 2.4, front + 3.0), mats["dark"], 0.05),
                                box(f"{prefix}_board_post", (0.15, 1.9, 0.15), (-width / 4 + 6.5, 0.95, front + 3.0), mats["steel"], 0.03),
                                box(f"{prefix}_board_screen", (1.4, 0.8, 0.04), (-width / 4 + 6.5, 2.4, front + 3.11), mats["screen"], 0.01)], parent=group)


def build_space(mats):
    group = root("showhouse_space", (70, 0, 0))
    colours = LAND_COLOURS["space"]
    wall = material("space_wall", colours["main"], roughness=0.5)
    trim = material("space_trim", colours["trim"], roughness=0.45)
    parts = show_box("space", (48, 16, 36), wall, trim, mats)
    parts += [
        sphere("dome", 11, (12, 16, 6), material("dome", "#eef1fa", roughness=0.25, metallic=0.3), scale=(1, 0.75, 1), segments=32),
        cylinder("dome_ring", 11.4, 0.9, (12, 16.4, 6), trim, sides=48),
        cylinder("mast", 0.25, 9, (-16, 20.5, -10), mats["steel"], sides=10),
        sphere("mast_dish", 1.6, (-16, 22.5, -8.8), mats["white"], scale=(1, 1, 0.35), segments=16),
        box("fin_l", (0.5, 10, 6), (22, 21, 10), material("space_accent", colours["accent"], roughness=0.4), 0.2),
    ]
    combine("showhouse_space_body", parts, parent=group)
    rings = [cylinder("dome_glow", 11.5, 0.25, (12, 17.0, 6), mats["glow_violet"], sides=48),
             sphere("mast_beacon", 0.35, (-16, 25.2, -10), mats["glow_amber"], segments=10)]
    for band in range(6):
        rings.append(box(f"wall_glow_{band}", (0.3, 12, 0.1), (-20 + band * 7, 8, 18.1), mats["glow_violet"], 0.03))
    combine("showhouse_space_glow", rings, parent=group)
    entrance_feature("showhouse_space", group, 48, 18, mats, mats["glow_violet"])
    return group


def build_temple(mats):
    group = root("showhouse_temple", (0, 0, 60))
    colours = LAND_COLOURS["adventure"]
    wall = material("temple_wall", colours["main"], roughness=0.85)
    trim = material("temple_trim", colours["trim"], roughness=0.8)
    parts = show_box("temple", (40, 12, 30), wall, trim, mats)
    for tier in range(4):
        width = 22 - tier * 4.5
        parts.append(box(f"tier_{tier}", (width, 3.2, 4.5 - tier * 0.5), (-5, 1.6 + tier * 3.2, 16.5 - tier * 0.6), mats["stone"], 0.2))
    parts += [box("shrine", (6, 4, 3), (-5, 14.4, 15.2), mats["stone"], 0.2),
              gable("shrine_roof", 7, 4, 2.5, 16.4, (-5, 0, 15.2), trim)]
    for column in range(-2, 3):
        parts.append(cylinder(f"column_{column}", 0.45, 6.0, (-5 + column * 3.2, 3.0, 19.5), mats["stone"], sides=12, round_by=0.05))
        parts.append(box(f"capital_{column}", (1.3, 0.5, 1.3), (-5 + column * 3.2, 6.2, 19.5), mats["stone"], 0.05))
    parts.append(box("lintel", (15, 1.0, 1.6), (-5, 6.9, 19.5), mats["stone"], 0.1))
    for vine in range(10):
        parts.append(sphere(f"vine_{vine}", 1.2 + 0.4 * (vine % 3), (-19 + vine * 4.2, 11 + (vine % 2), 15.4), mats["foliage_dark"], scale=(1.4, 0.8, 0.6), segments=10))
    combine("showhouse_temple_body", parts, parent=group)
    torches = []
    for x in (-13, 3):
        torches += [cylinder(f"torch_{x}", 0.12, 3.0, (x, 1.5, 20.5), mats["wood_dark"], sides=8),
                    sphere(f"flame_{x}", 0.3, (x, 3.2, 20.5), mats["glow_amber"], scale=(1, 1.5, 1), segments=10)]
    combine("showhouse_temple_glow", torches, parent=group)
    entrance_feature("showhouse_temple", group, 40, 15, mats, mats["glow_amber"])
    return group


def build_tale(mats):
    group = root("showhouse_tale", (-60, 0, 0))
    colours = LAND_COLOURS["fairytale"]
    wall = material("tale_wall", colours["main"], roughness=0.7)
    trim = material("tale_trim", colours["trim"], roughness=0.6)
    parts = show_box("tale", (36, 13, 28), wall, trim, mats)
    for index, x in enumerate((-12, 0, 12)):
        parts += [box(f"house_{index}", (10, 9, 2.0), (x, 4.5, 14.8), wall, 0.1),
                  gable(f"house_roof_{index}", 10.8, 3.2, 4.0 + index % 2, 9.0, (x, 0, 14.8), mats["roof_pink"] if index != 1 else mats["roof_blue"], along="forward")]
        for beam in (-4.4, -1.5, 1.5, 4.4):
            parts.append(box(f"timber_{index}_{beam}", (0.3, 9, 0.2), (x + beam, 4.5, 15.85), mats["wood_dark"], 0.03))
        parts.append(box(f"timber_h_{index}", (10, 0.3, 0.2), (x, 5.0, 15.85), mats["wood_dark"], 0.03))
        for window_x in (-3, 3):
            parts += [box(f"win_{index}_{window_x}", (1.4, 1.6, 0.2), (x + window_x, 6.8, 15.9), mats["glass"], 0.1),
                      box(f"shutter_{index}_{window_x}", (0.5, 1.6, 0.12), (x + window_x + 1.0, 6.8, 15.92), mats["roof_blue"], 0.03)]
    parts += tower("tale_tower", 2.2, 16, (17, 0, 13), wall, mats["roof_blue"], mats, cone_ratio=1.7)
    combine("showhouse_tale_body", parts, parent=group)
    lamps = combine("showhouse_tale_glow", [sphere(f"lantern_{x}", 0.3, (x, 3.6, 16.2), mats["glow_warm"], segments=10) for x in (-17, -7, 5, 7)])
    lamps.parent = group
    entrance_feature("showhouse_tale", group, 36, 16, mats, mats["glow_warm"])
    return group


def build_entrance(mats):
    group = root("entrance_gate", (0, 0, -60))
    parts = []
    for side in (-1, 1):
        parts += [box(f"pylon_{side}", (3.2, 12, 3.2), (side * 12, 6, 0), mats["white"], 0.3),
                  box(f"pylon_band_{side}", (3.3, 1.0, 3.3), (side * 12, 9.5, 0), mats["brand"], 0.1),
                  box(f"pylon_base_{side}", (3.8, 1.0, 3.8), (side * 12, 0.5, 0), mats["stone"], 0.1),
                  box(f"booth_{side}", (4.0, 3.0, 3.0), (side * 16.5, 1.5, 0.5), mats["white"], 0.15),
                  box(f"booth_roof_{side}", (4.5, 0.3, 3.6), (side * 16.5, 3.15, 0.5), mats["brand"], 0.1)]
        for window in (-1, 1):
            parts.append(box(f"booth_win_{side}_{window}", (1.2, 1.1, 0.1), (side * 16.5 + window * 0.9, 1.9, 2.02), mats["glass"], 0.03))
        for flag in (-1, 1):
            x = side * (20 + flag * 1.5) + side * 2
            parts += [cylinder(f"flagpole_{side}_{flag}", 0.08, 9, (x, 4.5, 3), mats["chrome"], sides=8),
                      box(f"flag_{side}_{flag}", (1.6, 1.0, 0.04), (x + 0.85, 8.3, 3), mats["brand"] if flag > 0 else mats["roof_blue"], 0.02)]
    parts += [box("arch_beam", (27.2, 2.6, 2.6), (0, 13.3, 0), mats["white"], 0.3),
              box("arch_stripe", (27.4, 0.5, 2.7), (0, 12.2, 0), mats["brand"], 0.08),
              box("arch_sign", (14, 2.0, 0.3), (0, 13.4, 1.35), mats["sign_blank"], 0.1),
              box("canopy", (21, 0.3, 5), (0, 4.0, 0), mats["glass_light"], 0.08)]
    for index in range(8):
        x = -7 + index * 2.0
        parts += [box(f"turnstile_{index}", (0.35, 1.0, 1.2), (x, 0.5, 0), mats["steel"], 0.06),
                  box(f"turnstile_top_{index}", (0.4, 0.06, 1.25), (x, 1.03, 0), mats["dark"], 0.02),
                  box(f"turnstile_reader_{index}", (0.25, 0.05, 0.2), (x, 1.07, 0.4), mats["screen"], 0.01),
                  beam_between(f"turnstile_arm_{index}", (x + 0.18, 0.9, 0), (x + 0.8, 0.9, 0), 0.03, mats["chrome"], sides=6),
                  cylinder(f"canopy_post_{index}", 0.07, 4.0, (x + 1.0, 2.0, -2.2), mats["support"], sides=8)]
    for planter in (-1, 1):
        parts += [box(f"planter_{planter}", (3, 0.8, 3), (planter * 9, 0.4, 6), mats["stone"], 0.1),
                  sphere(f"shrub_{planter}", 1.4, (planter * 9, 1.4, 6), mats["foliage"], scale=(1, 0.8, 1), segments=12)]
    combine("entrance_gate_body", parts, parent=group)
    combine("entrance_gate_lights", [box("arch_glow", (26, 0.15, 0.15), (0, 12.0, 1.4), mats["glow_warm"], 0.03)], parent=group)
    return group


# --- stands.glb ------------------------------------------------------------------------------

def striped_awning(prefix, width, depth, y, front, mats, colour):
    parts = []
    stripes = int(width / 0.5)
    for index in range(stripes):
        mat = colour if index % 2 == 0 else mats["white"]
        piece = box(f"{prefix}_stripe_{index}", (0.5, 0.06, depth), (-width / 2 + 0.25 + index * 0.5, y, front), mat, 0.02)
        piece.rotation_euler = (math.radians(-18), 0, 0)
        parts.append(piece)
    return parts


def build_stands(mats):
    stand_a = root("stand_kiosk_a", (0, 0, 0))
    parts = [box("body", (4, 2.8, 3), (0, 1.4, 0), mats["white"], 0.12),
             box("skirt", (4.05, 1.0, 3.05), (0, 0.5, 0), mats["brand"], 0.08),
             box("window", (2.8, 1.1, 0.1), (0, 1.75, 1.52), mats["dark"], 0.03),
             box("counter", (3.0, 0.08, 0.5), (0, 1.08, 1.65), mats["steel"], 0.02),
             box("roof", (4.4, 0.25, 3.4), (0, 2.95, 0), mats["brand_dark"], 0.08),
             box("roof_sign", (2.6, 0.9, 0.2), (0, 3.6, 0.9), mats["sign_blank"], 0.06),
             box("menu", (1.2, 0.7, 0.05), (1.4, 2.4, 1.53), mats["screen"], 0.01),
             box("vent", (0.8, 0.5, 0.05), (2.03, 2.2, -0.5), mats["dark"], 0.01),
             cylinder("bin", 0.3, 0.9, (2.5, 0.45, 1.3), mats["steel_dark"], sides=14, round_by=0.03)]
    parts += striped_awning("awning_a", 4.0, 1.3, 2.55, 2.0, mats, mats["brand"])
    combine("stand_kiosk_a_body", parts, parent=stand_a)

    stand_b = root("stand_kiosk_b", (8, 0, 0))
    accent = material("kiosk_blue", "#7aaee8", roughness=0.5)
    parts = [cylinder("drum", 1.6, 2.6, (0, 1.3, 0), mats["white"], sides=32, round_by=0.05),
             cylinder("band", 1.65, 0.9, (0, 0.45, 0), accent, sides=32),
             box("window", (1.8, 1.0, 0.3), (0, 1.75, 1.5), mats["dark"], 0.04),
             cylinder("roof", 2.2, 1.4, (0, 3.3, 0), accent, sides=32, radius_end=0.3),
             cylinder("cup", 0.45, 1.0, (0, 4.4, 0), mats["white"], sides=20, radius_end=0.6),
             cylinder("straw", 0.06, 0.9, (0.15, 5.2, 0), mats["brand"], sides=8),
             box("counter", (2.0, 0.08, 0.45), (0, 1.15, 1.7), mats["steel"], 0.02)]
    combine("stand_kiosk_b_body", parts, parent=stand_b)

    for name, x, cart_colour in (("cart_icecream", 14, "#f4a6c0"), ("cart_popcorn", 18, "#f0545c")):
        cart = root(name, (x, 0, 0))
        colour = material(f"{name}_paint", cart_colour, roughness=0.45)
        parts = [box("cabinet", (2.0, 1.0, 1.0), (0, 0.75, 0), colour, 0.1),
                 box("lid", (2.05, 0.08, 1.05), (0, 1.29, 0), mats["steel"], 0.02),
                 box("handle", (0.06, 0.06, 0.9), (-1.25, 1.0, 0), mats["chrome"], 0.02)]
        for side in (-1, 1):
            parts += [cylinder(f"wheel_{side}", 0.3, 0.1, (0.4, 0.3, side * 0.58), mats["rubber"], axis="forward", sides=16, round_by=0.02),
                      cylinder(f"hub_{side}", 0.12, 0.12, (0.4, 0.3, side * 0.58), mats["chrome"], axis="forward", sides=10)]
        if name == "cart_popcorn":
            parts += [box("glass_case", (1.6, 0.9, 0.9), (0, 1.8, 0), mats["glass_light"], 0.05),
                      box("case_roof", (1.8, 0.15, 1.0), (0, 2.3, 0), colour, 0.05),
                      box("popcorn", (1.4, 0.35, 0.7), (0, 1.5, 0), material("popcorn", "#f7e2a0", roughness=0.9), 0.1)]
        else:
            parts += [cylinder("umbrella_pole", 0.04, 1.7, (0.6, 2.1, 0), mats["chrome"], sides=8),
                      cylinder("umbrella", 1.3, 0.5, (0.6, 3.0, 0), colour, sides=16, radius_end=0.05),
                      sphere("scoop", 0.25, (-0.4, 1.4, 0), mats["white"], segments=12)]
        combine(f"{name}_body", parts, parent=cart)

    shops = [("shop_adventure", 30, "adventure"), ("shop_space", 44, "space"), ("shop_tale", 58, "fairytale")]
    for name, x, land in shops:
        shop = root(name, (x, 0, 0))
        colours = LAND_COLOURS[land]
        wall = material(f"{name}_wall", colours["main"], roughness=0.7)
        accent_mat = material(f"{name}_accent", colours["accent"], roughness=0.5)
        parts = [box("walls", (10, 5, 8), (0, 2.5, 0), wall, 0.15),
                 box("plinth", (10.3, 0.4, 8.3), (0, 0.2, 0), mats["stone"], 0.05),
                 box("display_l", (3.0, 2.4, 0.15), (-3.0, 1.9, 4.02), mats["glass_light"], 0.05),
                 box("display_r", (3.0, 2.4, 0.15), (3.0, 1.9, 4.02), mats["glass_light"], 0.05),
                 box("door", (1.6, 2.4, 0.15), (0, 1.4, 4.02), mats["glass"], 0.04),
                 box("sign", (5, 0.9, 0.2), (0, 4.2, 4.1), mats["sign_blank"], 0.06),
                 box("lintel", (10.2, 0.3, 0.3), (0, 3.3, 4.1), accent_mat, 0.05)]
        if land == "adventure":
            parts += [gable("roof", 11, 9, 3.2, 5.0, (0, 0, 0), material("thatch", "#c9a764", roughness=0.95)),
                      box("porch", (10, 0.2, 2.5), (0, 3.4, 5.3), mats["wood"], 0.05)]
            parts += [cylinder(f"porch_post_{p}", 0.14, 3.4, (p, 1.7, 6.4), mats["wood_dark"], sides=8) for p in (-4.6, 0, 4.6)]
        elif land == "space":
            parts += [box("roof_slab", (10.6, 0.5, 8.6), (0, 5.2, 0), mats["white"], 0.25),
                      cylinder("roof_disc", 2.4, 0.8, (2, 5.8, -1), accent_mat, sides=32, round_by=0.2),
                      box("glow_band", (10.2, 0.12, 0.1), (0, 4.95, 4.15), mats["glow_violet"], 0.02)]
        else:
            parts += [gable("roof", 10.8, 8.8, 4.0, 5.0, (0, 0, 0), mats["roof_pink"]),
                      box("chimney", (0.8, 2.2, 0.8), (3, 7.6, -1.5), mats["stone"], 0.08)]
            parts += [box(f"beam_{b}", (0.25, 5, 0.12), (b, 2.5, 4.08), mats["wood_dark"], 0.02) for b in (-4.8, -1.2, 1.2, 4.8)]
        parts += striped_awning(f"{name}_awning", 9.0, 1.2, 3.0, 4.6, mats, accent_mat)
        combine(f"{name}_body", parts, parent=shop)

    table = root("table_umbrella", (70, 0, 0))
    parts = [cylinder("top", 0.6, 0.06, (0, 0.74, 0), mats["white"], sides=24, round_by=0.02),
             cylinder("leg", 0.05, 0.72, (0, 0.37, 0), mats["steel"], sides=8),
             cylinder("pole", 0.03, 2.4, (0, 1.2, 0), mats["chrome"], sides=8),
             cylinder("umbrella", 1.4, 0.45, (0, 2.45, 0), mats["brand"], sides=16, radius_end=0.05)]
    for chair in range(4):
        angle = chair * math.pi / 2
        x, forward = 0.95 * math.cos(angle), 0.95 * math.sin(angle)
        parts += [box(f"seat_{chair}", (0.45, 0.06, 0.45), (x, 0.45, forward), mats["support"], 0.02),
                  box(f"chair_back_{chair}", (0.45, 0.45, 0.06) if chair % 2 else (0.06, 0.45, 0.45),
                      (x * 1.25, 0.7, forward * 1.25), mats["support"], 0.02)]
        parts += [cylinder(f"chair_leg_{chair}_{n}", 0.02, 0.45, (x + dx, 0.22, forward + dz), mats["steel"], sides=6)
                  for n, (dx, dz) in enumerate(((0.18, 0.18), (-0.18, 0.18), (0.18, -0.18), (-0.18, -0.18)))]
    combine("table_umbrella_body", parts, parent=table)

    straight = root("queue_rail_straight", (76, 0, 0))
    parts = []
    for forward in (-1.0, 1.0):
        parts += [cylinder(f"post_{forward}", 0.04, 1.0, (0, 0.5, forward), mats["steel"], sides=10),
                  cylinder(f"foot_{forward}", 0.12, 0.04, (0, 0.02, forward), mats["steel_dark"], sides=12),
                  sphere(f"cap_{forward}", 0.05, (0, 1.0, forward), mats["chrome"], segments=8)]
    parts += [cylinder("rail_top", 0.025, 2.0, (0, 0.95, 0), mats["chrome"], axis="forward", sides=8),
              cylinder("rail_mid", 0.02, 2.0, (0, 0.55, 0), mats["chrome"], axis="forward", sides=8)]
    combine("queue_rail_straight_body", parts, parent=straight)

    turn = root("queue_rail_turn", (80, 0, 0))
    parts = []
    previous = None
    for step in range(13):
        angle = math.pi * step / 12
        here = (0.6 * math.cos(angle), 0, 0.6 * math.sin(angle))
        if step % 4 == 0:
            parts.append(cylinder(f"post_{step}", 0.04, 1.0, (here[0], 0.5, here[2]), mats["steel"], sides=10))
            parts.append(cylinder(f"foot_{step}", 0.12, 0.04, (here[0], 0.02, here[2]), mats["steel_dark"], sides=12))
        if previous:
            for height, radius in ((0.95, 0.025), (0.55, 0.02)):
                parts.append(beam_between(f"rail_{step}_{height}", (previous[0], height, previous[2]), (here[0], height, here[2]), radius, mats["chrome"], sides=8))
        previous = here
    combine("queue_rail_turn_body", parts, parent=turn)

    canopy = root("queue_canopy", (86, 0, 0))
    parts = [cylinder(f"post_{p}", 0.1, 3.4, (p, 1.7, -1.5), mats["support"], sides=10) for p in (-2.8, 2.8)]
    sail = box("sail", (6.4, 0.08, 3.6), (0, 3.4, 0.2), mats["brand"], 0.03)
    sail.rotation_euler = (math.radians(8), 0, 0)
    parts += [sail, box("arm", (6.0, 0.12, 0.12), (0, 3.35, -1.5), mats["support"], 0.03)]
    combine("queue_canopy_body", parts, parent=canopy)

    merge = root("fastpass_merge", (94, 0, 0))
    parts = [box("podium", (0.8, 1.1, 0.6), (0, 0.55, 0), mats["white"], 0.1),
             box("podium_top", (0.85, 0.06, 0.65), (0, 1.12, 0), mats["dark"], 0.02),
             box("reader", (0.3, 0.05, 0.25), (0, 1.17, 0.1), mats["screen"], 0.01),
             box("glow", (0.82, 0.08, 0.05), (0, 0.9, 0.31), mats["glow_cool"], 0.01),
             box("sign_post", (0.1, 2.4, 0.1), (0.9, 1.2, 0), mats["steel"], 0.02),
             box("sign", (1.2, 0.6, 0.08), (0.9, 2.3, 0), mats["sign_blank"], 0.03),
             box("gate", (1.0, 0.8, 0.06), (-0.9, 0.6, 0), mats["glass_light"], 0.02)]
    combine("fastpass_merge_body", parts, parent=merge)

    board = root("wait_board", (98, 0, 0))
    combine("wait_board_frame", [box("frame", (1.8, 1.2, 0.2), (0, 2.2, 0), mats["dark"], 0.06),
                                 box("post", (0.15, 1.6, 0.15), (0, 0.8, 0), mats["steel"], 0.03),
                                 box("plate", (1.6, 0.3, 0.06), (0, 3.0, 0), mats["sign_blank"], 0.02)], parent=board)
    combine("wait_board_screen", [box("screen", (1.6, 0.8, 0.04), (0, 2.2, 0.11), mats["screen"], 0.01)], parent=board)
    combine("wait_board_status", [sphere("lamp", 0.1, (0.95, 2.75, 0.1), mats["status"], segments=10)], parent=board)


def build():
    reset_scene()
    mats = palette()
    build_castle(mats)
    build_space(mats)
    build_temple(mats)
    build_tale(mats)
    build_entrance(mats)
    export("buildings.glb")
    reset_scene()
    mats = palette()
    build_stands(mats)
    export("stands.glb")


if __name__ == "__main__":
    build()
