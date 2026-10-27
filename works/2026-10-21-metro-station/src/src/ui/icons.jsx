// Each state has its own silhouette so it reads without colour: circle+play, square+pause, octagon, triangle,
// u-turn, diamond, hexagon, check, hollow circle, ring+dot, speech bubble.
const COLORS = {
  running: '#16a06a',
  dwell: '#2f6fdd',
  held: '#e08a00',
  fault: '#e5484d',
  turnback: '#7c4dde',
  depot: '#7b8794',
  maintenance: '#c9930a',
  done: '#16a06a',
  next: '#9aa7b4',
  active: '#0f9d8f',
  info: '#2f6fdd',
  resolved: '#16a06a',
  open: '#e5484d',
}

export function StatusIcon({ kind, size = 16 }) {
  const color = COLORS[kind] ?? '#7b8794'
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, className: 'status-icon', style: { flex: 'none' } }
  switch (kind) {
    case 'running':
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /><path d="M6.2 4.8 L11.2 8 L6.2 11.2 Z" fill="#fff" /></svg>)
    case 'dwell':
      return (<svg {...common}><rect x="1.5" y="1.5" width="13" height="13" rx="3.2" fill={color} /><rect x="5" y="4.5" width="2" height="7" rx="0.8" fill="#fff" /><rect x="9" y="4.5" width="2" height="7" rx="0.8" fill="#fff" /></svg>)
    case 'held':
      return (<svg {...common}><path d="M5.2 1 H10.8 L15 5.2 V10.8 L10.8 15 H5.2 L1 10.8 V5.2 Z" fill={color} /><rect x="4.5" y="7" width="7" height="2" rx="1" fill="#fff" /></svg>)
    case 'fault':
    case 'open':
      return (<svg {...common}><path d="M8 1.2 L15.2 14 H0.8 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="1.2" /><rect x="7.2" y="5.6" width="1.6" height="4.4" rx="0.8" fill="#fff" /><circle cx="8" cy="11.9" r="1" fill="#fff" /></svg>)
    case 'turnback':
      return (<svg {...common}><rect x="1" y="1" width="14" height="14" rx="4" fill={color} /><path d="M5 11.5 V6.5 A3 3 0 0 1 11 6.5 V8.5 M9.2 6.8 L11 8.8 L12.8 6.8" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'depot':
      return (<svg {...common}><path d="M8 1 L15 8 L8 15 L1 8 Z" fill={color} /></svg>)
    case 'maintenance':
      return (<svg {...common}><path d="M8 0.8 L14.2 4.4 V11.6 L8 15.2 L1.8 11.6 V4.4 Z" fill={color} /><circle cx="8" cy="8" r="2.2" fill="#fff" /></svg>)
    case 'done':
    case 'resolved':
      return (<svg {...common}><circle cx="8" cy="8" r="7" fill={color} /><path d="M4.6 8.2 L7 10.5 L11.4 5.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>)
    case 'next':
      return (<svg {...common}><circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.6" /></svg>)
    case 'active':
      return (<svg {...common}><circle cx="8" cy="8" r="6.6" fill="none" stroke={color} strokeWidth="1.8" /><circle cx="8" cy="8" r="2.8" fill={color} /></svg>)
    case 'info':
      return (<svg {...common}><path d="M2 2.5 H14 V11 H9.4 L6 14.2 V11 H2 Z" fill={color} strokeLinejoin="round" /><rect x="7.2" y="4.6" width="1.6" height="4" rx="0.8" fill="#fff" /></svg>)
    default:
      return (<svg {...common}><circle cx="8" cy="8" r="6" fill={color} /></svg>)
  }
}

export function GlyphTrain({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="2.5" width="14" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="5.5" y="5" width="9" height="4" rx="1" fill="currentColor" /><circle cx="7" cy="12" r="1" fill="currentColor" /><circle cx="13" cy="12" r="1" fill="currentColor" /><path d="M6 17.5 L8 14.8 M14 17.5 L12 14.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>)
}

export function GlyphClock({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M10 5.5 V10 L13 11.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>)
}

export function GlyphCheck({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 10.3 L9 12.8 L13.6 7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>)
}

export function GlyphPeople({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="6.5" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M2 16 C2 12.5 4 11.2 7 11.2 C10 11.2 12 12.5 12 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="14" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M13.5 11.4 C16 11.4 18 12.5 18 15.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>)
}

export function GlyphPlus() {
  return (<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4 V16 M4 10 H16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>)
}
export function GlyphMinus() {
  return (<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10 H16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>)
}
export function GlyphOrbit() {
  return (<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="10" rx="7.5" ry="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(-24 10 10)" /><circle cx="10" cy="10" r="2.3" fill="currentColor" /></svg>)
}
export function GlyphHome() {
  return (<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9.5 L10 3.5 L17 9.5 M5 8.5 V16 H15 V8.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>)
}
export function GlyphTop() {
  return (<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="10" cy="10" r="2.2" fill="currentColor" /></svg>)
}
export function GlyphSearch() {
  return (<svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>)
}
export function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0f9d8f" />
      <path d="M9 27 C14 27 14 13 20 13 C26 13 26 27 31 27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="9" cy="27" r="2.6" fill="#ff7a59" stroke="#fff" strokeWidth="1.4" />
      <circle cx="31" cy="27" r="2.6" fill="#ff7a59" stroke="#fff" strokeWidth="1.4" />
      <circle cx="20" cy="13" r="2.6" fill="#fff" />
    </svg>
  )
}

export function GlyphPlay({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8 L12.8 8 L4.5 13.2 Z" fill="currentColor" /></svg>)
}

export function GlyphPause({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><rect x="3.6" y="3" width="3" height="10" rx="1" fill="currentColor" /><rect x="9.4" y="3" width="3" height="10" rx="1" fill="currentColor" /></svg>)
}

export function GlyphStep({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3 L9.6 8 L3 13 Z" fill="currentColor" /><rect x="11" y="3" width="2.2" height="10" rx="1" fill="currentColor" /></svg>)
}

export function GlyphChevron({ size = 16, direction = 'right' }) {
  const path = direction === 'right' ? 'M6 3.5 L10.5 8 L6 12.5' : 'M10 3.5 L5.5 8 L10 12.5'
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>)
}

export function GlyphRoute({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.6" cy="12" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12.4" cy="4" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 12 H9 A2.4 2.4 0 0 0 9 7.2 H7 A2.4 2.4 0 0 1 7 4 H10.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>)
}

export function GlyphFollow({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.4" fill="currentColor" /><path d="M8 1.5 V4 M8 12 V14.5 M1.5 8 H4 M12 8 H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>)
}
