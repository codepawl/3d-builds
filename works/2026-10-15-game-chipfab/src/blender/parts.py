"""Palette and small shared details for the fab assets: vents, bolts, panel seams, signage
plates, operator screens, load ports and the status lamp tower every tool carries.

Faces are named by their outward normal in app space: '+x', '-x', '+f' (front, +z in three.js),
'-f' and '+u'. Details sit a few millimetres proud of the face they are mounted on.
"""
import math

from lib import box, combine, cylinder, material

BRAND = "#13a594"
SHELL = "#eef1f5"
PANEL = "#d9dfe7"
TRIM = "#3a4250"
STEEL = "#b8c0cb"


def palette():
    """The shared materials, created once per scene. White `tint` takes vertex colours;
    `glass` is see-through (alpha 0.35, exported as BLEND) so tool interiors read from above."""
    glass = material("glass", "#a9cbe0", roughness=0.08, metallic=0.1)
    glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.35
    return {
        "shell": material("shell", SHELL, roughness=0.42),
        "panel": material("panel", PANEL, roughness=0.5),
        "trim": material("trim", TRIM, roughness=0.55, metallic=0.2),
        "steel": material("steel", STEEL, roughness=0.32, metallic=0.75),
        "brand": material("brand", BRAND, roughness=0.38),
        "tint": material("tint", "#ffffff", roughness=0.5),
        "glass": glass,
        "rubber": material("rubber", "#2b2f36", roughness=0.85),
        "screen": material("glow_screen", "#163a4a", emission="#6fe0ff", strength=2.2),
        "yellow": material("glow_litho", "#f3d36a", emission="#ffd34d", strength=3.0),
        "lamp": material("glow_lamp", "#ffffff", emission="#e8f6ff", strength=3.0),
        "status": material("status", "#4ad48a", emission="#4ad48a", strength=3.5),
        "amber": material("glow_amber", "#f2a93b", emission="#f2a93b", strength=1.2),
        "red": material("glow_red", "#e5484d", emission="#e5484d", strength=1.2),
    }


def _face_box(name, face, center, width, height, depth, mat, round_by=0.004):
    """A box lying on a face: `width` runs along the face horizontally, `height` up the face
    (or along forward for '+u'), `depth` out of it. `center` is the point on the face."""
    x, up, forward = center
    half = depth / 2
    if face in ("+f", "-f"):
        sign = 1 if face == "+f" else -1
        return box(name, (width, height, depth), (x, up, forward + sign * half), mat, round_by)
    if face in ("+x", "-x"):
        sign = 1 if face == "+x" else -1
        return box(name, (depth, height, width), (x + sign * half, up, forward), mat, round_by)
    return box(name, (width, depth, height), (x, up + half, forward), mat, round_by)


def _offset_along(face, center, along, across=0.0):
    """Move along a face: `along` horizontally in the face, `across` up it."""
    x, up, forward = center
    if face in ("+f", "-f"):
        return (x + along, up + across, forward)
    if face in ("+x", "-x"):
        return (x, up + across, forward + along)
    return (x + along, up, forward + across)


def vent(prefix, face, center, width, height, mats, slats=6):
    """A grille: a dark recess frame with horizontal slats across it."""
    parts = [_face_box(f"{prefix}_frame", face, center, width, height, 0.012, mats["trim"])]
    pitch = height / slats
    for index in range(slats):
        slat_center = _offset_along(face, center, 0.0, -height / 2 + pitch * (index + 0.5))
        parts.append(_face_box(f"{prefix}_slat{index}", face, slat_center, width * 0.92, pitch * 0.42, 0.022, mats["panel"]))
    return parts


def bolts(prefix, face, center, width, height, mats, radius=0.012):
    """Four bolt heads in the corners of a rectangle on a face."""
    parts = []
    for index, (along, across) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        spot = _offset_along(face, center, along * width / 2, across * height / 2)
        parts.append(_face_box(f"{prefix}_bolt{index}", face, spot, radius * 2, radius * 2, 0.014, mats["steel"], round_by=radius * 0.6))
    return parts


def seams(prefix, face, center, width, height, count, mats):
    """Vertical panel seams splitting a face into `count` panels."""
    parts = []
    for index in range(1, count):
        along = -width / 2 + width * index / count
        spot = _offset_along(face, center, along, 0.0)
        parts.append(_face_box(f"{prefix}_seam{index}", face, spot, 0.014, height * 0.96, 0.004, mats["trim"], round_by=0.0))
    return parts


def plate(prefix, face, center, width, height, mats):
    """A signage plate: brand colour with a white name strip and bolts."""
    parts = [
        _face_box(f"{prefix}_plate", face, center, width, height, 0.01, mats["brand"]),
        _face_box(f"{prefix}_label", face, _offset_along(face, center, -width * 0.08, 0.0), width * 0.62, height * 0.28, 0.016, mats["shell"]),
    ]
    return parts + bolts(f"{prefix}_plate", face, center, width * 0.86, height * 0.7, mats, radius=0.007)


def screen(prefix, face, center, mats, width=0.42, height=0.3):
    """An operator touch screen in a bezel."""
    return [
        _face_box(f"{prefix}_bezel", face, center, width, height, 0.03, mats["trim"], round_by=0.01),
        _face_box(f"{prefix}_screen", face, center, width * 0.86, height * 0.8, 0.036, mats["screen"], round_by=0.0),
    ]


def light_tower(prefix, center, mats):
    """A signal tower: a pole with red and amber segments. The green top segment is returned
    separately as the `status` lamp the app recolours by tool state."""
    x, up, forward = center
    parts = [
        cylinder(f"{prefix}_pole", 0.018, 0.3, (x, up + 0.15, forward), mats["steel"], sides=10),
        cylinder(f"{prefix}_red", 0.04, 0.07, (x, up + 0.34, forward), mats["red"], sides=14, round_by=0.008),
        cylinder(f"{prefix}_amber", 0.04, 0.07, (x, up + 0.415, forward), mats["amber"], sides=14, round_by=0.008),
        cylinder(f"{prefix}_cap", 0.042, 0.02, (x, up + 0.55, forward), mats["trim"], sides=14, round_by=0.006),
    ]
    status = cylinder(f"{prefix}_statuslamp", 0.04, 0.08, (x, up + 0.495, forward), mats["status"], sides=14, round_by=0.008)
    return parts, status


def load_port(prefix, center, mats, group):
    """One load port facing +forward: a cabinet with a kinematic plate at 0.9 m where a pod sits,
    and a separate door that drops down (pivot at its bottom hinge). Returns the body parts;
    the door is its own object under `group`."""
    x, up, forward = center
    parts = [
        box(f"{prefix}_cabinet", (0.5, 0.86, 0.5), (x, up + 0.43, forward - 0.05), mats["shell"], 0.03),
        box(f"{prefix}_plate", (0.44, 0.04, 0.48), (x, up + 0.88, forward), mats["panel"], 0.01),
        box(f"{prefix}_frame", (0.52, 0.5, 0.06), (x, up + 1.15, forward - 0.29), mats["trim"], 0.012),
        box(f"{prefix}_button", (0.08, 0.04, 0.02), (x + 0.16, up + 0.72, forward + 0.205), mats["status"], 0.008),
    ]
    for index, (along, depth) in enumerate(((-0.12, -0.1), (0.12, -0.1), (0.0, 0.12))):
        parts.append(cylinder(f"{prefix}_pin{index}", 0.012, 0.02, (x + along, up + 0.905, forward + depth), mats["steel"], sides=8))
    parts += vent(f"{prefix}_vent", "+f", (x, up + 0.3, forward + 0.2), 0.32, 0.2, mats, slats=4)
    hinge = (x, up + 0.92, forward - 0.25)
    door = combine(f"{prefix}_door", [
        box(f"{prefix}_door_panel", (0.44, 0.44, 0.03), (x, up + 1.15, forward - 0.25), mats["panel"], 0.012),
        box(f"{prefix}_door_seal", (0.36, 0.36, 0.01), (x, up + 1.15, forward - 0.23), mats["rubber"], 0.004),
    ], origin=hinge, parent=group)
    return parts, door


def ring_positions(count, radius, start_angle=0.0, spread=2 * math.pi):
    """Points around a circle in the x/forward plane, starting at +forward."""
    step = spread / count
    return [(math.sin(start_angle + step * index) * radius, math.cos(start_angle + step * index) * radius,
             start_angle + step * index) for index in range(count)]
