// The whole network: one seeded department per hospital, all advanced together so switching
// sites shows a department that kept running.
import { SITES } from '../data.js'
import { createSite, stepSite } from './er.js'

export const STEP = 1 / 30

export function createWorld(warmSeconds = 60) {
  const sites = {}
  for (const site of SITES) sites[site.id] = createSite(site)
  const steps = Math.round(warmSeconds / STEP)
  for (let index = 0; index < steps; index++) stepWorld({ sites }, STEP)
  return { sites }
}

export function stepWorld(world, dt) {
  for (const state of Object.values(world.sites)) stepSite(state, dt)
}
