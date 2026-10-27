"""Campus exterior (campus.glb) and road vehicles (trucks.glb), real-world metres, y = 0 is
ground, fronts face +forward.

campus.glb roots:
  bldg_fab_main   300 mm logic fab, 80 x 22 x 50 m, rooftop exhaust and air handlers
  bldg_fab_ramp   second fab under ramp-up: half-fitted roof, scaffold, tower crane whose
                  _crane_jib turns about up at the mast top
  bldg_packaging  advanced packaging plant with loading docks
  bldg_upw        ultra-pure water plant: hall, storage tanks, membrane skids
  gas_yard        bulk gas yard: vertical cryogenic tanks, horizontal tanks, vaporisers, fence
  cooling_tower   three-cell tower; _fan0.._fan2 spin about up
  substation      transformers, gantry, fence
  bldg_admin      office block with glazed front
  tree_a, tree_b, lamp_post
trucks.glb roots: truck_tube, truck_box, van_service; each _wheelN spins about x.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import box, combine, cylinder, export, material, reset_scene, root, sphere, wheel  # noqa: E402
from parts import palette  # noqa: E402


def facade_strips(prefix, width, height, depth, mats, spacing=4.0):
    """Vertical panel seams on the front and back and on the sides of a building block."""
    parts = []
    for index in range(1, int(width / spacing)):
        along = -width / 2 + index * spacing
        for sign in (-1, 1):
            parts.append(box(f"{prefix}_fs{index}_{sign}", (0.12, height - 0.4, 0.06), (along, height / 2, sign * depth / 2), mats["panel"], 0.0))
    for index in range(1, int(depth / spacing)):
        along = -depth / 2 + index * spacing
        for sign in (-1, 1):
            parts.append(box(f"{prefix}_ss{index}_{sign}", (0.06, height - 0.4, 0.12), (sign * width / 2, height / 2, along), mats["panel"], 0.0))
    return parts


def louvre_band(prefix, width, up, depth, mats):
    """A band of louvres along the front and back at height `up`."""
    parts = []
    for sign in (-1, 1):
        parts.append(box(f"{prefix}_lv{sign}", (width * 0.9, 1.6, 0.2), (0, up, sign * depth / 2), mats["trim"], 0.05))
        for slat in range(4):
            parts.append(box(f"{prefix}_lv{sign}_{slat}", (width * 0.88, 0.14, 0.3), (0, up - 0.6 + slat * 0.4, sign * depth / 2), mats["panel"], 0.03))
    return parts


def rooftop(prefix, width, depth, height, mats, fitted=1.0):
    """Exhaust stacks and air-handling units across the roof; `fitted` < 1 leaves part bare."""
    parts = []
    columns = int(width / 12)
    for index in range(int(columns * fitted)):
        unit_x = -width / 2 + 8 + index * 12
        parts.append(box(f"{prefix}_ahu{index}", (8, 2.6, 5), (unit_x, height + 1.3, -depth / 4), mats["panel"], 0.3))
        parts.append(box(f"{prefix}_ahuband{index}", (8.05, 0.3, 5.05), (unit_x, height + 2.2, -depth / 4), mats["brand"], 0.05))
        for fan in range(2):
            parts.append(cylinder(f"{prefix}_ahufan{index}_{fan}", 1.0, 0.3, (unit_x - 2 + fan * 4, height + 2.75, -depth / 4), mats["trim"], sides=24, round_by=0.08))
        parts.append(cylinder(f"{prefix}_stack{index}", 0.9, 7.0, (unit_x, height + 3.5, depth / 4), mats["steel"], sides=24, round_by=0.1))
        parts.append(cylinder(f"{prefix}_stackcap{index}", 1.05, 0.4, (unit_x, height + 7.0, depth / 4), mats["trim"], sides=24, round_by=0.1))
        parts.append(box(f"{prefix}_duct{index}", (1.4, 1.4, depth / 2 - 4), (unit_x + 2.5, height + 0.7, 0), mats["steel"], 0.15))
    return parts


def fab(name, mats, ramp):
    """A fab block: tall cleanroom box with a lower support spine in front, louvre bands for the
    sub-fab, and an entrance canopy. `ramp` leaves part of the roof bare and adds a scaffold
    and a tower crane."""
    group = root(name)
    width, height, depth = 80.0, 22.0, 50.0
    parts = [
        box(f"{name}_block", (width, height, depth), (0, height / 2, 0), mats["shell"], 0.6),
        box(f"{name}_band", (width + 0.1, 1.4, depth + 0.1), (0, height - 2.0, 0), mats["brand"], 0.1),
        box(f"{name}_parapet", (width - 1.0, 0.8, depth - 1.0), (0, height + 0.4, 0), mats["panel"], 0.1),
        box(f"{name}_spine", (width * 0.7, 9.0, 8.0), (0, 4.5, depth / 2 + 4.0), mats["panel"], 0.4),
        box(f"{name}_canopy", (14.0, 0.6, 6.0), (-width * 0.25, 4.0, depth / 2 + 10.5), mats["brand"], 0.2),
        box(f"{name}_entrance", (10.0, 3.4, 0.3), (-width * 0.25, 1.7, depth / 2 + 8.05), mats["glass"], 0.05),
        box(f"{name}_sign", (12.0, 2.4, 0.3), (width * 0.25, height - 6.0, depth / 2 + 0.15), mats["brand"], 0.2),
        box(f"{name}_signtext", (8.0, 0.8, 0.35), (width * 0.25, height - 6.0, depth / 2 + 0.2), mats["shell"], 0.05),
    ]
    for index in range(4):
        parts.append(cylinder(f"{name}_canopyleg{index}", 0.2, 4.0, (-width * 0.25 - 6 + index * 4, 2.0, depth / 2 + 13.0), mats["steel"], sides=12))
    parts += facade_strips(name, width, height, depth, mats)
    parts += louvre_band(name, width, 3.0, depth, mats)
    parts += rooftop(name, width, depth, height, mats, fitted=0.5 if ramp else 1.0)
    if ramp:
        for level in range(6):
            parts.append(box(f"{name}_scaffdeck{level}", (24.0, 0.2, 2.0), (width / 2 - 14, 2.0 + level * 3.4, -depth / 2 - 1.2), mats["amber"], 0.05))
        for index in range(7):
            parts.append(box(f"{name}_scaffpost{index}", (0.15, 21.0, 0.15), (width / 2 - 26 + index * 4, 10.5, -depth / 2 - 2.1), mats["steel"], 0.0))
        mast_x, mast_forward = width / 2 + 8, -depth / 2 + 10
        parts.append(box(f"{name}_mast", (2.0, 46.0, 2.0), (mast_x, 23.0, mast_forward), mats["amber"], 0.1))
        parts.append(box(f"{name}_cranebase", (6.0, 1.0, 6.0), (mast_x, 0.5, mast_forward), mats["trim"], 0.2))
        pivot = (mast_x, 46.0, mast_forward)
        combine(f"{name}_crane_jib", [
            box(f"{name}_jib", (40.0, 1.6, 1.6), (mast_x - 12, 47.0, mast_forward), mats["amber"], 0.1),
            box(f"{name}_counter", (5.0, 2.4, 2.4), (mast_x + 10, 46.6, mast_forward), mats["trim"], 0.2),
            box(f"{name}_cab", (2.4, 2.4, 2.4), (mast_x + 1.6, 45.0, mast_forward + 1.8), mats["shell"], 0.2),
            box(f"{name}_hookline", (0.1, 14.0, 0.1), (mast_x - 22, 40.0, mast_forward), mats["trim"], 0.0),
            box(f"{name}_hook", (1.0, 1.0, 1.0), (mast_x - 22, 32.5, mast_forward), mats["amber"], 0.2),
        ], origin=pivot, parent=group)
    combine(f"{name}_mesh", parts, parent=group)


def packaging(name, mats):
    group = root(name)
    width, height, depth = 50.0, 12.0, 35.0
    parts = [
        box(f"{name}_block", (width, height, depth), (0, height / 2, 0), mats["shell"], 0.5),
        box(f"{name}_band", (width + 0.1, 1.0, depth + 0.1), (0, height - 1.5, 0), mats["brand"], 0.1),
        box(f"{name}_sign", (9.0, 1.8, 0.3), (-width * 0.25, height - 4.0, depth / 2 + 0.15), mats["brand"], 0.15),
    ]
    for index in range(4):
        dock_x = 4 + index * 5
        parts.append(box(f"{name}_dock{index}", (3.4, 3.6, 0.3), (dock_x, 1.8 + 1.0, depth / 2 + 0.15), mats["trim"], 0.08))
        parts.append(box(f"{name}_dockdoor{index}", (3.0, 3.2, 0.35), (dock_x, 2.8, depth / 2 + 0.15), mats["panel"], 0.05))
        parts.append(box(f"{name}_leveler{index}", (3.0, 1.0, 1.6), (dock_x, 0.5, depth / 2 + 0.8), mats["trim"], 0.05))
        parts.append(box(f"{name}_docklamp{index}", (0.3, 0.3, 0.2), (dock_x + 2.0, 4.6, depth / 2 + 0.3), mats["status"], 0.05))
    for index in range(5):
        parts.append(box(f"{name}_skylight{index}", (6.0, 0.5, depth - 8), (-width / 2 + 6 + index * 9.5, height + 0.25, 0), mats["glass"], 0.1))
    parts += facade_strips(name, width, height, depth, mats)
    combine(f"{name}_mesh", parts, parent=group)


def upw_plant(name, mats):
    """Ultra-pure water plant: a hall, a row of storage tanks, and open membrane skids."""
    group = root(name)
    water = material("water_tank", "#d8eef7", roughness=0.3)
    parts = [
        box(f"{name}_hall", (22.0, 9.0, 14.0), (0, 4.5, -4.0), mats["shell"], 0.4),
        box(f"{name}_band", (22.1, 0.8, 14.1), (0, 7.6, -4.0), mats["brand"], 0.05),
    ]
    parts += louvre_band(f"{name}_hall", 22.0, 2.5, 14.0, mats)
    for index in range(4):
        tank_x = -8.0 + index * 5.3
        parts.append(cylinder(f"{name}_tank{index}", 2.0, 9.0, (tank_x, 4.5, 7.0), water, sides=32, round_by=0.2))
        parts.append(sphere(f"{name}_tanktop{index}", 2.0, (tank_x, 9.0, 7.0), water, scale=(1, 0.3, 1), segments=24))
        parts.append(cylinder(f"{name}_tankring{index}", 2.05, 0.3, (tank_x, 6.0, 7.0), mats["brand"], sides=32))
        parts.append(cylinder(f"{name}_tankpipe{index}", 0.25, 4.0, (tank_x, 1.5, 4.0), mats["steel"], axis="forward", sides=14))
    for index in range(3):
        skid_x = 14.0
        parts.append(box(f"{name}_skid{index}", (4.0, 0.3, 2.0), (skid_x, 0.15, -8.0 + index * 4.0), mats["trim"], 0.05))
        for vessel in range(4):
            vessel_center = (skid_x - 1.2 + vessel * 0.8, 1.2, -8.0 + index * 4.0)
            parts.append(cylinder(f"{name}_membrane{index}_{vessel}", 0.2, 1.8, vessel_center, mats["shell"], axis="forward", sides=14, round_by=0.04))
    combine(f"{name}_mesh", parts, parent=group)


def fence(prefix, width, depth, mats, gap_front=0.0):
    parts = []
    for sign in (-1, 1):
        parts.append(box(f"{prefix}_fx{sign}", (0.08, 2.0, depth), (sign * width / 2, 1.0, 0), mats["steel"], 0.0))
        parts.append(box(f"{prefix}_back{sign}", (width / 2 - gap_front / 2, 2.0, 0.08), (sign * (width / 4 + gap_front / 4), 1.0, -depth / 2), mats["steel"], 0.0))
        parts.append(box(f"{prefix}_front{sign}", (width / 2 - gap_front / 2, 2.0, 0.08), (sign * (width / 4 + gap_front / 4), 1.0, depth / 2), mats["steel"], 0.0))
    return parts


def gas_yard(name, mats):
    group = root(name)
    cryo = material("cryo_tank", "#f3f6fa", roughness=0.35)
    parts = [box(f"{name}_pad", (30.0, 0.2, 20.0), (0, 0.1, 0), material("concrete", "#c9cdd3", roughness=0.85), 0.05)]
    for index in range(3):
        tank_x = -10.0 + index * 6.0
        parts.append(cylinder(f"{name}_cryo{index}", 1.6, 12.0, (tank_x, 6.2, -5.0), cryo, sides=28, round_by=0.2))
        parts.append(sphere(f"{name}_cryotop{index}", 1.6, (tank_x, 12.2, -5.0), cryo, scale=(1, 0.35, 1), segments=20))
        parts.append(cylinder(f"{name}_cryoring{index}", 1.65, 0.4, (tank_x, 9.0, -5.0), mats["brand"], sides=28))
        for leg in range(4):
            angle = leg * math.pi / 2 + math.pi / 4
            parts.append(box(f"{name}_cryoleg{index}_{leg}", (0.3, 1.0, 0.3), (tank_x + math.cos(angle) * 1.4, 0.6, -5.0 + math.sin(angle) * 1.4), mats["steel"], 0.03))
    for index in range(2):
        parts.append(cylinder(f"{name}_htank{index}", 1.3, 9.0, (8.0, 2.0, -6.0 + index * 4.0), cryo, axis="x", sides=28, round_by=0.25))
        parts.append(box(f"{name}_saddle{index}", (7.0, 0.8, 1.6), (8.0, 0.6, -6.0 + index * 4.0), mats["trim"], 0.05))
    for index in range(6):
        parts.append(box(f"{name}_vaporiser{index}", (0.8, 5.0, 0.8), (-12.0 + index * 1.4, 2.7, 6.0), mats["steel"], 0.05))
    parts += fence(name, 30.0, 20.0, mats, gap_front=6.0)
    combine(f"{name}_mesh", parts, parent=group)


def cooling_tower(name, mats):
    group = root(name)
    cells = 3
    parts = [
        box(f"{name}_basin", (18.6, 1.0, 8.6), (0, 0.5, 0), mats["trim"], 0.1),
        box(f"{name}_body", (18.0, 5.0, 8.0), (0, 3.5, 0), mats["shell"], 0.3),
        box(f"{name}_band", (18.1, 0.5, 8.1), (0, 5.5, 0), mats["brand"], 0.05),
    ]
    for sign in (-1, 1):
        for slat in range(6):
            parts.append(box(f"{name}_intake{sign}_{slat}", (17.0, 0.2, 0.3), (0, 1.5 + slat * 0.45, sign * 4.05), mats["panel"], 0.03))
    for index in range(cells):
        cell_x = -6.0 + index * 6.0
        # A low dark stack collar; the fan turns just above it so it reads from above, between guard posts.
        parts.append(cylinder(f"{name}_collar{index}", 2.5, 0.6, (cell_x, 6.3, 0), mats["trim"], sides=32, round_by=0.1))
        for post in range(4):
            angle = post * math.pi / 2 + math.pi / 4
            parts.append(box(f"{name}_guardpost{index}_{post}", (0.12, 1.0, 0.12), (cell_x + math.cos(angle) * 2.45, 7.0, math.sin(angle) * 2.45), mats["steel"], 0.02))
    combine(f"{name}_mesh", parts, parent=group)
    for index in range(cells):
        center = (-6.0 + index * 6.0, 6.75, 0)
        blades = []
        for blade in range(5):
            angle = blade * 2 * math.pi / 5
            part = box(f"{name}_blade{index}_{blade}", (2.2, 0.08, 0.5), center, mats["trim"], 0.04)
            part.rotation_euler.z = angle
            # place the blade so it reaches out from the hub along its own angle
            part.location.x = center[0] + math.cos(angle) * 1.15
            part.location.y = -center[2] + math.sin(angle) * 1.15
            blades.append(part)
        blades.append(cylinder(f"{name}_hub{index}", 0.35, 0.3, center, mats["steel"], sides=16))
        combine(f"{name}_fan{index}", blades, origin=center, parent=group)


def substation(name, mats):
    group = root(name)
    parts = [box(f"{name}_pad", (24.0, 0.2, 16.0), (0, 0.1, 0), material("gravel", "#b9bec6", roughness=0.95), 0.02)]
    for index in range(3):
        unit_x = -7.0 + index * 7.0
        parts.append(box(f"{name}_tx{index}", (3.4, 3.0, 2.6), (unit_x, 1.7, 0), mats["panel"], 0.15))
        for fin in range(6):
            parts.append(box(f"{name}_fin{index}_{fin}", (0.08, 2.4, 0.9), (unit_x - 1.0 + fin * 0.4, 1.6, 1.75), mats["trim"], 0.0))
        for bushing in range(3):
            parts.append(cylinder(f"{name}_bushing{index}_{bushing}", 0.15, 1.2, (unit_x - 0.8 + bushing * 0.8, 3.8, -0.5), mats["shell"], sides=12, round_by=0.05))
        parts.append(box(f"{name}_warn{index}", (1.0, 0.6, 0.05), (unit_x, 1.6, -1.33), mats["amber"], 0.02))
    for sign in (-1, 1):
        parts.append(box(f"{name}_gantryleg{sign}", (0.5, 9.0, 0.5), (sign * 10.0, 4.6, -5.0), mats["steel"], 0.05))
    parts.append(box(f"{name}_gantrybeam", (20.5, 0.6, 0.6), (0, 9.0, -5.0), mats["steel"], 0.05))
    for index in range(3):
        parts.append(box(f"{name}_wire{index}", (0.06, 0.06, 4.6), (-7.0 + index * 7.0, 8.0, -2.6), mats["trim"], 0.0))
    parts += fence(name, 24.0, 16.0, mats, gap_front=4.0)
    combine(f"{name}_mesh", parts, parent=group)


def admin(name, mats):
    group = root(name)
    parts = [
        box(f"{name}_block", (30.0, 15.0, 12.0), (0, 7.5, 0), mats["shell"], 0.4),
        box(f"{name}_roofcap", (30.4, 0.6, 12.4), (0, 15.3, 0), mats["brand"], 0.1),
        box(f"{name}_lobby", (8.0, 4.0, 3.0), (6.0, 2.0, 7.4), mats["glass"], 0.1),
    ]
    for floor_index in range(4):
        parts.append(box(f"{name}_ribbon{floor_index}", (28.0, 2.0, 0.2), (0, 2.5 + floor_index * 3.4, 6.05), mats["glass"], 0.05))
        parts.append(box(f"{name}_ribbonback{floor_index}", (28.0, 2.0, 0.2), (0, 2.5 + floor_index * 3.4, -6.05), mats["glass"], 0.05))
    combine(f"{name}_mesh", parts, parent=group)


def tree(name, round_crown):
    group = root(name)
    trunk = material("trunk", "#8a6f58", roughness=0.8)
    leaves = material("leaves", "#7cc9a0" if round_crown else "#5fb58a", roughness=0.7)
    parts = [cylinder(f"{name}_trunk", 0.18, 2.4, (0, 1.2, 0), trunk, sides=10, radius_end=0.12)]
    if round_crown:
        parts.append(sphere(f"{name}_crown", 1.6, (0, 3.6, 0), leaves, scale=(1, 1.15, 1), segments=16))
        parts.append(sphere(f"{name}_crown2", 1.0, (0.7, 4.4, 0.3), leaves, segments=12))
    else:
        for level in range(3):
            parts.append(cylinder(f"{name}_cone{level}", 1.5 - level * 0.4, 1.8, (0, 2.6 + level * 1.1, 0), leaves, sides=14, radius_end=0.15))
    combine(f"{name}_mesh", parts, parent=group)


def lamp_post(name, mats):
    group = root(name)
    combine(f"{name}_mesh", [
        cylinder(f"{name}_pole", 0.08, 6.0, (0, 3.0, 0), mats["steel"], sides=10, radius_end=0.06),
        box(f"{name}_arm", (0.1, 0.1, 1.2), (0, 5.95, 0.55), mats["steel"], 0.02),
        box(f"{name}_head", (0.3, 0.12, 0.6), (0, 5.9, 1.1), mats["trim"], 0.04),
        box(f"{name}_glow", (0.24, 0.02, 0.5), (0, 5.83, 1.1), mats["lamp"], 0.0),
        cylinder(f"{name}_base", 0.2, 0.4, (0, 0.2, 0), mats["trim"], sides=12),
    ], parent=group)


# --- vehicles --------------------------------------------------------------------------------

def cab(prefix, mats, front, width, paint):
    """A truck cab whose front face is at `front` (forward)."""
    body = material(f"cab_{paint}", paint, roughness=0.35)
    return [
        box(f"{prefix}_cab", (width, 1.9, 1.9), (0, 1.75, front - 0.95), body, 0.18),
        box(f"{prefix}_windscreen", (width - 0.3, 0.8, 0.06), (0, 2.25, front - 0.02), mats["glass"], 0.03),
        box(f"{prefix}_sidewindowl", (0.06, 0.6, 0.8), (-width / 2, 2.25, front - 0.6), mats["glass"], 0.02),
        box(f"{prefix}_sidewindowr", (0.06, 0.6, 0.8), (width / 2, 2.25, front - 0.6), mats["glass"], 0.02),
        box(f"{prefix}_grille", (width - 0.6, 0.5, 0.06), (0, 1.25, front), mats["trim"], 0.03),
        box(f"{prefix}_bumper", (width + 0.05, 0.25, 0.2), (0, 0.85, front + 0.05), mats["trim"], 0.06),
        box(f"{prefix}_headl", (0.3, 0.14, 0.05), (-width / 2 + 0.3, 1.05, front + 0.02), mats["lamp"], 0.02),
        box(f"{prefix}_headr", (0.3, 0.14, 0.05), (width / 2 - 0.3, 1.05, front + 0.02), mats["lamp"], 0.02),
        box(f"{prefix}_mirrorl", (0.1, 0.3, 0.14), (-width / 2 - 0.12, 2.2, front - 0.3), mats["trim"], 0.03),
        box(f"{prefix}_mirrorr", (0.1, 0.3, 0.14), (width / 2 + 0.12, 2.2, front - 0.3), mats["trim"], 0.03),
    ]


def truck_wheels(name, positions, group):
    for index, (x, forward) in enumerate(positions):
        wheel(f"{name}_wheel{index}", 0.48, 0.32, (x, 0.48, forward), group)


def truck_tube(name, mats):
    """A tube trailer for bulk gas: a cab and a frame carrying a bundle of long cylinders."""
    group = root(name)
    parts = cab(name, mats, 6.0, 2.4, "#eef1f5")
    parts += [
        box(f"{name}_chassis", (1.2, 0.3, 11.5), (0, 0.85, 0.2), mats["trim"], 0.05),
        box(f"{name}_frontframe", (2.4, 2.6, 0.2), (0, 2.25, 3.5), mats["steel"], 0.05),
        box(f"{name}_rearframe", (2.4, 2.6, 0.2), (0, 2.25, -5.4), mats["steel"], 0.05),
        box(f"{name}_valvebox", (2.3, 2.4, 0.6), (0, 2.25, -5.8), mats["panel"], 0.08),
        box(f"{name}_hazard", (0.5, 0.5, 0.05), (0, 2.6, -6.12), mats["amber"], 0.02),
    ]
    for row in range(3):
        for column in range(3):
            parts.append(cylinder(f"{name}_tube{row}_{column}", 0.36, 8.8, (-0.78 + column * 0.78, 1.45 + row * 0.75, -1.0), mats["shell"], axis="forward", sides=18, round_by=0.12))
    for band in range(3):
        parts.append(box(f"{name}_strap{band}", (2.42, 2.3, 0.12), (0, 2.2, 2.0 - band * 3.0), mats["brand"], 0.03))
    combine(f"{name}_body", parts, parent=group)
    truck_wheels(name, [(-1.05, 4.6), (1.05, 4.6), (-1.05, -3.6), (1.05, -3.6), (-1.05, -4.7), (1.05, -4.7)], group)


def truck_box(name, mats):
    group = root(name)
    parts = cab(name, mats, 3.6, 2.4, "#13a594")
    parts += [
        box(f"{name}_chassis", (1.2, 0.3, 7.0), (0, 0.85, 0.0), mats["trim"], 0.05),
        box(f"{name}_box", (2.5, 2.8, 5.4), (0, 2.5, -0.8), mats["shell"], 0.12),
        box(f"{name}_stripe", (2.52, 0.3, 5.0), (0, 1.6, -0.8), mats["brand"], 0.03),
        box(f"{name}_reardoor", (2.3, 2.5, 0.06), (0, 2.45, -3.52), mats["panel"], 0.03),
        box(f"{name}_taill", (0.12, 0.3, 0.05), (-1.1, 1.3, -3.55), mats["red"], 0.02),
        box(f"{name}_tailr", (0.12, 0.3, 0.05), (1.1, 1.3, -3.55), mats["red"], 0.02),
    ]
    combine(f"{name}_body", parts, parent=group)
    truck_wheels(name, [(-1.05, 2.4), (1.05, 2.4), (-1.05, -2.2), (1.05, -2.2)], group)


def van_service(name, mats):
    group = root(name)
    body = material("van_white", "#f4f6f9", roughness=0.35)
    parts = [
        box(f"{name}_body", (2.0, 1.6, 5.0), (0, 1.35, 0), body, 0.25),
        box(f"{name}_hood", (1.9, 0.7, 0.9), (0, 0.95, 2.6), body, 0.2),
        box(f"{name}_windscreen", (1.8, 0.7, 0.06), (0, 1.75, 2.3), mats["glass"], 0.03),
        box(f"{name}_stripe", (2.02, 0.2, 4.6), (0, 1.2, 0), mats["brand"], 0.03),
        box(f"{name}_ladder", (0.5, 0.08, 3.4), (0.4, 2.2, -0.4), mats["steel"], 0.02),
        box(f"{name}_beacon", (0.6, 0.12, 0.2), (0, 2.21, 1.6), mats["amber"], 0.04),
        box(f"{name}_headl", (0.3, 0.12, 0.05), (-0.65, 1.05, 3.06), mats["lamp"], 0.02),
        box(f"{name}_headr", (0.3, 0.12, 0.05), (0.65, 1.05, 3.06), mats["lamp"], 0.02),
    ]
    combine(f"{name}_mesh", parts, parent=group)
    for index, (x, forward) in enumerate(((-0.9, 1.9), (0.9, 1.9), (-0.9, -1.6), (0.9, -1.6))):
        wheel(f"{name}_wheel{index}", 0.36, 0.25, (x, 0.36, forward), group)


def main():
    reset_scene()
    mats = palette()
    fab("bldg_fab_main", mats, ramp=False)
    fab("bldg_fab_ramp", mats, ramp=True)
    packaging("bldg_packaging", mats)
    upw_plant("bldg_upw", mats)
    gas_yard("gas_yard", mats)
    cooling_tower("cooling_tower", mats)
    substation("substation", mats)
    admin("bldg_admin", mats)
    tree("tree_a", round_crown=True)
    tree("tree_b", round_crown=False)
    lamp_post("lamp_post", mats)
    export("campus.glb")

    reset_scene()
    mats = palette()
    truck_tube("truck_tube", mats)
    truck_box("truck_box", mats)
    van_service("van_service", mats)
    export("trucks.glb")


main()
