import { createSimulation } from '../src/sim/simulation.js'
const sim = createSimulation()
for (const checkpoint of [60, 200, 400, 700, 1000]) {
  sim.runFor(checkpoint - sim.time)
  console.log('t', Math.round(sim.time), sim.clockText(), 'agents', sim.agents.length)
  console.log(sim.trains.filter(t => t.lineId === 'H').map(t => `${t.id}:${t.state}@${t.s.toFixed(0)}d${t.dir}v${t.speed.toFixed(1)}${t.holdReason ? '!' : ''}`).join(' '))
  console.log(sim.kpis('harbour'), sim.timelineSteps.map(s => s.id + ':' + s.status[0]).join(' '))
  console.log('incidents', sim.incidents.map(i => i.id + ' ' + i.title + ' ' + (i.resolvedAt ? 'res' : 'open')).join('; '))
}
console.log(sim.depot.trains.map(t => `${t.id}:${t.stage}@${t.centreX.toFixed(0)}`).join(' '))
