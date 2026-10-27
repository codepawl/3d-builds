"""Ramp family: baggage tugs (2 colours), dollies (2), belt loader, ramp handlers (2), generic narrowbody aircraft.
Vehicles face -Y (front at -Y). Origins at floor level on the vehicle centre line."""
import math
import sys

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, add_clip, empty, export_glb, mat, reset_scene


def wheel(root, name, radius, width, axle, tyre, hub):
    """A wheel object whose origin is on the axle, so it spins about X."""
    part = Part(name)
    part.cyl(radius, width, axle, tyre, axis="X", segs=24, bevel=0.02)
    part.cyl(radius * 0.55, width + 0.02, axle, hub, axis="X", segs=16, bevel=0.005)
    part.cyl(radius * 0.15, width + 0.04, axle, mat("leg_dark"), axis="X", segs=8, bevel=0.002)
    obj = part.build(root, pivot=axle)
    add_clip(obj, "wheel_roll", "rotation_euler", 0, [(1, 0.0), (7, math.pi / 2), (13, math.pi), (19, 3 * math.pi / 2), (25, 2 * math.pi)])
    return obj


def tug(variant, color):
    root = empty(f"baggage_tug_{variant}")
    body = Part(f"baggage_tug_{variant}_body")
    paint = mat(f"tug_paint_{variant}", color, rough=0.4)
    dark = mat("leg_dark")
    black = mat("rubber_black")
    body.box((1.2, 2.7, 0.3), (0, 0.05, 0.5), mat("tug_chassis", "steel_dark", rough=0.6, metal=0.4), bevel=0.03, seg=2)
    body.box((1.3, 0.95, 0.5), (0, -0.95, 0.95), paint, bevel=0.07, seg=4)                      # hood
    body.box((1.0, 0.04, 0.2), (0, -1.43, 0.9), black, bevel=0.01)                              # grille
    body.box((1.4, 1.15, 0.12), (0, 0.45, 0.7), paint, bevel=0.03, seg=2)                       # driver deck
    body.box((1.4, 1.05, 0.5), (0, 1.0, 0.95), paint, bevel=0.07, seg=4)                        # rear bodywork / battery
    body.box((0.5, 0.45, 0.14), (0, 0.4, 0.9), black, bevel=0.04, seg=3)                        # seat
    body.box((0.5, 0.1, 0.5), (0, 0.65, 1.15), black, bevel=0.04, seg=3)
    body.box((1.05, 0.12, 0.3), (0, -0.4, 1.12), paint, bevel=0.04, seg=3)                      # dash
    body.cyl(0.03, 0.4, (0, -0.28, 1.35), dark, bevel=0.003, rot=(0.5, 0, 0))                  # steering column
    body.cyl(0.14, 0.03, (0, -0.2, 1.5), black, bevel=0.005, rot=(0.5, 0, 0))                  # steering wheel
    for sx in (1, -1):
        body.box((0.06, 0.06, 0.95), (sx * 0.62, -0.35, 1.2), dark, bevel=0.008)
        body.box((0.06, 0.06, 0.95), (sx * 0.62, 0.7, 1.2), dark, bevel=0.008)
        body.box((0.2, 0.35, 0.05), (sx * 0.68, 0.45, 0.62), dark, bevel=0.01)                  # step plate
        for y in (-0.95, 0.95):
            body.box((0.26, 0.5, 0.04), (sx * 0.64, y, 0.6), dark, bevel=0.01)                    # mudguard base
    body.box((1.4, 1.35, 0.07), (0, 0.17, 1.68), paint, bevel=0.02, seg=2)                      # canopy roof
    body.box((0.2, 0.2, 0.18), (0.0, 1.25, 1.2), dark, bevel=0.02)                              # battery cover
    body.box((0.16, 0.5, 0.12), (0, 1.55, 0.55), dark, bevel=0.015)                              # hitch bar
    body.cyl(0.03, 0.2, (0, 1.78, 0.58), mat("safety_yellow"), bevel=0.003)                      # hitch pin
    body.build(root)
    for index, side in enumerate(("l", "r")):
        lamp = Part(f"baggage_tug_{variant}_headlamp_{side}")
        lamp.box((0.18, 0.05, 0.1), ((-1 if side == "l" else 1) * 0.42, -1.43, 1.12), mat("tug_headlamp", "white", rough=0.3, emit="white", emit_strength=1.2), bevel=0.01)
        lamp.build(root)
    beacon = Part(f"baggage_tug_{variant}_beacon")
    beacon.cyl(0.07, 0.12, (0, 0.17, 1.78), mat("tug_beacon", "yellow", rough=0.3, emit="yellow", emit_strength=0.8), segs=16, bevel=0.01)
    beacon.build(root)
    for name, x, y in (("fl", 0.58, -0.9), ("fr", -0.58, -0.9), ("rl", 0.58, 0.85), ("rr", -0.58, 0.85)):
        wheel(root, f"baggage_tug_{variant}_wheel_{name}", 0.3, 0.22, (x, y, 0.3), mat("tyre", "rubber", rough=0.95), mat("hub_steel", "steel", rough=0.4, metal=0.6))


def dolly(variant, color, caged):
    root = empty(f"dolly_{variant}")
    body = Part(f"dolly_{variant}_body")
    frame = mat(f"dolly_frame_{variant}", color, rough=0.45)
    dark = mat("leg_dark")
    length, width = 3.0, 1.9
    body.box((width, length, 0.12), (0, 0, 0.4), mat("dolly_deck", "steel", rough=0.5, metal=0.5), bevel=0.015)
    body.box((width + 0.1, 0.1, 0.18), (0, length / 2, 0.38), frame, bevel=0.02)
    body.box((width + 0.1, 0.1, 0.18), (0, -length / 2, 0.38), frame, bevel=0.02)
    for sx in (1, -1):
        body.box((0.08, length, 0.16), (sx * (width / 2 + 0.02), 0, 0.38), frame, bevel=0.015)
        for y in (-1.0, 1.0):
            body.box((0.4, 0.45, 0.1), (sx * 0.5, y, 0.28), dark, bevel=0.01)
            body.cyl(0.125, 0.12, (sx * 0.8, y, 0.125), mat("rubber_black"), axis="X", segs=16, bevel=0.005)
    if caged:
        for sx in (1, -1):
            for y in (-1.4, 0.0, 1.4):
                body.box((0.05, 0.05, 0.5), (sx * (width / 2 - 0.02), y, 0.7), frame, bevel=0.008)
            body.box((0.04, length, 0.04), (sx * (width / 2 - 0.02), 0, 0.95), frame, bevel=0.008)
        body.box((width, 0.04, 0.04), (0, length / 2 - 0.02, 0.95), frame, bevel=0.008)
    else:
        for x in (-0.55, 0.0, 0.55):
            body.box((0.1, length * 0.94, 0.02), (x, 0, 0.465), dark, bevel=0.004)           # roller strips for ULDs
    body.box((0.06, 0.7, 0.06), (0, -length / 2 - 0.35, 0.35), dark, bevel=0.01)             # drawbar
    body.cyl(0.07, 0.05, (0, -length / 2 - 0.68, 0.35), dark, bevel=0.005)
    body.build(root)


def belt_loader():
    root = empty("belt_loader")
    body = Part("belt_loader_body")
    paint = mat("loader_paint", "blue", rough=0.4)
    dark = mat("leg_dark")
    body.box((2.0, 3.0, 0.7), (0, 0.4, 0.75), paint, bevel=0.06, seg=3)
    body.box((1.9, 3.1, 0.12), (0, 0.4, 0.4), mat("tug_chassis"), bevel=0.02)
    body.box((1.8, 1.2, 0.08), (0, 1.55, 1.14), mat("loader_deck", "steel_dark", rough=0.6), bevel=0.015)       # operator platform
    for sx in (1, -1):
        body.box((0.07, 0.07, 0.9), (sx * 0.85, 1.05, 1.6), dark, bevel=0.01)
        body.box((0.07, 0.07, 0.9), (sx * 0.85, 2.0, 1.6), dark, bevel=0.01)
        body.box((0.05, 1.0, 0.05), (sx * 0.9, 1.55, 1.7), mat("safety_yellow"), bevel=0.008)               # handrail
        body.box((0.2, 0.2, 1.0), (sx * 0.8, -0.3, 1.5), paint, bevel=0.03, seg=2)                          # hinge towers
    body.box((1.9, 1.3, 0.07), (0, 1.55, 2.1), paint, bevel=0.02, seg=2)                                    # canopy
    body.box((0.5, 0.3, 0.5), (0.5, 1.2, 1.5), mat("cam_black"), bevel=0.02)                                # control panel
    body.box((0.45, 0.01, 0.3), (0.5, 1.06, 1.55), mat("screen_dark"), bevel=0.003, seg=1)
    body.box((1.7, 0.05, 0.25), (0, -1.12, 0.75), mat("tug_chassis"), bevel=0.01)                           # front bumper
    for sx in (1, -1):
        body.box((0.12, 0.05, 0.08), (sx * 0.7, -1.12, 0.9), mat("tug_headlamp"), bevel=0.01)
    body.build(root)
    boom = Part("belt_loader_boom")
    hinge_y, hinge_z, boom_length = -0.3, 1.3, 4.6
    centre_y = hinge_y - boom_length / 2
    boom.box((0.92, boom_length, 0.16), (0, centre_y, hinge_z - 0.12), mat("boom_frame", "steel", rough=0.45, metal=0.5), bevel=0.02)
    for sx in (1, -1):
        boom.box((0.06, boom_length, 0.16), (sx * 0.5, centre_y, hinge_z + 0.0), paint, bevel=0.015)
        for k in range(5):
            boom.box((0.05, 0.05, 0.4), (sx * 0.5, hinge_y - 0.4 - k * 0.95, hinge_z + 0.2), dark, bevel=0.006)
        boom.box((0.05, boom_length, 0.05), (sx * 0.5, centre_y, hinge_z + 0.4), mat("safety_yellow"), bevel=0.008)
    boom.box((0.9, 0.2, 0.16), (0, hinge_y - boom_length - 0.1, hinge_z - 0.02), mat("rubber_black"), bevel=0.04, seg=2)   # tip bumper
    boom.cyl(0.07, 0.9, (0, hinge_y - boom_length + 0.1, hinge_z - 0.02), dark, axis="X", bevel=0.005)
    boom_object = boom.build(root, pivot=(0, hinge_y, hinge_z))
    belt = Part("belt_loader_belt")
    belt.box((0.74, boom_length - 0.2, 0.04), (0, centre_y, hinge_z + 0.04), mat("belt_rubber"), bevel=0.004, seg=1)
    belt.build(boom_object, pivot=(0, hinge_y, hinge_z))
    add_clip(boom_object, "boom_lower", "rotation_euler", 0, [(1, -math.radians(25)), (48, 0.0)])
    add_clip(boom_object, "boom_raise", "rotation_euler", 0, [(1, 0.0), (48, -math.radians(25))])
    for name, x, y in (("fl", 0.95, -0.7), ("fr", -0.95, -0.7), ("rl", 0.95, 1.5), ("rr", -0.95, 1.5)):
        wheel(root, f"belt_loader_wheel_{name}", 0.38, 0.28, (x, y, 0.38), mat("tyre"), mat("hub_steel"))


def handler(variant, vest_color):
    root = empty(f"handler_{variant}")
    part = Part(f"handler_{variant}_body")
    vest = mat(f"vest_{variant}", vest_color, rough=0.6, emit=vest_color, emit_strength=0.15)
    navy = mat("handler_pants", "navy", rough=0.8)
    skin = mat("handler_skin", "sand", rough=0.7)
    part.box((0.16, 0.18, 0.82), (0.1, 0, 0.41), navy, bevel=0.03, seg=2)
    part.box((0.16, 0.18, 0.82), (-0.1, 0, 0.41), navy, bevel=0.03, seg=2)
    part.box((0.42, 0.26, 0.55), (0, 0, 1.1), vest, bevel=0.05, seg=3)
    part.box((0.43, 0.27, 0.05), (0, 0, 1.05), mat("vest_stripe", "white", rough=0.5), bevel=0.01)
    for sx in (1, -1):
        part.box((0.11, 0.13, 0.5), (sx * 0.27, 0, 1.08), navy, bevel=0.03, seg=2)
    part.cyl(0.13, 0.2, (0, 0, 1.46), skin, bevel=0.01, segs=16)
    part.cyl(0.15, 0.1, (0, 0, 1.6), mat("helmet", "white", rough=0.4), bevel=0.02, segs=16)
    part.build(root)


def aircraft():
    root = empty("aircraft_narrowbody")
    fuselage_radius, axis_z, half_length = 1.975, 3.9, 18.8
    body = Part("aircraft_narrowbody_fuselage")
    rings = []
    for k in range(41):
        t = k / 40.0
        y = -half_length + 2 * half_length * t
        if t < 0.12:
            scale = math.sqrt(max(t / 0.12, 0.0)) * 0.93 + 0.07
            lift = -0.15 * (1 - t / 0.12)
        elif t < 0.66:
            scale, lift = 1.0, 0.0
        else:
            u = (t - 0.66) / 0.34
            scale = 1.0 - 0.88 * u ** 1.4
            lift = 1.0 * u ** 2
        rings.append([(fuselage_radius * scale * math.cos(2 * math.pi * j / 24),
                       y, axis_z + lift + fuselage_radius * scale * math.sin(2 * math.pi * j / 24)) for j in range(24)])
    body.skin(rings, mat("aircraft_white", "white", rough=0.35), bevel=0.0)
    body.box((3.9, 0.12, 0.5), (0, -17.2, axis_z + 0.35), mat("cockpit_glass", "screen", rough=0.1), bevel=0.04)    # cockpit glazing band
    for side in (1, -1):
        angle = math.radians(18)
        for k in range(26):
            y = -12.2 + k * 0.54
            body.box((0.03, 0.28, 0.36), (side * fuselage_radius * math.cos(angle) * 1.0, y, axis_z + fuselage_radius * math.sin(angle)),
                     mat("cabin_window", "screen", rough=0.15), bevel=0.01, rot=(0, side * angle, 0))
    body.box((3.95, 0.05, 0.06), (0, 0, axis_z - 0.2), mat("belly_band", "steel", rough=0.5), bevel=0.01)
    # wings
    wing_mat = mat("aircraft_wing", "white", rough=0.4)
    for side in (1, -1):
        sections = []
        for x, y_front, chord, z in ((1.6, -1.0, 6.2, axis_z - 0.9), (6.5, 1.8, 3.8, axis_z - 0.55), (17.6, 8.2, 1.5, axis_z + 0.3)):
            sections.append([(side * x, y_front, z), (side * x, y_front + chord * 0.35, z + 0.14), (side * x, y_front + chord, z + 0.02),
                             (side * x, y_front + chord * 0.35, z - 0.12)])
        body.skin(sections, wing_mat, bevel=0.0)
        body.box((0.05, 1.0, 0.55), (side * 17.65, 8.7, axis_z + 0.7), mat("wingtip_blue", "blue", rough=0.4), bevel=0.01, rot=(0, 0, 0))   # sharklet
        engine_x = side * 5.7
        body.cyl(0.85, 3.3, (engine_x, 0.7, axis_z - 1.9), mat("engine_grey", "alu", rough=0.35, metal=0.5), axis="Y", segs=24, bevel=0.03)
        body.cyl(0.62, 0.12, (engine_x, -0.9, axis_z - 1.9), mat("engine_inlet", "black", rough=0.5), axis="Y", segs=24, bevel=0.01)
        body.box((0.15, 2.4, 0.9), (engine_x, 0.8, axis_z - 1.15), wing_mat, bevel=0.02)
        body.cyl(0.55, 0.9, (engine_x, 2.35, axis_z - 1.9), mat("engine_grey"), axis="Y", segs=20, radius2=0.2, bevel=0.01)
    # tail
    body.skin([[(-0.1, 12.6, axis_z + 1.2), (0.1, 12.6, axis_z + 1.2), (0.1, 16.0, axis_z + 1.2), (-0.1, 16.0, axis_z + 1.2)],
               [(-0.06, 15.4, axis_z + 7.7), (0.06, 15.4, axis_z + 7.7), (0.06, 17.6, axis_z + 7.7), (-0.06, 17.6, axis_z + 7.7)]],
              wing_mat, bevel=0.0)
    body.box((0.14, 1.6, 0.5), (0, 16.6, axis_z + 7.5), mat("wingtip_blue"), bevel=0.02)
    for side in (1, -1):
        body.skin([[(side * 0.9, 14.5, axis_z + 1.6), (side * 0.9, 17.0, axis_z + 1.6), (side * 0.9, 17.0, axis_z + 1.5), (side * 0.9, 14.5, axis_z + 1.5)],
                   [(side * 6.0, 17.2, axis_z + 2.1), (side * 6.0, 18.4, axis_z + 2.1), (side * 6.0, 18.4, axis_z + 2.02), (side * 6.0, 17.2, axis_z + 2.02)]],
                  wing_mat, bevel=0.0)
    # landing gear
    gear = mat("gear_dark", "steel_dark", rough=0.5, metal=0.5)
    tyre = mat("tyre")
    for x, y in ((2.1, 1.2), (-2.1, 1.2)):
        body.box((0.2, 0.25, 1.9), (x, y, 1.0), gear, bevel=0.02)
        for dx in (-0.2, 0.2):
            body.cyl(0.5, 0.25, (x + dx * 1.0, y, 0.5), tyre, axis="X", segs=20, bevel=0.02)
    body.box((0.16, 0.2, 1.4), (0, -14.0, 1.5), gear, bevel=0.02)
    for dx in (-0.2, 0.2):
        body.cyl(0.35, 0.2, (dx, -14.0, 0.35), tyre, axis="X", segs=20, bevel=0.02)
    body.build(root)
    door = Part("aircraft_hold_door")
    angle = math.radians(40)
    door_x = -fuselage_radius * math.cos(angle) - 0.02
    door_z = axis_z - fuselage_radius * math.sin(angle)
    door.box((0.05, 1.3, 1.1), (door_x, 4.0, door_z), mat("hold_door", "steel", rough=0.45, metal=0.3), bevel=0.012, rot=(0, math.pi - angle, 0))
    pivot = door.build(root, pivot=(door_x, 4.0, door_z + 0.55))
    add_clip(pivot, "door_close", "rotation_euler", 1, [(1, math.radians(70)), (30, 0.0)])
    add_clip(pivot, "door_open", "rotation_euler", 1, [(1, 0.0), (30, math.radians(70))])


def main():
    reset_scene()
    tug("blue", "blue")
    tug("teal", "teal")
    dolly("uld", "blue", caged=False)
    dolly("bag", "steel", caged=True)
    belt_loader()
    handler("yellow", "yellow")
    handler("orange", "orange")
    aircraft()
    export_glb("ramp.glb")


main()
