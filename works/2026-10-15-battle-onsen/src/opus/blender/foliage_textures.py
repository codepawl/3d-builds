"""Fir frond atlas: a flat spray of needled branchlets with an alpha mask, plain on the left half and snow-laden
on the right half. Drawn at twice the final size and averaged down so needle edges stay smooth."""
import numpy as np

from lib_materials import value_noise_2d

FROND_LENGTH_PIXELS = 512
FROND_WIDTH_PIXELS = 256
SUPERSAMPLE = 2
# Texture space: X runs 0..2 along the frond (base to tip), Y runs -1..1 across it.
FROND_ASPECT = 2.0
BRANCHLET_SPACING = 0.085
BRANCHLET_FORWARD_SLOPE = 0.85


def smoothstep(edge_low, edge_high, value):
    amount = np.clip((value - edge_low) / (edge_high - edge_low), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def frond_half_width(along):
    """Outline of the spray: narrow at the stem base, widest a third of the way out, a point at the tip."""
    return 0.97 * smoothstep(0.0, 0.3, along) * np.power(np.clip(1.0 - along, 0.0, 1.0), 0.55)


def resample_noise(noise, height, width):
    rows = (np.arange(height) * noise.shape[0] // height) % noise.shape[0]
    columns = (np.arange(width) * noise.shape[1] // width) % noise.shape[1]
    return noise[rows][:, columns]


def frond_coverage(height, width, seed):
    """Needle coverage, distance to the nearest branchlet axis and the across-frond fraction."""
    along = (np.arange(width, dtype=np.float32) + 0.5) / width
    across = (np.arange(height, dtype=np.float32) + 0.5) / height * 2.0 - 1.0
    along_grid, across_grid = np.meshgrid(along, across)
    position_x = along_grid * FROND_ASPECT
    absolute_across = np.abs(across_grid)
    edge_jitter = resample_noise(value_noise_2d(256, 24, seed, octaves=2), height, width)
    half_width = frond_half_width(along_grid) * (0.9 + 0.2 * edge_jitter)
    inside = absolute_across < half_width

    branchlet_origin = position_x - BRANCHLET_FORWARD_SLOPE * absolute_across
    cell_position = branchlet_origin / BRANCHLET_SPACING
    cell_index = np.round(cell_position)
    signed_offset = (cell_position - cell_index) * BRANCHLET_SPACING
    perpendicular = np.abs(signed_offset) / np.sqrt(1.0 + BRANCHLET_FORWARD_SLOPE ** 2)

    across_fraction = np.clip(absolute_across / np.maximum(half_width, 1e-3), 0.0, 1.0)
    needle_length = BRANCHLET_SPACING * 0.5 * (1.05 - 0.35 * across_fraction)
    needle_phase = absolute_across * 70.0 + perpendicular * 60.0 + np.sin(cell_index * 12.9898) * 43.0
    needle_stripe = (np.mod(needle_phase, 1.0) < 0.55).astype(np.float32)
    needle_reach = needle_length * (0.72 + 0.4 * needle_stripe)
    needles = (perpendicular < needle_reach) & inside
    stem = (absolute_across < 0.03) & (along_grid < 0.97)
    coverage = (needles | stem).astype(np.float32)
    return coverage, perpendicular / np.maximum(needle_length, 1e-3), across_fraction, along_grid, stem


def needle_colors(perpendicular_fraction, across_fraction, along_grid, stem, seed):
    height, width = along_grid.shape
    variation = resample_noise(value_noise_2d(256, 12, seed + 1, octaves=3), height, width)
    dark = np.array([0.07, 0.12, 0.075])
    light = np.array([0.17, 0.25, 0.13])
    tip_amount = np.clip(0.55 * perpendicular_fraction + 0.45 * across_fraction, 0.0, 1.0) ** 1.5
    amount = np.clip(0.75 * tip_amount + 0.5 * (variation - 0.5), 0.0, 1.0)
    color = dark[None, None, :] * (1.0 - amount[..., None]) + light[None, None, :] * amount[..., None]
    base_shade = 0.7 + 0.3 * smoothstep(0.0, 0.35, along_grid)
    color = color * base_shade[..., None]
    stem_color = np.array([0.2, 0.15, 0.1])
    color[stem] = stem_color
    return color


def snow_layer(along_grid, across_fraction, seed):
    height, width = along_grid.shape
    lumps = resample_noise(value_noise_2d(512, 10, seed + 2, octaves=4), height, width)
    envelope = smoothstep(0.03, 0.14, along_grid) * (1.0 - smoothstep(0.7, 0.93, along_grid))
    ridge = 1.0 - smoothstep(0.35, 0.85, across_fraction)
    snow_amount = smoothstep(0.42, 0.52, lumps * 0.75 + 0.45 * ridge * envelope)
    snow_amount *= (across_fraction < 0.92)
    shade = 0.8 + 0.2 * smoothstep(0.3, 0.8, lumps)
    edge_shade = 1.0 - 0.18 * smoothstep(0.5, 0.9, across_fraction)
    snow_color = np.array([0.93, 0.95, 0.99])[None, None, :] * (shade * edge_shade)[..., None]
    return snow_amount, snow_color


def downsample(array):
    height = array.shape[0] // SUPERSAMPLE
    width = array.shape[1] // SUPERSAMPLE
    reshaped = array.reshape(height, SUPERSAMPLE, width, SUPERSAMPLE, *array.shape[2:])
    return reshaped.mean(axis=(1, 3))


def frond_atlas(seed=4242):
    """Returns (rgb, alpha): width 2 * FROND_LENGTH_PIXELS, height FROND_WIDTH_PIXELS."""
    height = FROND_WIDTH_PIXELS * SUPERSAMPLE
    width = FROND_LENGTH_PIXELS * SUPERSAMPLE
    coverage, perpendicular_fraction, across_fraction, along_grid, stem = frond_coverage(height, width, seed)
    plain_color = needle_colors(perpendicular_fraction, across_fraction, along_grid, stem, seed)
    snow_amount, snow_color = snow_layer(along_grid, across_fraction, seed)
    inside_snow = snow_amount * (frond_half_width(along_grid) > 0.05)
    snowy_color = plain_color * (1.0 - inside_snow[..., None]) + snow_color * inside_snow[..., None]
    snowy_coverage = np.maximum(coverage, inside_snow)
    rgb = np.concatenate([downsample(plain_color), downsample(snowy_color)], axis=1)
    alpha = np.concatenate([downsample(coverage), downsample(snowy_coverage)], axis=1)
    return rgb.astype(np.float32), alpha.astype(np.float32)


def core_texture():
    """Opaque dense needle texture for the dark inner core that fills the gaps between fronds."""
    streaks = value_noise_2d(256, 48, 911, octaves=3)
    value = 0.75 + 0.25 * streaks
    return np.stack([value, value, value], axis=-1)
