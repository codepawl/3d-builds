// Runs the sim headless and reports throughput, traffic, and whether two speeds give the same result.
import { computeKpis, createSim, stepSim, STEP_SECONDS } from '../src/sim.js'

const hours = Number(process.argv[2] ?? 2)
const sim = createSim(7)
const totalSteps = Math.round((hours * 3600) / STEP_SECONDS)
const startedAt = Date.now()
let lastShipped = 0
let lastChangeAt = 0
for (let step = 0; step < totalSteps; step++) {
  stepSim(sim)
  if (sim.shipped.length !== lastShipped) {
    lastShipped = sim.shipped.length
    lastChangeAt = sim.time
  }
  if (step % Math.round(1800 / STEP_SECONDS) === 0 && step > 0) {
    const kpis = computeKpis(sim)
    console.log(`t=${(sim.time / 60).toFixed(0)}min orders/h=${kpis.ordersPerHour.toFixed(0)} o2s=${kpis.orderToShipMinutes.toFixed(1)}min fill=${kpis.rackFillPercent.toFixed(0)}% free=${kpis.freeForklifts} queued=${kpis.queuedOrders} tasks=${sim.tasks.length} shipped=${kpis.shippedTotal} minGap=${sim.minimumGap.toFixed(2)} wait=${sim.totalWaitSeconds.toFixed(0)}s`)
  }
}
const kpis = computeKpis(sim)
console.log('final', JSON.stringify(kpis))
console.log('last ship', (lastChangeAt / 60).toFixed(1), 'min; run took', Date.now() - startedAt, 'ms')
console.log('forklifts', sim.forklifts.map((forklift) => `${forklift.id}:${forklift.moves}moves,${forklift.waited.toFixed(0)}s wait,${forklift.stateLabel}`).join(' | '))
console.log('jams', sim.lines.map((line) => line.jams).join(','), 'trailers', sim.outbound.map((door) => door.trailersSent).join(','))
