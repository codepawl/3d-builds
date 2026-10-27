import { Path } from './path.js';

// All positions are metres, x east, y up, z south. Yaw 0 flows toward +x; positive yaw turns toward -z (north).
export const BELT_TOP_HEIGHT = 0.8;
const HALF_PI = Math.PI / 2;

export const SPEED = {
  deskBelt: 1.0,
  collector: 1.6,
  line: 2.8,
  computedTomography: 2.4,
  sorter: 3.4,
  reject: 1.2,
  carousel: 0.8,
};

export const SITE_OFFSET_RAMP = 84;

function rotateLocal(yaw, localX, localZ) {
  return [
    localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    -localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  ];
}

// Lays conveyor modules end to end and records the centre line that bags follow.
class Route {
  constructor(x, z, yaw, floorY) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.floorY = floorY;
    this.beltY = floorY + BELT_TOP_HEIGHT;
    this.points = [[x, this.beltY, z]];
    this.speeds = [];
    this.modules = [];
    this.supports = [];
  }

  addPoint(speed) {
    this.points.push([this.x, this.beltY, this.z]);
    this.speeds.push(speed);
  }

  straight(count, speed, tag) {
    for (let index = 0; index < count; index += 1) {
      this.modules.push({
        asset: 'conveyors',
        node: 'conv_straight',
        position: [this.x, this.floorY, this.z],
        yaw: this.yaw,
        belt: { speed, reversed: false },
        tag,
      });
      this.x += 2 * Math.cos(this.yaw);
      this.z -= 2 * Math.sin(this.yaw);
      this.addPoint(speed);
    }
    return this;
  }

  // Moves along the centre line without placing a module (a machine sits there).
  advance(length, speed) {
    this.x += length * Math.cos(this.yaw);
    this.z -= length * Math.sin(this.yaw);
    this.addPoint(speed);
    return this;
  }

  curveLeft(speed) {
    const radius = 1.5;
    this.modules.push({
      asset: 'conveyors',
      node: 'conv_curve90',
      position: [this.x, this.floorY, this.z],
      yaw: this.yaw,
      belt: { speed, reversed: false },
    });
    const startX = this.x;
    const startZ = this.z;
    const steps = 10;
    for (let step = 1; step <= steps; step += 1) {
      const angle = (HALF_PI * step) / steps;
      const [offsetX, offsetZ] = rotateLocal(this.yaw, radius * Math.sin(angle), -radius * (1 - Math.cos(angle)));
      this.points.push([startX + offsetX, this.beltY, startZ + offsetZ]);
      this.speeds.push(speed);
    }
    const last = this.points[this.points.length - 1];
    this.x = last[0];
    this.z = last[2];
    this.yaw += HALF_PI;
    return this;
  }

  // Each incline module is placed backwards (turned 180 degrees) so the belt runs down.
  decline(count, speed) {
    for (let index = 0; index < count; index += 1) {
      const lowEndX = this.x + 2 * Math.cos(this.yaw);
      const lowEndZ = this.z - 2 * Math.sin(this.yaw);
      const moduleFloorY = this.beltY - 1.3;
      this.modules.push({
        asset: 'conveyors',
        node: 'conv_incline',
        position: [lowEndX, moduleFloorY, lowEndZ],
        yaw: this.yaw + Math.PI,
        belt: { speed, reversed: true },
      });
      if (moduleFloorY > 0.05) {
        for (const along of [0.4, 1.6]) {
          for (const across of [-0.42, 0.42]) {
            const [offsetX, offsetZ] = rotateLocal(this.yaw, along, across);
            this.supports.push({ x: this.x + offsetX, z: this.z + offsetZ, height: moduleFloorY });
          }
        }
      }
      this.x = lowEndX;
      this.z = lowEndZ;
      this.beltY -= 0.5;
      this.addPoint(speed);
    }
    this.floorY = this.beltY - BELT_TOP_HEIGHT;
    return this;
  }

  path() {
    return new Path(this.points, this.speeds);
  }
}

function buildSorterLoop() {
  const modules = [];
  const points = [];
  let x = 2;
  let z = 11.5;
  let yaw = 0;
  const addStraights = (count) => {
    for (let index = 0; index < count; index += 1) {
      modules.push({ asset: 'sorter', node: 'sorter_track_straight', position: [x, 0, z], yaw });
      points.push([x, 0, z]);
      x += 2 * Math.cos(yaw);
      z -= 2 * Math.sin(yaw);
    }
  };
  const addCurve = () => {
    modules.push({ asset: 'sorter', node: 'sorter_track_curve90', position: [x, 0, z], yaw });
    const steps = 12;
    for (let step = 0; step < steps; step += 1) {
      const angle = (HALF_PI * step) / steps;
      const [offsetX, offsetZ] = rotateLocal(yaw, 2 * Math.sin(angle), -2 * (1 - Math.cos(angle)));
      points.push([x + offsetX, 0, z + offsetZ]);
    }
    const [exitX, exitZ] = rotateLocal(yaw, 2, -2);
    x += exitX;
    z += exitZ;
    yaw += HALF_PI;
  };
  addStraights(10);
  addCurve();
  addStraights(2);
  addCurve();
  addStraights(10);
  addCurve();
  addStraights(2);
  addCurve();
  points.push([points[0][0], 0, points[0][2]]);

  // Resample at equal spacing so a tray pose is a lookup by distance.
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][2] - points[index - 1][2]));
  }
  const length = cumulative[cumulative.length - 1];
  const sampleSpacing = 0.05;
  const sampleCount = Math.round(length / sampleSpacing);
  const spacing = length / sampleCount;
  const samples = new Float32Array((sampleCount + 1) * 3);
  let segment = 0;
  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const distance = sampleIndex * spacing;
    while (segment < points.length - 2 && cumulative[segment + 1] < distance) segment += 1;
    const segmentLength = cumulative[segment + 1] - cumulative[segment] || 1;
    const fraction = (distance - cumulative[segment]) / segmentLength;
    const from = points[segment];
    const to = points[segment + 1];
    samples[sampleIndex * 3] = from[0] + (to[0] - from[0]) * fraction;
    samples[sampleIndex * 3 + 1] = from[2] + (to[2] - from[2]) * fraction;
    samples[sampleIndex * 3 + 2] = Math.atan2(-(to[2] - from[2]), to[0] - from[0]);
  }
  return { modules, length, samples, spacing, sampleCount };
}

// Pose of a point on the closed sorter loop at a distance (wraps around).
export function loopPose(loop, distance, out) {
  const wrapped = ((distance % loop.length) + loop.length) % loop.length;
  const position = wrapped / loop.spacing;
  const index = Math.min(Math.floor(position), loop.sampleCount - 1);
  const fraction = position - index;
  const samples = loop.samples;
  out.x = samples[index * 3] + (samples[index * 3 + 3] - samples[index * 3]) * fraction;
  out.z = samples[index * 3 + 1] + (samples[index * 3 + 4] - samples[index * 3 + 1]) * fraction;
  let yawDifference = samples[index * 3 + 5] - samples[index * 3 + 2];
  if (yawDifference > Math.PI) yawDifference -= 2 * Math.PI;
  if (yawDifference < -Math.PI) yawDifference += 2 * Math.PI;
  out.yaw = samples[index * 3 + 2] + yawDifference * fraction;
  return out;
}

export const CHUTE_DEFINITIONS = [
  { id: 'C1', loopDistance: 13.5 },
  { id: 'C2', loopDistance: 17 },
  { id: 'C3', loopDistance: 19.5 },
  { id: 'C4', loopDistance: 34.3 },
  { id: 'C5', loopDistance: 38.3 },
  { id: 'C6', loopDistance: 42.3 },
  { id: 'C7', loopDistance: 46.3 },
];

export const INDUCTION_LOOP_DISTANCE = 6;
export const TRAY_PITCH = 1.3;

function buildCheckInAndSorter() {
  const deskRows = [3, 7.4, 11.8, 16.2];
  const collectorX = -33;
  const main = new Route(collectorX, 1.0, -HALF_PI, 1.5);
  main.straight(10, SPEED.collector);
  main.curveLeft(SPEED.collector);
  main.decline(3, SPEED.collector);
  main.straight(16, SPEED.line);
  const mainLineEndX = main.x;
  main.curveLeft(SPEED.line);
  main.straight(1, SPEED.line);
  main.advance(2.7, SPEED.computedTomography);
  main.straight(2, SPEED.line);
  return { main, deskRows, collectorX, mainLineEndX };
}

export function buildWorld() {
  const checkIn = buildCheckInAndSorter();
  const main = checkIn.main;
  const mainPath = main.path();
  const modules = [...main.modules];
  const supports = [...main.supports];

  // Check-in desks feed the collector sideways.
  const deskPaths = checkIn.deskRows.map((deskZ) => {
    const collectorDistance = mainPath.distanceNearest(checkIn.collectorX, deskZ);
    const tail = mainPath.fromDistance(collectorDistance);
    const startPoint = [-35.4, 1.5 + BELT_TOP_HEIGHT, deskZ];
    const joinPoint = [checkIn.collectorX, 1.5 + BELT_TOP_HEIGHT, deskZ];
    const prefix = new Path([startPoint, joinPoint], [SPEED.deskBelt]);
    return Path.join(prefix, tail, SPEED.deskBelt);
  });
  checkIn.deskRows.forEach((deskZ, index) => {
    modules.push({ asset: 'conveyors', node: 'checkin_desk', position: [-34.5, 1.5, deskZ], yaw: 0, unit: `desk-${index + 1}`, tag: 'desk' });
  });

  // Early bag store: two rows of racks around one crane aisle, one output belt joining the main line.
  const storeBays = [-11, -9, -7, -5];
  storeBays.forEach((bayX) => {
    modules.push({ asset: 'logistics', node: 'ebs_rack', position: [bayX, 0, 6], yaw: 0, tag: 'rack' });
    modules.push({ asset: 'logistics', node: 'ebs_rack', position: [bayX, 0, 9.8], yaw: Math.PI, tag: 'rack' });
  });
  const storeFeed = new Route(-8, 10.2, -HALF_PI, 0);
  storeFeed.straight(6, SPEED.collector);
  modules.push(...storeFeed.modules);
  const storeToMainDistance = mainPath.distanceNearest(-8, 22.5);
  const storePath = Path.join(
    new Path(storeFeed.points, storeFeed.speeds),
    mainPath.fromDistance(storeToMainDistance),
    SPEED.line,
  );

  // Read arch over the main line.
  modules.push({ asset: 'conveyors', node: 'read_arch', position: [5, 0, 22.5], yaw: 0, unit: 'arch-1' });
  const archDistance = mainPath.distanceNearest(5, 22.5);

  // Hold baggage screening on the induction leg.
  modules.push({ asset: 'screening', node: 'ct_scanner', position: [8, 0, 17.65], yaw: HALF_PI, unit: 'ct-1' });
  const scannerEntryDistance = mainPath.distanceNearest(8, 19.0);
  const scannerExitDistance = mainPath.distanceNearest(8, 16.3);
  const paddleDistance = mainPath.distanceNearest(8, 15);
  modules.push({ asset: 'conveyors', node: 'diverter_paddle', position: [7.1, 0, 15], yaw: HALF_PI, unit: 'diverter-1' });
  const inductionEndDistance = mainPath.length;

  // Reject line east of the induction leg into the manual search room.
  const rejectRoute = new Route(8.5, 15, 0, 0);
  rejectRoute.straight(1, SPEED.reject);
  modules.push(...rejectRoute.modules);
  modules.push({ asset: 'screening', node: 'search_room', position: [12.2, 0, 15], yaw: -HALF_PI, unit: 'search-room' });
  modules.push({ asset: 'screening', node: 'search_table', position: [12.4, 0, 15], yaw: HALF_PI });
  const rejectTail = new Path(
    [[8.0, BELT_TOP_HEIGHT, 15], [8.9, BELT_TOP_HEIGHT, 15], [10.5, BELT_TOP_HEIGHT, 15], [11.3, 0.95, 15], [12.4, 0.95, 15]],
    [SPEED.reject, SPEED.reject, SPEED.reject, 0.6],
  );

  // Sorter loop, chutes on the outside, bag carts at the feet.
  const loop = buildSorterLoop();
  modules.push(...loop.modules);
  const pose = {};
  const chutes = CHUTE_DEFINITIONS.map((definition) => {
    loopPose(loop, definition.loopDistance, pose);
    const normalX = Math.sin(pose.yaw);
    const normalZ = Math.cos(pose.yaw);
    const chuteYaw = pose.yaw + Math.PI;
    const headX = pose.x + normalX * 0.5;
    const headZ = pose.z + normalZ * 0.5;
    modules.push({ asset: 'sorter', node: 'chute_slide', position: [headX, 0, headZ], yaw: chuteYaw, unit: `chute-${definition.id}` });
    modules.push({ asset: 'logistics', node: definition.id.charCodeAt(1) % 2 ? 'bag_cart_blue' : 'bag_cart_orange', position: [headX + normalX * 2.35, 0, headZ + normalZ * 2.35], yaw: chuteYaw, tag: 'cart' });
    return {
      ...definition,
      trackX: pose.x,
      trackZ: pose.z,
      trackYaw: pose.yaw,
      normalX,
      normalZ,
      headX,
      headZ,
      footX: headX + normalX * 1.85,
      footZ: headZ + normalZ * 1.85,
    };
  });

  const world = {
    modules,
    supports,
    mainPath,
    deskPaths,
    storePath,
    rejectTail,
    loop,
    chutes,
    archDistance,
    scannerEntryDistance,
    scannerExitDistance,
    paddleDistance,
    inductionEndDistance,
    deskRows: checkIn.deskRows,
    storeBays,
  };
  buildRamp(world);
  return world;
}

function roundedLoop(centerX, centerZ, halfWidth, halfDepth, radius, speed) {
  // Left-turning loop seen from above: east along the south edge, north along the east edge, and so on.
  const points = [];
  const arcSteps = 10;
  const corners = [
    [centerX + halfWidth - radius, centerZ + halfDepth - radius, -HALF_PI],
    [centerX + halfWidth - radius, centerZ - halfDepth + radius, 0],
    [centerX - halfWidth + radius, centerZ - halfDepth + radius, HALF_PI],
    [centerX - halfWidth + radius, centerZ + halfDepth - radius, Math.PI],
  ];
  corners.forEach(([cornerX, cornerZ, startAngle]) => {
    for (let step = 0; step <= arcSteps; step += 1) {
      const angle = startAngle + (HALF_PI * step) / arcSteps;
      points.push([cornerX + radius * Math.cos(angle), 0, cornerZ - radius * Math.sin(angle)]);
    }
  });
  points.push(points[0]);
  return new Path(points, points.slice(1).map(() => speed));
}

function buildRamp(world) {
  const offsetX = SITE_OFFSET_RAMP;
  const ramp = { offsetX, modules: [] };
  const modules = ramp.modules;

  // Make-up carousels in the terminal edge.
  const carouselCentres = [
    [offsetX - 14, 0.25, -6],
    [offsetX + 6, 0.25, -6],
  ];
  carouselCentres.forEach(([x, y, z], index) => {
    modules.push({ asset: 'logistics', node: 'carousel_makeup', position: [x, y, z], yaw: 0, unit: `carousel-${index + 1}` });
  });
  ramp.carousels = carouselCentres.map(([x, y, z]) => ({ x, y, z }));
  ramp.carouselPath = (centre) => {
    const straightHalf = 3.0;
    const radius = 1.35;
    const points = [];
    const arcSteps = 12;
    // Counter-clockwise seen from above: east along the south edge, around the east end, back west along the north edge.
    points.push([centre.x - straightHalf, centre.y + 0.55, centre.z + radius]);
    points.push([centre.x + straightHalf, centre.y + 0.55, centre.z + radius]);
    for (let step = 1; step < arcSteps; step += 1) {
      const angle = -HALF_PI + (Math.PI * step) / arcSteps;
      points.push([centre.x + straightHalf + radius * Math.cos(angle), centre.y + 0.55, centre.z - radius * Math.sin(angle)]);
    }
    points.push([centre.x + straightHalf, centre.y + 0.55, centre.z - radius]);
    points.push([centre.x - straightHalf, centre.y + 0.55, centre.z - radius]);
    for (let step = 1; step < arcSteps; step += 1) {
      const angle = HALF_PI + (Math.PI * step) / arcSteps;
      points.push([centre.x - straightHalf + radius * Math.cos(angle), centre.y + 0.55, centre.z - radius * Math.sin(angle)]);
    }
    points.push(points[0]);
    return new Path(points, points.slice(1).map(() => SPEED.carousel));
  };

  // Aircraft stand with belt loader at the hold door.
  const aircraft = { x: offsetX + 6, z: 30 };
  modules.push({ asset: 'ramp', node: 'aircraft_narrowbody', position: [aircraft.x, 0, aircraft.z], yaw: 0, unit: 'aircraft-1' });
  const loaderPosition = [aircraft.x - 1.53 - 5.15, 0, aircraft.z - 4];
  modules.push({ asset: 'ramp', node: 'belt_loader', position: loaderPosition, yaw: HALF_PI, unit: 'loader-1' });
  ramp.aircraft = aircraft;
  ramp.boomAngle = 0.435;
  ramp.loader = { x: loaderPosition[0], z: loaderPosition[2], yaw: HALF_PI };

  // Tug trains on a loop that passes the make-up area and the aircraft.
  ramp.trainLoop = roundedLoop(offsetX - 17, 28, 5, 21, 4.5, 5);
  ramp.trainCount = 2;
  // The trains stop on the east edge of the loop, beside the belt loader.
  ramp.trainStopDistance = ramp.trainLoop.distanceNearest(offsetX - 12, 19);

  // Loose carts and containers near the carousels, handlers beside them.
  const uldSpots = [
    [offsetX - 21, 0.25, 3.2, Math.PI],
    [offsetX - 18.2, 0.25, 3.2, Math.PI],
    [offsetX + 0.5, 0.25, 3.2, Math.PI],
    [offsetX + 3.3, 0.25, 3.2, Math.PI],
  ];
  uldSpots.forEach(([x, y, z, yaw], index) => {
    modules.push({ asset: 'logistics', node: index % 2 ? 'uld_ld3_blue' : 'uld_ld3_grey', position: [x, y, z], yaw, unit: `uld-${index + 1}` });
  });
  ramp.uldSpots = uldSpots;
  const cartSpots = [[offsetX - 9, 0.25, 0.8], [offsetX - 7.5, 0.25, 0.8], [offsetX + 11, 0.25, 0.8], [offsetX + 12.5, 0.25, 0.8]];
  cartSpots.forEach(([x, y, z], index) => {
    modules.push({ asset: 'logistics', node: index % 2 ? 'bag_cart_orange' : 'bag_cart_blue', position: [x, y, z], yaw: 0, tag: 'cart' });
  });
  ramp.handlers = [
    { node: 'handler_orange', position: [offsetX - 19.6, 0.25, 4.9], yaw: 0 },
    { node: 'handler_yellow', position: [offsetX + 1.9, 0.25, 4.9], yaw: 0 },
    { node: 'handler_orange', position: [offsetX - 8.2, 0.25, 2.2], yaw: Math.PI },
  ];
  world.ramp = ramp;
}
