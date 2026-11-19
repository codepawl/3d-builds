import { createSim, stepSim, STEP_SECONDS } from '../src/sim.js'
const sim = createSim(7)
for (let step = 0; step < 600 / STEP_SECONDS; step++) stepSim(sim)
for (const forklift of sim.forklifts) {
  const next = forklift.steps[0]
  console.log(forklift.id, forklift.x.toFixed(1), forklift.z.toFixed(1), 'h', forklift.heading.toFixed(2), 'v', forklift.speed.toFixed(2), forklift.stateLabel, '|', next?.type, next?.path?.reverse ? 'rev' : '', 'progress', forklift.progress.toFixed(1), '/', next?.path?.length?.toFixed(1), 'block', forklift.laneBlock, 'lane', JSON.stringify(forklift.lanePosition))
}
