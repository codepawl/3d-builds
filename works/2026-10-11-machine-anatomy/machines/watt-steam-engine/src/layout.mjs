// Every size of the engine in world units, the shapes of its moving parts and the small drawing helpers
// the build and the page share. x runs along the beam from the cylinder (negative) to the flywheel, y from
// the back towards the viewer, z up. The working parts lie in the plane y = 0, where the cylinder, the
// condenser and the air pump are cut open. The kinematics come from model.mjs; this file only adds sizes.

export function createLayout(Engine) {
  const G = Engine.GEOMETRY;
  const C = Engine.CYCLE;
  const GOV = Engine.GOVERNOR;
  const AXIS = G.radiusAnchor[0];
  const PISTON_HALF = G.pistonThickness ? G.pistonThickness / 2 : 3;
  const BORE_BOTTOM = Math.round(C.pistonLow - PISTON_HALF - 3);
  const BORE_TOP = Math.round(C.pistonHigh + PISTON_HALF + 3);
  const PUMP_LINE = (G.beamPivot[0] + AXIS) / 2;

  const SIZES = {
    floor: { x0: -192, x1: 166, y0: -62, y1: 30, z0: -8 },
    beam: { y0: -4, y1: 4, outline: [[-104, -4.5], [-104, 4.5], [-40, 8.5], [40, 8.5], [104, 4.5], [104, -4.5], [40, -8.5], [-40, -8.5]] },
    column: { r: 6.5, base: 11, cap: 9, baseTop: 6, capFrom: 200, capTo: 206, cheekTop: 226, cheekHalf: 5 },
    frame: { y0: -9, y1: -6.5, z0: 191, z1: 197, x0: AXIS - 27, x1: -6, post: 3 },
    motion: { linkY: [4.5, 6], barY: [6, 7.5], radiusY: [-6.5, -4.5], half: 1.5 },
    cylinder: { x: AXIS, bore: 16, wall: 19, flange: 22, bottom: BORE_BOTTOM, top: BORE_TOP, cover: 4, pistonHalf: PISTON_HALF, rodHalf: 1.3, gland: 3.2, glandHeight: 4 },
    pedestal: { x0: AXIS - 24, x1: AXIS + 20, y0: -23, z1: BORE_BOTTOM - 4 },
    boxes: { x0: AXIS + 19, x1: AXIS + 39, y0: -32, upper: [BORE_TOP - 12, BORE_TOP + 4], lower: [BORE_BOTTOM - 4, BORE_BOTTOM + 12], handle: 6, steamY: -24, exhaustY: -8 },
    ports: { x: AXIS + 16, top: BORE_TOP - 4, bottom: BORE_BOTTOM + 4 },
    pipes: { x: -66, steamY: -26, exhaustY: -6, r: 3, mainZ: 168, mainFrom: -152, throttleX: -134, throttleHalf: 6, throttleR: 5 },
    boiler: { x0: -184, x1: -156, z1: 96, dome: 14, y0: -40, y1: -12 },
    cistern: { x0: -77, x1: -26, y0: -22, z1: 60, wall: 2, water: 56 },
    condenser: { x: -66, r: 7, z0: 11, z1: 51 },
    pump: { x: PUMP_LINE, r: 7, z0: 11, z1: 55, bucketHalf: 2, rodHalf: 1 },
    hotWell: { x0: -38, x1: -28, y0: -10, z0: 40, z1: 54 },
    plug: { x: -G.plugAt, y: -14, top: 212, bottom: 80, pegs: [162, 140, 104, 82], pegHalf: 10 },
    flywheel: { y0: -24, y1: -13, r: 55, inner: 47, hub: 8, spokes: 6, spokeHalf: 1.6 },
    shaft: { r: 3, rearY: [-34, -24], frontY: [-13, -3], pulleyY: [-31, -27], pulleyR: 7.5 },
    pedestals: { x0: G.shaft[0] - 8, x1: G.shaft[0] + 8, rearY: [-42, -34], frontY: [-11, -5], z1: G.shaft[1] - 8, cap: 6 },
    gears: { y0: -3, y1: 3, root: 1.3, tip: 1.1, rodY: [4.5, 6.5], linkY: [6.5, 8] },
    governor: { x: 14, y: -37, top: 150, ball: 4.6, spindle: 1.3, spindleFrom: 40, case: [8, 20, -43, -31, 30, 40], base: [-4, 22, -45, -29, 0, 4], pulleyR: 5, pulleyZ: 35, crank: { x: 0, arm: 14, up: 26 }, throttleArm: 16 },
  };

  // ---- shapes of the moving parts, in the (x, z) plane ---------------------------------------------------

  function beamPolygon(beamAngle) {
    const along = [Math.cos(beamAngle), Math.sin(beamAngle)];
    return SIZES.beam.outline.map(([reach, rise]) => [G.beamPivot[0] + reach * along[0] - rise * along[1], G.beamPivot[1] + reach * along[1] + rise * along[0]]);
  }

  // A flat bar from `from` to `to`, a little longer than the distance between its two pins.
  function barPolygon(from, to, halfFrom, halfTo = halfFrom) {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const along = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
    const across = [-along[1], along[0]];
    return [
      [from[0] - along[0] * halfFrom + across[0] * halfFrom, from[1] - along[1] * halfFrom + across[1] * halfFrom],
      [to[0] + along[0] * halfTo + across[0] * halfTo, to[1] + along[1] * halfTo + across[1] * halfTo],
      [to[0] + along[0] * halfTo - across[0] * halfTo, to[1] + along[1] * halfTo - across[1] * halfTo],
      [from[0] - along[0] * halfFrom - across[0] * halfFrom, from[1] - along[1] * halfFrom - across[1] * halfFrom],
    ];
  }

  // The outline of a gear: tooth number 0 points along `angle`.
  function gearPolygon(centre, pitchRadius, teeth, angle) {
    const step = Engine.TAU / teeth;
    const root = pitchRadius - SIZES.gears.root;
    const tip = pitchRadius + SIZES.gears.tip;
    const points = [];
    for (let tooth = 0; tooth < teeth; tooth++) {
      const middle = angle + tooth * step;
      for (const [offset, radius] of [[-0.3, root], [-0.17, tip], [0.17, tip], [0.3, root]]) {
        const at = middle + offset * step;
        points.push([centre[0] + radius * Math.cos(at), centre[1] + radius * Math.sin(at)]);
      }
    }
    return points;
  }

  function spokePolygons(angle) {
    const F = SIZES.flywheel;
    const spokes = [];
    for (let spoke = 0; spoke < F.spokes; spoke++) {
      const at = angle + (spoke / F.spokes) * Engine.TAU;
      const direction = [Math.cos(at), Math.sin(at)];
      const from = [G.shaft[0] + direction[0] * F.hub, G.shaft[1] + direction[1] * F.hub];
      const to = [G.shaft[0] + direction[0] * (F.inner - 1), G.shaft[1] + direction[1] * (F.inner - 1)];
      spokes.push(barPolygon(from, to, F.spokeHalf * 1.3, F.spokeHalf));
    }
    return spokes;
  }

  // The governor for one ball angle and one angle of its spindle: the two balls, the joints of the
  // links on the arms and the sleeve, as world points.
  function governorPoints(ballAngle, spin) {
    const V = SIZES.governor;
    const top = [V.x, V.y, V.top];
    const sleeve = [V.x, V.y, V.top - 2 * GOV.link * Math.cos(ballAngle)];
    const arms = [0, Math.PI].map((turn) => {
      const direction = [Math.cos(spin + turn), Math.sin(spin + turn)];
      const reach = Math.sin(ballAngle);
      const drop = Math.cos(ballAngle);
      return {
        ball: [V.x + direction[0] * GOV.arm * reach, V.y + direction[1] * GOV.arm * reach, V.top - GOV.arm * drop],
        joint: [V.x + direction[0] * GOV.link * reach, V.y + direction[1] * GOV.link * reach, V.top - GOV.link * drop],
      };
    });
    return { top, sleeve, arms };
  }

  const SLEEVE_REST = SIZES.governor.top - 2 * GOV.link * Math.cos(GOV.restAngle);
  const CRANK_PIVOT = [SIZES.governor.crank.x, SLEEVE_REST];
  const THROTTLE_PIVOT = [SIZES.pipes.throttleX, SIZES.pipes.mainZ];

  function crankTip(rise) {
    const turn = Math.asin(Math.min(0.95, rise / SIZES.governor.crank.arm));
    return [CRANK_PIVOT[0] - SIZES.governor.crank.up * Math.sin(turn), CRANK_PIVOT[1] + SIZES.governor.crank.up * Math.cos(turn)];
  }

  const THROTTLE_REST = [THROTTLE_PIVOT[0] + SIZES.governor.throttleArm * 0.5, THROTTLE_PIVOT[1] - SIZES.governor.throttleArm * 0.866];
  const ROD_LENGTH = Math.hypot(crankTip(0)[0] - THROTTLE_REST[0], crankTip(0)[1] - THROTTLE_REST[1]);

  // The governor's rod: the sleeve lifts one arm of a bell crank, whose other arm pulls a long rod, which
  // swings the arm on the throttle valve's spindle. All in the plane of the governor, as (x, z) points.
  function throttleLinkage(ballAngle) {
    const rise = Engine.sleeveRise(ballAngle);
    const tip = crankTip(rise);
    const meets = Engine.circleMeet(THROTTLE_PIVOT, SIZES.governor.throttleArm, tip, ROD_LENGTH);
    const armTip = meets[0][1] <= meets[1][1] ? meets[0] : meets[1];
    return { pivot: CRANK_PIVOT, sleeve: [SIZES.governor.x, SLEEVE_REST + rise], tip, armTip, throttlePivot: THROTTLE_PIVOT };
  }

  // ---- where steam, exhaust and condensate run, as world points ------------------------------------------

  const pipes = SIZES.pipes;
  const ports = SIZES.ports;
  const ROUTES = {
    steamMain: [[-170, pipes.steamY, SIZES.boiler.z1 + SIZES.boiler.dome], [-170, pipes.steamY, pipes.mainZ], [pipes.x, pipes.steamY, pipes.mainZ], [pipes.x, pipes.steamY, ports.top]],
    steamTop: [[pipes.x, pipes.steamY, ports.top], [ports.x + 2, 0, ports.top], [ports.x - 9, 0, ports.top]],
    steamBottom: [[pipes.x, pipes.steamY, ports.top], [pipes.x, pipes.steamY, ports.bottom], [ports.x + 2, 0, ports.bottom], [ports.x - 9, 0, ports.bottom]],
    exhaustTop: [[ports.x - 9, 0, ports.top - 3], [ports.x + 2, 0, ports.top - 3], [pipes.x, pipes.exhaustY, ports.top - 5], [pipes.x, pipes.exhaustY, SIZES.condenser.z1 - 8]],
    exhaustBottom: [[ports.x - 9, 0, ports.bottom - 2], [ports.x + 2, 0, ports.bottom - 2], [pipes.x, pipes.exhaustY, ports.bottom - 4], [pipes.x, pipes.exhaustY, SIZES.condenser.z1 - 8]],
    condensate: [[SIZES.condenser.x, 0, SIZES.condenser.z0 + 4], [SIZES.pump.x, 0, SIZES.pump.z0 + 4], [SIZES.pump.x + 3.5, 0, SIZES.pump.z1 - 5], [SIZES.hotWell.x0 + 4, 0, SIZES.pump.z1 - 5], [SIZES.hotWell.x0 + 4, 0, SIZES.hotWell.z0 + 4]],
  };

  return { sizes: SIZES, axis: AXIS, pumpLine: PUMP_LINE, routes: ROUTES, sleeveRest: SLEEVE_REST, beamPolygon, barPolygon, gearPolygon, spokePolygons, governorPoints, throttleLinkage };
}

// Drawing helpers for flat parts that stand in a plane of constant y. `tools` are the kit's iso, pathOf and
// cameraOf; the build passes its imports and the page its inlined copies, so both draw alike.
export function createDraw(tools, P) {
  const camera = tools.cameraOf(P);
  const VIEW_X = camera.cosA * camera.cosE;
  const VIEW_Z = camera.sinE;

  function onPlane(points, y, closed = true) {
    return tools.pathOf(points.map(([x, z]) => tools.iso([x, y, z], P)), closed);
  }

  function through(points) {
    return tools.pathOf(points.map((point) => tools.iso(point, P)), false);
  }

  function signedArea(polygon) {
    let sum = 0;
    for (let index = 0; index < polygon.length; index++) {
      const [x0, z0] = polygon[index];
      const [x1, z1] = polygon[(index + 1) % polygon.length];
      sum += x0 * z1 - x1 * z0;
    }
    return sum / 2;
  }

  function shadeOf(normalX, normalZ) {
    const length = Math.hypot(normalX, normalZ);
    if (normalZ > 0.5 * length) return 3;
    if (normalZ < -0.5 * length) return 0;
    return normalX > 0 ? 1 : 2;
  }

  // A convex plate: `polygon` in the (x, z) plane, from y0 at the back to y1 at the front. The front face
  // is the lightest; the edge faces the viewer can see are shaded by the way they look.
  function plate(polygon, y0, y1, tone = "mid") {
    const ring = signedArea(polygon) > 0 ? polygon : polygon.slice().reverse();
    const front = onPlane(ring, y1);
    let sides = "";
    let edges = "";
    for (let index = 0; index < ring.length; index++) {
      const from = ring[index];
      const to = ring[(index + 1) % ring.length];
      const normalX = to[1] - from[1];
      const normalZ = -(to[0] - from[0]);
      if (normalX * VIEW_X + normalZ * VIEW_Z <= 1e-6) continue;
      const quad = [[from[0], y1, from[1]], [to[0], y1, to[1]], [to[0], y0, to[1]], [from[0], y0, from[1]]];
      sides += `<path class="iso-shade" data-shade="${shadeOf(normalX, normalZ)}" d="${tools.pathOf(quad.map((point) => tools.iso(point, P)), true)}"/>`;
      edges += through([quad[1], quad[2], quad[3], quad[0]]);
    }
    return `<g class="iso-solid"><path class="iso-fill" d="${front}"/>${sides}<path class="iso-top" d="${front}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${front}${edges}"/></g>`;
  }

  // A flat shape drawn on the plane y: a gear's face, a spoke, the piston in the cut cylinder.
  function face(polygon, y, tone = "mid", className = "we-face") {
    const d = onPlane(polygon, y);
    return `<path class="${className}" d="${d}"/><path class="iso-line" data-tone="${tone}" d="${d}"/>`;
  }

  function circlePoints(centre, radius, steps = 28) {
    const points = [];
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      points.push([centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)]);
    }
    return points;
  }

  function rectangle(x0, x1, z0, z1) {
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  }

  // A pin seen end-on: a small filled dot on the plane y.
  function pin(point, y, radius = 1.1) {
    return `<path class="we-pin" d="${onPlane(circlePoints(point, radius, 10), y)}"/>`;
  }

  // A ball of the governor, shaded as a sphere in three tones: a dark disc as wide as the ball, a lighter
  // disc towards the light and a small highlight.
  function ball(centre, radius) {
    const [x, y] = tools.iso(centre, P);
    const size = radius * camera.k;
    const disc = (className, shiftX, shiftY, share) => `<circle class="${className}" cx="${(x + size * shiftX).toFixed(1)}" cy="${(y + size * shiftY).toFixed(1)}" r="${(size * share).toFixed(2)}"/>`;
    return disc("we-ball", 0, 0, 1) + disc("we-ball-light", -0.13, -0.16, 0.72) + disc("we-shine", -0.32, -0.37, 0.24);
  }

  return { onPlane, through, plate, face, circlePoints, rectangle, pin, ball };
}
