"""Viaduct, depot, control centre, substation -> structures.glb; city blocks, buildings, trees -> city.glb."""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lib
from lib import Mesh, empty, material, pal

SPAN = 30.0
SHED_MODULE = 9.8


def rectangle_ring(x_or_z, half_a, half_b, vertical):
    corners = [(-half_a, -half_b), (half_a, -half_b), (half_a, half_b), (-half_a, half_b)]
    if vertical:
        return [(a, b, x_or_z) for a, b in corners]
    return [(x_or_z, a, b) for a, b in corners]


def build_viaduct_span():
    span = Mesh("Viaduct_Span")
    profile = [(-4.8, 0.0), (4.8, 0.0), (4.8, -0.3), (2.2, -0.9), (2.0, -2.0), (-2.0, -2.0), (-2.2, -0.9), (-4.8, -0.3)]
    rings = [[(x, y, z) for y, z in profile] for x in (-SPAN / 2 + 0.05, SPAN / 2 - 0.05)]
    span.loft(rings, pal("concrete"))
    glass = material("NoiseGlass", "#9CC4DE", 0.1, 0.0, alpha=0.45)
    for side in (-1, 1):
        span.box((SPAN - 0.1, 0.3, 0.7), (0, side * 4.65, 0.35), pal("concrete_dark"), bevel=0.04)
        span.box((SPAN - 0.1, 0.05, 1.0), (0, side * 4.7, 1.2), glass, bevel=0.005)
        span.box((SPAN - 0.1, 0.1, 0.08), (0, side * 4.7, 1.72), pal("steel"), bevel=0.01)
        for post in range(11):
            span.box((0.1, 0.12, 1.0), (-SPAN / 2 + 1.5 + post * 2.7, side * 4.7, 1.2), pal("steel"), bevel=0.01)
        span.box((SPAN - 0.1, 0.5, 0.2), (0, side * 4.0, 0.1), pal("body_grey"), bevel=0.02)
    for x in (-SPAN / 2 + 0.6, SPAN / 2 - 0.6):
        for y in (-1.3, 1.3):
            span.box((0.9, 0.9, 0.15), (x, y, -2.075), pal("rubber"), bevel=0.02)
    span.cylinder(0.08, SPAN - 1.0, (0, -3.5, -0.6), pal("steel"), axis="X", segments=10)
    return span


def build_viaduct_pier():
    pier = Mesh("Viaduct_Pier")
    concrete = pal("concrete")
    rings = [rectangle_ring(0.0, 0.9, 1.2, True), rectangle_ring(6.5, 0.9, 1.2, True),
             rectangle_ring(8.0, 1.1, 2.3, True), rectangle_ring(8.7, 1.1, 2.3, True)]
    pier.loft(rings, concrete)
    pier.box((2.6, 1.6, 0.3), (0, 0, 0.15), pal("concrete_dark"), bevel=0.04)
    pier.box((2.0, 1.2, 0.3), (0, 0, 8.85), pal("concrete_dark"), bevel=0.04)
    return pier


def build_shed_module():
    shed = Mesh("Shed_Module")
    steel = pal("steel")
    concrete = pal("concrete")
    glass = material("ShedGlass", "#9CC4DE", 0.1, 0.0, alpha=0.5)
    shed.box((SHED_MODULE, 31.0, 0.3), (0, 0, -0.15), pal("concrete_dark"), bevel=0.03)
    for x in (-SHED_MODULE / 2 + 0.2, SHED_MODULE / 2 - 0.2):
        for y in (-15, -10, -5, 0, 5, 10, 15):
            shed.box((0.35, 0.35, 8.0), (x, y, 4.0), steel, bevel=0.04)
    for side in (-1, 1):
        shed.box((SHED_MODULE, 0.15, 3.0), (0, side * 15.1, 1.5), concrete, bevel=0.02)
        shed.box((SHED_MODULE, 0.2, 1.6), (0, side * 15.1, 7.2), glass, bevel=0.01)
    tooth = SHED_MODULE / 2
    for index in range(2):
        x0 = -SHED_MODULE / 2 + index * tooth
        shed.prism([(x0, 8.0), (x0 + tooth, 8.0), (x0 + tooth, 9.6)], -15.5, 15.5, pal("body_grey"))
        shed.box((0.1, 31.0, 1.5), (x0 + tooth - 0.05, 0, 8.85), glass, bevel=0.005)
    shed.box((SHED_MODULE, 31.0, 0.2), (0, 0, 7.95), pal("body_white"), bevel=0.02)
    for y in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
        shed.box((0.2, 0.4, 0.15), (0, y, 8.15), pal("teal"), bevel=0.02)
    return shed


def build_shed_end():
    end = Mesh("Shed_End")
    end.box((0.4, 31.0, 9.6), (0, 0, 4.8), pal("body_white"), bevel=0.03)
    for y in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
        end.box((0.1, 3.6, 6.2), (0.2, y, 3.1), pal("dark_metal"), bevel=0.02)
        end.box((0.12, 3.8, 0.2), (0.21, y, 6.3), pal("steel"), bevel=0.02)
    end.box((0.12, 14.0, 0.6), (0.23, 0, 8.6), pal("teal"), bevel=0.04)
    return end


def build_workshop_module():
    workshop = Mesh("Workshop_Module")
    concrete = pal("concrete")
    glass = material("ShedGlass", "#9CC4DE", 0.1, 0.0, alpha=0.5)
    workshop.box((SHED_MODULE, 30.0, 0.3), (0, 0, -0.15), pal("concrete_dark"), bevel=0.03)
    for side in (-1, 1):
        workshop.box((SHED_MODULE, 0.3, 12.0), (0, side * 14.85, 6.0), pal("body_grey"), bevel=0.03)
        workshop.box((SHED_MODULE - 0.4, 0.06, 1.4), (0, side * 14.68, 9.8), glass, bevel=0.01)
        workshop.box((3.6, 0.08, 4.2), (0, side * 14.68, 2.1), pal("dark_metal"), bevel=0.02)
        for rib in range(8):
            workshop.box((3.4, 0.04, 0.06), (0, side * 14.62, 0.4 + rib * 0.5), pal("steel"), bevel=0.005)
    workshop.box((SHED_MODULE, 30.0, 0.4), (0, 0, 12.2), pal("body_white"), bevel=0.04)
    workshop.box((2.4, 8.0, 0.3), (0, 0, 12.55), glass, bevel=0.02)
    for side in (-1, 1):
        workshop.box((SHED_MODULE, 0.5, 0.5), (0, side * 12.0, 8.0), pal("yellow"), bevel=0.04)
    workshop.box((0.5, 24.0, 0.6), (-SHED_MODULE / 2 + 0.25, 0, 7.6), pal("steel"), bevel=0.04)
    workshop.box((0.8, 1.6, 0.9), (0, 3.0, 6.8), pal("yellow"), bevel=0.04)
    return workshop


def brush_mesh(name, location, radius, height):
    brush = Mesh(name, location)
    brush.cylinder(0.06, height + 0.3, (0, 0, 0), pal("steel"), segments=10)
    bristle = material("BrushBlue", "#2B7FD4", 0.8)
    for ring in range(8):
        z = -height / 2 + 0.2 + ring * height / 8
        brush.cylinder(radius, 0.35, (0, 0, z), bristle, segments=16)
    return brush


def build_wash_plant():
    plant = empty("Wash_Plant")
    frame = Mesh("Wash_Frame")
    steel = pal("steel")
    for index in range(10):
        x = -18.0 + index * 4.0
        for y in (-3.6, 3.6):
            frame.box((0.35, 0.35, 5.6), (x, y, 2.8), steel, bevel=0.04)
        frame.box((0.35, 7.8, 0.35), (x, 0, 5.8), steel, bevel=0.04)
    frame.box((40.0, 8.2, 0.12), (0, 0, 6.0), material("WashRoof", "#B5C7D6", 0.4), bevel=0.02)
    frame.box((40.0, 8.0, 0.2), (0, 0, -0.1), pal("concrete_dark"), bevel=0.02)
    for y in (-3.4, 3.4):
        frame.box((40.0, 0.12, 0.12), (0, y, 4.2), pal("teal"), bevel=0.01)
    for x in (-17.0, -5.0, 6.0, 17.0):
        frame.cylinder(0.05, 6.4, (x, 0, 5.2), pal("steel"), axis="Y", segments=8)
    frame.box((2.5, 2.0, 2.4), (23.0, -3.0, 1.2), pal("body_white"), bevel=0.04)
    frame.box((0.6, 1.4, 0.8), (21.65, -3.0, 1.6), material("HutWindow", "#2B4560", 0.1), bevel=0.01)
    frame.cylinder(1.2, 3.2, (23.0, 3.0, 1.6), pal("body_grey"), segments=20)
    frame.build(plant)
    for name, x, y in (("Brush_NA", -9.0, 3.0), ("Brush_NB", 9.0, 3.0), ("Brush_SA", -9.0, -3.0), ("Brush_SB", 9.0, -3.0)):
        brush_mesh(name, (x, y, 1.9), 0.4, 3.6).build(plant)
    top = Mesh("Brush_Top", (0, 0, 4.9))
    top.cylinder(0.05, 6.6, (0, 0, 0), steel, axis="Y", segments=10)
    for ring in range(9):
        top.cylinder(0.4, 0.5, (0, -2.8 + ring * 0.7, 0), material("BrushBlue", "#2B7FD4", 0.8), axis="Y", segments=16)
    top.build(plant)
    return plant


def build_control_centre():
    centre = Mesh("Control_Centre")
    white = pal("body_white")
    glass = material("CcGlass", "#9CC4DE", 0.08, 0.0, alpha=0.5)
    window = material("CcWindow", "#2B4560", 0.1)
    centre.box((45.0, 28.0, 8.0), (0, 0, 4.0), white, bevel=0.1)
    centre.box((30.0, 20.0, 16.0), (-4.0, -2.0, 16.0), pal("body_grey"), bevel=0.1)
    centre.box((46.0, 29.0, 0.6), (0, 0, 8.0), pal("teal"), bevel=0.05)
    for floor in range(2):
        for side in (-1, 1):
            centre.box((40.0, 0.1, 2.6), (0, side * 14.02, 2.2 + floor * 3.6), window, bevel=0.02)
    for floor in range(4):
        for side in (-1, 1):
            centre.box((26.0, 0.1, 2.0), (-4.0, -2.0 + side * 10.02, 10.5 + floor * 3.4), window, bevel=0.02)
        centre.box((0.1, 16.0, 2.0), (11.02, -2.0, 10.5 + floor * 3.4), window, bevel=0.02)
    centre.box((24.0, 0.2, 5.5), (0, -14.05, 4.4), glass, bevel=0.01)
    centre.box((12.0, 0.1, 3.0), (0, -13.7, 5.0), material("VideoWall", "#12A59A", 0.3, 0, "#12A59A", 1.8), bevel=0.02)
    centre.box((18.0, 12.0, 1.4), (-4.0, -2.0, 24.7), pal("concrete_dark"), bevel=0.05)
    centre.box((3.0, 3.0, 1.6), (-8.0, 0.0, 25.8), pal("steel"), bevel=0.05)
    centre.cylinder(0.12, 8.0, (-1.0, 3.0, 29.0), pal("steel"), segments=8)
    centre.cylinder(0.12, 6.0, (2.0, -3.0, 28.0), pal("steel"), segments=8)
    centre.cylinder(1.4, 0.3, (4.0, 2.0, 26.1), white, segments=24, radius_top=0.2)
    centre.box((8.0, 0.3, 1.2), (-4.0, -12.2, 7.2), material("SignPlate", "#12A59A", 0.4, 0, "#12A59A", 0.45), bevel=0.04)
    return centre


def build_substation():
    substation = Mesh("Substation")
    concrete = pal("concrete")
    dark = pal("dark_metal")
    substation.box((18.0, 10.0, 7.0), (0, 0, 3.5), pal("body_grey"), bevel=0.08)
    substation.box((18.4, 10.4, 0.4), (0, 0, 7.1), concrete, bevel=0.04)
    for side in (-1, 1):
        for index in range(6):
            substation.box((1.8, 0.06, 2.6), (-7.0 + index * 2.8, side * 5.02, 3.8), dark, bevel=0.01)
            for slat in range(8):
                substation.box((1.7, 0.08, 0.04), (-7.0 + index * 2.8, side * 5.04, 2.7 + slat * 0.32), pal("steel"), bevel=0.005)
    substation.box((2.0, 0.1, 3.2), (9.02, 0, 1.6), dark, bevel=0.02, rotation=(0, 0, 0))
    for x in (-4.0, 0.0, 4.0):
        substation.cylinder(0.4, 0.6, (x, 0, 7.6), pal("steel"), segments=12)
    yard = (0, 9.0)
    substation.box((16.0, 8.0, 0.2), (0, yard[1], 0.1), pal("concrete_dark"), bevel=0.02)
    insulator = material("Insulator", "#C2A97A", 0.5)
    for x in (-5.0, 0.0, 5.0):
        substation.box((2.5, 2.0, 2.8), (x, yard[1], 1.6), pal("body_white"), bevel=0.1)
        substation.box((2.6, 2.1, 0.2), (x, yard[1], 3.1), pal("teal"), bevel=0.03)
        for offset in (-0.7, 0, 0.7):
            substation.cylinder(0.1, 1.0, (x + offset, yard[1] - 0.4, 3.7), insulator, segments=10, radius_top=0.2)
    for fence_x in (-8.0, 8.0):
        substation.box((0.08, 8.0, 1.8), (fence_x, yard[1], 1.0), pal("steel"), bevel=0.01)
    substation.box((16.0, 0.08, 1.8), (0, yard[1] + 4.0, 1.0), pal("steel"), bevel=0.01)
    substation.cylinder(0.05, 12.0, (0, yard[1], 5.0), pal("steel"), axis="X", segments=8)
    return substation


def build_building(name, width, depth, floors, style, seed):
    random_source = random.Random(seed)
    building = Mesh(name)
    palettes = [("#D8DEE6", "#12A59A"), ("#E7DFD3", "#F2A33A"), ("#C9D3DF", "#5B7FD4"), ("#EADCD5", "#FF6B4A")]
    wall_color, accent_color = palettes[seed % len(palettes)]
    wall = material(f"Wall{seed % len(palettes)}", wall_color, 0.7)
    accent = material(f"Accent{seed % len(palettes)}", accent_color, 0.55)
    glass = material("BuildingGlass", "#5E86A8", 0.15, 0.1)
    floor_height = 3.4
    height = floors * floor_height + 4.0
    building.box((width, depth, height), (0, 0, height / 2), wall, bevel=0.1)
    building.box((width + 0.4, depth + 0.4, 4.0), (0, 0, 2.0), accent, bevel=0.08)
    building.box((width - 1.0, 0.1, 2.6), (0, -depth / 2 - 0.22, 2.1), material("Shopfront", "#2B4560", 0.1), bevel=0.02)
    for floor in range(floors):
        z = 4.0 + floor * floor_height + 1.9
        for face in (-1, 1):
            if style == "band":
                building.box((width - 1.0, 0.1, 1.5), (0, face * (depth / 2 + 0.03), z), glass, bevel=0.02)
            else:
                columns = max(2, int((width - 1.0) / 2.6))
                for column in range(columns):
                    x = -width / 2 + 1.3 + column * (width - 2.6) / max(1, columns - 1)
                    building.box((1.4, 0.1, 1.7), (x, face * (depth / 2 + 0.03), z), glass, bevel=0.02)
        for face in (-1, 1):
            building.box((0.1, depth - 1.0, 1.5), (face * (width / 2 + 0.03), 0, z), glass, bevel=0.02)
    building.box((width + 0.3, depth + 0.3, 0.5), (0, 0, height + 0.25), accent, bevel=0.05)
    for unit in range(random_source.randint(1, 3)):
        building.box((random_source.uniform(1.5, 3.0), random_source.uniform(1.5, 3.0), random_source.uniform(1.0, 2.2)),
                     (random_source.uniform(-width / 4, width / 4), random_source.uniform(-depth / 4, depth / 4), height + 1.0),
                     pal("body_grey"), bevel=0.05)
    if floors > 8:
        building.cylinder(0.1, 6.0, (width / 4, depth / 4, height + 3.0), pal("steel"), segments=8)
    return building


def build_tree(name, kind, seed):
    tree = Mesh(name)
    random_source = random.Random(seed)
    trunk = material("Trunk", "#7A5C45", 0.9)
    tree.cylinder(0.18, 2.6, (0, 0, 1.3), trunk, segments=8, radius_top=0.12)
    leaf = material(f"Leaf{kind}", ["#3FA66B", "#6CBF5A", "#2F8F73"][kind], 0.8)
    if kind == 0:
        for blob in range(3):
            tree.sphere((1.3, 1.3, 1.1), (random_source.uniform(-0.5, 0.5), random_source.uniform(-0.5, 0.5), 3.2 + blob * 0.5), leaf)
    elif kind == 1:
        tree.sphere((1.9, 1.9, 1.7), (0, 0, 3.5), leaf)
    else:
        for tier in range(3):
            tree.cylinder(1.6 - tier * 0.4, 1.4, (0, 0, 2.6 + tier * 1.0), leaf, segments=10, radius_top=0.1)
    return tree


def build_street_lamp():
    lamp = Mesh("Street_Lamp")
    lamp.cylinder(0.08, 6.5, (0, 0, 3.25), pal("dark_metal"), segments=8)
    lamp.box((1.4, 0.2, 0.1), (0.6, 0, 6.5), pal("dark_metal"), bevel=0.02)
    lamp.box((0.5, 0.25, 0.08), (1.2, 0, 6.42), material("LampLight", "#FFF4D6", 0.3, 0, "#FFF1C8", 3.0), bevel=0.01)
    return lamp


def build_ground_block(name, layout):
    block = Mesh(name)
    size = 30.0
    strata = [("StrataSoil", "#A98B6B", -2.0, 1.6), ("StrataClay", "#C9A87C", -8.0, 6.0),
              ("StrataSand", "#D8C49A", -14.0, 6.0), ("StrataRock", "#8E96A3", -22.0, 8.0)]
    for strata_name, color, z_bottom, thickness in strata:
        block.box((size, size, thickness), (0, 0, z_bottom + thickness / 2), material(strata_name, color, 0.95), bevel=0.0)
    kerb = pal("concrete")
    asphalt = material("Asphalt", "#4A5058", 0.9)
    lane_paint = material("LanePaint", "#F5F7FA", 0.6)
    pavement = material("Pavement", "#C8CED6", 0.9)
    grass = material("Grass", "#8CCB7A", 0.95)
    block.box((size, size, 0.4), (0, 0, -0.2), grass if layout == "grass" else pavement, bevel=0.0)
    if layout in ("road_x", "cross"):
        block.box((size, 9.0, 0.42), (0, 0, -0.19), asphalt, bevel=0.0)
        for dash in range(6):
            block.box((2.2, 0.18, 0.43), (-12.5 + dash * 5.0, 0, -0.18), lane_paint, bevel=0.0)
        for side in (-1, 1):
            block.box((size, 0.25, 0.5), (0, side * 4.6, -0.1), kerb, bevel=0.03)
    if layout == "cross":
        block.box((9.0, size, 0.42), (0, 0, -0.19), asphalt, bevel=0.0)
        for dash in range(6):
            block.box((0.18, 2.2, 0.43), (0, -12.5 + dash * 5.0, -0.18), lane_paint, bevel=0.0)
        for side in (-1, 1):
            block.box((0.25, size, 0.5), (side * 4.6, 0, -0.1), kerb, bevel=0.03)
    return block


def main():
    lib.reset_scene()
    roots = [build_viaduct_span().build(), build_viaduct_pier().build(), build_shed_module().build(), build_shed_end().build(),
             build_workshop_module().build(), build_wash_plant(), build_control_centre().build(), build_substation().build()]
    for index, root in enumerate(roots):
        root.location = (0, index * 50.0, 0)
    lib.export_glb("structures.glb", roots)

    lib.reset_scene()
    roots = []
    specs = [("Building_Low_A", 18, 14, 4, "band"), ("Building_Low_B", 22, 16, 5, "grid"), ("Building_Mid_A", 16, 16, 9, "grid"),
             ("Building_Mid_B", 20, 14, 11, "band"), ("Building_Tower_A", 14, 14, 18, "grid"), ("Building_Tower_B", 16, 12, 22, "band")]
    for index, (name, width, depth, floors, style) in enumerate(specs):
        roots.append(build_building(name, width, depth, floors, style, index).build())
    for kind in range(3):
        roots.append(build_tree(f"Tree_{kind}", kind, kind).build())
    roots.append(build_street_lamp().build())
    for layout in ("grass", "road_x", "cross"):
        roots.append(build_ground_block(f"Ground_{layout}", layout).build())
    for index, root in enumerate(roots):
        root.location = (index * 35.0, 0, 0)
    lib.export_glb("city.glb", roots)


main()
