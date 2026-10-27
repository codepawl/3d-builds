"""Station kit -> station.glb. Modules run along +X (9.8 m = two train door pitches); platform top z = 1.1, rail head z = 0."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lib
from lib import Mesh, empty, material, pal

MODULE_LENGTH = 9.8
PLATFORM_HALF_WIDTH = 5.4
PSD_PLANE_Y = 5.3  # reference only: the app puts door units and panels on this plane
PSD_POST_X = 1.05
PSD_UNIT_WIDTH = 2.22  # outer width of the door frame; panels fill from here
PSD_LEAF_Y = 0.16  # leaves run on the track side of the frame so they slide past posts and panels
PLATFORM_LIP_BOTTOM = 0.45
PLATFORM_CORE_HALF_WIDTH = 4.8
PLATFORM_TOP = 1.1
MEZZANINE_TOP = 6.6
ESCALATOR_RISE = 5.5
RISER = ESCALATOR_RISE / 26
TREAD = RISER / math.tan(math.radians(30))
LANDING = 1.6


def tile_material():
    return material("StationTile", "#D8DEE6", 0.4)


def build_station_module():
    """Platform, floor, edge strips and structure. The screen-door wall is built per station by the app from Psd_* parts."""
    module = Mesh("Station_Module")
    concrete = pal("concrete")
    # Platform slab with its lip overhanging the track: the lower core stays narrower so bogies and ballast clear it.
    module.box((MODULE_LENGTH, 2 * PLATFORM_HALF_WIDTH, PLATFORM_TOP - PLATFORM_LIP_BOTTOM), (0, 0, (PLATFORM_TOP + PLATFORM_LIP_BOTTOM) / 2), concrete, bevel=0.03)
    module.box((MODULE_LENGTH, 2 * PLATFORM_CORE_HALF_WIDTH, PLATFORM_LIP_BOTTOM + 0.3), (0, 0, (PLATFORM_LIP_BOTTOM - 0.3) / 2), concrete, bevel=0.0)
    floor_tile = material("PlatformTile", "#E6EAF0", 0.5)
    module.box((MODULE_LENGTH - 0.04, 2 * PLATFORM_HALF_WIDTH - 1.2, 0.02), (0, 0, 1.1), floor_tile, bevel=0.004)
    for line in range(1, 7):
        module.box((0.03, 2 * PLATFORM_HALF_WIDTH - 1.2, 0.025), (-MODULE_LENGTH / 2 + line * 1.4, 0, 1.105), pal("body_grey"), bevel=0.003)
    yellow = pal("yellow")
    for side in (-1, 1):
        module.box((MODULE_LENGTH, 0.5, 0.025), (0, side * 5.15, 1.105), yellow, bevel=0.005)
        module.box((MODULE_LENGTH, 0.06, 0.03), (0, side * 4.85, 1.107), pal("body_white"), bevel=0.003)
    module.box((0.9, 0.6, MEZZANINE_TOP - PLATFORM_TOP), (0, 0, (MEZZANINE_TOP + PLATFORM_TOP) / 2), concrete, bevel=0.06)
    module.box((0.95, 0.65, 0.3), (0, 0, 1.25), pal("concrete_dark"), bevel=0.04)
    return module


def psd_materials():
    indicator = material("PsdIndicator", "#27D17F", 0.3, 0, "#27D17F", 3.0)
    glass = material("PsdGlass", "#9CC4DE", 0.08, 0.0, alpha=0.45)
    return pal("steel"), glass, indicator


def build_psd_door_unit():
    """One screen door: frame, header with indicator, two leaves. Origin at the door centre on the PSD plane, z = rail head.
    The track side is +Y; the app turns the unit half a turn for the other face. Leaves slide +-1.0 m along X in front of the frame."""
    steel, glass, indicator = psd_materials()
    unit = empty("Psd_DoorUnit")
    frame = Mesh("Psd_DoorUnit_Frame")
    for edge in (-1, 1):
        frame.box((0.12, 0.2, 2.1), (edge * PSD_POST_X, 0, 2.15), steel, bevel=0.02)
    frame.box((PSD_UNIT_WIDTH, 0.3, 0.3), (0, 0, 3.35), steel, bevel=0.03)
    frame.box((PSD_UNIT_WIDTH, 0.3, 0.12), (0, 0, PLATFORM_TOP + 0.06), steel, bevel=0.02)
    frame.box((1.6, 0.04, 0.08), (0, 0.17, 3.35), indicator, bevel=0.005)
    frame.build(unit)
    for leaf_name, leaf_offset in (("a", -0.5), ("b", 0.5)):
        leaf = Mesh(f"Psd_Leaf_{leaf_name}", (leaf_offset, PSD_LEAF_Y, 2.15))
        leaf.box((0.98, 0.06, 2.05), (0, 0, 0), glass, bevel=0.01)
        leaf.box((0.98, 0.07, 0.08), (0, 0, 0.98), steel, bevel=0.01)
        leaf.box((0.98, 0.07, 0.08), (0, 0, -0.98), steel, bevel=0.01)
        leaf.box((0.06, 0.08, 1.9), (-leaf_offset * 0.9, 0, 0), steel, bevel=0.01)
        leaf.build(unit)
    return unit


def build_psd_panel():
    """Fixed glass panel, 1.0 m long, centred on its origin. The app scales it along X to fill the gap between door units."""
    steel, glass, _ = psd_materials()
    panel = Mesh("Psd_Panel")
    panel.box((1.0, 0.05, 2.0), (0, 0, 2.15), glass, bevel=0.01)
    panel.box((1.0, 0.3, 0.3), (0, 0, 3.35), steel, bevel=0.015)
    panel.box((1.0, 0.3, 0.12), (0, 0, PLATFORM_TOP + 0.06), steel, bevel=0.015)
    return panel


def build_psd_end_post():
    steel, _, _ = psd_materials()
    post = Mesh("Psd_EndPost")
    post.box((0.1, 0.2, 2.1), (0, 0, 2.15), steel, bevel=0.02)
    return post


def build_floor_module():
    floor = Mesh("Station_Floor")
    floor.box((MODULE_LENGTH, 23.0, 0.6), (0, 0, -0.5), pal("concrete_dark"), bevel=0.03)
    return floor


def build_wall_module():
    wall = Mesh("Station_Wall")
    tile = tile_material()
    wall.box((MODULE_LENGTH, 0.5, 8.2), (0, -11.75, 3.3), pal("concrete"), bevel=0.03)
    wall.box((MODULE_LENGTH - 0.1, 0.04, 3.4), (0, -11.48, 1.5), tile, bevel=0.01)
    wall.box((MODULE_LENGTH - 0.1, 0.04, 0.5), (0, -11.48, 3.45), pal("teal"), bevel=0.01)
    for index in range(4):
        wall.box((0.06, 0.05, 3.4), (-MODULE_LENGTH / 2 + 0.05 + index * 2.4, -11.47, 1.5), pal("body_grey"), bevel=0.005)
    lamp = material("WallLamp", "#FFF4D6", 0.3, 0, "#FFF1C8", 3.0)
    for index in range(3):
        wall.box((1.0, 0.06, 0.18), (-3.2 + index * 3.2, -11.46, 4.9), lamp, bevel=0.01)
    wall.box((1.4, 0.06, 2.3), (-3.0, -11.47, 2.25), pal("dark_metal"), bevel=0.02)
    wall.box((0.2, 0.08, 0.08), (-2.3, -11.43, 2.4), pal("steel"), bevel=0.01)
    return wall


def build_mezzanine_module():
    mezzanine = Mesh("Mezzanine_Module")
    mezzanine.box((MODULE_LENGTH, 23.0, 0.6), (0, 0, MEZZANINE_TOP - 0.3), pal("concrete"), bevel=0.03)
    mezzanine.box((MODULE_LENGTH - 0.1, 22.6, 0.02), (0, 0, MEZZANINE_TOP + 0.005), material("MezzanineFloor", "#E1E5EB", 0.5), bevel=0.003)
    mezzanine.box((MODULE_LENGTH, 0.15, 1.0), (0, 11.4, MEZZANINE_TOP + 0.5), material("MezzanineRail", "#9CC4DE", 0.1, 0, alpha=0.45), bevel=0.01)
    mezzanine.box((MODULE_LENGTH, 0.1, 0.06), (0, 11.4, MEZZANINE_TOP + 1.03), pal("steel"), bevel=0.01)
    return mezzanine


def build_escalator():
    rise = ESCALATOR_RISE
    run = rise / math.tan(math.radians(30))
    frame = Mesh("Escalator")
    steel = pal("steel")
    dark = pal("dark_metal")
    glass = material("EscalatorGlass", "#A8CFE6", 0.08, 0.0, alpha=0.4)
    top_x = LANDING + run
    for side in (-1, 1):
        y = side * 0.64
        outline = [(0, -0.05), (LANDING + 0.2, -0.05), (top_x, rise - 0.05), (top_x + LANDING, rise - 0.05),
                   (top_x + LANDING, rise - 0.75), (top_x - 0.3, rise - 0.75), (LANDING + 0.1, -0.75), (0, -0.75)]
        frame.prism(outline, y - 0.06, y + 0.06, dark)
        frame.box((LANDING + 0.1, 0.05, 0.9), (LANDING / 2, y * 1.04, 0.45), glass, bevel=0.005)
        frame.box((LANDING + 0.1, 0.05, 0.9), (top_x + LANDING / 2, y * 1.04, rise + 0.45), glass, bevel=0.005)
        incline_start = (LANDING, 0.0)
        incline_end = (top_x, rise)
        length = math.hypot(incline_end[0] - incline_start[0], incline_end[1] - incline_start[1])
        mid = ((incline_start[0] + incline_end[0]) / 2, y * 1.04, (incline_start[1] + incline_end[1]) / 2 + 0.45)
        frame.box((length, 0.05, 0.9), mid, glass, bevel=0.005, rotation=(0, -math.radians(30), 0))
        handrail = pal("rubber")
        frame.box((LANDING + 0.1, 0.09, 0.07), (LANDING / 2, y * 1.04, 0.95), handrail, bevel=0.02)
        frame.box((length, 0.09, 0.07), (mid[0], mid[1], mid[2] + 0.5), handrail, bevel=0.02, rotation=(0, -math.radians(30), 0))
        frame.box((LANDING + 0.1, 0.09, 0.07), (top_x + LANDING / 2, y * 1.04, rise + 0.95), handrail, bevel=0.02)
        frame.cylinder(0.12, 0.09, (0.0, y * 1.04, 0.85), handrail, axis="Y", segments=12)
        frame.cylinder(0.12, 0.09, (top_x + LANDING, y * 1.04, rise + 0.85), handrail, axis="Y", segments=12)
    frame.box((0.3, 1.2, 0.05), (0.15, 0, 0.0), steel, bevel=0.01)
    frame.box((0.3, 1.2, 0.05), (top_x + LANDING - 0.15, 0, rise), steel, bevel=0.01)
    frame_object = frame.build()

    steps = Mesh("Escalator_Steps")
    yellow = pal("yellow")
    profile = [(0.0, -0.4), (0.0, 0.0), (LANDING, 0.0)]
    for index in range(26):
        x = LANDING + index * TREAD
        z = index * RISER
        profile += [(x, z + RISER), (x + TREAD, z + RISER)]
    profile += [(top_x + LANDING, rise), (top_x + LANDING, rise - 0.45), (top_x - 0.2, rise - 0.45), (LANDING + 0.2, -0.45)]
    deduplicated = []
    for point in profile:
        if not deduplicated or (abs(point[0] - deduplicated[-1][0]) > 1e-6 or abs(point[1] - deduplicated[-1][1]) > 1e-6):
            deduplicated.append(point)
    steps.prism(deduplicated, -0.45, 0.45, material("EscalatorStep", "#7A838F", 0.5, 0.6))
    for index in range(26):
        steps.box((0.04, 0.9, 0.012), (LANDING + index * TREAD + 0.03, 0, (index + 1) * RISER + 0.003), yellow, bevel=0.002)
    steps.build(frame_object)
    return frame_object


def build_stairs():
    stairs = Mesh("Stairs")
    concrete = pal("concrete")
    count = int(ESCALATOR_RISE / 0.16)
    for index in range(count):
        stairs.box((0.3, 1.8, 0.16), (index * 0.3 + 0.15, 0, index * 0.16 + 0.08), concrete, bevel=0.01)
    stairs.prism([(0, -0.5), (0, 0), (count * 0.3, count * 0.16), (count * 0.3, count * 0.16 - 0.5)], -0.9, 0.9, pal("concrete_dark"))
    for side in (-1, 1):
        stairs.box((count * 0.3, 0.06, 0.06), (count * 0.15, side * 0.95, count * 0.08 + 0.95),
                   pal("steel"), bevel=0.01, rotation=(0, -math.atan2(count * 0.16, count * 0.3), 0))
    return stairs


def build_gateline():
    gateline = empty("Gateline")
    body = Mesh("Gateline_Body")
    dark = pal("dark_metal")
    white = pal("body_white")
    display = material("GateDisplay", "#27D17F", 0.3, 0, "#27D17F", 2.5)
    pitch = 0.85
    for index in range(7):
        y = (index - 3) * pitch
        body.box((0.9, 0.28, 1.0), (0, y, 0.5), white, bevel=0.03)
        body.box((0.5, 0.2, 0.06), (0.15, y, 1.02), dark, bevel=0.01)
        body.box((0.12, 0.18, 0.04), (-0.2, y, 1.04), display, bevel=0.004)
        body.box((0.3, 0.3, 0.08), (0.0, y, 0.04), dark, bevel=0.01)
    body.build(gateline)
    for index in range(6):
        y = (index - 2.5) * pitch
        for flap_name, flap_offset in (("a", -0.2), ("b", 0.2)):
            flap = Mesh(f"Gate_Flap_{index + 1}_{flap_name}", (flap_offset, y, 0.95))
            flap.box((0.34, 0.02, 0.28), (0, 0, 0), material("GateFlap", "#7FC4E8", 0.15, 0, alpha=0.6), bevel=0.004)
            flap.build(gateline)
    return gateline


def build_kiosk():
    kiosk = Mesh("Service_Kiosk")
    kiosk.box((2.2, 1.2, 1.1), (0, 0, 0.55), pal("body_white"), bevel=0.04)
    kiosk.box((2.3, 1.3, 0.06), (0, 0, 1.12), pal("teal"), bevel=0.02)
    kiosk.box((1.2, 0.04, 0.5), (0, 0.55, 1.4), material("KioskGlass", "#9CC4DE", 0.1, 0, alpha=0.45), bevel=0.005)
    kiosk.box((0.7, 0.04, 0.2), (0, -0.62, 0.9), material("KioskSign", "#FFF4D6", 0.3, 0, "#FFF1C8", 2.0), bevel=0.005)
    return kiosk


def build_bench():
    bench = Mesh("Bench")
    bench.box((1.8, 0.45, 0.06), (0, 0, 0.45), pal("teal"), bevel=0.02)
    for x in (-0.7, 0.7):
        bench.box((0.06, 0.4, 0.45), (x, 0, 0.22), pal("steel"), bevel=0.01)
    bench.box((1.8, 0.05, 0.3), (0, -0.2, 0.72), pal("teal"), bevel=0.02)
    return bench


def build_hanging_sign():
    sign = Mesh("Hanging_Sign")
    sign.box((2.6, 0.12, 0.7), (0, 0, 0), material("SignPlate", "#12A59A", 0.4, 0, "#12A59A", 0.45), bevel=0.04)
    sign.box((0.9, 0.13, 0.3), (-0.6, 0, 0), pal("body_white"), bevel=0.02)
    for x in (-1.0, 1.0):
        sign.cylinder(0.02, 1.2, (x, 0, 0.9), pal("steel"), segments=8)
    return sign


def build_street_entrance():
    entrance = Mesh("Street_Entrance")
    glass = material("EntranceGlass", "#A8CFE6", 0.08, 0.0, alpha=0.4)
    entrance.box((6.0, 4.2, 0.35), (0, 0, 3.4), pal("body_white"), bevel=0.05)
    entrance.box((6.1, 4.3, 0.1), (0, 0, 3.62), pal("teal"), bevel=0.03)
    for x in (-2.8, 2.8):
        for y in (-1.9, 1.9):
            entrance.box((0.14, 0.14, 3.3), (x, y, 1.65), pal("steel"), bevel=0.02)
    entrance.box((5.7, 0.05, 2.0), (0, -1.9, 1.9), glass, bevel=0.005)
    entrance.box((5.7, 0.05, 2.0), (0, 1.9, 1.9), glass, bevel=0.005)
    entrance.box((0.05, 3.7, 2.0), (-2.8, 0, 1.9), glass, bevel=0.005)
    entrance.box((1.6, 0.14, 0.5), (0, 2.15, 3.1), material("SignPlate", "#12A59A", 0.4, 0, "#12A59A", 0.45), bevel=0.03)
    entrance.box((5.0, 3.4, 0.05), (0, 0, 0.03), material("EntranceFloor", "#D6DCE4", 0.5), bevel=0.005)
    return entrance


def main():
    lib.reset_scene()
    roots = [build_station_module().build(), build_psd_door_unit()]
    for builder in (build_psd_panel, build_psd_end_post, build_floor_module, build_wall_module, build_mezzanine_module,
                    build_stairs, build_kiosk, build_bench, build_hanging_sign, build_street_entrance):
        roots.append(builder().build())
    roots.append(build_escalator())
    roots.append(build_gateline())
    for index, root in enumerate(roots):
        root.location = (0, index * 28.0, 0)
    lib.export_glb("station.glb", roots)


main()
