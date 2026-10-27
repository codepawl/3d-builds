// Turns model entities into what the dashboard shows: card fields, list rows, tones and formatted numbers.
import { RACK } from './world.js'

export function formatTokens(tokensPerSecond) {
  if (tokensPerSecond >= 1e6) return `${(tokensPerSecond / 1e6).toFixed(2)}M`
  return `${(tokensPerSecond / 1e3).toFixed(0)}k`
}

export function formatInteger(value) {
  return Math.round(value).toLocaleString('en-US')
}

export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`
}

export function formatAgo(seconds) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s ago`
  return `${Math.round(seconds / 60)} min ago`
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`
  return `${hours} h ${minutes} min`
}

const UNIT_STATE = {
  moving: { tone: 'moving', label: 'On the move' },
  working: { tone: 'busy', label: 'Working' },
  charging: { tone: 'charging', label: 'Charging' },
  inspecting: { tone: 'ok', label: 'Inspecting' },
  idle: { tone: 'idle', label: 'Standing by' },
}

export function unitTone(unit) {
  return UNIT_STATE[unit.state].tone
}

const TICKET_TONE = { queued: 'idle', 'en route': 'moving', 'in progress': 'busy', done: 'ok' }

function remainingDistance(unit) {
  let length = 0
  let previous = unit
  for (const point of unit.path) {
    length += Math.hypot(point.x - previous.x, point.z - previous.z)
    previous = point
  }
  return length
}

function rackStatus(rack) {
  if (rack.failedTray !== null) return { tone: 'critical', label: `GPU tray ${rack.failedTray + 1} failing` }
  if (rack.temperature > 74) return { tone: 'warn', label: 'Running hot' }
  return { tone: 'ok', label: 'Healthy' }
}

function describeRack(rack, world) {
  const job = world.index.get(rack.jobId)
  const crah = world.index.get(rack.crahId)
  return {
    title: rack.name,
    subtitle: `GPU rack in ${world.site.name}`,
    icon: 'rack',
    status: rackStatus(rack),
    statusNote: job.name,
    progress: { label: 'GPU load', value: rack.load, right: formatPercent(rack.load) },
    trays: rack.trayTemperatures.map((temperature, tray) => ({ temperature, failed: tray === rack.failedTray })),
    fields: [
      ['Hottest GPU', `${rack.temperature.toFixed(1)} °C`],
      ['Inlet air', `${rack.inletTemperature.toFixed(1)} °C`],
      ['Power draw', `${rack.powerKw.toFixed(0)} kW`],
      ['GPUs busy', `${rack.gpusBusy} of ${RACK.trays * RACK.gpusPerTray}`],
      ['Cooled by', crah ? crah.name.replace('Cooling unit ', '') : '—'],
    ],
  }
}

function unitProgress(unit) {
  if (unit.state === 'working') return { label: unit.kind === 'robot' ? 'Swap progress' : 'Repair progress', value: unit.workProgress, right: formatPercent(unit.workProgress) }
  if (unit.state === 'moving') {
    const done = 1 - remainingDistance(unit) / unit.routeLength
    return { label: `Route, ${remainingDistance(unit).toFixed(0)} m left`, value: done, right: formatPercent(done) }
  }
  if (unit.kind === 'robot') return { label: 'Battery', value: unit.battery, right: formatPercent(unit.battery) }
  return null
}

function describeUnit(unit, world) {
  const ticket = unit.ticketId ? world.index.get(unit.ticketId) : null
  const isRobot = unit.kind === 'robot'
  const fields = [
    ['Task', unit.task],
    ['Speed', `${unit.state === 'moving' ? unit.speed.toFixed(1) : '0.0'} m/s`],
    ['Ticket', ticket ? `${ticket.id} · ${ticket.title}` : 'None'],
  ]
  if (isRobot) {
    fields.splice(1, 0, ['Battery', formatPercent(unit.battery)], ['Carrying', unit.carrying ?? 'Nothing'])
  } else {
    fields.splice(1, 0, ['On shift', `${(unit.shiftHours + world.time / 3600).toFixed(1)} h`])
  }
  return {
    title: unit.name,
    subtitle: isRobot ? `Robot cart in ${world.site.name}` : `Floor technician in ${world.site.name}`,
    icon: isRobot ? 'robot' : 'person',
    status: UNIT_STATE[unit.state],
    statusNote: unit.task,
    progress: unitProgress(unit),
    fields,
  }
}

function describeEquipment(item, world) {
  if (item.kind === 'crah') {
    const worn = item.degradeTo !== undefined || item.health < 0.8
    return {
      title: item.name, subtitle: `Air handler on the ${item.side < 0 ? 'west' : 'east'} wall`, icon: 'fan',
      status: worn ? { tone: 'warn', label: 'Bearing wearing out' } : { tone: 'ok', label: 'Running' },
      statusNote: worn ? 'Fan surging' : 'Steady airflow',
      progress: { label: 'Health', value: item.health, right: formatPercent(item.health) },
      fields: [
        ['Supply air', `${item.supplyTemperature.toFixed(1)} °C`],
        ['Fan speed', formatPercent(item.fanSpeed)],
        ['Racks served', `${world.racks.filter((rack) => rack.crahId === item.id).length}`],
      ],
    }
  }
  if (item.kind === 'chiller') {
    return {
      title: item.name, subtitle: 'Chiller in the east yard', icon: 'fan',
      status: { tone: 'ok', label: 'Running' }, statusNote: 'Free cooling off',
      progress: { label: 'Load', value: item.load, right: formatPercent(item.load) },
      fields: [
        ['Chilled water out', `${item.waterTemperature.toFixed(1)} °C`],
        ['Return water', `${(item.waterTemperature + 6.2).toFixed(1)} °C`],
        ['Health', formatPercent(item.health)],
      ],
    }
  }
  if (item.kind === 'substation') {
    const capacity = 14
    return {
      title: item.name, subtitle: 'Feeds this hall from the grid', icon: 'bolt',
      status: { tone: 'ok', label: 'Both feeds live' }, statusNote: 'Two 34.5 kV lines',
      progress: { label: `Load of ${capacity} MW`, value: item.megawatts / capacity, right: `${item.megawatts.toFixed(2)} MW` },
      fields: [
        ['Transformers', '2 × 16 MVA'],
        ['Hall draw', `${item.megawatts.toFixed(2)} MW`],
        ['Oil temperature', `${(48 + item.megawatts * 1.1).toFixed(1)} °C`],
      ],
    }
  }
  return {
    title: item.name, subtitle: 'Backup batteries for the hall', icon: 'battery',
    status: { tone: 'charging', label: 'Float charge' }, statusNote: '10 cabinets online',
    progress: { label: 'Charge', value: item.charge, right: formatPercent(item.charge) },
    fields: [
      ['Ride-through', `${(8 + item.charge * 2).toFixed(1)} min at full load`],
      ['Cell temperature', '24.1 °C'],
      ['Last test', '3 days ago'],
    ],
  }
}

function describeJob(job, world) {
  const training = job.jobType === 'training'
  const rows = [...new Set(job.rackIds.map((id) => world.index.get(id).name.slice(-3, -2)))].join(', ')
  return {
    title: job.name,
    subtitle: training ? `Training job in ${world.site.name}` : `Inference pool in ${world.site.name}`,
    icon: training ? 'spark' : 'stream',
    status: { tone: 'busy', label: 'Running' },
    statusNote: `${job.rackIds.length} racks`,
    progress: training
      ? { label: 'Epoch', value: job.progress, right: formatPercent(job.progress) }
      : { label: 'Batch window', value: job.progress, right: formatPercent(job.progress) },
    fields: [
      ['Tokens per second', formatTokens(job.tokensPerSecond)],
      ['GPUs', formatInteger(job.gpus)],
      ['Rows', rows],
    ],
  }
}

export function describeEntity(entity, world) {
  if (entity.kind === 'rack') return describeRack(entity, world)
  if (entity.kind === 'robot' || entity.kind === 'tech') return describeUnit(entity, world)
  if (entity.kind === 'job') return describeJob(entity, world)
  return describeEquipment(entity, world)
}

// Rows for the tabbed lists. `targetId` is what a click selects and flies to.
export function listRows(tab, world) {
  if (tab === 'jobs') {
    return world.jobs.map((job) => ({
      id: job.id, targetId: job.id, tone: 'busy', title: job.name,
      meta: `${formatInteger(job.gpus)} GPUs · ${formatTokens(job.tokensPerSecond)} tok/s`,
      progress: job.progress, right: formatPercent(job.progress),
    }))
  }
  if (tab === 'alerts') {
    return world.alerts.map((alert) => ({
      id: alert.id, targetId: alert.targetId, tone: alert.resolved ? 'ok' : alert.severity,
      title: alert.title,
      meta: `${world.index.get(alert.targetId)?.name ?? alert.targetId} · ${formatAgo(world.time - alert.createdAt)}`,
      right: alert.resolved ? 'Fixed' : 'Open',
    }))
  }
  if (tab === 'tickets') {
    return world.tickets.map((ticket) => {
      const assignee = world.index.get(ticket.assigneeId)
      return {
        id: ticket.id, targetId: ticket.assigneeId && ticket.status !== 'done' ? ticket.assigneeId : ticket.targetId,
        tone: TICKET_TONE[ticket.status], title: ticket.title,
        meta: `${world.index.get(ticket.targetId)?.name.replace('Cooling unit ', '')} · ${assignee ? assignee.name.split(' ').pop() : 'Waiting for a unit'}`,
        progress: ticket.status === 'in progress' ? ticket.progress : null,
        right: ticket.status === 'done' ? 'Done' : ticket.status === 'queued' ? 'Queued' : ticket.status === 'en route' ? 'En route' : formatPercent(ticket.progress),
      }
    })
  }
  return world.units.map((unit) => ({
    id: unit.id, targetId: unit.id, tone: unitTone(unit), title: unit.name,
    meta: unit.task,
    right: unit.kind === 'robot' ? formatPercent(unit.battery) : 'On foot',
  }))
}

export function openCount(tab, world) {
  if (tab === 'jobs') return world.jobs.length
  if (tab === 'alerts') return world.alerts.filter((alert) => !alert.resolved).length
  if (tab === 'tickets') return world.tickets.filter((ticket) => ticket.status !== 'done').length
  return world.units.length
}
