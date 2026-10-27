// Every size of the lamp and its supply circuit in world units (about 1.5 mm each), and the curves that
// are computed rather than listed: the blown bulb, the glass stem, the horseshoe filament, the lead-in
// wires and the route the current takes. x runs along the board from the generator to the lamp, y from
// the back of the board to the viewer, z up. The build and the page both read this one table.

const LAMP = { x: 30, y: 0 };

const SIZES = {
  lamp: LAMP,
  board: { x0: -84, x1: 60, y0: -30, y1: 30, z0: 0, z1: 4, foot: 3 },
  generator: {
    bed: { x0: -78, x1: -46, y0: -12, y1: 12, z0: 4, z1: 7 },
    poles: { x0: -76, x1: -48, y0: -8, y1: 8, z0: 7, z1: 19 },
    coils: [-69, -55],
    coilRadius: 5.2,
    coilTop: 47,
    yoke: { x0: -76, x1: -48, y0: -6, y1: 6, z0: 47, z1: 52 },
    shaft: { x: -62, z: 13, plate: 5.2, pulley: 3 },
    terminalX: -40,
    terminalY: 12,
    terminalRadius: 1.6,
    terminalTop: 9,
  },
  socket: { foot: { x0: 14, x1: 46, y0: -16, y1: 16, z0: 4, z1: 8 }, radius: 10, z0: 8, z1: 21, collar: 10.8, top: 23, postX: 17, postY: 12, postRadius: 1.5, postTop: 11.5 },
  key: { z: 14.5, x0: 40, shaft: 50, x1: 58, half: 4.6, radius: 1.1 },
  base: { radius: 7.2, z0: 23, z1: 33, collar: 6.4, top: 35.5, threads: 4 },
  bulb: { z0: 35.5, neck: 6.2, centre: 68, radius: 19, joinSlope: 0.5, tip: [[86.6, 2.4], [89, 1.3], [92, 0.5]] },
  stem: [[35.5, 5.6], [38.5, 3.1], [49, 3.1], [50.5, 2.3], [52, 2.3]],
  leads: { inner: 1.6, outer: 4.5, z0: 33.5, stemTop: 52, spread: 55.5, top: 57.5 },
  clamps: { z0: 57.5, z1: 60.5, halfX: 1.3, halfY: 1 },
  filament: { legTop: 73.5, radius: 4.5 },
  wire: { level: 4.7, rise: 13.2, post: 10, inside: 6.5 },
  // The part the zoom frame magnifies: the filament and its two clamps.
  zoom: { x0: LAMP.x - 7.5, x1: LAMP.x + 7.5, z0: 55, z1: 80.5 },
};

const BULB = SIZES.bulb;
const JOIN_ANGLE = Math.atan(BULB.joinSlope);
const JOIN_Z = BULB.centre - BULB.radius * Math.sin(JOIN_ANGLE);
const JOIN_RADIUS = BULB.radius * Math.cos(JOIN_ANGLE);
const BULB_TOP = BULB.centre + BULB.radius;

// Radius of the blown bulb at height z: a neck that swells along a smooth curve into a round globe.
function bulbRadius(z) {
  if (z >= BULB_TOP) return 0;
  if (z >= JOIN_Z) return Math.sqrt(Math.max(0, BULB.radius ** 2 - (z - BULB.centre) ** 2));
  const span = JOIN_Z - BULB.z0;
  const share = Math.max(0, (z - BULB.z0) / span);
  const squared = share * share;
  const cubed = squared * share;
  const rise = JOIN_RADIUS - BULB.neck;
  return BULB.neck + rise * (3 * squared - 2 * cubed) + BULB.joinSlope * span * (cubed - squared);
}

function radiusFromTable(table, z) {
  if (z <= table[0][0]) return table[0][1];
  for (let index = 1; index < table.length; index++) {
    const [upper, upperRadius] = table[index];
    if (z > upper) continue;
    const [lower, lowerRadius] = table[index - 1];
    return lowerRadius + ((upperRadius - lowerRadius) * (z - lower)) / (upper - lower);
  }
  return table[table.length - 1][1];
}

const tipRadius = (z) => radiusFromTable(BULB.tip, z);
const stemRadius = (z) => radiusFromTable(SIZES.stem, z);

// [z, radius, slope] along a turned shape, for the outline below.
function profileSamples(radiusAt, z0, z1, count) {
  const samples = [];
  const nudge = (z1 - z0) / (count * 8);
  for (let index = 0; index <= count; index++) {
    const z = z0 + ((z1 - z0) * index) / count;
    const slope = (radiusAt(Math.min(z1, z + nudge)) - radiusAt(Math.max(z0, z - nudge))) / (Math.min(z1, z + nudge) - Math.max(z0, z - nudge));
    samples.push([z, radiusAt(z), slope]);
  }
  return samples;
}

function aroundAxis(radius, angle, z) {
  return [LAMP.x + radius * Math.cos(angle), LAMP.y + radius * Math.sin(angle), z];
}

// The outline of a shape turned about the lamp's axis, as the camera sees it: on each ring, the two
// points where the surface turns away from the viewer. `azimuth` and `elevation` are in radians.
// The points run up one side and down the other, closed along the front of the lowest ring.
function turnedOutline(samples, azimuth, elevation) {
  const near = [];
  const far = [];
  for (const [z, radius, slope] of samples) {
    const swing = Math.acos(Math.min(1, Math.max(-1, slope * Math.tan(elevation))));
    near.push(aroundAxis(radius, azimuth - swing, z));
    far.push(aroundAxis(radius, azimuth + swing, z));
  }
  const [z0, radius0, slope0] = samples[0];
  const swing0 = Math.acos(Math.min(1, Math.max(-1, slope0 * Math.tan(elevation))));
  const front = [];
  for (let index = 1; index < 12; index++) front.push(aroundAxis(radius0, azimuth + swing0 - (2 * swing0 * index) / 12, z0));
  return near.concat(far.reverse(), front);
}

// A line running up the surface of a turned shape at one angle round the axis.
function meridian(radiusAt, angle, z0, z1, count) {
  const points = [];
  for (let index = 0; index <= count; index++) {
    const z = z0 + ((z1 - z0) * index) / count;
    points.push(aroundAxis(radiusAt(z), angle, z));
  }
  return points;
}

// Part of a ring round the lamp's axis, from one angle to another.
function ring(radius, z, fromAngle, toAngle, count = 24) {
  const points = [];
  for (let index = 0; index <= count; index++) points.push(aroundAxis(radius, fromAngle + ((toAngle - fromAngle) * index) / count, z));
  return points;
}

// One platinum lead-in wire, from the base up through the glass stem and out to its clamp.
// `side` is 1 for the wire on the switch's side and -1 for the other.
function leadPoints(side) {
  const L = SIZES.leads;
  const inner = LAMP.x + side * L.inner;
  const outer = LAMP.x + side * L.outer;
  return [[inner, LAMP.y, L.z0], [inner, LAMP.y, L.stemTop], [outer, LAMP.y, L.spread], [outer, LAMP.y, L.top]];
}

// The carbon horseshoe from the clamp on the switch's side over the top to the other clamp.
// `fromShare` and `toShare` cut a piece out of it: 0 is the first clamp, 1 the second.
function filamentPoints(fromShare = 0, toShare = 1, count = 48) {
  const F = SIZES.filament;
  const foot = SIZES.clamps.z1;
  const leg = F.legTop - foot;
  const arc = Math.PI * F.radius;
  const whole = leg * 2 + arc;
  const points = [];
  for (let index = 0; index <= count; index++) {
    const along = (fromShare + ((toShare - fromShare) * index) / count) * whole;
    if (along <= leg) points.push([LAMP.x + F.radius, LAMP.y, foot + along]);
    else if (along >= leg + arc) points.push([LAMP.x - F.radius, LAMP.y, F.legTop - (along - leg - arc)]);
    else {
      const angle = (along - leg) / F.radius;
      points.push([LAMP.x + F.radius * Math.cos(angle), LAMP.y, F.legTop + F.radius * Math.sin(angle)]);
    }
  }
  return points;
}

// The route of the current, piece by piece, from one generator terminal round to the other.
function pathRoutes() {
  const G = SIZES.generator;
  const S = SIZES.socket;
  const W = SIZES.wire;
  const B = SIZES.base;
  const K = SIZES.key;
  const contact = LAMP.x + S.radius - 2;
  const shell = LAMP.x + B.radius;
  const wire = (y) => [[G.terminalX, y, G.terminalTop - 1], [G.terminalX + 4, y, W.level], [W.rise, y, W.level], [W.rise, y, W.post], [S.postX, y, W.post]];
  return {
    wireOut: wire(S.postY),
    socketIn: [[S.postX, S.postY, W.post], [S.postX, S.postY, W.inside], [contact, S.postY, W.inside], [contact, LAMP.y, W.inside], [contact, LAMP.y, K.z], [shell, LAMP.y, B.z0], [shell, LAMP.y, B.z1], leadPoints(1)[0]],
    leadUp: leadPoints(1),
    leadDown: leadPoints(-1).reverse(),
    socketOut: [leadPoints(-1)[0], [LAMP.x, LAMP.y, B.z0], [LAMP.x, LAMP.y, W.inside], [LAMP.x, -S.postY, W.inside], [S.postX, -S.postY, W.inside], [S.postX, -S.postY, W.post]],
    wireBack: wire(-S.postY).reverse(),
  };
}

export function createLayout() {
  return { sizes: SIZES, lamp: LAMP, bulbTop: BULB_TOP, bulbRadius, tipRadius, stemRadius, profileSamples, turnedOutline, meridian, ring, aroundAxis, leadPoints, filamentPoints, pathRoutes };
}
