// The dashboard around the 3D view: top bar, KPI cards, detail card, pit-stop timeline, lists and camera buttons.
import { useEffect, useMemo, useState } from 'react'
import { CHAMPIONSHIP, COMPOUNDS, CREW_ROLES, OUR_TEAM, RACE_LAPS, SITE_ORDER, SITES, TEAMS } from '../data.js'
import { formatLap, strategyFor } from '../sim.js'
import { applyView, currentSite, findEntity, rotateBy, select, setUi, siteView, switchSite, useUi, wideView, world, zoomBy } from '../store.js'
import { Icon, ProductMark, StatusChip } from './Icon.jsx'
import { MESSAGE_ICONS, STATUS, averageStop, cardFor, carStatus, gapText, personStatus } from './ops.js'

function CompoundDot({ compound }) {
  const info = COMPOUNDS[compound]
  return (
    <span className="compound" style={{ '--compound': info.color }} title={info.label}>
      {info.letter}
    </span>
  )
}

function localClock(state) {
  const hours = state.site.startHour + state.time / 3600 * 4.1
  const hour = Math.floor(hours) % 24
  const minutes = Math.floor((hours % 1) * 60)
  const seconds = Math.floor((((hours % 1) * 60) % 1) * 60)
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function SiteSwitcher({ siteId }) {
  const [open, setOpen] = useState(false)
  const site = SITES[siteId]
  return (
    <div className="site-switcher">
      <button className="site-button" onClick={() => setOpen(!open)}>
        <Icon name="flag" size={16} />
        <span className="site-name">{site.name}</span>
        <span className="site-round">Round {site.round}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="site-menu">
          {SITE_ORDER.map((id) => (
            <button
              key={id}
              className={id === siteId ? 'active' : ''}
              onClick={() => {
                setOpen(false)
                if (id !== siteId) switchSite(id)
              }}
            >
              <span className="site-menu-name">{SITES[id].name}</span>
              <span className="site-menu-meta">Round {SITES[id].round}, {SITES[id].kind === 'street' ? 'street circuit at night' : SITES[id].kind === 'desert' ? 'desert circuit' : 'parkland circuit'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function searchIndex(state) {
  const entries = []
  for (const car of state.cars) entries.push({ id: car.id, label: `#${car.number} ${car.driver}`, meta: TEAMS[car.team].name, icon: 'car' })
  for (const person of state.people) entries.push({ id: person.id, label: person.name, meta: CREW_ROLES[person.role], icon: 'person' })
  for (const item of state.statics) entries.push({ id: item.id, label: item.label, meta: item.team ? TEAMS[item.team].short : 'Circuit', icon: 'circle' })
  return entries
}

function Search({ ui, state }) {
  const [focused, setFocused] = useState(false)
  const results = useMemo(() => {
    const query = ui.search.trim().toLowerCase()
    if (!query) return []
    return searchIndex(state).filter((entry) => `${entry.label} ${entry.meta}`.toLowerCase().includes(query)).slice(0, 7)
  }, [ui.search, state])
  return (
    <div className="search">
      <Icon name="search" size={17} />
      <input
        value={ui.search}
        placeholder="Search cars, crew, garages"
        onChange={(event) => setUi({ search: event.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) {
            select(results[0].id)
            setUi({ search: '' })
          }
        }}
      />
      {focused && results.length > 0 && (
        <div className="search-results">
          {results.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                select(entry.id)
                setUi({ search: '' })
              }}
            >
              <Icon name={entry.icon} size={15} />
              <span>{entry.label}</span>
              <span className="muted">{entry.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TopBar({ ui, state }) {
  return (
    <header className="topbar panel">
      <div className="brand">
        <ProductMark />
        <div>
          <div className="brand-name">Boxline</div>
          <div className="brand-sub">{CHAMPIONSHIP}</div>
        </div>
      </div>
      <Search ui={ui} state={state} />
      <SiteSwitcher siteId={ui.siteId} />
      <div className="topbar-right">
        <span className="weather">
          <Icon name="thermometer" size={16} />
          Track {state.weather.trackTemp.toFixed(1)} °C
        </span>
        <span className="weather">
          <Icon name="cloud" size={16} />
          Rain {state.weather.rain}%
        </span>
        <span className="lap-pill">
          Lap {state.raceLap}/{RACE_LAPS}
        </span>
        <span className="clock">
          <Icon name="clock" size={16} />
          {localClock(state)}
        </span>
        <div className="user">
          <span className="avatar">MS</span>
          <div>
            <div className="user-name">Mira Sato</div>
            <div className="muted">Race engineer, #07</div>
          </div>
        </div>
      </div>
    </header>
  )
}

function Kpis({ state }) {
  const car = state.cars.find((candidate) => candidate.id === 'car07')
  const strategy = strategyFor(state, car)
  const average = averageStop(state, OUR_TEAM)
  const life = strategy.lifeLeft
  const cards = [
    { icon: 'trophy', label: 'Race position', value: `P${car.racePosition}`, note: `#07 Okafor-Hale, of ${state.cars.length}` },
    { icon: 'timer', label: 'Gap to leader', value: car.racePosition === 1 ? 'Leader' : `+${car.gap.toFixed(2)} s`, note: car.racePosition === 1 ? `Lead ${state.cars.find((other) => other.racePosition === 2).gap.toFixed(2)} s` : `Interval +${car.interval.toFixed(2)} s` },
    { icon: 'stopwatch', label: 'Average pit stop', value: `${average.toFixed(2)} s`, note: `${state.stops.filter((stop) => stop.team === OUR_TEAM && stop.duration).length} stops, Halvard` },
    { icon: 'tyre', label: 'Tyre life left', value: `${Math.round(life)}%`, note: `${COMPOUNDS[car.compound].label}, ${car.tyreAge} laps`, bar: life / 100, compound: car.compound },
  ]
  return (
    <section className="kpis">
      {cards.map((card) => (
        <div key={card.label} className="kpi panel">
          <div className="kpi-head">
            <span className="kpi-icon">
              <Icon name={card.icon} size={16} />
            </span>
            {card.label}
          </div>
          <div className="kpi-value">
            {card.value}
            {card.compound && <CompoundDot compound={card.compound} />}
          </div>
          <div className="kpi-note">{card.note}</div>
          {card.bar !== undefined && (
            <div className="bar">
              <div className={`bar-fill tone-${card.bar < 0.3 ? 'red' : 'green'}`} style={{ width: `${card.bar * 100}%` }} />
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function FieldValue({ value }) {
  if (value && typeof value === 'object') {
    return (
      <span className="field-compound">
        <CompoundDot compound={value.compound} />
        {value.text}
      </span>
    )
  }
  return value
}

function DetailCard({ ui, state }) {
  const entity = findEntity(ui.selectedId, state)
  if (!entity) return null
  const card = cardFor(state, entity)
  return (
    <aside className="detail panel" style={{ '--team': card.teamColor }}>
      <div className="detail-head">
        <span className="detail-icon">
          <Icon name={card.icon} size={20} />
        </span>
        <div className="detail-titles">
          <h2>{card.title}</h2>
          <div className="muted">{card.subtitle}</div>
        </div>
      </div>
      <StatusChip status={card.status} />
      {card.progress && (
        <div className="progress">
          <div className="progress-label">
            <span>{card.progress.label}</span>
            <span>{Math.round(Math.min(1, card.progress.value) * 100)}%</span>
          </div>
          <div className="bar">
            <div className={`bar-fill tone-${card.progress.tone}`} style={{ width: `${Math.min(1, Math.max(0, card.progress.value)) * 100}%` }} />
          </div>
        </div>
      )}
      <dl className="fields">
        {card.fields.map(([label, value]) => (
          <div key={label} className="field">
            <dt>{label}</dt>
            <dd>
              <FieldValue value={value} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="detail-hint">Esc or click empty ground to close</div>
    </aside>
  )
}

const PHASES = [
  { key: 'call', label: 'Box call', icon: 'radio', weight: 2.2 },
  { key: 'entry', label: 'Pit entry', icon: 'arrow', weight: 2.6 },
  { key: 'stop', label: 'Stationary', icon: 'stop', weight: 2 },
  { key: 'release', label: 'Release', icon: 'play', weight: 1.4 },
  { key: 'done', label: 'Back on track', icon: 'check', weight: 1.2 },
]
const EXPECTED = { call: 10, entry: 7.5, stop: 2.5, release: 7.5 }

function stopProgress(state, stop) {
  if (!stop) return { index: -1, fraction: 0 }
  const index = PHASES.findIndex((phase) => phase.key === stop.phase)
  const started = { call: stop.callAt, entry: stop.entryAt, stop: stop.stopAt, release: stop.releaseAt }[stop.phase]
  const fraction = stop.phase === 'done' ? 1 : Math.min(0.97, (state.time - started) / EXPECTED[stop.phase])
  return { index, fraction }
}

function Timeline({ state }) {
  const car = state.cars.find((candidate) => candidate.id === 'car07')
  const stop = car.currentStop ?? state.stops.find((candidate) => candidate.carId === 'car07')
  const strategy = strategyFor(state, car)
  const { index, fraction } = stopProgress(state, stop)
  const totalWeight = PHASES.reduce((sum, phase) => sum + phase.weight, 0)
  const before = PHASES.slice(0, Math.max(0, index)).reduce((sum, phase) => sum + phase.weight, 0)
  const playhead = index < 0 ? 0 : (before + (index >= 0 ? PHASES[index].weight * fraction : 0)) / totalWeight
  const history = state.stops.filter((candidate) => candidate.carId === 'car07').reverse()
  const stints = []
  let lapFrom = 1
  let compound = history[0]?.from ?? car.compound
  for (const past of history) {
    stints.push({ from: lapFrom, to: past.lap, compound: past.from })
    lapFrom = past.lap
    compound = past.to
  }
  stints.push({ from: lapFrom, to: RACE_LAPS, compound: car.currentStop ? car.currentStop.from : compound, future: true })
  const lapNow = strategy.lapNow
  const stationary = stop?.duration ?? (stop?.phase === 'stop' ? car.stopClock : null)
  return (
    <section className="timeline panel">
      <div className="timeline-head">
        <div>
          <h3>Pit stop, car #07</h3>
          <div className="muted">
            {stop ? `Lap ${stop.lap}, ${COMPOUNDS[stop.from].label} to ${COMPOUNDS[stop.to].label}` : `Planned lap ${strategy.plannedStopLap}`}
          </div>
        </div>
        <div className="timeline-figures">
          <div>
            <span className="muted">Stationary</span>
            <strong>{stationary ? `${stationary.toFixed(2)} s` : '--'}</strong>
          </div>
          <div>
            <span className="muted">Next stop</span>
            <strong>Lap {strategy.plannedStopLap}</strong>
          </div>
          <div>
            <span className="muted">Undercut</span>
            <strong>
              Laps {strategy.undercutOpen}-{strategy.undercutClose}
            </strong>
          </div>
        </div>
      </div>
      <div className="phases">
        {PHASES.map((phase, phaseIndex) => {
          const state_ = phaseIndex < index || stop?.phase === 'done' ? 'past' : phaseIndex === index ? 'now' : 'next'
          return (
            <div key={phase.key} className={`phase phase-${state_}`} style={{ flex: phase.weight }}>
              <Icon name={state_ === 'past' ? 'check' : phase.icon} size={14} strokeWidth={2.4} />
              <span>{phase.label}</span>
            </div>
          )
        })}
        {index >= 0 && <div className="playhead" style={{ left: `${playhead * 100}%` }} />}
      </div>
      <div className="laps">
        {stints.map((stint, stintIndex) => (
          <div key={stintIndex} className={`stint ${stint.future ? 'future' : ''}`} style={{ left: `${((stint.from - 1) / RACE_LAPS) * 100}%`, width: `${((stint.to - stint.from + 1) / RACE_LAPS) * 100}%`, '--compound': COMPOUNDS[stint.compound].color }} />
        ))}
        <div className="window" style={{ left: `${((strategy.undercutOpen - 1) / RACE_LAPS) * 100}%`, width: `${((strategy.undercutClose - strategy.undercutOpen + 1) / RACE_LAPS) * 100}%` }} />
        <div className="lap-now" style={{ left: `${((lapNow - 0.5) / RACE_LAPS) * 100}%` }}>
          <span>Lap {lapNow}</span>
        </div>
      </div>
      <div className="lap-scale">
        {[1, 10, 20, 30, 40, 50, RACE_LAPS].map((lap) => (
          <span key={lap} style={{ left: `${((lap - 0.5) / RACE_LAPS) * 100}%` }}>
            {lap}
          </span>
        ))}
      </div>
    </section>
  )
}

const TABS = [
  { key: 'cars', label: 'Cars' },
  { key: 'crew', label: 'Crew' },
  { key: 'stops', label: 'Stops' },
  { key: 'control', label: 'Race control' },
]

function Lists({ ui, state }) {
  let rows
  if (ui.tab === 'cars') {
    rows = state.order.map((id) => state.cars.find((car) => car.id === id)).map((car) => (
      <button key={car.id} className={`row ${ui.selectedId === car.id ? 'selected' : ''}`} data-id={car.id} onClick={() => select(car.id)}>
        <span className="row-pos">{car.racePosition}</span>
        <span className="row-number" style={{ '--team': TEAMS[car.team].color }}>
          {car.number}
        </span>
        <span className="row-main">
          <span className="row-title">{car.driver}</span>
          <span className="row-meta">
            {gapText(car)} · {formatLap(car.lastLap)}
          </span>
        </span>
        <CompoundDot compound={car.compound} />
        <StatusChip status={carStatus(state, car)} />
      </button>
    ))
  } else if (ui.tab === 'crew') {
    rows = state.people
      .filter((person) => person.team === OUR_TEAM)
      .map((person) => (
        <button key={person.id} className={`row ${ui.selectedId === person.id ? 'selected' : ''}`} data-id={person.id} onClick={() => select(person.id)}>
          <span className="row-icon">
            <Icon name="person" size={15} />
          </span>
          <span className="row-main">
            <span className="row-title">{person.name}</span>
            <span className="row-meta">
              {CREW_ROLES[person.role]}
              {person.slot?.wheel ? `, ${person.slot.wheel.toUpperCase()}` : ''}
            </span>
          </span>
          <StatusChip status={personStatus(person)} />
        </button>
      ))
  } else if (ui.tab === 'stops') {
    rows = state.stops.slice(0, 20).map((stop) => {
      const car = state.cars.find((candidate) => candidate.id === stop.carId)
      const status = stop.duration ? { label: `${stop.duration.toFixed(2)} s`, icon: 'check', tone: 'green' } : STATUS[stop.phase === 'stop' ? 'stopped' : 'pitlane']
      return (
        <button key={stop.id} className="row" data-id={car.id} onClick={() => select(car.id)}>
          <span className="row-number" style={{ '--team': TEAMS[car.team].color }}>
            {car.number}
          </span>
          <span className="row-main">
            <span className="row-title">Lap {stop.lap}</span>
            <span className="row-meta">
              {COMPOUNDS[stop.from].label} to {COMPOUNDS[stop.to].label}
            </span>
          </span>
          <CompoundDot compound={stop.to} />
          <StatusChip status={status} />
        </button>
      )
    })
  } else {
    rows = state.messages.slice(0, 20).map((message) => (
      <div key={message.id} className={`row message message-${message.kind}`}>
        <span className="row-icon">
          <Icon name={MESSAGE_ICONS[message.kind] ?? 'flag'} size={15} />
        </span>
        <span className="row-main">
          <span className="row-title wrap">{message.text}</span>
          <span className="row-meta">{Math.max(0, Math.round(state.time - message.time))} s ago</span>
        </span>
      </div>
    ))
  }
  return (
    <section className="lists panel">
      <nav className="tabs">
        {TABS.map((tab) => (
          <button key={tab.key} className={`tab ${ui.tab === tab.key ? 'active' : ''}`} onClick={() => setUi({ tab: tab.key })}>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="rows">{rows.length ? rows : <div className="empty">No stops yet</div>}</div>
    </section>
  )
}

function CameraButtons() {
  const buttons = [
    { icon: 'plus', label: 'Zoom in', action: () => zoomBy(0.7) },
    { icon: 'minus', label: 'Zoom out', action: () => zoomBy(1.4) },
    { icon: 'rotateLeft', label: 'Rotate left', action: () => rotateBy(-0.4) },
    { icon: 'rotateRight', label: 'Rotate right', action: () => rotateBy(0.4) },
    { icon: 'home', label: 'Pit lane view', action: () => applyView(siteView()) },
    { icon: 'wide', label: 'Whole circuit', action: () => applyView(wideView()) },
  ]
  return (
    <div className="camera-buttons panel">
      {buttons.map((button) => (
        <button key={button.label} className="camera-button" title={button.label} aria-label={button.label} onClick={button.action}>
          <Icon name={button.icon} size={18} />
        </button>
      ))}
    </div>
  )
}

export function Dashboard() {
  const ui = useUi()
  const state = world.sites[ui.siteId]
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setUi({ selectedId: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  void currentSite
  return (
    <div className="dashboard">
      <TopBar ui={ui} state={state} />
      <Kpis state={state} />
      <CameraButtons />
      <DetailCard ui={ui} state={state} />
      <Timeline state={state} />
      <Lists ui={ui} state={state} />
    </div>
  )
}
