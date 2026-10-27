// Finds a film start time T: a Marrow Point ambulance starts reversing about 4.5 s after T and the
// Little Harbour helicopter touches down near the end of the film. node tools/forecast.mjs
import { createWorld, stepWorld, STEP } from '../src/sim/index.js'

export function forecast(limit = 3200) {
  const world = createWorld(0)
  const reversing = []
  const touchdowns = []
  const ctLoadings = []
  const phases = {}
  for (let index = 0; index < limit / STEP; index++) {
    stepWorld(world, STEP)
    const mp = world.sites.MP
    for (const vehicle of mp.vehicles) {
      const freeBed = mp.beds.some((bed) => bed.state === 'free' && !bed.reservedFor)
      if (vehicle.phase === 'reversing' && phases[vehicle.id] !== 'reversing' && freeBed) reversing.push(mp.clock)
      phases[vehicle.id] = vehicle.phase
    }
    const heli = world.sites.LH.helis[0]
    if (heli.phase === 'landed' && phases.heli !== 'landed') touchdowns.push(world.sites.LH.clock)
    phases.heli = heli.phase
    for (const room of mp.rooms) {
      if (room.kind === 'ct' && room.phase === 'loading' && phases[room.id] !== 'loading') ctLoadings.push(mp.clock)
      phases[room.id] = room.phase
    }
  }
  const options = []
  for (const reverse of reversing) {
    const start = reverse - 3.0
    if (start <= 40) continue
    // The film skips the simulation ahead (uncaptured) at about 12 s to 2 s before a patient goes onto the CT
    // couch, so the Imaging beat lands on the scanner. The helicopter must then touch down near the film's end.
    for (const ctLoading of ctLoadings) {
      const skip = ctLoading - start - 14.3
      if (skip < 0 || skip > 120) continue
      const touchdown = touchdowns.find((time) => time - start - skip > 28.5 && time - start - skip < 35)
      if (touchdown) options.push({ start, reverse, touchdown, ctLoading, skip })
    }
  }
  options.sort((first, second) => first.skip - second.skip)
  return { options, reversing, touchdowns, ctLoadings }
}

if (process.argv[1]?.endsWith('forecast.mjs')) {
  const result = forecast()
  console.log(JSON.stringify(result.options.slice(0, 5)))
  console.log('reversing', result.reversing.map((time) => time.toFixed(1)).join(' '))
  console.log('touchdowns', result.touchdowns.map((time) => time.toFixed(1)).join(' '))
}
