# Builds every Orglet Office asset procedurally and exports four GLBs to public/assets/.
# Run headless:  blender --background --factory-startup --python blender/build_office.py
# Conventions (app frame): y up, an asset's front (where a person stands or looks from) faces +z,
# floor-standing assets have their origin on the floor they stand on.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402
from common import (baked_image, blob, cylinder, empty, export_glb, leaf, material, merge_by_material,  # noqa: E402
                    rounded_box, seeded, sphere, value_noise)

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(PROJECT, 'public', 'assets')
TEXTURES = os.path.join(PROJECT, 'blender', 'build', 'textures')

BRAND = '#6d4aff'
BOOK_COLORS = ['#6d4aff', '#2f9bea', '#f08a3c', '#17a673', '#e2557a', '#b8bfd3', '#f4c84a']
LEAF_COLORS = ['#5fbf7f', '#72cc8f', '#4fae73']


# ---------- textures ----------

def wood_pixel(u, v):
    # Quiet, mostly straight grain running along u: a gentle warp, thin late-wood lines and fine streaks.
    warp = value_noise(u * 2, v * 6, seed=3, period=6) * 1.2
    grain = 0.5 + 0.5 * math.sin((v * 22 + warp) * math.pi)
    lines = grain ** 8
    streaks = value_noise(u * 4, v * 96, seed=5, period=96)
    shade = 0.92 - 0.06 * lines + 0.04 * streaks
    return (0.96 * shade, 0.88 * shade, 0.76 * shade)


def floor_pixel(u, v):
    # A carpet tile: soft speckle, faint tufted rows, slightly darker at the tile edge.
    speckle = value_noise(u * 96, v * 96, seed=11, period=96) * 0.06
    rows = 0.012 * math.sin(v * math.pi * 48)
    edge_distance = min(u, 1 - u, v, 1 - v)
    edge = 0.03 * max(0.0, 1 - edge_distance / 0.03)
    shade = 0.93 + speckle + rows - edge
    return (shade, shade, shade)


def fabric_pixel(u, v):
    weave = 0.5 + 0.5 * math.sin(u * math.pi * 128) * math.sin(v * math.pi * 128)
    fluff = value_noise(u * 48, v * 48, seed=7, period=48)
    shade = 0.82 + 0.1 * weave + 0.08 * fluff
    return (0.36 * shade, 0.38 * shade, 0.47 * shade)


class Materials:
    def __init__(self):
        wood_image = baked_image('wood', 256, wood_pixel, TEXTURES)
        floor_image = baked_image('carpet_tile', 128, floor_pixel, TEXTURES)
        fabric_image = baked_image('fabric', 128, fabric_pixel, TEXTURES)
        self.wood = material('Wood', '#ffffff', roughness=0.55, image=wood_image)
        self.fabric = material('Fabric', '#ffffff', roughness=0.95, image=fabric_image)
        # Tint_ materials are white here; the app multiplies them by a per-instance or per-orglet colour.
        self.floor = material('Tint_Floor', '#ffffff', roughness=0.92, image=floor_image)
        self.screen = material('Tint_Screen', '#ffffff', roughness=0.2, emission='#ffffff', emission_strength=1.0)
        self.shell = material('Tint_Shell', '#ffffff', roughness=0.38)
        self.glow = material('Tint_Glow', '#ffffff', roughness=0.3, emission='#ffffff', emission_strength=2.0)
        self.laminate = material('Laminate', '#f6f7fb', roughness=0.45)
        self.paint = material('WallPaint', '#f7f8fc', roughness=0.88)
        self.baseboard = material('Baseboard', '#c9cede', roughness=0.55)
        self.trim = material('Trim', '#e4e7f0', roughness=0.5)
        self.metal = material('MetalLight', '#c3c9d8', roughness=0.32, metallic=0.85)
        self.metal_dark = material('MetalDark', '#3a3f52', roughness=0.4, metallic=0.5)
        self.plastic_dark = material('PlasticDark', '#2a2d3a', roughness=0.38)
        self.rubber = material('Rubber', '#23252f', roughness=0.9)
        self.visor = material('Visor', '#1d2030', roughness=0.12, metallic=0.2)
        self.face = material('FaceWhite', '#fbfbff', roughness=0.32)
        self.brand = material('Brand', BRAND, roughness=0.45)
        self.brand_glow = material('BrandGlow', BRAND, roughness=0.4, emission=BRAND, emission_strength=0.6)
        self.green_glow = material('GreenGlow', '#2fd08a', roughness=0.3, emission='#2fd08a', emission_strength=1.4)
        self.red_glow = material('RedGlow', '#ff6b7d', roughness=0.3, emission='#ff6b7d', emission_strength=1.4)
        self.grey_glow = material('GreyGlow', '#c9cede', roughness=0.3, emission='#c9cede', emission_strength=0.9)
        self.panel_glow = material('PanelGlow', '#efeaff', roughness=0.2, emission='#efeaff', emission_strength=1.1)
        self.warm_glow = material('WarmGlow', '#fff1d6', roughness=0.2, emission='#fff1d6', emission_strength=2.0)
        self.lamp = material('Lamp', '#2fd08a', roughness=0.3, emission='#2fd08a', emission_strength=1.2)
        self.rack_light = material('RackLight', '#4cf0a0', roughness=0.3, emission='#4cf0a0', emission_strength=1.0)
        self.glass = material('ScreenDark', '#1f2230', roughness=0.2)
        self.ceramic = material('Ceramic', '#ffffff', roughness=0.3)
        self.terracotta = material('Terracotta', '#d98b6a', roughness=0.8)
        self.soil = material('Soil', '#6b5443', roughness=1.0)
        self.bark = material('Bark', '#b49a7c', roughness=0.9)
        self.rug = material('Rug', '#d9d2ff', roughness=1.0)
        self.tile_tint = material('TileTint', '#dcd5ff', roughness=0.6)
        self.tile_plain = material('TilePlain', '#eef0f6', roughness=0.6)
        self.paper = material('Paper', '#ffffff', roughness=0.7)
        # The routines board faces away from the main light, so its face, frame and tiles carry a soft glow of their own.
        self.board_frame = material('BoardFrame', '#dfe3ee', roughness=0.35, metallic=0.3, emission='#dfe3ee', emission_strength=0.5)
        self.board_face = material('BoardFace', '#ffffff', roughness=0.7, emission='#ffffff', emission_strength=0.55)
        self.board_tile_tint = material('BoardTileTint', '#cfc5ff', roughness=0.6, emission='#cfc5ff', emission_strength=0.6)
        self.board_tile_plain = material('BoardTilePlain', '#f2f4fa', roughness=0.6, emission='#f2f4fa', emission_strength=0.5)
        self.leaves = [material(f'Leaf{index}', color, roughness=0.75, double_sided=True)
                       for index, color in enumerate(LEAF_COLORS)]
        self.books = [material(f'Book{index}', color, roughness=0.6) for index, color in enumerate(BOOK_COLORS)]


# ---------- furniture ----------

DESK_TOP = 0.66   # desk surface above the floor
DESK_DEPTH = 0.75


def build_desk(materials, name, width, variant):
    root = empty(name)
    if variant == 'a':
        rounded_box('top', (width, 0.06, DESK_DEPTH), 0.022, materials.wood, (0, DESK_TOP - 0.03, 0), parent=root)
        for side in (-1, 1):
            leg_x = side * (width / 2 - 0.08)
            rounded_box('side', (0.05, DESK_TOP - 0.07, 0.62), 0.018, materials.metal, (leg_x, (DESK_TOP - 0.06) / 2 + 0.02, 0), parent=root)
            rounded_box('foot', (0.08, 0.035, 0.7), 0.015, materials.metal_dark, (leg_x, 0.0175, 0), parent=root)
        rounded_box('modesty', (width - 0.22, 0.3, 0.02), 0.008, materials.laminate, (0, 0.44, -0.3), parent=root)
        cylinder('grommet', 0.035, 0.035, 0.01, materials.plastic_dark, (-width / 2 + 0.22, DESK_TOP, -0.26), parent=root)
    else:
        rounded_box('top', (width, 0.045, DESK_DEPTH), 0.016, materials.laminate, (0, DESK_TOP - 0.0225, 0), parent=root)
        rounded_box('edge', (width - 0.02, 0.03, DESK_DEPTH - 0.02), 0.01, materials.wood, (0, DESK_TOP - 0.06, 0), parent=root)
        for side_x in (-1, 1):
            for side_z in (-1, 1):
                leg_position = (side_x * (width / 2 - 0.07), (DESK_TOP - 0.075) / 2 + 0.02, side_z * 0.3)
                cylinder('leg', 0.024, 0.02, DESK_TOP - 0.075, materials.metal_dark, leg_position, parent=root, segments=16)
                cylinder('leveler', 0.032, 0.032, 0.02, materials.rubber, (leg_position[0], 0.01, leg_position[2]), parent=root, segments=16, bevel=0.005)
        pedestal_x = width / 2 - 0.33
        rounded_box('pedestal', (0.4, 0.46, 0.6), 0.02, materials.laminate, (pedestal_x, 0.38, -0.02), parent=root)
        for drawer in range(3):
            drawer_y = 0.22 + drawer * 0.145
            rounded_box('drawer', (0.36, 0.13, 0.02), 0.01, materials.trim, (pedestal_x, drawer_y, 0.285), parent=root)
            cylinder('handle', 0.008, 0.008, 0.16, materials.metal, (pedestal_x, drawer_y + 0.03, 0.305), (0, 0, math.pi / 2), parent=root, segments=10)
    merge_by_material(root)
    return root


def build_lead_desk(materials):
    width = 6.4
    root = empty('lead_desk')
    rounded_box('top', (width, 0.07, 0.9), 0.028, materials.wood, (0, DESK_TOP - 0.035, 0), parent=root)
    for side in (-1, 1):
        pedestal_x = side * (width / 2 - 0.35)
        rounded_box('pedestal', (0.6, DESK_TOP - 0.07, 0.8), 0.025, materials.laminate, (pedestal_x, (DESK_TOP - 0.07) / 2, 0), parent=root)
        for drawer in range(3):
            drawer_y = 0.1 + drawer * 0.17 + 0.085
            rounded_box('drawer', (0.54, 0.15, 0.02), 0.01, materials.trim, (pedestal_x, drawer_y, 0.405), parent=root)
            cylinder('handle', 0.009, 0.009, 0.22, materials.metal, (pedestal_x, drawer_y + 0.035, 0.425), (0, 0, math.pi / 2), parent=root, segments=10)
    # The visitor side faces away from the lead; it carries a quiet brand-colour strip, no logo.
    rounded_box('front_panel', (width - 1.5, 0.42, 0.03), 0.012, materials.laminate, (0, 0.38, -0.4), parent=root)
    rounded_box('brand_strip', (width - 1.5, 0.05, 0.035), 0.012, materials.brand, (0, 0.52, -0.405), parent=root)
    rounded_box('beam', (width - 1.3, 0.05, 0.05), 0.012, materials.metal_dark, (0, DESK_TOP - 0.1, 0.1), parent=root)
    # Desk lamp, pen cup, a closed notebook and a blank name plate.
    lamp_x = width / 2 - 0.45
    cylinder('lamp_base', 0.09, 0.1, 0.025, materials.metal_dark, (lamp_x, DESK_TOP + 0.0125, -0.22), parent=root, bevel=0.006)
    cylinder('lamp_arm', 0.012, 0.012, 0.38, materials.metal, (lamp_x, DESK_TOP + 0.2, -0.2), (0.35, 0, 0), parent=root, segments=10)
    cylinder('lamp_head', 0.07, 0.03, 0.11, materials.metal_dark, (lamp_x, DESK_TOP + 0.37, -0.1), (2.3, 0, 0), parent=root, bevel=0.005)
    sphere('lamp_bulb', 0.035, materials.warm_glow, (lamp_x, DESK_TOP + 0.34, -0.06), parent=root, segments=12)
    cylinder('pen_cup', 0.045, 0.045, 0.11, materials.brand, (-width / 2 + 0.4, DESK_TOP + 0.055, -0.22), parent=root, bevel=0.006)
    for pen_index, tilt in enumerate((-0.15, 0.05, 0.2)):
        cylinder('pen', 0.006, 0.006, 0.16, materials.books[pen_index + 1], (-width / 2 + 0.4 + tilt * 0.08, DESK_TOP + 0.15, -0.22), (tilt, 0, tilt), parent=root, segments=8)
    rounded_box('notebook', (0.3, 0.025, 0.22), 0.01, materials.books[3], (1.3, DESK_TOP + 0.0125, 0.05), (0, 0.2, 0), parent=root)
    rounded_box('name_plate', (0.36, 0.08, 0.05), 0.01, materials.metal, (-0.9, DESK_TOP + 0.04, -0.3), (-0.3, 0, 0), parent=root)
    merge_by_material(root)
    return root


def build_chair(materials, name, variant):
    """Origin on the floor under the seat. The sitter faces -z; the backrest is at +z."""
    root = empty(name)
    rounded_box('seat', (0.5, 0.1, 0.48), 0.045, materials.fabric, (0, 0.32, 0), parent=root)
    rounded_box('seat_shell', (0.46, 0.03, 0.44), 0.012, materials.plastic_dark, (0, 0.26, 0), parent=root)
    back_height = 0.46 if variant == 'a' else 0.52
    rounded_box('back', (0.48, back_height, 0.08), 0.04, materials.fabric, (0, 0.38 + back_height / 2 + 0.02, 0.23), (0.12, 0, 0), parent=root)
    rounded_box('spine', (0.07, 0.32, 0.03), 0.012, materials.metal_dark, (0, 0.38, 0.25), parent=root)
    cylinder('gas_lift', 0.028, 0.028, 0.18, materials.metal, (0, 0.17, 0), parent=root, segments=16)
    cylinder('hub', 0.06, 0.05, 0.05, materials.plastic_dark, (0, 0.085, 0), parent=root, segments=16, bevel=0.01)
    for arm_index in range(5):
        angle = arm_index * math.tau / 5 + 0.3
        direction = (math.sin(angle), math.cos(angle))
        rounded_box('star_arm', (0.05, 0.035, 0.3), 0.014, materials.plastic_dark, (direction[0] * 0.15, 0.07, direction[1] * 0.15), (0, angle, 0), parent=root)
        sphere('caster', 0.032, materials.rubber, (direction[0] * 0.29, 0.032, direction[1] * 0.29), (0.8, 1, 1.2), parent=root, segments=12, rotation=(0, angle, 0))
    if variant == 'b':
        for side in (-1, 1):
            rounded_box('armrest_post', (0.035, 0.18, 0.04), 0.012, materials.plastic_dark, (side * 0.44, 0.44, 0.05), parent=root)
            rounded_box('armrest_pad', (0.07, 0.035, 0.26), 0.016, materials.plastic_dark, (side * 0.44, 0.53, 0.03), parent=root)
        rounded_box('headrest', (0.3, 0.1, 0.06), 0.03, materials.fabric, (0, 0.98, 0.31), (0.12, 0, 0), parent=root)
    merge_by_material(root)
    return root


def build_monitor(materials, name, variant):
    """Origin on the desk surface under the screen; the screen faces +z and its centre is 0.24 up."""
    root = empty(name)
    if variant == 'a':
        cylinder('base', 0.1, 0.11, 0.014, materials.metal, (0, 0.007, -0.02), parent=root, segments=28, bevel=0.004)
        rounded_box('neck', (0.045, 0.2, 0.025), 0.01, materials.metal, (0, 0.11, -0.05), (-0.08, 0, 0), parent=root)
        rounded_box('housing', (0.7, 0.45, 0.035), 0.014, materials.plastic_dark, (0, 0.24, 0), parent=root)
        rounded_box('back_bulge', (0.32, 0.22, 0.04), 0.03, materials.plastic_dark, (0, 0.23, -0.03), parent=root)
        rounded_box('Screen', (0.64, 0.38, 0.004), 0.0, materials.screen, (0, 0.25, 0.018), parent=root)
    else:
        rounded_box('base', (0.24, 0.014, 0.16), 0.006, materials.metal_dark, (0, 0.007, -0.03), parent=root)
        cylinder('post', 0.018, 0.018, 0.22, materials.metal, (0, 0.12, -0.06), parent=root, segments=12)
        rounded_box('housing', (0.66, 0.42, 0.03), 0.01, materials.plastic_dark, (0, 0.25, -0.03), parent=root)
        rounded_box('chin', (0.66, 0.035, 0.035), 0.012, materials.metal, (0, 0.045 + 0.0, -0.03), parent=root)
        rounded_box('Screen', (0.62, 0.37, 0.004), 0.0, materials.screen, (0, 0.255, -0.013), parent=root)
    sphere('power_led', 0.006, materials.green_glow, (0.3, 0.04 if variant == 'a' else 0.05, 0.02 if variant == 'a' else -0.01), parent=root, segments=8)
    merge_by_material(root)
    return root


def build_kiosk(materials, name, variant):
    """An approval station: the orglet stands at +z and reads the tilted panel. The Lamp turns amber while it waits."""
    root = empty(name)
    rounded_box('plinth', (0.72, 0.08, 0.62), 0.03, materials.laminate, (0, 0.04, 0), parent=root)
    for corner_x in (-1, 1):
        for corner_z in (-1, 1):
            cylinder('bolt', 0.016, 0.016, 0.012, materials.metal, (corner_x * 0.3, 0.085, corner_z * 0.25), parent=root, segments=10, bevel=0.003)
    if variant == 'a':
        rounded_box('body', (0.5, 0.92, 0.4), 0.08, materials.laminate, (0, 0.54, 0), parent=root)
        for seam_x in (-0.16, 0.16):
            rounded_box('seam', (0.012, 0.66, 0.006), 0.003, materials.baseboard, (seam_x, 0.5, 0.2), parent=root)
    else:
        cylinder('body', 0.24, 0.2, 0.92, materials.laminate, (0, 0.54, 0), parent=root, segments=32, bevel=0.02)
        rounded_box('card_slot', (0.2, 0.02, 0.02), 0.008, materials.plastic_dark, (0, 0.72, 0.205), parent=root)
    rounded_box('sign_plate', (0.28, 0.1, 0.012), 0.008, materials.metal, (0, 0.82, 0.215 if variant == 'a' else 0.215), parent=root)
    rounded_box('sign_mark', (0.06, 0.06, 0.004), 0.002, materials.brand_glow, (-0.08, 0.82, 0.223), parent=root)
    head = empty('head', (0, 1.06, 0.06), (-0.75, 0, 0), parent=root)
    rounded_box('housing', (0.66, 0.5, 0.08), 0.035, materials.trim, parent=head)
    rounded_box('panel', (0.56, 0.32, 0.004), 0.0, materials.panel_glow, (0, 0.03, 0.041), parent=head)
    # The held action as the panel shows it: a title bar, two text lines and a tool chip.
    rounded_box('panel_title', (0.3, 0.035, 0.003), 0.008, materials.brand_glow, (-0.1, 0.14, 0.044), parent=head)
    for line_index, line_width in enumerate((0.44, 0.32)):
        rounded_box('panel_line', (line_width, 0.022, 0.003), 0.006, materials.grey_glow, (-0.25 + line_width / 2, 0.07 - line_index * 0.05, 0.044), parent=head)
    rounded_box('panel_chip', (0.12, 0.04, 0.003), 0.01, materials.tile_tint, (-0.19, -0.05, 0.044), parent=head)
    rounded_box('allow_button', (0.2, 0.06, 0.03), 0.012, materials.green_glow, (-0.13, -0.17, 0.045), parent=head)
    rounded_box('refuse_button', (0.2, 0.06, 0.03), 0.012, materials.red_glow, (0.13, -0.17, 0.045), parent=head)
    cylinder('lamp_post', 0.014, 0.014, 0.4, materials.metal, (0, 1.32, -0.12), parent=root, segments=10)
    sphere(f'{name}_Lamp', 0.09, materials.lamp, (0, 1.56, -0.12), parent=root, segments=20)
    merge_by_material(root, keep_names=(f'{name}_Lamp',))
    return root


def build_routines_board(materials):
    """Origin at the board centre. Legs (shown only when it stands free) reach the floor 1.44 below at scale 1."""
    root = empty('routines_board')
    rounded_box('frame', (3.5, 1.5, 0.06), 0.025, materials.board_frame, parent=root)
    rounded_box('face', (3.4, 1.4, 0.03), 0.01, materials.board_face, (0, 0, 0.02), parent=root)
    rounded_box('header', (3.4, 0.1, 0.034), 0.01, materials.brand, (0, 0.62, 0.02), parent=root)
    for index in range(14):
        tile_position = (-1.35 + (index % 7) * 0.45, 0.25 - (index // 7) * 0.5, 0.045)
        if index == 9:
            continue
        tile_material = materials.board_tile_tint if index % 3 == 0 else materials.board_tile_plain
        rounded_box('tile', (0.36, 0.38, 0.016), 0.012, tile_material, tile_position, parent=root)
        rounded_box('tile_line', (0.24, 0.025, 0.004), 0.006, materials.baseboard, (tile_position[0] - 0.03, tile_position[1] + 0.1, 0.055), parent=root)
        sphere('pin', 0.016, materials.metal_dark, (tile_position[0], tile_position[1] + 0.17, 0.058), parent=root, segments=10)
    rounded_box('routines_GlowTile', (0.36, 0.38, 0.016), 0.012, materials.brand_glow, (-1.35 + 2 * 0.45, -0.25, 0.045), parent=root)
    legs = empty('routines_Legs', parent=root)
    for leg_x in (-1.4, 1.4):
        cylinder('post', 0.035, 0.035, 1.44, materials.metal, (leg_x, -0.72, -0.05), parent=legs, segments=12)
        rounded_box('foot', (0.08, 0.035, 0.42), 0.014, materials.metal_dark, (leg_x, -1.425, -0.05), parent=legs)
    merge_by_material(root, keep_names=('routines_GlowTile', 'routines_Legs'))
    merge_by_material(legs)
    return root


def build_review_wall(materials):
    root = empty('review_wall')
    rounded_box('frame', (3.0, 1.2, 0.08), 0.035, materials.plastic_dark, parent=root)
    rounded_box('screen', (2.84, 1.04, 0.01), 0.0, materials.glass, (0, 0, 0.042), parent=root)
    diff_rows = [('green', 0.9), ('green', 1.4), ('red', 0.7), ('grey', 1.6), ('green', 1.1), ('red', 0.5)]
    glow_for = {'green': materials.green_glow, 'red': materials.red_glow, 'grey': materials.grey_glow}
    for index, (tone, width) in enumerate(diff_rows):
        row_y = 0.42 - index * 0.17
        rounded_box('gutter', (0.1, 0.07, 0.006), 0.01, materials.grey_glow, (-1.3, row_y, 0.05), parent=root)
        rounded_box('diff', (width, 0.08, 0.006), 0.015, glow_for[tone], (-1.18 + width / 2, row_y, 0.05), parent=root)
    for bracket_x in (-1.1, 1.1):
        rounded_box('bracket', (0.12, 0.3, 0.04), 0.01, materials.metal, (bracket_x, 0, -0.06), parent=root)
    merge_by_material(root)
    return root


def build_shelf(materials):
    root = empty('shelf')
    rng = seeded(4)
    for side in (-1, 1):
        rounded_box('side', (0.04, 1.6, 0.4), 0.012, materials.laminate, (side * 0.78, 0.8, 0), parent=root)
    rounded_box('back', (1.52, 1.56, 0.02), 0.006, materials.trim, (0, 0.8, -0.19), parent=root)
    for shelf_y in (0.04, 0.6, 1.2, 1.58):
        rounded_box('board', (1.56, 0.035, 0.4), 0.01, materials.wood, (0, shelf_y, 0), parent=root)
    for shelf_y in (0.62, 1.22):
        book_x = -0.7
        while book_x < 0.6:
            book_width = rng.uniform(0.06, 0.11)
            book_height = rng.uniform(0.24, 0.34)
            lean = 0.18 if rng.random() < 0.12 else 0.0
            book_material = materials.books[rng.randrange(len(materials.books))]
            rounded_box('book', (book_width, book_height, 0.26), 0.008, book_material, (book_x + book_width / 2, shelf_y + 0.018 + book_height / 2, 0.02), (0, 0, lean), parent=root)
            book_x += book_width + 0.008 + lean * 0.2
        rounded_box('box', (0.18, 0.14, 0.24), 0.015, materials.brand, (0.62, shelf_y + 0.088, 0.02), parent=root)
    rounded_box('bookend', (0.02, 0.16, 0.12), 0.006, materials.metal_dark, (0.68, 0.1, 0.05), parent=root)
    merge_by_material(root)
    return root


def build_server_rack(materials):
    root = empty('server_rack')
    rounded_box('cabinet', (0.8, 1.66, 0.7), 0.03, materials.metal_dark, (0, 0.86, 0), parent=root)
    rounded_box('door', (0.7, 1.52, 0.02), 0.012, materials.plastic_dark, (0, 0.86, 0.345), parent=root)
    for slat in range(24):
        rounded_box('vent', (0.56, 0.012, 0.008), 0.004, materials.metal, (0, 0.28 + slat * 0.05, 0.358), parent=root)
    rounded_box('handle', (0.025, 0.3, 0.03), 0.01, materials.metal, (0.31, 0.95, 0.365), parent=root)
    cylinder('fan', 0.16, 0.16, 0.02, materials.metal, (0, 1.7, 0), parent=root, segments=24, bevel=0.004)
    for corner_x in (-1, 1):
        for corner_z in (-1, 1):
            cylinder('foot', 0.03, 0.035, 0.03, materials.rubber, (corner_x * 0.33, 0.015, corner_z * 0.28), parent=root, segments=12)
    for index in range(6):
        light_position = (-0.2 + (index % 2) * 0.4, 0.4 + (index // 2) * 0.45, 0.37)
        rounded_box(f'rack_Light_{index}', (0.12, 0.05, 0.02), 0.008, materials.rack_light, light_position, parent=root)
    merge_by_material(root, keep_names=tuple(f'rack_Light_{index}' for index in range(6)))
    return root


def build_inbox_tray(materials):
    root = empty('inbox_tray')
    rounded_box('tray', (0.6, 0.025, 0.44), 0.01, materials.brand, (0, 0.0125, 0), parent=root)
    for side in (-1, 1):
        rounded_box('lip_side', (0.02, 0.05, 0.44), 0.008, materials.brand, (side * 0.29, 0.03, 0), parent=root)
    rounded_box('lip_back', (0.6, 0.05, 0.02), 0.008, materials.brand, (0, 0.03, -0.21), parent=root)
    for index in range(4):
        card = rounded_box(f'inbox_Card_{index}', (0.46, 0.012, 0.32), 0.004, materials.paper,
                           (0.02 * index, 0.035 + index * 0.03, -0.01 * index), (0, index * 0.12, 0), parent=root)
        rounded_box('stripe', (0.3, 0.004, 0.04), 0.0, materials.brand, (-0.05, 0.007, -0.1), parent=card)
    merge_by_material(root, keep_names=tuple(f'inbox_Card_{index}' for index in range(4)))
    return root


def build_meeting_table(materials):
    root = empty('meeting_table')
    rounded_box('rug', (3.2, 0.02, 2.4), 0.01, materials.rug, (0, 0.01, 0), parent=root)
    cylinder('top', 0.66, 0.66, 0.06, materials.wood, (0, 0.6, 0), parent=root, segments=48, bevel=0.015)
    cylinder('column', 0.06, 0.09, 0.54, materials.metal, (0, 0.3, 0), parent=root, segments=20)
    cylinder('foot', 0.3, 0.34, 0.03, materials.metal_dark, (0, 0.035, 0), parent=root, segments=36, bevel=0.008)
    for angle in (0.4, 2.4, 4.4):
        stool_position = (math.cos(angle) * 1.05, 0, math.sin(angle) * 1.05)
        cylinder('stool_seat', 0.22, 0.24, 0.09, materials.brand, (stool_position[0], 0.36, stool_position[2]), parent=root, segments=28, bevel=0.03)
        cylinder('stool_leg', 0.04, 0.04, 0.3, materials.metal, (stool_position[0], 0.17, stool_position[2]), parent=root, segments=12)
        cylinder('stool_foot', 0.15, 0.16, 0.02, materials.metal_dark, (stool_position[0], 0.03, stool_position[2]), parent=root, segments=24, bevel=0.005)
    merge_by_material(root)
    return root


# ---------- room modules ----------

def build_wall(materials, name, height, detail):
    """A 1 m wall module, 0.2 thick; its finished face looks at +z. Modules tile along x."""
    root = empty(name)
    rounded_box('panel', (1.0, height, 0.2), 0.025, materials.paint, (0, height / 2, 0), parent=root)
    rounded_box('baseboard', (1.0, min(0.1, height * 0.25), 0.03), 0.008, materials.baseboard, (0, min(0.05, height * 0.125), 0.105), parent=root)
    rounded_box('cap', (1.0, 0.035, 0.24), 0.012, materials.trim, (0, height + 0.0175, 0), parent=root)
    if detail == 'art':
        rounded_box('frame', (0.5, 0.38, 0.03), 0.01, materials.wood, (0, 1.15, 0.11), parent=root)
        rounded_box('canvas', (0.42, 0.3, 0.01), 0.0, materials.paper, (0, 1.15, 0.125), parent=root)
        rounded_box('shape_a', (0.16, 0.16, 0.006), 0.04, materials.brand, (-0.08, 1.12, 0.132), parent=root)
        rounded_box('shape_b', (0.1, 0.22, 0.006), 0.02, materials.books[2], (0.1, 1.17, 0.132), parent=root)
    elif detail == 'sconce':
        rounded_box('sconce_plate', (0.12, 0.2, 0.02), 0.01, materials.metal, (0, 1.35, 0.11), parent=root)
        cylinder('sconce_shade', 0.07, 0.09, 0.12, materials.warm_glow, (0, 1.42, 0.17), parent=root, segments=20, bevel=0.005)
        rounded_box('outlet', (0.08, 0.12, 0.012), 0.006, materials.trim, (0.32, 0.3, 0.106), parent=root)
        for socket_y in (0.27, 0.33):
            cylinder('socket', 0.012, 0.012, 0.004, materials.plastic_dark, (0.32, socket_y, 0.113), (math.pi / 2, 0, 0), parent=root, segments=10)
    elif detail == 'seam':
        rounded_box('seam', (0.012, height - 0.2, 0.006), 0.003, materials.trim, (0.25, height / 2 + 0.05, 0.1), parent=root)
    merge_by_material(root)
    return root


def build_floor_tile(materials):
    root = empty('floor_tile')
    rounded_box('tile', (0.995, 0.1, 0.995), 0.012, materials.floor, (0, 0.05, 0), parent=root)
    merge_by_material(root)
    return root


# ---------- plants and trees ----------

def build_plant(materials, name, variant):
    root = empty(name)
    rng = seeded({'a': 1, 'b': 2, 'c': 3}[variant])
    if variant == 'a':
        cylinder('pot', 0.16, 0.2, 0.42, materials.ceramic, (0, 0.21, 0), parent=root, segments=28, bevel=0.02)
        cylinder('rim', 0.215, 0.215, 0.04, materials.ceramic, (0, 0.42, 0), parent=root, segments=28, bevel=0.012)
        cylinder('soil', 0.19, 0.19, 0.02, materials.soil, (0, 0.425, 0), parent=root, segments=24)
        for index in range(11):
            yaw = index * 2.4 + rng.uniform(-0.2, 0.2)
            leaf('leaf', rng.uniform(0.42, 0.6), rng.uniform(0.17, 0.22), materials.leaves[index % 3], (0, 0.43, 0), yaw, rng.uniform(0.7, 1.2), bend=0.35, parent=root)
    elif variant == 'b':
        rounded_box('planter', (0.42, 0.42, 0.42), 0.03, materials.wood, (0, 0.21, 0), parent=root)
        rounded_box('liner', (0.36, 0.02, 0.36), 0.008, materials.soil, (0, 0.425, 0), parent=root)
        cylinder('stem', 0.025, 0.03, 0.4, materials.bark, (0, 0.6, 0), parent=root, segments=10)
        blob('bush', 0.33, materials.leaves[2], (0, 0.92, 0), parent=root, seed=2, roughness=0.14)
        blob('bush_top', 0.2, materials.leaves[1], (0.05, 1.22, 0.02), parent=root, seed=5, roughness=0.14)
    else:
        cylinder('pot', 0.13, 0.17, 0.3, materials.terracotta, (0, 0.15, 0), parent=root, segments=24, bevel=0.015)
        cylinder('rim', 0.18, 0.18, 0.05, materials.terracotta, (0, 0.3, 0), parent=root, segments=24, bevel=0.012)
        cylinder('soil', 0.16, 0.16, 0.02, materials.soil, (0, 0.31, 0), parent=root, segments=20)
        for index in range(16):
            yaw = index * 2.4 + rng.uniform(-0.3, 0.3)
            leaf('blade', rng.uniform(0.45, 0.75), 0.06, materials.leaves[index % 3], (rng.uniform(-0.04, 0.04), 0.31, rng.uniform(-0.04, 0.04)), yaw, rng.uniform(1.15, 1.45), bend=0.12, parent=root)
    merge_by_material(root)
    return root


def build_tree(materials, name, variant):
    root = empty(name)
    if variant == 'a':
        cylinder('trunk', 0.13, 0.08, 1.0, materials.bark, (0, 0.5, 0), parent=root, segments=14)
        cylinder('branch', 0.05, 0.03, 0.4, materials.bark, (0.15, 0.95, 0), (0, 0, -0.7), parent=root, segments=10)
        blob('crown', 0.62, materials.leaves[1], (0, 1.45, 0), parent=root, seed=1)
        blob('crown_side', 0.42, materials.leaves[0], (0.42, 1.2, 0.12), parent=root, seed=4)
        blob('crown_back', 0.38, materials.leaves[2], (-0.32, 1.25, -0.25), parent=root, seed=7)
    elif variant == 'b':
        cylinder('trunk', 0.1, 0.06, 0.6, materials.bark, (0, 0.3, 0), parent=root, segments=12)
        for tier, (radius, tier_y) in enumerate(((0.75, 0.75), (0.58, 1.2), (0.4, 1.6), (0.22, 1.92))):
            cylinder('tier', radius, 0.04, 0.7 - tier * 0.08, materials.leaves[tier % 3], (0, tier_y, 0), (0, tier * 0.6, 0), parent=root, segments=40)
    else:
        cylinder('trunk', 0.09, 0.06, 0.7, materials.bark, (0, 0.35, 0), parent=root, segments=12)
        blob('column', 0.42, materials.leaves[0], (0, 1.45, 0), scale=(1, 2.1, 1), parent=root, seed=3, roughness=0.12)
    cylinder('root_flare', 0.2, 0.1, 0.12, materials.bark, (0, 0.06, 0), parent=root, segments=14)
    merge_by_material(root)
    return root


# ---------- the orglet ----------

def build_orglet(materials):
    """Original chunky helper: soft block body with a backpack, round-cornered head, dark visor with two lit eyes
    and a small smile, ear pods, a stub antenna and mitten hands. Limbs are separate pivots for walking,
    sitting and carrying; Tint_Shell and Tint_Glow take each orglet's colour in the app."""
    root = empty('orglet')
    body = empty('Body', parent=root)
    for side, name in ((-1, 'LegL'), (1, 'LegR')):
        hip = empty(name, (side * 0.13, 0.36, 0), parent=body)
        rounded_box('thigh', (0.17, 0.3, 0.2), 0.07, materials.metal_dark, (0, -0.14, 0), parent=hip)
        rounded_box('boot', (0.2, 0.1, 0.27), 0.045, materials.face, (0, -0.31, 0.03), parent=hip)
        rounded_box('sole', (0.2, 0.025, 0.27), 0.01, materials.rubber, (0, -0.355, 0.03), parent=hip)
        merge_by_material(hip)
    rounded_box('torso', (0.56, 0.52, 0.38), 0.15, materials.shell, (0, 0.62, 0), parent=body)
    rounded_box('belly_plate', (0.3, 0.2, 0.04), 0.03, materials.face, (0, 0.58, 0.18), parent=body)
    sphere('status_light', 0.025, materials.glow, (0.09, 0.63, 0.203), parent=body, segments=12)
    for vent in range(3):
        rounded_box('vent', (0.1, 0.012, 0.01), 0.004, materials.baseboard, (-0.05, 0.6 - vent * 0.035, 0.2), parent=body)
    cylinder('collar', 0.16, 0.18, 0.06, materials.metal, (0, 0.9, 0), parent=body, segments=24, bevel=0.01)
    rounded_box('backpack', (0.36, 0.34, 0.12), 0.05, materials.face, (0, 0.66, -0.23), parent=body)
    for slat in range(4):
        rounded_box('pack_vent', (0.22, 0.014, 0.01), 0.005, materials.baseboard, (0, 0.6 + slat * 0.04, -0.293), parent=body)
    for bolt_x in (-0.13, 0.13):
        cylinder('bolt', 0.014, 0.014, 0.01, materials.metal, (bolt_x, 0.79, -0.292), (math.pi / 2, 0, 0), parent=body, segments=10)
    for side, name in ((-1, 'ArmL'), (1, 'ArmR')):
        shoulder = empty(name, (side * 0.34, 0.8, 0), parent=body)
        sphere('shoulder', 0.09, materials.shell, parent=shoulder, segments=18)
        rounded_box('arm', (0.13, 0.28, 0.15), 0.06, materials.shell, (0, -0.15, 0), parent=shoulder)
        sphere('hand', 0.085, materials.face, (0, -0.33, 0.01), (1, 0.9, 1.05), parent=shoulder, segments=18)
        merge_by_material(shoulder)
    rounded_box('head', (0.54, 0.44, 0.46), 0.17, materials.face, (0, 1.13, 0), parent=body)
    rounded_box('visor', (0.42, 0.21, 0.06), 0.07, materials.visor, (0, 1.14, 0.205), parent=body)
    for eye_x in (-0.085, 0.085):
        sphere('eye', 0.036, materials.glow, (eye_x, 1.165, 0.237), (0.9, 1.25, 0.5), parent=body, segments=14)
    for index in range(5):
        angle = -0.7 + index * 0.35
        sphere('smile', 0.011, materials.glow, (math.sin(angle) * 0.05, 1.105 - math.cos(angle) * 0.022 + 0.022, 0.238), (1, 1, 0.5), parent=body, segments=8)
    for side in (-1, 1):
        cylinder('ear', 0.075, 0.075, 0.06, materials.shell, (side * 0.285, 1.13, 0), (0, 0, math.pi / 2), parent=body, segments=24, bevel=0.015)
        cylinder('ear_ring', 0.045, 0.045, 0.02, materials.metal, (side * 0.32, 1.13, 0), (0, 0, math.pi / 2), parent=body, segments=20)
    cylinder('antenna', 0.018, 0.014, 0.16, materials.metal, (0.04, 1.42, 0), (0, 0, -0.2), parent=body, segments=10)
    sphere('antenna_tip', 0.05, materials.glow, (0.07, 1.51, 0), parent=body, segments=16)
    sphere('cheek', 0.03, materials.books[4], (-0.2, 1.06, 0.215), (1, 0.6, 0.3), parent=body, segments=10)
    sphere('cheek', 0.03, materials.books[4], (0.2, 1.06, 0.215), (1, 0.6, 0.3), parent=body, segments=10)
    card = empty('Card', (0, 0.72, 0.36), (0.25, 0, 0), parent=body)
    rounded_box('card_sheet', (0.42, 0.3, 0.025), 0.012, materials.paper, parent=card)
    rounded_box('card_stripe', (0.32, 0.05, 0.006), 0.01, materials.shell, (0, 0.08, 0.015), parent=card)
    rounded_box('card_line', (0.24, 0.025, 0.006), 0.008, materials.baseboard, (-0.04, -0.01, 0.015), parent=card)
    rounded_box('card_line', (0.18, 0.025, 0.006), 0.008, materials.baseboard, (-0.07, -0.07, 0.015), parent=card)
    merge_by_material(card)
    merge_by_material(body, keep_names=('LegL', 'LegR', 'ArmL', 'ArmR', 'Card'))
    return root


def main():
    common.clear_scene()
    materials = Materials()
    furniture = [build_desk(materials, f'desk_{int(width * 100)}_{variant}', width, variant)
                 for width in (1.2, 1.4, 1.6) for variant in ('a', 'b')]
    furniture += [build_lead_desk(materials)]
    furniture += [build_chair(materials, f'chair_{variant}', variant) for variant in ('a', 'b')]
    furniture += [build_monitor(materials, f'monitor_{variant}', variant) for variant in ('a', 'b')]
    furniture += [build_kiosk(materials, f'kiosk_{variant}', variant) for variant in ('a', 'b')]
    furniture += [build_routines_board(materials), build_review_wall(materials), build_shelf(materials),
                  build_server_rack(materials), build_inbox_tray(materials), build_meeting_table(materials)]
    room = [build_wall(materials, 'wall_tall_a', 1.9, 'seam'), build_wall(materials, 'wall_tall_b', 1.9, 'art'),
            build_wall(materials, 'wall_tall_c', 1.9, 'sconce'), build_wall(materials, 'wall_mid', 1.3, None),
            build_wall(materials, 'wall_low', 0.5, None), build_floor_tile(materials)]
    nature = [build_plant(materials, f'plant_{variant}', variant) for variant in ('a', 'b', 'c')]
    nature += [build_tree(materials, f'tree_{variant}', variant) for variant in ('a', 'b', 'c')]
    characters = [build_orglet(materials)]
    export_glb(furniture, os.path.join(ASSETS, 'furniture.glb'))
    export_glb(room, os.path.join(ASSETS, 'room.glb'))
    export_glb(nature, os.path.join(ASSETS, 'nature.glb'))
    export_glb(characters, os.path.join(ASSETS, 'orglet.glb'))


main()
