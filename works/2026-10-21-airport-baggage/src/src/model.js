import { SITE_OFFSET_RAMP } from './sim/layout.js';
import { BAG_VARIANTS, FLIGHTS } from './sim/simulation.js';

// Sites, units and the text that describes them. The 3D view and the dashboard both read from here.
export const SITES = [
  {
    id: 'hall',
    name: 'Screening and sorter hall',
    short: 'Sorter hall',
    view: { target: [12.5, 0.6, 13.5], distance: 38, azimuth: 0.42, elevation: 0.72 },
  },
  {
    id: 'checkin',
    name: 'Check-in hall',
    short: 'Check-in',
    view: { target: [-36, 1.8, 9.5], distance: 31, azimuth: 0.5, elevation: 0.72 },
  },
  {
    id: 'ramp',
    name: 'Make-up and ramp',
    short: 'Make-up and ramp',
    view: { target: [SITE_OFFSET_RAMP - 8, 1.6, 23], distance: 24, azimuth: -0.95, elevation: 0.36 },
  },
];

export function siteOfPosition(x) {
  if (x < -31) return 'checkin';
  if (x > SITE_OFFSET_RAMP - 40) return 'ramp';
  return 'hall';
}

const UNIT_TITLES = {
  'ct-1': ['Hold baggage scanner 1', 'CT, level 2 screening'],
  'arch-1': ['Read arch 1', 'Barcode and RFID tag reader'],
  'diverter-1': ['Reject diverter 1', 'Sends alarm bags to the search room'],
  'search-room': ['Manual search room', 'Level 3 image review and hand search'],
  'store-crane': ['Early bag store crane', 'Holds bags that arrive hours before departure'],
  'loader-1': ['Belt loader 1', 'Carries bags up to the aircraft hold'],
  'aircraft-1': ['Narrowbody, stand 14', 'Hold door open, loading'],
};

export function unitPins(siteId) {
  const pins = {
    hall: [
      { unitId: 'ct-1', label: 'Scanner 1', icon: 'scan' },
      { unitId: 'arch-1', label: 'Read arch', icon: 'tag' },
      { unitId: 'search-room', label: 'Search room', icon: 'search' },
      { unitId: 'chute-C1', label: 'Chute C1', icon: 'box' },
      { unitId: 'chute-C4', label: 'Chute C4', icon: 'box' },
    ],
    checkin: [
      { unitId: 'desk-1', label: 'Desk 1', icon: 'tag' },
      { unitId: 'desk-3', label: 'Desk 3', icon: 'tag' },
      { unitId: 'arch-1', label: 'Read arch', icon: 'tag' },
    ],
    ramp: [
      { unitId: 'loader-1', label: 'Belt loader', icon: 'arrow' },
      { unitId: 'carousel-1', label: 'Carousel 1', icon: 'orbit' },
      { unitId: 'tug-1', label: 'Tug 1', icon: 'arrow' },
      { unitId: 'aircraft-1', label: 'Stand 14', icon: 'plane' },
    ],
  };
  return pins[siteId];
}

export function formatClock(seconds) {
  const whole = Math.floor(seconds) % 86400;
  const hours = String(Math.floor(whole / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const rest = String(whole % 60).padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
}

const STATUS_LABEL = {
  checked: 'Checked in',
  screened: 'Screened',
  sorted: 'On the sorter',
  loaded: 'In the container',
  alarm: 'Scanner alarm',
  searching: 'In manual search',
  stored: 'In early store',
  missing: 'Missing',
};

export function statusLabel(status) {
  return STATUS_LABEL[status] ?? status;
}

export const TIMELINE_STEPS = ['Tag', 'Read', 'Screen', 'Sort', 'Make-up', 'Container', 'Loaded'];

export function describeBag(simulation, plan, time) {
  const flight = FLIGHTS[plan.flight];
  const status = simulation.bagStatus(plan, time);
  const { stage, marks } = simulation.timelineStage(plan, time);
  const next = marks[Math.min(marks.length - 1, stage + 1)];
  const current = marks[Math.max(0, stage)];
  const withinStage = next > current ? Math.min(1, (time - current) / (next - current)) : 1;
  const progress = Math.min(1, Math.max(0, (Math.max(stage, 0) + withinStage) / (marks.length - 1)));
  const entry = simulation.entryFor(plan.id);
  const x = entry ? entry.current[0] : 0;
  let where = 'Collector belt';
  if (time >= plan.footTime && !plan.flagged) where = `Chute ${simulation.world.chutes[plan.chute].id}`;
  else if (time >= plan.leaveTime && !plan.flagged) where = `Chute ${simulation.world.chutes[plan.chute].id}`;
  else if (time >= plan.onTrayTime && !plan.flagged) where = 'Tilt-tray sorter';
  else if (plan.flagged && time >= plan.tableTime) where = 'Search room';
  else if (time >= plan.ctExitTime) where = 'Induction belt';
  else if (time >= plan.ctEntryTime) where = 'Scanner 1';
  else if (time >= plan.archTime) where = 'Main line';
  else if (x > -25) where = 'Main line';
  else if (x > -31) where = 'Decline belt';
  else if (time >= plan.t0 + 3) where = 'Collector belt';
  else where = plan.source.kind === 'store' ? 'Early bag store' : `Check-in desk ${plan.source.index + 1}`;
  return {
    title: plan.hero ? `Bag ${plan.tag}` : `Bag ${plan.tag}`,
    subtitle: `${flight.code} to ${flight.destination}`,
    status,
    statusText: statusLabel(status),
    fields: [
      ['Tag', plan.tag],
      ['Flight', `${flight.code}  gate ${flight.gate}`],
      ['Destination', flight.destination],
      ['Weight', `${plan.weight.toFixed(1)} kg`],
      ['Type', BAG_VARIANTS[plan.variant].node.replace('bag_', '').replace('_', ' ')],
      ['Location', where],
      ['Target chute', plan.flagged ? 'Held for search' : simulation.world.chutes[plan.chute].id],
    ],
    progress,
    progressLabel: TIMELINE_STEPS[Math.max(0, Math.min(stage, TIMELINE_STEPS.length - 1))],
    stage,
    marks,
  };
}

export function describeUnit(simulation, unitId) {
  const signals = simulation.signals;
  const world = simulation.world;
  if (unitId === 'ct-1') {
    return {
      title: UNIT_TITLES[unitId][0],
      subtitle: UNIT_TITLES[unitId][1],
      status: signals.scanning ? 'scanning' : 'idle',
      statusText: signals.scanning ? 'Scanning a bag' : 'Ready',
      fields: [
        ['Throughput', '1,180 bags per hour'],
        ['Belt speed', '2.4 m/s (demo)'],
        ['Last result', signals.scanResult === 'alarm' ? 'Alarm, sent to search' : 'Clear'],
        ['Alarm rate', '5.6 percent'],
        ['Standard', 'Hold baggage level 2'],
      ],
      progress: signals.scanning ? 0.6 : 0,
      progressLabel: 'Scan',
    };
  }
  if (unitId === 'arch-1') {
    const attempts = simulation.state.readCount + simulation.state.noReadCount;
    const rate = attempts ? (simulation.state.readCount / attempts) * 100 : 100;
    return {
      title: UNIT_TITLES[unitId][0],
      subtitle: UNIT_TITLES[unitId][1],
      status: 'ok',
      statusText: 'Reading',
      fields: [
        ['Reads', String(simulation.state.readCount)],
        ['No reads', String(simulation.state.noReadCount)],
        ['Read rate', `${rate.toFixed(1)} percent`],
        ['Standard', 'IATA bag tag, ATR and RFID'],
      ],
      progress: rate / 100,
      progressLabel: 'Read rate',
    };
  }
  if (unitId.startsWith('chute-')) {
    const index = world.chutes.findIndex((chute) => `chute-${chute.id}` === unitId);
    const chute = world.chutes[index];
    const flight = FLIGHTS[index];
    const loaded = signals.flightLoaded[index];
    return {
      title: `Chute ${chute.id}`,
      subtitle: `${flight.code} to ${flight.destination}`,
      status: index === 6 ? 'closed' : 'open',
      statusText: index === 6 ? 'Closed' : 'Open',
      fields: [
        ['Flight', `${flight.code}  gate ${flight.gate}`],
        ['Bags loaded', `${loaded} of ${flight.expected}`],
        ['Since opening', String(signals.chuteCounts[index])],
        ['Departs in', `${flight.departsInMinutes} min`],
      ],
      progress: Math.min(1, loaded / flight.expected),
      progressLabel: 'Loaded',
    };
  }
  if (unitId.startsWith('tray-')) {
    return {
      title: `Tray ${unitId.slice(5)}`,
      subtitle: 'Tilt-tray carriage',
      status: 'moving',
      statusText: 'Moving',
      fields: [['Speed', '3.4 m/s (demo)'], ['Pitch', '1.32 m'], ['Tilt', 'Left or right, 30 degrees']],
      progress: 0.5,
      progressLabel: 'Lap',
    };
  }
  if (unitId.startsWith('tug-')) {
    return {
      title: `Tug ${unitId.slice(4)}`,
      subtitle: 'Pulling a container dolly and a bag dolly',
      status: 'moving',
      statusText: 'Driving to stand 14',
      fields: [['Speed', '18 km/h'], ['Load', '1 container, 14 loose bags'], ['Destination', 'Stand 14']],
      progress: 0.4,
      progressLabel: 'Trip',
    };
  }
  if (unitId.startsWith('desk-')) {
    return {
      title: `Check-in desk ${unitId.slice(5)}`,
      subtitle: 'Weighs, tags and sends bags to the collector',
      status: 'ok',
      statusText: 'Open',
      fields: [['Bags today', String(180 + Number(unitId.slice(5)) * 23)], ['Tag printer', 'Ready'], ['Belt speed', '1.0 m/s']],
      progress: 0.55,
      progressLabel: 'Queue',
    };
  }
  if (unitId.startsWith('carousel-')) {
    return {
      title: `Make-up carousel ${unitId.slice(9)}`,
      subtitle: unitId.endsWith('1') ? FLIGHTS[0].code + ' to ' + FLIGHTS[0].destination : FLIGHTS[1].code + ' to ' + FLIGHTS[1].destination,
      status: 'ok',
      statusText: 'Open',
      fields: [['Bags on belt', '7'], ['Containers', '2 of 3 loaded'], ['Belt speed', '0.8 m/s']],
      progress: 0.66,
      progressLabel: 'Loaded',
    };
  }
  if (unitId.startsWith('uld-')) {
    return {
      title: `Container ${unitId.slice(4)}`,
      subtitle: 'LD3 unit load device',
      status: 'ok',
      statusText: 'Loading',
      fields: [['Capacity', '4.5 cubic metres'], ['Bags inside', String(18 + Number(unitId.slice(4)) * 6)], ['Net', '1,588 kg max']],
      progress: 0.5,
      progressLabel: 'Filled',
    };
  }
  const titles = UNIT_TITLES[unitId] ?? [unitId, ''];
  return {
    title: titles[0],
    subtitle: titles[1],
    status: 'ok',
    statusText: 'Running',
    fields: [['State', 'Normal'], ['Bags handled', String(simulation.state.readCount)]],
    progress: 0.5,
    progressLabel: 'Load',
  };
}

export function computeKpis(simulation) {
  const recent = simulation.state.recentArch;
  const now = simulation.time;
  const window = 120;
  const inWindow = recent.filter((read) => read.time > now - window);
  const perHour = Math.round(((inWindow.length / window) * 3600) / 10) * 10;
  const noReads = inWindow.filter((read) => read.noRead).length;
  const readRate = inWindow.length ? ((inWindow.length - noReads) / inWindow.length) * 100 : 100;
  const next = FLIGHTS[0];
  const loaded = simulation.signals.flightLoaded[0];
  return [
    { id: 'rate', label: 'Bags per hour', value: perHour.toLocaleString('en-US'), delta: '+4.2%', trend: 'up' },
    { id: 'read', label: 'Sort read rate', value: `${readRate.toFixed(1)}%`, delta: noReads ? `${noReads} no read` : 'all read', trend: noReads ? 'down' : 'up' },
    { id: 'loaded', label: `${next.code} loaded`, value: `${loaded} of ${next.expected}`, delta: `departs in ${next.departsInMinutes} min`, trend: 'flat' },
    { id: 'mishandled', label: 'Mishandled per 1,000', value: (3.6 + Math.sin(now / 90) * 0.2).toFixed(1), delta: '-0.3', trend: 'down-good' },
  ];
}
