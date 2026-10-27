// Everything drawn over the 3D view. Reads the sim on each dashboard refresh (useUi().version).
import { useEffect, useRef, useState } from 'react'
import { AIRCRAFT_TYPES, AIRLINES, AIRPORT, RUNWAYS, SITES, TIME_SCALE } from '../data.js'
import { canInstruct, formatLevel, issueInstruction, nextWaypointName, routeProgress } from '../sim.js'
import { closeDistance, findEntity, flyTo, getUi, rotateBy, setUi, switchSite, useUi, viewSite, world, zoomBy } from '../store.js'
import { conflictStatus, flightStatus, runwayStatus } from '../status.js'
import { AirlineMark, Icon, ProductMark, StatusChip, StatusIcon } from './Icon.jsx'
import { arrivalTimeline, delayLabel, focusFlight, formatClock, formatTime, separationTone, siteKpis } from './ops.js'

function selectAndFly(id) {
  setUi({ selectedId: id })
  const entity = findEntity(id)
  if (!entity) return
  const moving = entity.type === 'flight'
  const distance = entity.type === 'weather' ? entity.item.radius * 6 : closeDistance()
  flyTo(entity.position, distance, moving ? id : null)
}

function Meter({ value, tone = 'brand' }) {
  return (
    <span className={`meter meter-${tone}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </span>
  )
}

const levelText = (flight) => (flight.altitude < 50 ? 'Ground' : formatLevel(flight.altitude))

// ---------- top bar ----------

function SiteSwitcher({ state }) {
  const [open, setOpen] = useState(false)
  const kpis = siteKpis(state)
  return (
    <div className="site-switcher">
      <button className="site-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="site-badge">{state.site.id}</span>
        <span className="site-text">
          <strong>{state.site.name}</strong>
          <small>{kpis.inSector} aircraft · {state.site.frequency}</small>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="site-menu" role="menu">
          {SITES.map((site) => {
            const siteState = world.sites[site.id]
            const numbers = siteKpis(siteState)
            return (
              <button
                key={site.id}
                role="menuitem"
                className={site.id === state.site.id ? 'active' : ''}
                onClick={() => {
                  setOpen(false)
                  switchSite(site.id)
                }}
              >
                <span className="site-badge">{site.id}</span>
                <span className="site-text">
                  <strong>{site.name}</strong>
                  <small>{site.area} · {numbers.inSector} aircraft</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SearchBox({ value }) {
  const inputRef = useRef()
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === '/' && document.activeElement !== inputRef.current) {
        event.preventDefault()
        inputRef.current.focus()
      }
      if (event.key === 'Escape') setUi({ selectedId: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <label className="search">
      <Icon name="search" size={17} />
      <input
        ref={inputRef}
        value={value}
        placeholder="Search callsigns, fixes, runways"
        onChange={(event) => setUi({ search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const first = searchRows(world.sites[getUi().siteId], event.target.value)[0]
          if (first) {
            setUi({ tab: first.tab })
            selectAndFly(first.target ?? first.id)
          }
        }}
      />
      <kbd>/</kbd>
    </label>
  )
}

function TopBar({ state, ui }) {
  const alerts = state.conflicts.filter((conflict) => conflict.state === 'active').length
  return (
    <header className="top-bar">
      <div className="brand">
        <ProductMark />
        <span>Squawk</span>
      </div>
      <SearchBox value={ui.search} />
      <div className="top-right">
        <SiteSwitcher state={state} />
        <span className="clock" title={`Simulated time, ${TIME_SCALE}x real time`}>
          <span className="live-dot" />
          {AIRPORT.code} {formatClock(state.clock)}
          <small>×{TIME_SCALE}</small>
        </span>
        <button className="icon-button" aria-label={alerts ? `${alerts} active alerts` : 'Alerts'} onClick={() => setUi({ tab: 'alerts' })}>
          <Icon name="bell" />
          {alerts > 0 && <span className="badge-dot" />}
        </button>
        <div className="user">
          <span className="avatar">WS</span>
          <span className="user-text">
            <strong>Watch supervisor</strong>
            <small>{AIRPORT.city} control centre</small>
          </span>
        </div>
      </div>
    </header>
  )
}

// ---------- KPI cards ----------

function KpiCard({ icon, label, value, unit, note, tone = 'neutral' }) {
  return (
    <div className={`card kpi kpi-${tone}`}>
      <span className="kpi-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <span className="kpi-label">{label}</span>
        <div className="kpi-value">
          {value}
          {unit && <small>{unit}</small>}
        </div>
        <span className="kpi-note">{note}</span>
      </div>
    </div>
  )
}

const SEPARATION_ICON = { ok: 'check', warn: 'alert', bad: 'warning' }

function Kpis({ state }) {
  const kpis = siteKpis(state)
  const tone = separationTone(state, kpis.separation)
  const pair = kpis.separationIds.map((id) => state.flights.find((flight) => flight.id === id)?.callsign).filter(Boolean)
  const breakdown = state.site.hasAirport ? `${kpis.airborne} airborne · ${kpis.ground} ground` : `${kpis.arrivals} inbound to ${AIRPORT.code}`
  return (
    <section className="kpis">
      <KpiCard icon="plane" label="Aircraft in sector" value={kpis.inSector} note={breakdown} />
      <KpiCard icon="landing" label="Arrivals per hour" value={kpis.perHour} note={state.site.id === 'CTR' ? 'Handed to approach' : 'Runway 27R'} />
      <KpiCard icon="clock" label="Average delay" value={kpis.delay.toFixed(1)} unit="min" note={kpis.holding ? `${kpis.holding} in the hold` : 'Arrivals in sector'} />
      <KpiCard
        icon="radar"
        label="Minimum separation"
        value={kpis.separation === null ? '—' : kpis.separation.toFixed(1)}
        unit={kpis.separation === null ? '' : 'NM'}
        tone={tone}
        note={
          <span className={`kpi-status tone-text-${tone}`}>
            <StatusIcon name={SEPARATION_ICON[tone]} />
            {pair.length === 2 ? `${pair[0]} / ${pair[1]}` : 'No pairs within 1,000 ft'}
          </span>
        }
      />
    </section>
  )
}

// ---------- detail card ----------

function Field({ label, children, wide = false }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

function FlightDetail({ state, flight }) {
  const airline = AIRLINES[flight.airline]
  const type = AIRCRAFT_TYPES[flight.type]
  const progress = routeProgress(state, flight)
  const trend = flight.clearedAltitude > flight.altitude + 60 ? '↑' : flight.clearedAltitude < flight.altitude - 60 ? '↓' : ''
  const instruct = canInstruct(flight)
  const command = (kind) => issueInstruction(state, flight, kind)
  return (
    <>
      <div className="detail-head">
        <AirlineMark code={flight.airline} size={40} />
        <div>
          <h2>{flight.callsign}</h2>
          <p>{flight.spoken} · {airline.name} · {type.name}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusChip status={flightStatus(flight)} />
        <span className="muted">Squawk {flight.squawk}</span>
      </div>
      <div className="detail-progress">
        <div className="progress-label">
          <span>{flight.origin.code} → {flight.destination.code} · next {nextWaypointName(flight)}</span>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <Meter value={progress} tone={flight.alert === 'none' ? 'brand' : 'warn'} />
      </div>
      <div className="fields">
        <Field label="Altitude">{levelText(flight)} {trend}</Field>
        <Field label="Cleared">{flight.clearedAltitude ? formatLevel(flight.clearedAltitude) : 'Ground'}</Field>
        <Field label="Speed">{Math.round(flight.speed)} kt</Field>
        <Field label="Heading">{String(Math.round(flight.heading) || 360).padStart(3, '0')}°</Field>
        <Field label="Type">{flight.type} · wake {type.wake}</Field>
        <Field label="Delay">
          <span className={flight.delay >= 5 ? 'text-warn' : 'text-ok'}>{flight.kind === 'arrival' ? delayLabel(flight.delay) : 'On time'}</span>
        </Field>
        <Field label="Last instruction" wide>{flight.lastInstruction || 'None yet'}</Field>
      </div>
      <div className="commands" aria-label="Instructions">
        <button onClick={() => command('climb')} disabled={!instruct}>
          <Icon name="climb" size={15} /> Climb 1,000
        </button>
        <button onClick={() => command('descend')} disabled={!instruct}>
          <Icon name="descend" size={15} /> Descend 1,000
        </button>
        <button onClick={() => command('slow')} disabled={!instruct}>
          <Icon name="gauge" size={15} /> Slow 20 kt
        </button>
      </div>
    </>
  )
}

function FixDetail({ state, fix }) {
  const routed = state.flights.filter((flight) => flight.mode === 'steer' && flight.route.slice(flight.legIndex).some((point) => point.name === fix.id))
  const holding = state.flights.filter((flight) => flight.hold)
  return (
    <>
      <div className="detail-head">
        <span className="detail-tile">
          <Icon name="fix" size={22} />
        </span>
        <div>
          <h2>{fix.id}</h2>
          <p>{fix.note}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusChip status={routed.length ? { icon: 'arrow', label: `${routed.length} inbound`, tone: 'info' } : { icon: 'free', label: 'No traffic routed', tone: 'muted' }} />
      </div>
      <div className="fields">
        <Field label="Position">{(fix.x / state.site.nm).toFixed(1)} E, {(-fix.z / state.site.nm).toFixed(1)} N NM</Field>
        <Field label="Sector">{state.site.name}</Field>
        <Field label="Next aircraft" wide>{routed.slice(0, 3).map((flight) => flight.callsign).join(', ') || 'None'}</Field>
        {fix.kind === 'holding_marker' && <Field label="In the hold" wide>{holding.map((flight) => `${flight.callsign} ${formatLevel(flight.altitude)}`).join(', ') || 'Empty'}</Field>}
      </div>
    </>
  )
}

function WeatherDetail({ state, weather }) {
  const avoiding = state.flights.filter((flight) => flight.avoiding)
  const knots = Math.hypot(weather.drift.x, weather.drift.z) / ((state.site.nm * TIME_SCALE) / 3600)
  const heading = (Math.atan2(weather.drift.x, -weather.drift.z) * 180) / Math.PI
  return (
    <>
      <div className="detail-head">
        <span className="detail-tile tile-warn">
          <Icon name="weather" size={22} />
        </span>
        <div>
          <h2>Storm cell</h2>
          <p>Cumulonimbus drifting across {state.site.name}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusChip status={{ icon: 'weather', label: avoiding.length ? `${avoiding.length} rerouting` : 'Monitored', tone: 'warn' }} />
      </div>
      <div className="fields">
        <Field label="Diameter">{((weather.radius * 2) / state.site.nm).toFixed(0)} NM</Field>
        <Field label="Tops">FL350</Field>
        <Field label="Drift">{String(Math.round((heading + 360) % 360)).padStart(3, '0')}° at {Math.round(knots)} kt</Field>
        <Field label="Reroutes this watch">{state.reroutes}</Field>
        <Field label="Avoiding now" wide>{avoiding.map((flight) => flight.callsign).join(', ') || 'None'}</Field>
      </div>
    </>
  )
}

function RunwayDetail({ state, runway }) {
  const status = runwayStatus(state, runway)
  const arrivals = runway.id === 'R1'
  const events = arrivals ? state.landings : state.departures
  const last = events[events.length - 1]
  return (
    <>
      <div className="detail-head">
        <span className="detail-tile">
          <Icon name="runway" size={22} />
        </span>
        <div>
          <h2>Runway {runway.name}</h2>
          <p>{arrivals ? 'Arrivals' : 'Departures'} · {Math.round((runway.to - runway.from) * 7.5)} m · {AIRPORT.code}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusChip status={status} />
      </div>
      <div className="fields">
        <Field label="On the runway">{state.runwayUse[runway.id] ? status.flight?.callsign ?? 'Vacating' : 'Nobody'}</Field>
        <Field label={arrivals ? 'Last landing' : 'Last departure'}>{last ? formatTime(last) : 'None yet'}</Field>
        <Field label="Movements this watch">{events.length}</Field>
        <Field label="Wind">260° at 9 kt</Field>
      </div>
    </>
  )
}

function TowerDetail({ state }) {
  const kpis = siteKpis(state)
  return (
    <>
      <div className="detail-head">
        <span className="detail-tile">
          <Icon name="tower" size={22} />
        </span>
        <div>
          <h2>Ondra Tower</h2>
          <p>{AIRPORT.name} ({AIRPORT.code})</p>
        </div>
      </div>
      <div className="detail-status">
        {Object.values(RUNWAYS).map((runway) => (
          <StatusChip key={runway.id} status={{ ...runwayStatus(state, runway), label: `${runway.name} ${runwayStatus(state, runway).label.toLowerCase()}` }} />
        ))}
      </div>
      <div className="fields">
        <Field label="Aircraft">{kpis.inSector}</Field>
        <Field label="Arrivals per hour">{kpis.perHour}</Field>
        <Field label="Departures this watch">{state.departures.length}</Field>
        <Field label="Frequency">{state.site.frequency}</Field>
      </div>
    </>
  )
}

function DetailCard({ state, selectedId }) {
  const entity = findEntity(selectedId)
  if (!entity) return null
  return (
    <aside className="card detail" aria-label="Selection details">
      <button className="locate" onClick={() => selectAndFly(selectedId)} aria-label="Fly to selection" title="Fly to selection">
        <Icon name="locate" size={17} />
      </button>
      {entity.type === 'flight' && <FlightDetail state={state} flight={entity.item} />}
      {entity.type === 'fix' && <FixDetail state={state} fix={entity.item} />}
      {entity.type === 'weather' && <WeatherDetail state={state} weather={entity.item} />}
      {entity.type === 'runway' && <RunwayDetail state={state} runway={entity.item} />}
      {entity.type === 'tower' && <TowerDetail state={state} />}
    </aside>
  )
}

// ---------- arrival timeline ----------

function Timeline({ state, selectedId }) {
  const flight = focusFlight(state, selectedId)
  if (!flight) return null
  const steps = arrivalTimeline(state, flight)
  return (
    <section className="card timeline" aria-label="Arrival timeline">
      <div className="timeline-main">
        <div className="timeline-title">
          <Icon name="landing" size={18} />
          <h3>Arrival</h3>
          <span className="muted">{flight.callsign} · {flight.origin.name} to {AIRPORT.city}</span>
        </div>
        <ol className="stages">
          {steps.map((step, index) => (
            <li key={step.key} className={`stage stage-${step.status}`}>
              {index > 0 && (
                <span className="stage-rail">
                  <span style={{ width: step.status === 'upcoming' ? '0%' : '100%' }} />
                </span>
              )}
              <span className="stage-dot">
                {step.status === 'done' && <Icon name="check" size={14} strokeWidth={2.6} />}
                {step.status === 'skipped' && <Icon name="minus" size={14} strokeWidth={2.6} />}
                {step.status === 'current' && <span className="stage-core" />}
              </span>
              <strong>{step.label}</strong>
              <small>{step.time}</small>
            </li>
          ))}
        </ol>
      </div>
      <button className="flight-summary" onClick={() => selectAndFly(flight.id)}>
        <AirlineMark code={flight.airline} size={38} />
        <span>
          <strong>{flight.callsign} · {levelText(flight)}</strong>
          <small>{AIRLINES[flight.airline].name} · {flight.type}</small>
          <span className={`chip tone-${flight.delay >= 5 ? 'warn' : 'ok'}`}>
            <StatusIcon name={flight.delay >= 5 ? 'clock' : 'check'} />
            {delayLabel(flight.delay)}
          </span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </section>
  )
}

// ---------- lists ----------

function trafficRows(state) {
  return state.flights.map((flight) => ({
    tab: 'traffic',
    id: flight.id,
    lead: <AirlineMark code={flight.airline} size={26} />,
    title: flight.callsign,
    subtitle: `${flight.type} · ${flight.origin.code} → ${flight.destination.code}`,
    status: flightStatus(flight),
    value: flight.altitude < 50 ? 'GND' : flight.altitude >= 18000 ? formatLevel(flight.altitude) : `${(flight.altitude / 1000).toFixed(1)}k ft`,
    meter: routeProgress(state, flight),
    meterTone: flight.alert === 'none' ? 'brand' : 'warn',
    search: `${flight.callsign} ${flight.spoken} ${AIRLINES[flight.airline].name} ${flight.type} ${flight.origin.name} ${flight.destination.name}`,
  }))
}

function alertRows(state) {
  return state.conflicts.map((conflict) => ({
    tab: 'alerts',
    id: conflict.id,
    target: conflict.ids.find((id) => state.flights.some((flight) => flight.id === id)) ?? null,
    lead: (
      <span className={`row-tile ${conflict.state === 'active' ? 'tile-warn' : ''}`}>
        <Icon name="radar" size={16} />
      </span>
    ),
    title: `${conflict.callsigns[0]} / ${conflict.callsigns[1]}`,
    subtitle: `Closest ${conflict.minimum.toFixed(1)} NM · ${conflict.action || 'Monitoring'}`,
    status: conflictStatus(conflict),
    value: formatTime(conflict.startedAt),
    meter: null,
    search: `${conflict.callsigns.join(' ')} conflict`,
  }))
}

function runwayRows(state) {
  if (!state.site.hasAirport) return []
  return Object.values(RUNWAYS).map((runway) => {
    const status = runwayStatus(state, runway)
    return {
      tab: 'runways',
      id: runway.id,
      lead: <span className="row-tile">{runway.name}</span>,
      title: `Runway ${runway.name}`,
      subtitle: `${runway.id === 'R1' ? 'Arrivals' : 'Departures'} · ${status.flight ? status.flight.callsign : 'nobody lined up'}`,
      status,
      value: `${(runway.id === 'R1' ? state.landings : state.departures).length} moves`,
      meter: null,
      search: `runway ${runway.name} ${runway.reverseName}`,
    }
  })
}

const LOG_STATUS = {
  instruction: { icon: 'arrow', label: 'Instruction', tone: 'info' },
  handoff: { icon: 'return', label: 'Handoff', tone: 'muted' },
  conflict: { icon: 'alert', label: 'Resolution', tone: 'warn' },
  event: { icon: 'check', label: 'Event', tone: 'ok' },
}

function logRows(state) {
  return state.log.map((entry) => ({
    tab: 'log',
    id: entry.id,
    target: state.flights.some((flight) => flight.id === entry.flightId) ? entry.flightId : null,
    lead: <span className="row-tile row-time">{formatTime(entry.at)}</span>,
    title: entry.callsign,
    subtitle: entry.text,
    status: LOG_STATUS[entry.kind],
    value: '',
    meter: null,
    search: `${entry.callsign} ${entry.text}`,
  }))
}

const TABS = [
  { key: 'traffic', label: 'Traffic', rows: trafficRows },
  { key: 'alerts', label: 'Alerts', rows: alertRows },
  { key: 'runways', label: 'Runways', rows: runwayRows, airportOnly: true },
  { key: 'log', label: 'Log', rows: logRows },
]

function matches(row, query) {
  return !query || row.search.toLowerCase().includes(query.trim().toLowerCase())
}

function searchRows(state, query) {
  const fixes = state.site.fixes.map((fix) => ({ tab: 'traffic', id: `fix-${fix.id}`, search: `${fix.id} fix` }))
  return [...TABS.flatMap((tab) => tab.rows(state)), ...fixes].filter((row) => query && matches(row, query))
}

function Lists({ state, ui }) {
  const tabs = TABS.filter((candidate) => !candidate.airportOnly || state.site.hasAirport)
  const tab = tabs.find((candidate) => candidate.key === ui.tab) ?? tabs[0]
  const rows = tab.rows(state).filter((row) => matches(row, ui.search))
  return (
    <section className="card lists" aria-label="Operations lists">
      <div className="tabs" role="tablist">
        {tabs.map((candidate) => (
          <button
            key={candidate.key}
            role="tab"
            aria-selected={candidate.key === tab.key}
            className={candidate.key === tab.key ? 'tab active' : 'tab'}
            onClick={() => setUi({ tab: candidate.key })}
          >
            {candidate.label}
            <span>{candidate.key === 'alerts' ? state.conflicts.filter((conflict) => conflict.state === 'active').length : candidate.rows(state).length}</span>
          </button>
        ))}
        <span className="tabs-site muted">{state.site.name}</span>
      </div>
      <div className="rows">
        {rows.length === 0 && <p className="empty muted">{ui.search ? `Nothing matches “${ui.search}”.` : 'Nothing here yet.'}</p>}
        {rows.map((row) => {
          const target = row.target === undefined ? row.id : row.target
          return (
            <button
              key={row.id}
              data-id={row.id}
              className={target && target === ui.selectedId ? 'row selected' : 'row'}
              onClick={() => target && selectAndFly(target)}
            >
              {row.lead}
              <span className="row-text">
                <strong>{row.title}</strong>
                <small>{row.subtitle}</small>
              </span>
              <StatusChip status={row.status} />
              <span className="row-value">
                {row.meter !== null && <Meter value={row.meter} tone={row.meterTone ?? 'brand'} />}
                <small>{row.value}</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ---------- camera buttons ----------

function CameraButtons({ state }) {
  const buttons = [
    { icon: 'plus', label: 'Zoom in', action: () => zoomBy(0.7) },
    { icon: 'minus', label: 'Zoom out', action: () => zoomBy(1.4) },
    { icon: 'rotateLeft', label: 'Rotate left', action: () => rotateBy(-Math.PI / 6) },
    { icon: 'rotateRight', label: 'Rotate right', action: () => rotateBy(Math.PI / 6) },
    { icon: 'home', label: 'Whole sector', action: () => viewSite(state) },
  ]
  return (
    <nav className="card camera-buttons" aria-label="Camera">
      {buttons.map((button) => (
        <button key={button.icon} className="icon-button" onClick={button.action} aria-label={button.label} title={button.label}>
          <Icon name={button.icon} />
        </button>
      ))}
    </nav>
  )
}

export function Dashboard() {
  const ui = useUi()
  const state = world.sites[ui.siteId]
  return (
    <div className="overlay">
      <TopBar state={state} ui={ui} />
      <Kpis state={state} />
      <CameraButtons state={state} />
      <DetailCard state={state} selectedId={ui.selectedId} />
      <Timeline state={state} selectedId={ui.selectedId} />
      <Lists state={state} ui={ui} />
    </div>
  )
}
