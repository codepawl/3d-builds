// Stroke icons on a 24-unit grid. Status icons each have a distinct shape so states read at a glance.

const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  chevronDown: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotateLeft: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  rotateRight: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  wide: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  thermometer: 'M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0zM12 9v7',
  cloud: 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM9 21l1-2M13 21l1-2',
  // things
  car: 'M2 15h20M4 15l1.5-4h5l2-2h3l1 2h3.5l1 4M6.5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 9V7h3',
  person: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21v-5a6 6 0 0 1 12 0v5',
  tyre: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  garage: 'M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 16h10',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM16 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  lights: 'M8 3h8v18H8zM12 6.5v.01M12 12v.01M12 17.5v.01',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  stand: 'M4 20V11h16v9M6 11V6h12v5M9 20v-5h6v5',
  jack: 'M3 18h12M5 18v-3h7l5-8 3 1-5 10',
  stopwatch: 'M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10v4l2 2M10 2h4M12 2v4',
  timer: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4h3',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M3 20h18',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6z',
  seats: 'M3 20h18M5 20v-4h14v4M7 16v-4h10v4M9 12V8h6v4',
  building: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h2M13 11h2',
  // status shapes
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6 6h12v12H6z',
  down: 'M12 4v14M6 12l6 6 6-6',
  up: 'M12 20V6M6 12l6-6 6 6',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  wrench: 'M15 4a5 5 0 0 0-5.6 6.6L3.5 16.5a2 2 0 0 0 2.8 2.8l5.9-5.9A5 5 0 0 0 19 8l-3 1-2-2 1-3z',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  check: 'M5 12.5l4.5 4.5L19 7',
  walk: 'M13 4a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 13 4zM10 21l2-6 3 3v3M12 15l1-5 3 3h3M13 10l-4 1-2 3',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6',
  arrow: 'M5 12h12M13 7l5 5-5 5',
  diamond: 'M12 3l8 9-8 9-8-9z',
  circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  radio: 'M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0M12 12v8M9 20h6',
}

const FILLED = new Set(['play', 'stop', 'diamond'])

export function Icon({ name, size = 18, strokeWidth = 1.8, className }) {
  const filled = FILLED.has(name)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

export function StatusChip({ status }) {
  return (
    <span className={`chip tone-${status.tone}`}>
      <Icon name={status.icon} size={13} strokeWidth={2.4} className="status-icon" />
      {status.label}
    </span>
  )
}

// Boxline: a pit box outline with a car's nose chevron entering it, drawn for this app.
export function ProductMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2557e8" />
      <rect x="7" y="8.5" width="18" height="15" rx="2.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M11 16h10M17 12l4 4-4 4" stroke="#c6f432" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
