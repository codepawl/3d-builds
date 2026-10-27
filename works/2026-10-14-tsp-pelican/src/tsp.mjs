// Stippling and travelling-salesman geometry on flat Float32Array point lists [x0, y0, x1, y1, ...].

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// A uniform bucket grid over points, rebuilt whenever the points move.
function buildPointGrid(points, cellSize) {
  const count = points.length / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < count; index += 1) {
    minX = Math.min(minX, points[2 * index]);
    maxX = Math.max(maxX, points[2 * index]);
    minY = Math.min(minY, points[2 * index + 1]);
    maxY = Math.max(maxY, points[2 * index + 1]);
  }
  const columns = Math.floor((maxX - minX) / cellSize) + 1;
  const rows = Math.floor((maxY - minY) / cellSize) + 1;
  const cellOf = (x, y) => {
    const column = Math.min(columns - 1, Math.max(0, Math.floor((x - minX) / cellSize)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)));
    return row * columns + column;
  };
  const cellStart = new Int32Array(columns * rows + 1);
  for (let index = 0; index < count; index += 1) cellStart[cellOf(points[2 * index], points[2 * index + 1]) + 1] += 1;
  for (let cell = 0; cell < columns * rows; cell += 1) cellStart[cell + 1] += cellStart[cell];
  const fill = cellStart.slice(0, columns * rows);
  const members = new Int32Array(count);
  for (let index = 0; index < count; index += 1) {
    members[fill[cellOf(points[2 * index], points[2 * index + 1])]++] = index;
  }
  return { minX, minY, columns, rows, cellSize, cellStart, members, cellOf };
}

// Visit grid cells in growing square rings around (x, y) until no closer point can exist.
// `visit(index, distanceSquared)` returns nothing; `bestDistanceSquared()` reports the current bound.
function searchRings(grid, x, y, visit, bestDistanceSquared) {
  const column = Math.min(grid.columns - 1, Math.max(0, Math.floor((x - grid.minX) / grid.cellSize)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((y - grid.minY) / grid.cellSize)));
  const maxRing = Math.max(grid.columns, grid.rows);
  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let rowOffset = -ring; rowOffset <= ring; rowOffset += 1) {
      const cellRow = row + rowOffset;
      if (cellRow < 0 || cellRow >= grid.rows) continue;
      const onEdgeRow = Math.abs(rowOffset) === ring;
      const step = onEdgeRow ? 1 : 2 * ring;
      for (let columnOffset = -ring; columnOffset <= ring; columnOffset += Math.max(1, step)) {
        const cellColumn = column + columnOffset;
        if (cellColumn < 0 || cellColumn >= grid.columns) continue;
        const cell = cellRow * grid.columns + cellColumn;
        for (let slot = grid.cellStart[cell]; slot < grid.cellStart[cell + 1]; slot += 1) visit(grid.members[slot]);
      }
    }
    const reach = ring * grid.cellSize;
    if (bestDistanceSquared() <= reach * reach) return;
  }
}

// Weighted Lloyd relaxation on a density raster. Each iteration assigns every inked pixel to its
// nearest site (a discrete weighted Voronoi cell) and moves the site to the cell's weighted centroid.
export function stipple({ density, width, height, scale, originX, originY }, count, iterations, snapshotAt, seed) {
  const random = seededRandom(seed);
  const pixelX = [];
  const pixelY = [];
  const pixelWeight = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const weight = density[row * width + column] / 255;
      if (weight < 0.02) continue;
      pixelX.push(originX + (column + 0.5) / scale);
      pixelY.push(originY + (row + 0.5) / scale);
      pixelWeight.push(weight);
    }
  }
  const pixelCount = pixelWeight.length;
  // Start from rejection sampling of the density, so the first frame is already a fair sample.
  const sites = new Float32Array(count * 2);
  for (let placed = 0; placed < count;) {
    const pixel = Math.floor(random() * pixelCount);
    if (random() < pixelWeight[pixel]) {
      sites[2 * placed] = pixelX[pixel] + (random() - 0.5) / scale;
      sites[2 * placed + 1] = pixelY[pixel] + (random() - 0.5) / scale;
      placed += 1;
    }
  }
  const snapshots = [{ iteration: 0, points: sites.slice() }];
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const sumWeight = new Float64Array(count);
  let lastShift = 0;
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const cellSize = Math.max(2, Math.sqrt((pixelCount / scale / scale) / count) * 1.5);
    const grid = buildPointGrid(sites, cellSize);
    sumX.fill(0);
    sumY.fill(0);
    sumWeight.fill(0);
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const x = pixelX[pixel];
      const y = pixelY[pixel];
      let best = -1;
      let bestDistance = Infinity;
      searchRings(grid, x, y, (site) => {
        const distance = (sites[2 * site] - x) ** 2 + (sites[2 * site + 1] - y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = site;
        }
      }, () => bestDistance);
      const weight = pixelWeight[pixel];
      sumX[best] += weight * x;
      sumY[best] += weight * y;
      sumWeight[best] += weight;
    }
    lastShift = 0;
    for (let site = 0; site < count; site += 1) {
      if (sumWeight[site] === 0) continue;
      const newX = sumX[site] / sumWeight[site];
      const newY = sumY[site] / sumWeight[site];
      lastShift = Math.max(lastShift, Math.hypot(newX - sites[2 * site], newY - sites[2 * site + 1]));
      sites[2 * site] = newX;
      sites[2 * site + 1] = newY;
    }
    if (snapshotAt.includes(iteration) || iteration === iterations) {
      snapshots.push({ iteration, points: sites.slice() });
    }
  }
  return { points: sites, snapshots, lastShift };
}

export function tourLength(tour, points) {
  let total = 0;
  for (let position = 0; position < tour.length; position += 1) {
    const from = tour[position];
    const to = tour[(position + 1) % tour.length];
    total += Math.hypot(points[2 * to] - points[2 * from], points[2 * to + 1] - points[2 * from + 1]);
  }
  return total;
}

// Nearest-neighbour tour: always walk to the closest unvisited point.
export function nearestNeighbourTour(points) {
  const count = points.length / 2;
  const grid = buildPointGrid(points, Math.max(2, spacing(points) * 2));
  const visited = new Uint8Array(count);
  // Remaining members per cell, so emptied cells cost nothing to scan.
  const remainingInCell = new Int32Array(grid.columns * grid.rows);
  for (let cell = 0; cell < remainingInCell.length; cell += 1) {
    remainingInCell[cell] = grid.cellStart[cell + 1] - grid.cellStart[cell];
  }
  const tour = new Uint32Array(count);
  let current = 0;
  for (let step = 0; step < count; step += 1) {
    tour[step] = current;
    visited[current] = 1;
    remainingInCell[grid.cellOf(points[2 * current], points[2 * current + 1])] -= 1;
    if (step === count - 1) break;
    let best = -1;
    let bestDistance = Infinity;
    const x = points[2 * current];
    const y = points[2 * current + 1];
    searchRings(grid, x, y, (candidate) => {
      if (visited[candidate]) return;
      const distance = (points[2 * candidate] - x) ** 2 + (points[2 * candidate + 1] - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }, () => bestDistance);
    current = best;
  }
  return tour;
}

function spacing(points) {
  const count = points.length / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < count; index += 1) {
    minX = Math.min(minX, points[2 * index]);
    maxX = Math.max(maxX, points[2 * index]);
    minY = Math.min(minY, points[2 * index + 1]);
    maxY = Math.max(maxY, points[2 * index + 1]);
  }
  return Math.sqrt(((maxX - minX + 1) * (maxY - minY + 1)) / count);
}

export function nearestNeighbours(points, neighbourCount) {
  const count = points.length / 2;
  const grid = buildPointGrid(points, Math.max(1, spacing(points)));
  const neighbours = new Int32Array(count * neighbourCount);
  const bestIndex = new Int32Array(neighbourCount);
  const bestDistance = new Float64Array(neighbourCount);
  for (let index = 0; index < count; index += 1) {
    bestIndex.fill(-1);
    bestDistance.fill(Infinity);
    const x = points[2 * index];
    const y = points[2 * index + 1];
    searchRings(grid, x, y, (candidate) => {
      if (candidate === index) return;
      const distance = (points[2 * candidate] - x) ** 2 + (points[2 * candidate + 1] - y) ** 2;
      if (distance >= bestDistance[neighbourCount - 1]) return;
      let slot = neighbourCount - 1;
      while (slot > 0 && bestDistance[slot - 1] > distance) {
        bestDistance[slot] = bestDistance[slot - 1];
        bestIndex[slot] = bestIndex[slot - 1];
        slot -= 1;
      }
      bestDistance[slot] = distance;
      bestIndex[slot] = candidate;
    }, () => bestDistance[neighbourCount - 1]);
    neighbours.set(bestIndex, index * neighbourCount);
  }
  return neighbours;
}

// Reverse the cyclic stretch of tour positions from `first` to `last` (inclusive). Reversing the
// shorter of the stretch and its complement gives the same cycle, so we pick the cheaper one.
function reverseStretch(tour, positionOf, first, last) {
  const count = tour.length;
  let length = ((last - first + count) % count) + 1;
  if (length * 2 > count) {
    const newFirst = (last + 1) % count;
    last = (first - 1 + count) % count;
    first = newFirst;
    length = count - length;
  }
  for (let swap = 0; swap < Math.floor(length / 2); swap += 1) {
    const left = (first + swap) % count;
    const right = (last - swap + count) % count;
    const cityLeft = tour[left];
    tour[left] = tour[right];
    tour[right] = cityLeft;
    positionOf[tour[left]] = left;
    positionOf[tour[right]] = right;
  }
}

function positionsOf(tour) {
  const positionOf = new Int32Array(tour.length);
  for (let position = 0; position < tour.length; position += 1) positionOf[tour[position]] = position;
  return positionOf;
}

// 2-opt with neighbour lists and "don't look" bits. A move removes edges (a,b),(c,d) and adds
// (a,c),(b,d) when |ac| + |bd| < |ab| + |cd|. `onMove` is called after every applied move.
export function twoOpt(tour, points, neighbours, neighbourCount, activeCities, onMove) {
  const count = tour.length;
  const positionOf = positionsOf(tour);
  const distance = (first, second) =>
    Math.hypot(points[2 * first] - points[2 * second], points[2 * first + 1] - points[2 * second + 1]);
  const queued = new Uint8Array(count);
  const queue = [];
  const enqueue = (city) => {
    if (!queued[city]) {
      queued[city] = 1;
      queue.push(city);
    }
  };
  for (const city of activeCities) enqueue(city);
  let moves = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const cityA = queue[head];
    queued[cityA] = 0;
    let improved = false;
    for (const forward of [true, false]) {
      const positionA = positionOf[cityA];
      const cityB = tour[(positionA + (forward ? 1 : count - 1)) % count];
      const edgeAB = distance(cityA, cityB);
      for (let slot = 0; slot < neighbourCount; slot += 1) {
        const cityC = neighbours[cityA * neighbourCount + slot];
        const edgeAC = distance(cityA, cityC);
        if (edgeAC >= edgeAB) break;
        const positionC = positionOf[cityC];
        const cityD = tour[(positionC + (forward ? 1 : count - 1)) % count];
        if (cityC === cityB || cityD === cityA) continue;
        const gain = edgeAB + distance(cityC, cityD) - edgeAC - distance(cityB, cityD);
        if (gain <= 1e-7) continue;
        if (forward) reverseStretch(tour, positionOf, positionOf[cityB], positionC);
        // Backward: ... b a ... d c ...  reversing a..d gives ... b d ... a c ...
        else reverseStretch(tour, positionOf, positionOf[cityA], positionOf[cityD]);
        moves += 1;
        for (const city of [cityA, cityB, cityC, cityD]) enqueue(city);
        if (onMove) onMove();
        improved = true;
        break;
      }
      if (improved) break;
    }
  }
  return moves;
}

function orientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Proper crossing of segments ab and cd (shared endpoints and touching do not count).
export function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

// All crossings between non-adjacent tour edges, found with a grid over edge bounding boxes.
// Each crossing is counted once: in the cell that contains the intersection point.
// Returns [{ first, second, x, y }] with `first < second` as tour positions of the edges.
export function findCrossings(tour, points) {
  const count = tour.length;
  const cellSize = Math.max(2, spacing(points) * 3);
  const grid = buildPointGrid(points, cellSize);
  const edgeX1 = new Float64Array(count);
  const edgeY1 = new Float64Array(count);
  const edgeX2 = new Float64Array(count);
  const edgeY2 = new Float64Array(count);
  for (let position = 0; position < count; position += 1) {
    const from = tour[position];
    const to = tour[(position + 1) % count];
    edgeX1[position] = points[2 * from];
    edgeY1[position] = points[2 * from + 1];
    edgeX2[position] = points[2 * to];
    edgeY2[position] = points[2 * to + 1];
  }
  const cellRange = (position) => {
    const columnLow = Math.floor((Math.min(edgeX1[position], edgeX2[position]) - grid.minX) / cellSize);
    const columnHigh = Math.floor((Math.max(edgeX1[position], edgeX2[position]) - grid.minX) / cellSize);
    const rowLow = Math.floor((Math.min(edgeY1[position], edgeY2[position]) - grid.minY) / cellSize);
    const rowHigh = Math.floor((Math.max(edgeY1[position], edgeY2[position]) - grid.minY) / cellSize);
    return { columnLow, columnHigh, rowLow, rowHigh };
  };
  const cellTotal = grid.columns * grid.rows;
  const cellStart = new Int32Array(cellTotal + 1);
  for (let position = 0; position < count; position += 1) {
    const range = cellRange(position);
    for (let row = range.rowLow; row <= range.rowHigh; row += 1) {
      for (let column = range.columnLow; column <= range.columnHigh; column += 1) cellStart[row * grid.columns + column + 1] += 1;
    }
  }
  for (let cell = 0; cell < cellTotal; cell += 1) cellStart[cell + 1] += cellStart[cell];
  const fill = cellStart.slice(0, cellTotal);
  const members = new Int32Array(cellStart[cellTotal]);
  for (let position = 0; position < count; position += 1) {
    const range = cellRange(position);
    for (let row = range.rowLow; row <= range.rowHigh; row += 1) {
      for (let column = range.columnLow; column <= range.columnHigh; column += 1) members[fill[row * grid.columns + column]++] = position;
    }
  }
  const crossings = [];
  for (let cell = 0; cell < cellTotal; cell += 1) {
    for (let firstSlot = cellStart[cell]; firstSlot < cellStart[cell + 1]; firstSlot += 1) {
      const first = members[firstSlot];
      for (let secondSlot = firstSlot + 1; secondSlot < cellStart[cell + 1]; secondSlot += 1) {
        const second = members[secondSlot];
        const gap = Math.abs(first - second);
        if (gap <= 1 || gap === count - 1) continue;
        if (!segmentsCross(edgeX1[first], edgeY1[first], edgeX2[first], edgeY2[first],
          edgeX1[second], edgeY1[second], edgeX2[second], edgeY2[second])) continue;
        const denominator = (edgeX2[first] - edgeX1[first]) * (edgeY2[second] - edgeY1[second])
          - (edgeY2[first] - edgeY1[first]) * (edgeX2[second] - edgeX1[second]);
        const along = ((edgeX1[second] - edgeX1[first]) * (edgeY2[second] - edgeY1[second])
          - (edgeY1[second] - edgeY1[first]) * (edgeX2[second] - edgeX1[second])) / denominator;
        const x = edgeX1[first] + along * (edgeX2[first] - edgeX1[first]);
        const y = edgeY1[first] + along * (edgeY2[first] - edgeY1[first]);
        const column = Math.floor((x - grid.minX) / cellSize);
        const row = Math.floor((y - grid.minY) / cellSize);
        if (row * grid.columns + column !== cell) continue;
        crossings.push({ first: Math.min(first, second), second: Math.max(first, second), x, y });
      }
    }
  }
  return crossings;
}

// Independent check: every pair of non-adjacent edges, no grid. O(n^2), used to verify results.
export function countCrossingsBruteForce(tour, points) {
  const count = tour.length;
  let crossings = 0;
  for (let first = 0; first < count; first += 1) {
    const a = tour[first];
    const b = tour[(first + 1) % count];
    for (let second = first + 2; second < count; second += 1) {
      if (first === 0 && second === count - 1) continue;
      const c = tour[second];
      const d = tour[(second + 1) % count];
      if (segmentsCross(points[2 * a], points[2 * a + 1], points[2 * b], points[2 * b + 1],
        points[2 * c], points[2 * c + 1], points[2 * d], points[2 * d + 1])) crossings += 1;
    }
  }
  return crossings;
}

// Remove one crossing between tour edges at positions first < second with a 2-opt move:
// reversing positions first+1 .. second replaces the crossing pair, which is always shorter.
export function uncross(tour, crossing) {
  reverseStretch(tour, positionsOf(tour), crossing.first + 1, crossing.second);
}

// 2-opt until a local optimum and zero crossings. `onMove` sees every move.
export function untangle(tour, points, neighbours, neighbourCount, activeCities, onMove) {
  let moves = twoOpt(tour, points, neighbours, neighbourCount, activeCities, onMove);
  for (;;) {
    const crossings = findCrossings(tour, points);
    if (crossings.length === 0) return moves;
    uncross(tour, crossings[0]);
    moves += 1;
    if (onMove) onMove();
    const touched = [crossings[0].first, crossings[0].first + 1, crossings[0].second, crossings[0].second + 1]
      .map((position) => tour[position % tour.length]);
    moves += twoOpt(tour, points, neighbours, neighbourCount, touched, onMove);
  }
}
