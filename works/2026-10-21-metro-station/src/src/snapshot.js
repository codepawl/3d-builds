import { lines, stations, lineById, stationById, siteById } from './data/network.js'

const CAPACITY = 1500
const toKmh = (speed) => Math.round(speed * 3.6)

function nextStopFor(simulation, train) {
  const line = lineById[train.lineId]
  const next = simulation.nextStation(train, line)
  if (!next.station) return { name: 'End of line', eta: null }
  const eta = next.distance / Math.max(train.speed, 6)
  return { name: next.station.name, eta: Math.round(eta), distance: Math.round(next.distance) }
}

// Doors read from the same value that drives the door animation: open once past half travel, then the direction of travel.
function doorLabel(train) {
  if (train.doorOpen > 0.5) return 'Open'
  if (train.doorOpen > 0.02) return train.doorTarget > 0 ? 'Opening' : 'Closing'
  return 'Closed'
}

function trainRow(simulation, train) {
  const line = lineById[train.lineId]
  const status = simulation.trainStatus(train)
  const next = train.ghost ? { name: 'Depot', eta: null } : nextStopFor(simulation, train)
  const { gap } = train.ghost ? { gap: Infinity } : simulation.leaderGap(train, line)
  return {
    kind: 'train',
    id: train.id,
    lineId: train.lineId,
    lineName: line.name,
    color: line.color,
    siteId: line.siteId,
    status,
    speed: toKmh(train.speed),
    load: train.load,
    delay: Math.round(train.delay),
    next: next.name,
    eta: next.eta,
    gap: Number.isFinite(gap) ? Math.max(0, Math.round(gap)) : null,
    authority: Math.round(train.authority),
    doors: doorLabel(train),
    holdReason: train.holdReason,
    dwellProgress: train.state === 'dwell' ? train.dwellTotal - train.dwellTimer : 0,
    atStation: train.atStationId ? stationById[train.atStationId].name : null,
    stageKey: train.stageKey ?? null,
    stageSeconds: Math.max(0, Math.round(simulation.time - (train.stageSince ?? simulation.time))),
  }
}

// Card wording for the train stages the stage bar also lists (null between stations).
const TRAIN_STAGE_LABELS = {
  doors: '3 Arrives, doors open',
  boarding: '4 Boarding, doors close',
  departs: '5 Departs into the tunnel',
  turnback: '6 Turnback',
  depot: 'In the depot',
}

function stationRow(simulation, station) {
  const state = simulation.stationStates[station.id]
  const line = lineById[station.lineId]
  const arriving = simulation.trains
    .filter((train) => train.lineId === station.lineId && !train.ghost)
    .map((train) => ({ train, distance: (station.s - train.s) * train.dir }))
    .filter((entry) => entry.distance > 0)
    .sort((a, b) => a.distance - b.distance)[0]
  return {
    kind: 'station',
    id: station.id,
    name: station.name,
    lineId: station.lineId,
    lineName: line.name,
    color: line.color,
    siteId: line.siteId,
    interchange: station.interchange,
    terminal: station.terminal,
    waiting: Math.round(state.waiting),
    entries: state.entriesPerMinute,
    crowding: state.crowding,
    headway: state.lastHeadway === null ? null : Math.round(state.lastHeadway),
    nextTrain: arriving ? { id: arriving.train.id, eta: Math.round(arriving.distance / 10) } : null,
  }
}

// The bottom timeline follows the selected (or followed) train; with none it follows the first train of the site's line.
// The depot site keeps the scripted depot-to-line journey of H-01.
function timelineFor(simulation, site, focusTrainId) {
  if (site.id === 'depot') {
    const scripted = simulation.trains.find((train) => train.id === simulation.timelineTrainId)
    return {
      trainId: simulation.timelineTrainId,
      subtitle: 'from depot to its first full loop',
      status: scripted ? simulation.trainStatus(scripted) : 'depot',
      steps: simulation.timelineSteps.map((step) => ({ ...step })),
    }
  }
  const onSite = (train) => !train.ghost && site.lineIds.includes(train.lineId)
  const focused = simulation.trains.find((train) => train.id === focusTrainId && onSite(train))
  const train = focused ?? simulation.trains.find((candidate) => candidate.lineId === site.primaryLine && !candidate.ghost)
  if (!train) return { trainId: '-', subtitle: '', status: 'depot', steps: [] }
  const line = lineById[train.lineId]
  const ordered = simulation.lineStations(train.lineId)
  if (train.dir < 0) ordered.reverse()
  const heading = train.atStationId ?? simulation.nextStation(train, line).station?.id
  const headingIndex = Math.max(0, ordered.findIndex((station) => station.id === heading))
  // A loop shows the stop just passed and the ones ahead; a linear line shows every stop in travel order.
  const sequence = line.kind === 'loop'
    ? ordered.map((_, offset) => ordered[(headingIndex - 1 + offset + ordered.length) % ordered.length])
    : ordered
  const activePosition = line.kind === 'loop' ? 1 : headingIndex
  const steps = sequence.map((station, position) => {
    const isActive = position === activePosition
    const isDone = position < activePosition
    const stoppedAt = train.stopLog?.[station.id] ?? null
    const arrived = isActive && train.state !== 'run' && train.state !== 'overrun'
    return {
      id: `stop-${station.id}`,
      label: station.name,
      detail: station.interchange ? 'Interchange' : station.terminal ? 'Terminus' : isActive ? 'Arriving' : 'Station stop',
      status: isActive ? 'active' : isDone ? 'done' : 'next',
      at: isDone || arrived ? stoppedAt : null,
    }
  })
  const lastStation = ordered[ordered.length - 1]
  return {
    trainId: train.id,
    subtitle: line.kind === 'loop' ? `${line.name}, clockwise` : `${line.name} towards ${lastStation.name}`,
    status: simulation.trainStatus(train),
    steps,
  }
}

export function buildSnapshot(simulation, siteId, focusTrainId = null) {
  const site = siteById[siteId]
  const siteLineIds = site.lineIds
  const serviceRows = simulation.trains
    .filter((train) => siteLineIds.includes(train.lineId))
    .map((train) => trainRow(simulation, train))
  const depotRows = simulation.depot.trains.map((train) => ({
    kind: 'train',
    id: train.id,
    lineId: 'D',
    lineName: 'Depot',
    color: '#16b8a6',
    siteId: 'depot',
    status: train.stage === 'maintenance' ? 'maintenance' : train.stage === 'stored' ? 'depot' : 'running',
    speed: toKmh(train.speed),
    load: 0,
    delay: 0,
    next: train.stage === 'departing' ? 'Wash plant' : train.stage === 'gone' ? 'On the line' : simulation.depot.slots[train.slotIndex].id,
    eta: null,
    gap: null,
    authority: 0,
    doors: 'Closed',
    holdReason: '',
    atStation: null,
    stage: train.stage,
  }))
  const stationRows = stations
    .filter((station) => siteLineIds.includes(station.lineId))
    .map((station) => stationRow(simulation, station))
  const incidents = simulation.incidents.slice(0, 12).map((incident) => ({
    ...incident,
    age: Math.round(simulation.time - incident.startedAt),
    open: incident.resolvedAt === null,
  }))
  const tasks = simulation.depot.trains
    .filter((train) => train.task)
    .map((train) => ({
      id: train.task.id,
      title: train.task.title,
      trainId: train.id,
      progress: train.task.progress,
      slot: simulation.depot.slots[train.slotIndex].id,
    }))
  return {
    time: simulation.time,
    clock: simulation.clockText(),
    kpis: simulation.kpis(siteId),
    trains: site.id === 'depot' ? depotRows : serviceRows,
    stations: stationRows,
    incidents,
    tasks,
    timeline: timelineFor(simulation, site, focusTrainId),
    openIncidents: simulation.incidents.filter((incident) => incident.resolvedAt === null).length,
  }
}

export function detailFor(simulation, snapshot, ref) {
  if (!ref) return null
  if (ref.type === 'train') {
    const row = snapshot.trains.find((candidate) => candidate.id === ref.id)
    if (!row) return null
    if (row.lineId === 'D') {
      const train = simulation.depot.trains.find((candidate) => candidate.id === ref.id)
      const slotName = simulation.depot.slots[train.slotIndex].id
      return {
        title: row.id,
        subtitle: 'Depot fleet, 6 cars',
        color: row.color,
        status: {
          kind: row.status,
          label: train.stage === 'maintenance' ? 'In workshop' : train.stage === 'stored' ? 'Stabled' : train.stage === 'departing' ? 'Leaving depot' : train.stage === 'arriving' ? 'Returning' : 'On the line',
        },
        fields: [
          ['Position', train.stage === 'maintenance' || train.stage === 'stored' ? slotName : 'On the lead track'],
          ['Speed', `${row.speed} km/h`],
          ['Task', train.task ? train.task.title : 'No open task'],
          ['Work order', train.task ? train.task.id : '-'],
        ],
        progress: train.task
          ? { label: 'Task progress', value: train.task.progress, note: `${Math.round(train.task.progress * 100)}%` }
          : { label: 'Readiness', value: 1, note: 'Ready' },
      }
    }
    const dwellLabel = row.doors === 'Open' ? 'Boarding at platform' : row.doors === 'Opening' ? 'Opening doors' : row.doors === 'Closing' ? 'Closing doors' : row.dwellProgress < 2.2 ? 'Arrived at platform' : 'Doors closed'
    const statusLabel = { running: 'Running', dwell: dwellLabel, held: 'Held by signal', fault: 'Door fault', turnback: 'Changing ends', depot: 'In depot' }[row.status]
    const atPlatform = row.atStation !== null
    return {
      title: row.id,
      subtitle: `${row.lineName}, 6 cars`,
      color: row.color,
      status: { kind: row.status, label: statusLabel },
      fields: [
        ['Stage', TRAIN_STAGE_LABELS[row.stageKey] ?? 'Between stations'],
        ['Time in stage', `${row.stageSeconds} s`],
        ['Speed', `${row.speed} km/h`],
        [atPlatform ? 'At platform' : 'Next stop', atPlatform ? row.atStation : `${row.next}${row.eta !== null ? `, ${row.eta} s` : ''}`],
        ['Doors', row.doors],
        ['Gap to train ahead', row.gap === null ? '-' : `${row.gap} m`],
        ['Movement authority', `${row.authority} m`],
        ['Delay', `${row.delay} s`],
      ],
      progress: { label: 'Passenger load', value: row.load, note: `${Math.round(row.load * 100)}% of ${CAPACITY}` },
    }
  }
  if (ref.type === 'station') {
    const row = snapshot.stations.find((candidate) => candidate.id === ref.id)
    if (!row) return null
    return {
      title: row.name,
      subtitle: `${row.lineName}${row.interchange ? ', interchange' : row.terminal ? ', terminus' : ''}`,
      color: row.color,
      status: { kind: row.crowding > 0.7 ? 'held' : 'running', label: row.crowding > 0.7 ? 'Crowded platform' : 'Normal service' },
      fields: [
        ['Waiting', `${row.waiting} passengers`],
        ['Gate entries', `${row.entries} per minute`],
        ['Next train', row.nextTrain ? `${row.nextTrain.id}, ${row.nextTrain.eta} s` : '-'],
        ['Last headway', row.headway === null ? '-' : `${row.headway} s`],
        ['Escalators', '2 of 2 running'],
      ],
      progress: { label: 'Platform crowding', value: row.crowding, note: `${Math.round(row.crowding * 100)}%` },
    }
  }
  if (ref.type === 'signal') {
    const line = lines.find((candidate) => ref.id.startsWith(`SIG-${candidate.short}`))
    const eastbound = ref.id.charAt(5) === 'E'
    return {
      title: ref.id,
      subtitle: `${line ? line.name : ''} block signal`,
      color: line ? line.color : '#16b8a6',
      status: { kind: 'running', label: 'Block signal' },
      fields: [
        ['Direction', eastbound ? 'Forward' : 'Reverse'],
        ['Control', 'Moving block, CBTC'],
        ['Aspect', 'Follows the train ahead'],
      ],
      progress: { label: 'Lamp health', value: 0.96, note: '96%' },
    }
  }
  if (ref.type === 'facility') {
    const depot = simulation.depot
    if (ref.id === 'wash') {
      return {
        title: 'Wash plant', subtitle: 'Brush plant, 44 m', color: '#16b8a6',
        status: { kind: depot.washActive ? 'running' : 'depot', label: depot.washActive ? 'Washing a train' : 'Idle' },
        fields: [['Cycles today', String(depot.washCycles)], ['Pass speed', '2.5 m/s'], ['Water recycled', '82%']],
        progress: { label: 'Brush wear', value: 0.34, note: '34%' },
      }
    }
    if (ref.id === 'shed') {
      const stored = depot.trains.filter((train) => train.stage === 'stored').length
      return {
        title: 'Stabling shed', subtitle: '4 roads', color: '#16b8a6',
        status: { kind: 'depot', label: 'Stabling' },
        fields: [['Trains stabled', `${stored} of 4`], ['Next departure', `${Math.max(0, Math.round(depot.departCountdown))} s`]],
        progress: { label: 'Roads occupied', value: stored / 4, note: `${stored} of 4` },
      }
    }
    if (ref.id === 'workshop') {
      const busy = depot.trains.filter((train) => train.stage === 'maintenance')
      const average = busy.length ? busy.reduce((sum, train) => sum + train.task.progress, 0) / busy.length : 0
      return {
        title: 'Maintenance workshop', subtitle: '2 roads, overhead crane', color: '#f5b301',
        status: { kind: 'maintenance', label: 'Work in progress' },
        fields: [['Trains in bay', String(busy.length)], ['Open work orders', String(depot.openTasks())]],
        progress: { label: 'Current tasks', value: average, note: `${Math.round(average * 100)}%` },
      }
    }
    if (ref.id === 'control') {
      const open = snapshot.openIncidents
      return {
        title: 'Control centre', subtitle: 'Network supervision', color: '#3b82f6',
        status: { kind: open > 0 ? 'fault' : 'running', label: open > 0 ? `${open} open incident` : 'All clear' },
        fields: [['Trains supervised', String(simulation.trains.length + depot.trains.length)], ['Open incidents', String(open)], ['Signalling', 'CBTC moving block']],
        progress: { label: 'Harbour on time', value: simulation.onTime('H'), note: `${Math.round(simulation.onTime('H') * 100)}%` },
      }
    }
    if (ref.id === 'substation') {
      const unit = simulation.substations[3]
      const load = unit.current ?? unit.load
      return {
        title: unit.name, subtitle: `Feeds ${unit.feeds}`, color: '#f5b301',
        status: { kind: 'running', label: 'Energised' },
        fields: [['Feeder', '750 V DC'], ['Transformer temperature', `${Math.round(48 + load * 30)} C`]],
        progress: { label: 'Load', value: load, note: `${Math.round(load * 100)}%` },
      }
    }
  }
  return null
}
