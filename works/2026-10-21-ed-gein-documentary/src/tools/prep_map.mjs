// Turns the traced quad GeoJSON into one compact file for the app: public/data/map.json.
// Local frame (metres) has the store point as origin, the same as terrain.glb:
//   x = (lon + 89.49233) * 79724, north = (lat - 44.21349) * 111132; three.js z = -north.
// Short isolated road pieces (letters of map labels that the tracer kept) are dropped, and the
// road route from the store to the farm is found with Dijkstra so the camera can fly along it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mapDir = path.join(root, 'public', 'assets', 'map')
const outputFile = path.join(root, 'public', 'data', 'map.json')

const STORE_LON = -89.49233
const STORE_LAT = 44.21349
const METRES_PER_DEGREE_LON = 79724
const METRES_PER_DEGREE_LAT = 111132
const SNAP_METRES = 18
const MIN_COMPONENT_LENGTH = 450
const MIN_COMPONENT_SPAN = 320

function readGeoJson(name) {
  return JSON.parse(fs.readFileSync(path.join(mapDir, `${name}.geojson`), 'utf8'))
}

function toLocal([lon, lat]) {
  const x = (lon - STORE_LON) * METRES_PER_DEGREE_LON
  const z = -(lat - STORE_LAT) * METRES_PER_DEGREE_LAT
  return [Math.round(x * 10) / 10, Math.round(z * 10) / 10]
}

function lineLength(points) {
  let total = 0
  for (let index = 1; index < points.length; index++) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1])
  }
  return total
}

// Union-find over line endpoints snapped to a grid, so touching pieces join one component.
function componentsOf(lines) {
  const parent = lines.map((_, index) => index)
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const union = (first, second) => {
    parent[find(first)] = find(second)
  }
  const cellOwners = new Map()
  lines.forEach((line, lineIndex) => {
    for (const point of line.points) {
      const cellX = Math.floor(point[0] / SNAP_METRES)
      const cellZ = Math.floor(point[1] / SNAP_METRES)
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
          const owner = cellOwners.get(`${cellX + offsetX},${cellZ + offsetZ}`)
          if (owner !== undefined) union(owner, lineIndex)
        }
      }
      cellOwners.set(`${cellX},${cellZ}`, lineIndex)
    }
  })
  return lines.map((_, index) => find(index))
}

function filterSquiggles(lines) {
  const componentIds = componentsOf(lines)
  const stats = new Map()
  lines.forEach((line, index) => {
    const id = componentIds[index]
    const entry = stats.get(id) ?? { length: 0, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    entry.length += lineLength(line.points)
    for (const [x, z] of line.points) {
      entry.minX = Math.min(entry.minX, x)
      entry.maxX = Math.max(entry.maxX, x)
      entry.minZ = Math.min(entry.minZ, z)
      entry.maxZ = Math.max(entry.maxZ, z)
    }
    stats.set(id, entry)
  })
  return lines.filter((_, index) => {
    const entry = stats.get(componentIds[index])
    const span = Math.hypot(entry.maxX - entry.minX, entry.maxZ - entry.minZ)
    return entry.length >= MIN_COMPONENT_LENGTH && span >= MIN_COMPONENT_SPAN
  })
}

function flattenSegments(lines) {
  const segments = []
  for (const line of lines) {
    for (let index = 1; index < line.points.length; index++) {
      segments.push(...line.points[index - 1], ...line.points[index])
    }
  }
  return segments
}

// Dijkstra over every road vertex, with vertices closer than SNAP_METRES merged.
function findRoute(lines, start, goal) {
  const nodeIndexByCell = new Map()
  const nodes = []
  const nodeFor = (point) => {
    const cellX = Math.round(point[0] / SNAP_METRES)
    const cellZ = Math.round(point[1] / SNAP_METRES)
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
        const existing = nodeIndexByCell.get(`${cellX + offsetX},${cellZ + offsetZ}`)
        if (existing !== undefined && Math.hypot(nodes[existing][0] - point[0], nodes[existing][1] - point[1]) < SNAP_METRES) {
          return existing
        }
      }
    }
    nodes.push(point)
    nodeIndexByCell.set(`${cellX},${cellZ}`, nodes.length - 1)
    return nodes.length - 1
  }
  const edges = []
  for (const line of lines) {
    let previous = nodeFor(line.points[0])
    for (let index = 1; index < line.points.length; index++) {
      const current = nodeFor(line.points[index])
      if (current !== previous) {
        const cost = Math.hypot(nodes[current][0] - nodes[previous][0], nodes[current][1] - nodes[previous][1])
        ;(edges[previous] ??= []).push([current, cost])
        ;(edges[current] ??= []).push([previous, cost])
      }
      previous = current
    }
  }
  // The tracer leaves small gaps at crossings and dashes: bridge each dead end to vertices nearby.
  const BRIDGE_METRES = 650
  const bridgeGrid = new Map()
  nodes.forEach((node, index) => {
    const key = `${Math.floor(node[0] / BRIDGE_METRES)},${Math.floor(node[1] / BRIDGE_METRES)}`
    const bucket = bridgeGrid.get(key) ?? []
    bucket.push(index)
    bridgeGrid.set(key, bucket)
  })
  nodes.forEach((node, index) => {
    if ((edges[index]?.length ?? 0) > 1) return
    const cellX = Math.floor(node[0] / BRIDGE_METRES)
    const cellZ = Math.floor(node[1] / BRIDGE_METRES)
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
        for (const other of bridgeGrid.get(`${cellX + offsetX},${cellZ + offsetZ}`) ?? []) {
          if (other === index) continue
          const gap = Math.hypot(nodes[other][0] - node[0], nodes[other][1] - node[1])
          if (gap > BRIDGE_METRES) continue
          ;(edges[index] ??= []).push([other, gap * (gap > 80 ? 4 : 1.5)])
          ;(edges[other] ??= []).push([index, gap * (gap > 80 ? 4 : 1.5)])
        }
      }
    }
  })
  const nearest = (point) => {
    let best = 0
    let bestDistance = Infinity
    nodes.forEach((node, index) => {
      const distance = Math.hypot(node[0] - point[0], node[1] - point[1])
      if (distance < bestDistance && edges[index]) {
        bestDistance = distance
        best = index
      }
    })
    return best
  }
  const startNode = nearest(start)
  const goalNode = nearest(goal)
  const distance = new Float64Array(nodes.length).fill(Infinity)
  const previousNode = new Int32Array(nodes.length).fill(-1)
  const visited = new Uint8Array(nodes.length)
  distance[startNode] = 0
  // A binary heap keeps this fast on about 40k vertices.
  const heap = [[0, startNode]]
  const push = (item) => {
    heap.push(item)
    let child = heap.length - 1
    while (child > 0) {
      const parentIndex = (child - 1) >> 1
      if (heap[parentIndex][0] <= heap[child][0]) break
      ;[heap[parentIndex], heap[child]] = [heap[child], heap[parentIndex]]
      child = parentIndex
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length > 0) {
      heap[0] = last
      let parentIndex = 0
      for (;;) {
        const left = parentIndex * 2 + 1
        const right = left + 1
        let smallest = parentIndex
        if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left
        if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right
        if (smallest === parentIndex) break
        ;[heap[parentIndex], heap[smallest]] = [heap[smallest], heap[parentIndex]]
        parentIndex = smallest
      }
    }
    return top
  }
  while (heap.length > 0) {
    const [cost, node] = pop()
    if (visited[node]) continue
    visited[node] = 1
    if (node === goalNode) break
    for (const [neighbour, edgeCost] of edges[node] ?? []) {
      const nextCost = cost + edgeCost
      if (nextCost < distance[neighbour]) {
        distance[neighbour] = nextCost
        previousNode[neighbour] = node
        push([nextCost, neighbour])
      }
    }
  }
  if (!Number.isFinite(distance[goalNode])) return null
  const route = []
  for (let node = goalNode; node !== -1; node = previousNode[node]) route.push(nodes[node])
  route.reverse()
  return { points: route, length: distance[goalNode], startGap: Math.hypot(...start.map((value, index) => value - nodes[startNode][index])), goalGap: Math.hypot(...goal.map((value, index) => value - nodes[goalNode][index])) }
}

const roadLines = readGeoJson('roads').features.map((feature) => ({
  highway: feature.properties.class === 'highway',
  points: feature.geometry.coordinates.map(toLocal),
}))
const keptRoads = filterSquiggles(roadLines)
const streamLines = readGeoJson('streams').features.map((feature) => ({ points: feature.geometry.coordinates.map(toLocal) }))
const water = readGeoJson('water_areas').features.map((feature) => feature.geometry.coordinates[0].map(toLocal))
const buildings = readGeoJson('buildings').features.flatMap((feature) => toLocal(feature.geometry.coordinates))
const places = readGeoJson('places').features.map((feature) => ({
  name: feature.properties.name,
  position: toLocal(feature.geometry.coordinates),
}))

const farm = places.find((place) => place.name.startsWith('Gein farm')).position
const route = findRoute(keptRoads, [0, 0], farm)

const output = {
  frame: 'metres, origin = Worden store point, x east, z south',
  roads: flattenSegments(keptRoads.filter((line) => !line.highway)),
  highways: flattenSegments(keptRoads.filter((line) => line.highway)),
  streams: flattenSegments(streamLines),
  water,
  buildings,
  route: route ? route.points : [[0, 0], farm],
  places,
}
fs.writeFileSync(outputFile, JSON.stringify(output))
console.log(`roads kept ${keptRoads.length} of ${roadLines.length}; dropped ${roadLines.length - keptRoads.length}`)
console.log(route ? `route ${route.points.length} points, ${(route.length / 1609.34).toFixed(2)} mi by road, gaps ${route.startGap.toFixed(0)} m / ${route.goalGap.toFixed(0)} m` : 'no route found')
console.log(`wrote ${(fs.statSync(outputFile).size / 1e6).toFixed(2)} MB`)
