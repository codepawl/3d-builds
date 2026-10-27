// The nine stages of a bag's journey: one camera preset each, and the event that marks the stage as seen.
// Camera views use the rig convention: azimuth 0 looks north from the south side, positive azimuth moves the camera east.

let collectorOffsetCache = null;

function collectorEventTime(sim, plan) {
  if (plan.collectorTime === undefined) {
    if (collectorOffsetCache === null) collectorOffsetCache = sim.world.mainPath.distanceNearest(-25.5, 22.5);
    const offsetDistance = plan.path.length - sim.world.mainPath.length;
    plan.collectorTime = plan.t0 + plan.path.timeAtDistance(collectorOffsetCache + offsetDistance);
  }
  return plan.collectorTime;
}

// The first event time strictly after a time, over every planned bag that matches the filter.
function firstPlanEvent(sim, after, getTime, accepts = () => true) {
  let best = Infinity;
  for (const plan of sim.plans) {
    if (!accepts(plan)) continue;
    const time = getTime(plan);
    if (Number.isFinite(time) && time > after && time < best) best = time;
  }
  return best;
}

// The camera stage (index into STAGES) a planned bag is in at a time, and when that stage began.
export function bagStageAt(plan, time) {
  const starts = plan.flagged
    ? [plan.t0, plan.t0 + 3, plan.archTime, plan.ctEntryTime]
    : [plan.t0, plan.t0 + 3, plan.archTime, plan.ctEntryTime, plan.onTrayTime, plan.leaveTime, plan.footTime];
  let index = 0;
  starts.forEach((start, candidate) => {
    if (time >= start) index = candidate;
  });
  return { index, since: Math.max(0, time - starts[index]) };
}

export const STAGES = [
  {
    key: 1,
    id: 'desk',
    name: 'Check-in desk',
    short: 'Desk',
    does: 'Bag tagged, onto the belt',
    unitId: 'desk-2',
    view: { target: [-34, 1.9, 5.2], distance: 13, azimuth: 0.75, elevation: 0.5 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => plan.t0, (plan) => plan.source.kind === 'desk' && plan.source.index <= 1),
  },
  {
    key: 2,
    id: 'collector',
    name: 'Collector belt',
    short: 'Collector',
    does: 'Down the decline to the hall',
    unitId: null,
    view: { target: [-29.5, 1.2, 21], distance: 15, azimuth: 0.55, elevation: 0.45 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => collectorEventTime(sim, plan)),
  },
  {
    key: 3,
    id: 'arch',
    name: 'Read arch',
    short: 'Read arch',
    does: 'Tag read at the arch',
    unitId: 'arch-1',
    view: { target: [5, 1.5, 22.5], distance: 11, azimuth: 0.35, elevation: 0.36 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => plan.archTime),
  },
  {
    key: 4,
    id: 'ct',
    name: 'CT scan',
    short: 'CT scan',
    does: 'Clear, or alarm and on to the search room',
    unitId: 'ct-1',
    view: { target: [8.5, 1.4, 17.6], distance: 14, azimuth: 0.9, elevation: 0.4 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => plan.ctExitTime),
  },
  {
    key: 5,
    id: 'tray',
    name: 'Tilt tray',
    short: 'Tray',
    does: 'Onto a tilt tray',
    unitId: null,
    view: { target: [8, 1.1, 12.2], distance: 9, azimuth: 0.9, elevation: 0.38 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => plan.onTrayTime),
  },
  {
    key: 6,
    id: 'chute',
    name: 'Chute',
    short: 'Chute',
    does: 'Tray tips into its chute',
    unitId: 'chute-C1',
    view: { target: [17, 0.9, 13.4], distance: 11, azimuth: 0.85, elevation: 0.4 },
    eventAfter: (sim, after) => firstPlanEvent(sim, after, (plan) => plan.leaveTime, (plan) => !plan.flagged && plan.chute <= 1),
  },
  {
    key: 7,
    id: 'makeup',
    name: 'Make-up carousel',
    short: 'Make-up',
    does: 'Carousel and cart',
    unitId: 'carousel-1',
    view: { target: [73, 0.9, 0.2], distance: 24, azimuth: 0.35, elevation: 0.5 },
    eventAfter: (sim, after) => sim.carouselWrapAfter(after, 0),
  },
  {
    key: 8,
    id: 'tug',
    name: 'Tug train',
    short: 'Tug train',
    does: 'Train to the aircraft',
    unitId: 'tug-1',
    view: { target: [72, 1, 23], distance: 27, azimuth: -1.1, elevation: 0.35 },
    eventAfter: (sim, after) => sim.trainArrivalAfter(after),
  },
  {
    key: 9,
    id: 'loader',
    name: 'Belt loader',
    short: 'Loader',
    does: 'Belt loader into the hold',
    unitId: 'loader-1',
    view: { target: [85, 2.8, 26], distance: 16, azimuth: -2.6, elevation: 0.2 },
    eventAfter: (sim, after) => sim.loaderEntryAfter(after),
  },
];
