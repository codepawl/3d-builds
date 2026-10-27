// Stroke icons on a 24-unit grid. Status icons each have a distinct shape so states read at a glance.

const PATHS = {
  bed: 'M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
  ambulance: 'M2 16V7h11v9M13 10h4l4 4v2h-8M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM7.5 9v4M5.5 11h4',
  heli: 'M3 5h18M12 5v3M6 11a3 3 0 0 1 3-3h5a4 4 0 0 1 0 8H9a3 3 0 0 1-3-3zM18 12h3M7 19h9M9 16v3M14 16v3',
  scan: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20h18',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  stethoscope: 'M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2M20 11a1.6 1.6 0 1 0 0-.01',
  clipboard: 'M8 4h8v3H8zM6 5.5H5v15h14v-15h-1M8.5 12h7M8.5 16h5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  seat: 'M6 4v9h11M6 13v7M17 13v7M6 17h11M9 9h8',
  door: 'M5 21V3h11v18M16 7h3v14M12 12h.01',
  users: 'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20v-3a5 5 0 0 1 10 0v3M16 4.5a3 3 0 0 1 0 5.6M18 20v-3a5 5 0 0 0-2.5-4.3',
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
  pod: 'M5 8h14v11H5zM7 8V5h10v3M5 13h14M10 16h4',
  robot: 'M4 10h16v6H4zM6 16v2M18 16v2M8 10V8h8v2M9 13h.01M15 13h.01',
  shelf: 'M5 3h14v18H5zM5 8h14M5 13h14M5 18h14M10 3v18M14 3v18',
  station: 'M3 20h18M5 20V9h14v11M8 9V5h8v4M9 13h6M12 13v4',
  box: 'M3 8l9-4 9 4v9l-9 4-9-4zM3 8l9 4 9-4M12 12v9',
  cart: 'M3 4h2l2.5 11h11l2-8H6.5M9 20a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 9 20zM17 20a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.2-2.3L4 14.5a1.5 1.5 0 0 1 2.5-1.6L8 15',
  sorter: 'M3 8h18M3 16h18M6 8v8M12 8v8M18 8v8M3 8a4 4 0 0 0 0 8M21 8a4 4 0 0 1 0 8',
  van: 'M2 7h12l4 4h4v6H2zM14 7v4h4M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  bike: 'M5.5 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 15.5l4-7h6l3 7M9.5 8.5H7M12 15.5l3.5-7',
  battery: 'M3 8h15v8H3zM18 11h2v2h-2M6 11v2M9 11v2',
  charging: 'M3 8h15v8H3zM18 11h2v2h-2M11 9l-2 3h3l-2 3',
  drone: 'M5 5a2 2 0 1 0 0 .01M19 5a2 2 0 1 0 0 .01M5 5l5 5M19 5l-5 5M9 10h6v4H9zM12 14v3M10 19h4',
  tote: 'M3 9h18l-2 10H5zM7 9V6h10v3',
  rate: 'M4 18l5-6 4 3 7-9M15 6h5v5',
  dock: 'M3 20V6l9-3 9 3v14M7 20v-9h10v9M7 14h10M7 17h10',
  chute: 'M4 5h6l10 12v3h-4L4 8z',
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
  lift: 'M5 20h14M8 16h8v4H8zM12 4v9M8 8l4-4 4 4',
  queue: 'M4 6h3v3H4zM4 15h3v3H4zM11 7.5h9M11 16.5h9',
  diamond: 'M12 3l9 9-9 9-9-9z',
}

const FILLED = new Set(['play', 'stop', 'diamond'])

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

// Bayflow: a bed seen from above inside a flowing arc, drawn for this app.
export function ProductMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2f6fe4" />
      <path d="M8 21.5a9 9 0 0 1 14.5-11.2" stroke="#9cc0ff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M21 7.4l1.9 3-3.4.6" stroke="#9cc0ff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11" y="13.5" width="13" height="8.5" rx="2.2" fill="#fff" />
      <rect x="12.6" y="15.2" width="3.2" height="5" rx="1.2" fill="#2f6fe4" />
    </svg>
  )
}
