import { createSimulation } from '../src/sim/simulation.js'
const clickAt = 5.8
for (let start = 341; start <= 341; start += 1) {
  const sim = createSimulation()
  sim.runFor(start + clickAt)
  const before = sim.trains.filter((train) => train.lineId === 'H' && !train.ghost && train.state === 'run' && train.speed > 1.2 && train.id !== 'H-06')
  const snapshot = new Map(before.map((train) => [train.id, { x: train.s - 690, speed: train.speed }]))
  const arrivals = new Map()
  for (let step = 0; step < 80; step += 1) {
    sim.runFor(0.1)
    sim.trains.forEach((train) => {
      if (snapshot.has(train.id) && !arrivals.has(train.id) && (train.state === 'dwell' || train.state === 'fault')) arrivals.set(train.id, (step + 1) * 0.1)
    })
  }
  console.log(start, [...arrivals.entries()].filter(([, time]) => time < 4.5).map(([id, time]) => `${id}@${time.toFixed(1)}s x=${snapshot.get(id).x.toFixed(0)} v=${snapshot.get(id).speed.toFixed(1)}`).join(' | '))
}
