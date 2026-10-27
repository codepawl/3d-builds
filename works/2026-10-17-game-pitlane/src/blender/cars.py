"""Open-wheel race cars: cars.glb (refs/race_car.md).

Roots (5.40 x 0.97 x 1.90 m, origin on the ground midway between the axles, facing +forward):
car_halvard_07, car_halvard_22 (our team), car_ostrava_11, car_kestrel_31, car_sable_44 (rivals).
Moving children per car (names prefixed with the root):
  <root>_steer_fl / _steer_fr   empties at the front hub centres, turn about up to steer
  <root>_wheel_fl/fr/rl/rr      wheels, origin at the hub, spin about x (front wheels sit under the steer empties)
  <root>_drs_flap               rear wing top flap, origin at its trailing-edge hinge; rotate x by -0.3 rad to open
Anchors: <root>_jack_front, <root>_jack_rear (jack contact points), <root>_number (nose number plate centre).
Front axle at forward +1.70, rear axle at -1.70 (wheelbase 3.40).
"""
import bpy

from lib import anchor, box, combine, export, loft, material, mirror_x, reset_scene, root, slab, sphere, turn
from parts import airfoil, palette, race_wheel, tube

FRONT_AXLE = 1.70
REAR_AXLE = -1.70
FRONT_WHEEL = (0.3525, 0.28, 0.81)   # radius, width, centre x
REAR_WHEEL = (0.355, 0.375, 0.7625)

CARS = {
    "car_halvard_07": {"team": "halvard", "helmet": "#c6f432", "compound": "medium"},
    "car_halvard_22": {"team": "halvard", "helmet": "#ffffff", "compound": "medium"},
    "car_ostrava_11": {"team": "ostrava", "helmet": "#ffd23a", "compound": "soft"},
    "car_kestrel_31": {"team": "kestrel", "helmet": "#5fe0ff", "compound": "hard"},
    "car_sable_44": {"team": "sable", "helmet": "#ff5b3a", "compound": "medium"},
}

TUB_SECTIONS = [
    (2.62, 0.06, 0.05, 0.20), (2.45, 0.10, 0.07, 0.22), (2.00, 0.15, 0.11, 0.28), (1.60, 0.19, 0.15, 0.34),
    (1.20, 0.23, 0.19, 0.40), (0.80, 0.29, 0.22, 0.44), (0.30, 0.37, 0.24, 0.44), (-0.30, 0.40, 0.26, 0.44),
    (-0.90, 0.33, 0.27, 0.46), (-1.50, 0.21, 0.23, 0.44), (-2.00, 0.12, 0.15, 0.40), (-2.22, 0.06, 0.08, 0.38),
]
SIDEPOD_SECTIONS = [
    (0.80, 0.15, 0.10, 0.43), (0.62, 0.25, 0.13, 0.42), (0.10, 0.30, 0.13, 0.40), (-0.55, 0.23, 0.12, 0.36),
    (-1.15, 0.12, 0.09, 0.30), (-1.50, 0.05, 0.05, 0.26),
]


def tub(name, mats, team):
    slots = [mats[f"{team}_primary"], mats[f"{team}_secondary"], mats[f"{team}_accent"], mats["carbon"]]

    def livery(x, up, forward):
        if up < 0.27:
            return 3
        if forward > 2.32 or 0.92 < forward < 1.04:
            return 2
        if forward < -0.35 and up > 0.6:
            return 1
        return 0
    return loft(name, TUB_SECTIONS, slots, sides=28, material_for_face=livery)


def sidepods(name, mats, team):
    slots = [mats[f"{team}_primary"], mats[f"{team}_secondary"], mats["carbon"]]

    def livery(x, up, forward):
        if up < 0.24:
            return 2
        if up > 0.5 and forward < 0.2:
            return 1
        return 0
    left = loft(f"{name}_L", SIDEPOD_SECTIONS, slots, sides=12, material_for_face=livery, x=0.56)
    inlet = sphere(f"{name}_inletL", 1.0, (0.56, 0.42, 0.80), mats["carbon_matte"], scale=(0.13, 0.09, 0.02), segments=16)
    vent = box(f"{name}_ventL", (0.18, 0.012, 0.32), (0.58, 0.535, -0.25), mats["carbon_matte"], 0.004)
    parts = [left, inlet, vent]
    return parts + mirror_x(parts)


def wings(name, mats, team):
    primary, accent, carbon = mats[f"{team}_primary"], mats[f"{team}_accent"], mats["carbon"]
    parts = [slab(f"{name}_fw_main", airfoil(0.28, 0.12, 6, (2.72, 0.09)), 1.90, carbon, plane="side", round_by=0.004)]
    for side in (-1, 1):
        parts.append(slab(f"{name}_fw_flap2_{side}", airfoil(0.18, 0.12, 22, (2.47, 0.145)), 0.72, primary, plane="side",
                          center=(side * 0.585, 0, 0), round_by=0.004))
        parts.append(slab(f"{name}_fw_flap3_{side}", airfoil(0.14, 0.12, 38, (2.33, 0.225)), 0.72, accent, plane="side",
                          center=(side * 0.585, 0, 0), round_by=0.004))
        parts.append(slab(f"{name}_fw_end_{side}", [(2.78, 0.04), (2.18, 0.04), (2.18, 0.33), (2.44, 0.36), (2.76, 0.20)],
                          0.014, primary, plane="side", center=(side * 0.95, 0, 0), round_by=0.003))
        parts.append(slab(f"{name}_rw_end_{side}", [(-2.06, 0.38), (-2.68, 0.38), (-2.68, 0.97), (-2.14, 0.97), (-2.06, 0.82)],
                          0.016, primary, plane="side", center=(side * 0.485, 0, 0), round_by=0.004))
        parts.append(box(f"{name}_rw_endtip_{side}", (0.02, 0.05, 0.54), (side * 0.485, 0.95, -2.41), accent, 0.006))
    parts.append(slab(f"{name}_rw_main", airfoil(0.30, 0.12, 12, (-2.17, 0.72)), 0.96, primary, plane="side", round_by=0.004))
    parts.append(slab(f"{name}_beam_wing", airfoil(0.17, 0.12, 10, (-2.27, 0.43)), 0.96, carbon, plane="side", round_by=0.003))
    parts.append(tube(f"{name}_swan_neck", [(0, 0.42, -1.92), (0, 0.62, -2.2), (0, 0.73, -2.28)], 0.022, carbon, sides=8))
    return parts


def chassis_details(name, mats, team, helmet_colour):
    primary, secondary, carbon = mats[f"{team}_primary"], mats[f"{team}_secondary"], mats["carbon"]
    parts = []
    # cockpit opening, driver, steering wheel
    parts.append(sphere(f"{name}_cockpit", 1.0, (0, 0.665, 0.25), mats["carbon_matte"], scale=(0.24, 0.035, 0.42), segments=20))
    helmet = material(f"helmet_{helmet_colour[1:].lower()}", helmet_colour, roughness=0.25)
    parts.append(sphere(f"{name}_helmet", 0.13, (0, 0.735, 0.08), helmet, scale=(0.92, 0.95, 1.05), segments=18))
    parts.append(sphere(f"{name}_visor", 0.1, (0, 0.745, 0.155), mats["glass"], scale=(1.05, 0.35, 0.55), segments=14))
    parts.append(box(f"{name}_steering", (0.24, 0.1, 0.03), (0, 0.66, 0.42), carbon, 0.02))
    # halo with centre pylon
    halo = [(0.27, 0.64, -0.22), (0.26, 0.78, 0.06), (0.19, 0.815, 0.30), (0, 0.825, 0.42),
            (-0.19, 0.815, 0.30), (-0.26, 0.78, 0.06), (-0.27, 0.64, -0.22)]
    parts.append(tube(f"{name}_halo", halo, 0.026, secondary, sides=10))
    parts.append(tube(f"{name}_halo_pylon", [(0, 0.825, 0.42), (0, 0.74, 0.55), (0, 0.66, 0.62)], 0.022, secondary, sides=8))
    # airbox and roll hoop, camera pod, fin
    parts.append(loft(f"{name}_airbox", [(0.62, 0.17, 0.26, -0.36), (0.84, 0.14, 0.18, -0.28), (0.95, 0.10, 0.11, -0.24), (0.975, 0, 0, -0.24)],
                      primary, sides=18, axis="up"))
    parts.append(sphere(f"{name}_airbox_inlet", 1.0, (0, 0.86, -0.11), mats["carbon_matte"], scale=(0.075, 0.06, 0.02), segments=14))
    parts.append(box(f"{name}_camera_pod", (0.09, 0.05, 0.12), (0, 0.985, -0.26), mats["dark"], 0.015))
    parts.append(slab(f"{name}_fin", [(-0.42, 0.9), (-1.72, 0.62), (-1.72, 0.55), (-0.42, 0.70)], 0.012, primary, plane="side", round_by=0.003))
    # floor, plank, edge wings, diffuser
    floor_outline = [(-0.30, 1.25), (0.30, 1.25), (0.85, 0.90), (0.88, -0.90), (0.66, -1.45), (0.46, -1.66),
                     (-0.46, -1.66), (-0.66, -1.45), (-0.88, -0.90), (-0.85, 0.90)]
    parts.append(slab(f"{name}_floor", floor_outline, 0.026, carbon, center=(0, 0.07, 0), round_by=0.008))
    parts.append(box(f"{name}_plank", (0.3, 0.025, 2.4), (0, 0.045, -0.2), mats["bark"], 0.006))
    parts.append(box(f"{name}_crash_rear", (0.13, 0.13, 0.42), (0, 0.34, -2.08), carbon, 0.03))
    parts.append(box(f"{name}_rain_light", (0.1, 0.04, 0.02), (0, 0.34, -2.30), mats["glow_red"], 0.006))
    diffuser = box(f"{name}_diffuser", (1.0, 0.02, 0.55), (0, 0.15, -1.92), carbon, 0.005)
    parts.append(turn(diffuser, "x", -0.32))
    for fence_x in (-0.48, -0.2, 0.2, 0.48):
        fence = box(f"{name}_diffuser_fence{fence_x}", (0.012, 0.16, 0.5), (fence_x, 0.16, -1.92), carbon, 0.003)
        parts.append(fence)
    for side in (-1, 1):
        parts.append(slab(f"{name}_edgewing{side}", [(0.95, 0.08), (0.55, 0.08), (0.62, 0.14), (0.95, 0.12)], 0.08, carbon,
                          plane="side", center=(side * 0.86, 0, 0), round_by=0.004))
        # mirrors
        parts.append(tube(f"{name}_mirror_stalk{side}", [(side * 0.30, 0.6, 0.56), (side * 0.40, 0.68, 0.56)], 0.012, carbon, sides=6))
        parts.append(box(f"{name}_mirror{side}", (0.13, 0.06, 0.05), (side * 0.46, 0.69, 0.55), primary, 0.015))
        parts.append(box(f"{name}_mirror_glass{side}", (0.11, 0.045, 0.006), (side * 0.46, 0.69, 0.523), mats["chrome"], 0.002))
        # number plates on the nose sides
        parts.append(box(f"{name}_number_plate{side}", (0.006, 0.08, 0.16), (side * 0.155, 0.31, 1.95), mats["plate"], 0.003))
        # front suspension (wishbones and push rod), to the upright at the hub
        front_x = FRONT_WHEEL[2] - FRONT_WHEEL[1] / 2 - 0.02
        parts.append(tube(f"{name}_f_upper{side}", [(side * 0.17, 0.47, 1.90), (side * front_x, 0.47, FRONT_AXLE), (side * 0.17, 0.47, 1.45)], 0.013, carbon, sides=6))
        parts.append(tube(f"{name}_f_lower{side}", [(side * 0.15, 0.27, 2.00), (side * front_x, 0.22, FRONT_AXLE), (side * 0.19, 0.27, 1.38)], 0.013, carbon, sides=6))
        parts.append(tube(f"{name}_f_push{side}", [(side * front_x, 0.24, FRONT_AXLE + 0.02), (side * 0.19, 0.55, 1.58)], 0.011, carbon, sides=6))
        parts.append(tube(f"{name}_f_track{side}", [(side * 0.17, 0.36, 1.78), (side * front_x, 0.36, FRONT_AXLE + 0.1)], 0.01, carbon, sides=6))
        parts.append(box(f"{name}_f_upright{side}", (0.04, 0.3, 0.12), (side * (front_x + 0.01), 0.35, FRONT_AXLE), mats["titanium"], 0.01))
        rear_x = REAR_WHEEL[2] - REAR_WHEEL[1] / 2 - 0.02
        parts.append(tube(f"{name}_r_upper{side}", [(side * 0.14, 0.48, -1.45), (side * rear_x, 0.50, REAR_AXLE), (side * 0.14, 0.48, -1.95)], 0.013, carbon, sides=6))
        parts.append(tube(f"{name}_r_lower{side}", [(side * 0.14, 0.22, -1.35), (side * rear_x, 0.20, REAR_AXLE), (side * 0.14, 0.22, -2.0)], 0.013, carbon, sides=6))
        parts.append(box(f"{name}_r_upright{side}", (0.04, 0.34, 0.14), (side * (rear_x + 0.01), 0.36, REAR_AXLE), mats["titanium"], 0.01))
        parts.append(tube(f"{name}_brake_duct{side}", [(side * (front_x - 0.02), 0.36, FRONT_AXLE + 0.12), (side * (front_x - 0.02), 0.36, FRONT_AXLE + 0.2)], 0.035, carbon, sides=8))
    # gearbox casing between rear wishbones
    parts.append(box(f"{name}_gearbox", (0.26, 0.24, 0.7), (0, 0.32, -1.75), carbon, 0.04))
    return parts


def build_car(name, spec, mats):
    team = spec["team"]
    group = root(name)
    parts = [tub(f"{name}_tub", mats, team)] + sidepods(f"{name}_pod", mats, team)
    parts += wings(name, mats, team) + chassis_details(name, mats, team, spec["helmet"])
    combine(f"{name}_body", parts, parent=group)
    flap = slab(f"{name}_drs_flap_shape", airfoil(0.22, 0.12, 30, (-2.40, 0.825)), 0.96, mats[f"{team}_secondary"], plane="side", round_by=0.004)
    hinge = (0, 0.93, -2.59)
    combine(f"{name}_drs_flap", [flap], origin=hinge, parent=group)
    compound = mats[f"compound_{spec['compound']}"]
    cover = mats[f"{team}_primary"]
    for label, side in (("l", 1), ("r", -1)):
        radius, width, centre_x = FRONT_WHEEL
        hub = (side * centre_x, radius, FRONT_AXLE)
        steer = anchor(f"{name}_steer_f{label}", hub, group)
        wheel = race_wheel(f"{name}_wheel_f{label}", radius, width, hub, None, compound, mats, cover)
        wheel.parent = steer
        wheel.location = (0, 0, 0)
        radius, width, centre_x = REAR_WHEEL
        race_wheel(f"{name}_wheel_r{label}", radius, width, (side * centre_x, radius, REAR_AXLE), group, compound, mats, cover)
    anchor(f"{name}_jack_front", (0, 0.16, 2.55), group)
    anchor(f"{name}_jack_rear", (0, 0.27, -2.30), group)
    anchor(f"{name}_number", (0.16, 0.31, 1.95), group)
    return group


def build():
    reset_scene()
    mats = palette()
    for name, spec in CARS.items():
        build_car(name, spec, mats)
    export("cars.glb")


if __name__ == "__main__":
    build()
