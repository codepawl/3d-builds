"""Shared layout numbers and height functions for the onsen site (Blender coordinates, Z up)."""
import math

from lib_mesh import fractal_noise, smoothstep

WATER_LEVEL = -0.16
POOL_FLOOR = -0.95
POOL_SEMI_AXIS_X = 4.3
POOL_SEMI_AXIS_Y = 3.0

DECK_MIN_X = -5.0
DECK_MAX_X = 8.4
DECK_MIN_Y = 3.9
DECK_MAX_Y = 9.0
DECK_TOP = 0.38

RYOKAN_LEFT_X = -6.5
RYOKAN_RIGHT_X = 5.5
RYOKAN_FRONT_Y = 10.2
RYOKAN_BACK_Y = 15.8
RYOKAN_FLOOR = 0.55
RYOKAN_GROUND_WALL_TOP = 3.1

LANTERN_POSITION = (-5.25, -1.35)
SPOUT_START = (-3.75, 4.05, 1.08)
SPOUT_END = (-2.25, 2.3, 0.84)
FENCE_X = -7.4
FENCE_MIN_Y = -7.5
FENCE_MAX_Y = 8.6

INNER_TERRAIN_HALF_SIZE = 16.0


def pool_radius_at(angle):
    cosine = math.cos(angle)
    sine = math.sin(angle)
    ellipse = POOL_SEMI_AXIS_X * POOL_SEMI_AXIS_Y / math.sqrt(
        (POOL_SEMI_AXIS_Y * cosine) ** 2 + (POOL_SEMI_AXIS_X * sine) ** 2
    )
    wobble = 1.0 + 0.06 * math.sin(3 * angle + 0.6) + 0.045 * math.sin(5 * angle + 2.1) + 0.025 * math.sin(7 * angle + 1.0)
    return ellipse * wobble


def pool_ratio(x_value, y_value):
    """Distance from the pool centre divided by the outline radius: below 1 is inside the pool."""
    distance = math.hypot(x_value, y_value)
    angle = math.atan2(y_value, x_value)
    return distance / pool_radius_at(angle)


def pool_outline_points(count=96):
    points = []
    for index in range(count):
        angle = 2.0 * math.pi * index / count
        radius = pool_radius_at(angle)
        points.append((radius * math.cos(angle), radius * math.sin(angle)))
    return points


def site_undulation(x_value, y_value):
    fade = 1.0 - smoothstep(12.0, 15.0, max(abs(x_value), abs(y_value)))
    return 0.07 * fractal_noise(x_value, y_value, 3.1, octaves=3, base_scale=3.0) * fade


def hill_height(x_value, y_value):
    square_distance = max(abs(x_value), abs(y_value))
    rise = smoothstep(16.0, 70.0, square_distance)
    behind_weight = 0.55 + 0.45 * smoothstep(-40.0, 60.0, y_value)
    shape = 0.5 + 0.5 * fractal_noise(x_value, y_value, 9.7, octaves=4, base_scale=38.0)
    return rise * rise * behind_weight * (4.0 + 16.0 * shape) + rise * 1.5 * fractal_noise(x_value, y_value, 2.0, octaves=3, base_scale=9.0)


def ground_height(x_value, y_value):
    ratio = pool_ratio(x_value, y_value)
    outside_height = site_undulation(x_value, y_value) + hill_height(x_value, y_value)
    if ratio >= 1.12:
        return outside_height
    bowl_height = POOL_FLOOR + 0.28 * ratio * ratio + 0.05 * fractal_noise(x_value, y_value, 5.0, octaves=2, base_scale=0.8)
    if ratio <= 0.96:
        return bowl_height
    blend = smoothstep(0.96, 1.12, ratio)
    return bowl_height * (1.0 - blend) + outside_height * blend
