// Everything drawn over the 3D view. Reads the sim on each dashboard refresh (useUi().version).
import { useEffect, useRef, useState } from 'react'
import { COMPANY, SITES, STAGES, TOOL_KINDS } from '../data.js'
import { lotQueueMinutes, RAIL_Y, toolUtilisation } from '../sim.js'
import { findEntity, FLY_DISTANCE, flyTo, getUi, rotateBy, setUi, switchSite, useUi, viewSite, world, zoomBy } from '../store.js'
import { lotStatus, personStatus, ticketStatus, toolStatus, truckStatus, vehicleStatus } from '../status.js'
import { Icon, ProductMark, StatusChip } from './Icon.jsx'
import { focusLot, formatClock, formatCount, formatMinutes, routeTimeline, siteKpis } from './ops.js'

const PRIORITY = {
  hot: { label: 'Hot lot', color: '#ef5a2a' },
  eng: { label: 'Engineering', color: '#7c5cd6' },
  mon: { label: 'Monitor', color: '#13a594' },
  normal: { label: 'Standard', color: '#8a96a8' },
}

function selectAndFly(id) {
  setUi({ selectedId: id })
  const entity = findEntity(id)
  if (entity) flyTo(entity.position, FLY_DISTANCE[entity.type], id)
}

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

const toolOf = (state, id) => state.tools.find((tool) => tool.id === id)
const lotOf = (state, id) => state.lots.find((lot) => lot.id === id)

// ---------- top bar ----------

function siteSummary(site) {
  const state = world.sites[site.id]
  if (site.kind === 'campus') return `${state.trucks.length} trucks on site · 2 fabs`
  const running = state.tools.filter((tool) => tool.state === 'running').length
  return `${running}/${state.tools.length} tools running · ${state.lots.length} lots`
}

function SiteSwitcher({ state }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="site-switcher">
      <button className="site-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="site-badge">{state.site.id}</span>
        <span className="site-text">
          <strong>{state.site.name} · {state.site.area}</strong>
          <small>{siteSummary(state.site)}</small>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="site-menu" role="menu">
          {SITES.map((site) => (
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
                <strong>{site.name} · {site.area}</strong>
                <small>{siteSummary(site)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchBox({ value, state }) {
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
  const placeholder = state.site.kind === 'campus' ? 'Search buildings, trucks, tickets' : 'Search lots, tools, vehicles, people'
  return (
    <label className="search">
      <Icon name="search" size={17} />
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setUi({ search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const current = world.sites[getUi().siteId]
          const first = tabsFor(current).flatMap((tab) => tab.rows(current).map((row) => ({ ...row, tab: tab.key }))).find((row) => matches(row, event.target.value))
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
  const openTickets = Object.values(world.sites).flatMap((site) => site.tickets ?? []).filter((ticket) => ticket.state !== 'closed').length
  return (
    <header className="top-bar">
      <div className="brand">
        <ProductMark />
        <span>Waferline</span>
      </div>
      <SearchBox value={ui.search} state={state} />
      <div className="top-right">
        <SiteSwitcher state={state} />
        <span className="clock" title="Simulated fab time, one minute per second">
          <span className="live-dot" />
          {formatClock(state.clock)}
          <small>×60</small>
        </span>
        <button className="icon-button" aria-label={`${openTickets} open tickets`} title={`${openTickets} open tickets`} onClick={() => setUi({ tab: 'tickets' })}>
          <Icon name="bell" />
          {openTickets > 0 && <span className="badge-count">{openTickets}</span>}
        </button>
        <div className="user">
          <span className="avatar">MO</span>
          <span className="user-text">
            <strong>Morgan Ode</strong>
            <small>Shift lead · {COMPANY.campus}</small>
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

function signed(value, digits = 1) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

function Kpis({ state }) {
  const kpis = siteKpis(state, world)
  const { baseline } = state.site
  const yieldChange = kpis.yield - baseline.yield
  const cycleChange = kpis.cycleDays - baseline.cycleDays
  const availabilityChange = kpis.availability - kpis.baselineAvailability
  return (
    <section className="kpis">
      <KpiCard icon="wafer" label="Wafer starts" value={formatCount(kpis.starts)} unit="/day" note={`${kpis.startsShift} lots started this shift`} />
      <KpiCard icon="yield" label="Line yield" value={kpis.yield.toFixed(1)} unit="%" note="Inline metrology, 7-day" trend={{ tone: yieldChange >= 0 ? 'good' : 'bad', text: signed(yieldChange, 2) }} />
      <KpiCard icon="cycle" label="Cycle time" value={kpis.cycleDays.toFixed(1)} unit="days" note={`${formatCount(kpis.wip)} lots in the line`} trend={{ tone: cycleChange <= 0 ? 'good' : 'bad', text: signed(cycleChange, 2) }} />
      <KpiCard icon="gauge" label="Tool availability" value={kpis.availability.toFixed(1)} unit="%" note={`${formatCount(kpis.moves)} OHT moves today`} trend={{ tone: availabilityChange >= 0 ? 'good' : 'bad', text: signed(availabilityChange) }} />
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

function DetailHead({ icon, color, title, subtitle }) {
  return (
    <div className="detail-head">
      <span className="detail-tile" style={color ? { background: color, color: '#fff' } : undefined}>
        <Icon name={icon} size={24} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
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

function lotWhere(state, lot) {
  const place = lot.place
  if (place.type === 'port') return `${toolOf(state, place.toolId).name} port ${place.portIndex + 1}`
  if (place.type === 'vehicle') return state.vehicles.find((vehicle) => vehicle.id === place.id).name
  if (place.type === 'interbay') return `Interbay to bay ${place.toBay + 1}`
  return state.stockers.find((stocker) => stocker.id === place.id).name
}

function LotDetail({ state, lot }) {
  const priority = PRIORITY[lot.priority]
  const stage = STAGES[lot.stageIndex]
  const tool = lot.toolId && toolOf(state, lot.toolId)
  return (
    <>
      <DetailHead icon="pod" color={priority.color} title={`Lot ${lot.name}`} subtitle={`${lot.product.name} · ${lot.product.node}`} />
      <div className="detail-status">
        <StatusChip status={lotStatus(state, lot)} />
        <span className="muted">{priority.label}</span>
      </div>
      <Progress label={`Route · step ${lot.step} of ${lot.product.steps}`} value={lot.step / lot.product.steps} />
      {lot.state === 'processing' && <Progress label={`${stage.label} on ${tool.name}`} value={lot.progress} tone="ok" />}
      <div className="fields">
        <Field label="Current stage">{stage.label} · layer {lot.layer}</Field>
        <Field label="Location">{lotWhere(state, lot)}</Field>
        <Field label="Tool">{tool ? `${tool.name} · ${tool.model}` : 'Not booked yet'}</Field>
        <Field label="Queue time">{lot.state === 'processing' ? 'In process' : formatMinutes(lotQueueMinutes(state, lot))}</Field>
        <Field label="Wafers">{lot.wafers}</Field>
        <Field label="Inline yield">{lot.inlineYield.toFixed(1)}%</Field>
        <Field label="Due out">{lot.dueDays} days</Field>
      </div>
    </>
  )
}

function ToolDetail({ state, tool }) {
  const kind = TOOL_KINDS[tool.kind]
  const lot = tool.lotId && lotOf(state, tool.lotId)
  const occupied = tool.ports.filter((port) => port.lotId || port.reservedBy).length
  const ticket = tool.ticketId && state.tickets.find((candidate) => candidate.id === tool.ticketId)
  return (
    <>
      <DetailHead icon={kind.icon} title={tool.name} subtitle={`${tool.model} · bay ${tool.bay + 1}`} />
      <div className="detail-status">
        <StatusChip status={toolStatus(tool)} />
        <span className="muted">{kind.label}</span>
      </div>
      {lot ? (
        <Progress label={`Lot ${lot.name} · ${STAGES[lot.stageIndex].label}`} value={tool.progress} tone={tool.state === 'running' ? 'ok' : 'warn'} />
      ) : (
        <Progress label="No lot in process" value={0} display="Idle" />
      )}
      <div className="fields">
        <Field label="Utilisation">{Math.round(toolUtilisation(tool) * 100)}%</Field>
        <Field label="Wafers per hour">{tool.state === 'running' ? tool.wph : 0} / {tool.wph}</Field>
        <Field label="Load ports">{occupied} of {tool.ports.length} in use</Field>
        <Field label="Lots today">{tool.processedToday}</Field>
        <Field label="Alarm">{tool.alarm ? <span className="text-bad">{tool.alarm}</span> : <span className="text-ok">None</span>}</Field>
        {ticket && <Field label="Ticket">{ticket.id} · {ticketStatus(ticket).label}</Field>}
      </div>
    </>
  )
}

function VehicleDetail({ state, vehicle }) {
  const bay = state.bays[vehicle.bay]
  const job = vehicle.job
  const lot = job && lotOf(state, job.lotId)
  const destination = job ? (job.to.type === 'port' ? `${toolOf(state, job.to.toolId).name} port ${job.to.portIndex + 1}` : state.stockers.find((stocker) => stocker.id === job.to.id).name) : 'None'
  const remaining = job ? (((job.phase === 'toPickup' ? job.from.s : job.to.s) - vehicle.s + bay.loop) % bay.loop) : 0
  const toPickup = job && ['toPickup', 'lowerPick', 'raisePick'].includes(job.phase)
  const legDone = 1 - remaining / bay.loop
  const tripProgress = job ? (toPickup ? 0.5 * legDone : 0.5 + 0.5 * legDone) : 0
  return (
    <>
      <DetailHead icon="oht" title={vehicle.name} subtitle={`Overhead hoist vehicle · bay ${vehicle.bay + 1} loop`} />
      <div className="detail-status">
        <StatusChip status={vehicleStatus(state, vehicle)} />
        <span className="muted">{vehicle.variant === 'oht_c' ? 'Service unit' : 'Transport unit'}</span>
      </div>
      <Progress label={job ? `Move · ${remaining.toFixed(1)} m to ${job.phase === 'toPickup' ? 'pickup' : 'drop'}` : 'No move booked'} value={job ? tripProgress : 0} />
      <div className="fields">
        <Field label="Carrying">{vehicle.carrying ? `Lot ${lotOf(state, vehicle.carrying).name}` : lot ? `Booked for ${lot.name}` : 'Empty'}</Field>
        <Field label="Destination">{destination}</Field>
        <Field label="Speed">{vehicle.speed.toFixed(1)} m/s</Field>
        <Field label="Hoist drop">{vehicle.hoist.toFixed(2)} m of {(RAIL_Y - 1.05 - 0.92).toFixed(2)}</Field>
        <Field label="Moves today">{vehicle.tripsToday}</Field>
        <Field label="Distance today">{vehicle.distanceToday.toFixed(2)} km</Field>
      </div>
    </>
  )
}

function PersonDetail({ state, person }) {
  const tool = person.toolId && toolOf(state, person.toolId)
  const role = person.role === 'technician' ? 'Equipment technician' : 'Process engineer'
  return (
    <>
      <DetailHead icon="person" title={person.name} subtitle={`${role} · bay ${person.bay + 1}`} />
      <div className="detail-status">
        <StatusChip status={personStatus(state, person)} />
      </div>
      <Progress label="Shift elapsed" value={Math.min(1, (state.clock + 190) / 720)} />
      <div className="fields">
        <Field label="Task">{person.ticketId ? `Ticket ${person.ticketId}` : tool ? `Check ${tool.name}` : 'None'}</Field>
        <Field label="Tool">{tool ? `${tool.name} · ${tool.model}` : 'None'}</Field>
        <Field label="Walked this shift">{person.walked.toFixed(2)} km</Field>
        <Field label="Gowning">Full suit, hood and mask</Field>
      </div>
    </>
  )
}

function StockerDetail({ state, stocker }) {
  const lots = stocker.lots.map((id) => lotOf(state, id))
  const hot = lots.filter((lot) => lot.priority === 'hot').length
  return (
    <>
      <DetailHead icon="stocker" title={stocker.name} subtitle={`Pod stocker · bay ${stocker.bay + 1}`} />
      <div className="detail-status">
        <StatusChip status={{ icon: 'stack', label: `${lots.length} pods stored`, tone: 'muted' }} />
      </div>
      <Progress label="Shelves in use" value={lots.length / stocker.capacity} display={`${lots.length} / ${stocker.capacity}`} />
      <div className="fields">
        <Field label="Hot lots waiting">{hot}</Field>
        <Field label="Crane moves">{stocker.moves}</Field>
        <Field label="Next out">{lots[0] ? `Lot ${lots[0].name}` : 'None'}</Field>
      </div>
    </>
  )
}

function buildingFields(state, building) {
  const wobble = (scale, speed, offset = 0) => Math.sin(state.clock * speed + offset) * scale
  switch (building.id) {
    case 'B-UPW':
      return { status: { icon: 'check', label: 'Producing', tone: 'ok' }, progress: { label: 'Storage level', value: 0.72 + wobble(0.03, 0.05) }, fields: [['Flow', `${(412 + wobble(9, 0.3)).toFixed(0)} m³/h`], ['Resistivity', '18.2 MΩ·cm'], ['Total organic carbon', `${(0.6 + wobble(0.05, 0.2)).toFixed(2)} ppb`]] }
    case 'B-GAS':
      return { status: { icon: 'check', label: 'Supplying', tone: 'ok' }, progress: { label: 'Nitrogen tank level', value: 0.64 + wobble(0.02, 0.04) }, fields: [['Nitrogen', `${(6900 + wobble(120, 0.2)).toFixed(0)} Nm³/h`], ['Hydrogen', `${(410 + wobble(14, 0.25)).toFixed(0)} Nm³/h`], ['Next delivery', 'Tube trailer 14']] }
    case 'B-CT1':
    case 'B-CT2':
      return { status: { icon: 'loop', label: 'Fans running', tone: 'ok' }, progress: { label: 'Cooling load', value: 0.68 + wobble(0.04, 0.1, building.id.length) }, fields: [['Supply water', `${(18.4 + wobble(0.3, 0.2)).toFixed(1)} °C`], ['Return water', `${(26.1 + wobble(0.4, 0.17)).toFixed(1)} °C`], ['Fans', '3 of 3']] }
    case 'B-SUB':
      return { status: { icon: 'bolt', label: 'Energised', tone: 'ok' }, progress: { label: 'Load', value: 0.61 + wobble(0.03, 0.1) }, fields: [['Campus load', `${(86 + wobble(3, 0.12)).toFixed(1)} MW`], ['Transformers', '3 of 3 online'], ['Power factor', '0.97']] }
    case 'B-PK':
      return { status: { icon: 'play', label: 'Running', tone: 'ok' }, progress: { label: 'Units packaged today', value: 0.48 + (state.clock % 600) / 1500 }, fields: [['Bump and flip-chip', '4 lines'], ['Test yield', '98.6%'], ['Dock', 'Box truck 03 expected']] }
    case 'B-ADM':
      return { status: { icon: 'check', label: 'Control room staffed', tone: 'ok' }, progress: { label: 'Shift elapsed', value: Math.min(1, (state.clock + 190) / 720) }, fields: [['Shift', 'Day B'], ['On site', '1,184 people'], ['Visitors', '6']] }
    default:
      return null
  }
}

function BuildingDetail({ state, building }) {
  if (building.fab) {
    const fab = world.sites[building.fab]
    const running = fab.tools.filter((tool) => tool.state === 'running').length
    const down = fab.tools.filter((tool) => tool.state === 'down').length
    const kpis = siteKpis(fab, world)
    return (
      <>
        <DetailHead icon="building" title={building.name} subtitle={building.role} />
        <div className="detail-status">
          <StatusChip status={down ? { icon: 'warning', label: `${down} tool${down > 1 ? 's' : ''} down`, tone: 'bad' } : { icon: 'play', label: 'Producing', tone: 'ok' }} />
        </div>
        <Progress label="Tools running" value={running / fab.tools.length} display={`${running} / ${fab.tools.length}`} tone="ok" />
        <div className="fields">
          <Field label="Lots in line">{fab.lots.length}</Field>
          <Field label="Line yield">{kpis.yield.toFixed(1)}%</Field>
          <Field label="Cycle time">{kpis.cycleDays.toFixed(1)} days</Field>
          <Field label="Open tickets">{fab.tickets.filter((ticket) => ticket.state !== 'closed').length}</Field>
        </div>
        <button className="detail-action" onClick={() => switchSite(building.fab)}>
          <Icon name="open" size={16} />
          Open the fab floor
        </button>
      </>
    )
  }
  const info = buildingFields(state, building)
  return (
    <>
      <DetailHead icon={building.id === 'B-UPW' ? 'water' : building.id === 'B-SUB' ? 'bolt' : 'building'} title={building.name} subtitle={building.role} />
      <div className="detail-status">
        <StatusChip status={info.status} />
      </div>
      <Progress label={info.progress.label} value={info.progress.value} />
      <div className="fields">
        {info.fields.map(([label, value]) => (
          <Field key={label} label={label}>{value}</Field>
        ))}
      </div>
    </>
  )
}

function TruckDetail({ state, truck }) {
  const stopNames = { gas: 'Gas yard', dock: 'Packaging dock', substation: 'Substation' }
  return (
    <>
      <DetailHead icon="truck" title={truck.name} subtitle={truck.role} />
      <div className="detail-status">
        <StatusChip status={truckStatus(state, truck)} />
      </div>
      <Progress label="Ring road lap" value={truck.s / state.road.length} />
      <div className="fields">
        <Field label="Cargo">{truck.cargo}</Field>
        <Field label="Next stop">{stopNames[truck.stop]}</Field>
        <Field label="Speed">{Math.round(truck.speed * 3.6)} km/h</Field>
        <Field label="Stops today">{truck.trips}</Field>
      </div>
    </>
  )
}

const DETAILS = { lot: LotDetail, tool: ToolDetail, vehicle: VehicleDetail, person: PersonDetail, stocker: StockerDetail, building: BuildingDetail, truck: TruckDetail }
const PROP = { lot: 'lot', tool: 'tool', vehicle: 'vehicle', person: 'person', stocker: 'stocker', building: 'building', truck: 'truck' }

function DetailCard({ state, selectedId }) {
  const entity = findEntity(selectedId)
  if (!entity) return null
  const Detail = DETAILS[entity.type]
  return (
    <aside className="card detail" aria-label="Selection details">
      <button className="locate" onClick={() => flyTo(entity.position, FLY_DISTANCE[entity.type], selectedId)} aria-label="Fly to and follow" title="Fly to and follow">
        <Icon name="locate" size={17} />
      </button>
      <Detail state={state} {...{ [PROP[entity.type]]: entity.item }} />
    </aside>
  )
}

// ---------- route timeline ----------

function Timeline({ state, selectedId }) {
  const lot = focusLot(state, selectedId)
  if (!lot) return null
  const stages = routeTimeline(state, lot)
  const priority = PRIORITY[lot.priority]
  return (
    <section className="card timeline" aria-label="Lot route">
      <div className="timeline-main">
        <div className="timeline-title">
          <Icon name="wafer" size={18} />
          <h3>Route, layer {lot.layer}</h3>
          <span className="muted">Lot {lot.name} · step {lot.step} of {lot.product.steps}</span>
        </div>
        <ol className="stages">
          {stages.map((stage, index) => (
            <li key={stage.key} className={`stage stage-${stage.status}`}>
              {index > 0 && (
                <span className="stage-rail">
                  <span style={{ width: stage.status === 'upcoming' ? '0%' : '100%' }} />
                </span>
              )}
              <span className="stage-dot" style={{ '--progress': `${stage.progress * 360}deg` }}>
                {stage.status === 'done' && <Icon name="check" size={14} strokeWidth={2.6} />}
                {stage.status === 'current' && <span className="stage-core" />}
              </span>
              <strong>{stage.label}</strong>
              <small>{stage.status === 'upcoming' ? `ETA ${stage.time}` : stage.time}</small>
            </li>
          ))}
        </ol>
      </div>
      <button className="flight-summary" onClick={() => selectAndFly(lot.id)}>
        <span className="detail-tile" style={{ background: priority.color, color: '#fff' }}>
          <Icon name="pod" size={20} />
        </span>
        <span>
          <strong>{lot.product.name}</strong>
          <small>{priority.label} · {lot.wafers} wafers</small>
          <StatusChip status={lotStatus(state, lot)} />
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </section>
  )
}

// ---------- lists ----------

const PRIORITY_RANK = { hot: 0, eng: 1, mon: 2, normal: 3 }

function lotRows(state) {
  return [...state.lots]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.step / b.product.steps - a.step / a.product.steps)
    .map((lot) => ({
      id: lot.id,
      lead: <Tile icon="pod" color={PRIORITY[lot.priority].color} />,
      title: lot.name,
      subtitle: `${lot.product.code} · ${STAGES[lot.stageIndex].label} · ${lotWhere(state, lot)}`,
      status: lotStatus(state, lot),
      value: `${lot.step}/${lot.product.steps}`,
      meter: lot.step / lot.product.steps,
      search: `${lot.name} ${lot.product.name} ${PRIORITY[lot.priority].label} ${STAGES[lot.stageIndex].label}`,
    }))
}

function toolRows(state) {
  const rank = { down: 0, maintenance: 1, running: 2, idle: 3 }
  return [...state.tools]
    .sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name))
    .map((tool) => ({
      id: tool.id,
      lead: <Tile icon={TOOL_KINDS[tool.kind].icon} />,
      title: tool.name,
      subtitle: `${tool.model} · bay ${tool.bay + 1}`,
      status: toolStatus(tool),
      value: `${Math.round(toolUtilisation(tool) * 100)}%`,
      meter: toolUtilisation(tool),
      meterTone: tool.state === 'down' ? 'bad' : tool.state === 'maintenance' ? 'warn' : 'ok',
      search: `${tool.name} ${tool.model} ${TOOL_KINDS[tool.kind].label} ${tool.state}`,
    }))
}

function vehicleRows(state) {
  return state.vehicles.map((vehicle) => ({
    id: vehicle.id,
    lead: <Tile icon="oht" />,
    title: vehicle.name,
    subtitle: vehicle.carrying ? `Lot ${lotOf(state, vehicle.carrying).name} · bay ${vehicle.bay + 1}` : `Empty · bay ${vehicle.bay + 1}`,
    status: vehicleStatus(state, vehicle),
    value: `${vehicle.speed.toFixed(1)} m/s`,
    meter: vehicle.speed / 4.5,
    search: `${vehicle.name} oht vehicle`,
  }))
}

function peopleRows(state) {
  return state.people.map((person) => ({
    id: person.id,
    lead: <Tile icon="person" />,
    title: person.name,
    subtitle: `${person.role === 'technician' ? 'Technician' : 'Engineer'} · bay ${person.bay + 1}`,
    status: personStatus(state, person),
    value: '',
    meter: null,
    search: `${person.name} ${person.role}`,
  }))
}

function ticketRows(state) {
  const sites = state.site.kind === 'campus' ? Object.values(world.sites).filter((site) => site.site.kind === 'fab') : [state]
  return sites.flatMap((site) =>
    site.tickets.map((ticket) => {
      const tool = toolOf(site, ticket.toolId)
      const age = Math.round((ticket.closedAt ?? site.clock) - ticket.opened)
      return {
        id: `${site.site.id}:${ticket.id}`,
        target: site === state ? tool.id : null,
        lead: <Tile icon="ticket" />,
        title: `${ticket.id} · ${tool.name}`,
        subtitle: `${ticket.title}${site === state ? '' : ` · ${site.site.name}`}`,
        status: ticketStatus(ticket),
        value: formatMinutes(age),
        meter: null,
        search: `${ticket.id} ${tool.name} ${ticket.title}`,
      }
    }),
  )
}

function buildingRows(state) {
  return state.buildings.map((building) => ({
    id: building.id,
    lead: <Tile icon={building.id === 'B-UPW' ? 'water' : building.id === 'B-SUB' ? 'bolt' : 'building'} />,
    title: building.name,
    subtitle: building.role,
    status: building.fab ? { icon: 'play', label: 'Producing', tone: 'ok' } : buildingFields(state, building).status,
    value: '',
    meter: null,
    search: `${building.name} ${building.role}`,
  }))
}

function truckRows(state) {
  return state.trucks.map((truck) => ({
    id: truck.id,
    lead: <Tile icon="truck" />,
    title: truck.name,
    subtitle: truck.role,
    status: truckStatus(state, truck),
    value: `${Math.round(truck.speed * 3.6)} km/h`,
    meter: truck.speed / 9,
    search: `${truck.name} ${truck.role} ${truck.cargo}`,
  }))
}

const FAB_TABS = [
  { key: 'lots', label: 'Lots', rows: lotRows },
  { key: 'tools', label: 'Tools', rows: toolRows },
  { key: 'transport', label: 'Transport', rows: vehicleRows },
  { key: 'people', label: 'People', rows: peopleRows },
  { key: 'tickets', label: 'Tickets', rows: ticketRows },
]

const CAMPUS_TABS = [
  { key: 'buildings', label: 'Buildings', rows: buildingRows },
  { key: 'trucks', label: 'Trucks', rows: truckRows },
  { key: 'tickets', label: 'Tickets', rows: ticketRows },
]

function tabsFor(state) {
  return state.site.kind === 'campus' ? CAMPUS_TABS : FAB_TABS
}

function matches(row, query) {
  return !query || row.search.toLowerCase().includes(query.trim().toLowerCase())
}

// The list re-renders five times a second; drawing only the top rows keeps that cheap.
const MAX_ROWS = 24

function Lists({ state, ui }) {
  const tabs = tabsFor(state)
  const tab = tabs.find((candidate) => candidate.key === ui.tab) ?? tabs[0]
  const matching = tab.rows(state).filter((row) => matches(row, ui.search))
  const rows = matching.slice(0, MAX_ROWS)
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
            <span>{candidate.rows(state).length}</span>
          </button>
        ))}
      </div>
      <div className="rows">
        {rows.length === 0 && <p className="empty muted">{ui.search ? `Nothing matches “${ui.search}”.` : 'Nothing here right now.'}</p>}
        {rows.map((row) => {
          const target = row.target === undefined ? row.id : row.target
          return (
            <button key={row.id} data-id={row.id} className={target && target === ui.selectedId ? 'row selected' : 'row'} onClick={() => target && selectAndFly(target)} disabled={!target}>
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
        {matching.length > MAX_ROWS && <p className="empty muted">{matching.length - MAX_ROWS} more, search to narrow the list</p>}
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
    { icon: 'home', label: 'Whole site', action: () => viewSite(state) },
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

