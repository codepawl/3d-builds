// Runs the simulation headless and prints what happened: node tools/simcheck.mjs [seconds] [filter]
import { createWorld, stepWorld, STEP } from '../src/sim/index.js'
const seconds = Number(process.argv[2] ?? 600)
const world = createWorld(0)
const phases = {}
const log = []
for (let index = 0; index < seconds / STEP; index++) {
  stepWorld(world, STEP)
  for (const state of Object.values(world.sites)) {
    for (const unit of [...state.vehicles, ...state.helis]) {
      if (phases[unit.id] !== unit.phase) {
        log.push(`${state.clock.toFixed(1)} ${unit.id} ${unit.phase}`)
        phases[unit.id] = unit.phase
      }
    }
  }
}
for (const state of Object.values(world.sites)) {
  const needs = {}
  state.patients.filter((patient) => !patient.gone).forEach((patient) => (needs[patient.needs] = (needs[patient.needs] ?? 0) + 1))
  console.log(state.site.id, 'clock', state.clock.toFixed(0), 'people', state.people.length, 'patients', state.patients.length, JSON.stringify(needs), JSON.stringify(state.counters, (key, value) => (key === 'doorToDoctor' ? value.length : value)), 'beds', state.beds.map((bed) => bed.state[0]).join(''), 'convoys', state.convoys.length)
  const stuck = state.people.filter((person) => person.jobs.length && person.jobs[0].kind === 'until')
  if (stuck.length) console.log('  waiting:', stuck.map((person) => `${person.role}:${person.task}`).join('; '))
}
console.log(log.filter((line) => (process.argv[3] ? line.includes(process.argv[3]) : true)).slice(0, 40).join('\n'))
