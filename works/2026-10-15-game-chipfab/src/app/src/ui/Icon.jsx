// Stroke icons on a 24-unit grid. Status icons each have a distinct shape so states read at a glance.

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
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  // things
  wafer: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10.5 3.2L12 5l1.5-1.8M7 9h10M6 13h12M8 17h8M10 6v14M14 6v14',
  pod: 'M5 8h14v11H5zM7 8V5h10v3M5 13h14M10 16h4',
  litho: 'M4 20h16M6 20V10h12v10M9 10V6h6v4M12 2v4M9 14h6',
  etch: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM10 9.5l-3.5 6M14 9.5l3.5 6M7.5 17.5h9',
  dep: 'M4 20h16M6 20v-6a6 6 0 0 1 12 0v6M12 4v4M9 6l3-2 3 2',
  implant: 'M3 12h9M9 9l3 3-3 3M14 6h6v12h-6z',
  furnace: 'M7 3h10v18H7zM10 7h4M10 11h4M10 15h4',
  cmp: 'M12 5a7 3 0 1 0 0 6 7 3 0 0 0 0-6zM5 8v6c0 1.7 3.1 3 7 3s7-1.3 7-3V8M15 3v5',
  metro: 'M4 20h16M8 20v-4h8v4M12 16V8M9 5h6v3H9zM12 3v2',
  wet: 'M3 10h18v9H3zM7 10V6M17 10V6M7 6h10M8 14h2M14 14h2',
  oht: 'M3 4h18M8 4v3M16 4v3M6 7h12v6H6zM12 13v4M9 17h6v3H9z',
  stocker: 'M4 4h16v16H4zM4 9h16M4 14h16M12 4v16',
  person: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21v-5a6 6 0 0 1 12 0v5',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10',
  building: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h2M13 11h2',
  water: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6z',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM16 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M3 20h18',
  yield: 'M4 20V10M10 20V4M16 20v-8M3 20h18',
  cycle: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4M12 8v4l3 2',
  open: 'M14 4h6v6M20 4l-8 8M18 14v6H4V6h6',
  // status shapes
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  wrench: 'M15 4a5 5 0 0 0-5.6 6.6L3.5 16.5a2 2 0 0 0 2.8 2.8l5.9-5.9A5 5 0 0 0 19 8l-3 1-2-2 1-3z',
  arrow: 'M5 12h12M13 7l5 5-5 5',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  check: 'M5 12.5l4.5 4.5L19 7',
  swap: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  stack: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  loop: 'M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0M17 6l3 2-3 2',
  down: 'M12 4v14M6 12l6 6 6-6',
  up: 'M12 20V6M6 12l6-6 6 6',
  walk: 'M13 4a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 13 4zM10 21l2-6 3 3v3M12 15l1-5 3 3h3M13 10l-4 1-2 3',
  tablet: 'M6 3h12v18H6zM10 18h4',
  stop: 'M6 6h12v12H6z',
}

const FILLED = new Set(['play', 'stop'])

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

// Waferline: a wafer with its notch and a die grid, drawn for this app.
export function ProductMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#13a594" />
      <circle cx="16" cy="16" r="9.5" fill="#fff" />
      <path d="M14.4 6.6L16 8.4l1.6-1.8" fill="#13a594" />
      <path d="M10 13h12M9 16.5h14M10 20h12M13 9.5v13M16.5 9v14M20 9.5v13" stroke="#13a594" strokeWidth="1" opacity="0.55" />
      <rect x="16.5" y="13" width="3.5" height="3.5" fill="#ffb020" />
    </svg>
  )
}
