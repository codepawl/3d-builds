// How the pen draws the final tour: where it starts, how fast it goes at every edge, and the one
// stretch that gets a slow close-up. Shared by the picture (pen and camera) and the score (the build).
import { PART } from "./pelican.mjs";

const EYE = { x: 1056, y: 205 };
const CLOSE_UP_SPEED = 10;
const TOP_SPEED = 256;
const CLOSE_UP_EDGES = 240;
// Stretches that end inside the final pull-back (the last edges) are not used for the close-up.
export const FINAL_PULL_BACK_EDGES = 1200;

// Regions that get a magnified stretch, mid-drawing (a wheel) and near the end (the bill).
const REGIONS = [
  { name: "bill", caption: "close-up · the bill and throat pouch",
    contains: (label, x, y) => label === PART.body && x > 1075 && y < 350, searchFrom: 3200 },
  { name: "wheel", caption: "close-up · a wheel and its spokes",
    contains: (label) => label === PART.frontWheel || label === PART.rearWheel, searchFrom: 6000, searchTo: 11000 },
];

function longestRun(order, inside, from, to) {
  let best = { start: 0, end: 0 };
  let runStart = -1;
  for (let edge = from; edge <= to; edge += 1) {
    const isInside = edge < to && inside(order[edge]);
    if (isInside && runStart < 0) runStart = edge;
    if (!isInside && runStart >= 0) {
      if (edge - runStart > best.end - best.start) best = { start: runStart, end: edge };
      runStart = -1;
    }
  }
  return best;
}

export function buildPenPlan(points, tour, labels, duration) {
  const count = tour.length;
  // Start at the city nearest the eye, so the first strokes are the face.
  let startPosition = 0;
  let bestDistance = Infinity;
  for (let position = 0; position < count; position += 1) {
    const city = tour[position];
    const distance = (points[2 * city] - EYE.x) ** 2 + (points[2 * city + 1] - EYE.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      startPosition = position;
    }
  }
  const order = new Uint16Array(count + 1);
  for (let edge = 0; edge <= count; edge += 1) order[edge] = tour[(startPosition + edge) % count];

  // The close-up: the middle of the preferred region's longest uninterrupted stretch.
  const windows = REGIONS.map((region) => {
    const run = longestRun(order, (city) => region.contains(labels[city], points[2 * city], points[2 * city + 1]),
      region.searchFrom, region.searchTo ?? count - FINAL_PULL_BACK_EDGES);
    const length = Math.min(CLOSE_UP_EDGES, run.end - run.start);
    const start = Math.round((run.start + run.end - length) / 2);
    return { ...region, start, end: start + length };
  }).filter((window) => window.end - window.start >= 100).sort((first, second) => first.start - second.start);

  // Speed keys in edge space, interpolated in log space: x4 for the opening, rising through x16 and x64
  // to x256, easing down to x10 for each magnified stretch and back up after it.
  const baseKeys = [[0, 4], [100, 4], [400, 16], [1500, 64], [5000, 128], [9000, TOP_SPEED]];
  // A base key inside a window's slow-down and speed-up ramps would fight them, so it is dropped.
  const keys = baseKeys.filter(([edge]) => !windows.some((window) => edge > window.start - 250 && edge < window.end + 350));
  for (const window of windows) {
    keys.push([window.start - 250, TOP_SPEED], [window.start, CLOSE_UP_SPEED], [window.end, CLOSE_UP_SPEED], [window.end + 350, TOP_SPEED]);
  }
  keys.push([count, TOP_SPEED]);
  keys.sort((first, second) => first[0] - second[0]);
  const speedAtEdge = (edge) => {
    const upper = keys.findIndex(([keyEdge]) => keyEdge > edge);
    if (upper < 0) return keys[keys.length - 1][1];
    const [lowEdge, lowSpeed] = keys[upper - 1];
    const [highEdge, highSpeed] = keys[upper];
    const blend = (edge - lowEdge) / (highEdge - lowEdge);
    const eased = blend * blend * (3 - 2 * blend);
    return Math.exp(Math.log(lowSpeed) + (Math.log(highSpeed) - Math.log(lowSpeed)) * eased);
  };
  // Time to draw edge e is proportional to 1 / speed(e); scale so the whole tour takes `duration`.
  const units = new Float64Array(count + 1);
  for (let edge = 0; edge < count; edge += 1) units[edge + 1] = units[edge] + 1 / speedAtEdge(edge + 0.5);
  const unitsPerSecond = units[count] / duration;

  const edgeAtTime = (seconds) => {
    const target = Math.min(units[count], Math.max(0, seconds * unitsPerSecond));
    let low = 0;
    let high = count;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (units[middle] <= target) low = middle;
      else high = middle;
    }
    return low + (target - units[low]) / (units[low + 1] - units[low]);
  };
  const timeOfEdge = (edge) => units[Math.min(count, Math.max(0, Math.round(edge)))] / unitsPerSecond;
  const windowAt = (edge) => windows.find((window) => edge >= window.start - 120 && edge < window.end) ?? null;
  return { order, count, windows, speedAtEdge, edgeAtTime, timeOfEdge, windowAt, baseEdgesPerSecond: unitsPerSecond };
}
