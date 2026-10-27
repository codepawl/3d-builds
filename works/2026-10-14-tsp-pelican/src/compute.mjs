// Runs the whole mathematical pipeline and writes data/ for the film and the score.
//   density field -> weighted Lloyd stippling -> nearest-neighbour tour -> 2-opt to zero crossings
//   -> the ride: points follow the pedalling pose, the tour is repaired by 2-opt every frame.
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openPage, ROOT } from "./browser.mjs";
import { FPS, crankAngleAt, posePoints } from "./pose.mjs";
import { DURATION, RIDE_START, STAGE_COUNTS } from "./timeline.mjs";
import {
  countCrossingsBruteForce, findCrossings, nearestNeighbourTour, nearestNeighbours, stipple, tourLength, untangle,
} from "./tsp.mjs";

os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
const DATA = path.join(ROOT, "data");
const CROP = { x: 530, y: 160, width: 880, height: 830 };
const RASTER_SCALE = 2;
const LLOYD_ITERATIONS = [60, 60, 50, 40, 40];
const LLOYD_SNAPSHOTS = [1, 2, 3, 4, 6, 8, 11, 15, 20, 26, 33, 40, 50];
const TOUR_SNAPSHOTS = 60;
const NEIGHBOURS = 10;

const started = Date.now();
const log = (message) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)} s] ${message}`);

async function loadRasters() {
  const { browser, page } = await openPage("density.html");
  const result = await page.evaluate(([crop, scale]) => window.buildRasters(crop, scale), [CROP, RASTER_SCALE]);
  await browser.close();
  return {
    width: result.width,
    height: result.height,
    density: new Uint8Array(Buffer.from(result.density, "base64")),
    labels: new Uint8Array(Buffer.from(result.labels, "base64")),
  };
}

function labelPoints(points, rasters) {
  const labels = new Uint8Array(points.length / 2);
  for (let index = 0; index < labels.length; index += 1) {
    const column = Math.min(rasters.width - 1, Math.floor((points[2 * index] - CROP.x) * RASTER_SCALE));
    const row = Math.min(rasters.height - 1, Math.floor((points[2 * index + 1] - CROP.y) * RASTER_SCALE));
    labels[index] = rasters.labels[row * rasters.width + column];
  }
  return labels;
}

const round1 = (value) => Math.round(value * 10) / 10;

function describe(tour, points, moves) {
  const crossings = findCrossings(tour, points);
  return {
    moves,
    length: round1(tourLength(tour, points)),
    crossings: crossings.length,
    crossingPoints: crossings.flatMap((crossing) => [round1(crossing.x), round1(crossing.y)]),
  };
}

function solveStage(points) {
  const count = points.length / 2;
  const neighbours = nearestNeighbours(points, NEIGHBOURS);
  const everyCity = Array.from({ length: count }, (_, index) => index);
  const startTour = nearestNeighbourTour(points);
  // Dry run to learn how many moves there are, so snapshots can be spread evenly over them.
  const totalMoves = untangle(startTour.slice(), points, neighbours, NEIGHBOURS, everyCity);
  const snapshotEvery = Math.max(1, Math.ceil(totalMoves / TOUR_SNAPSHOTS));
  const tour = startTour.slice();
  const tours = [Uint16Array.from(tour)];
  const snapshots = [describe(tour, points, 0)];
  let moves = 0;
  untangle(tour, points, neighbours, NEIGHBOURS, everyCity, () => {
    moves += 1;
    if (moves % snapshotEvery === 0 && moves < totalMoves) {
      tours.push(Uint16Array.from(tour));
      snapshots.push(describe(tour, points, moves));
    }
  });
  tours.push(Uint16Array.from(tour));
  snapshots.push(describe(tour, points, moves));
  return { tour, tours, snapshots, totalMoves: moves };
}

function concatenate(arrays, ArrayType) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const joined = new ArrayType(total);
  let offset = 0;
  for (const array of arrays) {
    joined.set(array, offset);
    offset += array.length;
  }
  return joined;
}

const writeBinary = (name, typedArray) =>
  writeFile(path.join(DATA, name), Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength));

await mkdir(DATA, { recursive: true });
const rasters = await loadRasters();
log(`rasters ${rasters.width}x${rasters.height}`);

const meta = { crop: CROP, rasterScale: RASTER_SCALE, stages: [] };
let finalPoints;
let finalTour;
for (const [stageIndex, count] of STAGE_COUNTS.entries()) {
  const lloyd = stipple({ ...rasters, scale: RASTER_SCALE, originX: CROP.x, originY: CROP.y },
    count, LLOYD_ITERATIONS[stageIndex], LLOYD_SNAPSHOTS, 1000 + stageIndex);
  log(`N=${count}: Lloyd ${LLOYD_ITERATIONS[stageIndex]} iterations, last max shift ${lloyd.lastShift.toFixed(3)} px`);
  const solved = solveStage(lloyd.points);
  const bruteForceCrossings = countCrossingsBruteForce(solved.tour, lloyd.points);
  const first = solved.snapshots[0];
  const last = solved.snapshots[solved.snapshots.length - 1];
  log(`N=${count}: NN length ${first.length}, crossings ${first.crossings} -> 2-opt ${solved.totalMoves} moves, `
    + `length ${last.length}, crossings ${last.crossings} (brute force ${bruteForceCrossings})`);
  if (bruteForceCrossings !== 0 || last.crossings !== 0) throw new Error(`stage ${count} still crosses itself`);
  await writeBinary(`stage${stageIndex}_lloyd.bin`, concatenate(lloyd.snapshots.map((snapshot) => snapshot.points), Float32Array));
  await writeBinary(`stage${stageIndex}_tours.bin`, concatenate(solved.tours, Uint16Array));
  meta.stages.push({
    count,
    lloydIterations: lloyd.snapshots.map((snapshot) => snapshot.iteration),
    lloydLastMaxShift: round1(lloyd.lastShift * 1000) / 1000,
    totalMoves: solved.totalMoves,
    bruteForceCrossings,
    snapshots: solved.snapshots,
  });
  finalPoints = lloyd.points;
  finalTour = solved.tour;
}

// The ride: pose the final points every frame and let 2-opt re-thread the line where parts pass
// each other. The tour carried from frame to frame, so only the moving places change.
const labels = labelPoints(finalPoints, rasters);
await writeBinary("labels.bin", labels);
const movingCities = [];
for (let index = 0; index < labels.length; index += 1) if (labels[index] > 2) movingCities.push(index);
const frameCount = Math.round((DURATION - RIDE_START) * FPS) + 1;
const tour = finalTour.slice();
const rideTours = [];
const ride = { frames: frameCount, moves: [], lengths: [], bruteForceChecked: [] };
for (let frame = 0; frame < frameCount; frame += 1) {
  const posed = posePoints(finalPoints, labels, crankAngleAt(frame / FPS));
  const neighbours = nearestNeighbours(posed, 8);
  const moves = untangle(tour, posed, neighbours, 8, movingCities);
  rideTours.push(Uint16Array.from(tour));
  ride.moves.push(moves);
  ride.lengths.push(round1(tourLength(tour, posed)));
  if (findCrossings(tour, posed).length !== 0) throw new Error(`ride frame ${frame} crosses itself`);
  if (frame % 30 === 0) {
    const bruteForce = countCrossingsBruteForce(tour, posed);
    if (bruteForce !== 0) throw new Error(`ride frame ${frame}: brute force found ${bruteForce} crossings`);
    ride.bruteForceChecked.push(frame);
  }
}
log(`ride: ${frameCount} frames, ${ride.moves.reduce((sum, value) => sum + value, 0)} repair moves, `
  + `max ${Math.max(...ride.moves)} in one frame, brute-force verified frames ${ride.bruteForceChecked.length}`);
await writeBinary("ride_tours.bin", concatenate(rideTours, Uint16Array));
meta.ride = ride;
await writeFile(path.join(DATA, "meta.json"), JSON.stringify(meta));
log("done");
