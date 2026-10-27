"""Street props and planting: props.glb (origin on the ground at the prop centre).

Roots: tree_round_a, tree_round_b, tree_palm, tree_conifer, bush_a, bush_b, flower_bed, lamp_post (glow globe),
bench, trash_bin, planter_box, bollard, parking_light, info_kiosk (screen), balloon_cluster (sold at the plaza).
"""
import math

from lib import box, combine, cylinder, export, material, reset_scene, root, sphere
from parts import beam_between, palette


def build():
    reset_scene()
    mats = palette()
    bark = material("bark", "#7a5a3e", roughness=0.9)
    spots = iter(range(0, 200, 5))

    def place(name):
        return root(name, (next(spots), 0, 0))

    for name, crown, height, colour in (("tree_round_a", 2.4, 6.0, mats["foliage"]), ("tree_round_b", 1.8, 4.5, mats["foliage_dark"])):
        group = place(name)
        parts = [cylinder("trunk", 0.22, height * 0.55, (0, height * 0.275, 0), bark, sides=10, radius_end=0.16)]
        for blob, (dx, dy, dz, scale) in enumerate(((0, 0, 0, 1.0), (0.9, -0.4, 0.3, 0.7), (-0.8, -0.3, -0.4, 0.75), (0.2, 0.6, -0.5, 0.65))):
            parts.append(sphere(f"crown_{blob}", crown * scale, (dx, height - crown * 0.6 + dy, dz), colour, scale=(1, 0.9, 1), segments=14))
        combine(f"{name}_body", parts, parent=group)

    palm = place("tree_palm")
    parts = []
    previous = (0, 0, 0)
    for step in range(1, 9):
        here = (0.08 * step * step / 8, step * 0.9, 0)
        parts.append(beam_between(f"trunk_{step}", previous, here, 0.2 - step * 0.01, bark, sides=10))
        previous = here
    top = previous
    for frond in range(8):
        angle = frond * 2 * math.pi / 8
        tip = (top[0] + 2.6 * math.cos(angle), top[1] - 1.0, top[2] + 2.6 * math.sin(angle))
        middle = (top[0] + 1.4 * math.cos(angle), top[1] + 0.5, top[2] + 1.4 * math.sin(angle))
        parts += [beam_between(f"frond_a_{frond}", top, middle, 0.14, mats["foliage"], sides=4),
                  beam_between(f"frond_b_{frond}", middle, tip, 0.1, mats["foliage"], sides=4)]
    parts.append(sphere("coconuts", 0.35, (top[0], top[1] - 0.2, top[2]), mats["wood_dark"], segments=10))
    combine("tree_palm_body", parts, parent=palm)

    conifer = place("tree_conifer")
    parts = [cylinder("trunk", 0.18, 1.6, (0, 0.8, 0), bark, sides=8)]
    for tier in range(3):
        parts.append(cylinder(f"tier_{tier}", 1.8 - tier * 0.45, 2.4, (0, 2.4 + tier * 1.4, 0), mats["foliage_dark"], sides=14, radius_end=0.1))
    combine("tree_conifer_body", parts, parent=conifer)

    for name, colour, size in (("bush_a", mats["foliage"], 1.0), ("bush_b", mats["foliage_dark"], 0.7)):
        group = place(name)
        combine(f"{name}_body", [sphere(f"b_{n}", size * (0.7 + 0.15 * n), (0.4 * math.cos(n * 2.1), size * 0.5, 0.4 * math.sin(n * 2.1)), colour, scale=(1, 0.8, 1), segments=12) for n in range(3)], parent=group)

    bed = place("flower_bed")
    parts = [box("edge", (3.0, 0.4, 1.6), (0, 0.2, 0), mats["stone"], 0.08), box("soil", (2.8, 0.1, 1.4), (0, 0.42, 0), mats["wood_dark"], 0.03)]
    petals = [mats["roof_pink"], mats["gold"], mats["white"], mats["brand"]]
    for flower in range(18):
        parts.append(sphere(f"flower_{flower}", 0.13, (-1.2 + (flower % 6) * 0.48, 0.58, -0.5 + (flower // 6) * 0.5), petals[flower % 4], segments=8))
    combine("flower_bed_body", parts, parent=bed)

    lamp = place("lamp_post")
    combine("lamp_post_body", [cylinder("base", 0.16, 0.5, (0, 0.25, 0), mats["dark"], sides=12, round_by=0.03),
                               cylinder("pole", 0.06, 3.6, (0, 2.1, 0), mats["dark"], sides=10),
                               box("arm", (0.06, 0.06, 0.6), (0, 3.85, 0.3), mats["dark"], 0.02),
                               box("banner", (0.03, 0.9, 0.4), (0, 2.8, 0.25), mats["brand"], 0.01)], parent=lamp)
    combine("lamp_post_glow", [sphere("globe", 0.22, (0, 3.75, 0.6), mats["glow_warm"], segments=14)], parent=lamp)

    bench = place("bench")
    parts = [box(f"slat_{n}", (1.8, 0.05, 0.1), (0, 0.45, -0.2 + n * 0.13), mats["wood"], 0.02) for n in range(4)]
    parts += [box(f"back_{n}", (1.8, 0.1, 0.05), (0, 0.65 + n * 0.13, -0.28), mats["wood"], 0.02) for n in range(3)]
    parts += [box(f"leg_{side}", (0.06, 0.45, 0.5), (side * 0.75, 0.22, -0.02), mats["dark"], 0.02) for side in (-1, 1)]
    parts += [box(f"back_leg_{side}", (0.06, 0.5, 0.05), (side * 0.75, 0.75, -0.3), mats["dark"], 0.02) for side in (-1, 1)]
    combine("bench_body", parts, parent=bench)

    bin_root = place("trash_bin")
    combine("trash_bin_body", [cylinder("can", 0.3, 0.9, (0, 0.45, 0), mats["brand_dark"], sides=16, round_by=0.03),
                               cylinder("lid", 0.33, 0.15, (0, 0.95, 0), mats["dark"], sides=16, radius_end=0.2),
                               box("slot", (0.25, 0.08, 0.02), (0, 0.8, 0.3), mats["dark"], 0.01)], parent=bin_root)

    planter = place("planter_box")
    combine("planter_box_body", [box("box", (1.2, 0.7, 1.2), (0, 0.35, 0), mats["white"], 0.08),
                                 sphere("shrub", 0.65, (0, 1.0, 0), mats["foliage"], scale=(1, 0.8, 1), segments=12)], parent=planter)

    bollard = place("bollard")
    combine("bollard_body", [cylinder("post", 0.1, 0.9, (0, 0.45, 0), mats["dark"], sides=12, round_by=0.03),
                             cylinder("band", 0.105, 0.08, (0, 0.75, 0), mats["glow_warm"], sides=12)], parent=bollard)

    parking = place("parking_light")
    combine("parking_light_body", [cylinder("pole", 0.1, 8.0, (0, 4.0, 0), mats["steel"], sides=10),
                                   box("head", (1.6, 0.15, 0.4), (0, 8.0, 0), mats["steel"], 0.04),
                                   box("lens", (1.4, 0.03, 0.3), (0, 7.92, 0), mats["glow_cool"], 0.01),
                                   box("base", (0.6, 0.6, 0.6), (0, 0.3, 0), mats["concrete"], 0.05)], parent=parking)

    kiosk = place("info_kiosk")
    combine("info_kiosk_body", [box("body", (0.8, 1.9, 0.4), (0, 0.95, 0), mats["white"], 0.1),
                                box("cap", (0.85, 0.15, 0.45), (0, 1.95, 0), mats["brand"], 0.05),
                                box("screen", (0.6, 0.9, 0.03), (0, 1.25, 0.21), mats["screen"], 0.01)], parent=kiosk)

    balloons = place("balloon_cluster")
    parts = [cylinder("cart", 0.3, 1.0, (0, 0.5, 0), mats["white"], sides=12)]
    colours = [mats["brand"], mats["roof_blue"], mats["gold"], mats["roof_pink"], mats["glow_violet"]]
    for index in range(9):
        angle = index * 2.4
        spot = (0.45 * math.cos(angle), 2.6 + 0.35 * (index % 3), 0.45 * math.sin(angle))
        parts += [beam_between(f"string_{index}", (0, 1.0, 0), spot, 0.006, mats["white"], sides=4),
                  sphere(f"balloon_{index}", 0.22, spot, colours[index % 5], scale=(1, 1.2, 1), segments=10)]
    combine("balloon_cluster_body", parts, parent=balloons)
    export("props.glb")


if __name__ == "__main__":
    build()
