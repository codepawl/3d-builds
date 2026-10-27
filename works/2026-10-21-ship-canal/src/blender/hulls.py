"""Lofted ship hull shared by the ship and tug scripts."""
import math


def smooth(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


class Hull:
    def __init__(self, spec):
        self.spec = spec

    def half_width(self, s):
        spec = self.spec
        half = spec["B"] / 2
        entrance, run = spec["entrance"], spec["run"]
        if s < entrance:
            u = (entrance - s) / entrance
            factor = math.sqrt(max(0.0, 1 - u ** spec["bow_power"]))
        elif s > run:
            u = (s - run) / (1 - run)
            factor = 1 - spec["stern_taper"] * u ** 2
        else:
            factor = 1.0
        return max(0.08, half * factor)

    def keel_z(self, s):
        spec = self.spec
        draft = spec["T"]
        bow_lift = (draft - spec["stem_depth"]) * (1 - smooth(0.0, 0.10, s)) ** 2
        stern_lift = (spec["stern_keel_z"] + draft) * smooth(spec["stern_lift_start"], 1.0, s)
        return -draft + bow_lift + stern_lift

    def deck_z(self, s):
        spec = self.spec
        return spec["free"] + spec["bow_sheer"] * (max(0.0, (0.2 - s) / 0.2)) ** 1.5

    def y_of(self, s):
        return -self.spec["L"] / 2 + s * self.spec["L"]

    def build(self, part, mats):
        spec = self.spec
        builder = part.mesh_builder
        count = 56
        stations = [0.5 - 0.5 * math.cos(math.pi * k / (count - 1)) for k in range(count)]
        rings = []
        for s in stations:
            w = self.half_width(s)
            z_deck = self.deck_z(s)
            w_deck = w * (1 + spec["flare"] * max(0.0, (0.4 - s) / 0.4) ** 1.5)
            z_keel = self.keel_z(s)
            radius = min(spec["bilge"], 0.85 * w, max(0.25, -z_keel - 0.25))
            half_points = [(w_deck, z_deck), (w + (w_deck - w) * 1.3 / z_deck, 1.3), (w, 0.0)]
            for angle in (0, -30, -60, -90):
                a = math.radians(angle)
                half_points.append((w - radius + radius * math.cos(a), z_keel + radius + radius * math.sin(a)))
            y = self.y_of(s)
            rake = spec.get("rake", 0.0) * max(0.0, (0.12 - s) / 0.12)
            def lean(z):
                return -rake * max(0.0, z) / z_deck       # stem leans forward above the waterline
            starboard = [builder.verts.new((x, y + lean(z), z)) for x, z in half_points]
            port = [builder.verts.new((-x, y + lean(z), z)) for x, z in reversed(half_points)]
            rings.append(starboard + port)
        segment_material = [mats["topside"], mats["boot"], mats["bottom"], mats["bottom"], mats["bottom"],
                            mats["bottom"]]
        segment_material = segment_material + [mats["bottom"]] + list(reversed(segment_material))
        for i in range(count - 1):
            for j in range(13):
                face = builder.faces.new([rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]])
                face.material_index = part.slot(segment_material[j])
            deck = builder.faces.new([rings[i][0], rings[i + 1][0], rings[i + 1][13], rings[i][13]])
            deck.material_index = part.slot(mats["deck"])
        for ring in (rings[0], rings[-1]):
            cap = builder.faces.new(ring)
            cap.material_index = part.slot(mats["topside"])
