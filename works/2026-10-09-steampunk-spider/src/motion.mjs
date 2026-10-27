/** Scalar second-order dynamics: frequency in Hz, damping ratio, response. */
export class SecondOrderDynamics {
  constructor(f, zeta, r, initial = 0) {
    if (
      !Number.isFinite(f) ||
      f <= 0 ||
      !Number.isFinite(zeta) ||
      zeta < 0 ||
      !Number.isFinite(r)
    ) {
      throw new RangeError(
        "Frequency must be positive; damping nonnegative; parameters finite.",
      );
    }
    const omega = 2 * Math.PI * f;
    this.k1 = (2 * zeta) / omega;
    this.k2 = 1 / (omega * omega);
    this.k3 = (r * zeta) / omega;
    // Resolve both oscillation and damping, including frames delayed by 0.5s.
    this.maxStep = 1 / (8 * f * (1 + zeta));
    this.reset(initial);
  }

  reset(value = 0) {
    if (!Number.isFinite(value)) throw new RangeError("Value must be finite.");
    this.value = value;
    this.velocity = 0;
    this.previousTarget = value;
    return this.value;
  }

  update(dt, target) {
    if (!Number.isFinite(dt) || !Number.isFinite(target))
      throw new RangeError("Time and target must be finite.");
    if (dt <= 0) return this.value;
    const steps = Math.ceil(dt / this.maxStep);
    const h = dt / steps;
    const targetVelocity = (target - this.previousTarget) / dt;
    const startTarget = this.previousTarget;
    for (let step = 1; step <= steps; step++) {
      // Interpolation makes the estimated input velocity consistent across substeps.
      const input = startTarget + ((target - startTarget) * step) / steps;
      const acceleration =
        (input +
          this.k3 * targetVelocity -
          this.value -
          this.k1 * this.velocity) /
        this.k2;
      this.velocity += h * acceleration;
      this.value += h * this.velocity;
    }
    this.previousTarget = target;
    return this.value;
  }
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const scaledAdd = (a, b, scale) => a.map((value, i) => value + b[i] * scale);
const normalize = (v) => {
  const length = Math.hypot(...v);
  return v.map((value) => value / length);
};

/** Two-bone IK. All positions, including the bend pole, are world-space [x,y,z]. */
export function solveTwoBone(hip, foot, pole, upperLength, lowerLength) {
  if (
    ![hip, foot, pole].every(
      (v) => v.length === 3 && v.every(Number.isFinite),
    ) ||
    !Number.isFinite(upperLength) ||
    upperLength <= 0 ||
    !Number.isFinite(lowerLength) ||
    lowerLength <= 0
  ) {
    throw new RangeError(
      "IK requires finite 3D positions and positive bone lengths.",
    );
  }
  const offset = subtract(foot, hip);
  const requestedDistance = Math.hypot(...offset);
  const direction = requestedDistance > 0 ? normalize(offset) : [0, -1, 0];
  const distance = Math.max(
    Math.abs(upperLength - lowerLength),
    Math.min(upperLength + lowerLength, requestedDistance),
  );
  const solvedFoot = scaledAdd(hip, direction, distance);
  const poleOffset = subtract(pole, hip);
  let bend = scaledAdd(poleOffset, direction, -dot(poleOffset, direction));
  if (Math.hypot(...bend) < 1e-10) {
    // Choose the least-aligned axis so a collinear pole still has a bend plane.
    const axis = [0, 0, 0];
    const index = direction
      .map(Math.abs)
      .indexOf(Math.min(...direction.map(Math.abs)));
    axis[index] = 1;
    bend = scaledAdd(axis, direction, -dot(axis, direction));
  }
  bend = normalize(bend);
  // Equal bones can fold back completely when the foot is exactly at the hip.
  const along =
    distance === 0
      ? 0
      : (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const knee = scaledAdd(scaledAdd(hip, direction, along), bend, height);
  return { knee, foot: solvedFoot };
}

/** Cubic Hermite motion with explicit world-space endpoint velocities. */
export function hermiteMotion(
  start,
  end,
  startVelocity,
  endVelocity,
  duration,
  elapsed,
) {
  if (
    !(duration > 0) ||
    !Number.isFinite(elapsed) ||
    ![start, end, startVelocity, endVelocity].every(
      (point) => point.length === 3 && point.every(Number.isFinite),
    )
  ) {
    throw new RangeError(
      "Hermite motion requires finite 3D data and a positive duration.",
    );
  }
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const squared = progress * progress;
  const cubed = squared * progress;
  const position = start.map(
    (value, axis) =>
      (2 * cubed - 3 * squared + 1) * value +
      (cubed - 2 * squared + progress) * duration * startVelocity[axis] +
      (-2 * cubed + 3 * squared) * end[axis] +
      (cubed - squared) * duration * endVelocity[axis],
  );
  const velocity = start.map(
    (value, axis) =>
      ((6 * squared - 6 * progress) * value) / duration +
      (3 * squared - 4 * progress + 1) * startVelocity[axis] +
      ((-6 * squared + 6 * progress) * end[axis]) / duration +
      (3 * squared - 2 * progress) * endVelocity[axis],
  );
  return { position, velocity };
}
