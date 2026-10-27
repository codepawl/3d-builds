// Human-readable status for each entity. `icon` names a shape in ui/Icon.jsx; each state has its own.

const NEEDS = {
  triage: { icon: 'hourglass', label: 'Waiting for triage', tone: 'warn' },
  'in-triage': { icon: 'clipboard', label: 'In triage', tone: 'info' },
  bed: { icon: 'queue', label: 'Waiting for a bed', tone: 'warn' },
  'to-bed': { icon: 'walk', label: 'Going to a bay', tone: 'info' },
  handover: { icon: 'ambulance', label: 'Arriving', tone: 'info' },
  doctor: { icon: 'hourglass', label: 'Waiting for doctor', tone: 'warn' },
  tests: { icon: 'flask', label: 'Tests in progress', tone: 'info' },
  decision: { icon: 'stethoscope', label: 'Awaiting decision', tone: 'info' },
  admit: { icon: 'bed', label: 'Admit, awaiting porter', tone: 'warn' },
  'to-ward': { icon: 'play', label: 'Going to ward', tone: 'ok' },
  discharge: { icon: 'check', label: 'Discharged', tone: 'ok' },
  leaving: { icon: 'check', label: 'Discharged', tone: 'ok' },
  left: { icon: 'warning', label: 'Left without being seen', tone: 'bad' },
}

export function patientStatus(patient) {
  if (patient.needs === 'handover' && patient.carrier?.type === 'trolley') return { icon: 'play', label: 'Handover to a bay', tone: 'ok' }
  if (patient.needs === 'tests') {
    const active = patient.tests.find((test) => test.state === 'scanning' || test.state === 'transfer')
    if (active) return { icon: 'scan', label: `In ${active.name}`, tone: 'ok' }
  }
  return NEEDS[patient.needs] ?? { icon: 'pause', label: 'In department', tone: 'muted' }
}

export function bedStatus(bed) {
  if (bed.state === 'occupied') return { icon: 'bed', label: 'Occupied', tone: 'info' }
  if (bed.state === 'cleaning') return { icon: 'sparkle', label: 'Cleaning', tone: 'warn' }
  if (bed.reservedFor) return { icon: 'hourglass', label: 'Patient on the way', tone: 'info' }
  return { icon: 'check', label: 'Free', tone: 'ok' }
}

export function bedLampColor(bed) {
  if (bed.state === 'occupied') return '#3e8ee8'
  if (bed.state === 'cleaning') return '#f5a524'
  return '#30c27a'
}

export function vehicleStatus(vehicle) {
  switch (vehicle.phase) {
    case 'arriving':
      return { icon: 'arrow', label: `Inbound, ${vehicle.eta ?? 0} s`, tone: 'info' }
    case 'reversing':
      return { icon: 'swap', label: 'Backing into the bay', tone: 'warn' }
    case 'parked':
      return { icon: 'stop', label: 'Doors opening', tone: 'warn' }
    case 'handover':
      return { icon: 'hand', label: 'Handing over', tone: 'ok' }
    case 'closing':
      return { icon: 'stop', label: 'Crew back on board', tone: 'muted' }
    case 'departing':
      return { icon: 'play', label: 'Back in service', tone: 'muted' }
    default:
      return { icon: 'pause', label: 'Off site', tone: 'muted' }
  }
}

export function heliStatus(heli) {
  switch (heli.phase) {
    case 'approach':
      return { icon: 'arrow', label: `Inbound, ${heli.eta ?? 0} s`, tone: 'info' }
    case 'landing':
      return { icon: 'down', label: 'Landing', tone: 'warn' }
    case 'landed':
      return { icon: 'stop', label: 'On the pad', tone: 'warn' }
    case 'handover':
      return { icon: 'hand', label: 'Handing over', tone: 'ok' }
    case 'crewBack':
      return { icon: 'cycle', label: 'Spinning up', tone: 'muted' }
    case 'departing':
      return { icon: 'up', label: 'Lifting off', tone: 'muted' }
    default:
      return { icon: 'pause', label: 'At base', tone: 'muted' }
  }
}

export function personStatus(person) {
  if (person.state === 'convoy') return { icon: 'bed', label: 'Moving a bed', tone: 'ok' }
  if (person.state === 'walk') return { icon: 'walk', label: 'Walking', tone: 'info' }
  if (person.clip === 'chart') return { icon: 'tablet', label: 'Charting', tone: 'ok' }
  if (person.clip === 'sit') return { icon: 'seat', label: 'Seated', tone: 'muted' }
  return { icon: 'pause', label: 'Available', tone: 'muted' }
}

export function roomStatus(room) {
  if (room.kind === 'lab') return room.busyFor ? { icon: 'flask', label: `Running ${room.busyFor} samples`, tone: 'ok' } : { icon: 'pause', label: 'Idle', tone: 'muted' }
  if (room.phase === 'scanning') return { icon: 'scan', label: 'Scanning', tone: 'ok' }
  if (room.phase) return { icon: 'stop', label: 'Positioning patient', tone: 'warn' }
  if (room.reservedBy) return { icon: 'hourglass', label: 'Patient on the way', tone: 'info' }
  return { icon: 'check', label: 'Ready', tone: 'ok' }
}
