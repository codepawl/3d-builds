// A polyline path with a belt speed per segment. Positions are [x, y, z] (y up).
export class Path {
  constructor(points, speeds) {
    this.points = points;
    this.speeds = speeds;
    this.cumulativeLength = [0];
    this.cumulativeTime = [0];
    this.segmentYaw = [];
    for (let index = 0; index < speeds.length; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const deltaX = to[0] - from[0];
      const deltaY = to[1] - from[1];
      const deltaZ = to[2] - from[2];
      const segmentLength = Math.hypot(deltaX, deltaY, deltaZ);
      this.cumulativeLength.push(this.cumulativeLength[index] + segmentLength);
      this.cumulativeTime.push(this.cumulativeTime[index] + segmentLength / speeds[index]);
      this.segmentYaw.push(Math.atan2(-deltaZ, deltaX));
    }
    this.length = this.cumulativeLength[this.cumulativeLength.length - 1];
    this.duration = this.cumulativeTime[this.cumulativeTime.length - 1];
  }

  segmentIndexAtDistance(distance) {
    const lengths = this.cumulativeLength;
    let low = 0;
    let high = this.speeds.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lengths[middle] <= distance) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  timeAtDistance(distance) {
    const clamped = Math.min(Math.max(distance, 0), this.length);
    const index = this.segmentIndexAtDistance(clamped);
    return this.cumulativeTime[index] + (clamped - this.cumulativeLength[index]) / this.speeds[index];
  }

  distanceAtTime(time) {
    if (time <= 0) return 0;
    if (time >= this.duration) return this.length;
    const times = this.cumulativeTime;
    let low = 0;
    let high = this.speeds.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (times[middle] <= time) low = middle;
      else high = middle - 1;
    }
    return this.cumulativeLength[low] + (time - times[low]) * this.speeds[low];
  }

  // Writes x, y, z, yaw of the point at a distance along the path into out.
  sample(distance, out) {
    const clamped = Math.min(Math.max(distance, 0), this.length);
    const index = this.segmentIndexAtDistance(clamped);
    const from = this.points[index];
    const to = this.points[index + 1];
    const segmentLength = this.cumulativeLength[index + 1] - this.cumulativeLength[index];
    const fraction = segmentLength > 0 ? (clamped - this.cumulativeLength[index]) / segmentLength : 0;
    out.x = from[0] + (to[0] - from[0]) * fraction;
    out.y = from[1] + (to[1] - from[1]) * fraction;
    out.z = from[2] + (to[2] - from[2]) * fraction;
    out.yaw = this.segmentYaw[index];
    return out;
  }

  // A new path that starts at a distance along this one.
  fromDistance(distance) {
    const index = this.segmentIndexAtDistance(distance);
    const start = this.sample(distance, {});
    const points = [[start.x, start.y, start.z]];
    const speeds = [];
    for (let next = index + 1; next < this.points.length; next += 1) {
      points.push(this.points[next]);
      speeds.push(this.speeds[next - 1]);
    }
    return new Path(points, speeds);
  }

  // A new path that ends at a distance along this one.
  untilDistance(distance) {
    const index = this.segmentIndexAtDistance(distance);
    const end = this.sample(distance, {});
    const points = this.points.slice(0, index + 1);
    const speeds = this.speeds.slice(0, index);
    points.push([end.x, end.y, end.z]);
    speeds.push(this.speeds[index]);
    return new Path(points, speeds);
  }

  // Distance along the path of the point nearest to a world position.
  distanceNearest(x, z) {
    let bestDistance = 0;
    let bestGap = Infinity;
    for (let index = 0; index < this.speeds.length; index += 1) {
      const from = this.points[index];
      const to = this.points[index + 1];
      const directionX = to[0] - from[0];
      const directionZ = to[2] - from[2];
      const lengthSquared = directionX * directionX + directionZ * directionZ || 1;
      const fraction = Math.min(1, Math.max(0, ((x - from[0]) * directionX + (z - from[2]) * directionZ) / lengthSquared));
      const gap = Math.hypot(from[0] + directionX * fraction - x, from[2] + directionZ * fraction - z);
      if (gap < bestGap) {
        bestGap = gap;
        bestDistance = this.cumulativeLength[index] + fraction * Math.hypot(directionX, directionZ);
      }
    }
    return bestDistance;
  }

  // Joins two paths; the link segment between them moves at linkSpeed.
  static join(first, second, linkSpeed) {
    const points = first.points.concat(second.points);
    const speeds = first.speeds.concat([linkSpeed], second.speeds);
    return new Path(points, speeds);
  }
}
