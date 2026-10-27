"""vehicles.glb (SPMT transporters, crawler crane, ground crew vehicles), marine.glb (recovery boat, range
boat, buoy) and props.glb (road checkpoint, weather tower, camera mast, light pole, barriers).
From refs/spmt.md, refs/crawler_crane.md, refs/recovery_boat.md and refs/weather_tower.md. Vehicles face +z
and stand on y = 0; wheels, bogies, booms, hooks, barrier arms and the boat's A-frame are separate nodes
with their pivot at the joint."""
import math

import lib
from lib import box, combine, cylinder, export, loft, reset_scene, rod, root, slab, sphere, turn, wheel
from parts import around, ladder, lamp, palette, railing, truss_beam

lib.TYRE = "#707070"
lib.HUB = "#d6d6d4"


# --- SPMT -----------------------------------------------------------------------------------------

def spmt(name, modules_across, axle_lines, stand, materials):
    """Axle-line modules 2.44 m wide, axle pitch 1.5 m, deck 1.5 m; a power pack at the front.
    Each module's axle line is a steerable bogie node (pivot on its kingpin) with twin wheels.
    With `stand`, an upright stage stand: ring cradle on eight posts, seat anchor `<name>_seat`."""
    group = root(name)
    width = modules_across * 2.44
    length = axle_lines * 1.5 + 1.0
    deck_top = 1.5
    parts = [box(f"{name}_deck", (width, 0.55, length), (0, deck_top - 0.28, 0), materials["frame"], round_by=0.08)]
    for index in range(modules_across - 1):
        x = -width / 2 + (index + 1) * 2.44
        parts.append(box(f"{name}_seam{index}", (0.05, 0.05, length), (x, deck_top + 0.01, 0), materials["dark"], round_by=0.0))
    for index in range(axle_lines + 1):
        z = -length / 2 + 0.5 + index * 1.5
        parts.append(box(f"{name}_rib{index}", (width + 0.08, 0.35, 0.12), (0, deck_top - 0.65, z), materials["frame"], round_by=0.02))
    pack_z = length / 2 + 1.4
    parts.append(box(f"{name}_power_pack", (2.3, 2.1, 2.6), (0, 1.75, pack_z), materials["clay"], round_by=0.15))
    parts.append(box(f"{name}_grille", (1.8, 1.2, 0.08), (0, 1.9, pack_z + 1.32), materials["dark"], round_by=0.02))
    parts.append(box(f"{name}_pack_frame", (2.0, 0.4, 2.0), (0, 0.6, pack_z), materials["frame"], round_by=0.05))
    parts.append(cylinder(f"{name}_exhaust", 0.1, 1.0, (0.8, 3.2, pack_z - 0.8), materials["dark"], sides=8))
    parts.append(lamp(f"{name}_beacon", (-0.8, 2.95, pack_z - 0.8), materials["glow_amber"], radius=0.14))
    for sign in (-1, 1):
        parts.append(lamp(f"{name}_head{sign}", (sign * 0.8, 1.2, pack_z + 1.32), materials["glow_white"], radius=0.1))
        parts.append(lamp(f"{name}_tail{sign}", (sign * (width / 2 - 0.2), 1.2, -length / 2 - 0.05), materials["glow_red"], radius=0.1))
    if stand:
        for index in range(8):
            angle = 2 * math.pi * (index + 0.5) / 8
            x, _, z = around(5.0, angle, 0)
            parts.append(box(f"{name}_post{index}", (0.7, 2.6, 0.7), (x, deck_top + 1.3, z), materials["clay"], round_by=0.08))
            parts.append(rod(f"{name}_strut{index}", (x * 0.6, deck_top, z * 0.6), (x, deck_top + 2.4, z), 0.12, materials["frame"]))
        from parts import annulus
        parts.append(annulus(f"{name}_cradle", 4.55, 5.4, deck_top + 2.6, deck_top + 3.3, (0, 0, 0), materials["clay"], sides=40))
        for index in range(12):
            angle = 2 * math.pi * index / 12
            x, _, z = around(4.8, angle, 0)
            pad = box(f"{name}_pad{index}", (0.5, 0.3, 0.5), (x, deck_top + 3.45, z), materials["dark"], round_by=0.05)
            parts.append(pad)
    combine(f"{name}_body", parts, parent=group)
    if stand:
        root_seat = root(f"{name}_seat", (0, deck_top + 3.6, 0))
        lib.attach(root_seat, group)
    for module in range(modules_across):
        x = -width / 2 + 1.22 + module * 2.44
        for line in range(axle_lines):
            z = -length / 2 + 1.25 + line * 1.5
            bogie_parts = [box(f"{name}_b{module}_{line}_yoke", (1.9, 0.5, 0.5), (x, 1.0, z), materials["dark"], round_by=0.06),
                           cylinder(f"{name}_b{module}_{line}_king", 0.2, 0.4, (x, 1.25, z), materials["steel"], sides=8)]
            for side in (-1, 1):
                bogie_parts.append(wheel(f"{name}_b{module}_{line}_w{side}", 0.45, 0.5, (x + side * 0.6, 0.45, z), None, bolts=6))
            combine(f"{name}_bogie_{module}_{line}", bogie_parts, origin=(x, 1.25, z), parent=group)
    return group


# --- crawler crane --------------------------------------------------------------------------------

def crawler_crane(name, materials):
    """Lattice-boom crawler crane: crawlers and car body fixed; `_upper` slews about up, `_boom` luffs
    about x at its foot (modelled at 70 degrees), `_hook` hangs from the boom tip."""
    group = root(name)
    parts = []
    for sign in (-1, 1):
        x = sign * 5.0
        parts.append(box(f"{name}_crawler{sign}", (2.0, 2.0, 11.0), (x, 1.2, 0), materials["dark"], round_by=0.5))
        for end in (-1, 1):
            parts.append(cylinder(f"{name}_tumbler{sign}{end}", 0.9, 2.1, (x, 1.1, end * 5.4), materials["frame"], axis="x", sides=16))
        for shoe in range(26):
            z = -6.0 + shoe * 0.48
            parts.append(box(f"{name}_shoe{sign}{shoe}", (2.1, 0.12, 0.3), (x, 2.24, z), materials["rubber"], round_by=0.0))
        for roller in range(6):
            parts.append(cylinder(f"{name}_roller{sign}{roller}", 0.3, 0.3, (x + sign * 1.05, 0.9, -3.5 + roller * 1.4), materials["frame"], axis="x", sides=10))
    parts.append(box(f"{name}_carbody", (8.0, 1.6, 5.0), (0, 2.6, 0), materials["frame"], round_by=0.2))
    combine(f"{name}_base", parts, parent=group)

    upper_origin = (0, 3.4, 0)
    upper = root(f"{name}_upper", upper_origin)
    lib.attach(upper, group)
    body = [box(f"{name}_deck", (6.0, 1.0, 12.0), (0, 3.9, -1.5), materials["frame"], round_by=0.15),
            box(f"{name}_house", (4.4, 3.2, 7.0), (0.6, 6.0, -2.5), materials["clay"], round_by=0.25),
            box(f"{name}_cab", (1.6, 2.2, 2.0), (-2.4, 5.5, 3.4), materials["clay"], round_by=0.2),
            box(f"{name}_cab_glass", (1.62, 1.1, 1.4), (-2.4, 5.9, 3.6), materials["glass"], round_by=0.08)]
    for row in range(4):
        body.append(box(f"{name}_counterweight{row}", (5.6, 0.9, 2.6), (0, 4.9 + row * 0.95, -7.0), materials["dark"], round_by=0.12))
    body += truss_beam(f"{name}_mast", (0, 4.4, 1.5), (0, 24.0, -6.0), 1.6, 1.6, materials["frame"], panels=6, chord=0.16, web=0.07)
    body.append(rod(f"{name}_mast_stay", (0, 24.0, -6.0), (0, 8.5, -7.5), 0.08, materials["steel"]))
    body.append(lamp(f"{name}_beacon", (0.6, 7.7, -2.5), materials["glow_amber"], radius=0.15))
    combine(f"{name}_upper_body", body, origin=upper_origin, parent=upper)

    foot = (0, 4.6, 2.5)
    angle = math.radians(70)
    length = 110.0
    tip = (0, foot[1] + length * math.sin(angle), foot[2] + length * math.cos(angle))
    boom_parts = truss_beam(f"{name}_boom", foot, tip, 3.2, 3.2, materials["frame"], panels=34, chord=0.22, web=0.09)
    boom_parts.append(cylinder(f"{name}_sheave", 0.9, 0.8, tip, materials["steel"], axis="x", sides=16))
    boom_parts.append(rod(f"{name}_pendant", tip, (0, 24.0, -6.0), 0.07, materials["steel"]))
    boom_parts.append(lamp(f"{name}_tip_light", (0, tip[1] + 1.2, tip[2]), materials["glow_red"], radius=0.3))
    combine(f"{name}_boom", boom_parts, origin=foot, parent=upper)

    hook_top = (0, tip[1] - 0.8, tip[2] + 0.6)
    hook = [rod(f"{name}_rope", hook_top, (0, hook_top[1] - 30, hook_top[2]), 0.06, materials["steel"]),
            box(f"{name}_block", (1.4, 2.2, 0.9), (0, hook_top[1] - 31.2, hook_top[2]), materials["clay"], round_by=0.2),
            cylinder(f"{name}_hook", 0.35, 0.8, (0, hook_top[1] - 32.6, hook_top[2]), materials["dark"], sides=10)]
    combine(f"{name}_hook", hook, origin=hook_top, parent=upper)
    return group


# --- crew vehicles --------------------------------------------------------------------------------

def add_wheels(name, group, positions, radius, width):
    for index, center in enumerate(positions):
        wheel(f"{name}_wheel_{index}", radius, width, center, group, bolts=5)


def pickup(name, crew_cab, materials):
    """Light pickup 5.4 m x 2.0 m: lower body, cab with glass, bed, light bar; wheels are nodes."""
    group = root(name)
    cab_length = 2.6 if crew_cab else 1.8
    parts = [box(f"{name}_lower", (1.95, 0.75, 5.4), (0, 0.85, 0), materials["clay"], round_by=0.18),
             box(f"{name}_hood", (1.9, 0.25, 1.5), (0, 1.32, 1.9), materials["clay"], round_by=0.15),
             box(f"{name}_cab", (1.85, 0.85, cab_length), (0, 1.62, 1.15 - cab_length / 2), materials["clay"], round_by=0.18),
             box(f"{name}_glass", (1.87, 0.5, cab_length - 0.3), (0, 1.75, 1.15 - cab_length / 2), materials["glass"], round_by=0.08),
             box(f"{name}_windscreen", (1.7, 0.55, 0.08), (0, 1.72, 1.18), materials["glass"], round_by=0.03),
             box(f"{name}_light_bar", (1.2, 0.1, 0.25), (0, 2.1, 1.15 - cab_length / 2), materials["glow_amber"], round_by=0.03)]
    bed_front = 1.15 - cab_length
    bed_length = bed_front + 2.7
    for sign in (-1, 1):
        parts.append(box(f"{name}_bedwall{sign}", (0.08, 0.45, bed_length), (sign * 0.93, 1.45, bed_front - bed_length / 2), materials["clay"], round_by=0.03))
        parts.append(lamp(f"{name}_head{sign}", (sign * 0.7, 1.05, 2.7), materials["glow_white"], radius=0.09))
        parts.append(lamp(f"{name}_tail{sign}", (sign * 0.85, 1.1, -2.7), materials["glow_red"], radius=0.08))
    parts.append(box(f"{name}_grille", (1.3, 0.35, 0.06), (0, 1.0, 2.71), materials["dark"], round_by=0.02))
    combine(f"{name}_body", parts, parent=group)
    add_wheels(name, group, [(sign * 0.85, 0.4, z) for z in (1.7, -1.6) for sign in (-1, 1)], 0.4, 0.28)
    return group


def crew_van(name, materials):
    group = root(name)
    parts = [box(f"{name}_body", (2.0, 2.0, 5.9), (0, 1.55, -0.2), materials["clay"], round_by=0.25),
             box(f"{name}_nose", (1.95, 0.9, 0.9), (0, 1.0, 3.0), materials["clay"], round_by=0.25),
             box(f"{name}_windscreen", (1.8, 0.75, 0.6), (0, 2.0, 2.65), materials["glass"], round_by=0.1),
             box(f"{name}_side_glass", (2.02, 0.5, 3.2), (0, 2.05, 0.4), materials["glass"], round_by=0.05),
             box(f"{name}_door_line", (2.03, 1.5, 0.04), (0, 1.5, -0.6), materials["dark"], round_by=0.0),
             box(f"{name}_roof_rack", (1.6, 0.12, 3.0), (0, 2.62, -0.5), materials["frame"], round_by=0.02),
             lamp(f"{name}_beacon", (0, 2.75, 1.6), materials["glow_amber"], radius=0.12)]
    for sign in (-1, 1):
        parts.append(lamp(f"{name}_head{sign}", (sign * 0.75, 1.15, 3.45), materials["glow_white"], radius=0.09))
        parts.append(lamp(f"{name}_tail{sign}", (sign * 0.9, 1.3, -3.17), materials["glow_red"], radius=0.08))
    combine(f"{name}_body", parts, parent=group)
    add_wheels(name, group, [(sign * 0.88, 0.38, z) for z in (2.2, -1.8) for sign in (-1, 1)], 0.38, 0.26)
    return group


def tanker_truck(name, materials):
    """Cryogenic tanker: tractor (cab, sleeper, fuel tanks) and a 13 m insulated trailer; 18 wheels as nodes."""
    group = root(name)
    parts = [box(f"{name}_chassis", (1.1, 0.4, 6.4), (0, 1.0, 5.6), materials["dark"], round_by=0.05),
             box(f"{name}_cab", (2.45, 2.0, 2.2), (0, 2.3, 7.4), materials["clay"], round_by=0.25),
             box(f"{name}_hood", (2.2, 1.0, 1.4), (0, 1.75, 8.9), materials["clay"], round_by=0.3),
             box(f"{name}_windscreen", (2.2, 0.8, 0.1), (0, 2.85, 8.5), materials["glass"], round_by=0.04),
             box(f"{name}_sleeper", (2.4, 2.4, 1.4), (0, 2.5, 5.7), materials["clay"], round_by=0.2),
             cylinder(f"{name}_stack", 0.12, 2.0, (1.1, 3.6, 6.4), materials["steel"], sides=8)]
    for sign in (-1, 1):
        parts.append(cylinder(f"{name}_fuel{sign}", 0.32, 1.3, (sign * 1.05, 0.9, 6.6), materials["steel"], axis="forward", sides=12))
        parts.append(lamp(f"{name}_head{sign}", (sign * 0.9, 1.5, 9.62), materials["glow_white"], radius=0.1))
        parts.append(lamp(f"{name}_tail{sign}", (sign * 1.15, 1.2, -6.65), materials["glow_red"], radius=0.09))
    trailer_sections = [(-6.4, 0, 0, 2.3), (-6.3, 0.9, 0.9, 2.3), (-6.0, 1.2, 1.2, 2.3), (4.0, 1.2, 1.2, 2.3), (4.3, 0.9, 0.9, 2.3), (4.4, 0, 0, 2.3)]
    parts.append(loft(f"{name}_tank", trailer_sections, materials["steel"], sides=28, axis="forward"))
    parts.append(box(f"{name}_trailer_frame", (1.0, 0.35, 10.6), (0, 1.05, -1.1), materials["dark"], round_by=0.04))
    parts.append(box(f"{name}_valve_cabinet", (2.2, 1.4, 1.2), (0, 1.6, -6.9), materials["clay"], round_by=0.1))
    parts.append(box(f"{name}_catwalk", (0.6, 0.08, 7.0), (0, 3.55, -1.0), materials["frame"], round_by=0.0))
    combine(f"{name}_body", parts, parent=group)
    positions = [(sign * 0.95, 0.5, 8.3) for sign in (-1, 1)]
    positions += [(sign * offset, 0.5, z) for z in (5.4, 4.1, -3.6, -4.9) for sign in (-1, 1) for offset in (0.75, 1.1)]
    add_wheels(name, group, positions, 0.5, 0.3)
    return group


def build_vehicles():
    reset_scene()
    materials = palette()
    spmt("spmt_stand", 4, 8, True, materials)
    spmt("spmt_short", 4, 6, True, materials)
    spmt("spmt_flat", 2, 6, False, materials)
    crawler_crane("crawler_crane", materials)
    pickup("pickup_crew", True, materials)
    pickup("pickup_single", False, materials)
    crew_van("crew_van", materials)
    tanker_truck("tanker_truck", materials)
    export("vehicles.glb")


# --- marine ---------------------------------------------------------------------------------------

def hull(name, length, beam, depth, materials, deck_up):
    """Lower half of an elliptic-ring loft (round bilge, fine bow) and a flat deck slab on top."""
    half = length / 2
    stations = [(-half, 0.92, 0.85), (-half * 0.6, 1.0, 1.0), (half * 0.3, 1.0, 1.0), (half * 0.7, 0.72, 0.95), (half * 0.92, 0.32, 0.9), (half, 0.05, 0.85)]
    sections = [(z, beam / 2 * width, depth * drop, deck_up) for z, width, drop in stations]
    shell = loft(f"{name}_hull", sections, materials["clay"], sides=40, axis="forward",
                 keep_face=lambda cx, cu, cf: cu <= deck_up + 0.01)
    outline = [(beam / 2 * width, z) for z, width, _ in stations] + [(-beam / 2 * width, z) for z, width, _ in reversed(stations)]
    deck = slab(f"{name}_deck", outline, 0.3, materials["frame"], center=(0, deck_up, 0), round_by=0.05)
    boot = loft(f"{name}_waterline", [(z, beam / 2 * width + 0.03, depth * drop * 0.55 + 0.03, deck_up) for z, width, drop in stations],
                materials["dark"], sides=40, axis="forward", keep_face=lambda cx, cu, cf: cu < deck_up - depth * 0.62)
    return [shell, deck, boot], stations


def recovery_boat(name, materials):
    """62 m x 14 m supply vessel: forward superstructure four decks high, bridge glass, mast with radar,
    twin funnels, long open aft deck with bulwarks, deck crane and a stern A-frame node (pivot at its feet)."""
    group = root(name)
    deck_up = 4.5
    parts, stations = hull(name, 62.0, 14.0, 6.0, materials, deck_up)
    # Raised forecastle over the fore half; the deckhouse stands on it, close to the bow.
    fore = [(z, width) for z, width, _ in stations if z >= 6.0]
    fore.insert(0, (6.0, 1.0))
    outline = [(7.0 * width, z) for z, width in fore] + [(-7.0 * width, z) for z, width in reversed(fore)]
    parts.append(slab(f"{name}_forecastle", outline, 2.8, materials["clay"], center=(0, deck_up + 1.4, 0), round_by=0.12))
    parts.append(box(f"{name}_forecastle_face", (13.6, 2.6, 0.3), (0, deck_up + 1.4, 6.0), materials["frame"], round_by=0.05))
    for sign in (-1, 1):
        parts.append(box(f"{name}_bulwark{sign}", (0.25, 1.2, 36.0), (sign * 6.85, deck_up + 0.6, -10.0), materials["clay"], round_by=0.05))
    for level in range(4):
        width = 12.0 - level * 0.8
        length = 12.0 - level * 1.4
        parts.append(box(f"{name}_deck_house{level}", (width, 2.8, length), (0, deck_up + 4.2 + level * 2.9, 14.5 + level * 0.4), materials["clay"], round_by=0.2))
        for side in (-1, 1):
            parts.append(box(f"{name}_portholes{level}{side}", (0.08, 0.7, length * 0.75), (side * (width / 2 + 0.02), deck_up + 4.4 + level * 2.9, 14.5 + level * 0.4), materials["glass"], round_by=0.02))
    bridge_up = deck_up + 4.2 + 3 * 2.9
    parts.append(box(f"{name}_bridge_glass", (10.2, 1.1, 0.12), (0, bridge_up + 0.3, 14.5 + 1.2 + 3.7), materials["glass"], round_by=0.03))
    parts.append(box(f"{name}_bridge_wings", (14.0, 0.3, 2.0), (0, bridge_up + 1.3, 16.8), materials["frame"], round_by=0.05))
    parts.append(box(f"{name}_aft_bridge_glass", (8.0, 1.0, 0.12), (0, bridge_up + 0.3, 14.5 + 1.2 - 3.5), materials["glass"], round_by=0.03))
    parts += truss_beam(f"{name}_mast", (0, bridge_up + 1.4, 14.5), (0, bridge_up + 9.0, 14.5), 1.0, 1.0, materials["frame"], panels=4, chord=0.08, web=0.04)
    parts.append(box(f"{name}_radar", (3.2, 0.2, 0.4), (0, bridge_up + 9.4, 14.5), materials["dark"], round_by=0.05))
    parts.append(sphere(f"{name}_dome", 0.6, (1.4, bridge_up + 7.0, 14.5), materials["clay"], segments=12))
    parts.append(lamp(f"{name}_masthead", (0, bridge_up + 9.9, 14.5), materials["glow_white"], radius=0.18))
    for sign in (-1, 1):
        parts.append(box(f"{name}_funnel{sign}", (1.2, 4.0, 2.2), (sign * 4.6, deck_up + 4.8 + 2 * 2.9, 9.8), materials["clay"], round_by=0.25))
        parts.append(lamp(f"{name}_side_light{sign}", (sign * 7.0, bridge_up + 1.6, 16.8), materials["glow_red"] if sign < 0 else materials["glow_white"], radius=0.14))
    parts.append(cylinder(f"{name}_crane_post", 0.6, 4.0, (5.0, deck_up + 2.0, 2.0), materials["clay"], sides=12))
    parts.append(rod(f"{name}_crane_jib", (5.0, deck_up + 4.0, 2.0), (2.0, deck_up + 7.5, -8.0), 0.3, materials["frame"], sides=6))
    for index in range(6):
        parts.append(box(f"{name}_bollard{index}", (0.4, 0.6, 0.4), ((-1) ** index * 6.2, deck_up + 0.3, -28.0 + index * 3.0), materials["dark"], round_by=0.08))
    parts.append(box(f"{name}_landing_frame", (8.0, 0.3, 8.0), (0, deck_up + 0.3, -12.0), materials["dark"], round_by=0.05))
    combine(f"{name}_body", parts, parent=group)
    feet = (0, deck_up, -29.0)
    frame = [rod(f"{name}_aframe_leg{sign}", (sign * 4.5, deck_up, -29.0), (sign * 2.5, deck_up + 9.0, -30.0), 0.35, materials["clay"], sides=8) for sign in (-1, 1)]
    frame.append(box(f"{name}_aframe_top", (6.0, 0.8, 0.8), (0, deck_up + 9.0, -30.0), materials["clay"], round_by=0.15))
    frame.append(cylinder(f"{name}_aframe_sheave", 0.5, 0.4, (0, deck_up + 8.3, -30.6), materials["steel"], axis="x", sides=12))
    combine(f"{name}_aframe", frame, origin=feet, parent=group)
    return group


def range_boat(name, materials):
    """14 m range-safety patrol boat: deep-V hull, cabin with glass, mast and blue-free amber beacon."""
    group = root(name)
    deck_up = 1.4
    parts, _ = hull(name, 14.0, 4.2, 1.6, materials, deck_up)
    parts += [box(f"{name}_cabin", (3.0, 1.9, 4.5), (0, deck_up + 0.95, 1.0), materials["clay"], round_by=0.2),
              box(f"{name}_glass", (3.02, 0.7, 4.0), (0, deck_up + 1.4, 1.2), materials["glass"], round_by=0.05),
              cylinder(f"{name}_mast", 0.06, 2.2, (0, deck_up + 3.0, 0.4), materials["steel"], sides=6),
              lamp(f"{name}_beacon", (0, deck_up + 4.1, 0.4), materials["glow_amber"], radius=0.14)]
    parts += railing(f"{name}_rail", [(-1.9, deck_up, -6.0), (-1.9, deck_up, 4.0), (0, deck_up, 6.5), (1.9, deck_up, 4.0), (1.9, deck_up, -6.0)], 0.9, materials["frame"], post_spacing=1.5)
    combine(f"{name}_body", parts, parent=group)
    return group


def buoy(name, materials):
    group = root(name)
    parts = [cylinder(f"{name}_float", 1.2, 1.4, (0, 0.2, 0), materials["clay"], sides=20, round_by=0.25),
             cylinder(f"{name}_tower", 0.5, 2.6, (0, 2.0, 0), materials["frame"], sides=6, radius_end=0.3),
             box(f"{name}_topmark", (0.9, 0.9, 0.1), (0, 3.7, 0), materials["dark"], round_by=0.05),
             lamp(f"{name}_light", (0, 4.3, 0), materials["glow_amber"], radius=0.16)]
    combine(f"{name}_body", parts, parent=group)
    return group


def build_marine():
    reset_scene()
    materials = palette()
    recovery_boat("recovery_boat", materials)
    range_boat("range_boat", materials)
    buoy("buoy", materials)
    export("marine.glb")


# --- props ----------------------------------------------------------------------------------------

def checkpoint(name, materials):
    """Road closure checkpoint: booth, canopy, barrier arm node (pivot at the post, swings up about z),
    signage plate, jersey barriers and an amber flasher."""
    group = root(name)
    parts = [box(f"{name}_booth", (2.6, 2.6, 2.6), (-5.5, 1.3, 0), materials["clay"], round_by=0.15),
             box(f"{name}_booth_glass", (2.62, 1.0, 2.0), (-5.5, 1.75, 0), materials["glass"], round_by=0.05),
             box(f"{name}_canopy", (7.0, 0.35, 5.0), (-3.0, 4.4, 0), materials["clay"], round_by=0.1),
             box(f"{name}_island", (3.4, 0.2, 4.0), (-5.5, 0.1, 0), materials["concrete"], round_by=0.05),
             box(f"{name}_post", (0.5, 1.1, 0.5), (-3.6, 0.55, 1.6), materials["frame"], round_by=0.05),
             cylinder(f"{name}_sign_pole", 0.07, 3.0, (4.5, 1.5, 2.5), materials["steel"], sides=8),
             box(f"{name}_sign_plate", (1.6, 1.2, 0.08), (4.5, 2.6, 2.5), materials["frame"], round_by=0.04),
             lamp(f"{name}_flasher", (4.5, 3.4, 2.5), materials["glow_amber"], radius=0.15),
             lamp(f"{name}_canopy_light", (-3.0, 4.15, 0), materials["glow_white"], radius=0.2)]
    for pillar in (-1, 1):
        parts.append(box(f"{name}_pillar{pillar}", (0.35, 4.3, 0.35), (-3.0 + pillar * 3.2, 2.15, -2.2), materials["frame"], round_by=0.05))
    for index in range(4):
        parts.append(jersey_shape(f"{name}_barrier{index}", (1.0 + index * 3.1, 0, -4.0), materials))
    combine(f"{name}_body", parts, parent=group)
    hinge = (-3.6, 1.0, 1.6)
    arm = [box(f"{name}_arm_beam", (6.5, 0.14, 0.14), (-3.6 + 3.4, 1.0, 1.6), materials["clay"], round_by=0.03)]
    for stripe in range(5):
        arm.append(box(f"{name}_arm_band{stripe}", (0.5, 0.16, 0.16), (-3.6 + 1.0 + stripe * 1.2, 1.0, 1.6), materials["dark"], round_by=0.02))
    arm.append(lamp(f"{name}_arm_light", (-3.6 + 6.5, 1.12, 1.6), materials["glow_red"], radius=0.07))
    combine(f"{name}_barrier_arm", arm, origin=hinge, parent=group)
    return group


def jersey_shape(name, base, materials):
    x, up, forward = base
    profile = [(-0.3, 0), (0.3, 0), (0.3, 0.08), (0.12, 0.3), (0.1, 0.82), (-0.1, 0.82), (-0.12, 0.3), (-0.3, 0.08)]
    # The profile is drawn in (forward, up); the 3 m length runs along x.
    return slab(name, [(forward + across, up + height) for across, height in profile], 3.0, materials["concrete"], plane="side", center=(x, 0, 0), round_by=0.03)


def jersey_barrier(name, materials):
    group = root(name)
    combine(f"{name}_body", [jersey_shape(f"{name}_piece", (0, 0, 0), materials)], parent=group)
    return group


def weather_tower(name, materials):
    """Three-leg lattice tower 30 m tapering 3 m to 0.9 m, platform, radome, anemometer booms, beacon."""
    group = root(name)
    height = 30.0
    parts = []
    legs = [(math.radians(a)) for a in (0, 120, 240)]
    def corner(angle, up):
        radius = 1.75 - 1.2 * up / height
        return around(radius, angle, up)
    for index, angle in enumerate(legs):
        parts.append(rod(f"{name}_leg{index}", corner(angle, 0), corner(angle, height), 0.09, materials["frame"], sides=6))
        parts.append(box(f"{name}_footing{index}", (0.8, 0.5, 0.8), (corner(angle, 0)[0], 0.25, corner(angle, 0)[2]), materials["concrete"], round_by=0.05))
    for bay_index in range(10):
        low = bay_index * 3.0
        high = low + 3.0
        for index, angle in enumerate(legs):
            following = legs[(index + 1) % 3]
            parts.append(rod(f"{name}_h{bay_index}{index}", corner(angle, high), corner(following, high), 0.04, materials["frame"]))
            parts.append(rod(f"{name}_d{bay_index}{index}", corner(angle, low), corner(following, high), 0.035, materials["frame"]))
    parts.append(cylinder(f"{name}_platform", 1.6, 0.15, (0, height, 0), materials["frame"], sides=20))
    parts.append(sphere(f"{name}_radome", 2.0, (0, height + 2.1, 0), materials["clay"], segments=24))
    for sign in (-1, 1):
        parts.append(rod(f"{name}_boom{sign}", (0, 18.0, 0), (sign * 3.2, 18.0, 0), 0.04, materials["steel"]))
        parts.append(cylinder(f"{name}_cups{sign}", 0.25, 0.2, (sign * 3.2, 18.3, 0), materials["dark"], sides=10))
    parts.append(lamp(f"{name}_beacon", (0, height + 4.3, 0), materials["glow_red"], radius=0.2))
    parts += ladder(f"{name}_ladder", (0, 0, 1.0), height - 0.5, materials["frame"], cage=False)
    combine(f"{name}_body", parts, parent=group)
    return group


def camera_mast(name, materials):
    """20 m tapered pole with a sealed camera housing (pivot node `_head` pans about up), solar panel, cabinet."""
    group = root(name)
    parts = [cylinder(f"{name}_pole", 0.25, 20.0, (0, 10.0, 0), materials["clay"], sides=12, radius_end=0.12),
             box(f"{name}_base", (1.2, 0.5, 1.2), (0, 0.25, 0), materials["concrete"], round_by=0.05),
             box(f"{name}_cabinet", (0.8, 1.2, 0.5), (0, 1.1, 0.5), materials["clay"], round_by=0.06),
             box(f"{name}_solar", (1.6, 0.06, 1.0), (0, 6.0, -0.6), materials["glass"], round_by=0.02)]
    combine(f"{name}_body", parts, parent=group)
    head = [box(f"{name}_housing", (0.5, 0.45, 1.0), (0, 20.4, 0.2), materials["clay"], round_by=0.08),
            box(f"{name}_sunshade", (0.62, 0.05, 1.2), (0, 20.66, 0.25), materials["frame"], round_by=0.02),
            cylinder(f"{name}_lens", 0.16, 0.1, (0, 20.4, 0.74), materials["glass"], axis="forward", sides=14),
            lamp(f"{name}_tally", (0.2, 20.7, 0.6), materials["glow_red"], radius=0.05)]
    combine(f"{name}_head", head, origin=(0, 20.1, 0), parent=group)
    return group


def light_pole(name, materials):
    group = root(name)
    parts = [cylinder(f"{name}_pole", 0.3, 25.0, (0, 12.5, 0), materials["clay"], sides=12, radius_end=0.15),
             box(f"{name}_crossbar", (3.0, 0.2, 0.2), (0, 24.6, 0), materials["frame"], round_by=0.03),
             box(f"{name}_base", (1.0, 0.6, 1.0), (0, 0.3, 0), materials["concrete"], round_by=0.05)]
    for index in range(4):
        x = -1.2 + index * 0.8
        parts.append(box(f"{name}_head{index}", (0.6, 0.15, 0.45), (x, 24.4, 0.2), materials["frame"], round_by=0.03))
        parts.append(box(f"{name}_lens{index}", (0.5, 0.04, 0.38), (x, 24.31, 0.2), materials["glow_white"], round_by=0.01))
    combine(f"{name}_body", parts, parent=group)
    return group


def fence_panel(name, materials):
    group = root(name)
    parts = []
    for index in range(2):
        parts.append(cylinder(f"{name}_post{index}", 0.04, 2.4, (-1.5 + index * 3.0, 1.2, 0), materials["steel"], sides=8))
    parts.append(box(f"{name}_mesh", (3.0, 2.0, 0.02), (0, 1.15, 0), materials["frame"], round_by=0.0))
    parts.append(rod(f"{name}_top_rail", (-1.5, 2.2, 0), (1.5, 2.2, 0), 0.025, materials["steel"]))
    combine(f"{name}_body", parts, parent=group)
    return group


def build_props():
    reset_scene()
    materials = palette()
    checkpoint("checkpoint", materials)
    weather_tower("weather_tower", materials)
    camera_mast("camera_mast", materials)
    light_pole("light_pole", materials)
    jersey_barrier("jersey_barrier", materials)
    fence_panel("fence_panel", materials)
    export("props.glb")
