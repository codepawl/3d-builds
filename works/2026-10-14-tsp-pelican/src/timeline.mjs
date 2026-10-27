// One timeline for picture and score. Times in film seconds.
export const DURATION = 43;
// Point counts computed by compute.mjs. The last one is the line the pen draws live.
export const STAGE_COUNTS = [64, 256, 1024, 4096, 16384];
// Quick beats for the first four counts only.
const STAGE_LENGTHS = [2.5, 2.8, 3.2, 3.5];
export const INTRO_END = 0;
// Straight after the 4,096 stage the pen draws the 16,384-point line live (nothing of it shown in advance).
export const DOTS_START = INTRO_END + STAGE_LENGTHS.reduce((sum, length) => sum + length, 0);
export const PEN_START = DOTS_START;
export const PEN_END = 27;
export const RIDE_START = 28;

// Fractions of a stage: dots appear and relax, the nearest-neighbour tour draws in,
// its crossings flash gold, 2-opt untangles, then the clean line holds briefly.
export const PHASE = { tourStart: 0.25, crossingsStart: 0.38, untangleStart: 0.46, resolved: 0.85 };

export const STAGES = STAGE_LENGTHS.map((length, index) => {
  const start = INTRO_END + STAGE_LENGTHS.slice(0, index).reduce((sum, value) => sum + value, 0);
  return { count: STAGE_COUNTS[index], start, end: start + length, length };
});

export function phaseTime(stage, fraction) {
  return stage.start + stage.length * fraction;
}
