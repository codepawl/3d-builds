// Every state has its own silhouette so it reads without colour.
const COLORS = {
  queued: '#7b8794',
  moving: '#16a06a',
  closing: '#e08a00',
  filling: '#2f6fdd',
  emptying: '#7c4dde',
  holding: '#c9930a',
  cleared: '#16a06a',
  done: '#16a06a',
  next: '#9aa7b4',
  active: '#0f9d8f',
  level: '#16a06a',
  info: '#2f6fdd',
  alert: '#e5484d',
}

export function StatusIcon({ kind, size = 16 }) {
  const color = COLORS[kind] ?? '#7b8794'
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, className: 'status-icon', style: { flex: 'none' } }
  switch (kind) {
    case 'moving':
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /><path d="M6.2 4.8 L11.2 8 L6.2 11.2 Z" fill="#fff" /></svg>)
    case 'queued':
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /><path d="M8 4.2 V8.2 L10.6 9.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'closing':
      return (<svg {...common}><path d="M5.2 1 H10.8 L15 5.2 V10.8 L10.8 15 H5.2 L1 10.8 V5.2 Z" fill={color} /><path d="M4.8 8 H11.2 M9 5.8 L11.2 8 L9 10.2" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'filling':
      return (<svg {...common}><rect x="1.2" y="1.2" width="13.6" height="13.6" rx="3.6" fill={color} /><path d="M8 11.8 V4.8 M5.2 7.4 L8 4.6 L10.8 7.4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'emptying':
      return (<svg {...common}><rect x="1.2" y="1.2" width="13.6" height="13.6" rx="3.6" fill={color} /><path d="M8 4.2 V11.2 M5.2 8.6 L8 11.4 L10.8 8.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'holding':
      return (<svg {...common}><path d="M8 0.8 L14.2 4.4 V11.6 L8 15.2 L1.8 11.6 V4.4 Z" fill={color} /><rect x="5.3" y="5" width="1.8" height="6" rx="0.7" fill="#fff" /><rect x="8.9" y="5" width="1.8" height="6" rx="0.7" fill="#fff" /></svg>)
    case 'alert':
      return (<svg {...common}><path d="M8 1.2 L15.2 14 H0.8 Z" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round" /><rect x="7.2" y="5.6" width="1.6" height="4.4" rx="0.8" fill="#fff" /><circle cx="8" cy="11.9" r="1" fill="#fff" /></svg>)
    case 'cleared':
    case 'done':
    case 'level':
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /><path d="M4.6 8.2 L7 10.5 L11.4 5.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'active':
      return (<svg {...common}><circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.8" /><circle cx="8" cy="8" r="2.6" fill={color} /></svg>)
    case 'next':
      return (<svg {...common}><circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.8" /></svg>)
    default:
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /></svg>)
  }
}

const glyph = (size, children) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const GlyphShip = ({ size = 18 }) => glyph(size, <><path d="M3 15 L5 19 H19 L21 15 Z" /><path d="M7 15 V10 H17 V15 M10 10 V6 H14 V10" /></>)
export const GlyphClock = ({ size = 18 }) => glyph(size, <><circle cx="12" cy="12" r="9" /><path d="M12 7 V12 L15.5 14" /></>)
export const GlyphDrop = ({ size = 18 }) => glyph(size, <path d="M12 3 C12 3 5.5 10 5.5 14.5 A6.5 6.5 0 0 0 18.5 14.5 C18.5 10 12 3 12 3 Z" />)
export const GlyphQueue = ({ size = 18 }) => glyph(size, <><circle cx="8" cy="8" r="3" /><path d="M2.5 19 A5.5 5.5 0 0 1 13.5 19" /><circle cx="17" cy="9" r="2.4" /><path d="M15.5 19 A4.5 4.5 0 0 1 22 17" /></>)
export const GlyphPlus = ({ size = 20 }) => glyph(size, <path d="M12 5 V19 M5 12 H19" />)
export const GlyphMinus = ({ size = 20 }) => glyph(size, <path d="M5 12 H19" />)
export const GlyphOrbit = ({ size = 20 }) => glyph(size, <><ellipse cx="12" cy="12" rx="9" ry="4.2" /><circle cx="12" cy="12" r="1.8" /></>)
export const GlyphHome = ({ size = 20 }) => glyph(size, <path d="M4 11 L12 4 L20 11 V19 H14.5 V14 H9.5 V19 H4 Z" />)
export const GlyphTop = ({ size = 20 }) => glyph(size, <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8 V16 M8.5 11.5 L12 8 L15.5 11.5" /></>)
export const GlyphPlay = ({ size = 18 }) => glyph(size, <path d="M8 5.5 L18 12 L8 18.5 Z" fill="currentColor" />)
export const GlyphPause = ({ size = 18 }) => glyph(size, <path d="M8.5 6 V18 M15.5 6 V18" strokeWidth="2.6" />)
export const GlyphStep = ({ size = 18 }) => glyph(size, <path d="M6 6 L14 12 L6 18 Z M18 6 V18" />)
export const GlyphTour = ({ size = 18 }) => glyph(size, <><circle cx="6" cy="17" r="2" /><circle cx="18" cy="7" r="2" /><path d="M8 17 H13 A3 3 0 0 0 13 11 H11 A3 3 0 0 1 11 7 H16" /></>)
export const GlyphPrevious = ({ size = 16 }) => glyph(size, <path d="M14.5 6 L8.5 12 L14.5 18" />)
export const GlyphNext = ({ size = 16 }) => glyph(size, <path d="M9.5 6 L15.5 12 L9.5 18" />)
export const GlyphFollow = ({ size = 16 }) => glyph(size, <><circle cx="12" cy="12" r="3" /><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21" /></>)
export const GlyphSearch = ({ size = 18 }) => glyph(size, <><circle cx="11" cy="11" r="6.5" /><path d="M16 16 L20.5 20.5" /></>)

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0f9d8f" />
      <path d="M6 22 H12 V17 H18 V12 H26" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 26 C10 24 12 28 16 26 C20 24 22 28 26 26" fill="none" stroke="#bff2ea" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
