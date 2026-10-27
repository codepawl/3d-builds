// Status icons: every state has its own shape, so a status reads without its text or colour.
const ALERT = new Set(['warn', 'hold', 'nogo'])

// Motion and position states get their own glyph; the colour still comes from the state's kind.
const SHAPE_BY_TEXT = [
  [/holding pattern/i, 'loop'],
  [/boostback/i, 'boostback'],
  [/landing burn/i, 'descent'],
  [/ascent|ship burn/i, 'ascent'],
  [/drifting/i, 'drift'],
  [/parked|on mount|safed on stand|at staging stand/i, 'parked'],
  [/lifting|test lift|slewing/i, 'lift'],
  [/transferring/i, 'transfer'],
  [/refilling|fuelling|fuelled/i, 'refill'],
  [/rolling/i, 'rolling'],
  [/driving|patrolling/i, 'driving'],
]

export function shapeOf(status) {
  const match = SHAPE_BY_TEXT.find(([pattern]) => pattern.test(status.text ?? ''))
  return match ? match[1] : status.kind
}

const GLYPH_PATHS = {
  ascent: 'M8 14V3M3.5 7.5L8 3l4.5 4.5',
  descent: 'M8 2v11M3.5 8.5L8 13l4.5-4.5',
  boostback: 'M4 14V7a3.5 3.5 0 0 1 7 0v6M8.3 10.7L11 13.4l2.7-2.7',
  loop: 'M5 3.5h6a3.5 3.5 0 0 1 0 7H5a3.5 3.5 0 0 1 0-7zM9.2 1.8l2 1.7-2 1.7',
  driving: 'M5.5 3l5 5-5 5',
  rolling: 'M3 3l5 5-5 5M8.5 3l5 5-5 5',
  drift: 'M1.5 6c2-2 3.5-2 5 0s3 2 5 0M1.5 11c2-2 3.5-2 5 0s3 2 5 0',
  lift: 'M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4',
  transfer: 'M2.5 5.5h10M9.5 2.5l3 3-3 3M13.5 10.5h-10M6.5 7.5l-3 3 3 3',
  refill: 'M8 1.8c3 3.7 4.5 5.8 4.5 8a4.5 4.5 0 0 1-9 0c0-2.2 1.5-4.3 4.5-8z',
}

export function StatusIcon({ kind = 'idle', shape, size = 14 }) {
  const color = ALERT.has(kind) ? 'var(--alert)' : 'var(--ink)'
  const common = { width: size, height: size, viewBox: '0 0 16 16', className: `status-icon status-${kind}`, 'aria-label': kind, role: 'img' }
  if (shape === 'parked') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="10" height="10" rx="1.5" fill={color} />
      </svg>
    )
  }
  if (GLYPH_PATHS[shape]) {
    return (
      <svg {...common}>
        <path d={GLYPH_PATHS[shape]} fill={shape === 'refill' ? color : 'none'} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'go') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'active') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.3" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M8 1.7a6.3 6.3 0 0 1 0 12.6z" fill={color} />
      </svg>
    )
  }
  if (kind === 'hold') {
    return (
      <svg {...common}>
        <rect x="1.2" y="1.2" width="13.6" height="13.6" rx="2.5" fill={color} />
        <rect x="5" y="4.5" width="2" height="7" fill="#fff" />
        <rect x="9" y="4.5" width="2" height="7" fill="#fff" />
      </svg>
    )
  }
  if (kind === 'warn') {
    return (
      <svg {...common}>
        <path d="M8 1.3l7 12.6H1z" fill={color} strokeLinejoin="round" />
        <rect x="7.1" y="5.6" width="1.8" height="4.6" fill="#fff" />
        <rect x="7.1" y="11.2" width="1.8" height="1.7" fill="#fff" />
      </svg>
    )
  }
  if (kind === 'nogo') {
    return (
      <svg {...common}>
        <path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" fill={color} />
        <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'done') {
    return (
      <svg {...common}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke={color} strokeWidth="1.5" />
        <path d="M4.6 8.2l2.3 2.3 4.5-4.8" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2.4 2.2" />
    </svg>
  )
}

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Tideline">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="var(--ink)" />
      <path d="M12 4.5c2.2 2 3.2 4.6 3.2 7.6v4.4H8.8v-4.4c0-3 1-5.6 3.2-7.6z" fill="#fff" />
      <path d="M4.5 19.2c2.4-1.4 4.6-1.4 7.5 0s5.1 1.4 7.5 0" fill="none" stroke="var(--alert)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function GlyphButtonIcon({ name }) {
  const paths = {
    plus: 'M8 3v10M3 8h10',
    minus: 'M3 8h10',
    left: 'M10.5 3.5L6 8l4.5 4.5M3 8',
    right: 'M5.5 3.5L10 8l-4.5 4.5',
    home: 'M2.5 8L8 3l5.5 5M4.5 6.5V13h7V6.5',
    top: 'M3 3h10v10H3zM8 6v4M6 8h4',
    follow: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
