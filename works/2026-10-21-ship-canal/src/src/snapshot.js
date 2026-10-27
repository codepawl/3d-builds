import { PHASE, TIME_SCALE, siteById, formatDuration, CHAMBER_LENGTH, CHAMBER_WIDTH, LIFT } from './data/canal.js'

const CLOCK_START_SECONDS = 6 * 3600 + 12 * 60
const WATER_PER_LOCKAGE = (CHAMBER_LENGTH * CHAMBER_WIDTH * LIFT) / 1000 // million litres

export function clockText(simSeconds) {
  const total = Math.floor(CLOCK_START_SECONDS + simSeconds * TIME_SCALE)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor((total % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function chamberPhase(lane, chamber, time) {
  const segment = lane.activeLevelSegment(chamber, time)
  if (segment && time >= segment.t0 && time < segment.t1) return segment.to > segment.from ? 'filling' : 'emptying'
  return 'level'
}

// Which stage of its transit a ship is in, and how long it has been there (in simulation seconds of its lane).
function shipStage(lane, pose, laneTime, ship) {
  if (pose.state === 'queued') return { label: 'Approach, waiting', since: Math.max(0, laneTime - (ship.startMove - 60)) }
  const segment = pose.segment
  const since = Math.max(0, laneTime - segment.t0)
  if (pose.state === 'depart') return { label: 'Exit to the lake', since }
  if (segment.kind === 'move') {
    if (segment.entering) return { label: 'Tow in', since }
    return { label: segment.leaving ? 'Exit to the lake' : 'Next chamber', since }
  }
  const position = lane.order.indexOf(segment.chamber) + 1
  const names = { close: 'Gates close', fill: lane.uphill ? 'Fill' : 'Empty', hold: 'Gates open' }
  return { label: names[segment.kind] + ', chamber ' + position, since }
}

const STATUS_BY_KIND = { queued: 'queued', move: 'moving', close: 'closing', fill: 'locking', hold: 'holding', depart: 'cleared' }

function stepLabels(lane) {
  const count = lane.order.length
  const first = lane.uphill ? '' : ''
  const labels = ['Anchorage', 'Enter chamber', 'Gates close', lane.uphill ? 'Fill' : 'Empty', 'Gate opens']
  for (let index = 1; index < count; index += 1) labels.push(`Chamber ${lane.order[index] + 1}`)
  labels.push(lane.uphill ? 'Lake' : 'Sea')
  return labels.map((label, index) => (index === 1 ? `${label} ${lane.order[0] + 1}` : label)).map((label) => `${first}${label}`)
}

function stepIndex(lane, pose) {
  if (pose.state === 'queued') return 0
  const labels = lane.order.length
  const lastStep = 4 + labels
  if (pose.state === 'depart' || pose.segment?.leaving) return lastStep
  const position = lane.order.indexOf(pose.chamber)
  if (pose.segment?.entering) return 1
  if (position === 0) {
    if (pose.state === 'close') return 2
    if (pose.state === 'fill') return 3
    return 4
  }
  return 4 + position
}

function shipStatus(lane, pose) {
  if (pose.state === 'queued') return pose.moving ? 'queued' : 'queued'
  if (pose.state === 'fill') return lane.uphill ? 'filling' : 'emptying'
  if (pose.state === 'hold') return 'holding'
  return STATUS_BY_KIND[pose.state] ?? 'moving'
}

function gateText(fraction) {
  if (fraction > 0.98) return 'Open'
  if (fraction < 0.02) return 'Closed'
  return `${Math.round(fraction * 100)}% open`
}

export function buildSnapshot(simulation, siteId, focusRef) {
  const site = siteById[siteId]
  const flight = simulation.flights[siteId]
  const geometry = flight.geometry
  const time = simulation.renderTime
  const ships = []
  const chambers = []
  const mules = []
  let waiting = 0
  let completed = 0
  let totalFlight = 0
  Object.values(flight.lanes).forEach((lane) => {
    const laneTime = simulation.laneTime(lane)
    lane.ships.forEach((ship, index) => {
      if (laneTime >= ship.clearTime) {
        completed += 1
        totalFlight += ship.flightTime
      }
      const pose = lane.pose(index, laneTime)
      if (!pose.visible) return
      if (pose.state === 'queued') waiting += 1
      const progress = pose.state === 'queued' ? 0 : Math.min(1, (laneTime - ship.startMove) / (ship.clearTime - ship.startMove))
      ships.push({
        ref: { type: 'ship', id: ship.spec.id },
        id: ship.spec.id,
        name: ship.spec.name,
        type: ship.spec.label,
        length: ship.spec.length,
        beam: ship.spec.beam,
        draft: ship.spec.draft,
        laneId: lane.id,
        uphill: lane.uphill,
        status: shipStatus(lane, pose),
        chamber: pose.chamber,
        rank: pose.rank ?? 0,
        speed: pose.speed,
        waterY: pose.y,
        progress,
        remaining: Math.max(0, ship.clearTime - laneTime),
        stepIndex: stepIndex(lane, pose),
        stage: shipStage(lane, pose, laneTime, ship),
      })
    })
    for (let chamber = 0; chamber < geometry.chambers; chamber += 1) {
      const phase = chamberPhase(lane, chamber, laneTime)
      const lowerGate = lane.uphill ? chamber : chamber + 1
      const upperGate = lane.uphill ? chamber + 1 : chamber
      const fraction = lane.levelFraction(chamber, laneTime)
      const level = lane.levelY(chamber, laneTime)
      const occupant = ships.find((row) => row.laneId === lane.id && row.chamber === chamber && row.status !== 'queued' && row.status !== 'cleared')
      const segment = lane.activeLevelSegment(chamber, laneTime)
      chambers.push({
        ref: { type: 'chamber', id: `${lane.id}${chamber + 1}` },
        id: `${lane.id}${chamber + 1}`,
        laneId: lane.id,
        label: `Lane ${lane.id}, chamber ${chamber + 1}`,
        phase,
        level,
        fraction,
        entryGate: gateText(lane.gateFraction(lowerGate, laneTime)),
        exitGate: gateText(lane.gateFraction(upperGate, laneTime)),
        valve: lane.valveFraction(chamber, laneTime) > 0.5 ? 'Open' : 'Closed',
        occupant: occupant?.name ?? null,
        remaining: segment && laneTime < segment.t1 ? Math.max(0, segment.t1 - Math.max(laneTime, segment.t0)) : 0,
      })
    }
  })
  const activeShips = ships.filter((row) => row.status !== 'queued' && row.status !== 'cleared')
  activeShips.forEach((row) => {
    for (let slot = 0; slot < 4; slot += 1) {
      const set = (Number(row.id.slice(1)) - 1) % 3
      const moving = row.status === 'moving'
      const tension = Math.round((moving ? 168 : 96) + 44 * Math.sin(time * 1.3 + slot * 1.7 + set))
      mules.push({
        ref: { type: 'mule', id: `${row.laneId}${String(set + 1).padStart(2, '0')}-${slot + 1}` },
        id: `${row.laneId}${String(set + 1).padStart(2, '0')}-${slot + 1}`,
        shipName: row.name,
        shipId: row.id,
        role: slot < 2 ? 'Bow line' : 'Stern line',
        tension,
        moving,
      })
    }
  })
  const events = []
  Object.values(flight.lanes).forEach((lane) => {
    const laneTime = simulation.laneTime(lane)
    lane.events.forEach((event) => {
      if (event.time <= laneTime && event.time > laneTime - 90) events.push({ ...event, simTime: event.time - lane.offset, laneId: lane.id })
    })
  })
  events.sort((a, b) => b.simTime - a.simTime)
  const baseTransits = siteId === 'lake' ? 17 : 38
  const averageFlight = completed > 0 ? totalFlight / completed : 0
  const kpis = {
    first: { label: 'Transits today', value: String(baseTransits + completed), note: `${completed} since shift start` },
    second: { label: 'Average transit time', value: averageFlight > 0 ? formatDuration(averageFlight) : formatDuration(Object.values(flight.lanes)[0].ships[0].flightTime), note: siteId === 'lake' ? 'through the lock' : 'through the flight' },
    third: { label: 'Water per lockage', value: `${WATER_PER_LOCKAGE.toFixed(1)} ML`, note: `${LIFT} m lift per chamber` },
    fourth: { label: 'Ships waiting', value: String(waiting), note: 'at both anchorages' },
  }
  let timeline = null
  const focusId = focusRef?.type === 'ship' ? focusRef.id : activeShips.find((row) => row.laneId === 'A')?.id ?? activeShips[0]?.id
  const focusRow = ships.find((row) => row.id === focusId)
  if (focusRow) {
    const lane = flight.lanes[focusRow.laneId]
    const labels = stepLabels(lane)
    const laneTime = simulation.laneTime(lane)
    const shipData = lane.ships[Number(focusRow.id.slice(1)) - 1]
    const startTimes = Array(labels.length).fill(null)
    shipData.segments.forEach((segment) => {
      const pose = { state: segment.kind, chamber: segment.chamber, segment }
      const index = stepIndex(lane, pose)
      if (startTimes[index] === null) startTimes[index] = segment.t0
    })
    startTimes[0] = shipData.startMove - 20
    startTimes[labels.length - 1] = shipData.clearTime
    timeline = {
      shipId: focusRow.id,
      subtitle: `${focusRow.name}, ${focusRow.uphill ? 'uphill to the lake' : 'downhill to the sea'}`,
      status: focusRow.status,
      steps: labels.map((label, index) => ({
        id: `${index}`,
        label,
        status: index < focusRow.stepIndex ? 'done' : index === focusRow.stepIndex ? 'active' : 'next',
        at: startTimes[index] === null || startTimes[index] > laneTime ? null : clockText(startTimes[index] - lane.offset),
        detail: startTimes[index] === null ? '' : `in ${formatDuration(Math.max(0, startTimes[index] - laneTime))}`,
      })),
    }
  }
  return { time, clock: clockText(time), kpis, ships, chambers, mules, events, timeline, siteName: site.name }
}

const STATUS_LABEL = {
  queued: 'Waiting at anchorage',
  moving: 'Under tow',
  closing: 'Gates closing',
  filling: 'Chamber filling',
  emptying: 'Chamber emptying',
  holding: 'Gate opening',
  cleared: 'Cleared the flight',
}

export function detailFor(simulation, snapshot, selected, siteId) {
  if (!selected || !snapshot) return null
  if (selected.type === 'ship') {
    const row = snapshot.ships.find((candidate) => candidate.id === selected.id)
    if (!row) return null
    const stepText = row.chamber === null ? 'Not started' : `Chamber ${row.chamber + 1}`
    return {
      title: row.name,
      subtitle: `${row.type}, lane ${row.laneId}`,
      color: row.uphill ? '#0f9d8f' : '#e08a00',
      status: { kind: row.status, label: STATUS_LABEL[row.status] ?? row.status },
      fields: [
        ['Stage', row.stage.label],
        ['In stage for', row.stage.since < 1 ? 'Just started' : Math.round(row.stage.since) + ' s'],
        ['Direction', row.uphill ? 'Uphill, sea to lake' : 'Downhill, lake to sea'],
        ['Position', stepText],
        ['Length / beam', `${row.length} m / ${row.beam} m`],
        ['Draft', `${row.draft} m`],
        ['Water level', `${row.waterY.toFixed(1)} m above sea`],
        ['Speed', `${(row.speed * 0.5).toFixed(1)} kn`],
        ['Time to clear', row.status === 'queued' ? 'Queued' : formatDuration(row.remaining)],
      ],
      progress: { label: 'Transit progress', note: `${Math.round(row.progress * 100)}%`, value: row.progress },
    }
  }
  if (selected.type === 'chamber') {
    const row = snapshot.chambers.find((candidate) => candidate.id === selected.id)
    if (!row) return null
    const kind = row.phase === 'level' ? 'holding' : row.phase
    return {
      title: row.label,
      subtitle: `${CHAMBER_LENGTH} m by ${CHAMBER_WIDTH} m chamber`,
      color: '#2f6fdd',
      status: { kind, label: row.phase === 'level' ? 'Level, gates set' : row.phase === 'filling' ? 'Filling through the culverts' : 'Emptying through the culverts' },
      fields: [
        ['Water level', `${row.level.toFixed(2)} m above sea`],
        ['Entry gate', row.entryGate],
        ['Exit gate', row.exitGate],
        ['Culvert valves', row.valve],
        ['Ship inside', row.occupant ?? 'Empty'],
        ['Phase time left', row.remaining > 0 ? formatDuration(row.remaining) : 'None'],
      ],
      progress: { label: 'Level in the lift', note: `${Math.round(row.fraction * 100)}%`, value: row.fraction },
    }
  }
  if (selected.type === 'mule') {
    const row = snapshot.mules.find((candidate) => candidate.id === selected.id)
    if (!row) return null
    return {
      title: `Locomotive ${row.id}`,
      subtitle: `${row.role}, wall-top rail`,
      color: '#c9930a',
      status: { kind: row.moving ? 'moving' : 'holding', label: row.moving ? 'Towing' : 'Holding the line' },
      fields: [
        ['Assigned ship', row.shipName],
        ['Line tension', `${row.tension} kN`],
        ['Rail', 'Rack and pinion, 1.5 m gauge'],
      ],
      progress: { label: 'Line load', note: `${Math.round((row.tension / 260) * 100)}%`, value: Math.min(1, row.tension / 260) },
    }
  }
  if (selected.type === 'center') {
    return {
      title: 'Canal control center',
      subtitle: 'Operations floor and radar',
      color: '#7c4dde',
      status: { kind: 'holding', label: 'Watching both lanes' },
      fields: [
        ['Controllers on duty', '14'],
        ['Ships waiting', snapshot.kpis.fourth.value],
        ['Transits today', snapshot.kpis.first.value],
        ['Open alerts', '0'],
      ],
      progress: { label: 'Shift complete', note: `${Math.round(((6 * 3600 + simulation.time * TIME_SCALE) % 28800) / 288) }%`, value: ((6 * 3600 + simulation.time * TIME_SCALE) % 28800) / 28800 },
    }
  }
  return null
}
