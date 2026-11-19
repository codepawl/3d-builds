// Lists every time two forklifts come closer than a real body allows, with where and what each was doing.
import { createSim, stepSim, STEP_SECONDS } from '../src/sim.js'
const sim = createSim(7)
const seen = new Map()
const center = (forklift) => [forklift.x + Math.sin(forklift.heading) * 0.6, forklift.z + Math.cos(forklift.heading) * 0.6]
let worst = 99
for (let step = 0; step < 3600 / STEP_SECONDS; step++) {
  stepSim(sim)
  for (let first = 0; first < 6; first++) {
    for (let second = first + 1; second < 6; second++) {
      const a = sim.forklifts[first]
      const b = sim.forklifts[second]
      const ca = center(a)
      const cb = center(b)
      const gap = Math.hypot(ca[0] - cb[0], ca[1] - cb[1])
      worst = Math.min(worst, gap)
      if (gap < 2.2) {
        const key = `${a.id}-${b.id}-${Math.floor(sim.time / 20)}`
        if (!seen.has(key)) {
          seen.set(key, true)
          if (seen.size < 25) console.log(`t=${sim.time.toFixed(0)} gap=${gap.toFixed(2)} ${a.id} (${a.x.toFixed(1)},${a.z.toFixed(1)}) "${a.stateLabel}" | ${b.id} (${b.x.toFixed(1)},${b.z.toFixed(1)}) "${b.stateLabel}"`)
        }
      }
    }
  }
}
console.log('incidents', seen.size, 'worst', worst.toFixed(2), 'shipped', sim.shipped.length, 'queue', sim.pendingOrders.length)
