"""Palette and shared parts for the pit-lane asset pack (app space: x side, y up, z forward).

Toy isometric look: light cool world, one strong brand colour (Halvard cobalt) with a lime accent.
Stable material names the app can find and recolour:
  <team>_primary, <team>_secondary, <team>_accent   livery colours per team (halvard, ostrava, kestrel, sable)
  compound_soft / _medium / _hard / _inter / _wet    tyre sidewall bands
  glow_*                                             emissive lamps the app may bloom
  screen                                             monitor faces
"""
import math

import bmesh
import bpy
from mathutils import Vector

from lib import _new_object, assign, bevel, combine, cylinder, material, paint, point

TEAMS = {
    # made-up teams; colour pairs chosen not to match any real livery
    "halvard": {"primary": "#2557e8", "secondary": "#f4f6fa", "accent": "#c6f432"},
    "ostrava": {"primary": "#ff5b3a", "secondary": "#f4f6fa", "accent": "#23262d"},
    "kestrel": {"primary": "#7a3cf0", "secondary": "#2a2d35", "accent": "#5fe0ff"},
    "sable": {"primary": "#f2c21b", "secondary": "#22252b", "accent": "#f4f6fa"},
}
COMPOUNDS = {"soft": "#e8343a", "medium": "#f2c21b", "hard": "#f4f6fa", "inter": "#3cc45a", "wet": "#2f7cf0"}


def palette():
    mats = {
        "carbon": material("carbon", "#1d2027", roughness=0.35, metallic=0.1),
        "carbon_matte": material("carbon_matte", "#2a2e36", roughness=0.7),
        "rubber": material("rubber", "#1c1e22", roughness=0.85),
        "rim": material("rim", "#9aa3ae", roughness=0.3, metallic=0.75),
        "steel": material("steel", "#b4bcc8", roughness=0.35, metallic=0.6),
        "chrome": material("chrome", "#dfe4ea", roughness=0.15, metallic=0.9),
        "titanium": material("titanium", "#8e959f", roughness=0.3, metallic=0.8),
        "frame": material("frame", "#5c6573", roughness=0.5, metallic=0.2),
        "dark": material("dark", "#2b313b", roughness=0.55),
        "white": material("white_body", "#f3f5f8", roughness=0.45),
        "panel": material("panel", "#dfe4ec", roughness=0.6),
        "glass": material("glass", "#3d5874", roughness=0.08, metallic=0.3),
        "glass_light": material("glass_light", "#9fb7d1", roughness=0.1, metallic=0.2),
        "concrete": material("concrete", "#d8dce3", roughness=0.85),
        "asphalt": material("asphalt", "#5d6470", roughness=0.9),
        "floor_white": material("garage_floor", "#eef1f5", roughness=0.4),
        "plate": material("sign_plate", "#ffffff", roughness=0.5),
        "screen": material("screen", "#5fb4ff", roughness=0.3, emission="#5fb4ff", strength=1.6),
        "kerb_red": material("kerb_red", "#e23b3b", roughness=0.6),
        "kerb_white": material("kerb_white", "#f5f6f8", roughness=0.6),
        "safety_orange": material("safety_orange", "#ff7a1a", roughness=0.6),
        "fence": material("fence", "#9aa3b0", roughness=0.4, metallic=0.5),
        "foliage": material("foliage", "#7cc46a", roughness=0.85),
        "foliage_dark": material("foliage_dark", "#4f9a55", roughness=0.85),
        "bark": material("bark", "#8a6a4e", roughness=0.9),
        "sand": material("sand", "#e6cf9d", roughness=0.95),
        "glow_red": material("glow_red", "#ff2d2d", emission="#ff2d2d", strength=4.0),
        "glow_green": material("glow_green", "#2dff6a", emission="#2dff6a", strength=4.0),
        "glow_amber": material("glow_amber", "#ffb21f", emission="#ffb21f", strength=4.0),
        "glow_white": material("glow_white", "#fff6df", emission="#fff6df", strength=5.0),
        "glow_blue": material("glow_blue", "#4f8dff", emission="#4f8dff", strength=4.0),
    }
    for team, colours in TEAMS.items():
        for role, colour in colours.items():
            mats[f"{team}_{role}"] = material(f"{team}_{role}", colour, roughness=0.32 if role == "primary" else 0.4, metallic=0.15)
    for compound, colour in COMPOUNDS.items():
        mats[f"compound_{compound}"] = material(f"compound_{compound}", colour, roughness=0.5)
    return mats


def tube(name, points, radius, mat, sides=10, closed=False, round_ends=True):
    """Sweep a circle along a polyline of app-space points (halo, wishbones, rails, hoses)."""
    bm = bmesh.new()
    path = [point(*location) for location in points]
    rings = []
    for index, centre in enumerate(path):
        if closed:
            previous_point = path[index - 1]
            next_point = path[(index + 1) % len(path)]
        else:
            previous_point = path[max(index - 1, 0)]
            next_point = path[min(index + 1, len(path) - 1)]
        tangent = (next_point - previous_point).normalized()
        helper = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
        side = tangent.cross(helper).normalized()
        upward = side.cross(tangent).normalized()
        ring = []
        for step in range(sides):
            angle = 2 * math.pi * step / sides
            ring.append(bm.verts.new(centre + (side * math.cos(angle) + upward * math.sin(angle)) * radius))
        rings.append(ring)
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for first, second in pairs:
        for step in range(sides):
            following = (step + 1) % sides
            bm.faces.new((first[step], first[following], second[following], second[step]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    return assign(obj, mat)


def ring(name, inner, outer, thickness, center, mat, sides=32):
    """Flat annulus across x (a sidewall band, a rim lip), centred on `center`."""
    bm = bmesh.new()
    layers = []
    for offset in (-thickness / 2, thickness / 2):
        layer = []
        for radius in (inner, outer):
            layer.append([bm.verts.new(point(offset, math.sin(2 * math.pi * step / sides) * radius,
                                             math.cos(2 * math.pi * step / sides) * radius)) for step in range(sides)])
        layers.append(layer)
    for step in range(sides):
        following = (step + 1) % sides
        for layer in layers:
            inner_ring, outer_ring = layer
            bm.faces.new((inner_ring[step], inner_ring[following], outer_ring[following], outer_ring[step]))
        for which in (0, 1):
            first, second = layers[0][which], layers[1][which]
            bm.faces.new((first[step], first[following], second[following], second[step]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    obj.location = point(*center)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return assign(obj, mat)


def airfoil(chord, thickness, angle_degrees, lead=(0.0, 0.0), points=12):
    """Outline (forward, up) of a cambered wing section; the leading edge sits at `lead` and faces +forward.
    Positive angle raises the trailing edge (downforce wings point their leading edge down)."""
    outline_top = []
    outline_bottom = []
    for index in range(points + 1):
        fraction = index / points
        half = thickness * 2.6 * (0.2969 * math.sqrt(fraction) - 0.126 * fraction - 0.3516 * fraction ** 2
                                  + 0.2843 * fraction ** 3 - 0.1036 * fraction ** 4)
        camber = -0.06 * chord * 4 * fraction * (1 - fraction)
        outline_top.append((fraction * chord, camber + half))
        outline_bottom.append((fraction * chord, camber - half))
    outline = outline_top + list(reversed(outline_bottom[1:-1]))
    angle = math.radians(angle_degrees)
    rotated = []
    for along, up in outline:
        forward = -along * math.cos(angle) + up * math.sin(angle)
        rise = along * math.sin(angle) + up * math.cos(angle)
        rotated.append((lead[0] + forward, lead[1] + rise))
    return rotated


def race_wheel(name, radius, width, center, parent, compound_mat, mats, cover_mat=None):
    """Low-profile 18 in race wheel: rounded tyre, coloured sidewall band both sides, recessed rim with
    spokes, wheel cover disc and centre nut. One object spinning about x, origin at the hub."""
    x, up, forward = center
    rim_radius = 0.2285
    parts = [cylinder(f"{name}_tyre", radius, width, center, mats["rubber"], axis="x", sides=40, round_by=width * 0.22)]
    for side in (-1, 1):
        face_x = x + side * width / 2
        parts.append(ring(f"{name}_band{side}", radius * 0.80, radius * 0.88, 0.006, (face_x + side * 0.001, up, forward), compound_mat, sides=40))
        parts.append(cylinder(f"{name}_rim{side}", rim_radius, 0.02, (face_x - side * 0.03, up, forward), mats["rim"], axis="x", sides=32))
        parts.append(cylinder(f"{name}_cover{side}", rim_radius * 0.92, 0.012, (face_x - side * 0.02, up, forward), cover_mat or mats["carbon"], axis="x", sides=32))
        parts.append(cylinder(f"{name}_nut{side}", 0.035, 0.05, (face_x - side * 0.005, up, forward), mats["chrome"], axis="x", sides=6, round_by=0.006))
        for spoke in range(10):
            angle = 2 * math.pi * spoke / 10
            parts.append(cylinder(f"{name}_spoke{side}_{spoke}", 0.012, 0.012,
                                  (face_x - side * 0.016, up + math.sin(angle) * rim_radius * 0.78, forward + math.cos(angle) * rim_radius * 0.78),
                                  mats["chrome"], axis="x", sides=6))
    return combine(name, parts, origin=center, parent=parent)


def road_wheel(name, radius, width, center, parent, mats, spokes=5):
    """Road tyre with alloy rim (safety car, trucks)."""
    parts = [cylinder(f"{name}_tyre", radius, width, center, mats["rubber"], axis="x", sides=28, round_by=width * 0.3),
             cylinder(f"{name}_rim", radius * 0.68, width * 1.02, center, mats["steel"], axis="x", sides=24, round_by=0.01),
             cylinder(f"{name}_hub", radius * 0.16, width * 1.08, center, mats["chrome"], axis="x", sides=10)]
    x, up, forward = center
    for spoke in range(spokes):
        angle = 2 * math.pi * spoke / spokes
        parts.append(cylinder(f"{name}_lug{spoke}", radius * 0.04, width * 1.1,
                              (x, up + math.sin(angle) * radius * 0.3, forward + math.cos(angle) * radius * 0.3), mats["chrome"], axis="x", sides=6))
    return combine(name, parts, origin=center, parent=parent)


def person_stand_in(name, location, mat):
    """Not exported in families; reserved for compare renders."""
    return cylinder(name, 0.22, 1.78, (location[0], 0.89, location[2]), mat)
