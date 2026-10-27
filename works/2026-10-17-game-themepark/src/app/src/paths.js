// Polylines in the ground plane (walkways, monorail loop, parade route, queues) and the
// 1 m spaced ride tracks from Blender (coaster_track.json, flume_path.json).
import coasterTrack from './paths/coaster_track.json'
import flumeTrack from './paths/flume_path.json'

export function makePath(points, closed = false, y = 0) {
  const list = points.map((point) => ({ x: point[0] ?? point.x, y: point[2] === undefined ? y : point[1], z: point[2] ?? point[1] ?? point.z }))
  const cumulative = [0]
  const count = closed ? list.length : list.length - 1
  for (let index = 0; index < count; index++) {
    const from = list[index]
    const to = list[(index + 1) % list.length]
    cumulative.push(cumulative[index] + Math.hypot(to.x - from.x, to.z - from.z))
  }
  return { points: list, cumulative, length: cumulative[cumulative.length - 1], closed }
}

// Position and heading at arc length `distance`; closed paths wrap, open paths clamp.
export function samplePath(path, distance, out = {}) {
  const { points, cumulative, length, closed } = path
  let along = closed ? ((distance % length) + length) % length : Math.max(0, Math.min(length, distance))
  let low = 0
  let high = cumulative.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (cumulative[middle] <= along) low = middle
    else high = middle
  }
  const from = points[low]
  const to = points[(low + 1) % points.length]
  const span = cumulative[low + 1] - cumulative[low] || 1
  const t = (along - cumulative[low]) / span
  out.x = from.x + (to.x - from.x) * t
  out.y = from.y + (to.y - from.y) * t
  out.z = from.z + (to.z - from.z) * t
  out.heading = Math.atan2(to.x - from.x, to.z - from.z)
  return out
}

// A rounded rectangle, counter-clockwise from above, as a closed point list.
export function roundedRect(centerX, centerZ, halfX, halfZ, radius, steps = 8) {
  const points = []
  const corners = [
    [centerX + halfX - radius, centerZ + halfZ - radius, 0],
    [centerX + halfX - radius, centerZ - halfZ + radius, -Math.PI / 2],
    [centerX - halfX + radius, centerZ - halfZ + radius, -Math.PI],
    [centerX - halfX + radius, centerZ + halfZ - radius, -1.5 * Math.PI],
  ]
  for (const [cornerX, cornerZ, start] of corners) {
    for (let step = 0; step <= steps; step++) {
      const angle = start + Math.PI / 2 - (step / steps) * (Math.PI / 2)
      points.push([cornerX + Math.sin(angle) * radius, cornerZ + Math.cos(angle) * radius])
    }
  }
  return points
}

// Ride tracks: points every metre with banked up vectors. Sampling interpolates both.
function prepareTrack(data) {
  return {
    points: data.points,
    up: data.up,
    length: data.length,
    count: data.points.length,
    station: data.station,
    lift: data.lift,
    brakes: data.brakes,
    drop: data.drop,
    carPitch: data.carPitch,
    boatLength: data.boatLength,
  }
}

export const COASTER_TRACK = prepareTrack(coasterTrack)
export const FLUME_TRACK = prepareTrack(flumeTrack)

export function sampleTrack(track, distance, out = { position: [0, 0, 0], tangent: [0, 0, 1], up: [0, 1, 0] }) {
  const along = ((distance % track.length) + track.length) % track.length
  const scaled = (along / track.length) * track.count
  const index = Math.floor(scaled) % track.count
  const next = (index + 1) % track.count
  const t = scaled - Math.floor(scaled)
  const from = track.points[index]
  const to = track.points[next]
  for (let axis = 0; axis < 3; axis++) {
    out.position[axis] = from[axis] + (to[axis] - from[axis]) * t
    out.tangent[axis] = to[axis] - from[axis]
    out.up[axis] = track.up[index][axis] + (track.up[next][axis] - track.up[index][axis]) * t
  }
  return out
}

export function trackHeight(track, distance) {
  return sampleTrack(track, distance).position[1]
}
