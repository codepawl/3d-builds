"""Pit stop and garage equipment: pitgear.glb (refs/pit_tools.md, refs/tyre.md).

Roots (origin on the ground unless noted, facing +forward):
  front_jack        1.8 m quick-lift jack; front_jack_lever (pole, saddle and handle) pivots about x at its origin,
                    the wheel axle: rotate x by +0.12 rad to lift the saddle (handle goes down)
  rear_jack         1.1 m jack, same rig: rear_jack_lever
  wheel_gun         origin at the grip, for <crew>_grip_R; socket points +forward
  tyre_<compound>   bare 18 in rear-size tyre on its rim, standing, origin at the hub (soft, medium, hard, inter, wet)
  tyre_front_<compound>  front-size tyre, same
  blanket_<compound>     tyre wrapped in a team blanket with a compound tag, origin at the hub
  tyre_rack_<compound>   trolley with four blanketed tyres (soft, medium, hard)
  tyre_stack_<compound>  four bare tyres lying flat (inter, wet)
  car_stand_front, car_stand_rear   garage stands (0.45 m cradle)
  release_gantry    pit box light gantry 2.6 m; lamps release_gantry_red / _amber / _green are separate objects
                    the app shows or hides (glow materials)
  tool_trolley      garage tool chest on castors
  tyre_cart         two-wheel hand cart carrying one tyre to the box
"""
import math

from lib import anchor, box, combine, cylinder, export, material, reset_scene, root, sphere
from parts import COMPOUNDS, palette, race_wheel, ring, tube

REAR = (0.355, 0.375)
FRONT = (0.3525, 0.28)


def jack(name, length, saddle_up, mats):
    group = root(name)
    frame = [
        box(f"{name}_base", (0.28, 0.06, 0.34), (0, 0.1, 0.05), mats["frame"], 0.015),
        cylinder(f"{name}_axle", 0.018, 0.36, (0, 0.1, 0), mats["steel"], axis="x", sides=8),
    ]
    for side in (-1, 1):
        frame.append(cylinder(f"{name}_wheel{side}", 0.1, 0.05, (side * 0.17, 0.1, 0), mats["rubber"], axis="x", sides=16, round_by=0.012))
        frame.append(cylinder(f"{name}_hub{side}", 0.045, 0.056, (side * 0.17, 0.1, 0), mats["steel"], axis="x", sides=10))
    combine(f"{name}_frame", frame, parent=group)
    accent = mats["halvard_primary"]
    handle_end = (0, 0.95, -(length - 0.3))
    lever = [
        tube(f"{name}_pole", [(0, 0.1, 0.22), (0, 0.1, 0), handle_end], 0.022, accent, sides=10),
        tube(f"{name}_tbar", [(-0.22, handle_end[1], handle_end[2]), (0.22, handle_end[1], handle_end[2])], 0.02, mats["dark"], sides=8),
        box(f"{name}_saddle", (0.3, 0.05, 0.12), (0, saddle_up, 0.26), mats["dark"], 0.015),
        box(f"{name}_saddle_post", (0.05, saddle_up - 0.08, 0.05), (0, (saddle_up + 0.1) / 2, 0.24), mats["steel"], 0.01),
        box(f"{name}_pedal", (0.12, 0.02, 0.1), (0.12, 0.12, -0.18), mats["steel"], 0.006),
        box(f"{name}_grip_tape", (0.05, 0.05, 0.25), (0, 0.9, -(length - 0.45)), mats["rubber"], 0.02),
    ]
    combine(f"{name}_lever", lever, origin=(0, 0.1, 0), parent=group)
    anchor(f"{name}_handle", handle_end, group)
    return group


def wheel_gun(mats):
    group = root("wheel_gun")
    accent = mats["halvard_primary"]
    parts = [
        box("gun_grip", (0.05, 0.16, 0.06), (0, 0.0, 0.0), mats["rubber"], 0.02),
        cylinder("gun_body", 0.06, 0.26, (0, 0.11, 0.09), accent, axis="forward", sides=16, round_by=0.015),
        cylinder("gun_motor", 0.068, 0.08, (0, 0.11, -0.04), mats["dark"], axis="forward", sides=16, round_by=0.012),
        cylinder("gun_anvil", 0.03, 0.06, (0, 0.11, 0.25), mats["steel"], axis="forward", sides=12),
        cylinder("gun_socket", 0.042, 0.07, (0, 0.11, 0.3), mats["chrome"], axis="forward", sides=6, round_by=0.006),
        box("gun_trigger", (0.02, 0.05, 0.02), (0, 0.04, 0.04), mats["dark"], 0.006),
        box("gun_light", (0.03, 0.015, 0.05), (0, 0.175, 0.1), mats["glow_green"], 0.005),
        tube("gun_hose", [(0, -0.08, 0), (0, -0.2, -0.05), (0, -0.3, -0.2), (0, -0.32, -0.45)], 0.014, mats["rubber"], sides=8),
        cylinder("gun_coupling", 0.022, 0.05, (0, -0.08, 0), mats["chrome"], axis="up", sides=8),
    ]
    combine("wheel_gun_body", parts, parent=group)
    return group


def bare_tyre(name, size, compound, mats):
    radius, width = size
    group = root(name)
    hub = (0, radius, 0)
    tyre = race_wheel(f"{name}_wheel", radius, width, hub, None, mats[f"compound_{compound}"], mats, mats["rim"])
    tyre.parent = group
    return group


def blanket_parts(name, centre, compound, mats, team="halvard"):
    radius, width = REAR
    x, up, forward = centre
    blanket = material(f"blanket_{team}", "#2b2f37", roughness=0.9)
    return [
        cylinder(f"{name}_wrap", radius + 0.03, width + 0.05, centre, blanket, axis="x", sides=32, round_by=0.06),
        ring(f"{name}_trim_out", radius - 0.02, radius + 0.025, 0.01, (x + width / 2 + 0.03, up, forward), mats[f"{team}_primary"], sides=32),
        ring(f"{name}_trim_in", radius - 0.02, radius + 0.025, 0.01, (x - width / 2 - 0.03, up, forward), mats[f"{team}_primary"], sides=32),
        cylinder(f"{name}_cuff", 0.2, width + 0.07, centre, mats["dark"], axis="x", sides=24),
        box(f"{name}_tag", (width + 0.08, 0.12, 0.16), (x, up + radius + 0.02, forward), mats[f"compound_{compound}"], 0.02),
        box(f"{name}_plug", (0.04, 0.05, 0.05), (x + width / 2 + 0.03, up + 0.25, forward - 0.1), mats["glow_amber"], 0.01),
    ]


def blanketed(name, compound, mats):
    group = root(name)
    combine(f"{name}_body", blanket_parts(name, (0, REAR[0] + 0.03, 0), compound, mats), parent=group)
    return group


def tyre_rack(name, compound, mats):
    group = root(name)
    frame = mats["frame"]
    parts = []
    for corner_x in (-0.5, 0.5):
        for corner_z in (-0.42, 0.42):
            parts.append(box(f"{name}_post{corner_x}{corner_z}", (0.04, 1.75, 0.04), (corner_x, 0.98, corner_z), frame, 0.01))
            parts.append(cylinder(f"{name}_castor{corner_x}{corner_z}", 0.05, 0.04, (corner_x, 0.05, corner_z), mats["rubber"], axis="x", sides=12))
    for level_up in (0.12, 0.95, 1.85):
        for corner_z in (-0.42, 0.42):
            parts.append(box(f"{name}_rail{level_up}{corner_z}", (1.04, 0.04, 0.04), (0, level_up, corner_z), frame, 0.01))
        parts.append(box(f"{name}_shelf{level_up}", (1.0, 0.025, 0.8), (0, level_up + 0.02, 0), mats["steel"], 0.006))
    parts.append(tube(f"{name}_handle", [(-0.45, 1.2, -0.46), (-0.45, 1.2, -0.56), (0.45, 1.2, -0.56), (0.45, 1.2, -0.46)], 0.016, mats["halvard_primary"], sides=8))
    for level_index, level_up in enumerate((0.15, 0.98)):
        for slot_index, slot_x in enumerate((-0.23, 0.23)):
            parts += blanket_parts(f"{name}_t{level_index}{slot_index}", (slot_x, level_up + REAR[0] + 0.05, 0), compound, mats)
    # blanketed tyres stand side by side, axis across x, so the rack holds two per level
    combine(f"{name}_body", parts, parent=group)
    return group


def tyre_stack(name, compound, mats):
    group = root(name)
    radius, width = REAR
    parts = []
    for level in range(4):
        up = width / 2 + level * (width + 0.005)
        parts.append(cylinder(f"{name}_tyre{level}", radius, width, (0, up, 0), mats["rubber"], axis="up", sides=32, round_by=width * 0.22))
        parts.append(cylinder(f"{name}_rim{level}", 0.2285, width + 0.016, (0, up, 0), mats["rim"], axis="up", sides=24))
        band = cylinder(f"{name}_band{level}", radius * 0.88, width + 0.008, (0, up, 0), mats[f"compound_{compound}"], axis="up", sides=32)
        parts.append(band)
        parts.append(cylinder(f"{name}_inner{level}", radius * 0.83, width + 0.012, (0, up, 0), mats["rubber"], axis="up", sides=32))
    combine(f"{name}_body", parts, parent=group)
    return group


def car_stand(name, cradle_up, mats):
    group = root(name)
    parts = [
        box(f"{name}_foot", (0.9, 0.05, 0.5), (0, 0.025, 0), mats["frame"], 0.015),
        box(f"{name}_column", (0.12, cradle_up, 0.12), (0, cradle_up / 2, 0), mats["halvard_primary"], 0.02),
        box(f"{name}_cradle", (0.5, 0.04, 0.2), (0, cradle_up, 0), mats["rubber"], 0.015),
    ]
    for side in (-1, 1):
        parts.append(tube(f"{name}_brace{side}", [(side * 0.42, 0.05, 0), (side * 0.05, cradle_up * 0.7, 0)], 0.018, mats["frame"], sides=6))
        parts.append(box(f"{name}_lug{side}", (0.04, 0.08, 0.2), (side * 0.25, cradle_up + 0.05, 0), mats["rubber"], 0.01))
    combine(f"{name}_body", parts, parent=group)
    return group


def release_gantry(mats):
    group = root("release_gantry")
    frame = mats["frame"]
    parts = []
    for side in (-1, 1):
        parts.append(box(f"gantry_post{side}", (0.12, 2.6, 0.12), (side * 1.2, 1.3, 0), frame, 0.02))
        parts.append(box(f"gantry_foot{side}", (0.4, 0.04, 0.4), (side * 1.2, 0.02, 0), mats["steel"], 0.01))
    parts.append(box("gantry_beam", (2.6, 0.18, 0.18), (0, 2.6, 0), frame, 0.03))
    parts.append(box("gantry_tray", (2.4, 0.06, 0.12), (0, 2.45, -0.04), mats["dark"], 0.01))
    parts.append(box("gantry_plate", (0.9, 0.22, 0.02), (0.75, 2.6, 0.1), mats["halvard_primary"], 0.01))
    for index, lamp_x in enumerate((-0.45, -0.15, 0.15)):
        parts.append(box(f"gantry_housing{index}", (0.26, 0.3, 0.16), (lamp_x, 2.35, 0.03), mats["dark"], 0.03))
        parts.append(cylinder(f"gantry_visor{index}", 0.1, 0.06, (lamp_x, 2.36, 0.14), mats["dark"], axis="forward", sides=16))
    combine("release_gantry_frame", parts, parent=group)
    for index, (colour, lamp_x) in enumerate((("red", -0.45), ("amber", -0.15), ("green", 0.15))):
        lamp = cylinder(f"release_gantry_{colour}_lens", 0.085, 0.02, (lamp_x, 2.36, 0.115), mats[f"glow_{colour}"], axis="forward", sides=20)
        combine(f"release_gantry_{colour}", [lamp], origin=(lamp_x, 2.36, 0.115), parent=group)
    return group


def tool_trolley(mats):
    group = root("tool_trolley")
    primary = mats["halvard_primary"]
    parts = [box("trolley_chest", (0.9, 0.85, 0.5), (0, 0.55, 0), primary, 0.03),
             box("trolley_top", (0.94, 0.04, 0.54), (0, 0.99, 0), mats["rubber"], 0.01)]
    for index in range(5):
        up = 0.25 + index * 0.15
        parts.append(box(f"trolley_drawer{index}", (0.84, 0.12, 0.02), (0, up, 0.255), mats["white"], 0.008))
        parts.append(box(f"trolley_pull{index}", (0.4, 0.015, 0.02), (0, up + 0.04, 0.27), mats["chrome"], 0.005))
    for corner_x in (-0.38, 0.38):
        for corner_z in (-0.18, 0.18):
            parts.append(cylinder(f"trolley_castor{corner_x}{corner_z}", 0.055, 0.04, (corner_x, 0.06, corner_z), mats["rubber"], axis="x", sides=12))
    parts.append(tube("trolley_handle", [(-0.47, 0.9, -0.2), (-0.55, 0.9, -0.2), (-0.55, 0.9, 0.2), (-0.47, 0.9, 0.2)], 0.014, mats["chrome"], sides=6))
    parts.append(box("trolley_laptop", (0.34, 0.02, 0.24), (0.15, 1.02, 0), mats["dark"], 0.006))
    parts.append(box("trolley_screen", (0.34, 0.22, 0.015), (0.15, 1.13, -0.12), mats["screen"], 0.004))
    combine("tool_trolley_body", parts, parent=group)
    return group


def tyre_cart(mats):
    group = root("tyre_cart")
    parts = [tube("cart_frame", [(-0.2, 0.08, 0.15), (-0.2, 1.1, -0.15), (0.2, 1.1, -0.15), (0.2, 0.08, 0.15)], 0.016, mats["frame"], sides=8),
             box("cart_toe", (0.45, 0.02, 0.25), (0, 0.04, 0.25), mats["steel"], 0.006)]
    for side in (-1, 1):
        parts.append(cylinder(f"cart_wheel{side}", 0.11, 0.05, (side * 0.27, 0.11, 0.0), mats["rubber"], axis="x", sides=16, round_by=0.01))
    parts += blanket_parts("cart_tyre", (0, REAR[0] + 0.05, 0.22), "medium", mats)
    combine("tyre_cart_body", parts, parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    jack("front_jack", 1.8, 0.2, mats)
    jack("rear_jack", 1.1, 0.3, mats)
    wheel_gun(mats)
    for compound in COMPOUNDS:
        bare_tyre(f"tyre_{compound}", REAR, compound, mats)
        bare_tyre(f"tyre_front_{compound}", FRONT, compound, mats)
        blanketed(f"blanket_{compound}", compound, mats)
    for compound in ("soft", "medium", "hard"):
        tyre_rack(f"tyre_rack_{compound}", compound, mats)
    for compound in ("inter", "wet"):
        tyre_stack(f"tyre_stack_{compound}", compound, mats)
    car_stand("car_stand_front", 0.42, mats)
    car_stand("car_stand_rear", 0.5, mats)
    release_gantry(mats)
    tool_trolley(mats)
    tyre_cart(mats)
    export("pitgear.glb")


if __name__ == "__main__":
    build()
