// Inline SVG icons. Status icons use a different shape per state so a glance is enough.

const TONE_COLORS = {
  ok: 'var(--ok)',
  busy: 'var(--brand)',
  moving: 'var(--info)',
  warn: 'var(--warn)',
  critical: 'var(--critical)',
  idle: 'var(--muted)',
  charging: 'var(--ok)',
}

export function StatusIcon({ tone, size = 14 }) {
  const color = TONE_COLORS[tone]
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, className: 'status-icon' }
  if (tone === 'ok') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tone === 'busy') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M6.4 5.2v5.6L11 8z" fill="#fff" />
      </svg>
    )
  }
  if (tone === 'moving') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="14" height="14" rx="4" fill={color} />
        <path d="M4.5 8h6.5M8.5 5l3 3-3 3" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tone === 'warn') {
    return (
      <svg {...common}>
        <path d="M8 1.2l7 12.6H1z" fill={color} strokeLinejoin="round" />
        <path d="M8 6v3.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="8" cy="11.7" r="0.95" fill="#fff" />
      </svg>
    )
  }
  if (tone === 'critical') {
    return (
      <svg {...common}>
        <path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" fill={color} />
        <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  if (tone === 'charging') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="14" height="14" rx="4" fill={color} />
        <path d="M9 3.5L5.2 8.6h2.6L7 12.5l3.8-5.1H8.2z" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

const PATHS = {
  search: 'M11 11l4 4M7 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z',
  bell: 'M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.5H2.8zM6.5 14.5a1.6 1.6 0 0 0 3 0',
  chevronDown: 'M4 6l4 4 4-4',
  chevronRight: 'M6 4l4 4-4 4',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
  rotateLeft: 'M3.5 4.5v3h3M3.9 7.4A5 5 0 1 1 5 11.6',
  rotateRight: 'M12.5 4.5v3h-3M12.1 7.4A5 5 0 1 0 11 11.6',
  home: 'M2.5 7.5L8 3l5.5 4.5M4 6.5V13h8V6.5',
  close: 'M4 4l8 8M12 4l-8 8',
  rack: 'M3.5 1.5h9v13h-9zM5.5 4.5h5M5.5 7h5M5.5 9.5h5M5.5 12h2',
  robot: 'M2.5 6.5h11v5h-11zM4.5 13.5a1 1 0 1 0 0-.1M11.5 13.5a1 1 0 1 0 0-.1M8 6.5v-3M6.5 3.5h3',
  person: 'M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14.5c.4-3 2.4-4.8 5-4.8s4.6 1.8 5 4.8',
  fan: 'M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM8 6.5C7 3 9.5 1.5 11 3s-1 3.5-3 3.5zM9.5 8c3.5-1 5 1.5 3.5 3s-3.5-1-3.5-3zM6.5 8c-3.5 1-5-1.5-3.5-3s3.5 1 3.5 3zM8 9.5c1 3.5-1.5 5-3 3.5s1-3.5 3-3.5z',
  bolt: 'M9 1.5L3.5 9h4L7 14.5 12.5 7h-4z',
  battery: 'M2 5h10.5v6H2zM12.5 7h1.5v2h-1.5M4 7v2M6 7v2M8 7v2',
  spark: 'M8 1.5l1.6 4.9 4.9 1.6-4.9 1.6L8 14.5l-1.6-4.9L1.5 8l4.9-1.6z',
  stream: 'M2 4.5h8M2 8h12M2 11.5h6',
  chip: 'M4.5 4.5h7v7h-7zM6.5 2v2.5M9.5 2v2.5M6.5 11.5V14M9.5 11.5V14M2 6.5h2.5M2 9.5h2.5M11.5 6.5H14M11.5 9.5H14',
  gauge: 'M2.5 11.5a5.5 5.5 0 1 1 11 0M8 11.5l2.5-3.5',
  tokens: 'M2 5l6-3 6 3-6 3zM2 8l6 3 6-3M2 11l6 3 6-3',
  pin: 'M8 14.5s-4.5-4.4-4.5-8a4.5 4.5 0 0 1 9 0c0 3.6-4.5 8-4.5 8zM8 8a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 8 8z',
}

export function Icon({ name, size = 16, strokeWidth = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="8" y="7.5" width="16" height="4" rx="1.6" fill="#fff" />
      <rect x="8" y="14" width="16" height="4" rx="1.6" fill="#fff" opacity="0.7" />
      <rect x="8" y="20.5" width="16" height="4" rx="1.6" fill="#fff" opacity="0.45" />
      <circle cx="21.2" cy="9.5" r="1.2" fill="#3cc8f0" />
      <circle cx="21.2" cy="16" r="1.2" fill="#ffb02e" />
    </svg>
  )
}
