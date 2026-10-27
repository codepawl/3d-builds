"""Track furniture, grandstands, marshal posts and scenery for the three circuits: track.glb
(refs/kerb.md, refs/grandstand.md, refs/marshal_post.md).

Roots (origin on the ground at the centre unless noted):
  kerb_straight       6 m long (along forward) x 1.2 m red/white kerb with sawtooth ridges
  kerb_curve          20 degree arc of kerb on a 30 m radius, origin at the arc's start, curving towards -x
  grandstand_covered  30 m long (x), 14 rows, roof on columns, seats face +forward; crowd dots in the seats
  grandstand_open     15 m, 8 rows, no roof
  marshal_post        hut, LED flag panel (marshal_post_panel, glow_amber; recolour for yellow, green, red, blue),
                      flag rack and extinguisher, behind a 4 m fence gap; track on +forward
  armco_section       4 m double W-beam barrier
  tyre_wall           4 m tyre barrier with belt facing
  debris_fence        6 m catch fence
  concrete_barrier    4 m street-circuit concrete block with fence (night street circuit)
  floodlight_pole     12 m street light mast with four lamp heads (glow_white)
  start_gantry        14 m track gantry with five red start lights: start_gantry_light_1..5 (glow_red)
  drs_board           detection / activation board on posts
  billboard           8 m advertising board (blank sign plate)
  tree_park_a, tree_park_b, palm_a, palm_b, desert_shrub, rock_a, rock_b   scenery
"""
import math

from lib import box, combine, cylinder, export, material, reset_scene, root, sphere, turn
from parts import palette, tube


def kerb_pieces(name, mats, length=6.0, centre=(0, 0, 0), heading=0.0):
    x, up, forward = centre
    pieces = []
    stripes = int(length)
    for index in range(stripes):
        along = -length / 2 + 0.5 + index
        stripe_x = x + math.sin(heading) * along
        stripe_forward = forward + math.cos(heading) * along
        stripe_mat = mats["kerb_red"] if index % 2 == 0 else mats["kerb_white"]
        piece = box(f"{name}_stripe{index}", (1.2, 0.05, 1.0), (stripe_x, 0.025, stripe_forward), stripe_mat, 0.012)
        pieces.append(turn(piece, "up", heading))
        ridge = box(f"{name}_ridge{index}", (0.5, 0.03, 0.9), (stripe_x + math.cos(heading) * 0.3, 0.06, stripe_forward - math.sin(heading) * 0.3), stripe_mat, 0.012)
        pieces.append(turn(ridge, "up", heading))
    return pieces


def kerbs(mats):
    group = root("kerb_straight")
    combine("kerb_straight_body", kerb_pieces("kerb_straight", mats), parent=group)
    group = root("kerb_curve")
    pieces = []
    radius = 30.0
    for index in range(10):
        angle = math.radians(1 + index * 2)
        centre = (-(radius - radius * math.cos(angle)), 0, radius * math.sin(angle))
        pieces += kerb_pieces(f"kerb_curve{index}", mats, length=1.0 if index % 2 else 1.0, centre=centre, heading=-angle)
        pieces[-2].data.materials[0] = mats["kerb_red"] if index % 2 == 0 else mats["kerb_white"]
        pieces[-1].data.materials[0] = pieces[-2].data.materials[0]
    combine("kerb_curve_body", pieces, parent=group)


def grandstand(name, length, rows, covered, mats):
    group = root(name)
    seat_colours = [material("seat_blue", "#3b6fd8", roughness=0.6), material("seat_white", "#eef1f5", roughness=0.6),
                    material("seat_grey", "#9aa3b0", roughness=0.6)]
    crowd = [material(f"crowd_{index}", colour, roughness=0.8) for index, colour in
             enumerate(("#ff5b3a", "#2557e8", "#f2c21b", "#f4f6fa", "#3cc45a", "#7a3cf0", "#23262d"))]
    row_depth, riser, front_up = 0.8, 0.4, 1.5
    depth = rows * row_depth
    parts = [box(f"{name}_front_wall", (length, front_up, 0.3), (0, front_up / 2, depth / 2), mats["concrete"], 0.04),
             box(f"{name}_banner", (length - 1.0, 0.7, 0.05), (0, front_up * 0.55, depth / 2 + 0.17), mats["plate"], 0.02)]
    for row in range(rows):
        step_up = front_up + row * riser
        row_forward = depth / 2 - row_depth / 2 - row * row_depth
        parts.append(box(f"{name}_tread{row}", (length, 0.2, row_depth), (0, step_up - 0.1, row_forward), mats["concrete"], 0.02))
        parts.append(box(f"{name}_riser{row}", (length, step_up, 0.12), (0, step_up / 2, row_forward - row_depth / 2 + 0.06), mats["frame"], 0.01))
        seat_mat = seat_colours[(row // 3) % len(seat_colours)]
        parts.append(box(f"{name}_seat{row}", (length - 2.4, 0.12, 0.42), (0, step_up + 0.22, row_forward - 0.05), seat_mat, 0.03))
        parts.append(box(f"{name}_seatback{row}", (length - 2.4, 0.36, 0.08), (0, step_up + 0.4, row_forward - 0.28), seat_mat, 0.03))
        for spectator in range(int(length / 2.2)):
            # deterministic scatter so variants do not repeat the same crowd pattern
            seed = (row * 37 + spectator * 11 + int(length)) % 17
            if seed < 6:
                continue
            spectator_x = -length / 2 + 1.6 + spectator * 2.2 + (seed % 5) * 0.2
            body = crowd[(row + spectator * 3) % len(crowd)]
            parts.append(sphere(f"{name}_fan{row}_{spectator}", 0.2, (spectator_x, step_up + 0.55, row_forward - 0.1), body, scale=(1.0, 1.4, 0.8), segments=8))
            parts.append(sphere(f"{name}_head{row}_{spectator}", 0.11, (spectator_x, step_up + 0.95, row_forward - 0.1), material("skin_c58c62", "#c58c62", roughness=0.7), segments=8))
    top_up = front_up + rows * riser
    parts.append(box(f"{name}_back_wall", (length, top_up + 1.2, 0.3), (0, (top_up + 1.2) / 2, -depth / 2 - 0.15), mats["white"], 0.05))
    for aisle_x in (-length / 2 + 0.6, length / 2 - 0.6):
        for row in range(rows * 2):
            parts.append(box(f"{name}_aisle{aisle_x}_{row}", (1.0, 0.1, row_depth / 2), (aisle_x, front_up + row * riser / 2 + 0.05, depth / 2 - row_depth / 4 - row * row_depth / 2), mats["steel"], 0.01))
        parts.append(tube(f"{name}_rail{aisle_x}", [(aisle_x - 0.5, front_up + 1.0, depth / 2), (aisle_x - 0.5, top_up + 1.0, -depth / 2)], 0.025, mats["steel"], sides=6))
    for column_x in [-length / 2 + 0.3 + index * (length - 0.6) / max(1, int(length / 7.5)) for index in range(int(length / 7.5) + 1)]:
        parts.append(box(f"{name}_column{column_x}", (0.3, top_up + 1.2, 0.3), (column_x, (top_up + 1.2) / 2, -depth / 2 + 0.1), mats["frame"], 0.03))
        if covered:
            roof_top = top_up + 3.2
            parts.append(box(f"{name}_mast{column_x}", (0.3, roof_top - top_up, 0.3), (column_x, top_up + (roof_top - top_up) / 2, -depth / 2 + 0.1), mats["frame"], 0.03))
            beam = box(f"{name}_beam{column_x}", (0.25, 0.5, depth + 2.0), (column_x, roof_top - 0.4, 0.8), mats["frame"], 0.03)
            parts.append(turn(beam, "x", math.radians(6)))
    if covered:
        roof = box(f"{name}_roof", (length + 0.6, 0.2, depth + 2.4), (0, top_up + 3.0, 0.8), mats["white"], 0.05)
        parts.append(turn(roof, "x", math.radians(6)))
        fascia = box(f"{name}_fascia", (length + 0.6, 0.7, 0.15), (0, top_up + 2.4, depth / 2 + 2.0), mats["halvard_primary"], 0.03)
        parts.append(fascia)
    combine(f"{name}_body", parts, parent=group)
    return group


def marshal_post(mats):
    group = root("marshal_post")
    parts = [box("post_platform", (3.2, 0.2, 2.6), (0, 0.1, -0.5), mats["concrete"], 0.03),
             box("post_hut", (2.4, 2.4, 2.0), (-0.3, 1.4, -0.9), mats["white"], 0.06),
             box("post_roof", (2.7, 0.15, 2.3), (-0.3, 2.68, -0.9), mats["safety_orange"], 0.04),
             box("post_window", (1.6, 0.8, 0.05), (-0.3, 1.8, 0.12), mats["glass"], 0.02),
             box("post_door", (0.05, 1.9, 0.8), (0.91, 1.15, -0.9), mats["dark"], 0.02),
             box("post_flag_rack", (0.5, 1.0, 0.1), (1.3, 0.7, 0.2), mats["frame"], 0.01),
             box("post_panel_frame", (1.1, 0.7, 0.12), (1.3, 2.6, 0.25), mats["dark"], 0.03),
             box("post_panel_pole", (0.1, 2.3, 0.1), (1.3, 1.15, 0.25), mats["frame"], 0.01),
             cylinder("post_extinguisher", 0.09, 0.55, (0.7, 0.48, 0.35), mats["kerb_red"], sides=12, round_by=0.03),
             box("post_plate", (0.8, 0.3, 0.04), (-0.3, 2.35, 0.12), mats["plate"], 0.01)]
    for index, flag_colour in enumerate(("#f2c21b", "#3cc45a", "#2f7cf0", "#e8343a")):
        flag_mat = material(f"flag_{flag_colour[1:]}", flag_colour, roughness=0.8)
        parts.append(tube(f"post_flagstick{index}", [(1.12 + index * 0.12, 0.3, 0.26), (1.12 + index * 0.12, 1.5, 0.26)], 0.012, mats["dark"], sides=5))
        parts.append(box(f"post_flag{index}", (0.02, 0.4, 0.5), (1.12 + index * 0.12, 1.3, 0.52), flag_mat, 0.005))
    for post_x in (-1.8, 1.8):
        parts.append(box(f"post_fence{post_x}", (0.08, 3.5, 0.08), (post_x, 1.75, 0.9), mats["fence"], 0.01))
    combine("marshal_post_body", parts, parent=group)
    panel = box("marshal_post_panel_face", (0.96, 0.56, 0.02), (1.3, 2.6, 0.32), mats["glow_amber"], 0.01)
    combine("marshal_post_panel", [panel], origin=(1.3, 2.6, 0.32), parent=group)
    return group


def barriers(mats):
    group = root("armco_section")
    parts = []
    for post in range(3):
        parts.append(box(f"armco_post{post}", (0.12, 0.75, 0.15), (-2 + post * 2, 0.375, -0.1), mats["fence"], 0.01))
    for rail_up in (0.45, 0.72):
        parts.append(box(f"armco_rail{rail_up}", (4.0, 0.25, 0.06), (0, rail_up, 0.0), mats["chrome"], 0.02))
        parts.append(box(f"armco_rib{rail_up}", (4.0, 0.06, 0.1), (0, rail_up, 0.02), mats["steel"], 0.02))
    combine("armco_section_body", parts, parent=group)

    group = root("tyre_wall")
    parts = [box("tyre_wall_belt", (4.0, 0.95, 0.04), (0, 0.5, 0.42), mats["kerb_white"], 0.01),
             box("tyre_wall_belt_stripe", (4.0, 0.2, 0.045), (0, 0.55, 0.43), mats["kerb_red"], 0.005)]
    for column in range(7):
        for row in range(2):
            for level in range(3):
                centre = (-1.72 + column * 0.57, 0.1 + level * 0.25, 0.1 - row * 0.57)
                parts.append(cylinder(f"tyre_wall_{column}{row}{level}", 0.29, 0.22, centre, mats["rubber"], sides=14, round_by=0.05))
    combine("tyre_wall_body", parts, parent=group)

    group = root("debris_fence")
    parts = []
    for post in range(3):
        parts.append(box(f"fence_post{post}", (0.12, 4.0, 0.12), (-3 + post * 3, 2.0, 0), mats["fence"], 0.02))
        parts.append(tube(f"fence_arm{post}", [(-3 + post * 3, 3.95, 0), (-3 + post * 3, 4.3, 0.4)], 0.05, mats["fence"], sides=6))
    for row in range(9):
        parts.append(box(f"fence_wire{row}", (6.0, 0.02, 0.02), (0, 0.4 + row * 0.44, 0.05), mats["fence"], 0.0))
    for column in range(25):
        parts.append(box(f"fence_rod{column}", (0.015, 3.6, 0.015), (-3 + column * 0.25, 2.2, 0.05), mats["fence"], 0.0))
    combine("debris_fence_body", parts, parent=group)

    group = root("concrete_barrier")
    parts = [box("block_base", (4.0, 0.3, 0.6), (0, 0.15, 0), mats["concrete"], 0.03),
             box("block_body", (4.0, 0.75, 0.3), (0, 0.65, 0), mats["concrete"], 0.04),
             box("block_stripe", (2.0, 0.3, 0.31), (-1.0, 0.75, 0), mats["kerb_red"], 0.01),
             box("block_stripe_b", (2.0, 0.3, 0.31), (1.0, 0.75, 0), mats["kerb_white"], 0.01)]
    for post in range(3):
        parts.append(box(f"block_fence_post{post}", (0.08, 2.8, 0.08), (-2 + post * 2, 2.4, -0.05), mats["fence"], 0.01))
    for row in range(6):
        parts.append(box(f"block_wire{row}", (4.0, 0.02, 0.02), (0, 1.3 + row * 0.45, -0.05), mats["fence"], 0.0))
    combine("concrete_barrier_body", parts, parent=group)


def lights_and_signs(mats):
    group = root("floodlight_pole")
    parts = [cylinder("pole_base", 0.3, 0.6, (0, 0.3, 0), mats["concrete"], sides=12, round_by=0.05),
             cylinder("pole_mast", 0.14, 12.0, (0, 6.3, 0), mats["fence"], sides=12, radius_end=0.09),
             box("pole_head_bar", (2.4, 0.12, 0.12), (0, 12.2, 0), mats["frame"], 0.02)]
    for index, head_x in enumerate((-1.0, -0.35, 0.35, 1.0)):
        housing = box(f"pole_lamp{index}", (0.5, 0.35, 0.18), (head_x, 12.0, 0.15), mats["dark"], 0.03)
        lens = box(f"pole_lens{index}", (0.44, 0.29, 0.02), (head_x, 12.0, 0.25), mats["glow_white"], 0.0)
        parts += [turn(housing, "x", math.radians(25)), turn(lens, "x", math.radians(25))]
    combine("floodlight_pole_body", parts, parent=group)

    group = root("start_gantry")
    parts = []
    for side in (-1, 1):
        parts.append(box(f"gantry_leg{side}", (0.5, 7.0, 0.5), (side * 7.0, 3.5, 0), mats["frame"], 0.05))
        parts.append(box(f"gantry_foot{side}", (1.0, 0.3, 1.0), (side * 7.0, 0.15, 0), mats["concrete"], 0.04))
    parts += [box("gantry_truss", (14.5, 1.2, 0.6), (0, 6.6, 0), mats["white"], 0.06),
              box("gantry_band", (14.6, 0.25, 0.62), (0, 6.15, 0), mats["halvard_primary"], 0.02),
              box("gantry_light_box", (3.6, 1.0, 0.4), (0, 5.4, 0.2), mats["dark"], 0.06)]
    combine("start_gantry_frame", parts, parent=group)
    for index in range(5):
        lens = cylinder(f"start_gantry_lens{index}", 0.17, 0.05, (-1.4 + index * 0.7, 5.4, 0.43), mats["glow_red"], axis="forward", sides=18)
        combine(f"start_gantry_light_{index + 1}", [lens], origin=(-1.4 + index * 0.7, 5.4, 0.43), parent=group)

    group = root("drs_board")
    parts = [box("drs_plate", (2.4, 1.0, 0.08), (0, 2.0, 0), mats["plate"], 0.03),
             box("drs_band", (2.4, 0.2, 0.09), (0, 1.6, 0), mats["glow_green"], 0.01)]
    for side in (-1, 1):
        parts.append(box(f"drs_post{side}", (0.1, 1.6, 0.1), (side * 1.0, 0.8, -0.06), mats["fence"], 0.01))
    combine("drs_board_body", parts, parent=group)

    group = root("billboard")
    parts = [box("billboard_face", (8.0, 2.0, 0.15), (0, 2.6, 0), mats["plate"], 0.04),
             box("billboard_frame", (8.2, 2.2, 0.1), (0, 2.6, -0.1), mats["frame"], 0.03)]
    for leg_x in (-3.0, 0.0, 3.0):
        parts.append(box(f"billboard_leg{leg_x}", (0.15, 1.6, 0.15), (leg_x, 0.8, -0.1), mats["frame"], 0.02))
    combine("billboard_body", parts, parent=group)


def scenery(mats):
    for name, crown_radius, height, crown_mat in (("tree_park_a", 2.4, 4.0, mats["foliage"]), ("tree_park_b", 1.8, 3.2, mats["foliage_dark"])):
        group = root(name)
        parts = [cylinder(f"{name}_trunk", 0.22, height, (0, height / 2, 0), mats["bark"], sides=10, radius_end=0.14)]
        parts.append(sphere(f"{name}_crown", crown_radius, (0, height + crown_radius * 0.6, 0), crown_mat, scale=(1.0, 0.9, 1.0), segments=14))
        parts.append(sphere(f"{name}_crown_b", crown_radius * 0.7, (crown_radius * 0.6, height + crown_radius * 0.2, 0.3), crown_mat, segments=12))
        parts.append(sphere(f"{name}_crown_c", crown_radius * 0.65, (-crown_radius * 0.5, height + crown_radius * 0.3, -0.4), crown_mat, segments=12))
        combine(f"{name}_body", parts, parent=group)
    for name, height, lean in (("palm_a", 7.0, 0.5), ("palm_b", 5.5, -0.35)):
        group = root(name)
        trunk_points = [(lean * (step / 6) ** 2, height * step / 6, 0) for step in range(7)]
        parts = [tube(f"{name}_trunk", trunk_points, 0.18, mats["bark"], sides=10)]
        top = trunk_points[-1]
        for frond in range(8):
            angle = 2 * math.pi * frond / 8
            tip = (top[0] + math.cos(angle) * 2.4, top[1] - 0.9, top[2] + math.sin(angle) * 2.4)
            middle = (top[0] + math.cos(angle) * 1.3, top[1] + 0.25, top[2] + math.sin(angle) * 1.3)
            leaf = sphere(f"{name}_frond{frond}", 1.0, middle, mats["foliage_dark"], scale=(0.5, 0.06, 1.3), segments=10)
            turn(leaf, "up", -angle + math.pi / 2)
            parts.append(leaf)
            parts.append(tube(f"{name}_rib{frond}", [top, middle, tip], 0.04, mats["foliage_dark"], sides=5))
        combine(f"{name}_body", parts, parent=group)
    group = root("desert_shrub")
    shrub = material("shrub_dry", "#a7a35f", roughness=0.9)
    parts = [sphere(f"shrub_{index}", 0.45 - index * 0.06, (math.cos(index * 2.1) * 0.4, 0.3, math.sin(index * 2.1) * 0.4), shrub, scale=(1, 0.7, 1), segments=10) for index in range(5)]
    combine("desert_shrub_body", parts, parent=group)
    rock = material("rock", "#c9a77a", roughness=0.95)
    for name, size in (("rock_a", 1.4), ("rock_b", 0.8)):
        group = root(name)
        parts = [box(f"{name}_block", (size, size * 0.6, size * 0.8), (0, size * 0.28, 0), rock, size * 0.2),
                 box(f"{name}_chip", (size * 0.6, size * 0.4, size * 0.5), (size * 0.45, size * 0.18, size * 0.2), rock, size * 0.12)]
        turn(parts[1], "up", 0.6)
        combine(f"{name}_body", parts, parent=group)


def build():
    reset_scene()
    mats = palette()
    kerbs(mats)
    grandstand("grandstand_covered", 30.0, 14, True, mats)
    grandstand("grandstand_open", 15.0, 8, False, mats)
    marshal_post(mats)
    barriers(mats)
    lights_and_signs(mats)
    scenery(mats)
    export("track.glb")


if __name__ == "__main__":
    build()
