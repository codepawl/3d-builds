// Everything drawn over the 3D view. Reads the sim on each dashboard refresh (useUi().version).
import { useEffect, useRef, useState } from 'react'
import { COMPANY, SITES, TRIAGE } from '../data.js'
import { byId } from '../sim/er.js'
import { camera, findEntity, flyTo, getUi, rotateBy, setUi, switchSite, useUi, viewSite, world, zoomBy } from '../store.js'
import { bedStatus, heliStatus, patientStatus, personStatus, roomStatus, vehicleStatus } from '../status.js'
import { Icon, ProductMark, StatusChip } from './Icon.jsx'
import { focusPatient, formatClock, formatMinutes, formatTime, minutesInDepartment, pendingTests, siteKpis, visitTime, visitTimeline, wallClock } from './ops.js'

function selectAndFly(id) {
  setUi({ selectedId: id })
  const entity = findEntity(id)
  if (entity) flyTo(entity, id)
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

const triageColor = (patient) => TRIAGE[patient.level].color

// ---------- top bar ----------

function siteSummary(site) {
  const state = world.sites[site.id]
  const free = state.beds.filter((bed) => bed.state === 'free').length
  return `${state.beds.length} bays · ${free} free${site.helipad ? ' · helipad' : ''}`
}

function SiteSwitcher({ state }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="site-switcher">
      <button className="site-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="site-badge">{state.site.id}</span>
        <span className="site-text">
          <strong>{state.site.name}</strong>
          <small>{state.site.area} · {siteSummary(state.site)}</small>
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
              <span className="site-badge">{site.id}</span>
              <span className="site-text">
                <strong>{site.name}</strong>
                <small>{site.area} · {siteSummary(site)}</small>
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
      if (event.key === 'Escape') {
        setUi({ selectedId: null })
        camera.followId = null
      }
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
        placeholder="Search patients, bays, ambulances, staff"
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

function alertCount(state) {
  return state.patients.filter((patient) => !patient.gone && patient.level <= 2 && patient.needs === 'doctor').length + [...state.vehicles, ...state.helis].filter((unit) => unit.phase === 'arriving' || unit.phase === 'approach').length
}

function TopBar({ state, ui }) {
  const alerts = alertCount(state)
  return (
    <header className="top-bar">
      <div className="brand">
        <ProductMark />
        <span>Bayflow</span>
      </div>
      <SearchBox value={ui.search} />
      <div className="top-right">
        <SiteSwitcher state={state} />
        <span className="clock" title="Hospital local time">
          <span className="live-dot" />
          {formatClock(wallClock(state))}
          <small>Live</small>
        </span>
        <button className="icon-button" aria-label={`${alerts} alerts`} title={`${alerts} alerts: inbound units and urgent patients waiting`} onClick={() => setUi({ tab: 'arrivals' })}>
          <Icon name="bell" />
          {alerts > 0 && <span className="badge-count">{alerts}</span>}
        </button>
        <div className="user">
          <span className="avatar">{COMPANY.user.initials}</span>
          <span className="user-text">
            <strong>{COMPANY.user.name}</strong>
            <small>{COMPANY.user.role}</small>
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
  const kpis = siteKpis(state)
  const doctorChange = kpis.doorToDoctor - kpis.baseline.doorToDoctor
  const lwbsChange = kpis.lwbs - kpis.baseline.lwbs
  return (
    <section className="kpis">
      <KpiCard icon="stethoscope" label="Door to doctor" value={Math.round(kpis.doorToDoctor)} unit="min" note="Median, last 20 patients" trend={{ tone: doctorChange <= 0 ? 'good' : 'bad', text: signed(doctorChange) }} />
      <KpiCard icon="users" label="Patients waiting" value={kpis.waiting} note={`${kpis.waitingTriage} for triage · ${kpis.waitingBed} for a bed${kpis.offload ? ` · ${kpis.offload} on a cot` : ''}`} />
      <KpiCard icon="bed" label="Beds free" value={kpis.freeBeds} unit={`of ${kpis.totalBeds}`} note={`${kpis.freeResus} resus free · ${kpis.cleaning} being cleaned`} />
      <KpiCard icon="door" label="Left without being seen" value={kpis.lwbs.toFixed(1)} unit="%" note={`${kpis.lwbsCount} today`} trend={{ tone: lwbsChange <= 0 ? 'good' : 'bad', text: signed(lwbsChange, 2) }} />
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
      {status && (
        <div className="detail-status">
          <StatusChip status={status} />
        </div>
      )}
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

const ARRIVAL_MODE = { 'walk-in': 'On foot', ambulance: 'Ambulance', air: 'Helicopter' }

function nextStep(patient) {
  const pending = pendingTests(patient)
  switch (patient.needs) {
    case 'triage':
      return 'Triage'
    case 'bed':
      return 'Next free cubicle'
    case 'doctor':
      return 'Doctor assessment'
    case 'tests':
      return pending.join(', ') || 'Results'
    case 'decision':
      return 'Admit or discharge'
    case 'admit':
    case 'to-ward':
      return 'Ward bed'
    default:
      return 'Handover'
  }
}

function PatientDetail({ state, item: patient }) {
  const triage = TRIAGE[patient.level]
  const bed = patient.bedId && byId(state.beds, patient.bedId)
  const doctor = patient.doctorId && byId(state.people, patient.doctorId)
  const minutes = minutesInDepartment(state, patient)
  const target = 240
  return (
    <>
      <DetailHead icon="bed" color={triage.color} title={patient.id} subtitle={`${triage.label} · ${patient.complaint} · ${patient.age} y`} status={patientStatus(patient)} />
      <Progress label="Time in department" value={minutes / target} display={`${formatMinutes(minutes)} of 4 h`} tone={minutes > 180 ? 'warn' : 'brand'} />
      <div className="fields">
        <Field label="Arrived">{`${ARRIVAL_MODE[patient.mode]}, ${formatTime(visitTime(state, patient.stageAt[0]))}`}</Field>
        <Field label="Bay">{bed ? bed.name : 'Not yet'}</Field>
        <Field label="Pending tests">{pendingTests(patient).join(', ') || 'None'}</Field>
        <Field label="Next step">{nextStep(patient)}</Field>
        <Field label="Doctor">{doctor ? doctor.name : patient.stageAt[2] !== null ? 'Seen' : 'Waiting'}</Field>
        <Field label="Triage target">{triage.targetMinutes ? `${triage.targetMinutes} min` : 'Immediate'}</Field>
      </div>
    </>
  )
}

function BedDetail({ state, item: bed }) {
  const patient = bed.patientId && byId(state.patients, bed.patientId)
  const minutes = patient ? minutesInDepartment(state, patient) : 0
  return (
    <>
      <DetailHead icon="bed" title={bed.name} subtitle={`${bed.kind === 'resus' ? 'Resuscitation bay' : 'Cubicle'} · ${state.site.short}`} status={bedStatus(bed)} />
      <Progress label={patient ? 'Occupied for' : 'Turnaround'} value={patient ? minutes / 240 : bed.state === 'cleaning' ? 0.5 : 1} display={patient ? formatMinutes(minutes) : bed.state === 'cleaning' ? 'Cleaning' : 'Ready'} />
      <div className="fields">
        <Field label="Patient">{patient ? patient.id : 'None'}</Field>
        <Field label="Triage">{patient ? TRIAGE[patient.level].short : 'None'}</Field>
        <Field label="Stage">{patient ? patientStatus(patient).label : 'Free'}</Field>
        <Field label="Reserved">{bed.reservedFor ?? 'No'}</Field>
      </div>
    </>
  )
}

const VEHICLE_STEPS = ['arriving', 'reversing', 'parked', 'handover', 'closing', 'departing']

function VehicleDetail({ state, item: vehicle }) {
  const patient = vehicle.patientId && byId(state.patients, vehicle.patientId)
  const crew = vehicle.crew.map((id) => byId(state.people, id)?.name).filter(Boolean)
  const bed = patient && state.beds.find((candidate) => candidate.reservedFor === patient.id || candidate.patientId === patient.id)
  const step = Math.max(0, VEHICLE_STEPS.indexOf(vehicle.phase))
  return (
    <>
      <DetailHead icon="ambulance" color={patient ? triageColor(patient) : undefined} title={vehicle.name} subtitle={vehicle.model === 'amb_van' ? 'Type II ambulance' : 'Type III ambulance'} status={vehicleStatus(vehicle)} />
      <Progress label="Arrival to handover" value={(step + 1) / 4} display={step >= 3 ? 'Handing over' : `Step ${step + 1} of 4`} tone="ok" />
      <div className="fields">
        <Field label="Patient">{patient ? `${patient.id} · ${TRIAGE[patient.level].short}` : 'Handed over'}</Field>
        <Field label="Going to">{bed ? bed.name : patient ? 'Corridor, awaiting bay' : 'None'}</Field>
        <Field label="Speed">{Math.round(vehicle.speed * 3.6)} km/h</Field>
        <Field label="ETA">{vehicle.phase === 'arriving' ? `${vehicle.eta} s` : 'On site'}</Field>
        <Field label="Crew">{crew.join(', ')}</Field>
        <Field label="Trips today">{vehicle.tripsToday}</Field>
      </div>
    </>
  )
}

function HeliDetail({ state, item: heli }) {
  const patient = heli.patientId && byId(state.patients, heli.patientId)
  return (
    <>
      <DetailHead icon="heli" color={patient ? triageColor(patient) : undefined} title={heli.name} subtitle="Air ambulance · light twin" status={heliStatus(heli)} />
      <Progress label="Rotor" value={heli.rotor} display={`${Math.round(heli.rotor * 100)}%`} tone="ok" />
      <div className="fields">
        <Field label="Patient">{patient ? `${patient.id} · ${TRIAGE[patient.level].short}` : 'Handed over'}</Field>
        <Field label="Height">{Math.max(0, heli.position.y).toFixed(1)} m</Field>
        <Field label="ETA">{heli.phase === 'approach' || heli.phase === 'landing' ? `${heli.eta} s` : 'On pad'}</Field>
        <Field label="Trips today">{heli.tripsToday}</Field>
      </div>
    </>
  )
}

function PersonDetail({ state, item: person }) {
  const minutes = (8 * 60 * ((person.id.charCodeAt(person.id.length - 1) % 7) + 2)) / 10 + state.clock / 60
  return (
    <>
      <DetailHead icon={person.role === 'Visitor' ? 'users' : 'stethoscope'} title={person.name} subtitle={`${person.role} · ${person.task}`} status={personStatus(person)} />
      <Progress label="Shift" value={minutes / 600} display={`${formatMinutes(minutes)} of 10 h`} />
      <div className="fields">
        <Field label="Role">{person.role}</Field>
        <Field label="Now">{person.task}</Field>
      </div>
    </>
  )
}

function RoomDetail({ state, item: room }) {
  const patient = room.patientId && byId(state.patients, room.patientId)
  const queue = room.kind === 'lab' ? state.labQueue.length : state.patients.filter((candidate) => !candidate.gone && candidate.tests.some((test) => test.name === (room.kind === 'ct' ? 'CT' : 'X-ray') && test.state === 'pending')).length
  return (
    <>
      <DetailHead icon={room.kind === 'lab' ? 'flask' : 'scan'} title={room.name} subtitle={room.kind === 'ct' ? 'CT scanner, 64 slice' : room.kind === 'xray' ? 'Digital X-ray room' : 'Chemistry and haematology'} status={roomStatus(room)} />
      <Progress label={room.kind === 'lab' ? 'Analyser load' : 'Scan'} value={room.kind === 'lab' ? Math.min(1, state.labQueue.length / 6) : room.table} display={room.kind === 'lab' ? `${state.labQueue.length} samples` : undefined} tone="ok" />
      <div className="fields">
        <Field label="Patient">{patient ? patient.id : 'None'}</Field>
        <Field label="Queue">{queue}</Field>
        <Field label="Today">{room.kind === 'lab' ? `${180 + state.counters.seen * 3} samples` : `${room.scansToday} scans`}</Field>
      </div>
    </>
  )
}

const DETAILS = { patient: PatientDetail, bed: BedDetail, vehicle: VehicleDetail, heli: HeliDetail, person: PersonDetail, room: RoomDetail }

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

// ---------- visit timeline ----------

function Timeline({ state, ui }) {
  const patient = focusPatient(state, ui.selectedId, ui.focusPatientId)
  if (!patient) return null
  const stages = visitTimeline(state, patient)
  const triage = TRIAGE[patient.level]
  return (
    <section className="card timeline" aria-label="Patient visit">
      <div className="timeline-main">
        <div className="timeline-title">
          <Icon name="clipboard" size={18} />
          <h3>Visit {patient.id}</h3>
          <span className="muted">
            {ARRIVAL_MODE[patient.mode]} · {patient.complaint} · {formatMinutes(minutesInDepartment(state, patient))} in department
          </span>
        </div>
        <ol className="stages">
          {stages.map((stage, index) => (
            <li key={stage.key} className={`stage stage-${stage.status}`}>
              {index > 0 && (
                <span className="stage-rail">
                  <span style={{ width: stage.status === 'upcoming' ? '0%' : '100%' }} />
                </span>
              )}
              <span className="stage-dot">
                {stage.status === 'done' && <Icon name="check" size={14} strokeWidth={2.6} />}
                {stage.status === 'current' && <span className="stage-core" />}
              </span>
              <strong>{stage.label}</strong>
              <small>{stage.status === 'upcoming' ? `Est. ${stage.time}` : stage.time}</small>
            </li>
          ))}
        </ol>
      </div>
      <div className="flight-summary">
        <span className="detail-tile" style={{ background: triage.color, color: '#fff' }}>
          <Icon name="bed" size={20} />
        </span>
        <span>
          <strong>{triage.label}</strong>
          <small>{patient.bedId ? byId(state.beds, patient.bedId)?.name : 'No bay yet'}</small>
          <StatusChip status={patientStatus(patient)} />
        </span>
      </div>
    </section>
  )
}

// ---------- lists ----------

function entityRow(id, fields) {
  return { id, selectedId: id, open: () => selectAndFly(id), ...fields }
}

const NEED_RANK = { handover: 0, doctor: 1, 'in-triage': 2, triage: 2, bed: 3, 'to-bed': 3, tests: 4, decision: 5, admit: 6, 'to-ward': 7 }

function patientRows(state) {
  return state.patients
    .filter((patient) => !patient.gone && patient.needs !== 'leaving' && patient.needs !== 'left')
    .sort((a, b) => (NEED_RANK[a.needs] ?? 9) - (NEED_RANK[b.needs] ?? 9) || a.level - b.level)
    .map((patient) => {
      const minutes = minutesInDepartment(state, patient)
      const bed = patient.bedId && byId(state.beds, patient.bedId)
      return {
        id: patient.id,
        selectedId: patient.id,
        open: () => {
          setUi({ focusPatientId: patient.id })
          selectAndFly(patient.id)
        },
        lead: <Tile icon={patient.mode === 'walk-in' ? 'walk' : patient.mode === 'air' ? 'heli' : 'ambulance'} color={triageColor(patient)} />,
        title: `${patient.id} · ${TRIAGE[patient.level].short}`,
        subtitle: `${patient.complaint} · ${bed ? bed.name : patient.carrier?.type === 'trolley' ? 'on a cot' : patient.carrier?.type === 'vehicle' || patient.carrier?.type === 'heli' ? 'inbound' : 'waiting room'}`,
        status: patientStatus(patient),
        value: formatMinutes(minutes),
        meter: Math.min(1, minutes / 240),
        meterTone: minutes > 180 ? 'warn' : 'brand',
        search: `${patient.id} ${patient.complaint} ${TRIAGE[patient.level].label} ${patientStatus(patient).label} ${bed?.name ?? ''} ${pendingTests(patient).join(' ')}`,
      }
    })
}

function bedRows(state) {
  return state.beds.map((bed) => {
    const patient = bed.patientId && byId(state.patients, bed.patientId)
    return entityRow(bed.id, {
      lead: <Tile icon="bed" color={patient ? triageColor(patient) : undefined} />,
      title: bed.name,
      subtitle: patient ? `${patient.id} · ${patientStatus(patient).label}` : bed.kind === 'resus' ? 'Resuscitation' : 'Cubicle',
      status: bedStatus(bed),
      value: patient ? formatMinutes(minutesInDepartment(state, patient)) : '',
      meter: patient ? Math.min(1, minutesInDepartment(state, patient) / 240) : null,
      search: `${bed.name} ${bed.kind} ${bedStatus(bed).label} ${patient?.id ?? ''}`,
    })
  })
}

function arrivalRows(state) {
  const units = [...state.vehicles, ...state.helis].filter((unit) => unit.phase !== 'away')
  const rows = units.map((unit) => {
    const patient = unit.patientId && byId(state.patients, unit.patientId)
    const isHeli = unit.rotor !== undefined
    return entityRow(unit.id, {
      lead: <Tile icon={isHeli ? 'heli' : 'ambulance'} color={patient ? triageColor(patient) : undefined} />,
      title: unit.name,
      subtitle: patient ? `${patient.id} · ${TRIAGE[patient.level].label}` : 'Crew returning',
      status: isHeli ? heliStatus(unit) : vehicleStatus(unit),
      value: unit.phase === 'arriving' || unit.phase === 'approach' ? `${unit.eta} s` : 'On site',
      meter: null,
      search: `${unit.name} ambulance helicopter ${patient?.id ?? ''}`,
    })
  })
  const nextAmbulance = state.schedule.ambulance[0]
  if (nextAmbulance !== undefined && rows.length < 2) {
    rows.push({ id: 'next-ambulance', selectedId: null, open: () => {}, lead: <Tile icon="ambulance" />, title: 'Next ambulance', subtitle: 'Pre-alert from dispatch', status: { icon: 'hourglass', label: 'Expected', tone: 'muted' }, value: `${Math.max(0, Math.round(nextAmbulance - state.clock))} s`, meter: null, search: 'next ambulance pre-alert' })
  }
  return rows
}

function imagingRows(state) {
  const rooms = state.rooms.map((room) =>
    entityRow(room.id, {
      lead: <Tile icon={room.kind === 'lab' ? 'flask' : 'scan'} />,
      title: room.name,
      subtitle: room.patientId ? `With ${room.patientId}` : room.reservedBy ? `${room.reservedBy} on the way` : room.kind === 'lab' ? `${state.labQueue.length} samples running` : 'No patient',
      status: roomStatus(room),
      value: room.kind === 'lab' ? '' : `${room.scansToday} today`,
      meter: room.kind === 'lab' ? null : room.table,
      search: `${room.name} imaging scan`,
    }),
  )
  const queued = state.patients
    .filter((patient) => !patient.gone && patient.tests.some((test) => (test.name === 'CT' || test.name === 'X-ray') && test.state !== 'done'))
    .map((patient) => {
      const test = patient.tests.find((candidate) => (candidate.name === 'CT' || candidate.name === 'X-ray') && candidate.state !== 'done')
      return {
        id: `${patient.id}-scan`,
        selectedId: patient.id,
        open: () => {
          setUi({ focusPatientId: patient.id })
          selectAndFly(patient.id)
        },
        lead: <Tile icon="bed" color={triageColor(patient)} />,
        title: `${patient.id} · ${test.name}`,
        subtitle: patient.bedId ? byId(state.beds, patient.bedId)?.name : 'Waiting room',
        status: test.state === 'pending' ? { icon: 'queue', label: 'Queued', tone: 'warn' } : test.state === 'transfer' ? { icon: 'play', label: 'Porter moving', tone: 'ok' } : { icon: 'scan', label: 'Scanning', tone: 'ok' },
        value: '',
        meter: null,
        search: `${patient.id} ${test.name} imaging queue`,
      }
    })
  return [...rooms, ...queued]
}

function staffRows(state) {
  return state.people
    .filter((person) => !person.hidden && !person.removed && person.role !== 'Patient' && person.role !== 'Visitor')
    .map((person) =>
      entityRow(person.id, {
        lead: <Tile icon={person.role === 'Porter' ? 'bed' : 'stethoscope'} />,
        title: person.name,
        subtitle: `${person.role} · ${person.task}`,
        status: personStatus(person),
        value: '',
        meter: null,
        search: `${person.name} ${person.role} ${person.task}`,
      }),
    )
}

const TABS = [
  { key: 'patients', label: 'Patients', rows: patientRows },
  { key: 'beds', label: 'Bays', rows: bedRows },
  { key: 'arrivals', label: 'Arrivals', rows: arrivalRows },
  { key: 'imaging', label: 'Imaging', rows: imagingRows },
  { key: 'staff', label: 'Staff', rows: staffRows },
]

function matches(row, query) {
  return !query || row.search.toLowerCase().includes(query.trim().toLowerCase())
}

// The list re-renders five times a second; drawing only the top rows keeps that cheap.
const MAX_ROWS = 24

function Lists({ state, ui }) {
  const tab = TABS.find((candidate) => candidate.key === ui.tab) ?? TABS[0]
  const matching = tab.rows(state).filter((row) => matches(row, ui.search))
  const rows = matching.slice(0, MAX_ROWS)
  return (
    <section className="card lists" aria-label="Department lists">
      <div className="tabs" role="tablist">
        {TABS.map((candidate) => (
          <button key={candidate.key} role="tab" aria-selected={candidate.key === tab.key} className={candidate.key === tab.key ? 'tab active' : 'tab'} onClick={() => setUi({ tab: candidate.key })}>
            {candidate.label}
            <span>{candidate.rows(state).filter((row) => row.selectedId !== null).length}</span>
          </button>
        ))}
      </div>
      <div className="rows">
        {rows.length === 0 && <p className="empty muted">{ui.search ? `Nothing matches “${ui.search}”.` : 'Nothing here right now.'}</p>}
        {rows.map((row) => (
          <button key={row.id} data-id={row.id} className={(row.selectedId && row.selectedId === ui.selectedId) || row.id === ui.focusPatientId ? 'row selected' : 'row'} onClick={row.open}>
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
      <Timeline state={state} ui={ui} />
      <Lists state={state} ui={ui} />
    </div>
  )
}
