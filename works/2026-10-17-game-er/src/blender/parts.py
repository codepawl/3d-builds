"""Shared palette and small parts for the ER asset pack (game-er).

Brand colour is a calm clinical blue. Material names the app relies on:
- `triage`: the patient's triage tag; the app recolours it per level 1-5.
- `status`: a bed or bay state lamp; the app recolours it (free, occupied, cleaning).
- names starting with `glow_`: emissive lamps and screens the app may bloom.
"""
import math

from lib import box, combine, cylinder, material, paint, sphere

BRAND = "#2f6fe4"
TRIAGE_COLOURS = {1: "#e5484d", 2: "#f5822a", 3: "#f2c94c", 4: "#30a46c", 5: "#3e8ee8"}


def palette():
    return {
        "white": material("body_white", "#f4f6f9", roughness=0.35, metallic=0.05),
        "panel": material("panel_light", "#e3e8ef", roughness=0.5),
        "grey": material("grey_mid", "#9aa4b3", roughness=0.5, metallic=0.2),
        "dark": material("trim_dark", "#2b313b", roughness=0.55),
        "black": material("rubber", "#1d2128", roughness=0.8),
        "steel": material("steel", "#c9d0da", roughness=0.25, metallic=0.85),
        "chrome": material("chrome", "#e8ecf2", roughness=0.12, metallic=1.0),
        "brand": material("brand_blue", BRAND, roughness=0.4),
        "brand_dark": material("brand_navy", "#1d3f8f", roughness=0.45),
        "accent": material("accent_orange", "#ff7a2f", roughness=0.4),
        "reflective": material("reflective", "#f2f5fa", roughness=0.15, metallic=0.4),
        "glass": material("glass", "#3d5a7a", roughness=0.05, metallic=0.3),
        "glass_light": material("glass_light", "#a9c4dd", roughness=0.05, metallic=0.2),
        "mattress": material("mattress", "#5c8fd6", roughness=0.7),
        "sheet": material("sheet", "#f7f8fb", roughness=0.85),
        "blanket": material("blanket", "#b9d3f0", roughness=0.9),
        "skin": material("skin_mid", "#c99a78", roughness=0.7),
        "floor": material("floor_vinyl", "#dfe5ec", roughness=0.6),
        "wood": material("wood_light", "#d9b98f", roughness=0.6),
        "screen": material("glow_screen", "#9fd0ff", roughness=0.2, emission="#7fc4ff", strength=2.5),
        "screen_dark": material("screen_off", "#18202b", roughness=0.15),
        "light_white": material("glow_white", "#ffffff", emission="#fff7e8", strength=4.0),
        "light_red": material("glow_red", "#ff3b3b", emission="#ff2a2a", strength=5.0),
        "light_blue": material("glow_blue", "#4d8dff", emission="#3d7dff", strength=5.0),
        "light_amber": material("glow_amber", "#ffb02e", emission="#ffa21a", strength=4.0),
        "light_green": material("glow_green", "#4be38a", emission="#2fd673", strength=4.0),
        "tail": material("glow_tail", "#d8262b", emission="#c51b20", strength=2.0),
        "status": material("status", "#30a46c", roughness=0.3, emission="#30a46c", strength=1.5),
        "triage": material("triage", TRIAGE_COLOURS[3], roughness=0.5),
        "curtain": material("curtain", "#a8d3cf", roughness=0.9),
        "seat": material("seat_fabric", "#3f5f8f", roughness=0.85),
        "plastic": material("plastic_light", "#edf0f4", roughness=0.45),
        "lead_glass": material("lead_glass", "#88a6a0", roughness=0.05, metallic=0.2),
        "asphalt": material("asphalt", "#7d8592", roughness=0.9),
        "paint_white": material("line_white", "#ffffff", roughness=0.6),
        "paint_red": material("line_red", "#d8323a", roughness=0.6),
        "concrete": material("concrete", "#c7ccd4", roughness=0.85),
        "green": material("foliage", "#7cc48a", roughness=0.85),
        "bark": material("bark", "#8a6a50", roughness=0.9),
    }


def caster(name, center, parent, mats, radius=0.065, width=0.04):
    """Swivel castor: fork, wheel and axle cap, one object pivoting at the wheel axle (spins about x)."""
    x, up, forward = center
    parts = [
        cylinder(f"{name}_tyre", radius, width, center, mats["dark"], axis="x", sides=18, round_by=width * 0.3),
        cylinder(f"{name}_hub", radius * 0.45, width * 1.1, center, mats["steel"], axis="x", sides=12),
        box(f"{name}_fork", (width * 1.8, radius * 1.3, radius * 0.5), (x, up + radius * 0.75, forward - radius * 0.2), mats["grey"], 0.008),
    ]
    return combine(name, parts, origin=center, parent=parent)


def screen(name, size, center, mats, lit=True, bezel=0.02):
    """A monitor face: dark bezel box with an emissive (or dark) panel on its +forward face."""
    width, height, depth = size
    x, up, forward = center
    return [
        box(f"{name}_bezel", (width, height, depth), center, mats["dark"], 0.01),
        box(f"{name}_panel", (width - bezel * 2, height - bezel * 2, 0.004), (x, up, forward + depth / 2 + 0.001),
            mats["screen"] if lit else mats["screen_dark"], 0.0),
    ]


def bolts_row(prefix, start, step, count, mats, radius=0.012, axis="forward"):
    x, up, forward = start
    step_x, step_up, step_forward = step
    return [cylinder(f"{prefix}{index}", radius, 0.01, (x + step_x * index, up + step_up * index, forward + step_forward * index),
                     mats["steel"], axis=axis, sides=6) for index in range(count)]


def vent(prefix, center, size, mats, slats=5, axis_face="forward"):
    """Louvred vent panel: a dark recess with horizontal slats."""
    width, height = size
    x, up, forward = center
    parts = [box(f"{prefix}_frame", (width, height, 0.02), center, mats["dark"], 0.006)]
    for index in range(slats):
        slat_up = up - height / 2 + height * (index + 0.5) / slats
        parts.append(box(f"{prefix}_slat{index}", (width * 0.9, 0.012, 0.02), (x, slat_up, forward + 0.008), mats["grey"], 0.003))
    return parts


def ring_points(radius, count, start=0.0):
    return [(math.cos(start + 2 * math.pi * index / count) * radius, math.sin(start + 2 * math.pi * index / count) * radius)
            for index in range(count)]


__all__ = ["BRAND", "TRIAGE_COLOURS", "palette", "caster", "screen", "bolts_row", "vent", "ring_points", "paint", "sphere"]
