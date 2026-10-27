// App state shared by the 3D view and the dashboard. The sim world is mutable and read every frame by the
// scene; the dashboard re-renders on `version`, bumped five times a second.
import { useSyncExternalStore } from 'react'
import { SITE_BY_ID } from './sites.js'
import { CATCH_TAU, HOLD, PHASES, STAGES, clock, createWorld, flightTelemetry, missionSeconds, phaseOf, stepWorld } from './sim.js'

export const world = createWorld()

const listeners = new Set()
let uiState = { siteId: 'lc1', selectedId: null, followId: null, tab: 'vehicles', search: '', version: 0 }

export function getUi() {
  return uiState
}

export function setUi(patch) {
  if (patch.siteId && patch.siteId !== uiState.siteId) world.particles.age.fill(1e6)
  uiState = { ...uiState, ...patch }
  world.currentSite = uiState.siteId
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUi() {
  return useSyncExternalStore(subscribe, getUi)
}

// Camera commands are queued here and consumed by the camera rig inside the canvas.
export const cameraCommands = []
export function commandCamera(command) {
  cameraCommands.push(command)
}

export const history = { propellant: [], wind: [], selected: [], selectedId: null }
const HISTORY_LENGTH = 90
const REFRESH_SECONDS = 0.2
let sinceRefresh = 0

export function advanceWorld(dt) {
  stepWorld(world, dt)
  sinceRefresh += dt
  if (sinceRefresh >= REFRESH_SECONDS) {
    sinceRefresh = 0
    sampleHistory()
    setUi({ version: uiState.version + 1 })
  }
}

function pushSample(list, value) {
  list.push(value)
  if (list.length > HISTORY_LENGTH) list.shift()
}

function sampleHistory() {
  pushSample(history.propellant, propellantFraction())
  pushSample(history.wind, world.range?.wind ?? 0)
  if (history.selectedId !== uiState.selectedId) {
    history.selectedId = uiState.selectedId
    history.selected = []
  }
  const entity = findEntity(uiState.selectedId)
  if (entity) pushSample(history.selected, describe(entity).metric?.value ?? 0)
}

export function currentSite() {
  return world.sites[uiState.siteId]
}

export function findEntity(id) {
  if (!id) return null
  return currentSite().byId[id] ?? null
}

export function selectEntity(id, { fly = false } = {}) {
  const entity = findEntity(id)
  setUi({ selectedId: id, followId: entity && isMoving(entity) ? id : null })
  if (entity && fly) commandCamera({ type: 'fly', id })
  else if (entity && isMoving(entity)) commandCamera({ type: 'follow', id })
}

export function clearSelection() {
  if (uiState.selectedId) setUi({ selectedId: null, followId: null })
}

export function switchSite(siteId) {
  setUi({ siteId, selectedId: null, followId: null, search: '' })
  commandCamera({ type: 'overview', instant: false })
}

export function isMoving(entity) {
  return Boolean(entity.path || entity.kind === 'booster' || entity.kind === 'ship' || entity.kind === 'spmt' || entity.kind === 'crane')
}

// Where the camera looks for an entity, and how far back it stands.
export function entityFocus(entity) {
  const position = entity.position
  const table = {
    booster: [36, 240], ship: [26, 170], tower: [72, 330], mount: [14, 170], tank: [14, 110], boat: [6, 170], spmt: [8, 130],
    tanker: [2, 115], van: [2, 95], pickup: [2, 90], crane: [48, 270], camera: [10, 100], weather: [15, 120], checkpoint: [3, 110], bay: [40, 260], stand: [20, 170],
  }
  let [height, distance] = table[entity.kind] ?? [5, 120]
  if (entity.kind === 'booster' && world.tau < 8 && world.tau > -84) height = world.tau > 0 ? 36 : 62
  if (entity.kind === 'booster' && world.tau < 8 && world.tau > -84) distance = world.tau > 0 ? 400 : 310
  if (entity.kind === 'spmt' && entity.carries) height = 34
  if (entity.kind === 'spmt' && entity.carries) distance = 240
  if (entity.kind === 'tank' && entity.model === 'tank_sphere') height = 12
  return { x: position.x, y: position.y + height, z: position.z, distance }
}

// ---------- read models ----------
const percent = (value) => `${(value * 100).toFixed(1)} %`

export function propellantFraction() {
  const lc1 = world.sites.lc1.byId
  return (lc1['b-14'].load * 3400 + lc1['ship-lc1'].load * 1500) / 4900
}

function boosterState(tau) {
  if (tau < -84) return { kind: 'idle', text: 'On mount, awaiting ship' }
  if (tau < -20) return { kind: 'active', text: 'Stacked, fuelling' }
  if (tau < 0) return { kind: 'go', text: 'Terminal count' }
  if (tau < 8) return { kind: 'active', text: 'Ascent' }
  if (tau < 17) return { kind: 'active', text: 'Boostback' }
  if (tau < CATCH_TAU) return { kind: 'warn', text: 'Landing burn' }
  return { kind: 'done', text: 'Caught, safing' }
}

function shipState(tau) {
  if (tau >= 30 || tau < -110) return { kind: 'active', text: tau >= 30 ? 'At staging stand' : 'Rolling out' }
  if (tau < -85) return { kind: 'active', text: 'Lifting onto booster' }
  if (tau < -20) return { kind: 'active', text: 'Stacked, fuelling' }
  if (tau < 0) return { kind: 'go', text: 'Terminal count' }
  if (tau < 16) return { kind: 'active', text: tau < 8 ? 'Ascent, stacked' : 'Ship burn to orbit' }
  return { kind: 'done', text: 'Flown, out of range' }
}

function moverState(entity) {
  if (entity.kind === 'boat') return entity.speed > 0 ? { kind: 'active', text: entity.id === 'bt-tern' ? 'On station, holding pattern' : 'Patrolling hazard line' } : { kind: 'idle', text: 'Drifting' }
  if (entity.pause > 0) return { kind: 'hold', text: entity.kind === 'tanker' ? 'Transferring at farm' : 'Stopped' }
  return { kind: 'active', text: entity.kind === 'spmt' ? 'Rolling' : 'Driving' }
}

export function statusOf(entity) {
  const tau = world.tau
  if (entity.kind === 'booster') return boosterState(tau)
  if (entity.kind === 'ship' && entity.siteId === 'lc1') return shipState(tau)
  if (entity.kind === 'ship') return entity.firing ? { kind: 'warn', text: 'Static fire' } : { kind: entity.load > 0.05 ? 'active' : 'idle', text: entity.load > 0.05 ? 'Fuelled on stand' : 'Safed on stand' }
  if (entity.kind === 'spmt' && entity.id === 'sp-41') return entity.speed > 0.2 ? { kind: 'active', text: 'Rolling' } : { kind: 'idle', text: 'Parked' }
  if (entity.kind === 'crane') return entity.speed > 0 ? { kind: 'active', text: entity.id === 'cr-90' ? 'Test lift, module 6' : 'Slewing' } : { kind: 'hold', text: 'Load held' }
  if (entity.kind === 'tank') return entity.loading ? { kind: 'active', text: 'Transferring to vehicle' } : entity.level < 0.9 ? { kind: 'idle', text: 'Refilling' } : { kind: 'go', text: 'Full, conditioning' }
  if (entity.kind === 'weather') return (world.range?.wind ?? 0) > 80 ? { kind: 'nogo', text: 'Winds aloft over limit' } : { kind: 'go', text: 'Within limits' }
  if (entity.kind === 'checkpoint') return world.range?.road ? { kind: 'go', text: 'Road closed, manned' } : { kind: 'idle', text: 'Road open' }
  if (entity.kind === 'tower' && entity.siteId === 'lc1') return { kind: 'active', text: phaseOf(tau).label }
  if (entity.kind === 'tower') return { kind: 'active', text: 'Module 6 in test lift' }
  if (entity.path || entity.kind === 'boat') return moverState(entity)
  return { kind: 'idle', text: 'Nominal' }
}

const kmh = (metresPerSecond, scale = 1) => `${(metresPerSecond * 3.6 * scale).toFixed(1)} km/h`

export function describe(entity) {
  const tau = world.tau
  const status = statusOf(entity)
  const base = { title: entity.name, status }
  if (entity.kind === 'booster' || (entity.kind === 'ship' && entity.siteId === 'lc1')) {
    const isBooster = entity.kind === 'booster'
    const telemetry = flightTelemetry(world, isBooster ? 'booster' : 'ship')
    const flying = tau >= 0 && tau < (isBooster ? CATCH_TAU : 16)
    const engines = isBooster ? (tau >= 0 && tau < 8 ? '33 of 33' : tau >= 10 && tau < 13 ? '13 of 33' : tau >= 17.4 && tau < CATCH_TAU ? '3 of 33' : '0 of 33') : tau >= 8 && tau < 16 ? '6 of 6' : '0 of 6'
    return {
      ...base,
      subtitle: isBooster ? `Kestrel booster · flight ${entity.flights + (tau >= 0 && tau < CATCH_TAU ? 1 : 0)}` : `Heron ship · ${entity.model.replace('ship_', '')}`,
      fields: [
        ['Mission clock', clock(missionSeconds(tau))],
        ['Altitude', `${telemetry.altitude.toFixed(1)} km`],
        ['Velocity', `${telemetry.speed.toFixed(2)} km/s`],
        ['Propellant', percent(entity.load)],
        ['Engines lit', engines],
        [isBooster ? 'Catch arms' : 'Stack', isBooster ? (world.pad.armRight > 0.3 ? 'Open' : 'Closed') : tau < 0 && tau > -84 ? 'On B-14' : '—'],
      ],
      progress: flying
        ? { label: isBooster ? 'Flight to tower catch' : 'Ascent to orbit insertion', value: Math.min(1, tau / (isBooster ? CATCH_TAU : 16)) }
        : { label: 'Propellant loaded', value: entity.load },
      metric: { label: flying ? 'Altitude, km' : 'Propellant, %', value: flying ? telemetry.altitude : entity.load * 100 },
    }
  }
  if (entity.kind === 'ship') {
    return {
      ...base,
      subtitle: 'Heron ship · tanker test article',
      fields: [
        ['Test', 'Static fire, 6 engines'],
        ['Next fire', entity.firing ? 'Firing now' : `${Math.ceil(((8 - entity.cycle) % 45 + 45) % 45)} s`],
        ['Propellant', percent(entity.load)],
        ['Swing arm', entity.armRetract > 0.5 ? 'Retracted' : 'Connected'],
        ['Chamber pressure', entity.firing ? `${(298 + Math.sin(world.time * 9) * 3).toFixed(0)} bar` : '0 bar'],
      ],
      progress: { label: 'Test cycle', value: entity.cycle / 45 },
      metric: { label: 'Propellant, %', value: entity.load * 100 },
    }
  }
  if (entity.kind === 'tank') {
    const tonnes = entity.level * entity.capacity
    return {
      ...base,
      subtitle: `${entity.fluid} storage · ${entity.capacity.toLocaleString('en-US')} t`,
      fields: [
        ['Level', percent(entity.level)],
        ['Contents', `${tonnes.toFixed(0)} t`],
        ['Boil-off', `${entity.boiloff.toFixed(2)} %/h`],
        ['Pressure', `${(2.1 + entity.level * 0.6 + Math.sin(world.time * 0.7) * 0.03).toFixed(2)} bar`],
        ['Temperature', entity.fluid === 'CH4' ? '−162 °C' : entity.fluid === 'LOX' ? '−183 °C' : '−196 °C'],
      ],
      progress: { label: 'Fill level', value: entity.level },
      metric: { label: 'Level, %', value: entity.level * 100 },
    }
  }
  if (entity.kind === 'weather') {
    const wind = world.range?.wind ?? 50
    return {
      ...base,
      subtitle: 'Weather tower · balloon every 2 h',
      fields: [
        ['Winds aloft', `${wind.toFixed(0)} kt`, wind > 80],
        ['Limit', '80 kt at 10 km'],
        ['Ground wind', `${(world.range?.groundWind ?? 14).toFixed(1)} kt`],
        ['Ceiling', '2,400 m'],
        ['Lightning', 'None within 18 km'],
      ],
      progress: { label: 'Winds aloft against limit', value: Math.min(1, wind / 80), alert: wind > 80 },
      metric: { label: 'Winds aloft, kt', value: wind },
    }
  }
  if (entity.kind === 'checkpoint') {
    return {
      ...base,
      subtitle: 'Highway 4 · road closure point',
      fields: [
        ['Closure', world.range?.road ? 'Active' : 'Not active'],
        ['Window', 'T−01:10 to T+00:08'],
        ['Officers', '2 on post'],
        ['Barrier', 'Lifts for badged vehicles'],
      ],
      progress: { label: 'Closure elapsed', value: world.range?.road ? Math.min(1, (tau + 90) / 116) : 0 },
      metric: { label: 'Elapsed', value: tau },
    }
  }
  if (entity.kind === 'tower') {
    const isMain = entity.siteId === 'lc1'
    return {
      ...base,
      subtitle: isMain ? 'Catch tower · 147 m' : 'Tower B · 5 of 9 modules',
      fields: isMain
        ? [
            ['Carriage', `${(82 + world.pad.carriageDy).toFixed(1)} m`],
            ['Arms', world.pad.armRight > 0.3 ? 'Open 35°' : world.pad.armRight < -0.1 || world.pad.armLeft > 0.3 ? 'Swung to stand' : 'Closed'],
            ['Ship QD arm', world.pad.qdArm < 0.2 ? 'Connected' : 'Retracted'],
            ['Phase', phaseOf(tau).label],
          ]
        : [
            ['Modules', '5 of 9 standing'],
            ['Next module', 'M6, on cribbing'],
            ['Crane', 'CR-90 test lift'],
          ],
      progress: isMain ? { label: 'Launch cycle', value: (tau + 140) / 180 } : { label: 'Tower build', value: 5 / 9 },
      metric: { label: 'Carriage, m', value: 82 + world.pad.carriageDy },
    }
  }
  if (entity.kind === 'mount') {
    const deluge = tau > -2 && tau < 9
    return {
      ...base,
      subtitle: 'Launch mount · 20 clamps · water deluge',
      fields: [
        ['Deluge', deluge ? 'Flowing 1,300 L/s' : 'Armed'],
        ['Clamps', tau >= 0 && tau < 30 ? 'Released' : 'Closed on B-14'],
        ['Booster QD', world.pad.mountQd > 0.4 ? 'Retracted' : 'Connected'],
        ['Table', '21 m ring, 20 m high'],
      ],
      progress: { label: 'Deluge tank', value: deluge ? Math.max(0.2, 1 - (tau + 2) / 11) : 0.98 },
      metric: { label: 'Deluge', value: deluge ? 1 : 0 },
    }
  }
  if (entity.kind === 'crane') {
    const hook = entity.id === 'cr-90' ? 6 + entity.lift * 34 : 30 + entity.lift * 20
    return {
      ...base,
      subtitle: 'Crawler crane · 110 m lattice boom',
      fields: [
        ['Hook height', `${hook.toFixed(1)} m`],
        ['Load', entity.id === 'cr-90' ? '182 t, tower module' : 'Rigging only'],
        ['Slew', `${((entity.slew ?? 0) * 57.3).toFixed(0)}°`],
        ['Wind at tip', `${(18 + Math.sin(world.time / 3) * 4).toFixed(0)} kt`],
      ],
      progress: { label: entity.id === 'cr-90' ? 'Test lift cycle' : 'Shift plan', value: entity.progress ?? (world.time / 600) % 1 },
      metric: { label: 'Hook, m', value: hook },
    }
  }
  if (entity.kind === 'camera') {
    return { ...base, status: { kind: 'active', text: 'Tracking the vehicle' }, subtitle: 'Pad camera · 20 m mast', fields: [['Mode', 'Auto track'], ['Recording', '4K 120 fps'], ['Storage', '61 % free']], progress: { label: 'Storage used', value: 0.39 }, metric: { label: 'Pan', value: 0 } }
  }
  if (entity.kind === 'bay') {
    const occupant = { 'bay-mega': 'Booster B-16 bay slot', 'bay-high1': 'Ship S-33 stacking', 'bay-high2': 'Ship S-34 rings', 'bay-mid': 'Barrel sections', tent: 'Heat tile install' }[entity.id]
    return { ...base, status: { kind: 'active', text: 'Working, 2 shifts' }, subtitle: 'Build yard hall', fields: [['Work', occupant], ['Crew on shift', '46'], ['Hook loads today', '12']], progress: { label: 'Build progress', value: 0.62 }, metric: { label: 'Crew', value: 46 } }
  }
  if (entity.kind === 'stand') {
    return { ...base, status: { kind: 'active', text: 'Test campaign' }, subtitle: 'Suborbital test stand', fields: [['Article', 'Heron S-29'], ['Fires this week', '4'], ['Flame trench', 'Wet']], progress: { label: 'Campaign', value: 0.4 }, metric: { label: 'Fires', value: 4 } }
  }
  // Moving ground vehicles and boats.
  const isBoat = entity.kind === 'boat'
  const isSpmt = entity.kind === 'spmt'
  const routeProgress = entity.path ? entity.distance / entity.path.total : world.pad.spmtDistance / 524
  const speedText = isBoat ? `${(entity.speed * 1.94).toFixed(1)} kn` : kmh(entity.speed ?? 0, isSpmt ? 0.3 : 1)
  const carrying = entity.id === 'sp-41' ? (world.pad.ship.onSpmt ? world.sites.lc1.byId['ship-lc1'].serial : 'Empty') : entity.carries === 'booster_b' ? 'Booster B-16' : entity.carries === 'ship_cargo' ? 'Ship S-33' : entity.cargo ? `${entity.cargo}, 42 t` : isBoat ? (entity.id === 'bt-tern' ? 'Landing frame, 4 crew' : '3 crew') : '2 crew'
  return {
    ...base,
    subtitle: { tanker: 'Cryogenic road tanker', van: 'Crew van', pickup: 'Pickup', spmt: 'Self-propelled transporter', boat: isBoat && entity.id === 'bt-tern' ? 'Recovery vessel · 62 m' : 'Range patrol boat' }[entity.kind],
    fields: [
      ['Speed', speedText],
      ['Heading', `${(((entity.heading * 180) / Math.PI + 360) % 360).toFixed(0)}°`],
      ['Carrying', carrying],
      ['Position', `${entity.position.x.toFixed(0)} E, ${(-entity.position.z).toFixed(0)} N`],
    ],
    progress: { label: isBoat ? 'Patrol leg' : 'Route', value: Math.min(1, Math.max(0, routeProgress)) },
    metric: { label: 'Speed', value: entity.speed ?? 0 },
  }
}

export function tasksFor(siteId) {
  const tau = world.tau
  const shipSerial = world.sites.lc1.byId['ship-lc1'].serial
  if (siteId === 'lc1') {
    const phaseTask = (phaseId, name, target) => {
      const phase = PHASES.find((item) => item.id === phaseId)
      const progress = Math.min(1, Math.max(0, (tau - phase.start) / (phase.end - phase.start)))
      const kind = tau >= phase.end ? 'done' : tau >= phase.start ? 'active' : 'idle'
      return { id: `task-${phaseId}`, name, target, progress: kind === 'done' ? 1 : progress, status: { kind, text: kind === 'done' ? 'Done' : kind === 'active' ? 'Running' : 'Next' } }
    }
    const tasks = [
      phaseTask('rollout', `Rollout ${shipSerial}`, 'sp-41'),
      phaseTask('stack', `Stack ${shipSerial} on B-14`, 'tower-1'),
      phaseTask('load', 'Propellant load', 'lox-1a'),
      phaseTask('terminal', 'Terminal count', 'b-14'),
      phaseTask('ascent', 'Liftoff and ascent', 'b-14'),
      phaseTask('boostback', 'Booster boostback', 'b-14'),
      phaseTask('catch', 'Tower catch', 'tower-1'),
    ]
    if (tau >= HOLD.start && tau < HOLD.end) tasks[2].status = { kind: 'hold', text: 'Hold, winds' }
    return tasks
  }
  if (siteId === 'lc2') {
    const crane = world.sites.lc2.byId['cr-90']
    return [
      { id: 'task-lift', name: 'Module 6 test lift', target: 'cr-90', progress: crane.progress, status: { kind: 'active', text: 'Running' } },
      { id: 'task-qd', name: 'QD arm install', target: 'tower-2', progress: 0.64, status: { kind: 'hold', text: 'Waiting on parts' } },
      { id: 'task-deluge', name: 'Deluge plate weld', target: 'mount-2', progress: 0.81 + (world.time % 200) / 2000, status: { kind: 'active', text: 'Running' } },
      { id: 'task-sphere', name: 'Sphere B pressure test', target: 'lox-bs', progress: (world.time % 90) / 90, status: { kind: 'active', text: 'Running' } },
    ]
  }
  if (siteId === 'ts3') {
    const ship = world.sites.ts3.byId['ship-ts3']
    return [
      { id: 'task-fire', name: 'Static fire S-29', target: 'ship-ts3', progress: ship.cycle / 45, status: ship.firing ? { kind: 'warn', text: 'Firing' } : { kind: 'active', text: 'Running' } },
      { id: 'task-tank', name: 'LOX 3 tank test', target: 'lox-3', progress: 0.55, status: { kind: 'active', text: 'Running' } },
      { id: 'task-engine', name: 'Engine 4 swap', target: 'stand-3', progress: 0, status: { kind: 'idle', text: 'Next' } },
    ]
  }
  const spmt = world.sites.yard.byId['sp-52']
  return [
    { id: 'task-roll', name: 'Rollout B-16 to LC-1', target: 'sp-52', progress: spmt.distance / spmt.path.total, status: { kind: 'active', text: 'Running' } },
    { id: 'task-tiles', name: 'Heat tiles S-33', target: 'sp-58', progress: 0.724 + (world.time % 300) / 3000, status: { kind: 'active', text: 'Running' } },
    { id: 'task-rings', name: 'Stack ring 4, S-34', target: 'bay-high2', progress: 0.3, status: { kind: 'idle', text: 'Next' } },
    { id: 'task-crane', name: 'Crane CR-77 inspection', target: 'cr-77', progress: 1, status: { kind: 'done', text: 'Done' } },
  ]
}

export function rangeRows(siteId) {
  const range = world.range ?? {}
  const wind = range.wind ?? 50
  const main = siteId === 'lc1'
  const weatherId = { lc1: 'wx-1', lc2: 'wx-2', ts3: 'wx-3', yard: null }[siteId]
  return [
    { id: 'range-road', name: 'Road closure', target: main ? 'gate-1' : null, status: main && range.road ? { kind: 'go', text: 'Closed, go' } : { kind: 'idle', text: 'Open' } },
    { id: 'range-air', name: 'Airspace', target: null, status: main && range.airspace ? { kind: 'go', text: 'Restricted, go' } : { kind: 'idle', text: 'Normal' } },
    { id: 'range-marine', name: 'Marine hazard area', target: main ? 'bt-skua' : null, status: main && range.marineHold ? { kind: 'hold', text: 'Vessel in zone' } : main && range.marine ? { kind: 'go', text: 'Clear, go' } : { kind: 'idle', text: 'Not active' } },
    { id: 'range-wx', name: `Winds aloft ${wind.toFixed(0)} kt`, target: weatherId, status: wind > 80 ? { kind: 'nogo', text: 'No-go' } : { kind: 'go', text: 'Go' } },
  ]
}

export function rangeVerdict() {
  const range = world.range ?? {}
  if (range.wind > 80) return { kind: 'nogo', text: 'NO-GO' }
  if (range.hold || range.marineHold) return { kind: 'hold', text: 'HOLD' }
  return { kind: 'go', text: 'GO' }
}

export function stagesReady() {
  const tau = world.tau
  const ready = STAGES.filter((stage) => {
    if (stage.id === 'b-14') return tau < 0 && tau > -84
    if (stage.id === 'ship-lc1') return tau < 0 && tau > -84
    if (stage.id === 'sp-52') return true
    return false
  }).length
  return { ready, total: STAGES.length }
}

export function siteLabel(siteId) {
  const site = SITE_BY_ID[siteId]
  return `${site.code} ${site.name}`
}
