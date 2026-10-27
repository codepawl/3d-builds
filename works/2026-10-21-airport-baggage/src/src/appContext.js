import { buildWorld } from './sim/layout.js';
import { createSimulation } from './sim/simulation.js';

// One world and one simulation for the whole page. The simulation starts a minute in so the sorter is already full.
export const world = buildWorld();
export const sim = createSimulation(world, { heroArrival: 60 });
sim.jumpTo(Number(new URLSearchParams(window.location.search).get('start')) || 40);

// Name and clock of the made-up airport.
export const AIRPORT = { name: 'Meridian International', code: 'MRD', clockStart: 6 * 3600 + 41 * 60 + 20 };
