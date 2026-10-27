// Effects: fire, exhaust, steam, smoke and glow as pure shape generators. No DOM: a machine maps the
// returned local shapes onto its drawing (live.js), so the page, the film and the tests get the same
// shapes, and the film's flicker is the same on every recording (noise is a function of time and seed).
//
// Local coordinates: `along` runs from the source (a nozzle exit, a spout) outward, `across` sideways.
// Effects are light and gas, so the kit never patterns them: draw them with the effect classes in
// page.css (`ma-fx-*`), which every render style leaves unpatterned and every theme leaves in its colour.
//
// Realism parameters for a rocket plume (references/motion.md, "Effects"):
//   throttle 0..1   longer and brighter at throttle-up, shorter at throttle-down
//   thin     0..1   0 at sea level, 1 in vacuum: the plume widens and turns translucent as the air thins,
//                   and the shock diamonds of a low-altitude plume fade out
//   ground          distance to a surface the flame hits (a pad, a deck): the flame is cut there and
//                   splashes sideways
//   time, seed      deterministic flicker

const TAU = Math.PI * 2;

function fraction(value) {
  return value - Math.floor(value);
}

// Smooth deterministic noise in about -1..1: a few sines with phases taken from the seed.
export function noise(time, seed = 1, rate = 1) {
  const phase = (index) => fraction(Math.sin((seed + 1) * 12.9898 * (index + 1)) * 43758.5453) * TAU;
  return (Math.sin(time * 7.3 * rate + phase(0)) * 0.5 + Math.sin(time * 13.1 * rate + phase(1)) * 0.3 + Math.sin(time * 29.7 * rate + phase(2)) * 0.2);
}

function clampShare(value) {
  return Math.min(1, Math.max(0, value));
}

// One side of a flame outline: `widthAt(share)` for shares 0..1 of its length.
function outline(length, widthAt, samples = 9) {
  const right = [];
  const left = [];
  for (let index = 0; index <= samples; index++) {
    const share = index / samples;
    const width = widthAt(share);
    right.push([width, share * length]);
    left.push([-width, share * length]);
  }
  return right.concat(left.reverse());
}

// A rocket engine plume. Returns local polygons: a wide soft halo round it (depth), the warm body, the narrow
// near-white core at the exit, the shock diamonds (each with its opacity), a splash where it meets the
// ground, and the opacities to draw them with.
export function plume({ throttle = 1, thin = 0, exitRadius = 0.5, length = 14, spread = 2.4, ground = Infinity, time = 0, seed = 1, diamonds = 5 } = {}) {
  const power = clampShare(throttle);
  const air = clampShare(thin);
  const flicker = 1 + 0.07 * noise(time, seed, 1.4);
  const fullLength = length * (0.35 + 0.65 * power) * (1 + 1.4 * air) * flicker;
  const drawnLength = Math.max(0.3, Math.min(fullLength, ground));
  const tail = exitRadius + (spread - exitRadius) * (0.6 + 1.6 * air);
  const bodyWidth = (share) => {
    const swell = exitRadius + (tail - exitRadius) * Math.sqrt(share);
    const wobble = 1 + 0.06 * noise(time + share * 3, seed + 7, 2);
    const taper = share > 0.8 ? 1 - (share - 0.8) * 3.2 * (drawnLength < fullLength ? 0 : 1) : 1;
    return swell * wobble * Math.max(0.25, taper);
  };
  const haloWidth = (share) => bodyWidth(share) * (1.45 + 0.25 * share);
  const coreLength = Math.min(drawnLength, fullLength * (0.42 - 0.18 * air));
  const coreWidth = (share) => exitRadius * (0.62 - 0.5 * share);
  const diamondShapes = [];
  const shown = (1 - clampShare(air / 0.3)) * clampShare((power - 0.2) / 0.3);
  if (shown > 0.01) {
    const spacing = exitRadius * 2.6;
    for (let index = 0; index < diamonds; index++) {
      const centre = spacing * (index + 0.8);
      if (centre > drawnLength * 0.85) break;
      const half = exitRadius * (0.72 - index * 0.08);
      const reach = spacing * 0.4;
      diamondShapes.push({ points: [[0, centre - reach], [half, centre], [0, centre + reach], [-half, centre]], opacity: shown * (1 - index / (diamonds + 2)) });
    }
  }
  const splash = drawnLength < fullLength ? splashOf(drawnLength, tail, fullLength - drawnLength, time, seed) : null;
  return {
    length: drawnLength,
    halo: outline(drawnLength, haloWidth),
    body: outline(drawnLength, bodyWidth),
    core: outline(coreLength, coreWidth, 5),
    diamonds: diamondShapes,
    splash,
    bodyOpacity: (0.95 - 0.55 * air) * (0.55 + 0.45 * power),
    haloOpacity: (0.4 - 0.2 * air) * (0.5 + 0.5 * power),
    coreOpacity: 1 - 0.35 * air,
  };
}

// Flame flattened against a surface: a wide low lens of fire, wider the more flame was cut off.
function splashOf(at, width, cut, time, seed) {
  const reach = width * 1.4 + cut * 0.5 * (1 + 0.08 * noise(time, seed + 3));
  const points = [];
  for (let index = 0; index <= 12; index++) {
    const share = index / 12;
    const across = -reach + 2 * reach * share;
    const lift = Math.sin(share * Math.PI) * width * 0.5;
    points.push([across, at - lift]);
  }
  points.push([reach * 0.6, at], [-reach * 0.6, at]);
  return points;
}

// A billowing cloud of steam or smoke: `count` puffs that grow, drift outward and rise, then thin out.
// `age` is seconds since the source started; returns [across, up, radius, opacity] per puff.
export function puffs({ age = 0, count = 12, spread = 18, rise = 6, size = 5, life = 9, seed = 3 } = {}) {
  const shown = [];
  for (let index = 0; index < count; index++) {
    const born = (index / count) * life * 0.45;
    const own = age - born;
    if (own <= 0) continue;
    const growth = 1 - Math.exp(-own / 2.2);
    const side = fraction(Math.sin((seed + index) * 78.233) * 43758.5453) * 2 - 1;
    const across = side * spread * growth;
    const up = rise * growth * (0.4 + 0.6 * fraction(index * 0.618 + seed * 0.1)) + 0.3 * noise(own, seed + index);
    const radius = size * (0.45 + 0.9 * growth);
    const opacity = Math.max(0, 1 - own / life) * Math.min(1, own * 3);
    shown.push([across, up, radius, opacity]);
  }
  return shown;
}

// A glow's strength from a source's power and its distance to the lit surface (inverse-square, capped).
export function glow({ power = 1, distance = 0, reach = 12 } = {}) {
  const falloff = 1 / (1 + (Math.max(0, distance) / reach) ** 2);
  return clampShare(power) * falloff;
}
