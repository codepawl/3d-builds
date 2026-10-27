"""Steel sit-down roller coaster: coaster.glb and coaster_track.json (refs/coaster_train.md, refs/coaster_track.md).

Roots:
  coaster_track      rails + box spine + ties swept along the spline, origin at the layout centre
  coaster_supports   tubular columns and footings, twin splayed legs where the track is high
  coaster_lift       chain trough on the lift hill, drive house at its foot, anti-rollback strip
  coaster_brakes     brake fins on the final approach and in the station
  coaster_station    loading station: platform, canopy, air gates, operator booth with `status` lamp
  coaster_train_a/b  five cars each (car_1 lead .. car_5), every car pivots at the track centreline
                     at its own centre; the app places each car on the spline separately.
coaster_track.json: points every 1 m in app space, up vectors (banking), and distances (m) for the
station, lift and brake sections. Car pitch along the track is 2.9 m.
"""
import math

from mathutils import Vector

from lib import box, combine, cylinder, export, loft, material, reset_scene, root, sphere
from parts import beam_between, catmull_rom, circle_profile, frames, palette, resample, sweep, write_path_json

CONTROL = [
    (-58, 4, -8), (-54, 2.4, -16), (-48, 1.5, -20), (-40, 1.5, -20), (-32, 1.5, -20), (-25, 1.5, -20), (-18, 2.4, -20), (-10, 9.3, -20), (0, 18.0, -20),
    (10, 26.7, -20), (16, 31.3, -20), (21, 32.6, -20), (25, 31.6, -20), (30, 24.0, -20), (36, 13.0, -20),
    (42, 5.0, -20), (48, 3.2, -19), (56, 6, -14), (61, 10, -3), (60, 13, 8), (54, 14, 16), (45, 12, 20.5),
    (35, 7, 21), (27, 12, 21), (20, 17.5, 21), (13, 12, 21), (5, 6, 21), (-8, 4.5, 21), (-25, 8, 21),
    (-40, 11, 19), (-52, 9, 12), (-58, 6, 2),
]
RAIL_HALF_GAUGE = 0.55
SPINE_DROP = 0.6
CAR_LENGTH = 2.6
CAR_PITCH = 2.9


def track_path():
    dense = catmull_rom(CONTROL, closed=True, steps=30)
    samples, total = resample(dense, 1.0)
    count = len(samples)
    turn = []
    for index in range(count):
        behind = samples[index - 1]
        ahead = samples[(index + 1) % count]
        here = samples[index]
        first = Vector((here.x - behind.x, 0, here.z - behind.z))
        second = Vector((ahead.x - here.x, 0, ahead.z - here.z))
        if first.length < 1e-3 or second.length < 1e-3:
            turn.append(0.0)
            continue
        signed = math.atan2(first.x * second.z - first.z * second.x, first.dot(second))
        turn.append(signed)
    window = 6
    banks = []
    for index in range(count):
        average = sum(turn[(index + offset) % count] for offset in range(-window, window + 1)) / (2 * window + 1)
        banks.append(max(-1.05, min(1.05, -average * 11)))
    return samples, frames(samples, banks), total


def section_distances(samples):
    station = [i for i, p in enumerate(samples) if abs(p.z + 20) < 0.5 and -48 <= p.x <= -24 and p.y < 2.0]
    lift = [i for i, p in enumerate(samples) if abs(p.z + 20) < 0.5 and -20 <= p.x <= 19 and p.y > 2.0]
    brakes = [i for i, p in enumerate(samples) if p.x < -49 and p.z < -10 and p.y < 3.2]
    return {
        "station": [min(station), max(station)], "lift": [min(lift), max(lift)],
        "brakes": [min(brakes), max(brakes)] if brakes else [], "carPitch": CAR_PITCH, "spacing": 1.0,
    }


def build_track(mats, samples, path_frames):
    group = root("coaster_track")
    rails = [sweep(f"rail_{side}", samples, path_frames, circle_profile(side * RAIL_HALF_GAUGE, 0, 0.08, 8), mats["brand"])
             for side in (-1, 1)]
    spine = sweep("spine", samples, path_frames,
                  [(-0.2, -SPINE_DROP - 0.2), (0.2, -SPINE_DROP - 0.2), (0.24, -SPINE_DROP), (0.2, -SPINE_DROP + 0.2),
                   (-0.2, -SPINE_DROP + 0.2), (-0.24, -SPINE_DROP)], mats["brand"])
    ties = []
    for index in range(0, len(samples), 2):
        here = samples[index]
        tangent, side, up = path_frames[index]
        for direction in (-1, 1):
            start = here + side * direction * RAIL_HALF_GAUGE + up * -0.04
            end = here + up * (-SPINE_DROP + 0.12) + side * direction * 0.12
            ties.append(beam_between(f"tie_{index}_{direction}", tuple(start), tuple(end), 0.045, mats["brand_dark"], sides=6))
    combine("coaster_track_rails", rails + [spine], parent=group)
    combine("coaster_track_ties", ties, parent=group)
    return group


def build_supports(mats, samples, path_frames):
    group = root("coaster_supports")
    parts = []
    footings = []
    for index in range(3, len(samples), 7):
        here = samples[index]
        tangent, side, up = path_frames[index]
        base = here + up * (-SPINE_DROP - 0.2)
        if base.y < 1.2:
            continue
        radius = 0.22 + min(0.2, base.y * 0.006)
        flat_side = Vector((side.x, 0, side.z)).normalized()
        if base.y > 14:
            for direction in (-1, 1):
                foot = Vector((base.x, 0, base.z)) + flat_side * direction * base.y * 0.16
                parts.append(beam_between(f"leg_{index}_{direction}", tuple(base), tuple(foot), radius, mats["support"], sides=12))
                footings.append(box(f"foot_{index}_{direction}", (1.1, 0.35, 1.1), (foot.x, 0.17, foot.z), mats["concrete"], 0.05))
            middle = base.y * 0.5
            left = Vector((base.x, middle, base.z)) + flat_side * -base.y * 0.08
            right = Vector((base.x, middle, base.z)) + flat_side * base.y * 0.08
            parts.append(beam_between(f"brace_{index}", tuple(left), tuple(right), radius * 0.5, mats["support"], sides=8))
        else:
            foot = Vector((base.x, 0, base.z))
            parts.append(beam_between(f"col_{index}", tuple(base), tuple(foot), radius, mats["support"], sides=12))
            footings.append(box(f"foot_{index}", (0.9, 0.3, 0.9), (foot.x, 0.15, foot.z), mats["concrete"], 0.05))
        parts.append(sphere(f"saddle_{index}", radius * 1.25, tuple(base), mats["support"], segments=10))
    combine("coaster_support_columns", parts, parent=group)
    combine("coaster_support_footings", footings, parent=group)
    return group


def build_lift(mats, samples, path_frames, sections):
    group = root("coaster_lift")
    start, end = sections["lift"]
    lift_samples = samples[start:end + 1]
    lift_frames = path_frames[start:end + 1]
    trough = sweep("lift_trough", lift_samples, lift_frames,
                   [(-0.16, -0.18), (0.16, -0.18), (0.16, 0.0), (-0.16, 0.0)], mats["steel_dark"], closed=False)
    chain = sweep("lift_chain", lift_samples, lift_frames,
                  [(-0.07, 0.0), (0.07, 0.0), (0.07, 0.05), (-0.07, 0.05)], mats["dark"], closed=False)
    walkway = sweep("lift_walkway", lift_samples, lift_frames,
                    [(0.75, -0.25), (1.45, -0.25), (1.45, -0.18), (0.75, -0.18)], mats["steel"], closed=False)
    handrail = sweep("lift_handrail", lift_samples, lift_frames, circle_profile(1.45, 0.8, 0.035, 6), mats["support"], closed=False)
    posts = []
    for index in range(0, len(lift_samples), 2):
        tangent, side, up = lift_frames[index]
        bottom = lift_samples[index] + side * 1.45 + up * -0.2
        top = lift_samples[index] + side * 1.45 + up * 0.8
        posts.append(beam_between(f"lift_post_{index}", tuple(bottom), tuple(top), 0.03, mats["support"], sides=6))
    combine("coaster_lift_chain", [trough, chain], parent=group)
    combine("coaster_lift_walkway", [walkway, handrail] + posts, parent=group)
    foot = samples[start]
    house = [
        box("drive_house", (3.2, 2.6, 3.6), (foot.x - 1.0, 1.3, foot.z - 3.6), mats["panel"], 0.12),
        box("drive_roof", (3.5, 0.25, 3.9), (foot.x - 1.0, 2.7, foot.z - 3.6), mats["brand_dark"], 0.08),
        box("drive_door", (1.0, 2.0, 0.06), (foot.x - 1.6, 1.0, foot.z - 1.77), mats["steel_dark"], 0.02),
        box("drive_vent", (1.2, 0.6, 0.06), (foot.x - 0.2, 1.8, foot.z - 1.77), mats["dark"], 0.02),
        box("drive_plate", (0.6, 0.3, 0.04), (foot.x - 0.2, 0.9, foot.z - 1.77), mats["sign_blank"], 0.01),
    ]
    combine("coaster_lift_drive", house, parent=group)
    return group


def build_brakes(mats, samples, path_frames, sections):
    group = root("coaster_brakes")
    fins = []
    ranges = [sections["station"]]
    if sections["brakes"]:
        ranges.append(sections["brakes"])
    for first, last in ranges:
        for index in range(first, last + 1, 2):
            here = samples[index]
            tangent, side, up = path_frames[index]
            fin = box(f"fin_{index}", (0.03, 0.22, 1.6), tuple(here + up * -0.2), mats["brass"], 0.01)
            fin.rotation_mode = "QUATERNION"
            from lib import point
            fin.rotation_quaternion = Vector((0, -1, 0)).rotation_difference(point(*tangent).normalized())
            fins.append(fin)
    combine("coaster_brake_fins", fins, parent=group)
    return group


def build_station(mats):
    """Loading station on the straight at z = -20 from x = -48 to -24, platform on the +z side."""
    group = root("coaster_station", (-36, 0, -20))
    deck_top = 0.95
    parts = [
        box("platform", (26, deck_top, 4.2), (0, deck_top / 2, 3.0), mats["concrete"], 0.08),
        box("exit_platform", (26, deck_top, 2.4), (0, deck_top / 2, -2.4), mats["concrete"], 0.08),
        box("trench", (26, 0.15, 1.6), (0, 0.08, 0), mats["steel_dark"], 0.02),
        box("platform_edge", (26, 0.04, 0.25), (0, deck_top + 0.02, 1.0), material("edge_yellow", "#f2c53d", 0.6), 0.01),
    ]
    roof = []
    for x in range(-12, 13, 4):
        for z in (-3.4, 4.9):
            roof.append(cylinder(f"col_{x}_{z}", 0.16, 4.6, (x, deck_top + 2.3, z), mats["support"], sides=12, round_by=0.03))
    roof += [
        box("canopy", (27.5, 0.35, 9.6), (0, deck_top + 4.75, 0.75), mats["brand"], 0.12),
        box("canopy_fascia", (27.8, 0.6, 0.25), (0, deck_top + 4.6, 5.6), mats["white"], 0.06),
        box("canopy_fascia_back", (27.8, 0.6, 0.25), (0, deck_top + 4.6, -4.1), mats["white"], 0.06),
        box("canopy_light", (24, 0.06, 0.3), (0, deck_top + 4.55, 3.0), mats["glow_warm"], 0.01),
    ]
    gates = []
    for car in range(5):
        for row in (-0.55, 0.55):
            x = (car - 2) * CAR_PITCH + row
            gates += [
                box(f"gate_post_{car}_{row}", (0.08, 1.1, 0.08), (x - 0.42, deck_top + 0.55, 1.45), mats["steel"], 0.02),
                box(f"gate_bar_{car}_{row}", (0.75, 0.06, 0.05), (x, deck_top + 0.95, 1.45), mats["brand"], 0.02),
                box(f"gate_bar_low_{car}_{row}", (0.75, 0.06, 0.05), (x, deck_top + 0.55, 1.45), mats["brand"], 0.02),
            ]
    booth = [
        box("booth", (2.4, 2.6, 2.2), (14.2, deck_top + 1.3, 3.6), mats["white"], 0.1),
        box("booth_window", (0.06, 1.0, 1.6), (13.0, deck_top + 1.7, 3.6), mats["glass"], 0.02),
        box("booth_roof", (2.7, 0.2, 2.5), (14.2, deck_top + 2.7, 3.6), mats["brand_dark"], 0.06),
        box("console", (1.2, 1.0, 0.5), (12.4, deck_top + 0.5, 3.0), mats["dark"], 0.06),
        box("console_screen", (0.7, 0.04, 0.35), (12.4, deck_top + 1.02, 3.0), mats["screen"], 0.01),
    ]
    stairs = []
    for step in range(5):
        stairs.append(box(f"stair_{step}", (1.6, deck_top * (5 - step) / 5, 0.32), (-14.2, deck_top * (5 - step) / 10, 4.0 + step * 0.32), mats["concrete"], 0.03))
    combine("coaster_station_deck", parts + stairs, origin=(0, 0, 0), parent=group)
    combine("coaster_station_canopy", roof, parent=group)
    combine("coaster_station_gates", gates, parent=group)
    combine("coaster_station_booth", booth, parent=group)
    lamp = cylinder("coaster_station_status", 0.12, 0.25, (14.2, deck_top + 3.0, 3.6), mats["status"], sides=12)
    lamp.parent = group
    for obj in group.children:
        obj.location = obj.location
    return group


def build_car(name, mats, body, trim, lead, parent, z_offset):
    seat = mats["seat"]
    parts = [
        box(f"{name}_floor", (1.55, 0.14, CAR_LENGTH - 0.1), (0, 0.48, 0), body, 0.05),
        box(f"{name}_skirt", (1.62, 0.36, CAR_LENGTH - 0.2), (0, 0.38, 0), trim, 0.08),
    ]
    for side in (-1, 1):
        parts += [
            box(f"{name}_wall_{side}", (0.14, 0.62, CAR_LENGTH), (side * 0.8, 0.82, 0), body, 0.06),
            box(f"{name}_stripe_{side}", (0.02, 0.1, CAR_LENGTH - 0.3), (side * 0.875, 0.88, 0), mats["white"], 0.01),
            box(f"{name}_plate_{side}", (0.02, 0.18, 0.4), (side * 0.875, 0.66, 0.85), mats["sign_blank"], 0.01),
        ]
    parts += [box(f"{name}_front_wall", (1.7, 0.66, 0.14), (0, 0.84, CAR_LENGTH / 2 - 0.07), body, 0.06),
              box(f"{name}_back_wall", (1.7, 0.62, 0.14), (0, 0.82, -CAR_LENGTH / 2 + 0.07), body, 0.06),
              box(f"{name}_bumper", (1.2, 0.18, 0.12), (0, 0.42, -CAR_LENGTH / 2 - 0.05), mats["rubber"], 0.05)]
    for row_z in (0.55, -0.6):
        for side in (-1, 1):
            x = side * 0.36
            parts += [
                box(f"{name}_cushion_{row_z}_{side}", (0.56, 0.14, 0.48), (x, 0.62, row_z - 0.05), seat, 0.05),
                box(f"{name}_back_{row_z}_{side}", (0.56, 0.72, 0.14), (x, 0.98, row_z - 0.32), seat, 0.06),
                box(f"{name}_headrest_{row_z}_{side}", (0.36, 0.3, 0.16), (x, 1.45, row_z - 0.33), seat, 0.08),
                box(f"{name}_lapbar_{row_z}_{side}", (0.5, 0.08, 0.08), (x, 0.92, row_z + 0.18), mats["chrome"], 0.03),
                box(f"{name}_lapbar_arm_{row_z}_{side}", (0.06, 0.3, 0.06), (x, 0.8, row_z + 0.1), mats["chrome"], 0.02),
            ]
    if lead:
        nose = loft(f"{name}_nose", [
            (CAR_LENGTH / 2 - 0.05, 0.85, 0.36, 0.78), (CAR_LENGTH / 2 + 0.35, 0.8, 0.32, 0.72),
            (CAR_LENGTH / 2 + 0.75, 0.6, 0.24, 0.62), (CAR_LENGTH / 2 + 1.0, 0.3, 0.14, 0.55),
            (CAR_LENGTH / 2 + 1.08, 0.0, 0.0, 0.52)], body, sides=24)
        parts += [nose,
                  box(f"{name}_headlamp_l", (0.2, 0.08, 0.06), (0.4, 0.78, CAR_LENGTH / 2 + 0.5), mats["glow_cool"], 0.02),
                  box(f"{name}_headlamp_r", (0.2, 0.08, 0.06), (-0.4, 0.78, CAR_LENGTH / 2 + 0.5), mats["glow_cool"], 0.02)]
    for side in (-1, 1):
        for axle_z in (0.8, -0.8):
            x = side * RAIL_HALF_GAUGE
            parts += [
                box(f"{name}_bogie_{side}_{axle_z}", (0.1, 0.6, 0.55), (x + side * 0.16, 0.08, axle_z), mats["steel_dark"], 0.03),
                cylinder(f"{name}_road_{side}_{axle_z}", 0.11, 0.09, (x, 0.2, axle_z), mats["rubber"], axis="x", sides=14, round_by=0.02),
                cylinder(f"{name}_up_{side}_{axle_z}", 0.08, 0.08, (x, -0.17, axle_z), mats["rubber"], axis="x", sides=12, round_by=0.02),
                cylinder(f"{name}_guide_{side}_{axle_z}", 0.08, 0.07, (x + side * 0.12, 0.0, axle_z), mats["rubber"], axis="up", sides=12, round_by=0.02),
                cylinder(f"{name}_hub_{side}_{axle_z}", 0.05, 0.1, (x, 0.2, axle_z), mats["steel"], axis="x", sides=10),
            ]
    parts.append(box(f"{name}_chassis", (1.3, 0.16, 2.0), (0, 0.32, 0), mats["steel_dark"], 0.04))
    return combine(name, parts, origin=(0, 0, 0), parent=parent)


def build_train(name, mats, body, trim):
    group = root(name)
    for index in range(5):
        car = build_car(f"{name}_car_{index + 1}", mats, body, trim, index == 0, group, 0)
        car.location.y = -(2 - index) * CAR_PITCH
    return group


def build():
    reset_scene()
    mats = palette()
    samples, path_frames, total = track_path()
    sections = section_distances(samples)
    build_track(mats, samples, path_frames)
    build_supports(mats, samples, path_frames)
    build_lift(mats, samples, path_frames, sections)
    build_brakes(mats, samples, path_frames, sections)
    build_station(mats)
    build_train("coaster_train_a", mats, mats["brand"], mats["white"])
    violet = material("train_violet", "#7c6fe0", roughness=0.4, metallic=0.1)
    train_b = build_train("coaster_train_b", mats, violet, mats["white"])
    train_b.location.x = 4
    export("coaster.glb")
    write_path_json("coaster_track.json", samples, path_frames, {"length": round(total, 2), **sections, "closed": True})


if __name__ == "__main__":
    build()
