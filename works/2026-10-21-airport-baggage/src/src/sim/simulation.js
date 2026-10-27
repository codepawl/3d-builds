import { Path } from './path.js';
import { CHUTE_DEFINITIONS, INDUCTION_LOOP_DISTANCE, SPEED, loopPose } from './layout.js';

export const FIXED_STEP = 1 / 60;
export const SPEED_STEPS = [0.25, 1, 2, 5, 10];
const MAX_STEPS_PER_FRAME = 40;
const EVENT_TRACE_LIMIT = 6000;
export const POSE_SIZE = 8; // x, y, z, yaw, tilt, scale, a, b
const X = 0;
const Y = 1;
const Z = 2;
const YAW = 3;
const TILT = 4;
const SCALE = 5;

const TRANSFER_SECONDS = 0.4;
const TRAY_DECK_HEIGHT = 1.07;
const TRAY_PIVOT_HEIGHT = 0.92;
const TILT_MAX = 0.5236;
const SLIDE_START = 0.3;
const SLIDE_ACCELERATION = 12;
const SLIDE_EDGE = 0.55;
const CHUTE_SECONDS = 1.15;
const CHUTE_LENGTH = 1.85;
const CHUTE_SLOPE = 0.384;
const HEAD_SECONDS = SLIDE_START + Math.sqrt((2 * SLIDE_EDGE) / SLIDE_ACCELERATION);
const SEARCH_SECONDS = 8;

export const BAG_VARIANTS = [
  { node: 'bag_hard_blue', kilograms: 18 },
  { node: 'bag_hard_orange', kilograms: 23 },
  { node: 'bag_hard_teal', kilograms: 12 },
  { node: 'bag_soft_grey', kilograms: 15 },
  { node: 'bag_duffel_green', kilograms: 14 },
  { node: 'bag_backpack_red', kilograms: 9 },
];

export const FLIGHTS = [
  { code: 'MA 214', destination: 'Porto', gate: 'B12', departsInMinutes: 34, expected: 168 },
  { code: 'NV 072', destination: 'Nairobi', gate: 'B07', departsInMinutes: 52, expected: 212 },
  { code: 'SO 903', destination: 'Reykjavik', gate: 'A03', departsInMinutes: 71, expected: 141 },
  { code: 'MA 530', destination: 'Marrakesh', gate: 'B15', departsInMinutes: 88, expected: 184 },
  { code: 'NV 118', destination: 'Tallinn', gate: 'A09', departsInMinutes: 105, expected: 126 },
  { code: 'SO 441', destination: 'Lima', gate: 'C02', departsInMinutes: 124, expected: 239 },
  { code: 'MA 627', destination: 'Hanoi', gate: 'C11', departsInMinutes: 147, expected: 257 },
];

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

// Tray deck angle in radians after the tilt starts: out in 0.25 s, held, back by 1.08 s.
export function tiltAngle(seconds) {
  if (seconds <= 0 || seconds >= 1.08) return 0;
  if (seconds < 0.25) return TILT_MAX * smoothstep(seconds / 0.25);
  if (seconds < 0.75) return TILT_MAX;
  return TILT_MAX * (1 - smoothstep((seconds - 0.75) / 0.33));
}

function blendAngle(from, to, fraction) {
  let difference = to - from;
  while (difference > Math.PI) difference -= 2 * Math.PI;
  while (difference < -Math.PI) difference += 2 * Math.PI;
  return from + difference * fraction;
}

function makeTag(random, flightIndex) {
  const serial = String(Math.floor(random() * 900000) + 100000);
  return `0${617 + flightIndex} ${serial}`;
}

export function createSimulation(world, options = {}) {
  const random = createRandom(options.seed ?? 20261021);
  const loop = world.loop;
  const trayCount = 46;
  const trayPitch = loop.length / trayCount;
  const trayBusy = Array.from({ length: trayCount }, () => []);
  const trayTilts = Array.from({ length: trayCount }, () => []);
  const beltEnd = world.mainPath.points[world.mainPath.points.length - 1];

  // ---- Plan every bag's journey as a function of time -------------------------------------
  const plans = [];
  const sourceTravel = (sourcePath) => sourcePath.timeAtDistance(0);
  void sourceTravel;
  const sources = [
    ...world.deskPaths.map((path, index) => ({ kind: 'desk', index, path })),
    { kind: 'store', index: 0, path: world.storePath },
  ];
  // Time from each source to the point where all sources share the main line (x = -8 on the main line).
  const joinDistanceOnMain = world.mainPath.distanceNearest(-8, 22.5);
  const joinTimeOnMain = world.mainPath.timeAtDistance(joinDistanceOnMain);
  sources.forEach((source) => {
    source.joinTime = source.path.duration - (world.mainPath.duration - joinTimeOnMain);
  });

  const chuteWeights = [0.22, 0.14, 0.08, 0.2, 0.14, 0.12, 0.1];
  const pickChute = () => {
    let draw = random();
    for (let index = 0; index < chuteWeights.length; index += 1) {
      draw -= chuteWeights[index];
      if (draw <= 0) return index;
    }
    return 0;
  };

  let arrival = -80;
  let lastBlockedUntil = -1e9;
  let planNumber = 0;
  const heroArrival = options.heroArrival ?? 60;
  let heroDone = false;
  while (arrival < (options.horizon ?? 900)) {
    const makeHero = !heroDone && arrival >= heroArrival;
    planNumber += 1;
    const source = makeHero
      ? sources[1]
      : sources[random() < 0.14 ? 4 : Math.floor(random() * 4)];
    const variantIndex = makeHero ? 1 : Math.floor(random() * BAG_VARIANTS.length);
    const chuteIndex = makeHero ? 0 : pickChute();
    const flagged = !makeHero && random() < 0.06;
    const noRead = !makeHero && random() < 0.03;
    const laps = makeHero ? 0 : (() => {
      const draw = random();
      return draw < 0.3 ? 0 : draw < 0.65 ? 1 : 2;
    })();
    const startTime = arrival - source.joinTime;
    const sourcePathOnMain = source.path;
    const plan = {
      id: planNumber,
      hero: makeHero,
      source,
      variant: variantIndex,
      chute: chuteIndex,
      flight: chuteIndex,
      flagged,
      noRead,
      laps,
      tag: makeHero ? '0618 440317' : makeTag(random, chuteIndex),
      weight: Math.round(BAG_VARIANTS[variantIndex].kilograms * (0.85 + random() * 0.3) * 10) / 10,
      t0: startTime,
    };
    // Main-line distances for the shared checkpoints, measured on this source's own path.
    const offsetDistance = sourcePathOnMain.length - world.mainPath.length;
    plan.archTime = startTime + sourcePathOnMain.timeAtDistance(world.archDistance + offsetDistance);
    plan.ctEntryTime = startTime + sourcePathOnMain.timeAtDistance(world.scannerEntryDistance + offsetDistance);
    plan.ctExitTime = startTime + sourcePathOnMain.timeAtDistance(world.scannerExitDistance + offsetDistance);
    plan.paddleTime = startTime + sourcePathOnMain.timeAtDistance(world.paddleDistance + offsetDistance);
    if (flagged) {
      const diverted = sourcePathOnMain.untilDistance(world.paddleDistance + offsetDistance);
      plan.path = Path.join(diverted, world.rejectTail, SPEED.reject);
      plan.tableTime = startTime + plan.path.duration;
      plan.clearedTime = plan.tableTime + SEARCH_SECONDS;
      plan.endTime = plan.clearedTime + 0.4;
      plan.deliveredTime = plan.endTime;
      arrival += 0.9 + random() * 0.5;
      plans.push(plan);
      continue;
    }
    plan.path = sourcePathOnMain;
    plan.beltEndTime = startTime + sourcePathOnMain.duration;
    // Choose the first tray that can carry the bag to its chute without clashing with another bag.
    const chute = world.chutes[chuteIndex];
    const distanceToChute = ((chute.loopDistance - INDUCTION_LOOP_DISTANCE) % loop.length + loop.length) % loop.length + laps * loop.length;
    const candidates = [];
    for (let tray = 0; tray < trayCount; tray += 1) {
      const lapTime = loop.length / SPEED.sorter;
      const firstTime = (INDUCTION_LOOP_DISTANCE - tray * trayPitch) / SPEED.sorter;
      const lapsToWait = Math.ceil((plan.beltEndTime - firstTime) / lapTime);
      for (let extraLap = 0; extraLap < 4; extraLap += 1) {
        candidates.push({ tray, time: firstTime + (lapsToWait + extraLap) * lapTime });
      }
    }
    candidates.sort((first, second) => first.time - second.time);
    let chosen = null;
    for (const candidate of candidates) {
      const centreTime = candidate.time + distanceToChute / SPEED.sorter;
      const tiltStart = centreTime - HEAD_SECONDS;
      const busyUntil = tiltStart + 1.08;
      const clashes = trayBusy[candidate.tray].some(([from, to]) => candidate.time < to + 0.05 && busyUntil > from - 0.05);
      if (!clashes) {
        chosen = { ...candidate, centreTime, tiltStart, busyUntil };
        break;
      }
    }
    plan.tray = chosen.tray;
    plan.transferTime = chosen.time;
    plan.onTrayTime = chosen.time + TRANSFER_SECONDS;
    plan.tiltStart = chosen.tiltStart;
    plan.leaveTime = chosen.tiltStart + HEAD_SECONDS;
    plan.footTime = plan.leaveTime + CHUTE_SECONDS;
    plan.endTime = plan.footTime + 0.3;
    plan.deliveredTime = plan.footTime;
    trayBusy[chosen.tray].push([chosen.time, chosen.busyUntil]);
    trayTilts[chosen.tray].push(chosen.tiltStart);
    const wait = plan.transferTime - plan.beltEndTime;
    arrival += Math.max(0.95 + random() * 0.55, wait + 0.5);
    if (makeHero) {
      heroDone = true;
      plan.hero = true;
    }
    plans.push(plan);
  }
  plans.sort((first, second) => first.t0 - second.t0);
  trayTilts.forEach((list) => list.sort((first, second) => first - second));

  // ---- State --------------------------------------------------------------------------------
  const createPose = () => ({ previous: new Float32Array(POSE_SIZE), current: new Float32Array(POSE_SIZE) });
  const trays = Array.from({ length: trayCount }, createPose);
  const bagEntries = new Map();
  const ambientBags = [];
  const ramp = world.ramp;

  // Make-up carousel bags orbit their belts; loader bags climb the raised boom.
  ramp.carousels.forEach((centre, carouselIndex) => {
    const path = ramp.carouselPath(centre);
    for (let index = 0; index < 7; index += 1) {
      ambientBags.push({
        id: `carousel-${carouselIndex}-${index}`,
        kind: 'carousel',
        variant: (index * 5 + carouselIndex * 2) % BAG_VARIANTS.length,
        path,
        offset: (path.length / 7) * index + carouselIndex * 3,
        ...createPose(),
      });
    }
  });
  const loaderBagCount = 4;
  for (let index = 0; index < loaderBagCount; index += 1) {
    ambientBags.push({ id: `loader-${index}`, kind: 'loader', variant: (index * 2 + 1) % BAG_VARIANTS.length, index, ...createPose() });
  }

  // Tug trains: a tug and two dollies each, spaced on the apron loop.
  const trainLoop = ramp.trainLoop;
  const trainParts = [];
  const trainPartOffsets = [0, -4.0, -8.1];
  for (let train = 0; train < ramp.trainCount; train += 1) {
    trainPartOffsets.forEach((offset, part) => {
      trainParts.push({ train, part, offset, ...createPose() });
    });
  }
  const trainSpeed = 5;
  const trainDwell = 8;
  const stopDistance = ramp.trainStopDistance;
  const driveToStop = stopDistance / trainSpeed;
  const trainCycle = trainLoop.length / trainSpeed + trainDwell;
  // Train 0 reaches the loader at simulation second 82, train 1 half a cycle earlier.
  const trainArrivals = [82, 82 - trainCycle / 2];
  // Distance of the tug along the loop: drives to the loader, waits there, then drives on.
  function leadDistance(train, time) {
    const seconds = (((time - (trainArrivals[train] - driveToStop)) % trainCycle) + trainCycle) % trainCycle;
    if (seconds < driveToStop) return trainSpeed * seconds;
    if (seconds < driveToStop + trainDwell) return stopDistance;
    return stopDistance + trainSpeed * (seconds - driveToStop - trainDwell);
  }

  // Times of ambient (not planned) stage events: the first one strictly after a simulation time.
  function trainArrivalAfter(time) {
    let best = Infinity;
    trainArrivals.forEach((arrival) => {
      const cycles = Math.floor((time - arrival) / trainCycle) + 1;
      best = Math.min(best, arrival + cycles * trainCycle);
    });
    return best;
  }
  function carouselWrapAfter(time, carouselIndex = 0) {
    let best = Infinity;
    ambientBags.filter((entry) => entry.id.startsWith('carousel-' + carouselIndex)).forEach((entry) => {
      const lap = entry.path.length / SPEED.carousel;
      const first = lap - (entry.offset % entry.path.length) / SPEED.carousel;
      const cycles = Math.floor((time - first) / lap) + 1;
      best = Math.min(best, first + cycles * lap);
    });
    return best;
  }
  function loaderEntryAfter(time) {
    // A loader bag slips into the hold when its phase reaches the end of the boom (7.0 s).
    let best = Infinity;
    const cycle = 3.4 * loaderBagCount;
    for (let index = 0; index < loaderBagCount; index += 1) {
      const first = 7.0 - index * 3.4;
      const cycles = Math.floor((time - first) / cycle) + 1;
      best = Math.min(best, first + cycles * cycle);
    }
    return best;
  }

  const signals = {
    scanning: false,
    scanResult: 'clear',
    scanResultAge: 99,
    archPhase: 99,
    archNoRead: false,
    paddleAge: 99,
    craneX: -8,
    craneLift: 0,
    chuteCounts: CHUTE_DEFINITIONS.map(() => 0),
    flightLoaded: FLIGHTS.map((flight, index) => Math.round(flight.expected * (0.42 - index * 0.04))),
    boomRaise: 1,
    doorOpen: 1,
    gantryPhase: 0,
    containerDoor: 0.7,
  };

  const events = [];
  plans.forEach((plan) => {
    events.push({ time: plan.t0, type: 'tag', plan });
    events.push({ time: plan.archTime, type: plan.noRead ? 'noread' : 'read', plan });
    events.push({ time: plan.ctExitTime, type: plan.flagged ? 'alarm' : 'clear', plan });
    if (plan.flagged) {
      events.push({ time: plan.tableTime, type: 'search', plan });
      events.push({ time: plan.clearedTime, type: 'cleared', plan });
    } else {
      events.push({ time: plan.onTrayTime, type: 'sorted', plan });
      events.push({ time: plan.footTime, type: 'loaded', plan });
    }
  });
  events.sort((first, second) => first.time - second.time);

  const state = {
    time: 0,
    accumulator: 0,
    nextEvent: 0,
    nextPlan: 0,
    active: [],
    recentArch: [],
    noReadCount: 0,
    readCount: 0,
    log: [],
    heroPlan: plans.find((plan) => plan.hero),
    // Playback: speed scales how many fixed steps run per frame, never the step length.
    speed: 1,
    paused: false,
    eventTrace: [],
  };

  const scratch = {};

  function setBagPose(pose, x, y, z, yaw, tilt, scale) {
    pose[X] = x;
    pose[Y] = y;
    pose[Z] = z;
    pose[YAW] = yaw;
    pose[TILT] = tilt;
    pose[SCALE] = scale;
    pose[6] = 0;
  }

  function trayDistance(tray, time) {
    return tray * trayPitch + SPEED.sorter * time;
  }

  // Writes the pose of a planned bag at a time into out; returns false when it is not shown.
  function evaluatePlan(plan, time, out) {
    if (time < plan.t0 || time > plan.endTime) return false;
    if (plan.flagged) {
      if (time >= plan.clearedTime) {
        const shrink = 1 - (time - plan.clearedTime) / 0.4;
        const last = plan.path.sample(plan.path.length, scratch);
        setBagPose(out, last.x, last.y, last.z, last.yaw, 0, Math.max(0.01, shrink));
        return true;
      }
      const sampled = plan.path.sample(plan.path.distanceAtTime(time - plan.t0), scratch);
      setBagPose(out, sampled.x, sampled.y, sampled.z, sampled.yaw, 0, 1);
      return true;
    }
    if (time < plan.beltEndTime) {
      const sampled = plan.path.sample(plan.path.distanceAtTime(time - plan.t0), scratch);
      setBagPose(out, sampled.x, sampled.y, sampled.z, sampled.yaw, 0, 1);
      return true;
    }
    if (time < plan.transferTime) {
      setBagPose(out, beltEnd[0], beltEnd[1], beltEnd[2], Math.PI / 2, 0, 1);
      return true;
    }
    const trayPose = loopPose(loop, trayDistance(plan.tray, time), scratch);
    if (time < plan.onTrayTime) {
      const fraction = smoothstep((time - plan.transferTime) / TRANSFER_SECONDS);
      const x = beltEnd[0] + (trayPose.x - beltEnd[0]) * fraction;
      const z = beltEnd[2] + (trayPose.z - beltEnd[2]) * fraction;
      const y = beltEnd[1] + (TRAY_DECK_HEIGHT - beltEnd[1]) * fraction;
      setBagPose(out, x, y, z, blendAngle(Math.PI / 2, trayPose.yaw, fraction), 0, 1);
      return true;
    }
    const sinceTilt = time - plan.tiltStart;
    if (time < plan.leaveTime) {
      const angle = tiltAngle(sinceTilt);
      const slide = sinceTilt > SLIDE_START ? 0.5 * SLIDE_ACCELERATION * (sinceTilt - SLIDE_START) ** 2 : 0;
      const localY = TRAY_PIVOT_HEIGHT + 0.15 * Math.cos(angle) - slide * Math.sin(angle);
      const localZ = 0.15 * Math.sin(angle) + slide * Math.cos(angle);
      setBagPose(
        out,
        trayPose.x + localZ * Math.sin(trayPose.yaw),
        localY,
        trayPose.z + localZ * Math.cos(trayPose.yaw),
        trayPose.yaw,
        angle,
        1,
      );
      return true;
    }
    // On the chute: slide down from the tray edge, drifting to rest across the track.
    const chute = world.chutes[plan.chute];
    const seconds = time - plan.leaveTime;
    const headTray = loopPose(loop, trayDistance(plan.tray, plan.leaveTime), {});
    const along = Math.min(1, seconds / CHUTE_SECONDS);
    const distance = CHUTE_LENGTH * along * along;
    const drift = SPEED.sorter * 0.1 * (1 - Math.exp(-seconds / 0.1));
    const slideStart = SLIDE_EDGE + 0.1;
    const startX = headTray.x + slideStart * chute.normalX;
    const startZ = headTray.z + slideStart * chute.normalZ;
    const travelX = Math.cos(chute.trackYaw) * drift;
    const travelZ = -Math.sin(chute.trackYaw) * drift;
    const height = 0.8 - (0.8 - 0.14) * (distance / CHUTE_LENGTH);
    const shrink = time > plan.footTime ? Math.max(0.01, 1 - (time - plan.footTime) / 0.3) : 1;
    setBagPose(
      out,
      startX + travelX + chute.normalX * distance,
      height,
      startZ + travelZ + chute.normalZ * distance,
      chute.trackYaw,
      CHUTE_SLOPE,
      shrink,
    );
    return true;
  }

  function evaluateAmbient(entry, time, out) {
    if (entry.kind === 'carousel') {
      const distance = (entry.offset + SPEED.carousel * time) % entry.path.length;
      const sampled = entry.path.sample(distance, scratch);
      setBagPose(out, sampled.x, sampled.y, sampled.z, sampled.yaw, 0, 1);
      return;
    }
    // Loader bags: a bag every 3.4 s rides the raised boom and slips into the hold.
    const period = 3.4;
    const travel = 7.0;
    const phase = (((time + entry.index * period) % (period * loaderBagCount)) + period * loaderBagCount) % (period * loaderBagCount);
    const loader = ramp.loader;
    if (phase > travel + 0.3) {
      setBagPose(out, loader.x, -5, loader.z, 0, 0, 0.01);
      return;
    }
    const along = 0.3 + Math.min(1, phase / travel) * 4.1;
    const raise = ramp.boomAngle ?? 0.3;
    const boomY = 1.3 + along * Math.sin(raise) + 0.04;
    const reach = 0.3 + along * Math.cos(raise);
    const grow = Math.min(1, phase / 0.35);
    const shrink = phase > travel ? Math.max(0.01, 1 - (phase - travel) / 0.3) : 1;
    setBagPose(out, loader.x + reach, boomY, loader.z, Math.PI / 2, 0, Math.min(grow, shrink));
    out[6] = raise;
  }

  function stepOnce() {
    const time = state.time + FIXED_STEP;
    state.time = time;

    // Previous becomes current, then the new current pose is written.
    for (const pose of trays) pose.previous.set(pose.current);
    for (let tray = 0; tray < trayCount; tray += 1) {
      const trayPose = loopPose(loop, trayDistance(tray, time), scratch);
      let tilt = 0;
      for (const start of trayTilts[tray]) {
        if (start > time) break;
        if (time - start < 1.08) tilt = tiltAngle(time - start);
      }
      setBagPose(trays[tray].current, trayPose.x, 0, trayPose.z, trayPose.yaw, tilt, 1);
    }

    while (state.nextPlan < plans.length && plans[state.nextPlan].t0 <= time) {
      const plan = plans[state.nextPlan];
      state.nextPlan += 1;
      if (plan.endTime >= time) state.active.push(plan);
    }
    for (let index = state.active.length - 1; index >= 0; index -= 1) {
      const plan = state.active[index];
      let entry = bagEntries.get(plan.id);
      if (!entry) {
        entry = { id: plan.id, kind: 'planned', plan, variant: plan.variant, ...createPose(), fresh: true };
        bagEntries.set(plan.id, entry);
      }
      entry.previous.set(entry.current);
      const shown = evaluatePlan(plan, time, entry.current);
      if (entry.fresh) {
        entry.previous.set(entry.current);
        entry.fresh = false;
      }
      if (!shown || time > plan.endTime) {
        bagEntries.delete(plan.id);
        state.active.splice(index, 1);
        entry.removed = true;
      }
    }
    for (const entry of ambientBags) {
      entry.previous.set(entry.current);
      evaluateAmbient(entry, time, entry.current);
      if (!entry.initialised) {
        entry.previous.set(entry.current);
        entry.initialised = true;
      }
    }
    for (const part of trainParts) {
      part.previous.set(part.current);
      const distance = (leadDistance(part.train, time) + part.offset + trainLoop.length * 4) % trainLoop.length;
      const sampled = trainLoop.sample(distance, scratch);
      setBagPose(part.current, sampled.x, 0.25 * 0, sampled.z, sampled.yaw, (trainSpeed * time) / 0.3, 1);
      if (!part.initialised) {
        part.previous.set(part.current);
        part.initialised = true;
      }
    }

    // Events (statistics, log) up to now.
    while (state.nextEvent < events.length && events[state.nextEvent].time <= time) {
      const event = events[state.nextEvent];
      state.nextEvent += 1;
      if (state.eventTrace.length < EVENT_TRACE_LIMIT) state.eventTrace.push({ time: event.time, type: event.type, planId: event.plan.id });
      applyEvent(event);
    }

    // Machine signals.
    let scanning = false;
    let lastExit = -1e9;
    let lastExitFlagged = false;
    let lastPaddle = -1e9;
    let lastArch = -1e9;
    let lastArchNoRead = false;
    for (const plan of state.active) {
      if (plan.ctEntryTime <= time && time <= plan.ctExitTime) scanning = true;
      if (plan.ctExitTime <= time && plan.ctExitTime > lastExit) {
        lastExit = plan.ctExitTime;
        lastExitFlagged = plan.flagged;
      }
      if (plan.flagged && plan.paddleTime - 0.5 <= time && plan.paddleTime > lastPaddle - 0.5) lastPaddle = plan.paddleTime - 0.5;
      if (plan.archTime <= time && plan.archTime > lastArch) {
        lastArch = plan.archTime;
        lastArchNoRead = plan.noRead;
      }
    }
    signals.scanning = scanning;
    signals.scanResult = lastExitFlagged ? 'alarm' : 'clear';
    signals.scanResultAge = time - lastExit;
    signals.paddleAge = time - lastPaddle;
    signals.archPhase = time - lastArch;
    signals.archNoRead = lastArchNoRead;
    signals.gantryPhase = scanning ? (time % 2.04) / 2.04 : signals.gantryPhase;
    const bayCount = world.storeBays.length;
    const cycle = 14;
    const craneStage = (time % (cycle * bayCount)) / cycle;
    const targetBay = Math.floor(craneStage);
    const withinStage = craneStage - targetBay;
    const bayX = world.storeBays[targetBay];
    const previousBayX = world.storeBays[(targetBay + bayCount - 1) % bayCount];
    const travel = smoothstep(withinStage / 0.35);
    signals.craneX = previousBayX + (bayX - previousBayX) * travel;
    signals.craneLift = withinStage < 0.4 ? 0 : withinStage < 0.55 ? smoothstep((withinStage - 0.4) / 0.15) : withinStage < 0.8 ? 1 : 1 - smoothstep((withinStage - 0.8) / 0.2);
  }

  function applyEvent(event) {
    const { plan, type, time } = event;
    if (type === 'read' || type === 'noread') {
      state.recentArch.push({ time, noRead: type === 'noread' });
      if (type === 'noread') {
        state.noReadCount += 1;
        pushLog(time, 'warning', `Arch 1 could not read tag ${plan.tag}`, plan);
      } else {
        state.readCount += 1;
      }
      while (state.recentArch.length && state.recentArch[0].time < time - 180) state.recentArch.shift();
    } else if (type === 'alarm') {
      pushLog(time, 'alarm', `Scanner 1 alarm on ${plan.tag}, sent to manual search`, plan);
    } else if (type === 'loaded') {
      signals.chuteCounts[plan.chute] += 1;
      signals.flightLoaded[plan.flight] += 1;
    } else if (type === 'cleared') {
      pushLog(time, 'ok', `Search room cleared ${plan.tag}`, plan);
    }
  }

  function pushLog(time, level, text, plan) {
    state.log.push({ time, level, text, bagId: plan?.id });
    if (state.log.length > 60) state.log.shift();
  }

  // Real seconds in; the accumulator holds simulated seconds, so a fractional speed carries over between frames.
  function advance(deltaSeconds) {
    if (state.paused) return;
    state.accumulator += deltaSeconds * state.speed;
    let steps = 0;
    while (state.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      state.accumulator -= FIXED_STEP;
      stepOnce();
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) state.accumulator = 0;
  }

  // Advances exactly one fixed step (used while paused); the pose shown is the new one.
  function stepForward() {
    stepOnce();
    state.accumulator = FIXED_STEP * 0.9999;
  }

  function jumpTo(seconds) {
    while (state.time < seconds) stepOnce();
    state.accumulator = 0;
  }

  // Status of a planned bag at a time, for the dashboard.
  function bagStatus(plan, time) {
    if (plan.flagged) {
      if (time >= plan.clearedTime) return 'screened';
      if (time >= plan.tableTime) return 'searching';
      if (time >= plan.ctExitTime) return 'alarm';
      return time >= plan.archTime ? 'checked' : 'checked';
    }
    if (time >= plan.footTime) return 'loaded';
    if (time >= plan.onTrayTime) return 'sorted';
    if (time >= plan.ctExitTime) return 'screened';
    return 'checked';
  }

  function timelineStage(plan, time) {
    const marks = plan.flagged
      ? [plan.t0, plan.archTime, plan.ctExitTime, plan.tableTime, plan.clearedTime, plan.clearedTime, plan.clearedTime]
      : [plan.t0, plan.archTime, plan.ctExitTime, plan.onTrayTime, plan.leaveTime, plan.footTime, plan.endTime];
    let stage = -1;
    marks.forEach((mark, index) => {
      if (time >= mark) stage = index;
    });
    return { stage, marks };
  }

  return {
    world,
    plans,
    trays,
    trayCount,
    ambientBags,
    trainParts,
    signals,
    state,
    advance,
    stepForward,
    jumpTo,
    trainArrivalAfter,
    carouselWrapAfter,
    loaderEntryAfter,
    bagStatus,
    timelineStage,
    heroPlan: state.heroPlan,
    get time() {
      return state.time;
    },
    get alpha() {
      return state.accumulator / FIXED_STEP;
    },
    get activeEntries() {
      return state.active.map((plan) => bagEntries.get(plan.id)).filter(Boolean);
    },
    entryFor: (planId) => bagEntries.get(planId),
    planById: (planId) => plans.find((plan) => plan.id === planId),
    evaluatePlan,
    flights: FLIGHTS,
  };
}
