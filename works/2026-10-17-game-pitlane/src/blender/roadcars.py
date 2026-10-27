"""Safety car and medical car: roadcars.glb (refs/safety_car.md).

Roots (origin on the ground midway between the axles, facing +forward):
  safety_car    front-engine GT coupe, 4.55 x 1.41 x 1.94 m (with light bar), wheelbase 2.63 m
  medical_car   estate on the same platform, 4.75 x 1.55 x 1.94 m
Moving / switchable children: <root>_wheel_fl/fr/rl/rr (spin about x, origin at the hub);
<root>_lightbar_amber and <root>_lightbar_green (glow lenses the app flashes).
Championship colours (made up): white body, orange and graphite stripes; medical car white with a teal band.
"""
from lib import box, combine, cylinder, export, loft, material, reset_scene, root
from parts import palette, road_wheel

FRONT_AXLE = 1.32
REAR_AXLE = -1.31


def body_sections(estate):
    sections = [(2.27, 0.70, 0.12, 0.45), (2.15, 0.90, 0.22, 0.52), (1.60, 0.97, 0.29, 0.60), (0.60, 0.97, 0.31, 0.62),
                (-0.60, 0.97, 0.34, 0.62), (-1.60, 0.97, 0.34, 0.62), (-2.15, 0.92, 0.30, 0.63), (-2.27, 0.78, 0.22, 0.64)]
    if estate:
        sections = [(position * 1.04, across, height, up) for position, across, height, up in sections]
    return sections


def cabin_sections(estate):
    if estate:
        return [(0.55, 0.72, 0.04, 0.93), (0.05, 0.70, 0.30, 0.98), (-0.8, 0.68, 0.40, 1.02), (-1.9, 0.66, 0.40, 1.0), (-2.25, 0.62, 0.05, 0.95)]
    return [(0.55, 0.72, 0.04, 0.93), (0.10, 0.70, 0.27, 0.99), (-0.50, 0.66, 0.30, 1.0), (-1.30, 0.62, 0.14, 0.97), (-1.75, 0.58, 0.03, 0.95)]


def build_car(name, estate, mats, stripe, stripe_dark):
    group = root(name)
    paint = material(f"{name}_paint", "#f4f6fa", roughness=0.25, metallic=0.2)
    body_slots = [paint, mats["dark"], stripe]

    def body_paint(x, up, forward):
        if up < 0.42:
            return 1
        if abs(x) < 0.16 and up > 0.8:
            return 2
        return 0
    roof_top = 1.4 if estate else 1.27
    cabin_slots = [mats["glass"], paint]

    def cabin_paint(x, up, forward):
        return 1 if up > roof_top - 0.06 or abs(x) > 0.66 else 0
    parts = [loft(f"{name}_shell", body_sections(estate), body_slots, sides=32, material_for_face=body_paint),
             loft(f"{name}_cabin", cabin_sections(estate), cabin_slots, sides=28, material_for_face=cabin_paint),
             box(f"{name}_lower_body", (1.94, 0.36, 4.36 if not estate else 4.52), (0, 0.42, 0.0), paint, 0.14),
             box(f"{name}_sill", (1.95, 0.08, 2.0), (0, 0.27, 0.0), mats["dark"], 0.03),
             box(f"{name}_grille", (1.1, 0.18, 0.05), (0, 0.42, 2.25), mats["dark"], 0.04),
             box(f"{name}_splitter", (1.6, 0.04, 0.2), (0, 0.25, 2.1), mats["dark"], 0.02),
             box(f"{name}_diffuser", (1.4, 0.14, 0.12), (0, 0.32, -2.2), mats["dark"], 0.03),
             box(f"{name}_side_stripe_l", (0.02, 0.12, 3.6), (0.97, 0.66, 0.0), stripe_dark, 0.01),
             box(f"{name}_side_stripe_r", (0.02, 0.12, 3.6), (-0.97, 0.66, 0.0), stripe_dark, 0.01),
             box(f"{name}_lightbar_base", (1.1, 0.07, 0.22), (0, roof_top + 0.02, -0.3), mats["dark"], 0.03)]
    if not estate:
        parts.append(box(f"{name}_spoiler", (1.5, 0.05, 0.25), (0, 0.98, -2.15), mats["dark"], 0.02))
    for side in (-1, 1):
        parts += [box(f"{name}_headlight{side}", (0.4, 0.08, 0.1), (side * 0.65, 0.66, 2.12), mats["glow_white"], 0.03),
                  box(f"{name}_taillight{side}", (0.4, 0.07, 0.05), (side * 0.6, 0.78, -2.27), mats["glow_red"], 0.02),
                  box(f"{name}_side_vent{side}", (0.03, 0.12, 0.35), (side * 0.975, 0.62, 1.0), mats["dark"], 0.01),
                  box(f"{name}_mirror{side}", (0.18, 0.1, 0.12), (side * 0.82, 0.93, 0.5), paint, 0.03),
                  box(f"{name}_mirror_stalk{side}", (0.1, 0.1, 0.05), (side * 0.72, 0.84, 0.5), mats["dark"], 0.01),
                  box(f"{name}_door_line{side}", (0.01, 0.55, 0.02), (side * 0.975, 0.68, -0.2), mats["dark"], 0.0),
                  box(f"{name}_handle{side}", (0.01, 0.03, 0.15), (side * 0.976, 0.85, -0.35), mats["chrome"], 0.0)]
        for vent in range(3):
            parts.append(box(f"{name}_bonnet_vent{side}{vent}", (0.12, 0.02, 0.04), (side * 0.3, 0.9 - vent * 0.008, 1.55 - vent * 0.07), mats["dark"], 0.005))
    combine(f"{name}_body", parts, parent=group)
    amber = box(f"{name}_amber_lens", (0.44, 0.08, 0.18), (-0.27, roof_top + 0.09, -0.3), mats["glow_amber"], 0.03)
    combine(f"{name}_lightbar_amber", [amber], origin=(-0.27, roof_top + 0.09, -0.3), parent=group)
    green = box(f"{name}_green_lens", (0.44, 0.08, 0.18), (0.27, roof_top + 0.09, -0.3), mats["glow_green"], 0.03)
    combine(f"{name}_lightbar_green", [green], origin=(0.27, roof_top + 0.09, -0.3), parent=group)
    for label, side in (("l", 1), ("r", -1)):
        for axle_label, axle in (("f", FRONT_AXLE), ("r", REAR_AXLE)):
            axle_forward = axle * (1.04 if estate else 1.0)
            road_wheel(f"{name}_wheel_{axle_label}{label}", 0.34, 0.27, (side * 0.85, 0.34, axle_forward), group, mats, spokes=10)
            arch = cylinder(f"{name}_arch_{axle_label}{label}", 0.4, 0.04, (side * 0.965, 0.36, axle_forward), mats["dark"], axis="x", sides=24)
            combine(f"{name}_arch_{axle_label}{label}_mesh", [arch], parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    orange = material("championship_orange", "#ff7a1a", roughness=0.35)
    graphite = material("championship_graphite", "#2a2d35", roughness=0.4)
    teal = material("medical_teal", "#1aa59a", roughness=0.35)
    build_car("safety_car", False, mats, orange, graphite)
    build_car("medical_car", True, mats, teal, teal)
    export("roadcars.glb")


if __name__ == "__main__":
    build()
