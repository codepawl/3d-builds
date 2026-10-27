// Every status leads with an icon whose shape differs per state, in the status colour.
import { boatPhase, coasterPhase } from './sim.js'

const status = (label, icon, tone) => ({ label, icon, tone })

export function rideStatus(ride) {
  if (ride.state === 'down') return status('Down', 'warning', 'bad')
  if (ride.state === 'testing') return status('Testing', 'wrench', 'warn')
  return status('Open', 'play', 'ok')
}

export const RIDE_COLORS = { open: '#1d8f5a', down: '#d6373d', testing: '#e59a12' }

const TRAIN_PHASES = {
  loading: status('Loading', 'hourglass', 'info'),
  dispatch: status('Dispatched', 'arrow', 'ok'),
  lift: status('On lift hill', 'up', 'ok'),
  drop: status('First drop', 'down', 'ok'),
  circuit: status('On circuit', 'loop', 'ok'),
  brakes: status('Braking', 'pause', 'warn'),
  returning: status('Returning', 'arrow', 'info'),
}

const BOAT_PHASES = {
  loading: status('Loading', 'hourglass', 'info'),
  lift: status('On lift', 'up', 'ok'),
  drop: status('Splashdown', 'water', 'ok'),
  floating: status('Floating', 'loop', 'ok'),
}

export function unitStatus(unit) {
  switch (unit.kind) {
    case 'train':
      return TRAIN_PHASES[coasterPhase(unit)]
    case 'boat':
      return BOAT_PHASES[boatPhase(unit)]
    case 'monorail':
    case 'tram':
      return unit.dwell > 0 ? status('At station', 'hourglass', 'info') : status('Running', 'arrow', 'ok')
    case 'cart':
      return unit.dwell > 0 ? status('On a job', 'wrench', 'warn') : status('Driving', 'arrow', 'info')
    case 'float':
      return status('In parade', 'play', 'ok')
    case 'staff':
      return unit.path ? status('Walking rounds', 'walk', 'info') : status('Operating', 'play', 'ok')
    default:
      return status('Active', 'check', 'ok')
  }
}

export function standStatus(stand) {
  if (stand.stock < 0.25) return status('Low stock', 'warning', 'warn')
  return status('Serving', 'check', 'ok')
}

export function ticketStatus(ticket) {
  if (ticket.status === 'done') return status('Done', 'check', 'ok')
  if (ticket.status === 'in progress') return status('In progress', 'wrench', 'warn')
  if (ticket.status === 'assigned') return status('Assigned', 'person', 'info')
  return status('Scheduled', 'clock', 'muted')
}

export function entityStatus(entity) {
  if (entity.type === 'ride') return rideStatus(entity.item)
  if (entity.type === 'stand') return standStatus(entity.item)
  return unitStatus(entity.item)
}

export const KIND_ICONS = { coaster: 'coaster', flume: 'water', darkride: 'building', darkcoaster: 'coaster', ferris: 'wheel', carousel: 'carousel', monorail: 'monorail', walkthrough: 'castle', gate: 'ticket', tram: 'tram', train: 'coaster', boat: 'water', cart: 'cart', float: 'star', staff: 'person', food: 'food', retail: 'bag' }
