import { createSimulation } from '../src/sim/simulation.js'

// Lists Harbour state changes around dwell at H2/H4 with door openness, to re-plan the film start.
const simulation = createSimulation()
simulation.runFor(150)
const previous = new Map()
while (simulation.time < 560) {
  simulation.runFor(0.1)
  simulation.trains.filter((train) => train.lineId === 'H' && !train.ghost).forEach((train) => {
    const before = previous.get(train.id)
    const stateChanged = before && before.state !== train.state
    const doorsMoved = before && (before.door < 0.05) !== (train.doorOpen < 0.05)
    if (stateChanged || doorsMoved) {
      console.log(simulation.time.toFixed(1), train.id, before.state, '->', train.state, 'at', train.atStationId, 'dir', train.dir, 'speed', train.speed.toFixed(2), 'door', train.doorOpen.toFixed(2))
    }
    previous.set(train.id, { state: train.state, door: train.doorOpen })
  })
}
