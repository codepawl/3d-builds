// A planar centreline sampled every metre. Position and tangent come from linear interpolation.
// Straight ends are extended along the end tangent so cars never run off the table.
export class PathSampler {
  constructor(controlPoints, { closed = false, cornerRadius = 0, step = 1 } = {}) {
    this.closed = closed
    const rounded = cornerRadius > 0 ? roundCorners(controlPoints, cornerRadius, closed) : controlPoints
    const points = resample(rounded, step, closed)
    this.xs = new Float32Array(points.length)
    this.zs = new Float32Array(points.length)
    this.cumulative = new Float32Array(points.length)
    let running = 0
    points.forEach((point, index) => {
      if (index > 0) running += Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1])
      this.xs[index] = point[0]
      this.zs[index] = point[1]
      this.cumulative[index] = running
    })
    this.length = running + (closed ? Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) : 0)
    this.count = points.length
    this.step = step
  }

  at(distance) {
    let s = distance
    if (this.closed) s = ((s % this.length) + this.length) % this.length
    const lastIndex = this.count - 1
    if (s <= 0 && !this.closed) return this.extend(0, s)
    if (s >= this.cumulative[lastIndex] && !this.closed) return this.extend(lastIndex, s - this.cumulative[lastIndex])
    let index = Math.min(lastIndex - 1, Math.max(0, Math.floor(s / this.step)))
    while (index < lastIndex - 1 && this.cumulative[index + 1] < s) index += 1
    while (index > 0 && this.cumulative[index] > s) index -= 1
    let nextIndex = index + 1
    if (this.closed && nextIndex > lastIndex) nextIndex = 0
    let segment = Math.hypot(this.xs[nextIndex] - this.xs[index], this.zs[nextIndex] - this.zs[index]) || 1
    const t = Math.min(1, Math.max(0, (s - this.cumulative[index]) / segment))
    const x = this.xs[index] + (this.xs[nextIndex] - this.xs[index]) * t
    const z = this.zs[index] + (this.zs[nextIndex] - this.zs[index]) * t
    const tx = (this.xs[nextIndex] - this.xs[index]) / segment
    const tz = (this.zs[nextIndex] - this.zs[index]) / segment
    return { x, z, tx, tz }
  }

  extend(index, overshoot) {
    const before = index === 0 ? 0 : index - 1
    const after = index === 0 ? 1 : index
    const segment = Math.hypot(this.xs[after] - this.xs[before], this.zs[after] - this.zs[before]) || 1
    const tx = (this.xs[after] - this.xs[before]) / segment
    const tz = (this.zs[after] - this.zs[before]) / segment
    return { x: this.xs[index] + tx * overshoot, z: this.zs[index] + tz * overshoot, tx, tz }
  }
}

function roundCorners(points, radius, closed) {
  const result = []
  const count = points.length
  for (let index = 0; index < count; index += 1) {
    const isEnd = !closed && (index === 0 || index === count - 1)
    if (isEnd) {
      result.push(points[index])
      continue
    }
    const previous = points[(index - 1 + count) % count]
    const current = points[index]
    const next = points[(index + 1) % count]
    const toPrevious = normalise([previous[0] - current[0], previous[1] - current[1]])
    const toNext = normalise([next[0] - current[0], next[1] - current[1]])
    const angle = Math.acos(Math.max(-1, Math.min(1, toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1])))
    const tangentLength = radius / Math.tan(angle / 2)
    const start = [current[0] + toPrevious[0] * tangentLength, current[1] + toPrevious[1] * tangentLength]
    const end = [current[0] + toNext[0] * tangentLength, current[1] + toNext[1] * tangentLength]
    const bisector = normalise([toPrevious[0] + toNext[0], toPrevious[1] + toNext[1]])
    const centreDistance = radius / Math.sin(angle / 2)
    const centre = [current[0] + bisector[0] * centreDistance, current[1] + bisector[1] * centreDistance]
    const startAngle = Math.atan2(start[1] - centre[1], start[0] - centre[0])
    let endAngle = Math.atan2(end[1] - centre[1], end[0] - centre[0])
    let delta = endAngle - startAngle
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const pieces = Math.max(6, Math.ceil(Math.abs(delta) / 0.08))
    for (let piece = 0; piece <= pieces; piece += 1) {
      const a = startAngle + (delta * piece) / pieces
      result.push([centre[0] + Math.cos(a) * radius, centre[1] + Math.sin(a) * radius])
    }
  }
  return result
}

function normalise(vector) {
  const length = Math.hypot(vector[0], vector[1]) || 1
  return [vector[0] / length, vector[1] / length]
}

function resample(points, step, closed) {
  const source = closed ? [...points, points[0]] : points
  const output = [source[0]]
  let carried = 0
  for (let index = 1; index < source.length; index += 1) {
    const from = source[index - 1]
    const to = source[index]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    let position = step - carried
    while (position <= length) {
      const t = position / length
      output.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])
      position += step
    }
    carried = length - (position - step)
  }
  if (!closed) output.push(source[source.length - 1])
  return output
}

export const smoothstep = (t) => {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped * clamped * (3 - 2 * clamped)
}
