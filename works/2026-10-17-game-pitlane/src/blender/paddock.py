"""Paddock: team race transporters and hospitality units: paddock.glb (refs/team_truck.md, refs/hospitality.md).

Roots:
  truck_<team>         EU cab-over tractor + 13.6 m box semi-trailer, 16.5 x 4.0 x 2.55 m, origin on the ground at the
                       middle of the combination, cab facing +forward (halvard, ostrava, kestrel, sable).
                       Wheels truck_<team>_wheel_<n> spin about x, origin at the hub.
  hospitality_<team>   two-storey team hospitality unit, 14 x 8.2 x 9 m, glass front facing +forward
                       (halvard, ostrava, kestrel)
"""
from lib import box, combine, cylinder, export, reset_scene, root, slab
from parts import palette, road_wheel, tube

TRUCK_FRONT = 8.25
TRAILER_FRONT = 5.35
TRAILER_BACK = -8.25


def truck(team, mats):
    name = f"truck_{team}"
    group = root(name)
    primary, secondary, accent = (mats[f"{team}_{role}"] for role in ("primary", "secondary", "accent"))
    cab_back = TRUCK_FRONT - 2.3
    parts = [
        # cab
        box(f"{name}_cab", (2.5, 2.5, 2.3), (0, 2.45, TRUCK_FRONT - 1.15), primary, 0.14),
        box(f"{name}_deflector", (2.4, 0.42, 1.6), (0, 3.86, TRUCK_FRONT - 1.4), primary, 0.18),
        box(f"{name}_windscreen", (2.2, 1.0, 0.06), (0, 2.95, TRUCK_FRONT + 0.0), mats["glass"], 0.03),
        box(f"{name}_visor", (2.3, 0.12, 0.25), (0, 3.55, TRUCK_FRONT + 0.05), mats["dark"], 0.03),
        box(f"{name}_grille", (1.6, 0.8, 0.05), (0, 1.75, TRUCK_FRONT + 0.01), mats["dark"], 0.03),
        box(f"{name}_bumper", (2.5, 0.45, 0.25), (0, 0.85, TRUCK_FRONT - 0.05), mats["dark"], 0.06),
        box(f"{name}_cab_stripe", (2.52, 0.18, 2.32), (0, 1.5, TRUCK_FRONT - 1.15), accent, 0.02),
        box(f"{name}_chassis", (0.9, 0.3, 7.0), (0, 0.95, TRUCK_FRONT - 3.6), mats["dark"], 0.03),
        box(f"{name}_fifth_wheel", (1.0, 0.12, 1.0), (0, 1.15, 4.0), mats["steel"], 0.03),
        box(f"{name}_trailer_box", (2.55, 2.9, TRAILER_FRONT - TRAILER_BACK), (0, 2.55, (TRAILER_FRONT + TRAILER_BACK) / 2), secondary, 0.1),
        box(f"{name}_trailer_band", (2.57, 1.1, TRAILER_FRONT - TRAILER_BACK - 0.3), (0, 1.75, (TRAILER_FRONT + TRAILER_BACK) / 2), primary, 0.04),
        box(f"{name}_trailer_stripe", (2.58, 0.12, TRAILER_FRONT - TRAILER_BACK - 0.3), (0, 2.4, (TRAILER_FRONT + TRAILER_BACK) / 2), accent, 0.02),
        box(f"{name}_trailer_floor", (2.4, 0.2, TRAILER_FRONT - TRAILER_BACK), (0, 1.02, (TRAILER_FRONT + TRAILER_BACK) / 2), mats["dark"], 0.03),
        box(f"{name}_rear_frame", (2.56, 2.85, 0.06), (0, 2.55, TRAILER_BACK - 0.02), mats["frame"], 0.02),
        box(f"{name}_door_split", (0.04, 2.7, 0.08), (0, 2.55, TRAILER_BACK - 0.04), mats["dark"], 0.0),
        box(f"{name}_bumper_rear", (2.4, 0.15, 0.15), (0, 0.65, TRAILER_BACK + 0.05), mats["dark"], 0.02),
    ]
    for side in (-1, 1):
        parts += [
            box(f"{name}_mirror{side}", (0.12, 0.45, 0.18), (side * 1.42, 3.0, TRUCK_FRONT - 0.15), mats["dark"], 0.04),
            tube(f"{name}_mirror_arm{side}", [(side * 1.25, 3.3, TRUCK_FRONT - 0.3), (side * 1.42, 3.3, TRUCK_FRONT - 0.15)], 0.025, mats["dark"], sides=6),
            box(f"{name}_side_window{side}", (0.05, 0.75, 0.9), (side * 1.25, 3.0, TRUCK_FRONT - 0.6), mats["glass"], 0.02),
            box(f"{name}_door_line{side}", (0.03, 1.9, 0.03), (side * 1.26, 2.3, TRUCK_FRONT - 1.15), mats["dark"], 0.0),
            box(f"{name}_step{side}", (0.3, 0.06, 0.6), (side * 1.15, 0.75, TRUCK_FRONT - 0.7), mats["steel"], 0.01),
            box(f"{name}_headlight{side}", (0.4, 0.16, 0.05), (side * 0.95, 1.15, TRUCK_FRONT + 0.06), mats["glow_white"], 0.03),
            cylinder(f"{name}_tank{side}", 0.32, 1.3, (side * 0.85, 0.95, cab_back - 0.6), mats["chrome"], axis="forward", sides=16, round_by=0.04),
            box(f"{name}_skirt{side}", (0.05, 0.75, 7.4), (side * 1.24, 0.85, -0.1), primary, 0.02),
            box(f"{name}_landing_leg{side}", (0.12, 0.9, 0.12), (side * 0.9, 0.55, 2.3), mats["frame"], 0.02),
            box(f"{name}_tail_light{side}", (0.4, 0.14, 0.04), (side * 0.95, 0.65, TRAILER_BACK - 0.06), mats["glow_red"], 0.02),
            box(f"{name}_plate{side}", (0.05, 1.0, 4.0), (side * 1.29, 3.3, 0.5), mats["plate"], 0.02),
            box(f"{name}_door_hinge_line{side}", (0.03, 2.7, 0.08), (side * 1.24, 2.55, TRAILER_BACK - 0.04), mats["dark"], 0.0),
        ]
        for marker in range(6):
            parts.append(box(f"{name}_marker{side}{marker}", (0.03, 0.06, 0.12), (side * 1.29, 1.25, TRAILER_FRONT - 0.6 - marker * 2.4), mats["glow_amber"], 0.01))
        for lock in range(2):
            parts.append(box(f"{name}_lockbar{side}{lock}", (0.035, 2.5, 0.035), (side * (0.3 + lock * 0.6), 2.5, TRAILER_BACK - 0.07), mats["chrome"], 0.0))
        for arch_forward in (7.4, 3.6):
            parts.append(box(f"{name}_mudguard{side}{arch_forward}", (0.45, 0.06, 1.2), (side * 0.95, 1.12, arch_forward), mats["dark"], 0.02))
    combine(f"{name}_body", parts, parent=group)
    wheel_index = 0
    for axle_forward, radius, width, wheel_x in ((7.4, 0.5, 0.32, 1.05), (3.6, 0.5, 0.6, 0.95), (-4.3, 0.48, 0.38, 1.0), (-5.6, 0.48, 0.38, 1.0), (-6.9, 0.48, 0.38, 1.0)):
        for side in (-1, 1):
            road_wheel(f"{name}_wheel_{wheel_index}", radius, width, (side * wheel_x, radius, axle_forward), group, mats, spokes=10)
            wheel_index += 1
    return group


def hospitality(team, mats):
    name = f"hospitality_{team}"
    group = root(name)
    primary, secondary, accent = (mats[f"{team}_{role}"] for role in ("primary", "secondary", "accent"))
    width, depth, storey = 14.0, 9.0, 3.3
    front = depth / 2
    parts = [
        box(f"{name}_plinth", (width + 0.6, 0.3, depth + 0.6), (0, 0.15, 0), mats["dark"], 0.04),
        box(f"{name}_ground", (width, storey, depth), (0, 0.3 + storey / 2, 0), mats["white"], 0.08),
        box(f"{name}_upper", (width, storey, depth - 1.5), (0, 0.3 + storey * 1.5, -0.75), primary, 0.08),
        box(f"{name}_slab", (width + 0.3, 0.25, depth + 0.3), (0, 0.3 + storey, 0), mats["white"], 0.05),
        box(f"{name}_glass_front", (width - 0.6, storey - 0.6, 0.1), (0, 0.3 + storey / 2, front + 0.02), mats["glass"], 0.02),
        box(f"{name}_upper_glass", (width - 2.0, 1.4, 0.1), (0, 0.3 + storey * 1.5 + 0.2, front - 1.5 + 0.02), mats["glass"], 0.02),
        box(f"{name}_upper_band", (width + 0.02, 0.3, depth - 1.48), (0, 0.3 + storey * 2 - 0.4, -0.75), accent, 0.02),
        box(f"{name}_roof", (width + 0.4, 0.2, depth + 0.4), (0, 0.3 + storey * 2 + 0.1, 0), mats["white"], 0.05),
        box(f"{name}_canopy", (width - 2.0, 0.12, depth - 2.0), (0, 0.3 + storey * 2 + 1.4, 0), secondary, 0.04),
        box(f"{name}_plate", (5.0, 0.8, 0.08), (0, 0.3 + storey * 2 - 0.9, front - 1.5 + 0.04), mats["plate"], 0.03),
        box(f"{name}_awning", (width - 1.0, 0.1, 2.2), (0, 0.3 + storey - 0.2, front + 1.1), secondary, 0.03),
        box(f"{name}_door", (1.8, 2.4, 0.12), (0, 1.5, front + 0.05), mats["dark"], 0.02),
    ]
    for index in range(9):
        mullion_x = -width / 2 + 0.3 + index * (width - 0.6) / 8
        parts.append(box(f"{name}_mullion{index}", (0.1, storey - 0.6, 0.16), (mullion_x, 0.3 + storey / 2, front + 0.05), mats["frame"], 0.01))
    for index in range(15):
        rail_x = -width / 2 + 0.2 + index * (width - 0.4) / 14
        parts.append(box(f"{name}_baluster{index}", (0.05, 1.0, 0.05), (rail_x, 0.3 + storey + 0.6, front - 0.05), mats["steel"], 0.0))
    parts.append(box(f"{name}_handrail", (width, 0.06, 0.08), (0, 0.3 + storey + 1.1, front - 0.05), mats["steel"], 0.01))
    for corner_x in (-width / 2 + 1.2, width / 2 - 1.2):
        for corner_z in (-front + 1.2, front - 1.2):
            parts.append(box(f"{name}_canopy_post{corner_x}{corner_z}", (0.1, 1.3, 0.1), (corner_x, 0.3 + storey * 2 + 0.75, corner_z), mats["frame"], 0.01))
        parts.append(box(f"{name}_awning_post{corner_x}", (0.08, storey - 0.2, 0.08), (corner_x, 0.3 + (storey - 0.2) / 2, front + 2.1), mats["frame"], 0.01))
    # outside stair to the terrace on the +x end
    for step in range(11):
        parts.append(box(f"{name}_stair{step}", (1.2, 0.08, 0.32), (width / 2 + 0.75, 0.3 + step * 0.3, front - 0.3 - step * 0.3), mats["steel"], 0.01))
    parts.append(slab(f"{name}_stringer", [(front, 0.3), (front - 3.6, 3.6), (front - 3.6, 3.4), (front - 0.2, 0.0)], 0.06, mats["frame"],
                      plane="side", center=(width / 2 + 1.38, 0, 0), round_by=0.0))
    for planter_x in (-5.5, -3.0, 3.0, 5.5):
        parts.append(box(f"{name}_planter{planter_x}", (0.8, 0.6, 0.8), (planter_x, 0.6, front + 2.5), mats["dark"], 0.06))
        parts.append(cylinder(f"{name}_shrub{planter_x}", 0.42, 0.6, (planter_x, 1.2, front + 2.5), mats["foliage"], sides=12, round_by=0.2))
    combine(f"{name}_body", parts, parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    for team in ("halvard", "ostrava", "kestrel", "sable"):
        truck(team, mats)
    for team in ("halvard", "ostrava", "kestrel"):
        hospitality(team, mats)
    export("paddock.glb")


if __name__ == "__main__":
    build()
