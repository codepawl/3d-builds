// Every size of Falcon 9 in world units of one metre, and the shapes that are computed rather than listed:
// the turned profiles (fairing, engine bells, MVac nozzle), the engine layout, the legs and grid fins on
// their hinges. The rocket stands on its axis at x = 0, y = 0 with the nozzle exits at z = 0.
// Sourced (reference/notes.md): 70 m height, 3.66 m diameter, 13.1 m by 5.2 m fairing, nine engines with
// eight round a centre one, four grid fins at the base of the interstage, four legs at the base, a common
// dome between the LOX tank (above) and the RP-1 tank. Estimated: every length in between.

const RADIUS = 3.66 / 2;
const FAIRING_RADIUS = 5.2 / 2;

const SIZES = {
  radius: RADIUS,
  engines: { ring: 1.22, exit: 0.47, throat: 0.21, chamber: 0.32, top: 2.5, bellTop: 1.75, centreDrop: 0 },
  skirt: { z0: 1.6, z1: 3.4 },
  rp1: { z0: 3.4, z1: 16.7 },
  lox: { z0: 16.7, z1: 41.0 },
  interstage: { z0: 41.0, z1: 47.4 },
  fins: { z: 41.5, length: 1.6, width: 1.3, angles: [0, 90, 180, 270] },
  thrusters: { z: 46.2, angles: [45, 225], size: 0.42 },
  mvac: { exitZ: 42.4, exit: 1.45, throatZ: 46.6, throat: 0.32, top: 47.4 },
  upper: { z0: 47.4, z1: 56.9 },
  fairing: { z0: 56.9, base: 57.6, shoulder: 63.0, tip: 70.0, radius: FAIRING_RADIUS, nose: 0.3 },
  payload: { adapter: 57.2, z0: 58.1, z1: 64.2, half: 1.35 },
  legs: { hingeZ: 3.0, length: 8.6, width: 1.1, thickness: 0.45, strutZ: 8.4, strutAt: 0.55, angles: [45, 135, 225, 315], deployed: (118 * Math.PI) / 180 },
  // SLC-40 as photographed in 2024 (facts guide-slc40, wiki-slc40-crew-tower, photo-lightning-towers,
  // photo-erector, photo-crew-tower, pad-drawing). Places are given as [across, depth]: across runs to the
  // right of the screen, depth toward the viewer (see `site`). A concrete apron; the
  // launch mount with four hydraulic hold-down clamps over a flame trench that opens on the side away from
  // the erector; the transporter-erector, a lattice beam beside the rocket hinged at its foot by the mount,
  // with its rails and lifting rams; the square access tower with its swing arm, white room and escape
  // slide; four lattice lightning towers in two pairs with white masts, wires between the masts and guys.
  pad: {
    z0: -3.6,
    z1: -3.0,
    half: 15,
    mountHalf: 3.6,
    mountTop: 0.9,
    clampTop: 1.7,
    clamp: 0.5,
    trench: { start: 3.6, end: 15, half: 3.2, floor: -7 },
    erector: { across: 2.5, width: 2.2, depth: 1.1, top: 66, retract: (7 * Math.PI) / 180, arms: [16, 34, 52, 63], rails: 11, ram: { from: 11, to: 15 } },
    crewTower: { across: -13, depth: -6, half: 2.8, top: 78, column: 0.35, floor: 13, arm: { z0: 60, z1: 62.4, reach: 8, half: 0.8 }, room: { half: 1.5, z0: 58.6, z1: 62.6 }, slide: { from: 46, out: 26 } },
    // Each pair stands on a line turned 45 degrees to the camera, so its two towers show side by side
    // (the view is taken from that azimuth); [across, depth] per tower, back towers first.
    towers: { places: [[-36, -5], [24, -5], [-24, 6], [36, 6]], base: 2.6, waist: 1.0, top: 74, mastTop: 96, mast: 0.45, guyOut: 12 },
  },
  // The droneship, simplified and drawn far smaller than it is: a deck under the legs' feet and a hull.
  ship: { deck: -1.05, hull: -4.4, halfX: 15, halfY: 10, sea: -4.8, seaHalf: 17, mark: 6.5, wall: 1.8 },
  zoom: { z0: -0.4, z1: 3.6, half: 2.3 },
};

// The nine Merlin engines: one in the centre and eight round it (the user's guide), each at [x, y].
function enginePlaces() {
  const places = [[0, 0]];
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4 + Math.PI / 8;
    places.push([SIZES.engines.ring * Math.cos(angle), SIZES.engines.ring * Math.sin(angle)]);
  }
  return places;
}

// Which engines burn for each count: all nine, three in a row (centre and two opposite), or the centre.
function burningEngines(count) {
  if (count >= 9) return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  if (count === 3) return [0, 1, 5];
  if (count === 1) return [0];
  return [];
}

// Profiles as [height along the axis, radius] from the bottom up.
function bellProfile() {
  const E = SIZES.engines;
  const points = [];
  for (let index = 0; index <= 8; index++) {
    const share = index / 8;
    points.push([share * E.bellTop, E.exit - (E.exit - E.throat) * Math.sqrt(share)]);
  }
  points.push([E.bellTop + 0.25, E.chamber]);
  points.push([E.top, E.chamber]);
  return points;
}

function mvacProfile() {
  const M = SIZES.mvac;
  const points = [];
  const span = M.throatZ - M.exitZ;
  for (let index = 0; index <= 10; index++) {
    const share = index / 10;
    points.push([M.exitZ + share * span, M.exit - (M.exit - M.throat) * Math.sqrt(share)]);
  }
  points.push([M.throatZ + 0.3, M.throat * 1.4]);
  points.push([M.top, M.throat * 1.4]);
  return points;
}

// The fairing: a short cone out to the wider radius, a cylinder, then a tangent ogive to a round nose.
function fairingProfile() {
  const F = SIZES.fairing;
  const points = [[F.z0, RADIUS], [F.base, F.radius], [F.shoulder, F.radius]];
  const length = F.tip - F.shoulder;
  const rho = (F.radius * F.radius + length * length) / (2 * F.radius);
  for (let index = 1; index <= 14; index++) {
    const along = (length * index) / 14;
    const radius = Math.sqrt(Math.max(0, rho * rho - along * along)) + F.radius - rho;
    points.push([F.shoulder + along, Math.max(F.nose * (index === 14 ? 0.4 : 1), radius)]);
  }
  return points;
}

function radial(angleDegrees, radius, z) {
  const angle = (angleDegrees * Math.PI) / 180;
  return [radius * Math.cos(angle), radius * Math.sin(angle), z];
}

// One landing leg as a flat strip: hinged at its foot end at the base, stowed up along the tank, swung
// down and out by `share` of its travel. Returns the strip's four corners.
function legCorners(angleDegrees, share) {
  const L = SIZES.legs;
  const angle = (angleDegrees * Math.PI) / 180;
  const out = [Math.cos(angle), Math.sin(angle)];
  const side = [-Math.sin(angle), Math.cos(angle)];
  const swing = share * L.deployed;
  const along = [Math.sin(swing), Math.cos(swing)];
  const hinge = RADIUS + 0.12;
  const point = (distance, offset) => [out[0] * (hinge + along[0] * distance) + side[0] * offset, out[1] * (hinge + along[0] * distance) + side[1] * offset, L.hingeZ + along[1] * distance];
  const half = L.width / 2;
  return [point(0, -half), point(L.length, -half * 0.6), point(L.length, half * 0.6), point(0, half)];
}

// One grid fin: a lattice panel hinged at the interstage, flat against it when stowed and standing
// straight out when deployed. Returns its four corners.
function finCorners(angleDegrees, share) {
  const G = SIZES.fins;
  const angle = (angleDegrees * Math.PI) / 180;
  const out = [Math.cos(angle), Math.sin(angle)];
  const side = [-Math.sin(angle), Math.cos(angle)];
  const swing = (share * Math.PI) / 2;
  const reach = [Math.sin(swing), Math.cos(swing)];
  const base = RADIUS + 0.08;
  const point = (distance, offset) => [out[0] * (base + reach[0] * distance) + side[0] * offset, out[1] * (base + reach[0] * distance) + side[1] * offset, G.z + reach[1] * distance];
  const half = G.width / 2;
  return [point(0, -half), point(G.length, -half), point(G.length, half), point(0, half)];
}

// The leg seen as a solid bar: its side face, in the leg's own radial plane so the leg is never seen
// edge-on as a spike, and the telescoping strut from the body down to the leg.
function legSide(angleDegrees, share) {
  const L = SIZES.legs;
  const angle = (angleDegrees * Math.PI) / 180;
  const out = [Math.cos(angle), Math.sin(angle)];
  const swing = share * L.deployed;
  const along = [Math.sin(swing), Math.cos(swing)];
  const normal = [Math.cos(swing), -Math.sin(swing)];
  const hinge = RADIUS + 0.12;
  const point = (distance, depth) => {
    const radial = hinge + along[0] * distance + normal[0] * depth;
    return [out[0] * radial, out[1] * radial, L.hingeZ + along[1] * distance + normal[1] * depth];
  };
  const side = [point(0, 0), point(L.length, 0), point(L.length, L.thickness), point(0, L.thickness)];
  const strut = [[out[0] * RADIUS, out[1] * RADIUS, L.strutZ], point(L.length * L.strutAt, 0)];
  return { side, strut };
}

// A place on the ground as [across, depth] (across: to the right of the screen, depth: toward the viewer)
// turned into world [x, y].
function site(across, depth) {
  return [(across + depth) * Math.SQRT1_2, (depth - across) * Math.SQRT1_2];
}

// The transporter-erector, tilted away from the rocket by `share` of its retraction about its foot.
// `point(offset, depth, up)`: offset across the beam from its inner chord, depth across its thickness.
function erectorFrame(share) {
  const E = SIZES.pad.erector;
  const tilt = share * E.retract;
  const foot = SIZES.pad.z1;
  const height = E.top - foot;
  const point = (offset, depth, up) => {
    const across = E.across + offset * Math.cos(tilt) + up * Math.sin(tilt);
    const [x, y] = site(across, depth);
    return [x, y, foot - offset * Math.sin(tilt) + up * Math.cos(tilt)];
  };
  return { point, height, width: E.width, depth: E.depth };
}

function lerp3(first, second, share) {
  return [0, 1, 2].map((index) => first[index] + (second[index] - first[index]) * share);
}

export function createLayout() {
  return { sizes: SIZES, enginePlaces, burningEngines, bellProfile, mvacProfile, fairingProfile, radial, legCorners, legSide, finCorners, erectorFrame, site, lerp3 };
}
