import { createSimulation } from '../src/sim/simulation.js'

const APP_PREROLL = 150
// 1. When does the first Harbour door fault open?
const probe = createSimulation()
probe.runFor(APP_PREROLL)
let faultStart = null
let faultTrain = null
while (probe.time < 900 && faultStart === null) {
  probe.runFor(0.1)
  const incident = probe.incidents.find((candidate) => candidate.severity === 'fault' && candidate.trainId?.startsWith('H-'))
  if (incident) {
    faultStart = incident.startedAt
    faultTrain = incident.trainId
  }
}
const filmStart = Math.round(faultStart - 8)
console.log('fault', faultTrain, 'opens at', faultStart.toFixed(1), 'film starts at sim time', filmStart)

// 2. Which train is about to stop 1.8-2.8 s after the click at film time 5.8 s, inside the opening view?
const clickAt = 5.8
for (let offset = -4; offset <= 6; offset += 1) {
  const start = filmStart + offset
  const sim = createSimulation()
  sim.runFor(start + clickAt)
  const before = sim.trains.filter((train) => train.lineId === 'H' && !train.ghost && train.state === 'run' && train.speed > 1.2 && train.id !== faultTrain)
  const snapshot = new Map(before.map((train) => [train.id, { x: train.s - 690, speed: train.speed }]))
  const arrivals = new Map()
  for (let step = 0; step < 80; step += 1) {
    sim.runFor(0.1)
    sim.trains.forEach((train) => {
      if (snapshot.has(train.id) && !arrivals.has(train.id) && (train.state === 'dwell' || train.state === 'fault')) arrivals.set(train.id, (step + 1) * 0.1)
    })
  }
  const good = [...arrivals.entries()].filter(([id, time]) => time >= 1.6 && time <= 3.4 && Math.abs(snapshot.get(id).x + 30) < 280)
  if (good.length > 0) {
    console.log('offset', offset, 'candidates', good.map(([id, time]) => `${id}@${time.toFixed(1)}s x=${snapshot.get(id).x.toFixed(0)}`).join(' '))
    console.log(JSON.stringify({ filmStart: start, trainId: good[0][0], clickAt, faultTrain, faultOpensAt: faultStart - start }))
    break
  }
}
