// Human-readable status for each entity. `icon` names a shape in ui/Icon.jsx; each state has its own.
import { STAGES } from './data.js'

export const TOOL_STATUS = {
  running: { icon: 'play', label: 'Running', tone: 'ok' },
  idle: { icon: 'pause', label: 'Idle', tone: 'muted' },
  down: { icon: 'warning', label: 'Down', tone: 'bad' },
  maintenance: { icon: 'wrench', label: 'Maintenance', tone: 'warn' },
}

export function toolStatus(tool) {
  return TOOL_STATUS[tool.state]
}

export function lotStatus(state, lot) {
  const stage = STAGES[lot.stageIndex].label
  switch (lot.state) {
    case 'processing': {
      const tool = state.tools.find((candidate) => candidate.id === lot.toolId)
      return { icon: 'play', label: `${stage} on ${tool?.name ?? 'tool'}`, tone: 'ok' }
    }
    case 'moving':
      return { icon: 'arrow', label: lot.place.type === 'vehicle' ? 'On OHT' : 'Pickup booked', tone: 'info' }
    case 'atTool':
      return { icon: 'hourglass', label: `Waiting for ${stage.toLowerCase()}`, tone: 'warn' }
    case 'waiting':
      return { icon: 'check', label: 'Step done', tone: 'ok' }
    case 'transfer':
      return { icon: 'swap', label: 'Interbay transfer', tone: 'info' }
    default:
      return { icon: 'stack', label: `Queued for ${stage.toLowerCase()}`, tone: 'muted' }
  }
}

export function vehicleStatus(state, vehicle) {
  const job = vehicle.job
  if (!job) return { icon: 'loop', label: 'Circulating', tone: 'muted' }
  switch (job.phase) {
    case 'toPickup':
      return { icon: 'arrow', label: 'To pickup', tone: 'info' }
    case 'lowerPick':
    case 'lowerDrop':
      return { icon: 'down', label: 'Hoist lowering', tone: 'warn' }
    case 'raisePick':
    case 'raiseDrop':
      return { icon: 'up', label: 'Hoist raising', tone: 'warn' }
    default:
      return { icon: 'pod', label: 'Carrying pod', tone: 'ok' }
  }
}

export function personStatus(state, person) {
  const tool = person.toolId && state.tools.find((candidate) => candidate.id === person.toolId)
  if (person.state === 'walk') return { icon: 'walk', label: `Walking to ${tool?.name ?? 'bay'}`, tone: 'info' }
  if (person.state === 'work' && person.ticketId) return { icon: 'wrench', label: `Repairing ${tool.name}`, tone: 'warn' }
  if (person.state === 'work') return { icon: 'tablet', label: `Checking ${tool?.name ?? 'tool'}`, tone: 'ok' }
  return { icon: 'pause', label: 'Standing by', tone: 'muted' }
}

export function ticketStatus(ticket) {
  if (ticket.state === 'closed') return { icon: 'check', label: 'Closed', tone: 'ok' }
  if (ticket.state === 'working') return { icon: 'wrench', label: 'Repair under way', tone: 'warn' }
  if (ticket.state === 'assigned') return { icon: 'walk', label: 'Technician on the way', tone: 'info' }
  return { icon: 'warning', label: 'Open', tone: 'bad' }
}

export function truckStatus(state, truck) {
  if (state.clock < truck.waitUntil) return { icon: 'stop', label: 'Unloading', tone: 'warn' }
  if (truck.speed < 0.5) return { icon: 'pause', label: 'Waiting', tone: 'muted' }
  return { icon: 'arrow', label: 'Driving', tone: 'info' }
}
