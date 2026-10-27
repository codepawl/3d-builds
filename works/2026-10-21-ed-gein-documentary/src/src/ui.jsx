import { useEffect, useRef, useState } from 'react'
import { CONFIDENCE, END, EVENTS, SOURCES, factRows, momentById, momentIndex } from './data.js'
import { HOUR_TEXT } from './beats.js'
import { easeInOut, tween } from './anim.js'
import { isMuted, onMutedChange, playClick, setMuted } from './sound.js'

// ---------- portrait ----------

// Tall viewports (a phone, the vertical film) stack the timeline and give the scene the middle of the frame.
const PORTRAIT_QUERY = '(max-aspect-ratio: 1/1)'

export function usePortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(PORTRAIT_QUERY)
    const onChange = () => setPortrait(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return portrait
}

// ---------- small pieces ----------

// Each confidence mark has its own icon shape: two discs, one ring, a half-filled diamond, a dashed square.
export function MarkIcon({ mark, size = 16 }) {
  const stroke = 'currentColor'
  if (mark === '2S') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="5.5" cy="8" r="4" fill={stroke} />
        <circle cx="10.5" cy="8" r="4" fill={stroke} opacity="0.6" />
      </svg>
    )
  }
  if (mark === '1S') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5" fill="none" stroke={stroke} strokeWidth="1.8" />
      </svg>
    )
  }
  if (mark === 'D') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="none" stroke={stroke} strokeWidth="1.6" />
        <path d="M8 1.5 8 14.5 1.5 8Z" fill={stroke} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke={stroke} strokeWidth="1.6" strokeDasharray="2.6 2" />
    </svg>
  )
}

// Fades its content in on mount, on the animation clock.
export function FadeIn({ children, className, duration = 450 }) {
  const ref = useRef(null)
  useEffect(() => {
    const element = ref.current
    element.style.opacity = '0'
    tween(duration, (progress) => {
      element.style.opacity = String(progress)
      element.style.transform = `translateY(${(1 - progress) * 6}px)`
    })
  }, [duration])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

// Moves a rail's fill and needle to a new fraction over 0.7 s, on the animation clock.
function useRailFill(fraction) {
  const fillRef = useRef(null)
  const needleRef = useRef(null)
  const currentRef = useRef(fraction)
  useEffect(() => {
    const from = currentRef.current
    tween(700, (progress) => {
      const value = from + (fraction - from) * easeInOut(progress)
      currentRef.current = value
      if (fillRef.current) fillRef.current.style.width = `${value * 100}%`
      if (needleRef.current) needleRef.current.style.left = `${value * 100}%`
    })
  }, [fraction])
  return { fillRef, needleRef, initial: `${currentRef.current * 100}%` }
}

// ---------- timeline ----------

const MAIN_IDS = ['e1940', 'e1944', 'e1945', 'e1947', 'e1954', 'DAY', 'e1121', 'e1125', 'e1958a', 'e1958fire', 'e1968', 'e1984', END.id]
const DAY_IDS = ['e1957morning', 'e0930', 'e1700', 'eslip', 'enight']
const DAY_DISPLAY_HOUR = { e1957morning: 7.6, e0930: 9.5, e1700: 17, eslip: 18.7, enight: 20.6 }
const HOUR_START = 6
const HOUR_END = 24

function stopDate(id) {
  if (id === 'DAY') return '16 Nov 1957'
  if (id === END.id) return 'Whole case, 1940 to 1984'
  return EVENTS.find((event) => event.id === id).date
}

function bigDate(moment) {
  if (moment === END.id) return '1940 – 1984'
  return momentById(moment).date.replace('-', ' – ').toUpperCase()
}

// Past stops are filled, the current stop is red, later stops are hollow.
function stopClass(id, moment) {
  const reference = id === 'DAY' ? 'e1957morning' : id
  if (id === 'DAY' ? DAY_IDS.includes(moment) : id === moment) return 'now'
  return momentIndex(reference) < momentIndex(moment) ? 'past' : 'future'
}

function PlayIcon({ playing }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /> : <path d="M3 1.5v11l9.5-5.5z" fill="currentColor" />}
    </svg>
  )
}

export function Timeline({ state, actions }) {
  const moment = state.eventId
  const onDay = DAY_IDS.includes(moment)
  const mainIndex = MAIN_IDS.indexOf(onDay ? 'DAY' : moment)
  const main = useRailFill(mainIndex / (MAIN_IDS.length - 1))
  const dayFraction = onDay ? (DAY_DISPLAY_HOUR[moment] - HOUR_START) / (HOUR_END - HOUR_START) : 0
  const day = useRailFill(dayFraction)
  const select = (id) => () => actions.selectEvent(id === 'DAY' ? 'e1957morning' : id)
  return (
    <header className="timeline reserve">
      <div className="when">
        <span className="when-date">{bigDate(moment)}</span>
        {onDay ? <span className="when-hour">{HOUR_TEXT[moment]}</span> : null}
      </div>
      <div className={`day-row${onDay ? '' : ' off'}`} aria-hidden={!onDay}>
        <span className="day-end">6 AM</span>
        <div className="rail day">
          <div className="rail-fill" ref={day.fillRef} style={{ width: day.initial }} />
          {DAY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              data-event={id}
              aria-label={`16 Nov 1957, ${HOUR_TEXT[id].toLowerCase()}`}
              className={`stop ${stopClass(id, moment)}`}
              style={{ left: `${((DAY_DISPLAY_HOUR[id] - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}
              onClick={select(id)}
              tabIndex={onDay ? 0 : -1}
            />
          ))}
        </div>
        <span className="day-end">MIDNIGHT</span>
      </div>
      <div className="rail-row">
        <button type="button" className="play" aria-label={state.playing ? 'Pause' : 'Play'} onClick={actions.togglePlay}>
          <PlayIcon playing={state.playing} />
        </button>
        <span className="rail-end">1940</span>
        <div className="rail main">
          <div className="rail-fill" ref={main.fillRef} style={{ width: main.initial }} />
          {MAIN_IDS.map((id, index) => (
            <button
              key={id}
              type="button"
              data-event={id}
              aria-label={stopDate(id)}
              title={stopDate(id)}
              className={`stop ${stopClass(id, moment)}`}
              style={{ left: `${(index / (MAIN_IDS.length - 1)) * 100}%` }}
              onClick={select(id)}
            />
          ))}
        </div>
        <span className="rail-end">1984</span>
        <MuteButton />
      </div>
    </header>
  )
}

// One caption line: what is happening now. Only a disputed or later-sources fact carries its mark.
export function Caption({ text, confidence }) {
  const marked = confidence === 'D' || confidence === 'SEC'
  return (
    <FadeIn className="caption reserve">
      <p>
        {marked ? (
          <span className={`caption-mark mark-${confidence}`} title={CONFIDENCE[confidence].label}>
            <MarkIcon mark={confidence} size={18} />
            <span>{confidence === 'D' ? 'disputed' : 'later sources'}</span>
          </span>
        ) : null}
        {text}
      </p>
    </FadeIn>
  )
}

// Interface sound on or off; an icon that changes shape with the state.
export function MuteButton() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  const toggle = () => {
    setMuted(!muted)
    if (muted) playClick()
  }
  return (
    <button type="button" className="mute-button" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={muted} onClick={toggle}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M2.5 6.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor" />
        {muted ? (
          <path d="M12 6.5l4 5m0-5-4 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M12 6.2a4 4 0 0 1 0 5.6M14.2 4.2a7 7 0 0 1 0 9.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  )
}

// The facts known so far and the sources they cite. Only on the S key; never on screen by default.
export function SourcesOverlay({ moment, onClose }) {
  const rows = factRows(moment)
  const cited = new Set(rows.flatMap((row) => row.sources))
  return (
    <FadeIn className="sources-overlay" duration={300}>
      <div className="sources-scroll" onClick={onClose}>
        <h2>Known so far</h2>
        {rows.map((row, index) => (
          <p key={index} className="fact">
            <span className={`fact-mark mark-${row.confidence}`} title={CONFIDENCE[row.confidence]?.label}><MarkIcon mark={row.confidence} size={14} /></span>
            {row.fact}
          </p>
        ))}
        <h2>Sources</h2>
        {SOURCES.map((source) => (cited.has(source.id) ? <p key={source.id} className="source">{source.title}, {source.detail}</p> : null))}
        <p className="source">No 1957-68 paper was read first-hand; each is cited through a later page. Press S or Esc to close.</p>
      </div>
    </FadeIn>
  )
}

// ---------- opening ----------

export function IntroOverlay({ state, actions }) {
  if (state.intro !== 'title') return null
  return (
    <div className="intro title">
      <FadeIn className="intro-inner" duration={1200}>
        <div className="place-title">PLAINFIELD, WISCONSIN</div>
        <div className="year">1957</div>
        <button type="button" className="intro-button" onClick={actions.openCase}>
          <PlayIcon playing={false} />
          <span>Play</span>
        </button>
      </FadeIn>
    </div>
  )
}
