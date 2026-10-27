// Stroke icons on a 24-unit grid. Status icons each have a distinct shape so states read at a glance.
import { AIRLINES, MARK_SHAPES } from '../data.js'

const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotateLeft: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  rotateRight: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  locate: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  plane: 'M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2.5 2v1.5L11.5 20l3.5 1.5V20L13 18v-5z',
  tug: 'M3 15h11V9H8l-2 3H3zM14 12h3M17 10v5h4v-5M6 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM16 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  gate: 'M4 20V6l8-3 8 3v14M9 20v-6h6v6',
  tower: 'M9 21l1-11h4l1 11M7 10h10l-1-4H8zM12 6V3',
  terminal: 'M3 20h18M4 20V9l8-4 8 4v11M9 20v-5h6v5M8 11h2M14 11h2',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  // status shapes
  landing: 'M3 20h18M5 9l5 2.5V5l2 1 1.5 7.5 5 2.5a1.5 1.5 0 0 1-1 2.8L4 13z',
  takeoff: 'M3 20h18M4 15l14-6a1.6 1.6 0 0 1 1.3 2.9L8 17.5l-3-1zM9 11L6 8.5 8 8l4 1.5',
  taxi: 'M3 13h18M8 13V9h8v4M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  climb: 'M4 18L19 6M13 6h6v6',
  descend: 'M4 6l15 12M19 12v6h-6',
  cruise: 'M3 12h16M15 8l4 4-4 4M3 7h6M3 17h6',
  orbit: 'M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM15 4l3 3-3 3',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v6M12 16.5v.01',
  weather: 'M7 16a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17.5 16M12.5 12l-2 4h3l-2 4',
  fix: 'M12 4l8 15H4z',
  radar: 'M12 12l6.5-6.5M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5',
  log: 'M5 6h14M5 11h14M5 16h9M5 21h6',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  arrow: 'M5 12h12M13 7l5 5-5 5',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6',
  hold: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8 12h8',
  pushback: 'M11 7l-5 5 5 5M18 7l-5 5 5 5',
  bags: 'M6 8h12v12H6zM9 8V5h6v3M9 12v4M15 12v4',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  boarding: 'M9 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 21v-6l-2-1 1-5h4l3 4h3M11 15l2 6',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  wrench: 'M15 4a5 5 0 0 0-5.6 6.6L3.5 16.5a2 2 0 0 0 2.8 2.8l5.9-5.9A5 5 0 0 0 19 8l-3 1-2-2 1-3z',
  return: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 0 0-10h-2',
  parked: 'M5 4h14v16H5zM10 16V8h3a2.5 2.5 0 0 1 0 5h-3',
  battery: 'M3 8h15v8H3zM21 11v2M6 11v2',
  free: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  occupied: 'M5 5h14v14H5z',
  reserved: 'M12 3l9 9-9 9-9-9z',
  check: 'M5 12.5l4.5 4.5L19 7',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  runway: 'M8 21L10 3M16 21L14 3M12 6v2M12 11v2M12 16v2',
}

const FILLED = new Set(['occupied', 'plane'])

export function Icon({ name, size = 18, strokeWidth = 1.8, className }) {
  const filled = FILLED.has(name)
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export function StatusIcon({ name }) {
  return <Icon name={name} size={14} strokeWidth={2.2} className="status-icon" />
}

export function StatusChip({ status }) {
  return (
    <span className={`chip tone-${status.tone}`}>
      <StatusIcon name={status.icon} />
      {status.label}
    </span>
  )
}

// Invented airline marks: a coloured tile with a simple shape, nothing borrowed from a real carrier.
function Mark({ shape }) {
  if (shape.stroke) return <path d={shape.path} fill="none" stroke="#fff" strokeWidth={shape.stroke} strokeLinecap="round" />
  return <path d={shape.path} fill="#fff" />
}

export function AirlineMark({ code, size = 32 }) {
  const airline = AIRLINES[code]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={airline.name} role="img">
      <rect width="24" height="24" rx="7" fill={airline.color} />
      <Mark shape={MARK_SHAPES[airline.mark]} />
    </svg>
  )
}

export function ProductMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2a4fd8" />
      <path d="M8 24a16 16 0 0 1 16-16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M12.5 24A11.5 11.5 0 0 1 24 12.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M8 24L21 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="21.5" cy="18.5" r="2.4" fill="#5ef2c2" />
    </svg>
  )
}
