// Runs the seed ahead and finds the pre-roll where a high rack lift, a busy belt and a trailer loading fall on the planned seconds of the film.
import { createSim, stepSim, STEP_SECONDS } from '../src/sim.js'

const LIFT_AT = 2.5
const BELT_FROM = Number(process.argv[2] ?? 15)
const BELT_TO = Number(process.argv[3] ?? 18.5)
const LOAD_FROM = Number(process.argv[4] ?? 20.5)
const LOAD_TO = Number(process.argv[5] ?? 23.5)
const SEARCH_SECONDS = Number(process.argv[6] ?? 4000)

const sim = createSim(7)
const lifts = []
const beltBusy = []
const loads = []
const liftSeen = new Set()

for (let step = 0; step < SEARCH_SECONDS / STEP_SECONDS; step++) {
  stepSim(sim)
  for (const forklift of sim.forklifts) {
    const next = forklift.steps[0]
    const liftKey = `${forklift.id}-${forklift.moves}`
    if (next?.type === 'lift' && next.to > 3 && forklift.pallet && forklift.lift < 0.3 && !liftSeen.has(liftKey)) {
      liftSeen.add(liftKey)
      lifts.push({ time: sim.time, forklift: forklift.id, label: next.label })
    }
  }
  if (step % 15 === 0) {
    sim.lines.forEach((line, lineIndex) => {
      if (line.conveyorCases.length >= 3 && line.jammedUntil <= sim.time) beltBusy.push({ time: sim.time, line: lineIndex, cases: line.conveyorCases.length })
    })
  }
  if (step % 15 === 0) {
    sim.outbound.forEach((door, doorIndex) => {
      if (door.pallets.length && door.state === 'loading') loads.push({ time: sim.time, door: doorIndex })
    })
  }
}

function lineCoversBelt(start, line) {
  for (let second = BELT_FROM; second < BELT_TO; second += 0.5) {
    const covered = beltBusy.some((sample) => sample.line === line && Math.abs(sample.time - (start + second)) < 0.3)
    if (!covered) return false
  }
  return true
}

function doorCoversLoad(start, door) {
  for (let second = LOAD_FROM; second < LOAD_TO; second += 0.5) {
    const covered = loads.some((sample) => sample.door === door && Math.abs(sample.time - (start + second)) < 0.3)
    if (!covered) return false
  }
  return true
}

const results = []
for (const lift of lifts) {
  const start = lift.time - LIFT_AT
  const belts = [0, 1].filter((line) => lineCoversBelt(start, line))
  const load = [0, 1].find((door) => doorCoversLoad(start, door))
  if (belts.length) results.push({ preroll: Math.floor(start), forklift: lift.forklift, label: lift.label, belts, load: load ?? null })
}
console.log('lifts', lifts.length, 'belt samples', beltBusy.length, 'loads', loads.length)
console.log(results.filter((item) => item.load !== null).slice(0, 8))
console.log(results.filter((item) => item.load === null).length, 'more with a busy belt and no load')
