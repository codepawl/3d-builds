import { useEffect, useMemo, useState } from 'react'
import { Scene } from '../world/Scene.jsx'
import { loadAssets } from '../world/assets.js'
import { createSimulation } from '../sim/simulation.js'
import { sites, siteById } from '../data/canal.js'
import { getState, setState, useStore, cameraBus } from '../store.js'
import {
  SPEEDS, bindSimulation, setSpeed, togglePaused, stepOnce, goStage, nextStage, previousStage, toggleTour, stopTour, setSlowAtEvents, stepSpeed,
} from '../playback.js'
import { STAGES } from '../data/stages.js'
import {
  StatusIcon, GlyphPlay, GlyphPause, GlyphStep, GlyphTour, GlyphPrevious, GlyphNext, GlyphFollow, GlyphShip, GlyphClock, GlyphDrop, GlyphQueue, GlyphPlus, GlyphMinus, GlyphOrbit, GlyphHome, GlyphTop, GlyphSearch, Logo,
} from './icons.jsx'

const PREROLL_SECONDS = 8

export function App() {
  const [assets, setAssets] = useState(null)
  const simulation = useMemo(() => {
    const created = createSimulation()
    created.runFor(PREROLL_SECONDS)
    bindSimulation(created)
    return created
  }, [])
  useEffect(() => { loadAssets().then(setAssets) }, [])
  const ready = useStore((state) => state.snapshot !== null)
  useEffect(() => { if (ready) window.__appReady = true }, [ready])
  return (
    <div className="app">
      {assets ? <Scene assets={assets} simulation={simulation} /> : <div className="loading">Loading the locks</div>}
      <TopBar />
      <KpiCards />
      <StageBar />
      <CameraControls />
      <DetailCard />
      <Timeline />
      <ListPanel />
      <SiteVeil />
    </div>
  )
}

function switchSite(siteId) {
  if (getState().siteId === siteId) return
  stopTour()
  setState({ stageIndex: null, siteId, selected: null, detail: null, following: null, snapshot: null, switching: getState().switching + 1 })
}

function selectRow(ref, follow, extra = {}) {
  setState({ selected: ref })
  cameraBus.push({ type: 'fly', ref, follow, ...extra })
}

function TopBar() {
  const siteId = useStore((state) => state.siteId)
  const clock = useStore((state) => state.snapshot?.clock ?? '--:--')
  const snapshot = useStore((state) => state.snapshot)
  const search = useStore((state) => state.search)
  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query || !snapshot) return []
    const ships = snapshot.ships.filter((row) => row.name.toLowerCase().includes(query) || row.id.toLowerCase().includes(query)).map((row) => ({ ref: row.ref, label: row.name, detail: row.type, status: row.status, follow: true }))
    const chambers = snapshot.chambers.filter((row) => row.label.toLowerCase().includes(query)).map((row) => ({ ref: row.ref, label: row.label, detail: row.phase, status: row.phase === 'level' ? 'level' : row.phase, follow: false }))
    return [...ships, ...chambers].slice(0, 6)
  }, [search, snapshot])
  const open = (result) => {
    setState({ search: '' })
    selectRow(result.ref, result.follow)
  }
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <strong>Isthmus Lock Operations</strong>
          <span>Orrin Canal Authority</span>
        </div>
      </div>
      <div className="search">
        <GlyphSearch size={17} />
        <input
          value={search}
          placeholder="Find a ship or chamber"
          onChange={(event) => setState({ search: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) open(results[0])
            if (event.key === 'Escape') setState({ search: '' })
          }}
        />
        {results.length > 0 && (
          <div className="search-results">
            {results.map((result) => (
              <button key={result.label} className="search-row" onClick={() => open(result)}>
                <StatusIcon kind={result.status} size={14} />
                <span>{result.label}</span>
                <em>{result.detail}</em>
              </button>
            ))}
          </div>
        )}
      </div>
      <nav className="sites" aria-label="Sites">
        {sites.map((site) => (
          <button key={site.id} className={`site-button ${siteId === site.id ? 'active' : ''}`} onClick={() => switchSite(site.id)}>{site.name}</button>
        ))}
      </nav>
      <div className="clock">
        <GlyphClock size={17} />
        <span className="clock-time">{clock}</span>
      </div>
      <div className="user">
        <span className="avatar">IO</span>
        <div>
          <strong>Ines Okafor</strong>
          <span>Duty controller</span>
        </div>
      </div>
    </header>
  )
}

function KpiCards() {
  const kpis = useStore((state) => state.snapshot?.kpis)
  const siteId = useStore((state) => state.siteId)
  if (!kpis) return null
  const icons = { first: GlyphShip, second: GlyphClock, third: GlyphDrop, fourth: GlyphQueue }
  return (
    <section className="kpis" aria-label={`Key figures, ${siteById[siteId].name}`}>
      {['first', 'second', 'third', 'fourth'].map((key) => {
        const Icon = icons[key]
        const item = kpis[key]
        return (
          <article key={key} className="kpi">
            <span className="kpi-icon"><Icon size={18} /></span>
            <div>
              <span className="kpi-label">{item.label}</span>
              <strong className="kpi-value">{item.value}</strong>
              <span className="kpi-note">{item.note}</span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function CameraControls() {
  const orbiting = useStore((state) => state.orbiting)
  return (
    <div className="camera-controls" role="toolbar" aria-label="Camera">
      <button title="Zoom in" aria-label="Zoom in" onClick={() => cameraBus.push({ type: 'zoom', factor: 0.7 })}><GlyphPlus /></button>
      <button title="Zoom out" aria-label="Zoom out" onClick={() => cameraBus.push({ type: 'zoom', factor: 1.4 })}><GlyphMinus /></button>
      <button title="Orbit" aria-label="Orbit" aria-pressed={orbiting} className={orbiting ? 'on' : ''} onClick={() => cameraBus.push({ type: 'orbit' })}><GlyphOrbit /></button>
      <button title="Top view" aria-label="Top view" onClick={() => cameraBus.push({ type: 'top' })}><GlyphTop /></button>
      <button title="Reset view" aria-label="Reset view" onClick={() => cameraBus.push({ type: 'reset' })}><GlyphHome /></button>
    </div>
  )
}

function DetailCard() {
  const detail = useStore((state) => state.detail)
  const selected = useStore((state) => state.selected)
  if (!selected || !detail) return null
  return (
    <aside className="detail" key={`${selected.type}-${selected.id}`}>
      <div className="detail-head">
        <span className="detail-badge" style={{ background: detail.color }} />
        <div>
          <h2>{detail.title}</h2>
          <p>{detail.subtitle}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusIcon kind={detail.status.kind} size={18} />
        <strong>{detail.status.label}</strong>
      </div>
      <dl className="detail-fields">
        {detail.fields.map(([label, value]) => (
          <div key={label} className="detail-field">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {detail.progress && (
        <div className="progress">
          <div className="progress-head">
            <span>{detail.progress.label}</span>
            <strong>{detail.progress.note}</strong>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(detail.progress.value * 100)}%`, background: detail.color }} /></div>
        </div>
      )}
      {(selected.type === 'ship' || selected.type === 'mule') && <FollowControls selected={selected} />}
      <p className="hint">Click empty ground or press Esc to close</p>
    </aside>
  )
}

function isTyping(event) {
  const tag = event.target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

// Keyboard: 1 to 7 pick a stage, Space pauses, - and + change the speed.
function usePlaybackKeys() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) togglePaused()
        return
      }
      if (event.key === '-' || event.key === '_') stepSpeed(-1)
      else if (event.key === '+' || event.key === '=') stepSpeed(1)
      else if (/^[1-9]$/.test(event.key) && Number(event.key) <= STAGES.length) {
        stopTour()
        goStage(Number(event.key) - 1)
      }
    }
    const onKeyUp = (event) => { if (event.key === ' ' && !isTyping(event)) event.preventDefault() }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}

function StageBar() {
  const siteId = useStore((state) => state.siteId)
  const stageIndex = useStore((state) => state.stageIndex)
  const tour = useStore((state) => state.tour)
  usePlaybackKeys()
  if (siteId !== 'flight') return null
  const statusOf = (index) => (stageIndex === null || index > stageIndex ? 'next' : index === stageIndex ? 'active' : 'done')
  const pick = (index) => {
    stopTour()
    goStage(index)
  }
  return (
    <nav className="stage-bar" aria-label="Stages of a transit">
      <div className="stage-list">
        {STAGES.map((stage, index) => (
          <button key={stage.id} className={`stage ${stageIndex === index ? 'active' : ''}`} title={`${stage.detail} (key ${stage.key})`} onClick={() => pick(index)}>
            <StatusIcon kind={statusOf(index)} size={15} />
            <kbd>{stage.key}</kbd>
            <span>{stage.label}</span>
          </button>
        ))}
      </div>
      <div className="stage-actions">
        <button className="quiet" title="Previous stage" aria-label="Previous stage" onClick={() => { stopTour(); previousStage() }}><GlyphPrevious /><span>Previous</span></button>
        <button className="quiet" title="Next stage" aria-label="Next stage" onClick={() => { stopTour(); nextStage() }}><span>Next</span><GlyphNext /></button>
        <button className={`quiet tour ${tour ? 'on' : ''}`} title="Play every stage in order" aria-pressed={Boolean(tour)} onClick={toggleTour}>
          {tour ? <StatusIcon kind="active" size={15} /> : <GlyphTour size={16} />}
          <span>{tour ? `Tour, stage ${tour.index + 1} of ${STAGES.length}` : 'Tour'}</span>
        </button>
      </div>
    </nav>
  )
}

function PlaybackControls() {
  const speed = useStore((state) => state.speed)
  const paused = useStore((state) => state.paused)
  const tour = useStore((state) => state.tour)
  const slow = useStore((state) => state.slowAtEvents)
  return (
    <div className="playback" role="toolbar" aria-label="Playback">
      <span className="playback-state">
        <StatusIcon kind={paused ? 'holding' : 'moving'} size={15} />
        <strong>{paused ? 'Paused' : `Running ${speed}x`}</strong>
      </span>
      <button className="quiet icon" title="Pause or play (Space)" aria-label={paused ? 'Play' : 'Pause'} onClick={togglePaused}>{paused ? <GlyphPlay /> : <GlyphPause />}</button>
      <div className="speeds">
        {SPEEDS.map((value) => (
          <button key={value} className={`quiet speed ${speed === value ? 'active' : ''}`} onClick={() => setSpeed(value)}>{value}x</button>
        ))}
      </div>
      <button className="quiet" title="Advance one fixed step while paused" disabled={!paused} onClick={stepOnce}><GlyphStep size={16} /><span>Step</span></button>
      <button className={`quiet ${slow ? 'on' : ''}`} aria-pressed={slow} title={tour ? 'Ease to 0.25x around each stage event' : 'Used by the tour: ease to 0.25x around each stage event'} onClick={() => setSlowAtEvents(!slow)}>
        {slow ? <StatusIcon kind="done" size={15} /> : <StatusIcon kind="next" size={15} />}
        <span>Slow down at events</span>
      </button>
    </div>
  )
}

const FOLLOW_DISTANCES = [['close', 'Close', 220], ['mid', 'Mid', 450], ['wide', 'Wide', 1000]]

function FollowControls({ selected }) {
  const following = useStore((state) => state.following)
  const distance = useStore((state) => state.followDistance)
  const active = following?.id === selected.id && following?.type === selected.type
  const follow = (key, metres) => {
    setState({ followDistance: key })
    cameraBus.push({ type: 'follow', ref: selected, distance: metres })
  }
  const current = FOLLOW_DISTANCES.find(([key]) => key === distance)
  return (
    <div className="follow">
      <button className={`quiet ${active ? 'on' : ''}`} aria-pressed={active} onClick={() => (active ? cameraBus.push({ type: 'follow', off: true }) : follow(distance, current[2]))}>
        {active ? <StatusIcon kind="active" size={15} /> : <GlyphFollow size={16} />}
        <span>{active ? 'Following' : 'Follow'}</span>
      </button>
      <div className="speeds">
        {FOLLOW_DISTANCES.map(([key, label, metres]) => (
          <button key={key} className={`quiet speed ${active && distance === key ? 'active' : ''}`} onClick={() => follow(key, metres)}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function Timeline() {
  const timeline = useStore((state) => state.snapshot?.timeline)
  if (!timeline) {
    return (
      <section className="timeline timeline-idle" aria-label="Ship journey">
        <div className="timeline-head">
          <div className="timeline-title">
            <StatusIcon kind="queued" size={16} />
            <strong>No ship under tow</strong>
            <span>Every ship is waiting at an anchorage</span>
          </div>
          <PlaybackControls />
        </div>
      </section>
    )
  }
  const activeIndex = timeline.steps.findIndex((step) => step.status === 'active')
  const progress = Math.max(0, activeIndex) / (timeline.steps.length - 1)
  return (
    <section className="timeline" aria-label="Ship journey">
      <div className="timeline-head">
        <div className="timeline-title">
          <StatusIcon kind={timeline.status} size={16} />
          <strong>Following {timeline.subtitle.split(',')[0]}</strong>
          <span>{timeline.subtitle.split(',').slice(1).join(',').trim()}</span>
        </div>
        <PlaybackControls />
        <button className="link" onClick={() => selectRow({ type: 'ship', id: timeline.shipId }, true)}>Show on map</button>
      </div>
      <div className="timeline-steps">
        <div className="timeline-rail"><div className="timeline-rail-fill" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
        {timeline.steps.map((step) => (
          <div key={step.id} className={`step step-${step.status}`}>
            <StatusIcon kind={step.status} size={18} />
            <strong>{step.label}</strong>
            <span>{step.at ?? step.detail}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const TABS = [['ships', 'Ships'], ['chambers', 'Chambers'], ['locomotives', 'Locomotives'], ['events', 'Events']]

function ListPanel() {
  const tab = useStore((state) => state.tab)
  const snapshot = useStore((state) => state.snapshot)
  const selected = useStore((state) => state.selected)
  const search = useStore((state) => state.search)
  if (!snapshot) return null
  const needle = search.trim().toLowerCase()
  const visibleShips = snapshot.ships.filter((row) => row.status !== 'cleared' && (!needle || row.name.toLowerCase().includes(needle)))
  return (
    <section className="list-panel">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setState({ tab: id })}>{label}</button>
        ))}
      </div>
      <div className="rows">
        {tab === 'ships' && visibleShips.map((row) => (
          <button key={row.id} className={`row ${selected?.id === row.id ? 'selected' : ''}`} onClick={() => selectRow(row.ref, true)}>
            <StatusIcon kind={row.status} size={16} />
            <span className="row-main"><strong>{row.name}</strong><em>{row.type}, {row.uphill ? 'uphill' : 'downhill'}</em></span>
            <span className="row-side">{row.chamber === null ? 'Anchorage' : `Chamber ${row.chamber + 1}`}</span>
          </button>
        ))}
        {tab === 'chambers' && snapshot.chambers.map((row) => (
          <button key={row.id} className={`row ${selected?.id === row.id ? 'selected' : ''}`} onClick={() => selectRow(row.ref, false)}>
            <StatusIcon kind={row.phase} size={16} />
            <span className="row-main"><strong>{row.label}</strong><em>{row.occupant ?? 'Empty'}</em></span>
            <span className="row-side">{row.level.toFixed(1)} m</span>
          </button>
        ))}
        {tab === 'locomotives' && snapshot.mules.map((row) => (
          <button key={row.id} className={`row ${selected?.id === row.id ? 'selected' : ''}`} onClick={() => selectRow(row.ref, true)}>
            <StatusIcon kind={row.moving ? 'moving' : 'holding'} size={16} />
            <span className="row-main"><strong>{row.id}</strong><em>{row.role}, {row.shipName}</em></span>
            <span className="row-side">{row.tension} kN</span>
          </button>
        ))}
        {tab === 'events' && snapshot.events.map((event, index) => (
          <button key={`${event.simTime}-${index}`} className="row" onClick={() => selectRow({ type: 'chamber', id: `${event.laneId}${event.chamber + 1}` }, false)}>
            <StatusIcon kind={event.kind === 'fill' ? 'filling' : event.kind === 'clear' ? 'cleared' : event.kind === 'gate' ? 'closing' : 'info'} size={16} />
            <span className="row-main"><strong>{event.text}</strong><em>Lane {event.laneId}</em></span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SiteVeil() {
  const switching = useStore((state) => state.switching)
  const siteId = useStore((state) => state.siteId)
  if (switching === 0) return null
  return (
    <div key={switching} className="veil">
      <div className="veil-label"><Logo size={22} /><span>{siteById[siteId].name}</span><em>{siteById[siteId].subtitle}</em></div>
    </div>
  )
}
