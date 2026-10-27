"""Dimension blockouts drawn from the reference sheets in blender/refs (numbers marked 'verify' there).
Each entry: list of ("box", centre, size) or ("cyl", centre, radius, length, axis). Metres, asset local space,
bow toward -Y, same origin as the built asset. One blockout is the left/top half of a compare sheet."""

BLOCKOUTS = {
    "ship_cargo_a": [
        ("box", (0, 0, (9.2 - 12.0) / 2), (32.3, 294.1, 21.2)),                  # hull: L 294.1, B 32.3, depth 21.2, draft 12
        ("box", (0, 0.2 * 294.1 + 5, 9.2 + 12.0), (28.0, 17.0, 24.0)),           # accommodation block aft of midships
        ("box", (0, -20, 9.2 + 1.5 + 6 * 2.59 / 2), (28.0, 190.0, 6 * 2.59)),   # six tiers of containers
        ("cyl", (0, 0.2 * 294.1 + 14, 9.2 + 24 + 4), 3.5, 9.0, "Z"),             # funnel
    ],
    "ship_tanker_a": [
        ("box", (0, 0, (8.2 - 12.2) / 2), (32.2, 228.6, 20.4)),
        ("box", (0, 0.36 * 228.6, 8.2 + 11.0), (27.0, 20.0, 22.0)),
        ("box", (0, -12, 8.2 + 0.75), (1.5, 150.0, 1.5)),                       # deck pipeline
    ],
    "ship_bulk_a": [
        ("box", (0, 0, (5.3 - 14.0) / 2), (32.2, 225.0, 19.3)),
        ("box", (0, 0.34 * 225.0, 5.3 + 11.0), (27.0, 20.0, 22.0)),
        ("box", (0, -15, 5.3 + 1.0), (24.0, 130.0, 2.0)),                       # hatch covers
    ],
    "tug_a": [
        ("box", (0, 0, (2.2 - 4.8) / 2), (11.0, 32.0, 7.0)),
        ("box", (0, 2.0, 2.2 + 3.0), (7.0, 12.0, 6.0)),
    ],
    "mule_a": [
        ("box", (0, 0, 0.8 + 1.1), (3.2, 10.7, 2.2)),                           # body
        ("box", (0, 1.0, 0.8 + 2.2 + 0.9), (3.0, 4.0, 1.8)),                     # cab
    ],
    "gate_h23_L": [
        ("box", (19.2 / 2, 0, 23.0 / 2), (19.2, 3.0, 23.0)),
    ],
    "wall_side_a": [
        ("box", (7.5, 0, 11.0), (15.0, 30.5, 16.0)),                            # base steps merged to a block envelope
        ("box", (3.0, 0, 20.0), (6.0, 30.5, 10.0)),
    ],
    "chamber_floor_a": [
        ("box", (0, 0, -1.5), (33.5, 30.5, 3.0)),
    ],
    "valve_house_a": [
        ("box", (0, 0, 2.0), (3.4, 3.0, 4.0)),
    ],
}
