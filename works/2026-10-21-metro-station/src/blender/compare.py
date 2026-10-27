"""Reference-versus-render compare sheets.
Left: the reference blockout drawn from the dimensions in refs/<asset>.md (no photos were allowed this run).
Right: the orthographic render of the model with the same blockout outlined in red.
Run: uv run --no-project --with pillow python compare.py"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

PREVIEWS = Path(__file__).parent / "previews"
IMAGE_WIDTH, IMAGE_HEIGHT = 800, 500

# shape: ("rect", a0, b0, a1, b1, label) | ("circle", centre_a, centre_b, radius, label) | ("line", [(a, b), ...], label)
# a = X for side views, Y for front views; b = Z. Values are metres relative to the asset origin.
SPECS = {
    "car_cab": ("Car_Cab", "side", [
        ("rect", -10.2, 0.95, 10.2, 3.8, "body 20.4 long, floor 1.10, roof 3.80"),
        ("rect", -7.8 - 0.7, 1.1, -7.8 + 0.7, 3.05, "door 1.4 x 1.95"),
        ("rect", -2.9 - 0.7, 1.1, -2.9 + 0.7, 3.05, ""),
        ("rect", 2.0 - 0.7, 1.1, 2.0 + 0.7, 3.05, ""),
        ("rect", 6.9 - 0.7, 1.1, 6.9 + 0.7, 3.05, ""),
        ("circle", -7.65, 0.42, 0.42, "wheel 0.84"), ("circle", -5.35, 0.42, 0.42, ""),
        ("circle", 5.35, 0.42, 0.42, ""), ("circle", 7.65, 0.42, 0.42, ""),
    ]),
    "tunnel_cut": ("Tunnel_Cut", "front", [
        ("circle", 0, 1.7, 3.15, "outer 6.3"), ("circle", 0, 1.7, 2.85, "inner 5.7"),
        ("rect", -1.5, 0.95, 1.5, 3.8, "car 3.0 x 3.8"), ("rect", -0.8, -0.17, 0.8, 0, "rails 1.435"),
    ]),
    "station_module": ("Station_Module", "front", [
        ("rect", -5.4, -0.3, 5.4, 1.1, "island 10.8, edge +1.10"),
        ("rect", -5.35, 1.1, -5.25, 3.2, "PSD 2.1"), ("rect", 5.25, 1.1, 5.35, 3.2, ""),
        ("rect", -8.5, 0.95, -5.5, 3.8, "car 3.0 x 3.8"), ("rect", 5.5, 0.95, 8.5, 3.8, ""),
        ("rect", -0.45, 1.1, 0.45, 6.6, "column to mezzanine 6.6"),
    ]),
    "escalator": ("Escalator", "side", [
        ("line", [(0, 0), (1.6, 0), (11.126, 5.5), (12.726, 5.5)], "30 deg, rise 5.5, landings 1.6"),
    ]),
    "viaduct_span": ("Viaduct_Span", "front", [
        ("rect", -4.8, -2.0, 4.8, 0.0, "deck 9.6 wide, girder 2.0 deep"), ("rect", -4.8, 0.0, 4.8, 1.7, "parapet to 1.7"),
        ("rect", -2.1 - 1.5, 0.45, -2.1 + 1.5, 4.25, "train 3.0 x 3.8 (track +0.45)"),
    ]),
    "wash_plant": ("Wash_Plant", "side", [("rect", -20, 0, 20, 6.1, "40 long x 6 high")]),
}


def to_pixels(point, sidecar, view, scale_pixels_per_metre):
    a, b = point
    origin = sidecar["root_location"]
    center = sidecar["center"]
    world_a = origin[0] + a if view == "side" else origin[1] + a
    center_a = center[0] if view == "side" else center[1]
    return (IMAGE_WIDTH / 2 + (world_a - center_a) * scale_pixels_per_metre,
            IMAGE_HEIGHT / 2 - (origin[2] + b - center[2]) * scale_pixels_per_metre)


def draw_shapes(draw, shapes, sidecar, view, colour):
    scale = IMAGE_WIDTH / (sidecar["radius"] * 2.1)
    for shape in shapes:
        kind = shape[0]
        if kind == "rect":
            left_top = to_pixels((shape[1], shape[4]), sidecar, view, scale)
            right_bottom = to_pixels((shape[3], shape[2]), sidecar, view, scale)
            draw.rectangle([left_top, right_bottom], outline=colour, width=2)
            label = shape[5]
            anchor = left_top
        elif kind == "circle":
            centre = to_pixels((shape[1], shape[2]), sidecar, view, scale)
            radius_pixels = shape[3] * scale
            draw.ellipse([centre[0] - radius_pixels, centre[1] - radius_pixels, centre[0] + radius_pixels, centre[1] + radius_pixels],
                         outline=colour, width=2)
            label = shape[4]
            anchor = (centre[0] - radius_pixels, centre[1])
        else:
            points = [to_pixels(point, sidecar, view, scale) for point in shape[1]]
            draw.line(points, fill=colour, width=3)
            label = shape[2]
            anchor = points[0]
        if label:
            draw.text((anchor[0] + 4, anchor[1] - 14), label, fill=colour)


def main():
    for asset_key, (root_name, view, shapes) in SPECS.items():
        render_path = PREVIEWS / f"{asset_key}-{view}.png"
        sidecar = json.loads((PREVIEWS / f"{asset_key}-{view}.json").read_text())
        reference = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), "white")
        draw_shapes(ImageDraw.Draw(reference), shapes, sidecar, view, "black")
        rendered = Image.open(render_path).convert("RGB")
        draw_shapes(ImageDraw.Draw(rendered), shapes, sidecar, view, "red")
        sheet = Image.new("RGB", (IMAGE_WIDTH * 2, IMAGE_HEIGHT), "white")
        sheet.paste(reference, (0, 0))
        sheet.paste(rendered, (IMAGE_WIDTH, 0))
        output_path = PREVIEWS / f"{asset_key}-compare.png"
        sheet.save(output_path)
        print("COMPARE", output_path)


main()
