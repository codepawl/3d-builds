"""Log flume (jungle river ride): flume.glb and flume_path.json (refs/log_flume.md).

Roots:
  flume_channel   U trough swept along the spline with a water strip (no water on the lift), steel trestles
  flume_lift      lift conveyor belt with cleats and side walkway
  flume_pool      splash pool at the foot of the drop, flume_splash (spray the app shows and scales on a drop)
  flume_station   loading deck with timber posts, thatch-look roof, operator stand with flume_status lamp
  flume_log_a/b/c hollow log boats, origin on the trough floor at the boat centre, facing +forward
flume_path.json: points every 1 m along the trough floor, up vectors, and distances for station, lift and drop.
"""
import math

import bpy
from mathutils import Vector

import bmesh

from lib import box, combine, cylinder, export, loft, material, reset_scene, root, sphere
from parts import beam_between, catmull_rom, frames, palette, resample, sweep, write_path_json

CONTROL = [
    (-30, 0.4, -14), (-25, 0.4, -15), (-17, 0.4, -15), (-9, 0.4, -15), (-4, 0.7, -15), (4, 4.6, -15), (12, 8.6, -15),
    (20, 12.6, -15), (25, 14.0, -14.5), (30, 14.2, -9), (32, 14.1, -1), (28, 14.0, 7), (19, 13.8, 11.5), (9, 13.6, 12),
    (3, 12.6, 12), (-3, 8.0, 12), (-9, 2.6, 12), (-14, 0.5, 12), (-20, 0.4, 12), (-28, 0.4, 10), (-34, 0.4, 3), (-35, 0.4, -6),
]
U_PROFILE = [(-1.0, -0.15), (1.0, -0.15), (1.0, 0.8), (0.86, 0.8), (0.86, 0.02), (-0.86, 0.02), (-0.86, 0.8), (-1.0, 0.8)]


def trimmed_loft(name, sections, mat, keep, sides=40):
    """A loft with the faces removed whose centre fails keep(x, up, forward). lib.cut_loft tags faces by material
    index, but assigning the material afterwards resets the tags, so this trims by position instead."""
    obj = loft(name, sections, mat, sides=sides)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = []
    for face in bm.faces:
        center = face.calc_center_median()
        if not keep(center.x, center.z, -center.y):
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def flume_path():
    samples, total = resample(catmull_rom(CONTROL, closed=True, steps=30), 1.0)
    return samples, frames(samples, None), total


def sections(samples):
    def span(test):
        hits = [index for index, p in enumerate(samples) if test(p)]
        return [min(hits), max(hits)] if hits else []
    return {
        "station": span(lambda p: abs(p.z + 15) < 0.6 and -26 <= p.x <= -9),
        "lift": span(lambda p: abs(p.z + 15) < 0.8 and -5 <= p.x <= 23 and p.y > 0.6),
        "drop": span(lambda p: abs(p.z - 12) < 0.8 and -15 <= p.x <= 4 and p.y > 0.45),
        "spacing": 1.0,
    }


def build_channel(mats, samples, path_frames, spans):
    group = root("flume_channel")
    trough_mat = material("trough", "#e9eef4", roughness=0.5)
    trough = sweep("trough", samples, path_frames, U_PROFILE, trough_mat)
    lift_start, lift_end = spans["lift"]
    water_runs = [(lift_end, len(samples) - 1), (0, lift_start)]
    water = []
    for first, last in water_runs:
        water.append(sweep(f"water_{first}", samples[first:last + 1], path_frames[first:last + 1],
                           [(-0.86, 0.03), (0.86, 0.03), (0.86, 0.3), (-0.86, 0.3)], mats["water"], closed=False))
    trestles = []
    for index in range(0, len(samples), 5):
        here = samples[index]
        tangent, side, up = path_frames[index]
        if here.y < 1.2:
            continue
        flat_side = Vector((side.x, 0, side.z)).normalized()
        for direction in (-1, 1):
            top = here + flat_side * direction * 0.9 + Vector((0, -0.15, 0))
            trestles.append(beam_between(f"post_{index}_{direction}", tuple(top), (top.x, 0, top.z), 0.11, mats["steel_dark"], sides=8))
            trestles.append(box(f"pad_{index}_{direction}", (0.5, 0.2, 0.5), (top.x, 0.1, top.z), mats["concrete"], 0.03))
        left = here + flat_side * -1.0 + Vector((0, -0.2, 0))
        right = here + flat_side * 1.0 + Vector((0, -0.2, 0))
        trestles.append(beam_between(f"cap_{index}", tuple(left), tuple(right), 0.09, mats["steel_dark"], sides=6))
        if here.y > 5:
            low_left = Vector((left.x, here.y * 0.4, left.z))
            trestles.append(beam_between(f"x_{index}", tuple(low_left), tuple(right), 0.06, mats["steel_dark"], sides=6))
    combine("flume_trough", [trough], parent=group)
    combine("flume_water", water, parent=group)
    combine("flume_trestles", trestles, parent=group)
    return group


def build_lift(mats, samples, path_frames, spans):
    group = root("flume_lift")
    first, last = spans["lift"]
    lift_samples = samples[first:last + 1]
    lift_frames = path_frames[first:last + 1]
    belt = sweep("belt", lift_samples, lift_frames, [(-0.5, 0.03), (0.5, 0.03), (0.5, 0.12), (-0.5, 0.12)], mats["dark"], closed=False)
    walkway = sweep("walk", lift_samples, lift_frames, [(1.05, 0.55), (1.75, 0.55), (1.75, 0.62), (1.05, 0.62)], mats["steel"], closed=False)
    rail = sweep("rail", lift_samples, lift_frames, [(1.72, 1.55), (1.78, 1.55), (1.78, 1.6), (1.72, 1.6)], mats["support"], closed=False)
    cleats = []
    for index in range(0, len(lift_samples), 2):
        tangent, side, up = lift_frames[index]
        spot = lift_samples[index] + up * 0.16
        cleats.append(box(f"cleat_{index}", (0.9, 0.08, 0.08), tuple(spot), mats["steel_dark"], 0.02))
        post_bottom = lift_samples[index] + side * 1.75 + up * 0.6
        cleats.append(beam_between(f"rail_post_{index}", tuple(post_bottom), tuple(post_bottom + up * 1.0), 0.025, mats["support"], sides=6))
    combine("flume_lift_belt", [belt] + cleats, parent=group)
    combine("flume_lift_walkway", [walkway, rail], parent=group)
    return group


def build_pool(mats):
    group = root("flume_pool", (-17, 0, 12))
    parts = [
        box("pool_rim", (12.0, 0.5, 6.0), (0, 0.25, 0), mats["stone"], 0.12),
        box("pool_water", (11.2, 0.06, 5.2), (0, 0.48, 0), mats["water"], 0.02),
    ]
    for rock in range(7):
        angle = rock * 0.9
        parts.append(sphere(f"rock_{rock}", 0.6 + 0.15 * (rock % 3), (5.0 * math.cos(angle), 0.4, 2.8 * math.sin(angle)), mats["stone"], scale=(1.3, 0.7, 1.0), segments=10))
    combine("flume_pool_basin", parts, parent=group)
    spray_mat = material("spray", "#ffffff", roughness=0.2)
    spray = [sphere(f"spray_{n}", 1.0 + 0.3 * (n % 2), (math.cos(n * 1.3) * 1.2, 1.4 + n * 0.25, math.sin(n * 1.3) * 1.2), spray_mat, segments=12) for n in range(6)]
    combine("flume_splash", spray, origin=(0, 0.5, 0), parent=group)
    return group


def build_station(mats):
    group = root("flume_station", (-17.5, 0, -15))
    deck_top = 0.9
    parts = [box("deck", (18, deck_top, 4.0), (0, deck_top / 2, 3.0), mats["wood"], 0.06),
             box("deck_back", (18, deck_top, 2.0), (0, deck_top / 2, -2.0), mats["wood"], 0.06)]
    for plank in range(-8, 9, 2):
        parts.append(box(f"plank_{plank}", (0.06, 0.02, 4.0), (plank, deck_top + 0.01, 3.0), mats["wood_dark"], 0.0))
    for x in range(-8, 9, 4):
        for forward in (-2.6, 4.8):
            parts.append(cylinder(f"post_{x}_{forward}", 0.18, 4.0, (x, deck_top + 2.0, forward), mats["wood_dark"], sides=10, round_by=0.03))
    roof_mat = material("thatch", "#c9a764", roughness=0.95)
    parts += [
        box("roof_left", (19.5, 0.35, 5.0), (0, deck_top + 4.6, 3.3), roof_mat, 0.12),
        box("roof_right", (19.5, 0.35, 5.0), (0, deck_top + 4.6, -1.6), roof_mat, 0.12),
        box("ridge", (19.8, 0.3, 0.5), (0, deck_top + 5.25, 0.85), mats["wood_dark"], 0.1),
        box("stand", (1.2, 1.1, 0.7), (7.5, deck_top + 0.55, 4.2), mats["wood_dark"], 0.05),
        box("stand_screen", (0.8, 0.04, 0.4), (7.5, deck_top + 1.12, 4.2), mats["screen"], 0.01),
        box("sign_plate", (3.4, 0.8, 0.12), (0, deck_top + 3.6, 5.6), mats["sign_blank"], 0.04),
    ]
    combine("flume_station_deck", parts, parent=group)
    lamp = cylinder("flume_status", 0.1, 0.25, (7.5, deck_top + 1.4, 4.5), mats["status"], sides=12)
    lamp.parent = group
    return group


def build_log(name, mats, bark):
    bark_mat = material(f"bark_{bark.lstrip('#')}", bark, roughness=0.9)
    inner_mat = material("log_inside", "#e2c79a", roughness=0.6)
    sections = [(-2.3, 0.0, 0.0, 0.5), (-2.25, 0.4, 0.38, 0.5), (-2.0, 0.66, 0.5, 0.5), (0.0, 0.7, 0.5, 0.5),
                (2.0, 0.66, 0.5, 0.5), (2.25, 0.4, 0.38, 0.5), (2.3, 0.0, 0.0, 0.5)]
    shell = trimmed_loft(f"{name}_shell", sections, bark_mat, keep=lambda x, up, forward: up < 0.82 or abs(forward) > 1.9)
    inner = trimmed_loft(f"{name}_inner", [(p, rx * 0.86, ro * 0.86, off) for p, rx, ro, off in sections], inner_mat,
                     keep=lambda x, up, forward: up < 0.82 and abs(forward) < 2.0)
    inner.data.flip_normals()
    parts = [shell, inner]
    for band in (-1.6, -0.5, 0.6, 1.6):
        parts.append(trimmed_loft(f"{name}_ring_{band}", [(band - 0.04, 0.72, 0.52, 0.5), (band + 0.04, 0.72, 0.52, 0.5)],
                              mats["wood_dark"], keep=lambda x, up, forward: up < 0.84 and (abs(x) > 0.3 or up < 0.2)))
    for seat in (-1.2, 0.0, 1.2):
        parts.append(box(f"{name}_seat_{seat}", (0.9, 0.12, 0.35), (0, 0.42, seat), mats["seat"], 0.04))
    parts += [sphere(f"{name}_end_front", 0.32, (0, 0.62, 2.18), material("log_end", "#d6b07c", roughness=0.8), scale=(1.0, 1.0, 0.25), segments=14),
              box(f"{name}_grab", (0.7, 0.05, 0.05), (0, 0.95, 1.65), mats["chrome"], 0.02),
              box(f"{name}_plate", (0.02, 0.15, 0.4), (0.69, 0.55, 0.0), mats["sign_blank"], 0.01)]
    return combine(name, parts, origin=(0, 0, 0))


def build():
    reset_scene()
    mats = palette()
    samples, path_frames, total = flume_path()
    spans = sections(samples)
    build_channel(mats, samples, path_frames, spans)
    build_lift(mats, samples, path_frames, spans)
    build_pool(mats)
    build_station(mats)
    for index, bark in enumerate(("#8a5a3b", "#9b6a44", "#7a4f33")):
        boat = build_log(f"flume_log_{'abc'[index]}", mats, bark)
        boat.location.x = 45 + index * 3
    export("flume.glb")
    write_path_json("flume_path.json", samples, path_frames, {"length": round(total, 2), **spans, "closed": True, "boatLength": 4.6})


if __name__ == "__main__":
    build()
