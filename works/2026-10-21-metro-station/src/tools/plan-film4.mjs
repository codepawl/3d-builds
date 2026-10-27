import { createSimulation } from '../src/sim/simulation.js'

// Prints H-05 and H-06 (train A and B of the film) every 0.5 s around a candidate film start, to check speed and distance to H2.
const filmStart = Number(process.argv[2] || 292)
const simulation = createSimulation()
simulation.runFor(filmStart - 0.0001)
for (let second = 0; second <= 12; second += 0.5) {
  const target = filmStart + second
  while (simulation.time < target - 0.001) simulation.runFor(0.1)
  const row = ['H-05', 'H-06'].map((id) => {
    const train = simulation.trains.find((candidate) => candidate.id === id)
    return `${id} ${train.state} s=${(train.s - 690).toFixed(0)} v=${train.speed.toFixed(1)} door=${train.doorOpen.toFixed(2)}`
  })
  console.log(`t=${second.toFixed(1)}`, row.join(' | '))
}
