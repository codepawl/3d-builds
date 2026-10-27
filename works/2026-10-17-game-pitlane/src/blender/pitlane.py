"""Pit building garages, pit wall and strategy stands: pitlane.glb (refs/garage.md, refs/pit_wall.md).

Roots:
  garage_<team>       12 x 9 x 15 m team box with two bays (halvard, ostrava, kestrel, sable, plain); origin on the
                      ground at the centre of the box, the open front faces +forward (the pit lane), so boxes tile
                      along x every 12 m. Doors: garage_<team>_door_1 / _door_2 roller shutters with the origin at the
                      top of the opening (y 4.3); scale y to 1 to close, exported open at 0.04.
                      Anchors garage_<team>_bay_1 / _bay_2 (car parking spots, nose to +forward).
  pit_wall_section    12 m of pit wall with debris fence; track on -forward, pit lane on +forward
  stand_<team>        team strategy stand, 4.6 x 2.8 x 2.2 m, seats face -forward over the wall
"""
from lib import anchor, box, combine, cylinder, export, reset_scene, root
from parts import TEAMS, palette, tube

WIDTH = 12.0
DEPTH = 15.0
GROUND_STOREY = 4.6
HEIGHT = 8.6


def garage(team, mats):
    name = f"garage_{team}"
    group = root(name)
    primary = mats[f"{team}_primary"] if team != "plain" else mats["panel"]
    accent = mats[f"{team}_accent"] if team != "plain" else mats["frame"]
    front = DEPTH / 2
    shell = [
        box(f"{name}_floor", (WIDTH, 0.06, DEPTH), (0, 0.03, 0), mats["floor_white"], 0.0),
        box(f"{name}_back", (WIDTH, HEIGHT, 0.3), (0, HEIGHT / 2, -front + 0.15), mats["white"], 0.04),
        box(f"{name}_slab", (WIDTH, 0.35, DEPTH), (0, GROUND_STOREY, 0), mats["panel"], 0.03),
        box(f"{name}_roof", (WIDTH + 0.1, 0.3, DEPTH + 2.0), (0, HEIGHT + 0.15, 1.0), mats["panel"], 0.06),
        box(f"{name}_roof_edge", (WIDTH + 0.1, 0.5, 0.2), (0, HEIGHT + 0.1, front + 2.0), primary, 0.04),
        box(f"{name}_spandrel", (WIDTH, 0.9, 0.3), (0, GROUND_STOREY + 0.55, front - 0.15), mats["white"], 0.04),
        box(f"{name}_header", (WIDTH, 0.35, 0.4), (0, GROUND_STOREY - 0.12, front - 0.2), mats["frame"], 0.03),
        box(f"{name}_pier", (0.6, GROUND_STOREY, 0.6), (0, GROUND_STOREY / 2, front - 0.3), mats["white"], 0.04),
        box(f"{name}_team_plate", (4.0, 0.6, 0.06), (-2.8, GROUND_STOREY + 0.55, front + 0.02), primary, 0.02),
        box(f"{name}_number_plate", (0.9, 0.6, 0.06), (4.6, GROUND_STOREY + 0.55, front + 0.02), mats["plate"], 0.02),
        box(f"{name}_glass_band", (WIDTH - 0.6, 2.4, 0.12), (0, GROUND_STOREY + 2.25, front - 0.1), mats["glass"], 0.02),
        box(f"{name}_sill", (WIDTH, 0.12, 0.4), (0, GROUND_STOREY + 1.0, front - 0.1), mats["frame"], 0.02),
        box(f"{name}_lintel", (WIDTH, 0.5, 0.35), (0, HEIGHT - 0.3, front - 0.15), mats["white"], 0.03),
    ]
    # paddock side: roller door, personnel door, windows; roof plant and skylight
    shell += [box(f"{name}_back_door", (4.0, 3.8, 0.08), (-2.5, 1.9, -front - 0.02), mats["panel"], 0.02),
              box(f"{name}_back_person_door", (1.0, 2.2, 0.08), (2.0, 1.1, -front - 0.02), mats["dark"], 0.02),
              box(f"{name}_back_windows", (10.0, 1.4, 0.08), (0, 6.4, -front - 0.02), mats["glass"], 0.02),
              box(f"{name}_back_band", (WIDTH, 0.25, 0.1), (0, 4.75, -front - 0.03), primary, 0.01),
              box(f"{name}_parapet", (WIDTH + 0.1, 0.4, 0.15), (0, HEIGHT + 0.5, -front + 0.1), mats["white"], 0.03),
              box(f"{name}_skylight", (8.0, 0.25, 1.6), (0, HEIGHT + 0.42, -1.0), mats["glass_light"], 0.05)]
    for unit_x in (-3.5, 3.5):
        shell.append(box(f"{name}_ac{unit_x}", (1.8, 1.0, 1.4), (unit_x, HEIGHT + 0.8, -4.5), mats["steel"], 0.08))
        shell.append(cylinder(f"{name}_fan{unit_x}", 0.45, 0.06, (unit_x, HEIGHT + 1.32, -4.5), mats["dark"], sides=18))
    for side in (-1, 1):
        shell.append(box(f"{name}_side{side}", (0.3, HEIGHT, DEPTH), (side * (WIDTH / 2 - 0.15), HEIGHT / 2, 0), mats["white"], 0.04))
    for index in range(9):
        mullion_x = -WIDTH / 2 + 0.3 + index * (WIDTH - 0.6) / 8
        shell.append(box(f"{name}_mullion{index}", (0.1, 2.4, 0.2), (mullion_x, GROUND_STOREY + 2.25, front - 0.04), mats["frame"], 0.01))
    for index in range(4):
        # canopy downlights under the roof overhang
        shell.append(box(f"{name}_downlight{index}", (1.2, 0.04, 0.2), (-4.5 + index * 3, HEIGHT - 0.02, front + 1.2), mats["glow_white"], 0.01))
    interior = [
        box(f"{name}_wall_panel", (WIDTH - 0.8, 3.0, 0.06), (0, 2.0, -front + 0.33), primary, 0.02),
        box(f"{name}_wall_stripe", (WIDTH - 0.8, 0.15, 0.07), (0, 0.6, -front + 0.33), accent, 0.01),
        box(f"{name}_divider", (0.08, 2.4, 6.0), (0, 1.2, -front + 3.4), mats["panel"], 0.02),
        box(f"{name}_gantry", (WIDTH - 1.0, 0.12, 0.2), (0, 3.8, -1.5), mats["frame"], 0.02),
        box(f"{name}_bench_left", (3.0, 0.9, 0.7), (-3.8, 0.45, -front + 0.75), mats["white"], 0.03),
        box(f"{name}_bench_right", (3.0, 0.9, 0.7), (3.8, 0.45, -front + 0.75), mats["white"], 0.03),
        box(f"{name}_cabinet", (1.2, 2.0, 0.6), (0, 1.0, -front + 0.7), mats["dark"], 0.03),
    ]
    for index in range(6):
        screen_x = -4.5 + index * 1.8
        interior.append(box(f"{name}_monitor{index}", (1.0, 0.6, 0.06), (screen_x, 3.35, -1.5), mats["dark"], 0.02))
        interior.append(box(f"{name}_monitor_face{index}", (0.92, 0.52, 0.01), (screen_x, 3.35, -1.465), mats["screen"], 0.0))
        interior.append(box(f"{name}_strip{index}", (0.25, 0.04, 6.0), (screen_x, GROUND_STOREY - 0.2, 0), mats["glow_white"], 0.01))
    for bay_x in (-3.0, 3.0):
        interior.append(box(f"{name}_bay_line{bay_x}", (0.1, 0.01, 7.0), (bay_x - 1.4, 0.065, 2.5), accent, 0.0))
        interior.append(box(f"{name}_bay_line_b{bay_x}", (0.1, 0.01, 7.0), (bay_x + 1.4, 0.065, 2.5), accent, 0.0))
    combine(f"{name}_shell", shell, parent=group)
    combine(f"{name}_interior", interior, parent=group)
    for index, bay_x in enumerate((-3.0, 3.0), start=1):
        slats = [box(f"{name}_door{index}_panel", (5.3, 4.2, 0.08), (bay_x, 4.3 - 2.1, front - 0.25), mats["panel"], 0.01)]
        for slat in range(10):
            slats.append(box(f"{name}_door{index}_slat{slat}", (5.3, 0.03, 0.1), (bay_x, 4.3 - 0.21 - slat * 0.42, front - 0.25), mats["frame"], 0.0))
        door = combine(f"{name}_door_{index}", slats, origin=(bay_x, 4.3, front - 0.25), parent=group)
        door.scale = (1.0, 1.0, 0.04)
        combine(f"{name}_drum_{index}", [cylinder(f"{name}_drum{index}", 0.22, 5.4, (bay_x, 4.25, front - 0.3), mats["frame"], axis="x", sides=16)], parent=group)
        anchor(f"{name}_bay_{index}", (bay_x, 0.06, 2.5), group)
    return group


def pit_wall(mats):
    group = root("pit_wall_section")
    parts = [box("wall_body", (12.0, 1.1, 0.5), (0, 0.55, 0), mats["concrete"], 0.05),
             box("wall_cap", (12.0, 0.1, 0.6), (0, 1.13, 0), mats["white"], 0.03),
             box("wall_stripe", (12.0, 0.2, 0.52), (0, 0.25, 0), mats["halvard_primary"], 0.01)]
    for index in range(5):
        post_x = -6 + index * 3
        parts.append(box(f"fence_post{index}", (0.1, 3.6, 0.1), (post_x, 2.9, -0.15), mats["fence"], 0.02))
        parts.append(tube(f"fence_arm{index}", [(post_x, 4.7, -0.15), (post_x, 4.9, -0.45)], 0.04, mats["fence"], sides=6))
    for row in range(8):
        parts.append(box(f"fence_wire{row}", (12.0, 0.02, 0.02), (0, 1.3 + row * 0.45, -0.15), mats["fence"], 0.0))
    for column in range(25):
        parts.append(box(f"fence_rod{column}", (0.015, 3.4, 0.015), (-6 + column * 0.5, 2.95, -0.15), mats["fence"], 0.0))
    combine("pit_wall_body", parts, parent=group)
    return group


def stand(team, mats):
    name = f"stand_{team}"
    group = root(name)
    primary = mats[f"{team}_primary"]
    parts = [box(f"{name}_base", (4.6, 0.5, 1.9), (0, 0.25, 0), mats["frame"], 0.04),
             box(f"{name}_deck", (4.6, 0.05, 1.9), (0, 0.52, 0), mats["dark"], 0.01),
             box(f"{name}_desk", (4.4, 0.08, 0.7), (0, 1.6, -0.55), mats["white"], 0.02),
             box(f"{name}_desk_front", (4.4, 1.05, 0.06), (0, 1.07, -0.88), primary, 0.02),
             box(f"{name}_roof", (4.9, 0.1, 2.3), (0, 2.75, -0.05), mats["white"], 0.03),
             box(f"{name}_roof_band", (4.9, 0.25, 0.08), (0, 2.68, -1.2), primary, 0.02),
             tube(f"{name}_antenna", [(2.1, 2.8, 0.6), (2.1, 3.6, 0.6)], 0.015, mats["dark"], sides=6),
             box(f"{name}_dish", (0.25, 0.25, 0.05), (2.1, 3.4, 0.62), mats["white"], 0.03)]
    for step in range(2):
        parts.append(box(f"{name}_step{step}", (0.9, 0.17, 0.3), (1.6, 0.085 + step * 0.17, 1.1 - step * 0.25), mats["steel"], 0.01))
    for corner_x in (-2.3, 2.3):
        for corner_z in (-1.05, 0.95):
            parts.append(box(f"{name}_post{corner_x}{corner_z}", (0.08, 2.2, 0.08), (corner_x, 1.65, corner_z), mats["frame"], 0.01))
    for seat in range(4):
        seat_x = -1.65 + seat * 1.1
        parts.append(cylinder(f"{name}_stool_post{seat}", 0.03, 0.55, (seat_x, 0.8, 0.1), mats["chrome"], sides=8))
        parts.append(cylinder(f"{name}_stool_seat{seat}", 0.2, 0.07, (seat_x, 1.1, 0.1), mats["dark"], sides=16, round_by=0.02))
        parts.append(box(f"{name}_stool_back{seat}", (0.36, 0.3, 0.05), (seat_x, 1.32, 0.3), mats["dark"], 0.02))
        for row, screen_up in enumerate((1.9, 2.32)):
            parts.append(box(f"{name}_screen{seat}{row}", (0.9, 0.42, 0.05), (seat_x, screen_up, -0.75), mats["dark"], 0.015))
            parts.append(box(f"{name}_screen_face{seat}{row}", (0.84, 0.36, 0.01), (seat_x, screen_up, -0.72), mats["screen"], 0.0))
        parts.append(box(f"{name}_keyboard{seat}", (0.45, 0.02, 0.16), (seat_x, 1.65, -0.4), mats["dark"], 0.005))
    combine(f"{name}_body", parts, parent=group)
    anchor(f"{name}_seat_1", (-1.65, 0.55, 0.1), group)
    return group


def build():
    reset_scene()
    mats = palette()
    for team in list(TEAMS) + ["plain"]:
        garage(team, mats)
    for team in TEAMS:
        stand(team, mats)
    pit_wall(mats)
    export("pitlane.glb")


if __name__ == "__main__":
    build()
