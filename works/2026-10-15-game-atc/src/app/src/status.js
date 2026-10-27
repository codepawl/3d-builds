// Human-readable status for each entity. `icon` names a shape in ui/Icon.jsx; each state has its own.

const PHASE_STATUS = {
  parked: { icon: 'parked', label: 'On stand', tone: 'muted' },
  taxiOut: { icon: 'taxi', label: 'Taxiing out', tone: 'info' },
  holdShort: { icon: 'hold', label: 'Holding short', tone: 'warn' },
  takeoff: { icon: 'takeoff', label: 'Taking off', tone: 'ok' },
  climb: { icon: 'climb', label: 'Climbing', tone: 'ok' },
  cruise: { icon: 'cruise', label: 'Cruising', tone: 'ok' },
  descend: { icon: 'descend', label: 'Descending', tone: 'info' },
  hold: { icon: 'orbit', label: 'In the hold', tone: 'warn' },
  approach: { icon: 'landing', label: 'On approach', tone: 'info' },
  landing: { icon: 'landing', label: 'Landing roll', tone: 'info' },
  taxiIn: { icon: 'taxi', label: 'Taxiing in', tone: 'info' },
}

export function flightStatus(flight) {
  if (flight.alert === 'red') return { icon: 'warning', label: 'Loss of separation', tone: 'bad' }
  if (flight.alert === 'amber') return { icon: 'alert', label: 'Traffic alert', tone: 'warn' }
  if (flight.avoiding) return { icon: 'weather', label: 'Avoiding weather', tone: 'warn' }
  return PHASE_STATUS[flight.phase] ?? PHASE_STATUS.cruise
}

export function conflictStatus(conflict) {
  if (conflict.state === 'resolved') return { icon: 'check', label: 'Resolved', tone: 'ok' }
  if (conflict.worst === 'red') return { icon: 'warning', label: 'Below minimum', tone: 'bad' }
  return { icon: 'alert', label: 'Closing', tone: 'warn' }
}

export function runwayStatus(state, runway) {
  const use = state.runwayUse[runway.id]
  if (use) {
    const flight = state.flights.find((candidate) => candidate.id === use.flightId)
    return { icon: 'occupied', label: 'Occupied', tone: 'warn', flight }
  }
  const waiting = runway.id === 'R2' && state.flights.find((flight) => flight.phase === 'holdShort')
  if (waiting) return { icon: 'reserved', label: 'Departure ready', tone: 'info', flight: waiting }
  return { icon: 'free', label: 'Clear', tone: 'ok', flight: null }
}
