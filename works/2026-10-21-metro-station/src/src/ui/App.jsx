import { useEffect, useMemo, useState } from 'react'
import { Scene } from '../world/Scene.jsx'
import { loadAssets } from '../world/assets.js'
import { createSimulation } from '../sim/simulation.js'
import { sites, siteById } from '../data/network.js'
import { getState, setState, useStore, cameraBus } from '../store.js'
import {
  StatusIcon, GlyphPlay, GlyphPause, GlyphStep, GlyphChevron, GlyphRoute, GlyphTrain, GlyphClock, GlyphCheck, GlyphPeople, GlyphPlus, GlyphMinus, GlyphOrbit, GlyphHome, GlyphTop, GlyphSearch, Logo,
} from './icons.jsx'

import { STAGES } from '../data/stages.js'
import {
  SPEEDS, switchSite, goToStage, stepStage, stepSpeed, setSpeed, togglePause, stepOnePaused, toggleSlowAtEvents,
  startTour, stopTour, setFollowDistance, followSelected, stopFollowing,
} from '../playback.js'

const PREROLL_SECONDS = 150

export function App() {
  const [assets, setAssets] = useState(null)
  const simulation = useMemo(() => {
    const created = createSimulation()
    created.runFor(PREROLL_SECONDS)
    return created
  }, [])
  useEffect(() => {
    loadAssets().then(setAssets)
  }, [])
  useShortcuts()
  const ready = useStore((state) => state.snapshot !== null)
  useEffect(() => {
    if (ready) window.__appReady = true
  }, [ready])
  return (
    <div className="app">
      {assets ? <Scene assets={assets} simulation={simulation} /> : <div className="loading">Loading the network</div>}
      <Dashboard />
    </div>
  )
}

// Number keys pick a stage, Space pauses, - and + change speed, [ and ] step through stages. Any click or drag stops the tour.
function useShortcuts() {
  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return
      const stage = STAGES.find((candidate) => String(candidate.number) === event.key)
      if (stage) {
        stopTour()
        goToStage(stage.key)
      } else if (event.key === ' ') {
        event.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        togglePause()
      } else if (event.key === '-' || event.key === '_') stepSpeed(-1)
      else if (event.key === '+' || event.key === '=') stepSpeed(1)
      else if (event.key === ']') {
        stopTour()
        stepStage(1)
      } else if (event.key === '[') {
        stopTour()
        stepStage(-1)
      } else if (event.key === 'Escape') stopTour()
    }
    const onPointer = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-keeps-tour]')) return
      stopTour()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])
}

function Dashboard() {
  return (
    <>
      <TopBar />
      <StageBar />
      <KpiCards />
      <CameraControls />
      <DetailCard />
      <Timeline />
      <ListPanel />
      <SiteVeil />
    </>
  )
}

function selectRow(ref, follow) {
  setState({ selected: ref })
  cameraBus.push({ type: 'fly', ref, follow })
}

function TopBar() {
  const siteId = useStore((state) => state.siteId)
  const clock = useStore((state) => state.snapshot?.clock ?? '--:--:--')
  const snapshot = useStore((state) => state.snapshot)
  const search = useStore((state) => state.search)
  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query || !snapshot) return []
    const trains = snapshot.trains.filter((row) => row.id.toLowerCase().includes(query)).map((row) => ({ ref: { type: 'train', id: row.id }, label: row.id, detail: row.lineName, status: row.status }))
    const stationRows = snapshot.stations.filter((row) => row.name.toLowerCase().includes(query)).map((row) => ({ ref: { type: 'station', id: row.id }, label: row.name, detail: row.lineName, status: 'running' }))
    return [...stationRows, ...trains].slice(0, 6)
  }, [search, snapshot])
  const open = (result) => {
    setState({ search: '' })
    selectRow(result.ref, result.ref.type === 'train')
  }
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <strong>Lumen Transit</strong>
          <span>Network operations, Halden</span>
        </div>
      </div>
      <div className="search">
        <GlyphSearch />
        <input
          value={search}
          placeholder="Find a train or station"
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
          <button key={site.id} className={`site-button ${siteId === site.id ? 'active' : ''}`} onClick={() => switchSite(site.id)}>
            {site.name}
          </button>
        ))}
      </nav>
      <div className="clock">
        <GlyphClock size={17} />
        <span className="clock-time">{clock}</span>
      </div>
      <div className="user">
        <span className="avatar">MR</span>
        <div>
          <strong>Maya Reyes</strong>
          <span>Duty controller</span>
        </div>
      </div>
    </header>
  )
}

function StageBar() {
  const stageKey = useStore((state) => state.stageKey)
  const visited = useStore((state) => state.visitedStages)
  const touring = useStore((state) => state.tour !== null)
  const active = STAGES.find((stage) => stage.key === stageKey)
  return (
    <section className="stagebar" aria-label="Stages">
      <div className="stage-row">
        <div className="stage-list">
          {STAGES.map((stage) => {
            const isActive = stage.key === stageKey
            const kind = isActive ? 'active' : visited.includes(stage.key) ? 'done' : 'next'
            return (
              <button key={stage.key} className={`stage-button ${isActive ? 'active' : ''}`} title={`${stage.label} (key ${stage.number})`} onClick={() => { stopTour(); goToStage(stage.key) }}>
                <StatusIcon kind={kind} size={15} />
                <kbd>{stage.number}</kbd>
                <span>{stage.short}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="stage-row stage-foot">
        {active ? <p className="stage-caption"><strong>{active.label}.</strong> {active.caption}</p> : <p className="stage-caption">Pick a stage, press 1 to 6, or take the tour</p>}
        <button className="quiet" data-keeps-tour title="Previous stage ([)" onClick={() => { stopTour(); stepStage(-1) }}>
          <GlyphChevron direction="left" /><span>Previous stage</span>
        </button>
        <button className="quiet" data-keeps-tour title="Next stage (])" onClick={() => { stopTour(); stepStage(1) }}>
          <span>Next stage</span><GlyphChevron />
        </button>
        <button className={`quiet tour ${touring ? 'on' : ''}`} data-keeps-tour aria-pressed={touring} onClick={() => (touring ? stopTour() : startTour())}>
          {touring ? <StatusIcon kind="running" size={15} /> : <GlyphRoute />}
          <span>{touring ? 'Touring, click to stop' : 'Tour'}</span>
        </button>
      </div>
    </section>
  )
}

function KpiCards() {
  const kpis = useStore((state) => state.snapshot?.kpis)
  const siteId = useStore((state) => state.siteId)
  if (!kpis) return null
  const icons = { first: GlyphTrain, second: GlyphClock, third: GlyphCheck, fourth: GlyphPeople }
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
      {selected.type === 'train' && <FollowControls />}
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
      <p className="hint">Click empty ground or press Esc to close</p>
    </aside>
  )
}

function FollowControls() {
  const following = useStore((state) => state.following)
  const distance = useStore((state) => state.followDistance)
  return (
    <div className="follow">
      <button className={`quiet ${following ? 'on' : ''}`} aria-pressed={!!following} onClick={() => (following ? stopFollowing() : followSelected())}>
        <StatusIcon kind={following ? 'running' : 'next'} size={14} />
        <span>{following ? 'Following' : 'Follow'}</span>
      </button>
      <div className="follow-distances" role="group" aria-label="Follow distance">
        {[['close', 'Close'], ['mid', 'Mid'], ['wide', 'Wide']].map(([name, label]) => (
          <button key={name} className={`quiet ${distance === name ? 'on' : ''}`} onClick={() => { setFollowDistance(name); if (!following) followSelected() }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function PlaybackControls() {
  const paused = useStore((state) => state.paused)
  const speed = useStore((state) => state.speed)
  const slow = useStore((state) => state.slowAtEvents)
  return (
    <div className="playback" role="toolbar" aria-label="Playback">
      <span className="playback-state">
        <StatusIcon kind={paused ? 'dwell' : 'running'} size={15} />
        <strong>{paused ? 'Paused' : 'Running'}</strong>
      </span>
      <button className="quiet" title="Pause or play (Space)" onClick={togglePause}>
        {paused ? <GlyphPlay /> : <GlyphPause />}<span>{paused ? 'Play' : 'Pause'}</span>
      </button>
      <button className="quiet" title="Advance one fixed step" onClick={stepOnePaused}>
        <GlyphStep /><span>Step</span>
      </button>
      <div className="speeds" role="group" aria-label="Speed (keys - and +)">
        {SPEEDS.map((value) => (
          <button key={value} className={`quiet speed ${speed === value ? 'on' : ''}`} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>
        ))}
      </div>
      <button className="quiet" aria-pressed={slow} title="Ease to 0.25x for a moment around a stage's key event during the tour" onClick={toggleSlowAtEvents}>
        <StatusIcon kind={slow ? 'done' : 'next'} size={14} /><span>Slow down at events</span>
      </button>
    </div>
  )
}

function formatClock(seconds) {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function Timeline() {
  const timeline = useStore((state) => state.snapshot?.timeline)
  const time = useStore((state) => state.snapshot?.time ?? 0)
  if (!timeline) return null
  const doneCount = timeline.steps.filter((step) => step.status === 'done').length
  const progress = doneCount / (timeline.steps.length - 1)
  return (
    <section className="timeline" aria-label="Train journey">
      <div className="timeline-head">
        <div className="timeline-title">
          <StatusIcon kind={timeline.status === 'depot' ? 'depot' : timeline.status} size={16} />
          <strong>Following {timeline.trainId}</strong>
          <span>{timeline.subtitle}</span>
        </div>
        <PlaybackControls />
        <button className="link" onClick={() => selectRow({ type: 'train', id: timeline.trainId }, true)}>Show on map</button>
      </div>
      <div className="timeline-steps">
        <div className="timeline-rail"><div className="timeline-rail-fill" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
        {timeline.steps.map((step) => (
          <div key={step.id} className={`step step-${step.status}`}>
            <StatusIcon kind={step.status === 'done' ? 'done' : step.status === 'active' ? 'active' : 'next'} size={18} />
            <strong>{step.label}</strong>
            <span>{step.at !== null ? `${clockOf(step.at)}` : step.detail}</span>
          </div>
        ))}
      </div>
      <span className="sr-only">{formatClock(time)}</span>
    </section>
  )
}

function clockOf(seconds) {
  const total = Math.floor(6 * 3600 + 12 * 60 + seconds)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return [hours, minutes, rest].map((value) => String(value).padStart(2, '0')).join(':')
}

function ListPanel() {
  const siteId = useStore((state) => state.siteId)
  const tab = useStore((state) => state.tab)
  const snapshot = useStore((state) => state.snapshot)
  const selected = useStore((state) => state.selected)
  const search = useStore((state) => state.search)
  const isDepot = siteId === 'depot'
  const tabs = isDepot ? [['trains', 'Trains'], ['tasks', 'Work orders'], ['incidents', 'Incidents']] : [['trains', 'Trains'], ['stations', 'Stations'], ['incidents', 'Incidents']]
  const activeTab = tabs.some(([id]) => id === tab) ? tab : 'trains'
  if (!snapshot) return null
  const needle = search.trim().toLowerCase()
  return (
    <section className="list-panel">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'tab active' : 'tab'} onClick={() => setState({ tab: id })}>{label}</button>
        ))}
      </div>
      <div className="rows">
        {activeTab === 'trains' && snapshot.trains.filter((row) => !needle || row.id.toLowerCase().includes(needle)).map((row) => (
          <button key={row.id} className={`row ${selected?.id === row.id ? 'selected' : ''}`} onClick={() => selectRow({ type: 'train', id: row.id }, true)}>
            <StatusIcon kind={row.status} size={16} />
            <span className="row-main"><strong>{row.id}</strong><em>{row.status === 'dwell' ? `At ${row.atStation}` : row.status === 'fault' ? `Door fault at ${row.atStation}` : row.lineId === 'D' ? row.next : `To ${row.next}`}</em></span>
            <span className="row-side">{row.lineId === 'D' ? `${row.speed} km/h` : `${row.speed} km/h`}</span>
          </button>
        ))}
        {activeTab === 'stations' && snapshot.stations.filter((row) => !needle || row.name.toLowerCase().includes(needle)).map((row) => (
          <button key={row.id} className={`row ${selected?.id === row.id ? 'selected' : ''}`} onClick={() => selectRow({ type: 'station', id: row.id }, false)}>
            <StatusIcon kind={row.crowding > 0.7 ? 'held' : 'running'} size={16} />
            <span className="row-main"><strong>{row.name}</strong><em>{row.lineName}</em></span>
            <span className="row-side">{row.waiting} waiting</span>
          </button>
        ))}
        {activeTab === 'tasks' && snapshot.tasks.map((task) => (
          <button key={task.id} className="row" onClick={() => selectRow({ type: 'train', id: task.trainId }, false)}>
            <StatusIcon kind="maintenance" size={16} />
            <span className="row-main"><strong>{task.title}</strong><em>{task.id}, {task.trainId}, {task.slot}</em></span>
            <span className="row-side">{Math.round(task.progress * 100)}%</span>
          </button>
        ))}
        {activeTab === 'incidents' && snapshot.incidents.map((incident) => (
          <button key={incident.id} className="row" onClick={() => incident.trainId && snapshot.trains.some((row) => row.id === incident.trainId) ? selectRow({ type: 'train', id: incident.trainId }, true) : null}>
            <StatusIcon kind={incident.severity === 'fault' ? (incident.open ? 'fault' : 'resolved') : 'info'} size={16} />
            <span className="row-main"><strong>{incident.title}</strong><em>{incident.detail}</em></span>
            <span className="row-side">{incident.open ? 'Open' : 'Closed'}</span>
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
