"""Georeference USGS GeoPDF quads: PDF page -> polyconic (NAD27) metres -> lon/lat.

The LGIDict CTM maps PDF user space to projected metres. We forward-project a lon/lat
grid with the polyconic (Clarke 1866) and fit a cubic polynomial from rendered pixel to
lon/lat. NAD27 -> WGS84 shift in central Wisconsin is a few metres and is measured as
residual against OSM points rather than modelled.
"""
import math
import re
import numpy as np
import pymupdf

CLARKE_A = 6378206.4
CLARKE_E2 = 0.00676866


def meridian_distance(latitude_radians):
    e2 = CLARKE_E2
    e4 = e2 * e2
    e6 = e4 * e2
    return CLARKE_A * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latitude_radians
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * latitude_radians)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * latitude_radians)
        - (35 * e6 / 3072) * math.sin(6 * latitude_radians)
    )


def polyconic_forward(longitude, latitude, central_meridian, origin_latitude):
    latitude_radians = math.radians(latitude)
    delta_longitude = math.radians(longitude - central_meridian)
    origin_distance = meridian_distance(math.radians(origin_latitude))
    sine = math.sin(latitude_radians)
    normal_radius = CLARKE_A / math.sqrt(1 - CLARKE_E2 * sine * sine)
    angle = delta_longitude * sine
    cotangent = math.cos(latitude_radians) / sine
    x = normal_radius * cotangent * math.sin(angle)
    y = meridian_distance(latitude_radians) - origin_distance + normal_radius * cotangent * (1 - math.cos(angle))
    return x, y


def read_lgi(document):
    for xref in range(1, document.xref_length()):
        try:
            text = document.xref_object(xref)
        except Exception:
            continue
        if "/LGIDict" in text and "/CTM" in text:
            ctm = [float(value) for value in re.findall(r"\(([-\d.e+]+)\)", text.split("/CTM", 1)[1])[:6]]
            central_meridian = float(re.search(r"/CentralMeridian \(([-\d.]+)\)", text).group(1))
            origin_latitude = float(re.search(r"/OriginLatitude \(([-\d.]+)\)", text).group(1))
            return ctm, central_meridian, origin_latitude
    raise ValueError("no LGIDict")


def poly_terms(u, v):
    return np.stack([np.ones_like(u), u, v, u * u, u * v, v * v, u ** 3, u * u * v, u * v * v, v ** 3], axis=-1)


class QuadGeo:
    """Maps rendered-pixel coordinates (at a given zoom) to lon/lat and back."""

    def __init__(self, pdf_path, zoom, south, west, north, east):
        document = pymupdf.open(pdf_path)
        self.page = document[0]
        self.document = document
        self.zoom = zoom
        ctm, central_meridian, origin_latitude = read_lgi(document)
        a, b, c, d, e, f = ctm
        inverse = np.linalg.inv(np.array([[a, c, e], [b, d, f], [0, 0, 1]]))
        page_height = self.page.rect.height
        longitudes, latitudes, pixel_x, pixel_y = [], [], [], []
        for latitude in np.linspace(south - 0.01, north + 0.01, 13):
            for longitude in np.linspace(west - 0.01, east + 0.01, 13):
                x, y = polyconic_forward(longitude, latitude, central_meridian, origin_latitude)
                pdf_x, pdf_y, _ = inverse @ np.array([x, y, 1.0])
                # PDF user space has origin bottom-left; rendered pixels top-left.
                longitudes.append(longitude)
                latitudes.append(latitude)
                pixel_x.append(pdf_x * zoom)
                pixel_y.append((page_height - pdf_y) * zoom)
        self.pixel_scale = 1000.0
        u = np.array(pixel_x) / self.pixel_scale
        v = np.array(pixel_y) / self.pixel_scale
        terms = poly_terms(u, v)
        self.to_lon = np.linalg.lstsq(terms, np.array(longitudes), rcond=None)[0]
        self.to_lat = np.linalg.lstsq(terms, np.array(latitudes), rcond=None)[0]
        lon_array = np.array(longitudes)
        lat_array = np.array(latitudes)
        geo_terms = poly_terms((lon_array - west) * 10, (lat_array - south) * 10)
        self.west, self.south = west, south
        self.to_px = np.linalg.lstsq(geo_terms, np.array(pixel_x), rcond=None)[0]
        self.to_py = np.linalg.lstsq(geo_terms, np.array(pixel_y), rcond=None)[0]
        self.fit_error_degrees = float(np.abs(terms @ self.to_lon - lon_array).max())

    def render(self):
        pixmap = self.page.get_pixmap(matrix=pymupdf.Matrix(self.zoom, self.zoom), alpha=False)
        return np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, 3)

    def pixel_to_lonlat(self, pixel_x, pixel_y):
        terms = poly_terms(np.asarray(pixel_x, float) / self.pixel_scale, np.asarray(pixel_y, float) / self.pixel_scale)
        return terms @ self.to_lon, terms @ self.to_lat

    def lonlat_to_pixel(self, longitude, latitude):
        terms = poly_terms((np.asarray(longitude, float) - self.west) * 10, (np.asarray(latitude, float) - self.south) * 10)
        return terms @ self.to_px, terms @ self.to_py


QUADS = {
    "coloma": ("WI_Coloma_800330_1958.pdf", 44.00, -89.75, 44.25, -89.50),
    "whiting": ("WI_Whiting_503627_1957.pdf", 44.25, -89.75, 44.50, -89.50),
    "amherst": ("WI_Amherst_502228_1957.pdf", 44.25, -89.50, 44.50, -89.25),
    "wautoma": ("WI_Wautoma_503608_1959.pdf", 44.00, -89.50, 44.25, -89.25),
}
