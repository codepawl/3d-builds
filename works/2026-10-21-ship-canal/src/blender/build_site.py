"""Site family -> site.glb: control houses, canal control center, light tower, channel buoys and the
state-material swatch node that carries every 'on' material the app swaps in."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *

reset_scene()

concrete = textured_material("concrete_light", "#c9ced6", 0.10, 0.9, seed=1)
concrete_dark = textured_material("concrete_dark", "#9aa3b0", 0.12, 0.95, seed=2)
glass = make_material("ship_glass", "#22313f", 0.15, 0.2)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
dark = make_material("mule_dark", "#2a2f36", 0.6, 0.4)
white = make_material("ship_white", "#f1f2ee", 0.55)
yellow = make_material("safety_yellow", "#f2b92d", 0.6)
accent_blue = make_material("site_blue", "#3f6fa8", 0.55)
accent_orange = make_material("site_orange", "#ee7a2b", 0.55)
window_dark = make_material("window_dark", "#2a3a4a", 0.2, 0.2)
screen_off = make_material("screen_off", "#1c2530", 0.3)
lamp_off = make_material("lamp_off", "#2a3039", 0.5)
lamp_red_off = make_material("lamp_red_off", "#4a2424", 0.4)
lamp_green_off = make_material("lamp_green_off", "#24402c", 0.4)
buoy_red_paint = make_material("buoy_red_paint", "#d6432f", 0.5)
buoy_green_paint = make_material("buoy_green_paint", "#2f9e5b", 0.5)

ON_MATERIALS = {
    "lamp_warm_on": ("#ffe9b0", "#ffd98a", 4.0), "lamp_red_on": ("#ff6a5a", "#ff3b2a", 6.0),
    "lamp_green_on": ("#7dffa0", "#2bff6a", 6.0), "lamp_amber_on": ("#ffd36a", "#ffb41f", 6.0),
    "beacon_amber_on": ("#ffd36a", "#ffb41f", 7.0), "window_lit": ("#fff1c9", "#ffd98a", 2.5),
    "screen_on": ("#8fd8ff", "#3fb8ff", 3.0), "screen_alert": ("#ff9c8a", "#ff4a2a", 3.0),
}


def control_house(variant):
    root = make_root(f"control_house_{variant}")
    body = Part(root.name + "_body")
    floors = 1 if variant == "a" else 2
    body.box((0, 0, 0.5), (10.4, 8.4, 1.0), concrete_dark, bevel=0.15)                                 # plinth
    for floor in range(floors):
        z = 1.0 + floor * 3.0
        body.box((0, 0, z + 1.4), (9.4, 7.4, 2.8), white, bevel=0.2)
        body.box((0, 0, z + 2.95), (10.0, 8.0, 0.25), accent_blue, bevel=0.06)
        body.box((0, 1.0, z + 0.6), (9.46, 7.0, 0.1), accent_blue)                                      # trim band
    top = 1.0 + floors * 3.0
    body.box((0, 0, top + 0.1), (8.0, 6.0, 0.2), steel, bevel=0.04)
    body.box((-3.0, 1.0, top + 0.7), (1.6, 1.6, 1.2), dark, bevel=0.1)                                  # rooftop unit
    body.cylinder((3.0, -1.5, top + 2.0), 0.12, 3.6, steel, segments=8)                                 # antenna
    body.box((3.0, -1.5, top + 3.4), (1.2, 0.1, 0.1), steel)
    if variant == "b":
        body.cylinder((-2.5, -1.0, top + 1.2), 1.3, 2.4, white, segments=20, bevel=0.1)               # radar dome
    body.box((0, -4.3, 1.5), (1.6, 0.2, 2.0), dark, bevel=0.04)                                         # door
    for step in range(3):
        body.box((0, -5.0 - step * 0.35, 0.2 + step * 0.3 * 0.0), (2.0, 0.4, 0.4), concrete_dark)
    body.build(parent=root)
    windows = Part(root.name + "_windows")
    for floor in range(floors):
        z = 1.0 + floor * 3.0 + 1.5
        windows.box((0, -3.72, z), (7.6, 0.06, 1.2), window_dark)
        windows.box((0, 3.72, z), (7.6, 0.06, 1.2), window_dark)
        for side in (-1, 1):
            windows.box((side * 4.72, 0, z), (0.06, 5.6, 1.2), window_dark)
    windows.build(parent=root)
    return root


def control_center():
    root = make_root("control_center")
    body = Part("control_center_body")
    body.box((0, 0, 0.4), (66.0, 32.0, 0.8), concrete_dark, bevel=0.2)                                  # podium
    body.box((0, 0, 7.8), (58.0, 24.0, 14.0), white, bevel=0.4)                                         # main hall
    for index in range(-6, 7):
        body.box((index * 4.4, -12.04, 7.0), (0.4, 0.1, 10.0), accent_blue)                             # fins
    body.box((0, 0, 14.9), (60.0, 26.0, 0.5), accent_blue, bevel=0.1)                                   # roof slab
    body.box((-30.0, -3.0, 13.0), (14.0, 14.0, 26.0), white, bevel=0.4)                                 # control tower block
    body.box((-30.0, -3.0, 26.4), (16.0, 16.0, 0.6), accent_blue, bevel=0.1)
    body.box((-30.0, -3.0, 24.2), (14.2, 14.2, 3.4), glass, bevel=0.15)                                 # tower glass cab
    body.cylinder((-30.0, -3.0, 31.0), 0.25, 9.0, steel, segments=8)                                    # mast
    body.box((6.0, -14.5, 3.0), (18.0, 6.0, 0.4), accent_orange, bevel=0.1)                             # entrance canopy
    for x in (-2.0, 14.0):
        body.cylinder((x, -16.5, 1.6), 0.25, 3.2, steel, segments=10)
    for step in range(4):
        body.box((6.0, -16.0 - step * 0.5, 0.9 + step * 0.0), (14.0, 0.5, 0.2), concrete_dark)
    for row in range(2):
        body.box((10.0, -12.04, 6.0 + row * 4.0), (30.0, 0.08, 2.4), glass)                              # hall windows
    for index in range(6):
        body.box((-8.0 + index * 8.0, 12.2, 14.9 + 0.7), (3.0, 3.0, 1.4), dark, bevel=0.1)              # roof plant
    body.build(parent=root)
    screens = Part("control_center_screens")
    screens.box((0, 0, 0), (12.0, 0.1, 5.0), screen_off, bevel=0.03)                                    # wall display, lit via screen_on
    screens.build(parent=root, location=(10.0, -12.12, 9.2))
    radar_stand = Part("control_center_radar")
    radar_stand.cylinder((0, 0, 0.0), 0.8, 1.0, steel, segments=14)
    radar_stand.box((0, 0, 1.4), (7.0, 0.5, 1.4), white, bevel=0.1)
    radar_object = radar_stand.build(parent=root, location=(-30.0, -3.0, 34.5))
    add_clip(radar_object, "radar_sweep", "rotation_euler", 2, [(1, 0.0), (90, math.radians(360))])
    return root


def light_tower():
    root = make_root("light_tower")
    body = Part("light_tower_body")
    body.cylinder((0, 0, 0.4), 0.9, 0.8, concrete_dark, segments=12, bevel=0.05)
    body.cylinder((0, 0, 9.0), 0.22, 18.0, steel, segments=10, radius_top=0.14)
    body.box((0, 0, 18.2), (3.2, 0.5, 0.3), steel, bevel=0.05)
    body.build(parent=root)
    lamps = Part("light_tower_lamps")
    for x in (-1.2, -0.4, 0.4, 1.2):
        lamps.box((x, 0, 0), (0.6, 0.3, 0.4), lamp_off, bevel=0.05)
    lamps.build(parent=root, location=(0, -0.3, 18.0))
    return root


def buoy(color_name, paint, off_material):
    root = make_root(f"buoy_{color_name}")
    body = Part(root.name + "_body")
    body.cylinder((0, 0, -0.2), 1.0, 1.4, paint, segments=18, radius_top=1.0, bevel=0.1)
    body.cylinder((0, 0, 1.5), 0.9, 1.6, paint, segments=18, radius_top=0.35, bevel=0.05)
    body.cylinder((0, 0, 2.8), 0.12, 1.0, steel, segments=8)
    body.cylinder((0, 0, -1.5), 0.15, 1.6, dark, segments=8)
    body.build(parent=root)
    lamp = Part(root.name + "_lamp")
    lamp.cylinder((0, 0, 0), 0.28, 0.4, off_material, segments=14, bevel=0.04)
    lamp.build(parent=root, location=(0, 0, 3.5))
    return root


def state_materials():
    root = make_root("state_materials")
    for index, (name, (color_hex, emission_hex, strength)) in enumerate(ON_MATERIALS.items()):
        material = make_material(name, color_hex, 0.4, emission_hex=emission_hex, emission_strength=strength)
        swatch = Part(f"state_{name}")
        swatch.box((0, 0, 0), (0.2, 0.2, 0.2), material)
        swatch.build(parent=root, location=(index * 0.4, 0, 0))
    return root


roots = [control_house("a"), control_house("b"), control_center(), light_tower(), buoy("red", buoy_red_paint, lamp_red_off),
         buoy("green", buoy_green_paint, lamp_green_off), state_materials()]
notes = {
    "control_house_a": ("control house on the centre wall, one floor, 10.4 x 8.4 x 5 m; *_windows swaps window_dark to window_lit", "door on -Y"),
    "control_house_b": ("control house on the centre wall, two floors with radar dome, 10.4 x 8.4 x 9 m", "door on -Y"),
    "control_center": ("canal control center 66 x 32 x 40 m; *_screens swaps screen_off to screen_on or screen_alert; *_radar sweeps", "entrance on -Y"),
    "light_tower": ("floodlight tower 18 m; *_lamps swaps lamp_off to lamp_warm_on", "lamps face -Y"),
    "buoy_red": ("channel buoy, 4 m; *_lamp swaps lamp_red_off to lamp_red_on", "none"),
    "buoy_green": ("channel buoy, 4 m; *_lamp swaps lamp_green_off to lamp_green_on", "none"),
    "state_materials": ("swatch node: carries the 'on' materials so the app can reuse them by name", "none"),
}
for root in roots:
    use, facing = notes[root.name]
    register("site.glb", root, "ground footprint centre, z=0 at ground (buoys at the waterline)", facing,
             "radar_sweep (90 f loop)" if root.name == "control_center" else "none", use)
export_glb("site.glb", with_animation=True)
