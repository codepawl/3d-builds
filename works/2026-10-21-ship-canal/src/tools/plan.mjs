// Prints the schedule facts the film is planned from: when the hero ship stops in chamber 2 and when its fill starts.
import { createSimulation } from '../src/sim/simulation.js'
const simulation = createSimulation()
const lane = simulation.flights.flight.lanes.A
const hero = lane.ships[0]
console.log('hero segments', hero.segments.map((s) => `${s.kind}@${s.chamber} ${s.t0.toFixed(1)}-${s.t1.toFixed(1)}`).join(' | '))
const moveToSecond = hero.segments.find((s) => s.kind === 'move' && s.chamber === 0 && !s.entering)
const fillSecond = hero.segments.find((s) => s.kind === 'fill' && s.chamber === 1)
console.log('move c1 ends', moveToSecond.t1, 'fill c2 starts', fillSecond.t0, 'ends', fillSecond.t1)
console.log('film start sim time (move ends at 5.6 s) =', (moveToSecond.t1 - 5.6).toFixed(2))
const laneB = simulation.flights.flight.lanes.B
console.log('B ship 0', laneB.ships[0].segments.map((s) => `${s.kind}@${s.chamber} ${(s.t0 - laneB.offset).toFixed(1)}-${(s.t1 - laneB.offset).toFixed(1)}`).join(' | '))
const lake = simulation.flights.lake.lanes
console.log('lake A', lake.A.ships[0].segments.map((s) => `${s.kind} ${(s.t0 - lake.A.offset).toFixed(1)}-${(s.t1 - lake.A.offset).toFixed(1)}`).join(' | '))
console.log('lake B', lake.B.ships[0].segments.map((s) => `${s.kind} ${(s.t0 - lake.B.offset).toFixed(1)}-${(s.t1 - lake.B.offset).toFixed(1)}`).join(' | '))
