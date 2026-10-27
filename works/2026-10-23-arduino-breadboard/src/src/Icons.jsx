// Small inline icons. Each status icon has its own shape, so state never depends on colour alone.
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const IconCheck = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path d="M8 12.5l2.6 2.6L16 9.5" stroke="var(--on-fill)" /></svg>
export const IconCurrent = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" /></svg>
export const IconNext = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="9" strokeDasharray="3 3.2" /></svg>
export const IconLabels = (props) => <svg {...base} {...props}><path d="M4 12V5a1 1 0 011-1h7l8 8-8 8z" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /></svg>
export const IconReset = (props) => <svg {...base} {...props}><path d="M4 12a8 8 0 108-8H8" /><path d="M11 1l-3 3 3 3" /></svg>
export const IconTheme = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 000 16z" fill="currentColor" stroke="none" /></svg>
export const IconEye = (props) => <svg {...base} {...props}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
export const IconArrowRight = (props) => <svg {...base} {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const IconArrowLeft = (props) => <svg {...base} {...props}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
export const IconHigh = (props) => <svg {...base} {...props}><path d="M12 19V6M6 11l6-6 6 6" /></svg>
export const IconLow = (props) => <svg {...base} {...props}><path d="M12 5v13M6 13l6 6 6-6" /></svg>
export const IconBolt = (props) => <svg {...base} {...props}><path d="M13 3L5 14h6l-1 7 8-11h-6z" fill="currentColor" stroke="none" /></svg>
export const IconClock = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
export const IconWave = (props) => <svg {...base} {...props}><path d="M3 17V8h5v9h5V8h5v9h3" /></svg>
export const IconKnob = (props) => <svg {...base} {...props}><circle cx="12" cy="12" r="8" /><path d="M12 12L16.5 7.5" /></svg>
export const IconServo = (props) => <svg {...base} {...props}><rect x="3" y="10" width="13" height="9" rx="2" /><path d="M16 14.5h5M12 10V6M12 6l4-2" /></svg>
export const IconHand = (props) => <svg {...base} {...props}><rect x="6" y="9" width="12" height="9" rx="3" /><path d="M9 9V6M15 9V6M12 9V4" /></svg>
export const IconWalk = (props) => <svg {...base} {...props}><circle cx="12" cy="5" r="2" /><path d="M12 8v6M12 10l-3 3M12 10l3 3M12 14l-3 6M12 14l3 6" /></svg>
export const IconStop = (props) => <svg {...base} {...props}><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" stroke="none" /></svg>
export const IconChip = (props) => <svg {...base} width={26} height={26} {...props}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></svg>
export const IconPlay = (props) => <svg {...base} {...props}><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" /></svg>
