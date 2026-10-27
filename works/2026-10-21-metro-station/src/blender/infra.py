"""Track, tunnel and signalling -> track.glb, tunnel.glb. Pieces run along +X; segment length 9.8 m."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lib
from lib import Mesh, empty, material, pal

SEGMENT_LENGTH = 9.8
RAIL_CENTRE_Y = 0.7535
BORE_CENTRE_Z = 1.7
INNER_RADIUS = 2.85
OUTER_RADIUS = 3.15


def rail(mesh, y, mat):
    mesh.box((SEGMENT_LENGTH, 0.15, 0.03), (0, y, -0.155), mat, bevel=0.005)
    mesh.box((SEGMENT_LENGTH, 0.03, 0.12), (0, y, -0.09), mat, bevel=0.005)
    mesh.box((SEGMENT_LENGTH, 0.072, 0.045), (0, y, -0.0225), mat, bevel=0.008)


def third_rail(mesh, side):
    y = side * 1.42
    steel = pal("steel")
    cover = material("ThirdRailCover", "#E9B422", 0.6)
    mesh.box((SEGMENT_LENGTH, 0.1, 0.1), (0, y, 0.02), steel, bevel=0.01)
    mesh.box((SEGMENT_LENGTH, 0.2, 0.03), (0, y, 0.1), cover, bevel=0.008)
    for index in range(4):
        x = -SEGMENT_LENGTH / 2 + 0.8 + index * 2.7
        mesh.box((0.12, 0.12, 0.2), (x, y, -0.1), pal("rubber"), bevel=0.02)


def build_track(name, ballast):
    track = Mesh(name)
    concrete = pal("concrete")
    steel = pal("steel")
    pad = pal("rubber")
    for side in (-1, 1):
        rail(track, side * RAIL_CENTRE_Y, steel)
    third_rail(track, 1)
    sleeper_count = int(SEGMENT_LENGTH / 0.6)
    for index in range(sleeper_count):
        x = -SEGMENT_LENGTH / 2 + 0.3 + index * 0.6
        if ballast:
            track.box((0.26, 2.6, 0.2), (x, 0, -0.27), concrete, bevel=0.02)
        for side in (-1, 1):
            track.box((0.16, 0.2, 0.025), (x, side * RAIL_CENTRE_Y, -0.172), pad, bevel=0.004)
    if ballast:
        stone = material("Ballast", "#8E8A84", 0.95)
        track.box((SEGMENT_LENGTH, 3.0, 0.3), (0, 0, -0.45), stone, bevel=0.06)
        for side in (-1, 1):
            track.box((SEGMENT_LENGTH, 0.9, 0.3), (0, side * 1.7, -0.5), stone, bevel=0.1, rotation=(side * 0.55, 0, 0))
    else:
        track.box((SEGMENT_LENGTH, 3.0, 0.2), (0, 0, -0.27), concrete, bevel=0.03)
        track.box((SEGMENT_LENGTH, 2.4, 0.04), (0, 0, -0.15), pal("concrete_dark"), bevel=0.005)
    return track


def build_signal_mast():
    mast = Mesh("Signal_Mast")
    dark = pal("dark_metal")
    mast.cylinder(0.07, 4.0, (0, 0, 2.0), dark, segments=12)
    mast.cylinder(0.14, 0.15, (0, 0, 0.08), dark, segments=12)
    mast.box((0.4, 0.4, 1.15), (0.1, 0, 3.5), pal("rubber"), bevel=0.04)
    mast.box((0.1, 0.45, 1.25), (0.28, 0, 3.5), dark, bevel=0.02)
    for index, (name, color) in enumerate((("SignalRed", "#FF2B2B"), ("SignalYellow", "#FFC21A"), ("SignalGreen", "#27D17F"))):
        lens = material(name, color, 0.3, 0, color, 3.0)
        mast.cylinder(0.14, 0.04, (0.31, 0, 3.8 - index * 0.35), lens, axis="X", segments=20)
        mast.box((0.14, 0.34, 0.04), (0.35, 0, 3.97 - index * 0.35), dark, bevel=0.005)
    mast.box((0.05, 0.4, 0.2), (0.24, 0, 2.7), pal("body_white"), bevel=0.008)
    return mast


def build_access_point():
    point = Mesh("Cbtc_AccessPoint")
    dark = pal("dark_metal")
    point.box((0.08, 0.08, 0.7), (0, 0, 0.35), dark, bevel=0.01)
    point.box((0.4, 0.25, 0.5), (0.15, 0, 0.75), pal("body_white"), bevel=0.03)
    point.cylinder(0.03, 0.25, (0.15, 0, 1.12), pal("steel"), segments=8)
    point.box((0.02, 0.15, 0.08), (0.36, 0, 0.8), material("ApLight", "#12A59A", 0.3, 0, "#12A59A", 3.0), bevel=0.003)
    return point


def build_buffer_stop():
    stop = Mesh("Buffer_Stop")
    red = material("BufferRed", "#D9473A", 0.5)
    dark = pal("dark_metal")
    for side in (-1, 1):
        stop.box((0.25, 0.25, 1.1), (0, side * 0.8, 0.55), dark, bevel=0.03)
        stop.cylinder(0.1, 0.9, (0.45, side * 0.8, 0.9), pal("steel"), axis="X", segments=16)
        stop.cylinder(0.2, 0.08, (0.92, side * 0.8, 0.9), red, axis="X", segments=16)
    stop.box((0.25, 2.2, 0.35), (0, 0, 1.0), red, bevel=0.04)
    stop.box((1.6, 0.3, 0.2), (0.4, 0, 0.1), pal("concrete_dark"), bevel=0.03)
    return stop


def tunnel_segment(name, cut):
    tunnel = Mesh(name)
    concrete = pal("concrete")
    light = material("TunnelLight", "#FFF4D6", 0.3, 0, "#FFF1C8", 3.0)
    ring_width = 1.4
    for ring in range(7):
        x0 = -SEGMENT_LENGTH / 2 + ring * ring_width
        for segment in range(8):
            middle_angle = segment * 45 + 22.5
            if cut and 90 < middle_angle < 180:
                continue
            radial_offset = 0.012 if (ring + segment) % 2 else 0.0
            tunnel.arc_shell(INNER_RADIUS, OUTER_RADIUS + radial_offset, x0, x0 + ring_width - 0.01,
                             segment * 45, segment * 45 + 45, (0, BORE_CENTRE_Z), concrete, steps=5)
    tunnel.box((SEGMENT_LENGTH, 2.3, 0.9), (0, 0, -0.65), pal("concrete_dark"), bevel=0.02)
    tunnel.box((SEGMENT_LENGTH, 0.8, 0.1), (0, -2.15, 0.9), pal("steel"), bevel=0.01)
    for post in range(5):
        tunnel.box((0.1, 0.1, 0.9), (-SEGMENT_LENGTH / 2 + 0.6 + post * 2.15, -2.35, 0.45), pal("dark_metal"), bevel=0.01)
    for angle in (50, 130):
        radius = INNER_RADIUS - 0.08
        tunnel.box((SEGMENT_LENGTH - 0.4, 0.08, 0.05),
                   (0, radius * math.cos(math.radians(angle)), BORE_CENTRE_Z + radius * math.sin(math.radians(angle))), light, bevel=0.005)
    tunnel.box((SEGMENT_LENGTH, 0.1, 0.35), (0, 2.55, 2.55), pal("dark_metal"), bevel=0.01, rotation=(math.radians(-20), 0, 0))
    return tunnel


def main():
    lib.reset_scene()
    roots = []
    for index, (name, mesh_builder) in enumerate([
        ("Track_Slab", lambda: build_track("Track_Slab", False)),
        ("Track_Ballast", lambda: build_track("Track_Ballast", True)),
        ("Signal_Mast", build_signal_mast),
        ("Cbtc_AccessPoint", build_access_point),
        ("Buffer_Stop", build_buffer_stop),
    ]):
        roots.append(mesh_builder().build())
        roots[-1].location = (0, index * 6.0, 0)
    lib.export_glb("track.glb", roots)

    lib.reset_scene()
    roots = [tunnel_segment("Tunnel_Full", False).build(), tunnel_segment("Tunnel_Cut", True).build()]
    roots[1].location = (0, 8.0, 0)
    lib.export_glb("tunnel.glb", roots)


main()
