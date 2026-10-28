// The terrain grid covers WORLD; the swarm, creatures and camera stay inside PLAY so the rim is always deep in fog.
export const WORLD = { minX: -140, maxX: 140, minZ: -140, maxZ: 140 };
export const PLAY = { minX: -115, maxX: 115, minZ: -115, maxZ: 115 };
export const SIM_DT = 1 / 60;
export const OUTPUT = { width: 1920, height: 1080 };
export const LOW = { width: 640, height: 360 };
export const GRID_STEP = 0.5;
export const WATER_LEVEL = -0.55;
export const SEGMENTS = 20;
export const MAX_WORMS = 1500;
export const START_WORMS = 1;
export const SEED = 20261028;
export const HORIZON_COLOR = "#e4e2d6";
export const SKY_TOP_COLOR = "#a9bfd0";
// Plays differ by this offset (`?seed=N`); the world itself always uses SEED. The balance bots run several seeds.
export const RUN_SEED = SEED + (typeof location === 'undefined' ? 0 : Number(new URLSearchParams(location.search).get('seed') ?? 0));
