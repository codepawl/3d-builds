// Everything drawn over the 3D view. Reads the sim on each dashboard refresh (useUi().version).
import { useEffect, useRef, useState } from 'react'
import { PARK, RIDE_DAY, SHOWS, SITES } from '../data.js'
import { boatPhase, coasterPhase, formatClock } from '../sim.js'
import { COASTER_TRACK, FLUME_TRACK } from '../paths.js'
import { findEntity, flyTo, getUi, rotateBy, selectAndFly, setUi, switchSite, useUi, viewSite, world, zoomBy } from '../store.js'
import { KIND_ICONS, rideStatus, standStatus, ticketStatus, unitStatus } from '../status.js'
import { Icon, ProductMark, StatusChip } from './Icon.jsx'

const count = (value) => Math.round(value).toLocaleString('en-US')
const money = (value) => `$${(value / 1000).toFixed(1)}k`

function Meter({ value, tone = 'brand' }) {
  return (
    <span className={`meter meter-${tone}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </span>
  )
}

function Tile({ icon, color }) {
  return (
    <span className="row-tile" style={color ? { background: color, color: '#fff' } : undefined}>
      <Icon name={icon} size={16} />
    </span>
  )
}

// ---------- top bar ----------

function siteSummary(siteId) {
  const state = world.sites[siteId]
  const open = state.rides.filter((ride) => ride.state === 'open').length
  return `${count(world.guestsByLand[siteId])} guests · ${open}/${state.rides.length} open`
}

function SiteSwitcher({ state }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="site-switcher">
      <button className="site-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="site-badge" style={{ background: state.site.color }}>{state.site.id}</span>
        <span className="site-text">
          <strong>{state.site.name} · {state.site.area}</strong>
          <small>{siteSummary(state.site.id)}</small>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="site-menu" role="menu">
          {SITES.map((site) => (
            <button
              key={site.id}
              role="menuitem"
              data-site={site.id}
              className={site.id === state.site.id ? 'active' : ''}
              onClick={() => {
                setOpen(false)
                switchSite(site.id)
              }}
            >
              <span className="site-badge" style={{ background: site.color }}>{site.id}</span>
              <span className="site-text">
                <strong>{site.name} · {site.area}</strong>
                <small>{siteSummary(site.id)}</small>
              </span>
            </button>
          ))}
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
        placeholder="Search rides, trains, stands, staff, tickets"
        onChange={(event) => setUi({ search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const current = world.sites[getUi().siteId]
          const first = TABS.flatMap((tab) => tab.rows(current).map((row) => ({ ...row, tab: tab.key }))).find((row) => matches(row, event.target.value))
          if (first) {
            setUi({ tab: first.tab })
            first.open()
          }
        }}
      />
      <kbd>/</kbd>
    </label>
  )
}

function TopBar({ state, ui }) {
  const alerts = Object.values(world.sites).reduce((sum, site) => sum + site.rides.filter((ride) => ride.state !== 'open').length, 0)
  return (
    <header className="top-bar">
      <div className="brand">
        <ProductMark />
        <span>Gladewheel</span>
      </div>
      <SearchBox value={ui.search} />
      <div className="top-right">
        <SiteSwitcher state={state} />
        <span className="clock" title={`${PARK.weather.label}, ${PARK.weather.temperature} °C`}>
          <Icon name="sun" size={16} />
          {PARK.weather.temperature}°
        </span>
        <span className="clock" title="Park time">
          <span className="live-dot" />
          {formatClock(world.clock)}
          <small>Live</small>
        </span>
        <button className="icon-button" aria-label={`${alerts} rides need attention`} title={`${alerts} rides need attention`} onClick={() => setUi({ tab: 'rides', search: '' })}>
          <Icon name="bell" />
          {alerts > 0 && <span className="badge-count">{alerts}</span>}
        </button>
        <div className="user">
          <span className="avatar">{PARK.user.initials}</span>
          <span className="user-text">
            <strong>{PARK.user.name}</strong>
            <small>{PARK.user.role} · {PARK.name}</small>
          </span>
        </div>
      </div>
    </header>
  )
}

// ---------- KPI cards ----------

function KpiCard({ icon, label, value, unit, note, trend }) {
  return (
    <div className="card kpi">
      <span className="kpi-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <span className="kpi-label">{label}</span>
        <div className="kpi-value">
          {value}
          {unit && <small>{unit}</small>}
          {trend && <span className={`trend trend-${trend.tone}`}>{trend.text}</span>}
        </div>
        <span className="kpi-note">{note}</span>
      </div>
    </div>
  )
}

function parkKpis() {
  const rides = Object.values(world.sites).flatMap((state) => state.rides)
  const open = rides.filter((ride) => ride.state === 'open')
  const guests = Object.values(world.guestsByLand).reduce((sum, value) => sum + value, 0)
  return { guests, wait: open.reduce((sum, ride) => sum + ride.wait, 0) / Math.max(1, open.length), open: open.length, total: rides.length, satisfaction: world.satisfaction }
}

function Kpis({ state }) {
  const kpis = parkKpis()
  return (
    <section className="kpis">
      <KpiCard icon="guests" label="Guests in park" value={count(kpis.guests)} note={`${count(world.guestsByLand[state.site.id])} in ${state.site.name}`} trend={{ tone: 'good', text: '+3.1%' }} />
      <KpiCard icon="clock" label="Average wait" value={kpis.wait.toFixed(0)} unit="min" note="Open rides, park wide" trend={{ tone: kpis.wait > 30 ? 'bad' : 'good', text: kpis.wait > 30 ? '+4' : '-2' }} />
      <KpiCard icon="coaster" label="Rides open" value={kpis.open} unit={`/${kpis.total}`} note={`${kpis.total - kpis.open} down or testing`} />
      <KpiCard icon="smile" label="Guest satisfaction" value={kpis.satisfaction.toFixed(1)} unit="%" note="Today, 1,284 surveys" trend={{ tone: 'good', text: '+0.6' }} />
    </section>
  )
}

// ---------- detail card ----------

function Field({ label, children }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

function DetailHead({ icon, color, title, subtitle, status }) {
  return (
    <>
      <div className="detail-head">
        <span className="detail-tile" style={color ? { background: color, color: '#fff' } : undefined}>
          <Icon name={icon} size={24} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="detail-status">
        <StatusChip status={status} />
      </div>
    </>
  )
}

function Progress({ label, value, display, tone = 'brand' }) {
  return (
    <div className="detail-progress">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{display ?? `${Math.round(value * 100)}%`}</strong>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  )
}

function RideDetail({ state, item: ride }) {
  const queue = state.queues.find((candidate) => candidate.rideId === ride.id)
  const queued = queue ? state.guests.filter((guest) => guest.queue === queue).length : 0
  const ticket = state.tickets.find((candidate) => candidate.rideId === ride.id && candidate.status !== 'done')
  return (
    <>
      <DetailHead icon={KIND_ICONS[ride.kind]} color={state.site.color} title={ride.name} subtitle={`${state.site.name} · ${ride.kind === 'darkcoaster' ? 'indoor coaster' : ride.kind === 'darkride' ? 'dark ride' : ride.kind}`} status={rideStatus(ride)} />
      <div className="fields">
        <Field label="Posted wait">{ride.state === 'down' ? 'Closed' : `${Math.round(ride.wait)} min`}</Field>
        <Field label="Riders per hour">{count(ride.rph)}</Field>
        <Field label="Riders today">{count(ride.ridersToday + ride.capacity * 3.4)}</Field>
        <Field label="In queue">{queued ? `${queued} guests` : 'Walk on'}</Field>
        <Field label="Open ticket">{ticket ? `${ticket.id} · ${ticket.title}` : 'None'}</Field>
        <Field label="Next inspection">{formatClock(ride.nextCheck)}</Field>
      </div>
      <Progress label="Throughput against capacity" value={ride.rph / ride.capacity} display={`${count(ride.rph)} / ${count(ride.capacity)}`} tone={ride.state === 'open' ? 'ok' : 'warn'} />
    </>
  )
}

function TrainDetail({ state, item: train }) {
  const height = train.position.y
  return (
    <>
      <DetailHead icon="coaster" color="#e0464f" title={train.name} subtitle="Riptide Runner · 5 cars, 20 seats" status={unitStatus(train)} />
      <div className="fields">
        <Field label="Speed">{Math.round(train.speed * 3.6)} km/h</Field>
        <Field label="Height">{height.toFixed(1)} m</Field>
        <Field label="Riders">{train.dwell > 0 ? 'Boarding' : `${train.riders} of 20`}</Field>
        <Field label="Laps today">{train.lapsToday}</Field>
        <Field label="Phase">{coasterPhase(train) === 'lift' ? `Lift hill, ${Math.max(0, 94 - train.along).toFixed(0)} m to crest` : unitStatus(train).label}</Field>
        <Field label="Block">{train.dwell > 0 ? 'Station' : train.along < 94 && train.along > 38 ? 'Lift' : 'Circuit'}</Field>
      </div>
      <Progress label="Lap progress" value={((train.along - 38 + COASTER_TRACK.length) % COASTER_TRACK.length) / COASTER_TRACK.length} />
    </>
  )
}

function BoatDetail({ item: boat }) {
  return (
    <>
      <DetailHead icon="water" color="#2f9e6e" title={boat.name} subtitle="Kalua Falls · hollow log, 5 seats" status={unitStatus(boat)} />
      <div className="fields">
        <Field label="Speed">{Math.round(boat.speed * 3.6)} km/h</Field>
        <Field label="Height">{boat.position.y.toFixed(1)} m</Field>
        <Field label="Riders">{boat.riders} of 5</Field>
        <Field label="Splashdowns today">{boat.splashes}</Field>
        <Field label="Phase">{boatPhase(boat)}</Field>
      </div>
      <Progress label="Trip progress" value={((boat.along - FLUME_TRACK.station[0] + FLUME_TRACK.length) % FLUME_TRACK.length) / FLUME_TRACK.length} />
    </>
  )
}

function LoopDetail({ state, item: unit }) {
  const icons = { monorail: 'monorail', tram: 'tram', cart: 'cart', float: 'star' }
  const subtitles = { monorail: 'Skyloop Monorail · 3 cars', tram: 'Lot Tram Line · tractor and 2 trailers', cart: `${state.site.name} · maintenance`, float: 'Lanterns of Briarwood parade' }
  return (
    <>
      <DetailHead icon={icons[unit.kind]} color={state.site.color} title={unit.name} subtitle={subtitles[unit.kind]} status={unitStatus(unit)} />
      <div className="fields">
        <Field label="Speed">{(unit.speed * 3.6).toFixed(0)} km/h</Field>
        {unit.capacity && <Field label="Riders">{unit.riders} of {unit.capacity}</Field>}
        {unit.kind === 'cart' && <Field label="Job">{state.tickets.find((ticket) => ticket.status !== 'done')?.id ?? 'Patrol'}</Field>}
        {unit.kind === 'float' && <Field label="Next show">{formatClock(SHOWS[0].at)}</Field>}
        <Field label="Next stop">{unit.dwell > 0 ? `Here, ${Math.ceil(unit.dwell)} s` : unit.stops.length ? `${Math.round((((unit.stops[0].at - unit.s) % unit.path.length) + unit.path.length) % unit.path.length)} m ahead` : 'Parade route'}</Field>
      </div>
      <Progress label="Loop progress" value={unit.s / unit.path.length} />
    </>
  )
}

function StaffDetail({ state, item: person }) {
  const ride = state.rides.find((candidate) => candidate.id === person.rideId)
  return (
    <>
      <DetailHead icon="person" color="#3a4b66" title={person.name} subtitle={`${person.role} · ${ride ? ride.name : state.site.name}`} status={unitStatus(person)} />
      <div className="fields">
        <Field label="Shift">08:00 to 16:30</Field>
        <Field label="Post">{ride ? `${ride.name} load platform` : 'Walking rounds'}</Field>
        <Field label="Radio">Channel {state.site.id === 'AD' ? 4 : 6}</Field>
      </div>
      <Progress label="Shift progress" value={Math.min(1, (world.clock - 480) / 510)} />
    </>
  )
}

function StandDetail({ state, item: stand }) {
  return (
    <>
      <DetailHead icon={stand.kind === 'food' ? 'food' : 'bag'} color="#c06a2a" title={stand.name} subtitle={`${state.site.name} · ${stand.kind === 'food' ? 'food and drink' : 'retail'}`} status={standStatus(stand)} />
      <div className="fields">
        <Field label="Sales today">{money(stand.salesToday)}</Field>
        <Field label="Per hour">{money(stand.perHour * 10)}</Field>
        <Field label="Orders served">{count(stand.served + stand.salesToday / 14)}</Field>
      </div>
      <Progress label="Stock on hand" value={stand.stock} tone={stand.stock < 0.25 ? 'warn' : 'ok'} />
    </>
  )
}

const DETAILS = { ride: RideDetail, train: TrainDetail, boat: BoatDetail, monorail: LoopDetail, tram: LoopDetail, cart: LoopDetail, float: LoopDetail, staff: StaffDetail, stand: StandDetail }

function DetailCard({ state, selectedId }) {
  const entity = findEntity(selectedId)
  if (!entity) return null
  const Detail = DETAILS[entity.type]
  return (
    <aside className="card detail" aria-label="Selection details">
      <button className="locate" onClick={() => flyTo(entity, selectedId)} aria-label="Fly to and follow" title="Fly to and follow">
        <Icon name="locate" size={17} />
      </button>
      <Detail state={state} item={entity.item} />
    </aside>
  )
}

// ---------- one ride's day ----------

function Timeline({ state, ui }) {
  const selected = findEntity(ui.selectedId)
  const ride = selected?.type === 'ride' ? selected.item : state.rides.find((candidate) => candidate.id === (selected?.item.rideId ?? state.focusRideId)) ?? state.rides[0]
  const now = world.clock
  const currentIndex = RIDE_DAY.reduce((found, stage, index) => (now >= stage.at ? index : found), -1)
  const shift = ride.capacity % 23
  return (
    <section className="card timeline" aria-label="Ride day">
      <div className="timeline-main">
        <div className="timeline-title">
          <Icon name={KIND_ICONS[ride.kind]} size={18} />
          <h3>{ride.name} today</h3>
          <span className="muted">Rope drop 09:00 · close 22:00 · {count(ride.ridersToday + ride.capacity * 3.4)} riders so far</span>
        </div>
        <ol className="stages">
          {RIDE_DAY.map((stage, index) => {
            const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
            const next = RIDE_DAY[index + 1]
            const progress = status === 'current' && next ? (now - stage.at) / (next.at - stage.at) : 0
            return (
              <li key={stage.key} className={`stage stage-${status}`}>
                {index > 0 && (
                  <span className="stage-rail">
                    <span style={{ width: status === 'upcoming' ? '0%' : '100%' }} />
                  </span>
                )}
                <span className="stage-dot" style={{ '--progress': `${progress * 360}deg` }}>
                  {status === 'done' && <Icon name="check" size={14} strokeWidth={2.6} />}
                  {status === 'current' && <span className="stage-core" />}
                </span>
                <strong>{stage.label}</strong>
                <small>{formatClock(stage.at + (index > 1 ? shift : 0))}</small>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="flight-summary">
        <span className="detail-tile" style={{ background: state.site.color, color: '#fff' }}>
          <Icon name="clock" size={20} />
        </span>
        <span>
          <strong>{ride.state === 'down' ? 'Closed' : `${Math.round(ride.wait)} min wait`}</strong>
          <small>{count(ride.rph)} riders per hour</small>
          <StatusChip status={rideStatus(ride)} />
        </span>
      </div>
    </section>
  )
}

// ---------- lists ----------

function entityRow(id, fields) {
  return { id, selectedId: id, open: () => selectAndFly(id), ...fields }
}

function rideRows(state) {
  return state.rides.map((ride) =>
    entityRow(ride.id, {
      lead: <Tile icon={KIND_ICONS[ride.kind]} color={state.site.color} />,
      title: ride.name,
      subtitle: `${ride.state === 'down' ? 'Closed' : `${Math.round(ride.wait)} min wait`} · ${count(ride.rph)}/hr`,
      status: rideStatus(ride),
      value: `${Math.round((ride.rph / ride.capacity) * 100)}%`,
      meter: ride.rph / ride.capacity,
      meterTone: ride.state === 'open' ? 'ok' : 'warn',
      search: `${ride.name} ${ride.kind} ride ${rideStatus(ride).label}`,
    }),
  )
}

function vehicleRows(state) {
  return state.units
    .filter((unit) => unit.kind !== 'staff')
    .map((unit) =>
      entityRow(unit.id, {
        lead: <Tile icon={KIND_ICONS[unit.kind] ?? 'arrow'} />,
        title: unit.name,
        subtitle: unit.kind === 'train' || unit.kind === 'boat' ? `${Math.round(unit.speed * 3.6)} km/h · ${unit.position.y.toFixed(0)} m up` : `${Math.round(unit.speed * 3.6)} km/h`,
        status: unitStatus(unit),
        value: unit.riders !== undefined ? `${unit.riders}` : '',
        meter: null,
        search: `${unit.name} ${unit.kind} vehicle ${unitStatus(unit).label}`,
      }),
    )
}

function standRows(state) {
  return state.stands.map((stand) =>
    entityRow(stand.id, {
      lead: <Tile icon={stand.kind === 'food' ? 'food' : 'bag'} />,
      title: stand.name,
      subtitle: `${money(stand.salesToday)} today`,
      status: standStatus(stand),
      value: `${Math.round(stand.stock * 100)}%`,
      meter: stand.stock,
      meterTone: stand.stock < 0.25 ? 'warn' : 'ok',
      search: `${stand.name} ${stand.kind} stand shop food`,
    }),
  )
}

function ticketRows(state) {
  return state.tickets.map((ticket) => {
    const ride = state.rides.find((candidate) => candidate.id === ticket.rideId)
    return {
      id: ticket.id,
      selectedId: ticket.rideId,
      open: () => selectAndFly(ticket.rideId),
      lead: <Tile icon="wrench" />,
      title: `${ticket.id} · ${ride?.name ?? ''}`,
      subtitle: ticket.title,
      status: ticketStatus(ticket),
      value: `${Math.round(ticket.progress * 100)}%`,
      meter: ticket.progress,
      meterTone: ticket.status === 'done' ? 'ok' : 'warn',
      search: `${ticket.id} ${ticket.title} ${ride?.name} ticket maintenance`,
    }
  })
}

function staffRows(state) {
  return state.units
    .filter((unit) => unit.kind === 'staff')
    .map((person) =>
      entityRow(person.id, {
        lead: <Tile icon="person" />,
        title: person.name,
        subtitle: `${person.role} · ${state.rides.find((ride) => ride.id === person.rideId)?.name ?? 'rounds'}`,
        status: unitStatus(person),
        value: '',
        meter: null,
        search: `${person.name} ${person.role} staff`,
      }),
    )
}

const TABS = [
  { key: 'rides', label: 'Rides', rows: rideRows },
  { key: 'vehicles', label: 'Vehicles', rows: vehicleRows },
  { key: 'stands', label: 'Food and shops', rows: standRows },
  { key: 'tickets', label: 'Tickets', rows: ticketRows },
  { key: 'staff', label: 'Staff', rows: staffRows },
]

function matches(row, query) {
  return !query || row.search.toLowerCase().includes(query.trim().toLowerCase())
}

function Lists({ state, ui }) {
  const tab = TABS.find((candidate) => candidate.key === ui.tab) ?? TABS[0]
  const rows = tab.rows(state).filter((row) => matches(row, ui.search))
  return (
    <section className="card lists" aria-label="Operations lists">
      <div className="tabs" role="tablist">
        {TABS.map((candidate) => (
          <button key={candidate.key} role="tab" aria-selected={candidate.key === tab.key} className={candidate.key === tab.key ? 'tab active' : 'tab'} onClick={() => setUi({ tab: candidate.key })}>
            {candidate.label}
            <span>{candidate.rows(state).length}</span>
          </button>
        ))}
      </div>
      <div className="rows">
        {rows.length === 0 && <p className="empty muted">{ui.search ? `Nothing matches “${ui.search}”.` : 'Nothing here right now.'}</p>}
        {rows.map((row) => (
          <button key={row.id} data-id={row.id} className={row.selectedId && row.selectedId === ui.selectedId ? 'row selected' : 'row'} onClick={row.open}>
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
        ))}
      </div>
    </section>
  )
}

function CameraButtons({ state }) {
  const buttons = [
    { icon: 'plus', label: 'Zoom in', action: () => zoomBy(0.7) },
    { icon: 'minus', label: 'Zoom out', action: () => zoomBy(1.4) },
    { icon: 'rotateLeft', label: 'Rotate left', action: () => rotateBy(-Math.PI / 6) },
    { icon: 'rotateRight', label: 'Rotate right', action: () => rotateBy(Math.PI / 6) },
    { icon: 'home', label: 'Whole land', action: () => viewSite(state.site.id) },
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
      <Timeline state={state} ui={ui} />
      <Lists state={state} ui={ui} />
    </div>
  )
}
