// The dashboard around the scene. Re-renders on the store's `version` tick (5 Hz).
import { useEffect, useRef, useState } from 'react'
import { SITES, SITE_BY_ID } from './sites.js'
import { CATCH_TAU, HOLD, PHASES, clock, missionSeconds } from './sim.js'
import {
  clearSelection, commandCamera, describe, findEntity, history, propellantFraction, rangeRows, rangeVerdict, selectEntity, setUi, siteLabel, stagesReady, statusOf, switchSite, tasksFor, useUi, world,
} from './store.js'
import { GlyphButtonIcon, Logo, StatusIcon, shapeOf } from './icons.jsx'
import { cameraState, shortLabel } from './scene.jsx'

function utcClock() {
  const date = new Date(Date.now())
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`
}

function Sparkline({ values, width = 150, height = 34, limit = null, max = null }) {
  if (values.length < 2) return <svg width={width} height={height} />
  const top = max ?? Math.max(...values, limit ?? -Infinity) * 1.08
  const bottom = Math.min(...values, 0)
  const scaleY = (value) => height - 3 - ((value - bottom) / (top - bottom || 1)) * (height - 6)
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${scaleY(value).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]
  const over = limit !== null && last > limit
  return (
    <svg width={width} height={height} className="sparkline">
      {limit !== null && <line x1="0" x2={width} y1={scaleY(limit)} y2={scaleY(limit)} className="limit" />}
      <line x1="0" x2={width} y1={height - 3} y2={height - 3} className="baseline" />
      <polyline points={points} className={over ? 'line over' : 'line'} />
      <circle cx={width} cy={scaleY(last)} r="2.4" className={over ? 'dot over' : 'dot'} />
    </svg>
  )
}

function TopBar() {
  const ui = useUi()
  const [open, setOpen] = useState(false)
  const alerts = world.events.filter((event) => event.level === 'warn' || event.level === 'hold').length
  const verdict = rangeVerdict()
  return (
    <header className="topbar panel">
      <div className="window-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Logo />
      <div className="crumbs">
        <strong>Tideline</strong>
        <span className="muted">/ Saltgrass Point /</span>
        <div className="site-switch">
          <button className="site-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            {siteLabel(ui.siteId)}
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>
          {open && (
            <div className="site-menu panel">
              {SITES.map((site) => (
                <button
                  key={site.id}
                  data-site={site.id}
                  className={site.id === ui.siteId ? 'current' : ''}
                  onClick={() => {
                    setOpen(false)
                    if (site.id !== ui.siteId) switchSite(site.id)
                  }}
                >
                  <StatusIcon kind={site.id === 'lc1' ? (world.tau < 0 ? 'go' : 'active') : 'active'} size={12} />
                  <span className="site-code">{site.code}</span>
                  <span>{site.name}</span>
                  <span className="muted">{site.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <label className="search">
        <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <input
          placeholder="Search vehicles, tanks, tasks"
          value={ui.search}
          onChange={(event) => setUi({ search: event.target.value })}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            const query = ui.search.trim().toLowerCase()
            const match = world.sites[ui.siteId].entities.find((entity) => entity.name.toLowerCase().includes(query) || entity.id.includes(query))
            if (match) selectEntity(match.id, { fly: true })
          }}
        />
      </label>
      <div className="top-right">
        <span className="clock">{utcClock()} UTC</span>
        <span className="muted">Telemetry 38 ms</span>
        <span className={`range-chip ${verdict.kind}`}>
          <StatusIcon kind={verdict.kind} size={13} />
          Range {verdict.text}
        </span>
        <button className={`alerts ${alerts ? 'on' : ''}`} onClick={() => setUi({ tab: 'events' })}>
          <StatusIcon kind={alerts ? 'warn' : 'idle'} size={13} />
          {alerts} {alerts === 1 ? 'alert' : 'alerts'}
        </button>
        <div className="user">
          <span className="avatar">RO</span>
          <span>
            R. Okafor
            <small className="muted">Launch director</small>
          </span>
        </div>
      </div>
    </header>
  )
}

function Kpis() {
  useUi()
  const tau = world.tau ?? 0
  const loaded = propellantFraction()
  const stages = stagesReady()
  const verdict = rangeVerdict()
  const booster = world.sites.lc1.byId['b-14']
  const ship = world.sites.lc1.byId['ship-lc1']
  const beforeLaunch = tau < 0
  return (
    <section className="kpis panel">
      <h2>[LC-1 FLIGHT {booster.flights + (tau >= 0 && tau < CATCH_TAU ? 1 : beforeLaunch ? 1 : 0)}]</h2>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">{beforeLaunch ? 'Next launch' : 'Days to next launch'}</span>
          <span className="kpi-value">{beforeLaunch ? clock(missionSeconds(tau)) : `${(9.4 - tau / 400).toFixed(1)} d`}</span>
          <span className="kpi-sub">{beforeLaunch ? `B-14 with ${ship.serial}` : `Flown T${clock(missionSeconds(tau)).slice(1)}`}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Propellant loaded</span>
          <span className="kpi-value">{(loaded * 100).toFixed(1)}<small> %</small></span>
          <Sparkline values={history.propellant} width={170} height={26} max={1.05} />
        </div>
        <div className="kpi">
          <span className="kpi-label">Stages ready</span>
          <span className="kpi-value">{stages.ready}<small> of {stages.total}</small></span>
          <span className="kpi-sub stage-dots">
            {Array.from({ length: stages.total }, (_, index) => <i key={index} className={index < stages.ready ? 'on' : ''} />)}
          </span>
        </div>
        <div className={`kpi ${verdict.kind !== 'go' ? 'alerting' : ''}`}>
          <span className="kpi-label">Range</span>
          <span className="kpi-value verdict"><StatusIcon kind={verdict.kind} size={20} />{verdict.text}</span>
          <Sparkline values={history.wind} width={170} height={26} limit={80} max={100} />
        </div>
      </div>
    </section>
  )
}

function DetailCard() {
  const ui = useUi()
  const entity = findEntity(ui.selectedId)
  if (!entity) return null
  const card = describe(entity)
  const progress = Math.max(0, Math.min(1, card.progress.value))
  return (
    <aside className="card panel" data-card={entity.id}>
      <div className="card-head">
        <div>
          <div className="card-title">{card.title}</div>
          <div className="muted">{card.subtitle}</div>
        </div>
        <span className="card-tag">{shortLabel(entity)}</span>
      </div>
      <div className={`card-status ${card.status.kind}`}>
        <StatusIcon kind={card.status.kind} shape={shapeOf(card.status)} size={15} />
        <span>{card.status.text}</span>
        {ui.followId === entity.id && <span className="following">following</span>}
      </div>
      <dl className="fields">
        {card.fields.map(([label, value, alert]) => (
          <div key={label} className={alert ? 'alert' : ''}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="progress">
        <div className="progress-label">
          <span>{card.progress.label}</span>
          <span>{(progress * 100).toFixed(1)} %</span>
        </div>
        <div className="bar">
          <div className={`fill ${card.progress.alert ? 'alert' : ''}`} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="hatch" />
      <div className="metric">
        <span className="muted">{card.metric.label}</span>
        <Sparkline values={history.selected} width={340} height={46} />
      </div>
    </aside>
  )
}

function Timeline() {
  useUi()
  const tau = world.tau ?? 0
  const weights = PHASES.map((phase) => Math.max(4.6, Math.sqrt(phase.end - phase.start)))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let offset = 0
  let playhead = 0
  const segments = PHASES.map((phase, index) => {
    const width = (weights[index] / total) * 100
    const start = offset
    offset += width
    const inside = tau >= phase.start && tau < phase.end
    if (inside) playhead = start + ((tau - phase.start) / (phase.end - phase.start)) * width
    const state = tau >= phase.end ? 'done' : inside ? 'active' : 'idle'
    return { phase, width, state }
  })
  const holdPhase = PHASES.find((phase) => phase.id === 'load')
  const holding = tau >= HOLD.start && tau < HOLD.end
  return (
    <section className="timeline panel">
      <div className="timeline-head">
        <h2>[COUNTDOWN]</h2>
        <span className="muted">LC-1 Kittiwake · B-14 / {world.sites.lc1.byId['ship-lc1'].serial}</span>
        <span className={`big-clock ${holding ? 'holding' : ''}`}>
          {holding && <StatusIcon kind="hold" size={16} />}
          {clock(missionSeconds(tau))}
        </span>
      </div>
      <div className="track">
        {segments.map(({ phase, width, state }) => (
          <div key={phase.id} className={`segment ${state}`} style={{ width: `${width}%` }}>
            <div className="segment-bar">
              {phase.id === holdPhase.id && <i className="hold-mark" style={{ left: `${((HOLD.start - phase.start) / (phase.end - phase.start)) * 100}%`, width: `${((HOLD.end - HOLD.start) / (phase.end - phase.start)) * 100}%` }} />}
            </div>
            <div className="segment-label">
              <StatusIcon kind={state === 'done' ? 'done' : state === 'active' ? (holding ? 'hold' : 'active') : 'idle'} size={11} />
              {phase.label}
            </div>
          </div>
        ))}
        <div className="playhead" style={{ left: `${playhead}%` }} />
      </div>
    </section>
  )
}

const TABS = [
  ['vehicles', 'Vehicles'],
  ['tanks', 'Tanks'],
  ['tasks', 'Tasks'],
  ['range', 'Range'],
  ['events', 'Events'],
]

function rowsFor(tab, siteId) {
  const state = world.sites[siteId]
  if (tab === 'vehicles' || tab === 'tanks') {
    return state.entities
      .filter((entity) => entity.list === tab)
      .filter((entity) => !(entity.kind === 'ship' && entity.pose?.visible === false))
      .map((entity) => {
        const status = statusOf(entity)
        const value = entity.kind === 'tank' ? `${(entity.level * 100).toFixed(1)} %` : entity.load !== undefined ? `${(entity.load * 100).toFixed(0)} % prop` : entity.kind === 'boat' ? `${((entity.speed ?? 0) * 1.94).toFixed(1)} kn` : entity.speed !== undefined ? `${((entity.speed ?? 0) * 3.6 * (entity.kind === 'spmt' ? 0.3 : 1)).toFixed(0)} km/h` : ''
        return { id: entity.id, target: entity.id, name: entity.name, sub: status.text, status, value }
      })
  }
  if (tab === 'tasks') return tasksFor(siteId).map((task) => ({ ...task, sub: task.status.text, value: `${(task.progress * 100).toFixed(0)} %`, progress: task.progress }))
  if (tab === 'range') return rangeRows(siteId).map((row) => ({ ...row, sub: row.status.text, value: '' }))
  return world.events.slice(0, 14).map((event) => ({
    id: event.id,
    target: null,
    name: event.text,
    sub: utcAt(event.time),
    status: { kind: event.level === 'go' ? 'go' : event.level === 'warn' ? 'warn' : event.level === 'hold' ? 'hold' : 'active' },
    value: '',
  }))
}

function utcAt(time) {
  const date = new Date(Date.now() - (world.time - time) * 1000)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`
}

function Lists() {
  const ui = useUi()
  const query = ui.search.trim().toLowerCase()
  const rows = rowsFor(ui.tab, ui.siteId).filter((row) => !query || row.name.toLowerCase().includes(query))
  return (
    <section className="lists panel">
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} data-tab={id} className={ui.tab === id ? 'active' : ''} onClick={() => setUi({ tab: id })}>
            {label}
          </button>
        ))}
      </nav>
      <div className="rows">
        {rows.length === 0 && <div className="empty muted">Nothing here on {SITE_BY_ID[ui.siteId].code}</div>}
        {rows.map((row) => (
          <button
            key={row.id}
            data-id={row.target ?? row.id}
            className={`row ${ui.selectedId && ui.selectedId === row.target ? 'selected' : ''} ${row.target ? '' : 'static'}`}
            onClick={() => row.target && selectEntity(row.target, { fly: true })}
          >
            <StatusIcon kind={row.status.kind} shape={shapeOf(row.status)} size={14} />
            <span className="row-text">
              <span className="row-name">{row.name}</span>
              <span className="row-sub muted">{row.sub}</span>
            </span>
            {row.progress !== undefined ? (
              <span className="row-progress"><i style={{ width: `${row.progress * 100}%` }} /></span>
            ) : null}
            <span className="row-value">{row.value}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function CameraButtons() {
  const ui = useUi()
  const buttons = [
    ['plus', 'Zoom in', () => commandCamera({ type: 'zoom', factor: 0.7 })],
    ['minus', 'Zoom out', () => commandCamera({ type: 'zoom', factor: 1.4 })],
    ['left', 'Orbit left', () => commandCamera({ type: 'rotate', angle: 0.5 })],
    ['right', 'Orbit right', () => commandCamera({ type: 'rotate', angle: -0.5 })],
    ['top', 'Top view', () => commandCamera({ type: 'pitch', value: 1.35 })],
    ['home', 'Whole site', () => {
      setUi({ followId: null })
      commandCamera({ type: 'overview' })
    }],
  ]
  if (ui.selectedId) buttons.push(['follow', 'Follow selected', () => selectEntity(ui.selectedId, { fly: true })])
  return (
    <div className="camera-buttons panel">
      {buttons.map(([icon, label, action]) => (
        <button key={icon} title={label} aria-label={label} data-camera={icon} onClick={action}>
          <GlyphButtonIcon name={icon} />
        </button>
      ))}
    </div>
  )
}

// Thin HUD furniture over the scene: heading tape and pitch ladder, driven by the camera every frame.
function Hud() {
  const tapeRef = useRef()
  const headingRef = useRef()
  const ladderRef = useRef()
  const rangeRef = useRef()
  useEffect(() => {
    let frame
    const tick = () => {
      const heading = ((((-cameraState.yaw * 180) / Math.PI + 180) % 360) + 360) % 360
      if (tapeRef.current) tapeRef.current.style.transform = `translateX(${-heading * 4}px)`
      if (headingRef.current) headingRef.current.textContent = `${heading.toFixed(0).padStart(3, '0')}°`
      if (ladderRef.current) ladderRef.current.style.transform = `translateY(${((cameraState.pitch * 180) / Math.PI) * 4}px)`
      if (rangeRef.current) rangeRef.current.textContent = `${(cameraState.distance ?? 0).toFixed(0)} m`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  const ticks = []
  for (let degree = -360; degree <= 720; degree += 10) ticks.push(degree)
  const rungs = []
  for (let degree = -10; degree <= 90; degree += 5) rungs.push(degree)
  return (
    <>
      <div className="heading-tape" aria-hidden="true">
        <div className="tape-window">
          <div className="tape" ref={tapeRef}>
            {ticks.map((degree) => (
              <span key={degree} className={degree % 30 === 0 ? 'major' : ''} style={{ left: `${degree * 4 + 230}px` }}>
                {degree % 30 === 0 ? <b>{String(((degree % 360) + 360) % 360).padStart(3, '0')}</b> : null}
              </span>
            ))}
          </div>
        </div>
        <div className="tape-caret" />
        <div className="tape-readout" ref={headingRef}>000°</div>
      </div>
      <div className="pitch-ladder" aria-hidden="true">
        <div className="ladder-window">
          <div className="ladder" ref={ladderRef}>
            {rungs.map((degree) => (
              <span key={degree} style={{ top: `${130 - degree * 4}px` }} className={degree % 15 === 0 ? 'major' : ''}>
                {degree % 15 === 0 ? <b>{String(degree).padStart(2, '0')}</b> : null}
              </span>
            ))}
          </div>
        </div>
        <div className="ladder-caret" />
        <div className="ladder-range" ref={rangeRef} />
      </div>
    </>
  )
}

export function Dashboard() {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="dashboard">
      <TopBar />
      <Kpis />
      <Hud />
      <DetailCard />
      <CameraButtons />
      <Timeline />
      <Lists />
    </div>
  )
}
