// Turns simulation objects into what the dashboard shows: statuses with icons, card fields and list rows.
import { COMPOUNDS, CREW_ROLES, RACE_LAPS, TEAMS } from '../data.js'
import { formatLap, strategyFor } from '../sim.js'

export const STATUS = {
  racing: { label: 'Racing', icon: 'play', tone: 'green' },
  boxing: { label: 'Box this lap', icon: 'down', tone: 'amber' },
  pitlane: { label: 'Pit lane', icon: 'arrow', tone: 'blue' },
  stopped: { label: 'Stationary', icon: 'stop', tone: 'violet' },
  exit: { label: 'Pit exit', icon: 'up', tone: 'blue' },
  yellow: { label: 'Yellow flag', icon: 'warning', tone: 'amber' },
  standby: { label: 'Standby', icon: 'hourglass', tone: 'grey' },
  running: { label: 'Moving', icon: 'walk', tone: 'blue' },
  ready: { label: 'In position', icon: 'check', tone: 'green' },
  working: { label: 'Working', icon: 'wrench', tone: 'violet' },
  alert: { label: 'Showing yellow', icon: 'warning', tone: 'amber' },
  clear: { label: 'Track clear', icon: 'check', tone: 'green' },
  parked: { label: 'Parked', icon: 'pause', tone: 'grey' },
  lit_red: { label: 'Red, hold', icon: 'stop', tone: 'red' },
  lit_green: { label: 'Green, go', icon: 'play', tone: 'green' },
  dark: { label: 'Lights off', icon: 'circle', tone: 'grey' },
  armed: { label: 'Armed', icon: 'diamond', tone: 'amber' },
}

export function carStatus(state, car) {
  if (car.mode === 'pit') {
    if (car.pitLeg === 'stop') return STATUS.stopped
    if (car.pitLeg === 'exit') return STATUS.exit
    return STATUS.pitlane
  }
  if (car.boxCalled) return STATUS.boxing
  if (state.yellow && ((car.s - state.yellow.from + state.track.length) % state.track.length) < state.yellow.span) return STATUS.yellow
  return STATUS.racing
}

export const personStatus = (person) => STATUS[person.status] ?? STATUS.standby

export const kmh = (metresPerSecond) => `${Math.round(metresPerSecond * 3.6)} km/h`
export const gapText = (car) => (car.racePosition === 1 ? 'Leader' : `+${car.gap.toFixed(3)}`)
export const percent = (value) => `${Math.round(value)}%`

export function compoundOf(name) {
  return { name, ...COMPOUNDS[name] }
}

// The card for any selected entity: title, subtitle, status, fields and one progress bar.
export function cardFor(state, entity) {
  const { type, item } = entity
  if (type === 'car') {
    const car = item
    const strategy = strategyFor(state, car)
    const stop = car.currentStop
    const inStop = car.mode === 'pit' && car.pitLeg === 'stop'
    return {
      icon: 'car',
      title: `#${car.number} ${car.driver}`,
      subtitle: TEAMS[car.team].name,
      teamColor: TEAMS[car.team].color,
      status: carStatus(state, car),
      fields: [
        ['Position', `P${car.racePosition}`],
        ['Gap to leader', gapText(car)],
        ['Speed', kmh(car.speed)],
        ['Last lap', formatLap(car.lastLap)],
        ['Tyre', { compound: car.compound, text: `${COMPOUNDS[car.compound].label}, ${car.tyreAge} laps` }],
        ['Energy', percent(car.energy)],
        ['Damage', car.damage ? `${car.damage}% front wing` : 'None'],
        ['Stops', String(car.stops)],
        ['Planned stop', `Lap ${strategy.plannedStopLap}`],
        ['Undercut window', `Laps ${strategy.undercutOpen}-${strategy.undercutClose}`],
      ],
      progress: inStop
        ? { label: `Stop ${car.stopClock.toFixed(2)} s`, value: car.stopClock / car.stopLength, tone: 'violet' }
        : stop
          ? { label: `Pit stop: ${stop.phase === 'call' ? 'box called' : stop.phase}`, value: stop.phase === 'call' ? 0.15 : stop.phase === 'entry' ? 0.45 : 0.9, tone: 'blue' }
          : { label: `Tyre life ${percent(strategy.lifeLeft)}`, value: strategy.lifeLeft / 100, tone: strategy.lifeLeft < 30 ? 'red' : 'green' },
    }
  }
  if (type === 'person') {
    const person = item
    const box = person.boxId && state.boxes.find((candidate) => candidate.id === person.boxId)
    const car = box?.carId && state.cars.find((candidate) => candidate.id === box.carId)
    return {
      icon: 'person',
      title: person.name,
      subtitle: `${CREW_ROLES[person.role]}${person.team ? `, ${TEAMS[person.team].short}` : ', race control'}`,
      teamColor: person.team ? TEAMS[person.team].color : '#ff8a1f',
      status: personStatus(person),
      fields: [
        ['Task', person.task || 'Standby'],
        ['Role', person.slot?.wheel ? `${CREW_ROLES[person.role]}, ${person.slot.wheel.toUpperCase()} wheel` : CREW_ROLES[person.role]],
        ['Car', car ? `#${car.number} ${car.driver}` : 'None'],
        ['Carrying', person.carry ? `${COMPOUNDS[person.carry].label} tyre` : person.tool === 'gun' ? 'Wheel gun' : 'Nothing'],
      ],
      progress: { label: person.move ? 'On the way' : 'Task', value: person.progress ?? 0, tone: 'blue' },
    }
  }
  if (type === 'spare') {
    const prep = (state.time / 120 + 0.42) % 1
    return {
      icon: 'car',
      title: item.label,
      subtitle: 'Halvard Racing garage, bay 2',
      teamColor: TEAMS.halvard.color,
      status: STATUS.working,
      fields: [['Work', 'Floor and brake ducts'], ['Mechanics', '4 on the car'], ['On stands', 'Front and rear'], ['Fuel', 'Drained']],
      progress: { label: `Prep ${percent(prep * 100)}`, value: prep, tone: 'violet' },
    }
  }
  const team = item.team ? TEAMS[item.team] : null
  const base = { title: item.label, subtitle: team ? team.name : 'Circuit', teamColor: team?.color ?? '#5b6b85' }
  const box = item.boxId && state.boxes.find((candidate) => candidate.id === item.boxId)
  if (type === 'garage') {
    const crew = state.people.filter((person) => person.team === item.team && person.kind === 'crew' && person.boxId)
    const cars = state.cars.filter((car) => car.team === item.team)
    return {
      ...base,
      icon: 'garage',
      status: team ? STATUS.working : STATUS.parked,
      fields: team
        ? [['Cars', cars.map((car) => `#${car.number} P${car.racePosition}`).join(', ')], ['Stop crew', `${crew.length} people`], ['Crew out', `${crew.filter((person) => person.status !== 'standby').length}`], ['Doors', 'Open']]
        : [['Use', 'Spare box'], ['Doors', 'Open']],
      progress: { label: 'Race distance', value: state.raceLap / RACE_LAPS, tone: 'blue' },
    }
  }
  if (type === 'stand') {
    const cars = state.cars.filter((car) => car.team === item.team)
    return {
      ...base,
      icon: 'stand',
      status: STATUS.working,
      fields: [
        ...cars.map((car) => [`#${car.number} plan`, `Stop lap ${car.nextStopLap}, ${COMPOUNDS[car.pitTyre].label}`]),
        ['Track temp', `${state.weather.trackTemp.toFixed(1)} °C`],
        ['Rain chance', `${state.weather.rain}%`],
      ],
      progress: { label: `Lap ${state.raceLap} of ${RACE_LAPS}`, value: state.raceLap / RACE_LAPS, tone: 'blue' },
    }
  }
  if (type === 'gantry') {
    const lit = box.gantry === 'red' ? STATUS.lit_red : box.gantry === 'green' ? STATUS.lit_green : box.phase === 'ready' ? STATUS.armed : STATUS.dark
    return { ...base, icon: 'lights', status: lit, fields: [['Box', box.phase], ['Last stop', lastStopText(state, item.team)]], progress: { label: 'Stop', value: box.phase === 'stop' ? box.stopTime / 2.6 : 0, tone: 'violet' } }
  }
  if (type === 'jack') {
    const lifted = box.phase === 'stop' && box.stopTime > 0.3 && box.stopTime < 2.1
    return { ...base, icon: 'jack', status: lifted ? STATUS.working : STATUS.standby, fields: [['State', lifted ? 'Car up' : 'Down'], ['Saddle', item.end === 'front' ? 'Nose' : 'Crash structure']], progress: { label: 'Lift', value: lifted ? 1 : 0, tone: 'violet' } }
  }
  if (type === 'rack') {
    const temperature = 70 + ((state.time * 0.4 + item.x) % 10)
    return { ...base, icon: 'tyre', status: STATUS.ready, compound: item.compound, fields: [['Compound', { compound: item.compound, text: COMPOUNDS[item.compound].label }], ['Sets', String(item.sets)], ['Blanket temp', `${temperature.toFixed(1)} °C`]], progress: { label: 'Blanket to 80 °C', value: Math.min(1, temperature / 80), tone: 'amber' } }
  }
  if (type === 'post') {
    const yellow = item.flag === 'yellow'
    return { ...base, icon: 'flag', status: yellow ? STATUS.alert : STATUS.clear, fields: [['Turn', String(item.turn)], ['Panel', yellow ? 'Yellow, flashing' : 'Green'], ['Marshals', '1 on post']], progress: { label: yellow ? 'Incident' : 'Sector clear', value: yellow ? Math.max(0, (state.yellow.until - state.time) / 12) : 1, tone: yellow ? 'amber' : 'green' } }
  }
  if (type === 'truck') return { ...base, icon: 'truck', status: STATUS.parked, fields: [['Length', '16.5 m'], ['Power', 'Paddock hook-up'], ['Use', item.label.includes('parts') ? 'Spares and tyres' : 'Garage kit']], progress: { label: 'Spares stocked', value: 0.72, tone: 'green' } }
  if (type === 'hospitality') {
    const guests = Math.round(140 + Math.sin(state.time / 20) * 30)
    return { ...base, icon: 'building', status: STATUS.working, fields: [['Guests', String(guests)], ['Floors', '2']], progress: { label: 'Capacity', value: guests / 220, tone: 'blue' } }
  }
  if (type === 'grandstand') {
    const fill = 0.86 + Math.sin(state.time / 30 + item.x) * 0.05
    return { ...base, icon: 'seats', status: STATUS.ready, fields: [['Capacity', item.capacity.toLocaleString('en-US')], ['Occupied', Math.round(item.capacity * fill).toLocaleString('en-US')]], progress: { label: 'Occupancy', value: fill, tone: 'green' } }
  }
  if (type === 'roadcar') return { ...base, icon: 'car', status: STATUS.standby, fields: [['Position', 'Pit exit'], ['Crew', item.node === 'safety_car' ? 'Driver and co-driver' : 'Doctor and driver'], ['Engine', 'Warm']], progress: { label: 'Ready to deploy', value: 1, tone: 'green' } }
  return { ...base, icon: 'circle', status: STATUS.standby, fields: [], progress: null }
}

function lastStopText(state, team) {
  const stop = state.stops.find((candidate) => candidate.team === team && candidate.duration)
  return stop ? `${stop.duration.toFixed(2)} s, lap ${stop.lap}` : 'None yet'
}

export function averageStop(state, team) {
  const stops = state.stops.filter((stop) => stop.team === team && stop.duration)
  if (!stops.length) return 2.48
  return stops.reduce((sum, stop) => sum + stop.duration, 0) / stops.length
}

export const MESSAGE_ICONS = { flag: 'flag', info: 'thermometer', box: 'radio', stop: 'stopwatch', yellow: 'warning', clear: 'check', fast: 'trophy' }
