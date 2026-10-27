// The drawing context a machine's figure.mjs draws with: the Anatomy kit bound to one projection, plus
// the item list. One item is one thing in painter's order: its assembly (`piece`), a label, its markup
// and the world box it fills ([x0, x1, y0, y1, z0, z1]); `block` marks a thick solid that the explode
// audit tests for pass-through. Helpers adapted from the Edison figure.
import * as isoKit from "./vendor/iso-kit.mjs";
import * as lathe from "./vendor/lathe.mjs";

export function createDrawing(projection) {
  const camera = isoKit.cameraOf(projection);
  const azimuthAngle = ((projection.azimuth ?? 45) * Math.PI) / 180;
  const elevationAngle = Math.asin(camera.sinE);
  const items = [];

  const at = (x, y, z) => isoKit.iso([x, y, z], projection);
  const solid = (paths, style) => isoKit.solidSvg(paths, style);
  const line = (d, style) => isoKit.lineSvg(d, style);
  const dots = (points, style) => isoKit.dotsSvg(points, style);
  const trace = (points, closed = false) => isoKit.pathOf(points.map((point) => isoKit.iso(point, projection)), closed);

  function box(x0, x1, y0, y1, z0, z1, style = {}) {
    const corner = style.r ?? 0.6;
    const paths = isoKit.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: corner }, z0, z1 - z0, projection, 2, style.bevel ?? 0.4);
    return solid(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
  }

  function post(x, y, radius, z0, z1, style = {}) {
    const paths = isoKit.cylinder(x, y, radius, z0, z1 - z0, projection, style.steps ?? 28, style.bevel ?? 0);
    return solid(paths, { tone: style.tone ?? "mid", crease: style.crease, inner: style.inner });
  }

  // A turned part lying along a horizontal axis: `axis` is its direction, `start` where it begins.
  function lying(start, axis, length, radius, style = {}) {
    return solid(lathe.disc(0, length, radius, lathe.frameAlong(start, axis), projection), { tone: style.tone ?? "mid" });
  }

  // The half of a ring that faces the viewer, round an upright axis through (x, y).
  function frontArc(x, y, radius, z) {
    const points = [];
    for (let index = 0; index <= 20; index++) {
      const angle = azimuthAngle - Math.PI / 2 + (Math.PI * index) / 20;
      points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle), z]);
    }
    return trace(points);
  }

  function circleOnTop(x, y, radius, z) {
    return isoKit.planOutline({ x: x - radius, y: y - radius, w: radius * 2, d: radius * 2, r: radius }, z, projection, 6);
  }

  function put(piece, label, markup, bounds = null, block = false) {
    items.push({ piece, label, markup, bounds, block });
  }

  function also(markup) {
    items[items.length - 1].markup += markup;
  }

  function slab(piece, label, x0, x1, y0, y1, z0, z1, style) {
    put(piece, label, box(x0, x1, y0, y1, z0, z1, style), [x0, x1, y0, y1, z0, z1], true);
  }

  function upright(piece, label, x, y, radius, z0, z1, style) {
    put(piece, label, post(x, y, radius, z0, z1, style), [x - radius, x + radius, y - radius, y + radius, z0, z1], true);
  }

  function cornerScrews(x0, x1, y0, y1, z, inset) {
    const points = [];
    for (const x of [x0 + inset, x1 - inset]) {
      for (const y of [y0 + inset, y1 - inset]) points.push(at(x, y, z));
    }
    return dots(points, { size: 0.5 });
  }

  return { kit: isoKit, lathe, projection, camera, azimuthAngle, elevationAngle, items, at, solid, line, dots, trace, box, post, lying, frontArc, circleOnTop, put, also, slab, upright, cornerScrews };
}

// Screen directions of world x, y and z, which the painter's order and the audit work in.
export function screenAxes(projection) {
  const origin = isoKit.iso([0, 0, 0], projection);
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
    const tip = isoKit.iso(axis, projection);
    return [tip[0] - origin[0], tip[1] - origin[1]];
  });
}
