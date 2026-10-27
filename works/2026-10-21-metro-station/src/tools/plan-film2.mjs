import { createSimulation } from '../src/sim/simulation.js'

// Finds a film start where, at one Harbour station, a train A arrives 1.2-3.2 s in (opening) and a train B on the
// other road is moving at the click (5.6 s) and arrives at 7.0-8.0 s (2-3 s into the 5-12 s follow beat).
const sim = createSimulation()
sim.runFor(150)
const log = []
const END = 560
while (sim.time < END) {
  sim.runFor(0.1)
  log.push({ time: sim.time, trains: sim.trains.filter((t) => t.lineId === 'H' && !t.ghost).map((t) => ({ id: t.id, s: t.s, dir: t.dir, speed: t.speed, state: t.state, at: t.atStationId })) })
}
const arrivals = []
for (let i = 1; i < log.length; i += 1) {
  log[i].trains.forEach((t) => {
    const prev = log[i - 1].trains.find((p) => p.id === t.id)
    if (prev && prev.state !== 'dwell' && t.state === 'dwell' && t.at) arrivals.push({ id: t.id, at: t.at, time: log[i].time, dir: t.dir })
  })
}
const at = (time) => log.find((entry) => entry.time >= time - 0.05)
const stationX = { H2: -220, H4: 220 }
const results = []
arrivals.forEach((a) => {
  if (!stationX[a.at]) return
  arrivals.forEach((b) => {
    if (b.at !== a.at || b.id === a.id || b.dir === a.dir) return
    for (let start = Math.ceil((a.time - 3.2) * 2) / 2; start <= a.time - 1.2; start += 0.5) {
      if (Math.abs(b.time - (start + 7.5)) > 0.8) continue
      const clickEntry = at(start + 5.1)
      const bAtClick = clickEntry.trains.find((t) => t.id === b.id)
      const aAtZero = at(start).trains.find((t) => t.id === a.id)
      const bx = (bAtClick.s - 690) - stationX[a.at]
      if (bAtClick.speed < 4 || Math.abs(bx) > 160) continue
      if (aAtZero.speed < 1.5) continue
      const faulty = log.some((entry) => entry.time > start && entry.time < start + 12 && entry.trains.some((t) => t.state === 'fault' && Math.abs(t.s - 690 - stationX[a.at]) < 200))
      if (faulty) continue
      results.push({ start, station: a.at, trainA: a.id, aArrives: +(a.time - start).toFixed(1), trainB: b.id, bArrives: +(b.time - start).toFixed(1), bSpeedAtClick: +bAtClick.speed.toFixed(1), bDistAtClick: Math.round(bx), dirA: a.dir, dirB: b.dir })
    }
  })
})
results.forEach((r) => console.log(JSON.stringify(r)))
