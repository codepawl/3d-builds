// Small inline icons. Every status gets its own shape so state never relies on colour alone.
const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SHAPES = {
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  triangle: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  octagon: <><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" /><path d="M12 8v5M12 16v.1" /></>,
  arrow: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M13 8.5l3.5 3.5-3.5 3.5" /></>,
  scan: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /></>,
  pause: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9v6M14.5 9v6" /></>,
  square: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 12h8" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  box: <><path d="M3.5 8l8.5-4.5L20.5 8v8.5L12 21l-8.5-4.5z" /><path d="M8 12.5l3 3 5-6" /></>,
  shuffle: <><path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" /></>,
  bag: <><rect x="5" y="7" width="14" height="13" rx="3" /><path d="M9 7V4.5h6V7M9 12v3M15 12v3" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  plane: <><path d="M21 15l-8-4.5V5a1.5 1.5 0 00-3 0v5.5L2 15v2l8-2v4l-2 1.5V22l4-1 4 1v-1.5L14 19v-4l7 2z" /></>,
  alert: <><path d="M12 3a6 6 0 016 6v4l2 3H4l2-3V9a6 6 0 016-6z" /><path d="M10 19a2 2 0 004 0" /></>,
  up: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  down: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
  flat: <><path d="M5 12h14" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  home: <><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></>,
  orbit: <><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 4v5h-5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  magnifier: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  user: <><circle cx="12" cy="8.5" r="3.7" /><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10.2 8.6l5 3.4-5 3.4z" fill="currentColor" /></>,
  stepForward: <><circle cx="12" cy="12" r="9" /><path d="M9 8.5l4.5 3.5L9 15.5zM15.5 8.5v7" /></>,
  previous: <><path d="M14.5 5l-7 7 7 7" /></>,
  next: <><path d="M9.5 5l7 7-7 7" /></>,
  route: <><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="6" r="2.4" /><path d="M8 17c6 0 2-10 8-10" /></>,
  hourglass: <><path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5" /></>,
  ring: <><circle cx="12" cy="12" r="8" /></>,
  site: <><path d="M3 20V9l9-5 9 5v11z" /><path d="M9 20v-6h6v6" /></>,
};

const STATUS_SHAPE = {
  checked: ['tag', '#2563eb'],
  screened: ['check', '#0f9d76'],
  sorted: ['shuffle', '#2563eb'],
  loaded: ['box', '#0f9d76'],
  alarm: ['octagon', '#e5484d'],
  searching: ['search', '#d9822b'],
  scanning: ['scan', '#2563eb'],
  idle: ['pause', '#6b7a8c'],
  ok: ['check', '#0f9d76'],
  open: ['check', '#0f9d76'],
  closed: ['square', '#6b7a8c'],
  moving: ['arrow', '#2563eb'],
  warning: ['triangle', '#d9822b'],
  missing: ['octagon', '#e5484d'],
};

export function Icon({ name, size = 18 }) {
  return (
    <svg {...common} width={size} height={size} aria-hidden="true">
      {SHAPES[name]}
    </svg>
  );
}

export function StatusIcon({ status, size = 18 }) {
  const [shape, color] = STATUS_SHAPE[status] ?? STATUS_SHAPE.ok;
  return (
    <span className="status-icon" style={{ color }}>
      <Icon name={shape} size={size} />
    </span>
  );
}

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1d6bff" />
      <rect x="8" y="12" width="16" height="12" rx="3.2" fill="#fff" />
      <path d="M12.5 12V9.6h7V12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M9 20.5h14" stroke="#1d6bff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
